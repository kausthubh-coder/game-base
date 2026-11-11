// What a fighter of the fight lab shows for what it is doing: which sheet, which frame, how it is squashed and
// what it is tinted. One place decides it for the hero, the pet and the beasts, so a real sheet replaces a
// stand-in here and nowhere else. Where a fighter stands, its shadow and the marks under it are `draw.ts`.
//
// Stand-in art. Until the real sheets are in the manifest, every beast is the mossling's sheet at another
// size and tint, the hero cuts with the farm tool's swing, and the hero's other moves are the idle frame
// squashed and tinted. `STAND_INS` below says which. Teal for the player's magic, gold for an enemy's attack
// and grey for a drained beast are the plan's suggestion (design/21-look-sound-feel.md), not a decided look.
import * as THREE from 'three';
import { HERO, RIG } from '../content/fight.ts';
import type { BeastState, HeroState, PetState } from '../fight/fight.sim.ts';
import type { Figure, Figures } from './figures.ts';

/** The stand-in lights: the player's magic, an enemy's attack, and the plain marks. */
export const TEAL = new THREE.Color(0.25, 0.95, 0.82), GOLD = new THREE.Color(1, 0.72, 0.2), HOT = new THREE.Color(1, 0.42, 0.16);
export const PALE = new THREE.Color(1, 0.97, 0.86), SHADE = new THREE.Color(0.05, 0.07, 0.05), WHITE = new THREE.Color(1, 1, 1), RED = new THREE.Color(1, 0.4, 0.3);

/** How a fighter is drawn: the sheet it walks and stands in, the sheet of its fight poses when there is one, its size and its tint. */
export interface Look {
  sheet: string;
  /** A sheet whose one animation `poses` holds tell, attack, dizzy and calm in that order. Empty for a stand-in. */
  poses: string;
  scale: number;
  tint: readonly [number, number, number];
  /** True when this is not the fighter's own art. */
  standIn: boolean;
}

/** What each beast is drawn as until its own sheet is in the manifest. */
const STAND_INS: Record<string, Look> = {
  thistlehog: { sheet: 'critter', poses: '', scale: 1.6, tint: [1, 1, 1], standIn: true },
  gearling: { sheet: 'critter', poses: '', scale: 1.8, tint: [1.35, 1.02, 0.5], standIn: true },
  boar: { sheet: 'critter', poses: '', scale: 4.6, tint: [0.85, 0.66, 0.58], standIn: true },
  pebblepup: { sheet: 'leaftail', poses: '', scale: 1.15, tint: [0.78, 0.76, 0.8], standIn: true },
};

/** How long a beast has been calmed, kept by the caller: -1 while it is not, and set to 0 by the moment of calming. */
export interface CalmClock { calmT: number }

export interface Looks {
  /** The look of a beast or a pet kind: its own sheet when the manifest has it, its stand-in otherwise. */
  of(kind: string): Look;
  /** The hero's pose for its act. `moving` is true while the body walks. */
  hero(f: Figure, h: HeroState, moving: boolean): void;
  /** An afterimage of a dodge. */
  ghost(f: Figure): void;
  /** The pet's pose. Returns how far it is lifted off the ground, for a strike's hop. */
  pet(f: Figure, p: PetState, look: Look): number;
  /** A beast's pose, tint and drained grey. It adds to the squash and shake already set. Returns its lift. */
  beast(f: Figure, b: BeastState, look: Look, calm: CalmClock, dt: number, clock: number): number;
  /** Which art is a stand-in right now. */
  standIns(): string[];
}

