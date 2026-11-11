// Clicking on the world. Other systems add handlers for crops, pets and stations, and those get a click
// first. What is left is the last handler, built in here: the primary button breaks the block under
// the pointer over time, the secondary button places the held block or station on the face that was hit.
import { AIR, BLOCKS } from '../../content/blocks.ts';
import { SOLID } from '../../features/world/chunk.sim.ts';
import type { RayHit } from '../../features/world/world.sim.ts';
import type { ActionsApi, ItemId, Placed, PlaceablesApi, Player, Stack, Systems, ToolKind, UseContext } from '../api.sim.ts';
import { BREAKING, DEFAULT_BREAK, FELLING, PLACEABLE_BREAK_SECONDS, type BreakRule } from '../content/drops.ts';
import { findTree, type Tree, type TreeRules } from './tree.sim.ts';
import { footprint } from '../content/placeables.ts';
import { STEP, type Kernel } from '../kernel.sim.ts';

/** How far the player reaches, in blocks, from the eyes to the nearest point of the block. */
export const REACH = 5;
/** The eyes sit this far above the feet. The body is 1.8 tall and 0.6 wide. */
export const EYE_HEIGHT = 1.6;
const BODY_HALF = 0.3, BODY_TALL = 1.8;

/** The same toast shows at most once in this many seconds. */
const TOAST_GAP = 3;
/** A break that nobody held for this long starts over. */
const FORGET_AFTER = 0.5;
/**
 * Every break takes at least this long, so a click, however quick the block, breaks nothing. Each press of the
 * button starts the meter from nothing, so a few quick clicks do not add up to a break either.
 */
export const HOLD_TO_BREAK = 0.4;

export const TOWN_TOAST = 'This belongs to the town.';
export const BAG_FULL_TOAST = 'Your bag is full.';
export const NO_GROUND_TOAST = 'It needs solid ground under it.';
export const NO_ROOM_TOAST = 'There is no room for it here.';
const TOOL_NAMES: Record<ToolKind, string> = { axe: 'an axe', pickaxe: 'a pickaxe', shovel: 'a shovel', hoe: 'a hoe', can: 'a watering can', hammer: 'a hammer' };

