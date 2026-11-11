// The fight lab's numbers, as data: the hero's moves, the beasts and their attacks, the pets and the rigs.
// `src/game/fight` reads every number here. They are the starting values of the research notes
// (game-look-test/design/research_notes/game-design/05 and 08), to be tuned by playing.
//
// Seconds, blocks and blocks a second throughout. A time that names frames in the notes is that many
// sixtieths of a second here.

/** Who does the hitting: the three ways to fight the lab compares. */
export type Way = 'hero' | 'pet' | 'world';
export const WAYS: readonly Way[] = ['hero', 'pet', 'world'];

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------------------- the hero

export const HERO = {
  health: 100,
  stamina: 100,
  /** Stamina that comes back each second, once this long has passed since it was last spent. */
  staminaBack: 20,
  staminaWait: 1,
  /** A cut: 6 frames before it can land, then 18 frames of recovery. The next cut may start after `chain`, a dodge after `cancel`. */
  cut: { startup: 0.1, total: 0.4, chain: 0.2, cancel: 0.15, reach: 2.2, arc: 150 * DEG, guard: 10, pace: 0.25 },
  /** The charged spin: hold the button this long, let go, and it hits everything around. */
  spin: { hold: 0.6, startup: 0.05, total: 0.55, cancel: 0.4, reach: 2.5, guard: 30 },
  /** The dodge travels 3.5 blocks. Nothing hits the hero for the first `safe` seconds of it. */
  dodge: { time: 0.35, safe: 0.3, speed: 10, cost: 25, after: 0.1 },
  /** After a hit: the stagger, how long nothing else can hit, and the push as blocks over seconds. */
  hurt: { stagger: 0.25, safe: 0.6, push: 0.8, pushTime: 0.15, heavyPush: 2, heavyPushTime: 0.25 },
  /** Holding out the Mark: how near a dizzy beast must be, and how long the hold takes. */
  calm: { reach: 3.5, hold: 1 },
  /** The Mark's light, thrown at the pointer. Each hit chips the guard and leaves a mark the pet's next strike spends. */
  bolt: { speed: 20, range: 12, rest: 0.45, guard: 3, marks: 3, markTime: 4, pose: 0.2, pace: 0.6 },
  /** Seconds on the ground after fainting, and seconds nothing can hit the hero after waking. */
  faint: 2,
  wakeSafe: 1.5,
  /** A cut turns to face a beast this close to the aim: within reach plus `near` blocks and `angle` of the pointer. */
  magnet: { near: 1, angle: 35 * DEG },
  /** A press that cannot act yet is kept this long and acts as soon as it can. */
  buffer: 0.2,
  /** The hero's own walking speed, for the sim when nothing else moves the body. */
  walk: 4.4,
  /** A hit lands when the point at the hero's feet, grown by this, is inside the shape. */
  body: 0.15,
} as const;

// ---------------------------------------------------------------------------------------- beasts

export interface AttackDef {
  id: string;
  /** What is drawn on the ground before it lands. */
  shape: 'circle' | 'line' | 'cone';
  /** A circle's radius, a cone's reach, a line's length. */
  reach: number;
  /** A line's width, or half a cone's angle in radians. Unused for a circle. */
  width: number;
  /** Seconds the shape shows before the attack lands. */
  lead: number;
  /** Seconds the beast stands open afterwards. */
  recover: number;
  damage: number;
  /** A heavy hit pushes the hero further. */
  heavy: boolean;
  /** A line only: the beast runs down it at this speed when it lands. 0 for an attack that does not move the beast. */
  charge: number;
  /** It is picked when the target is between these distances from the beast's middle. */
  from: number;
  to: number;
  /** Seconds before the same attack is picked again. */
  rest: number;
  /** The attack that follows at once, by id. */
  then?: string;
  /** True for an attack that only ever follows another. */
  follows?: boolean;
}

