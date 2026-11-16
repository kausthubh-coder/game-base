// Ilara's Hall, its door and the settlement's dinner, from the sheets assets-src/concept/rooms/hallInside.webp,
// 3-sacred/hallDoor.webp and settlement/dinner.webp. One unit is one block. +z faces the hall's entrance, and a
// wall piece's face looks toward +z.
import type { BufferGeometry } from 'three';
import * as arch from '../arch.ts';
import { type MeshOptions, Shape, type Skin, type Tone } from '../shape.ts';

// The sheet's palette (and assets-src/concept/stone.md): warm limestone with lavender shade, aged brass, sage
// moss, ochre roots, a teal accent. Every ramp runs from dark to light.
const STONE = arch.HEARTH;
const BRASS = [0x4a3220, 0x7a5a2a, 0xa57e3c, 0xc79f4e, 0xe8cb78, 0xfff0c0];
/** The Heartstone's cradle: brass kept polished, and the same with the stone's light on it. */
const GOLD = [0x5a3414, 0x8f5a1e, 0xbd8430, 0xdca545, 0xf4cc6a, 0xffeeb0];
const GOLD_LIT = [0x8f5a1e, 0xc98a30, 0xeab550, 0xfbe090];
const SAGE = [0x58674c, 0x89936b, 0xa0a18e];
const IVY = [0x3c5537, 0x516b3c, 0x6c8043, 0x8d9a4a];
const LILAC = [0x8b6a9b, 0xb395bd, 0xd6bfda];
const ROOT = [0x705249, 0x98613c, 0xc68b50];
const TEAL = [0x4a7777, 0x648f88, 0x83aba2];
/** The Custodian's cloth: the teal, faded. */
const CLOTH = [0x3f5f60, 0x55797a, 0x6f958c];
const WATER = [0x3d6b70, 0x4f8787, 0x68a39c, 0x8cc0b2];
/** Stone in the lavender shade of a niche or a reveal. */
const SHADE = [0x7f7690, 0x9c91a7, 0xb5a6a8];
/** The settlement's honey wood, cream linen and its red stripe, hemp rope, amber glass. */
const HONEY = [0x8a5f33, 0x9b6f3e, 0xb78b5a, 0xc99d68];
const LINEN = [0xcdbf9e, 0xe6dcc5, 0xf6ecd5];
const STRIPE = 0xab5e4e;
const ROPE = [0xab8f64, 0xbba67a, 0xd1bc90];
const AMBER = [0x9a6a20, 0xb8862c, 0xd8aa48, 0xf0d488];
/** Glass with no light in it: the ancients' dormant lavender. */
const DORMANT = [0x6c6f8c, 0x7e829e, 0x9a9db5];
const TAU = Math.PI * 2;
type V3 = [number, number, number];

// ---------------------------------------------------------------- growth: ivy, flowers, moss

/** One ivy leaf hanging from p: three-lobed, looking the way `out` says and leaning to one side by `lean`. */
function ivyLeaf(s: Shape, p: V3, out: V3, size: number, lean: number, two: boolean): void {
  const l = Math.hypot(out[0], out[2]) || 1, sx = out[2] / l, sz = -out[0] / l;
  const at = (down: number, side: number, lift: number): V3 => [
    p[0] + sx * (side + lean * down) * size + out[0] * lift,
    p[1] - down * size + out[1] * lift,
    p[2] + sz * (side + lean * down) * size + out[2] * lift,
  ];
  s.poly([at(0, 0, 0.02), at(0.22, 0.5, 0.07), at(0.66, 0.26, 0.06), at(1, 0, 0.03), at(0.66, -0.26, 0.06), at(0.22, -0.5, 0.07)], IVY[1 + Math.floor(s.r() * 3)], { two, toward: out, skin: 'flat' });
}

/** A strand of ivy hanging from (x, y, z) for `length`, its leaves looking the way `out` says. */
function ivyStrand(s: Shape, x: number, y: number, z: number, length: number, out: V3 = [0, 0.35, 1], two = false): void {
  const n = Math.max(3, Math.round(length / (s.detail < 0.75 ? 0.52 : 0.26))), drift = s.rr(-0.25, 0.25), beat = s.rr(0, 6);
  const l = Math.hypot(out[0], out[2]) || 1, sx = out[2] / l, sz = -out[0] / l;
  const at = (t: number): V3 => {
    const w = (Math.sin(t * 6 + beat) * 0.1 + drift * t) * Math.min(1.5, length);
    return [x + sx * w, y - t * length, z + sz * w];
  };
  s.tube([at(0), at(0.35), at(0.7), at(1)], [0.024, 0.02, 0.014, 0.005], 3, IVY[0], { skin: 'flat' });
  for (let i = 0; i < n; i++) {
    const t = (i + 0.4) / n, p = at(t), side = i % 2 ? 1 : -1, turn = s.rr(-0.5, 0.5);
    ivyLeaf(s, [p[0] + sx * side * 0.07, p[1], p[2] + sz * side * 0.07], [out[0] + sx * turn, out[1], out[2] + sz * turn], (0.36 - 0.12 * t) * s.rr(0.8, 1.2), side * s.rr(0.3, 0.9), two);
  }
}

/** Ivy heaped on a ledge or over a wall's top: a few low clumps, and leaves standing out of them all round its front. Its foot is at y. */
function ivyMass(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number): void {
  const clumps = s.detail < 0.75 ? 2 : 3;
  for (let i = 0; i < clumps; i++) {
    const t = i / (clumps - 1) - 0.5;
    s.blob(x + t * w * 0.6 + s.rr(-0.08, 0.08), y + h * s.rr(0.25, 0.4), z + s.rr(-0.12, 0.12) * d, w * s.rr(0.26, 0.34), h * s.rr(0.5, 0.75), d * s.rr(0.36, 0.5), IVY, { sides: 6, rings: 2, jitter: 0.3, noise: 0.55, floor: y, skin: 'moss' });
  }
  const n = Math.round((w + d) * (s.detail < 0.75 ? 2 : 5));
  for (let i = 0; i < n; i++) {
    const a = s.rr(-2, 2), reach = s.rr(0.38, 0.56);
    ivyLeaf(s, [x + Math.sin(a) * w * reach, y + h * s.rr(0.35, 1), z + Math.cos(a) * d * reach], [Math.sin(a) * 0.7, 0.7, Math.cos(a) * 0.7 + 0.2], s.rr(0.28, 0.42), s.rr(-0.7, 0.7), false);
  }
}

/** A clump of the court's lilac flowers in their leaves. */
function flowers(s: Shape, x: number, y: number, z: number, n = 5, spread = 0.36): void {
  s.blob(x, y, z, spread * 0.95, 0.17, spread * 0.65, IVY, { sides: 6, rings: 2, floor: y, jitter: 0.25, skin: 'flat' });
  const count = s.detail < 0.75 ? Math.ceil(n / 2) : n;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + s.rr(0, 0.8), r = spread * s.rr(0.2, 1), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r * 0.7, h = s.rr(0.16, 0.38);
    s.tube([[px, y + 0.06, pz], [px + 0.02, y + h, pz]], [0.014, 0.01], 3, IVY[2], { skin: 'flat', cap: 'none' });
    s.disc(px + 0.02, y + h, pz, s.rr(0.1, 0.14), 5, LILAC[i % 3], { turn: a, skin: 'flat' });
    s.disc(px + 0.02, y + h + 0.014, pz, 0.036, 4, 0xf7e09a, { skin: 'flat' });
  }
}

/** A low pad of moss in a joint or on a ledge. */
function mossPad(s: Shape, x: number, y: number, z: number, w: number, d: number): void {
  s.blob(x, y, z, w / 2, 0.07, d / 2, SAGE, { sides: 6, rings: 2, floor: y, jitter: 0.3, skin: 'moss' });
}

// ---------------------------------------------------------------- shared forms

/** A point at t, 0 to 1, on the smooth curve through `pts`. Each point may carry any count of numbers. */
function along(pts: readonly (readonly number[])[], t: number): number[] {
  const last = pts.length - 1, f = Math.max(0, Math.min(1, t)) * last, i = Math.min(last - 1, Math.floor(f)), u = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(last, i + 2)];
  return p1.map((_, c) => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * u * u * u));
}

/** How many pieces a soft surface is cut into: fewer at a low detail. */
const cut = (s: Shape, n: number) => Math.max(2, Math.round(n * (s.detail < 0.75 ? 0.55 : 1)));

/**
 * A smooth surface over a grid. `at(u, v)`, u and v from 0 to 1, gives a point, and as a fourth number how far
 * that point moves along the ramp. `side` 1 faces the way u cross v points, -1 the other way, 0 both, the back
 * in `backTone`.
 */
function grid(s: Shape, nu: number, nv: number, at: (u: number, v: number) => readonly number[], tone: Tone, o: MeshOptions & { side?: number; backTone?: Tone } = {}): void {
  const points: number[] = [], hints: number[] = [], shifts: number[] = [], tris: number[] = [], e = 1e-3;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv, p = at(u, v);
    points.push(p[0], p[1], p[2]);
    shifts.push(p[3] ?? 0);
    const a = at(Math.min(1, u + e), v), b = at(Math.max(0, u - e), v), c = at(u, Math.min(1, v + e)), d = at(u, Math.max(0, v - e));
    const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
    hints.push(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (i < nu && j < nv) {
      const q = j * (nu + 1) + i;
      tris.push(q, q + 1, q + nu + 2, q, q + nu + 2, q + nu + 1);
    }
  }
  const { side = 1, backTone, ...rest } = o;
  if (side >= 0) s.mesh(points, tris, tone, { ...rest, hints, shifts });
  if (side <= 0) s.mesh(points, tris, backTone ?? tone, { ...rest, hints: hints.map((h) => -h), shifts });
}

/** Where a surface is at (u, v) and `off` out from it: a point, then the way out. */
type Mapper = (u: number, v: number, off: number) => number[];

/** Dressed blocks gathered for one mesh: each a face a little proud, with chamfers down to the joints round it, in its own shade. */
class Blocks {
  private readonly p: number[] = [];
  private readonly t: number[] = [];
  private readonly h: number[] = [];
  private readonly sh: number[] = [];
  add(q: readonly number[], shift = 0): number {
    this.p.push(q[0], q[1], q[2]);
    this.h.push(q[3], q[4], q[5]);
    this.sh.push(shift);
    return this.p.length / 3 - 1;
  }
  quad(a: number, b: number, c: number, d: number): void {
    this.t.push(a, b, c, a, c, d);
  }
  tri(a: number, b: number, c: number): void {
    this.t.push(a, b, c);
  }
  /** A flat face through four points that all look the way `n` says. */
  face(a: V3, b: V3, c: V3, d: V3, n: V3, shift = 0): void {
    this.quad(this.add([...a, ...n], shift), this.add([...b, ...n], shift), this.add([...c, ...n], shift), this.add([...d, ...n], shift));
  }
  /** One block over u0..u1 and v0..v1 of a surface, cut into k pieces along u. `cu` and `cv` are its chamfers. */
  block(at: Mapper, u0: number, u1: number, v0: number, v1: number, cu: number, cv: number, rel: number, k: number, shift: number, flat = false): void {
    const us = (a: number, b: number) => Array.from({ length: k + 1 }, (_, j) => a + ((b - a) * j) / k);
    const row = (list: number[], v: number, off: number) => list.map((u) => this.add(at(u, v, off), shift));
    if (flat) {
      const bottom = row(us(u0, u1), v0, 0), top = row(us(u0, u1), v1, 0);
      for (let j = 0; j < k; j++) this.quad(bottom[j], bottom[j + 1], top[j + 1], top[j]);
      return;
    }
    const mu = Math.min(cu, (u1 - u0) * 0.3), mv = Math.min(cv, (v1 - v0) * 0.3);
    const ob = row(us(u0, u1), v0, 0), ot = row(us(u0, u1), v1, 0), ib = row(us(u0 + mu, u1 - mu), v0 + mv, rel), it = row(us(u0 + mu, u1 - mu), v1 - mv, rel);
    for (let j = 0; j < k; j++) {
      this.quad(ib[j], ib[j + 1], it[j + 1], it[j]);
      this.quad(ob[j], ob[j + 1], ib[j + 1], ib[j]);
      this.quad(it[j], it[j + 1], ot[j + 1], ot[j]);
    }
    this.quad(ob[0], ib[0], it[0], ot[0]);
    this.quad(ib[k], ob[k], ot[k], it[k]);
  }
  draw(s: Shape, tone: Tone, o: MeshOptions = {}): void {
    if (this.t.length) s.mesh(this.p, this.t, tone, { ...o, hints: this.h, shifts: this.sh });
  }
}

