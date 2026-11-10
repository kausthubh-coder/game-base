import { expect, test } from 'bun:test';
import { arcDirection, emptySkyKey, moonArc, moonLit, sampleSky, sunArc, SUN_DOWN, SUN_UP } from './palette.ts';

const luminance = (c: number[]) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
const place = (arc: number) => {
  const out = { x: 0, y: 0, z: 0 };
  arcDirection(arc, out);
  return out;
};

test('night is dark blue, never black', () => {
  const key = emptySkyKey();
  for (const time of [0.85, 0.95, 0, 0.1, 0.17]) {
    sampleSky(time, key);
    // The fill light alone, on a new moon, still lights the ground, and it is blue.
    const fill = key.skyFill.map((c) => (c * key.fillStrength) / Math.PI);
    expect(luminance(fill)).toBeGreaterThan(0.05);
    expect(key.skyFill[2]).toBeGreaterThan(key.skyFill[0] * 2);
    expect(key.skyFill[2]).toBeGreaterThan(key.skyFill[1] * 2);
    // And it is night: darker than noon, with stars out.
    expect(luminance(key.top)).toBeLessThan(0.02);
    expect(key.stars).toBe(1);
    expect(key.night).toBe(1);
  }
  sampleSky(0.5, key);
  expect(key.night).toBe(0);
  expect(key.stars).toBe(0);
  expect(luminance(key.top)).toBeGreaterThan(0.15);
});

test('the look of the sky changes smoothly through the whole day', () => {
  const a = emptySkyKey();
  const b = emptySkyKey();
  const step = 1 / 2400;
  for (let time = 0; time < 1; time += step) {
    sampleSky(time, a);
    sampleSky(time + step, b);
    for (const name of ['top', 'mid', 'bot', 'fog', 'skyFill', 'cloudLit'] as const) {
      for (let c = 0; c < 3; c++) expect(Math.abs(a[name][c] - b[name][c])).toBeLessThan(0.03);
    }
    expect(Math.abs(a.sunStrength - b.sunStrength)).toBeLessThan(0.05);
  }
});

test('the light is out at the two moments the sun and the moon change places', () => {
  const key = emptySkyKey();
  expect(sampleSky(SUN_UP, key).sunStrength).toBeCloseTo(0, 9);
  expect(sampleSky(SUN_DOWN, key).sunStrength).toBeCloseTo(0, 9);
  expect(sampleSky(0.5, key).sunStrength).toBeGreaterThan(1.5);
  expect(sampleSky(0, key).sunStrength).toBeGreaterThan(0.5);
});

test('the sun rises in the east, is highest at noon and sets in the west, and the moon follows it', () => {
  const sunrise = place(sunArc(0.25));
  const noon = place(sunArc(0.5));
  const sunset = place(sunArc(0.75));
  expect(sunrise.x).toBeGreaterThan(0.5);
  expect(sunset.x).toBeLessThan(-0.5);
  expect(noon.y).toBeGreaterThan(sunrise.y);
  expect(noon.y).toBeGreaterThan(0.85);
  // It crosses the horizon as the light changes hands, and is under it at midnight.
  expect(place(sunArc(SUN_UP)).y).toBeCloseTo(0, 2);
  expect(place(sunArc(SUN_DOWN)).y).toBeCloseTo(0, 2);
  expect(place(sunArc(0)).y).toBeLessThan(0);

  expect(place(moonArc(0.75)).x).toBeGreaterThan(0.5);
  expect(place(moonArc(0)).y).toBeGreaterThan(0.85);
  expect(place(moonArc(0.25)).x).toBeLessThan(-0.5);
  expect(place(moonArc(0.5)).y).toBeLessThan(0);
  for (const time of [0, 0.2, 0.4, 0.6, 0.8]) {
    const d = place(sunArc(time));
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
  }
});

test('the moon is dark when new, half lit at the quarters and whole when full', () => {
  expect(moonLit(0)).toBe(0);
  expect(moonLit(2)).toBeCloseTo(0.5, 6);
  expect(moonLit(4)).toBe(1);
  expect(moonLit(6)).toBeCloseTo(0.5, 6);
});
