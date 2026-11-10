// How a chunk is laid out in memory, and fast lookup tables made from the block data.
import { BLOCKS } from '../../content/blocks.ts';

/** A chunk is 16 by 16 blocks wide and 64 high. */
export const CHUNK = 16;
export const HEIGHT = 64;
export const CELLS = CHUNK * CHUNK * HEIGHT;

/** Blocks are stored column by column, so one column is 64 bytes in a row. */
export const cellIndex = (lx: number, y: number, lz: number): number => ((lx << 4) | lz) * HEIGHT + y;

/** One number per chunk position. It works for chunk coordinates from -32768 to 32767. */
export const chunkKey = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768);
export const keyX = (key: number): number => Math.floor(key / 65536) - 32768;
export const keyZ = (key: number): number => (key % 65536) - 32768;

export interface Chunk {
  cx: number;
  cz: number;
  /** One block id per cell. */
  blocks: Uint8Array;
  /** Sky light in the high four bits, block light in the low four. */
  light: Uint8Array;
  /** Per column: the y of the top of the highest solid block, 0 when the column is empty. */
  heights: Uint8Array;
  /** Goes up by one on every change, so a mesh knows when it is stale. */
  rev: number;
}

export const OPAQUE = new Uint8Array(256);
export const SOLID = new Uint8Array(256);
export const EMIT = new Uint8Array(256);
export const LIQUID = new Uint8Array(256);
for (const b of BLOCKS) {
  OPAQUE[b.id] = b.opaque ? 1 : 0;
  SOLID[b.id] = b.solid ? 1 : 0;
  EMIT[b.id] = b.light;
  LIQUID[b.id] = b.liquid ? 1 : 0;
}

/** Fills the height cache of a chunk from its blocks. */
export function computeHeights(blocks: Uint8Array, heights: Uint8Array): void {
  for (let col = 0; col < CHUNK * CHUNK; col++) {
    const base = col * HEIGHT;
    let y = HEIGHT - 1;
    while (y >= 0 && !SOLID[blocks[base + y]]) y--;
    heights[col] = y + 1;
  }
}

// The mesher works on a copy of one chunk plus a one-block rim of its neighbors, so faces, corner
// shading and light at the edge of a chunk come out right.
export const PAD = CHUNK + 2;
export const PAD_CELLS = PAD * PAD * HEIGHT;
export const padIndex = (lx: number, y: number, lz: number): number => ((lx + 1) * PAD + (lz + 1)) * HEIGHT + y;
