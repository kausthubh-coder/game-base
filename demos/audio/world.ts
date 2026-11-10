// The demo's map: six lands in a ring around the center, a town in each, and the things that make sound.
// It exists to drive the sound engine. Nothing here is the game's real world.
// x runs east and z runs south, so north is -z, as in the base.
import type { Surface } from '../../src/engine/types.ts';

export const WORLD_RADIUS = 520;
export const CENTER_RADIUS = 110;
/** The width of the band where two lands blend, in units. */
export const BAND = 60;

/** The ring, clockwise from north. Each land fills 60 degrees. */
export const RING = ['forge', 'highlands', 'coast', 'meadow', 'desert', 'rainvalley'] as const;
export type Land = (typeof RING)[number] | 'center';
export const LANDS: Land[] = ['meadow', 'desert', 'coast', 'rainvalley', 'highlands', 'forge', 'center'];

const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const smooth = (lo: number, hi: number, v: number): number => {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Degrees clockwise from north. */
function bearing(x: number, z: number): number {
  const b = Math.atan2(x, -z) / DEG;
  return b < 0 ? b + 360 : b;
}

export function pointAt(bearingDeg: number, radius: number): { x: number; z: number } {
  return { x: Math.sin(bearingDeg * DEG) * radius, z: -Math.cos(bearingDeg * DEG) * radius };
}

/**
 * The weight of every land at a point. They sum to 1. Inside a land its weight is 1. Across the 60 units
 * between two neighbors it runs from 1 to 0 in a straight line, so the blend is a function of position.
 */
export function regionWeights(x: number, z: number, out: Record<string, number>): void {
  for (const land of LANDS) out[land] = 0;
  const r = Math.hypot(x, z);
  const ring = clamp((r - (CENTER_RADIUS - BAND / 2)) / BAND, 0, 1);
  out.center = 1 - ring;
  if (ring <= 0) return;
  const b = bearing(x, z);
  const sector = Math.round(b / 60) % 6;
  let local = b - sector * 60;
  if (local > 180) local -= 360;
  const toBorder = (30 - Math.abs(local)) * DEG * Math.max(r, 1);
  const own = toBorder >= BAND / 2 ? 1 : 0.5 + toBorder / BAND;
  const neighbor = (sector + (local >= 0 ? 1 : 5)) % 6;
  out[RING[sector] as string] = ring * own;
  out[RING[neighbor] as string] = (out[RING[neighbor] as string] ?? 0) + ring * (1 - own);
}

export interface Town {
  land: Land;
  x: number;
  z: number;
  /** The one building you can walk into. */
  house: { x: number; z: number; w: number; d: number };
}

export const TOWNS: Town[] = RING.map((land, i) => {
  const p = pointAt(i * 60, 300);
  return { land, x: p.x, z: p.z, house: { x: p.x + 8, z: p.z - 22, w: 20, d: 14 } };
});

export function townAmount(x: number, z: number): number {
  let best = 0;
  for (const t of TOWNS) best = Math.max(best, 1 - smooth(30, 62, Math.hypot(x - t.x, z - t.z)));
  return best;
}

export function indoorsAmount(x: number, z: number): number {
  for (const t of TOWNS) {
    const h = t.house;
    const dx = Math.max(h.x - x, 0, x - (h.x + h.w));
    const dz = Math.max(h.z - z, 0, z - (h.z + h.d));
    const outside = Math.hypot(dx, dz);
    if (outside < 3) return 1 - outside / 3;
  }
  return 0;
}

// Smooth noise in two dimensions, for patches of ground.
function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
export function noise2(x: number, z: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fz = z / scale;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash2(ix, iz, seed) * (1 - sx) + hash2(ix + 1, iz, seed) * sx;
  const b = hash2(ix, iz + 1, seed) * (1 - sx) + hash2(ix + 1, iz + 1, seed) * sx;
  return a * (1 - sz) + b * sz;
}

export const POND = { x: 34, z: 384, r: 30 };

function isWater(x: number, z: number, land: Land, r: number): boolean {
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r) return true;
  // The sea, off the coast.
  if (land === 'coast' && r > 452 + 10 * noise2(x, z, 40, 5)) return true;
  // A river through the rain valley.
  if (land === 'rainvalley') {
    const p = pointAt(300, r);
    const off = Math.hypot(x - p.x, z - p.z) - 70 - 18 * Math.sin(r / 38);
    if (Math.abs(off) < 7 && r > 150) return true;
  }
  return false;
}

