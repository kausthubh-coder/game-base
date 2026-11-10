import { treeSounds } from '../../content/tree-sounds.ts';
import { treeSoundScale } from './tree.sim.ts';
// One-shot sounds: feet, blocks, hits, spells, the interface, speech blips and the pet. Feet, tools and the
// things a hand does play recorded slices from the sample bank when it has them, retuned and releveled each
// time. Everything else, and every sound whose file has not loaded, is a few bursts of filtered noise and a
// sine or two. Every call draws fresh random numbers, so no two are alike.
import type { Surface } from '../../engine/types.ts';
import { midiToHz } from './blend.sim.ts';
import type { Mixer } from './mixer.ts';
import { connect, strike, type Build, type Priority, type Rig } from './rig.ts';
import type { SampleBank } from './samples.ts';

export type Element = 'bloom' | 'flame' | 'tide' | 'spark' | 'gale' | 'stone';
export type PetMood = 'happy' | 'curious' | 'sad' | 'alert';

/** A character's speaking voice. `pitch` is a MIDI note, `speed` is characters a second for whoever types the text. */
export interface VoiceSpec {
  pitch: number;
  wave: 'sine' | 'triangle' | 'square' | 'sawtooth';
  speed: number;
  /** How bright the voice is, as a filter cutoff in Hz. */
  bright?: number;
}

/** Where a sound sits for the listener: -1 left to 1 right, how loud after distance, and how dark. */
export interface Place {
  pan: number;
  gain: number;
  /** A low-pass in Hz. Distance and walls between take the top off a sound. 20000 leaves it clear. */
  tone: number;
}

const HERE: Place = { pan: 0, gain: 1, tone: 20000 };

/** What a foot is on, finer than a block's surface: a path is not a field, a floor is not a bridge. */
export type StepMaterial = 'grass' | 'dirt' | 'path' | 'cobble' | 'stone' | 'wood' | 'floor' | 'sand' | 'water' | 'leaves';
export type Gait = 'soft' | 'walk' | 'run';

/** How each gait changes a step: level, pitch in semitones, and the brightest it gets. */
const GAIT: Record<Gait, { gain: number; semis: number; tone: number }> = {
  soft: { gain: 0.5, semis: -0.8, tone: 3800 },
  walk: { gain: 1, semis: 0, tone: 20000 },
  run: { gain: 1.3, semis: 1.1, tone: 20000 },
};

/** How loud each material's recorded steps sit against each other once leveled to one peak. */
const STEP_LEVEL: Record<StepMaterial, number> = {
  grass: 0.55, dirt: 0.6, path: 0.62, cobble: 0.5, stone: 0.5, wood: 0.55, floor: 0.5, sand: 0.5, water: 0.6, leaves: 0.55,
};

/** The material a block's surface gives when the game says nothing finer. */
export function materialOf(surface: Surface): StepMaterial | null {
  switch (surface) {
    case 'grass': case 'tallGrass': return 'grass';
    case 'dirt': return 'dirt';
    case 'stone': return 'stone';
    case 'wood': return 'wood';
    case 'sand': return 'sand';
    case 'water': return 'water';
    case 'leaves': return 'leaves';
    default: return null;
  }
}

/** Options for one recorded sound. */
export interface SampleOptions {
  gain?: number;
  /** Semitones to shift it by. */
  semis?: number;
  /** How far each play may wander from that, in semitones either way. 1 by default. */
  jitter?: number;
  bus?: 'effects' | 'ambience';
  priority?: Priority;
  /** For a grain: how long a window to play. */
  seconds?: number;
}

/** The band of noise that gives each surface its character. Breaking a block reuses it. */
const BAND: Record<Surface, { type: BiquadFilterType; freq: number; q: number }> = {
  grass: { type: 'bandpass', freq: 5200, q: 0.9 },
  tallGrass: { type: 'bandpass', freq: 4200, q: 1.2 },
  dirt: { type: 'lowpass', freq: 750, q: 0.7 },
  stone: { type: 'bandpass', freq: 2900, q: 2.5 },
  wood: { type: 'bandpass', freq: 430, q: 7 },
  sand: { type: 'bandpass', freq: 1500, q: 0.6 },
  water: { type: 'bandpass', freq: 1500, q: 1 },
  snow: { type: 'bandpass', freq: 1400, q: 1.5 },
  leaves: { type: 'bandpass', freq: 5000, q: 3 },
  metal: { type: 'bandpass', freq: 2200, q: 8 },
};

