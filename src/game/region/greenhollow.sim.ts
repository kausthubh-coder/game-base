// What the plan of Greenhollow (src/game/content/greenhollow.ts) says about one column of the game: its kind
// of land, how grey it is, and how far it is from the river and the High Road. Pure functions of the plan, so
// the page, the terrain's worker and a test all get the same answers. Every argument is a game column.
//
// The signatures are the contract between the helpers of docs/greenhollow-world.md. The land's helper may make
// them faster; it does not change what they take or return.

import { fbm2 } from '../../features/world/noise.sim.ts';
import { AREAS, BIOMES, CITY_FIELDS, HIGH_ROAD, MAP_SIZE, PLACES, RIVER, toMap, toWorld, type Biome, type MapPoint } from '../content/greenhollow.ts';

const W = MAP_SIZE.w, H = MAP_SIZE.h;
/** How far a kind of land's edge wanders from its outline, in blocks. */
const WANDER = 14;

function inside(poly: readonly MapPoint[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// The kind of land of every map unit, made once on first use. An index into BIOMES.
let grid: Uint8Array | null = null;
/** The kind of land of every map unit, as an index into BIOMES: row by row, MAP_SIZE.w a row. */
export function biomeGrid(): Uint8Array {
  if (grid) return grid;
  grid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // Look a little to one side, by a slow noise, so the edges wander.
    const sx = x + (fbm2(x / 40, y / 40, 701, 2) - 0.5) * 2 * WANDER, sy = y + (fbm2(x / 40 + 9.1, y / 40 - 4.7, 702, 2) - 0.5) * 2 * WANDER;
    let b = 0;
    for (const a of AREAS) if (inside(a.outline, sx, sy)) b = BIOMES.indexOf(a.biome);
    grid[y * W + x] = b;
  }
  return grid;
}

const mapIndex = (x: number, z: number): number => {
  const [mx, my] = toMap(x, z);
  const cx = Math.min(W - 1, Math.max(0, Math.round(mx))), cy = Math.min(H - 1, Math.max(0, Math.round(my)));
  return cy * W + cx;
};

/** The kind of land at a game column. Past the map's edges, the land at the nearest edge. */
export function biomeAt(x: number, z: number): Biome {
  return BIOMES[biomeGrid()[mapIndex(x, z)]];
}

/**
 * How much of each kind of land is round a column, for blending ground colour and what grows: the share of
 * nine samples `reach` blocks apart that are each kind. Writes into `out` (length BIOMES.length), returns it.
 */
export function biomeMix(x: number, z: number, out: Float32Array, reach = 6): Float32Array {
  out.fill(0);
  const g = biomeGrid();
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) out[g[mapIndex(x + dx * reach, z + dz * reach)]] += 1 / 9;
  return out;
}

/** The shortest distance from a map point to a line through points, and which segment and how far along it. */
function toLine(points: readonly MapPoint[], x: number, y: number, at: { seg: number; t: number }): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < best) { best = d; at.seg = i; at.t = t; }
  }
  return best;
}
const where = { seg: 0, t: 0 };

/** How far a column is from the river's bank, in blocks: below 0 is in the water, 0 is the bank. */
export function riverBank(x: number, z: number): number {
  const [mx, my] = toMap(x, z);
  // The bank wanders a block or two either way.
  const d = toLine(RIVER.points, mx, my, where);
  const half = RIVER.half[where.seg] + (RIVER.half[where.seg + 1] - RIVER.half[where.seg]) * where.t;
  return d - half * (0.85 + 0.3 * fbm2(mx / 18, my / 18, 711, 2));
}

/** How far a column is from the High Road's middle line, in blocks. */
export function highRoadDistance(x: number, z: number): number {
  const [mx, my] = toMap(x, z);
  return toLine(HIGH_ROAD.points, mx, my, where);
}

/** Whether the High Road's channel glows gold above this column. `relit` is true from the end of chapter 2. */
export function highRoadLit(x: number, relit = false): boolean {
  const mx = toMap(x, 0)[0];
  return mx >= HIGH_ROAD.litFrom || (relit && mx >= HIGH_ROAD.relit[0] && mx <= HIGH_ROAD.relit[1]);
}

/**
 * How grey the land is at a column, from 0 (alive) to 1 (drained). The grey forest is grey; beside it the land
 * pales over 24 blocks; under the lit road it is grey up to 40 blocks to its south. Grey follows gold. `relit` is
 * true while the stretch the Order relights glows, `healed` once the grey forest has its colour back, and `pumps`
 * is how many of the Order's pumps still stand in Hollowmere's fields, each with a ring of grey grass round it
 * (src/game/region/story.sim.ts).
 */
export function blightAt(x: number, z: number, relit = false, healed = false, pumps = 0): number {
  const mix = biomeMix(x, z, scratch, 8);
  let grey = healed ? 0 : mix[BIOMES.indexOf('greyForest')];
  for (let i = 0; i < pumps && i < PUMP_AT.length; i++) {
    const d = Math.hypot(x - PUMP_AT[i].x, z - PUMP_AT[i].z);
    if (d < PUMP_RING) grey = Math.max(grey, 0.85 * (1 - Math.max(0, d - PUMP_RING * 0.45) / (PUMP_RING * 0.55)));
  }
  const [mx, my] = toMap(x, z);
  if (highRoadLit(x, relit)) {
    const d = toLine(HIGH_ROAD.points, mx, my, where);
    const roadY = HIGH_ROAD.points[where.seg][1] + (HIGH_ROAD.points[where.seg + 1][1] - HIGH_ROAD.points[where.seg][1]) * where.t;
    if (my >= roadY) grey = Math.max(grey, 1 - Math.min(1, d / 40));
  }
  return grey * grey * (3 - 2 * grey);
}
const scratch = new Float32Array(BIOMES.length);
/** The Order's pumps in Hollowmere's fields, in the order they come out, and how far the grey round each reaches. */
const PUMP_AT = CITY_FIELDS.map((f) => toWorld(f.pump));
const PUMP_RING = 7;

/** The game column of a place of the plan, by its id. Throws for an id the plan does not have. */
export function placeAt(id: string): { x: number; z: number } {
  const p = PLACES.find((q) => q.id === id);
  if (!p) throw new Error(`the plan of Greenhollow has no place "${id}"`);
  return p.world ?? toWorld(p.at);
}
