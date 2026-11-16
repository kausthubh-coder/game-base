// Pieces of a ruin of the Gardeners, the ancients who grew their halls from living roots and brass: the
// Shut Door, the Heartstone, a dead travel Gate, the hall's lamps, its mural, and broken pillars and a
// plinth to dress the court. The stone is pale and worn, the brass is the Root Fountain's, and the bright
// lume teal shows only on the variants where the old magic is awake.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape, type PolyOptions } from '../shape.ts';

type V3 = readonly [number, number, number];

const UP = [0, 1, 0] as const;
const TAU = Math.PI * 2;
const BRASS = [P.oak, P.ochre, P.gold];
const MOSS = [P.pine, P.moss, P.leaf];
const LUME = [P.lumeDeep, P.lume, P.lumeLight];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * A root through these points, `r0` thick at its thickest and thin at its ends. `thick` says how far along
 * that is: 0 for a root that comes down from above, where its thick end is out of sight. `round` bends it
 * through one more point in each stretch, so a long root does not turn in corners.
 */
function root(s: Shape, path: readonly V3[], r0: number, o: { sides?: number; thick?: number; round?: boolean } = {}): void {
  const pts: V3[] = [];
  path.forEach((p, i) => {
    pts.push(p);
    if (!o.round || i === path.length - 1) return;
    // The point halfway along the curve through the four points around this stretch.
    const before = path[Math.max(0, i - 1)], next = path[i + 1], after = path[Math.min(path.length - 1, i + 2)];
    pts.push([0, 1, 2].map((k) => (9 * (p[k] + next[k]) - before[k] - after[k]) / 16) as unknown as V3);
  });
  const thick = o.thick ?? 0.3, last = pts.length - 1;
  const radii = pts.map((_, i) => {
    const t = i / last;
    return r0 * (t < thick ? 0.4 + 0.6 * t / thick : 1 - 0.7 * (t - thick) / (1 - thick));
  });
  s.tube(pts, radii, o.sides ?? 5, RAMP.bark, { cap: 'both' });
}

/** A soft mound of moss. With `floor` it lies on the ground. */
function moss(s: Shape, x: number, y: number, z: number, rx: number, ry: number, rz: number, floor?: number): void {
  s.blob(x, y, z, rx, ry, rz, MOSS, { sides: 6, rings: 2, jitter: 0.14, noise: 0.25, floor });
}

/**
 * A strip of flat faces between two ellipses round the y axis, from angle a0 to a1 in n steps. `lo` and
 * `hi` are each [y, reach along x, reach along z]. `out` says which way the faces look: 1 away from the
 * axis, 0 up. The tones take turns face by face, so brass reads as beaten, not turned.
 */
function band(s: Shape, a0: number, a1: number, n: number, lo: V3, hi: V3, tones: readonly number[], out: number, o: PolyOptions = {}): void {
  const at = (a: number, e: V3): V3 => [Math.cos(a) * e[1], e[0], Math.sin(a) * e[2]];
  for (let k = 0; k < n; k++) {
    const b0 = a0 + (a1 - a0) * k / n, b1 = a0 + (a1 - a0) * (k + 1) / n, bm = (b0 + b1) / 2;
    s.poly([at(b0, lo), at(b1, lo), at(b1, hi), at(b0, hi)], tones[k % tones.length], { ...o, toward: out === 0 ? UP : [Math.cos(bm), 0, Math.sin(bm)] });
  }
}

/**
 * The Shut Door: two leaves of pale stone, three meters wide and a little over three high with their frame,
 * with roots grown over the frame. The round relief across the leaves holds a ring of seven points, one of
 * them chipped out. Its middle is the middle of the doorway and of the frame's depth. Variants: shut, and
 * open, with both leaves swung in toward -z to leave a gap two meters wide. The open leaves reach one meter
 * behind the frame.
 */
