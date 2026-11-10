// Which drawing of a character the camera should see. A character is drawn from the front, the
// back and one side, and the side faces right. From the way the character faces in the world and
// the way the camera looks, this picks the row and says whether to mirror it. Plain numbers only.
//
// Angles follow the rest of the game:
//   facing     0 faces north (-z), a quarter turn (PI / 2) faces east (+x). The hero's body uses the same.
//   cameraYaw  0 is a camera south of its target looking north. It grows counter-clockwise seen from
//              above, so at a quarter turn the camera stands east and looks west. The camera rig uses the same.

/** The character faces the camera. */
export const VIEW_FRONT = 0;
/** The character faces away from the camera. */
export const VIEW_BACK = 1;
/** The character faces the right of the screen: the side row as drawn. */
export const VIEW_SIDE_RIGHT = 2;
/** The character faces the left of the screen: the side row mirrored. */
export const VIEW_SIDE_LEFT = 3;

export type SpriteView = typeof VIEW_FRONT | typeof VIEW_BACK | typeof VIEW_SIDE_RIGHT | typeof VIEW_SIDE_LEFT;

/**
 * The front and the back each own a quarter of the circle, a little less than 45 degrees to either
 * side. A character at exactly 45 degrees to the camera shows its side, like one walking diagonally
 * in a top-down game. The camera sits at 45 degrees to the block grid, so this is the common case:
 * someone walking straight north, east, south or west shows the side row.
 */
const FRONT_ARC = Math.cos(Math.PI / 4) + 1e-4;

/**
 * How far past the line between two drawings the angle must go before a character showing one switches to the
 * other. Walking diagonally to the camera sits right on such a line, and key timing and camera easing wobble the
 * angle by a hair, which without this flips the drawing every frame: front, side, front, side.
 */
const STICK = (10 * Math.PI) / 180;

/**
 * The drawing for this facing. Pass the drawing showing now as `current`, and it is kept until the angle is
 * clearly in another drawing's arc.
 */
export function pickView(facing: number, cameraYaw: number, current?: SpriteView): SpriteView {
  // 0 when the character looks straight at the camera, growing as it turns to the left of the screen.
  const turned = facing + cameraYaw - Math.PI;
  const view = viewOf(turned);
  if (current === undefined || view === current) return view;
  // Keep the drawing showing now while the angle is within its arc grown by STICK on each side.
  return viewOf(turned - STICK) === current || viewOf(turned + STICK) === current ? current : view;
}

function viewOf(turned: number): SpriteView {
  const toward = Math.cos(turned);
  if (toward > FRONT_ARC) return VIEW_FRONT;
  if (toward < -FRONT_ARC) return VIEW_BACK;
  return Math.sin(turned) > 0 ? VIEW_SIDE_LEFT : VIEW_SIDE_RIGHT;
}

/**
 * The camera's yaw, read from the 16 numbers of its world matrix. A camera looking straight down
 * has no yaw of its own, so the top of the screen decides.
 */
export function cameraYawOf(matrixWorld: ArrayLike<number>): number {
  // The third column points from what the camera sees back toward the camera.
  const backX = matrixWorld[8], backZ = matrixWorld[10];
  if (backX * backX + backZ * backZ > 1e-8) return Math.atan2(backX, backZ);
  // The second column is the top of the screen, which points away from the camera along the ground.
  return Math.atan2(-matrixWorld[4], -matrixWorld[6]);
}
