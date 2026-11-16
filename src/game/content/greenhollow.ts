// The plan of all of Greenhollow for act 1, as data: the kinds of land, the river Mere, the High Road, the
// paths, every place, where the twelve fights are and which landmark models stand where. It is the map of
// handbook chapter 26 (`game-look-test/design/26-map-of-greenhollow.md`), and docs/greenhollow-world.md says
// who builds what from it.
//
// Everything here is in the map's own units: 800 wide and 600 deep, x east and y south, one unit a block, the
// same numbers as the playthrough site's map (`game-look-test/playthrough/content.js`, `places`). `toWorld`
// turns a map point into the game's columns. The three places already built (your plot, the dead garden and
// Hollowmere) keep their game coordinates through `at`, and the map is read around them.
//
// Plain numbers and names only: the terrain reads this in its worker. Lookups are in
// src/game/region/greenhollow.sim.ts.

import type { MapPlaceId } from './ids.ts';
import { FOREST_SITES, FOREST_SIZES } from './wilds-forest.ts';
import { SOUTHEAST_SITES, SOUTHEAST_SIZES } from './wilds-southeast.ts';

/** A point on the map: [x east, y south]. */
export type MapPoint = readonly [number, number];

/** Your plot's middle on the map, and in the game (GRANT in region.ts, its middle). */
const PLOT_MAP: MapPoint = [404, 304];
const PLOT_WORLD = { x: -16, z: -234 } as const;

/** The map's edges in the game's columns. */
export const MAP_SIZE = { w: 800, h: 600 } as const;

/** The game column of a map point. */
export function toWorld(p: MapPoint): { x: number; z: number } {
  return { x: Math.round(p[0] - PLOT_MAP[0] + PLOT_WORLD.x), z: Math.round(p[1] - PLOT_MAP[1] + PLOT_WORLD.z) };
}

/** The map point of a game column. */
export function toMap(x: number, z: number): MapPoint {
  return [x - PLOT_WORLD.x + PLOT_MAP[0], z - PLOT_WORLD.z + PLOT_MAP[1]];
}

// ------------------------------------------------------------------------------------------ the land

/**
 * The kinds of land. Each has its own ground, grass, trees, small things and air (docs/greenhollow-world.md,
 * "The kinds of land"). `meadow` is everywhere no other shape covers.
 */
export const BIOMES = ['meadow', 'oldForest', 'greyForest', 'marsh', 'caveHills', 'terraces', 'town'] as const;
export type Biome = (typeof BIOMES)[number];

export interface BiomeArea {
  biome: Biome;
  /** The outline, in map units. Its edge is roughened by noise, so no edge is a straight line. */
  outline: readonly MapPoint[];
}

/** Later areas win where they overlap. */
export const AREAS: readonly BiomeArea[] = [
  // West, past the dead garden, to the edge of the map. Old oaks, deep shade, rootsnares, the Seed Vault.
  { biome: 'oldForest', outline: [[0, 236], [110, 224], [236, 226], [285, 262], [292, 320], [268, 372], [292, 440], [276, 520], [300, 600], [0, 600]] },
  // A band north of the High Road, widest in the east where the road glows. The same oaks with the colour gone.
  { biome: 'greyForest', outline: [[0, 118], [180, 104], [330, 98], [470, 84], [620, 70], [800, 52], [800, 198], [700, 202], [600, 212], [500, 218], [440, 230], [380, 222], [300, 214], [150, 206], [0, 210]] },
  // North-east, under the hill beyond the river: rock, crystal and the root caves. The Lamp Gallery is inside.
  { biome: 'caveHills', outline: [[618, 120], [700, 96], [790, 124], [800, 262], [722, 286], [648, 266], [626, 214]] },
  // Far north, inside the grey forest: giant steps wrapped in roots. The Old Gate is on their south face.
  // Its outline is the lowest ring of TERRACES grown by a few blocks.
  { biome: 'terraces', outline: [[366, 110], [380, 62], [430, 36], [500, 30], [560, 40], [594, 76], [598, 118], [570, 148], [520, 162], [470, 164], [418, 156], [380, 136]] },
  // South-east, below the town: ponds, reeds and lanternflies. The Pump House stands in the river at its top.
  { biome: 'marsh', outline: [[640, 428], [720, 416], [800, 432], [800, 600], [668, 600], [628, 530], [612, 470]] },
  // Hollowmere's own ground, the city and its edge fields. Its exact edge is REGION.town in region.ts.
  { biome: 'town', outline: [[534, 290], [712, 290], [712, 418], [534, 418]] },
];

