// The place check over the real world, with no browser: every place built into the land, asked the same questions.
//   bun tools/place-check.ts                 the whole world, worst first
//   bun tools/place-check.ts ruin-mill caves only these places (a plan id, or a place of the place system)
//   bun tools/place-check.ts --blocks        where blocks of the old block world are still drawn, and what writes them
//   bun tools/place-check.ts --json          the findings as data, for a script
//   bun tools/place-check.ts --level error   only errors (`warn` is the default, `note` shows everything)
//   bun tools/place-check.ts --strict        exit 1 on an error in any place, not only in places of the place system
//   bun tools/place-check.ts --ground x,z    the land at a column: its height, the water over it and its kind
// It exits 1 when a place of the place system (src/game/content/places) has an error. The older lists are reported and
// never fail it, so a lead can run it on any branch today. The questions are src/game/places/check.sim.ts; this
// file only hands them the real land (the chunks, made as the game makes them), the models' real shapes (built as
// the game builds them) and what a body can walk to from your plot. About 15 seconds on a quiet machine.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type * as THREE from 'three';
import { BLOCKS, blockId } from '../src/content/blocks.ts';
import { PROPS, propDef } from '../src/content/props.ts';
import { buildProp } from '../src/features/props/build.ts';
import { groundHeight, treesInArea } from '../src/features/world/terrain.sim.ts';
import { World } from '../src/features/world/world.sim.ts';
import { MAP_SIZE, PATHS, PLACES, toWorld } from '../src/game/content/greenhollow.ts';
import { REGION } from '../src/game/content/region.ts';
import { checkPlaces, describe, type CheckLand, type CheckModels, type Finding, type ModelShape, type Subject } from '../src/game/places/check.sim.ts';
import { declaredSubjects, knownNames } from '../src/game/places/build.sim.ts';
import { legacySubjects } from '../src/game/places/legacy.sim.ts';
import { biomeAt, placeAt } from '../src/game/region/greenhollow.sim.ts';
import { planPathReach, waterLevelAt } from '../src/game/region/greenhollow-land.sim.ts';
import { ROOM_DEFS } from '../src/game/ruins/rooms.sim.ts';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (name: string, fallback: string): string => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const valued = new Set(['--level', '--ground']);
const asked = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
const SEED = 1;

// ------------------------------------------------------------------------------------------ the land

const X0 = toWorld([0, 0]).x, Z0 = toWorld([0, 0]).z, W = MAP_SIZE.w, H = MAP_SIZE.h;
const inMap = (x: number, z: number): boolean => x >= X0 && x < X0 + W && z >= Z0 && z < Z0 + H;
const heights = new Int16Array(W * H).fill(-1);
function ground(x: number, z: number): number {
  if (!inMap(x, z)) return groundHeight(SEED, x, z);
  const i = (z - Z0) * W + (x - X0);
  if (heights[i] < 0) heights[i] = groundHeight(SEED, x, z);
  return heights[i];
}

if (args.includes('--ground')) {
  const [x, z] = opt('ground', '0,0').split(',').map(Number);
  console.log(`(${x}, ${z}): ground ${ground(x, z)}, water to ${waterLevelAt(x, z)}, ${inMap(x, z) ? biomeAt(x, z) : 'outside the map'}, ${planPathReach(x, z) <= 0 ? 'on a path' : 'off the paths'}`);
  process.exit(0);
}

const started = performance.now();
const world = new World(SEED);
/** Chunks are made when first asked for, so a place off the map (Saltgate, the rooms) is checked on its own land. */
const loaded = new Set<number>();
function block(x: number, y: number, z: number): number {
  const cx = x >> 4, cz = z >> 4, key = cx * 65536 + cz;
  if (!loaded.has(key)) { loaded.add(key); world.load(cx, cz); }
  return world.getBlock(x, y, z);
}
const WATER = blockId('water');
/** The land's own blocks: under the ground's top any of them is land. At or over it only water is. */
const LAND = new Set(['grass', 'dirt', 'path', 'sand', 'clay', 'stone', 'mossy_stone'].map(blockId));
const drawn = (id: number): boolean => id !== 0 && id !== WATER && BLOCKS[id].tiles.top !== '';
function oldBlock(x: number, y: number, z: number): string {
  const id = block(x, y, z);
  if (!drawn(id)) return '';
  if (y < ground(x, z) && LAND.has(id)) return '';
  return BLOCKS[id].key;
}

