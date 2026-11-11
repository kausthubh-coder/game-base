// The region plan as land: what the terrain asks while it makes a chunk, and what the region system
// asks about the buildings it stamped. Everything here is a pure function of src/game/content/region.ts,
// so the page and the worker get the same blocks.
//
// This is the one file of the region that uses src/content/blueprints.ts and src/features/buildings.
import { blockId } from '../../content/blocks.ts';
import { BLUEPRINTS } from '../../content/blueprints.ts';
import { stamp } from '../../features/buildings/stamp.sim.ts';
import type { RegionProp } from '../api.sim.ts';
import { TOWN_MODELS } from '../../content/town-kit.ts';
import { REGION, type PlanBuilding, type PlanModel, type Rect } from '../content/region.ts';

/** A building of the plan after it was turned and put down. */
export interface Built {
  plan: PlanBuilding;
  /** The box of blocks it takes up. Both ends are inside it. */
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
  /** The lowest block of the doorway, and the block just outside it. */
  door: { x: number; y: number; z: number };
  outside: { x: number; y: number; z: number };
  /** Its blocks as runs of four numbers: x, y, z, block id. */
  cells: Int32Array;
  props: RegionProp[];
}

const inside = (r: Rect, x: number, z: number): boolean => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

// ------------------------------------------------------------------------------------------ bounds

/** How far past the plan's own shapes the land can still differ: a level's blend, a tree's leaves. */
const MARGIN = 6;

/** The box of columns the plan can change. Outside it the terrain never asks. */
export const BOUNDS: Rect = (() => {
  const b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  const take = (x: number, z: number): void => {
    b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x);
    b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z);
  };
  for (const r of [...REGION.levels, ...REGION.basins, ...REGION.noTrees, REGION.town]) { take(r.x0, r.z0); take(r.x1, r.z1); }
  for (const c of REGION.clearings) { take(c.x0 - c.fade, c.z0 - c.fade); take(c.x1 + c.fade, c.z1 + c.fade); }
  for (const f of REGION.fills) { take(f.x0, f.z0); take(f.x1, f.z1); }
  for (const p of REGION.paths) for (const [x, z] of p.points) take(x, z);
  for (const v of REGION.vales) for (const [x, z] of v.points) { take(x - v.half - v.fade, z - v.half - v.fade); take(x + v.half + v.fade, z + v.half + v.fade); }
  for (const t of [...REGION.trees, ...REGION.bushes]) take(t.x, t.z);
  for (const m of REGION.models) { const [w, d] = TOWN_MODELS[m.model].footprint; take(m.x, m.z); take(m.x + Math.max(w, d), m.z + Math.max(w, d)); }
  return { x0: b.x0 - MARGIN, z0: b.z0 - MARGIN, x1: b.x1 + MARGIN, z1: b.z1 + MARGIN };
})();

export const inBounds = (x: number, z: number): boolean => inside(BOUNDS, x, z);

/** True when a chunk whose lowest corner is (ox, oz) and that is `size` blocks wide can hold part of the plan. */
export const chunkInBounds = (ox: number, oz: number, size: number): boolean =>
  ox <= BOUNDS.x1 && ox + size > BOUNDS.x0 && oz <= BOUNDS.z1 && oz + size > BOUNDS.z0;

// ------------------------------------------------------------------------------------------ ground

const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** How far a column is from a line through `points`, in blocks. */
function reachOf(points: readonly (readonly [number, number])[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const ax = points[i][0], az = points[i][1];
    const bx = points[i + 1][0] - ax, bz = points[i + 1][1] - az;
    const along = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz)));
    const d = Math.hypot(x - ax - bx * along, z - az - bz * along);
    if (d < best) best = d;
  }
  return best;
}

/** How much of level `i` holds at a column: 1 inside its rectangle, falling to 0 over its blend. */
function levelWeight(i: number, x: number, z: number): number {
  const l = REGION.levels[i];
  const dx = x < l.x0 ? l.x0 - x : x > l.x1 ? x - l.x1 : 0;
  const dz = z < l.z0 ? l.z0 - z : z > l.z1 ? z - l.z1 : 0;
  if (dx >= l.blend || dz >= l.blend) return 0;
  return ease(1 - Math.hypot(dx, dz) / l.blend);
}

/** True when the plan shapes the ground of this column. There the land is plain grass over dirt, with no cave under it. */
export function shaped(x: number, z: number): boolean {
  if (!inBounds(x, z)) return false;
  for (let i = 0; i < REGION.levels.length; i++) if (levelWeight(i, x, z) > 0) return true;
  for (const b of REGION.basins) if (inside(b, x, z)) return true;
  return false;
}