/** The river Mere: from the hills in the north, past the landing, round the town and out to the sea in the south-east. */
export const RIVER = {
  points: [[690, 0], [662, 88], [628, 168], [604, 236], [570, 294], [542, 322], [524, 346], [514, 384], [530, 414], [578, 428], [640, 436], [700, 448], [742, 472], [770, 532], [792, 600]] as readonly MapPoint[],
  /** Half its width at each point, in blocks. It widens toward the marsh. */
  half: [5, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 12, 13, 14, 16] as readonly number[],
  /**
   * The falls: above this point of `points` the Mere runs high in a gorge through the north ridge, its water at
   * `high`; at the point it drops over a cliff to the valley.
   */
  falls: 1,
  high: 34,
};

/**
 * Ridges the eye follows: a crest along `points`, `height` blocks high at its top, falling away over `half`
 * blocks either side.
 */
export const RIDGES: readonly { points: readonly MapPoint[]; height: number; half: number }[] = [
  // Behind the cave hills, where the Mere comes down from the north: the falls cut through it.
  { points: [[606, 40], [650, 76], [700, 66], [760, 40], [800, 34]], height: 47, half: 46 },
  // Along the north-west edge, behind the grey forest.
  { points: [[0, 30], [120, 44], [230, 34], [330, 20]], height: 42, half: 40 },
];

/**
 * The High Road: a stone causeway on arches, running west to east 80 blocks north of your plot. Its deck is
 * `deck` blocks over the water line, and an arch stands every `span` blocks along it.
 */
export const HIGH_ROAD = {
  points: [[0, 210], [150, 208], [300, 216], [404, 224], [500, 220], [600, 212], [700, 202], [800, 196]] as readonly MapPoint[],
  half: 3,
  deck: 12,
  span: 12,
  /** From this map x eastward the channel glows gold from the start: east of the chapel road. */
  litFrom: 590,
  /** The stretch the Order lights at the end of chapter 2, right above your land: map x from and to. */
  relit: [470, 560] as const,
  /** Stairs up to the deck from its south side, at these map x: where the north path and the chapel path meet it. */
  stairs: [440, 590] as readonly number[],
  /** The spans whose pier has fallen, by their number from the west end. Their deck cannot be walked. */
  broken: [3, 9, 19] as readonly number[],
  /** A tall pylon stands beside the road, `pylonSide` blocks north of its middle, at each of these map x. */
  pylons: [56, 156, 256, 356, 456, 556, 676, 756] as readonly number[],
  pylonSide: 9,
};

/**
 * The terraces: four giant steps, each `rise` blocks high, in rings round `center`. A ring is an ellipse with radii
 * `rx` and `ry` times its share in `rings`; the lowest is the outermost. `base` is the ground at their foot. A
 * stair runs up their south face at map x `stair`, `half` blocks either side of it.
 */
export const TERRACES = {
  center: [480, 96] as MapPoint,
  rx: 112,
  ry: 60,
  rings: [1, 0.76, 0.53, 0.3] as readonly number[],
  rise: 6,
  base: 24,
  stair: { x: 488, half: 4 },
};

/** The hill on your plot's north side, behind the north wall of the Hall's court (region.ts): its top, how wide and how high. */
export const HALL_HILL = { at: [403, 252] as MapPoint, radius: 20, height: 12 };

export interface MapPath {
  id: string;
  points: readonly MapPoint[];
  /** Half its width in blocks. */
  half: number;
  /** Over water it is a boardwalk of `boardwalk` models on posts, not planks alone. */
  boards?: boolean;
}

