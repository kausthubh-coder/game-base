// A small stage for tests: a stone floor in the air, the five systems of this folder's family, and
// fakes for the region and the time. Only tests import it.
import { blockId } from '../../content/blocks.ts';
import { World, type RayHit } from '../../features/world/world.sim.ts';
import type { EventName, GameEvents, RegionApi, Stack, TimeApi, UseContext } from '../api.sim.ts';
import { install as installInteract } from '../interact/index.sim.ts';
import { install as installInventory } from '../inventory/index.sim.ts';
import { install as installItems } from '../items/index.sim.ts';
import { createKernel, type GameSave, type Kernel } from '../kernel.sim.ts';
import { install as installPlaceables } from '../placeables/index.sim.ts';
import { install as installActions } from './index.sim.ts';

export interface Stage {
  kernel: Kernel;
  world: World;
  /** The height of the player's feet: the cells at this y stand on the floor. */
  ground: number;
  /** Every event sent so far, in order. */
  heard: { name: EventName; data: GameEvents[EventName] }[];
  /** The toasts sent so far. */
  toasts(): string[];
  /** The fake time system: set `canSleep`, read `slept`. */
  time: { canSleep: boolean; slept: number };
  /** A pointer hit on a block, on the face that looks along (nx, ny, nz). The top face by default. */
  hit(x: number, y: number, z: number, nx?: number, ny?: number, nz?: number): RayHit;
  context(button: UseContext['button'], hit: RayHit | null, held?: Stack | null): UseContext;
  /** Steps the kernel for this many seconds. */
  wait(seconds: number): void;
}

/** The fake region protects every block at x of this or more. */
export const TOWN_X = 10;

/** Builds the stage. With `save`, it loads that save into the new game. */
export function makeStage(seed = 1, save?: GameSave): Stage {
  const world = new World(seed);
  world.load(0, 0);
  let top = 0;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) top = Math.max(top, world.heightAt(x, z));
  const floor = top + 2, ground = floor + 1;
  if (ground + 6 > 63) throw new Error('the test chunk is too tall for a stage');
  const stone = blockId('stone');
  for (let x = 1; x < 15; x++) for (let z = 1; z < 15; z++) world.setBlock(x, floor, z, stone);

  const kernel = createKernel(world, seed);
  installItems(kernel);
  installInventory(kernel);
  installInteract(kernel);
  installActions(kernel);
  installPlaceables(kernel);
  const time = { canSleep: false, slept: 0 };
  const region: RegionApi = {
    spawn: () => ({ x: 5.5, y: ground, z: 5.5 }),
    places: () => [],
    place: (name) => ({ name, at: { x: 5.5, y: ground, z: 5.5 }, label: '' }),
    grant: () => ({ x: 0, z: 0, width: TOWN_X, depth: 16 }),
    isProtected: (x) => x >= TOWN_X,
  };
  const clock: TimeApi = {
    dayLength: 720,
    canSleep: () => time.canSleep,
    sleep: () => void time.slept++,
    setWeather: () => {},
    setTimeOfDay: () => {},
  };
  kernel.add('region', region, {});
  kernel.add('time', clock, {});

  const game = kernel.game;
  Object.assign(game.player.pos, { x: 5.5, y: ground, z: 5.5 });
  if (save) kernel.load(save);

  const heard: Stage['heard'] = [];
  game.events.onAny((name, data) => heard.push({ name, data }));

  return {
    kernel, world, ground, heard, time,
    toasts: () => heard.filter((e) => e.name === 'toast').map((e) => (e.data as GameEvents['toast']).text),
    hit: (x, y, z, nx = 0, ny = 1, nz = 0) => ({ x, y, z, nx, ny, nz, id: world.getBlock(x, y, z), distance: 1 }),
    context: (button, hit, held = game.systems.inventory.held()) => ({ button, hit, held }),
    wait(seconds) {
      for (let i = 0; i < Math.round(seconds * 20); i++) kernel.step();
    },
  };
}