export function shutDoor(variant: number): THREE.BufferGeometry {
  // One seed for both, so it is the same frame, roots and moss shut or open.
  const s = new Shape(2101);
  const open = variant === 1;
  // The frame: two jambs on wider feet, the lintel and its cornice, and a line of brass across the lintel.
  for (const side of [-1, 1]) {
    s.box(side * 1.25, 0, 0, 0.48, 2.9, 0.6, P.ash, { bevel: 0.05, skip: '-y', grade: 0.24 });
    s.box(side * 1.25, 0, 0.05, 0.53, 0.3, 0.72, RAMP.stone[4], { skip: '-y', top: P.ash });
    // A carved groove down its face.
    s.poly([[side * 1.21, 0.5, 0.304], [side * 1.29, 0.5, 0.304], [side * 1.29, 2.66, 0.304], [side * 1.21, 2.66, 0.304]], RAMP.stone[2], { toward: [0, 0, 1] });
    s.shadowBox(side * 1.25, 0, 0, 0.48, 2.9, 0.6);
  }
  s.box(0, 2.9, 0.01, 3, 0.36, 0.64, P.ash, { bevel: 0.05, grade: 0.2 });
  s.box(0, 3.26, 0.04, 3, 0.14, 0.74, RAMP.stone[4], { top: P.pearl });
  s.box(0, 3.03, 0.335, 2.2, 0.07, 0.03, P.ochre, { skip: '-z' });
  s.box(0, 0, 0.02, 2.04, 0.06, 0.66, RAMP.stone[3], { skip: '-y' });
  s.shadowBox(0, 2.9, 0, 3, 0.5, 0.68);
  // Roots from the hill above: one over the lintel and down each jamb, and a thin one that hangs inside the frame.
  root(s, [[-1.05, 3.3, -0.38], [-1.18, 3.52, 0.02], [-1.32, 3.34, 0.42], [-1.47, 2.5, 0.38], [-1.4, 1.5, 0.36], [-1.58, 0.6, 0.42], [-1.9, 0.07, 0.62]], 0.2, { sides: 4, thick: 0, round: true });
  root(s, [[0.45, 3.3, -0.38], [0.6, 3.5, 0.04], [0.86, 3.3, 0.43], [1.3, 2.72, 0.4], [1.24, 1.7, 0.36], [1.46, 0.75, 0.42], [1.8, 0.07, 0.62]], 0.17, { thick: 0 });
  root(s, [[-0.5, 3, 0.3], [-0.8, 2.55, 0.34], [-0.95, 2.05, 0.31], [-0.93, 1.65, 0.3]], 0.07, { sides: 3, thick: 0 });
  moss(s, -0.3, 3.4, 0.1, 0.42, 0.13, 0.3);
  moss(s, 1.25, 3.41, 0, 0.22, 0.1, 0.22);
  moss(s, 1.5, 0.04, 0.62, 0.34, 0.15, 0.26, 0);

  // The leaves. Each hangs from the inside of its jamb and swings in to lie along the passage wall.
  const cx = 0, cy = 1.66, R = 0.74, front = 0.03, back = -0.02;
  for (const side of [-1, 1]) {
    s.at(side, 0, 0, open ? -side * Math.PI / 2 : 0, () => {
      // From the doorway's middle to this leaf's hinge.
      const lx = (x: number) => x - side;
      s.box(lx(side * 0.5), 0.06, -0.12, 0.97, 2.82, 0.2, P.pearl, { grade: 0.22 });
      // The dark line of the seam, down the edge that meets the other leaf.
      s.poly([[lx(side * 0.015), 0.06, back + 0.004], [lx(side * 0.055), 0.06, back + 0.004], [lx(side * 0.055), 2.88, back + 0.004], [lx(side * 0.015), 2.88, back + 0.004]], RAMP.stone[1], { toward: [0, 0, 1] });
      // Half of the round relief, with its sloping edge.
      const a0 = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      const arc = (r: number, z: number): V3[] => [0, 1, 2, 3, 4, 5, 6].map((i) => [lx(cx + Math.cos(a0 + Math.PI * i / 6) * r), cy + Math.sin(a0 + Math.PI * i / 6) * r, z]);
      const face = arc(R, front), edge = arc(R + 0.04, back);
      s.poly(face, P.ash, { toward: [0, 0, 1] });
      s.poly([[lx(0), cy - R, front + 0.004], [lx(side * 0.03), cy - R, front + 0.004], [lx(side * 0.03), cy + R, front + 0.004], [lx(0), cy + R, front + 0.004]], RAMP.stone[1], { toward: [0, 0, 1] });
      for (let i = 0; i < 6; i++) {
        const am = a0 + Math.PI * (i + 0.5) / 6;
        s.poly([face[i], face[i + 1], edge[i + 1], edge[i]], RAMP.stone[4], { toward: [Math.cos(am), Math.sin(am), 0.5] });
      }
      // The seven points, none of them on the seam. The seventh is a pit where one was chipped out.
      for (let k = 0; k < 7; k++) {
        const a = (102 + k * 360 / 7) * Math.PI / 180;
        const x = cx + Math.cos(a) * 0.5, y = cy + Math.sin(a) * 0.5;
        if (Math.sign(x) !== side) continue;
        if (k < 6) s.at(lx(x), y, front, { rx: Math.PI / 2 }, () => s.cone(0, 0, 0, 0.095, 0.07, 4, P.gold));
        else {
          const jag = [[0.16, 0.02], [0.06, 0.14], [-0.08, 0.12], [-0.16, -0.01], [-0.05, -0.15], [0.1, -0.11]];
          s.poly(jag.map(([dx, dy]): V3 => [lx(x) + dx, y + dy, front + 0.004]), RAMP.stone[4], { toward: [0, 0, 1] });
          s.poly(jag.map(([dx, dy]): V3 => [lx(x) + dx * 0.62 + 0.01, y + dy * 0.62 - 0.012, front + 0.008]), RAMP.stone[0], { toward: [0, 0, 1] });
        }
      }
    });
    if (open) s.shadowBox(side * 1.12, 0, -0.5, 0.2, 2.88, 0.97);
  }
  if (!open) s.shadowBox(0, 0, -0.12, 1.96, 2.88, 0.2);
  return s.done();
}

