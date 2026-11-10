// Terrain from a seed: meadow, low hills, a river, ponds, forest and caves. The same seed always gives
// the same land, chunk by chunk, in any order. The start site (a small house and a cave mouth next to
// the spawn point) is stamped at the origin so a new world shows the cutaway at once.
import { blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import { CHUNK, HEIGHT, cellIndex } from './chunk.sim.ts';
import { clamp, fbm2, hash2, hash3, noise3, smoothstep } from './noise.sim.ts';

/** Water fills every open cell below this y. */
export const WATER_LEVEL = 18;

const B = {
  grass: blockId('grass'), dirt: blockId('dirt'), tilled: blockId('tilled_soil'), path: blockId('path'),
  sand: blockId('sand'), clay: blockId('clay'), stone: blockId('stone'), mossy: blockId('mossy_stone'),
  cobble: blockId('cobble'), brick: blockId('stone_brick'), oakLog: blockId('oak_log'), plank: blockId('oak_plank'),
  birchLog: blockId('birch_log'), pineLog: blockId('pine_log'), thatch: blockId('thatch'), plaster: blockId('plaster'),
  glass: blockId('glass'), leaves: blockId('oak_leaves'), needles: blockId('pine_needles'), water: blockId('water'),
  lume: blockId('lume_crystal'), lamp: blockId('lamp'),
};

// The start site. Everything is in block coordinates.
const SITE = {
  x: 2, z: -8, flat: 24, blend: 38, ground: 20,
  hill: { x: 16.5, z: -11.5, radius: 14, core: 4, rise: 12 },
  pond: { x: -8, z: 7, radius: 6.5 },
  house: { x0: -10, x1: -4, z0: -13, z1: -8, door: -7 },
  tunnel: { x0: 5, x1: 12, z0: -10, z1: -8, y0: 20, y1: 22 },
  chamber: { x0: 13, x1: 20, z0: -15, z1: -8, y0: 20, y1: 23 },
};

/** Where a new hero stands: on the path in front of the house door. */
export function spawnPoint(): Vec3 {
  return { x: SITE.house.door + 0.5, y: SITE.ground, z: SITE.house.z1 + 3.5 };
}

/** Places to stand that a demo or a test can jump to. */
export const LANDMARKS = {
  house: { x: -6.5, y: SITE.ground, z: -10.5 },
  cave: { x: 16.5, y: SITE.ground, z: -11.5 },
  caveMouth: { x: 3.5, y: SITE.ground, z: -8.5 },
  pond: { x: -8.5, y: WATER_LEVEL, z: 7.5 },
} as const;

const siteWeight = (x: number, z: number): number => smoothstep(SITE.blend, SITE.flat, Math.hypot(x - SITE.x, z - SITE.z));

function siteHeight(x: number, z: number): number {
  const hill = SITE.hill.rise * smoothstep(SITE.hill.radius, SITE.hill.core, Math.hypot(x - SITE.hill.x, z - SITE.hill.z));
  const pond = smoothstep(SITE.pond.radius, SITE.pond.radius * 0.45, Math.hypot(x - SITE.pond.x, z - SITE.pond.z));
  return SITE.ground + hill + (15.2 - SITE.ground) * pond;
}

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
  const w = siteWeight(x, z);
  const natural = w < 1 ? naturalHeight(seed, x, z, hillMask(seed, x, z)) : 0;
  const h = natural + (siteHeight(x, z) - natural) * w;
  return clamp(Math.floor(h + 0.5), 2, HEIGHT - 14);
}

