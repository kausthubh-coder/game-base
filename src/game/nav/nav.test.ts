import { expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import type { World } from '../../features/world/world.sim.ts';
import { STEP } from '../kernel.sim.ts';
import { createNav, install } from './index.sim.ts';
import { canStand } from './nav.sim.ts';
import { FEET, FLOOR, feet, flatWorld, makeStage, wall } from './stage.testkit.ts';
import { walkAlong } from './walk.sim.ts';

const navOn = (world: World) => makeStageFor(world).kernel.game.systems.nav;

function makeStageFor(world: World) {
  const stage = makeStage({ install: [] });
  // The stage's own land is not used: this nav reads the world it is given.
  const nav = createNav({ ...stage.kernel.game, world });
  stage.kernel.add('nav', nav.api, nav.system);
  return stage;
}

/** Every step goes to a neighbor, up or down one block at most, onto a block to stand on, and cuts no corner. */
function expectWalkable(world: World, path: readonly Vec3[]): void {
  for (let i = 0; i < path.length; i++) {
    const p = path[i], x = Math.floor(p.x), z = Math.floor(p.z);
    expect(canStand(world, x, p.y, z)).toBe(true);
    if (i === 0) continue;
    const q = path[i - 1], qx = Math.floor(q.x), qz = Math.floor(q.z);
    const dx = x - qx, dz = z - qz;
    expect(Math.max(Math.abs(dx), Math.abs(dz))).toBe(1);
    expect(Math.abs(p.y - q.y)).toBeLessThanOrEqual(1);
    if (dx !== 0 && dz !== 0) {
      expect(p.y).toBe(q.y);
      expect(canStand(world, x, p.y, qz)).toBe(true);
      expect(canStand(world, qx, p.y, z)).toBe(true);
    }
  }
}

test('a path goes around a wall and up a one-block step', () => {
  const world = flatWorld();
  wall(world, 8, 2, 8, 12); // two blocks high, in the way
  wall(world, 12, 0, 15, 15, 1); // a terrace one block up, behind it
  const nav = navOn(world);

  const from = feet(4, 6), to = feet(13, 6, 1);
  const path = nav.path(from, to)!;
  expect(path).not.toBeNull();
  expect(path[0]).toEqual(from);
  expect(path[path.length - 1]).toEqual(to);
  expectWalkable(world, path);
  // Straight through would be 10 points. The wall makes it longer, and no point is inside the wall.
  expect(path.length).toBeGreaterThan(12);
  expect(path.some((p) => Math.floor(p.x) === 8 && p.z > 2 && p.z < 13)).toBe(false);

  // A walker that follows it gets there, and ends one block higher than it began.
  const pos = { ...from }, walker = { path, next: 1 };
  for (let i = 0; i < 400 && walker.next < path.length; i++) walkAlong(world, pos, walker, 2.2, STEP);
  expect(walker.next).toBe(path.length);
  expect(pos.x).toBeCloseTo(to.x, 5);
  expect(pos.z).toBeCloseTo(to.z, 5);
  expect(pos.y).toBeCloseTo(FEET + 1, 5);
});

test('there is no path through a wall two blocks high, and there is one over a wall one block high', () => {
  const tall = flatWorld();
  wall(tall, 8, 0, 8, 31); // from edge to edge of the land
  expect(navOn(tall).path(feet(4, 6), feet(12, 6))).toBeNull();

  const low = flatWorld();
  wall(low, 8, 0, 8, 31, 1);
  const path = navOn(low).path(feet(4, 6), feet(12, 6))!;
  expectWalkable(low, path);
  expect(path.some((p) => p.y === FEET + 1)).toBe(true);
});

test('a step up needs head room, and a drop of two blocks is not a step', () => {
  const world = flatWorld();
  wall(world, 8, 0, 8, 31, 1);
  // A roof over the near side of the low wall: nobody can rise under it.
  for (let z = 0; z < 32; z++) world.setBlock(7, FEET + 2, z, blockId('stone'));
  expect(navOn(world).path(feet(4, 6), feet(12, 6))).toBeNull();

  const cliff = flatWorld();
  wall(cliff, 0, 0, 7, 31, 2); // a terrace two blocks up
  const nav = navOn(cliff);
  expect(nav.path(feet(4, 6, 2), feet(12, 6))).toBeNull();
  expect(nav.path(feet(12, 6), feet(4, 6, 2))).toBeNull();
});

test('a diagonal step does not cut a corner', () => {
  const world = flatWorld();
  wall(world, 5, 5, 5, 5);
  wall(world, 6, 6, 6, 6);
  const path = navOn(world).path(feet(5, 6), feet(6, 5))!;
  expectWalkable(world, path);
  expect(path.length).toBeGreaterThan(2);
});

test('it gives up after the limit of blocks, 4000 unless told otherwise', () => {
  const world = flatWorld();
  const nav = navOn(world);
  expect(nav.path(feet(2, 2), feet(29, 29))).not.toBeNull();
  expect(nav.path(feet(2, 2), feet(29, 29), 10)).toBeNull();

  // A pen with the goal inside: the search stops at the limit and says there is no way.
  wall(world, 20, 20, 24, 20);
  wall(world, 20, 24, 24, 24);
  wall(world, 20, 20, 20, 24);
  wall(world, 24, 20, 24, 24);
  expect(nav.path(feet(2, 2), feet(22, 22))).toBeNull();
  // `toward` walks as near as it can get instead.
  const part = nav.toward(feet(2, 2), feet(22, 22))!;
  const end = part[part.length - 1];
  expectWalkable(world, part);
  expect(Math.hypot(end.x - 22.5, end.z - 22.5)).toBeLessThan(4);
});

test('water is nowhere to stand, and nowhere to walk', () => {
  const world = flatWorld();
  const nav = navOn(world);
  expect(nav.standable(5, FEET, 5)).toBe(true);
  expect(nav.standable(5.7, FEET + 0.4, 5.2)).toBe(true);
  expect(nav.standable(5, FEET + 1, 5)).toBe(false); // nothing under it
  expect(nav.standable(5, FLOOR, 5)).toBe(false); // inside the ground

  // A ford one block deep from edge to edge: the ground is still there under the water.
  for (let z = 0; z < 32; z++) {
    world.setBlock(8, FLOOR, z, blockId('water'));
    world.setBlock(8, FLOOR - 1, z, blockId('stone'));
  }
  expect(nav.standable(8, FLOOR, 5)).toBe(false);
  expect(nav.path(feet(4, 6), feet(12, 6))).toBeNull();
});

test('near finds the closest block to stand on, and skips the ones it is told to', () => {
  const world = flatWorld();
  wall(world, 10, 10, 10, 10);
  const nav = navOn(world);
  expect(nav.near(feet(4, 4), 3)).toEqual(feet(4, 4));
  const beside = nav.near(feet(10, 10), 3)!;
  expect(Math.hypot(beside.x - 10.5, beside.z - 10.5)).toBe(1);
  const other = nav.near(feet(4, 4), 3, (x, z) => x === 4 && z === 4)!;
  expect(Math.hypot(other.x - 4.5, other.z - 4.5)).toBe(1);
  expect(nav.near({ x: 200.5, y: FEET, z: 200.5 }, 3)).toBeNull();
});

test('a route between named places is worked out once, both ways, until a block on it changes', () => {
  const stage = makeStage({ places: { well: [4, 6], gate: [26, 6] }, install: [install] });
  const { world, kernel } = stage;
  const nav = kernel.game.systems.nav;

  const there = nav.route('well', 'gate')!;
  expectWalkable(world, there);
  expect(there[0]).toEqual(feet(4, 6));
  expect(there[there.length - 1]).toEqual(feet(26, 6));
  expect(nav.route('well', 'gate')).toBe(there);
  const back = nav.route('gate', 'well')!;
  expect(back.map((p) => p.x)).toEqual(there.map((p) => p.x).reverse());

  // A block far from the route leaves it alone.
  world.setBlock(15, FEET, 25, blockId('stone'));
  kernel.game.events.emit('block.placed', { x: 15, y: FEET, z: 25, id: blockId('stone'), by: 'player' });
  expect(nav.route('well', 'gate')).toBe(there);

  // A wall across it makes a new one, there and back.
  wall(world, 15, 2, 15, 12);
  kernel.game.events.emit('block.placed', { x: 15, y: FEET, z: 6, id: blockId('stone'), by: 'player' });
  const around = nav.route('well', 'gate')!;
  expect(around).not.toBe(there);
  expectWalkable(world, around);
  expect(there.every((p) => p.z === 6.5)).toBe(true);
  expect(around.some((p) => p.z < 2 || p.z > 13)).toBe(true);
  expect(nav.route('gate', 'well')).not.toBe(back);
});

test('a route that was not found is tried again when a block changes, or after a while', () => {
  const stage = makeStage({ places: { well: [4, 6], gate: [26, 6] }, install: [install] });
  const { world, kernel } = stage;
  const nav = kernel.game.systems.nav;
  wall(world, 15, 0, 15, 31);
  expect(nav.route('well', 'gate')).toBeNull();

  // The wall opens, but nobody said so: the answer stands for 20 seconds.
  world.setBlock(15, FEET, 6, 0);
  world.setBlock(15, FEET + 1, 6, 0);
  expect(nav.route('well', 'gate')).toBeNull();
  stage.run(21);
  expect(nav.route('well', 'gate')).not.toBeNull();

  wall(world, 15, 0, 15, 31);
  kernel.game.events.emit('block.placed', { x: 15, y: FEET, z: 6, id: blockId('stone'), by: 'player' });
  expect(nav.route('well', 'gate')).toBeNull();
  world.setBlock(15, FEET, 20, 0);
  world.setBlock(15, FEET + 1, 20, 0);
  kernel.game.events.emit('block.broken', { x: 15, y: FEET + 1, z: 20, id: blockId('stone'), by: 'player' });
  expect(nav.route('well', 'gate')).not.toBeNull();
});
