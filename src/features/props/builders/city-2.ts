// act1-city-models: what makes Hollowmere read as a city from outside. The river bridge, the gateway and its low
// wall, the goods of the market stalls, and the skyline's bell tower and back rows of roofs. Sheets:
// assets-src/concept/region-hollowmere (vista-wide, vista-street, vista-marketday, vista-night, kit-street) and
// assets-src/concept/goods. Every key, size, variant and join is the one the world already places
// (CITY_OUTSIDE in src/game/content/greenhollow.ts): only what is drawn inside them changes here.
import { Color, type BufferGeometry } from 'three';
import * as A from '../arch.ts';
import { P, RAMP } from '../palette.ts';
import { Shape, type MeshOptions, type Skin, type Tone } from '../shape.ts';

type V3 = readonly [number, number, number];
type XY = readonly [number, number];

const fine = (s: Shape): boolean => s.detail >= 0.75;
const [H0, H1, H2, H3] = A.HEARTH;
/** The stones a mason dresses finer and that catch the light: voussoirs, copings, caps, quoins. */
const DRESSED = [H1, H2, H3, P.plasterLight] as const;
/** Stone in shade and damp: a soffit, the inside of a passage, the bed under paving. */
const DAMP = [P.slate, P.iron, H0, H1] as const;
const IRON = [P.night, P.slate, P.iron] as const;
/** The inside of a belfry or a passage, where no sun comes. */
const GLOOM = [P.night, P.slate, P.iron, H0] as const;
/** The queen's colours: saffron cloth with a cream wheat sprig. */
const SAFFRON = [P.oak, P.ochre, P.gold, P.gold] as const;
const CREAM = [P.sand, P.plaster, P.plasterLight] as const;
const AMBER = [P.gold, P.lamp, P.lampHot] as const;

// ---------------------------------------------------------------- shared forms

/** One flat face through these points, shaded as the soft forms are. */
function face(s: Shape, p: readonly V3[], toward: V3, tone: Tone, o: MeshOptions = {}): void {
  const tris: number[] = [];
  for (let k = 1; k < p.length - 1; k++) tris.push(0, k, k + 1);
  s.mesh(p.flat(), tris, tone, { smooth: false, light: 0.2, mottle: 0.2, cavity: 0.3, ...o, hints: p.flatMap(() => toward) });
}

interface Cut {
  /** How long each stone is. Default 1.3. */
  stone?: number;
  /** How far one stone's shade moves from the next. Default 0.16. */
  vary?: number;
  skin?: Skin;
  moss?: number;
}

/** The middle of a profile, so each of its faces knows which way is out. */
function middle(profile: readonly XY[]): XY {
  let q = 0, u = 0;
  for (const p of profile) { q += p[0] / profile.length; u += p[1] / profile.length; }
  return [q, u];
}

const DRESS: MeshOptions = { crease: 0.5, light: 0.25, key: 0.3, mottle: 0.14, cavity: 0.4 };

/**
 * A moulding: `profile` ([out, up] from the line a to b, `out` the level way it faces) carried along the line and
 * cut into stones, each its own shade. Its ends lie exactly in the planes at a and b, so two runs meet with no gap
 * and no doubled part; `caps` closes an end that shows. 2 triangles a profile edge a stone.
 */
function moulding(s: Shape, a: V3, b: V3, out: V3, profile: readonly XY[], tone: Tone, o: Cut & { caps?: 'start' | 'end' | 'both' } = {}): void {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(d[0], d[1], d[2]);
  const n = Math.max(1, Math.round(len / ((o.stone ?? 1.3) * (fine(s) ? 1 : 2))));
  const m = profile.length, [cq, cu] = middle(profile);
  const pts: number[] = [], hints: number[] = [], shifts: number[] = [], tris: number[] = [];
  const at = (t: number, [q, u]: XY): V3 => [a[0] + d[0] * t + out[0] * q, a[1] + d[1] * t + u, a[2] + d[2] * t + out[2] * q];
  for (let k = 0; k < n; k++) {
    const shift = (s.r() - 0.5) * 2 * (o.vary ?? 0.16), first = pts.length / 3;
    for (const t of [k / n, (k + 1) / n]) for (const p of profile) {
      pts.push(...at(t, p));
      hints.push(out[0] * (p[0] - cq), p[1] - cu, out[2] * (p[0] - cq));
      shifts.push(shift);
    }
    for (let i = 0; i < m - 1; i++) tris.push(first + i, first + i + 1, first + m + i + 1, first + i, first + m + i + 1, first + m + i);
  }
  s.mesh(pts, tris, tone, { ...DRESS, skin: o.skin ?? 'limestone', moss: o.moss ?? 0, hints, shifts });
  for (const [end, t, sign] of [['start', 0, -1], ['end', 1, 1]] as const)
    if (o.caps === end || o.caps === 'both') face(s, profile.map((p) => at(t, p)), [(d[0] / len) * sign, (d[1] / len) * sign, (d[2] / len) * sign], tone, { skin: o.skin ?? 'limestone' });
}

/**
 * A moulding round a rectangle, mitred at its corners: a plinth, a string course, a cornice, the edge of a cap.
 * `profile` is [out, up] from the rectangle's sides; `sides` names the ones to draw ('+z-x-z+x').
 */
function band(s: Shape, x: number, z: number, hx: number, hz: number, profile: readonly XY[], tone: Tone, o: Cut & { sides?: string } = {}): void {
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]], names = ['+z', '-x', '-z', '+x'], normals = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  const m = profile.length, [cq, cu] = middle(profile);
  const pts: number[] = [], hints: number[] = [], shifts: number[] = [], tris: number[] = [];
  for (let k = 0; k < 4; k++) {
    if (o.sides && !o.sides.includes(names[k])) continue;
    const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
    const n = Math.max(1, Math.round((k % 2 === 0 ? 2 * hx : 2 * hz) / ((o.stone ?? 1.3) * (fine(s) ? 1 : 2))));
    for (let i = 0; i < n; i++) {
      const shift = (s.r() - 0.5) * 2 * (o.vary ?? 0.16), first = pts.length / 3;
      for (const t of [i / n, (i + 1) / n]) for (const [q, u] of profile) {
        pts.push(x + (ax + (bx - ax) * t) * (hx + q), u, z + (az + (bz - az) * t) * (hz + q));
        hints.push(normals[k][0] * (q - cq), u - cu, normals[k][1] * (q - cq));
        shifts.push(shift);
      }
      for (let j = 0; j < m - 1; j++) tris.push(first + j, first + j + 1, first + m + j + 1, first + j, first + m + j + 1, first + m + j);
    }
  }
  s.mesh(pts, tris, tone, { ...DRESS, skin: o.skin ?? 'limestone', moss: o.moss ?? 0, hints, shifts });
}

interface Arc {
  /** The radius of the opening's curve, and the height of the circle's middle. */
  r: number;
  cy: number;
  /** The height the arch springs from. Below it the opening is straight. */
  spring: number;
  /** How wide the ring of voussoirs is. */
  ring: number;
}

const half = (r: number, dy: number): number => (Math.abs(dy) >= r ? 0 : Math.sqrt(r * r - dy * dy));

/**
 * The coursed wall round an arched opening, on a face toward +z at `z`: `reach` wide each side of the arch's
 * middle, from `bottom` to `top`. Below the springing it lays the two piers; above, each course runs in from the
 * wall's ends to just under the ring that `voussoirs` lays over its stepped ends. Where the arch lies flat the
 * courses are made thinner, so no block's corner shows in the opening.
 */
function archWall(s: Shape, reach: number, bottom: number, top: number, z: number, arc: Arc, o: A.StoneOptions = {}): void {
  const course = o.course ?? 0.8, open = half(arc.r, arc.spring - arc.cy), outer = arc.r + arc.ring - 0.06;
  const lines = [bottom];
  if (arc.spring - bottom > 0.05) {
    const n = Math.max(1, Math.round((arc.spring - bottom) / course));
    for (let i = 1; i <= n; i++) lines.push(bottom + ((arc.spring - bottom) * i) / n);
  }
  for (let a = Math.max(bottom, arc.spring); a < top - 1e-6; ) {
    let e = top - (a + course) < course * 0.4 ? top : a + course;
    while (half(outer, e - arc.cy) < half(arc.r, a - arc.cy) - 0.05 && e - a > 0.3) e = a + (e - a) * 0.62;
    lines.push(e);
    a = e;
  }
  const lay = (x0: number, x1: number, a: number, e: number) => A.ashlar(s, (x0 + x1) / 2, a, z - 0.08, x1 - x0, e - a, 0.16, { ...o, course: 99, faces: '+z' });
  for (let c = 0; c < lines.length - 1; c++) {
    const a = lines[c], e = lines[c + 1];
    const inner = e <= arc.spring + 1e-6 ? open : Math.max(half(outer, e - arc.cy), half(arc.r, a - arc.cy) + 0.02);
    if (inner < 0.3) lay(-reach, reach, a, e);
    else if (reach - inner > 0.12) { lay(-reach, -inner, a, e); lay(inner, reach, a, e); }
  }
}

/**
 * A ring of voussoirs along an arc in a plane toward +z: `n` stones from the angle a0 to a1 (from +x toward +y)
 * round (0, cy), between the radii r and r + ring, their faces at z. Each is a pillow with its own shade, and the
 * keystone stands taller and proud. 10 triangles a stone, 2 at low detail.
 */
function voussoirs(s: Shape, arc: Arc, a0: number, a1: number, n: number, z: number, o: { tone?: Tone; key?: number } = {}): void {
  const pts: number[] = [], hints: number[] = [], shifts: number[] = [], tris: number[] = [];
  const add = (t: number, rad: number, off: number, shift: number): number => {
    pts.push(Math.cos(t) * rad, arc.cy + Math.sin(t) * rad, z + off);
    hints.push(0, 0, 1);
    shifts.push(shift);
    return pts.length / 3 - 1;
  };
  const quad = (a: number, b: number, c: number, d: number) => tris.push(a, b, c, a, c, d);
  const rel = 0.05, ch = 0.06;
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    const key = n % 2 === 1 && i === (n - 1) / 2;
    const r1 = arc.r + arc.ring + (key ? (o.key ?? 0.14) : i % 2 ? 0.05 : 0), lift = key ? 0.05 : 0;
    const shift = (s.r() - 0.5) * 0.4 + (key ? 0.12 : 0);
    const edge = [add(t0, arc.r, lift, shift), add(t1, arc.r, lift, shift), add(t1, r1, lift, shift), add(t0, r1, lift, shift)];
    if (!fine(s)) { quad(edge[0], edge[1], edge[2], edge[3]); continue; }
    const da = (ch / (arc.r + arc.ring / 2)) * Math.sign(a1 - a0);
    const top = [add(t0 + da, arc.r + ch, lift + rel, shift), add(t1 - da, arc.r + ch, lift + rel, shift), add(t1 - da, r1 - ch, lift + rel, shift), add(t0 + da, r1 - ch, lift + rel, shift)];
    quad(top[0], top[1], top[2], top[3]);
    for (let k = 0; k < 4; k++) quad(edge[k], edge[(k + 1) % 4], top[(k + 1) % 4], top[k]);
  }
  s.mesh(pts, tris, o.tone ?? DRESSED, { skin: 'limestone', crease: 0.4, light: 0.25, key: 0.3, mottle: 0.16, cavity: 0.55, hints, shifts });
}

/** The underside of an arch: its arc from a0 to a1 carried from z0 back to z1, in shade. */
function barrel(s: Shape, arc: Arc, a0: number, a1: number, z0: number, z1: number, glow = 0, tone: Tone = DAMP): void {
  const n = fine(s) ? 10 : 5, pts: number[] = [], hints: number[] = [], tris: number[] = [];
  for (let k = 0; k <= n; k++) {
    const t = a0 + ((a1 - a0) * k) / n;
    for (const z of [z0, z1]) {
      pts.push(Math.cos(t) * arc.r, arc.cy + Math.sin(t) * arc.r, z);
      hints.push(-Math.cos(t), -Math.sin(t), 0);
    }
    if (k < n) tris.push(k * 2, k * 2 + 1, k * 2 + 3, k * 2, k * 2 + 3, k * 2 + 2);
  }
  s.mesh(pts, tris, tone, { skin: 'stone', hints, light: 0.1, mottle: 0.2, cavity: 0.3, glow });
}

/** The inside of a wall with a round-headed opening, seen through the opening across from it: a face toward -z. */
function archBack(s: Shape, reach: number, bottom: number, top: number, z: number, arc: Arc, glow = 0): void {
  const n = fine(s) ? 6 : 3, pts: number[] = [], tris: number[] = [];
  const add = (x: number, y: number) => { pts.push(x, y, z); return pts.length / 3 - 1; };
  for (const side of [-1, 1]) {
    const foot = add(side * arc.r, bottom), out = add(side * reach, bottom), up = add(side * reach, arc.spring), corner = add(side * reach, top);
    let prev = add(side * arc.r, arc.spring);
    tris.push(foot, out, up, foot, up, prev, corner, up, prev);
    for (let k = 1; k <= n; k++) {
      const t = (k * Math.PI) / (2 * n), q = add(side * Math.cos(t) * arc.r, arc.cy + Math.sin(t) * arc.r);
      tris.push(corner, prev, q);
      prev = q;
    }
    tris.push(corner, prev, add(0, top));
  }
  s.mesh(pts, tris, GLOOM, { skin: 'stone', smooth: false, hints: pts.map((_, i) => (i % 3 === 2 ? -1 : 0)), light: 0.1, mottle: 0.2, cavity: 0.3, glow });
}

/**
 * A cloth hung from a rod at y on a face toward +z: `w` wide and `h` long, in folds that deepen toward its hem.
 * `tail` cuts its hem in a swallowtail; `emblem` lays the queen's wheat sprig and two pale borders in the folds.
 */
