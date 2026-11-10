import { expect, test } from 'bun:test';
import { mulberry32 } from './rng.sim.ts';
import { SampleBank } from './samples.ts';

const buffer = (seconds: number) => ({ duration: seconds }) as AudioBuffer;
const slices = (n: number): [number, number][] => Array.from({ length: n }, (_, i) => [0.08 + i * 0.4, 0.3] as [number, number]);

test('a take of steps plays every slice once before any comes again, and never the same one twice running', () => {
  const bank = new SampleBank(mulberry32(3));
  bank.add('step.grass', buffer(6), { kind: 'steps', slices: slices(9) });
  const starts: number[] = [];
  for (let i = 0; i < 9 * 40; i++) starts.push(bank.pick('step.grass')!.start);
  for (let round = 0; round < 40; round++) expect(new Set(starts.slice(round * 9, round * 9 + 9)).size).toBe(9);
  for (let i = 1; i < starts.length; i++) expect(starts[i]).not.toBe(starts[i - 1]);
});

test('two takes of a one-shot alternate', () => {
  const bank = new SampleBank(mulberry32(5));
  bank.add('spot.door', buffer(5), { kind: 'shot', slices: slices(2) });
  let last = -1;
  for (let i = 0; i < 50; i++) {
    const s = bank.pick('spot.door')!.start;
    expect(s).not.toBe(last);
    last = s;
  }
});

test('a rustle plays a random window that stays inside its file', () => {
  const bank = new SampleBank(mulberry32(9));
  bank.add('move.cloth', buffer(5.9), { kind: 'grain' });
  const seen = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const p = bank.pick('move.cloth', 0.3)!;
    expect(p.start).toBeGreaterThanOrEqual(0);
    expect(p.start + p.length).toBeLessThanOrEqual(5.9);
    expect(p.length).toBe(0.3);
    seen.add(Math.round(p.start * 10));
  }
  expect(seen.size).toBeGreaterThan(30);
});

test('a sound that never arrived plays nothing, so the made one plays instead', () => {
  const bank = new SampleBank(mulberry32(1));
  expect(bank.pick('step.snow')).toBeNull();
  expect(bank.has('step.snow')).toBe(false);
});
