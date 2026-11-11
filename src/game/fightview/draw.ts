// The fight lab's picture, once a frame: where the hero, the pet and the beasts stand, eased toward where the
// rules have them, their shadows and the marks under them, the shapes of attacks on the ground, the rig in the
// hand and the rigs that stand. What pose a fighter holds is `looks.ts`; what a hit adds to it is `feel.ts`.
// It reads the fight and never writes it.
import { ARENA, type Stage } from '../fight/arena.sim.ts';
import { HERO, PET, RIG, SHAPE_AFTER } from '../content/fight.ts';
import type { BeastState, Fight } from '../fight/fight.sim.ts';
import { dirX, dirZ } from '../fight/shapes.sim.ts';
import type { GameView, ScreenPoint } from '../shell/view.ts';
import { CALM, createCalming } from './calm.ts';
import { jolt, settle, type Feel, type Felt, type Jolt } from './feel.ts';
import { createFigures, type Figure, type Figures } from './figures.ts';
import { MARK, createGround, type Ground } from './ground.ts';
import type { Keys } from './keys.ts';
import { GOLD, HOT, PALE, RED, SHADE, TEAL, createLooks, type Look, type Looks } from './looks.ts';
import { createRigViews } from './rigs.ts';
import { SPARK, createSparks, type Sparks } from './sparks.ts';

/** The height of the ground a fighter stands on: the painted ground where there is one, the blocks otherwise. */
export function heightOf(view: GameView): (x: number, z: number) => number {
  return (x, z) => {
    const painted = view.groundAt(x, z);
    return painted === painted ? painted : view.world.sim.heightAt(Math.floor(x), Math.floor(z));
  };
}

export interface Draw {
  /** Once a frame, after the rules stepped. `clock` is the lab's seconds, for anything that pulses. */
  frame(dt: number, clock: number): void;
  /** Where the bar over a beast goes on the page, or null when it is out of view. */
  beastAt(beast: BeastState): ScreenPoint | null;
  /** The drawn beast nearest a point, for the feel of a hit. */
  nearest(x: number, z: number): Felt | null;
  /** Seconds into a beast's moment of calming (below 0 during the release), or null before it. */
  momentOf(beast: BeastState): number | null;
  readonly figures: Figures;
  readonly ground: Ground;
  readonly sparks: Sparks;
  readonly looks: Looks;
}

export interface DrawHooks {
  /** The name of a gift over the page, or none when `at` is null. */
  label(text: string, at: ScreenPoint | null, alpha: number): void;
}

/** A drawn beast: its figure, where it is drawn, and how many pips of thrown light it showed last frame. */
interface Drawn extends Felt { figure: Figure; look: Look; x: number; z: number; id: number; marks: number }

/** The pips of thrown light, in the Mark's teal. Spent ones flash brighter as they go into the beast. */
const PIP = TEAL.clone().multiplyScalar(1.35), SPENT = TEAL.clone().multiplyScalar(1.9);

