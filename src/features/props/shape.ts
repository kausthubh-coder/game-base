// Shape: the one tool every prop builder draws with. A builder adds boxes, tubes, blobs and flat faces,
// then `done()` joins them into one geometry with a color on every corner. There are no textures.
//
// Rules of the space: y is up, the prop stands on y = 0 with its middle at x = 0, z = 0, one unit is one
// meter, and its front faces +z.
//
// Each corner also carries two numbers the prop material reads:
//   sway  how far wind moves it. 0 is still, 1 is a leaf at the end of a branch.
//   glow  1 glows warm when it is dark, 2 glows always.
// A shape also lists what casts its shadow (a few stretched balls and boxes, far cheaper than the shape
// itself) and where its light sits.
import * as THREE from 'three';

/** One palette color, or a ramp from dark to light. */
export type Tone = number | readonly number[];

type V3 = readonly [number, number, number];

export interface PartOptions {
  /** How far wind moves this part. */
  sway?: number;
  /** 1 glows when it is dark, 2 glows always. */
  glow?: number;
  /** How much darker the bottom of the part is than its top, 0 to 1. It reads as shade without a light. */
  grade?: number;
}

export interface BoxOptions extends PartOptions {
  /** Cuts the edges by this much, so the box looks soft. It costs 32 more triangles. */
  bevel?: number;
  /** Faces to leave out, as in '-y' or '-y+z', where nobody can see them. */
  skip?: string;
  /** A different color for the top face. */
  top?: Tone;
}

export interface TubeOptions extends PartOptions {
  /** Which ends are closed. The default closes the far end. */
  cap?: 'none' | 'start' | 'end' | 'both';
  capTone?: Tone;
  /** Flat sides, like a cut post. The default is round. */
  flat?: boolean;
  /** Turns the ring of sides around the tube, in radians. */
  turn?: number;
  /** Sway at each point of the path, when it changes along the tube. */
  sways?: readonly number[];
  /** Faces inward: the inside wall of a well or a pot. */
  inside?: boolean;
}

export interface BlobOptions extends PartOptions {
  sides?: number;
  rings?: number;
  /** How lumpy it is, as a share of its radius. */
  jitter?: number;
  /** Cuts the blob flat at this height, for things that sit on the ground. */
  floor?: number;
  /** How much chance moves a face along the ramp, 0 to 1. */
  noise?: number;
  /** Adds a shadow ball for it. */
  shadow?: boolean;
}

export interface ConeOptions extends PartOptions {
  /** Pulls every second point of the rim in by this share, for a pine's ragged edge. */
  star?: number;
  /** Closes the bottom. */
  cap?: boolean;
  capTone?: Tone;
  noise?: number;
  turn?: number;
}

export interface PolyOptions extends PartOptions {
  /** Draws the back too, for cloth and thin roofs seen from below. */
  two?: boolean;
  /** Sway for each point, when it changes across the face. */
  sways?: readonly number[];
  /** The way the face should look, as in [0, 1, 0] for up. With it, the order of the points does not matter. */
  toward?: readonly [number, number, number];
}

/** What a finished shape carries besides its triangles. Matrices are 16 numbers each, column by column. */
export interface ShapeExtras {
  /** Unit balls stretched into the shadow of each leaf clump or rock. */
  blobs: Float32Array;
  /** Unit boxes stretched into the shadow of each plank, post or wall. */
  boxes: Float32Array;
  /** Three numbers for each light: where it sits. */
  lights: Float32Array;
  triangles: number;
}

