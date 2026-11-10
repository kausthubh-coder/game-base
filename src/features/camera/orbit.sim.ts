// The free camera and the first-person camera, as numbers. The free camera orbits a point over the hero's
// head at any yaw, within pitch limits, at a distance the wheel sets, and pulls in toward the hero when a
// block stands between them, so it never ends up inside the land. First person is the same rig with no
// distance: the camera sits at the eyes. No drawing here.
import { BLOCKS } from '../../content/blocks.ts';
import type { BlockProbe } from './cutaway.sim.ts';

const DEG = Math.PI / 180;

export interface OrbitOptions {
  /** How far the view may look up (negative) and down (positive), in radians. */
  minPitch: number;
  maxPitch: number;
  /** The pitch and the distance a new camera starts at. */
  pitch: number;
  distance: number;
  minDistance: number;
  maxDistance: number;
  /** The orbited point sits this far above the feet. */
  lift: number;
  /**
   * The orbited point sits this far to the right of the hero, so the line from the camera through the middle of
   * the screen passes beside the hero and not through their head.
   */
  shoulder: number;
  /** How fast the orbited point catches up with the hero, per second. 0 follows exactly. */
  followRate: number;
  /** How close the camera may come to a block. */
  radius: number;
  /** How fast the camera eases back out once nothing is in the way any more, per second. */
  outRate: number;
}

export const FREE_ORBIT: OrbitOptions = {
  minPitch: -35 * DEG, maxPitch: 72 * DEG, pitch: 24 * DEG,
  distance: 6, minDistance: 2.2, maxDistance: 12,
  lift: 1.7, shoulder: 0.6, followRate: 14, radius: 0.3, outRate: 3,
};

export const FIRST_PERSON: OrbitOptions = {
  minPitch: -86 * DEG, maxPitch: 86 * DEG, pitch: 12 * DEG,
  distance: 0, minDistance: 0, maxDistance: 0,
  lift: 1.6, shoulder: 0, followRate: 0, radius: 0, outRate: 0,
};

const SOLID = new Uint8Array(256);
for (const b of BLOCKS) SOLID[b.id] = b.solid ? 1 : 0;

/** How far a ray goes before it enters a solid block, up to `max`. 0 when it starts in one. */
export function clearance(blocks: BlockProbe, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  if (SOLID[blocks.getBlock(x, y, z)]) return 0;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = dx === 0 ? Infinity : Math.abs(1 / dx), tdy = dy === 0 ? Infinity : Math.abs(1 / dy), tdz = dz === 0 ? Infinity : Math.abs(1 / dz);
  let tx = dx === 0 ? Infinity : (dx > 0 ? x + 1 - ox : ox - x) * tdx;
  let ty = dy === 0 ? Infinity : (dy > 0 ? y + 1 - oy : oy - y) * tdy;
  let tz = dz === 0 ? Infinity : (dz > 0 ? z + 1 - oz : oz - z) * tdz;
  for (;;) {
    let t: number;
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; }
    else { z += sz; t = tz; tz += tdz; }
    if (t >= max) return max;
    if (SOLID[blocks.getBlock(x, y, z)]) return t;
  }
}

export class OrbitRig {
  readonly options: OrbitOptions;
  /** 0 looks north, growing counter-clockwise seen from above, as the 2.5D rig counts it. */
  yaw = 0;
  /** Positive looks down. */
  pitch: number;
  /** The distance the wheel asks for. */
  distance: number;
  /** The distance right now: less than `distance` while something is in the way. */
  reach: number;
  /** The orbited point, on the shoulder. */
  readonly pivot = { x: 0, y: 0, z: 0 };
  readonly position = { x: 0, y: 0, z: 0 };
  /** The way the camera looks, of length 1. */
  readonly forward = { x: 0, y: 0, z: -1 };
  /** Where the hero's head is, followed smoothly. */
  private readonly head = { x: 0, y: 0, z: 0 };
  private started = false;

  constructor(options: Partial<OrbitOptions> = {}) {
    this.options = { ...FREE_ORBIT, ...options };
    this.pitch = this.options.pitch;
    this.distance = this.reach = this.options.distance;
  }

  /** Turns the view. Positive `yaw` turns it to the left, positive `pitch` looks further down. */
  turn(yaw: number, pitch: number): void {
    this.set(this.yaw + yaw, this.pitch + pitch);
  }

