// What must hold after every step of the game, whatever the player did. The bot and the scenarios check
// these after each kernel step. `check` reads the play and changes nothing, so a replay sees the same game.
//
// Do not weaken one of these to make a run pass. When the rules change what they promise, change the
// sentence here with them and say so in the commit.
//
//   hero      its position is finite numbers, above the world's floor and below its top. With the hero's own
//             body stepping (`body`), its middle is never inside a solid block.
//   bag       36 slots, each empty or a known item with a whole count from 1 to its stack size. The Almanac
//             takes no slot. The selected slot is a quick slot. No rule takes a tool away.
//   clock     the seconds never go back, the day never goes back, the time of day is from 0 to 1.
//   busy      the player is held exactly while a conversation is open.
//   quests    a quest never goes back a state or a step, and every started quest can still finish (below).
//   crops     a crop stands on tilled soil with nothing over it, at a stage its kind has, ripe at the last one.
//   placed    a placed thing has solid ground under every cell and something in every cell.
//   pets      trust is a whole number up to the bond, never goes down, and a bonded pet stays bonded.
//   people    everyone stands at finite numbers, and a friendship is from 0 to 5.
//   actors    everything drawn stands at finite numbers.
//   save      now and then: the save holds no number that JSON cannot write.
//
// "Can still finish" means: for the open step of a started quest and every step after it, someone the step
// names is still in the world, its place, page and pet exist, and each thing it asks for is in the bag,
// stands in the world, or can still be had: from the land, from a person, or from a recipe whose parts and
// station can be had the same way.

import { AIR, blockId } from '../../content/blocks.ts';
import { HEIGHT, SOLID } from '../../features/world/chunk.sim.ts';
import type { ItemDef, ItemId } from '../api.sim.ts';
import { farming } from '../content/crops.ts';
import { PETS } from '../content/pets.ts';
import { footprint } from '../content/placeables.ts';
import { QUESTS, WHEAT_SHORT, type Condition, type QuestDef } from '../content/quests.ts';
import { recipes } from '../content/recipes.ts';
import { QUICK_SLOTS, SLOTS } from '../inventory/index.sim.ts';
import { bagCount, holds, placeAt, questState, walk } from '../quests/rules.sim.ts';
import type { Play } from './harness.sim.ts';

const TILLED = blockId('tilled_soil');
const RANK = { hidden: 0, active: 1, done: 2 } as const;
/** Steps between two looks through the save. */
const SAVE_EVERY = 500;

export interface InvariantOptions {
  /** True when the hero's own body moves the player (`Play.tick`): then the hero is never inside a block. */
  body?: boolean;
}

export interface Invariants {
  /** What is broken after this step, in a sentence, or null. */
  check(p: Play): string | null;
}

/** Where the things a quest asks for come from when the bag lacks them, other than a recipe. Null when it can be had, or why not. */
const SOURCES: Readonly<Record<ItemId, (p: Play) => string | null>> = {
  // Trees stand on all the land outside the town, a hand fells one, and every tree gives logs and fiber.
  oak_log: () => null,
  fiber: () => null,
  berry: (p) => ((p.sys.region.berryBushes?.() ?? []).length > 0 ? null : 'asks for berries, and the region has no berry bush'),
  // Gus hands out the first seeds, and more when the harvest comes up short.
  wheat_seeds: (p) => (p.sys.people.get('gus') ? null : 'asks for wheat seeds, and Gus is gone'),
  wheat: (p) => (!holds(p.game, WHEAT_SHORT) || p.sys.people.get('gus') ? null : 'asks for wheat, the harvest is short and Gus is gone'),
  // Mosslings leave tufts by their rocks.
  moss_tuft: () => null,
};

const finite = (n: number): boolean => Number.isFinite(n);

/**
 * Why the item can no longer be had, or null when it can: a source, or a recipe whose parts and station can be
 * had. `asking` holds the items being asked about further up, so a recipe that needs its own product ends.
 */
function cannotHave(p: Play, item: ItemId, asking: Set<ItemId>): string | null {
  const source = SOURCES[item];
  if (source) return source(p);
  if (!asking.has(item)) {
    asking.add(item);
    for (const recipe of recipes) {
      if (recipe.makes.id !== item) continue;
      let why: string | null = null;
      for (const need of recipe.needs) {
        if (p.sys.inventory.count(need.id) < need.count) why = cannotHave(p, need.id, asking);
        if (why) break;
      }
      if (!why && recipe.station !== 'hand') why = cannotStand(p, (def) => def.station === recipe.station, asking);
      if (!why) {
        asking.delete(item);
        return null;
      }
    }
    asking.delete(item);
  }
  return `asks for ${item}, and nothing gives one any more`;
}

