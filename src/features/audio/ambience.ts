import { outdoorSound as sound } from '../../content/ambience.ts';
// The world's air: wind with gusts, leaves, water, rain, one bed that belongs to each land, and the creatures
// that call over them, all made from noise and sine waves; and the recorded beds (the town's murmur, its
// birds, the water at the quay, the meadow, the forest, the night) that the game sets by where the player
// stands. Beds are continuous and live as long as the engine. Calls are single voices that come and go.
import { chime, glassBell } from '../../content/palettes/instruments.ts';
import type { Palette, SignatureBed } from '../../content/palettes/types.ts';
import { ambientLayers, windLevel, gust, lifeRates, nextGap, noise1, type LifeRates } from './ambience.sim.ts';
import { playDrum, playNote } from './instruments.ts';
import { Glide, type Mixer } from './mixer.ts';
import { degreeSemis } from './patterns.sim.ts';
import { connect, strike, type Rig } from './rig.ts';
import { BedLoop } from './samples.ts';

/** What the ambience follows. Everything is 0 to 1 except the wind direction. */
export interface Air {
  wind: number;
  windDir: number;
  rain: number;
  trees: number;
  nearWater: number;
  /** 0 at night, 1 by day. */
  day: number;
  indoors: number;
  cloud: number;
  town: number;
  /** One weight per palette, in the order the engine was given them. */
  weights: readonly number[];
}

/** A continuous layer of filtered noise. It counts as one voice while it can be heard. */
interface Bed {
  level: Glide;
  now: number;
}

interface Caller {
  next: number;
  rate: (air: Air) => number;
  fire: (time: number, air: Air) => void;
}

export class Ambience {
  private readonly nodes: AudioNode[] = [];
  private readonly beds: Bed[] = [];
  private readonly callers: Caller[] = [];
  /** Where calls from far off go: they get a share of the hall. */
  private readonly far: GainNode;
  private readonly near: GainNode;
  private readonly wind: { bed: Bed; band: [Glide, Glide]; side: [Glide, Glide] };
  private readonly leaves: Bed;
  private readonly water: { bed: Bed; tone: Glide };
  private readonly rain: Bed;
  private readonly signature: { index: number; kind: SignatureBed; bed?: Bed; tune?: Glide; extra?: Bed }[] = [];
  private readonly rates: LifeRates = { birds: 0, crickets: 0, frogs: 0 };
  private readonly habitat = { birds: 0, owl: 0, town: 0, water: 0, rain: 0, leaves: 0 };
  private readonly longNoise: AudioBuffer;
  private surfNext = 0;
  private surf?: { gain: AudioParam; tone: AudioParam };
  /** The recorded beds, by sound id, with the level and the pan the game last asked for. */
  private readonly recorded = new Map<string, { loop: BedLoop; level: Glide; pan: Glide; now: number }>();
  /** 0 to 1: how much of the wildlife the recorded beds already carry. The made birds thin out by as much. */
  private cover = 0;