/**
 * The Heartstone: a rough egg of stone as big as a cart, in a low brass cradle whose rim has seven notches.
 * Its cracks show how alive the land is. Variants: dull (the cracks are dark), faint (a thin glow of lume in
 * them), glowing (the cracks are wide and bright).
 */
export function heartstone(variant: number): THREE.BufferGeometry {
  // One seed for all three, so it is the same stone dull or awake.
  const s = new Shape(2111);
  // The cradle: a foot, a low band, and a rim cut by seven notches. A notch faces the front.
  band(s, 0, TAU, 14, [0, 1.04, 0.74], [0.14, 0.96, 0.66], [P.oak, P.oakDark], 1);
  band(s, 0, TAU, 14, [0.14, 0.96, 0.66], [0.3, 1, 0.7], [P.ochre, P.oak], 1);
  band(s, 0, TAU, 14, [0.3, 0.5, 0.32], [0.3, 1, 0.7], [P.oakDark], 0);
  for (let k = 0; k < 7; k++) {
    const a0 = Math.PI / 2 + k * TAU / 7 + 0.11, a1 = Math.PI / 2 + (k + 1) * TAU / 7 - 0.11;
    band(s, a0, a1, 2, [0.3, 1, 0.7], [0.43, 1, 0.7], [P.ochre, P.gold], 1);
    band(s, a0, a1, 2, [0.43, 0.8, 0.52], [0.43, 1, 0.7], [P.gold, P.butter], 0);
    for (const [a, way] of [[a0, 1], [a1, -1]] as const) {
      const c = Math.cos(a), z = Math.sin(a);
      s.poly([[c * 0.8, 0.3, z * 0.52], [c, 0.3, z * 0.7], [c, 0.43, z * 0.7], [c * 0.8, 0.43, z * 0.52]], P.oak, { toward: [z * way, 0, -c * way] });
    }
  }

  // The stone: rings of points round an egg that is widest low down, each a little off its place.
  const n = 9;
  const pts: V3[] = [[0.04, 1.8, -0.02]];
  [28, 58, 90, 122, 150].forEach((degrees, row) => {
    const phi = degrees * Math.PI / 180, wide = Math.sin(phi) * (1 - 0.2 * Math.cos(phi));
    for (let j = 0; j < n; j++) {
      // Every second ring is turned half a step, as a blob's are.
      const a = (((row + 1) % 2) * 0.5 + j) / n * TAU, reach = s.rr(0.93, 1.07);
      pts.push([Math.cos(a) * wide * 1.06 * reach, 0.95 + Math.cos(phi) * (degrees < 90 ? 0.85 : 0.75) * s.rr(0.96, 1.04), Math.sin(a) * wide * 0.68 * reach]);
    }
  });
  const at = (row: number, j: number) => 1 + row * n + (j + n) % n;
  const faces: [number, number, number][] = [];
  for (let j = 0; j < n; j++) faces.push([0, at(0, j), at(0, j + 1)]);
  for (let row = 0; row < 4; row++) {
    for (let j = 0; j < n; j++) {
      if (row % 2 === 0) faces.push([at(row, j), at(row + 1, j), at(row + 1, j + 1)], [at(row, j), at(row + 1, j + 1), at(row, j + 1)]);
      else faces.push([at(row + 1, j), at(row, j), at(row, j + 1)], [at(row + 1, j), at(row, j + 1), at(row + 1, j + 1)]);
    }
  }
  const normals = faces.map(([a, b, c]) => {
    const normal = unit(cross(sub(pts[b], pts[a]), sub(pts[c], pts[a])));
    return dot(normal, sub(pts[a], [0, 0.95, 0])) < 0 ? sub([0, 0, 0], normal) : normal;
  });
  faces.forEach((face, i) => {
    // Faces that look up are lighter, as on a rock.
    const tone = RAMP.stone[Math.max(0, Math.min(4, Math.floor((0.5 + 0.45 * normals[i][1] + s.rr(-0.12, 0.12)) * 5)))];
    s.poly(face.map((p) => pts[p]), tone, { toward: normals[i] });
  });

  // A crack runs along the edges between faces: a thin strip on the face each side of every edge.
  const crack = (chain: readonly number[], half: number, tone: number, glow: number, lift: number) => {
    for (let i = 0; i < chain.length - 1; i++) {
      const a = pts[chain[i]], b = pts[chain[i + 1]], along = unit(sub(b, a));
      faces.forEach((face, fi) => {
        if (!face.includes(chain[i]) || !face.includes(chain[i + 1])) return;
        const third = sub(pts[face.find((p) => p !== chain[i] && p !== chain[i + 1]) as number], a);
        const reach = dot(third, along);
        const into = unit([third[0] - along[0] * reach, third[1] - along[1] * reach, third[2] - along[2] * reach]);
        const normal = normals[fi];
        const p = (from: V3, inward: number, slide: number): V3 => [0, 1, 2].map((k) => from[k] + into[k] * inward + along[k] * slide + normal[k] * lift) as unknown as V3;
        s.poly([p(a, 0, 0), p(b, 0, 0), p(b, half, -half * 0.6), p(a, half, half * 0.6)], tone, { glow, toward: normal });
      });
    }
  };
  const cracks = [
    [0, at(0, 1), at(1, 2), at(2, 1), at(3, 2), at(4, 1)],
    [at(1, 2), at(1, 1), at(2, 0), at(3, 0)],
    [0, at(0, 3), at(1, 3), at(2, 3), at(3, 4)],
    [at(2, 1), at(2, 2), at(3, 3)],
    [0, at(0, 6), at(1, 7), at(2, 7)],
  ];
  for (const chain of cracks) {
    if (variant === 0) crack(chain, 0.024, P.ink, 0, 0.01);
    else if (variant === 1) crack(chain, 0.032, P.lumeDeep, 2, 0.01);
    else {
      crack(chain, 0.055, P.lume, 2, 0.01);
      crack(chain, 0.02, P.lumeLight, 2, 0.018);
    }
  }
  if (variant > 0) s.light(0, 1, 0);

  // Four brass roots rise from the rim and hold the stone.
  for (const degrees of [38, 142, 218, 322]) {
    const c = Math.cos(degrees * Math.PI / 180), z = Math.sin(degrees * Math.PI / 180);
    s.tube([[c * 0.95, 0.36, z * 0.66], [c * 1.13, 0.66, z * 0.755], [c * 1.1, 1, z * 0.725]], [0.1, 0.085, 0.05], 5, BRASS, { cap: 'end' });
  }
  moss(s, -0.92, 0.04, 0.6, 0.34, 0.15, 0.24, 0);
  moss(s, 1.02, 0.04, 0.36, 0.24, 0.12, 0.2, 0);
  s.shadowBlob(0, 0.95, 0, 1, 0.8, 0.65);
  return s.done();
}

