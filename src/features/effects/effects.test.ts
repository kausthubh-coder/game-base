import { expect, test } from 'bun:test';
import { effectBudget, effects, footstepEffect, surfaceColor, type EffectEntry, type EffectId } from '../../content/effects.ts';
import { calmNoon, type Ambient, type Surface } from '../../engine/types.ts';
import { flatWorld, type WorldQuery } from '../../engine/world-query.ts';
import { playEvent } from './event-effects.ts';
import { createParticleStore, STRIDE } from './particles.ts';
import { createWeatherEmitters } from './weather-emitters.ts';

const FRAME = 1 / 60;
const IDS = Object.keys(effects) as EffectId[];
const entry = (id: EffectId): EffectEntry => effects[id];
const SURFACES: Surface[] = ['grass', 'tallGrass', 'dirt', 'stone', 'wood', 'sand', 'water', 'snow', 'leaves', 'metal'];

function storm(): Ambient {
  return { ...calmNoon(), rain: 1, cloud: 1, wind: 1, fog: 0.3, windDir: 0.7 };
}

/** Reads one particle back out of the pool. */
function particle(data: Float32Array, slot: number) {
  const o = slot * STRIDE;
  return {
    x: data[o], y: data[o + 1], z: data[o + 2], born: data[o + 3],
    vx: data[o + 4], vy: data[o + 5], vz: data[o + 6], life: data[o + 7],
    r: data[o + 8], g: data[o + 9], b: data[o + 10],
  };
}

test('the pool never passes 2,000 particles in five minutes of storm with effects firing every frame', () => {
  expect(effectBudget.particles).toBe(2000);
  const store = createParticleStore();
  const weather = createWeatherEmitters(store);
  const ambient = storm();
  const focus = { x: 0, y: 0, z: 0 };
  let most = 0;
  let mostWeather = 0;
  let refused = 0;
  for (let frame = 0; frame < 5 * 60 * 60; frame++) {
    store.advance(FRAME);
    weather.update(FRAME, ambient, flatWorld, focus, 1);
    for (const id of IDS) if (!entry(id).weather && store.emit(id, 1, 0.5, 1) === 0) refused++;
    most = Math.max(most, store.live);
    mostWeather = Math.max(mostWeather, store.liveWeather);
    expect(store.live).toBeLessThanOrEqual(2000);
    expect(store.highWater).toBeLessThanOrEqual(2000);
  }
  // This load is far more than the pool holds: it filled up, turned particles away and stayed at its limit.
  expect(most).toBe(2000);
  expect(refused).toBeGreaterThan(0);
  expect(mostWeather).toBeLessThanOrEqual(effectBudget.weather);
});

test('a storm alone settles at a steady count and leaves room for other effects', () => {
  const store = createParticleStore();
  const weather = createWeatherEmitters(store);
  const ambient = storm();
  const focus = { x: 0, y: 0, z: 0 };
  const atMinute: number[] = [];
  for (let frame = 1; frame <= 5 * 60 * 60; frame++) {
    store.advance(FRAME);
    weather.update(FRAME, ambient, flatWorld, focus, 0);
    if (frame % 3600 === 0) atMinute.push(store.live);
  }
  // Flat from the first minute to the fifth: no leak. And real rain, not a trickle.
  for (const live of atMinute) {
    expect(live).toBeGreaterThan(900);
    expect(live).toBeLessThanOrEqual(effectBudget.weather);
    expect(Math.abs(live - atMinute[0])).toBeLessThan(120);
  }
  expect(store.emit('chips', 0, 1, 0)).toBe(effects.chips.count);
});

test('weather can fill only its own share of the pool', () => {
  const store = createParticleStore({ capacity: 100, weatherCapacity: 60 });
  let started = 0;
  for (let i = 0; i < 100; i++) if (store.put('rain', 0, 10, 0, 0, -10, 0, 5)) started++;
  expect(started).toBe(60);
  expect(store.liveWeather).toBe(60);
  // The rest is still there for a hit or a broken block.
  expect(store.emit('chips', 0, 1, 0)).toBe(effects.chips.count);
  expect(store.live).toBe(60 + effects.chips.count);
});

