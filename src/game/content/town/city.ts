// Hollowmere grown into a city, round the old town of b.ts: the plan of `assets-src/concept/region-hollowmere/plan.webp`
// fitted to the land. The old town (the Hollow Oak, the Lantern Green, the main street, the quay, the kennel and the
// ferry) stays as it is, a nucleus 75 blocks a side. Round it:
//
//   - the civic heart north of the main street: the granary (B10, in the old granary-hall's place, so Maren's place
//     keeps its door) and across Civic Street the Queen's Hall (B15), whose porch takes the ledger's deliveries
//   - the chapel quarter north of that, the Order's white chapel on its square, and the north road out of town
//   - the market square east of the old town, where the main street goes on as Market Street to the fields
//   - the quay and its warehouses east along the river from the old quay, with docks, boats and a crane
//   - the artisans in the south-east: the lamp house, the wheelwright's yard, workshops
//   - the working mill on a race from the Mere, west of the hedge
//   - homes everywhere else, and the edge fields east of town, each with one of the Order's brass pumps
//
// The river bends round the west and the south of the town, so the plan's south quarters fold into the quay and
// the city grows north and east: about 180 blocks east to west and 130 north to south, fields beyond.
//
// The streets and the big buildings are placed by hand. Then every street's frontage is filled with houses of the
// city kit (src/content/props.ts, `city*`), each facing its street, a block back from it, with a gap between, from
// a palette by district. It never builds in the river, the old town, the chapel's ground or a street. The same
// numbers come out every time, so the page, the chunk worker and a test make the same city.
//
// The buildings and pieces are drawn by src/game/views/world-city.view.ts. In the world each building is two
// blocks of invisible barrier over its footprint, as a model of the town kit is.

import { landmarkSites } from '../../region/greenhollow-land.sim.ts';
import { riverBank } from '../../region/greenhollow.sim.ts';
import { CITY_FIELDS, toWorld } from '../greenhollow.ts';
import type { Fill, Level, PlanPlace, PlanTree, Rect } from '../region.ts';
import { TOWN_GROUND } from './kit.ts';

/** The buildings of the city kit, with the box each model's geometry fills, measured, in its own space (front +z). */
export const CITY_KIT = {
  cityCottage: { x: [-3.6, 3.6], z: [-2.4, 2.8], h: 6 },
  cityFamilyHouse: { x: [-4.5, 4.5], z: [-3.5, 4.0], h: 7 },
  cityLongHouse: { x: [-5.0, 5.0], z: [-3.0, 3.9], h: 6 },
  cityTallHouse: { x: [-4.0, 4.0], z: [-3.5, 3.9], h: 9 },
  cityMerchantRowHouse: { x: [-3.1, 3.1], z: [-4.4, 5.1], h: 12 },
  cityCornerShop: { x: [-4.9, 4.9], z: [-4.9, 5.3], h: 11 },
  cityBakery: { x: [-5.0, 5.0], z: [-3.5, 4.0], h: 7 },
  cityGuildLodge: { x: [-6.0, 6.0], z: [-4.5, 5.0], h: 9 },
  cityWorkshop: { x: [-5.0, 5.0], z: [-3.5, 4.0], h: 7 },
  cityGranary: { x: [-6.8, 6.8], z: [-4.8, 6.0], h: 14 },
  cityWarehouse: { x: [-6.0, 6.0], z: [-7.5, 7.9], h: 11 },
  cityLampHouse: { x: [-4.0, 4.0], z: [-3.5, 4.0], h: 8 },
  cityWheelwrightYard: { x: [-6.6, 6.6], z: [-5.4, 5.6], h: 8 },
  cityTownMill: { x: [-6.2, 6.8], z: [-5.8, 5.8], h: 12 },
  cityCivicHall: { x: [-9.8, 9.8], z: [-5.7, 6.8], h: 16 },
  cityCourtyardTenement: { x: [-7.0, 7.0], z: [-7.0, 6.8], h: 12 },
} as const;
export type CityModel = keyof typeof CITY_KIT;

export interface CityBuilding {
  id: string;
  model: CityModel;
  /** Where the model's origin stands, in meters. */
  x: number;
  z: number;
  /** Quarter turns, counter-clockwise from facing south: 1 faces east, 3 west. */
  turns: number;
  /** The columns of its footprint, both ends inside. */
  x0: number; z0: number; x1: number; z1: number;
  /** How tall it is. */
  h: number;
  /** The column in front of its door. */
  door: { x: number; z: number };
}