/** The look of the ancients' dressed stone, as `arch.ts` shades it. */
const dressed = (moss = 0, skin: Skin = 'limestone'): MeshOptions => ({ skin, crease: 0.4, light: 0.25, key: 0.3, mottle: 0.16, cavity: 0.5, moss, mossTone: SAGE });

interface RingStones {
  /** Where the arc starts and ends, as angles from +z toward +x. Default all round. */
  from?: number;
  to?: number;
  /** How far one stone's shade moves from the next. Default 0.2. */
  vary?: number;
  /** Turns the joints, as a share of one stone, so two rings do not line up. */
  phase?: number;
  rel?: number;
  chamfer?: number;
  /** Laid flat, with no chamfers: where nobody looks closely. */
  flat?: boolean;
}

/** A ring of paving, looking up: `n` wedge stones between two radii at height y. */
function paveRing(s: Shape, b: Blocks, r0: number, r1: number, y: number, n: number, o: RingStones = {}): void {
  const from = o.from ?? 0, to = o.to ?? TAU, step = (to - from) / n, whole = to - from > TAU - 1e-6;
  const top: Mapper = (a, r, off) => [Math.sin(a) * r, y + off, Math.cos(a) * r, 0, 1, 0];
  const c = o.chamfer ?? 0.045, flat = o.flat || s.detail < 0.75;
  for (let i = 0; i < n; i++) {
    const a0 = from + (i + (whole ? o.phase ?? 0 : 0)) * step;
    b.block(top, a0, a0 + step, r0, r1, c / ((r0 + r1) / 2), c, o.rel ?? 0.02, Math.max(1, Math.ceil((step * r1) / 0.75)), (s.r() - 0.5) * 2 * (o.vary ?? 0.2), flat);
  }
}

/** The upright face of a ring of stones at radius r, from y up by h: `sign` 1 looks out, -1 in toward the middle. */
function riseRing(s: Shape, b: Blocks, r: number, y: number, h: number, n: number, sign: number, o: RingStones = {}): void {
  const from = o.from ?? 0, to = o.to ?? TAU, step = (to - from) / n, whole = to - from > TAU - 1e-6;
  const side: Mapper = (a, v, off) => [Math.sin(a) * (r + off * sign), y + v, Math.cos(a) * (r + off * sign), Math.sin(a) * sign, 0, Math.cos(a) * sign];
  const c = o.chamfer ?? 0.04, flat = o.flat || s.detail < 0.75;
  for (let i = 0; i < n; i++) {
    const a0 = from + (i + (whole ? o.phase ?? 0 : 0)) * step;
    b.block(side, a0, a0 + step, 0, h, c / r, c, o.rel ?? 0.02, Math.max(1, Math.ceil((step * r) / 0.75)), (s.r() - 0.5) * 2 * (o.vary ?? 0.2), flat);
  }
}

// ---------------------------------------------------------------- the Heartstone
//
// An egg of clear crystal 2.5 blocks tall, a warm core and leaf veins inside it, held in brass leaves on a carved
// round base. Every prop is one opaque mesh, so the crystal is drawn the way a painter fakes glass: its near wall
// is left out, the far wall faces inward and is seen from any side with the core in front of it, and the near
// wall is only its cut edges and a few glints. `heartstoneParts` gives the same three parts apart.

const EGG_Y = 0.55, EGG_H = 2.5;
/** The egg's radius at t, 0 at its foot and 1 at its tip: widest two fifths of the way up. */
const eggR = (t: number) => 0.86 * Math.pow(Math.sin(Math.PI * Math.pow(Math.max(0, Math.min(1, t)), 0.8)), 0.68);

/**
 * The crystal's wall from foot to tip, dull, faint and awake. A lit part gives off 2.2 times its own colour on top
 * of the daylight on it, so the lit ramps are kept dim: they come out as warm amber low and pale lavender high.
 */
const SHELL: readonly (readonly number[])[] = [
  [0x8f8ca6, 0xa5a3ba, 0xbdbccc, 0xd3d3dd, 0xe2e3ea],
  [0x5e4826, 0x665a4c, 0x66647a, 0x6c6c88, 0x74769a],
  [0x8e6222, 0xa07a3a, 0xa08c62, 0x8c8a8c, 0x82829a],
];
/** The cut edges of its near wall, and the glints on it. */
const EDGE = [[0xcfd0dc, 0xf2f2f6], [0x7f7c8c, 0x9a98ac], [0xa49a8a, 0xbcb6b0]] as const;
/** The core and its veins from their edges to their hot middle. */
const CORE: readonly (readonly number[])[] = [
  [0x6c6f8c, 0x7e829e, 0x9799b3, 0xafb0c6],
  [0x5a3c18, 0x6e5426, 0x8a6c36, 0xa88848],
  [0x845418, 0x967c36, 0xc8a850, 0xf0dc90, 0xfff6d8],
];

function crystal(s: Shape, variant: number): void {
  const glow = variant === 0 ? 0 : 2, sides = s.detail < 0.75 ? 8 : 12, rows = s.detail < 0.75 ? 6 : 10;
  const tone = SHELL[variant];
  const at = (k: number, j: number, scale = 1): V3 => {
    const t = (1 - Math.cos((Math.PI * j) / rows)) / 2, a = (k / sides) * TAU, r = eggR(t) * scale;
    return [Math.sin(a) * r, EGG_Y + t * EGG_H, Math.cos(a) * r];
  };
  // The far wall, facet by facet, each a shade of its own.
  const points: number[] = [], hints: number[] = [], shifts: number[] = [], tris: number[] = [];
  for (let j = 0; j < rows; j++) for (let k = 0; k < sides; k++) {
    const t = (1 - Math.cos((Math.PI * (j + 0.5)) / rows)) / 2, facet = (s.r() - 0.5) * 0.14 + (k % 2 ? 0.04 : -0.04);
    const first = points.length / 3;
    for (const [dk, dj] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const p = at(k + dk, j + dj), tt = (1 - Math.cos((Math.PI * (j + dj)) / rows)) / 2;
      points.push(...p);
      hints.push(-p[0], 0.2 - tt * 0.4, -p[2]);
      shifts.push(Math.pow(tt, 0.8) - 0.5 + facet * (0.4 + t));
    }
    tris.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  s.mesh(points, tris, tone, { hints, shifts, smooth: false, light: 0, mottle: 0, cavity: 0, glow, skin: 'flat' });
  // The near wall: a thread along every other cut edge, and a glint on the shoulder between.
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * TAU, ax = Math.cos(a), az = -Math.sin(a);
    if (k % 2) {
      for (let j = 2; j < rows - 2; j++) {
        const p = at(k, j, 1.006), q = at(k, j + 1, 1.006), w = 0.007;
        s.poly([[p[0] - ax * w, p[1], p[2] - az * w], [p[0] + ax * w, p[1], p[2] + az * w], [q[0] + ax * w, q[1], q[2] + az * w], [q[0] - ax * w, q[1], q[2] - az * w]], EDGE[variant][0], { toward: [p[0], 0, p[2]], glow, skin: 'flat' });
      }
      continue;
    }
    if (k % 4) continue;
    const j = Math.round(rows * 0.6), m = (u: number, v: number): V3 => at(k + u, j + v, 1.01);
    s.poly([m(0.3, 0.2), m(0.52, 0), m(0.5, 1.5), m(0.34, 1.8)], EDGE[variant][1], { toward: [Math.sin(a + 0.2), 0.3, Math.cos(a + 0.2)], glow, skin: 'flat' });
    s.poly([m(0.62, 0.9), m(0.72, 0.8), m(0.7, 1.6), m(0.64, 1.7)], EDGE[variant][1], { toward: [Math.sin(a + 0.3), 0.3, Math.cos(a + 0.3)], glow, skin: 'flat' });
  }
}

function livingCore(s: Shape, variant: number): void {
  const glow = variant === 0 ? 0 : 2, tone = CORE[variant];
  const paint: MeshOptions = { glow, skin: 'flat', light: 0, mottle: 0, cavity: 0 };
  // The bud of light at its heart: hottest low in its middle.
  const bud = (t: number) => 0.24 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 0.9);
  grid(s, cut(s, 10), cut(s, 7), (u, v) => {
    const a = u * TAU, r = bud(v);
    return [Math.sin(a) * r, 0.72 + v * 1.35, Math.cos(a) * r, 0.45 - v * 0.75];
  }, tone, paint);
  // Three leaves of light curl up round it, and three small ones between them.
  for (let i = 0; i < 6; i++) {
    const big = i % 2 === 0, turn = (i / 6) * TAU + 0.3;
    const line = big ? [[0.1, 0.8], [0.4, 1.2], [0.52, 1.72], [0.4, 2.2], [0.2, 2.56]] : [[0.12, 0.78], [0.42, 0.98], [0.58, 1.3], [0.56, 1.62]];
    const half = big ? 0.18 : 0.11;
    grid(s, cut(s, 4), cut(s, big ? 7 : 5), (u, v) => {
      const [r, y] = along(line, v), uu = u * 2 - 1, wide = half * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * v)), 0.7);
      const rr = r + 0.05 * (1 - Math.abs(uu)) - 0.04 * uu * uu, a = turn + (uu * wide) / Math.max(0.25, r) + v * 0.5;
      return [Math.sin(a) * rr, y, Math.cos(a) * rr, 0.25 - 0.5 * Math.abs(uu) - v * 0.2];
    }, tone, { ...paint, side: 0 });
    if (!big) continue;
    // Veins run from each leaf to the crystal's wall and up into its tip.
    const root = (v: number): V3 => {
      const [r, y] = along(line, v), a = turn + v * 0.5;
      return [Math.sin(a) * r, y, Math.cos(a) * r];
    };
    const wall = (t: number, da: number, share: number): V3 => {
      const a = turn + da, r = eggR(t) * share;
      return [Math.sin(a) * r, EGG_Y + t * EGG_H, Math.cos(a) * r];
    };
    // Each vein leaves the leaf and climbs to the wall above it.
    const threads: [number, number, number][] = [[0.5, 0.42, 0.62], [0.72, -0.4, 0.78]];
    for (const [v, da, t] of threads) {
      const a = root(v), c = wall(t, da + 0.25, 0.94), b: V3 = [a[0] * 0.55 + c[0] * 0.45, a[1] * 0.4 + c[1] * 0.6, a[2] * 0.55 + c[2] * 0.45];
      s.tube([a, b, c], [0.02, 0.014, 0.005], 3, tone[tone.length - 2], { glow, skin: 'flat' });
    }
    s.tube([root(1), wall(0.9, 0.6, 0.55), wall(0.96, 0.9, 0.6)], [0.018, 0.012, 0.005], 3, tone[tone.length - 2], { glow, skin: 'flat' });
  }
  if (variant > 0) s.light(0, 1.65, 0);
}

/** One brass leaf of the cradle: `line` is its middle from root to tip as [radius, height]. */
function brassLeaf(s: Shape, turn: number, line: readonly (readonly number[])[], half: number, lit: number): void {
  grid(s, cut(s, 4), cut(s, line.length > 4 ? 8 : 5), (u, v) => {
    const [r, y] = along(line, v), uu = u * 2 - 1, wide = half * Math.pow(Math.sin(Math.PI * (0.16 + 0.84 * v)), 0.8);
    // A thick rib down its middle, and edges that wrap in toward the egg, so it reads as a horn and not a sheet.
    const rr = r + 0.11 * Math.pow(1 - Math.abs(uu), 1.2) - 0.07 * uu * uu, a = turn + (uu * wide) / Math.max(0.5, r);
    // Dark at the root and in the hollows either side of the rib; the rib and the rim catch the light.
    return [Math.sin(a) * rr, y, Math.cos(a) * rr, -0.2 + v * 0.24 + 0.26 * Math.pow(Math.abs(uu), 4) + 0.36 * Math.pow(1 - Math.abs(uu), 5)];
  }, GOLD, { side: 0, backTone: lit ? GOLD_LIT : GOLD, skin: 'flat', key: 0.4, light: 0.12, mottle: 0.1, cavity: 0.3, glow: 0.035 * lit });
}

