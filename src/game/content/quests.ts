// The five quests of the first part, as data, with the shapes dialogue and hints share: a condition
// (something true or false about this playthrough) and an effect (something a conversation does).
// Quest and step ids are the ones in docs/play/act1.md. The engine is src/game/quests.

import type { EventName, FlagValue, ItemId, NpcId, QuestId } from '../api.sim.ts';

/** Something true or false right now. `src/game/quests/rules.sim.ts` works it out. */
export type Condition =
  /** The flag is set, or equals `is` when that is given. */
  | { flag: string; is?: FlagValue }
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] }
  /** How many of an item the bag holds. Several ids are added together. `atLeast` defaults to 1. */
  | { bag: ItemId | ItemId[]; atLeast?: number; atMost?: number }
  /** A quest's state, or the step it is on. With neither, the quest is active. */
  | { quest: QuestId; state?: 'hidden' | 'active' | 'done'; step?: string }
  /** The player stands within `within` blocks of a named place. `ever` also counts having been there before. */
  | { place: string; within: number; ever?: boolean }
  /** Every fact on an Almanac page is known. */
  | { page: string }
  /** One column of an Almanac page has a known fact. */
  | { known: string; column: 'needs' | 'gives' }
  /** A placeable of this kind stands somewhere. `covered` asks for a block above it. */
  | { placed: string; covered?: boolean }
  /** A pet of this kind has bonded. */
  | { bonded: string }
  /** A pet of this kind, wild or bonded, is within `within` blocks of the player. */
  | { petNear: string; within: number }
  /** The bonded pet of this kind is beside the player, within `within` blocks (10 when not given). */
  | { beside: string; within?: number }
  /** Quest steps only: this event arrived while the quest was active. */
  | { event: EventName }
  | { raining: true }
  /** Dusk or night. */
  | { dark: true }
  /** Someone to talk to is within this many blocks. */
  | { npcNear: number }
  /**
   * The harvest cannot reach `of` any more: the item in the bag, plus `perSeed` for every seed in the
   * bag and every crop of this kind in the ground, comes to less.
   */
  | { short: ItemId; of: number; seed: ItemId; crop: string; perSeed: number };

/** Something a conversation does when it ends, or that skipTo does for a quest it passes over. */
export type Effect =
  /** Sets a flag. The value defaults to true. */
  | { flag: string; value?: FlagValue }
  /** Adds to a number flag. */
  | { add: string; amount: number }
  | { give: ItemId; count?: number }
  | { take: ItemId; count?: number }
  | { start: QuestId }
  | { befriend: NpcId; amount?: number }
  /** Teaches one Almanac fact, or every fact on the page when `fact` is left out. */
  | { learn: string; fact?: string }
  /** Bonds the wild pet of this kind without feeding it, through `PetsApi.bond`. For a quest that skipTo passes over. */
  | { bond: string }
  | { emit: EventName; data?: Record<string, FlagValue> };

export interface StepDef {
  id: string;
  /** The line the tracker shows. */
  text: string;
  done: Condition;
  /**
   * A gate has to be passed itself. A step that is not a gate also counts as done when a later step is,
   * so feeding the leaftail berry by berry never leaves "have 3 berries" open.
   */
  gate?: boolean;
  /** Who carries the quest mark during this step. The waypoint points at the nearest of them. */
  npc?: NpcId[];
  /** A named place from the region for the waypoint. */
  place?: string;
  /** The waypoint follows the pet of this kind. */
  pet?: string;
  /** Until the bag holds `bag`, the quest mark and the waypoint go to these people instead: whoever hands it over. */
  first?: { bag: ItemId; npc: NpcId[] };
  /** What the tracker counts: items in the bag, known facts on a page, or a pet's trust. */
  count?: { bag: ItemId | ItemId[]; need: number } | { page: string } | { trust: string; need: number };
}

export interface QuestDef {
  id: QuestId;
  title: string;
  summary: string;
  /** Starts by itself: with a new game, or when another quest is done. Otherwise a conversation starts it. */
  starts?: 'new game' | { after: QuestId };
  steps: StepDef[];
  /** What the player would have gained by finishing it. skipTo applies these for each quest it passes over. */
  skip: Effect[];
}

export const WOOD: ItemId = 'oak_log';
export const WHEAT_WANTED = 20;
/** True when the wheat in the bag, in seed and in the ground can no longer make twenty. */
export const WHEAT_SHORT: Condition = { short: 'wheat', of: WHEAT_WANTED, seed: 'wheat_seeds', crop: 'wheat', perSeed: 2 };

