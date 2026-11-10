// The play harness: the real game without a picture. It builds a real World on the game's seed, a
// kernel, and every system in the order of src/game/systems.ts, and gives a test the verbs of the debug
// door (docs/play/act1.md): advance, walk, teleport, use an item on a block, hold the button on a block,
// interact, talk through. Nothing here is a fake, and nothing here writes a flag or gives an item.
//
// What stands in for the shell:
//   - The land. The shell keeps only the chunks around the player. So does this: 3 chunks each way
//     are made when the player's chunk changes (the shell's LOAD_REACH), and a chunk further than 7 is
//     dropped (the view's reach at low quality). A system that reads blocks beyond that gets air, as in the game.
//   - The body. The player is moved along a nav path at walking speed, 4.4 blocks a second, or 2.0 when
//     `soft` is asked (Shift). The hero's own body is not stepped.
//   - The panels. Crafting is `crafting.make`, which is what the bag panel calls. Something listens to
//     `placeables.onUse`, as the panels view does, so "E: Craft" shows at a workbench as it does in the game.

import { install as installTrees } from '../trees/index.sim.ts';
import type { Vec3 } from '../../engine/types.ts';
import { World, type RayHit, type WorldSave } from '../../features/world/world.sim.ts';
import { install as installActions } from '../actions/index.sim.ts';
import { install as installAlmanac } from '../almanac/index.sim.ts';
import type { EventName, Game, GameEvents, ItemId, Systems, UseContext } from '../api.sim.ts';
import { install as installCrafting } from '../crafting/index.sim.ts';
import { install as installCreatures } from '../creatures/index.sim.ts';
import { install as installCrops } from '../crops/index.sim.ts';
import { install as installInteract } from '../interact/index.sim.ts';
import { install as installInventory } from '../inventory/index.sim.ts';
import { install as installItems } from '../items/index.sim.ts';
import { STEP, createKernel, type GameSave, type Kernel } from '../kernel.sim.ts';
import { facingOf } from '../move.sim.ts';
import { install as installNav } from '../nav/index.sim.ts';
import { walkAlong, type Walker } from '../nav/walk.sim.ts';
import { install as installPeople } from '../people/index.sim.ts';
import { install as installPets } from '../pets/index.sim.ts';
import { install as installPlaceables } from '../placeables/index.sim.ts';
import { install as installQuests } from '../quests/index.sim.ts';
import { install as installRegion } from '../region/index.sim.ts';
import { install as installStory } from '../story/index.sim.ts';
import { install as installTalk } from '../talk/index.sim.ts';
import { install as installTime } from '../time/index.sim.ts';

/** The seeds the shell uses: the world's, and the kernel's for `game.random()`. */
export const WORLD_SEED = 1;
export const KERNEL_SEED = 7;

/** Blocks a second: the hero's walk, and the walk with Shift held. */
export const WALK_SPEED = 4.4;
export const SOFT_SPEED = 2.0;

/** Chunks made around the player each way, as the shell does on a start, a teleport and in `advance`. */
const LOAD_REACH = 3;
/** A chunk further than this from the player's is dropped: the view's reach at low quality, plus its margin. */
const KEEP_REACH = 7;

/** The systems in the order they are installed and stepped. A test checks it against SYSTEM_ORDER in src/game/systems.ts. */
export const INSTALLS: readonly (readonly [name: string, install: (kernel: Kernel) => void])[] = [
  ['items', installItems],
  ['inventory', installInventory],
  ['region', installRegion],
  ['trees', installTrees],
  ['time', installTime],
  ['interact', installInteract],
  ['actions', installActions],
  ['placeables', installPlaceables],
  ['crafting', installCrafting],
  ['crops', installCrops],
  ['nav', installNav],
  ['almanac', installAlmanac],
  ['creatures', installCreatures],
  ['pets', installPets],
  ['people', installPeople],
  ['talk', installTalk],
  ['quests', installQuests],
  ['story', installStory],
];

/** What the shell writes to its save file, less the end card's two counts. */
export interface PlaySave {
  world: WorldSave;
  game: GameSave;
  /** Kernel steps played before the save, so a count goes on across a load. */
  steps: number;
}

