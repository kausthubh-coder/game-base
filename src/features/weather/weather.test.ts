import { expect, test } from 'bun:test';
import { calendar, lightningRules, weatherTable, type WeatherKind } from '../../content/weather.ts';
import type { GameEvent } from '../../engine/events.ts';
import { createClock, DAY_SECONDS, daySecondAt, dayPartAt, moonPhaseOn, timeOfDayAt } from './clock.sim.ts';
import { createWeather, WEATHER_KINDS, type Weather } from './weather.sim.ts';

const STEP = 0.05;

function run(weather: Weather, seconds: number, each?: (time: number) => void): void {
  const steps = Math.round(seconds / STEP);
  for (let i = 1; i <= steps; i++) {
    weather.step(STEP);
    each?.(i * STEP);
  }
}

// ---------------------------------------------------------------- the clock and the moon

test('a day is 20 minutes: 1 of dawn, 12 of light, 1 of dusk and 6 of night', () => {
  expect(DAY_SECONDS).toBe(1200);
  const seconds: Record<string, number> = { dawn: 0, day: 0, dusk: 0, night: 0 };
  for (let s = 0; s < DAY_SECONDS; s++) seconds[dayPartAt(s + 0.5)]++;
  expect(seconds).toEqual({ dawn: 60, day: 720, dusk: 60, night: 360 });
});

test('the dial follows the contract: sunrise at 0.25, noon at 0.5, sunset at 0.75, midnight at 0', () => {
  expect(dayPartAt(daySecondAt(0.25))).toBe('dawn');
  expect(dayPartAt(daySecondAt(0.5))).toBe('day');
  expect(daySecondAt(0.5)).toBeCloseTo(calendar.dawnSeconds + calendar.lightSeconds / 2, 6);
  expect(dayPartAt(daySecondAt(0.75))).toBe('dusk');
  expect(dayPartAt(daySecondAt(0))).toBe('night');
  // The dial only ever moves forward, and one day later it reads the same.
  let last = timeOfDayAt(0);
  let turned = 0;
  for (let s = 1; s <= DAY_SECONDS; s++) {
    const now = timeOfDayAt(s);
    turned += (now - last + 1) % 1;
    last = now;
  }
  expect(turned).toBeCloseTo(1, 6);
  for (const s of [0, 30, 419, 800, 1100]) expect(daySecondAt(timeOfDayAt(s))).toBeCloseTo(s, 6);
});

test('the clock counts days from dawn and shows the hour', () => {
  const clock = createClock(0.5);
  expect(clock.label()).toBe('12:00');
  expect(clock.day).toBe(0);
  clock.advance(DAY_SECONDS);
  expect(clock.day).toBe(1);
  expect(clock.timeOfDay).toBeCloseTo(0.5, 6);
  clock.setTimeOfDay(0.75);
  expect(clock.day).toBe(1);
  expect(clock.label()).toBe('18:00');
  expect(clock.part).toBe('dusk');
});

test('the moon has 8 phases over a 28 day month and keeps one phase all night', () => {
  const phases: number[] = [];
  for (let day = 0; day < 28; day++) phases.push(moonPhaseOn(day));
  expect(new Set(phases).size).toBe(8);
  for (let phase = 0; phase < 8; phase++) {
    const days = phases.filter((p) => p === phase).length;
    expect(days === 3 || days === 4).toBe(true);
  }
  // It steps forward one phase at a time and repeats every month.
  for (let day = 1; day < 28; day++) expect([0, 1]).toContain((phases[day] - phases[day - 1] + 8) % 8);
  for (let day = 0; day < 28; day++) expect(moonPhaseOn(day + 28)).toBe(phases[day]);
  expect(moonPhaseOn(0)).toBe(calendar.firstMoonPhase);

  const clock = createClock(0.77);
  const atDusk = clock.moonPhase;
  clock.advance(calendar.nightSeconds - 1);
  expect(clock.part).toBe('night');
  expect(clock.moonPhase).toBe(atDusk);
});

// ---------------------------------------------------------------- fronts