/**
 * A travel Gate: a freestanding arch of seven stones on two piers, three meters wide and four high, with a
 * line of brass inlaid round both faces and roots at its feet. A person walks through it along z. The inside
 * rim is a channel that lume ran in. Variants: dead, where it is dark, and awake, where it glows.
 */
export function gateArch(variant: number): THREE.BufferGeometry {
  // One seed for both, so it is the same arch dead or awake.
  const s = new Shape(2121);
  const awake = variant === 1;
  const rim = awake ? P.lume : P.tealDeep, glow = awake ? 2 : 0;
  // The arch springs at Y. R0 is the opening, RIM the edge of the channel round it, R1 the outside. Z is half its depth.
  const Y = 2.5, R0 = 0.95, RIM = 1.1, R1 = 1.45, Z = 0.35, LINE = Z + 0.012;
  /** One stone of the gate, between two cuts across it. Each cut gives the point at a distance from the opening's middle line. */
  const stone = (cut0: (r: number, z: number) => V3, cut1: (r: number, z: number) => V3, tone: number, out: V3) => {
    s.poly([cut0(R1, Z), cut1(R1, Z), cut1(R1, -Z), cut0(R1, -Z)], tone, { toward: out });
    s.poly([cut0(R0, Z), cut1(R0, Z), cut1(R0, -Z), cut0(R0, -Z)], rim, { glow, toward: [-out[0], -out[1], 0] });
    for (const f of [1, -1]) {
      s.poly([cut0(RIM, f * Z), cut0(R1, f * Z), cut1(R1, f * Z), cut1(RIM, f * Z)], tone, { toward: [0, 0, f] });
      s.poly([cut0(R0, f * Z), cut0(RIM, f * Z), cut1(RIM, f * Z), cut1(R0, f * Z)], rim, { glow, toward: [0, 0, f] });
      s.poly([cut0(1.25, f * LINE), cut0(1.31, f * LINE), cut1(1.31, f * LINE), cut1(1.25, f * LINE)], P.ochre, { toward: [0, 0, f] });
    }
  };
  for (const side of [-1, 1]) {
    s.box(side * 1.2, 0, 0, 0.6, 0.3, 0.86, RAMP.stone[3], { bevel: 0.05, skip: '-y', top: RAMP.stone[4] });
    // Two stones to a pier.
    const level = (y: number) => (r: number, z: number): V3 => [side * r, y, z];
    stone(level(0.3), level(1.4), RAMP.stone[4], [side, 0, 0]);
    stone(level(1.4), level(Y), P.ash, [side, 0, 0]);
    s.shadowBox(side * 1.2, 0, 0, 0.5, 2.6, 0.7);
  }
  for (let i = 0; i < 7; i++) {
    const spoke = (a: number) => (r: number, z: number): V3 => [Math.cos(a) * r, Y + Math.sin(a) * r, z];
    const am = Math.PI * (i + 0.5) / 7;
    stone(spoke(Math.PI * i / 7), spoke(Math.PI * (i + 1) / 7), i % 2 ? P.ash : RAMP.stone[4], [Math.cos(am), Math.sin(am), 0]);
  }
  // The keystone, with a point of brass on each face.
  s.box(0, Y + R1 - 0.2, 0, 0.5, 0.25, 0.8, P.pearl, { bevel: 0.03 });
  for (const f of [1, -1]) s.at(0, Y + R1 - 0.09, f * 0.4, { rx: f * Math.PI / 2 }, () => s.cone(0, 0, 0, 0.085, 0.05, 4, P.gold));
  s.shadowBox(0, 3.3, 0, 2.2, 0.65, 0.7);
  if (awake) s.light(0, 2.3, 0);

  // Roots at its feet, none of them across the way through.
  root(s, [[-2.05, 0.04, 0.95], [-1.74, 0.09, 0.6], [-1.48, 0.42, 0.42], [-1.4, 1.02, 0.38], [-1.31, 1.7, 0.37]], 0.15, { sides: 4, round: true });
  root(s, [[1.86, 0.04, 1], [1.6, 0.08, 0.64], [1.36, 0.36, 0.43], [1.3, 0.85, 0.38], [1.4, 1.35, 0.37]], 0.13, { sides: 4, round: true });
  root(s, [[1.96, 0.05, -0.62], [1.58, 0.2, -0.45], [1.4, 1, -0.37]], 0.12, { sides: 4 });
  moss(s, -0.95, 3.58, 0, 0.34, 0.12, 0.3);
  moss(s, 1.26, 0.28, 0.24, 0.26, 0.1, 0.2);
  moss(s, -1.42, 0.04, -0.5, 0.3, 0.14, 0.24, 0);
  return s.done();
}