function cradle(s: Shape, variant: number): void {
  const b = new Blocks(), start = s.mark();
  // The carved base: two rings of wedge stones.
  riseRing(s, b, 1.5, 0, 0.17, 14, 1);
  paveRing(s, b, 1.27, 1.5, 0.17, 14);
  riseRing(s, b, 1.27, 0.17, 0.17, 10, 1, { phase: 0.5 });
  paveRing(s, b, 0.7, 1.27, 0.34, 10, { phase: 0.5 });
  b.draw(s, STONE, dressed());
  s.weather(start, { moss: 0.1, wear: 0.5 });
  // A leaf cut into every stone of the upper ring, filled with brass.
  for (let i = 0; i < 10; i++) s.at(0, 0, 0, ((i + 1) / 10) * TAU, () =>
    s.poly([[-0.1, 0.25, 1.295], [0, 0.31, 1.3], [0.1, 0.25, 1.295], [0, 0.2, 1.3]], GOLD[2], { toward: [0, 0, 1], skin: 'flat' }));
  // The brass collar the leaves grow from: a rolled rim, and the cup the egg stands in.
  grid(s, cut(s, 24), 7, (u, v) => {
    const [r, y, shift] = along([[0.86, 0.34, -0.3], [0.9, 0.39, 0.1], [0.86, 0.45, 0.35], [0.74, 0.47, -0.1], [0.66, 0.53, -0.25], [0.6, 0.62, 0.1], [0.5, 0.66, 0.3], [0.4, 0.62, -0.2]], v), a = u * TAU;
    return [Math.sin(a) * r, y, Math.cos(a) * r, shift - 0.28];
  }, GOLD, { skin: 'flat', key: 0.4, light: 0.1, mottle: 0.1, cavity: 0.2, glow: 0.035 * variant });
  // Six great leaves cup the egg's lower half and open outward, and six small ones curl out between them.
  for (let i = 0; i < 6; i++) {
    const turn = (i / 6) * TAU;
    brassLeaf(s, turn, [[0.6, 0.5], [0.95, 0.74], [1.09, 1.12], [1.1, 1.46], [1.2, 1.72], [1.4, 1.87]], 0.33, variant);
    brassLeaf(s, turn + TAU / 12, [[0.74, 0.44], [1.04, 0.56], [1.3, 0.74], [1.44, 0.66]], 0.2, variant);
  }
  s.shadowBox(0, 0, 0, 2.1, 0.5, 2.1);
  s.shadowBlob(0, 1.7, 0, 0.95, 1.4, 0.95);
}
export function heartstone(variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(8100, detail);
  cradle(s, variant);
  livingCore(s, variant);
  crystal(s, variant);
  return s.done();
}
/**
 * The Heartstone apart, from one origin at its foot: `cradle` (stone and brass), `core` (the light and its veins)
 * and `crystal` (the shell). Each is the part `heartstone` draws, so the three laid over each other with the
 * props material are the prop itself. A view that would rather blend the shell draws `core` first, then
 * `crystal` with both sides and no depth write.
 */
export function heartstoneParts(variant = 0, detail = 1) {
  const base = new Shape(8100, detail), core = new Shape(8102, detail), shell = new Shape(8101, detail);
  cradle(base, variant);
  livingCore(core, variant);
  crystal(shell, variant);
  return { cradle: base.done(), crystal: shell.done(), core: core.done() };
}

// ---------------------------------------------------------------- the court, its rill and bridges

/** The masonry of the hall: Hearth limestone in courses a block high, a little moss in its joints. */
const ASHLAR = { tone: STONE, course: 0.9, long: [1.3, 2.1] as [number, number], moss: 0.1, mossTone: SAGE };

export function hallCourt(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8110, detail), b = new Blocks(), start = s.mark();
  // Rings of wedge paving round the Heartstone, each ring's joints between the last one's, inside a kerb.
  paveRing(s, b, 0.05, 1.55, 0.4, 8, { flat: true });
  paveRing(s, b, 1.55, 2.6, 0.4, 14, { phase: 0.5 });
  paveRing(s, b, 2.6, 3.68, 0.4, 20);
  paveRing(s, b, 3.68, 4.76, 0.4, 26, { phase: 0.5 });
  paveRing(s, b, 4.76, 5.38, 0.4, 34, { vary: 0.12 });
  paveRing(s, b, 5.38, 5.65, 0.4, 22, { phase: 0.5, vary: 0.28 });
  riseRing(s, b, 5.65, 0, 0.4, 22, 1, { phase: 0.5 });
  b.draw(s, STONE, dressed());
  s.weather(start, { wear: 0.35 });
  // Moss has found a few of the joints.
  for (const [a, r] of [[0.4, 3.7], [1.9, 4.8], [2.7, 2.62], [3.6, 4.78], [4.5, 3.66], [5.4, 5.3], [5.9, 2.64]]) mossPad(s, Math.sin(a) * r, 0.405, Math.cos(a) * r, 0.5, 0.2);
  s.shadowBox(0, 0, 0, 10, 0.3, 10);
  return s.done();
}

// A quarter of the rill, centred on its own bounds. Stand it at (+3.535, +3.535) from the court's middle and
// turn the place and the piece together by quarter turns: the four meet end to end.
export function hallRill(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8120, detail), b = new Blocks(), q = Math.PI / 2, arc = { from: 0, to: q };
  // Shallow water over pale stone: lighter along its middle, darker under each kerb.
  grid(s, cut(s, 16), 3, (u, v) => {
    const a = u * q, r = 5.65 + v * 1.25;
    return [Math.sin(a) * r, 0.07, Math.cos(a) * r, 0.22 - 1.9 * (v - 0.5) * (v - 0.5) + 0.1 * Math.sin(a * 23 + v * 4)];
  }, WATER, { side: -1, skin: 'flat', light: 0, mottle: 0.3, cavity: 0 });
  // The kerbs either side of it.
  riseRing(s, b, 5.5, 0, 0.28, 6, -1, { ...arc, flat: true });
  paveRing(s, b, 5.5, 5.65, 0.28, 6, arc);
  riseRing(s, b, 5.65, 0.05, 0.23, 6, 1, arc);
  riseRing(s, b, 6.9, 0.05, 0.23, 6, -1, arc);
  paveRing(s, b, 6.9, 7.07, 0.28, 6, arc);
  riseRing(s, b, 7.07, 0, 0.28, 6, 1, arc);
  b.draw(s, STONE, dressed());
  // Lily pads, one in flower, and moss where the water wets the kerb.
  for (const [a, r, size, bloom] of [[0.34, 6.2, 0.2, 0], [0.52, 6.45, 0.15, 1], [1.12, 6.1, 0.18, 0]]) {
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    s.disc(x, 0.078, z, size, 7, SAGE[1], { turn: a * 5, skin: 'flat' });
    if (bloom) {
      s.cone(x, 0.08, z, 0.07, 0.07, 5, LILAC[2], { skin: 'flat' });
      s.disc(x, 0.152, z, 0.03, 4, 0xf7e09a, { skin: 'flat' });
    }
  }
  mossPad(s, Math.sin(0.8) * 7, 0.28, Math.cos(0.8) * 7, 0.5, 0.18);
  const g = s.done();
  g.translate(-3.535, 0, -3.535);
  return g;
}

/** How high the bridge's deck stands at z, from one end to the other: a low hump over both kerbs. */
const deckY = (z: number) => 0.04 + 0.3 * Math.sqrt(Math.max(0, Math.sin((Math.PI * (z + 1.2)) / 2.4)));

export function hallRillBridge(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8130, detail), b = new Blocks();
  // Six slabs follow the hump, each a shade of its own.
  const deck: Mapper = (z, x, off) => [x, deckY(z) + off, z, 0, 1, 0];
  for (let i = 0; i < 6; i++) b.block(deck, -1.2 + i * 0.4, -0.8 + i * 0.4, -0.8, 0.8, 0.035, 0.035, 0.015, 2, (s.r() - 0.5) * 0.4, s.detail < 0.75);
  for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
    const z0 = -1.2 + i * 0.2, z1 = z0 + 0.2;
    b.face([side * 0.8, 0, z0], [side * 0.8, 0, z1], [side * 0.8, deckY(z1), z1], [side * 0.8, deckY(z0), z0], [side, 0, 0], -0.1);
  }
  b.draw(s, STONE, dressed());
  // Brass rails: a post at each end and the middle, a rail over them and a lighter one below.
  for (const x of [-0.74, 0.74]) {
    for (const z of [-1.08, 0, 1.08]) {
      const y = deckY(z) - 0.02, tall = z === 0 ? 0.66 : 0.6;
      s.lathe(x, y, z, [[0.075, 0], [0.05, 0.07], [0.04, tall - 0.1], [0.07, tall - 0.05], [0.055, tall + 0.03], [0, tall + 0.09]], BRASS, { sides: 6, skin: 'flat', key: 0.4, cavity: 0.2, cap: false });
    }
    const rail = (lift: number): V3[] => [-1.08, -0.54, 0, 0.54, 1.08].map((z) => [x, deckY(z) + lift + (z === 0 ? 0.03 : 0), z]);
    s.sweep(rail(0.55), [0.045, 0.045, 0.045, 0.045, 0.045], BRASS, { sides: 6, steps: 2, skin: 'flat', key: 0.5, cavity: 0.1, cap: 'none' });
    s.tube(rail(0.28), [0.022, 0.022, 0.022, 0.022, 0.022], 4, BRASS[2], { skin: 'flat', cap: 'none' });
  }
  s.shadowBox(0, 0, 0, 1.6, 0.2, 2.4);
  return s.done();
}

// ---------------------------------------------------------------- arches

/** A flat surface for `Blocks`: where it starts, the way u and v run across it, and the way out. */
const plane = (o: V3, u: V3, v: V3, n: V3): Mapper => (a, c, off) => [o[0] + u[0] * a + v[0] * c + n[0] * off, o[1] + u[1] * a + v[1] * c + n[1] * off, o[2] + u[2] * a + v[2] * c + n[2] * off, n[0], n[1], n[2]];

interface ArchRing {
  /** How wide its stones are, from the opening out, and how deep it is from its face back. */
  ring: number;
  depth: number;
  /** How many voussoirs, the keystone in the middle. */
  n: number;
  /** Stones that have fallen, by number from the left. */
  gone?: (i: number) => boolean;
  /** Its back is seen too. */
  back?: boolean;
  flat?: boolean;
  /** Where its stones start and end, as angles from +x up over the crown. Default a half round, PI to 0. */
  from?: number;
  to?: number;
}

/** A round arch of voussoirs over an opening `span` wide that springs at `spring` above y, its face at z. */
function archRing(s: Shape, b: Blocks, x: number, y: number, z: number, span: number, spring: number, o: ArchRing): void {
  const r = span / 2, gap = 0.003, flat = o.flat || s.detail < 0.75, gone = (i: number) => i >= 0 && i < o.n && o.gone?.(i) === true;
  const from = o.from ?? Math.PI, step = ((o.to ?? 0) - from) / o.n;
  for (let i = 0; i < o.n; i++) {
    if (gone(i)) continue;
    const a = from + i * step - gap, c = from + (i + 1) * step + gap, keystone = i === (o.n - 1) / 2;
    const out = r + o.ring + (keystone ? 0.1 : 0) + (i % 2 ? 0.03 : 0), proud = keystone ? 0.04 : 0, shift = (s.r() - 0.5) * 0.44;
    const pt = (t: number, rad: number, dz: number): V3 => [x + Math.cos(t) * rad, y + spring + Math.sin(t) * rad, z + dz];
    const cu = 0.06 / ((r + o.ring / 2) * (a - c));
    b.block((u, v, off) => [...pt(a + (c - a) * u, r + v, off + proud), 0, 0, 1], 0, 1, 0, out - r, cu, 0.06, 0.04, 1, shift, flat);
    if (o.back) b.block((u, v, off) => [...pt(a + (c - a) * u, r + v, -o.depth - off), 0, 0, -1], 0, 1, 0, out - r, cu, 0.06, 0.04, 1, shift, true);
    const m = (a + c) / 2;
    b.face(pt(a, r, proud), pt(c, r, proud), pt(c, r, -o.depth), pt(a, r, -o.depth), [-Math.cos(m), -Math.sin(m), 0], shift - 0.14);
    b.face(pt(a, out, proud), pt(c, out, proud), pt(c, out, -o.depth), pt(a, out, -o.depth), [Math.cos(m), Math.sin(m), 0], shift);
    // The broken end of a stone whose neighbour has fallen.
    if (gone(i - 1)) b.face(pt(a, r, proud), pt(a, out, proud), pt(a, out, -o.depth), pt(a, r, -o.depth), [-Math.sin(a), Math.cos(a), 0], shift - 0.1);
    if (gone(i + 1)) b.face(pt(c, r, proud), pt(c, out, proud), pt(c, out, -o.depth), pt(c, r, -o.depth), [Math.sin(c), -Math.cos(c), 0], shift - 0.1);
  }
}

