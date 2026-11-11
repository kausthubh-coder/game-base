// The moment a beast is calmed, around the beast: the most important small animation in the game
// (design/21-look-sound-feel.md, "Calming is color coming back"). What the beast itself shows at each moment,
// its pose, its grey and its glow, is `looks.ts`; this file draws what is around it, on one clock:
//
//   the hold     a thread of teal light along the ground from the hero to the beast, filling as the hold
//                grows, with motes rising off it. The ring that closes around the beast is `draw.ts`.
//   the release  10 frames of freeze on a bright frame, and a ring of the Mark's light thrown out.
//   the grey     for 1.5 seconds the colors come back from the head down behind a bright line, and flecks
//                of grey ash lift off where the line passes and vanish upward.
//   the bow      it takes its calm pose with a small settle, a heart shows over it, and the stinger plays.
//   the land     a ring of fresh green and a few flowers spread from under it, once, and fade.
//   the gift     what it leaves pops out in a small arc, then flies to the hero with its name over it.
//
// A machine is shut down, not calmed: its eye goes dark, it settles, a spring pops out. No ash, no green.
// With the game's reduce motion nothing flies: the colors fade back in place, the heart and the flowers
// stand still, and the gift's name shows over the hero.
import * as THREE from 'three';
import type { BeastState } from '../fight/fight.sim.ts';
import { dirX, dirZ, facingOf } from '../fight/shapes.sim.ts';
import type { GameView, ScreenPoint } from '../shell/view.ts';
import { MARK, type Ground } from './ground.ts';
import { SPARK, type Sparks } from './sparks.ts';

/** Seconds of the moment, counted from the end of the release's freeze. */
export const CALM = {
  /** The freeze on the bright frame: it runs before 0. */
  release: 10 / 60,
  /** The grey runs out, head to feet. */
  sweep: 1.5,
  /** It takes its calm pose and settles. */
  bow: 1.5,
  settle: 0.4,
  /** The heart shows, and is gone. */
  heart: 1.55,
  heartEnd: 3.3,
  /** The ring of green starts as the line reaches the feet, and is gone. */
  ring: 1.25,
  ringEnd: 2.6,
  /** The gift pops out, lands, and flies to the hero. */
  gift: 1.95,
  arc: 0.45,
  rest: 0.3,
  fly: 0.4,
  /** The moment is over: the lab asks "Again?". */
  end: 3.4,
} as const;

/** A machine's shorter moment. */
export const SHUT = { dark: 0.4, settle: 0.45, gift: 0.75, end: 2.4 } as const;

/** What each beast leaves, as a picture. */
const GIFT_GLYPH: Record<string, number> = { thistlehog: SPARK.quill, gearling: SPARK.spring, boar: SPARK.tusk };
const GIFT_COLOR: Record<string, THREE.Color> = {
  thistlehog: new THREE.Color(0.96, 0.86, 0.66),
  gearling: new THREE.Color(0.98, 0.76, 0.36),
  boar: new THREE.Color(1, 0.96, 0.84),
};

const MOTE = new THREE.Color(0.45, 1.5, 1.25), ASH = new THREE.Color(0.6, 0.61, 0.65), GREEN = new THREE.Color(0.55, 0.98, 0.38);
const HEART = new THREE.Color(0.5, 1.25, 1.08), LIGHT = new THREE.Color(0.55, 1.2, 1.05);
const FLOWERS = [new THREE.Color(1, 0.86, 0.36), new THREE.Color(1, 0.72, 0.84), new THREE.Color(1, 0.98, 0.92)];
const FLOWER_COUNT = 7;

/** A calmed beast as the moment needs it: where it is drawn, how tall, and its clock. */
export interface Calmed { x: number; z: number; calmT: number }

export interface CalmingHooks {
  groundY(x: number, z: number): number;
  /** The name of the gift over the page, or none when `at` is null. */
  label(text: string, at: ScreenPoint | null, alpha: number): void;
  /** How tall the hero is drawn, so the gift's name keeps clear of the head. */
  heroHeight(): number;
}

export interface Calming {
  /** The hold: a thread from the hero to a dizzy beast, filling with `b.calm`. Once a frame while it is held. */
  hold(b: BeastState, d: Calmed, dt: number): void;
  /** Everything around one calmed beast, once a frame. `height` is its drawn height. */
  moment(b: BeastState, d: Calmed, height: number, dt: number): void;
  /** Once a frame after every beast, so a label nobody showed goes away. */
  end(): void;
}

/** Half the width of the gift's name on the page, in pixels, and a little room. */
const LABEL_HALF = 64;

const ease = (k: number): number => 1 - (1 - k) * (1 - k);
const clamp01 = (k: number): number => Math.max(0, Math.min(1, k));
/** True in the frame the clock passed `at`. */
const passed = (t: number, dt: number, at: number): boolean => t >= at && t - dt < at;

