// The recorded sounds: ElevenLabs takes made ahead of time by tools/sound.ts (see src/content/sound-samples.ts).
// A file is one bed, one grain of rustle, or a row of slices: several footfalls, several strikes, several takes
// of a one-shot. The bank never plays the same slice twice in a row, and each play is retuned and releveled a
// little, so a walk across the square never sounds like a loop. Beds are read from random points and crossfaded,
// so the 22 seconds of a bed never repeat the same way either.
import { mulberry32 } from './rng.sim.ts';
import type { Rig } from './rig.ts';

export type SampleKind = 'bed' | 'steps' | 'hits' | 'shot' | 'grain';

/** What the game knows about each file, from public/assets/sound/sound.json. */
export interface SampleInfo {
  kind: SampleKind;
  /** [start, length] in seconds, for the kinds that hold several sounds. */
  slices?: readonly (readonly [number, number])[];
}

interface Entry {
  buffer: AudioBuffer;
  kind: SampleKind;
  slices: (readonly [number, number])[];
  /** The slices not played yet this round, shuffled. */
  bag: number[];
  last: number;
}

export class SampleBank {
  private readonly map = new Map<string, Entry>();

  constructor(private readonly rng: () => number) {}

  add(id: string, buffer: AudioBuffer, info: SampleInfo): void {
    const slices = info.slices && info.slices.length > 0 ? info.slices.map((s) => [s[0], s[1]] as const) : [[0, buffer.duration] as const];
    this.map.set(id, { buffer, kind: info.kind, slices, bag: [], last: -1 });
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  get size(): number {
    return this.map.size;
  }

  buffer(id: string): AudioBuffer | null {
    return this.map.get(id)?.buffer ?? null;
  }

  /**
   * The next slice of a sound: every slice once in a shuffled order, then a new order that never starts with
   * the slice just played. A grain is a random window `seconds` long instead.
   */
  pick(id: string, seconds = 0.3): { buffer: AudioBuffer; start: number; length: number } | null {
    const e = this.map.get(id);
    if (!e) return null;
    if (e.kind === 'grain') {
      const length = Math.min(seconds, e.buffer.duration);
      return { buffer: e.buffer, start: this.rng() * (e.buffer.duration - length), length };
    }
    if (e.bag.length === 0) {
      for (let i = 0; i < e.slices.length; i++) e.bag.push(i);
      for (let i = e.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [e.bag[i], e.bag[j]] = [e.bag[j] as number, e.bag[i] as number];
      }
      if (e.bag.length > 1 && e.bag[e.bag.length - 1] === e.last) [e.bag[0], e.bag[e.bag.length - 1]] = [e.bag[e.bag.length - 1] as number, e.bag[0] as number];
    }
    const index = e.bag.pop() as number;
    e.last = index;
    const [start, length] = e.slices[index] as readonly [number, number];
    return { buffer: e.buffer, start, length };
  }
}

/**
 * One bed, playing for as long as it can be heard. It plays stretches of 8 to 14 seconds from random points
 * of its file, each fading in over the last one's fade out with equal power, so there is never a seam and
 * never the same order twice. While its level is zero it stops reading and costs nothing.
 */
export class BedLoop {
  readonly out: GainNode;
  readonly pan: StereoPannerNode;
  private next = -1;
  private readonly rng: () => number;
  private static readonly FADE = 2.4;
  private static curveIn: Float32Array | null = null;
  private static curveOut: Float32Array | null = null;

  constructor(private readonly rig: Rig, private readonly buffer: AudioBuffer, destination: AudioNode, seed: number) {
    this.rng = mulberry32(seed);
    this.out = rig.keep(rig.ctx.createGain());
    this.out.gain.value = 0;
    this.pan = rig.keep(rig.ctx.createStereoPanner());
    this.out.connect(this.pan).connect(destination);
    if (!BedLoop.curveIn) {
      const n = 64;
      BedLoop.curveIn = new Float32Array(n);
      BedLoop.curveOut = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        BedLoop.curveIn[i] = Math.sin((i / (n - 1)) * Math.PI / 2);
        BedLoop.curveOut[i] = Math.cos((i / (n - 1)) * Math.PI / 2);
      }
    }
  }

  /** Schedules every stretch that starts before `horizon`. `audible` false lets the current stretch run out. */
  schedule(now: number, horizon: number, audible: boolean): void {
    if (!audible) {
      if (this.next >= 0 && this.next < now) this.next = -1;
      return;
    }
    // After a stall (a hidden tab, a slow frame, a paused test) the next start can lie in the past. A curve
    // set in the past starts now, so both fades of that stretch would land on each other: start afresh instead.
    // The stretch already playing fades out on its own.
    if (this.next < now) this.next = now + 0.02;
    const fade = BedLoop.FADE;
    while (this.next < horizon) {
      const length = Math.min(this.buffer.duration - 0.05, 8 + this.rng() * 6);
      const start = this.next;
      const offset = this.rng() * Math.max(0, this.buffer.duration - length - 0.02);
      const ctx = this.rig.ctx;
      const source = ctx.createBufferSource();
      source.buffer = this.buffer;
      const amp = ctx.createGain();
      amp.gain.value = 0;
      amp.gain.setValueCurveAtTime(BedLoop.curveIn as Float32Array, start, fade);
      amp.gain.setValueCurveAtTime(BedLoop.curveOut as Float32Array, start + length - fade, fade);
      source.connect(amp).connect(this.out);
      source.start(start, offset);
      source.stop(start + length + 0.02);
      this.rig.track([source, amp], start + length + 0.05);
      this.next = start + length - fade;
    }
  }
}
