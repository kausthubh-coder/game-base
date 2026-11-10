// The plan of Greenhollow's first part, as data: the grant, the mossy rocks, the dead garden, the path
// and Hollowmere. The terrain reads it while it makes each chunk, on the page and in the worker alike,
// so everything here is plain numbers and names. The region system reads the same plan for its places.
//
// Coordinates are whole blocks: x runs east, z runs south, y is up. A column is named by its (x, z).
// A height that is called "ground" is where feet stand: the top block of that ground is at ground - 1.
//
// The plan is laid out on the land of world seed 1, the seed the game uses: the meadow north of the hill,
// and the bend of the river Mere east of it. Another seed gets the same plan on its own land.

export type BlueprintKind = 'cottage' | 'shop' | 'barn';

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
const GRANT_GROUND = 22, GARDEN_GROUND = 21, TOWN_GROUND = 20;

const GRANT = { x: -30, z: -248, width: 28, depth: 28 };
/** The standing stone, at the grant's south-east corner. */
const STONE = { x: -3, z: -221 };
/** The middle of the dead garden. */
const GARDEN = { x: -79, z: -232 };
/** The middle of the well on the square. */
const WELL = { x: 173, z: -150 };

const fills: Fill[] = [];
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: string): void => {
  fills.push({ x0, y0, z0, x1, y1, z1, block });
};
const one = (x: number, y: number, z: number, block: string): void => box(x, y, z, x, y, z, block);
/** A post with a lamp on it, three blocks tall. */
const lampPost = (x: number, z: number, ground: number): void => {
  box(x, ground, z, x, ground + 1, z, 'oak_log');
  one(x, ground + 2, z, 'lamp');
};

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

// ---- Hollowmere. The camera starts in the south-east, so what is tall stands north and west of the
// square with its doors to the south and east, and the low things (the field, the kennel, the quay)
// lie east and south of it.
{
  const g = TOWN_GROUND, top = g - 1;
  // Streets: the main street from the gate, the lane down its east side to the river, the alley into the square's west corner.
  box(137, top, -175, 199, top, -173, 'path');
  box(190, top, -172, 192, top, -132, 'path');
  box(156, top, -172, 157, top, -162, 'path');
  // The square, cobbled, and the quay along the river with its wall down to the river bed.
  box(157, top, -161, 189, top, -139, 'cobble');
  box(139, top, -131, 201, top, -129, 'stone_brick');
  box(139, 15, -129, 201, top, -129, 'stone_brick');

  // The well: a ring of stone brick around water, two posts and a small teal roof.
  box(WELL.x - 1, g, WELL.z - 1, WELL.x + 1, g, WELL.z + 1, 'stone_brick');
  one(WELL.x, g, WELL.z, 'air');
  one(WELL.x, top, WELL.z, 'water');
  box(WELL.x - 1, g + 1, WELL.z, WELL.x - 1, g + 2, WELL.z, 'oak_log');
  box(WELL.x + 1, g + 1, WELL.z, WELL.x + 1, g + 2, WELL.z, 'oak_log');
  box(WELL.x - 1, g + 3, WELL.z - 1, WELL.x + 1, g + 3, WELL.z + 1, 'shingle');
  // A lamp hangs under the roof, so the middle of the square is lit at the festival.
  one(WELL.x, g + 2, WELL.z, 'lamp');

  // Gus's field, at the east edge by the river.
  box(194, top, -157, 202, top, -141, 'tilled_soil');

  // The kennel: a fenced yard with a gap on its west side, and a hutch in one corner.
  const kx0 = 194, kx1 = 202, kz0 = -170, kz1 = -162;
  for (let x = kx0; x <= kx1; x++) {
    for (let z = kz0; z <= kz1; z++) {
      if (x !== kx0 && x !== kx1 && z !== kz0 && z !== kz1) continue;
      if (x === kx0 && z === -166) continue;
      const corner = (x === kx0 || x === kx1) && (z === kz0 || z === kz1);
      if (corner) box(x, g, z, x, g + 1, z, 'oak_log');
      else one(x, g, z, 'oak_plank');
    }
  }
  box(200, g, -169, 201, g, -168, 'oak_plank');
  box(200, g + 1, -169, 201, g + 1, -168, 'shingle');

  // The ferry: a plank dock out from the quay, two posts at its end, and a raft tied beside it.
  box(196, top, -128, 197, top, -123, 'oak_plank');
  box(195, 15, -123, 195, g, -123, 'oak_log');
  one(195, g + 1, -123, 'lamp');
  box(198, 15, -123, 198, g, -123, 'oak_log');
  box(198, top - 1, -127, 200, top - 1, -124, 'oak_plank');

  // Lamps: the gate, the main street, around the square, the bank.
  for (const [x, z] of [
    [136, -177], [136, -171],
    [148, -172], [168, -172], [179, -172], [189, -172],
    [158, -160], [167, -160], [179, -160], [188, -160], [158, -146], [188, -150], [158, -140], [167, -140], [179, -140], [188, -140],
    [143, -133], [151, -133], [161, -133], [169, -133], [177, -133], [185, -133], [195, -133], [201, -133],
  ] as const) lampPost(x, z, g);
}

