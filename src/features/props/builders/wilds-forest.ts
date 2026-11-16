// The Old Forest's solid kit, from assets-src/concept/region-forests (pieces 05 to 28). Sizes are the build
// list's W x D x H in blocks; `finish` holds each piece to its envelope after the organic shaping.
// Trunks, snags and stumps are one buttressed bark shell each (`trunk`), roots and limbs are sweeps, stone is
// the ancients' Hearth limestone laid in blocks, and moss sits in cushions on ledges and tops.
import * as THREE from 'three';
import { Shape, type Tone } from '../shape.ts';
import { P } from '../palette.ts';
import { HEARTH, ashlar, ashlarRing, stoneBlock } from '../arch.ts';

/** Ochre oak bark: violet-brown furrows to warm ridges. */
const BARK = [P.umber, P.bark, P.wood, P.tan, P.clay];
/** Drained bark: lavender-grey, never black or purple. */
const GREY = [P.slate, P.iron, P.pewter, P.ash];
const MOSS = [P.moss, P.leaf, P.lime, P.straw];
/** What moss turns to on the grey side: pale ash lichen. */
const LICHEN = [P.iron, P.pewter, P.ash, P.pearl];
/** Cut and broken wood. */
const CUT = [P.tan, P.clay, P.peach, P.cream];
const CUT_GREY = [P.pewter, P.ash, P.pearl, P.bone];
/** The inside of a hollow. */
const DARK = [P.ink, P.umber, P.bark];
const DARK_GREY = [P.night, P.slate, P.iron];
/** The sheets' rock: lavender in shade, pale where it faces the sky. */
const ROCK = [P.slate, P.iron, P.pewter, P.rose, P.ash, P.pearl];

type Point = [number, number, number];
const TAU = Math.PI * 2;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** The angle a - b brought into -PI..PI. */
const wrap = (a: number) => a - TAU * Math.round(a / TAU);

/** Holds the piece to its W x D x H, on the ground at its middle (or hanging from its origin), shadows included. */
function finish(s: Shape, w: number, d: number, h: number, hanging = false) {
  const g = s.done();
  g.computeBoundingBox();
  const b = g.boundingBox as THREE.Box3;
  const transform = new THREE.Matrix4().makeScale(w / (b.max.x - b.min.x), h / (b.max.y - b.min.y), d / (b.max.z - b.min.z));
  transform.multiply(new THREE.Matrix4().makeTranslation(-(b.max.x + b.min.x) / 2, hanging ? -b.max.y : -b.min.y, -(b.max.z + b.min.z) / 2));
  g.applyMatrix4(transform);
  g.userData.fit = transform.toArray();
  const extras = g.userData.prop;
  for (const matrices of [extras.blobs, extras.boxes])
    for (let i = 0; i < matrices.length; i += 16) new THREE.Matrix4().fromArray(matrices, i).premultiply(transform).toArray(matrices, i);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** A root, limb or branch: a tapering sweep in old bark with broad ridges, cut flat where it enters the ground. */
function limb(s: Shape, path: Point[], radii: number[], grey: boolean, o: { sides?: number; steps?: number; moss?: number; cap?: 'none' | 'start' | 'end' | 'both'; ribs?: number; floor?: number | null; squash?: number } = {}) {
  s.sweep(path, radii, grey ? GREY : BARK, {
    sides: o.sides ?? 8, steps: o.steps ?? 2, cap: o.cap ?? 'end', skin: 'barkOld', ribs: [o.ribs ?? 5, 0.1], lump: 0.06, squash: o.squash,
    moss: grey ? 0 : o.moss ?? 0.2, mossTone: MOSS, key: 0.35, cavity: 0.4, mottle: 0.24,
    floor: o.floor === null ? undefined : o.floor ?? 0,
  });
}

/** A cushion of moss on a ledge, a root or a stone; pale lichen on the grey side. */
function cushion(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number, grey = false, level = 1) {
  s.rock(x, y - h * 0.25, z, w, h, d, grey ? LICHEN : MOSS, { level, planes: 0, lump: 0.3, seat: false, skin: 'moss', light: 0.45, cavity: 0.3, key: 0.25, shadow: false });
}

/**
 * A root toe: it leaves the trunk at `from` out and `high` up along angle `a`, bends, and sinks into the ground
 * at `reach`, so it ends buried, not in a point.
 */
function toe(s: Shape, a: number, deep: number, from: number, high: number, reach: number, r: number, bend: number, grey: boolean, sides = 6) {
  const sx = Math.sin(a), cz = Math.cos(a) * deep, px = Math.cos(a) * bend, pz = -Math.sin(a) * bend * deep;
  const at = (f: number, y: number, side: number): Point => [sx * (from + (reach - from) * f) + px * side, y, cz * (from + (reach - from) * f) + pz * side];
  limb(s, [at(0, high, 0), at(0.4, high * 0.45, 0.4), at(0.75, r * 0.2, 0.95), at(1, -r * 0.25, 1.25)], [r * 1.3, r, r * 0.72, r * 0.4], grey, { sides, cap: 'end', moss: 0.3, ribs: 3, squash: 0.8 });
}

interface Trunk {
  /** [height, radius, x, z] from the ground up: the trunk's middle bends through them. */
  rows: readonly (readonly [number, number, number?, number?])[];
  sides: number;
  /** Its depth against its width: 1 is round. */
  deep?: number;
  /** Buttress roots at the foot: [angle from the front toward +x, how far out, how wide in radians]. */
  roots?: readonly (readonly [number, number, number])[];
  /** The height the buttresses fade out over. */
  flare?: number;
  /** Bark ridges: how many round it and how deep, as a share of the radius. */
  ribs?: readonly [number, number];
  /** How far above its last row the broken top stands, at each angle. */
  top?: (a: number) => number;
  /** A shell this thick at the foot and a third of it at the top, with a doorway at the front `half(h)` wide to each side. */
  hollow?: { wall: number; half: (h: number) => number };
  /** Closes the top with broken wood this far below the rim. */
  plug?: number;
  grey: boolean;
  moss?: number;
}

/**
 * A standing trunk as one bark shell: it bends through its rows, flares into buttress roots at the foot,
 * carries ridges up its length and ends in a broken top. Hollow, it has an inner wall, pale broken rims and
 * a doorway whose jambs are part of the shell.
 */
function trunk(s: Shape, o: Trunk, detail: number) {
  const n = Math.max(8, Math.round(o.sides * (detail < 1 ? 0.6 : 1)));
  const rows = o.rows, last = rows.length - 1, deep = o.deep ?? 1, flare = o.flare ?? 2;
  const [ribCount, ribDepth] = o.ribs ?? [9, 0.07];
  const tone = o.grey ? GREY : BARK;
  const crest = (a: number, h: number) => 0.5 + 0.5 * Math.cos(ribCount * a + 1.1 * Math.sin(h * 0.55 + 1.3));
  const radius = (a: number, h: number, r: number) => {
    let out = r * (1 - ribDepth * (1 - crest(a, h)));
    const fade = (1 - smooth(0, flare, h)) ** 2;
    for (const [at, reach, width] of o.roots ?? []) out += reach * fade * Math.exp(-((wrap(a - at) / width) ** 2));
    return out;
  };
  /** The angle of the doorway's jamb at this height: where the shell, `inset` in from its face, is `half` out from the middle. */
  const jamb = (h: number, r: number, inset: number) => {
    const half = o.hollow ? o.hollow.half(h) : 0;
    if (half <= 0) return 0;
    let low = 0, high = Math.PI / 2;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (Math.sin(mid) * (radius(mid, h, r) - inset) < half) low = mid; else high = mid;
    }
    return high;
  };
  const outer: number[] = [], inner: number[] = [], hints: number[] = [], uvs: number[] = [], shifts: number[] = [], tris: number[] = [];
  for (let i = 0; i <= last; i++) {
    const [h, r, cx = 0, cz = 0] = rows[i];
    const wall = o.hollow ? o.hollow.wall * (1 - 0.66 * (i / last)) : 0;
    // The doorway's sides are parallel: the inner wall opens at its own angle, so the way is as wide inside as out.
    const open = jamb(h, r, 0), within = jamb(h, r, wall);
    for (let k = 0; k <= n; k++) {
      const a = open + ((TAU - 2 * open) * k) / n, b = within + ((TAU - 2 * within) * k) / n;
      const lift = o.top ? o.top(a) * (i === last ? 1 : i === last - 1 ? 0.3 : 0) : 0;
      const R = radius(a, h, r), Ri = radius(b, h, r) - wall;
      outer.push(cx + Math.sin(a) * R, h + lift, cz + Math.cos(a) * R * deep);
      inner.push(cx + Math.sin(b) * Ri, h + lift, cz + Math.cos(b) * Ri * deep);
      hints.push(Math.sin(a), 0.15, Math.cos(a));
      uvs.push(a * Math.max(0.6, r), h);
      shifts.push(0.16 * (crest(a, h) - 0.5));
    }
  }
  for (let i = 0; i < last; i++) for (let k = 0; k < n; k++) {
    const a = i * (n + 1) + k, b = a + 1, c = a + n + 1, d = c + 1;
    tris.push(a, b, c, b, d, c);
  }
  const look = { skin: 'barkOld' as const, key: 0.35, cavity: 0.42, light: 0.25, mottle: 0.26 };
  s.mesh(outer, tris, tone, { ...look, hints, uvs, shifts, moss: o.grey ? 0 : o.moss ?? 0.22, mossTone: MOSS });
  const cut = o.grey ? CUT_GREY : CUT;
  const strip = (pick: (j: number) => number, length: number, hint: Point, a: readonly number[], b: readonly number[], wood: Tone = cut) => {
    const points: number[] = [], facing: number[] = [], faces: number[] = [];
    for (let j = 0; j < length; j++) {
      const p = pick(j) * 3;
      points.push(a[p], a[p + 1], a[p + 2], b[p], b[p + 1], b[p + 2]);
      facing.push(...hint, ...hint);
      if (j > 0) faces.push(j * 2 - 2, j * 2 - 1, j * 2, j * 2 - 1, j * 2 + 1, j * 2);
    }
    s.mesh(points, faces, wood, { skin: wood === cut ? 'grain' : 'barkOld', hints: facing, light: 0.2, mottle: 0.3, cavity: 0.25 });
  };
  if (o.hollow) {
    s.mesh(inner, tris, o.grey ? DARK_GREY : DARK, { skin: 'barkOld', hints: hints.map((v, i) => (i % 3 === 1 ? 0.1 : -v)), uvs, light: 0.12, cavity: 0.6, mottle: 0.2 });
    strip((k) => last * (n + 1) + k, n + 1, [0, 1, 0], outer, inner);
    // The jambs, up to where the doorway closes.
    let closed = 0;
    while (closed < last && o.hollow.half(rows[closed][0]) > 0) closed++;
    strip((i) => i * (n + 1), closed + 1, [-1, 0, 0.2], outer, inner, tone);
    strip((i) => i * (n + 1) + n, closed + 1, [1, 0, 0.2], outer, inner, tone);
  } else if (o.plug !== undefined) {
    // Broken wood across the top, a little below the splinters.
    const [h, r, cx = 0, cz = 0] = rows[last];
    const points = [cx, h - o.plug + r * 0.5, cz], facing = [0, 1, 0], faces: number[] = [];
    for (let k = 0; k <= n; k++) {
      const p = (last * (n + 1) + k) * 3;
      points.push(outer[p], outer[p + 1], outer[p + 2]);
      facing.push(0, 1, 0);
      if (k > 0) faces.push(0, k, k + 1);
    }
    s.mesh(points, faces, cut, { skin: 'grain', hints: facing, light: 0.2, mottle: 0.3 });
  }
}

