// The Verdant Stag's hall: a god as tall as an oak, chained standing in a round hall, that the hero frees. It is
// the first test of a giant boss: the research (note 08, section 4) says a giant works when the giant is the
// place and the things you hit are small parts of it, and fails when it stops attacking you.
//
// Three phases, from the story (handbook 04d, "How fights work"):
//   1. The chains.      Four pins round the floor, each a target. The Stag sweeps its antlers across the floor
//                       where the hero stands, and stamps a leg when the hero comes close. A broken pin drops
//                       its chain and the Stag staggers.
//   2. The overgrowth.  Roots and seed pods flood the hall. A pod comes up only in the dark, grows with a ring on
//                       the ground, and bursts. A cut takes it. The hero lights the lamps by hitting them; each
//                       lights a circle of floor. The sweeps go on. It ends when every lamp is lit and no pod is left.
//   3. The collar.      The vines make a ramp up the Stag's flank to the collar on its neck. On the way the Stag
//                       shakes: a stretch of the ramp under the hero, and a hit throws the hero off to the floor.
//                       The floor still gets the sweeps and the stamps. Breaking the collar frees it.
//
// The hall uses the fight's two boss hooks and nothing else: every pin, lamp, pod and the collar is a target,
// and every attack is a loose shape. A hero who faints wakes at the door, and the Stag keeps its phase and
// what is broken. Nobody dies.
//
// The lab steps it right after the fight, 60 times a second. Nothing here draws or reads a key. Every number is
// `STAG` in `src/game/content/fight.ts`; where things stand is `hall-layout.sim.ts`.
import { HERO, STAG, type StagAttack } from '../content/fight.ts';
import type { BossNumbers, Fight, FightRecord, Target, Telegraph } from './fight.sim.ts';
import { HALL, type HallStage, type Point } from './hall-layout.sim.ts';
import { dirX, dirZ } from './shapes.sim.ts';

/** 0 the chains, 1 the overgrowth, 2 the collar. */
export type HallPhase = 0 | 1 | 2;

export type StagDoing = 'asleep' | 'wait' | 'windup' | 'recover' | 'stagger' | 'rise' | 'freed';

/** What the Stag is doing, for the view's head and antlers. */
export interface StagState {
  doing: StagDoing;
  /** Seconds in what it is doing, and how long that lasts. */
  t: number;
  until: number;
  /** The attack it winds up or just landed, and its shape on the ground. */
  attack: StagAttack | null;
  shape: Telegraph | null;
  /** A sweep comes from the west (-1) or the east (1). */
  from: -1 | 1;
  /** Where it looks: the hero, or where its attack goes. */
  lookX: number;
  lookZ: number;
}

export interface Pod {
  target: Target;
  shape: Telegraph | null;
}

export type HallEventType = 'woke' | 'phase' | 'pin' | 'lamp' | 'sprout' | 'burst' | 'cut' | 'wither' | 'fall' | 'stagger' | 'freed' | 'restart';

/** Something the hall did, for the view. `n` is the phase on `phase`, the pin or lamp's number on `pin` and `lamp`. */
export interface HallEvent { type: HallEventType; x: number; z: number; n: number }

export interface Hall {
  readonly phase: HallPhase;
  /** Seconds since the Stag woke, and the seconds in each phase so far. */
  readonly clock: number;
  readonly phaseSeconds: readonly number[];
  readonly stag: StagState;
  /** The pins, the lamps and the collar, in the layout's order. A lamp that is lit is broken. */
  readonly pins: readonly Target[];
  readonly lamps: readonly Target[];
  readonly collar: Target;
  readonly pods: readonly Pod[];
  /** True once the collar broke. */
  readonly freed: boolean;
  /** Goes up by one each time the hall starts again, so a view knows to put it back. */
  readonly round: number;
  readonly stage: HallStage;
  /** What happened since the caller last emptied it. */
  readonly events: HallEvent[];
  /** The hall's numbers as they stand, in the shape of a fight's record. */
  record(): FightRecord;
  /** Once a step, right after the fight's own step. */
  step(dt: number): void;
  /** Starts the hall again from the chains, with the hero at the door. A fight in progress is reported as left. */
  restart(): void;
  /** True when the hero stands on the ramp. */
  onRamp(): boolean;
  /** True when a point of the floor is lit by a lamp. */
  lit(x: number, z: number): boolean;
}

