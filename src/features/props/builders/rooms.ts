// act1-rooms-models. The three vaults of act 1 as kits, from the sheets in assets-src/concept/rooms/
// (pumpHouseInside, lampGallery, seedVault): the Pump House's two floors, the Lamp Gallery and the Seed Vault.
// Everything is Hearth limestone (assets-src/concept/stone.md), old brass, muted teal, moss and ochre roots.
//
// A room is put together by src/game/views/ruins-kits.ts from these pieces:
//   vaultWalls   a room's full-height walls, one variant a wall: bays between pilasters, each with its arch
//   vaultLow     the walls nearest the camera, cut low so it sees in
//   vaultFloor   a room's paving, one variant a room
//   vaultEarth   the dark rock a room is dug into, one variant a room, standing `VAULT_EARTH.drop` under the floor
// and the things that stand in them. A wall's face looks toward +z and its run is along x, as `arch.wall`.
// Parts the game moves are separate geometry with the pivot at the origin: `vaultMovingParts`.
import type * as THREE from 'three';
import { Shape, type MeshOptions, type Tone } from '../shape.ts';
import * as arch from '../arch.ts';
import { P, RAMP } from '../palette.ts';

type V3 = [number, number, number];
type XY = readonly [number, number];
const TAU = Math.PI * 2;

const STONE = arch.HEARTH;
const BRASS = [P.oak, P.ochre, P.gold, P.butter] as const;
const TEAL = arch.TEAL;
const LEAF = RAMP.bushLeaf;
const ROOT = [P.bark, P.wood, P.tan, P.clay] as const;
const EARTH = [P.ink, P.ink, P.night] as const;
const WOOD = arch.TIMBER;
const OAK = [P.oakDark, P.oak, P.plank, P.plankLight] as const;
const AMBER = [P.gold, P.lamp, P.lampHot] as const;
/** A lamp that sleeps: pale lavender glass that gives no light. */
const DORMANT = [P.slate, P.mauve, P.rose, P.pearl] as const;
/** The shaded stone at the back of a niche. */
const RECESS = [P.pewter, STONE[0], STONE[1]] as const;
const ASHLAR: arch.StoneOptions = { tone: STONE, skin: 'limestone', course: 1, long: [1.5, 2.3], vary: 0.3 };
/** One flagstone's colour: each stone takes one. */
const FLAGS = [STONE[1], STONE[2], STONE[2], P.sand, P.sandDark, P.burlapLight, STONE[3]] as const;
const WET = [P.iron, P.pewter, STONE[0], P.pewter] as const;
/** Small worn setts: a landing, the line a shaft runs along, the band the arm sweeps. */
const SETTS = [P.burlap, P.sandDark, STONE[1], P.burlapLight, P.ash] as const;

/** The walls: how high the full ones stand and how thick every one is. */
export const VAULT_WALL = { high: 6, thick: 1 } as const;
const H = VAULT_WALL.high, T = VAULT_WALL.thick;
/** The rock round a room goes this far under its floor: `vaultEarth` and the pieces of the trench stand that much lower. */
export const VAULT_EARTH = { drop: 7 } as const;
/** How deep the Pump House's trench is drawn: `vaultChannel`, `vaultBridge` and `vaultOutlet` stand that much under the floor. */
export const VAULT_TRENCH = 0.8;
/** The Seed Vault's wall is sixteen bays round its middle: how far each face is from it, and how wide. */
export const SEED_RING = { apothem: 12.1, bays: 16, width: 2 * 12.1 * Math.tan(Math.PI / 16) } as const;

// ------------------------------------------------------------------------------------------ small forms

/** A leaf: a flat diamond from its stalk to its tip `len` along a direction. */
function leaf(s: Shape, x: number, y: number, z: number, dx: number, dy: number, dz: number, len: number, tone: Tone = LEAF): void {
  const n = Math.hypot(dx, dy, dz) || 1, flat = Math.hypot(dx, dz);
  const ux = dx / n, uy = dy / n, uz = dz / n, px = flat > 0.01 ? -dz / flat : 1, pz = flat > 0.01 ? dx / flat : 0, half = len * 0.3;
  const mx = x + ux * len * 0.45, my = y + uy * len * 0.45, mz = z + uz * len * 0.45;
  s.poly([[x, y, z], [mx + px * half, my, mz + pz * half], [x + ux * len, y + uy * len, z + uz * len], [mx - px * half, my, mz - pz * half]], tone, { two: true, skin: 'flat' });
}

/** A clump of leaves growing out of one place, `r` long, with a few small flowers when `bloom` names their colour. */
function tuft(s: Shape, x: number, y: number, z: number, r: number, count: number, tone: Tone = LEAF, bloom?: number): void {
  const n = s.detail < 1 ? Math.ceil(count * 0.55) : count;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + s.rr(-0.3, 0.3), up = s.rr(0.45, 1.15), c = Math.cos(up);
    leaf(s, x + Math.sin(a) * r * 0.12, y, z + Math.cos(a) * r * 0.12, Math.sin(a) * c, Math.sin(up), Math.cos(a) * c, r * s.rr(0.7, 1.1), tone);
  }
  if (bloom === undefined) return;
  for (let i = 0, m = s.detail < 1 ? 2 : 3; i < m; i++) {
    const a = s.rr(0, TAU), d = r * s.rr(0.25, 0.6), fx = x + Math.sin(a) * d, fz = z + Math.cos(a) * d, fy = y + r * s.rr(0.45, 0.8);
    for (let k = 0; k < 4; k++) leaf(s, fx, fy, fz, Math.sin(k * TAU / 4), 0.5, Math.cos(k * TAU / 4), 0.13, i ? bloom : P.blush);
  }
}

/** Ivy on a face that looks toward +z: a thin stem from (x, y0) to y1 with leaves along it. */
function ivy(s: Shape, x: number, y0: number, y1: number, z: number, spread = 0.3): void {
  const n = Math.max(2, Math.round(Math.abs(y1 - y0) / 0.8)), path: V3[] = [];
  for (let i = 0; i <= n; i++) path.push([x + (i ? s.rr(-spread, spread) : 0), y0 + ((y1 - y0) * i) / n, z + 0.03]);
  s.sweep(path, path.map((_, i) => 0.045 - (0.03 * i) / n), ROOT, { sides: 4, steps: 1, skin: 'bark', cap: 'none' });
  for (let i = 0; i < n; i++) for (let k = 0, m = s.detail < 1 ? 1 : 3; k < m; k++) {
    const t = s.r(), a = path[i] as V3, b = path[i + 1] as V3;
    leaf(s, a[0] + (b[0] - a[0]) * t, Math.max(0.42, a[1] + (b[1] - a[1]) * t), z + 0.05, s.rr(-1, 1), s.rr(-0.9, 0.1), 0.35, s.rr(0.26, 0.42));
  }
}

/**
 * A flat shape in the x-y plane, `d` thick about z: the strip between two curves that run from one end to the
 * other, point for point. A leaf, a blade, the face of an arch.
 */
function slab(s: Shape, upper: readonly XY[], lower: readonly XY[], z: number, d: number, tone: Tone, o: MeshOptions = {}): void {
  const n = upper.length, pts: number[] = [], tris: number[] = [], hints: number[] = [];
  const strip = (base: number): void => { for (let i = 0; i < n - 1; i++) { const a = base + i * 2; tris.push(a, a + 1, a + 3, a, a + 3, a + 2); } };
  for (const side of [1, -1]) {
    const base = pts.length / 3, zz = z + (side * d) / 2;
    for (let i = 0; i < n; i++) { pts.push(upper[i]![0], upper[i]![1], zz, lower[i]![0], lower[i]![1], zz); hints.push(0, 0, side, 0, 0, side); }
    strip(base);
  }
  for (const [curve, other, sign] of [[upper, lower, 1], [lower, upper, 1]] as const) {
    const base = pts.length / 3;
    for (let i = 0; i < n; i++) {
      const hx = (curve[i]![0] - other[i]![0]) * sign, hy = (curve[i]![1] - other[i]![1]) * sign;
      pts.push(curve[i]![0], curve[i]![1], z + d / 2, curve[i]![0], curve[i]![1], z - d / 2);
      hints.push(hx, hy, 0, hx, hy, 0);
    }
    strip(base);
  }
  for (const [i, j] of [[0, 1], [n - 1, n - 2]] as const) {
    const base = pts.length / 3, hx = upper[i]![0] - upper[j]![0], hy = upper[i]![1] - upper[j]![1];
    if (Math.hypot(upper[i]![0] - lower[i]![0], upper[i]![1] - lower[i]![1]) < 0.01) continue;
    for (const p of [upper[i]!, lower[i]!]) { pts.push(p[0], p[1], z + d / 2, p[0], p[1], z - d / 2); hints.push(hx, hy, 0, hx, hy, 0); }
    tris.push(base, base + 1, base + 3, base, base + 3, base + 2);
  }
  s.mesh(pts, tris, tone, { smooth: false, light: 0.2, mottle: 0.12, cavity: 0.2, ...o, hints });
}

/** A leaf carved in shallow relief on a face that looks toward +z, `h` tall, its stalk at (x, y): the ancients' one ornament. */
function carving(s: Shape, x: number, y: number, z: number, h: number, tone: Tone = [STONE[2], STONE[3]]): void {
  const n = 7, left: XY[] = [], right: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, half = Math.sin(Math.PI * t ** 0.8) * h * 0.3;
    left.push([x - half, y + t * h]); right.push([x + half, y + t * h]);
  }
  slab(s, left, right, z + 0.03, 0.06, tone, { skin: 'limestone' });
  s.box(x, y - h * 0.06, z + 0.07, 0.05, h * 1.02, 0.03, BRASS, { skin: 'flat' });
  if (s.detail >= 1) for (const side of [-1, 1]) for (const t of [0.3, 0.52, 0.72]) {
    const reach = Math.sin(Math.PI * t ** 0.8) * h * 0.22;
    s.poly([[x, y + t * h - 0.03, z + 0.075], [x + side * reach, y + t * h + reach * 0.7, z + 0.075], [x, y + t * h + 0.03, z + 0.075]], BRASS, { two: true, skin: 'flat' });
  }
}

/** A seed jar: cream ceramic with a cloth lid tied on and a leaf label. */
function jar(s: Shape, x: number, y: number, z: number, size: number, kind: number): void {
  const body = kind === 2 ? [P.tealDark, P.teal, P.tealPale] : kind === 1 ? [P.clay, P.peach, P.cream] : [P.burlap, P.cream, P.ivory];
  s.at(x, y, z, { scale: size }, () => {
    s.lathe(0, 0, 0, [[0.2, 0], [0.3, 0.1], [0.34, 0.4], [0.25, 0.62], [0.2, 0.7]], body, { sides: 10, skin: 'plaster', cavity: 0.3 });
    s.lathe(0, 0, 0, [[0.22, 0.66], [0.24, 0.76], [0.1, 0.84], [0, 0.85]], kind === 2 ? [P.ochre, P.gold] : [P.rust, P.coral], { sides: 8, skin: 'flat' });
    s.poly([[-0.1, 0.22, 0.345], [0.1, 0.22, 0.345], [0.1, 0.46, 0.345], [-0.1, 0.46, 0.345]], kind === 2 ? P.butter : P.leaf, { skin: 'flat', toward: [0, 0, 1] });
  });
}