test('a front arrives in order: wind first, then cloud, then rain, in about a minute', () => {
  const weather = createWeather({ seed: 1, start: 'clear' });
  const before = { ...weather.ambient };
  weather.set('rain', { hold: true });
  const target = weatherTable.rain;
  const halfway: Record<string, number> = {};
  let rainAtHalfMinute = -1;
  run(weather, 90, (time) => {
    const a = weather.ambient;
    // The gust wobbles the wind a little, so read its middle through a wide band.
    if (halfway.wind === undefined && a.wind > before.wind + (target.wind - before.wind) * 0.6) halfway.wind = time;
    if (halfway.cloud === undefined && a.cloud > (before.cloud + target.cloud) / 2) halfway.cloud = time;
    if (halfway.rain === undefined && a.rain > target.rain / 2) halfway.rain = time;
    if (Math.abs(time - 30) < STEP / 2) rainAtHalfMinute = a.rain;
  });
  expect(halfway.wind).toBeLessThan(halfway.cloud);
  expect(halfway.cloud).toBeLessThan(halfway.rain);
  expect(rainAtHalfMinute).toBe(0);
  expect(halfway.rain).toBeGreaterThan(40);
  expect(halfway.rain).toBeLessThan(70);
  expect(weather.ambient.rain).toBeCloseTo(target.rain, 5);
  expect(weather.ambient.cloud).toBeCloseTo(target.cloud, 5);
});

test('leaving weather stops raining first and calms last', () => {
  const weather = createWeather({ seed: 2, start: 'storm' });
  weather.set('clear', { hold: true });
  const done: Record<string, number> = {};
  run(weather, 90, (time) => {
    const a = weather.ambient;
    if (done.rain === undefined && a.rain < 0.02) done.rain = time;
    if (done.cloud === undefined && a.cloud < weatherTable.clear.cloud + 0.02) done.cloud = time;
    if (done.wind === undefined && a.wind < weatherTable.clear.wind + 0.05) done.wind = time;
  });
  expect(done.rain).toBeLessThan(done.cloud);
  expect(done.cloud).toBeLessThan(done.wind);
});

// ---------------------------------------------------------------- wetness

test('wetness rises in rain and dries afterwards', () => {
  const weather = createWeather({ seed: 3, start: 'clear', startTimeOfDay: 0.4 });
  expect(weather.ambient.wetness).toBe(0);
  weather.set('rain', { hold: true });
  let last = 0;
  let fell = false;
  run(weather, 200, () => {
    if (weather.ambient.wetness < last) fell = true;
    last = weather.ambient.wetness;
  });
  expect(fell).toBe(false);
  expect(weather.ambient.wetness).toBeGreaterThan(0.9);

  weather.set('clear', { hold: true });
  const wet = weather.ambient.wetness;
  run(weather, 60);
  expect(weather.ambient.wetness).toBeLessThan(wet);
  expect(weather.ambient.wetness).toBeGreaterThan(0);
  run(weather, 400);
  expect(weather.ambient.wetness).toBe(0);
});

// ---------------------------------------------------------------- the seed

interface Sample {
  kind: WeatherKind;
  rain: number;
  cloud: number;
  fog: number;
  wind: number;
  windDir: number;
  wetness: number;
  timeOfDay: number;
  strikes: number;
}

function hourOf(seed: number, step = STEP): Sample[] {
  const weather = createWeather({ seed });
  const samples: Sample[] = [];
  const perSecond = Math.round(1 / step);
  for (let second = 0; second < 3600; second++) {
    for (let i = 0; i < perSecond; i++) weather.step(step);
    const a = weather.ambient;
    samples.push({ kind: weather.kind, rain: a.rain, cloud: a.cloud, fog: a.fog, wind: a.wind, windDir: a.windDir, wetness: a.wetness, timeOfDay: a.timeOfDay, strikes: weather.strike.count });
  }
  return samples;
}

test('the same seed gives the same weather for an hour of game time', () => {
  const first = hourOf(77);
  const again = hourOf(77);
  expect(again).toEqual(first);
  // The machine really changes the weather, and another seed gives another hour.
  expect(new Set(first.map((s) => s.kind)).size).toBeGreaterThanOrEqual(3);
  const other = hourOf(78);
  expect(other.map((s) => s.kind)).not.toEqual(first.map((s) => s.kind));
});

test('the kinds of weather come at the same times whatever the frame rate', () => {
  const fine = hourOf(77).map((s) => s.kind);
  const coarse = hourOf(77, 0.25).map((s) => s.kind);
  expect(coarse).toEqual(fine);
});

test('every Ambient number stays between 0 and 1 through a month of weather', () => {
  const weather = createWeather({ seed: 5 });
  const seen = new Set<WeatherKind>();
  for (let i = 0; i < (28 * DAY_SECONDS) / 0.5; i++) {
    weather.step(0.5);
    seen.add(weather.kind);
    const a = weather.ambient;
    for (const value of [a.timeOfDay, a.rain, a.cloud, a.fog, a.wind, a.wetness, a.flash, weather.motes, weather.rainbow]) {
      expect(value >= 0 && value <= 1).toBe(true);
    }
    expect(a.windDir >= 0 && a.windDir < Math.PI * 2).toBe(true);
  }
  for (const kind of WEATHER_KINDS) if (kind !== 'motes') expect(seen.has(kind)).toBe(true);
});

