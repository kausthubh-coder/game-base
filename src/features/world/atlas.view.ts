// The block textures. Until painted tiles arrive, every 32 by 32 tile is drawn here in code onto
// one atlas canvas. When the asset manifest has a `blocks` entry, its tiles replace the drawn ones.
//
// The GPU does not get the atlas as one image. Each tile becomes one layer of an array texture, so
// a tile can repeat across a merged face and its mipmaps never bleed into the tile next to it.
import * as THREE from 'three';
import { BLOCKS, blockTileNames, naturalTileNames } from '../../content/blocks.ts';
import { TILE_TABLE_SIZE, type TileTable } from './mesh.sim.ts';
import { hash3 } from './noise.sim.ts';

export const TILE = 32;
const COLUMNS = 8;

/** One canvas of square tiles and where each named tile is on it. More than one cell means variants. */
export interface AtlasSource {
  canvas: HTMLCanvasElement;
  tile: number;
  cells: Map<string, [column: number, row: number][]>;
}

/** The `blocks` entry of `public/assets/manifest.json`. See docs/assets.md. */
export interface BlockAtlasEntry {
  tile: number;
  atlas: string;
  tiles: Record<string, [number, number][]>;
}

export interface BlockTextures {
  texture: THREE.DataArrayTexture;
  /** For the mesher: the layer and variant count of each face of each block. */
  table: TileTable;
  /** The atlas the layers were cut from, for swatches in a panel. */
  source: AtlasSource;
}

type RGB = readonly [number, number, number];
type Pixel = readonly [number, number, number] | readonly [number, number, number, number];
type Painter = (x: number, y: number, variant: number) => Pixel;

const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const pal = (...colors: number[]): RGB[] => colors.map(hex);
const mix = (a: Pixel, b: Pixel, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: Pixel, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 0.999 ? 0.999 : v);
const pick = (p: RGB[], v: number): RGB => p[Math.floor(clamp01(v) * p.length)];
const rnd = (x: number, y: number, seed: number): number => hash3(x, y, 0, seed);

/** Value noise that repeats every `period` cells, so a tile meets itself without a seam. */
function tnoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const m = (v: number): number => ((v % period) + period) % period;
  const a = rnd(m(xi), m(yi), seed), b = rnd(m(xi + 1), m(yi), seed), c = rnd(m(xi), m(yi + 1), seed), d = rnd(m(xi + 1), m(yi + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function tfbm(x: number, y: number, period: number, seed: number): number {
  return (tnoise(x, y, period, seed) * 4 + tnoise(x * 2, y * 2, period * 2, seed + 17) * 2 + tnoise(x * 4, y * 4, period * 4, seed + 34)) / 7;
}

/** Soft blotches of a few palette steps plus a little grain. Low contrast, so tiles do not shout. */
function mottled(p: RGB[], seed: number, contrast = 1.5, speck = 0.06): (x: number, y: number) => RGB {
  return (x, y) => {
    const v = (tfbm(x / 8, y / 8, 4, seed) - 0.5) * contrast + 0.5;
    const c = pick(p, v);
    const h = rnd(x, y, seed + 5);
    return h < speck ? mul(c, 0.86) : h > 1 - speck ? mul(c, 1.1) : c;
  };
}

const P = {
  grass: pal(0x55903c, 0x5f9b40, 0x68a545, 0x72ae4a, 0x7eb852),
  dirt: pal(0x6b4530, 0x7d5338, 0x8a5d3f, 0x966848),
  soil: pal(0x4e3324, 0x5a3b29, 0x66442f, 0x714c35),
  path: pal(0xa39480, 0xb3a38d, 0xc0b199, 0xccbea6),
  sand: pal(0xd0b983, 0xd9c48f, 0xe0cd9a, 0xe8d7a6),
  clay: pal(0x9a8f8c, 0xa69b97, 0xb1a7a2, 0xbbb2ad),
  stone: pal(0x746d88, 0x807993, 0x8b849d, 0x9790a8),
  brick: pal(0x8a8494, 0x9993a1, 0xa7a1ae, 0xb4afb9),
  moss: pal(0x4a8a3a, 0x5a9c42, 0x6aae4a),
  oak: pal(0x7a5230, 0x8a5f38, 0x9a6b3e, 0xa87848),
  bark: pal(0x4d3524, 0x5a3e2a, 0x674830, 0x735238),
  birch: pal(0xcfc9b8, 0xdbd6c7, 0xe6e2d5),
  pine: pal(0x3d2a1e, 0x483223, 0x533a29, 0x5e422e),
  thatch: pal(0xa8873a, 0xb99746, 0xc8a752, 0xd6b862),
  shingle: pal(0x2f6f7c, 0x37828a, 0x419596, 0x52a8a2),
  plaster: pal(0xe6d6b2, 0xece0c0, 0xf2e7cb),
  leaves: pal(0x346a30, 0x3f7c36, 0x4a8c3c, 0x589c44, 0x69ab4e),
  needles: pal(0x1f4a38, 0x285a42, 0x316a4c, 0x3d7c58),
  water: pal(0x2f72b8, 0x3980c4, 0x448ed0),
  lume: pal(0x1f9c90, 0x2fc4b0, 0x4fe0c8, 0x9af5e4),
};

function rings(x: number, y: number, wood: RGB[], bark: RGB[]): RGB {
  const d = Math.hypot(x - 15.5, y - 15.5) + tnoise(x / 6, y / 6, 6, 3) * 2;
  if (Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)) > 13.5) return pick(bark, rnd(x >> 1, y >> 1, 9));
  const c = pick(wood, 0.35 + ((d * 0.9) % 3) / 6 + rnd(x, y, 4) * 0.12);
  return d < 1.5 ? mul(c, 0.8) : c;
}

