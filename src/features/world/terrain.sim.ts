// Terrain from a seed: meadow, low hills, a river, ponds, forest and caves. The same seed always gives
// the same land, chunk by chunk, in any order. On that land it lays the plan of the game's first region
// (src/game/content/region.ts): level ground for the grant, the dead garden and the town, the path
// between them, and their blocks. The plan is plain data, so the page and the worker make the same chunk.
import { blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import { REGION } from '../../game/content/region.ts';
import { built, chunkInBounds, inBounds, onPath, placedModels, shapeGround, shaped, stampStructures, treeAllowed } from '../../game/region/land.sim.ts';
import { CHUNK, HEIGHT, cellIndex } from './chunk.sim.ts';
import { clamp, fbm2, hash2, hash3, noise3, smoothstep } from './noise.sim.ts';

/** Water fills every open cell below this y. */
export const WATER_LEVEL = 18;

const B = {
  grass: blockId('grass'), dirt: blockId('dirt'), path: blockId('path'), sand: blockId('sand'), clay: blockId('clay'),
  stone: blockId('stone'), mossy: blockId('mossy_stone'), oakLog: blockId('oak_log'), plank: blockId('oak_plank'),
  birchLog: blockId('birch_log'), pineLog: blockId('pine_log'), leaves: blockId('oak_leaves'),
  needles: blockId('pine_needles'), water: blockId('water'), lume: blockId('lume_crystal'),
};

/** A path that meets water crosses it on planks at this y, level with the banks. */
const BRIDGE_Y = WATER_LEVEL + 1;

const feetAt = (x: number, y: number, z: number): Vec3 => ({ x: x + 0.5, y, z: z + 0.5 });

function placeOf(name: string): Vec3 {
  const p = REGION.places.find((q) => q.name === name);
  if (!p) throw new Error(`the region plan has no place called ${name}`);
  return feetAt(p.x, p.y, p.z);
}

/** Where a new hero stands: two blocks north of the grant's standing stone, facing it. */
export function spawnPoint(): Vec3 {
  return feetAt(REGION.spawn.x, REGION.spawn.y, REGION.spawn.z);
}

/** One block west of the lamp that hangs in the middle of the lodge. A lodge of the town kit has no inside, so it is its doorstep. */
function insideLodge(): Vec3 {
  const lodge = built().find((b) => b.plan.id === 'lodge');
  if (!lodge) {
    const model = placedModels().find((m) => m.plan.id === 'lodge');
    if (!model) throw new Error('the region plan has no lodge');
    return feetAt(model.outside.x, model.outside.y, model.outside.z);
  }
  return feetAt(lodge.x0 + ((lodge.x1 - lodge.x0 + 1) >> 1) - 1, REGION.townGround, lodge.z0 + ((lodge.z1 - lodge.z0 + 1) >> 1));
}

/**
 * Places to stand that a demo or a test can jump to. `house`, `cave`, `caveMouth` and `pond` are the
 * names the first start site had: they now lead inside the lodge, under the oaks over the mossy rocks,
 * to the open ground in front of those rocks, and onto the ferry dock over the river.
 */
export const LANDMARKS = {
  house: insideLodge(),
  cave: feetAt(7, REGION.spawn.y, -231),
  caveMouth: placeOf('grant.rocks'),
  pond: placeOf('ferry'),
  grant: placeOf('grant.center'),
  garden: placeOf('dead.garden'),
  gate: placeOf('town.gate'),
  square: placeOf('town.square'),
  bank: placeOf('river.bank'),
} as const;

const hillMask = (seed: number, x: number, z: number): number => smoothstep(0.57, 0.72, fbm2(x / 170, z / 170, seed + 23, 2));

function naturalHeight(seed: number, x: number, z: number, hills: number): number {
  let h = 19.5 + fbm2(x / 52, z / 52, seed + 11, 3) * 3 + hills * (2 + 12 * fbm2(x / 44, z / 44, seed + 37, 3));
  // The river runs along one contour line of a slow noise. Its valley flattens the hills beside it.
  const r = Math.abs(fbm2(x / 240 + 7.3, z / 240 - 3.1, seed + 51, 2) - 0.5);
  const valley = smoothstep(0.06, 0.02, r);
  if (h > 19.6) h += (19.6 - h) * valley;
  h += (14.5 - h) * smoothstep(0.02, 0.007, r);
  // Ponds sit on a loose grid, in the meadow only.
  const gx = Math.floor(x / 96), gz = Math.floor(z / 96);
  if (hash2(gx, gz, seed + 61) < 0.6) {
    const px = gx * 96 + 20 + hash2(gx, gz, seed + 62) * 56, pz = gz * 96 + 20 + hash2(gx, gz, seed + 63) * 56;
    const radius = 5 + hash2(gx, gz, seed + 64) * 5;
    h += (15.2 - h) * smoothstep(radius, radius * 0.45, Math.hypot(x - px, z - pz)) * (1 - hills);
  }
  return h;
}

/** How many blocks of ground a column has. The ground's top face is at this y. */
export function groundHeight(seed: number, x: number, z: number): number {
  let h = naturalHeight(seed, x, z, hillMask(seed, x, z));
  if (inBounds(x, z)) h = shapeGround(x, z, h);
  return clamp(Math.floor(h + 0.5), 2, HEIGHT - 14);
}

/** `plain` is true where the region plan shaped the ground: there it is grass, never bare rock. */
function topBlock(seed: number, x: number, z: number, h: number, hills: number, plain: boolean): number {
  if (h <= WATER_LEVEL) return hash2(x >> 2, z >> 2, seed + 71) > 0.62 ? B.clay : B.sand;
  if (h <= WATER_LEVEL + 1) return B.sand;
  if (hills > 0.4 && !plain) {
    const rocky = fbm2(x / 9, z / 9, seed + 73, 2);
    if (h >= 30 || rocky > 0.7) return hash2(x, z, seed + 74) < 0.3 ? B.mossy : B.stone;
  }
  return B.grass;
}

function isCave(seed: number, x: number, y: number, z: number): boolean {
  const a = Math.abs(noise3(x / 20, y / 13, z / 20, seed + 81) - 0.5);
  if (a < 0.065 && Math.abs(noise3(x / 20 + 31.7, y / 13 + 11.1, z / 20 - 17.3, seed + 89) - 0.5) < 0.065) return true;
  return y < 15 && noise3(x / 30, y / 16, z / 30, seed + 97) > 0.8;
}

/** How much forest a place is, from 0 for open meadow to 1 for deep forest. */
export function forestAt(seed: number, x: number, z: number): number {
  return smoothstep(0.5, 0.64, fbm2(x / 130, z / 130, seed + 103, 2));
}

type TreeKind = 0 | 1 | 2; // oak, birch, pine

/** The tree that grows in this 5 by 5 cell of the tree grid, or -1. It writes the trunk position to `at`. */
export function treeInCell(seed: number, gx: number, gz: number, at: { x: number; z: number; h: number }): TreeKind | -1 {
  const x = gx * 5 + Math.floor(hash2(gx, gz, seed + 101) * 5), z = gz * 5 + Math.floor(hash2(gx, gz, seed + 102) * 5);
  if (!treeAllowed(x, z)) return -1;
  const forest = forestAt(seed, x, z);
  if (hash2(gx, gz, seed + 104) > 0.03 + 0.5 * forest) return -1;
  const h = groundHeight(seed, x, z);
  const hills = hillMask(seed, x, z);
  if (h <= WATER_LEVEL + 1 || topBlock(seed, x, z, h, hills, shaped(x, z)) !== B.grass) return -1;
  if (hills > 0.45 && isCave(seed, x, h - 1, z)) return -1;
  at.x = x; at.z = z; at.h = h;
  if (h >= 27) return 2;
  return hash2(gx, gz, seed + 105) < 0.3 ? 1 : 0;
}

/**
 * Fills `blocks` with the land of chunk (cx, cz). It writes every cell, so the array may be reused.
 */
export function generateChunk(seed: number, cx: number, cz: number, blocks: Uint8Array): void {
  const ox = cx * CHUNK, oz = cz * CHUNK;
  blocks.fill(0);
  // Most chunks lie outside the region plan and never ask it anything.
  const region = chunkInBounds(ox, oz, CHUNK);

  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const x = ox + lx, z = oz + lz;
      const h = groundHeight(seed, x, z);
      const hills = hillMask(seed, x, z);
      const plain = region && shaped(x, z);
      const path = region && onPath(x, z);
      // A path is dirt on dry land. Where the land dips to the water line it is a plank bridge instead.
      const top = path && h > BRIDGE_Y ? B.path : topBlock(seed, x, z, h, hills, plain);
      const under = top === B.grass || top === B.path ? B.dirt : top;
      const base = cellIndex(lx, 0, lz);
      for (let y = 0; y < h; y++) blocks[base + y] = y === h - 1 ? top : y >= h - 4 ? under : B.stone;
      for (let y = h; y < WATER_LEVEL; y++) blocks[base + y] = B.water;
      if (path && h <= BRIDGE_Y) blocks[base + BRIDGE_Y] = B.plank;

      // Caves run under the hills only, away from water and from ground the region plan shaped. Where
      // the hill is high they may break the surface, which makes a cave mouth.
      if (hills > 0.25 && h > WATER_LEVEL + 2 && !plain) {
        const roof = hills > 0.45 && h > 24 ? h - 1 : h - 4;
        let wasOpen = false;
        for (let y = 3; y <= roof; y++) {
          const open = isCave(seed, x, y, z);
          if (open) blocks[base + y] = !wasOpen && hash3(x, y, z, seed + 111) < 0.012 ? B.lume : 0;
          wasOpen = open;
        }
      }
    }
  }

  const put = (x: number, y: number, z: number, id: number, onlyAir = false): void => {
    const lx = x - ox, lz = z - oz;
    if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= HEIGHT) return;
    const i = cellIndex(lx, y, lz);
    if (!onlyAir || blocks[i] === 0) blocks[i] = id;
  };

  // Collision roots use the same deterministic placements as the tree system.
  for (const t of treesInArea(seed, ox, oz, ox + CHUNK, oz + CHUNK)) {
    put(t.x, t.y, t.z, blockId('barrier'));
    put(t.x, t.y + 1, t.z, blockId('barrier'));
  }
  if (region) stampStructures(ox, oz, CHUNK, put);
}