/** The flat sawn top of a stump: broad rings, pale sapwood at the rim. */
function cutTop(s: Shape, x: number, y: number, z: number, r: number, deep: number, sides: number, grey: boolean) {
  const rings = [1, 0.8, 0.58, 0.36, 0.16], points: number[] = [], shifts: number[] = [], uvs: number[] = [], tris: number[] = [], hints: number[] = [];
  rings.forEach((f, i) => {
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * TAU, wobble = 1 + 0.05 * Math.sin(a * 3 + i);
      points.push(x + Math.sin(a) * r * f * wobble, y + (i === 0 ? -0.03 : 0.012 * i), z + Math.cos(a) * r * f * wobble * deep);
      shifts.push(i % 2 ? -0.2 : 0.16);
      uvs.push(Math.sin(a) * r * f, Math.cos(a) * r * f);
      hints.push(0, 1, 0);
    }
  });
  const centre = points.length / 3;
  points.push(x, y + 0.08, z);
  shifts.push(-0.25);
  uvs.push(0, 0);
  hints.push(0, 1, 0);
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < sides; k++) {
    const a = i * (sides + 1) + k, b = a + 1, c = a + sides + 1, d = c + 1;
    tris.push(a, b, c, b, d, c);
  }
  for (let k = 0; k < sides; k++) tris.push((rings.length - 1) * (sides + 1) + k, (rings.length - 1) * (sides + 1) + k + 1, centre);
  s.mesh(points, tris, grey ? CUT_GREY : CUT, { skin: 'grain', hints, uvs, shifts, light: 0.1, mottle: 0.2, cavity: 0.1 });
}

/** A broken top: `peaks` are [angle in turns, height]; between them the rim runs straight, so splinters stay sharp. */
function broken(peaks: readonly (readonly [number, number])[]) {
  return (a: number) => {
    const t = ((a / TAU) % 1 + 1) % 1;
    for (let i = 0; i < peaks.length; i++) {
      const [t0, h0] = peaks[i], [t1, h1] = i + 1 < peaks.length ? peaks[i + 1] : [peaks[0][0] + 1, peaks[0][1]];
      if (t >= t0 && t <= t1) return h0 + ((h1 - h0) * (t - t0)) / (t1 - t0);
    }
    return peaks[0][1];
  };
}

export function forestSnag(v: number, _def: unknown, detail = 1) {
  const s = new Shape(5105, detail), grey = v === 1;
  trunk(s, {
    rows: [[0, 1.62], [0.3, 1.36, 0.02], [0.9, 1.16, 0.05], [2, 1.04, 0.12, 0.05], [3.6, 0.96, 0.06, 0.1], [5.2, 0.9, -0.1, 0.05], [6.6, 0.82, -0.08], [7.8, 0.76, 0.05, -0.05], [8.7, 0.7, 0.12, -0.05]],
    sides: 18, deep: 0.88, flare: 2.6, ribs: [6, 0.13],
    roots: [[0.5, 0.75, 0.34], [1.75, 0.85, 0.3], [2.9, 0.6, 0.36], [4.1, 0.9, 0.3], [5.45, 0.7, 0.34]],
    grey, moss: 0.3,
  }, detail);
  // Root toes running out from the buttresses, each with a bend.
  for (const [a, reach, r, bend] of [[0.5, 2.3, 0.36, 0.25], [1.75, 2.5, 0.4, -0.3], [2.9, 2, 0.32, 0.2], [4.1, 2.5, 0.4, 0.3], [5.45, 2.2, 0.34, -0.25], [1.1, 1.9, 0.24, 0.2], [3.5, 1.9, 0.24, -0.2]])
    toe(s, a, 0.95, 0.9, 0.85, reach, r, bend, grey);
  // The fork: two thick prongs, each broken off.
  limb(s, [[0.2, 8.2, -0.05], [0.42, 9.3, -0.05], [0.34, 10.3, 0], [0.42, 11, 0.02]], [0.62, 0.46, 0.34, 0.16], grey, { sides: 8, floor: null, moss: 0, ribs: 4 });
  limb(s, [[-0.05, 8.1, 0], [-0.58, 9.1, 0.05], [-0.7, 9.9, 0], [-0.62, 10.45, 0]], [0.55, 0.4, 0.28, 0.14], grey, { sides: 8, floor: null, moss: 0, ribs: 4 });
  // Blunt branch stubs, each with a broken twig.
  const stubs: [Point[], number[]][] = [
    [[[-0.5, 5.8, 0.05], [-1.4, 6.8, 0.1], [-1.85, 7.9, 0.05], [-1.8, 8.6, 0]], [0.46, 0.34, 0.24, 0.12]],
    [[[-1.55, 7.1, 0.1], [-2.1, 7.6, 0.25], [-2.4, 8.1, 0.3]], [0.2, 0.14, 0.07]],
    [[[0.45, 6.8, 0], [1.4, 7.6, -0.15], [2, 8.8, -0.2], [2.35, 9.25, -0.2]], [0.42, 0.32, 0.2, 0.1]],
    [[[1.65, 8.1, -0.18], [2.2, 8.25, -0.05], [2.5, 8.55, 0.05]], [0.17, 0.12, 0.06]],
    [[[0.6, 4.4, 0.25], [1.3, 5.1, 0.8], [1.5, 5.8, 1.1]], [0.34, 0.24, 0.13]],
    [[[-0.6, 3.3, -0.3], [-1.1, 3.8, -0.9]], [0.28, 0.16]],
  ];
  for (const [path, radii] of stubs) limb(s, path, radii, grey, { sides: 6, floor: null, moss: 0.25 });
  // Moss climbing the foot and lodged against the trunk: pale lichen on the grey side.
  for (const [x, y, z, w, h] of [[-0.7, 0.9, 0.75, 1.3, 0.8], [0.62, 2.5, 0.7, 0.9, 0.7], [-0.5, 4.2, 0.62, 0.8, 0.6], [1.7, 0.1, 1, 1.2, 0.55], [-1.9, 0.1, -0.4, 1.1, 0.5]])
    cushion(s, x, y, z, w, h, w * 0.8, grey);
  s.shadowBlob(0, 4.4, 0, 1.05, 4.4, 1);
  s.shadowBlob(0, 0.5, 0, 2.1, 0.6, 1.7);
  return finish(s, 5, 4, 11);
}

export function forestHollowTrunk(v: number, _def: unknown, detail = 1) {
  const s = new Shape(5106, detail), grey = v === 1;
  // The doorway: 2.3 wide to above head height, then closing to a point, so a 2 x 3 walker passes clear.
  const half = (h: number) => (h < 2.7 ? 1.16 : h < 3.15 ? 1.16 - (h - 2.7) * 0.22 : Math.max(0, 1.06 * (1 - (h - 3.15) / 1.25)));
  trunk(s, {
    rows: [[0, 2.5], [0.35, 2.2], [0.9, 2.02], [1.7, 1.92, 0.02], [2.7, 1.86, 0.04], [3.15, 1.84, 0.05], [3.8, 1.8, 0.05], [4.4, 1.76, 0.04], [5.2, 1.7, 0], [6, 1.62, -0.04]],
    sides: 30, deep: 0.84, flare: 2.6, ribs: [8, 0.12],
    roots: [[1.2, 0.6, 0.3], [2.1, 0.5, 0.34], [3.14, 0.45, 0.4], [4.18, 0.5, 0.34], [5.08, 0.6, 0.3]],
    hollow: { wall: 0.5, half },
    top: broken([[0, 0.25], [0.07, 1.25], [0.13, 0.4], [0.2, 0.95], [0.3, 0.2], [0.4, 1.3], [0.5, 0.55], [0.58, 1.6], [0.66, 0.85], [0.76, 2], [0.83, 1], [0.9, 1.55], [0.96, 0.3]]),
    grey, moss: 0.28,
  }, detail);
  // Broad bark ribs down each side of the doorway, turning out into root toes. They stand clear of the 2 m way.
  limb(s, [[2.6, -0.2, 2.2], [2, 0.4, 1.7], [1.5, 1.5, 1.24], [1.45, 2.8, 1.14], [1.22, 3.9, 1.2], [0.6, 4.7, 1.38], [0.1, 5.05, 1.42]], [0.3, 0.4, 0.36, 0.32, 0.28, 0.2, 0.1], grey, { sides: 8, steps: 3, cap: 'end', moss: 0.35 });
  limb(s, [[-2.6, -0.2, 2.2], [-2.05, 0.45, 1.7], [-1.6, 1.6, 1.22], [-1.54, 2.9, 1.12], [-1.2, 4, 1.2], [-0.4, 4.85, 1.4], [0.3, 5.3, 1.38]], [0.3, 0.46, 0.42, 0.36, 0.3, 0.22, 0.1], grey, { sides: 8, steps: 3, cap: 'end', moss: 0.35 });
  for (const [a, reach, r, bend] of [[1.2, 2.8, 0.36, 0.2], [2.1, 2.75, 0.4, -0.2], [3.14, 2.75, 0.38, 0.2], [4.18, 2.75, 0.4, 0.2], [5.08, 2.8, 0.36, -0.2], [2.62, 2.6, 0.26, 0.2], [3.66, 2.6, 0.26, -0.2]])
    toe(s, a, 0.84, 1.95, 1, reach, r, bend, grey);
  // The dark earth inside.
  const floor = [0, 0.015, 0], faces: number[] = [];
  for (let k = 0; k <= 12; k++) {
    floor.push(Math.sin((k / 12) * TAU) * 1.7, 0, Math.cos((k / 12) * TAU) * 1.2);
    if (k > 0) faces.push(0, k, k + 1);
  }
  s.mesh(floor, faces, grey ? DARK_GREY : DARK, { skin: 'mud', hints: floor.map((_, i) => (i % 3 === 1 ? 1 : 0)), light: 0.1, cavity: 0.3 });
  for (const [x, y, z, w, h] of [[-1.62, 3.3, 0.95, 1.2, 0.7], [-2, 0.3, 1.4, 1.3, 0.65], [1.95, 0.25, 1.45, 1.2, 0.6], [1.5, 4.5, 0.85, 0.9, 0.55], [2.2, 0.15, -0.7, 1.1, 0.5]])
    cushion(s, x, y, z, w, h, w * 0.7, grey);
  for (const x of [-1.7, 1.7]) s.shadowBlob(x, 3.2, 0, 0.6, 3.4, 1.5);
  s.shadowBlob(0, 3.2, -1.2, 1.8, 3.4, 0.5);
  return finish(s, 6, 5, 8);
}