function drape(s: Shape, x: number, y: number, z: number, w: number, h: number, o: { tone?: Tone; two?: boolean; emblem?: boolean; tail?: number; folds?: number; depth?: number; cols?: number; rows?: number; rod?: boolean } = {}): void {
  const cols = fine(s) ? (o.cols ?? 6) : 2, rows = fine(s) ? (o.rows ?? 4) : 2;
  const tail = o.tail ?? 0, folds = o.folds ?? 2.5, depth = o.depth ?? 0.1;
  /** The cloth at u (-1 to 1 across) and t (0 at the rod, 1 at the hem), `lift` proud of it. */
  const at = (u: number, t: number, lift = 0): V3 => [
    x + ((u * w) / 2) * (1 - 0.07 * t),
    y - t * (h - tail * (1 - Math.abs(u))),
    z + lift + depth * Math.sin(u * Math.PI * folds + 0.7) * (0.15 + 0.85 * t) + 0.05 * Math.sin(t * Math.PI),
  ];
  const look: MeshOptions = { skin: 'flat', light: 0, key: 0.5, mottle: 0.12, cavity: 0.8 };
  const pts: number[] = [], tris: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    pts.push(...at(-1 + (2 * i) / cols, j / rows));
    if (j < rows && i < cols) { const a = j * (cols + 1) + i; tris.push(a, a + 1, a + cols + 2, a, a + cols + 2, a + cols + 1); }
  }
  for (const sign of o.two ? [1, -1] : [1]) s.mesh(pts, tris, o.tone ?? SAFFRON, { ...look, hints: pts.map((_, i) => (i % 3 === 2 ? sign : 0)) });
  if (o.emblem) {
    const pale: number[] = [], paleTris: number[] = [];
    const strip = (u0: number, u1: number, t0: number, t1: number) => {
      const i = pale.length / 3;
      pale.push(...at(u0, t0, 0.012), ...at(u1, t0, 0.012), ...at(u1, t1, 0.012), ...at(u0, t1, 0.012));
      paleTris.push(i, i + 1, i + 2, i, i + 2, i + 3);
    };
    for (let j = 0; j < rows; j++) for (const side of [-1, 1]) strip(side * 0.92, side * 0.8, j / rows, (j + 1) / rows);
    // The sprig: a stalk and three pairs of leaves.
    strip(-0.045, 0.045, 0.3, 0.74);
    for (let k = 0; k < 3; k++) for (const side of [-1, 1]) {
      const i = pale.length / 3, t = 0.6 - k * 0.13;
      pale.push(...at(0, t, 0.014), ...at(side * 0.42, t - 0.15, 0.014), ...at(side * 0.1, t - 0.02, 0.014));
      paleTris.push(i, i + 1, i + 2);
    }
    s.mesh(pale, paleTris, [P.plaster, P.plasterLight], { ...look, cavity: 0.3, hints: pale.map((_, i) => (i % 3 === 2 ? 1 : 0)) });
  }
  if (o.rod ?? true) A.timber(s, [x - w / 2 - 0.12, y + 0.04, z], [x + w / 2 + 0.12, y + 0.04, z], 0.08);
}

/** A lantern's glass, frame, cap and foot, its glass standing on y: the same on a post, an arm or a chain. */
function lanternHead(s: Shape, x: number, y: number, z: number, k: number, lit: boolean, foot = false): void {
  const flat: MeshOptions = { skin: 'flat', crease: 0.5 };
  if (foot) s.lathe(x, y - 0.1 * k, z, [[0, 0], [0.12 * k, 0.03 * k], [0.33 * k, 0.1 * k]], IRON, { ...flat, sides: 4, turn: Math.PI / 4, cap: false });
  s.lathe(x, y, z, [[0.29 * k, 0], [0.38 * k, 0.66 * k]], AMBER, { ...flat, sides: 4, turn: Math.PI / 4, cap: false, glow: lit ? 1 : 0, light: 0.1, mottle: 0.1, cavity: 0 });
  if (fine(s)) for (const [dx, dz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]])
    s.tube([[x + dx * 0.205 * k, y, z + dz * 0.205 * k], [x + dx * 0.27 * k, y + 0.66 * k, z + dz * 0.27 * k]], [0.026 * k, 0.026 * k], 3, P.night);
  s.lathe(x, y + 0.66 * k, z, [[0.47 * k, 0], [0.4 * k, 0.08 * k], [0.11 * k, 0.4 * k], [0, 0.5 * k]], IRON, { ...flat, sides: 4, turn: Math.PI / 4, light: 0.3, key: 0.3 });
  s.cone(x, y + 1.14 * k, z, 0.055 * k, 0.17 * k, 4, P.gold);
  if (lit) s.light(x, y + 0.35 * k, z);
}

// ---------------------------------------------------------------- the river bridge

// The bridge runs along z. Its origin lies on the riverbed and its deck 5.8 above it; the world sinks it until the
// deck meets the banks, which leaves the river standing 3.8 over the origin: the arches spring just under the
// water, so what shows is a row of broad low arches with the piers' cutwaters between them.
const B = { deck: 5.8, water: 3.8, face: 4.5, spring: 3.45, r: 5.8, cy: -0.75, ring: 0.5 } as const;
/** Half the angle the arch sweeps: its opening is 8 wide at the springing. */
const SWEEP = Math.asin(4 / B.r);
/** How much of each pier a span owns: two spans' halves make one pier 1.1 long. */
const PIER = 0.7;
const BRIDGE_STONE: A.StoneOptions = { tone: A.HEARTH, long: [1.1, 1.9], vary: 0.3, chip: 0.3 };

/**
 * The stretch of parapet over a pier or an abutment: a block that stands out from the wall and rises above the
 * coping to carry a lamp, from x0 to x1 along the bridge, its shaft reaching down to `low`.
 */
function pierBlock(s: Shape, x0: number, x1: number, low: number): void {
  const out = B.face + 0.32, top = 7.35, x = (x0 + x1) / 2, w = x1 - x0, stone = { ...BRIDGE_STONE, course: 0.62, long: [1, 1.6] as const };
  A.ashlar(s, x, low, out - 0.08, w, top - low, 0.16, { ...stone, faces: '+z' });
  A.ashlar(s, x, B.deck, 4.08, w, top - B.deck, 0.16, { ...stone, faces: '-z', flat: true });
  // Its two ends. One that meets a neighbour is hidden by it.
  for (const [at, sign] of [[x0, -1], [x1, 1]] as const) {
    face(s, [[at, low, B.face], [at, low, out], [at, top, out], [at, top, B.face]], [sign, 0, 0], A.HEARTH, { skin: 'limestone' });
    face(s, [[at, B.deck, 4], [at, B.deck, B.face], [at, top, B.face], [at, top, 4]], [sign, 0, 0], A.HEARTH, { skin: 'limestone' });
  }
  moulding(s, [x0, 0, 0], [x1, 0, 0], [0, 0, 1], [[3.94, top], [3.94, top + 0.1], [4, top + 0.16], [out, top + 0.16], [out + 0.06, top + 0.1], [out + 0.06, top]], DRESSED, { stone: 1.1, caps: 'both' });
}

/** Half of a pier's pointed cutwater, at the end `e` (-1 or 1) of a span `h` long each way: its neighbour's half makes the point. */
function cutwater(s: Shape, e: number, h: number): void {
  const f = B.face, xj = e * h, xw = e * (h - 1), nose = f + 1.3, top = 4.5, apex = 5.42;
  const rows = fine(s) ? [0, 1.8, 3.05, 3.55, 4.05, top] : [0, 3.4, top];
  const pts: number[] = [], hints: number[] = [], shifts: number[] = [], tris: number[] = [];
  const add = (x: number, y: number, z: number, hint: V3, shift: number): number => {
    pts.push(x, y, z);
    hints.push(...hint);
    shifts.push(shift);
    return pts.length / 3 - 1;
  };
  const rake: V3 = [-e * 1.3, 0, 1], join: V3 = [e, 0, 0];
  for (let k = 0; k < rows.length - 1; k++) {
    const shift = (s.r() - 0.5) * 0.5;
    const a = add(xw, rows[k], f, rake, shift), b = add(xj, rows[k], nose, rake, shift), c = add(xj, rows[k + 1], nose, rake, shift), d = add(xw, rows[k + 1], f, rake, shift);
    tris.push(a, b, c, a, c, d);
  }
  // The face in the join's plane, hidden once a neighbour stands there, and the sloped cap up to the wall.
  const j0 = add(xj, 0, f, join, 0), j1 = add(xj, 0, nose, join, 0), j2 = add(xj, top, nose, join, 0), j3 = add(xj, top, f, join, 0);
  tris.push(j0, j1, j2, j0, j2, j3, j3, j2, add(xj, apex, f, join, 0));
  const up: V3 = [-e * 0.7, 1, 0.7];
  tris.push(add(xw, top, f, up, 0.2), add(xj, top, nose, up, 0.2), add(xj, apex, f, up, 0.2));
  s.mesh(pts, tris, A.HEARTH, { skin: 'limestone', crease: 0.5, light: 0.25, key: 0.3, mottle: 0.2, cavity: 0.4, moss: 0.3, hints, shifts });
}

/** One side of a stretch of bridge `h` long each way, drawn with x along the bridge and its face toward +z. */
function bridgeSide(s: Shape, h: number, span: boolean): void {
  const f = B.face;
  if (!span) { pierBlock(s, -h, h, 0); return; }
  const inner = h - PIER;
archWall(s, h, B.spring, 5.45, f, B, { ...BRIDGE_STONE, course: 0.68 });  voussoirs(s, B, Math.PI / 2 + SWEEP, Math.PI / 2 - SWEEP, 11, f + 0.05);  for (const e of [-1, 1]) {
    cutwater(s, e, h);    pierBlock(s, e < 0 ? -h : inner, e < 0 ? -inner : h, 4.9);  }
  // The string course under the parapet, the parapet and its coping, between the piers.
  moulding(s, [-inner, 0, f], [inner, 0, f], [0, 0, 1], [[0, 5.4], [0.13, 5.47], [0.13, 5.72], [0.07, 5.8], [0, 5.8]], DRESSED, { stone: 1.5 });
  A.ashlar(s, 0, B.deck, f - 0.08, 2 * inner, 1.05, 0.16, { ...BRIDGE_STONE, course: 0.53, faces: '+z' });
  A.ashlar(s, 0, B.deck, 4.08, 2 * inner, 1.05, 0.16, { ...BRIDGE_STONE, course: 0.53, faces: '-z', flat: true });
  moulding(s, [-inner, 0, 0], [inner, 0, 0], [0, 0, 1], [[3.94, 6.85], [3.94, 6.96], [4, 7.02], [f, 7.02], [f + 0.06, 6.96], [f + 0.06, 6.85]], DRESSED, { stone: 1.25, moss: 0.02 });
}

/** The paving: worn flags in courses across the deck, paler where feet and wheels go, with a kerb along each parapet. */
function bridgeDeck(s: Shape, h: number): void {
  const y = B.deck, gap = 0.022, edge = 3.55, row = fine(s) ? 1 : 2;
  face(s, [[-4, y - 0.03, -h], [-4, y - 0.03, h], [4, y - 0.03, h], [4, y - 0.03, -h]], [0, 1, 0], DAMP, { skin: 'stone', light: 0, cavity: 0 });
  const pts: number[] = [], shifts: number[] = [], tris: number[] = [];
  const slab = (x0: number, x1: number, z0: number, z1: number, shift: number) => {
    const i = pts.length / 3;
    pts.push(x0 + gap, y, z0 + gap, x0 + gap, y, z1 - gap, x1 - gap, y, z1 - gap, x1 - gap, y, z0 + gap);
    shifts.push(shift, shift, shift, shift);
    tris.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  for (let z = -h, odd = 0; z < h - 1e-6; z += row, odd++) {
    let x = -edge, first = true;
    while (x < edge - 1e-6) {
      let w = s.rr(1, 1.7) * (first && odd % 2 ? 0.55 : 1) * (fine(s) ? 1 : 1.8);
      first = false;
      if (edge - (x + w) < 0.6) w = edge - x;
      const worn = 0.2 * (1 - Math.min(1, Math.abs(x + w / 2) / 2.8));
      slab(x, x + w, z, Math.min(h, z + row), worn + (s.r() < 0.14 ? -0.42 : (s.r() - 0.5) * 0.3));
      x += w;
    }
  }
  for (const side of [-1, 1]) for (let z = -h; z < h - 1e-6; z += 2) slab(side < 0 ? -4 : edge, side < 0 ? -edge : 4, z, Math.min(h, z + 2), -0.2 + (s.r() - 0.5) * 0.2);
  s.mesh(pts, tris, A.HEARTH, { skin: 'stone', smooth: false, hints: pts.map((_, i) => (i % 3 === 1 ? 1 : 0)), light: 0, mottle: 0.2, cavity: 0, shifts });
}

/** A stretch of bridge `len` long with its middle at the pen: an arch between two half piers, or a solid end. */
function bridgeStretch(s: Shape, len: number, span: boolean): void {
  const h = len / 2;
  for (const turn of [Math.PI / 2, -Math.PI / 2]) s.at(0, 0, 0, turn, () => bridgeSide(s, h, span));
  if (span) {
    s.at(0, 0, 0, Math.PI / 2, () => barrel(s, B, Math.PI / 2 + SWEEP, Math.PI / 2 - SWEEP, -B.face - 0.05, B.face + 0.05));
    for (const e of [-1, 1]) face(s, [[-B.face, 0, e * 4], [B.face, 0, e * 4], [B.face, B.spring, e * 4], [-B.face, B.spring, e * 4]], [0, 0, -e], [H0, H1, H2], { skin: 'stone' });
    for (const e of [-1, 1]) s.shadowBox(0, 0, e * (h - 0.5), 9, B.deck, 1);
  } else s.shadowBox(0, 0, 0, 9.6, B.deck, len);
bridgeDeck(s, h);  s.shadowBox(0, B.deck - 0.4, 0, 9, 0.4, len);
  for (const x of [-4.25, 4.25]) s.shadowBox(x, B.deck, 0, 0.5, 1.2, len);
}

/** A lamp on a pier's block, as the vista has them: a stone pedestal and a broad lantern standing on it, large enough to read from the game's camera. */
function bridgeLamp(s: Shape, x: number, y: number, z: number, lit: boolean): void {
  const r = 0.32, top = y + 0.7;
  A.ashlar(s, x, y, z, 2 * r, 0.7, 2 * r, { tone: A.HEARTH, course: 99, long: [9, 9], vary: 0.3, flat: true, faces: '+z-z+x-x' });
  band(s, x, z, r, r, [[0, top - 0.04], [0.04, top], [0.04, top + 0.1], [0, top + 0.14]], DRESSED, { stone: 9 });
  face(s, [[x - r, top + 0.14, z - r], [x - r, top + 0.14, z + r], [x + r, top + 0.14, z + r], [x + r, top + 0.14, z - r]], [0, 1, 0], DRESSED, { skin: 'limestone' });
  lanternHead(s, x, top + 0.22, z, 1.12, lit, true);
}

const MOSS = new Color(P.moss), WEED = new Color(P.leaf);

/**
 * Where the river stands against the bridge: the stone under `level` damp and dark, and a ragged band of moss
 * and weed from the waterline up. It only moves colours, and the moss wears the moss painting on skinned stone.
 */
function waterline(g: BufferGeometry, level: number): BufferGeometry {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), skin = g.getAttribute('aSkin');
  const step = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y > level + 1.3) continue;
    const slow = 0.5 + 0.5 * Math.sin(x * 1.9 + z * 1.3 + 0.7) * Math.cos(z * 0.83 - x * 0.4), quick = 0.5 + 0.5 * Math.sin(z * 4.1 + x * 3.3 + y * 2.2);
    const ragged = y + (slow - 0.5) * 0.4 + (quick - 0.5) * 0.16;
    const wet = 1 - step(level - 0.3, level + 0.35, ragged);
    // In patches: a stone is mossed or it is not.
    const moss = step(level - 0.5, level - 0.05, ragged) * (1 - step(level + 0.3, level + 1, ragged)) * step(0.22, 0.5, 0.6 * quick + 0.4 * slow + 0.12);
    const green = slow > 0.5 ? MOSS : WEED;
    c.setXYZ(i, c.getX(i) * (1 - 0.22 * wet) * (1 - 0.9 * moss) + green.r * 0.9 * moss, c.getY(i) * (1 - 0.18 * wet) * (1 - 0.9 * moss) + green.g * 0.9 * moss, c.getZ(i) * (1 - 0.2 * wet) * (1 - 0.9 * moss) + green.b * 0.9 * moss);
    if (skin.getX(i) > 0) skin.setY(i, Math.max(skin.getY(i), moss * 0.9));
  }
  return g;
}

