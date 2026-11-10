// What breaking a block takes and gives, as data. The key is a block key from src/content/blocks.ts.
// A block that is not listed here uses DEFAULT_BREAK: a placed block that gives itself.
import type { ItemId, ToolKind } from '../api.sim.ts';

export interface Drop {
  item: ItemId;
  count: number;
  /** How often it drops, 0 to 1. 1 is always. */
  chance: number;
}

export interface BreakRule {
  /** Seconds to break it with bare hands or the wrong tool. Null when hands cannot break it. */
  hand: number | null;
  /** The tool that does it faster, or at all. */
  tool?: { kind: ToolKind; seconds: number };
  /** What goes into the bag. `self` is the item that places this block, when there is one. */
  drops: readonly Drop[] | 'self';
}

const always = (item: ItemId): Drop => ({ item, count: 1, chance: 1 });

const LEAVES: BreakRule = { hand: 0.25, drops: [{ item: 'fiber', count: 1, chance: 1 / 2 }] };
const LOG: BreakRule = { hand: 1.5, tool: { kind: 'axe', seconds: 0.5 }, drops: [always('oak_log')] };
const EARTH: BreakRule = { hand: 0.5, drops: [always('dirt')] };
const ROCK: BreakRule = { hand: null, tool: { kind: 'pickaxe', seconds: 1 }, drops: [always('stone')] };

/** Planks and every other placed block. */
export const DEFAULT_BREAK: BreakRule = { hand: 0.6, drops: 'self' };

/** A placed station or piece of furniture comes up in this many seconds and returns its item. */
export const PLACEABLE_BREAK_SECONDS = 0.6;

export const BREAKING: Readonly<Record<string, BreakRule>> = {
  grass: { hand: 0.25, drops: [always('dirt'), { item: 'fiber', count: 1, chance: 1 / 5 }] },
  oak_leaves: LEAVES,
  pine_needles: LEAVES,
  dirt: EARTH,
  tilled_soil: EARTH,
  path: EARTH,
  clay: EARTH,
  sand: { hand: 0.5, drops: 'self' },
  oak_log: LOG,
  birch_log: LOG,
  pine_log: LOG,
  stone: ROCK,
  mossy_stone: ROCK,
  lume_crystal: { hand: null, tool: { kind: 'pickaxe', seconds: 1 }, drops: [] },
  // The plank item is what places this block, so breaking it gives the plank back.
  oak_plank: { hand: 0.6, drops: [always('plank')] },
};
