// The shapes an attack can have on the ground, and whether a point is inside one. Pure functions.
//
// Facing is the game's: 0 faces north (-z) and it grows clockwise seen from above, so a quarter turn faces east (+x).

/** The step east (+x) of one block walked the way `facing` points. */
export const dirX = (facing: number): number => Math.sin(facing);
/** The step south (+z) of one block walked the way `facing` points. */
export const dirZ = (facing: number): number => -Math.cos(facing);
/** The facing of a direction of travel. */
export const facingOf = (dx: number, dz: number): number => Math.atan2(dx, -dz);

/** The smallest turn from one facing to another, from -PI to PI. */
export function turnBetween(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when the point is within `radius` of the middle. */
export function inCircle(px: number, pz: number, x: number, z: number, radius: number): boolean {
  const dx = px - x, dz = pz - z;
  return dx * dx + dz * dz <= radius * radius;
}

/**
 * True when the point is in the strip that starts at (x, z), runs `length` blocks the way `facing` points and
 * is `width` wide. `grow` widens it on every side, for a body bigger than a point.
 */
export function inLine(px: number, pz: number, x: number, z: number, facing: number, length: number, width: number, grow = 0): boolean {
  const fx = dirX(facing), fz = dirZ(facing), dx = px - x, dz = pz - z;
  const along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx);
  return along >= -grow && along <= length + grow && across <= width / 2 + grow;
}

/**
 * True when the point is in the wedge at (x, z) that opens `half` radians to each side of `facing` and reaches
 * `reach` blocks. A body of radius `grow` is in it when any part of it is.
 */
export function inCone(px: number, pz: number, x: number, z: number, facing: number, reach: number, half: number, grow = 0): boolean {
  const dx = px - x, dz = pz - z, distance = Math.hypot(dx, dz);
  if (distance > reach + grow) return false;
  if (distance <= grow) return true;
  // A body this wide covers this much more of the angle at its distance.
  const wide = grow > 0 ? Math.asin(Math.min(1, grow / distance)) : 0;
  return Math.abs(turnBetween(facing, facingOf(dx, dz))) <= half + wide;
}
