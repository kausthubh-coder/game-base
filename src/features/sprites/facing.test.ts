import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { VIEW_BACK, VIEW_FRONT, VIEW_SIDE_LEFT, VIEW_SIDE_RIGHT, cameraYawOf, pickView } from './facing.ts';

const EIGHTH = Math.PI / 4;
// The eight ways a character can face, as the hero's body counts them: 0 is north, then clockwise seen from above.
const FACINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const facingOf = (name: (typeof FACINGS)[number]): number => FACINGS.indexOf(name) * EIGHTH;

const NAMES: Record<number, string> = { [VIEW_FRONT]: 'front', [VIEW_BACK]: 'back', [VIEW_SIDE_RIGHT]: 'side', [VIEW_SIDE_LEFT]: 'side mirrored' };
const F = 'front', B = 'back', R = 'side', L = 'side mirrored';

/** The camera rig's yaw at each quarter turn: it starts at 45 degrees, south-east of what it looks at. */
const rigYaw = (quarter: number): number => EIGHTH + quarter * 2 * EIGHTH;

// Worked out by hand. At quarter 0 the camera stands south-east and looks north-west, so east and
// north are both toward the right of the screen, and a character facing south-east faces the camera.
const BY_QUARTER: Record<number, string[]> = {
  //   N  NE  E  SE  S  SW  W  NW
  0: [R, R, R, F, L, L, L, B], // camera south-east
  1: [R, F, L, L, L, B, R, R], // camera north-east
  2: [L, L, L, B, R, R, R, F], // camera north-west
  3: [L, B, R, R, R, F, L, L], // camera south-west
};

test('the row and the mirror for each of 8 facings at each of the 4 camera turns', () => {
  for (let quarter = 0; quarter < 4; quarter++) {
    const picked = FACINGS.map((name) => NAMES[pickView(facingOf(name), rigYaw(quarter))]);
    expect({ quarter, picked }).toEqual({ quarter, picked: BY_QUARTER[quarter] });
  }
});

test('with a camera square to the grid, the four straight facings are front, back and the two sides', () => {
  // The camera stands south and looks north: east is the right of the screen.
  //                N  NE  E  SE  S  SW  W  NW
  const south = [B, R, R, R, F, L, L, L];
  expect(FACINGS.map((name) => NAMES[pickView(facingOf(name), 0)])).toEqual(south);
  // A quarter turn: the camera stands east and looks west, so north is the right of the screen.
  const east = [R, R, F, L, L, L, B, R];
  expect(FACINGS.map((name) => NAMES[pickView(facingOf(name), Math.PI / 2)])).toEqual(east);
});

test('the pick matches where the character points on the screen, for every angle', () => {
  // A second way to work it out: project the facing onto the screen's right and onto the line to the camera.
  for (let yawStep = 0; yawStep < 64; yawStep++) {
    const yaw = (yawStep / 64) * Math.PI * 2 - Math.PI;
    for (let step = 0; step < 720; step++) {
      const facing = (step / 720) * Math.PI * 2 + 0.001;
      const fx = Math.sin(facing), fz = -Math.cos(facing);
      const toward = fx * Math.sin(yaw) + fz * Math.cos(yaw);
      const right = fx * Math.cos(yaw) - fz * Math.sin(yaw);
      // Skip the four angles within a hair of a boundary, where rounding decides.
      if (Math.abs(Math.abs(toward) - Math.abs(right)) < 1e-3) continue;
      const want = Math.abs(toward) > Math.abs(right) ? (toward > 0 ? F : B) : right > 0 ? R : L;
      expect({ yaw, facing, picked: NAMES[pickView(facing, yaw)] }).toEqual({ yaw, facing, picked: want });
    }
  }
});

test('a facing is the same after any number of full turns', () => {
  for (const name of FACINGS) {
    const base = pickView(facingOf(name), rigYaw(0));
    expect(pickView(facingOf(name) + Math.PI * 2, rigYaw(0))).toBe(base);
    expect(pickView(facingOf(name) - Math.PI * 6, rigYaw(0))).toBe(base);
    expect(pickView(facingOf(name), rigYaw(0) + Math.PI * 4)).toBe(base);
  }
});

test('the yaw is read from a real camera placed the way the rig places it', () => {
  const camera = new THREE.PerspectiveCamera(20, 16 / 9, 1, 400);
  const pitch = (35 * Math.PI) / 180;
  for (let quarter = 0; quarter < 4; quarter++) {
    const yaw = rigYaw(quarter);
    camera.position.set(5 + Math.sin(yaw) * Math.cos(pitch) * 66, 3 + Math.sin(pitch) * 66, -7 + Math.cos(yaw) * Math.cos(pitch) * 66);
    camera.lookAt(5, 3, -7);
    camera.updateMatrixWorld();
    const read = cameraYawOf(camera.matrixWorld.elements);
    // The same angle, whichever way round the circle it is written.
    expect(Math.cos(read - yaw)).toBeCloseTo(1, 6);
    expect(FACINGS.map((name) => NAMES[pickView(facingOf(name), read)])).toEqual(BY_QUARTER[quarter]);
  }
});

test('a camera looking straight down takes its yaw from the top of the screen', () => {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 100);
  camera.position.set(0, 50, 0);
  // Looking down with north at the top of the screen: the same as a camera to the south.
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  expect(Math.cos(cameraYawOf(camera.matrixWorld.elements))).toBeCloseTo(1, 6);
  expect(NAMES[pickView(facingOf('S'), cameraYawOf(camera.matrixWorld.elements))]).toBe(F);
  expect(NAMES[pickView(facingOf('E'), cameraYawOf(camera.matrixWorld.elements))]).toBe(R);
});

test('a drawing that is showing holds a little past the edge, so a swaying camera does not flip it', () => {
  // Facing south-east with the camera due south: 45 degrees, the edge between the front and the side.
  const facing = facingOf('SE');
  const edge = 0;
  const justFront = edge + 0.05, justSide = edge - 0.05;
  expect(NAMES[pickView(facing, justFront)]).toBe(F);
  expect(NAMES[pickView(facing, justSide)]).toBe(R);
  // Showing the front, a sway of a few degrees past the edge keeps the front.
  expect(NAMES[pickView(facing, justSide, VIEW_FRONT)]).toBe(F);
  // Further than the hold, the side shows.
  expect(NAMES[pickView(facing, edge - 0.3, VIEW_FRONT)]).toBe(R);
  // And back again: the side holds a little past the edge too.
  expect(NAMES[pickView(facing, justFront, VIEW_SIDE_RIGHT)]).toBe(R);
  expect(NAMES[pickView(facing, edge + 0.3, VIEW_SIDE_RIGHT)]).toBe(F);
});