const scratch: Record<string, number> = {};

/** The land that owns a point. In a border band the two lands' ground interleaves in patches. */
export function landAt(x: number, z: number): Land {
  regionWeights(x, z, scratch);
  const wobble = (noise2(x, z, 14, 99) - 0.5) * 0.5;
  let best: Land = 'center';
  let bestW = -1;
  for (const land of LANDS) {
    // Neighbors around the ring get opposite signs, so the noise pushes the border back and forth.
    const sign = land === 'center' ? 0 : RING.indexOf(land) % 2 === 0 ? 1 : -1;
    const w = (scratch[land] ?? 0) + wobble * sign;
    if ((scratch[land] ?? 0) > 0 && w > bestW) {
      bestW = w;
      best = land;
    }
  }
  return best;
}

/** What is underfoot. Every surface in the base's contract appears somewhere on the map. */
export function surfaceAt(x: number, z: number): Surface {
  const r = Math.hypot(x, z);
  for (const t of TOWNS) {
    const h = t.house;
    if (x >= h.x && x <= h.x + h.w && z >= h.z && z <= h.z + h.d) return 'wood';
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < 12) return t.land === 'forge' ? 'metal' : 'stone';
    if (d < 28) return t.land === 'forge' || t.land === 'highlands' ? 'stone' : 'wood';
    if (d < 44 && noise2(x, z, 9, 3) > 0.35) return 'dirt';
  }
  const land = landAt(x, z);
  if (isWater(x, z, land, r)) return 'water';
  const n = noise2(x, z, 26, 7);
  const fine = noise2(x, z, 9, 13);
  switch (land) {
    case 'meadow':
      return n > 0.62 ? 'tallGrass' : fine > 0.8 ? 'leaves' : n < 0.2 ? 'dirt' : 'grass';
    case 'desert':
      return n > 0.72 ? 'stone' : 'sand';
    case 'coast':
      return r > 405 ? 'sand' : n > 0.6 ? 'tallGrass' : n < 0.25 ? 'sand' : 'grass';
    case 'rainvalley':
      return n > 0.6 ? 'dirt' : fine > 0.7 ? 'leaves' : n < 0.22 ? 'tallGrass' : 'grass';
    case 'highlands':
      return n > 0.62 ? 'snow' : n < 0.28 ? 'grass' : 'stone';
    case 'forge':
      return n > 0.68 ? 'dirt' : fine > 0.86 ? 'metal' : 'stone';
    case 'center':
      return r < 18 || (r > 58 && r < 64) ? 'stone' : n > 0.7 ? 'tallGrass' : 'grass';
  }
}

export interface Tree {
  x: number;
  z: number;
  size: number;
}

const TREE_DENSITY: Record<Land, number> = { meadow: 0.75, rainvalley: 0.95, coast: 0.3, highlands: 0.3, forge: 0.12, desert: 0.05, center: 0.45 };
const CELL = 48;

/** A seeded scatter of trees, thick in the rain valley and thin in the desert, in a grid for quick lookups. */
export function makeTrees(): { all: Tree[]; near(x: number, z: number): number } {
  let seed = 12345;
  const rand = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const all: Tree[] = [];
  const grid = new Map<number, Tree[]>();
  const key = (cx: number, cz: number): number => (cx + 64) * 256 + (cz + 64);
  for (let i = 0; i < 5200; i++) {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * (WORLD_RADIUS - 12);
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const roll = rand();
    const size = 2.2 + rand() * 2;
    const land = landAt(x, z);
    const clump = 0.35 + 1.3 * noise2(x, z, 60, 21);
    if (roll > TREE_DENSITY[land] * clump) continue;
    if (townAmount(x, z) > 0.2 || surfaceAt(x, z) === 'water') continue;
    const tree = { x, z, size };
    all.push(tree);
    const k = key(Math.floor(x / CELL), Math.floor(z / CELL));
    const list = grid.get(k);
    if (list) list.push(tree);
    else grid.set(k, [tree]);
  }
  return {
    all,
    /** How wooded it is here, 0 to 1: the trees within 45 units, nearer ones counting more. */
    near(x, z) {
      const cx = Math.floor(x / CELL);
      const cz = Math.floor(z / CELL);
      let sum = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const list = grid.get(key(cx + dx, cz + dz));
          if (!list) continue;
          for (const t of list) {
            const d = Math.hypot(t.x - x, t.z - z);
            if (d < 45) sum += 1 - d / 45;
          }
        }
      }
      return clamp(sum / 9, 0, 1);
    },
  };
}