function topBlock(seed: number, x: number, z: number, h: number, hills: number): number {
  if (h <= WATER_LEVEL) return hash2(x >> 2, z >> 2, seed + 71) > 0.62 ? B.clay : B.sand;
  if (h <= WATER_LEVEL + 1) return B.sand;
  if (hills > 0.4 && siteWeight(x, z) === 0) {
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

type TreeKind = 0 | 1 | 2; // oak, birch, pine

/** The tree that grows in this 5 by 5 cell of the tree grid, or -1. It writes the trunk position to `at`. */
function treeInCell(seed: number, gx: number, gz: number, at: { x: number; z: number; h: number }): TreeKind | -1 {
  const x = gx * 5 + Math.floor(hash2(gx, gz, seed + 101) * 5), z = gz * 5 + Math.floor(hash2(gx, gz, seed + 102) * 5);
  if (Math.hypot(x - SITE.x, z - SITE.z) < SITE.flat + 2) return -1;
  const forest = smoothstep(0.5, 0.64, fbm2(x / 130, z / 130, seed + 103, 2));
  if (hash2(gx, gz, seed + 104) > 0.03 + 0.5 * forest) return -1;
  const h = groundHeight(seed, x, z);
  const hills = hillMask(seed, x, z);
  if (h <= WATER_LEVEL + 1 || topBlock(seed, x, z, h, hills) !== B.grass) return -1;
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

  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const x = ox + lx, z = oz + lz;
      const h = groundHeight(seed, x, z);
      const hills = hillMask(seed, x, z);
      const top = topBlock(seed, x, z, h, hills);
      const under = top === B.grass ? B.dirt : top;
      const base = cellIndex(lx, 0, lz);
      for (let y = 0; y < h; y++) blocks[base + y] = y === h - 1 ? top : y >= h - 4 ? under : B.stone;
      for (let y = h; y < WATER_LEVEL; y++) blocks[base + y] = B.water;

      // Caves run under the hills only, away from water and from the start site. Where the hill is
      // high they may break the surface, which makes a cave mouth.
      if (hills > 0.25 && h > WATER_LEVEL + 2 && siteWeight(x, z) === 0) {
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

  if (ox < SITE.x + SITE.blend && ox + CHUNK > SITE.x - SITE.blend && oz < SITE.z + SITE.blend && oz + CHUNK > SITE.z - SITE.blend) {
    stampSite(put);
  }

  // Trees. A canopy reaches three blocks out, so trees rooted in the cells around the chunk count too.
  const at = { x: 0, z: 0, h: 0 };
  const g0x = Math.floor((ox - 3) / 5), g1x = Math.floor((ox + CHUNK + 2) / 5);
  const g0z = Math.floor((oz - 3) / 5), g1z = Math.floor((oz + CHUNK + 2) / 5);
  for (let gx = g0x; gx <= g1x; gx++) {
    for (let gz = g0z; gz <= g1z; gz++) {
      const kind = treeInCell(seed, gx, gz, at);
      if (kind >= 0) stampTree(put, kind as TreeKind, at.x, at.h, at.z, hash2(gx, gz, seed + 106));
    }
  }
}

type Put = (x: number, y: number, z: number, id: number, onlyAir?: boolean) => void;

function stampTree(put: Put, kind: TreeKind, x: number, y: number, z: number, r: number): void {
  if (kind === 2) {
    const trunk = 6 + Math.floor(r * 3);
    for (let i = 0; i < trunk; i++) put(x, y + i, z, B.pineLog);
    for (let i = 2; i <= trunk + 1; i++) {
      const fromTop = trunk + 1 - i;
      const radius = fromTop === 0 ? 0 : fromTop <= 3 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          put(x + dx, y + i, z + dz, B.needles, true);
        }
      }
    }
    return;
  }
  const trunk = (kind === 1 ? 5 : 4) + Math.floor(r * 2);
  for (let i = 0; i < trunk; i++) put(x, y + i, z, kind === 1 ? B.birchLog : B.oakLog);
  const wide = kind === 1 ? 1 : 2;
  for (let i = trunk - 2; i <= trunk + 1; i++) {
    const radius = i >= trunk ? 1 : wide + (kind === 1 && i === trunk - 1 ? 1 : 0);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const corner = Math.abs(dx) === radius && Math.abs(dz) === radius;
        if (corner && (radius === 1 ? i > trunk : hash3(x + dx, y + i, z + dz, 7) < 0.6)) continue;
        put(x + dx, y + i, z + dz, B.leaves, true);
      }
    }
  }
}

