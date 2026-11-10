// The camera: by default a long lens looking down at about 35 degrees. It follows a point, turns in
// quarter turns with Q and E, zooms in steps with the wheel, and works out the cutaway. `profiles.ts`
// holds other places to put it.
//
// It has three modes. `tilt` is that 2.5D camera. `free` orbits the hero at any yaw with the mouse and pulls in
// when a block is in the way. `first` looks from the hero's eyes. The free and first-person cameras cut nothing
// away: the free one never has a block between it and the hero, and the first-person one is the hero.
import type * as THREE from 'three';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import { CameraRig, type PerStep, type RigOptions } from './rig.sim.ts';
import { CutawayRule, type BlockProbe, type CutawayOptions, type CutawayState } from './cutaway.sim.ts';
import { FIRST_PERSON, FREE_ORBIT, OrbitRig, type OrbitOptions } from './orbit.sim.ts';
import { LOOK_PROFILES, type LookProfile } from './profiles.ts';

/** `tilt` is the 2.5D camera, `free` orbits the hero, `first` looks from the eyes. */
export type CameraMode = 'tilt' | 'free' | 'first';

export interface CameraOptions {
  /** The blocks to test for roofs and hills. Without it there is no cutaway. */
  blocks?: BlockProbe;
  /** Listen for Q, E and the wheel. Pass false when another feature owns input, and call `turn` and `zoomBy`. */
  input?: boolean;
  /** The lens: the vertical field of view in degrees. Small is long. One per zoom step glides with the zoom. */
  fov?: PerStep;
  rig?: Partial<RigOptions>;
  cutaway?: Partial<CutawayOptions>;
  /** The mode to start in. `tilt` by default. */
  mode?: CameraMode;
  free?: Partial<OrbitOptions>;
  first?: Partial<OrbitOptions>;
  /** The lens and the range of the free and first-person cameras. */
  looks?: Partial<Record<'free' | 'first', LookProfile>>;
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
  /** What to hide so the hero stays in view. Hand it to the world. The free and first-person cameras hide nothing. */
  readonly cutaway: CutawayState;
  /** True when the cutaway hides this block. Hand it to a ray cast so clicks pass through hidden blocks. */
  hides(x: number, y: number, z: number): boolean;

  readonly mode: CameraMode;
  /** Changes the mode at once. The free and first-person cameras start looking the way the camera looked. */
  setMode(mode: CameraMode): void;
  /** Free and first person: turns the view. Positive `yaw` turns to the left, positive `pitch` looks down. Radians. */
  look(yaw: number, pitch: number): void;
  /** Free and first person: sets the view exactly, within its limits. `distance` is the free camera's. */
  setLook(yaw: number, pitch: number, distance?: number): void;
  /** Free and first person: turns the view so the middle of the screen falls on this point. */
  aimAt(x: number, y: number, z: number): void;
  /** How far the view looks down right now, in radians, in any mode. */
  readonly pitch: number;
  /** The free camera's distance from the hero as asked for, and as it is with collisions. 0 in first person. */
  readonly distance: number;
  readonly reach: number;
  /** The lens and range of the current free or first-person mode, or null in the 2.5D one. */
  readonly profile: LookProfile | null;
}

/** What the free and first-person cameras hand the world: nothing is cut, and the sight point stays on the hero. */
function openCutaway(): CutawayState {
  // A sight radius just over 0 tells the world where the hero is without boring a tunnel.
  return { mode: 'open', x: 0, y: 0, z: 0, radius: 0, soft: 1, column: false, sightX: 0, sightY: 0, sightZ: 0, sightRadius: 0.001 };
}

export function createCamera(ctx: ViewContext, options: CameraOptions = {}): CameraView {
  const rig = new CameraRig(options.rig);
  const rule = new CutawayRule(options.cutaway);
  const fov = options.fov ?? 20;
  const target = { x: 0, y: 0, z: 0 };
  const stop = new AbortController();
  const free = new OrbitRig({ ...FREE_ORBIT, ...options.free });
  const first = new OrbitRig({ ...FIRST_PERSON, ...options.first });
  const looks = { ...LOOK_PROFILES, ...options.looks };
  const open = openCutaway();
  let mode: CameraMode = options.mode ?? 'tilt';
  const orbit = (): OrbitRig => (mode === 'first' ? first : free);

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

  function snap(): void {
    if (mode === 'tilt') rig.snap(target.x, target.y, target.z);
    else orbit().snap(target.x, target.y, target.z, options.blocks);
  }

  return {
    follow(x, y, z) {
      target.x = x; target.y = y; target.z = z;
    },
    snap,
    turn(direction) {
      if (mode === 'tilt') rig.turn(direction);
    },
    zoomBy(steps) {
      if (mode === 'tilt') rig.zoomBy(steps);
      else if (mode === 'free') free.zoomBy(steps);
    },
    get quarter() {
      if (mode === 'tilt') return rig.quarter;
      // The quarter nearest the way the free camera looks, counted as the 2.5D rig counts it.
      const turns = Math.round((orbit().yaw - rig.options.baseYaw) / (Math.PI / 2));
      return ((turns % 4) + 4) % 4;
    },
    get yaw() { return mode === 'tilt' ? rig.yaw : orbit().yaw; },
    get zoom() { return rig.zoom; },
    get aim() { return mode === 'tilt' ? rig.aim : orbit().pitch; },
    stepped: (value) => rig.step(value),
    get cutaway() { return mode === 'tilt' ? rule.state : open; },
    hides: (x, y, z) => mode === 'tilt' && rule.hides(x, y, z),

    get mode() { return mode; },
    setMode(next) {
      if (next === mode) return;
      const yaw = mode === 'tilt' ? rig.yaw : orbit().yaw;
      mode = next;
      if (mode !== 'tilt') {
        // The new camera looks the same way along the ground, at its own pitch.
        const o = orbit();
        o.set(yaw, o.pitch);
      }
      snap();
    },
    look(yaw, pitch) {
      if (mode !== 'tilt') orbit().turn(yaw, pitch);
    },
    setLook(yaw, pitch, distance) {
      if (mode === 'tilt') return;
      orbit().set(yaw, pitch, mode === 'free' ? distance : undefined);
      orbit().update(0, target.x, target.y, target.z, options.blocks);
    },
    aimAt(x, y, z) {
      if (mode !== 'tilt') orbit().aimAt(x, y, z, options.blocks);
    },
    get pitch() { return mode === 'tilt' ? rig.pitch : orbit().pitch; },
    get distance() { return mode === 'tilt' ? rig.distance : orbit().distance; },
    get reach() { return mode === 'tilt' ? rig.distance : orbit().reach; },
    get profile() { return mode === 'tilt' ? null : looks[mode]; },

    update(dt, frame) {
      if (mode !== 'tilt') {
        const o = orbit(), look = looks[mode], camera = frame.camera;
        o.update(dt, target.x, target.y, target.z, options.blocks);
        camera.position.set(o.position.x, o.position.y, o.position.z);
        camera.lookAt(o.position.x + o.forward.x, o.position.y + o.forward.y, o.position.z + o.forward.z);
        camera.near = look.near;
        camera.far = look.far;
        if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) (camera as THREE.PerspectiveCamera).fov = look.fov;
        camera.updateProjectionMatrix();
        open.x = open.sightX = target.x; open.z = open.sightZ = target.z;
        open.y = target.y; open.sightY = target.y + 1.1;
        return;
      }
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