/** A piece of the street or quay kit, or a pump or a stall: a prop of src/content/props.ts set down. */
export interface CityPiece {
  model: string;
  /** The name of one of its variants. */
  variant: string;
  x: number;
  y: number;
  z: number;
  /** Radians round y. At 0 its front faces south. */
  rotation: number;
}

export interface CityPlan {
  buildings: CityBuilding[];
  pieces: CityPiece[];
  fills: Fill[];
  levels: Level[];
  basins: (Rect & { ground: number })[];
  places: PlanPlace[];
  trees: PlanTree[];
  /** The streets, paved. */
  streets: Rect[];
  /** The whole city with its fields: nothing here can be dug or built on by the player, and no wild tree grows. */
  bounds: Rect;
  /** The built city without the fields. */
  core: Rect;
  /** The edge fields, in game columns. */
  fields: Rect[];
}

/** The old town of b.ts, which the city builds round and never into. */
export const NUCLEUS: Rect = { x0: 129, z0: -192, x1: 206, z1: -118 };
/** The built city, and the city with its edge fields. */
const CORE: Rect = { x0: 108, z0: -247, x1: 291, z1: -114 };
const g = TOWN_GROUND, top = g - 1;
/** The deck of a dock: a block over the water. */
const WATER_DECK = 19;

// ------------------------------------------------------------------------------------------ the streets

type Paving = 'cobble' | 'stone_brick' | 'path';
interface Street extends Rect { paving: Paving; name: string }
const street = (name: string, x0: number, z0: number, x1: number, z1: number, paving: Paving): Street => ({ name, x0, z0, x1, z1, paving });

/**
 * The streets, west to east and north to south. Main streets are 8 wide, the others 6, lanes 4. Market Street
 * carries on the old town's main street (z -175 to -173) east to the fields.
 */
const STREETS: readonly Street[] = [
  street('market', 205, -178, 291, -171, 'cobble'),
  street('civic', 126, -201, 291, -196, 'cobble'),
  street('east-gate', 206, -247, 211, -127, 'cobble'),
  street('chapel', 168, -247, 173, -202, 'cobble'),
  street('weaver', 248, -247, 253, -135, 'cobble'),
  street('east-lane', 287, -247, 290, -136, 'path'),
  street('north-lane-w', 140, -220, 167, -217, 'path'),
  street('north-lane-e', 212, -220, 286, -217, 'path'),
  street('alley-north', 228, -247, 231, -202, 'path'),
  street('alley-east', 268, -247, 271, -157, 'path'),
  street('artisan', 212, -156, 286, -153, 'path'),
  street('west-lane', 129, -201, 132, -137, 'path'),
  street('mill-yard', 114, -163, 128, -160, 'path'),
  // The quay promenade, on from the old quay at z -131 to -129, along the river to the Pump House's path.
  street('quay', 204, -134, 268, -127, 'stone_brick'),
  street('quay-link', 200, -131, 205, -129, 'stone_brick'),
  // The squares.
  street('market-square', 213, -185, 247, -165, 'stone_brick'),
  street('chapel-square', 174, -226, 198, -202, 'stone_brick'),
];

/** The mill race, and the harbour dug along the quay so its wall stands in deep water. */
const BASINS: readonly (Rect & { ground: number })[] = [
  { x0: 104, z0: -157, x1: 117, z1: -148, ground: 15 },
  { x0: 203, z0: -126, x1: 268, z1: -114, ground: 15 },
  // The bar of sand off the old quay's east end, dredged so the river meets the harbour.
  { x0: 180, z0: -119, x1: 214, z1: -113, ground: 15 },
];

// ------------------------------------------------------------------------------------------ the land under it

