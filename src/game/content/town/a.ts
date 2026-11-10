// Hollowmere A: the Queen's Granary. A farming kingdom is ruled from its granary, so the seat of power is a
// hall of grain: Dot's granary-hall, with its arcade and lantern cupola, closes the north side of the
// Harvest Court. A broad stone way runs from the hall's doors across the court to the Rootworks gate on the
// river, where the old realm's bronze roots and waterwheel drink the Mere: the town lives on what it takes
// from the river, and builds its square around the taking. Market rows line the court for the harvest.
//
// The buildings and street pieces are the Hollowmere town kit (src/content/town-kit.ts). Blocks are the
// paving, the gatehouse and its walls. At dusk the windows glow, braziers burn at the hall's doors, lamps
// stand round the court and along the quay, and strings of lanterns hang over the market.
import { blockPen, glowAt, modelAt, townEdges, townProp, TOWN_GROUND, type TownPlan } from './kit.ts';
import { porchLights, lampPostAt, stringLightsAt } from './lights.ts';

const QUARTER = Math.PI / 2;

export function townA(): TownPlan {
  const fills: TownPlan['fills'] = [], places: TownPlan['places'] = [], props: TownPlan['props'] = [], models: TownPlan['models'] = [];
  const { box, one } = blockPen(fills);
  const g = TOWN_GROUND, top = g - 1;
  townEdges(fills, places, props);

  // ---- the court: cobble inside a border of stone brick, the stone way from the hall to the river, the alley
  box(157, top, -161, 189, top, -139, 'cobble');
  box(157, top, -161, 189, top, -161, 'stone_brick');
  box(157, top, -139, 189, top, -139, 'stone_brick');
  box(157, top, -161, 157, top, -139, 'stone_brick');
  box(189, top, -161, 189, top, -139, 'stone_brick');
  box(170, top, -162, 173, top, -132, 'stone_brick');
  box(162, top, -172, 164, top, -162, 'path');
  // Two beds of grass and flowers either side of the way to the hall.
  box(164, top, -159, 167, top, -156, 'grass');
  box(176, top, -159, 179, top, -156, 'grass');
  for (const x of [164, 176]) props.push(townProp('bush', x + 1, -158, 0.4, 2), townProp('wildflowers', x, -156, 1.1), townProp('wildflowers', x + 3, -157, 2.3));

  // ---- the buildings. North of the main street, a row of homes and the kennel keeper's cottage.
  modelAt(models, 'house.gate', 'house-c', 144, -180.5);
  modelAt(models, 'house.north1', 'house-d', 154, -181);
  modelAt(models, 'house.north2', 'house-b', 163.5, -181);
  modelAt(models, 'house.north3', 'house-a', 172.5, -180);
  modelAt(models, 'house.north4', 'house-c', 182, -180.5);
  modelAt(models, 'wren.house', 'house-a', 190.5, -180);
  modelAt(models, 'kennel.cottage', 'kennel', 199, -177);
  // The north side of the court: the lodge, the hall, the bakery.
  modelAt(models, 'lodge', 'lodge', 156, -167, 0, { name: 'lodge', label: 'Lodge', at: 'outside' });
  modelAt(models, 'granary', 'granary-hall', 172, -166, 0, { name: 'granary', label: 'Granary', at: 'door' });
  modelAt(models, 'bakery', 'bakery', 185, -167, 0, { name: 'bakery', label: 'Bakery', at: 'outside' });
  // The west side, doors to the east: Mira's workshop and a house.
  modelAt(models, 'carpenter', 'workshop', 151, -155, 1, { name: 'carpenter', label: 'Carpenter', at: 'outside' });
  modelAt(models, 'house.river', 'house-b', 151, -145.5, 1);
  // The Rootworks gate over the stone way at the river, its arch open on the way, and the ferry keeper's house.
  modelAt(models, 'rootworks', 'rootworks-gate', 172, -135);
  modelAt(models, 'ferry.house', 'ferry-house', 198, -136.5);
  porchLights(fills, models);

  // ---- the gatehouse: two towers of stone either side of the road, open to the sky, and a short wall each way
  for (const [z0, z1] of [[-179, -177], [-171, -169]] as const) {
    box(134, g, z0, 136, g + 6, z1, 'stone_brick');
    box(134, g, z0, 136, g, z1, 'cobble');
    for (let x = 134; x <= 136; x += 2) for (let z = z0; z <= z1; z += 2) one(x, g + 7, z, 'stone_brick');
    one(134, g + 4, z0 + 1, 'lamp');
  }
  box(135, g, -186, 135, g + 2, -180, 'stone_brick');
  box(135, g, -168, 135, g + 2, -160, 'stone_brick');
  box(135, g + 3, -186, 135, g + 3, -180, 'cobble');
  box(135, g + 3, -168, 135, g + 3, -160, 'cobble');
  props.push(townProp('bunting', 135, -174, QUARTER), townProp('bunting', 150, -174, QUARTER));
  modelAt(models, 'banner.gate1', 'banner-pole', 133, -181, 3);
  modelAt(models, 'banner.gate2', 'banner-pole', 133, -167, 3);
  lampPostAt(fills, models, 'lamp.gate1', 132.5, -178.5, 3);
  lampPostAt(fills, models, 'lamp.gate2', 132.5, -169.5, 3);
  modelAt(models, 'warden.statue', 'statue-gardener-warden', 131.5, -182.5, 0);

  // ---- the main street: lamps before the houses on its north side, the harvest's banners on its south side.
  for (const [i, x] of [143.5, 158.5, 176.5, 192.5].entries()) lampPostAt(fills, models, `lamp.street${i}`, x, -176.5);
  // A row back from the street, so the way out of the gate stays wide.
  for (const [i, x] of [143, 147].entries()) modelAt(models, `banner.street${i}`, 'banner-pole', x, -170);

  // ---- the hall's front: the crown's banners and two braziers at its doors
  modelAt(models, 'banner.hall1', 'banner-pole', 166, -160);
  modelAt(models, 'banner.hall2', 'banner-pole', 179, -160);
  for (const x of [168, 175]) {
    props.push(townProp('brazier', x, -160));
    glowAt(fills, x, -160, g + 1);
  }

  // ---- the market rows down both sides of the court, under strings of lanterns, with the harvest piled up
  for (const [i, z] of [-156.5, -151.5, -146.5, -141.5].entries()) {
    modelAt(models, `stall.west${i}`, i % 2 ? 'market-stall-b' : 'market-stall-a', 159.5, z, 1);
    modelAt(models, `stall.east${i}`, i % 2 ? 'market-stall-a' : 'market-stall-b', 186.5, z, 3);
  }
  stringLightsAt(fills, models, 'lights.west', 164, -153, 1);
  stringLightsAt(fills, models, 'lights.east', 182, -153, 1);
  modelAt(models, 'crates.west', 'barrels-crates', 159.5, -137);
  modelAt(models, 'cart.court', 'cart', 180.5, -158, 1);

  // ---- lamps round the court and along the quay, benches and flowers by the river
  for (const [i, [x, z]] of ([[158.5, -137], [186.5, -137], [166.5, -151], [177.5, -151]] as const).entries()) lampPostAt(fills, models, `lamp.court${i}`, x, z);
  for (const [i, x] of [141.5, 149.5, 157.5, 163.5, 180.5, 186.5].entries()) lampPostAt(fills, models, `lamp.quay${i}`, x, -133);
  modelAt(models, 'bench.quay1', 'bench', 153.5, -133);
  modelAt(models, 'bench.quay2', 'bench', 145.5, -133);
  modelAt(models, 'planter.lodge', 'flower-planter', 159.5, -162);
  modelAt(models, 'planter.bakery', 'flower-planter', 181.5, -160);
  props.push(townProp('noticeBoard', 160, -158, QUARTER));

  // The festival ground: the court's south half, open in front of the stone way.
  places.push({ name: 'town.square', x: 172, y: g, z: -143, label: 'Harvest Court' });

  return {
    fills, places, props, models,
    buildings: [],
    trees: [
      { x: 146, z: -189, kind: 'birch', size: 0.5 },
      { x: 175, z: -190, kind: 'oak', size: 0.4 },
      { x: 186, z: -189, kind: 'birch', size: 0.7 },
      { x: 141, z: -138, kind: 'oak', size: 0.8 },
      { x: 155, z: -137, kind: 'oak', size: 0.6 },
    ],
    // The ground under the gatehouse's walls and the statue, and under the kennel keeper's cottage.
    levels: [
      { x0: 128, z0: -190, x1: 137, z1: -156, ground: g, blend: 4 },
      { x0: 193, z0: -182, x1: 205, z1: -172, ground: g, blend: 3 },
    ],
  };
}
