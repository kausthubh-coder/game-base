// The land of Greenhollow: the shape the plan (src/game/content/greenhollow.ts) gives the ground inside the map.
// The terrain (src/features/world/terrain.sim.ts) asks this for every column inside the map and a margin round
// it, and eases into its own noise land outside. Everything here is a pure function of the plan and the seed,
// so the page, the chunk worker, the far land and a test get the same ground.
//
// The order a column is shaped in:
//   1. the kinds of land, blended: meadow downs, the Old Forest's hollows, the marsh at the water line, the cave
//      hills' rock shelves; the ridges the eye follows; the Hall's hill; the terraces' giant steps
//   2. the region plan's vales and knolls round your plot and the town (land.sim.ts)
//   3. the river Mere, its valley, its banks and the falls; the High Road's corridor under its arches
//   4. the paths, graded so the slope is always walkable
//   5. level pads under the landmarks, and the banks of land behind a door set into a hill
//   6. the region plan's levels and basins: your plot, the dead garden and the town stay exactly as they were
import { fbm2, smoothstep } from '../../features/world/noise.sim.ts';
import {
  BIOMES, HALL_HILL, HIGH_ROAD, LANDMARKS, LANDMARK_SIZES, MAP_SIZE, PATHS, PLACES, RIDGES, RIVER, TERRACES,
  toMap, toWorld, type MapPoint,
} from '../content/greenhollow.ts';
import { BEE_TREES, GLADES, PLANTED_OAKS } from '../content/wilds-forest.ts';
import { biomeGrid, placeAt } from './greenhollow.sim.ts';

/** Water fills every open cell below this y: the terrain's own number, kept here so this file needs no terrain. */
export const WATER_Y = 18;
/** The High Road's deck: where feet stand on it. */
export const DECK_Y = WATER_Y + HIGH_ROAD.deck;

const W = MAP_SIZE.w, H = MAP_SIZE.h;
/** The map in game columns. */
const X0 = toWorld([0, 0]).x, Z0 = toWorld([0, 0]).z, X1 = X0 + W, Z1 = Z0 + H;
/** Blocks past the map's edge over which its land eases into the noise land outside. */
export const EDGE = 48;

const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** How much of the map's land a column is: 1 inside the map, falling to 0 over EDGE blocks outside it. */
export function mapWeight(x: number, z: number): number {
  const dx = x < X0 ? X0 - x : x > X1 ? x - X1 : 0, dz = z < Z0 ? Z0 - z : z > Z1 ? z - Z1 : 0;
  if (dx === 0 && dz === 0) return 1;
  return ease(1 - Math.hypot(dx, dz) / EDGE);
}

/** How far a column lies outside the map, in blocks: 0 inside. The far mountains rise with it. */
export function outside(x: number, z: number): number {
  const dx = x < X0 ? X0 - x : x > X1 ? x - X1 : 0, dz = z < Z0 ? Z0 - z : z > Z1 ? z - Z1 : 0;
  return Math.hypot(dx, dz);
}

// ------------------------------------------------------------------------------------------ lines

interface Near { d: number; seg: number; t: number }

/** The nearest point of a line through points: its distance, its segment and how far along it. */
function nearLine(points: readonly (readonly [number, number])[], x: number, y: number, out: Near): Near {
  out.d = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i][0], ay = points[i][1], dx = points[i + 1][0] - ax, dy = points[i + 1][1] - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < out.d) { out.d = d; out.seg = i; out.t = t; }
  }
  return out;
}
const near = { d: 0, seg: 0, t: 0 };

// ------------------------------------------------------------------------------------------ grids

/** Grids cover the map and EDGE blocks round it, a cell every STEP blocks. */
const STEP = 4;
const GX0 = X0 - EDGE, GZ0 = Z0 - EDGE, GW = Math.ceil((W + 2 * EDGE) / STEP) + 1, GH = Math.ceil((H + 2 * EDGE) / STEP) + 1;
const B = BIOMES.length;

/** How much of each kind of land is round each cell: the share of the 25 by 25 blocks round it that is each. */
let weightGrid: Float32Array | null = null;
function weights(): Float32Array {
  if (weightGrid) return weightGrid;
  const g = biomeGrid();
  weightGrid = new Float32Array(GW * GH * B);
  const R = 12, S = 3;
  let n = 0;
  for (let dz = -R; dz <= R; dz += S) for (let dx = -R; dx <= R; dx += S) n++;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const [mx, my] = toMap(GX0 + i * STEP, GZ0 + j * STEP);
    const o = (j * GW + i) * B;
    for (let dz = -R; dz <= R; dz += S) for (let dx = -R; dx <= R; dx += S) {
      const cx = Math.min(W - 1, Math.max(0, Math.round(mx + dx))), cy = Math.min(H - 1, Math.max(0, Math.round(my + dz)));
      weightGrid[o + g[cy * W + cx]] += 1 / n;
    }
  }
  return weightGrid;
}

/** The blended share of each kind of land at a column, written into `out`. */
export function landShares(x: number, z: number, out: Float32Array): Float32Array {
  const g = weights();
  const fx = Math.min(GW - 1.001, Math.max(0, (x - GX0) / STEP)), fz = Math.min(GH - 1.001, Math.max(0, (z - GZ0) / STEP));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = (j * GW + i) * B, b = a + B, c = a + GW * B, d = c + B;
  for (let k = 0; k < B; k++) out[k] = (g[a + k] * (1 - u) + g[b + k] * u) * (1 - v) + (g[c + k] * (1 - u) + g[d + k] * u) * v;
  return out;
}
const shares = new Float32Array(B);
const MEADOW = BIOMES.indexOf('meadow'), OLD = BIOMES.indexOf('oldForest'), GREY = BIOMES.indexOf('greyForest'), MARSH = BIOMES.indexOf('marsh');
const HILLS = BIOMES.indexOf('caveHills'), TERR = BIOMES.indexOf('terraces'), TOWN = BIOMES.indexOf('town');

// ------------------------------------------------------------------------------------------ the river