export interface TreePlacement { x: number; y: number; z: number; kind: 'oak' | 'birch' | 'pine'; size: number; variant: number }
export function treesInArea(seed: number, x0: number, z0: number, x1: number, z1: number): TreePlacement[] {
  const result: TreePlacement[] = [];
  const at = { x: 0, z: 0, h: 0 };
  for (let gx = Math.floor(x0 / 5); gx <= Math.floor((x1 - 1) / 5); gx++) for (let gz = Math.floor(z0 / 5); gz <= Math.floor((z1 - 1) / 5); gz++) {
    const kind = treeInCell(seed, gx, gz, at);
    if (kind < 0 || at.x < x0 || at.x >= x1 || at.z < z0 || at.z >= z1) continue;
    const r = hash2(gx, gz, seed + 106);
    result.push({ x: at.x, y: at.h, z: at.z, kind: kind === 2 ? 'pine' : kind === 1 ? 'birch' : 'oak', size: .85 + r * .3, variant: Math.floor(r * 3) });
  }
  for (const t of REGION.trees) if (t.x >= x0 && t.x < x1 && t.z >= z0 && t.z < z1) result.push({ x: t.x, y: groundHeight(seed,t.x,t.z), z: t.z, kind: t.kind, size: .85 + t.size * .3, variant: Math.min(2,Math.floor(t.size * 3)) });
  return result;
}
