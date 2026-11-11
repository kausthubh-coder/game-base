// Shows that the tests can fail. It breaks src/game/build/index.sim.ts one way at a time, runs
// src/game/build/model.test.ts against each break, and puts the file back. Every break must be CAUGHT.
//   bun docs/verify/build-stroke/break-code.mjs
// A break whose text is no longer in the file is reported as GONE: the code changed, so write the break again.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const path = resolve(root, 'src/game/build/index.sim.ts');
const source = readFileSync(path, 'utf8');

/** What each break does, the rule of Stroke.tla it breaks, the text it replaces and the text it puts there. */
const BREAKS = [
  ['release does not ask which item is in the hand', 'AppliedWithTheSameHand',
    'const fits = active && !player.busy && heldId() === stroke.item;', 'const fits = active && !player.busy;'],
  ['cancel leaves the stroke', 'NoStuckStroke',
    '      const was = stroke.on;\n      stroke.on = false;\n      return was;', '      const was = stroke.on;\n      return was;'],
  ['the plan does not count the bag', 'the plan and the change agree',
    "if (verdict === 'ok' && t.costs && left-- <= 0) verdict = 'short';", "if (verdict === 'ok' && t.costs && left-- <= -99) verdict = 'short';"],
  ['release leaves the stroke', 'NoStuckStroke, OneStrokePerPress',
    '      const changed = fits ? commit() : 0;\n      stroke.on = false;', '      const changed = fits ? commit() : 0;'],
  ['undo pulls a crop that has grown', 'the game and the model agree',
    'state.stage === 0 && crops?.pull', 'state.stage >= 0 && crops?.pull'],
  ['the step keeps a stroke when the hand changes', 'the game and the model agree',
    'if (stroke.on && (!active || heldId() !== stroke.item)) stroke.on = false;', 'if (stroke.on && !active) stroke.on = false;'],
  ['undo runs during a stroke', 'the game and the model agree',
    'if (!active || player.busy || stroke.on || journal.length === 0) return false;', 'if (!active || player.busy || journal.length === 0) return false;'],
  ['undo does not look at the cell', 'the game and the model agree',
    'if (world.getBlock(e.x, e.y, e.z) !== TILLED || crops?.at(e.x, e.y, e.z) || world.getBlock(e.x, e.y + 1, e.z) !== AIR) return false;', 'if (world.getBlock(e.x, e.y + 1, e.z) !== AIR) return false;'],
  ['build mode stays on under a panel', 'the game and the model agree',
    'if (active && player.busy) api.setActive(false);', ''],
];

let missed = 0;
try {
  for (const [what, rule, from, to] of BREAKS) {
    if (source.split(from).length !== 2) { console.log(`GONE    ${what}`); missed++; continue; }
    writeFileSync(path, source.replace(from, to));
    const run = spawnSync('bun', ['test', 'src/game/build/model.test.ts'], { cwd: root, encoding: 'utf8' });
    const caught = run.status !== 0;
    if (!caught) missed++;
    const line = (run.stdout + run.stderr).split('\n').find((l) => l.startsWith('error:')) ?? '';
    console.log(`${caught ? 'CAUGHT ' : 'MISSED '} ${what}  (${rule})${caught ? `\n          ${line.slice(0, 150)}` : ''}`);
  }
} finally {
  writeFileSync(path, source);
}
console.log(missed === 0 ? `\nAll ${BREAKS.length} breaks were caught. index.sim.ts is back as it was.` : `\n${missed} of ${BREAKS.length} were not caught. index.sim.ts is back as it was.`);
process.exit(missed === 0 ? 0 : 1);
