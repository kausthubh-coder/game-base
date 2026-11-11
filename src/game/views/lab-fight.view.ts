// The fight lab: `?scene=fight` in the address opens the game in a round meadow on the player's plot, with a
// pond, a rock wall and three trees, where three ways of fighting can be played against the same beasts. It
// skips the title and keeps its own save. A card picks the way and the beast, and after each fight the lab
// asks "Again?" and keeps the answer with the fight's numbers.
//
// The rules are `src/game/fight`. This file is the glue: it reads the keys and the mouse into the fight's
// input, steps the fight with the hero's body 60 times a second, moves the body as the fight says (a dodge, a
// push, a faint), and draws the fighters, the shapes on the ground, the rigs and the interface.
//
// Stand-in art. Until the real sheets are in the manifest, every beast is the mossling's sheet at another
// size and tint, the hero cuts with the farm tool's swing, and the hero's other moves are the idle frame
// squashed and tinted. `LOOKS` below says which. Teal for the player's magic, gold for an enemy's attack
// and grey for a drained beast are the plan's suggestion (design/21-look-sound-feel.md), not a decided look.
//
// `window.__fight` is the lab's door for tests: the fight itself, `bot(true)` to let the rule-made player
// fight, and `state()` for plain data.
//
// Without `?scene=fight` this file does nothing.
import * as THREE from 'three';
import { HERO, PET, RIG, RIGS, SHAPE_AFTER, WAYS, type RigKind, type Way } from '../content/fight.ts';
import { HERO_STEP, type HeroBody, type HeroInput } from '../../features/hero/index.ts';
import type { Systems } from '../api.sim.ts';
import { ARENA, arenaStage } from '../fight/arena.sim.ts';
import { createBot, type Bot } from '../fight/bot.sim.ts';
import { createFight, type BeastState, type Fight, type FightEvent } from '../fight/fight.sim.ts';
import { dirX, dirZ } from '../fight/shapes.sim.ts';
import { dressArena, stampArena } from '../fightview/arena.ts';
import { createFigures, type Figure } from '../fightview/figures.ts';
import { MARK, createGround } from '../fightview/ground.ts';
import { createLog, type LoggedFight } from '../fightview/log.ts';
import { createPanel } from '../fightview/panel.ui.ts';
import { createRigViews } from '../fightview/rigs.ts';
import { clearSave } from '../shell/save.ts';
import type { GameView, ScreenPoint } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';

const FLAG = 'lab.fight';
const STORE = 'lab.fight.setup';

/** The stand-in lights: the player's magic, an enemy's attack, and the plain marks. */
const TEAL = new THREE.Color(0.25, 0.95, 0.82), GOLD = new THREE.Color(1, 0.72, 0.2), HOT = new THREE.Color(1, 0.42, 0.16);
const PALE = new THREE.Color(1, 0.97, 0.86), SHADE = new THREE.Color(0.05, 0.07, 0.05), WHITE = new THREE.Color(1, 1, 1), RED = new THREE.Color(1, 0.4, 0.3);