/** Dirt paths that follow the land. The road to town already exists in region.ts and is kept as it is. */
export const PATHS: readonly MapPath[] = [
  { id: 'north', points: [[419, 289], [420, 266], [424, 246], [430, 230], [438, 214], [452, 184], [470, 168]], half: 1.5 },
  // Up the terraces' stair from the foot to the top, past the terrace shrine's ring.
  { id: 'terraces', points: [[470, 168], [488, 162], [488, 120], [478, 112]], half: 1.5 },
  { id: 'west', points: [[387, 302], [356, 314], [330, 318], [318, 296], [300, 262], [262, 262], [200, 286], [162, 300]], half: 1.5 },
  // The north road, out of Hollowmere's chapel quarter. And from the city's north-east corner to the watch post.
  { id: 'chapel', points: [[590, 291], [592, 232]], half: 2 },
  { id: 'watch', points: [[708, 291], [690, 264], [712, 244]], half: 1.5 },
  { id: 'caves', points: [[592, 232], [630, 236], [656, 200], [668, 172], [668, 160]], half: 1.5 },
  // From the east end of Hollowmere's quay along the bank to the Pump House.
  { id: 'quay', points: [[692, 407], [690, 422], [710, 424]], half: 1.5 },
  // Boards over the marsh from the Pump House to the marsh shrine's island.
  { id: 'marsh', points: [[710, 424], [712, 470], [736, 500], [748, 518]], half: 1, boards: true },
  { id: 'hut', points: [[724, 490], [708, 506], [704, 518]], half: 1, boards: true },
  // Out across the reeds to the second hut.
  { id: 'hut-2', points: [[736, 500], [748, 486], [756, 474]], half: 1, boards: true },
  { id: 'forest', points: [[300, 330], [262, 382], [238, 410]], half: 1 },
  // The Old Forest's loop (region-forests plan, dotted): from the Seed Vault's door south through the cathedral grove
  // to the forest shrine, where the forest path goes on to 300,330.
  { id: 'loop', points: [[160, 300], [158, 314], [140, 336], [124, 358], [104, 378], [96, 392], [112, 410], [150, 424], [196, 430], [228, 420]], half: 1 },
  // From the west path over the knoll to the shrine at the forest's edge.
  { id: 'knoll', points: [[318, 296], [312, 262], [306, 246]], half: 1 },
  { id: 'south', points: [[404, 321], [420, 380], [430, 440], [404, 520], [380, 600]], half: 1.5 },
];

// ------------------------------------------------------------------------------------------ places

export type PlaceKind = 'landmark' | 'vault' | 'place' | 'fight' | 'shrine' | 'ruin';

export interface MapPlace {
  /** One of MAP_PLACE_IDS in ids.ts. Sub-spots inside a place are `<id>.<spot>` (`PlaceRef`). */
  id: MapPlaceId;
  name: string;
  kind: PlaceKind;
  at: MapPoint;
  /** Already built in the game: its column there. The map point is only where the map draws it. */
  world?: { x: number; z: number };
}

/** Every place of act 1. The ids are the playthrough site's. */
export const PLACES: readonly MapPlace[] = [
  { id: 'plot', name: 'Your plot', kind: 'landmark', at: [404, 304], world: { x: -16, z: -234 } },
  { id: 'hall', name: 'Ilara\'s Hall', kind: 'landmark', at: [403, 287], world: { x: -17, z: -251 } },
  { id: 'garden', name: 'The dead garden', kind: 'place', at: [318, 296], world: { x: -79, z: -232 } },
  { id: 'town', name: 'Hollowmere', kind: 'landmark', at: [590, 366], world: { x: 168, z: -155 } },
  { id: 'chapel', name: 'The chapel', kind: 'place', at: [600, 304] },
  { id: 'landing', name: 'The landing', kind: 'place', at: [511, 356] },
  { id: 'bridge', name: 'The bridge', kind: 'place', at: [529, 339] },
  { id: 'arches', name: 'The lit arches', kind: 'place', at: [500, 220] },
  { id: 'highroad', name: 'The High Road', kind: 'landmark', at: [150, 208] },
  { id: 'foxes', name: 'Three foxes', kind: 'fight', at: [424, 210] },
  { id: 'boar', name: 'The boar', kind: 'fight', at: [438, 204] },
  { id: 'terraces', name: 'The terraces', kind: 'landmark', at: [470, 112] },
  { id: 'dawn', name: 'The Dawn', kind: 'landmark', at: [470, -420] },
  { id: 'caves', name: 'The root caves', kind: 'place', at: [640, 236] },
  { id: 'lampgallery', name: 'The Lamp Gallery', kind: 'vault', at: [668, 154] },
  { id: 'pumphouse', name: 'The Pump House', kind: 'vault', at: [722, 438] },
  { id: 'seedvault', name: 'The Seed Vault', kind: 'vault', at: [150, 300] },
  { id: 'shrine-oak', name: 'The oak shrine', kind: 'shrine', at: [462, 280] },
  { id: 'shrine-bend', name: 'The bend shrine', kind: 'shrine', at: [500, 396] },
  { id: 'shrine-knoll', name: 'The knoll shrine', kind: 'shrine', at: [306, 242] },
  { id: 'shrine-forest', name: 'The forest shrine', kind: 'shrine', at: [234, 414] },
  { id: 'shrine-marsh', name: 'The marsh shrine', kind: 'shrine', at: [750, 522] },
  { id: 'shrine-terrace', name: 'The terrace shrine', kind: 'shrine', at: [566, 122] },
  { id: 'ruin-tower', name: 'The sunk tower', kind: 'ruin', at: [300, 360] },
  { id: 'ruin-stair', name: 'The forest stair', kind: 'ruin', at: [252, 256] },
  { id: 'ruin-mill', name: 'The mill', kind: 'ruin', at: [652, 284] },
  { id: 'ruin-wall', name: 'The south wall', kind: 'ruin', at: [446, 436] },
  { id: 'ruin-post', name: 'The watch post', kind: 'ruin', at: [718, 234] },
];

