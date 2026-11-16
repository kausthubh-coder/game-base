// The 21 quests of act 1, as data, with the shapes dialogue and hints share: a condition (something true or
// false about this playthrough) and an effect (something a conversation does). The quests, their order and their
// steps are handbook chapter 27 (`playthrough/content.js`). The engine is src/game/quests.
//
// Every step but the first night's is a stub: it is done when its own flag is set, `step.<quest>.<step>` for a
// step only its system knows how to finish, or the shared flag of docs/act1-foundation.md for a scene, a fight
// or a choice. The quest builder replaces a stub's `done` with the real condition; the other builders set the
// shared flags. So the act already plays from a new game to its end in the bots, a flag at a time.

import type { EventName, FlagValue } from '../api.sim.ts';
import { FLAG } from './flags.ts';
import { sceneOf } from './scenes.ts';
import {
  CHOICES, LEDGER_SECTIONS, type ChoiceId, type FightNumber, type ItemId, type NpcId, type PlaceRef, type QuestId, type SceneNumber,
  type StepKind,
} from './ids.ts';

/** Something true or false right now. `src/game/quests/rules.sim.ts` works it out. */
export type Condition =
  /** The flag is set, or equals `is` when that is given. */
  | { flag: string; is?: FlagValue }
  /** The flag is a number of at least this much: coin, hearts, the Heartstone, a fight's phases. Unset reads as 0. */
  | { flag: string; atLeast: number }
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
  /** The story is in this chapter of act 1: the chapter of the latest quest that has started. */
  | { chapter: Chapter }
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

/** The five chapters of act 1 (`content.js` `chapters`). */
export type Chapter = 1 | 2 | 3 | 4 | 5;
/** Their titles, for the quest log. */
export const CHAPTER_TITLES: Readonly<Record<Chapter, string>> = {
  1: 'The Shut Door', 2: 'The herald', 3: 'What the ruins say', 4: 'The Rootworks', 5: 'The pilgrimage',
};

export interface StepDef {
  id: string;
  /** What the player does, as chapter 27 names it. */
  kind: StepKind;
  /** The scene of chapter 22 this step plays, and the fight of chapter 23 it is. */
  scene?: SceneNumber;
  fight?: FightNumber;
  /**
   * Where on the Greenhollow plan it happens. Only the map knows these ids yet; `place` is the region's name for
   * the waypoint, and the two become one when the world builder makes every plan id a region place.
   */
  at?: PlaceRef;
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
  /** How close the player comes to its place before the story plays its conversation, when nearer than a scene's usual. */
  within?: number;
  /** The waypoint follows the pet of this kind. */
  pet?: string;
  /** Until the bag holds `bag`, the quest mark and the waypoint go to these people instead: whoever hands it over. */
  first?: { bag: ItemId; npc: NpcId[] };
  /** What the tracker counts: items in the bag, known facts on a page, or a pet's trust. */
  count?: { bag: ItemId | ItemId[]; need: number } | { page: string } | { trust: string; need: number };
  /**
   * The conversation that offers this step, in ./dialogue.ts: the story director starts it once the step is open
   * and the player is at its place, unless someone in `npc` is in the world to be talked to.
   */
  talk?: string;
  /** One more line for the quest log, when the step text alone does not say how. */
  hint?: string;
}

export interface QuestDef {
  id: QuestId;
  chapter: Chapter;
  title: string;
  summary: string;
  /**
   * Starts by itself: with a new game, or when another quest is done (every one of them, for a list). Otherwise a
   * conversation starts it.
   */
  starts?: 'new game' | { after: QuestId | readonly QuestId[] };
  steps: StepDef[];
  /** What the player would have gained by finishing it. skipTo applies these for each quest it passes over. */
  skip: Effect[];
}

/**
 * The effects that make a condition hold, for `skipTo` and for the bots that play the act a flag at a time: a flag
 * set to what it asks for, a choice set to its first value, each part of `all`, the first part of `any` that a
 * flag can make true. A condition no flag can make (an item, a place, an event) gives nothing.
 */
