// The map's arithmetic: how far and which way a point is, how the camera's turn moves a point on the
// round minimap, and where an arrow sits when its target is off the edge. Plain numbers only.
//
// Angles follow the rest of the game:
//   bearing    0 is north (-z), a quarter turn (PI / 2) is east (+x). The hero's `facing` is the same.
//   cameraYaw  0 is a camera south of its target looking north. It grows counter-clockwise seen
//              from above, so at a quarter turn the camera stands east and looks west.

/** Blocks between two points on the ground. Height does not count. */
export function distanceTo(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.hypot(toX - fromX, toZ - fromZ);
}

/** The compass direction from one point to another, in radians from -PI to PI. 0 is north and PI / 2 is east. */
export function bearingTo(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, -(toZ - fromZ));
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** A bearing as one of eight compass names. */
export function compassName(bearing: number): (typeof COMPASS)[number] {
  return COMPASS[((Math.round(bearing / (Math.PI / 4)) % 8) + 8) % 8];
}

/**
 * The angle on the screen, clockwise from straight up, at which a bearing shows while the camera
 * has this yaw. With the camera looking north a target to the east is on the right.
 */
export function screenAngle(bearing: number, cameraYaw: number): number {
  return wrapAngle(bearing + cameraYaw);
}

export function wrapAngle(angle: number): number {
  const turn = Math.PI * 2;
  return ((((angle + Math.PI) % turn) + turn) % turn) - Math.PI;
}

/**
 * The camera's yaw, read from the 16 numbers of its world matrix. A camera looking straight down
 * has no yaw of its own, so the top of the screen decides. The sprite feature reads it the same way.
 */
export function cameraYawOf(matrixWorld: ArrayLike<number>): number {
  // The third column points from what the camera sees back toward the camera.
  const backX = matrixWorld[8], backZ = matrixWorld[10];
  if (backX * backX + backZ * backZ > 1e-8) return Math.atan2(backX, backZ);
  // The second column is the top of the screen, which points away from the camera along the ground.
  return Math.atan2(-matrixWorld[4], -matrixWorld[6]);
}

/**
 * A point's place on the minimap, in blocks from its middle with y down the screen. `dx` and `dz`
 * are the point's offset from the player in the world. The map turns with the camera, so whatever
 * is ahead of the camera is up.
 */
export function toMinimap(dx: number, dz: number, cameraYaw: number, out: { x: number; y: number }): { x: number; y: number } {
  const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
  out.x = dx * cos - dz * sin;
  out.y = dx * sin + dz * cos;
  return out;
}

/** Where a mark is drawn. When `off` is true it is an arrow at the edge, turned by `angle` clockwise from straight up. */
export interface EdgeMark {
  x: number;
  y: number;
  angle: number;
  off: boolean;
}

export function emptyEdgeMark(): EdgeMark {
  return { x: 0, y: 0, angle: 0, off: false };
}

/** Keeps a mark on a round map: inside `radius` it stays where it is, and outside it becomes an arrow on the rim. */
export function clampToDisc(x: number, y: number, radius: number, out: EdgeMark): EdgeMark {
  const length = Math.hypot(x, y);
  out.off = length > radius;
  out.angle = Math.atan2(x, -y);
  if (out.off) {
    out.x = (x / length) * radius;
    out.y = (y / length) * radius;
  } else {
    out.x = x;
    out.y = y;
  }
  return out;
}

/**
 * Keeps a mark on the screen. `ndcX` and `ndcY` are the target after the camera's projection, -1 to
 * 1 across the view with y up. `behind` is true when the target is behind a perspective camera,
 * where the projection mirrors it. The result is in pixels from the top left. A target in view
 * stays put. One out of view becomes an arrow `margin` pixels inside the edge, pointing at it.
 */
export function clampToScreen(ndcX: number, ndcY: number, behind: boolean, width: number, height: number, margin: number, out: EdgeMark): EdgeMark {
  const halfW = width / 2, halfH = height / 2;
  let dx = ndcX * halfW, dy = -ndcY * halfH;
  if (behind) { dx = -dx; dy = -dy; }
  const reachX = Math.max(1, halfW - margin), reachY = Math.max(1, halfH - margin);
  out.off = behind || Math.abs(dx) > reachX || Math.abs(dy) > reachY;
  if (out.off) {
    // A target straight behind the camera has no direction on the screen. Point down, toward the player's back.
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = 1;
    const scale = Math.min(reachX / Math.max(Math.abs(dx), 1e-6), reachY / Math.max(Math.abs(dy), 1e-6));
    dx *= scale;
    dy *= scale;
  }
  out.angle = Math.atan2(dx, -dy);
  out.x = halfW + dx;
  out.y = halfH + dy;
  return out;
}