/**
 * A lamp of the hall: a slim stone post with a round glass in a brass cage. Variants: dark, and lit with lume.
 */
export function hallLamp(variant: number): THREE.BufferGeometry {
  // One seed for both, so it is the same lamp dark or lit.
  const s = new Shape(2131);
  const lit = variant === 1;
  s.box(0, 0, 0, 0.4, 0.16, 0.4, RAMP.stone[4], { bevel: 0.04, skip: '-y', top: P.ash });
  s.cyl(0, 0.16, 0, 0.1, 0.075, 0.9, 6, [RAMP.stone[4], P.ash, P.pearl], { cap: 'none', flat: true });
  s.cyl(0, 1.06, 0, 0.13, 0.16, 0.07, 6, BRASS, { flat: true });
  s.blob(0, 1.31, 0, 0.17, 0.19, 0.17, lit ? LUME : [P.pineDeep, P.tealDeep, P.tealDark], { sides: 8, rings: 3, jitter: 0.02, glow: lit ? 2 : 0 });
  // The cage: four ribs that meet over the glass, under a point.
  for (let k = 0; k < 4; k++) {
    const a = k * TAU / 4 + Math.PI / 4, c = Math.cos(a), z = Math.sin(a);
    s.tube([[c * 0.15, 1.13, z * 0.15], [c * 0.23, 1.31, z * 0.23], [c * 0.14, 1.49, z * 0.14], [0, 1.55, 0]], [0.028, 0.028, 0.028, 0.026], 3, BRASS, { cap: 'none' });
  }
  s.cone(0, 1.53, 0, 0.06, 0.1, 4, P.gold);
  if (lit) s.light(0, 1.31, 0);
  moss(s, 0.17, 0.03, 0.15, 0.16, 0.09, 0.14, 0);
  s.shadowBox(0, 0, 0, 0.2, 1.5, 0.2);
  return s.done();
}

