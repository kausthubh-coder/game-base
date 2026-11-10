// Walking along a path at an even speed. People and pets share it.

import type { Vec3 } from '../../engine/types.ts';
import type { World } from '../../features/world/world.sim.ts';
import { walkToward } from '../move.sim.ts';

/** Anything with a path and a place on it. `next` is the index of the point it walks to now. */
export interface Walker {
  path: readonly Vec3[] | null;
  next: number;
}

/**
 * Moves `pos` along the walker's path by `speed * dt` blocks, turning corners inside one step.
 * Returns the facing it moved in, or null when it did not move: then either the path is done
 * (`next` has reached its length) or something is in the way.
 */
export function walkAlong(world: World, pos: Vec3, walker: Walker, speed: number, dt: number): number | null {
  const path = walker.path;
  if (!path) return null;
  let left = speed * dt, facing: number | null = null;
  while (left > 1e-6 && walker.next < path.length) {
    const point = path[walker.next];
    const d = Math.hypot(point.x - pos.x, point.z - pos.z);
    if (d < 0.05) {
      // Too close to walk to. At the end of the path, stand exactly on the last point.
      if (walker.next === path.length - 1) { pos.x = point.x; pos.z = point.z; }
      walker.next++;
      continue;
    }
    const stride = Math.min(d, left);
    const moved = walkToward(world, pos, point.x, point.z, stride / dt, dt);
    if (moved === null) break;
    facing = moved;
    left -= stride;
    if (stride >= d - 1e-9) walker.next++;
  }
  return facing;
}
