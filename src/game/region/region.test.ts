import { describe, expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { CELLS, CHUNK, HEIGHT } from '../../features/world/chunk.sim.ts';
import { scatter } from '../../features/props/index.ts';
import { generateChunk } from '../../features/world/terrain.sim.ts';
import { World, buildChunk } from '../../features/world/world.sim.ts';
import type { Vec3 } from '../../engine/types.ts';
import type { GameSave, Kernel } from '../kernel.sim.ts';
import { createKernel } from '../kernel.sim.ts';
import { PETS } from '../content/pets.ts';
import { REGION } from '../content/region.ts';
import { install as installInteract } from '../interact/index.sim.ts';
import { install as installInventory } from '../inventory/index.sim.ts';
import { install as installItems } from '../items/index.sim.ts';
import { standable } from '../move.sim.ts';
import { install as installNav } from '../nav/index.sim.ts';
import { BUSH_REACH, REGROW_SECONDS, install as installRegion } from './index.sim.ts';
import { BOUNDS, built } from './land.sim.ts';

const SEED = 1;
const id = (key: string): number => blockId(key);
const MOSSY = id('mossy_stone'), WATER = id('water'), LAMP = id('lamp'), PATH = id('path'), GRASS = id('grass');
const OAK = id('oak_log'), BIRCH = id('birch_log'), TILLED = id('tilled_soil'), PLANK = id('oak_plank'), SHINGLE = id('shingle');

/** Every place docs/play/act1.md asks the region for. */
const PLACES = [
  'grant.stone', 'grant.center', 'grant.rocks', 'dead.garden', 'town.gate', 'town.square', 'lodge', 'granary',
  'bakery', 'gus.field', 'carpenter', 'kennel', 'river.bank', 'ferry',
];
const TOWN_PLACES = ['town.square', 'lodge', 'granary', 'bakery', 'gus.field', 'carpenter', 'kennel', 'river.bank', 'ferry'];

const cx0 = BOUNDS.x0 >> 4, cx1 = BOUNDS.x1 >> 4, cz0 = BOUNDS.z0 >> 4, cz1 = BOUNDS.z1 >> 4;

/** The whole region, loaded once. No test changes a block, so they share it. */
const world = new World(SEED);
for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) for (let cz = cz0 - 1; cz <= cz1 + 1; cz++) world.load(cx, cz);

function stage(): Kernel {
  const kernel = createKernel(world, 7);
  installItems(kernel);
  installInventory(kernel);
  installRegion(kernel);
  installInteract(kernel);
  installNav(kernel);
  return kernel;
}

const kernel = stage();
const game = kernel.game;
const region = game.systems.region;
const at = (name: string): Vec3 => region.place(name).at;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);
const block = (x: number, y: number, z: number): number => world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));

/** Counts blocks of one kind in a box of columns. */
function count(blockIdWanted: number, x0: number, z0: number, x1: number, z1: number, y0 = 0, y1 = HEIGHT - 1): number {
  let n = 0;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) if (world.getBlock(x, y, z) === blockIdWanted) n++;
  return n;
}

describe('places', () => {
  test('every place of the first part exists, on a block somebody can stand on', () => {
    for (const name of PLACES) {
      const p = region.place(name);
      expect(p.name).toBe(name);
      expect(p.label.length, name).toBeGreaterThan(0);
      expect(standable(world, p.at.x, p.at.y, p.at.z), `${name} at ${p.at.x}, ${p.at.y}, ${p.at.z}`).toBe(true);
      // The feet are on the ground there, not on a roof or in a hole.
      expect(Number.isInteger(p.at.y)).toBe(true);
      expect(block(p.at.x, p.at.y, p.at.z), name).toBe(0);
    }
    expect(region.places().map((p) => p.name).sort()).toEqual([...PLACES].sort());
  });

  test('a place that does not exist throws an error that names it and lists the real ones', () => {
    expect(() => region.place('the.moon')).toThrow(/no place called "the\.moon".*grant\.stone/);
  });

  test('every place is out of doors or in an open doorway', () => {
    const doors = new Set(built().map((b) => `${b.door.x},${b.door.z}`));
    for (const name of PLACES) {
      const p = at(name);
      const indoors = built().some((b) => p.x > b.x0 + 1 && p.x < b.x1 && p.z > b.z0 + 1 && p.z < b.z1);
      if (indoors) expect(doors.has(`${Math.floor(p.x)},${Math.floor(p.z)}`), name).toBe(true);
    }
    // The granary's place is its doorway: the wall stands on both sides of it and the way out is open.
    const granary = built().find((b) => b.plan.id === 'granary')!;
    expect(at('granary')).toEqual({ x: granary.door.x + 0.5, y: granary.door.y, z: granary.door.z + 0.5 });
    expect(block(granary.door.x - 1, granary.door.y, granary.door.z)).not.toBe(0);
    expect(standable(world, granary.outside.x, granary.outside.y, granary.outside.z)).toBe(true);
  });

  test('the sites lie as far apart as the design says', () => {
    const stone = at('grant.stone'), center = at('grant.center');
    expect(flat(stone, at('grant.rocks'))).toBeLessThanOrEqual(15);
    for (const from of [stone, center]) {
      expect(flat(from, at('dead.garden'))).toBeGreaterThanOrEqual(60);
      expect(flat(from, at('dead.garden'))).toBeLessThanOrEqual(80);
    }
    expect(flat(stone, at('town.gate'))).toBeGreaterThanOrEqual(120);
    expect(flat(stone, at('town.gate'))).toBeLessThanOrEqual(160);
    // The ferry is down the river from the bank, not on it.
    expect(flat(at('river.bank'), at('ferry'))).toBeGreaterThan(15);
  });
});

