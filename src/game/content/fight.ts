// The fight lab's numbers, as data: the hero, the three weapons, the beasts and their attacks, the companions and
// the rigs. `src/game/fight` reads every number here. They are the starting values of the research notes
// (game-look-test/design/research_notes/game-design/05 and 08), tuned by the rule-made players in
// `tools/fight-sim.ts`.
//
// Seconds, blocks and blocks a second throughout. A time that names frames in the notes is that many
// sixtieths of a second here.

/** How the meadow is fought: `hero`, the hero with a weapon and a companion, or `world`, the traps. */
export type Way = 'hero' | 'world';
export const WAYS: readonly Way[] = ['hero', 'world'];

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------------------- the hero

export const HERO = {
  health: 100,
  stamina: 100,
  /** Stamina that comes back each second, once this long has passed since it was last spent. */
  staminaBack: 20,
  staminaWait: 1,
  /** The dodge travels 3.5 blocks. Nothing hits the hero for the first `safe` seconds of it. */
  dodge: { time: 0.35, safe: 0.3, speed: 10, cost: 25, after: 0.1 },
  /** After a hit: the stagger, how long nothing else can hit, and the push as blocks over seconds. */
  hurt: { stagger: 0.25, safe: 0.6, push: 0.8, pushTime: 0.15, heavyPush: 2, heavyPushTime: 0.25 },
  /** Holding out the Mark: how near a dizzy beast must be, and how long the hold takes. */
  calm: { reach: 3.5, hold: 1 },
  /** Seconds on the ground after fainting, and seconds nothing can hit the hero after waking. */
  faint: 2,
  wakeSafe: 1.5,
  /** A melee attack turns to face a beast this close to the aim: within reach plus `near` blocks and `angle` of the pointer. */
  magnet: { near: 1, angle: 35 * DEG },
  /** A press that cannot act yet is kept this long and acts as soon as it can. */
  buffer: 0.2,
  /** Seconds after a new weapon is taken in hand before it can attack. */
  swap: 0.35,
  /** A strong hit breaks this many times its guard. The booster gives one now and then. */
  strong: 2,
  /** The hero's own walking and swimming speeds, for the sim when nothing else moves the body: the body's own (`DEFAULT_HERO`). */
  walk: 4.4,
  swim: 2.4,
  /** A hit lands when the point at the hero's feet, grown by this, is inside the shape. */
  body: 0.15,
} as const;

/** The screen shakes this many pixels for this many seconds: a spin that lands, and a heavy hit on the hero. A switch on the card turns it off. */
export const SHAKE = { spin: { px: 3, time: 0.1 }, heavy: { px: 6, time: 0.2 } } as const;
/** Below this share of the hero's health the edge of the screen glows warm, stronger as it falls. Never a red flash. */
export const LOW_HEALTH = 0.35;

// ---------------------------------------------------------------------------------------- weapons

export type WeaponKind = 'sword' | 'bow' | 'staff';
export type MoveId = 'cut' | 'spin' | 'arrow' | 'drawn' | 'bolt' | 'burst';

/**
 * One attack of a weapon. The rules play every one the same way: it starts, it lands once at `startup`, and it
 * ends at `total`. What it makes when it lands is its `kind`:
 *   `arc`    a wedge in front of the hero, `width` radians to each side, `reach` long
 *   `ring`   a circle round the hero, `reach` wide
 *   `shot`   a shot down the aim, at `speed`, for `range` blocks, `radius` wide. It stops at the wall and the trees.
 *   `burst`  a circle of `reach` at the pointer, at most `range` from the hero
 */
export interface MoveDef {
  id: MoveId;
  name: string;
  kind: 'arc' | 'ring' | 'shot' | 'burst';
  /** Held moves only: seconds the button is held before it is ready to let go, and the share of walking speed while it is held. */
  hold: number;
  holdPace: number;
  startup: number;
  total: number;
  /** A dodge may cut it short from here. */
  cancel: number;
  /** The quick move only: a second press from here plays it again once (the sword's second cut). 0 for none. */
  chain: number;
  /** The share of walking speed while it plays. */
  pace: number;
  reach: number;
  width: number;
  guard: number;
  /** The push on what it hits, as blocks over seconds. A steady beast is not pushed until its guard is empty. */
  push: number;
  pushTime: number;
  speed: number;
  range: number;
  radius: number;
  /** A shot that passes through what it hits and goes on. */
  pierce: boolean;
  /** Marks of the Mark's light it leaves on what it hits. A companion's next strike spends them. */
  marks: number;
  /** Seconds what it hits walks slowed. */
  slow: number;
  /** A shot bends to a beast within this angle of the aim and this far. 0 for none. */
  aimAngle: number;
  aimRange: number;
}

export interface WeaponDef {
  kind: WeaponKind;
  name: string;
  /** Click, and hold and let go. */
  quick: MoveDef;
  held: MoveDef;
  /** What it asks of the player, in a line for the card. */
  asks: string;
}

const MOVE: Omit<MoveDef, 'id' | 'name' | 'kind'> = {
  hold: 0, holdPace: 1, startup: 0.1, total: 0.4, cancel: 0.15, chain: 0, pace: 1, reach: 0, width: 0, guard: 0, push: 0, pushTime: 0.1,
  speed: 0, range: 0, radius: 0, pierce: false, marks: 0, slow: 0, aimAngle: 0, aimRange: 0,
};

