import { describe, expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { CELLS, CHUNK, HEIGHT } from './chunk.sim.ts';
import { generateChunk, spawnPoint, LANDMARKS } from './terrain.sim.ts';
import { World, emptyHit, type WorldSave } from './world.sim.ts';
import { built } from '../../game/region/land.sim.ts';

const STONE = blockId('stone'), LAMP = blockId('lamp'), GLASS = blockId('glass'), WATER = blockId('water');

function worldAround(seed: number, cx = 0, cz = 0, radius = 1, reverse = false): World {
  const world = new World(seed);
  const order: [number, number][] = [];
  for (let x = cx - radius; x <= cx + radius; x++) for (let z = cz - radius; z <= cz + radius; z++) order.push([x, z]);
  if (reverse) order.reverse();
  for (const [x, z] of order) world.load(x, z);
  return world;
}

// Chunk (6, -1) of seed 1 has flat open meadow in its middle, far from the start site.
const TCX = 6, TCZ = -1, EDGE = TCX * CHUNK + CHUNK - 1, ROW = TCZ * CHUNK + 6;

/** A flat, open spot in the middle of the test chunk. */
function openGround(world: World): { x: number; y: number; z: number } {
  for (let x = TCX * CHUNK + 4; x < TCX * CHUNK + 12; x++) {
    for (let z = TCZ * CHUNK + 4; z < TCZ * CHUNK + 12; z++) {
      const y = world.heightAt(x, z);
      let clear = y > 19;
      for (let dx = -3; dx <= 3 && clear; dx++) for (let dz = -3; dz <= 3 && clear; dz++) if (world.heightAt(x + dx, z + dz) !== y) clear = false;
      if (clear) return { x, y, z };
    }
  }
  throw new Error('no flat ground in the test area');
}

describe('blocks', () => {
  test('get returns what set wrote, also across chunk edges and below zero', () => {
    const world = worldAround(1, 0, 0);
    for (const [x, y, z] of [[3, 58, 5], [-1, 58, -1], [15, 59, 16], [-16, 60, 0]] as const) {
      expect(world.getBlock(x, y, z)).toBe(0);
      expect(world.setBlock(x, y, z, STONE)).toBe(true);
      expect(world.getBlock(x, y, z)).toBe(STONE);
      expect(world.setBlock(x, y, z, STONE)).toBe(false);
    }
    expect(world.getBlock(15, 59, 15)).toBe(0);
  });

  test('outside the loaded world reads as air and cannot be written', () => {
    const world = worldAround(1, 0, 0);
    expect(world.getBlock(500, 10, 500)).toBe(0);
    expect(world.setBlock(500, 10, 500, STONE)).toBe(false);
    expect(world.setBlock(0, HEIGHT, 0, STONE)).toBe(false);
    expect(world.setBlock(0, -1, 0, STONE)).toBe(false);
  });
});

describe('ray cast', () => {
  test('straight down hits the top of the ground', () => {
    const world = worldAround(1, TCX, TCZ);
    const g = openGround(world);
    const hit = emptyHit();
    expect(world.raycast(g.x + 0.5, 90, g.z + 0.5, 0, -1, 0, 200, hit)).toBe(true);
    expect([hit.x, hit.y, hit.z]).toEqual([g.x, g.y - 1, g.z]);
    expect([hit.nx, hit.ny, hit.nz]).toEqual([0, 1, 0]);
    expect(hit.distance).toBeCloseTo(90 - g.y, 5);
  });

  test('sideways hits the near face of a block, and a new block goes in front of it', () => {
    const world = worldAround(1, TCX, TCZ);
    const g = openGround(world);
    world.setBlock(g.x + 2, g.y, g.z, STONE);
    const hit = emptyHit();
    expect(world.raycast(g.x - 1.5, g.y + 0.5, g.z + 0.5, 1, 0, 0, 20, hit)).toBe(true);
    expect([hit.x, hit.y, hit.z, hit.id]).toEqual([g.x + 2, g.y, g.z, STONE]);
    expect([hit.nx, hit.ny, hit.nz]).toEqual([-1, 0, 0]);
    expect(hit.distance).toBeCloseTo(3.5, 5);
  });

  test('misses when nothing is in reach, passes through water, and honors skip', () => {
    const world = worldAround(1, TCX, TCZ);
    const g = openGround(world);
    const hit = emptyHit();
    expect(world.raycast(g.x + 0.5, g.y + 3.5, g.z + 0.5, 1, 0, 0, 2, hit)).toBe(false);
    world.setBlock(g.x, g.y + 5, g.z, WATER);
    world.setBlock(g.x, g.y + 3, g.z, GLASS);
    expect(world.raycast(g.x + 0.5, g.y + 8, g.z + 0.5, 0, -1, 0, 30, hit)).toBe(true);
    expect(hit.id).toBe(GLASS);
    expect(world.raycast(g.x + 0.5, g.y + 8, g.z + 0.5, 0, -1, 0, 30, hit, (_x, y) => y === g.y + 3)).toBe(true);
    expect(hit.y).toBe(g.y - 1);
  });
});

describe('height cache', () => {
  test('follows blocks placed and removed', () => {
    const world = worldAround(1, TCX, TCZ);
    const g = openGround(world);
    expect(world.openSky(g.x, g.y, g.z)).toBe(true);
    world.setBlock(g.x, g.y + 4, g.z, STONE);
    expect(world.heightAt(g.x, g.z)).toBe(g.y + 5);
    expect(world.openSky(g.x + 0.5, g.y + 1, g.z + 0.5)).toBe(false);
    expect(world.surfaceAt(g.x, g.z)).toBe('stone');
    world.setBlock(g.x, g.y + 4, g.z, 0);
    expect(world.heightAt(g.x, g.z)).toBe(g.y);
    expect(world.surfaceAt(g.x, g.z)).toBe('grass');
    world.setBlock(g.x, g.y - 1, g.z, 0);
    expect(world.heightAt(g.x, g.z)).toBe(g.y - 1);
    world.setBlock(g.x, g.y, g.z, WATER);
    expect(world.heightAt(g.x, g.z)).toBe(g.y - 1);
  });

  test('matches a scan of every loaded column', () => {
    const world = worldAround(3, 0, 0);
    for (let x = -16; x < 32; x += 3) {
      for (let z = -16; z < 32; z += 3) {
        let y = HEIGHT - 1;
        while (y >= 0 && (world.getBlock(x, y, z) === 0 || world.getBlock(x, y, z) === WATER)) y--;
        expect(world.heightAt(x, z)).toBe(y + 1);
      }
    }
  });
});

describe('light', () => {
  const lightOf = (world: World): Uint8Array[] => [...world.chunks.values()].map((c) => c.light.slice());

  test('open ground is fully lit by the sky and dark inside the ground', () => {
    const world = worldAround(1, TCX, TCZ);
    const g = openGround(world);
    expect(world.skyLightAt(g.x, g.y, g.z)).toBe(15);
    expect(world.lightAt(g.x, g.y - 3, g.z)).toBe(0);
    expect(world.lightAt(g.x, HEIGHT + 5, g.z)).toBe(15);
  });

  test('a lamp lights one level less per block, and removing it restores every cell', () => {
    const world = worldAround(1, TCX, TCZ);
    const g = openGround(world);
    const before = lightOf(world);
    world.setBlock(g.x, g.y, g.z, LAMP);
    expect(world.blockLightAt(g.x, g.y, g.z)).toBe(14);
    expect(world.blockLightAt(g.x + 1, g.y, g.z)).toBe(13);
    expect(world.blockLightAt(g.x + 2, g.y + 1, g.z - 2)).toBe(9);
    expect(world.blockLightAt(g.x, g.y + 13, g.z)).toBe(1);
    expect(world.blockLightAt(g.x, g.y + 14, g.z)).toBe(0);
    expect(world.blockLightAt(g.x, g.y - 2, g.z)).toBe(0);
    world.setBlock(g.x, g.y, g.z, 0);
    expect(lightOf(world)).toEqual(before);
  });

  test('a lamp near a chunk edge lights the next chunk, and two lamps overlap correctly', () => {
    const world = worldAround(1, TCX, TCZ);
    const y = world.heightAt(EDGE, ROW) + 14;
    const before = lightOf(world);
    world.setBlock(EDGE, y, ROW, LAMP);
    expect(world.blockLightAt(EDGE + 5, y, ROW)).toBe(9);
    world.setBlock(EDGE + 7, y, ROW, LAMP);
    expect(world.blockLightAt(EDGE + 4, y, ROW)).toBe(11);
    world.setBlock(EDGE, y, ROW, 0);
    expect(world.blockLightAt(EDGE + 4, y, ROW)).toBe(11);
    expect(world.blockLightAt(EDGE + 1, y, ROW)).toBe(8);
    world.setBlock(EDGE + 7, y, ROW, 0);
    expect(lightOf(world)).toEqual(before);
  });

  test('a roof darkens the ground under it, and removing the roof restores every cell', () => {
    const world = worldAround(1, TCX, TCZ);
    const g = openGround(world);
    const before = lightOf(world);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) world.setBlock(g.x + dx, g.y + 3, g.z + dz, STONE);
    expect(world.skyLightAt(g.x, g.y, g.z)).toBe(12);
    expect(world.skyLightAt(g.x + 2, g.y, g.z)).toBe(14);
    expect(world.skyLightAt(g.x + 3, g.y, g.z)).toBe(15);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) world.setBlock(g.x + dx, g.y + 3, g.z + dz, 0);
    expect(lightOf(world)).toEqual(before);
  });

  test('light does not depend on the order chunks load in', () => {
    const a = worldAround(5, 0, -1, 2), b = worldAround(5, 0, -1, 2, true);
    for (const [key, chunk] of a.chunks) expect(b.chunks.get(key)!.light).toEqual(chunk.light);
  });

  test('the lodge is lit by its lamp, and the mossy rocks lie in the shade of their oaks', () => {
    const house = LANDMARKS.house, rocks = LANDMARKS.cave;
    const town = worldAround(1, Math.floor(house.x) >> 4, Math.floor(house.z) >> 4, 1);
    // A lodge of the town kit has no inside: its place is the doorstep, under the sky, lit by its porch light.
    if (built().some((b) => b.plan.id === 'lodge')) expect(town.openSky(house.x, house.y + 1, house.z)).toBe(false);
    expect(town.blockLightAt(house.x, house.y + 1, house.z)).toBeGreaterThan(8);
    const grant = worldAround(1, Math.floor(rocks.x) >> 4, Math.floor(rocks.z) >> 4, 1);
    expect(grant.openSky(rocks.x, rocks.y + 1, rocks.z)).toBe(false);
    expect(grant.skyLightAt(rocks.x, rocks.y, rocks.z)).toBeLessThan(15);
    expect(grant.skyLightAt(rocks.x, rocks.y, rocks.z)).toBeGreaterThan(8);
  });
});

