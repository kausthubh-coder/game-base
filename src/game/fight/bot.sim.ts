// A player made of rules. It plays the way the lab's card tells a new player to: step out of the shape on the
// ground, fight with the weapon in the hand the way that weapon asks, call the companion's skill when it helps,
// and hold the Mark when a beast is dizzy. The tests use it to prove every fight can be won and to measure how
// hard it is, `tools/fight-sim.ts` prints its numbers, and the lab's door can switch it on in the browser.
//
// It comes in three levels: `perfect` sees every shape in time and always dodges when walking is too slow, so
// every hit it takes was avoidable; `middle` reads most shapes in time; `clumsy` is still learning. The weapon is
// the one in the hero's hand, the companion the fight's.
//
// It writes `fight.input` and calls `fight.press`, exactly as the keys do, and nothing else.
import { HERO, RIG, type RigKind } from '../content/fight.ts';
import { ARENA, type Stage } from './arena.sim.ts';
import type { BeastState, Fight, Telegraph } from './fight.sim.ts';
import { dirX, dirZ, turnBetween } from './shapes.sim.ts';

export interface Bot {
  /** Decides what to hold and press for the next step. Call it before every `fight.step`. */
  step(dt: number): void;
}

export type BotLevel = 'perfect' | 'middle' | 'clumsy';

export interface BotOptions {
  /** The traps: `rigs`, the default, sets three rigs in the beast's path. `wall` sets none and baits charges into the rock wall. */
  layout?: 'rigs' | 'wall';
  /** How well it plays. `perfect` by default. */
  level?: BotLevel;
  /** Seconds a shape lies on the ground before it is seen, in place of the level's. */
  reaction?: number;
  /** A repeatable random number from 0 to 1, for the middle and clumsy players' slips. */
  random?: () => number;
}

/**
 * The three players. Each shape is seen `reaction` seconds after it shows, or `late` seconds after for the share
 * `lateShare` of shapes. For the share `wrong` of shapes its first `wrongFor` seconds of stepping out go the
 * wrong way, along the shape instead of out of it. Of the shapes walking will not get it out of in time, it
 * dodges `dodges` of them. It attacks in bursts of `burst` seconds with pauses of `rest` between, or all the time
 * when `burst` is empty.
 */
export const PLAYERS: Record<BotLevel, { reaction: number; late: number; lateShare: number; wrong: number; wrongFor: number; dodges: number; burst: readonly number[]; rest: readonly number[] }> = {
  perfect: { reaction: 0.3, late: 0.3, lateShare: 0, wrong: 0, wrongFor: 0, dodges: 1, burst: [], rest: [] },
  middle: { reaction: 0.4, late: 0.75, lateShare: 0.25, wrong: 0.15, wrongFor: 0.3, dodges: 0.6, burst: [2, 4], rest: [0.3, 0.9] },
  clumsy: { reaction: 0.7, late: 0.7, lateShare: 0, wrong: 0.15, wrongFor: 0.3, dodges: 0.4, burst: [1.2, 2.4], rest: [0.6, 1.6] },
};

/** The turns off the straight way out of a shape it tries, one after another, for clear ground. */
const ESCAPES = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.2, -2.2, Math.PI];

/** The bow is fought from this far off a beast's edge, the staff from this far. */
const KEEP = { bow: [5.5, 9], staff: [4, 7] } as const;

/** What a player made of a shape when it saw it: when it notices it, whether it will dodge it, and whether it steps the wrong way first. */
interface Judged { at: number; dodge: boolean; wrong: boolean; t: number }

