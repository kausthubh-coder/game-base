// The ground every sound stands on: the context, shared noise, oscillator shapes, the voice budget and
// the count of live nodes. Every node the engine makes is made here, so the count is honest.
import type { WaveName } from '../../content/palettes/types.ts';
import type { Rng } from './rng.sim.ts';

export type BusId = 'music' | 'ambience' | 'effects' | 'voice';

/** At most this many voices sound at once. A voice is one note, one hit or one continuous bed. */
export const VOICE_LIMIT = 48;
/** Each bus has its own share, and the shares add up to the limit. */
export const BUS_CAPS: Record<BusId, number> = { music: 30, ambience: 10, effects: 6, voice: 2 };
/** Low-priority sounds stop being admitted this many voices before a bus is full, per priority step below 2. */
const HEADROOM: Record<BusId, number> = { music: 3, ambience: 1, effects: 1, voice: 0 };

export type Priority = 0 | 1 | 2;

interface Voice {
  start: number;
  end: number;
  bus: BusId;
  nodes: AudioNode[];
}

/** Harmonic recipes for the oscillator shapes that are not built in. Entry n is the strength of harmonic n + 1. */
const HARMONICS: Partial<Record<WaveName, number[]>> = {
  soft: [1, 0.22, 0.09, 0.03],
  harp: [1, 0.5, 0.3, 0.12, 0.08, 0.04, 0.02],
  lute: [1, 0.7, 0.5, 0.4, 0.25, 0.2, 0.12, 0.1, 0.06, 0.05],
  reed: [1, 0.1, 0.6, 0.08, 0.4, 0.05, 0.25, 0.04, 0.15, 0.02, 0.1],
  string: [1, 0.55, 0.42, 0.3, 0.26, 0.2, 0.17, 0.13, 0.11, 0.09, 0.08, 0.06, 0.05, 0.04, 0.03, 0.03],
  glass: [1, 0.02, 0.14, 0, 0.04],
  choir: [1, 0.6, 0.4, 0.5, 0.3, 0.15, 0.1, 0.1, 0.05],
};

function makeNoise(ctx: BaseAudioContext, seconds: number, color: 'white' | 'pink' | 'brown', rng: Rng): AudioBuffer {
  const length = Math.floor(seconds * ctx.sampleRate);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, peak = 0;
  for (let i = 0; i < length; i++) {
    const white = rng() * 2 - 1;
    let v = white;
    if (color === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    } else if (color === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      v = last;
    }
    data[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  // Fade the end into the start so the loop has no seam, then bring the peak to 1.
  const fade = Math.min(Math.floor(ctx.sampleRate * 0.25), length >> 2);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    data[i] = (data[i] as number) * t + (data[length - fade + i] as number) * (1 - t);
  }
  const loop = ctx.createBuffer(1, length - fade, ctx.sampleRate);
  const out = loop.getChannelData(0);
  for (let i = 0; i < out.length; i++) out[i] = (data[i] as number) / peak;
  return loop;
}

/** Collects the nodes of one sound while it is being built. `commit` starts it and hands it to the budget. */
export class Build {
  readonly nodes: AudioNode[] = [];
  private readonly sources: { node: AudioScheduledSourceNode; offset: number }[] = [];
  constructor(readonly rig: Rig, private readonly bus: BusId) {}

  osc(wave: WaveName, freq: number): OscillatorNode {
    const o = this.rig.ctx.createOscillator();
    const shape = this.rig.wave(wave);
    if (shape instanceof PeriodicWave) o.setPeriodicWave(shape);
    else o.type = shape;
    o.frequency.value = freq;
    this.nodes.push(o);
    this.sources.push({ node: o, offset: -1 });
    return o;
  }

  /** Looping noise that starts somewhere random in the buffer, so no two bursts are the same. */
  noise(color: 'white' | 'pink' | 'brown', rate = 1): AudioBufferSourceNode {
    const s = this.rig.ctx.createBufferSource();
    s.buffer = this.rig.noise[color];
    s.loop = true;
    s.playbackRate.value = rate;
    this.nodes.push(s);
    this.sources.push({ node: s, offset: this.rig.rng() * (s.buffer.duration - 0.01) });
    return s;
  }

  gain(value = 0): GainNode {
    const g = this.rig.ctx.createGain();
    g.gain.value = value;
    this.nodes.push(g);
    return g;
  }

  filter(type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = this.rig.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = Math.min(freq, this.rig.ctx.sampleRate * 0.45);
    f.Q.value = q;
    this.nodes.push(f);
    return f;
  }

  pan(value: number): StereoPannerNode {
    const p = this.rig.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, value));
    this.nodes.push(p);
    return p;
  }

  /** Starts every source at `start`, stops it at `end`, and counts the sound as a voice until then. */
  commit(start: number, end: number): void {
    for (const s of this.sources) {
      if (s.offset >= 0) (s.node as AudioBufferSourceNode).start(start, s.offset);
      else s.node.start(start);
      s.node.stop(end + 0.03);
    }
    this.rig.add({ start, end, bus: this.bus, nodes: this.nodes });
  }
}