test('a particle that has ended frees its slot, and the slot is used again', () => {
  const store = createParticleStore();
  expect(store.emit('chips', 0, 1, 0)).toBe(effects.chips.count);
  expect(store.live).toBe(effects.chips.count);
  expect(store.highWater).toBe(effects.chips.count);
  store.advance(effects.chips.life[1] + 0.01);
  expect(store.live).toBe(0);
  expect(store.highWater).toBe(0);
  store.emit('chips', 0, 1, 0);
  expect(store.highWater).toBe(effects.chips.count);

  // Short-lived particles born after a long-lived one leave no gap behind them: the drawn range shrinks back.
  store.clear();
  store.put('leaf', 0, 5, 0, 0, -1, 0, 8);
  for (let i = 0; i < 500; i++) store.put('rain', 0, 10, 0, 0, -15, 0, 0.5);
  store.put('leaf', 0, 5, 0, 0, -1, 0, 8);
  expect(store.highWater).toBe(502);
  store.advance(1);
  expect(store.live).toBe(2);
  store.put('leaf', 0, 5, 0, 0, -1, 0, 8);
  expect(store.highWater).toBe(502);
  store.advance(8);
  expect(store.highWater).toBe(0);
  for (let i = 0; i < 40; i++) store.put('rain', 0, 10, 0, 0, -15, 0, 0.5);
  expect(store.highWater).toBe(40);

  // A full pool refuses, then takes particles again once the old ones end.
  store.clear();
  let filled = 0;
  while (store.put('trail', 0, 0, 0, 0, 1, 0, 2)) filled++;
  expect(filled).toBe(2000);
  expect(store.emit('dust', 0, 0, 0)).toBe(0);
  store.advance(2.01);
  expect(store.live).toBe(0);
  expect(store.emit('dust', 0, 0, 0)).toBe(effects.dust.count);
});

test('an entry plays with its own count, life, speed and color', () => {
  const store = createParticleStore();
  const started = store.emit('trail', 5, 2, -3);
  expect(started).toBe(effects.trail.count);
  for (let slot = 0; slot < started; slot++) {
    const p = particle(store.data, slot);
    expect(Math.hypot(p.x - 5, p.z + 3)).toBeLessThanOrEqual(effects.trail.radius + 1e-5);
    expect(p.life).toBeGreaterThanOrEqual(effects.trail.life[0] - 1e-5);
    expect(p.life).toBeLessThanOrEqual(effects.trail.life[1] + 1e-5);
    const speed = Math.hypot(p.vx, p.vy, p.vz);
    expect(speed).toBeGreaterThanOrEqual(effects.trail.speed[0] - 1e-4);
    expect(speed).toBeLessThanOrEqual(effects.trail.speed[1] + 1e-4);
    expect(p.vy).toBeGreaterThan(0);
    // It glows: brighter than plain white would be.
    expect(p.r).toBeGreaterThan(1);
  }
  // Other entries named in `with` play at the same point.
  store.clear();
  expect(store.emit('splash', 0, 0, 0)).toBe(effects.splash.count + effects.splashRing.count);
});

test('options change the color, the count and where a trail ends', () => {
  const store = createParticleStore();
  store.emit('chips', 0, 1, 0, { color: 0xff0000 });
  for (let slot = 0; slot < effects.chips.count; slot++) {
    const p = particle(store.data, slot);
    expect(p.r).toBeGreaterThan(0.8);
    expect(p.g).toBe(0);
    expect(p.b).toBe(0);
  }
  store.clear();
  expect(store.emit('chips', 0, 1, 0, { scale: 2 })).toBe(effects.chips.count * 2);

  store.clear();
  const target = { x: 4, y: 3, z: -2 };
  const started = store.emit('trail', 0, 0, 0, { target });
  for (let slot = 0; slot < started; slot++) {
    const p = particle(store.data, slot);
    // Without the entry's own drift, each one is headed for the target and gets there as its life ends.
    const aimed = Math.hypot(p.x + p.vx * p.life - target.x, p.y + p.vy * p.life - target.y, p.z + p.vz * p.life - target.z);
    expect(aimed).toBeLessThanOrEqual(effects.trail.speed[1] * p.life + 1e-3);
  }
});

