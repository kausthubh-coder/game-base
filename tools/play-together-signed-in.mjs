// Real Clerk UI -> Account panel -> invite -> world server. No dev authentication.
// bun tools/play-together-signed-in.mjs [--url https://...] [--no-build] [--out folder]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { startServer } from '../server/test/local.ts';
import { cardProxy } from './play/signed-in-card-proxy.mjs';
import { supply, walkTo as walkPlayer } from './play/signed-in-actions.mjs';
import { launchChrome } from './lib/chrome.mjs';
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const keys = (f) => {
  try {
    return Object.fromEntries(
      readFileSync(f, 'utf8')
        .split('\n')
        .flatMap((l) => {
          const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
          return m ? [[m[1], m[2].replace(/^["']|["']$/g, '')]] : [];
        }),
    );
  } catch {
    return {};
  }
};
const live = opt('url', null);
if (live && args.includes('--reorder-cards')) throw Error('--reorder-cards is local only');
if (live && !/^https:\/\//.test(live)) throw Error('--url must be HTTPS');
const env = { ...process.env, ...keys('.env.local'), ...(live ? keys('.env.live.local') : {}) };
for (const k of [
  'CLERK_SECRET_KEY',
  'VITE_CLERK_PUBLISHABLE_KEY',
  'VITE_CONVEX_URL',
  'VITE_CONVEX_SITE_URL',
  'WORLD_SERVER_SECRET',
])
  if (!env[k]) throw Error(`Missing ${k}`);
if (!env.CLERK_SECRET_KEY.startsWith('sk_test_'))
  throw Error('Only Clerk development keys are supported');
if (live && !keys('.env.live.local').VITE_CONVEX_URL)
  throw Error('--url requires .env.live.local with the deployed Convex URLs');
const out = resolve(opt('out', `.artifacts/signed-in/${Date.now()}`));
mkdirSync(out, { recursive: true });
const issuer = `https://${atob(env.VITE_CLERK_PUBLISHABLE_KEY.split('_')[2]).replace(/\$$/, '')}`;
const redact = (s) => {
  for (const k of ['CLERK_SECRET_KEY', 'WORLD_SERVER_SECRET'])
    s = s.replaceAll(env[k], '<REDACTED>');
  for (const value of Object.values(passwords)) s = s.replaceAll(value, '<REDACTED>');
  return s;
};
const clerk = async (path, body) => {
  const r = await fetch(`https://api.clerk.com/v1${path}`, {
    method: body === undefined ? 'GET' : /^\/users\/user_/.test(path) ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw Error(`Clerk ${path.split('?')[0]} HTTP ${r.status}`);
  return r.json();
};
const results = [];
let browser, server, worldId, ownerSession, proxy;
const passwordFile = resolve('.artifacts/signed-in/accounts.json');
mkdirSync(resolve('.artifacts/signed-in'), { recursive: true });
let passwords = {};
try {
  passwords = JSON.parse(readFileSync(passwordFile, 'utf8'));
} catch {}
const pages = [];
const runtimeErrors = [];
const wait = (p, f, a, timeout = 30000) => p.waitForFunction(f, a, { timeout, polling: 100 });
const ready = (p) => wait(p, () => window.__game?.online?.debug().ready, undefined, 60000);
async function evidence(p, name) {
  await p.screenshot({ path: resolve(out, `${name}.png`) });
  const s = await p.evaluate(() => ({
    url: location.href,
    clerk: {
      signedIn: !!window.Clerk?.user,
      signInStatus: window.Clerk?.client?.signIn?.status,
      firstFactor: window.Clerk?.client?.signIn?.firstFactorVerification?.status,
    },
    state: window.__game?.state(),
    placed: window.__game?.view?.game.systems.placeables?.all(),
    nearest: window.__game?.view?.game.systems.interact?.nearest()?.id,
    online: window.__game?.online?.debug(),
    text: document.body.innerText,
  }));
  writeFileSync(resolve(out, `${name}.json`), JSON.stringify(s, null, 2));
  return s;
}
async function step(n, title, fn) {
  try {
    const detail = await fn();
    results.push({ n, title, status: 'PASS', detail });
    console.log(`PASS ${n} ${title}`);
    return true;
  } catch (e) {
    const detail = redact(String(e));
    results.push({ n, title, status: 'FAIL', detail });
    console.log(`FAIL ${n} ${title}: ${detail}`);
    for (let i = 0; i < pages.length; i++)
      await evidence(pages[i], `failure-${n}-${i}`).catch(() => {});
    return false;
  }
}
async function account(p) {
  if (await p.locator('.acct').isVisible()) return;
  await p.keyboard.press('Escape');
  await p.locator('.gu-panel-pause').waitFor();
  await p.getByRole('button', { name: 'Account', exact: true }).click();
  await p.locator('.acct').waitFor();
}
async function resume(p) {
  for (let n = 0; n < 3; n++) {
    const old = await p.evaluate(() => document.querySelector('.gu-panel')?.className ?? null);
    if (!old) {
      await wait(p, () => !window.__game.state().paused);
      return;
    }
    await p.keyboard.press('Escape');
    await wait(p, (old) => (document.querySelector('.gu-panel')?.className ?? null) !== old, old);
  }
  await wait(p, () => !window.__game.state().paused && !document.querySelector('.gu-panel'));
}
async function signIn(p, email) {
  await account(p);
  await p.locator('[data-key="sign-in"]').click();
  await evidence(p, 'clerk-opened');
  const identifier = p.locator('input[name="identifier"]');
  console.log('Clerk identifier');
  await identifier.waitFor();
  await identifier.fill(email);
  console.log('Clerk continue');
  const prepared = p
    .waitForResponse(
      (r) =>
        /prepare_(first|second)_factor/.test(r.url()) &&
        r.request().method() === 'POST' &&
        r.status() === 200,
      { timeout: 30000 },
    )
    .catch(() => null);
  await p.getByRole('button', { name: 'Continue', exact: true }).click();
  // Test-email OTP is 424242. Password-first instances offer the email-code alternative.
  await evidence(p, 'clerk-after-identifier');
  console.log('Clerk OTP or password');
  const password = p.locator('input[name="password"]');
  const otp = p.locator('input[autocomplete="one-time-code"]').first();
  await Promise.race([password.waitFor(), otp.waitFor()]);
  if (await password.isVisible()) {
    if (passwords[email]) {
      await password.fill(passwords[email]);
      await p.getByRole('button', { name: 'Continue', exact: true }).click();
      await Promise.race([otp.waitFor(), p.locator('[data-key="sign-out"]').waitFor()]);
      if (await p.locator('[data-key="sign-out"]').isVisible()) return;
    } else {
      await p.getByText('Use another method', { exact: true }).click();
      await p.getByRole('button', { name: /email.*code|code.*email/i }).click();
    }
  }
  await prepared;
  const code = p.locator('input[autocomplete="one-time-code"]').first();
  await code.fill('424242');
  const cont = p.getByRole('button', { name: 'Continue', exact: true });
  if (await cont.isVisible()) await cont.click();
  await p.locator('[data-key="sign-out"]').waitFor({ timeout: 60000 });
  await wait(p, () => !document.querySelector('[data-key="together"]')?.disabled);
}
let convex;
const auth = async () => {
  convex.setAuth((await clerk(`/sessions/${ownerSession.id}/tokens`, {})).jwt);
};
const card = async () => {
  await auth();
  return (await convex.query(api.worlds.list, {})).find((w) => w._id === worldId);
};
async function poll(fn, what) {
  const end = Date.now() + 20000;
  do {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 200));
  } while (Date.now() < end);
  throw Error(`Timed out: ${what}`);
}
try {
  const emails = [
    'ada.tester+clerk_test@example.com',
    'bo.tester+clerk_test@example.com',
    'cy.tester+clerk_test@example.com',
  ];
  const users = [];
  for (const email of emails) {
    let u = (await clerk(`/users?email_address=${encodeURIComponent(email)}`))[0];
    if (!u)
      u = await clerk('/users', {
        email_address: [email],
        skip_password_requirement: true,
        first_name: email.split('.')[0],
      });
    if (email !== emails[0] && !passwords[email]) {
      const password = `Game-test-${crypto.randomUUID()}!`;
      await clerk(`/users/${u.id}`, { password, skip_password_checks: true });
      passwords[email] = password;
      writeFileSync(passwordFile, JSON.stringify(passwords), { mode: 0o600 });
    }
    users.push(u);
  }
  ownerSession = await clerk('/sessions', { user_id: users[0].id });
  convex = new ConvexHttpClient(env.VITE_CONVEX_URL);
  const testing = await clerk('/testing_tokens', {});
  if (!live) {
    if (!args.includes('--no-build')) {
      const b = Bun.spawn(['bun', 'run', 'build'], {
        env,
        stdout: Bun.file(resolve(out, 'build.log')),
        stderr: Bun.file(resolve(out, 'build-errors.log')),
      });
      if ((await b.exited) !== 0) throw Error('Build failed; see build.log');
    }
    if (args.includes('--reorder-cards')) proxy = cardProxy(env.VITE_CONVEX_SITE_URL);
    server = await startServer({
      port: Number(opt('port', '5570')),
      name: `signed-in-${opt('port', '5570')}`,
      fresh: true,
      vars: {
        DEV_TOKENS: '',
        CLERK_ISSUER: issuer,
        CLERK_AUDIENCE: 'convex',
        CONVEX_URL: env.VITE_CONVEX_URL,
        CONVEX_SITE_URL: proxy?.url ?? env.VITE_CONVEX_SITE_URL,
        WORLD_SERVER_SECRET: env.WORLD_SERVER_SECRET,
      },
    });
    console.log(`Local server pid ${server.pid}; dev tokens OFF`);
  }
  const base = live?.replace(/\/$/, '') ?? server.http;
  browser = await launchChrome();
  async function page(url) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await c.route(`${issuer}/**`, async (route) => {
      const u = new URL(route.request().url());
      u.searchParams.set('__clerk_testing_token', testing.token);
      await route.continue({ url: u.href });
    });
    const p = await c.newPage();
    p.setDefaultTimeout(30000);
    p.on('response', async (r) => {
      if (r.url().includes('/v1/client/sign_ins')) {
        const j = await r.json().catch(() => ({}));
        const line = JSON.stringify({
          path: new URL(r.url()).pathname,
          status: r.status(),
          errors: j.errors?.map((e) => ({
            code: e.code,
            message: e.message,
            long_message: e.long_message,
          })),
        });
        await Bun.write(
          Bun.file(resolve(out, 'clerk-requests.jsonl')),
          (await Bun.file(resolve(out, 'clerk-requests.jsonl'))
            .text()
            .catch(() => '')) +
            line +
            '\n',
        );
      }
    });
    p.on('pageerror', (e) => {
      const error = redact(String(e));
      runtimeErrors.push(error);
      writeFileSync(resolve(out, `pageerror-${pages.length}.txt`), error);
    });
    pages.push(p);
    console.log('Opening', new URL(url).pathname);
    await p.goto(url);
    await wait(p, () => window.__game);
    if (!new URL(url).searchParams.has('world')) {
      await p.locator('[data-key="title:new"]').click();
      await p.locator('[data-key="opening:skip"]').click();
      await p.locator('.st-cinema').waitFor({ state: 'hidden', timeout: 60000 });
    }
    await wait(p, () => window.__game?.started, undefined, 60000);
    return p;
  }
  const a = await page(`${base}/?quality=low`);
  let link, b, c;
  const made = await step(1, 'Clerk sign-in, Play together, copy invite', async () => {
    await signIn(a, emails[0]);
    await a.locator('[data-key="together"]').click();
    const field = a.getByRole('textbox', { name: 'The link to send' });
    await field.waitFor();
    link = await field.inputValue();
    worldId = new URL(link).searchParams.get('world');
    if (!worldId || !new URL(link).searchParams.get('invite'))
      throw Error('Link lacks world or invite');
    await a.locator('[data-key="copy"]').click();
    await evidence(a, 'a-invite');
    await a.locator('[data-key="enter"]').click();
    await ready(a);
    return { worldId };
  });
  if (made) {
    await step(2, 'Signed-out invite survives Clerk sign-in', async () => {
      b = await page(link);
      await wait(b, () => document.body.innerText.includes('Sign in to join this world.'));
      await evidence(b, 'b-signin-prompt');
      await signIn(b, emails[1]);
      await ready(b);
      await resume(b);
      return await evidence(b, 'b-joined');
    });
    await step(3, 'Both actors follow real key movement', async () => {
      if (!b) throw Error('B did not open');
      for (const [p, other, id] of [
        [a, b, users[0].id],
        [b, a, users[1].id],
      ]) {
        await resume(p);
        const before = await p.evaluate(() => window.__game.online.debug().server);
        await p.keyboard.down('KeyS');
        try {
          await wait(
            p,
            (q) => {
              const s = window.__game.online.debug().server;
              return s && Math.hypot(s.x - q.x, s.z - q.z) > 2;
            },
            before,
          );
        } finally {
          await p.keyboard.up('KeyS');
        }
        await wait(p, () => window.__game.online.debug().body.speed < 0.01);
        const after = await p.evaluate(() => window.__game.online.debug().server);
        await wait(
          other,
          ({ x, z, id }) => {
            const actor = window.__game.view.game.actors.get(`player:${id}`);
            return actor?.visible && Math.hypot(actor.pos.x - x, actor.pos.z - z) < 0.3;
          },
          { ...after, id },
        );
      }
      await evidence(a, 'a-sees-b');
      await evidence(b, 'b-sees-a');
    });
    await step(4, 'Place and break replicate', async () => {
      await supply(a, 'plank', 20, server, worldId);
      await wait(a, () => window.__game.view.game.systems.inventory.count('plank') >= 20);
      const at = await a.evaluate(() => {
        const g = window.__game,
          p = g.state().player,
          s = g.view.world.sim,
          r = g.view.game.systems.region;
        for (let dx = -2; dx <= 2; dx++)
          for (let dz = -2; dz <= 2; dz++) {
            if (Math.abs(dx) + Math.abs(dz) < 2) continue;
            const x = Math.floor(p.x) + dx,
              z = Math.floor(p.z) + dz,
              y = s.heightAt(x, z) - 1;
            if (
              !r.isProtected(x, y, z) &&
              !r.isProtected(x, y + 1, z) &&
              g.block(x, y + 1, z).key === 'air'
            )
              return { x, y, z };
          }
        throw Error('No open ground');
      });
      await a.evaluate((at) => {
        const g = window.__game,
          i = g.view.game.systems.inventory;
        i.selected = i.slots.findIndex((s) => s?.id === 'plank');
        g.click('secondary', at.x, at.y, at.z);
      }, at);
      await wait(b, (c) => window.__game.block(c.x, c.y + 1, c.z).key === 'oak_plank', at);
      await b.evaluate((at) => {
        const g = window.__game,
          s = g.view.game.systems;
        const hit = { ...at, y: at.y + 1, nx: 0, ny: 1, nz: 0, id: 0, distance: 0 };
        const off = g.view.onSimStep((dt) => {
          if (g.block(hit.x, hit.y, hit.z).key !== 'oak_plank') {
            off();
            return;
          }
          s.actions.hold({ hit, held: s.inventory.held(), button: 'primary' }, dt);
        });
      }, at);
      await wait(a, (c) => window.__game.block(c.x, c.y + 1, c.z).key !== 'oak_plank', at);
      await evidence(a, 'block-broken');
      return at;
    });
    await step(5, 'Live panel and Convex show both players', async () => {
      await account(a);
      await poll(async () => (await card())?.playersNow.length === 2, 'two players in Convex');
      writeFileSync(resolve(out, 'presence-card.json'), JSON.stringify(await card(), null, 2));
      await wait(a, () => document.body.innerText.includes('2 in it now:'));
      await evidence(a, 'presence');
      await resume(a);
    });
    await step(6, 'Uninvited player refused and can play solo', async () => {
      c = await page(`${base}/?quality=low`);
      await signIn(c, emails[2]);
      await c.goto(`${base}/?world=${worldId}`);
      await wait(
        c,
        () =>
          window.__game?.online?.debug().status === 'refused' &&
          document.body.innerText.includes('You are not invited to this world.'),
      );
      const e = await evidence(c, 'c-refused');
      await c.getByRole('button', { name: 'Play solo', exact: true }).click();
      await wait(c, () => window.__game && !window.__game.online);
      await c.locator('[data-key="title:continue"]').click();
      await wait(c, () => window.__game?.started && !window.__game.online);
      return e;
    });
    await step(7, 'Invite admits only one friend', async () => {
      await c.goto(link);
      await wait(c, () => window.__game?.online?.debug().status === 'refused');
      await auth();
      const invites = await convex.query(api.invites.forWorld, { worldId });
      writeFileSync(
        resolve(out, 'invite-use.json'),
        JSON.stringify(
          { invites, members: await convex.query(api.worlds.members, { worldId }) },
          null,
          2,
        ),
      );
      if (!invites.some((i) => i.acceptedBy)) throw Error('Convex invite not consumed');
      return await evidence(c, 'c-used-invite');
    });
    await step(8, 'A reloads and B sees A return', async () => {
      await a.reload();
      await ready(a);
      await wait(b, (id) => window.__game.view.game.actors.has(`player:${id}`), users[0].id);
      await evidence(a, 'a-reloaded');
    });
    await step(9, 'Online conversation, workbench and chest', async () => {
      const sub = [];
      async function attempt(name, fn) {
        try {
          await fn();
          sub.push({ name, status: 'PASS' });
        } catch (e) {
          sub.push({ name, status: 'FAIL', detail: redact(String(e)) });
          await evidence(a, `interaction-${name}-a`);
          await evidence(b, `interaction-${name}-b`);
        }
        writeFileSync(resolve(out, 'interactions.json'), JSON.stringify(sub, null, 2));
      }
      const walkTo = (target, within) => walkPlayer(a, target, within);
      await attempt('conversation', async () => {
        const npc = await a.evaluate(() => {
          const n = [...window.__game.view.game.actors.values()]
            .filter((n) => n.id.startsWith('npc:'))
            .sort((a, b) => {
              const p = window.__game.state().player;
              return (
                Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z)
              );
            })[0];
          return n ? { ...n.pos, id: n.id } : null;
        });
        if (!npc) throw Error('No NPC actor');
        if (!(await a.evaluate(() => window.__game.state().prompt?.startsWith('Talk to '))))
          await walkTo(npc, 2.2);
        await a.keyboard.press('KeyE');
        await wait(a, () => window.__game.state().talk);
        await evidence(a, 'a-talk');
        await evidence(b, 'b-during-talk');
        if (await b.evaluate(() => window.__game.state().talk !== null))
          throw Error('B received A conversation');
        for (let i = 0; i < 60; i++) {
          const t = await a.evaluate(() => window.__game.state().talk);
          if (!t) break;
          await wait(
            a,
            (text) => document.querySelector('.gb-dialogue-text')?.textContent === text,
            t.text,
          );
          if (await a.evaluate(() => !!document.querySelector('.gb-dialogue-untyped')?.textContent))
            await a.keyboard.press('Enter');
          await wait(a, () => !document.querySelector('.gb-dialogue-untyped')?.textContent);
          if (t.choices.length)
            await a.locator('.gb-dialogue-choices:not([hidden]) button').first().click();
          else await a.keyboard.press('Enter');
          await wait(a, (text) => window.__game.state().talk?.text !== text, t.text);
        }
        await wait(a, () => !window.__game.state().talk);
      });
      for (const kind of ['workbench', 'chest'])
        await attempt(kind, async () => {
          await supply(a, kind, 1, server, worldId);
          await supply(a, 'plank', 12, server, worldId);
          await wait(a, (k) => window.__game.view.game.systems.inventory.count(k) > 0, kind);
          const at = await a.evaluate((k) => {
            const g = window.__game,
              p = g.state().player,
              i = g.view.game.systems.inventory;
            let slot = i.slots.findIndex((s) => s?.id === k);
            if (slot > 8) {
              i.move(slot, 8);
              slot = 8;
            }
            i.selected = slot;
            for (let r = 1; r <= 3; r++)
              for (let dx = -r; dx <= r; dx++)
                for (let dz = -r; dz <= r; dz++) {
                  if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                  const x = Math.floor(p.x) + dx,
                    z = Math.floor(p.z) + dz,
                    y = g.view.world.sim.heightAt(x, z) - 1;
                  if (
                    !g.view.game.systems.region.isProtected(x, y + 1, z) &&
                    g.block(x, y + 1, z).key === 'air' &&
                    !g.view.game.systems.placeables.at(x, y + 1, z) &&
                    g.view.game.systems.placeables
                      .all()
                      .every((t) => Math.hypot(t.x - x, t.z - z) > 2.5)
                  )
                    return { x, y, z };
                }
            throw Error('No station site in reach');
          }, kind);
          await a.evaluate((at) => window.__game.click('secondary', at.x, at.y, at.z), at);
          await wait(
            a,
            (k) => window.__game.view.game.systems.placeables.all().some((p) => p.kind === k),
            kind,
          );
          const expected = kind === 'workbench' ? 'Craft' : 'Open';
          for (const [dx, dz] of [
            [0, 0],
            [1.5, 0],
            [-1.5, 0],
            [0, 1.5],
            [0, -1.5],
          ]) {
            await walkTo({ x: at.x + 0.5 + dx, z: at.z + 0.5 + dz }, dx || dz ? 0.5 : 1.1);
            if (await a.evaluate((expected) => window.__game.state().prompt === expected, expected))
              break;
          }
          await wait(a, (expected) => window.__game.state().prompt === expected, expected);
          await evidence(a, `${kind}-before-use`);
          await a.keyboard.press('KeyE');
          const selector = '.gu-panel-make';
          if (kind === 'workbench') await a.locator(selector).waitFor();
          else await a.getByText('The chest is empty.', { exact: true }).waitFor();
          await evidence(a, `a-${kind}`);
          await evidence(b, `b-${kind}`);
          if (kind === 'workbench' && (await b.locator(selector).isVisible()))
            throw Error('Other player panel opened');
          if (
            kind === 'chest' &&
            (await b.getByText('The chest is empty.', { exact: true }).isVisible())
          )
            throw Error('Other player received chest response');
          if (kind === 'workbench') {
            const before = await a.evaluate(() =>
              window.__game.view.game.systems.inventory.count('chest'),
            );
            await a.locator('[data-key="make:chest"]').click();
            await wait(
              a,
              (n) => window.__game.view.game.systems.inventory.count('chest') > n,
              before,
            );
            await wait(
              b,
              (n) => window.__game.view.game.systems.inventory.count('chest') > n,
              before,
            );
          }
          await resume(a);
        });
      if (sub.some((x) => x.status === 'FAIL')) throw Error(JSON.stringify(sub));
      return sub;
    });
  }
} catch (e) {
  for (let i = 0; i < pages.length; i++) await evidence(pages[i], `blocked-${i}`).catch(() => {});
  console.log(`BLOCKED ${redact(String(e))}`);
  results.push({ n: 0, status: 'FAIL', detail: redact(String(e)) });
} finally {
  await step(10, 'Leave, verify empty, remove world and invites', async () => {
    if (!worldId) throw Error('No world created; cleanup was not exercised');
    proxy?.leaving();
    for (const p of pages) await p.goto('about:blank');
    try {
      await proxy?.settled();
      await poll(async () => {
        const current = await card();
        writeFileSync(resolve(out, 'leave-card.json'), JSON.stringify(current, null, 2));
        return current?.playersNow.length === 0;
      }, 'empty Convex card');
    } finally {
      if (server)
        writeFileSync(
          resolve(out, 'leave-server.json'),
          JSON.stringify(
            await server.stats(worldId).catch((e) => ({ error: redact(String(e)) })),
            null,
            2,
          ),
        );
      await auth();
      await convex.mutation(api.worlds.remove, { worldId });
    }
    if (await card()) throw Error('World remains');
    writeFileSync(resolve(out, 'cleanup.json'), JSON.stringify({ worldId, worldRemoved: true }));
    return 'worlds.remove cascades invites and members';
  });
  await browser?.close();
  await server?.stop();
  if (server) writeFileSync(resolve(out, 'server.log'), redact(server.log()));
  proxy?.stop();
  if (ownerSession) await clerk(`/sessions/${ownerSession.id}/revoke`, {});
  if (runtimeErrors.length) results.push({ n: 0, status: 'FAIL', detail: runtimeErrors });
  for (let n = 1; n <= 10; n++)
    if (!results.some((r) => r.n === n))
      results.push({ n, status: 'FAIL', detail: 'Blocked by earlier failure; not exercised' });
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(results, null, 2));
}
console.log(
  `${results.some((r) => r.status === 'FAIL') ? 'ISSUES' : 'PASS'}: ${results.filter((r) => r.status === 'PASS').length}/10 points passed; ${out}/report.json`,
);
process.exitCode = results.some((r) => r.status === 'FAIL') ? 1 : 0;
