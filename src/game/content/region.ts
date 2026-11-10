// The plan of Greenhollow's first part, as data: the grant, the mossy rocks, the dead garden, the path
// and Hollowmere. The terrain reads it while it makes each chunk, on the page and in the worker alike,
// so everything here is plain numbers and names. The region system reads the same plan for its places.
//
// Coordinates are whole blocks: x runs east, z runs south, y is up. A column is named by its (x, z).
// A height that is called "ground" is where feet stand: the top block of that ground is at ground - 1.
//
// The plan is laid out on the land of world seed 1, the seed the game uses: the meadow north of the hill,
// and the bend of the river Mere east of it. Another seed gets the same plan on its own land.

import type { BlueprintName } from '../../content/blueprints.ts';
import { TOWN_GROUND, type TownPlan } from './town/kit.ts';
import { townNow } from './town/now.ts';
import { townA } from './town/a.ts';
import { townB } from './town/b.ts';
import { TOWN } from './town/pick.ts';

export type BlueprintKind = BlueprintName;

/** A rectangle of columns. Both ends are inside it. */
export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Ground made level: `ground` inside the rectangle, easing back to the land's own height over `blend` blocks. */
export interface Level extends Rect {
  ground: number;
  blend: number;
}

/** A box filled with one block. Both ends are inside it. Later fills replace earlier ones. */
export interface Fill {
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
  /** A key from src/content/blocks.ts. `air` clears. */
  block: string;
}

export interface PlanBuilding {
  id: string;
  blueprint: BlueprintKind;
  /** The corner with the lowest x and z of the box it lands in, roof overhang included. */
  x: number;
  z: number;
  /** Quarter turns, counter-clockwise seen from above. 0 leaves the door facing south, 3 west. */
  turns: number;
  /** The variant of its shop sign, when the blueprint has one. */
  sign?: number;
  /** The named place it gives: the block just outside its door, or the doorway itself. */
  place?: { name: string; label: string; at: 'outside' | 'door' };
}

export interface PlanPlace {
  name: string;
  /** The column to stand in, and the height of the feet. */
  x: number;
  y: number;
  z: number;
  /** A short label for the map, or empty to keep it off the map. */
  label: string;
}

export interface PlanTree {
  x: number;
  z: number;
  kind: 'oak' | 'birch';
  /** 0 to 1: a taller trunk the closer to 1. */
  size: number;
}

/** A prop that is not part of a blueprint. `x`, `y` and `z` are meters, so 4.5 is the middle of a block. */
export interface PlanProp {
  kind: string;
  variant: number;
  x: number;
  y: number;
  z: number;
  /** Radians around y. At 0 its front faces south. */
  rotation: number;
}

export interface PlanPath {
  /** Columns the middle of the path runs through, in order. */
  points: readonly (readonly [x: number, z: number])[];
  /** A column is on the path when its middle is this close to the line. 1.5 gives a path three blocks wide. */
  half: number;
}

export interface RegionPlan {
  /** The player's plot. Blocks placed inside it stay. */
  grant: { x: number; z: number; width: number; depth: number };
  /** The column a new game starts in, the height of the feet, and the way the hero faces (PI is south). */
  spawn: { x: number; y: number; z: number; facing: number };
  levels: readonly Level[];
  /** Columns dug down to `ground`, with a sharp edge. Water fills them. */
  basins: readonly (Rect & { ground: number })[];
  /** Dirt paths that follow the land. Where the land dips under the water line, the path is a plank bridge. */
  paths: readonly PlanPath[];
  fills: readonly Fill[];
  buildings: readonly PlanBuilding[];
  /** Feet height of the town's floors: buildings are stamped one block under it. */
  townGround: number;
  trees: readonly PlanTree[];
  bushes: readonly { x: number; z: number }[];
  places: readonly PlanPlace[];
  props: readonly PlanProp[];
  /** Where no wild tree takes root. */
  noTrees: readonly Rect[];
  /** Where nothing is scattered at all: no trees, no plants, no rocks. */
  bare: readonly Rect[];
  /**
   * Where the land is kept open: no scattered tree stands inside a rectangle or within half of `fade`
   * outside it, and the woods are back in full at `fade` blocks. Grass and flowers stay. A path is kept
   * open the same way for `pathOpen` blocks on either side, fading over as many again.
   */
  clearings: readonly (Rect & { fade: number })[];
  pathOpen: number;
  /** The town's bounds. Nothing inside can be changed by the player. */
  town: Rect;
  /** The middle of the town and how far it reaches, for the sound and the map. */
  townCenter: { x: number; z: number; radius: number };
}

