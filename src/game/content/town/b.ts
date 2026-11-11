// Hollowmere B: the Hollow Oak. The town is named for it: an oak older than the kingdom, hollow at its foot,
// grown up through the hall of an old realm until only a ring of broken pillars is left. Hollowmere tells it
// as "the forest ate them for their pride", and keeps the tree in the middle of town to remember it by. A
// stone gardener stands at its foot: the Warden of the Old Gate, as the town carves it.
//
// The grey square becomes the Lantern Green: grass under the oak, a ring of old paving around it, and
// walks out to the doors round it. At the festival the lamps hang in the oak before they are floated, so the
// green is lit from above, and a walk of stone lanterns leads from the tree down to the river where they go
// on the water. The town's edge toward the meadow is a hedge, for the Hedgewardens who keep the old ways,
// with a broken pair of the old realm's pillars for its gate. The queen's granary-hall faces the main street.
//
// The buildings and street pieces are the Hollowmere town kit (src/content/town-kit.ts). The oak, the ruin,
// the hedge and the stone lanterns are this town's own.
import { blockPen, glowAt, lanternAt, modelAt, townEdges, townProp, TOWN_GROUND, type TownPlan } from './kit.ts';
import { lampPostAt, porchLights, stringLightsAt } from './lights.ts';

const QUARTER = Math.PI / 2;

/** The middle of the oak's trunk: the middle of block (173, -152). */
const OAK = { x: 173.5, z: -151.5 };