/** How far the nearest water is, on a coarse grid built once. Returns 0 to 1: 1 is standing at the edge. */
export function makeWaterField(): (x: number, z: number) => number {
  const step = 6;
  const n = Math.ceil((WORLD_RADIUS * 2) / step) + 1;
  const dist = new Float32Array(n * n).fill(1e9);
  const queue: number[] = [];
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const x = -WORLD_RADIUS + ix * step;
      const z = -WORLD_RADIUS + iz * step;
      if (Math.hypot(x, z) < WORLD_RADIUS + step && surfaceAt(x, z) === 'water') {
        dist[iz * n + ix] = 0;
        queue.push(iz * n + ix);
      }
    }
  }
  // A flood outward from every water cell: each step is one cell further.
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head] as number;
    const d = (dist[at] as number) + step;
    if (d > 72) continue;
    const ix = at % n;
    const iz = (at - ix) / n;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const jx = ix + dx;
      const jz = iz + dz;
      if (jx < 0 || jz < 0 || jx >= n || jz >= n) continue;
      const to = jz * n + jx;
      if ((dist[to] as number) > d) {
        dist[to] = d;
        queue.push(to);
      }
    }
  }
  return (x, z) => {
    const ix = clamp(Math.round((x + WORLD_RADIUS) / step), 0, n - 1);
    const iz = clamp(Math.round((z + WORLD_RADIUS) / step), 0, n - 1);
    return clamp(1 - (dist[iz * n + ix] as number) / 60, 0, 1);
  };
}

export const START = { x: -58, z: 318 };
export const CAMPS = [{ x: -150, z: 380 }, pointAt(240, 395)];
export const BOSS = { x: 0, z: -185, r: 42 };
export const MACHINE = { x: -34, z: 326 };

export function dangerAmount(x: number, z: number): number {
  let best = 0;
  for (const c of CAMPS) best = Math.max(best, clamp(1 - (Math.hypot(x - c.x, z - c.z) - 12) / 60, 0, 1));
  return best;
}

export function bossAmount(x: number, z: number): number {
  return Math.hypot(x - BOSS.x, z - BOSS.z) < BOSS.r ? 1 : 0;
}

/** Places worth jumping to. The border spots sit in the middle of a band, where two lands play together. */
export const SPOTS: { name: string; x: number; z: number }[] = [
  ...LANDS.map((land) => {
    const i = RING.indexOf(land as (typeof RING)[number]);
    const p = i < 0 ? { x: 0, z: 0 } : pointAt(i * 60 - 9, 222);
    return { name: land, x: p.x, z: p.z };
  }),
  { name: 'meadow town', x: TOWNS[3]?.x ?? 0, z: (TOWNS[3]?.z ?? 0) + 6 },
  { name: 'meadow | desert', ...pointAt(210, 300) },
  { name: 'meadow | coast', ...pointAt(150, 300) },
  { name: 'forge | highlands', ...pointAt(30, 300) },
  { name: 'meadow | center', ...pointAt(180, CENTER_RADIUS) },
  { name: 'pond', x: POND.x - POND.r - 6, z: POND.z },
  { name: 'enemy camp', x: -150 + 46, z: 380 },
  { name: 'boss gate', x: BOSS.x, z: BOSS.z + BOSS.r + 14 },
];

export const SURFACE_COLOR: Record<Surface, [number, number, number]> = {
  grass: [92, 148, 84],
  tallGrass: [70, 124, 70],
  dirt: [134, 106, 78],
  stone: [128, 130, 138],
  wood: [164, 124, 82],
  sand: [214, 194, 138],
  water: [70, 130, 180],
  snow: [226, 232, 240],
  leaves: [150, 112, 60],
  metal: [96, 104, 118],
};