function barkSide(p: RGB[], seed: number): Painter {
  return (x, y) => {
    const streak = tnoise(x / 2.5, y / 12, 13, seed);
    const c = pick(p, streak * 0.9 + rnd(x, y, seed + 1) * 0.15);
    return tnoise(x / 2, y / 9, 16, seed + 2) > 0.74 ? mul(c, 0.78) : c;
  };
}

/** Rounded cobbles that tile. */
function cobble(x: number, y: number, p: RGB[], cells: number, seed: number): RGB {
  let d1 = 99, d2 = 99, id = 0;
  for (let j = -1; j <= cells; j++) {
    for (let i = -1; i <= cells; i++) {
      const wi = ((i % cells) + cells) % cells, wj = ((j % cells) + cells) % cells;
      const px = (i + 0.25 + rnd(wi, wj, seed) * 0.5) * (TILE / cells), py = (j + 0.25 + rnd(wi, wj, seed + 1) * 0.5) * (TILE / cells);
      const d = Math.max(Math.abs(x - px), Math.abs(y - py)) * 0.55 + Math.hypot(x - px, y - py) * 0.5;
      if (d < d1) { d2 = d1; d1 = d; id = rnd(wi, wj, seed + 2); } else if (d < d2) d2 = d;
    }
  }
  if (d2 - d1 < 1.4) return mul(p[0], 0.72);
  const c = pick(p, id);
  return d2 - d1 < 2.8 ? mul(c, 0.92) : rnd(x, y, seed + 3) < 0.07 ? mul(c, 0.9) : c;
}

const dirt = (x: number, y: number, v: number): RGB => {
  const c = mottled(P.dirt, 21 + v * 7)(x, y);
  return rnd(x >> 1, y >> 1, 31 + v) > 0.955 ? mix(c, P.stone[2], 0.6) : c;
};

const stone = (x: number, y: number, v: number): RGB => {
  const c = mottled(P.stone, 41 + v * 7, 1.6)(x, y);
  return Math.abs(tnoise(x / 5, y / 5, 6, 77 + v) - 0.5) < 0.014 ? mul(c, 0.78) : c;
};

