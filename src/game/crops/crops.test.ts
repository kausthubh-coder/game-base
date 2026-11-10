import { expect, test } from 'bun:test';
import { AIR, blockId } from '../../content/blocks.ts';
import type { World } from '../../features/world/world.sim.ts';
import type { GameEvents } from '../api.sim.ts';
import { FLOOR, flatStage, installFakes, topOf } from '../crafting/fakes.ts';
import { crops as cropTable } from '../content/crops.ts';
import { createKernel, type Kernel } from '../kernel.sim.ts';
import { install as installTime } from '../time/index.sim.ts';
import { install } from './index.sim.ts';

const TILLED = blockId('tilled_soil');
const Y = FLOOR;

function setup(world: World = flatStage(), room = Infinity) {
  const kernel = createKernel(world, 7);
  const fakes = installFakes(kernel, room);
  install(kernel);
  const game = kernel.game;
  const heard: string[] = [];
  game.events.onAny((name) => heard.push(name));
  // The first step adds the click handler.
  kernel.step();
  return { kernel, game, world, crops: game.systems.crops, heard, ...fakes };
}

function run(kernel: Kernel, seconds: number): void {
  const steps = Math.round(seconds * 20);
  for (let i = 0; i < steps; i++) kernel.step();
}

/** Tills a block and plants wheat on it. */
function sow(t: ReturnType<typeof setup>, x: number, z: number): void {
  expect(t.crops.till(x, Y, z)).toBe(true);
  expect(t.crops.plant(x, Y, z, 'wheat_seeds')).toBe(true);
}

test('wheat is 4 stages of 45 seconds and gives 2 wheat, and the other crops are slower', () => {
  const [wheat, ...others] = cropTable;
  expect(wheat).toMatchObject({ id: 'wheat', seed: 'wheat_seeds', stages: 4, secondsPerStage: 45, gives: [{ id: 'wheat', count: 2 }] });
  expect(wheat.seedChance).toBeCloseTo(1 / 3, 6);
  expect(others.map((c) => c.id)).toEqual(['turnip', 'carrot']);
  for (const crop of others) expect(crop.secondsPerStage * (crop.stages - 1)).toBeGreaterThan(135);
});

test('a watered wheat reaches stage 3 in 135 seconds and not before', () => {
  const t = setup();
  sow(t, 4, 4);
  expect(t.crops.water(4, Y, 4)).toBe(true);
  const grew: GameEvents['crop.grew'][] = [];
  t.game.events.on('crop.grew', (g) => grew.push(g));

  run(t.kernel, 45 - 0.05);
  expect(t.crops.at(4, Y, 4)).toMatchObject({ crop: 'wheat', stage: 0, ripe: false });
  t.kernel.step();
  expect(t.crops.at(4, Y, 4)?.stage).toBe(1);

  run(t.kernel, 90 - 0.05);
  expect(t.crops.at(4, Y, 4)).toMatchObject({ stage: 2, ripe: false });
  t.kernel.step();
  expect(t.crops.at(4, Y, 4)).toMatchObject({ stage: 3, ripe: true });
  expect(grew.map((g) => g.stage)).toEqual([1, 2, 3]);
  expect(grew[2]).toEqual({ x: 4, y: Y, z: 4, crop: 'wheat', stage: 3 });

  // Ripe is the end: it grows no further.
  run(t.kernel, 100);
  expect(t.crops.at(4, Y, 4)?.stage).toBe(3);
  expect(grew.length).toBe(3);
});

test('dry soil does not grow, and water lasts 3 minutes', () => {
  const t = setup();
  sow(t, 4, 4);
  run(t.kernel, 300);
  expect(t.crops.at(4, Y, 4)).toMatchObject({ stage: 0, wet: 0 });

  // Turnips need 75 seconds a stage, so one watering of 180 seconds brings two stages and no more.
  expect(t.crops.till(8, Y, 8)).toBe(true);
  expect(t.crops.plant(8, Y, 8, 'turnip_seeds')).toBe(true);
  t.crops.water(8, Y, 8);
  expect(t.crops.at(8, Y, 8)?.wet).toBe(180);
  run(t.kernel, 179);
  expect(t.crops.at(8, Y, 8)?.wet).toBeGreaterThan(0);
  run(t.kernel, 1.1);
  expect(t.crops.at(8, Y, 8)?.wet).toBe(0);
  run(t.kernel, 300);
  expect(t.crops.at(8, Y, 8)).toMatchObject({ crop: 'turnip', stage: 2, ripe: false });
});

