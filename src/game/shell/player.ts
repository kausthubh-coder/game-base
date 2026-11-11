// The player's body in the game: the hero feature's `HeroBody`, steered by the keys relative to the
// camera. After every step it writes `game.player`, and it passes the body's footsteps, jumps and
// landings on as game events. Nothing here draws.
import { createBus, type GameEvent } from '../../engine/events.ts';
import type { Vec3 } from '../../engine/types.ts';
import { HERO_STEP, HeroBody, type HeroInput } from '../../features/hero/index.ts';
import type { World } from '../../features/world/index.ts';
import type { Actor, Game } from '../api.sim.ts';
import { facingOf } from '../move.sim.ts';
import type { Keys } from './keys.ts';

/** Blocks a second with Shift held. A leaftail is startled by anything faster. */
export const SOFT_SPEED = 2.0;
/** Faster than this along the ground, in blocks a second, shows the walk animation. */
const MOVING = 0.4;

export interface PlayerRig {
  readonly body: HeroBody;
  /** Where the feet are drawn this frame: the body's last two steps, blended. */
  readonly position: Vec3;
  /** The player as an actor, so the sprite layer draws it like everyone else. */
  readonly actor: Actor;
  /**
   * One step of the body, `HERO_STEP` long. `yaw` is the camera's, so W walks away from the camera. With
   * `faceView` the body turns to look where the camera looks, as it does in first person.
   */
  step(yaw: number, faceView?: boolean): void;
  /** Sets the drawn position between the last two steps. `blend` is 0 to 1, `dt` the seconds since the last frame. */
  blend(blend: number, dt?: number): void;
  teleport(x: number, y: number, z: number, facing?: number): void;
  /**
   * A view that moves the hero itself for a moment (a dodge, a push, a faint) sets this. It is called before
   * every step of the body with what the keys asked for, and may change that input and the body. Null, the
   * default, leaves the body to the keys. The fight lab is the one user.
   */
  steer: ((input: HeroInput, body: HeroBody) => void) | null;
}

export interface PlayerOptions {
  /** The height of a ledge the hero walks up without a jump. See `HeroTuning.stepUp`. */
  stepUp?: number;
  /** How far above the block it stands on the hero is drawn: the painted land's lift. */
  lift?: (x: number, y: number, z: number) => number;
  /**
   * Where the hero is drawn when natural ground holds them up at block height `y`: on the smooth land. NaN when
   * they stand on something built. Left out, the hero is drawn at their block height plus `lift`.
   */
  standAt?: (x: number, y: number, z: number) => number;
}