/** Where each of the twelve fights of handbook chapter 23 happens: a place id, or a map point. */
export const FIGHTS: readonly { n: number; name: string; at: string | MapPoint }[] = [
  { n: 1, name: 'The Blighted fox', at: 'hall' },
  { n: 2, name: 'A thistlehog', at: [380, 316] },
  { n: 3, name: 'Three foxes', at: [424, 210] },
  { n: 4, name: 'The boar, too strong', at: 'boar' },
  { n: 5, name: 'A lynx', at: 'arches' },
  { n: 6, name: 'A gearling', at: 'ruin-mill' },
  { n: 7, name: 'The Sluice Keeper', at: 'pumphouse' },
  { n: 8, name: 'A rootsnare', at: 'caves' },
  { n: 9, name: 'The Lamplighter', at: 'lampgallery' },
  { n: 10, name: 'The Wild Harvester', at: 'seedvault' },
  { n: 11, name: 'The boar again', at: 'boar' },
  { n: 12, name: 'The Verdant Stag', at: 'terraces' },
];

// ------------------------------------------------------------------------------------------ Hollowmere's fields

/**
 * The edge fields east of Hollowmere (src/game/content/town/city.ts), corner to corner, and where the Order's brass
 * pump stands in each. The pumps come out one by one as the queen's ledger fills (src/game/region/story.sim.ts).
 */
export const CITY_FIELDS: readonly { from: MapPoint; to: MapPoint; pump: MapPoint }[] = [
  { from: [714, 300], to: [738, 326], pump: [726, 313] },
  { from: [742, 300], to: [766, 326], pump: [754, 313] },
  { from: [714, 332], to: [738, 358], pump: [726, 345] },
  { from: [742, 332], to: [766, 358], pump: [754, 345] },
  { from: [714, 364], to: [738, 390], pump: [726, 377] },
  { from: [742, 364], to: [766, 390], pump: [754, 377] },
];

// ------------------------------------------------------------------------------------------ landmarks

/**
 * The kinds of land dressed from their approved kits (`assets-src/concept/region-*`) with the props that exist:
 * small things that neither level the ground nor stand in the way (`dress` in LANDMARK_SIZES). What each kit still
 * needs a model for is listed in docs/greenhollow-world.md, "Dressing the regions".
 */
