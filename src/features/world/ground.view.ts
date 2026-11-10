// The clean ground look, `?ground=clean`: the same one-metre blocks, drawn as painted land rather than a grid.
// Nothing here changes the blocks or the mesher. Two textures feed the terrain shader:
//
//   - Soft tiles: a copy of the atlas in which the natural ground tiles are blurred and their contrast pulled
//     toward their mean, filtered smoothly. The frozen atlas itself is not touched; built tiles such as planks,
//     bricks and roofs keep their pixels.
//   - The ground map: one texel per column around the hero, holding the column's top ground block, its
//     height and its color. The shader reads it to blend grass into paths across block edges, and to find
//     which edges of a top face drop away, so they get a rounded rim.
import * as THREE from 'three';
import { BLOCKS } from '../../content/blocks.ts';
import type { AtlasSource } from './atlas.view.ts';
import { CHUNK, HEIGHT, OPAQUE, cellIndex } from './chunk.sim.ts';
import type { World } from './world.sim.ts';

/** How the clean shader treats a tile, by its first layer. */
export const KIND_KEEP = 0, KIND_GRASS_TOP = 1, KIND_GRASS_SIDE = 2, KIND_EARTH = 3, KIND_ROCK = 4, KIND_COBBLE = 5, KIND_MOSS = 6;

const TILE_KIND: Readonly<Record<string, number>> = {
  grass_top: KIND_GRASS_TOP,
  grass_side: KIND_GRASS_SIDE,
  dirt: KIND_EARTH,
  path_top: KIND_EARTH,
  path_side: KIND_EARTH,
  sand: KIND_EARTH,
  clay: KIND_EARTH,
  stone: KIND_ROCK,
  mossy_stone: KIND_MOSS,
  cobble: KIND_COBBLE,
};

/** How much of a tile's own contrast survives, by kind. */
const KEEP_CONTRAST = [1, 0.35, 0.5, 0.4, 0.7, 0.7, 0.7];
/** The blur radius in texels, by kind. Cobble keeps its stones, so it is barely blurred. */
const BLUR = [0, 3, 2, 3, 1, 1, 1];

/** The most layers the shader looks a kind up for. A layer past it is kept as it is. */
export const MAX_LAYERS = 64;
/** The ground map covers this many columns each way, and wraps. */
export const GROUND_SIZE = 256;

export interface SoftTiles {
  texture: THREE.DataArrayTexture;
  /** Per layer: the kind of its tile, for the shader. */
  kinds: Float32Array;
  /** The first layer of the dirt tile, which the clean grass side shows under its lip. */
  dirtLayer: number;
}

/** Box blur that wraps, so the tile still meets itself without a seam. */
function blur(src: Float32Array, size: number, radius: number): Float32Array {
  if (radius <= 0) return src;
  let a: Float32Array = src, b: Float32Array = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    for (const horizontal of [true, false]) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let r = 0, g = 0, bl = 0;
          for (let k = -radius; k <= radius; k++) {
            const sx = horizontal ? (x + k + size) % size : x, sy = horizontal ? y : (y + k + size) % size;
            const i = (sy * size + sx) * 4;
            r += a[i]; g += a[i + 1]; bl += a[i + 2];
          }
          const o = (y * size + x) * 4, n = radius * 2 + 1;
          b[o] = r / n; b[o + 1] = g / n; b[o + 2] = bl / n; b[o + 3] = a[o + 3];
        }
      }
      [a, b] = [b, a];
    }
  }
  return a;
}