export function forestStumps(v: number, _def: unknown, detail = 1) {
  const s = new Shape(5107, detail), grey = v === 1;
  // Each stump is one shell: its buttress roots are part of it, spreading into toes at the ground.
  const stump = (x: number, z: number, r: number, h: number, sides: number, roots: [number, number, number][]) => {
    s.at(x, 0, z, 0, () => {
      trunk(s, { rows: [[0, r * 1.3], [h * 0.1, r * 1.2], [h * 0.3, r * 1.08], [h * 0.62, r * 1.01], [h, r]], sides, deep: 0.92, flare: h * 0.95, ribs: [Math.round(sides * 0.4), 0.09], roots, grey, moss: 0.3 }, detail);
      cutTop(s, 0, h, 0, r * 0.97, 0.92, Math.max(8, Math.round(sides * (detail < 1 ? 0.6 : 1))), grey);
    });
  };
  stump(-0.45, -0.1, 1.02, 1.12, 24, [[0.55, 0.62, 0.2], [1.7, 0.5, 0.22], [2.75, 0.56, 0.2], [3.75, 0.6, 0.2], [4.7, 0.5, 0.22], [5.65, 0.56, 0.2]]);
  stump(1.36, 0.6, 0.42, 0.64, 14, [[0.9, 0.24, 0.3], [2.5, 0.2, 0.3], [4.4, 0.22, 0.3], [5.6, 0.18, 0.3]]);
  cushion(s, -1.45, 0.08, 0.8, 0.8, 0.4, 0.65, grey);
  cushion(s, 0.5, 0.06, 0.95, 0.65, 0.32, 0.5, grey);
  s.shadowBlob(-0.5, 0.5, -0.15, 1.5, 0.7, 1.4);
  s.shadowBlob(1.45, 0.3, 0.62, 0.6, 0.4, 0.6);
  return finish(s, 4, 3, 1.2);
}
export function forestRootFan(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5108, detail);
  // The knuckle the roots leave from, under moss.
  s.rock(0, 0, -1.2, 3.3, 1.34, 2.5, BARK, { level: 2, planes: 0, lump: 0.22, skin: 'barkOld', moss: 0.6, mossTone: MOSS, key: 0.35, cavity: 0.4 });
  // Three great roots and three lesser ones: each snakes out, flattens onto the ground and goes under.
  const roots: [Point[], number[]][] = [
    [[[-0.5, 1, -1.2], [-1.7, 0.66, -0.7], [-2.8, 0.36, 0.1], [-3.5, 0.12, -0.2], [-4, -0.25, 0.2]], [0.72, 0.62, 0.48, 0.34, 0.2]],
    [[[-0.2, 1.05, -0.9], [-0.9, 0.66, 0.2], [-1.2, 0.38, 1.2], [-2, 0.12, 1.9], [-2.3, -0.25, 2.5]], [0.78, 0.66, 0.5, 0.36, 0.22]],
    [[[0.3, 1.05, -0.9], [0.9, 0.68, 0.1], [1.9, 0.4, 0.8], [2.4, 0.14, 1.7], [3.1, -0.25, 2.2]], [0.8, 0.68, 0.52, 0.38, 0.22]],
    [[[0.6, 0.95, -1.3], [1.8, 0.58, -1], [2.9, 0.32, -1.2], [3.6, 0.1, -0.7], [4, -0.25, -0.8]], [0.6, 0.52, 0.42, 0.3, 0.18]],
    [[[0, 0.9, -0.7], [0.2, 0.4, 0.6], [-0.1, 0.12, 1.5], [0.3, -0.14, 2.2]], [0.34, 0.28, 0.2, 0.13]],
    [[[-0.6, 0.8, -1.7], [-1.8, 0.36, -2.2], [-2.9, -0.12, -2.45]], [0.36, 0.28, 0.16]],
  ];
  for (const [path, radii] of roots) limb(s, path, radii, false, { sides: 8, steps: 3, cap: 'end', moss: 0.14, ribs: 4, squash: 0.85 });
  for (const [x, y, z, w, h] of [[-0.2, 1.05, -1.3, 1.9, 0.5], [0.9, 0.8, -1.5, 1.2, 0.45], [-1.5, 0.62, -0.55, 0.9, 0.35], [1.35, 0.62, 0.35, 0.8, 0.3]])
    cushion(s, x, y, z, w, h, w * 0.75);
  s.shadowBlob(0, 0.5, -1.2, 1.6, 0.8, 1.2);
  for (const [x, z] of [[-2.4, -0.2], [-1.3, 1.2], [1.8, 0.9], [2.6, -1]]) s.shadowBlob(x, 0.15, z, 1, 0.3, 0.8);
  return finish(s, 8, 5, 1.5);
}

/** A shelf mushroom's cap: a thick dome with a pale rim and gills, darker toward its middle. */
function mushroom(s: Shape, x: number, z: number, r: number, h: number, sides: number, lean: number) {
  const stem = Math.max(0.035, r * 0.2);
  s.lathe(x, 0, z, [[stem * 1.25, 0], [stem, h * 0.6], [stem * 0.9, h + 0.01]], [P.sand, P.plaster, P.ivory], { sides: 4, cap: false, skin: 'flat', light: 0.2, cavity: 0.5 });
  const rings: [number, number, number][] = [[0.24, -0.02, 0.5], [0.96, 0.012, 0.5], [1, 0.06 + r * 0.08, 0.3], [0.8, 0.1 + r * 0.22, -0.16], [0.45, 0.12 + r * 0.3, -0.42]];
  const points: number[] = [], shifts: number[] = [], hints: number[] = [], tris: number[] = [];
  for (const [f, y, shift] of rings) for (let k = 0; k <= sides; k++) {
    const a = ((k % sides) / sides) * TAU, wave = 1 + 0.07 * Math.sin(a * 3 + r * 40) + 0.04 * Math.sin(a * 5 + r * 90);
    const px = Math.sin(a) * r * f * wave, pz = Math.cos(a) * r * f * 0.9 * wave;
    points.push(x + px, h + y + lean * px, z + pz);
    shifts.push(shift);
    hints.push(Math.sin(a), y < 0.02 ? -1 : 0.6, Math.cos(a));
  }
  const top = points.length / 3;
  points.push(x, h + 0.11 + r * 0.3, z);
  shifts.push(-0.2);
  hints.push(0, 1, 0);
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < sides; k++) {
    const a = i * (sides + 1) + k, b = a + 1, c = a + sides + 1, d = c + 1;
    tris.push(a, b, c, b, d, c);
  }
  for (let k = 0; k < sides; k++) tris.push((rings.length - 1) * (sides + 1) + k, (rings.length - 1) * (sides + 1) + k + 1, top);
  s.mesh(points, tris, [P.oakDark, P.oak, P.rust, P.ochre, P.gold, P.butter, P.cream], { skin: 'flat', hints, shifts, light: 0.14, mottle: 0.2, cavity: 0.2, key: 0.2 });
}

export function forestMushrooms(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5110, detail);
  const sides = detail < 1 ? 6 : 9;
  // Shelf caps in tiers, the tallest at the back, and a few pale buttons round them.
  for (const [x, z, r, h, lean] of [[-0.28, -0.42, 0.34, 0.4, 0.1], [0.1, -0.2, 0.45, 0.3, -0.12], [-0.52, 0.02, 0.38, 0.2, 0.14], [0.42, 0.12, 0.36, 0.16, -0.1], [-0.05, 0.3, 0.34, 0.09, 0.05]])
    mushroom(s, x, z, r, h, sides, lean);
  for (const [x, z, r, h] of [[0.84, 0.42, 0.1, 0.13], [-0.9, 0.4, 0.09, 0.11], [0.74, -0.4, 0.11, 0.16], [0.36, 0.55, 0.08, 0.09]]) {
    s.lathe(x, 0, z, [[0.035, 0], [0.03, h], [r, h + 0.01], [r * 0.75, h + r * 0.6], [0, h + r * 0.85]], [P.sand, P.plaster, P.ivory], { sides: 5, cap: false, skin: 'flat', light: 0.35, cavity: 0.4 });
  }
  s.shadowBlob(0, 0.2, 0, 0.8, 0.25, 0.6);
  return finish(s, 2, 1.5, 0.6);
}

