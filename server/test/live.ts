// The three services together, for real: Clerk signs a test player in, Convex makes a world for them, and
// the world server on this machine lets them in with Clerk's own token and tells Convex who is there.
//
//   bun server/test/live.ts
//
// It needs the keys in .env.local (see .env.example) and a Clerk user to play as. It uses the dev instances
// only, starts its own `wrangler dev` on port 5546, and removes the world and the session it made.
import { ConvexHttpClient } from 'convex/browser';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { api } from '../../convex/_generated/api';
import { ROOT, join, sleep, startServer } from './local.ts';

const PORT = 5546;
const TEST_USER = process.env.CLERK_TEST_EMAIL ?? 'ada.tester+clerk_test@example.com';

function keys(): Record<string, string> {
  let text = '';
  try {
    text = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  } catch {
    // No file: the names below are reported as missing.
  }
  const found: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) found[match[1]!] = match[2]!.replace(/^["']|["']$/g, '');
  }
  return found;
}

const env = keys();
const missing = ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL', 'VITE_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'WORLD_SERVER_SECRET'].filter((name) => !env[name]);
if (missing.length > 0) {
  console.log(`SKIPPED: .env.local lacks ${missing.join(', ')}`);
  process.exit(2);
}

// A publishable key is `pk_test_` and then the instance's address in base64, ending in `$`.
const issuer = `https://${atob(env.VITE_CLERK_PUBLISHABLE_KEY!.split('_')[2]!).replace(/\$$/, '')}`;

async function clerk<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Clerk ${path} answered ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}

let failed = 0;
function check(what: string, ok: boolean, detail: string): void {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}\n      ${detail}`);
}

const users = await clerk<{ id: string }[]>(`/users?email_address=${encodeURIComponent(TEST_USER)}`);
if (users.length === 0) {
  console.log(`SKIPPED: Clerk has no user ${TEST_USER}. Set CLERK_TEST_EMAIL to one that exists.`);
  process.exit(2);
}
const session = await clerk<{ id: string }>('/sessions', { user_id: users[0]!.id });
/** Clerk's session tokens live for a minute, so each step asks for a new one. */
const token = async (): Promise<string> => (await clerk<{ jwt: string }>(`/sessions/${session.id}/tokens`, {})).jwt;

const convex = new ConvexHttpClient(env.VITE_CONVEX_URL!);
convex.setAuth(await token());
const me = await convex.mutation(api.profiles.ensure, {});
const worldId = await convex.mutation(api.worlds.create, { name: 'Live check' });
const card = async (): Promise<{ playersNow: { playerId: string; name: string }[] } | undefined> => {
  convex.setAuth(await token());
  return (await convex.query(api.worlds.list, {})).find((world) => world._id === worldId);
};

const server = await startServer({
  port: PORT, name: 'live', fresh: true,
  vars: {
    DEV_TOKENS: '', CLERK_ISSUER: issuer, CLERK_AUDIENCE: 'convex',
    CONVEX_URL: env.VITE_CONVEX_URL!, CONVEX_SITE_URL: env.VITE_CONVEX_SITE_URL!, WORLD_SERVER_SECRET: env.WORLD_SERVER_SECRET!,
  },
});
console.log(`world server up on ${server.http}, pid ${server.pid}; Clerk ${issuer}; Convex ${env.VITE_CONVEX_URL}\n`);

try {
  const real = await token();
  const fake = await join(server, worldId, 'ann', { token: 'dev:ann' });
  check('a made-up token is refused when dev tokens are off', fake.net.state === 'refused', `state ${fake.net.state}`);
  await fake.leave();

  const stranger = await join(server, 'not-a-world', 'ada', { token: real });
  check('a real player is kept out of a world Convex does not know', stranger.net.state === 'refused', `state ${stranger.net.state}`);
  await stranger.leave();

  const ada = await join(server, worldId, 'ada', { token: real });
  check('a real Clerk token gets the player into their own world', ada.net.state === 'open', `state ${ada.net.state}, world ${worldId}`);

  let seen = await card();
  for (let tries = 0; tries < 20 && !seen?.playersNow.some((p) => p.playerId === me._id); tries++) {
    await sleep(250);
    seen = await card();
  }
  check('Convex shows the player in the world', seen?.playersNow.some((p) => p.playerId === me._id) === true, `playersNow ${JSON.stringify(seen?.playersNow)}`);

  await ada.leave();
  seen = await card();
  for (let tries = 0; tries < 20 && seen?.playersNow.length !== 0; tries++) {
    await sleep(250);
    seen = await card();
  }
  check('Convex shows the world empty after they leave', seen?.playersNow.length === 0, `playersNow ${JSON.stringify(seen?.playersNow)}`);
} finally {
  await server.stop();
  convex.setAuth(await token());
  await convex.mutation(api.worlds.remove, { worldId });
  await clerk(`/sessions/${session.id}/revoke`, {});
}

console.log(failed === 0 ? '\nevery check passed' : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
