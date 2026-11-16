// Saltgate, the port where the hero grew up, as data: the quarter grant day is played in. The guild hall (its
// bunk room, Hobb's kitchen, the map hall and the yard), Guild Street, the quay lane, the harbour quay and the
// ferry's pier. Act 1 starts here and leaves by the ferry; it is off the Greenhollow map.
//
// It is laid out from the approved sheets: `assets-src/concept/rooms/guildHall.webp` for the inside of the hall
// (bunk room north, kitchen west, map hall in the middle, the open yard south with the rack, the sparring ring
// and the grant table) and `assets-src/concept/region-saltgate/plan.webp` for the street, the lane, the quay and
// the ferry berth. The plan puts the yard beside the hall; the rooms sheet, which the plan defers to for the
// guild, puts it inside the walls to the south. This follows the rooms sheet.
//
// Every number is a block of the quarter's own grid: x east and z south from its north-west corner, which stands
// at `SALTGATE.x`, `SALTGATE.z` in the world. `src/game/opening/land.sim.ts` shapes the land and lays the blocks
// from it, and `src/game/views/story-grantday.view.ts` draws the models.

import type { NpcId } from './ids.ts';

/** Where the quarter is in the world, and the shape of its land. */
export const SALTGATE = {
  /** The world block of the quarter's north-west corner. Far south of Greenhollow, on low land by the sea. */
  x: 800,
  z: 1600,
  /** The street's feet height: the ground's top block is at y 21. */
  ground: 22,
  /** The harbour's floor. The sea fills it to y 17. */
  sea: 12,
  /** South of this the harbour is water, and east of `estuary` the river's mouth. */
  quayEdge: 64,
  estuary: 128,
  /** The land is the quarter's shape this far round it, then eases into the land round about over `blend`. */
  reach: 48,
  blend: 48,
} as const;

/** A block key of src/content/blocks.ts, or air. */
export type SaltBlock = 'air' | 'cobble' | 'stone_brick' | 'plaster' | 'oak_plank' | 'oak_log' | 'glass' | 'shingle' | 'barrier' | 'lantern_light' | 'path';

/** Fills every cell from (x0, y0, z0) up to but not including (x1, y1, z1), in the quarter's grid and world y. */
export type Box = readonly [x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, block: SaltBlock];

const G = SALTGATE.ground;
const FLOOR = G - 1;

/**
 * The blocks, laid in this order, a later box over an earlier one. The floors first, then the walls, then the
 * doorways cut back through them, then the invisible fences that keep the hero on the streets.
 */
