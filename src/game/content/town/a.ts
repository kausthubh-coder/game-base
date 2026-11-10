// Hollowmere A: the Queen's Granary. A farming kingdom is ruled from its granary, so the seat of power is a
// hall of grain. The cobbled square becomes the Harvest Court: the granary-hall and its bell tower close
// its north side, a broad stone way runs from the hall's doors past the Root Fountain to the river, and
// the harvest comes in to market rows on either side. In the fountain the Rootworks' brass roots lift the
// Mere's water and hold up a stone of lume: the town drinks the river, and shows it off.
//
// Gold sheaves on green fly over the gatehouse, the hall and the court. At dusk braziers burn at the
// hall's doors, lanterns line the street, the court and the quay, and strings of lanterns hang over the
// market. The belfry stays lit all night.
import { blockPen, glowAt, lanternAt, townEdges, townProp, TOWN_GROUND, type TownPlan } from './kit.ts';

const QUARTER = Math.PI / 2;

/**
 * The middle of the fountain, on the corner between blocks 171 and 172 and blocks -140 and -139: at the
 * river end of the stone way, where the roots draw the Mere. The court between it and the hall is open,
 * so Maren walks straight down from her doors to the festival and the crowd stands clear of the basin.
 */
const FOUNTAIN = { x: 172, z: -139 };

