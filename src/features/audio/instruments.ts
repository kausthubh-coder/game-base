// The four instrument recipes and the drum kit. Each call makes one voice from a handful of nodes,
// schedules it on the audio clock and hands it to the budget. Nothing here keeps state between notes.
import type { DrumId, Patch } from '../../content/palettes/types.ts';
import { midiToHz } from './blend.sim.ts';
import { connect, hold, strike, type Build, type BusId, type Priority, type Rig } from './rig.ts';

export interface NoteOptions {
  bus?: BusId;
  priority?: Priority;
  /** Semitones below the note that it slides in from. */
  bend?: number;
  /** -1 left to 1 right. Leave it out and the note sits where its bus puts it. */
  pan?: number;
}

function finish(b: Build, last: AudioNode, out: AudioNode, pan: number | undefined, start: number, end: number): void {
  if (pan === undefined) last.connect(out);
  else connect(last, b.pan(pan), out);
  b.commit(start, end);
}

/** Plays one note of a patch. Returns false when the voice budget had no room for it. */
export function playNote(rig: Rig, out: AudioNode, patch: Patch, time: number, midi: number, seconds: number, vel: number, options: NoteOptions = {}): boolean {
  const bus = options.bus ?? 'music';
  const priority = options.priority ?? 1;
  const f = midiToHz(midi);
  const level = Math.max(0.0005, vel * (patch.gain ?? 1));
  const nyquist = rig.ctx.sampleRate * 0.45;

  if (patch.kind === 'pluck') {
    const attack = patch.attack ?? 0.004;
    // Low strings ring longer than high ones, and a quick note is let go sooner than a slow one.
    const natural = patch.decay * Math.min(1.5, Math.max(0.35, 1.25 - (midi - 48) / 60));
    const ring = Math.min(natural, Math.max(0.4, seconds * 4));
    const held = patch.damp ? Math.min(Math.max(seconds, 0.05), ring) : ring;
    const end = time + attack + held + (patch.damp ? 0.09 : 0.012);
    const b = rig.begin(bus, priority, time, end);
    if (!b) return false;
    const amp = b.gain();
    const filter = b.filter('lowpass', 1000, 0.8);
    const second = patch.detune !== undefined;
    for (let i = 0; i < (second ? 2 : 1); i++) {
      const o = b.osc(patch.wave, f);
      if (i === 1) o.detune.value = patch.detune as number;
      if (options.bend) {
        o.frequency.setValueAtTime(f * 2 ** (-options.bend / 12), time);
        o.frequency.exponentialRampToValueAtTime(f, time + (patch.bendTime ?? 0.08));
      }
      o.connect(filter);
    }
    const open = Math.min(f * patch.bright * (0.55 + 0.75 * vel), nyquist);
    const shut = Math.min(Math.max(f * 1.6, 260), open);
    filter.frequency.setValueAtTime(open, time);
    filter.frequency.exponentialRampToValueAtTime(shut, time + attack + ring * 0.55);
    const top = level * (second ? 0.62 : 1);
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(top, time + attack);
    if (patch.damp && held < ring) {
      // The string is stopped early: follow the same curve to where it would be, then close it.
      amp.gain.exponentialRampToValueAtTime(top * 0.001 ** (held / ring), time + attack + held);
      amp.gain.linearRampToValueAtTime(0, time + attack + held + 0.09);
    } else {
      amp.gain.exponentialRampToValueAtTime(top * 0.001, time + attack + ring);
      amp.gain.linearRampToValueAtTime(0, time + attack + ring + 0.012);
    }
    filter.connect(amp);
    finish(b, amp, out, options.pan, time, end);
    return true;
  }

  if (patch.kind === 'bell') {
    const attack = patch.attack ?? 0.002;
    const ring = patch.decay * Math.min(1.5, Math.max(0.4, 1.4 - (midi - 60) / 40));
    const end = time + attack + ring + 0.012;
    const b = rig.begin(bus, priority, time, end);
    if (!b) return false;
    const carrier = b.osc('sine', f);
    const mod = b.osc('sine', f * patch.ratio);
    const depth = b.gain();
    const amp = b.gain();
    // Keep the bright partials under the top of the hearing range so high bells do not turn harsh.
    const index = Math.min(patch.index, 7000 / (f * patch.ratio));
    const swing = Math.max(1, index * f * (0.4 + 0.8 * vel));
    depth.gain.setValueAtTime(swing, time);
    depth.gain.exponentialRampToValueAtTime(Math.max(0.5, swing * 0.04), time + ring * 0.6);
    connect(mod, depth);
    depth.connect(carrier.frequency);
    strike(amp.gain, time, attack, level, ring);
    carrier.connect(amp);
    finish(b, amp, out, options.pan, time, end);
    return true;
  }

  if (patch.kind === 'wind') {
    const off = time + Math.max(seconds, 0.06);
    const end = off + patch.release;
    const b = rig.begin(bus, priority, time, end);
    if (!b) return false;
    const o = b.osc(patch.wave, f);
    if (options.bend) {
      o.frequency.setValueAtTime(f * 2 ** (-options.bend / 12), time);
      o.frequency.exponentialRampToValueAtTime(f, time + 0.09);
    }
    // The vibrato comes in after the note has settled, as a player's would.
    const lfo = b.osc('sine', 4.8 + rig.rng() * 0.9);
    const wobble = b.gain();
    wobble.gain.setValueAtTime(0, time);
    wobble.gain.setValueAtTime(0, time + 0.18);
    wobble.gain.linearRampToValueAtTime(patch.vibrato, time + 0.55);
    connect(lfo, wobble);
    wobble.connect(o.detune);
    const tone = b.filter('lowpass', Math.min(patch.cutoff ?? f * 5, nyquist), 0.5);
    const amp = b.gain();
    connect(o, tone, amp);
    const air = b.noise('white');
    const band = b.filter('bandpass', Math.min(f * 2, 6000), 1.6);
    const breath = b.gain();
    const puff = level * patch.breath * 3;
    // A puff of air at the start of the note, then a steady hiss under it.
    breath.gain.setValueAtTime(puff * 2.2, time);
    breath.gain.exponentialRampToValueAtTime(Math.max(puff, 1e-5), time + 0.09);
    connect(air, band, breath, amp);
    hold(amp.gain, time, patch.attack, level, off, patch.release);
    finish(b, amp, out, options.pan, time, end);
    return true;
  }

  // pad
  const off = time + Math.max(seconds, 0.1);
  const end = off + patch.release;
  const b = rig.begin(bus, priority, time, end);
  if (!b) return false;
  const amp = b.gain();
  const mix = b.gain(1 / Math.sqrt(patch.voices));
  for (let i = 0; i < patch.voices; i++) {
    const o = b.osc(patch.wave, f);
    o.detune.value = patch.voices === 1 ? 0 : (i - (patch.voices - 1) / 2) * patch.detune;
    o.connect(mix);
  }
  if (patch.formants) {
    // Two narrow bands, like a mouth shaping a vowel.
    for (let i = 0; i < 2; i++) {
      const band = b.filter('bandpass', patch.formants[i] as number, 3.2);
      const trim = b.gain(i === 0 ? 1.6 : 1.0);
      connect(mix, band, trim, amp);
    }
    const body = b.filter('lowpass', Math.min(patch.cutoff * 0.5, nyquist), 0.5);
    connect(mix, body, amp);
  } else {
    const filter = b.filter('lowpass', 800, 0.6);
    const cutoff = Math.min(patch.cutoff * (0.75 + 0.5 * vel), nyquist);
    // The filter opens with the swell and closes as it fades.
    filter.frequency.setValueAtTime(cutoff * 0.55, time);
    filter.frequency.linearRampToValueAtTime(cutoff, time + Math.min(patch.attack * 1.5, Math.max(0.05, off - time)));
    filter.frequency.setValueAtTime(cutoff, off);
    filter.frequency.linearRampToValueAtTime(cutoff * 0.6, end);
    connect(mix, filter, amp);
  }
  hold(amp.gain, time, patch.attack, level * 0.9, off, patch.release);
  finish(b, amp, out, options.pan, time, end);
  return true;
}