const PAINTERS: Record<string, Painter> = {
  grass_top: (x, y, v) => {
    const c = pick(P.grass, (tfbm(x / 8, y / 8, 4, 11 + v * 7) - 0.5) * 1.5 + 0.5);
    const h = rnd(x, y, 3 + v);
    if (h < 0.08) return P.grass[0];
    if (h > 0.93) return P.grass[4];
    return rnd(x, y >> 1, 9 + v) > 0.965 ? mix(c, hex(0xd9e86a), 0.45) : c;
  },
  grass_side: (x, y, v) => {
    const fringe = 5 + Math.floor(tnoise(x / 4, 0, 8, 4 + v) * 5) + (rnd(x, 0, 2 + v) > 0.7 ? 2 : 0);
    if (y < fringe) {
      if (y === 0) return P.grass[4];
      return y >= fringe - 1 ? P.grass[0] : pick(P.grass, 0.8 - (y / fringe) * 0.6 + rnd(x, y, 8) * 0.2);
    }
    const d = dirt(x, y, v);
    return y === fringe ? mul(d, 0.78) : d;
  },
  dirt,
  tilled_top: (x, y) => {
    const c = mottled(P.soil, 51, 1.2)(x, y);
    const row = y % 8;
    return row < 2 ? mul(c, 0.74) : row === 2 ? mul(c, 1.12) : c;
  },
  path_top: (x, y) => {
    const c = mottled(P.path, 61, 1.3, 0.04)(x, y);
    const pebble = tnoise(x / 3, y / 3, 11, 63);
    return pebble > 0.8 ? mul(c, 0.86) : pebble < 0.16 ? mul(c, 1.06) : c;
  },
  path_side: (x, y) => (y < 4 ? mul(mottled(P.path, 61, 1.3, 0.04)(x, y), y === 3 ? 0.8 : 1) : dirt(x, y, 0)),
  sand: (x, y, v) => {
    const c = mottled(P.sand, 71 + v * 7, 1.1, 0.05)(x, y);
    return tnoise(x / 9, y / 3 + tnoise(x / 6, y / 6, 6, 73) * 2, 11, 74 + v) > 0.72 ? mul(c, 0.95) : c;
  },
  clay: (x, y, v) => mottled(P.clay, 81 + v * 7, 1.2, 0.04)(x, y),
  stone,
  mossy_stone: (x, y, v) => {
    const s = stone(x, y, v);
    const m = tfbm(x / 8, y / 8, 4, 91 + v * 7);
    return m > 0.52 ? pick(P.moss, (m - 0.52) * 5 + rnd(x, y, 92) * 0.3) : m > 0.48 ? mix(s, P.moss[0], 0.5) : s;
  },
  cobble: (x, y) => cobble(x, y, P.stone, 4, 101),
  stone_brick: (x, y) => {
    const row = y >> 3, bx = (x + (row & 1) * 8) & 15, by = y & 7;
    if (by === 7 || bx === 15) return mul(P.brick[0], 0.72);
    const c = pick(P.brick, 0.3 + rnd(((x + (row & 1) * 8) & 31) >> 4, row, 111) * 0.6 + rnd(x, y, 112) * 0.1);
    return by === 0 || bx === 0 ? mul(c, 1.07) : by === 6 || bx === 14 ? mul(c, 0.92) : c;
  },
  oak_log_side: barkSide(P.bark, 121),
  oak_log_top: (x, y) => rings(x, y, P.oak, P.bark),
  oak_plank: (x, y) => {
    const board = y >> 3, by = y & 7;
    if (by === 7) return mul(P.oak[0], 0.7);
    const c = pick(P.oak, 0.25 + rnd(board, 0, 131) * 0.4 + tnoise(x / 10, y / 1.5, 3, 132 + board) * 0.3);
    return (x + board * 11) % 32 === 0 ? mul(c, 0.75) : by === 0 ? mul(c, 1.06) : c;
  },
  birch_log_side: (x, y) => {
    const c = pick(P.birch, tnoise(x / 3, y / 12, 10, 141) + rnd(x, y, 142) * 0.1);
    return tnoise(x / 5, y / 1.6, 20, 143) > 0.82 ? hex(0x4a443c) : c;
  },
  birch_log_top: (x, y) => rings(x, y, pal(0xd9c9a0, 0xe2d4ae, 0xebdfbc), P.birch),
  pine_log_side: barkSide(P.pine, 151),
  pine_log_top: (x, y) => rings(x, y, pal(0x8a6238, 0x996f40, 0xa87c4a), P.pine),
  thatch: (x, y) => {
    const row = y & 7;
    const c = pick(P.thatch, tnoise(x / 1.6, y / 9, 20, 161) * 0.8 + rnd(x, y, 162) * 0.2);
    return row === 7 ? mul(c, 0.7) : row === 0 ? mul(c, 1.08) : c;
  },
  shingle: (x, y) => {
    const row = y >> 3, sx = (x + (row & 1) * 4) & 7, sy = y & 7;
    const c = pick(P.shingle, 0.2 + rnd((x + (row & 1) * 4) >> 3, row, 171) * 0.7);
    const round = Math.hypot(sx - 3.5, sy - 1.5);
    return sy === 0 ? mul(c, 0.68) : round > 5.2 ? mul(c, 0.72) : sy >= 5 ? mul(c, 1.08) : c;
  },
  plaster: (x, y) => {
    const c = pick(P.plaster, tfbm(x / 10, y / 10, 3, 181));
    return rnd(x, y, 182) < 0.03 ? mul(c, 0.93) : c;
  },
  glass: (x, y) => {
    if (x < 2 || y < 2 || x > 29 || y > 29) return hex(0x5b6470);
    if (x === 2 || y === 2) return hex(0x3f4750);
    const glint = x + y;
    return glint === 22 || glint === 23 || glint === 28 ? [220, 240, 250, 255] : [190, 225, 240, 0];
  },
  oak_leaves: (x, y, v) => {
    const blob = tfbm(x / 6, y / 6, 5, 191 + v * 7);
    return blob < 0.4 ? mul(P.leaves[0], 0.8) : pick(P.leaves, (blob - 0.4) * 2.6 + rnd(x, y, 192 + v) * 0.25);
  },
  pine_needles: (x, y, v) => {
    const blob = tfbm(x / 6, y / 6, 5, 201 + v * 7);
    const c = pick(P.needles, blob * 1.2 - 0.1 + rnd(x >> 1, y, 202 + v) * 0.3);
    return blob < 0.38 ? mul(c, 0.75) : c;
  },
  water: (x, y) => {
    const wave = tnoise(x / 8, y / 3 + tnoise(x / 8, y / 8, 4, 211) * 3, 4, 212);
    return wave > 0.74 ? mix(P.water[2], hex(0xb8e0f4), 0.5) : pick(P.water, wave * 1.2);
  },
  lume_crystal: (x, y) => {
    let d1 = 99, d2 = 99, id = 0;
    for (let i = 0; i < 9; i++) {
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const d = Math.abs(x - rnd(i, 0, 221) * TILE - ox * TILE) + Math.abs(y - rnd(i, 1, 221) * TILE - oy * TILE);
        if (d < d1) { d2 = d1; d1 = d; id = rnd(i, 2, 221); } else if (d < d2) d2 = d;
      }
    }
    return d2 - d1 < 1.5 ? P.lume[3] : pick(P.lume, id * 0.75);
  },
  lamp_side: (x, y) => {
    const edge = Math.min(x, y, 31 - x, 31 - y);
    if (edge < 3 || x === 15 || x === 16) return edge === 2 ? hex(0x2c2732) : hex(0x3f3846);
    return mix(hex(0xffc860), hex(0xfff0bc), clamp01(1.25 - Math.hypot(x - 15.5, y - 15.5) / 13));
  },
  lamp_top: (x, y) => {
    const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5));
    return d < 4 ? hex(0x5a5262) : d > 13 ? hex(0x2c2732) : pick(pal(0x3a3340, 0x443c4b), rnd(x, y, 231));
  },
};

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('this browser cannot draw on a 2D canvas');
  return ctx;
}