/** A lantern's glass and brass, hanging or standing: its foot at y, `h` tall. */
function lantern(s: Shape, x: number, y: number, z: number, h: number, lit: boolean, ring = true): void {
  const r = h * 0.3;
  s.lathe(x, y, z, [[r * 0.5, 0], [r * 0.95, h * 0.07], [r * 0.8, h * 0.16]], BRASS, { sides: 8, skin: 'flat' });
  s.lathe(x, y, z, [[r * 0.72, h * 0.16], [r, h * 0.42], [r * 0.7, h * 0.7]], lit ? AMBER : DORMANT, { sides: 10, glow: lit ? 2 : 0, light: 0.1, cavity: 0, mottle: lit ? 0 : 0.25, skin: lit ? undefined : 'flat' });
  s.lathe(x, y, z, [[r * 0.95, h * 0.7], [r * 1.05, h * 0.75], [r * 0.3, h * 0.92], [0, h * 0.95]], BRASS, { sides: 8, skin: 'flat' });
  for (let k = 0; k < 4; k++) s.box(x + Math.sin(k * TAU / 4 + 0.78) * r * 0.95, y + h * 0.16, z + Math.cos(k * TAU / 4 + 0.78) * r * 0.95, 0.03, h * 0.55, 0.03, BRASS, { skin: 'flat' });
  if (ring) s.lathe(x, y, z, [[0.05, h * 0.93], [0.07, h * 0.98], [0.04, h * 1.03]], BRASS, { sides: 6, skin: 'flat' });
  if (lit) s.light(x, y + h * 0.45, z);
}

/** A brass rail on turned balusters from a to b, on a low stone curb. */
function balustrade(s: Shape, a: V3, b: V3, o: { n?: number; rise?: (t: number) => number; curb?: boolean } = {}): void {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]), n = o.n ?? Math.max(2, Math.round(len / 0.8)), rise = o.rise ?? (() => 0);
  const at = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + rise(t), a[2] + (b[2] - a[2]) * t];
  const top: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const p = at(i / n);
    top.push([p[0], p[1] + 0.92, p[2]]);
    if (i > 0 && i < n) s.lathe(p[0], p[1], p[2], [[0.1, 0], [0.06, 0.12], [0.11, 0.42], [0.05, 0.8], [0.08, 0.9]], BRASS, { sides: 6, skin: 'flat' });
  }
  s.sweep(top, top.map(() => 0.06), BRASS, { sides: 6, steps: 1, skin: 'flat' });
  for (const p of [at(0), at(1)]) {
    arch.stoneBlock(s, p[0], p[1], p[2], 0.46, 1.05, 0.46, { ...ASHLAR, faces: '+z-z+x-x+y' });
    s.shadowBox(p[0], p[1], p[2], 0.46, 1.4, 0.46);
    s.lathe(p[0], p[1] + 1.05, p[2], [[0.2, 0], [0.24, 0.06], [0.1, 0.14], [0.17, 0.3], [0.1, 0.42], [0, 0.46]], BRASS, { sides: 8, skin: 'flat' });
  }
}

/** A toothed brass wheel lying flat, its hub at the origin, `r` to the tips of its teeth. */
function gear(s: Shape, r: number, teeth: number, thick = 0.22): void {
  const rim = r - 0.16;
  s.lathe(0, -thick / 2, 0, [[rim - 0.3, 0], [rim, 0], [rim, thick], [rim - 0.3, thick], [rim - 0.3, 0]], BRASS, { sides: 28, cap: false, skin: 'flat', cavity: 0.2 });
  for (let k = 0; k < teeth; k++) s.at(0, 0, 0, (k / teeth) * TAU, () => s.box(0, -thick / 2, r - 0.1, (rim * TAU) / teeth * 0.5, thick, 0.2, BRASS, { skin: 'flat' }));
  for (let k = 0; k < 6; k++) s.at(0, 0, 0, (k / 6) * TAU, () => s.box(0, -thick * 0.3, rim / 2, 0.18, thick * 0.6, rim - 0.3, BRASS, { skin: 'flat' }));
  s.lathe(0, -thick * 0.8, 0, [[0.34, 0], [0.4, thick * 0.4], [0.4, thick * 1.2], [0.3, thick * 1.6]], BRASS, { sides: 12, skin: 'flat' });
}

// ------------------------------------------------------------------------------------------ walls

type BayKind = 'plain' | 'niche' | 'lamp' | 'window' | 'inlay' | 'jars' | 'rack' | 'shrine' | 'stair' | 'inlet' | 'gap' | 'port';
interface Bay { w: number; kind: BayKind; /** Moves its opening along the bay. */ dx?: number }
interface Run {
  bays: readonly Bay[];
  /** How high it stands. Default the full wall. */
  h?: number;
  /** A pilaster closes its right end, where no wall carries on. */
  close?: boolean;
  /** Its body reaches this far past each end: into the corner behind the wall it meets. */
  reach?: readonly [left: number, right: number];
  /** Which cut ends show. */
  ends?: string;
}
const bay = (w: number, kind: BayKind, dx = 0): Bay => ({ w, kind, dx });

/** A pilaster against the wall at x, with the springing of the vault above it, broken off. */
function pilaster(s: Shape, x: number, w: number, h: number): void {
  const top = h - 1.35;
  arch.stoneBlock(s, x, 0, 0.3, w + 0.26, 0.55, 0.6, { ...ASHLAR, moss: 0.1 });
  s.roundBox(x, 0.55, 0.22, w, top - 0.55, 0.44, STONE, { skin: 'stone', round: 0.05, skip: '-y-z', key: 0.3 });
  arch.stoneBlock(s, x, top, 0.31, w + 0.32, 0.4, 0.62, ASHLAR);
  if (h < 5) return;
  const r = w * 0.44;
  s.sweep([[x, top + 0.4, 0.3], [x, top + 0.95, 0.4], [x, top + 1.5, 0.82], [x, top + 1.85, 1.5]], [r, r, r * 0.96, r * 0.92], STONE, { sides: 4, turn: Math.PI / 4, steps: 2, skin: 'stone', smooth: false, key: 0.3 });
}

function bayOf(s: Shape, x: number, b: Bay, h: number): void {
  const { w, kind } = b, at = x + (b.dx ?? 0), full = h >= 5;
  const openings: arch.Opening[] = [];
  const hole = (y: number, ow: number, oh: number, inside: number, tone: Tone = RECESS): void => { openings.push({ kind: 'arch', x: b.dx ?? 0, y, w: ow, h: oh, top: 'arch', frame: 'stone', inside, insideTone: tone }); };
  const wide = w - 1.7;
  if (full) {
    if (kind === 'niche') hole(0.9, Math.min(2.2, wide), 3.3, 0.05);
    if (kind === 'inlay') hole(0.9, Math.min(2.4, wide), 3.7, 0.05, [P.tealDeep, P.tealDark, P.teal]);
    if (kind === 'lamp') hole(0.75, 1.15, 2.5, 0.1);
    if (kind === 'jars' || kind === 'rack') hole(0.75, wide, 4.1, 0.3);
    if (kind === 'shrine') hole(0, wide, Math.min(5.1, wide / 2 + 2.9), 0.25);
    if (kind === 'stair') hole(0, 2.8, 3.8, 2.4, [P.ink, P.umber, P.wood]);
    if (kind === 'inlet') hole(1.3, 3.8, 3.2, 1.4, [P.night, P.tealDeep, P.tealDark]);
    if (kind === 'gap') hole(0, 3, 3.3, 2.2, [P.ink, P.umber, P.bark]);
    if (kind === 'port') hole(0.25, 1, 1.15, 0.6, [P.ink, P.umber]);
    if (kind === 'window') hole(1.5, 1.7, 3.2, 0.02);
  }
  arch.wall(s, x, 0, 0, w, h, { material: 'stone', depth: 0.5, stone: { ...ASHLAR, moss: 0.06 }, moss: 0.5, openings });
  // The plinth course and the cornice, stopped at an opening that reaches the floor.
  const door = kind === 'shrine' || kind === 'stair' || kind === 'gap' ? openings[0]!.w / 2 + 0.45 : 0;
  for (const [x0, x1] of door ? [[x - w / 2, at - door], [at + door, x + w / 2]] : [[x - w / 2, x + w / 2]]) {
    const n = Math.max(1, Math.round((x1! - x0!) / 2));
    for (let k = 0; k < n; k++) arch.stoneBlock(s, x0! + ((x1! - x0!) * (k + 0.5)) / n, 0, 0.08, (x1! - x0!) / n, 0.5, 0.2, { ...ASHLAR, faces: '+z+y', moss: 0.12 });
  }
  if (full) for (let k = 0, n = Math.max(1, Math.round(w / 2)); k < n; k++) arch.stoneBlock(s, x - w / 2 + (w * (k + 0.5)) / n, h - 0.42, 0.12, w / n, 0.42, 0.28, { ...ASHLAR, faces: '+z+y' });
  if (!full) return;
  const sill = openings[0]?.y ?? 0, ow = openings[0]?.w ?? 0, back = -0.5 - (openings[0]?.inside ?? 0);
  if (kind === 'jars') {
    for (const [k, y] of [sill, sill + 1.25, sill + 2.45].entries()) {
      if (k) s.box(at, y - 0.08, -0.42, ow, 0.08, 0.72, WOOD, { skin: 'grain' });
      const n = Math.floor((ow - 0.3) / 0.66) - (k === 2 ? 1 : 0);
      for (let i = 0; i < n; i++) jar(s, at + (i - (n - 1) / 2) * 0.66 + s.rr(-0.05, 0.05), y, -0.36 + s.rr(-0.08, 0.06), s.rr(0.78, 1.08), Math.floor(s.r() * 3));
    }
  }
  if (kind === 'rack') {
    for (const dx of [-ow / 2 + 0.08, 0, ow / 2 - 0.08]) s.box(at + dx, sill, -0.4, 0.1, 3.3, 0.62, WOOD, { skin: 'grain' });
    for (let k = 0; k < 4; k++) {
      const y = sill + 0.12 + k * 0.8;
      s.box(at, y - 0.07, -0.4, ow - 0.1, 0.07, 0.62, OAK, { skin: 'grain' });
      for (const half of [-1, 1]) for (let i = 0, n = Math.floor((ow / 2 - 0.2) / 0.36); i < n; i++) {
        const bx = at + half * (0.22 + i * 0.36), pick = s.r();
        if (pick < 0.16) continue;
        if (pick < 0.5) jar(s, bx, y, -0.36, s.rr(0.42, 0.56), Math.floor(s.r() * 3));
        else s.box(bx, y, -0.36, 0.3, s.rr(0.24, 0.46), 0.34, [P.ochre, P.clay, P.teal, P.burlap, P.sand][Math.floor(s.r() * 5)]!, { skin: 'flat' });
      }
    }
  }
  if (kind === 'shrine') carving(s, at, 1.35, back, Math.min(2.6, openings[0]!.h - 2.2));
  if (kind === 'inlay') carving(s, at, sill + 0.5, back, 2.2, [P.butter, P.lemon]);
  if (kind === 'stair') for (let i = 0; i < 9; i++) s.box(at, 0, -0.2 - i * 0.3, 2.74, (i + 1) * 0.24, 0.3, STONE, { skin: 'stone', skip: '-y-z', top: [STONE[2], STONE[3]] });
  if (kind === 'inlet') {
    // The grate the river comes through, and the lip it falls from.
    const r = ow / 2, spring = sill + openings[0]!.h - r;
    for (let k = -3; k <= 3; k++) { const u = (k * r) / 3.6; s.box(at + u, sill, -0.42, 0.09, spring - sill + Math.sqrt(r * r - u * u), 0.09, BRASS, { skin: 'flat' }); }
    for (const y of [sill + 0.9, spring]) s.box(at, y, -0.4, ow, 0.1, 0.1, BRASS, { skin: 'flat' });
    s.roundBox(at, sill - 0.42, 0.3, ow + 0.5, 0.42, 0.75, STONE, { skin: 'stone', round: 0.12, key: 0.3 });
    for (const side of [-1, 1]) arch.stoneBlock(s, at + side * (r + 0.42), 0, 0.28, 0.6, sill + 0.5, 0.6, ASHLAR);
  }
  if (kind === 'gap') {
    // Oak roots have come through and pried the stones apart.
    const roots: readonly (readonly [V3[], number[]])[] = [
      [[[at - 1.9, 5.9, 0.2], [at - 2.1, 3.6, 0.5], [at - 1.75, 1.6, 0.55], [at - 2.3, 0.2, 1.3]], [0.42, 0.45, 0.36, 0.2]],
      [[[at + 2.2, 5.8, 0.15], [at + 1.8, 3.9, 0.45], [at + 2.05, 1.8, 0.6], [at + 1.7, 0.2, 1.5]], [0.34, 0.4, 0.34, 0.18]],
      [[[at - 2, 3.5, 0.5], [at - 0.9, 3.95, 0.62], [at + 0.7, 3.8, 0.6], [at + 1.9, 3.6, 0.5]], [0.3, 0.28, 0.26, 0.24]],
    ];
    for (const [path, radii] of roots) s.sweep(path, radii, ROOT, { sides: 8, steps: 3, skin: 'bark', ribs: [5, 0.12], floor: 0, key: 0.3 });
    for (const dx of [-1.9, 1.95]) tuft(s, at + dx, 0.05, 1.1, 0.7, 6);
  }
  if (kind === 'port') s.at(at, 0.78, 0.04, { rx: Math.PI / 2 }, () => s.lathe(0, 0, 0, [[0.4, 0], [0.5, 0.06], [0.5, 0.14], [0.36, 0.18]], BRASS, { sides: 14, skin: 'flat' }));
  if (kind === 'window') {
    // Warm light behind its glass, whatever the hour: a pane under the arch, its bars across it, a sill.
    const r = ow / 2, spring = sill + openings[0]!.h - r, z = back + 0.03, pane: number[] = [at - r, sill, z, at + r, sill, z], tris: number[] = [];
    for (let k = 0; k <= 8; k++) pane.push(at + Math.cos((k * Math.PI) / 8) * r, spring + Math.sin((k * Math.PI) / 8) * r, z);
    for (let k = 1; k < 9; k++) tris.push(0, k, k + 1);
    tris.push(0, 1, 2);
    s.mesh(pane, tris, AMBER, { glow: 2, light: 0, cavity: 0, mottle: 0.2, hints: pane.map((_, i) => (i % 3 === 2 ? 1 : 0)) });
    s.light(at, sill + 1.5, 0.5);
    s.box(at, sill, z + 0.03, 0.07, spring - sill + r, 0.05, WOOD, { skin: 'grain' });
    for (const y of [sill + 0.85, spring]) s.box(at, y, z + 0.03, ow, 0.07, 0.05, WOOD, { skin: 'grain' });
    s.roundBox(at, sill - 0.2, 0.08, ow + 0.5, 0.2, 0.36, STONE, { skin: 'stone', round: 0.05 });
  }
  if (kind === 'plain' && w >= 3) carving(s, x, 2.2, 0.02, 1.5);
}