export interface BeastDef {
  kind: string;
  name: string;
  /** Its Blight depth, shown by its name. The Mark's reach compares it with the Heartstone. */
  depth: number;
  /** True for a guardian machine: it is shut down, not calmed. */
  machine: boolean;
  radius: number;
  /** Blocks a second while it closes in. */
  speed: number;
  guard: number;
  /** The guard's parts. Each one that empties is kept, and staggers the beast. */
  segments: number;
  /** Seconds it stays dizzy with an empty guard, waiting for the Mark. */
  dizzy: number;
  /** The share of its whole guard that one rig, or one crash into a wall, breaks. */
  rigShare: number;
  /** Seconds it is helpless after running into a wall. */
  crash: number;
  /** True when a lit lamp draws its charge. */
  drawnToLight: boolean;
  /** It wakes when the hero comes this close. */
  wakes: number;
  attacks: readonly AttackDef[];
  /** What it leaves when it is calmed. */
  gift: string;
  /** Its rules, as the Almanac would list them. */
  rules: readonly string[];
}

export const BEASTS: readonly BeastDef[] = [
  {
    kind: 'thistlehog', name: 'Blighted thistlehog', depth: 1, machine: false,
    radius: 0.45, speed: 2.6, guard: 60, segments: 1, dizzy: 3, rigShare: 1 / 2, crash: 2, drawnToLight: false, wakes: 6,
    attacks: [
      { id: 'needles', shape: 'circle', reach: 3, width: 0, lead: 0.9, recover: 1.5, damage: 10, heavy: false, charge: 0, from: 0, to: 2.3, rest: 1 },
    ],
    gift: 'Quills',
    rules: ['It puffs up, then throws needles in a ring around itself.', 'It is dizzy for a moment after it fires.', 'It will not cross water.'],
  },
  {
    kind: 'gearling', name: 'Gearling', depth: 2, machine: true,
    radius: 0.5, speed: 3, guard: 90, segments: 1, dizzy: 3, rigShare: 1 / 2, crash: 2, drawnToLight: true, wakes: 7,
    attacks: [
      { id: 'charge', shape: 'line', reach: 8, width: 1.2, lead: 1, recover: 0, damage: 12, heavy: false, charge: 12, from: 3, to: 9, rest: 1.5, then: 'spin' },
      { id: 'spin', shape: 'circle', reach: 1.5, width: 0, lead: 0.6, recover: 1.5, damage: 10, heavy: false, charge: 0, from: 0, to: 2.2, rest: 2.5 },
    ],
    gift: 'Gear springs',
    rules: ['It winds its key, then charges in a straight line.', 'It spins once where the charge ends.', 'A charge into a wall leaves it helpless.', 'It charges at light. It will not cross water.'],
  },
  {
    kind: 'boar', name: 'The Blighted boar', depth: 5, machine: false,
    radius: 1.3, speed: 3.2, guard: 300, segments: 3, dizzy: 4, rigShare: 1 / 3, crash: 2.5, drawnToLight: true, wakes: 9,
    attacks: [
      { id: 'charge', shape: 'line', reach: 12, width: 2.6, lead: 1.3, recover: 1.4, damage: 22, heavy: true, charge: 13, from: 4.5, to: 13, rest: 2.5 },
      { id: 'tusks', shape: 'cone', reach: 4, width: 60 * DEG, lead: 0.9, recover: 1.2, damage: 14, heavy: false, charge: 0, from: 0, to: 4.2, rest: 1.5 },
      { id: 'stomp', shape: 'circle', reach: 4.2, width: 0, lead: 1.3, recover: 1.5, damage: 20, heavy: true, charge: 0, from: 0, to: 3.4, rest: 3 },
    ],
    gift: 'A tusk',
    rules: ['It paws the ground, then charges in a wide line.', 'Close up it sweeps its tusks in front, or stamps a wide ring.', 'Its guard has three parts. Each part you break stays broken.', 'It charges at light. It will not cross water.'],
  },
];

export const beastOf = (kind: string): BeastDef => {
  const def = BEASTS.find((b) => b.kind === kind);
  if (!def) throw new Error(`fight: there is no beast called "${kind}". There are: ${BEASTS.map((b) => b.kind).join(', ')}.`);
  return def;
};

/** Seconds a beast stands alert after it wakes, before it does anything. */
export const WAKE_PAUSE = 0.8;
/** Seconds it staggers when a part of its guard breaks. */
export const SEGMENT_STAGGER = 1.5;
/** Seconds it stands at the edge of water its charge would have crossed. */
export const WATER_STALL = 1.2;
/** The share of its guard a beast gets back when nobody calms it in time. */
export const DIZZY_BACK = 1 / 3;
/** A landed shape stays on the ground this long, as a flash. */
export const SHAPE_AFTER = 0.18;
/** Gentle: every lead time is this much longer and every hit on the hero this much weaker. */
export const GENTLE = { lead: 1.5, damage: 0.5 } as const;