test('rain waters every crop under open sky', () => {
  const t = setup();
  sow(t, 4, 4);
  sow(t, 6, 4);
  // A roof two blocks over the second crop.
  t.world.setBlock(6, Y + 3, 4, blockId('oak_plank'));
  t.game.ambient.rain = 0.6;
  t.kernel.step();
  expect(t.crops.at(4, Y, 4)?.wet).toBeGreaterThan(179);
  expect(t.crops.at(6, Y, 4)?.wet).toBe(0);
  // While it rains the soil stays wet, and afterwards the water runs down.
  run(t.kernel, 200);
  expect(t.crops.at(4, Y, 4)?.wet).toBeGreaterThan(179);
  expect(t.crops.at(4, Y, 4)?.ripe).toBe(true);
  expect(t.crops.at(6, Y, 4)?.stage).toBe(0);
  t.game.ambient.rain = 0;
  run(t.kernel, 60);
  expect(t.crops.at(4, Y, 4)?.wet).toBeCloseTo(120, 0);
});

test('rain forced through the time system waters the field', () => {
  const world = flatStage();
  const kernel = createKernel(world, 7);
  installFakes(kernel);
  installTime(kernel);
  install(kernel);
  const { crops, time } = kernel.game.systems;
  crops.till(4, Y, 4);
  crops.plant(4, Y, 4, 'wheat_seeds');
  run(kernel, 30);
  expect(crops.at(4, Y, 4)?.wet).toBe(0);
  time.setWeather('rain');
  // The front brings wind and cloud first. The rain is there within 70 seconds.
  run(kernel, 70);
  expect(kernel.game.ambient.rain).toBeGreaterThan(0.3);
  expect(crops.at(4, Y, 4)?.wet).toBeGreaterThan(170);
});

test('sleep adds two stages to a wet crop only', () => {
  const t = setup();
  sow(t, 4, 4);
  sow(t, 8, 8);
  sow(t, 12, 12);
  t.crops.water(4, Y, 4);
  // The third crop is one stage from ripe: it stops at ripe.
  t.crops.water(12, Y, 12);
  run(t.kernel, 91);
  t.crops.water(4, Y, 4);
  run(t.kernel, 10);
  expect(t.crops.at(12, Y, 12)?.stage).toBe(2);

  // A crop at stage 0 for the count of two: plant it now, in soil that the can reaches.
  expect(t.crops.till(5, Y, 4)).toBe(true);
  t.crops.water(4, Y, 4);
  expect(t.crops.plant(5, Y, 4, 'wheat_seeds')).toBe(true);
  expect(t.crops.at(5, Y, 4)).toMatchObject({ stage: 0, wet: 180 });

  t.game.events.emit('slept', { day: 2 });
  expect(t.crops.at(5, Y, 4)).toMatchObject({ stage: 2, ripe: false });
  expect(t.crops.at(8, Y, 8)).toMatchObject({ stage: 0, ripe: false });
  expect(t.crops.at(12, Y, 12)).toMatchObject({ stage: 3, ripe: true });
  // The night dries the soil.
  expect(t.crops.at(5, Y, 4)?.wet).toBe(0);
});

test('the primary button on a ripe crop harvests 2 wheat into the bag', () => {
  const t = setup();
  sow(t, 4, 4);
  t.crops.water(4, Y, 4);
  run(t.kernel, 134);
  // Not ripe yet: the click is left for the next handler.
  expect(t.actions.use({ hit: topOf(t.world, 4, Y, 4), held: null, button: 'primary' })).toBe(false);
  expect(t.bag.count('wheat')).toBe(0);
  run(t.kernel, 1);

  t.heard.length = 0;
  expect(t.actions.use({ hit: topOf(t.world, 4, Y, 4), held: null, button: 'primary' })).toBe(true);
  expect(t.bag.count('wheat')).toBe(2);
  expect(t.bag.count('wheat_seeds')).toBeLessThanOrEqual(1);
  expect(t.crops.at(4, Y, 4)).toBeNull();
  expect(t.crops.all()).toEqual([]);
  expect(t.heard).toContain('crop.harvested');
  expect(t.game.flags.get('harvested.wheat')).toBe(2);
  // The soil stays tilled, ready for the next seed.
  expect(t.world.getBlock(4, Y, 4)).toBe(TILLED);
  expect(t.crops.plant(4, Y, 4, 'wheat_seeds')).toBe(true);
});

