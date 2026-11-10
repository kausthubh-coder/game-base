import { expect, test } from 'bun:test';
import { calmNoon, type Ambient } from '../../engine/types.ts';
import { dayLight, lightCurve, type Rgb } from './light.ts';

const at = (timeOfDay: number, more: Partial<Ambient> = {}): Rgb => dayLight({ ...calmNoon(), cloud: 0, timeOfDay, ...more }, [0, 0, 0]);
const brightness = (c: Rgb): number => c[0] * 0.3 + c[1] * 0.5 + c[2] * 0.2;

test('noon is bright and close to white', () => {
  const noon = at(0.5);
  expect(noon).toEqual([1, 1, 0.96]);
});

test('night is dim and blue, but never black', () => {
  for (const time of [0, 0.05, 0.1, 0.9, 0.99]) {
    const night = at(time);
    expect(brightness(night)).toBeLessThan(0.35);
    expect(brightness(night)).toBeGreaterThan(0.15);
    expect(night[2]).toBeGreaterThan(night[0] * 1.5);
  }
  // Midnight is the same at both ends of the dial.
  expect(at(0)).toEqual(at(1));
  expect(at(-0.25)).toEqual(at(0.75));
});

test('sunrise and sunset are warm: more red than blue', () => {
  for (const time of [0.262, 0.715, 0.75]) {
    const warm = at(time);
    expect(warm[0]).toBeGreaterThan(warm[2] * 1.3);
    expect(brightness(warm)).toBeGreaterThan(0.55);
  }
});

test('the light changes smoothly through the day', () => {
  let before = at(0);
  for (let step = 1; step <= 1000; step++) {
    const now = at(step / 1000);
    for (let c = 0; c < 3; c++) expect(Math.abs(now[c] - before[c])).toBeLessThan(0.02);
    before = now;
  }
});

test('cloud and rain grey the light and dim it, and lightning adds a flash', () => {
  const clear = at(0.5), overcast = at(0.5, { cloud: 1 }), rain = at(0.5, { rain: 1 });
  expect(brightness(overcast)).toBeLessThan(brightness(clear) * 0.8);
  expect(brightness(overcast)).toBeGreaterThan(brightness(clear) * 0.6);
  expect(rain).toEqual(overcast);
  // Warm evening light loses most of its color under cloud.
  const dusk = at(0.715), dullDusk = at(0.715, { cloud: 1 });
  expect(dullDusk[0] - dullDusk[2]).toBeLessThan((dusk[0] - dusk[2]) * 0.5);
  const flash = at(0.95, { flash: 1 });
  expect(brightness(flash)).toBeGreaterThan(brightness(at(0.95)) + 0.8);
});

test('it fills the array it is given and makes no new one', () => {
  const out: Rgb = [9, 9, 9];
  expect(dayLight(calmNoon(), out)).toBe(out);
  expect(out[0]).toBeLessThan(1.01);
});

test('each light level down is a fifth darker, as on the terrain', () => {
  expect(lightCurve(15)).toBe(1);
  expect(lightCurve(14)).toBeCloseTo(0.8, 12);
  expect(lightCurve(13)).toBeCloseTo(0.64, 12);
  expect(lightCurve(0)).toBeCloseTo(0.8 ** 15, 12);
  expect(lightCurve(-3)).toBe(lightCurve(0));
  expect(lightCurve(99)).toBe(1);
});