const DRESSING: readonly { id: string; model: string; place: string; at: MapPoint; turn: number; variant?: string; wet?: boolean }[] = [
  // The marsh (region-southeast M09 to M12): a second hut on stilts out on the reeds, a fisher's camp by the first,
  // lantern posts along the boardwalk and the end of a rotting pier.
  { id: 'stilt-hut-2', model: 'stiltHut', place: 'shrine-marsh', at: [760, 470], turn: 3 },
  { id: 'marsh-nets', model: 'cityNetRack', place: 'shrine-marsh', at: [712, 534], turn: 0 },
  { id: 'marsh-skiff', model: 'citySkiff', place: 'shrine-marsh', at: [694, 534], turn: 1, wet: true },
  { id: 'marsh-barrel-1', model: 'cityBarrel', place: 'shrine-marsh', at: [710, 519], turn: 0 },
  { id: 'marsh-barrel-2', model: 'cityBarrel', place: 'shrine-marsh', at: [711, 520.5], turn: 1 },
  { id: 'marsh-lamp-1', model: 'cityLamp', place: 'pumphouse', at: [714, 450], turn: 1 },
  { id: 'marsh-lamp-2', model: 'cityLamp', place: 'shrine-marsh', at: [731, 496], turn: 1 },
  { id: 'marsh-lamp-3', model: 'cityLamp', place: 'shrine-marsh', at: [745, 514], turn: 1 },
  { id: 'marsh-pier-1', model: 'cityDock', place: 'shrine-marsh', at: [770, 540], turn: 0, variant: 'run', wet: true },
  { id: 'marsh-pier-2', model: 'cityDock', place: 'shrine-marsh', at: [770, 543], turn: 0, variant: 'end', wet: true },
  // The cave hills (region-southeast C06, C10): pale crystals in the clefts on the way up, and a delver's camp below the mouth.
  { id: 'crystals-4', model: 'crystals', place: 'caves', at: [634, 224], turn: 3, variant: 'small' },
  { id: 'crystals-5', model: 'crystals', place: 'caves', at: [654, 254], turn: 0, variant: 'large' },
  { id: 'crystals-6', model: 'crystals', place: 'caves', at: [674, 192], turn: 1, variant: 'small' },
  { id: 'crystals-7', model: 'crystals', place: 'lampgallery', at: [678, 148], turn: 2, variant: 'small' },
  { id: 'crystals-8', model: 'crystals', place: 'lampgallery', at: [658, 160], turn: 0, variant: 'large' },
  { id: 'delver-tent', model: 'tent', place: 'caves', at: [620, 258], turn: 1 },
  { id: 'delver-fire', model: 'campfire', place: 'caves', at: [625, 254], turn: 0, variant: 'cold' },
  { id: 'delver-crates', model: 'cityCrate', place: 'caves', at: [618, 252], turn: 0 },
  { id: 'delver-barrel', model: 'cityBarrel', place: 'caves', at: [617, 254], turn: 0 },
  { id: 'delver-cart', model: 'cityCart', place: 'caves', at: [629, 260], turn: 1 },
  // The Old Forest (region-forests 07, 12, 19): old gate posts round the forest stair and the vault's approach,
  // fallen limbs and stumps.
  { id: 'forest-post-1', model: 'ruinPillar', place: 'ruin-stair', at: [244, 249], turn: 0, variant: 'leaning' },
  { id: 'forest-post-2', model: 'ruinPillar', place: 'ruin-stair', at: [261, 248], turn: 1, variant: 'waist high' },
  { id: 'forest-post-3', model: 'ruinPillar', place: 'ruin-stair', at: [262, 265], turn: 2, variant: 'stump' },
  { id: 'vault-post-1', model: 'ruinPillar', place: 'seedvault', at: [164, 294], turn: 1, variant: 'waist high' },
  { id: 'vault-post-2', model: 'ruinPillar', place: 'seedvault', at: [164, 306], turn: 3, variant: 'leaning' },
  { id: 'forest-log-1', model: 'log', place: 'seedvault', at: [178, 288], turn: 1 },
  { id: 'forest-log-2', model: 'log', place: 'ruin-tower', at: [288, 372], turn: 0 },
  { id: 'forest-stump-1', model: 'mossStump', place: 'seedvault', at: [140, 314], turn: 0 },
  { id: 'forest-stump-2', model: 'stump', place: 'shrine-forest', at: [226, 404], turn: 2 },
  // Wren's camp (region-forests 28), on the green side of the High Road, looking north to the boar's clearing.
  { id: 'wren-tent', model: 'tent', place: 'boar', at: [458, 242], turn: 2 },
  { id: 'wren-fire', model: 'campfire', place: 'boar', at: [455, 238], turn: 0, variant: 'low' },
  { id: 'wren-bedroll', model: 'homeBedroll', place: 'boar', at: [462, 238], turn: 1, variant: 'rolled' },
  // Home (region-home 09, 15): an old fence along the field's west side, and a signpost where the roads part.
  { id: 'home-fence-1', model: 'pastureFence', place: 'plot', at: [383, 296], turn: 1 },
  { id: 'home-fence-2', model: 'pastureFence', place: 'plot', at: [383, 299], turn: 1 },
  { id: 'home-fence-3', model: 'pastureFence', place: 'plot', at: [383, 305], turn: 1 },
  { id: 'home-sign', model: 'signpost', place: 'plot', at: [421, 322], turn: 3, variant: 'three ways' },
  // The terraces (region-north, terrace kit 01 to 03 stand-ins): broken pillars on the steps.
  { id: 'terrace-pillar-1', model: 'ruinPillar', place: 'terraces', at: [452, 140], turn: 0, variant: 'leaning' },
  { id: 'terrace-pillar-2', model: 'ruinPillar', place: 'terraces', at: [512, 128], turn: 1, variant: 'waist high' },
];