/** The distance from the player's eyes to the nearest point of a box. */
export function reachDistance(player: Player, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number {
  const ex = player.pos.x, ey = player.pos.y + EYE_HEIGHT, ez = player.pos.z;
  const dx = ex < x0 ? x0 - ex : ex > x1 ? ex - x1 : 0;
  const dy = ey < y0 ? y0 - ey : ey > y1 ? ey - y1 : 0;
  const dz = ez < z0 ? z0 - ez : ez > z1 ? ez - z1 : 0;
  return Math.hypot(dx, dy, dz);
}

/** True when a standing body with its feet at (px, py, pz) reaches into the block cell at (x, y, z). */
export function bodyInCell(px: number, py: number, pz: number, x: number, y: number, z: number): boolean {
  return px + BODY_HALF > x && px - BODY_HALF < x + 1 && pz + BODY_HALF > z && pz - BODY_HALF < z + 1 && py + BODY_TALL > y && py < y + 1;
}

/** True when another placed thing stands on this one. Taking this one back would leave that one in the air. */
export function carriesAnother(placeables: PlaceablesApi, placed: Placed): boolean {
  const def = placeables.defs().find((d) => d.kind === placed.kind);
  if (!def) return false;
  const [sx, sy, sz] = footprint(def.size, placed.quarterTurns);
  for (let x = placed.x; x < placed.x + sx; x++) {
    for (let z = placed.z; z < placed.z + sz; z++) if (placeables.at(x, placed.y + sy, z)) return true;
  }
  return false;
}

export function install(kernel: Kernel): void {
  const game = kernel.game;
  const { world, events, player } = game;
  // Another system may be missing in a small test, so the ones this file can do without are read as optional.
  const others = game.systems as Partial<Systems>;

  const rules: BreakRule[] = BLOCKS.map((block) => BREAKING[block.key] ?? DEFAULT_BREAK);
  const handlers: ((context: UseContext) => boolean)[] = [];
  const toasted = new Map<string, number>();
  const meter: { x: number; y: number; z: number; progress: number; tree: Tree['box'] | null } = { x: 0, y: 0, z: 0, progress: 0, tree: null };
  const LOG = BLOCKS.map((block) => block.surface === 'wood' && /_log$/.test(block.key));
  const LEAF = BLOCKS.map((block) => block.surface === 'leaves');
  const treeRules: TreeRules = { isLog: (id) => LOG[id] === true, isLeaf: (id) => LEAF[id] === true, maxLogs: FELLING.maxLogs, leafReach: FELLING.leafReach };
  /** The tree under the last hit, kept while the same block is held, so the search runs once per tree. */
  let felling: { x: number; y: number; z: number; tree: Tree | null } | null = null;
  let active = false;
  /** Seconds since hold() was last called. */
  let idle = 0;
  /** True from a primary click that a handler took until the next primary click, so holding the button does not also dig. */
  let claimed = false;
  let now = 0;
  let selfItems: (ItemId | null)[] | null = null;

  function toast(text: string): void {
    const last = toasted.get(text);
    if (last !== undefined && now - last < TOAST_GAP) return;
    toasted.set(text, now);
    events.emit('toast', { text });
  }

  const inReach = (x: number, y: number, z: number): boolean => reachDistance(player, x, y, z, x + 1, y + 1, z + 1) <= REACH;
  const isProtected = (x: number, y: number, z: number): boolean => others.region?.isProtected(x, y, z) ?? false;

  /** The placed thing the pointer is on: the block that was hit, or the open cell the ray crossed just before it. */
  function placedAt(hit: RayHit): Placed | null {
    const placeables = others.placeables;
    if (!placeables) return null;
    return placeables.at(hit.x, hit.y, hit.z) ?? (hit.nx || hit.ny || hit.nz ? placeables.at(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz) : null);
  }

  /** The item that places a block, for a rule that drops `self`. */
  function itemForBlock(id: number): ItemId | null {
    if (!selfItems) {
      selfItems = BLOCKS.map(() => null);
      for (const item of game.systems.items.all()) {
        if (item.block === undefined) continue;
        if (selfItems[item.block] === null || item.id === BLOCKS[item.block].key) selfItems[item.block] = item.id;
      }
    }
    return selfItems[id] ?? null;
  }

  /** Seconds to break with what is held, or null when it cannot be done. */
  function secondsFor(rule: BreakRule, held: Stack | null): number | null {
    const tool = held ? game.systems.items.get(held.id).tool : undefined;
    return rule.tool && tool && tool.kind === rule.tool.kind ? rule.tool.seconds : rule.hand;
  }

  /** Puts a drop in the bag. Returns false when not all of it fit. */
  function give(id: ItemId, count: number, x: number, y: number, z: number): boolean {
    const left = game.systems.inventory.add(id, count, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (left > 0) toast(BAG_FULL_TOAST);
    return left === 0;
  }

  function breakBlock(x: number, y: number, z: number, id: number): boolean {
    if (!world.setBlock(x, y, z, AIR)) return false;
    events.emit('block.broken', { x, y, z, id, by: 'player' });
    const drops = rules[id].drops;
    if (drops === 'self') {
      const item = itemForBlock(id);
      if (item) give(item, 1, x, y, z);
      return true;
    }
    for (const drop of drops) {
      if (drop.chance < 1 && game.random() >= drop.chance) continue;
      give(drop.item, drop.count, x, y, z);
    }
    return true;
  }

  /** Takes a station back into the bag. It stays where it is when the bag is full. */
  function pickUp(placed: Placed): boolean {
    const item = game.systems.items.all().find((def) => def.placeable === placed.kind);
    if (item && !give(item.id, 1, placed.x, placed.y, placed.z)) return false;
    others.placeables?.remove(placed.id);
    return true;
  }

  function stop(): void {
    active = false;
    meter.progress = 0;
    meter.tree = null;
  }

  /** The tree a log belongs to, or the tree of a leaf when an axe is in hand. Null for anything else. */
  function treeAt(x: number, y: number, z: number, id: number, held: Stack | null): Tree | null {
    const model = others.trees?.at(x,y,z);
    if (model) return { base: model, logs: Math.max(3,Math.round(4 * model.size)), leaves: 20, cells: [], box: model.box };
    const axe = held !== null && game.systems.items.get(held.id).tool?.kind === 'axe';
    if (!LOG[id] && !(axe && LEAF[id])) return null;
    if (!felling || felling.x !== x || felling.y !== y || felling.z !== z || !active) {
      felling = { x, y, z, tree: findTree(world, x, y, z, treeRules) };
    }
    return felling.tree;
  }

  /** Holding on a tree: one meter for the whole tree, then it all comes down. */
  function fellHold(tree: Tree, held: Stack | null, dt: number): boolean {
    const { x, y, z } = tree.base;
    if (isProtected(x, y, z) || others.trees?.at(x,y,z)?.protected) {
      toast(TOWN_TOAST);
      stop();
      return false;
    }
    const axe = held !== null && game.systems.items.get(held.id).tool?.kind === 'axe';
    const seconds = Math.max(HOLD_TO_BREAK, axe ? FELLING.axe : FELLING.hand);
    if (!active || meter.x !== x || meter.y !== y || meter.z !== z || meter.tree === null) {
      meter.x = x;
      meter.y = y;
      meter.z = z;
      meter.progress = 0;
      meter.tree = tree.box;
      active = true;
    }
    meter.progress = Math.min(1, meter.progress + dt / seconds);
    if (meter.progress < 1 - 1e-9) return false;
    stop();
    return fell(tree);
  }

  /** Takes the whole tree out of the world and puts its wood and fiber in the bag. */
  function fell(tree: Tree): boolean {
    const { x, y, z } = tree.base;
    if (others.trees?.at(x,y,z)) return others.trees.fell(x,y,z);
    const id = world.getBlock(x, y, z);
    const c = tree.cells;
    for (let i = 0; i < c.length; i += 3) world.setBlock(c[i], c[i + 1], c[i + 2], AIR);
    felling = null;
    const drops = rules[id].drops;
    const wood = drops === 'self' ? itemForBlock(id) : drops[0]?.item ?? null;
    if (wood) give(wood, tree.logs, x, y, z);
    give('fiber', Math.max(1, Math.round(tree.leaves / FELLING.leavesPerFiber)), x, y, z);
    events.emit('block.broken', { x, y, z, id, by: 'player' });
    events.emit('tree.felled', { x, y, z, id, logs: tree.logs, leaves: tree.leaves, box: tree.box });
    return true;
  }

  function hold(context: UseContext, dt: number): boolean {
    idle = 0;
    const hit = context.hit;
    if (context.button !== 'primary' || claimed || player.busy || !hit) {
      stop();
      return false;
    }
    const placed = placedAt(hit);
    const x = placed ? placed.x : hit.x, y = placed ? placed.y : hit.y, z = placed ? placed.z : hit.z;
    // The world is asked again: the hit may be a step old.
    const id = world.getBlock(x, y, z);
    const model = others.trees?.at(hit.x,hit.y,hit.z);
    if ((model ? reachDistance(player,model.box.x0,model.box.y0,model.box.z0,model.box.x1,model.box.y1,model.box.z1)>REACH : !inReach(hit.x, hit.y, hit.z)) || (!placed && !model && !SOLID[id])) {
      stop();
      return false;
    }
    const tree = placed ? null : treeAt(x, y, z, id, context.held);
    if (tree) return fellHold(tree, context.held, dt);
    if (isProtected(x, y, z)) {
      toast(TOWN_TOAST);
      stop();
      return false;
    }
    let seconds: number | null = PLACEABLE_BREAK_SECONDS;
    if (!placed) {
      // A block with a station standing on it stays, so the station never floats.
      if (others.placeables?.at(x, y + 1, z)) {
        stop();
        return false;
      }
      const rule = rules[id];
      seconds = secondsFor(rule, context.held);
      if (seconds === null) {
        toast(`This needs ${rule.tool ? TOOL_NAMES[rule.tool.kind] : 'a tool'}.`);
        stop();
        return false;
      }
    } else if (others.placeables && carriesAnother(others.placeables, placed)) {
      // A placed thing with another standing on it stays too.
      stop();
      return false;
    }
    if (!active || meter.x !== x || meter.y !== y || meter.z !== z) {
      meter.x = x;
      meter.y = y;
      meter.z = z;
      meter.progress = 0;
      active = true;
    }
    meter.progress = Math.min(1, meter.progress + dt / Math.max(HOLD_TO_BREAK, seconds));
    // The small margin lets ten steps of 0.05 finish a break of 0.5 seconds.
    if (meter.progress < 1 - 1e-9) return false;
    stop();
    return placed ? pickUp(placed) : breakBlock(x, y, z, id);
  }

  /** Something that is drawn stands in this cell: a person, a pet, a creature. */
  function actorInCell(x: number, y: number, z: number): boolean {
    for (const actor of game.actors.values()) {
      if (actor.id !== 'player' && bodyInCell(actor.pos.x, actor.pos.y, actor.pos.z, x, y, z)) return true;
    }
    return false;
  }

  function place(context: UseContext): boolean {
    const hit = context.hit, stack = context.held;
    if (!hit || !stack || !(hit.nx || hit.ny || hit.nz) || !inReach(hit.x, hit.y, hit.z)) return false;
    // The world is asked again: nothing is placed against a block that is no longer there.
    if (!SOLID[world.getBlock(hit.x, hit.y, hit.z)]) return false;
    const def = game.systems.items.get(stack.id);
    if (def.block === undefined && def.placeable === undefined) return false;
    const inventory = game.systems.inventory;
    if (inventory.count(stack.id) < 1) return false;
    const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (isProtected(x, y, z)) {
      toast(TOWN_TOAST);
      return false;
    }

    if (def.placeable !== undefined) {
      const placeables = others.placeables;
      const kind = placeables?.defs().find((d) => d.kind === def.placeable);
      if (!placeables || !kind) return false;
      // Its front turns toward the player.
      const turns = (Math.round(player.facing / (Math.PI / 2)) + 2) & 3;
      const [sx, sy, sz] = footprint(kind.size, turns);
      // A thing longer than a block starts at the clicked cell and goes on the way the player faces, so the
      // bed's foot is at the player's end and its pillow at the far one.
      const ax = turns === 1 ? x - sx + 1 : x, az = turns === 2 ? z - sz + 1 : z;
      for (let cx = ax; cx < ax + sx; cx++) {
        for (let cz = az; cz < az + sz; cz++) {
          for (let cy = y; cy < y + sy; cy++) if (bodyInCell(player.pos.x, player.pos.y, player.pos.z, cx, cy, cz)) return false;
          if (isProtected(cx, y, cz)) {
            toast(TOWN_TOAST);
            return false;
          }
          if (!SOLID[world.getBlock(cx, y - 1, cz)]) {
            toast(NO_GROUND_TOAST);
            return false;
          }
          // The cell over a growing crop stays open, for a placed thing as for a block.
          if (others.crops?.at(cx, y - 1, cz)) {
            toast(NO_ROOM_TOAST);
            return false;
          }
        }
      }
      if (!placeables.place(kind.kind, ax, y, az, turns)) {
        toast(NO_ROOM_TOAST);
        return false;
      }
      inventory.remove(stack.id, 1);
      return true;
    }

    const block = def.block as number;
    if (SOLID[world.getBlock(x, y, z)] || others.placeables?.at(x, y, z)) return false;
    if (bodyInCell(player.pos.x, player.pos.y, player.pos.z, x, y, z) || actorInCell(x, y, z)) return false;
    // The cell over a growing crop stays open.
    if (others.crops?.at(x, y - 1, z)) return false;
    if (!world.setBlock(x, y, z, block)) return false;
    inventory.remove(stack.id, 1);
    events.emit('block.placed', { x, y, z, id: block, by: 'player' });
    return true;
  }

  const api: ActionsApi = {
    use(context) {
      if (player.busy) return false;
      const primary = context.button === 'primary';
      if (primary) claimed = false;
      for (const handler of handlers) {
        if (!handler(context)) continue;
        if (primary) {
          claimed = true;
          stop();
        }
        return true;
      }
      if (!primary) return place(context);
      // A click starts the break from nothing. Holding the button, through hold(), finishes it.
      stop();
      hold(context, 0);
      return active;
    },
    addHandler(handler) {
      handlers.push(handler);
    },
    hold,
    breaking: () => (active && idle <= STEP + 1e-9 ? meter : null),
    reach: REACH,
  };

  // Nothing to save: a break in progress does not outlive a load.
  kernel.add('actions', api, {
    step(dt) {
      now += dt;
      idle += dt;
      if (idle > FORGET_AFTER) stop();
    },
  });
}
