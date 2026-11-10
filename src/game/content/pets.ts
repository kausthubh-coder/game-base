// Pets, as data. The pets system reads every number here.

export interface PetDef {
  kind: string;
  name: string;
  /** A sprite name from the manifest. */
  sprite: string;
  /** The named place a wild one lives at. */
  home: string;
  /** Spots it walks between while wild, in blocks east and south of its home. */
  beds: { x: number; z: number }[];
  /** Seconds it rests at a bed before walking to the next: the least and the most. */
  rest: [min: number, max: number];
  /** The item it eats. Any item marked as a treat works too. */
  treat: string;
  /** Feedings until it bonds. */
  trustToBond: number;
  /** The flag set when it bonds. */
  bondedFlag: string;
  startle: {
    /** The player startles it by moving faster than this many blocks a second... */
    speed: number;
    /** ...within this many blocks. */
    within: number;
    /** How far it backs off. */
    backOff: number;
    /** Seconds it will not eat afterwards. */
    wary: number;
  };
  feed: {
    /** How close the player must be. */
    within: number;
    /** Seconds the player must have stood still. */
    still: number;
    /** Seconds it eats, with a heart over it. It takes nothing more until it is done. */
    eats: number;
    /** The words after "E:" while the player has a treat. */
    prompt: string;
  };
  follow: {
    /** A bonded pet stays this close. */
    within: number;
    /** Further than this it runs. */
    runBeyond: number;
    /** Further than this it appears beside the player. */
    appearBeyond: number;
  };
  /** Blocks a second: tending its beds, keeping up with a walking player, running. */
  speed: { walk: number; trot: number; run: number };
  /** What a bonded one digs up while the player stands on this surface. */
  finds: { item: string; surface: string; every: [min: number, max: number]; toast: string };
}

export const PETS: readonly PetDef[] = [
  {
    kind: 'leaftail',
    name: 'Leaftail',
    sprite: 'leaftail',
    home: 'dead.garden',
    beds: [{ x: -3, z: -2 }, { x: 3, z: -2 }, { x: 3, z: 3 }, { x: -3, z: 3 }, { x: 0, z: 0 }],
    rest: [3, 6],
    treat: 'berry',
    trustToBond: 3,
    bondedFlag: 'pet.leaftail.bonded',
    startle: { speed: 2.4, within: 6, backOff: 6, wary: 15 },
    feed: { within: 3, still: 1, eats: 3, prompt: 'Offer a berry' },
    follow: { within: 3, runBeyond: 4, appearBeyond: 30 },
    speed: { walk: 1.4, trot: 5, run: 7.5 },
    finds: { item: 'wheat_seeds', surface: 'grass', every: [50, 70], toast: 'Your leaftail found a seed.' },
  },
];