export function forestMossMound(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5111, detail);
  // A low dome of earth under a moss cap: bare earth shows at its foot.
  const sectors = detail < 1 ? 10 : 16, rings = [1, 0.84, 0.62, 0.4, 0.2];
  const points: number[] = [], shifts: number[] = [], hints: number[] = [], tris: number[] = [];
  for (const f of rings) for (let k = 0; k <= sectors; k++) {
    const a = (k / sectors) * TAU, edge = 1 + 0.09 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 5);
    const x = Math.sin(a) * 2 * f * edge, z = Math.cos(a) * 1.5 * f * edge;
    // Two humps, so the cap is uneven.
    const hump = 0.34 * Math.exp(-((x + 0.75) ** 2 + (z + 0.2) ** 2) / 0.5) + 0.2 * Math.exp(-((x - 0.95) ** 2 + (z - 0.3) ** 2) / 0.3);
    points.push(x, (0.46 * Math.pow(1 - f * f, 0.6) + hump) * (f === 1 ? 0 : 1), z);
    shifts.push(f === 1 ? -0.5 : f > 0.7 ? -0.08 : 0.06);
    hints.push(Math.sin(a) * f, 1, Math.cos(a) * f);
  }
  const top = points.length / 3;
  points.push(-0.1, 0.56, 0);
  shifts.push(0.1);
  hints.push(0, 1, 0);
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < sectors; k++) {
    const a = i * (sectors + 1) + k, b = a + 1, c = a + sectors + 1, d = c + 1;
    tris.push(a, b, c, b, d, c);
  }
  for (let k = 0; k < sectors; k++) tris.push((rings.length - 1) * (sectors + 1) + k, (rings.length - 1) * (sectors + 1) + k + 1, top);
  s.mesh(points, tris, [P.soil, P.bark, P.moss, P.leaf, P.lime, P.straw], { skin: 'moss', hints, shifts, light: 0.3, mottle: 0.3, cavity: 0.35, key: 0.25 });
  s.shadowBlob(0, 0.2, 0, 1.7, 0.4, 1.2);
  return finish(s, 4, 3, 0.8);
}

export function forestBranch(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5112, detail);
  // The limb, sawn at its butt, forking into two sweeps that lift off the ground.
  limb(s, [[-3, 0.32, 0.3], [-1.7, 0.31, 0.18], [-0.3, 0.34, 0], [0.8, 0.4, -0.12]], [0.36, 0.34, 0.3, 0.27], false, { sides: 7, cap: 'none', moss: 0.18, floor: null });
  const butt: Point[] = [];
  for (let k = 0; k < 7; k++) butt.push([-3, 0.32 + Math.cos((k / 7) * TAU) * 0.33, 0.3 + Math.sin((k / 7) * TAU) * 0.33]);
  s.poly(butt, P.peach, { toward: [-1, 0, 0], skin: 'grain' });
  limb(s, [[0.7, 0.4, -0.1], [1.6, 0.5, -0.45], [2.4, 0.62, -0.6], [3, 0.7, -0.78]], [0.25, 0.2, 0.14, 0.07], false, { sides: 6, moss: 0.3, floor: null });
  limb(s, [[0.5, 0.36, 0], [1.4, 0.32, 0.45], [2.2, 0.28, 0.8], [2.95, 0.34, 0.95]], [0.22, 0.17, 0.12, 0.06], false, { sides: 6, moss: 0.3, floor: null });
  // Broken twigs.
  limb(s, [[1.9, 0.56, -0.5], [2.25, 0.76, -0.2]], [0.08, 0.035], false, { sides: 4, steps: 1, moss: 0, floor: null, ribs: 0 });
  limb(s, [[1.7, 0.32, 0.6], [2.05, 0.52, 0.32]], [0.07, 0.03], false, { sides: 4, steps: 1, moss: 0, floor: null, ribs: 0 });
  limb(s, [[-1.2, 0.5, 0.1], [-0.95, 0.8, -0.2]], [0.12, 0.07], false, { sides: 5, steps: 1, moss: 0, floor: null, ribs: 0 });
  s.shadowBlob(-1, 0.25, 0.1, 2.1, 0.3, 0.4);
  s.shadowBlob(2, 0.3, 0.1, 1.1, 0.3, 0.9);
  return finish(s, 6, 2, 0.8);
}

export function forestRocks(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5113, detail);
  // Three rounded stones, the tallest behind, moss over their tops.
  for (const [x, z, w, h, d, level] of [[0.15, -0.38, 2.7, 2.5, 2.2, 3], [-1.15, 0.72, 1.65, 1.15, 1.45, 2], [1.12, 0.55, 1.8, 1.45, 1.65, 2]])
    s.rock(x, 0, z, w, h, d, ROCK, { level, planes: 5, flat: 0.8, reach: 0.8, lump: 0.08, moss: 0.56, mossTone: MOSS, light: 0.25, key: 0.5, skin: 'rock' });
  return finish(s, 4, 3, 2.5);
}

export function forestVines(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5114, detail);
  // The bough fragment they hang from.
  limb(s, [[-1.5, 5.72, 0], [-0.6, 5.8, 0.1], [0.4, 5.75, -0.05], [1.5, 5.86, 0.05]], [0.12, 0.17, 0.16, 0.08], false, { sides: 7, cap: 'both', moss: 0.5, floor: null });
  limb(s, [[0.7, 5.8, 0], [1.05, 5.98, 0.2]], [0.07, 0.035], false, { sides: 4, steps: 1, moss: 0, floor: null, ribs: 0 });
  const greens = [P.leaf, P.lime, P.straw, P.leaf, P.lime];
  const leaf = (x: number, y: number, z: number, side: number, depth: number, length: number, tone: number) => {
    // A broad leaf hanging out and down from its cord, turned a little up so it takes the light.
    const d: Point = [side * 0.72, -0.62, depth], l = Math.hypot(...d);
    const across: Point = [side * 0.5 * depth, 0.25, -0.86 * side * side + 0.14];
    const al = Math.hypot(...across), w = length * 0.42;
    const at = (f: number, g: number): Point => [x + (d[0] / l) * length * f + (across[0] / al) * w * g, y + (d[1] / l) * length * f + (across[1] / al) * w * g, z + (d[2] / l) * length * f + (across[2] / al) * w * g];
    s.poly([at(0, 0), at(0.2, 0.8), at(0.55, 1), at(1, 0), at(0.55, -1), at(0.2, -0.8)], tone, { two: true, skin: 'flat' });
  };
  [[-0.85, 5, 0.12], [0.02, 4.2, -0.1], [0.9, 5.72, 0.06]].forEach(([x, length, bow], i) => {
    const tip = 5.7 - length;
    const cz = [-0.22, 0.2, -0.05][i];
    s.sweep([[x, 5.74, cz * 0.3], [x + bow, 5.7 - length * 0.35, cz], [x - bow * 0.6, 5.7 - length * 0.7, cz * 0.8], [x + bow * 0.3, tip, cz]], [0.05, 0.045, 0.035, 0.015], [P.pine, P.moss, P.leaf], { sides: 4, steps: 2, cap: 'end', skin: 'flat', light: 0.2 });
    const count = Math.round(length / 0.52);
    for (let j = 0; j < count; j++) {
      const t = (j + 0.6) / count, y = 5.7 - length * t, side = (j + i) % 2 ? 1 : -1;
      const cx = x + (t < 0.35 ? bow * (t / 0.35) : t < 0.7 ? bow - (bow * 1.6 * (t - 0.35)) / 0.35 : -bow * 0.6 + (bow * 0.9 * (t - 0.7)) / 0.3);
      const size = 0.44 + 0.12 * ((j * 7 + i * 3) % 4) / 3;
      leaf(cx, y, cz, side, (j % 3 - 1) * 0.5, size, greens[(j + i * 2) % greens.length]);
      if (detail >= 1 && j % 2 === 0) leaf(cx, y - 0.08, cz, -side, ((j + 1) % 3 - 1) * 0.5, size * 0.85, greens[(j + i * 2 + 2) % greens.length]);
    }
  });
  // A few leaves on the bough itself.
  for (const [x, side, depth] of [[-1.2, -1, 0.4], [-0.75, 1, -0.5], [-0.2, -1, 0.5], [0.35, 1, 0.4], [0.75, -1, -0.4], [1.25, 1, 0.3]])
    leaf(x, 5.86, 0, side, depth, 0.4, greens[Math.round(x * 3 + 5) % greens.length]);
  return finish(s, 3, 1, 6, true);
}

export function forestBeeComb(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5115, detail);
  const amber = [P.oak, P.ochre, P.gold, P.butter, P.lemon];
  // Three hanging lobes of natural comb, widest high up and drawn down to a tip.
  const lobes: [number, number, number, number, number, number, number][] = [[0, 0, 0, 0.46, 0.96, 0.24, 2], [-0.17, 0.3, -0.03, 0.34, 0.7, 0.2, 1], [0.18, 0.4, -0.04, 0.3, 0.58, 0.18, 1]];
  for (const [x, y, z, w, h, d, level] of lobes)
    s.rock(x, y, z, w, h, d, amber, { level, planes: 0, lump: 0.05, seat: false, skin: 'flat', light: 0.2, key: 0.45, cavity: 0.5, mottle: 0.3, shadow: false });
  // Open cells on the front of the big lobe.
  const cell = 0.062;
  for (let j = 0; j < 7; j++) for (let i = -2; i <= 2; i++) {
    const x = i * cell * 1.8 + (j % 2) * cell * 0.9, y = 0.26 + j * cell * 1.56;
    const in2 = 1 - (x / 0.22) ** 2 - ((y - 0.5) / 0.5) ** 2;
    if (in2 < 0.55) continue;
    const z = 0.12 * Math.sqrt(in2) + 0.012;
    const ring: Point[] = [];
    for (let k = 0; k < 6; k++) ring.push([x + Math.cos((k / 6) * TAU) * cell * 0.78, y + Math.sin((k / 6) * TAU) * cell * 0.78, z]);
    s.poly(ring, (i + j) % 3 ? P.oak : P.oakDark, { toward: [0, 0, 1], skin: 'flat' });
  }
  return finish(s, 0.65, 0.25, 1);
}

/** How the forest's ruins are laid: big rounded blocks with deep joints, chipped, each its own shade. */
const RUIN = { tone: HEARTH, course: 0.63, long: [0.95, 1.5] as const, chamfer: 0.1, relief: 0.07, chip: 0.5, vary: 0.3, moss: 0.3, mossTone: MOSS };

