// The fight lab's rules: one hero, one pet, the beasts brought in, and the three ways to fight them.
//
// Every way shares the same rules. A beast's attack shows its shape on the ground before it lands, a beast has
// a guard that empties, the hero holds out the Mark to calm a beast whose guard is empty, and a hero whose
// health runs out faints and wakes at the arena's edge. Nobody dies. The ways differ in who empties the guard:
//   `hero`   the hero cuts, charges a spin and dodges. The pet helps.
//   `pet`    the pet fights. The hero sends it, throws the Mark's light, whistles it back and calls its skills.
//   `world`  rigs set on the ground and the arena's own wall do it. The hero baits and dodges.
//
// Nothing here draws or reads a key. A caller steps it with what the player wants (`FightInput`, `press`) and
// reads the state back. Time is whatever `step(dt)` is given: the lab steps it 60 times a second with the
// hero's body, the tests the same. Positions are x and z in blocks. Heights are the view's business.
import {
  BEASTS, DIZZY_BACK, GENTLE, HERO, PET, RIG, SEGMENT_STAGGER, SHAPE_AFTER, WAKE_PAUSE, WATER_STALL,
  beastOf, fightPetOf, type AttackDef, type BeastDef, type FightPetDef, type PetSkill, type RigKind, type Way,
} from '../content/fight.ts';
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

/** Something pressed once. `use` is the calm key going down: it springs a rig by hand. */
export type FightPress = 'attack' | 'dodge' | 'whistle' | 'skill1' | 'skill2' | 'use';

export type HeroAct = 'none' | 'cut' | 'spin' | 'dodge' | 'throw' | 'whistle' | 'calm' | 'hurt' | 'faint';

export interface HeroState {
  x: number;
  z: number;
  facing: number;
  health: number;
  stamina: number;
  act: HeroAct;
  /** Seconds in the act. */
  t: number;
  /** 1 for the first cut of a pair, 2 for the second. */
  cuts: number;
  /** Seconds the attack button has been held toward a charged spin. */
  charge: number;
  /** Seconds left in which nothing can hit the hero. */
  safe: number;
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

export interface BeastState {
  id: number;
  def: BeastDef;
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
  /** Marks of thrown light on it. The pet's next strike spends them. */
  marks: number;
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
}

export type PetMode = 'heel' | 'engage' | 'recall' | 'lure' | 'brace' | 'down';

export interface PetState {
  def: FightPetDef;
  x: number;
  z: number;
  facing: number;
  mode: PetMode;
  hearts: number;
  /** Seconds until each skill can be called again. */
  rests: [number, number];
  /** Seconds it has been striking, hurt or pouncing, for a pose: 0 when it is doing none of them. */
  strikeT: number;
  hurtT: number;
  /** True in the ways where nothing can hurt it. */
  safe: boolean;
  moving: boolean;
  /** Seconds left of a brace, a lure, or its rest after fainting. */
  left: number;
}

export interface Bolt {
  live: boolean;
  x: number;
  z: number;
  facing: number;
  /** Blocks it still flies. */
  left: number;
}

export interface Rig {
  kind: RigKind;
  /** The middle of its cell. A channel's other two cells lie `alongX` or along z either side. */
  x: number;
  z: number;
  alongX: boolean;
  /** False once it has gone off. It stays on the ground a moment, then goes. */
  armed: boolean;
  /** Seconds since it went off. */
  spent: number;
}

export type FightEventType =
  | 'brought' | 'wake' | 'tell' | 'strike' | 'swing' | 'hit' | 'whiff' | 'charged' | 'dodge' | 'dodged' | 'heroHurt' | 'faint' | 'woke'
  | 'guard' | 'segment' | 'dizzy' | 'recovered' | 'crash' | 'stall' | 'calming' | 'calmed' | 'won'
  | 'bolt' | 'boltHit' | 'boltMiss' | 'order' | 'whistle' | 'petStrike' | 'petHurt' | 'petFaint' | 'petUp' | 'skill' | 'blocked'
  | 'rigPlaced' | 'rigTaken' | 'rig' | 'denied'
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

/** What one fight came to: the numbers the experiments' checks ask for. */
export interface FightRecord {
  /** The way fought, or `stag` for the Stag's hall, which is fought the hero's way. */
  way: Way | 'stag';
  enemy: string;
  pet: string;
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
  faints: number;
  dodges: number;
  /** Attacks that passed through a dodge. */
  dodged: number;
  swings: number;
  /** Swings that hit nothing. */
  whiffs: number;
  /** Presses that did something, and the longest stretch of the fight without one. */
  inputs: number;
  longestGap: number;
  throws: number;
  throwHits: number;
  /** Orders to the pet, how many of them had it at its target within two seconds, and the slowest. */
  orders: number;
  ordersInTime: number;
  slowestOrder: number;
  whistles: number;
  petHits: number;
  petFaints: number;
  skills: number;
  rigsPlaced: number;
  rigsTriggered: number;
  /** Seconds of the fight with a rig in the hand. */
  placing: number;
  /** Each rig set down, as its kind and its cell from the arena's middle. */
  layout: string[];
  /** Charges that ended in the wall or a tree. */
  crashes: number;
  /** The answer to "Again?", 1 to 5, or 0 while there is none. */
  again: number;
  /** A boss fight's own numbers. Only a boss sets them (`src/game/fight/hall.sim.ts`). */
  boss?: BossNumbers;
}

export interface FightOptions {
  way?: Way;
  pet?: string;
  /** Longer lead times and weaker hits. */
  gentle?: boolean;
  /** The Heartstone: the Mark calms a beast whose depth is no higher. A hook for the power system, off by default. */
  reach?: number;
  /** True when something else moves the hero and reports where they are with `placeHero`: the lab's body. */
  external?: boolean;
  /** A repeatable random number from 0 to 1. */
  random?: () => number;
  /** Called with a copy of the record when a fight is won, and when one in progress is dropped. */
  onEnd?: (record: FightRecord) => void;
}

export interface Fight {
  readonly way: Way;
  readonly gentle: boolean;
  /** `idle` with no beast, `setup` until it wakes, `fight` until it is calmed, then `won`. */
  readonly phase: 'idle' | 'setup' | 'fight' | 'won';
  /** Seconds since the beast woke. */
  readonly clock: number;
  readonly hero: HeroState;
  readonly pet: PetState;
  readonly beasts: readonly BeastState[];
  readonly shapes: readonly Telegraph[];
  readonly bolts: readonly Bolt[];
  readonly rigs: readonly Rig[];
  readonly record: FightRecord;
  /** What happened since the caller last emptied it. */
  readonly events: FightEvent[];
  readonly input: FightInput;
  step(dt: number): void;
  press(kind: FightPress): void;
  /** Picks the way to fight. It clears the arena. */
  setWay(way: Way): void;
  setPet(kind: string): void;
  setGentle(on: boolean): void;
  /** Brings a beast in, asleep at the den, in place of any other. */
  bring(kind: string): BeastState;
  /** Wakes every sleeping beast now. */
  wake(): void;
  /** Takes every beast and rig away and heals the hero and the pet. */
  clear(): void;
  /** Tells the fight where the hero is, when something else moves them. */
  placeHero(x: number, z: number): void;
  /** Sets a rig down on the cell that holds this point. Returns why not, or null when it stands. */
  placeRig(kind: RigKind, x: number, z: number): string | null;
  /** The same question without setting anything down. */
  canPlace(kind: RigKind, x: number, z: number): string | null;
  /** Takes back the rig that was set down last. False when none is left. */
  takeBack(): boolean;
  /** The seconds the skill on this key has left, and its name. Null when the way has no skill there. */
  skill(slot: 0 | 1): { name: string; left: number; rest: number } | null;
  /** The rigs still in the kit. */
  kit(): RigKind[];