  constructor(private readonly rig: Rig, mixer: Mixer, private readonly palettes: readonly Palette[]) {
    // Shared mono noise is generated once, never downloaded. Every bed has a different offset/rate.
    this.longNoise = rig.ctx.createBuffer(1, Math.ceil(sound.noiseSeconds * rig.ctx.sampleRate), rig.ctx.sampleRate);
    const samples = this.longNoise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = rig.rng() * 2 - 1;
    const fade = Math.floor(rig.ctx.sampleRate * 0.015);
    for (let i = 0; i < fade; i++) {
      samples[i] *= i / fade;
      samples[samples.length - 1 - i] *= i / fade;
    }
    this.near = this.gain(1);
    this.near.connect(mixer.ambience);
    this.far = this.gain(1);
    this.far.connect(mixer.ambience);
    const send = this.gain(0.5);
    connect(this.far, send, mixer.ambienceWet);

    // Wind: two streams of noise, one in each ear, so it has width.
    const windBed = this.gain(0);
    const band: Glide[] = [];
    const side: Glide[] = [];
    for (const pan of [-0.7, 0.7]) {
      const filter = this.filter('bandpass', sound.wind.center, 0.45);
      const trim = this.gain(1);
      connect(this.noise('pink', pan < 0 ? 0.92 : 1.07), this.filter('highpass', sound.wind.highpass, 0.5), filter, trim, this.panner(pan), windBed);
      band.push(new Glide(filter.frequency));
      side.push(new Glide(trim.gain));
    }
    windBed.connect(this.near);
    this.wind = { bed: this.bed(windBed), band: band as [Glide, Glide], side: side as [Glide, Glide] };

    // Leaves: a high rustle that needs both trees and wind.
    const leaves = this.gain(0);
    connect(this.noise('white', 1.1), this.filter('highpass', 2600, 0.7), this.filter('bandpass', 5200, 0.8), leaves, this.near);
    this.leaves = this.bed(leaves);

    // Water: a low wash and a brighter trickle. It opens up as you come close.
    const water = this.gain(0);
    const tone = this.filter('lowpass', 900, 0.5);
    connect(this.noise('pink', 0.8), this.filter('bandpass', 650, 0.8), tone);
    const trickle = this.gain(0.5);
    connect(this.noise('white', 0.9), this.filter('bandpass', 2600, 1.2), trickle, tone);
    connect(tone, water, this.near);
    this.water = { bed: this.bed(water), tone: new Glide(tone.frequency) };

    // Rain: hiss with a body under it.
    const rain = this.gain(0);
    connect(this.noise('white', 1), this.filter('highpass', 1300, 0.6), this.filter('lowpass', 9000, 0.6), rain);
    const body = this.gain(0.6);
    connect(this.noise('pink', 1.2), this.filter('bandpass', 520, 0.6), body, rain);
    rain.connect(this.near);
    this.rain = this.bed(rain);

    // The bed only this land has.
    palettes.forEach((p, index) => {
      const entry: (typeof this.signature)[number] = { index, kind: p.signature };
      const out = this.gain(0);
      switch (p.signature) {
        case 'meadowBreeze':
          connect(this.noise('white', 0.95), this.filter('bandpass', 3800, 0.7), out, this.near);
          entry.bed = this.bed(out);
          break;
        case 'desertWind': {
          // A dry wind that whistles: a narrow band of noise that slides with the gusts.
          const whistle = this.filter('bandpass', 700, 5);
          connect(this.noise('pink', 1), whistle, out, this.near);
          const sand = this.gain(0);
          connect(this.noise('white', 1.2), this.filter('highpass', 6000, 0.7), sand, this.near);
          entry.bed = this.bed(out);
          entry.tune = new Glide(whistle.frequency);
          entry.extra = this.bed(sand);
          break;
        }
        case 'surf': {
          // Waves: the level and the brightness swell and fall back. `emit` schedules each wave.
          const wash = this.filter('lowpass', 500, 0.5);
          const wave = this.gain(0.12);
          connect(this.noise('white', 0.8), wash, wave, out, this.near);
          const under = this.gain(0.5);
          connect(this.noise('brown', 1), this.filter('lowpass', 300, 0.5), under, out);
          entry.bed = this.bed(out);
          this.surf = { gain: wave.gain, tone: wash.frequency };
          break;
        }
        case 'highWindBells': {
          const thin = this.filter('bandpass', 2000, 6);
          connect(this.noise('white', 1), thin, out, this.near);
          entry.bed = this.bed(out);
          entry.tune = new Glide(thin.frequency);
          break;
        }
        case 'forgeHammers':
          connect(this.noise('brown', 0.9), this.filter('lowpass', 120, 0.7), out, this.near);
          entry.bed = this.bed(out);
          break;
        case 'stillAir':
          connect(this.noise('pink', 0.7), this.filter('bandpass', 700, 0.5), out, this.near);
          entry.bed = this.bed(out);
          break;
        case 'distantThunder':
        case 'none':
          break;
      }
      this.signature.push(entry);
    });

    const weightOf = (kind: SignatureBed, air: Air): number => {
      let w = 0;
      for (const s of this.signature) if (s.kind === kind) w += air.weights[s.index] as number;
      return w;
    };
    const life = (air: Air, key: 'birds' | 'crickets' | 'frogs'): number => {
      let m = 0;
      for (let i = 0; i < palettes.length; i++) m += (air.weights[i] as number) * (palettes[i] as Palette).life[key];
      if (key === 'birds') return m * 0.5 * this.habitat.birds * (1 - 0.4 * air.cloud) * (1 - 0.8 * this.cover);
      return m * lifeRates(air.day, air.rain, air.trees, air.nearWater, air.indoors, air.cloud, this.rates)[key];
    };
    this.callers.push(
      { next: 0, rate: () => sound.owl.rate * this.habitat.owl, fire: (t: number) => this.owl(t) },
      { next: 0, rate: (air) => life(air, 'birds'), fire: (t) => this.bird(t) },
      { next: 0, rate: (air) => life(air, 'crickets'), fire: (t) => this.cricket(t) },
      { next: 0, rate: (air) => life(air, 'frogs'), fire: (t) => this.frog(t) },
      { next: 0, rate: (air) => 2.2 * air.nearWater * air.nearWater * (1 - 0.8 * air.indoors), fire: (t, air) => this.bubble(t, air.nearWater) },
      { next: 0, rate: (air) => weightOf('distantThunder', air) / 16 + air.rain * air.rain / 40, fire: (t) => this.thunder(t, 0.25 + rig.rng() * 0.3) },
      { next: 0, rate: (air) => weightOf('highWindBells', air) / 4.5, fire: (t) => this.farBell(t, 'highWindBells') },
      { next: 0, rate: (air) => weightOf('stillAir', air) / 7, fire: (t) => this.farBell(t, 'stillAir') },
    );
  }

