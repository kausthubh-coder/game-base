import { expect, test } from 'bun:test';
import { barOf, beatOf, createConductor, resumeAt, stepTick, targetTempo, TICKS_PER_BAR } from './conductor.sim.ts';

test('the bar counter only goes up, whatever the tempo does', () => {
  const c = createConductor(84, 0);
  let lastBar = 0;
  let lastTime = 0;
  const targets = [84, 108, 60, 150, 72, 96];
  for (let i = 0; i < 4000; i++) {
    stepTick(c, targets[Math.floor(i / 300) % targets.length] as number);
    expect(barOf(c.tick)).toBeGreaterThanOrEqual(lastBar);
    expect(c.time).toBeGreaterThan(lastTime);
    lastBar = barOf(c.tick);
    lastTime = c.time;
  }
  expect(lastBar).toBe(Math.floor(4000 / TICKS_PER_BAR));
});

test('a fight raises the tempo by 20 to 35 percent', () => {
  expect(targetTempo(84, 1, 0, 0, 0) / 84).toBeGreaterThanOrEqual(1.2);
  expect(targetTempo(84, 1, 0, 0, 1) / 84).toBeLessThanOrEqual(1.35);
});

test('the tempo is 1.2 times base inside two bars of a fight starting', () => {
  const c = createConductor(84, 0);
  const target = targetTempo(84, 1, 0, 0, 0);
  let ticks = 0;
  while (c.bpm < 84 * 1.2 && ticks < 1000) {
    stepTick(c, target);
    ticks++;
  }
  expect(ticks).toBeLessThanOrEqual(2 * TICKS_PER_BAR);
});

test('the tempo is back within 3 percent of base inside eight bars of a fight ending', () => {
  const c = createConductor(targetTempo(84, 1, 0, 0, 0), 0);
  let ticks = 0;
  while (c.bpm > 84 * 1.03 && ticks < 2000) {
    stepTick(c, 84);
    ticks++;
  }
  expect(ticks).toBeLessThanOrEqual(8 * TICKS_PER_BAR);
  // It glides: it has not snapped back in the first bar.
  const d = createConductor(targetTempo(84, 1, 0, 0, 0), 0);
  for (let i = 0; i < TICKS_PER_BAR; i++) stepTick(d, 84);
  expect(d.bpm).toBeGreaterThan(84 * 1.1);
});

test('night is about 8 percent slower, and does not slow a fight', () => {
  expect(targetTempo(100, 0, 1, 0, 0)).toBeCloseTo(92, 5);
  expect(targetTempo(100, 1, 1, 0, 0)).toBeCloseTo(targetTempo(100, 1, 0, 0, 0), 5);
});

test('after a stall the clock moves to now and the count carries on', () => {
  const c = createConductor(120, 0);
  for (let i = 0; i < 100; i++) stepTick(c, 120);
  const tick = c.tick;
  resumeAt(c, c.time + 30);
  expect(c.tick).toBe(tick);
  stepTick(c, 120);
  expect(c.tick).toBe(tick + 1);
  expect(beatOf(48 + 12)).toBe(1);
});