function run(s: Shape, r: Run): void {
  const h = r.h ?? H, len = r.bays.reduce((sum, b) => sum + b.w, 0), post = (w: number): number => (w < 3 ? 0.46 : 0.7);
  let x = -len / 2;
  for (const b of r.bays) {
    bayOf(s, x + b.w / 2, b, h);
    pilaster(s, x, post(b.w), h);
    // Old growth: ivy up a pilaster here, a vine down from the top there.
    if (s.r() < 0.5) ivy(s, x + s.rr(-0.2, 0.2), 0.3, s.rr(1.8, 3.6), 0.46);
    if (h >= 5 && b.w >= 3 && s.r() < 0.85) ivy(s, x + b.w * s.rr(0.2, 0.8), h + 0.05, h - s.rr(1.4, 3.4), 0.3, 0.25);
    // Small growth at the wall's foot, clear of a way through.
    if (b.w >= 3 && !['shrine', 'stair', 'gap', 'inlet'].includes(b.kind)) for (const u of [0.25, 0.75]) if (s.r() < 0.7) tuft(s, x + b.w * (u + s.rr(-0.1, 0.1)), 0.02, 0.5, s.rr(0.35, 0.55), 6, LEAF, s.r() < 0.4 ? P.mauve : undefined);
    x += b.w;
  }
  if (r.close) pilaster(s, len / 2, post(r.bays[r.bays.length - 1]!.w), h);
  const [left, right] = r.reach ?? [0, 0];
  arch.ashlar(s, (right - left) / 2, 0, -T / 2, len + left + right, h, T, { ...ASHLAR, faces: '+y' + (r.ends ?? ''), moss: 0.07 });
  s.shadowBox(0, 0, -T / 2, len, h, T);
  for (let k = 0, n = Math.round(len / 5); k < n; k++) s.rock(-len / 2 + (len * (k + s.rr(0.3, 0.7))) / n, h - 0.08, -0.45, s.rr(0.9, 1.6), 0.3, 0.7, LEAF, { level: 1, skin: 'moss', seat: false, shadow: false });
}

const WALLS: readonly Run[] = [
  // The sluice chamber: the reward dais under the north wall's great arch, the stair up in its east end; the inlet in the west wall.
  { bays: [bay(4.5, 'niche'), bay(4.5, 'niche'), bay(6, 'shrine'), bay(4.5, 'niche'), bay(4.5, 'stair', 0.75)], close: true, reach: [T, T], ends: '+x' },
  { bays: [bay(3.5, 'niche'), bay(3.5, 'plain'), bay(6, 'inlet'), bay(3.5, 'plain'), bay(3.5, 'niche')], ends: '-x' },
  // The shaft room: windows, and the port the wheel's shaft comes through.
  { bays: [bay(4, 'window'), bay(4, 'window'), bay(4, 'niche'), bay(4, 'window'), bay(4, 'window')], close: true, reach: [T, T], ends: '+x' },
  { bays: [bay(4.5, 'window'), bay(4.5, 'window'), bay(3, 'port'), bay(2, 'plain')], ends: '-x' },
  // The Lamp Gallery: the reward wall, the walkway's six lamp niches, the arena's wall.
  { bays: [bay(4, 'inlay'), bay(6, 'shrine'), bay(4, 'inlay')], close: true, reach: [T, T], ends: '+x' },
  { bays: [bay(0.5, 'plain'), bay(2, 'lamp'), bay(2, 'lamp'), bay(2, 'lamp'), bay(2, 'lamp'), bay(2, 'lamp'), bay(2, 'lamp')], ends: '-x' },
  { bays: [bay(2.5, 'plain'), bay(5, 'niche'), bay(5, 'niche'), bay(5, 'niche')] },
  // The Seed Vault's ring, a bay each.
  { bays: [bay(SEED_RING.width, 'shrine')] },
  { bays: [bay(SEED_RING.width, 'jars')] },
  { bays: [bay(SEED_RING.width, 'rack')] },
  { bays: [bay(SEED_RING.width, 'gap')] },
  { bays: [bay(SEED_RING.width, 'plain')], h: 2.6, ends: '+x-x' },
];
/** The full walls, one variant each (`vaultWalls`). The shaft room's north and west walls have windows that glow. */
export function vaultWalls(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7600 + v, detail);
  run(s, WALLS[v] ?? WALLS[0]!);
  return s.done();
}

interface Low { len: number; gaps?: readonly XY[]; piers?: readonly number[]; h?: number }
const LOWS: readonly Low[] = [
  { len: 26, piers: [-12.4, -6.5, 0, 6.5, 12.4] },
  { len: 20, gaps: [[-3.2, 3.2]], piers: [-9.4, -3.8, 3.8, 9.4] },
  { len: 22, gaps: [[-1, 1]], piers: [-10.4, -5.5, -1.75, 1.75, 5.5, 10.4] },
  { len: 14, piers: [-6.4, 0, 6.4] },
  { len: 6, piers: [-2.5, 2.5] },
  { len: 3, piers: [1] },
  { len: 16, gaps: [[-2.3, 2.3]], piers: [-7.4] },
  { len: 30, piers: [-14.4, -9, -3, 3.5, 5.5, 7.5, 9.5, 11.5, 13.5] },
  { len: SEED_RING.width, piers: [-SEED_RING.width / 2] },
];
/** The walls nearest the camera, cut low (`vaultLow`): a coped sill with a pier here and there. */
export function vaultLow(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7620 + v, detail), o = LOWS[v] ?? LOWS[0]!, h = o.h ?? 0.85;
  const cuts = [-o.len / 2, ...(o.gaps ?? []).flat(), o.len / 2];
  for (let i = 0; i < cuts.length; i += 2) {
    const a = cuts[i]!, b = cuts[i + 1]!;
    arch.ashlar(s, (a + b) / 2, 0, -T / 2, b - a, h, T, { ...ASHLAR, course: 0.85 });
    for (let k = 0, n = Math.max(1, Math.round((b - a) / 2.2)); k < n; k++) arch.stoneBlock(s, a + ((b - a) * (k + 0.5)) / n, h, -T / 2, (b - a) / n, 0.16, T + 0.16, { ...ASHLAR, faces: '+z-z+x-x+y' });
    for (let k = 0, n = Math.round((b - a) / 5); k < n; k++) s.rock(a + ((b - a) * (k + s.rr(0.2, 0.8))) / n, h + 0.12, -T / 2, s.rr(0.7, 1.3), 0.14, 0.6, LEAF, { level: 1, skin: 'moss', seat: false, shadow: false });
  }
  if (v === 7) {
    // Open upper arcade keeps the corridor's height without a solid camera-side wall.
    for (const x of [-12, -4, 4, 12]) s.box(x, h, -0.65, 0.75, 5.2, 0.8, STONE, { bevel: 0.06, skin: 'limestone' });
    for (const x of [-8, 0, 8]) s.sweep([[x - 4, 5.5, -0.65], [x - 2.2, 7, -0.65], [x, 7.8, -0.65], [x + 2.2, 7, -0.65], [x + 4, 5.5, -0.65]], [0.32, 0.32, 0.34, 0.32, 0.32], STONE, { sides: 6, steps: 1, skin: 'limestone', cap: 'none' });
  }
  for (const p of o.piers ?? []) {
    arch.stoneBlock(s, p, 0, -T / 2, 1.1, h + 0.5, T + 0.12, { ...ASHLAR, faces: '+z-z+x-x+y' });
    arch.stoneBlock(s, p, h + 0.5, -T / 2, 1.3, 0.2, T + 0.3, { ...ASHLAR, faces: '+z-z+x-x+y' });
  }
  for (let k = 0, n = Math.round(o.len / 4); k < n; k++) {
    // Ivy over the sill, never across a way through.
    const x = -o.len / 2 + (o.len * (k + s.rr(0.2, 0.8))) / n;
    if (s.r() < 0.7 && !(o.gaps ?? []).some(([a, b]) => x > a - 0.6 && x < b + 0.6)) ivy(s, x, h + 0.1, 0.1, 0.02, 0.25);
  }
  return s.done();
}

// ------------------------------------------------------------------------------------------ floors

/** Flagstones over a rectangle, in staggered courses along x, each stone its own shade with a dark joint round it. */
function paving(s: Shape, x0: number, z0: number, x1: number, z1: number, o: { y?: number; course?: number; long?: XY; tones?: readonly number[]; joint?: number } = {}): void {
  // At low detail the stones are twice as big.
  const coarse = s.detail < 1 ? 2 : 1, y = o.y ?? 0.02, course = (o.course ?? 1) * coarse, [a, b] = (o.long ?? [1.2, 2.2]).map((n) => n * coarse) as [number, number], g = 0.03, tones = o.tones ?? FLAGS;
  s.poly([[x0, y - 0.012, z0], [x0, y - 0.012, z1], [x1, y - 0.012, z1], [x1, y - 0.012, z0]], o.joint ?? P.burlap, { skin: 'limestone', toward: [0, 1, 0] });
  const rows = Math.max(1, Math.round((z1 - z0) / course));
  for (let row = 0; row < rows; row++) {
    const za = z0 + ((z1 - z0) * row) / rows, zb = z0 + ((z1 - z0) * (row + 1)) / rows;
    let x = x0 - (row % 2 ? s.rr(0.4, 0.9) : 0);
    while (x < x1 - 1e-6) {
      const end = x + s.rr(a, b), xa = Math.max(x0, x), xb = Math.min(x1, end), tone = tones[Math.floor(s.r() * tones.length)]!;
      if (xb - xa > 0.12) s.poly([[xa + g, y, za + g], [xa + g, y, zb - g], [xb - g, y, zb - g], [xb - g, y, za + g]], tone, { skin: 'limestone', toward: [0, 1, 0] });
      x = end;
    }
  }
}

