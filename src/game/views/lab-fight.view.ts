// The fight lab: `?scene=fight` in the address opens the game in a round meadow on the player's plot, with a
// pond, a rock wall and three trees, where three ways of fighting can be played against the same beasts. It
// skips the title and keeps its own save. A card picks the way and the beast, and after each fight the lab
// asks "Again?" and keeps the answer with the fight's numbers.
//
// The rules are `src/game/fight`. This file is the glue: the flag, the arena, making the fight, the order of a
// frame and the door. The rest is `src/game/fightview`: `keys.ts` reads the keys and the mouse and steps the
// fight with the hero's body, `feel.ts` turns the fight's events into freezes, jolts, sparks and sounds,
// `looks.ts` picks each fighter's pose and stand-in, and `draw.ts` places the fighters and the marks on the
// ground. `docs/fight-lab.md` says how the parts fit.
//
// `window.__fight` is the lab's door for tests: the fight itself, `bot(true)` to let the rule-made player
// fight, and `state()` for plain data.
//
// `?scene=stag` opens the same lab in the Verdant Stag's hall instead: the first boss test (`fight/hall.sim.ts`,
// `fightview/hall.ts`). Everything for it here is in blocks marked "the Stag's hall".
//
// Without `?scene=fight` or `?scene=stag` this file does nothing.
import type * as THREE from 'three';
import { WAYS, type Way } from '../content/fight.ts';
import type { Systems } from '../api.sim.ts';
import { arenaStage } from '../fight/arena.sim.ts';
import { createBot } from '../fight/bot.sim.ts';
import { createFight, type Fight, type FightRecord } from '../fight/fight.sim.ts';
import { dressArena, stampArena } from '../fightview/arena.ts';
import { CALM } from '../fightview/calm.ts';
import { createDraw, heightOf } from '../fightview/draw.ts';
import { createFeel } from '../fightview/feel.ts';
import { createKeys } from '../fightview/keys.ts';
import { createLog, type LoggedFight } from '../fightview/log.ts';
import { createPanel, type PanelActions } from '../fightview/panel.ui.ts';
// The Stag's hall.
import { HERO_STEP } from '../../features/hero/index.ts';
import { createHall, createHallBot, type Hall } from '../fight/hall.sim.ts';
import { hallStage } from '../fight/hall-layout.sim.ts';
import { createHallView, dressHall, stampHall, type HallView } from '../fightview/hall.ts';
import { createHallLine } from '../fightview/hall.ui.ts';
import { clearSave } from '../shell/save.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';

const FLAG = 'lab.fight';
const STORE = 'lab.fight.setup';

/** What the door hands a test. */
interface FightDoor {
  fight: Fight;
  /** The Stag's hall's rules, with `?scene=stag`. Null in the meadow. */
  readonly hall: Hall | null;
  /** Lets the rule-made player fight, or hands the keys back. `layout` is the world way's: `rigs` or `wall`. */
  bot(on: boolean, layout?: 'rigs' | 'wall'): void;
  state(): Record<string, unknown>;
  /** The fights that ended, with their answers. */
  log(): readonly LoggedFight[];
  /** Which art is a stand-in right now. */
  standIns(): string[];
  /** Where a point of the ground is on the page, for a test that clicks it. Null when it is out of view. `y` puts the point at that height instead: the top of the Stag's vines. */
  screen(x: number, z: number, y?: number): { x: number; y: number } | null;
  /** The walking keys that take the hero toward a point, with the camera as it stands: some of `KeyW`, `KeyA`, `KeyS`, `KeyD`. */
  keysToward(x: number, z: number): string[];
  /** True holds the rules still while the picture goes on, so a test can set a fighter's state and look at its pose. */
  hold(on: boolean): void;
  /** Plays the picture's own clocks (poses, the calming, flashes) this much slower than the rules, for a strip of screenshots. 1 is normal. */
  slow(scale: number): void;
  /** Turns the game's reduce motion setting on or off. It is stored, as the settings screen stores it. */
  reduceMotion(on: boolean): void;
}

declare global {
  interface Window {
    __fight?: FightDoor;
  }
}

