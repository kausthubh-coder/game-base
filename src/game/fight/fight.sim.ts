// The fight lab's rules: one hero with a weapon and a companion, the beasts brought in, and the traps.
//
// A beast's attack shows its shape on the ground before it lands, a beast has a guard that empties, the hero
// holds out the Mark to calm a beast whose guard is empty, and a hero whose health runs out faints and wakes at
// the arena's edge. Nobody dies. There are two ways to fight the meadow:
//   `hero`   the hero fights with the weapon in the hand (sword, bow or staff), and the companion does its job.
//   `world`  the traps: rigs set on the ground and the arena's own wall empty the guard. The hero baits and dodges.
//
// A weapon is data (`WEAPONS` in content): a quick move and a held move. One attack machine plays whatever the
// weapon in the hand says. A companion is data too (`COMPANIONS`), with a role: a striker, a guard, a healer or
// a booster. It does its job by itself, and nothing hurts it.
//
// Nothing here draws or reads a key. A caller steps it with what the player wants (`FightInput`, `press`) and
// reads the state back. Time is whatever `step(dt)` is given: the lab steps it 60 times a second with the
// hero's body, the tests the same. Positions are x and z in blocks. Heights are the view's business.
import {
  AIMED, BEASTS, COMPANION, DIZZY_BACK, FIGHT_CRASH, FITTING, GENTLE, HERO, HERO_STATS, KIT_FIGHT, PACK_GUARD, PAIR_GUARD, RAGE, RIG, ROOTED, SEGMENT_STAGGER, SHAPE_AFTER, SLOWED,
  TURN_GAP, WAKE_PAUSE, WATER_STALL,
  beastOf, companionOf, weaponOf,
  type AttackDef, type BeastDef, type CompanionDef, type MoveDef, type MoveId, type RigKind, type Way, type WeaponDef, type WeaponKind,
} from '../content/fight.ts';
import type { FittingId } from '../content/gear.ts';
import type { KitId } from '../content/ids.ts';
import type { Stage } from './arena.sim.ts';
import { dirX, dirZ, facingOf, inCircle, inCone, inLine, turnBetween } from './shapes.sim.ts';

// ---------------------------------------------------------------------------------------- what a caller sees

/** What the player holds down, and where they point. The caller keeps one and changes it in place. */
export interface FightInput {
  /** Which way the hero wants to walk, in the world: east and south, each -1 to 1. */
  moveX: number;
  moveZ: number;
  /** Where the pointer is on the ground. */
  aimX: number;
  aimZ: number;
  /** The attack button is down. */
  attackHeld: boolean;
  /** The calm key is down. */
  calmHeld: boolean;
  /** A rig is in the hand, ready to set down. Only counted, for the record. */
  placing: boolean;
}

/** Something pressed once. `skill` is the companion's skill, `use` the calm key going down: it springs a rig by hand. */
export type FightPress = 'attack' | 'dodge' | 'skill' | 'use';

/** What the hero is doing: nothing, one of the weapon's moves, or one of these. */
export type HeroAct = 'none' | MoveId | 'dodge' | 'calm' | 'hurt' | 'faint';

export interface HeroState {
  x: number;
  z: number;
  facing: number;
  health: number;
  stamina: number;
  /** The weapon in the hand. */
  weapon: WeaponKind;
  act: HeroAct;
  /** The move being played while `act` is a move, null otherwise. */
  move: MoveDef | null;
  /** Seconds in the act. */
  t: number;
  /** 1 for the first quick move of a pair, 2 for the second (the sword's two cuts). */
  cuts: number;
  /** Seconds the attack button has been held toward the held move, and whether it is ready to let go. */
  charge: number;
  charged: boolean;
  /** Seconds left before the weapon just taken in hand can attack. */
  swap: number;
  /** True when the next hit that lands is a strong one: the booster's gift. */
  strong: boolean;
  /** Seconds left of the booster's bloom. */
  bloom: number;
  /** Where a burst will land, set when it starts. */
  burstX: number;
  burstZ: number;
  /** Seconds left in which nothing can hit the hero. */
  safe: number;
  /** Seconds since the hero was last hit. */
  sinceHit: number;
  /** True while something else moves the hero: a dodge or a push. `driveX` and `driveZ` are then the speed to move at. */
  driven: boolean;
  driveX: number;
  driveZ: number;
  /** How much of walking speed the hero's own legs have, 0 to 1. */
  pace: number;
  /** A speed added on top, pushing the hero out of a beast's body. */
  shoveX: number;
  shoveZ: number;
}

export type BeastDoing = 'asleep' | 'alert' | 'stalk' | 'windup' | 'charge' | 'recover' | 'stun' | 'held' | 'flung' | 'dizzy' | 'calmed';

/** What a rig on the ground is: one of the traps' four, or a thing from the kit's three slots. */
export type PlacedKind = RigKind | KitId;

/** One foe brought in: its kind, its depth when not its own, and `passive` for one that waits and does not fight until it is hit. */
export interface FoeSpec { kind: string; depth?: number; passive?: boolean }

export interface BeastState {
  id: number;
  def: BeastDef;
  /** Its Blight depth: its own, or what the encounter gives it. The Mark calms it only when this is no higher than the Heartstone. */
  depth: number;
  /** True while it waits without fighting: the boar of fight 4. A hit ends it. */
  passive: boolean;
  x: number;
  z: number;
  facing: number;
  doing: BeastDoing;
  /** Seconds in what it is doing, and how long that lasts when it has an end. */
  t: number;
  until: number;
  guard: number;
  /** The attack it is winding up or carrying out. */
  attack: AttackDef | null;
  /** How far the hold of the Mark has come, 0 to 1. */
  calm: number;
  /** The guard it started with: its own, or less when it came in with another. */
  full: number;
  /** Marks of the Mark's light on it. A companion's next strike spends them. */
  marks: number;
  /** True once half its guard is gone: it comes faster. */
  enraged: boolean;
  /** Seconds left of walking slowed by a burst. */
  slow: number;
  /** True while it moved this step, for a walk animation. */
  moving: boolean;
}

/** A shape on the ground: an attack that is about to land, or just has. */
export interface Telegraph {
  live: boolean;
  kind: 'circle' | 'line' | 'cone';
  x: number;
  z: number;
  facing: number;
  reach: number;
  /** A line's width, or half a cone's angle. */
  width: number;
  /** Seconds since it appeared, and the second it lands. */
  t: number;
  lead: number;
  /** The beast it belongs to. */
  owner: number;
  /** What a charge's line ends on: 0 open ground, 1 a wall or a tree, 2 water or the arena's edge. */
  end: 0 | 1 | 2;
  /** True for a shape that takes hold of the companion, not one that hurts: the companion does not step out of it. */
  grab: boolean;
}

export type CompanionMode = 'heel' | 'engage' | 'brace' | 'lure' | 'held';

export interface CompanionState {
  def: CompanionDef;
  x: number;
  z: number;
  facing: number;
  mode: CompanionMode;
  /** Seconds until its skill can be called again. */
  rest: number;
  /** Seconds it has been striking, for a pose: 0 when it is not. */
  strikeT: number;
  /** The beast it last struck from range, for the view's line of light. */
  struckX: number;
  struckZ: number;
  /** True in a step where the healer mends the hero. */
  healing: boolean;
  moving: boolean;
  /** Seconds left of a brace or a lure. */
  left: number;
  /** The booster: seconds until it makes the hero's next hit strong. */
  boostIn: number;
}

/** An arrow or a bolt: a shot from the hero down the aim. */
export interface Shot {
  live: boolean;
  x: number;
  z: number;
  facing: number;
  /** Blocks it still flies. */
  left: number;
  move: MoveDef;
  /** True when it carries a strong hit. */
  strong: boolean;
  /** How many things it has hit. */
  hits: number;
}

export interface Rig {
  kind: PlacedKind;
  /** The middle of its cell. A channel's other two cells lie `alongX` or along z either side. */
  x: number;
  z: number;
  alongX: boolean;
  /** False once it has gone off. It stays on the ground a moment, then goes. */
  armed: boolean;
  /** Seconds since it went off. */
  spent: number;
  /** Seconds it lies armed before it goes by itself: the slick a dodge leaves. Infinity for one that waits. */
  life: number;
}

export type FightEventType =
  | 'brought' | 'wake' | 'tell' | 'strike' | 'swing' | 'hit' | 'whiff' | 'charged' | 'swap' | 'dodge' | 'dodged' | 'heroHurt' | 'faint' | 'woke'
  | 'guard' | 'segment' | 'dizzy' | 'recovered' | 'enraged' | 'slowed' | 'crash' | 'stall' | 'calming' | 'calmed' | 'won'
  | 'shot' | 'shotHit' | 'burst' | 'strongReady' | 'strongHit'
  | 'companionStrike' | 'skill' | 'blocked' | 'guarded' | 'mend'
  | 'rigPlaced' | 'rigTaken' | 'rig' | 'denied'
  // Act 1: the Mark held out to a beast deeper than the Heartstone (`n` is its depth), a hit turned by a machine's
  // plates, the companion held and freed, the fox getting the hero up, a beast sliding or bolting, a salve used.
  | 'beyond' | 'plated' | 'grabbed' | 'freed' | 'revived' | 'slid' | 'bolted' | 'salve'
  // Milestone 3: a target was hit, or broke.
  | 'targetHit' | 'targetBroken';

/** Something that happened in a step, for the view's sounds, sparks and freezes. `n` and `text` depend on the type. */
export interface FightEvent {
  type: FightEventType;
  x: number;
  z: number;
  n: number;
  text: string;
}

/** What one fight came to. */
export interface FightRecord {
  /** `hero` for a fight, `world` for the traps, or `stag` for the Stag's hall. */
  way: Way | 'stag';
  /** The beast's kind, or two joined by a plus for two at once. */
  enemy: string;
  companion: string;
  /** The weapon in the hand when the beast woke, and every weapon used, in the turn each was first taken up. */
  weapon: WeaponKind;
  weapons: WeaponKind[];
  gentle: boolean;
  /** `open` while it is fought, `calmed` when it was won, `left` when it was dropped. */
  result: 'open' | 'calmed' | 'left';
  /** Seconds from the first rig in the hand to the beast waking. */
  setup: number;
  /** Seconds from the beast waking to its calming. */
  length: number;
  hitsTaken: number;
  /** Hits taken, by the attack that landed. */
  hitBy: Record<string, number>;
  /** Health lost in all, the least the hero had, and what was left at the end. */
  healthLost: number;
  lowest: number;
  healthLeft: number;
  faints: number;
  dodges: number;
  /** Attacks that passed through a dodge. */
  dodged: number;
  /** Attacks started, and those that hit nothing. */
  swings: number;
  whiffs: number;
  /** Presses that did something, and the longest stretch of the fight without one. */
  inputs: number;
  longestGap: number;
  shots: number;
  shotHits: number;
  swaps: number;
  /** Attacks a braced guard took for the hero, and hits it took half of. */
  blocks: number;
  guarded: number;
  /** Health the healer gave back. */
  healed: number;
  /** Strong hits the booster gave that landed. */
  strongHits: number;
  skills: number;
  rigsPlaced: number;
  rigsTriggered: number;
  /** Seconds of the fight with a rig in the hand. */
  placing: number;
  /** Each rig set down, as its kind and its cell from the arena's middle. */
  layout: string[];
  /** Charges that ended in the wall or a tree. */
  crashes: number;
  /** A boss fight's own numbers. Only a boss sets them (`src/game/fight/stag-hall.sim.ts`). */
  boss?: BossNumbers;
}

export interface FightOptions {
  way?: Way;
  weapon?: string;
  companion?: string;
  /** Longer lead times and weaker hits. */
  gentle?: boolean;
  /** The Heartstone: the Mark calms a beast whose depth is no higher. A hook for the power system, off by default. */
  reach?: number;
  /** The hero's health and stamina (`HeroStats`): from armour, a meal and the shrines. The lab's 100 and 100 by default. */
  stats?: FightStats;
  /** The gear record's step and fitting. Step 1 and no fitting by default. */
  gear?: FightGear;
  /** The kit's three slots. In the hero's way each thing in them can be set down, or used, once. */
  kit?: readonly (KitId | null)[];
  /** True turns a machine's plates on: a hit on its front mostly glances off. The world's fights have them; the lab is tuned without. */
  plates?: boolean;
  /** True when something else moves the hero and reports where they are with `placeHero`: the lab's body. */
  external?: boolean;
  /** A repeatable random number from 0 to 1. */
  random?: () => number;
  /** Called with a copy of the record when a fight is won, and when one in progress is dropped. */
  onEnd?: (record: FightRecord) => void;
}

