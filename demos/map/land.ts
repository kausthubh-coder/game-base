// A small made-up land for the demo: 512 by 512 blocks of meadow, wood, hill, lake and river, with
// a village in the middle, a road and a mill. It is kept as one color per column, which is all the
// map needs, and it is flat, which is all the beam needs.
import type { Surface } from '../../src/engine/types.ts';
import type { WorldQuery } from '../../src/engine/world-query.ts';

export const LAND = 512;

const SEA = 0x2f6f9f;
const colors = new Uint32Array(LAND * LAND);
const surfaces = new Uint8Array(LAND * LAND);
const SURFACES: readonly Surface[] = ['grass', 'water', 'sand', 'stone', 'snow', 'dirt', 'wood', 'leaves'];
const GRASS = 0, WATER = 1, SAND = 2, STONE = 3, SNOW = 4, DIRT = 5, WOOD = 6, LEAVES = 7;

function hash(x: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise from 0 to 1: random values on a grid of `size` blocks, eased between. */
function noise(x: number, z: number, size: number, seed: number): number {
  const gx = Math.floor(x / size), gz = Math.floor(z / size);
  const fx = x / size - gx, fz = z / size - gz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(gx, gz, seed), b = hash(gx + 1, gz, seed), c = hash(gx, gz + 1, seed), d = hash(gx + 1, gz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

const mix = (a: number, b: number, t: number): number => {
  const ch = (shift: number): number => Math.round(((a >> shift) & 0xff) + (((b >> shift) & 0xff) - ((a >> shift) & 0xff)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export const PLACES = {
  spawn: { x: 256.5, z: 266.5 },
  bakery: { x: 263.5, z: 252.5 },
  odo: { x: 263.5, z: 256.5 },
  juniper: { x: 246.5, z: 262.5 },
  waystone: { x: 272.5, z: 270.5 },
  mill: { x: 338.5, z: 186.5 },
  gate: { x: 96.5, z: 120.5 },
  vault: { x: 420.5, z: 400.5 },
};

/** How far a point is from the road that runs from the village to the mill and west to the gate. */
function roadDistance(x: number, z: number): number {
  const segment = (ax: number, az: number, bx: number, bz: number): number => {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
  };
  const wobble = (noise(x, z, 24, 9) - 0.5) * 5;
  return Math.min(
    segment(256, 262, 300, 226), segment(300, 226, PLACES.mill.x, PLACES.mill.z + 6),
    segment(256, 262, 180, 250), segment(180, 250, PLACES.gate.x, PLACES.gate.z),
    segment(256, 262, 262, 330),
  ) + wobble;
}

function build(): void {
  for (let z = 0; z < LAND; z++) {
    for (let x = 0; x < LAND; x++) {
      const i = z * LAND + x;
      // An island: high in the middle, falling into the sea at the edges.
      const edge = Math.hypot(x - LAND / 2, z - LAND / 2) / (LAND / 2);
      const village = Math.hypot(x - 256, z - 260);
      // Hills rise in the north. Around the village the ground is kept low and even.
      const hills = Math.exp(-(((x - 210) / 90) ** 2 + ((z - 105) / 55) ** 2)) * 0.34;
      let high = noise(x, z, 96, 1) * 0.42 + noise(x, z, 40, 2) * 0.22 + noise(x, z, 14, 3) * 0.1 - edge * edge * 0.6 + 0.2 + hills;
      if (village < 70) high = high + (Math.min(0.5, Math.max(0.32, high)) - high) * Math.min(1, (70 - village) / 30);
      const wet = noise(x, z, 70, 4) * 0.7 + noise(x, z, 22, 5) * 0.3;
      const grain = hash(x, z, 6);
      // A river from the northern hills past the mill down to a lake south-east of the village.
      const riverX = 352 + Math.sin(z / 37) * 22 + Math.sin(z / 11) * 4;
      const river = z > 60 && z < 330 && Math.abs(x - riverX) < 3.2 + noise(x, z, 30, 7) * 2;
      const lake = Math.hypot((x - 356) / 1.5, z - 348) < 30 + noise(x, z, 18, 8) * 10;
      const road = roadDistance(x, z);

      let color: number, surface = GRASS;
      if (high < 0.2) {
        color = mix(0x245f93, SEA, Math.max(0, Math.min(1, high / 0.2)));
        surface = WATER;
      } else if (river || lake) {
        color = mix(0x3f8fc0, 0x58a9d2, grain * 0.5);
        surface = WATER;
      } else if (high < 0.235) {
        color = mix(0xe3d29a, 0xd6c184, grain);
        surface = SAND;
      } else if (road < 1.6) {
        color = mix(0xb89a68, 0xa8895a, grain);
        surface = DIRT;
      } else if (village < 15) {
        color = mix(0xa9a294, 0x989080, grain);
        surface = STONE;
      } else if (high > 0.8) {
        color = mix(0xf2f4f6, 0xdfe6ec, grain);
        surface = SNOW;
      } else if (high > 0.69) {
        color = mix(0x8d8f8c, 0x7a7d7b, grain);
        surface = STONE;
      } else if (wet > 0.56 && village > 34 && road > 4) {
        // Woods: dark, with lighter crowns scattered through them.
        color = hash(x >> 1, z >> 1, 10) > 0.72 ? 0x3f7d3a : mix(0x2f6a33, 0x275c2d, grain);
        surface = LEAVES;
      } else {
        color = mix(mix(0x7fb850, 0x6aa646, wet), 0x8cc25a, grain * 0.35);
      }
      colors[i] = color;
      surfaces[i] = surface;
    }
  }

  const box = (cx: number, cz: number, w: number, d: number, color: number, surface: number, speckle = 0): void => {
    for (let z = Math.floor(cz - d / 2); z < cz + d / 2; z++) {
      for (let x = Math.floor(cx - w / 2); x < cx + w / 2; x++) {
        if (x < 0 || z < 0 || x >= LAND || z >= LAND) continue;
        colors[z * LAND + x] = speckle ? mix(color, 0x000000, hash(x, z, 11) * speckle) : color;
        surfaces[z * LAND + x] = surface;
      }
    }
  };
  // Wheat fields south of the village, and roofs.
  box(236, 300, 26, 18, 0xdcbf58, DIRT, 0.12);
  box(270, 304, 20, 22, 0xcfb24e, DIRT, 0.12);
  box(286, 280, 14, 12, 0x9ac25a, DIRT, 0.1);
  for (const house of HOUSES) box(house.x, house.z, house.w, house.d, house.roof, WOOD);
}

/** Houses, as boxes for the 3D scene and roofs on the map. */
export const HOUSES: readonly { x: number; z: number; w: number; d: number; h: number; roof: number; wall: number }[] = [
  { x: PLACES.bakery.x, z: PLACES.bakery.z - 2, w: 9, d: 7, h: 4, roof: 0xb5533c, wall: 0xe8d9b8 },
  { x: 244, z: 250, w: 7, d: 7, h: 3.5, roof: 0x3f8f8a, wall: 0xe2d3b0 },
  { x: 240, z: 270, w: 8, d: 6, h: 3.5, roof: 0xa8643a, wall: 0xd9c8a4 },
  { x: 272, z: 262, w: 6, d: 6, h: 3.2, roof: 0x7a5a9a, wall: 0xe8d9b8 },
  { x: 258, z: 244, w: 6, d: 5, h: 3, roof: 0xb5533c, wall: 0xd9c8a4 },
  { x: PLACES.mill.x - 5, z: PLACES.mill.z, w: 7, d: 9, h: 6, roof: 0x6b4a2e, wall: 0xcbb994 },
];

build();

// A patch of land that answers "not loaded yet", to show the map waiting for it.
let hidden: { x: number; z: number; size: number } | null = null;
export function hideLand(patch: { x: number; z: number; size: number } | null): void {
  hidden = patch;
}

/** The color of the top of a column, as 0xRRGGBB. Sea outside the land, and -1 for land that is hidden. */
export function colorAt(x: number, z: number): number {
  if (hidden && Math.abs(x - hidden.x) < hidden.size / 2 && Math.abs(z - hidden.z) < hidden.size / 2) return -1;
  if (x < 0 || z < 0 || x >= LAND || z >= LAND) return SEA;
  return colors[(z | 0) * LAND + (x | 0)];
}

/** True where the player can walk: on the land and not in water. */
export function walkable(x: number, z: number): boolean {
  if (x < 1 || z < 1 || x >= LAND - 1 || z >= LAND - 1) return false;
  const s = surfaces[Math.floor(z) * LAND + Math.floor(x)];
  return s !== WATER && s !== WOOD;
}

/** The land as the world the features ask questions of. It is flat. */
export const landWorld: WorldQuery = {
  heightAt: () => 0,
  surfaceAt: (x, z) => (x < 0 || z < 0 || x >= LAND || z >= LAND ? 'water' : SURFACES[surfaces[Math.floor(z) * LAND + Math.floor(x)]]),
  openSky: () => true,
  lightAt: () => 15,
};

/** Changes a patch of the land, to show the map redrawing part of itself. */
export function paintPatch(cx: number, cz: number, size: number, color: number): void {
  for (let z = Math.floor(cz - size / 2); z < cz + size / 2; z++) {
    for (let x = Math.floor(cx - size / 2); x < cx + size / 2; x++) {
      if (x >= 0 && z >= 0 && x < LAND && z < LAND) colors[z * LAND + x] = mix(color, 0x000000, hash(x, z, 12) * 0.1);
    }
  }
}

/** The whole land as a picture, for the ground in the 3D scene. */
export function landCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = LAND;
  const g = canvas.getContext('2d')!;
  const image = g.createImageData(LAND, LAND);
  const pixels = new Uint32Array(image.data.buffer);
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    pixels[i] = 0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff);
  }
  g.putImageData(image, 0, 0);
  return canvas;
}
