// One command that runs every check the game has, in order, and prints one line for each.
//
//   bun run verify                 every part but the slow ones
//   bun run verify --full          the slow ones too
//   bun run verify shots play      only the parts named
//   bun run verify --list          what the parts are
//
// A part's full output goes to .artifacts/verify/<part>.log. The exit code is 1 when a part failed.
// Which part to run for which change is in .agents/skills/verify-game/SKILL.md.
import { executePart } from './workflow/verify.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const LOGS = resolve(ROOT, '.artifacts/verify');

/** A part passes when every command exits 0. `skip` is an exit code that means "nothing to check here". */
const PARTS = [
  { name: 'check', what: 'types, the .sim.ts rule, every test, the Convex tests', run: [['bun', 'run', 'check']] },
  { name: 'formal', what: 'covered code matches the reviewed formal model', run: [['bun', 'tools/formal-sync.mjs']] },
  { name: 'lint', what: 'Biome lint', run: [['bun', 'run', 'lint']] },
  { name: 'tools', what: 'the tools\' own tests', run: [['bun', 'test', 'tools/doctor.test.mjs', 'tools/art', 'tools/workflow', 'tools/lib/beta-chain.test.mjs'], ['bun', 'tools/workflow/break-checks.mjs']] },
  { name: 'bots', what: 'three bots, 20,000 steps each, rules only', run: [['bun', 'tools/sim.ts', 'bot', '--seed', '1,2,3', '--steps', '20000']] },
  { name: 'assets', what: 'every asset against the asset contract', run: [['bun', 'tools/verify-assets.mjs']] },
  { name: 'build', what: 'a production build', run: [['bun', 'run', 'build']] },
  { name: 'shots', what: 'six scenes against their approved pictures, and the draw budgets', run: [['bun', 'tools/shots.mjs', 'all', '--check']] },
  {
    onFailure: [['bun', 'tools/play.mjs', 'stop']],
    name: 'play', what: 'every recording in tools/play/scenarios with real keys, the play tool\'s eyes, build mode, camera drag',
    run: [
      ['bun', 'tools/play.mjs', 'replay', 'all'],
      ['bun', 'tools/play.mjs', 'stop'],
      ['bun', 'test', 'tools/play'],
      ['bun', 'tools/play/check-eyes.mjs'],
      ['bun', 'tools/play-build.mjs'],
      ['bun', 'tools/play-drag.mjs'],
    ],
  },
  {
    name: 'cloud', slow: true, what: 'two browsers sign in through Clerk, the save goes between them, a conflict is asked (needs .env.local)',
    run: [['bun', 'tools/play-cloud-save.mjs']], skip: 2,
  },
  {
    name: 'sight', slow: true, what: 'every scene of act 1 frames the hero and whoever speaks, and nothing hides them; the places the playtests found hidden',
    run: [['bun', 'tools/play-sight.mjs']],
  },
  {
    name: 'slow', slow: true, what: 'smoke and the interface in a browser',
    run: [['bun', 'tools/play-smoke.mjs'], ['bun', 'tools/play-ui.mjs']],
  },
  {
    name: 'beta', slow: true, what: 'fresh Begin through Lamp Gallery, with verified earned saves between chapters',
    run: [['bun', 'tools/play-beta.mjs', '--verify-report', process.env.BETA_REPLAY_REPORT || '.artifacts/beta-final/report.json']],
  },
  {
    name: 'legacy-act1', deferred: true, what: 'obsolete six-quest diagnostic; full current Act 1 replacement is unfinished',
    run: [['bun', 'tools/play-act1.mjs']],
  },
];

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const part of PARTS) console.log(`${part.name.padEnd(8)} ${part.what}${part.deferred ? ' (explicit diagnostic only)' : part.slow ? ' (only with --full or by name)' : ''}`);
  process.exit(0);
}
const named = args.filter((arg) => !arg.startsWith('--'));
const unknown = named.filter((name) => !PARTS.some((part) => part.name === name));
if (unknown.length > 0) {
  console.error(`No part named ${unknown.join(', ')}. The parts: ${PARTS.map((part) => part.name).join(', ')}`);
  process.exit(1);
}
const chosen = PARTS.filter((part) => (named.length > 0 ? named.includes(part.name) : !part.deferred && (args.includes('--full') || !part.slow)));

mkdirSync(LOGS, { recursive: true });
let failed = 0;
for (const part of chosen) {
  const started = Date.now();
  const { log, result } = executePart(part, ROOT);
  const logPath = resolve(LOGS, `${part.name}.log`);
  writeFileSync(logPath, log);
  if (result === 'FAIL') failed++;
  const seconds = ((Date.now() - started) / 1000).toFixed(1).padStart(6);
  const lastLine = log.trimEnd().split('\n').pop() ?? '';
  console.log(`${result.padEnd(4)} ${part.name.padEnd(7)} ${seconds} s  ${result === 'pass' ? part.what : `${lastLine.slice(0, 120)}  (${logPath})`}`);
}
console.log(failed === 0 ? `\nverify: ${chosen.length} parts, nothing failed` : `\nverify: ${failed} of ${chosen.length} parts failed`);
process.exit(failed === 0 ? 0 : 1);
