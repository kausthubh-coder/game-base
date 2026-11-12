// The sounds of a camp fire and of a film, made by code on the sound engine's effects bus (AGENTS.md rule 4:
// no files by hand, and this Mac has no ElevenLabs key). The fire is a soft roar of filtered noise with
// crackles scattered over it. The film adds a twig that snaps, a pop of the fire, and a low held note that
// swells from nothing. src/game/views/world-camp.view.ts plays the fire, src/game/views/story-cutscene.view.ts
// the rest.
import type { FilmCue } from '../content/cutscenes.ts';

/** Seconds of noise in the one buffer every sound here plays slices of. */
const NOISE_SECONDS = 2;
/** Crackles a second with the fire at full level, and how far ahead they are scheduled. */
const CRACKLES = 9, AHEAD = 0.2;
/** How quickly a level follows what it is set to, in seconds. */
const GLIDE = 0.12;

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseOf(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noises.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Pinkish: a little of each sample carried into the next, so the roar is not a hiss.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = last * 0.86 + (Math.random() * 2 - 1) * 0.14;
      data[i] = last * 2.6 + (Math.random() * 2 - 1) * 0.08;
    }
    noises.set(ctx, buffer);
  }
  return buffer;
}

/** A burst of noise through a band, falling away: a crackle, a snap, a pop. */
function burst(ctx: BaseAudioContext, out: AudioNode, at: number, options: { freq: number; q: number; gain: number; decay: number; type?: BiquadFilterType }): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseOf(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = options.type ?? 'bandpass';
  filter.frequency.value = options.freq;
  filter.Q.value = options.q;
  const level = ctx.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(options.gain, at + 0.002);
  level.gain.exponentialRampToValueAtTime(0.0001, at + options.decay);
  source.connect(filter).connect(level).connect(out);
  source.start(at, Math.random() * (NOISE_SECONDS - 0.5), options.decay + 0.05);
}

export interface FireSound {
  /** 0 to 1, a few times a second or every frame. It glides there. */
  set(level: number): void;
  /** Schedules the crackles due. Call every frame. */
  update(): void;
  stop(): void;
}

export function createFireSound(ctx: BaseAudioContext, out: AudioNode): FireSound {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(out);
  // The roar: noise under 700 Hz, very soft.
  const roar = ctx.createBufferSource();
  roar.buffer = noiseOf(ctx);
  roar.loop = true;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 700;
  const roarLevel = ctx.createGain();
  roarLevel.gain.value = 0.16;
  roar.connect(low).connect(roarLevel).connect(master);
  roar.start();
  let level = 0, next = ctx.currentTime, stopped = false;

  return {
    set(value) {
      if (stopped) return;
      level = Math.max(0, Math.min(1, value));
      master.gain.setTargetAtTime(level * 0.9, ctx.currentTime, GLIDE);
    },
    update() {
      if (stopped || level <= 0.01) {
        next = Math.max(next, ctx.currentTime);
        return;
      }
      const until = ctx.currentTime + AHEAD;
      while (next < until) {
        // Most crackles are small and bright; now and then one is a fat snap of sap.
        const big = Math.random() < 0.12;
        burst(ctx, master, Math.max(next, ctx.currentTime), {
          freq: big ? 1200 + Math.random() * 900 : 2200 + Math.random() * 3200, q: big ? 1.2 : 2.5,
          gain: (big ? 0.55 : 0.22) * (0.5 + Math.random() * 0.5), decay: big ? 0.05 : 0.012 + Math.random() * 0.02,
        });
        next += (-Math.log(1 - Math.random()) / (CRACKLES * (0.4 + 0.6 * level)));
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      roar.stop(ctx.currentTime + 2.5);
      setTimeout(() => master.disconnect(), 2600);
    },
  };
}

export interface FilmSound {
  /** The held note's level, 0 to 1. */
  setNote(level: number): void;
  cue(cue: FilmCue): void;
  stop(): void;
}

export function createFilmSound(ctx: BaseAudioContext, out: AudioNode): FilmSound {
  // The held note: A1 and the E above it, with a soft octave that beats slowly against them, kept dark.
  const note = ctx.createGain();
  note.gain.value = 0;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 520;
  tone.Q.value = 0.4;
  tone.connect(note).connect(out);
  const voices = ([[55, 'sine', 0.5], [82.41, 'sine', 0.28], [110.6, 'triangle', 0.12]] as const).map(([freq, type, gain]) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const level = ctx.createGain();
    level.gain.value = gain;
    osc.connect(level).connect(tone);
    osc.start();
    return osc;
  });
  // A slow swell in the filter, so the note breathes.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const depth = ctx.createGain();
  depth.gain.value = 140;
  lfo.connect(depth).connect(tone.frequency);
  lfo.start();
  let stopped = false;

  return {
    setNote(level) {
      if (!stopped) note.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.34, ctx.currentTime, 0.25);
    },
    cue(cue) {
      if (stopped) return;
      const now = ctx.currentTime + 0.01;
      if (cue === 'twig') {
        // Dry wood breaking, out in the dark: two sharp cracks and a little splinter.
        burst(ctx, out, now, { freq: 3200, q: 1.6, gain: 0.9, decay: 0.03 });
        burst(ctx, out, now + 0.006, { freq: 900, q: 2.5, gain: 0.5, decay: 0.05 });
        burst(ctx, out, now + 0.05, { freq: 2600, q: 2, gain: 0.55, decay: 0.025 });
        burst(ctx, out, now + 0.09, { freq: 4200, q: 3, gain: 0.18, decay: 0.02 });
      } else if (cue === 'pop') {
        // A knot in the wood gives: one fat crack and a thump under it.
        burst(ctx, out, now, { freq: 1500, q: 1, gain: 1, decay: 0.07 });
        burst(ctx, out, now, { freq: 180, q: 0.8, gain: 0.7, decay: 0.12, type: 'lowpass' });
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      note.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
      const end = ctx.currentTime + 4;
      for (const osc of voices) osc.stop(end);
      lfo.stop(end);
      setTimeout(() => note.disconnect(), 4200);
    },
  };
}