/** The ground height of a column after the plan: `natural` is what the land would be without it. */
export function shapeGround(x: number, z: number, natural: number): number {
  let h = natural;
  for (const v of REGION.vales) {
    const w = ease(1 - (reachOf(v.points, x, z) - v.half) / v.fade);
    // Only high ground comes down. A river or a pond in the vale keeps its bed.
    if (w > 0 && h > v.ground) h += (v.ground + (h - v.ground) * v.keep - h) * w;
  }
  for (let i = 0; i < REGION.levels.length; i++) {
    const w = levelWeight(i, x, z);
    if (w > 0) h += (REGION.levels[i].ground - h) * w;
  }
  for (const b of REGION.basins) if (inside(b, x, z)) h = b.ground;
  return h;
}

// ------------------------------------------------------------------------------------------ paths

/** The box around each path, grown by its width, for a quick no. */
const PATH_BOXES: Rect[] = REGION.paths.map((p) => {
  const xs = p.points.map((q) => q[0]), zs = p.points.map((q) => q[1]);
  const by = Math.ceil(p.half) + Math.max(4, REGION.pathOpen * 2);
  return { x0: Math.min(...xs) - by, z0: Math.min(...zs) - by, x1: Math.max(...xs) + by, z1: Math.max(...zs) + by };
});

/**
 * How far a column is past the edge of the nearest path, in blocks: 0 or less on the path itself,
 * 2 when two blocks of verge lie between. Infinity far from every path.
 */
export function pathReach(x: number, z: number): number {
  let best = Infinity;
  for (let k = 0; k < REGION.paths.length; k++) {
    if (!inside(PATH_BOXES[k], x, z)) continue;
    const path = REGION.paths[k], points = path.points;
    for (let i = 0; i + 1 < points.length; i++) {
      const ax = points[i][0], az = points[i][1];
      const bx = points[i + 1][0] - ax, bz = points[i + 1][1] - az;
      const along = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz)));
      const d = Math.hypot(x - ax - bx * along, z - az - bz * along) - path.half;
      if (d < best) best = d;
    }
  }
  return best;
}

/** True when the column is part of a path of the plan. */
export const onPath = (x: number, z: number): boolean => pathReach(x, z) <= 0;

// ------------------------------------------------------------------------------------------ what may grow

/** False where no wild tree takes root: the sites, the path and its verges. */
export function treeAllowed(x: number, z: number): boolean {
  if (!inBounds(x, z)) return true;
  for (const r of REGION.noTrees) if (inside(r, x, z)) return false;
  return pathReach(x, z) > 3;
}

/** True where nothing is scattered: the grant's middle, the path, the town, the garden's beds, and where the plan put a tree, a bush or a rock. */
export function scatterBlocked(x: number, z: number): boolean {
  const fx = Math.floor(x), fz = Math.floor(z);
  if (!inBounds(fx, fz)) return false;
  for (const r of REGION.bare) if (inside(r, fx, fz)) return true;
  return pathReach(fx, fz) <= 1;
}

/**
 * How open the plan keeps a place, 0 to 1: 1 around the sites and along the path, 0 where the land's
 * own woods may stand. The scatter's forest is multiplied by one minus this.
 */
export function clearing(x: number, z: number): number {
  const fx = Math.floor(x), fz = Math.floor(z);
  if (!inBounds(fx, fz)) return 0;
  let most = 0;
  for (const c of REGION.clearings) {
    const dx = fx < c.x0 ? c.x0 - fx : fx > c.x1 ? fx - c.x1 : 0;
    const dz = fz < c.z0 ? c.z0 - fz : fz > c.z1 ? fz - c.z1 : 0;
    if (dx >= c.fade || dz >= c.fade) continue;
    most = Math.max(most, ease(1 - Math.hypot(dx, dz) / c.fade));
  }
  const reach = pathReach(fx, fz);
  if (reach < REGION.pathOpen * 2) most = Math.max(most, ease(2 - reach / REGION.pathOpen));
  return most;
}

// ------------------------------------------------------------------------------------------ buildings

let builtList: Built[] | null = null;

/** Every building of the plan, turned and put down. Worked out once. */
export function built(): readonly Built[] {
  if (builtList) return builtList;
  const lamp = blockId('lamp');
  builtList = REGION.buildings.map((plan) => {
    const cells: number[] = [];
    const props: RegionProp[] = [];
    const turns = ((plan.turns % 4) + 4) % 4;
    const done = stamp(BLUEPRINTS[plan.blueprint], { x: plan.x, y: REGION.townGround - 1, z: plan.z }, turns, {
      setBlock: (x, y, z, id) => void cells.push(x, y, z, id),
      place(kind, variant, at, rotation, scale) {
        const shown = kind === 'sign' && plan.sign !== undefined ? plan.sign : variant;
        props.push({ kind, variant: shown, x: at.x, y: at.y, z: at.z, rotation, scale, quarterTurns: turns, building: plan.id });
        return props.length;
      },
    });
    // A lamp hangs under the roof in the middle of each house, so its windows glow at night.
    cells.push(done.min.x + (done.size.x >> 1), done.min.y + 3, done.min.z + (done.size.z >> 1), lamp);
    return {
      plan,
      x0: done.min.x, y0: done.min.y, z0: done.min.z,
      x1: done.min.x + done.size.x - 1, y1: done.min.y + done.size.y - 1, z1: done.min.z + done.size.z - 1,
      door: done.door,
      outside: done.outside,
      cells: Int32Array.from(cells),
      props,
    };
  });
  return builtList;
}