/** How far a column is from the river's bank in blocks (below 0 in the water), and the water's level there. */
export function riverAt(x: number, z: number, out: { bank: number; level: number; falls: number }): { bank: number; level: number; falls: number } {
  const [mx, my] = toMap(x, z);
  nearLine(RIVER.points, mx, my, near);
  const half = RIVER.half[near.seg] + (RIVER.half[near.seg + 1] - RIVER.half[near.seg]) * near.t;
  out.bank = near.d - half * (0.85 + 0.3 * fbm2(mx / 18, my / 18, 711, 2));
  out.level = near.seg < RIVER.falls ? RIVER.high : WATER_Y;
  // How close to the lip of the falls, 1 at it.
  const [fx, fy] = RIVER.points[RIVER.falls];
  out.falls = Math.max(0, 1 - Math.hypot(mx - fx, my - fy) / 14);
  return out;
}
const river = { bank: 0, level: 0, falls: 0 };

/** The y water fills to at a column: the river above the falls stands high in its gorge, all other water at WATER_Y. */
export function waterLevelAt(x: number, z: number): number {
  if (mapWeight(x, z) <= 0) return WATER_Y;
  const my = toMap(x, z)[1];
  if (my > RIVER.points[RIVER.falls][1] + 20) return WATER_Y;
  riverAt(x, z, river);
  return river.level !== WATER_Y && river.bank < 3 ? river.level : WATER_Y;
}

// ------------------------------------------------------------------------------------------ the terraces

/** How far inside the terraces a column is: 0 at the centre, 1 on the lowest ring's edge. */
function terraceR(x: number, z: number): number {
  const [mx, my] = toMap(x, z);
  const dx = (mx - TERRACES.center[0]) / TERRACES.rx, dy = (my - TERRACES.center[1]) / TERRACES.ry;
  return Math.hypot(dx, dy) * (1 + 0.025 * (fbm2(mx / 30, my / 30, 731, 2) - 0.5));
}

/** How many steps up a column stands, 0 to 4, rising smoothly up the stair and sharply everywhere else. */
function terraceSteps(x: number, z: number): number {
  const r = terraceR(x, z);
  if (r > 1.04) return 0;
  const [mx, my] = toMap(x, z);
  // The stair: a corridor up the south face, where each face is a run of RUN blocks instead of a cliff.
  const across = Math.abs(mx - TERRACES.stair.x);
  const onStair = my > TERRACES.center[1] ? ease((TERRACES.stair.half + 1.5 - across) / 1.5) : 0;
  const RUN = 12;
  let steps = 0;
  for (const ring of TERRACES.rings) {
    // In blocks, how far inside this ring's edge the column is, measured along the short axis.
    const inside = (ring - r) * TERRACES.ry;
    const sharp = smoothstep(-0.6, 0.6, inside);
    const ramp = Math.min(1, Math.max(0, inside / RUN));
    steps += lerp(sharp, ramp, onStair);
  }
  return steps;
}

/** The ground of a terrace step at a column: the foot, then a level step every TERRACES.rise blocks. */
export function terraceGround(x: number, z: number): number {
  return TERRACES.base + terraceSteps(x, z) * TERRACES.rise;
}

// ------------------------------------------------------------------------------------------ the height

/** What the terrain hands over: its own downs, and its hills for a given share of hill. */
export interface BaseLand {
  /** The rolling meadow with no hills, rivers or ponds. */
  downs(seed: number, x: number, z: number): number;
  /** How much a hill of this share lifts the ground, in shelves. */
  hillUp(seed: number, x: number, z: number, hills: number): number;
}

/** Steps 1 to 3: the kinds of land, the ridges, the Hall's hill, the terraces, the region's rises, the river and the road. */
function natural(seed: number, x: number, z: number, base: BaseLand, rise: (x: number, z: number, h: number) => number): number {
  const w = landShares(x, z, shares);
  const downs = base.downs(seed, x, z);
  let h = (w[MEADOW] + w[GREY] + w[TOWN] + w[TERR]) * downs;
  if (w[OLD] > 0) {
    // Gentle land with hollows: deep shade pools between the old oaks, never below the water.
    const hollow = smoothstep(0.55, 0.75, fbm2(x / 34, z / 34, seed + 303, 2));
    h += w[OLD] * Math.max(19.6, 21.6 + (downs - 21) * 0.5 - hollow * 3.2);
  }
  if (w[MARSH] > 0) {
    // At the water line: half of it pools, half low islands, and the odd hummock.
    const wet = fbm2(x / 15, z / 15, seed + 311, 3) - 0.5, tuft = fbm2(x / 5, z / 5, seed + 313, 2) - 0.5;
    h += w[MARSH] * (17.7 + wet * 6 + tuft * 1.2);
  }
  if (w[HILLS] > 0) {
    // Rock shelves: level ground to stand on, then a cliff, then the next shelf.
    const up = base.hillUp(seed, x, z, 1.25);
    let top = 24 + up;
    if (top > 46) top = 46 + (top - 46) * 0.25;
    h += w[HILLS] * top;
  }
  const [mx, my] = toMap(x, z);
  // The ridges: a crest the eye follows, a broken top, steep flanks.
  for (const ridge of RIDGES) {
    nearLine(ridge.points, mx, my, near);
    if (near.d >= ridge.half) continue;
    const k = 1 - near.d / ridge.half;
    const crest = ridge.height + (fbm2(mx / 20, my / 20, seed + 321, 2) - 0.5) * 8;
    h = Math.max(h, lerp(h, crest, ease(k * 1.3)));
  }
  // The Hall's hill: a dome over your plot's north side.
  {
    const dx = mx - HALL_HILL.at[0], dy = my - HALL_HILL.at[1], d2 = (dx * dx + dy * dy) / (HALL_HILL.radius * HALL_HILL.radius);
    if (d2 < 4) h += HALL_HILL.height * Math.exp(-d2 * 1.4);
  }
  // The terraces: the land round them comes to their foot, then the steps.
  const r = terraceR(x, z);
  if (r < 1.6) {
    const apron = ease((1.6 - r) / 0.55);
    h = lerp(h, TERRACES.base + (fbm2(x / 9, z / 9, seed + 331, 2) - 0.5) * 0.8, apron);
    if (r < 1.04) h = Math.max(h, terraceGround(x, z) + (r < 1 ? (fbm2(x / 7, z / 7, seed + 333, 2) - 0.5) * 0.5 : 0));
  }
  h = rise(x, z, h);
  // The river: a valley, a bank one block over the water, and its bed. In the hills the valley is a gorge.
  riverAt(x, z, river);
  if (river.bank < 34) {
    const L = river.level, floor = L + 1.6;
    const gorge = Math.max(w[HILLS], L !== WATER_Y ? 1 : 0);
    const valley = lerp(12 + 10 * fbm2(mx / 50, my / 50, seed + 341, 2), 5, gorge);
    if (h > floor) h = lerp(h, floor, smoothstep(valley, 1.5, river.bank));
    if (river.bank < 1.5) h = Math.min(h, lerp(floor, L - 0.8, smoothstep(1.5, -0.5, river.bank)));
    if (river.bank < 0) h = Math.min(h, L - 0.8 - 2.7 * smoothstep(0, 4, -river.bank));
  }
  // The High Road: the ground under its arches lies low and level enough to walk under the deck.
  nearLine(HIGH_ROAD.points, mx, my, near);
  if (near.d < HIGH_ROAD.half + 14) {
    const k = smoothstep(HIGH_ROAD.half + 10, HIGH_ROAD.half + 2, near.d);
    const cap = 23.5;
    if (h > cap) h = lerp(h, cap, k);
  }
  return h;
}

