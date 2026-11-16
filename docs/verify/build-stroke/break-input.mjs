// Mutate an isolated copy only. The caller supplies a NEW output folder.
// bun docs/verify/build-stroke/break-input.mjs .artifacts/beta-input-formal/input-mutations
import { cpSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '../../..');
if (!process.argv[2]) throw Error('Supply a new output folder for the isolated mutation run');
const out = resolve(process.argv[2]);
mkdirSync(out); // Refuse to replace prior proof.
cpSync(resolve(root, 'src'), resolve(out, 'src'), { recursive: true });
const harness = 'docs/verify/build-stroke/input-contract.test.ts';
mkdirSync(resolve(out, 'docs/verify/build-stroke'), { recursive: true });
cpSync(resolve(root, harness), resolve(out, harness));
symlinkSync(resolve(root, 'node_modules'), resolve(out, 'node_modules'));
const paths = ['src/game/shell/keys.ts', 'src/game/views/touch-controls.ts'];
const sources = Object.fromEntries(paths.map(p => [p, readFileSync(resolve(out, p), 'utf8')]));
const digest = source => createHash('sha256').update(source).digest('hex');
const before = Object.fromEntries(paths.map(p => [p, digest(sources[p])]));
const breaks = [
  ['touch cancellation commits instead of dropping', paths[0],
    "if (was && !primary) send({ kind: 'letGo', why: 'lost' });",
    "if (was && !primary) send({ kind: 'letGo', why: 'up' });"],
  ['mouse release ignores a surviving touch hold', paths[0],
    "if (!touchPrimary) send({ kind: 'letGo', why });", "send({ kind: 'letGo', why });"],
  ['touch release ignores a surviving mouse hold', paths[0],
    "if (!primary) send(down ? { kind: 'use', button: 'primary' } : { kind: 'letGo', why: 'up' });",
    "send(down ? { kind: 'use', button: 'primary' } : { kind: 'letGo', why: 'up' });"],
  ['another finger steals a held control', paths[1],
    "if (e.pointerType !== 'touch' || id !== null) return;", "if (e.pointerType !== 'touch') return;"],
];
let missed = 0, restored = false;
try {
  for (const [i, [what, path, from, to]] of breaks.entries()) {
    const source = sources[path];
    if (source.split(from).length !== 2) { console.log(`GONE ${what}`); missed++; continue; }
    writeFileSync(resolve(out, path), source.replace(from, to));
    const run = spawnSync('bun', ['test', harness], { cwd: out, encoding: 'utf8' });
    const log = run.stdout + run.stderr;
    writeFileSync(resolve(out, `mutation-${i + 1}.log`), log);
    // A parse/import failure is not evidence that a behavioral assertion detected the break.
    const caught = run.status !== 0 && log.includes('(fail)') && log.includes('expect(');
    console.log(`${caught ? 'CAUGHT' : 'MISSED'} ${what}`);
    if (!caught) missed++;
    writeFileSync(resolve(out, path), source);
  }
} finally {
  for (const path of paths) writeFileSync(resolve(out, path), sources[path]);
  const after = Object.fromEntries(paths.map(p => [p, digest(readFileSync(resolve(out, p)))]));
  writeFileSync(resolve(out, 'source-hashes.json'), JSON.stringify({ before, after }, null, 2));
  restored = JSON.stringify(before) === JSON.stringify(after);
}
if (!restored) throw Error('Isolated sources did not restore');
console.log(`${breaks.length - missed}/${breaks.length} adapter mutations caught; isolated sources restored.`);
process.exitCode = missed ? 1 : 0;