/** A dressed block that has fallen and lies askew. */
function fallen(s: Shape, x: number, z: number, w: number, h: number, d: number, turn: number, tip = 0): void {
  s.at(x, 0, z, { ry: turn, rz: tip }, () => arch.stoneBlock(s, 0, tip ? -0.05 : 0, 0, w, h, d, { tone: STONE, faces: '+z-z+x-x+y', chip: 1, moss: 0.25, mossTone: SAGE }));
}

// One arch of the arcade that still stands: 6 wide and 9 high in the clear, 10 to its crown. Its back is drawn,
// plainer, for the times the camera turns.
export function hallArch(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8140, detail), b = new Blocks(), start = s.mark();
  for (const side of [-1, 1]) {
    arch.stoneBlock(s, side * 3.6, 0, 0, 1.5, 0.55, 1.5, { ...ASHLAR, faces: '+z-z+x-x+y' });
    arch.ashlar(s, side * 3.6, 0.55, 0, 1.2, 5.2, 1.2, { ...ASHLAR, faces: '+z-z+x-x', long: [1.2, 1.2] });
    arch.stoneBlock(s, side * 3.6, 5.75, 0, 1.5, 0.35, 1.5, { ...ASHLAR, faces: '+z-z+x-x+y' });
  }
  archRing(s, b, 0, 0, 0.6, 6, 6.1, { ring: 0.9, depth: 1.2, n: 17, back: true });
  b.draw(s, STONE, dressed(0.1));
  // What is left of the wall it carried: three courses over the west haunch, one over the east.
  const haunch = (side: number, y0: number) => {
    const inner = Math.sqrt(Math.max(0, 3.9 * 3.9 - (y0 - 6.1) * (y0 - 6.1))), w = 4.2 - inner;
    arch.ashlar(s, side * (inner + w / 2), y0, 0, w, 0.9, 1.1, { ...ASHLAR, faces: '+z-z+x-x+y', long: [0.9, 1.4], moss: 0.16 });
  };
  for (const y0 of [6.1, 7, 7.9, 8.8]) haunch(-1, y0);
  for (const y0 of [6.1, 7, 7.9]) haunch(1, y0);
  s.weather(start, { moss: 0.5, wear: 0.4 });
  // Ivy over the standing haunch and down both piers, flowers at their feet, and the stones that came down.
  ivyMass(s, -3.3, 9.6, 0.1, 2, 0.55, 1.3);
  ivyStrand(s, -3.9, 9.7, 0.62, 3.4);
  ivyStrand(s, -3.2, 9.6, 0.64, 2.2);
  ivyStrand(s, -2.3, 9.5, 0.68, 1.5, [0, 0.35, 1], true);
  ivyStrand(s, -4.22, 8.4, 0.2, 2.6, [-1, 0.35, 0.3]);
  ivyMass(s, 3.7, 8.75, 0.15, 1.3, 0.4, 1.2);
  ivyStrand(s, 3.95, 8.8, 0.62, 2.8);
  ivyStrand(s, 3.3, 8.7, 0.64, 1.6, [0, 0.35, 1], true);
  ivyStrand(s, 3.45, 6.1, 0.78, 2.4);
  flowers(s, -4.1, 0, 1.0, 5);
  flowers(s, 3.2, 0, 1.05, 4, 0.3);
  fallen(s, 2.35, 0.85, 0.9, 0.48, 0.66, 0.5);
  fallen(s, 1.75, 1.45, 0.62, 0.4, 0.5, -0.7, 0.2);
  for (const side of [-1, 1]) s.shadowBox(side * 3.6, 0, 0, 1.3, 9, 1.2);
  s.shadowBox(0, 8.6, 0, 6, 1.2, 1.1);
  return s.done();
}

// ---------------------------------------------------------------- the north mural and the memory stone

/** The mural's niches: eight, 2.1 apart, each 1.5 wide, from the plinth's top up to an arch that springs at 3.45. */
const NICHE = { count: 8, pitch: 2.1, r: 0.75, foot: 1, spring: 3.45, deep: 0.5 };

/**
 * One of the mural's seven figures, standing at (x, y, z) and facing +z: a robe in folds, sleeves to hands held
 * before it, a hood or hair round a face, and what it carries. Each differs by its number.
 */
function figure(s: Shape, x: number, y: number, z: number, i: number): void {
  const look: MeshOptions = { skin: 'limestone', light: 0.3, key: 0.4, mottle: 0.12, cavity: 0.35 };
  s.at(x, y, z, { scale: 1.14 }, () => {
    const tall = 1.6 + (i % 3) * 0.05;
    grid(s, cut(s, 10), cut(s, 6), (u, v) => {
      const a = (u - 0.5) * 3.7, [rx] = along([[0.42], [0.36], [0.31], [0.27], [0.3], [0.35], [0.15]], v);
      const fold = Math.cos(a * 4.5 + i * 1.7) * Math.pow(1 - v, 1.5), r = rx * (1 + 0.13 * fold);
      return [Math.sin(a) * r, v * tall, Math.cos(a) * r * 0.62, 0.3 * fold + 0.14 * (v - 0.5)];
    }, STONE, look);
    for (const side of [-1, 1]) s.tube([[side * 0.2, tall - 0.1, 0.02], [side * 0.34, tall - 0.3, 0.08], [side * 0.36, tall - 0.52, 0.17], [side * 0.08, tall - 0.42, 0.3]], [0.09, 0.11, 0.1, 0.08], 5, [STONE[1], STONE[2], STONE[3]], { skin: 'limestone' });
    s.blob(0, tall - 0.42, 0.32, 0.12, 0.075, 0.07, STONE[3], { sides: 5, rings: 2, jitter: 0.05, noise: 0.1, skin: 'limestone' });
    // The head, and a hood or hair behind it that leaves the face clear.
    const neck = tall - 0.04;
    s.lathe(0, neck, 0.04, [[0.085, 0], [0.14, 0.1], [0.155, 0.22], [0.12, 0.33], [0.04, 0.39], [0, 0.4]], STONE, { ...look, sides: 8, light: 0.2 });
    if (i % 2 === 0) s.lathe(0, neck - 0.08, -0.07, [[0.2, 0], [0.22, 0.18], [0.2, 0.38], [0.12, 0.5], [0, 0.54]], [STONE[0], STONE[1], STONE[2]], { ...look, sides: 8 });
    else s.lathe(0, neck + 0.1, -0.035, [[0.165, 0], [0.175, 0.15], [0.12, 0.27], [0, 0.31]], [STONE[0], STONE[1], STONE[2]], { ...look, sides: 8 });
    s.box(0, neck + 0.235, 0.172, 0.17, 0.028, 0.05, STONE[2], { skin: 'limestone' });
    s.box(0, neck + 0.14, 0.186, 0.04, 0.1, 0.04, STONE[3], { skin: 'limestone' });
    for (const side of [-1, 1]) s.poly([[side * 0.035, neck + 0.23, 0.199], [side * 0.085, neck + 0.23, 0.19], [side * 0.08, neck + 0.208, 0.192], [side * 0.04, neck + 0.208, 0.2]], STONE[0], { toward: [0, 0, 1], skin: 'flat' });
    s.poly([[-0.035, neck + 0.103, 0.19], [0.035, neck + 0.103, 0.19], [0.03, neck + 0.09, 0.19], [-0.03, neck + 0.09, 0.19]], STONE[0], { toward: [0, 0, 1], skin: 'flat' });
    // What each one carries: a book, a staff, a bowl, a leaf.
    const kind = i % 4, held = tall - 0.44;
    if (kind === 0) s.box(0, held - 0.12, 0.38, 0.27, 0.3, 0.07, STONE[3], { bevel: 0.02, skin: 'limestone' });
    else if (kind === 1) {
      s.tube([[0.2, 0.04, 0.36], [0.2, tall + 0.3, 0.3]], [0.035, 0.03], 5, STONE[2], { skin: 'limestone' });
      s.blob(0.2, tall + 0.36, 0.3, 0.075, 0.075, 0.06, STONE[3], { sides: 5, rings: 2, jitter: 0.05, skin: 'limestone' });
    } else if (kind === 2) s.lathe(0, held - 0.02, 0.38, [[0.07, 0], [0.16, 0.08], [0.18, 0.13], [0.13, 0.11]], STONE, { ...look, sides: 6, cap: false });
    else s.poly([[0, held - 0.1, 0.4], [-0.13, held + 0.12, 0.41], [0, held + 0.42, 0.37], [0.13, held + 0.12, 0.41]], STONE[3], { two: true, toward: [0, 0.2, 1], skin: 'limestone' });
  });
}

