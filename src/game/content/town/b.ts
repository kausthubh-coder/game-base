// Hollowmere B: the Hollow Oak. The town is named for it: an oak older than the kingdom, hollow at its foot,
// grown up through the hall of an old realm until only a ring of broken pillars is left. Hollowmere tells it
// as "the forest ate them for their pride", and keeps the tree in the middle of town to remember it by.
//
// The grey square becomes the Lantern Green: grass under the oak, a ring of old paving around it, and
// walks out to the shops. At the festival the lamps hang in the oak before they are floated, so the green is
// lit from above, and a walk of stone lanterns leads from the tree down to the river where they go on the
// water. The town's edge toward the meadow is a hedge, for the Hedgewardens who keep the old ways, with a
// broken pair of the old realm's pillars for its gate.
import { blockPen, glowAt, lanternAt, townEdges, townProp, TOWN_GROUND, type TownPlan } from './kit.ts';

const QUARTER = Math.PI / 2;

/** The middle of the oak's trunk: the middle of block (173, -152). */
const OAK = { x: 173.5, z: -151.5 };

export function townB(): TownPlan {
  const fills: TownPlan['fills'] = [], places: TownPlan['places'] = [], props: TownPlan['props'] = [];
  const { box, one } = blockPen(fills);
  const g = TOWN_GROUND, top = g - 1;
  townEdges(fills, places, props);
  /** Blocks whose middle lies between r0 and r1 from the oak. */
  const ring = (r0: number, r1: number, put: (x: number, z: number, angle: number) => void): void => {
    for (let x = Math.floor(OAK.x - r1); x <= OAK.x + r1; x++) {
      for (let z = Math.floor(OAK.z - r1); z <= OAK.z + r1; z++) {
        const dx = x + 0.5 - OAK.x, dz = z + 0.5 - OAK.z, r = Math.hypot(dx, dz);
        if (r >= r0 && r < r1) put(x, z, Math.atan2(dz, dx));
      }
    }
  };

  // ---- the walks: in front of the shops, down the green's sides, the old paving round the oak, and spokes
  box(156, top, -172, 157, top, -162, 'path');
  box(157, top, -161, 189, top, -160, 'cobble');
  box(157, top, -161, 158, top, -139, 'cobble');
  box(188, top, -161, 189, top, -139, 'cobble');
  ring(6.9, 8.6, (x, z) => one(x, top, z, (x * 7 + z * 3) % 5 === 0 ? 'mossy_stone' : 'stone_brick'));
  box(172, top, -159, 174, top, -158, 'cobble');
  box(159, top, -152, 165, top, -151, 'cobble');
  box(182, top, -152, 187, top, -151, 'cobble');
  // The lantern walk, from the paving down to the quay.
  box(172, top, -143, 174, top, -132, 'stone_brick');

  // ---- the oak: its body, two blocks of trunk the hero cannot walk through, and the lamps in its crown
  box(172, g, -153, 174, g + 1, -151, 'barrier');
  props.push({ kind: 'elderOak', variant: 0, x: OAK.x, y: g, z: OAK.z, rotation: 0 });
  for (const [dx, dz] of [[-4, 0], [4, 0], [0, -4], [0, 4], [-3, 3], [3, 3]] as const) glowAt(fills, Math.floor(OAK.x + dx), Math.floor(OAK.z + dz), g + 4);

  // ---- the ruin: broken pillars of the old hall on the oak's north side, tall at the back, a lintel and ivy
  const pillars: [angle: number, high: number][] = [[180, 2], [205, 3], [230, 4], [255, 5], [285, 5], [310, 4], [335, 3], [0, 2]];
  for (const [deg, high] of pillars) {
    const a = (deg * Math.PI) / 180;
    const x = Math.floor(OAK.x + Math.cos(a) * 5.4), z = Math.floor(OAK.z + Math.sin(a) * 5.4);
    one(x, g, z, 'mossy_stone');
    if (high > 1) box(x, g + 1, z, x, g + high - 1, z, 'stone_brick');
    if (high >= 4) one(x, g + high - 1, z, 'mossy_stone');
  }
  // The lintel left standing across the back, with ivy over it.
  ring(5.0, 5.9, (x, z, angle) => {
    const deg = ((angle * 180) / Math.PI + 360) % 360;
    if (deg >= 250 && deg <= 290) {
      one(x, g + 4, z, 'stone_brick');
      if ((x + z) % 2 === 0) one(x, g + 5, z, 'oak_leaves');
    }
  });

  // ---- the gate: two pillars of the old realm on either side of the road, and a hedge each way
  box(135, g, -177, 136, g + 5, -177, 'stone_brick');
  box(135, g, -177, 136, g, -177, 'mossy_stone');
  one(135, g + 6, -177, 'mossy_stone');
  one(136, g + 6, -177, 'oak_leaves');
  box(135, g, -171, 136, g + 3, -171, 'stone_brick');
  box(135, g + 3, -171, 135, g + 3, -171, 'mossy_stone');
  for (const [z0, z1] of [[-190, -179], [-169, -148]] as const) {
    box(135, g, z0, 135, g, z1, 'mossy_stone');
    box(135, g + 1, z0, 135, g + 1, z1, 'oak_leaves');
  }
  props.push(
    townProp('banner', 133, -178, -QUARTER, 2), townProp('banner', 133, -170, -QUARTER, 2),
    townProp('bunting', 137, -174, QUARTER), townProp('bunting', 150, -174, QUARTER),
  );
  lanternAt(fills, props, 133, -176, 0);
  lanternAt(fills, props, 133, -172, 0);

  // ---- the main street: lanterns and the realm's banners down its south side
  for (const x of [148, 168, 179]) lanternAt(fills, props, x, -172, 0);
  for (const x of [142, 160, 186]) props.push(townProp('banner', x, -172, 0, 0));

  // ---- the green: strings of lanterns over its sides, stone lanterns down to the river
  for (const [x, z] of [[163, -146], [184, -146], [163, -156], [184, -156]] as const) {
    props.push(townProp('stringLights', x, z, 0));
    for (const dx of [-3, 0, 3]) glowAt(fills, x + dx, z);
  }
  for (const z of [-141, -138, -135]) for (const x of [171, 175]) lanternAt(fills, props, x, z, 2);
  lanternAt(fills, props, 171, -132, 0);
  lanternAt(fills, props, 175, -132, 0);
  for (const [x, z] of [[158, -160], [188, -160], [158, -140], [188, -140]] as const) lanternAt(fills, props, x, z, 1);
  for (const x of [143, 151, 161, 185, 195, 201]) lanternAt(fills, props, x, -133, 0);

  // ---- life on the green: benches under the oak, the market on its east side, flowers at the doors
  props.push(
    townProp('bench', 165, -148, 1.1), townProp('bench', 181, -148, -1.1), townProp('bench', 166, -142, 0.5), townProp('bench', 180, -142, -0.5),
    townProp('harvestStall', 184, -151, -QUARTER), townProp('stall', 184, -143, -QUARTER, 1), townProp('stall', 162, -143, QUARTER, 2),
    townProp('sack', 186, -149, 0.5, 1), townProp('crate', 186, -145, 0.2, 1), townProp('barrel', 160, -145, 0, 0), townProp('cart', 182, -158, 0.3, 1),
    townProp('noticeBoard', 163, -159, 0), townProp('planter', 165, -161, 0), townProp('planter', 176, -161, 0), townProp('planter', 154, -161, 0),
    townProp('wildflowers', 168, -155, 0.4), townProp('wildflowers', 179, -156, 2.1), townProp('wildflowers', 167, -147, 1.3), townProp('wildflowers', 180, -146, 2.8),
    townProp('wildflowers', 164, -137, 0.9), townProp('wildflowers', 183, -136, 1.9), townProp('hayBale', 189, -144, 0.3),
    townProp('bench', 163, -134, 0), townProp('bench', 183, -134, 0),
  );

  places.push({ name: 'town.square', x: 173, y: g, z: -143, label: 'Lantern Green' });

  return {
    fills,
    places,
    props,
    buildings: [
      { id: 'cottage.gate', blueprint: 'cottage', x: 140, z: -183, turns: 0 },
      { id: 'granary', blueprint: 'barn', x: 151, z: -185, turns: 0, place: { name: 'granary', label: 'Granary', at: 'door' } },
      { id: 'sawmill.office', blueprint: 'shop', x: 164, z: -184, turns: 0, sign: 2 },
      { id: 'cottage.north', blueprint: 'cottage', x: 176, z: -183, turns: 0 },
      { id: 'wren.house', blueprint: 'cottage', x: 187, z: -183, turns: 0 },
      // The north side of the green.
      { id: 'lodge', blueprint: 'shop', x: 158, z: -170, turns: 0, sign: 2, place: { name: 'lodge', label: 'Lodge', at: 'outside' } },
      { id: 'bakery', blueprint: 'shop', x: 169, z: -170, turns: 0, sign: 1, place: { name: 'bakery', label: 'Bakery', at: 'outside' } },
      { id: 'cottage.square', blueprint: 'cottage', x: 180, z: -169, turns: 0 },
      // The west side, doors to the east.
      { id: 'carpenter', blueprint: 'shop', x: 147, z: -160, turns: 1, sign: 0, place: { name: 'carpenter', label: 'Carpenter', at: 'outside' } },
      { id: 'cottage.river', blueprint: 'cottage', x: 148, z: -149, turns: 1 },
    ],
    trees: [
      { x: 146, z: -188, kind: 'birch', size: 0.5 },
      { x: 174, z: -189, kind: 'oak', size: 0.4 },
      { x: 199, z: -186, kind: 'birch', size: 0.7 },
      { x: 141, z: -141, kind: 'oak', size: 0.7 },
      { x: 152, z: -136, kind: 'birch', size: 0.6 },
      { x: 193, z: -136, kind: 'birch', size: 0.4 },
    ],
    // The ground under the hedge and the gate's pillars.
    levels: [{ x0: 129, z0: -190, x1: 137, z1: -146, ground: g, blend: 4 }],
  };
}
