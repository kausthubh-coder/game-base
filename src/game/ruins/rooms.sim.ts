// The rooms under the ruins, as data: the Pump House's two floors, the Lamp Gallery, the Seed Vault, the Rootworks'
// three levels, the Stag's hall and the Hall's second level. Each is laid out from its approved sheet in
// `assets-src/concept/rooms/` (pumpHouseInside, lampGallery, seedVault, rootworks, stagHall), with the sheet's floor
// plan as the grid.
//
// The rooms are not under their doors. They stand in a row in the rooms' own ground, far south of Greenhollow's map,
// as Saltgate does (`src/game/content/saltgate.ts`): a door in the world takes the hero into its room, and the room's
// way out brings them back to the door. Each room is a court open to the sky, sunk in rock on its north and west
// sides, with low walls on its south and east sides so the camera, which looks from the south-east, sees in.
//
// A plan is rows from north to south, one character a block, x east and z south from the room's north-west corner:
//
//   #  a wall five blocks high (the north and west sides)     +  a wall two blocks high (the south and east sides)
//   .  stone floor     ,  cobble     :  a dais of pale stone     =  plank floor     ~  a channel's bed
//   w  water, a block below the floor                          o  a pillar four blocks high
//   x  a block a model stands on: nobody walks through it     X  the same, eight blocks high: the Stag's body
//   k  a boulder's footing, two blocks high: the ring of boulders round the Stag's floor, drawn as boulders
//   b  bars, until the room opens them
//   r  a root lock, three blocks high, until the room opens it
//   (space) nothing: the rock round the room
//
// The round rooms (the Seed Vault and the Stag's hall) are made by `round` below rather than drawn by hand.
// `land.sim.ts` lays the blocks and `index.sim.ts` plays what happens in them.

import type { KeeperKind } from '../content/fight.ts';
import { HALL } from '../fight/hall-layout.sim.ts';

export type RoomId = 'pump-upper' | 'pump-lower' | 'gallery' | 'seedvault' | 'rootworks-1' | 'rootworks-2' | 'rootworks-3' | 'stag' | 'hall-below';

/** A model of src/content/props.ts standing in a room. `x` and `z` are blocks from the room's corner; `turn` is radians, 0 facing south. */
export interface RoomProp {
  kind: string;
  /** The variant's name, or the first. */
  variant?: string;
  x: number;
  z: number;
  turn?: number;
  scale?: number;
  /** Blocks above the floor. */
  y?: number;
  /** It gives light: a lantern's light block is laid in its cell. */
  light?: boolean;
}

export interface RoomDef {
  id: RoomId;
  name: string;
  /** The north-west corner in the rooms' ground, in blocks from `ROOMS.x`, `ROOMS.z`. */
  at: { x: number; z: number };
  plan: readonly string[];
  /** Named points, in blocks from the corner. `arrive` is where the hero stands on coming in. */
  spots: Readonly<Record<string, readonly [number, number]>>;
  /** Which way the hero faces on arriving: 0 north, growing toward the east. */
  facing: number;
  props: readonly RoomProp[];
  /** The keeper fought here, and the parts of its room. */
  keeper?: KeeperPlan;
}

export interface KeeperPlan {
  kind: KeeperKind;
  /** The fight starts when the hero stands inside this box of the room, `[x0, z0, x1, z1]`. */
  trigger: readonly [number, number, number, number];
  home: readonly [number, number];
  /** Where the hero starts and wakes. */
  start: readonly [number, number];
  /** The sluice keeper: each channel as a box of the plan, and its gate. */
  channels?: readonly { box: readonly [number, number, number, number]; gate: readonly [number, number] }[];
  lamps?: readonly (readonly [number, number])[];
  beds?: readonly (readonly [number, number])[];
}

/** The rooms' ground: its north-west corner in the world, and the height of the hero's feet on every floor. */
export const ROOMS = { x: -600, z: 2400, ground: 26, gap: 76 } as const;

const Q = Math.PI / 2;