export const BOXES: readonly Box[] = [
  // ------------------------------------------------------------------ the ground
  // The whole quarter's land is cobbled; the city round it stays grass.
  [-8, 2, 128, 64, FLOOR, G, 'cobble'],
  // The quay's edge and the hall's floors.
  [-8, 62, 128, 64, FLOOR, G, 'stone_brick'],
  [12, 4, 44, 18, FLOOR, G, 'oak_plank'],
  [12, 18, 44, 30, FLOOR, G, 'stone_brick'],
  // The sparring ring: a band of cobble in the yard's paving.
  [24, 21, 33, 22, FLOOR, G, 'cobble'], [24, 27, 33, 28, FLOOR, G, 'cobble'],
  [24, 21, 25, 28, FLOOR, G, 'cobble'], [32, 21, 33, 28, FLOOR, G, 'cobble'],
  // The ferry's pier: the kit's jetty is drawn over a floor nobody sees, its piles carried on under the water.
  [50, 64, 54, 76, FLOOR, G, 'barrier'],
  ...[64, 66, 68, 71, 73, 75].flatMap((z): Box[] => [[49, z, 50, z + 1, SALTGATE.sea, SALTGATE.sea + 6, 'oak_log'], [53, z, 54, z + 1, SALTGATE.sea, SALTGATE.sea + 6, 'oak_log']]),

  // ------------------------------------------------------------------ the guild hall
  // The camera looks down from the south-east, so a wall on a room's south or east side stands between it and
  // whoever is inside. Those walls are two blocks high, the north and west walls four, like a doll's house.
  // The north and west walls: a course of stone, plaster over it, a beam along the top.
  [12, 4, 44, 5, G, G + 4, 'plaster'], [12, 4, 13, 18, G, G + 4, 'plaster'],
  [12, 4, 44, 5, G, G + 1, 'stone_brick'], [12, 4, 13, 18, G, G + 1, 'stone_brick'],
  [12, 4, 44, 5, G + 3, G + 4, 'oak_log'], [12, 4, 13, 18, G + 3, G + 4, 'oak_log'],
  // The east wall and the house's south face onto the yard.
  [43, 4, 44, 18, G, G + 2, 'plaster'], [12, 17, 44, 18, G, G + 2, 'plaster'],
  [43, 4, 44, 18, G, G + 1, 'stone_brick'], [12, 17, 44, 18, G, G + 1, 'stone_brick'],
  // Inside: the kitchen's wall, the bunk room's south wall, and the wall between the bunk room and the map hall.
  [22, 4, 23, 18, G, G + 2, 'plaster'], [22, 11, 35, 12, G, G + 2, 'plaster'], [34, 4, 35, 12, G, G + 2, 'plaster'],
  // Oak posts at the corners and where the walls meet, a block over the walls.
  [12, 4, 13, 5, G, G + 4, 'oak_log'], [43, 4, 44, 5, G, G + 4, 'oak_log'], [12, 17, 13, 18, G, G + 4, 'oak_log'], [43, 17, 44, 18, G, G + 3, 'oak_log'],
  [22, 4, 23, 5, G, G + 4, 'oak_log'], [34, 4, 35, 5, G, G + 4, 'oak_log'], [22, 17, 23, 18, G, G + 3, 'oak_log'], [34, 17, 35, 18, G, G + 3, 'oak_log'],
  [12, 11, 13, 12, G, G + 4, 'oak_log'], [43, 11, 44, 12, G, G + 3, 'oak_log'], [22, 11, 23, 12, G, G + 3, 'oak_log'], [34, 11, 35, 12, G, G + 3, 'oak_log'],
  // Windows in the north and west walls, either side of the painted wall and over the kitchen.
  [15, 4, 17, 5, G + 1, G + 3, 'glass'], [18, 4, 20, 5, G + 1, G + 3, 'glass'], [37, 4, 38, 5, G + 1, G + 3, 'glass'],
  [12, 7, 13, 9, G + 1, G + 3, 'glass'], [12, 13, 13, 15, G + 1, G + 3, 'glass'],
  // Doorways, two blocks wide: kitchen to hall, bunk room to hall, kitchen to yard, and the hall's wide door.
  [22, 13, 23, 15, G, G + 3, 'air'], [27, 11, 29, 12, G, G + 3, 'air'], [19, 17, 21, 18, G, G + 3, 'air'], [29, 17, 32, 18, G, G + 3, 'air'],
  // The yard: a low wall round it, with the gate onto Guild Street.
  [12, 18, 13, 30, G, G + 2, 'stone_brick'], [43, 18, 44, 30, G, G + 2, 'stone_brick'], [12, 29, 44, 30, G, G + 2, 'stone_brick'],
  [26, 29, 30, 30, G, G + 2, 'air'],
  // The gate's posts and lintel: the guild's door, the one the film ends on.
  [25, 29, 26, 30, G, G + 4, 'oak_log'], [30, 29, 31, 30, G, G + 4, 'oak_log'], [25, 29, 31, 30, G + 3, G + 4, 'oak_log'],
  // Light inside: lantern light the hero walks through, so the rooms are warm.
  [17, 10, 18, 11, G + 2, G + 3, 'lantern_light'], [28, 8, 29, 9, G + 2, G + 3, 'lantern_light'], [38, 10, 39, 11, G + 2, G + 3, 'lantern_light'],
  [28, 15, 29, 16, G + 2, G + 3, 'lantern_light'],

  // ------------------------------------------------------------------ the fences nobody sees
  // The street's north side beside the hall, its south side but for the lane, the quay's back but for the lane.
  [-8, 29, 12, 30, G, G + 3, 'barrier'], [44, 29, 128, 30, G, G + 3, 'barrier'],
  [-8, 40, 48, 41, G, G + 3, 'barrier'], [54, 40, 128, 41, G, G + 3, 'barrier'],
  [-8, 55, 48, 56, G, G + 3, 'barrier'], [54, 55, 128, 56, G, G + 3, 'barrier'],
  [47, 40, 48, 56, G, G + 3, 'barrier'], [54, 40, 55, 56, G, G + 3, 'barrier'],
  // The two ends of the street and of the quay.
  [-8, 29, -7, 64, G, G + 3, 'barrier'], [127, 29, 128, 64, G, G + 3, 'barrier'],
  // The quay's edge but for the pier, and round the pier.
  [-8, 63, 50, 64, G, G + 2, 'barrier'], [54, 63, 128, 64, G, G + 2, 'barrier'],
  [49, 64, 50, 77, G, G + 2, 'barrier'], [54, 64, 55, 77, G, G + 2, 'barrier'], [49, 76, 55, 77, G, G + 2, 'barrier'],
];