export function satisfy(c: Condition): Effect[] {
  if ('flag' in c) {
    if ('atLeast' in c) return [{ flag: c.flag, value: c.atLeast }];
    if (c.is !== undefined) return [{ flag: c.flag, value: c.is }];
    const choice = c.flag.startsWith('choice.') ? (c.flag.slice('choice.'.length) as ChoiceId) : null;
    return [{ flag: c.flag, value: choice && choice in CHOICES ? CHOICES[choice][0] : true }];
  }
  // Having been to a place is remembered as `been.<place>`.
  if ('place' in c && c.ever) return [{ flag: `been.${c.place}` }];
  if ('all' in c) return c.all.flatMap(satisfy);
  if ('any' in c) {
    for (const part of c.any) {
      const effects = satisfy(part);
      if (effects.length > 0) return effects;
    }
  }
  return [];
}

// ------------------------------------------------------------------------------------------ the stubs

type Extra = Partial<Omit<StepDef, 'id' | 'kind' | 'text' | 'done'>>;

/** A step of a kind only its system can finish: done by its own flag `step.<quest>.<id>`. */
const stub = (quest: QuestId) => (id: string, kind: Exclude<StepKind, 'scene' | 'fight' | 'choice'>, text: string, extra: Extra = {}): StepDef =>
  ({ id, kind, text, done: { flag: FLAG.step(quest, id) }, gate: true, ...extra });
/** A scene: done when `scene.<n>` is set. */
const scene = (id: string, n: SceneNumber, text: string, extra: Extra = {}): StepDef =>
  ({ id, kind: 'scene', scene: n, text, done: { flag: FLAG.scene(n) }, gate: true, ...extra });
/** The scene played as a fight ends is part of the fight's step (scenes 19, 21 and 31). */
const afterwards = (done: Condition, scene: SceneNumber | undefined): Condition =>
  scene && sceneOf(scene)?.start === 'fight' ? { all: [done, { flag: FLAG.scene(scene) }] } : done;
/** A fight: done when `fight.<n>.won` is set, and the scene after it has played. */
const fight = (id: string, n: FightNumber, text: string, extra: Extra = {}): StepDef =>
  ({ id, kind: 'fight', fight: n, text, done: afterwards({ flag: FLAG.fightWon(n) }, extra.scene), gate: true, ...extra });
/** A choice: done when every one of its `choice.<id>` flags is set. */
const choice = (id: string, choices: ChoiceId[], text: string, extra: Extra = {}): StepDef => {
  const flags: Condition[] = choices.map((one) => ({ flag: FLAG.choice(one) }));
  return { id, kind: 'choice', text, done: flags.length === 1 ? flags[0] : { all: flags }, gate: true, ...extra };
};

/** A quest whose skip effects are what its steps' flags need, then `gives`. */
const quest = (def: Omit<QuestDef, 'skip'>, gives: Effect[] = []): QuestDef => ({ ...def, skip: [...def.steps.flatMap((step) => satisfy(step.done)), ...gives] });
const after = (...ids: QuestId[]): QuestDef['starts'] => ({ after: ids.length === 1 ? ids[0] : ids });
/** The quests a quest waits for. */
export const waitsFor = (def: QuestDef): readonly QuestId[] =>
  typeof def.starts === 'object' ? (typeof def.starts.after === 'string' ? [def.starts.after] : def.starts.after) : [];
/** A section of the queen's ledger is filled: any `n` of the four. */
const ledger = (n: number): Condition => {
  const flags = LEDGER_SECTIONS.map((s) => FLAG.ledgerFilled(s));
  if (n >= flags.length) return { all: flags.map((flag) => ({ flag })) };
  const picks: Condition[] = [];
  const pick = (from: number, chosen: string[]): void => {
    if (chosen.length === n) {
      picks.push(n === 1 ? { flag: chosen[0] } : { all: chosen.map((flag) => ({ flag })) });
      return;
    }
    for (let i = from; i < flags.length; i++) pick(i + 1, [...chosen, flags[i]]);
  };
  pick(0, []);
  return { any: picks };
};

const grantday = stub('grantday'), ground = stub('ground'), kitchen = stub('kitchen');
const bench = stub('bench'), copper = stub('copper'), count = stub('count'), echo = stub('echo'), pump = stub('pump');
const uphill = stub('uphill'), gallery = stub('gallery'), lights = stub('lights'), seeds = stub('seeds');
const itself = stub('itself'), roofs = stub('roofs'), keystones = stub('keystones'), green = stub('green');
const pilgrimage = stub('pilgrimage');