// ------------------------------------------------------------------------------------------ the sites

/** Feet heights of the three sites. */
const GRANT_GROUND = 22, GARDEN_GROUND = 21;

const GRANT = { x: -30, z: -248, width: 28, depth: 28 };
/** The standing stone, at the grant's south-east corner. */
const STONE = { x: -3, z: -221 };
/** The middle of the dead garden. */
const GARDEN = { x: -79, z: -232 };
/** Hollowmere, in the layout this page asked for (town/pick.ts). */
const HOLLOWMERE: TownPlan = TOWN === 'a' ? townA() : TOWN === 'b' ? townB() : townNow();

const fills: Fill[] = [];
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: string): void => {
  fills.push({ x0, y0, z0, x1, y1, z1, block });
};
const one = (x: number, y: number, z: number, block: string): void => box(x, y, z, x, y, z, block);

// ---- the grant: the standing stone
{
  const g = GRANT_GROUND;
  one(STONE.x, g, STONE.z, 'mossy_stone');
  box(STONE.x, g + 1, STONE.z, STONE.x, g + 2, STONE.z, 'stone');
}

// ---- the mossy rocks north-east of the stone, with a pool two blocks wide. The camera starts in the
// south-east and looks north-west, so the oaks listed under `trees` stand north and west of the rocks:
// each stone lies under the south or east half of a crown, in shade and in plain view.
const ROCKS_FLUSH: readonly (readonly [number, number])[] = [
  [6, -231], [7, -231], [8, -231], [6, -232], [7, -232],
  [5, -230], [5, -229], [5, -228], [4, -228], [4, -227], [4, -230],
  [11, -231], [12, -231], [13, -231],
];
const ROCKS_POOL: readonly (readonly [number, number])[] = [[6, -230], [7, -230], [6, -229], [7, -229]];
{
  const g = GRANT_GROUND;
  for (const [x, z] of ROCKS_FLUSH) one(x, g - 1, z, 'mossy_stone');
  for (const [x, z] of ROCKS_POOL) one(x, g - 1, z, 'water');
  // Three boulders that stand up from the ground.
  one(8, g, -232, 'mossy_stone');
  box(4, g, -229, 4, g + 1, -229, 'mossy_stone');
  one(12, g, -232, 'mossy_stone');
}

// ---- the dead garden: four dry beds, a broken fence around them, and the ruin of a house to the north
{
  const g = GARDEN_GROUND, cx = GARDEN.x, cz = GARDEN.z;
  // The beds. The leaftail walks between them: content/pets.ts names these same four spots and the middle.
  for (const [bx, bz] of [[-4, -3], [2, -3], [2, 2], [-4, 2]] as const) box(cx + bx, g - 1, cz + bz, cx + bx + 2, g - 1, cz + bz + 1, 'tilled_soil');

  // The fence: one block high, posts of log and rails of plank, with whole runs missing.
  const x0 = cx - 7, x1 = cx + 7, z0 = cz - 6, z1 = cz + 6;
  const gone = (x: number, z: number): boolean =>
    (z === z0 && x >= cx - 1 && x <= cx + 1) || // the way to the house
    (z === z1 && x >= cx - 4 && x <= cx - 1) || // the south side fell
    (z === z1 && x === cx + 5) ||
    (x === x0 && z >= cz - 1 && z <= cz + 1) || // the west gate
    (x === x1 && z >= cz + 2 && z <= cz + 4) ||
    (x === x1 && z === cz - 4) ||
    (z === z0 && x === cx + 5);
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
      if (gone(x, z)) continue;
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
      one(x, g, z, corner || (x + z) % 4 === 0 ? 'oak_log' : 'oak_plank');
    }
  }

  // The house: a cobble footing, a few floor boards, and walls that stand to different heights.
  const hx0 = cx - 4, hx1 = cx + 4, hz0 = cz - 14, hz1 = cz - 9;
  box(hx0, g - 1, hz0, hx1, g - 1, hz1, 'cobble');
  box(hx0 + 1, g - 1, hz0 + 1, hx1 - 1, g - 1, hz1 - 1, 'dirt');
  box(hx0 + 1, g - 1, hz0 + 1, hx0 + 3, g - 1, hz0 + 2, 'oak_plank');
  box(hx1 - 2, g - 1, hz1 - 2, hx1 - 1, g - 1, hz1 - 1, 'oak_plank');
  const wall = (x: number, z: number, high: number, block = 'oak_plank'): void => {
    if (high > 0) box(x, g, z, x, g + high - 1, z, block);
  };
  // North wall, west to east. North and west are the tall sides, away from the camera.
  [3, 3, 2, 2, 3, 1, 0, 2, 3].forEach((high, i) => wall(hx0 + i, hz0, high, i === 0 || i === 8 ? 'oak_log' : 'oak_plank'));
  // East and west walls, north to south, and the south wall with its doorway.
  [2, 3, 1, 0].forEach((high, i) => wall(hx0, hz0 + 1 + i, high));
  [2, 1, 0, 1].forEach((high, i) => wall(hx1, hz0 + 1 + i, high));
  [1, 1, 0, 0, 0, 0, 1, 1, 2].forEach((high, i) => wall(hx0 + i, hz1, high, i === 0 || i === 8 ? 'oak_log' : 'oak_plank'));
}

