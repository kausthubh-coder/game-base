// Every kind of prop, as data. A prop is a 3D shape made in code: a tree, a plant, a rock, a piece of
// town or a station. Adding one is an entry here plus one builder in src/features/props/builders, and
// needs no engine change. `.agents/skills/make-3d-asset/SKILL.md` walks through it.
//
// This file holds no Three.js, so the scatter rules can read it on a server.

export type PropGroup = 'tree' | 'plant' | 'ground' | 'town' | 'clutter' | 'station' | 'landmark';

/** How much each placed copy differs from the next: a turn in radians, and size and tint as a share of 1. */
export interface PropVary {
  turn: number;
  size: number;
  tint: number;
}

export interface PropDef {
  name: string;
  group: PropGroup;
  /** The name of its builder in `src/features/props/builders/index.ts`. */
  builder: string;
  /** One name for each variant. The builder gets the index. */
  variants: readonly string[];
  /** The most triangles any variant may have. A test holds every variant to it. */
  triangles: number;
  /** Wind moves its leaves or blades. Its builder marks which parts sway. */
  wind: boolean;
  /** 0 gives no light. Otherwise the block light level it gives, 1 to 15. Its builder marks where the light sits. */
  light: number;
  /** It glows by day too, like a forge. Other lights glow only when it is dark. */
  alwaysLit?: boolean;
  /** Variants that are dark, like a lamp that is out or a gate that is dead: nothing on them glows and they give no light. */
  unlit?: readonly number[];
  /** The light each variant gives, for a kind whose variants differ, like a fire that burns low. `light` is the brightest of them. */
  lights?: readonly number[];
  vary: PropVary;
  /** Trees only. For each variant: the height of its top and how far its leaves reach from the trunk, in meters. The builder builds to these, and the scatter rules list tree tops from them. */
  crown?: readonly { top: number; reach: number }[];
}

/**
 * The triangle caps from docs/style-sheet.md. A kind's own budget is never above its cap. A landmark is one
 * of a kind in its region, such as a town's great tree or fountain, and is capped like a building.
 */
export const TRIANGLE_CAP: Record<PropGroup, number> = { tree: 1500, plant: 300, ground: 300, town: 300, clutter: 300, station: 300, landmark: 6000 };

/** Things that grow or lie about: any turn, and a clear spread of size and tint. */
const WILD: PropVary = { turn: Math.PI, size: 0.16, tint: 0.1 };
/** Things somebody put down: a small turn, nearly one size. */
const LOOSE: PropVary = { turn: 0.22, size: 0.05, tint: 0.07 };
/** Things that must keep the turn they are placed with: fixed to a wall, joined to each other, or pointing somewhere. Only the tint changes. */
const SNUG: PropVary = { turn: 0, size: 0, tint: 0.04 };

const still = { wind: false, light: 0 } as const;

