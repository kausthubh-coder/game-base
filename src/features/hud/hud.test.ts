import { describe, expect, test } from 'bun:test';
import { calmNoon } from '../../engine/types.ts';
import { BOOK, barFraction, clampScale, clockMinutes, clockText, contrast, isDay, weatherIcon } from './hud.sim.ts';

describe('the clock', () => {
  test('midnight, sunrise, noon and sunset', () => {
    expect([0, 0.25, 0.5, 0.75].map(clockText)).toEqual(['00:00', '06:00', '12:00', '18:00']);
  });

  test('it wraps past midnight and pads the numbers', () => {
    expect(clockText(1)).toBe('00:00');
    expect(clockText(1.5)).toBe('12:00');
    expect(clockText(-0.25)).toBe('18:00');
    expect(clockText(9.5 / 24)).toBe('09:30');
    expect(clockText(0.99999)).toBe('23:59');
  });

  test('the text changes once a minute', () => {
    const minute = 1 / 1440;
    expect(clockMinutes(0.5)).toBe(720);
    expect(clockMinutes(0.5 + minute * 0.5)).toBe(720);
    expect(clockMinutes(0.5 + minute)).toBe(721);
  });

  test('day is from sunrise to sunset', () => {
    expect([0.1, 0.25, 0.5, 0.74, 0.75, 0.9].map(isDay)).toEqual([false, true, true, true, false, false]);
  });
});

describe('the weather picture', () => {
  const sky = (change: Partial<ReturnType<typeof calmNoon>>) => ({ ...calmNoon(), ...change });

  test('a calm noon is the sun, and a calm midnight is the moon', () => {
    expect(weatherIcon(calmNoon())).toBe('sun');
    expect(weatherIcon(sky({ timeOfDay: 0 }))).toBe('moon');
  });

  test('each kind of weather from the weather table has its picture', () => {
    expect(weatherIcon(sky({ cloud: 0.3, wind: 0.65 }))).toBe('wind');
    expect(weatherIcon(sky({ cloud: 0.9, fog: 0.08, wind: 0.3 }))).toBe('cloud');
    expect(weatherIcon(sky({ cloud: 0.85, rain: 0.6, fog: 0.2, wind: 0.45 }))).toBe('rain');
    expect(weatherIcon(sky({ cloud: 1, rain: 1, fog: 0.3, wind: 1 }))).toBe('storm');
    expect(weatherIcon(sky({ cloud: 0.5, fog: 1, wind: 0.08 }))).toBe('fog');
  });

  test('the worst thing wins, and lightning in rain is a storm', () => {
    expect(weatherIcon(sky({ rain: 0.5, flash: 1 }))).toBe('storm');
    expect(weatherIcon(sky({ rain: 0.2, fog: 1, cloud: 1 }))).toBe('rain');
    expect(weatherIcon(sky({ fog: 0.6, cloud: 1, wind: 1 }))).toBe('fog');
    // A front on its way in: a little rain is not yet rain.
    expect(weatherIcon(sky({ rain: 0.05, cloud: 0.7 }))).toBe('cloud');
  });
});

describe('bars and size', () => {
  test('a bar is a fraction from 0 to 1', () => {
    expect([barFraction(50, 100), barFraction(120, 100), barFraction(-5, 100), barFraction(5, 0)]).toEqual([0.5, 1, 0, 0]);
  });

  test('the size setting stays within what the layout can take', () => {
    expect([clampScale(1), clampScale(0.2), clampScale(3), clampScale(Number.NaN)]).toEqual([1, 0.8, 1.4, 1]);
  });
});

describe('the book colors', () => {
  test('ink and soft ink are readable on parchment, light and deep', () => {
    expect(contrast(0x000000, 0xffffff)).toBeCloseTo(21, 5);
    for (const paper of [BOOK.parchment, BOOK.parchmentDeep]) {
      expect(contrast(BOOK.ink, paper)).toBeGreaterThan(7);
      expect(contrast(BOOK.inkSoft, paper)).toBeGreaterThan(4.5);
    }
  });
});