/**
 * A simple raised figure on a wall that faces +z: a robe that narrows to the shoulders, and a head.
 * Its feet are at y. It returns the height of the top of its head.
 */
function figure(s: Shape, x: number, y: number, z: number, wide: number, tall: number, tone: number): number {
  const deep = 0.08, body = tall * 0.78, head = wide * 0.55;
  const b0 = x - wide / 2, b1 = x + wide / 2, t0 = x - wide * 0.36, t1 = x + wide * 0.36, top = y + body;
  s.poly([[b0, y, z + deep], [b1, y, z + deep], [t1, top, z + deep], [t0, top, z + deep]], tone, { toward: [0, 0, 1], grade: 0.14 });
  s.poly([[b0, y, z], [b0, y, z + deep], [t0, top, z + deep], [t0, top, z]], tone, { toward: [-1, 0, 0] });
  s.poly([[b1, y, z], [b1, y, z + deep], [t1, top, z + deep], [t1, top, z]], tone, { toward: [1, 0, 0] });
  s.poly([[t0, top, z], [t1, top, z], [t1, top, z + deep], [t0, top, z + deep]], tone, { toward: UP });
  s.box(x, top + tall * 0.02, z + deep / 2, head, head, deep, tone, { skip: '-z' });
  return top + tall * 0.02 + head;
}

/**
 * The mural: a standing slab with eight raised figures in a row. Seven companions walk toward a taller,
 * crowned king at the right. The seventh, the one beside the king, was chiselled away: a rough dark scar
 * with the stub of its feet and the chips under it.
 */