export const WEAPONS: readonly WeaponDef[] = [
  {
    kind: 'sword', name: 'Sword', asks: 'Stand close and step out in time.',
    // Note 05: a cut lands on its sixth frame and takes 24 in all; the second may start from frame 12, a dodge from frame 9.
    quick: { ...MOVE, id: 'cut', name: 'Cut', kind: 'arc', startup: 0.1, total: 0.4, chain: 0.2, cancel: 0.15, pace: 0.25, reach: 2.2, width: 75 * DEG, guard: 10, push: 0.4, pushTime: 0.12 },
    // The charged spin: hold 36 frames, let go, and it hits everything round the hero, pushing each one 2 blocks away.
    held: { ...MOVE, id: 'spin', name: 'Spin', kind: 'ring', hold: 0.6, holdPace: 0.6, startup: 0.05, total: 0.55, cancel: 0.4, pace: 0.25, reach: 2.5, guard: 30, push: 2, pushTime: 0.25 },
  },
  {
    kind: 'bow', name: 'Bow', asks: 'Keep a line and keep a distance.',
    // Note 05: the quick shot is 9 frames, the arrow flies at 24 blocks a second, and it bends to a beast within 8 degrees and 12 blocks.
    quick: { ...MOVE, id: 'arrow', name: 'Arrow', kind: 'shot', startup: 0.15, total: 0.35, cancel: 0.15, pace: 0.55, guard: 6, speed: 24, range: 14, radius: 0.35, aimAngle: 8 * DEG, aimRange: 12 },
    // A drawn shot passes through what it hits and pushes it. Note 05: a charged shot gets no bend.
    held: { ...MOVE, id: 'drawn', name: 'Drawn shot', kind: 'shot', hold: 0.75, holdPace: 0.4, startup: 0.05, total: 0.4, cancel: 0.2, pace: 0.4, guard: 24, push: 1.2, pushTime: 0.2, speed: 32, range: 18, radius: 0.45, pierce: true },
  },
  {
    kind: 'staff', name: 'Staff', asks: 'Mark the beast and set up your companion\'s big hit.',
    // Note 05's rune cast: 12 frames, walking at half speed.
    quick: { ...MOVE, id: 'bolt', name: 'Bolt', kind: 'shot', startup: 0.2, total: 0.4, cancel: 0.2, pace: 0.5, guard: 5, speed: 18, range: 11, radius: 0.4, marks: 1, aimAngle: 15 * DEG, aimRange: 11 },
    held: { ...MOVE, id: 'burst', name: 'Burst', kind: 'burst', hold: 0.8, holdPace: 0.5, startup: 0.25, total: 0.55, cancel: 0.3, pace: 0.3, reach: 2.4, range: 9, guard: 14, marks: 1, slow: 3 },
  },
];

export const weaponOf = (kind: string): WeaponDef => WEAPONS.find((w) => w.kind === kind) ?? (WEAPONS[0] as WeaponDef);
/** The sword's two moves, which the hall's bot and the tests name often. */
export const SWORD = weaponOf('sword');

/** A beast walking slowed goes at this share of its speed, and so does its charge. */
export const SLOWED = 0.5;

// ---------------------------------------------------------------------------------------- beasts

export interface AttackDef {
  /** Its name in the record and on the card. A follow-up is named after what it follows, with a 2: `quills2`. */
  id: string;
  /** What is drawn on the ground before it lands. */
  shape: 'circle' | 'line' | 'cone';
  /** Where a circle lands: round the beast, where the hero stood when it was told, or where the companion stood. */
  at?: 'self' | 'target' | 'companion';
  /** True when it holds the companion it lands on, in vines, until the hero cuts them free (the rootsnare). */
  grabs?: boolean;
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
  /** The attack that follows at once only while the beast is enraged, by id. */
  rageThen?: string;
  /** True for an attack that only ever follows another. */
  follows?: boolean;
  /** True for an attack of milestone 4: the traps are fought without it, as they were. */
  fightOnly?: boolean;
  /** What the beast does in its tell, in a line for the card. */
  tell: string;
}

export interface BeastDef {
  kind: string;
  name: string;
  /** Its Blight depth, shown by its name. The Mark's reach compares it with the Heartstone. */
  depth: number;
  /** True for a guardian machine: it is shut down, not calmed. */
  machine: boolean;
  radius: number;
  /** True for a machine or a big beast: a hit does not push it until its guard is empty. */
  steady: boolean;
  /** Blocks a second while it closes in. */
  speed: number;
  /** Radians a second it turns to face the hero in a fight. A slow one can be got round: stand at its side. */
  turn: number;
  /** In the traps every rig and crash breaks a share of it, so the number does not change how they play. */
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
  /** A machine's plates: the share of a hit on its front that gets through. A hit on its back gets all. Unset for none. */
  plates?: number;
  /** True when it will not cross a lamp post's circle. */
  fearsLight?: boolean;
  /** True when it never walks: the rootsnare is rooted where it grew. */
  rooted?: boolean;
  attacks: readonly AttackDef[];
  /** What it leaves when it is calmed. */
  gift: string;
  /** Its rules, as the Almanac would list them. */
  rules: readonly string[];
}