/**
 * The landmark models: which stands where. `model` is a key of PROPS in src/content/props.ts, made by the
 * helpers docs/greenhollow-world.md names. `turn` is in quarter turns, counter-clockwise from facing south, so 1
 * faces east and 3 west. `at` is where it stands when that is not its place's own point. `variant` names one of
 * the model's variants; without it the first. `wet` lies in the water, so the river is not filled under it. The land lays the High Road's arches, pylons, stairs and the
 * terraces' faces and stairs itself, from HIGH_ROAD and TERRACES, and the boardwalks along the `boards` paths.
 */
export const LANDMARKS: readonly { id: string; model: string; place: string; at?: MapPoint; turn: number; variant?: string; wet?: boolean }[] = [
  // The wild lands' own lists: the forests, and the marsh, river works and caves.
  ...FOREST_SITES,
  ...SOUTHEAST_SITES,
  { id: 'old-gate', model: 'oldGate', place: 'terraces', at: [470, 158.5], turn: 0 },
  { id: 'pump-house', model: 'pumpHouse', place: 'pumphouse', turn: 1 },
  { id: 'dawn', model: 'dawnDome', place: 'dawn', turn: 0 },
  { id: 'lamp-gallery', model: 'galleryMouth', place: 'lampgallery', turn: 0 },
  { id: 'seed-vault', model: 'vaultRoots', place: 'seedvault', turn: 1 },
  { id: 'chapel', model: 'chapel', place: 'chapel', turn: 0 },
  { id: 'cave-mouth', model: 'caveMouth', place: 'caves', turn: 3 },
  { id: 'jetty', model: 'jetty', place: 'landing', at: [516, 356], turn: 1 },
  { id: 'tower', model: 'sunkTower', place: 'ruin-tower', turn: 0 },
  { id: 'stair', model: 'forestStair', place: 'ruin-stair', turn: 1 },
  { id: 'mill', model: 'oldMill', place: 'ruin-mill', turn: 3 },
  { id: 'south-wall', model: 'muralWall', place: 'ruin-wall', turn: 0 },
  { id: 'watch-post', model: 'watchPost', place: 'ruin-post', turn: 2 },
  // Over the block ruin north of the beds (region.ts), not on the beds the place names.
  { id: 'garden-cottage', model: 'deadCottage', place: 'garden', at: [341, 294.5], turn: 0 },
  ...['shrine-oak', 'shrine-bend', 'shrine-knoll', 'shrine-forest', 'shrine-marsh', 'shrine-terrace'].map((place) => ({ id: place, model: 'shrine', place, turn: 0 })),
  // The terraces: the fallen friend of the king lies on the top step, and roots as thick as a cart grip the steps.
  { id: 'colossus', model: 'colossus', place: 'terraces', at: [488, 90], turn: 0 },
  { id: 'root-terrace-w', model: 'giantRoot', place: 'terraces', at: [424, 138], turn: 1, variant: 'arch' },
  { id: 'root-terrace-e', model: 'giantRoot', place: 'terraces', at: [546, 134], turn: 3, variant: 'curl' },
  { id: 'root-terrace-top', model: 'giantRoot', place: 'terraces', at: [530, 116], turn: 0, variant: 'low' },
  // The Old Forest's roots and its fallen giant.
  { id: 'root-forest-1', model: 'giantRoot', place: 'seedvault', at: [112, 352], turn: 0, variant: 'arch' },
  { id: 'root-forest-2', model: 'giantRoot', place: 'seedvault', at: [194, 352], turn: 1, variant: 'curl' },
  { id: 'root-forest-3', model: 'giantRoot', place: 'shrine-forest', at: [64, 452], turn: 0, variant: 'low' },
  { id: 'root-forest-4', model: 'giantRoot', place: 'shrine-forest', at: [186, 478], turn: 3, variant: 'arch' },
  { id: 'fallen-giant', model: 'fallenGiant', place: 'seedvault', at: [70, 312], turn: 0 },
  // The ring of stones on the Hall's hill, over your plot.
  { id: 'standing-stones', model: 'standingStones', place: 'hall', at: [403, 250], turn: 0 },
  // Waystones by the main places.
  { id: 'waystone-plot', model: 'waystone', place: 'plot', at: [384, 314], turn: 0 },
  { id: 'waystone-town', model: 'waystone', place: 'town', at: [544, 352], turn: 1 },
  { id: 'waystone-terraces', model: 'waystone', place: 'terraces', at: [456, 172], turn: 0 },
  { id: 'waystone-vault', model: 'waystone', place: 'seedvault', at: [168, 310], turn: 1 },
  { id: 'waystone-pump', model: 'waystone', place: 'pumphouse', at: [700, 418], turn: 0 },
  { id: 'waystone-caves', model: 'waystone', place: 'caves', at: [622, 244], turn: 1 },
  { id: 'waystone-landing', model: 'waystone', place: 'landing', at: [500, 344], turn: 1 },
  // The weir across the Mere, above the landing.
  { id: 'weir', model: 'weir', place: 'landing', at: [524, 348], turn: 0 },
  // The Order's brass pumps, one in each of Hollowmere's edge fields, and its engine on the lit road east of the chapel path.
  ...CITY_FIELDS.map((f, i) => ({ id: `pump-${i + 1}`, model: 'orderPump', place: 'town', at: f.pump, turn: 0 })),
  { id: 'order-engine', model: 'orderEngine', place: 'arches', at: [624, 210], turn: 0 },
  // A colonnade in the meadow by the south wall.
  { id: 'colonnade', model: 'colonnade', place: 'ruin-wall', at: [456, 452], turn: 0 },
  // Crystals round the cave mouth.
  { id: 'crystals-1', model: 'crystals', place: 'caves', at: [646, 226], turn: 0, variant: 'large' },
  { id: 'crystals-2', model: 'crystals', place: 'caves', at: [647, 246], turn: 1, variant: 'small' },
  { id: 'crystals-3', model: 'crystals', place: 'caves', at: [672, 166], turn: 2, variant: 'large' },
  // The cave hills: a rock arch over the caves path, boulders.
  { id: 'rock-arch', model: 'rockArch', place: 'caves', at: [664, 178], turn: 1 },
  { id: 'boulders-hills', model: 'boulders', place: 'caves', at: [692, 254], turn: 0, variant: 'pile' },
  { id: 'boulders-north', model: 'boulders', place: 'lampgallery', at: [700, 132], turn: 1, variant: 'pair' },
  { id: 'boulders-south', model: 'boulders', place: 'ruin-wall', at: [384, 424], turn: 0, variant: 'one' },
  { id: 'boulders-forest', model: 'boulders', place: 'ruin-tower', at: [276, 344], turn: 2, variant: 'pair' },
  // A collapsed span of the High Road among the grey trees, one in the Mere below the falls, one by the knoll.
  { id: 'fallen-span-river', model: 'fallenSpan', place: 'lampgallery', at: [640, 136], turn: 1, wet: true },
  { id: 'fallen-span-grey', model: 'fallenSpan', place: 'highroad', at: [114, 224], turn: 0 },
  { id: 'fallen-span-knoll', model: 'fallenSpan', place: 'shrine-knoll', at: [236, 230], turn: 0 },
  // A marsh hut on stilts, with its boards from the marsh path.
  { id: 'stilt-hut', model: 'stiltHut', place: 'shrine-marsh', at: [702, 526], turn: 1 },
  ...DRESSING,
];