export function muralSlab(): THREE.BufferGeometry {
  const s = new Shape(2141);
  const wall = 0.2, feet = 0.44;
  s.box(0, 0, 0, 4, 2.6, 0.4, RAMP.stone[3], { bevel: 0.06, skip: '-y', grade: 0.2, top: P.ash });
  // The ledge the figures stand on, and a band over their heads.
  s.box(0, 0.34, wall + 0.03, 3.8, 0.1, 0.1, RAMP.stone[4], { skip: '-z', top: P.ash });
  s.box(0, 2.32, wall + 0.02, 3.8, 0.12, 0.06, RAMP.stone[4], { skip: '-z', top: P.ash });
  const place = (slot: number) => -1.575 + 0.45 * slot;
  for (let slot = 0; slot < 6; slot++) figure(s, place(slot), feet, wall, 0.32, 1.2, P.pearl);
  // The king, and his crown of brass.
  const king = place(7);
  const brow = figure(s, king, feet, wall, 0.44, 1.62, P.pearl);
  s.box(king, brow, wall + 0.05, 0.32, 0.07, 0.1, P.gold, { skip: '-z' });
  for (const dx of [-0.11, 0, 0.11]) s.cone(king + dx, brow + 0.07, wall + 0.05, 0.055, 0.13, 4, P.gold);
  // The seventh: the scar, three strokes of the chisel across it, and what is left of the feet.
  const gone = place(6), mark = wall + 0.006;
  const scar = [[-0.02, 0.6], [-0.23, 0.04], [0.21, 0], [0.24, 0.42], [0.15, 0.92], [0.17, 1.02], [0.1, 1.2], [-0.1, 1.23], [-0.16, 1.04], [-0.13, 0.91], [-0.25, 0.46]];
  s.poly(scar.map(([dx, dy]): V3 => [gone + dx, feet + dy, mark]), RAMP.stone[0], { toward: [0, 0, 1] });
  for (const [dx, dy] of [[-0.01, 0.96], [0.03, 0.68], [-0.04, 0.4]]) {
    s.poly([[gone + dx - 0.15, feet + dy - 0.09, mark * 1.03], [gone + dx - 0.12, feet + dy - 0.13, mark * 1.03], [gone + dx + 0.15, feet + dy + 0.09, mark * 1.03], [gone + dx + 0.12, feet + dy + 0.13, mark * 1.03]], P.ash, { toward: [0, 0, 1] });
  }
  const stub = wall + 0.08;
  s.poly([[gone - 0.16, feet, stub], [gone + 0.16, feet, stub], [gone + 0.14, feet + 0.1, stub], [gone + 0.03, feet + 0.17, stub], [gone - 0.06, feet + 0.09, stub], [gone - 0.15, feet + 0.14, stub]], P.pearl, { toward: [0, 0, 1] });
  s.poly([[gone - 0.15, feet + 0.14, wall], [gone + 0.14, feet + 0.1, wall], [gone + 0.14, feet + 0.1, stub], [gone - 0.15, feet + 0.14, stub]], P.ash, { toward: UP });
  for (const side of [-1, 1]) s.poly([[gone + side * 0.16, feet, wall], [gone + side * 0.16, feet, stub], [gone + side * 0.15, feet + 0.12, stub], [gone + side * 0.15, feet + 0.12, wall]], P.ash, { toward: [side, 0, 0] });
  s.blob(gone - 0.12, 0.05, wall + 0.24, 0.11, 0.08, 0.09, [RAMP.stone[4], P.ash, P.pearl], { sides: 5, rings: 1, jitter: 0.25, floor: 0 });
  s.blob(gone + 0.2, 0.04, wall + 0.34, 0.08, 0.06, 0.07, [RAMP.stone[4], P.ash, P.pearl], { sides: 5, rings: 1, jitter: 0.25, floor: 0 });
  // A root up its left edge, and moss along its top.
  root(s, [[-2.08, 0.05, 0.66], [-1.96, 0.3, 0.36], [-1.9, 1.2, 0.26], [-1.84, 2.1, 0.25], [-1.6, 2.62, 0.16], [-1.05, 2.68, 0.02]], 0.12, { sides: 4, round: true });
  moss(s, -0.5, 2.6, 0, 0.5, 0.1, 0.22);
  moss(s, 1.35, 2.6, 0.02, 0.36, 0.09, 0.2);
  moss(s, -1.3, 0.04, 0.34, 0.3, 0.13, 0.2, 0);
  s.shadowBox(0, 0, 0, 4, 2.6, 0.4);
  return s.done();
}

/**
 * A broken pillar of stone drums on a square foot, capped with moss, with a root or two up it.
 * Variants: stump, waist high, and tall and leaning a little.
 */
