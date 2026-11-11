// One command that runs every check the game has, in order, and prints one line for each.
//
//   bun run verify                 every part but the slow ones
//   bun run verify --full          the slow ones too
//   bun run verify shots play      only the parts named
//   bun run verify --list          what the parts are
//
// A part's full output goes to .artifacts/verify/<part>.log. The exit code is 1 when a part failed.
// Which part to run for which change is in .agents/skills/verify-game/SKILL.md.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const LOGS = resolve(ROOT, '.artifacts/verify');

/** A part passes when every command exits 0. `skip` is an exit code that means "nothing to check here". */
const PARTS = [
  { name: 'check', what: 'types, the .sim.ts rule, every test, the Convex tests', run: [['bun', 'run', 'check']] },
  { name: 'lint', what: 'Biome lint', run: [['bun', 'run', 'lint']] },
  { name: 'tools', what: 'the tools\' own tests', run: [['bun', 'test', 'tools/doctor.test.mjs']] },
  { name: 'bots', what: 'three bots, 20,000 steps each, rules only', run: [['bun', 'tools/sim.ts', 'bot', '--seed', '1,2,3', '--steps', '20000']] },
  { name: 'assets', what: 'every asset against the asset contract', run: [['bun', 'tools/verify-assets.mjs']] },
  { name: 'build', what: 'a production build', run: [['bun', 'run', 'build']] },
  { name: 'server', what: 'the world server on wrangler dev, with two fake players', run: [['bun', 'server/test/check.ts']] },
  { name: 'together', what: 'two browsers on one world: walk, build, farm, leave, a server restart, a wrong build', run: [['bun', 'tools/play-together.mjs']] },
  { name: 'live', what: 'Clerk, Convex and the world server together (needs .env.local)', run: [['bun', 'server/test/live.ts']], skip: 2 },
  { name: 'shots', what: 'six scenes against their approved pictures, and the draw budgets', run: [['bun', 'tools/shots.mjs', 'all', '--check']] },
  {
    name: 'play', what: 'a person\'s walk to Tamsin with real keys, build mode, camera drag',
    run: [
      ['bun', 'tools/play.mjs', 'replay', 'tools/play/scenarios/first-talk.json'],
      ['bun', 'tools/play.mjs', 'stop'],
      ['bun', 'tools/play-build.mjs'],
      ['bun', 'tools/play-drag.mjs'],
    ],
  },
  {
    name: 'signed', slow: true, what: 'three players sign in through Clerk and join one world by invite link (needs .env.local)',
    run: [['bun', 'tools/play-together-signed-in.mjs']],
  },
  {
    name: 'slow', slow: true, what: 'smoke, the interface and all of act 1 in a browser',
    run: [['bun', 'tools/play-smoke.mjs'], ['bun', 'tools/play-ui.mjs'], ['bun', 'tools/play-act1.mjs']],
  },
];

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const part of PARTS) console.log(`${part.name.padEnd(8)} ${part.what}${part.slow ? ' (only with --full or by name)' : ''}`);
  process.exit(0);
}
const named = args.filter((arg) => !arg.startsWith('--'));
const unknown = named.filter((name) => !PARTS.some((part) => part.name === name));
if (unknown.length > 0) {
  console.error(`No part named ${unknown.join(', ')}. The parts: ${PARTS.map((part) => part.name).join(', ')}`);
  process.exit(1);
}
const chosen = PARTS.filter((part) => (named.length > 0 ? named.includes(part.name) : args.includes('--full') || !part.slow));

mkdirSync(LOGS, { recursive: true });
let failed = 0;
for (const part of chosen) {
  const started = Date.now();
  let log = '', result = 'pass';
  for (const cmd of part.run) {
    const done = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    log += `$ ${cmd.join(' ')}\n${done.stdout ?? ''}${done.stderr ?? ''}\n`;
    if (done.status === 0) continue;
    result = part.skip !== undefined && done.status === part.skip ? 'skip' : 'FAIL';
    break;
  }
  const logPath = resolve(LOGS, `${part.name}.log`);
  writeFileSync(logPath, log);
  if (result === 'FAIL') failed++;
  const seconds = ((Date.now() - started) / 1000).toFixed(1).padStart(6);
  const lastLine = log.trimEnd().split('\n').pop() ?? '';
  console.log(`${result.padEnd(4)} ${part.name.padEnd(7)} ${seconds} s  ${result === 'pass' ? part.what : `${lastLine.slice(0, 120)}  (${logPath})`}`);
}
console.log(failed === 0 ? `\nverify: ${chosen.length} parts, nothing failed` : `\nverify: ${failed} of ${chosen.length} parts failed`);
process.exit(failed === 0 ? 0 : 1);
