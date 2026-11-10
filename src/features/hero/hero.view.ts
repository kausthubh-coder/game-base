// The hero on screen: a plain placeholder that walks with WASD relative to the camera. The sprite
// system replaces the drawing later and keeps the body.
import * as THREE from 'three';
import type { Bus, GameEvent } from '../../engine/events.ts';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Vec3 } from '../../engine/types.ts';
import { HERO_STEP, HeroBody, type BlockSource, type HeroTuning } from './hero.sim.ts';

export interface HeroOptions {
  /** The blocks to collide with. */
  blocks: BlockSource;
  spawn: Vec3;
  /** Footstep, jump and land events go here. */
  bus?: Bus<GameEvent>;
  /** Listen for WASD, the arrow keys and space. Pass false when another feature owns input, and call `control`. */
  input?: boolean;
  tuning?: Partial<HeroTuning>;
}

export interface HeroView extends ViewSystem {
  /** The body as rules. */
  readonly body: HeroBody;
  /** Where the feet are drawn this frame. Smoother than the body, which moves in fixed steps. */
  readonly position: Vec3;
  /** Steers the body: `right` and `forward` are -1 to 1 relative to the camera. It replaces the keys until `control(null)`. */
  control(steer: { right: number; forward: number; jump: boolean } | null): void;
  teleport(x: number, y: number, z: number): void;
}

export function createHero(ctx: ViewContext, options: HeroOptions): HeroView {
  const body = new HeroBody(options.blocks, options.spawn, options.bus, options.tuning);
  const position = { ...options.spawn };
  const previous = { ...options.spawn };
  const stop = new AbortController();
  const keys = new Set<string>();
  let steer: { right: number; forward: number; jump: boolean } | null = null;

  if (options.input !== false) {
    window.addEventListener('keydown', (e) => { if (!e.ctrlKey && !e.metaKey) keys.add(e.code); }, { signal: stop.signal });
    window.addEventListener('keyup', (e) => keys.delete(e.code), { signal: stop.signal });
    window.addEventListener('blur', () => keys.clear(), { signal: stop.signal });
  }

  // The placeholder: a body, a head and a nose that shows which way it faces.
  const figure = new THREE.Group();
  figure.name = 'hero';
  const cloth = new THREE.MeshLambertMaterial({ color: 0xd8663a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const part = (material: THREE.Material, w: number, h: number, d: number, y: number, z = 0): void => {
    const mesh = new THREE.Mesh(box, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(0, y, z);
    mesh.castShadow = true;
    figure.add(mesh);
  };
  part(cloth, 0.56, 1.2, 0.36, 0.6);
  part(skin, 0.5, 0.5, 0.46, 1.5);
  part(cloth, 0.14, 0.12, 0.1, 1.48, -0.27);
  ctx.scene.add(figure);

  const input = { moveX: 0, moveZ: 0, jump: false };
  const look = new THREE.Vector3();
  const clothColor = new THREE.Color(0xd8663a), skinColor = new THREE.Color(0xf0c8a0);
  let carry = 0, facing = 0;

  return {
    body,
    position,

    control(next) {
      steer = next;
    },

    teleport(x, y, z) {
      body.teleport(x, y, z);
      position.x = previous.x = x; position.y = previous.y = y; position.z = previous.z = z;
    },

    update(dt, frame) {
      // Forward is the way the camera looks along the ground.
      frame.camera.getWorldDirection(look);
      const flat = Math.hypot(look.x, look.z) || 1;
      const fx = look.x / flat, fz = look.z / flat;
      const right = steer ? steer.right : (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const forward = steer ? steer.forward : (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      input.moveX = fx * forward - fz * right;
      input.moveZ = fz * forward + fx * right;
      input.jump = steer ? steer.jump : keys.has('Space');

      // Fixed steps, with the drawn position blended between the last two, so motion is smooth at any frame rate.
      carry = Math.min(carry + dt, 0.25);
      while (carry >= HERO_STEP) {
        previous.x = body.x; previous.y = body.y; previous.z = body.z;
        body.step(input);
        carry -= HERO_STEP;
      }
      const blend = carry / HERO_STEP;
      position.x = previous.x + (body.x - previous.x) * blend;
      position.y = previous.y + (body.y - previous.y) * blend;
      position.z = previous.z + (body.z - previous.z) * blend;

      let turn = body.facing - facing;
      turn -= Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
      facing += turn * (1 - Math.exp(-14 * dt));
      figure.position.set(position.x, position.y - (body.swimming ? 0.25 : 0), position.z);
      figure.rotation.y = -facing;

      // The placeholder takes the light of the block it stands in, so it does not glow in a cave.
      const shade = 0.3 + 0.7 * (frame.world.lightAt(position.x, position.y + 1, position.z) / 15);
      cloth.color.copy(clothColor).multiplyScalar(shade);
      skin.color.copy(skinColor).multiplyScalar(shade);
      const lamp = Math.pow(0.8, 15 - (options.blocks.blockLightAt?.(position.x, position.y + 1, position.z) ?? 0)) * 0.55;
      cloth.emissive.copy(clothColor).multiplyScalar(lamp);
      skin.emissive.copy(skinColor).multiplyScalar(lamp);
    },

    dispose() {
      stop.abort();
      ctx.scene.remove(figure);
      box.dispose();
      cloth.dispose();
      skin.dispose();
    },
  };
}
