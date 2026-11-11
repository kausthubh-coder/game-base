// What a fighter of the fight lab shows for what it is doing: which sheet, which frame, how it is squashed and
// what it is tinted. One place decides it for the hero, the pet and the beasts, so a real sheet replaces a
// stand-in here and nowhere else. Where a fighter stands, its shadow and the marks under it are `draw.ts`.
//
// The sheets and their frames, as `docs/fight-lab.md` names them:
//   hero-cut     cut: wind-up, strike, follow-through, recovery. Timed to the rules, so the strike is on screen
//                from the moment the cut lands, through the freeze of the hit. The second cut is the same
//                swing the other way: mirrored seen from the front or the back, starting from the recovery.
//   hero-moves   poses: dodge, hurt, reach, calm. A faint is the hurt pose tipped over onto the ground.
//   hero-call    poses: throw wind-up, throw release, whistle, point. A throw that is also an order points.
//   <pet>-fight  poses: ready, strike, hurt, fainted. A brace is the ready pose, planted low.
//   <beast>-fight poses: tell, attack, dizzy, calm. Asleep is the calm pose too, its eyes shut.
// Code adds what a pose cannot: the hop of a pet's strike, a small breath on a tell, the warm glow of the last
// quarter second, a tumble when a plate throws it, the settle of a bow.
//
// Stand-in art. A fighter whose sheet is not in the manifest is drawn from `STAND_INS` below: every beast the
// mossling's sheet at another size and tint, the pebblepup the leaftail's. Teal for the player's magic, gold
// for an enemy's attack and grey for a drained beast are the plan's suggestion
// (design/21-look-sound-feel.md), not a decided look.
import * as THREE from 'three';
import { HERO, RIG } from '../content/fight.ts';
import type { BeastState, HeroState, PetState } from '../fight/fight.sim.ts';
import { CALM, SHUT } from './calm.ts';
import type { Figure, Figures } from './figures.ts';

/** The stand-in lights: the player's magic, an enemy's attack, and the plain marks. */
export const TEAL = new THREE.Color(0.25, 0.95, 0.82), GOLD = new THREE.Color(1, 0.72, 0.2), HOT = new THREE.Color(1, 0.42, 0.16);
export const PALE = new THREE.Color(1, 0.97, 0.86), SHADE = new THREE.Color(0.05, 0.07, 0.05), WHITE = new THREE.Color(1, 1, 1), RED = new THREE.Color(1, 0.4, 0.3);

/** How a fighter is drawn: the sheet it walks and stands in, the sheet of its fight poses when there is one, its size and its tint. */
export interface Look {
  sheet: string;
  /** A sheet whose one animation `poses` holds its four fight poses. Empty for a stand-in. */
  poses: string;
  scale: number;
  tint: readonly [number, number, number];
  /** Blocks a pet's strike lifts it: the leaftail leaps, the pebblepup butts with its head. */
  hop: number;
  /** True when this is not the fighter's own art. */
  standIn: boolean;
}

/** What each beast is drawn as until its own sheet is in the manifest. */
const STAND_INS: Record<string, Look> = {
  thistlehog: { sheet: 'critter', poses: '', scale: 1.6, tint: [1, 1, 1], hop: 0, standIn: true },
  gearling: { sheet: 'critter', poses: '', scale: 1.8, tint: [1.35, 1.02, 0.5], hop: 0, standIn: true },
  boar: { sheet: 'critter', poses: '', scale: 4.6, tint: [0.85, 0.66, 0.58], hop: 0, standIn: true },
  pebblepup: { sheet: 'leaftail', poses: '', scale: 1.15, tint: [0.78, 0.76, 0.8], hop: 0.15, standIn: true },
};
const HOPS: Record<string, number> = { leaftail: 0.35, pebblepup: 0.12 };

/** The frames of a pose sheet. */
const BEAST = { tell: 0, attack: 1, dizzy: 2, calm: 3 } as const;
const PET = { ready: 0, strike: 1, hurt: 2, fainted: 3 } as const;
const MOVES = { dodge: 0, hurt: 1, reach: 2, calm: 3 } as const;
const CALL = { windUp: 0, release: 1, whistle: 2, point: 3 } as const;
const CUT = { windUp: 0, strike: 1, follow: 2, recovery: 3 } as const;

/** Half a step of the body: a cut's strike shows from the step the rules land it. */
const HALF_STEP = 1 / 120;
/** The frame of a cut at its second `t`: the strike from the moment it lands, for a tenth of a second. */
function cutFrame(t: number, second: boolean): number {
  if (t < HERO.cut.startup - HALF_STEP) return second ? CUT.recovery : CUT.windUp;
  if (t < HERO.cut.startup + 0.1) return CUT.strike;
  if (t < HERO.cut.startup + 0.2) return CUT.follow;
  return CUT.recovery;
}

