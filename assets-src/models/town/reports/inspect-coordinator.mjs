// Reads each .glb's JSON chunk and accessors: triangles, bounds, bones, clips and their lengths.
import { readFileSync, readdirSync } from 'node:fs';
const dir = process.argv[2];
const rows = [];
for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb')).sort()) {
  const b = readFileSync(dir + '/' + f);
  if (b.readUInt32LE(0) !== 0x46546c67) { rows.push({ f, error: 'not glb' }); continue; }
  const jsonLen = b.readUInt32LE(12);
  const g = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  let tris = 0, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const m of g.meshes ?? []) for (const p of m.primitives) {
    const idx = p.indices !== undefined ? g.accessors[p.indices].count : g.accessors[p.attributes.POSITION].count;
    tris += idx / 3;
    const pos = g.accessors[p.attributes.POSITION];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], pos.min[i]); max[i] = Math.max(max[i], pos.max[i]); }
  }
  const clips = (g.animations ?? []).map((a) => {
    let len = 0;
    for (const s of a.samplers) len = Math.max(len, g.accessors[s.input].max?.[0] ?? 0);
    return `${a.name}:${len.toFixed(2)}`;
  });
  const bones = g.skins?.[0]?.joints.map((j) => g.nodes[j].name) ?? [];
  rows.push({ f, tris, h: +(max[1] - min[1]).toFixed(2), footY: +min[1].toFixed(3), x: [+min[0].toFixed(2), +max[0].toFixed(2)], z: [+min[2].toFixed(2), +max[2].toFixed(2)], bones: bones.length, tool: bones.some((n) => /hand.?R.?tool/.test(n)), clips: clips.join(' '), colors: Boolean(g.meshes?.[0]?.primitives?.[0]?.attributes?.COLOR_0), images: (g.images ?? []).length, ext: (g.extensionsUsed ?? []).join(',') });
}
for (const r of rows) console.log(JSON.stringify(r));