describe('the grant', () => {
  const g = region.grant();

  test('is 28 by 28 blocks of level, open meadow', () => {
    expect([g.width, g.depth]).toEqual([28, 28]);
    const ground = at('grant.center').y;
    let stones = 0;
    for (let x = g.x; x < g.x + g.width; x++) {
      for (let z = g.z; z < g.z + g.depth; z++) {
        if (world.heightAt(x, z) !== ground) { stones++; continue; }
        expect(world.getBlock(x, ground - 1, z)).toBe(GRASS);
        // Nothing hangs over the plot either: the sky is open all the way up.
        expect(world.skyLightAt(x, ground, z)).toBe(15);
      }
    }
    // The one column that is not meadow is the standing stone.
    expect(stones).toBe(1);
    const c = at('grant.center');
    expect(Math.abs(c.x - (g.x + g.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(c.z - (g.z + g.depth / 2))).toBeLessThanOrEqual(1);
  });

  test('has a standing stone at its corner, and the hero starts two blocks from it, facing it', () => {
    const stone = at('grant.stone'), spawn = region.spawn();
    // The stone is the column beside its place, three blocks tall, on the grant's south-east corner.
    const sx = Math.floor(stone.x) - 1, sz = Math.floor(stone.z);
    expect([sx, sz]).toEqual([g.x + g.width - 1, g.z + g.depth - 1]);
    for (let y = stone.y; y < stone.y + 3; y++) expect(world.getBlock(sx, y, sz)).not.toBe(0);
    expect(world.getBlock(sx, stone.y + 3, sz)).toBe(0);

    expect(standable(world, spawn.x, spawn.y, spawn.z)).toBe(true);
    expect(Math.hypot(spawn.x - (sx + 0.5), spawn.z - (sz + 0.5))).toBe(2);
    // Facing 0 looks north and turns clockwise, so the step ahead is (sin, -cos). Two of them reach the stone.
    const facing = region.spawnFacing!();
    expect(Math.floor(spawn.x + Math.sin(facing) * 2)).toBe(sx);
    expect(Math.floor(spawn.z - Math.cos(facing) * 2)).toBe(sz);
    // The stone's place is not where the hero starts, so Tamsin and the hero do not share a block.
    expect(flat(spawn, stone)).toBeGreaterThan(1);
  });

  test('has trees to cut within 20 blocks of it', () => {
    // Logs no further than 12 blocks from the plot's edge, which is well inside the 20 the design allows.
    let logs = 0, trunks = 0;
    for (let x = g.x - 12; x < g.x + g.width + 12; x++) {
      for (let z = g.z - 12; z < g.z + g.depth + 12; z++) {
        const ground = world.heightAt(x, z);
        let here = 0;
        for (let y = 20; y < 30; y++) { const b = world.getBlock(x, y, z); if (b === OAK || b === BIRCH) here++; }
        logs += here;
        if (here >= 4) trunks++;
        expect(ground).toBeGreaterThan(18);
      }
    }
    // Quest 2 asks for 12 wood. There are several trees, so cutting one does not clear the place.
    expect(logs).toBeGreaterThanOrEqual(24);
    expect(trunks).toBeGreaterThanOrEqual(6);
  });
});

describe('the mossy rocks', () => {
  /** Mossy stones near the place with room to stand on them, each with its light and whether water is within 2 blocks. */
  function stones(): { x: number; y: number; z: number; light: number; damp: boolean }[] {
    const p = at('grant.rocks'), out = [];
    for (let x = Math.floor(p.x) - 10; x <= p.x + 10; x++) {
      for (let z = Math.floor(p.z) - 10; z <= p.z + 10; z++) {
        for (let y = p.y - 4; y <= p.y + 4; y++) {
          if (world.getBlock(x, y, z) !== MOSSY || !standable(world, x, y + 1, z)) continue;
          let damp = false;
          for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) if (world.getBlock(x + dx, y + dy, z + dz) === WATER) damp = true;
          out.push({ x, y, z, light: world.lightAt(x, y + 1, z), damp });
        }
      }
    }
    return out;
  }

  test('lie in the shade: the light over them is low by day', () => {
    const all = stones();
    expect(all.length).toBeGreaterThanOrEqual(8);
    // content/creatures.ts lets a mossling appear at light 14 or less. Open sky is 15.
    const shaded = all.filter((s) => s.light <= 14);
    expect(shaded.length).toBeGreaterThanOrEqual(8);
    expect(shaded.filter((s) => s.light <= 13).length).toBeGreaterThanOrEqual(3);
    for (const s of shaded) expect(world.openSky(s.x, s.y + 1, s.z)).toBe(false);
  });

  test('have a pool, so a shaded stone has water within 2 blocks and the first lesson needs no tool', () => {
    const damp = stones().filter((s) => s.light <= 14 && s.damp);
    expect(damp.length).toBeGreaterThanOrEqual(1);
    const p = at('grant.rocks');
    expect(count(WATER, Math.floor(p.x) - 6, Math.floor(p.z) - 6, Math.floor(p.x) + 6, Math.floor(p.z) + 6)).toBeGreaterThanOrEqual(2);
  });

  test('stand under trees', () => {
    const p = at('grant.rocks');
    expect(count(OAK, Math.floor(p.x) - 8, Math.floor(p.z) - 8, Math.floor(p.x) + 8, Math.floor(p.z) + 8)).toBeGreaterThanOrEqual(8);
  });
});

describe('the dead garden', () => {
  const c = at('dead.garden');
  const x = Math.floor(c.x), z = Math.floor(c.z);

  test('has dry beds, a broken fence and the walls of a house', () => {
    expect(count(TILLED, x - 8, z - 8, x + 8, z + 8)).toBe(24);
    // The fence is one block high and has gaps: fewer blocks than a whole ring of 52, more than half of one.
    let fence = 0, gaps = 0;
    for (let fx = x - 7; fx <= x + 7; fx++) {
      for (let fz = z - 6; fz <= z + 6; fz++) {
        if (fx !== x - 7 && fx !== x + 7 && fz !== z - 6 && fz !== z + 6) continue;
        if (world.getBlock(fx, c.y, fz) === 0) gaps++;
        else { fence++; expect(world.getBlock(fx, c.y + 1, fz)).toBe(0); }
      }
    }
    expect(fence).toBeGreaterThan(26);
    expect(gaps).toBeGreaterThanOrEqual(8);
    // The house: plank walls of different heights north of the beds.
    expect(count(PLANK, x - 4, z - 14, x + 4, z - 9, c.y, c.y + 3)).toBeGreaterThanOrEqual(12);
    expect(count(PLANK, x - 4, z - 14, x + 4, z - 9, c.y + 2, c.y + 2)).toBeGreaterThanOrEqual(2);
    expect(count(PLANK, x - 4, z - 14, x + 4, z - 9, c.y + 3, c.y + 5)).toBe(0);
  });

  test('gives the leaftail a place to stand at each of its beds', () => {
    const leaftail = PETS.find((p) => p.home === 'dead.garden')!;
    for (const bed of leaftail.beds) expect(standable(world, c.x + bed.x, c.y, c.z + bed.z), `bed ${bed.x}, ${bed.z}`).toBe(true);
  });
});

describe('the path and the town', () => {
  const nav = game.systems.nav;

  test('a walker can go from the grant stone to the town gate', () => {
    const route = nav.path(at('grant.stone'), at('town.gate'), 60000);
    expect(route).not.toBeNull();
    expect(route!.length).toBeLessThan(200);
  });

  test('the path runs unbroken from the stone to the gate and into town, never steeper than one block', () => {
    const points = REGION.paths[0].points;
    let last = -1, steps = 0;
    for (let i = 0; i + 1 < points.length; i++) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + ((bx - ax) * k) / n), z = Math.round(az + ((bz - az) * k) / n);
        const h = world.heightAt(x, z);
        expect(world.getBlock(x, h - 1, z), `${x}, ${z}`).toBe(PATH);
        expect(standable(world, x, h, z), `${x}, ${z}`).toBe(true);
        if (last >= 0) expect(Math.abs(h - last), `${x}, ${z}`).toBeLessThanOrEqual(1);
        last = h;
        steps++;
      }
    }
    expect(steps).toBeGreaterThan(140);
    // Its two ends: the stone's place, and the gate. The main street goes on from the gate.
    const stone = at('grant.stone'), gate = at('town.gate');
    expect(block(stone.x, stone.y - 1, stone.z)).toBe(PATH);
    expect(block(gate.x, gate.y - 1, gate.z)).toBe(PATH);
    for (let x = Math.floor(gate.x); x <= 199; x++) expect(world.getBlock(x, gate.y - 1, Math.floor(gate.z)), `street at ${x}`).toBe(PATH);
  });

  test('the path is three blocks wide at both ends and in the middle', () => {
    for (const [x, z] of [[20, -221], [60, -221], [135, -174]] as const) {
      const y = world.heightAt(x, z) - 1;
      for (const dz of [-1, 0, 1]) expect(world.getBlock(x, y, z + dz)).toBe(PATH);
    }
  });

  test('a walker can reach every place in town from the gate, within the default search', () => {
    for (const name of TOWN_PLACES) {
      const route = nav.route('town.gate', name);
      expect(route, name).not.toBeNull();
      const end = route![route!.length - 1];
      expect([Math.floor(end.x), end.y, Math.floor(end.z)], name).toEqual([Math.floor(at(name).x), at(name).y, Math.floor(at(name).z)]);
    }
    // And the wild places from the grant.
    for (const name of ['grant.center', 'grant.rocks']) expect(nav.path(at('grant.stone'), at(name)), name).not.toBeNull();
    expect(nav.path(at('grant.center'), at('dead.garden'), 20000)).not.toBeNull();
  });

  test('about ten buildings stand around the square, turned more than one way, most under teal shingle', () => {
    const all = built();
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(new Set(all.map((b) => b.plan.turns)).size).toBeGreaterThan(1);
    expect(new Set(all.map((b) => b.plan.blueprint))).toEqual(new Set(['cottage', 'shop', 'barn']));
    const t = REGION.town;
    for (const b of all) {
      // Each one is whole, on the town's ground, and inside its bounds.
      expect(b.x0 >= t.x0 && b.x1 <= t.x1 && b.z0 >= t.z0 && b.z1 <= t.z1, b.plan.id).toBe(true);
      expect(standable(world, b.door.x, b.door.y, b.door.z), `${b.plan.id} doorway`).toBe(true);
      expect(standable(world, b.outside.x, b.outside.y, b.outside.z), `${b.plan.id} doorstep`).toBe(true);
      expect(nav.path(at('town.gate'), { x: b.door.x + 0.5, y: b.door.y, z: b.door.z + 0.5 }), `${b.plan.id} door`).not.toBeNull();
    }
    // No two overlap.
    for (const a of all) for (const b of all) if (a !== b) expect(a.x1 < b.x0 || b.x1 < a.x0 || a.z1 < b.z0 || b.z1 < a.z0, `${a.plan.id} and ${b.plan.id}`).toBe(true);
    expect(count(SHINGLE, t.x0, t.z0, t.x1, t.z1)).toBeGreaterThan(600);
  });

  test('the square is open, with a well in it', () => {
    const s = at('town.square');
    let open = 0;
    for (let x = Math.floor(s.x) - 12; x <= s.x + 12; x++) for (let z = Math.floor(s.z) - 6; z <= s.z + 6; z++) if (standable(world, x, s.y, z)) open++;
    expect(open).toBeGreaterThan(25 * 13 * 0.9);
    // The well: water at ground level with a ring around it, a few blocks north of the place.
    expect(count(WATER, Math.floor(s.x) - 1, Math.floor(s.z) - 6, Math.floor(s.x) + 1, Math.floor(s.z) - 2, s.y - 1, s.y)).toBe(1);
  });

  test('nobody who stands a few blocks off a meeting place ends up on a well, a fence or a lamp', () => {
    // The villagers stand up to 4 blocks from these three places. One step up from there must never be a place to stand.
    for (const name of ['town.square', 'river.bank', 'town.gate']) {
      const p = at(name);
      for (let x = Math.floor(p.x) - 4; x <= p.x + 4; x++) for (let z = Math.floor(p.z) - 4; z <= p.z + 4; z++) {
        expect(standable(world, x, p.y + 1, z), `${name}: ${x}, ${z}`).toBe(false);
      }
    }
  });

  test('the bank is level and beside the river, and the ferry is a plank dock over the water', () => {
    const bank = at('river.bank');
    for (let x = Math.floor(bank.x) - 20; x <= bank.x + 20; x++) expect(world.heightAt(x, Math.floor(bank.z))).toBe(bank.y);
    // Water lies within 3 blocks to the south, the way the lamps float away.
    expect(count(WATER, Math.floor(bank.x), Math.floor(bank.z) + 1, Math.floor(bank.x), Math.floor(bank.z) + 3)).toBeGreaterThan(0);
    const ferry = at('ferry');
    expect(block(ferry.x, ferry.y - 1, ferry.z)).toBe(PLANK);
    expect(block(ferry.x, ferry.y - 3, ferry.z)).toBe(WATER);
  });

  test('lamps stand along the square and the bank, so the town glows at night', () => {
    const t = REGION.town;
    expect(count(LAMP, t.x0, t.z0, t.x1, t.z1)).toBeGreaterThanOrEqual(20);
    const square = at('town.square'), bank = at('river.bank');
    expect(count(LAMP, Math.floor(square.x) - 17, Math.floor(square.z) - 17, Math.floor(square.x) + 17, Math.floor(square.z) + 7)).toBeGreaterThanOrEqual(4);
    expect(count(LAMP, Math.floor(bank.x) - 32, Math.floor(bank.z) - 3, Math.floor(bank.x) + 32, Math.floor(bank.z) + 3)).toBeGreaterThanOrEqual(5);
    // Lamp light reaches the bank and the doorsteps. Sky light is not counted here: it is what night takes away.
    expect(world.blockLightAt(bank.x, bank.y + 1, bank.z)).toBeGreaterThan(3);
    for (const name of ['lodge', 'bakery', 'granary', 'town.gate', 'ferry']) expect(world.blockLightAt(at(name).x, at(name).y + 1, at(name).z), name).toBeGreaterThan(3);
  });

  test('gus has a tilled field at the edge of town, and the kennel is a fenced yard with a way in', () => {
    // Both lie east of their places, between the lane and the river.
    const field = at('gus.field');
    expect(count(TILLED, Math.floor(field.x), Math.floor(field.z) - 9, Math.floor(field.x) + 10, Math.floor(field.z) + 9)).toBeGreaterThan(100);
    const t = REGION.town;
    expect(t.x1 - Math.floor(field.x)).toBeLessThan(25);
    // Standing at the kennel's place, the yard is one step east: grass ringed by blocks one high, with one gap.
    const k = at('kennel');
    const x0 = Math.floor(k.x) + 1, z = Math.floor(k.z);
    expect(world.getBlock(x0, k.y, z)).toBe(0);
    expect(world.getBlock(x0, k.y, z - 1)).not.toBe(0);
    expect(world.getBlock(x0, k.y, z + 1)).not.toBe(0);
    let ring = 0, open = 0, inside = 0;
    for (let x = x0; x <= x0 + 8; x++) for (let fz = z - 4; fz <= z + 4; fz++) {
      if (x !== x0 && x !== x0 + 8 && fz !== z - 4 && fz !== z + 4) { if (standable(world, x, k.y, fz)) inside++; continue; }
      if (world.getBlock(x, k.y, fz) === 0) open++; else ring++;
    }
    expect([ring, open]).toEqual([31, 1]);
    // Room for the animals: the yard's floor is open but for the hutch.
    expect(inside).toBe(7 * 7 - 4);
  });
});