  private gain(value: number): GainNode {
    const node = this.rig.keep(this.rig.ctx.createGain());
    node.gain.value = value;
    this.nodes.push(node);
    return node;
  }

  private filter(type: BiquadFilterType, freq: number, q: number): BiquadFilterNode {
    const node = this.rig.keep(this.rig.ctx.createBiquadFilter());
    node.type = type;
    node.frequency.value = freq;
    node.Q.value = q;
    this.nodes.push(node);
    return node;
  }

  private panner(pan: number): StereoPannerNode {
    const node = this.rig.keep(this.rig.ctx.createStereoPanner());
    node.pan.value = pan;
    this.nodes.push(node);
    return node;
  }

  private noise(color: 'white' | 'pink' | 'brown', rate: number): AudioBufferSourceNode {
    const node = this.rig.keep(this.rig.ctx.createBufferSource());
    node.buffer = color === 'brown' ? this.rig.noise.brown : this.longNoise;
    node.loop = true;
    node.playbackRate.value = rate;
    node.start(0, this.rig.rng() * (node.buffer.duration - 0.01));
    this.nodes.push(node);
    return node;
  }

  private bed(out: GainNode): Bed {
    const bed = { level: new Glide(out.gain), now: 0 };
    this.beds.push(bed);
    return bed;
  }

  private setBed(bed: Bed, level: number, now: number, seconds = 0.8): void {
    bed.now = level;
    bed.level.to(level, now, seconds);
  }

