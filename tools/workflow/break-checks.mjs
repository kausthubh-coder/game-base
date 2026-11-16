import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const breaks = [
  ['chapter.mjs', 'framing failures only logged', 'if (await run() !== true)', 'if (false)'],
  ['chapter.mjs', 'missing evidence accepted', 'for (const name of requirements) {', 'for (const name of []) {'],
  ['chapter.mjs', 'starting checkpoint silently edited', 'if (input && hash(readFileSync(checkpoint)) !== hash(input))', 'if (false)'],
  ['replay.mjs', 'another floor counted as arrival', ' || (leg.y !== undefined && Math.abs(P.pos.y - leg.y) > 1)', ''],
  ['replay.mjs', 'action attempted outside reach', 'if (distance > reach)', 'if (false)'],
  ['replay.mjs', 'legacy aim placed between target and hero', '    aim(target);\n    press();', '    aim({ ...target, x: (P.pos.x + target.x) / 2 });\n    press();'],
  ['replay.mjs', 'earned aim placed between target and hero', '    await aim(target);\n    await press();', '    await aim({ ...target, x: (P.pos.x + target.x) / 2 });\n    await press();'],
  ['../lib/checkout.mjs', 'idle port reservations ignored', '!used.has(port) && await isFree(port)', 'await isFree(port)'],
];
let failed = 0;
for (const [file, name, from, to] of breaks) {
  const path = resolve(import.meta.dirname, file);
  const source = readFileSync(path, 'utf8');
  if (source.split(from).length !== 2) { console.error(`GONE ${name}`); failed++; continue; }
  try {
    writeFileSync(path, source.replace(from, to));
    const result = spawnSync('bun', ['test', 'tools/workflow'], { cwd: root, encoding: 'utf8' });
    const caught = result.status !== 0 && /\(fail\)/.test(result.stdout + result.stderr);
    console.log(`${caught ? 'CAUGHT' : 'MISSED'} ${name}`);
    if (!caught) failed++;
  } finally { writeFileSync(path, source); }
}
process.exitCode = failed ? 1 : 0;
