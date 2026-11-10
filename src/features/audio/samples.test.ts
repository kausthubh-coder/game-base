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

/** Just enough of a context for BedLoop. A curve set in the past starts now, and two that overlap throw, as in Chrome. */
function fakeRig() {
  const clock = { now: 0 };
  const param = () => {
    const curves: [number, number][] = [];
    return {
      value: 0,
      curves,
      setValueCurveAtTime(_curve: Float32Array, start: number, seconds: number) {
        const at = Math.max(start, clock.now);
        for (const [a, b] of curves) if (at < b && a < at + seconds) throw new Error(`setValueCurveAtTime(..., ${at}, ${seconds}) overlaps`);
        curves.push([at, at + seconds]);
      },
    };
  };
  const node = () => ({ connect: (n: unknown) => n, disconnect() {} });
  const ctx = {
    createGain: () => ({ ...node(), gain: param() }),
    createStereoPanner: () => ({ ...node(), pan: param() }),
    createBufferSource: () => ({ ...node(), buffer: null, start() {}, stop() {} }),
  };
  const tracked: unknown[] = [];
  return { clock, rig: { ctx, keep: <T>(n: T) => n, track: (nodes: unknown[]) => tracked.push(nodes) }, tracked };
}

test('a bed picks up after a long stall without its fades landing on each other', async () => {
  const { BedLoop } = await import('./samples.ts');
  const { clock, rig, tracked } = fakeRig();
  const loop = new BedLoop(rig as never, buffer(22.5), {} as AudioNode, 4);
  for (let t = 0; t < 30; t += 0.05) { clock.now = t; loop.schedule(t, t + 1, true); }
  // The page stalls for 40 seconds, longer than any stretch, then carries on.
  for (let t = 70; t < 100; t += 0.05) { clock.now = t; expect(() => loop.schedule(t, t + 1, true)).not.toThrow(); }
  expect(tracked.length).toBeGreaterThan(6);
});

test('a bed played without a stall crossfades: each stretch starts before the last one ends', async () => {
  const { BedLoop } = await import('./samples.ts');
  const { clock, rig, tracked } = fakeRig();
  const loop = new BedLoop(rig as never, buffer(22.5), {} as AudioNode, 8);
  for (let t = 0; t < 120; t += 0.05) { clock.now = t; loop.schedule(t, t + 1, true); }
  const spans = (tracked as { gain?: { curves: [number, number][] } }[][]).map((nodes) => (nodes[1] as { gain: { curves: [number, number][] } }).gain.curves);
  for (let i = 1; i < spans.length; i++) {
    const [fadeIn] = spans[i] as [number, number][];
    const [, fadeOut] = spans[i - 1] as [number, number][];
    expect((fadeIn as [number, number])[0]).toBeCloseTo((fadeOut as [number, number])[0], 5);
  }
});