export const BEASTS: readonly BeastDef[] = [
  {
    kind: 'thistlehog', name: 'Blighted thistlehog', depth: 1, machine: false,
    radius: 0.45, steady: false, speed: 2.6, turn: 7, guard: 300, segments: 1, dizzy: 3, rigShare: 1 / 2, crash: 2, drawnToLight: false, wakes: 6,
    attacks: [
      { id: 'needles', shape: 'circle', reach: 3, width: 0, lead: 0.9, recover: 1.5, damage: 10, heavy: false, charge: 0, from: 0, to: 2.3, rest: 1, tell: 'puffs up' },
      { id: 'roll', shape: 'line', reach: 7, width: 1.1, lead: 0.8, recover: 1.2, damage: 10, heavy: false, charge: 9, from: 3, to: 7, rest: 3, fightOnly: true, tell: 'curls into a ball' },
      { id: 'quills', shape: 'circle', at: 'target', reach: 1.7, width: 0, lead: 1, recover: 0, damage: 8, heavy: false, charge: 0, from: 6, to: 17, rest: 2.4, then: 'quills2', fightOnly: true, tell: 'rears and shakes its back' },
      { id: 'quills2', shape: 'circle', at: 'target', reach: 1.5, width: 0, lead: 0.9, recover: 0.9, damage: 8, heavy: false, charge: 0, from: 0, to: 30, rest: 0, follows: true, fightOnly: true, tell: 'shakes again' },
    ],
    gift: 'Quills',
    rules: ['Close up it puffs up, then throws needles in a ring around itself.', 'A little way off it curls up and rolls at you.', 'Far off it shakes a rain of quills where you stand.', 'It stands still for a moment after it fires: a time to hit it.', 'It will not cross water.'],
  },
  {
    kind: 'gearling', name: 'Gearling', depth: 2, machine: true,
    radius: 0.5, steady: true, speed: 3, turn: 3.5, guard: 450, segments: 1, dizzy: 3, rigShare: 1 / 2, crash: 2, drawnToLight: true, wakes: 7, plates: 0.3,
    attacks: [
      { id: 'charge', shape: 'line', reach: 8, width: 1.2, lead: 1, recover: 0, damage: 12, heavy: false, charge: 12, from: 3, to: 9, rest: 1.5, then: 'spin', tell: 'winds its key' },
      { id: 'spin', shape: 'circle', reach: 1.5, width: 0, lead: 0.6, recover: 1.5, damage: 10, heavy: false, charge: 0, from: 0, to: 2.2, rest: 2.5, tell: 'spins up' },
      { id: 'slam', shape: 'circle', reach: 2.4, width: 0, lead: 0.9, recover: 1.4, damage: 12, heavy: false, charge: 0, from: 0, to: 2, rest: 3, fightOnly: true, tell: 'lifts itself on its springs' },
      { id: 'toss', shape: 'line', reach: 14, width: 1, lead: 0.9, recover: 0, damage: 10, heavy: false, charge: 0, from: 8, to: 17, rest: 2.6, then: 'toss2', fightOnly: true, tell: 'pulls a gear from its side' },
      { id: 'toss2', shape: 'line', reach: 14, width: 1, lead: 0.7, recover: 1, damage: 10, heavy: false, charge: 0, from: 0, to: 30, rest: 0, follows: true, fightOnly: true, tell: 'pulls a second gear' },
    ],
    gift: 'Gear springs',
    rules: ['It winds its key, then charges in a straight line, and spins where the charge ends.', 'Close up it lifts on its springs and slams down.', 'Far off it throws a gear down a long line.', 'A charge into a wall leaves it helpless.', 'Its plates turn a blade: strike its back after it charges.', 'It charges at light. It will not cross water.'],
  },
  {
    kind: 'boar', name: 'The Blighted boar', depth: 5, machine: false,
    radius: 1.3, steady: true, speed: 3.2, turn: 2, guard: 2100, segments: 3, dizzy: 4, rigShare: 1 / 3, crash: 2.5, drawnToLight: true, wakes: 9,
    attacks: [
      { id: 'charge', shape: 'line', reach: 12, width: 2.6, lead: 1.3, recover: 1.4, damage: 22, heavy: true, charge: 13, from: 4.5, to: 13, rest: 2.5, rageThen: 'charge2', tell: 'paws the ground' },
      { id: 'charge2', shape: 'line', reach: 12, width: 2.6, lead: 0.8, recover: 1.4, damage: 22, heavy: true, charge: 13, from: 0, to: 30, rest: 0, follows: true, fightOnly: true, tell: 'wheels round and paws again' },
      { id: 'tusks', shape: 'cone', reach: 3.4, width: 60 * DEG, lead: 1.3, recover: 1.2, damage: 14, heavy: false, charge: 0, from: 0, to: 4.2, rest: 4.5, tell: 'drops its head to one side' },
      { id: 'stomp', shape: 'circle', reach: 4.2, width: 0, lead: 1.6, recover: 1.5, damage: 24, heavy: true, charge: 0, from: 0, to: 3.4, rest: 5, tell: 'rears up' },
      { id: 'gore', shape: 'line', reach: 6, width: 2.2, lead: 1.2, recover: 1.4, damage: 16, heavy: false, charge: 11, from: 3, to: 6.5, rest: 5, fightOnly: true, tell: 'lowers its tusks' },
      { id: 'hurl', shape: 'circle', at: 'target', reach: 2.4, width: 0, lead: 1.2, recover: 0, damage: 14, heavy: false, charge: 0, from: 8, to: 19, rest: 3, then: 'hurl2', fightOnly: true, tell: 'digs in and flings a clod' },
      { id: 'hurl2', shape: 'circle', at: 'target', reach: 1.8, width: 0, lead: 1, recover: 1.2, damage: 14, heavy: false, charge: 0, from: 0, to: 30, rest: 0, follows: true, fightOnly: true, tell: 'flings a second clod' },
    ],
    gift: 'A tusk',
    rules: ['It paws the ground, then charges in a wide line.', 'Close up it sweeps its tusks in front, or stamps a wide ring.', 'A few steps off it lowers its tusks and lunges.', 'Far off it digs in and flings a clod where you stand.', 'Its guard has three parts. Each part you break stays broken.', 'It charges at light. It will not cross water.'],
  },
  {
    // Act 1: the fox of the first night's kind, and the pack of fight 3 (depth 2 there, set by the encounter).
    kind: 'fox', name: 'Blighted fox', depth: 1, machine: false,
    radius: 0.35, steady: false, speed: 4.2, turn: 8, guard: 180, segments: 1, dizzy: 3, rigShare: 1 / 2, crash: 2, drawnToLight: false, wakes: 8, fearsLight: true,
    attacks: [
      { id: 'nip', shape: 'cone', reach: 1.7, width: 50 * DEG, lead: 0.65, recover: 0.9, damage: 7, heavy: false, charge: 0, from: 0, to: 2, rest: 0.9, tell: 'flattens its ears' },
      { id: 'dart', shape: 'line', reach: 6, width: 0.9, lead: 0.75, recover: 1.1, damage: 8, heavy: false, charge: 10, from: 2.5, to: 6.5, rest: 2.6, tell: 'crouches low' },
      { id: 'yip', shape: 'circle', at: 'target', reach: 1.4, width: 0, lead: 0.9, recover: 0.8, damage: 6, heavy: false, charge: 0, from: 7, to: 16, rest: 3, fightOnly: true, tell: 'kicks up grey dust' },
    ],
    gift: 'A shed pelt',
    rules: ['It flattens its ears, then nips in front of it.', 'A little way off it crouches and darts at you.', 'Far off it kicks grey dust where you stand.', 'Foxes come in packs, and take turns.', 'It will not cross a lamp post\'s light.'],
  },
  {
    // Fight 5: quicker than the hero. It pounces, and stands open where it lands.
    kind: 'lynx', name: 'Blighted lynx', depth: 3, machine: false,
    radius: 0.5, steady: false, speed: 5.2, turn: 9, guard: 420, segments: 2, dizzy: 3, rigShare: 1 / 2, crash: 2.2, drawnToLight: false, wakes: 9, fearsLight: true,
    attacks: [
      { id: 'pounce', shape: 'line', reach: 7.5, width: 1.3, lead: 0.8, recover: 1.7, damage: 14, heavy: true, charge: 17, from: 2.5, to: 8, rest: 1.6, tell: 'sinks on its haunches' },
      { id: 'swipe', shape: 'cone', reach: 1.9, width: 65 * DEG, lead: 0.6, recover: 0.6, damage: 10, heavy: false, charge: 0, from: 0, to: 2.3, rest: 1.3, then: 'swipe2', tell: 'lifts a paw' },
      { id: 'swipe2', shape: 'cone', reach: 1.9, width: 65 * DEG, lead: 0.6, recover: 0.9, damage: 10, heavy: false, charge: 0, from: 0, to: 30, rest: 0, follows: true, fightOnly: true, tell: 'lifts the other paw' },
      { id: 'leap', shape: 'circle', at: 'target', reach: 1.8, width: 0, lead: 1, recover: 1.4, damage: 12, heavy: true, charge: 0, from: 8.5, to: 18, rest: 3, fightOnly: true, tell: 'gathers itself to leap' },
    ],
    gift: 'A shed pelt',
    rules: ['It sinks on its haunches, then pounces down a line. Where it lands it stands open.', 'Close up it swipes twice.', 'Far off it leaps to where you stand.', 'It is quicker than you: wait for the pounce.', 'A quill strip where it lands makes it flinch.', 'It will not cross a lamp post\'s light.'],
  },
  {
    // Fight 8: rooted at the caves' mouth. It takes the companion first, and its heart is shut while it holds them.
    kind: 'rootsnare', name: 'Blighted rootsnare', depth: 2, machine: false,
    radius: 0.7, steady: true, speed: 0, turn: 4, guard: 360, segments: 1, dizzy: 4, rigShare: 1 / 2, crash: 2, drawnToLight: false, wakes: 9, rooted: true,
    attacks: [
      { id: 'grab', shape: 'circle', at: 'companion', reach: 1.3, width: 0, lead: 1.1, recover: 0.6, damage: 0, heavy: false, charge: 0, from: 0, to: 14, rest: 5, grabs: true, tell: 'sends roots under the ground' },
      { id: 'lash', shape: 'line', reach: 5.5, width: 1, lead: 0.85, recover: 1, damage: 11, heavy: false, charge: 0, from: 0, to: 5.8, rest: 1.5, tell: 'draws back a root' },
      { id: 'spores', shape: 'circle', at: 'target', reach: 1.8, width: 0, lead: 1, recover: 0.8, damage: 9, heavy: false, charge: 0, from: 6, to: 16, rest: 2.4, tell: 'puffs out grey spores' },
    ],
    gift: 'Vine rope',
    rules: ['It sends roots under the ground and holds your companion.', 'While it holds them its heart is shut: cut the vines first.', 'Close up it lashes a root down a line.', 'Far off it puffs spores where you stand.', 'It never moves.'],
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
/**
 * Once half its guard is gone a beast comes faster: its leads, the time it stands open and its rests are this much
 * of what they were, and it walks this much faster. No lead is ever shorter than `least` (note 05's minimum).
 * The traps are fought without it.
 */
export const RAGE = { at: 0.5, lead: 0.9, recover: 0.7, rest: 0.65, speed: 1.25, least: 0.6 } as const;
/** A beast starts an attack that has a direction only when it faces the hero within this many radians. */
export const AIMED = 0.3;
/** In a fight (not the traps) a charge into the wall or a tree breaks this share of the guard, not its `rigShare`. */
export const FIGHT_CRASH = 0.08;
/** Two beasts brought in together each have this share of their guard. */
export const PAIR_GUARD = 0.6;
/** Three or more brought in together, a pack, each have this share. */
export const PACK_GUARD = 0.5;
/**
 * The rootsnare's hold on the companion: the vines round them are a target with this guard, and while they hold,
 * the beast that holds them takes only `shut` of every hit. Its heart is shut.
 */
export const ROOTED = { vines: 30, radius: 0.6, shut: 0.15 } as const;
/** Two beasts at once take turns: one does not wind up while the other's attack is still to land, and waits this long after it lands. */
export const TURN_GAP = 0.35;

// ---------------------------------------------------------------------------------------- companions

export type CompanionRole = 'striker' | 'guard' | 'healer' | 'booster';

export interface CompanionSkill {
  id: 'pounce' | 'brace' | 'mend' | 'bloom' | 'pin';
  name: string;
  /** Seconds before it can be called again. */
  rest: number;
  /** Guard a pounce, or a beast staggered by a brace, loses. */
  guard: number;
  /** Seconds a brace or a bloom lasts. */
  time: number;
  /** Health a mend gives back at once. */
  heal: number;
}

export interface CompanionDef {
  kind: string;
  name: string;
  role: CompanionRole;
  /** What it does by itself, in a line for the card. */
  does: string;
  /** Blocks a second. */
  speed: number;
  /** Guard one strike breaks, seconds between strikes, and how far from a beast's edge it strikes from. */
  strike: number;
  every: number;
  range: number;
  skill: CompanionSkill;
  /** Act 1's striker, Wren: she goes for a beast the hero is not fighting and pins it, so the hero faces one at a time. */
  keepsOff?: boolean;
  /** Seconds each of its strikes holds a beast where it stands. */
  pins?: number;
  /** Act 1's healer, the fox: the first time the hero faints in a fight it gets them up at once, with this share of their health. */
  revive?: number;
}

export const COMPANIONS: readonly CompanionDef[] = [
  {
    kind: 'leaftail', name: 'Leaftail', role: 'striker', does: 'Attacks what you fight and steps out of its attacks.', speed: 7.5, strike: 6, every: 1.1, range: 0.7,
    skill: { id: 'pounce', name: 'Pounce', rest: 6, guard: 20, time: 0, heal: 0 },
  },
  {
    kind: 'pebblepup', name: 'Pebblepup', role: 'guard', does: 'Stands between you and the beast and takes half of what lands on you.', speed: 6.5, strike: 4, every: 1.6, range: 0.7,
    skill: { id: 'brace', name: 'Brace', rest: 7, guard: 20, time: 2.5, heal: 0 },
  },
  {
    kind: 'lanternfly', name: 'Lanternfly', role: 'healer', does: 'Mends you slowly while nothing is about to land on you.', speed: 6.5, strike: 3, every: 2.2, range: 7,
    skill: { id: 'mend', name: 'Mend', rest: 15, guard: 0, time: 0, heal: 35 },
  },
  {
    kind: 'mossling', name: 'Mossling', role: 'booster', does: 'Now and then makes your next hit a strong one.', speed: 5.5, strike: 3, every: 2.2, range: 5,
    skill: { id: 'bloom', name: 'Bloom', rest: 15, guard: 0, time: 5, heal: 0 },
  },
  // Act 1's four (handbook chapter 23, `playthrough/content.js` companions): one with each job, one at a time.
  {
    kind: 'dax', name: 'Dax', role: 'guard', does: 'Stands in front and takes the charge on his shield.', speed: 6, strike: 5, every: 1.5, range: 0.8,
    skill: { id: 'brace', name: 'Shield', rest: 7, guard: 24, time: 2.5, heal: 0 },
  },
  {
    kind: 'wren', name: 'Wren', role: 'striker', does: 'Keeps back with her bow and pins a beast while you work on another.', speed: 6.5, strike: 5, every: 1.6, range: 6, keepsOff: true, pins: 1.4,
    skill: { id: 'pin', name: 'Pin', rest: 8, guard: 10, time: 3.5, heal: 0 },
  },
  {
    kind: 'fox', name: 'Your fox', role: 'healer', does: 'When you are hurt it brings you a berry, and it gets you up once.', speed: 7, strike: 3, every: 2, range: 0.7, revive: 0.5,
    skill: { id: 'mend', name: 'Berry', rest: 14, guard: 0, time: 0, heal: 30 },
  },
  {
    kind: 'stagling', name: 'The Stag\'s young', role: 'booster', does: 'Blooms the ground under you, and your next strikes hit harder.', speed: 6, strike: 3, every: 2.2, range: 5,
    skill: { id: 'bloom', name: 'Bloom', rest: 14, guard: 0, time: 5, heal: 0 },
  },
];

/** The companions of act 1, in the order the story brings them. The lab's four stay for the lab. */
export const ACT1_COMPANIONS = ['dax', 'wren', 'fox', 'stagling'] as const;
export type Act1Companion = (typeof ACT1_COMPANIONS)[number];

/** The lab's four, one for each job, which its card offers. */
export const LAB_COMPANIONS: readonly CompanionDef[] = COMPANIONS.slice(0, 4);

export const companionOf = (kind: string): CompanionDef => COMPANIONS.find((c) => c.kind === kind) ?? (COMPANIONS[0] as CompanionDef);

export const COMPANION = {
  /** It keeps this close to the hero at heel. */
  heel: 1.7,
  /** How much faster it runs to get out of a shape, or on a pounce. */
  hurry: 1.25,
  /** Each mark of the Mark's light on a beast makes a companion's next strike this much stronger. */
  markBoost: 0.5,
  /** The guard stands this far from the hero toward the beast, and takes this share of a hit that lands on a hero within `cover` of it. */
  guardGap: 1.3,
  guardShare: 0.5,
  cover: 1.9,
  /** A brace staggers the beast it turns for this long. */
  braceStagger: 1.2,
  /** The healer mends this much health a second, once this long has passed since the last hit and nothing is about to land. */
  heal: 3,
  healWait: 1.5,
  /** The booster makes the hero's next hit strong once every this many seconds of a fight. */
  boostEvery: 6,
  /** In bloom every hit breaks this much more guard, and a held attack charges this many times as fast. */
  bloomGuard: 1.5,
  bloomCharge: 2,
  /** The traps: C sends the companion to the pointer as a lure for this long, then it rests. */
  lure: 5,
  lureRest: 6,
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
  { kind: 'lamp', name: 'Lamp', does: 'A beast that charges at light charges at this, and is helpless for a moment when it gets there.' },
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

// ---------------------------------------------------------------------------------------- milestone 3: the Verdant Stag
// The first boss test: a god as tall as an oak, chained in a round hall (`src/game/fight/stag-hall.sim.ts`). Its three
// phases are the story's (handbook 04d, "How fights work"). The lead times are note 05's for a Warden's big
// attacks, from 1.5 seconds. Where the hall's things stand is `src/game/fight/hall-layout.sim.ts`.

export type StagAttack = 'sweep' | 'stamp' | 'shake';

export const STAG = {
  name: 'The Verdant Stag',
  /** It wakes when the hero comes this close to its chest: a step or two in from the door. */
  wakes: 13.5,
  /** The four pins of the chains. Each takes six cuts. */
  pin: { guard: 60, radius: 0.6 },
  /** The lamps of the second phase. Two cuts light one, and it lights the floor this far round it. */
  lamp: { guard: 20, radius: 0.5, light: 4.5 },
  /**
   * Seed pods. One comes up every `every` seconds in the dark, between `near` and `far` blocks from the hero, while
   * a lamp is still dark, never more than `most` at once. It grows for `grow` seconds with a ring of `burst` on the
   * ground, then bursts. One cut takes it. A pod in a lamp's light withers.
   */
  pod: { guard: 10, radius: 0.5, every: 2.2, grow: 3, burst: 1.8, damage: 12, most: 4, near: 2.5, far: 6.5, apart: 2.2 },
  /** The collar on its neck: only a hero up the vines reaches it, and only the hero's own cut. */
  collar: { guard: 120, radius: 1.4 },
  /** Its antlers, swept across the whole floor through where the hero stands. */
  sweep: { lead: 1.5, width: 3, damage: 16, heavy: true },
  /** A stamp of the leg nearest a hero who comes within `near` blocks of its body. */
  stamp: { lead: 1.3, radius: 4.5, damage: 18, heavy: true, near: 3.5 },
  /** It shakes a stretch of the vines under a hero who climbs them. A hit throws them `push` blocks, off the vines to the floor. */
  shake: { lead: 1.2, length: 3.2, width: 4, damage: 10, heavy: true, push: 3.5 },
  /** Seconds it stands after an attack lands, and the seconds it waits after that, by phase. */
  recover: 1,
  pause: [0.8, 1.2, 0.8] as readonly number[],
  /** Seconds it staggers when a pin breaks, and seconds it rears between two phases. */
  stagger: 1.6,
  rise: 1.5,
  /** The names of the phases, in order. */
  phases: ['The chains', 'The overgrowth', 'The collar'] as readonly string[],
  /** Frames the picture stands still when the collar breaks (note 05: "A Warden phase ends: 20 frames of stop"). */
  freeFreeze: 20,
} as const;
// ---------------------------------------------------------------------------------------- end of the Verdant Stag

// ---------------------------------------------------------------------------------------- act 1: the hero's numbers
// What the gear record, the day's meal and the shrines do in a fight (handbook chapters 23 and 30). Gear is a tier
// on a weapon, with one fitting from step 2; armour adds health. No random rolls, nothing breaks.

export const HERO_STATS = {
  /** A heart is this much health. A meal today adds one, and so does each shrine picked for a heart. */
  heart: 20,
  /** Stamina a shrine picked for stamina adds. */
  staminaPiece: 20,
  /** Health the armour adds at each of its four steps: canvas, padded, quill coat, root-weave. */
  armor: [0, 20, 40, 60] as readonly number[],
  /** How much more guard each of the weapon's four steps breaks. */
  tier: [1, 1.25, 1.55, 1.9] as readonly number[],
} as const;

/** What each fitting changes in a fight, as numbers the rules read. Their names and lines are `FITTINGS` in `content/gear.ts`. */
export const FITTING = {
  /** Quill edge: every third hit breaks this much more guard. */
  quillEvery: 3, quillGuard: 1.8,
  /** Padded grip: the dodge goes this much faster, so further. */
  paddedDodge: 1.25,
  /** Spring hilt: a held move breaks this much more guard. */
  springGuard: 1.45,
  /** Glow cap: every hit leaves a mark of light. */
  glowMarks: 1,
  /** Slick sheath: a dodge leaves a slick this wide that lasts this long. */
  slickRadius: 0.9, slickTime: 4,
  /** Honey binding: stamina comes back this much faster. */
  honeyStamina: 1.5,
  /** Brass against iron: from the third step a blade on a machine's plates gets this much more through. */
  brassPlates: 2,
} as const;

// ---------------------------------------------------------------------------------------- act 1: the kit
// The kit's three slots carry things that are used up when they work (chapter 30). 1, 2 and 3 take one in hand in
// a world fight, a click sets it down, and the salve is used at once. The lynx teaches it.

export const KIT_FIGHT = {
  /** A quill strip: the beast that lands on it flinches for this long, and this share of its guard drops. */
  quillStun: 1.2, quillShare: 0.22,
  /** A lamp post: a beast that fears light will not come inside this circle. */
  lampRadius: 3.2,
  /** A slick patch: what crosses it slides straight on at this speed for this long, and crashes into what is behind. */
  slideSpeed: 9, slideTime: 0.7,
  /** A clapper: every beast this close bolts straight away from it for this long, then stands. */
  clapReach: 7, clapBolt: 0.6, clapSpeed: 7, clapStand: 0.8,
  /** How far from the hero a kit thing can be set down. */
  reach: 6,
} as const;

// ---------------------------------------------------------------------------------------- act 1: the keepers
// The three vault keepers (fights 7, 9 and 10). Each keeps one rule of its place. Their rules are
// `src/game/fight/keepers.sim.ts`; their rooms are the ruins builder's, and `keeperStage` is the test arena.

export type KeeperKind = 'sluice' | 'lamplighter' | 'harvester';

export const KEEPERS = {
  sluice: {
    name: 'The Sluice Keeper',
    /** Its body, which walks the room on its wheels, and the guard that the hero breaks once its wheels stall. */
    radius: 1.4, speed: 2.6, guard: 360,
    /** The three sluice gates round the room. Two cuts open one, and its channel floods for `flood` seconds. */
    gate: { guard: 20, radius: 0.6, flood: 9 },
    /** A keeper whose wheels stand in a flooded channel stalls this long, and is open. */
    stall: 4,
    /** A roll down a line at the hero, and a jet of water in a ring round itself. */
    roll: { lead: 1.2, length: 11, width: 2.4, damage: 16, heavy: true },
    jet: { lead: 1, radius: 3.2, damage: 12, heavy: false },
    pause: 1.1,
    line: 'Its wheels stall in water. Open a sluice when it rolls over the channel.',
  },
  lamplighter: {
    name: 'The Lamplighter',
    radius: 1.1, guard: 260,
    /** It turns slowly on its post. The beam is a long line; standing in it when it fires hurts. */
    beam: { lead: 1.3, length: 16, width: 1.6, damage: 18, heavy: true },
    turn: 1.2,
    /** Four lamps round the room. Two cuts switch one: lit, it blinds the beam that crosses it for `blind` seconds. */
    lamp: { guard: 14, radius: 0.5, blind: 4.5 },
    /** A blinded Lamplighter is open for this long. */
    open: 4,
    /** A sweep of sparks round its post when the hero comes close. */
    sparks: { lead: 1, radius: 3, damage: 10, heavy: false },
    pause: 0.9,
    line: 'Its beam needs to see you. Switch on a lamp between you and it.',
  },
  harvester: {
    name: 'The Wild Harvester',
    radius: 1.2, guard: 160,
    /** The arm sweeps a cone, and slams where the hero stands. A companion that holds it stops it for `held` seconds. */
    sweep: { lead: 1.2, reach: 6, width: 55 * DEG, damage: 15, heavy: true },
    slam: { lead: 1.1, radius: 2, damage: 14, heavy: false },
    held: 5,
    /** Seconds after a hold ends before the companion can hold it again. */
    holdRest: 3,
    /** Root pods it grows round the room: each grows, then bursts. While any pod stands, its heart heals. */
    pod: { guard: 10, radius: 0.5, grow: 5, burst: 1.8, damage: 10, most: 3, every: 4 },
    /** Guard it gets back a second for each pod standing. */
    mend: 6,
    pause: 1,
    line: 'Your companion holds the arm. Break the pods, then its heart.',
  },
} as const;

// ---------------------------------------------------------------------------------------- act 1: the twelve fights
// Handbook chapter 23's ladder at its places (`FIGHTS` in content/greenhollow.ts) and quest steps (content/quests.ts).
// `src/game/fights` arms each by its quest step, starts it when the hero comes near, and does what the story says
// after: the fox follows, the thistlehog and the rootsnare go home to work, Bramble comes home.

export type EncounterKind =
  /** Fight 1 is the first night, played by the Hall (src/game/hall). The fights only mark it won. */
  | 'hall'
  /** Beasts: brought in, fought, calmed. */
  | 'beasts'
  /** Fight 4: the boar does not fight. The Mark is held out to it and nothing happens. */
  | 'denial'
  /** A vault's keeper: started in its room by the ruins, or in its test arena. */
  | 'keeper'
  /** The Verdant Stag, in its hall under the terraces. */
  | 'stag';

export interface EncounterFoe {
  kind: string;
  /** Its Blight depth here, when not its own. */
  depth?: number;
}

export interface EncounterDef {
  n: import('./ids.ts').FightNumber;
  kind: EncounterKind;
  foes: readonly EncounterFoe[];
  keeper?: KeeperKind;
  /** Who the story puts beside the hero. Otherwise the one the player picked, of the ones they have. */
  companion?: Act1Companion;
  /** Blocks round its place it is fought in. Walking out of it leaves the fight. */
  radius: number;
  /** It starts when the hero comes this close to its place. */
  near: number;
  /** The fight's one line when it begins: what it teaches. */
  line: string;
  /** What the win leaves in the bag. */
  gifts: readonly { item: import('./ids.ts').ItemId; count: number }[];
  /**
   * What the win does in the world: the calmed beast goes home to work, the fox of the first night comes to the
   * hero's side as its pact (`follows`), the beasts go back into the wild, or nothing.
   */
  after: 'home' | 'follows' | 'wild' | 'none';
  /** Only at night. */
  night?: boolean;
}

export const ENCOUNTERS: readonly EncounterDef[] = [
  { n: 1, kind: 'hall', foes: [{ kind: 'fox' }], radius: 0, near: 0, line: 'Step out of the shape, then lower your weapon.', gifts: [], after: 'none' },
  { n: 2, kind: 'beasts', foes: [{ kind: 'thistlehog' }], companion: 'dax', radius: 14, near: 12, line: 'Break its guard, then hold out the Mark. Dax holds the charge.', gifts: [{ item: 'quill', count: 4 }], after: 'home', night: true },
  { n: 3, kind: 'beasts', foes: [{ kind: 'fox', depth: 2 }, { kind: 'fox', depth: 2 }, { kind: 'fox', depth: 2 }], companion: 'wren', radius: 15, near: 12, line: 'A pack. Wren keeps the others off you: face one at a time.', gifts: [{ item: 'shed_pelt', count: 3 }], after: 'follows' },
  { n: 4, kind: 'denial', foes: [{ kind: 'boar' }], companion: 'fox', radius: 15, near: 11, line: 'Hold out your hand to it.', gifts: [], after: 'none' },
  { n: 5, kind: 'beasts', foes: [{ kind: 'lynx' }], radius: 15, near: 12, line: 'It is quicker than you. Wait for the pounce, and set a quill strip where it lands.', gifts: [{ item: 'shed_pelt', count: 2 }, { item: 'quill_strip', count: 1 }], after: 'wild' },
  { n: 6, kind: 'beasts', foes: [{ kind: 'gearling' }], radius: 14, near: 11, line: 'Its plates turn your blade. Strike its back after it charges.', gifts: [{ item: 'old_brass', count: 2 }], after: 'none' },
  { n: 7, kind: 'keeper', keeper: 'sluice', foes: [], radius: 12, near: 9, line: KEEPERS.sluice.line, gifts: [{ item: 'gear_spring', count: 2 }], after: 'none' },
  { n: 8, kind: 'beasts', foes: [{ kind: 'rootsnare' }], radius: 14, near: 11, line: 'It takes your companion first. Cut them free before you go for its heart.', gifts: [{ item: 'vine_rope', count: 2 }], after: 'home' },
  { n: 9, kind: 'keeper', keeper: 'lamplighter', foes: [], radius: 12, near: 9, line: KEEPERS.lamplighter.line, gifts: [{ item: 'old_brass', count: 1 }], after: 'none' },
  { n: 10, kind: 'keeper', keeper: 'harvester', foes: [], radius: 12, near: 9, line: KEEPERS.harvester.line, gifts: [{ item: 'heartwood', count: 1 }], after: 'none' },
  { n: 11, kind: 'beasts', foes: [{ kind: 'boar' }], companion: 'wren', radius: 15, near: 12, line: 'Everything at once. Your Heartstone reaches it now.', gifts: [{ item: 'tusk_tip', count: 3 }], after: 'home' },
  { n: 12, kind: 'stag', foes: [], radius: 12, near: 9, line: 'The chains, the overgrowth, the collar.', gifts: [], after: 'none' },
];

export const encounterOf = (n: number): EncounterDef => {
  const def = ENCOUNTERS.find((e) => e.n === n);
  if (!def) throw new Error(`fight: there is no fight ${n}. There are 1 to 12.`);
  return def;
};

/** Night visitors at the settlement's fence (chapter 30, `farms.js` people.visitors): about one night in three. */
export const VISITORS = {
  /** The share of nights a beast comes. */
  chance: 1 / 3,
  /** The beasts that come, deepest last. One never deeper than the Heartstone comes. */
  kinds: ['fox', 'thistlehog', 'lynx'] as readonly string[],
  /** Seconds after night falls before it comes, and blocks from the plot's middle it waits, at the fence. */
  after: 40, fence: 14,
  /** It stays this long at the fence before it goes back into the dark. */
  stays: 150,
  /** What a visitor calmed leaves. */
  gift: { item: 'shed_pelt' as const, count: 1 },
} as const;