let propList: RegionProp[] | null = null;

/** Every prop of the region: the doors, windows, signs and furniture of the buildings, then the ones that stand alone. */
export function regionProps(): readonly RegionProp[] {
  if (propList) return propList;
  propList = [];
  for (const b of built()) propList.push(...b.props);
  for (const p of REGION.props) propList.push({ ...p, scale: 1, quarterTurns: 0, building: '' });
  return propList;
}

// ------------------------------------------------------------------------------------------ models

/** A kit model of the plan after it was turned and put down. */
export interface PlacedModel {
  plan: PlanModel;
  /** The middle of its footprint, where the model's origin stands, and how far it is turned around y in radians. */
  x: number;
  z: number;
  rotation: number;
  /** Its footprint, both ends inside. */
  x0: number; z0: number; x1: number; z1: number;
  /** The columns a body cannot walk through, as x, z pairs. */
  solid: Int32Array;
  /** The block in front of the middle of its front, and the one past that. */
  door: { x: number; y: number; z: number };
  outside: { x: number; y: number; z: number };
}

let placedList: PlacedModel[] | null = null;

/** Every kit model of the plan, turned and put down. Worked out once. */
export function placedModels(): readonly PlacedModel[] {
  if (placedList) return placedList;
  const y = REGION.townGround;
  placedList = REGION.models.map((plan) => {
    const def = TOWN_MODELS[plan.model];
    const [w, d] = def.footprint;
    const turns = ((plan.turns % 4) + 4) % 4;
    const [tw, td] = turns % 2 === 0 ? [w, d] : [d, w];
    const x = plan.x + tw / 2, z = plan.z + td / 2;
    /** Turns a point of the model's own space, front toward +z, into the world. */
    const turn = (lx: number, lz: number): [number, number] => {
      for (let i = 0; i < turns; i++) [lx, lz] = [lz, -lx];
      return [x + lx, z + lz];
    };
    const solid: number[] = [];
    for (const cell of def.solid) {
      const [wx, wz] = turn((cell % w) + 0.5 - w / 2, Math.floor(cell / w) + 0.5 - d / 2);
      solid.push(Math.floor(wx), Math.floor(wz));
    }
    const [dx, dz] = turn(0.01, d / 2 + 0.5), [ox, oz] = turn(0.01, d / 2 + 1.5);
    return {
      plan, x, z, rotation: (turns * Math.PI) / 2,
      x0: plan.x, z0: plan.z, x1: plan.x + tw - 1, z1: plan.z + td - 1,
      solid: Int32Array.from(solid),
      door: { x: Math.floor(dx), y, z: Math.floor(dz) },
      outside: { x: Math.floor(ox), y, z: Math.floor(oz) },
    };
  });
  return placedList;
}

// ------------------------------------------------------------------------------------------ blocks

const FILL_IDS = REGION.fills.map((f) => blockId(f.block));

export type Put = (x: number, y: number, z: number, id: number) => void;

/**
 * Writes the plan's fills, buildings and the bodies of its models that fall in the chunk whose lowest corner is (ox, oz).
 * `put` may be handed blocks outside the chunk and drops them.
 */
export function stampStructures(ox: number, oz: number, size: number, put: Put): void {
  const x1 = ox + size - 1, z1 = oz + size - 1;
  const fills = REGION.fills;
  for (let i = 0; i < fills.length; i++) {
    const f = fills[i];
    if (f.x1 < ox || f.x0 > x1 || f.z1 < oz || f.z0 > z1) continue;
    const id = FILL_IDS[i];
    const ax = Math.max(f.x0, ox), bx = Math.min(f.x1, x1), az = Math.max(f.z0, oz), bz = Math.min(f.z1, z1);
    for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) for (let y = f.y0; y <= f.y1; y++) put(x, y, z, id);
  }
  for (const b of built()) {
    if (b.x1 < ox || b.x0 > x1 || b.z1 < oz || b.z0 > z1) continue;
    const c = b.cells;
    for (let i = 0; i < c.length; i += 4) put(c[i], c[i + 1], c[i + 2], c[i + 3]);
  }
  // A kit model is drawn by a view; in the world it is two blocks of barrier over each solid column.
  const barrier = blockId('barrier'), y = REGION.townGround;
  for (const m of placedModels()) {
    if (m.x1 < ox || m.x0 > x1 || m.z1 < oz || m.z0 > z1) continue;
    const c = m.solid;
    for (let i = 0; i < c.length; i += 2) { put(c[i], y, c[i + 1], barrier); put(c[i], y + 1, c[i + 1], barrier); }
  }
}
