// The small turn, size and tint every placed prop gets, so a row of the same tree is not a row of clones.
// It depends only on where the prop stands. The same place gives the same prop on every machine and on
// every visit, and the scatter rules can work out a tree's real height without drawing it.
import type { PropVary } from '../../content/props.ts';

/** A number from 0 to 1 that depends only on a place and a salt. */
export function hash3(x: number, y: number, z: number, salt: number): number {
  let h = (Math.imul(Math.round(x * 16), 374761393) + Math.imul(Math.round(y * 16), 1103515245) + Math.imul(Math.round(z * 16), 668265263) + Math.imul(salt, 362437)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface Jitter {
  /** Radians to add to its rotation. */
  turn: number;
  /** A number near 1 to multiply its scale by. */
  size: number;
  /** A number near 1 for each of red, green and blue, to multiply its color by. */
  r: number;
  g: number;
  b: number;
}

/** Writes what a prop at this place gets into `out`, and returns it. */
export function jitterAt(vary: PropVary, x: number, y: number, z: number, out: Jitter): Jitter {
  out.turn = (hash3(x, y, z, 1) * 2 - 1) * vary.turn;
  out.size = 1 + (hash3(x, y, z, 2) * 2 - 1) * vary.size;
  const bright = (hash3(x, y, z, 3) * 2 - 1) * vary.tint;
  const warm = (hash3(x, y, z, 4) * 2 - 1) * vary.tint * 0.5;
  out.r = 1 + bright + warm;
  out.g = 1 + bright;
  out.b = 1 + bright - warm;
  return out;
}
