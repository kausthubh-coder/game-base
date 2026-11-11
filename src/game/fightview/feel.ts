// How a fight of the fight lab feels: each event the rules send becomes a freeze of the fight, a jolt on a
// fighter, a shake of the screen, a short flash on the ground, particles and a sound. The table is `hear`.
// Nothing here moves a body or changes the fight: the freeze is a number the body's step reads (`keys.ts`), and
// the jolts and flashes are numbers `draw.ts` draws.
//
// The shake moves the picture, not the camera: a few pixels of offset on the lens, so the world, the aim and
// the shadows stay where they are. The card's switch and the game's "reduce motion" both turn it off.
import type * as THREE from 'three';
import { HERO, SHAKE } from '../content/fight.ts';
import type { Fight, FightEvent } from '../fight/fight.sim.ts';
import type { GameView } from '../shell/view.ts';
import { CALM } from './calm.ts';
import { MARK } from './ground.ts';
import { PALE, TEAL, WHITE } from './looks.ts';

/** What a hit leaves on a fighter for a moment: a white flash, a shake, a squash. Each runs down to 0. */
export interface Jolt { flash: number; shake: number; squash: number }
export const jolt = (): Jolt => ({ flash: 0, shake: 0, squash: 0 });

/** Runs a jolt down by one frame. The flash is gone in two frames (note 05's feel list). */
export function settle(j: Jolt, dt: number): void {
  j.flash = Math.max(0, j.flash - dt * 30);
  j.shake = Math.max(0, j.shake - dt * 0.9);
  j.squash = Math.max(0, j.squash - dt * 12);
}

/** A short mark on the ground: the arc of a cut, the ring of an order. Alive for `span` seconds. */
export interface Flash { kind: number; x: number; z: number; facing: number; reach: number; width: number; life: number; span: number; color: THREE.Color; grow: number }

/** A drawn fighter, as the feel of a hit needs it: its jolt, and the clock of its calming (`looks.ts`, `calm.ts`). */
export interface Felt { jolt: Jolt; calmT: number; calmOn: boolean }

export interface FeelHooks {
  /** A short line under the bars. */
  say(text: string): void;
  /** The drawn beast nearest a point, or null when none is drawn. */
  nearest(x: number, z: number): Felt | null;
  /** The height of the ground a fighter stands on. */
  groundY(x: number, z: number): number;
}

export interface Feel {
  /** Seconds the fight stands still: the freeze of a hit. Only the picture goes on. The body's step spends it. */
  freeze: number;
  /** False turns the screen's shake off. */
  shakes: boolean;
  /** Pixels the picture is moved by right now, for the door. */
  readonly shaken: number;
  /** Seconds left of the hero pointing: a throw that was also an order to the pet. */
  readonly pointing: number;
  readonly hero: Jolt;
  readonly pet: Jolt;
  /** The short marks on the ground, a fixed few. `life` at or under 0 is a free one. */
  readonly flashes: readonly Flash[];
  /** One event of the fight. */
  hear(e: FightEvent): void;
  /** Once a frame, after the camera moved and before the picture is drawn: the shake. */
  frame(dt: number): void;
}

