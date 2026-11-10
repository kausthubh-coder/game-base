// The Almanac's pages, as data. Each page has facts in two columns: what the thing needs and what it gives.
// The engine in src/game/almanac turns this into the book, and adding a page is adding an entry.
//
// A fact is learned in one of three ways:
//   1. `on`: an event arrives whose fields match `where`.
//   2. A flag named `fact.<page>.<fact>` becomes true. Dialogue teaches people's facts this way.
//   3. Another system calls `almanac.learn(page, fact)`. The creatures engine does, from the `watch`
//      entries in content/creatures.ts.

import type { EventName } from '../api.sim.ts';

export interface AlmanacTrigger {
  event: EventName;
  /**
   * Fields the event must carry. A value matches when it is equal, or when it is one part of an id such
   * as `pet:leaftail:1`. `crop` on an event that has no crop field is looked up from the soil block, and
   * `pet` also matches the kind of the pet with that id.
   */
  where?: Record<string, string | number>;
}

export interface AlmanacFactDef {
  id: string;
  column: 'needs' | 'gives';
  text: string;
  on?: AlmanacTrigger[];
}

export interface AlmanacPageDef {
  id: string;
  title: string;
  /** A sprite, portrait or icon name. */
  picture: string;
  kind: 'creature' | 'pet' | 'crop' | 'person' | 'place';
  facts: AlmanacFactDef[];
  /** Events that put the page in the book with its facts still hidden. Learning a fact does that too. */
  meetOn?: AlmanacTrigger[];
}

/**
 * The player has the book once this flag is set or this item is in the bag. Watching a creature teaches
 * nothing before that, so the first lesson waits for Tamsin. Flags, events and `learn` calls always teach.
 */
export const ALMANAC_BOOK = { flag: 'has.almanac', item: 'almanac' };

/** A person's page: met when a conversation with them starts, taught by the flags the dialogue sets. */
const person = (id: string, title: string, needs: string, gives: string): AlmanacPageDef => ({
  id,
  title,
  picture: id,
  kind: 'person',
  meetOn: [{ event: 'talk.started', where: { npc: id } }],
  facts: [
    { id: 'needs', column: 'needs', text: needs },
    { id: 'gives', column: 'gives', text: gives },
  ],
});

export const ALMANAC: readonly AlmanacPageDef[] = [
  {
    id: 'mossling',
    title: 'Mossling',
    picture: 'critter',
    kind: 'creature',
    facts: [
      { id: 'needs', column: 'needs', text: 'Shade and mossy stone' },
      { id: 'gives', column: 'gives', text: 'A moss tuft, when the ground under it is damp' },
    ],
  },
  {
    id: 'leaftail',
    title: 'Leaftail',
    picture: 'pet',
    kind: 'pet',
    meetOn: [
      { event: 'pet.startled', where: { pet: 'leaftail' } },
      { event: 'pet.fed', where: { pet: 'leaftail' } },
    ],
    facts: [
      { id: 'needs', column: 'needs', text: 'Berries, and a slow step', on: [{ event: 'pet.fed', where: { pet: 'leaftail' } }] },
      { id: 'gives', column: 'gives', text: 'Its company, and seeds it digs up for you', on: [{ event: 'pet.bonded', where: { pet: 'leaftail' } }] },
    ],
  },
  {
    id: 'wheat',
    title: 'Wheat',
    picture: 'wheat',
    kind: 'crop',
    meetOn: [{ event: 'crop.planted', where: { crop: 'wheat' } }],
    facts: [
      { id: 'needs', column: 'needs', text: 'Tilled soil, kept wet', on: [{ event: 'crop.watered', where: { crop: 'wheat' } }] },
      { id: 'time', column: 'needs', text: 'Time: four stages in wet soil', on: [{ event: 'crop.grew', where: { crop: 'wheat' } }] },
      { id: 'gives', column: 'gives', text: 'Two wheat when ripe, and sometimes a seed', on: [{ event: 'crop.harvested', where: { crop: 'wheat' } }] },
    ],
  },
  {
    id: 'lanternfly',
    title: 'Lanternfly',
    picture: 'lanternfly',
    kind: 'creature',
    facts: [
      { id: 'needs', column: 'needs', text: 'Night, and water close by' },
      { id: 'gives', column: 'gives', text: 'Its glow, gathered around a lit lamp' },
    ],
  },
  person('tamsin', 'Tamsin', 'To see one plot kept', 'The Almanac, an axe and dry advice'),
  person('maren', 'Queen Maren', 'Bread for the winter', 'Thanks, and one good meal'),
  person('odo', 'Odo', 'His oven lit before dawn', 'A river lamp for the festival'),
  person('gus', 'Gus', 'Rain', 'A hoe, a watering can and wheat seeds'),
  person('mira', 'Mira', 'Something to measure', 'Your measurements, asked for or not'),
  person('wren', 'Keeper Wren', 'Every pet fed', 'A kind word, to your pet first'),
  person('juniper', 'Juniper', 'Sweets', 'Secrets, for a price'),
  person('brack', 'Brack', 'His river back', 'News from downriver'),
];
