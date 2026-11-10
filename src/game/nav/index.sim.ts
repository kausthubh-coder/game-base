// The nav system: paths for anything that walks, and a cache of the routes between the region's named places.

import type { Vec3 } from '../../engine/types.ts';
import type { Game, NavApi, SimSystem } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import { DEFAULT_LIMIT, canStand, findPath, nearestStand, search } from './nav.sim.ts';

/** A route that was not found is tried again after this many seconds, since land may have loaded since. */
const RETRY_AFTER = 20;

interface Route {
  path: Vec3[] | null;
  /** When it was worked out, in seconds of this system's own time. */
  at: number;
  /** The box of blocks the route passes through, grown by one block. A change inside it drops the route. */
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
}

export interface Nav {
  api: NavApi;
  system: SimSystem;
  /** How many routes between named places are held now. For tests. */
  cached(): number;
}

export function createNav(game: Game): Nav {
  const world = game.world;
  const routes = new Map<string, Route>();
  let time = 0;

  const remember = (key: string, path: Vec3[] | null): void => {
    const route: Route = { path, at: time, minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    if (path) {
      route.minX = route.minY = route.minZ = Infinity;
      route.maxX = route.maxY = route.maxZ = -Infinity;
      for (const p of path) {
        route.minX = Math.min(route.minX, p.x - 1.5); route.maxX = Math.max(route.maxX, p.x + 1.5);
        route.minY = Math.min(route.minY, p.y - 2); route.maxY = Math.max(route.maxY, p.y + 3);
        route.minZ = Math.min(route.minZ, p.z - 1.5); route.maxZ = Math.max(route.maxZ, p.z + 1.5);
      }
    }
    routes.set(key, route);
  };

  // A block that changes on a route may close it, and one that changes anywhere may open a way that
  // was shut. So a change drops the routes around it and every route that was not found.
  const changed = (b: { x: number; y: number; z: number }): void => {
    for (const [key, r] of routes) {
      if (!r.path || (b.x + 0.5 >= r.minX && b.x + 0.5 <= r.maxX && b.y >= r.minY && b.y <= r.maxY && b.z + 0.5 >= r.minZ && b.z + 0.5 <= r.maxZ)) routes.delete(key);
    }
  };
  game.events.on('block.placed', changed);
  game.events.on('block.broken', changed);

  const api: NavApi = {
    path: (from, to, limit = DEFAULT_LIMIT) => findPath(world, from, to, limit),
    standable: (x, y, z) => canStand(world, Math.floor(x), Math.floor(y), Math.floor(z)),
    toward(from, to, limit = DEFAULT_LIMIT) {
      const found = search(world, from, to, limit);
      return found ? found.path : null;
    },
    route(from, to) {
      const key = from + '>' + to;
      const held = routes.get(key);
      if (held && (held.path || time - held.at < RETRY_AFTER)) return held.path;
      const region = game.systems.region;
      const path = findPath(world, region.place(from).at, region.place(to).at);
      remember(key, path);
      // The way back is the same blocks in the other order: every step is as walkable one way as the other.
      if (path) remember(to + '>' + from, path.map((p) => ({ ...p })).reverse());
      return path;
    },
    near: (at, radius, skip) => nearestStand(world, at, radius, skip),
  };

  return {
    api,
    system: { step(dt) { time += dt; } },
    cached: () => routes.size,
  };
}

export function install(kernel: Kernel): void {
  const nav = createNav(kernel.game);
  kernel.add('nav', nav.api, nav.system);
}