const VOWELS = 'aeiouAEIOU';

export class Effects {
  constructor(private readonly rig: Rig, private readonly mixer: Mixer, private readonly bank: SampleBank) {}

  has(id: string): boolean {
    return this.bank.has(id);
  }

  /**
   * Plays the next slice of a recorded sound, placed in the world. Each play is retuned by up to `jitter`
   * semitones and releveled by about a decibel. False when the file is not loaded or the bus is full.
   */
  sample(id: string, time: number, place: Place, o: SampleOptions = {}): boolean {
    const pick = this.bank.pick(id, o.seconds);
    if (!pick) return false;
    const r = this.rig.rng;
    const rate = 2 ** (((o.semis ?? 0) + (r() * 2 - 1) * (o.jitter ?? 1)) / 12);
    const seconds = pick.length / rate;
    const bus = o.bus ?? 'effects';
    const b = this.rig.begin(bus, o.priority ?? 1, time, time + seconds + 0.02);
    if (!b) return false;
    const source = b.sample(pick.buffer, pick.start, rate);
    const level = (o.gain ?? 1) * place.gain * (0.87 + r() * 0.26);
    const amp = b.gain(level);
    // A window cut from a rustle needs its own fades. A slice already has them.
    if (o.seconds !== undefined) {
      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(level, time + Math.min(0.04, seconds / 4));
      amp.gain.setValueAtTime(level, time + seconds * 0.7);
      amp.gain.linearRampToValueAtTime(0, time + seconds);
    }
    const out = b.pan(place.pan);
    if (place.tone < 15000) connect(source, b.filter('lowpass', place.tone, 0.6), amp, out);
    else connect(source, amp, out);
    if (bus === 'ambience') {
      out.connect(this.mixer.ambience);
      out.connect(this.mixer.ambienceSpace);
    } else out.connect(this.mixer.effects);
    b.commit(time, time + seconds);
    return true;
  }

  /**
   * A recorded footstep. `litter` (0 to 1) lays dry leaves under grass, for the floor under trees. `cloth` is
   * the chance of a rustle of clothes and satchel with it. False when there is no take of this material.
   */
  stepSample(time: number, material: StepMaterial, gait: Gait, place: Place, o: { weight?: number; wet?: number; litter?: number; cloth?: number } = {}): boolean {
    const id = `step.${material}`;
    if (!this.bank.has(id)) return false;
    const g = GAIT[gait];
    const weight = o.weight ?? 1;
    const at: Place = { pan: place.pan, gain: place.gain, tone: Math.min(place.tone, g.tone) };
    const level = STEP_LEVEL[material] * g.gain * weight;
    const semis = g.semis - (weight > 1.2 ? 1.5 : 0);
    if (!this.sample(id, time, at, { gain: level, semis, jitter: 0.9, priority: weight > 1.2 ? 2 : 1 })) return false;
    const r = this.rig.rng;
    if ((o.litter ?? 0) > 0.1 && material !== 'leaves') this.sample('step.leaves', time + 0.012, at, { gain: 0.5 * level * (o.litter as number), semis, jitter: 1.5, priority: 0 });
    if ((o.wet ?? 0) > 0.3 && material !== 'water') this.sample('step.water', time + 0.01, at, { gain: 0.22 * level * (o.wet as number), semis: semis + 3, jitter: 1, priority: 0 });
    if ((o.cloth ?? 0) > 0 && r() < (o.cloth as number)) this.sample('move.cloth', time + 0.02 + r() * 0.05, at, { gain: 0.6 * Math.min(1.4, g.gain * weight), seconds: 0.22 + r() * 0.16, jitter: 1.5, priority: 0 });
    return true;
  }

  /** A burst of noise through one filter. `sweep` slides the filter there while it sounds. */
  private grain(b: Build, out: AudioNode, time: number, color: 'white' | 'pink' | 'brown', type: BiquadFilterType, freq: number, q: number, level: number, attack: number, decay: number, sweep?: number): void {
    const filter = b.filter(type, freq, q);
    if (sweep) {
      filter.frequency.setValueAtTime(freq, time);
      filter.frequency.exponentialRampToValueAtTime(Math.min(sweep, 16000), time + attack + decay * 0.7);
    }
    const amp = b.gain();
    strike(amp.gain, time, attack, level, decay);
    connect(b.noise(color, 0.8 + this.rig.rng() * 0.4), filter, amp, out);
  }