/** The hero's numbers outside the lab. */
export interface FightStats { maxHealth: number; maxStamina: number }
/** What the bench made of the weapon: its step, 1 to 4, and its fitting. */
export interface FightGear { tier: number; fitting: FittingId | null }

export interface Fight {
  readonly way: Way;
  /** The hero's whole health and stamina in this fight. */
  readonly maxHealth: number;
  readonly maxStamina: number;
  readonly gentle: boolean;
  /** `idle` with no beast, `setup` until it wakes, `fight` until it is calmed, then `won`. */
  readonly phase: 'idle' | 'setup' | 'fight' | 'won';
  /** Seconds since the beast woke. */
  readonly clock: number;
  readonly hero: HeroState;
  readonly companion: CompanionState;
  readonly beasts: readonly BeastState[];
  readonly shapes: readonly Telegraph[];
  readonly shots: readonly Shot[];
  readonly rigs: readonly Rig[];
  readonly record: FightRecord;
  /** What happened since the caller last emptied it. */
  readonly events: FightEvent[];
  readonly input: FightInput;
  step(dt: number): void;
  press(kind: FightPress): void;
  /** Picks the fight or the traps. It clears the arena. */
  setWay(way: Way): void;
  /** Takes a weapon in hand, also in the middle of a fight. It cannot attack for a moment after. */
  setWeapon(kind: WeaponKind): void;
  /** Picks the companion. It clears the arena. */
  setCompanion(kind: string): void;
  setGentle(on: boolean): void;
  /** Brings a beast in, asleep at the den, in place of any other, and a second one beside it when `also` names one. */
  bring(kind: string, also?: string): BeastState;
  /** Brings several in at once, in a row across the den: a pack. Each has a share of its guard, and they take turns. */
  bringAll(foes: readonly FoeSpec[]): BeastState[];
  /** Act 1: the hero's numbers, the gear and the kit. Each takes effect at once; the kit and the stats also refill. */
  setStats(stats: FightStats): void;
  setGear(gear: FightGear): void;
  setKit(kit: readonly (KitId | null)[]): void;
  /** The kit things still unused, slot by slot: null for an empty or spent slot. */
  kitSlots(): (KitId | null)[];
  /** Uses the kit thing in this slot that is not set down: the salve. Returns why not, or null when it worked. */
  useKit(slot: number): string | null;
  /** Wakes every sleeping beast now. */
  wake(): void;
  /** Takes every beast and rig away and heals the hero. */
  clear(): void;
  /** The Heartstone, for the Mark's reach. */
  setReach(reach: number): void;
  /** Tells the fight where the hero is, when something else moves them. */
  placeHero(x: number, z: number): void;
  /** Sets a rig down on the cell that holds this point. Returns why not, or null when it stands. */
  placeRig(kind: PlacedKind, x: number, z: number): string | null;
  /** The same question without setting anything down. */
  canPlace(kind: PlacedKind, x: number, z: number): string | null;
  /** Takes back the rig that was set down last. False when none is left. */
  takeBack(): boolean;
  /** The seconds the skill on C has left, and its name: the companion's skill, or the lure in the traps. */
  skill(): { name: string; left: number; rest: number };
  /** The rigs still in the kit. */
  kit(): RigKind[];

  // ---------------------------------------------------------------------------------- milestone 3: the boss hooks
  /** Things to hit that are not beasts: a chain's pin, a lamp, a seed pod, the collar. */
  readonly targets: readonly Target[];
  /** Makes a target. The hero's attacks and the striker take its guard while it is `open`. */
  addTarget(spec: TargetSpec): Target;
  /** Takes a target away. */
  removeTarget(target: Target): void;
  /** Shows a shape on the ground that belongs to no beast. It lands on the hero like any attack. Null when every slot is in use. */
  threaten(spec: LooseShape): Telegraph | null;
  /** Takes a shape that `threaten` made off the ground before it lands. */
  cancel(shape: Telegraph): void;
}

/** What `addTarget` is given. */
export interface TargetSpec {
  x: number;
  z: number;
  radius: number;
  guard: number;
  /** Its name in events and the record. */
  name?: string;
  /** False makes it wait, unhittable, until something opens it. True by default. */
  open?: boolean;
  /** True for a target up on a boss: only the hero's own attacks reach it, not the companion. */
  high?: boolean;
}

/** Something the hero can hit that is not a beast. It loses guard like a beast and breaks at 0. */
export interface Target {
  readonly id: number;
  readonly name: string;
  x: number;
  z: number;
  radius: number;
  /** Guard left, and the guard it started with. */
  guard: number;
  readonly full: number;
  /** True while it can be hit. The boss that made it opens and shuts it. */
  open: boolean;
  /** True once its guard is gone. A broken target cannot be hit. */
  readonly broken: boolean;
  readonly high: boolean;
}

/** What `threaten` is given: a shape, its lead, and what it does where it lands. */
export interface LooseShape {
  kind: 'circle' | 'line' | 'cone';
  x: number;
  z: number;
  facing: number;
  /** A circle's radius, a cone's reach, a line's length. */
  reach: number;
  /** A line's width, or half a cone's angle. */
  width: number;
  lead: number;
  damage: number;
  heavy: boolean;
  /** The attack's name, for events and `hitBy` in the record. */
  id: string;
  /** Blocks a hit pushes the hero, in place of the usual push. A circle or cone pushes away from its middle, a line straight out from its middle line. */
  push?: number;
}

/** A boss's numbers in the record. */
export interface BossNumbers {
  /** Seconds spent in each phase, from the first. */
  phases: number[];
  /** The longest stretch, in seconds, in which the boss had no attack of its own on the ground, and the same for each phase. */
  quiet: number;
  quietByPhase: number[];
  /** What else the boss counts, by name: pins broken, pods cut, falls from the ramp. */
  counts: Record<string, number>;
}

// ---------------------------------------------------------------------------------------- the rules

const SHAPES = 12, SHOTS = 8;
/** A sum of sixtieths falls a hair short of the tenth it should make: a cut lands on its sixth step of the body, not its seventh. */
const TIME_SLACK = 1e-6;
/** The turns a walker tries, one after another, when the straight way is shut. */
const TURNS = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1];
const RIG_KINDS: readonly RigKind[] = ['lamp', 'snare', 'plate', 'channel'];
/** A pair stands this far either side of the den. */
const PAIR_APART = 2.6;

interface Beast extends BeastState {
  rests: number[];
  /** Blocks left of a charge, and whether it has hit the hero already. */
  run: number;
  hitHero: boolean;
  shape: Telegraph | null;
  /** True in a step where the hero holds the Mark out to it. */
  calming: boolean;
  markLeft: number;
  /** Seconds it is made to go for the companion's lure. */
  drawn: number;
  /** The speed it is thrown at. */
  flyX: number;
  flyZ: number;
  /** A hit's push: its first speed, the seconds left of it, and the seconds it lasts in all. */
  pushX: number;
  pushZ: number;
  pushLeft: number;
  pushTime: number;
  /** The fight's clock when its last attack landed, for taking turns. */
  landedAt: number;
}

function emptyRecord(way: Way, companion: string, weapon: WeaponKind, gentle: boolean, health: number = HERO.health): FightRecord {
  return {
    way, enemy: '', companion, weapon, weapons: [], gentle, result: 'open', setup: 0, length: 0,
    hitsTaken: 0, hitBy: {}, healthLost: 0, lowest: health, healthLeft: health, faints: 0, dodges: 0, dodged: 0, swings: 0, whiffs: 0,
    inputs: 0, longestGap: 0, shots: 0, shotHits: 0, swaps: 0, blocks: 0, guarded: 0, healed: 0, strongHits: 0, skills: 0,
    rigsPlaced: 0, rigsTriggered: 0, placing: 0, layout: [], crashes: 0,
  };
}