/** A block that has fallen out of a wall, turned and tipped. */
function fallen(s: Shape, x: number, z: number, w: number, h: number, d: number, turn: number, tip: number) {
  s.at(x, -h * 0.18, z, { ry: turn, rz: tip }, () => stoneBlock(s, 0, 0, 0, w, h, d, { ...RUIN, faces: '+z+x-x-z+y', chip: 1 }));
}

/** Moss that sits on the ground or on a ledge with a flat foot, and a tuft of it hanging down a face. */
function tuft(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number) {
  s.rock(x, y, z, w, h, d, MOSS, { level: 1, planes: 0, lump: 0.25, skin: 'moss', light: 0.45, cavity: 0.3, key: 0.25, shadow: false });
}

/** A sprig of broad leaves growing out of a joint or a root. */
function sprig(s: Shape, x: number, y: number, z: number, leaves: number, reach: number) {
  const greens = [P.leaf, P.lime, P.moss, P.straw];
  for (let i = 0; i < leaves; i++) {
    const a = s.rr(0, TAU), rise = s.rr(0.35, 0.9), l = reach * s.rr(0.7, 1.1), w = l * 0.34;
    const dx = Math.cos(a) * Math.cos(rise), dy = Math.sin(rise), dz = Math.sin(a) * Math.cos(rise);
    const ax = -Math.sin(a), az = Math.cos(a);
    const at = (f: number, g: number): Point => [x + dx * l * f + ax * w * g, y + dy * l * f, z + dz * l * f + az * w * g];
    s.poly([at(0, 0), at(0.45, 1), at(1, 0), at(0.45, -1)], greens[i % greens.length], { two: true, skin: 'flat' });
  }
}

export function forestWall(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5117, detail);
  // Stretches of coursed wall, each standing a course lower than the last, set a little forward or back.
  const runs: [number, number, number, number, number, number][] = [
    [-3.9, -1.3, 0, 1.74, -0.06, 1.16], [-3.4, -1.8, 1.72, 0.58, -0.12, 1.06], [-1.3, 0.55, 0, 1.16, 0.08, 1.16], [-1.3, -0.3, 1.14, 0.58, 0.02, 1.06],
    [0.55, 2.25, 0, 1.16, -0.05, 1.14], [0.95, 1.9, 1.14, 0.48, -0.08, 1], [2.25, 3.3, 0, 0.58, 0.08, 1.1],
  ];
  for (const [x0, x1, y, h, z, d] of runs) {
    ashlar(s, (x0 + x1) / 2, y, z, x1 - x0, h, d, { ...RUIN, course: 0.58, faces: '+z+x-x+y' });
    ashlar(s, (x0 + x1) / 2, y, z, x1 - x0, h, d, { ...RUIN, course: 0.58, faces: '-z', flat: true });
  }
  // Blocks that have come down, at the low end and in front.
  fallen(s, 3.6, 0.2, 0.8, 0.48, 0.7, 0.3, 0.22);
  fallen(s, -2.3, 0.64, 0.86, 0.46, 0.46, -0.2, -0.12);
  fallen(s, 0.35, 0.7, 0.55, 0.34, 0.4, 0.4, 0.1);
  fallen(s, 2.7, 0.66, 0.6, 0.36, 0.44, -0.3, -0.15);
  // Moss caps on the ledges, hanging over their edges, and banked along the buried foot.
  for (const [x, y, z, w, h, d] of [[-2.65, 2.3, -0.1, 1.5, 0.26, 1.1], [-3.6, 1.74, 0.05, 0.75, 0.24, 0.9], [-0.85, 1.72, 0.08, 1.05, 0.26, 1], [0.2, 1.16, 0.15, 0.8, 0.22, 0.9], [1.4, 1.62, -0.05, 0.9, 0.24, 0.9], [2.8, 0.58, 0.12, 0.9, 0.22, 0.9]])
    cushion(s, x, y, z, w, h, d);
  for (const [x, y, z, w, h] of [[-2.9, 1.8, 0.46, 0.5, 0.6], [-2.2, 1.95, 0.44, 0.36, 0.42], [-0.7, 1.3, 0.62, 0.42, 0.5], [1.2, 1.26, 0.5, 0.36, 0.4]])
    cushion(s, x, y, z, w, h, 0.22);
  for (const [x, z, w] of [[-3.5, 0.62, 1], [-1.2, 0.7, 1.4], [1.4, 0.62, 1.2], [3, -0.4, 1], [-2, -0.66, 1.5], [0.8, -0.64, 1.3]]) tuft(s, x, 0, z, w, 0.34, 0.56);
  sprig(s, -3.3, 0.3, 0.66, 4, 0.3);
  sprig(s, 0.9, 0.3, 0.7, 4, 0.28);
  s.shadowBox(-2.6, 0, -0.06, 2.6, 1.74, 1.16);
  s.shadowBox(0.5, 0, 0, 3.5, 1.16, 1.16);
  s.shadowBox(2.8, 0, 0.08, 1.1, 0.58, 1.1);
  return finish(s, 8, 2, 2.5);
}

/**
 * A soft form through elliptical rings from the bottom up, each [y, x, z, rx, rz]: drapery, a body. `fold`
 * moves a point in or out by a share of its radius, at angle `a` on ring `i`. It closes over its top.
 */
function loft(s: Shape, rings: readonly (readonly number[])[], sides: number, tone: Tone, fold: (a: number, i: number) => number, moss = 0) {
  const points: number[] = [], hints: number[] = [], uvs: number[] = [], tris: number[] = [];
  rings.forEach(([y, cx, cz, rx, rz], i) => {
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * TAU, f = 1 + fold(a, i);
      points.push(cx + Math.sin(a) * rx * f, y, cz + Math.cos(a) * rz * f);
      hints.push(Math.sin(a), 0.25, Math.cos(a));
      uvs.push(a * Math.max(rx, rz), y);
    }
  });
  const top = points.length / 3, last = rings[rings.length - 1];
  points.push(last[1], last[0] + last[3] * 0.5, last[2]);
  hints.push(0, 1, 0);
  uvs.push(0, last[0]);
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < sides; k++) {
    const a = i * (sides + 1) + k, b = a + 1, c = a + sides + 1, d = c + 1;
    tris.push(a, b, c, b, d, c);
  }
  for (let k = 0; k < sides; k++) tris.push((rings.length - 1) * (sides + 1) + k, (rings.length - 1) * (sides + 1) + k + 1, top);
  s.mesh(points, tris, tone, { skin: 'limestone', hints, uvs, light: 0.28, key: 0.42, cavity: 0.6, mottle: 0.24, moss, mossTone: MOSS });
}