  /** A sine that slides from one pitch to another as it dies away. */
  private tone(b: Build, out: AudioNode, time: number, from: number, to: number, glide: number, level: number, decay: number, wave: 'sine' | 'triangle' | 'square' | 'sawtooth' = 'sine'): void {
    const o = b.osc(wave, from);
    o.frequency.setValueAtTime(from, time);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + glide);
    const amp = b.gain();
    strike(amp.gain, time, 0.003, level, decay);
    connect(o, amp, out);
  }

  private open(priority: Priority, time: number, seconds: number, place: Place, level: number, bus: 'effects' | 'voice' = 'effects'): { b: Build; out: GainNode } | null {
    const b = this.rig.begin(bus, priority, time, time + seconds);
    if (!b) return null;
    const out = b.gain(level * place.gain);
    const pan = b.pan(place.pan);
    if (place.tone < 15000) connect(out, b.filter('lowpass', place.tone, 0.6), pan);
    else out.connect(pan);
    pan.connect(bus === 'voice' ? this.mixer.voice : this.mixer.effects);
    return { b, out };
  }

  /** The sound a surface makes under a foot. `weight` above 1 is a landing. `wet` adds a splash on wet ground. */
  private step(b: Build, out: AudioNode, time: number, surface: Surface, weight: number, wet: number): void {
    const r = this.rig.rng;
    const j = 0.88 + r() * 0.24; // every step is tuned a little differently
    const v = (0.8 + r() * 0.4) * weight;
    switch (surface) {
      case 'grass':
        this.grain(b, out, time, 'white', 'bandpass', 3600 * j, 0.8, 0.55 * v, 0.004, 0.07);
        this.grain(b, out, time, 'white', 'highpass', 6000, 0.7, 0.1 * v, 0.003, 0.04);
        this.tone(b, out, time, 110 * j, 80, 0.04, 0.05 * v, 0.05);
        break;
      case 'tallGrass':
        // A swish, not a step: the noise slides up as the stalks part.
        this.grain(b, out, time, 'white', 'bandpass', 1800 * j, 1.2, 0.9 * v, 0.035, 0.2, 4400);
        this.grain(b, out, time + 0.06, 'white', 'highpass', 4500, 0.7, 0.14 * v, 0.02, 0.12);
        break;
      case 'dirt':
        this.grain(b, out, time, 'white', 'bandpass', 620 * j, 0.8, 1.1 * v, 0.003, 0.07);
        this.grain(b, out, time, 'white', 'bandpass', 1900 * j, 1, 0.14 * v, 0.002, 0.03);
        this.tone(b, out, time, 95 * j, 60, 0.05, 0.07 * v, 0.06);
        break;
      case 'stone':
        this.grain(b, out, time, 'white', 'bandpass', 2900 * j, 2.5, 0.7 * v, 0.001, 0.035);
        this.grain(b, out, time, 'white', 'highpass', 5000, 0.7, 0.22 * v, 0.001, 0.012);
        this.tone(b, out, time, 240 * j, 200, 0.02, 0.06 * v, 0.03);
        break;
      case 'wood':
        // A hollow knock: the board rings at two pitches, over the tap of the sole.
        this.tone(b, out, time, 440 * j, 400 * j, 0.03, (0.22 + r() * 0.16) * v, 0.045 + r() * 0.03);
        this.tone(b, out, time, 960 * j * (0.92 + r() * 0.16), 930 * j, 0.02, (0.06 + r() * 0.1) * v, 0.03);
        this.tone(b, out, time, 185 * j, 150, 0.05, 0.07 * v, 0.07);
        this.grain(b, out, time, 'white', 'bandpass', 1200 * j, 1, 0.45 * v, 0.001, 0.025);
        break;
      case 'sand':
        this.grain(b, out, time, 'white', 'bandpass', 1500 * j, 0.6, 0.45 * v, 0.02, 0.13);
        this.grain(b, out, time + 0.03, 'white', 'bandpass', 700, 0.7, 0.3 * v, 0.01, 0.08);
        break;
      case 'water':
        this.grain(b, out, time, 'white', 'bandpass', 900 * j, 1, 0.6 * v, 0.008, 0.22, 2400);
        this.grain(b, out, time, 'white', 'bandpass', 420, 0.8, 0.5 * v, 0.004, 0.12);
        this.tone(b, out, time + 0.04, 420 * j, 820 * j, 0.06, 0.07 * v, 0.06);
        this.tone(b, out, time + 0.11, 560 * j, 1000 * j, 0.05, 0.05 * v, 0.05);
        break;
      case 'snow':
        // A crunch: three small grains close together.
        for (const [at, part] of [[0, 1], [0.035, 0.7], [0.075, 0.5]] as const) {
          this.grain(b, out, time + at, 'white', 'bandpass', 1050 * j * (0.9 + r() * 0.3), 1.5, 1.0 * v * part, 0.004, 0.03);
        }
        this.grain(b, out, time, 'white', 'bandpass', 380, 0.8, 0.8 * v, 0.004, 0.06);
        break;
      case 'leaves':
        // Dry crackle: a scatter of tiny grains.
        for (let i = 0; i < 6; i++) {
          this.grain(b, out, time + r() * 0.12, 'white', 'bandpass', 2600 + r() * 3200, 3, 1.1 * v * (0.5 + r() * 0.5), 0.001, 0.012 + r() * 0.01);
        }
        break;
      case 'metal':
        // Each partial of the ring is tuned and weighted afresh, so the plate never rings the same way twice.
        for (const [f, part, decay] of [[520, 0.1, 0.12], [1387, 0.14, 0.1], [2210, 0.12, 0.07], [3170, 0.07, 0.05]] as const) {
          const tuned = f * j * (0.96 + r() * 0.08);
          this.tone(b, out, time, tuned, tuned, 0.01, part * v * (0.6 + r() * 0.8), decay);
        }
        this.grain(b, out, time, 'white', 'highpass', 4000, 0.7, 0.2 * v, 0.001, 0.008);
        break;
    }
    if (wet > 0.3 && surface !== 'water') this.grain(b, out, time + 0.01, 'white', 'bandpass', 1800 * j, 1, 0.16 * wet * v, 0.006, 0.09, 2600);
    if (weight > 1.2) this.tone(b, out, time, 120, 55, 0.08, 0.22, 0.12);
  }

  footstep(time: number, surface: Surface, place: Place, wet: number): void {
    const o = this.open(1, time, 0.34, place, 0.8);
    if (o) {
      this.step(o.b, o.out, time, surface, 1, wet);
      o.b.commit(time, time + 0.34);
    }
  }

  land(time: number, surface: Surface, place: Place, wet: number): void {
    const o = this.open(2, time, 0.36, place, 0.9);
    if (o) {
      this.step(o.b, o.out, time, surface, 1.5, wet);
      o.b.commit(time, time + 0.36);
    }
  }

  jump(time: number, place: Place): void {
    const o = this.open(1, time, 0.22, place, 0.9);
    if (!o) return;
    this.grain(o.b, o.out, time, 'white', 'bandpass', 500, 1.2, 1.2, 0.03, 0.13, 1900);
    this.tone(o.b, o.out, time, 210, 430, 0.1, 0.12, 0.1);
    o.b.commit(time, time + 0.22);
  }

  /** Placing is one firm knock. Breaking is the same material coming apart in falling pieces. */
  block(time: number, surface: Surface, broken: boolean, place: Place, level = 1): void {
    const band = BAND[surface];
    const r = this.rig.rng;
    if (!broken) {
      const o = this.open(1, time, 0.36, place, 0.9 * level);
      if (!o) return;
      this.step(o.b, o.out, time, surface, 1.1, 0);
      this.tone(o.b, o.out, time, 260, 170, 0.04, 0.3, 0.06);
      o.b.commit(time, time + 0.36);
      return;
    }
    const o = this.open(1, time, 0.42, place, 1.3 * level);
    if (!o) return;
    const fall = [1, 0.85, 0.72, 0.6, 0.52];
    for (let i = 0; i < fall.length; i++) {
      this.grain(o.b, o.out, time + i * 0.045 + r() * 0.02, 'white', band.type, band.freq * (fall[i] as number), band.q, 0.6 * (1 - i * 0.13), 0.002, 0.05);
    }
    this.tone(o.b, o.out, time, 140, 60, 0.1, 0.4, 0.14);
    o.b.commit(time, time + 0.42);
  }

  tree(time: number, kind: 'chop' | 'fall', logs: number, place: Place, level = 1): void {
    const spec = treeSounds[kind];
    const o = this.open(kind === 'fall' ? 2 : 1, time, spec.seconds, place, level * spec.gain * (kind === 'fall' ? treeSoundScale(logs) : 1));
    if (!o) return;
    const tuning = 0.94 + this.rig.rng() * 0.12;
    for (const layer of spec.layers) {
      const at = time + layer.at;
      if (layer.kind === 'grain') this.grain(o.b, o.out, at, layer.color, layer.filter, layer.hz * tuning, layer.q, layer.level, layer.attack, layer.decay, layer.sweep);
      else this.tone(o.b, o.out, at, layer.from * tuning, layer.to * tuning, layer.glide, layer.level, layer.decay);
    }
    o.b.commit(time, time + spec.seconds);
  }

  hit(time: number, place: Place): void {
    const o = this.open(2, time, 0.26, place, 0.6);
    if (!o) return;
    this.tone(o.b, o.out, time, 180, 50, 0.09, 0.9, 0.17);
    this.grain(o.b, o.out, time, 'white', 'bandpass', 1500, 0.6, 0.55, 0.001, 0.06);
    this.grain(o.b, o.out, time, 'white', 'highpass', 4000, 0.7, 0.2, 0.001, 0.02);
    o.b.commit(time, time + 0.26);
  }

  /** One sound per element. `midi` is a note of the scale that is playing, so the tonal ones are in key. */
  spell(time: number, element: Element, midi: number, place: Place): void {
    const r = this.rig.rng;
    const f = midiToHz(midi);
    const o = this.open(1, time, 0.75, place, 1.1);
    if (!o) return;
    const { b, out } = o;
    switch (element) {
      case 'bloom':
        // Three soft notes opening upward, and a shimmer.
        for (const [at, mult] of [[0, 1], [0.08, 1.5], [0.16, 2]] as const) this.tone(b, out, time + at, f * mult, f * mult, 0.01, 0.22, 0.4, 'triangle');
        this.grain(b, out, time, 'white', 'highpass', 6000, 0.7, 0.06, 0.12, 0.45);
        break;
      case 'flame':
        this.grain(b, out, time, 'pink', 'bandpass', 300, 0.8, 0.9, 0.06, 0.5, 2600);
        for (let i = 0; i < 6; i++) this.grain(b, out, time + 0.05 + r() * 0.4, 'white', 'highpass', 3000, 0.7, 0.2 + r() * 0.2, 0.001, 0.012);
        this.tone(b, out, time, 90, 50, 0.2, 0.4, 0.25);
        break;
      case 'tide':
        this.tone(b, out, time, f * 2, f * 0.5, 0.42, 0.25, 0.5);
        this.grain(b, out, time, 'white', 'bandpass', 2500, 1.2, 0.3, 0.03, 0.5, 600);
        for (let i = 0; i < 3; i++) this.tone(b, out, time + 0.1 + i * 0.11, 400 + r() * 300, 900 + r() * 300, 0.06, 0.1, 0.06);
        break;
      case 'spark':
        this.tone(b, out, time, f * 6, f, 0.11, 0.16, 0.13, 'square');
        this.tone(b, out, time + 0.1, f * 8, f * 2, 0.06, 0.1, 0.07, 'square');
        this.grain(b, out, time, 'white', 'highpass', 5000, 0.7, 0.4, 0.001, 0.03);
        break;
      case 'gale':
        this.grain(b, out, time, 'white', 'bandpass', 600, 2.5, 0.8, 0.14, 0.5, 3600);
        this.grain(b, out, time + 0.1, 'white', 'highpass', 5000, 0.7, 0.08, 0.1, 0.4);
        break;
      case 'stone':
        this.tone(b, out, time, 110, 38, 0.2, 0.45, 0.42);
        this.grain(b, out, time, 'brown', 'lowpass', 320, 0.7, 0.6, 0.004, 0.36);
        for (const at of [0.1, 0.18, 0.27]) this.grain(b, out, time + at, 'white', 'bandpass', 900 * (0.8 + r() * 0.4), 2, 0.25, 0.001, 0.03);
        break;
    }
    b.commit(time, time + 0.75);
  }

  ui(time: number, sound: 'click' | 'open' | 'close'): void {
    const o = this.open(1, time, 0.2, HERE, 0.9);
    if (!o) return;
    if (sound === 'click') this.tone(o.b, o.out, time, 1400, 1100, 0.02, 0.2, 0.03);
    else {
      const [a, c] = sound === 'open' ? [660, 990] : [990, 660];
      this.tone(o.b, o.out, time, a, a, 0.01, 0.16, 0.08, 'triangle');
      this.tone(o.b, o.out, time + 0.055, c, c, 0.01, 0.16, 0.1, 'triangle');
    }
    o.b.commit(time, time + 0.2);
  }

  /** One blip of speech for one typed character. Returns false for spaces and punctuation, which are silent. */
  talk(time: number, voice: VoiceSpec, char: string, midi: number, place: Place): boolean {
    if (!/[\p{L}\p{N}]/u.test(char)) return false;
    const vowel = VOWELS.includes(char);
    const seconds = vowel ? 0.075 : 0.05;
    const o = this.open(2, time, seconds + 0.02, place, 0.32, 'voice');
    if (!o) return false;
    const f = midiToHz(midi);
    const osc = o.b.osc(voice.wave, f);
    // Each blip falls a little in pitch, the way a syllable does.
    osc.frequency.setValueAtTime(f * 1.04, time);
    osc.frequency.exponentialRampToValueAtTime(f * 0.97, time + seconds);
    const mouth = o.b.filter('lowpass', (voice.bright ?? 2400) * (vowel ? 1 : 0.7), 1.2);
    const amp = o.b.gain();
    const level = (vowel ? 1 : 0.65) * (voice.wave === 'square' || voice.wave === 'sawtooth' ? 0.45 : 0.9);
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(level, time + 0.006);
    amp.gain.setValueAtTime(level, time + seconds * 0.6);
    amp.gain.linearRampToValueAtTime(0, time + seconds + 0.015);
    connect(osc, mouth, amp, o.out);
    o.b.commit(time, time + seconds + 0.02);
    return true;
  }

  /** The pet's chirp. `midi` is in key. The mood decides the shape: up for happy, down for sad. */
  pet(time: number, mood: PetMood, midi: number, place: Place): void {
    const f = midiToHz(midi);
    // start, length, pitch from, pitch to (as multiples of f)
    const shapes: Record<PetMood, [number, number, number, number][]> = {
      happy: [[0, 0.07, 2, 2.5], [0.09, 0.1, 2.5, 3.2]],
      curious: [[0, 0.17, 2, 3], [0.22, 0.04, 3, 3.1]],
      sad: [[0, 0.32, 2.2, 1.5]],
      alert: [[0, 0.04, 3, 3], [0.07, 0.04, 3, 3], [0.14, 0.05, 3.2, 3.4]],
    };
    const parts = shapes[mood];
    const last = parts[parts.length - 1] as [number, number, number, number];
    const seconds = last[0] + last[1] + 0.03;
    const o = this.open(1, time, seconds, place, 0.3, 'voice');
    if (!o) return;
    const osc = o.b.osc('triangle', f * 2);
    const amp = o.b.gain();
    for (const [start, length, from, to] of parts) {
      const s = time + start;
      osc.frequency.setValueAtTime(f * from, s);
      osc.frequency.exponentialRampToValueAtTime(f * to, s + length);
      amp.gain.setValueAtTime(0, s);
      amp.gain.linearRampToValueAtTime(mood === 'sad' ? 0.6 : 1, s + Math.min(0.02, length * 0.3));
      amp.gain.linearRampToValueAtTime(0, s + length);
    }
    connect(osc, amp, o.out);
    o.b.commit(time, time + seconds);
  }

  /** A machine's tick: a dry click with a little pitch from the chord, so a row of machines plays along. */
  machine(time: number, level: number, midi: number, place: Place): void {
    const o = this.open(0, time, 0.12, place, 0.4 * level);
    if (!o) return;
    const f = midiToHz(midi);
    this.tone(o.b, o.out, time, 900, 700, 0.02, 0.35, 0.03);
    this.grain(o.b, o.out, time, 'white', 'bandpass', 2400, 3, 0.5, 0.001, 0.02);
    this.tone(o.b, o.out, time, f, f, 0.01, 0.3, 0.08, 'triangle');
    o.b.commit(time, time + 0.12);
  }
}