/** A small, fixed random: the same numbers in the page, the worker and a test. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GX0 = 96, GZ0 = -262, GW = 260, GH = 160;
const FREE = 0, STREET = 1, BUILT = 2, KEEP = 3;

/** What each column of the city's grid is taken by. */
function grid(): Uint8Array {
  const cells = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = GX0 + i, z = GZ0 + j;
    const inCore = x >= CORE.x0 && x <= CORE.x1 && z >= CORE.z0 && z <= CORE.z1;
    // Three blocks off the river's bank, nothing is built: the bank, the reeds, the water.
    if (!inCore || riverBank(x + 0.5, z + 0.5) < 4) cells[j * GW + i] = KEEP;
    else if (x >= NUCLEUS.x0 && x <= NUCLEUS.x1 && z >= NUCLEUS.z0 && z <= NUCLEUS.z1) cells[j * GW + i] = KEEP;
  }
  // Every landmark of the plan that stands in town (the chapel, a waystone), and a little round it.
  for (const s of landmarkSites()) {
    if (s.x < CORE.x0 - 10 || s.x > CORE.x1 + 10 || s.z < CORE.z0 - 10 || s.z > CORE.z1 + 10) continue;
    keep(cells, { x0: Math.floor(s.x - s.hx) - 2, z0: Math.floor(s.z - s.hz) - 2, x1: Math.ceil(s.x + s.hx) + 1, z1: Math.ceil(s.z + s.hz) + 1 });
  }
  // The road in from your plot over the bridge to the hedge gate (REGION.paths in region.ts), with its verges.
  for (let k = 0; k + 1 < APPROACH.length; k++) {
    const [ax, az] = APPROACH[k], [bx, bz] = APPROACH[k + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(ax + ((bx - ax) * i) / n), z = Math.round(az + ((bz - az) * i) / n);
      keep(cells, { x0: x - 4, z0: z - 4, x1: x + 4, z1: z + 4 });
    }
  }
  for (const s of STREETS) mark(cells, s, STREET);
  return cells;
}
/** The road in from the bridge to the hedge gate: the end of the path of region.ts. */
const APPROACH: readonly (readonly [number, number])[] = [[92, -221], [126, -177], [137, -174]];
function mark(cells: Uint8Array, r: Rect, value: number): void {
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
    const i = x - GX0, j = z - GZ0;
    if (i >= 0 && j >= 0 && i < GW && j < GH) cells[j * GW + i] = value;
  }
}
const keep = (cells: Uint8Array, r: Rect): void => mark(cells, r, KEEP);
const cellAt = (cells: Uint8Array, x: number, z: number): number => {
  const i = x - GX0, j = z - GZ0;
  return i >= 0 && j >= 0 && i < GW && j < GH ? cells[j * GW + i] : KEEP;
};

// ------------------------------------------------------------------------------------------ setting a building down

/** The box a model fills once turned, round its origin. */
function turnedBox(model: CityModel, turns: number): { x: [number, number]; z: [number, number] } {
  const k = CITY_KIT[model];
  switch (((turns % 4) + 4) % 4) {
    case 1: return { x: [k.z[0], k.z[1]], z: [-k.x[1], -k.x[0]] };
    case 2: return { x: [-k.x[1], -k.x[0]], z: [-k.z[1], -k.z[0]] };
    case 3: return { x: [-k.z[1], -k.z[0]], z: [k.x[0], k.x[1]] };
    default: return { x: [k.x[0], k.x[1]], z: [k.z[0], k.z[1]] };
  }
}

/** The way each quarter turn faces, as a step in x and z. */
const FACING: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

function footprint(model: CityModel, x: number, z: number, turns: number): Rect {
  const b = turnedBox(model, turns);
  // A column is inside when most of it is under the model.
  return { x0: Math.round(x + b.x[0]), x1: Math.round(x + b.x[1]) - 1, z0: Math.round(z + b.z[0]), z1: Math.round(z + b.z[1]) - 1 };
}

function building(id: string, model: CityModel, x: number, z: number, turns: number): CityBuilding {
  const f = footprint(model, x, z, turns), b = turnedBox(model, turns);
  const [fx, fz] = FACING[((turns % 4) + 4) % 4];
  // The column just past the middle of its front.
  const front = fx > 0 ? x + b.x[1] : fx < 0 ? x + b.x[0] : fz > 0 ? z + b.z[1] : z + b.z[0];
  const door = fx !== 0 ? { x: Math.floor(front + fx * 0.5 + (fx > 0 ? 0.5 : -0.5)), z: Math.floor(z) } : { x: Math.floor(x), z: Math.floor(front + fz * 0.5 + (fz > 0 ? 0.5 : -0.5)) };
  return { id, model, x, z, turns: ((turns % 4) + 4) % 4, ...f, h: CITY_KIT[model].h, door };
}

/**
 * True when nothing stands on the footprint, nor in a ring a block wide round it but streets. A terrace house
 * (`party`) may share its side walls with its neighbours: only its front and back keep their ring.
 */