/** `floor` is the height of the arena's ground, where its edge is drawn. */
export function createDraw(view: GameView, fight: Fight, stage: Stage, floor: number, keys: Keys, feel: Feel, hooks: DrawHooks): Draw {
  const groundY = heightOf(view);
  const figures = createFigures(view);
  const ground = createGround(view);
  const sparks = createSparks(view);
  const calming = createCalming(view, ground, sparks, { groundY, label: hooks.label });
  const rigViews = createRigViews(view);
  const looks = createLooks(figures);
  const input = fight.input;
  let clock = 0;

  const heroFigure = figures.add('hero');
  /** Two afterimages of a dodge: where the hero was a moment ago. */
  const ghosts = [figures.add('hero', { ghost: true }), figures.add('hero', { ghost: true })];
  const trail = [{ x: 0, y: 0, z: 0, t: 9 }, { x: 0, y: 0, z: 0, t: 9 }];
  let petLook = looks.of(fight.pet.def.kind), petKind = fight.pet.def.kind;
  let petFigure = figures.add(petLook.sheet);
  const petDrawn = { x: stage.start.x + 1.2, z: stage.start.z + 0.8 };
  const drawn = new Map<number, Drawn>();

  function nearest(x: number, z: number): Drawn | null {
    let best: Drawn | null = null, near = Infinity;
    for (const d of drawn.values()) { const away = Math.hypot(d.x - x, d.z - z); if (away < near) { near = away; best = d; } }
    return best;
  }

  function drawHero(dt: number): void {
    const h = fight.hero, f = heroFigure, p = view.playerPosition, body = view.hero.body, j: Jolt = feel.hero;
    view.hero.actor.visible = false;
    settle(j, dt);
    f.place(p.x, p.y, p.z);
    f.face(h.facing);
    f.flash = j.flash;
    f.shake = j.shake * Math.sin(clock * 90);
    // Just after a calm the hero keeps holding the Mark out, through the release.
    let holding = false;
    for (const d of drawn.values()) if (d.calmOn && d.calmT < 0.5) holding = true;
    looks.hero(f, h, Math.hypot(body.vx, body.vz) > 0.4, clock, feel.pointing > 0, holding);
    // The arc of a cut, at its true angle, from the moment it lands: three frames, fading (note 05's feel list).
    if (h.act === 'cut') {
      const k = (h.t - HERO.cut.startup + 1 / 120) / 0.1;
      if (k >= 0 && k < 1) ground.draw(MARK.cone, p.x, groundY(p.x, p.z), p.z, h.facing, HERO.cut.reach, HERO.cut.arc / 2, 1, PALE, 1 - k, 0.6);
    }

    // The afterimages of a dodge: two places the hero just left.
    for (let i = 0; i < 2; i++) {
      const g = ghosts[i] as Figure, at = trail[i] as (typeof trail)[number];
      at.t += dt;
      if (h.act === 'dodge' && h.t > (i + 1) * 0.07 && at.t > 0.3) { at.x = p.x - dirX(h.facing) * (i + 1) * 0.8; at.y = p.y; at.z = p.z - dirZ(h.facing) * (i + 1) * 0.8; at.t = 0; }
      g.visible = at.t < 0.22;
      if (!g.visible) continue;
      g.place(at.x, at.y, at.z);
      g.face(h.facing);
      looks.ghost(g);
      g.alpha = 0.45 * (1 - at.t / 0.22);
    }
  }

  function drawPet(dt: number): void {
    const p = fight.pet, j = feel.pet;
    if (p.def.kind !== petKind) {
      petKind = p.def.kind;
      petLook = looks.of(petKind);
      petFigure.remove();
      petFigure = figures.add(petLook.sheet);
    }
    const f = petFigure, ease = 1 - Math.exp(-24 * dt);
    settle(j, dt);
    // A pet that jumps a long way (it comes back beside the hero after a rest) is not slid there.
    if (Math.hypot(p.x - petDrawn.x, p.z - petDrawn.z) > 4) { petDrawn.x = p.x; petDrawn.z = p.z; }
    petDrawn.x += (p.x - petDrawn.x) * ease;
    petDrawn.z += (p.z - petDrawn.z) * ease;
    const y = groundY(petDrawn.x, petDrawn.z);
    f.face(p.facing);
    f.flash = j.flash;
    f.shake = j.shake * Math.sin(clock * 90);
    const lift = looks.pet(f, p, petLook);
    f.place(petDrawn.x, y + lift, petDrawn.z);
    ground.draw(MARK.shadow, petDrawn.x, y, petDrawn.z, 0, 0.42 * petLook.scale, 0, 0, SHADE, 0.45);
    if (p.mode === 'brace') ground.draw(MARK.ring, petDrawn.x, y, petDrawn.z, 0, 1.8, 0.07, 1, TEAL, 0.9);
    if (p.mode === 'lure') ground.draw(MARK.ring, petDrawn.x, y, petDrawn.z, 0, 0.8 + 0.2 * Math.sin(clock * 8), 0.05, 1, TEAL, 0.8);
  }

  function drawBeasts(dt: number): void {
    for (const d of drawn.values()) {
      if (fight.beasts.some((b) => b.id === d.id)) continue;
      d.figure.remove();
      drawn.delete(d.id);
    }
    for (let i = 0; i < fight.beasts.length; i++) {
      const b = fight.beasts[i] as BeastState;
      let d = drawn.get(b.id);
      if (!d) {
        const look = looks.of(b.def.kind);
        d = { figure: figures.add(look.sheet), look, jolt: jolt(), x: b.x, z: b.z, calmT: 0, calmOn: false, id: b.id, marks: 0 };
        drawn.set(b.id, d);
      }
      const f = d.figure;
      settle(d.jolt, dt);
      const ease = 1 - Math.exp(-30 * dt);
      d.x += (b.x - d.x) * ease;
      d.z += (b.z - d.z) * ease;
      const y = groundY(d.x, d.z);
      f.face(b.facing);
      f.flash = d.jolt.flash * 0.85;
      f.shake = d.jolt.shake * Math.sin(clock * 95);
      f.squashX = 1 + 0.15 * d.jolt.squash;
      f.squashY = 1 - 0.1 * d.jolt.squash;
      const lift = looks.beast(f, b, d.look, d, dt, clock, view.settings.graphics.reduceMotion);
      f.place(d.x, y + lift, d.z);

      const r = b.def.radius;
      ground.draw(MARK.shadow, d.x, y, d.z, 0, r * 1.25, 0, 0, SHADE, 0.5 / (1 + lift));
      // The hold of the Mark: a teal ring that closes around the beast, and the thread from the hero to it.
      if (b.doing === 'dizzy') {
        ground.draw(MARK.ring, d.x, y, d.z, 0, r + 0.7, 0.04, 1, TEAL, 0.35 + 0.2 * Math.sin(clock * 6));
        if (b.calm > 0) ground.draw(MARK.ring, d.x, y, d.z, 0, r + 0.7, 0.1, b.calm, TEAL, 1, 0.3);
        if (b.calm > 0 && fight.hero.act === 'calm') calming.hold(b, d, dt);
      }
      if (b.doing === 'calmed' && d.calmOn && d.calmT < CALM.end + 2) calming.moment(b, d, f.height, dt);
      pips(b, d, y + lift + f.height, clock);
    }
  }

  /**
   * The marks of thrown light: small pips over the beast's head, never a ring on the ground (that is the hold
   * of the Mark). The pet's strike spends them: they dive into the beast. Marks that run out float off.
   */
  function pips(b: BeastState, d: Drawn, top: number, clock: number): void {
    const yaw = view.camera.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw), y = top + 0.22;
    const at = (i: number, n: number): number => (i - (n - 1) / 2) * 0.32;
    if (b.marks < d.marks) {
      const struck = fight.pet.strikeT > 0;
      for (let i = b.marks; i < d.marks; i++) {
        const o = at(i, d.marks), px = d.x + rx * o, pz = d.z + rz * o;
        if (struck) {
          sparks.spawn(SPARK.pip, px, y, pz, -rx * o * 2, -4.5, -rz * o * 2, 0.22, 0.3, SPENT);
          for (let k = 0; k < 3; k++) sparks.spawn(SPARK.mote, d.x, top * 0.5 + y * 0.5 - 0.4, d.z, Math.cos(i * 2 + k * 2.1) * 1.4, 0.8, Math.sin(i * 2 + k * 2.1) * 1.4, 0.4, 0.12, SPENT, 2, 2);
        } else {
          sparks.spawn(SPARK.pip, px, y, pz, 0, 0.5, 0, 0.4, 0.24, PIP);
        }
      }
    }
    d.marks = b.marks;
    for (let i = 0; i < b.marks; i++) {
      const o = at(i, b.marks);
      sparks.draw(SPARK.pip, d.x + rx * o, y + Math.sin(clock * 4 + i * 1.7) * 0.04, d.z + rz * o, 0.26, PIP, 1, 1);
    }
  }

  function drawGround(dt: number): void {
    const y = floor;
    // The edge of the arena.
    ground.draw(MARK.ring, stage.center.x, y, stage.center.z, 0, ARENA.radius, 0.06, 1, PALE, 0.35);
    for (let i = 0; i < fight.shapes.length; i++) {
      const s = fight.shapes[i] as (typeof fight.shapes)[number];
      if (!s.live) continue;
      const landed = s.t >= s.lead, k = landed ? 1 : s.t / s.lead;
      const kind = s.kind === 'circle' ? MARK.circle : s.kind === 'line' ? MARK.line : MARK.cone;
      const sy = groundY(s.x, s.z);
      // Gold while it fills, hotter for the last quarter second, and a white flash as it lands.
      const late = !landed && s.lead - s.t < 0.25;
      ground.draw(kind, s.x, sy, s.z, s.facing, s.reach, s.width, k, late ? HOT : GOLD, landed ? Math.max(0, 1 - (s.t - s.lead) / SHAPE_AFTER) : 1, landed ? 1 : 0);
      // A charge that will end in a wall or a tree says so: a ring where it will crash.
      if (s.kind === 'line' && s.end === 1 && !landed) ground.draw(MARK.ring, s.x + dirX(s.facing) * s.reach, sy, s.z + dirZ(s.facing) * s.reach, 0, 0.7 + 0.15 * Math.sin(clock * 10), 0.07, 1, PALE, 0.95);
    }
    for (const f of feel.flashes) {
      if (f.life <= 0) continue;
      const k = f.life / f.span;
      ground.draw(f.kind, f.x, groundY(f.x, f.z), f.z, f.facing, f.reach + f.grow * (1 - k), f.width, 1, f.color, k, 0.6);
      f.life -= dt;
    }
    for (let i = 0; i < fight.bolts.length; i++) {
      const bolt = fight.bolts[i] as (typeof fight.bolts)[number];
      if (!bolt.live) continue;
      const by = groundY(bolt.x, bolt.z);
      ground.draw(MARK.circle, bolt.x, by, bolt.z, 0, 0.28, 0, 1, TEAL, 1, 0.6);
      ground.draw(MARK.line, bolt.x - dirX(bolt.facing) * 1.1, by, bolt.z - dirZ(bolt.facing) * 1.1, bolt.facing, 1.1, 0.14, 1, TEAL, 0.6);
    }
    const p = view.playerPosition;
    ground.draw(MARK.shadow, p.x, groundY(p.x, p.z), p.z, 0, 0.5, 0, 0, SHADE, 0.5);

    // The rig in the hand: where it would stand, and how far the hero can reach.
    const held = keys.held;
    if (held && fight.way === 'world') {
      const cx = Math.floor(input.aimX) + 0.5, cz = Math.floor(input.aimZ) + 0.5, why = fight.canPlace(held, cx, cz);
      let alongX = true;
      const beast = fight.beasts[0];
      if (beast) alongX = Math.abs(beast.z - cz) >= Math.abs(beast.x - cx);
      rigViews.ghost(held, cx, groundY(cx, cz), cz, alongX, why === null);
      ground.draw(MARK.cell, cx, groundY(cx, cz), cz, 0, 0.5, 0, 0, why === null ? TEAL : RED, 0.9);
      // Refused for being too near a beast, the cell is under its body: the ring it keeps clear says why.
      if (why !== null && beast && Math.hypot(beast.x - cx, beast.z - cz) < beast.def.radius + RIG.clear + 0.8) {
        ground.draw(MARK.ring, beast.x, groundY(beast.x, beast.z), beast.z, 0, beast.def.radius + RIG.clear, 0.06, 1, RED, 0.9);
      }
      ground.draw(MARK.ring, p.x, groundY(p.x, p.z), p.z, 0, RIG.reach, 0.04, 1, PALE, 0.4);
      if (held === 'lamp') ground.draw(MARK.ring, cx, groundY(cx, cz), cz, 0, RIG.lure, 0.04, 1, TEAL, 0.3);
    } else {
      rigViews.ghost(null, 0, 0, 0, true, true);
    }
    // A lamp's light, and the reach of the plate's hand spring.
    for (let i = 0; i < fight.rigs.length; i++) {
      const rig = fight.rigs[i] as (typeof fight.rigs)[number];
      if (!rig.armed) continue;
      if (rig.kind === 'lamp') ground.draw(MARK.circle, rig.x, groundY(rig.x, rig.z), rig.z, 0, 1.4, 0, 0, TEAL, 0.5);
      else if (rig.kind === 'plate') ground.draw(MARK.ring, rig.x, groundY(rig.x, rig.z), rig.z, 0, RIG.hand, 0.03, 1, PALE, 0.25);
    }
    // In the pet's way the pointer shows which beast a click would send the pet at.
    if (fight.way === 'pet') {
      for (let i = 0; i < fight.beasts.length; i++) {
        const b = fight.beasts[i] as BeastState;
        if (b.doing !== 'calmed' && Math.hypot(input.aimX - b.x, input.aimZ - b.z) <= b.def.radius + PET.order) ground.draw(MARK.ring, b.x, groundY(b.x, b.z), b.z, 0, b.def.radius + PET.order, 0.04, 1, TEAL, 0.7);
      }
    }
  }

  const point: ScreenPoint = { x: 0, y: 0 };

  return {
    frame(dt, now) {
      clock = now;
      ground.begin();
      sparks.begin();
      drawGround(dt);
      drawHero(dt);
      drawPet(dt);
      drawBeasts(dt);
      calming.end();
      ground.end();
      sparks.end(dt);
      rigViews.sync(fight.rigs, groundY);
      figures.update(dt);
    },
    beastAt(beast) {
      const d = drawn.get(beast.id);
      return d ? view.project(d.x, groundY(d.x, d.z) + d.figure.height + 0.35, d.z, point) : null;
    },
    nearest,
    momentOf(beast) { const d = drawn.get(beast.id); return d && d.calmOn ? d.calmT : null; },
    figures,
    ground,
    sparks,
    looks,
  };
}