/** How far a point is inside a shape, in blocks to its nearest edge, with the way out. 0 when outside. */
function inside(s: Telegraph, x: number, z: number, out: { x: number; z: number }): number {
  const dx = x - s.x, dz = z - s.z, grow = HERO.body + 0.35;
  if (s.kind === 'circle') {
    const d = Math.hypot(dx, dz);
    out.x = d > 0.01 ? dx / d : 1;
    out.z = d > 0.01 ? dz / d : 0;
    return Math.max(0, s.reach + grow - d);
  }
  const fx = dirX(s.facing), fz = dirZ(s.facing), along = dx * fx + dz * fz, across = dx * fz - dz * fx;
  if (s.kind === 'line') {
    if (along < -grow || along > s.reach + grow || Math.abs(across) > s.width / 2 + grow) return 0;
    // Out to the side it is already on.
    const side = across >= 0 ? 1 : -1;
    out.x = fz * side;
    out.z = -fx * side;
    return s.width / 2 + grow - Math.abs(across);
  }
  const d = Math.hypot(dx, dz);
  if (d > s.reach + grow) return 0;
  const turn = Math.abs(Math.atan2(across, along));
  if (d > grow && turn > s.width + 0.2) return 0;
  out.x = d > 0.01 ? dx / d : fx;
  out.z = d > 0.01 ? dz / d : fz;
  return s.reach + grow - d;
}

