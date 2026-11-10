import { outdoorSound } from '../../content/ambience.ts';
// The numbers behind the ambience: how hard the wind is blowing this instant, and how long until the
// next bird. The engine turns them into sound.
import { clamp, type Rng } from './rng.sim.ts';

function lattice(i: number, seed: number): number {
  let h = Math.imul(i ^ seed, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Smooth noise along one line, 0 to 1. The same time and seed give the same value. */
export function noise1(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  return lattice(i, seed) * (1 - s) + lattice(i + 1, seed) * s;
}

/**
 * How strong the wind is at this second, 0 to about 1.3, around a steady level of 1. Slow swells carry
 * faster flutters, and now and then both peak together: that is a gust.
 */
export function gust(time: number, seed: number): number {
  const slow = noise1(time * 0.11, seed);
  const mid = noise1(time * 0.37, seed + 17);
  const fast = noise1(time * 1.3, seed + 31);
  return clamp(0.35 + 0.75 * slow * slow + 0.45 * mid * slow + 0.12 * fast, 0, 1.4);
}

/** Seconds until the next call of something that happens `rate` times a second on average. */
export function nextGap(rate: number, rng: Rng): number {
  if (rate <= 0.001) return 1;
  const u = Math.max(rng(), 1e-6);
  return clamp(-Math.log(u) / rate, 0.08, 20);
}

export interface LifeRates {
  birds: number;
  crickets: number;
  frogs: number;
}

/** How often each creature calls, in calls a second, written into `into`. Birds by day, crickets and frogs at night. */
export function lifeRates(day: number, rain: number, trees: number, nearWater: number, indoors: number, cloud: number, into: LifeRates): LifeRates {
  const dry = 1 - clamp(rain, 0, 1);
  const out = 1 - 0.85 * clamp(indoors, 0, 1);
  const night = 1 - day;
  into.birds = 0.5 * day * day * dry * dry * (0.35 + 0.65 * clamp(trees, 0, 1)) * (1 - 0.4 * clamp(cloud, 0, 1)) * out;
  into.crickets = 0.55 * night * night * (0.4 + 0.6 * dry) * out;
  into.frogs = 0.3 * night * clamp(nearWater * 1.5 + rain * 0.5, 0, 1) * out;
  return into;
}

export interface AmbientLayers { birds: number; owl: number; town: number; water: number; rain: number; leaves: number }

/** Continuous habitat weights. The caller owns `into`, so sampling produces no garbage. */
export function ambientLayers(day: number, rain: number, town: number, trees: number, water: number, indoors: number, into: AmbientLayers): AmbientLayers {
  const d = clamp(day, 0, 1), r = clamp(rain, 0, 1), t = clamp(town, 0, 1), leaf = clamp(trees, 0, 1);
  const outside = 1 - 0.85 * clamp(indoors, 0, 1);
  into.birds = d * d * (1 - r) ** 2 * (0.35 + 0.65 * leaf) * (1 - 0.7 * t) * outside;
  into.owl = (1 - d) ** 2 * (0.35 + 0.65 * leaf) * (1 - r) * (1 - 0.8 * t) * outside;
  into.town = t * (0.12 + 0.88 * d) * (1 - 0.55 * r) * outside;
  into.water = clamp(water, 0, 1) * outside;
  into.rain = r * outside;
  into.leaves = leaf * outside;
  return into;
}

/** Quiet air has no fixed hiss floor. */
export function windLevel(wind: number, swell: number): number {
 return outdoorSound.wind.gain * clamp(wind, 0, 1) ** outdoorSound.wind.power * Math.max(0, swell - 0.3) ** 1.5;
}
