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
import type { TownModelName } from '../../content/town-kit.ts';
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

/**
 * A model of the Hollowmere town kit (src/content/town-kit.ts) set down in the town. It is drawn by
 * src/game/views/world-town.view.ts, and its solid cells become invisible barrier blocks.
 */
export interface PlanModel {
  id: string;
  model: TownModelName;
  /** The corner with the lowest x and z of its footprint, after it is turned. */
  x: number;
  z: number;
  /** Quarter turns, counter-clockwise seen from above. 0 leaves its front facing south, 1 east, 3 west. */
  turns: number;
  /** The named place it gives: the block in front of the middle of its front, or the one past that. */
  place?: { name: string; label: string; at: 'door' | 'outside' };
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
  /** How much larger than usual it is drawn. 1 when left out. */
  scale?: number;
}

export interface PlanPath {
  /** Columns the middle of the path runs through, in order. */
  points: readonly (readonly [x: number, z: number])[];
  /** A column is on the path when its middle is this close to the line. 1.5 gives a path three blocks wide. */
  half: number;
}

/**
 * Gentle ground along a line: the vale the path runs through. No hill stands within `half` blocks of the
 * line, and land above `ground` keeps only `keep` of its height over it, so the meadow still rolls; it has its own shape again `fade` blocks further out.
 */
export interface Vale {
  points: readonly (readonly [x: number, z: number])[];
  half: number;
  fade: number;
  ground: number;
  keep: number;
}

/** A round rise in the meadow: `height` blocks at its middle, gone about `radius` blocks out. */
export interface Knoll {
  x: number;
  z: number;
  radius: number;
  height: number;
}