describe('terrain', () => {
  test('the same seed gives the same land', () => {
    for (const [cx, cz] of [[0, 0], [-3, 7], [12, -9]] as const) {
      const a = new Uint8Array(CELLS), b = new Uint8Array(CELLS).fill(9);
      generateChunk(42, cx, cz, a);
      generateChunk(42, cx, cz, b);
      expect(a).toEqual(b);
    }
  });

  test('another seed gives other land', () => {
    const a = new Uint8Array(CELLS), b = new Uint8Array(CELLS);
    generateChunk(42, 9, 9, a);
    generateChunk(43, 9, 9, b);
    expect(a).not.toEqual(b);
  });

  test('a tree that crosses a chunk edge is whole', () => {
    // Every leaf or log cell on a chunk edge must be the same block when read from the neighbor's side.
    const world = worldAround(7, 5, 5, 2);
    const again = new Uint8Array(CELLS);
    for (const chunk of world.chunks.values()) {
      generateChunk(7, chunk.cx, chunk.cz, again);
      expect(chunk.blocks).toEqual(again);
    }
  });

  test('the land has meadow, hills, water, trees and caves', () => {
    const world = worldAround(1, 0, 0, 12);
    const count = new Map<number, number>();
    let low = HEIGHT, high = 0, caves = 0;
    for (const chunk of world.chunks.values()) {
      for (let i = 0; i < CELLS; i++) count.set(chunk.blocks[i], (count.get(chunk.blocks[i]) ?? 0) + 1);
      for (let col = 0; col < CHUNK * CHUNK; col++) {
        const h = chunk.heights[col];
        low = Math.min(low, h); high = Math.max(high, h);
        for (let y = 3; y < h - 6; y++) if (chunk.blocks[col * HEIGHT + y] === 0) caves++;
      }
    }
    for (const key of ['grass', 'dirt', 'stone', 'sand', 'water', 'barrier', 'lume_crystal']) {
      expect(count.get(blockId(key)) ?? 0, key).toBeGreaterThan(0);
    }
    expect(low).toBeLessThan(18);
    expect(high).toBeGreaterThan(30);
    expect(caves).toBeGreaterThan(200);
  });

  test('the hero spawns on open ground two blocks north of the grant stone', () => {
    const s = spawnPoint();
    const world = worldAround(1, Math.floor(s.x) >> 4, Math.floor(s.z) >> 4, 1);
    const x = Math.floor(s.x), z = Math.floor(s.z);
    expect(world.heightAt(s.x, s.z)).toBe(s.y);
    expect(world.getBlock(x, s.y, z)).toBe(0);
    expect(world.getBlock(x, s.y + 1, z)).toBe(0);
    expect(world.getBlock(x, s.y, z + 1)).toBe(0);
    for (let y = s.y; y < s.y + 3; y++) expect(world.getBlock(x, y, z + 2)).not.toBe(0);
    expect(world.getBlock(x, s.y + 3, z + 2)).toBe(0);
  });
});

