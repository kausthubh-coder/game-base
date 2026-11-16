// The sight rule: what to see through so the hero, the person talking and the enemy in a fight are never hidden.
// The block world has its own cutaway (cutaway.sim.ts). This one is for what is drawn as a model: trees, houses,
// the city, landmarks, the Hall, the mill's wheel.
//   Between the camera and each point that matters: a soft hole, as wide as `radius`, that widens a little
//     toward the camera. Nothing below that point's feet is cut, so the floor it stands on stays.
//   Tree crowns: a wider hole, and any leaf in the near part of the view fades out, so a crown by the lens
//     never fills the picture.
//   Under a grove's roof of leaves (the Old Forest, the grey forest): the hole through crowns is as wide as most of
//     the picture, so the trunks, roots and floor show between crowns that frame its edges, as a painter cuts a
//     forest away. Solid wood is cut in that hole too, but only above `trunkFeet`, so the giants keep their feet
//     and buttress roots while their boughs stop crossing the picture; and wood near the lens fades as leaves do.
//     The shell says how much grove the hero stands in; the level says how wide (`groveSight`).
//   Under a roof: everything above the walls' height is lifted, in a circle that opens like an iris.
// This file only decides and keeps the numbers. The painted light (src/features/painted/paint.ts, `paintSee`)
// does the hiding with the same sums, and `cuts` answers here for one point so a check can ask what is hidden.

/** Where something with a roof stands: x, z the corners of its floor plan, `floor` its floor and `eaves` where its walls end. */
export interface Roof {
  x0: number; z0: number; x1: number; z1: number;
  floor: number;
  eaves: number;
}

export interface SightOptions {
  /** Blocks round the line to a point that are cleared, at that point. A point may ask for its own. */
  radius: number;
  /** How much wider the hole is through a tree's crown. */
  canopy: number;
  /** How far the hole widens per block toward the camera. */
  widen: number;
  /** Blocks in front of a point before anything is cut, so what it holds or leans on stays. */
  start: number;
  /** A point is this high above the feet. Nothing lower than the feet and `guard` is cut. */
  chest: number;
  guard: number;
  /** Leaves nearer the lens than these shares of the distance to the hero fade, and are gone. */
  nearStart: number;
  nearEnd: number;
  /** Under a grove: how high above a point's chest a solid thing in the wide hole stays, the trunks' feet. */
  trunkFeet: number;
  /** Under a roof: how far the lifted circle reaches, and how high the walls stay. */
  roomRadius: number;
  wallHeight: number;
}

export const DEFAULT_SIGHT: SightOptions = {
  radius: 1.8, canopy: 2.2, widen: 0.05, start: 0.9, chest: 1.1, guard: 0.35, nearStart: 0.4, nearEnd: 0.5, trunkFeet: 3.4,
  roomRadius: 9, wallHeight: 2.4,
};

/** The most points kept in sight. The painted light has this many slots. */
export const SIGHT_POINTS = 4;

export interface SightState {
  /** x, y, z of each point's chest and its radius, four numbers a point. A radius of 0 is an empty slot. */
  readonly points: Float32Array;
  /** The lifted circle under a roof: its middle, the height above which all is lifted, and its radius now. 0 is closed. */
  room: { x: number; y: number; z: number; radius: number };
  /** Leaves between these distances from the lens fade; nearer, they are gone. */
  near: { start: number; end: number };
  /** Under a grove: the least width of the hole through crowns round each point, eased in and out. 0 elsewhere. */
  grove: number;
  /** The lens. */
  eye: { x: number; y: number; z: number };
}

export class SightRule {
  readonly options: SightOptions;
  readonly state: SightState = {
    points: new Float32Array(SIGHT_POINTS * 4),
    room: { x: 0, y: 0, z: 0, radius: 0 },
    near: { start: 0, end: 0 },
    grove: 0,
    eye: { x: 0, y: 0, z: 0 },
  };
  private count = 0;
  /** How many points this level keeps clear (`seeThrough` in src/content/quality.ts). */
  private most = SIGHT_POINTS;
  private goal = 0;
  private groveWidth = 0;
  private groveShare = 0;

  constructor(options: Partial<SightOptions> = {}) {
    this.options = { ...DEFAULT_SIGHT, ...options };
  }

  /** The level's number of points. The hero is always the first; the rest go first come, first kept. */
  setMost(most: number): void {
    this.most = Math.max(1, Math.min(SIGHT_POINTS, Math.floor(most)));
  }

  /**
   * How wide the hole through crowns is under a whole grove at this level, as a share of the lens's distance from the
   * hero (`groveSight` in src/content/quality.ts): zoomed out, the opening into the forest grows with the picture.
   */
  setGroveWidth(share: number): void {
    this.groveWidth = Math.max(0, share);
  }

  /** How much grove the lens looks down into now, 0 to 1. The hole eases to its width over a moment. */
  underGrove(share: number): void {
    this.groveShare = Math.max(0, Math.min(1, share));
  }

  /** Starts a frame's list of points. */
  clear(): void {
    this.count = 0;
    this.state.points.fill(0);
  }

