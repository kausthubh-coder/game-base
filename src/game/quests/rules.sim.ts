// Works out the conditions and runs the effects that quests, dialogue and hints write as data.
// Call these only after every system is installed: they read `game.systems`.
//
// A system that is missing reads as empty (no items, no people, no pages) instead of throwing, because
// the shell switches a system off for good the first time its step throws.

import type { Vec3 } from '../../engine/types.ts';
import { AIR } from '../../content/blocks.ts';
import type { EventName, Game, GameEvents, ItemId, PetState } from '../api.sim.ts';
import { distance2d } from '../move.sim.ts';
import type { Condition, Effect } from '../content/quests.ts';

/** When a time of day counts as dusk or night. The clock's dusk begins at 0.73 and dawn at 0.23. */
export const DUSK = 0.73;
export const DAWN = 0.23;
/** How many blocks above a bed are searched for a roof. */
const ROOF_REACH = 6;

export const isDark = (timeOfDay: number): boolean => timeOfDay >= DUSK || timeOfDay < DAWN;

export function bagCount(game: Game, item: ItemId | ItemId[]): number {
  const inventory = game.systems.inventory;
  if (!inventory) return 0;
  if (typeof item === 'string') return inventory.count(item);
  let total = 0;
  for (const id of item) total += inventory.count(id);
  return total;
}

/** Where a named place is, or null when the region has no such place. */
export function placeAt(game: Game, name: string): Vec3 | null {
  try {
    return game.systems.region.place(name)?.at ?? null;
  } catch {
    return null;
  }
}

export function petOf(game: Game, kind: string, bondedOnly = false): PetState | null {
  for (const pet of game.systems.pets?.all() ?? []) if (pet.kind === kind && (!bondedOnly || pet.bonded)) return pet;
  return null;
}

export type QuestState = 'hidden' | 'active' | 'done';

/** A quest's state, read from the flags the quest system keeps. */
export function questState(game: Game, quest: string): QuestState {
  if (game.flags.is(`quest.${quest}.done`)) return 'done';
  return game.flags.is(`quest.${quest}.started`) ? 'active' : 'hidden';
}

/**
 * True when the condition holds now. `seen` answers an `event` condition, which only the quest system
 * can: nothing else remembers what arrived.
 */
export function holds(game: Game, c: Condition | undefined, seen?: (event: EventName) => boolean): boolean {
  if (!c) return true;
  const { flags, player, systems } = game;
  if ('flag' in c) return c.is === undefined ? flags.is(c.flag) : flags.get(c.flag) === c.is;
  if ('not' in c) return !holds(game, c.not, seen);
  if ('all' in c) return c.all.every((part) => holds(game, part, seen));
  if ('any' in c) return c.any.some((part) => holds(game, part, seen));
  if ('bag' in c) {
    const have = bagCount(game, c.bag);
    return have >= (c.atLeast ?? 1) && (c.atMost === undefined || have <= c.atMost);
  }
  if ('quest' in c) {
    const state = questState(game, c.quest);
    if (c.step !== undefined) return state === 'active' && flags.get(`quest.${c.quest}.step`) === c.step;
    return state === (c.state ?? 'active');
  }
  if ('place' in c) {
    if (c.ever && flags.is(`been.${c.place}`)) return true;
    const at = placeAt(game, c.place);
    return at !== null && distance2d(player.pos, at) <= c.within;
  }
  if ('page' in c) return systems.almanac?.page(c.page)?.complete === true;
  if ('known' in c) return systems.almanac?.page(c.known)?.facts.some((fact) => fact.column === c.column && fact.known) === true;
  if ('placed' in c) {
    for (const placed of systems.placeables?.all() ?? []) {
      if (placed.kind !== c.placed) continue;
      if (!c.covered) return true;
      for (let dy = 1; dy <= ROOF_REACH; dy++) if (game.world.getBlock(placed.x, placed.y + dy, placed.z) !== AIR) return true;
    }
    return false;
  }
  if ('bonded' in c) return petOf(game, c.bonded, true) !== null;
  if ('petNear' in c) return (systems.pets?.all() ?? []).some((pet) => pet.kind === c.petNear && distance2d(pet.pos, player.pos) <= c.within);
  if ('beside' in c) {
    const pet = petOf(game, c.beside, true);
    return pet !== null && distance2d(pet.pos, player.pos) <= (c.within ?? 10);
  }
  if ('event' in c) return seen ? seen(c.event) : false;
  if ('raining' in c) return game.ambient.rain > 0.2 || flags.is('story.raining');
  if ('dark' in c) return isDark(game.clock.timeOfDay);
  if ('npcNear' in c) return (systems.people?.all() ?? []).some((npc) => distance2d(npc.pos, player.pos) <= c.npcNear);
  let growing = 0;
  for (const crop of systems.crops?.all() ?? []) if (crop.state.crop === c.crop) growing++;
  return bagCount(game, c.short) + c.perSeed * (bagCount(game, c.seed) + growing) < c.of;
}

/** Runs each part of a condition through `visit`, the condition itself first. */
export function walk(c: Condition, visit: (part: Condition) => void): void {
  visit(c);
  if ('not' in c) walk(c.not, visit);
  else if ('all' in c) for (const part of c.all) walk(part, visit);
  else if ('any' in c) for (const part of c.any) walk(part, visit);
}

/** The flag that counts how many of an item a gift still owes, because the bag was full. */
export const owedFlag = (item: ItemId): string => `owed.${item}`;

/** Runs one effect. A gift that does not fit is remembered under `owed.<item>`, and the director hands it over later. */
export function apply(game: Game, effect: Effect): void {
  const { flags, systems } = game;
  if ('flag' in effect) flags.set(effect.flag, effect.value ?? true);
  else if ('add' in effect) flags.add(effect.add, effect.amount);
  else if ('give' in effect) {
    const count = effect.count ?? 1;
    const left = systems.inventory ? systems.inventory.add(effect.give, count) : count;
    if (left > 0) flags.add(owedFlag(effect.give), left);
  } else if ('take' in effect) systems.inventory?.remove(effect.take, Math.min(effect.count ?? 1, bagCount(game, effect.take)));
  else if ('start' in effect) systems.quests?.start(effect.start);
  else if ('befriend' in effect) systems.people?.befriend(effect.befriend, effect.amount ?? 1);
  else if ('learn' in effect) {
    if (effect.fact !== undefined) systems.almanac?.learn(effect.learn, effect.fact);
    else for (const fact of systems.almanac?.page(effect.learn)?.facts ?? []) systems.almanac.learn(effect.learn, fact.id);
  } else if ('bond' in effect) {
    for (const pet of systems.pets?.all() ?? []) if (pet.kind === effect.bond && !pet.bonded) systems.pets.bond?.(pet.id);
  } else game.events.emit(effect.emit, (effect.data ?? {}) as GameEvents[EventName] as never);
}