  /** Sets the view exactly, within the pitch and distance limits. */
  set(yaw: number, pitch: number, distance?: number): void {
    const o = this.options;
    this.yaw = wrap(yaw);
    this.pitch = Math.max(o.minPitch, Math.min(o.maxPitch, pitch));
    if (distance !== undefined) this.distance = Math.max(o.minDistance, Math.min(o.maxDistance, distance));
  }

  /** Positive zooms out. One step is about a sixth of the distance, and part of a step is fine. */
  zoomBy(steps: number): void {
    const o = this.options;
    this.distance = Math.max(o.minDistance, Math.min(o.maxDistance, this.distance * Math.pow(1.18, steps)));
  }

  /** Jumps to the hero with no glide. */
  snap(x: number, y: number, z: number, blocks?: BlockProbe): void {
    this.head.x = x; this.head.y = y + this.options.lift; this.head.z = z;
    this.started = true;
    this.reach = this.distance;
    this.place(blocks, 0);
  }

  update(dt: number, x: number, y: number, z: number, blocks?: BlockProbe): void {
    const o = this.options;
    if (!this.started) { this.snap(x, y, z, blocks); return; }
    if (o.followRate <= 0) {
      this.head.x = x; this.head.y = y + o.lift; this.head.z = z;
    } else {
      const k = 1 - Math.exp(-o.followRate * dt);
      this.head.x += (x - this.head.x) * k;
      this.head.z += (z - this.head.z) * k;
      this.head.y += (y + o.lift - this.head.y) * (1 - Math.exp(-o.followRate * 0.6 * dt));
    }
    this.place(blocks, dt);
  }

  /**
   * Turns the view so the middle of the screen falls on a point. The camera's place depends on where it looks,
   * so it settles over a few rounds. Leaves the distance alone.
   */
  aimAt(x: number, y: number, z: number, blocks?: BlockProbe): void {
    for (let round = 0; round < 8; round++) {
      const dx = x - this.position.x, dy = y - this.position.y, dz = z - this.position.z;
      const flat = Math.hypot(dx, dz);
      if (flat + Math.abs(dy) < 1e-6) return;
      this.set(Math.atan2(-dx, -dz), Math.atan2(-dy, flat));
      this.place(blocks, 0);
    }
  }

  private place(blocks: BlockProbe | undefined, dt: number): void {
    const o = this.options;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const f = this.forward;
    f.x = -sy * cp; f.y = -sp; f.z = -cy * cp;
    // Right along the ground, and the screen's up.
    const rx = cy, rz = -sy;
    const ux = -sy * sp, uy = cp, uz = -cy * sp;

    // The shoulder point, pulled toward the head when a wall stands beside the hero.
    let shoulder = o.shoulder;
    if (blocks && shoulder > 0) shoulder = Math.max(0, clearance(blocks, this.head.x, this.head.y, this.head.z, rx, 0, rz, shoulder + o.radius) - o.radius);
    const p = this.pivot;
    p.x = this.head.x + rx * shoulder; p.y = this.head.y; p.z = this.head.z + rz * shoulder;

    let room = this.distance;
    if (blocks && this.distance > 0) {
      // One ray from the pivot back to the camera, and four more around it as wide as the camera, so no corner
      // of the picture dips into a block. A side ray that starts inside a block is left out.
      const reachOut = this.distance + o.radius;
      room = Math.min(room, clearance(blocks, p.x, p.y, p.z, -f.x, -f.y, -f.z, reachOut) - o.radius);
      for (let k = 0; k < 4; k++) {
        const a = k & 1 ? o.radius : -o.radius, b = k & 2 ? o.radius : -o.radius;
        const ox = p.x + rx * a + ux * b, oy = p.y + uy * b, oz = p.z + rz * a + uz * b;
        const free = clearance(blocks, ox, oy, oz, -f.x, -f.y, -f.z, reachOut);
        if (free > 0) room = Math.min(room, free - o.radius);
      }
      room = Math.max(0, room);
    }
    // In at once, so the camera is never seen inside a block. Out gently, so it does not jump about.
    if (room < this.reach || dt === 0) this.reach = room;
    else this.reach += (room - this.reach) * (1 - Math.exp(-o.outRate * dt));

    this.position.x = p.x - f.x * this.reach;
    this.position.y = p.y - f.y * this.reach;
    this.position.z = p.z - f.z * this.reach;
  }
}

/** The angle brought into -PI to PI. */
export function wrap(angle: number): number {
  const turn = Math.PI * 2;
  return ((((angle + Math.PI) % turn) + turn) % turn) - Math.PI;
}
