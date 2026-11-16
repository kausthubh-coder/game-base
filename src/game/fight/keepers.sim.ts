// The three vault keepers of act 1 (handbook chapter 23, fights 7, 9 and 10). Each keeps one rule of its place,
// and the hero wins by using that rule, not by hitting harder:
//
//   The Sluice Keeper (the Pump House)   A large gearling on wheels. It rolls at the hero down a line and sprays a
//                                        ring when they come close. Three sluice gates stand at the ends of three
//                                        channels; two cuts open one and its channel floods. A keeper on wet ground
//                                        stalls, and only then is its heart open.
//   The Lamplighter (the Lamp Gallery)   A brass sentry on a post in the middle of the room. It turns to the hero
//                                        and fires a beam down a long line. Four lamps stand round it; two cuts
//                                        light one. A beam that crosses a lit lamp is blinded, and the sentry stands
//                                        open.
//   The Wild Harvester (the Seed Vault)  A machine arm in the middle of the room that sweeps and slams. Root pods
//                                        grow round the room and burst; while a pod stands its heart mends and stays
//                                        shut. The companion's skill (C) holds the arm while the hero breaks the pods.
//
// Like the Stag's hall, a keeper uses the fight's two boss hooks and nothing else: its gates, lamps, pods and
// heart are targets, and every attack is a loose shape. A hero who faints wakes at the door, and the keeper keeps
// what was broken. A keeper is shut down, never calmed.
//
// The rooms are the ruins builder's. `keeperRoom` is a test room for each, made the same way the ruins will make
// theirs: a `Stage` and the points of the room's things. `src/game/fights` starts a keeper in whichever room it
// is given (`FightsApi.startKeeper`). Every number is `KEEPERS` in `src/game/content/fight.ts`.
import { KEEPERS, SWORD, type KeeperKind } from '../content/fight.ts';
import type { Stage } from './arena.sim.ts';
import type { Bot } from './bot.sim.ts';
import type { Fight, FightRecord, Target, Telegraph } from './fight.sim.ts';
import { dirX, dirZ, facingOf, inCircle, inLine, turnBetween } from './shapes.sim.ts';

export interface Point { readonly x: number; readonly z: number }

/** A keeper's room: the ground, and where its things stand, in the world's blocks. */
export interface KeeperRoom {
  readonly kind: KeeperKind;
  readonly stage: Stage;
  /** Where the keeper stands at the start: the sluice keeper's rest, the lamplighter's post, the harvester's arm. */
  readonly home: Point;
  /** The sluice keeper: each channel as its cells, foot to end, and the gate at its end. */
  readonly channels?: readonly { readonly cells: readonly Point[]; readonly gate: Point }[];
  /** The lamplighter: its four lamps. */
  readonly lamps?: readonly Point[];
  /** The harvester: where its pods may grow. */
  readonly beds?: readonly Point[];
}

export type KeeperDoing = 'asleep' | 'wait' | 'windup' | 'roll' | 'recover' | 'stalled' | 'blinded' | 'held' | 'down';

/** The keeper's body, for the view. */
export interface KeeperBody {
  x: number;
  z: number;
  facing: number;
  doing: KeeperDoing;
  t: number;
  until: number;
  /** The attack it winds up or just landed. */
  attack: string | null;
}

export type KeeperEventType = 'woke' | 'flood' | 'dry' | 'stall' | 'lit' | 'dark' | 'blind' | 'sprout' | 'burst' | 'cut' | 'held' | 'down';
export interface KeeperEvent { type: KeeperEventType; x: number; z: number; n: number }