/**
 * The stone bridge over the Mere into the city. Variants 0 and 1 are the whole bridge, three arches and 30 long,
 * with lamps on its piers and ends (lit and unlit) and the queen's banners on its piers. Variant 2 is one arch,
 * 10 long, that joins its like on its end planes; 3 and 4 are a 2 long abutment with a lamp, lit and unlit.
 * The deck is 5.8 over the origin, 8 clear between the parapets and 7.88 between their copings.
 */
export function cityBridge(v: number, _d: unknown, detail = 1) {
  const s = new Shape(9200, detail), full = v < 2, end = v >= 3, lit = v === 0 || v === 3;
  if (full) for (const z of [-10, 0, 10]) s.at(0, 0, z, 0, () => bridgeStretch(s, 10, true));
  else bridgeStretch(s, end ? 2 : 10, !end);
  if (full || end) {
    const reach = full ? 15 : 1, lampX = (4 + B.face + 0.32) / 2;
    // Where it meets its banks: a plain wall, mostly in the ground.
    for (const e of [-1, 1]) face(s, [[-B.face, 0, e * reach], [B.face, 0, e * reach], [B.face, B.deck, e * reach], [-B.face, B.deck, e * reach]], [0, 0, e], A.HEARTH, { skin: 'stone' });
    for (const x of [-lampX, lampX]) for (const z of full ? [-14.62, -5, 5, 14.62] : [0]) bridgeLamp(s, x, 7.51, z, lit);
  }
  if (full) for (const turn of [Math.PI / 2, -Math.PI / 2]) s.at(0, 0, 0, turn, () => { for (const x of [-5, 5]) drape(s, x, 7.16, B.face + 0.45, 1.05, 2.3, { emblem: true, tail: 0.36, cols: 4, rows: 3, folds: 1.5, depth: 0.07 }); });
  return waterline(s.done(), B.water);
}

// ---------------------------------------------------------------- the low boundary wall

/**
 * The low wall either side of the gateway: 4 along x, its front face at z = 0 and its body 0.8 deep toward +z,
 * joining at steps of 4. Variant 1 ends in a pier inside its +x end.
 */
export function cityLowWall(v: number, _d: unknown, detail = 1) {
  const s = new Shape(9220 + v, detail), x1 = v === 1 ? 1.15 : 2, stone: A.StoneOptions = { tone: A.HEARTH, vary: 0.3, chip: 0.12 };
  A.ashlar(s, (x1 - 2) / 2, 0, 0.4, x1 + 2, 1, 0.8, { ...stone, course: 0.5, long: [0.9, 1.5], faces: '+z-z' });
  // A saddle-backed coping, each stone its own shade, mossed along its ridge.
  const coping: XY[] = [[-0.47, 1], [-0.47, 1.07], [-0.12, 1.21], [0.12, 1.21], [0.47, 1.07], [0.47, 1]];
  moulding(s, [-2, 0, 0.4], [x1, 0, 0.4], [0, 0, 1], coping, DRESSED, { stone: 1, moss: 0.03, caps: 'both' });
  for (const [x, sign] of [[-2, -1], [x1, 1]] as const) face(s, [[x, 0, 0], [x, 0, 0.8], [x, 1, 0.8], [x, 1, 0]], [sign, 0, 0], A.HEARTH, { skin: 'limestone' });
  if (v === 1) {
    A.ashlar(s, 1.575, 0, 0.4, 0.85, 1.3, 0.9, { ...stone, course: 0.66, long: [9, 9], faces: '+z-z+x-x' });
    band(s, 1.575, 0.4, 0.425, 0.45, [[0, 1.26], [0.06, 1.3], [0.06, 1.4], [0, 1.44]], DRESSED, { stone: 9 });
    const top: number[] = [], tris: number[] = [];
    for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) top.push(1.575 + sx * 0.425, 1.44, 0.4 + sz * 0.45);
    top.push(1.575, 1.6, 0.4);
    for (let k = 0; k < 4; k++) tris.push(k, (k + 1) % 4, 4);
    s.mesh(top, tris, DRESSED, { skin: 'limestone', crease: 0.4, hints: [1, 1, 1, -1, 1, 1, -1, 1, -1, 1, 1, -1, 0, 1, 0], light: 0.3, key: 0.3, moss: 0.03 });
  }
  s.weather(0, { moss: 0.4, wear: 0.25 });
  s.shadowBox(0, 0, 0.4, 4, 1.2, 0.8);
  return s.done();
}

// ---------------------------------------------------------------- the gateway

/** A small gabled dormer on a roof slope toward +z: its front at z0 with its foot at `foot`, the main roof climbing `pitch` behind it. */
function gateDormer(s: Shape, z0: number, foot: number, pitch: number): void {
  const w = 1.9, hw = w / 2, head = foot + 1.2, apex = head + 0.78, eave = head - 0.06, over = 0.22;
  const back = (y: number) => z0 - (y - foot) / pitch;
  face(s, [[-hw, foot, z0], [hw, foot, z0], [hw, head, z0], [0, apex - 0.05, z0], [-hw, head, z0]], [0, 0, 1], A.PLASTER, { skin: 'plaster', light: 0.1, key: 0.15 });
  for (const side of [-1, 1]) {
    face(s, [[side * hw, foot, z0], [side * hw, head, z0], [side * hw, head, back(head)]], [side, 0, 0], A.PLASTER, { skin: 'plaster', light: 0.1 });
    A.timber(s, [side * (hw - 0.08), foot, z0 + 0.04], [side * (hw - 0.08), head, z0 + 0.04], 0.16);
    A.timber(s, [side * (hw + over), eave - 0.1, z0 + over], [0, apex - 0.04, z0 + over], 0.1, A.TIMBER, { height: 0.22 });
    // Its own little slope of tiles, lapping the main roof.
    const pts = [side * (hw + over), eave, z0 + over + 0.04, 0, apex + 0.06, z0 + over + 0.04, 0, apex + 0.06, back(apex) - 0.1, side * (hw + over), eave, back(eave) - 0.1];
    s.mesh(pts, [0, 1, 2, 0, 2, 3], A.TEAL, { skin: 'tiles', uvs: [0, 1.3, 0, 0, 2, 0, 2, 1.3], hints: [side, 1, 0, side, 1, 0, side, 1, 0, side, 1, 0], light: 0.2, key: 0.25, mottle: 0.22, cavity: 0.3 });
  }
  A.timber(s, [-hw, head, z0 + 0.05], [hw, head, z0 + 0.05], 0.16);
  A.timber(s, [-0.62, foot + 0.22, z0 + 0.05], [0.62, foot + 0.22, z0 + 0.05], 0.22, A.TIMBER, { height: 0.1 });
  s.tube([[0, apex + 0.08, z0 + over + 0.08], [0, apex + 0.08, back(apex) - 0.2]], [0.11, 0.11], 4, [P.tealDeep, P.tealDark], { cap: 'start', turn: Math.PI / 4 });
  face(s, [[-0.5, foot + 0.28, z0 + 0.03], [0.5, foot + 0.28, z0 + 0.03], [0.5, head - 0.14, z0 + 0.03], [-0.5, head - 0.14, z0 + 0.03]], [0, 0, 1], A.GLASS, { glow: 1, light: 0, mottle: 0.3, cavity: 0 });
  for (const [a, c] of [[[0, foot + 0.28], [0, head - 0.14]], [[-0.5, foot + 0.7], [0.5, foot + 0.7]]]) A.timber(s, [a[0], a[1], z0 + 0.06], [c[0], c[1], z0 + 0.06], 0.05);
  s.light(0, foot + 0.7, z0 + 0.5);
}

/**
 * The city's gateway over the road in: no fortress, an inherited gatehouse. A round arch of dressed stone between
 * two stout piers, and over it a jettied watch room in the city's timber and plaster under a teal roof, with the
 * queen's banners on its piers and a lantern by each. It faces +z and is the same from behind. Its opening is 6.8
 * wide and 6.9 high at its crown (6 by 5 clear), and the watch room's floor is at 8.7.
 */
export function cityGateway(_v: number, _d: unknown, detail = 1) {
  const s = new Shape(9230, detail);
  const arc: Arc = { r: 3.4, cy: 3.5, spring: 3.5, ring: 0.6 };
  const REACH = 5.7, DEPTH = 1.7, TOP = 8.2, FOOT = 0.9;
  const stone: A.StoneOptions = { tone: A.HEARTH, course: 0.88, long: [1.1, 1.9], vary: 0.3, chip: 0.3 };
  const masonry = s.mark();
  for (const turn of [0, Math.PI]) s.at(0, 0, 0, turn, () => {
    archWall(s, REACH, FOOT, TOP, DEPTH, arc, stone);
voussoirs(s, arc, Math.PI, 0, 15, DEPTH + 0.05, { key: 0.24 });    // An impost under each springing, and the string course that carries the jetty.
    for (const side of [-1, 1]) moulding(s, [side * (arc.r - 0.04), 0, DEPTH], [side * (arc.r + arc.ring + 0.3), 0, DEPTH], [0, 0, 1], [[0, 3.24], [0.14, 3.3], [0.14, 3.44], [0.08, 3.5], [0, 3.5]], DRESSED, { stone: 9, caps: 'both' });
    moulding(s, [-REACH, 0, DEPTH], [REACH, 0, DEPTH], [0, 0, 1], [[0, 7.84], [0.12, 7.9], [0.12, 8.12], [0.05, TOP], [0, TOP]], DRESSED, { stone: 1.45 });
    for (const x of [-4.55, 4.55]) drape(s, x, 7.66, DEPTH + 0.2, 1.3, 3.3, { emblem: true, tail: 0.45, rows: 3 });
  });
  // The piers' outer sides, the sides of the passage and its vault.
  for (const side of [-1, 1]) {
    A.ashlar(s, side * (REACH - 0.08), FOOT, 0, 0.16, TOP - FOOT, 2 * DEPTH, { ...stone, faces: side > 0 ? '+x' : '-x' });
    A.ashlar(s, side * (arc.r + 0.08), 0, 0, 0.16, arc.spring, 2 * DEPTH, { ...stone, faces: side > 0 ? '-x' : '+x', flat: true });
    moulding(s, [side * REACH, 0, -DEPTH], [side * REACH, 0, DEPTH], [side, 0, 0], [[0, 7.84], [0.12, 7.9], [0.12, 8.12], [0.05, TOP], [0, TOP]], DRESSED, { stone: 1.45 });
    // A plinth with a weathered top round each pier, flush with the passage.
    const x0 = side * arc.r, x1 = side * (REACH + 0.16), z1 = DEPTH + 0.16, pts: number[] = [], tris: number[] = [], hints: number[] = [];
    for (const [px, pz, hx, hz] of [[x0, z1, 0, 1], [x1, z1, side, 1], [x1, -z1, side, -1], [x0, -z1, 0, -1]]) {
      const inset = (q: number, by: number) => (q === x0 ? q : q - Math.sign(q) * by);
      pts.push(px, 0, pz, px, 0.7, pz, inset(px, 0.16), FOOT, pz - Math.sign(pz) * 0.16);
      hints.push(hx, 0, hz, hx, 0.3, hz, hx, 1, hz);
    }
    for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) { const a = k * 3 + j, b = a + 3; tris.push(a, b, b + 1, a, b + 1, a + 1); }
    s.mesh(pts, tris, [H0, H1, H2], { skin: 'limestone', crease: 0.5, hints, light: 0.3, key: 0.3, mottle: 0.2, cavity: 0.5 });
    for (const e of [-1, 1]) face(s, [[x0, 0, e * DEPTH], [x0, 0, e * z1], [x0, 0.7, e * z1], [x0, FOOT, e * DEPTH]], [-side, 0, 0], [H0, H1, H2], { skin: 'limestone' });
    s.shadowBox(side * 4.55, 0, 0, 2.3, TOP, 2 * DEPTH);
  }