const PLACES: readonly PlanPlace[] = [
  { name: 'grant.stone', x: STONE.x + 1, y: GRANT_GROUND, z: STONE.z, label: 'Grant stone' },
  { name: 'grant.center', x: GRANT.x + 14, y: GRANT_GROUND, z: GRANT.z + 14, label: 'Your plot' },
  { name: 'grant.rocks', x: 8, y: GRANT_GROUND, z: -228, label: 'Mossy rocks' },
  { name: 'dead.garden', x: GARDEN.x, y: GARDEN_GROUND, z: GARDEN.z, label: 'Dead garden' },
  ...HOLLOWMERE.places,
];

const TREES: readonly PlanTree[] = [
  // Over the mossy rocks: one north of them, one west, one north-east.
  { x: 7, z: -233, kind: 'oak', size: 0.8 },
  { x: 3, z: -229, kind: 'oak', size: 0.6 },
  { x: 12, z: -233, kind: 'oak', size: 0.9 },
  // North and east of the grant, never south-east of it, so the plot stays in view.
  { x: -27, z: -253, kind: 'oak', size: 0.3 },
  { x: -20, z: -255, kind: 'birch', size: 0.6 },
  { x: -12, z: -253, kind: 'oak', size: 0.7 },
  { x: -5, z: -255, kind: 'oak', size: 0.2 },
  { x: 1, z: -249, kind: 'birch', size: 0.4 },
  { x: 3, z: -242, kind: 'oak', size: 0.5 },
  // Old trees behind the ruined house.
  { x: -70, z: -247, kind: 'oak', size: 0.6 },
  { x: -89, z: -248, kind: 'oak', size: 0.4 },
  { x: -66, z: -234, kind: 'birch', size: 0.5 },
  ...HOLLOWMERE.trees,
];

/** Six around the dead garden, then four along the path. */
const BUSHES: readonly { x: number; z: number }[] = [
  { x: -89, z: -236 }, { x: -88, z: -226 }, { x: -79, z: -223 }, { x: -69, z: -229 }, { x: -69, z: -239 }, { x: -87, z: -243 },
  { x: 20, z: -224 }, { x: 52, z: -218 }, { x: 84, z: -224 }, { x: 113, z: -201 },
];

const around = (x: number, z: number, by: number): Rect => ({ x0: x - by, z0: z - by, x1: x + by, z1: z + by });