export function createFeel(view: GameView, fight: Fight, hooks: FeelHooks): Feel {
  const { say, nearest, groundY } = hooks;
  const flashes: Flash[] = Array.from({ length: 8 }, () => ({ kind: 0, x: 0, z: 0, facing: 0, reach: 0, width: 0, life: 0, span: 1, color: WHITE, grow: 0 }));
  function flashAt(kind: number, x: number, z: number, facing: number, reach: number, width: number, span: number, color: THREE.Color, grow = 0): void {
    let slot = flashes[0] as Flash;
    for (const f of flashes) if (f.life <= 0 || f.life < slot.life) slot = f;
    Object.assign(slot, { kind, x, z, facing, reach, width, life: span, span, color, grow });
  }

  const spot = { x: 0, y: 0, z: 0 };
  function effect(id: Parameters<GameView['effects']['play']>[0], x: number, z: number, lift = 0.4, color?: number, scale?: number): void {
    spot.x = x; spot.z = z; spot.y = groundY(x, z) + lift;
    view.effects.play(id, spot, color === undefined && scale === undefined ? undefined : { color, scale });
  }
  const sound = (event: Parameters<NonNullable<GameView['audio']>['emit']>[0]): void => { view.audio?.emit(event); };

  // ---------------------------------------------------------------- the shake of the screen
  const lens = view.ctx.camera as THREE.PerspectiveCamera;
  /** Pixels at its start, seconds it lasts, seconds left. */
  let shakePx = 0, shakeTime = 1, shakeLeft = 0, shakeClock = 0, offset = false, shaken = 0;
  function shake(px: number, time: number): void {
    if (!feel.shakes || view.settings.graphics.reduceMotion) return;
    // A stronger shake takes over. A weaker one does not cut a stronger one short.
    if (shakeLeft > 0 && shakePx * (shakeLeft / shakeTime) > px) return;
    shakePx = px;
    shakeTime = shakeLeft = time;
  }
  function frame(dt: number): void {
    pointing = Math.max(0, pointing - dt);
    shakeClock += dt;
    if (shakeLeft > 0 && feel.shakes) {
      shakeLeft = Math.max(0, shakeLeft - dt);
      const k = shakeLeft / shakeTime, w = view.canvas.clientWidth || innerWidth, h = view.canvas.clientHeight || innerHeight;
      // As far as the shake says, in a direction that turns fast and unevenly, so it does not slide along one line.
      const turn = shakeClock * 97 + Math.sin(shakeClock * 53) * 2, dx = Math.cos(turn) * shakePx * k, dy = Math.sin(turn) * shakePx * k;
      lens.setViewOffset(w, h, dx, dy, w, h);
      offset = true;
      shaken = Math.hypot(dx, dy);
    } else if (offset) {
      lens.clearViewOffset();
      offset = false;
      shaken = 0;
    }
  }

  const feel: Feel = {
    freeze: 0,
    shakes: true,
    get shaken() { return shaken; },
    get pointing() { return pointing; },
    hero: jolt(),
    pet: jolt(),
    flashes,
    hear,
    frame,
  };
  const stop = (frames: number): void => { feel.freeze = Math.max(feel.freeze, frames / 60); };
  let pointing = 0;
  const heroJolt = feel.hero, petJolt = feel.pet;

  function hear(e: FightEvent): void {
    spot.x = e.x; spot.z = e.z; spot.y = groundY(e.x, e.z) + 0.5;
    switch (e.type) {
      case 'brought': effect('pop', e.x, e.z, 0.05); break;
      case 'wake': sound({ type: 'pet', mood: 'alert', at: spot }); break;
      case 'tell': sound({ type: 'pet', mood: 'curious', at: spot }); break;
      case 'strike': if (e.text === 'needles' || e.text === 'stomp' || e.text === 'spin') { effect('popDust', e.x, e.z, 0.1, undefined, 2); sound({ type: 'land', surface: 'grass', at: spot }); } break;
      case 'swing': {
        // A spin's ring shows as it starts. A cut's arc is drawn as it lands, by `draw.ts`.
        const h = fight.hero;
        if (e.n === 3) flashAt(MARK.circle, h.x, h.z, 0, HERO.spin.reach, 0, 0.2, PALE);
        sound({ type: 'jump', at: spot });
        break;
      }
      case 'hit':
        stop(e.n === 3 ? 6 : 4);
        if (e.n === 3) shake(SHAKE.spin.px, SHAKE.spin.time);
        effect('chips', e.x, e.z, 0.5, 0xfff2c8, 0.5);
        sound({ type: 'hit', at: spot });
        break;
      case 'guard': { const d = nearest(e.x, e.z); if (d) { d.jolt.flash = 1; d.jolt.shake = 0.12; d.jolt.squash = 1; } break; }
      case 'charged': effect('trail', e.x, e.z, 0.6, 0xfff2c8, 0.5); sound({ type: 'ui', sound: 'open' }); break;
      case 'dodge': effect('dust', e.x, e.z, 0.05); sound({ type: 'jump', at: spot }); break;
      case 'dodged': effect('trail', e.x, e.z, 0.8, 0x9ff5e6, 0.4); break;
      case 'heroHurt':
        stop(5);
        heroJolt.flash = 1;
        heroJolt.shake = e.n ? 0.2 : 0.12;
        if (e.n) shake(SHAKE.heavy.px, SHAKE.heavy.time);
        sound({ type: 'hit', at: spot });
        effect('dust', e.x, e.z, 0.3);
        break;
      case 'faint': sound({ type: 'pet', mood: 'sad', at: spot }); break;
      case 'segment': stop(8); effect('pop', e.x, e.z, 0.1); sound({ type: 'blockBroken', surface: 'stone', at: spot }); break;
      case 'dizzy': stop(6); effect('pop', e.x, e.z, 0.1); sound({ type: 'ui', sound: 'open' }); break;
      case 'crash': stop(8); effect('chips', e.x, e.z, 0.8, 0xc9c4b6, 1.5); effect('popDust', e.x, e.z, 0.3, undefined, 2); sound({ type: 'blockBroken', surface: 'stone', at: spot }); break;
      case 'stall': effect('splash', e.x, e.z, 0.1); break;
      case 'calmed': {
        // The release: 10 frames of freeze on a bright frame. The rest of the moment plays on the drawn beast's
        // own clock, from the end of the freeze (`calm.ts`). The stinger waits for the bow.
        stop(10);
        const d = nearest(e.x, e.z);
        if (d) { d.calmOn = true; d.calmT = -CALM.release; }
        sound({ type: 'spell', element: 'bloom', at: spot });
        say(`It leaves you something: ${e.text}.`);
        break;
      }
      case 'bolt': sound({ type: 'ui', sound: 'click' }); break;
      case 'boltHit': effect('trail', e.x, e.z, 0.6, 0x7df0d0, 0.35); sound({ type: 'pickup', at: spot }); break;
      case 'order': pointing = HERO.bolt.pose; flashAt(MARK.ring, e.x, e.z, 0, 1.2, 0.06, 0.35, TEAL, -0.6); break;
      case 'whistle': flashAt(MARK.ring, e.x, e.z, 0, 0.6, 0.05, 0.45, TEAL, 3); sound({ type: 'pet', mood: 'happy', at: spot }); break;
      case 'petStrike': stop(2); effect('chips', e.x, e.z, 0.4, 0xbff5d0, 0.3); sound({ type: 'hit', at: spot }); break;
      case 'petHurt': petJolt.flash = 1; petJolt.shake = 0.1; sound({ type: 'pet', mood: 'sad', at: spot }); break;
      case 'petFaint': effect('popDust', e.x, e.z, 0.2); say(`${fight.pet.def.name} is down. It rests a while.`); break;
      case 'petUp': sound({ type: 'pet', mood: 'happy', at: spot }); break;
      case 'skill': flashAt(MARK.ring, e.x, e.z, 0, 0.9, 0.07, 0.4, TEAL, 1.5); sound({ type: 'pet', mood: 'alert', at: spot }); break;
      case 'blocked': stop(8); effect('pop', e.x, e.z, 0.2); sound({ type: 'blockBroken', surface: 'stone', at: spot }); break;
      case 'rigPlaced': sound({ type: 'blockPlaced', surface: 'wood', at: spot }); break;
      case 'rig': stop(6); effect('pop', e.x, e.z, 0.1); effect('trail', e.x, e.z, 0.5, e.text === 'channel' ? 0x9fd8ff : 0x7df0d0, 0.8); sound({ type: 'machine', at: spot }); break;
      case 'denied': say(e.text); break;
      default: break;
    }
  }

  return feel;
}