export interface HallOptions {
  /** A repeatable random number from 0 to 1. */
  random?: () => number;
  /** Called with the record when the Stag is freed, and when a hall in progress is started again. */
  onEnd?: (record: FightRecord) => void;
}

/** A small repeatable random generator, for the hall's pods when nobody gives one. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createHall(fight: Fight, stage: HallStage, options: HallOptions = {}): Hall {
  const random = options.random ?? seeded(7);
  const events: HallEvent[] = [];
  const emit = (type: HallEventType, x: number, z: number, n = 0): void => { events.push({ type, x, z, n }); };
  const chest = stage.at(HALL.chest), collarAt = stage.at(HALL.collar);
  const legs = HALL.legs.map((p) => stage.at(p));

  const stag: StagState = { doing: 'asleep', t: 0, until: 0, attack: null, shape: null, from: 1, lookX: chest.x, lookZ: chest.z + 6 };
  let phase: HallPhase = 0, clock = 0, round = 0, freed = false;
  const phaseSeconds = [0, 0, 0];
  let pins: Target[] = [], lamps: Target[] = [], collar: Target = fight.addTarget({ x: 0, z: 0, radius: 0, guard: 1, open: false });
  const pods: Pod[] = [];
  let sinceSprout = 0;
  /** The stretch now running with no attack of the Stag's on the ground, and the longest in all and in each phase. */
  let quiet = 0, quietMost = 0;
  const quietByPhase = [0, 0, 0];
  const counts: Record<string, number> = {};
  const count = (name: string): void => { counts[name] = (counts[name] ?? 0) + 1; };
  let ended = false;
  /** The pins and lamps already counted as broken and lit, one bit each, and the shakes that landed on the hero so far. */
  let pinsDone = 0, lampsDone = 0, shakeHits = 0;

  // ------------------------------------------------ setting the hall up

  function setUp(): void {
    fight.clear();
    if (fight.way !== 'hero') fight.setWay('hero');
    stage.ramp = false;
    pins = HALL.pins.map((p, i) => { const at = stage.at(p); return fight.addTarget({ ...at, radius: STAG.pin.radius, guard: STAG.pin.guard, name: `pin${i + 1}` }); });
    lamps = HALL.lamps.map((p, i) => { const at = stage.at(p); return fight.addTarget({ ...at, radius: STAG.lamp.radius, guard: STAG.lamp.guard, name: `lamp${i + 1}`, open: false }); });
    collar = fight.addTarget({ ...collarAt, radius: STAG.collar.radius, guard: STAG.collar.guard, name: 'collar', open: false, high: true });
    pods.length = 0;
    phase = 0;
    clock = 0;
    phaseSeconds[0] = phaseSeconds[1] = phaseSeconds[2] = 0;
    quiet = quietMost = 0;
    quietByPhase[0] = quietByPhase[1] = quietByPhase[2] = 0;
    for (const key in counts) delete counts[key];
    freed = ended = false;
    pinsDone = lampsDone = shakeHits = 0;
    sinceSprout = 0;
    go('asleep', 0);
    stag.attack = null;
    stag.shape = null;
    stag.lookX = chest.x;
    stag.lookZ = chest.z + 6;
    fight.placeHero(stage.start.x, stage.start.z);
    fight.hero.facing = Math.PI;
  }

  function go(doing: StagDoing, until: number): void {
    stag.doing = doing;
    stag.t = 0;
    stag.until = until;
  }

  // ------------------------------------------------ where the hero is

  const hero = fight.hero;
  const onRamp = (): boolean => stage.rampAt(hero.x, hero.z) > 0;
  /** Blocks from the hero to the edge of the Stag's body. */
  function toBody(): number {
    const b = HALL.body, lx = hero.x - stage.center.x + 0.5, lz = hero.z - stage.center.z + 0.5;
    const dx = Math.max(b.x0 - lx, 0, lx - b.x1), dz = Math.max(b.z0 - lz, 0, lz - b.z1);
    return Math.hypot(dx, dz);
  }

  function lit(x: number, z: number): boolean {
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i] as Target;
      if (l.broken && Math.hypot(x - l.x, z - l.z) <= STAG.lamp.light) return true;
    }
    return false;
  }

  // ------------------------------------------------ the Stag's attacks

  function sweep(): void {
    // Across the whole floor, through where the hero stands, from one side and then the other. Never behind its chest.
    // A sweep from the east (1) starts at the east edge and runs west.
    stag.from = stag.from === 1 ? -1 : 1;
    const z = Math.max(chest.z + 1.2, hero.z), x = stage.center.x + stag.from * (HALL.radius + 0.5);
    const facing = stag.from === 1 ? -Math.PI / 2 : Math.PI / 2;
    begin('sweep', fight.threaten({ kind: 'line', x, z, facing, reach: HALL.radius * 2 + 1, width: STAG.sweep.width, lead: STAG.sweep.lead, damage: STAG.sweep.damage, heavy: STAG.sweep.heavy, id: 'sweep' }), x, z);
  }

  function stamp(): void {
    let leg = legs[0] as { x: number; z: number }, near = Infinity;
    for (const l of legs) { const d = Math.hypot(hero.x - l.x, hero.z - l.z); if (d < near) { near = d; leg = l; } }
    begin('stamp', fight.threaten({ kind: 'circle', x: leg.x, z: leg.z, facing: 0, reach: STAG.stamp.radius, width: 0, lead: STAG.stamp.lead, damage: STAG.stamp.damage, heavy: STAG.stamp.heavy, id: 'stamp' }), leg.x, leg.z);
  }

  function shake(): void {
    // A stretch of the ramp under the hero. Its middle line runs along the flank, so a hit throws the hero out, off the vines.
    const x = stage.center.x + 2.5, length = STAG.shake.length;
    begin('shake', fight.threaten({ kind: 'line', x, z: hero.z + length / 2, facing: 0, reach: length, width: STAG.shake.width, lead: STAG.shake.lead, damage: STAG.shake.damage, heavy: STAG.shake.heavy, id: 'shake', push: STAG.shake.push }), hero.x, hero.z);
  }

  function begin(attack: StagAttack, shape: Telegraph | null, lookX: number, lookZ: number): void {
    stag.attack = attack;
    stag.shape = shape;
    stag.lookX = lookX;
    stag.lookZ = lookZ;
    go('windup', shape ? shape.lead : 1);
    count(attack + 's');
    quiet = 0;
  }

  /** The next attack: a shake for a hero on the ramp, a stamp for one beside its legs, a sweep for anyone else. */
  function attack(): void {
    if (phase === 2 && onRamp()) shake();
    else if (toBody() <= STAG.stamp.near) stamp();
    else sweep();
  }

  function stepStag(dt: number): void {
    stag.t += dt;
    if (stag.doing === 'windup' || stag.doing === 'wait') { stag.lookX += (hero.x - stag.lookX) * Math.min(1, dt * 2); stag.lookZ += (hero.z - stag.lookZ) * Math.min(1, dt * 2); }
    switch (stag.doing) {
      case 'asleep':
      case 'freed':
        return;
      case 'windup':
        if (stag.t >= stag.until) go('recover', STAG.recover);
        return;
      case 'recover':
        if (stag.t >= stag.until) { go('wait', STAG.pause[phase] as number); stag.attack = null; }
        return;
      case 'stagger':
        // It comes out of a stagger angry, and attacks at once.
        if (stag.t >= stag.until) { go('wait', 0); stag.attack = null; }
        return;
      case 'rise':
        if (stag.t >= stag.until) { go('wait', 0); stag.attack = null; }
        return;
      case 'wait':
        // Nothing hits a fainted hero, so it waits for them to wake.
        if (stag.t >= stag.until && hero.act !== 'faint') attack();
        return;
    }
  }

  function stagger(): void {
    if (stag.doing === 'windup' && stag.shape) fight.cancel(stag.shape);
    stag.shape = null;
    go('stagger', STAG.stagger);
    emit('stagger', chest.x, chest.z);
  }

  // ------------------------------------------------ the phases

  function nextPhase(): void {
    if (stag.doing === 'windup' && stag.shape) fight.cancel(stag.shape);
    stag.shape = null;
    stag.attack = null;
    phase = (phase + 1) as HallPhase;
    go('rise', STAG.rise);
    emit('phase', chest.x, chest.z, phase);
    if (phase === 1) for (const l of lamps) l.open = true;
    if (phase === 2) {
      stage.ramp = true;
      // A hero standing where the vines come up is lifted onto them: the view sets the body on the ramp's top.
    }
  }

  function sprout(): void {
    for (let tries = 0; tries < 14; tries++) {
      const angle = random() * Math.PI * 2, d = STAG.pod.near + random() * (STAG.pod.far - STAG.pod.near);
      const x = hero.x + Math.sin(angle) * d, z = hero.z - Math.cos(angle) * d;
      if (!stage.inside(x, z) || Math.hypot(x - stage.center.x, z - stage.center.z) > HALL.radius - 1) continue;
      if (stage.solid(x, z) || lit(x, z)) continue;
      let crowded = false;
      for (const p of pods) if (Math.hypot(p.target.x - x, p.target.z - z) < STAG.pod.apart) crowded = true;
      for (const l of lamps) if (Math.hypot(l.x - x, l.z - z) < STAG.pod.apart) crowded = true;
      if (crowded) continue;
      const target = fight.addTarget({ x, z, radius: STAG.pod.radius, guard: STAG.pod.guard, name: 'pod' });
      const shape = fight.threaten({ kind: 'circle', x, z, facing: 0, reach: STAG.pod.burst, width: 0, lead: STAG.pod.grow, damage: STAG.pod.damage, heavy: false, id: 'pod' });
      pods.push({ target, shape });
      count('pods');
      emit('sprout', x, z);
      return;
    }
  }

  function dropPod(i: number, why: 'cut' | 'burst' | 'wither'): void {
    const p = pods[i] as Pod;
    if (p.shape && why !== 'burst') fight.cancel(p.shape);
    fight.removeTarget(p.target);
    pods.splice(i, 1);
    count(why === 'cut' ? 'podsCut' : why === 'burst' ? 'podsBurst' : 'podsWithered');
    emit(why, p.target.x, p.target.z);
  }

  function stepOvergrowth(dt: number): void {
    const dark = lamps.some((l) => !l.broken);
    sinceSprout += dt;
    if (dark && stag.doing !== 'rise' && sinceSprout >= STAG.pod.every && pods.length < STAG.pod.most && hero.act !== 'faint') {
      sinceSprout = 0;
      sprout();
    }
    for (let i = pods.length - 1; i >= 0; i--) {
      const p = pods[i] as Pod;
      if (p.target.broken) dropPod(i, 'cut');
      else if (lit(p.target.x, p.target.z)) dropPod(i, 'wither');
      else if (!p.shape || !p.shape.live || p.shape.t >= p.shape.lead) dropPod(i, 'burst');
    }
    if (!dark && pods.length === 0 && stag.doing !== 'rise') nextPhase();
  }

  // ------------------------------------------------ the record

  function record(): FightRecord {
    const r = fight.record;
    const boss: BossNumbers = { phases: [...phaseSeconds], quiet: quietMost, quietByPhase: [...quietByPhase], counts: { ...counts } };
    return { ...r, hitBy: { ...r.hitBy }, layout: [], way: 'stag', enemy: STAG.name, result: freed ? 'calmed' : ended ? 'left' : 'open', length: clock, setup: 0, boss };
  }

  function end(result: 'calmed' | 'left'): void {
    if (ended || stag.doing === 'asleep') return;
    ended = true;
    const r = record();
    r.result = result;
    options.onEnd?.(r);
  }

  // ------------------------------------------------ one step

  const hall: Hall = {
    get phase() { return phase; },
    get clock() { return clock; },
    phaseSeconds,
    stag,
    get pins() { return pins; },
    get lamps() { return lamps; },
    get collar() { return collar; },
    pods,
    get freed() { return freed; },
    get round() { return round; },
    stage,
    events,
    record,
    onRamp,
    lit,

    step(dt) {
      if (freed) { stag.t += dt; return; }
      if (stag.doing === 'asleep') {
        if (Math.hypot(hero.x - chest.x, hero.z - chest.z) > STAG.wakes) return;
        go('wait', 0.6);
        emit('woke', chest.x, chest.z);
      }
      clock += dt;
      phaseSeconds[phase] = (phaseSeconds[phase] as number) + dt;
      const down = hero.act === 'faint';
      // The quiet: no attack of the Stag's own on the ground, while the hero is up to be attacked.
      if (stag.doing !== 'windup' && !down) {
        quiet += dt;
        if (quiet > quietMost) quietMost = quiet;
        if (quiet > (quietByPhase[phase] as number)) quietByPhase[phase] = quiet;
      }
      // The antlers and the hooves pass under the vines, and a shake of the vines does not reach the floor: an attack
      // about to land where the hero no longer is lands on nothing.
      const shape = stag.shape;
      if (shape && shape.live && stag.doing === 'windup' && shape.t + dt >= shape.lead && (stag.attack === 'shake') !== onRamp()) {
        fight.cancel(shape);
        count('missed');
      }
      stepStag(dt);

      // Phase 1: a broken pin drops its chain and the Stag staggers.
      if (phase === 0) {
        for (let i = 0; i < pins.length; i++) {
          const pin = pins[i] as Target;
          if (!pin.broken || pinsDone & (1 << i)) continue;
          pinsDone |= 1 << i;
          count('pins');
          emit('pin', pin.x, pin.z, i);
          if (pins.every((p) => p.broken)) nextPhase();
          else stagger();
        }
      } else if (phase === 1) {
        for (let i = 0; i < lamps.length; i++) {
          const l = lamps[i] as Target;
          if (l.broken && !(lampsDone & (1 << i))) { lampsDone |= 1 << i; count('lamps'); emit('lamp', l.x, l.z, i); }
        }
        stepOvergrowth(dt);
      } else {
        // Phase 3: the collar opens to a hero high on the ramp.
        collar.open = !collar.broken && stage.rampAt(hero.x, hero.z) >= HALL.reachFrom;
        if (collar.broken) {
          if (stag.doing === 'windup' && stag.shape) fight.cancel(stag.shape);
          freed = true;
          stag.shape = null;
          stag.attack = null;
          go('freed', 0);
          stag.lookX = hero.x;
          stag.lookZ = hero.z;
          emit('freed', collar.x, collar.z);
          end('calmed');
        }
      }
      // A hero thrown off the vines lands on the floor.
      if (phase === 2 && shakeHits < (fight.record.hitBy.shake ?? 0)) {
        shakeHits = fight.record.hitBy.shake ?? 0;
        count('falls');
        emit('fall', hero.x, hero.z);
      }
    },

    restart() {
      end('left');
      round++;
      setUp();
      emit('restart', stage.start.x, stage.start.z);
    },
  };
  setUp();
  return hall;
}