// ---------------------------------------------------------------------------------------------------
// Drums. Each is a tone that drops in pitch, a burst of filtered noise, or both.

function thump(b: Build, out: AudioNode, time: number, from: number, to: number, glide: number, level: number, decay: number): void {
  const o = b.osc('sine', from);
  o.frequency.setValueAtTime(from, time);
  o.frequency.exponentialRampToValueAtTime(to, time + glide);
  const amp = b.gain();
  strike(amp.gain, time, 0.003, level, decay);
  connect(o, amp, out);
}

function burst(b: Build, out: AudioNode, time: number, type: BiquadFilterType, freq: number, q: number, level: number, attack: number, decay: number): void {
  // A small spread in playback speed, so repeated hits differ.
  const n = b.noise('white', 0.85 + b.rig.rng() * 0.3);
  const filter = b.filter(type, freq, q);
  const amp = b.gain();
  strike(amp.gain, time, attack, level, decay);
  connect(n, filter, amp, out);
}

/** How long each drum sounds, in seconds. The budget needs it before the drum is built. */
const DRUM_SECONDS: Record<DrumId, number> = {
  hand: 0.24, handLow: 0.32, frameDum: 0.4, frameTek: 0.1, tablaLow: 0.42, tablaHigh: 0.3, deep: 0.7, anvil: 0.45,
  shaker: 0.08, click: 0.08, kick: 0.34, snare: 0.2, hat: 0.05, tom: 0.3, swell: 1.5, pulse: 0.3,
};

