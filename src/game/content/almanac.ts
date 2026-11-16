// The Almanac's pages, as data. Each page has facts in two columns: what the thing needs and what it gives.
// The engine in src/game/almanac turns this into the book, and adding a page is adding an entry.
//
// A fact is learned in one of three ways:
//   1. `on`: an event arrives whose fields match `where`.
//   2. A flag named `fact.<page>.<fact>` becomes true. Dialogue teaches people's facts this way.
//   3. Another system calls `almanac.learn(page, fact)`. The creatures engine does, from the `watch`
//      entries in content/creatures.ts.

import type { EventName } from '../api.sim.ts';
import type { ItemId } from './ids.ts';

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
export const ALMANAC_BOOK: { flag: string; item: ItemId } = { flag: 'has.almanac', item: 'almanac' };

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
  // The field book's creature pages (handbook chapter 30). Watching a farm's creatures teaches what they come to
  // and what they fear, a good dropped in sight teaches what they give, and a farm that runs proves the rule.
  {
    id: 'mossling',
    title: 'Mossling',
    picture: 'mossling',
    kind: 'creature',
    facts: [
      { id: 'comes', column: 'needs', text: 'Comes to: damp mossy stone in shade.' },
      { id: 'fears', column: 'needs', text: 'Fears: dry ground and the open sun.' },
      { id: 'gives', column: 'gives', text: 'Gives: moss fiber, 10 a day each.' },
      { id: 'proved', column: 'gives', text: 'Proved: a fed pair brings a third.' },
    ],
  },
  {
    id: 'burrower',
    title: 'Burrower',
    picture: 'burrower',
    kind: 'creature',
    facts: [
      { id: 'comes', column: 'needs', text: 'Comes to: the darkest carrots it can reach, at night.' },
      { id: 'fears', column: 'needs', text: 'Fears: light. It will not come near a lamp.' },
      { id: 'gives', column: 'gives', text: 'Gives: copper, 1 a block every two days.' },
      { id: 'proved', column: 'gives', text: 'Proved: it surfaces at the darkest carrots in reach.' },
    ],
  },
  {
    id: 'gearling',
    title: 'Gearling',
    picture: 'gearling',
    kind: 'creature',
    facts: [
      { id: 'comes', column: 'needs', text: 'Comes to: any running machine within sixteen blocks.' },
      { id: 'fears', column: 'needs', text: 'Fears: nothing. Fences turn it.' },
      { id: 'gives', column: 'gives', text: 'Gives: a gear spring for each pit it stops in.' },
      { id: 'proved', column: 'gives', text: 'Proved: it stops dead where there is no light.' },
    ],
  },
  {
    id: 'frog',
    title: 'Frog',
    picture: 'frog',
    kind: 'creature',
    facts: [
      { id: 'comes', column: 'needs', text: 'Comes to: the bank under a lamp.' },
      { id: 'fears', column: 'needs', text: 'Fears: nothing on its own pond.' },
      { id: 'gives', column: 'gives', text: 'Gives: frog slick, 2 for each frog fed.' },
      { id: 'proved', column: 'gives', text: 'Proved: it eats any lanternfly within three blocks.' },
    ],
  },
  {
    id: 'bee',
    title: 'Bee',
    picture: 'bee',
    kind: 'creature',
    facts: [
      { id: 'comes', column: 'needs', text: 'Comes to: every flower within ten blocks.' },
      { id: 'fears', column: 'needs', text: 'Fears: a field planted wall to wall, and a farm on Take.' },
      { id: 'gives', column: 'gives', text: 'Gives: honey and wax, 4 a day a box.' },
      { id: 'proved', column: 'gives', text: 'Proved: crops they visit ripen faster.' },
    ],
  },
  {
    id: 'thistlehog',
    title: 'Thistlehog',
    picture: 'thistlehog-calmed',
    kind: 'creature',
    facts: [
      { id: 'comes', column: 'needs', text: 'Comes to: its strip of thistles, and any post on it.' },
      { id: 'fears', column: 'needs', text: 'Fears: a sudden noise. It bolts in a straight line.' },
      { id: 'gives', column: 'gives', text: 'Gives: quills, 6 a day at a walk, 18 at a run.' },
      { id: 'proved', column: 'gives', text: 'Proved: a clapper sends it past every post at a run.' },
    ],
  },
  {
    id: 'rootsnare',
    title: 'Rootsnare',
    picture: 'rootsnare-calmed',
    kind: 'creature',
    facts: [
      { id: 'comes', column: 'needs', text: 'Comes to: a roof with a hatch.' },
      { id: 'fears', column: 'needs', text: 'Fears: the dark. It grows nothing shut in.' },
      { id: 'gives', column: 'gives', text: 'Gives: vine rope, 2 a day.' },
      { id: 'proved', column: 'gives', text: 'Proved: it sleeps in sunlight, and grows vine while it sleeps.' },
    ],
  },
  {
    id: 'bramble',
    title: 'Bramble',
    picture: 'boar-calmed',
    kind: 'creature',
    facts: [
      { id: 'comes', column: 'needs', text: 'Comes to: Wren, and the strip she walks him.' },
      { id: 'fears', column: 'needs', text: 'Fears: nothing that has not hurt him.' },
      { id: 'gives', column: 'gives', text: 'Gives: tilled ground, old brass and tusk tips.' },
      { id: 'proved', column: 'gives', text: 'Proved: he roots up whatever ground he walks on.' },
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
    picture: 'lanternfly-world',
    kind: 'creature',
    facts: [
      { id: 'comes', column: 'needs', text: 'Comes to: the brightest light within twelve blocks, at night.' },
      { id: 'fears', column: 'needs', text: 'Fears: nothing. A frog eats it.' },
      { id: 'gives', column: 'gives', text: 'Gives: glow dust in a lamp trap, 10 on a dry night.' },
      { id: 'proved', column: 'gives', text: 'Proved: every lamp in reach takes a share of the flies.' },
    ],
  },
  person('tamsin', 'Tamsin', 'To see one plot kept', 'The Almanac, an axe and dry advice'),
  person('maren', 'Queen Maren', 'Bread for the winter', 'Thanks, and one good meal'),
  person('gus', 'Gus', 'Rain', 'A hoe, a watering can and wheat seeds'),
  person('wren', 'Keeper Wren', 'Every pet fed', 'A kind word, to your pet first'),
];