  /** Keeps a point in sight: where its feet are, with its own radius or the default. False when the list is full. */
  keep(x: number, y: number, z: number, radius = this.options.radius): boolean {
    if (this.count >= this.most) return false;
    const p = this.state.points, at = this.count * 4;
    for (let i = 0; i < this.count; i++) {
      // The same body twice (a person who is also the one talking) takes one slot.
      if (Math.abs(p[i * 4] - x) < 0.3 && Math.abs(p[i * 4 + 2] - z) < 0.3) return true;
    }
    p[at] = x; p[at + 1] = y + this.options.chest; p[at + 2] = z; p[at + 3] = radius;
    this.count++;
    return true;
  }

  /**
   * After the points are kept: where the lens is, the hero's feet, and the roofs to look under. The circle under a
   * roof opens and closes over a moment.
   */
  update(dt: number, eyeX: number, eyeY: number, eyeZ: number, heroX: number, heroY: number, heroZ: number, roofs: readonly Roof[]): void {
    const s = this.state, o = this.options;
    s.eye.x = eyeX; s.eye.y = eyeY; s.eye.z = eyeZ;
    const far = Math.hypot(eyeX - heroX, eyeY - heroY - o.chest, eyeZ - heroZ);
    s.near.start = far * o.nearStart;
    s.near.end = far * o.nearEnd;
    const roof = under(roofs, heroX, heroY, heroZ);
    if (roof) {
      s.room.x = heroX; s.room.z = heroZ;
      s.room.y = Math.min(roof.eaves, roof.floor + o.wallHeight);
      this.goal = o.roomRadius;
    } else {
      this.goal = 0;
    }
    s.room.radius += (this.goal - s.room.radius) * (1 - Math.exp(-9 * dt));
    s.grove += (this.groveWidth * far * this.groveShare - s.grove) * (1 - Math.exp(-3 * dt));
    if (s.grove < 0.05) s.grove = 0;
    if (this.goal === 0 && s.room.radius < 0.05) s.room.radius = 0;
  }

  /**
   * How much of the surface at this point is cut away, 0 to 1: the same sums as `paintSee`. `canopy` is true for
   * a tree's leaves.
   */
  cuts(x: number, y: number, z: number, canopy = false, wood = false): number {
    const s = this.state, o = this.options, e = s.eye, p = s.points;
    let cut = 0;
    for (let i = 0; i < SIGHT_POINTS; i++) {
      const r = p[i * 4 + 3];
      if (r <= 0) continue;
      const fx = p[i * 4], fy = p[i * 4 + 1], fz = p[i * 4 + 2];
      if (y < fy - o.chest + o.guard) continue;
      let ux = e.x - fx, uy = e.y - fy, uz = e.z - fz;
      const len = Math.hypot(ux, uy, uz) || 1;
      ux /= len; uy /= len; uz /= len;
      const rx = x - fx, ry = y - fy, rz = z - fz;
      const t = rx * ux + ry * uy + rz * uz;
      // Tree roots may cross the lower body inside the chest ray's held-item guard.
      if (wood && y < fy + 1 && t >= -1.1) cut = Math.max(cut, 1 - smooth(0.6, 1, Math.hypot(rx, rz)));
      if (t < o.start || t > len) continue;
      const d = Math.hypot(rx - ux * t, ry - uy * t, rz - uz * t);
      // Under a grove, wood above the trunks' feet goes with the leaves, easing in over two blocks.
      const grove = canopy ? s.grove : (wood ? s.grove : 0) * smooth(o.trunkFeet, o.trunkFeet + 2, y - fy);
      const wide = Math.max(canopy ? r * o.canopy : wood ? r : r * 0.65, grove) + t * o.widen;
      cut = Math.max(cut, 1 - smooth(wide * 0.55, wide, d));
    }
    // Wood by the lens is cut within a block, not dithered over the leaves' band: a pale trunk half dithered reads as glass.
    if ((canopy || (wood && s.grove > 0)) && s.near.end > 0) cut = Math.max(cut, 1 - smooth(canopy ? s.near.start : s.near.end - 1, s.near.end, Math.hypot(x - e.x, y - e.y, z - e.z)));
    const room = s.room;
    if (room.radius > 0 && y > room.y && e.y > y) {
      const k = (room.y - y) / (y - e.y);
      const lx = x + (x - e.x) * k, lz = z + (z - e.z) * k;
      const d = Math.min(Math.hypot(lx - room.x, lz - room.z), Math.hypot(x - room.x, z - room.z));
      cut = Math.max(cut, 1 - smooth(room.radius - 1.5, room.radius, d));
    }
    return cut;
  }
}

/** The roof the point stands under, or null. A point on the roof or above it is not under it. */
export function under(roofs: readonly Roof[], x: number, y: number, z: number): Roof | null {
  for (const roof of roofs) {
    if (x > roof.x0 && x < roof.x1 && z > roof.z0 && z < roof.z1 && y >= roof.floor - 0.6 && y < roof.eaves - 0.5) return roof;
  }
  return null;
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