barrel(s, arc, Math.PI, 0, -DEPTH - 0.05, DEPTH + 0.05, 0.08);
  // One great lantern on a chain from the crown of the vault, clear of the road by 5.
  s.tube([[0, arc.cy + arc.r, 0], [0, arc.cy + arc.r - 0.55, 0]], [0.022, 0.022], 3, P.night);
  lanternHead(s, 0, arc.cy + arc.r - 0.55 - 1.33 * 0.95 + 0.1, 0, 0.95, true, true);
  for (const [turn, x, z] of [[0, REACH, DEPTH], [-Math.PI / 2, DEPTH, REACH], [Math.PI, REACH, DEPTH], [Math.PI / 2, DEPTH, REACH]] as const)
    s.at(0, 0, 0, turn, () => A.quoins(s, x, FOOT, z, 6.9, { tone: DRESSED, course: 0.8, vary: 0.2 }));
  s.weather(masonry, { moss: 0.5, wear: 0.2 });

  // The watch room: joists across the stone, a bressummer on their ends, close studding and plaster, a teal roof.
  const FLOOR = 8.7, WALL = 2.6, W = 11.6, D = 4.1;
  const joists = fine(s) ? 9 : 5;
  for (let i = 0; i < joists; i++) { const x = -5.4 + (10.8 * i) / (joists - 1); A.timber(s, [x, 8.3, -D / 2 - 0.12], [x, 8.3, D / 2 + 0.12], 0.2); }
  for (const z of [-D / 2, D / 2]) A.timber(s, [-W / 2 - 0.06, FLOOR - 0.15, z], [W / 2 + 0.06, FLOOR - 0.15, z], 0.3);
  for (const x of [-W / 2, W / 2]) A.timber(s, [x, FLOOR - 0.15, -D / 2], [x, FLOOR - 0.15, D / 2], 0.3);
  face(s, [[-W / 2, 8.38, -D / 2], [W / 2, 8.38, -D / 2], [W / 2, 8.38, D / 2], [-W / 2, 8.38, D / 2]], [0, -1, 0], [P.umber, P.timber, P.oakDark], { skin: 'grain', light: 0 });
  for (const side of [-1, 1]) for (const x of [-5.45, -3.6, 3.6, 5.45]) A.timber(s, [x, 7.5, side * (DEPTH + 0.05)], [x, 8.2, side * (D / 2 - 0.1)], 0.2);
  const lights = (x: number, w: number): A.Opening => ({ kind: 'window', x, y: 0.72, w, h: 1.3, shutters: false, pair: w > 1.4 });
  for (const turn of [0, Math.PI]) s.at(0, FLOOR, 0, turn, () => A.wall(s, 0, 0, D / 2, W, WALL, { plinth: 0, frame: 'civic', bay: 1.45, patches: 2, moss: 0, openings: [lights(-3.65, 1), lights(0, 1.9), lights(3.65, 1)] }));
  for (const turn of [Math.PI / 2, -Math.PI / 2]) s.at(0, FLOOR, 0, turn, () => A.wall(s, 0, 0, W / 2, D, WALL, { plinth: 0, frame: 'close', patches: 1, moss: 0, openings: [{ kind: 'window', x: 0, y: 0.8, w: 0.8, h: 1.15, shutters: false }] }));
  const RISE = 2.3, pitch = RISE / (D / 2);
  A.roof(s, 0, FLOOR + WALL, 0, W, D, { rise: RISE, overhang: 0.45, verge: 0.45, sag: 0.08, gables: 'queen', tails: 2.3, moss: 0.03 });
  for (const turn of [0, Math.PI]) s.at(0, 0, 0, turn, () => gateDormer(s, D / 2 - 0.2, FLOOR + WALL + 0.24 + pitch * 0.2 - 0.1, pitch));
  // A finial on each end of the ridge.
  for (const x of [-W / 2 - 0.3, W / 2 + 0.3]) {
    s.lathe(x, FLOOR + WALL + 2.66, 0, [[0.07, 0], [0.1, 0.1], [0.045, 0.24], [0.045, 0.4]], IRON, { sides: 5, skin: 'flat', cap: false });
    s.lathe(x, FLOOR + WALL + 3.04, 0, [[0, 0], [0.11, 0.09], [0.08, 0.2], [0, 0.32]], SAFFRON, { sides: 5, skin: 'flat', key: 0.4 });
  }
  s.shadowBox(0, 8.4, 0, W, WALL + 2, D);
  return s.done();
}

// ---------------------------------------------------------------- market goods

const GOODS: MeshOptions = { skin: 'flat', light: 0.32, key: 0.45, mottle: 0.12, cavity: 0.22 };

/** The tray every stall's goods stand on: 1.6 by 0.7, its top 0.045 over the counter. */
function tray(s: Shape): void {
  s.box(0, 0, 0, 1.6, 0.045, 0.7, RAMP.plank, { skin: 'grain', skip: '-y' });
}

/** Something round: an apple, a cabbage, a turnip. 2 × sides × 3 triangles. */
function ball(s: Shape, x: number, y: number, z: number, r: number, tone: Tone, sides = 5, o: { lump?: number; squat?: number } = {}): void {
  const k = o.squat ?? 1;
  s.lathe(x, y, z, [[0.02, 0], [r * 0.93, r * 0.55 * k], [r * 0.82, r * 1.45 * k], [0.02, r * 1.9 * k]], tone, { ...GOODS, sides, cap: false, lump: o.lump ?? 0.04, turn: s.rr(0, 6) });
}

/** A soft slab: a fold of cloth, its edges rounded. 18 triangles. */
function fold(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number, tone: Tone): void {
  const pts: number[] = [], hints: number[] = [], tris: number[] = [], b = Math.min(w, d) * 0.09;
  for (const [dy, inset] of [[0, b], [h * 0.5, 0], [h, b]] as const)
    for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      pts.push(x + sx * (w / 2 - inset), y + dy, z + sz * (d / 2 - inset));
      hints.push(sx, dy === 0 ? -0.5 : dy === h ? 1.2 : 0, sz);
    }
  for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 4; k++) { const a = ring * 4 + k, c = ring * 4 + ((k + 1) % 4); tris.push(a, c, c + 4, a, c + 4, a + 4); }
  tris.push(8, 9, 10, 8, 10, 11);
  s.mesh(pts, tris, tone, { ...GOODS, hints, cavity: 0.4 });
}

function honey(s: Shape): void {
  const amber = [P.wood, P.oak, P.ochre, P.gold] as const;
  const jar = (x: number, z: number, k: number, open: boolean) => s.at(x, 0.045, z, { ry: s.rr(0, 6), scale: k }, () => {
    s.lathe(0, 0, 0, [[0.09, 0], [0.142, 0.05], [0.146, 0.19], [0.112, 0.25], [0.088, 0.275]], amber, { ...GOODS, sides: 6, cap: false, key: 0.6 });
    // A cloth cap tied over the neck, or the honey itself in a jar left open to taste.
    if (open) s.lathe(0, 0.262, 0, [[0.09, 0], [0, 0.012]], [P.ochre, P.gold, P.butter], { ...GOODS, sides: 6, cap: false, light: 0.5 });
    else s.lathe(0, 0.262, 0, [[0.104, 0], [0.082, 0.04], [0, 0.058]], [P.burlapLight, P.cream, P.ivory], { ...GOODS, sides: 6, cap: false, lump: 0.06 });
    face(s, [[0.04, 0.08, 0.144], [0.115, 0.08, 0.116], [0.115, 0.18, 0.116], [0.04, 0.18, 0.144]], [0.4, 0, 1], [P.cream, P.ivory], { skin: 'flat', light: 0, cavity: 0 });
  });
  jar(-0.56, -0.12, 1, false);
  jar(-0.24, -0.14, 1.12, false);
  jar(0.08, -0.12, 1, true);
  jar(-0.4, 0.16, 0.8, true);
  jar(-0.1, 0.17, 0.8, false);
  // Honeycomb, cut from the frame, and a block of wax.
  fold(s, 0.5, 0.045, -0.1, 0.4, 0.1, 0.26, [P.ochre, P.gold, P.butter]);
  fold(s, 0.47, 0.145, -0.08, 0.3, 0.09, 0.2, [P.ochre, P.gold, P.butter, P.lemon]);
  fold(s, 0.5, 0.045, 0.2, 0.26, 0.12, 0.16, [P.butter, P.lemon, P.ivory]);
}

function fiberAndCloth(s: Shape): void {
  // Bolts of cloth, each folded over on itself and laid a little askew.
  const cloths: Tone[] = [[P.tealDeep, P.tealDark, P.teal, P.tealLight], CREAM, SAFFRON];
  for (let i = 0; i < 3; i++) s.at(0.4, 0.045 + i * 0.13, 0, s.rr(-0.14, 0.14), () => {
    fold(s, 0, 0, 0, 0.66 - i * 0.05, 0.065, 0.52 - i * 0.04, cloths[i]);
    if (fine(s)) fold(s, 0.02, 0.062, 0, 0.62 - i * 0.05, 0.065, 0.5 - i * 0.04, cloths[i]);
  });
  // Hanks of moss fiber, twisted and tied round the middle.
  const hank: XY[] = [[0, -0.27], [0.075, -0.22], [0.1, -0.1], [0.058, -0.022], [0.058, 0.022], [0.1, 0.1], [0.075, 0.22], [0, 0.27]];
  for (const [x, z, turn] of [[-0.62, 0, 0.1], [-0.4, 0.02, -0.12], [-0.18, -0.01, 0.06]])
    s.at(x, 0.14, z, { ry: turn, rx: Math.PI / 2 }, () => {
      s.lathe(0, 0, 0, hank, [P.pine, P.moss, P.leaf, P.lime], { ...GOODS, sides: 5, lump: 0.14, mottle: 0.3 });
      if (fine(s)) s.lathe(0, -0.03, 0, [[0.066, 0], [0.066, 0.06]], [P.cream, P.ivory], { ...GOODS, sides: 5, cap: false });
    });
}

function bread(s: Shape): void {
  const crust = [P.bark, P.wood, P.tan, P.clay] as const, score = [P.cream, P.ivory] as const;
  // A linen cloth under the loaves.
  face(s, [[-0.74, 0.05, -0.3], [0.74, 0.05, -0.3], [0.7, 0.05, 0.31], [-0.72, 0.05, 0.3]], [0, 1, 0], CREAM, { skin: 'flat', cavity: 0 });
  const boule = (x: number, z: number, r: number) => s.at(x, 0.05, z, s.rr(0, 3), () => {
    s.lathe(0, 0, 0, [[r * 0.4, 0], [r * 0.95, r * 0.2], [r, r * 0.52], [r * 0.66, r * 0.9], [0, r * 1.06]], crust, { ...GOODS, sides: 7, cap: false, light: 0.4, lump: 0.05 });
    // The baker's cross, pale with flour.
    for (const turn of [0, Math.PI / 2]) s.at(0, 0, 0, turn, () => face(s, [[-r * 0.55, r * 0.97, -0.014], [-r * 0.55, r * 0.97, 0.014], [0, r * 1.09, 0.014], [0, r * 1.09, -0.014]], [0, 1, 0], score, { skin: 'flat', light: 0, cavity: 0 }));
    for (const turn of [0, Math.PI / 2]) s.at(0, 0, 0, turn, () => face(s, [[r * 0.55, r * 0.97, -0.014], [r * 0.55, r * 0.97, 0.014], [0, r * 1.09, 0.014], [0, r * 1.09, -0.014]], [0, 1, 0], score, { skin: 'flat', light: 0, cavity: 0 }));
  });
  boule(-0.52, -0.1, 0.17);
  boule(-0.14, -0.13, 0.18);
  boule(-0.34, 0.17, 0.15);
  boule(0.02, 0.18, 0.14);
  // Two long loaves, slashed across.
  for (const [x, z, turn] of [[0.48, -0.13, 0.25], [0.5, 0.14, 0.08]])
    s.at(x, 0.05 + 0.07, z, { ry: turn, rz: -Math.PI / 2 }, () => {
      s.lathe(0, 0, 0, [[0, -0.29], [0.06, -0.24], [0.078, 0], [0.06, 0.24], [0, 0.29]], crust, { ...GOODS, sides: 6, light: 0.4 });
      for (const y of [-0.15, 0, 0.15]) face(s, [[-0.079, y - 0.05, -0.03], [-0.079, y - 0.02, -0.03], [-0.079, y + 0.05, 0.03], [-0.079, y + 0.02, 0.03]], [-1, 0, 0], score, { skin: 'flat', light: 0, cavity: 0 });
    });
}

