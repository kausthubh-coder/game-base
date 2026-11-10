// Hollowmere as it stands: a cobbled square around a roofed well, with streets on its north and east
// sides and the quay along the river. The redesigns are a.ts and b.ts.
import { blockPen, TOWN_GROUND, type TownPlan } from './kit.ts';
import type { PlanBuilding } from '../region.ts';

/** The middle of the well on the square. */
const WELL = { x: 173, z: -150 };

export function townNow(): TownPlan {
  const fills: TownPlan['fills'] = [];
  const { box, one, lampPost } = blockPen(fills);
  // The camera starts in the south-east, so what is tall stands north and west of the square with its
  // doors to the south and east, and the low things (the field, the kennel, the quay) lie east and south of it.
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

  return {
    fills,
    buildings: [...BUILDINGS],
    models: [],
    places: [
      { name: 'town.gate', x: 134, y: TOWN_GROUND, z: -174, label: 'Hollowmere' },
      // Six blocks from the well: the villagers stand up to four blocks off this place, and none should end up on the well's rim.
      { name: 'town.square', x: WELL.x, y: TOWN_GROUND, z: WELL.z + 6, label: 'Square' },
      { name: 'gus.field', x: 193, y: TOWN_GROUND, z: -149, label: 'Gus\'s field' },
      { name: 'kennel', x: 193, y: TOWN_GROUND, z: -166, label: 'Kennel' },
      { name: 'river.bank', x: 173, y: TOWN_GROUND, z: -131, label: 'River bank' },
      { name: 'ferry', x: 196, y: TOWN_GROUND, z: -125, label: 'Ferry' },
    ],
    trees: [
      // Behind the town's north row.
      { x: 146, z: -188, kind: 'birch', size: 0.5 },
      { x: 174, z: -189, kind: 'oak', size: 0.4 },
      { x: 199, z: -186, kind: 'birch', size: 0.7 },
    ],
    props: [
      { kind: 'signpost', variant: 0, x: 133.5, y: TOWN_GROUND, z: -171.5, rotation: 0 },
      { kind: 'gate', variant: 1, x: 194.5, y: TOWN_GROUND, z: -165.5, rotation: Math.PI / 2 },
      { kind: 'bench', variant: 0, x: 165.5, y: TOWN_GROUND, z: -133.5, rotation: 0 },
      { kind: 'bench', variant: 0, x: 181.5, y: TOWN_GROUND, z: -133.5, rotation: 0 },
      { kind: 'stall', variant: 1, x: 176.5, y: TOWN_GROUND, z: -159.5, rotation: 0 },
      { kind: 'stall', variant: 0, x: 158.5, y: TOWN_GROUND, z: -150.5, rotation: Math.PI / 2 },
      // The valley set: a harvest stall in the square and hay by Gus's field.
      { kind: 'harvestStall', variant: 0, x: 166.5, y: TOWN_GROUND, z: -159.5, rotation: 0 },
      { kind: 'hayBale', variant: 0, x: 189.5, y: TOWN_GROUND, z: -145.5, rotation: 0.3 },
      { kind: 'hayBale', variant: 0, x: 190.7, y: TOWN_GROUND, z: -144.3, rotation: 1.2 },
      { kind: 'hayBale', variant: 0, x: 197.5, y: TOWN_GROUND, z: -153.5, rotation: 2.1 },
    ],
    levels: [],
  };
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