export function forestStatue(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5118, detail);
  const stone = { skin: 'limestone' as const, light: 0.28, key: 0.42, cavity: 0.55, mottle: 0.24, shadow: false, seat: false };
  // The plinth: two broken tiers of blocks, and two that have slid off.
  ashlar(s, 0, 0, 0.05, 3.5, 0.76, 2.9, { ...RUIN, course: 0.76, long: [1, 1.5], faces: '+z+x-x-z+y' });
  ashlar(s, 0.12, 0.74, -0.2, 2.6, 0.62, 2.1, { ...RUIN, course: 0.62, long: [0.9, 1.4], faces: '+z+x-x-z+y' });
  fallen(s, -1.7, 1.5, 0.86, 0.5, 0.66, 0.3, 0.2);
  fallen(s, 1.4, 1.56, 0.7, 0.42, 0.56, -0.25, -0.12);
  // The Gardener, seated, her head bowed toward the vessel in her lap.
  s.at(0.05, 1.33, -0.32, 0, () => {
    const folds = (a: number, i: number) => (i < 4 ? 0.07 * (1 - i / 4) * Math.cos(a * 8 + i * 0.7) : 0) + (i < 3 ? 0.05 * Math.cos(a * 3 + 1) : 0);
    loft(s, [[0, 0, 0.3, 1.34, 1.22], [0.42, 0, 0.36, 1.28, 1.18], [0.92, 0, 0.42, 1.14, 1.08], [1.22, 0, 0.2, 0.86, 0.78], [1.62, 0, 0, 0.64, 0.5], [2.16, 0, -0.04, 0.7, 0.52], [2.6, 0, -0.04, 0.86, 0.5], [2.9, 0, -0.02, 0.7, 0.44], [3.1, 0, 0.02, 0.32, 0.3], [3.3, 0, 0.05, 0.24, 0.24]], detail < 1 ? 12 : 20, HEARTH, folds, 0.16);
    // Wide sleeves: the far arm reaches across to the handle, the near one steadies the vessel.
    for (const [path, radii] of [
      [[[-0.74, 2.58, 0], [-0.98, 1.98, 0.46], [-0.3, 1.94, 0.98], [0.3, 2.1, 1.06]], [0.25, 0.3, 0.32, 0.26]],
      [[[0.76, 2.58, 0], [1.14, 1.96, 0.26], [1.08, 1.56, 0.74]], [0.25, 0.3, 0.34]],
    ] as [Point[], number[]][])
      s.sweep(path, radii, HEARTH, { sides: 9, steps: 3, squash: 1.2, cap: 'both', skin: 'limestone', light: 0.28, key: 0.42, cavity: 0.55, mottle: 0.22, moss: 0.12, mossTone: MOSS });
    s.rock(0.42, 2.02, 1.08, 0.3, 0.26, 0.26, HEARTH, { ...stone, level: 1, planes: 0 });
    s.rock(1.04, 1.34, 0.92, 0.26, 0.3, 0.26, HEARTH, { ...stone, level: 1, planes: 0 });
    // The watering vessel: a round body, a spout with its rose, a handle over the top.
    const can = [0x9c91a7, 0xc9b28e, P.sand, P.plaster];
    s.lathe(0.52, 0.98, 1.02, [[0.4, 0], [0.48, 0.08], [0.49, 0.74], [0.45, 0.86], [0.37, 0.88], [0.37, 0.78]], can, { sides: 12, skin: 'limestone', light: 0.25, key: 0.4, cavity: 0.5, capTone: 0x9c91a7 });
    s.sweep([[0.92, 1.3, 1.1], [1.44, 1.7, 1.16], [1.86, 2.04, 1.18]], [0.16, 0.12, 0.11], can, { sides: 7, steps: 2, cap: 'none', skin: 'limestone', key: 0.4 });
    s.rock(1.74, 1.9, 1.02, 0.38, 0.38, 0.32, can, { ...stone, level: 1, planes: 1 });
    s.sweep([[0.16, 1.8, 1.02], [0.2, 2.18, 1.02], [0.54, 2.34, 1.02], [0.84, 2.16, 1.02], [0.86, 1.82, 1.02]], [0.075, 0.075, 0.075, 0.075, 0.075], can, { sides: 6, steps: 2, skin: 'limestone', key: 0.4 });
    // Her head, bowed and turned, inside a head-cloth that falls to her shoulders.
    s.at(0.06, 3.26, 0.04, { rx: 0.32, rz: -0.18, ry: 0.3 }, () => {
      s.rock(0, 0.04, 0.14, 0.76, 0.98, 0.84, HEARTH, { ...stone, level: 2, planes: 0, lump: 0.03 });
      s.rock(0, 0.38, 0.52, 0.14, 0.26, 0.17, HEARTH, { ...stone, level: 1, planes: 0, lump: 0 });
      s.rock(0, 0.12, -0.16, 1.14, 1.2, 1.08, HEARTH, { ...stone, level: 2, planes: 0, lump: 0.07, moss: 0.42, mossTone: MOSS });
      s.sweep([[-0.44, 0.74, 0.28], [0, 0.98, 0.4], [0.44, 0.74, 0.28]], [0.13, 0.15, 0.13], HEARTH, { sides: 7, steps: 3, skin: 'limestone', light: 0.3, key: 0.42, cavity: 0.5, moss: 0.3, mossTone: MOSS });
      cushion(s, -0.05, 1.22, -0.2, 0.8, 0.3, 0.7);
    });
    for (const side of [-1, 1])
      s.sweep([[0.06 + side * 0.52, 3.72, 0.1], [0.06 + side * 0.7, 3.1, 0.14], [0.06 + side * 0.84, 2.5, 0.1]], [0.2, 0.25, 0.14], HEARTH, { sides: 7, steps: 2, squash: 1.2, skin: 'limestone', light: 0.28, key: 0.42, cavity: 0.5 });
    s.sweep([[0.06, 3.9, -0.52], [0.06, 3.1, -0.6], [0.06, 2.3, -0.58]], [0.4, 0.58, 0.62], HEARTH, { sides: 9, steps: 2, squash: 0.6, cap: 'both', skin: 'limestone', light: 0.28, key: 0.3, cavity: 0.5, moss: 0.2, mossTone: MOSS });
  });
  // Living roots hold the plinth: one climbs behind her to her head, the rest wrap the blocks.
  const roots: [Point[], number[]][] = [
    [[[-2.2, -0.1, 1.2], [-2, 0.55, 0.75], [-1.74, 1.5, 0.25], [-1.6, 2.7, -0.25], [-1.4, 3.9, -0.6], [-0.95, 4.9, -0.8], [-0.25, 5.5, -0.8]], [0.26, 0.44, 0.46, 0.42, 0.36, 0.26, 0.1]],
    [[[-2.2, -0.1, -0.3], [-1.9, 0.7, 0.2], [-1.56, 1.3, 0.75], [-1.02, 1.42, 1.25], [-0.5, 1.1, 1.5], [-0.2, 0.62, 1.6]], [0.22, 0.3, 0.3, 0.26, 0.2, 0.1]],
    [[[2, -0.1, -1.5], [2.1, 0.45, -0.4], [2, 0.7, 0.7], [1.5, 0.5, 1.5], [0.6, 0.2, 1.7], [-0.3, -0.14, 1.8]], [0.28, 0.38, 0.38, 0.32, 0.24, 0.12]],
    [[[2.25, -0.1, 0.3], [1.98, 0.9, 0], [1.72, 1.9, -0.35], [1.52, 2.8, -0.62], [1.16, 3.4, -0.8]], [0.2, 0.3, 0.28, 0.2, 0.07]],
    [[[0.6, -0.1, -1.72], [0.3, 1.2, -1.5], [-0.2, 2.7, -1.2], [-0.6, 3.7, -1]], [0.26, 0.4, 0.3, 0.1]],
  ];
  for (const [path, radii] of roots) limb(s, path, radii, false, { sides: 8, steps: detail < 1 ? 2 : 3, cap: 'end', moss: 0.16, ribs: 4 });
  for (const [x, y, z, w, h] of [[-1.3, 0.74, 1.1, 0.9, 0.24], [1.2, 0.74, 1.2, 0.7, 0.22], [-1.1, 1.34, 0.4, 0.6, 0.2], [1.25, 1.34, -0.9, 0.7, 0.2]]) cushion(s, x, y, z, w, h, w * 0.8);
  for (const [x, z, w] of [[-1.9, 1.62, 1.1], [1.2, 1.66, 1.2], [1.95, -1.4, 1], [-1.9, -1.3, 1.1]]) tuft(s, x, 0, z, w, 0.3, 0.6);
  sprig(s, -1.75, 2.6, 0.1, 5, 0.42);
  sprig(s, 1.72, 2.2, -0.3, 5, 0.42);
  sprig(s, -2, 0.6, 0.8, 4, 0.34);
  sprig(s, -1.2, 4.5, -0.6, 4, 0.36);
  s.shadowBox(0, 0, 0, 3.4, 1.3, 2.8);
  s.shadowBlob(0.1, 3.1, -0.3, 1.2, 2.2, 1);
  return finish(s, 5, 4, 6);
}

export function forestGatePost(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5119, detail);
  const block = { ...RUIN, faces: '+z+x-x-z+y' };
  // A stepped foot, the shaft in big blocks, a teal cap course and the stump of what stood on it.
  ashlar(s, 0, 0, 0, 1.96, 0.4, 1.96, { ...block, course: 0.4, long: [1, 1.5] });
  ashlar(s, 0, 0.38, 0, 1.68, 0.3, 1.68, { ...block, course: 0.3, long: [0.9, 1.3] });
  ashlar(s, 0, 0.66, 0, 1.4, 3.08, 1.4, { ...block, course: 0.78, long: [0.9, 1.4], faces: '+z+x-x-z', moss: 0.2 });
  const teal = [P.tealDark, P.teal, P.tealPale, P.mist];
  s.roundBox(-0.42, 3.72, 0, 0.96, 0.3, 1.82, teal, { round: 0.06, wobble: 0.035, skin: 'limestone', key: 0.4, mottle: 0.3, moss: 0.25, mossTone: MOSS });
  s.at(0.5, 3.69, 0, { rz: -0.06 }, () => s.roundBox(0, 0, 0.04, 0.8, 0.29, 1.74, teal, { round: 0.06, wobble: 0.035, skin: 'limestone', key: 0.4, mottle: 0.3 }));
  // What is left of the block above: broken off on a slant, highest at the back.
  const stub: number[] = [], faces: number[] = [], tops = [0.42, 0.7, 0.98, 0.62, 0.3, 0.18, 0.34, 0.5];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + Math.PI, square = 1 / Math.max(Math.abs(Math.sin(a)), Math.abs(Math.cos(a)));
    const x = Math.sin(a) * 0.66 * square - 0.04, z = Math.cos(a) * 0.66 * square;
    stub.push(x, 3.98, z, x * 0.94, 4 + tops[k], z * 0.94);
  }
  stub.push(-0.1, 4.52, -0.1);
  for (let k = 0; k < 8; k++) {
    const a = k * 2, b = ((k + 1) % 8) * 2;
    faces.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, 16);
  }
  const out: number[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + Math.PI;
    out.push(Math.sin(a), 0, Math.cos(a), Math.sin(a), 0.6, Math.cos(a));
  }
  out.push(0, 1, 0);
  s.mesh(stub, faces, HEARTH, { skin: 'limestone', hints: out, crease: 0.5, light: 0.3, key: 0.45, mottle: 0.25, cavity: 0.3, moss: 0.2, mossTone: MOSS });
  // One shallow carving: a stem with paired leaves, on the front.
  const face = 0.79, carve = (points: number[], tris: number[], shifts: number[]) =>
    s.mesh(points, tris, HEARTH, { skin: 'limestone', hints: points.map((_, i) => (i % 3 === 2 ? 1 : 0)), shifts, light: 0.1, mottle: 0.08, cavity: 0 });
  const blade = (x: number, y: number, turn: number, l: number) => {
    const dx = Math.sin(turn), dy = Math.cos(turn), w = l * 0.3;
    const at = (f: number, g: number, out: number) => [x + dx * l * f + dy * w * g, y + dy * l * f - dx * w * g, face + out];
    carve([...at(0, 0, 0), ...at(0.45, 1, 0), ...at(1, 0, 0), ...at(0.45, -1, 0), ...at(0.5, 0, 0.06)], [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4], [-0.42, -0.46, -0.42, -0.2, 0.3]);
  };
  carve([-0.035, 1.42, face, 0.035, 1.42, face, 0.03, 3.05, face, -0.03, 3.05, face, 0, 1.42, face + 0.035, 0, 3.05, face + 0.035], [0, 4, 5, 0, 5, 3, 4, 1, 2, 4, 2, 5], [-0.3, -0.1, -0.1, -0.3, 0.2, 0.2]);
  for (const [y, l] of detail < 1 ? [[1.9, 0.62]] : [[1.56, 0.64], [2.06, 0.6], [2.52, 0.52]]) for (const side of [-1, 1]) blade(side * 0.03, y, side * 0.9, l);
  blade(0, 2.94, 0, 0.5);
  // The old brass hinge on the gate side: two leaves and their pin.
  const brass = [P.oakDark, P.oak, P.ochre, P.gold];
  s.roundBox(0.77, 2.02, -0.14, 0.07, 0.64, 0.44, brass, { round: 0.02, skin: 'flat', key: 0.4 });
  s.roundBox(0.84, 2.02, 0.4, 0.07, 0.64, 0.4, brass, { round: 0.02, skin: 'flat', key: 0.4 });
  s.sweep([[0.82, 1.98, 0.14], [0.82, 2.7, 0.14]], [0.085, 0.085], brass, { sides: 7, steps: 1, skin: 'flat', key: 0.4 });
  cushion(s, -0.68, 0.38, 0.66, 0.56, 0.26, 0.5);
  cushion(s, -0.55, 4.02, 0.6, 0.6, 0.2, 0.5);
  cushion(s, -0.64, 1.3, 0.68, 0.3, 0.5, 0.2);
  tuft(s, 0.66, 0, 0.72, 0.62, 0.3, 0.5);
  tuft(s, -0.68, 0, -0.66, 0.6, 0.26, 0.6);
  sprig(s, 0.72, 0.25, 0.74, 4, 0.22);
  s.shadowBox(0, 0, 0, 1.5, 4.8, 1.5);
  return finish(s, 2, 2, 5);
}

