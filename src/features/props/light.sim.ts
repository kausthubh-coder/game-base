// When the lamps are on. The clock in Ambient has sunrise at 0.25 and sunset at 0.75: lights come up
// through dusk and go out through dawn.

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 0 by day and 1 at night, from `Ambient.timeOfDay`. */
export function darkness(timeOfDay: number): number {
  const t = timeOfDay - Math.floor(timeOfDay);
  return Math.max(1 - smoothstep(0.215, 0.265, t), smoothstep(0.735, 0.785, t));
}
