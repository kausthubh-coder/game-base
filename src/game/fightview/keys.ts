// The fight lab's hands: the keys and the mouse into the fight's input and presses, the weapon in the hand,
// the rig in the hand, and the hook on the hero's body that steps the fight with it. The body steps 60 times a second
// (`PlayerRig.drive`); the fight steps with it, and the body then moves as the fight says: a dodge, a push, a
// faint. The freeze of a hit is spent here and nowhere else.
import * as THREE from 'three';
import { RIGS, WEAPONS, type WeaponKind } from '../content/fight.ts';
import { HERO_STEP, type HeroBody, type HeroInput } from '../../features/hero/index.ts';
import type { Bot } from '../fight/bot.sim.ts';
import type { Fight, FightEvent, PlacedKind } from '../fight/fight.sim.ts';
import type { GameView } from '../shell/view.ts';
import type { Feel } from './feel.ts';

export interface KeysHooks {
  feel: Feel;
  /** A short line under the bars. */
  say(text: string): void;
  /** The height of the ground a fighter stands on. */
  groundY(x: number, z: number): number;
  /** 1, 2 or 3 took a weapon in hand. */
  weapon(kind: WeaponKind): void;
  /**
   * The world's fights: one step of the rules in place of `fight.step`, so the world steps its keeper, its hall and
   * what it makes of the fight's events with it (`RunningFight.step`). The lab steps the fight itself.
   */
  step?(dt: number): void;
  /** The world's fights: 1, 2 and 3 are the kit's slots, not the weapons. True when it handled the press. */
  slot?(index: number): boolean;
  /** The world's fights: C, before the companion's skill. True when it handled the press. */
  skill?(): boolean;
}

export interface Keys {
  /** The rig or the kit thing in the hand, ready to set down. */
  held: PlacedKind | null;
  /** The rule-made player, when it fights in place of the keys. */
  bot: Bot | null;
  /** False until the lab has set the arena up: nothing reads a key or steps the fight before. */
  ready: boolean;
  /** True holds the fight still: the rules are not stepped, and the picture goes on. For the door, to look at a pose. */
  paused: boolean;
  /** Below 1 the picture runs this much slower, and a freeze lasts as long in the picture: for the door's strips of screenshots. */
  slow: number;
  /** Once a frame: where the pointer is on the ground, into the fight's aim. */
  aim(): void;
  /**
   * Takes the keys and the hero's body for the fight, or gives them back: the world's fights take them only while
   * one runs. The lab takes them once, when it opens.
   */
  use(on: boolean): void;
}

