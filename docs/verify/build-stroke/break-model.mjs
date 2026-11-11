// Shows that each rule of Stroke.tla can fail. It writes five broken copies of the model into a folder, each
// with the config and the view. Check each copy with the /statechart skill: the rule named here must break.
//   bun docs/verify/build-stroke/break-model.mjs <folder outside the repo>
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const here = import.meta.dirname;
const out = process.argv[2];
if (!out) { console.error('Give a folder outside the repo to write the broken copies into.'); process.exit(1); }
const model = readFileSync(resolve(here, 'Stroke.tla'), 'utf8');

/** The folder of each copy, the rule that must break, the text it replaces and the text it puts there. */
const BREAKS = [
  ['release-ignores-the-hand', 'AppliedWithTheSameHand',
    'Fits == active /\\ ~busy /\\ Held = stroke.item', 'Fits == active /\\ ~busy'],
  ['lost-button-keeps-the-stroke', 'NoStuckStroke',
    "ButtonLost ==\n  /\\ primary /\\ primary' = FALSE\n  /\\ stroke' = Off", "ButtonLost ==\n  /\\ primary /\\ primary' = FALSE\n  /\\ stroke' = stroke"],
  ['no-bag-limit', 'BagInBounds',
    'THEN {s \\in SUBSET Cand : Cardinality(s) = Min(bag, Cardinality(Cand))}\n  ELSE {Cand}', 'THEN {Cand}\n  ELSE {Cand}'],
  ['release-keeps-the-stroke', 'NoStuckStroke and OneStrokePerPress',
    "  ELSE\n    /\\ stroke' = Off\n    /\\ IF Fits", "  ELSE\n    /\\ stroke' = stroke\n    /\\ IF Fits"],
  ['undo-ignores-the-cell', 'SeedsConserved',
    'plants == {c \\in Cells : journal[c] = "plant" /\\ cell[c] = "crop"}', 'plants == {c \\in Cells : journal[c] = "plant"}'],
];

for (const [name, rule, from, to] of BREAKS) {
  if (model.split(from).length !== 2) { console.error(`GONE  ${name}: its text is no longer in Stroke.tla. Write the break again.`); process.exit(1); }
  const dir = resolve(out, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'Stroke.tla'), model.replace(from, to));
  for (const file of ['Stroke.cfg', 'view.ts']) copyFileSync(resolve(here, file), resolve(dir, file));
  console.log(`${dir}\n    must break: ${rule}`);
}