export interface Keeper {
  readonly kind: KeeperKind;
  readonly name: string;
  readonly room: KeeperRoom;
  readonly body: KeeperBody;
  /** Its heart: open only when the room's rule has caught it. */
  readonly heart: Target;
  /** The gates, lamps or pods, as targets. */
  readonly parts: readonly Target[];
  /** True once its heart broke: it is shut down. */
  readonly won: boolean;
  readonly clock: number;
  readonly events: KeeperEvent[];
  /** Once a step, right after the fight's own. */
  step(dt: number): void;
  /** Starts it again from the start, with the hero at the door. */
  restart(): void;
  /**
   * The harvester: the companion runs in and holds the arm, whichever companion it is. C does it in the world's
   * fight, and so does the companion's own skill. False while the arm is held already or the companion rests.
   */
  hold(): boolean;
  /** Seconds before the companion can hold the arm again. */
  readonly holdRest: number;
  /** A channel's flood, for the view: seconds left, 0 when dry. */
  flooded(channel: number): number;
  /** A lamp that is lit, for the view: seconds left, 0 when dark. */
  lit(lamp: number): number;
  record(): FightRecord;
}

export interface KeeperOptions {
  random?: () => number;
  /** Called with the record when it is shut down. */
  onEnd?: (record: FightRecord) => void;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------- the test rooms

/** A round room of this radius, stone underfoot, with a wall round it and the door in the south. */
function roundRoom(x: number, z: number, radius: number, solidAt: (dx: number, dz: number) => boolean): Stage {
  const cx = x + 0.5, cz = z + 0.5;
  const out = (px: number, pz: number): number => Math.hypot(px - cx, pz - cz);
  return {
    solid: (px, pz) => out(px, pz) > radius + 0.5 || solidAt(Math.floor(px) - x, Math.floor(pz) - z),
    inside: (px, pz) => out(px, pz) <= radius,
    water: () => false,
    center: { x: cx, z: cz },
    radius,
    start: { x: cx, z: cz + radius - 1.5 },
    den: { x: cx, z: cz - 2 },
    wake: { x: cx, z: cz + radius - 1 },
  };
}

/** The test room of each keeper, round a middle point of the world: the corner of the middle block. */
export function keeperRoom(kind: KeeperKind, x: number, z: number): KeeperRoom {
  const at = (dx: number, dz: number): Point => ({ x: x + dx + 0.5, z: z + dz + 0.5 });
  if (kind === 'sluice') {
    // Three channels from near the middle to the wall: west, east and north-east of the door, their gates at the ends.
    const ways = [-Math.PI / 2, Math.PI / 2, Math.PI / 6];
    const channels = ways.map((w) => {
      const cells: Point[] = [];
      for (let d = 3; d <= 8; d++) cells.push(at(Math.round(dirX(w) * d), Math.round(dirZ(w) * d)));
      return { cells, gate: at(Math.round(dirX(w) * 9.5), Math.round(dirZ(w) * 9.5)) };
    });
    return { kind, stage: roundRoom(x, z, 12, () => false), home: at(0, -4), channels };
  }
  if (kind === 'lamplighter') {
    const lamps = [at(-5, -1), at(5, -1), at(-3, 4), at(3, 4)];
    return { kind, stage: roundRoom(x, z, 11, (dx, dz) => dx === 0 && dz === 0), home: at(0, 0), lamps };
  }
  const beds: Point[] = [];
  for (let i = 0; i < 8; i++) { const w = (i / 8) * Math.PI * 2; beds.push(at(Math.round(dirX(w) * 6), Math.round(dirZ(w) * 6))); }
  return { kind, stage: roundRoom(x, z, 11, (dx, dz) => Math.abs(dx) <= 0 && Math.abs(dz) <= 0), home: at(0, 0), beds };
}

// ---------------------------------------------------------------------------------------- the keepers

export function createKeeper(kind: KeeperKind, fight: Fight, room: KeeperRoom, options: KeeperOptions = {}): Keeper {
  const random = options.random ?? seeded(11);
  const def = KEEPERS[kind];
  const stage = room.stage;
  const events: KeeperEvent[] = [];
  const emit = (type: KeeperEventType, x: number, z: number, n = 0): void => { events.push({ type, x, z, n }); };
  const body: KeeperBody = { x: room.home.x, z: room.home.z, facing: Math.PI, doing: 'asleep', t: 0, until: 0, attack: null };
  let heart: Target = fight.addTarget({ x: 0, z: 0, radius: 0, guard: 1, open: false });
  let parts: Target[] = [];
  let shape: Telegraph | null = null;
  let won = false, clock = 0, ended = false;
  /** Seconds left of each channel's flood, or of each lamp's light. */
  const left: number[] = [];
  /** The sluice keeper's roll: blocks left and the way it goes. */
  let roll = 0;
  /** The harvester's pods and their bursting shapes; seconds to the next pod. */
  let pods: { target: Target; shape: Telegraph | null; t: number }[] = [];
  let sprout = 0;
  const counts: Record<string, number> = {};
  const count = (name: string): void => { counts[name] = (counts[name] ?? 0) + 1; };

  function go(doing: KeeperDoing, until: number): void {
    body.doing = doing;
    body.t = 0;
    body.until = until;
    if (doing !== 'windup' && doing !== 'roll') body.attack = null;
  }

  function setUp(): void {
    fight.clear();
    if (fight.way !== 'hero') fight.setWay('hero');
    body.x = room.home.x;
    body.z = room.home.z;
    body.facing = Math.PI;
    go('asleep', 0);
    heart = fight.addTarget({ x: body.x, z: body.z, radius: 'radius' in def ? def.radius : 1, guard: def.guard, name: 'heart', open: false, high: false });
    parts = [];
    left.length = 0;
    if (kind === 'sluice') for (const [i, c] of (room.channels ?? []).entries()) { parts.push(gate(c.gate, i)); left.push(0); }
    if (kind === 'lamplighter') for (const [i, p] of (room.lamps ?? []).entries()) { parts.push(lamp(p, i)); left.push(0); }
    pods = [];
    sprout = 0;
    shape = null;
    roll = 0;
    won = false;
    ended = false;
    clock = 0;
    for (const key in counts) delete counts[key];
    fight.placeHero(stage.start.x, stage.start.z);
  }

  const gate = (p: Point, i: number): Target => fight.addTarget({ x: p.x, z: p.z, radius: KEEPERS.sluice.gate.radius, guard: KEEPERS.sluice.gate.guard, name: `gate${i + 1}` });
  const lamp = (p: Point, i: number): Target => fight.addTarget({ x: p.x, z: p.z, radius: KEEPERS.lamplighter.lamp.radius, guard: KEEPERS.lamplighter.lamp.guard, name: `lamp${i + 1}` });

  const hero = (): { x: number; z: number } => fight.hero;
  const awake = (): boolean => body.doing !== 'asleep' && body.doing !== 'down';

  /** A loose shape of the keeper's, remembered so it can be told when it lands. */
  function threaten(spec: Parameters<Fight['threaten']>[0]): void {
    shape = fight.threaten(spec);
    body.attack = spec.id;
    go('windup', spec.lead);
    body.attack = spec.id;
  }

  function openHeart(seconds: number, why: KeeperDoing): void {
    if (shape) { fight.cancel(shape); shape = null; }
    go(why, seconds);
    heart.open = true;
  }

  function shutDown(): void {
    won = true;
    go('down', 0);
    for (const p of parts) p.open = false;
    for (const p of pods) { if (p.shape) fight.cancel(p.shape); fight.removeTarget(p.target); }
    pods = [];
    emit('down', body.x, body.z);
    if (ended) return;
    ended = true;
    options.onEnd?.(record());
  }

  // ------------------------------------------------ the sluice keeper

  /** True when the body stands on a flooded channel. */
  function onFlood(): number {
    const cs = room.channels ?? [];
    for (let i = 0; i < cs.length; i++) {
      if ((left[i] as number) <= 0) continue;
      for (const c of (cs[i] as { cells: readonly Point[] }).cells) if (inCircle(body.x, body.z, c.x, c.z, KEEPERS.sluice.radius * 0.8)) return i;
    }
    return -1;
  }

  function stepSluice(dt: number): void {
    const s = KEEPERS.sluice, h = hero();
    // A gate cut open floods its channel; it shuts again when the water runs out.
    const cs = room.channels ?? [];
    for (let i = 0; i < cs.length; i++) {
      const g = parts[i] as Target;
      if (g.broken && (left[i] as number) <= 0 && !g.open) {
        left[i] = s.gate.flood;
        count('floods');
        emit('flood', g.x, g.z, i);
      }
      if ((left[i] as number) > 0) {
        left[i] = Math.max(0, (left[i] as number) - dt);
        if ((left[i] as number) <= 0) {
          fight.removeTarget(g);
          parts[i] = gate((cs[i] as { gate: Point }).gate, i);
          emit('dry', g.x, g.z, i);
        }
      }
    }
    if (body.doing === 'stalled') {
      heart.x = body.x;
      heart.z = body.z;
      if (body.t >= body.until) { heart.open = false; go('recover', 0.6); }
      return;
    }
    const wet = onFlood();
    if (wet >= 0 && body.doing !== 'windup') { count('stalls'); emit('stall', body.x, body.z, wet); roll = 0; openHeart(s.stall, 'stalled'); return; }
    if (body.doing === 'roll') {
      const step = Math.min(roll, 12 * dt), nx = body.x + dirX(body.facing) * step, nz = body.z + dirZ(body.facing) * step;
      if (stage.solid(nx + dirX(body.facing) * s.radius, nz + dirZ(body.facing) * s.radius) || !stage.inside(nx, nz)) roll = 0;
      else { body.x = nx; body.z = nz; roll -= step; }
      heart.x = body.x;
      heart.z = body.z;
      if (roll <= 0.001) go('recover', 1);
      return;
    }
    if (body.doing === 'windup') {
      if (body.t >= body.until) {
        if (body.attack === 'roll') { roll = s.roll.length - 1; go('roll', 0); body.attack = 'roll'; }
        else go('recover', s.pause);
        shape = null;
      }
      return;
    }
    if (body.doing === 'recover' || body.doing === 'wait') { if (body.t >= body.until) go('wait', 0); else return; }
    // Wait: turn to the hero, roll at them from a distance, spray when they come close.
    const d = Math.hypot(h.x - body.x, h.z - body.z);
    body.facing = facingOf(h.x - body.x, h.z - body.z);
    if (d < s.jet.radius + 0.4) {
      threaten({ kind: 'circle', x: body.x, z: body.z, facing: 0, reach: s.jet.radius, width: 0, lead: s.jet.lead, damage: s.jet.damage, heavy: s.jet.heavy, id: 'jet' });
    } else if (d < s.roll.length) {
      threaten({ kind: 'line', x: body.x, z: body.z, facing: body.facing, reach: s.roll.length, width: s.roll.width, lead: s.roll.lead, damage: s.roll.damage, heavy: s.roll.heavy, id: 'roll' });
    } else {
      // Too far: it rolls nearer at its walking pace.
      const nx = body.x + dirX(body.facing) * s.speed * dt, nz = body.z + dirZ(body.facing) * s.speed * dt;
      if (!stage.solid(nx, nz) && stage.inside(nx, nz)) { body.x = nx; body.z = nz; }
      heart.x = body.x;
      heart.z = body.z;
    }
  }

  // ------------------------------------------------ the lamplighter

  function stepLamplighter(dt: number): void {
    const l = KEEPERS.lamplighter, h = hero();
    const lamps = room.lamps ?? [];
    for (let i = 0; i < lamps.length; i++) {
      const p = parts[i] as Target;
      if (p.broken && (left[i] as number) <= 0 && !p.open) { left[i] = 8; count('lamps'); emit('lit', p.x, p.z, i); }
      if ((left[i] as number) > 0) {
        left[i] = Math.max(0, (left[i] as number) - dt);
        if ((left[i] as number) <= 0) { fight.removeTarget(p); parts[i] = lamp(lamps[i] as Point, i); emit('dark', p.x, p.z, i); }
      }
    }
    if (body.doing === 'blinded') {
      if (body.t >= body.until) { heart.open = false; go('recover', 0.5); }
      return;
    }
    if (body.doing === 'windup') {
      if (body.t >= body.until) {
        // The beam lands: a lit lamp on its line blinds it, and the loose shape is taken off before it hurts.
        if (body.attack === 'beam' && shape) {
          for (let i = 0; i < lamps.length; i++) {
            const p = lamps[i] as Point;
            if ((left[i] as number) > 0 && inLine(p.x, p.z, shape.x, shape.z, shape.facing, shape.reach, shape.width, 0.8)) {
              const here = { x: p.x, z: p.z };
              count('blinded');
              emit('blind', here.x, here.z, i);
              openHeart(l.open, 'blinded');
              return;
            }
          }
        }
        shape = null;
        go('recover', l.pause);
      }
      return;
    }
    if (body.doing === 'recover' || body.doing === 'wait') { if (body.t >= body.until) go('wait', 0); else return; }
    const want = facingOf(h.x - body.x, h.z - body.z), off = turnBetween(body.facing, want), most = l.turn * dt;
    body.facing += Math.max(-most, Math.min(most, off));
    const d = Math.hypot(h.x - body.x, h.z - body.z);
    if (d < l.sparks.radius + 0.4) threaten({ kind: 'circle', x: body.x, z: body.z, facing: 0, reach: l.sparks.radius, width: 0, lead: l.sparks.lead, damage: l.sparks.damage, heavy: false, id: 'sparks' });
    else if (Math.abs(off) < 0.25) threaten({ kind: 'line', x: body.x, z: body.z, facing: body.facing, reach: l.beam.length, width: l.beam.width, lead: l.beam.lead, damage: l.beam.damage, heavy: l.beam.heavy, id: 'beam' });
  }

  // ------------------------------------------------ the wild harvester

  function stepHarvester(dt: number): void {
    const w = KEEPERS.harvester, h = hero();
    // Pods grow in the beds, burst when grown, and mend the heart while they stand.
    for (let i = pods.length - 1; i >= 0; i--) {
      const p = pods[i] as (typeof pods)[number];
      p.t += dt;
      if (p.target.broken) {
        if (p.shape) fight.cancel(p.shape);
        fight.removeTarget(p.target);
        pods.splice(i, 1);
        count('pods');
        emit('cut', p.target.x, p.target.z);
        continue;
      }
      if (p.t >= w.pod.grow) {
        fight.removeTarget(p.target);
        pods.splice(i, 1);
        emit('burst', p.target.x, p.target.z);
      }
    }
    sprout -= dt;
    const beds = room.beds ?? [];
    if (sprout <= 0 && pods.length < w.pod.most && beds.length > 0) {
      sprout = w.pod.every;
      // A bed away from the hero's feet.
      const start = Math.floor(random() * beds.length);
      for (let k = 0; k < beds.length; k++) {
        const b = beds[(start + k) % beds.length] as Point;
        if (Math.hypot(b.x - h.x, b.z - h.z) < 2 || pods.some((p) => p.target.x === b.x && p.target.z === b.z)) continue;
        const target = fight.addTarget({ x: b.x, z: b.z, radius: w.pod.radius, guard: w.pod.guard, name: 'pod' });
        // Its ring grows for as long as the pod does, and lands as it bursts.
        const ring = fight.threaten({ kind: 'circle', x: b.x, z: b.z, facing: 0, reach: w.pod.burst, width: 0, lead: w.pod.grow, damage: w.pod.damage, heavy: false, id: 'pod' });
        pods.push({ target, shape: ring, t: 0 });
        emit('sprout', b.x, b.z);
        break;
      }
    }
    if (pods.length > 0) heart.guard = Math.min(heart.full, heart.guard + w.mend * pods.length * dt);
    heart.open = pods.length === 0;
    if (body.doing === 'held') {
      if (body.t >= body.until) go('recover', 0.4);
      return;
    }
    if (body.doing === 'windup') {
      if (body.t >= body.until) { shape = null; go('recover', w.pause); }
      return;
    }
    if (body.doing === 'recover' || body.doing === 'wait') { if (body.t >= body.until) go('wait', 0); else return; }
    body.facing = facingOf(h.x - body.x, h.z - body.z);
    const d = Math.hypot(h.x - body.x, h.z - body.z);
    if (d <= w.sweep.reach + 0.5) threaten({ kind: 'cone', x: body.x, z: body.z, facing: body.facing, reach: w.sweep.reach, width: w.sweep.width, lead: w.sweep.lead, damage: w.sweep.damage, heavy: w.sweep.heavy, id: 'sweep' });
    else threaten({ kind: 'circle', x: h.x, z: h.z, facing: 0, reach: w.slam.radius, width: 0, lead: w.slam.lead, damage: w.slam.damage, heavy: false, id: 'slam' });
  }

  /** Seconds before the arm can be held again. */
  let holdRest = 0;
  function hold(): boolean {
    if (kind !== 'harvester' || !awake() || body.doing === 'held' || holdRest > 0) return false;
    if (shape) { fight.cancel(shape); shape = null; }
    go('held', KEEPERS.harvester.held);
    holdRest = KEEPERS.harvester.held + KEEPERS.harvester.holdRest;
    count('holds');
    emit('held', body.x, body.z);
    return true;
  }

  /** The companion's own skill holds the arm too. */
  function hear(): void {
    for (const e of fight.events) if (e.type === 'skill') hold();
  }

  // ------------------------------------------------ the life of it

  function record(): FightRecord {
    const r = fight.record;
    return {
      ...r, way: 'hero', enemy: kind, result: won ? 'calmed' : r.result, length: clock, hitBy: { ...r.hitBy }, layout: [...r.layout], weapons: [...r.weapons],
      boss: { phases: [clock], quiet: 0, quietByPhase: [0], counts: { ...counts } },
    };
  }

  setUp();

  const keeper: Keeper = {
    kind,
    name: def.name,
    room,
    body,
    get heart() { return heart; },
    get parts() { return kind === 'harvester' ? pods.map((p) => p.target) : parts; },
    get won() { return won; },
    get clock() { return clock; },
    events,
    step(dt) {
      if (won) return;
      holdRest = Math.max(0, holdRest - dt);
      hear();
      body.t += dt;
      if (body.doing === 'asleep') {
        const h = hero();
        // It wakes when the hero comes in from the door, or cuts at something in the room.
        const c = stage.center, hit = fight.events.some((e) => e.type === 'targetHit');
        if (!hit && Math.hypot(h.x - c.x, h.z - c.z) > stage.radius - 2.5) return;
        go('wait', 0.6);
        emit('woke', body.x, body.z);
        fight.wake();
      }
      clock += dt;
      if (heart.broken) { shutDown(); return; }
      if (kind === 'sluice') stepSluice(dt);
      else if (kind === 'lamplighter') stepLamplighter(dt);
      else stepHarvester(dt);
    },
    restart: setUp,
    hold,
    get holdRest() { return holdRest; },
    flooded: (i) => left[i] ?? 0,
    lit: (i) => (kind === 'lamplighter' ? left[i] ?? 0 : 0),
    record,
  };
  return keeper;
}

// ---------------------------------------------------------------------------------------- a player made of rules

/**
 * Plays a keeper the way its one line says, with the sword: the sluice keeper from beside a gate, cutting it as
 * the keeper comes; the lamplighter from behind a lamp it lights; the harvester's pods, with the companion's
 * skill on the arm. It steps out of every shape on the ground as the fight's own player does.
 */
export function createKeeperBot(fight: Fight, keeper: Keeper): Bot {
  const reach = SWORD.quick.reach + 0.3;
  let gateAt = 0;

  function moveTo(x: number, z: number, stop = 0.3): boolean {
    const h = fight.hero, dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz);
    if (d <= stop) { fight.input.moveX = fight.input.moveZ = 0; return true; }
    fight.input.moveX = dx / d;
    fight.input.moveZ = dz / d;
    return false;
  }