export function createKeys(view: GameView, fight: Fight, hooks: KeysHooks): Keys {
  const { feel, say, groundY, weapon } = hooks;
  const { game } = view;
  const lens = view.ctx.camera;
  const keys: Keys = { held: null, bot: null, ready: false, paused: false, slow: 1, aim, use };

  const down = new Set<string>();
  const typing = (target: EventTarget | null): boolean => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || !keys.ready) return;
    down.add(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') fight.press('dodge');
    else if (e.code === 'KeyF') fight.press('use');
    else if (e.code === 'KeyC' && !hooks.skill?.()) fight.press('skill');
  });
  // Esc with a rig in the hand puts it back and does nothing else. This view is installed before the panels'
  // (views install sorted by their names), so in the capture phase it hears Esc before the pause menu does.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || e.repeat || !keys.held || !keys.ready || view.paused) return;
    keys.held = null;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, { capture: true });
  window.addEventListener('keyup', (e) => { down.delete(e.code); });
  window.addEventListener('blur', () => down.clear());

  view.keys.onPress((press) => {
    if (!keys.ready || game.player.busy || view.paused) return;
    if (press.kind === 'fight') {
      if (press.action !== 'skill' || !hooks.skill?.()) fight.press(press.action);
    } else if (press.kind === 'use' && press.button === 'primary') {
      // A click with a rig or a kit thing in the hand sets it down. Otherwise it attacks.
      if (keys.held) {
        if (fight.placeRig(keys.held, fight.input.aimX, fight.input.aimZ) === null) keys.held = null;
      } else if (fight.way !== 'world') {
        fight.press('attack');
      }
    } else if (press.kind === 'use') {
      // A right click puts back what is in the hand.
      keys.held = null;
    } else if (press.kind === 'slot' && hooks.slot?.(press.index)) {
      // The world's kit.
    } else if (press.kind === 'slot' && fight.way === 'world') {
      const kind = RIGS[press.index]?.kind ?? null;
      if (kind && !fight.kit().includes(kind)) say('The kit holds one of each.');
      else keys.held = kind === keys.held ? null : kind;
    } else if (press.kind === 'slot') {
      // 1, 2 and 3: the sword, the bow, the staff.
      const kind = WEAPONS[press.index]?.kind;
      if (kind && kind !== fight.hero.weapon) { fight.setWeapon(kind); weapon(kind); }
    } else if (press.kind === 'undo') {
      if (!fight.takeBack()) say('No rig to take back.');
    } else if (press.kind === 'interact') {
      fight.wake();
    }
  });

  // ---------------------------------------------------------------- one step of the body: the fight steps with it
  const walkSpeed = view.hero.body.tuning.walkSpeed;

  function steer(wish: HeroInput, body: HeroBody): void {
    if (!keys.ready) return;
    body.tuning.walkSpeed = walkSpeed;
    if (keys.paused) return;
    if (feel.freeze > 0) {
      // The freeze of a hit: nobody moves, and the fight's clock waits.
      feel.freeze -= HERO_STEP * keys.slow;
      wish.moveX = wish.moveZ = 0;
      wish.jump = false;
      body.vx = body.vz = 0;
      return;
    }
    // Shift is the dodge here, so the keys always ask for a full walk.
    const length = Math.hypot(wish.moveX, wish.moveZ);
    fight.input.moveX = length > 0.05 ? wish.moveX / length : 0;
    fight.input.moveZ = length > 0.05 ? wish.moveZ / length : 0;
    fight.input.attackHeld = view.keys.primary && fight.way === 'hero';
    fight.input.calmHeld = down.has('KeyF') || view.keys.touch.calmHeld;
    fight.input.placing = keys.held !== null;
    fight.placeHero(body.x, body.z);
    if (hooks.step) hooks.step(HERO_STEP);
    else {
      keys.bot?.step(HERO_STEP);
      fight.step(HERO_STEP);
    }
    for (let i = 0; i < fight.events.length; i++) {
      const e = fight.events[i] as FightEvent;
      // The hero woke at the arena's edge: the body goes there.
      if (e.type === 'woke') view.hero.teleport(fight.hero.x, groundY(fight.hero.x, fight.hero.z), fight.hero.z, 0);
      feel.hear(e);
    }
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
      wish.moveX = fight.input.moveX * h.pace + h.shoveX / walkSpeed;
      wish.moveZ = fight.input.moveZ * h.pace + h.shoveZ / walkSpeed;
    }
    if (h.act !== 'none') wish.jump = false;
  }
  // The clicks, the number keys, E, G and Z are the fight's: nothing here breaks a block or opens build mode.
  let before: typeof view.hero.drive = null;
  function use(on: boolean): void {
    if (on === keys.ready) return;
    keys.ready = on;
    keys.held = null;
    down.clear();
    if (on) {
      view.claim('lab-fight', ['use', 'slot', 'slotStep', 'interact', 'build', 'undo']);
      before = view.hero.drive;
      view.hero.drive = steer;
    } else {
      view.claim('lab-fight', null);
      if (view.hero.drive === steer) view.hero.drive = before;
      body0.tuning.walkSpeed = walkSpeed;
    }
  }
  const body0 = view.hero.body;

  // ---------------------------------------------------------------- the pointer on the ground
  const origin = new THREE.Vector3(), ray = new THREE.Vector3();

  /** Where the pointer is on the ground, at the height of the hero's feet. */
  function aim(): void {
    const pointer = view.keys.pointer;
    if (!pointer.over || keys.bot) return;
    origin.copy(lens.position);
    ray.set(pointer.x, pointer.y, 0.5).unproject(lens).sub(origin).normalize();
    if (Math.abs(ray.y) < 1e-4) return;
    const t = (view.playerPosition.y - origin.y) / ray.y;
    if (t <= 0) return;
    fight.input.aimX = origin.x + ray.x * t;
    fight.input.aimZ = origin.z + ray.z * t;
  }

  return keys;
}