export function hallMural(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8150, detail), b = new Blocks(), start = s.mark();
  const { count, pitch, r, foot, spring, deep } = NICHE, wide = count * pitch, x0 = -wide / 2, crown = spring + r + 0.24;
  // The plinth the figures stand on, the frieze over their niches and its cornice.
  arch.ashlar(s, 0, 0, -0.25, wide + 0.6, foot, 1.4, { ...ASHLAR, faces: '+z+x-x+y', course: 0.5, long: [1.4, 2.2], moss: 0.03 });
  arch.ashlar(s, 0, crown, -0.45, wide + 0.6, 5.2 - crown, 1, { ...ASHLAR, faces: '+z+x-x', course: 0.78, long: [1.6, 2.6], moss: 0.06 });
  s.roundBox(0, 5.2, -0.36, wide + 0.9, 0.3, 1.25, STONE, { round: 0.08, skin: 'stone', key: 0.3, moss: 0.03, mossTone: SAGE });
  const front = plane([0, 0, 0.12], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  for (let i = 0; i <= count; i++) {
    // A pilaster between each pair of niches, in three stones under a capital, with the niche's reveals on its sides.
    // The last one was broken off with the eighth figure: one stone of it is left.
    const px = x0 + i * pitch, left = px - 0.3, right = px + 0.3, stub = i === count;
    const cuts = [foot, foot + 0.78, foot + 1.55, spring - 0.2], top = stub ? cuts[1] : spring;
    for (let k = 0; k < (stub ? 1 : 3); k++) b.block(front, left, right, cuts[k], cuts[k + 1], 0.045, 0.045, 0.03, 1, (s.r() - 0.5) * 0.4, s.detail < 0.75);
    for (const [sx, n] of [[left, -1], [right, 1]] as const) {
      const back = (i === 0 && n < 0) || (stub && n > 0) ? -0.95 : -deep - 0.05;
      b.face([sx, foot, 0.12], [sx, foot, back], [sx, top, back], [sx, top, 0.12], [n, 0, 0], -0.22);
    }
    if (stub) b.face([left, top, 0.12], [right, top, 0.12], [right, top, -0.5], [left, top, -0.5], [0, 1, 0], 0.1);
    else s.box(px, spring - 0.2, -0.16, 0.72, 0.2, 0.68, STONE[3], { bevel: 0.03, skin: 'limestone', skip: '-y-z' });
  }
  const wall = plane([0, 0, 0.02], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  for (let i = 0; i < count - 1; i++) {
    const cx = x0 + (i + 0.5) * pitch;
    // The niche: a hollow that rounds over at its head, in the lavender shade.
    grid(s, cut(s, 5), cut(s, 5), (u, v) => {
      const y = v < 0.6 ? foot + (v / 0.6) * (spring - foot) : spring + Math.sin(((v - 0.6) / 0.4) * (Math.PI / 2)) * r * 0.99;
      const half = v < 0.6 ? r : Math.sqrt(Math.max(0.0004, r * r - (y - spring) * (y - spring))), uu = u * 2 - 1;
      return [cx + uu * half, y, -deep - 0.34 * Math.cos((uu * Math.PI) / 2) * (half / r), -0.05 - 0.3 * Math.abs(uu) - (v > 0.6 ? (v - 0.6) * 0.9 : 0)];
    }, SHADE, { skin: 'limestone', light: 0, key: 0.25, mottle: 0.22, cavity: 0.15 });
    // Its arch, and the wall between one arch and the next up to the frieze.
    archRing(s, b, cx, foot, 0.1, r * 2, spring - foot, { ring: 0.24, depth: deep + 0.15, n: 7, flat: true });
    for (const side of [-1, 1]) {
      const R = r + 0.22, corner = b.add(wall(cx + side * pitch * 0.5, crown, 0)), base = b.add(wall(cx + side * pitch * 0.5, spring, 0));
      let last = b.add(wall(cx + side * R, spring, 0));
      b.tri(corner, base, last);
      for (let k = 1; k <= 5; k++) {
        const t = (k * Math.PI) / 10, next = b.add(wall(cx + side * Math.cos(t) * R, spring + Math.sin(t) * R, 0));
        b.tri(corner, last, next);
        last = next;
      }
      b.tri(corner, last, b.add(wall(cx, crown, 0)));
    }
    figure(s, cx, foot, -deep + 0.02, i);
  }
  // The eighth bay, where a figure was cut out on purpose: a ragged hole through the wall's face from the plinth
  // up, the cut's own edge, and the rough stone left behind it.
  const gap = x0 + (count - 0.5) * pitch, bay0 = gap - pitch / 2, bay1 = wide / 2 + 0.3;
  const hole: [number, number][] = [[-0.42, foot], [-0.62, 1.55], [-0.36, 2.1], [-0.66, 2.7], [-0.44, 3.2], [-0.2, 3.36], [0.02, 3.86], [0.3, 3.5], [0.52, 3.74], [0.74, 3.2], [0.5, 2.8], [0.8, 2.3], [0.52, 1.8], [0.74, 1.4], [0.58, foot]];
  const rim = (i: number): V3 => (i <= 5 ? [bay0, foot + ((crown - foot) * i) / 5, 0.02] : i <= 9 ? [bay0 + ((bay1 - bay0) * (i - 5)) / 4, crown, 0.02] : [bay1, crown - ((crown - foot) * (i - 9)) / 5, 0.02]);
  for (let i = 0; i < hole.length - 1; i++) {
    const h0: V3 = [gap + hole[i][0], hole[i][1], 0.02], h1: V3 = [gap + hole[i + 1][0], hole[i + 1][1], 0.02], shade = (s.r() - 0.5) * 0.4;
    b.face(h0, h1, rim(i + 1), rim(i), [0, 0, 1], shade);
    const nx = -(h1[1] - h0[1]), ny = h1[0] - h0[0];
    b.face(h0, h1, [h1[0], h1[1], -0.55], [h0[0], h0[1], -0.55], [nx, ny, 0.3], shade - 0.3);
  }
  grid(s, cut(s, 5), cut(s, 5), (u, v) => {
    const pit = 0.12 * Math.abs(Math.sin(u * 11 + v * 7) * Math.sin(v * 9 + u * 3));
    return [gap - 0.8 + u * 1.75, foot + v * (crown - foot - 0.4), -0.5 - pit, -0.3 + 0.25 * Math.sin(u * 9 + v * 5)];
  }, [0x5f5668, 0x7f7690, 0x9c91a7], { skin: 'rock', light: 0, key: 0.3, mottle: 0.4, cavity: 0.2 });
  b.draw(s, STONE, dressed(0.06));
  s.rock(gap - 0.2, foot, -0.2, 0.62, 0.34, 0.5, STONE, { level: 1, shadow: false, skin: 'limestone', planes: 6, reach: 0.6 });
  s.rock(gap + 0.45, foot, 0.08, 0.44, 0.25, 0.36, STONE, { level: 1, shadow: false, skin: 'limestone', planes: 6, reach: 0.6 });
  fallen(s, gap + 0.55, 0.95, 0.6, 0.3, 0.45, 0.6);
  // The gable over the middle, with the leaf of the Gardeners in brass.
  const g = new Blocks(), apex = 6.7, eave = 5.5, reach = 2.3;
  g.tri(g.add([-reach, eave, 0.2, 0, 0, 1]), g.add([reach, eave, 0.2, 0, 0, 1]), g.add([0, apex, 0.2, 0, 0, 1]));
  for (const side of [-1, 1]) g.face([side * reach, eave, 0.2], [0, apex, 0.2], [0, apex, -0.7], [side * reach, eave, -0.7], [side * 0.46, 0.89, 0], side * 0.1);
  g.draw(s, STONE, { ...dressed(0.02, 'stone'), crease: 0.3 });
  for (const side of [-1, 1]) s.at(side * reach * 0.5, (eave + apex) / 2, 0.24, { rz: -side * Math.atan2(apex - eave, reach) }, () =>
    s.box(0, -0.02, 0, Math.hypot(reach, apex - eave) + 0.2, 0.16, 0.12, STONE[3], { bevel: 0.03, skin: 'limestone' }));
  for (const [turn, size] of [[0, 1.2], [0.8, 0.8], [-0.8, 0.8]]) s.at(0, 5.56, 0.25, { rz: turn }, () =>
    grid(s, 2, 3, (u, v) => {
      const w = 0.24 * size * Math.sin(Math.PI * (0.08 + 0.92 * v)), uu = u * 2 - 1;
      return [uu * w, v * 0.82 * size, 0.05 * (1 - Math.abs(uu)), -0.15 + 0.4 * (1 - Math.abs(uu)) + v * 0.1];
    }, BRASS, { skin: 'flat', key: 0.4, light: 0.1, mottle: 0.1, cavity: 0.1 }));
  s.weather(start, { moss: 0.35, wear: 0.4 });
  // Ivy over both ends and down into the cut niche, flowers along its foot, moss on the cornice.
  ivyMass(s, -wide / 2 - 0.1, 5.35, -0.1, 1.9, 0.55, 1.2);
  ivyStrand(s, -wide / 2 - 0.25, 5.4, 0.28, 2.6);
  ivyStrand(s, -wide / 2 + 0.5, 5.3, 0.3, 1.5);
  ivyMass(s, wide / 2 - 0.5, 5.35, -0.1, 2.4, 0.6, 1.2);
  ivyStrand(s, wide / 2 + 0.2, 5.4, 0.28, 3.1);
  ivyStrand(s, wide / 2 - 0.6, 5.3, 0.3, 1.9);
  ivyStrand(s, wide / 2 - 1.5, 5.25, 0.3, 1.2);
  mossPad(s, -3.4, 5.5, 0, 1.1, 0.5);
  mossPad(s, 4.6, 5.5, 0.05, 0.8, 0.4);
  flowers(s, -wide / 2 - 0.1, 0, 0.75, 5);
  flowers(s, -2.6, 0, 0.72, 4, 0.3);
  flowers(s, wide / 2 - 0.2, 0, 0.8, 6, 0.42);
  s.shadowBox(0, 0, -0.45, wide + 0.6, 5.5, 1.1);
  return s.done();
}

// The stone under the mural that records what remains: lines of writing either side of the Gardeners' leaf.
export function memoryStone(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8151, detail), b = new Blocks(), start = s.mark();
  arch.ashlar(s, 0, 0, 0, 3, 0.3, 1, { ...ASHLAR, faces: '+z+x-x-z+y', course: 0.3, long: [0.9, 1.3] });
  // The slab leans its written face up toward whoever reads it.
  const lo: V3[] = [[-1.38, 0.3, 0.44], [1.38, 0.3, 0.44], [1.38, 0.3, -0.44], [-1.38, 0.3, -0.44]];
  const hi: V3[] = [[-1.32, 0.78, 0.36], [1.32, 0.78, 0.36], [1.32, 1, -0.38], [-1.32, 1, -0.38]];
  b.face(hi[0], hi[1], hi[2], hi[3], [0, 0.96, 0.28], 0.25);
  b.face(lo[0], lo[1], hi[1], hi[0], [0, 0.15, 1], 0);
  b.face(lo[1], lo[2], hi[2], hi[1], [1, 0.1, 0], -0.1);
  b.face(lo[3], lo[0], hi[0], hi[3], [-1, 0.1, 0], -0.1);
  b.face(lo[2], lo[3], hi[3], hi[2], [0, 0.1, -1], -0.2);
  b.draw(s, STONE, { ...dressed(0, 'stone'), crease: 0.3 });
  s.weather(start, { moss: 0.3, wear: 0.6 });
  // On the leaning face, x runs across and t runs up it.
  const on = (x: number, t: number, lift = 0.012): V3 => [x, 0.78 + 0.22 * t + lift * 0.96, 0.36 - 0.74 * t + lift * 0.28];
  for (const side of [-1, 1]) for (let row = 0; row < 3; row++) {
    const t = 0.24 + row * 0.24, from = 0.34 + (row % 2) * 0.08, to = 1.16 - ((row + 1) % 2) * 0.14;
    for (let x = from; x < to - 0.05; x += 0.21) s.poly([on(side * x, t), on(side * (x + 0.15), t), on(side * (x + 0.15), t + 0.07), on(side * x, t + 0.07)], SHADE[0], { toward: [0, 1, 0.3], skin: 'flat' });
  }
  s.poly([on(0, 0.12, 0.02), on(-0.17, 0.42, 0.02), on(0, 0.9, 0.02), on(0.17, 0.42, 0.02)], BRASS[3], { toward: [0, 1, 0.3], skin: 'flat' });
  s.poly([on(-0.012, 0.16, 0.026), on(0.012, 0.16, 0.026), on(0.012, 0.82, 0.026), on(-0.012, 0.82, 0.026)], BRASS[1], { toward: [0, 1, 0.3], skin: 'flat' });
  for (const x of [-1.2, 1.2]) s.disc(x, 0.79, 0.3, 0.05, 6, BRASS[3], { skin: 'flat' });
  mossPad(s, -1.25, 0.3, 0.47, 0.5, 0.14);
  s.shadowBox(0, 0, 0, 3, 0.9, 1);
  return s.done();
}

// ---------------------------------------------------------------- the lamps

/** A lantern's four panes between y0 and y1, wider at the top: lit amber from a hot foot, or dormant. */
function panes(s: Shape, y0: number, y1: number, w0: number, w1: number, lit: boolean, skip: (side: number) => boolean = () => false): void {
  for (let side = 0; side < 4; side++) {
    if (skip(side)) continue;
    s.at(0, 0, 0, (side * Math.PI) / 2, () => {
      grid(s, 1, 3, (u, v) => {
        const w = w0 + (w1 - w0) * v;
        return [(u - 0.5) * 2 * w, y0 + (y1 - y0) * v, w, lit ? 0.5 - v * 0.9 : 0.25 - Math.abs(u + v - 1) * 0.6];
      }, lit ? AMBER : DORMANT, { skin: 'flat', light: 0, mottle: lit ? 0 : 0.1, cavity: 0, glow: lit ? 2 : 0 });
    });
  }
}

// The lamps round the court: a stone foot with a band of teal enamel, a brass lantern on it. The dark and the lit
// keep their old numbers; the broken one has lost its glass and its roof lies beside it.
export function hallLamp(v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8160 + (v === 2 ? 1 : 0), detail), lit = v === 1, broken = v === 2, start = s.mark();
  const block = { ...ASHLAR, faces: '+z-z+x-x+y', moss: broken ? 0.3 : 0.08, chip: broken ? 0.8 : 0.25 };
  arch.stoneBlock(s, 0, 0, 0, 0.86, 0.24, 0.86, block);
  arch.stoneBlock(s, 0, 0.24, 0, 0.6, 0.22, 0.6, { ...block, faces: '+z-z+x-x' });
  s.box(0, 0.46, 0, 0.64, 0.16, 0.64, TEAL[1], { bevel: 0.025, top: TEAL[2], skin: 'flat', skip: '-y+y' });
  for (const y of [0.45, 0.61]) s.box(0, y, 0, 0.67, 0.022, 0.67, BRASS[3], { skin: 'flat', skip: '-y' });
  arch.stoneBlock(s, 0, 0.632, 0, 0.6, 0.1, 0.6, { ...block, faces: '+z-z+x-x' });
  arch.stoneBlock(s, 0, 0.73, 0, 0.76, 0.09, 0.76, block);
  s.weather(start, { moss: broken ? 0.5 : 0.2, wear: 0.5 });
  const y = 0.82;
  s.box(0, y, 0, 0.5, 0.05, 0.5, BRASS[2], { bevel: 0.015, skin: 'flat', skip: '-y' });
  const roof = () => {
    s.lathe(0, 0, 0, [[0.36, 0], [0.37, 0.035], [0.2, 0.12], [0.1, 0.24], [0.05, 0.3]], [BRASS[1], BRASS[2], BRASS[3], BRASS[4]], { sides: 4, turn: Math.PI / 4, skin: 'flat', key: 0.4, light: 0.15, cavity: 0.15, capTone: BRASS[0] });
    s.blob(0, 0.34, 0, 0.055, 0.06, 0.055, BRASS[4], { sides: 5, rings: 2, jitter: 0, noise: 0.1, skin: 'flat' });
  };
  if (!broken) {
    panes(s, y + 0.05, y + 0.6, 0.17, 0.21, lit);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.tube([[sx * 0.185, y + 0.05, sz * 0.185], [sx * 0.225, y + 0.6, sz * 0.225]], [0.022, 0.022], 4, BRASS[2], { skin: 'flat', cap: 'none' });
    for (let side = 0; side < 4; side++) s.at(0, 0, 0, (side * Math.PI) / 2, () => s.box(0, y + 0.31, 0.205, 0.4, 0.022, 0.02, BRASS[2], { skin: 'flat' }));
    s.at(0, y + 0.6, 0, 0, roof);
    if (lit) s.light(0, y + 0.3, 0);
    // Flowers have come up at its foot.
    flowers(s, 0.46, 0, 0.5, 3, 0.24);
  } else {
    // Two bent posts, a shard of glass and the roof on the ground beside it.
    s.tube([[-0.185, y + 0.05, 0.185], [-0.25, y + 0.5, 0.26]], [0.022, 0.022], 4, BRASS[1], { skin: 'flat' });
    s.tube([[0.185, y + 0.05, -0.185], [0.2, y + 0.3, -0.3], [0.34, y + 0.42, -0.36]], [0.022, 0.022, 0.02], 4, BRASS[1], { skin: 'flat' });
    s.poly([[-0.17, y + 0.05, 0.19], [0.02, y + 0.05, 0.19], [-0.06, y + 0.3, 0.2], [-0.19, y + 0.36, 0.21]], DORMANT[1], { two: true, skin: 'flat' });
    s.at(0.66, 0.34, 0.3, { rz: -1.25, ry: 0.5 }, roof);
    mossPad(s, 0.1, 0.82, -0.05, 0.4, 0.3);
  }
  s.shadowBox(0, 0, 0, 0.7, broken ? 0.9 : 1.6, 0.7);
  return s.done();
}

