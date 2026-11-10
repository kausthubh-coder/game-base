import { describe, expect, test } from 'bun:test';
import { FrameStats } from './stats.sim.ts';
import { Governor } from './governor.sim.ts';

describe('frame stats', () => {
  test('the average and the worst 1 percent', () => {
    const stats = new FrameStats(200);
    for (let i = 0; i < 198; i++) stats.push(10);
    stats.push(50); stats.push(50);
    expect(stats.frames).toBe(200);
    expect(stats.meanMs()).toBeCloseTo(10.4, 5);
    expect(stats.fps()).toBeCloseTo(1000 / 10.4, 5);
    expect(stats.low1Fps()).toBeCloseTo(20, 5);
    expect(stats.fps(2)).toBeCloseTo(20, 5);
  });

  test('old frames fall out of the ring', () => {
    const stats = new FrameStats(100);
    for (let i = 0; i < 100; i++) stats.push(100);
    for (let i = 0; i < 100; i++) stats.push(16);
    expect(stats.fps()).toBeCloseTo(62.5, 5);
    expect(stats.low1Fps()).toBeCloseTo(62.5, 5);
  });

  test('an empty meter reads zero', () => {
    const stats = new FrameStats();
    expect([stats.fps(), stats.low1Fps(), stats.meanMs()]).toEqual([0, 0, 0]);
  });
});

function feed(g: Governor, seconds: number, fps: number): number {
  let changes = 0;
  for (let i = 0; i < seconds * 60; i++) if (g.update(1 / 60, fps)) changes++;
  return changes;
}

describe('automatic quality', () => {
  test('lowers the render size first and effects second', () => {
    const g = new Governor();
    expect(g.step).toEqual({ quality: 'high', scale: 1 });
    feed(g, 1.9, 40);
    expect(g.level).toBe(0);
    feed(g, 0.2, 40);
    expect(g.step).toEqual({ quality: 'high', scale: 0.85 });
    feed(g, 2.1, 40);
    expect(g.step).toEqual({ quality: 'high', scale: 0.7 });
    feed(g, 2.1, 40);
    expect(g.step).toEqual({ quality: 'medium', scale: 0.7 });
    feed(g, 10, 40);
    expect(g.step).toEqual({ quality: 'low', scale: 0.7 });
  });

  test('a short dip does nothing, and a rate between the marks holds still', () => {
    const g = new Governor();
    feed(g, 1.5, 30); feed(g, 0.1, 60); feed(g, 1.5, 30);
    expect(g.level).toBe(0);
    g.reset(2);
    expect(feed(g, 60, 54)).toBe(0);
    expect(g.level).toBe(2);
  });

  test('raises again when the rate holds above 58, effects first', () => {
    const g = new Governor();
    g.reset(4);
    feed(g, 3.9, 60);
    expect(g.level).toBe(4);
    feed(g, 0.2, 60);
    expect(g.step).toEqual({ quality: 'medium', scale: 0.7 });
    feed(g, 4.1, 60);
    expect(g.step).toEqual({ quality: 'high', scale: 0.7 });
    feed(g, 20, 60);
    expect(g.level).toBe(0);
  });

  test('a step up that fails makes it wait longer, so it settles', () => {
    const g = new Governor();
    g.reset(1);
    // At level 1 the machine holds 60. At level 0 it only reaches 45.
    let changes = 0;
    for (let i = 0; i < 120 * 60; i++) if (g.update(1 / 60, g.level === 0 ? 45 : 60)) changes++;
    expect(g.level).toBe(1);
    expect(changes).toBeLessThan(12);
  });
});