function fits(cells: Uint8Array, f: Rect, party = false, across = true): boolean {
  for (let z = f.z0 - 1; z <= f.z1 + 1; z++) for (let x = f.x0 - 1; x <= f.x1 + 1; x++) {
    const c = cellAt(cells, x, z), ring = x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1;
    const side = across ? (x < f.x0 || x > f.x1) && z >= f.z0 && z <= f.z1 : (z < f.z0 || z > f.z1) && x >= f.x0 && x <= f.x1;
    if (ring ? c === BUILT && !(party && side) : c !== FREE) return false;
  }
  return true;
}

// ------------------------------------------------------------------------------------------ the palettes

/** Which houses each district builds, and how often. */
const PALETTES: Readonly<Record<string, readonly (readonly [CityModel, number])[]>> = {
  homes: [['cityFamilyHouse', 3], ['cityCottage', 2], ['cityLongHouse', 2], ['cityTallHouse', 2], ['cityCourtyardTenement', 1]],
  market: [['cityMerchantRowHouse', 6], ['cityTallHouse', 2], ['cityBakery', 1], ['cityLongHouse', 1], ['cityFamilyHouse', 1]],
  west: [['cityTallHouse', 2], ['cityFamilyHouse', 2], ['cityMerchantRowHouse', 3], ['cityCottage', 2], ['cityGuildLodge', 1]],
  artisan: [['cityWorkshop', 3], ['cityLongHouse', 1], ['cityCottage', 1], ['cityFamilyHouse', 1]],
  quay: [['cityWarehouse', 1], ['cityLongHouse', 1], ['cityWorkshop', 1]],
  north: [['cityFamilyHouse', 2], ['cityTallHouse', 2], ['cityCottage', 2], ['cityMerchantRowHouse', 3], ['cityCourtyardTenement', 1]],
};

function districtOf(x: number, z: number): keyof typeof PALETTES {
  if (z > -153 && x > 206) return 'quay';
  if (x > 247 && z > -170) return 'artisan';
  if (z > -192 && z < -152 && x > 206) return 'market';
  if (x < 168) return 'west';
  if (z < -201) return 'north';
  return 'homes';
}

function pick(palette: readonly (readonly [CityModel, number])[], roll: number): CityModel {
  const total = palette.reduce((sum, [, w]) => sum + w, 0);
  let at = roll * total;
  for (const [model, weight] of palette) { at -= weight; if (at < 0) return model; }
  return palette[palette.length - 1][0];
}

// ------------------------------------------------------------------------------------------ the plan

let made: CityPlan | null = null;
let lastCells: Uint8Array | null = null;
/** What each column round the city was taken by once the plan was made: 0 free, 1 street, 2 built, 3 kept clear. For a test or a map. */
export function cityCells(): { cells: Uint8Array; x0: number; z0: number; w: number; h: number } {
  cityPlan();
  return { cells: lastCells as Uint8Array, x0: GX0, z0: GZ0, w: GW, h: GH };
}

