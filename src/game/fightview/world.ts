// A fight in the world, drawn and played where it starts: the fight lab's keys, feel and picture on the stage the
// fights system made from the ground there (`src/game/fights`), with the world's HUD in place of the lab's card.
//
// The lab's parts each hold one fight for their life. The world has a new fight each time, so they are given a
// fight and a stage that stand in for whichever is running (`follow`): the running one, or an empty fight
// between them. The keys and the hero's body are the fight's only while one runs (`keys.use`). Between fights
// nothing here draws, and the hero is the game's own.
//
// What the lab does not draw, this draws: a keeper's body and its gates, lamps and heart, and the vines round a
// held companion. The Stag's hall uses the lab's own hall view.
import type { RunningFight, Systems } from '../api.sim.ts';
import { KEEPERS } from '../content/fight.ts';
import type { KitId } from '../content/ids.ts';
import { arenaStage, type Stage } from '../fight/arena.sim.ts';
import { createFight, type Fight, type FightEvent } from '../fight/fight.sim.ts';
import type { Keeper } from '../fight/keepers.sim.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { createDraw, heightOf } from './draw.ts';
import { createFeel } from './feel.ts';
import type { Figure } from './figures.ts';
import { MARK } from './ground.ts';
import { createHallView, type HallView } from './hall.ts';
import { createKeys } from './keys.ts';
import { GOLD, PALE, TEAL } from './looks.ts';
import { createWorldHud } from './world-hud.ui.ts';

/** What the world's fights give a test through `window.__fights`. */
export interface WorldFightsDoor {
  /** The running fight's state as plain data, or null. */
  state(): Record<string, unknown> | null;
  /** Each of the twelve: armed, won, denied, where. */
  fights(): unknown;
  /** Starts fight n where the hero stands. */
  begin(n: number): boolean;
  /** The rule-made player fights the running fight, or hands it back. */
  autoplay(level: 'perfect' | 'middle' | 'clumsy' | null): void;
  /** Where a point of the ground is on the page. */
  screen(x: number, z: number): { x: number; y: number } | null;
  /** How each fight that ended came out, in order. */
  ended(): { fight: number; result: string }[];
}

declare global {
  interface Window {
    __fights?: WorldFightsDoor;
  }
}

/** The camera goes at least this far out while a fight runs, so a charge's whole line is in view. */
const FIGHT_ZOOM = 3;

