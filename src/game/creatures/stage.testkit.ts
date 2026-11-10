// A tiny world for the creature tests: one chunk with a stone floor high above the terrain, a kernel,
// the real Almanac and small fakes for the bag and the region. Tests only. The game never imports it.

import { blockId } from '../../content/blocks.ts';
import { World } from '../../features/world/world.sim.ts';
import { install as installAlmanac } from '../almanac/index.sim.ts';
import type { EventName, GameEvents, InventoryApi, RegionApi } from '../api.sim.ts';
import type { CreatureKind } from '../content/creatures.ts';
import { STEP, createKernel, type Kernel } from '../kernel.sim.ts';
import { install as installCreatures } from './index.sim.ts';

/** The floor is the layer of blocks at this height. A creature on it has its feet at FLOOR + 1. */
export const FLOOR = 50;
export const FEET = FLOOR + 1;

export interface Stage {
  world: World;
  kernel: Kernel;
  /** What the fake bag holds. */
  bag: Map<string, number>;
  /** Every event sent since the stage was made, in order. */
  heard: { name: EventName; data: GameEvents[EventName] }[];
  set(x: number, y: number, z: number, block: string): void;
  /** Puts the player's feet on the floor at this column. */
  player(x: number, z: number): void;
  /** Steps the game for this many seconds. `each` runs after every step. */
  run(seconds: number, each?: () => void): void;
  count(name: EventName): number;
}

export interface StageOptions {
  /** `floor` is 16 by 16 blocks of stone. `island` is nothing at all, so a creature cannot leave its block. */
  ground: 'floor' | 'island';
  kinds?: readonly CreatureKind[];
  /** Where the region says every named place is. */
  place?: { x: number; z: number };
  /** False starts the player without the Almanac. */
  book?: boolean;
  seed?: number;
}

export function makeStage(options: StageOptions): Stage {
  const world = new World(options.seed ?? 7);
  world.load(0, 0);
  const stone = blockId('stone');
  if (options.ground === 'floor') {
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.setBlock(x, FLOOR, z, stone);
  }

  const kernel = createKernel(world, options.seed ?? 7);
  const game = kernel.game;
  const bag = new Map<string, number>();
  const inventory = {
    add(id: string, count: number) {
      bag.set(id, (bag.get(id) ?? 0) + count);
      return 0;
    },
    count: (id: string) => bag.get(id) ?? 0,
  } as unknown as InventoryApi;
  kernel.add('inventory', inventory, {});

  const at = { x: options.place?.x ?? 8, y: FEET, z: options.place?.z ?? 8 };
  const region = { place: (name: string) => ({ name, at, label: '' }) } as unknown as RegionApi;
  kernel.add('region', region, {});

  installAlmanac(kernel);
  installCreatures(kernel, options.kinds);
  if (options.book !== false) game.flags.set('has.almanac', true);

  const heard: Stage['heard'] = [];
  game.events.onAny((name, data) => heard.push({ name, data }));

  const stage: Stage = {
    world, kernel, bag, heard,
    set: (x, y, z, block) => void world.setBlock(x, y, z, blockId(block)),
    player(x, z) {
      game.player.pos.x = x;
      game.player.pos.y = FEET;
      game.player.pos.z = z;
    },
    run(seconds, each) {
      const steps = Math.round(seconds / STEP);
      for (let i = 0; i < steps; i++) {
        kernel.step();
        each?.();
      }
    },
    count: (name) => heard.filter((e) => e.name === name).length,
  };
  stage.player(8, 12);
  return stage;
}

/** Leaves over the columns from (x0, z0) to (x1, z1), three blocks above the floor, so the floor under them is in shade. */
export function roof(stage: Stage, x0: number, z0: number, x1: number, z1: number): void {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) stage.set(x, FLOOR + 4, z, 'oak_leaves');
}