export function createFight(stage: Stage, options: FightOptions = {}): Fight {
  let way: Way = options.way ?? 'hero';
  let gentle = options.gentle ?? false;
  let reach = options.reach ?? Infinity;
  const external = options.external ?? false;
  const random = options.random ?? (() => 0.5);
  // Act 1: the hero's numbers, the gear and the kit.
  let maxHealth = options.stats?.maxHealth ?? HERO.health, maxStamina = options.stats?.maxStamina ?? HERO.stamina;
  let gear: FightGear = options.gear ?? { tier: 1, fitting: null };
  let kit: (KitId | null)[] = [...(options.kit ?? [])];
  /** The hero's hits that landed in this fight, for the quill edge's every third. */
  let heroHits = 0;
  /** True once the fox got the hero up in this fight. */
  let revived = false;

  const input: FightInput = { moveX: 0, moveZ: 0, aimX: stage.den.x, aimZ: stage.den.z, attackHeld: false, calmHeld: false, placing: false };
  const pressed: Record<FightPress, number> = { attack: 0, dodge: 0, skill: 0, use: 0 };
  const events: FightEvent[] = [];
  let weapon: WeaponDef = weaponOf(options.weapon ?? 'sword');
  const hero: HeroState & { landed: boolean; slow: number; sinceSpent: number; pushX: number; pushZ: number; pushLeft: number; pushTime: number; dodgeX: number; dodgeZ: number } = {
    x: stage.start.x, z: stage.start.z, facing: 0, health: maxHealth, stamina: maxStamina, weapon: weapon.kind, act: 'none', move: null, t: 0, cuts: 0,
    charge: 0, charged: false, swap: 0, strong: false, bloom: 0, burstX: 0, burstZ: 0, safe: 0, sinceHit: 99,
    driven: false, driveX: 0, driveZ: 0, pace: 1, shoveX: 0, shoveZ: 0,
    landed: false, slow: 0, sinceSpent: 9, pushX: 0, pushZ: 0, pushLeft: 0, pushTime: 1, dodgeX: 0, dodgeZ: 0,
  };
  const companion: CompanionState & { target: Beast | null; toStrike: number; pounce: boolean; goX: number; goZ: number; lureRest: number } = {
    def: companionOf(options.companion ?? 'leaftail'), x: stage.start.x + 1.2, z: stage.start.z + 0.8, facing: 0, mode: 'heel', rest: 0,
    strikeT: 0, struckX: 0, struckZ: 0, healing: false, moving: false, left: 0, boostIn: 0,
    target: null, toStrike: 0, pounce: false, goX: 0, goZ: 0, lureRest: 0,
  };
  const beasts: Beast[] = [];
  const shapes: Telegraph[] = Array.from({ length: SHAPES }, () => ({ live: false, kind: 'circle', x: 0, z: 0, facing: 0, reach: 0, width: 0, t: 0, lead: 0, owner: -1, end: 0, grab: false }));
  const shots: Shot[] = Array.from({ length: SHOTS }, () => ({ live: false, x: 0, z: 0, facing: 0, left: 0, move: weapon.quick, strong: false, hits: 0 }));
  /** The beasts each shot has hit, so one that passes through hits each once. */
  const shotHit: number[][] = Array.from({ length: SHOTS }, () => []);
  const rigs: Rig[] = [];
  let record = emptyRecord(way, companion.def.kind, weapon.kind, gentle, maxHealth);
  let phase: Fight['phase'] = 'idle';
  let clock = 0, lastInput = 0, setupFrom = -1, sinceStart = 0, nextId = 1;
  /** The kinds of rig set down in this fight. The kit holds one of each. */
  const usedKinds = new Set<RigKind>();
  /** The beast the hero hit last: the striker goes for it. */
  let focus: Beast | null = null;

  const emit = (type: FightEventType, x: number, z: number, n = 0, text = ''): void => { events.push({ type, x, z, n, text }); };

  /** A press that did something: counted, and the gap since the last one measured. */
  function useful(): void {
    if (phase !== 'fight') return;
    record.inputs++;
    if (clock - lastInput > record.longestGap) record.longestGap = clock - lastInput;
    lastInput = clock;
  }

  function used(kind: WeaponKind): void {
    if (!record.weapons.includes(kind)) record.weapons.push(kind);
  }

  // ------------------------------------------------ the ground

  function inChannel(x: number, z: number): boolean {
    for (let i = 0; i < rigs.length; i++) {
      const r = rigs[i] as Rig;
      if (r.kind !== 'channel' || !r.armed) continue;
      const half = RIG.channel / 2;
      if (r.alongX ? Math.abs(x - r.x) <= half && Math.abs(z - r.z) <= 0.5 : Math.abs(z - r.z) <= half && Math.abs(x - r.x) <= 0.5) return true;
    }
    return false;
  }
  const wet = (x: number, z: number): boolean => stage.water(x, z) || inChannel(x, z);
  const shut = (x: number, z: number): boolean => stage.solid(x, z) || !stage.inside(x, z) || wet(x, z);
  /** True inside a lamp post's circle of light: a beast that fears light does not come in. */
  function inLight(x: number, z: number): boolean {
    for (let i = 0; i < rigs.length; i++) {
      const r = rigs[i] as Rig;
      if (r.kind === 'lamp_post_kit' && r.armed && inCircle(x, z, r.x, r.z, KIT_FIGHT.lampRadius)) return true;
    }
    return false;
  }
  /** True when a body this wide can stand here. `fears` keeps it out of a lamp post's light. */
  function free(x: number, z: number, radius: number, fears = false): boolean {
    const r = radius * 0.7;
    if (fears && inLight(x, z)) return false;
    return !shut(x, z) && !shut(x + r, z) && !shut(x - r, z) && !shut(x, z + r) && !shut(x, z - r);
  }

  /** Walks a body toward a point, around what is in the way. True when it moved. */
  function walk(body: { x: number; z: number; facing: number }, tx: number, tz: number, speed: number, dt: number, radius: number, fears = false): boolean {
    const dx = tx - body.x, dz = tz - body.z, distance = Math.hypot(dx, dz);
    if (distance < 0.05) return false;
    const step = Math.min(distance, speed * dt), toward = facingOf(dx, dz);
    for (let i = 0; i < TURNS.length; i++) {
      const turn = toward + (TURNS[i] as number), nx = body.x + dirX(turn) * step, nz = body.z + dirZ(turn) * step;
      if (!free(nx, nz, radius, fears)) continue;
      body.x = nx;
      body.z = nz;
      body.facing = toward;
      return true;
    }
    return false;
  }

  // ------------------------------------------------ shapes on the ground

  /** The lead an attack shows for: shorter once the beast is enraged (but for a follow-up), never under note 05's least, longer when gentle. */
  function leadOf(b: Beast, a: AttackDef): number {
    // A follow-up lands where the hero went: it keeps its whole lead.
    const lead = b.enraged && !a.follows ? Math.max(RAGE.least, a.lead * RAGE.lead) : a.lead;
    return lead * (gentle ? GENTLE.lead : 1);
  }

  function showShape(b: Beast, a: AttackDef, tx: number, tz: number): Telegraph | null {
    for (let i = 0; i < SHAPES; i++) {
      const s = shapes[i] as Telegraph;
      if (s.live) continue;
      s.live = true;
      s.kind = a.shape;
      const there = a.shape === 'circle' && a.at === 'target', onCompanion = a.shape === 'circle' && a.at === 'companion';
      s.x = onCompanion ? companion.x : there ? tx : b.x;
      s.z = onCompanion ? companion.z : there ? tz : b.z;
      s.grab = a.grabs === true;
      s.facing = b.facing;
      // A line stops where a wall, water or the arena's edge stops its front. A charge's says what it ends on.
      s.reach = a.shape === 'line' ? clearRun(b, a.reach) + b.def.radius : a.reach;
      s.end = a.shape === 'line' && a.charge > 0 ? runEnd : 0;
      s.width = a.width;
      s.t = 0;
      s.lead = leadOf(b, a);
      s.owner = b.id;
      return s;
    }
    return null;
  }

  /** What the last `clearRun` ended on, as `Telegraph.end` has it. */
  let runEnd: 0 | 1 | 2 = 0;
  /** How far a charge gets before a wall, water or the arena's edge stops its front. */
  function clearRun(b: Beast, most: number): number {
    const fx = dirX(b.facing), fz = dirZ(b.facing), front = b.def.radius;
    runEnd = 0;
    for (let d = 0; d < most; d += 0.25) {
      const x = b.x + fx * (d + front), z = b.z + fz * (d + front);
      if (!shut(x, z)) continue;
      runEnd = stage.solid(x, z) ? 1 : 2;
      return Math.max(0.5, d);
    }
    return most;
  }

  /** True when the point is inside the shape. */
  function covers(s: Telegraph, x: number, z: number, grow: number): boolean {
    if (s.kind === 'circle') return inCircle(x, z, s.x, s.z, s.reach + grow);
    if (s.kind === 'line') return inLine(x, z, s.x, s.z, s.facing, s.reach, s.width, grow);
    return inCone(x, z, s.x, s.z, s.facing, s.reach, s.width, grow);
  }

  function dropShape(b: Beast): void {
    if (b.shape) b.shape.live = false;
    b.shape = null;
  }

  /** The shape about to land on this point, if any. `hurts` leaves out a shape that only takes hold of the companion. */
  function threat(x: number, z: number, grow: number, hurts = false): Telegraph | null {
    for (let i = 0; i < SHAPES; i++) {
      const s = shapes[i] as Telegraph;
      if (hurts && s.grab) continue;
      if (s.live && s.t < s.lead && covers(s, x, z, grow)) return s;
    }
    return null;
  }

  // ------------------------------------------------ the hero

  function act(next: HeroAct, move: MoveDef | null = null): void {
    hero.act = next;
    hero.move = move;
    hero.t = 0;
    hero.landed = false;
    if (next === 'none') hero.cuts = 0;
  }

  /** True for a beast that still has guard to lose. */
  const stillUp = (b: BeastState): boolean => b.doing !== 'dizzy' && b.doing !== 'calmed';
  /** True for a beast deeper than the Mark reaches. A machine is shut down, not calmed: the Mark always reaches it. */
  const beyond = (b: BeastState): boolean => !b.def.machine && b.depth > reach;

  /** The way to the pointer, bent to a beast or an open target near it: within `angle` and `range` blocks. */
  function aimFacing(angle: number, range: (radius: number) => number): number {
    const aim = facingOf(input.aimX - hero.x, input.aimZ - hero.z);
    let best = aim, bestTurn = angle;
    if (angle <= 0) return aim;
    for (let i = 0; i < beasts.length; i++) {
      const b = beasts[i] as Beast;
      if (b.doing === 'calmed') continue;
      const dx = b.x - hero.x, dz = b.z - hero.z;
      if (Math.hypot(dx, dz) > range(b.def.radius)) continue;
      const to = facingOf(dx, dz), turn = Math.abs(turnBetween(aim, to));
      if (turn < bestTurn) { bestTurn = turn; best = to; }
    }
    // Milestone 3: an open target bends it as a beast does.
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i] as TargetInner, dx = t.x - hero.x, dz = t.z - hero.z;
      if (!t.open || t.broken || Math.hypot(dx, dz) > range(t.radius)) continue;
      const to = facingOf(dx, dz), turn = Math.abs(turnBetween(aim, to));
      if (turn < bestTurn) { bestTurn = turn; best = to; }
    }
    return best;
  }

  /** Starts one of the weapon's moves. */
  function startMove(move: MoveDef): void {
    const again = hero.act === move.id && move.chain > 0;
    act(move.id, move);
    hero.cuts = again ? 2 : 1;
    if (move.kind === 'arc') hero.facing = aimFacing(HERO.magnet.angle, (r) => move.reach + r + HERO.magnet.near);
    else if (move.kind === 'shot') hero.facing = aimFacing(move.aimAngle, () => move.aimRange);
    else if (move.kind === 'burst') {
      // At the pointer, as far as the staff reaches.
      const dx = input.aimX - hero.x, dz = input.aimZ - hero.z, d = Math.hypot(dx, dz), k = d > move.range ? move.range / d : 1;
      hero.burstX = hero.x + dx * k;
      hero.burstZ = hero.z + dz * k;
      hero.facing = facingOf(dx, dz);
    }
    record.swings++;
    useful();
    emit('swing', move.kind === 'burst' ? hero.burstX : hero.x, move.kind === 'burst' ? hero.burstZ : hero.z, hero.cuts, move.id);
  }

  /** How much more than its own guard the hero's next hit breaks. */
  const power = (): number => (hero.strong ? HERO.strong : 1) * (hero.bloom > 0 ? COMPANION.bloomGuard : 1);

  /** A strong hit landed: it is spent, and the booster starts counting to the next. */
  function spendStrong(x: number, z: number): void {
    if (!hero.strong) return;
    hero.strong = false;
    record.strongHits++;
    companion.boostIn = COMPANION.boostEvery;
    emit('strongHit', x, z);
  }

  /**
   * How much of the hero's hit gets through, by the gear: the weapon's step, the quill edge's every third hit, the
   * spring hilt's held moves, and a machine's plates, which turn a hit on its front (brass gets more through).
   */
  function gearShare(b: Beast, move: MoveDef): number {
    heroHits++;
    let k = HERO_STATS.tier[Math.max(0, Math.min(3, gear.tier - 1))] as number;
    if (gear.fitting === 'quill_edge' && heroHits % FITTING.quillEvery === 0) k *= FITTING.quillGuard;
    if (gear.fitting === 'spring_hilt' && move === weapon.held) k *= FITTING.springGuard;
    const plates = b.def.plates;
    if (options.plates && plates !== undefined && stillUp(b)) {
      // Its back is the half away from the way it faces.
      const front = Math.abs(turnBetween(b.facing, facingOf(hero.x - b.x, hero.z - b.z))) < Math.PI / 2;
      if (front) {
        k *= Math.min(1, plates * (gear.tier >= 3 ? FITTING.brassPlates : 1));
        emit('plated', b.x, b.z, 0, move.id);
      }
    }
    // A rootsnare holding the companion has its heart shut.
    if (companion.mode === 'held' && grabber === b) k *= ROOTED.shut;
    return k;
  }

  /** One of the hero's hits lands on a beast. */
  function hitBeast(b: Beast, move: MoveDef, mult: number, fromX: number, fromZ: number): void {
    emit('hit', b.x, b.z, hero.cuts, move.id);
    // A small beast is pushed. A steady one stands until its guard is empty.
    if (move.push > 0 && !b.def.rooted && (!b.def.steady || b.doing === 'dizzy')) shove(b, move.push, move.pushTime, fromX, fromZ);
    const marks = move.marks + (gear.fitting === 'glow_cap' ? FITTING.glowMarks : 0);
    if (marks > 0 && stillUp(b)) {
      b.marks = Math.min(3, b.marks + marks);
      b.markLeft = 4;
    }
    if (move.slow > 0 && stillUp(b)) { b.slow = move.slow; emit('slowed', b.x, b.z); }
    hurtGuard(b, move.guard * mult * gearShare(b, move), 'hero');
    if (stillUp(b)) focus = b;
  }

  /** The moment a move lands: an arc, a ring or a burst hits what is in it at once, a shot starts flying. */
  function land(move: MoveDef): void {
    hero.landed = true;
    if (move.kind === 'shot') { fire(move); return; }
    const mult = power();
    let hits = 0;
    const cx = move.kind === 'burst' ? hero.burstX : hero.x, cz = move.kind === 'burst' ? hero.burstZ : hero.z;
    if (move.kind === 'burst') emit('burst', cx, cz, move.reach);
    for (let i = 0; i < beasts.length; i++) {
      const b = beasts[i] as Beast;
      if (b.doing === 'calmed') continue;
      const grow = b.def.radius + 0.25;
      const inside = move.kind === 'arc'
        ? inCone(b.x, b.z, hero.x, hero.z, hero.facing, move.reach, move.width, grow)
        : inCircle(b.x, b.z, cx, cz, move.reach + grow);
      if (!inside) continue;
      hits++;
      hitBeast(b, move, mult, cx, cz);
    }
    hits += landOnTargets(move, mult, cx, cz); // Milestone 3: targets.
    if (hits > 0) spendStrong(cx, cz);
    else {
      record.whiffs++;
      emit('whiff', move.kind === 'burst' ? cx : hero.x + dirX(hero.facing) * 1.4, move.kind === 'burst' ? cz : hero.z + dirZ(hero.facing) * 1.4, 0, move.id);
    }
  }

  /** Starts a push on a beast, away from a point: `push` blocks over `time` seconds. */
  function shove(b: Beast, push: number, time: number, fromX: number, fromZ: number): void {
    const dx = b.x - fromX, dz = b.z - fromZ, away = Math.hypot(dx, dz) || 1;
    // It starts fast and slows to a stop, so its first speed is twice its mean.
    b.pushX = (dx / away) * (2 * push) / time;
    b.pushZ = (dz / away) * (2 * push) / time;
    b.pushLeft = b.pushTime = time;
  }

  function startDodge(): void {
    const wish = Math.hypot(input.moveX, input.moveZ);
    // With no key held it is a step back, away from where the hero looks.
    hero.dodgeX = wish > 0.05 ? input.moveX / wish : -dirX(hero.facing);
    hero.dodgeZ = wish > 0.05 ? input.moveZ / wish : -dirZ(hero.facing);
    act('dodge');
    hero.charge = 0;
    hero.charged = false;
    hero.pushLeft = 0;
    hero.safe = Math.max(hero.safe, HERO.dodge.safe);
    hero.stamina -= HERO.dodge.cost;
    hero.sinceSpent = 0;
    record.dodges++;
    useful();
    emit('dodge', hero.x, hero.z);
    // The slick sheath leaves a slick where the dodge began.
    if (gear.fitting === 'slick_sheath') rigs.push({ kind: 'slick_patch', x: hero.x, z: hero.z, alongX: true, armed: true, spent: 0, life: FITTING.slickTime });
  }

  /** A shot leaves the hero down the way they face. A strong hit goes with it, and comes back if it hits nothing. */
  function fire(move: MoveDef): void {
    for (let i = 0; i < SHOTS; i++) {
      const shot = shots[i] as Shot;
      if (shot.live) continue;
      shot.live = true;
      shot.x = hero.x + dirX(hero.facing) * 0.4;
      shot.z = hero.z + dirZ(hero.facing) * 0.4;
      shot.facing = hero.facing;
      shot.left = move.range;
      shot.move = move;
      shot.strong = hero.strong;
      shot.hits = 0;
      (shotHit[i] as number[]).length = 0;
      hero.strong = false;
      record.shots++;
      emit('shot', shot.x, shot.z, move.pierce ? 1 : 0, move.id);
      return;
    }
  }

  function stepShots(dt: number): void {
    for (let i = 0; i < SHOTS; i++) {
      const shot = shots[i] as Shot;
      if (!shot.live) continue;
      const move = shot.move, hit = shotHit[i] as number[];
      const step = Math.min(shot.left, move.speed * dt);
      shot.x += dirX(shot.facing) * step;
      shot.z += dirZ(shot.facing) * step;
      shot.left -= step;
      const mult = (shot.strong ? HERO.strong : 1) * (hero.bloom > 0 ? COMPANION.bloomGuard : 1);
      let done = false;
      for (let j = 0; j < beasts.length && !done; j++) {
        const b = beasts[j] as Beast;
        if (b.doing === 'calmed' || hit.includes(b.id) || !inCircle(shot.x, shot.z, b.x, b.z, b.def.radius + move.radius)) continue;
        hit.push(b.id);
        shot.hits++;
        record.shotHits++;
        emit('shotHit', shot.x, shot.z, b.marks + move.marks, move.id);
        hitBeast(b, move, mult, shot.x - dirX(shot.facing), shot.z - dirZ(shot.facing));
        if (shot.strong) { shot.strong = false; hero.strong = true; spendStrong(b.x, b.z); }
        if (!move.pierce) done = true;
      }
      if (!done && shotOnTargets(shot, mult)) done = !move.pierce; // Milestone 3: a target.
      if (!done && (shot.left <= 0 || stage.solid(shot.x, shot.z) || !stage.inside(shot.x, shot.z))) done = true;
      if (!done) continue;
      shot.live = false;
      if (shot.hits === 0) {
        record.whiffs++;
        emit('whiff', shot.x, shot.z, 0, move.id);
        // A strong hit that hit nothing is not lost.
        if (shot.strong) hero.strong = true;
      }
    }
  }

  /**
   * A hit on the hero from (fx, fz). False when it passed: a dodge, or the moment after another hit. `share` is
   * the part of it that reaches them: less with the guard standing between.
   */
  function hurtHero(damage: number, heavy: boolean, fx: number, fz: number, attack: string, pushBlocks?: number, share = 1): boolean {
    if (hero.act === 'faint') return false;
    if (hero.safe > 0) {
      if (hero.act === 'dodge') { record.dodged++; emit('dodged', hero.x, hero.z); }
      return false;
    }
    const lost = Math.min(hero.health, damage * (gentle ? GENTLE.damage : 1) * share);
    hero.health -= lost;
    record.healthLost += lost;
    record.hitsTaken++;
    record.hitBy[attack] = (record.hitBy[attack] ?? 0) + 1;
    hero.sinceHit = 0;
    if (share < 1) { record.guarded++; emit('guarded', companion.x, companion.z, 0, attack); }
    const dx = hero.x - fx, dz = hero.z - fz, away = Math.hypot(dx, dz) || 1;
    const push = pushBlocks ?? (heavy ? HERO.hurt.heavyPush : HERO.hurt.push);
    hero.pushTime = hero.pushLeft = heavy ? HERO.hurt.heavyPushTime : HERO.hurt.pushTime;
    // The push starts fast and slows to a stop, so its first speed is twice its mean.
    hero.pushX = (dx / away) * (2 * push) / hero.pushTime;
    hero.pushZ = (dz / away) * (2 * push) / hero.pushTime;
    hero.safe = HERO.hurt.safe;
    hero.charge = 0;
    hero.charged = false;
    emit('heroHurt', hero.x, hero.z, heavy ? 1 : 0, attack);
    if (hero.health <= 0.001 && way === 'hero' && !revived && companion.def.revive && companion.mode !== 'held') {
      // The fox gets the hero up, once a fight.
      revived = true;
      hero.health = maxHealth * companion.def.revive;
      hero.safe = HERO.wakeSafe;
      act('hurt');
      emit('revived', hero.x, hero.z, hero.health);
    } else if (hero.health <= 0.001) {
      hero.health = 0;
      act('faint');
      record.faints++;
      emit('faint', hero.x, hero.z);
      // The companion stops what it does and stands by the hero.
      companion.mode = 'heel';
      companion.target = null;
      companion.pounce = false;
      // Nothing hits a fainted hero: every beast lets its attack go.
      for (let i = 0; i < beasts.length; i++) {
        const b = beasts[i] as Beast;
        if (b.doing === 'windup' || b.doing === 'charge' || b.doing === 'recover') { dropShape(b); go(b, 'stalk', 0); }
      }
    } else {
      act('hurt');
    }
    if (hero.health < record.lowest) record.lowest = hero.health;
    return true;
  }

  function wakeHero(): void {
    hero.x = stage.wake.x;
    hero.z = stage.wake.z;
    hero.health = maxHealth;
    hero.stamina = maxStamina;
    hero.safe = HERO.wakeSafe;
    hero.pushLeft = 0;
    act('none');
    emit('woke', hero.x, hero.z);
  }

  function stepHero(dt: number): void {
    const h = hero;
    h.safe = Math.max(0, h.safe - dt);
    h.slow = Math.max(0, h.slow - dt);
    h.swap = Math.max(0, h.swap - dt);
    h.bloom = Math.max(0, h.bloom - dt);
    h.sinceHit += dt;
    h.sinceSpent += dt;
    if (h.sinceSpent >= HERO.staminaWait) h.stamina = Math.min(maxStamina, h.stamina + HERO.staminaBack * (gear.fitting === 'honey_binding' ? FITTING.honeyStamina : 1) * dt);
    h.t += dt;
    h.driven = false;
    h.driveX = h.driveZ = 0;
    h.pace = h.slow > 0 ? 0.5 : 1;

    if (h.act === 'faint') {
      h.pace = 0;
      if (h.t >= HERO.faint) wakeHero();
      return;
    }
    if (h.pushLeft > 0) {
      const k = h.pushLeft / h.pushTime;
      h.driven = true;
      h.driveX = h.pushX * k;
      h.driveZ = h.pushZ * k;
      h.pushLeft -= dt;
    }
    const move = h.move;
    if (h.act === 'hurt') {
      h.pace = 0.3;
      if (h.t >= HERO.hurt.stagger) act('none');
    } else if (h.act === 'dodge') {
      h.driven = true;
      const speed = HERO.dodge.speed * (gear.fitting === 'padded_grip' ? FITTING.paddedDodge : 1);
      h.driveX = h.dodgeX * speed;
      h.driveZ = h.dodgeZ * speed;
      h.facing = facingOf(h.dodgeX, h.dodgeZ);
      if (h.t >= HERO.dodge.time) { act('none'); h.slow = HERO.dodge.after; }
    } else if (move) {
      h.pace = move.pace;
      if (!h.landed && h.t >= move.startup - TIME_SLACK) land(move);
      if (h.t >= move.total) act('none');
    }

    // Holding the Mark out to a dizzy beast. The hero stands still and can still be hit.
    let calmed: Beast | null = null;
    if (input.calmHeld && (h.act === 'none' || h.act === 'calm' || (move !== null && h.landed))) {
      let near: number = HERO.calm.reach;
      for (let i = 0; i < beasts.length; i++) {
        const b = beasts[i] as Beast, d = Math.hypot(b.x - h.x, b.z - h.z) - b.def.radius;
        // A dizzy beast, or one the Mark cannot reach at all: the hand is held out to it and nothing happens.
        if ((b.doing === 'dizzy' || (beyond(b) && b.doing !== 'calmed')) && d <= near) { near = d; calmed = b; }
      }
    }
    if (calmed) {
      if (h.act !== 'calm') { act('calm'); useful(); emit('calming', calmed.x, calmed.z); }
      h.pace = 0;
      h.facing = facingOf(calmed.x - h.x, calmed.z - h.z);
      calmed.calming = true;
      calmed.calm += dt / HERO.calm.hold;
      if (calmed.calm >= 1) {
        if (beyond(calmed)) {
          // The Mark's reach: the Mark cannot hold it, its guard empty or not.
          calmed.calm = 0;
          emit('beyond', calmed.x, calmed.z, calmed.depth, 'Your Mark cannot reach a Blight this deep yet.');
          if (calmed.doing === 'dizzy') recover(calmed);
        } else {
          finish(calmed);
        }
        act('none');
      }
    } else if (h.act === 'calm') {
      act('none');
    }

    // The held move: the button held from the quick move on, then let go.
    if (way === 'hero') {
      const held = weapon.held;
      if (input.attackHeld && h.swap <= 0 && (h.act === 'none' || h.act === weapon.quick.id)) {
        h.charge += dt * (h.bloom > 0 ? COMPANION.bloomCharge : 1);
        if (!h.charged && h.charge >= held.hold) { h.charged = true; emit('charged', h.x, h.z, 0, held.id); }
        if (h.act === 'none' && h.charge > 0.25) {
          h.pace = Math.min(h.pace, held.holdPace);
          // Drawing a bow or gathering the light, the hero faces the aim.
          if (held.kind !== 'ring') h.facing = facingOf(input.aimX - h.x, input.aimZ - h.z);
        }
      } else if (!input.attackHeld) {
        if (h.charged && h.act === 'none') startMove(held);
        h.charge = 0;
        h.charged = false;
      }
    }

    // What was pressed, when the hero can do it.
    const freeNow = h.act === 'none';
    if (pressed.dodge > 0) {
      const can = freeNow || h.act === 'calm' || (move !== null && h.t >= move.cancel);
      if (can) {
        pressed.dodge = 0;
        if (h.stamina >= HERO.dodge.cost) startDodge();
        else emit('denied', h.x, h.z, 0, 'Out of breath.');
      }
    }
    if (pressed.attack > 0) {
      if (way !== 'hero') pressed.attack = 0;
      else if (h.swap <= 0) {
        const quick = weapon.quick;
        if (freeNow || (h.act === quick.id && quick.chain > 0 && h.cuts === 1 && h.t >= quick.chain)) { pressed.attack = 0; startMove(quick); }
      }
    }
    if (pressed.skill > 0) { pressed.skill = 0; callSkill(); }
    if (pressed.use > 0) { pressed.use = 0; springByHand(); }

    if (h.act === 'none' && !h.driven && h.charge <= 0.25 && Math.hypot(input.moveX, input.moveZ) > 0.05) h.facing = facingOf(input.moveX, input.moveZ);

    // A beast's body is in the way: the hero is eased out of it.
    h.shoveX = h.shoveZ = 0;
    if (h.act !== 'dodge') {
      for (let i = 0; i < beasts.length; i++) {
        const b = beasts[i] as Beast, dx = h.x - b.x, dz = h.z - b.z, d = Math.hypot(dx, dz), keep = b.def.radius + 0.3;
        if (d >= keep || b.doing === 'charge') continue;
        const out = d > 0.01 ? 1 / d : 0;
        h.shoveX += (out ? dx * out : 1) * 3.5;
        h.shoveZ += (out ? dz * out : 0) * 3.5;
      }
    }

    if (!external) {
      // In the pond the hero swims, slower, as the body does in the lab.
      const legs = stage.swim?.(h.x, h.z) ? HERO.swim : HERO.walk;
      const vx = (h.driven ? h.driveX : input.moveX * legs * h.pace) + h.shoveX;
      const vz = (h.driven ? h.driveZ : input.moveZ * legs * h.pace) + h.shoveZ;
      if (!stage.solid(h.x + vx * dt, h.z)) h.x += vx * dt;
      if (!stage.solid(h.x, h.z + vz * dt)) h.z += vz * dt;
    }
  }

  // ------------------------------------------------ the companion

  /** The nearest beast that is awake and still has guard to lose, within `most` blocks of the hero. */
  function nearestUp(most: number): Beast | null {
    let best: Beast | null = null, near = most;
    for (let i = 0; i < beasts.length; i++) {
      const b = beasts[i] as Beast, d = Math.hypot(b.x - hero.x, b.z - hero.z);
      if (stillUp(b) && b.doing !== 'asleep' && d < near) { near = d; best = b; }
    }
    return best;
  }

  /** What the companion goes for: the beast the hero hit last, or the nearest one that is awake. */
  function companionTarget(): Beast | null {
    if (companion.def.keepsOff) {
      // Wren keeps the others off: the nearest beast awake that the hero is not fighting.
      let best: Beast | null = null, near = 16;
      for (let i = 0; i < beasts.length; i++) {
        const b = beasts[i] as Beast, d = Math.hypot(b.x - hero.x, b.z - hero.z);
        if (b !== focus && stillUp(b) && b.doing !== 'asleep' && d < near) { near = d; best = b; }
      }
      if (best) return best;
    }
    if (focus && stillUp(focus) && focus.doing !== 'asleep') return focus;
    return nearestUp(16);
  }

  function callSkill(): void {
    const c = companion;
    if (way === 'world') {
      // The traps: the companion goes to the pointer as a lure.
      if (c.lureRest > 0) { emit('denied', hero.x, hero.z, 0, 'Not yet.'); return; }
      c.mode = 'lure';
      c.goX = input.aimX;
      c.goZ = input.aimZ;
      c.left = COMPANION.lure;
      c.lureRest = COMPANION.lureRest;
      for (let i = 0; i < beasts.length; i++) (beasts[i] as Beast).drawn = COMPANION.lure;
      record.skills++;
      useful();
      emit('skill', c.goX, c.goZ, 0, 'Lure');
      return;
    }
    const skill = c.def.skill;
    if (c.rest > 0) { emit('denied', hero.x, hero.z, 0, 'Not yet.'); return; }
    const b = companionTarget();
    // With no beast, a striker's skill still goes for a boss's parts, when there are any.
    if ((skill.id === 'pounce' || skill.id === 'pin') && !b && targets.length === 0) { emit('denied', hero.x, hero.z, 0, 'Nothing to go for.'); return; }
    if (skill.id === 'mend' && hero.health >= maxHealth) { emit('denied', hero.x, hero.z, 0, 'You are not hurt.'); return; }
    c.rest = skill.rest;
    record.skills++;
    useful();
    if (skill.id === 'pounce' && b) {
      c.mode = 'engage';
      c.target = b;
      c.pounce = true;
      c.toStrike = 0;
      emit('skill', b.x, b.z, 0, skill.name);
    } else if ((skill.id === 'pounce' || skill.id === 'pin') && !b) {
      emit('skill', hero.x, hero.z, 0, skill.name);
    } else if (skill.id === 'pin' && b) {
      // An arrow through a paw: it stands where it is for a while.
      dropShape(b);
      go(b, 'held', skill.time);
      hurtGuard(b, skill.guard, 'companion');
      emit('skill', b.x, b.z, 0, skill.name);
    } else if (skill.id === 'brace') {
      // It plants itself between the hero and the beast and takes the next attack.
      c.mode = 'brace';
      c.left = skill.time;
      emit('skill', c.x, c.z, 0, skill.name);
    } else if (skill.id === 'mend') {
      const gain = Math.min(skill.heal, maxHealth - hero.health);
      hero.health += gain;
      record.healed += gain;
      emit('skill', hero.x, hero.z, 0, skill.name);
      emit('mend', hero.x, hero.z, gain);
    } else {
      hero.bloom = skill.time;
      emit('skill', hero.x, hero.z, 0, skill.name);
    }
  }

  // ------------------------------------------------ act 1: the companion held

  /** The beast that holds the companion, and the vines round it, while it is held. */
  let grabber: Beast | null = null, vines: TargetInner | null = null;

  function grab(b: Beast): void {
    const c = companion;
    c.mode = 'held';
    c.target = null;
    c.pounce = false;
    c.left = 0;
    grabber = b;
    vines = addTarget({ x: c.x, z: c.z, radius: ROOTED.radius, guard: ROOTED.vines, name: 'vines' }) as TargetInner;
    emit('grabbed', c.x, c.z, 0, b.def.kind);
  }

  /** The companion is free: the vines were cut, a salve was used, or the beast was calmed. */
  function free_(): void {
    if (companion.mode !== 'held') return;
    companion.mode = 'heel';
    grabber = null;
    if (vines) { removeTarget(vines); vines = null; }
    emit('freed', companion.x, companion.z);
  }

  /** A braced guard takes an attack: the hero takes nothing, and the beast that made it staggers. True when it did. */
  function braceTakes(b: Beast | null, attack: string): boolean {
    const c = companion;
    if (way !== 'hero' || c.mode !== 'brace') return false;
    if (!inCircle(hero.x, hero.z, c.x, c.z, COMPANION.cover)) return false;
    emit('blocked', c.x, c.z, 0, attack);
    record.blocks++;
    c.mode = 'heel';
    c.left = 0;
    if (b) {
      hurtGuard(b, c.def.skill.guard, 'companion');
      if (b.doing !== 'dizzy') { dropShape(b); go(b, 'stun', COMPANION.braceStagger); }
    }
    return true;
  }

  /** The share of a hit from (fx, fz) that reaches the hero: half with the guard standing between. */
  function guardShare(fx: number, fz: number): number {
    const c = companion;
    if (way !== 'hero' || c.def.role !== 'guard' || hero.act === 'faint') return 1;
    if (!inCircle(hero.x, hero.z, c.x, c.z, COMPANION.cover)) return 1;
    return Math.hypot(c.x - fx, c.z - fz) < Math.hypot(hero.x - fx, hero.z - fz) ? 1 - COMPANION.guardShare : 1;
  }

  /** An attack reaches the hero: a braced guard takes it, a guard standing between takes half. */
  function strikeHero(b: Beast | null, damage: number, heavy: boolean, fx: number, fz: number, attack: string, push?: number): void {
    if (braceTakes(b, attack)) return;
    hurtHero(damage, heavy, fx, fz, attack, push, guardShare(b ? b.x : fx, b ? b.z : fz));
  }

  /** The companion strikes a beast: its own weight, made stronger by every mark of the Mark's light on it, which it spends. */
  function companionStrike(b: Beast, amount: number): void {
    const c = companion;
    emit('companionStrike', b.x, b.z, b.marks, c.def.role);
    const mult = 1 + COMPANION.markBoost * b.marks;
    b.marks = 0;
    c.strikeT = 0.001;
    c.struckX = b.x;
    c.struckZ = b.z;
    hurtGuard(b, amount * mult, 'companion');
    // Wren's arrows pin a beast that is walking or standing.
    if (c.def.pins && (b.doing === 'stalk' || b.doing === 'alert' || b.doing === 'recover')) go(b, 'held', c.def.pins);
  }

  function stepCompanion(dt: number): void {
    const c = companion, def = c.def, speed = def.speed;
    c.rest = Math.max(0, c.rest - dt);
    c.lureRest = Math.max(0, c.lureRest - dt);
    if (c.strikeT > 0) { c.strikeT += dt; if (c.strikeT > 0.3) c.strikeT = 0; }
    c.moving = false;
    c.healing = false;
    const fighting = way === 'hero' && hero.act !== 'faint';
    // Held in the rootsnare's vines, it does nothing until the hero cuts it free.
    if (c.mode === 'held') return;

    // The healer mends the hero while nothing is about to land on them.
    if (fighting && def.role === 'healer' && hero.health < maxHealth && hero.sinceHit >= COMPANION.healWait && !threat(hero.x, hero.z, HERO.body)) {
      const gain = Math.min(COMPANION.heal * dt, maxHealth - hero.health);
      hero.health += gain;
      record.healed += gain;
      c.healing = true;
    }
    // The booster makes the next hit strong now and then, while a fight goes on.
    if (fighting && def.role === 'booster' && !hero.strong && phase === 'fight') {
      c.boostIn -= dt;
      if (c.boostIn <= 0) { hero.strong = true; c.boostIn = COMPANION.boostEvery; emit('strongReady', hero.x, hero.z); }
    }

    // A companion keeps itself out of the shapes on the ground. The guard stands in the way: that is its job.
    if (c.mode !== 'lure' && c.mode !== 'brace' && def.role !== 'guard') {
      const s = threat(c.x, c.z, COMPANION.body + 0.2, true);
      if (s) {
        let ax = c.x - s.x, az = c.z - s.z;
        if (s.kind === 'line') {
          // Out to the side it is already on.
          const fx = dirX(s.facing), fz = dirZ(s.facing), side = ax * fz - az * fx >= 0 ? 1 : -1;
          ax = fz * side;
          az = -fx * side;
        }
        const d = Math.hypot(ax, az) || 1;
        c.moving = walk(c, c.x + (ax / d) * 3, c.z + (az / d) * 3, speed * COMPANION.hurry, dt, COMPANION.body);
        return;
      }
    }

    if (c.mode === 'lure' || c.mode === 'brace') {
      c.left -= dt;
      let gx = c.goX, gz = c.goZ;
      if (c.mode === 'brace') {
        // Planted between the hero and the beast.
        const b = nearestUp(12);
        if (b) { const dx = b.x - hero.x, dz = b.z - hero.z, d = Math.hypot(dx, dz) || 1, k = Math.min(1.1, d * 0.5) / d; gx = hero.x + dx * k; gz = hero.z + dz * k; c.facing = facingOf(dx, dz); }
        else { gx = hero.x + dirX(hero.facing) * 0.9; gz = hero.z + dirZ(hero.facing) * 0.9; }
      }
      if (Math.hypot(gx - c.x, gz - c.z) > 0.3) c.moving = walk(c, gx, gz, speed * COMPANION.hurry, dt, COMPANION.body);
      if (c.left <= 0) c.mode = 'heel';
      return;
    }
    if (!fighting) { c.mode = 'heel'; heel(dt); return; }

    if (def.role === 'striker') {
      if (c.mode === 'engage' && !c.target && companionGoal) { companionAtTarget(dt); return; } // Milestone 3: a target.
      const b = c.pounce && c.target && stillUp(c.target) ? c.target : companionTarget();
      if (!b) {
        c.mode = 'heel';
        c.target = null;
        c.pounce = false;
        if (companionGoal) { c.mode = 'engage'; companionAtTarget(dt); return; }
        heel(dt);
        return;
      }
      if (c.target !== b) { c.target = b; c.toStrike = Math.max(c.toStrike, 0.25); }
      c.mode = 'engage';
      const d = Math.hypot(b.x - c.x, b.z - c.z), near = b.def.radius + def.range;
      if (d > near) {
        c.moving = walk(c, b.x, b.z, speed * (c.pounce ? COMPANION.hurry * 1.6 : 1), dt, COMPANION.body);
        return;
      }
      c.facing = facingOf(b.x - c.x, b.z - c.z);
      c.toStrike -= dt;
      if (c.pounce) {
        // A pounce is its own weight.
        emit('companionStrike', b.x, b.z, 0, 'pounce');
        c.pounce = false;
        c.strikeT = 0.001;
        c.toStrike = def.every;
        hurtGuard(b, def.skill.guard, 'companion');
      } else if (c.toStrike <= 0) {
        c.toStrike = def.every;
        companionStrike(b, def.strike);
      }
      return;
    }

    c.mode = 'heel';
    c.target = null;
    const b = nearestUp(16);
    if (def.role === 'guard' && b) {
      // Between the hero and the beast, a step from the hero.
      const dx = b.x - hero.x, dz = b.z - hero.z, d = Math.hypot(dx, dz) || 1, gap = Math.min(COMPANION.guardGap, d * 0.5);
      const gx = hero.x + (dx / d) * gap, gz = hero.z + (dz / d) * gap;
      if (Math.hypot(gx - c.x, gz - c.z) > 0.15) c.moving = walk(c, gx, gz, speed, dt, COMPANION.body);
      c.facing = facingOf(dx, dz);
    } else {
      heel(dt);
    }
    // Its own small strike, at a beast in its reach.
    c.toStrike -= dt;
    if (b && c.toStrike <= 0 && Math.hypot(b.x - c.x, b.z - c.z) - b.def.radius <= def.range) {
      c.toStrike = def.every;
      if (def.role !== 'guard') c.facing = facingOf(b.x - c.x, b.z - c.z);
      companionStrike(b, def.strike);
    }
  }

  /** At the hero's heel: a little behind them. */
  function heel(dt: number): void {
    const c = companion, d = Math.hypot(hero.x - c.x, hero.z - c.z);
    if (d > COMPANION.heel) c.moving = walk(c, hero.x, hero.z, d > 4 ? c.def.speed : Math.min(c.def.speed, 5), dt, COMPANION.body);
  }

  // ------------------------------------------------ beasts

  function go(b: Beast, doing: BeastDoing, until: number): void {
    b.doing = doing;
    b.t = 0;
    b.until = until;
    if (doing !== 'windup' && doing !== 'charge') b.attack = null;
  }

  /** Wakes a beast, and the one beside it: two brought in together wake together. */
  function wakeBeast(b: Beast): void {
    if (b.doing !== 'asleep') return;
    for (let i = 0; i < beasts.length; i++) {
      const o = beasts[i] as Beast;
      if (o.doing !== 'asleep') continue;
      o.passive = false;
      go(o, 'alert', WAKE_PAUSE);
      emit('wake', o.x, o.z);
    }
    if (phase === 'setup') {
      phase = 'fight';
      clock = 0;
      lastInput = 0;
      record.setup = setupFrom >= 0 ? sinceStart - setupFrom : 0;
      record.weapon = weapon.kind;
      used(weapon.kind);
      companion.boostIn = COMPANION.boostEvery;
    }
  }

  /** Takes guard away. `by` says who: the hero, the companion, or the world (a rig, a wall). */
  function hurtGuard(b: Beast, amount: number, by: 'hero' | 'companion' | 'world'): void {
    if (b.doing === 'calmed' || b.doing === 'dizzy') return;
    wakeBeast(b);
    const part = b.full / b.def.segments, before = b.guard;
    b.guard = Math.max(0, b.guard - amount);
    emit('guard', b.x, b.z, amount, by);
    if (b.guard <= 0.001) {
      b.guard = 0;
      dropShape(b);
      go(b, 'dizzy', b.def.dizzy * (gentle ? GENTLE.lead : 1));
      b.calm = 0;
      emit('dizzy', b.x, b.z);
      return;
    }
    if (!b.enraged && way === 'hero' && b.guard <= b.full * RAGE.at) {
      // Half its guard is gone: it comes faster from now on.
      b.enraged = true;
      emit('enraged', b.x, b.z);
    }
    if (Math.ceil(before / part - 1e-6) > Math.ceil(b.guard / part - 1e-6)) {
      // A part of the guard broke: it staggers, and the part stays broken.
      dropShape(b);
      go(b, 'stun', SEGMENT_STAGGER);
      emit('segment', b.x, b.z, Math.ceil(b.guard / part - 1e-6));
    }
  }

  /** Nobody calmed it in time: some guard comes back and it fights on. */
  function recover(b: Beast): void {
    b.guard = b.full * DIZZY_BACK;
    b.calm = 0;
    go(b, 'stalk', 0);
    emit('recovered', b.x, b.z);
  }

  function finish(b: Beast): void {
    if (b === grabber) free_();
    go(b, 'calmed', 0);
    b.calm = 1;
    b.marks = 0;
    b.slow = 0;
    emit('calmed', b.x, b.z, 0, b.def.gift);
    for (let i = 0; i < beasts.length; i++) if ((beasts[i] as Beast).doing !== 'calmed') return;
    if (clock - lastInput > record.longestGap) record.longestGap = clock - lastInput;
    record.result = 'calmed';
    record.length = clock;
    record.healthLeft = hero.health;
    phase = 'won';
    companion.mode = 'heel';
    companion.target = null;
    emit('won', b.x, b.z);
    options.onEnd?.(copyRecord());
  }

  const copyRecord = (): FightRecord => ({ ...record, hitBy: { ...record.hitBy }, layout: [...record.layout], weapons: [...record.weapons] });

  /** A lit lamp that draws this beast's charge, when one stands close enough. */
  function lampFor(b: Beast): Rig | null {
    if (!b.def.drawnToLight) return null;
    let best: Rig | null = null, near: number = RIG.lure;
    for (let i = 0; i < rigs.length; i++) {
      const r = rigs[i] as Rig, d = Math.hypot(r.x - b.x, r.z - b.z);
      if ((r.kind === 'lamp' || r.kind === 'lamp_post_kit') && r.armed && d < near) { near = d; best = r; }
    }
    return best;
  }

  /** Where the beast goes for now. False when there is nobody to go for. */
  const goal = { x: 0, z: 0, lamp: false };
  function pickGoal(b: Beast): boolean {
    goal.lamp = false;
    if (b.drawn > 0 && companion.mode === 'lure') {
      goal.x = companion.goX;
      goal.z = companion.goZ;
      return true;
    }
    const lamp = lampFor(b);
    if (lamp) { goal.x = lamp.x; goal.z = lamp.z; goal.lamp = true; return true; }
    if (hero.act === 'faint' || !stage.inside(hero.x, hero.z)) return false;
    goal.x = hero.x;
    goal.z = hero.z;
    return true;
  }

  /** True when no other beast has an attack still to land, or one that landed a moment ago: two beasts take turns. */
  function myTurn(b: Beast): boolean {
    for (let i = 0; i < beasts.length; i++) {
      const o = beasts[i] as Beast;
      if (o === b) continue;
      if (o.doing === 'windup' || o.doing === 'charge' || clock - o.landedAt < TURN_GAP) return false;
    }
    return true;
  }

  function begin(b: Beast, a: AttackDef): void {
    go(b, 'windup', 0);
    b.attack = a;
    b.shape = showShape(b, a, goal.x, goal.z);
    b.until = b.shape ? b.shape.lead : leadOf(b, a);
    emit('tell', b.x, b.z, b.until, a.id);
  }

  /** What comes after an attack: the one that follows it, or standing open. */
  function after(b: Beast, a: AttackDef): void {
    const id = b.enraged && a.rageThen && way === 'hero' ? a.rageThen : a.then;
    const next = id ? b.def.attacks.find((other) => other.id === id) : undefined;
    if (next && hero.act !== 'faint') {
      // A follow-up turns to where the hero is now.
      b.facing = facingOf(hero.x - b.x, hero.z - b.z);
      goal.x = hero.x;
      goal.z = hero.z;
      begin(b, next);
    }
    else go(b, 'recover', a.recover * (b.enraged ? RAGE.recover : 1));
  }

  /** The attack lands. A circle, a cone or a thrown line hits at once. A charge starts its run. */
  function strike(b: Beast, a: AttackDef): void {
    b.rests[b.def.attacks.indexOf(a)] = a.rest * (b.enraged ? RAGE.rest : 1);
    b.landedAt = clock;
    emit('strike', b.shape?.x ?? b.x, b.shape?.z ?? b.z, a.heavy ? 1 : 0, a.id);
    if (a.shape === 'line' && a.charge > 0) {
      go(b, 'charge', 0);
      b.attack = a;
      // The run is the attack's whole reach. What stands in the way ends it, as the line on the ground showed.
      b.run = a.reach;
      b.hitHero = false;
      return;
    }
    const s = b.shape;
    if (a.grabs) {
      // Roots come up under the companion and hold it.
      if (s && way === 'hero' && companion.mode !== 'held' && covers(s, companion.x, companion.z, COMPANION.body)) grab(b);
      if (b.doing === 'windup') after(b, a);
      return;
    }
    if (s && covers(s, hero.x, hero.z, HERO.body)) {
      // A ring or a cone pushes away from its middle, a thrown line straight out from its middle line.
      let fx = s.x, fz = s.z;
      if (s.kind === 'line') {
        const ux = dirX(s.facing), uz = dirZ(s.facing), along = (hero.x - s.x) * ux + (hero.z - s.z) * uz;
        fx = s.x + ux * along;
        fz = s.z + uz * along;
      }
      strikeHero(b, a.damage, a.heavy, fx, fz, a.id);
    } else if (s && way === 'hero' && companion.mode === 'brace' && covers(s, companion.x, companion.z, COMPANION.body)) {
      // Braced in the shape, the guard takes it even with the hero outside.
      braceTakes(b, a.id);
    }
    if (b.doing === 'windup') after(b, a);
  }

  function stepCharge(b: Beast, a: AttackDef, dt: number): void {
    const fx = dirX(b.facing), fz = dirZ(b.facing), step = Math.min(b.run, a.charge * (b.slow > 0 ? SLOWED : 1) * dt), front = b.def.radius;
    const nx = b.x + fx * step, nz = b.z + fz * step;
    const ahead = b.x + fx * (step + front), aheadZ = b.z + fz * (step + front);
    b.moving = true;
    if (stage.solid(ahead, aheadZ)) {
      // Into the wall or a tree: a share of its guard breaks and it is helpless for a while.
      dropShape(b);
      record.crashes++;
      emit('crash', ahead, aheadZ, 0, a.id);
      go(b, 'stun', b.def.crash);
      hurtGuard(b, b.full * (way === 'world' ? b.def.rigShare : FIGHT_CRASH), 'world');
      return;
    }
    if (inChannel(ahead, aheadZ)) {
      for (let i = 0; i < rigs.length; i++) {
        const r = rigs[i] as Rig;
        if (r.kind === 'channel' && r.armed) { setOff(r, b); return; }
      }
    }
    if (stage.water(ahead, aheadZ) || !stage.inside(ahead, aheadZ) || (b.def.fearsLight && inLight(ahead, aheadZ))) {
      // It will not cross water, and it stops at the arena's edge.
      dropShape(b);
      emit('stall', b.x, b.z);
      go(b, 'stun', WATER_STALL);
      return;
    }
    // A braced guard in the way stops the charge.
    const c = companion;
    if (way === 'hero' && c.mode === 'brace' && inCircle(c.x, c.z, b.x + fx * front, b.z + fz * front, 0.6) && braceTakes(b, a.id)) return;
    b.x = nx;
    b.z = nz;
    b.run -= step;
    if (b.shape) { b.shape.t = b.shape.lead + SHAPE_AFTER * 0.5; }
    if (!b.hitHero && inCircle(hero.x, hero.z, b.x, b.z, b.def.radius + HERO.body + 0.1)) { b.hitHero = true; strikeHero(b, a.damage, a.heavy, b.x - fx, b.z - fz, a.id); }
    if (b.doing !== 'charge') return;
    if (touchRigs(b)) return;
    if (b.run <= 0.001) {
      dropShape(b);
      after(b, a);
    }
  }

  function stepBeast(b: Beast, dt: number): void {
    b.t += dt;
    b.moving = false;
    for (let i = 0; i < b.rests.length; i++) b.rests[i] = Math.max(0, (b.rests[i] as number) - dt);
    b.drawn = Math.max(0, b.drawn - dt);
    b.slow = Math.max(0, b.slow - dt);
    if (b.markLeft > 0) { b.markLeft -= dt; if (b.markLeft <= 0) b.marks = 0; }
    if (b.pushLeft > 0) {
      // A push, slowing to a stop. What stands in the way stops it.
      // The speed at the middle of the step, so the push covers its distance exactly at any dt.
      const step = Math.min(dt, b.pushLeft), k = (b.pushLeft - step / 2) / b.pushTime;
      const nx = b.x + b.pushX * k * step, nz = b.z + b.pushZ * k * step;
      if (free(nx, nz, b.def.radius)) { b.x = nx; b.z = nz; } else b.pushLeft = 0;
      b.pushLeft = Math.max(0, b.pushLeft - dt);
    }
    const held = b.calming;
    if (!held && b.doing === 'dizzy') b.calm = Math.max(0, b.calm - dt * 1.5);
    b.calming = false;

    switch (b.doing) {
      case 'asleep':
        // A passive beast waits and watches the hero, and does not fight until it is hit.
        if (b.passive) { b.facing = facingOf(hero.x - b.x, hero.z - b.z); return; }
        // With rigs to set, it sleeps until the hero comes closer.
        if (hero.act !== 'faint' && Math.hypot(hero.x - b.x, hero.z - b.z) <= b.def.wakes * (way === 'world' ? 0.6 : 1)) wakeBeast(b);
        return;
      case 'calmed':
        return;
      case 'alert':
      case 'recover':
      case 'stun':
      case 'held':
        if (b.t >= b.until) go(b, 'stalk', 0);
        return;
      case 'dizzy':
        if (b.t >= b.until && !held && b.calm <= 0) recover(b);
        return;
      case 'flung': {
        const nx = b.x + b.flyX * dt, nz = b.z + b.flyZ * dt;
        if (free(nx, nz, b.def.radius)) { b.x = nx; b.z = nz; }
        else if (way === 'hero' && stage.solid(nx + Math.sign(b.flyX) * b.def.radius, nz + Math.sign(b.flyZ) * b.def.radius)) {
          // Slid or thrown into a wall or a tree: it crashes, as a charge does.
          record.crashes++;
          emit('crash', nx, nz, 0, 'slide');
          go(b, 'stun', b.def.crash);
          hurtGuard(b, b.full * FIGHT_CRASH * 3, 'world');
          return;
        }
        if (b.t >= b.until) go(b, 'stun', RIG.flingStun);
        return;
      }
      case 'windup':
        if (b.attack && b.t >= b.until) strike(b, b.attack);
        return;
      case 'charge':
        if (b.attack) stepCharge(b, b.attack, dt);
        return;
      case 'stalk':
        break;
    }

    if (!pickGoal(b)) return;
    const dx = goal.x - b.x, dz = goal.z - b.z, distance = Math.hypot(dx, dz);
    const speed = b.def.speed * (b.enraged ? RAGE.speed : 1) * (b.slow > 0 ? SLOWED : 1);
    // In a fight it turns at its own speed, so a slow beast can be got round. The traps' beasts face their goal at once, as they did.
    const want = facingOf(dx, dz), off = turnBetween(b.facing, want);
    if (way === 'hero') {
      const most = b.def.turn * (b.enraged ? RAGE.speed : 1) * dt;
      b.facing += Math.max(-most, Math.min(most, off));
    } else {
      b.facing = want;
    }
    const facing = b.facing, aimed = Math.abs(turnBetween(b.facing, want)) <= AIMED;
    // The first attack that is rested and in range lands. Otherwise it walks to where the nearest rested one would be.
    let best: AttackDef | null = null, bestGap = Infinity;
    const turn = myTurn(b);
    for (let i = 0; i < b.def.attacks.length; i++) {
      const a = b.def.attacks[i] as AttackDef, rest = b.rests[i] as number;
      // The traps are fought with the beasts as they were.
      if (a.follows || (a.fightOnly && way !== 'hero')) continue;
      // Roots go for a companion that is not held already.
      if (a.grabs && (way !== 'hero' || companion.mode === 'held')) continue;
      // Light draws its charge and nothing else: it does not sweep its tusks at a lamp.
      if (goal.lamp && a.charge === 0) continue;
      // A charge needs room in front of it, or it would crash where it stands.
      if (a.charge > 0 && clearRun(b, 2) < 1.5) continue;
      // An attack with a direction waits until it faces the hero. A ring round itself, or one where the hero stands, does not.
      const pointed = aimed || a.shape === 'circle';
      if (turn && pointed && rest <= 0 && distance >= a.from && distance <= a.to) { begin(b, a); return; }
      if (rest > 0.4) continue;
      const gap = distance < a.from ? a.from - distance : distance > a.to ? distance - a.to : 0;
      if (gap < bestGap) { bestGap = gap; best = a; }
    }
    if (goal.lamp) {
      // Too close to charge it, or the charge is not rested: it walks into the light.
      b.moving = walk(b, goal.x, goal.z, speed, dt, b.def.radius);
      if (b.moving) touchRigs(b);
      return;
    }
    if (!best || b.def.rooted) return;
    const fears = b.def.fearsLight === true;
    if (distance > best.to) b.moving = walk(b, goal.x, goal.z, speed, dt, b.def.radius, fears);
    else if (distance < best.from) b.moving = walk(b, b.x - dx, b.z - dz, speed * 0.8, dt, b.def.radius, fears);
    b.facing = way === 'hero' ? facing : facingOf(goal.x - b.x, goal.z - b.z);
    if (b.moving) touchRigs(b);
  }

  // ------------------------------------------------ rigs

  /** A rig goes off under a beast. */
  function setOff(r: Rig, b: Beast): void {
    r.armed = false;
    r.spent = 0;
    record.rigsTriggered++;
    emit('rig', r.x, r.z, RIG_KINDS.indexOf(r.kind as RigKind), r.kind);
    dropShape(b);
    if (r.kind === 'quill_strip') {
      // It lands on the quills and flinches: its guard drops.
      go(b, 'stun', KIT_FIGHT.quillStun);
      hurtGuard(b, b.full * KIT_FIGHT.quillShare + 0.001, 'world');
      return;
    }
    if (r.kind === 'slick_patch') {
      // It slides straight on, the way it was going, into whatever is behind.
      go(b, 'flung', KIT_FIGHT.slideTime);
      b.flyX = dirX(b.facing) * KIT_FIGHT.slideSpeed;
      b.flyZ = dirZ(b.facing) * KIT_FIGHT.slideSpeed;
      emit('slid', b.x, b.z, 0, b.def.kind);
      return;
    }
    if (r.kind === 'snare') {
      go(b, 'held', RIG.hold);
    } else if (r.kind === 'plate' || r.kind === 'pusher_plate') {
      // Thrown back the way it came.
      go(b, 'flung', RIG.flingTime);
      b.flyX = -dirX(b.facing) * (RIG.fling / RIG.flingTime);
      b.flyZ = -dirZ(b.facing) * (RIG.fling / RIG.flingTime);
    } else {
      go(b, 'stun', RIG.stun);
    }
    const doing = b.doing, until = b.until;
    hurtGuard(b, b.full * (r.kind === 'pusher_plate' ? KIT_FIGHT.quillShare : b.def.rigShare) + 0.001, 'world');
    // A broken part staggers the beast. What the rig does to it lasts at least as long.
    if (b.doing === 'stun' && doing !== 'stun') { b.doing = doing; b.until = Math.max(until, doing === 'flung' ? until : SEGMENT_STAGGER); }
  }

  /** Sets off the rig the beast stands on. True when one went off. */
  function touchRigs(b: Beast): boolean {
    for (let i = 0; i < rigs.length; i++) {
      const r = rigs[i] as Rig;
      if (!r.armed || r.kind === 'channel' || r.kind === 'lamp_post_kit') continue;
      if (!inCircle(b.x, b.z, r.x, r.z, b.def.radius + RIG.touch)) continue;
      setOff(r, b);
      return true;
    }
    return false;
  }

  /** F with a beast close to the spring plate throws it by hand. */
  function springByHand(): void {
    for (let i = 0; i < rigs.length; i++) {
      const r = rigs[i] as Rig;
      if (!r.armed || r.kind !== 'plate') continue;
      for (let j = 0; j < beasts.length; j++) {
        const b = beasts[j] as Beast;
        if (b.doing === 'calmed' || b.doing === 'dizzy' || b.doing === 'asleep') continue;
        if (!inCircle(b.x, b.z, r.x, r.z, b.def.radius + RIG.hand)) continue;
        useful();
        // Away from the plate.
        b.facing = facingOf(r.x - b.x, r.z - b.z);
        setOff(r, b);
        return;
      }
    }
  }

  /** A channel lies across the way from the nearest beast, so it is in its path. */
  function channelAlongX(cx: number, cz: number): boolean {
    let alongX = true, near = Infinity;
    for (let i = 0; i < beasts.length; i++) {
      const b = beasts[i] as Beast, d = Math.hypot(b.x - cx, b.z - cz);
      if (d < near) { near = d; alongX = Math.abs(b.z - cz) >= Math.abs(b.x - cx); }
    }
    return alongX;
  }

  /** The kit slot that holds this thing unused, or -1. */
  const slotOf = (kind: PlacedKind): number => kit.indexOf(kind as KitId);

  function canPlace(kind: PlacedKind, x: number, z: number): string | null {
    const fromKit = (RIG_KINDS as readonly string[]).indexOf(kind) < 0;
    if (fromKit) {
      if (way !== 'hero') return 'The kit is for a fight.';
      if (kind === 'salve') return 'A salve is used, not set down.';
      if (slotOf(kind) < 0) return 'Your kit has none left.';
    } else {
      if (way !== 'world') return 'Rigs belong to the traps.';
      if (usedKinds.has(kind as RigKind)) return 'The kit holds one of each.';
    }
    const cx = Math.floor(x) + 0.5, cz = Math.floor(z) + 0.5;
    if (Math.hypot(cx - hero.x, cz - hero.z) > (fromKit ? KIT_FIGHT.reach : RIG.reach)) return 'Too far.';
    const alongX = channelAlongX(cx, cz);
    const cells = kind === 'channel' ? [-1, 0, 1] : [0];
    for (const o of cells) {
      const px = cx + (alongX ? o : 0), pz = cz + (alongX ? 0 : o);
      if (shut(px, pz)) return 'Not there.';
      for (let i = 0; i < rigs.length; i++) {
        const r = rigs[i] as Rig;
        if (r.armed && Math.abs(r.x - px) < 1.5 && Math.abs(r.z - pz) < 1.5) return 'Too close to another rig.';
      }
      // A clapper is meant to go off by a beast.
      if (kind === 'clapper_kit') continue;
      for (let i = 0; i < beasts.length; i++) {
        const b = beasts[i] as Beast;
        if (b.doing !== 'calmed' && Math.hypot(b.x - px, b.z - pz) < b.def.radius + RIG.clear) return 'Too close to the beast.';
      }
    }
    return null;
  }

  /** A clapper goes off where it is set down: every beast near bolts straight away from it. */
  function clap(x: number, z: number): void {
    for (let i = 0; i < beasts.length; i++) {
      const b = beasts[i] as Beast, dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz) || 1;
      if (!stillUp(b) || b.doing === 'asleep' || d > KIT_FIGHT.clapReach) continue;
      dropShape(b);
      go(b, 'flung', KIT_FIGHT.clapBolt);
      b.flyX = (dx / d) * KIT_FIGHT.clapSpeed;
      b.flyZ = (dz / d) * KIT_FIGHT.clapSpeed;
      b.facing = facingOf(dx, dz);
      emit('bolted', b.x, b.z, 0, b.def.kind);
    }
  }

  // ================================================ milestone 3: the boss hooks
  // Two things a boss needs that a beast fight does not, so a boss can be its own module
  // (`src/game/fight/stag-hall.sim.ts`). A beast fight never makes either, and plays exactly as before.
  //
  // Targets: things the hero can hit that are not beasts. Every move of every weapon takes their guard while they
  // are open, as it takes a beast's, and so does the striker's strike. At 0 one breaks and stays broken.
  //
  // Loose shapes: a shape on the ground that belongs to no beast. It shows for its lead and lands on the hero like
  // any attack: the same `tell` and `strike` events, the same dodge, the same record.

  interface TargetInner extends Target { broken: boolean }
  interface Loose { shape: Telegraph; spec: LooseShape; landed: boolean }
  const targets: TargetInner[] = [];
  const loose: Loose[] = [];
  let nextTarget = 1;
  /** The target the striker goes for: the one the hero hit last. */
  let companionGoal: TargetInner | null = null;

  function addTarget(spec: TargetSpec): Target {
    const t: TargetInner = { id: nextTarget++, name: spec.name ?? 'target', x: spec.x, z: spec.z, radius: spec.radius, guard: spec.guard, full: spec.guard, open: spec.open ?? true, broken: false, high: spec.high ?? false };
    targets.push(t);
    return t;
  }

  function removeTarget(target: Target): void {
    const i = targets.indexOf(target as TargetInner);
    if (i >= 0) targets.splice(i, 1);
    if (companionGoal === target) companionGoal = null;
  }

  /** Takes guard from a target. It breaks at 0. */
  function hurtTarget(t: TargetInner, amount: number): void {
    if (t.broken || !t.open) return;
    t.guard = Math.max(0, t.guard - amount);
    emit('targetHit', t.x, t.z, amount, t.name);
    if (t.guard > 0.001) return;
    t.guard = 0;
    t.broken = true;
    t.open = false;
    if (companionGoal === t) companionGoal = null;
    emit('targetBroken', t.x, t.z, 0, t.name);
    if (t === vines) free_();
  }

  /** The striker goes for a target the hero hit, unless it is up on the boss. */
  function sendAt(t: TargetInner): void {
    const c = companion;
    if (way !== 'hero' || c.def.role !== 'striker' || t.broken || t.high || companionGoal === t || hero.act === 'faint') return;
    c.mode = 'engage';
    c.target = null;
    companionGoal = t;
    c.toStrike = 0.25;
  }

  /** An arc, a ring or a burst lands on every open target in its shape. Returns how many it hit. */
  function landOnTargets(move: MoveDef, mult: number, cx: number, cz: number): number {
    let hits = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i] as TargetInner;
      if (!t.open || t.broken) continue;
      const grow = t.radius + 0.25;
      const inside = move.kind === 'arc'
        ? inCone(t.x, t.z, hero.x, hero.z, hero.facing, move.reach, move.width, grow)
        : inCircle(t.x, t.z, cx, cz, move.reach + grow);
      if (!inside) continue;
      hits++;
      hurtTarget(t, move.guard * mult);
      sendAt(t);
    }
    return hits;
  }

  /** A shot that reaches an open target lands on it. True when it did. */
  function shotOnTargets(shot: Shot, mult: number): boolean {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i] as TargetInner;
      if (!t.open || t.broken || !inCircle(shot.x, shot.z, t.x, t.z, t.radius + shot.move.radius)) continue;
      shot.hits++;
      record.shotHits++;
      emit('shotHit', shot.x, shot.z, 0, shot.move.id);
      hurtTarget(t, shot.move.guard * mult);
      if (shot.strong) { shot.strong = false; hero.strong = true; spendStrong(t.x, t.z); }
      sendAt(t);
      return true;
    }
    return false;
  }

  /** The striker at a target: it runs in and strikes it, as it strikes a beast. */
  function companionAtTarget(dt: number): void {
    const c = companion, t = companionGoal;
    if (!t || t.broken || !t.open) {
      c.mode = 'heel';
      companionGoal = null;
      return;
    }
    const d = Math.hypot(t.x - c.x, t.z - c.z), near = t.radius + c.def.range;
    if (d > near) {
      c.moving = walk(c, t.x, t.z, c.def.speed, dt, COMPANION.body);
      // A target out of the companion's reach is let go.
      if (!c.moving) { c.mode = 'heel'; companionGoal = null; }
      return;
    }
    c.facing = facingOf(t.x - c.x, t.z - c.z);
    c.toStrike -= dt;
    if (c.toStrike > 0) return;
    emit('companionStrike', t.x, t.z, 0, c.def.role);
    c.toStrike = c.def.every;
    c.strikeT = 0.001;
    hurtTarget(t, c.def.strike);
  }

  function threaten(spec: LooseShape): Telegraph | null {
    for (let i = 0; i < SHAPES; i++) {
      const s = shapes[i] as Telegraph;
      if (s.live) continue;
      s.live = true;
      s.kind = spec.kind;
      s.x = spec.x;
      s.z = spec.z;
      s.facing = spec.facing;
      s.reach = spec.reach;
      s.width = spec.width;
      s.t = 0;
      s.lead = spec.lead * (gentle ? GENTLE.lead : 1);
      // No beast has the id 0.
      s.owner = 0;
      s.end = 0;
      loose.push({ shape: s, spec, landed: false });
      emit('tell', s.x, s.z, s.lead, spec.id);
      return s;
    }
    return null;
  }

  function cancelLoose(shape: Telegraph): void {
    for (let i = loose.length - 1; i >= 0; i--) {
      if ((loose[i] as Loose).shape !== shape) continue;
      loose.splice(i, 1);
      shape.live = false;
    }
  }

  /** Each loose shape whose lead has run out lands on what is inside it at that moment. */
  function landLoose(): void {
    for (let i = loose.length - 1; i >= 0; i--) {
      const l = loose[i] as Loose, s = l.shape;
      if (!s.live) { loose.splice(i, 1); continue; }
      if (l.landed || s.t < s.lead) continue;
      l.landed = true;
      const a = l.spec;
      emit('strike', s.x, s.z, a.heavy ? 1 : 0, a.id);
      if (covers(s, hero.x, hero.z, HERO.body)) {
        // Pushed away from the middle of a circle or a cone, and straight out from the middle line of a line.
        let fx = s.x, fz = s.z;
        if (s.kind === 'line') {
          const ux = dirX(s.facing), uz = dirZ(s.facing), along = (hero.x - s.x) * ux + (hero.z - s.z) * uz;
          fx = s.x + ux * along;
          fz = s.z + uz * along;
        }
        strikeHero(null, a.damage, a.heavy, fx, fz, a.id, a.push);
      }
      // It stays on the ground a moment as a flash, then the slot is free: the shapes' own clock lets it go.
      loose.splice(i, 1);
    }
  }

  function clearBossHooks(): void {
    targets.length = 0;
    loose.length = 0;
    companionGoal = null;
    grabber = null;
    vines = null;
  }
  // ================================================ end of the boss hooks

  // ------------------------------------------------ the fight's life

  function endOpen(): void {
    if (phase === 'fight' && record.result === 'open') {
      record.result = 'left';
      record.length = clock;
      record.healthLeft = hero.health;
      options.onEnd?.(copyRecord());
    }
  }

  function clear(): void {
    endOpen();
    beasts.length = 0;
    rigs.length = 0;
    usedKinds.clear();
    focus = null;
    for (let i = 0; i < SHAPES; i++) (shapes[i] as Telegraph).live = false;
    for (let i = 0; i < SHOTS; i++) (shots[i] as Shot).live = false;
    hero.health = maxHealth;
    hero.stamina = maxStamina;
    heroHits = 0;
    revived = false;
    hero.safe = 0;
    hero.pushLeft = 0;
    hero.charge = 0;
    hero.charged = false;
    hero.strong = false;
    hero.bloom = 0;
    hero.swap = 0;
    hero.sinceHit = 99;
    if (hero.act !== 'none') act('none');
    companion.mode = 'heel';
    companion.target = null;
    companion.pounce = false;
    companion.rest = 0;
    companion.lureRest = 0;
    companion.left = 0;
    companion.boostIn = COMPANION.boostEvery;
    clearBossHooks(); // Milestone 3.
    phase = 'idle';
    clock = 0;
    setupFrom = -1;
    sinceStart = 0;
    record = emptyRecord(way, companion.def.kind, weapon.kind, gentle, maxHealth);
  }

  function newBeast(def: BeastDef, x: number, z: number, share: number, depth = def.depth, passive = false): Beast {
    return {
      id: nextId++, def, depth, passive, x, z, facing: Math.PI, doing: 'asleep', t: 0, until: 0, guard: def.guard * share, full: def.guard * share, attack: null,
      calm: 0, marks: 0, enraged: false, slow: 0, moving: false,
      // The first attack does not come the moment it wakes.
      rests: def.attacks.map(() => 0.3 + random() * 0.3), run: 0, hitHero: false, shape: null, calming: false, markLeft: 0,
      drawn: 0, flyX: 0, flyZ: 0, pushX: 0, pushZ: 0, pushLeft: 0, pushTime: 1, landedAt: -9,
    };
  }

  const fight: Fight = {
    get way() { return way; },
    get gentle() { return gentle; },
    get phase() { return phase; },
    get clock() { return clock; },
    hero, companion, beasts, shapes, shots, rigs, events, input,
    get record() { return record; },

    step(dt) {
      for (const key in pressed) pressed[key as FightPress] = Math.max(0, pressed[key as FightPress] - dt);
      sinceStart += dt;
      if (phase === 'fight') {
        clock += dt;
        if (input.placing) record.placing += dt;
      } else if (phase === 'setup' && input.placing && setupFrom < 0) {
        setupFrom = sinceStart;
      }
      stepHero(dt);
      stepCompanion(dt);
      stepShots(dt);
      for (let i = 0; i < beasts.length; i++) stepBeast(beasts[i] as Beast, dt);
      landLoose(); // Milestone 3: loose shapes.
      for (let i = 0; i < SHAPES; i++) {
        const s = shapes[i] as Telegraph;
        if (!s.live) continue;
        s.t += dt;
        if (s.t >= s.lead + SHAPE_AFTER) {
          s.live = false;
          for (let j = 0; j < beasts.length; j++) if ((beasts[j] as Beast).shape === s && (beasts[j] as Beast).doing !== 'charge') (beasts[j] as Beast).shape = null;
        }
      }
      for (let i = rigs.length - 1; i >= 0; i--) {
        const r = rigs[i] as Rig;
        if (r.armed && r.life !== Infinity && (r.life -= dt) <= 0) { r.armed = false; r.spent = 0; }
        if (r.armed) continue;
        r.spent += dt;
        if (r.spent > 1.2) rigs.splice(i, 1);
      }
    },

    press(kind) {
      pressed[kind] = HERO.buffer;
    },

    setWay(next) {
      clear();
      way = next;
      record = emptyRecord(way, companion.def.kind, weapon.kind, gentle);
    },

    setWeapon(kind) {
      if (kind === weapon.kind) return;
      weapon = weaponOf(kind);
      hero.weapon = weapon.kind;
      hero.charge = 0;
      hero.charged = false;
      if (hero.move) act('none');
      hero.swap = HERO.swap;
      if (phase === 'fight') { record.swaps++; used(weapon.kind); useful(); }
      else record.weapon = weapon.kind;
      emit('swap', hero.x, hero.z, 0, weapon.kind);
    },

    setCompanion(kind) {
      clear();
      companion.def = companionOf(kind);
      record = emptyRecord(way, companion.def.kind, weapon.kind, gentle);
    },

    setGentle(on) {
      gentle = on;
      record.gentle = on;
    },

    bring(kind, also) {
      clear();
      const def = beastOf(kind), second = also ? beastOf(also) : null;
      const apart = second ? PAIR_APART : 0;
      const share = second ? PAIR_GUARD : 1;
      const b = newBeast(def, stage.den.x - apart, stage.den.z, share);
      beasts.push(b);
      if (second) beasts.push(newBeast(second, stage.den.x + apart, stage.den.z, share));
      record.enemy = second ? `${kind}+${second.kind}` : kind;
      phase = 'setup';
      for (let i = 0; i < beasts.length; i++) emit('brought', (beasts[i] as Beast).x, (beasts[i] as Beast).z, 0, (beasts[i] as Beast).def.kind);
      return b;
    },

    wake() {
      for (let i = 0; i < beasts.length; i++) wakeBeast(beasts[i] as Beast);
    },

    clear,

    placeHero(x, z) {
      hero.x = x;
      hero.z = z;
    },

    canPlace,

    placeRig(kind, x, z) {
      const why = canPlace(kind, x, z);
      if (why) { emit('denied', x, z, 0, why); return why; }
      const cx = Math.floor(x) + 0.5, cz = Math.floor(z) + 0.5;
      const slot = slotOf(kind);
      if (slot >= 0) kit[slot] = null;
      else usedKinds.add(kind as RigKind);
      const rig: Rig = { kind, x: cx, z: cz, alongX: channelAlongX(cx, cz), armed: true, spent: 0, life: Infinity };
      rigs.push(rig);
      if (kind === 'clapper_kit') { clap(cx, cz); rig.armed = false; }
      record.rigsPlaced++;
      record.layout.push(`${kind}@${Math.round(cx - stage.center.x)},${Math.round(cz - stage.center.z)}`);
      if (phase === 'setup' && setupFrom < 0) setupFrom = sinceStart;
      useful();
      emit('rigPlaced', cx, cz, RIG_KINDS.indexOf(kind as RigKind), kind);
      return null;
    },

    takeBack() {
      for (let i = rigs.length - 1; i >= 0; i--) {
        const r = rigs[i] as Rig;
        if (!r.armed) continue;
        // A kit thing set down is used: only the traps' rigs come back.
        if ((RIG_KINDS as readonly string[]).indexOf(r.kind) < 0) continue;
        rigs.splice(i, 1);
        usedKinds.delete(r.kind as RigKind);
        record.rigsPlaced--;
        record.layout.pop();
        emit('rigTaken', r.x, r.z, RIG_KINDS.indexOf(r.kind as RigKind), r.kind);
        return true;
      }
      return false;
    },

    skill() {
      if (way === 'world') return { name: 'Lure', left: companion.lureRest, rest: COMPANION.lureRest };
      return { name: companion.def.skill.name, left: companion.rest, rest: companion.def.skill.rest };
    },

    kit: () => RIG_KINDS.filter((kind) => !usedKinds.has(kind)),

    kitSlots: () => [...kit],

    useKit(slot) {
      const kind = kit[slot] ?? null;
      if (!kind) return 'That slot is empty.';
      if (kind !== 'salve') return 'Set it down with a click.';
      if (companion.mode !== 'held') return 'Your companion is on their feet.';
      kit[slot] = null;
      free_();
      record.rigsPlaced++;
      useful();
      emit('salve', companion.x, companion.z);
      return null;
    },

    get maxHealth() { return maxHealth; },
    get maxStamina() { return maxStamina; },

    setStats(stats) {
      maxHealth = stats.maxHealth;
      maxStamina = stats.maxStamina;
      hero.health = maxHealth;
      hero.stamina = maxStamina;
    },

    setGear(next) { gear = { ...next }; },

    setKit(next) { kit = [...next]; },

    setReach(next) { reach = next; },

    bringAll(foes) {
      clear();
      const share = foes.length >= 3 ? PACK_GUARD : foes.length === 2 ? PAIR_GUARD : 1;
      const out: BeastState[] = [];
      for (let i = 0; i < foes.length; i++) {
        const foe = foes[i] as FoeSpec, apart = (i - (foes.length - 1) / 2) * PAIR_APART;
        const b = newBeast(beastOf(foe.kind), stage.den.x + apart, stage.den.z + (i % 2) * 0.8, share, foe.depth, foe.passive);
        beasts.push(b);
        out.push(b);
      }
      record.enemy = foes.map((f) => f.kind).join('+');
      phase = 'setup';
      for (let i = 0; i < beasts.length; i++) emit('brought', (beasts[i] as Beast).x, (beasts[i] as Beast).z, 0, (beasts[i] as Beast).def.kind);
      return out;
    },

    targets,
    addTarget,
    removeTarget,
    threaten,
    cancel: cancelLoose,
  };
  return fight;
}

export { BEASTS };
