// A player made of rules, for each way to fight. It plays the way the lab's card tells a new player to: step out
// of the shape on the ground, do the one thing the way is about, hold the Mark when the beast is dizzy. The
// tests use it to prove every fight can be won and to measure it, `tools/fight-sim.ts` prints its numbers, and
// the lab's door can switch it on to play a fight in the browser.
//
// It writes `fight.input` and calls `fight.press`, exactly as the keys do, and nothing else.
import { HERO, RIG, type RigKind } from '../content/fight.ts';
import { ARENA } from './arena.sim.ts';
import type { BeastState, Fight, Telegraph } from './fight.sim.ts';
import { dirX, dirZ } from './shapes.sim.ts';

export interface Bot {
  /** Decides what to hold and press for the next step. Call it before every `fight.step`. */
  step(dt: number): void;
}

export interface BotOptions {
  /** `rigs`, the default, sets three rigs in the beast's path. `wall` sets none and baits charges into the rock wall. */
  layout?: 'rigs' | 'wall';
  /** Seconds a shape lies on the ground before the bot sees it. 0.3 by default: an attentive person. */
  reaction?: number;
  /**
   * A player who is still learning: sees a shape late (0.7 seconds), attacks in bursts with pauses between, and
   * dodges only some of the time. The plain bot is never hit, so its times say little about a person's.
   */
  clumsy?: boolean;
  /** A repeatable random number from 0 to 1, for the clumsy player's pauses and dodges. */
  random?: () => number;
}

/** The clumsy player: when it sees a shape, how long it attacks before a pause and how long the pause is, and how often it dodges. */
export const CLUMSY = { reaction: 0.7, burst: [1.2, 2.4], rest: [0.6, 1.6], dodges: 0.4 } as const;

/** How far the hero is inside a shape that is about to land, in blocks to its nearest edge. 0 when outside. */
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

export function createBot(fight: Fight, stage: { den: { x: number; z: number }; center: { x: number; z: number } }, options: BotOptions = {}): Bot {
  const layout = options.layout ?? 'rigs', clumsy = options.clumsy ?? false;
  const reaction = options.reaction ?? (clumsy ? CLUMSY.reaction : 0.3);
  const random = options.random ?? (() => 0.5);
  /** The clumsy player's bursts: seconds left of attacking, then of the pause after. And the shape it chose to dodge or not. */
  let burst = 0, rest = 0, judged: Telegraph | null = null, willDodge = true;
  const between = (range: readonly [number, number]): number => range[0] + random() * (range[1] - range[0]);
  const out = { x: 0, z: 0 };
  /** The rigs still to set down, each as blocks south of the den. */
  const plan: [RigKind, number][] = layout === 'rigs' ? [['snare', 3], ['plate', 5], ['lamp', 7]] : [];
  let woke = false;
  /** The tree or the stretch of wall the bot stands in front of, in the `wall` layout. */
  let anchor: { x: number; z: number } | null = null;

  function moveTo(x: number, z: number, stop = 0.2): boolean {
    const { hero, input } = fight, dx = x - hero.x, dz = z - hero.z, d = Math.hypot(dx, dz);
    if (d <= stop) return true;
    input.moveX = dx / d;
    input.moveZ = dz / d;
    return false;
  }

  /** Steps out of whatever is about to land on the hero. True when it had to. */
  function avoid(b: BeastState): boolean {
    const { hero, input } = fight;
    let worst = 0, left = Infinity, ox = 0, oz = 0, worstShape: Telegraph | null = null;
    for (const s of fight.shapes) {
      if (!s.live) continue;
      const running = b.doing === 'charge' && s.owner === b.id;
      if ((s.t >= s.lead && !running) || s.t < reaction) continue;
      const deep = inside(s, hero.x, hero.z, out);
      if (deep <= worst) continue;
      worst = deep;
      left = running ? 0 : s.lead - s.t;
      ox = out.x;
      oz = out.z;
      worstShape = s;
    }
    if (worst <= 0) return false;
    input.moveX = ox;
    input.moveZ = oz;
    // A clumsy player makes up its mind once for each shape whether it will dodge it.
    if (clumsy && worstShape !== judged) { judged = worstShape; willDodge = random() < CLUMSY.dodges; }
    // Walking will not get there in time: dodge.
    if (willDodge && left < worst / HERO.walk + 0.12 && left < 0.3 && hero.stamina >= HERO.dodge.cost) fight.press('dodge');
    return true;
  }

  /** False in a clumsy player's pause between bursts. */
  function attacking(dt: number): boolean {
    if (!clumsy) return true;
    if (burst > 0) { burst -= dt; if (burst <= 0) rest = between(CLUMSY.rest); return true; }
    if (rest > 0) { rest -= dt; return false; }
    burst = between(CLUMSY.burst);
    return true;
  }

  return {
    step(dt) {
      const { hero, input, pet } = fight, b = fight.beasts[0];
      input.moveX = input.moveZ = 0;
      input.calmHeld = input.attackHeld = input.placing = false;
      if (!b || fight.phase === 'won' || hero.act === 'faint') return;
      input.aimX = b.x;
      input.aimZ = b.z;
      const dx = b.x - hero.x, dz = b.z - hero.z, d = Math.hypot(dx, dz), edge = d - b.def.radius;

      // The pet's own danger comes first in the way where it can be hurt: one whistle takes it out of the attack.
      if (fight.way === 'pet' && pet.mode === 'engage') {
        for (const s of fight.shapes) {
          if (s.live && s.t >= reaction && s.t < s.lead && s.lead - s.t < 0.55 && inside(s, pet.x, pet.z, out) > 0) { fight.press('whistle'); break; }
        }
      }
      if (avoid(b)) return;

      if (b.doing === 'dizzy') {
        if (edge > HERO.calm.reach - 0.6) moveTo(b.x, b.z);
        else input.calmHeld = true;
        return;
      }

      if (fight.way === 'hero') {
        // Close in and cut. The shape check above walks the hero out again when the beast winds up.
        if (edge > HERO.cut.reach - 0.5) moveTo(b.x, b.z);
        if (edge <= HERO.cut.reach && attacking(dt)) fight.press('attack');
        if (fight.skill(0)?.left === 0 && b.doing !== 'asleep') fight.press('skill1');
        return;
      }

      if (fight.way === 'pet') {
        // Stand back, keep the light flying, call the skills as they come back.
        if (edge > 8) moveTo(b.x, b.z);
        else if (edge < 5) { input.moveX = -dx / d; input.moveZ = -dz / d; }
        if (attacking(dt)) fight.press('attack');
        if (b.doing !== 'asleep' && pet.mode === 'engage') {
          if (fight.skill(0)?.left === 0) fight.press('skill1');
          else if (fight.skill(1)?.left === 0 && b.doing === 'recover') fight.press('skill2');
        }
        return;
      }

      // The world fights.
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
          let far = -1;
          for (const cell of [...ARENA.trees, { x: -2, z: -10 }]) {
            const ax = stage.center.x + cell.x, az = stage.center.z + cell.z, away = Math.hypot(b.x - ax, b.z - az);
            if (away > far) { far = away; anchor = { x: ax, z: az }; }
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
