// Small curves the shots are written with. Every one is a function of time alone, so a frame never depends on
// the frame before it.

export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;
/** Smoothstep: starts and stops at rest. */
export const ease = (p: number) => { const q = clamp(p); return q * q * (3 - 2 * q); };
/** Smootherstep, for the camera: no jolt at either end. */
export const glide = (p: number) => { const q = clamp(p); return q * q * q * (q * (q * 6 - 15) + 10); };
/** Fast start, soft landing: a piece set down on the wall. */
export const land = (p: number) => 1 - (1 - clamp(p)) ** 3;
/** 0 before a, 1 after b, eased between. Times in seconds. */
export const ramp = (t: number, a: number, b: number) => ease((t - a) / Math.max(1e-6, b - a));
/** A slow sine from -1 to 1, `hz` cycles a second, offset by `phase` turns. */
export const wave = (t: number, hz: number, phase = 0) => Math.sin((t * hz + phase) * Math.PI * 2);
/** A damped wobble after a landing at time `at`: big first, gone in `fade` seconds. */
export const settle = (t: number, at: number, hz: number, fade: number) =>
  t < at ? 0 : Math.sin((t - at) * hz * Math.PI * 2) * Math.exp(-(t - at) * (4.6 / fade));
/** A fixed "random" number in 0..1 for index i and channel k. */
export const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
/** A flicker made of three unrelated waves, 0..1, for flames and failing lights. */
export const flicker = (t: number, seed = 0) =>
  0.5 + 0.22 * Math.sin(t * 9.1 + seed) + 0.17 * Math.sin(t * 23.3 + seed * 2.1 + Math.sin(t * 3.7)) + 0.11 * Math.sin(t * 41.7 + seed * 5.3);

/**
 * Which drawing of a cycle shows at time t, held like cut-out animation: each drawing holds for `1 / perSecond`
 * and only the last `soft` share of the hold dissolves into the next, so cloth breathes rather than blinks.
 * The fraction is the dissolve. `soft` 0 swaps hard, as a pose change in a cut-out film does.
 */
export function cycle(t: number, perSecond: number, count: number, soft = 0.3, phase = 0) {
  const x = t * perSecond + phase;
  const i = Math.floor(x);
  const f = x - i;
  const m = soft > 0 ? ease((f - (1 - soft)) / soft) : 0;
  return (((i % count) + count) % count) + m;
}