/** Why no placed thing of this sort can stand, or null when one stands or its item is in the bag or can be had. */
function cannotStand(p: Play, fits: (def: { kind: string; station?: string }) => boolean, asking: Set<ItemId>): string | null {
  const defs = p.sys.placeables.defs().filter(fits);
  for (const placed of p.sys.placeables.all()) if (defs.some((def) => def.kind === placed.kind)) return null;
  let why: string | null = 'asks for something to be set down that no item sets down';
  for (const def of defs) {
    const item = p.sys.items.all().find((one) => one.placeable === def.kind);
    if (!item) continue;
    why = p.sys.inventory.count(item.id) > 0 ? null : cannotHave(p, item.id, asking);
    if (!why) return null;
  }
  return why;
}

/** Why the condition can never hold again, or null when it still can. */
function cannotHold(p: Play, c: Condition): string | null {
  const { sys, game } = p;
  if ('all' in c) {
    for (const part of c.all) {
      const why = cannotHold(p, part);
      if (why) return why;
    }
    return null;
  }
  if ('any' in c) {
    let why: string | null = null;
    for (const part of c.any) {
      why = cannotHold(p, part);
      if (!why) return null;
    }
    return why;
  }
  if ('bag' in c) {
    if (bagCount(game, c.bag) >= (c.atLeast ?? 1)) return null;
    let why: string | null = null;
    for (const id of typeof c.bag === 'string' ? [c.bag] : c.bag) {
      why = cannotHave(p, id, new Set());
      if (!why) return null;
    }
    return why;
  }
  if ('place' in c) return placeAt(game, c.place) ? null : `asks for the place ${c.place}, and the region has none`;
  if ('page' in c) return sys.almanac.page(c.page) ? null : `asks for the Almanac page ${c.page}, and there is none`;
  if ('known' in c) return sys.almanac.page(c.known) ? null : `asks for the Almanac page ${c.known}, and there is none`;
  if ('placed' in c) return cannotStand(p, (def) => def.kind === c.placed, new Set());
  if ('bonded' in c || 'petNear' in c || 'beside' in c) {
    const kind = 'bonded' in c ? c.bonded : 'petNear' in c ? c.petNear : c.beside;
    const pet = sys.pets.all().find((one) => one.kind === kind);
    if (!pet) return `asks for a ${kind}, and there is none`;
    if ('petNear' in c || pet.bonded) return null;
    const treat = PETS.find((def) => def.kind === kind)?.treat;
    return treat ? cannotHave(p, treat, new Set()) : null;
  }
  // A night's sleep needs a bed.
  if ('event' in c && c.event === 'slept') return cannotStand(p, (def) => def.station === 'bed', new Set());
  return null;
}

/** Why a started quest can no longer finish, from its open step on, or null. */
function cannotFinish(p: Play, def: QuestDef, from: number): string | null {
  for (let i = from; i < def.steps.length; i++) {
    const step = def.steps[i];
    let why: string | null = null;
    if (step.npc && step.npc.length > 0 && !step.npc.some((id) => p.sys.people.get(id))) why = `asks for ${step.npc.join(' or ')}, and none of them is in the world`;
    else if (step.place && !placeAt(p.game, step.place)) why = `asks for the place ${step.place}, and the region has none`;
    else if (!holds(p.game, step.done)) why = cannotHold(p, step.done);
    if (why) return `the quest ${def.id} can no longer finish: its step ${step.id} ${why}`;
  }
  return null;
}

/**
 * Every item a quest step asks to be in the bag that has neither a source above nor a recipe. It should be
 * empty: a test asks for that, so a new quest says where its things come from.
 */
export function unknownQuestItems(): string[] {
  const missing: string[] = [];
  for (const def of QUESTS) {
    for (const step of def.steps) {
      walk(step.done, (part) => {
        if (!('bag' in part)) return;
        for (const id of typeof part.bag === 'string' ? [part.bag] : part.bag) {
          if (!SOURCES[id] && !recipes.some((recipe) => recipe.makes.id === id)) missing.push(`${def.id}.${step.id}: ${id}`);
        }
      });
    }
  }
  return missing;
}

/** Finds the first number in plain data that JSON cannot write, as a path to it, or null. */
function badNumber(value: unknown, path: string): string | null {
  if (typeof value === 'number') return finite(value) ? null : `${path} is ${String(value)}`;
  if (value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const bad = badNumber(value[i], `${path}[${i}]`);
      if (bad) return bad;
    }
    return null;
  }
  for (const key in value) {
    const bad = badNumber((value as Record<string, unknown>)[key], `${path}.${key}`);
    if (bad) return bad;
  }
  return null;
}