export interface Heard {
  name: EventName;
  data: GameEvents[EventName];
  /** `clock.seconds` when it was sent. */
  at: number;
}

export interface WalkOptions {
  /** Walk at 2.0 blocks a second, as with Shift held. */
  soft?: boolean;
  /** Stop this close to the goal, in blocks along the ground. 0.6 when not given. */
  within?: number;
  /** Give up after this many seconds of game time. 600 when not given. */
  seconds?: number;
  /** Points to pass on the way, in order, as a player follows a path they can see. */
  via?: readonly { x: number; z: number }[];
  /** Stop walking as soon as this holds. */
  until?: () => boolean;
}

export interface Play {
  readonly world: World;
  readonly kernel: Kernel;
  readonly game: Game;
  readonly sys: Systems;
  /** Kernel steps since the new game began, across saves and loads. */
  readonly steps: number;
  /** Every event but footsteps, bag changes and flag changes, in order. */
  readonly heard: Heard[];
  /** The texts of the toasts and hints so far. */
  readonly said: string[];

  /** Steps the kernel 20 times a second for this many seconds. */
  advance(seconds: number): void;
  /** Advances until `done()` holds or `seconds` have passed. Returns whether it holds. */
  until(done: () => boolean, seconds: number): boolean;
  /** Puts the player at a named place or on the ground at x, z, at once. The land is made there. */
  teleport(to: string | { x: number; z: number }): Vec3;
  /** Walks to a named place or a point along nav paths. True when it got within `within` of it. */
  walkTo(to: string | Vec3, options?: WalkOptions): boolean;
  /** Puts an item of the bag in the hand: its quick slot is selected, and it is moved to one first when it lies deeper. */
  take(item: ItemId): boolean;
  /** One click of the secondary button with what is held, on a block. `face` is the side clicked, the top when not given. */
  use(x: number, y: number, z: number, face?: readonly [number, number, number]): boolean;
  /** One click of the primary button on a block: a harvest, or the start of a break. */
  hit(x: number, y: number, z: number, face?: readonly [number, number, number]): boolean;
  /** Clicks the primary button on a block and holds it until the block breaks, at most five seconds. True when it broke. */
  dig(x: number, y: number, z: number, face?: readonly [number, number, number]): boolean;
  /** The words after "E:" of the nearest prompt, or null. */
  prompt(): string | null;
  /** Runs the nearest prompt, as the E key does. Returns its words, or null when there was none. */
  interact(): string | null;
  /** Clicks through the open conversation, taking the first choice, or the choice of this index. Returns the lines it passed. */
  talkThrough(choice?: number): string[];
  /** Makes a recipe, as a click on its row in the bag or the workbench panel does. */
  make(recipe: string): boolean;
  /** How many of an item the bag holds. */
  count(item: ItemId): number;
  /** Runs `fn` after every kernel step, as a view's `onSimStep` does. Returns a function that stops it. */
  onStep(fn: () => void): () => void;
  /** The game as the shell would write it to its save file, as plain JSON. */
  save(): PlaySave;
}