/** A model of src/content/props.ts set down in the quarter. `solid` fences its footprint with barrier blocks. */
export interface SaltProp {
  model: string;
  variant?: number;
  /** The middle of its base, in the quarter's grid. */
  x: number;
  z: number;
  /** Feet height; the street's when left out. */
  y?: number;
  /** Radians, turning as the game's facing does. 0 leaves the model as it was built: its front to the south. */
  turn?: number;
  scale?: number;
  /** Fence the cells under it: [width east, depth south] before the turn, in blocks, two blocks tall. */
  solid?: readonly [number, number];
}

const S = Math.PI;
const E = Math.PI / 2, W = -Math.PI / 2;

/** The city round the quarter: houses along the street's north side, homes and warehouses between street and quay. */
const HOUSES: readonly SaltProp[] = [
  // North of Guild Street, west of the hall.
  { model: 'cityMerchantRowHouse', x: 3, z: 24, solid: [7, 10] },
  { model: 'cityTallHouse', x: -6, z: 25, solid: [8, 8] },
  // North of Guild Street, east of the hall.
  { model: 'cityCornerShop', x: 50, z: 24, solid: [10, 10] },
  { model: 'cityMerchantRowHouse', x: 59, z: 24, solid: [7, 10] },
  { model: 'cityFamilyHouse', x: 68, z: 25, solid: [9, 8] },
  { model: 'cityTallHouse', x: 78, z: 25, solid: [8, 8] },
  { model: 'cityGuildLodge', x: 91, z: 24, solid: [12, 10] },
  { model: 'cityMerchantRowHouse', x: 102, z: 24, solid: [7, 10] },
  { model: 'cityLongHouse', x: 112, z: 25, solid: [10, 8] },
  { model: 'cityCottage', x: 121, z: 26, solid: [8, 6] },
  // Between Guild Street and the quay, west of the lane: fisher homes and merchants, their fronts to the street.
  { model: 'cityCottage', x: 2, z: 45, turn: S, solid: [8, 6] },
  { model: 'cityFamilyHouse', x: 12, z: 46, turn: S, solid: [9, 8] },
  { model: 'cityMerchantRowHouse', x: 22, z: 46, turn: S, solid: [7, 10] },
  { model: 'cityCornerShop', x: 32, z: 47, turn: S, solid: [10, 10] },
  { model: 'cityMerchantRowHouse', x: 42, z: 46, turn: S, solid: [7, 10] },
  // East of the lane: the warehouses, their doors to the quay.
  { model: 'cityWarehouse', x: 62, z: 48, solid: [12, 16] },
  { model: 'cityWarehouse', x: 76, z: 48, solid: [12, 16] },
  { model: 'cityLongHouse', x: 90, z: 47, solid: [10, 8] },
  { model: 'cityWarehouse', x: 104, z: 48, solid: [12, 16] },
  { model: 'cityTallHouse', x: 118, z: 46, solid: [8, 8] },
  // The city goes on uphill to the north: roofs over roofs, nobody's way.
  { model: 'cityTallHouse', x: 6, z: 10 }, { model: 'cityFamilyHouse', x: -6, z: 12 }, { model: 'cityMerchantRowHouse', x: 0, z: -4 },
  { model: 'cityLongHouse', x: 52, z: 10 }, { model: 'cityTallHouse', x: 64, z: 9 }, { model: 'cityWarehouse', x: 80, z: 8 },
  { model: 'cityFamilyHouse', x: 95, z: 10 }, { model: 'cityCornerShop', x: 108, z: 9 }, { model: 'cityTallHouse', x: 120, z: 10 },
  { model: 'cityMerchantRowHouse', x: 20, z: -6 }, { model: 'cityTallHouse', x: 34, z: -7 }, { model: 'cityLongHouse', x: 48, z: -6 },
  { model: 'cityCottage', x: 62, z: -6 }, { model: 'cityFamilyHouse', x: 76, z: -8 }, { model: 'cityMerchantRowHouse', x: 92, z: -6 },
];