/**
 * How far a beast's calming has come, kept by the caller: `calmT` counts seconds from the end of the release's
 * freeze (below 0 during it). `calmOn` is false until the moment of calming starts it.
 */
export interface CalmClock { calmT: number; calmOn: boolean }

const ease = (k: number): number => 1 - (1 - k) * (1 - k);

export interface Looks {
  /** The look of a beast or a pet kind: its own sheet when the manifest has it, its stand-in otherwise. */
  of(kind: string): Look;
  /**
   * The hero's pose for its act. `moving` is true while the body walks, `pointing` while a throw is also an
   * order, and `holding` just after a calm, so the hero keeps holding the Mark out through the release.
   */
  hero(f: Figure, h: HeroState, moving: boolean, clock: number, pointing: boolean, holding: boolean): void;
  /** An afterimage of a dodge. */
  ghost(f: Figure): void;
  /** The pet's pose. Returns how far it is lifted off the ground, for a strike's hop. */
  pet(f: Figure, p: PetState, look: Look): number;
  /** A beast's pose, tint and drained grey. It adds to the squash and shake already set. Returns its lift. */
  beast(f: Figure, b: BeastState, look: Look, calm: CalmClock, dt: number, clock: number, still: boolean): number;
  /** Which art is a stand-in right now. */
  standIns(): string[];
}