// ------------------------------------------------------------------------------------------ paths

interface GradedPath { id: string; points: readonly (readonly [number, number])[]; half: number; boards: boolean; box: [number, number, number, number]; along: Float32Array; profile: Float32Array }

/** The plan's paths in game columns, with a walkable profile along each: a height every block, slope at most MAX_SLOPE. */
const MAX_SLOPE = 0.55;
const graded = new Map<number, GradedPath[]>();
function paths(seed: number, base: BaseLand, rise: (x: number, z: number, h: number) => number): GradedPath[] {
  let list = graded.get(seed);
  if (list) return list;
  list = PATHS.map((p) => {
    const points = p.points.map((q) => { const w = toWorld(q); return [w.x, w.z] as const; });
    const along: number[] = [0];
    for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const length = along[along.length - 1], n = Math.max(2, Math.ceil(length) + 1);
    const raw = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const s = (k / (n - 1)) * length;
      let i = 0;
      while (i < points.length - 2 && along[i + 1] < s) i++;
      const t = (s - along[i]) / Math.max(1e-6, along[i + 1] - along[i]);
      raw[k] = natural(seed, points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t, base, rise);
    }
    // Smoothed over eight blocks each way, then held to a walkable slope both ways.
    const profile = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      let sum = 0, count = 0;
      for (let j = Math.max(0, k - 8); j <= Math.min(n - 1, k + 8); j++) { sum += raw[j]; count++; }
      profile[k] = sum / count;
    }
    // A path on land keeps a block over the water: over a marsh it is an embankment of dirt, not planks. Only a
    // boardwalk path goes down to the water, and a crossing of the river is planks anyway (it never fills the river).
    if (!p.boards) for (let k = 0; k < n; k++) profile[k] = Math.max(profile[k], WATER_Y + 1.6);
    const step = length / (n - 1) * MAX_SLOPE;
    for (let k = 1; k < n; k++) profile[k] = Math.min(Math.max(profile[k], profile[k - 1] - step), profile[k - 1] + step);
    for (let k = n - 2; k >= 0; k--) profile[k] = Math.min(Math.max(profile[k], profile[k + 1] - step), profile[k + 1] + step);
    const xs = points.map((q) => q[0]), zs = points.map((q) => q[1]), by = p.half + 10;
    return { id: p.id, points, half: p.half, boards: p.boards === true, box: [Math.min(...xs) - by, Math.min(...zs) - by, Math.max(...xs) + by, Math.max(...zs) + by] as [number, number, number, number], along: Float32Array.from(along), profile };
  });
  graded.set(seed, list);
  return list;
}

/** The plan's paths without their profiles, for the questions that need no heights. Seed 0's list is shape only. */
let shapes: { points: readonly (readonly [number, number])[]; half: number; boards: boolean; box: [number, number, number, number] }[] | null = null;
function pathShapes(): NonNullable<typeof shapes> {
  if (shapes) return shapes;
  shapes = PATHS.map((p) => {
    const points = p.points.map((q) => { const w = toWorld(q); return [w.x, w.z] as const; });
    const xs = points.map((q) => q[0]), zs = points.map((q) => q[1]), by = p.half + 10;
    return { points, half: p.half, boards: p.boards === true, box: [Math.min(...xs) - by, Math.min(...zs) - by, Math.max(...xs) + by, Math.max(...zs) + by] as [number, number, number, number] };
  });
  return shapes;
}

/** How far a column is past the edge of the nearest path of the plan, in blocks: 0 or less on it. Infinity far from all. */
export function planPathReach(x: number, z: number): number {
  let best = Infinity;
  for (const p of pathShapes()) {
    if (x < p.box[0] || x > p.box[2] || z < p.box[1] || z > p.box[3]) continue;
    nearLine(p.points, x, z, near);
    best = Math.min(best, near.d - p.half);
  }
  return best;
}

/** True when a column is on a path of the plan that crosses water on boards. */
export function onBoards(x: number, z: number): boolean {
  for (const p of pathShapes()) {
    if (!p.boards || x < p.box[0] || x > p.box[2] || z < p.box[1] || z > p.box[3]) continue;
    if (nearLine(p.points, x, z, near).d <= p.half) return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------ landmarks

/** One landmark model set down: where, turned how, its footprint and the ground under it. */
export interface Site {
  id: string;
  model: string;
  /** The variant's name, or '' for the first. */
  variant: string;
  /** The middle of its footprint, in game columns (not rounded). */
  x: number;
  z: number;
  /** Quarter turns, counter-clockwise from facing south. */
  turn: number;
  /** Radians round y. At 0 its front faces south. */
  rotation: number;
  /** Half its footprint along x and along z, after the turn. */
  hx: number;
  hz: number;
  size: { w: number; d: number; h: number; walk?: boolean; open?: boolean; back?: number; wet?: boolean; deck?: boolean; dress?: boolean };
  /** The place of the plan it belongs to. */
  place: string;
  /** Laid by the land along a line (an arch, a pylon, a face), not listed in LANDMARKS. */
  laid: boolean;
}

/** The way a quarter turn faces, as a step in x and z. */
const FACING: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

function site(id: string, model: string, variant: string, x: number, z: number, turn: number, place: string, laid: boolean, rotation = (turn * Math.PI) / 2, wet = false): Site {
  const size = { ...(LANDMARK_SIZES[model] ?? { w: 4, d: 4, h: 4 }), ...(wet ? { wet: true } : {}) };
  const q = ((turn % 4) + 4) % 4;
  return { id, model, variant, x, z, turn: q, rotation, hx: (q % 2 === 0 ? size.w : size.d) / 2, hz: (q % 2 === 0 ? size.d : size.w) / 2, size, place, laid };
}

/** The point and direction of the High Road at a distance `s` along it from its west end, in game columns. */
function roadAt(s: number): { x: number; z: number; dx: number; dz: number } {
  const pts = HIGH_ROAD.points.map((p) => toWorld(p));
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    if (s <= len || i === pts.length - 2) {
      const t = Math.min(1, s / len), dx = (pts[i + 1].x - pts[i].x) / len, dz = (pts[i + 1].z - pts[i].z) / len;
      return { x: pts[i].x + dx * len * t, z: pts[i].z + dz * len * t, dx, dz };
    }
    s -= len;
  }
  return { x: pts[0].x, z: pts[0].z, dx: 1, dz: 0 };
}
const roadLength = (): number => {
  const pts = HIGH_ROAD.points.map((p) => toWorld(p));
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
  return s;
};
/** Where along the road a map x is, as a distance from its west end. */
function roadAlongAtMapX(mx: number): number {
  const L = roadLength();
  let lo = 0, hi = L;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (toMap(roadAt(mid).x, 0)[0] < mx) lo = mid; else hi = mid; }
  return lo;
}