export function forestShrineRing(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5120, detail);
  // A low broken kerb round the shrine, open to the south (+z) for three blocks.
  ashlarRing(s, 0, 0, 0, 4.78, 0.92, { ...RUIN, thick: 0.85, from: 0.4, to: TAU - 0.4, course: 0.46, long: [0.9, 1.4], tops: [0.46, 0.92, 0.92, 0.46, 0.92, 0.46, 0.46, 0.92, 0.92, 0.46, 0.92, 0.92, 0.46] });
  for (const a of [0.9, 1.7, 2.6, 3.3, 4.2, 5.1, 5.6]) cushion(s, Math.sin(a) * 4.34, 0.86, Math.cos(a) * 4.34, 1, 0.16, 0.74);
  for (const a of [0.75, 1.4, 2.2, 3.7, 4.7, 5.55]) tuft(s, Math.sin(a) * 4.5, 0, Math.cos(a) * 4.5, 0.9, 0.28, 0.7);
  fallen(s, 2.75, 3.7, 0.8, 0.44, 0.6, 0.5, 0.15);
  fallen(s, -3.2, -2.2, 0.7, 0.4, 0.6, -0.3, 0.2);
  return finish(s, 10, 10, 1);
}

export function greyBrush(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5124, detail);
  const twig = [P.slate, P.iron, P.pewter, P.ash];
  // Three leafless shrubs: each a fan of blunt stems that fork twice, with open gaps between.
  const shrub = (x: number, z: number, reach: number, h: number, stems: number) => {
    for (let i = 0; i < stems; i++) {
      const a = (i / stems) * TAU + s.rr(-0.3, 0.3), out = s.rr(0.75, 1.05), lift = s.rr(0.8, 1);
      const dx = Math.sin(a), dz = Math.cos(a);
      const p0: Point = [x + dx * 0.06, 0, z + dz * 0.06];
      const bend = s.rr(-0.25, 0.25), bx = Math.cos(a) * bend, bz = -Math.sin(a) * bend;
      const p1: Point = [x + dx * reach * 0.36 * out + bx, h * 0.36 * lift, z + dz * reach * 0.36 * out + bz];
      const p2: Point = [x + dx * reach * 0.72 * out + bx * 0.5, h * 0.68 * lift, z + dz * reach * 0.72 * out + bz * 0.5];
      const p3: Point = [x + dx * reach * out - bx * 0.6, h * lift, z + dz * reach * out - bz * 0.6];
      s.tube([p0, p1, p2, p3], [0.06, 0.048, 0.034, 0.02], 3, twig, { skin: 'flat' });
      // A side twig low down, and a fork near the tip.
      const turn = a + (i % 2 ? 0.8 : -0.8), tx = Math.sin(turn), tz = Math.cos(turn);
      s.tube([p1, [p1[0] + tx * reach * 0.28, p1[1] + h * 0.3, p1[2] + tz * reach * 0.28], [p1[0] + tx * reach * 0.42, p1[1] + h * 0.5, p1[2] + tz * reach * 0.42]], [0.034, 0.026, 0.018], 3, twig, { skin: 'flat' });
      if (detail >= 1) s.tube([p2, [p2[0] - tx * reach * 0.26, p2[1] + h * 0.26, p2[2] - tz * reach * 0.26]], [0.028, 0.018], 3, twig, { skin: 'flat' });
    }
    // Dry leaf litter gathered at its foot.
    const litter = [x, 0.07, z], faces: number[] = [];
    for (let k = 0; k <= 8; k++) {
      litter.push(x + Math.sin((k / 8) * TAU) * reach * 0.5 * (0.85 + 0.3 * ((k * 5) % 3) / 2), 0, z + Math.cos((k / 8) * TAU) * reach * 0.4);
      if (k > 0) faces.push(0, k, k + 1);
    }
    s.mesh(litter, faces, [P.iron, P.pewter, P.burlap, P.burlapLight], { skin: 'scree', hints: litter.map((_, i) => (i % 3 === 1 ? 1 : 0)), light: 0.2, mottle: 0.5, cavity: 0.2 });
    s.shadowBlob(x, h * 0.4, z, reach * 0.6, h * 0.4, reach * 0.5);
  };
  shrub(-0.95, -0.35, 1.05, 1.5, 6);
  shrub(1.1, -0.2, 0.9, 1.2, 5);
  shrub(0.1, 0.9, 0.62, 0.8, 4);
  // Fallen leaves, ochre gone pale.
  for (let i = 0; i < 9; i++) {
    const x = s.rr(-1.8, 1.8), z = s.rr(-1.1, 1.3), a = s.rr(0, TAU), l = s.rr(0.1, 0.16);
    s.poly([[x - Math.cos(a) * l, 0.05, z - Math.sin(a) * l], [x + Math.sin(a) * l * 0.5, 0.07, z - Math.cos(a) * l * 0.5], [x + Math.cos(a) * l, 0.05, z + Math.sin(a) * l], [x - Math.sin(a) * l * 0.5, 0.06, z + Math.cos(a) * l * 0.5]], i % 3 ? P.burlap : P.sand, { toward: [0, 1, 0], skin: 'flat' });
  }
  return finish(s, 4, 3, 1.5);
}

export function greyDrift(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5125, detail);
  // A shallow drift of pale dust: a low dome with a ragged edge, thin at its rim.
  const sectors = detail < 1 ? 8 : 12, rings = [1, 0.62, 0.28];
  const points: number[] = [], shifts: number[] = [], hints: number[] = [], tris: number[] = [];
  for (const f of rings) for (let k = 0; k <= sectors; k++) {
    const a = (k / sectors) * TAU, edge = 1 + 0.14 * Math.sin(a * 3 + 2) + 0.08 * Math.sin(a * 7);
    points.push(Math.sin(a) * 1.5 * f * edge, f === 1 ? 0 : 0.11 * (1 - f * f) + 0.02 * Math.sin(a * 4 + f * 9), Math.cos(a) * f * edge);
    shifts.push(f === 1 ? -0.3 : 0.05 * Math.sin(a * 5));
    hints.push(0, 1, 0);
  }
  const top = points.length / 3;
  points.push(0.1, 0.12, -0.05);
  shifts.push(0.1);
  hints.push(0, 1, 0);
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < sectors; k++) {
    const a = i * (sectors + 1) + k, b = a + 1, c = a + sectors + 1, d = c + 1;
    tris.push(a, b, c, b, d, c);
  }
  for (let k = 0; k < sectors; k++) tris.push((rings.length - 1) * (sectors + 1) + k, (rings.length - 1) * (sectors + 1) + k + 1, top);
  s.mesh(points, tris, [P.iron, P.pewter, P.ash, P.pearl], { skin: 'mud', hints, shifts, light: 0.2, mottle: 0.4, cavity: 0.15 });
  // Dry leaves lying in it.
  for (let i = 0; i < 10; i++) {
    const x = s.rr(-1.15, 1.15), z = s.rr(-0.75, 0.75), a = s.rr(0, TAU), l = s.rr(0.09, 0.15), y = 0.11 * (1 - (x / 1.5) ** 2 - z ** 2) + 0.035;
    s.poly([[x - Math.cos(a) * l, y, z - Math.sin(a) * l], [x + Math.sin(a) * l * 0.5, y + 0.02, z - Math.cos(a) * l * 0.5], [x + Math.cos(a) * l, y, z + Math.sin(a) * l], [x - Math.sin(a) * l * 0.5, y + 0.01, z + Math.cos(a) * l * 0.5]], i % 3 ? P.burlap : P.sand, { toward: [0, 1, 0], skin: 'flat' });
  }
  return finish(s, 3, 2, 0.15);
}

