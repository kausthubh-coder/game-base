import { expect, test } from 'bun:test';
import { Build, type Rig } from './rig.ts';

// AudioParam exposes the context's own oscillator range. Keep attempted assignments,
// rather than mimicking the browser clamp, so a warning-producing request fails here.
for (const sampleRate of [44100, 48000]) {
  test(`oscillators respect the ${sampleRate} Hz context and preserve valid pitches`, () => {
    const previous = globalThis.PeriodicWave;
    globalThis.PeriodicWave = class {} as typeof PeriodicWave;
    try {
      const requested: number[] = [];
      const rig = {
        ctx: { sampleRate, createOscillator: () => ({
          frequency: { minValue: -sampleRate / 2, maxValue: sampleRate / 2,
            set value(value: number) { requested.push(value); } },
        }) },
        wave: () => 'sine',
      } as unknown as Rig;
      const b = new Build(rig, 'music');
      for (const hz of [440, 0, -440, sampleRate / 2, -sampleRate / 2, 27657.5, -27657.5]) b.osc('sine', hz);
      expect(requested).toEqual([440, 0, -440, sampleRate / 2, -sampleRate / 2, sampleRate / 2, -sampleRate / 2]);
    } finally { globalThis.PeriodicWave = previous; }
  });
}