/**
 * The High Road's spans, west to east: each one arch, with whether it is lit, broken, in the stretch the Order
 * relights at the end of chapter 2 (`relit`, lit only while `road.relit` holds), or where a stair tower meets the
 * deck (`stair`, the arch's `stairGap` variant, its parapet open to the tower's gallery).
 */
export interface Span { n: number; x: number; z: number; rotation: number; dx: number; dz: number; lit: boolean; broken: boolean; relit: boolean; stair: boolean }
let spanList: Span[] | null = null;
export function highRoadSpans(): readonly Span[] {
  if (spanList) return spanList;
  spanList = [];
  const L = roadLength(), count = Math.floor(L / HIGH_ROAD.span);
  for (let n = 0; n < count; n++) {
    const at = roadAt((n + 0.5) * HIGH_ROAD.span);
    // Its front faces south when the road runs east: a turn of the road's own bearing.
    const rotation = Math.atan2(-at.dz, at.dx);
    const mx = toMap(at.x, at.z)[0];
    const relit = mx >= HIGH_ROAD.relit[0] && mx <= HIGH_ROAD.relit[1] && mx < HIGH_ROAD.litFrom;
    spanList.push({ n, x: at.x, z: at.z, rotation, dx: at.dx, dz: at.dz, lit: mx >= HIGH_ROAD.litFrom, broken: HIGH_ROAD.broken.includes(n), relit, stair: false });
  }
  // The span each stair arrives at. The arch's stairGap variant has no lit look yet, so on the lit stretch the
  // span keeps its lit arch: one dark arch in the gold would read as a break in the road.
  for (const mx of HIGH_ROAD.stairs) {
    const at = roadAt(roadAlongAtMapX(mx));
    let best = spanList[0];
    for (const s of spanList) if (Math.hypot(s.x - at.x, s.z - at.z) < Math.hypot(best.x - at.x, best.z - at.z)) best = s;
    if (!best.broken && !best.lit) best.stair = true;
  }
  return spanList;
}

/** The stairs up to the deck: the foot and top of each, and the way it climbs (toward the road). */
export interface Stair { x: number; z: number; dx: number; dz: number; rx: number; rz: number; rotation: number }
let stairList: Stair[] | null = null;
export function highRoadStairs(): readonly Stair[] {
  if (stairList) return stairList;
  stairList = HIGH_ROAD.stairs.map((mx) => {
    const at = roadAt(roadAlongAtMapX(mx));
    // South of the road: the normal that points to +z.
    const nx = -at.dz, nz = at.dx;
    const sx = nz > 0 ? nx : -nx, sz = nz > 0 ? nz : -nz;
    return { x: at.x, z: at.z, dx: -sx, dz: -sz, rx: at.dx, rz: at.dz, rotation: Math.atan2(-at.dz, at.dx) };
  });
  return stairList;
}

/**
 * The stair tower at a stair: its middle and its turn. Its model (`roadStair`) climbs three flights round a well,
 * clockwise, and leaves by a gallery along its local +z side whose open end (local -x) meets the deck's edge.
 */
function stairTower(s: Stair): { x: number; z: number; rotation: number } {
  const out = HIGH_ROAD.half + 0.5 + LANDMARK_SIZES.roadStair.d / 2;
  // Local +x points away from the road, so local -x, the gallery's open end, faces it.
  return { x: s.x - s.dx * out, z: s.z - s.dz * out, rotation: Math.atan2(s.dz, -s.dx) };
}

/** The stair tower's flights, as the height of the floor over its base at a point of its own space, or NaN outside it. */
const RISE = 13 / 44;
function towerFloor(u: number, v: number): number {
  if (Math.abs(u) > 4 || Math.abs(v) > 4) return NaN;
  // The gallery to the road, along +z at the top. It floors the cells over the first flight's foot too.
  if (v > 1.65) return u < -1.65 && v < 2.6 ? 0 : 13;
  if (u < -1.65 && v > -1.65) return 16 * RISE * ((2.25 - v) / 4.5);
  if (u < -1.65) return 16 * RISE;
  if (v < -1.65 && u < 1.65) return (16 + 14 * ((u + 2.25) / 4.5)) * RISE;
  if (v < -1.65) return 30 * RISE;
  if (u > 1.65) return (30 + 14 * ((v + 2.25) / 4.5)) * RISE;
  // The well in the middle: solid, so nobody falls down it.
  return 13;
}

