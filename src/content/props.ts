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
  rigSnare: { name: 'Snare vine', group: 'station', builder: 'rigSnare', variants: ['armed'], triangles: 180, ...still, vary: WILD },
  rigSnareSpent: { name: 'Closed snare vine', group: 'station', builder: 'rigSnareSpent', variants: ['spent'], triangles: 300, ...still, vary: WILD },

  rigLamp: { name: 'Lure lamp', group: 'station', builder: 'rigLamp', variants: ['armed'], triangles: 170, wind: false, light: 13, alwaysLit: true, vary: SNUG },
  rigLampSpent: { name: 'Spent lure lamp', group: 'station', builder: 'rigLampSpent', variants: ['spent'], triangles: 190, ...still, vary: SNUG },

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
} as const satisfies Record<string, PropDef>;

export type PropKind = keyof typeof PROPS;

export const PROP_KINDS = Object.keys(PROPS) as PropKind[];

/** The entry for a kind. It throws on a name that is not in the table, so a typo fails early. */
export function propDef(kind: string): PropDef {
  const def: PropDef | undefined = (PROPS as Record<string, PropDef>)[kind];
  if (!def) throw new Error(`no prop called ${kind}`);
  return def;
}
