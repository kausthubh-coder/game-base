// The camera: by default a long lens looking down at about 35 degrees. It follows a point, turns in
// quarter turns with Q and E, zooms in steps with the wheel, and works out the cutaway. `profiles.ts`
// holds other places to put it.
import type * as THREE from 'three';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import { CameraRig, type PerStep, type RigOptions } from './rig.sim.ts';
import { CutawayRule, type BlockProbe, type CutawayOptions, type CutawayState } from './cutaway.sim.ts';

export interface CameraOptions {
  /** The blocks to test for roofs and hills. Without it there is no cutaway. */
  blocks?: BlockProbe;
  /** Listen for Q, E and the wheel. Pass false when another feature owns input, and call `turn` and `zoomBy`. */
  input?: boolean;
  /** The lens: the vertical field of view in degrees. Small is long. One per zoom step glides with the zoom. */
  fov?: PerStep;
  rig?: Partial<RigOptions>;
  cutaway?: Partial<CutawayOptions>;
}

export interface CameraView extends ViewSystem {
  /** The point to follow: where the hero's feet are. Call it every frame. */
  follow(x: number, y: number, z: number): void;
  /** Jump to the followed point with no glide. */
  snap(): void;
  /** 1 turns the view a quarter turn to the right, -1 to the left. */
  turn(direction: 1 | -1): void;
  /** Positive zooms out one step, negative zooms in. */
  zoomBy(steps: number): void;
  /** Quarter turns from the start, 0 to 3, counter-clockwise seen from above. Sprites pick their facing with it. */
  readonly quarter: number;
  /** The yaw right now in radians, -PI to PI. 0 looks north. It glides during a turn. */
  readonly yaw: number;
  readonly zoom: number;
  /** How far the view looks down right now, in radians. 0 is level. */
  readonly aim: number;
  /** A value given per zoom step, at the zoom right now: it glides between steps as the zoom does. */
  stepped(value: PerStep): number;
  /** What to hide so the hero stays in view. Hand it to the world. */
  readonly cutaway: CutawayState;
  /** True when the cutaway hides this block. Hand it to a ray cast so clicks pass through hidden blocks. */
  hides(x: number, y: number, z: number): boolean;
}

export function createCamera(ctx: ViewContext, options: CameraOptions = {}): CameraView {
  const rig = new CameraRig(options.rig);
  const rule = new CutawayRule(options.cutaway);
  const fov = options.fov ?? 20;
  const target = { x: 0, y: 0, z: 0 };
  const stop = new AbortController();

  if (options.input !== false) {
    const element = ctx.renderer.domElement;
    let wheel = 0, lastStep = 0;
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyQ') rig.turn(-1);
      else if (e.code === 'KeyE') rig.turn(1);
    }, { signal: stop.signal });
    // A mouse wheel sends one big step and a trackpad many small ones. Either way one gesture is one zoom step.
    element.addEventListener('wheel', (e) => {
      e.preventDefault();
      wheel += e.deltaY;
      if (Math.abs(wheel) < 40 || e.timeStamp - lastStep < 220) return;
      rig.zoomBy(Math.sign(wheel));
      wheel = 0;
      lastStep = e.timeStamp;
    }, { passive: false, signal: stop.signal });
  }

  return {
    follow(x, y, z) {
      target.x = x; target.y = y; target.z = z;
    },
    snap() {
      rig.snap(target.x, target.y, target.z);
    },
    turn: (direction) => rig.turn(direction),
    zoomBy: (steps) => rig.zoomBy(steps),
    get quarter() { return rig.quarter; },
    get yaw() { return rig.yaw; },
    get zoom() { return rig.zoom; },
    get aim() { return rig.aim; },
    stepped: (value) => rig.step(value),
    cutaway: rule.state,
    hides: (x, y, z) => rule.hides(x, y, z),

    update(dt, frame) {
      rig.update(dt, target.x, target.y, target.z);
      const camera = frame.camera;
      camera.position.set(rig.position.x, rig.position.y, rig.position.z);
      camera.lookAt(rig.gaze.x, rig.gaze.y, rig.gaze.z);
      const lens = rig.step(fov);
      camera.near = Math.max(1, rig.distance - 70);
      camera.far = rig.distance + 220;
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        (camera as THREE.PerspectiveCamera).fov = lens;
      } else {
        // An orthographic camera shows the same height of world as the long lens does at this distance.
        const ortho = camera as THREE.OrthographicCamera;
        const half = Math.tan((lens * Math.PI) / 360) * rig.distance;
        const aspect = (ortho.right - ortho.left) / (ortho.top - ortho.bottom) || 1;
        ortho.top = half; ortho.bottom = -half; ortho.left = -half * aspect; ortho.right = half * aspect;
      }
      camera.updateProjectionMatrix();
      if (options.blocks) rule.update(dt, options.blocks, target.x, target.y, target.z, rig.position.x, rig.position.y, rig.position.z);
    },

    dispose() {
      stop.abort();
    },
  };
}