let siteList: Site[] | null = null;
/** Every landmark the land sets down: the plan's list, then the arches, pylons, stairs, terrace faces and boardwalks. */
export function landmarkSites(): readonly Site[] {
  if (siteList) return siteList;
  const list: Site[] = [];
  for (const l of LANDMARKS) {
    // Not rounded, so a footprint of odd width lies on whole blocks.
    const at = l.at ? { x: l.at[0] - toMap(0, 0)[0], z: l.at[1] - toMap(0, 0)[1] } : placeAt(l.place);
    list.push(site(l.id, l.model, l.variant ?? '', at.x, at.z, l.turn, l.place, false, (l.turn * Math.PI) / 2, l.wet === true));
  }
  for (const s of highRoadSpans()) list.push(site(`arch-${s.n}`, 'highRoadArch', s.broken ? 'broken' : s.stair ? 'stairGap' : s.lit ? 'lit' : 'dark', s.x, s.z, 0, 'highroad', true, s.rotation));
  for (const mx of HIGH_ROAD.pylons) {
    const at = roadAt(roadAlongAtMapX(mx));
    // North of the road: the normal that points to -z.
    const nx = -at.dz, nz = at.dx, sign = nz < 0 ? 1 : -1;
    list.push(site(`pylon-${mx}`, 'roadPylon', mx >= HIGH_ROAD.litFrom ? 'lit' : 'dormant', at.x + nx * sign * HIGH_ROAD.pylonSide, at.z + nz * sign * HIGH_ROAD.pylonSide, 0, 'highroad', true, Math.atan2(-at.dz, at.dx)));
  }
  highRoadStairs().forEach((s, i) => {
    const t = stairTower(s);
    list.push(site(`road-stair-${i}`, 'roadStair', '', t.x, t.z, 0, 'highroad', true, t.rotation));
  });
  // The terraces' stair: a flight up each face, and the faces themselves on the south half of each ring.
  const c = TERRACES.center;
  TERRACES.rings.forEach((ring, i) => {
    const faceY = c[1] + TERRACES.ry * ring;
    const at = toWorld([TERRACES.stair.x, faceY - 6]);
    list.push(site(`terrace-stair-${i}`, 'terraceStair', '', at.x, at.z, 0, 'terraces', true));
    const rx = TERRACES.rx * ring, ry = TERRACES.ry * ring, perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const count = Math.floor(perimeter / 12);
    for (let k = 0; k < count; k++) {
      const a = (k + 0.5) / count * Math.PI * 2;
      // The south half only: the faces you see from the valley.
      if (Math.sin(a) < 0.15) continue;
      const fx = c[0] + Math.cos(a) * rx, fy = c[1] + Math.sin(a) * ry;
      if (Math.abs(fx - TERRACES.stair.x) < TERRACES.stair.half + 7) continue;
      // The outward normal of the ellipse, so the face looks out from its step.
      const nx = Math.cos(a) / rx, ny = Math.sin(a) / ry, len = Math.hypot(nx, ny);
      // The model's back is at its origin and its front 2.9 blocks out: its front stands on the face.
      const w = { x: fx - (nx / len) * 2.9 - toMap(0, 0)[0], z: fy - (ny / len) * 2.9 - toMap(0, 0)[1] };
      list.push(site(`terrace-wall-${i}-${k}`, 'terraceWall', '', w.x, w.z, 0, 'terraces', true, Math.atan2(nx / len, ny / len)));
    }
  });
  // The boardwalks: a model every 8 blocks along each `boards` path, over water only.
  for (const p of PATHS) {
    if (!p.boards) continue;
    const pts = p.points.map((q) => toWorld(q));
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z), dx = (pts[i + 1].x - pts[i].x) / len, dz = (pts[i + 1].z - pts[i].z) / len;
      for (let s = 4; s < len; s += 8) list.push(site(`boards-${p.id}-${i}-${s}`, 'boardwalk', '', pts[i].x + dx * s, pts[i].z + dz * s, 0, p.id, true, Math.atan2(dx, dz)));
    }
  }
  siteList = list;
  return list;
}

/** Whether a column falls inside a site's footprint, grown by `by` blocks. Laid sites turn freely, so their box is turned too. */
function inFootprint(s: Site, x: number, z: number, by: number): boolean {
  if (s.laid) {
    const dx = x - s.x, dz = z - s.z, c = Math.cos(s.rotation), sn = Math.sin(s.rotation);
    // The site's own across (x) and front (z) axes.
    const u = dx * c - dz * sn, v = dx * sn + dz * c;
    return Math.abs(u) <= s.size.w / 2 + by && Math.abs(v) <= s.size.d / 2 + by;
  }
  return Math.abs(x - s.x) <= s.hx + by && Math.abs(z - s.z) <= s.hz + by;
}

/** The sites whose footprint, grown by 14 blocks, can reach a column. A coarse grid of them, made once. */
const SITE_CELL = 32;
let siteCells: Map<number, Site[]> | null = null;
function sitesNear(x: number, z: number): readonly Site[] {
  if (!siteCells) {
    siteCells = new Map();
    for (const s of landmarkSites()) {
      if (s.model === 'dawnDome') continue;
      const r = Math.max(s.hx, s.hz, s.size.w / 2, s.size.d / 2) + 14 + (s.size.back ? 40 : 0);
      for (let cx = Math.floor((s.x - r) / SITE_CELL); cx <= Math.floor((s.x + r) / SITE_CELL); cx++) {
        for (let cz = Math.floor((s.z - r) / SITE_CELL); cz <= Math.floor((s.z + r) / SITE_CELL); cz++) {
          const key = cx * 4096 + cz;
          let cell = siteCells.get(key);
          if (!cell) siteCells.set(key, (cell = []));
          cell.push(s);
        }
      }
    }
  }
  return siteCells.get(Math.floor(x / SITE_CELL) * 4096 + Math.floor(z / SITE_CELL)) ?? NONE;
}
const NONE: readonly Site[] = [];

/** Sites that level the ground under them: those listed in the plan, the pylons and the road's stairs. */
const levels = (s: Site): boolean => !s.size.wet && !s.size.deck && !s.size.dress && (s.model === 'roadPylon' || s.model === 'roadStair' || !s.laid);

/** The ground each levelling site stands on, by seed: the land's height at its middle, rounded. */
const padGrounds = new Map<number, Map<string, number>>();

/**
 * The pit the forest stair goes down into: its treads fall 3 blocks from its back to its front, so the ground under
 * it is dug to follow them, with a sharp edge, and its top tread lies flush with the ground behind it.
 */
export const STAIR_DROP = 3;
function stairPit(s: Site, x: number, z: number, g: number): number {
  const [fx, fz] = FACING[s.turn];
  const dx = x + 0.5 - s.x, dz = z + 0.5 - s.z;
  const v = dx * fx + dz * fz, u = Math.abs(dx * fz - dz * fx);
  if (u > s.size.w / 2 || Math.abs(v) > s.size.d / 2) return Infinity;
  const t = Math.min(1, Math.max(0, (s.size.d / 2 - v) / s.size.d));
  return g - STAIR_DROP + STAIR_DROP * t;
}

