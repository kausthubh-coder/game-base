// The fight lab's picture, once a frame: where the hero, the companion and the beasts stand, eased toward where
// the rules have them, their shadows and the marks under them, the shapes of attacks on the ground, the shots in
// the air, the rig in the hand and the rigs that stand. What pose a fighter holds is `looks.ts`; what a hit adds
// to it is `feel.ts`. It reads the fight and never writes it.
//
// What the companion is doing shows without the card: the guard's shield in front of it, the healer's line of
// light to the hero, a glow at the hero's hand when the booster has made the next hit strong, a ring round the
// hero in bloom, and the striker's hop. A beast that is slowed has a cold ring at its feet, and one that is
// enraged breathes out ash.
import type { Stage } from '../fight/arena.sim.ts';
import { COMPANION, KIT_FIGHT, RIG, SHAPE_AFTER, SWORD, weaponOf } from '../content/fight.ts';
import type { BeastState, Fight, Telegraph } from '../fight/fight.sim.ts';
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
  /**
   * Hides every fighter and mark and gives the hero back their own figure, or shows the fight again. The world's
   * fights draw only while one runs.
   */
  show(on: boolean): void;
}

export interface DrawHooks {
  /** Safe practice draws the hero and target without granting a companion. */
  companion?(): boolean;
  /** The name of a gift over the page, or none when `at` is null. */
  label(text: string, at: ScreenPoint | null, alpha: number): void;
  /** The Stag's hall, or null in the meadow: no meadow edge is drawn, and the marks lie where the hall says. */
  hall?: DrawHall | null;
  /** The world's fights: beasts wear their Blighted sheets. The lab's beasts keep the sheets it was tuned with. */
  blighted?: boolean;
  /** More marks on the ground each frame, drawn with the fight's: a keeper's parts, the vines. */
  extra?(ground: Ground, sparks: Sparks, groundY: (x: number, z: number) => number, dt: number, clock: number): void;
}

/** What the drawing needs to know of the Stag's hall. */
export interface DrawHall {
  /** The height a mark lies at: the hall's floor, or the top of its vines. */
  height(x: number, z: number): number;
  /** Blocks from the hall's middle to its wall. Nothing on the ground is drawn past it. */
  radius: number;
  /** True for a shape the hall draws itself: a shake, step by step up the vines. */
  own(shape: Telegraph): boolean;
}

/** A drawn beast: its figure, where it is drawn, and how many pips of thrown light it showed last frame. */
interface Drawn extends Felt { figure: Figure; look: Look; x: number; z: number; id: number; marks: number }

/** The pips of thrown light, in the Mark's teal. Spent ones flash brighter as they go into the beast. */
const PIP = TEAL.clone().multiplyScalar(1.35), SPENT = TEAL.clone().multiplyScalar(1.9);
/** The snare vine's ring on the ground: its own leaf green is too close to the grass to read at the fight's zoom. */
const VINE = TEAL.clone().setRGB(0.78, 1.05, 0.3);
/** The healer's light, a warm green; the cold ring of a slowed beast; the ash an enraged beast breathes out. */
const MEND = TEAL.clone().setRGB(0.62, 1.1, 0.55), COLD = TEAL.clone().setRGB(0.62, 0.8, 1.15), ASH = TEAL.clone().setRGB(0.42, 0.4, 0.4);
/** The glow at the hero's hand when the next hit is strong. */
const STRONG = TEAL.clone().setRGB(1.25, 1.2, 0.95);

