// Every kind of creature, as data. The engine in src/game/creatures runs each kind from its entry here,
// so adding a creature is adding an entry: no engine change.
//
// Distances are in blocks. "Within n blocks" of a block means a box of n blocks each way around it,
// and never more than 4 blocks up or down.

/** Something that is true or false about one creature where it stands. */
export type CreatureCondition =
  | { kind: 'always' }
  /** The block under it is this one. */
  | { kind: 'on'; block: string }
  /** A block of this key is within `within` blocks of it. */
  | { kind: 'near'; block: string; within: number }
  /**
   * The ground under it is damp: a water block within `water` blocks of that ground, or ground within
   * `water` blocks that was watered in the last `lasts` seconds, or rain in the last `lasts` seconds.
   */
  | { kind: 'damp'; water: number; lasts: number };

export interface CreatureKind {
  id: string;
  name: string;
  /** A sprite name from public/assets/manifest.json. */
  sprite: string;

  /** Where and when a new one appears. */
  appears: {
    /** The block it looks for, by key from src/content/blocks.ts. */
    block: string;
    /** How far from that block it may appear. 0 means standing on it. */
    within: number;
    /** The lowest and highest light at the spot, 0 to 15. Sky light counts at full strength at night too. */
    light: [number, number];
    /** How many can be alive at once. */
    max: number;
    /** It looks for the block around a named place from the region, or around the player. */
    around: { place: string } | 'player';
    /** How far from that place or the player it looks. */
    radius: number;
    /** Seconds between two arrivals. */
    every: number;
  };

  /** How it moves. */
  moves: {
    /** A walker follows the ground and never drops more than one block. A flyer keeps `hover` above ground or water. */
    mode: 'walk' | 'fly';
    /** It stays within this many blocks of the spot where it appeared. */
    radius: number;
    /** Blocks a second. */
    speed: number;
    /** The shortest and longest rest between two walks, in seconds. */
    pause: [number, number];
    /** The chance, 0 to 1, that its next walk goes back to the spot where it appeared. */
    home: number;
    /** Flyers only: how high it floats above the ground or the water. */
    hover?: number;
    /**
     * A block that draws it. When one is within `within` blocks of the spot where it appeared, it goes
     * to the nearest one with this chance each time it picks where to go, and `radius` no longer holds it.
     */
    toward?: { block: string; within: number; chance: number };
  };

  /** What it runs from. It flees while the thing is closer than `within`. */
  fears: { of: 'player'; within: number }[];

  /**
   * What it leaves, or null. It is ready `every` seconds after the last one and leaves it as soon as
   * `when` holds. The item reaches the player's bag only when the player is within `reach` blocks.
   */
  gives: { item: string; every: number; when: CreatureCondition; reach: number } | null;

  /** The part of the day it is out, as times of day from 0 to 1. `from` may be later than `to` for a night. Null is always. */
  awake: { from: number; to: number } | null;

  /**
   * What watching it teaches. A fact is learned when `seeing` has held for `seconds` in a row while the
   * player is within `within` blocks. `seeing: 'gives'` is learned the moment it leaves its item in sight.
   */
  watch: {
    /** A page id from content/almanac.ts. */
    page: string;
    within: number;
    facts: { fact: string; seeing: CreatureCondition | 'gives'; seconds?: number }[];
  } | null;
}

export const CREATURES: readonly CreatureKind[] = [
  {
    id: 'mossling',
    name: 'Mossling',
    sprite: 'critter',
    // Shade is any spot the open sky does not reach straight down: 14 or less.
    appears: { block: 'mossy_stone', within: 0, light: [0, 14], max: 3, around: { place: 'grant.rocks' }, radius: 10, every: 2 },
    moves: { mode: 'walk', radius: 6, speed: 1.1, pause: [3, 6], home: 0.45, toward: { block: 'water', within: 6, chance: 0.3 } },
    fears: [],
    gives: { item: 'moss_tuft', every: 20, when: { kind: 'damp', water: 2, lasts: 180 }, reach: 10 },
    awake: null,
    watch: {
      page: 'mossling',
      within: 10,
      facts: [
        { fact: 'needs', seeing: { kind: 'on', block: 'mossy_stone' }, seconds: 3 },
        { fact: 'gives', seeing: 'gives' },
      ],
    },
  },
  {
    id: 'lanternfly',
    name: 'Lanternfly',
    sprite: 'lanternfly',
    appears: { block: 'water', within: 12, light: [0, 15], max: 6, around: 'player', radius: 12, every: 3 },
    moves: { mode: 'fly', radius: 5, speed: 1.4, pause: [0.5, 2], home: 0.1, hover: 1.6, toward: { block: 'lamp', within: 12, chance: 1 } },
    fears: [],
    gives: null,
    // Out from dusk, so the festival evening has them, until just before sunrise.
    awake: { from: 0.72, to: 0.24 },
    watch: {
      page: 'lanternfly',
      within: 10,
      facts: [
        { fact: 'needs', seeing: { kind: 'always' }, seconds: 3 },
        { fact: 'gives', seeing: { kind: 'near', block: 'lamp', within: 3 }, seconds: 3 },
      ],
    },
  },
];