/** Step 5: the pads and the banks behind doors. `pre` is the land after steps 1 to 4. */
function padded(seed: number, x: number, z: number, h: number, pads: Map<string, number>): number {
  const list = sitesNear(x, z);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const g = pads.get(s.id);
    if (g === undefined) continue;
    // How far outside the footprint: 0 inside.
    const ox = Math.max(0, Math.abs(x + 0.5 - s.x) - s.hx - 1.5), oz = Math.max(0, Math.abs(z + 0.5 - s.z) - s.hz - 1.5);
    const out = Math.hypot(ox, oz);
    if (out < 7) h = lerp(h, g, ease(1 - out / 7));
    if (s.model === 'forestStair') h = Math.min(h, stairPit(s, x, z, g));
    const back = s.size.back;
    if (back) {
      // Behind it (against its facing), a bank of land as high as `back`, with a sheer face at the footprint's back.
      const [fx, fz] = FACING[s.turn];
      const v = (x + 0.5 - s.x) * fx + (z + 0.5 - s.z) * fz;
      const u = Math.abs((x + 0.5 - s.x) * fz - (z + 0.5 - s.z) * fx);
      const depth = s.turn % 2 === 0 ? s.hz : s.hx, across = s.turn % 2 === 0 ? s.hx : s.hz;
      const behind = -v - depth;
      // A broad face: full height across the door and ten blocks either side, and twenty blocks back.
      // It never dams the river: the face eases off over the six blocks before the bank.
      if (behind > -0.5 && behind < 40 && u < across + 22 && riverAt(x, z, river).bank > 0) {
        const k = smoothstep(-0.5, 0.5, behind) * ease((across + 22 - u) / 12) * ease((40 - behind) / 18) * ease(river.bank / 6);
        h = Math.max(h, g + back * k + (fbm2(x / 6, z / 6, seed + 351, 2) - 0.5) * 2 * k);
      }
    }
  }
  return h;
}

// ------------------------------------------------------------------------------------------ the whole column

/** The region plan's two stages of shaping, handed over by the terrain so this file needs no region code. */
export interface RegionShaping {
  rise(x: number, z: number, h: number): number;
  level(x: number, z: number, h: number): number;
}

/** The height of the land of Greenhollow at a column, before it is cut into blocks. Only for columns with mapWeight above 0. */
export function greenhollowHeight(seed: number, x: number, z: number, base: BaseLand, region: RegionShaping): number {
  let h = natural(seed, x, z, base, region.rise);
  // Step 4: along a path the ground follows its walkable profile, with a verge easing back to the land.
  for (const p of paths(seed, base, region.rise)) {
    if (x < p.box[0] || x > p.box[2] || z < p.box[1] || z > p.box[3]) continue;
    nearLine(p.points, x, z, near);
    const verge = p.half + 5;
    if (near.d >= verge) continue;
    const s = p.along[near.seg] + (p.along[near.seg + 1] - p.along[near.seg]) * near.t;
    const k = (s / p.along[p.along.length - 1]) * (p.profile.length - 1), i = Math.min(p.profile.length - 2, Math.floor(k));
    const ground = lerp(p.profile[i], p.profile[i + 1], k - i);
    const graded = lerp(h, ground, ease((verge - near.d) / 4));
    // Over the river a path is a bridge: it never fills the water in.
    h = riverAt(x, z, river).bank < 1 ? Math.min(h, graded) : graded;
  }
  h = padded(seed, x, z, h, pads(seed, base, region));
  // Nothing rises into the High Road's deck: not a graded path, not a pad.
  {
    const [mx, my] = toMap(x, z);
    const d = nearLine(HIGH_ROAD.points, mx, my, near).d;
    if (d < HIGH_ROAD.half + 10 && h > 23.5) h = lerp(h, 23.5, smoothstep(HIGH_ROAD.half + 10, HIGH_ROAD.half + 2, d));
  }
  return region.level(x, z, h);
}

function pads(seed: number, base: BaseLand, region: RegionShaping): Map<string, number> {
  let map = padGrounds.get(seed);
  if (map) return map;
  map = new Map();
  padGrounds.set(seed, map);
  for (const s of landmarkSites()) {
    if (!levels(s)) continue;
    let g = Math.round(natural(seed, Math.floor(s.x), Math.floor(s.z), base, region.rise) + 0.01);
    // A stair tower stands thirteen below the deck; its ground is a little over the water, its first flight buried.
    if (s.model === 'roadStair') g = DECK_Y - 8;
    // A pylon stands at the foot of the road's arches, never on a shelf above them.
    if (s.model === 'roadPylon') g = Math.min(g, 24);
    // Never in the water: an island is raised where a site stands in it.
    g = Math.max(g, WATER_Y + 2);
    map.set(s.id, g - 0.4);
  }
  return map;
}

/**
 * The y a site's model stands at: where its own y = 0 is put. The view draws it there and the place check
 * (src/game/places/check.sim.ts) holds the ground under it to the same number, so the two cannot differ.
 * `groundAt` is the top of the ground at a column.
 */
export function siteBase(s: Site, groundAt: (x: number, z: number) => number): number {
  switch (s.model) {
    // The arch's deck and the stair tower's gallery are 13 over their base.
    case 'highRoadArch':
    case 'roadStair': return DECK_Y - 13;
    case 'terraceWall':
    case 'terraceStair': return TERRACES.base + TERRACES.rise * Number(s.id.split('-')[2]);
    case 'boardwalk': return WATER_Y + 1;
    case 'citySkiff': return WATER_Y - 0.4;
    case 'cityDock': return WATER_Y;
    case 'jetty': return WATER_Y + 2 - s.size.h;
    // Its crest a little over the river, the foot of its spilling sheet under it.
    case 'weir': return WATER_Y - 2.2;
    // The river's surface is at the model's own y 1.35, so its wheel dips into the Mere.
    case 'pumpHouse': return WATER_Y - 1.35;
    // Sunk into its pit: its top tread level with the ground behind it.
    case 'forestStair': {
      const [fx, fz] = FACING[s.turn];
      const back = s.size.d / 2 + 2;
      return groundAt(Math.floor(s.x - fx * back), Math.floor(s.z - fz * back)) - STAIR_DROP;
    }
  }
  if (s.size.deck) return DECK_Y;
  return groundAt(Math.floor(s.x), Math.floor(s.z));
}

