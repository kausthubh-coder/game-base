// How two or more lands mix. Region weights come in from the game (they sum to 1). This file turns them
// into a gain per layer per palette, the notes each palette may play while it shares the air, and one tempo.
// It is all a function of the weights, so walking back across a border undoes the change exactly.
import type { Palette } from '../../content/palettes/types.ts';
import { clamp, smoothstep } from './rng.sim.ts';

/** The layers a palette owns. Each one crosses a border over its own stretch of the band. */
export const PALETTE_LAYERS = ['drone', 'harmony', 'melody', 'sparkle', 'bass', 'perc', 'full'] as const;
export type PaletteLayer = (typeof PALETTE_LAYERS)[number];

/**
 * Where each layer crosses, as [silent below, full above] in region weight. The drone of the land ahead
 * arrives first and its sparkle last; the bass and the lead swap in the middle. That is "layer by layer".
 */
export const CROSSOVER: Record<PaletteLayer, readonly [number, number]> = {
  drone: [0.1, 0.55],
  harmony: [0.28, 0.68],
  melody: [0.42, 0.58],
  bass: [0.45, 0.56],
  perc: [0.36, 0.64],
  full: [0.5, 0.8],
  sparkle: [0.55, 0.9],
};

/** Below this weight a palette is not heard at all, so nothing is scheduled for it. */
export const SILENT = 0.02;

/** Cleans the weights the game sends: unknown regions are dropped, negatives are zero, the rest sum to 1. */
export function normalizeWeights(input: Readonly<Record<string, number>>, ids: readonly string[], out: number[]): void {
  let sum = 0;
  for (let i = 0; i < ids.length; i++) {
    const w = input[ids[i] as string];
    const v = typeof w === 'number' && w > 0 && Number.isFinite(w) ? w : 0;
    out[i] = v;
    sum += v;
  }
  if (sum <= 0) {
    for (let i = 0; i < ids.length; i++) out[i] = i === 0 ? 1 : 0;
    return;
  }
  for (let i = 0; i < ids.length; i++) out[i] = (out[i] as number) / sum;
}

/**
 * Moves the weights toward the target at a limited speed. Walking changes them slower than the limit, so
 * the mix is exactly a function of position. A teleport is faster than the limit, so it becomes a morph
 * of under two seconds and not a cut.
 */
export function slewWeights(current: number[], target: readonly number[], dt: number, perSecond = 0.6): void {
  const most = perSecond * dt;
  let sum = 0;
  for (let i = 0; i < current.length; i++) {
    const gap = (target[i] as number) - (current[i] as number);
    const v = (current[i] as number) + (gap > most ? most : gap < -most ? -most : gap);
    current[i] = v;
    sum += v;
  }
  if (sum > 0) for (let i = 0; i < current.length; i++) current[i] = (current[i] as number) / sum;
}

/** The gain of one layer for every palette. Where two palettes overlap, the pair is held to one layer's worth of power. */
export function crossoverGains(layer: PaletteLayer, weights: readonly number[], out: number[]): void {
  const [low, high] = CROSSOVER[layer];
  let power = 0;
  for (let i = 0; i < weights.length; i++) {
    const g = smoothstep(low, high, weights[i] as number);
    out[i] = g;
    power += g * g;
  }
  if (power > 1) {
    const scale = 1 / Math.sqrt(power);
    for (let i = 0; i < weights.length; i++) out[i] = (out[i] as number) * scale;
  }
}

/** The index of the heaviest palette. */
export function dominant(weights: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < weights.length; i++) if ((weights[i] as number) > (weights[best] as number)) best = i;
  return best;
}

/** One tempo for the whole mix, so both lands in a border band share a beat. */
export function blendTempo(tempos: readonly number[], weights: readonly number[]): number {
  let log = 0;
  let sum = 0;
  for (let i = 0; i < tempos.length; i++) {
    log += Math.log(tempos[i] as number) * (weights[i] as number);
    sum += weights[i] as number;
  }
  return sum > 0 ? Math.exp(log / sum) : (tempos[0] as number);
}

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** Every note a palette can sound (its scale, its color notes and its chords) as twelve bits, bit 0 for C. */
export function pitchMask(p: Palette): number {
  let mask = 0;
  for (const s of p.scale) mask |= 1 << mod12(p.root + s);
  for (const s of p.color ?? []) mask |= 1 << mod12(p.root + s);
  for (const chord of p.chords) for (const t of chord.tones) mask |= 1 << mod12(p.root + chord.root + t);
  return mask;
}

export function countBits(mask: number): number {
  let n = 0;
  for (let i = 0; i < 12; i++) if (mask & (1 << i)) n++;
  return n;
}

/** A palette keeps its whole scale above this weight. Below it, it plays only notes its neighbor also has. */
export const OWN_SCALE_ABOVE = 0.8;
/** A neighbor lighter than this does not count. */
const NEIGHBOR_ABOVE = 0.2;

/**
 * The notes each palette may play right now. Deep inside a land that is the land's own scale. In a border
 * band both lands keep to the notes they share, so the scale changes through common notes and never clashes.
 */
export function allowedMasks(masks: readonly number[], weights: readonly number[], out: number[]): void {
  for (let i = 0; i < masks.length; i++) {
    const own = masks[i] as number;
    out[i] = own;
    if ((weights[i] as number) >= OWN_SCALE_ABOVE) continue;
    let other = -1;
    for (let j = 0; j < masks.length; j++) {
      if (j === i || (weights[j] as number) < NEIGHBOR_ABOVE) continue;
      if (other < 0 || (weights[j] as number) > (weights[other] as number)) other = j;
    }
    if (other < 0) continue;
    const shared = own & (masks[other] as number);
    if (countBits(shared) >= 3) out[i] = shared;
  }
}

/** Moves a note to the nearest allowed pitch, at most a few semitones away. A tie goes down. */
export function snapToMask(midi: number, mask: number): number {
  if (mask === 0) return midi;
  for (let d = 0; d <= 6; d++) {
    if (mask & (1 << mod12(midi - d))) return midi - d;
    if (mask & (1 << mod12(midi + d))) return midi + d;
  }
  return midi;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(midi: number): string {
  return NAMES[mod12(midi)] as string;
}

export function maskNames(mask: number): string {
  const out: string[] = [];
  for (let i = 0; i < 12; i++) if (mask & (1 << i)) out.push(NAMES[i] as string);
  return out.join(' ');
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** How much the day shows, 0 at night to 1 by day, from a time of day where 0 is midnight and 0.5 is noon. */
export function dayAmount(timeOfDay: number): number {
  const sun = -Math.cos(2 * Math.PI * timeOfDay);
  return clamp((sun + 0.15) / 0.4, 0, 1);
}