// ------------------------------------------------------------------------------------------ the round rooms

/**
 * A round room `size` blocks across: floor within `radius` of the middle, walls round it, tall to the north and
 * west. `cells` overrides single cells after.
 */
function round(size: number, radius: number, cells: (x: number, z: number, d: number) => string | null): string[] {
  const mid = (size - 1) / 2;
  const rows: string[] = [];
  for (let z = 0; z < size; z++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - mid, z - mid);
      const own = cells(x, z, d);
      if (own !== null) row += own;
      else if (d <= radius) row += '.';
      else if (d <= radius + 1.5) row += x < mid || z < mid ? '#' : '+';
      else row += ' ';
    }
    rows.push(row);
  }
  return rows;
}

/** The Seed Vault: 24 across, the arm's base in the middle, a dais to the north, the root gap west, the sealed door south. */
const SEED_VAULT = round(26, 11.6, (x, z, d) => {
  if (x === 12 && z === 12) return 'x';
  if (z >= 2 && z <= 3 && x >= 10 && x <= 14) return ':';
  // The root gap in the west wall, and the sealed oak door in the south wall.
  if (z >= 11 && z <= 13 && x <= 1) return ',';
  if (x >= 11 && x <= 13 && z >= 23) return z === 25 ? ' ' : '+';
  // A ring of cobble the arm sweeps.
  if (d > 5.2 && d < 6.4) return ',';
  return null;
});

/** The Stag's hall: the fight's ring (`HALL`, src/game/fight/hall-layout.sim.ts) round the middle block, a lamp lane round it, walls round that. */
const STAG_SIZE = 35, STAG_MID = 17;
const STAG_HALL = (() => {
  const rows: string[] = [];
  const body = HALL.body;
  for (let z = 0; z < STAG_SIZE; z++) {
    let row = '';
    for (let x = 0; x < STAG_SIZE; x++) {
      const lx = x - STAG_MID, lz = z - STAG_MID;
      const d = Math.hypot(lx, lz);
      const edge = x === 0 || z === 0 || x === STAG_SIZE - 1 || z === STAG_SIZE - 1;
      const post = [...HALL.pins, ...HALL.lamps].some((p) => Math.floor(p.x) === lx && Math.floor(p.z) === lz);
      const onBody = lx >= body.x0 && lx < body.x1 && lz >= body.z0 && lz < body.z1;
      // The way in from the south door, through the ring of boulders.
      const way = Math.abs(lx) <= 1 && lz > 0;
      if (edge) row += x === 0 || z === 0 ? '#' : (Math.abs(lx) <= 1 && z === STAG_SIZE - 1 ? ',' : '+');
      else if (onBody) row += 'X';
      else if (post) row += 'x';
      else if (d <= HALL.radius + 0.5) row += (d > 5 && d < 6.2) || d > HALL.radius - 0.7 ? '.' : ',';
      else if (d <= HALL.wall + 0.6 && !way) row += 'k';
      else row += way ? ',' : '.';
    }
    rows.push(row);
  }
  return rows;
})();

// ------------------------------------------------------------------------------------------ the rooms

const lantern = (x: number, z: number, variant = 'ground'): RoomProp => ({ kind: 'lantern', variant, x, z, light: true });

/** The three Rootworks levels share their frame: a root lock in the north-east, a rope landing in the south-east, a waystone in the middle. */
function rootworks(machine: readonly string[]): string[] {
  const frame = [
    '########################',
    '#...............rrrrr..+',
    '#...............rrrrr..+',
    '#......................+',
    '#......................+',
    '#......................+',
    '#......................+',
    '#......................+',
    '#......................+',
    '#..........x...........+',
    '#......................+',
    '#......................+',
    '#......................+',
    '#......................+',
    '#...................,,,+',
    '#...................,,,+',
    '#...................,,,+',
    '#......................+',
    '#......................+',
    '++++++++++++++++++++++++',
  ];
  // Each machine row replaces the frame's row at its index, from column 1 to 9.
  return frame.map((row, z) => {
    const m = machine[z];
    return m ? row[0] + m + row.slice(1 + m.length) : row;
  });
}