/** `floor` is the height of the arena's ground, where its edge is drawn: a number, or a function for a stage that changes. */
export function createDraw(view: GameView, fight: Fight, stage: Stage, floorAt: number | (() => number), keys: Keys, feel: Feel, hooks: DrawHooks): Draw {
  const floorOf = (): number => (typeof floorAt === 'number' ? floorAt : floorAt());
  const hall = hooks.hall ?? null;
  const landY = hall ? hall.height : heightOf(view);
  // Over the pond a mark lies on the water, not on its floor, so a shape that lands on a hero wading there shows.
  const groundY = hall ? landY : (x: number, z: number): number => (stage.water(x, z) ? Math.max(landY(x, z), floorOf() - 0.05) : landY(x, z));
  const figures = createFigures(view);
  const ground = createGround(view);
  if (hall) ground.clip(stage.center.x, stage.center.z, hall.radius);
  const sparks = createSparks(view);
  const calming = createCalming(view, ground, sparks, { groundY, label: hooks.label, heroHeight: () => heroFigure.height });
  const rigViews = createRigViews(view);
  const looks = createLooks(figures);
  let clock = 0;
  /** Seconds until the next mote of healing rises off the hero, and the next spark off a hand with a strong hit. */
  let healMotes = 0, strongSparks = 0;
  /** Seconds until each beast's next breath of ash, by its id. Enraged beasts breathe out ash. */
  const breaths = new Map<number, number>();

  const heroFigure = figures.add('hero');
  /** Two afterimages of a dodge: where the hero was a moment ago. */
  const ghosts = [figures.add('hero', { ghost: true }), figures.add('hero', { ghost: true })];
  const trail = [{ x: 0, y: 0, z: 0, t: 9 }, { x: 0, y: 0, z: 0, t: 9 }];
  let companionLook = looks.of(fight.companion.def.kind), companionKind = fight.companion.def.kind;
  let companionFigure = figures.add(companionLook.sheet);
  const companionDrawn = { x: stage.start.x + 1.2, z: stage.start.z + 0.8 };
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
    looks.hero(f, h, Math.hypot(body.vx, body.vz) > 0.4, clock, holding);
    const gy = groundY(p.x, p.z);
    // The arc of a cut, at its true angle, from the moment it lands: three frames, fading (note 05's feel list).
    if (h.act === 'cut') {
      const cut = SWORD.quick, k = (h.t - cut.startup + 1 / 120) / 0.1;
      if (k >= 0 && k < 1) ground.draw(MARK.cone, p.x, gy, p.z, h.facing, cut.reach, cut.width, 1, PALE, 1 - k, 0.6);
    }
    // The held move being charged: the bow's line down the aim, the staff's ring where the burst will land.
    const held = weaponOf(h.weapon).held;
    if (h.charge > 0.25 && h.act === 'none' && held.kind !== 'ring') {
      const ready = h.charge >= held.hold, k = Math.min(1, h.charge / held.hold);
      if (held.kind === 'shot') {
        ground.draw(MARK.line, p.x, gy, p.z, h.facing, held.range * (0.35 + 0.65 * k), 0.08 + (ready ? 0.05 : 0), 1, PALE, ready ? 0.75 : 0.35);
      } else {
        const dx = fight.input.aimX - p.x, dz = fight.input.aimZ - p.z, d = Math.hypot(dx, dz), c = d > held.range ? held.range / d : 1, bx = p.x + dx * c, bz = p.z + dz * c;
        ground.draw(MARK.ring, bx, groundY(bx, bz), bz, 0, held.reach, ready ? 0.08 : 0.05, k, TEAL, ready ? 0.9 : 0.5);
      }
    }
    if (h.act === 'burst' && h.move && h.t < h.move.startup) ground.draw(MARK.circle, h.burstX, groundY(h.burstX, h.burstZ), h.burstZ, 0, h.move.reach, 0, h.t / h.move.startup, TEAL, 0.45, 0.4);
    // The booster's gifts: a glow at the hand when the next hit is strong, and a ring round the hero in bloom.
    if (h.strong) {
      const side = h.facing + Math.PI / 2, pulse = 0.8 + 0.2 * Math.sin(clock * 9);
      const hx = p.x + dirX(side) * 0.3 + dirX(h.facing) * 0.25, hy = p.y + heroFigure.height * 0.5, hz = p.z + dirZ(side) * 0.3 + dirZ(h.facing) * 0.25;
      sparks.draw(SPARK.mote, hx, hy, hz, 0.55 * pulse, STRONG, 1, 1);
      sparks.draw(SPARK.pip, hx, hy, hz, 0.3, STRONG, 1, 1);
      strongSparks -= dt;
      if (strongSparks <= 0) { strongSparks = 0.09; sparks.spawn(SPARK.mote, hx, hy, hz, Math.sin(clock * 13) * 0.4, 1.4, Math.cos(clock * 11) * 0.4, 0.45, 0.14, STRONG); }
    }
    if (h.bloom > 0) ground.draw(MARK.ring, p.x, gy, p.z, clock * 2, 0.85 + 0.06 * Math.sin(clock * 6), 0.07, Math.min(1, h.bloom / 0.5), MEND, 0.85);

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

  function drawCompanion(dt: number): void {
    companionFigure.visible = hooks.companion?.() ?? true;
    if (!companionFigure.visible) return;
    const c = fight.companion, j = feel.companion;
    if (c.def.kind !== companionKind) {
      companionKind = c.def.kind;
      companionLook = looks.of(companionKind);
      companionFigure.remove();
      companionFigure = figures.add(companionLook.sheet);
    }
    const f = companionFigure, ease = 1 - Math.exp(-24 * dt);
    settle(j, dt);
    // A companion that jumps a long way (it comes back beside the hero after the hero wakes) is not slid there.
    if (Math.hypot(c.x - companionDrawn.x, c.z - companionDrawn.z) > 4) { companionDrawn.x = c.x; companionDrawn.z = c.z; }
    companionDrawn.x += (c.x - companionDrawn.x) * ease;
    companionDrawn.z += (c.z - companionDrawn.z) * ease;
    const x = companionDrawn.x, z = companionDrawn.z, y = groundY(x, z);
    f.face(c.facing);
    f.flash = j.flash;
    f.shake = j.shake * Math.sin(clock * 90);
    const lift = looks.companion(f, c, companionLook, clock);
    f.place(x, y + lift, z);
    ground.draw(MARK.shadow, x, y, z, 0, 0.42 * companionLook.scale * (lift > 0.6 ? 0.7 : 1), 0, 0, SHADE, 0.45 / (1 + lift * 0.5));
    const role = c.def.role, p = view.playerPosition;
    if (c.mode === 'brace') {
      // The brace: a full shield round it, bright, until it takes an attack.
      ground.draw(MARK.ring, x, y, z, 0, COMPANION.cover, 0.08, 1, TEAL, 0.9);
      ground.draw(MARK.cone, x, y, z, c.facing, 1.2, 1.1, 1, TEAL, 0.5, 0.3);
    } else if (role === 'guard' && fight.way === 'hero') {
      // The guard stands in the way: a small shield in front of it, toward the beast.
      ground.draw(MARK.cone, x, y, z, c.facing, 1, 0.9, 1, TEAL, 0.28 + 0.05 * Math.sin(clock * 4));
    }
    if (c.mode === 'lure') ground.draw(MARK.ring, x, y, z, 0, 0.8 + 0.2 * Math.sin(clock * 8), 0.05, 1, TEAL, 0.8);
    if (c.healing) {
      // A line of healing light from the healer to the hero, and motes rising off the hero.
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
      if (d > 0.3) ground.draw(MARK.line, x, groundY(x, z), z, Math.atan2(dx, -dz), d, 0.1, (clock * 1.5) % 1, MEND, 0.55 + 0.2 * Math.sin(clock * 7), 0.5);
      healMotes -= dt;
      if (healMotes <= 0) {
        healMotes = 0.12;
        const turn = clock * 7.3;
        sparks.spawn(SPARK.mote, p.x + Math.cos(turn) * 0.35, p.y + 0.3, p.z + Math.sin(turn) * 0.35, 0, 1.1, 0, 0.7, 0.16, MEND);
      }
      // From the fly itself, a few motes drifting toward the hero.
      sparks.draw(SPARK.mote, x, y + lift + 0.3, z, 0.28, MEND, 0.8 + 0.2 * Math.sin(clock * 9), 1);
    }
    // A strike from range, by the healer or the booster: a short streak of light to the beast.
    if (c.strikeT > 0 && c.strikeT < 0.18 && c.def.range > 2) {
      const dx = c.struckX - x, dz = c.struckZ - z, d = Math.hypot(dx, dz);
      if (d > 0.3) ground.draw(MARK.line, x, y, z, Math.atan2(dx, -dz), d, 0.08, 1, role === 'healer' ? MEND : TEAL, 0.7 * (1 - c.strikeT / 0.18));
    }
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
        const look = hooks.blighted ? looks.beastOf(b.def.kind) : looks.of(b.def.kind);
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
      // Held by the vine: its ring stays tight around the feet, where the beast's body hides the vine itself.
      if (b.doing === 'held') ground.draw(MARK.ring, d.x, y, d.z, 0, r * 0.85 + 0.04 * Math.sin(clock * 23), 0.09, 1, VINE, 0.95);
      // Slowed by a burst: a cold ring at its feet, turning slowly, that fades as the slow runs out.
      if (b.slow > 0 && b.doing !== 'calmed') ground.draw(MARK.ring, d.x, y, d.z, clock * 0.8, r + 0.35, 0.06, 0.75, COLD, Math.min(1, b.slow) * 0.9);
      // Enraged: it breathes out puffs of ash.
      if (b.enraged && b.doing !== 'calmed' && b.doing !== 'asleep') {
        const left = (breaths.get(b.id) ?? 0) - dt;
        if (left <= 0) {
          const top = y + lift + f.height * 0.8, fx = dirX(b.facing), fz = dirZ(b.facing);
          for (let k = 0; k < 3; k++) sparks.spawn(SPARK.ash, d.x + fx * r * 0.7, top, d.z + fz * r * 0.7, fx * 0.8 + (k - 1) * 0.4, 0.9 + k * 0.2, fz * 0.8, 0.8, 0.12 + r * 0.06, ASH, -0.4, 1.2);
          breaths.set(b.id, b.doing === 'windup' ? 0.35 : 0.9);
        } else breaths.set(b.id, left);
      }
      if (b.doing === 'calmed' && d.calmOn && d.calmT < CALM.end + 2) calming.moment(b, d, f.height, dt);
      pips(b, d, y + lift + f.height, clock);
    }
  }

  /**
   * The marks of the staff's light: small pips over the beast's head, never a ring on the ground (that is the
   * hold of the Mark). The companion's strike spends them: they dive into the beast. Marks that run out float off.
   */
  function pips(b: BeastState, d: Drawn, top: number, clock: number): void {
    const yaw = view.camera.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw), y = top + 0.22;
    const at = (i: number, n: number): number => (i - (n - 1) / 2) * 0.32;
    if (b.marks < d.marks) {
      const struck = fight.companion.strikeT > 0;
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
    const y = floorOf();
    // The edge of the arena. The hall's wall is its own edge.
    if (!hall) ground.draw(MARK.ring, stage.center.x, y, stage.center.z, 0, stage.radius, 0.06, 1, PALE, 0.35);
    for (let i = 0; i < fight.shapes.length; i++) {
      const s = fight.shapes[i] as (typeof fight.shapes)[number];
      if (!s.live || hall?.own(s)) continue;
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
    for (let i = 0; i < fight.shots.length; i++) {
      const shot = fight.shots[i] as (typeof fight.shots)[number];
      if (!shot.live) continue;
      const sy = groundY(shot.x, shot.z), bx = shot.x - dirX(shot.facing), bz = shot.z - dirZ(shot.facing);
      if (shot.move.id === 'bolt') {
        // The staff's bolt: a ball of the Mark's light with a short tail, on the ground and in the air.
        ground.draw(MARK.circle, shot.x, sy, shot.z, 0, 0.28, 0, 1, TEAL, 1, 0.6);
        ground.draw(MARK.line, bx - dirX(shot.facing) * 0.1, sy, bz - dirZ(shot.facing) * 0.1, shot.facing, 1.1, 0.14, 1, TEAL, 0.6);
        sparks.draw(SPARK.mote, shot.x, sy + 0.9, shot.z, 0.4, TEAL, 1, 1);
      } else {
        // An arrow: a pale streak at the height of the hand, and its shadow. A drawn shot is longer and brighter.
        const long = shot.move.pierce ? 1.8 : 1.1;
        ground.draw(MARK.line, shot.x - dirX(shot.facing) * long, sy, shot.z - dirZ(shot.facing) * long, shot.facing, long, shot.move.pierce ? 0.16 : 0.09, 1, PALE, shot.move.pierce ? 0.95 : 0.7, shot.move.pierce ? 0.5 : 0);
        sparks.draw(SPARK.pip, shot.x, sy + 1, shot.z, shot.move.pierce ? 0.3 : 0.2, PALE, 1, 1);
      }
      if (shot.strong) sparks.draw(SPARK.mote, shot.x, sy + 1, shot.z, 0.5, STRONG, 0.9, 1);
    }
    const p = view.playerPosition;
    ground.draw(MARK.shadow, p.x, groundY(p.x, p.z), p.z, 0, 0.5, 0, 0, SHADE, 0.5);

    // The rig in the hand: where it would stand, and how far the hero can reach.
    const held = keys.held;
    if (held && fight.way === 'world') {
      const cx = Math.floor(fight.input.aimX) + 0.5, cz = Math.floor(fight.input.aimZ) + 0.5, why = fight.canPlace(held, cx, cz);
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
    } else if (held) {
      // A kit thing in the hand, in a world fight: where it would stand, and how far the hero can reach.
      const cx = Math.floor(fight.input.aimX) + 0.5, cz = Math.floor(fight.input.aimZ) + 0.5, why = fight.canPlace(held, cx, cz);
      rigViews.ghost(held, cx, groundY(cx, cz), cz, true, why === null);
      ground.draw(MARK.cell, cx, groundY(cx, cz), cz, 0, 0.5, 0, 0, why === null ? TEAL : RED, 0.9);
      ground.draw(MARK.ring, p.x, groundY(p.x, p.z), p.z, 0, KIT_FIGHT.reach, 0.04, 1, PALE, 0.4);
      if (held === 'lamp_post_kit') ground.draw(MARK.ring, cx, groundY(cx, cz), cz, 0, KIT_FIGHT.lampRadius, 0.05, 1, TEAL, 0.5);
      if (held === 'clapper_kit') ground.draw(MARK.ring, cx, groundY(cx, cz), cz, 0, KIT_FIGHT.clapReach, 0.04, 1, PALE, 0.35);
    } else {
      rigViews.ghost(null, 0, 0, 0, true, true);
    }
    // A lamp's light, the reach of the plate's hand spring, and a ring that shows where the vine lies. A vine that
    // went off pulls its ring tight as it goes.
    for (let i = 0; i < fight.rigs.length; i++) {
      const rig = fight.rigs[i] as (typeof fight.rigs)[number], ry = groundY(rig.x, rig.z);
      if (rig.kind === 'snare') {
        const k = rig.armed ? 0 : Math.min(1, rig.spent / 0.5);
        if (k < 1) {
          ground.draw(MARK.ring, rig.x, ry, rig.z, 0, 0.62 - 0.35 * k, 0.07, 1, VINE, 0.9 * (1 - k));
          ground.draw(MARK.circle, rig.x, ry, rig.z, 0, 0.62 - 0.35 * k, 0, 0, VINE, 0.22 * (1 - k));
        }
      }
      if (!rig.armed) continue;
      if (rig.kind === 'lamp') ground.draw(MARK.circle, rig.x, ry, rig.z, 0, 1.4, 0, 0, TEAL, 0.5);
      else if (rig.kind === 'lamp_post_kit') ground.draw(MARK.circle, rig.x, ry, rig.z, 0, KIT_FIGHT.lampRadius, 0, 0, PALE, 0.28 + 0.05 * Math.sin(clock * 3));
      else if (rig.kind === 'slick_patch') ground.draw(MARK.circle, rig.x, ry, rig.z, 0, 0.8, 0, 0, COLD, 0.55);
      else if (rig.kind === 'quill_strip') ground.draw(MARK.cell, rig.x, ry, rig.z, 0, 0.5, 0, 0, PALE, 0.7);
      else if (rig.kind === 'plate') ground.draw(MARK.ring, rig.x, ry, rig.z, 0, RIG.hand, 0.03, 1, PALE, 0.25);
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
      drawCompanion(dt);
      drawBeasts(dt);
      hooks.extra?.(ground, sparks, groundY, dt, clock);
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
    show(on) {
      heroFigure.visible = on;
      companionFigure.visible = on;
      if (on) return;
      for (const g of ghosts) g.visible = false;
      for (const d of drawn.values()) d.figure.remove();
      drawn.clear();
      ground.begin();
      ground.end();
      sparks.begin();
      sparks.end(0);
      rigViews.sync([], groundY);
      rigViews.ghost(null, 0, 0, 0, true, true);
      figures.update(0);
      view.hero.actor.visible = true;
    },
  };
}
