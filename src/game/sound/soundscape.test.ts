import { expect, test } from 'bun:test';
import { BEDS, SPOTS, WELL_AT } from '../content/soundscape.ts';
import { SAMPLES } from '../../content/sound-samples.ts';
import { REGION } from '../content/region.ts';
import { bedLevels, gaitOf, hoursWeight, SpotClock, stepMaterial, zonesAt, type Zones } from './soundscape.sim.ts';

const zones = (): Zones => ({ town: 0, square: 0, bank: 0, lane: 0 });
const levelsAt = (x: number, z: number, hour: number, forest = 0): Record<string, number> => bedLevels(zonesAt(x, z, zones()), { x, z, hour, forest }, {});
const square = REGION.places.find((p) => p.name === 'town.square')!;
const bank = REGION.places.find((p) => p.name === 'river.bank')!;
const stone = REGION.places.find((p) => p.name === 'grant.stone')!;

test('every bed and spot names a recording the sound tool makes', () => {
  const made = new Set(SAMPLES.map((s) => s.id));
  for (const rule of [...BEDS, ...SPOTS]) expect(made.has(rule.id)).toBe(true);
});

test('the square at noon is the murmur and the market; the meadow is quiet of the town', () => {
  const noon = levelsAt(square.x, square.z, 12);
  expect(noon['bed.town.murmur']).toBeGreaterThan(0.8);
  expect(noon['bed.town.square']).toBeGreaterThan(0.7);
  expect(noon['bed.meadow.day']).toBe(0);
  expect(noon['bed.town.night']).toBe(0);
  const field = levelsAt(stone.x, stone.z, 12);
  expect(field['bed.town.murmur']).toBe(0);
  expect(field['bed.meadow.day']).toBeGreaterThan(0.7);
});

test('the bank is the water, with the town murmur softer than on the square', () => {
  const quay = levelsAt(bank.x, bank.z, 12);
  const middle = levelsAt(square.x, square.z, 12);
  expect(quay['bed.town.water']).toBeGreaterThan(0.9);
  expect(middle['bed.town.water']).toBeLessThan(0.1);
  expect(quay['bed.town.murmur']).toBeLessThan(middle['bed.town.murmur'] as number);
});

test('night swaps the day for crickets and lanterns, and the workshop rests', () => {
  const night = levelsAt(square.x, square.z, 23);
  expect(night['bed.town.murmur']).toBe(0);
  expect(night['bed.town.night']).toBeGreaterThan(0.7);
  expect(night['bed.town.lantern']).toBeGreaterThan(0.3);
  expect(levelsAt(150, -158, 23)['bed.town.workshop']).toBe(0);
  expect(levelsAt(150, -158, 11)['bed.town.workshop']).toBeGreaterThan(0.7);
});

test('walking from the field to the square, no bed jumps: each step of a block moves a level by little', () => {
  let last = levelsAt(60, -221, 12);
  for (let i = 1; i <= 200; i++) {
    const t = i / 200;
    const x = 60 + (WELL_AT.x - 60) * t, z = -221 + (WELL_AT.z + 221) * t;
    const now = levelsAt(x, z, 12);
    for (const id of Object.keys(now)) expect(Math.abs((now[id] as number) - (last[id] as number))).toBeLessThan(0.12);
    last = now;
  }
});

test('under trees the forest bed takes over from the meadow bed', () => {
  const open = levelsAt(stone.x, stone.z, 12, 0);
  const wood = levelsAt(stone.x, stone.z, 12, 1);
  expect(open['bed.forest.day']).toBe(0);
  expect(wood['bed.forest.day']).toBeGreaterThan(0.7);
  expect(wood['bed.meadow.day']).toBe(0);
});

test('the hours ease in and out', () => {
  expect(hoursWeight('day', 12)).toBe(1);
  expect(hoursWeight('day', 2)).toBe(0);
  expect(hoursWeight('day', 6.2)).toBeGreaterThan(0.2);
  expect(hoursWeight('day', 6.2)).toBeLessThan(0.8);
  expect(hoursWeight('night', 2)).toBe(1);
});

test('spot sounds come at their own pace, only in their zone, never in a burst on arrival', () => {
  let seed = 7;
  const rng = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const clock = new SpotClock(rng);
  const inSquare = zonesAt(square.x, square.z, zones());
  const fired: Record<string, number> = {};
  for (let t = 0; t < 600; t += 0.25) clock.step(t, inSquare, 12, (rule) => { fired[rule.id] = (fired[rule.id] ?? 0) + 1; });
  // Ten minutes on the square at noon: the well every half a minute or so, a stall every quarter, no boat.
  expect(fired['spot.well']).toBeGreaterThan(8);
  expect(fired['spot.well']).toBeLessThan(30);
  expect(fired['spot.stall']).toBeGreaterThan(20);
  expect(fired['spot.boat'] ?? 0).toBe(0);
  const fresh = new SpotClock(rng);
  let first = 0;
  for (let t = 0; t < 3; t += 0.25) fresh.step(t, inSquare, 12, () => first++);
  expect(first).toBeLessThanOrEqual(1);
});

test('a foot knows a path from a field, a floor from a bridge and cobbles from rock', () => {
  expect(stepMaterial('path', 'dirt', false)).toBe('path');
  expect(stepMaterial('dirt', 'dirt', false)).toBe('dirt');
  expect(stepMaterial('cobble', 'stone', false)).toBe('cobble');
  expect(stepMaterial('mossy_stone', 'stone', false)).toBe('stone');
  expect(stepMaterial('oak_plank', 'wood', false)).toBe('wood');
  expect(stepMaterial('oak_plank', 'wood', true)).toBe('floor');
  expect(stepMaterial('sand', 'water', false)).toBe('water');
  expect(stepMaterial('lamp', 'metal', false)).toBe(null);
  expect(gaitOf(2)).toBe('soft');
  expect(gaitOf(4.4)).toBe('walk');
  expect(gaitOf(7)).toBe('run');
});