/** Draws every tile the blocks name onto one atlas canvas. Natural tiles get three variants. */
export function drawBlockAtlas(): AtlasSource {
  const natural = naturalTileNames();
  const names = blockTileNames();
  const total = names.reduce((n, name) => n + (natural.has(name) ? 3 : 1), 0);
  const canvas = newCanvas(COLUMNS * TILE, Math.ceil(total / COLUMNS) * TILE);
  const ctx = context(canvas);
  const cells = new Map<string, [number, number][]>();
  const image = ctx.createImageData(TILE, TILE);
  let next = 0;
  for (const name of names) {
    const def = BLOCKS.find((b) => b.tiles.top === name || b.tiles.side === name || b.tiles.bottom === name);
    const flat = hex(def ? def.color : 0xff00ff);
    const paint: Painter = PAINTERS[name] ?? (() => flat);
    const list: [number, number][] = [];
    for (let v = 0; v < (natural.has(name) ? 3 : 1); v++) {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const p = paint(x, y, v), i = (y * TILE + x) * 4;
          image.data[i] = p[0]; image.data[i + 1] = p[1]; image.data[i + 2] = p[2]; image.data[i + 3] = p.length > 3 ? p[3]! : 255;
        }
      }
      const cell: [number, number] = [next % COLUMNS, Math.floor(next / COLUMNS)];
      ctx.putImageData(image, cell[0] * TILE, cell[1] * TILE);
      list.push(cell);
      next++;
    }
    cells.set(name, list);
  }
  return { canvas, tile: TILE, cells };
}