  // ---------------------------------------------------------------------------------- milestone 3: the boss hooks
  /** Things to hit that are not beasts: a chain's pin, a lamp, a seed pod, the collar. */
  readonly targets: readonly Target[];
  /** Makes a target. The hero's cut and spin, thrown light and the pet's strike take its guard while it is `open`. */
  addTarget(spec: TargetSpec): Target;
  /** Takes a target away. */
  removeTarget(target: Target): void;
  /** Shows a shape on the ground that belongs to no beast. It lands on the hero and the pet like any attack. Null when every slot is in use. */
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
  /** True for a target up on a boss: only the hero's own cut and spin reach it, not thrown light or the pet. */
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
  /** Seconds spent in each phase, in order. */
  phases: number[];
  /** The longest stretch, in seconds, in which the boss had no attack of its own on the ground, and the same for each phase. */
  quiet: number;
  quietByPhase: number[];
  /** What else the boss counts, by name: pins broken, pods cut, falls from the ramp. */
  counts: Record<string, number>;
}

// ---------------------------------------------------------------------------------------- the rules

const SHAPES = 8, BOLTS = 6;
/** The turns a walker tries, in order, when the straight way is shut. */
const TURNS = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1];
const RIG_KINDS: readonly RigKind[] = ['lamp', 'snare', 'plate', 'channel'];

interface Beast extends BeastState {
  rests: number[];
  /** Blocks left of a charge, and whether it has hit the hero or the pet already. */
  run: number;
  hitHero: boolean;
  hitPet: boolean;
  shape: Telegraph | null;
  /** True in a step where the hero holds the Mark out to it. */
  calming: boolean;
  markLeft: number;
  /** What the hero and the pet did to it lately. It turns on the one who did more. */
  angerHero: number;
  angerPet: number;
  /** Seconds it is made to go for the pet, or for the spot the pet lures it to. */
  drawn: number;
  /** The speed it is thrown at. */
  flyX: number;
  flyZ: number;
  /** A cut's push: its first speed, and the seconds left of it. */
  pushX: number;
  pushZ: number;
  pushLeft: number;
}

function emptyRecord(way: Way, pet: string, gentle: boolean): FightRecord {
  return {
    way, enemy: '', pet, gentle, result: 'open', setup: 0, length: 0,
    hitsTaken: 0, hitBy: {}, faints: 0, dodges: 0, dodged: 0, swings: 0, whiffs: 0, inputs: 0, longestGap: 0,
    throws: 0, throwHits: 0, orders: 0, ordersInTime: 0, slowestOrder: 0, whistles: 0, petHits: 0, petFaints: 0, skills: 0,
    rigsPlaced: 0, rigsTriggered: 0, placing: 0, layout: [], crashes: 0, again: 0,
  };
}