/** What dresses the hall, the yard, the street and the quay. */
const DRESSING: readonly SaltProp[] = [
  // The bunk room: five bunks under the painted wall, the hero's in the middle, and the mirror on the east wall.
  { model: 'homeBed', x: 24.5, z: 6, solid: [1, 2] }, { model: 'homeBed', x: 26.5, z: 6, solid: [1, 2] },
  { model: 'bed', variant: 0, x: 28.5, z: 6, solid: [1, 2] },
  { model: 'homeBed', x: 30.5, z: 6, solid: [1, 2] }, { model: 'homeBed', x: 32.5, z: 6, solid: [1, 2] },
  { model: 'chest', x: 24.5, z: 9.6, turn: S },
  // Hobb's kitchen.
  { model: 'homeOven', x: 14.2, z: 6.2, turn: S / 4, solid: [2, 2] },
  { model: 'stove', x: 18, z: 5.6, solid: [1, 1] },
  { model: 'homeTable', x: 17, z: 10, solid: [3, 1] },
  { model: 'homeBench', x: 17, z: 11.2 }, { model: 'homeBench', x: 17, z: 8.8 },
  { model: 'sack', variant: 1, x: 13.8, z: 15.4 }, { model: 'barrel', x: 20.8, z: 5.6 }, { model: 'barrel', variant: 1, x: 20.8, z: 6.6 },
  { model: 'crate', variant: 1, x: 13.8, z: 13.2 },
  // The map hall: Dax's table of locks and the sea chest; Mina's wall of maps is drawn by the view.
  { model: 'workbench', x: 39, z: 12.5, solid: [2, 1] },
  { model: 'chest', variant: 1, x: 36.6, z: 12.7 },
  { model: 'hallLamp', variant: 1, x: 34.6, z: 12.6 }, { model: 'hallLamp', variant: 1, x: 42.4, z: 12.6 },
  { model: 'banner', variant: 0, x: 25.6, z: 16.6 }, { model: 'banner', variant: 0, x: 40.6, z: 5.4 },
  { model: 'crate', x: 24, z: 13 }, { model: 'sack', x: 24.2, z: 15.8 },
  // The yard: the grant table, planters along the wall, banners at the gate.
  { model: 'homeTable', x: 39.5, z: 22, turn: E, solid: [3, 1] },
  { model: 'lantern', variant: 2, x: 39.5, z: 20.4 },
  { model: 'planter', x: 14, z: 28.4 }, { model: 'planter', x: 20, z: 28.4 }, { model: 'planter', x: 36, z: 28.4 }, { model: 'planter', x: 41, z: 28.4 },
  { model: 'cityBanner', x: 24.2, z: 30.6 }, { model: 'cityBanner', x: 31.8, z: 30.6 },
  { model: 'barrel', x: 13.6, z: 19.4 }, { model: 'crate', variant: 1, x: 42, z: 19.2 },
  // Guild Street on grant day: lamps, flags over the street, barrels, a bench.
  { model: 'cityLamp', x: 20, z: 31 }, { model: 'cityLamp', x: 46, z: 31 }, { model: 'cityLamp', x: 70, z: 31 }, { model: 'cityLamp', x: 96, z: 31 },
  { model: 'cityLamp', x: 8, z: 39 }, { model: 'cityLamp', x: 40, z: 39 }, { model: 'cityLamp', x: 64, z: 39 }, { model: 'cityLamp', x: 110, z: 39 },
  { model: 'bunting', x: 10, z: 35, turn: E }, { model: 'bunting', x: 38, z: 35, turn: E }, { model: 'bunting', x: 60, z: 35, turn: E },
  { model: 'bunting', x: 84, z: 35, turn: E }, { model: 'bunting', x: 108, z: 35, turn: E },
  { model: 'cityStringLights', x: 51, z: 44, turn: E }, { model: 'cityStringLights', x: 51, z: 51, turn: E },
  { model: 'cityBarrel', x: 44.5, z: 31.2 }, { model: 'cityBarrel', x: 45.4, z: 31.6 }, { model: 'cityCrate', x: 9, z: 31 },
  { model: 'cityPlanter', x: 58, z: 31 }, { model: 'cityPlanter', x: 86, z: 31 }, { model: 'cityBench', x: 76, z: 31 },
  // The quay: bollards, nets, a crane, cargo, boats.
  { model: 'cityBollard', x: 46, z: 62.5 }, { model: 'cityBollard', x: 56, z: 62.5 }, { model: 'cityBollard', x: 30, z: 62.5 },
  { model: 'cityBollard', x: 70, z: 62.5 }, { model: 'cityBollard', x: 90, z: 62.5 }, { model: 'cityBollard', x: 14, z: 62.5 },
  { model: 'cityNetRack', x: 22, z: 57.5 }, { model: 'cityNetRack', x: 36, z: 57.5 },
  { model: 'cityCrane', x: 82, z: 59, solid: [3, 3] },
  { model: 'cityCrate', x: 60, z: 58 }, { model: 'cityCrate', x: 61, z: 58.2 }, { model: 'cityCrate', x: 60.5, z: 59.1 },
  { model: 'cityBarrel', x: 66, z: 58 }, { model: 'cityBarrel', x: 67, z: 58.3 }, { model: 'sack', variant: 1, x: 44, z: 58 },
  { model: 'cityLamp', x: 47, z: 62 }, { model: 'cityLamp', x: 55.4, z: 62 },
  // The ferry, alongside the pier, and boats about the harbour.
  { model: 'cityCargoBoat', x: 57, z: 71, y: SALTGATE.ground - 4.6 },
  { model: 'citySkiff', x: 30, z: 68, y: SALTGATE.ground - 4.4, turn: E },
  { model: 'citySkiff', x: 36, z: 70, y: SALTGATE.ground - 4.4, turn: 1.2 },
  { model: 'cityCargoBoat', x: 92, z: 74, y: SALTGATE.ground - 4.6, turn: 0.2 },
  // The pier: the kit's jetty, its deck level with the quay.
  { model: 'cityJetty', x: 52, z: 70, y: SALTGATE.ground - 1.93 },
];