export function ruinPillar(variant: number): THREE.BufferGeometry {
  const s = new Shape(2151 + variant);
  const drums = [1, 2, 4][variant], each = [0.36, 0.42, 0.57][variant];
  s.box(0, 0, 0, 0.84, 0.2, 0.84, RAMP.stone[3], { bevel: 0.05, skip: '-y', top: RAMP.stone[4] });
  // Everything above the foot leans with the shaft. Heights in here are from the foot's top.
  s.at(0, 0.2, 0, { rz: variant === 2 ? 0.07 : 0 }, () => {
    const top = drums * each;
    for (let i = 0; i < drums - 1; i++) {
      s.cyl(0, i * each, 0, 0.31 - i * 0.008, 0.3 - i * 0.008, each, 8, i % 2 ? P.ash : RAMP.stone[4], { flat: true, turn: i * 0.3 });
    }
    // The last drum broke off on a slant.
    const r = 0.31 - (drums - 1) * 0.008;
    s.tube([[0, top - each, 0], [0, top - 0.14, 0], [0.06, top, 0.03]], [r, r - 0.01, r * 0.88], 8, drums % 2 ? RAMP.stone[4] : P.ash, { capTone: RAMP.stone[2], flat: true, turn: (drums - 1) * 0.3 });
    moss(s, 0.03, top - 0.02, 0.02, 0.36, 0.13, 0.34);
    // A root from the ground winds up the shaft.
    const wind = (turns: readonly [number, number][]): V3[] => turns.map(([degrees, y]): V3 => [Math.cos(degrees * Math.PI / 180) * 0.35, y, Math.sin(degrees * Math.PI / 180) * 0.35]);
    if (variant === 0) root(s, [[0.8, -0.15, 0.56], [0.48, 0.03, 0.42], ...wind([[52, 0.22]])], 0.09, { sides: 4 });
    else if (variant === 1) root(s, [[0.84, -0.15, 0.52], [0.5, 0.03, 0.4], ...wind([[45, 0.34], [100, 0.68]])], 0.1, { sides: 4, round: true });
    else {
      root(s, [[0.86, -0.15, 0.52], [0.5, 0.03, 0.4], ...wind([[45, 0.5], [110, 1.1], [175, 1.7]])], 0.11, { sides: 4, round: true });
      root(s, [[-0.8, -0.15, 0.4], [-0.48, 0.03, 0.32], ...wind([[150, 0.3], [110, 0.62]])], 0.08, { sides: 4 });
    }
    s.shadowBox(0, -0.2, 0, 0.6, top + 0.2, 0.6);
  });
  // What fell: a drum on its side by the stump, a broken stone by the others.
  if (variant === 0) s.at(-0.78, 0.27, 0.2, { ry: 0.5, rz: Math.PI / 2 }, () => s.cyl(0, -0.19, 0, 0.29, 0.28, 0.38, 8, P.ash, { cap: 'both', capTone: RAMP.stone[2], flat: true }));
  else s.blob(-0.62, 0.07, 0.42, 0.2, 0.15, 0.17, RAMP.stone, { sides: 5, rings: 2, jitter: 0.25, floor: 0 });
  return s.done();
}

/**
 * A low round plinth, a meter across, with a ring of brass set in its top: where a small beast sleeps.
 */
export function plinth(): THREE.BufferGeometry {
  const s = new Shape(2161);
  s.cyl(0, 0, 0, 0.5, 0.48, 0.12, 10, RAMP.stone[3], { capTone: RAMP.stone[4], flat: true });
  s.cyl(0, 0.12, 0, 0.44, 0.43, 0.2, 10, [RAMP.stone[3], RAMP.stone[4], P.ash], { cap: 'none', flat: true });
  s.cyl(0, 0.32, 0, 0.5, 0.49, 0.08, 10, P.ash, { capTone: P.pearl, flat: true });
  // The ring, and the worn place inside it.
  band(s, 0, TAU, 10, [0.405, 0.27, 0.27], [0.405, 0.37, 0.37], [P.gold], 0);
  s.disc(0, 0.403, 0, 0.27, 10, P.ash);
  moss(s, 0.4, 0.03, 0.32, 0.2, 0.1, 0.16, 0);
  s.shadowBox(0, 0, 0, 0.9, 0.4, 0.9);
  return s.done();
}