export function createWorldFights(view: GameView): void {
  const { game } = view;
  const sys = game.systems as Partial<Systems>;
  const api = sys.fights;
  if (!api?.running || !api.drive) return;
  api.drive(true);
  const book = bookOf(view);
  const groundY = heightOf(view);

  // ---------------------------------------------------------------- the stand-ins for whichever fight runs
  const idleStage = arenaStage(0, 0);
  const idle = createFight(idleStage, { way: 'hero' });
  let fight: Fight = idle, stage: Stage = idleStage;
  const follow = <T extends object>(get: () => T): T => new Proxy({} as T, {
    get(_, key) {
      const target = get() as Record<string | symbol, unknown>, value = target[key];
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
    set(_, key, value) { (get() as Record<string | symbol, unknown>)[key] = value; return true; },
  });
  const fightNow = follow(() => fight), stageNow = follow(() => stage);

  let run: RunningFight | null = null;
  const hud = createWorldHud(view.root, book.art);
  const say = (text: string): void => hud.say(text);
  const feel = createFeel(view, fightNow, { say, groundY, nearest: (x, z) => draw.nearest(x, z) });
  const keys = createKeys(view, fightNow, {
    feel, say, groundY, weapon: () => {},
    // The world's step: the rules, the keeper or the hall, and what the world makes of it.
    step: (dt) => { run?.step(dt); },
    // 1, 2 and 3 are the kit: a thing to set down goes in the hand, a salve is used at once.
    slot(index) {
      if (!run) return true;
      if (run.practice) return true;
      const kind = run.fight.kitSlots()[index] ?? null;
      if (!kind) { say('That slot of your kit is empty.'); return true; }
      if (kind === 'salve') { const why = run.fight.useKit(index); if (why) say(why); return true; }
      keys.held = keys.held === kind ? null : kind;
      return true;
    },
    // In the Wild Harvester's vault, C sends the companion to hold the arm.
    skill() { return run?.practice || (run?.keeper?.kind === 'harvester' ? run.keeper.hold() || true : false); },
    calm: () => !run?.practice,
  });
  const draw = createDraw(view, fightNow, stageNow, () => groundY(stage.center.x, stage.center.z), keys, feel, {
    label: (text, at, alpha) => hud.label(text, at, alpha),
    blighted: true,
    companion: () => !run?.practice,
    extra(ground, _sparks, gy, _dt, clock) {
      const f = run?.fight;
      if (!f) return;
      // The vines round a held companion, and any other part to hit that a keeper has.
      for (const t of f.targets) {
        if (t.broken || !t.open) continue;
        const y = gy(t.x, t.z), k = t.guard / t.full;
        if (t.name === 'vines') ground.draw(MARK.ring, t.x, y, t.z, clock, t.radius + 0.2, 0.12, k, TEAL.clone().setRGB(0.78, 1.05, 0.3), 0.95);
        else if (t.name === 'heart') ground.draw(MARK.ring, t.x, y, t.z, 0, t.radius + 0.4 + 0.08 * Math.sin(clock * 8), 0.1, k, GOLD, 0.95, 0.4);
        else ground.draw(MARK.ring, t.x, y, t.z, 0, t.radius + 0.25, 0.08, k, PALE, 0.85);
      }
      if (run?.keeper) drawKeeper(run.keeper, ground, gy, clock);
    },
  });
  draw.show(false);

  // ---------------------------------------------------------------- a keeper's body and its room's parts
  let keeperFigure: Figure | null = null;
  let keeperShown: Keeper | null = null;
  // Keep the stand-in keepers at their existing size when the field gearling is rescaled.
  const KEEPER_LOOK: Record<Keeper['kind'], { sheet: string; scale: number; tint: [number, number, number] }> = {
    sluice: { sheet: 'gearling', scale: 1.9 * 1.55 / 1.3, tint: [0.75, 0.9, 1.05] },
    lamplighter: { sheet: 'gearling', scale: 1.6 * 1.55 / 1.3, tint: [1.25, 1.05, 0.6] },
    harvester: { sheet: 'rootsnare', scale: 1.8, tint: [0.85, 1, 0.75] },
  };
  function drawKeeper(k: Keeper, ground: Parameters<NonNullable<Parameters<typeof createDraw>[6]['extra']>>[0], gy: (x: number, z: number) => number, clock: number): void {
    if (keeperShown !== k) {
      keeperFigure?.remove();
      const look = KEEPER_LOOK[k.kind];
      keeperFigure = draw.figures.add(look.sheet);
      keeperFigure.scale = look.scale;
      keeperFigure.tint.setRGB(...look.tint);
      keeperShown = k;
    }
    const f = keeperFigure as Figure, b = k.body;
    f.visible = true;
    f.place(b.x, gy(b.x, b.z), b.z);
    f.face(b.facing);
    f.play(KEEPER_LOOK[k.kind].sheet, b.doing === 'roll' ? 'walk' : 'idle');
    f.warm = b.doing === 'windup' && b.until - b.t < 0.25 ? 1 : 0;
    f.drained = b.doing === 'down' ? 0 : 0.35;
    f.roll = b.doing === 'stalled' || b.doing === 'blinded' || b.doing === 'held' ? 0.12 * Math.sin(clock * 12) : 0;
    ground.draw(MARK.shadow, b.x, gy(b.x, b.z), b.z, 0, 1.6, 0, 0, PALE.clone().multiplyScalar(0.05), 0.5);
    // Flooded channels and lit lamps: the room's rule, shown on the floor.
    for (const [i, c] of (k.room.channels ?? []).entries()) {
      const wet = k.flooded(i);
      for (const cell of c.cells) ground.draw(MARK.cell, cell.x, gy(cell.x, cell.z), cell.z, 0, 0.5, 0, 0, wet > 0 ? TEAL.clone().setRGB(0.55, 0.8, 1.15) : PALE, wet > 0 ? 0.75 : 0.25);
    }
    for (const [i, p] of (k.room.lamps ?? []).entries()) {
      if (k.lit(i) > 0) ground.draw(MARK.circle, p.x, gy(p.x, p.z), p.z, 0, 1.2, 0, 0, TEAL, 0.6 + 0.1 * Math.sin(clock * 5));
    }
    if (b.doing === 'held') ground.draw(MARK.ring, b.x, gy(b.x, b.z), b.z, 0, KEEPERS.harvester.radius + 0.5, 0.1, 1, TEAL, 0.9);
  }

  // ---------------------------------------------------------------- the Stag's hall
  let hallView: HallView | null = null;
  let hallShown: RunningFight['hall'] = null;

  // ---------------------------------------------------------------- a fight starts and ends
  /** Actors of the companion's person or pet, hidden while it fights as a figure. */
  const hidden: string[] = [];
  let zoomBefore = -1;

  function begin(next: RunningFight): void {
    run = next;
    if (next.practice) sys.opening?.drivePractice(true);
    fight = next.fight;
    stage = next.stage;
    keys.use(true);
    draw.show(true);
    // The body goes where the rules have the hero, when the fight put them at the circle's edge.
    const h = fight.hero, p = view.playerPosition;
    if (Math.hypot(h.x - p.x, h.z - p.z) > 1) view.hero.teleport(h.x, groundY(h.x, h.z), h.z, 0);
    if (view.camera.zoom < FIGHT_ZOOM) { zoomBefore = view.camera.zoom; view.camera.zoomBy(FIGHT_ZOOM - view.camera.zoom); }
    hideCompanion();
  }

  function hideCompanion(): void {
    if (run?.practice) return;
    const kind = run?.fight.companion.def.kind;
    if (!kind) return;
    for (const [id, actor] of game.actors) {
      const mine = id === `npc:${kind}` || id === `stage:${kind}` || (kind === 'fox' && id.startsWith('pet:leaftail'));
      if (!mine || !actor.visible) continue;
      actor.visible = false;
      if (!hidden.includes(id)) hidden.push(id);
    }
  }

  function end(): void {
    if (run?.practice) sys.opening?.drivePractice(false);
    run = null;
    fight = idle;
    stage = idleStage;
    keys.use(false);
    draw.show(false);
    hud.hide();
    keeperFigure?.remove();
    keeperFigure = null;
    keeperShown = null;
    // The Stag's hall goes with its fight.
    const hallGroup = view.scene.getObjectByName('stag-hall');
    if (hallGroup) view.scene.remove(hallGroup);
    hallView = null;
    hallShown = null;
    for (const id of hidden) { const actor = game.actors.get(id); if (actor) actor.visible = true; }
    hidden.length = 0;
    if (zoomBefore >= 0) { view.camera.zoomBy(zoomBefore - view.camera.zoom); zoomBefore = -1; }
  }

  // ---------------------------------------------------------------- one frame
  let clock = 0;
  const hear = feel.hear;
  feel.hear = (e: FightEvent) => { hear(e); hallView?.hear(e); };
  view.onFrame((dt) => {
    const next = view.started ? api.running?.() ?? sys.opening?.practice() ?? null : null;
    if (next !== run) {
      if (run) end();
      if (next) begin(next);
    }
    if (!run) return;
    clock += dt;
    hideCompanion();
    if (run.hall && hallShown !== run.hall) {
      const c = run.stage.center;
      hallView = createHallView(view, run.fight, run.hall, Math.floor(c.x), groundY(c.x, c.z), Math.floor(c.z), feel, undefined, draw.sparks);
      hallShown = run.hall;
    }
    keys.aim();
    feel.frame(dt);
    draw.frame(dt, clock);
    hallView?.frame(dt, clock);
    hud.update(run, sys.hall?.heart().level ?? 0, keys.held as KitId | null, draw.beastAt);
  });
  // The Stag's hall steps after the fight, as in the lab.
  view.onSimStep(() => { if (run?.hall) hallView?.afterStep(); });

  const endings: { fight: number; result: string }[] = [];
  game.events.on('fight.ended', (e) => { endings.push({ fight: e.fight, result: e.result }); });
  window.__fights = {
    ended: () => endings,
    state() {
      if (!run) return null;
      const f = run.fight, h = f.hero;
      return {
        n: run.n, practice: run.practice ?? false, over: run.over, phase: f.phase, clock: run.keeper?.clock ?? run.hall?.clock ?? f.clock, line: run.line, companion: run.practice ? null : f.companion.def.kind, mode: f.companion.mode,
        targets: f.targets.map(t => ({ name: t.name, x: t.x, z: t.z, guard: t.guard, full: t.full, broken: t.broken })),
        hero: { x: h.x, z: h.z, health: h.health, maxHealth: f.maxHealth, stamina: h.stamina, act: h.act, weapon: h.weapon },
        beasts: f.beasts.map((b) => ({ kind: b.def.kind, depth: b.depth, doing: b.doing, guard: b.guard, full: b.full, x: b.x, z: b.z })),
        keeper: run.keeper ? { kind: run.keeper.kind, doing: run.keeper.body.doing, heart: run.keeper.heart.guard, open: run.keeper.heart.open, won: run.keeper.won } : null,
        kit: f.kitSlots(), held: keys.held, center: run.stage.center, radius: run.stage.radius,
        figures: draw.figures.count, record: { ...f.record },
      };
    },
    fights: () => api.states?.() ?? [],
    begin: (n) => api.begin?.(n as never) ?? false,
    autoplay: (level) => api.autoplay?.(level),
    screen(x, z) { const at = view.project(x, groundY(x, z) + 0.4, z); return at ? { x: at.x, y: at.y } : null; },
  };
}
