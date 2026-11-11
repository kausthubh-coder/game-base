// The world server checked from outside, against `wrangler dev` on this machine:
//   bun server/test/check.ts
//
// It starts the server on port 5542 with empty storage, plays fake players through the game's own
// client, stops the server, starts it again and looks for what was saved. It needs the built game in
// dist/ (`bun run build`). It prints each check with what it saw, and exits 1 when one fails.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { blockId } from '../../src/content/blocks.ts';
import type { Snap } from '../../src/engine/net/messages.ts';
import { cellIndex } from '../../src/features/world/chunk.sim.ts';
import { ROOT, join, sleep, startServer, type FakePlayer } from './local.ts';

const PORT = 5542;
const WORLD = 'check';
let failed = 0;

function check(name: string, ok: boolean, saw: string): void {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${saw}`);
}

if (!existsSync(resolve(ROOT, 'dist/index.html'))) {
  console.error('dist/index.html is missing. Run `bun run build` first.');
  process.exit(1);
}

let server = await startServer({ port: PORT, name: 'check', fresh: true });
console.log(`world server up on ${server.http}, pid ${server.pid}, log ${server.logPath}\n`);
const players: FakePlayer[] = [];

try {
  // ---------------------------------------------------------------- the game's files
  const page = await fetch(`${server.http}/`);
  const html = await page.text();
  const script = /src="\.?\/?(assets\/index-[^"]+\.js)"/.exec(html)?.[1];
  const js = script ? await fetch(`${server.http}/${script}`) : null;
  const jsBytes = js ? (await js.arrayBuffer()).byteLength : 0;
  check('/ serves the built game',
    page.status === 200 && html.includes('<canvas id="view">') && js?.status === 200 && jsBytes > 100_000,
    `/ is ${page.status} ${page.headers.get('content-type')}, has the canvas: ${html.includes('<canvas id="view">')}; /${script} is ${js?.status} ${js?.headers.get('content-type')}, ${jsBytes} bytes`);

  // ---------------------------------------------------------------- refusals
  const old = await join(server, WORLD, 'old', { build: 'a-build-from-last-week' });
  check('a wrong build version is refused with the reload message',
    old.net.state === 'refused' && old.net.refusal?.why === 'reload',
    `state ${old.net.state}, refusal ${JSON.stringify(old.net.refusal)}`);
  await old.leave();

  const stranger = await join(server, WORLD, 'stranger', { token: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEifQ.bm90LWEtc2lnbmF0dXJl' });
  check('a bad token is refused',
    stranger.net.state === 'refused' && stranger.net.refusal?.why === 'token',
    `state ${stranger.net.state}, refusal ${JSON.stringify(stranger.net.refusal)}`);
  await stranger.leave();

  const refusedOnly = await server.stats(WORLD);
  check('a refused connection does not wake the world',
    !refusedOnly.loaded && !refusedOnly.stepping,
    `after two refusals: loaded ${refusedOnly.loaded}, stepping ${refusedOnly.stepping}`);

  // ---------------------------------------------------------------- two players
  const ann = await join(server, WORLD, 'ann');
  const bo = await join(server, WORLD, 'bo');
  players.push(ann, bo);
  await ann.until(() => ann.net.near.actors.has('player:dev_bo'), 3000, 'ann to see bo');
  await bo.until(() => bo.net.near.actors.has('player:dev_ann'), 3000, 'bo to see ann');
  const boBefore = { ...ann.net.near.actors.get('player:dev_bo')! };
  const annBefore = { ...bo.net.near.actors.get('player:dev_ann')! };
  ann.walk(1, 0);
  bo.walk(-1, 0);
  await sleep(1500);
  ann.stop();
  bo.stop();
  await sleep(300);
  const boAfter = ann.net.near.actors.get('player:dev_bo')!;
  const annAfter = bo.net.near.actors.get('player:dev_ann')!;
  check('two players in one world each see the other move in their snaps',
    boBefore.x - boAfter.x > 3 && annAfter.x - annBefore.x > 3,
    `ann saw bo go from x ${boBefore.x} to ${boAfter.x}; bo saw ann go from x ${annBefore.x} to ${annAfter.x}; ann's last input used: ${ann.net.near.ack}`);

  const awake = await server.stats(WORLD);
  await sleep(1000);
  const awakeLater = await server.stats(WORLD);
  check('the world steps 20 times a second while players are in it',
    awake.stepping && Math.abs((awakeLater.steps! - awake.steps!) - 20) <= 3,
    `stepping ${awake.stepping}; ${awakeLater.steps! - awake.steps!} steps in one second; step time p50 ${awakeLater.stepMs.p50} ms, max ${awakeLater.stepMs.max} ms`);

  // ---------------------------------------------------------------- a block is placed
  // Ann is given planks by the test tool, picks them and sets one down on the ground two blocks east of her.
  const give = await server.dev(WORLD, { do: 'give', item: 'plank', count: 5 });
  const you = ann.net.near.you!;
  // The ground under a column is found by looking at where ann stands: the grant is level here.
  const target = { x: Math.floor(you.x) + 2, y: Math.round(you.y) - 1, z: Math.floor(you.z) };
  const plank = blockId('oak_plank');
  let boSaw: number[] | undefined;
  const off = bo.net.onSnap((snap: Snap) => { if (snap.blocks) boSaw = snap.blocks; });
  ann.send(0, 0, [{ a: 'slot', slot: 0 }, { a: 'use', button: 'secondary', ...target, nx: 0, ny: 1, nz: 0 }]);
  await sleep(500);
  off();
  const placedAt = [target.x, target.y + 1, target.z, plank];
  check('a block one player places reaches the other player',
    give.ok && JSON.stringify(boSaw) === JSON.stringify(placedAt),
    `ann placed oak planks (block ${plank}) at ${placedAt.slice(0, 3).join(', ')}; bo's snap carried blocks ${JSON.stringify(boSaw)}`);

  // ---------------------------------------------------------------- the last player leaves
  await ann.leave();
  const oneLeft = await server.stats(WORLD);
  await bo.leave();
  players.length = 0;
  const asleep = await server.stats(WORLD);
  await sleep(1000);
  const asleepLater = await server.stats(WORLD);
  const slept = server.log().includes('the world stopped stepping and sleeps');
  check('the world stops stepping when the last player leaves',
    oneLeft.stepping && !asleep.stepping && asleep.steps === asleepLater.steps && asleep.players === 0 && slept,
    `with one player left: stepping ${oneLeft.stepping}; after the last left: stepping ${asleep.stepping}, steps ${asleep.steps} then ${asleepLater.steps} a second later; the log has "the world stopped stepping and sleeps": ${slept}`);
  check('it saves when the last player leaves',
    asleep.lastSave?.why === 'the last player left' && asleep.lastSave.rows > 0,
    `last save: ${JSON.stringify(asleep.lastSave)}`);

  // ---------------------------------------------------------------- stop the server, start it again
  const before = server.pid;
  await server.stop();
  server = await startServer({ port: PORT, name: 'check', fresh: false });
  const cy = await join(server, WORLD, 'cy');
  players.push(cy);
  let found: number | undefined;
  const cell = cellIndex(target.x & 15, target.y + 1, target.z & 15);
  const lookIn = (snap: Snap): void => {
    const chunk = snap.chunks?.find(([cx, cz]) => cx === target.x >> 4 && cz === target.z >> 4);
    if (!chunk) return;
    const at = chunk[2].findIndex((value, i) => i % 2 === 0 && value === cell);
    if (at >= 0) found = chunk[2][at + 1];
  };
  const offCy = cy.net.onSnap(lookIn);
  await sleep(1000);
  offCy();
  const restarted = await server.stats(WORLD);
  check('the placed block is still there after the server was stopped and started again',
    found === plank && server.pid !== before && restarted.steps! > asleep.steps!,
    `server pid ${before} stopped, pid ${server.pid} started; a new player's first snaps hold block ${found} at ${placedAt.slice(0, 3).join(', ')} (oak planks are ${plank}); steps went on from ${asleep.steps} to ${restarted.steps}`);
  await cy.leave();
  players.length = 0;
} catch (error) {
  failed++;
  console.error('FAIL  the check itself threw:', error);
} finally {
  for (const p of players) await p.leave().catch(() => undefined);
  await server.stop();
}

console.log(failed === 0 ? '\nevery check passed' : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