export const PROPS: readonly SaltProp[] = [...HOUSES, ...DRESSING];

/** Named spots, feet height on the floor: where people stand and what the hero walks up to. */
export const SPOTS = {
  /** The hero's bunk, under the painted wall, where the game begins. */
  bunk: { x: 28.5, z: 8.4, facing: S },
  /** The painted wall over the bunk: the middle of its face. */
  mural: { x: 28.5, z: 5 },
  /** The mirror on the bunk room's east wall, and where to stand at it. */
  mirror: { x: 33.4, z: 8 },
  /** Hobb's porridge on the kitchen table. */
  porridge: { x: 17.6, z: 10.4 },
  /** The lock Dax found, on his table, and the map wall's middle. */
  locks: { x: 39, z: 13.1 },
  maps: { x: 39, z: 5.6 },
  /** The rack in the yard, the middle of the sparring ring, the grant table. */
  rack: { x: 14.6, z: 23 },
  ring: { x: 28.5, z: 24.5 },
  deed: { x: 38.2, z: 22 },
  /** The guild's gate onto Guild Street, the top of the quay lane, the ferry's berth. */
  gate: { x: 28, z: 31 },
  lane: { x: 51, z: 42 },
  berth: { x: 52, z: 66 },
} as const;

export type SpotId = keyof typeof SPOTS;

/** The guild's people on grant day, by where they stand at each part of it. */
export interface SaltPerson {
  id: string;
  /** A sprite of public/assets/manifest.json. */
  sprite: string;
  /** Who the dialogue box names, for the talk system's `npc`. */
  npc: NpcId;
  name: string;
}

export const PEOPLE = {
  hobb: { id: 'saltgate:hobb', sprite: 'hobb', npc: 'hobb', name: 'Hobb' },
  dax: { id: 'saltgate:dax', sprite: 'dax', npc: 'dax', name: 'Dax' },
  mina: { id: 'saltgate:mina', sprite: 'mina', npc: 'mina', name: 'Mina' },
  // Stand-in: the Guildmaster has no sprite or portrait yet, so the town's grey-haired Hesper stands in.
  guildmaster: { id: 'saltgate:guildmaster', sprite: 'town-hesper', npc: 'guildmaster', name: 'The Guildmaster' },
} as const satisfies Record<string, SaltPerson>;

/** The other wards waiting for their deeds in the yard, and the townsfolk about the street and the quay. */
// Wards queue west of the speaking cast and the hero's mark, leaving their silhouettes clear.
export const CROWD: readonly { sprite: string; x: number; z: number; facing: number; when: 'grant' | 'always' }[] = [
  { sprite: 'town-pell', x: 30, z: 22, facing: E, when: 'grant' },
  { sprite: 'town-nessa', x: 32, z: 23, facing: E, when: 'grant' },
  { sprite: 'town-pip', x: 34, z: 24, facing: E, when: 'grant' },
  { sprite: 'villager-a', x: 30, z: 25, facing: E, when: 'grant' },
  { sprite: 'town-roan', x: 32, z: 26, facing: E, when: 'grant' },
  { sprite: 'villager-b', x: 34, z: 27, facing: E, when: 'grant' },
  { sprite: 'town-corin', x: 64, z: 36, facing: W, when: 'always' },
  { sprite: 'town-isolde', x: 16, z: 35, facing: E, when: 'always' },
  { sprite: 'town-dunn', x: 75, z: 59, facing: S, when: 'always' },
  { sprite: 'villager-a', x: 40, z: 60, facing: E, when: 'always' },
  { sprite: 'town-acolyte-a', x: 88, z: 37, facing: W, when: 'always' },
];