describe('what the player may change', () => {
  test('the town and the path are protected, the grant and the wild are not', () => {
    for (const name of ['town.gate', ...TOWN_PLACES]) {
      const p = at(name);
      expect(region.isProtected(p.x, p.y, p.z), name).toBe(true);
      expect(region.isProtected(p.x, p.y - 1, p.z), name).toBe(true);
    }
    // A wall of the lodge, a lamp on the square, the well.
    const lodge = built().find((b) => b.plan.id === 'lodge')!;
    expect(region.isProtected(lodge.x0 + 1, lodge.y0 + 2, lodge.z0 + 1)).toBe(true);
    // The path, at its middle and its edge, far from town.
    for (const dz of [-1, 0, 1]) expect(region.isProtected(60, 21, -221 + dz)).toBe(true);
    expect(region.isProtected(60, 21, -224)).toBe(false);

    const g = region.grant();
    for (const [x, z] of [[g.x, g.z], [g.x + g.width - 1, g.z], [g.x, g.z + g.depth - 1], [g.x + g.width - 1, g.z + g.depth - 1], [g.x + 14, g.z + 14]]) {
      for (const y of [20, 21, 22, 23, 30]) expect(region.isProtected(x, y, z), `${x}, ${y}, ${z}`).toBe(false);
    }
    const c = at('grant.center');
    expect(region.isProtected(c.x, c.y, c.z)).toBe(false);
    for (const name of ['grant.rocks', 'dead.garden']) expect(region.isProtected(at(name).x, at(name).y, at(name).z), name).toBe(false);
    expect(region.isProtected(-200, 21, -100)).toBe(false);
  });

  test('the grant is where it says, and a copy cannot change it', () => {
    const g = region.grant();
    expect(g).toEqual(REGION.grant);
    g.x = 999;
    expect(region.grant().x).toBe(REGION.grant.x);
  });
});