test('the glowing motes are rare and only start around dusk', () => {
  let starts = 0;
  for (const seed of [11, 12, 13]) {
    const weather = createWeather({ seed });
    let last: WeatherKind = weather.kind;
    for (let i = 0; i < (56 * DAY_SECONDS) / 0.5; i++) {
      weather.step(0.5);
      if (weather.kind === 'motes' && last !== 'motes') {
        starts++;
        expect(weather.ambient.timeOfDay).toBeGreaterThan(0.65);
        expect(weather.ambient.timeOfDay).toBeLessThan(0.77);
      }
      last = weather.kind;
    }
  }
  // Three runs of two months: a few times a month means a handful, not every day.
  expect(starts).toBeGreaterThan(2);
  expect(starts).toBeLessThan(3 * 56 * 0.4);
});

// ---------------------------------------------------------------- lightning and thunder

test('thunder is delayed by distance', () => {
  // `time` is how long after the two strikes each clap is heard.
  const heard: { time: number; event: GameEvent }[] = [];
  let struckAt = 0;
  const weather: Weather = createWeather({ seed: 9, start: 'clear', emit: (event) => heard.push({ time: weather.elapsed - struckAt, event }) });
  const listener = { x: 10, y: 0, z: -4 };
  weather.step(STEP, listener);
  struckAt = weather.elapsed;

  weather.strikeNow(800);
  const far = { ...weather.strike };
  weather.strikeNow(100);
  const near = { ...weather.strike };
  expect(weather.strike.count).toBe(2);
  expect(Math.hypot(near.x - listener.x, near.z - listener.z)).toBeCloseTo(100, 6);

  run(weather, 4);
  expect(heard.map((h) => h.event.type)).toEqual(['thunder', 'thunder']);
  // The near strike came second and is heard first.
  const [firstClap, secondClap] = heard;
  expect(firstClap.event).toEqual({ type: 'thunder', at: { x: near.x, y: near.y, z: near.z } });
  expect(secondClap.event).toEqual({ type: 'thunder', at: { x: far.x, y: far.y, z: far.z } });
  expect(firstClap.time).toBeGreaterThanOrEqual(100 / lightningRules.soundSpeed);
  expect(firstClap.time).toBeLessThan(100 / lightningRules.soundSpeed + 2 * STEP);
  expect(secondClap.time).toBeGreaterThanOrEqual(800 / lightningRules.soundSpeed);
  expect(secondClap.time).toBeLessThan(800 / lightningRules.soundSpeed + 2 * STEP);
});

test('a storm flashes to 1 on the step it strikes and thunders once for each strike', () => {
  let claps = 0;
  const weather = createWeather({ seed: 21, start: 'clear', emit: (event) => { if (event.type === 'thunder') claps++; } });
  weather.set('storm', { hold: true });
  let strikes = 0;
  let firstStrikeAt = -1;
  let afterStrike = -1;
  run(weather, 240, (time) => {
    if (weather.strike.count > strikes) {
      strikes = weather.strike.count;
      expect(weather.ambient.flash).toBe(1);
      expect(weather.strike.distance).toBeGreaterThanOrEqual(lightningRules.nearest);
      expect(weather.strike.distance).toBeLessThanOrEqual(lightningRules.farthest);
      if (firstStrikeAt < 0) firstStrikeAt = time;
      afterStrike = 0;
    } else if (afterStrike >= 0) {
      afterStrike += STEP;
      expect(weather.ambient.flash).toBeLessThan(1);
      if (afterStrike > 1.2) expect(weather.ambient.flash).toBe(0);
    }
  });
  // Lightning waits for the rain, then comes several times a minute.
  expect(firstStrikeAt).toBeGreaterThan(40);
  expect(strikes).toBeGreaterThan(6);
  weather.set('clear', { hold: true });
  run(weather, 10);
  expect(weather.strike.count).toBe(strikes);
  expect(claps).toBe(strikes);
});

test('a held kind stays until the machine is resumed', () => {
  const weather = createWeather({ seed: 4 });
  weather.set('fog', { hold: true, instant: true });
  weather.step(STEP);
  expect(weather.ambient.fog).toBe(1);
  run(weather, 1800);
  expect(weather.kind).toBe('fog');
  expect(weather.changeIn).toBe(Infinity);
  weather.resume();
  run(weather, 1800);
  expect(weather.kind).not.toBe('fog');
});