export function townB(): TownPlan {
  const fills: TownPlan['fills'] = [], places: TownPlan['places'] = [], props: TownPlan['props'] = [], models: TownPlan['models'] = [];
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

  // ---- the walks: the alley, in front of the doors, down the green's sides, the old paving round the oak, spokes
  box(153, top, -172, 154, top, -162, 'path');
  box(155, top, -161, 189, top, -160, 'cobble');
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
  for (const [dx, dz] of [[-4, 0], [4, 0], [0, -4], [-3, 3], [3, 3]] as const) glowAt(fills, Math.floor(OAK.x + dx), Math.floor(OAK.z + dz), g + 4);
  // The Warden stands at the oak's foot on its west side, so the green south of the oak is open for the festival.
  modelAt(models, 'warden.statue', 'statue-gardener-warden', 167.5, -148.5);

  // ---- the ruin: broken pillars of the old hall on the oak's north side, tall at the back, a lintel and ivy
  const pillars: [angle: number, high: number][] = [[180, 2], [205, 3], [230, 4], [255, 5], [285, 5], [310, 4], [335, 3], [0, 2]];
  for (const [deg, high] of pillars) {
    const a = (deg * Math.PI) / 180;
    const x = Math.floor(OAK.x + Math.cos(a) * 5.4), z = Math.floor(OAK.z + Math.sin(a) * 5.4);
    one(x, g, z, 'mossy_stone');
    if (high > 1) box(x, g + 1, z, x, g + high - 1, z, 'stone_brick');
    if (high >= 4) one(x, g + high - 1, z, 'mossy_stone');
  }
  ring(5.0, 5.9, (x, z, angle) => {
    const deg = ((angle * 180) / Math.PI + 360) % 360;
    if (deg >= 250 && deg <= 290) {
      one(x, g + 4, z, 'stone_brick');
      if ((x + z) % 2 === 0) one(x, g + 5, z, 'oak_leaves');
    }
  });

  // ---- the buildings. North of the main street: homes, the queen's granary-hall and the kennel keeper's cottage.
  modelAt(models, 'house.gate', 'house-c', 144, -180.5);
  modelAt(models, 'granary', 'granary-hall', 158, -182, 0, { name: 'granary', label: 'Granary', at: 'door' });
  modelAt(models, 'house.north2', 'house-d', 170, -181);
  modelAt(models, 'house.north3', 'house-b', 179.5, -181);
  modelAt(models, 'wren.house', 'house-a', 188.5, -180);
  modelAt(models, 'kennel.cottage', 'kennel', 199, -177);
  // The north side of the green: the lodge, the bakery and a farmhouse.
  modelAt(models, 'lodge', 'lodge', 161, -167, 0, { name: 'lodge', label: 'Lodge', at: 'outside' });
  modelAt(models, 'bakery', 'bakery', 173, -167, 0, { name: 'bakery', label: 'Bakery', at: 'outside' });
  modelAt(models, 'house.green', 'house-c', 184, -167.5);
  // The west side, doors to the east: Mira's workshop and a house. The ferry keeper's house by the river.
  modelAt(models, 'carpenter', 'workshop', 151, -155, 1, { name: 'carpenter', label: 'Carpenter', at: 'outside' });
  modelAt(models, 'house.river', 'house-b', 151, -145.5, 1);
  modelAt(models, 'ferry.house', 'ferry-house', 198, -136.5);
  // The town well on the green's west side.
  modelAt(models, 'well', 'town-well', 163, -156);
  porchLights(fills, models);

  // ---- the gate: two pillars of the old realm on either side of the road, and a hedge each way
  box(135, g, -177, 136, g + 5, -177, 'stone_brick');
  box(135, g, -177, 136, g, -177, 'mossy_stone');
  one(135, g + 6, -177, 'mossy_stone');
  one(136, g + 6, -177, 'oak_leaves');
  box(135, g, -171, 136, g + 3, -171, 'stone_brick');
  one(135, g + 3, -171, 'mossy_stone');
  // The hedge is a row of bushes. Nobody walks through it.
  for (const [z0, z1] of [[-190, -179], [-169, -148]] as const) {
    box(135, g, z0, 135, g + 1, z1, 'barrier');
    for (let z = z0; z <= z1; z += 2) props.push({ ...townProp('bush', 135, z, z * 1.7, Math.abs(z >> 1) % 3), scale: 2.4 + (Math.abs(z * 7) % 5) * 0.1 });
  }
  props.push(
    townProp('banner', 133, -179, -QUARTER, 2), townProp('banner', 133, -169, -QUARTER, 2),
    townProp('bunting', 137, -174, QUARTER), townProp('bunting', 150, -174, QUARTER),
  );
  lanternAt(fills, props, 133, -176, 0);
  lanternAt(fills, props, 133, -172, 0);

  // ---- lamps: the main street, the green's corners, the quay; strings of lanterns out from the oak
  // A row back from the street, so the way out of the gate stays wide.
  for (const [i, x] of [143.5, 149.5].entries()) lampPostAt(fills, models, `lamp.street${i}`, x, -170.5);
  for (const [i, [x, z]] of ([[158.5, -141], [187.5, -141], [186.5, -158]] as const).entries()) lampPostAt(fills, models, `lamp.green${i}`, x, z);
  for (const [i, x] of [141.5, 149.5, 157.5, 163.5, 182.5, 188.5].entries()) lampPostAt(fills, models, `lamp.quay${i}`, x, -133);
  stringLightsAt(fills, models, 'lights.west', 163.5, -146.5);
  stringLightsAt(fills, models, 'lights.east', 183.5, -146.5);
  stringLightsAt(fills, models, 'lights.north', 182, -156, 1);
  // Stone lanterns down the lantern walk, and a lamp either side of where it meets the quay.
  for (const z of [-138, -135]) for (const x of [171, 175]) lanternAt(fills, props, x, z, 2);
  lanternAt(fills, props, 171, -132, 0);
  lanternAt(fills, props, 175, -132, 0);

  // ---- life on the green: the market on its east side, benches under the oak, flowers at the doors
  modelAt(models, 'stall.east1', 'market-stall-b', 186.5, -152.5, 3);
  modelAt(models, 'stall.east2', 'market-stall-a', 186.5, -146.5, 3);
  modelAt(models, 'planter.lodge', 'flower-planter', 165.5, -162);
  modelAt(models, 'planter.bakery', 'flower-planter', 177.5, -162);
  modelAt(models, 'bench.quay1', 'bench', 153.5, -133);
  modelAt(models, 'bench.quay2', 'bench', 145.5, -133);
  modelAt(models, 'cart.green', 'cart', 180.5, -137, 1);
  props.push(
    townProp('bench', 164, -150, 1.1), townProp('bench', 183, -150, -1.1),
    townProp('noticeBoard', 158, -163, 0),
    townProp('wildflowers', 168, -155, 0.4), townProp('wildflowers', 179, -156, 2.1), townProp('wildflowers', 167, -147, 1.3), townProp('wildflowers', 180, -145, 2.8),
    townProp('wildflowers', 164, -137, 0.9), townProp('wildflowers', 184, -136, 1.9),
  );

  // On the green south of the oak, clear of the quay's sound and with room all round for the festival.
  places.push({ name: 'town.square', x: 173, y: g, z: -145, label: 'Lantern Green' });

  return {
    fills, places, props, models,
    buildings: [],
    trees: [
      { x: 146, z: -189, kind: 'birch', size: 0.5 },
      { x: 174, z: -190, kind: 'oak', size: 0.4 },
      { x: 192, z: -188, kind: 'birch', size: 0.7 },
      { x: 141, z: -141, kind: 'oak', size: 0.7 },
      { x: 152, z: -136, kind: 'birch', size: 0.6 },
    ],
    // The ground under the hedge and the gate's pillars, and under the kennel keeper's cottage.
    levels: [
      { x0: 129, z0: -190, x1: 137, z1: -146, ground: g, blend: 9 },
      { x0: 193, z0: -182, x1: 205, z1: -172, ground: g, blend: 8 },
    ],
  };
}