/** The ground a site stands on: the pad's height, or the land's at its middle. */
export function siteGround(s: Site, groundAt: (x: number, z: number) => number): number {
  if (s.size.deck) return DECK_Y;
  return groundAt(Math.floor(s.x), Math.floor(s.z));
}

// ------------------------------------------------------------------------------------------ what grows

/** How much forest the plan makes a column, 0 to 1, from the kinds of land round it. `meadow` is the noise land's own. */
export function greenhollowForest(x: number, z: number, meadow: number): number {
  const w = landShares(x, z, shares);
  // Old oaks are twice an oak's size, so half as many trunks make as deep a wood: the triangle budget holds.
  return w[MEADOW] * meadow + w[OLD] * 0.5 + w[GREY] * 0.48 + w[MARSH] * 0.12 + w[HILLS] * 0.3 + w[TERR] * 0.06;
}

/**
 * How deep in the woods a column is, 0 to 1, for the props scatter: bushes grow at a wood's edge (about 0.45),
 * logs, stumps and mushrooms deep in it. The groves of old oaks count as little: the scatter's stumps and logs are
 * one size sprinkled evenly, and a grove's floor is dressed by its own ferns, roots and kit pieces instead.
 */
export function greenhollowWoods(x: number, z: number, meadow: number): number {
  const m = mapWeight(x, z);
  if (m <= 0) return meadow;
  const w = landShares(x, z, shares);
  const inside = w[MEADOW] * meadow + w[OLD] * 0.1 + w[GREY] * 0.1 + w[MARSH] * 0.12 + w[HILLS] * 0.3 + w[TERR] * 0.06;
  return meadow + (inside - meadow) * m;
}

/**
 * The tree kind that grows at a column outside the groves, by its kind of land: 0 oak, 1 birch, 2 pine, 4 willow.
 * The groves of old oaks (3) are the terrain's own (`greenhollowGrove`); at their thin edges plain oaks grow.
 */
export function greenhollowTree(x: number, z: number, roll: number, high: boolean): 0 | 1 | 2 | 3 | 4 {
  const w = landShares(x, z, shares);
  let best = 0;
  for (let k = 1; k < B; k++) if (w[k] > w[best]) best = k;
  if (best === MARSH) return roll < 0.8 ? 4 : 0;
  if (best === HILLS || high) return 2;
  if (best === OLD || best === GREY) return roll < 0.2 ? 1 : 0;
  return roll < 0.3 ? 1 : 0;
}

/** How much of a column is a grove of old oaks: the Old Forest, and the grey forest, which is the same oaks drained. */
export function greenhollowGrove(x: number, z: number): number {
  if (mapWeight(x, z) <= 0.5) return 0;
  const w = landShares(x, z, shares);
  return w[OLD] + w[GREY];
}

/** The glades in game columns: the middle and the half sizes of each oval. */
const GLADE_SHAPES = GLADES.map((g) => ({ ...toWorld(g.at), rx: g.w / 2, rz: g.d / 2, canopy: g.canopy }));
/**
 * How far a column is outside the nearest glade's edge, in blocks, less the room a giant needs there (`canopy` in
 * GLADES): below 0 a giant oak may not stand, and `young` (any tree) below `-canopy`, that is inside the oval.
 */
export function gladeRoom(x: number, z: number, young: boolean): number {
  let best = Infinity;
  for (const g of GLADE_SHAPES) {
    const dx = x - g.x, dz = z - g.z;
    if (Math.abs(dx) > g.rx + 24 || Math.abs(dz) > g.rz + 24) continue;
    // Distance past the oval's edge, along the line from its middle: near enough for blocks.
    const k = Math.hypot(dx / g.rx, dz / g.rz), r = Math.hypot(dx, dz), past = k > 0 ? r - r / k : -Math.min(g.rx, g.rz);
    best = Math.min(best, past - (young ? Math.max(0, Math.min(1, g.canopy)) : g.canopy));
  }
  return best;
}

/** The old oaks set by hand, by the cell of the tree grid they stand in: the bee trees (variant 4) and the planted giants. */
const PLANTED = new Map<number, { x: number; z: number; variant: number }>();
for (const t of [...BEE_TREES.map((b) => ({ at: b.at, variant: 4 })), ...PLANTED_OAKS]) {
  const w = toWorld(t.at);
  PLANTED.set(Math.floor(w.x / 5) * 65536 + Math.floor(w.z / 5), { ...w, variant: t.variant });
}
const PLANTED_GIANTS = PLANTED_OAKS.map((t) => toWorld(t.at));
/** Whether a giant set by hand stands within `r` blocks of a column: the grove's own trees keep off it. */
export function plantedGiantNear(x: number, z: number, r: number): boolean {
  for (const w of PLANTED_GIANTS) if (Math.abs(w.x - x) < r && Math.abs(w.z - z) < r && Math.hypot(w.x - x, w.z - z) < r) return true;
  return false;
}

/** The old oak set by hand whose column lies in this 5 by 5 cell of the tree grid, or null. */
export function plantedOakIn(gx: number, gz: number): { x: number; z: number; variant: number } | null {
  return PLANTED.get(gx * 65536 + gz) ?? null;
}

/** False where the plan wants no wild tree: on and beside its paths, under the High Road, on a landmark's ground. */
export function greenhollowTreeAllowed(x: number, z: number): boolean {
  if (mapWeight(x, z) <= 0) return true;
  if (planPathReach(x, z) <= 3) return false;
  const [mx, my] = toMap(x, z);
  if (nearLine(HIGH_ROAD.points, mx, my, near).d < HIGH_ROAD.half + 5) return false;
  for (const s of sitesNear(x, z)) if (inFootprint(s, x + 0.5, z + 0.5, 3)) return false;
  return true;
}

// ------------------------------------------------------------------------------------------ blocks

export type Put = (x: number, y: number, z: number, id: number) => void;

