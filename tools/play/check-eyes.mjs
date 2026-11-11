// Checks the eyes of tools/play.mjs against pages made to be wrong: look must flag each kind of wrong,
// `see` must fail on text that is not there, and film must find a one-frame flicker and nothing on a still page.
// Run it with no play session open: bun tools/play/check-eyes.mjs
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const fixtures = resolve(import.meta.dirname, 'fixtures');
const play = (...args) => {
  const done = spawnSync('bun', ['tools/play.mjs', ...args], { cwd: root, encoding: 'utf8' });
  return { code: done.status, out: done.stdout, err: done.stderr };
};
const json = (...args) => {
  const done = play(...args, '--json');
  try { return JSON.parse(done.out); } catch { throw new Error(`play ${args[0]} printed no JSON: ${done.out}${done.err}`); }
};
let failed = 0;
const expect = (ok, what) => { console.log(`${ok ? 'pass' : 'FAIL'} ${what}`); if (!ok) failed++; };

function session(page, fn) {
  const started = play('start', '--page', resolve(fixtures, page));
  if (started.code !== 0) throw new Error(`start failed: ${started.out}${started.err}`);
  try { fn(); } finally { play('stop'); }
}

session('wrong.html', () => {
  const look = json('look', 'wrong');
  const kinds = (kind) => look.wrong.filter((w) => w.kind === kind).map((w) => w.what);
  expect(kinds('cut').includes('A quest name far too long for its box'), `look flags cut: ${JSON.stringify(kinds('cut'))}`);
  expect(kinds('off').includes('Off the edge'), `look flags off: ${JSON.stringify(kinds('off'))}`);
  expect(kinds('over').includes('Covered') && kinds('over').some((w) => w === 'First' || w === 'Second'), `look flags over: ${JSON.stringify(kinds('over'))}`);
  expect(look.wrong.some((w) => w.kind === 'over' && w.what === 'A hint across the corner' && w.why.includes('Quest title')), 'look flags text over text');
  expect(kinds('small').includes('x'), `look flags small: ${JSON.stringify(kinds('small'))}`);
  expect(!look.wrong.some((w) => ['Fine', 'Break', 'Hello there'].includes(w.what)), 'look leaves the fine buttons and the text alone');
  expect(!look.screen.some((s) => s.text === 'Not shown' || s.text.startsWith('For screen readers')), 'look leaves out hidden text and visually hidden text');
  const seen = json('act', '{"type":"see","text":"Hello there","timeout":2000}', 'see-present');
  expect(!seen.failed, 'see passes on text that is there');
  const absent = json('act', '{"type":"see","text":"Nobody wrote this","timeout":1000}', 'see-absent');
  expect(Boolean(absent.failed) && absent.failed.includes('was not on the screen'), `see fails on absent text: ${absent.failed}`);
  const gone = json('act', '{"type":"gone","text":"Hello there","timeout":1000}', 'gone-present');
  expect(Boolean(gone.failed), `gone fails on text still there: ${gone.failed}`);
  const broke = play('do', '{"type":"click","text":"Break"}');
  expect(broke.code !== 0 && /broken on purpose/.test(broke.err + broke.out), 'do fails on a console error');
  expect(play('do', '{"type":"wait","ms":10}').code === 0, 'the next do passes: one error does not poison the session');
  const after = json('act', '{"type":"click","text":"Break"}', 'break');
  expect(!after.failed && after.problems.some((p) => p.includes('broken on purpose')), 'act reports the console error under problems and goes on');
  expect(json('look', 'again').problems.length === 0, 'the next look does not report it again');
  const still = json('film', '{"type":"wait","ms":500}', 'still');
  expect(still.film.jumps.length === 0 && still.film.flickers.length === 0, `film finds no jump or flicker on a still page (${still.film.frames} frames by ${still.film.how})`);
});

session('flicker.html', () => {
  const calm = json('film', '{"type":"wait","ms":600}', 'calm');
  expect(calm.film.jumps.length === 0 && calm.film.flickers.length === 0, `film finds no jump or flicker while only the dot moves (${calm.film.frames} frames, median ${calm.film.median})`);
  const flick = json('film', '[{"type":"wait","ms":200},{"type":"press","key":"KeyF"},{"type":"wait","ms":300}]', 'flicker');
  const there = flick.film.jumps.find((j) => j.back);
  expect(Boolean(there), `film finds the one-frame flicker as a jump there and back: ${JSON.stringify(flick.film.jumps)} (${flick.film.frames} frames by ${flick.film.how}, limit ${flick.film.limit})`);
  const one = flick.film.flickers;
  expect(one.length === 1 && one[0].frames === 1 && one[0].from === there?.frame, `film lists it under flickers: ${JSON.stringify(one)}`);
});

console.log(failed ? `check-eyes: ${failed} failed` : 'check-eyes: every check passed');
process.exit(failed ? 1 : 0);