/** How a fighter is drawn: the sheet it walks and stands in, the sheet of its fight poses when there is one, its size and its tint. */
interface Look {
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

/** What the door hands a test. */
interface FightDoor {
  fight: Fight;
  /** Lets the rule-made player fight, or hands the keys back. `layout` is the world way's: `rigs` or `wall`. */
  bot(on: boolean, layout?: 'rigs' | 'wall'): void;
  state(): Record<string, unknown>;
  /** The fights that ended, with their answers. */
  log(): readonly LoggedFight[];
  /** Which art is a stand-in right now. */
  standIns(): string[];
  /** Where a point of the ground is on the page, for a test that clicks it. Null when it is out of view. */
  screen(x: number, z: number): { x: number; y: number } | null;
  /** The walking keys that take the hero toward a point, with the camera as it stands: some of `KeyW`, `KeyA`, `KeyS`, `KeyD`. */
  keysToward(x: number, z: number): string[];
}

declare global {
  interface Window {
    __fight?: FightDoor;
  }
}

/** What a hit leaves on a fighter for a moment: a white flash, a shake, a squash. Each runs down to 0. */
interface Jolt { flash: number; shake: number; squash: number }
const jolt = (): Jolt => ({ flash: 0, shake: 0, squash: 0 });

export function install(view: GameView): void {
  const params = new URLSearchParams(location.search);
  if (params.get('scene') !== 'fight') return;
  bookOf(view);
  const { game } = view;
  const sys = game.systems as Partial<Systems>;
  const lens = view.ctx.camera;

  if (sessionStorage.getItem('lab.fight.reset')) {
    sessionStorage.removeItem('lab.fight.reset');
    clearSave();
  }

  // ---------------------------------------------------------------- the arena and the fight
  const middle = sys.region?.place('grant.center').at ?? game.player.pos;
  const ox = Math.floor(middle.x), oy = Math.floor(middle.y), oz = Math.floor(middle.z);
  const stage = arenaStage(ox, oz);
  const log = createLog();
  let stored: { way?: Way; pet?: string; gentle?: boolean } = {};
  try { stored = JSON.parse(localStorage.getItem(STORE) ?? '{}') as typeof stored; } catch { /* the defaults stand */ }
  const asked = WAYS.find((way) => way === params.get('way'));
  /** The fight that ended last, waiting for the calm to play out before the lab asks about it. */
  let ended: LoggedFight | null = null, askIn = 0;
  const fight = createFight(stage, {
    way: asked ?? (WAYS.includes(stored.way as Way) ? stored.way : 'hero'),
    pet: stored.pet,
    gentle: stored.gentle,
    external: true,
    random: () => game.random(),
    onEnd(record) {
      const logged = log.add(record);
      if (record.result === 'calmed') { ended = logged; askIn = 2.2; }
    },
  });
  const keep = (): void => {
    try { localStorage.setItem(STORE, JSON.stringify({ way: fight.way, pet: fight.pet.def.kind, gentle: fight.gentle })); } catch { /* it holds for this visit */ }
  };

  const figures = createFigures(view);
  const ground = createGround(view);
  const rigViews = createRigViews(view);
  let held: RigKind | null = null;
  let bot: Bot | null = null;
  let lastKind = '';

  const panel = createPanel(view.root, log, {
    setWay(way) { held = null; fight.setWay(way); keep(); },
    bring(kind) { bring(kind); },
    wake() { fight.wake(); },
    clear() { held = null; fight.clear(); },
    setGentle(on) { fight.setGentle(on); keep(); },
    setPet(kind) { fight.setPet(kind); keep(); },
    setQuality(mode) { view.settings.setQuality(mode); },
    pickRig(kind) { held = kind; },
    again() { if (lastKind) bring(lastKind); },
  });

  function bring(kind: string): void {
    held = null;
    lastKind = kind;
    fight.bring(kind);
    // Back to the start, so every fight opens the same way.
    view.hero.teleport(stage.start.x, groundY(stage.start.x, stage.start.z), stage.start.z, 0);
    fight.placeHero(stage.start.x, stage.start.z);
  }

  // ---------------------------------------------------------------- drawing: who is where
  /** The height of the ground a fighter stands on. */
  function groundY(x: number, z: number): number {
    const painted = view.groundAt(x, z);
    return painted === painted ? painted : view.world.sim.heightAt(Math.floor(x), Math.floor(z));
  }

  const lookOf = (kind: string): Look => (figures.has(kind) ? { sheet: kind, poses: figures.has(`${kind}-fight`) ? `${kind}-fight` : '', scale: 1, tint: [1, 1, 1], standIn: false } : STAND_INS[kind] ?? (STAND_INS.thistlehog as Look));
  const heroCut = figures.has('hero-cut'), heroMoves = figures.has('hero-moves'), heroCall = figures.has('hero-call');

  const heroFigure = figures.add('hero');
  const heroJolt = jolt();
  /** Two afterimages of a dodge: where the hero was a moment ago. */
  const ghosts = [figures.add('hero', { ghost: true }), figures.add('hero', { ghost: true })];
  const trail = [{ x: 0, y: 0, z: 0, t: 9 }, { x: 0, y: 0, z: 0, t: 9 }];
  let petLook = lookOf(fight.pet.def.kind), petKind = fight.pet.def.kind;
  let petFigure = figures.add(petLook.sheet);
  const petJolt = jolt();
  const petDrawn = { x: stage.start.x + 1.2, z: stage.start.z + 0.8 };

  interface Drawn { figure: Figure; look: Look; jolt: Jolt; x: number; z: number; calmT: number; id: number }
  const drawn = new Map<number, Drawn>();

  /** The arcs of the hero's cuts and other short flashes on the ground, each alive for a moment. */
  const flashes = Array.from({ length: 8 }, () => ({ kind: 0, x: 0, z: 0, facing: 0, reach: 0, width: 0, life: 0, span: 1, color: WHITE, grow: 0 }));
  function flashAt(kind: number, x: number, z: number, facing: number, reach: number, width: number, span: number, color: THREE.Color, grow = 0): void {
    let slot = flashes[0] as (typeof flashes)[number];
    for (const f of flashes) if (f.life <= 0 || f.life < slot.life) slot = f;
    Object.assign(slot, { kind, x, z, facing, reach, width, life: span, span, color, grow });
  }

  const spot = { x: 0, y: 0, z: 0 };
  function effect(id: Parameters<GameView['effects']['play']>[0], x: number, z: number, lift = 0.4, color?: number, scale?: number): void {
    spot.x = x; spot.z = z; spot.y = groundY(x, z) + lift;
    view.effects.play(id, spot, color === undefined && scale === undefined ? undefined : { color, scale });
  }
  const sound = (event: Parameters<NonNullable<GameView['audio']>['emit']>[0]): void => { view.audio?.emit(event); };

  // ---------------------------------------------------------------- the fight's events: sound, sparks, freezes
  /** Seconds the fight stands still: the freeze of a hit. Only the picture waits. */
  let freeze = 0;
  const stop = (frames: number): void => { freeze = Math.max(freeze, frames / 60); };
  const nearest = (x: number, z: number): Drawn | null => {
    let best: Drawn | null = null, near = Infinity;
    for (const d of drawn.values()) { const away = Math.hypot(d.x - x, d.z - z); if (away < near) { near = away; best = d; } }
    return best;
  };

  function hear(e: FightEvent): void {
    spot.x = e.x; spot.z = e.z; spot.y = groundY(e.x, e.z) + 0.5;
    switch (e.type) {
      case 'brought': effect('pop', e.x, e.z, 0.05); break;
      case 'wake': sound({ type: 'pet', mood: 'alert', at: spot }); break;
      case 'tell': sound({ type: 'pet', mood: 'curious', at: spot }); break;
      case 'strike': if (e.text === 'needles' || e.text === 'stomp' || e.text === 'spin') { effect('popDust', e.x, e.z, 0.1, undefined, 2); sound({ type: 'land', surface: 'grass', at: spot }); } break;
      case 'swing': {
        const h = fight.hero;
        if (e.n === 3) flashAt(MARK.circle, h.x, h.z, 0, HERO.spin.reach, 0, 0.2, PALE);
        else flashAt(MARK.cone, h.x, h.z, h.facing, HERO.cut.reach, HERO.cut.arc / 2, 0.14, PALE);
        sound({ type: 'jump', at: spot });
        break;
      }
      case 'hit': stop(e.n === 3 ? 6 : 4); effect('chips', e.x, e.z, 0.5, 0xfff2c8, 0.5); sound({ type: 'hit', at: spot }); break;
      case 'guard': { const d = nearest(e.x, e.z); if (d) { d.jolt.flash = 1; d.jolt.shake = 0.12; d.jolt.squash = 1; } break; }
      case 'charged': effect('trail', e.x, e.z, 0.6, 0xfff2c8, 0.5); sound({ type: 'ui', sound: 'open' }); break;
      case 'dodge': effect('dust', e.x, e.z, 0.05); sound({ type: 'jump', at: spot }); break;
      case 'dodged': effect('trail', e.x, e.z, 0.8, 0x9ff5e6, 0.4); break;
      case 'heroHurt': stop(5); heroJolt.flash = 1; heroJolt.shake = e.n ? 0.2 : 0.12; sound({ type: 'hit', at: spot }); effect('dust', e.x, e.z, 0.3); break;
      case 'faint': sound({ type: 'pet', mood: 'sad', at: spot }); break;
      case 'woke': view.hero.teleport(fight.hero.x, groundY(fight.hero.x, fight.hero.z), fight.hero.z, 0); break;
      case 'segment': stop(8); effect('pop', e.x, e.z, 0.1); sound({ type: 'blockBroken', surface: 'stone', at: spot }); break;
      case 'dizzy': stop(6); effect('pop', e.x, e.z, 0.1); sound({ type: 'ui', sound: 'open' }); break;
      case 'crash': stop(8); effect('chips', e.x, e.z, 0.8, 0xc9c4b6, 1.5); effect('popDust', e.x, e.z, 0.3, undefined, 2); sound({ type: 'blockBroken', surface: 'stone', at: spot }); break;
      case 'stall': effect('splash', e.x, e.z, 0.1); break;
      case 'calmed': {
        stop(10);
        const d = nearest(e.x, e.z);
        if (d) d.calmT = 0;
        effect('trail', e.x, e.z, 0.4, 0x7df0d0, 2);
        effect('leafBurst', e.x, e.z, 0.6);
        sound({ type: 'spell', element: 'bloom', at: spot });
        sound({ type: 'stinger' });
        panel.say(`It leaves you something: ${e.text}.`);
        break;
      }
      case 'bolt': sound({ type: 'ui', sound: 'click' }); break;
      case 'boltHit': effect('trail', e.x, e.z, 0.6, 0x7df0d0, 0.35); sound({ type: 'pickup', at: spot }); break;
      case 'order': flashAt(MARK.ring, e.x, e.z, 0, 1.2, 0.06, 0.35, TEAL, -0.6); break;
      case 'whistle': flashAt(MARK.ring, e.x, e.z, 0, 0.6, 0.05, 0.45, TEAL, 3); sound({ type: 'pet', mood: 'happy', at: spot }); break;
      case 'petStrike': stop(2); effect('chips', e.x, e.z, 0.4, 0xbff5d0, 0.3); sound({ type: 'hit', at: spot }); break;
      case 'petHurt': petJolt.flash = 1; petJolt.shake = 0.1; sound({ type: 'pet', mood: 'sad', at: spot }); break;
      case 'petFaint': effect('popDust', e.x, e.z, 0.2); panel.say(`${fight.pet.def.name} is down. It rests a while.`); break;
      case 'petUp': sound({ type: 'pet', mood: 'happy', at: spot }); break;
      case 'skill': flashAt(MARK.ring, e.x, e.z, 0, 0.9, 0.07, 0.4, TEAL, 1.5); sound({ type: 'pet', mood: 'alert', at: spot }); break;
      case 'blocked': stop(8); effect('pop', e.x, e.z, 0.2); sound({ type: 'blockBroken', surface: 'stone', at: spot }); break;
      case 'rigPlaced': sound({ type: 'blockPlaced', surface: 'wood', at: spot }); break;
      case 'rig': stop(6); effect('pop', e.x, e.z, 0.1); effect('trail', e.x, e.z, 0.5, e.text === 'channel' ? 0x9fd8ff : 0x7df0d0, 0.8); sound({ type: 'machine', at: spot }); break;
      case 'denied': panel.say(e.text); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- the keys
  const input = fight.input;
  const down = new Set<string>();
  const typing = (target: EventTarget | null): boolean => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || !ready) return;
    down.add(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') fight.press('dodge');
    else if (e.code === 'KeyF') fight.press('use');
    else if (e.code === 'KeyC') fight.press('skill1');
    else if (e.code === 'KeyT') fight.press('skill2');
    else if (e.code === 'Escape') held = null;
  });
  window.addEventListener('keyup', (e) => { down.delete(e.code); });
  window.addEventListener('blur', () => down.clear());

  // The clicks, the number keys, E, G and Z are the lab's: nothing here breaks a block or opens build mode.
  view.claim('lab-fight', ['use', 'slot', 'slotStep', 'interact', 'build', 'undo']);
  view.keys.onPress((press) => {
    if (!ready || game.player.busy || view.paused) return;
    if (press.kind === 'use' && press.button === 'primary') {
      if (fight.way === 'world') {
        if (held && fight.placeRig(held, input.aimX, input.aimZ) === null) held = null;
      } else {
        fight.press('attack');
      }
    } else if (press.kind === 'use') {
      if (fight.way === 'world') held = null;
      else fight.press('whistle');
    } else if (press.kind === 'slot' && fight.way === 'world') {
      const kind = RIGS[press.index]?.kind ?? null;
      if (kind && !fight.kit().includes(kind)) panel.say('The kit holds one of each.');
      else held = kind === held ? null : kind;
    } else if (press.kind === 'undo') {
      if (!fight.takeBack()) panel.say('No rig to take back.');
    } else if (press.kind === 'interact') {
      fight.wake();
    }
  });

  // ---------------------------------------------------------------- one step of the body: the fight steps with it
  const walkSpeed = view.hero.body.tuning.walkSpeed;
  let ready = false;

  function steer(wish: HeroInput, body: HeroBody): void {
    if (!ready) return;
    body.tuning.walkSpeed = walkSpeed;
    if (freeze > 0) {
      // The freeze of a hit: nobody moves, and the fight's clock waits.
      freeze -= HERO_STEP;
      wish.moveX = wish.moveZ = 0;
      wish.jump = false;
      body.vx = body.vz = 0;
      return;
    }
    // Shift is the dodge here, so the keys always ask for a full walk.
    const length = Math.hypot(wish.moveX, wish.moveZ);
    input.moveX = length > 0.05 ? wish.moveX / length : 0;
    input.moveZ = length > 0.05 ? wish.moveZ / length : 0;
    input.attackHeld = view.keys.primary && fight.way === 'hero';
    input.calmHeld = down.has('KeyF');
    input.placing = held !== null;
    fight.placeHero(body.x, body.z);
    bot?.step(HERO_STEP);
    fight.step(HERO_STEP);
    for (let i = 0; i < fight.events.length; i++) hear(fight.events[i] as FightEvent);
    fight.events.length = 0;

    const h = fight.hero;
    if (h.driven) {
      // A dodge or a push: the body goes exactly as fast as the fight says.
      const vx = h.driveX + h.shoveX, vz = h.driveZ + h.shoveZ, speed = Math.hypot(vx, vz);
      body.tuning.walkSpeed = Math.max(0.01, speed);
      wish.moveX = speed > 0 ? vx / speed : 0;
      wish.moveZ = speed > 0 ? vz / speed : 0;
      body.vx = vx;
      body.vz = vz;
    } else {
      wish.moveX = input.moveX * h.pace + h.shoveX / walkSpeed;
      wish.moveZ = input.moveZ * h.pace + h.shoveZ / walkSpeed;
    }
    if (h.act !== 'none') wish.jump = false;
  }
  view.hero.steer = steer;

  // ---------------------------------------------------------------- setting up
  function setUp(): void {
    window.__game?.teleport(stage.start.x, stage.start.z);
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
  const point: ScreenPoint = { x: 0, y: 0 };
  const origin = new THREE.Vector3(), ray = new THREE.Vector3();
  const beastAt = (beast: BeastState): ScreenPoint | null => {
    const d = drawn.get(beast.id);
    return d ? view.project(d.x, groundY(d.x, d.z) + d.figure.height + 0.35, d.z, point) : null;
  };
  let clock = 0;

  /** Where the pointer is on the ground, at the height of the hero's feet. */
  function takeAim(): void {
    const pointer = view.keys.pointer;
    if (!pointer.over || bot) return;
    origin.copy(lens.position);
    ray.set(pointer.x, pointer.y, 0.5).unproject(lens).sub(origin).normalize();
    if (Math.abs(ray.y) < 1e-4) return;
    const t = (view.playerPosition.y - origin.y) / ray.y;
    if (t <= 0) return;
    input.aimX = origin.x + ray.x * t;
    input.aimZ = origin.z + ray.z * t;
  }

  function settle(j: Jolt, dt: number): void {
    j.flash = Math.max(0, j.flash - dt * 9);
    j.shake = Math.max(0, j.shake - dt * 0.9);
    j.squash = Math.max(0, j.squash - dt * 12);
  }

  function drawHero(dt: number): void {
    const h = fight.hero, f = heroFigure, p = view.playerPosition, body = view.hero.body;
    view.hero.actor.visible = false;
    settle(heroJolt, dt);
    f.place(p.x, p.y, p.z);
    f.face(h.facing);
    f.flash = heroJolt.flash;
    f.shake = heroJolt.shake * Math.sin(clock * 90);
    f.squashX = f.squashY = 1;
    f.tint.setRGB(1, 1, 1);
    const moving = Math.hypot(body.vx, body.vz) > 0.4;
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
    // A hero nothing can hit blinks, so the safe moment after a hit is seen.
    f.visible = !(h.safe > 0 && h.act !== 'dodge' && h.act !== 'faint' && Math.floor(clock * 14) % 2 === 0 && heroJolt.flash <= 0);

    // The afterimages of a dodge: two places the hero just left.
    for (let i = 0; i < 2; i++) {
      const g = ghosts[i] as Figure, at = trail[i] as (typeof trail)[number];
      at.t += dt;
      if (h.act === 'dodge' && h.t > (i + 1) * 0.07 && at.t > 0.3) { at.x = p.x - dirX(h.facing) * (i + 1) * 0.8; at.y = p.y; at.z = p.z - dirZ(h.facing) * (i + 1) * 0.8; at.t = 0; }
      g.visible = at.t < 0.22;
      if (!g.visible) continue;
      g.place(at.x, at.y, at.z);
      g.face(h.facing);
      g.play('hero', 'walk');
      g.alpha = 0.45 * (1 - at.t / 0.22);
      g.tint.setRGB(0.6, 0.95, 1.1);
    }
  }

  function drawPet(dt: number): void {
    const p = fight.pet;
    if (p.def.kind !== petKind) {
      petKind = p.def.kind;
      petLook = lookOf(petKind);
      petFigure.remove();
      petFigure = figures.add(petLook.sheet);
    }
    const f = petFigure, ease = 1 - Math.exp(-24 * dt);
    settle(petJolt, dt);
    // A pet that jumps a long way (it comes back beside the hero after a rest) is not slid there.
    if (Math.hypot(p.x - petDrawn.x, p.z - petDrawn.z) > 4) { petDrawn.x = p.x; petDrawn.z = p.z; }
    petDrawn.x += (p.x - petDrawn.x) * ease;
    petDrawn.z += (p.z - petDrawn.z) * ease;
    const y = groundY(petDrawn.x, petDrawn.z);
    f.scale = petLook.scale;
    f.tint.setRGB(petLook.tint[0], petLook.tint[1], petLook.tint[2]);
    f.face(p.facing);
    f.flash = petJolt.flash;
    f.shake = petJolt.shake * Math.sin(clock * 90);
    f.squashX = f.squashY = 1;
    f.drained = 0;
    let lift = 0;
    const poses = figures.has(`${petKind}-fight`) ? `${petKind}-fight` : '';
    if (p.mode === 'down') {
      if (poses) f.pose(poses, 'poses', 3);
      else { f.pose(petLook.sheet, 'idle', 0); f.squashY = 0.45; f.squashX = 1.25; f.drained = 0.5; }
    } else if (p.strikeT > 0) {
      // A strike: a short hop at the beast.
      if (poses) f.pose(poses, 'poses', 1);
      else { f.play(petLook.sheet, 'walk'); f.squashX = 1.3; f.squashY = 0.85; }
      lift = Math.sin((p.strikeT / 0.3) * Math.PI) * 0.35;
    } else if (p.hurtT > 0) {
      if (poses) f.pose(poses, 'poses', 2);
      else f.pose(petLook.sheet, 'idle', 0);
    } else if (p.mode === 'brace') {
      if (poses) f.pose(poses, 'poses', 0);
      else { f.pose(petLook.sheet, 'idle', 0); f.squashX = 1.25; f.squashY = 0.85; }
    } else {
      f.play(petLook.sheet, p.moving ? 'walk' : 'idle');
    }
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
        const look = lookOf(b.def.kind);
        d = { figure: figures.add(look.sheet), look, jolt: jolt(), x: b.x, z: b.z, calmT: -1, id: b.id };
        drawn.set(b.id, d);
      }
      const f = d.figure, look = d.look, a = b.attack;
      settle(d.jolt, dt);
      const ease = 1 - Math.exp(-30 * dt);
      d.x += (b.x - d.x) * ease;
      d.z += (b.z - d.z) * ease;
      const y = groundY(d.x, d.z);
      let lift = 0;
      f.scale = look.scale;
      f.face(b.facing);
      f.tint.setRGB(look.tint[0], look.tint[1], look.tint[2]);
      f.flash = d.jolt.flash * 0.85;
      f.shake = d.jolt.shake * Math.sin(clock * 95);
      f.squashX = 1 + 0.15 * d.jolt.squash;
      f.squashY = 1 - 0.1 * d.jolt.squash;

      // Drained grey while the Blight has it. A machine is not Blighted: it only goes dark when it is shut down.
      if (b.doing === 'calmed') {
        if (d.calmT < 0) d.calmT = 9;
        d.calmT += dt;
        if (b.def.machine) { const k = Math.min(1, d.calmT / 1.2); f.drained = 0; f.tint.multiplyScalar(1 - 0.5 * k); }
        else { f.sweep = Math.min(1, d.calmT / 1.5); f.drained = f.sweep >= 1 ? 0 : 1; }
      } else {
        d.calmT = -1;
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
      f.place(d.x, y + lift, d.z);

      const r = b.def.radius;
      ground.draw(MARK.shadow, d.x, y, d.z, 0, r * 1.25, 0, 0, SHADE, 0.5 / (1 + lift));
      // The hold of the Mark: a teal ring that closes around the beast.
      if (b.doing === 'dizzy') {
        ground.draw(MARK.ring, d.x, y, d.z, 0, r + 0.7, 0.04, 1, TEAL, 0.35 + 0.2 * Math.sin(clock * 6));
        if (b.calm > 0) ground.draw(MARK.ring, d.x, y, d.z, 0, r + 0.7, 0.1, b.calm, TEAL, 1, 0.3);
      }
      for (let m = 0; m < b.marks; m++) ground.draw(MARK.ring, d.x, y, d.z, 0, r + 0.25 + m * 0.16, 0.035, 1, TEAL, 0.9);
    }
  }

  function drawGround(dt: number): void {
    const y = oy;
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
    for (const f of flashes) {
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
    if (held && fight.way === 'world') {
      const cx = Math.floor(input.aimX) + 0.5, cz = Math.floor(input.aimZ) + 0.5, why = fight.canPlace(held, cx, cz);
      let alongX = true;
      const beast = fight.beasts[0];
      if (beast) alongX = Math.abs(beast.z - cz) >= Math.abs(beast.x - cx);
      rigViews.ghost(held, cx, groundY(cx, cz), cz, alongX, why === null);
      ground.draw(MARK.cell, cx, groundY(cx, cz), cz, 0, 0.5, 0, 0, why === null ? TEAL : RED, 0.9);
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

  let asked2 = false;
  view.onFrame((dt) => {
    if (!view.started) {
      // The title holds the start. The lab goes straight in: its own save when there is one, a new game otherwise.
      if (!asked2) { asked2 = true; if (!view.continueGame()) view.newGame(); }
      return;
    }
    if (!ready) {
      ready = true;
      setUp();
      const beam = view.scene.getObjectByName('waypoint-beam') as THREE.Mesh | undefined;
      if (beam) (beam.material as THREE.Material).visible = false;
    }
    clock += dt;
    takeAim();
    ground.begin();
    drawGround(dt);
    drawHero(dt);
    drawPet(dt);
    drawBeasts(dt);
    ground.end();
    rigViews.sync(fight.rigs, groundY);
    figures.update(dt);
    if (ended && (askIn -= dt) <= 0) { panel.ask(ended); ended = null; }
    panel.update(fight, held, view.settings.quality, beastAt);
  });

  window.__fight = {
    fight,
    bot(on, layout) { bot = on ? createBot(fight, stage, { layout }) : null; },
    state() {
      const h = fight.hero, b = fight.beasts[0];
      return {
        way: fight.way, phase: fight.phase, clock: fight.clock, gentle: fight.gentle,
        hero: { x: h.x, z: h.z, health: h.health, stamina: h.stamina, act: h.act },
        pet: { kind: fight.pet.def.kind, mode: fight.pet.mode, hearts: fight.pet.hearts, x: fight.pet.x, z: fight.pet.z },
        beast: b ? { kind: b.def.kind, doing: b.doing, guard: b.guard, x: b.x, z: b.z, calm: b.calm, marks: b.marks } : null,
        rigs: fight.rigs.map((r) => ({ kind: r.kind, x: r.x, z: r.z, armed: r.armed })),
        shapes: fight.shapes.filter((s) => s.live).length,
        record: { ...fight.record },
        held,
        figures: figures.count,
        marks: ground.count,
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
    screen(x, z) {
      const at = view.project(x, groundY(x, z) + 0.4, z);
      return at ? { x: at.x, y: at.y } : null;
    },
    standIns() {
      const list: string[] = [];
      for (const kind of ['thistlehog', 'gearling', 'boar', 'pebblepup']) if (lookOf(kind).standIn) list.push(kind);
      if (!heroCut) list.push('hero-cut');
      if (!heroMoves) list.push('hero-moves');
      if (!heroCall) list.push('hero-call');
      if (!figures.has('leaftail-fight')) list.push('leaftail-fight');
      return list;
    },
  };
}