  /** Moves every bed toward what the air asks for, and tells the budget how many can be heard. */
  control(now: number, air: Air): void {
    const out = 1 - 0.85 * air.indoors;
    ambientLayers(air.day, air.rain, air.town, air.trees, air.nearWater, air.indoors, this.habitat);
    const g1 = gust(now, 11);
    const g2 = gust(now * 1.7, 23);
    const blow = air.wind * g1;

    this.setBed(this.wind.bed, windLevel(air.wind, g1) * out, now, sound.wind.fade);
    // The wind comes from one side: the ear it blows toward is quieter.
    const lean = Math.cos(air.windDir) * 0.3;
    for (let i = 0; i < 2; i++) {
      (this.wind.band[i] as Glide).to(sound.wind.center + sound.wind.sweep * blow + (i === 0 ? 0 : 70), now, 0.3);
      (this.wind.side[i] as Glide).to(1 + (i === 0 ? lean : -lean), now, 0.5);
    }
    this.setBed(this.leaves, this.habitat.leaves * (sound.leaves.floor + sound.leaves.gain * air.wind * Math.max(0, g2 - 0.3)), now, sound.leaves.fade);
    this.setBed(this.water.bed, sound.water.gain * this.habitat.water ** 1.6 * (0.75 + 0.25 * g2), now, sound.water.fade);
    this.water.tone.to(700 + 5200 * air.nearWater, now, 0.3);
    this.setBed(this.rain, sound.rain.gain * this.habitat.rain ** 1.3 * (0.85 + 0.15 * g2), now, sound.rain.fade);

    for (const s of this.signature) {
      const w = air.weights[s.index] as number;
      if (!s.bed) continue;
      switch (s.kind) {
        case 'meadowBreeze':
          this.setBed(s.bed, w * 0.008 * air.wind * Math.max(0, g2 - 0.4) * out, now, 0.5);
          break;
        case 'desertWind':
          this.setBed(s.bed, w * (0.07 + 0.26 * g2) * (0.7 + 0.6 * air.wind) * out, now, 0.3);
          s.tune?.to(480 + 520 * g2, now, 0.6);
          if (s.extra) this.setBed(s.extra, w * 0.02 * g1 * out, now, 0.3);
          break;
        case 'surf':
          this.setBed(s.bed, w * 0.5 * out, now, 0.5);
          break;
        case 'highWindBells':
          this.setBed(s.bed, w * (0.02 + 0.1 * g2) * out, now, 0.3);
          s.tune?.to(1500 + 1500 * g1, now, 0.8);
          break;
        case 'forgeHammers':
          this.setBed(s.bed, w * (0.13 + 0.05 * noise1(now * 0.2, 67)) * out, now, 0.5);
          break;
        case 'stillAir':
          this.setBed(s.bed, w * (0.03 + 0.045 * noise1(now * 0.07, 83)) * out, now, 0.8);
          break;
        default:
          break;
      }
    }
    let audible = 0;
    for (const bed of this.beds) if (bed.now > 0.004) audible++;
    let carried = 0;
    for (const bed of this.recorded.values()) {
      if (bed.now > 0.002) audible++;
      carried += bed.now;
    }
    this.cover = Math.min(1, carried * 1.4);
    this.rig.beds = audible;
  }

  /** Adds a recorded bed. It is silent until `setRecorded` gives it a level. */
  addBed(id: string, buffer: AudioBuffer): void {
    if (this.recorded.has(id)) return;
    const loop = new BedLoop(this.rig, buffer, this.near, (this.rig.rng() * 2 ** 32) >>> 0);
    this.recorded.set(id, { loop, level: new Glide(loop.out.gain), pan: new Glide(loop.pan.pan), now: 0 });
  }

  hasBed(id: string): boolean {
    return this.recorded.has(id);
  }

  /** Sets a recorded bed's level, 0 to 1, and where it leans, -1 left to 1 right. Indoors muffles it. */
  setRecorded(id: string, level: number, pan: number, now: number, indoors: number): void {
    const bed = this.recorded.get(id);
    if (!bed) return;
    bed.now = level * (1 - 0.6 * indoors);
    bed.level.to(bed.now, now, 0.9);
    bed.pan.to(Math.max(-0.8, Math.min(0.8, pan)), now, 0.5);
  }

  /** Schedules every call due before `horizon`. */
  emit(now: number, horizon: number, air: Air): void {
    // A bed's stretches are long, so they are laid a second ahead: a slow frame never finds one missing.
    for (const bed of this.recorded.values()) bed.loop.schedule(now, now + 1, bed.now > 0.002);
    for (const c of this.callers) {
      if (c.next < now) c.next = now + this.rig.rng() * 0.8;
      while (c.next < horizon) {
        const rate = c.rate(air);
        if (rate > 0.001) c.fire(c.next, air);
        c.next += nextGap(rate, this.rig.rng);
      }
    }
    // Surf: one wave every seven to ten seconds while the coast can be heard.
    const surf = this.surf;
    if (surf) {
      if (this.surfNext < now) this.surfNext = now + 0.2;
      while (this.surfNext < horizon) {
        const t = this.surfNext;
        const size = 0.6 + this.rig.rng() * 0.4;
        surf.gain.setTargetAtTime(size, t, 0.9);
        surf.tone.setTargetAtTime(1600 + 1800 * size, t, 0.7);
        surf.gain.setTargetAtTime(0.12, t + 2.3, 1.7);
        surf.tone.setTargetAtTime(480, t + 2.1, 1.5);
        this.surfNext = t + 7 + this.rig.rng() * 3.5;
      }
    }
  }

