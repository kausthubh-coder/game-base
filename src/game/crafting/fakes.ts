// Small stand-ins for the systems that crafting, crops and time call, for their tests only.
import { AIR, blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import { World, type RayHit } from '../../features/world/world.sim.ts';
import type { ActionsApi, InventoryApi, ItemDef, ItemId, ItemsApi, PlaceablesApi, Stack, ToolKind, UseContext } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';

/** The height of the test floor. Soil blocks in tests sit at this y. */
export const FLOOR = 40;

/** One chunk with a flat grass floor from (0, 0) to (15, 15) at FLOOR and open sky over it. */
export function flatStage(): World {
  const world = new World(1);
  world.load(0, 0);
  const grass = blockId('grass');
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      for (let y = 63; y > FLOOR; y--) world.setBlock(x, y, z, AIR);
      world.setBlock(x, FLOOR, z, grass);
    }
  }
  return world;
}

export interface FakeBag extends InventoryApi {
  /** Puts an item in the hand. */
  hold(id: ItemId | null): void;
}

/** A bag that counts items. `room` is how many items it holds in all. */
export function fakeBag(room = Infinity): FakeBag {
  const counts = new Map<ItemId, number>();
  let holding: ItemId | null = null;
  const total = (): number => [...counts.values()].reduce((sum, n) => sum + n, 0);
  return {
    slots: [],
    selected: 0,
    hold(id) {
      holding = id;
    },
    held(): Stack | null {
      const count = holding ? counts.get(holding) ?? 0 : 0;
      return holding && count > 0 ? { id: holding, count } : null;
    },
    add(id, count) {
      const fit = Math.max(0, Math.min(count, room - total()));
      if (fit > 0) counts.set(id, (counts.get(id) ?? 0) + fit);
      return count - fit;
    },
    remove(id, count) {
      const have = counts.get(id) ?? 0;
      if (have < count) return false;
      counts.set(id, have - count);
      return true;
    },
    count: (id) => counts.get(id) ?? 0,
    move() {},
  };
}

export interface FakePlaceables extends PlaceablesApi {
  /** Stands a station of this name at a point. */
  stand(station: string, at: Vec3): void;
}

export function fakePlaceables(): FakePlaceables {
  const standing: { station: string; at: Vec3 }[] = [];
  return {
    stand(station, at) {
      standing.push({ station, at });
    },
    // Each station that was stood is a placed thing one block in size, so a system that asks where the beds are gets an answer.
    defs: () => [...new Set(standing.map((s) => s.station))].map((station) => ({ kind: station, name: station, prop: station, size: [1, 1, 1], prompt: null, station })),
    all: () => standing.map((s, i) => ({ id: `${s.station}:${i + 1}`, kind: s.station, x: Math.floor(s.at.x), y: Math.floor(s.at.y), z: Math.floor(s.at.z), quarterTurns: 0 })),
    place: () => null,
    remove() {},
    at: () => null,
    near: (station, at, radius) =>
      standing.some((s) => s.station === station && Math.hypot(s.at.x - at.x, s.at.y - at.y, s.at.z - at.z) <= radius),
  };
}

export function fakeItems(): ItemsApi {
  const tools: Record<string, ToolKind> = { hoe: 'hoe', watering_can: 'can', axe: 'axe' };
  const def = (id: ItemId): ItemDef => ({ id, name: id, icon: id, stack: 99, description: '', tool: tools[id] ? { kind: tools[id], tier: 1 } : undefined });
  return { get: def, all: () => [] };
}

/** Runs the handlers in order, like the real one, and does nothing itself. */
export function fakeActions(): ActionsApi {
  const handlers: ((context: UseContext) => boolean)[] = [];
  return {
    use: (context) => handlers.some((handler) => handler(context)),
    addHandler(handler) {
      handlers.push(handler);
    },
    hold: () => false,
    breaking: () => null,
    reach: 5,
  };
}

export interface Fakes {
  bag: FakeBag;
  placeables: FakePlaceables;
  actions: ActionsApi;
}

/** Installs the bag, the item table, the stations and the click handlers on a kernel. */
export function installFakes(kernel: Kernel, room = Infinity): Fakes {
  const fakes = { bag: fakeBag(room), placeables: fakePlaceables(), actions: fakeActions() };
  kernel.add('items', fakeItems(), {});
  kernel.add('inventory', fakes.bag, {});
  kernel.add('placeables', fakes.placeables, {});
  kernel.add('actions', fakes.actions, {});
  return fakes;
}

/** A click on the top face of a block. */
export function topOf(world: World, x: number, y: number, z: number): RayHit {
  return { x, y, z, nx: 0, ny: 1, nz: 0, id: world.getBlock(x, y, z), distance: 2 };
}
