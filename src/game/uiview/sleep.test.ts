import { expect, test } from 'bun:test';
import { World } from '../../features/world/world.sim.ts';
import type { EventName } from '../api.sim.ts';
import { createKernel } from '../kernel.sim.ts';
import { install as installTime } from '../time/index.sim.ts';
import { SLEEP_CARD, SLEEP_DOWN, SLEEP_UP, createSleepCard, hasCurtain } from './sleep.ts';

function night() {
  const kernel = createKernel(new World(1), 1);
  installTime(kernel);
  const game = kernel.game;
  const heard: EventName[] = [];
  game.events.onAny((name) => heard.push(name));
  const time = game.systems.time;
  if (!hasCurtain(time)) throw new Error('the time system takes no sleep curtain');
  time.setTimeOfDay(0.8);
  const card = createSleepCard(game, time);
  /** Steps the rules and the card together, as the shell and the sleep view do. */
  const run = (seconds: number): void => {
    for (let i = 0; i < Math.round(seconds / 0.05); i++) {
      kernel.step();
      card.step(0.05);
    }
  };
  return { game, time, card, heard, run };
}

test('sleep fades to dark first, moves to morning only then, shows the day and the hour, and fades back', () => {
  const { game, time, card, heard, run } = night();
  time.sleep();
  // Nothing has jumped yet: the screen is going dark.
  expect(game.clock.day).toBe(1);
  expect(heard).not.toContain('slept');
  expect(card.frame.active).toBe(true);
  expect(time.canSleep()).toBe(false);
  run(SLEEP_DOWN / 2);
  expect(card.frame.black).toBeGreaterThan(0.2);
  expect(card.frame.black).toBeLessThan(0.8);
  expect(game.clock.day).toBe(1);

  // Dark: the world is at morning, and the card says so.
  run(SLEEP_DOWN / 2 + SLEEP_CARD / 2);
  expect(card.frame.black).toBe(1);
  expect(heard).toContain('slept');
  expect(game.clock.day).toBe(2);
  expect(game.clock.timeOfDay).toBeCloseTo(0.27, 2);
  expect(card.frame.card).toBe(1);
  expect([card.frame.day, card.frame.hour]).toEqual(['Day 2', '06:28']);

  // Then the world comes back, and the player is awake.
  run(SLEEP_CARD / 2 + SLEEP_UP / 2);
  expect(card.frame.card).toBe(0);
  expect(card.frame.black).toBeGreaterThan(0);
  expect(card.frame.black).toBeLessThan(1);
  run(SLEEP_UP);
  expect(card.frame.active).toBe(false);
  expect(card.frame.black).toBe(0);
});

test('every later sleep shows the card too, with its own day, and a second sleep() while falling asleep does nothing', () => {
  const { game, time, card, run } = night();
  time.sleep();
  time.sleep();
  run(SLEEP_DOWN + SLEEP_CARD + SLEEP_UP + 0.1);
  expect(game.clock.day).toBe(2);
  time.setTimeOfDay(0.9);
  time.sleep();
  run(SLEEP_DOWN + 0.1);
  expect(card.frame.day).toBe('Day 3');
  expect(card.frame.card).toBeGreaterThan(0);
  run(SLEEP_CARD + SLEEP_UP);
  expect(game.clock.day).toBe(3);
  expect(card.frame.active).toBe(false);
});

test('without the card, as in the tests of the rules and on a server, sleep is at once', () => {
  const { game, time, card } = night();
  card.dispose();
  time.sleep();
  expect(game.clock.day).toBe(2);
  expect(card.frame.active).toBe(false);
});