export const QUESTS: readonly QuestDef[] = [
  // ---------------------------------------------------------------------------- chapter 1: the Shut Door
  quest({
    id: 'grantday',
    chapter: 1,
    title: 'Grant day',
    summary: 'The morning you leave home. Everything the film did not tell you about yourself is in this hall.',
    starts: 'new game',
    steps: [
      { id: 'film', kind: 'film', text: 'The opening film', done: { flag: FLAG.opening }, gate: true, at: 'saltgate' },
      scene('wake', 1, 'Wake in the bunk room, and pick your look at the mirror', { at: 'saltgate.bunks' }),
      grantday('breakfast', 'do', 'Eat Hobb\'s breakfast', { at: 'saltgate.kitchen', hint: 'A meal gives you an extra heart for the day.' }),
      scene('lock', 2, 'Try your key in the lock Dax found', { at: 'saltgate' }),
      scene('map', 3, 'Find your plot on the map wall', { at: 'saltgate.maps' }),
      choice('rack', ['weapon'], 'Take a sword, a bow or a staff from the rack', { at: 'saltgate.rack', within: 6, talk: 'choice.weapon', hint: 'The tool is how you fight. You can earn the other two later.' }),
      scene('spar', 4, 'Spar with Dax in the yard', { at: 'saltgate.yard' }),
      scene('deed', 5, 'Sign your deed', { at: 'saltgate' }),
      scene('quay', 6, 'Go down to the quay', { at: 'saltgate.quay' }),
      grantday('river', 'watch', 'A day up the river'),
    ],
  }, [{ give: 'axe' }, { give: 'spade' }]),
  quest({
    id: 'ground',
    chapter: 1,
    title: 'Ground nobody wanted',
    summary: 'Nobody is waiting on the jetty. You have a deed, a key, one tool and what is left of the day.',
    starts: after('grantday'),
    steps: [
      scene('landing', 7, 'Step off the ferry', { at: 'landing', place: 'landing' }),
      ground('ditch', 'do', 'Dig a ditch from the pond to your dry field', { at: 'plot', place: 'plot', hint: 'Where the water goes, the ground turns green.' }),
      ground('brambles', 'do', 'Cut back the brambles', { at: 'plot', place: 'plot' }),
      ground('camp', 'do', 'Pitch your tent and light a fire before dark', { at: 'plot', place: 'camp' }),
      scene('door', 8, 'Push the stone door in your hill', { at: 'hall', place: 'shut.door' }),
    ],
  }),
  {
    // The first night. src/game/hall plays it already, so these steps are real: each flag is set by a scene there.
    // The step ids are the old ones, which saves and the playtest copy keep.
    id: 'night',
    chapter: 1,
    title: 'The Shut Door',
    summary: 'A stone door in your hill has been shut for a thousand years. Tonight something comes out of the dark.',
    starts: after('ground'),
    steps: [
      { id: 'bed', kind: 'scene', scene: 9, at: 'plot', text: 'Dusk. Something is standing at the edge of your firelight', done: { flag: 'night.fox' }, place: 'camp' },
      { id: 'door', kind: 'fight', fight: 1, scene: 10, at: 'hall', text: 'Back away to the stone door', done: { flag: 'door.open' }, place: 'shut.door', hint: 'It is slower than you. Walk backwards until stone is behind you.' },
      { id: 'mark', kind: 'scene', scene: 11, at: 'hall', text: 'Go through the door', done: { flag: 'mark' }, place: 'hall.heart' },
      { id: 'key', kind: 'scene', scene: 12, at: 'hall', text: 'Find what your key fits', done: { flag: 'custodian.awake' }, place: 'hall.custodian' },
      { id: 'calm', kind: 'scene', scene: 13, at: 'hall', text: 'Hold out your hand to the fox', done: { flag: 'fox.calmed' }, place: 'hall.door' },
      { id: 'heart', kind: 'scene', scene: 14, at: 'hall', text: 'Touch the Heartstone', done: { flag: 'heart.seen' }, place: 'hall.heart' },
      { id: 'sleep', kind: 'sleep', text: 'Sleep until morning', done: { any: [{ event: 'slept' }, { flag: 'night.over' }] }, place: 'camp' },
      { id: 'tamsin', kind: 'scene', scene: 15, at: 'plot', text: 'Show Tamsin your hand', done: { flag: 'night.told' }, gate: true, npc: ['tamsin'] },
    ],
    skip: [
      { flag: 'night.fox' }, { flag: 'door.open' }, { flag: 'mark' }, { flag: 'hall.lit' }, { flag: 'custodian.awake' },
      { flag: 'fox.calmed' }, { flag: 'fox.gone' }, { flag: 'heart.seen' }, { flag: 'night.over' }, { flag: 'night.told' },
      { flag: FLAG.scene(8) }, { flag: FLAG.scene(9) }, { flag: FLAG.scene(10) }, { flag: FLAG.scene(11) }, { flag: FLAG.scene(12) },
      { flag: FLAG.scene(13) }, { flag: FLAG.scene(14) }, { flag: FLAG.scene(15) }, { flag: 'glove' },
      // Ilara's field book comes in scene 14.
      { flag: 'has.almanac' },
    ],
  },

  // ---------------------------------------------------------------------------- chapter 2: the herald
  quest({
    id: 'blessing',
    chapter: 2,
    title: 'The blessing',
    summary: 'The glove keeps your secret for one morning. The head of the Order of the Dawn comes in person.',
    starts: after('night'),
    steps: [
      scene('bell', 16, 'The chapel bell will not stop. Walk out to the path', { at: 'plot', place: 'grant.stone' }),
      choice('pump', ['pump'], 'Set the Order\'s pump running in your field, or leave it in its crate', { at: 'plot', place: 'grant.stone', talk: 'choice.pump', hint: 'The pump is strong, and it dims your Heartstone.' }),
      scene('custodian', 17, 'That evening, hear what the Custodian thinks', { at: 'hall', place: 'hall.heart' }),
    ],
  }, [{ flag: 'custodian.pack' }]),
  quest({
    id: 'kitchen',
    chapter: 2,
    title: 'A kitchen for Hobb',
    summary: 'The woman who raised you turns up at your gate. She wants a kitchen, and beds worth sleeping in.',
    starts: after('blessing'),
    steps: [
      scene('gate', 18, 'Meet Hobb and Dax at your gate', { at: 'plot', place: 'grant.stone' }),
      kitchen('kitchen', 'do', 'Build an oven and a table: a kitchen', { at: 'plot', place: 'grant.center' }),
      kitchen('mosslings', 'watch', 'Watch the mosslings on the wet stones by your pond', { at: 'plot.pond', place: 'grant.rocks', hint: 'The field book draws their page: damp stone, shade, and they pay in moss.' }),
      { id: 'pen', kind: 'do', text: 'Build your first farm from the page', done: { flag: FLAG.farmBuilt('moss') }, gate: true, at: 'plot', place: 'grant.rocks', hint: 'Stones in the shade, your ditch running past them. The tag over it shows its rate.' },
      // The settlement's card: "E" by Hobb, pick a room, and she follows you there (src/game/settlement, `lead`).
      choice('rooms', ['hobb', 'dax'], 'Walk Hobb to her room, then Dax to his', { at: 'plot', place: 'grant.center', hint: 'Press E by Hobb for her card, pick a room, and walk her to it.' }),
      kitchen('beds', 'do', 'Stuff two more beds with moss, under a roof', { at: 'plot', place: 'grant.center' }),
      kitchen('meal', 'do', 'Eat Hobb\'s first meal', { at: 'plot', place: 'grant.center', hint: 'One meal a day gives you extra hearts.' }),
      fight('thistlehog', 2, 'A grey thistlehog roots up your seedlings. Break its guard and calm it', { scene: 19, at: 'plot', place: 'grant.center', hint: 'Hold the left button to attack. When its guard breaks, hold F nearby to calm it.' }),
    ],
  }),
  quest({
    id: 'greywood',
    chapter: 2,
    title: 'The grey wood',
    summary: 'Your fox wants you to follow it. At the forest\'s edge the queen\'s forester guards one boar.',
    starts: after('kitchen'),
    steps: [
      // Done by getting there: Wren's meeting starts as close as a scene's place starts it (NEAR_SCENE).
      { id: 'follow', kind: 'go', text: 'Follow your fox north to the forest', done: { place: 'boar', within: 12, ever: true }, gate: true, at: 'boar', place: 'boar' },
      scene('wren', 20, 'Meet Wren, and the boar she raised', { at: 'boar', place: 'boar' }),
      fight('foxes', 3, 'Three grey foxes. Wren pins two, and the third is yours', { at: 'boar', place: 'foxes', hint: 'Follow the marker west to the foxes. Hold the left button to attack, then hold F nearby when a guard breaks.' }),
      { id: 'boar', kind: 'fight', fight: 4, scene: 21, at: 'boar', place: 'boar', text: 'Hold out your hand to the boar', done: afterwards({ flag: FLAG.fightDenied(4) }, 21), gate: true },
    ],
    // The fox calmed on the first night is the companion by the end of this quest. It is the leaftail pet.
  }, [{ bond: 'leaftail' }]),
  quest({
    id: 'bench',
    chapter: 2,
    title: 'A bench of your own',
    summary: 'Your tool is a guild loan and your jacket is canvas. Everything better than that, you make.',
    starts: after('greywood'),
    steps: [
      bench('jacket', 'do', 'Pad your jacket with shed pelts and moss at the workbench', { at: 'plot', place: 'grant.center', hint: 'One more heart.' }),
      { id: 'posts', kind: 'do', text: 'Set posts along the thistlehog\'s thistles', done: { flag: FLAG.farmBuilt('quill') }, gate: true, at: 'plot', place: 'grant.center', hint: 'It scratches on any post it passes and sheds quills.' },
      bench('kit', 'do', 'Make your kit\'s first quill strip', { at: 'plot', place: 'grant.center', hint: 'What a creature fears at home, it fears in a fight.' }),
    ],
  }),
  quest({
    id: 'copper',
    chapter: 2,
    title: 'Copper in the carrots',
    summary: 'Your fox has been burying things, and something under the ground wants the carrots more than you do.',
    starts: after('bench'),
    steps: [
      copper('hedge', 'do', 'Plant a berry hedge by your fox\'s den', { at: 'plot', place: 'dead.garden' }),
      copper('burrower', 'watch', 'Watch the carrots at night', { at: 'plot', place: 'grant.center', hint: 'It comes up at the darkest carrots it can reach, and never under a light.' }),
      { id: 'bait', kind: 'do', text: 'Build a bait field that brings every burrower to yours', done: { flag: FLAG.farmBuilt('copper') }, gate: true, at: 'plot', place: 'grant.center' },
      choice('take', ['burrowers'], 'Give or take: let the burrowers feed, or dig one out', { at: 'plot', place: 'grant.center', talk: 'choice.burrowers', hint: 'Taking is quick, and it shows.' }),
      copper('bind', 'do', 'Bind your tool in copper and pick its fitting', { at: 'plot', place: 'grant.center' }),
    ],
  }),
  quest({
    id: 'count',
    chapter: 2,
    title: 'Gold on the arches',
    summary: 'Hollowmere has had three thin harvests. That evening the Order lights the road.',
    starts: after('copper'),
    steps: [
      { id: 'road', kind: 'go', text: 'Follow the road to Hollowmere', done: { place: 'town', within: 40, ever: true }, gate: true, at: 'town', place: 'town' },
      scene('queen', 22, 'Meet Queen Maren in the granary', { at: 'town.granary', npc: ['maren'], place: 'granary' }),
      count('sow', 'do', 'Sow her seed, sell the first sacks, and pick a section of her ledger', { at: 'plot', place: 'grant.center', hint: 'The queen takes no wheat from a pumped field.' }),
      scene('relit', 23, 'Dusk on the chapel road', { at: 'arches', place: 'arches' }),
      count('grey', 'watch', 'Morning. Look at the grass under the new gold', { at: 'arches', place: 'arches' }),
      fight('lynx', 5, 'Something grey and quick comes out of that grass', { at: 'arches', place: 'arches', hint: 'Lay a quill strip where its pounce will end, then strike.' }),
      // Gus comes home when the lynx is beaten; the settlement sets the step once he sleeps under a roof.
      count('gus', 'do', 'Bring Gus home and give him a bed', { at: 'plot', npc: ['gus'] }),
    ],
  }, [{ give: 'hoe' }, { give: 'watering_can' }, { give: 'wheat_seeds', count: 12 }]),

  // ---------------------------------------------------------------------------- chapter 3: what the ruins say
  // The three vaults (pump, gallery, seeds) can be done in any order: all three open with the quest of the stone,
  // and the player picks which one the tracker follows. What each vault teaches opens its quest at home.
  quest({
    id: 'echo',
    chapter: 3,
    title: 'What the stone remembers',
    summary: 'A dull stone has been lying under the mural all along. Your hand warms it.',
    starts: after('count'),
    steps: [
      scene('stone', 24, 'Touch the dull stone under the mural', { at: 'hall.mural', place: 'hall.mural' }),
      { id: 'vaults', kind: 'talk', text: 'The Custodian marks three vaults on your map', done: { flag: 'vaults.marked' }, gate: true, at: 'hall', talk: 'talk.vaults', hint: 'Go in any order. Each keeper asks for gear, and each vault for something you carry in.' },
      echo('shrine', 'do', 'Restore the shrine on the hill of the lone oak', { at: 'shrine-oak', place: 'shrine-oak', hint: 'Pick one more heart, or more stamina.' }),
      echo('bees', 'do', 'Set a bee box inside your field, among flowers', { at: 'plot', place: 'grant.center', hint: 'Plant wall to wall and they leave.' }),
      choice('dinner', ['dinner'], 'Dinner. Grant Gus his rested field, or Hobb her window', { at: 'plot', place: 'grant.center', hint: 'Build a dinner table. In the evening sit down to it: the one you grant gives ten hearts. A dinner comes every third evening.' }),
    ],
  }),
  quest({
    id: 'pump',
    chapter: 3,
    title: 'Brass in the river',
    summary: 'South-east, where the great wheel still turns in the river and nobody winds it.',
    starts: after('echo'),
    steps: [
      fight('gearling', 6, 'A gearling at the old mill', { at: 'ruin-mill', place: 'ruin-mill', hint: 'Guild iron slides off its plates. Copper bites.' }),
      pump('marsh', 'go', 'Cross Lantern Marsh to the great wheel', { at: 'pumphouse', place: 'pumphouse' }),
      pump('halls', 'go', 'Go down through the half-flooded halls', { at: 'pumphouse', place: 'pumphouse' }),
      fight('keeper', 7, 'The Sluice Keeper', { at: 'pumphouse', place: 'pumphouse', hint: 'Flood its channel and its wheels stall.' }),
      scene('keystone', 26, 'Take the first keystone', { at: 'pumphouse', place: 'pumphouse' }),
      choice('calla', ['calla'], 'Show Calla the memory stone, or say nothing', { scene: 25, at: 'pumphouse', place: 'pumphouse', talk: 'scene.25' }),
    ],
  }),
  quest({
    id: 'uphill',
    chapter: 3,
    title: 'Water uphill',
    summary: 'Your own machine, built from what the Pump House taught you. It does the pump\'s job and takes nothing.',
    starts: after('pump'),
    steps: [
      uphill('wheel', 'do', 'Set a waterwheel in your stream', { at: 'plot', place: 'grant.center', hint: 'On flat water it makes 4 power, and more where the water drops.' }),
      uphill('pit', 'do', 'Turn the gearlings into an unlit pit', { at: 'plot', place: 'grant.center' }),
      choice('take', ['gearlings'], 'Give or take: push each gearling on, or break one', { at: 'plot', place: 'grant.center', talk: 'choice.gearlings', hint: 'A broken gearling does not come back.' }),
      uphill('slick', 'do', 'Hang a lamp at your pond\'s edge for frog slick', { at: 'plot.pond', place: 'grant.rocks' }),
      uphill('terrace', 'do', 'Water your terrace past what a pumped field gives', { at: 'plot', place: 'grant.center' }),
      { id: 'ledger', kind: 'do', text: 'Fill a section of the queen\'s ledger', done: ledger(1), gate: true, at: 'town.hall', place: 'town.hall' },
      scene('maren', 27, 'Queen Maren walks your rows', { at: 'plot', place: 'grant.center' }),
    ],
  }),
  quest({
    id: 'gallery',
    chapter: 3,
    title: 'The dark gallery',
    summary: 'North-east, under the hill beyond the river, where the only light is wings.',
    starts: after('echo'),
    steps: [
      fight('rootsnare', 8, 'A rootsnare at the mouth of the root caves', { at: 'caves', place: 'caves', hint: 'It holds your companion. Cut the roots, then go for its heart.' }),
      gallery('lamps', 'go', 'Wake the lamps of the Lamp Gallery', { at: 'lampgallery', place: 'lampgallery' }),
      fight('lamplighter', 9, 'The Lamplighter', { at: 'lampgallery', place: 'lampgallery', hint: 'Switch its lamps to blind its beam.' }),
      scene('keystone', 28, 'Take the second keystone', { at: 'lampgallery', place: 'lampgallery' }),
    ],
  }),
  quest({
    id: 'lights',
    chapter: 3,
    title: 'Light that works',
    summary: 'The Gallery\'s lamps switch themselves. Yours can too, and then a farm runs when nobody is there.',
    starts: after('gallery'),
    steps: [
      lights('hatch', 'do', 'Settle the rootsnare under a roof with a hatch', { at: 'plot', place: 'grant.center' }),
      lights('trap', 'do', 'Build a lamp trap over a collector chest', { at: 'plot', place: 'grant.center' }),
      lights('sensors', 'do', 'Make sensors and switchable lamps', { at: 'plot', place: 'grant.center' }),
      lights('ring', 'do', 'Ring your land with lamps, and leave the bait field dark', { at: 'plot', place: 'grant.center' }),
      { id: 'holt', kind: 'watch', text: 'A lamplighter stops at your gate', done: { flag: FLAG.settler('holt') }, gate: true, at: 'plot', place: 'grant.stone' },
      { id: 'ledger', kind: 'do', text: 'Fill another section of the ledger', done: ledger(2), gate: true, at: 'town.hall', place: 'town.hall' },
    ],
  }),
  quest({
    id: 'seeds',
    chapter: 3,
    title: 'Seeds under the roots',
    summary: 'West, deep in the Old Forest, where the roots have made a roof. Calla got there before you.',
    starts: after('echo'),
    steps: [
      seeds('brass', 'do', 'Fit your tool with springs and old brass, and pick its fitting', { at: 'plot', place: 'grant.center', hint: 'The Wild Harvester\'s brass needs it.' }),
      seeds('stair', 'go', 'Wren walks you down the forest stair', { at: 'ruin-stair', place: 'ruin-stair' }),
      seeds('seal', 'go', 'Find Wren\'s way in through the roots', { at: 'seedvault', place: 'seedvault' }),
      fight('harvester', 10, 'The Wild Harvester', { at: 'seedvault', place: 'seedvault', hint: 'Your companion holds the arm while you break the pods.' }),
      scene('keystone', 29, 'Take the third keystone', { at: 'seedvault', place: 'seedvault' }),
    ],
  }),
  quest({
    id: 'itself',
    chapter: 3,
    title: 'A farm that runs itself',
    summary: 'Everything the three vaults taught you, on one hillside. When it works, you can walk away from it.',
    starts: after('seeds', 'uphill', 'lights'),
    steps: [
      itself('arms', 'do', 'Build harvester arms', { at: 'plot', place: 'grant.center' }),
      choice('gus', ['gus'], 'Gus\'s own field: give it an arm, or leave it to Gus', { at: 'plot', npc: ['gus'], talk: 'choice.gus', hint: 'Nobody tells you which is right.' }),
      itself('chutes', 'do', 'Lay chutes down the terrace to a collector chest', { at: 'plot', place: 'grant.center' }),
      itself('stand', 'do', 'Stand back while the terrace runs itself', { at: 'plot', place: 'grant.center' }),
      { id: 'tansy', kind: 'watch', text: 'A beekeeper comes up the road', done: { flag: FLAG.settler('tansy') }, gate: true, at: 'plot', place: 'grant.stone', hint: 'Three bee boxes, and nothing on Take for three days.' },
      { id: 'ledger', kind: 'do', text: 'Fill the last section of the queen\'s ledger', done: ledger(4), gate: true, at: 'town.hall', place: 'town.hall' },
    ],
  }),
  quest({
    id: 'roofs',
    chapter: 3,
    title: 'Three roofs',
    summary: 'A farmer whose field went grey. A ward with sixty years of maps. Three households make a hamlet.',
    starts: after('itself'),
    steps: [
      roofs('houses', 'do', 'Build Gus a house, then a third home', { at: 'plot', place: 'grant.center' }),
      choice('mina', ['mina'], 'Walk Mina to the map room or the survey', { at: 'plot', place: 'grant.center', hint: 'Press E by Mina for her card, pick a room, and walk her to it.' }),
      scene('gate', 30, 'Three lit windows. Under the hill, the first Gate wakes', { at: 'hall', place: 'hall.gate' }),
      fight('boar', 11, 'Go back to the boar with Wren', { scene: 31, at: 'boar', place: 'boar', hint: 'Your Heartstone is 5 now. Break his guard, and be kind to him.' }),
      roofs('yard', 'do', 'Build Wren a beast yard beside water', { at: 'plot', place: 'grant.center' }),
    ],
  }),

  // ---------------------------------------------------------------------------- chapter 4: the Rootworks
  quest({
    id: 'keystones',
    chapter: 4,
    title: 'Three keystones',
    summary: 'North, inside the grey forest: giant terraces wrapped in roots, and a round gate with three sockets.',
    starts: after('roofs'),
    steps: [
      keystones('tusk', 'do', 'Make tusk and root gear, and a climbing rope', { at: 'plot', place: 'grant.center' }),
      scene('gate', 32, 'Set the three keystones in the Old Gate', { at: 'terraces', place: 'terraces' }),
      keystones('climb', 'go', 'Climb down the Rootworks on your own rope', { at: 'terraces', place: 'terraces' }),
      keystones('machines', 'do', 'Rebuild each level\'s dead machine', { at: 'terraces', place: 'terraces', hint: 'A wheel, a lamp on a sensor, an arm. The root lock opens for each.' }),
    ],
  }),
  quest({
    id: 'stag',
    chapter: 4,
    title: 'The Verdant Stag',
    summary: 'A god as tall as an oak, chained standing for a thousand years. You are not here to beat it.',
    starts: after('keystones'),
    steps: [
      { id: 'chains', kind: 'fight', fight: 12, at: 'terraces', place: 'terraces', talk: 'scene.33.before', text: 'The chains: break four pins', done: { flag: FLAG.fightPhase(12), atLeast: 1 }, gate: true },
      { id: 'overgrowth', kind: 'fight', fight: 12, at: 'terraces', place: 'terraces', text: 'The overgrowth: light the hall', done: { flag: FLAG.fightPhase(12), atLeast: 2 }, gate: true },
      fight('collar', 12, 'The collar: climb and break the last chain', { at: 'terraces', place: 'terraces' }),
      scene('bow', 33, 'It lowers its head to you', { at: 'terraces', place: 'terraces' }),
    ],
  }),

  // ---------------------------------------------------------------------------- chapter 5: the pilgrimage
  quest({
    id: 'green',
    chapter: 5,
    title: 'Green overnight',
    summary: 'In the morning the grey wood is green to the last leaf, and one band of the Dawn has gone thin.',
    starts: after('stag'),
    steps: [
      scene('north', 34, 'Look north. Then the queen is at your gate with a charter', { at: 'plot', place: 'grant.stone' }),
      { id: 'valley', kind: 'do', text: 'Take the valley round your door', done: { flag: FLAG.settlementStep, is: 'freehold' }, gate: true, at: 'plot', place: 'grant.center' },
      green('level', 'go', 'The second level of the Hall opens', { at: 'hall', place: 'hall.heart' }),
      scene('dream', 35, 'Sleep. For the first time since the door opened, you dream', { at: 'plot', place: 'camp' }),
    ],
  }),
  quest({
    id: 'pilgrimage',
    chapter: 5,
    title: 'The pilgrimage',
    summary: 'Everyone in the valley is on the green. The kindest woman in the world sends you west.',
    starts: after('green'),
    steps: [
      scene('blessing', 36, 'The second blessing, on Hollowmere\'s green', { at: 'town', place: 'town.square' }),
      scene('stag', 37, 'On the terraces, the Stag watches her go', { at: 'terraces' }),
      scene('goodbye', 38, 'Say goodbye at your gate', { at: 'plot', place: 'grant.stone' }),
      pilgrimage('pack', 'do', 'Pack for the road', { at: 'plot', place: 'grant.center', hint: 'Travel meals from Hobb, a full kit and rope.' }),
      pilgrimage('west', 'go', 'Walk west on the High Road', { at: 'highroad', place: 'highroad' }),
    ],
  }),
];

/** The last quest of the act. Its end is the end card. */
export const LAST_QUEST: QuestId = 'pilgrimage';

/** The chapter the story is in: that of the latest quest, in the act's order, that has started. 1 before any. */
export function chapterOf(started: (quest: QuestId) => boolean): Chapter {
  for (let i = QUESTS.length - 1; i >= 0; i--) if (started(QUESTS[i].id)) return QUESTS[i].chapter;
  return 1;
}

/** Wheat in the bag, in seed and in the ground can no longer make twenty. The play checks' never-stuck rule reads it. */
export const WHEAT_SHORT: Condition = { short: 'wheat', of: 20, seed: 'wheat_seeds', crop: 'wheat', perSeed: 2 };