// ---------------------------------------------------------------- the Custodian's plinth and the field book

// The Custodian sleeps on this: its top is 0.69 up. A teal cloth lies over its middle and falls down its front.
export function custodianPlinth(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8170, detail), start = s.mark();
  arch.ashlar(s, 0, 0, 0, 4, 0.2, 2, { ...ASHLAR, faces: '+z+x-x-z+y', course: 0.2, long: [1, 1.5] });
  arch.ashlar(s, 0, 0.2, 0, 3.8, 0.34, 1.8, { ...ASHLAR, faces: '+z+x-x-z', course: 0.34, long: [1.1, 1.7] });
  s.roundBox(0, 0.54, 0, 3.96, 0.13, 1.96, STONE, { round: 0.05, skin: 'stone', key: 0.3 });
  s.weather(start, { moss: 0.3, wear: 0.5 });
  // The cloth lies across its middle and hangs down the front and the back in folds, a brass band along each edge.
  const cloth = (u: number, v: number): number[] => {
    const x = (u - 0.5) * 2.1, wave = Math.sin(u * TAU * 3.5 + 0.8);
    const hang = (drop: number, sign: number) => [x * (1 + 0.04 * drop), 0.685 - drop * (0.4 + 0.07 * Math.cos((u - 0.5) * Math.PI)), sign * (1.0 + (0.05 + 0.06 * wave) * drop), 0.3 * wave * drop - 0.12 * drop];
    if (v < 0.22) return hang(1 - v / 0.22, -1);
    if (v > 0.78) return hang((v - 0.78) / 0.22, 1);
    return [x, 0.685 + 0.008 * wave, -1 + ((v - 0.22) / 0.56) * 2, 0.12 + 0.06 * wave];
  };
  const nu = cut(s, 16), nv = cut(s, 9), points: number[] = [], hints: number[] = [], shifts: number[] = [], body: number[] = [], trim: number[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = cloth(i / nu, j / nv);
    points.push(p[0], p[1], p[2]);
    hints.push(0, 1, Math.sign(p[2]) * (p[1] < 0.68 ? 2 : 0));
    shifts.push(p[3]);
    if (i < nu && j < nv) {
      const q = j * (nu + 1) + i;
      (i === 0 || i === nu - 1 ? trim : body).push(q, q + 1, q + nu + 2, q, q + nu + 2, q + nu + 1);
    }
  }
  const drape: MeshOptions = { hints, shifts, skin: 'flat', light: 0.25, key: 0.3, mottle: 0.12, cavity: 0.1 };
  s.mesh(points, body, CLOTH, drape);
  s.mesh(points, trim, [BRASS[2], BRASS[3], BRASS[4]], drape);
  s.poly([[0, 0.7, -0.42], [-0.2, 0.7, -0.05], [0, 0.7, 0.5], [0.2, 0.7, -0.05]], BRASS[3], { toward: [0, 1, 0], skin: 'flat' });
  flowers(s, -1.75, 0, 1.2, 4, 0.3);
  mossPad(s, 1.6, 0.2, 0.96, 0.6, 0.16);
  s.shadowBox(0, 0, 0, 4, 0.65, 2);
  return s.done();
}

// The field book, open on a low stand of honey wood.
export function fieldBookStand(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8180, detail);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.at(sx * 0.33, 0, sz * 0.24, { rz: -sx * 0.1, rx: sz * 0.1 }, () => s.box(0, 0, 0, 0.075, 0.66, 0.075, HONEY[1], { skin: 'grain', skip: '-y+y' }));
  for (const sz of [-1, 1]) s.box(0, 0.3, sz * 0.25, 0.7, 0.07, 0.05, HONEY[0], { skin: 'grain', skip: '-y' });
  s.at(0, 0.66, 0, { rx: 0.26 }, () => {
    s.box(0, 0, 0, 0.98, 0.06, 0.74, HONEY[2], { bevel: 0.02, top: HONEY[3], skin: 'grain', skip: '-y' });
    s.box(0, 0.06, 0.34, 0.9, 0.05, 0.05, HONEY[1], { skin: 'grain', skip: '-y' });
    // The book: a leather cover, and two leaves of pages that rise from the spine and fall to their edges.
    s.box(0, 0.06, -0.02, 0.84, 0.025, 0.58, 0x65453a, { skin: 'flat', skip: '-y' });
    for (const side of [-1, 1]) {
      grid(s, cut(s, 4), 1, (u, v) => [side * (0.01 + u * 0.38), 0.09 + 0.045 * Math.sin(Math.PI * Math.min(1, u * 1.15)) - u * 0.01, -0.28 + v * 0.52, 0.25 - u * 0.3], LINEN, { side: side > 0 ? -1 : 1, skin: 'flat', light: 0.1, mottle: 0.05, cavity: 0 });
      for (let row = 0; row < 4; row++) {
        const z = -0.2 + row * 0.11, lift = (x: number) => 0.094 + 0.045 * Math.sin(Math.PI * Math.min(1, (x / 0.38) * 1.15));
        s.poly([[side * 0.07, lift(0.07), z], [side * 0.31, lift(0.31) - 0.004, z], [side * 0.31, lift(0.31) - 0.004, z + 0.035], [side * 0.07, lift(0.07), z + 0.035]], 0x815940, { toward: [0, 1, 0], skin: 'flat' });
      }
    }
    s.poly([[-0.02, 0.1, -0.26], [0.02, 0.1, -0.26], [0.03, 0.07, 0.36], [-0.01, 0.07, 0.36]], TEAL[1], { toward: [0, 1, 0.2], skin: 'flat' });
    s.poly([[0.2, 0.14, 0.14], [0.13, 0.142, 0.05], [0.2, 0.144, -0.1], [0.27, 0.142, 0.05]], SAGE[1], { toward: [0, 1, 0], skin: 'flat' });
  });
  s.shadowBox(0, 0, 0, 0.8, 0.85, 0.7);
  return s.done();
}

// ---------------------------------------------------------------- the dead Gate

/** A flat ring on a face that looks toward +z: from angle a0 to a1 round (cx, cy), between two radii. */
function band(s: Shape, cx: number, cy: number, z: number, r0: number, r1: number, a0: number, a1: number, n: number, tone: Tone): void {
  grid(s, cut(s, n), 1, (u, v) => {
    const a = a0 + (a1 - a0) * u, r = r0 + (r1 - r0) * v;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z, 0.25 * Math.sin(a * 5) + (v - 0.5) * 0.3];
  }, tone, { side: a1 > a0 ? -1 : 1, skin: 'flat', light: 0, key: 0.3, mottle: 0.15, cavity: 0 });
}

// The Gate in the west wall: an opening 4 wide and 3 high under a round arch, its rings of brass inlay dull and its
// three eyes dormant. Roots have climbed it. Nothing on it glows.
export function deadGate(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8190, detail), b = new Blocks(), start = s.mark();
  for (const side of [-1, 1]) {
    arch.stoneBlock(s, side * 2.52, 0, 0, 1.16, 0.3, 1.4, { ...ASHLAR, faces: '+z-z+x-x+y' });
    arch.ashlar(s, side * 2.5, 0.3, 0, 1, 0.7, 1.2, { ...ASHLAR, faces: '+z-z+x-x', course: 0.7, long: [1, 1] });
  }
  archRing(s, b, 0, 0, 0.6, 4, 1, { ring: 0.72, depth: 1.2, n: 13, back: true });
  b.draw(s, STONE, dressed(0.12));
  // What is left of the wall it stood in: courses up both shoulders and one over the crown, broken off to the north.
  const shoulder = (side: number, y0: number) => {
    const inner = Math.sqrt(Math.max(0, 2.72 * 2.72 - (y0 - 1) * (y0 - 1))), w = 3.1 - inner;
    arch.ashlar(s, side * (inner + w / 2), y0, 0, w, 0.7, 1.1, { ...ASHLAR, faces: '+z-z+x-x+y', course: 0.7, long: [0.8, 1.3], moss: 0.18 });
  };
  for (const y0 of [1, 1.7, 2.4, 3.1]) shoulder(-1, y0);
  for (const y0 of [1, 1.7, 2.4]) shoulder(1, y0);
  arch.ashlar(s, -0.9, 3.8, 0, 4.4, 0.6, 1.1, { ...ASHLAR, faces: '+z-z+x-x+y', course: 0.6, long: [1, 1.6], moss: 0.2 });
  s.weather(start, { moss: 0.45, wear: 0.4 });
  // The inlay: one ring round the opening's edge, a broader one through the middle of the stones, and both run down the jambs.
  const face = 0.66, old = [BRASS[0], BRASS[1], BRASS[2], BRASS[3]];
  band(s, 0, 1, face, 2.05, 2.11, 0, Math.PI, 20, old);
  band(s, 0, 1, face, 2.3, 2.42, 0, Math.PI, 20, old);
  for (const side of [-1, 1]) for (const [r0, r1] of [[2.05, 2.11], [2.3, 2.42]]) s.poly([[side * r0, 0.32, face], [side * r1, 0.32, face], [side * r1, 1, face], [side * r0, 1, face]], BRASS[1], { toward: [0, 0, 1], skin: 'flat' });
  // Its three eyes: a brass ring round a dormant crystal, on the keystone and on each shoulder.
  for (const a of [Math.PI / 2, 0.62, Math.PI - 0.62]) {
    const ex = Math.cos(a) * 2.36, ey = 1 + Math.sin(a) * 2.36;
    band(s, ex, ey, face + 0.03, 0.15, 0.25, 0, TAU, 10, [BRASS[1], BRASS[2], BRASS[3], BRASS[4]]);
    s.at(ex, ey, face + 0.02, { rx: Math.PI / 2 }, () => s.cone(0, 0, 0, 0.15, 0.06, 6, DORMANT, { skin: 'flat' }));
  }
  // Roots up the north jamb and over the broken top, ivy on what is left of the wall, flowers at both feet.
  const over: V3[] = [[3.3, 0, 0.5], [3.22, 1.2, 0.45], [3.18, 2.4, 0.35], [2.75, 3.25, 0.2], [1.75, 3.64, 0.12], [1.25, 4.2, 0.1], [0.3, 4.5, 0.12], [-0.6, 4.46, 0.2]];
  s.sweep(over, [0.2, 0.17, 0.15, 0.13, 0.11, 0.09, 0.06, 0.02], ROOT, { sides: 7, steps: 2, skin: 'bark', lump: 0.25, ribs: [5, 0.12], floor: 0, cap: 'end' });
  s.sweep([[3.34, 0, 0.2], [3.14, 0.7, 0.36], [3.0, 1.5, 0.66], [2.62, 1.86, 0.72]], [0.11, 0.09, 0.06, 0.02], ROOT, { sides: 6, steps: 2, skin: 'bark', lump: 0.2, floor: 0, cap: 'end' });
  s.sweep([[-3.24, 0, 0.62], [-3.18, 0.8, 0.6], [-3.12, 1.7, 0.64], [-2.9, 2.5, 0.68], [-2.3, 2.78, 0.7]], [0.13, 0.11, 0.09, 0.06, 0.02], ROOT, { sides: 6, steps: 2, skin: 'bark', lump: 0.25, floor: 0, cap: 'end' });
  ivyMass(s, -2.3, 4.4, 0.1, 1.5, 0.42, 1);
  ivyStrand(s, -2.95, 4.4, 0.64, 2);
  ivyStrand(s, -2.2, 4.4, 0.64, 1.1);
  ivyStrand(s, -1.2, 4.4, 0.64, 0.7);
  ivyMass(s, 2.7, 3.1, 0.1, 0.9, 0.35, 1);
  ivyStrand(s, 2.95, 3.1, 0.64, 1.5);
  flowers(s, -2.5, 0, 1.05, 5);
  flowers(s, 2.2, 0, 1.1, 4, 0.3);
  for (const side of [-1, 1]) s.shadowBox(side * 2.55, 0, 0, 1.1, 3, 1.2);
  s.shadowBox(-0.5, 3, 0, 5, 1.3, 1.1);
  return s.done();
}

