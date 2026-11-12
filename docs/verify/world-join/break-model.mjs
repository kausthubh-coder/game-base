// Shows that each rule of WorldJoin.tla can fail. It writes six broken copies of the model into a folder, each
// with the config it is checked on (as WorldJoin.cfg) and the view. Check each copy with the /statechart skill:
// the rule named here must break.
//   bun docs/verify/world-join/break-model.mjs <folder outside the repo>
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const here = import.meta.dirname;
const out = process.argv[2];
if (!out) { console.error('Give a folder outside the repo to write the broken copies into.'); process.exit(1); }
const model = readFileSync(resolve(here, 'WorldJoin.tla'), 'utf8');

/** The folder of each copy, the rule that must break, the config, and each text it replaces with the text it puts there. */
const BREAKS = [
  ['a-second-tab-keeps-the-first', 'OneTabPlaysEachPlayer and NoTabWithoutABody', 'WorldJoin.cfg', [
    ['sess1 == [x \\in Sockets |-> IF x \\in olds THEN "none" ELSE sess[x]]', 'sess1 == sess'],
  ]],
  ['a-late-answer-lets-a-closed-socket-in', 'NoBodyWithoutATab', 'WorldJoin.cfg', [
    ['[] ok /\\ sess[s] # "checking" ->', '[] FALSE ->'],
    ['/\\ sess\' = [sess1 EXCEPT ![s] = "in"]', '/\\ sess\' = [sess1 EXCEPT ![s] = IF sess[s] = "checking" THEN "in" ELSE "none"]'],
  ]],
  ['the-last-one-out-leaves-it-stepping', 'AwakeExactlyWhileSomeoneIsIn', 'WorldJoin.cfg', [
    ["/\\ stepping' = (stepping /\\ room \\ {u} # {})", "/\\ stepping' = stepping"],
  ]],
  ['a-join-posts-no-card', 'CardMatchesTheWorld', 'WorldJoin.cfg', [
    ['/\\ Post(rest \\cup {u})', '/\\ UNCHANGED posts'],
  ]],
  // The bug of docs/bugs/2026-11-11-world-list-keeps-departed-player.md: Convex takes a card made before the one it holds.
  ['convex-takes-an-old-card', 'CardMatchesTheWorld', 'WorldJoin.cfg', [
    ["/\\ posts' = SubSeq(posts, i + 1, Len(posts))", "/\\ posts' = Without(posts, i)"],
  ]],
  ['nobody-is-dropped-for-silence', 'SleepsOnceEveryoneHasGone', 'WorldJoinChart.cfg', [
    ['/\\ stepping /\\ sess[s] = "in" /\\ ~up[s]', '/\\ FALSE /\\ stepping /\\ sess[s] = "in" /\\ ~up[s]'],
  ]],
];

for (const [name, rule, config, edits] of BREAKS) {
  let broken = model;
  for (const [from, to] of edits) {
    if (broken.split(from).length !== 2) { console.error(`GONE  ${name}: its text is no longer in WorldJoin.tla. Write the break again.`); process.exit(1); }
    broken = broken.replace(from, to);
  }
  const dir = resolve(out, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'WorldJoin.tla'), broken);
  copyFileSync(resolve(here, config), resolve(dir, 'WorldJoin.cfg'));
  copyFileSync(resolve(here, 'view.ts'), resolve(dir, 'view.ts'));
  console.log(`${dir}\n    must break: ${rule}`);
}