/** Flagstones in rings round the origin from r0 out to r1. */
function ringPaving(s: Shape, r0: number, r1: number, o: { y?: number; course?: number; tones?: readonly number[]; long?: number } = {}): void {
  const coarse = s.detail < 1 ? 2 : 1, y = o.y ?? 0.02, tones = o.tones ?? FLAGS, rings = Math.max(1, Math.round((r1 - r0) / ((o.course ?? 1.1) * coarse))), g = 0.03;
  for (let k = 0; k < rings; k++) {
    const ra = r0 + ((r1 - r0) * k) / rings + g, rb = r0 + ((r1 - r0) * (k + 1)) / rings - g;
    const n = Math.max(6, Math.round((TAU * (ra + rb)) / 2 / ((o.long ?? 1.7) * coarse))), turn = s.r(), ga = g / ((ra + rb) / 2);
    for (let i = 0; i < n; i++) {
      const a0 = ((i + turn) / n) * TAU + ga, a1 = ((i + 1 + turn) / n) * TAU - ga, tone = tones[Math.floor(s.r() * tones.length)]!;
      s.poly([[Math.sin(a0) * ra, y, Math.cos(a0) * ra], [Math.sin(a1) * ra, y, Math.cos(a1) * ra], [Math.sin(a1) * rb, y, Math.cos(a1) * rb], [Math.sin(a0) * rb, y, Math.cos(a0) * rb]], tone, { skin: 'limestone', toward: [0, 1, 0] });
    }
  }
}

/** A flat band inlaid in a floor: a ring round (x, z). */
function inlayRing(s: Shape, x: number, z: number, r: number, width: number, tone: Tone, y = 0.028): void {
  const n = s.detail < 1 ? 14 : 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, b = ((i + 1) / n) * TAU;
    s.poly([[x + Math.sin(a) * r, y, z + Math.cos(a) * r], [x + Math.sin(b) * r, y, z + Math.cos(b) * r], [x + Math.sin(b) * (r + width), y, z + Math.cos(b) * (r + width)], [x + Math.sin(a) * (r + width), y, z + Math.cos(a) * (r + width)]], tone, { skin: 'flat', toward: [0, 1, 0] });
  }
}
/** A flat band inlaid in a floor: the outline of a rectangle. */
function inlayFrame(s: Shape, x0: number, z0: number, x1: number, z1: number, width: number, tone: Tone, y = 0.028): void {
  for (const [a, b, c, d] of [[x0, z0, x1, z0 + width], [x0, z1 - width, x1, z1], [x0, z0, x0 + width, z1], [x1 - width, z0, x1, z1]] as const) s.poly([[a, y, b], [a, y, d], [c, y, d], [c, y, b]], tone, { skin: 'flat', toward: [0, 1, 0] });
}
/** Moss and small growth in a floor's joints, scattered over a rectangle. */
function growth(s: Shape, x0: number, z0: number, x1: number, z1: number, n: number): void {
  for (let i = 0, m = s.detail < 1 ? Math.ceil(n / 2) : n; i < m; i++) {
    const x = s.rr(x0, x1), z = s.rr(z0, z1);
    if (s.r() < 0.5) tuft(s, x, 0.02, z, s.rr(0.22, 0.4), 5, LEAF, s.r() < 0.3 ? P.mauve : undefined);
    else s.rock(x, 0, z, s.rr(0.5, 1.1), 0.09, s.rr(0.4, 0.9), LEAF, { level: 1, skin: 'moss', shadow: false });
  }
}

const SMALL = { course: 0.5, long: [0.45, 0.8] } as const;
const PALE = [STONE[3], STONE[3], P.plaster, STONE[2]] as const;
/** A room's paving (`vaultFloor`), its middle at the middle of the room's inside: sluice chamber, shaft room, gallery, seed vault. */
export function vaultFloor(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7640 + v, detail);
  if (v === 0) {
    // 24 by 20: two banks either side of the trench, six wide.
    paving(s, -12, -10, 12, -3.45);
    paving(s, -12, 3.45, 12, 10);
    paving(s, -3, -10, 3, -7.8, { y: 0.03, tones: PALE, long: [1, 1.5] });
    paving(s, 9, -10, 12, -6, { y: 0.03, ...SMALL, tones: SETTS });
    inlayFrame(s, -3.1, -10, 3.1, -7.7, 0.12, BRASS);
    growth(s, -11.6, 4, 11.6, 9.6, 10);
    growth(s, -11.6, -9.4, -4, -4, 5);
  } else if (v === 1) {
    // 20 by 14, less the stairwell in its south-east corner.
    paving(s, -10, -7, 6, 7);
    paving(s, 6, -7, 10, 2);
    paving(s, -10, -4, -2, -3, { y: 0.03, ...SMALL, tones: SETTS });
    paving(s, -3, -1, 0, 1, { y: 0.03, tones: PALE, long: [1, 1.5] });
    inlayFrame(s, -3.1, -1.1, 0.1, 1.1, 0.1, BRASS);
    growth(s, -9.6, -6.4, 5.4, 6.6, 8);
  } else if (v === 2) {
    // 14 by 30: the arena to the north, the walkway six wide down the middle to the south.
    paving(s, -7, -15, 7, 2);
    paving(s, -7, 2, -3, 15, { long: [0.9, 1.5] });
    paving(s, 3, 2, 7, 15, { long: [0.9, 1.5] });
    s.at(0, 0, 8.5, Math.PI / 2, () => paving(s, -6.5, -3, 6.5, 3, { tones: PALE, long: [1.6, 2.4] }));
    inlayFrame(s, -3.08, 2, 3.08, 15, 0.1, TEAL);
    inlayFrame(s, -5.6, -13.4, 5.6, 0.6, 0.14, TEAL);
    inlayRing(s, -0.5, -8.5, 2.6, 0.16, BRASS);
    inlayRing(s, -0.5, -8.5, 1.5, 0.1, TEAL);
    paving(s, -2, -15, 2, -14, { y: 0.03, tones: PALE, long: [1, 1.4] });
    growth(s, -6.6, -14, 6.6, 14.6, 12);
  } else {
    // Round, 24 across: rings of paving, and the band the arm sweeps.
    s.disc(0, 0.008, 0, SEED_RING.apothem + 0.3, 32, P.burlap, { skin: 'limestone' });
    ringPaving(s, 0.9, 5.3);
    ringPaving(s, 5.3, 6.5, { y: 0.03, course: 0.6, long: 0.7, tones: SETTS });
    ringPaving(s, 6.5, SEED_RING.apothem + 0.15);
    s.disc(0, 0.02, 0, 0.9, 12, STONE[3], { skin: 'limestone' });
    inlayRing(s, 0, 0, 5.2, 0.12, BRASS);
    inlayRing(s, 0, 0, 6.5, 0.12, BRASS);
    inlayRing(s, 0, 0, 9.4, 0.1, TEAL);
    for (let i = 0; i < 12; i++) { const a = s.rr(0, TAU), r = s.rr(7, 11.4); growth(s, Math.sin(a) * r, Math.cos(a) * r, Math.sin(a) * r + 0.01, Math.cos(a) * r + 0.01, 1); }
  }
  return s.done();
}

// ------------------------------------------------------------------------------------------ the earth round a room

/**
 * The rock a room is dug into, seen cut away: high behind the full walls, falling into the dark below the low ones.
 * `outline` is the room's outer edge, clockwise seen from above; `tall(i)` says the edge from point i is a full wall.
 */
function earth(s: Shape, outline: readonly XY[], tall: (i: number) => boolean, far = 9): void {
  const D = VAULT_EARTH.drop, n = outline.length;
  const normal = (i: number): XY => { const a = outline[i]!, b = outline[(i + 1) % n]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l]; };
  const ROCK = [P.ink, P.night, P.slate] as const, top = D + H - 0.3;
  for (let i = 0; i < n; i++) {
    const a = outline[i]!, b = outline[(i + 1) % n]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]), [nx, nz] = normal(i);
    if (!tall(i)) continue;
    // Solid ground to the top of the wall, with rock standing out of it along the wall's back.
    s.at((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, Math.atan2(-nx, -nz), () => {
      s.box(0, 0, -4.6, len + 0.6, top, 9.2, EARTH, { skin: 'rock', skip: '-y', top: P.ink });
      // The corner behind the wall before this one is filled too.
      if (tall((i + n - 1) % n)) {
        s.box(-len / 2 - 4.6, 0, -4.6, 9.2, top, 9.2, EARTH, { skin: 'rock', skip: '-y', top: P.ink });
        if (len > 8) s.rock(-len / 2 - s.rr(2.4, 4), top - 1.6, -s.rr(2.4, 4.4), s.rr(5, 6.5), s.rr(3, 4.4), s.rr(4.4, 5.6), ROCK, { level: 2, planes: 7, skin: 'rock', seat: false, shadow: false, key: 0.3, light: 0.2 });
      }
      for (let k = 0, m = Math.max(1, Math.round(len / 5)); k < m; k++) {
        const u = -len / 2 + (len * (k + 0.5)) / m + s.rr(-0.8, 0.8), w = s.rr(4.5, 6.5);
        s.rock(u, top - 1.6, -s.rr(1.6, 3) - w * 0.3, w, s.rr(2.6, 4.6), w * s.rr(0.7, 0.95), ROCK, { level: 2, planes: 7, skin: 'rock', seat: false, shadow: false, key: 0.3, light: 0.2 });
      }
    });
  }
  // Below the low walls: a lip of soil at the floor, then the cut rock going down into the dark.
  const pts: number[] = [], tris: number[] = [], hints: number[] = [], shifts: number[] = [];
  const steps: readonly (readonly [out: number, y: number])[] = [[0, D], [1.6, D - 0.05], [2.7, D - 1.1], [3.6, D - 3.6], [4.6, 0.3], [far, 0.3]];
  let col = 0, before = -1;
  const column = (x: number, z: number, nx: number, nz: number): void => {
    for (const [out, y] of steps) { const j = out > 0 ? s.rr(-0.35, 0.35) : 0; pts.push(x + nx * (out + j), Math.max(0.02, y + (out > 2 ? j : 0)), z + nz * (out + j)); hints.push(nx, 0.6, nz); shifts.push(0.25 - (D - y) * 0.14); }
    if (before >= 0) for (let k = 0; k < steps.length - 1; k++) { const p = before * steps.length + k, q = col * steps.length + k; tris.push(p, q, q + 1, p, q + 1, p + 1); }
    before = col++;
  };
  for (let i = 0; i < n; i++) {
    if (tall(i)) { before = -1; continue; }
    const a = outline[i]!, b = outline[(i + 1) % n]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]), [nx, nz] = normal(i), m = Math.max(1, Math.round(len / 2.6));
    const prev = (i + n - 1) % n, next = (i + 1) % n;
    for (let k = 0; k <= m; k++) {
      // A corner between two low walls is turned once, along the line between them.
      if (k === 0 && !tall(prev)) continue;
      let ox = nx, oz = nz;
      if (k === m && !tall(next)) { const [px, pz] = normal(next), l = Math.hypot(nx + px, nz + pz) || 1; ox = ((nx + px) / l) * 1.3; oz = ((nz + pz) / l) * 1.3; }
      column(a[0] + ((b[0] - a[0]) * k) / m, a[1] + ((b[1] - a[1]) * k) / m, ox, oz);
    }
  }
  s.mesh(pts, tris, [P.ink, P.ink, P.night, P.umber], { hints, shifts, skin: 'rock', light: 0.25, cavity: 0.3, mottle: 0.3, key: 0.2 });
}

