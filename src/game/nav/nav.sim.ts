// Path finding over block columns: A* between the blocks where a body two blocks tall can stand.
// A step goes to one of the eight neighbors, up or down one block at most, and never cuts a corner.

import type { Vec3 } from '../../engine/types.ts';
import { LIQUID, SOLID } from '../../features/world/chunk.sim.ts';
import type { World } from '../../features/world/world.sim.ts';
import { standable } from '../move.sim.ts';

/** How many blocks a search may expand before it gives up. */
export const DEFAULT_LIMIT = 4000;

const DIAGONAL = Math.SQRT2;
/** What one block of climb or drop adds to a step, so a flat way wins over a bumpy one of the same length. */
const CLIMB = 0.2;
/** Heights tried around a point when looking for its floor: the same level first, then up one, then down. */
const FLOORS = [0, 1, -1, -2, -3];

const solid = (world: World, x: number, y: number, z: number): boolean => SOLID[world.getBlock(x, y, z)] === 1;
const liquid = (world: World, x: number, y: number, z: number): boolean => LIQUID[world.getBlock(x, y, z)] === 1;

/** True when a walker can stand with its feet in this block: solid below, two blocks of air, no water. */
export function canStand(world: World, x: number, y: number, z: number): boolean {
  return standable(world, x, y, z) && !liquid(world, x, y, z) && !liquid(world, x, y + 1, z);
}

/** The height of the dry floor nearest to `y` in this column, or null. */
export function floorAt(world: World, x: number, y: number, z: number): number | null {
  const base = Math.floor(y + 0.01);
  for (const dy of FLOORS) if (canStand(world, x, base + dy, z)) return base + dy;
  return null;
}

/** The center of the nearest block to stand on within `radius` blocks of a point, or null. */
export function nearestStand(world: World, at: Vec3, radius: number, skip?: (x: number, z: number) => boolean): Vec3 | null {
  const cx = Math.floor(at.x), cz = Math.floor(at.z), r = Math.ceil(radius);
  let best: Vec3 | null = null, bestD = Infinity;
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      const x = cx + dx, z = cz + dz;
      const d = Math.hypot(x + 0.5 - at.x, z + 0.5 - at.z);
      if (d >= bestD || Math.hypot(dx, dz) > radius + 0.01) continue;
      if (skip && skip(x, z)) continue;
      const y = floorAt(world, x, at.y, z);
      if (y === null) continue;
      bestD = d;
      best = { x: x + 0.5, y, z: z + 0.5 };
    }
  }
  return best;
}

export interface Found {
  /** Block centers from the start block to the last block reached. */
  path: Vec3[];
  /** False when the search stopped short of the goal and `path` leads to the closest block it found. */
  complete: boolean;
}

// One number for a block. Chunks are 64 high, and a world is 65536 blocks wide at most.
const keyOf = (x: number, y: number, z: number): number => ((x + 32768) * 65536 + (z + 32768)) * 64 + y;

const octile = (dx: number, dz: number): number => {
  const ax = Math.abs(dx), az = Math.abs(dz);
  return ax > az ? ax + (DIAGONAL - 1) * az : az + (DIAGONAL - 1) * ax;
};

/**
 * Searches for a route. Returns null when there is nowhere to stand at `from`. Otherwise the route is
 * complete, or it leads to the block closest to the goal that the search reached within `limit` blocks.
 */
export function search(world: World, from: Vec3, to: Vec3, limit = DEFAULT_LIMIT): Found | null {
  const sx = Math.floor(from.x), sz = Math.floor(from.z);
  const sy = floorAt(world, sx, from.y, sz);
  if (sy === null) return null;
  const gx = Math.floor(to.x), gz = Math.floor(to.z);
  const goalFloor = floorAt(world, gx, to.y, gz);
  const gy = goalFloor ?? Math.floor(to.y + 0.01);

  // Nodes live in flat arrays. The open list is a binary heap of node numbers ordered by `f`.
  const xs: number[] = [], ys: number[] = [], zs: number[] = [], g: number[] = [], f: number[] = [], parent: number[] = [];
  const closed: boolean[] = [];
  const index = new Map<number, number>();
  const heap: number[] = [];

  const h = (x: number, y: number, z: number): number => (octile(gx - x, gz - z) + CLIMB * Math.abs(gy - y)) * 1.001;

  const push = (n: number): void => {
    let i = heap.length;
    heap.push(n);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (f[heap[up]] <= f[n]) break;
      heap[i] = heap[up];
      i = up;
    }
    heap[i] = n;
  };
  const pop = (): number => {
    const top = heap[0], last = heap.pop()!;
    const size = heap.length;
    if (size > 0) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= size) break;
        if (child + 1 < size && f[heap[child + 1]] < f[heap[child]]) child++;
        if (f[heap[child]] >= f[last]) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    return top;
  };

  const visit = (x: number, y: number, z: number, cost: number, from: number): void => {
    const key = keyOf(x, y, z);
    let n = index.get(key);
    if (n === undefined) {
      n = xs.length;
      index.set(key, n);
      xs.push(x); ys.push(y); zs.push(z);
      g.push(cost); f.push(cost + h(x, y, z)); parent.push(from); closed.push(false);
      push(n);
    } else if (!closed[n] && cost < g[n] - 1e-9) {
      g[n] = cost;
      f[n] = cost + h(x, y, z);
      parent[n] = from;
      push(n); // the stale copy further down the heap is skipped when it comes up
    }
  };

  visit(sx, sy, sz, 0, -1);
  let best = 0, bestH = h(sx, sy, sz), goal = -1, expanded = 0;

  while (heap.length > 0) {
    const n = pop();
    if (closed[n]) continue;
    closed[n] = true;
    const x = xs[n], y = ys[n], z = zs[n];
    if (goalFloor !== null && x === gx && z === gz && y === gy) { goal = n; break; }
    const hn = h(x, y, z);
    if (hn < bestH) { bestH = hn; best = n; }
    if (++expanded > limit) break;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const nx = x + dx, nz = z + dz;
        if (dx !== 0 && dz !== 0) {
          // A diagonal step is level, and both blocks beside it must be free, so no corner is cut.
          if (canStand(world, nx, y, nz) && canStand(world, nx, y, z) && canStand(world, x, y, nz)) visit(nx, y, nz, g[n] + DIAGONAL, n);
        } else if (canStand(world, nx, y, nz)) {
          visit(nx, y, nz, g[n] + 1, n);
        } else if (canStand(world, nx, y + 1, nz)) {
          // Up one block: the head needs room above where it stands now.
          if (!solid(world, x, y + 2, z)) visit(nx, y + 1, nz, g[n] + 1 + CLIMB, n);
        } else if (canStand(world, nx, y - 1, nz)) {
          // Down one block: the head needs room above the lower block as it walks off the edge.
          if (!solid(world, nx, y + 1, nz)) visit(nx, y - 1, nz, g[n] + 1 + CLIMB, n);
        }
      }
    }
  }

  const path: Vec3[] = [];
  for (let n = goal >= 0 ? goal : best; n >= 0; n = parent[n]) path.push({ x: xs[n] + 0.5, y: ys[n], z: zs[n] + 0.5 });
  path.reverse();
  return { path, complete: goal >= 0 };
}

/** A walkable route of block centers from one point to another, or null when there is none within `limit` blocks. */
export function findPath(world: World, from: Vec3, to: Vec3, limit = DEFAULT_LIMIT): Vec3[] | null {
  const found = search(world, from, to, limit);
  return found && found.complete ? found.path : null;
}
