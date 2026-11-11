// The fight lab's hands: the keys and the mouse into the fight's input and presses, the rig in the hand, and
// the hook on the hero's body that steps the fight with it. The body steps 60 times a second
// (`PlayerRig.steer`); the fight steps with it, and the body then moves as the fight says: a dodge, a push, a
// faint. The freeze of a hit is spent here and nowhere else.
import * as THREE from 'three';
import { RIGS, type RigKind } from '../content/fight.ts';
import { HERO_STEP, type HeroBody, type HeroInput } from '../../features/hero/index.ts';
import type { Bot } from '../fight/bot.sim.ts';
import type { Fight, FightEvent } from '../fight/fight.sim.ts';
import type { GameView } from '../shell/view.ts';
import type { Feel } from './feel.ts';

export interface KeysHooks {
  feel: Feel;
  /** A short line under the bars. */
  say(text: string): void;
  /** The height of the ground a fighter stands on. */
  groundY(x: number, z: number): number;
}

export interface Keys {
  /** The rig in the hand, ready to set down. */
  held: RigKind | null;
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
}

export function createKeys(view: GameView, fight: Fight, hooks: KeysHooks): Keys {
  const { feel, say, groundY } = hooks;
  const { game } = view;
  const lens = view.ctx.camera;
  const input = fight.input;
  const keys: Keys = { held: null, bot: null, ready: false, paused: false, slow: 1, aim };

  const down = new Set<string>();
  const typing = (target: EventTarget | null): boolean => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || !keys.ready) return;
    down.add(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') fight.press('dodge');
    else if (e.code === 'KeyF') fight.press('use');
    else if (e.code === 'KeyC') fight.press('skill1');
    else if (e.code === 'KeyT') fight.press('skill2');
  });
  // Esc with a rig in the hand puts it back and does nothing else. This view is installed before the panels'
  // (views install in the order of their names), so in the capture phase it hears Esc before the pause menu does.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || e.repeat || !keys.held || !keys.ready || view.paused) return;
    keys.held = null;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, { capture: true });
  window.addEventListener('keyup', (e) => { down.delete(e.code); });
  window.addEventListener('blur', () => down.clear());

  // The clicks, the number keys, E, G and Z are the lab's: nothing here breaks a block or opens build mode.
  view.claim('lab-fight', ['use', 'slot', 'slotStep', 'interact', 'build', 'undo']);
  view.keys.onPress((press) => {
    if (!keys.ready || game.player.busy || view.paused) return;
    if (press.kind === 'use' && press.button === 'primary') {
      if (fight.way === 'world') {
        if (keys.held && fight.placeRig(keys.held, input.aimX, input.aimZ) === null) keys.held = null;
      } else {
        fight.press('attack');
      }
    } else if (press.kind === 'use') {
      if (fight.way === 'world') keys.held = null;
      else fight.press('whistle');
    } else if (press.kind === 'slot' && fight.way === 'world') {
      const kind = RIGS[press.index]?.kind ?? null;
      if (kind && !fight.kit().includes(kind)) say('The kit holds one of each.');
      else keys.held = kind === keys.held ? null : kind;
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
    input.moveX = length > 0.05 ? wish.moveX / length : 0;
    input.moveZ = length > 0.05 ? wish.moveZ / length : 0;
    input.attackHeld = view.keys.primary && fight.way === 'hero';
    input.calmHeld = down.has('KeyF');
    input.placing = keys.held !== null;
    fight.placeHero(body.x, body.z);
    keys.bot?.step(HERO_STEP);
    fight.step(HERO_STEP);
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
      wish.moveX = input.moveX * h.pace + h.shoveX / walkSpeed;
      wish.moveZ = input.moveZ * h.pace + h.shoveZ / walkSpeed;
    }
    if (h.act !== 'none') wish.jump = false;
  }
  view.hero.steer = steer;

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
    input.aimX = origin.x + ray.x * t;
    input.aimZ = origin.z + ray.z * t;
  }

  return keys;
}