export function createCalming(view: GameView, ground: Ground, sparks: Sparks, hooks: CalmingHooks): Calming {
  const { groundY, label } = hooks;
  const hero = view.playerPosition;
  const point: ScreenPoint = { x: 0, y: 0 }, head: ScreenPoint = { x: 0, y: 0 }, feet: ScreenPoint = { x: 0, y: 0 };
  const spot = { x: 0, y: 0, z: 0 };
  let labelled = false;

  const still = (): boolean => view.settings.graphics.reduceMotion;
  /** How many of a kind of spark a second, by the quality level. */
  const rate = (high: number): number => high * (view.settings.quality === 'low' ? 0.45 : view.settings.quality === 'medium' ? 0.7 : 1);
  /** Spawns by a rate a second, without a running total: a chance each frame. */
  const due = (perSecond: number, dt: number): number => { const n = perSecond * dt; return Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); };

  function hold(b: BeastState, d: Calmed, dt: number): void {
    const dx = d.x - hero.x, dz = d.z - hero.z, far = Math.hypot(dx, dz), reach = Math.max(0.2, far - b.def.radius * 0.8);
    const facing = facingOf(dx, dz), y = groundY(hero.x, hero.z);
    ground.draw(MARK.line, hero.x, y, hero.z, facing, reach, 0.12, b.calm, LIGHT, 0.85, 0.25 * b.calm);
    if (still()) return;
    const n = due(rate(28), dt);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.max(0.15, b.calm), px = hero.x + dirX(facing) * u * reach, pz = hero.z + dirZ(facing) * u * reach;
      sparks.spawn(SPARK.mote, px, groundY(px, pz) + 0.08, pz, (Math.random() - 0.5) * 0.2, 0.7 + Math.random() * 0.6, (Math.random() - 0.5) * 0.2, 0.6 + Math.random() * 0.4, 0.14, MOTE, -0.2, 0.4);
    }
  }

  function moment(b: BeastState, d: Calmed, height: number, dt: number): void {
    const t = d.calmT, machine = b.def.machine, y = groundY(d.x, d.z), r = b.def.radius, calm = still();
    spot.x = d.x; spot.y = y + 0.4; spot.z = d.z;

    // The release: a ring of the Mark's light thrown out from under it.
    const out = (t + CALM.release) / 0.4;
    if (out >= 0 && out < 1) ground.draw(MARK.ring, d.x, y, d.z, 0, r + 0.4 + (calm ? 0.8 : ease(out) * 1.6), 0.09, 1, LIGHT, 1 - out, 0.6);

    if (machine) {
      // Shut down: it settles with a puff, and a spring pops out.
      if (passed(t, dt, SHUT.settle)) view.effects.play('popDust', spot);
      if (passed(t, dt, SHUT.settle)) view.audio?.emit({ type: 'stinger' });
      gift(b, d, y, height, t - SHUT.gift, SHUT.end - SHUT.gift, calm, dt);
      return;
    }

    // The grey runs out: ash lifts off where the line passes.
    if (!calm && t > 0 && t < CALM.sweep) {
      const k = t / CALM.sweep, line = y + height * (1 - k), wide = r * 1.6;
      const yaw = view.camera.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const n = due(rate(46), dt);
      for (let i = 0; i < n; i++) {
        const across = (Math.random() - 0.5) * wide * (0.6 + 0.4 * Math.sin(k * Math.PI));
        sparks.spawn(SPARK.ash, d.x + rx * across, line + (Math.random() - 0.5) * 0.1, d.z + rz * across, rx * (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.7, rz * (Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 0.5, 0.13 + Math.random() * 0.06, ASH, -0.35, 0.3);
      }
    }

    // It bows: the stinger, and a heart over it.
    if (passed(t, dt, CALM.bow)) view.audio?.emit({ type: 'stinger' });
    if (t >= CALM.heart && t < CALM.heartEnd) {
      const k = (t - CALM.heart) / (CALM.heartEnd - CALM.heart), a = Math.min(1, k * 8) * Math.min(1, (1 - k) * 4);
      const rise = calm ? 0 : ease(clamp01(k * 3)) * 0.3 + Math.sin(t * 5) * 0.03;
      const pop = calm ? 1 : 0.7 + 0.3 * ease(clamp01(k * 6));
      sparks.draw(SPARK.heart, d.x, y + height + 0.35 + rise, d.z, 0.5 * pop * Math.max(1, r * 0.7), HEART, a, 1);
    }

    // The land answers: a ring of fresh green and a few flowers, once.
    if (t >= CALM.ring && t < CALM.ringEnd + 1.6) {
      const k = clamp01((t - CALM.ring) / (CALM.ringEnd - CALM.ring)), reach = r * 0.6 + (calm ? 1 : ease(k)) * (2.6 + r);
      if (k < 1) {
        ground.draw(MARK.ring, d.x, y, d.z, 0, reach, 0.16, 1, GREEN, 0.85 * (1 - k), 0.25);
        ground.draw(MARK.shadow, d.x, y, d.z, 0, reach, 0, 0, GREEN, 0.3 * (1 - k));
      }
      for (let i = 0; i < FLOWER_COUNT; i++) {
        const turn = i * 2.39996 + b.id * 1.3, away = r + 0.5 + ((i * 7) % 5) * 0.45;
        const fx = d.x + Math.sin(turn) * away, fz = d.z - Math.cos(turn) * away;
        // Each opens as the ring passes it, and closes again at the end.
        const opened = calm ? (k > 0 ? 1 : 0) : clamp01((reach - away) / 0.4), closing = clamp01((t - CALM.ringEnd - 0.8 - i * 0.08) / 0.5);
        const size = 0.4 * ease(opened) * (1 - closing);
        if (size > 0.01) sparks.draw(SPARK.flower, fx, groundY(fx, fz) + size * 0.45, fz, size, FLOWERS[i % FLOWERS.length] as THREE.Color, 1, 1);
      }
    }

    gift(b, d, y, height, t - CALM.gift, CALM.end - CALM.gift, calm, dt);
  }

  /** The gift: out of the beast in an arc, a rest on the ground, then to the hero. `t` from when it pops out. */
  function gift(b: BeastState, d: Calmed, y: number, height: number, t: number, span: number, calm: boolean, dt: number): void {
    if (t < 0 || t > span) return;
    const glyph = GIFT_GLYPH[b.def.kind] ?? SPARK.pip, color = GIFT_COLOR[b.def.kind] ?? LIGHT;
    const hy = hero.y + 0.9;
    let x: number, gy: number, z: number, a = 1;
    if (calm) {
      // Nothing flies: the name shows over the hero.
      x = hero.x; gy = hy + 0.6; z = hero.z;
      a = Math.min(1, (span - t) * 3);
    } else {
      // Toward the hero, a block out, from the middle of the beast's body to the ground.
      const dx = hero.x - d.x, dz = hero.z - d.z, far = Math.hypot(dx, dz) || 1;
      const lx = d.x + (dx / far) * (b.def.radius + 0.7), lz = d.z + (dz / far) * (b.def.radius + 0.7), ly = groundY(lx, lz) + 0.25;
      if (t < CALM.arc) {
        const k = t / CALM.arc;
        x = d.x + (lx - d.x) * k; z = d.z + (lz - d.z) * k;
        gy = y + height * 0.5 + (ly - y - height * 0.5) * k + Math.sin(k * Math.PI) * 0.9;
      } else if (t < CALM.arc + CALM.rest) {
        x = lx; z = lz; gy = ly + Math.abs(Math.sin((t - CALM.arc) * 14)) * 0.12 * (1 - (t - CALM.arc) / CALM.rest);
      } else {
        const k = clamp01((t - CALM.arc - CALM.rest) / CALM.fly), e = k * k;
        x = lx + (hero.x - lx) * e; z = lz + (hero.z - lz) * e; gy = ly + (hy - ly) * e + Math.sin(k * Math.PI) * 0.5;
        if (k >= 1) {
          a = 0;
          if (passed(t, dt, CALM.arc + CALM.rest + CALM.fly)) for (let i = 0; i < 6; i++) sparks.spawn(SPARK.mote, hero.x, hy, hero.z, Math.cos(i) * 0.9, 0.6 + (i % 3) * 0.3, Math.sin(i) * 0.9, 0.5, 0.1, MOTE, 0, 2);
        }
      }
      if (a > 0) sparks.draw(glyph, x, gy, z, 0.55, color, a, 1);
    }
    const shown = view.project(x, gy + 0.45, z, point);
    if (shown) {
      // The name never covers the hero or the beast: over either of them it rises above the head.
      above(shown, hero.x, hero.y, hero.y + hooks.heroHeight(), hero.z);
      // Over the beast, it rises above the heart too.
      above(shown, d.x, y, y + height + (b.def.machine ? 0 : 0.8), d.z);
    }
    label(b.def.gift, shown, Math.min(1, t * 5) * Math.min(1, (span - t) * 3));
    labelled = true;
  }

  /** Lifts the foot of a label at `at` above a figure standing from `foot` to `top`, as far as they overlap on the page. */
  function above(at: ScreenPoint, x: number, foot: number, top: number, z: number): void {
    if (!view.project(x, top + 0.12, z, head) || !view.project(x, foot, z, feet)) return;
    const reach = (feet.y - head.y) * 0.45 + LABEL_HALF;
    const k = clamp01((reach - Math.abs(at.x - head.x)) / 24);
    if (k > 0 && at.y > head.y) at.y += (head.y - at.y) * k;
  }

  return {
    hold,
    moment,
    end() {
      if (!labelled) label('', null, 0);
      labelled = false;
    },
  };
}