/**
 * Loads the painted atlas named by the manifest's `blocks` entry. A tile the painted atlas does not
 * have keeps its drawn version, so a half-finished atlas still gives a whole world.
 */
export async function loadBlockAtlas(entry: BlockAtlasEntry, assetsUrl: string, drawn: AtlasSource = drawBlockAtlas()): Promise<AtlasSource> {
  const image = new Image();
  image.src = entry.atlas.startsWith('data:') ? entry.atlas : assetsUrl + entry.atlas;
  await image.decode();
  const names = blockTileNames();
  const count = names.reduce((n, name) => n + (entry.tiles[name]?.length ?? drawn.cells.get(name)?.length ?? 0), 0);
  const canvas = newCanvas(COLUMNS * TILE, Math.ceil(count / COLUMNS) * TILE);
  const ctx = context(canvas);
  ctx.imageSmoothingEnabled = false;
  const cells = new Map<string, [number, number][]>();
  let next = 0;
  for (const name of names) {
    const painted = entry.tiles[name];
    const from = painted ?? drawn.cells.get(name) ?? [];
    const list: [number, number][] = [];
    for (const [column, row] of from) {
      const cell: [number, number] = [next % COLUMNS, Math.floor(next / COLUMNS)];
      const size = painted ? entry.tile : drawn.tile;
      ctx.drawImage(painted ? image : drawn.canvas, column * size, row * size, size, size, cell[0] * TILE, cell[1] * TILE, TILE, TILE);
      list.push(cell);
      next++;
    }
    cells.set(name, list);
  }
  return { canvas, tile: TILE, cells };
}

/** Cuts an atlas into the array texture the terrain material reads, and fills the mesher's tile table. */
export function buildBlockTextures(source: AtlasSource): BlockTextures {
  const ctx = context(source.canvas);
  const layers = [...source.cells.values()].reduce((n, list) => n + list.length, 0);
  if (layers > 255) throw new Error(`the block atlas has ${layers} tiles, and the mesher can address 255`);
  const data = new Uint8Array(layers * TILE * TILE * 4);
  const first = new Map<string, [layer: number, variants: number]>();
  let layer = 0;
  for (const [name, list] of source.cells) {
    first.set(name, [layer, Math.min(list.length, 3)]);
    for (const [column, row] of list) {
      const pixels = ctx.getImageData(column * TILE, row * TILE, TILE, TILE).data;
      // Texture rows run bottom to top, canvas rows top to bottom.
      for (let y = 0; y < TILE; y++) data.set(pixels.subarray((TILE - 1 - y) * TILE * 4, (TILE - y) * TILE * 4), (layer * TILE + y) * TILE * 4);
      layer++;
    }
  }

  const texture = new THREE.DataArrayTexture(data, TILE, TILE, layers);
  texture.format = THREE.RGBAFormat;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  const table = new Uint8Array(TILE_TABLE_SIZE);
  for (const b of BLOCKS) {
    [b.tiles.top, b.tiles.side, b.tiles.bottom].forEach((name, group) => {
      const found = first.get(name);
      table[b.id * 6 + group * 2] = found ? found[0] : 0;
      table[b.id * 6 + group * 2 + 1] = found ? found[1] : 1;
    });
  }
  return { texture, table, source };
}