export function install(view: GameView): void {
  const params = new URLSearchParams(location.search);
  // ---- the Stag's hall: its own scene name, and so its own save
  const inHall = params.get('scene') === 'stag';
  if (params.get('scene') !== 'fight' && !inHall) return;
  // ---- end of the Stag's hall
  bookOf(view);
  const { game } = view;
  const sys = game.systems as Partial<Systems>;

  if (sessionStorage.getItem('lab.fight.reset')) {
    sessionStorage.removeItem('lab.fight.reset');
    clearSave();
  }

  // ---------------------------------------------------------------- the arena and the fight
  const middle = sys.region?.place('grant.center').at ?? game.player.pos;
  const ox = Math.floor(middle.x), oy = Math.floor(middle.y), oz = Math.floor(middle.z);
  const stage = inHall ? hallStage(ox, oz) : arenaStage(ox, oz);
  const groundY = heightOf(view);
  const log = createLog();
  let stored: { way?: Way; pet?: string; gentle?: boolean; shake?: boolean } = {};
  try { stored = JSON.parse(localStorage.getItem(STORE) ?? '{}') as typeof stored; } catch { /* the defaults stand */ }
  const asked = WAYS.find((way) => way === params.get('way'));
  /**
   * The fight that ended last, waiting for its end to play out before the lab asks about it, and the encounter it
   * belonged to: the beast in the meadow, the hall's round in the hall.
   */
  let ended: LoggedFight | null = null, askIn = 0, endedEncounter = -1;
  const encounter = (): number => (hall ? hall.round : fight.beasts[0]?.id ?? -1);
  const onEnd = (record: FightRecord): void => {
    const logged = log.add(record);
    // "Again?" waits for the end to play out: the moment of calming, or the Stag's longer end (the freeze, the
    // chains, the grey running out, the head lowered).
    if (record.result === 'calmed') { ended = logged; askIn = record.way === 'stag' ? 6 : CALM.end + 0.2; endedEncounter = encounter(); }
  };
  const fight = createFight(stage, {
    way: inHall ? 'hero' : asked ?? (WAYS.includes(stored.way as Way) ? stored.way : 'hero'),
    pet: stored.pet,
    gentle: stored.gentle,
    external: true,
    random: () => game.random(),
    onEnd,
  });
  const keep = (): void => {
    try { localStorage.setItem(STORE, JSON.stringify({ way: fight.way, pet: fight.pet.def.kind, gentle: fight.gentle, shake: feel.shakes })); } catch { /* it holds for this visit */ }
  };

  /**
   * A new way or pet starts the encounter again: the beast comes back asleep, and the hero to the start. A fight
   * in progress ends as left, and the lab says so.
   */
  function change(what: 'way' | 'pet', apply: () => void): void {
    const beast = fight.beasts[0], kind = beast && beast.doing !== 'calmed' ? beast.def.kind : '';
    const fighting = fight.phase === 'fight';
    keys.held = null;
    apply();
    keep();
    if (kind) bring(kind);
    if (fighting) say(`A new ${what} ended the fight. It is in the log as left, and the ${kind} is back asleep.`, 3500);
  }

  const actions: PanelActions = {
    setWay(way) { if (way !== fight.way) change('way', () => fight.setWay(way)); },
    bring(kind) { bring(kind); },
    wake() { fight.wake(); },
    clear() { keys.held = null; fight.clear(); },
    setGentle(on) { fight.setGentle(on); keep(); },
    setShake(on) { feel.shakes = on; keep(); },
    shaking: () => feel.shakes,
    setPet(kind) { if (kind !== fight.pet.def.kind) change('pet', () => fight.setPet(kind)); },
    setQuality(mode) { view.settings.setQuality(mode); },
    pickRig(kind) { keys.held = kind; },
    again(logged) {
      if (logged.way === 'stag') return;
      if (logged.way !== fight.way) fight.setWay(logged.way);
      if (logged.pet !== fight.pet.def.kind) fight.setPet(logged.pet);
      keep();
      bring(logged.enemy);
    },
  };
  // ---- the Stag's hall: the hall is fought the hero's way, has no beasts to bring, and "Again?" starts it over
  let hall: Hall | null = null, hallView: HallView | null = null;
  if (inHall) {
    const hallOnly = (): void => say('The hall is its own fight. "Back to the meadow" has the beasts.');
    actions.setWay = (way) => { if (way !== 'hero') say('The hall is fought the hero\'s way.'); };
    actions.bring = hallOnly;
    actions.wake = hallOnly;
    actions.clear = () => restartHall();
    actions.again = () => restartHall();
  }
  function restartHall(): void {
    if (!hall) return;
    hall.restart();
    view.hero.teleport(stage.start.x, groundY(stage.start.x, stage.start.z), stage.start.z, 0);
    fight.placeHero(stage.start.x, stage.start.z);
  }
  // ---- end of the Stag's hall
  const panel = createPanel(view.root, log, actions);
  const say = (text: string, ms?: number): void => panel.say(text, ms);
  const feel = createFeel(view, fight, { say, groundY, nearest: (x, z) => draw.nearest(x, z) });
  feel.shakes = stored.shake !== false;
  const keys = createKeys(view, fight, { feel, say, groundY });
  const draw = createDraw(view, fight, stage, oy, keys, feel, { label: (text, at, alpha) => panel.label(text, at, alpha) });

  function bring(kind: string): void {
    keys.held = null;
    fight.bring(kind);
    // Back to the start, so every fight opens the same way.
    view.hero.teleport(stage.start.x, groundY(stage.start.x, stage.start.z), stage.start.z, 0);
    fight.placeHero(stage.start.x, stage.start.z);
  }

  // ---------------------------------------------------------------- setting up
  function setUp(): void {
    window.__game?.teleport(stage.start.x, stage.start.z);
    // ---- the Stag's hall: stamped every time it opens, so a ramp left in the save never stands at the start
    if (inHall) {
      stampHall(view, ox, oy, oz);
      sys.time?.setTimeOfDay(0.42);
      sys.time?.setWeather('clear', true);
      dressHall(view, ox, oy, oz);
      hall = createHall(fight, stage as ReturnType<typeof hallStage>, { random: () => game.random(), onEnd });
      hallView = createHallView(view, fight, hall, ox, oy, oz, feel, (hour) => sys.time?.setTimeOfDay(hour));
      const line = createHallLine(view.root);
      hallFrame = (dt, now) => { hallView?.frame(dt, now); if (hall) line.update(hall, hallView?.lastHit ?? null); };
      // The hall steps right after the fight, on every step of the body the fight steps on.
      const steer = view.hero.steer;
      view.hero.steer = (wish, body) => {
        const frozen = feel.freeze > 0;
        steer?.(wish, body);
        if (!keys.ready || frozen || !hall) return;
        hall.step(HERO_STEP);
        hallView?.afterStep();
      };
      // A hit on a target is felt as a hit on a beast is.
      const hear = feel.hear;
      feel.hear = (e) => { hear(e); hallView?.hear(e); };
      view.hero.teleport(stage.start.x, oy, stage.start.z, 0);
      fight.placeHero(stage.start.x, stage.start.z);
      // As far out as the camera goes: the Stag is the room (research note 08, section 4: pull the camera back).
      for (let i = 0; i < 6; i++) view.camera.zoomBy(1);
      return;
    }
    // ---- end of the Stag's hall
    if (!game.flags.is(FLAG)) {
      stampArena(view, ox, oy, oz);
      sys.time?.setTimeOfDay(0.42);
      sys.time?.setWeather('clear', true);
      game.flags.set(FLAG, true);
    }
    void dressArena(view, ox, oy, oz).catch((error: unknown) => console.warn('[fight lab] the arena could not be dressed:', error));
    view.hero.teleport(stage.start.x, oy, stage.start.z, 0);
    fight.placeHero(stage.start.x, stage.start.z);
    // Far enough out that most of the arena is in view: a charge is 12 blocks long (research note 05: fight at zoom step 2 or farther).
    if (view.camera.zoom < 3) view.camera.zoomBy(3 - view.camera.zoom);
    const first = params.get('beast');
    if (first) bring(first);
  }

  // ---------------------------------------------------------------- one frame
  let clock = 0;
  let started = false;
  /** The Stag's hall's drawing, once a frame. */
  let hallFrame: ((dt: number, now: number) => void) | null = null;
  view.onFrame((frameDt) => {
    const dt = frameDt * keys.slow;
    if (!view.started) {
      // The title holds the start. The lab goes straight in: its own save when there is one, a new game otherwise.
      if (!started) { started = true; if (!view.continueGame()) view.newGame(); }
      return;
    }
    if (!keys.ready) {
      keys.ready = true;
      setUp();
      const beam = view.scene.getObjectByName('waypoint-beam') as THREE.Mesh | undefined;
      if (beam) (beam.material as THREE.Material).visible = false;
    }
    clock += dt;
    keys.aim();
    feel.frame(dt);
    draw.frame(dt, clock);
    hallFrame?.(dt, clock);
    // A fight that was followed by another before the lab asked is not asked about.
    if (ended && encounter() !== endedEncounter) ended = null;
    if (ended && (askIn -= dt) <= 0) { panel.ask(ended); ended = null; }
    panel.update(fight, keys.held, view.settings.quality, draw.beastAt);
  });

  // ---------------------------------------------------------------- the door
  window.__fight = {
    fight,
    bot(on, layout) { keys.bot = !on ? null : hall ? createHallBot(fight, hall) : createBot(fight, stage, { layout }); },
    get hall() { return hall; },
    state() {
      const h = fight.hero, b = fight.beasts[0];
      return {
        way: fight.way, phase: fight.phase, clock: fight.clock, gentle: fight.gentle,
        hero: { x: h.x, z: h.z, health: h.health, stamina: h.stamina, act: h.act },
        pet: { kind: fight.pet.def.kind, mode: fight.pet.mode, hearts: fight.pet.hearts, x: fight.pet.x, z: fight.pet.z },
        beast: b ? { kind: b.def.kind, doing: b.doing, guard: b.guard, x: b.x, z: b.z, calm: b.calm, marks: b.marks, moment: draw.momentOf(b) } : null,
        rigs: fight.rigs.map((r) => ({ kind: r.kind, x: r.x, z: r.z, armed: r.armed })),
        shapes: fight.shapes.filter((s) => s.live).length,
        record: { ...fight.record },
        held: keys.held,
        shaken: feel.shaken,
        figures: draw.figures.count,
        marks: draw.ground.count,
        // The Stag's hall.
        hall: hall ? {
          phase: hall.phase, clock: hall.clock, freed: hall.freed, stag: hall.stag.doing, attack: hall.stag.attack, onRamp: hall.onRamp(),
          pins: hall.pins.filter((p) => p.broken).length, lamps: hall.lamps.filter((l) => l.broken).length, pods: hall.pods.length,
          collar: { open: hall.collar.open, guard: hall.collar.guard }, record: hall.record(), freedFor: hallView?.freedFor ?? -1,
          heroY: view.playerPosition.y, floor: oy, triangles: hallView?.triangles() ?? 0,
        } : null,
      };
    },
    log: () => log.all(),
    keysToward(x, z) {
      const yaw = view.camera.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const dx = x - fight.hero.x, dz = z - fight.hero.z, d = Math.hypot(dx, dz) || 1;
      const forward = (dx * fx + dz * fz) / d, right = (-dx * fz + dz * fx) / d;
      const keys: string[] = [];
      if (forward > 0.38) keys.push('KeyW'); else if (forward < -0.38) keys.push('KeyS');
      if (right > 0.38) keys.push('KeyD'); else if (right < -0.38) keys.push('KeyA');
      return keys;
    },
    screen(x, z, y) {
      const at = view.project(x, y ?? groundY(x, z) + 0.4, z);
      return at ? { x: at.x, y: at.y } : null;
    },
    standIns: () => draw.looks.standIns(),
    hold(on) { keys.paused = on; },
    slow(scale) { keys.slow = Math.max(0.01, Math.min(1, scale)); },
    reduceMotion(on) { view.settings.setGraphics({ reduceMotion: on }); },
  };
}