/** A rectangular room's outline, `w` by `d` outside its walls: north and west are its full walls. */
const box = (w: number, d: number): XY[] => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
/** The dark rock round a room (`vaultEarth`): sluice chamber, shaft room, gallery, seed vault. It stands `VAULT_EARTH.drop` under the floor. */
export function vaultEarth(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7660 + v, detail);
  if (v < 3) { const [w, d] = ([[26, 22], [22, 16], [16, 32]] as const)[v]!; earth(s, box(w, d), (i) => i === 0 || i === 3); }
  else {
    // The ring's sixteen corners, from the north-west of north round by east; the bays facing the camera are low.
    const r = (SEED_RING.apothem + T) / Math.cos(Math.PI / 16), pts: XY[] = [];
    for (let i = 0; i < 16; i++) { const a = ((i - 0.5) / 16) * TAU; pts.push([Math.sin(a) * r, -Math.cos(a) * r]); }
    earth(s, pts, (i) => i < 3 || i > 9, 9.6);
  }
  return s.done();
}

// ------------------------------------------------------------------------------------------ lamps and small things

/** A lantern on a brass bracket for a wall (`vaultSconce`: dark, lit). Its back is at z = 0. */
export function vaultSconce(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7680, detail);
  s.box(0, 0.5, 0.03, 0.2, 0.5, 0.06, BRASS, { skin: 'flat' });
  s.sweep([[0, 0.72, 0.04], [0, 0.98, 0.22], [0, 0.9, 0.42]], [0.035, 0.035, 0.03], BRASS, { sides: 5, steps: 2, skin: 'flat' });
  lantern(s, 0, 0, 0.42, 0.86, v === 1);
  return s.done();
}

/** A sensor lamp of the Lamp Gallery on its brass foot (`vaultLamp`: dark, lit), and the same on a post for a bank or a bridge (post dark, post lit). */
export function vaultLamp(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7684, detail), lit = v % 2 === 1;
  if (v < 2) {
    s.lathe(0, 0, 0, [[0.3, 0], [0.32, 0.06], [0.14, 0.14], [0.1, 0.3], [0.2, 0.36]], BRASS, { sides: 10, skin: 'flat' });
    lantern(s, 0, 0.3, 0, 1.1, lit);
  } else {
    arch.stoneBlock(s, 0, 0, 0, 0.5, 0.5, 0.5, { ...ASHLAR, faces: '+z-z+x-x+y' });
    s.lathe(0, 0.5, 0, [[0.2, 0], [0.13, 0.1], [0.08, 0.2], [0.07, 0.8], [0.14, 0.86]], BRASS, { sides: 8, skin: 'flat' });
    lantern(s, 0, 1.3, 0, 0.8, lit, false);
    s.shadowBox(0, 0, 0, 0.3, 2, 0.3);
  }
  return s.done();
}

/** A glass eye in its brass ring, looking toward +z (`vaultEye`: dark, lit). It stands on a wall or a pier's face. */
export function vaultEye(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7688, detail);
  s.at(0, 0.3, 0, { rx: Math.PI / 2 }, () => {
    s.lathe(0, 0, 0, [[0.3, 0], [0.3, 0.07], [0.22, 0.12]], BRASS, { sides: 14, skin: 'flat' });
    s.lathe(0, 0, 0, [[0.2, 0.09], [0.14, 0.17], [0, 0.2]], v ? AMBER : DORMANT, { sides: 12, glow: v ? 2 : 0, light: 0.1, cavity: 0, skin: v ? undefined : 'flat' });
  });
  if (v) s.light(0, 0.3, 0.3);
  return s.done();
}

/** A teal banner with the ancients' leaf, hanging 2.6 from its rod (`vaultBanner`). Its back is at z = 0. */
export function vaultBanner(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7690, detail);
  arch.banner(s, 0, 2.6, 0.08, 1.05, 2.6, { tone: [P.tealDeep, P.tealDark, P.teal], emblem: [P.gold, P.butter] });
  return s.done();
}

/** Growth in stone (`vaultPlanter`): a trough of leaves, a trough in flower, a tall plant in a glazed pot. */
export function vaultPlanter(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7692 + v, detail);
  if (v < 2) {
    s.roundBox(0, 0, 0, 1.5, 0.42, 0.62, STONE, { skin: 'stone', round: 0.06, moss: 0.25 });
    s.box(0, 0.36, 0, 1.3, 0.05, 0.44, [P.umber, P.soil], { skin: 'mud' });
    for (const x of [-0.45, 0, 0.45]) tuft(s, x, 0.4, s.rr(-0.08, 0.08), s.rr(0.45, 0.7), 7, LEAF, v ? P.mauve : undefined);
    ivy(s, -0.5, 0.42, 0.05, 0.31, 0.12);
  } else {
    s.lathe(0, 0, 0, [[0.2, 0], [0.32, 0.12], [0.34, 0.4], [0.26, 0.52], [0.3, 0.58]], [P.tealDeep, P.tealDark, P.teal], { sides: 10, skin: 'plaster' });
    s.disc(0, 0.54, 0, 0.26, 8, P.soil, { skin: 'mud' });
    tuft(s, 0, 0.55, 0, 1.15, 9);
    tuft(s, 0, 0.55, 0, 0.6, 6, [P.leaf, P.lime, P.straw]);
  }
  s.shadowBlob(0, 0.4, 0, v < 2 ? 0.8 : 0.55, 0.45, 0.45);
  return s.done();
}

/** Seed jars standing on the floor (`vaultJars`): three together, the tallest a block high; and a row of five. */
export function vaultJars(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7694 + v, detail);
  if (v === 0) {
    jar(s, -0.1, 0, -0.12, 1.25, 0); jar(s, 0.62, 0, 0.1, 0.95, 2); jar(s, 0.12, 0, 0.55, 0.7, 1);
    s.shadowBlob(0.2, 0.4, 0.1, 0.8, 0.5, 0.7);
  } else {
    for (let i = 0; i < 5; i++) jar(s, (i - 2) * 0.62 + s.rr(-0.05, 0.05), 0, s.rr(-0.1, 0.1), s.rr(0.7, 1.05), i % 3);
    s.shadowBox(0, 0, 0, 3, 0.7, 0.6);
  }
  return s.done();
}

/** Things kept (`vaultShelf`): a shelf of books and instruments, a shelf of seed jars. Its back is at z = 0. */
export function vaultShelf(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7696 + v, detail), w = 2.1, h = 2.3;
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) s.box(x, 0, 0.26, 0.12, h, 0.5, WOOD, { skin: 'grain' });
  s.box(0, 0, 0.03, w, h, 0.05, [P.timber, P.oakDark], { skin: 'grain' });
  s.box(0, h, 0.27, w + 0.14, 0.09, 0.58, OAK, { skin: 'grain' });
  s.shadowBox(0, 0, 0.27, w, h, 0.5);
  for (let k = 0; k < 4; k++) {
    const y = 0.1 + k * 0.56;
    s.box(0, y - 0.06, 0.27, w - 0.12, 0.06, 0.48, OAK, { skin: 'grain' });
    let x = -w / 2 + 0.2;
    while (x < w / 2 - 0.25) {
      const pick = s.r();
      if (v === 1 || pick < 0.25) { const size = s.rr(0.42, 0.6); jar(s, x + 0.13, y, 0.3, size, Math.floor(s.r() * 3)); x += 0.36; }
      else if (pick < 0.85) { const bw = s.rr(0.07, 0.13), bh = s.rr(0.3, 0.44); s.box(x + bw / 2, y, 0.3, bw, bh, 0.3, [P.rust, P.tealDark, P.ochre, P.navy, P.plum, P.burlap][Math.floor(s.r() * 6)]!, { skin: 'flat' }); x += bw + 0.012; }
      else x += 0.2;
    }
  }
  return s.done();
}

/** Standing stone (`vaultPier`): the gallery's sight-break pier, its low arena cover pier, the shaft room's column, a lamp's pedestal. */
export function vaultPier(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7700 + v, detail);
  const [w, h] = ([[1, 2.7], [1.3, 1.5], [0.9, 4.2], [0.8, 0.95]] as const)[v] ?? [1, 2.7];
  arch.stoneBlock(s, 0, 0, 0, w + 0.3, 0.3, w + 0.3, { ...ASHLAR, faces: '+z-z+x-x+y' });
  s.roundBox(0, 0.3, 0, w, h - 0.58, w, STONE, { skin: 'stone', round: 0.06, skip: '-y', key: 0.35, moss: 0.05 });
  arch.stoneBlock(s, 0, h - 0.28, 0, w + 0.26, 0.28, w + 0.26, { ...ASHLAR, faces: '+z-z+x-x+y' });
  if (v < 3) s.rock(s.rr(-0.2, 0.2), h - 0.03, s.rr(-0.2, 0.2), w * 0.7, 0.12, w * 0.6, LEAF, { level: 1, skin: 'moss', seat: false, shadow: false });
  s.shadowBox(0, 0, 0, w, h, w);
  if (v < 3) {
    const size = Math.min(1.4, h * 0.5);
    carving(s, 0, 0.3 + (h - 0.58 - size) / 2, w / 2, size);
    s.at(0, 0, 0, Math.PI / 2, () => carving(s, 0, 0.3 + (h - 0.58 - size) / 2, w / 2, size));
    for (let i = 0; i < 3; i++) { const a = s.rr(0, TAU); tuft(s, Math.sin(a) * (w / 2 + 0.25), 0.02, Math.cos(a) * (w / 2 + 0.25), 0.4, 5, LEAF, i ? undefined : P.mauve); }
  }
  if (v === 0) ivy(s, s.rr(-0.3, 0.3), h, h - 1.6, w / 2 + 0.02, 0.2);
  return s.done();
}

/**
 * The reward dais (`vaultDais`: its pedestals 1.5 or 1 either side of its middle): a pale inlaid slab and the two
 * pedestals the keystone and the memory stone lie on, their tops 1.02 over the floor. Its origin is between the two
 * spots; the pedestals stand 0.3 north of it.
 */
export function vaultDais(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7710 + v, detail), sep = v ? 1 : 1.5;
  for (let k = 0; k < 2; k++) s.lathe(0, 0, -0.5, [[1.3 + sep - k * 0.4, 0.04 * k], [1.3 + sep - k * 0.4, 0.04 * k + 0.04]], k ? PALE : BRASS, { sides: 24, skin: k ? 'limestone' : 'flat', capTone: k ? STONE[3] : P.gold });
  inlayRing(s, 0, -0.5, 0.35 + sep, 0.1, TEAL, 0.09);
  for (const side of [-1, 1]) {
    const x = side * sep;
    arch.stoneBlock(s, x, 0.06, -0.3, 0.74, 0.2, 0.74, { ...ASHLAR, faces: '+z-z+x-x+y' });
    s.roundBox(x, 0.26, -0.3, 0.54, 0.58, 0.54, STONE, { skin: 'stone', round: 0.05, skip: '-y' });
    arch.stoneBlock(s, x, 0.84, -0.3, 0.7, 0.18, 0.7, { ...ASHLAR, faces: '+z-z+x-x+y' });
    s.lathe(x, 0.94, -0.3, [[0.27, 0], [0.27, 0.085]], BRASS, { sides: 12, skin: 'flat' });
    carving(s, x, 0.32, -0.02, 0.46);
    s.shadowBox(x, 0, -0.3, 0.6, 1, 0.6);
  }
  return s.done();
}

/** The keystone: a round stone the size of the Old Gate's socket, a brass rim and a leaf on its face (`vaultKeystone`). It lies flat. */
export function vaultKeystone(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7714, detail);
  s.lathe(0, 0, 0, [[0.3, 0], [0.34, 0.03], [0.34, 0.15], [0.3, 0.18]], [STONE[1], STONE[2], STONE[3]], { sides: 20, skin: 'limestone' });
  s.lathe(0, 0, 0, [[0.34, 0.04], [0.37, 0.06], [0.37, 0.12], [0.34, 0.14]], BRASS, { sides: 20, skin: 'flat', cap: false });
  s.at(0, 0.185, 0.16, { rx: -Math.PI / 2 }, () => carving(s, 0, 0, 0, 0.34, [P.teal, P.tealPale]));
  return s.done();
}

/** A vault's memory stone as it lies on its pedestal: plum-sized and dull. Not a prop of its own: the Hall's `memoryStone` is the one in the table. */
export function vaultMemoryStone(detail = 1): THREE.BufferGeometry {
  const s = new Shape(7716, detail);
  s.rock(0, 0, 0, 0.3, 0.24, 0.26, [P.slate, P.iron, P.pewter, P.pearl], { level: 2, planes: 3, skin: 'rock', shadow: false });
  return s.done();
}