function fish(s: Shape): void {
  // A shallow crate of crushed ice.
  for (const [x, z, w, d] of [[0, -0.33, 1.6, 0.04], [0, 0.33, 1.6, 0.04], [-0.78, 0, 0.04, 0.62], [0.78, 0, 0.04, 0.62]]) s.box(x, 0.045, z, w, 0.13, d, RAMP.plank, { skin: 'grain', skip: '-y' });
  const cols = fine(s) ? 6 : 3, rows = fine(s) ? 3 : 2, ice: number[] = [], tris: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const rim = i === 0 || j === 0 || i === cols || j === rows;
    ice.push(-0.76 + (1.52 * i) / cols + (rim ? 0 : s.rr(-0.05, 0.05)), rim ? 0.1 : s.rr(0.12, 0.18), -0.31 + (0.62 * j) / rows + (rim ? 0 : s.rr(-0.04, 0.04)));
    if (i < cols && j < rows) { const a = j * (cols + 1) + i; tris.push(a, a + cols + 1, a + cols + 2, a, a + cols + 2, a + 1); }
  }
  s.mesh(ice, tris, [P.ice, P.mist, P.plasterLight], { skin: 'flat', hints: ice.map((_, i) => (i % 3 === 1 ? 1 : 0)), light: 0.4, key: 0.5, mottle: 0.2, cavity: 0.5, crease: 0.3 });
  const silver = [P.navy, P.denim, P.sky, P.ice, P.pearl] as const;
  for (const [x, z, turn, k] of [[-0.42, -0.13, 0.25, 1], [0.34, -0.15, Math.PI - 0.2, 1.05], [-0.32, 0.1, 0.05, 0.9], [0.4, 0.09, Math.PI + 0.25, 0.95], [0, 0, 0.5, 0.85]])
    s.at(x, 0.2, z, { ry: turn, scale: k }, () => {
      s.sweep([[-0.26, 0, 0], [-0.17, 0.005, 0], [-0.03, 0.01, 0], [0.12, 0.005, 0], [0.22, 0, 0]], [0.012, 0.058, 0.078, 0.05, 0.014], silver, { ...GOODS, sides: 6, steps: 1, squash: 0.5, cap: 'none', light: 0.3, key: 0.3 });
      face(s, [[0.21, 0, 0], [0.33, 0.005, 0.075], [0.29, 0.005, 0], [0.33, 0.005, -0.075]], [0, 1, 0], [P.navy, P.denim], { skin: 'flat' });
      face(s, [[-0.2, 0.034, 0.012], [-0.185, 0.036, 0.03], [-0.165, 0.038, 0.014]], [0, 1, 0], P.ink, { skin: 'flat', light: 0, cavity: 0 });
    });
}

function produce(s: Shape): void {
  for (const x of [-0.27, 0.3]) s.box(x, 0.045, 0, 0.03, 0.09, 0.66, RAMP.plank, { skin: 'grain', skip: '-y' });
  // Apples in a heap.
  const red = [P.wine, P.brick, P.rust] as const;
  for (const [x, z, y] of [[-0.64, -0.14, 0], [-0.44, -0.16, 0], [-0.54, 0.05, 0], [-0.36, 0.08, 0], [-0.66, 0.2, 0], [-0.5, -0.05, 0.13]].slice(0, fine(s) ? 6 : 4)) ball(s, x, 0.045 + y, z, 0.092, red, 5);
  // Two cabbages, their outer leaves open.
  for (const [x, z] of [[-0.1, -0.13], [0.1, 0.12]]) {
    ball(s, x, 0.045, z, 0.15, [P.pine, P.moss, P.leaf, P.lime], 6, { lump: 0.1, squat: 0.86 });
    if (fine(s)) for (const a of [0.4, 2.5, 4.6]) face(s, [[x + Math.cos(a) * 0.1, 0.06, z + Math.sin(a) * 0.1], [x + Math.cos(a + 0.5) * 0.21, 0.13, z + Math.sin(a + 0.5) * 0.21], [x + Math.cos(a) * 0.19, 0.2, z + Math.sin(a) * 0.19], [x + Math.cos(a - 0.5) * 0.21, 0.13, z + Math.sin(a - 0.5) * 0.21]], [Math.cos(a), 0.6, Math.sin(a)], [P.moss, P.leaf, P.lime], { skin: 'flat' });
  }
  // A bunch of carrots, tops toward the buyer, and two turnips.
  for (let i = 0; i < 4; i++) s.at(0.5 + i * 0.075, 0.085 + (i % 2) * 0.03, 0.2, { rx: -Math.PI / 2 - 0.1, ry: (i - 1.5) * 0.12 }, () => {
    s.cone(0, 0, 0, 0.042, 0.34, 5, [P.rust, P.coral, P.apricot]);
    face(s, [[-0.02, -0.01, 0], [0.02, -0.01, 0], [0.07, -0.16, 0.03], [-0.06, -0.15, 0.04]], [0, -0.2, 1], RAMP.bushLeaf, { skin: 'flat' });
  });
  for (const [x, z] of [[0.47, -0.17], [0.66, -0.12]]) {
    ball(s, x, 0.045, z, 0.085, [P.mauve, P.rose, P.cream, P.ivory], 5, { squat: 0.9 });
    face(s, [[x - 0.03, 0.2, z], [x + 0.03, 0.2, z], [x + 0.06, 0.3, z - 0.03], [x - 0.07, 0.29, z + 0.02]], [0, 0.3, 1], RAMP.bushLeaf, { skin: 'flat' });
  }
}

function pots(s: Shape): void {
  const clay = [P.brick, P.rust, P.coral] as const, o = { ...GOODS, key: 0.55 };
  // A tall jug with a handle.
  s.lathe(-0.56, 0.045, -0.04, [[0.085, 0], [0.15, 0.09], [0.15, 0.24], [0.085, 0.38], [0.07, 0.44], [0.095, 0.49]], clay, { ...o, sides: 8, cap: false });
  s.sweep([[-0.48, 0.45, -0.04], [-0.37, 0.41, -0.04], [-0.36, 0.28, -0.04], [-0.42, 0.21, -0.04]], [0.022, 0.024, 0.024, 0.02], clay, { ...o, sides: 4, steps: 1, cap: 'none' });
  // A wide bowl, cream inside.
  s.lathe(-0.12, 0.045, 0.02, [[0.08, 0], [0.19, 0.06], [0.235, 0.15], [0.225, 0.17]], [P.ochre, P.clay, P.peach, P.cream], { ...o, sides: 8, cap: false });
  s.lathe(-0.12, 0.045, 0.02, [[0.225, 0.17], [0.14, 0.07], [0, 0.05]], [P.sand, P.cream, P.ivory], { ...o, sides: 8, cap: false, light: 0.1 });
  // A lidded crock in the roofs' teal glaze, and two cups.
  s.lathe(0.34, 0.045, -0.06, [[0.1, 0], [0.15, 0.06], [0.16, 0.2], [0.125, 0.27]], [P.tealDeep, P.tealDark, P.teal, P.tealLight], { ...o, sides: 8, cap: false });
  s.lathe(0.34, 0.045, -0.06, [[0.135, 0.265], [0.09, 0.32], [0.035, 0.34], [0, 0.39]], [P.tealDark, P.teal, P.tealPale], { ...o, sides: 6, cap: false });
  for (const [x, z] of [[0.62, 0.14], [0.16, 0.2]]) s.lathe(x, 0.045, z, [[0.05, 0], [0.088, 0.06], [0.09, 0.14], [0.07, 0.12], [0, 0.05]], clay, { ...o, sides: 6, cap: false });
}

/**
 * The goods on a stall's counter: honey, fiber and cloth, bread, fish, produce, pots. Each stands on a tray 1.6 by
 * 0.7 with its foot at y = 0, modest after three thin harvests, each kind its own colour and outline from above.
 */
export function cityStallGoods(v: number, _d: unknown, detail = 1) {
  const s = new Shape(9250 + v, detail);
  tray(s);
  [honey, fiberAndCloth, bread, fish, produce, pots][v](s);
  s.shadowBox(0, 0, 0, 1.6, 0.3, 0.7);
  return s.done();
}

/** Goods hung from a stall's awning, 1.3 from the lowest to the cord's top: a string of onions, fish on a stick, lengths of cloth. */
export function cityHangingGoods(v: number, _d: unknown, detail = 1) {
  const s = new Shape(9270 + v, detail), cord = RAMP.burlap;
  if (v === 0) {
    s.tube([[0, 0.12, 0], [0.02, 0.7, 0], [0, 1.3, 0]], [0.022, 0.022, 0.016], 3, cord, { skin: 'grain' });
    const gold = [P.tan, P.clay, P.peach] as const, red = [P.wine, P.plum, P.mauve] as const;
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, x = Math.cos(a) * 0.1, z = Math.sin(a) * 0.075, y = i * 0.135;
      s.lathe(x, y, z, [[0.012, 0], [0.1, 0.05], [0.12, 0.13], [0.066, 0.215], [0.016, 0.275]], i === 2 || i === 5 ? red : gold, { ...GOODS, sides: 6, cap: false, lump: 0.05, turn: a });
      face(s, [[x, y + 0.265, z], [x * 0.3 + 0.02, y + 0.37, z * 0.3], [x * 0.3 - 0.02, y + 0.36, z * 0.3]], [x, 0, z + 0.01], [P.burlap, P.hay], { skin: 'flat' });
    }
  } else if (v === 1) {
    s.tube([[-0.29, 1.2, 0], [0.29, 1.2, 0]], [0.022, 0.022], 4, RAMP.plank, { skin: 'grain', cap: 'both' });
    s.tube([[-0.2, 1.2, 0], [0, 1.3, 0], [0.2, 1.2, 0]], [0.012, 0.012, 0.012], 3, cord);
    const silver = [P.navy, P.denim, P.ice, P.pearl] as const;
    for (const [x, len] of [[-0.19, 0.95], [0, 1.2], [0.19, 0.86]]) {
      const top = 1.17, k = len / 0.75;
      s.sweep([[x, top, 0], [x, top - 0.1 * k, 0], [x, top - 0.33 * k, 0], [x, top - 0.56 * k, 0], [x, top - 0.7 * k, 0]], [0.014, 0.045, 0.076, 0.058, 0.014], silver, { ...GOODS, sides: 6, steps: 1, squash: 0.5, cap: 'none', light: 0.2, key: 0.6 });
      face(s, [[x, top - 0.02, 0], [x - 0.07, top + 0.03 - 0.0, 0], [x, top - 0.1 * k, 0], [x + 0.07, top + 0.03, 0]], [0, 0, 1], [P.navy, P.denim], { skin: 'flat' });
      face(s, [[x, top - 0.02, 0], [x - 0.07, top + 0.03, 0], [x, top - 0.1 * k, 0], [x + 0.07, top + 0.03, 0]], [0, 0, -1], [P.navy, P.denim], { skin: 'flat' });
      for (const side of [-1, 1]) face(s, [[x - 0.012, top - 0.6 * k, side * 0.03], [x + 0.014, top - 0.6 * k, side * 0.03], [x + 0.001, top - 0.63 * k, side * 0.028]], [0, 0, side], P.ink, { skin: 'flat', light: 0, cavity: 0 });
    }
  } else {
    s.tube([[-0.45, 1.27, 0], [0.45, 1.27, 0]], [0.026, 0.026], 4, RAMP.plank, { skin: 'grain', cap: 'both' });
    const cloths: [number, number, Tone][] = [[-0.29, 1.22, [P.tealDeep, P.tealDark, P.teal, P.tealLight]], [0, 1.08, CREAM], [0.29, 1.27, SAFFRON]];
    for (const [x, len, tone] of cloths) drape(s, x, 1.28, 0.03, 0.27, len, { tone, two: true, cols: 4, rows: 3, folds: 1.3, depth: 0.03, rod: false });
  }
  s.shadowBox(0, 0, 0, 0.5, 1.3, 0.3);
  return s.done();
}

/** A coiled basket standing on y, open, its inside in shade. `handle` arches over it. */
function basket(s: Shape, x: number, z: number, r: number, h: number, sides: number, handle: boolean): void {
  const coils = fine(s) ? 3 : 2, tones: Tone[] = [[P.ochre, P.burlap, P.hay], [P.oak, P.ochre, P.burlap]];
  const wide = (t: number) => r * (0.72 + 0.3 * Math.sin((t * Math.PI) / 2));
  for (let i = 0; i < coils; i++) s.lathe(x, 0, z, [[wide(i / coils), (h * i) / coils], [wide((i + 1) / coils), (h * (i + 1)) / coils]], tones[i % 2], { ...GOODS, sides, cap: false, skin: 'grain' });
  s.lathe(x, 0, z, [[r * 1.02, h], [r * 1.07, h + 0.035], [r * 0.94, h + 0.02], [r * 0.8, h * 0.5], [0, h * 0.45]], [P.oak, P.ochre, P.burlap, P.hay], { ...GOODS, sides, cap: false, skin: 'grain' });
  if (handle) {
    const path: V3[] = [];
    for (let i = 0; i <= 6; i++) { const a = (i * Math.PI) / 6; path.push([x + Math.cos(a) * r, h + Math.sin(a) * r * 0.95, z]); }
    s.sweep(path, path.map(() => 0.028), [P.oak, P.ochre, P.burlap], { ...GOODS, sides: 4, steps: 1, cap: 'none', skin: 'grain' });
  }
}