// ---------------------------------------------------------------- the court's wall

// Four blocks of the wall that closes the court's edge: its face looks toward +z and it stands on z from 0 to 1.
// Runs join end to end. The end has a pier at +x, a course taller, where the wall stops or turns.
export function hallWall(v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8200 + v, detail), b = new Blocks(), start = s.mark(), end = v === 1;
  arch.ashlar(s, 0, 0, 0.56, 4, 0.45, 1.12, { ...ASHLAR, faces: '+z+y', course: 0.45, long: [1.1, 1.7] });
  arch.ashlar(s, 0, 0.45, 0.5, 4, 2.55, 1, { ...ASHLAR, faces: '+z', course: 0.85 });
  arch.ashlar(s, 0, 3, 0.53, 4, 0.25, 1.12, { ...ASHLAR, faces: '+z+y', course: 0.25, long: [0.9, 1.4], moss: 0.035 });
  arch.ashlar(s, 0, 0, 0.5, 4, 3.25, 1, { ...ASHLAR, faces: '-z', flat: true, moss: 0, vary: 0.08 });
  // Its two ends, plain: a neighbour hides them.
  for (const side of [-1, 1]) b.face([side * 2, 0, 0], [side * 2, 0, 1], [side * 2, 3.25, 1], [side * 2, 3.25, 0], [side, 0, 0], -0.15);
  b.draw(s, STONE, dressed(0, 'stone'));
  if (end) {
    arch.ashlar(s, 1.62, 0, 0.58, 0.76, 3.55, 1.2, { ...ASHLAR, faces: '+z+x-x', course: 0.71, long: [0.76, 0.76] });
    arch.stoneBlock(s, 1.62, 3.55, 0.58, 0.92, 0.2, 1.3, { ...ASHLAR, faces: '+z-z+x-x+y', moss: 0.04 });
    // The Gardeners' leaf, carved on the pier's face.
    grid(s, 2, cut(s, 4), (u, v) => {
      const w = 0.2 * Math.sin(Math.PI * (0.08 + 0.92 * v)), uu = u * 2 - 1;
      return [1.62 + uu * w, 1.55 + v * 0.8, 1.2 + 0.035 * (1 - Math.abs(uu)), 0.3 - 0.35 * Math.abs(uu)];
    }, STONE, { skin: 'limestone', light: 0.1, key: 0.4, mottle: 0.1, cavity: 0.1 });
  }
  s.weather(start, { moss: 0.5, wear: 0.4, stains: [[-0.3, 3, 1.02, 0.5, 1.4], [1, 3, 1.02, 0.3, 0.9]] });
  // Ivy over its top and down its face, flowers at its foot.
  const at = end ? -0.7 : -0.9;
  ivyMass(s, at, 3.2, 0.6, 1.7, 0.42, 1.05);
  ivyStrand(s, at - 0.5, 3.25, 1.1, 2.3);
  ivyStrand(s, at + 0.25, 3.2, 1.12, 1.4);
  if (!end) ivyStrand(s, 1.5, 3.2, 1.12, 0.9);
  flowers(s, end ? 0.55 : 1.0, 0, 1.4, 5);
  mossPad(s, end ? -1.5 : 0.2, 0.45, 1.06, 0.7, 0.12);
  s.shadowBox(0, 0, 0.5, 4, 3.2, 1);
  return s.done();
}

// ---------------------------------------------------------------- the dinner

// One 2 by 2 module of the table, 0.8 high: four planks on two trestles pegged to a stretcher. Three stood side by
// side along x are the 6 by 2 table. A cream linen runner with red stripes lies across each.
export function homeDinnerTable(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8210, detail), wood = { skin: 'grain' as const, skip: '-y' };
  for (let i = 0; i < 4; i++) s.box(0, 0.66, -0.75 + i * 0.5, 2, 0.14, 0.492, HONEY[[2, 3, 1, 2][i]], { ...wood, bevel: 0.018, top: HONEY[[3, 2, 2, 3][i]] });
  for (const x of [-0.62, 0.62]) {
    for (const side of [-1, 1]) s.at(x, 0, side * 0.6, { rx: -side * 0.17 }, () => s.box(0, 0, 0, 0.15, 0.67, 0.15, HONEY[1], { ...wood, skip: '-y+y' }));
    s.box(x, 0.545, 0, 0.18, 0.115, 1.56, HONEY[0], wood);
    s.box(x, 0.24, 0, 0.1, 0.1, 0.9, HONEY[1], wood);
    s.box(x + Math.sign(x) * 0.09, 0.265, 0, 0.05, 0.05, 0.05, HONEY[3], { skin: 'grain' });
  }
  s.box(0, 0.25, 0, 1.3, 0.08, 0.1, HONEY[0], wood);
  // The runner: over the top and a hand down each side.
  const w = 0.3, top = 0.803;
  s.poly([[-w, top, -1.004], [w, top, -1.004], [w, top, 1.004], [-w, top, 1.004]], LINEN[1], { toward: [0, 1, 0], skin: 'flat' });
  for (const side of [-1, 1]) {
    const z = side * 1.006;
    s.poly([[-w, top, z], [w, top, z], [w - 0.01, 0.56, z + side * 0.02], [-w + 0.01, 0.57, z + side * 0.02]], LINEN[0], { toward: [0, 0, side], skin: 'flat' });
    s.poly([[-w + 0.006, 0.635, z + side * 0.017], [w - 0.006, 0.635, z + side * 0.017], [w - 0.008, 0.6, z + side * 0.02], [-w + 0.008, 0.6, z + side * 0.02]], STRIPE, { toward: [0, 0, side], skin: 'flat' });
    for (const zz of [0.72, 0.8]) s.poly([[-w, top + 0.002, side * zz], [w, top + 0.002, side * zz], [w, top + 0.002, side * (zz + 0.035)], [-w, top + 0.002, side * (zz + 0.035)]], STRIPE, { toward: [0, 1, 0], skin: 'flat' });
  }
  s.shadowBox(0, 0, 0, 2, 0.8, 2);
  return s.done();
}

// A bench two blocks long: two planks on a board at each end, a stretcher between.
export function homeBench(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8220, detail), wood = { skin: 'grain' as const, skip: '-y' };
  for (const [z, shade] of [[-0.155, 2], [0.155, 3]]) s.box(0, 0.44, z, 2, 0.11, 0.3, HONEY[shade], { ...wood, bevel: 0.018, top: HONEY[shade === 2 ? 3 : 2] });
  for (const x of [-0.72, 0.72]) {
    s.box(x, 0, 0, 0.11, 0.44, 0.52, HONEY[1], { ...wood, skip: '-y+y' });
    s.box(x + Math.sign(x) * 0.075, 0.2, 0, 0.05, 0.05, 0.05, HONEY[3], { skin: 'grain' });
  }
  s.box(0, 0.19, 0, 1.4, 0.08, 0.1, HONEY[0], wood);
  s.shadowBox(0, 0, 0, 2, 0.55, 0.6);
  return s.done();
}

// A dinner chair: a plank seat, a raked back of two slats under a top rail.
export function homeChair(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8230, detail), wood = { skin: 'grain' as const, skip: '-y' };
  for (const x of [-0.31, 0.31]) {
    s.box(x, 0, 0.3, 0.09, 0.45, 0.09, HONEY[1], { ...wood, skip: '-y+y' });
    s.at(x, 0, -0.3, { rx: -0.07 }, () => s.box(0, 0, 0, 0.09, 1.19, 0.09, HONEY[1], wood));
    s.box(x, 0.3, 0, 0.05, 0.07, 0.56, HONEY[0], wood);
  }
  s.box(0, 0.45, 0.02, 0.74, 0.07, 0.7, HONEY[2], { ...wood, bevel: 0.018, top: HONEY[3] });
  s.box(0, 0.72, -0.35, 0.56, 0.12, 0.045, HONEY[2], { skin: 'grain' });
  s.box(0, 0.9, -0.365, 0.56, 0.08, 0.045, HONEY[2], { skin: 'grain' });
  s.box(0, 1.07, -0.38, 0.72, 0.13, 0.06, HONEY[3], { skin: 'grain', bevel: 0.015 });
  s.shadowBox(0, 0, 0, 0.76, 1.2, 0.76);
  return s.done();
}

// A pole 2.8 high on a stone foot, an arm lashed to it with hemp, and an amber lantern on a hook: lit, or out.
export function dinnerLanternPole(v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8240, detail), lit = v === 0, wood = { skin: 'grain' as const, skip: '-y' };
  s.box(0, 0, 0, 0.44, 0.2, 0.44, STONE[1], { bevel: 0.04, top: STONE[2], skin: 'stone', skip: '-y' });
  s.box(0, 0.2, 0, 0.16, 2.6, 0.16, HONEY[1], { ...wood, skip: '-y', top: HONEY[3] });
  s.box(0.3, 2.42, 0, 0.82, 0.13, 0.13, HONEY[2], { skin: 'grain' });
  s.at(0.07, 2.02, 0, { rz: Math.PI / 4 }, () => s.box(0.27, 0, 0, 0.54, 0.09, 0.09, HONEY[0], { skin: 'grain' }));
  // The lashing where the arm meets the pole, and the rope the lantern hangs by.
  for (const [y, shade] of [[2.36, 0], [2.44, 2], [2.52, 1]]) s.cyl(0, y, 0, 0.118, 0.118, 0.075, 6, ROPE[shade], { skin: 'flat', cap: 'none' });
  s.tube([[0.5, 2.485, 0], [0.64, 2.485, 0]], [0.098, 0.098], 6, ROPE[1], { skin: 'flat', cap: 'both' });
  s.tube([[0.57, 2.4, 0], [0.57, 2.24, 0], [0.61, 2.19, 0], [0.57, 2.15, 0]], [0.016, 0.016, 0.016, 0.014], 4, 0x51455d, { skin: 'flat' });
  // The lantern: a dark cap and foot, four posts, amber glass.
  s.at(0.57, 1.72, 0, 0, () => {
    s.cyl(0, 0, 0, 0.13, 0.15, 0.04, 6, 0x664930, { skin: 'flat' });
    s.tube([[0, 0.04, 0], [0, 0.1, 0], [0, 0.28, 0], [0, 0.35, 0]], [0.105, 0.135, 0.14, 0.11], 6, lit ? [AMBER[3], AMBER[2], AMBER[1]] : DORMANT, { skin: 'flat', glow: lit ? 2 : 0, cap: 'none' });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.5;
      s.tube([[Math.cos(a) * 0.125, 0.04, Math.sin(a) * 0.125], [Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15], [Math.cos(a) * 0.12, 0.35, Math.sin(a) * 0.12]], [0.012, 0.012, 0.012], 3, 0x493335, { skin: 'flat', cap: 'none' });
    }
    s.cone(0, 0.34, 0, 0.19, 0.11, 6, 0x664930, { skin: 'flat' });
    if (lit) s.light(0, 0.2, 0);
  });
  s.shadowBox(0, 0, 0, 0.3, 2.8, 0.3);
  return s.done();
}