/** Plays one drum hit. `midi` tunes the drums that have a pitch. Returns false when there was no room. */
export function playDrum(rig: Rig, out: AudioNode, drum: DrumId, time: number, vel: number, midi = 57, options: NoteOptions = {}): boolean {
  const seconds = DRUM_SECONDS[drum];
  const b = rig.begin(options.bus ?? 'music', options.priority ?? 1, time, time + seconds);
  if (!b) return false;
  const sum = b.gain(1);
  const v = Math.max(0.001, vel);
  const jitter = 0.97 + rig.rng() * 0.06;
  switch (drum) {
    case 'hand':
      thump(b, sum, time, 196 * jitter, 150 * jitter, 0.03, v * 0.8, 0.2);
      burst(b, sum, time, 'bandpass', 1300, 1, v * 0.22, 0.001, 0.04);
      break;
    case 'handLow':
      thump(b, sum, time, 126 * jitter, 92 * jitter, 0.04, v * 0.9, 0.28);
      burst(b, sum, time, 'lowpass', 500, 0.7, v * 0.2, 0.001, 0.03);
      break;
    case 'frameDum':
      thump(b, sum, time, 104 * jitter, 72 * jitter, 0.05, v, 0.36);
      burst(b, sum, time, 'lowpass', 320, 0.7, v * 0.3, 0.002, 0.05);
      break;
    case 'frameTek':
      burst(b, sum, time, 'bandpass', 2500 * jitter, 2, v * 0.55, 0.001, 0.05);
      thump(b, sum, time, 430 * jitter, 380 * jitter, 0.02, v * 0.3, 0.06);
      break;
    case 'tablaLow': {
      // The low drum's pitch bends up after the hit: the heel of the hand pressing the skin.
      const o = b.osc('sine', 82);
      o.frequency.setValueAtTime(82 * jitter, time);
      o.frequency.exponentialRampToValueAtTime(122 * jitter, time + 0.13);
      o.frequency.exponentialRampToValueAtTime(96 * jitter, time + 0.4);
      const amp = b.gain();
      strike(amp.gain, time, 0.004, v, 0.38);
      connect(o, amp, sum);
      break;
    }
    case 'tablaHigh': {
      // A ringing skin tuned to the home note of the palette.
      const f = midiToHz(midi) * (midi < 60 ? 2 : 1);
      for (const [mult, part, decay] of [[1, 0.6, 0.26], [2.02, 0.25, 0.14], [3.01, 0.12, 0.08]] as const) {
        const o = b.osc('sine', f * mult);
        const amp = b.gain();
        strike(amp.gain, time, 0.002, v * part, decay);
        connect(o, amp, sum);
      }
      burst(b, sum, time, 'bandpass', 3000, 1.2, v * 0.2, 0.001, 0.012);
      break;
    }
    case 'deep':
      thump(b, sum, time, 78 * jitter, 43 * jitter, 0.09, v, 0.62);
      burst(b, sum, time, 'lowpass', 220, 0.7, v * 0.3, 0.002, 0.06);
      break;
    case 'anvil': {
      const f = 1180 * (0.94 + rig.rng() * 0.12);
      const carrier = b.osc('sine', f);
      const mod = b.osc('sine', f * 1.47);
      const depth = b.gain(f * 2.2);
      depth.gain.setValueAtTime(f * 2.2, time);
      depth.gain.exponentialRampToValueAtTime(f * 0.1, time + 0.25);
      connect(mod, depth);
      depth.connect(carrier.frequency);
      const amp = b.gain();
      strike(amp.gain, time, 0.001, v * 0.5, 0.4);
      connect(carrier, amp, sum);
      burst(b, sum, time, 'highpass', 4500, 0.7, v * 0.25, 0.001, 0.015);
      break;
    }
    case 'shaker':
      burst(b, sum, time, 'highpass', 5500, 0.7, v * 0.5, 0.008, 0.055);
      break;
    case 'click':
      thump(b, sum, time, 920 * jitter, 830 * jitter, 0.01, v * 0.5, 0.055);
      burst(b, sum, time, 'bandpass', 1900, 2, v * 0.25, 0.001, 0.02);
      break;
    case 'kick':
      thump(b, sum, time, 150, 47, 0.07, v, 0.3);
      burst(b, sum, time, 'lowpass', 1800, 0.7, v * 0.25, 0.001, 0.008);
      break;
    case 'snare':
      thump(b, sum, time, 215 * jitter, 172 * jitter, 0.03, v * 0.45, 0.1);
      burst(b, sum, time, 'bandpass', 1900, 0.7, v * 0.6, 0.001, 0.15);
      break;
    case 'hat':
      burst(b, sum, time, 'highpass', 7500, 0.7, v * 0.4, 0.001, 0.032);
      break;
    case 'tom': {
      const f = midiToHz(midi);
      thump(b, sum, time, f * 1.25, f, 0.05, v * 0.9, 0.26);
      break;
    }
    case 'swell':
      burst(b, sum, time, 'highpass', 3200, 0.5, v * 0.4, 0.006, 1.4);
      break;
    case 'pulse':
      thump(b, sum, time, 64, 46, 0.06, v, 0.26);
      break;
  }
  finish(b, sum, out, options.pan, time, time + seconds);
  return true;
}
