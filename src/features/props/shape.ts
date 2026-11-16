// Shape: the one tool every prop builder draws with. A builder adds boxes, tubes, blobs and flat faces,
// or the soft forms (rocks, sweeps, lathes, rounded boxes), then `done()` joins them into one geometry with
// a color on every corner. README.md in this folder lists every call with its cost.
//
// Rules of the space: y is up, the prop stands on y = 0 with its middle at x = 0, z = 0, one unit is one
// meter, and its front faces +z.
//
// Each corner also carries numbers the prop material reads:
//   sway  how far wind moves it. 0 is still, 1 is a leaf at the end of a branch.
//   glow  1 glows warm when it is dark, 2 glows always.
//   skin  which painted texture it wears (skins.ts), how much moss, and where on the texture it is. A part
//         with a skin is lit by the painted light; a part without one is lit as props always were.
// A shape also lists what casts its shadow (a few stretched balls and boxes, far cheaper than the shape
// itself) and where its light sits.
import * as THREE from 'three';
import { SKIN_UV, SKINS, skinNumber, type Skin } from './skins.ts';

export type { Skin } from './skins.ts';

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
  /** A painted texture for the part, and the painted light on it (skins.ts). */
  skin?: Skin;
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

/** What every soft form takes. Its shading is baked into its colors. */
export interface FormOptions extends PartOptions {
  /** Averages normals where faces meet, so it shades smooth. Default true. */
  smooth?: boolean;
  /**
   * Keeps an edge where faces meet at more than this angle, in radians, and shades smooth within it: a rock's
   * broad planes stay planes with soft middles. Default none, smooth everywhere; a rock's is 0.6.
   */
  crease?: number;
  /** How far faces that look up move toward the light end of the ramp, and down-facing ones toward the dark. Default 0.3. */
  light?: number;
  /**
   * How far faces that look toward the sheets' painted light (from up, left and front) move toward the light
   * end, so broad planes take different tones whatever the sun does. Default 0; a rock's is 0.22.
   */
  key?: number;
  /** Slow noise in its color, so no face is one flat color, 0 to 1. Default 0.18. */
  mottle?: number;
  /** How much darker hollows, undersides and the foot are, 0 to 1. Default 0.45. */
  cavity?: number;
  /** The share of its upward faces that moss covers, 0 to 1, with patches at the foot. Default 0. */
  moss?: number;
  /** The moss's ramp. Default sage to yellow-green. */
  mossTone?: Tone;
}

export interface MeshOptions extends FormOptions {
  /** A rough outward direction for each point, three numbers each, so the order of a triangle's points does not matter. */
  hints?: readonly number[];
  /** Two numbers a point, in meters: where the skin's texture sits on it. */
  uvs?: readonly number[];
  /** Sway for each point. */
  sways?: readonly number[];
  /** Leaves out triangles that lie wholly at this height or under it. */
  floor?: number;
  /** A move along the ramp for each point, so one block of a wall is lighter than the next. */
  shifts?: readonly number[];
}

/** Age on a part already drawn (`weather`). Every one moves only colors or points, so it costs no triangles. */
export interface WeatherOptions {
  /** Damp and moss creeping up from the ground, this many meters high, ragged. */
  moss?: number;
  /** Soot toward the part's top, 0 to 1: a chimney's mouth. */
  soot?: number;
  /** How far down from the top soot reaches, in meters. Default 1.2. */
  sootReach?: number;
  /** Lighter worn edges and corners, where the part rounds or bevels, 0 to 1. */
  wear?: number;
  /** Streaks fading down from a sill or a spout: [x, y, z, width, length] each, in the pen's space. */
  stains?: readonly (readonly number[])[];
  /** How dark the streaks are at their top, 0 to 1. Default 0.35. */
  stain?: number;
  /** Bends the part down in its middle along x, by this many meters at its top and none at its foot: an old ridge. */
  sag?: number;
  /** Leans the part toward +x, by this many meters at its top. */
  lean?: number;
}

export interface RockOptions extends FormOptions {
  /** How finely it is cut, 1 to 4: about 70, 280, 1,100 and 4,400 triangles. Default 2. One less at a low `detail`. */
  level?: number;
  /** Broad flat planes cut into it. The first one flattens its top. Default 5. */
  planes?: number;
  /** How far the planes flatten it, 0 to 1. Default 0.9. */
  flat?: number;
  /** How far from its middle the planes cut, as a share of its radius: lower cuts deeper and makes it blockier. Default 0.76. */
  reach?: number;
  /** How lumpy it is, as a share of its size. Default 0.12. */
  lump?: number;
  /** Sits it on y with a flat foot. Default true. False keeps the whole form, from y to y + h. */
  seat?: boolean;
  /** Adds a shadow ball. Default true. */
  shadow?: boolean;
}

export interface SweepOptions extends FormOptions {
  /** Corners round it. Default 10. */
  sides?: number;
  /** Rings between two points of the path, so it bends smoothly. Default 3. */
  steps?: number;
  /** The section's height against its width: 1 is round, 0.6 a flat oval. Default 1. */
  squash?: number;
  /** Lumps, as a share of the radius. Default 0. */
  lump?: number;
  /** Ridges along it, like bark: how many round it, and how deep as a share of the radius. */
  ribs?: readonly [count: number, depth: number];
  /** Rounds off the ends. Default 'both'. A hollow or open sweep ends in rims instead. */
  cap?: 'none' | 'start' | 'end' | 'both';
  /** Makes it hollow: the bore's radius at each point of the path, or one for all. */
  bore?: number | readonly number[];
  /** An opening along its underside this many radians wide, like a log lying open to the ground. */
  gap?: number;
  /** The inside of a hollow sweep, and the rims at its ends: a log's dark hollow and its pale cut wood. */
  innerTone?: Tone;
  rimTone?: Tone;
  rimSkin?: Skin;
  /** Sway at each point of the path. */
  sways?: readonly number[];
  /** Turns the ring of corners, in radians. */
  turn?: number;
  /** Cuts it flat at this height, where it goes into the ground: an arch's feet, a root. */
  floor?: number;
}

export interface LatheOptions extends FormOptions {
  /** Corners round it. Default 12. */
  sides?: number;
  /** 0 is round, 1 is square: a hipped roof is about 0.6. */
  square?: number;
  /** Turns it round its axis, in radians. */
  turn?: number;
  /** Lumps, as a share of the radius. */
  lump?: number;
  /** Closes the ends that do not come to a point. Default true. */
  cap?: boolean;
  capTone?: Tone;
}