// What is on one module of the table: two bowls of stew, bread on its board, a jar of honey, mugs and a jug of
// flowers on the runner. It stands on the table's top.
export function dinnerSpread(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8250, detail), soft: MeshOptions = { skin: 'flat', light: 0.3, key: 0.3, mottle: 0.1, cavity: 0 }, full = s.detail >= 0.75;
  for (const [x, z, stew] of [[-0.62, 0.62, 0xb68a3f], [0.6, -0.6, 0x8d9a4a]]) {
    s.lathe(x, 0, z, [[0.075, 0], [0.15, 0.065], [0.165, 0.095], [0.14, 0.085]], [0x815940, 0xa27151, 0xc48d64], { ...soft, sides: 7, cap: false });
    s.disc(x, 0.07, z, 0.135, 7, stew, { skin: 'flat' });
  }
  // Plates with a roll, and mugs.
  for (const [x, z] of [[0.62, 0.62], [-0.6, -0.62]]) {
    s.disc(x, 0.012, z, 0.15, 7, LINEN[2], { skin: 'flat' });
    if (full) s.blob(x, 0.06, z, 0.085, 0.055, 0.07, [0xb68a3f, 0xd4aa58, 0xeeca76], { sides: 5, rings: 2, jitter: 0.08, floor: 0.014, skin: 'flat' });
  }
  for (const [x, z] of full ? [[0.36, 0.5], [-0.34, -0.48]] : [[0.36, 0.5]]) s.cyl(x, 0, z, 0.055, 0.06, 0.11, 6, [0x916534, 0xb78b5a], { skin: 'flat', capTone: 0x493335 });
  // The loaf on its board.
  s.box(-0.1, 0, 0.5, 0.42, 0.025, 0.26, HONEY[3], { skin: 'grain', skip: '-y' });
  s.blob(-0.1, 0.09, 0.5, 0.17, 0.085, 0.105, [0x946635, 0xb68a3f, 0xd4aa58, 0xeeca76], { sides: 6, rings: 2, jitter: 0.06, floor: 0.027, skin: 'flat' });
  // Honey, and flowers in a jug.
  s.cyl(0.08, 0, -0.42, 0.075, 0.07, 0.13, 6, [AMBER[1], AMBER[3]], { skin: 'flat', capTone: LINEN[1] });
  s.lathe(-0.02, 0, 0.02, [[0.065, 0], [0.1, 0.08], [0.055, 0.19], [0.07, 0.24]], [0x6d96b6, 0x94c6cd, 0xccdbde], { ...soft, sides: 6, cap: false });
  for (let i = 0; i < (full ? 4 : 2); i++) {
    const a = (i / 4) * TAU + 0.4, lean = i === 0 ? 0.02 : 0.11, x = -0.02 + Math.cos(a) * lean, z = 0.02 + Math.sin(a) * lean, h = 0.42 + (i % 3) * 0.05;
    s.tube([[-0.02, 0.22, 0.02], [x, h, z]], [0.008, 0.006], 3, IVY[2], { skin: 'flat', cap: 'none' });
    s.disc(x, h, z, 0.05, 5, i % 2 ? 0xf7e09a : 0xfff0cf, { turn: a, skin: 'flat' });
  }
  return s.done();
}

// ---------------------------------------------------------------- the door in the hill
//
// The round door of the Hall, 9 wide, 8 high and 3 deep (assets-src/concept/3-sacred/hallDoor.webp): broad worn
// steps, a ring of wedge stones between two piers, oak roots over its crown, and two half-round leaves of stone
// banded in brass with a seam of lume between them. The leaves turn about the upright lines through
// (-2.5, 3.9, 0) and (2.5, 3.9, 0).

const OAK_ROOT = [0x4f3a34, 0x6b4a36, 0x8a5a3a, 0xa87446];
const DOOR_Y = 3.9;

/** One leaf of the door: `sign` -1 is the west leaf, 1 the east. */
function doorLeaf(s: Shape, sign: number): void {
  const b = new Blocks(), R = 2.475, flat = s.detail < 0.75, x0 = sign * 0.025, q = Math.PI / 4;
  const at = (a: number, r: number, z: number): V3 => [x0 + sign * Math.cos(a) * r, DOOR_Y + Math.sin(a) * r, z];
  // Four wedges of stone on its face and its back, its round edge, and the straight edge where the leaves meet.
  for (let k = 0; k < 4; k++) {
    const a0 = -Math.PI / 2 + k * q;
    b.block((a, r, off) => [...at(a, r, 0.13 + off), 0, 0, 1], a0, a0 + q, 0.58, 2.28, 0.035, 0.05, 0.03, 3, (s.r() - 0.5) * 0.3, flat);
    b.block((a, r, off) => [...at(a, r, -0.5 - off), 0, 0, -1], a0, a0 + q, 0.02, R, 0, 0, 0, 3, (s.r() - 0.5) * 0.3, true);
    for (let j = 0; j < 3; j++) {
      const a = a0 + (j * q) / 3, c = a0 + ((j + 1) * q) / 3, m = (a + c) / 2;
      b.face(at(a, R + 0.015, 0.2), at(c, R + 0.015, 0.2), at(c, R + 0.015, -0.5), at(a, R + 0.015, -0.5), [sign * Math.cos(m), Math.sin(m), 0], -0.1);
      b.face(at(a, 2.26, 0.2), at(c, 2.26, 0.2), at(c, 2.26, 0.13), at(a, 2.26, 0.13), [-sign * Math.cos(m), -Math.sin(m), 0], -0.2);
    }
  }
  b.face([x0, DOOR_Y - R, 0.13], [x0, DOOR_Y + R, 0.13], [x0, DOOR_Y + R, -0.5], [x0, DOOR_Y - R, -0.5], [-sign, 0, 0], -0.15);
  b.draw(s, STONE, dressed());
  // The brass: a band round its rim, three bands in from it, and half the hub.
  const brass: MeshOptions = { skin: 'flat', light: 0.1, key: 0.4, mottle: 0.12, cavity: 0.1 };
  grid(s, cut(s, 16), 1, (u, v) => {
    const a = -Math.PI / 2 + u * Math.PI, p = at(a, 2.26 + v * 0.23, 0.2);
    return [p[0], p[1], p[2], 0.3 * Math.sin(a * 3 + 1) + (v - 0.5) * 0.3];
  }, BRASS, { ...brass, side: -sign });
  for (let k = 1; k < 4; k++) {
    const a = -Math.PI / 2 + k * q;
    s.at(x0, DOOR_Y, 0.13, { rz: sign > 0 ? a : Math.PI - a }, () => s.box(1.44, -0.1, 0.045, 1.66, 0.2, 0.09, BRASS[2 + (k % 2)], { bevel: 0.025, top: BRASS[4], skin: 'flat', skip: '-z' }));
  }
  grid(s, cut(s, 10), cut(s, 4), (u, v) => {
    const a = -Math.PI / 2 + u * Math.PI, p = at(a, v * 0.65, 0.15 + 0.26 * Math.sqrt(Math.max(0, 1 - v * v)));
    return [p[0], p[1], p[2], 0.35 - v * 0.6 + 0.2 * Math.sin(a)];
  }, BRASS, { ...brass, side: -sign });
  // The seam of lume down the edge where the leaves meet.
  s.poly([[x0 + sign * 0.005, DOOR_Y - 2.47, 0.136], [x0 + sign * 0.05, DOOR_Y - 2.47, 0.136], [x0 + sign * 0.05, DOOR_Y + 2.47, 0.136], [x0 + sign * 0.005, DOOR_Y + 2.47, 0.136]], 0x66e4cf, { toward: [0, 0, 1], glow: 2, skin: 'flat' });
}

function doorFrame(s: Shape): void {
  const b = new Blocks(), start = s.mark();
  // Four broad steps, worn and mossed.
  for (let i = 0; i < 4; i++) arch.ashlar(s, 0, i * 0.3, 0.55 - i * 0.28, 8.6 - i * 0.65, 0.3, 1.9 - i * 0.12, { ...ASHLAR, faces: '+z+x-x+y', course: 0.3, long: [1.5, 2.6], moss: 0.03, chip: 0 });
  // A pier either side under a cap, and between them the ring of wedge stones the door closes.
  for (const side of [-1, 1]) {
    arch.ashlar(s, side * 3.48, 0, -0.6, 1.75, 3.7, 1.8, { ...ASHLAR, faces: '+z-z+x-x', course: 0.92 });
    arch.stoneBlock(s, side * 3.48, 3.7, -0.6, 2, 0.35, 1.94, { ...ASHLAR, faces: '+z-z+x-x+y', moss: 0.04 });
    arch.stoneBlock(s, side * 3.52, 1.2, -0.55, 2, 0.5, 2, { ...ASHLAR, faces: '+z+x-x+y', moss: 0.04 });
  }
  archRing(s, b, 0, 0, 0.32, 5.2, DOOR_Y, { ring: 1.05, depth: 1.82, n: 25, back: true, from: Math.PI * 1.5, to: -Math.PI / 2, gone: (i) => Math.sin(Math.PI * 1.5 - ((i + 0.5) * TAU) / 25) < -0.8 });
  b.draw(s, STONE, dressed(0.1));
  s.weather(start, { moss: 0.6, wear: 0.45 });
  // The oak's roots come over the crown and down outside the piers, never across the opening.
  const bark = { skin: 'barkOld' as const, key: 0.35, moss: 0.14, mossTone: SAGE, cap: 'both' as const };
  for (const sign of [-1, 1]) {
    const great: V3[] = [[0.15, 7.7, -0.5], [1.2, 7.5, 0.1], [2.2, 6.75, 0.4], [3.35, 6.1, 0.38], [3.95, 4.7, 0.52], [4.05, 2.9, 0.56], [4.2, 1.2, 0.5]];
    s.sweep(great.map(([x, y, z]): V3 => [sign * x, y, z]), [0.42, 0.5, 0.44, 0.36, 0.28, 0.2, 0.08], OAK_ROOT, { ...bark, sides: 10, steps: 3, lump: 0.2, ribs: [6, 0.1] });
    s.sweep([[sign * 1.4, 7.5, -0.4], [sign * 2.7, 6.65, -0.25], [sign * 4.15, 5.5, -0.1], [sign * 4.32, 3.1, 0.1]], [0.26, 0.28, 0.19, 0.04], OAK_ROOT, { ...bark, sides: 8, steps: 3, lump: 0.2, ribs: [5, 0.1] });
    s.sweep([[sign * 2.5, 6.6, 0.52], [sign * 3.05, 5.4, 0.5], [sign * 2.95, 4.5, 0.42], [sign * 3.3, 3.75, 0.36]], [0.15, 0.13, 0.09, 0.02], OAK_ROOT, { ...bark, sides: 6, steps: 2, lump: 0.2 });
    // Ivy on both shoulders and down the piers, flowers by the lowest step.
    ivyMass(s, sign * 3.5, 6.2, 0.2, 1.7, 0.5, 1.1);
    ivyStrand(s, sign * 4.3, 6.25, 0.6, 2.4, [sign * 0.5, 0.35, 1]);
    ivyStrand(s, sign * 3.7, 6.1, 0.72, 1.5);
    ivyStrand(s, sign * 1.7, 7.3, 0.5, 0.8);
    ivyMass(s, sign * 0.9, 7.65, -0.2, 1.5, 0.45, 1.1);
    ivyMass(s, sign * 2.5, 6.95, 0.35, 1.2, 0.4, 0.9);
    flowers(s, sign * 4.05, 0, 1.75, 5);
    s.shadowBox(sign * 3.45, 0, -0.6, 1.8, 4.2, 1.8);
  }
  s.shadowBox(0, 6, -0.6, 5, 1.5, 1.8);
}

export function hallDoor(_v = 0, _d?: unknown, detail = 1) {
  const s = new Shape(8260, detail);
  doorFrame(s);
  doorLeaf(s, -1);
  doorLeaf(s, 1);
  s.light(0, DOOR_Y, 0.4);
  s.shadowBox(0, 1.4, -0.2, 5, 5, 0.6);
  return s.done();
}
/**
 * The door apart, for the view that opens it: `hallFrame`, `hallLeafLeft` and `hallLeafRight`, each in the door's
 * own space, as `hallDoorParts` in group-3.ts gives them. A leaf turns about the upright line through its hinge,
 * at (-2.5, 3.9, 0) for the left and (2.5, 3.9, 0) for the right.
 */
export function hallDoorParts(detail = 1): Record<'hallFrame' | 'hallLeafLeft' | 'hallLeafRight', BufferGeometry> {
  const frame = new Shape(8260, detail), left = new Shape(8261, detail), right = new Shape(8262, detail);
  doorFrame(frame);
  doorLeaf(left, -1);
  doorLeaf(right, 1);
  const parts = { hallFrame: frame.done(), hallLeafLeft: left.done(), hallLeafRight: right.done() };
  for (const [name, g] of Object.entries(parts)) g.name = name;
  return parts;
}
