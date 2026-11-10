// Buildings as data. A blueprint is a list of blocks and a list of props, each placed relative to one
// corner: x runs east, z runs south, y runs up. `stamp` in src/features/buildings writes one into the
// world, turned by quarter turns. Player blueprints will be the same shape.
//
// Layer y = 0 is the floor, so stamp a blueprint with its corner one block under the ground's top and
// the floor sits level with the ground. The door is always in the south wall. Turn the building to face
// it another way.
//
// The three here are written as a short plan (how wide, which blocks, where the door and windows are)
// that `house` turns into the lists.
import type { PropKind } from './props.ts';

export interface BlueprintBlock {
  x: number;
  y: number;
  z: number;
  /** A key from src/content/blocks.ts. 'air' clears the space. */
  block: string;
}

export interface BlueprintProp {
  kind: PropKind;
  variant: number;
  /** Where it stands, in blocks from the corner. Not whole numbers: 4.5 is the middle of the fifth block. */
  x: number;
  y: number;
  z: number;
  /** Radians around y. At 0 its front faces south. */
  rotation: number;
}

export interface Blueprint {
  name: string;
  /** The blocks it takes up along x, y and z. */
  size: { x: number; y: number; z: number };
  /** Written in order, so a later entry replaces an earlier one in the same place. */
  blocks: readonly BlueprintBlock[];
  props: readonly BlueprintProp[];
  /** The doorway: its lowest block nearest the corner, how many blocks wide and high it is. You leave it going south. */
  door: { x: number; y: number; z: number; wide: number; high: number };
}

type Side = 'south' | 'east' | 'north' | 'west';

interface HousePlan {
  name: string;
  /** The walls' outer size in blocks. The roof hangs one block past them on every side. */
  wide: number;
  deep: number;
  wallHigh: number;
  floor: string;
  /** Under the walls. */
  base: string;
  wall: string;
  /** The four corners. */
  post: string;
  roof: string;
  /** The way the ridge runs: 'x' slopes down to north and south, 'z' shows a gable over the door. */
  ridge: 'x' | 'z';
  /** The most blocks the roof rises, for a flat top on a wide building. */
  roofRise: number;
  /** `at` counts wall blocks from the west corner, starting at 1. */
  door: { at: number; wide: number; high: number; variant: number };
  /** `at` counts along the wall from its west or north corner. `y` is 2 unless given. */
  windows: readonly { side: Side; at: number; y?: number; variant: number }[];
  /** Everything else, in the blueprint's own coordinates. */
  props: readonly BlueprintProp[];
}

const prop = (kind: PropKind, variant: number, x: number, y: number, z: number, rotation = 0): BlueprintProp => ({ kind, variant, x, y, z, rotation });
const QUARTER = Math.PI / 2;

/** Turns a plan into a blueprint: a floor, walls with corner posts, a doorway, glass where windows go, and a stepped roof. */
function house(plan: HousePlan): Blueprint {
  const { wide: w, deep: d, wallHigh } = plan;
  const blocks: BlueprintBlock[] = [];
  const props: BlueprintProp[] = [];
  const put = (x: number, y: number, z: number, block: string) => blocks.push({ x, y, z, block });
  const onWall = (x: number, z: number) => x === 1 || x === w || z === 1 || z === d;

  // The floor, the walls and the air inside them. Walls stand on x = 1..w and z = 1..d.
  for (let z = 1; z <= d; z++) {
    for (let x = 1; x <= w; x++) {
      const wall = onWall(x, z);
      const corner = (x === 1 || x === w) && (z === 1 || z === d);
      put(x, 0, z, wall ? plan.base : plan.floor);
      for (let y = 1; y <= wallHigh; y++) put(x, y, z, corner ? plan.post : wall ? plan.wall : 'air');
    }
  }

  // The roof: one block thick and hollow underneath. The eaves hang one block above the wall's top, so
  // the camera sees the windows under them, and from there it steps up a block for each block in.
  const acrossMax = (plan.ridge === 'x' ? d : w) + 1;
  const alongMax = (plan.ridge === 'x' ? w : d) + 1;
  let top = wallHigh;
  for (let across = 0; across <= acrossMax; across++) {
    const rise = Math.max(1, Math.min(across, acrossMax - across, plan.roofRise));
    const y = wallHigh + rise;
    top = Math.max(top, y);
    for (let along = 0; along <= alongMax; along++) {
      const x = plan.ridge === 'x' ? along : across, z = plan.ridge === 'x' ? across : along;
      put(x, y, z, plan.roof);
      // Under the roof, the end walls go up to meet it.
      const endWall = (along === 1 || along === alongMax - 1) && across >= 1 && across <= acrossMax - 1;
      if (endWall) for (let fill = wallHigh + 1; fill < y; fill++) put(x, fill, z, plan.wall);
    }
  }

  // The doorway, and the same space cleared one block out in front of it.
  for (let i = 0; i < plan.door.wide; i++) {
    for (let y = 1; y <= plan.door.high; y++) {
      put(plan.door.at + i, y, d, 'air');
      put(plan.door.at + i, y, d + 1, 'air');
    }
  }
  props.push(prop('door', plan.door.variant, plan.door.at + plan.door.wide / 2, 1, d + 1));

  // A window is a glass block with the window prop on its outer face.
  for (const { side, at, y = 2, variant } of plan.windows) {
    if (side === 'south') { put(at, y, d, 'glass'); props.push(prop('window', variant, at + 0.5, y, d + 1, 0)); }
    else if (side === 'north') { put(at, y, 1, 'glass'); props.push(prop('window', variant, at + 0.5, y, 1, 2 * QUARTER)); }
    else if (side === 'east') { put(w, y, at, 'glass'); props.push(prop('window', variant, w + 1, y, at + 0.5, QUARTER)); }
    else { put(1, y, at, 'glass'); props.push(prop('window', variant, 1, y, at + 0.5, -QUARTER)); }
  }

  props.push(...plan.props);
  return { name: plan.name, size: { x: w + 2, y: top + 1, z: d + 2 }, blocks, props, door: { x: plan.door.at, y: 1, z: d, wide: plan.door.wide, high: plan.door.high } };
}