describe('saves', () => {
  test('a save is the seed plus the changed blocks, and it loads back exactly', () => {
    const world = worldAround(1, TCX, TCZ);
    const g = openGround(world);
    world.setBlock(g.x, g.y, g.z, LAMP);
    world.setBlock(g.x + 1, g.y - 1, g.z, 0);
    world.setBlock(EDGE, g.y + 2, TCZ * CHUNK + CHUNK, GLASS);
    world.setBlock(g.x + 2, g.y, g.z, STONE);
    world.setBlock(g.x + 2, g.y, g.z, 0);

    const save = JSON.parse(JSON.stringify(world.save())) as WorldSave;
    expect(save.seed).toBe(1);
    expect(save.edits.reduce((n, e) => n + e[2].length / 2, 0)).toBe(4);

    const loaded = new World(999);
    loaded.restore(save);
    expect(loaded.seed).toBe(1);
    expect(loaded.chunks.size).toBe(0);
    for (const chunk of world.chunks.values()) loaded.load(chunk.cx, chunk.cz);
    for (const [key, chunk] of world.chunks) {
      const other = loaded.chunks.get(key)!;
      expect(other.blocks).toEqual(chunk.blocks);
      expect(other.light).toEqual(chunk.light);
      expect(other.heights).toEqual(chunk.heights);
    }
    expect(loaded.save()).toEqual(world.save());
  });

  test('changes survive their chunk being dropped and loaded again', () => {
    const world = worldAround(1, TCX, TCZ);
    const g = openGround(world);
    world.setBlock(g.x, g.y, g.z, STONE);
    world.unload(TCX, TCZ);
    expect(world.getBlock(g.x, g.y, g.z)).toBe(0);
    world.load(TCX, TCZ);
    expect(world.getBlock(g.x, g.y, g.z)).toBe(STONE);
  });

  test('a save from a newer version is refused', () => {
    expect(() => new World(1).restore({ version: 2, seed: 1, edits: [] } as unknown as WorldSave)).toThrow();
  });
});