const ROOTWORKS_SPOTS = {
  arrive: [20.5, 15], up: [21.5, 16.4], lock: [18.5, 3.4], waystone: [11.5, 10.9], machine: [4.5, 9.5],
} as const;

const ROOTWORKS_DRESS: readonly RoomProp[] = [
  { kind: 'giantRoot', variant: 'arch', x: 18.5, z: 1.6, scale: 0.4 },
  { kind: 'waystone', variant: 'waking', x: 11.5, z: 9.5 },
  { kind: 'surfaceRoot', variant: 'coil', x: 7, z: 2, turn: 1 },
  { kind: 'surfaceRoot', variant: 'arch', x: 14, z: 17, turn: 2 },
  { kind: 'fern', variant: 'full', x: 1.6, z: 17.4 },
  { kind: 'mushroom', variant: 'pale', x: 2.2, z: 1.6 },
  { kind: 'banner', variant: 'hedge', x: 9.5, z: 0.8 },
  { kind: 'banner', variant: 'hedge', x: 14.5, z: 0.8 },
  lantern(21.4, 13.6), lantern(1.6, 4), lantern(16, 17.4),
];

export const ROOM_DEFS: readonly RoomDef[] = [
  {
    // pumpHouseInside: the upper floor, 20 by 14. The great wheel's shaft comes through the west wall to a lever; the
    // stair down in the south-east is under water until the lever is pulled.
    id: 'pump-upper',
    name: 'The Pump House',
    at: { x: 0, z: 0 },
    plan: [
      '######################',
      '#....................+',
      '#...o..........o.....+',
      '#....................+',
      '#,,,,,,,,,...........+',
      '#........,...........+',
      '#........,...........+',
      '#.......:x:..........+',
      '#.......:::..........+',
      '#...............+,,+++',
      '#...............+wwww+',
      '#...............+wwww+',
      '#...............+wwww+',
      '#...............+wwww+',
      '#...............+wwww+',
      '++++++++++,,++++++++++',
    ],
    spots: { arrive: [11, 13.4], out: [11, 14.6], lever: [9.5, 8.9], stair: [18, 9.4], spray: [5.5, 11.5], shaft: [0.2, 4.5] },
    facing: 0,
    props: [
      // The bearings of the shaft from the great wheel; the view draws the shaft turning in them.
      ...[1.5, 4.5, 7.5].map((x): RoomProp => ({ kind: 'partShaft', variant: 'working', x, z: 4.5, turn: Q })),
      { kind: 'partLever', variant: 'starved', x: 9.5, z: 7.5 },
      { kind: 'partSprinkler', variant: 'starved', x: 5.5, z: 11.5 },
      { kind: 'workbench', x: 13.5, z: 1.6 },
      { kind: 'plinth', x: 18.5, z: 2.5 },
      { kind: 'banner', variant: 'hedge', x: 7, z: 0.8 },
      { kind: 'banner', variant: 'hedge', x: 12, z: 0.8 },
      { kind: 'barrel', variant: 'closed', x: 2, z: 13.6 },
      { kind: 'crate', variant: 'stack', x: 3.4, z: 13.8 },
      { kind: 'sack', variant: 'pile', x: 1.8, z: 12.2 },
      { kind: 'planter', x: 20.2, z: 1.8 },
      lantern(1.6, 1.6), lantern(20.4, 6.4), lantern(14.4, 13.6),
    ],
  },
  {
    // pumpHouseInside: the sluice chamber below, 24 by 20. A trench six wide runs west to east under two bridges,
    // in three channels each with its sluice gate on the north bank. The keystone and the memory stone are on the
    // north dais, and the stair up is in the north-east corner.
    id: 'pump-lower',
    name: 'The sluice chamber',
    at: { x: ROOMS.gap, z: 0 },
    plan: [
      '##########################',
      '#.........::::::......,,,+',
      '#.........::::::......,,,+',
      '#.....................,,,+',
      '#........................+',
      '#........................+',
      '#........................+',
      '#........................+',
      '#~~~~~~===~~~~~~===~~~~~~+',
      '#~~~~~~===~~~~~~===~~~~~~+',
      '#~~~~~~===~~~~~~===~~~~~~+',
      '#~~~~~~===~~~~~~===~~~~~~+',
      '#~~~~~~===~~~~~~===~~~~~~+',
      '#~~~~~~===~~~~~~===~~~~~~+',
      '#........................+',
      '#........................+',
      '#........................+',
      '#........................+',
      '#........................+',
      '#........................+',
      '#........................+',
      '++++++++++++++++++++++++++',
    ],
    spots: { arrive: [23.5, 3.2], up: [23.5, 1.4], keystone: [11.5, 1.8], memory: [14.5, 1.8] },
    facing: Math.PI * 1.5,
    props: [
      { kind: 'plinth', x: 11.5, z: 1.5 },
      { kind: 'plinth', x: 14.5, z: 1.5 },
      { kind: 'partWheel', variant: 'working', x: 0.9, z: 10.5, turn: Q },
      { kind: 'partSprinkler', variant: 'working', x: 24.2, z: 10.5 },
      ...[3.5, 12.5, 21.5].map((x): RoomProp => ({ kind: 'partLever', variant: 'starved', x, z: 7.2 })),
      { kind: 'banner', variant: 'hedge', x: 6, z: 0.8 },
      { kind: 'banner', variant: 'hedge', x: 19, z: 0.8 },
      { kind: 'barrel', variant: 'open', x: 2, z: 19.4 },
      { kind: 'crate', variant: 'single', x: 3.4, z: 19.6 },
      { kind: 'ruinPillar', variant: 'waist high', x: 23.4, z: 19.2 },
      { kind: 'fern', variant: 'young', x: 1.6, z: 15 },
      lantern(1.6, 1.6), lantern(8.5, 1.6), lantern(17.5, 1.6), lantern(1.6, 19.4), lantern(12.5, 19.4), lantern(23.4, 15),
    ],
    keeper: {
      kind: 'sluice',
      trigger: [1, 4, 21, 21],
      home: [12.5, 5.5],
      start: [22.5, 5.5],
      channels: [
        { box: [1, 8, 7, 14], gate: [3.5, 6.6] },
        { box: [10, 8, 16, 14], gate: [12.5, 6.6] },
        { box: [19, 8, 25, 14], gate: [21.5, 6.6] },
      ],
    },
  },
  {
    // lampGallery: 14 by 30. The walkway runs north from the arch past six glass eyes, each of which lights the pair
    // of lamps beside it once it sees the hero and the eye before it is lit. Bars stand across it until all are
    // lit. The arena is the north end, the Lamplighter on its post among four lamps.
    id: 'gallery',
    name: 'The Lamp Gallery',
    at: { x: ROOMS.gap * 2, z: 0 },
    plan: [
      '################',
      '#.....::::.....+',
      '#..............+',
      '#..............+',
      '#..............+',
      '#..............+',
      '#..............+',
      '#......x.......+',
      '#..............+',
      '#..............+',
      '#..............+',
      '#..............+',
      '#.o..........o.+',
      '#..............+',
      '#..............+',
      '#..............+',
      '#..............+',
      '#bbbbbbbbbbbbbb+',
      '#..............+',
      '#,............,+',
      '#..............+',
      '#,............,+',
      '#..............+',
      '#,............,+',
      '#..............+',
      '#,............,+',
      '#..............+',
      '#,............,+',
      '#..............+',
      '#,............,+',
      '#..............+',
      '+++++++,,+++++++',
    ],
    spots: { arrive: [8, 30.2], out: [8, 30.9], keystone: [6.5, 1.6], memory: [9.5, 1.6] },
    facing: 0,
    props: [
      { kind: 'plinth', x: 6.5, z: 1.4 },
      { kind: 'plinth', x: 9.5, z: 1.4 },
      { kind: 'banner', variant: 'crown', x: 4, z: 0.8 },
      { kind: 'banner', variant: 'crown', x: 12, z: 0.8 },
      { kind: 'ruinPillar', variant: 'waist high', x: 2.5, z: 12.5 },
      { kind: 'ruinPillar', variant: 'waist high', x: 13.5, z: 12.5 },
      { kind: 'crystals', variant: 'small', x: 1.8, z: 15.6 },
      { kind: 'crystals', variant: 'small', x: 14.2, z: 2.6 },
      { kind: 'fern', variant: 'young', x: 1.6, z: 29.6 },
      { kind: 'surfaceRoot', variant: 'coil', x: 14, z: 28, turn: 2 },
    ],
    keeper: {
      kind: 'lamplighter',
      trigger: [1, 1, 15, 17],
      home: [7.5, 7.5],
      start: [7.5, 15.5],
      lamps: [[2.5, 6.5], [12.5, 6.5], [4.5, 11.5], [10.5, 11.5]],
    },
  },
  {
    // seedVault: round, 24 across, nine high. The arm stands in the middle; root pods grow round it. Calla's seal
    // is on the oak door in the south wall, so the way in is the root gap in the west wall.
    id: 'seedvault',
    name: 'The Seed Vault',
    at: { x: ROOMS.gap * 3, z: 0 },
    plan: SEED_VAULT,
    spots: { arrive: [2.6, 12.5], roots: [1.2, 12.5], door: [12.5, 22.6], keystone: [11.5, 2.8], memory: [13.5, 2.8] },
    facing: Math.PI / 2,
    props: [
      { kind: 'plinth', x: 11.5, z: 2.6 },
      { kind: 'plinth', x: 13.5, z: 2.6 },
      { kind: 'giantRoot', variant: 'curl', x: 3.5, z: 6.5, turn: Q * 0.5, scale: 0.45 },
      { kind: 'giantRoot', variant: 'arch', x: 0.8, z: 12.5, turn: Q, scale: 0.35 },
      { kind: 'giantRoot', variant: 'low', x: 20.5, z: 5, turn: -Q * 0.5, scale: 0.45 },
      { kind: 'barrel', variant: 'closed', x: 6, z: 3.2 },
      { kind: 'barrel', variant: 'open', x: 7.2, z: 2.6 },
      { kind: 'sack', variant: 'pile', x: 17.6, z: 2.8 },
      { kind: 'sack', variant: 'one', x: 18.8, z: 3.6 },
      { kind: 'crate', variant: 'stack', x: 21.6, z: 8.4 },
      { kind: 'barrel', variant: 'closed', x: 2.8, z: 17.8 },
      { kind: 'planter', x: 20.4, z: 18.4 },
      { kind: 'fern', variant: 'full', x: 4.4, z: 20.4 },
      { kind: 'mushroom', variant: 'brown', x: 21.2, z: 14.6 },
      { kind: 'shutDoor', x: 12.5, z: 23.4, scale: 0.7 },
      lantern(8.5, 1.8), lantern(16.5, 1.8), lantern(1.8, 8.5), lantern(23.2, 12.5), lantern(6, 21.6), lantern(19, 21.6),
    ],
    keeper: {
      kind: 'harvester',
      trigger: [3, 3, 23, 23],
      home: [12.5, 12.5],
      start: [4.5, 12.5],
      beds: Array.from({ length: 8 }, (_, i): readonly [number, number] => {
        const w = (i / 8) * Math.PI * 2;
        return [12.5 + Math.round(Math.sin(w) * 6), 12.5 + Math.round(-Math.cos(w) * 6)];
      }),
    },
  },
  {
    // rootworks: level 1, water. The wheel stands dead in its channel in the west with no shaft.
    id: 'rootworks-1',
    name: 'The Rootworks: water',
    at: { x: ROOMS.gap * 4, z: 0 },
    plan: rootworks([
      '', '', '', '',
      'ww',
      'ww',
      'ww',
      'ww..',
      'wwxx',
      'wwxx',
      'wwxx',
      'ww..',
      'ww',
      'ww',
      'ww',
      'ww',
    ]),
    spots: { ...ROOTWORKS_SPOTS, machine: [5.4, 9.5] },
    facing: Math.PI * 1.5,
    props: [...ROOTWORKS_DRESS, { kind: 'partWheel', variant: 'starved', x: 3.5, z: 9.5, turn: Q, scale: 1.6 }],
  },
  {
    // rootworks: level 2, light. A dead lamp on the west wall and its glass eye, its brass wire cut.
    id: 'rootworks-2',
    name: 'The Rootworks: light',
    at: { x: ROOMS.gap * 5, z: 0 },
    plan: rootworks(['', '', '', '', '', '', '', '', '.xx', '.xx']),
    spots: { ...ROOTWORKS_SPOTS, machine: [4.8, 9.5] },
    facing: Math.PI * 1.5,
    props: [
      ...ROOTWORKS_DRESS,
      { kind: 'partSwitchableLamp', variant: 'starved', x: 2.5, z: 9, scale: 1.4 },
      { kind: 'partSensor', variant: 'starved', x: 3.5, z: 10 },
      ...[4.5, 5.5, 6.5].map((x): RoomProp => ({ kind: 'partShaft', variant: 'starved', x, z: 11.5, turn: Q, scale: 0.6 })),
    ],
  },
  {
    // rootworks: level 3, the arm. Its spring and linkage are gone; once it moves it pulls the overgrown root lock
    // open, and the way down to the Stag's hall.
    id: 'rootworks-3',
    name: 'The Rootworks: the arm',
    at: { x: ROOMS.gap * 6, z: 0 },
    plan: rootworks(['', '', '', '', '', '', '', '', '..xx', '..xx']),
    spots: { ...ROOTWORKS_SPOTS, machine: [5.6, 9.5] },
    facing: Math.PI * 1.5,
    props: [...ROOTWORKS_DRESS, { kind: 'partArm', variant: 'starved', x: 4, z: 9.5, turn: -Q, scale: 1.8 }],
  },
  {
    // stagHall: the Verdant Stag's hall, the fight's ring with a lane of lamps round it. The fights system draws the
    // Stag, its pins, lamps and vines (src/game/fightview/hall.ts).
    id: 'stag',
    name: 'The Stag\'s hall',
    at: { x: ROOMS.gap * 7, z: 0 },
    plan: STAG_HALL,
    spots: { arrive: [STAG_MID + 0.5, STAG_SIZE - 2], out: [STAG_MID + 0.5, STAG_SIZE - 1.2], middle: [STAG_MID, STAG_MID] },
    facing: 0,
    props: [
      ...[[3, 3], [31, 3], [3, 31], [31, 31], [17.5, 1.6], [1.6, 17.5], [33.4, 17.5]].map(([x, z]) => lantern(x as number, z as number, 'post')),
      { kind: 'banner', variant: 'hedge', x: 12, z: 0.8 },
      { kind: 'banner', variant: 'hedge', x: 23, z: 0.8 },
      { kind: 'giantRoot', variant: 'arch', x: 4, z: 9, turn: Q * 0.5, scale: 0.6 },
      { kind: 'giantRoot', variant: 'curl', x: 30, z: 8, turn: -Q * 0.5, scale: 0.6 },
      { kind: 'fern', variant: 'full', x: 2, z: 26 },
      { kind: 'fern', variant: 'full', x: 32.6, z: 28 },
      // The ring of boulders round the fight's floor, leaving the way in from the south.
      ...Array.from({ length: 26 }, (_, i): RoomProp | null => {
        const w = (i / 26) * Math.PI * 2, r = HALL.wall + 0.1;
        const x = STAG_MID + 0.5 + Math.sin(w) * r, z = STAG_MID + 0.5 + Math.cos(w) * r;
        if (Math.abs(x - STAG_MID - 0.5) < 2.4 && z > STAG_MID) return null;
        return { kind: 'boulders', variant: i % 3 === 0 ? 'pair' : 'one', x, z, turn: w, scale: 0.34 };
      }).filter((p): p is RoomProp => p !== null),
    ],
  },
  {
    // The Hall's second level, which opens after the Stag (quest `green`): a small round room under the court, and
    // in it the table the Echo of eight chairs showed, with its eight chairs.
    id: 'hall-below',
    name: 'Under Ilara\'s Hall',
    at: { x: ROOMS.gap * 8, z: 0 },
    plan: [
      '################',
      '#..............+',
      '#..............+',
      '#..o........o..+',
      '#..............+',
      '#....,,,,,,....+',
      '#....,xxxx,....+',
      '#....,,,,,,....+',
      '#..............+',
      '#..o........o..+',
      '#..............+',
      '#......,,......+',
      '#......,,......+',
      '+++++++,,+++++++',
    ],
    spots: { arrive: [8, 11.6], out: [8, 12.6], table: [8, 5] },
    facing: 0,
    props: [
      { kind: 'homeTable', x: 7, z: 6.5, turn: Q },
      { kind: 'homeTable', x: 9, z: 6.5, turn: Q },
      ...[6.5, 7.8, 9.1].map((x): RoomProp => ({ kind: 'homeChair', x, z: 5.5, turn: Math.PI })),
      ...[6.5, 7.8, 9.1].map((x): RoomProp => ({ kind: 'homeChair', x, z: 7.6 })),
      { kind: 'homeChair', x: 5.6, z: 6.5, turn: Q },
      { kind: 'homeChair', x: 10.4, z: 6.5, turn: -Q },
      { kind: 'muralSlab', variant: 'eight figures', x: 8, z: 1.2 },
      ...[[2.5, 2.5], [13.5, 2.5], [2.5, 10.5], [13.5, 10.5]].map(([x, z]): RoomProp => ({ kind: 'hallLamp', variant: 'lit', x: x as number, z: z as number, light: true })),
    ],
  },
];