export function createBot(fight: Fight, stage: Pick<Stage, 'den' | 'center' | 'radius' | 'inside' | 'solid' | 'swim'>, options: BotOptions = {}): Bot {
  const layout = options.layout ?? 'rigs', level = options.level ?? 'perfect', player = PLAYERS[level];
  const random = options.random ?? (() => 0.5);
  /** Seconds left of attacking, then of the pause after. */
  let burst = 0, rest = 0;
  /** What it decided about each shape: when it sees it, and whether it will dodge it. Kept by the shape's slot, and decided again when the slot holds a new shape. */
  const seen = new Map<Telegraph, Judged>();
  const between = (range: readonly number[]): number => (range[0] as number) + random() * ((range[1] as number) - (range[0] as number));
  const out = { x: 0, z: 0 }, probe = { x: 0, z: 0 };
  /** The rigs still to set down, each as blocks south of the den. */
  const plan: [RigKind, number][] = layout === 'rigs' ? [['snare', 3], ['plate', 5], ['lamp', 7]] : [];
  let woke = false;
  /** The tree or the stretch of wall the bot stands in front of, in the `wall` layout. */
  let anchor: { x: number; z: number } | null = null;
  /** Which way it circles a beast it keeps a distance from: 1 or -1. */
  let around = 1;

  function moveTo(x: number, z: number, stop = 0.2): boolean {
    const { hero, input } = fight, dx = x - hero.x, dz = z - hero.z, d = Math.hypot(dx, dz);
    if (d <= stop) return true;
    input.moveX = dx / d;
    input.moveZ = dz / d;
    return false;
  }

  /** What it makes of a shape, decided once when it first notices it. */
  function judge(s: Telegraph): Judged {
    let j = seen.get(s);
    if (!j || s.t < j.t) {
      j = { at: random() < player.lateShare ? player.late : options.reaction ?? player.reaction, dodge: random() < player.dodges, wrong: random() < player.wrong, t: s.t };
      seen.set(s, j);
    }
    j.t = s.t;
    return j;
  }

  /** True when this point is in no shape it has seen that is still to land. */
  function clear(x: number, z: number): boolean {
    for (const s of fight.shapes) {
      if (!s.live || s.t >= s.lead || !seen.has(s) || s.t < (seen.get(s) as Judged).at) continue;
      if (inside(s, x, z, probe) > 0) return false;
    }
    return true;
  }

  /** Steps out of whatever is about to land on the hero, into ground no other shape covers. True when it had to. */
  function avoid(): boolean {
    const { hero, input } = fight;
    let worst = 0, left = Infinity, ox = 0, oz = 0, dodge = true, lost = false;
    for (const s of fight.shapes) {
      if (!s.live) { seen.delete(s); continue; }
      const runner = fight.beasts.find((b) => b.id === s.owner && b.doing === 'charge');
      if (s.t >= s.lead && !runner) continue;
      const j = judge(s);
      if (s.t < j.at) continue;
      const deep = inside(s, hero.x, hero.z, out);
      if (deep <= worst) continue;
      worst = deep;
      left = runner ? 0 : s.lead - s.t;
      ox = out.x;
      oz = out.z;
      dodge = j.dodge;
      lost = j.wrong && s.t < j.at + player.wrongFor;
    }
    if (worst <= 0) return false;
    // The way out of the deepest one, or the nearest turn of it that leads to clear ground.
    const reachOut = worst + 0.3;
    // A way out that leaves the arena is no way out: step out toward the middle instead.
    let base = Math.atan2(ox, -oz);
    if (fight.way === 'hero' && !stage.inside(hero.x + ox * reachOut, hero.z + oz * reachOut)) base = Math.atan2(stage.center.x - hero.x, -(stage.center.z - hero.z));
    let bx = ox, bz = oz;
    // The traps' player steps straight out, as it did when the traps were measured.
    for (const turn of fight.way === 'hero' ? ESCAPES : []) {
      const fx = Math.sin(base + turn), fz = -Math.cos(base + turn), px = hero.x + fx * reachOut, pz = hero.z + fz * reachOut;
      // Out of the shape onto dry ground: in the pond the hero only swims.
      if (!stage.inside(px, pz) || stage.solid(px, pz) || stage.swim?.(px, pz) || !clear(px, pz)) continue;
      bx = fx;
      bz = fz;
      break;
    }
    // A player who has not yet seen the way out walks along the shape.
    input.moveX = lost ? -bz : bx;
    input.moveZ = lost ? bx : bz;
    if (lost) return true;
    // Walking will not get there in time: dodge.
    if (dodge && left < worst / HERO.walk + 0.12 && left < (fight.way === 'hero' ? 0.26 : 0.3) && hero.stamina >= HERO.dodge.cost) fight.press('dodge');
    return true;
  }

  /** True when a shape still to land lies near the hero: the perfect player starts no attack then. */
  function nearDanger(): boolean {
    const { hero } = fight;
    for (const s of fight.shapes) if (s.live && s.t < s.lead && (inside(s, hero.x, hero.z, probe) > 0 || Math.hypot(s.x - hero.x, s.z - hero.z) < s.reach + 2.5)) return true;
    return false;
  }

  /** False in a pause between bursts, and for the perfect player while something is about to land near it. */
  function attacking(dt: number): boolean {
    if (level === 'perfect') return !nearDanger();
    if (player.burst.length === 0) return true;
    if (burst > 0) { burst -= dt; if (burst <= 0) rest = between(player.rest); return true; }
    if (rest > 0) { rest -= dt; return false; }
    burst = between(player.burst);
    return true;
  }

  /** The beast to fight: the nearest one still standing. A dizzy one comes first, to be calmed. */
  function pick(): BeastState | null {
    const { hero } = fight;
    let best: BeastState | null = null, near = Infinity;
    for (const b of fight.beasts) {
      if (b.doing === 'calmed') continue;
      const d = Math.hypot(b.x - hero.x, b.z - hero.z) - (b.doing === 'dizzy' ? 30 : 0);
      if (d < near) { near = d; best = b; }
    }
    return best;
  }

  /** A beast standing open for at least this long. */
  const open = (b: BeastState, long: number): boolean => (b.doing === 'recover' || b.doing === 'stun' || b.doing === 'held') && b.until - b.t >= long;

  /** True when nothing solid stands on the straight line between two points: a shot from one reaches the other. */
  function sees(x: number, z: number, tx: number, tz: number): boolean {
    const d = Math.hypot(tx - x, tz - z), steps = Math.ceil(d / 0.25);
    for (let i = 1; i < steps; i++) if (stage.solid(x + ((tx - x) * i) / steps, z + ((tz - z) * i) / steps)) return false;
    return true;
  }

  /**
   * Keeps between `near` and `far` blocks off the beast's edge, circling it, on open ground with a clear line to it.
   * A beast behind the wall or a tree is walked round, not shot at.
   */
  function keepAway(b: BeastState, near: number, far: number): void {
    const { hero, input } = fight;
    const dx = hero.x - b.x, dz = hero.z - b.z, d = Math.hypot(dx, dz) || 1, edge = d - b.def.radius;
    // Off the arena the beasts stop following, and in the pond the hero only swims: back toward the middle.
    if (Math.hypot(hero.x - stage.center.x, hero.z - stage.center.z) > stage.radius - 1.5 || stage.swim?.(hero.x, hero.z)) { moveTo(stage.center.x, stage.center.z); return; }
    const clearLine = sees(hero.x, hero.z, b.x, b.z);
    if (edge >= near && edge <= far && clearLine) { input.moveX = input.moveZ = 0; return; }
    const want = b.def.radius + (near + far) / 2;
    for (let tries = 0; tries < 12; tries++) {
      const turn = Math.atan2(dx, -dz) + around * 0.5 * tries;
      const px = b.x + Math.sin(turn) * want, pz = b.z - Math.cos(turn) * want;
      if (stage.inside(px, pz) && Math.hypot(px - stage.center.x, pz - stage.center.z) < stage.radius - 2 && !stage.solid(px, pz) && !stage.swim?.(px, pz) && sees(px, pz, b.x, b.z)) { moveTo(px, pz, 0.3); return; }
      if (tries === 5) around = -around;
    }
    moveTo(stage.center.x, stage.center.z);
  }

  /** The companion's skill, when it helps. */
  function skill(b: BeastState): void {
    const { hero, companion } = fight;
    if (fight.skill().left > 0 || b.doing === 'asleep') return;
    const role = companion.def.role;
    if (role === 'striker' && b.doing !== 'dizzy') fight.press('skill');
    else if (role === 'healer' && hero.health < 55) fight.press('skill');
    else if (role === 'booster' && (open(b, 1) || Math.hypot(b.x - hero.x, b.z - hero.z) - b.def.radius < 3)) fight.press('skill');
    else if (role === 'guard') {
      // Brace into an attack it can see coming at the hero.
      for (const s of fight.shapes) if (s.live && s.t < s.lead && seen.has(s) && s.t >= (seen.get(s) as Judged).at && inside(s, hero.x, hero.z, probe) > 0) { fight.press('skill'); break; }
    }
  }

  /** Holds the button for the held move until it is ready, then lets go. True while it is holding. */
  function holdFor(): boolean {
    const { hero, input } = fight;
    if (hero.charged) return false;
    input.attackHeld = true;
    return true;
  }

  return {
    step(dt) {
      const { hero, input } = fight;
      const wasHolding = input.attackHeld;
      input.moveX = input.moveZ = 0;
      input.calmHeld = input.attackHeld = input.placing = false;
      const b = fight.way === 'world' ? fight.beasts[0] : pick();
      if (!b || fight.phase === 'won' || hero.act === 'faint') return;
      input.aimX = b.x;
      input.aimZ = b.z;
      const dx = b.x - hero.x, dz = b.z - hero.z, d = Math.hypot(dx, dz), edge = d - b.def.radius;

      if (fight.way === 'hero') skill(b);
      if (avoid()) return;

      // Act 1: the companion is held in the rootsnare's vines. Cut them first: the beast's heart is shut.
      const vines = fight.way === 'hero' ? fight.targets.find((t) => t.name === 'vines' && t.open && !t.broken) : undefined;
      if (vines) {
        input.aimX = vines.x;
        input.aimZ = vines.z;
        const reach = hero.weapon === 'sword' ? 1.6 : 5;
        if (Math.hypot(vines.x - hero.x, vines.z - hero.z) - vines.radius > reach) moveTo(vines.x, vines.z);
        else if (attacking(dt)) fight.press('attack');
        return;
      }

      if (b.doing === 'dizzy') {
        if (edge > HERO.calm.reach - 0.6) moveTo(b.x, b.z);
        else input.calmHeld = true;
        return;
      }

      if (fight.way === 'hero') {
        const kind = hero.weapon;
        // A held move it started is held until it is ready, then let go.
        if (wasHolding && !hero.charged && hero.charge > 0) { input.attackHeld = true; if (kind !== 'sword') keepAway(b, KEEP[kind][0], KEEP[kind][1]); return; }
        if (kind === 'sword') {
          // Close in and cut. The shape check above walks the hero out again when the beast winds up. A player who
          // has learned the beast comes in at its side, out of what it swings in front of it.
          const side = turnBetween(b.facing, Math.atan2(hero.x - b.x, -(hero.z - b.z))) >= 0 ? 1 : -1;
          const sx = b.x + dirX(b.facing + side * 1.75) * (b.def.radius + 1.3), sz = b.z + dirZ(b.facing + side * 1.75) * (b.def.radius + 1.3);
          // Act 1: a machine's plates turn a blade on its front. A player who has learned it strikes its back.
          const bx = b.x - dirX(b.facing) * (b.def.radius + 1.1), bz = b.z - dirZ(b.facing) * (b.def.radius + 1.1);
          if (level !== 'clumsy' && b.def.plates !== undefined) moveTo(bx, bz, 0.4);
          else if (level !== 'clumsy' && b.def.radius > 1) moveTo(sx, sz, 0.4);
          else if (edge > 2.2 - 0.5) moveTo(b.x, b.z);
          if (edge <= 2.2 && attacking(dt)) {
            // A spin when it stands open long enough to charge one.
            if (level !== 'clumsy' && open(b, 1.1) && hero.act === 'none' && holdFor()) return;
            fight.press('attack');
          }
          return;
        }
        // The bow and the staff keep their distance and keep shooting.
        const [near, far] = KEEP[kind];
        keepAway(b, near, far);
        if (!attacking(dt)) return;
        if (level !== 'clumsy' && open(b, 1.2) && hero.act === 'none' && edge <= far + 1 && holdFor()) return;
        // Only with a clear line: a shot into the wall is wasted.
        if (edge <= far + 3 && sees(hero.x, hero.z, b.x, b.z)) fight.press('attack');
        return;
      }

      // The traps.
      const den = stage.den;
      if (fight.phase === 'setup') {
        if (plan.length > 0) {
          input.placing = true;
          // Stand south of the den, out of its hearing, and lay the rigs in a row toward it.
          if (!moveTo(den.x, den.z + 6.5)) return;
          const [kind, south] = plan[0] as [RigKind, number];
          fight.placeRig(kind, den.x, den.z + south);
          plan.shift();
          return;
        }
        if (layout === 'rigs' && !moveTo(den.x, den.z + 9)) return;
        if (!woke) { woke = true; fight.wake(); }
        return;
      }
      if (layout === 'wall') {
        // Stand in front of a tree or the wall, on the beast's side of it, as far from the beast as the arena
        // allows. Its charge comes down the line, the shape check steps the hero aside, and it runs on into the thing.
        if (!anchor || Math.hypot(b.x - anchor.x, b.z - anchor.z) < 4) {
          let farthest = -1;
          for (const cell of [...ARENA.trees, { x: -2, z: -10 }]) {
            const ax = stage.center.x + cell.x, az = stage.center.z + cell.z, away = Math.hypot(b.x - ax, b.z - az);
            if (away > farthest) { farthest = away; anchor = { x: ax, z: az }; }
          }
        }
        if (anchor) {
          const ax = b.x - anchor.x, az = b.z - anchor.z, away = Math.hypot(ax, az) || 1;
          moveTo(anchor.x + (ax / away) * 1.7, anchor.z + (az / away) * 1.7, 0.3);
        }
        return;
      }
      // Stay south of the row so the beast keeps walking down it. Step back if it comes too near.
      if (edge < 3 && b.doing === 'stalk') { input.moveX = -dx / d; input.moveZ = -dz / d; }
      else moveTo(den.x, den.z + 9, 0.5);
      // The plate, by hand, when it stands beside it.
      for (const r of fight.rigs) if (r.armed && r.kind === 'plate' && Math.hypot(b.x - r.x, b.z - r.z) < b.def.radius + RIG.hand - 0.3) fight.press('use');
    },
  };
}