  /** The forge's far hammers fall on the half beat, so they play along with the music. */
  hammer(time: number, air: Air): void {
    let w = 0;
    for (const s of this.signature) if (s.kind === 'forgeHammers') w += air.weights[s.index] as number;
    if (w < 0.05 || this.rig.rng() > 0.13 * w) return;
    playDrum(this.rig, this.far, 'anvil', time, 0.1 + this.rig.rng() * 0.08, 57, { bus: 'ambience', priority: 0, pan: this.rig.rng() * 1.6 - 0.8 });
  }

  /** A roll of thunder. `strength` near 0 is far off and soft. Near 1 it cracks overhead. */
  thunder(time: number, strength: number, pan = 0): void {
    const rig = this.rig;
    const seconds = 3 + strength * 2.5;
    const b = rig.begin('ambience', strength > 0.6 ? 2 : 0, time, time + seconds);
    if (!b) return;
    const rise = 0.5 - 0.42 * strength;
    const level = 0.5 * strength + 0.12;
    const low = b.filter('lowpass', 150 + 500 * strength, 0.6);
    low.frequency.setValueAtTime(150 + 500 * strength, time);
    low.frequency.exponentialRampToValueAtTime(70, time + seconds);
    const amp = b.gain();
    // It rolls: a hit, a dip and a second swell before it dies away.
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(level, time + rise);
    amp.gain.exponentialRampToValueAtTime(level * 0.35, time + rise + 0.6);
    amp.gain.linearRampToValueAtTime(level * 0.7, time + rise + 1.0);
    amp.gain.exponentialRampToValueAtTime(level * 0.002, time + seconds - 0.02);
    amp.gain.linearRampToValueAtTime(0, time + seconds);
    const out = b.pan(pan);
    connect(b.noise('brown', 0.9), low, amp, out, this.far);
    if (strength > 0.6) {
      const crack = b.gain();
      strike(crack.gain, time, 0.004, 0.3 * strength, 0.22);
      connect(b.noise('white', 0.8), b.filter('bandpass', 1300, 0.5), crack, out);
    }
    b.commit(time, time + seconds);
  }

  /** An owl far off: two soft hoots that fall a little. */
  private owl(time: number): void {
    const spec = sound.owl, rig = this.rig;
    const level = spec.gain * this.habitat.owl;
    const seconds = spec.seconds;
    const b = rig.begin('ambience', 0, time, time + seconds);
    if (!b) return;
    const pitch = spec.pitch + rig.rng() * spec.spread;
    const amp = b.gain(), pan = b.pan(rig.rng() * 1.6 - 0.8);
    const source = b.osc('sine', pitch);
    const filter = b.filter('bandpass', pitch, 0.8);
    for (let i = 0; i < 2; i++) strike(amp.gain, time + i * seconds / 2, 0.06, level * (0.7 + rig.rng() * 0.3), seconds / 2 * 0.8);
    source.frequency.setValueAtTime(pitch, time);
    source.frequency.exponentialRampToValueAtTime(pitch * 0.78, time + seconds);
    connect(source, filter, amp, pan, this.far);
    b.commit(time, time + seconds);
  }

