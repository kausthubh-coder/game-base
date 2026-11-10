// Where the camera is, as numbers: it orbits a target at a pitch, turns in quarter turns, zooms in steps
// and follows the target smoothly. No drawing here, so sprites and a server can read it.
//
// The pitch, the aim and the lift may each be one number or one per zoom step. Given per step, they glide
// with the distance as the zoom glides, so a camera can look down from far out and toward the horizon up close.

/** One number for every zoom step, or one per step, nearest first. */
export type PerStep = number | readonly number[];

export interface RigOptions {
  /** How high the camera stands over the target, as an angle down to it, in radians. */
  pitch: PerStep;
  /**
   * How far the view looks down, in radians. Without it the camera looks straight at the target. Less than
   * the pitch tilts the view up toward the horizon and leaves the target low in the picture.
   */
  aim?: PerStep;
  /** The yaw at quarter 0. Yaw 0 looks north (-z) from the south, and it grows counter-clockwise seen from above. */
  baseYaw: number;
  /** Distance to the target at each zoom step, nearest first. */
  distances: readonly number[];
  /** The zoom step to start at. */
  zoom: number;
  /** Seconds one quarter turn takes. */
  turnTime: number;
  /** How fast the camera catches up with its target, per second. Higher is stiffer. */
  followRate: number;
  /** The camera orbits a point this far above the target, so the hero's body is centered and not its feet. */
  lift: PerStep;
}

export const DEFAULT_RIG: RigOptions = {
  pitch: (35 * Math.PI) / 180,
  baseYaw: Math.PI / 4,
  distances: [46, 66, 94],
  zoom: 1,
  turnTime: 0.3,
  followRate: 9,
  lift: 1,
};

const QUARTER = Math.PI / 2;
const ease = (t: number): number => t * t * (3 - 2 * t);

export class CameraRig {
  readonly options: RigOptions;
  /** Quarter turns from the base yaw, 0 to 3, counted counter-clockwise seen from above. It changes the moment a turn starts. */
  quarter = 0;
  /** The yaw right now, in radians from -PI to PI. It glides during a turn. */
  yaw: number;
  /** The zoom step, 0 is nearest. */
  zoom: number;
  distance: number;
  /** The point the camera orbits. */
  readonly look = { x: 0, y: 0, z: 0 };
  /** The point the camera looks at. It is `look` unless the aim tilts the view away from it. */
  readonly gaze = { x: 0, y: 0, z: 0 };
  readonly position = { x: 0, y: 0, z: 0 };
  /** Pitch and aim right now, in radians. They glide with the zoom when they are given per step. */
  pitch = 0;
  aim = 0;

  private turns = 0;
  private yawFrom: number;
  private yawNow: number;
  private turnClock = 1;
  private started = false;

  constructor(options: Partial<RigOptions> = {}) {
    this.options = { ...DEFAULT_RIG, ...options };
    this.zoom = Math.max(0, Math.min(this.options.distances.length - 1, this.options.zoom));
    this.distance = this.options.distances[this.zoom];
    this.yawNow = this.yawFrom = this.options.baseYaw;
    this.yaw = wrap(this.yawNow);
  }

  get turning(): boolean {
    return this.turnClock < 1;
  }

  /** Starts a quarter turn. 1 turns the view to the right, -1 to the left. A turn started during a turn takes over from where the camera is. */
  turn(direction: 1 | -1): void {
    this.turns -= direction;
    this.quarter = ((this.turns % 4) + 4) % 4;
    this.yawFrom = this.yawNow;
    this.turnClock = 0;
  }

  /** Moves the zoom by whole steps. Positive zooms out. It stops at the first and last step. */
  zoomBy(steps: number): void {
    this.zoom = Math.max(0, Math.min(this.options.distances.length - 1, this.zoom + Math.sign(steps)));
  }

  /** Jumps to the target with no glide. Use it after a teleport. */
  snap(x: number, y: number, z: number): void {
    this.distance = this.options.distances[this.zoom];
    this.look.x = x; this.look.y = y + this.step(this.options.lift); this.look.z = z;
    this.started = true;
    this.place();
  }

  update(dt: number, x: number, y: number, z: number): void {
    const o = this.options;
    if (!this.started) this.snap(x, y, z);
    const k = 1 - Math.exp(-o.followRate * dt);
    this.look.x += (x - this.look.x) * k;
    this.look.z += (z - this.look.z) * k;
    // Height follows more slowly, so a jump does not shake the view.
    this.look.y += (y + this.step(o.lift) - this.look.y) * (1 - Math.exp(-o.followRate * 0.45 * dt));
    this.distance += (o.distances[this.zoom] - this.distance) * (1 - Math.exp(-10 * dt));

    const goal = o.baseYaw + this.turns * QUARTER;
    if (this.turnClock < 1) {
      this.turnClock = Math.min(1, this.turnClock + dt / o.turnTime);
      this.yawNow = this.yawFrom + (goal - this.yawFrom) * ease(this.turnClock);
    } else {
      this.yawNow = goal;
    }
    this.yaw = wrap(this.yawNow);
    this.place();
  }

  /** Where the zoom is now, as a step that may fall between two: 0.5 is halfway from the first distance to the second. */
  get level(): number {
    const d = this.options.distances;
    if (d.length < 2 || this.distance <= d[0]) return 0;
    for (let i = 1; i < d.length; i++) if (this.distance <= d[i]) return i - 1 + (this.distance - d[i - 1]) / (d[i] - d[i - 1]);
    return d.length - 1;
  }

  /** The value of a per-step option at the zoom right now. */
  step(value: PerStep): number {
    if (typeof value === 'number') return value;
    const level = Math.min(this.level, value.length - 1);
    const i = Math.floor(level), t = level - i;
    return t > 0 ? value[i] + (value[i + 1] - value[i]) * t : value[i];
  }

  private place(): void {
    const pitch = (this.pitch = this.step(this.options.pitch));
    const aim = (this.aim = this.step(this.options.aim ?? this.options.pitch));
    const flat = Math.cos(pitch) * this.distance;
    const sin = Math.sin(this.yawNow), cos = Math.cos(this.yawNow);
    this.position.x = this.look.x + sin * flat;
    this.position.y = this.look.y + Math.sin(pitch) * this.distance;
    this.position.z = this.look.z + cos * flat;
    if (this.options.aim === undefined) {
      this.gaze.x = this.look.x; this.gaze.y = this.look.y; this.gaze.z = this.look.z;
      return;
    }
    // As far along the aim as the target is, so the point is the target itself when the aim is the pitch.
    const ahead = Math.cos(aim) * this.distance;
    this.gaze.x = this.position.x - sin * ahead;
    this.gaze.y = this.position.y - Math.sin(aim) * this.distance;
    this.gaze.z = this.position.z - cos * ahead;
  }
}

function wrap(angle: number): number {
  const turn = Math.PI * 2;
  return ((((angle + Math.PI) % turn) + turn) % turn) - Math.PI;
}