/** Ten buildings: five face the main street from its north side, three the square, two stand west of it. */
const BUILDINGS: readonly PlanBuilding[] = [
  { id: 'cottage.gate', blueprint: 'cottage', x: 140, z: -183, turns: 0 },
  { id: 'granary', blueprint: 'barn', x: 151, z: -185, turns: 0, place: { name: 'granary', label: 'Granary', at: 'door' } },
  { id: 'sawmill.office', blueprint: 'shop', x: 164, z: -184, turns: 0, sign: 2 },
  { id: 'cottage.north', blueprint: 'cottage', x: 176, z: -183, turns: 0 },
  { id: 'wren.house', blueprint: 'cottage', x: 187, z: -183, turns: 0 },
  // The north side of the square.
  { id: 'lodge', blueprint: 'shop', x: 158, z: -170, turns: 0, sign: 2, place: { name: 'lodge', label: 'Lodge', at: 'outside' } },
  { id: 'bakery', blueprint: 'shop', x: 169, z: -170, turns: 0, sign: 1, place: { name: 'bakery', label: 'Bakery', at: 'outside' } },
  { id: 'cottage.square', blueprint: 'cottage', x: 180, z: -169, turns: 0 },
  // The west side of the square, doors to the east.
  { id: 'carpenter', blueprint: 'shop', x: 147, z: -160, turns: 1, sign: 0, place: { name: 'carpenter', label: 'Carpenter', at: 'outside' } },
  { id: 'cottage.river', blueprint: 'cottage', x: 148, z: -149, turns: 1 },
];

const PLACES: readonly PlanPlace[] = [
  { name: 'grant.stone', x: STONE.x + 1, y: GRANT_GROUND, z: STONE.z, label: 'Grant stone' },
  { name: 'grant.center', x: GRANT.x + 14, y: GRANT_GROUND, z: GRANT.z + 14, label: 'Your plot' },
  { name: 'grant.rocks', x: 8, y: GRANT_GROUND, z: -228, label: 'Mossy rocks' },
  { name: 'dead.garden', x: GARDEN.x, y: GARDEN_GROUND, z: GARDEN.z, label: 'Dead garden' },
  { name: 'town.gate', x: 134, y: TOWN_GROUND, z: -174, label: 'Hollowmere' },
  // Six blocks from the well: the villagers stand up to four blocks off this place, and none should end up on the well's rim.
  { name: 'town.square', x: WELL.x, y: TOWN_GROUND, z: WELL.z + 6, label: 'Square' },
  { name: 'gus.field', x: 193, y: TOWN_GROUND, z: -149, label: 'Gus\'s field' },
  { name: 'kennel', x: 193, y: TOWN_GROUND, z: -166, label: 'Kennel' },
  { name: 'river.bank', x: 173, y: TOWN_GROUND, z: -131, label: 'River bank' },
  { name: 'ferry', x: 196, y: TOWN_GROUND, z: -125, label: 'Ferry' },
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
  // Behind the town's north row.
  { x: 146, z: -188, kind: 'birch', size: 0.5 },
  { x: 174, z: -189, kind: 'oak', size: 0.4 },
  { x: 199, z: -186, kind: 'birch', size: 0.7 },
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
  ],
  // The river in front of the quay, so the bank has a straight edge and deep water at any seed.
  basins: [{ x0: 138, z0: -128, x1: 202, z1: -119, ground: 15 }],
  // It starts one block past the stone's place, so it reaches that place and stops short of the grant.
  paths: [{ points: [[STONE.x + 2, STONE.z], [92, -221], [126, -177], [137, -174]], half: 1.5 }],
  fills,
  buildings: BUILDINGS,
  townGround: TOWN_GROUND,
  trees: TREES,
  bushes: BUSHES,
  places: PLACES,
  props: [
    { kind: 'signpost', variant: 0, x: 133.5, y: TOWN_GROUND, z: -171.5, rotation: 0 },
    { kind: 'gate', variant: 1, x: 194.5, y: TOWN_GROUND, z: -165.5, rotation: Math.PI / 2 },
    { kind: 'bench', variant: 0, x: 165.5, y: TOWN_GROUND, z: -133.5, rotation: 0 },
    { kind: 'bench', variant: 0, x: 181.5, y: TOWN_GROUND, z: -133.5, rotation: 0 },
    { kind: 'stall', variant: 1, x: 176.5, y: TOWN_GROUND, z: -159.5, rotation: 0 },
    { kind: 'stall', variant: 0, x: 158.5, y: TOWN_GROUND, z: -150.5, rotation: Math.PI / 2 },
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