// ---------------------------------------------------------------------------------------- pets

export interface PetSkill {
  id: 'pounce' | 'distract' | 'brace';
  name: string;
  /** Seconds before it can be called again. */
  rest: number;
  /** Guard a pounce breaks, before marks. */
  guard: number;
  /** Seconds a distraction or a brace lasts. */
  time: number;
}

export interface FightPetDef {
  kind: string;
  name: string;
  /** Blocks a second when it runs in or back. */
  speed: number;
  /** Hits it takes before it faints. */
  hearts: number;
  /** Guard one strike breaks, and seconds between strikes. */
  strike: number;
  every: number;
  /** Seconds it rests after fainting. */
  rest: number;
  skills: readonly [PetSkill, PetSkill];
}

export const FIGHT_PETS: readonly FightPetDef[] = [
  {
    kind: 'leaftail', name: 'Leaftail', speed: 7.5, hearts: 3, strike: 6, every: 0.9, rest: 8,
    skills: [
      { id: 'pounce', name: 'Pounce', rest: 6, guard: 20, time: 0 },
      { id: 'distract', name: 'Distract', rest: 10, guard: 0, time: 4 },
    ],
  },
  {
    kind: 'pebblepup', name: 'Pebblepup', speed: 5.5, hearts: 5, strike: 5, every: 1.1, rest: 8,
    skills: [
      { id: 'brace', name: 'Brace', rest: 7, guard: 25, time: 2.5 },
      { id: 'distract', name: 'Taunt', rest: 9, guard: 0, time: 5 },
    ],
  },
];

export const fightPetOf = (kind: string): FightPetDef => FIGHT_PETS.find((p) => p.kind === kind) ?? (FIGHT_PETS[0] as FightPetDef);

export const PET = {
  /** It keeps this close to the hero at heel, and stands this far from a beast's edge to strike. */
  heel: 1.7,
  strikeGap: 0.7,
  /** Seconds between arriving and the first strike. */
  firstStrike: 0.25,
  /** A pet in the open takes no second hit for this long. */
  safe: 0.8,
  /** How much faster it runs when whistled back or pouncing. */
  hurry: 1.25,
  /** With the hero fighting, it strikes this much slower: it helps, it does not lead. */
  helperSlow: 1.5,
  /** Each mark of thrown light on a beast makes the pet's next strike this much stronger. */
  markBoost: 0.5,
  /** Seconds it holds a lure, and the rest before the next. */
  lure: 5,
  lureRest: 6,
  /** A click this close to a beast's edge is an order to attack it. */
  order: 0.8,
  body: 0.2,
} as const;

// ---------------------------------------------------------------------------------------- rigs

export type RigKind = 'lamp' | 'snare' | 'plate' | 'channel';

export interface RigDef {
  kind: RigKind;
  name: string;
  /** What it does, in a line for the panel. */
  does: string;
}

export const RIGS: readonly RigDef[] = [
  { kind: 'lamp', name: 'Lamp', does: 'A beast that charges at light charges at this, and is dazzled when it gets there.' },
  { kind: 'snare', name: 'Snare vine', does: 'Holds the beast that steps on it.' },
  { kind: 'plate', name: 'Spring plate', does: 'Throws back the beast that steps on it. F springs it by hand when a beast is close.' },
  { kind: 'channel', name: 'Water channel', does: 'Three blocks of water. No beast walks across, and a charge that reaches it stalls.' },
];

export const RIG = {
  /** The kit holds one of each, so at most four stand at once. */
  limit: 4,
  /** How far from the hero one can be set down. */
  reach: 6,
  /** A beast this close to a rig's middle, past its own radius, sets it off. */
  touch: 0.45,
  /** A lamp draws a charge from this far. */
  lure: 10,
  /** Seconds a snare holds. */
  hold: 2.5,
  /** Blocks a plate throws a beast, the seconds it is in the air, and the seconds it lies there. */
  fling: 4,
  flingTime: 0.4,
  flingStun: 1.2,
  /** F springs a plate when a beast is within this of it. */
  hand: 2.2,
  /** Seconds a dazzled or stalled beast stands helpless. */
  stun: 1.5,
  /** A water channel is this many blocks long. */
  channel: 3,
  /** Nothing is set down this close to a beast. */
  clear: 1.5,
} as const;