/** Hollowmere's city, made once. */
export function cityPlan(): CityPlan {
  if (made) return made;
  const cells = grid();
  // The mill race and the harbour along the quay are water, dug out of the bank.
  for (const r of BASINS) keep(cells, { x0: r.x0, z0: r.z0 - 1, x1: r.x1, z1: r.z1 });
  const buildings: CityBuilding[] = [], pieces: CityPiece[] = [], fills: Fill[] = [], places: PlanPlace[] = [], trees: PlanTree[] = [];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: string): void => {
    fills.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), block });
  };
  const put = (b: CityBuilding, over = false): CityBuilding => {
    // A building placed by hand must not stand on a street, the river, the old town or another building.
    if (!over) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
      if (cellAt(cells, x, z) !== FREE) throw new Error(`the city's ${b.id} stands on taken ground at ${x}, ${z}`);
    }
    buildings.push(b);
    mark(cells, b, BUILT);
    return b;
  };
  const place = (name: string, x: number, z: number, label = ''): void => { places.push({ name, x, y: g, z, label }); };
  const piece = (model: string, x: number, z: number, rotation = 0, variant = '', y = g): void => { pieces.push({ model, variant, x, y, z, rotation }); };
  /** A piece nobody walks through: two blocks of barrier over the columns under it. */
  const solid = (x0: number, z0: number, x1: number, z1: number): void => box(x0, g, z0, x1, g + 1, z1, 'barrier');
  /** A lamp at a column, with its light at the height of its glass. */
  const lamp = (x: number, z: number, rotation = 0): void => {
    piece('cityLamp', x + 0.5, z + 0.5, rotation);
    box(x, g + 2, z, x, g + 2, z, 'lantern_light');
  };

  // ---- the streets, paved: in runs along each row, so no paving is ever laid on the river
  for (const s of STREETS) for (let z = s.z0; z <= s.z1; z++) {
    let run = -1;
    for (let x = s.x0; x <= s.x1 + 1; x++) {
      const dry = x <= s.x1 && riverBank(x + 0.5, z + 0.5) > 1;
      if (dry && run < 0) run = x;
      if (!dry && run >= 0) { box(run, top, z, x - 1, top, z, s.paving); run = -1; }
    }
  }

  // ---- the civic heart: the granary in the old granary-hall's place, and the Queen's Hall across Civic Street
  const granary = put(building('granary', 'cityGranary', 158, -182, 0), true);
  place('granary', granary.door.x, granary.door.z, 'Granary');
  place('town.granary', granary.door.x, granary.door.z);
  const hall = put(building('queens-hall', 'cityCivicHall', 156, -201 - 1 - CITY_KIT.cityCivicHall.z[1], 0));
  place('town.hall', hall.door.x, -199, 'Queen\'s Hall');
  // Banners either side of the porch, and the queue's benches.
  piece('cityBanner', 149.5, -201.5, 0);
  piece('cityBanner', 162.5, -201.5, 0);

  // ---- the mill, on its race from the Mere, west of the hedge: its wheel to the river
  // Its wheel stands over the race, so it is set down over the water on purpose.
  const mill = put(building('mill', 'cityTownMill', 121, -152, 2), true);
  place('town.mill', 120, -161, 'Mill');
  // ---- the quay: two warehouses on the promenade, their doors to the water
  const warehouseZ = -134 - 1 - CITY_KIT.cityWarehouse.z[1];
  for (const [i, x] of [219, 239].entries()) put(building(`warehouse-${i}`, 'cityWarehouse', x, warehouseZ, 0));
  place('town.quay', 244, -130, 'Quay');
  // ---- the artisans: the wheelwright's yard and the lamp house, on the artisan lane
  const lane = STREETS.find((s) => s.name === 'artisan')!;
  const wheel = put(building('wheelwright', 'cityWheelwrightYard', 262, lane.z1 + 2 + CITY_KIT.cityWheelwrightYard.z[1], 2));
  place('town.wheelwright', wheel.door.x, lane.z1, 'Wheelwright');
  const lampHouse = put(building('lamphouse', 'cityLampHouse', 278, lane.z1 + 2 + CITY_KIT.cityLampHouse.z[1], 2));
  place('town.lamphouse', lampHouse.door.x, lane.z1, 'Lamp House');
  // ---- the inn of the west quarter (B08's lodge), on Civic Street beside the Queen's Hall
  put(building('inn', 'cityGuildLodge', 139, -201 - 1 - CITY_KIT.cityGuildLodge.z[1], 0));
  // ---- the corners of the main streets: shops with two faces
  put(building('corner-1', 'cityCornerShop', 218, -201 - 1 - CITY_KIT.cityCornerShop.z[1], 0));
  put(building('corner-2', 'cityCornerShop', 260, -171 + 2 + CITY_KIT.cityCornerShop.z[1], 2));
  put(building('corner-3', 'cityCornerShop', 260, -201 - 1 - CITY_KIT.cityCornerShop.z[1], 0));

  // ---- every street's frontage, filled with houses facing it
  const rng = random(173);
  const sides: { s: Street; side: 'n' | 's' | 'e' | 'w' }[] = [];
  for (const s of STREETS) {
    if (s.name.endsWith('square') || s.name === 'mill-yard') continue;
    const across = s.x1 - s.x0 > s.z1 - s.z0;
    if (across) sides.push({ s, side: 'n' }, { s, side: 's' });
    else sides.push({ s, side: 'w' }, { s, side: 'e' });
  }
  // The squares' own sides too: shops face the market, homes the chapel.
  for (const name of ['market-square', 'chapel-square']) {
    const s = STREETS.find((q) => q.name === name)!;
    sides.push({ s, side: 'n' }, { s, side: 's' }, { s, side: 'w' }, { s, side: 'e' });
  }
  let n = 0;
  for (const { s, side } of sides) {
    const along = side === 'n' || side === 's';
    const from = along ? s.x0 : s.z0, to = along ? s.x1 : s.z1;
    const turns = side === 'n' ? 0 : side === 'w' ? 1 : side === 's' ? 2 : 3;
    let at = from + 1;
    while (at < to) {
      const district = districtOf(along ? at + 4 : side === 'w' ? s.x0 - 6 : s.x1 + 6, along ? (side === 'n' ? s.z0 - 6 : s.z1 + 6) : at + 4);
      const model = pick(PALETTES[district], rng());
      const b = turnedBox(model, turns), k = CITY_KIT[model];
      // The front a block back from the street's edge.
      let x: number, z: number;
      if (side === 'n') { x = at - b.x[0]; z = s.z0 - 1 - k.z[1]; }
      else if (side === 's') { x = at - b.x[0]; z = s.z1 + 2 + k.z[1]; }
      else if (side === 'w') { z = at - b.z[0]; x = s.x0 - 1 - k.z[1]; }
      else { z = at - b.z[0]; x = s.x1 + 2 + k.z[1]; }
      // Whole blocks for the origin, so the footprint lies on the grid as the measured box does.
      x = Math.round(x * 2) / 2; z = Math.round(z * 2) / 2;
      const f = footprint(model, x, z, turns);
      // Row houses stand in terraces, wall to wall, as the concept's B05 asks.
      const party = model === 'cityMerchantRowHouse';
      if (fits(cells, f, party, along)) {
        put(building(`house-${n++}`, model, x, z, turns));
        const width = along ? f.x1 - f.x0 + 1 : f.z1 - f.z0 + 1;
        // A gap between houses: mostly one block, sometimes a garden or an alley. None in a terrace.
        const r = rng();
        at += width + (party && r < 0.75 ? 0 : r < 0.7 ? 1 : r < 0.9 ? 2 : 3);
      } else at += 1;
    }
  }

  // ---- the backs of the blocks: where a house still fits behind the frontage, one is built facing the nearest
  // street, reached down a passage between the front houses, so the blocks fill in as an old town's do, with yards
  // and gardens left between
  const infill = random(911);
  for (let z = CORE.z0 + 2; z <= CORE.z1 - 2; z += 2) for (let x = CORE.x0 + 2; x <= CORE.x1 - 2; x += 2) {
    if (cellAt(cells, x, z) !== FREE || infill() < 0.35) continue;
    // The nearest street in each of the four ways, within 24 blocks.
    let best = -1, bestD = 25;
    for (let t = 0; t < 4; t++) {
      const [fx, fz] = FACING[t];
      for (let d = 1; d < bestD; d++) {
        const c = cellAt(cells, x + fx * d, z + fz * d);
        if (c === STREET) { best = t; bestD = d; break; }
        if (c === KEEP) break;
      }
    }
    if (best < 0) continue;
    const district = districtOf(x, z);
    const model = pick(district === 'market' || district === 'quay' ? PALETTES.homes : PALETTES[district], infill());
    const f = footprint(model, x, z, best);
    if (fits(cells, f)) put(building(`back-${n++}`, model, x, z, best));
  }

  // ---- the solid footprints: two blocks of barrier over each building, its yard's open ground left open
  for (const b of buildings) {
    if (b.model === 'cityTownMill') {
      // The mill's body only; its wheel stands over the race.
      const body = footprint('cityTownMill', mill.x, mill.z, mill.turns);
      solid(body.x0 + 4, body.z0, body.x1, body.z1);
      continue;
    }
    solid(b.x0, b.z0, b.x1, b.z1);
  }

  // ---- a light over every doorstep, for the lantern by the door and the glow of the windows
  for (const b of buildings) box(b.door.x, g + 2, b.door.z, b.door.x, g + 2, b.door.z, 'lantern_light');

  // ---- the mill race: the Mere led to the wheel
  // ---- the quay: deep water along the promenade, its wall, docks, boats and the cargo it handles
  for (let x = 204; x <= 266; x += 4) piece('cityQuayWall', x, -128, 0, '', g - 4);
  for (let x = 206; x <= 266; x += 8) piece('cityBollard', x + 0.5, -127.5);
  for (const [i, x] of [226, 246].entries()) {
    // A dock out over the water, on planks you can walk, with a boat tied beside it.
    for (let k = 0; k < 3; k++) {
      piece('cityDock', x + 0.5, -124 + k * 3, Math.PI / 2, k === 2 ? 'end' : 'run', WATER_DECK);
      box(x - 1, WATER_DECK - 1, -125 + k * 3, x + 1, WATER_DECK - 1, -123 + k * 3, 'oak_plank');
    }
    piece('cityCargoBoat', x + 4.5, -120, 0.04 * (i ? -1 : 1), '', WATER_DECK - 1.6);
    piece('citySkiff', x - 3.5, -121, 0.1, '', WATER_DECK - 1.3);
    piece('cityGangplank', x + 2.5, -121, Math.PI / 2, '', WATER_DECK - 0.4);
  }
  piece('cityCrane', 254.5, -129.5, Math.PI);
  solid(253, -131, 255, -129);
  for (const [x, z] of [[214, -132], [215, -132], [231, -133], [240, -132], [241, -132], [257, -133]] as const) piece('cityBarrel', x + 0.5, z + 0.5, x * 0.7);
  for (const [x, z] of [[213, -133], [230, -132], [230, -133], [256, -132]] as const) piece('cityCrate', x + 0.5, z + 0.5, z * 0.3);
  piece('cityNetRack', 266, -133.5, 0);

  // ---- the market square: two rows of stalls with the way through between, the fountain at the north row's middle
  const sq = STREETS.find((s) => s.name === 'market-square')!;
  for (let x = sq.x0 + 3; x <= sq.x1 - 3; x += 4) {
    const north = Math.abs(x + 1 - (sq.x0 + sq.x1) / 2) > 3;
    if (north) {
      piece('cityStall', x + 1.5, sq.z0 + 2.5, 0, (x >> 2) % 2 ? 'saffron' : 'cream');
      solid(x, sq.z0 + 1, x + 2, sq.z0 + 3);
    }
    piece('cityStall', x + 1.5, sq.z1 - 1.5, Math.PI, (x >> 2) % 2 ? 'cream' : 'saffron');
    solid(x, sq.z1 - 3, x + 2, sq.z1 - 1);
  }
  const fountain = { x: Math.floor((sq.x0 + sq.x1) / 2), z: sq.z0 + 3 };
  piece('cityFountain', fountain.x + 0.5, fountain.z + 0.5, 0);
  solid(fountain.x - 2, fountain.z - 2, fountain.x + 2, fountain.z + 2);
  for (const x of [sq.x0, sq.x1]) for (const z of [sq.z0, sq.z1]) lamp(x, z);
  piece('cityStringLights', (sq.x0 + sq.x1) / 2 + 0.5, (sq.z0 + sq.z1) / 2 + 0.5, Math.PI / 2);
  for (let z = -176; z <= -172; z += 2) box(Math.floor((sq.x0 + sq.x1) / 2), g + 3, z, Math.floor((sq.x0 + sq.x1) / 2), g + 3, z, 'lantern_light');
  place('town.market', fountain.x, -175, 'Market');
  for (const [x, z, r] of [[sq.x0 + 6, sq.z0 + 6, 0], [sq.x1 - 6, sq.z1 - 4, Math.PI]] as const) piece('cityBench', x + 0.5, z + 0.5, r);

  // ---- the chapel square: the town's other well, benches under lamps, planters at the chapel's steps
  const cs = STREETS.find((s) => s.name === 'chapel-square')!;
  piece('cityWell', 190.5, -212.5, 0);
  solid(188, -215, 192, -211);
  for (const [x, z] of [[176, -224], [196, -224], [176, -204], [196, -204]] as const) lamp(x, z);
  piece('cityPlanter', 177.5, -225.5, 0);
  piece('cityPlanter', 183.5, -225.5, 0);
  piece('cityBench', 182.5, -207.5, Math.PI);
  piece('cityBench', 194.5, -219.5, -Math.PI / 2);
  place('town.chapel', 181, -219);
  void cs;

  // ---- lamps down every street, either side in turn, about every 14 blocks
  for (const s of STREETS) {
    if (s.name.endsWith('square')) continue;
    const across = s.x1 - s.x0 > s.z1 - s.z0;
    const length = across ? s.x1 - s.x0 : s.z1 - s.z0;
    for (let k = 7, side = 0; k < length - 3; k += 14, side ^= 1) {
      const x = across ? s.x0 + k : side ? s.x1 : s.x0, z = across ? (side ? s.z1 : s.z0) : s.z0 + k;
      if (cellAt(cells, x, z) !== STREET) continue;
      lamp(x, z, across ? (side ? Math.PI : 0) : side ? -Math.PI / 2 : Math.PI / 2);
    }
  }

  // ---- life at the doors: barrels and crates by the workshops and warehouses, planters and benches by the homes
  const dress = random(2207);
  for (const b of buildings) {
    if (b.model === 'cityGranary' || b.model === 'cityCivicHall' || b.model === 'cityTownMill') continue;
    const r = dress();
    if (r > 0.55) continue;
    const [fx, fz] = FACING[b.turns];
    // Beside the door, on the block between the front and the street.
    const side = (dress() < 0.5 ? -1 : 1) * 2.5;
    const x = b.door.x + 0.5 + (fx === 0 ? side : 0), z = b.door.z + 0.5 + (fz === 0 ? side : 0);
    if (cellAt(cells, Math.floor(x), Math.floor(z)) === BUILT) continue;
    const kind = b.model === 'cityWorkshop' || b.model === 'cityWarehouse' ? (r < 0.3 ? 'cityBarrel' : 'cityCrate') : r < 0.2 ? 'cityPlanter' : r < 0.4 ? 'cityBarrel' : 'cityBench';
    piece(kind, x, z, Math.atan2(fx, fz));
  }

  // ---- trees in the yards and gardens: where an open square of 5 blocks is left behind the houses
  const grow = random(4219);
  for (let z = CORE.z0 + 4; z <= CORE.z1 - 4; z += 3) for (let x = CORE.x0 + 4; x <= CORE.x1 - 4; x += 3) {
    let open = true;
    for (let dz = -2; dz <= 2 && open; dz++) for (let dx = -2; dx <= 2 && open; dx++) open = cellAt(cells, x + dx, z + dz) === FREE;
    if (!open || grow() > 0.5) continue;
    // One kind and size of oak: each kind and size of tree in view is a draw call of its own.
    trees.push({ x, z, kind: 'oak', size: 0.4 + grow() * 0.25 });
    mark(cells, { x0: x - 2, z0: z - 2, x1: x + 2, z1: z + 2 }, KEEP);
  }

  // ---- the edge fields east of town: furrows, a fence on the town's side, hay, and one of the Order's pumps in each
  const fields = CITY_FIELDS.map((f) => {
    const a = toWorld(f.from), b = toWorld(f.to);
    return { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) };
  });
  for (const [i, f] of fields.entries()) {
    // Furrows two blocks wide with a strip of grass between, round the pump's grey ring.
    const pump = toWorld(CITY_FIELDS[i].pump);
    for (let x = f.x0 + 1; x <= f.x1 - 1; x += 3) {
      for (let z = f.z0 + 1; z <= f.z1 - 1; z++) {
        if (Math.hypot(x - pump.x, z - pump.z) < 5 || Math.hypot(x + 1 - pump.x, z - pump.z) < 5) continue;
        box(x, top, z, Math.min(x + 1, f.x1 - 1), top, z, 'tilled_soil');
      }
    }
    for (let z = f.z0 + 1; z < f.z1; z += 3) piece('cityFence', f.x0 - 0.5, z + 1.5, Math.PI / 2, z + 3 >= f.z1 ? 'end' : 'run');
    piece('hayBale', f.x1 - 2.5, f.z0 + 2.5, i * 1.3);
  }
  place('town.fields', 289, -193, 'Fields');

  // ---- the ground: the city level with its streets, each field level too, easing into the land
  const levels: Level[] = [];
  // In rows of eight blocks, as far as the river's bank allows, so no level ever fills the Mere.
  for (let z = CORE.z0; z <= CORE.z1; z += 8) {
    let run = -1;
    for (let x = CORE.x0; x <= CORE.x1 + 1; x++) {
      const dry = x <= CORE.x1 && [0, 7].every((dz) => riverBank(x + 0.5, Math.min(CORE.z1, z + dz) + 0.5) > 5);
      if (dry && run < 0) run = x;
      if (!dry && run >= 0) { levels.push({ x0: run, z0: z, x1: x - 1, z1: Math.min(CORE.z1, z + 7), ground: g, blend: 6 }); run = -1; }
    }
  }
  for (const f of fields) levels.push({ x0: f.x0 - 1, z0: f.z0 - 1, x1: f.x1 + 1, z1: f.z1 + 1, ground: g, blend: 10 });
  // The mill's ground runs down to its race.
  levels.push({ x0: 112, z0: -165, x1: 128, z1: -144, ground: g, blend: 6 });

  const bounds: Rect = {
    x0: Math.min(CORE.x0, ...fields.map((f) => f.x0)) - 2, z0: Math.min(CORE.z0, ...fields.map((f) => f.z0)) - 2,
    x1: Math.max(CORE.x1, ...fields.map((f) => f.x1)) + 2, z1: Math.max(CORE.z1, ...fields.map((f) => f.z1)) + 2,
  };
  lastCells = cells;
  made = { buildings, pieces, fills, levels, basins: [...BASINS], places, trees, streets: [...STREETS], bounds, core: CORE, fields };
  return made;
}