export function createLooks(figures: Figures): Looks {
  const heroCut = figures.has('hero-cut'), heroMoves = figures.has('hero-moves'), heroCall = figures.has('hero-call');
  const of = (kind: string): Look => (figures.has(kind)
    ? { sheet: kind, poses: figures.has(`${kind}-fight`) ? `${kind}-fight` : '', scale: 1, tint: [1, 1, 1], hop: HOPS[kind] ?? 0.2, standIn: false }
    : STAND_INS[kind] ?? (STAND_INS.thistlehog as Look));

  return {
    of,

    hero(f, h, moving, clock, pointing, holding) {
      f.squashX = f.squashY = 1;
      f.roll = f.warm = f.glow = 0;
      f.mirror = false;
      f.tint.setRGB(1, 1, 1);
      if (h.act === 'cut') {
        if (heroCut) { f.pose('hero-cut', 'cut', cutFrame(h.t, h.cuts === 2)); f.mirror = h.cuts === 2; }
        else f.once('hero-swing', 'tool', h.t, HERO.cut.total * 0.8);
      } else if (h.act === 'spin') {
        // Note 05: the cut's strike played around the views. The hero turns a whole circle while it lands.
        f.face(h.facing + Math.min(1, h.t / (HERO.spin.total * 0.6)) * Math.PI * 2);
        if (heroCut) f.pose('hero-cut', 'cut', CUT.strike);
        else f.pose('hero-swing', 'tool', 1);
      } else if (h.act === 'dodge') {
        if (heroMoves) f.pose('hero-moves', 'poses', MOVES.dodge);
        else { f.play('hero', 'walk'); f.squashX = 1.18; f.squashY = 0.78; }
        f.tint.setRGB(0.8, 0.95, 1.08);
      } else if (h.act === 'hurt') {
        if (heroMoves) f.pose('hero-moves', 'poses', MOVES.hurt);
        else { f.pose('hero', 'idle', 0); f.squashX = 0.92; f.squashY = 1.06; }
        f.tint.setRGB(1.08, 0.94, 0.92);
      } else if (h.act === 'calm' || (holding && h.act === 'none' && !moving)) {
        // The reach, then the Mark held out. The light is in the hand and on the ground, not on the hero.
        if (heroMoves) f.pose('hero-moves', 'poses', h.act === 'calm' && h.t < 0.18 ? MOVES.reach : MOVES.calm);
        else f.pose('hero', 'idle', 0);
      } else if (h.act === 'throw') {
        if (heroCall) f.pose('hero-call', 'poses', h.t < 0.07 ? CALL.windUp : pointing ? CALL.point : CALL.release);
        else f.once('hero-swing', 'tool', h.t + 0.05, HERO.bolt.pose + 0.05);
      } else if (h.act === 'whistle') {
        if (heroCall) f.pose('hero-call', 'poses', CALL.whistle);
        else f.pose('hero', 'idle', 1);
      } else if (h.act === 'faint') {
        // Down on the ground, never worse: the hurt pose tipped over onto its back, and pale.
        if (heroMoves) f.pose('hero-moves', 'poses', MOVES.hurt);
        else f.pose('hero', 'idle', 0);
        f.roll = ease(Math.min(1, h.t / 0.22)) * 1.45;
        f.tint.setRGB(0.82, 0.84, 0.92);
      } else if (h.charge > 0.25 && heroCut) {
        // Charging the spin: the blade drawn back. It glows when the spin is ready.
        f.pose('hero-cut', 'cut', CUT.windUp);
        if (h.charge >= HERO.spin.hold) f.tint.setRGB(1.25, 1.2, 0.95);
      } else {
        f.play('hero', moving ? 'walk' : 'idle');
        if (h.charge > 0.25) {
          const k = Math.min(1, h.charge / HERO.spin.hold);
          f.squashY = 1 - 0.08 * k;
          f.squashX = 1 + 0.06 * k;
          if (k >= 1) f.tint.setRGB(1.25, 1.2, 0.95);
        }
      }
      // Nothing can hit the hero for a moment after a hit: a cool shimmer, never a hero who is not there.
      if (h.safe > 0 && h.act !== 'dodge' && h.act !== 'faint' && Math.floor(clock * 14) % 2 === 0) f.tint.multiply(SAFE);
    },

    ghost(f) {
      if (heroMoves) f.pose('hero-moves', 'poses', MOVES.dodge);
      else f.play('hero', 'walk');
      f.tint.setRGB(0.6, 0.95, 1.1);
    },

    pet(f, p, look) {
      f.scale = look.scale;
      f.tint.setRGB(look.tint[0], look.tint[1], look.tint[2]);
      f.squashX = f.squashY = 1;
      f.drained = 0;
      f.roll = f.warm = f.glow = 0;
      let lift = 0;
      const poses = figures.has(`${p.def.kind}-fight`) ? `${p.def.kind}-fight` : '';
      if (p.mode === 'down') {
        if (poses) f.pose(poses, 'poses', PET.fainted);
        else { f.pose(look.sheet, 'idle', 0); f.squashY = 0.45; f.squashX = 1.25; f.drained = 0.5; }
      } else if (p.strikeT > 0) {
        // A strike: a short hop at the beast.
        if (poses) f.pose(poses, 'poses', PET.strike);
        else { f.play(look.sheet, 'walk'); f.squashX = 1.3; f.squashY = 0.85; }
        lift = Math.sin((p.strikeT / 0.3) * Math.PI) * look.hop;
      } else if (p.hurtT > 0) {
        if (poses) f.pose(poses, 'poses', PET.hurt);
        else f.pose(look.sheet, 'idle', 0);
      } else if (p.mode === 'brace' && !p.moving) {
        // Planted low, its back to what comes.
        if (poses) f.pose(poses, 'poses', PET.ready);
        else f.pose(look.sheet, 'idle', 0);
        f.squashX = 1.12;
        f.squashY = 0.88;
      } else {
        f.play(look.sheet, p.moving ? 'walk' : 'idle');
      }
      return lift;
    },

    beast(f, b, look, calm, dt, clock, still) {
      const a = b.attack, posed = look.poses !== '';
      let lift = 0;
      f.scale = look.scale;
      f.tint.setRGB(look.tint[0], look.tint[1], look.tint[2]);
      f.roll = f.warm = f.glow = 0;
      f.sweep = 0;
      // Drained grey while the Blight has it. A machine is not Blighted: it only goes dark when it is shut down.
      f.drained = b.def.machine ? 0 : 1;

      if (b.doing === 'calmed') {
        // Calmed with no moment to play (a door set it): it is over.
        if (!calm.calmOn) { calm.calmOn = true; calm.calmT = 9; }
        calm.calmT += dt;
        const t = calm.calmT;
        // The release: a bright frame in the Mark's light, through the freeze.
        f.glow = t < 0 ? 0.8 : Math.max(0, 0.8 - t * 4);
        if (b.def.machine) {
          // Shut down: tipped over still, its eye goes dark, then it settles upright and stays dark.
          const dark = Math.min(1, Math.max(0, t) / SHUT.dark);
          if (posed) f.pose(look.poses, 'poses', t < SHUT.dark ? BEAST.dizzy : BEAST.calm);
          else f.pose(look.sheet, 'idle', 0);
          f.tint.multiplyScalar(1 - 0.2 * dark);
          if (!still) f.shake += Math.sin(clock * 60) * 0.04 * Math.max(0, 1 - t / SHUT.dark);
          const s = (t - SHUT.settle) / 0.35;
          if (!still && s > 0 && s < 1) { f.squashY *= 1 - 0.1 * Math.sin(s * Math.PI); f.squashX *= 1 + 0.06 * Math.sin(s * Math.PI); }
          return 0;
        }
        if (t < CALM.bow) {
          // The grey runs out from the head down, behind the line of light. With reduce motion it fades in place.
          if (posed) f.pose(look.poses, 'poses', BEAST.dizzy);
          else f.pose(look.sheet, 'idle', 1);
          const k = Math.min(1, Math.max(0, t) / CALM.sweep);
          if (still) { f.drained = 1 - k; f.sweep = 0; }
          else { f.drained = k >= 1 ? 0 : 1; f.sweep = k; }
        } else {
          // It bows: the calm pose, with a small settle.
          if (posed) f.pose(look.poses, 'poses', BEAST.calm);
          else f.play(look.sheet, 'idle');
          f.drained = 0;
          const s = (t - CALM.bow) / CALM.settle;
          if (!still && s < 1) { f.squashY *= 1 - 0.12 * Math.sin(s * Math.PI); f.squashX *= 1 + 0.06 * Math.sin(s * Math.PI); }
        }
        return 0;
      }

      calm.calmOn = false;
      calm.calmT = 0;
      // A small tremble, all the time.
      if (!b.def.machine && b.doing !== 'asleep') f.shake += Math.sin(clock * 47) * 0.012 * look.scale;

      if (b.doing === 'windup' && a) {
        const k = Math.min(1, b.t / Math.max(0.01, b.until));
        if (posed) {
          // The tell pose says it. Code adds only a breath: a ring attack swells, a charge draws back and low.
          f.pose(look.poses, 'poses', BEAST.tell);
          if (a.shape === 'circle') { f.squashX *= 1 + 0.05 * k; f.squashY *= 1 + 0.05 * k; }
          else { f.squashX *= 1 + 0.04 * k; f.squashY *= 1 - 0.05 * k; }
        } else {
          f.pose(look.sheet, 'idle', 0);
          if (a.shape === 'circle') { f.squashX *= 1 + 0.28 * k; f.squashY *= 1 + 0.22 * k; }
          else { f.squashX *= 1 + 0.14 * k; f.squashY *= 1 - 0.16 * k; }
        }
        // Warm for the last quarter second before it lands: warmer light, not a darker beast.
        f.warm = Math.max(0, Math.min(1, (0.25 - (b.until - b.t)) / 0.1));
      } else if (b.doing === 'charge') {
        if (posed) f.pose(look.poses, 'poses', BEAST.attack);
        else { f.play(look.sheet, 'walk'); f.squashX *= 1.2; f.squashY *= 0.86; }
      } else if (b.doing === 'recover') {
        if (posed && a === null && b.t < 0.25) f.pose(look.poses, 'poses', BEAST.attack);
        else f.pose(look.sheet, 'idle', 0);
        f.squashY *= 1 + 0.04 * Math.sin(clock * 9);
      } else if (b.doing === 'dizzy' || b.doing === 'stun' || b.doing === 'held') {
        if (posed) f.pose(look.poses, 'poses', BEAST.dizzy);
        else { f.pose(look.sheet, 'idle', 1); f.squashY *= 0.82; f.squashX *= 1.12; }
        // Dizzy sways. A snare holds it still but for a struggle.
        f.shake += Math.sin(clock * (b.doing === 'held' ? 23 : 5)) * (b.doing === 'held' ? 0.025 : 0.06) * look.scale;
      } else if (b.doing === 'flung') {
        // Thrown by a plate: dizzy already, tumbling through the air.
        const k = Math.min(1, b.t / RIG.flingTime);
        if (posed) f.pose(look.poses, 'poses', BEAST.dizzy);
        else f.pose(look.sheet, 'idle', 0);
        lift = Math.sin(k * Math.PI) * 1.4;
        f.roll = Math.sin(k * Math.PI) * 0.7;
      } else if (b.doing === 'asleep') {
        if (posed) f.pose(look.poses, 'poses', BEAST.calm);
        else f.pose(look.sheet, 'idle', 0);
        f.squashY *= 0.97 + 0.03 * Math.sin(clock * 1.6);
      } else {
        f.play(look.sheet, b.moving ? 'walk' : 'idle');
      }
      return lift;
    },

    standIns() {
      const list: string[] = [];
      for (const kind of ['thistlehog', 'gearling', 'boar', 'pebblepup']) if (of(kind).standIn) list.push(kind);
      if (!heroCut) list.push('hero-cut');
      if (!heroMoves) list.push('hero-moves');
      if (!heroCall) list.push('hero-call');
      if (!figures.has('leaftail-fight')) list.push('leaftail-fight');
      return list;
    },
  };
}

/** The shimmer of the safe moment after a hit: a cool, brighter light on every other frame. */
const SAFE = new THREE.Color(1.22, 1.3, 1.38);