function build(save: PlaySave | null): Play {
  const world = new World(WORLD_SEED);
  // As the shell's continueGame does: the world first, so a station's cells match the blocks around it.
  if (save) world.restore(save.world);
  const kernel = createKernel(world, KERNEL_SEED);
  const game = kernel.game;
  for (const [, install] of INSTALLS) install(kernel);
  const sys = game.systems;
  const player = game.player;

  const heard: Heard[] = [];
  const said: string[] = [];
  game.events.onAny((name, data) => {
    if (name === 'footstep' || name === 'inventory.changed' || name === 'flag.changed') return;
    heard.push({ name, data, at: game.clock.seconds });
    if (name === 'toast' || name === 'hint') said.push((data as GameEvents['toast']).text);
  });
  // The panels view listens here, and that is what makes a workbench show its prompt.
  sys.placeables.onUse?.(() => undefined);

  // The hero is an actor like everyone else, as in the shell.
  game.actors.set('player', { id: 'player', sprite: 'hero', pos: player.pos, facing: 0, anim: 'idle', visible: true });

  let steps = save?.steps ?? 0;
  let chunkX = NaN, chunkZ = NaN;
  const stepListeners: (() => void)[] = [];

  /** Keeps the land around the player in memory and lets go of what is far, as the shell and the view do. */
  function stream(): void {
    const cx = Math.floor(player.pos.x) >> 4, cz = Math.floor(player.pos.z) >> 4;
    if (cx === chunkX && cz === chunkZ) return;
    chunkX = cx;
    chunkZ = cz;
    for (let dx = -LOAD_REACH; dx <= LOAD_REACH; dx++) for (let dz = -LOAD_REACH; dz <= LOAD_REACH; dz++) world.load(cx + dx, cz + dz);
    for (const chunk of [...world.chunks.values()]) {
      const dx = chunk.cx - cx, dz = chunk.cz - cz;
      if (dx * dx + dz * dz > KEEP_REACH * KEEP_REACH) world.unload(chunk.cx, chunk.cz);
    }
    world.dirty.length = 0;
  }

  function stepOnce(): void {
    stream();
    kernel.step();
    steps++;
    for (const listener of stepListeners) listener();
  }

  function stand(x: number, z: number): Vec3 {
    player.pos.x = x;
    player.pos.z = z;
    stream();
    let y = world.heightAt(x, z);
    // Never inside a block: under a roof the ground is lower than the highest block of the column.
    const near = sys.nav.near({ x, y, z }, 0.01) ?? sys.nav.near({ x, y: player.pos.y, z }, 0.01);
    if (near) y = near.y;
    player.pos.y = y;
    player.onGround = true;
    return { x, y, z };
  }

  function context(button: 'primary' | 'secondary', x: number, y: number, z: number, face: readonly [number, number, number]): UseContext {
    const hit: RayHit = { x, y, z, nx: face[0], ny: face[1], nz: face[2], id: world.getBlock(x, y, z), distance: 0 };
    return { hit, held: sys.inventory.held(), button };
  }

  const TOP: readonly [number, number, number] = [0, 1, 0];

  function placeOf(to: string | Vec3): Vec3 {
    return typeof to === 'string' ? sys.region.place(to).at : to;
  }

  /** Walks toward one point until it is within `within`, `until` holds or the time is up. */
  function walkLeg(goal: { x: number; y?: number; z: number }, speed: number, within: number, deadline: number, until?: () => boolean): boolean {
    const walker: Walker = { path: null, next: 0 };
    const flat = (): number => Math.hypot(goal.x - player.pos.x, goal.z - player.pos.z);
    let stuck = 0, replan = 0;
    while (game.clock.seconds < deadline) {
      if (flat() <= within || until?.()) return true;
      if (player.busy) {
        // A conversation or a panel holds the player. Nobody walks out of one.
        return false;
      }
      if (!walker.path || walker.next >= walker.path.length || replan <= 0) {
        const to = { x: goal.x, y: goal.y ?? world.heightAt(goal.x, goal.z), z: goal.z };
        walker.path = sys.nav.toward(player.pos, to);
        walker.next = walker.path && walker.path.length > 1 ? 1 : 0;
        replan = 4;
        if (!walker.path || walker.path.length < 2) {
          if (++stuck > 3) return false;
          stepOnce();
          continue;
        }
      }
      const before = { x: player.pos.x, z: player.pos.z };
      const facing = walkAlong(world, player.pos, walker, speed, STEP);
      if (facing !== null) player.facing = facing;
      const moved = Math.hypot(player.pos.x - before.x, player.pos.z - before.z);
      stuck = moved < 1e-4 ? stuck + 1 : 0;
      if (stuck > 40) return false;
      if (facing === null) walker.path = null;
      replan -= STEP;
      stepOnce();
    }
    return flat() <= within;
  }

  const play: Play = {
    world, kernel, game, sys, heard, said,
    get steps() { return steps; },

    advance(seconds) {
      const count = Math.max(0, Math.round(seconds / STEP));
      for (let i = 0; i < count; i++) stepOnce();
    },

    until(done, seconds) {
      const count = Math.max(0, Math.round(seconds / STEP));
      for (let i = 0; i < count && !done(); i++) stepOnce();
      return done();
    },

    teleport(to) {
      const at = typeof to === 'string' ? (to === 'spawn' ? sys.region.spawn() : sys.region.place(to).at) : to;
      return stand(at.x, at.z);
    },

    walkTo(to, options = {}) {
      const goal = placeOf(to);
      const speed = options.soft ? SOFT_SPEED : WALK_SPEED;
      const deadline = game.clock.seconds + (options.seconds ?? 600);
      for (const point of options.via ?? []) {
        if (options.until?.()) return true;
        if (!walkLeg({ x: point.x + 0.5, z: point.z + 0.5 }, speed, 2.5, deadline, options.until)) return false;
      }
      return walkLeg(goal, speed, options.within ?? 0.6, deadline, options.until);
    },

    take(item) {
      const bag = sys.inventory;
      let slot = bag.slots.findIndex((s) => s?.id === item);
      if (slot < 0) return false;
      if (slot >= 9) {
        // Deeper in the bag: the bag panel drags it to a quick slot. An empty one first, else the last.
        const free = bag.slots.findIndex((s, i) => i < 9 && s === null);
        const to = free >= 0 ? free : 8;
        bag.move(slot, to);
        slot = to;
      }
      bag.selected = slot;
      return bag.held()?.id === item;
    },

    use(x, y, z, face = TOP) {
      return sys.actions.use(context('secondary', x, y, z, face));
    },

    hit(x, y, z, face = TOP) {
      return sys.actions.use(context('primary', x, y, z, face));
    },

    dig(x, y, z, face = TOP) {
      // The debug door's click: use() once, then hold() after every step while something is breaking.
      const ctx = context('primary', x, y, z, face);
      sys.actions.use(ctx);
      let broke = false;
      for (let i = 0; !broke && i < 100 && sys.actions.breaking(); i++) {
        stepOnce();
        broke = sys.actions.hold(ctx, STEP);
      }
      return broke;
    },

    prompt: () => sys.interact.nearest()?.prompt() ?? null,

    interact() {
      const words = sys.interact.nearest()?.prompt() ?? null;
      return sys.interact.act() ? words : null;
    },

    talkThrough(choice = 0) {
      const talk = sys.talk;
      const lines: string[] = [];
      while (talk.active && lines.length < 200) {
        const line = talk.current();
        if (line) lines.push(line.text);
        if (line && line.choices.length > 0) talk.choose(Math.min(choice, line.choices.length - 1));
        else talk.advance();
      }
      return lines;
    },

    make: (recipe) => sys.crafting.make(recipe),
    count: (item) => sys.inventory.count(item),

    onStep(fn) {
      stepListeners.push(fn);
      return () => void stepListeners.splice(stepListeners.indexOf(fn), 1);
    },

    save() {
      return JSON.parse(JSON.stringify({ world: world.save(), game: kernel.save(), steps })) as PlaySave;
    },
  };

  if (save) {
    // As the shell's continueGame does: the land around the saved player, then the systems.
    player.pos.x = save.game.player.x;
    player.pos.z = save.game.player.z;
    stream();
    kernel.load(save.game);
  } else {
    const spawn = sys.region.spawn();
    player.pos.x = spawn.x; player.pos.y = spawn.y; player.pos.z = spawn.z;
    player.facing = sys.region.spawnFacing?.() ?? Math.PI;
    stream();
  }
  return play;
}

/** A new game at the region's spawn point, at dawn of day 1. */
export function newPlay(): Play {
  return build(null);
}

/** A saved game in a fresh world and a fresh kernel, as Continue does after the page reloads. */
export function loadPlay(save: PlaySave): Play {
  return build(save);
}

/** The direction from one point to another, as a facing. */
export const facingTo = (from: { x: number; z: number }, to: { x: number; z: number }): number => facingOf(to.x - from.x, to.z - from.z);
