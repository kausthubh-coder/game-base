// The Hollowmere town kit: 27 Blender models by Dot (assets-src/models/town/, with its own README). This
// tool brings them into the game. With --rebuild it first re-exports every GLB from its .blend source with
// Blender, through the kit's own scripts. Then it copies the GLBs to public/assets/models/town/, lists each
// in public/assets/manifest.json under `models` as `town-<name>`, and writes src/content/town-kit.ts: each
// model's size, its footprint and the cells a body cannot walk through.
//   bun tools/models/town.mjs [--rebuild] [--grids]
//
// A cell is solid when the model has surface in it between ankle and head height (0.25 to 1.8 m), so walls,
// posts and counters block, and steps, roofs and eaves do not, and so is every cell walled in from the edge.
// `--grids` prints each model's cells.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { inspectGlb } from './inspect.mjs';

const root = resolve(import.meta.dirname, '../..');
const kit = resolve(root, 'assets-src/models/town');
const out = resolve(root, 'public/assets/models/town');
const args = process.argv.slice(2);

if (args.includes('--rebuild')) {
  const run = spawnSync('sh', ['scripts/rebuild.sh', '--no-renders'], { cwd: kit, stdio: 'inherit', env: { ...process.env, BLENDER: process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender' } });
  if (run.status !== 0) process.exit(run.status ?? 1);
  fs.mkdirSync(out, { recursive: true });
  for (const file of fs.readdirSync(resolve(kit, 'models'))) if (file.endsWith('.glb')) fs.copyFileSync(resolve(kit, 'models', file), resolve(out, file));
}

const LOW = 0.25, HIGH = 1.8, STEP = 0.08;
/** Models to walk on: their deck needs blocks under it, and they block nothing. */
const DECKS = new Set(['stone-bridge', 'dock-segment']);

/** The positions and triangle indices of every primitive in a GLB, with the material each one uses. */
function readGlb(buffer) {
  const jsonLength = buffer.readUInt32LE(12);
  const doc = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength + 8;
  const view = (accessor) => {
    const a = doc.accessors[accessor], v = doc.bufferViews[a.bufferView];
    const offset = binStart + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return { a, v, offset };
  };
  const parts = [];
  for (const mesh of doc.meshes) for (const p of mesh.primitives) {
    const pos = view(p.attributes.POSITION);
    if (pos.a.componentType !== 5126) throw Error('positions must be float32');
    const stride = pos.v.byteStride ?? 12;
    const positions = new Float32Array(pos.a.count * 3);
    for (let i = 0; i < pos.a.count; i++) for (let k = 0; k < 3; k++) positions[i * 3 + k] = buffer.readFloatLE(pos.offset + i * stride + k * 4);
    const idx = view(p.indices);
    const size = idx.a.componentType === 5125 ? 4 : 2;
    const indices = new Uint32Array(idx.a.count);
    for (let i = 0; i < idx.a.count; i++) indices[i] = size === 4 ? buffer.readUInt32LE(idx.offset + i * 4) : buffer.readUInt16LE(idx.offset + i * 2);
    parts.push({ positions, indices, material: doc.materials?.[p.material]?.name ?? '' });
  }
  return parts;
}

const sources = JSON.parse(fs.readFileSync(resolve(kit, 'manifest.json'), 'utf8'));
const manifestPath = resolve(root, 'public/assets/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const name of Object.keys(manifest.models)) if (name.startsWith('town-')) delete manifest.models[name];
const entries = [];

for (const source of sources) {
  const { name, footprint: [w, d], dimensions: [sx, sy, sz], budget, category } = source;
  const file = `models/town/${name}.glb`;
  const buffer = fs.readFileSync(resolve(root, 'public/assets', file));
  const { triangles } = inspectGlb(buffer, { primitives: 2 });
  manifest.models[`town-${name}`] = { file, triangles, budget, bytes: buffer.length };

  // Cells of the footprint, x from its west edge and z from its north edge, with the model's middle at (w / 2, d / 2).
  const hits = new Uint32Array(w * d);
  for (const part of readGlb(buffer)) {
    const p = part.positions, ix = part.indices;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const ys = [p[a + 1], p[b + 1], p[c + 1]];
      if (Math.max(...ys) < LOW || Math.min(...ys) > HIGH) continue;
      const edge = Math.max(Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]), Math.hypot(p[a] - p[c], p[a + 1] - p[c + 1], p[a + 2] - p[c + 2]));
      const n = Math.max(1, Math.ceil(edge / STEP));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, s = 1 - u - v;
        const y = p[a + 1] * s + p[b + 1] * u + p[c + 1] * v;
        if (y < LOW || y > HIGH) continue;
        const x = p[a] * s + p[b] * u + p[c] * v + w / 2, z = p[a + 2] * s + p[b + 2] * u + p[c + 2] * v + d / 2;
        const cx = Math.floor(x), cz = Math.floor(z);
        if (cx >= 0 && cx < w && cz >= 0 && cz < d) hits[cz * w + cx]++;
      }
    }
  }
  // Inside a building's walls is solid too: nobody can get in there. Only cells reached from the edge stay open.
  const open = new Uint8Array(w * d), queue = [];
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    if ((x === 0 || z === 0 || x === w - 1 || z === d - 1) && hits[z * w + x] === 0) { open[z * w + x] = 1; queue.push(z * w + x); }
  }
  while (queue.length > 0) {
    const i = queue.pop(), x = i % w, z = (i / w) | 0;
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      const n = nz * w + nx;
      if (nx < 0 || nz < 0 || nx >= w || nz >= d || open[n] || hits[n] > 0) continue;
      open[n] = 1;
      queue.push(n);
    }
  }
  // Decks are walked on, not into, and a string of lanterns hangs over the walk between its two posts.
  if (DECKS.has(name)) open.fill(1);
  if (name === 'string-lights') for (let z = 0; z < d; z++) for (let x = 1; x < w - 1; x++) open[z * w + x] = 1;
  const solid = [];
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) if (!open[z * w + x]) solid.push(z * w + x);
  entries.push({ name, category, footprint: [w, d], size: [sx, sy, sz], triangles, solid });
  if (args.includes('--grids')) {
    console.log(`\n${name}  ${w} x ${d}, front (+z) at the bottom`);
    for (let z = 0; z < d; z++) {
      let row = '';
      for (let x = 0; x < w; x++) row += open[z * w + x] ? '.' : '#';
      console.log(`  ${String(z).padStart(2)} ${row}`);
    }
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const lines = entries.map((e) => `  '${e.name}': { category: '${e.category}', footprint: [${e.footprint.join(', ')}], size: [${e.size.join(', ')}], triangles: ${e.triangles}, solid: [${e.solid.join(', ')}] },`);
fs.writeFileSync(resolve(root, 'src/content/town-kit.ts'), `// Written by tools/models/town.mjs from the GLBs of the Hollowmere town kit. Do not edit by hand.
//
// Each model stands with its middle at the middle of its footprint and its front toward +z (south). The
// footprint is whole metres, x by z. \`solid\` lists the footprint's cells a body cannot walk through, as
// z * width + x counted from the footprint's north-west corner: the cells with surface between ankle and
// head height. Its model is drawn by src/game/views/world-town.view.ts and listed in
// public/assets/manifest.json as \`town-<name>\`.

export interface TownModelDef {
  category: 'landmark' | 'building' | 'street';
  footprint: readonly [x: number, z: number];
  /** Its size in metres, x by y by z. */
  size: readonly [number, number, number];
  triangles: number;
  solid: readonly number[];
}

export const TOWN_MODELS = {
${lines.join('\n')}
} as const satisfies Record<string, TownModelDef>;

export type TownModelName = keyof typeof TOWN_MODELS;
`);
console.log(`${entries.length} town models: manifest and src/content/town-kit.ts written`);