export const ROOM_BY_ID: ReadonlyMap<RoomId, RoomDef> = new Map(ROOM_DEFS.map((r) => [r.id, r]));

export function roomOf(id: RoomId): RoomDef {
  const room = ROOM_BY_ID.get(id);
  if (!room) throw new Error(`no room ${id}`);
  return room;
}

/** The world block of a room's corner. */
export function roomOrigin(room: RoomDef): { x: number; z: number } {
  return { x: ROOMS.x + room.at.x, z: ROOMS.z + room.at.z };
}

/** A point of a room in the world, feet on its floor. */
export function roomPoint(room: RoomDef, x: number, z: number): { x: number; y: number; z: number } {
  const o = roomOrigin(room);
  return { x: o.x + x, y: ROOMS.ground, z: o.z + z };
}

/** The room a world column is in, or null. */
export function roomAt(x: number, z: number): RoomDef | null {
  for (const room of ROOM_DEFS) {
    const o = roomOrigin(room);
    if (x >= o.x && z >= o.z && x < o.x + room.plan[0].length && z < o.z + room.plan.length) return room;
  }
  return null;
}

/** The plan's character at a block of a room, or a space outside it. */
export function cellOf(room: RoomDef, x: number, z: number): string {
  return room.plan[z]?.[x] ?? ' ';
}

/** The six glass eyes of the Lamp Gallery, south to north, each on its own side, and the two lamps each lights. */
export const GALLERY_EYES: readonly { x: number; z: number; lamps: readonly (readonly [number, number])[] }[] = [29, 27, 25, 23, 21, 19].map((z, i) => ({
  x: i % 2 === 0 ? 1.3 : 14.7,
  z: z + 0.5,
  lamps: [[1.5, z + 0.5], [14.5, z + 0.5]],
}));
/** How close the hero comes to a glass eye before it sees them. */
export const EYE_SEES = 2.6;