export const PROPS = {
  rigChannel: { name: 'Water channel', group: 'station', builder: 'rigChannel', variants: ['armed'], triangles: 70, ...still, vary: SNUG },
  rigChannelSpent: { name: 'Dry water channel', group: 'station', builder: 'rigChannelSpent', variants: ['spent'], triangles: 90, ...still, vary: SNUG },

  rigPlate: { name: 'Spring plate', group: 'station', builder: 'rigPlate', variants: ['armed'], triangles: 290, ...still, vary: SNUG },
  rigPlateSpent: { name: 'Released spring plate', group: 'station', builder: 'rigPlateSpent', variants: ['spent'], triangles: 290, ...still, vary: SNUG },

  rigSnare: { name: 'Snare vine', group: 'station', builder: 'rigSnare', variants: ['armed'], triangles: 180, ...still, vary: WILD },
  rigSnareSpent: { name: 'Closed snare vine', group: 'station', builder: 'rigSnareSpent', variants: ['spent'], triangles: 300, ...still, vary: WILD },

  rigLamp: { name: 'Lure lamp', group: 'station', builder: 'rigLamp', variants: ['armed'], triangles: 120, wind: false, light: 13, alwaysLit: true, vary: SNUG },
  rigLampSpent: { name: 'Spent lure lamp', group: 'station', builder: 'rigLampSpent', variants: ['spent'], triangles: 140, ...still, vary: SNUG },

  pastureFence: { name: 'Pasture fence', group: 'town', builder: 'pastureFence', variants: ['valley'], triangles: 130, wind: false, light: 0, vary: SNUG },
  footbridge: { name: 'Wooden footbridge', group: 'town', builder: 'footbridge', variants: ['valley'], triangles: 240, wind: false, light: 0, vary: SNUG },
  mossStump: { name: 'Mossy stump', group: 'ground', builder: 'mossStump', variants: ['valley'], triangles: 120, wind: false, light: 0, vary: WILD },
  wildflowers: { name: 'Wildflower clump', group: 'plant', builder: 'wildflowers', variants: ['valley'], triangles: 150, wind: true, light: 0, vary: WILD },
  hayBale: { name: 'Bound hay bale', group: 'clutter', builder: 'hayBale', variants: ['valley'], triangles: 200, wind: false, light: 0, vary: LOOSE },
  harvestStall: { name: 'Harvest stall', group: 'town', builder: 'harvestStall', variants: ['valley'], triangles: 230, wind: true, light: 0, vary: SNUG },

  // ---- trees
  oak: {
    name: 'Oak', group: 'tree', builder: 'oak', variants: ['round', 'broad', 'tall'], triangles: 260, wind: true, light: 0, vary: WILD,
    crown: [{ top: 5.6, reach: 2.3 }, { top: 5.0, reach: 2.8 }, { top: 6.8, reach: 2.1 }],
  },
  birch: {
    name: 'Birch', group: 'tree', builder: 'birch', variants: ['slim', 'forked', 'young'], triangles: 300, wind: true, light: 0, vary: WILD,
    crown: [{ top: 6.2, reach: 1.5 }, { top: 5.6, reach: 1.9 }, { top: 4.2, reach: 1.2 }],
  },
  pine: {
    name: 'Pine', group: 'tree', builder: 'pine', variants: ['tall', 'stout', 'young'], triangles: 140, wind: true, light: 0, vary: WILD,
    crown: [{ top: 8.4, reach: 1.9 }, { top: 6.4, reach: 2.2 }, { top: 4.4, reach: 1.4 }],
  },

  // ---- small plants
  grassTuft: { name: 'Grass tuft', group: 'plant', builder: 'grassTuft', variants: ['short', 'mid', 'full'], triangles: 40, wind: true, light: 0, vary: WILD },
  tallGrass: { name: 'Tall grass', group: 'plant', builder: 'tallGrass', variants: ['clump'], triangles: 70, wind: true, light: 0, vary: WILD },
  flower: { name: 'Flower', group: 'plant', builder: 'flower', variants: ['white', 'yellow', 'red', 'pink', 'purple', 'blue'], triangles: 60, wind: true, light: 0, vary: WILD },
  reeds: { name: 'Reeds', group: 'plant', builder: 'reeds', variants: ['thin', 'cattails'], triangles: 80, wind: true, light: 0, vary: WILD },
  lilyPad: { name: 'Lily pad', group: 'plant', builder: 'lilyPad', variants: ['plain', 'bloom'], triangles: 50, ...still, vary: WILD },
  mushroom: { name: 'Mushroom', group: 'plant', builder: 'mushroom', variants: ['red', 'brown', 'pale'], triangles: 90, ...still, vary: WILD },
  bush: { name: 'Bush', group: 'plant', builder: 'bush', variants: ['round', 'wide', 'blossom'], triangles: 120, wind: true, light: 0, vary: WILD },
  berryBush: { name: 'Berry bush', group: 'plant', builder: 'berryBush', variants: ['ripe'], triangles: 150, wind: true, light: 0, vary: WILD },

  // ---- ground
  rock: { name: 'Rock', group: 'ground', builder: 'rock', variants: ['pebbles', 'stone', 'boulder', 'slab'], triangles: 70, ...still, vary: WILD },
  log: { name: 'Fallen log', group: 'ground', builder: 'log', variants: ['fallen'], triangles: 90, ...still, vary: WILD },
  stump: { name: 'Stump', group: 'ground', builder: 'stump', variants: ['cut'], triangles: 70, ...still, vary: WILD },

  // ---- town
  door: { name: 'Door', group: 'town', builder: 'door', variants: ['closed', 'open', 'barn'], triangles: 200, ...still, vary: SNUG },
  window: { name: 'Window', group: 'town', builder: 'window', variants: ['plain', 'shutters', 'flowerbox'], triangles: 150, wind: false, light: 9, vary: SNUG },
  chimney: { name: 'Chimney', group: 'town', builder: 'chimney', variants: ['brick'], triangles: 120, ...still, vary: SNUG },
  sign: { name: 'Shop sign', group: 'town', builder: 'sign', variants: ['hammer', 'loaf', 'flask'], triangles: 140, ...still, vary: SNUG },
  awning: { name: 'Awning', group: 'town', builder: 'awning', variants: ['teal', 'red'], triangles: 80, wind: true, light: 0, vary: SNUG },
  stall: { name: 'Market stall', group: 'town', builder: 'stall', variants: ['produce', 'bread', 'cloth'], triangles: 240, ...still, vary: SNUG },
  well: { name: 'Well', group: 'town', builder: 'well', variants: ['roofed'], triangles: 200, ...still, vary: SNUG },
  fence: { name: 'Fence', group: 'town', builder: 'fence', variants: ['run', 'post', 'rails'], triangles: 40, ...still, vary: SNUG },
  gate: { name: 'Gate', group: 'town', builder: 'gate', variants: ['closed', 'open'], triangles: 90, ...still, vary: SNUG },
  lampPost: { name: 'Lamp post', group: 'town', builder: 'lampPost', variants: ['standing'], triangles: 150, wind: false, light: 14, vary: SNUG },
  signpost: { name: 'Signpost', group: 'town', builder: 'signpost', variants: ['two ways', 'three ways'], triangles: 140, ...still, vary: SNUG },
  bench: { name: 'Bench', group: 'town', builder: 'bench', variants: ['plain'], triangles: 90, ...still, vary: LOOSE },

  // ---- Hollowmere: the arms of Greenhollow, the town's lights, and its landmarks
  banner: { name: 'Banner', group: 'town', builder: 'banner', variants: ['crown', 'harvest', 'hedge'], triangles: 170, wind: true, light: 0, vary: SNUG },
  lantern: { name: 'Lantern', group: 'town', builder: 'lantern', variants: ['post', 'double', 'ground'], triangles: 280, wind: false, light: 13, vary: SNUG },
  stringLights: { name: 'String of lanterns', group: 'town', builder: 'stringLights', variants: ['warm'], triangles: 300, wind: true, light: 10, vary: SNUG },
  bunting: { name: 'Bunting', group: 'town', builder: 'bunting', variants: ['festival'], triangles: 290, wind: true, light: 0, vary: SNUG },
  brazier: { name: 'Brazier', group: 'town', builder: 'brazier', variants: ['lit'], triangles: 140, wind: true, light: 12, vary: SNUG },
  planter: { name: 'Flower planter', group: 'clutter', builder: 'planter', variants: ['flowers'], triangles: 220, wind: true, light: 0, vary: LOOSE },
  noticeBoard: { name: 'Notice board', group: 'town', builder: 'noticeBoard', variants: ['notices'], triangles: 140, ...still, vary: SNUG },
  rootFountain: { name: 'Root Fountain', group: 'landmark', builder: 'rootFountain', variants: ['brass'], triangles: 800, wind: false, light: 10, alwaysLit: true, vary: SNUG },
  elderOak: { name: 'Hollow Oak', group: 'landmark', builder: 'elderOak', variants: ['lamps'], triangles: 1400, wind: true, light: 11, vary: SNUG },

  // ---- the ruin: what the Gardeners left in Ilara's Hall. Lume shows only on the variants that are awake.
  shutDoor: { name: 'Shut Door', group: 'landmark', builder: 'shutDoor', variants: ['shut', 'open'], triangles: 600, ...still, vary: SNUG },
  heartstone: { name: 'Heartstone', group: 'landmark', builder: 'heartstone', variants: ['dull', 'faint', 'glowing'], triangles: 3980, wind: false, light: 10, alwaysLit: true, unlit: [0], vary: SNUG },
  gateArch: { name: 'Gate arch', group: 'landmark', builder: 'gateArch', variants: ['dead', 'awake'], triangles: 600, wind: false, light: 10, alwaysLit: true, unlit: [0], vary: SNUG },
  muralSlab: { name: 'Mural slab', group: 'landmark', builder: 'muralSlab', variants: ['eight figures'], triangles: 470, ...still, vary: SNUG },
  ruinPillar: { name: 'Broken pillar', group: 'landmark', builder: 'ruinPillar', variants: ['stump', 'waist high', 'leaning'], triangles: 300, ...still, vary: LOOSE },
  plinth: { name: 'Plinth', group: 'landmark', builder: 'plinth', variants: ['brass ring'], triangles: 150, ...still, vary: SNUG },

  // ---- clutter
  barrel: { name: 'Barrel', group: 'clutter', builder: 'barrel', variants: ['closed', 'open'], triangles: 140, ...still, vary: LOOSE },
  crate: { name: 'Crate', group: 'clutter', builder: 'crate', variants: ['single', 'stack'], triangles: 220, ...still, vary: LOOSE },
  cart: { name: 'Cart', group: 'clutter', builder: 'cart', variants: ['empty', 'hay'], triangles: 240, ...still, vary: LOOSE },
  sack: { name: 'Sack', group: 'clutter', builder: 'sack', variants: ['one', 'pile'], triangles: 190, ...still, vary: LOOSE },

  // ---- stations
  workbench: { name: 'Workbench', group: 'station', builder: 'workbench', variants: ['tools'], triangles: 200, ...still, vary: SNUG },
  forge: { name: 'Forge', group: 'station', builder: 'forge', variants: ['lit'], triangles: 220, wind: false, light: 12, alwaysLit: true, vary: SNUG },
  stove: { name: 'Kitchen stove', group: 'station', builder: 'stove', variants: ['pot'], triangles: 160, wind: false, light: 8, alwaysLit: true, vary: SNUG },
  chest: { name: 'Chest', group: 'station', builder: 'chest', variants: ['closed', 'open'], triangles: 160, ...still, vary: SNUG },
  bed: { name: 'Bed', group: 'station', builder: 'bed', variants: ['teal', 'red'], triangles: 150, ...still, vary: SNUG },
  sprinkler: { name: 'Sprinkler', group: 'station', builder: 'sprinkler', variants: ['brass'], triangles: 170, ...still, vary: SNUG },
  // world/models-8
  rockArch: { name: 'Natural rock arch', group: 'landmark', builder: 'rockArch', variants: ['arch'], triangles: 6000, wind: true, light: 0, vary: SNUG },
  boulders: { name: 'Mossy boulders', group: 'landmark', builder: 'boulders', variants: ['one', 'pair', 'pile'], triangles: 4800, wind: false, light: 0, vary: SNUG },
  fallenGiant: { name: 'Hollow fallen oak', group: 'landmark', builder: 'fallenGiant', variants: ['oak'], triangles: 4000, wind: false, light: 0, vary: SNUG },
  stiltHut: { name: 'Marsh stilt hut', group: 'landmark', builder: 'stiltHut', variants: ['thatched'], triangles: 6000, wind: false, light: 9, vary: SNUG },
  boardwalk: { name: 'Marsh boardwalk', group: 'landmark', builder: 'boardwalk', variants: ['run', 'end'], triangles: 1770, wind: false, light: 0, vary: SNUG },
  // act1-models-1
  highRoadArch: { name: 'High Road arch', group: 'landmark', builder: 'highRoadArch', variants: ['dark', 'lit', 'broken', 'stairGap'], unlit: [0, 2, 3], triangles: 4900, wind: false, light: 12, alwaysLit: true, vary: SNUG },
  roadStair: { name: 'High Road stair', group: 'landmark', builder: 'roadStair', variants: ['stone'], triangles: 5000, ...still, vary: SNUG },
  roadPylon: { name: 'High Road pylon', group: 'landmark', builder: 'roadPylon', variants: ['dormant', 'lit'], unlit: [0], triangles: 3300, wind: false, light: 13, alwaysLit: true, vary: SNUG },
  fallenSpan: { name: 'Fallen High Road span', group: 'landmark', builder: 'fallenSpan', variants: ['ruin'], triangles: 3000, ...still, vary: SNUG },
  // world/models-1
  // world/models-2
  terraceWall: { name: 'Terrace wall', group: 'landmark', builder: 'terraceWall', variants: ['weathered'], triangles: 3320, ...still, vary: SNUG },
  terraceStair: { name: 'Terrace stair', group: 'landmark', builder: 'terraceStair', variants: ['weathered'], triangles: 5800, ...still, vary: SNUG },
  oldGate: { name: 'Old Gate', group: 'landmark', builder: 'oldGate', variants: ['sealed'], triangles: 6000, ...still, vary: SNUG },
  colossus: { name: 'Fallen colossus', group: 'landmark', builder: 'colossus', variants: ['companion'], triangles: 6000, ...still, vary: SNUG },
  giantRoot: { name: 'Giant root', group: 'landmark', builder: 'giantRoot', variants: ['arch', 'low', 'curl'], triangles: 1890, ...still, vary: SNUG },
  // world/models-7
  galleryMouth: { name: 'Lamp Gallery entrance', group: 'landmark', builder: 'galleryMouth', variants: ['ancient'], triangles: 5460, ...still, vary: SNUG },
  caveMouth: { name: 'Root cave mouth', group: 'landmark', builder: 'caveMouth', variants: ['rooted'], triangles: 4670, ...still, vary: SNUG },
  vaultRoots: { name: 'Seed Vault', group: 'landmark', builder: 'vaultRoots', variants: ['sealed', 'open'], triangles: 6000, ...still, vary: SNUG },
  crystals: { name: 'Pale quartz', group: 'landmark', builder: 'crystals', variants: ['small', 'large'], triangles: 490, ...still, vary: WILD },
  // act1-models-7
  // world/models-3
  hallDoor: { name: "Ilara's Hall door", group: 'landmark', builder: 'hallDoor', variants: ['closed'], triangles: 6000, wind: false, light: 7, alwaysLit: true, vary: SNUG },
  shrine: { name: 'Shrine', group: 'landmark', builder: 'shrine', variants: ['dormant', 'restored'], unlit: [0], triangles: 2900, wind: false, light: 10, alwaysLit: true, vary: SNUG },
  waystone: { name: 'Waystone', group: 'landmark', builder: 'waystone', variants: ['sleeping', 'waking'], unlit: [0], triangles: 540, wind: false, light: 8, alwaysLit: true, vary: SNUG },
  standingStones: { name: 'Standing stones', group: 'landmark', builder: 'standingStones', variants: ['ring'], triangles: 3840, ...still, vary: SNUG },
  // world/models-4
  pumpHouse: { name: 'Pump House', group: 'landmark', builder: 'pumpHouse', variants: ['river'], triangles: 6000, ...still, vary: SNUG },
  weir: { name: 'Mere weir', group: 'landmark', builder: 'weir', variants: ['river'], triangles: 980, ...still, vary: SNUG },
  oldMill: { name: 'Old mill', group: 'landmark', builder: 'oldMill', variants: ['ruin'], triangles: 3720, ...still, vary: SNUG },
  jetty: { name: 'Ferry landing', group: 'landmark', builder: 'jetty', variants: ['landing'], triangles: 3060, wind: false, light: 10, vary: SNUG },
  // world/models-5
  chapel: { name: 'Chapel of the Dawn', group: 'landmark', builder: 'chapel', variants: ['white'], triangles: 6000, wind: false, light: 10, vary: SNUG },
  orderPump: { name: 'Order root pump', group: 'landmark', builder: 'orderPump', variants: ['brass'], triangles: 5900, wind: false, light: 12, alwaysLit: true, vary: SNUG },
  orderEngine: { name: 'Order road engine', group: 'landmark', builder: 'orderEngine', variants: ['gold'], triangles: 2830, wind: false, light: 14, alwaysLit: true, vary: SNUG },
  watchPost: { name: 'Order watch post', group: 'landmark', builder: 'watchPost', variants: ['white'], triangles: 1560, wind: false, light: 9, vary: SNUG },
  dawnDome: { name: 'The Dawn', group: 'landmark', builder: 'dawnDome', variants: ['horizon'], triangles: 5530, wind: false, light: 15, alwaysLit: true, vary: SNUG },
  // world/models-6
  sunkTower: { name: 'Sunk tower', group: 'landmark', builder: 'sunkTower', variants: ['ancient'], triangles: 5900, ...still, vary: SNUG },
  forestStair: { name: 'Forest stair', group: 'landmark', builder: 'forestStair', variants: ['ancient'], triangles: 5560, ...still, vary: SNUG },
  muralWall: { name: 'Wall of friends', group: 'landmark', builder: 'muralWall', variants: ['ancient'], triangles: 4320, ...still, vary: SNUG },
  deadCottage: { name: 'Dead garden cottage', group: 'landmark', builder: 'deadCottage', variants: ['ancient'], triangles: 4870, ...still, vary: SNUG },
  colonnade: { name: 'Broken colonnade', group: 'landmark', builder: 'colonnade', variants: ['ancient'], triangles: 4800, ...still, vary: SNUG },
  // act1-models-6

  // world/biomes: the small things of the wild kinds of land, scattered by the painted world (WILDS in src/content/painted.ts)
  fern: { name: 'Fern', group: 'plant', builder: 'fern', variants: ['full', 'young'], triangles: 210, wind: true, light: 0, vary: WILD },
  surfaceRoot: { name: 'Surface root', group: 'ground', builder: 'surfaceRoot', variants: ['arch', 'coil'], triangles: 90, ...still, vary: WILD },
  fallenLog: { name: 'Fallen log', group: 'ground', builder: 'fallenLog', variants: ['mossy'], triangles: 120, ...still, vary: WILD },
  greyGrass: { name: 'Grey grass', group: 'plant', builder: 'greyGrass', variants: ['dry'], triangles: 120, wind: true, light: 0, vary: WILD },
  bulrush: { name: 'Bulrush', group: 'plant', builder: 'bulrush', variants: ['rushes', 'flag'], triangles: 140, wind: true, light: 0, vary: WILD },
  steppingStone: { name: 'Stepping stone', group: 'ground', builder: 'steppingStone', variants: ['round', 'pair'], triangles: 60, ...still, vary: WILD },
  scree: { name: 'Scree', group: 'ground', builder: 'scree', variants: ['spill'], triangles: 90, ...still, vary: WILD },
  // act1-models-3
  // act1-models-5

  // act1-city-buildings
  cityCottage: { name: 'Cottage', group: 'landmark', builder: 'cityCottage', variants: ['hollowmere'], triangles: 2900, wind: false, light: 9, vary: SNUG },
  cityFamilyHouse: { name: 'Family House', group: 'landmark', builder: 'cityFamilyHouse', variants: ['hollowmere'], triangles: 4030, wind: false, light: 9, vary: SNUG },
  cityLongHouse: { name: 'Long House', group: 'landmark', builder: 'cityLongHouse', variants: ['hollowmere'], triangles: 3810, wind: false, light: 9, vary: SNUG },
  cityTallHouse: { name: 'Tall House', group: 'landmark', builder: 'cityTallHouse', variants: ['hollowmere'], triangles: 4600, wind: false, light: 9, vary: SNUG },
  cityMerchantRowHouse: { name: 'Merchant Row House', group: 'landmark', builder: 'cityMerchantRowHouse', variants: ['hollowmere'], triangles: 3500, wind: false, light: 9, vary: SNUG },
  cityCornerShop: { name: 'Corner Shop', group: 'landmark', builder: 'cityCornerShop', variants: ['hollowmere'], triangles: 4840, wind: false, light: 9, vary: SNUG },
  cityBakery: { name: 'Bakery', group: 'landmark', builder: 'cityBakery', variants: ['hollowmere'], triangles: 3530, wind: false, light: 9, vary: SNUG },
  cityGuildLodge: { name: 'Guild Lodge', group: 'landmark', builder: 'cityGuildLodge', variants: ['hollowmere'], triangles: 4950, wind: false, light: 9, vary: SNUG },
  cityWorkshop: { name: 'Workshop', group: 'landmark', builder: 'cityWorkshop', variants: ['hollowmere'], triangles: 5290, wind: false, light: 9, vary: SNUG },
  cityGranary: { name: 'Granary', group: 'landmark', builder: 'cityGranary', variants: ['hollowmere'], triangles: 6000, wind: false, light: 9, vary: SNUG },
  cityWarehouse: { name: 'Warehouse', group: 'landmark', builder: 'cityWarehouse', variants: ['hollowmere'], triangles: 5190, wind: false, light: 9, vary: SNUG },
  cityLampHouse: { name: 'Lamp House', group: 'landmark', builder: 'cityLampHouse', variants: ['hollowmere'], triangles: 4710, wind: false, light: 9, vary: SNUG },
  cityWheelwrightYard: { name: 'Wheelwright Yard', group: 'landmark', builder: 'cityWheelwrightYard', variants: ['hollowmere'], triangles: 3940, wind: false, light: 9, vary: SNUG },
  cityTownMill: { name: 'Town Mill', group: 'landmark', builder: 'cityTownMill', variants: ['hollowmere'], triangles: 6000, wind: false, light: 9, vary: SNUG },
  cityCivicHall: { name: 'Civic Hall', group: 'landmark', builder: 'cityCivicHall', variants: ['hollowmere'], triangles: 6000, wind: false, light: 9, vary: SNUG },
  cityCourtyardTenement: { name: 'Courtyard Tenement', group: 'landmark', builder: 'cityCourtyardTenement', variants: ['hollowmere'], triangles: 6000, wind: false, light: 9, vary: SNUG },
  // act1-city-streets
  cityStall: { name: 'City Stall', group: 'landmark', builder: 'cityStall', variants: ['saffron', 'cream'], unlit: [1], triangles: 730, wind: false, light: 8, vary: SNUG },
  cityCart: { name: 'City Cart', group: 'landmark', builder: 'cityCart', variants: ['town'], triangles: 560, wind: false, light: 0, vary: SNUG },
  cityCrate: { name: 'City Crate', group: 'landmark', builder: 'cityCrate', variants: ['town'], triangles: 170, wind: false, light: 0, vary: SNUG },
  cityBarrel: { name: 'City Barrel', group: 'landmark', builder: 'cityBarrel', variants: ['town'], triangles: 210, wind: false, light: 0, vary: SNUG },
  cityBench: { name: 'City Bench', group: 'landmark', builder: 'cityBench', variants: ['town'], triangles: 560, wind: false, light: 0, vary: SNUG },
  cityLamp: { name: 'City Lamp', group: 'landmark', builder: 'cityLamp', variants: ['town'], triangles: 430, wind: false, light: 10, vary: SNUG },
  citySign: { name: 'City Sign', group: 'landmark', builder: 'citySign', variants: ['town'], triangles: 110, wind: false, light: 0, vary: SNUG },
  cityBanner: { name: 'City Banner', group: 'landmark', builder: 'cityBanner', variants: ['town'], triangles: 210, wind: false, light: 0, vary: SNUG },
  cityWell: { name: 'City Well', group: 'landmark', builder: 'cityWell', variants: ['town'], triangles: 590, wind: false, light: 0, vary: SNUG },
  cityFountain: { name: 'City Fountain', group: 'landmark', builder: 'cityFountain', variants: ['town'], triangles: 450, wind: false, light: 0, vary: SNUG },
  cityPlanter: { name: 'City Planter', group: 'landmark', builder: 'cityPlanter', variants: ['town'], triangles: 700, wind: false, light: 0, vary: SNUG },
  cityFence: { name: 'City Fence', group: 'landmark', builder: 'cityFence', variants: ['run', 'end'], triangles: 110, wind: false, light: 0, vary: SNUG },
  cityFenceCorner: { name: 'City FenceCorner', group: 'landmark', builder: 'cityFenceCorner', variants: ['town'], triangles: 180, wind: false, light: 0, vary: SNUG },
  cityPavingEdge: { name: 'City PavingEdge', group: 'landmark', builder: 'cityPavingEdge', variants: ['town'], triangles: 130, wind: false, light: 0, vary: SNUG },
  cityStringLights: { name: 'City StringLights', group: 'landmark', builder: 'cityStringLights', variants: ['town'], triangles: 1280, wind: false, light: 10, vary: SNUG },
  cityQuayWall: { name: 'City QuayWall', group: 'landmark', builder: 'cityQuayWall', variants: ['town'], triangles: 150, wind: false, light: 0, vary: SNUG },
  cityQuayCorner: { name: 'City QuayCorner', group: 'landmark', builder: 'cityQuayCorner', variants: ['outside', 'inside'], triangles: 290, wind: false, light: 0, vary: SNUG },
  cityQuaySteps: { name: 'City QuaySteps', group: 'landmark', builder: 'cityQuaySteps', variants: ['town'], triangles: 180, wind: false, light: 0, vary: SNUG },
  cityBollard: { name: 'City Bollard', group: 'landmark', builder: 'cityBollard', variants: ['town'], triangles: 300, wind: false, light: 0, vary: SNUG },
  cityDock: { name: 'City Dock', group: 'landmark', builder: 'cityDock', variants: ['run', 'end'], triangles: 210, wind: false, light: 0, vary: SNUG },
  citySkiff: { name: 'City Skiff', group: 'landmark', builder: 'citySkiff', variants: ['town'], triangles: 590, wind: false, light: 0, vary: SNUG },
  cityCargoBoat: { name: 'City CargoBoat', group: 'landmark', builder: 'cityCargoBoat', variants: ['town'], triangles: 840, wind: false, light: 0, vary: SNUG },
  cityNetRack: { name: 'City NetRack', group: 'landmark', builder: 'cityNetRack', variants: ['town'], triangles: 560, wind: false, light: 0, vary: SNUG },
  cityCrane: { name: 'City Crane', group: 'landmark', builder: 'cityCrane', variants: ['town'], triangles: 450, wind: false, light: 0, vary: SNUG },
  cityGangplank: { name: 'City Gangplank', group: 'landmark', builder: 'cityGangplank', variants: ['town'], triangles: 290, wind: false, light: 0, vary: SNUG },
  cityParapet: { name: 'City Parapet', group: 'landmark', builder: 'cityParapet', variants: ['town'], triangles: 150, wind: false, light: 0, vary: SNUG },
  cityJetty: { name: 'City Jetty', group: 'landmark', builder: 'cityJetty', variants: ['town'], triangles: 2970, wind: false, light: 10, vary: SNUG },
  // act1-kit-parts
  partChuteDown: { name: 'Downhill chute', group: 'station', builder: 'partChuteDown', variants: ['working', 'starved', 'backed up'], triangles: 100, ...still, vary: SNUG },
  partWheel: { name: 'Wheel', group: 'station', builder: 'partWheel', variants: ['working', 'starved', 'backed up'], triangles: 300, wind: false, light: 0, vary: SNUG },
  partShaft: { name: 'Shaft', group: 'station', builder: 'partShaft', variants: ['working', 'starved', 'backed up'], triangles: 130, wind: false, light: 0, vary: SNUG },
  partShaftCorner: { name: 'ShaftCorner', group: 'station', builder: 'partShaftCorner', variants: ['working', 'starved', 'backed up'], triangles: 180, wind: false, light: 0, vary: SNUG },
  partShaftSlope: { name: 'ShaftSlope', group: 'station', builder: 'partShaftSlope', variants: ['working', 'starved', 'backed up'], triangles: 150, wind: false, light: 0, vary: SNUG },
  partLever: { name: 'Lever', group: 'station', builder: 'partLever', variants: ['working', 'starved', 'backed up'], triangles: 170, wind: false, light: 0, vary: SNUG },
  partSprinkler: { name: 'Sprinkler', group: 'station', builder: 'partSprinkler', variants: ['working', 'starved', 'backed up'], triangles: 280, wind: false, light: 0, vary: SNUG },
  partChute: { name: 'Chute', group: 'station', builder: 'partChute', variants: ['working', 'starved', 'backed up'], triangles: 80, wind: false, light: 0, vary: SNUG },
  partChuteUp: { name: 'ChuteUp', group: 'station', builder: 'partChuteUp', variants: ['working', 'starved', 'backed up'], triangles: 210, wind: false, light: 0, vary: SNUG },
  partCollector: { name: 'Collector', group: 'station', builder: 'partCollector', variants: ['working', 'starved', 'backed up'], triangles: 300, wind: false, light: 0, vary: SNUG },
  partPusher: { name: 'Pusher', group: 'station', builder: 'partPusher', variants: ['working', 'starved', 'backed up'], triangles: 300, wind: false, light: 0, vary: SNUG },
  partClapper: { name: 'Clapper', group: 'station', builder: 'partClapper', variants: ['working', 'starved', 'backed up'], triangles: 210, wind: false, light: 0, vary: SNUG },
  partBeeBox: { name: 'BeeBox', group: 'station', builder: 'partBeeBox', variants: ['working', 'starved', 'backed up'], triangles: 220, wind: false, light: 0, vary: SNUG },
  partSensor: { name: 'Sensor', group: 'station', builder: 'partSensor', variants: ['working', 'starved', 'backed up'], triangles: 180, wind: false, light: 5, unlit: [1], alwaysLit: true, vary: SNUG },
  partLamp: { name: 'Lamp', group: 'station', builder: 'partLamp', variants: ['working', 'starved', 'backed up'], triangles: 260, wind: false, light: 9, unlit: [1], vary: SNUG },
  partSwitchableLamp: { name: 'SwitchableLamp', group: 'station', builder: 'partSwitchableLamp', variants: ['working', 'starved', 'backed up'], triangles: 300, wind: false, light: 9, unlit: [1, 2], vary: SNUG },
  partArm: { name: 'Arm', group: 'station', builder: 'partArm', variants: ['working', 'starved', 'backed up'], triangles: 250, wind: false, light: 0, vary: SNUG },
  partSawArm: { name: 'SawArm', group: 'station', builder: 'partSawArm', variants: ['working', 'starved', 'backed up'], triangles: 240, wind: false, light: 0, vary: SNUG },
  partWorkbench: { name: 'Workbench', group: 'station', builder: 'partWorkbench', variants: ['working', 'starved', 'backed up'], triangles: 230, wind: false, light: 0, vary: SNUG },
  partDitch: { name: 'Ditch', group: 'station', builder: 'partDitch', variants: ['working', 'starved', 'backed up'], triangles: 60, wind: false, light: 0, vary: SNUG },
  partFence: { name: 'Fence', group: 'station', builder: 'partFence', variants: ['working', 'starved', 'backed up'], triangles: 180, wind: false, light: 0, vary: SNUG },
  partPit: { name: 'Pit', group: 'station', builder: 'partPit', variants: ['working', 'starved', 'backed up'], triangles: 60, wind: false, light: 0, vary: SNUG },
  partHatch: { name: 'Hatch', group: 'station', builder: 'partHatch', variants: ['working', 'starved', 'backed up'], triangles: 190, wind: false, light: 0, vary: SNUG },

  // ---- a ward's camp. The fire burns by day too, gives less light when it is low and none when it is cold.
  campfire: { name: 'Campfire', group: 'station', builder: 'campfire', variants: ['lit', 'low', 'cold'], triangles: 300, wind: true, light: 12, lights: [12, 8, 0], alwaysLit: true, unlit: [2], vary: SNUG },
  tent: { name: 'Tent', group: 'landmark', builder: 'tent', variants: ['canvas'], triangles: 2890, wind: false, light: 12, vary: SNUG },

  // act1-kit-settlement
  homeCarryingChest: { name: 'Carrying chest', group: 'station', builder: 'homeCarryingChest', variants: ['outbound', 'return'], triangles: 180, wind: false, light: 0, vary: SNUG },
  homeTent: { name: 'Tent', group: 'landmark', builder: 'homeTent', variants: ['camp'], triangles: 2890, wind: false, light: 12, vary: SNUG },
  homeFire: { name: 'Fire', group: 'landmark', builder: 'homeFire', variants: ['embers'], triangles: 3600, wind: false, light: 13, vary: SNUG },
  homeBedroll: { name: 'Bedroll', group: 'station', builder: 'homeBedroll', variants: ['unrolled', 'rolled'], triangles: 160, wind: false, light: 0, vary: SNUG },
  homeBed: { name: 'Bed', group: 'station', builder: 'homeBed', variants: ['quilt'], triangles: 240, wind: false, light: 0, vary: SNUG },
  homeTable: { name: 'Table', group: 'station', builder: 'homeTable', variants: ['preparation'], triangles: 150, wind: false, light: 0, vary: SNUG },
  homeLamp: { name: 'Lamp', group: 'landmark', builder: 'homeLamp', variants: ['amber'], triangles: 250, wind: false, light: 12, vary: SNUG },
  homeOven: { name: 'Oven', group: 'landmark', builder: 'homeOven', variants: ['bread'], triangles: 640, wind: false, light: 12, vary: SNUG },
  homeKitchen: { name: 'Kitchen', group: 'landmark', builder: 'homeKitchen', variants: ['awning', 'enclosed'], triangles: 3110, wind: false, light: 12, vary: SNUG },
  homeSmall: { name: 'Rural cottage', group: 'landmark', builder: 'homeSmall', variants: ['cottage', 'porch', 'upperFloor'], triangles: 6000, wind: false, light: 12, vary: SNUG },
  homeMapRoom: { name: 'Map room home', group: 'landmark', builder: 'homeMapRoom', variants: ['mapRoom'], triangles: 3120, wind: false, light: 12, vary: SNUG },
  homeSmokehouse: { name: 'Smokehouse', group: 'landmark', builder: 'homeSmokehouse', variants: ['travelMeals'], triangles: 2350, wind: false, light: 12, vary: SNUG },
  homeSeedShed: { name: 'Seed shed', group: 'landmark', builder: 'homeSeedShed', variants: ['seeds'], triangles: 1280, wind: false, light: 12, vary: SNUG },
  homeBeastYard: { name: 'Beast yard', group: 'landmark', builder: 'homeBeastYard', variants: ['shelter'], triangles: 1500, wind: false, light: 0, vary: SNUG },
  homeWatchPost: { name: 'Watch post', group: 'landmark', builder: 'homeWatchPost', variants: ['watch'], triangles: 820, wind: false, light: 12, vary: SNUG },
  homeHeartstone: { name: 'Heartstone', group: 'landmark', builder: 'homeHeartstone', variants: ['dormant', 'waterAndFire', 'kitchenAndBeds', 'livingFarms', 'wheelAndTerrace', 'households', 'stagFreed'], triangles: 1680, wind: false, light: 12, vary: SNUG, unlit: [0], alwaysLit: true },
  // act1-city-parts
  cityPartPlinth: { name: 'City Plinth', group: 'town', builder: 'cityPartPlinth', variants: ['4', '3', '2-infill', '1-infill'], triangles: 20, ...still, vary: SNUG },
  cityPartWall: { name: 'City Wall', group: 'town', builder: 'cityPartWall', variants: ['4', '3', '2-infill', '1-infill'], triangles: 80, ...still, vary: SNUG },
  cityPartWallWindow: { name: 'City WallWindow', group: 'town', builder: 'cityPartWallWindow', variants: ['4', '3', '2-infill', '1-infill'], triangles: 300, ...still, vary: SNUG },
  cityPartWallDoor: { name: 'City WallDoor', group: 'town', builder: 'cityPartWallDoor', variants: ['4', '3', '2-infill', '1-infill'], triangles: 110, ...still, vary: SNUG },
  cityPartCorner: { name: 'City Corner', group: 'town', builder: 'cityPartCorner', variants: ['standard'], triangles: 50, ...still, vary: SNUG },
  cityPartRoofEnd: { name: 'City RoofEnd', group: 'town', builder: 'cityPartRoofEnd', variants: ['standard'], triangles: 100, ...still, vary: SNUG },
  cityPartRoof: { name: 'City Roof', group: 'town', builder: 'cityPartRoof', variants: ['standard'], triangles: 230, ...still, vary: SNUG },
  cityPartRidge: { name: 'City Ridge', group: 'town', builder: 'cityPartRidge', variants: ['standard'], triangles: 20, ...still, vary: SNUG },
  cityPartRoofHip: { name: 'City RoofHip', group: 'town', builder: 'cityPartRoofHip', variants: ['standard'], triangles: 60, ...still, vary: SNUG },
  cityPartChimney: { name: 'City Chimney', group: 'town', builder: 'cityPartChimney', variants: ['standard'], triangles: 240, ...still, vary: SNUG },
  cityPartWindow: { name: 'City Window', group: 'town', builder: 'cityPartWindow', variants: ['standard'], triangles: 210, ...still, vary: SNUG },
  cityPartDoor: { name: 'City Door', group: 'town', builder: 'cityPartDoor', variants: ['standard'], triangles: 150, ...still, vary: SNUG },
  cityPartBalcony: { name: 'City Balcony', group: 'town', builder: 'cityPartBalcony', variants: ['standard'], triangles: 190, ...still, vary: SNUG },
  cityPartStair: { name: 'City Stair', group: 'town', builder: 'cityPartStair', variants: ['standard'], triangles: 240, ...still, vary: SNUG },
  cityPartArch: { name: 'City Arch', group: 'town', builder: 'cityPartArch', variants: ['standard'], triangles: 150, ...still, vary: SNUG },
  cityPartAwning: { name: 'City Awning', group: 'town', builder: 'cityPartAwning', variants: ['standard'], triangles: 110, ...still, vary: SNUG },
  cityPartHouse: { name: 'City House', group: 'landmark', builder: 'cityPartHouse', variants: ['standard'], triangles: 4870, ...still, vary: SNUG },
  // act1-rooms-models
  vaultWalls: { name: 'Vault walls', group: 'landmark', builder: 'vaultWalls', variants: ['sluice north', 'sluice west', 'shaft room north', 'shaft room west', 'gallery north', 'gallery walk', 'gallery arena', 'seed shrine', 'seed jars', 'seed rack', 'seed gap', 'seed step'], triangles: 6000, wind: false, light: 8, alwaysLit: true, unlit: [0, 1, 4, 5, 6, 7, 8, 9, 10, 11], vary: SNUG },
  vaultLow: { name: 'Vault low walls', group: 'landmark', builder: 'vaultLow', variants: ['sluice south', 'sluice east', 'shaft room south', 'shaft room east', 'well west', 'well north', 'gallery south', 'gallery east', 'seed'], triangles: 3390, wind: false, light: 0, vary: SNUG },
  vaultFloor: { name: 'Vault floor', group: 'landmark', builder: 'vaultFloor', variants: ['sluice', 'shaft room', 'gallery', 'seed'], triangles: 1710, wind: false, light: 0, vary: SNUG },
  vaultEarth: { name: 'Vault earth', group: 'landmark', builder: 'vaultEarth', variants: ['sluice', 'shaft room', 'gallery', 'seed'], triangles: 4100, wind: false, light: 0, vary: SNUG },
  vaultSconce: { name: 'Vault sconce', group: 'landmark', builder: 'vaultSconce', variants: ['dark', 'lit'], triangles: 420, wind: false, light: 9, alwaysLit: true, unlit: [0], vary: SNUG },
  vaultLamp: { name: 'Sensor lamp', group: 'landmark', builder: 'vaultLamp', variants: ['dark', 'lit', 'post dark', 'post lit'], triangles: 410, wind: false, light: 9, alwaysLit: true, unlit: [0, 2], vary: SNUG },
  vaultEye: { name: 'Glass eye', group: 'landmark', builder: 'vaultEye', variants: ['dark', 'lit'], triangles: 160, wind: false, light: 6, alwaysLit: true, unlit: [0], vary: SNUG },
  vaultBanner: { name: 'Vault banner', group: 'landmark', builder: 'vaultBanner', variants: ['leaf'], triangles: 90, wind: false, light: 0, vary: SNUG },
  vaultPlanter: { name: 'Vault planter', group: 'landmark', builder: 'vaultPlanter', variants: ['trough', 'flowers', 'pot'], triangles: 470, wind: false, light: 0, vary: SNUG },
  vaultJars: { name: 'Seed jars', group: 'landmark', builder: 'vaultJars', variants: ['three', 'row'], triangles: 900, wind: false, light: 0, vary: SNUG },
  vaultShelf: { name: 'Vault shelf', group: 'landmark', builder: 'vaultShelf', variants: ['books', 'jars'], triangles: 3720, wind: false, light: 0, vary: SNUG },
  vaultPier: { name: 'Vault pier', group: 'landmark', builder: 'vaultPier', variants: ['sight', 'cover', 'column', 'pedestal'], triangles: 690, wind: false, light: 0, vary: SNUG },
  vaultDais: { name: 'Reward dais', group: 'landmark', builder: 'vaultDais', variants: ['wide', 'narrow'], triangles: 1060, wind: false, light: 0, vary: SNUG },
  vaultKeystone: { name: 'Keystone', group: 'landmark', builder: 'vaultKeystone', variants: ['round'], triangles: 430, wind: false, light: 0, vary: SNUG },
  vaultChannel: { name: 'Wheel trench', group: 'landmark', builder: 'vaultChannel', variants: ['trench'], triangles: 3960, wind: false, light: 0, vary: SNUG },
  vaultBridge: { name: 'Trench bridge', group: 'landmark', builder: 'vaultBridge', variants: ['span'], triangles: 2500, wind: false, light: 0, vary: SNUG },
  vaultSluice: { name: 'Sluice', group: 'landmark', builder: 'vaultSluice', variants: ['frame'], triangles: 1410, wind: false, light: 0, vary: SNUG },
  vaultOutlet: { name: 'Overflow outlet', group: 'landmark', builder: 'vaultOutlet', variants: ['culvert'], triangles: 980, wind: false, light: 0, vary: SNUG },
  vaultShaft: { name: 'Wheel shaft', group: 'landmark', builder: 'vaultShaft', variants: ['shaft'], triangles: 650, wind: false, light: 0, vary: SNUG },
  vaultBearing: { name: 'Shaft bearing', group: 'landmark', builder: 'vaultBearing', variants: ['bearing'], triangles: 150, wind: false, light: 0, vary: SNUG },
  vaultLever: { name: 'Sluice lever', group: 'landmark', builder: 'vaultLever', variants: ['rest', 'pulled'], triangles: 600, wind: false, light: 0, vary: SNUG },
  vaultStairwell: { name: 'Stairwell', group: 'landmark', builder: 'vaultStairwell', variants: ['well'], triangles: 1150, wind: false, light: 0, vary: SNUG },
  vaultGateway: { name: 'Gallery entrance', group: 'landmark', builder: 'vaultGateway', variants: ['entrance'], triangles: 2820, wind: false, light: 0, vary: SNUG },
  vaultDoor: { name: 'Sealed door', group: 'landmark', builder: 'vaultDoor', variants: ['sealed'], triangles: 2170, wind: false, light: 0, vary: SNUG },
  vaultArm: { name: 'Wild Harvester', group: 'landmark', builder: 'vaultArm', variants: ['base', 'whole'], triangles: 5210, wind: false, light: 0, vary: SNUG },
  vaultPod: { name: 'Root pod', group: 'landmark', builder: 'vaultPod', variants: ['root'], triangles: 2640, wind: false, light: 0, vary: SNUG },
  vaultRoot: { name: 'Vault root', group: 'landmark', builder: 'vaultRoot', variants: ['wall', 'floor', 'crown'], triangles: 1080, wind: false, light: 0, vary: SNUG },
  // act1-city-models
  cityBridge: { name: 'cityBridge', group: 'landmark', builder: 'cityBridge', variants: ['lit', 'unlit', 'span', 'end-lit', 'end-unlit'], triangles: 6000, wind: false, light: 10, unlit: [1, 2, 4], vary: SNUG },
  cityGateway: { name: 'cityGateway', group: 'landmark', builder: 'cityGateway', variants: ['watch'], triangles: 6000, wind: false, light: 10, unlit: [], vary: SNUG },
  cityLowWall: { name: 'cityLowWall', group: 'town', builder: 'cityLowWall', variants: ['run', 'end'], triangles: 300, wind: false, light: 0, unlit: [], vary: SNUG },
  cityStallGoods: { name: 'cityStallGoods', group: 'landmark', builder: 'cityStallGoods', variants: ['honey', 'fiber-cloth', 'bread', 'fish', 'produce', 'pots'], triangles: 400, wind: false, light: 0, unlit: [], vary: SNUG },
  cityHangingGoods: { name: 'cityHangingGoods', group: 'landmark', builder: 'cityHangingGoods', variants: ['onions', 'fish', 'cloth'], triangles: 370, wind: false, light: 0, unlit: [], vary: SNUG },
  cityBaskets: { name: 'cityBaskets', group: 'landmark', builder: 'cityBaskets', variants: ['empty', 'sacks', 'produce'], triangles: 400, wind: false, light: 0, unlit: [], vary: SNUG },
  cityTower: { name: 'cityTower', group: 'landmark', builder: 'cityTower', variants: ['bell'], triangles: 6000, wind: false, light: 10, unlit: [], vary: SNUG },
  cityRoofCluster: { name: 'cityRoofCluster', group: 'landmark', builder: 'cityRoofCluster', variants: ['stepped', 'high-center', 'high-left'], triangles: 1360, wind: false, light: 8, unlit: [], vary: SNUG },
  // act1-hall-models
  hallLamp: { name: 'Hall lamp', group: 'landmark', builder: 'hallLamp', variants: ['dark', 'lit', 'broken'], triangles: 560, wind: false, light: 11, alwaysLit: true, unlit: [0, 2], vary: SNUG },
  homeDinnerTable: { name: 'Dinner table module', group: 'station', builder: 'homeDinnerTable', variants: ['module'], triangles: 290, wind: false, light: 0, vary: SNUG },
  homeBench: { name: 'Bench', group: 'station', builder: 'homeBench', variants: ['bench'], triangles: 130, wind: false, light: 0, vary: SNUG },
  homeChair: { name: 'Dinner chair', group: 'station', builder: 'homeChair', variants: ['chair'], triangles: 180, wind: false, light: 0, vary: SNUG },
  hallCourt: { name: 'Raised court', group: 'landmark', builder: 'hallCourt', variants: ['standard'], triangles: 3160, ...still, vary: SNUG },
  hallRill: { name: 'Water rill quarter', group: 'landmark', builder: 'hallRill', variants: ['standard'], triangles: 900, ...still, vary: SNUG },
  hallRillBridge: { name: 'Rill bridge', group: 'landmark', builder: 'hallRillBridge', variants: ['standard'], triangles: 870, ...still, vary: SNUG },
  hallArch: { name: 'Surviving hall arch', group: 'landmark', builder: 'hallArch', variants: ['standard'], triangles: 2660, ...still, vary: SNUG },
  hallMural: { name: 'Eight niches', group: 'landmark', builder: 'hallMural', variants: ['standard'], triangles: 6000, ...still, vary: SNUG },
  memoryStone: { name: 'Memory Stone', group: 'landmark', builder: 'memoryStone', variants: ['standard'], triangles: 230, ...still, vary: SNUG },
  custodianPlinth: { name: 'Custodian plinth', group: 'landmark', builder: 'custodianPlinth', variants: ['standard'], triangles: 890, ...still, vary: SNUG },
  fieldBookStand: { name: 'Field book stand', group: 'station', builder: 'fieldBookStand', variants: ['standard'], triangles: 170, ...still, vary: SNUG },
  deadGate: { name: 'Dormant gate', group: 'landmark', builder: 'deadGate', variants: ['standard'], triangles: 2400, ...still, vary: SNUG },
  hallWall: { name: 'Hall wall', group: 'landmark', builder: 'hallWall', variants: ['run', 'end'], triangles: 1060, ...still, vary: SNUG },
  dinnerLanternPole: { name: 'Dinner lantern pole', group: 'station', builder: 'dinnerLanternPole', variants: ['lit', 'unlit'], triangles: 290, wind: false, light: 10, alwaysLit: true, unlit: [1], vary: SNUG },
  dinnerSpread: { name: 'Dinner spread', group: 'station', builder: 'dinnerSpread', variants: ['standard'], triangles: 300, ...still, vary: SNUG },
  // act1-wilds-kit-forest
  forestSnag: { name: 'forestSnag', group: 'landmark', builder: 'forestSnag', variants: ['green', 'grey'], triangles: 2130, wind: false, light: 0, vary: SNUG },
  forestHollowTrunk: { name: 'forestHollowTrunk', group: 'landmark', builder: 'forestHollowTrunk', variants: ['green', 'grey'], triangles: 2970, wind: false, light: 0, vary: SNUG },
  forestStumps: { name: 'forestStumps', group: 'landmark', builder: 'forestStumps', variants: ['green', 'grey'], triangles: 1000, wind: false, light: 0, vary: SNUG },
  forestRootFan: { name: 'forestRootFan', group: 'landmark', builder: 'forestRootFan', variants: ['standard'], triangles: 1650, wind: false, light: 0, vary: SNUG },
  forestMushrooms: { name: 'forestMushrooms', group: 'landmark', builder: 'forestMushrooms', variants: ['standard'], triangles: 700, wind: false, light: 0, vary: SNUG },
  forestMossMound: { name: 'forestMossMound', group: 'clutter', builder: 'forestMossMound', variants: ['standard'], triangles: 170, wind: false, light: 0, vary: SNUG },
  forestBranch: { name: 'forestBranch', group: 'landmark', builder: 'forestBranch', variants: ['standard'], triangles: 430, wind: false, light: 0, vary: SNUG },
  forestRocks: { name: 'forestRocks', group: 'landmark', builder: 'forestRocks', variants: ['standard'], triangles: 1830, wind: false, light: 0, vary: SNUG },
  forestVines: { name: 'forestVines', group: 'landmark', builder: 'forestVines', variants: ['standard'], triangles: 880, wind: false, light: 0, vary: SNUG },
  forestBeeComb: { name: 'forestBeeComb', group: 'landmark', builder: 'forestBeeComb', variants: ['standard'], triangles: 600, wind: false, light: 0, vary: SNUG },
  forestWall: { name: 'forestWall', group: 'landmark', builder: 'forestWall', variants: ['standard'], triangles: 2340, wind: false, light: 0, vary: SNUG },
  forestStatue: { name: 'forestStatue', group: 'landmark', builder: 'forestStatue', variants: ['standard'], triangles: 5700, wind: false, light: 0, vary: SNUG },
  forestGatePost: { name: 'forestGatePost', group: 'landmark', builder: 'forestGatePost', variants: ['standard'], triangles: 1640, wind: false, light: 0, vary: SNUG },
  forestShrineRing: { name: 'forestShrineRing', group: 'landmark', builder: 'forestShrineRing', variants: ['standard'], triangles: 1870, wind: false, light: 0, vary: SNUG },
  greyBrush: { name: 'greyBrush', group: 'landmark', builder: 'greyBrush', variants: ['standard'], triangles: 700, wind: false, light: 0, vary: SNUG },
  greyDrift: { name: 'greyDrift', group: 'clutter', builder: 'greyDrift', variants: ['standard'], triangles: 100, wind: false, light: 0, vary: SNUG },
  greyDen: { name: 'greyDen', group: 'landmark', builder: 'greyDen', variants: ['standard'], triangles: 4380, wind: false, light: 0, vary: SNUG },
  wrenCamp: { name: 'wrenCamp', group: 'landmark', builder: 'wrenCamp', variants: ['standard'], triangles: 2000, wind: false, light: 0, vary: SNUG },
} as const satisfies Record<string, PropDef>;

export type PropKind = keyof typeof PROPS;

export const PROP_KINDS = Object.keys(PROPS) as PropKind[];

/** The entry for a kind. It throws on a name that is not in the table, so a typo fails early. */
export function propDef(kind: string): PropDef {
  const def: PropDef | undefined = (PROPS as Record<string, PropDef>)[kind];
  if (!def) throw new Error(`no prop called ${kind}`);
  return def;
}

/** The block light one variant of a kind gives, 0 to 15. 0 for a variant that is unlit. */
export function propLight(kind: string, variant: number): number {
  const def = propDef(kind);
  if (def.unlit?.includes(variant)) return 0;
  return def.lights?.[variant] ?? def.light;
}