/** Baskets and sacks for the market's rows: two empty baskets, two sacks of grain, two baskets of produce. */
export function cityBaskets(v: number, _d: unknown, detail = 1) {
  const s = new Shape(9280 + v, detail);
  if (v === 0) {
    basket(s, -0.3, 0, 0.36, 0.44, 8, true);
    basket(s, 0.38, 0.18, 0.25, 0.3, 7, false);
    // A cloth left over the small one's rim.
    drape(s, 0.38, 0.36, 0.44, 0.3, 0.3, { tone: CREAM, cols: 3, rows: 2, folds: 1.2, depth: 0.025, rod: false });
    // A winnowing tray leant against the big one.
    s.at(-0.02, 0.27, 0.33, { rx: 1.05, ry: 0.3 }, () => s.lathe(0, 0, 0, [[0, 0.03], [0.2, 0], [0.27, 0.035], [0.285, 0.07], [0.25, 0.06], [0, 0.045]], [P.oak, P.ochre, P.burlap, P.hay], { ...GOODS, sides: 8, cap: false, skin: 'grain' }));
  } else if (v === 1) {
    const sack = [P.oak, P.burlap, P.burlapLight, P.cream] as const;
    // A full sack tied at its neck, and one rolled open on its grain.
    s.lathe(-0.3, 0, 0, [[0.2, 0], [0.32, 0.08], [0.35, 0.3], [0.27, 0.53], [0.125, 0.63], [0.11, 0.67], [0.2, 0.78]], sack, { ...GOODS, sides: 8, cap: false, lump: 0.09, mottle: 0.3 });
    s.lathe(-0.3, 0.63, 0, [[0.135, 0], [0.135, 0.045]], [P.oak, P.ochre], { ...GOODS, sides: 6, cap: false, skin: 'grain' });
    s.lathe(0.36, 0, 0.18, [[0.17, 0], [0.26, 0.07], [0.27, 0.26], [0.245, 0.34], [0.275, 0.38], [0.24, 0.41], [0.215, 0.37]], sack, { ...GOODS, sides: 8, cap: false, lump: 0.07, mottle: 0.3 });
    s.lathe(0.36, 0, 0.18, [[0.218, 0.37], [0.12, 0.42], [0, 0.435]], [P.ochre, P.gold, P.butter, P.lemon], { ...GOODS, sides: 8, cap: false, lump: 0.05, light: 0.4 });
    // A small sack on its side, spilling a little.
    s.at(0.02, 0.13, 0.36, { rz: Math.PI / 2 - 0.15, ry: -0.5 }, () => s.lathe(0, 0, 0, [[0.03, -0.2], [0.13, -0.15], [0.14, 0.05], [0.085, 0.17], [0.11, 0.24]], sack, { ...GOODS, sides: 6, cap: false, lump: 0.08 }));
    // The grower's leaf mark.
    for (const side of [-1, 1]) face(s, [[-0.3, 0.2, 0.352], [-0.3 + side * 0.09, 0.3, 0.345], [-0.3, 0.38, 0.33]], [0, 0, 1], [P.moss, P.leaf], { skin: 'flat', light: 0, cavity: 0 });
  } else {
    basket(s, -0.3, 0, 0.36, 0.4, 8, false);
    const red = [P.wine, P.brick, P.rust] as const;
    for (const [x, z, y] of [[-0.42, -0.1, 0.28], [-0.2, -0.12, 0.28], [-0.3, 0.1, 0.29], [-0.31, -0.03, 0.4]]) ball(s, x, y, z, 0.115, red, 5);
    basket(s, 0.38, 0.18, 0.25, 0.28, 7, false);
    ball(s, 0.37, 0.19, 0.17, 0.17, [P.pine, P.moss, P.leaf, P.lime], 6, { lump: 0.1, squat: 0.85 });
    for (const [x, turn] of [[0.5, 0.5], [0.53, 0.9]]) s.at(x, 0.3, 0.28, { rx: -1.0, ry: turn }, () => s.cone(0, 0, 0, 0.04, 0.3, 5, [P.rust, P.coral, P.apricot]));
  }
  s.shadowBox(0, 0, 0.05, 1.2, 0.5, 0.8);
  return s.done();
}

// ---------------------------------------------------------------- the bell tower

/**
 * The bell tower over the market street: a square shaft of dressed stone on a battered plinth, steps to its door,
 * and an open belfry of four arches with the bell hung in it, lit at night, under a steep teal roof with a gilt
 * finial. 6.2 square with its steps and eaves, 16.5 high.
 */
export function cityTower(_v: number, _d: unknown, detail = 1) {
  const s = new Shape(9290, detail);
  const H = 2.3, SHAFT = 9, BELL = 2.45, TOP = 12.2;
  const stone: A.StoneOptions = { tone: A.HEARTH, course: 0.85, long: [1.1, 1.9], vary: 0.3, chip: 0.3 };
  const slit = (y: number, w = 0.7, h = 1.7): A.Opening => ({ kind: 'window', x: 0, y, w, h, top: 'arch', frame: 'stone', shutters: false, bars: 'none' });
  const masonry = s.mark();
  const faces: A.Opening[][] = [[{ kind: 'door', x: 0, y: 1, w: 1.25, h: 2.5, top: 'arch', frame: 'stone' }, slit(5.4)], [slit(3.2, 0.55, 1.3)], [slit(6.1, 0.55, 1.3)], [slit(5, 0.55, 1.3)]];
  for (let k = 0; k < 4; k++) s.at(0, 0, 0, (k * Math.PI) / 2, () => {
    A.wall(s, 0, 0, H, 2 * H, SHAFT, { material: 'stone', frame: 'none', plinth: 0, patches: 0, moss: 0, stone, openings: faces[k] });
    A.quoins(s, H, 1, H, SHAFT - 1.36, { tone: DRESSED, course: 0.7, vary: 0.2 });
  });
  // A battered plinth, a string course half way and the cornice the belfry stands on.
  band(s, 0, 0, H, H, [[0.26, 0], [0.26, 0.72], [0.05, 1], [0, 1]], [H0, H1, H2], { stone: 1.5, vary: 0.2 });
  band(s, 0, 0, H, H, [[0, 4.3], [0.1, 4.36], [0.1, 4.52], [0, 4.58]], DRESSED, { stone: 1.3 });
  band(s, 0, 0, H, H, [[0, SHAFT - 0.34], [0.12, SHAFT - 0.22], [0.2, SHAFT], [0.2, SHAFT + 0.2], [0.1, SHAFT + 0.2]], DRESSED, { stone: 1.2 });
  A.steps(s, 0, 0, H + 0.02, 1.9, 1, 1.1, { n: 4, stone: { tone: A.HEARTH, vary: 0.25 } });
  // The belfry: an arch in each face on four corner piers, its inside lit at night.
  const arc: Arc = { r: 1.3, cy: 10.6, spring: 10.6, ring: 0.42 }, floor = SHAFT + 0.2, glow = 0.55;
  for (let k = 0; k < 4; k++) s.at(0, 0, 0, (k * Math.PI) / 2, () => {
    archWall(s, BELL, floor, TOP, BELL, arc, { ...stone, course: 0.72, long: [0.8, 1.4] });
    voussoirs(s, arc, Math.PI, 0, 9, BELL + 0.05, { key: 0.16 });
    // The sill wall across the opening, the opening's cheeks and vault, and the inside of the wall.
    A.ashlar(s, 0, floor, BELL - 0.2, 2 * arc.r, 0.6, 0.4, { ...stone, course: 99, long: [1.1, 1.5], faces: '+z+y' });
    face(s, [[-arc.r, floor, BELL - 0.4], [arc.r, floor, BELL - 0.4], [arc.r, floor + 0.6, BELL - 0.4], [-arc.r, floor + 0.6, BELL - 0.4]], [0, 0, -1], GLOOM, { skin: 'stone', glow });
    for (const side of [-1, 1]) face(s, [[side * arc.r, floor, BELL - 0.7], [side * arc.r, floor, BELL], [side * arc.r, arc.spring, BELL], [side * arc.r, arc.spring, BELL - 0.7]], [-side, 0, 0], [P.slate, P.iron, H0, H1], { skin: 'stone', glow: glow * 0.6 });
    barrel(s, arc, Math.PI, 0, BELL - 0.7, BELL + 0.05, glow * 0.6, [P.slate, P.iron, H0, H1]);
    archBack(s, BELL - 0.7, floor, TOP, BELL - 0.7, arc, glow);
  });
  s.weather(masonry, { moss: 0.6, wear: 0.2 });
  const inside = BELL - 0.7;
  face(s, [[-inside, floor + 0.02, -inside], [-inside, floor + 0.02, inside], [inside, floor + 0.02, inside], [inside, floor + 0.02, -inside]], [0, 1, 0], [P.umber, P.timber, P.oakDark], { skin: 'grain', glow: glow * 0.5 });
  face(s, [[-inside, TOP - 0.02, -inside], [-inside, TOP - 0.02, inside], [inside, TOP - 0.02, inside], [inside, TOP - 0.02, -inside]], [0, -1, 0], [P.umber, P.timber, P.oakDark], { skin: 'grain', glow: glow * 0.5 });
  s.light(0, 10.9, 0);
  // The bell on its headstock.
  A.timber(s, [-inside, 11.7, 0], [inside, 11.7, 0], 0.26);
  s.lathe(0, 10.12, 0, [[0.7, 0], [0.62, 0.1], [0.47, 0.45], [0.41, 0.88], [0.3, 1.14], [0.12, 1.3], [0.1, 1.5]], [P.oak, P.ochre, P.gold, P.butter], { sides: 10, skin: 'flat', cap: false, light: 0.2, key: 0.6, mottle: 0.15, cavity: 0.3 });
  band(s, 0, 0, BELL, BELL, [[0, TOP - 0.3], [0.1, TOP - 0.2], [0.24, TOP], [0.24, TOP + 0.16], [0, TOP + 0.16]], DRESSED, { stone: 1.2 });
  // A steep spire that flares out over the cornice.
  A.roof(s, 0, TOP + 0.1, 0, 2 * BELL, 2 * BELL, { kind: 'hip', rise: 1, overhang: 0.6, course: 0.75, moss: 0.06, tails: 0 });
  A.roof(s, 0, TOP + 0.5, 0, 3.7, 3.7, { kind: 'hip', rise: 3.2, overhang: 0.2, course: 0.8, moss: 0.04, tails: 0 });
  s.lathe(0, TOP + 3.8, 0, [[0.16, 0], [0.2, 0.1], [0.07, 0.26], [0.07, 0.4], [0.17, 0.52], [0.13, 0.68], [0, 0.8]], SAFFRON, { sides: 6, skin: 'flat', light: 0.2, key: 0.6 });
  s.shadowBox(0, 0, 0, 2 * H, TOP, 2 * H);
  s.shadowBox(0, TOP, 0, 5.6, 1.6, 5.6);
  return s.done();
}

// ---------------------------------------------------------------- the back rows of roofs

interface Roofed {
  /** Its middle, in the cluster's space. */
  x: number;
  z: number;
  /** Along its ridge, and across it. */
  w: number;
  d: number;
  eave: number;
  rise: number;
  /** Its ridge runs toward the viewer, so its gable faces +z. */
  turned?: boolean;
  /** How high a stone ground floor stands under the plaster. */
  stone?: number;
  /** A chimney, as far along the ridge from its middle, and how far it stands above the ridge. */
  chimney?: readonly [number, number];
  dormer?: number;
}

/** A plain tiled roof over walls `w` by `d`, its ridge along x: courses that lap, barge boards, a sagging ridge. Cheap, for the far rows. */
function tileRoof(s: Shape, w: number, d: number, eave: number, rise: number, tone: Tone): void {
  const f = fine(s), over = 0.42, verge = 0.38, thick = 0.14, lip = 0.07;
  const W = w / 2 + verge, D = d / 2 + over, pitch = rise / (d / 2), y0 = eave + thick - over * pitch, top = eave + thick + rise;
  const slope = Math.hypot(D, top - y0), rows = f ? Math.max(2, Math.round(slope / 1.15)) : 1, cols = f ? 2 : 1;
  const start = s.mark();
  for (const sg of [1, -1]) {
    const ny = D / slope, nz = (sg * (top - y0)) / slope;
    const at = (u: number, v: number, off: number): V3 => [-W + 2 * W * u, y0 + (top - y0) * v + ny * off, sg * D * (1 - v) + nz * off];
    const pts: number[] = [], uvs: number[] = [], shifts: number[] = [], tris: number[] = [], lips: number[] = [], lipTris: number[] = [];
    for (let r = 0; r < rows; r++) {
      const v0 = r / rows - (r > 0 ? 0.03 : 0), v1 = (r + 1) / rows, shift = (s.r() - 0.5) * 0.18;
      for (let c = 0; c < cols; c++) {
        const i = pts.length / 3, j = lips.length / 3, u0 = c / cols, u1 = (c + 1) / cols;
        for (const [u, v, off] of [[u0, v0, lip], [u1, v0, lip], [u1, v1, 0], [u0, v1, 0]] as const) {
          pts.push(...at(u, v, off));
          uvs.push(u * 2 * W, (1 - v) * slope);
          shifts.push(shift);
        }
        tris.push(i, i + 1, i + 2, i, i + 2, i + 3);
        lips.push(...at(u0, v0, lip), ...at(u1, v0, lip), ...at(u1, v0, r === 0 ? -thick : 0), ...at(u0, v0, r === 0 ? -thick : 0));
        lipTris.push(j, j + 1, j + 2, j, j + 2, j + 3);
      }
    }
    s.mesh(pts, tris, tone, { skin: 'tiles', uvs, shifts, hints: pts.map((_, i) => [0, ny, nz][i % 3]), crease: 0.35, light: 0.2, key: 0.25, mottle: 0.22, cavity: 0.3, moss: 0.05 });
    if (f) s.mesh(lips, lipTris, tone, { skin: 'flat', smooth: false, hints: lips.map((_, i) => [0, -(top - y0), sg * D][i % 3]), light: 0, mottle: 0.1, cavity: 0.3 });
    for (const side of [-1, 1]) face(s, [[side * W, y0 + 0.04, sg * D], [side * W, top + 0.04, 0], [side * W, top - thick - 0.16, 0], [side * W, y0 - thick - 0.16, sg * D]], [side, 0, 0], A.TIMBER, { skin: 'grain' });
    face(s, [at(0, 0, -thick), at(1, 0, -thick), at(1, 1, -thick), at(0, 1, -thick)], [0, -ny, -nz], [P.umber, P.timber, P.oakDark], { light: 0 });
  }
  // The ridge tiles, a shade darker.
  const cap = typeof tone === 'number' ? tone : tone.slice(0, Math.max(2, tone.length - 1));
  for (const sg of [1, -1]) for (let c = 0; c < cols; c++) {
    const x0 = -W - 0.03 + ((2 * W + 0.06) * c) / cols, x1 = -W - 0.03 + ((2 * W + 0.06) * (c + 1)) / cols;
    face(s, [[x0, top + 0.13, 0], [x1, top + 0.13, 0], [x1, top - 0.03, sg * 0.24], [x0, top - 0.03, sg * 0.24]], [0, 1, sg], cap, { skin: 'flat' });
  }
  s.weather(start, { sag: Math.min(0.16, w * 0.02), wear: 0.3 });
}