/** A plaster cottage under a teal roof: a bed, a chest and a stove inside, and a chimney over the stove. */
const cottage = house({
  name: 'Cottage',
  wide: 7, deep: 6, wallHigh: 3,
  floor: 'oak_plank', base: 'cobble', wall: 'plaster', post: 'oak_log', roof: 'shingle',
  ridge: 'x', roofRise: 3,
  door: { at: 4, wide: 1, high: 2, variant: 0 },
  windows: [
    { side: 'south', at: 2, variant: 1 }, { side: 'south', at: 6, variant: 2 },
    { side: 'north', at: 3, variant: 0 }, { side: 'east', at: 4, variant: 1 }, { side: 'west', at: 3, variant: 0 },
  ],
  props: [
    prop('bed', 0, 2.55, 1, 3.05),
    prop('chest', 0, 2.6, 1, 5.3, QUARTER),
    prop('stove', 0, 5.6, 1, 2.42),
    prop('chimney', 0, 5.9, 6, 2.5),
    prop('barrel', 1, 6.5, 1, 5.5),
    prop('sack', 0, 6.4, 1, 3.6),
    prop('barrel', 0, 2.6, 1, 7.45),
    prop('crate', 0, 6.3, 1, 7.5),
  ],
});

/** A shop with its gable to the street: a counter and a forge inside, an awning over the glass, a sign by the door. */
const shop = house({
  name: 'Shop',
  wide: 8, deep: 7, wallHigh: 3,
  floor: 'oak_plank', base: 'stone_brick', wall: 'plaster', post: 'oak_log', roof: 'shingle',
  ridge: 'z', roofRise: 3,
  door: { at: 3, wide: 1, high: 2, variant: 1 },
  windows: [
    { side: 'south', at: 5, variant: 0 }, { side: 'south', at: 6, variant: 0 },
    { side: 'east', at: 4, variant: 1 }, { side: 'west', at: 4, variant: 1 }, { side: 'north', at: 5, y: 3, variant: 0 },
  ],
  props: [
    prop('awning', 0, 6, 1, 8),
    prop('sign', 0, 2.3, 1, 8),
    prop('workbench', 0, 3.1, 1, 2.45),
    prop('forge', 0, 6.25, 1, 2.55),
    prop('chest', 1, 7.55, 1, 5.4, -QUARTER),
    prop('crate', 1, 6.7, 1, 6.35),
    prop('barrel', 0, 2.5, 1, 6.4),
    prop('sack', 1, 2.5, 1, 4.2),
  ],
});