/** Where feet stand in each column of the map, and which of them a body reaches on foot from your plot. */
function walk(): Uint8Array {
  const feet = new Float32Array(W * H).fill(NaN);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = X0 + i, z = Z0 + j;
    const solid = (y: number): boolean => { const b = block(x, y, z); return b !== 0 && b !== WATER; };
    for (let y = ground(x, z); y < 60; y++) if (solid(y - 1) && !solid(y) && !solid(y + 1)) { feet[j * W + i] = y; break; }
  }
  const start = placeAt('plot'), reached = new Uint8Array(W * H);
  const queue = [(start.z - Z0) * W + (start.x - X0)];
  reached[queue[0]] = 1;
  for (let q = 0; q < queue.length; q++) {
    const at = queue[q], i = at % W, j = (at - i) / W, h = feet[at];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni;
      if (reached[n] || !(Math.abs(feet[n] - h) <= 1)) continue;
      reached[n] = 1;
      queue.push(n);
    }
  }
  return reached;
}
const reached = walk();

const land: CheckLand = {
  ground,
  water: waterLevelAt,
  oldBlock,
  trees: (x0, z0, x1, z1) => treesInArea(SEED, x0, z0, x1, z1),
  walkable: (x, z) => inMap(x, z) && reached[(z - Z0) * W + (x - X0)] === 1,
  inMap,
};

// ------------------------------------------------------------------------------------------ the models

/** How near its lowest point a part of a model must come to count as a foot. */
const FOOT = 0.35;
const shapes = new Map<string, ModelShape | null>();
function measure(geometry: THREE.BufferGeometry): { min: [number, number, number]; max: [number, number, number]; cells: Map<number, number> } {
  const pos = geometry.getAttribute('position'), index = geometry.index;
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  /** The lowest y in each block-wide cell, sampled across every triangle so a broad flat face fills its cells. */
  const cells = new Map<number, number>();
  const take = (x: number, y: number, z: number): void => {
    const key = (Math.floor(x) + 512) * 1024 + Math.floor(z) + 512;
    const low = cells.get(key);
    if (low === undefined || y < low) cells.set(key, y);
  };
  const n = index ? index.count : pos.count;
  const v = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let t = 0; t < n; t += 3) {
    for (let k = 0; k < 3; k++) {
      const i = index ? index.getX(t + k) : t + k;
      v[k * 3] = pos.getX(i); v[k * 3 + 1] = pos.getY(i); v[k * 3 + 2] = pos.getZ(i);
      for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], v[k * 3 + a]); max[a] = Math.max(max[a], v[k * 3 + a]); }
    }
    const edge = Math.max(Math.hypot(v[3] - v[0], v[5] - v[2]), Math.hypot(v[6] - v[0], v[8] - v[2]), Math.hypot(v[6] - v[3], v[8] - v[5]));
    const steps = Math.min(16, Math.max(1, Math.ceil(edge / 0.6)));
    for (let a = 0; a <= steps; a++) for (let b = 0; a + b <= steps; b++) {
      const p = a / steps, q = b / steps, r = 1 - p - q;
      take(v[0] * r + v[3] * p + v[6] * q, v[1] * r + v[4] * p + v[7] * q, v[2] * r + v[5] * p + v[8] * q);
    }
  }
  return { min, max, cells };
}
const models: CheckModels = {
  shape(model, variant) {
    const key = `${model}:${variant}`;
    let shape = shapes.get(key);
    if (shape !== undefined) return shape;
    shape = null;
    if (Object.hasOwn(PROPS, model)) {
      const def = propDef(model), v = variant === '' ? 0 : def.variants.indexOf(variant);
      if (v >= 0) {
        const high = buildProp(model, v, 1), low = buildProp(model, v, 0.5);
        const { min, max, cells } = measure(high);
        const feet: number[] = [], cover: number[] = [];
        for (const [key, y] of cells) {
          const x = Math.floor(key / 1024) - 512, z = (key % 1024) - 512;
          cover.push(x, z, y);
          if (y <= min[1] + FOOT) feet.push(x, z, y);
        }
        const count = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        shape = { min, max, feet, cover, triangles: { low: count(low), high: count(high) } };
      }
    }
    shapes.set(key, shape);
    return shape;
  },
};

// ------------------------------------------------------------------------------------------ the old blocks

