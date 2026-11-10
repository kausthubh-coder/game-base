import { expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { weatherTable } from '../../content/weather.ts';
import type { World } from '../../features/world/world.sim.ts';
import type { GameEvents } from '../api.sim.ts';
import { FLOOR, flatStage, installFakes } from '../crafting/fakes.ts';
import { createKernel, type Kernel } from '../kernel.sim.ts';
import { DAY_LENGTH, install } from './index.sim.ts';

function setup(world: World = flatStage(), seed = 7) {
  const kernel = createKernel(world, seed);
  const fakes = installFakes(kernel);
  install(kernel);
  const game = kernel.game;
  const days: number[] = [];
  const nights: number[] = [];
  const slept: number[] = [];
  game.events.on('day.started', (e: GameEvents['day.started']) => days.push(e.day));
  game.events.on('night.started', (e) => nights.push(e.day));
  game.events.on('slept', (e) => slept.push(e.day));
  game.player.pos.x = 4.5;
  game.player.pos.y = FLOOR + 1;
  game.player.pos.z = 4.5;
  return { kernel, game, world, time: game.systems.time, days, nights, slept, ...fakes };
}

function run(kernel: Kernel, seconds: number, each?: () => void): void {
  const steps = Math.round(seconds * 20);
  for (let i = 0; i < steps; i++) {
    kernel.step();
    each?.();
  }
}

/** A bed beside the player and a roof over their head. */
function shelter(t: ReturnType<typeof setup>): void {
  t.placeables.stand('bed', { x: 6, y: FLOOR + 1, z: 4 });
  t.world.setBlock(4, FLOOR + 3, 4, blockId('oak_plank'));
}

test('a day is 12 minutes and the game starts at dawn on day 1', () => {
  const t = setup();
  expect(t.time.dayLength).toBe(720);
  expect(t.game.clock.day).toBe(1);
  expect(t.game.clock.timeOfDay).toBeCloseTo(0.27, 9);
  expect(t.game.clock.seconds).toBe(0);
  run(t.kernel, 10);
  expect(t.game.clock.seconds).toBeCloseTo(10, 6);
  expect(t.game.clock.timeOfDay).toBeGreaterThan(0.27);
  expect(t.game.ambient.timeOfDay).toBe(t.game.clock.timeOfDay);
  // A whole day later the dial reads the same, and it only ever moved forward.
  let last = t.game.clock.timeOfDay, turned = 0;
  run(t.kernel, DAY_LENGTH, () => {
    turned += (t.game.clock.timeOfDay - last + 1) % 1;
    last = t.game.clock.timeOfDay;
  });
  expect(turned).toBeCloseTo(1, 6);
  expect(t.game.clock.day).toBe(2);
  expect(t.game.clock.seconds).toBeCloseTo(730, 6);
});

test('noon comes halfway through the light, and night passes faster than day', () => {
  const t = setup();
  // 12 minutes hold the weather clock's 20 in proportion: 36 s of dawn, 432 of light, 36 of dusk, 216 of night.
  run(t.kernel, 216);
  expect(t.game.clock.timeOfDay).toBeCloseTo(0.5, 3);
  run(t.kernel, 216);
  expect(t.game.clock.timeOfDay).toBeCloseTo(0.73, 3);
  // Half a second past dawn, so the step that crosses it is not in question.
  run(t.kernel, 36 + 216 + 0.5);
  expect(t.game.clock.timeOfDay).toBeCloseTo(0.23, 2);
  expect(t.game.clock.day).toBe(2);
});

test('dawn sends day.started once a day, and dusk sends night.started once a day', () => {
  const t = setup();
  t.kernel.step();
  // The first morning counts too.
  expect(t.days).toEqual([1]);
  const dayAt: number[] = [], nightAt: number[] = [];
  let seen = 1, seenNights = 0;
  run(t.kernel, 3 * DAY_LENGTH, () => {
    if (t.days.length > seen) {
      seen = t.days.length;
      dayAt.push(t.game.clock.timeOfDay);
    }
    if (t.nights.length > seenNights) {
      seenNights = t.nights.length;
      nightAt.push(t.game.clock.timeOfDay);
    }
  });
  expect(t.days).toEqual([1, 2, 3, 4]);
  expect(t.nights).toEqual([1, 2, 3]);
  for (const time of dayAt) expect(time).toBeCloseTo(0.23, 3);
  for (const time of nightAt) expect(time).toBeCloseTo(0.73, 3);
  expect(t.game.clock.day).toBe(4);
});

test('day 1 is clear, and the weather runs by itself from day 2', () => {
  const t = setup();
  const clear = weatherTable.clear;
  run(t.kernel, DAY_LENGTH - 40, () => {
    const a = t.game.ambient;
    if (a.rain !== 0 || a.fog !== 0 || Math.abs(a.cloud - clear.cloud) > 1e-9) throw new Error(`day 1 was not clear at ${t.game.clock.seconds}`);
  });
  expect(t.game.clock.day).toBe(1);
  // Over the next four days the machine changes the weather by itself.
  const clouds = new Set<number>();
  run(t.kernel, 4 * DAY_LENGTH, () => clouds.add(Math.round(t.game.ambient.cloud * 10)));
  expect(clouds.size).toBeGreaterThan(2);
});

test('every number in the ambient stays between 0 and 1', () => {
  const t = setup(flatStage(), 11);
  t.time.setWeather('storm');
  run(t.kernel, 2 * DAY_LENGTH, () => {
    const a = t.game.ambient;
    for (const value of [a.timeOfDay, a.rain, a.cloud, a.fog, a.wind, a.wetness, a.flash]) {
      if (!(value >= 0 && value <= 1)) throw new Error(`out of range: ${JSON.stringify(a)}`);
    }
  });
  expect(t.game.ambient.rain).toBe(1);
  expect(t.game.ambient.wetness).toBe(1);
});

test('setWeather() forces a kind, and null lets the weather go', () => {
  const t = setup();
  t.time.setWeather('rain');
  run(t.kernel, 30);
  // A front: the wind and the cloud come before the rain.
  expect(t.game.ambient.rain).toBe(0);
  expect(t.game.ambient.cloud).toBeGreaterThan(weatherTable.clear.cloud);
  run(t.kernel, 40);
  expect(t.game.ambient.rain).toBeCloseTo(weatherTable.rain.rain, 5);
  // It holds for as long as it is forced, here until the next day.
  run(t.kernel, DAY_LENGTH);
  expect(t.game.ambient.rain).toBeCloseTo(weatherTable.rain.rain, 5);
  expect(t.game.ambient.wetness).toBeGreaterThan(0.9);

  t.time.setWeather(null);
  run(t.kernel, 20);
  expect(t.game.ambient.rain).toBe(0);
  run(t.kernel, 60);
  expect(t.game.ambient.cloud).toBeCloseTo(weatherTable.clear.cloud, 5);
});

test('setWeather(kind, true) settles the kind at once, with no front', () => {
  const t = setup();
  t.time.setWeather('rain');
  run(t.kernel, 120);
  expect(t.game.ambient.rain).toBeCloseTo(weatherTable.rain.rain, 5);

  // A scripted moment that skipped the afternoon: the rain is gone on the spot, and stays gone.
  t.time.setWeather('clear', true);
  expect(t.game.ambient.rain).toBe(0);
  expect(t.game.ambient.cloud).toBeCloseTo(weatherTable.clear.cloud, 5);
  run(t.kernel, 60, () => expect(t.game.ambient.rain).toBe(0));

  // And the other way: rain at once.
  t.time.setWeather('rain', true);
  expect(t.game.ambient.rain).toBeCloseTo(weatherTable.rain.rain, 5);
  run(t.kernel, 30);
  expect(t.game.ambient.rain).toBeCloseTo(weatherTable.rain.rain, 5);
});

test('on day 1 letting the weather go brings clear back and keeps it', () => {
  const t = setup();
  t.time.setWeather('fog');
  run(t.kernel, 70);
  expect(t.game.ambient.fog).toBeCloseTo(1, 5);
  t.time.setWeather(null);
  run(t.kernel, 500, () => {
    if (t.game.ambient.rain !== 0) throw new Error('it rained on day 1');
  });
  expect(t.game.clock.day).toBe(1);
  expect(t.game.ambient.fog).toBe(0);
  expect(t.game.ambient.cloud).toBeCloseTo(weatherTable.clear.cloud, 5);
});

test('thunder reaches its listeners in a storm', () => {
  const t = setup();
  let claps = 0;
  const off = t.time.onThunder?.(() => claps++);
  t.time.setWeather('storm');
  run(t.kernel, 240);
  expect(claps).toBeGreaterThan(5);
  off?.();
  const heard = claps;
  run(t.kernel, 120);
  expect(claps).toBe(heard);
});

test('canSleep() needs the evening or the night, a bed within 4 blocks and a roof', () => {
  const t = setup();
  shelter(t);
  // Morning.
  expect(t.time.canSleep()).toBe(false);
  t.time.setTimeOfDay(0.5);
  expect(t.time.canSleep()).toBe(false);
  t.time.setTimeOfDay(0.65);
  expect(t.time.canSleep()).toBe(false);
  for (const time of [0.67, 0.75, 0.9, 0, 0.1, 0.22]) {
    t.time.setTimeOfDay(time);
    expect(t.time.canSleep()).toBe(true);
  }
  t.time.setTimeOfDay(0.24);
  expect(t.time.canSleep()).toBe(false);

  t.time.setTimeOfDay(0.8);
  // Out from under the roof.
  t.game.player.pos.x = 5.5;
  expect(t.time.canSleep()).toBe(false);
  t.game.player.pos.x = 4.5;
  expect(t.time.canSleep()).toBe(true);
});

test('canSleep() takes one block over the bed as the roof, with the player beside the bed in the open', () => {
  const t = setup();
  t.placeables.stand('bed', { x: 6, y: FLOOR + 1, z: 4 });
  t.time.setTimeOfDay(0.8);
  // No roof over the bed and none over the player.
  expect(t.time.canSleep()).toBe(false);
  // The bed fills its block, so nobody can stand under the block that covers it.
  t.world.setBlock(6, FLOOR + 2, 4, blockId('oak_plank'));
  expect(t.time.canSleep()).toBe(true);
  // The hour still counts.
  t.time.setTimeOfDay(0.5);
  expect(t.time.canSleep()).toBe(false);
  t.time.setTimeOfDay(0.8);
  // And so does the distance: a roofed bed more than 4 blocks away is not in reach.
  t.game.player.pos.x = 0.5;
  expect(t.time.canSleep()).toBe(false);
  t.game.player.pos.x = 2.5;
  expect(t.time.canSleep()).toBe(true);
});

test('canSleep() is false when the bed is more than 4 blocks away', () => {
  const t = setup();
  t.world.setBlock(4, FLOOR + 3, 4, blockId('oak_plank'));
  t.time.setTimeOfDay(0.8);
  expect(t.time.canSleep()).toBe(false);
  t.placeables.stand('bed', { x: 9, y: FLOOR + 1, z: 4.5 });
  expect(t.time.canSleep()).toBe(false);
  t.placeables.stand('bed', { x: 8.5, y: FLOOR + 1, z: 4.5 });
  expect(t.time.canSleep()).toBe(true);
});

test('sleep() jumps to 0.27 of the next day and sends day.started, then slept', () => {
  const t = setup();
  const order: string[] = [];
  t.game.events.onAny((name) => order.push(name));
  run(t.kernel, 500);
  order.length = 0;
  const before = t.game.clock.seconds;
  expect(t.game.clock.timeOfDay).toBeGreaterThan(0.75);

  t.time.sleep();
  expect(t.game.clock.day).toBe(2);
  expect(t.game.clock.timeOfDay).toBeCloseTo(0.27, 9);
  expect(t.game.ambient.timeOfDay).toBeCloseTo(0.27, 9);
  // The night that was skipped counts as game time: 720 - 536 seconds to dawn, and 36 of dawn.
  expect(t.game.clock.seconds - before).toBeCloseTo(220, 6);
  expect(order).toEqual(['day.started', 'slept']);
  expect(t.days).toEqual([1, 2]);
  expect(t.slept).toEqual([2]);

  // The new day is announced once, and its dusk still comes.
  run(t.kernel, DAY_LENGTH - 40);
  expect(t.days).toEqual([1, 2]);
  expect(t.nights).toEqual([1, 2]);
  run(t.kernel, 40);
  expect(t.days).toEqual([1, 2, 3]);
});

test('sleeping after midnight wakes the same morning, one day number on', () => {
  const t = setup();
  t.kernel.step();
  t.time.setTimeOfDay(0.1);
  expect(t.game.clock.day).toBe(1);
  t.time.sleep();
  expect(t.game.clock.day).toBe(2);
  expect(t.game.clock.timeOfDay).toBeCloseTo(0.27, 9);
  expect(t.slept).toEqual([2]);
});

test('setTimeOfDay() jumps the dial within the day, and game time never runs back', () => {
  const t = setup();
  run(t.kernel, 100);
  const before = t.game.clock.seconds;
  t.time.setTimeOfDay(0.74);
  expect(t.game.clock.timeOfDay).toBeCloseTo(0.74, 9);
  expect(t.game.clock.day).toBe(1);
  expect(t.game.clock.seconds).toBeGreaterThan(before + 300);
  expect(t.nights).toEqual([]);
  t.kernel.step();
  expect(t.nights).toEqual([1]);

  const evening = t.game.clock.seconds;
  t.time.setTimeOfDay(0.4);
  expect(t.game.clock.timeOfDay).toBeCloseTo(0.4, 9);
  expect(t.game.clock.day).toBe(1);
  expect(t.game.clock.seconds).toBe(evening);
  // Dusk comes round again, and night.started is not sent twice for one day.
  run(t.kernel, 400);
  expect(t.nights).toEqual([1]);
});

test('save then load keeps the clock, the day and the forced weather', () => {
  const t = setup();
  t.time.setWeather('rain');
  run(t.kernel, 600);
  expect(t.nights).toEqual([1]);
  const save = JSON.parse(JSON.stringify(t.kernel.save()));

  const again = setup(t.world, 99);
  again.kernel.load(save);
  expect(again.game.clock.day).toBe(1);
  expect(again.game.clock.timeOfDay).toBeCloseTo(t.game.clock.timeOfDay, 9);
  expect(again.game.clock.seconds).toBeCloseTo(600, 6);
  // The rain is there at once, not a minute later, and it is still held.
  expect(again.game.ambient.rain).toBeCloseTo(weatherTable.rain.rain, 5);
  // The events of the saved day are not sent again, and the next dawn is.
  run(again.kernel, 10);
  expect(again.days).toEqual([]);
  expect(again.nights).toEqual([]);
  run(again.kernel, 190);
  expect(again.game.ambient.rain).toBeCloseTo(weatherTable.rain.rain, 5);
  expect(again.days).toEqual([2]);
  expect(again.game.clock.day).toBe(2);
  again.time.setWeather(null);
  run(again.kernel, 30);
  expect(again.game.ambient.rain).toBe(0);
});

test('a save from a clear day 1 loads clear, and a save from day 3 keeps the weather it had', () => {
  const t = setup();
  run(t.kernel, 100);
  const early = JSON.parse(JSON.stringify(t.kernel.save()));
  const first = setup(t.world, 3);
  first.kernel.load(early);
  run(first.kernel, 400, () => {
    if (first.game.ambient.rain !== 0) throw new Error('it rained on day 1 after a load');
  });

  t.time.setWeather('overcast');
  run(t.kernel, 2 * DAY_LENGTH);
  const late = JSON.parse(JSON.stringify(t.kernel.save()));
  const second = setup(t.world, 3);
  second.kernel.load(late);
  expect(second.game.clock.day).toBe(3);
  expect(second.game.ambient.cloud).toBeCloseTo(weatherTable.overcast.cloud, 5);
});