// ------------------------------------------------------------------------------------------ the Pump House

/** The trench, 24 by 6 and `VAULT_TRENCH` deep (`vaultChannel`): its bed, its lined banks and their coping. It stands that much under the floor. */
export function vaultChannel(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7720, detail), d = VAULT_TRENCH;
  paving(s, -12, -3, 12, 3, { y: 0.02, tones: WET, joint: P.slate });
  arch.ashlar(s, 0, 0, -3.25, 24, d, 0.5, { ...ASHLAR, tone: [P.pewter, STONE[0], STONE[1], STONE[2]], course: 0.42, faces: '+z', moss: 0.5 });
  arch.ashlar(s, 0, 0, 3.25, 24, d, 0.5, { ...ASHLAR, tone: [P.pewter, STONE[0], STONE[1], STONE[2]], course: 0.42, faces: '-z', moss: 0.5 });
  arch.ashlar(s, -12.25, 0, 0, 0.5, d, 6, { ...ASHLAR, tone: [P.pewter, STONE[0], STONE[1]], course: 0.42, faces: '+x' });
  for (const z of [-3.22, 3.22]) for (let k = 0; k < 12; k++) arch.stoneBlock(s, -11 + k * 2, d - 0.16, z, 2, 0.3, 0.46, { ...ASHLAR, tone: [STONE[1], STONE[2], STONE[3], STONE[3]], faces: '+z-z+y' });
  // Brass bollards along both banks, clear of the bridges.
  for (const z of [-3.22, 3.22]) for (let x = -10.5; x <= 10.6; x += 3) if (Math.abs(Math.abs(x) - 4.5) > 1.9) s.lathe(x, d + 0.14, z, [[0.13, 0], [0.15, 0.05], [0.07, 0.1], [0.07, 0.3], [0.12, 0.36], [0.1, 0.46], [0, 0.5]], BRASS, { sides: 8, skin: 'flat' });
  for (let i = 0; i < 9; i++) s.rock(s.rr(-11.5, 11.5), 0, s.rr(-2.7, 2.7), s.rr(0.4, 0.9), s.rr(0.2, 0.4), s.rr(0.4, 0.8), [P.slate, P.iron, P.pewter], { level: 1, skin: 'rock', shadow: false, moss: 0.4 });
  return s.done();
}

/**
 * A bridge over the trench, 3 wide and 6 long along z (`vaultBridge`): a low stone span on one arch, brass rails
 * and four posts. It stands `VAULT_TRENCH` under the floor, so its deck meets the floor at each end.
 */
export function vaultBridge(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7724, detail), d = VAULT_TRENCH, crown = (t: number): number => 0.14 * Math.sin(Math.PI * t);
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.5) / 8;
    s.box(0, d - 0.22 + crown(t), -3 + t * 6, 3, 0.24, 0.75, FLAGS[k % FLAGS.length]!, { bevel: 0.03, skin: 'limestone' });
  }
  for (const side of [-1, 1]) {
    // The spandrel over its arch, on each side.
    const upper: XY[] = [], lower: XY[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, z = -3 + t * 6, u = Math.abs(z) / 2.5;
      upper.push([z, d + 0.1 + crown(t)]); lower.push([z, u < 1 ? 0.62 * Math.sqrt(1 - u * u) : 0]);
    }
    s.at(side * 1.5, 0, 0, -Math.PI / 2, () => slab(s, upper, lower, 0, 0.3, STONE, { skin: 'limestone', key: 0.3 }));
    balustrade(s, [side * 1.32, d + 0.08, -2.8], [side * 1.32, d + 0.08, 2.8], { n: 7, rise: crown });
  }
  return s.done();
}

/**
 * A sluice on the north bank (`vaultSluice`): two posts and a head beam with its screw, and the flume from the gate
 * down to the trench's edge, 1.4 south of it. The gate itself is `vaultMovingParts().gate`, at its foot.
 */
export function vaultSluice(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7728, detail);
  for (const side of [-1, 1]) {
    arch.stoneBlock(s, side * 1.35, 0, 0, 0.56, 2.5, 0.62, { ...ASHLAR, faces: '+z-z+x-x+y' });
    s.box(side * 1.04, 0, 0, 0.08, 2.4, 0.2, BRASS, { skin: 'flat' });
    arch.stoneBlock(s, side * 0.82, 0, 0.72, 0.3, 0.28, 1.3, { ...ASHLAR, faces: '+z+x-x+y' });
    s.shadowBox(side * 1.35, 0, 0, 0.56, 2.5, 0.62);
  }
  s.shadowBox(0, 2.5, 0, 3.6, 0.5, 0.74);
  arch.stoneBlock(s, 0, 2.5, 0, 3.6, 0.5, 0.74, { ...ASHLAR, faces: '+z-z+x-x+y' });
  s.lathe(0, 3, 0, [[0.36, 0], [0.42, 0.06], [0.42, 0.2], [0.2, 0.26], [0.09, 0.3], [0.09, 0.6], [0.2, 0.66], [0, 0.7]], BRASS, { sides: 12, skin: 'flat' });
  s.at(0, 3.52, 0, { rx: Math.PI / 2 }, () => gear(s, 0.5, 10, 0.08));
  carving(s, 0, 2.56, 0.37, 0.4);
  s.poly([[-0.66, 0.03, 0.1], [-0.66, 0.03, 1.36], [0.66, 0.03, 1.36], [0.66, 0.03, 0.1]], P.pewter, { skin: 'limestone', toward: [0, 1, 0] });
  return s.done();
}

/**
 * The overflow outlet in the low east wall (`vaultOutlet`): a culvert the trench runs out through, its face toward
 * +z, outward. It stands `VAULT_TRENCH` under the floor.
 */
export function vaultOutlet(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7732, detail), d = VAULT_TRENCH, h = d + 1.9;
  arch.wall(s, 0, 0.06, T / 2, 6.4, h, { material: 'stone', depth: 0.6, stone: { ...ASHLAR, course: 0.7, moss: 0.3 }, moss: 0.6, openings: [{ kind: 'arch', x: 0, y: 0, w: 4.4, h: d + 1.25, top: 'arch', frame: 'stone', inside: 0.3, insideTone: [P.night, P.tealDeep] }] });
  arch.ashlar(s, 0, 0, 0, 6.4, h, T, { ...ASHLAR, course: 0.7, faces: '-z+x-x+y', moss: 0.04 });
  for (let k = -2; k <= 2; k++) s.box(k * 0.8, 0, T / 2 - 0.5, 0.09, d + 0.5 + Math.sqrt(Math.max(0, 4.84 - (k * 0.8) ** 2)) * 0.34, 0.09, BRASS, { skin: 'flat' });
  s.roundBox(0, d - 0.5, T / 2 + 0.35, 4.9, 0.4, 0.8, STONE, { skin: 'stone', round: 0.12 });
  carving(s, 0, d + 1.36, T / 2 + 0.02, 0.44);
  return s.done();
}

/**
 * The shaft that comes down from the wheel (`vaultShaft`): its stone foot, the brass shaft to the vault above and
 * the brackets that hold it to the wall behind, at z = -0.9. The gear on it is `vaultMovingParts().gear`, 1.5 up.
 */
export function vaultShaft(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7736, detail);
  s.lathe(0, 0, 0, [[1.05, 0], [1.05, 0.22], [0.86, 0.3], [0.86, 0.55], [0.6, 0.68]], STONE, { sides: 16, skin: 'stone', moss: 0.2 });
  s.lathe(0, 0.62, 0, [[0.5, 0], [0.5, 0.16], [0.3, 0.24], [0.3, 0.5]], BRASS, { sides: 12, skin: 'flat' });
  s.sweep([[0, 1, 0], [0, 6.6, 0]], [0.15, 0.15], BRASS, { sides: 10, steps: 1, skin: 'flat', cap: 'none' });
  s.shadowBox(0, 0, 0, 1.7, 0.6, 1.7);
  for (const y of [2.9, 5.3]) {
    s.lathe(0, y, 0, [[0.2, 0], [0.3, 0.05], [0.3, 0.3], [0.2, 0.35]], BRASS, { sides: 10, skin: 'flat' });
    s.box(0, y + 0.08, -0.45, 0.22, 0.2, 0.9, BRASS, { skin: 'flat' });
    arch.stoneBlock(s, 0, y - 0.25, -0.82, 0.7, 0.75, 0.3, ASHLAR);
  }
  return s.done();
}

/** A bearing the wheel's shaft turns in, 0.78 over the floor (`vaultBearing`). The shaft runs along x. */
export function vaultBearing(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7738, detail);
  arch.stoneBlock(s, 0, 0, 0, 0.5, 0.56, 1, { ...ASHLAR, faces: '+z-z+x-x+y', moss: 0.2 });
  s.at(-0.2, 0.78, 0, { rz: -Math.PI / 2 }, () => s.lathe(0, 0, 0, [[0.3, 0], [0.34, 0.05], [0.34, 0.35], [0.3, 0.4]], BRASS, { sides: 12, skin: 'flat', cap: false }));
  return s.done();
}

/** The lever on its brass-bound block (`vaultLever`: rest, pulled). */
export function vaultLever(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7740, detail);
  arch.stoneBlock(s, 0, 0, 0, 1.2, 0.36, 0.9, { ...ASHLAR, faces: '+z-z+x-x+y' });
  s.box(0, 0.36, 0, 1, 0.07, 0.72, BRASS, { bevel: 0.02, skin: 'flat' });
  for (const z of [-0.2, 0.2]) s.roundBox(0, 0.42, z, 0.42, 0.36, 0.12, BRASS, { round: 0.05, skin: 'flat' });
  s.at(0, 0.62, 0, { rz: v ? -0.7 : 0.7 }, () => {
    s.sweep([[0, 0, 0], [0, 1.15, 0]], [0.085, 0.06], BRASS, { sides: 8, steps: 1, skin: 'flat' });
    s.lathe(0, 1.08, 0, [[0, 0], [0.13, 0.06], [0.16, 0.16], [0.11, 0.27], [0, 0.31]], [P.gold, P.butter, P.lemon], { sides: 10, skin: 'flat' });
  });
  s.at(0, 0.62, 0, { rx: Math.PI / 2 }, () => s.lathe(0, -0.3, 0, [[0.11, 0], [0.11, 0.6]], BRASS, { sides: 8, skin: 'flat' }));
  return s.done();
}

/**
 * The stair down from the shaft room (`vaultStairwell`): a well 4 wide and 5 long, its steps going down toward +z
 * from its north end. It stands 2 under the floor; the water that floods it is the game's.
 */
export function vaultStairwell(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7744, detail);
  arch.steps(s, 0, 0, -2.5, 4, 2, 3.4, { n: 8, stone: ASHLAR });
  s.poly([[-2, 0.02, 0.9], [-2, 0.02, 2.5], [2, 0.02, 2.5], [2, 0.02, 0.9]], P.pewter, { skin: 'limestone', toward: [0, 1, 0] });
  arch.ashlar(s, -2.25, 0, 0, 0.5, 2, 5, { ...ASHLAR, tone: RECESS, faces: '+x', moss: 0.3 });
  arch.ashlar(s, 2.25, 0, 0, 0.5, 2, 5, { ...ASHLAR, tone: RECESS, faces: '-x', moss: 0.3 });
  arch.ashlar(s, 0, 0, 2.75, 4, 2, 0.5, { ...ASHLAR, tone: RECESS, faces: '-z' });
  return s.done();
}

// ------------------------------------------------------------------------------------------ the Lamp Gallery and the Seed Vault

/**
 * A pointed frame of limestone with a leaf at its head, `w` wide and `h` to its point, round an opening `ow` wide
 * and `oh` to its point: the gallery's entrance and the Seed Vault's door. Its front is at z = `d` / 2.
 */
