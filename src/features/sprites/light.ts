// The light a sprite stands in. Sprites are not lit by the scene's lamps, so their color is worked
// out here: the daylight for the hour, dimmed by how much sky reaches the spot, plus lamp light.
// Plain numbers only. Colors are linear RGB.
import type { Ambient } from '../../engine/types.ts';

export type Rgb = [number, number, number];

/** Daylight at full strength for a time of day. Night is a dim blue, never black. */
const DAY_KEYS: readonly (readonly [time: number, r: number, g: number, b: number])[] = [
  [0, 0.2, 0.26, 0.5],
  [0.18, 0.2, 0.26, 0.5],
  [0.215, 0.5, 0.42, 0.56],
  [0.262, 1.0, 0.76, 0.66],
  [0.35, 1.0, 0.97, 0.9],
  [0.5, 1.0, 1.0, 0.96],
  [0.65, 1.0, 0.96, 0.88],
  [0.715, 1.0, 0.8, 0.62],
  [0.762, 0.86, 0.56, 0.5],
  [0.785, 0.46, 0.38, 0.56],
  [0.83, 0.2, 0.26, 0.5],
  [1, 0.2, 0.26, 0.5],
];

/** The color of lamp light at full strength. The terrain uses the same. */
export const LAMP_LIGHT: Readonly<Rgb> = [1.3, 1.0, 0.62];

/**
 * Fills `out` with the color to multiply an open-air sprite by, from the time of day and the
 * weather in `ambient`. Clouds and rain grey it and dim it. Lightning adds a white flash.
 */
export function dayLight(ambient: Ambient, out: Rgb): Rgb {
  const time = ((ambient.timeOfDay % 1) + 1) % 1;
  let i = 0;
  while (i < DAY_KEYS.length - 2 && DAY_KEYS[i + 1][0] <= time) i++;
  const a = DAY_KEYS[i], b = DAY_KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (time - a[0]) / (b[0] - a[0])));
  let r = a[1] + (b[1] - a[1]) * t, g = a[2] + (b[2] - a[2]) * t, bl = a[3] + (b[3] - a[3]) * t;

  const overcast = Math.min(1, Math.max(ambient.cloud, ambient.rain));
  const grey = r * 0.3 + g * 0.5 + bl * 0.2;
  const wash = overcast * 0.6, dim = 1 - overcast * 0.28;
  r = (r + (grey - r) * wash) * dim;
  g = (g + (grey - g) * wash) * dim;
  bl = (bl + (grey - bl) * wash) * dim;

  const flash = ambient.flash * 0.9;
  out[0] = r + flash;
  out[1] = g + flash;
  out[2] = bl + flash * 1.05;
  return out;
}

/**
 * How bright a light level is, 0 to 1. Each of the 15 steps down is a fifth darker, the same curve
 * the terrain uses, so a character and the block it stands on darken together.
 */
export function lightCurve(level: number): number {
  const clamped = level < 0 ? 0 : level > 15 ? 15 : level;
  return Math.pow(0.8, 15 - clamped);
}