export function townA(): TownPlan {
  const fills: TownPlan['fills'] = [], places: TownPlan['places'] = [], props: TownPlan['props'] = [];
  const { box, one } = blockPen(fills);
  const g = TOWN_GROUND, top = g - 1;
  townEdges(fills, places, props);

  // ---- the court: cobble inside a border of stone brick, and the stone way from the hall to the quay
  box(157, top, -161, 189, top, -139, 'cobble');
  box(157, top, -161, 189, top, -161, 'stone_brick');
  box(157, top, -139, 189, top, -139, 'stone_brick');
  box(157, top, -161, 157, top, -139, 'stone_brick');
  box(189, top, -161, 189, top, -139, 'stone_brick');
  box(170, top, -162, 173, top, -132, 'stone_brick');
  // A ring of stone around the fountain, and the alley from the main street between the lodge and the hall.
  box(167, top, -144, 176, top, -134, 'stone_brick');
  box(168, top, -143, 175, top, -135, 'cobble');
  box(162, top, -172, 163, top, -162, 'path');
  // Two beds of grass and flowers in the court, either side of the way to the hall.
  box(164, top, -159, 167, top, -156, 'grass');
  box(176, top, -159, 179, top, -156, 'grass');
  for (const x of [164, 176]) {
    props.push(townProp('bush', x + 1, -158, 0.4, 2), townProp('wildflowers', x, -156, 1.1), townProp('wildflowers', x + 3, -157, 2.3), townProp('bush', x + 3, -159, 1.9, 0));
  }
  // The fountain stands on the stones; a body of two blocks keeps walkers out of its basin.
  box(FOUNTAIN.x - 2, g, FOUNTAIN.z - 2, FOUNTAIN.x + 1, g + 1, FOUNTAIN.z + 1, 'barrier');
  props.push({ kind: 'rootFountain', variant: 0, x: FOUNTAIN.x, y: g, z: FOUNTAIN.z, rotation: 0 });
  glowAt(fills, FOUNTAIN.x - 3, FOUNTAIN.z, g + 1);
  glowAt(fills, FOUNTAIN.x + 2, FOUNTAIN.z, g + 1);

  // ---- the gatehouse: two towers of stone with a walk across the street, and a short wall each way
  for (const [z0, z1] of [[-179, -177], [-171, -169]] as const) {
    box(134, g, z0, 136, g + 6, z1, 'stone_brick');
    box(134, g, z0, 136, g, z1, 'cobble');
    // Teeth on top, and a lit window toward the road.
    for (let x = 134; x <= 136; x += 2) for (let z = z0; z <= z1; z += 2) one(x, g + 7, z, 'stone_brick');
    one(133 + 1, g + 4, z0 + 1, 'lamp');
  }
  // Nothing is built over the road, so the path stays open to the sky: bunting hangs between the towers.
  props.push(townProp('bunting', 135, -174, QUARTER));
  box(135, g, -186, 135, g + 2, -180, 'stone_brick');
  box(135, g, -168, 135, g + 2, -160, 'stone_brick');
  box(135, g + 3, -186, 135, g + 3, -180, 'cobble');
  box(135, g + 3, -168, 135, g + 3, -160, 'cobble');
  props.push(
    townProp('banner', 133, -178, -QUARTER, 0), townProp('banner', 133, -170, -QUARTER, 0),
    townProp('banner', 137, -178, QUARTER, 1), townProp('banner', 137, -170, QUARTER, 1),
  );
  lanternAt(fills, props, 133, -176, 0);
  lanternAt(fills, props, 133, -172, 0);

  // ---- the main street: banners of the harvest down its south side, lanterns between them
  for (const x of [143, 155, 182, 197]) props.push(townProp('banner', x, -172, 0, 1));
  for (const x of [149, 161, 187]) lanternAt(fills, props, x, -172, 1);
  props.push(townProp('bunting', 150, -174, QUARTER), townProp('bunting', 172, -157, 0));

  // ---- the hall's front: the crown's banners and two braziers at its doors, flowers under its windows
  props.push(townProp('banner', 166, -161, 0, 0), townProp('banner', 177, -161, 0, 0));
  for (const x of [168, 175]) {
    props.push(townProp('brazier', x, -161));
    glowAt(fills, x, -161, g + 1);
  }
  for (const x of [165.5, 178.5]) props.push({ kind: 'planter', variant: 0, x, y: g, z: -161.6, rotation: 0 });

  // ---- the market rows: stalls down both sides of the court, and the harvest piled behind them
  props.push(
    townProp('harvestStall', 161, -157, QUARTER), townProp('stall', 161, -152, QUARTER, 0), townProp('harvestStall', 161, -147, QUARTER),
    townProp('stall', 161, -142, QUARTER, 2),
    townProp('stall', 184, -157, -QUARTER, 1), townProp('harvestStall', 184, -152, -QUARTER), townProp('stall', 184, -147, -QUARTER, 0),
    townProp('harvestStall', 184, -142, -QUARTER),
    townProp('sack', 159, -155, 0.4, 1), townProp('crate', 159, -150, 0, 1), townProp('barrel', 159, -145, 0, 1), townProp('sack', 158, -143, 1.2, 0),
    townProp('crate', 186, -155, 0.3, 0), townProp('sack', 186, -150, 2.0, 1), townProp('barrel', 186, -145, 0, 0), townProp('crate', 187, -141, 0.2, 1),
    townProp('cart', 179, -159, 0.3, 1), townProp('hayBale', 165, -158, 0.4), townProp('hayBale', 188, -159, 1.3),
  );
  // Strings of lanterns over each row, and benches facing the fountain.
  props.push(townProp('stringLights', 164, -151, QUARTER), townProp('stringLights', 181, -151, QUARTER));
  for (const [x, z] of [[164, -155], [164, -151], [164, -147], [181, -155], [181, -151], [181, -147]] as const) glowAt(fills, x, z);
  props.push(townProp('bench', 165, -139, QUARTER), townProp('bench', 178, -139, -QUARTER));

  // ---- lanterns round the court and down the stone way, and along the quay
  for (const [x, z] of [[158, -160], [188, -160], [158, -140], [188, -140], [166, -151], [178, -151], [167, -144], [176, -144], [167, -134], [176, -134]] as const) {
    lanternAt(fills, props, x, z, 0);
  }
  for (const x of [143, 151, 161, 181, 189, 201]) lanternAt(fills, props, x, -133, 0);
  props.push(
    townProp('noticeBoard', 158, -157, QUARTER), townProp('planter', 156, -161, 0), townProp('planter', 186, -161, 0),
    townProp('bench', 163, -134, 0), townProp('bench', 181, -134, 0),
    townProp('wildflowers', 160, -136), townProp('wildflowers', 186, -135, 1.2), townProp('wildflowers', 145, -136, 2.2),
  );

  // The festival ground: the court's south half, north of the fountain.
  places.push({ name: 'town.square', x: 172, y: g, z: -144, label: 'Harvest Court' });

  return {
    fills,
    places,
    props,
    buildings: [
      // The north row along the main street.
      { id: 'cottage.gate', blueprint: 'cottage', x: 140, z: -183, turns: 0 },
      { id: 'storehouse', blueprint: 'barn', x: 151, z: -185, turns: 0 },
      { id: 'sawmill.office', blueprint: 'shop', x: 164, z: -184, turns: 0, sign: 2 },
      { id: 'cottage.north', blueprint: 'cottage', x: 176, z: -183, turns: 0 },
      { id: 'wren.house', blueprint: 'cottage', x: 187, z: -183, turns: 0 },
      // The north side of the court: the lodge, the hall, the bakery.
      { id: 'lodge', blueprint: 'shop', x: 152, z: -170, turns: 0, sign: 2, place: { name: 'lodge', label: 'Lodge', at: 'outside' } },
      { id: 'granary', blueprint: 'hall', x: 164, z: -172, turns: 0, place: { name: 'granary', label: 'Granary', at: 'door' } },
      { id: 'bakery', blueprint: 'shop', x: 180, z: -170, turns: 0, sign: 1, place: { name: 'bakery', label: 'Bakery', at: 'outside' } },
      // The west side, doors to the east.
      { id: 'carpenter', blueprint: 'shop', x: 147, z: -160, turns: 1, sign: 0, place: { name: 'carpenter', label: 'Carpenter', at: 'outside' } },
      { id: 'cottage.river', blueprint: 'cottage', x: 148, z: -149, turns: 1 },
    ],
    trees: [
      { x: 146, z: -188, kind: 'birch', size: 0.5 },
      { x: 174, z: -189, kind: 'oak', size: 0.4 },
      { x: 199, z: -186, kind: 'birch', size: 0.7 },
      { x: 154, z: -136, kind: 'oak', size: 0.6 },
      { x: 196, z: -135, kind: 'birch', size: 0.5 },
      { x: 140, z: -140, kind: 'oak', size: 0.8 },
    ],
    // The ground under the gatehouse's walls.
    levels: [{ x0: 129, z0: -190, x1: 137, z1: -156, ground: g, blend: 4 }],
  };
}
