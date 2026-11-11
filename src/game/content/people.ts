// The people of Hollowmere, as data. The people system walks them through their routines.
// Places are names from the region. Lines of dialogue live with the talk system.

export interface RoutineStop {
  /** The hour of the day this stop begins, 0 to 24. It holds until the next stop's hour. */
  hour: number;
  place: string;
  /** Blocks east and south of the place to stand at, so "nearby" needs no place of its own. */
  offset?: { x: number; z: number };
}

export interface PersonDef {
  id: string;
  name: string;
  /** A sprite and a portrait name from the manifest. */
  sprite: string;
  portrait: string;
  /** A voice id for the sound engine. */
  voice: string;
  /** Background resident assigned a unique appearance at world creation. */
  crowd?: boolean;
  /** Stops in order of hour. Before the first hour of a day, the last stop still holds. */
  routine: RoutineStop[];
  /** Stays at this place, whatever the hour, until the flag is set. */
  stay?: { place: string; until: string };
  /** Ignores the hours and walks to another of these places every `every` seconds, give or take a quarter. */
  wander?: { places: string[]; every: number; spread: number };
}

const at = (place: string): RoutineStop[] => [{ hour: 0, place }];

const named = (id: string, name: string, routine: RoutineStop[], extra: Partial<PersonDef> = {}): PersonDef => ({
  id, name, sprite: id, portrait: id, voice: id, routine, ...extra,
});

const TOWN_WALK = ['town.square', 'river.bank', 'town.gate'];

const villager = (n: number, name: string, kind: 'a' | 'b', every: number): PersonDef => ({
  id: `villager-${n}`,
  crowd: true,
  name,
  sprite: `villager-${kind}`,
  portrait: `villager-${kind}`,
  voice: `villager-${kind}`,
  routine: at('town.square'),
  wander: { places: TOWN_WALK, every, spread: 4 },
});

export const PEOPLE: readonly PersonDef[] = [
  named('tamsin', 'Tamsin', [
    { hour: 6, place: 'lodge' },
    { hour: 20, place: 'lodge', offset: { x: 3, z: 2 } },
  ], { stay: { place: 'grant.stone', until: 'quest.plot.done' } }),
  named('maren', 'Maren', at('granary')),
  named('odo', 'Odo', at('bakery')),
  named('gus', 'Gus', at('gus.field')),
  named('mira', 'Mira', at('carpenter')),
  named('wren', 'Wren', at('kennel')),
  named('juniper', 'Juniper', at('town.square'), { wander: { places: ['town.square', 'river.bank'], every: 150, spread: 2 } }),
  named('brack', 'Brack', at('ferry')),
  villager(1, 'Pell', 'a', 70),
  villager(2, 'Anwen', 'b', 85),
  villager(3, 'Corin', 'a', 100),
  villager(4, 'Hesper', 'b', 115),
  villager(5, 'Dunn', 'a', 130),
  villager(6, 'Isolde', 'b', 145),
  villager(7, 'Nessa', 'a', 95),
  villager(8, 'Roan', 'b', 110),
  villager(9, 'Pip', 'a', 125),
  villager(10, 'Bryn', 'b', 140),
];

/** Blocks a second. */
export const WALK_SPEED = 2.2;
/** Someone further than this from the player does not walk. They jump to where the routine has them. */
export const WALK_RANGE = 60;
/** Someone standing this close to the player turns to face them. */
export const FACE_RANGE = 3;
/** How close the player must be for "Talk to" to show. */
export const TALK_RANGE = 2.5;

/** One appearance per resident, shuffled once by the world's seeded random stream. */
export const CROWD_SPRITES = ['villager-a', 'villager-b', 'town-pell', 'town-corin', 'town-hesper', 'town-dunn', 'town-isolde', 'town-nessa', 'town-roan', 'town-pip'] as const;

export const JOB_BARKS: Readonly<Record<string, string>> = {
  'town-pell': "Fish took my bait. Left me the hook. Polite of them.",
  'town-corin': "Pears are a penny. Advice is free. Pears are better.",
  'town-hesper': "River gets the mud out. Keeps the gossip.",
  'town-dunn': "Quiet watch today. Even the geese let me pass.",
  'town-isolde': "A page missing. Right where the answer ought to be.",
  'town-nessa': "Sit a minute. The work will wait. Mine always has.",
  'town-roan': "Gus says the rows are crooked. Wheat hasn't complained.",
  'town-pip': "Mira let me sort the nails. Bent ones have their own pot.",
};