  private bird(time: number): void {
    const rig = this.rig;
    const r = rig.rng;
    const kind = Math.floor(r() * 4);
    const level = sound.bird.gain + r() * sound.bird.variation;
    const base = 2500 + r() * 1400;
    // Each call is a list of syllables: start, length, pitch from, pitch to.
    const parts: [number, number, number, number][] = [];
    let at = 0;
    if (kind === 0) {
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) { parts.push([at, 0.07, base, base * 1.28]); at += 0.13; }
    } else if (kind === 1) {
      const n = 4 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) { const up = i % 2 === 0; parts.push([at, 0.06, base * (up ? 1 : 1.18), base * (up ? 1.15 : 0.95)]); at += 0.075; }
    } else if (kind === 2) {
      parts.push([0, 0.32, base * 1.2, base * 0.85]);
      at = 0.34;
    } else {
      const n = 6 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) { parts.push([at, 0.03, base * 1.4, base * 1.3]); at += 0.058; }
    }
    const b = rig.begin('ambience', 0, time, time + at + 0.02);
    if (!b) return;
    const o = b.osc('sine', base);
    const amp = b.gain();
    for (const [start, length, from, to] of parts) {
      const s = time + start;
      o.frequency.setValueAtTime(from, s);
      o.frequency.exponentialRampToValueAtTime(to, s + length);
      amp.gain.setValueAtTime(0, s);
      amp.gain.linearRampToValueAtTime(level, s + length * 0.3);
      amp.gain.linearRampToValueAtTime(0, s + length);
    }
    connect(o, amp, b.pan(r() * 1.7 - 0.85), this.far);
    b.commit(time, time + at + 0.02);
  }

  private cricket(time: number): void {
    const rig = this.rig;
    const r = rig.rng;
    const chirps = 3 + Math.floor(r() * 4);
    const every = 0.26 + r() * 0.14;
    const seconds = chirps * every;
    const b = rig.begin('ambience', 0, time, time + seconds);
    if (!b) return;
    const o = b.osc('sine', 4200 + r() * 700);
    const amp = b.gain();
    const level = sound.cricket.gain + r() * sound.cricket.variation;
    for (let c = 0; c < chirps; c++) {
      for (let p = 0; p < 3; p++) {
        const s = time + c * every + p * 0.024;
        amp.gain.setValueAtTime(0, s);
        amp.gain.linearRampToValueAtTime(level, s + 0.004);
        amp.gain.linearRampToValueAtTime(0, s + 0.014);
      }
    }
    connect(o, amp, b.pan(r() * 1.8 - 0.9), this.near);
    b.commit(time, time + seconds);
  }

  private frog(time: number): void {
    const rig = this.rig;
    const r = rig.rng;
    const pitch = 150 + r() * 90;
    const pulses = 5 + Math.floor(r() * 4);
    const seconds = pulses * 0.036 * 2 + 0.12;
    const b = rig.begin('ambience', 0, time, time + seconds);
    if (!b) return;
    const o = b.osc('sawtooth', pitch);
    const amp = b.gain();
    const level = 0.05 + r() * 0.04;
    // Two short croaks, the second a little higher.
    for (let part = 0; part < 2; part++) {
      const start = time + part * (pulses * 0.036 + 0.1);
      o.frequency.setValueAtTime(pitch * (part === 0 ? 1 : 1.22), start);
      for (let p = 0; p < pulses; p++) {
        const s = start + p * 0.036;
        amp.gain.setValueAtTime(0, s);
        amp.gain.linearRampToValueAtTime(level, s + 0.008);
        amp.gain.linearRampToValueAtTime(0, s + 0.03);
      }
    }
    connect(o, b.filter('bandpass', 700 + r() * 400, 4), amp, b.pan(r() * 1.6 - 0.8), this.near);
    b.commit(time, time + seconds);
  }

  private bubble(time: number, near: number): void {
    const rig = this.rig;
    const b = rig.begin('ambience', 0, time, time + 0.1);
    if (!b) return;
    const from = 380 + rig.rng() * 500;
    const o = b.osc('sine', from);
    o.frequency.setValueAtTime(from, time);
    o.frequency.exponentialRampToValueAtTime(from * (1.5 + rig.rng() * 0.6), time + 0.07);
    const amp = b.gain();
    strike(amp.gain, time, 0.006, (0.02 + rig.rng() * 0.03) * near, 0.07);
    connect(o, amp, b.pan(rig.rng() * 1.2 - 0.6), this.near);
    b.commit(time, time + 0.1);
  }

  private farBell(time: number, kind: SignatureBed): void {
    const rig = this.rig;
    const entry = this.signature.find((s) => s.kind === kind);
    if (!entry) return;
    const p = this.palettes[entry.index] as Palette;
    const degree = Math.floor(rig.rng() * (p.scale.length + 2));
    const midi = p.root + 24 + degreeSemis(p.scale, degree);
    playNote(rig, this.far, kind === 'stillAir' ? glassBell : chime, time, midi, 0.2, 0.06 + rig.rng() * 0.05, { bus: 'ambience', priority: 0, pan: rig.rng() * 1.6 - 0.8 });
  }

  dispose(): void {
    for (const node of this.nodes) {
      if (node instanceof AudioBufferSourceNode) node.stop();
      node.disconnect();
    }
  }
}