  /** Cuts a target, walking up to it first. */
  function cut(t: Target): void {
    fight.input.aimX = t.x;
    fight.input.aimZ = t.z;
    if (Math.hypot(t.x - fight.hero.x, t.z - fight.hero.z) - t.radius > reach - 0.6) moveTo(t.x, t.z, 0.5);
    else fight.press('attack');
  }

  /** Out of whatever is about to land. True when it had to move. */
  function avoid(): boolean {
    const h = fight.hero;
    for (const s of fight.shapes) {
      if (!s.live || s.t >= s.lead) continue;
      const inside = s.kind === 'circle' ? inCircle(h.x, h.z, s.x, s.z, s.reach + 0.5) : s.kind === 'line' ? inLine(h.x, h.z, s.x, s.z, s.facing, s.reach, s.width, 0.5) : inCircle(h.x, h.z, s.x, s.z, s.reach + 0.5) && Math.abs(turnBetween(s.facing, facingOf(h.x - s.x, h.z - s.z))) <= s.width + 0.3;
      if (!inside) continue;
      let ox: number, oz: number;
      if (s.kind === 'line') {
        const side = (h.x - s.x) * dirZ(s.facing) - (h.z - s.z) * dirX(s.facing) >= 0 ? 1 : -1;
        ox = dirZ(s.facing) * side;
        oz = -dirX(s.facing) * side;
      } else {
        const d = Math.hypot(h.x - s.x, h.z - s.z) || 1;
        ox = (h.x - s.x) / d;
        oz = (h.z - s.z) / d;
      }
      fight.input.moveX = ox;
      fight.input.moveZ = oz;
      if (s.lead - s.t < 0.3 && h.stamina >= 25) fight.press('dodge');
      return true;
    }
    return false;
  }

