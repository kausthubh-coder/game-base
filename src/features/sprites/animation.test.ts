import { expect, test } from 'bun:test';
import { foldStart, frameAt, loopSeconds, seededRandom, startForPhase } from './animation.ts';

test('the frame shown at a given time: the hero walk, 6 frames at 10 a second', () => {
  const at = (seconds: number): number => frameAt(seconds, 6, 10);
  expect([0, 0.05, 0.099].map(at)).toEqual([0, 0, 0]);
  expect([0.1, 0.19, 0.2, 0.35, 0.45, 0.55].map(at)).toEqual([1, 1, 2, 3, 4, 5]);
  // It wraps after 0.6 seconds.
  expect([0.6, 0.65, 0.7, 1.25, 6.0, 6.31].map(at)).toEqual([0, 0, 1, 0, 0, 3]);
  // An hour in, still in step: 3600.42 seconds is 36,004 frames, and 36,004 is 6,000 loops and 4 frames.
  expect(at(3600.42)).toBe(4);
});

test('the frame shown at a given time: the hero idle, 4 frames at 4 a second', () => {
  const at = (seconds: number): number => frameAt(seconds, 4, 4);
  expect([0, 0.24, 0.25, 0.5, 0.75, 0.99, 1, 1.26].map(at)).toEqual([0, 0, 1, 2, 3, 3, 0, 1]);
});

test('before its start an animation shows its first frame', () => {
  expect(frameAt(-0.5, 6, 10)).toBe(0);
  expect(frameAt(-0.5, 3, 8, false)).toBe(0);
});

test('an animation played once stops on its last frame', () => {
  // The hero's tool swing: 3 frames at 8 a second.
  const at = (seconds: number): number => frameAt(seconds, 3, 8, false);
  expect([0, 0.124, 0.125, 0.25, 0.374, 0.375, 1, 60].map(at)).toEqual([0, 0, 1, 2, 2, 2, 2, 2]);
});

test('a phase puts the start that far back in the loop', () => {
  expect(loopSeconds(6, 10)).toBeCloseTo(0.6, 12);
  // A little over half way through a walk at second 100: it started 0.33 seconds ago and shows frame 3.
  const start = startForPhase(100, 6, 10, 0.55);
  expect(start).toBeCloseTo(99.67, 9);
  expect(frameAt(100 - start, 6, 10)).toBe(3);
  expect(frameAt(100 - startForPhase(100, 4, 4, 0), 4, 4)).toBe(0);
  expect(frameAt(100 - startForPhase(100, 4, 4, 0.76), 4, 4)).toBe(3);
});

test('folding a start time keeps the frame and brings the start close to now', () => {
  const next = seededRandom(7);
  for (let i = 0; i < 2000; i++) {
    const frames = 1 + Math.floor(next() * 8), fps = [4, 8, 10, 12][Math.floor(next() * 4)];
    const start = next() * 50, now = start + next() * 5000;
    const folded = foldStart(start, now, frames, fps, true);
    expect(now - folded).toBeLessThanOrEqual(loopSeconds(frames, fps) + 1e-9);
    expect(now - folded).toBeGreaterThanOrEqual(0);
    // The frame now, and for the next second, is what it would have been.
    for (const later of [0, 0.033, 0.21, 0.5, 1]) {
      const want = frameAt(now + later - start, frames, fps), got = frameAt(now + later - folded, frames, fps);
      // Skip the instants within a rounding error of a frame change.
      const edge = ((now + later - start) * fps) % 1;
      if (edge > 1e-6 && edge < 1 - 1e-6) expect(got).toBe(want);
    }
  }
  // An animation played once that has ended stays on its last frame.
  const ended = foldStart(10, 900, 3, 8, false);
  expect(900 - ended).toBeLessThan(2);
  expect(frameAt(900 - ended, 3, 8, false)).toBe(2);
  // One still playing is left alone.
  expect(foldStart(899.9, 900, 3, 8, false)).toBe(899.9);
});

test('the same seed gives the same numbers, spread over 0 to 1', () => {
  const a = seededRandom(42), b = seededRandom(42), c = seededRandom(43);
  const first = Array.from({ length: 5 }, () => a());
  expect(Array.from({ length: 5 }, () => b())).toEqual(first);
  expect(Array.from({ length: 5 }, () => c())).not.toEqual(first);
  const many = Array.from({ length: 4000 }, () => a());
  expect(Math.min(...many)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...many)).toBeLessThan(1);
  for (let tenth = 0; tenth < 10; tenth++) {
    const share = many.filter((v) => Math.floor(v * 10) === tenth).length / many.length;
    expect(share).toBeGreaterThan(0.07);
    expect(share).toBeLessThan(0.13);
  }
});