test('a harvest gives back a seed about one time in three', () => {
  const t = setup();
  let ripe = 0;
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z += 2) {
      sow(t, x, z);
      ripe++;
    }
  }
  t.game.ambient.rain = 1;
  run(t.kernel, 135);
  for (const { x, y, z } of [...t.crops.all()]) expect(t.crops.harvest(x, y, z)).toBe(true);
  expect(t.bag.count('wheat')).toBe(ripe * 2);
  const share = t.bag.count('wheat_seeds') / ripe;
  expect(share).toBeGreaterThan(0.2);
  expect(share).toBeLessThan(0.47);
});

test('a full bag leaves the ripe crop standing', () => {
  const t = setup(flatStage(), 1);
  sow(t, 4, 4);
  t.crops.water(4, Y, 4);
  run(t.kernel, 135);
  expect(t.crops.harvest(4, Y, 4)).toBe(false);
  expect(t.bag.count('wheat')).toBe(0);
  expect(t.crops.at(4, Y, 4)?.ripe).toBe(true);
});

test('the hoe tills grass and dirt, a seed plants on tilled soil, the can waters nine blocks', () => {
  const t = setup();
  const use = (x: number, z: number) => t.actions.use({ hit: topOf(t.world, x, Y, z), held: t.bag.held(), button: 'secondary' });
  t.bag.add('hoe', 1);
  t.bag.add('watering_can', 1);
  t.bag.add('wheat_seeds', 2);

  // Nothing in the hand does nothing.
  expect(use(4, 4)).toBe(false);

  t.bag.hold('hoe');
  t.world.setBlock(5, Y, 4, blockId('dirt'));
  t.heard.length = 0;
  expect(use(4, 4)).toBe(true);
  expect(use(5, 4)).toBe(true);
  expect(t.world.getBlock(4, Y, 4)).toBe(TILLED);
  expect(t.world.getBlock(5, Y, 4)).toBe(TILLED);
  expect(t.heard).toEqual(['soil.tilled', 'soil.tilled']);
  // The hoe does nothing to soil that is tilled already, or to stone.
  t.world.setBlock(9, Y, 9, blockId('stone'));
  expect(use(4, 4)).toBe(false);
  expect(use(9, 9)).toBe(false);

  t.bag.hold('wheat_seeds');
  // Grass is not soil.
  expect(use(8, 8)).toBe(false);
  expect(t.bag.count('wheat_seeds')).toBe(2);
  expect(use(4, 4)).toBe(true);
  expect(t.bag.count('wheat_seeds')).toBe(1);
  expect(t.crops.at(4, Y, 4)).toMatchObject({ crop: 'wheat', stage: 0, wet: 0, ripe: false });
  // One crop to a block: the second seed stays in the bag.
  expect(use(4, 4)).toBe(true);
  expect(t.bag.count('wheat_seeds')).toBe(1);
  // A block over the soil leaves no room to plant.
  t.world.setBlock(5, Y + 1, 4, blockId('stone'));
  use(5, 4);
  expect(t.crops.at(5, Y, 4)).toBeNull();
  t.world.setBlock(5, Y + 1, 4, AIR);
  expect(use(5, 4)).toBe(true);
  expect(t.bag.count('wheat_seeds')).toBe(0);

  t.bag.hold('watering_can');
  expect(use(8, 8)).toBe(false);
  t.heard.length = 0;
  expect(use(5, 4)).toBe(true);
  expect(t.heard).toEqual(['crop.watered']);
  expect(t.crops.at(4, Y, 4)?.wet).toBe(180);
  expect(t.crops.at(5, Y, 4)?.wet).toBe(180);
});

test('the can waters the eight neighbors, and soil watered before planting is still wet', () => {
  const t = setup();
  for (let x = 3; x <= 7; x++) for (let z = 3; z <= 7; z++) t.crops.till(x, Y, z);
  t.crops.water(5, Y, 5);
  for (let x = 3; x <= 7; x++) {
    for (let z = 3; z <= 7; z++) {
      t.crops.plant(x, Y, z, 'wheat_seeds');
      const near = Math.abs(x - 5) <= 1 && Math.abs(z - 5) <= 1;
      expect(t.crops.at(x, Y, z)?.wet).toBe(near ? 180 : 0);
    }
  }
  expect(t.crops.all().length).toBe(25);
  // Grass is not soil, so there is nothing to water.
  expect(t.crops.water(12, Y, 12)).toBe(false);
});

