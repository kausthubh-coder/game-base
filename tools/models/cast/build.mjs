// Exports the cast from its Blender sources: the hero, the townsfolk and the creatures that Characters > 3D models
// draws. The sources are hand-edited .blend files in assets-src/cast/sources; the scripts in ./scripts came with
// them (see assets-src/cast/README.md). Blender opens each source and exports it as is, into .cache, and each
// file is copied to public/assets/models/cast-<name>.glb and listed in the manifest's `cast` section.
//   bun tools/models/cast/build.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { inspectGlb } from '../inspect.mjs';

const root = resolve(import.meta.dirname, '../../..');
const work = resolve(import.meta.dirname, '.cache/root');
export const PEOPLE = ['hero', 'tamsin', 'maren', 'odo', 'gus', 'mira', 'wren', 'juniper', 'brack', 'villager-a', 'villager-b'];
export const CREATURES = ['leaftail', 'mossling', 'lanternfly'];

fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
fs.symlinkSync(resolve(root, 'assets-src/cast/sources'), resolve(work, 'sources'));
const code = await new Promise((done, reject) => {
  const p = spawn('/Applications/Blender.app/Contents/MacOS/Blender',
    ['--background', '--python-exit-code', '1', '--python', 'tools/models/cast/scripts/build.py', '--', '--no-renders'],
    { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, CAST_ROOT: work } });
  p.on('error', reject);
  p.on('exit', done);
});
if (code !== 0) process.exit(code ?? 1);

const manifest = JSON.parse(fs.readFileSync(`${root}/public/assets/manifest.json`));
manifest.cast = {};
for (const name of [...PEOPLE, ...CREATURES]) {
  const file = `models/cast-${name}.glb`;
  fs.copyFileSync(resolve(work, 'models', `${name}.glb`), `${root}/public/assets/${file}`);
  const buffer = fs.readFileSync(`${root}/public/assets/${file}`);
  manifest.cast[name] = { file, source: `assets-src/cast/sources/${name}.blend`, triangles: inspectGlb(buffer).triangles, budget: PEOPLE.includes(name) ? 4000 : 2000, bytes: buffer.length };
  console.log(name, manifest.cast[name].triangles, 'triangles', buffer.length, 'bytes');
}
fs.writeFileSync(`${root}/public/assets/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