function pointed(s: Shape, w: number, h: number, ow: number, oh: number, d: number): void {
  const shoulder = h - w * 0.36, spring = oh - ow * 0.72, n = 7;
  for (const side of [-1, 1]) {
    const outer: XY[] = [[side * w / 2, 0], [side * w / 2, shoulder]], inner: XY[] = [[side * ow / 2, 0], [side * ow / 2, spring]];
    // A moulding round the opening, proud of both faces.
    const lip = 0.3, ring: XY[] = [[side * (ow / 2 + lip), 0], [side * (ow / 2 + lip), spring]];
    // The opening's head: an arc struck from beyond the middle, so it comes to a point.
    const c = ow * 0.3, R = ow / 2 + c, top = Math.acos(c / R);
    for (let i = 1; i <= n; i++) {
      const t = i / n, a = top * t;
      inner.push([side * (R * Math.cos(a) - c), spring + R * Math.sin(a)]);
      ring.push([side * Math.max(0, (R + lip) * Math.cos(a) - c), spring + (R + lip) * Math.sin(a)]);
      outer.push([side * (w / 2) * (1 - t), shoulder + (h - shoulder) * t]);
    }
    slab(s, outer, inner, 0, d, STONE, { skin: 'limestone', key: 0.35, mottle: 0.22 });
    slab(s, ring, inner, 0, d + 0.16, [STONE[1], STONE[3], STONE[3]], { skin: 'limestone', key: 0.35 });
    // A low buttress either side, coped.
    arch.stoneBlock(s, side * (w / 2 + 0.42), 0, 0, 0.9, 2.3, d + 0.24, { ...ASHLAR, faces: '+z-z+x-x+y' });
    arch.stoneBlock(s, side * (w / 2 + 0.42), 2.3, 0, 1.06, 0.22, d + 0.4, { ...ASHLAR, faces: '+z-z+x-x+y' });
    arch.stoneBlock(s, side * (w / 2 - 0.2), 0, 0, 0.7, 0.5, d + 0.2, { ...ASHLAR, faces: '+z-z+x-x+y', moss: 0.3 });
    arch.stoneBlock(s, side * (ow / 2 + (w - ow) / 4), shoulder - 0.5, 0, (w - ow) / 2 + 0.14, 0.3, d + 0.14, { ...ASHLAR, faces: '+z-z+x-x+y' });
  }
  for (const face of [0, Math.PI]) s.at(0, 0, 0, face, () => carving(s, 0, oh + 0.1, d / 2, Math.min(1.1, h - oh - 0.3)));
}

/** The Lamp Gallery's entrance (`vaultGateway`): a pointed arch 4.6 wide and 5.3 high over a way 2.2 wide, a dead brass lantern either side. */
export function vaultGateway(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7750, detail);
  pointed(s, 4.6, 5.3, 2.2, 3.9, 1.1);
  for (const side of [-1, 1]) s.shadowBox(side * 1.7, 0, 0, 1.2, 4, 1.1);
  for (const side of [-1, 1]) for (const face of [1, -1]) s.at(side * 1.7, 1.5, face * 0.56, face > 0 ? 0 : Math.PI, () => {
    s.sweep([[0, 0.72, 0], [0, 0.95, 0.2], [0, 0.88, 0.36]], [0.035, 0.035, 0.03], BRASS, { sides: 5, steps: 2, skin: 'flat' });
    lantern(s, 0, 0, 0.36, 0.82, false);
  });
  ivy(s, -2.1, 4, 1.2, 0.56, 0.25);
  ivy(s, 1.7, 4.4, 2.6, 0.56, 0.25);
  return s.done();
}

/** The Seed Vault's sealed door (`vaultDoor`): the pointed frame, two oak leaves shut, Calla's gold sun across them. */
export function vaultDoor(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7754, detail), ow = 3, oh = 3.7;
  pointed(s, 5.2, 4.9, ow, oh, 1.1);
  s.shadowBox(0, 0, 0, 5.2, 3.8, 1.1);
  // The leaves fill the opening: planks under the point, drawn as a slab that follows it.
  const spring = oh - ow * 0.72, c = ow * 0.3, R = ow / 2 + c, top = Math.acos(c / R);
  for (const side of [-1, 1]) {
    const edge: XY[] = [[side * (ow / 2), 0], [side * (ow / 2), spring]], mid: XY[] = [[0, 0], [0, spring]];
    for (let i = 1; i <= 6; i++) { const a = (top * i) / 6; edge.push([side * (R * Math.cos(a) - c), spring + R * Math.sin(a)]); mid.push([0, spring + R * Math.sin(a)]); }
    slab(s, edge, mid, 0, 0.24, side < 0 ? [P.oakDark, P.oak, P.plank] : [P.oakDark, P.oak, P.plankLight], { skin: 'grain', mottle: 0.25 });
    for (const face of [1, -1]) {
      for (const y of [0.5, 2.1]) s.box(side * ow / 4, y, face * 0.13, ow / 2 - 0.16, 0.12, 0.03, [P.slate, P.iron], { skin: 'flat' });
      s.at(side * 0.34, 1.3, face * 0.14, { rx: Math.PI / 2 }, () => s.lathe(0, -0.03, 0, [[0.13, 0], [0.17, 0.02], [0.17, 0.05], [0.13, 0.06], [0.13, 0]], BRASS, { sides: 10, cap: false, skin: 'flat' }));
    }
  }
  // The seal: a sun, on both faces so it reads from inside the vault.
  for (const face of [1, -1]) s.at(0, 2.45, face * 0.15, { rx: (face * Math.PI) / 2 }, () => {
    s.lathe(0, 0, 0, [[0.36, 0], [0.36, 0.04], [0.24, 0.07], [0, 0.08]], [P.gold, P.butter, P.lemon], { sides: 14, skin: 'flat' });
    for (let k = 0; k < 12; k++) s.at(0, 0, 0, (k / 12) * TAU, () => s.poly([[-0.07, 0.03, 0.38], [0.07, 0.03, 0.38], [0, 0.03, k % 2 ? 0.62 : 0.74]], [P.gold, P.butter], { two: true, skin: 'flat' }));
  });
  ivy(s, -2.3, 4, 0.8, 0.56, 0.3);
  ivy(s, 2.2, 3.4, 0.4, 0.56, 0.3);
  return s.done();
}

/** One blade of the Harvester's claw: a broad blunt leaf from the wrist at the origin toward -x, edged in brass. */
function blade(s: Shape, z: number, splay: number): void {
  const upper: XY[] = [[0.1, 0.34], [-0.55, 0.62], [-1.2, 0.58], [-1.75, 0.2], [-2.05, -0.5], [-2.12, -1.05]];
  const lower: XY[] = [[0.1, -0.3], [-0.4, -0.3], [-0.95, -0.34], [-1.4, -0.52], [-1.8, -0.86], [-2.12, -1.05]];
  s.at(0, 0, z, splay, () => {
    for (const face of [-1, 1]) {
      const points: V3[] = [], triangles: [number, number, number][] = [];
      for (let i = 0; i < upper.length; i++) {
        const a = upper[i]!, b = lower[i]!;
        points.push([a[0], a[1], face * 0.07], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, face * (i === 5 ? 0.07 : 0.22)], [b[0], b[1], face * 0.07]);
        if (i) for (let j = 0; j < 2; j++) { const k = i * 3 + j; triangles.push([k - 3, k, k + 1], [k - 3, k + 1, k - 2]); }
      }
      s.mesh(points.flat(), triangles.flat(), BRASS, { hints: points.flatMap(() => [0, 0, face]), skin: 'flat', key: 0.7, mottle: 0.42, cavity: 0.65 });
    }
    // Shallow leaf engraving follows the raised blade ridge on both faces.
    for (const face of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = -0.45 - i * 0.43, y = 0.13 - i * i * 0.1, z = face * 0.225;
      s.poly([[x + 0.12, y, z], [x - 0.04, y + 0.19, z], [x - 0.3, y + 0.22, z], [x - 0.13, y + 0.02, z]], [P.tealDeep, P.tealDark, P.teal], { two: true, skin: 'flat' });
    }
    s.sweep(upper.map(([x, y]): V3 => [x, y + 0.03, 0]), [0.09, 0.1, 0.1, 0.09, 0.07, 0.04], [P.oak, P.ochre, P.gold], { sides: 6, steps: 2, skin: 'flat' });
    s.sweep(lower.map(([x, y]): V3 => [x, y - 0.02, 0]), [0.06, 0.06, 0.06, 0.06, 0.05, 0.04], [P.oak, P.ochre, P.gold], { sides: 5, steps: 1, skin: 'flat' });
    for (const side of [-1, 1]) s.sweep([[-0.1, 0.02, side * 0.1], [-1, 0.14, side * 0.1], [-1.8, -0.5, side * 0.1]], [0.045, 0.055, 0.03], TEAL, { sides: 4, steps: 2, skin: 'flat' });
  });
}

/** Recessed axle plate with a bright rim and a dark hub, facing out along local y. */
function axlePlate(s: Shape, r: number): void {
  s.lathe(0, 0, 0, [[r, 0], [r * 0.84, 0.045], [r * 0.72, 0.025], [r * 0.3, 0.025]], [P.oakDark, P.oak, P.ochre], { sides: 16, skin: 'flat', key: 0.7, mottle: 0.38 });
  s.lathe(0, 0.025, 0, [[r * 0.22, 0], [r * 0.22, 0.055]], BRASS, { sides: 6, skin: 'flat' });
  for (let i = 0; i < 2; i++) {
    const a = i * TAU / 2;
    s.lathe(Math.cos(a) * r * 0.6, 0.035, Math.sin(a) * r * 0.6, [[r * 0.08, 0], [r * 0.08, 0.035]], BRASS, { sides: 4, skin: 'flat' });
  }
}

/** A brass wheel of a joint on its side, its axle along z, flanged at both rims. */
function joint(s: Shape, x: number, y: number, r: number, w: number): void {
  if (x !== 0) for (const side of [-1, 1]) s.at(x, y, side * w / 2, { rx: side * Math.PI / 2 }, () => axlePlate(s, r * 0.8));
  s.at(x, y, 0, { rx: Math.PI / 2 }, () => s.lathe(0, -w / 2, 0, [[r * 0.84, 0], [r, w * 0.1], [r, w * 0.26], [r, w * 0.74], [r, w * 0.9], [r * 0.84, w]], BRASS, { sides: 18, skin: 'flat', key: 0.65, mottle: 0.35 }));
}

/** The Wild Harvester's arm from its shoulder at the origin, reaching 6 toward -x: counterweight, upper arm, elbow, forearm, wrist and claw. */
function armOf(s: Shape): void {
  const start = s.mark();
  const limb = [STONE[1], STONE[2], STONE[3]] as const;
  // The counterweight: a brass barrel behind the shoulder.
  s.at(0.45, 0, 0, { rz: -Math.PI / 2 }, () => s.lathe(0, 0, 0, [[0.36, 0], [0.52, 0.12], [0.56, 0.62], [0.5, 1.02], [0.3, 1.14], [0, 1.18]], BRASS, { sides: 14, skin: 'flat', key: 0.3 }));
  s.sweep([[0.1, 0.05, 0], [-1.05, 0.46, 0], [-2.1, 0.62, 0]], [0.56, 0.6, 0.56], limb, { sides: 12, steps: 2, squash: 0.8, skin: 'limestone', key: 0.3 });
  s.sweep([[-2.1, 0.62, 0], [-3.1, 0.56, 0], [-3.9, 0.2, 0]], [0.56, 0.5, 0.4], limb, { sides: 12, steps: 2, squash: 0.8, skin: 'limestone', key: 0.3 });
  // Brass along both edges, and the leaf inlaid along its back.
  for (const side of [-1, 1]) s.sweep([[0, 0.1, side * 0.52], [-1.05, 0.46, side * 0.56], [-2.1, 0.62, side * 0.52], [-3.1, 0.56, side * 0.46], [-3.9, 0.2, side * 0.36]], [0.1, 0.1, 0.1, 0.09, 0.08], BRASS, { sides: 6, steps: 2, skin: 'flat' });
  s.sweep([[-0.5, 0.72, 0], [-1.2, 0.98, 0], [-2.1, 1.1, 0], [-3.1, 0.98, 0], [-3.6, 0.66, 0]], [0.08, 0.2, 0.24, 0.2, 0.08], TEAL, { sides: 6, steps: 2, squash: 0.35, skin: 'flat' });
  joint(s, 0, 0, 0.74, 1.36);
  joint(s, -2.1, 0.62, 0.62, 1.24);
  joint(s, -3.9, 0.2, 0.46, 1.04);
  // The spring under the elbow.
  const coil: V3[] = [];
  for (let i = 0; i <= 18; i++) { const t = i / 18, a = t * TAU * 4; coil.push([-0.7 - t * 1.1 + Math.cos(a) * 0.05, -0.85 + t * 1.05 + Math.sin(a) * 0.22, Math.cos(a) * 0.22]); }
  s.sweep(coil, coil.map(() => 0.05), BRASS, { sides: 5, steps: 1, skin: 'flat' });
  s.at(-3.9, 0.2, 0, 0, () => { blade(s, 0.32, 0.16); blade(s, -0.32, -0.16); });
  s.weather(start, { wear: 0.5, soot: 0.22, sootReach: 1.2 });
}