test('crop.watered is sent once for a use of the can, at a crop when one was watered', () => {
  const t = setup();
  const watered: GameEvents['crop.watered'][] = [];
  t.game.events.on('crop.watered', (w) => watered.push(w));
  for (let x = 3; x <= 5; x++) t.crops.till(x, Y, 4);
  // Bare soil all round: the event is where the can was aimed.
  t.crops.water(4, Y, 4);
  // A crop beside bare soil: the event is at the crop.
  t.crops.plant(5, Y, 4, 'wheat_seeds');
  t.crops.water(4, Y, 4);
  // A crop under the can and another beside it: the event is under the can.
  t.crops.plant(4, Y, 4, 'wheat_seeds');
  t.crops.water(4, Y, 4);
  t.crops.water(3, Y, 4);
  expect(watered).toEqual([
    { x: 4, y: Y, z: 4 },
    { x: 5, y: Y, z: 4 },
    { x: 4, y: Y, z: 4 },
    { x: 4, y: Y, z: 4 },
  ]);
});

test('town ground cannot be tilled', () => {
  const t = setup();
  t.kernel.add('region', {
    spawn: () => ({ x: 0, y: 0, z: 0 }),
    places: () => [],
    place: (name) => ({ name, at: { x: 0, y: 0, z: 0 }, label: '' }),
    grant: () => ({ x: 0, z: 0, width: 8, depth: 8 }),
    isProtected: (x) => x >= 8,
  }, {});
  expect(t.crops.till(9, Y, 4)).toBe(false);
  expect(t.world.getBlock(9, Y, 4)).toBe(blockId('grass'));
  expect(t.crops.till(7, Y, 4)).toBe(true);
});

test('breaking the soil destroys the crop and gives back its seed', () => {
  const t = setup();
  sow(t, 4, 4);
  sow(t, 6, 6);
  t.world.setBlock(4, Y, 4, AIR);
  t.game.events.emit('block.broken', { x: 4, y: Y, z: 4, id: TILLED, by: 'player' });
  expect(t.crops.at(4, Y, 4)).toBeNull();
  expect(t.bag.count('wheat_seeds')).toBe(1);
  expect(t.crops.all().map((c) => [c.x, c.z])).toEqual([[6, 6]]);

  // A block set down on a crop does the same.
  t.world.setBlock(6, Y + 1, 6, blockId('oak_plank'));
  t.game.events.emit('block.placed', { x: 6, y: Y + 1, z: 6, id: blockId('oak_plank'), by: 'player' });
  expect(t.crops.all()).toEqual([]);
  expect(t.bag.count('wheat_seeds')).toBe(2);
});

test('save then load keeps a half-grown crop', () => {
  const t = setup();
  sow(t, 4, 4);
  sow(t, 8, 8);
  t.crops.till(10, Y, 10);
  t.crops.water(4, Y, 4);
  t.crops.water(10, Y, 10);
  // One stage and 20 seconds of the next.
  run(t.kernel, 65);
  const save = JSON.parse(JSON.stringify(t.kernel.save()));

  const again = setup(t.world);
  again.kernel.load(save);
  expect(again.crops.all().length).toBe(2);
  expect(again.crops.at(4, Y, 4)).toMatchObject({ crop: 'wheat', stage: 1, ripe: false });
  expect(again.crops.at(4, Y, 4)?.wet).toBeCloseTo(115, 1);
  expect(again.crops.at(8, Y, 8)).toMatchObject({ crop: 'wheat', stage: 0, wet: 0 });
  // The 20 seconds were kept: stage 2 comes 25 seconds later, not 45.
  run(again.kernel, 24.9);
  expect(again.crops.at(4, Y, 4)?.stage).toBe(1);
  run(again.kernel, 0.2);
  expect(again.crops.at(4, Y, 4)?.stage).toBe(2);
  // The bare wet soil was kept too: a seed planted there now is in wet soil.
  expect(again.crops.plant(10, Y, 10, 'wheat_seeds')).toBe(true);
  expect(again.crops.at(10, Y, 10)?.wet).toBeGreaterThan(80);
});