export function createLooks(figures: Figures): Looks {
  const heroCut = figures.has('hero-cut'), heroMoves = figures.has('hero-moves'), heroCall = figures.has('hero-call');
  const of = (kind: string): Look => (figures.has(kind) ? { sheet: kind, poses: figures.has(`${kind}-fight`) ? `${kind}-fight` : '', scale: 1, tint: [1, 1, 1], standIn: false } : STAND_INS[kind] ?? (STAND_INS.thistlehog as Look));

  return {
    of,

    hero(f, h, moving) {
      f.squashX = f.squashY = 1;
      f.tint.setRGB(1, 1, 1);
      if (h.act === 'cut') {
        if (heroCut) f.once('hero-cut', 'cut', h.t, HERO.cut.total);
        else f.once('hero-swing', 'tool', h.t, HERO.cut.total * 0.8);
      } else if (h.act === 'spin') {
        // The cut, played once around: the hero turns a whole circle while it lands.
        f.face(h.facing + Math.min(1, h.t / (HERO.spin.total * 0.6)) * Math.PI * 2);
        if (heroCut) f.pose('hero-cut', 'cut', 1);
        else f.pose('hero-swing', 'tool', 1);
      } else if (h.act === 'dodge') {
        if (heroMoves) f.pose('hero-moves', 'poses', 0);
        else { f.play('hero', 'walk'); f.squashX = 1.18; f.squashY = 0.78; }
        f.tint.setRGB(0.75, 0.95, 1.1);
      } else if (h.act === 'hurt') {
        if (heroMoves) f.pose('hero-moves', 'poses', 1);
        else { f.pose('hero', 'idle', 0); f.squashX = 0.92; f.squashY = 1.06; }
        f.tint.setRGB(1.15, 0.8, 0.75);
      } else if (h.act === 'calm') {
        if (heroMoves) f.pose('hero-moves', 'poses', h.t < 0.2 ? 2 : 3);
        else f.pose('hero', 'idle', 0);
        f.tint.setRGB(0.85, 1.12, 1.08);
      } else if (h.act === 'throw') {
        if (heroCall) f.pose('hero-call', 'poses', h.t < 0.07 ? 0 : 1);
        else f.once('hero-swing', 'tool', h.t + 0.05, HERO.bolt.pose + 0.05);
      } else if (h.act === 'whistle') {
        if (heroCall) f.pose('hero-call', 'poses', 2);
        else f.pose('hero', 'idle', 1);
      } else if (h.act === 'faint') {
        // Down on the ground, never worse: flat, pale, and up again in a moment.
        f.pose('hero', 'idle', 0);
        f.squashX = 1.35;
        f.squashY = Math.max(0.3, 1 - h.t * 4);
        f.tint.setRGB(0.8, 0.82, 0.9);
      } else {
        f.play('hero', moving ? 'walk' : 'idle');
        if (h.charge > 0.25) {
          // Charging: it gathers itself, and glows when the spin is ready.
          const k = Math.min(1, h.charge / HERO.spin.hold);
          f.squashY = 1 - 0.08 * k;
          f.squashX = 1 + 0.06 * k;
          if (k >= 1) f.tint.setRGB(1.25, 1.2, 0.95);
        }
      }
    },

    ghost(f) {
      f.play('hero', 'walk');
      f.tint.setRGB(0.6, 0.95, 1.1);
    },

    pet(f, p, look) {
      f.scale = look.scale;
      f.tint.setRGB(look.tint[0], look.tint[1], look.tint[2]);
      f.squashX = f.squashY = 1;
      f.drained = 0;
      let lift = 0;
      const poses = figures.has(`${p.def.kind}-fight`) ? `${p.def.kind}-fight` : '';
      if (p.mode === 'down') {
        if (poses) f.pose(poses, 'poses', 3);
        else { f.pose(look.sheet, 'idle', 0); f.squashY = 0.45; f.squashX = 1.25; f.drained = 0.5; }
      } else if (p.strikeT > 0) {
        // A strike: a short hop at the beast.
        if (poses) f.pose(poses, 'poses', 1);
        else { f.play(look.sheet, 'walk'); f.squashX = 1.3; f.squashY = 0.85; }
        lift = Math.sin((p.strikeT / 0.3) * Math.PI) * 0.35;
      } else if (p.hurtT > 0) {
        if (poses) f.pose(poses, 'poses', 2);
        else f.pose(look.sheet, 'idle', 0);
      } else if (p.mode === 'brace') {
        if (poses) f.pose(poses, 'poses', 0);
        else { f.pose(look.sheet, 'idle', 0); f.squashX = 1.25; f.squashY = 0.85; }
      } else {
        f.play(look.sheet, p.moving ? 'walk' : 'idle');
      }
      return lift;
    },

    beast(f, b, look, calm, dt, clock) {
      const a = b.attack;
      let lift = 0;
      f.scale = look.scale;
      f.tint.setRGB(look.tint[0], look.tint[1], look.tint[2]);

      // Drained grey while the Blight has it. A machine is not Blighted: it only goes dark when it is shut down.
      if (b.doing === 'calmed') {
        if (calm.calmT < 0) calm.calmT = 9;
        calm.calmT += dt;
        if (b.def.machine) { const k = Math.min(1, calm.calmT / 1.2); f.drained = 0; f.tint.multiplyScalar(1 - 0.5 * k); }
        else { f.sweep = Math.min(1, calm.calmT / 1.5); f.drained = f.sweep >= 1 ? 0 : 1; }
      } else {
        calm.calmT = -1;
        f.sweep = 0;
        f.drained = b.def.machine ? 0 : 1;
        // A small tremble, all the time.
        if (!b.def.machine && b.doing !== 'asleep') f.shake += Math.sin(clock * 47) * 0.012 * look.scale;
      }

      const posed = look.poses !== '';
      if (b.doing === 'windup' && a) {
        const k = Math.min(1, b.t / Math.max(0.01, b.until));
        if (posed) f.pose(look.poses, 'poses', 0);
        else f.pose(look.sheet, 'idle', 0);
        // The tell: a ring attack puffs it up, a charge pulls it back and low.
        if (a.shape === 'circle') { f.squashX *= 1 + 0.28 * k; f.squashY *= 1 + 0.22 * k; }
        else { f.squashX *= 1 + 0.14 * k; f.squashY *= 1 - 0.16 * k; }
        // Warm for the last quarter second before it lands.
        if (b.until - b.t < 0.25) f.tint.lerp(HOT, 0.45);
      } else if (b.doing === 'charge') {
        if (posed) f.pose(look.poses, 'poses', 1);
        else { f.play(look.sheet, 'walk'); f.squashX *= 1.2; f.squashY *= 0.86; }
      } else if (b.doing === 'recover') {
        if (posed && a === null && b.t < 0.25) f.pose(look.poses, 'poses', 1);
        else f.pose(look.sheet, 'idle', 0);
        f.squashY *= 1 + 0.04 * Math.sin(clock * 9);
      } else if (b.doing === 'dizzy' || b.doing === 'stun' || b.doing === 'held') {
        if (posed) f.pose(look.poses, 'poses', 2);
        else { f.pose(look.sheet, 'idle', 1); f.squashY *= 0.82; f.squashX *= 1.12; }
        f.shake += Math.sin(clock * 5) * 0.06 * look.scale;
      } else if (b.doing === 'flung') {
        f.pose(look.sheet, 'idle', 0);
        lift = Math.sin(Math.min(1, b.t / RIG.flingTime) * Math.PI) * 1.4;
      } else if (b.doing === 'calmed') {
        if (posed) f.pose(look.poses, 'poses', 3);
        else f.play(look.sheet, 'idle');
      } else if (b.doing === 'asleep') {
        f.pose(look.sheet, 'idle', 0);
        f.squashY *= 0.9 + 0.03 * Math.sin(clock * 1.6);
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