test('the quality switch halves the count on slow machines', () => {
  const store = createParticleStore();
  store.quality = 0.5;
  expect(store.emit('chips', 0, 1, 0)).toBe(effects.chips.count / 2);
  const weather = createWeatherEmitters(store);
  const full = createParticleStore();
  const fullWeather = createWeatherEmitters(full);
  for (let frame = 0; frame < 600; frame++) {
    store.advance(FRAME);
    full.advance(FRAME);
    weather.update(FRAME, storm(), flatWorld, { x: 0, y: 0, z: 0 }, 0);
    fullWeather.update(FRAME, storm(), flatWorld, { x: 0, y: 0, z: 0 }, 0);
  }
  expect(store.liveWeather / full.liveWeather).toBeGreaterThan(0.4);
  expect(store.liveWeather / full.liveWeather).toBeLessThan(0.6);
});

test('chips end when they reach the ground', () => {
  const store = createParticleStore();
  store.groundAt = () => 0;
  store.emit('chips', 0, 0.2, 0);
  for (let slot = 0; slot < effects.chips.count; slot++) {
    const p = particle(store.data, slot);
    const y = p.y + p.vy * p.life - 0.5 * effects.chips.gravity * p.life * p.life;
    expect(y).toBeGreaterThan(-0.25);
  }
});

test('game events play the right effect', () => {
  const at = { x: 1, y: 0, z: 1 };
  const store = createParticleStore();
  expect(playEvent(store, { type: 'footstep', surface: 'water', at })).toBe(effects.splash.count + effects.splashRing.count);
  expect(playEvent(store, { type: 'footstep', surface: 'tallGrass', at })).toBe(effects.flecks.count);
  expect(playEvent(store, { type: 'footstep', surface: 'sand', at })).toBe(effects.dust.count);
  expect(playEvent(store, { type: 'footstep', surface: 'metal', at })).toBe(0);
  expect(playEvent(store, { type: 'land', surface: 'sand', at })).toBe(effects.dust.count * 2);
  expect(playEvent(store, { type: 'blockPlaced', surface: 'stone', at })).toBe(effects.pop.count + effects.popDust.count);
  expect(playEvent(store, { type: 'pickup', at })).toBe(effects.trail.count);
  expect(playEvent(store, { type: 'ui', sound: 'click' })).toBe(0);
  expect(playEvent(store, { type: 'thunder', at })).toBe(0);

  // Chips take the color of the surface that broke.
  store.clear();
  expect(playEvent(store, { type: 'blockBroken', surface: 'snow', at })).toBe(effects.chips.count);
  const chip = particle(store.data, 0);
  expect(chip.r).toBeGreaterThan(0.6);
  expect(chip.b).toBeGreaterThan(chip.r);
});

test('rain splashes only under an open sky and never on water', () => {
  const store = createParticleStore();
  const weather = createWeatherEmitters(store);
  const still = { ...storm(), wind: 0 };
  // A roof covers everything east of x = 0, and a pond lies north of z = -10.
  const world: WorldQuery = {
    ...flatWorld,
    openSky: (x) => x < 0,
    surfaceAt: (_x, z) => (z < -10 ? 'water' : 'grass'),
  };
  const splashes: { x: number; z: number }[] = [];
  let streaks = 0;
  for (let frame = 0; frame < 300; frame++) {
    store.advance(FRAME);
    store.clearDirty();
    weather.update(FRAME, still, world, { x: 0, y: 0, z: 0 }, 0);
    for (let slot = store.dirtyFrom; slot < store.dirtyTo; slot++) {
      const p = particle(store.data, slot);
      if (p.born < store.now - 1e-6) continue;
      if (p.vy < -10) streaks++;
      else if (p.y < 0.1) splashes.push({ x: p.x, z: p.z });
    }
  }
  expect(streaks).toBeGreaterThan(1000);
  expect(splashes.length).toBeGreaterThan(100);
  for (const splash of splashes) {
    expect(splash.x).toBeLessThan(0);
    expect(splash.z).toBeGreaterThanOrEqual(-10);
  }
});