export class Rig {
  readonly noise: { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer };
  /** Nodes that live as long as the engine: buses, reverbs, beds. */
  staticNodes = 0;
  /** Nodes that belong to voices and are released when the voice ends. */
  voiceNodes = 0;
  /** The most voices that ever overlapped, counting sounds scheduled ahead at the time they play. */
  peak = 0;
  /** Sounds refused because a bus was full, in all and for each bus. */
  dropped = 0;
  readonly refused: Record<BusId, number> = { music: 0, ambience: 0, effects: 0, voice: 0 };
  /** Continuous beds that are audible now. Each one counts as an ambience voice. */
  beds = 0;
  private readonly voices: Voice[] = [];
  private readonly waves = new Map<WaveName, PeriodicWave>();

  constructor(readonly ctx: BaseAudioContext, readonly rng: Rng) {
    this.noise = { white: makeNoise(ctx, 2.5, 'white', rng), pink: makeNoise(ctx, 5, 'pink', rng), brown: makeNoise(ctx, 5, 'brown', rng) };
  }

  wave(name: WaveName): OscillatorType | PeriodicWave {
    const recipe = HARMONICS[name];
    if (!recipe) return name as OscillatorType;
    let wave = this.waves.get(name);
    if (!wave) {
      const real = new Float32Array(recipe.length + 1);
      const imag = new Float32Array(recipe.length + 1);
      for (let i = 0; i < recipe.length; i++) imag[i + 1] = recipe[i] as number;
      wave = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(name, wave);
    }
    return wave;
  }

  /** Counts a node that stays for good. */
  keep<T extends AudioNode>(node: T): T {
    this.staticNodes++;
    return node;
  }

  /** How many voices overlap the busiest instant of [start, end): on one bus, and in all. */
  private overlap(start: number, end: number, bus: BusId): { bus: number; all: number } {
    let worstBus = 0;
    let worstAll = 0;
    const voices = this.voices;
    // The count can only rise where a voice starts, so those are the instants worth checking.
    for (let k = -1; k < voices.length; k++) {
      const at = k < 0 ? start : (voices[k] as Voice).start;
      if (at < start || at >= end) continue;
      let onBus = 0;
      let all = 0;
      for (let i = 0; i < voices.length; i++) {
        const v = voices[i] as Voice;
        if (v.start <= at && at < v.end) {
          all++;
          if (v.bus === bus) onBus++;
        }
      }
      if (onBus > worstBus) worstBus = onBus;
      if (all > worstAll) worstAll = all;
    }
    return { bus: worstBus, all: worstAll };
  }

  /**
   * Asks for room for one sound. Returns null when the bus is full, which is how the 48-voice limit holds:
   * a sound that would break it is never made. Less important sounds are refused a little earlier.
   */
  begin(bus: BusId, priority: Priority, start: number, end: number): Build | null {
    const beds = bus === 'ambience' ? this.beds : 0;
    const cap = BUS_CAPS[bus] - beds - HEADROOM[bus] * (2 - priority);
    const { bus: onBus, all } = this.overlap(start, end, bus);
    if (onBus >= cap || all + this.beds >= VOICE_LIMIT) {
      this.dropped++;
      this.refused[bus]++;
      return null;
    }
    if (all + this.beds + 1 > this.peak) this.peak = all + this.beds + 1;
    return new Build(this, bus);
  }

  add(voice: Voice): void {
    this.voices.push(voice);
    this.voiceNodes += voice.nodes.length;
  }

  /** Lets go of every sound that has ended: its nodes are disconnected and no longer counted. */
  sweep(now: number): void {
    const voices = this.voices;
    for (let i = voices.length - 1; i >= 0; i--) {
      const v = voices[i] as Voice;
      if (v.end + 0.06 > now) continue;
      for (const node of v.nodes) node.disconnect();
      this.voiceNodes -= v.nodes.length;
      voices[i] = voices[voices.length - 1] as Voice;
      voices.pop();
    }
  }

  /** Voices sounding at this instant, beds included. */
  voicesAt(time: number): number {
    let n = this.beds;
    for (const v of this.voices) if (v.start <= time && time < v.end) n++;
    return n;
  }

  releaseAll(): void {
    for (const v of this.voices) for (const node of v.nodes) node.disconnect();
    this.voices.length = 0;
    this.voiceNodes = 0;
  }
}

/** A sound that hits and dies away: up to `peak` in `attack` seconds, then an exact fall to silence over `decay`. */
export function strike(param: AudioParam, time: number, attack: number, peak: number, decay: number): void {
  const top = Math.max(peak, 1e-4);
  param.setValueAtTime(0, time);
  param.linearRampToValueAtTime(top, time + attack);
  param.exponentialRampToValueAtTime(top * 0.001, time + attack + decay);
  param.linearRampToValueAtTime(0, time + attack + decay + 0.012);
}

/** A sound that is held: up in `attack`, held until `off`, then down to silence over `release`. */
export function hold(param: AudioParam, time: number, attack: number, peak: number, off: number, release: number): void {
  const top = Math.max(peak, 1e-4);
  const up = Math.min(attack, Math.max(0.005, off - time));
  param.setValueAtTime(0, time);
  param.linearRampToValueAtTime(top, time + up);
  param.setValueAtTime(top, Math.max(off, time + up));
  param.exponentialRampToValueAtTime(top * 0.03, Math.max(off, time + up) + release * 0.8);
  param.linearRampToValueAtTime(0, Math.max(off, time + up) + release);
}

export function connect(...chain: AudioNode[]): void {
  for (let i = 0; i < chain.length - 1; i++) (chain[i] as AudioNode).connect(chain[i + 1] as AudioNode);
}