export function createInvariants(options: InvariantOptions = {}): Invariants {
  // What was true at the last check, for the things that may never go back.
  let seconds = -Infinity, day = -Infinity;
  const questRank = new Map<string, number>(), questStep = new Map<string, number>();
  const trust = new Map<string, number>(), bonded = new Set<string>();
  const tools = new Map<ItemId, number>();
  let toolIds: ItemId[] | null = null;
  let known: Map<ItemId, ItemDef> | null = null;
  let sinceSave = 0;

  function hero(p: Play): string | null {
    const { pos, facing } = p.game.player;
    if (!finite(pos.x) || !finite(pos.y) || !finite(pos.z) || !finite(facing)) return `the hero's position is not finite numbers: ${pos.x}, ${pos.y}, ${pos.z}, facing ${facing}`;
    if (pos.y <= 0) return `the hero is below the world's floor, at height ${pos.y}`;
    if (pos.y > HEIGHT + 8) return `the hero is above the world's top, at height ${pos.y}`;
    if (options.body) {
      const x = Math.floor(pos.x), y = Math.floor(pos.y), z = Math.floor(pos.z);
      for (let dy = 0; dy < 2; dy++) {
        if (SOLID[p.world.getBlock(x, y + dy, z)]) return `the hero is inside the solid block at ${x}, ${y + dy}, ${z} (standing at ${pos.x}, ${pos.y}, ${pos.z})`;
      }
    }
    return null;
  }

  function bag(p: Play): string | null {
    const { inventory, items } = p.sys;
    const slots = inventory.slots;
    if (slots.length !== SLOTS) return `the bag has ${slots.length} slots, not ${SLOTS}`;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;
      if (slot.id === 'almanac') return `the Almanac takes slot ${i} of the bag`;
      known ??= new Map(items.all().map((item) => [item.id, item]));
      const def = known.get(slot.id);
      if (!def) return `slot ${i} of the bag holds ${slot.id}, which is no item`;
      if (!Number.isInteger(slot.count) || slot.count < 1 || slot.count > def.stack) return `slot ${i} of the bag holds ${slot.count} ${slot.id}, and a slot holds 1 to ${def.stack}`;
    }
    if (!Number.isInteger(inventory.selected) || inventory.selected < 0 || inventory.selected >= QUICK_SLOTS) return `the selected slot is ${inventory.selected}, which is no quick slot`;
    toolIds ??= items.all().filter((def) => def.tool).map((def) => def.id);
    for (const id of toolIds) {
      const have = inventory.count(id), had = tools.get(id) ?? 0;
      if (have < had) return `the bag held ${had} ${id} and holds ${have}: a tool was taken away`;
      if (have > had) tools.set(id, have);
    }
    return null;
  }

  function clock(p: Play): string | null {
    const c = p.game.clock;
    if (!finite(c.seconds) || !finite(c.timeOfDay) || !Number.isInteger(c.day)) return `the clock is not numbers: day ${c.day}, time ${c.timeOfDay}, ${c.seconds} seconds`;
    if (c.seconds < seconds) return `the clock went back from ${seconds} to ${c.seconds} seconds`;
    if (c.day < day || c.day < 1) return `the day went back from ${day} to ${c.day}`;
    if (c.timeOfDay < 0 || c.timeOfDay > 1) return `the time of day is ${c.timeOfDay}, outside 0 to 1`;
    seconds = c.seconds;
    day = c.day;
    return null;
  }

  function quests(p: Play): string | null {
    const { game } = p;
    for (const def of QUESTS) {
      const state = questState(game, def.id), rank = RANK[state];
      const before = questRank.get(def.id) ?? 0;
      if (rank < before) return `the quest ${def.id} went back to ${state}`;
      questRank.set(def.id, rank);
      if (state !== 'active') continue;
      const id = game.flags.get(`quest.${def.id}.step`);
      const index = def.steps.findIndex((step) => step.id === id);
      if (index < 0) return `the quest ${def.id} is active and its open step is ${String(id)}, which is no step of it`;
      const last = questStep.get(def.id) ?? 0;
      if (index < last) return `the quest ${def.id} went back from its step ${def.steps[last].id} to ${def.steps[index].id}`;
      questStep.set(def.id, index);
      const why = cannotFinish(p, def, index);
      if (why) return why;
    }
    const tracked = p.sys.quests.tracked();
    if (tracked && questState(game, tracked.id) !== 'active') return `the tracker shows the quest ${tracked.id}, which is ${questState(game, tracked.id)}`;
    return null;
  }

  function crops(p: Play): string | null {
    const { world } = p;
    const defs = p.sys.crops.defs();
    for (const { x, y, z, state } of p.sys.crops.all()) {
      const def = defs.find((one) => one.id === state.crop);
      if (!def) return `the crop at ${x}, ${y}, ${z} is ${state.crop}, which is no crop`;
      if (!Number.isInteger(state.stage) || state.stage < 0 || state.stage >= def.stages) return `the ${state.crop} at ${x}, ${y}, ${z} is at stage ${state.stage} of ${def.stages}`;
      if (state.ripe !== (state.stage === def.stages - 1)) return `the ${state.crop} at ${x}, ${y}, ${z} is at stage ${state.stage} of ${def.stages} and ${state.ripe ? 'ripe' : 'not ripe'}`;
      if (!finite(state.wet) || state.wet < 0 || state.wet > farming.waterSeconds) return `the soil at ${x}, ${y}, ${z} has ${state.wet} seconds of water, outside 0 to ${farming.waterSeconds}`;
      // Land far from the player is not in memory, and reads as air.
      if (!world.isLoaded(x, z)) continue;
      if (world.getBlock(x, y, z) !== TILLED) return `the ${state.crop} at ${x}, ${y}, ${z} grows on block ${world.getBlock(x, y, z)}, which is not tilled soil`;
      if (world.getBlock(x, y + 1, z) !== AIR) return `the ${state.crop} at ${x}, ${y}, ${z} has block ${world.getBlock(x, y + 1, z)} over it`;
    }
    return null;
  }

  function placed(p: Play): string | null {
    const { world } = p;
    const defs = p.sys.placeables.defs();
    for (const one of p.sys.placeables.all()) {
      const def = defs.find((d) => d.kind === one.kind);
      if (!def) return `the placed thing ${one.id} is a ${one.kind}, which is no kind`;
      const [sx, sy, sz] = footprint(def.size, one.quarterTurns);
      for (let x = one.x; x < one.x + sx; x++) {
        for (let z = one.z; z < one.z + sz; z++) {
          if (!world.isLoaded(x, z)) continue;
          if (!SOLID[world.getBlock(x, one.y - 1, z)]) return `the ${one.kind} at ${one.x}, ${one.y}, ${one.z} has no solid ground under ${x}, ${z}`;
          for (let y = one.y; y < one.y + sy; y++) if (world.getBlock(x, y, z) === AIR) return `the ${one.kind} at ${one.x}, ${one.y}, ${one.z} left its cell ${x}, ${y}, ${z} empty`;
        }
      }
    }
    return null;
  }

  function living(p: Play): string | null {
    const { sys, game } = p;
    for (const pet of sys.pets.all()) {
      const need = PETS.find((def) => def.kind === pet.kind)?.trustToBond ?? Infinity;
      if (!Number.isInteger(pet.trust) || pet.trust < 0 || pet.trust > need) return `the ${pet.kind}'s trust is ${pet.trust}, outside 0 to ${need}`;
      if (pet.trust < (trust.get(pet.id) ?? 0)) return `the ${pet.kind}'s trust went down from ${trust.get(pet.id)} to ${pet.trust}`;
      trust.set(pet.id, pet.trust);
      if (bonded.has(pet.id) && !pet.bonded) return `the ${pet.kind} was bonded and is wild again`;
      if (pet.bonded) bonded.add(pet.id);
    }
    for (const npc of sys.people.all()) {
      if (!(npc.friendship >= 0 && npc.friendship <= 5)) return `${npc.id}'s friendship is ${npc.friendship}, outside 0 to 5`;
    }
    for (const actor of game.actors.values()) {
      const at = actor.pos;
      if (!finite(at.x) || !finite(at.y) || !finite(at.z) || !finite(actor.facing)) return `${actor.id} stands at ${at.x}, ${at.y}, ${at.z}, facing ${actor.facing}, which are not finite numbers`;
    }
    return null;
  }

  function save(p: Play): string | null {
    if (++sinceSave < SAVE_EVERY) return null;
    sinceSave = 0;
    const bad = badNumber(p.kernel.save(), 'save');
    return bad ? `the save holds a number JSON cannot write: ${bad}` : null;
  }

  return {
    check(p) {
      if (p.game.player.busy !== p.sys.talk.active) return `the player is ${p.game.player.busy ? 'held' : 'free'} and a conversation is ${p.sys.talk.active ? 'open' : 'not open'}`;
      return hero(p) ?? bag(p) ?? clock(p) ?? quests(p) ?? crops(p) ?? placed(p) ?? living(p) ?? save(p);
    },
  };
}
