// Small helpers for anything that walks without the hero's full body: people, pets and creatures.

import type { Vec3 } from '../engine/types.ts';
import type { World } from '../features/world/world.sim.ts';
import { SOLID } from '../features/world/chunk.sim.ts';

const solid = (world: World, x: number, y: number, z: number): boolean => SOLID[world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))] === 1;

/** True when a body two blocks tall can stand with its feet at this height in this column. */
export function standable(world: World, x: number, y: number, z: number): boolean {
  return solid(world, x, y - 1, z) && !solid(world, x, y, z) && !solid(world, x, y + 1, z);
}

/**
 * The height of the floor nearest to `y` in this column: the same level, one step up, or up to three down.
 * Returns null when there is nowhere to stand, such as a wall or a drop.
 */
export function floorNear(world: World, x: number, y: number, z: number): number | null {
  const base = Math.floor(y + 0.01);
  for (const dy of [0, 1, -1, -2, -3]) if (standable(world, x, base + dy, z)) return base + dy;
  return null;
}

/**
 * Moves a walker toward a point at `speed` blocks a second, following the ground and stopping at walls.
 * It writes `pos` and returns the facing it moved in, or null when it did not move.
 */
export function walkToward(world: World, pos: Vec3, tx: number, tz: number, speed: number, dt: number): number | null {
  const dx = tx - pos.x, dz = tz - pos.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.05) return null;
  const step = Math.min(distance, speed * dt);
  const nx = pos.x + (dx / distance) * step, nz = pos.z + (dz / distance) * step;
  const floor = floorNear(world, nx, pos.y, nz);
  if (floor === null) return null;
  pos.x = nx;
  pos.z = nz;
  pos.y += Math.max(-8 * dt, Math.min(8 * dt, floor - pos.y));
  if (Math.abs(floor - pos.y) < 0.02) pos.y = floor;
  return facingOf(dx, dz);
}

/** The facing for a direction of travel. 0 faces north (-z) and it turns clockwise seen from above. */
export function facingOf(dx: number, dz: number): number {
  return Math.atan2(dx, -dz);
}

export function distance2d(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