describe('berry bushes', () => {
  /** Puts the player beside a bush and returns it. */
  function standBy(k: Kernel, index: number) {
    const bush = k.game.systems.region.berryBushes!()[index];
    Object.assign(k.game.player.pos, { x: bush.x + 1, y: bush.y, z: bush.z });
    return bush;
  }
  const wait = (k: Kernel, seconds: number): void => { for (let i = 0; i < Math.round(seconds * 20); i++) k.step(); };

  test('six grow around the dead garden and four along the path, each on open ground', () => {
    const bushes = region.berryBushes!();
    expect(bushes.length).toBe(10);
    const garden = at('dead.garden');
    const near = bushes.filter((b) => flat(b, garden) <= 16);
    expect(near.length).toBe(6);
    for (const b of near) expect(flat(b, garden)).toBeGreaterThan(8);
    const far = bushes.filter((b) => flat(b, garden) > 16);
    expect(far.length).toBe(4);
    for (const b of far) {
      // Beside the path: a path block within 4 blocks, and not on the path itself.
      expect(count(PATH, Math.floor(b.x) - 4, Math.floor(b.z) - 4, Math.floor(b.x) + 4, Math.floor(b.z) + 4)).toBeGreaterThan(0);
      expect(block(b.x, b.y - 1, b.z)).toBe(GRASS);
    }
    for (const b of bushes) {
      expect(standable(world, b.x, b.y, b.z), b.id).toBe(true);
      expect(world.openSky(b.x, b.y, b.z), b.id).toBe(true);
      expect(region.scatter!().blocked(b.x, b.z)).toBe(true);
    }
    expect(new Set(bushes.map((b) => b.id)).size).toBe(10);
  });

  test('a bush gives 1 or 2 berries, goes bare, and has berries again after 120 seconds', () => {
    const k = stage();
    const g = k.game;
    const bush = standBy(k, 0);
    k.step();
    const gained: { id: string; count: number; at?: Vec3 }[] = [];
    g.events.on('item.gained', (e) => gained.push(e));

    expect(g.systems.interact.nearest()?.prompt()).toBe('Pick berries');
    expect(g.systems.interact.act()).toBe(true);
    const got = g.systems.inventory.count('berry');
    expect(got === 1 || got === 2).toBe(true);
    expect(gained.length).toBe(1);
    expect(gained[0].id).toBe('berry');
    expect(gained[0].count).toBe(got);
    expect(flat(gained[0].at!, bush)).toBe(0);

    // Bare: no prompt, nothing more to pick, and the view is told.
    expect(bush.ripe).toBe(false);
    expect(g.systems.interact.nearest()).toBeNull();
    expect(g.systems.interact.act()).toBe(false);
    expect(g.systems.inventory.count('berry')).toBe(got);
    // The other bushes are untouched.
    expect(g.systems.region.berryBushes!().filter((b) => b.ripe).length).toBe(9);

    wait(k, REGROW_SECONDS - 1);
    expect(bush.ripe).toBe(false);
    expect(g.systems.interact.nearest()).toBeNull();
    wait(k, 1.1);
    expect(bush.ripe).toBe(true);
    expect(g.systems.interact.nearest()?.prompt()).toBe('Pick berries');
    expect(g.systems.interact.act()).toBe(true);
    expect(g.systems.inventory.count('berry')).toBeGreaterThan(got);
  });

  test('picking gives both 1 and 2 over many bushes, from the game\'s own random numbers', () => {
    const seen = new Set<number>();
    for (const seed of [3, 4, 5]) {
      const k = createKernel(world, seed);
      installItems(k); installInventory(k); installRegion(k); installInteract(k);
      k.step();
      for (let i = 0; i < 10; i++) {
        standBy(k, i);
        const before = k.game.systems.inventory.count('berry');
        k.game.systems.interact.act();
        seen.add(k.game.systems.inventory.count('berry') - before);
      }
    }
    expect([...seen].sort()).toEqual([1, 2]);
  });

  test('the prompt shows only within reach', () => {
    const k = stage();
    const bush = standBy(k, 3);
    k.step();
    k.game.player.pos.x = bush.x + BUSH_REACH + 0.2;
    expect(k.game.systems.interact.nearest()).toBeNull();
    k.game.player.pos.x = bush.x + BUSH_REACH - 0.2;
    expect(k.game.systems.interact.nearest()?.id).toBe(bush.id);
  });

  test('a full bag takes nothing and leaves the berries on the bush', () => {
    const k = stage();
    const g = k.game;
    for (const item of g.systems.items.all()) {
      if (item.id === 'berry') continue;
      if (g.systems.inventory.slots.every((s) => s !== null)) break;
      while (g.systems.inventory.add(item.id, item.stack) === 0 && g.systems.inventory.slots.some((s) => s === null)) { /* fill the bag */ }
    }
    expect(g.systems.inventory.slots.every((s) => s !== null)).toBe(true);
    const bush = standBy(k, 1);
    k.step();
    const toasts: string[] = [];
    g.events.on('toast', (e) => toasts.push(e.text));
    expect(g.systems.interact.act()).toBe(true);
    expect(bush.ripe).toBe(true);
    expect(g.systems.inventory.count('berry')).toBe(0);
    expect(toasts).toEqual(['Your bag is full.']);
  });

  test('a save keeps which bushes are bare and how long they have left', () => {
    const k = stage();
    standBy(k, 2);
    k.step();
    k.game.systems.interact.act();
    wait(k, 40);
    standBy(k, 7);
    k.game.systems.interact.act();
    const save = JSON.parse(JSON.stringify(k.save())) as GameSave;

    const again = stage();
    again.load(save);
    const bushes = again.game.systems.region.berryBushes!();
    expect(bushes.map((b) => b.ripe)).toEqual([true, true, false, true, true, true, true, false, true, true]);
    // Bush 2 was picked 40 seconds before bush 7, so it comes back 40 seconds sooner.
    wait(again, REGROW_SECONDS - 40 + 0.2);
    expect(bushes[2].ripe).toBe(true);
    expect(bushes[7].ripe).toBe(false);
    wait(again, 40);
    expect(bushes[7].ripe).toBe(true);
    // A bare bush has no prompt after a load either.
    const third = stage();
    third.load(save);
    standBy(third, 7);
    third.step();
    expect(third.game.systems.interact.nearest()).toBeNull();
  });

  test('a night\'s sleep brings every bush back', () => {
    const k = stage();
    standBy(k, 4);
    k.step();
    k.game.systems.interact.act();
    expect(k.game.systems.region.berryBushes!()[4].ripe).toBe(false);
    k.game.events.emit('slept', { day: 2 });
    expect(k.game.systems.region.berryBushes!().every((b) => b.ripe)).toBe(true);
  });
});