/** Makes the soft copy of the atlas. Its layers line up with the layers `buildBlockTextures` makes. */
export function buildSoftTiles(source: AtlasSource): SoftTiles {
  const size = source.tile;
  const ctx = source.canvas.getContext('2d', { willReadFrequently: true })!;
  const layers = [...source.cells.values()].reduce((n, list) => n + list.length, 0);
  const data = new Uint8Array(layers * size * size * 4);
  const kinds = new Float32Array(MAX_LAYERS);
  let layer = 0, dirtLayer = 0;
  for (const [name, list] of source.cells) {
    const kind = TILE_KIND[name] ?? KIND_KEEP;
    if (name === 'dirt') dirtLayer = layer;
    for (const [column, row] of list) {
      const pixels = ctx.getImageData(column * size, row * size, size, size).data;
      let out: ArrayLike<number> = pixels;
      if (kind !== KIND_KEEP) {
        const f = Float32Array.from(pixels);
        let mr = 0, mg = 0, mb = 0;
        for (let i = 0; i < f.length; i += 4) { mr += f[i]; mg += f[i + 1]; mb += f[i + 2]; }
        const n = f.length / 4;
        mr /= n; mg /= n; mb /= n;
        const soft = blur(f, size, BLUR[kind]);
        const keep = KEEP_CONTRAST[kind];
        for (let i = 0; i < soft.length; i += 4) {
          soft[i] = mr + (soft[i] - mr) * keep;
          soft[i + 1] = mg + (soft[i + 1] - mg) * keep;
          soft[i + 2] = mb + (soft[i + 2] - mb) * keep;
        }
        out = soft;
      }
      // Texture rows run bottom to top, canvas rows top to bottom.
      for (let y = 0; y < size; y++) {
        const from = (size - 1 - y) * size * 4, to = (layer * size + y) * size * 4;
        for (let i = 0; i < size * 4; i++) data[to + i] = out[from + i];
      }
      if (layer < MAX_LAYERS) kinds[layer] = kind;
      layer++;
    }
  }
  const texture = new THREE.DataArrayTexture(data, size, size, layers);
  texture.format = THREE.RGBAFormat;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return { texture, kinds, dirtLayer };
}

/** Blocks the ground map looks through to find the ground under them: trees and invisible barriers. */
const SEE_THROUGH = new Uint8Array(256);
/** The top block counts as grass for blending. */
const GRASSY = new Uint8Array(256);
for (const b of BLOCKS) {
  SEE_THROUGH[b.id] = b.key.endsWith('_log') || b.key.endsWith('_leaves') || b.key === 'pine_needles' || b.key === 'barrier' ? 1 : 0;
  GRASSY[b.id] = b.key === 'grass' ? 1 : 0;
}

export interface GroundMap {
  texture: THREE.DataTexture;
  /** Rewrites the columns of one chunk from the world. Call it when the chunk's mesh changes. */
  writeChunk(cx: number, cz: number): void;
  /** Sends what changed to the GPU. Call it once a frame. */
  upload(): void;
  dispose(): void;
}

/**
 * The ground map: per column, RGB is the mean color of the top ground tile, and A is the top's height times
 * two, plus one when it is grass. It wraps every 256 columns, so it needs no moving as the hero walks.
 */
export function createGroundMap(sim: World, means: (id: number) => readonly [number, number, number]): GroundMap {
  const data = new Uint8Array(GROUND_SIZE * GROUND_SIZE * 4);
  const texture = new THREE.DataTexture(data, GROUND_SIZE, GROUND_SIZE, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  let dirty = false;

  return {
    texture,

    writeChunk(cx, cz) {
      const chunk = sim.chunkAt(cx, cz);
      if (!chunk) return;
      for (let lx = 0; lx < CHUNK; lx++) {
        for (let lz = 0; lz < CHUNK; lz++) {
          let y = chunk.heights[(lx << 4) | lz] - 1;
          while (y >= 0 && (SEE_THROUGH[chunk.blocks[cellIndex(lx, y, lz)]] || !OPAQUE[chunk.blocks[cellIndex(lx, y, lz)]])) y--;
          const id = y >= 0 ? chunk.blocks[cellIndex(lx, y, lz)] : 0;
          const x = (cx * CHUNK + lx) & (GROUND_SIZE - 1), z = (cz * CHUNK + lz) & (GROUND_SIZE - 1);
          const o = (z * GROUND_SIZE + x) * 4;
          const c = means(id);
          data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
          data[o + 3] = Math.min(HEIGHT, y + 1) * 2 + GRASSY[id];
        }
      }
      dirty = true;
    },

    upload() {
      if (!dirty) return;
      dirty = false;
      texture.needsUpdate = true;
    },

    dispose() {
      texture.dispose();
    },
  };
}

/** The mean color of each block's top tile in the soft atlas, for the ground map. */
export function topMeans(source: AtlasSource): (id: number) => readonly [number, number, number] {
  const ctx = source.canvas.getContext('2d', { willReadFrequently: true })!;
  const byTile = new Map<string, [number, number, number]>();
  for (const [name, list] of source.cells) {
    const [column, row] = list[0];
    const pixels = ctx.getImageData(column * source.tile, row * source.tile, source.tile, source.tile).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < pixels.length; i += 4) { r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; }
    const n = pixels.length / 4;
    byTile.set(name, [r / n, g / n, b / n]);
  }
  const table: (readonly [number, number, number])[] = BLOCKS.map((b) => byTile.get(b.tiles.top) ?? [128, 128, 128]);
  return (id) => table[id] ?? [128, 128, 128];
}