/** Broad tarnish and rubbed highlights baked into brass, including the cap interiors.
 * Applied once at construction; the moving arm carries its paint as it turns. */
function agedBrass(g: THREE.BufferGeometry, height = 0): THREE.BufferGeometry {
  const p = g.getAttribute('position'), c = g.getAttribute('color');
  for (let i = 0; i < p.count; i++) {
    const r = c.getX(i), green = c.getY(i), b = c.getZ(i);
    if (r < green * 1.15 || b > green * 0.72) continue;
    const x = p.getX(i), y = p.getY(i) - height, z = p.getZ(i);
    const cloud = Math.sin(x * 3.1 + y * 2.3) * Math.cos(z * 3.7 - y * 1.2);
    const shade = 0.77 + 0.22 * cloud;
    c.setXYZ(i, r * shade, green * shade, b * shade);
  }
  return g;
}

/** The arm's fixed base (`vaultArm`: the base alone as the game stands it, and the whole machine at rest): its shoulder is 3 over the floor. */
export function vaultArm(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7760, detail);
  s.lathe(0, 0, 0, [[1.6, 0], [1.6, 0.22], [1.36, 0.3], [1.36, 0.62], [1.1, 0.74]], STONE, { sides: 20, skin: 'stone', moss: 0.2 });
  s.lathe(0, 0.3, 0, [[1.39, 0], [1.39, 0.14]], TEAL, { sides: 20, skin: 'flat', cap: false });
  s.lathe(0, 0.72, 0, [[1.1, 0], [1.14, 0.06], [1.14, 0.2], [0.82, 0.3]], BRASS, { sides: 20, skin: 'flat' });
  for (let k = 0; k < 14; k++) s.at(0, 0, 0, (k / 14) * TAU, () => s.box(0, 0.74, 1.14, 0.2, 0.18, 0.16, BRASS, { skin: 'flat' }));
  s.lathe(0, 1, 0, [[0.8, 0], [0.7, 0.9], [0.62, 1.3]], [STONE[1], STONE[2], STONE[3]], { sides: 14, skin: 'limestone' });
  // The yoke: a round brass cheek either side of the shoulder, each on its post.
  for (const z of [-0.8, 0.8]) {
    s.at(0, 3, z + Math.sign(z) * 0.1, { rx: Math.sign(z) * Math.PI / 2 }, () => axlePlate(s, 0.72));
    s.at(0, 3, z, { rx: Math.PI / 2 }, () => s.lathe(0, -0.1, 0, [[0.84, 0], [0.9, 0.04], [0.9, 0.16], [0.84, 0.2]], BRASS, { sides: 18, skin: 'flat', key: 0.3 }));
    s.box(0, 2.1, z, 0.46, 0.5, 0.2, BRASS, { skin: 'flat' });
  }
  // The concept notes make the low support optional. Companion holding is driven by the keeper,
  // so omit a fixed saddle that cannot follow this arm's rotating forearm.
  s.shadowBox(0, 0, 0, 2.3, 2.4, 2.3);
  if (v === 1) s.at(0, 3, 0, 0, () => armOf(s));
  const geometry = agedBrass(s.done(), 3);
  // The whole machine is for looking at: its middle is moved under it.
  if (v === 1) geometry.translate(2.2, 0, 0);
  return geometry;
}

/** A root pod (`vaultPod`): a low cluster of bulbs, leaves out of its crown, roots at its foot. */
export function vaultPod(_v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7764, detail), bulb = [P.wood, P.tan, P.clay, P.peach] as const;
  s.rock(0, 0, 0, 1.25, 1, 1.2, bulb, { level: 2, planes: 2, lump: 0.08, skin: 'flat', key: 0.4, shadow: false });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.4, r = s.rr(0.5, 0.62);
    s.rock(Math.sin(a) * r, 0, Math.cos(a) * r, s.rr(0.6, 0.8), s.rr(0.5, 0.72), s.rr(0.6, 0.8), bulb, { level: 2, planes: 2, lump: 0.08, skin: 'flat', key: 0.4, shadow: false });
    s.sweep([[Math.sin(a) * 0.8, 0.22, Math.cos(a) * 0.8], [Math.sin(a) * 1.2, 0.1, Math.cos(a) * 1.2], [Math.sin(a + 0.3) * 1.55, 0.02, Math.cos(a + 0.3) * 1.55]], [0.1, 0.07, 0.03], ROOT, { sides: 5, steps: 2, skin: 'bark', floor: 0 });
  }
  s.shadowBlob(0, 0.5, 0, 1.2, 0.6, 1.2);
  tuft(s, 0, 0.92, 0, 1.1, 9, LEAF, P.mauve);
  tuft(s, 0, 0.92, 0, 0.6, 6, [P.leaf, P.lime, P.straw]);
  return s.done();
}

/**
 * Oak roots (`vaultRoot`): one that has come over a wall and down its face to the floor (its wall is at z = 0, 6
 * high), and one that creeps along the floor at the wall's foot.
 */
export function vaultRoot(v: number, _d: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7768 + v, detail), o = { sides: 8, steps: 3, skin: 'bark', ribs: [5, 0.12], floor: 0, key: 0.3 } as const;
  if (v === 2) {
    // A rooted rear crown: the open centre remains a window onto the fight and memory.
    s.sweep([[-5.8, 0.12, 0.4], [-5.4, 3.4, 0.25], [-4.7, 6.3, 0], [-2.4, 8.2, 0.4], [0.2, 8.8, 0.7], [3.4, 8.1, 0.3], [6, 6.3, 0]], [0.3, 0.7, 0.95, 0.9, 0.8, 0.65, 0.28], ROOT, { ...o, sides: 10, steps: 2 });
    s.sweep([[5.8, 0.1, 0.3], [5.3, 3.6, 0.1], [4.6, 6.4, 0.1], [2.4, 7.6, 0.8], [-0.3, 8.2, 1.1], [-3.6, 7.6, 0.7]], [0.2, 0.55, 0.7, 0.6, 0.5, 0.15], ROOT, { ...o, sides: 10, steps: 2 });
    for (const x of [-4, -1, 2, 4]) tuft(s, x, 7.8, 0.8, 0.65, 5);
  } else if (v === 0) {
    s.sweep([[0.7, 6.5, -1], [0.35, 6.25, 0.25], [-0.5, 4.8, 0.6], [0.35, 3.3, 0.68], [-0.45, 1.8, 0.8], [0.1, 0.55, 1.2], [-1.1, 0.12, 2.6]], [0.5, 0.48, 0.42, 0.38, 0.34, 0.28, 0.1], ROOT, o);
    s.sweep([[-0.2, 4.6, 0.6], [-1, 3.2, 0.52], [-1.5, 1.2, 0.6], [-2.2, 0.1, 1.2]], [0.3, 0.26, 0.2, 0.08], ROOT, o);
    s.sweep([[0.25, 2.6, 0.62], [1, 1.3, 0.7], [1.5, 0.3, 1.2], [2.6, 0.08, 1.7]], [0.26, 0.22, 0.16, 0.06], ROOT, o);
    for (const [x, y] of [[-0.6, 5.2], [0.5, 3.4], [-1.2, 2.2], [0.9, 1.6]] as const) tuft(s, x, y, 0.9, 0.5, 5);
  } else {
    s.sweep([[-3, 0.1, 0.5], [-1.4, 0.34, 0.75], [0.2, 0.3, 0.5], [1.8, 0.4, 0.9], [3.2, 0.06, 1.4]], [0.12, 0.32, 0.36, 0.3, 0.08], ROOT, o);
    s.sweep([[0, 0.3, 0.6], [0.8, 0.26, 1.5], [0.6, 0.05, 2.4]], [0.24, 0.18, 0.05], ROOT, o);
    for (const x of [-1.8, 0.6, 2.4]) tuft(s, x, 0.3, 1, 0.45, 5, LEAF, x > 0 ? P.mauve : undefined);
  }
  return s.done();
}

// ------------------------------------------------------------------------------------------ what the game moves

/**
 * The parts the game moves, each with its pivot at the origin:
 *   shaft   the wheel's shaft, 9.3 long along x; turn it about x
 *   gear    a brass gear 1.3 in radius lying flat; turn it about y (stand it up to turn it about x)
 *   pinion  a small gear, 0.62 in radius, the same way
 *   gate    a sluice's brass gate, 2 wide and 1.6 high, its foot at the origin; lift it along y
 *   bars    the gallery's bars, 14 wide and 2.7 high, their foot at the origin; lift them along y
 *   arm     the Wild Harvester's arm, its shoulder at the origin, reaching toward -x; turn it about y
 */
export function vaultMovingParts(detail = 1): Record<'shaft' | 'gear' | 'pinion' | 'gate' | 'bars' | 'arm', THREE.BufferGeometry> {
  const shaft = new Shape(7780, detail);
  shaft.sweep([[-4.65, 0, 0], [4.65, 0, 0]], [0.16, 0.16], BRASS, { sides: 10, steps: 1, skin: 'flat' });
  for (const x of [-3.9, -1.3, 1.3, 3.9]) shaft.at(x, 0, 0, { rz: Math.PI / 2 }, () => shaft.lathe(0, -0.1, 0, [[0.24, 0], [0.24, 0.2]], BRASS, { sides: 6, skin: 'flat' }));
  const big = new Shape(7781, detail);
  gear(big, 1.3, 20);
  const small = new Shape(7782, detail);
  gear(small, 0.62, 10);
  const gate = new Shape(7783, detail);
  gate.box(0, 0, 0, 2, 1.6, 0.1, [P.oak, P.ochre, P.gold], { skin: 'flat' });
  for (const x of [-0.66, 0, 0.66]) gate.box(x, 0, 0, 0.1, 1.6, 0.16, BRASS, { skin: 'flat' });
  for (const y of [0, 0.75, 1.5]) gate.box(0, y, 0, 2.06, 0.1, 0.18, BRASS, { skin: 'flat' });
  gate.box(0, 1.6, 0, 0.12, 1, 0.12, BRASS, { skin: 'flat' });
  for (const z of [-0.06, 0.06]) gate.at(0, 0, z, z > 0 ? 0 : Math.PI, () => carving(gate, 0, 0.42, 0, 0.7, TEAL));
  const bars = new Shape(7784, detail);
  for (let x = -6.75; x <= 6.76; x += 0.5) {
    bars.box(x, 0, 0, 0.09, 2.5, 0.09, BRASS, { skin: 'flat' });
    bars.cone(x, 2.5, 0, 0.08, 0.24, 4, [P.gold, P.butter], { skin: 'flat' });
  }
  for (const y of [0.35, 2.1]) bars.box(0, y, 0, 13.9, 0.1, 0.12, BRASS, { skin: 'flat' });
  const arm = new Shape(7785, detail);
  armOf(arm);
  return { shaft: shaft.done(), gear: big.done(), pinion: small.done(), gate: gate.done(), bars: bars.done(), arm: agedBrass(arm.done()) };
}