describe('what a view reads', () => {
  test('the props of the buildings: a door for each, windows, and the signs of the shops', () => {
    const props = region.props!();
    const all = built();
    expect(props.filter((p) => p.kind === 'door').length).toBe(all.length);
    expect(props.filter((p) => p.kind === 'window').length).toBeGreaterThanOrEqual(all.length * 3);
    for (const p of props) {
      expect(typeof p.kind).toBe('string');
      for (const n of [p.x, p.y, p.z, p.rotation, p.variant, p.scale, p.quarterTurns]) expect(Number.isFinite(n)).toBe(true);
    }
    // A door stands in its building's doorway, turned with the building.
    for (const b of all) {
      const door = props.find((p) => p.kind === 'door' && p.building === b.plan.id)!;
      expect(Math.abs(door.x - (b.door.x + 0.5)) + Math.abs(door.z - (b.door.z + 0.5)), b.plan.id).toBeLessThanOrEqual(1.5);
      expect(door.y).toBe(b.door.y);
      expect(door.quarterTurns).toBe(b.plan.turns);
      expect(door.rotation).toBeCloseTo((b.plan.turns * Math.PI) / 2, 6);
    }
    // The bakery hangs the loaf.
    expect(props.find((p) => p.kind === 'sign' && p.building === 'bakery')!.variant).toBe(1);
    // Props that stand alone are in the list too, with no building.
    expect(props.filter((p) => p.building === '').length).toBe(REGION.props.length);
    expect(region.props!()).toBe(props);
  });

  test('where nothing is scattered: the grant, the path, the town, the garden\'s beds', () => {
    const blocked = region.scatter!().blocked;
    expect(region.scatter!().density).toBe(1);
    const c = at('grant.center'), garden = at('dead.garden'), square = at('town.square');
    expect(blocked(c.x, c.z)).toBe(true);
    expect(blocked(60.5, -220.5)).toBe(true);
    expect(blocked(square.x, square.z)).toBe(true);
    expect(blocked(at('gus.field').x, at('gus.field').z)).toBe(true);
    expect(blocked(garden.x - 3, garden.z - 2)).toBe(true);
    expect(blocked(at('grant.rocks').x, at('grant.rocks').z)).toBe(true);
    // The whole grant is bare, to its corners. One block outside it, and the open meadow, keep their grass and flowers.
    const g = region.grant();
    expect(blocked(g.x + 0.5, g.z + 0.5)).toBe(true);
    expect(blocked(g.x + 0.5, g.z + 10.5)).toBe(true);
    expect(blocked(g.x - 0.5, g.z + 10.5)).toBe(false);
    expect(blocked(60.5, -240.5)).toBe(false);
    expect(blocked(-200.5, -100.5)).toBe(false);
  });

  test('the scatter rules, given these settings, keep trees off the sites and out of the camera\'s way', () => {
    const s = region.scatter!();
    const area = { x0: BOUNDS.x0, z0: BOUNDS.z0, x1: BOUNDS.x1 + 1, z1: BOUNDS.z1 + 1 };
    const isTree = (p: { kind: string }): boolean => p.kind === 'oak' || p.kind === 'birch' || p.kind === 'pine';
    // What the dressing view does today: it hands the scatter `density` and `blocked`, and the scatter's own woods.
    const found = scatter(SEED, world, { area, density: s.density, blocked: s.blocked });
    const trees = found.props.filter(isTree);
    // The land is not stripped: woods and meadow plants are still there.
    expect(trees.length).toBeGreaterThan(100);
    expect(found.props.length).toBeGreaterThan(5000);

    const g = region.grant(), t = REGION.town, garden = at('dead.garden');
    for (const tree of trees) {
      const where = `${tree.kind} at ${tree.x.toFixed(1)}, ${tree.z.toFixed(1)}`;
      expect(tree.x >= g.x && tree.x < g.x + g.width && tree.z >= g.z && tree.z < g.z + g.depth, where).toBe(false);
      expect(tree.x >= t.x0 && tree.x <= t.x1 + 1 && tree.z >= t.z0 + 2 && tree.z <= t.z1 + 1, where).toBe(false);
      expect(Math.abs(tree.x - garden.x) <= 8 && tree.z - garden.z >= -15 && tree.z - garden.z <= 7, where).toBe(false);
      expect(region.isProtected(tree.x, 21, tree.z) && !(tree.x >= t.x0 && tree.x <= t.x1), where).toBe(false);
    }
    // The camera starts south-east of the hero. Nothing tall stands on that side of where the story is played.
    for (const p of [region.spawn(), at('grant.center'), at('grant.rocks'), garden, at('town.gate')]) {
      for (const tree of trees) {
        const dx = tree.x - p.x, dz = tree.z - p.z;
        const inTheWay = dx > -3 && dz > -3 && dx + dz > 2 && Math.hypot(dx, dz) < 16;
        expect(inTheWay, `${tree.kind} at ${tree.x.toFixed(1)}, ${tree.z.toFixed(1)} south-east of ${p.x}, ${p.z}`).toBe(false);
      }
    }
    // The plot has no tree within 10 blocks to its south or east, and the garden none within 12 blocks of its fence there.
    for (const tree of trees) {
      const where = `${tree.kind} at ${tree.x.toFixed(1)}, ${tree.z.toFixed(1)}`;
      expect(tree.x >= g.x - 4 && tree.x < g.x + g.width + 10 && tree.z >= g.z && tree.z < g.z + g.depth + 10, where).toBe(false);
      expect(tree.x >= garden.x - 10 && tree.x <= garden.x + 19 && tree.z >= garden.z - 10 && tree.z <= garden.z + 18, where).toBe(false);
    }
    // And none stands within 5 blocks of the path, where a walker would pass behind it.
    const points = REGION.paths[0].points;
    for (const tree of trees) {
      for (let i = 0; i + 1 < points.length; i++) {
        const [ax, az] = points[i], [bx, bz] = points[i + 1];
        const k = Math.max(0, Math.min(1, ((tree.x - ax) * (bx - ax) + (tree.z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
        expect(Math.hypot(tree.x - ax - (bx - ax) * k, tree.z - az - (bz - az) * k), `${tree.kind} at ${tree.x.toFixed(1)}, ${tree.z.toFixed(1)}`).toBeGreaterThan(6);
      }
    }

    // Keeping trees out costs the meadow about one plant in nine there, not its grass.
    const near = (p: { x: number; z: number }): boolean => p.x >= g.x - 8 && p.x < g.x + g.width + 20 && p.z >= g.z + g.depth && p.z < g.z + g.depth + 14;
    const plain = scatter(SEED, world, { area, density: s.density, blocked: (x, z) => region.isProtected(x, 21, z) });
    const kept = found.props.filter((p) => !isTree(p) && near(p)).length, usual = plain.props.filter((p) => !isTree(p) && near(p)).length;
    expect(usual).toBeGreaterThan(100);
    expect(kept / usual).toBeGreaterThan(0.8);

    // `forest` says the same for a view that passes it on: woods where the terrain grew them, none at the sites.
    for (const name of ['grant.center', 'grant.rocks', 'dead.garden', 'town.square', 'town.gate']) expect(s.forest(at(name).x, at(name).z), name).toBe(0);
    expect(s.forest(60.5, -220.5)).toBe(0);
    let most = 0;
    for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += 4) for (let z = BOUNDS.z0; z <= BOUNDS.z1; z += 4) { const f = s.forest(x, z); expect(f >= 0 && f <= 1).toBe(true); most = Math.max(most, f); }
    expect(most).toBeGreaterThan(0.5);
    const withForest = scatter(SEED, world, { area, density: s.density, blocked: s.blocked, forest: s.forest }).props.filter(isTree);
    expect(withForest.length).toBeGreaterThan(20);
  });

  test('no block tree stands between the camera and where the story is played', () => {
    // The camera looks along the line from south-east to north-west. A crown hides a spot when it stands on that
    // line, or up to 8 blocks to either side of it, on the camera's side and no further than 16 blocks.
    for (const p of [region.spawn(), at('grant.center'), at('grant.rocks'), at('dead.garden'), at('town.gate'), at('town.square'), at('river.bank')]) {
      for (let dx = -6; dx <= 16; dx++) for (let dz = -6; dz <= 16; dz++) {
        if (dx + dz <= 2 || Math.abs(dx - dz) > 8 || Math.hypot(dx, dz) >= 16) continue;
        const x = Math.floor(p.x) + dx, z = Math.floor(p.z) + dz;
        for (let y = p.y + 2; y < p.y + 9; y++) {
          const b = world.getBlock(x, y, z);
          expect(b === id('oak_leaves') || b === id('pine_needles'), `leaves at ${x}, ${y}, ${z} south-east of ${p.x}, ${p.z}`).toBe(false);
        }
      }
    }
  });

  test('no wild tree grows on the grant, the path, the garden or the town', () => {
    const t = REGION.town, g = region.grant();
    const logs = (x0: number, z0: number, x1: number, z1: number): number => count(OAK, x0, z0, x1, z1, 19, 23) + count(BIRCH, x0, z0, x1, z1, 19, 23);
    expect(logs(g.x, g.z, g.x + g.width - 1, g.z + g.depth - 1)).toBe(0);
    // In town the only logs below roof height are posts: lamps, the well, corners of houses and fences. No trunk
    // stands on a street or the square.
    for (let x = 157; x <= 189; x++) for (let z = -161; z <= -139; z++) {
      const lamp = world.getBlock(x, 21, z) === LAMP, well = Math.abs(x - 173) <= 1 && Math.abs(z + 150) <= 1;
      if (!lamp && !well) expect(world.getBlock(x, 20, z), `${x}, ${z}`).toBe(0);
    }
    expect(t.x1 - t.x0).toBeGreaterThan(60);
    // Along the path nothing solid stands on it.
    for (let x = 0; x <= 90; x++) for (const dz of [-1, 0, 1]) expect(standable(world, x, world.heightAt(x, -221 + dz), -221 + dz)).toBe(true);
  });

  test('the town\'s middle and reach cover the square, the gate and the ferry', () => {
    const town = region.townCenter!();
    for (const name of ['town.gate', ...TOWN_PLACES]) expect(flat(town, at(name)), name).toBeLessThanOrEqual(town.radius);
    expect(flat(town, at('grant.stone'))).toBeGreaterThan(town.radius + 60);
    expect(flat(town, at('town.square'))).toBeLessThan(20);
  });
});

describe('making the land', () => {
  const chunkOf = (p: Vec3): [number, number] => [Math.floor(p.x) >> 4, Math.floor(p.z) >> 4];

  test('the same seed gives the same blocks for the chunks that hold the grant and the square', () => {
    for (const name of ['grant.center', 'grant.stone', 'town.square', 'river.bank', 'dead.garden']) {
      const [cx, cz] = chunkOf(at(name));
      const a = new Uint8Array(CELLS), b = new Uint8Array(CELLS).fill(9);
      generateChunk(SEED, cx, cz, a);
      generateChunk(SEED, cx, cz, b);
      expect(a).toEqual(b);
      // What the worker makes, and what the loaded world holds, are those blocks too.
      expect(buildChunk(SEED, cx, cz, null).blocks).toEqual(a);
      expect(world.chunkAt(cx, cz)!.blocks).toEqual(a);
      // And the plan really is in them: these are not chunks of bare meadow.
      const plain = new Set([0, GRASS, id('dirt'), id('stone'), id('sand'), id('clay'), WATER, id('oak_leaves'), OAK, id('lume_crystal')]);
      let planned = 0;
      for (let i = 0; i < CELLS; i++) if (!plain.has(a[i])) planned++;
      if (name !== 'grant.center') expect(planned, name).toBeGreaterThan(0);
    }
  });

  test('a building that crosses a chunk edge is whole', () => {
    const again = new Uint8Array(CELLS);
    for (const b of built()) {
      const crosses = b.x0 >> 4 !== b.x1 >> 4 || b.z0 >> 4 !== b.z1 >> 4;
      for (let cx = b.x0 >> 4; cx <= b.x1 >> 4; cx++) {
        for (let cz = b.z0 >> 4; cz <= b.z1 >> 4; cz++) {
          generateChunk(SEED, cx, cz, again);
          expect(world.chunkAt(cx, cz)!.blocks).toEqual(again);
        }
      }
      // Its four walls are there whichever chunk they fell in: every corner post stands.
      for (const [x, z] of [[b.x0 + 1, b.z0 + 1], [b.x1 - 1, b.z0 + 1], [b.x0 + 1, b.z1 - 1], [b.x1 - 1, b.z1 - 1]]) {
        expect(world.getBlock(x, b.y0 + 1, z), `${b.plan.id} corner ${x}, ${z}, crosses ${crosses}`).toBe(OAK);
      }
    }
    expect(built().some((b) => b.x0 >> 4 !== b.x1 >> 4)).toBe(true);
  });

  test('another seed gets the same plan on its own land: every place can still be stood on', () => {
    const other = new World(5);
    for (const name of PLACES) {
      const p = at(name);
      const [cx, cz] = chunkOf(p);
      other.load(cx, cz);
      expect(standable(other, p.x, p.y, p.z), name).toBe(true);
    }
  });

  test('making a chunk of the region takes under 30 ms on average', () => {
    const list: [number, number][] = [];
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) list.push([cx, cz]);
    buildChunk(SEED, cx0, cz0, null);
    // Each chunk's result is read, so the timed work cannot be skipped: the sum must match the loaded world's.
    const sumOf = (blocks: Uint8Array): number => { let n = 0; for (let i = 0; i < CELLS; i += 97) n += blocks[i]; return n; };
    let made = 0, held = 0;
    const started = performance.now();
    for (const [cx, cz] of list) made += sumOf(buildChunk(SEED, cx, cz, null).blocks);
    const each = (performance.now() - started) / list.length;
    for (const [cx, cz] of list) held += sumOf(world.chunkAt(cx, cz)!.blocks);
    expect(made).toBe(held);
    // The busiest ones alone: the chunks that hold the town.
    const t = REGION.town;
    const town = list.filter(([cx, cz]) => cx >= t.x0 >> 4 && cx <= t.x1 >> 4 && cz >= t.z0 >> 4 && cz <= t.z1 >> 4);
    const townStarted = performance.now();
    for (const [cx, cz] of town) buildChunk(SEED, cx, cz, null);
    const townEach = (performance.now() - townStarted) / town.length;
    console.log(`region: ${list.length} chunks made and lit in ${each.toFixed(2)} ms each on average; the ${town.length} town chunks in ${townEach.toFixed(2)} ms each`);
    expect(each).toBeLessThan(30);
    expect(townEach).toBeLessThan(30);
    expect(CHUNK).toBe(16);
  });
});