  return {
    step() {
      const input = fight.input;
      input.moveX = input.moveZ = 0;
      input.attackHeld = input.calmHeld = input.placing = false;
      if (keeper.won || fight.hero.act === 'faint') return;
      const b = keeper.body, h = fight.hero;
      if (keeper.heart.open && !keeper.heart.broken) {
        if (!avoid()) cut(keeper.heart);
        return;
      }
      if (keeper.kind === 'harvester') {
        if (b.doing !== 'held' && b.doing !== 'asleep') keeper.hold();
        if (avoid()) return;
        const pods = keeper.parts.filter((p) => p.open && !p.broken);
        let near: Target | null = null;
        for (const p of pods) if (!near || Math.hypot(p.x - h.x, p.z - h.z) < Math.hypot(near.x - h.x, near.z - h.z)) near = p;
        if (near) cut(near);
        else moveTo(keeper.room.stage.center.x, keeper.room.stage.center.z + 4);
        return;
      }
      if (keeper.kind === 'lamplighter') {
        if (avoid()) return;
        // Light the lamp nearest the hero, then stand behind it on the line from the post.
        const lamps = keeper.room.lamps ?? [];
        let best = 0;
        for (let i = 0; i < lamps.length; i++) if (Math.hypot((lamps[i] as Point).x - h.x, (lamps[i] as Point).z - h.z) < Math.hypot((lamps[best] as Point).x - h.x, (lamps[best] as Point).z - h.z)) best = i;
        const lamp = keeper.parts[best] as Target, p = lamps[best] as Point;
        if (keeper.lit(best) <= 1) { cut(lamp); return; }
        const away = Math.hypot(p.x - b.x, p.z - b.z) || 1;
        moveTo(p.x + ((p.x - b.x) / away) * 2.2, p.z + ((p.z - b.z) / away) * 2.2, 0.3);
        return;
      }
      // The sluice keeper: stand past a gate's channel, and open the gate as the keeper comes over it.
      if (avoid()) return;
      const channels = keeper.room.channels ?? [];
      const c = channels[gateAt] as { cells: readonly Point[]; gate: Point };
      const g = keeper.parts[gateAt] as Target;
      const mid = c.cells[Math.floor(c.cells.length / 2)] as Point;
      const nearChannel = c.cells.some((cell) => Math.hypot(cell.x - b.x, cell.z - b.z) < 2.6);
      if (keeper.flooded(gateAt) > 0) {
        // Water is out: keep the channel between the hero and the keeper, so its roll crosses it.
        const away = Math.hypot(mid.x - b.x, mid.z - b.z) || 1;
        moveTo(mid.x + ((mid.x - b.x) / away) * 2.5, mid.z + ((mid.z - b.z) / away) * 2.5);
        if (keeper.flooded(gateAt) < 0.5) gateAt = (gateAt + 1) % channels.length;
        return;
      }
      if (nearChannel || b.doing === 'windup') { cut(g); return; }
      moveTo(g.x + (c.gate.x - mid.x) * 0.2, g.z + (c.gate.z - mid.z) * 0.2 + 0.8, 0.6);
    },
  };
}