/** A plank barn under thatch, with doors two blocks wide and three high, and a cart inside. */
const barn = house({
  name: 'Barn',
  wide: 9, deep: 8, wallHigh: 4,
  floor: 'path', base: 'cobble', wall: 'oak_plank', post: 'oak_log', roof: 'thatch',
  ridge: 'z', roofRise: 3,
  door: { at: 4, wide: 2, high: 3, variant: 2 },
  windows: [
    { side: 'east', at: 4, y: 3, variant: 0 }, { side: 'west', at: 5, y: 3, variant: 0 }, { side: 'north', at: 5, y: 3, variant: 0 },
  ],
  props: [
    prop('cart', 1, 7.1, 1, 4.2, QUARTER),
    prop('sack', 1, 2.7, 1, 2.7),
    prop('sack', 0, 2.6, 1, 4.6),
    prop('crate', 1, 2.7, 1, 7.2, QUARTER),
    prop('barrel', 0, 8.45, 1, 7.4),
    prop('barrel', 0, 8.4, 1, 6.5),
    prop('bench', 0, 5.5, 1, 2.35),
  ],
});

/**
 * The Queen's Granary, the seat of Hollowmere: a hall two storeys high under a teal roof, with sacks of the
 * harvest inside and a bell tower at the back. Lamps burn in the open belfry all night and the realm's
 * banner flies over it, so the hall shows from the meadow by day and by dark.
 */
const hall: Blueprint = (() => {
  const base = house({
    name: 'Granary hall',
    wide: 14, deep: 9, wallHigh: 6,
    floor: 'oak_plank', base: 'stone_brick', wall: 'plaster', post: 'oak_log', roof: 'shingle',
    ridge: 'x', roofRise: 4,
    door: { at: 7, wide: 2, high: 3, variant: 2 },
    windows: [
      { side: 'south', at: 3, variant: 2 }, { side: 'south', at: 5, variant: 2 }, { side: 'south', at: 10, variant: 2 }, { side: 'south', at: 12, variant: 2 },
      { side: 'south', at: 3, y: 5, variant: 1 }, { side: 'south', at: 5, y: 5, variant: 1 }, { side: 'south', at: 10, y: 5, variant: 1 }, { side: 'south', at: 12, y: 5, variant: 1 },
      { side: 'east', at: 6, variant: 1 }, { side: 'west', at: 6, variant: 1 }, { side: 'east', at: 6, y: 5, variant: 0 }, { side: 'west', at: 6, y: 5, variant: 0 },
    ],
    props: [
      prop('sack', 1, 2.8, 1, 2.8), prop('sack', 1, 2.7, 1, 4.6), prop('sack', 0, 3.9, 1, 2.5),
      prop('sack', 1, 12.2, 1, 2.8), prop('sack', 1, 12.3, 1, 4.7), prop('sack', 0, 11.1, 1, 2.6),
      prop('crate', 1, 2.7, 1, 7.6, QUARTER), prop('crate', 1, 12.3, 1, 7.6, QUARTER),
      prop('barrel', 0, 4.4, 1, 8.4), prop('barrel', 1, 10.6, 1, 8.4),
      prop('bench', 0, 6.5, 1, 6.2), prop('bench', 0, 9.5, 1, 6.2),
      prop('chest', 0, 11.6, 1, 5.6, -QUARTER),
    ],
  });
  const blocks = [...base.blocks];
  const put = (x: number, y: number, z: number, block: string) => blocks.push({ x, y, z, block });
  // The tower, four blocks square against the back wall: stone up through the roof, then an open belfry.
  for (let y = 1; y <= 14; y++) {
    for (let x = 6; x <= 9; x++) {
      for (let z = 1; z <= 4; z++) {
        const edge = x === 6 || x === 9 || z === 1 || z === 4, corner = (x === 6 || x === 9) && (z === 1 || z === 4);
        if (y <= 10) put(x, y, z, 'stone_brick');
        else if (corner) put(x, y, z, 'oak_log');
        else if (!edge) put(x, y, z, y === 11 ? 'stone_brick' : 'air');
        else put(x, y, z, y === 11 || y === 14 ? 'plaster' : 'air');
      }
    }
  }
  put(7, 12, 2, 'lamp');
  put(8, 12, 3, 'lamp');
  // The spire: three steps of teal.
  for (let x = 5; x <= 10; x++) for (let z = 0; z <= 5; z++) put(x, 15, z, 'shingle');
  for (let x = 6; x <= 9; x++) for (let z = 1; z <= 4; z++) put(x, 16, z, 'shingle');
  for (let x = 7; x <= 8; x++) for (let z = 2; z <= 3; z++) put(x, 17, z, 'shingle');
  return { ...base, size: { ...base.size, y: 23 }, blocks, props: [...base.props, prop('banner', 0, 8, 18, 3, QUARTER)] };
})();

export const BLUEPRINTS = { cottage, shop, barn, hall } as const satisfies Record<string, Blueprint>;

export type BlueprintName = keyof typeof BLUEPRINTS;