/** What still writes drawn blocks into the map, by where they lie. */
function source(key: string, x: number, z: number): string {
  const town = REGION.town;
  if (key === 'oak_plank' && planPathReach(x, z) <= 0) {
    const boards = PATHS.some((p) => p.boards && p.points.some((q) => { const w = toWorld(q); return Math.hypot(w.x - x, w.z - z) < 60; }));
    return `terrain.sim.ts generateChunk: a path that meets water is laid as plank blocks${boards ? ' (boardwalk models stand on this path too)' : ''}`;
  }
  if (key === 'lume_crystal') return 'terrain.sim.ts generateChunk: a crystal on the floor of a cave that breaks the surface';
  if (x >= town.x0 && x <= town.x1 && z >= town.z0 && z <= town.z1) return 'region.ts: the town\'s fills and block buildings (land.sim.ts stampStructures)';
  for (const f of REGION.fills) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return 'region.ts: a fill (land.sim.ts stampStructures)';
  return 'unknown: a stamp in terrain.sim.ts generateChunk';
}
function nearestPlace(x: number, z: number): string {
  let best = '', d = Infinity;
  for (const p of PLACES) { const at = placeAt(p.id), e = Math.hypot(at.x - x, at.z - z); if (e < d) { d = e; best = p.id; } }
  return best;
}
interface Cluster { key: string; place: string; source: string; count: number; x0: number; z0: number; x1: number; z1: number }
function oldBlocks(): Cluster[] {
  const clusters = new Map<string, Cluster>();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = X0 + i, z = Z0 + j, g = ground(x, z);
    for (let y = g - 1; y <= g + 14; y++) {
      const key = oldBlock(x, y, z);
      if (!key) continue;
      const src = source(key, x, z), place = nearestPlace(x, z), id = `${key}|${place}|${src}`;
      let c = clusters.get(id);
      if (!c) clusters.set(id, (c = { key, place, source: src, count: 0, x0: x, z0: z, x1: x, z1: z }));
      c.count++;
      c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.z0 = Math.min(c.z0, z); c.z1 = Math.max(c.z1, z);
    }
  }
  return [...clusters.values()].sort((a, b) => b.count - a.count);
}

// ------------------------------------------------------------------------------------------ the run

const declared = declaredSubjects(SEED, ground);
const subjects: Subject[] = [...declared, ...legacySubjects(ground, new Set(declared.map((s) => s.id)))];
const unknown = asked.filter((id) => !subjects.some((s) => s.id === id));
if (unknown.length) {
  console.error(`FAIL: no place called ${unknown.join(', ')}. The places: ${subjects.map((s) => s.id).join(', ')}`);
  process.exit(2);
}
const chosen = asked.length ? subjects.filter((s) => asked.includes(s.id)) : subjects;

// The game's camera at its first zoom step (src/game/shell/game.ts, src/features/camera/rig.sim.ts): 34 blocks out at a
// pitch of 35 degrees, south-east of the hero, a block over the feet.
const D = 34, PITCH = (35 * Math.PI) / 180, FLAT = Math.cos(PITCH) * D * Math.SQRT1_2;
const known = new Set<string>(['road', ...PLACES.map((p) => p.id), ...ROOM_DEFS.map((r) => `room:${r.id}`), ...knownNames()]);
const findings = checkPlaces(chosen, land, models, { eye: { dx: FLAT, dy: 1 + Math.sin(PITCH) * D, dz: FLAT }, known, sheetExists: (path) => existsSync(resolve(root, path)) });

const levels = ['error', 'warn', 'note'];
const shown = findings.filter((f) => levels.indexOf(f.level) <= levels.indexOf(opt('level', 'warn')));
const isDeclared = new Set(declared.map((s) => s.id));
const failing = findings.filter((f) => f.level === 'error' && (args.includes('--strict') || isDeclared.has(f.place)));
const blocks = args.includes('--blocks') || !asked.length ? oldBlocks() : [];

if (args.includes('--json')) {
  console.log(JSON.stringify({ places: chosen.map((s) => ({ id: s.id, declared: s.declared, pieces: s.pieces.length })), findings: shown, oldBlocks: blocks }, null, 2));
} else {
  for (const f of shown) console.log(describe(f));
  if (blocks.length) {
    console.log(`\nBlocks of the old block world still drawn on the map (${blocks.reduce((n, c) => n + c.count, 0)} in all):`);
    for (const c of blocks.slice(0, 40)) console.log(`  ${String(c.count).padStart(5)} ${c.key.padEnd(13)} near ${c.place.padEnd(15)} x ${c.x0} to ${c.x1}, z ${c.z0} to ${c.z1}\n        from ${c.source}`);
    if (blocks.length > 40) console.log(`  and ${blocks.length - 40} smaller groups`);
  }
  const count = (level: string, list: Finding[]): number => list.filter((f) => f.level === level).length;
  const by = new Map<string, number>();
  for (const f of findings) if (f.level !== 'note') by.set(f.check, (by.get(f.check) ?? 0) + 1);
  console.log(`\n${chosen.length} places (${chosen.filter((s) => s.declared).length} of the place system), ${chosen.reduce((n, s) => n + s.pieces.length, 0)} pieces: ${count('error', findings)} errors, ${count('warn', findings)} warnings, ${count('note', findings)} notes, in ${Math.round((performance.now() - started) / 100) / 10} s`);
  if (by.size) console.log(`  by kind: ${[...by].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  console.log(failing.length ? `FAIL: ${failing.length} error${failing.length === 1 ? '' : 's'} in ${args.includes('--strict') ? 'the world' : 'places of the place system'}` : `ok: no error in ${args.includes('--strict') ? 'the world' : 'a place of the place system'}`);
}
process.exit(failing.length ? 1 : 0);