/** Points of the layout the hall's bot walks between: the foot of the ramp and a spot high on it. */
export function rampWay(stage: HallStage): { foot: { x: number; z: number }; top: { x: number; z: number } } {
  const first = HALL.ramp[0] as { x: number; z: number }, last = HALL.ramp[HALL.ramp.length - 1] as { x: number; z: number };
  return { foot: stage.at({ x: first.x + 1, z: first.z + 1.6 }), top: stage.at({ x: last.x + 0.5, z: last.z + 2.4 }) };
}

export type { Point };

// ---------------------------------------------------------------------------------------- the hall's bot

export interface HallBotOptions {
  /** Seconds a shape lies on the ground before the bot sees it. 0.3 by default. */
  reaction?: number;
}

/**
 * A player made of rules for the hall, the hero's way: step out of what is about to land, break the nearest pin,
 * cut the pods that come up near it and light the lamps, then climb the vines and cut the collar. On the ramp it
 * steps down out of a shake instead of to the side, which would be off the vines. It writes `fight.input` and
 * calls `fight.press`, as the keys do.
 */
export function createHallBot(fight: Fight, hall: Hall, options: HallBotOptions = {}): { step(dt: number): void } {
  const reaction = options.reaction ?? 0.3;
  const { foot, top } = rampWay(hall.stage);
  const out = { x: 0, z: 0 };
  /** A post in the way: seconds the hero has not moved while walking, and seconds left of stepping round it. */
  let stuck = 0, round = 0, lastX = 0, lastZ = 0;

  function moveTo(x: number, z: number, stop = 0.25): boolean {
    const { hero, input } = fight, dx = x - hero.x, dz = z - hero.z, d = Math.hypot(dx, dz);
    if (d <= stop) return true;
    input.moveX = dx / d;
    input.moveZ = dz / d;
    // Walking into a post: step round it, a quarter turn to the left, for a moment.
    if (round > 0) { input.moveX = dz / d; input.moveZ = -dx / d; }
    return false;
  }

  /** How deep the hero stands in a shape about to land, and the way out. 0 when outside. */
  function inside(s: Telegraph, x: number, z: number): number {
    const grow = HERO.body + 0.35, dx = x - s.x, dz = z - s.z;
    if (s.kind === 'circle') {
      const d = Math.hypot(dx, dz);
      out.x = d > 0.01 ? dx / d : 1;
      out.z = d > 0.01 ? dz / d : 0;
      return Math.max(0, s.reach + grow - d);
    }
    const fx = dirX(s.facing), fz = dirZ(s.facing), along = dx * fx + dz * fz, across = dx * fz - dz * fx;
    if (along < -grow || along > s.reach + grow || Math.abs(across) > s.width / 2 + grow) return 0;
    const side = across >= 0 ? 1 : -1;
    out.x = fz * side;
    out.z = -fx * side;
    return s.width / 2 + grow - Math.abs(across);
  }

  function avoid(): boolean {
    const { hero, input } = fight;
    let worst = 0, left = Infinity, ox = 0, oz = 0, ramp = false, floor = false;
    for (const s of fight.shapes) {
      if (!s.live || s.t >= s.lead || s.t < reaction) continue;
      const deep = inside(s, hero.x, hero.z);
      if (deep <= worst) continue;
      worst = deep;
      left = s.lead - s.t;
      ox = out.x;
      oz = out.z;
      ramp = s === hall.stag.shape && hall.stag.attack === 'shake';
      floor = s === hall.stag.shape && hall.stag.attack !== 'shake';
    }
    if (worst <= 0) return false;
    // At the foot of the vines, up them is the way out of a sweep: nothing on the floor lands on a hero up there.
    if (floor && hall.phase === 2 && Math.hypot(hero.x - foot.x, hero.z - foot.z) < 2.5) return false;
    if (ramp) {
      // Down the vines, out of the stretch that shakes.
      input.moveX = 0;
      input.moveZ = 1;
      return true;
    }
    input.moveX = ox;
    input.moveZ = oz;
    if (left < worst / HERO.walk + 0.12 && left < 0.3 && hero.stamina >= HERO.dodge.cost) fight.press('dodge');
    return true;
  }

  function cut(t: Target): void {
    const { hero, input } = fight, d = Math.hypot(t.x - hero.x, t.z - hero.z);
    input.aimX = t.x;
    input.aimZ = t.z;
    if (d - t.radius > HERO.cut.reach - 0.3) { moveTo(t.x, t.z); return; }
    fight.press('attack');
  }

  /** The nearest target in a list that is still to break. */
  function nearest(list: readonly Target[]): Target | null {
    let best: Target | null = null, near = Infinity;
    for (const t of list) {
      if (t.broken) continue;
      const d = Math.hypot(t.x - fight.hero.x, t.z - fight.hero.z);
      if (d < near) { near = d; best = t; }
    }
    return best;
  }

  return {
    step(dt) {
      const { hero, input } = fight;
      const moved = Math.hypot(hero.x - lastX, hero.z - lastZ);
      lastX = hero.x;
      lastZ = hero.z;
      stuck = Math.hypot(input.moveX, input.moveZ) > 0.5 && moved < 0.005 && hero.act === 'none' ? stuck + dt : 0;
      round = stuck > 0.25 ? 0.45 : Math.max(0, round - dt);
      input.moveX = input.moveZ = 0;
      input.attackHeld = input.calmHeld = input.placing = false;
      if (hall.freed || hero.act === 'faint') return;
      if (hall.stag.doing === 'asleep') { moveTo(hall.stage.center.x, hall.stage.center.z); return; }
      if (avoid()) return;
      if (hall.phase === 0) {
        const pin = nearest(hall.pins);
        if (pin) cut(pin);
        return;
      }
      if (hall.phase === 1) {
        // A pod close by first, then the nearest dark lamp.
        let pod: Target | null = null, near = 4.5;
        for (const p of hall.pods) { const d = Math.hypot(p.target.x - hero.x, p.target.z - hero.z); if (d < near) { near = d; pod = p.target; } }
        const goal = pod ?? nearest(hall.lamps) ?? nearest(hall.pods.map((p) => p.target));
        if (goal) cut(goal);
        return;
      }
      // Up the vines: to the foot, then up the middle of the ramp to the top, then cut the collar.
      if (!hall.onRamp()) { if (moveTo(foot.x, foot.z, 0.4)) input.moveZ = -1; return; }
      if (hall.collar.open) {
        input.aimX = hall.collar.x;
        input.aimZ = hall.collar.z;
        fight.press('attack');
        if (hero.z > top.z + 0.3) moveTo(top.x, top.z);
        return;
      }
      moveTo(top.x, Math.min(top.z, hero.z - 1));
    },
  };
}
