import { describe, expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { HEIGHT, PAD, PAD_CELLS, padIndex } from './chunk.sim.ts';
import { meshChunk, TILE_TABLE_SIZE } from './mesh.sim.ts';
import { World } from './world.sim.ts';

const STONE = blockId('stone'), WATER = blockId('water'), GLASS = blockId('glass');
const tiles = new Uint8Array(TILE_TABLE_SIZE);
for (let id = 0; id < 256; id++) for (let g = 0; g < 3; g++) { tiles[id * 6 + g * 2] = id; tiles[id * 6 + g * 2 + 1] = 1; }

/** An empty padded chunk under an open sky. */
function empty(): { blocks: Uint8Array; light: Uint8Array } {
  return { blocks: new Uint8Array(PAD_CELLS), light: new Uint8Array(PAD_CELLS).fill(0xf0) };
}

describe('meshing', () => {
  test('a single block has six faces', () => {
    const { blocks, light } = empty();
    blocks[padIndex(5, 30, 5)] = STONE;
    const mesh = meshChunk(blocks, light, tiles);
    expect(mesh.faces).toBe(6);
    expect(mesh.solid!.quads).toBe(6);
    expect(mesh.solid!.positions.length).toBe(6 * 4 * 3);
    expect(mesh.solid!.indices.length).toBe(6 * 6);
    expect(mesh.water).toBeNull();
    expect([mesh.minY, mesh.maxY]).toEqual([30, 31]);
  });

  test('two touching blocks have ten faces, because the two between them are hidden', () => {
    const { blocks, light } = empty();
    blocks[padIndex(5, 30, 5)] = STONE;
    blocks[padIndex(6, 30, 5)] = STONE;
    const mesh = meshChunk(blocks, light, tiles);
    expect(mesh.faces).toBe(10);
    // The four pairs of faces that lie side by side merge into one quad each.
    expect(mesh.solid!.quads).toBe(6);
  });

  test('two blocks of different kinds do not merge', () => {
    const { blocks, light } = empty();
    blocks[padIndex(5, 30, 5)] = STONE;
    blocks[padIndex(6, 30, 5)] = blockId('dirt');
    const mesh = meshChunk(blocks, light, tiles);
    expect(mesh.faces).toBe(10);
    expect(mesh.solid!.quads).toBe(10);
  });

  test('a flat floor merges into one quad, and a block on it shades the corners around it', () => {
    const { blocks, light } = empty();
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) blocks[padIndex(x, 10, z)] = STONE;
    const flat = meshChunk(blocks, light, tiles);
    // The top, the bottom and each of the four sides are one quad each.
    expect(flat.faces).toBe(2 * 256 + 4 * 16);
    expect(flat.solid!.quads).toBe(6);

    blocks[padIndex(8, 11, 8)] = STONE;
    const bumped = meshChunk(blocks, light, tiles);
    expect(bumped.faces).toBe(2 * 256 - 1 + 4 * 16 + 5);
    const shaded = bumped.solid!.info.filter((_, i) => i % 4 === 3 && bumped.solid!.info[i] < 3).length;
    expect(shaded).toBeGreaterThan(0);
    expect(bumped.solid!.quads).toBeGreaterThan(6);
    expect(bumped.solid!.quads).toBeLessThan(40);
  });

  test('the bottom of the world is never drawn', () => {
    const { blocks, light } = empty();
    blocks[padIndex(5, 0, 5)] = STONE;
    expect(meshChunk(blocks, light, tiles).faces).toBe(5);
  });

  test('a face on the chunk edge is hidden by the neighbor chunk', () => {
    const { blocks, light } = empty();
    blocks[padIndex(15, 30, 5)] = STONE;
    blocks[padIndex(16, 30, 5)] = STONE;
    expect(meshChunk(blocks, light, tiles).faces).toBe(5);
  });

  test('a block with no tiles draws nothing and hides nothing', () => {
    const { blocks, light } = empty();
    blocks[padIndex(5, 30, 5)] = STONE;
    const alone = meshChunk(blocks, light, tiles);
    blocks[padIndex(5, 31, 5)] = blockId('barrier');
    const under = meshChunk(blocks, light, tiles);
    // The barrier adds no face, and the stone under it keeps its top.
    expect(under.faces).toBe(alone.faces);
    expect(under.solid!.quads).toBe(6);
    expect(under.maxY).toBe(31);
  });

  test('water is its own mesh, and glass next to glass hides the face between', () => {
    const { blocks, light } = empty();
    for (let x = 2; x < 6; x++) for (let z = 2; z < 6; z++) { blocks[padIndex(x, 9, z)] = STONE; blocks[padIndex(x, 10, z)] = WATER; }
    blocks[padIndex(10, 30, 10)] = GLASS;
    blocks[padIndex(11, 30, 10)] = GLASS;
    const mesh = meshChunk(blocks, light, tiles);
    // Water: one merged top and 16 side faces. Stone under water still shows its top.
    expect(mesh.water!.quads).toBe(1 + 16);
    expect(mesh.faces).toBe(16 + 16 + (16 + 16 + 16) + 10);
  });

  test('faces the sky never lights come last, so they can be left out of the draw', () => {
    const { blocks, light } = empty();
    // A sealed stone box with a hollow middle: the outside is lit, the inside is not.
    for (let x = 2; x < 9; x++) for (let y = 20; y < 27; y++) for (let z = 2; z < 9; z++) {
      const hollow = x > 3 && x < 7 && y > 21 && y < 25 && z > 3 && z < 7;
      blocks[padIndex(x, y, z)] = hollow ? 0 : STONE;
      light[padIndex(x, y, z)] = 0;
    }
    const mesh = meshChunk(blocks, light, tiles).solid!;
    // Outside: six sides of 7 by 7, one quad each. Inside: six sides of 3 by 3, with shaded corners.
    expect(mesh.surface).toBe(6 * 6);
    expect(mesh.indices.length).toBeGreaterThan(mesh.surface);
    const deep = new Set(mesh.indices.subarray(mesh.surface));
    for (const v of deep) expect(mesh.light[v * 2]).toBe(0);
    for (const v of mesh.indices.subarray(0, mesh.surface)) expect(mesh.light[v * 2]).toBe(255);
    expect([mesh.low, mesh.high, mesh.surfaceLow]).toEqual([20, 27, 20]);
  });

  test('a real chunk merges faces, and a chunk without its neighbors cannot be copied', () => {
    const world = new World(1);
    for (let x = 3; x <= 5; x++) for (let z = 3; z <= 5; z++) world.load(x, z);
    const blocks = new Uint8Array(PAD_CELLS), light = new Uint8Array(PAD_CELLS);
    expect(world.snapshot(4, 4, blocks, light)).toBe(true);
    expect(blocks.length).toBe(PAD * PAD * HEIGHT);
    const mesh = meshChunk(blocks, light, tiles);
    expect(mesh.solid!.quads).toBeGreaterThan(0);
    expect(mesh.solid!.quads).toBeLessThan(mesh.faces);
    expect(world.snapshot(5, 5, blocks, light)).toBe(false);
  });
});