test('fireflies come out at night and the motes only when asked for', () => {
  const live = (ambient: Ambient, motes: number) => {
    const store = createParticleStore();
    const weather = createWeatherEmitters(store);
    for (let frame = 0; frame < 600; frame++) {
      store.advance(FRAME);
      weather.update(FRAME, ambient, flatWorld, { x: 0, y: 0, z: 0 }, motes);
    }
    return store.live;
  };
  const calm = { ...calmNoon(), wind: 0 };
  const noon = live(calm, 0);
  const night = live({ ...calm, timeOfDay: 0.95 }, 0);
  const rainyNight = live({ ...calm, timeOfDay: 0.95, rain: 0.6 }, 0);
  const seedfall = live({ ...calm, timeOfDay: 0.74 }, 1);
  expect(noon).toBeLessThan(10);
  expect(night).toBeGreaterThan(noon + 25);
  expect(seedfall).toBeGreaterThan(noon + 100);
  // In rain there are rain particles instead, and no additive glow at all.
  expect(rainyNight).toBeGreaterThan(300);
});

test('every entry is playable and every surface has a footstep and a color', () => {
  for (const id of IDS) {
    const e = entry(id);
    expect(e.count).toBeGreaterThan(0);
    expect(e.life[0]).toBeGreaterThan(0);
    expect(e.life[1]).toBeGreaterThanOrEqual(e.life[0]);
    expect(e.speed[1]).toBeGreaterThanOrEqual(e.speed[0]);
    expect(e.size[0]).toBeGreaterThan(0);
    for (const other of e.with ?? []) expect(IDS).toContain(other as EffectId);
    const store = createParticleStore();
    expect(store.emit(id, 0, 1, 0, { scale: e.weather ? 1 / e.count : 1 })).toBeGreaterThan(0);
  }
  for (const surface of SURFACES) {
    expect(footstepEffect[surface] === null || IDS.includes(footstepEffect[surface].effect)).toBe(true);
    expect(surfaceColor[surface]).toBeGreaterThan(0);
  }
  expect(Object.keys(footstepEffect).sort()).toEqual([...SURFACES].sort());
});

test('the pool pulls its clock back after 17 minutes without losing or reviving a particle', () => {
  const store = createParticleStore();
  // An old particle that ended long ago, in the slot the next one will not use.
  store.put('trail', 0, 0, 0, 0, 1, 0, 1);
  store.put('leaf', 0, 5, 0, 0, -1, 0, 2000);
  for (let second = 0; second < 1022; second++) store.advance(1);
  expect(store.live).toBe(1);
  store.put('leaf', 0, 5, 0, 0, -1, 0, 5);
  const before = store.now;
  store.advance(3);
  // The clock went back, and both living particles kept their age.
  expect(store.now).toBeLessThan(before);
  expect(store.live).toBe(2);
  const young = particle(store.data, 0);
  expect(store.now - young.born).toBeCloseTo(3, 4);
  expect(store.now - particle(store.data, 1).born).toBeCloseTo(1025, 3);
  store.advance(1.9);
  expect(store.live).toBe(2);
  store.advance(0.2);
  expect(store.live).toBe(1);
  // The slot of the particle that ended first now holds the young leaf. Nothing dead is left with a birth
  // time still ahead of the clock, which is what would bring it back.
  for (let slot = 0; slot < store.capacity; slot++) expect(store.data[slot * STRIDE + 3]).toBeLessThanOrEqual(store.now);
});