export interface RegionPlan {
  /** The player's plot. Blocks placed inside it stay. */
  grant: { x: number; z: number; width: number; depth: number };
  /** The column a new game starts in, the height of the feet, and the way the hero faces (PI is south). */
  spawn: { x: number; y: number; z: number; facing: number };
  /** Shaped before the levels, so a site's level ground still lies in the vale. */
  vales: readonly Vale[];
  /** Raised after the vales and before the levels. */
  knolls: readonly Knoll[];
  levels: readonly Level[];
  /** Columns dug down to `ground`, with a sharp edge. Water fills them. */
  basins: readonly (Rect & { ground: number })[];
  /** Dirt paths that follow the land. Where the land dips under the water line, the path is a plank bridge. */
  paths: readonly PlanPath[];
  fills: readonly Fill[];
  buildings: readonly PlanBuilding[];
  /** Models of the town kit, in a layout of the town that uses them. */
  models: readonly PlanModel[];
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
  /** Ruins of the ancients. Like the town, nothing inside can be dug or built on by the player. */
  sealed: readonly Rect[];
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
/** The boulders among the mossy rocks: column, and height in blocks. */
const BOULDERS: readonly (readonly [x: number, z: number, high: number])[] = [[8, -232, 1], [4, -229, 2], [12, -232, 1]];
{
  const g = GRANT_GROUND;
  for (const [x, z] of ROCKS_FLUSH) one(x, g - 1, z, 'mossy_stone');
  for (const [x, z] of ROCKS_POOL) one(x, g - 1, z, 'water');
  // Three boulders that stand up from the ground: rocks to look at (`props` below) around blocks nobody walks through.
  for (const [x, z, high] of BOULDERS) box(x, g, z, x, g + high - 1, z, 'barrier');
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

// ---- Ilara's Hall: a walled court of the ancients against the foot of the hill north of the grant, open
// to the sky. Its one way in is the Shut Door in the south wall, which src/game/hall opens. North and west
// are the tall sides, away from the camera. The low south and east walls carry invisible barrier above
// them, so nobody climbs in. The Heartstone, the Gate and the plinth are props drawn by a view; here they
// are barrier, so they are solid.
const HALL_GROUND = GRANT_GROUND;
/** The court's walls: x0 and x1 are the west and east walls, z0 and z1 the north and south walls. */
const COURT: Rect = { x0: -25, z0: -265, x1: -9, z1: -253 };
/** The doorway in the south wall: three columns, three blocks high. */
const DOOR = { x0: -18, x1: -16, z: COURT.z1, high: 3 };
{
  const g = HALL_GROUND, { x0, z0, x1, z1 } = COURT;
  // The floor: old paving, with moss where the roots came through.
  box(x0 + 1, g - 1, z0 + 1, x1 - 1, g - 1, z1 - 1, 'cobble');
  for (const [mx, mz] of [[-23, -262], [-22, -262], [-12, -256], [-11, -256], [-11, -257], [-20, -258], [-14, -263], [-21, -255]] as const) one(mx, g - 1, mz, 'mossy_stone');
  // North and west walls, standing. Every third column is mossy.
  for (let x = x0; x <= x1; x++) box(x, g, z0, x, g + 3, z0, x % 3 === 0 ? 'mossy_stone' : 'stone_brick');
  for (let z = z0 + 1; z <= z1; z++) box(x0, g, z, x0, g + 2, z, z % 3 === 0 ? 'mossy_stone' : 'stone_brick');
  // East and south walls, fallen to one course, with the old seal still over them.
  for (let z = z0 + 1; z <= z1; z++) {
    one(x1, g, z, z % 4 === 0 ? 'mossy_stone' : 'stone_brick');
    box(x1, g + 1, z, x1, g + 3, z, 'barrier');
  }
  for (let x = x0 + 1; x < x1; x++) {
    if (x >= DOOR.x0 - 1 && x <= DOOR.x1 + 1) continue;
    one(x, g, z1, x % 4 === 0 ? 'mossy_stone' : 'stone_brick');
    box(x, g + 1, z1, x, g + 3, z1, 'barrier');
  }
  // The door's posts, and the door itself: solid until the hall system opens it.
  box(DOOR.x0 - 1, g, z1, DOOR.x0 - 1, g + DOOR.high, z1, 'stone_brick');
  box(DOOR.x1 + 1, g, z1, DOOR.x1 + 1, g + DOOR.high, z1, 'stone_brick');
  box(DOOR.x0, g, z1, DOOR.x1, g + DOOR.high - 1, z1, 'barrier');
}

/**
 * Ilara's Hall for the systems and views that run it: the door's cells, and where its things stand.
 * Every point is the middle of a block, with y the height of the feet.
 */
export const HALL = {
  ground: HALL_GROUND,
  court: COURT,
  /** The cells the shut door fills. Opening it clears them. */
  door: { x0: DOOR.x0, x1: DOOR.x1, y0: HALL_GROUND, y1: HALL_GROUND + DOOR.high - 1, z: DOOR.z },
  /** The middle of the doorway, for the door's prop: it faces south. */
  doorAt: { x: (DOOR.x0 + DOOR.x1 + 1) / 2, y: HALL_GROUND, z: DOOR.z + 0.5 },
  /** The Heartstone, against the north wall, two columns wide. */
  heartstone: { x: -16, y: HALL_GROUND, z: -262.5 },
  /** The Gate, by the west wall. Its opening faces east: its two feet are three blocks apart, north and south. */
  gate: { x: -22.5, y: HALL_GROUND, z: -259 },
  /** The plinth the Custodian sleeps on, and the height of its top. */
  plinth: { x: -11.5, y: HALL_GROUND, z: -261.5 },
  plinthTop: 0.4,
  /** The mural, a slab standing against the north wall. */
  mural: { x: -20, y: HALL_GROUND, z: -263.75 },
  /** Broken pillars by the walls: where each stands and which of the three it is. */
  pillars: [
    { x: -23.5, y: HALL_GROUND, z: -256.5, variant: 2 }, { x: -10.5, y: HALL_GROUND, z: -258.5, variant: 1 }, { x: -20.5, y: HALL_GROUND, z: -254.5, variant: 0 },
    // Two more outside, either side of the way to the door: what is left of a porch.
    { x: -20.5, y: HALL_GROUND, z: -249.5, variant: 1 }, { x: -13.5, y: HALL_GROUND, z: -250.5, variant: 0 },
  ],
  lamps: [
    { x: -23.5, y: HALL_GROUND, z: -254.5 }, { x: -10.5, y: HALL_GROUND, z: -254.5 },
    { x: -23.5, y: HALL_GROUND, z: -263.5 }, { x: -10.5, y: HALL_GROUND, z: -263.5 },
  ],
} as const;
// Solid cells under the props a view draws: the Heartstone (two columns), the Gate's two feet, the plinth.
{
  const g = HALL_GROUND;
  box(-17, g, -263, -16, g + 1, -263, 'barrier');
  box(-23, g, -261, -23, g + 2, -261, 'barrier');
  box(-23, g, -258, -23, g + 2, -258, 'barrier');
  one(-12, g, -262, 'barrier');
  // The pillars, and the mural's slab along the wall.
  one(-24, g, -257, 'barrier');
  one(-11, g, -259, 'barrier');
  one(-21, g, -255, 'barrier');
  one(-21, g, -250, 'barrier');
  one(-14, g, -251, 'barrier');
}

// ---- the camp: the player's fire and tent in the south half of the grant, where the first night starts. The stone
// door is north of it, so a player who backs away from the fox backs toward the door. The fox comes out of a
// stand of trees south-west of the plot, beside the camera's view and never between the camera and the fire.
// src/game/views/world-camp.view.ts draws it, and scene 9 (content/cutscenes.ts) is shot around it.
/** Columns of the camp's places: the fire, where the hero sits, the edge of the firelight, the trees. */
const CAMP_AT = { x: -20, z: -229 };
export const CAMP = {
  ground: GRANT_GROUND,
  /** The middle of the fire, in meters. Every offset of scene 9 starts at the place `camp`, which stands here. */
  fire: { x: CAMP_AT.x + 0.5, y: GRANT_GROUND, z: CAMP_AT.z + 0.5 },
  /** The tent: north-east of the fire, its open end turned to the fire. Radians around y, 0 faces south. */
  tent: { x: CAMP_AT.x + 3, y: GRANT_GROUND, z: CAMP_AT.z - 2.5, rotation: Math.atan2(-2.5, 3) },
  /** How far the firelight reaches on the ground, in blocks: the place `camp.edge` stands at its rim. */
  reach: 6.6,
  seat: { x: CAMP_AT.x - 1, z: CAMP_AT.z - 1 },
  edge: { x: CAMP_AT.x - 4, z: CAMP_AT.z + 5 },
  trees: { x: CAMP_AT.x - 7, z: CAMP_AT.z + 11 },
} as const;
// The fire's light: an unseen lamp block in the flame, as the town's lanterns have, so the land, the sprites and
// the crops around it are lit by it at night. It is a block up, so the place `camp` itself stays open ground.
one(CAMP_AT.x, GRANT_GROUND + 1, CAMP_AT.z, 'lantern_light');

const PLACES: readonly PlanPlace[] = [
  { name: 'grant.stone', x: STONE.x + 1, y: GRANT_GROUND, z: STONE.z, label: 'Grant stone' },
  { name: 'grant.center', x: GRANT.x + 14, y: GRANT_GROUND, z: GRANT.z + 14, label: 'Your plot' },
  { name: 'grant.rocks', x: 8, y: GRANT_GROUND, z: -228, label: 'Mossy rocks' },
  { name: 'dead.garden', x: GARDEN.x, y: GARDEN_GROUND, z: GARDEN.z, label: 'Dead garden' },
  // The camp. Only the fire is on the map.
  { name: 'camp', x: CAMP_AT.x, y: GRANT_GROUND, z: CAMP_AT.z, label: 'Camp' },
  { name: 'camp.seat', x: CAMP.seat.x, y: GRANT_GROUND, z: CAMP.seat.z, label: '' },
  { name: 'camp.edge', x: CAMP.edge.x, y: GRANT_GROUND, z: CAMP.edge.z, label: '' },
  { name: 'camp.trees', x: CAMP.trees.x, y: GRANT_GROUND, z: CAMP.trees.z, label: '' },
  // Outside the Shut Door, and four spots inside the Hall. The inside ones stay off the map.
  { name: 'shut.door', x: -17, y: HALL_GROUND, z: -251, label: 'Stone door' },
  { name: 'hall.door', x: -17, y: HALL_GROUND, z: -255, label: '' },
  { name: 'hall.heart', x: -17, y: HALL_GROUND, z: -261, label: '' },
  { name: 'hall.custodian', x: -13, y: HALL_GROUND, z: -261, label: '' },
  { name: 'hall.gate', x: -21, y: HALL_GROUND, z: -260, label: '' },
  { name: 'hall.mural', x: -20, y: HALL_GROUND, z: -263, label: '' },
  ...HOLLOWMERE.places,
];

const TREES: readonly PlanTree[] = [
  // Over the mossy rocks: one north of them, one west, one north-east.
  { x: 7, z: -233, kind: 'oak', size: 0.8 },
  { x: 3, z: -229, kind: 'oak', size: 0.6 },
  { x: 12, z: -233, kind: 'oak', size: 0.9 },
  // North and east of the grant, never south-east of it, so the plot stays in view. They stand clear of the Hall.
  { x: -30, z: -256, kind: 'oak', size: 0.3 },
  { x: -29, z: -268, kind: 'birch', size: 0.6 },
  { x: 4, z: -259, kind: 'oak', size: 0.7 },
  { x: -4, z: -266, kind: 'oak', size: 0.2 },
  { x: 1, z: -249, kind: 'birch', size: 0.4 },
  { x: 3, z: -242, kind: 'oak', size: 0.5 },
  // The lone oak on its hill, with two smaller trees for company, and the old oaks on the rise behind the grant.
  { x: 40, z: -257, kind: 'oak', size: 1 },
  { x: 47, z: -251, kind: 'birch', size: 0.5 },
  { x: 33, z: -250, kind: 'oak', size: 0.4 },
  { x: -36, z: -284, kind: 'oak', size: 0.9 },
  { x: -28, z: -279, kind: 'oak', size: 0.6 },
  { x: -42, z: -278, kind: 'birch', size: 0.7 },
  { x: 168, z: -224, kind: 'oak', size: 0.8 },
  { x: 175, z: -219, kind: 'birch', size: 0.5 },
  // The stand south-west of the camp that the fox comes out of: two trunks either side of its way, and a few
  // behind them, so the dark under them reads as a tree line from the fire.
  { x: -28, z: -219, kind: 'oak', size: 0.5 },
  { x: -25, z: -217, kind: 'oak', size: 0.7 },
  { x: -31, z: -216, kind: 'oak', size: 0.8 },
  { x: -27, z: -213, kind: 'oak', size: 0.9 },
  { x: -23, z: -214, kind: 'birch', size: 0.5 },
  { x: -33, z: -220, kind: 'birch', size: 0.6 },
  { x: -30, z: -211, kind: 'oak', size: 0.6 },
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
  // The vale of Greenhollow: from the dead garden past the grant and along the path to Hollowmere's gate.
  vales: [
    { points: [[GARDEN.x, GARDEN.z], [GRANT.x + 14, GRANT.z + 14], [STONE.x + 2, STONE.z], [92, -221], [126, -177], [170, -160]], half: 18, fade: 70, ground: 21, keep: 0.9 },
    // The land comes down to the town's level well before the gate, so the path walks into Hollowmere and does not drop into it.
    { points: [[104, -204], [126, -177], [170, -160]], half: 30, fade: 45, ground: 20.4, keep: 0.2 },
  ],
  // The rises the eye rests on from the grant and the path. Each stands clear of the path, so the way stays easy,
  // and north or west of where people act, where the camera looks.
  knolls: [
    // Behind the grant, with the old oaks on it.
    { x: -34, z: -282, radius: 30, height: 7 },
    // The hill of the lone oak, north of the path where it sets out.
    { x: 40, z: -256, radius: 34, height: 9 },
    // A low rise south of the path, toward the river.
    { x: 58, z: -196, radius: 24, height: 5 },
    // Between the path's bend and the north river.
    { x: 112, z: -246, radius: 30, height: 7 },
    // Over the town, north of its roofs.
    { x: 168, z: -222, radius: 30, height: 8 },
    // West of the dead garden, where the woods begin.
    { x: -118, z: -212, radius: 28, height: 6 },
  ],
  levels: [
    { x0: GRANT.x - 2, z0: GRANT.z - 2, x1: GRANT.x + GRANT.width + 1, z1: GRANT.z + GRANT.depth + 1, ground: GRANT_GROUND, blend: 9 },
    { x0: 0, z0: -237, x1: 15, z1: -225, ground: GRANT_GROUND, blend: 7 },
    { x0: GARDEN.x - 13, z0: GARDEN.z - 17, x1: GARDEN.x + 13, z1: GARDEN.z + 12, ground: GARDEN_GROUND, blend: 8 },
    // The Hall's court and the ground in front of its door, level with the grant.
    { x0: COURT.x0 - 1, z0: COURT.z0 - 1, x1: COURT.x1 + 1, z1: COURT.z1 + 4, ground: HALL_GROUND, blend: 6 },
    { x0: 137, z0: -190, x1: 203, z1: -129, ground: TOWN_GROUND, blend: 8 },
    // The ground the gate stands on.
    { x0: 130, z0: -179, x1: 137, z1: -169, ground: TOWN_GROUND, blend: 9 },
    ...HOLLOWMERE.levels,
  ],
  // The river in front of the quay, so the bank has a straight edge and deep water at any seed.
  basins: [{ x0: 138, z0: -128, x1: 202, z1: -119, ground: 15 }],
  // It starts one block past the stone's place, so it reaches that place and stops short of the grant.
  paths: [{ points: [[STONE.x + 2, STONE.z], [92, -221], [126, -177], [137, -174]], half: 1.5 }],
  fills: [...fills, ...HOLLOWMERE.fills],
  buildings: HOLLOWMERE.buildings,
  models: HOLLOWMERE.models,
  townGround: TOWN_GROUND,
  trees: TREES,
  bushes: BUSHES,
  places: PLACES,
  props: [
    ...HOLLOWMERE.props,
    ...BOULDERS.map(([x, z, high], i) => ({ kind: 'rock', variant: i, x: x + 0.5, y: GRANT_GROUND, z: z + 0.5, rotation: i * 2.1, scale: 0.9 + high * 0.45 })),
    // Moss on stumps by the rocks and wildflowers along the path where the game starts.
    { kind: 'mossStump', variant: 0, x: 1.5, y: GRANT_GROUND, z: -230.5, rotation: 0.7 },
    { kind: 'mossStump', variant: 0, x: 15.5, y: GRANT_GROUND, z: -227.5, rotation: 2.4 },
    { kind: 'wildflowers', variant: 0, x: -5.5, y: GRANT_GROUND, z: -219.5, rotation: 0 },
    { kind: 'wildflowers', variant: 0, x: 1.5, y: GRANT_GROUND, z: -219.5, rotation: 1.6 },
    { kind: 'wildflowers', variant: 0, x: -6.5, y: GRANT_GROUND, z: -225.5, rotation: 3.1 },
    // The Hall, a thousand years untended: flowers where the roots lifted the paving, bushes against its walls.
    { kind: 'wildflowers', variant: 0, x: -22.5, y: HALL_GROUND, z: -261.5, rotation: 0.4 },
    { kind: 'wildflowers', variant: 0, x: -11.5, y: HALL_GROUND, z: -255.5, rotation: 2.2 },
    { kind: 'wildflowers', variant: 0, x: -20.5, y: HALL_GROUND, z: -257.5, rotation: 1.1 },
    { kind: 'wildflowers', variant: 0, x: -13.5, y: HALL_GROUND, z: -262.5, rotation: 4 },
    { kind: 'wildflowers', variant: 0, x: -19.5, y: HALL_GROUND, z: -251.5, rotation: 5.2 },
    { kind: 'bush', variant: 0, x: -23, y: HALL_GROUND, z: -251.4, rotation: 0.9, scale: 0.9 },
    { kind: 'bush', variant: 1, x: -11, y: HALL_GROUND, z: -251.3, rotation: 2.6, scale: 0.8 },
    { kind: 'bush', variant: 0, x: -26.4, y: HALL_GROUND, z: -258, rotation: 4.1, scale: 1 },
  ],
  noTrees: [
    { x0: GRANT.x - 3, z0: GRANT.z - 3, x1: GRANT.x + GRANT.width + 2, z1: GRANT.z + GRANT.depth + 2 },
    { x0: -1, z0: -238, x1: 16, z1: -224 },
    { x0: GARDEN.x - 13, z0: GARDEN.z - 17, x1: GARDEN.x + 13, z1: GARDEN.z + 12 },
    { x0: COURT.x0 - 2, z0: COURT.z0 - 2, x1: COURT.x1 + 2, z1: COURT.z1 + 4 },
    // And none close on its east side, where a crown would stand between the camera and the court.
    { x0: COURT.x1, z0: COURT.z0 - 4, x1: COURT.x1 + 9, z1: COURT.z1 + 4 },
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
    // The Hall, its walls, and the few steps of open grass between its door and the grant.
    { x0: COURT.x0, z0: COURT.z0, x1: COURT.x1, z1: COURT.z1 + 4 },
    { x0: 131, z0: -190, x1: 203, z1: -119 },
    ...TREES.map((t) => around(t.x, t.z, 1)),
    ...BUSHES.map((b) => around(b.x, b.z, 1)),
  ],
  // Each site keeps open land around it, and more of it to the south and east, where the camera stands.
  clearings: [
    { x0: GRANT.x - 8, z0: GRANT.z - 4, x1: GRANT.x + GRANT.width + 20, z1: GRANT.z + GRANT.depth + 14, fade: 10 },
    { x0: GARDEN.x - 14, z0: GARDEN.z - 15, x1: GARDEN.x + 22, z1: GARDEN.z + 20, fade: 8 },
    { x0: 125, z0: -196, x1: 210, z1: -114, fade: 8 },
    { x0: COURT.x0 - 2, z0: COURT.z0 - 1, x1: COURT.x1 + 6, z1: COURT.z1 + 5, fade: 6 },
  ],
  pathOpen: 4,
  town: { x0: 131, z0: -192, x1: 206, z1: -118 },
  townCenter: { x: 170, z: -158, radius: 46 },
  sealed: [COURT],
};
