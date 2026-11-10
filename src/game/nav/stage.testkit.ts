// A flat land for the nav, people and pets tests: a few chunks with one layer of ground and nothing else,
// a kernel, and small fakes for the systems these three call. Tests only. The game never imports it.

import { blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import { CELLS, CHUNK, cellIndex, computeHeights } from '../../features/world/chunk.sim.ts';
import { initLight } from '../../features/world/light.sim.ts';
import { World } from '../../features/world/world.sim.ts';
import type {
  ActionsApi, EventName, GameEvents, Interactable, InteractApi, InventoryApi, ItemsApi, RegionApi, TalkApi, UseContext,
} from '../api.sim.ts';
import { STEP, createKernel, type Kernel } from '../kernel.sim.ts';

/** The ground is the layer of blocks at this height. Feet on it are at FEET. */
export const FLOOR = 20;
export const FEET = FLOOR + 1;

/** A world of `chunks` by `chunks` chunks, flat, starting at block 0, 0. Outside it there is nothing to stand on. */
export function flatWorld(chunks = 2, ground = 'grass'): World {
  const world = new World(1);
  const id = blockId(ground);
  for (let cx = 0; cx < chunks; cx++) {
    for (let cz = 0; cz < chunks; cz++) {
      const blocks = new Uint8Array(CELLS), light = new Uint8Array(CELLS), heights = new Uint8Array(CHUNK * CHUNK);
      for (let lx = 0; lx < CHUNK; lx++) for (let lz = 0; lz < CHUNK; lz++) blocks[cellIndex(lx, FLOOR, lz)] = id;
      initLight(blocks, light);
      computeHeights(blocks, heights);
      world.adopt(cx, cz, { blocks, light, heights });
    }
  }
  return world;
}

/** A wall on the ground, `tall` blocks high, over every block from (x0, z0) to (x1, z1). */
export function wall(world: World, x0: number, z0: number, x1: number, z1: number, tall = 2, block = 'stone'): void {
  const id = blockId(block);
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = 0; y < tall; y++) world.setBlock(x, FEET + y, z, id);
}

/** The middle of a block of ground, at foot height. */
export const feet = (x: number, z: number, up = 0): Vec3 => ({ x: x + 0.5, y: FEET + up, z: z + 0.5 });

export interface Stage {
  world: World;
  kernel: Kernel;
  /** The fake region's places. Add to it at any time. */
  places: Map<string, Vec3>;
  /** What the fake bag holds, and the item in the player's hand. */
  bag: Map<string, number>;
  hand: { id: string | null };
  /** Everyone the fake talk system was asked to talk to, in order. */
  talked: string[];
  /** What was added to the fake prompt registry, by id. */
  prompts: Map<string, Interactable>;
  /** Every event sent since the stage was made, in order. */
  heard: { name: EventName; data: GameEvents[EventName] }[];
  /** Steps the game for this many seconds. `each` runs before every step. */
  run(seconds: number, each?: () => void): void;
  count(name: EventName): number;
  toasts(): string[];
  /** Puts the player's feet on the ground at this block, without it counting as a run. */
  player(x: number, z: number): void;
  /** Moves the player in a straight line at `speed` blocks a second for `seconds`, stepping the game. */
  walkPlayer(dx: number, dz: number, speed: number, seconds: number, each?: () => void): void;
  /** A click with what is in the player's hand. */
  click(button: UseContext['button']): boolean;
}

export interface StageOptions {
  chunks?: number;
  ground?: string;
  seed?: number;
  /** Named places as block columns: `{ home: [4, 4] }`. */
  places?: Record<string, [x: number, z: number]>;
  /** The systems under test, installed in this order after the fakes. */
  install: ((kernel: Kernel) => void)[];
}

export function makeStage(options: StageOptions): Stage {
  const world = flatWorld(options.chunks ?? 2, options.ground ?? 'grass');
  const kernel = createKernel(world, options.seed ?? 7);
  const game = kernel.game;

  const places = new Map<string, Vec3>();
  for (const [name, [x, z]] of Object.entries(options.places ?? {})) places.set(name, feet(x, z));
  const region = {
    spawn: () => feet(1, 1),
    places: () => [...places].map(([name, at]) => ({ name, at, label: '' })),
    place(name: string) {
      const at = places.get(name);
      if (!at) throw new Error(`no place called ${name}`);
      return { name, at, label: '' };
    },
    grant: () => ({ x: 0, z: 0, width: 0, depth: 0 }),
    isProtected: () => false,
  } satisfies RegionApi;
  kernel.add('region', region, {});

  const prompts = new Map<string, Interactable>();
  const interact = {
    add: (target: Interactable) => void prompts.set(target.id, target),
    remove: (id: string) => void prompts.delete(id),
    nearest: () => null,
    act: () => false,
  } satisfies InteractApi;
  kernel.add('interact', interact, {});

  const talked: string[] = [];
  const talk = { active: false, talkTo: (npc: string) => void talked.push(npc) } as unknown as TalkApi;
  kernel.add('talk', talk, {});

  const bag = new Map<string, number>();
  const hand: Stage['hand'] = { id: null };
  const held = (): { id: string; count: number } | null => (hand.id && (bag.get(hand.id) ?? 0) > 0 ? { id: hand.id, count: bag.get(hand.id)! } : null);
  const inventory = {
    held,
    // Like the real bag: gaining an item says so, with where it came from.
    add(id: string, count: number, at?: Vec3) {
      bag.set(id, (bag.get(id) ?? 0) + count);
      game.events.emit('item.gained', at ? { id, count, at: { ...at } } : { id, count });
      return 0;
    },
    remove(id: string, count: number) {
      if ((bag.get(id) ?? 0) < count) return false;
      bag.set(id, bag.get(id)! - count);
      return true;
    },
    count: (id: string) => bag.get(id) ?? 0,
  } as unknown as InventoryApi;
  kernel.add('inventory', inventory, {});
  kernel.add('items', { get: (id: string) => ({ id, treat: id === 'berry' }) } as unknown as ItemsApi, {});

  const handlers: ((context: UseContext) => boolean)[] = [];
  const actions = {
    addHandler: (handler: (context: UseContext) => boolean) => void handlers.push(handler),
    use: (context: UseContext) => handlers.some((handler) => handler(context)),
  } as unknown as ActionsApi;
  kernel.add('actions', actions, {});

  for (const install of options.install) install(kernel);

  const heard: Stage['heard'] = [];
  game.events.onAny((name, data) => heard.push({ name, data }));

  const stage: Stage = {
    world, kernel, places, bag, hand, talked, prompts, heard,
    run(seconds, each) {
      for (let i = 0, n = Math.round(seconds / STEP); i < n; i++) {
        each?.();
        kernel.step();
      }
    },
    count: (name) => heard.filter((e) => e.name === name).length,
    toasts: () => heard.filter((e) => e.name === 'toast').map((e) => (e.data as GameEvents['toast']).text),
    player(x, z) {
      Object.assign(game.player.pos, feet(x, z));
    },
    walkPlayer(dx, dz, speed, seconds, each) {
      const length = Math.hypot(dx, dz);
      stage.run(seconds, () => {
        game.player.pos.x += (dx / length) * speed * STEP;
        game.player.pos.z += (dz / length) * speed * STEP;
        each?.();
      });
    },
    click: (button) => actions.use({ hit: null, held: held(), button }),
  };
  stage.player(1, 1);
  return stage;
}
