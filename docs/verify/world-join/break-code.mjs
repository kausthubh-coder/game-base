// Shows that the tests can fail. It breaks server/world.ts, server/room.ts and convex/worlds.ts one way at a
// time, runs the test that holds that file to WorldJoin.tla against each break, and puts the file back. Every
// break must be CAUGHT.
//   bun docs/verify/world-join/break-code.mjs
// A break whose text is no longer in the file is reported as GONE: the code changed, so write the break again.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const SERVER = ['bun', 'test', 'server/test/world-model.test.ts'];
const CONVEX = ['bunx', 'vitest', 'run', '--root', 'convex', 'world-card-model'];

/** What each break does, the rule of WorldJoin.tla it breaks, the file, the test, the text it replaces and the text it puts there. */
const BREAKS = [
  ['an answer does not ask whether the socket is still there', 'NoBodyWithoutATab', 'server/world.ts', SERVER,
    '    if (this.sessions.get(ws) !== session) return;\n', ''],
  ['a second tab does not close the first', 'OneTabPlaysEachPlayer', 'server/world.ts', SERVER,
    "      this.sessions.delete(before);\n      this.end(before, CLOSE.replaced, 'this player connected again');\n", ''],
  ['the last one out leaves the timer running', 'AwakeExactlyWhileSomeoneIsIn', 'server/world.ts', SERVER,
    '    if (this.timer !== null) clearTimeout(this.timer);\n    this.timer = null;\n    this.save(', '    this.save('],
  ['a leave posts no card', 'the server and the model agree', 'server/world.ts', SERVER,
    '    else this.postCard();\n', ''],
  ['the world goes to sleep without a card', 'the server and the model agree', 'server/world.ts', SERVER,
    "    this.save('the last player left');\n    this.postCard();\n", "    this.save('the last player left');\n"],
  ['nobody is dropped for silence', 'the server and the model agree, SleepsOnceEveryoneHasGone', 'server/world.ts', SERVER,
    "      if (session.user !== null && room.steps - session.heardAt > QUIET_STEPS) this.end(ws, CLOSE.quiet, 'nothing heard for 15 seconds');\n", ''],
  ['the hello timer runs on after the player is in', 'the server and the model agree', 'server/world.ts', SERVER,
    '    if (session.helloTimer !== null) clearTimeout(session.helloTimer);\n    session.helloTimer = null;\n', ''],
  ['two cards made in the same millisecond share a stamp', 'the server and the model agree', 'server/world.ts', SERVER,
    'this.cardStamp = Math.max(now, this.cardStamp + 1);', 'this.cardStamp = now;'],
  ['a join does not take the player out first', 'one body for each user', 'server/room.ts', SERVER,
    '    join(user, name) {\n      leave(user);\n', '    join(user, name) {\n'],
  ['Convex takes a card made before the one it holds', 'CardMatchesTheWorld', 'convex/worlds.ts', CONVEX,
    'args.sentAt !== undefined && world.cardAt !== undefined && args.sentAt < world.cardAt', 'false'],
];

let missed = 0;
for (const [what, rule, file, command, from, to] of BREAKS) {
  const path = resolve(root, file);
  const source = readFileSync(path, 'utf8');
  if (source.split(from).length !== 2) { console.log(`GONE    ${what}  (${file})`); missed++; continue; }
  let run;
  try {
    writeFileSync(path, source.replace(from, to));
    run = spawnSync(command[0], command.slice(1), { cwd: root, encoding: 'utf8' });
  } finally {
    writeFileSync(path, source);
  }
  const caught = run.status !== 0;
  if (!caught) missed++;
  const line = (run.stdout + run.stderr).split('\n').find((l) => /^error: |AssertionError|Error: /.test(l.trim())) ?? '';
  console.log(`${caught ? 'CAUGHT ' : 'MISSED '} ${what}  (${rule})${caught ? `\n          ${line.trim().slice(0, 150)}` : ''}`);
}
console.log(missed === 0 ? `\nAll ${BREAKS.length} breaks were caught. Every file is back as it was.` : `\n${missed} of ${BREAKS.length} were not caught. Every file is back as it was.`);
process.exit(missed === 0 ? 0 : 1);
