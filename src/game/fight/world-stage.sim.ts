// A stage made from the world at a place: the circle a fight is fought in, read once from the ground when the
// fight starts. Ground that rises or falls more than a step from the middle is a wall, water is water, and a
// tree or a rock the region stood there is solid. The fight then asks its questions of this grid, so the rules
// never read the world while they step.
//
// The circle's edge is the fight's edge: the beasts do not leave it, and a hero who walks out of it leaves the
// fight (`src/game/fights`).
import type { Stage } from './arena.sim.ts';

/** What the stage reads of the world, once, cell by cell. */
export interface GroundReader {
  /** The height of the ground's top at a column. */
  height(x: number, z: number): number;
  /** True over water. */
  water(x: number, z: number): boolean;
  /** True where a tree, a rock or a building stands. Without it, nothing does. */
  blocked?(x: number, z: number): boolean;
}

export interface WorldStageSpec {
  /** The fight's place: the middle of the circle, and where the beasts are brought in. */
  x: number;
  z: number;
  radius: number;
  /** Where the hero stands as it starts. A fainted hero wakes at the edge on this side. */
  from: { x: number; z: number };
}

/** A rise this high from one cell to the next is a wall: a cliff, a trunk, a boulder. A slope is ground. */
const STEP = 1.6;

/** The circle round a place of the world. */
export function worldStage(ground: GroundReader, spec: WorldStageSpec): Stage {
  const r = Math.ceil(spec.radius) + 1, size = r * 2 + 1;
  const x0 = Math.floor(spec.x) - r, z0 = Math.floor(spec.z) - r;
  // The heights with a rim of one, then 0 open, 1 solid, 2 water, one byte a cell.
  const rim = size + 2, heights = new Float32Array(rim * rim);
  for (let i = 0; i < rim; i++) for (let j = 0; j < rim; j++) heights[i * rim + j] = ground.height(x0 + i - 1, z0 + j - 1);
  const heightOf = (i: number, j: number): number => heights[(i + 1) * rim + (j + 1)] as number;
  const cells = new Uint8Array(size * size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const x = x0 + i, z = z0 + j, h = heightOf(i, j);
      // Higher than a neighbour by more than a step: this cell stands up out of the ground.
      const wall = h - Math.min(heightOf(i - 1, j), heightOf(i + 1, j), heightOf(i, j - 1), heightOf(i, j + 1)) > STEP;
      cells[i * size + j] = ground.water(x, z) ? 2 : wall || ground.blocked?.(x, z) ? 1 : 0;
    }
  }
  const cell = (x: number, z: number): number => {
    const i = Math.floor(x) - x0, j = Math.floor(z) - z0;
    if (i < 0 || j < 0 || i >= size || j >= size) return 1;
    return cells[i * size + j] as number;
  };
  const cx = spec.x, cz = spec.z;
  const inside = (x: number, z: number): boolean => (x - cx) * (x - cx) + (z - cz) * (z - cz) <= spec.radius * spec.radius;

  /** The nearest open cell to a point, inside the circle. */
  function open(x: number, z: number): { x: number; z: number } {
    for (let ring = 0; ring <= r; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const px = Math.floor(x) + dx + 0.5, pz = Math.floor(z) + dz + 0.5;
          if (inside(px, pz) && cell(px, pz) === 0) return { x: px, z: pz };
        }
      }
    }
    return { x, z };
  }

  const away = Math.hypot(spec.from.x - cx, spec.from.z - cz) || 1;
  const ux = (spec.from.x - cx) / away, uz = (spec.from.z - cz) / away;
  const edge = Math.max(2, spec.radius - 1.5);
  return {
    solid: (x, z) => cell(x, z) === 1,
    inside,
    water: (x, z) => cell(x, z) === 2,
    swim: (x, z) => cell(x, z) === 2,
    center: { x: cx, z: cz },
    radius: spec.radius,
    start: inside(spec.from.x, spec.from.z) ? open(spec.from.x, spec.from.z) : open(cx + ux * edge, cz + uz * edge),
    den: open(cx, cz),
    wake: open(cx + ux * edge, cz + uz * edge),
  };
}
