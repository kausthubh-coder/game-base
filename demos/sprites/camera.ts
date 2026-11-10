// The demo's camera: the game's long lens looking down at 35 degrees, with quarter turns and zoom
// steps. It is a small copy of the camera feature's rig, so this demo depends on no other feature.
import * as THREE from 'three';

const PITCH = (35 * Math.PI) / 180;
const BASE_YAW = Math.PI / 4;
const QUARTER = Math.PI / 2;
const TURN_SECONDS = 0.3;
/** Distance to the focus at each zoom step, nearest first. Steps 2 to 4 are the game's three. */
export const DISTANCES: readonly number[] = [13, 26, 46, 66, 94, 132];

export interface DemoCamera {
  readonly camera: THREE.PerspectiveCamera;
  /** Quarter turns from the start, 0 to 3, counter-clockwise seen from above. */
  readonly quarter: number;
  readonly zoom: number;
  /** The yaw right now. It glides during a turn. */
  readonly yaw: number;
  /** The point on the ground the camera looks at. */
  readonly focus: THREE.Vector3;
  /** 1 turns the view a quarter turn to the right, -1 to the left. */
  turn(direction: 1 | -1): void;
  /** Jumps to a quarter turn with no glide. */
  setQuarter(quarter: number): void;
  setZoom(step: number): void;
  resize(width: number, height: number): void;
  update(dt: number): void;
}

export function createDemoCamera(): DemoCamera {
  const camera = new THREE.PerspectiveCamera(20, 1, 1, 600);
  const focus = new THREE.Vector3();
  let turns = 0, zoom = 3;
  // Numbers that change every frame are fields of one object, so writing them makes no garbage.
  const now = { yaw: BASE_YAW, yawFrom: BASE_YAW, turn: 1, distance: DISTANCES[zoom] };
  const look = new THREE.Vector3();

  function place(): void {
    const flat = Math.cos(PITCH) * now.distance;
    // The camera looks at the middle of a character, not at its feet.
    look.set(focus.x, focus.y + 1, focus.z);
    camera.position.set(look.x + Math.sin(now.yaw) * flat, look.y + Math.sin(PITCH) * now.distance, look.z + Math.cos(now.yaw) * flat);
    camera.lookAt(look);
    camera.updateMatrixWorld();
  }
  place();

  return {
    camera, focus,
    get quarter() { return ((turns % 4) + 4) % 4; },
    get zoom() { return zoom; },
    get yaw() { return now.yaw; },
    turn(direction) {
      turns -= direction;
      now.yawFrom = now.yaw;
      now.turn = 0;
    },
    setQuarter(quarter) {
      turns = quarter;
      now.yaw = now.yawFrom = BASE_YAW + turns * QUARTER;
      now.turn = 1;
      place();
    },
    setZoom(step) {
      zoom = Math.max(0, Math.min(DISTANCES.length - 1, Math.round(step)));
    },
    resize(width, height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    update(dt) {
      const goal = BASE_YAW + turns * QUARTER;
      if (now.turn < 1) {
        now.turn = Math.min(1, now.turn + dt / TURN_SECONDS);
        const t = now.turn * now.turn * (3 - 2 * now.turn);
        now.yaw = now.yawFrom + (goal - now.yawFrom) * t;
      } else {
        now.yaw = goal;
      }
      now.distance += (DISTANCES[zoom] - now.distance) * (1 - Math.exp(-10 * dt));
      if (Math.abs(DISTANCES[zoom] - now.distance) < 0.01) now.distance = DISTANCES[zoom];
      place();
    },
  };
}