/** True when the High Road's deck is walked on above this column: within its width, and not over a broken span. */
export function onDeck(x: number, z: number): boolean {
  const [mx, my] = toMap(x + 0.5, z + 0.5);
  if (mx < 0 || mx > W) return false;
  if (nearLine(HIGH_ROAD.points, mx, my, near).d > HIGH_ROAD.half + 0.5) return false;
  const spans = highRoadSpans();
  let best = spans[0], d = Infinity;
  for (const s of spans) { const e = Math.hypot(s.x - x - 0.5, s.z - z - 0.5); if (e < d) { d = e; best = s; } }
  return best !== undefined && !best.broken && d < HIGH_ROAD.span;
}

/**
 * Writes the plan's invisible blocks into the chunk whose lowest corner is (ox, oz): a floor of barrier under the
 * High Road's deck with low walls along its sides, its piers and stairs, and a footprint two blocks high under each
 * landmark you cannot walk through. `groundAt` is the chunk's own ground height. `put` drops blocks outside the chunk.
 */
export function stampGreenhollow(ox: number, oz: number, size: number, barrier: number, groundAt: (x: number, z: number) => number, put: Put): void {
  // Quick no: a chunk nowhere near the map.
  if (ox + size < X0 - 16 || ox > X1 + 16 || oz + size < Z0 - 16 || oz > Z1 + 16) return;
  const stairs = highRoadStairs();
  for (let x = ox; x < ox + size; x++) {
    for (let z = oz; z < oz + size; z++) {
      const [mx, my] = toMap(x + 0.5, z + 0.5);
      if (mx < -8 || mx > W + 8) continue;
      nearLine(HIGH_ROAD.points, mx, my, near);
      const d = near.d;
      if (d > HIGH_ROAD.half + 12) continue;
      const g = groundAt(x, z);
      // The stair towers: barrier up to each flight's floor, the gallery's floor where it passes over the first flight.
      for (const s of stairs) {
        const t = stairTower(s), c = Math.cos(t.rotation), sn = Math.sin(t.rotation);
        const ax = x + 0.5 - t.x, az = z + 0.5 - t.z;
        const floor = towerFloor(ax * c - az * sn, ax * sn + az * c);
        if (Number.isNaN(floor)) continue;
        const base = DECK_Y - 13, top = base + Math.round(floor);
        for (let y = g; y < top; y++) put(x, y, z, barrier);
        if (top < DECK_Y - 3 && floor === 0) put(x, DECK_Y - 1, z, barrier);
      }
      if (d > HIGH_ROAD.half + 0.5 || !onDeck(x, z)) continue;
      if (g < DECK_Y - 1) put(x, DECK_Y - 1, z, barrier);
      // The low walls along the deck's edges, open where a stair arrives.
      if (d > HIGH_ROAD.half - 0.5) {
        let gap = false;
        for (const s of stairs) {
          // The gallery arrives 2.65 blocks along the road from the tower's middle: its local +z.
          const t = stairTower(s), gx = t.x + Math.sin(t.rotation) * 2.65, gz = t.z + Math.cos(t.rotation) * 2.65;
          if (Math.abs((x + 0.5 - gx) * s.rx + (z + 0.5 - gz) * s.rz) <= 1.3 && (x + 0.5 - s.x) * s.dx + (z + 0.5 - s.z) * s.dz < 0) gap = true;
        }
        if (!gap) { put(x, DECK_Y, z, barrier); put(x, DECK_Y + 1, z, barrier); }
      }
    }
  }
  // The piers: two blocks along the road at each end of every span, from the ground to the deck.
  for (const s of highRoadSpans()) {
    for (const end of [-1, 1]) {
      if (s.broken && end === 1) continue;
      const px = s.x + s.dx * end * (HIGH_ROAD.span / 2 - 1), pz = s.z + s.dz * end * (HIGH_ROAD.span / 2 - 1);
      if (px < ox - 6 || px > ox + size + 6 || pz < oz - 6 || pz > oz + size + 6) continue;
      for (let a = -1; a <= 0.5; a += 0.5) for (let b = -HIGH_ROAD.half; b <= HIGH_ROAD.half; b += 0.5) {
        const x = Math.floor(px + s.dx * a - s.dz * b), z = Math.floor(pz + s.dz * a + s.dx * b);
        if (x < ox || x >= ox + size || z < oz || z >= oz + size) continue;
        for (let y = groundAt(x, z); y < DECK_Y - 1; y++) put(x, y, z, barrier);
      }
    }
  }
  // The landmarks.
  const seen = new Set<Site>();
  for (let cx = ox; cx < ox + size; cx += SITE_CELL / 2) for (let cz = oz; cz < oz + size; cz += SITE_CELL / 2) for (const s of sitesNear(cx, cz)) seen.add(s);
  for (const s of seen) {
    if (s.size.open || s.model === 'highRoadArch') continue;
    const x0 = Math.max(ox, Math.floor(s.x - Math.max(s.hx, s.hz) - 1)), x1 = Math.min(ox + size - 1, Math.ceil(s.x + Math.max(s.hx, s.hz) + 1));
    const z0 = Math.max(oz, Math.floor(s.z - Math.max(s.hx, s.hz) - 1)), z1 = Math.min(oz + size - 1, Math.ceil(s.z + Math.max(s.hx, s.hz) + 1));
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!inFootprint(s, x + 0.5, z + 0.5, -0.25)) continue;
      if (s.size.walk) { put(x, WATER_Y + 1, z, barrier); continue; }
      const y0 = s.size.deck ? DECK_Y : groundAt(x, z);
      put(x, y0, z, barrier);
      put(x, y0 + 1, z, barrier);
    }
  }
}

/** Where to stand at a place of the plan: in front of its landmark when it has one, else on its own point. */
export function standAt(id: string): { x: number; z: number } {
  const own = LANDMARKS.find((l) => l.place === id && !l.at) ?? LANDMARKS.find((l) => l.place === id && l.id === id);
  const p = placeAt(id);
  if (!own) {
    // A place on the High Road's line stands beside it, on the south side.
    return p;
  }
  const s = landmarkSites().find((q) => q.id === own.id);
  if (!s) return p;
  const [fx, fz] = FACING[s.turn];
  const depth = s.turn % 2 === 0 ? s.hz : s.hx;
  return { x: Math.floor(s.x + fx * (depth + 2.5)), z: Math.floor(s.z + fz * (depth + 2.5)) };
}

/** Every place of the plan, where to stand there. */
export function planStands(): { id: string; name: string; x: number; z: number }[] {
  return PLACES.map((p) => ({ id: p.id, name: p.name, ...standAt(p.id) }));
}

export type { MapPoint };