const linearCache = new Map<number, V3>();
/** A palette color as the linear numbers a vertex color needs. */
function linear(hex: number): V3 {
  let c = linearCache.get(hex);
  if (!c) {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    c = [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
    linearCache.set(hex, c);
  }
  return c;
}

/** The middle of a ramp, or the color itself. */
function mid(tone: Tone): number {
  return typeof tone === 'number' ? tone : tone[Math.floor(tone.length / 2)];
}

/** A color from a ramp at t, 0 at the dark end and 1 at the light end. */
function pick(tone: Tone, t: number): number {
  if (typeof tone === 'number') return tone;
  return tone[Math.max(0, Math.min(tone.length - 1, Math.floor(t * tone.length)))];
}

/** One corner while a part is being made. */
interface Corner {
  x: number; y: number; z: number;
  /** Which way is out, roughly. It fixes the winding, and round parts shade by it. */
  nx: number; ny: number; nz: number;
  color: V3;
  shade: number;
  sway: number;
}

const corner = (x: number, y: number, z: number, nx: number, ny: number, nz: number, color: V3, shade = 1, sway = 0): Corner => ({ x, y, z, nx, ny, nz, color, shade, sway });

const FLOATS = 11;
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export class Shape {
  /** 11 numbers a corner: position, normal, color, sway, glow. */
  private readonly data: number[] = [];
  private matrix = new THREE.Matrix4();
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly stack: THREE.Matrix4[] = [];
  private readonly blobs: number[] = [];
  private readonly boxes: number[] = [];
  private readonly lights: number[] = [];
  private state: number;

  /** The seed makes `r()` give the same numbers every time, so a prop is the same shape on every machine. */
  constructor(seed: number) {
    this.state = (seed * 2654435761) >>> 0 || 1;
  }

  /** A number from 0 to 1. */
  r(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A number from a to b. */
  rr(a: number, b: number): number {
    return a + (b - a) * this.r();
  }

  // ---------------------------------------------------------------- moving the pen

  /** Draws what `draw` adds at this place, turned around y by `ry` (and tipped by `rx`, `rz`), at this scale. */
  at(x: number, y: number, z: number, turn: number | { ry?: number; rx?: number; rz?: number; scale?: number }, draw: () => void): void {
    const t = typeof turn === 'number' ? { ry: turn } : turn;
    const scale = t.scale ?? 1;
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0, 'YXZ')), _s.set(scale, scale, scale));
    this.stack.push(this.matrix);
    this.matrix = this.matrix.clone().multiply(_m);
    this.normalMatrix.getNormalMatrix(this.matrix);
    draw();
    this.matrix = this.stack.pop() as THREE.Matrix4;
    this.normalMatrix.getNormalMatrix(this.matrix);
  }

  // ---------------------------------------------------------------- triangles

  private put(c: Corner, nx: number, ny: number, nz: number, glow: number): void {
    const e = this.matrix.elements;
    const n = this.normalMatrix.elements;
    const wx = n[0] * nx + n[3] * ny + n[6] * nz;
    const wy = n[1] * nx + n[4] * ny + n[7] * nz;
    const wz = n[2] * nx + n[5] * ny + n[8] * nz;
    const l = Math.hypot(wx, wy, wz) || 1;
    this.data.push(
      e[0] * c.x + e[4] * c.y + e[8] * c.z + e[12], e[1] * c.x + e[5] * c.y + e[9] * c.z + e[13], e[2] * c.x + e[6] * c.y + e[10] * c.z + e[14],
      wx / l, wy / l, wz / l,
      c.color[0] * c.shade, c.color[1] * c.shade, c.color[2] * c.shade,
      c.sway, glow,
    );
  }

  /** One triangle. The corners' rough normals say which side is out, so the order they come in does not matter. */
  private tri(a: Corner, b: Corner, c: Corner, flat: boolean, glow: number): void {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    let gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    const length = Math.hypot(gx, gy, gz);
    if (length < 1e-9) return;
    gx /= length; gy /= length; gz /= length;
    if (gx * (a.nx + b.nx + c.nx) + gy * (a.ny + b.ny + c.ny) + gz * (a.nz + b.nz + c.nz) < 0) {
      const swap = b;
      b = c;
      c = swap;
      gx = -gx; gy = -gy; gz = -gz;
    }
    if (flat) {
      this.put(a, gx, gy, gz, glow);
      this.put(b, gx, gy, gz, glow);
      this.put(c, gx, gy, gz, glow);
    } else {
      this.put(a, a.nx, a.ny, a.nz, glow);
      this.put(b, b.nx, b.ny, b.nz, glow);
      this.put(c, c.nx, c.ny, c.nz, glow);
    }
  }

  private quad(a: Corner, b: Corner, c: Corner, d: Corner, flat: boolean, glow: number): void {
    this.tri(a, b, c, flat, glow);
    this.tri(a, c, d, flat, glow);
  }

  // ---------------------------------------------------------------- parts

  /** A box that stands on y, with its middle at x and z. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, tone: Tone, o: BoxOptions = {}): void {
    const half = [w / 2, h / 2, d / 2];
    const center = [x, y + h / 2, z];
    const bevel = Math.min(o.bevel ?? 0, half[0] * 0.9, half[1] * 0.9, half[2] * 0.9);
    const skip = o.skip ?? '';
    const grade = o.grade ?? 0.14;
    const glow = o.glow ?? 0;
    const sway = o.sway ?? 0;
    const side = linear(mid(tone));
    const top = linear(mid(o.top ?? tone));
    const has = (axis: number, sign: number) => !skip.includes((sign > 0 ? '+' : '-') + 'xyz'[axis]);
    // A corner of the face on `axis`. It is pulled in along the other axes only where that face exists,
    // so a skipped side leaves no gap.
    const point = (axis: number, signs: number[], normal: number[], color: V3): Corner => {
      const p = [0, 1, 2].map((i) => center[i] + signs[i] * (i === axis || !has(i, signs[i]) ? half[i] : half[i] - bevel));
      const up = h > 0 ? (p[1] - y) / h : 1;
      return corner(p[0], p[1], p[2], normal[0], normal[1], normal[2], color, 1 - grade * (1 - up), sway);
    };
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [1, -1]) {
        if (!has(axis, sign)) continue;
        const [a1, a2] = [0, 1, 2].filter((i) => i !== axis);
        const normal = [0, 0, 0];
        normal[axis] = sign;
        const color = axis === 1 && sign > 0 ? top : side;
        const at = (s1: number, s2: number) => {
          const signs = [0, 0, 0];
          signs[axis] = sign;
          signs[a1] = s1;
          signs[a2] = s2;
          return point(axis, signs, normal, color);
        };
        this.quad(at(-1, -1), at(1, -1), at(1, 1), at(-1, 1), true, glow);
      }
    }
    if (bevel <= 0) return;
    for (let a1 = 0; a1 < 3; a1++) {
      for (let a2 = a1 + 1; a2 < 3; a2++) {
        const a3 = 3 - a1 - a2;
        for (const s1 of [1, -1]) {
          for (const s2 of [1, -1]) {
            if (!has(a1, s1) || !has(a2, s2)) continue;
            const normal = [0, 0, 0];
            normal[a1] = s1;
            normal[a2] = s2;
            const color = (a1 === 1 && s1 > 0) || (a2 === 1 && s2 > 0) ? top : side;
            const at = (axis: number, s3: number) => {
              const signs = [0, 0, 0];
              signs[a1] = s1;
              signs[a2] = s2;
              signs[a3] = s3;
              return point(axis, signs, normal, color);
            };
            this.quad(at(a1, -1), at(a1, 1), at(a2, 1), at(a2, -1), true, glow);
          }
        }
      }
    }
    for (const s0 of [1, -1]) {
      for (const s1 of [1, -1]) {
        for (const s2 of [1, -1]) {
          if (!has(0, s0) || !has(1, s1) || !has(2, s2)) continue;
          const signs = [s0, s1, s2];
          const color = s1 > 0 ? top : side;
          this.tri(point(0, signs, signs, color), point(1, signs, signs, color), point(2, signs, signs, color), true, glow);
        }
      }
    }
  }

  /**
   * A tube through the points of `path`, as thick as `radii` at each one. A radius of 0 at an end makes a
   * point. A ramp colors it from the first point to the last.
   */
  tube(path: readonly V3[], radii: readonly number[], sides: number, tone: Tone, o: TubeOptions = {}): void {
    const glow = o.glow ?? 0;
    const grade = o.grade ?? 0.2;
    const flat = o.flat ?? false;
    const last = path.length - 1;
    const rings: Corner[][] = [];
    const tangents: V3[] = [];
    for (let i = 0; i <= last; i++) {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(last, i + 1)];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
      const t: V3 = [(b[0] - a[0]) / length, (b[1] - a[1]) / length, (b[2] - a[2]) / length];
      tangents.push(t);
      // Two directions across the tube. The first leans on x for upright tubes and on y for the rest.
      const ref: V3 = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let ux = ref[1] * t[2] - ref[2] * t[1], uy = ref[2] * t[0] - ref[0] * t[2], uz = ref[0] * t[1] - ref[1] * t[0];
      const ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      const vx = t[1] * uz - t[2] * uy, vy = t[2] * ux - t[0] * uz, vz = t[0] * uy - t[1] * ux;
      const along = last > 0 ? i / last : 0;
      const color = linear(pick(tone, typeof tone === 'number' ? 0 : along * 0.999));
      const shade = typeof tone === 'number' ? 1 - grade * (1 - along) : 1;
      const sway = o.sways ? o.sways[i] : o.sway ?? 0;
      const ring: Corner[] = [];
      for (let k = 0; k < sides; k++) {
        const angle = (o.turn ?? 0) + (k / sides) * Math.PI * 2;
        const cx = Math.cos(angle), sx = Math.sin(angle);
        const nx = ux * cx + vx * sx, ny = uy * cx + vy * sx, nz = uz * cx + vz * sx;
        const out = o.inside ? -1 : 1;
        ring.push(corner(path[i][0] + nx * radii[i], path[i][1] + ny * radii[i], path[i][2] + nz * radii[i], nx * out, ny * out, nz * out, color, shade, sway));
      }
      rings.push(ring);
    }
    for (let i = 0; i < last; i++) {
      for (let k = 0; k < sides; k++) {
        const k1 = (k + 1) % sides;
        this.quad(rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k], flat, glow);
      }
    }
    const cap = o.cap ?? 'end';
    const close = (i: number, sign: number) => {
      if (radii[i] <= 0) return;
      const t = tangents[i];
      const color = linear(mid(o.capTone ?? tone));
      const ring = rings[i].map((c) => corner(c.x, c.y, c.z, t[0] * sign, t[1] * sign, t[2] * sign, color, o.capTone === undefined ? c.shade : 1, c.sway));
      for (let k = 1; k < sides - 1; k++) this.tri(ring[0], ring[k], ring[k + 1], true, glow);
    };
    if (cap === 'start' || cap === 'both') close(0, -1);
    if (cap === 'end' || cap === 'both') close(last, 1);
  }

  /** An upright tube that stands on y: `r0` wide at the bottom, `r1` at the top. */
  cyl(x: number, y: number, z: number, r0: number, r1: number, h: number, sides: number, tone: Tone, o: TubeOptions = {}): void {
    this.tube([[x, y, z], [x, y + h, z]], [r0, r1], sides, tone, o);
  }

  /**
   * A lumpy ball with flat faces, for leaf clumps, bushes, rocks and sacks. Its middle is at x, y, z.
   * A ramp puts the light end on the faces that look up.
   */
  blob(x: number, y: number, z: number, rx: number, ry: number, rz: number, tone: Tone, o: BlobOptions = {}): void {
    const sides = o.sides ?? 7;
    const ringCount = o.rings ?? 3;
    const jitter = o.jitter ?? 0.14;
    const noise = o.noise ?? 0.3;
    const glow = o.glow ?? 0;
    const sway = o.sway ?? 0;
    const none = linear(0);
    const floored = new Set<Corner>();
    const make = (dx: number, dy: number, dz: number): Corner => {
      const reach = 1 + jitter * (this.r() * 2 - 1);
      const c = corner(x + dx * rx * reach, y + dy * ry * reach, z + dz * rz * reach, dx, dy, dz, none, 1, sway * (0.75 + 0.25 * this.r()));
      if (o.floor !== undefined && c.y < o.floor) {
        c.y = o.floor;
        floored.add(c);
      }
      return c;
    };
    const rows: Corner[][] = [[make(0, 1, 0)]];
    for (let k = 1; k <= ringCount; k++) {
      const phi = (Math.PI * k) / (ringCount + 1);
      const twist = (k % 2) * (Math.PI / sides);
      const row: Corner[] = [];
      for (let j = 0; j < sides; j++) {
        const angle = twist + (j / sides) * Math.PI * 2;
        row.push(make(Math.sin(phi) * Math.cos(angle), Math.cos(phi), Math.sin(phi) * Math.sin(angle)));
      }
      rows.push(row);
    }
    rows.push([make(0, -1, 0)]);
    const face = (a: Corner, b: Corner, c: Corner) => {
      if (floored.has(a) && floored.has(b) && floored.has(c)) return;
      const up = (a.ny + b.ny + c.ny) / 3;
      const color = linear(pick(tone, 0.5 + 0.48 * up + (this.r() - 0.5) * noise));
      const shade = typeof tone === 'number' ? 1 - (o.grade ?? 0.3) * (0.5 - 0.5 * up) : 1;
      this.tri({ ...a, color, shade }, { ...b, color, shade }, { ...c, color, shade }, true, glow);
    };
    for (let j = 0; j < sides; j++) {
      const j1 = (j + 1) % sides;
      face(rows[0][0], rows[1][j], rows[1][j1]);
      face(rows[ringCount + 1][0], rows[ringCount][j], rows[ringCount][j1]);
    }
    for (let k = 1; k < ringCount; k++) {
      const upper = rows[k], lower = rows[k + 1];
      for (let j = 0; j < sides; j++) {
        const j1 = (j + 1) % sides;
        if (k % 2 === 1) {
          // The upper ring is turned half a step, so each of its points sits between two of the lower ring's.
          face(upper[j], lower[j], lower[j1]);
          face(upper[j], lower[j1], upper[j1]);
        } else {
          face(lower[j], upper[j], upper[j1]);
          face(lower[j], upper[j1], lower[j1]);
        }
      }
    }
    if (o.shadow) this.shadowBlob(x, o.floor !== undefined ? Math.max(y, o.floor) : y, z, rx * 0.85, ry * 0.85, rz * 0.85);
  }

  /** A cone that stands on y with flat faces: a pine's tier, a roof, a spike. */
  cone(x: number, y: number, z: number, r: number, h: number, sides: number, tone: Tone, o: ConeOptions = {}): void {
    const glow = o.glow ?? 0;
    const sway = o.sway ?? 0;
    const noise = o.noise ?? 0.9;
    const none = linear(0);
    const rim: Corner[] = [];
    for (let k = 0; k < sides; k++) {
      const angle = (o.turn ?? 0) + (k / sides) * Math.PI * 2;
      const reach = r * (k % 2 === 1 ? 1 - (o.star ?? 0) : 1);
      rim.push(corner(x + Math.cos(angle) * reach, y, z + Math.sin(angle) * reach, Math.cos(angle), 0.5, Math.sin(angle), none, 1, sway));
    }
    const tip = corner(x, y + h, z, 0, 1, 0, none, 1, sway * 0.5);
    for (let k = 0; k < sides; k++) {
      const a = rim[k], b = rim[(k + 1) % sides];
      // The sun shades it. A ramp only dapples it, face by face.
      const color = linear(pick(tone, 0.5 + (this.r() - 0.5) * noise));
      this.tri({ ...a, color }, { ...b, color }, { ...tip, color }, true, glow);
    }
    if (o.cap) {
      const capTone = o.capTone ?? tone;
      const color = linear(typeof capTone === 'number' ? capTone : capTone[0]);
      const under = rim.map((c) => ({ ...c, nx: 0, ny: -1, nz: 0, color }));
      for (let k = 1; k < sides - 1; k++) this.tri(under[0], under[k], under[k + 1], true, glow);
    }
  }

  /** One flat face through these points, in order around it. It faces you when they run counter-clockwise, or the way `toward` says. */
  poly(points: readonly V3[], tone: Tone, o: PolyOptions = {}): void {
    // Newell's method: the normal of a face from all its points, so three in a line do no harm.
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length; ny /= length; nz /= length;
    if (o.toward && nx * o.toward[0] + ny * o.toward[1] + nz * o.toward[2] < 0) {
      nx = -nx; ny = -ny; nz = -nz;
    }
    const color = linear(mid(tone));
    const glow = o.glow ?? 0;
    let low = Infinity, high = -Infinity;
    for (const p of points) {
      low = Math.min(low, p[1]);
      high = Math.max(high, p[1]);
    }
    const grade = o.grade ?? 0;
    const make = (sign: number) => points.map((p, i) => corner(p[0], p[1], p[2], nx * sign, ny * sign, nz * sign, color, high > low ? 1 - grade * (1 - (p[1] - low) / (high - low)) : 1, o.sways ? o.sways[i] : o.sway ?? 0));
    const front = make(1);
    for (let k = 1; k < front.length - 1; k++) this.tri(front[0], front[k], front[k + 1], true, glow);
    if (o.two) {
      const back = make(-1);
      for (let k = 1; k < back.length - 1; k++) this.tri(back[0], back[k], back[k + 1], true, glow);
    }
  }

  /** A flat disc that looks up, with `sides` corners. */
  disc(x: number, y: number, z: number, r: number, sides: number, tone: Tone, o: PolyOptions & { turn?: number } = {}): void {
    const points: V3[] = [];
    for (let k = 0; k < sides; k++) {
      const angle = (o.turn ?? 0) + (k / sides) * Math.PI * 2;
      points.push([x + Math.cos(angle) * r, y, z + Math.sin(angle) * r]);
    }
    this.poly(points, tone, { toward: [0, 1, 0], ...o });
  }

  // ---------------------------------------------------------------- shadow and light

  private record(list: number[], x: number, y: number, z: number, sx: number, sy: number, sz: number, turn: number): void {
    _m2.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, turn, 0)), _s.set(sx, sy, sz));
    _m.multiplyMatrices(this.matrix, _m2);
    for (let i = 0; i < 16; i++) list.push(_m.elements[i]);
  }

  /** A ball that casts shadow for the part around x, y, z. `blob` adds its own when asked. */
  shadowBlob(x: number, y: number, z: number, rx: number, ry: number, rz: number): void {
    this.record(this.blobs, x, y, z, rx, ry, rz, 0);
  }

  /** A box that casts shadow. It stands on y like `box`. */
  shadowBox(x: number, y: number, z: number, w: number, h: number, d: number, turn = 0): void {
    this.record(this.boxes, x, y + h / 2, z, w, h, d, turn);
  }

  /** Where the prop's light sits, for kinds whose entry gives light. */
  light(x: number, y: number, z: number): void {
    _p.set(x, y, z).applyMatrix4(this.matrix);
    this.lights.push(_p.x, _p.y, _p.z);
  }

  // ---------------------------------------------------------------- the finished geometry

  /** Joins everything into one geometry. Corners that match exactly are shared. */
  done(): THREE.BufferGeometry {
    const count = this.data.length / FLOATS;
    const seen = new Map<string, number>();
    const index: number[] = [];
    const kept: number[] = [];
    for (let i = 0; i < count; i++) {
      let key = '';
      for (let k = 0; k < FLOATS; k++) key += Math.round(this.data[i * FLOATS + k] * 4096) + ',';
      let at = seen.get(key);
      if (at === undefined) {
        at = kept.length / FLOATS;
        seen.set(key, at);
        for (let k = 0; k < FLOATS; k++) kept.push(this.data[i * FLOATS + k]);
      }
      index.push(at);
    }
    const total = kept.length / FLOATS;
    const position = new Float32Array(total * 3), normal = new Float32Array(total * 3), color = new Float32Array(total * 3), fx = new Float32Array(total * 2);
    for (let i = 0; i < total; i++) {
      const o = i * FLOATS;
      position.set(kept.slice(o, o + 3), i * 3);
      normal.set(kept.slice(o + 3, o + 6), i * 3);
      color.set(kept.slice(o + 6, o + 9), i * 3);
      fx.set(kept.slice(o + 9, o + 11), i * 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geometry.setAttribute('aFx', new THREE.BufferAttribute(fx, 2));
    geometry.setIndex(total > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const extras: ShapeExtras = { blobs: new Float32Array(this.blobs), boxes: new Float32Array(this.boxes), lights: new Float32Array(this.lights), triangles: index.length / 3 };
    geometry.userData.prop = extras;
    return geometry;
  }
}

/** What a finished prop geometry carries: its shadow casters, its lights and its triangle count. */
export function extrasOf(geometry: THREE.BufferGeometry): ShapeExtras {
  return geometry.userData.prop as ShapeExtras;
}
