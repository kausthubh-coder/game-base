import { expect, test } from 'bun:test';
import { gust, lifeRates as rates, nextGap } from './ambience.sim.ts';
import { mulberry32 } from './rng.sim.ts';

const lifeRates = (day: number, rain: number, trees: number, water: number, indoors: number, cloud: number) =>
  rates(day, rain, trees, water, indoors, cloud, { birds: 0, crickets: 0, frogs: 0 });

test('the wind gusts: it moves, stays in range and repeats for the same time and seed', () => {
  let low = Infinity;
  let high = -Infinity;
  for (let t = 0; t < 600; t += 0.25) {
    const g = gust(t, 11);
    low = Math.min(low, g);
    high = Math.max(high, g);
    expect(g).toBe(gust(t, 11));
  }
  expect(low).toBeGreaterThanOrEqual(0.3);
  expect(high).toBeLessThanOrEqual(1.4);
  expect(high - low).toBeGreaterThan(0.5);
});

test('calls come about as often as their rate says', () => {
  const rng = mulberry32(5);
  let total = 0;
  for (let i = 0; i < 4000; i++) total += nextGap(0.5, rng);
  expect(total / 4000).toBeGreaterThan(1.7);
  expect(total / 4000).toBeLessThan(2.3);
  expect(nextGap(0, rng)).toBe(1);
});

test('birds by day, crickets and frogs at night', () => {
  const noon = lifeRates(1, 0, 0.5, 0.5, 0, 0);
  const midnight = lifeRates(0, 0, 0.5, 0.5, 0, 0);
  expect(noon.birds).toBeGreaterThan(0.1);
  expect(noon.crickets).toBe(0);
  expect(noon.frogs).toBe(0);
  expect(midnight.birds).toBe(0);
  expect(midnight.crickets).toBeGreaterThan(0.1);
  expect(midnight.frogs).toBeGreaterThan(0.05);
  // Frogs want water. Birds shelter from rain.
  expect(lifeRates(0, 0, 0.5, 0, 0, 0).frogs).toBe(0);
  expect(lifeRates(1, 1, 0.5, 0, 0, 0).birds).toBe(0);
});