export const QUESTS: readonly QuestDef[] = [
  {
    id: 'plot',
    title: 'A plot of your own',
    summary: 'Tamsin is waiting at the grant stone with a book that has been blank for forty years.',
    starts: 'new game',
    steps: [
      { id: 'meet', text: 'Talk to Tamsin at the grant stone', done: { flag: 'plot.met' }, gate: true, npc: ['tamsin'], place: 'grant.stone' },
      { id: 'watch', text: 'Watch a mossling until both columns of its page fill', done: { page: 'mossling' }, place: 'grant.rocks', count: { page: 'mossling' } },
      { id: 'tell', text: 'Tell Tamsin what you saw', done: { flag: 'plot.told' }, gate: true, npc: ['tamsin'] },
    ],
    skip: [
      { flag: 'met.tamsin' }, { flag: 'plot.met' }, { flag: 'plot.told' }, { flag: 'has.almanac' },
      { give: 'almanac' }, { give: 'axe' }, { learn: 'mossling' }, { learn: 'tamsin', fact: 'gives' },
    ],
  },
  {
    id: 'roof',
    title: 'A roof before dark',
    summary: 'Cut wood, make a workbench, build a shelter and a bed, and sleep under it.',
    steps: [
      { id: 'wood', text: 'Cut 12 oak logs', done: { bag: WOOD, atLeast: 12 }, count: { bag: WOOD, need: 12 } },
      { id: 'bench', text: 'Make a workbench and set it down', done: { placed: 'workbench' } },
      { id: 'shelter', text: 'Set a bed down with a block over it', done: { placed: 'bed', covered: true } },
      { id: 'sleep', text: 'Sleep until morning', done: { event: 'slept' } },
    ],
    skip: [],
  },
  {
    id: 'leaftail',
    title: 'Leaf and tail',
    summary: 'Something still tends the dead garden. It likes berries and a slow step.',
    starts: { after: 'roof' },
    steps: [
      { id: 'find', text: 'Find what tends the dead garden', done: { any: [{ petNear: 'leaftail', within: 10 }, { place: 'dead.garden', within: 10 }] }, place: 'dead.garden' },
      { id: 'berries', text: 'Pick 3 berries from the bushes', done: { bag: 'berry', atLeast: 3 }, count: { bag: 'berry', need: 3 } },
      { id: 'trust', text: 'Feed the leaftail three times without startling it', done: { bonded: 'leaftail' }, pet: 'leaftail', count: { trust: 'leaftail', need: 3 } },
      { id: 'show', text: 'Show the leaftail to Tamsin, or to Wren in town', done: { flag: 'leaftail.shown' }, gate: true, npc: ['tamsin', 'wren'] },
    ],
    skip: [{ bond: 'leaftail' }, { learn: 'leaftail' }, { flag: 'leaftail.shown' }, { flag: 'met.wren' }],
  },
  {
    id: 'bread',
    title: 'The queen\'s bread',
    summary: 'Queen Maren needs twenty sheaves of wheat before the festival.',
    steps: [
      { id: 'town', text: 'Follow the path to Hollowmere', done: { place: 'town.gate', within: 12, ever: true }, place: 'town.gate' },
      { id: 'queen', text: 'Meet Queen Maren in the granary', done: { flag: 'bread.asked' }, gate: true, npc: ['maren'], place: 'granary' },
      { id: 'seeds', text: 'Ask Gus for seeds', done: { flag: 'bread.seeds' }, gate: true, npc: ['gus'], place: 'gus.field' },
      { id: 'grow', text: 'Grow and harvest 20 wheat', done: { bag: 'wheat', atLeast: WHEAT_WANTED }, place: 'grant.center', count: { bag: 'wheat', need: WHEAT_WANTED } },
      { id: 'deliver', text: 'Bring 20 wheat to Maren', done: { flag: 'bread.delivered' }, gate: true, npc: ['maren'], place: 'granary', count: { bag: 'wheat', need: WHEAT_WANTED } },
    ],
    skip: [
      { flag: 'met.maren' }, { flag: 'met.gus' }, { flag: 'bread.asked' }, { flag: 'bread.seeds' }, { flag: 'bread.delivered' },
      { give: 'hoe' }, { give: 'watering_can' },
    ],
  },
  {
    id: 'festival',
    title: 'The harvest festival',
    summary: 'Lamps on the Mere at dusk, and the whole town in the square.',
    steps: [
      { id: 'evening', text: 'Come to the square at dusk', done: { all: [{ flag: 'festival.started' }, { place: 'town.square', within: 16 }] }, place: 'town.square' },
      { id: 'lamp', text: 'Float a lamp on the river from the bank', done: { flag: 'festival.lamp' }, place: 'river.bank', first: { bag: 'river_lamp', npc: ['odo'] } },
      { id: 'end', text: 'Talk to Tamsin on the bank', done: { flag: 'festival.ended' }, gate: true, npc: ['tamsin'] },
    ],
    skip: [{ flag: 'festival.started' }, { flag: 'festival.lamp' }, { flag: 'festival.ended' }],
  },
];