export const REGION: RegionPlan = {
  grant: GRANT,
  // Two blocks north of the stone, facing it.
  spawn: { x: STONE.x, y: GRANT_GROUND, z: STONE.z - 2, facing: Math.PI },
  levels: [
    { x0: GRANT.x - 2, z0: GRANT.z - 2, x1: GRANT.x + GRANT.width + 1, z1: GRANT.z + GRANT.depth + 1, ground: GRANT_GROUND, blend: 5 },
    { x0: 0, z0: -237, x1: 15, z1: -225, ground: GRANT_GROUND, blend: 4 },
    { x0: GARDEN.x - 13, z0: GARDEN.z - 17, x1: GARDEN.x + 13, z1: GARDEN.z + 12, ground: GARDEN_GROUND, blend: 4 },
    { x0: 137, z0: -190, x1: 203, z1: -129, ground: TOWN_GROUND, blend: 4 },
    // The ground the gate stands on.
    { x0: 130, z0: -179, x1: 137, z1: -169, ground: TOWN_GROUND, blend: 4 },
    ...HOLLOWMERE.levels,
  ],
  // The river in front of the quay, so the bank has a straight edge and deep water at any seed.
  basins: [{ x0: 138, z0: -128, x1: 202, z1: -119, ground: 15 }],
  // It starts one block past the stone's place, so it reaches that place and stops short of the grant.
  paths: [{ points: [[STONE.x + 2, STONE.z], [92, -221], [126, -177], [137, -174]], half: 1.5 }],
  fills: [...fills, ...HOLLOWMERE.fills],
  buildings: HOLLOWMERE.buildings,
  townGround: TOWN_GROUND,
  trees: TREES,
  bushes: BUSHES,
  places: PLACES,
  props: [
    ...HOLLOWMERE.props,
    // Moss on stumps by the rocks and wildflowers along the path where the game starts.
    { kind: 'mossStump', variant: 0, x: 1.5, y: GRANT_GROUND, z: -230.5, rotation: 0.7 },
    { kind: 'mossStump', variant: 0, x: 15.5, y: GRANT_GROUND, z: -227.5, rotation: 2.4 },
    { kind: 'wildflowers', variant: 0, x: -5.5, y: GRANT_GROUND, z: -219.5, rotation: 0 },
    { kind: 'wildflowers', variant: 0, x: 1.5, y: GRANT_GROUND, z: -219.5, rotation: 1.6 },
    { kind: 'wildflowers', variant: 0, x: -6.5, y: GRANT_GROUND, z: -225.5, rotation: 3.1 },
  ],
  noTrees: [
    { x0: GRANT.x - 3, z0: GRANT.z - 3, x1: GRANT.x + GRANT.width + 2, z1: GRANT.z + GRANT.depth + 2 },
    { x0: -1, z0: -238, x1: 16, z1: -224 },
    { x0: GARDEN.x - 13, z0: GARDEN.z - 17, x1: GARDEN.x + 13, z1: GARDEN.z + 12 },
    { x0: 128, z0: -193, x1: 206, z1: -118 },
    ...BUSHES.map((b) => around(b.x, b.z, 2)),
  ],
  bare: [
    // The whole grant: a tree of the scatter cannot be cut, and a tuft would poke through a floor.
    { x0: GRANT.x, z0: GRANT.z, x1: GRANT.x + GRANT.width - 1, z1: GRANT.z + GRANT.depth - 1 },
    around(STONE.x, STONE.z, 1),
    { x0: 3, z0: -233, x1: 14, z1: -226 },
    // The garden's beds and fence, and the ruin.
    { x0: GARDEN.x - 7, z0: GARDEN.z - 14, x1: GARDEN.x + 7, z1: GARDEN.z + 6 },
    { x0: 131, z0: -190, x1: 203, z1: -119 },
    ...TREES.map((t) => around(t.x, t.z, 1)),
    ...BUSHES.map((b) => around(b.x, b.z, 1)),
  ],
  // Each site keeps open land around it, and more of it to the south and east, where the camera stands.
  clearings: [
    { x0: GRANT.x - 8, z0: GRANT.z - 4, x1: GRANT.x + GRANT.width + 20, z1: GRANT.z + GRANT.depth + 14, fade: 10 },
    { x0: GARDEN.x - 14, z0: GARDEN.z - 15, x1: GARDEN.x + 22, z1: GARDEN.z + 20, fade: 8 },
    { x0: 125, z0: -196, x1: 210, z1: -114, fade: 8 },
  ],
  pathOpen: 4,
  town: { x0: 131, z0: -192, x1: 206, z1: -118 },
  townCenter: { x: 170, z: -158, radius: 46 },
};