export function greyDen(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5126, detail);
  const earth = [P.slate, P.iron, P.pewter, P.ash], lichen = [P.grassDark, P.straw, P.hay];
  // The hollow: a low vault of earth, open at the front, wide enough for a 2 x 2 walker.
  s.sweep([[0, 1, 2.15], [0, 1, 0.8], [0, 0.95, -0.8], [0, 0.7, -2.1]], [2.5, 2.56, 2.5, 2], earth, {
    sides: 20, steps: 2, squash: 0.8, bore: [1.92, 1.94, 1.86, 1.3], floor: 0, skin: 'mud', moss: 0.3, mossTone: lichen, key: 0.3, cavity: 0.5, innerTone: DARK_GREY, rimTone: earth,
  });
  // Earth banked up its sides and over its back, where it closes.
  const bank = (x: number, y: number, z: number, w: number, h: number, d: number, seat = true) =>
    s.rock(x, y, z, w, h, d, earth, { level: 2, planes: 3, lump: 0.2, seat, skin: 'mud', moss: 0.34, mossTone: lichen, key: 0.3, cavity: 0.45 });
  bank(-2.7, 0, -0.4, 2.4, 2, 4.4);
  bank(2.75, 0, -0.6, 2.3, 1.9, 4.2);
  bank(0, 0, -2.05, 5.2, 2.7, 1.7);
  bank(0.3, 2.1, -1.2, 4.4, 1, 3, false);
  s.rock(0, 0, -1.75, 3.6, 2.5, 1.3, DARK_GREY, { level: 1, planes: 0, skin: 'mud', light: 0.1, cavity: 0.5, shadow: false });
  // The fallen oak's roots: the great one over the top, two legs framing the mouth, a lintel between them.
  const roots: [Point[], number[]][] = [
    [[[3.3, 2.3, -1.6], [1.9, 2.84, -1], [0.2, 3, -0.3], [-1.6, 2.56, 0.3], [-2.9, 1.3, 1], [-3.8, -0.15, 1.5]], [0.6, 0.62, 0.5, 0.46, 0.42, 0.22]],
    [[[1.6, 2.9, -0.6], [1.94, 2.68, 1], [1.98, 1.3, 2.2], [2.35, -0.15, 2.8]], [0.46, 0.42, 0.36, 0.18]],
    [[[-0.2, 3, -0.1], [-1.64, 2.7, 1.4], [-1.96, 1.3, 2.3], [-2.25, -0.15, 2.8]], [0.44, 0.42, 0.34, 0.18]],
    [[[-1.64, 2.7, 1.3], [-0.7, 2.98, 1.9], [0.6, 3, 1.86], [1.94, 2.7, 1.1]], [0.32, 0.34, 0.34, 0.32]],
    [[[-1.6, 2.3, 0.4], [-2.6, 1.6, 1.6], [-2.95, 0.6, 2.3], [-3.2, -0.12, 2.75]], [0.36, 0.33, 0.26, 0.14]],
    [[[-2.9, 1.1, 1], [-3.4, 0.5, 1.9], [-3.75, -0.12, 2.4]], [0.3, 0.24, 0.12]],
    [[[-2.4, 1.8, 0.2], [-3.1, 1.1, -0.8], [-3.75, -0.12, -1.7]], [0.34, 0.28, 0.14]],
    [[[2.6, 2.6, -1.2], [3, 1.8, 0.2], [3.25, 0.7, 1.4], [3.6, -0.12, 2.1]], [0.42, 0.38, 0.28, 0.14]],
    [[[3.1, 2.3, -1.6], [3.55, 1.2, -1.5], [3.8, -0.12, -0.9]], [0.36, 0.3, 0.15]],
    [[[0.6, 2.8, -1.2], [0.2, 2.4, -2.3], [-0.4, 1.2, -2.7], [-0.8, -0.12, -2.8]], [0.4, 0.36, 0.28, 0.14]],
  ];
  for (const [path, radii] of roots) limb(s, path, radii, true, { sides: 8, steps: 3, cap: 'both', ribs: 5 });
  // Broken root ends standing up off the crown.
  limb(s, [[2.6, 2.7, -1.4], [3.2, 3.2, -1.2], [3.8, 3.36, -0.9]], [0.3, 0.2, 0.09], true, { sides: 6, floor: null });
  limb(s, [[3.2, 3.2, -1.2], [3.4, 3.4, -1.7]], [0.12, 0.05], true, { sides: 4, steps: 1, floor: null, ribs: 0 });
  limb(s, [[1.2, 3, -1], [1.45, 3.36, -1.6]], [0.26, 0.1], true, { sides: 6, steps: 2, floor: null });
  for (const [x, y, z, w, h] of [[-1, 2.9, 0.1, 1.2, 0.4], [1.6, 3, -0.9, 1, 0.36], [-2.8, 1.4, 0.9, 1, 0.4], [2.8, 2, 0, 0.9, 0.36]])
    s.rock(x, y, z, w, h, w * 0.8, lichen, { level: 1, planes: 0, lump: 0.25, seat: false, skin: 'moss', light: 0.4, cavity: 0.3, shadow: false });
  s.shadowBlob(-2.6, 1, -0.3, 1.5, 1.2, 2.4);
  s.shadowBlob(2.6, 1, -0.4, 1.5, 1.2, 2.4);
  s.shadowBox(0, 2.2, -0.6, 4.6, 0.9, 4);
  return finish(s, 8, 6, 3.5);
}

export function wrenCamp(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(5128, detail);
  const canvas = [P.burlapLight, P.sand, P.plaster, P.plasterLight, P.ivory], under = [P.burlapLight, P.sand, P.plaster];
  const stick = (a: Point, b: Point, r: number) => limb(s, [a, [(a[0] + b[0]) / 2 + 0.03, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + 0.02], b], [r, r * 0.9, r * 0.7], false, { sides: 6, steps: 1, cap: 'both', moss: 0, ribs: 3, floor: null });
  // Two pairs of forked sticks, lashed where they cross, and the ridge line between them.
  stick([-2.78, 0, 1.95], [-2.02, 2.4, 1.42], 0.09);
  stick([-1.86, 0, 1.75], [-2.62, 2.34, 1.5], 0.085);
  stick([1.92, 0, 1.62], [2.62, 2.4, 1.18], 0.09);
  stick([2.8, 0, 1.42], [2.08, 2.36, 1.26], 0.085);
  for (const [x, z] of [[-2.32, 1.52], [2.34, 1.27]]) s.lathe(x, 1.86, z, [[0.13, 0], [0.15, 0.08], [0.15, 0.2], [0.13, 0.28]], [P.burlap, P.burlapLight, P.sand], { sides: 7, skin: 'flat', cap: false });
  s.sweep([[-2.32, 2.02, 1.5], [0, 1.9, 1.42], [2.34, 2.04, 1.26]], [0.035, 0.035, 0.035], [P.burlap, P.burlapLight], { sides: 4, steps: 3, cap: 'none', skin: 'flat' });
  // The canvas: from the ridge down to pegs at the back, sagging between its edges, with a side wall to the left.
  const cols = detail < 1 ? 5 : 9, rows = detail < 1 ? 3 : 5;
  const sheet = (at: (u: number, v: number) => Point, n: number, m: number) => {
    const points: number[] = [], up: number[] = [], down: number[] = [], tris: number[] = [], back: number[] = [], shifts: number[] = [];
    for (let j = 0; j <= m; j++) for (let i = 0; i <= n; i++) {
      const p = at(i / n, j / m);
      points.push(...p);
      up.push(0, 1, -0.2);
      down.push(0, -1, 0.2);
      shifts.push(0.1 * Math.sin(i * 2.4 + j * 1.3));
    }
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
      tris.push(a, b, c, b, d, c);
      back.push(a, c, b, b, c, d);
    }
    s.mesh(points, tris, canvas, { skin: 'plaster', hints: up, shifts, light: 0.2, key: 0.3, mottle: 0.22, cavity: 0.2 });
    s.mesh(points.map((v, i) => (i % 3 === 1 ? v - 0.015 : v)), back, under, { skin: 'plaster', hints: down, light: 0, mottle: 0.2, cavity: 0.1 });
  };
  sheet((u, v) => {
    const x = -2.5 + 5 * u + (u - 0.5) * 0.7 * v, ridge = 2 - 0.14 * Math.sin(Math.PI * u), belly = 0.16 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u);
    return [x, ridge + (0.07 - ridge) * v - belly, 1.46 - 0.2 * u + (-2.35 - 1.46 + 0.2 * u) * v];
  }, cols, rows);
  sheet((u, v) => {
    // From the ridge's left end, fanning down to the ground between the back peg and the front peg.
    const gx = -2.85 - 0.1 * u, gz = -2.35 + 4.6 * u;
    return [-2.5 + (gx + 2.5) * v, 2 + (0.06 - 2) * v - 0.1 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u), 1.46 + (gz - 1.46) * v];
  }, 3, rows);
  // Pegs at its corners and a guy line to the front.
  for (const [x, z] of [[-2.9, -2.42], [2.92, -2.42], [-2.98, 2.3], [2.95, 2.3]]) s.lathe(x, 0, z, [[0.05, 0], [0.06, 0.22], [0.035, 0.26]], [P.wood, P.tan, P.clay], { sides: 5, skin: 'grain' });
  s.sweep([[2.34, 2, 1.27], [2.95, 0.2, 2.3]], [0.02, 0.02], [P.burlap, P.burlapLight], { sides: 4, steps: 1, cap: 'none', skin: 'flat' });
  // The bedroll on its blanket.
  s.roundBox(-0.55, 0, -0.15, 2.7, 0.07, 1.7, [P.iron, P.pewter, P.ash], { round: 0.03, wobble: 0.02, skin: 'plaster', light: 0.2 });
  s.sweep([[-1.6, 0.34, -0.35], [-0.65, 0.34, -0.33], [0.3, 0.34, -0.35]], [0.28, 0.29, 0.28], [P.burlap, P.burlapLight, P.sand, P.sandDark], { sides: 10, steps: 2, cap: 'both', skin: 'plaster', key: 0.35, cavity: 0.5 });
  for (const x of [-1.15, -0.15]) s.lathe(x, 0, 0, [[0.305, -0.05], [0.305, 0.05]], [P.bark, P.wood], { sides: 10, cap: false, skin: 'flat' });
  // The water bowl and the pack.
  s.lathe(0.5, 0, 1.05, [[0.2, 0], [0.34, 0.2], [0.3, 0.2], [0.24, 0.1]], [P.bark, P.wood, P.tan, P.clay], { sides: 10, cap: false, skin: 'grain', key: 0.3 });
  s.disc(0.5, 0.15, 1.05, 0.27, 10, P.sky, { skin: 'flat' });
  s.at(1.55, 0, 0.75, -0.3, () => {
    const leather = [P.bark, P.wood, P.tan, P.clay];
    s.roundBox(0, 0, 0, 0.78, 0.6, 0.46, leather, { round: 0.12, segments: 2, skin: 'plaster', key: 0.35, cavity: 0.5 });
    s.roundBox(0, 0.36, 0.03, 0.8, 0.3, 0.5, [P.wood, P.tan, P.clay, P.peach], { round: 0.1, skin: 'plaster', key: 0.35 });
    for (const x of [-0.2, 0.2]) {
      s.box(x, 0.12, 0.24, 0.09, 0.5, 0.05, P.bark, { bevel: 0.015, skin: 'flat' });
      s.box(x, 0.3, 0.28, 0.11, 0.08, 0.03, P.gold, { skin: 'flat' });
    }
    s.sweep([[-0.25, 0.62, -0.05], [0, 0.78, -0.08], [0.25, 0.62, -0.05]], [0.035, 0.035, 0.035], leather, { sides: 4, steps: 2, cap: 'none', skin: 'flat' });
  });
  s.shadowBox(0, 1, -0.4, 5, 0.1, 3.4);
  s.shadowBlob(-0.6, 0.25, -0.3, 1.1, 0.3, 0.4);
  s.shadowBlob(1.55, 0.3, 0.75, 0.4, 0.35, 0.3);
  return finish(s, 6, 5, 2.4);
}