export function createFight(stage: Stage, options: FightOptions = {}): Fight {
  let way: Way = options.way ?? 'hero';
  let gentle = options.gentle ?? false;
  const reach = options.reach ?? Infinity;
  const external = options.external ?? false;
  const random = options.random ?? (() => 0.5);

  const input: FightInput = { moveX: 0, moveZ: 0, aimX: stage.den.x, aimZ: stage.den.z, attackHeld: false, calmHeld: false, placing: false };
  const pressed: Record<FightPress, number> = { attack: 0, dodge: 0, whistle: 0, skill1: 0, skill2: 0, use: 0 };
  const events: FightEvent[] = [];
  const hero: HeroState & { landed: boolean; slow: number; sinceSpent: number; boltRest: number; pushX: number; pushZ: number; pushLeft: number; pushTime: number; dodgeX: number; dodgeZ: number; charged: boolean } = {
    x: stage.start.x, z: stage.start.z, facing: 0, health: HERO.health, stamina: HERO.stamina, act: 'none', t: 0, cuts: 0, charge: 0, safe: 0,
    driven: false, driveX: 0, driveZ: 0, pace: 1, shoveX: 0, shoveZ: 0,
    landed: false, slow: 0, sinceSpent: 9, boltRest: 0, pushX: 0, pushZ: 0, pushLeft: 0, pushTime: 1, dodgeX: 0, dodgeZ: 0, charged: false,
  };
  const pet: PetState & { target: Beast | null; back: Beast | null; sinceWhistle: number; toStrike: number; ordered: number; pounce: boolean; goX: number; goZ: number; lureRest: number; hurtSafe: number } = {
    def: fightPetOf(options.pet ?? 'leaftail'), x: stage.start.x + 1.2, z: stage.start.z + 0.8, facing: 0, mode: 'heel', hearts: 0, rests: [0, 0],
    strikeT: 0, hurtT: 0, safe: true, moving: false, left: 0,
    target: null, back: null, sinceWhistle: 0, toStrike: 0, ordered: -1, pounce: false, goX: 0, goZ: 0, lureRest: 0, hurtSafe: 0,
  };
  pet.hearts = pet.def.hearts;
  const beasts: Beast[] = [];
  const shapes: Telegraph[] = Array.from({ length: SHAPES }, () => ({ live: false, kind: 'circle', x: 0, z: 0, facing: 0, reach: 0, width: 0, t: 0, lead: 0, owner: -1, end: 0 }));
  const bolts: Bolt[] = Array.from({ length: BOLTS }, () => ({ live: false, x: 0, z: 0, facing: 0, left: 0 }));
  const rigs: Rig[] = [];
  let record = emptyRecord(way, pet.def.kind, gentle);
  let phase: Fight['phase'] = 'idle';
  let clock = 0, lastInput = 0, setupFrom = -1, sinceStart = 0, nextId = 1;
  /** The kinds of rig set down in this fight. The kit holds one of each. */
  const usedKinds = new Set<RigKind>();

  const emit = (type: FightEventType, x: number, z: number, n = 0, text = ''): void => { events.push({ type, x, z, n, text }); };

  /** A press that did something: counted, and the gap since the last one measured. */
  function useful(): void {
    if (phase !== 'fight') return;
    record.inputs++;
    if (clock - lastInput > record.longestGap) record.longestGap = clock - lastInput;
    lastInput = clock;
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
  /** True when a body this wide can stand here. */
  function free(x: number, z: number, radius: number): boolean {
    const r = radius * 0.7;
    return !shut(x, z) && !shut(x + r, z) && !shut(x - r, z) && !shut(x, z + r) && !shut(x, z - r);
  }

  /** Walks a body toward a point, around what is in the way. True when it moved. */
  function walk(body: { x: number; z: number; facing: number }, tx: number, tz: number, speed: number, dt: number, radius: number): boolean {
    const dx = tx - body.x, dz = tz - body.z, distance = Math.hypot(dx, dz);
    if (distance < 0.05) return false;
    const step = Math.min(distance, speed * dt), toward = facingOf(dx, dz);
    for (let i = 0; i < TURNS.length; i++) {
      const way = toward + (TURNS[i] as number), nx = body.x + dirX(way) * step, nz = body.z + dirZ(way) * step;
      if (!free(nx, nz, radius)) continue;
      body.x = nx;
      body.z = nz;
      body.facing = toward;
      return true;
    }
    return false;
  }

  // ------------------------------------------------ shapes on the ground

  function showShape(b: Beast, a: AttackDef): Telegraph | null {
    for (let i = 0; i < SHAPES; i++) {
      const s = shapes[i] as Telegraph;
      if (s.live) continue;
      s.live = true;
      s.kind = a.shape;
      s.x = b.x;
      s.z = b.z;
      s.facing = b.facing;
      s.reach = a.shape === 'line' && a.charge > 0 ? clearRun(b, a.reach) + b.def.radius : a.reach;
      s.end = a.shape === 'line' && a.charge > 0 ? runEnd : 0;
      s.width = a.width;
      s.t = 0;
      s.lead = a.lead * (gentle ? GENTLE.lead : 1);
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

  // ------------------------------------------------ the hero

  function act(next: HeroAct): void {
    hero.act = next;
    hero.t = 0;
    hero.landed = false;
    if (next === 'none') hero.cuts = 0;
  }

  /** The way to the pointer, bent to a beast that stands close to it. */
  function aimFacing(grow: number): number {
    const aim = facingOf(input.aimX - hero.x, input.aimZ - hero.z);
    let best = aim, bestTurn = HERO.magnet.angle;
    for (let i = 0; i < beasts.length; i++) {
      const b = beasts[i] as Beast;
      if (b.doing === 'calmed') continue;
      const dx = b.x - hero.x, dz = b.z - hero.z;
      if (Math.hypot(dx, dz) > grow + b.def.radius + HERO.magnet.near) continue;
      const to = facingOf(dx, dz), turn = Math.abs(turnBetween(aim, to));
      if (turn < bestTurn) { bestTurn = turn; best = to; }
    }
    // Milestone 3: an open target bends the cut as a beast does.
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i] as TargetInner, dx = t.x - hero.x, dz = t.z - hero.z;
      if (!t.open || t.broken || Math.hypot(dx, dz) > grow + t.radius + HERO.magnet.near) continue;
      const to = facingOf(dx, dz), turn = Math.abs(turnBetween(aim, to));
      if (turn < bestTurn) { bestTurn = turn; best = to; }
    }
    return best;
  }

  /** True for a beast that still has guard to lose. */
  const stillUp = (b: BeastState): boolean => b.doing !== 'dizzy' && b.doing !== 'calmed';

  function startCut(): void {
    const second = hero.act === 'cut';
    act('cut');
    hero.cuts = second ? 2 : 1;
    hero.facing = aimFacing(HERO.cut.reach);
    record.swings++;
    useful();
    emit('swing', hero.x, hero.z, hero.cuts);
  }

  function startSpin(): void {
    act('spin');
    record.swings++;
    useful();
    emit('swing', hero.x, hero.z, 3);
  }

  /** The moment a cut or a spin can land: every beast in its shape loses guard. */
  function land(spin: boolean): void {
    hero.landed = true;
    let hits = 0;
    for (let i = 0; i < beasts.length; i++) {
      const b = beasts[i] as Beast;
      if (b.doing === 'calmed') continue;
      const grow = b.def.radius + 0.25;
      const inside = spin
        ? inCircle(b.x, b.z, hero.x, hero.z, HERO.spin.reach + grow)
        : inCone(b.x, b.z, hero.x, hero.z, hero.facing, HERO.cut.reach, HERO.cut.arc / 2, grow);
      if (!inside) continue;
      hits++;
      emit('hit', b.x, b.z, spin ? 3 : hero.cuts);
      // A cut pushes a small beast a little. A steady one stands until its guard is empty.
      if (!spin && (!b.def.steady || b.doing === 'dizzy')) shove(b);
      hurtGuard(b, spin ? HERO.spin.guard : HERO.cut.guard, 'hero');
      // With the hero fighting, the pet goes for whatever the hero hit last.
      if (way === 'hero' && pet.mode !== 'down' && stillUp(b)) { pet.mode = 'engage'; pet.target = b; }
    }
    hits += landOnTargets(spin); // Milestone 3: targets.
    if (hits === 0) {
      record.whiffs++;
      emit('whiff', hero.x + dirX(hero.facing) * 1.4, hero.z + dirZ(hero.facing) * 1.4);
    }
  }

  /** Starts a cut's push on a beast, away from the hero. */
  function shove(b: Beast): void {
    const dx = b.x - hero.x, dz = b.z - hero.z, away = Math.hypot(dx, dz) || 1;
    // It starts fast and slows to a stop, so its first speed is twice its mean.
    b.pushX = (dx / away) * (2 * HERO.cut.push) / HERO.cut.pushTime;
    b.pushZ = (dz / away) * (2 * HERO.cut.push) / HERO.cut.pushTime;
    b.pushLeft = HERO.cut.pushTime;
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
  }

  function throwBolt(): void {
    for (let i = 0; i < BOLTS; i++) {
      const bolt = bolts[i] as Bolt;
      if (bolt.live) continue;
      hero.facing = facingOf(input.aimX - hero.x, input.aimZ - hero.z);
      bolt.live = true;
      bolt.x = hero.x;
      bolt.z = hero.z;
      bolt.facing = hero.facing;
      bolt.left = HERO.bolt.range;
      hero.boltRest = HERO.bolt.rest;
      act('throw');
      record.throws++;
      useful();
      emit('bolt', hero.x, hero.z);
      return;
    }
  }

  /** The beast under the pointer, for an order. */
  function pointed(): Beast | null {
    for (let i = 0; i < beasts.length; i++) {
      const b = beasts[i] as Beast;
      if (b.doing !== 'calmed' && inCircle(input.aimX, input.aimZ, b.x, b.z, b.def.radius + PET.order)) return b;
    }
    return null;
  }

  /** A hit on the hero from (fx, fz). False when it passed: a dodge, or the moment after another hit. */
  function hurtHero(damage: number, heavy: boolean, fx: number, fz: number, attack: string, pushBlocks?: number): boolean {
    if (hero.act === 'faint') return false;
    if (hero.safe > 0) {
      if (hero.act === 'dodge') { record.dodged++; emit('dodged', hero.x, hero.z); }
      return false;
    }
    hero.health -= damage * (gentle ? GENTLE.damage : 1);
    record.hitsTaken++;
    record.hitBy[attack] = (record.hitBy[attack] ?? 0) + 1;
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
    if (hero.health <= 0) {
      hero.health = 0;
      act('faint');
      record.faints++;
      emit('faint', hero.x, hero.z);
      // The pet stops fighting and stands by the hero.
      if (pet.mode !== 'down') { pet.mode = 'recall'; pet.target = null; pet.back = null; pet.pounce = false; }
      // Nothing hits a fainted hero: every beast lets its attack go.
      for (let i = 0; i < beasts.length; i++) {
        const b = beasts[i] as Beast;
        if (b.doing === 'windup' || b.doing === 'charge' || b.doing === 'recover') { dropShape(b); go(b, 'stalk', 0); }
      }
    } else {
      act('hurt');
    }
    return true;
  }

  function wakeHero(): void {
    hero.x = stage.wake.x;
    hero.z = stage.wake.z;
    hero.health = HERO.health;
    hero.stamina = HERO.stamina;
    hero.safe = HERO.wakeSafe;
    hero.pushLeft = 0;
    act('none');
    emit('woke', hero.x, hero.z);
  }

  function stepHero(dt: number): void {
    const h = hero;
    h.safe = Math.max(0, h.safe - dt);
    h.boltRest = Math.max(0, h.boltRest - dt);
    h.slow = Math.max(0, h.slow - dt);
    h.sinceSpent += dt;
    if (h.sinceSpent >= HERO.staminaWait) h.stamina = Math.min(HERO.stamina, h.stamina + HERO.staminaBack * dt);
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
    if (h.act === 'hurt') {
      h.pace = 0.3;
      if (h.t >= HERO.hurt.stagger) act('none');
    } else if (h.act === 'dodge') {
      h.driven = true;
      h.driveX = h.dodgeX * HERO.dodge.speed;
      h.driveZ = h.dodgeZ * HERO.dodge.speed;
      h.facing = facingOf(h.dodgeX, h.dodgeZ);
      if (h.t >= HERO.dodge.time) { act('none'); h.slow = HERO.dodge.after; }
    } else if (h.act === 'cut') {
      h.pace = HERO.cut.pace;
      if (!h.landed && h.t >= HERO.cut.startup) land(false);
      if (h.t >= HERO.cut.total) act('none');
    } else if (h.act === 'spin') {
      h.pace = HERO.cut.pace;
      if (!h.landed && h.t >= HERO.spin.startup) land(true);
      if (h.t >= HERO.spin.total) act('none');
    } else if (h.act === 'throw') {
      h.pace = HERO.bolt.pace;
      if (h.t >= HERO.bolt.pose) act('none');
    } else if (h.act === 'whistle') {
      h.pace = HERO.bolt.pace;
      if (h.t >= 0.3) act('none');
    }

    // Holding the Mark out to a dizzy beast. The hero stands still and can still be hit.
    let calmed: Beast | null = null;
    if (input.calmHeld && (h.act === 'none' || h.act === 'calm' || ((h.act === 'cut' || h.act === 'spin') && h.landed))) {
      let near: number = HERO.calm.reach;
      for (let i = 0; i < beasts.length; i++) {
        const b = beasts[i] as Beast, d = Math.hypot(b.x - h.x, b.z - h.z) - b.def.radius;
        if (b.doing === 'dizzy' && d <= near) { near = d; calmed = b; }
      }
    }
    if (calmed) {
      if (h.act !== 'calm') { act('calm'); useful(); emit('calming', calmed.x, calmed.z); }
      h.pace = 0;
      h.facing = facingOf(calmed.x - h.x, calmed.z - h.z);
      calmed.calming = true;
      calmed.calm += dt / HERO.calm.hold;
      if (calmed.calm >= 1) {
        if (calmed.def.depth > reach) {
          // The Mark's reach: its guard is empty and the Mark still cannot hold it.
          calmed.calm = 0;
          emit('denied', calmed.x, calmed.z, calmed.def.depth, 'Your Mark cannot reach a Blight this deep yet.');
          recover(calmed);
        } else {
          finish(calmed);
        }
        act('none');
      }
    } else if (h.act === 'calm') {
      act('none');
    }

    // The charged spin: the button held from a cut on.
    if (way === 'hero') {
      if (input.attackHeld && (h.act === 'none' || h.act === 'cut')) {
        h.charge += dt;
        if (!h.charged && h.charge >= HERO.spin.hold) { h.charged = true; emit('charged', h.x, h.z); }
        if (h.act === 'none' && h.charge > 0.25) h.pace = Math.min(h.pace, 0.6);
      } else if (!input.attackHeld) {
        if (h.charged && h.act === 'none') startSpin();
        h.charge = 0;
        h.charged = false;
      }
    }

    // What was pressed, when the hero can do it.
    const freeNow = h.act === 'none';
    if (pressed.dodge > 0) {
      const can = freeNow || h.act === 'calm' || h.act === 'throw' || h.act === 'whistle' || (h.act === 'cut' && h.t >= HERO.cut.cancel) || (h.act === 'spin' && h.t >= HERO.spin.cancel);
      if (can) {
        pressed.dodge = 0;
        if (h.stamina >= HERO.dodge.cost) startDodge();
        else emit('denied', h.x, h.z, 0, 'Out of breath.');
      }
    }
    if (pressed.attack > 0) {
      if (way === 'hero') {
        if (freeNow || (h.act === 'cut' && h.cuts === 1 && h.t >= HERO.cut.chain)) { pressed.attack = 0; startCut(); }
      } else if (way === 'pet') {
        if ((freeNow || h.act === 'throw') && h.boltRest <= 0) {
          pressed.attack = 0;
          const b = pointed();
          if (b && pet.mode !== 'down' && !(pet.mode === 'engage' && pet.target === b) && pet.back !== b) order(b);
          throwBolt();
        }
      } else {
        pressed.attack = 0;
      }
    }
    if (pressed.whistle > 0) {
      pressed.whistle = 0;
      if (way === 'pet' && h.act !== 'hurt') whistle();
    }
    if (pressed.skill1 > 0) { pressed.skill1 = 0; callSkill(0); }
    if (pressed.skill2 > 0) { pressed.skill2 = 0; callSkill(1); }
    if (pressed.use > 0) { pressed.use = 0; springByHand(); }

    if (h.act === 'none' && !h.driven && Math.hypot(input.moveX, input.moveZ) > 0.05) h.facing = facingOf(input.moveX, input.moveZ);

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
      const vx = (h.driven ? h.driveX : input.moveX * HERO.walk * h.pace) + h.shoveX;
      const vz = (h.driven ? h.driveZ : input.moveZ * HERO.walk * h.pace) + h.shoveZ;
      if (!stage.solid(h.x + vx * dt, h.z)) h.x += vx * dt;
      if (!stage.solid(h.x, h.z + vz * dt)) h.z += vz * dt;
    }
  }

  // ------------------------------------------------ the pet

  function order(b: Beast): void {
    dropOrder();
    pet.mode = 'engage';
    pet.target = b;
    pet.back = null;
    pet.pounce = false;
    pet.ordered = 0;
    pet.toStrike = PET.firstStrike;
    record.orders++;
    useful();
    emit('order', b.x, b.z);
  }

  function whistle(): void {
    act('whistle');
    emit('whistle', hero.x, hero.z);
    record.whistles++;
    if (pet.mode === 'down') return;
    if (pet.mode !== 'heel') useful();
    // One whistle takes it out of this attack: it goes back in by itself once the shapes have landed.
    // A whistle to a pet already at heel keeps it there until it is sent again.
    pet.back = pet.mode === 'engage' ? pet.target : null;
    pet.sinceWhistle = 0;
    pet.mode = 'recall';
    pet.target = null;
    pet.pounce = false;
    dropOrder();
  }

  /**
   * Ends the order in flight that never got the pet there. One cut short within its 2 seconds, by a whistle, a
   * skill, a faint or the beast going dizzy, is not counted: it says nothing about how fast the pet answers.
   * One that ran past 2 seconds stays counted, as late.
   */
  function dropOrder(): void {
    if (pet.ordered >= 0 && pet.ordered <= 2) record.orders--;
    pet.ordered = -1;
  }

  /** True while an attack of this beast is still to land, or it is running a charge. */
  function busyAttacking(b: Beast): boolean {
    return b.doing === 'windup' || b.doing === 'charge';
  }

  /** The beast a skill goes for: the pet's own target, or the nearest one that is awake. */
  function skillTarget(): Beast | null {
    if (pet.target && pet.target.doing !== 'calmed' && pet.target.doing !== 'dizzy') return pet.target;
    let best: Beast | null = null, near = 16;
    for (let i = 0; i < beasts.length; i++) {
      const b = beasts[i] as Beast, d = Math.hypot(b.x - pet.x, b.z - pet.z);
      if (b.doing !== 'calmed' && b.doing !== 'dizzy' && b.doing !== 'asleep' && d < near) { near = d; best = b; }
    }
    return best;
  }

  /** The skills this way gives the two keys. */
  function skillAt(slot: 0 | 1): PetSkill | 'lure' | null {
    if (way === 'world') return slot === 0 ? 'lure' : null;
    if (way === 'hero') return slot === 0 ? pet.def.skills[0] : null;
    return pet.def.skills[slot];
  }

  function callSkill(slot: 0 | 1): void {
    const skill = skillAt(slot);
    if (!skill) return;
    if (pet.mode === 'down') { emit('denied', hero.x, hero.z, 0, `${pet.def.name} is resting.`); return; }
    if (skill === 'lure') {
      if (pet.lureRest > 0) { emit('denied', hero.x, hero.z, 0, 'Not yet.'); return; }
      pet.mode = 'lure';
      pet.goX = input.aimX;
      pet.goZ = input.aimZ;
      pet.left = PET.lure;
      pet.lureRest = PET.lureRest;
      for (let i = 0; i < beasts.length; i++) (beasts[i] as Beast).drawn = PET.lure;
      record.skills++;
      useful();
      emit('skill', pet.goX, pet.goZ, 0, 'Lure');
      return;
    }
    if (pet.rests[slot] > 0) { emit('denied', hero.x, hero.z, 0, 'Not yet.'); return; }
    const b = skillTarget();
    if (!b) { emit('denied', hero.x, hero.z, 0, 'Nothing to go for.'); return; }
    pet.rests[slot] = skill.rest;
    record.skills++;
    useful();
    emit('skill', b.x, b.z, slot, skill.name);
    if (skill.id === 'pounce') {
      pet.mode = 'engage';
      pet.target = b;
      pet.pounce = true;
      pet.toStrike = 0;
    } else if (skill.id === 'distract') {
      b.drawn = skill.time;
      if (pet.mode === 'heel' || pet.mode === 'recall') { pet.mode = 'engage'; pet.target = b; pet.toStrike = PET.firstStrike; }
    } else {
      // Brace: it plants itself between the hero and the beast and takes the next attack on its back.
      pet.mode = 'brace';
      pet.target = b;
      pet.left = skill.time;
      const dx = b.x - hero.x, dz = b.z - hero.z, d = Math.hypot(dx, dz) || 1;
      pet.goX = hero.x + (dx / d) * Math.min(1.2, d * 0.5);
      pet.goZ = hero.z + (dz / d) * Math.min(1.2, d * 0.5);
    }
  }

  /** A hit on the pet. False when it passed. `b` is null for a shape that belongs to no beast. */
  function hurtPet(b: Beast | null, attack: string): boolean {
    if (pet.mode === 'down') return false;
    if (pet.mode === 'brace') {
      // The braced pet turns the attack: the beast staggers and loses guard.
      const skill = pet.def.skills[0];
      emit('blocked', pet.x, pet.z, 0, attack);
      pet.mode = 'heel';
      if (b) {
        hurtGuard(b, skill.guard, 'pet');
        if (b.doing !== 'dizzy') { dropShape(b); go(b, 'stun', 1); }
      }
      return false;
    }
    if (pet.safe || pet.hurtSafe > 0) return false;
    pet.hearts--;
    pet.hurtSafe = PET.safe;
    pet.hurtT = 0.001;
    record.petHits++;
    emit('petHurt', pet.x, pet.z, pet.hearts, attack);
    if (pet.hearts <= 0) {
      pet.mode = 'down';
      pet.left = pet.def.rest;
      pet.target = null;
      pet.back = null;
      pet.pounce = false;
      record.petFaints++;
      emit('petFaint', pet.x, pet.z);
    }
    return true;
  }

  /** The shape about to land on this point, if any. */
  function threat(x: number, z: number, grow: number): Telegraph | null {
    for (let i = 0; i < SHAPES; i++) {
      const s = shapes[i] as Telegraph;
      if (s.live && s.t < s.lead && covers(s, x, z, grow)) return s;
    }
    return null;
  }

  function stepPet(dt: number): void {
    const p = pet, speed = p.def.speed;
    p.rests[0] = Math.max(0, p.rests[0] - dt);
    p.rests[1] = Math.max(0, p.rests[1] - dt);
    p.lureRest = Math.max(0, p.lureRest - dt);
    p.hurtSafe = Math.max(0, p.hurtSafe - dt);
    if (p.strikeT > 0) { p.strikeT += dt; if (p.strikeT > 0.3) p.strikeT = 0; }
    if (p.hurtT > 0) { p.hurtT += dt; if (p.hurtT > 0.35) p.hurtT = 0; }
    p.moving = false;
    p.safe = way !== 'pet';
    if (p.ordered >= 0) p.ordered += dt;
    if (p.ordered >= 0 && p.mode !== 'engage') dropOrder();
    p.sinceWhistle += dt;
    if (p.back && (p.mode === 'recall' || p.mode === 'heel') && p.sinceWhistle > 0.5 && !busyAttacking(p.back)) {
      if (stillUp(p.back)) { p.mode = 'engage'; p.target = p.back; p.toStrike = PET.firstStrike; }
      p.back = null;
    }

    if (p.mode === 'down') {
      p.left -= dt;
      if (p.left <= 0) {
        p.mode = 'heel';
        p.hearts = p.def.hearts;
        p.x = hero.x - dirX(hero.facing) * 1.2;
        p.z = hero.z - dirZ(hero.facing) * 1.2;
        emit('petUp', p.x, p.z);
      }
      return;
    }

    // A pet that cannot be hurt keeps itself out of the shapes on the ground. The fighting pet waits for the whistle.
    if (p.safe && p.mode !== 'lure') {
      const s = threat(p.x, p.z, PET.body + 0.2);
      if (s) {
        let ax = p.x - s.x, az = p.z - s.z;
        if (s.kind === 'line') {
          // Out to the side it is already on.
          const fx = dirX(s.facing), fz = dirZ(s.facing), side = ax * fz - az * fx >= 0 ? 1 : -1;
          ax = fz * side;
          az = -fx * side;
        }
        const d = Math.hypot(ax, az) || 1;
        p.moving = walk(p, p.x + (ax / d) * 3, p.z + (az / d) * 3, speed * PET.hurry, dt, PET.body);
        return;
      }
    }

    if (p.mode === 'engage' && !p.target && petGoal) petAtTarget(dt); // Milestone 3: a target.
    else if (p.mode === 'engage') {
      const b = p.target;
      if (!b || b.doing === 'calmed' || b.doing === 'dizzy') {
        p.mode = 'heel';
        p.target = null;
        p.pounce = false;
      } else {
        const d = Math.hypot(b.x - p.x, b.z - p.z), near = b.def.radius + PET.strikeGap;
        if (d > near) {
          p.moving = walk(p, b.x, b.z, speed * (p.pounce ? PET.hurry * 1.6 : 1), dt, PET.body);
        } else {
          p.facing = facingOf(b.x - p.x, b.z - p.z);
          if (p.ordered >= 0) {
            if (p.ordered <= 2) record.ordersInTime++;
            if (p.ordered > record.slowestOrder) record.slowestOrder = p.ordered;
            p.ordered = -1;
          }
          p.toStrike -= dt;
          if (p.pounce || p.toStrike <= 0) {
            // A pounce is its own weight. A plain strike spends the marks of thrown light on the beast.
            const amount = p.pounce ? p.def.skills[0].guard : p.def.strike * (1 + PET.markBoost * b.marks);
            emit('petStrike', b.x, b.z, p.pounce ? 0 : b.marks);
            if (!p.pounce) b.marks = 0;
            p.toStrike = p.def.every * (way === 'hero' ? PET.helperSlow : 1);
            p.pounce = false;
            p.strikeT = 0.001;
            hurtGuard(b, amount, 'pet');
          }
        }
      }
    }
    if (p.mode === 'recall') {
      if (Math.hypot(hero.x - p.x, hero.z - p.z) <= PET.heel) p.mode = 'heel';
      else p.moving = walk(p, hero.x, hero.z, speed * PET.hurry, dt, PET.body);
    } else if (p.mode === 'lure' || p.mode === 'brace') {
      p.left -= dt;
      if (Math.hypot(p.goX - p.x, p.goZ - p.z) > 0.3) p.moving = walk(p, p.goX, p.goZ, speed * PET.hurry, dt, PET.body);
      else if (p.mode === 'brace' && p.target) p.facing = facingOf(p.target.x - p.x, p.target.z - p.z);
      if (p.left <= 0) p.mode = 'heel';
    } else if (p.mode === 'heel') {
      const d = Math.hypot(hero.x - p.x, hero.z - p.z);
      if (d > PET.heel) p.moving = walk(p, hero.x, hero.z, d > 4 ? speed : Math.min(speed, 5), dt, PET.body);
    }
  }

  // ------------------------------------------------ thrown light

  function stepBolts(dt: number): void {
    for (let i = 0; i < BOLTS; i++) {
      const bolt = bolts[i] as Bolt;
      if (!bolt.live) continue;
      const step = Math.min(bolt.left, HERO.bolt.speed * dt);
      bolt.x += dirX(bolt.facing) * step;
      bolt.z += dirZ(bolt.facing) * step;
      bolt.left -= step;
      let struck: Beast | null = null;
      for (let j = 0; j < beasts.length; j++) {
        const b = beasts[j] as Beast;
        if (b.doing !== 'calmed' && inCircle(bolt.x, bolt.z, b.x, b.z, b.def.radius + 0.35)) { struck = b; break; }
      }
      if (struck) {
        bolt.live = false;
        record.throwHits++;
        struck.marks = Math.min(HERO.bolt.marks, struck.marks + 1);
        struck.markLeft = HERO.bolt.markTime;
        emit('boltHit', bolt.x, bolt.z, struck.marks);
        hurtGuard(struck, HERO.bolt.guard, 'hero');
      } else if (boltOnTargets(bolt)) {
        // Milestone 3: it landed on a target.
      } else if (bolt.left <= 0 || stage.solid(bolt.x, bolt.z)) {
        bolt.live = false;
        emit('boltMiss', bolt.x, bolt.z);
      }
    }
  }

  // ------------------------------------------------ beasts

  function go(b: Beast, doing: BeastDoing, until: number): void {
    b.doing = doing;
    b.t = 0;
    b.until = until;
    if (doing !== 'windup' && doing !== 'charge') b.attack = null;
  }

  function wakeBeast(b: Beast): void {
    if (b.doing !== 'asleep') return;
    go(b, 'alert', WAKE_PAUSE);
    emit('wake', b.x, b.z);
    if (phase === 'setup') {
      phase = 'fight';
      clock = 0;
      lastInput = 0;
      record.setup = setupFrom >= 0 ? sinceStart - setupFrom : 0;
    }
  }

  /** Takes guard away. `by` says who gets the beast's anger for it. */
  function hurtGuard(b: Beast, amount: number, by: 'hero' | 'pet' | 'world'): void {
    if (b.doing === 'calmed' || b.doing === 'dizzy') return;
    wakeBeast(b);
    const part = b.def.guard / b.def.segments, before = b.guard;
    b.guard = Math.max(0, b.guard - amount);
    if (by === 'hero') b.angerHero += amount;
    else if (by === 'pet') b.angerPet += amount;
    emit('guard', b.x, b.z, amount);
    if (b.guard <= 0.001) {
      b.guard = 0;
      dropShape(b);
      go(b, 'dizzy', b.def.dizzy * (gentle ? GENTLE.lead : 1));
      b.calm = 0;
      emit('dizzy', b.x, b.z);
    } else if (Math.ceil(before / part - 1e-6) > Math.ceil(b.guard / part - 1e-6)) {
      // A part of the guard broke: it staggers, and the part stays broken.
      dropShape(b);
      go(b, 'stun', SEGMENT_STAGGER);
      emit('segment', b.x, b.z, Math.ceil(b.guard / part - 1e-6));
    }
  }

  /** Nobody calmed it in time: some guard comes back and it fights on. */
  function recover(b: Beast): void {
    b.guard = b.def.guard * DIZZY_BACK;
    b.calm = 0;
    go(b, 'stalk', 0);
    emit('recovered', b.x, b.z);
  }

  function finish(b: Beast): void {
    go(b, 'calmed', 0);
    b.calm = 1;
    b.marks = 0;
    emit('calmed', b.x, b.z, 0, b.def.gift);
    for (let i = 0; i < beasts.length; i++) if ((beasts[i] as Beast).doing !== 'calmed') return;
    if (clock - lastInput > record.longestGap) record.longestGap = clock - lastInput;
    record.result = 'calmed';
    record.length = clock;
    phase = 'won';
    if (pet.mode !== 'down') { pet.mode = 'heel'; pet.target = null; }
    emit('won', b.x, b.z);
    options.onEnd?.(copyRecord());
  }

  const copyRecord = (): FightRecord => ({ ...record, hitBy: { ...record.hitBy }, layout: [...record.layout] });

  /** A lit lamp that draws this beast's charge, when one stands close enough. */
  function lampFor(b: Beast): Rig | null {
    if (!b.def.drawnToLight) return null;
    let best: Rig | null = null, near: number = RIG.lure;
    for (let i = 0; i < rigs.length; i++) {
      const r = rigs[i] as Rig, d = Math.hypot(r.x - b.x, r.z - b.z);
      if (r.kind === 'lamp' && r.armed && d < near) { near = d; best = r; }
    }
    return best;
  }

  /** Where the beast goes for now. False when there is nobody to go for. */
  const goal = { x: 0, z: 0, pet: false, lamp: false };
  function pickGoal(b: Beast): boolean {
    goal.pet = goal.lamp = false;
    const petUp = pet.mode !== 'down';
    if (b.drawn > 0 && petUp) {
      goal.x = pet.mode === 'lure' ? pet.goX : pet.x;
      goal.z = pet.mode === 'lure' ? pet.goZ : pet.z;
      goal.pet = true;
      return true;
    }
    const lamp = lampFor(b);
    if (lamp) { goal.x = lamp.x; goal.z = lamp.z; goal.lamp = true; return true; }
    if (way === 'pet' && petUp && pet.mode === 'engage' && pet.target === b && b.angerPet > b.angerHero) {
      goal.x = pet.x;
      goal.z = pet.z;
      goal.pet = true;
      return true;
    }
    if (hero.act === 'faint' || !stage.inside(hero.x, hero.z)) return false;
    goal.x = hero.x;
    goal.z = hero.z;
    return true;
  }

  function begin(b: Beast, a: AttackDef): void {
    b.attack = a;
    go(b, 'windup', 0);
    b.attack = a;
    b.shape = showShape(b, a);
    b.until = b.shape ? b.shape.lead : a.lead;
    emit('tell', b.x, b.z, b.until, a.id);
  }

  /** What comes after an attack: the one that follows it, or standing open. */
  function after(b: Beast, a: AttackDef): void {
    const next = a.then ? b.def.attacks.find((other) => other.id === a.then) : undefined;
    if (next) begin(b, next);
    else go(b, 'recover', a.recover);
  }

  /** An attack reaches the hero. A braced pet beside them takes it instead. */
  function strikeHero(b: Beast, a: AttackDef, fx: number, fz: number): void {
    if (pet.mode === 'brace' && inCircle(hero.x, hero.z, pet.x, pet.z, 1.8)) hurtPet(b, a.id);
    else hurtHero(a.damage, a.heavy, fx, fz, a.id);
  }

  /** The attack lands. A circle or a cone hits at once. A charge starts its run. */
  function strike(b: Beast, a: AttackDef): void {
    b.rests[b.def.attacks.indexOf(a)] = a.rest;
    emit('strike', b.x, b.z, a.heavy ? 1 : 0, a.id);
    if (a.shape === 'line' && a.charge > 0) {
      go(b, 'charge', 0);
      b.attack = a;
      // The run is the attack's whole reach. What stands in the way ends it, as the line on the ground showed.
      b.run = a.reach;
      b.hitHero = b.hitPet = false;
      return;
    }
    const s = b.shape;
    if (s) {
      if (covers(s, hero.x, hero.z, HERO.body)) strikeHero(b, a, b.x, b.z);
      if (b.doing === 'windup' && covers(s, pet.x, pet.z, PET.body)) hurtPet(b, a.id);
    }
    if (b.doing === 'windup') after(b, a);
  }

  function stepCharge(b: Beast, a: AttackDef, dt: number): void {
    const fx = dirX(b.facing), fz = dirZ(b.facing), step = Math.min(b.run, a.charge * dt), front = b.def.radius;
    const nx = b.x + fx * step, nz = b.z + fz * step;
    const ahead = b.x + fx * (step + front), aheadZ = b.z + fz * (step + front);
    b.moving = true;
    if (stage.solid(ahead, aheadZ)) {
      // Into the wall or a tree: a share of its guard breaks and it is helpless for a while.
      dropShape(b);
      record.crashes++;
      emit('crash', ahead, aheadZ, 0, a.id);
      go(b, 'stun', b.def.crash);
      hurtGuard(b, b.def.guard * b.def.rigShare, 'world');
      return;
    }
    if (inChannel(ahead, aheadZ)) {
      for (let i = 0; i < rigs.length; i++) {
        const r = rigs[i] as Rig;
        if (r.kind === 'channel' && r.armed) { setOff(r, b); return; }
      }
    }
    if (stage.water(ahead, aheadZ) || !stage.inside(ahead, aheadZ)) {
      // It will not cross water, and it stops at the arena's edge.
      dropShape(b);
      emit('stall', b.x, b.z);
      go(b, 'stun', WATER_STALL);
      return;
    }
    b.x = nx;
    b.z = nz;
    b.run -= step;
    if (b.shape) { b.shape.t = b.shape.lead + SHAPE_AFTER * 0.5; }
    if (!b.hitHero && inCircle(hero.x, hero.z, b.x, b.z, b.def.radius + HERO.body + 0.1)) { b.hitHero = true; strikeHero(b, a, b.x - fx, b.z - fz); }
    if (!b.hitPet && inCircle(pet.x, pet.z, b.x, b.z, b.def.radius + PET.body + 0.1)) { b.hitPet = true; hurtPet(b, a.id); }
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
    b.angerHero *= Math.exp(-dt / 5);
    b.angerPet *= Math.exp(-dt / 5);
    if (b.markLeft > 0) { b.markLeft -= dt; if (b.markLeft <= 0) b.marks = 0; }
    if (b.pushLeft > 0) {
      // A cut's push, slowing to a stop. What stands in the way stops it.
      // The speed at the middle of the step, so the push covers its distance exactly at any dt.
      const step = Math.min(dt, b.pushLeft), k = (b.pushLeft - step / 2) / HERO.cut.pushTime;
      const nx = b.x + b.pushX * k * step, nz = b.z + b.pushZ * k * step;
      if (free(nx, nz, b.def.radius)) { b.x = nx; b.z = nz; } else b.pushLeft = 0;
      b.pushLeft = Math.max(0, b.pushLeft - dt);
    }
    const held = b.calming;
    if (!held && b.doing === 'dizzy') b.calm = Math.max(0, b.calm - dt * 1.5);
    b.calming = false;

    switch (b.doing) {
      case 'asleep':
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
    b.facing = facingOf(dx, dz);
    // The first attack that is rested and in range lands. Otherwise it walks to where the nearest rested one would be.
    let best: AttackDef | null = null, bestGap = Infinity;
    for (let i = 0; i < b.def.attacks.length; i++) {
      const a = b.def.attacks[i] as AttackDef, rest = b.rests[i] as number;
      // Light draws its charge and nothing else: it does not sweep its tusks at a lamp.
      if (a.follows || (goal.lamp && a.charge === 0)) continue;
      // A charge needs room in front of it, or it would crash where it stands.
      if (a.charge > 0 && clearRun(b, 2) < 1.5) continue;
      if (rest <= 0 && distance >= a.from && distance <= a.to) { begin(b, a); return; }
      if (rest > 0.4) continue;
      const gap = distance < a.from ? a.from - distance : distance > a.to ? distance - a.to : 0;
      if (gap < bestGap) { bestGap = gap; best = a; }
    }
    if (goal.lamp) {
      // Too close to charge it, or the charge is not rested: it walks into the light.
      b.moving = walk(b, goal.x, goal.z, b.def.speed, dt, b.def.radius);
      if (b.moving) touchRigs(b);
      return;
    }
    if (!best) return;
    if (distance > best.to) b.moving = walk(b, goal.x, goal.z, b.def.speed, dt, b.def.radius);
    else if (distance < best.from) b.moving = walk(b, b.x - dx, b.z - dz, b.def.speed * 0.8, dt, b.def.radius);
    b.facing = facingOf(goal.x - b.x, goal.z - b.z);
    if (b.moving) touchRigs(b);
  }

  // ------------------------------------------------ rigs

  /** A rig goes off under a beast. */
  function setOff(r: Rig, b: Beast): void {
    r.armed = false;
    r.spent = 0;
    record.rigsTriggered++;
    emit('rig', r.x, r.z, RIG_KINDS.indexOf(r.kind), r.kind);
    dropShape(b);
    if (r.kind === 'snare') {
      go(b, 'held', RIG.hold);
    } else if (r.kind === 'plate') {
      // Thrown back the way it came.
      go(b, 'flung', RIG.flingTime);
      b.flyX = -dirX(b.facing) * (RIG.fling / RIG.flingTime);
      b.flyZ = -dirZ(b.facing) * (RIG.fling / RIG.flingTime);
    } else {
      go(b, 'stun', RIG.stun);
    }
    const doing = b.doing, until = b.until;
    hurtGuard(b, b.def.guard * b.def.rigShare + 0.001, 'world');
    // A broken part staggers the beast. What the rig does to it lasts at least as long.
    if (b.doing === 'stun' && doing !== 'stun') { b.doing = doing; b.until = Math.max(until, doing === 'flung' ? until : SEGMENT_STAGGER); }
  }

  /** Sets off the rig the beast stands on. True when one went off. */
  function touchRigs(b: Beast): boolean {
    for (let i = 0; i < rigs.length; i++) {
      const r = rigs[i] as Rig;
      if (!r.armed || r.kind === 'channel') continue;
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

  function canPlace(kind: RigKind, x: number, z: number): string | null {
    if (way !== 'world') return 'Rigs belong to the third way to fight.';
    if (usedKinds.has(kind)) return 'The kit holds one of each.';
    const cx = Math.floor(x) + 0.5, cz = Math.floor(z) + 0.5;
    if (Math.hypot(cx - hero.x, cz - hero.z) > RIG.reach) return 'Too far.';
    const alongX = channelAlongX(cx, cz);
    const cells = kind === 'channel' ? [-1, 0, 1] : [0];
    for (const o of cells) {
      const px = cx + (alongX ? o : 0), pz = cz + (alongX ? 0 : o);
      if (shut(px, pz)) return 'Not there.';
      for (let i = 0; i < rigs.length; i++) {
        const r = rigs[i] as Rig;
        if (Math.abs(r.x - px) < 1.5 && Math.abs(r.z - pz) < 1.5) return 'Too close to another rig.';
      }
      for (let i = 0; i < beasts.length; i++) {
        const b = beasts[i] as Beast;
        if (Math.hypot(b.x - px, b.z - pz) < b.def.radius + RIG.clear) return 'Too close to the beast.';
      }
    }
    return null;
  }

  // ================================================ milestone 3: the boss hooks
  // Two things a boss needs that a beast fight does not, so a boss can be its own module
  // (`src/game/fight/hall.sim.ts`). A beast fight never makes either, and plays exactly as before.
  //
  // Targets: things the hero can hit that are not beasts. A cut or a spin, thrown light and the pet's strike
  // take their guard while they are open, as they take a beast's. At 0 one breaks and stays broken.
  //
  // Loose shapes: a shape on the ground that belongs to no beast. It shows for its lead and lands on the hero and
  // the pet like any attack: the same `tell` and `strike` events, the same dodge, the same record.

  interface TargetInner extends Target { broken: boolean }
  interface Loose { shape: Telegraph; spec: LooseShape; landed: boolean }
  const targets: TargetInner[] = [];
  const loose: Loose[] = [];
  let nextTarget = 1;
  /** The target the pet goes for with the hero fighting: the one the hero hit last. */
  let petGoal: TargetInner | null = null;

  function addTarget(spec: TargetSpec): Target {
    const t: TargetInner = { id: nextTarget++, name: spec.name ?? 'target', x: spec.x, z: spec.z, radius: spec.radius, guard: spec.guard, full: spec.guard, open: spec.open ?? true, broken: false, high: spec.high ?? false };
    targets.push(t);
    return t;
  }

  function removeTarget(target: Target): void {
    const i = targets.indexOf(target as TargetInner);
    if (i >= 0) targets.splice(i, 1);
    if (petGoal === target) petGoal = null;
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
    if (petGoal === t) petGoal = null;
    emit('targetBroken', t.x, t.z, 0, t.name);
  }

  /** A cut or a spin lands on every open target in its shape. Returns how many it hit. */
  function landOnTargets(spin: boolean): number {
    let hits = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i] as TargetInner;
      if (!t.open || t.broken) continue;
      const grow = t.radius + 0.25;
      const inside = spin
        ? inCircle(t.x, t.z, hero.x, hero.z, HERO.spin.reach + grow)
        : inCone(t.x, t.z, hero.x, hero.z, hero.facing, HERO.cut.reach, HERO.cut.arc / 2, grow);
      if (!inside) continue;
      hits++;
      hurtTarget(t, spin ? HERO.spin.guard : HERO.cut.guard);
      // With the hero fighting, the pet goes for it too.
      if (way === 'hero' && pet.mode !== 'down' && !t.broken && !t.high && petGoal !== t) {
        pet.mode = 'engage';
        pet.target = null;
        petGoal = t;
        pet.toStrike = PET.firstStrike;
      }
    }
    return hits;
  }

  /** Thrown light that reaches an open target lands on it. True when it did. */
  function boltOnTargets(bolt: Bolt): boolean {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i] as TargetInner;
      if (!t.open || t.broken || t.high || !inCircle(bolt.x, bolt.z, t.x, t.z, t.radius + 0.35)) continue;
      bolt.live = false;
      record.throwHits++;
      emit('boltHit', bolt.x, bolt.z, 0);
      hurtTarget(t, HERO.bolt.guard);
      return true;
    }
    return false;
  }

  /** The pet at a target: it runs in and strikes it, as it strikes a beast. */
  function petAtTarget(dt: number): void {
    const p = pet, t = petGoal;
    if (!t || t.broken || !t.open) {
      p.mode = 'heel';
      petGoal = null;
      return;
    }
    const d = Math.hypot(t.x - p.x, t.z - p.z), near = t.radius + PET.strikeGap;
    if (d > near) {
      p.moving = walk(p, t.x, t.z, p.def.speed, dt, PET.body);
      // A target out of the pet's reach (up on the boss) is let go.
      if (!p.moving) { p.mode = 'heel'; petGoal = null; }
      return;
    }
    p.facing = facingOf(t.x - p.x, t.z - p.z);
    p.toStrike -= dt;
    if (p.toStrike > 0) return;
    emit('petStrike', t.x, t.z, 0);
    p.toStrike = p.def.every * (way === 'hero' ? PET.helperSlow : 1);
    p.strikeT = 0.001;
    hurtTarget(t, p.def.strike);
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
        if (pet.mode === 'brace' && inCircle(hero.x, hero.z, pet.x, pet.z, 1.8)) hurtPet(null, a.id);
        else hurtHero(a.damage, a.heavy, fx, fz, a.id, a.push);
      }
      if (covers(s, pet.x, pet.z, PET.body)) hurtPet(null, a.id);
      // It stays on the ground a moment as a flash, then the slot is free: the shapes' own clock lets it go.
      loose.splice(i, 1);
    }
  }

  function clearBossHooks(): void {
    targets.length = 0;
    loose.length = 0;
    petGoal = null;
  }
  // ================================================ end of the boss hooks

  // ------------------------------------------------ the fight's life

  function endOpen(): void {
    if (phase === 'fight' && record.result === 'open') {
      record.result = 'left';
      record.length = clock;
      options.onEnd?.(copyRecord());
    }
  }

  function clear(): void {
    endOpen();
    beasts.length = 0;
    rigs.length = 0;
    usedKinds.clear();
    for (let i = 0; i < SHAPES; i++) (shapes[i] as Telegraph).live = false;
    for (let i = 0; i < BOLTS; i++) (bolts[i] as Bolt).live = false;
    hero.health = HERO.health;
    hero.stamina = HERO.stamina;
    hero.safe = 0;
    hero.pushLeft = 0;
    hero.charge = 0;
    hero.charged = false;
    if (hero.act !== 'none') act('none');
    pet.mode = 'heel';
    pet.target = null;
    pet.back = null;
    pet.pounce = false;
    pet.hearts = pet.def.hearts;
    pet.rests[0] = pet.rests[1] = 0;
    pet.lureRest = 0;
    pet.ordered = -1;
    clearBossHooks(); // Milestone 3.
    phase = 'idle';
    clock = 0;
    setupFrom = -1;
    sinceStart = 0;
    record = emptyRecord(way, pet.def.kind, gentle);
  }

  const fight: Fight = {
    get way() { return way; },
    get gentle() { return gentle; },
    get phase() { return phase; },
    get clock() { return clock; },
    hero, pet, beasts, shapes, bolts, rigs, events, input,
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
      stepPet(dt);
      stepBolts(dt);
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
      record = emptyRecord(way, pet.def.kind, gentle);
    },

    setPet(kind) {
      clear();
      pet.def = fightPetOf(kind);
      pet.hearts = pet.def.hearts;
      record = emptyRecord(way, pet.def.kind, gentle);
    },

    setGentle(on) {
      gentle = on;
      record.gentle = on;
    },

    bring(kind) {
      clear();
      const def = beastOf(kind);
      const b: Beast = {
        id: nextId++, def, x: stage.den.x, z: stage.den.z, facing: Math.PI, doing: 'asleep', t: 0, until: 0, guard: def.guard, attack: null,
        calm: 0, marks: 0, moving: false,
        // The first attack does not come the moment it wakes.
        rests: def.attacks.map(() => 0.3 + random() * 0.3), run: 0, hitHero: false, hitPet: false, shape: null, calming: false, markLeft: 0,
        angerHero: 0, angerPet: 0, drawn: 0, flyX: 0, flyZ: 0, pushX: 0, pushZ: 0, pushLeft: 0,
      };
      beasts.push(b);
      record.enemy = kind;
      phase = 'setup';
      emit('brought', b.x, b.z, 0, kind);
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
      rigs.push({ kind, x: cx, z: cz, alongX: channelAlongX(cx, cz), armed: true, spent: 0 });
      usedKinds.add(kind);
      record.rigsPlaced++;
      record.layout.push(`${kind}@${Math.round(cx - stage.center.x)},${Math.round(cz - stage.center.z)}`);
      if (phase === 'setup' && setupFrom < 0) setupFrom = sinceStart;
      useful();
      emit('rigPlaced', cx, cz, RIG_KINDS.indexOf(kind), kind);
      return null;
    },

    takeBack() {
      for (let i = rigs.length - 1; i >= 0; i--) {
        const r = rigs[i] as Rig;
        if (!r.armed) continue;
        rigs.splice(i, 1);
        usedKinds.delete(r.kind);
        record.rigsPlaced--;
        record.layout.pop();
        emit('rigTaken', r.x, r.z, RIG_KINDS.indexOf(r.kind), r.kind);
        return true;
      }
      return false;
    },

    skill(slot) {
      const skill = skillAt(slot);
      if (!skill) return null;
      if (skill === 'lure') return { name: 'Lure', left: pet.lureRest, rest: PET.lureRest };
      return { name: skill.name, left: pet.rests[slot], rest: skill.rest };
    },

    kit: () => RIG_KINDS.filter((kind) => !usedKinds.has(kind)),

    targets,
    addTarget,
    removeTarget,
    threaten,
    cancel: cancelLoose,
  };
  return fight;
}

export { BEASTS };