export function createPlayer(game: Game, world: World, keys: Keys, spawn: Vec3, options: PlayerOptions = {}): PlayerRig {
  const bus = createBus<GameEvent>();
  bus.on((event) => {
    if (event.type === 'footstep') game.events.emit('footstep', { surface: event.surface, at: event.at });
    else if (event.type === 'jump') game.events.emit('jump', { at: event.at });
    else if (event.type === 'land') game.events.emit('land', { surface: event.surface, at: event.at });
  });

  const body = new HeroBody(world, spawn, bus, { stepUp: options.stepUp ?? 0 });
  const lift = options.lift ?? (() => 0);
  const standAt = options.standAt ?? (() => NaN);
  // The hero is drawn on the land while they stand or walk on it, and at their own height while they jump or
  // stand on something built. `onLand` says which it was last frame. When it changes, `carry` holds the
  // difference and lets it go in a sixth of a second, so the hero never snaps from one to the other.
  // `walkedOff` is true from the step the hero walks off a ledge until they land: down a one-block step they
  // are drawn walking down the slope, where a jump is drawn as a jump.
  let onLand = false, carry = 0, drawn = spawn.y, walkedOff = false;
  /** True after the hero was set down somewhere: the next frame draws them where they are, with nothing carried over. */
  let fresh = true;
  // South, toward the camera's starting side, so a new game opens on the hero's face.
  body.facing = Math.PI;
  const position = { ...spawn };
  const previous = { ...spawn };
  const input = { moveX: 0, moveZ: 0, jump: false };
  const actor: Actor = { id: 'player', sprite: 'hero', pos: position, facing: body.facing, anim: 'idle', visible: true };
  game.actors.set(actor.id, actor);

  function write(): void {
    const p = game.player;
    p.pos.x = body.x; p.pos.y = body.y; p.pos.z = body.z;
    p.facing = body.facing;
    p.onGround = body.grounded;
    p.inWater = body.swimming;
    const speed = Math.hypot(body.vx, body.vz);
    const breaking = game.systems.actions?.breaking() ?? null;
    // Standing and breaking something: turn to it, so the hero works on what is in front of them.
    if (breaking && speed < MOVING) {
      const tx = breaking.tree ? (breaking.tree.x0 + breaking.tree.x1) / 2 : breaking.x + 0.5;
      const tz = breaking.tree ? (breaking.tree.z0 + breaking.tree.z1) / 2 : breaking.z + 0.5;
      if (Math.hypot(tx - body.x, tz - body.z) > 0.2) body.facing = facingOf(tx - body.x, tz - body.z);
      p.facing = body.facing;
    }
    actor.facing = body.facing;
    // The swing is its own sheet, in the hero's style and seen from every side. The hero sheet's tool row is
    // drawn in another style and to one side only, so it is never played.
    const swinging = breaking !== null && speed < MOVING;
    actor.sprite = swinging ? 'hero-swing' : 'hero';
    actor.anim = swinging ? 'tool' : speed > MOVING ? 'walk' : 'idle';
  }
  write();

  const rig: PlayerRig = {
    body,
    position,
    actor,
    steer: null,

    step(yaw, faceView = false) {
      // The way the camera looks along the ground. Yaw 0 looks north and grows counter-clockwise.
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const busy = game.player.busy;
      const right = busy ? 0 : keys.right, forward = busy ? 0 : keys.forward;
      const pace = keys.soft ? SOFT_SPEED / body.tuning.walkSpeed : 1;
      const length = Math.hypot(right, forward) || 1;
      input.moveX = ((fx * forward - fz * right) / length) * pace;
      input.moveZ = ((fz * forward + fx * right) / length) * pace;
      input.jump = !busy && keys.jump;
      rig.steer?.(input, body);
      previous.x = body.x; previous.y = body.y; previous.z = body.z;
      const stood = body.grounded;
      body.step(input);
      if (body.grounded) walkedOff = false;
      else if (stood) walkedOff = body.vy <= 0;
      // Facing 0 is north and grows toward the east, the other way round from the camera's yaw.
      if (faceView) body.facing = -yaw;
      write();
    },

    blend(blend, dt = 1 / 60) {
      position.x = previous.x + (body.x - previous.x) * blend;
      const y = previous.y + (body.y - previous.y) * blend - (body.swimming ? 0.25 : 0);
      position.z = previous.z + (body.z - previous.z) * blend;
      // On the ground, or stepping down off a ledge one block high: the land under the hero's middle.
      const stood = body.swimming ? NaN : body.grounded ? standAt(position.x, body.y, position.z) : walkedOff ? standAt(position.x, Math.floor(body.y + 0.001), position.z) : NaN;
      const land = stood === stood;
      const target = land ? stood : y + lift(position.x, y, position.z);
      if (land !== onLand) {
        onLand = land;
        const gap = drawn - target;
        carry = !fresh && Math.abs(gap) < 1.6 ? gap : 0;
      }
      fresh = false;
      carry *= Math.exp(-dt * 18);
      position.y = drawn = target + carry;
    },

    teleport(x, y, z, facing) {
      body.teleport(x, y, z);
      if (facing !== undefined) body.facing = facing;
      previous.x = position.x = x; previous.y = position.y = drawn = y; previous.z = position.z = z;
      carry = 0; onLand = false; walkedOff = false; fresh = true;
      write();
    },
  };
  return rig;
}

export { HERO_STEP };