function stampSite(put: Put): void {
  const g = SITE.ground;
  const { x0, x1, z0, z1, door } = SITE.house;

  // The house: cobble footing, plank floor, plaster walls with log corners, glass, a thatch gable roof.
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const edgeX = x === x0 || x === x1, edgeZ = z === z0 || z === z1;
      put(x, g - 1, z, edgeX || edgeZ ? B.cobble : B.plank);
      if (!edgeX && !edgeZ) continue;
      for (let y = g; y < g + 3; y++) {
        let id = edgeX && edgeZ ? B.oakLog : B.plaster;
        const pane = y === g + 1 && ((edgeZ && (x === x0 + 2 || x === x1 - 1)) || (edgeX && (z === z0 + 2 || z === z0 + 3)));
        if (pane) id = B.glass;
        if (z === z1 && x === door && y < g + 2) id = 0;
        put(x, y, z, id);
      }
    }
  }
  for (let k = 0; k < 4; k++) {
    const y = g + 3 + k, za = z0 - 1 + k, zb = z1 + 1 - k;
    for (let x = x0 - 1; x <= x1 + 1; x++) { put(x, y, za, B.thatch); put(x, y, zb, B.thatch); }
    for (let z = za + 1; z < zb; z++) { put(x0, y, z, B.plaster); put(x1, y, z, B.plaster); }
  }
  put(x0 + 1, g, z0 + 1, B.lamp);

  // A lamp post by the door, a path to the cave, a patch of tilled soil.
  put(door + 2, g, z1 + 1, B.oakLog); put(door + 2, g + 1, z1 + 1, B.oakLog); put(door + 2, g + 2, z1 + 1, B.lamp);
  for (let z = z1 + 1; z <= z1 + 4; z++) put(door, g - 1, z, B.path);
  for (let x = door; x <= 3; x++) put(x, g - 1, z1 + 4, B.path);
  for (let z = z1 - 1; z <= z1 + 4; z++) { put(3, g - 1, z, B.path); put(4, g - 1, z, B.path); }
  for (let x = -2; x <= 1; x++) for (let z = -13; z <= -11; z++) put(x, g - 1, z, B.tilled);

  // The cave: a stone brick arch, a tunnel into the hill, a chamber with lume crystals.
  const t = SITE.tunnel, c = SITE.chamber;
  for (let x = t.x0; x <= t.x1; x++) for (let z = t.z0; z <= t.z1; z++) for (let y = t.y0; y <= t.y1; y++) put(x, y, z, 0);
  for (let x = c.x0; x <= c.x1; x++) for (let z = c.z0; z <= c.z1; z++) for (let y = c.y0; y <= c.y1; y++) put(x, y, z, 0);
  for (let x = t.x0 + 1; x <= t.x1; x++) for (let z = t.z0; z <= t.z1; z++) put(x, g - 1, z, B.stone);
  for (let x = c.x0; x <= c.x1; x++) for (let z = c.z0; z <= c.z1; z++) put(x, g - 1, z, B.stone);
  for (let y = t.y0; y <= t.y1 + 1; y++) { put(t.x0, y, t.z0 - 1, B.brick); put(t.x0, y, t.z1 + 1, B.brick); }
  for (let z = t.z0 - 1; z <= t.z1 + 1; z++) put(t.x0, t.y1 + 1, z, B.brick);
  put(c.x0 + 1, c.y0, c.z0 + 1, B.lume); put(c.x1 - 1, c.y0, c.z1 - 2, B.lume); put(c.x1, c.y0 + 2, c.z0 + 3, B.lume);
  put(c.x0 + 3, c.y1 + 1, c.z0 + 4, B.lume);

  // Two trees for shade.
  stampTree(put, 0, -15, g, -12, 0.7);
  stampTree(put, 1, 0, g, 3, 0.2);
}