/** A window on a face toward +z: a timber frame and its glass, lit at night when `lit`. */
function pane(s: Shape, x: number, y: number, z: number, w: number, h: number, lit: boolean): void {
  if (fine(s)) face(s, [[x - w / 2 - 0.08, y - 0.1, z + 0.02], [x + w / 2 + 0.08, y - 0.1, z + 0.02], [x + w / 2 + 0.08, y + h + 0.08, z + 0.02], [x - w / 2 - 0.08, y + h + 0.08, z + 0.02]], [0, 0, 1], A.TIMBER, { skin: 'grain' });
  face(s, [[x - w / 2, y, z + 0.035], [x + w / 2, y, z + 0.035], [x + w / 2, y + h, z + 0.035], [x - w / 2, y + h, z + 0.035]], [0, 0, 1], A.GLASS, { glow: lit ? 1 : 0, light: 0, mottle: 0.3, cavity: 0 });
}

/** One house of a back row: plaster walls on a stone foot, timber at its eaves and gables, a tiled roof, a chimney. */
function backHouse(s: Shape, q: Roofed, n: number): void {
  const teals: Tone[] = [A.TEAL, [P.tealDark, P.teal, P.tealLight, P.tealPale], [P.tealDeep, P.tealDark, P.teal, P.tealPale]];
  s.at(q.x, 0, q.z, q.turned ? Math.PI / 2 : 0, () => {
    const hw = q.w / 2, hd = q.d / 2, foot = q.stone ?? 0;
    // Its four walls. `out` is each wall's way out in the cluster, so the one nobody sees stays bare.
    for (const [turn, across, reach, gable] of [[0, hw, hd, false], [Math.PI / 2, hd, hw, true], [Math.PI, hw, hd, false], [-Math.PI / 2, hd, hw, true]] as const)
      s.at(0, 0, 0, turn, () => {
        const seen = Math.cos(turn + (q.turned ? Math.PI / 2 : 0)) > -0.5;
        if (foot > 0) face(s, [[-across, 0, reach], [across, 0, reach], [across, foot, reach], [-across, foot, reach]], [0, 0, 1], A.HONEY, { skin: 'stone' });
        face(s, [[-across, foot, reach], [across, foot, reach], [across, q.eave, reach], [-across, q.eave, reach]], [0, 0, 1], A.PLASTER, { skin: 'plaster', light: 0.1, key: 0.15 });
        if (gable) {
          face(s, [[-across, q.eave, reach], [across, q.eave, reach], [0, q.eave + q.rise, reach]], [0, 0, 1], A.PLASTER, { skin: 'plaster', light: 0.1, key: 0.15 });
          if (seen && q.rise > 2.2) pane(s, 0, q.eave + 0.45, reach, 0.6, 0.8, (n + 1) % 3 > 0);
        }
        if (!seen) return;
        // The wall plate, a rail at each floor and the corner posts, as boards on the plaster.
        const board = (x0: number, y0: number, x1: number, y1: number) => face(s, [[x0, y0, reach + 0.03], [x1, y0, reach + 0.03], [x1, y1, reach + 0.03], [x0, y1, reach + 0.03]], [0, 0, 1], A.TIMBER, { skin: 'grain' });
        board(-across, q.eave - 0.16, across, q.eave + (gable ? 0.04 : 0));
        if (q.eave - foot > 5) board(-across, q.eave - 3.06, across, q.eave - 2.92);
        if (fine(s)) for (const side of [-1, 1]) board(side * across - (side > 0 ? 0.15 : 0), foot, side * across + (side < 0 ? 0.15 : 0), q.eave - 0.16);
        const count = Math.max(1, Math.round((2 * across) / 2.3));
        for (let i = 0; i < count; i++) {
          const x = -across + ((2 * across) * (i + 0.5)) / count;
          pane(s, x, q.eave - 1.75, reach, 0.7, 1.05, (n + i + (gable ? 1 : 0)) % 3 > 0);
          if (q.eave - foot > 5) pane(s, x, q.eave - 4.7, reach, 0.7, 1.05, (n + i) % 2 > 0);
        }
      });
    tileRoof(s, q.w, q.d, q.eave, q.rise, teals[n % 3]);
    if (q.chimney) {
      const [cx, above] = q.chimney, from = q.eave + q.rise * 0.45, top = q.eave + q.rise + above;
      s.box(cx, from, -hd * 0.35, 0.62, top - from, 0.78, A.HEARTH, { skin: 'limestone', skip: '-y' });
      s.box(cx, top, -hd * 0.35, 0.82, 0.16, 0.98, DRESSED, { skin: 'limestone' });
      s.box(cx, top + 0.16, -hd * 0.35, 0.3, 0.26, 0.3, [P.brick, P.rust, P.coral], { skin: 'flat', skip: '-y' });
    }
    if (q.dormer !== undefined) {
      // A small gabled dormer on the slope toward +z.
      const z0 = hd * 0.62, floor = q.eave + 0.14 + q.rise * (1 - z0 / hd), w = 1.1, h = 0.95, back = z0 - (h + 0.4) / (q.rise / hd);
      face(s, [[q.dormer - w / 2, floor, z0], [q.dormer + w / 2, floor, z0], [q.dormer + w / 2, floor + h, z0], [q.dormer, floor + h + 0.42, z0], [q.dormer - w / 2, floor + h, z0]], [0, 0, 1], A.PLASTER, { skin: 'plaster', light: 0.1 });
      pane(s, q.dormer, floor + 0.2, z0, 0.5, 0.62, n % 2 === 0);
      for (const side of [-1, 1]) {
        face(s, [[q.dormer + side * w / 2, floor, z0], [q.dormer + side * w / 2, floor + h, z0], [q.dormer + side * w / 2, floor + h, back + 0.3]], [side, 0, 0], A.PLASTER, { skin: 'plaster', light: 0.1 });
        face(s, [[q.dormer + side * (w / 2 + 0.16), floor + h - 0.08, z0 + 0.18], [q.dormer, floor + h + 0.5, z0 + 0.18], [q.dormer, floor + h + 0.5, back], [q.dormer + side * (w / 2 + 0.16), floor + h - 0.08, back + 0.3]], [side, 1, 0], teals[(n + 1) % 3], { skin: 'tiles', light: 0.25, key: 0.25 });
      }
    }
    s.shadowBox(0, 0, 0, q.w, q.eave + q.rise * 0.5, q.d);
  });
}

// Each cluster is six houses in three rows that climb toward the back, so from the south only a strip of each
// wall shows over the roof before it: 15.7 wide, 9.8 deep, 13.8 to its tallest chimney.
const ROWS: readonly Roofed[][] = [
  [
    { x: -4.85, z: 2.55, w: 5.2, d: 3.9, eave: 2.9, rise: 2.1, chimney: [-1.4, 1], stone: 1.5 },
    { x: 1.0, z: 2.5, w: 4.0, d: 4.9, eave: 3.7, rise: 2.5, turned: true, stone: 1.5 },
    { x: 5.35, z: 2.1, w: 4.6, d: 4.0, eave: 4.5, rise: 2.3, turned: true, chimney: [0.9, 0.9] },
    { x: -2.4, z: -0.4, w: 6.4, d: 4.2, eave: 6.5, rise: 2.5, chimney: [2.1, 1.1], dormer: -1.3 },
    { x: -5.4, z: -2.75, w: 4.2, d: 3.4, eave: 8.3, rise: 2.2 },
    { x: 3.4, z: -2.5, w: 7.4, d: 3.9, eave: 9.6, rise: 2.6, chimney: [-2.3, 0.95], dormer: 1.4 },
  ],
  [
    { x: -5.0, z: 2.5, w: 4.2, d: 4.0, eave: 3.4, rise: 2.2, turned: true, stone: 1.5 },
    { x: 0.2, z: 2.75, w: 5.0, d: 3.6, eave: 2.9, rise: 2.0, chimney: [1.5, 1], stone: 1.5 },
    { x: 5.15, z: 2.4, w: 4.6, d: 4.2, eave: 3.9, rise: 2.3, chimney: [-1.2, 1] },
    { x: -4.6, z: -0.9, w: 5.8, d: 3.9, eave: 6.8, rise: 2.4, chimney: [-1.9, 1], dormer: 0.9 },
    { x: 4.7, z: -1.0, w: 5.6, d: 3.9, eave: 6.3, rise: 2.4, dormer: -0.8 },
    { x: 0.1, z: -2.4, w: 4.4, d: 4.6, eave: 9.5, rise: 2.9, turned: true, chimney: [0.4, 0.85] },
  ],
];

/**
 * A back row of the city, seen from afar: layered teal roofs with chimneys and dormers and only a strip of warm
 * plaster under each. Variant 0 climbs to the right, 1 to its middle, 2 to the left. Scenery, not housing.
 */
export function cityRoofCluster(v: number, _d: unknown, detail = 1) {
  const s = new Shape(9300 + v, detail), mirror = v === 2 ? -1 : 1;
  ROWS[v === 1 ? 1 : 0].forEach((q, n) => backHouse(s, { ...q, x: q.x * mirror, chimney: q.chimney && [q.chimney[0] * (q.turned ? 1 : mirror), q.chimney[1]], dormer: q.dormer === undefined ? undefined : q.dormer * mirror }, n + v));
  // Two cypresses among the roofs, as the vista has them.
  for (const [x, z, h] of v === 1 ? [[-7.4, 0.2, 7.5], [7.4, -3.8, 9.5]] : [[7.4 * mirror, -0.2, 8.5], [-7.45 * mirror, 0.4, 6.5]])
    s.lathe(x, 0, z, [[0.14, 0], [0.4, 0.7], [0.46, h * 0.35], [0.32, h * 0.75], [0, h]], RAMP.pineLeaf, { sides: 6, skin: 'moss', lump: 0.16, light: 0.3, key: 0.3, mottle: 0.3 });
  s.light(0, 6, 3);
  return s.done();
}

// ---------------------------------------------------------------- the chapel

// The Order's chapel on its rise, to its sheet (assets-src/concept/5-order/chapel.webp): 10 wide, 14 deep, 13 to
// the top of its bellcote. Its brass doors are two leaves hinged at [-1.6, 0.6, 5.66] and [1.6, 0.6, 5.66].
const WHITE = [P.sand, P.plaster, P.plasterLight, P.ivory] as const;
const CHALK = [P.tealDark, P.teal, P.tealLight, P.tealPale] as const;
const BRASS = [P.oak, P.ochre, P.gold, P.butter] as const;
const GILT = [P.ochre, P.gold, P.butter, P.lemon] as const;
const CHAPEL = { wall: 4.1, front: 5.5, back: -3.6, foot: 0.6, eave: 6.3, ridge: 8.95, apse: -3.45 } as const;

/**
 * A stepped buttress against a wall that faces +z, its middle at x: three stages, each narrower and shallower than
 * the one under it, each with a weathered slope on its top. 30 triangles.
 */
function buttress(s: Shape, x: number, top: number): void {
  const stages = [[1.15, 0.9, 0, 0.34 * top], [0.9, 0.6, 0.34 * top, 0.66 * top], [0.7, 0.32, 0.66 * top, 0.92 * top]];
  stages.forEach(([w, out, y0, y1], i) => {
    const next = i < 2 ? stages[i + 1][1] : 0, y2 = i < 2 ? y1 + 0.3 : top, hw = w / 2;
    const pts: number[] = [], hints: number[] = [], tris: number[] = [];
    for (const sx of [-1, 1]) for (const [q, y] of [[0, y0], [out, y0], [out, y1], [next, y2], [0, y2]]) { pts.push(x + sx * hw, y, q); hints.push(sx * 2, y > y1 ? 1 : 0, q > 0 ? 1 : 0); }
    // The front, the slope, and the two cheeks.
    tris.push(1, 6, 7, 1, 7, 2, 2, 7, 8, 2, 8, 3);
    for (const k of [0, 5]) tris.push(k, k + 1, k + 2, k, k + 2, k + 3, k, k + 3, k + 4);
    s.mesh(pts, tris, DRESSED, { skin: 'limestone', crease: 0.5, hints, light: 0.3, key: 0.35, mottle: 0.22, cavity: 0.45, moss: 0.1 });
  });
}

/** A round-headed window of amber glass in a ring of dressed stone, on a wall that faces +z: `w` wide, `h` to its crown, its sill at y. */
function chapelWindow(s: Shape, x: number, y: number, w: number, h: number): void {
  const r = w / 2, spring = y + h - r, n = fine(s) ? 8 : 4;
  s.at(x, 0, 0, 0, () => {
    const pts: number[] = [-r, y, 0.03, r, y, 0.03, r, spring, 0.03, -r, spring, 0.03, 0, spring, 0.03], tris = [0, 1, 2, 0, 2, 3];
    for (let k = 0; k <= n; k++) {
      pts.push(Math.cos((k * Math.PI) / n) * r, spring + Math.sin((k * Math.PI) / n) * r, 0.03);
      if (k > 0) tris.push(4, 4 + k, 5 + k);
    }
    s.mesh(pts, tris, [P.ochre, P.gold, P.lamp, P.lampHot], { skin: 'flat', smooth: false, hints: pts.map((_, i) => (i % 3 === 2 ? 1 : 0)), glow: 1, light: 0, mottle: 0.3, cavity: 0 });
    // Its leads, its stone ring and jambs, and a sill that sheds the rain.
    A.timber(s, [0, y, 0.06], [0, y + h, 0.06], 0.07, [P.oak, P.ochre]);
    A.timber(s, [-r, spring - 0.1, 0.06], [r, spring - 0.1, 0.06], 0.07, [P.oak, P.ochre]);
    voussoirs(s, { r, cy: spring, spring, ring: 0.24 }, Math.PI, 0, 7, 0.07);
    for (const side of [-1, 1]) face(s, [[side * r, y, 0.12], [side * (r + 0.24), y, 0.12], [side * (r + 0.24), spring, 0.12], [side * r, spring, 0.12]], [0, 0, 1], DRESSED, { skin: 'limestone' });
    moulding(s, [-r - 0.34, 0, 0], [r + 0.34, 0, 0], [0, 0, 1], [[0, y - 0.22], [0.2, y - 0.16], [0.2, y - 0.04], [0, y + 0.02]], DRESSED, { stone: 9, caps: 'both' });
    s.light(0, y + h * 0.5, 0.6);
  });
}