/**
 * How big each landmark model is, in blocks: across its front, front to back, and high (docs/greenhollow-world.md).
 * The land levels this much ground under it and fills its footprint with invisible barrier blocks, two high.
 * `walk` is walked on, not around: the barrier is its floor. `open` is walked through or under, so it gets no
 * barrier. `back` is the height of the bank of land behind it, for a door set into a hill or a rock face. `wet`
 * stands in water, so the ground under it is not levelled. `deck` stands on the High Road's deck. `dress` is a small
 * thing of DRESSING: it lies on the land as it is, with no level ground and no barrier.
 */
export const LANDMARK_SIZES: Readonly<Record<string, { w: number; d: number; h: number; walk?: boolean; open?: boolean; back?: number; wet?: boolean; deck?: boolean; dress?: boolean }>> = {
  ...FOREST_SIZES,
  ...SOUTHEAST_SIZES,
  highRoadArch: { w: 12, d: 7, h: 14, open: true },
  roadStair: { w: 8, d: 8, h: 15, open: true },
  roadPylon: { w: 6, d: 6, h: 30 },
  fallenSpan: { w: 14, d: 8, h: 5 },
  terraceWall: { w: 12, d: 3, h: 6, open: true },
  terraceStair: { w: 10, d: 12, h: 6, open: true },
  oldGate: { w: 14, d: 5, h: 14 },
  colossus: { w: 30, d: 10, h: 8 },
  // Its variants stand 3 (low), 5 (curl) and 7 (arch) high; the barrier is two high whichever it is.
  giantRoot: { w: 16, d: 3.2, h: 5 },
  hallDoor: { w: 9, d: 3, h: 8, back: 10 },
  shrine: { w: 5, d: 5, h: 5 },
  waystone: { w: 2, d: 2, h: 4 },
  standingStones: { w: 14, d: 14, h: 5, open: true },
  pumpHouse: { w: 24, d: 16, h: 18, wet: true },
  weir: { w: 24, d: 4, h: 4, wet: true, open: true },
  oldMill: { w: 10, d: 8, h: 9 },
  jetty: { w: 4, d: 12, h: 3, walk: true, wet: true },
  chapel: { w: 10, d: 14, h: 13 },
  // Walked through: the pumps come out of the fields as the ledger fills, and a barrier would stay behind.
  orderPump: { w: 3, d: 3, h: 4, open: true },
  orderEngine: { w: 12, d: 8, h: 10, deck: true },
  watchPost: { w: 6, d: 6, h: 10 },
  dawnDome: { w: 120, d: 120, h: 60, open: true },
  sunkTower: { w: 8, d: 8, h: 12 },
  // Walked down into: its pit is dug to follow its treads (greenhollow-land.sim.ts).
  forestStair: { w: 6, d: 10, h: 3, open: true },
  muralWall: { w: 16, d: 2, h: 6 },
  deadCottage: { w: 9, d: 7, h: 6, open: true },
  colonnade: { w: 18, d: 6, h: 8 },
  galleryMouth: { w: 10, d: 6, h: 10, back: 12 },
  caveMouth: { w: 10, d: 6, h: 8, back: 10 },
  vaultRoots: { w: 14, d: 12, h: 10 },
  crystals: { w: 3, d: 3, h: 4 },
  rockArch: { w: 16, d: 6, h: 12, open: true },
  boulders: { w: 6, d: 6, h: 5 },
  fallenGiant: { w: 24, d: 5, h: 5, open: true },
  stiltHut: { w: 8, d: 8, h: 8, wet: true, open: true },
  boardwalk: { w: 2, d: 8, h: 1, open: true, wet: true },
  // Dressing: small things laid on the land as it is, walked round or through.
  tent: { w: 3, d: 3, h: 2, open: true, dress: true },
  campfire: { w: 2, d: 2, h: 1, open: true, dress: true },
  homeBedroll: { w: 1.3, d: 0.5, h: 0.5, open: true, dress: true },
  cityNetRack: { w: 4, d: 1, h: 3, open: true, dress: true },
  citySkiff: { w: 2, d: 6, h: 2, open: true, dress: true, wet: true },
  cityDock: { w: 3, d: 3, h: 1, open: true, dress: true, wet: true },
  cityLamp: { w: 2, d: 1, h: 3, open: true, dress: true },
  cityBarrel: { w: 1, d: 1, h: 1, open: true, dress: true },
  cityCrate: { w: 1, d: 1, h: 1, open: true, dress: true },
  cityCart: { w: 3, d: 4, h: 2, open: true, dress: true },
  ruinPillar: { w: 2, d: 1, h: 1.2, open: true, dress: true },
  log: { w: 2.1, d: 0.7, h: 0.8, open: true, dress: true },
  stump: { w: 1, d: 1, h: 1, open: true, dress: true },
  mossStump: { w: 1, d: 1, h: 1, open: true, dress: true },
  pastureFence: { w: 3, d: 1, h: 1, open: true, dress: true },
  signpost: { w: 2, d: 1, h: 3, open: true, dress: true },
};