export interface RoundBoxOptions extends FormOptions {
  /** The radius of its rounded edges. Default a fifth of its smallest side. */
  round?: number;
  /** Steps round each edge: 1 is 108 triangles, 2 is 300. Default 1. */
  segments?: number;
  /** Hand-hewn unevenness, in meters. */
  wobble?: number;
  /** Faces to leave out, as in '-y'. */
  skip?: string;
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
  /** It used a soft form, so it is cut more coarsely at a lower `detail`. */
  detailed: boolean;
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

/** The way the concept sheets' light comes from: above, from the left and the front. */
const KEY = (() => {
  const l = Math.hypot(-0.45, 0.7, 0.55);
  return [-0.45 / l, 0.7 / l, 0.55 / l] as const;
})();

/** Deep green to yellow-green, from the palette: moss on stone and bark. */
const MOSS = [0x516b3c, 0x6c8043, 0x8d9a4a, 0xadac59, 0xcac476] as const;

/** A color from a ramp at t, blended between its steps, as linear numbers. A single color is lighter or darker by t. */
function ramp(tone: Tone, t: number, out: number[]): void {
  const k = Math.max(0, Math.min(1, t));
  if (typeof tone === 'number') {
    const c = linear(tone), f = 0.8 + 0.4 * k;
    out[0] = c[0] * f; out[1] = c[1] * f; out[2] = c[2] * f;
    return;
  }
  const f = k * (tone.length - 1), i = Math.min(tone.length - 2, Math.floor(f)), u = f - i;
  if (tone.length === 1) {
    const c = linear(tone[0]);
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    return;
  }
  const a = linear(tone[i]), b = linear(tone[i + 1]);
  for (let c = 0; c < 3; c++) out[c] = a[c] + (b[c] - a[c]) * u;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A number from 0 to 1 for a corner of the noise lattice. */
function lattice(x: number, y: number, z: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695041) + Math.imul(seed, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in space, 0 to 1. */
function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const at = (dx: number, dy: number, dz: number) => lattice(ix + dx, iy + dy, iz + dz, seed);
  const x00 = at(0, 0, 0) + (at(1, 0, 0) - at(0, 0, 0)) * u, x10 = at(0, 1, 0) + (at(1, 1, 0) - at(0, 1, 0)) * u;
  const x01 = at(0, 0, 1) + (at(1, 0, 1) - at(0, 0, 1)) * u, x11 = at(0, 1, 1) + (at(1, 1, 1) - at(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/** Three octaves of noise, 0 to 1, most of it near the middle. */
function fbm3(x: number, y: number, z: number, seed: number): number {
  return (noise3(x, y, z, seed) * 4 + noise3(x * 2.03, y * 2.03, z * 2.03, seed + 7) * 2 + noise3(x * 4.1, y * 4.1, z * 4.1, seed + 13)) / 7;
}

/**
 * Rows of `width` whole numbers each: for every row, the number of the first row equal to it, counting the
 * distinct rows in the order they first come. Corners that match are joined this way, by a hash of their
 * numbers and a check that they really are equal.
 */
function groupRows(values: Int32Array, width: number): { group: Int32Array; firsts: number[] } {
  const rows = values.length / width;
  const group = new Int32Array(rows);
  const heads = new Map<number, number>();
  const chain: number[] = [], firsts: number[] = [];
  for (let i = 0; i < rows; i++) {
    let h = 0x811c9dc5;
    for (let k = 0; k < width; k++) h = Math.imul(h ^ values[i * width + k], 0x01000193);
    let g = heads.get(h) ?? -1, found = -1;
    while (g >= 0) {
      const f = firsts[g];
      let same = true;
      for (let k = 0; k < width && same; k++) same = values[f * width + k] === values[i * width + k];
      if (same) { found = g; break; }
      g = chain[g];
    }
    if (found < 0) {
      found = firsts.length;
      firsts.push(i);
      chain.push(heads.get(h) ?? -1);
      heads.set(h, found);
    }
    group[i] = found;
  }
  return { group, firsts };
}

const icospheres = new Map<number, { points: number[]; triangles: number[] }>();
/** A ball of triangles of near-equal size, of radius 1: 20 × 4^level of them. */
function icosphere(level: number): { points: number[]; triangles: number[] } {
  let made = icospheres.get(level);
  if (made) return made;
  const t = (1 + Math.sqrt(5)) / 2;
  const points: number[] = [-1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0, 0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1];
  let triangles = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
  for (let i = 0; i < points.length; i += 3) {
    const l = Math.hypot(points[i], points[i + 1], points[i + 2]);
    points[i] /= l; points[i + 1] /= l; points[i + 2] /= l;
  }
  for (let step = 0; step < level; step++) {
    const middles = new Map<number, number>();
    const middle = (a: number, b: number): number => {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      let at = middles.get(key);
      if (at === undefined) {
        const x = points[a * 3] + points[b * 3], y = points[a * 3 + 1] + points[b * 3 + 1], z = points[a * 3 + 2] + points[b * 3 + 2];
        const l = Math.hypot(x, y, z);
        at = points.length / 3;
        points.push(x / l, y / l, z / l);
        middles.set(key, at);
      }
      return at;
    };
    const next: number[] = [];
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2];
      const ab = middle(a, b), bc = middle(b, c), ca = middle(c, a);
      next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    triangles = next;
  }
  made = { points, triangles };
  icospheres.set(level, made);
  return made;
}

/** One corner while a part is being made. */
interface Corner {
  x: number; y: number; z: number;
  /** Which way is out, roughly. It fixes the winding, and round parts shade by it. */
  nx: number; ny: number; nz: number;
  color: V3;
  shade: number;
  sway: number;
  /** Where on its skin's texture it sits, in meters, for a part that carries its own texture coordinates. */
  u?: number;
  v?: number;
}

const corner = (x: number, y: number, z: number, nx: number, ny: number, nz: number, color: V3, shade = 1, sway = 0): Corner => ({ x, y, z, nx, ny, nz, color, shade, sway });

/** Position, normal, color, sway, glow, and the skin: its number, moss, u and v. */
const FLOATS = 15;
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export class Shape {
  /** 15 numbers a corner: position, normal, color, sway, glow, skin. */
  private readonly data: number[] = [];
  private matrix = new THREE.Matrix4();
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly stack: THREE.Matrix4[] = [];
  private readonly blobs: number[] = [];
  private readonly boxes: number[] = [];
  private readonly lights: number[] = [];
  private state: number;
  /** The skin number the part being drawn writes into its corners. */
  private skinCode = 0;
  /** The soft forms read `detail`, so the geometry changes with the quality level. */
  private detailed = false;
  /**
   * How finely the soft forms are cut: 1 is full, lower is cheaper (`propDetail` in src/content/quality.ts).
   * Boxes, tubes, blobs and the other first calls ignore it.
   */
  readonly detail: number;
  private readonly noiseSeed: number;

  /** The seed makes `r()` give the same numbers every time, so a prop is the same shape on every machine. */
  constructor(seed: number, detail = 1) {
    this.state = (seed * 2654435761) >>> 0 || 1;
    this.noiseSeed = seed;
    this.detail = Math.max(0.25, Math.min(1, detail));
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
    // A texture coordinate is in meters of the part, so it grows with the pen's scale.
    const scale = this.skinCode >= SKIN_UV ? Math.hypot(e[0], e[1], e[2]) : 0;
    this.data.push(
      e[0] * c.x + e[4] * c.y + e[8] * c.z + e[12], e[1] * c.x + e[5] * c.y + e[9] * c.z + e[13], e[2] * c.x + e[6] * c.y + e[10] * c.z + e[14],
      wx / l, wy / l, wz / l,
      c.color[0] * c.shade, c.color[1] * c.shade, c.color[2] * c.shade,
      c.sway, glow,
      this.skinCode, 0, (c.u ?? 0) * scale, (c.v ?? 0) * scale,
    );
  }

  /**
   * Sets the skin the next corners wear. `uv` says the part gives each corner its own texture coordinates; a
   * skin whose strokes run one way uses them, and the rest are painted on from three sides.
   */
  private wear(skin: Skin | undefined, uv: boolean): void {
    const along = skin !== undefined && (SKINS[skin] as { along?: boolean }).along === true;
    this.skinCode = skin ? skinNumber(skin) + (uv && along ? SKIN_UV : 0) : 0;
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
    this.wear(o.skin, true);
    // A skin's v runs along the box's longest side, so grain runs down a plank and a post.
    const long = w >= h && w >= d ? 0 : h >= d ? 1 : 2;
    // A corner of the face on `axis`. It is pulled in along the other axes only where that face exists,
    // so a skipped side leaves no gap.
    const point = (axis: number, signs: number[], normal: number[], color: V3): Corner => {
      const p = [0, 1, 2].map((i) => center[i] + signs[i] * (i === axis || !has(i, signs[i]) ? half[i] : half[i] - bevel));
      const up = h > 0 ? (p[1] - y) / h : 1;
      const c = corner(p[0], p[1], p[2], normal[0], normal[1], normal[2], color, 1 - grade * (1 - up), sway);
      const [a1, a2] = [0, 1, 2].filter((i) => i !== axis);
      const along = long !== axis ? long : a2;
      c.v = p[along];
      c.u = p[along === a1 ? a2 : a1];
      return c;
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
    if (bevel <= 0) {
      this.skinCode = 0;
      return;
    }
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
    this.skinCode = 0;
  }

  /**
   * A tube through the points of `path`, as thick as `radii` at each one. A radius of 0 at an end makes a
   * point. A ramp colors it from the first point to the last.
   */
  tube(path: readonly V3[], radii: readonly number[], sides: number, tone: Tone, o: TubeOptions = {}): void {
    this.wear(o.skin, false);
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
    this.skinCode = 0;
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
    this.wear(o.skin, false);
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
    this.skinCode = 0;
  }

  /** A cone that stands on y with flat faces: a pine's tier, a roof, a spike. */
  cone(x: number, y: number, z: number, r: number, h: number, sides: number, tone: Tone, o: ConeOptions = {}): void {
    this.wear(o.skin, false);
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
    this.skinCode = 0;
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
    this.wear(o.skin, false);
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
    this.skinCode = 0;
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

  // ---------------------------------------------------------------- soft forms
  //
  // Rocks, sweeps, lathes and rounded boxes are smooth surfaces made with `mesh`. Each bakes its shading into
  // its colors: lighter where it faces up, darker in hollows, underneath and at its foot, a slow mottle so no
  // face is one flat color, and moss on its upward faces when asked. With a `skin` it wears a painted texture.

  /**
   * Any surface, as points (three numbers each, in the pen's space) and triangles (three point indices each).
   * Normals are averaged where points meet, so it shades smooth unless `smooth` is false. A triangle faces
   * the way its points run counter-clockwise, or the way `hints` (a rough outward direction for each point)
   * says. `uvs` (two numbers a point, in meters) gives a skin its own coordinates; without them the skin is
   * painted on from three sides. Triangles lying wholly at `floor` or under it are left out.
   */
  mesh(points: readonly number[], triangles: readonly number[], tone: Tone, o: MeshOptions = {}): void {
    const count = points.length / 3;
    const e = this.matrix.elements;
    const P = new Float64Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = points[i * 3], y = points[i * 3 + 1], z = points[i * 3 + 2];
      P[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      P[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      P[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
    const scale = Math.hypot(e[0], e[1], e[2]);
    // Points at the same place share one normal, so a seam does not show.
    const rounded = new Int32Array(count * 3);
    for (let i = 0; i < count * 3; i++) rounded[i] = Math.round(P[i] * 4096);
    const welded = groupRows(rounded, 3);
    const weld = welded.group;
    const groups = welded.firsts.length;
    const N = new Float64Array(groups * 3), around = new Float64Array(groups * 3), seen = new Float64Array(groups);
    const tris: number[] = [];
    const h = o.hints;
    const n = this.normalMatrix.elements;
    for (let t = 0; t < triangles.length; t += 3) {
      let a = triangles[t], b = triangles[t + 1], c = triangles[t + 2];
      if (o.floor !== undefined && points[a * 3 + 1] <= o.floor + 1e-6 && points[b * 3 + 1] <= o.floor + 1e-6 && points[c * 3 + 1] <= o.floor + 1e-6) continue;
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      let gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      if (Math.hypot(gx, gy, gz) < 1e-10) continue;
      if (h) {
        const hx = h[a * 3] + h[b * 3] + h[c * 3], hy = h[a * 3 + 1] + h[b * 3 + 1] + h[c * 3 + 1], hz = h[a * 3 + 2] + h[b * 3 + 2] + h[c * 3 + 2];
        // The hints are in the pen's space: turn them as the normals turn.
        const wx = n[0] * hx + n[3] * hy + n[6] * hz, wy = n[1] * hx + n[4] * hy + n[7] * hz, wz = n[2] * hx + n[5] * hy + n[8] * hz;
        if (gx * wx + gy * wy + gz * wz < 0) {
          const swap = b;
          b = c;
          c = swap;
          gx = -gx; gy = -gy; gz = -gz;
        }
      }
      tris.push(a, b, c);
      for (const [p, q, r] of [[a, b, c], [b, c, a], [c, a, b]]) {
        const k = weld[p];
        N[k * 3] += gx; N[k * 3 + 1] += gy; N[k * 3 + 2] += gz;
        around[k * 3] += P[q * 3] + P[r * 3]; around[k * 3 + 1] += P[q * 3 + 1] + P[r * 3 + 1]; around[k * 3 + 2] += P[q * 3 + 2] + P[r * 3 + 2];
        seen[k] += 2;
      }
    }
    for (let k = 0; k < groups; k++) {
      const l = Math.hypot(N[k * 3], N[k * 3 + 1], N[k * 3 + 2]) || 1;
      N[k * 3] /= l; N[k * 3 + 1] /= l; N[k * 3 + 2] /= l;
    }

    // The color of every point, from its height, the way it faces, how hollow it sits and slow noise.
    const light = o.light ?? 0.3, key = o.key ?? 0, mottle = o.mottle ?? 0.18, cavity = o.cavity ?? 0.45, moss = o.moss ?? 0;
    const mossTone = o.mossTone ?? MOSS;
    const seed = this.noiseSeed;
    const colors = new Float64Array(count * 3), mossy = new Float64Array(count);
    const base = [0, 0, 0], green = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const k = weld[i], x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const ny = N[k * 3 + 1];
      const slow = fbm3(x * 0.35, y * 0.35, z * 0.35, seed), fine = fbm3(x * 0.9 + 17, y * 0.9, z * 0.9, seed + 1);
      const lit = key === 0 ? 0 : key * (N[k * 3] * KEY[0] + ny * KEY[1] + N[k * 3 + 2] * KEY[2]);
      ramp(tone, 0.5 + light * ny + lit + mottle * (slow - 0.5) * 2.4 + (o.shifts ? o.shifts[i] : 0), base);
      // A hollow is a point that sits below the points round it, along its normal.
      let hollow = 0;
      if (seen[k] > 0) {
        const dx = around[k * 3] / seen[k] - x, dy = around[k * 3 + 1] / seen[k] - y, dz = around[k * 3 + 2] / seen[k] - z;
        const reach = Math.hypot(dx, dy, dz);
        if (reach > 1e-6) hollow = Math.max(0, Math.min(1, ((N[k * 3] * dx + ny * dy + N[k * 3 + 2] * dz) / reach) * 1.6));
      }
      const foot = 1 - smoothstep(0, 0.9, y);
      const dark = Math.min(1, 0.55 * hollow + 0.35 * Math.max(0, -ny) + 0.3 * foot);
      const shade = 1 - cavity * dark;
      let m = 0;
      if (moss > 0) {
        const from = 1 - 1.4 * moss;
        m = smoothstep(from, from + 0.18, ny + 0.6 * (fine - 0.5));
        // Moss gathers at the foot too, in patches.
        m = Math.max(m, foot * smoothstep(0.45, 0.62, fine) * Math.min(1, moss * 1.5));
        ramp(mossTone, 0.3 + 0.5 * Math.max(0, ny) + 0.5 * (fine - 0.5), green);
      }
      mossy[i] = m;
      for (let c = 0; c < 3; c++) colors[i * 3 + c] = (base[c] + (green[c] - base[c]) * m) * shade;
    }

    this.wear(o.skin, o.uvs !== undefined);
    const code = this.skinCode;
    const glow = o.glow ?? 0;
    const smooth = o.smooth ?? true;
    const uvs = o.uvs;
    // Every face's normal, its area in its length, and the faces round each welded point, for a crease.
    const F = new Float64Array(tris.length);
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], c = tris[t + 2];
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      F[t] = uy * vz - uz * vy; F[t + 1] = uz * vx - ux * vz; F[t + 2] = ux * vy - uy * vx;
    }
    const crease = o.crease === undefined ? -2 : Math.cos(o.crease);
    const faces: number[][] = [];
    if (smooth && o.crease !== undefined) {
      for (let k = 0; k < groups; k++) faces.push([]);
      for (let t = 0; t < tris.length; t += 3) for (let j = 0; j < 3; j++) faces[weld[tris[t + j]]].push(t);
    }
    const normal = [0, 0, 0];
    for (let t = 0; t < tris.length; t += 3) {
      const fl = Math.hypot(F[t], F[t + 1], F[t + 2]) || 1;
      const fx = F[t] / fl, fy = F[t + 1] / fl, fz = F[t + 2] / fl;
      for (let j = 0; j < 3; j++) {
        const i = tris[t + j], k = weld[i];
        if (!smooth) {
          normal[0] = fx; normal[1] = fy; normal[2] = fz;
        } else if (crease < -1) {
          normal[0] = N[k * 3]; normal[1] = N[k * 3 + 1]; normal[2] = N[k * 3 + 2];
        } else {
          // Only the faces round the point that lie within the crease of this one.
          normal[0] = normal[1] = normal[2] = 0;
          for (const u of faces[k]) {
            const ul = Math.hypot(F[u], F[u + 1], F[u + 2]) || 1;
            if ((F[u] * fx + F[u + 1] * fy + F[u + 2] * fz) / ul < crease) continue;
            normal[0] += F[u]; normal[1] += F[u + 1]; normal[2] += F[u + 2];
          }
          const l = Math.hypot(normal[0], normal[1], normal[2]) || 1;
          normal[0] /= l; normal[1] /= l; normal[2] /= l;
        }
        this.data.push(
          P[i * 3], P[i * 3 + 1], P[i * 3 + 2],
          normal[0], normal[1], normal[2],
          colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2],
          o.sways ? o.sways[i] : o.sway ?? 0, glow,
          code, code > 0 ? mossy[i] : 0, uvs ? uvs[i * 2] * scale : 0, uvs ? uvs[i * 2 + 1] * scale : 0,
        );
      }
    }
    this.skinCode = 0;
  }

  /**
   * A rock that stands on y, `w` wide, `h` tall and `d` deep, with its middle at x and z: a fine ball pushed
   * out of round by noise, then cut by a few broad planes the way the sheets paint rock, shaded smooth.
   * A ramp runs from its shaded underside to its sunlit top. Level 2 is about 280 triangles, level 3 about 1,100.
   */
  rock(x: number, y: number, z: number, w: number, h: number, d: number, tone: Tone, o: RockOptions = {}): void {
    this.detailed = true;
    const level = Math.max(1, Math.min(4, Math.round(o.level ?? 2) - (this.detail < 0.75 ? 1 : 0)));
    const { points: unit, triangles } = icosphere(level);
    const lump = o.lump ?? 0.12, flat = o.flat ?? 0.9, reach = o.reach ?? 0.76;
    const planes: number[] = [];
    for (let i = 0; i < (o.planes ?? 5); i++) {
      // The first plane cuts its top, the rest its sides, leaning up a little.
      const angle = this.rr(0, Math.PI * 2), rise = i === 0 ? this.rr(1.2, 1.5) : this.rr(-0.15, 0.75);
      const l = Math.hypot(Math.cos(angle), rise, Math.sin(angle));
      planes.push(Math.cos(angle) / l, rise / l, Math.sin(angle) / l, reach + this.rr(-0.1, 0.1));
    }
    const off = this.rr(0, 100);
    const raw: number[] = [];
    const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < unit.length; i += 3) {
      const vx = unit[i], vy = unit[i + 1], vz = unit[i + 2];
      const r = 1 + lump * (fbm3(vx * 1.7 + off, vy * 1.7, vz * 1.7, this.noiseSeed) - 0.5) * 2.4;
      let px = vx * r, py = vy * r, pz = vz * r;
      for (let k = 0; k < planes.length; k += 4) {
        const dist = px * planes[k] + py * planes[k + 1] + pz * planes[k + 2] - planes[k + 3];
        // A soft cut: past the plane the point is pulled back onto it, and near it a little.
        const soft = 0.05;
        const over = dist > soft ? dist : dist > -soft ? ((dist + soft) * (dist + soft)) / (4 * soft) : 0;
        px -= planes[k] * over * flat; py -= planes[k + 1] * over * flat; pz -= planes[k + 2] * over * flat;
      }
      raw.push(px, py, pz);
      for (const [c, v] of [[0, px], [1, py], [2, pz]] as const) {
        low[c] = Math.min(low[c], v);
        high[c] = Math.max(high[c], v);
      }
    }
    // Fit the cut form to the box asked for. A seated rock sinks a quarter of its height, cut flat at y.
    const seat = o.seat ?? true;
    const bottom = seat ? y - h * 0.25 : y, height = seat ? h * 1.25 : h;
    const points: number[] = [];
    for (let i = 0; i < raw.length; i += 3) {
      const fx = (raw[i] - low[0]) / (high[0] - low[0]), fy = (raw[i + 1] - low[1]) / (high[1] - low[1]), fz = (raw[i + 2] - low[2]) / (high[2] - low[2]);
      points.push(x + (fx - 0.5) * w, Math.max(seat ? y : -Infinity, bottom + fy * height), z + (fz - 0.5) * d);
    }
    this.mesh(points, triangles, tone, { key: 0.22, crease: 0.6, ...o, hints: unit, floor: seat ? y : undefined });
    if (o.shadow ?? true) this.shadowBlob(x, y + h * 0.42, z, w * 0.42, h * 0.48, d * 0.42);
  }

  /**
   * A smooth tube along a path that bends through its points: a root, a log, a branch, a rope, an arch of rock.
   * It can taper (`radii` at each point), flatten (`squash`), carry ridges (`ribs`), be hollow (`bore`) and
   * open along its underside (`gap`). Its skin's v runs along it, so bark and grain follow it.
   * About 2 × sides × (points - 1) × steps triangles, plus the ends.
   */
  sweep(path: readonly V3[], radii: readonly number[], tone: Tone, o: SweepOptions = {}): void {
    this.detailed = true;
    const sides = Math.max(4, Math.round((o.sides ?? 10) * this.detail));
    const steps = Math.max(1, Math.round((o.steps ?? 3) * this.detail));
    const squash = o.squash ?? 1, lump = o.lump ?? 0, gap = o.gap ?? 0;
    const bore = o.bore;
    // The smooth path: a Catmull-Rom curve through the points, with the radii (and bores, sways) between them.
    const C: number[] = [], R: number[] = [], B: number[] = [], S: number[] = [];
    const last = path.length - 1;
    const at = (i: number) => path[Math.max(0, Math.min(last, i))];
    const boreAt = (i: number) => (bore === undefined ? 0 : typeof bore === 'number' ? bore : bore[i]);
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        for (let c = 0; c < 3; c++) C.push(0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3));
        R.push(radii[i] + (radii[i + 1] - radii[i]) * t);
        B.push(boreAt(i) + (boreAt(i + 1) - boreAt(i)) * t);
        S.push(o.sways ? o.sways[i] + (o.sways[i + 1] - o.sways[i]) * t : o.sway ?? 0);
      }
    }
    C.push(...path[last]);
    R.push(radii[last]);
    B.push(boreAt(last));
    S.push(o.sways ? o.sways[last] : o.sway ?? 0);
    const rows = R.length;
    // A frame at every ring: U across and V up-ish, carried along so the ring does not twist.
    const T: number[] = [], U: number[] = [], V: number[] = [], along: number[] = [];
    let ux = 0, uy = 0, uz = 0, length = 0;
    for (let i = 0; i < rows; i++) {
      const a = Math.max(0, i - 1), b = Math.min(rows - 1, i + 1);
      let tx = C[b * 3] - C[a * 3], ty = C[b * 3 + 1] - C[a * 3 + 1], tz = C[b * 3 + 2] - C[a * 3 + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      if (i === 0) {
        // Across is level, so V is as near up as it can be and a gap opens downward. A sweep that starts
        // upright, like an arch's foot, takes across square to the way it bends, so its squash stays in the bend.
        if (Math.abs(ty) > 0.95) {
          const dx = path[last][0] - path[0][0], dz = path[last][2] - path[0][2], dl = Math.hypot(dx, dz);
          if (dl > 1e-6) { ux = (ty * dz) / dl; uy = 0; uz = (-ty * dx) / dl; } else { ux = 1; uy = 0; uz = 0; }
        } else { ux = -tz; uy = 0; uz = tx; }
      }
      // Keep U square to the new tangent.
      const dot = ux * tx + uy * ty + uz * tz;
      ux -= tx * dot; uy -= ty * dot; uz -= tz * dot;
      const ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      T.push(tx, ty, tz);
      U.push(ux, uy, uz);
      V.push(uy * tz - uz * ty, uz * tx - ux * tz, ux * ty - uy * tx);
      if (i > 0) length += Math.hypot(C[i * 3] - C[i * 3 - 3], C[i * 3 + 1] - C[i * 3 - 2], C[i * 3 + 2] - C[i * 3 - 1]);
      along.push(length);
    }
    // Angles round the ring. With a gap they stop short of the bottom; without, the last meets the first.
    const from = gap > 0 ? -Math.PI / 2 + gap / 2 : (o.turn ?? 0), to = gap > 0 ? (3 * Math.PI) / 2 - gap / 2 : from + Math.PI * 2;
    const angles: number[] = [];
    for (let k = 0; k <= sides; k++) angles.push(from + ((to - from) * k) / sides);
    const cols = angles.length;
    const off = this.rr(0, 100);
    const ring = (i: number, radius: number, inward: boolean, points: number[], hints: number[], uvs: number[], sways: number[], wobble: number) => {
      for (let k = 0; k < cols; k++) {
        const a = angles[k], ca = Math.cos(a), sa = Math.sin(a) * squash;
        const dx = U[i * 3] * ca + V[i * 3] * sa, dy = U[i * 3 + 1] * ca + V[i * 3 + 1] * sa, dz = U[i * 3 + 2] * ca + V[i * 3 + 2] * sa;
        const bx = C[i * 3] + dx * radius, by = C[i * 3 + 1] + dy * radius, bz = C[i * 3 + 2] + dz * radius;
        let f = 1 + wobble * (fbm3(bx * 0.8 + off, by * 0.8, bz * 0.8, this.noiseSeed) - 0.5) * 2.4;
        if (o.ribs && !inward) {
          const phase = o.ribs[0] * a + (fbm3(C[i * 3] * 0.3, C[i * 3 + 1] * 0.3 + off, C[i * 3 + 2] * 0.3, this.noiseSeed) - 0.5) * 4;
          f -= o.ribs[1] * (0.5 + 0.5 * Math.cos(phase));
        }
        points.push(C[i * 3] + dx * radius * f, Math.max(o.floor ?? -Infinity, C[i * 3 + 1] + dy * radius * f), C[i * 3 + 2] + dz * radius * f);
        hints.push(inward ? -dx : dx, inward ? -dy : dy, inward ? -dz : dz);
        uvs.push(a * Math.max(0.2, radius), along[i]);
        sways.push(S[i]);
      }
    };
    const grid = (rowCount: number) => {
      const tris: number[] = [];
      for (let r = 0; r < rowCount - 1; r++) for (let k = 0; k < cols - 1; k++) {
        const a = r * cols + k, b = a + 1, c = a + cols, d = c + 1;
        tris.push(a, c, b, b, c, d);
      }
      return tris;
    };
    const outer = { points: [] as number[], hints: [] as number[], uvs: [] as number[], sways: [] as number[] };
    const hollow = bore !== undefined;
    const cap = hollow || gap > 0 ? 'none' : o.cap ?? 'both';
    // A rounded tip: two rings that close in past the end, then a point.
    const tip = (i: number, sign: number) => {
      for (const q of [0.55, 0.88, 1]) {
        const radius = R[i] * Math.cos((q * Math.PI) / 2) * (q === 1 ? 0 : 1);
        const shift = R[i] * Math.sin((q * Math.PI) / 2) * 0.6 * sign;
        const before = outer.points.length;
        ring(i, radius, false, outer.points, outer.hints, outer.uvs, outer.sways, lump);
        for (let p = before, k = 0; p < outer.points.length; p += 3, k++) {
          outer.points[p] += T[i * 3] * shift; outer.points[p + 1] += T[i * 3 + 1] * shift; outer.points[p + 2] += T[i * 3 + 2] * shift;
          outer.hints[p] += T[i * 3] * sign * q; outer.hints[p + 1] += T[i * 3 + 1] * sign * q; outer.hints[p + 2] += T[i * 3 + 2] * sign * q;
        }
      }
    };
    let rowCount = rows;
    if (cap === 'start' || cap === 'both') {
      tip(0, -1);
      // The tip was made outward from the end; turn its rings round so they run into the body.
      const size = cols * 3, rings = 3;
      for (const list of [outer.points, outer.hints]) {
        const parts = [];
        for (let r = rings - 1; r >= 0; r--) parts.push(...list.slice(r * size, r * size + size));
        list.splice(0, rings * size, ...parts);
      }
      for (const [list, width] of [[outer.uvs, 2], [outer.sways, 1]] as const) {
        const parts = [];
        for (let r = rings - 1; r >= 0; r--) parts.push(...list.slice(r * cols * width, (r + 1) * cols * width));
        list.splice(0, rings * cols * width, ...parts);
      }
      rowCount += 3;
    }
    for (let i = 0; i < rows; i++) ring(i, R[i], false, outer.points, outer.hints, outer.uvs, outer.sways, lump);
    if (cap === 'end' || cap === 'both') {
      tip(rows - 1, 1);
      rowCount += 3;
    }
    this.mesh(outer.points, grid(rowCount), tone, { ...o, hints: outer.hints, uvs: outer.uvs, sways: outer.sways, floor: o.floor });
    if (!hollow) return;
    const inner = { points: [] as number[], hints: [] as number[], uvs: [] as number[], sways: [] as number[] };
    for (let i = 0; i < rows; i++) ring(i, B[i], true, inner.points, inner.hints, inner.uvs, inner.sways, lump * 0.4);
    // The inside is in shade and has no moss.
    this.mesh(inner.points, grid(rows), o.innerTone ?? tone, { ...o, moss: 0, light: 0.1, hints: inner.hints, uvs: inner.uvs, sways: inner.sways });
    // The rims: each end, and the two long edges of a gap.
    const rimTone = o.rimTone ?? tone;
    const strip = (pick: (side: 0 | 1, j: number) => number, length: number, hint: (j: number) => V3) => {
      const points: number[] = [], hints: number[] = [], tris: number[] = [];
      for (let j = 0; j < length; j++) {
        for (const side of [0, 1] as const) {
          const p = pick(side, j), list = side === 0 ? outer.points : inner.points;
          points.push(list[p * 3], list[p * 3 + 1], list[p * 3 + 2]);
          hints.push(...hint(j));
        }
        if (j > 0) tris.push((j - 1) * 2, (j - 1) * 2 + 1, j * 2, (j - 1) * 2 + 1, j * 2 + 1, j * 2);
      }
      this.mesh(points, tris, rimTone, { ...o, moss: 0, skin: o.rimSkin ?? o.skin, hints, light: 0.15, mottle: 0.25 });
    };
    const end = (i: number, sign: number): V3 => [T[i * 3] * sign, T[i * 3 + 1] * sign, T[i * 3 + 2] * sign];
    strip((_, k) => k, cols, () => end(0, -1));
    strip((_, k) => (rows - 1) * cols + k, cols, () => end(rows - 1, 1));
    if (gap > 0) {
      for (const [k, sign] of [[0, -1], [cols - 1, 1]] as const) {
        strip((_, i) => i * cols + k, rows, (i) => {
          const a = angles[k] + (sign * Math.PI) / 2;
          return [U[i * 3] * Math.cos(a) + V[i * 3] * Math.sin(a), U[i * 3 + 1] * Math.cos(a) + V[i * 3 + 1] * Math.sin(a), U[i * 3 + 2] * Math.cos(a) + V[i * 3 + 2] * Math.sin(a)];
        });
      }
    }
  }

  /**
   * A form turned round an upright axis: a post, a pot, a stilt, a mushroom, a round or (with `square`) a
   * hipped roof. `profile` is [radius, height above y] from the bottom up. Its skin's v runs up the profile,
   * so thatch runs down a roof. About 2 × sides × (profile points - 1) triangles, plus the ends.
   */
  lathe(x: number, y: number, z: number, profile: readonly (readonly [number, number])[], tone: Tone, o: LatheOptions = {}): void {
    this.detailed = true;
    const sides = Math.max(4, Math.round((o.sides ?? 12) * this.detail));
    const square = o.square ?? 0, lump = o.lump ?? 0, turn = o.turn ?? 0;
    const cols = sides + 1, rows = profile.length;
    const points: number[] = [], hints: number[] = [], uvs: number[] = [], tris: number[] = [];
    // The way out of the profile at each point, in its own plane: (out, up).
    const normals = profile.map((_, i) => {
      let nr = 0, nh = 0;
      for (const [a, b] of [[i - 1, i], [i, i + 1]]) {
        if (a < 0 || b >= rows) continue;
        const dr = profile[b][0] - profile[a][0], dh = profile[b][1] - profile[a][1], l = Math.hypot(dr, dh) || 1;
        nr += dh / l; nh -= dr / l;
      }
      return [nr, nh] as const;
    });
    let climb = 0;
    const off = this.rr(0, 100);
    for (let i = 0; i < rows; i++) {
      if (i > 0) climb += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]);
      const [r, height] = profile[i];
      for (let k = 0; k < cols; k++) {
        const a = turn + (k / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const reach = 1 + square * (1 / Math.max(Math.abs(ca), Math.abs(sa)) - 1);
        const bx = x + ca * r * reach, by = y + height, bz = z + sa * r * reach;
        const f = 1 + lump * (fbm3(bx * 0.9 + off, by * 0.9, bz * 0.9, this.noiseSeed) - 0.5) * 2.4;
        points.push(x + ca * r * reach * f, by, z + sa * r * reach * f);
        hints.push(ca * normals[i][0], normals[i][1], sa * normals[i][0]);
        uvs.push(((k / sides) * Math.PI * 2) * Math.max(0.2, r), climb);
      }
    }
    for (let r = 0; r < rows - 1; r++) for (let k = 0; k < sides; k++) {
      const a = r * cols + k, b = a + 1, c = a + cols, d = c + 1;
      tris.push(a, b, c, b, d, c);
    }
    this.mesh(points, tris, tone, { ...o, hints, uvs });
    if (o.cap === false) return;
    for (const [i, up] of [[0, -1], [rows - 1, 1]] as const) {
      if (profile[i][0] < 0.005) continue;
      const disc: number[] = [], discHints: number[] = [], fan: number[] = [];
      disc.push(x, y + profile[i][1], z);
      discHints.push(0, up, 0);
      for (let k = 0; k < cols; k++) {
        disc.push(points[(i * cols + k) * 3], points[(i * cols + k) * 3 + 1], points[(i * cols + k) * 3 + 2]);
        discHints.push(0, up, 0);
        if (k > 0) fan.push(0, k, k + 1);
      }
      this.mesh(disc, fan, o.capTone ?? tone, { ...o, hints: discHints, moss: up > 0 ? o.moss : 0 });
    }
  }

  /**
   * A box with rounded edges that stands on y, shaded smooth: masonry, a plastered wall, a hewn beam.
   * Its skin's v runs along its longest side. 108 triangles with one segment round each edge, 300 with two.
   */
  roundBox(x: number, y: number, z: number, w: number, h: number, d: number, tone: Tone, o: RoundBoxOptions = {}): void {
    const half = [w / 2, h / 2, d / 2];
    const center = [x, y + h / 2, z];
    const round = Math.max(0.005, Math.min(o.round ?? Math.min(w, h, d) * 0.2, half[0] * 0.95, half[1] * 0.95, half[2] * 0.95));
    const wanted = o.segments ?? 1;
    if (wanted > 1) this.detailed = true;
    const segments = Math.max(1, Math.round(wanted * this.detail));
    const skip = o.skip ?? '';
    const wobble = o.wobble ?? 0;
    const long = w >= h && w >= d ? 0 : h >= d ? 1 : 2;
    // The places along each side where the grid has a line: the round of one edge, the flat, the round of the other.
    const lines = half.map((size) => {
      const flat = size - round, list: number[] = [];
      for (let k = segments; k >= 1; k--) list.push(-(flat + round * Math.sin((k * Math.PI) / (2 * segments))));
      list.push(-flat, flat);
      for (let k = 1; k <= segments; k++) list.push(flat + round * Math.sin((k * Math.PI) / (2 * segments)));
      return list;
    });
    const points: number[] = [], hints: number[] = [], uvs: number[] = [], tris: number[] = [];
    const off = this.rr(0, 100);
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [1, -1]) {
        if (skip.includes((sign > 0 ? '+' : '-') + 'xyz'[axis])) continue;
        const a1 = (axis + 1) % 3, a2 = (axis + 2) % 3;
        const along = long !== axis ? long : a2;
        const first = points.length / 3, l1 = lines[a1], l2 = lines[a2];
        for (const s1 of l1) for (const s2 of l2) {
          const p = [0, 0, 0];
          p[axis] = sign * half[axis]; p[a1] = s1; p[a2] = s2;
          // Pull the point onto the rounded box: the nearest point of the inner box, and out by the round.
          const q = p.map((v, i) => Math.max(-(half[i] - round), Math.min(half[i] - round, v)));
          const dir = p.map((v, i) => v - q[i]);
          const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
          const out = q.map((v, i) => v + (dir[i] / l) * round);
          const shift = wobble * (fbm3(center[0] + out[0] + off, center[1] + out[1], center[2] + out[2], this.noiseSeed) - 0.5) * 2;
          points.push(center[0] + out[0] + (dir[0] / l) * shift, center[1] + out[1] + (dir[1] / l) * shift, center[2] + out[2] + (dir[2] / l) * shift);
          hints.push(dir[0] / l, dir[1] / l, dir[2] / l);
          uvs.push(center[along === a1 ? a2 : a1] + p[along === a1 ? a2 : a1], center[along] + p[along]);
        }
        const n2 = l2.length;
        for (let i = 0; i < l1.length - 1; i++) for (let j = 0; j < n2 - 1; j++) {
          const a = first + i * n2 + j, b = a + 1, c = a + n2, e = c + 1;
          tris.push(a, c, b, b, c, e);
        }
      }
    }
    this.mesh(points, tris, tone, { light: 0.22, mottle: 0.14, cavity: 0.35, ...o, hints, uvs });
  }

  // ---------------------------------------------------------------- age

  /** Where the next part starts, for `weather`. */
  mark(): number {
    return this.data.length / FLOATS;
  }

  /**
   * Ages everything drawn since `from` (a `mark()`): moss from the ground, soot, worn edges, streaks under
   * sills, a sagging middle, a lean. It works on the part's corners, so it is as fine as the part is cut.
   */
  weather(from: number, o: WeatherOptions): void {
    const end = this.data.length / FLOATS;
    if (end <= from) return;
    const d = this.data, inverse = _m2.copy(this.matrix).invert(), e = inverse.elements, w = this.matrix.elements;
    const local = (i: number, out: number[]) => {
      const x = d[i], y = d[i + 1], z = d[i + 2];
      out[0] = e[0] * x + e[4] * y + e[8] * z + e[12];
      out[1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      out[2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    };
    const p = [0, 0, 0];
    const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
    let top = -Infinity;
    for (let c = from; c < end; c++) {
      local(c * FLOATS, p);
      for (let k = 0; k < 3; k++) { low[k] = Math.min(low[k], p[k]); high[k] = Math.max(high[k], p[k]); }
      top = Math.max(top, d[c * FLOATS + 1]);
    }
    const seed = this.noiseSeed + 31;
    const green = [0, 0, 0];
    const reach = o.sootReach ?? 1.2, stain = o.stain ?? 0.35;
    const span = Math.max(1e-6, high[1] - low[1]), half = Math.max(1e-6, (high[0] - low[0]) / 2), middle = (high[0] + low[0]) / 2;
    for (let c = from; c < end; c++) {
      const i = c * FLOATS, x = d[i], y = d[i + 1], z = d[i + 2];
      local(i, p);
      // Two noises, each worked out only when an effect at this corner needs it.
      let n1 = -1, n2 = -1;
      const slow = () => (n1 < 0 ? (n1 = noise3(x * 1.3, y * 1.3, z * 1.3, seed)) : n1);
      const quick = () => (n2 < 0 ? (n2 = noise3(x * 3.1 + 5, y * 3.1, z * 3.1, seed + 3)) : n2);
      let f = 1;
      if (o.wear) {
        const most = Math.max(Math.abs(d[i + 3]), Math.abs(d[i + 4]), Math.abs(d[i + 5]));
        if (most < 0.97) f *= 1 + o.wear * 0.4 * smoothstep(0.97, 0.78, most) * (0.5 + quick());
      }
      if (o.soot && y > top - reach) f *= 1 - o.soot * 0.75 * smoothstep(top - reach, top, y) * (0.55 + 0.6 * slow());
      if (o.stains) for (const s of o.stains) {
        const dx = Math.abs(p[0] - s[0]) - s[3] / 2, below = s[1] - p[1];
        if (below < -0.02 || below > s[4] || Math.abs(p[2] - s[2]) > 0.8 || dx > 0.25) continue;
        const side = 1 - smoothstep(-0.05, 0.25, dx);
        f *= 1 - stain * side * (1 - below / s[4]) * (0.6 + 0.6 * quick());
      }
      if (f !== 1) for (let k = 6; k < 9; k++) d[i + k] *= f;
      if (o.moss && y < o.moss * 1.7) {
        const m = (1 - smoothstep(0, o.moss, y + (slow() - 0.5) * o.moss * 1.2)) * smoothstep(0.3, 0.6, quick() + 0.15);
        if (m > 0.01) {
          ramp(MOSS, 0.1 + 0.35 * slow(), green);
          for (let k = 0; k < 3; k++) d[i + 6 + k] += (green[k] - d[i + 6 + k]) * m * 0.6;
          if (d[i + 11] > 0) d[i + 12] = Math.max(d[i + 12], m * 0.85);
        }
      }
      if (o.sag || o.lean) {
        const t = (p[1] - low[1]) / span;
        if (o.sag) { const u = (p[0] - middle) / half; p[1] -= o.sag * Math.max(0, 1 - u * u) * t; }
        if (o.lean) p[0] += o.lean * t;
        d[i] = w[0] * p[0] + w[4] * p[1] + w[8] * p[2] + w[12];
        d[i + 1] = w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13];
        d[i + 2] = w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14];
      }
    }
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
    const rounded = new Int32Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) rounded[i] = Math.round(this.data[i] * 4096);
    const { group, firsts } = groupRows(rounded, FLOATS);
    const index = Array.from(group);
    const kept: number[] = [];
    for (const first of firsts) for (let k = 0; k < FLOATS; k++) kept.push(this.data[first * FLOATS + k]);
    const total = kept.length / FLOATS;
    const position = new Float32Array(total * 3), normal = new Float32Array(total * 3), color = new Float32Array(total * 3), fx = new Float32Array(total * 2), skin = new Float32Array(total * 4);
    for (let i = 0; i < total; i++) {
      const o = i * FLOATS;
      position.set(kept.slice(o, o + 3), i * 3);
      normal.set(kept.slice(o + 3, o + 6), i * 3);
      color.set(kept.slice(o + 6, o + 9), i * 3);
      fx.set(kept.slice(o + 9, o + 11), i * 2);
      skin.set(kept.slice(o + 11, o + 15), i * 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geometry.setAttribute('aFx', new THREE.BufferAttribute(fx, 2));
    geometry.setAttribute('aSkin', new THREE.BufferAttribute(skin, 4));
    geometry.setIndex(total > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const extras: ShapeExtras = { blobs: new Float32Array(this.blobs), boxes: new Float32Array(this.boxes), lights: new Float32Array(this.lights), triangles: index.length / 3, detailed: this.detailed };
    geometry.userData.prop = extras;
    return geometry;
  }
}

/** What a finished prop geometry carries: its shadow casters, its lights and its triangle count. */
export function extrasOf(geometry: THREE.BufferGeometry): ShapeExtras {
  return geometry.userData.prop as ShapeExtras;
}