/** One leaf of the brass door, hinged at the pen and reaching 1.6 toward the doorway's middle: `side` is the jamb it hangs on. */
function chapelLeaf(s: Shape, side: number): void {
  const pts: number[] = [0, 0, 0, -side * 1.6, 0, 0, -side * 1.6, 4.4, 0], n = fine(s) ? 8 : 4;
  for (let i = 1; i <= n; i++) { const a = (i * Math.PI) / (2 * n); pts.push(-side * (1.6 - 1.6 * Math.sin(a)), 2.8 + 1.6 * Math.cos(a), 0); }
  const tris: number[] = [];
  for (let k = 1; k < pts.length / 3 - 1; k++) tris.push(0, k, k + 1);
  for (const sign of [1, -1]) s.mesh(pts, tris, BRASS, { skin: 'flat', smooth: false, hints: pts.map((_, i) => (i % 3 === 2 ? sign : 0)), light: 0, key: 0.5, mottle: 0.25, cavity: 0.2 });
  // Raised stiles, a rail at the springing, and a ring to pull.
  for (const x of [0.12, 0.8, 1.48]) A.timber(s, [-side * x, 0.05, 0.03], [-side * x, 2.8 + Math.sqrt(Math.max(0, 2.56 - (1.6 - x) ** 2)) - 0.05, 0.03], 0.12, GILT, { height: 0.05, skin: 'flat' });
  A.timber(s, [-side * 0.1, 2.75, 0.035], [-side * 1.5, 2.75, 0.035], 0.12, GILT, { height: 0.05, skin: 'flat' });
  const ring: V3[] = [];
  for (let i = 0; i <= 8; i++) ring.push([-side * 1.22 + 0.14 * Math.cos((i * Math.PI) / 4), 1.55 + 0.14 * Math.sin((i * Math.PI) / 4), 0.09]);
  s.tube(ring, ring.map(() => 0.028), 3, P.butter, { cap: 'none', skin: 'flat' });
}

function chapelFixed(s: Shape): void {
  const C = CHAPEL, stone: A.StoneOptions = { tone: A.HEARTH, vary: 0.25, chip: 0.15 };
  const masonry = s.mark();
  // The nave: lime-washed walls on a stone foot, three windows a side between four buttresses.
  for (const side of [-1, 1]) s.at(0, 0, 0, (side * Math.PI) / 2, () => {
    // Along this wall x runs toward the front on one side and toward the apse on the other.
    const at = (z: number) => -side * z;
    face(s, [[at(C.back), C.foot, C.wall], [at(C.front), C.foot, C.wall], [at(C.front), C.eave, C.wall], [at(C.back), C.eave, C.wall]], [0, 0, 1], WHITE, { skin: 'plaster', light: 0.1, key: 0.15 });
    A.ashlar(s, at((C.back + C.front) / 2), 0, C.wall, C.front - C.back, C.foot, 0.2, { ...stone, course: 99, long: [1.3, 2], faces: '+z+y' });
    for (const z of [-3.0, -0.2, 2.6, 5.05]) s.at(at(z), 0, C.wall, 0, () => buttress(s, 0, 5.75));
    for (const z of [-1.6, 1.2, 3.85]) s.at(0, 0, C.wall, 0, () => chapelWindow(s, at(z), 2.05, 1.2, 2.5));
  });
  // The front: the doorway in its stone arch, the rising sun over it, a buttress at each corner, three steps.
  A.wall(s, 0, C.foot, C.front, 2 * C.wall, C.eave - C.foot, { tone: WHITE, plinth: 0, frame: 'none', patches: 0, moss: 0, stains: false, stone, openings: [{ kind: 'arch', x: 0, y: 0, w: 3.2, h: 4.4, inside: 0.9 }] });
  face(s, [[-C.wall, C.eave, C.front], [C.wall, C.eave, C.front], [0, C.ridge, C.front]], [0, 0, 1], WHITE, { skin: 'plaster', light: 0.1, key: 0.15 });
  for (const x of [-3.5, 3.5]) s.at(x, 0, C.front, 0, () => buttress(s, 0, 5.75));
  A.ashlar(s, 0, 0, C.front, 2 * C.wall + 0.4, C.foot, 0.2, { ...stone, course: 99, long: [1.3, 2], faces: '+z+y' });
  A.steps(s, 0, 0, C.front + 0.12, 5.1, C.foot, 1.35, { n: 3, stone });
  const sun: number[] = [0, 5.72, C.front + 0.07], rays: number[] = [];
  for (let k = 0; k <= 6; k++) { sun.push(Math.cos((k * Math.PI) / 6) * 0.62, 5.72 + Math.sin((k * Math.PI) / 6) * 0.62, C.front + 0.07); if (k > 0) rays.push(0, k, k + 1); }
  s.mesh(sun, rays, GILT, { skin: 'flat', smooth: false, hints: sun.map((_, i) => (i % 3 === 2 ? 1 : 0)), light: 0, key: 0.4, cavity: 0 });
  for (let k = 0; k < 5; k++) {
    const a = ((k + 1) * Math.PI) / 6, c = Math.cos(a), q = Math.sin(a);
    A.timber(s, [c * 0.86, 5.72 + q * 0.86, C.front + 0.06], [c * 1.5, 5.72 + q * 1.5, C.front + 0.06], 0.11, GILT, { height: 0.04, skin: 'flat' });
  }
  // The back of the nave, where the apse takes over.
  face(s, [[-C.wall, 0, C.back], [C.wall, 0, C.back], [C.wall, C.eave, C.back], [0, C.ridge, C.back], [-C.wall, C.eave, C.back]], [0, 0, -1], WHITE, { skin: 'plaster', light: 0.1 });

  // The apse: a round drum under a gilded dome.
  s.lathe(0, 0, C.apse, [[3.5, 0], [3.5, 0.5], [3.38, C.foot], [3.38, 6.5]], WHITE, { sides: 20, skin: 'plaster', cap: false, light: 0.1, key: 0.2, mottle: 0.2 });
  s.lathe(0, 6.4, C.apse, [[3.38, 0], [3.56, 0.14], [3.56, 0.42], [3.4, 0.6], [3.3, 0.62]], A.HEARTH, { sides: 20, skin: 'limestone', cap: false, light: 0.3, key: 0.3 });
  const dome: XY[] = [];
  for (let k = 0; k <= 6; k++) dome.push([3.34 * Math.cos((k * Math.PI) / 12), 3.34 * Math.sin((k * Math.PI) / 12)]);
  s.lathe(0, 7, C.apse, dome, GILT, { sides: 20, skin: 'flat', light: 0.3, key: 0.55, mottle: 0.2, cavity: 0.15 });
  if (fine(s)) for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, rib: V3[] = [];
    for (let i = 0; i <= 4; i++) rib.push([3.37 * Math.cos((i * Math.PI) / 8) * Math.cos(a), 7 + 3.37 * Math.sin((i * Math.PI) / 8), C.apse + 3.37 * Math.cos((i * Math.PI) / 8) * Math.sin(a)]);
    s.tube(rib, rib.map(() => 0.04), 3, P.butter, { cap: 'none', skin: 'flat' });
  }
  s.lathe(0, 10.3, C.apse, [[0.2, 0], [0.12, 0.12], [0.16, 0.26], [0, 0.42]], GILT, { sides: 6, skin: 'flat', key: 0.5 });
  s.weather(masonry, { moss: 0.5, wear: 0.15 });

  // The roof: chalky teal, laid in long panels with a seam between each.
  const over = 0.35, z0 = C.back, z1 = C.front + over, panels = fine(s) ? 9 : 3, eave = C.wall + over, y0 = C.eave - 0.12;
  for (const side of [-1, 1]) {
    const pts: number[] = [], shifts: number[] = [], tris: number[] = [];
    for (let k = 0; k < panels; k++) {
      const a = z0 + ((z1 - z0) * k) / panels, b = z0 + ((z1 - z0) * (k + 1)) / panels, i = pts.length / 3, shift = (s.r() - 0.5) * 0.22;
      pts.push(side * eave, y0, a, side * eave, y0, b, 0, C.ridge + 0.12, b, 0, C.ridge + 0.12, a);
      shifts.push(shift, shift, shift, shift);
      tris.push(i, i + 1, i + 2, i, i + 2, i + 3);
      if (fine(s) && k > 0) A.timber(s, [side * eave, y0 + 0.05, a], [0, C.ridge + 0.17, a], 0.07, [P.tealDark, P.teal], { height: 0.05, skin: 'flat' });
    }
    s.mesh(pts, tris, CHALK, { skin: 'plaster', smooth: false, hints: pts.map((_, i) => [side * 0.6, 1, 0][i % 3]), light: 0.2, key: 0.3, mottle: 0.3, cavity: 0.2, shifts });
    face(s, [[side * eave, y0, z0], [side * eave, y0, z1], [side * eave, y0 - 0.2, z1], [side * eave, y0 - 0.2, z0]], [side, 0, 0], [P.tealDeep, P.tealDark, P.teal], { skin: 'flat' });
    face(s, [[side * eave, y0, z1], [0, C.ridge + 0.12, z1], [0, C.ridge - 0.1, z1], [side * eave, y0 - 0.2, z1]], [0, 0, 1], [P.tealDeep, P.tealDark, P.teal], { skin: 'flat' });
    face(s, [[side * eave, y0 - 0.2, z0], [side * eave, y0 - 0.2, z1], [side * C.wall, C.eave - 0.1, z1], [side * C.wall, C.eave - 0.1, z0]], [0, -1, 0], [P.tealDeep, P.tealDark], { skin: 'flat', light: 0 });
  }
  s.tube([[0, C.ridge + 0.14, z0], [0, C.ridge + 0.14, z1 + 0.04]], [0.11, 0.11], 4, [P.tealDark, P.teal], { cap: 'end', turn: Math.PI / 4 });

  // The bellcote over the front gable: an arch on two piers, the brass bell in it, and its own little roof.
  const arc: Arc = { r: 0.72, cy: 10.55, spring: 10.55, ring: 0.26 }, reach = 1.2, base = 7.6, crown = 11.75, depth = 0.42, zc = C.front - depth;
  for (const turn of [0, Math.PI]) s.at(0, 0, zc, turn, () => {
    archWall(s, reach, base, crown, depth, arc, { tone: DRESSED, course: 0.75, long: [0.5, 0.9], vary: 0.14, chip: 0.1 });
    voussoirs(s, arc, Math.PI, 0, 7, depth + 0.05, { key: 0.1 });
  });
  for (const side of [-1, 1]) {
    face(s, [[side * reach, base, zc - depth], [side * reach, base, zc + depth], [side * reach, crown, zc + depth], [side * reach, crown, zc - depth]], [side, 0, 0], DRESSED, { skin: 'limestone' });
    face(s, [[side * arc.r, base, zc - depth], [side * arc.r, base, zc + depth], [side * arc.r, arc.spring, zc + depth], [side * arc.r, arc.spring, zc - depth]], [-side, 0, 0], [H0, H1, H2], { skin: 'limestone' });
    // Its roof, gable to the front.
    const eaveX = reach + 0.28, top = crown + 1.2;
    face(s, [[side * eaveX, crown, zc - depth - 0.25], [side * eaveX, crown, zc + depth + 0.25], [0, top, zc + depth + 0.25], [0, top, zc - depth - 0.25]], [side, 1, 0], CHALK, { skin: 'plaster', light: 0.2, key: 0.3 });
    for (const e of [-1, 1]) face(s, [[side * eaveX, crown, zc + e * (depth + 0.25)], [0, top, zc + e * (depth + 0.25)], [0, top - 0.2, zc + e * (depth + 0.25)], [side * eaveX, crown - 0.16, zc + e * (depth + 0.25)]], [0, 0, e], [P.tealDeep, P.tealDark, P.teal], { skin: 'flat' });
    face(s, [[side * eaveX, crown - 0.16, zc - depth - 0.25], [side * eaveX, crown - 0.16, zc + depth + 0.25], [side * reach, crown, zc + depth + 0.25], [side * reach, crown, zc - depth - 0.25]], [0, -1, 0], [P.tealDeep, P.tealDark], { skin: 'flat', light: 0 });
  }
  for (const e of [-1, 1]) face(s, [[-reach, crown, zc + e * depth], [reach, crown, zc + e * depth], [0, crown + 1.05, zc + e * depth]], [0, 0, e], DRESSED, { skin: 'limestone' });
  barrel(s, arc, Math.PI, 0, zc - depth - 0.05, zc + depth + 0.05, 0, [H0, H1, H2]);
  A.timber(s, [-arc.r, 10.95, zc], [arc.r, 10.95, zc], 0.2);
  s.lathe(0, 9.75, zc, [[0.5, 0], [0.44, 0.08], [0.33, 0.36], [0.29, 0.72], [0.2, 0.94], [0.08, 1.08], [0.07, 1.2]], BRASS, { sides: 8, skin: 'flat', cap: false, light: 0.2, key: 0.6, mottle: 0.15 });
  s.shadowBox(0, 0, (C.back + C.front) / 2, 2 * C.wall, C.eave + 1, C.front - C.back);
  s.shadowBlob(0, 6.5, C.apse, 3.4, 3.6, 3.4);
  s.shadowBox(0, 0, C.apse, 5, 6.5, 6.4);
}

/** The chapel with its doors shut. */
export function cityChapel(_v = 0, _def?: unknown, detail = 1) {
  const s = new Shape(9310, detail);
  chapelFixed(s);
  for (const side of [-1, 1]) s.at(side * 1.6, CHAPEL.foot, 5.66, 0, () => chapelLeaf(s, side));
  return s.done();
}
/** The chapel in parts, for a door that opens: turn the left leaf toward -PI/2 and the right toward PI/2 about y, at their hinges. */
export function cityChapelParts(detail = 1) {
  const part = (draw: (s: Shape) => void) => { const s = new Shape(9310, detail); draw(s); return s.done(); };
  return { fixed: part(chapelFixed), left: part((s) => chapelLeaf(s, -1)), right: part((s) => chapelLeaf(s, 1)) };
}
