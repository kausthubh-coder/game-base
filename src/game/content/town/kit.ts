// What a plan of Hollowmere hands the region, and the small tools every plan writes its blocks with.
// Hollowmere comes in more than one layout while Kausthubh chooses between redesigns (see pick.ts). Each
// layout is a file here that returns a `TownPlan`. The rest of the region (the grant, the garden, the path,
// the river basin) is the same under every one.
//
// Coordinates are whole blocks, as in region.ts: x runs east, z runs south, y is up.
import type { TownModelName } from '../../../content/town-kit.ts';
import { TOWN_MODELS } from '../../../content/town-kit.ts';
import type { Fill, Level, PlanBuilding, PlanModel, PlanPlace, PlanProp, PlanTree } from '../region.ts';

/** Feet height of the town's floors and streets. */
export const TOWN_GROUND = 20;

export interface TownPlan {
  fills: Fill[];
  buildings: PlanBuilding[];
  /** Models of the town kit. A layout of blocks has none. */
  models: PlanModel[];
  /**
   * The town's named places. Every layout gives `town.gate`, `town.square`, `gus.field`, `kennel`,
   * `river.bank` and `ferry` here, and `granary`, `lodge`, `bakery` and `carpenter` through its buildings or models.
   */
  places: PlanPlace[];
  trees: PlanTree[];
  props: PlanProp[];
  /** More level ground than the town's own, such as a terrace. Later levels win where they overlap. */
  levels: Level[];
}

/** The pen a plan writes blocks with. Later fills replace earlier ones. */
export function blockPen(fills: Fill[]) {
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: string): void => {
    fills.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), block });
  };
  const one = (x: number, y: number, z: number, block: string): void => box(x, y, z, x, y, z, block);
  /**
   * A post with a lamp on it, two blocks tall. The lamp sits at head height, under the line the camera's
   * cutaway hides above when the hero stands under an eave, so it never leaves a bare post behind.
   */
  const lampPost = (x: number, z: number, ground: number): void => {
    one(x, ground, z, 'oak_log');
    one(x, ground + 1, z, 'lamp');
  };
  return { box, one, lampPost };
}

/** A prop at the middle of block (x, z), standing on the town's ground. */
export const townProp = (kind: string, x: number, z: number, rotation = 0, variant = 0, y = TOWN_GROUND): PlanProp =>
  ({ kind, variant, x: x + 0.5, y, z: z + 0.5, rotation });

/**
 * What every layout keeps as it is today: the main street from the gate and the lane down to the river,
 * the quay and its wall, Gus's field, the kennel and the ferry, and the places at them.
 */
export function townEdges(fills: Fill[], places: PlanPlace[], props: PlanProp[]): void {
  const { box, one } = blockPen(fills);
  const g = TOWN_GROUND, top = g - 1;
  box(137, top, -175, 199, top, -173, 'path');
  box(190, top, -172, 192, top, -132, 'path');
  box(139, top, -131, 201, top, -129, 'stone_brick');
  box(139, 15, -129, 201, top, -129, 'stone_brick');
  box(194, top, -157, 202, top, -142, 'tilled_soil');

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

  places.push(
    { name: 'town.gate', x: 134, y: g, z: -174, label: 'Hollowmere' },
    { name: 'gus.field', x: 193, y: g, z: -149, label: 'Gus\'s field' },
    { name: 'kennel', x: 193, y: g, z: -166, label: 'Kennel' },
    { name: 'river.bank', x: 173, y: g, z: -131, label: 'River bank' },
    { name: 'ferry', x: 196, y: g, z: -125, label: 'Ferry' },
  );
  props.push(
    townProp('signpost', 131, -171),
    { kind: 'gate', variant: 1, x: 194.5, y: g, z: -165.5, rotation: Math.PI / 2 },
    townProp('hayBale', 197, -153, 2.1),
    townProp('hayBale', 201, -146, 0.6),
  );
}

/**
 * A lantern prop with its light: a block of lantern light at the lantern, so the ground around it is lit at
 * night as a lamp block would light it. A post's light sits at head height, a block under its glass, so the
 * pool on the paving is as bright as a lamp's. `variant` is the lantern's (post, double, ground).
 */
export function lanternAt(fills: Fill[], props: PlanProp[], x: number, z: number, variant = 0, rotation = 0): void {
  props.push(townProp('lantern', x, z, rotation, variant));
  const y = variant === 2 ? TOWN_GROUND : TOWN_GROUND + 1;
  // A double lantern hangs its two lights from an arm along its own x.
  if (variant === 1) {
    const along = Math.abs(Math.cos(rotation)) > 0.5;
    for (const d of [-1, 1]) fills.push({ x0: x + (along ? d : 0), y0: y, z0: z + (along ? 0 : d), x1: x + (along ? d : 0), y1: y, z1: z + (along ? 0 : d), block: 'lantern_light' });
  } else fills.push({ x0: x, y0: y, z0: z, x1: x, y1: y, z1: z, block: 'lantern_light' });
}

/** Lights hung over the ground: a block of lantern light at head height, under a string of lanterns or a crown. */
export function glowAt(fills: Fill[], x: number, z: number, y = TOWN_GROUND + 2): void {
  fills.push({ x0: x, y0: y, z0: z, x1: x, y1: y, z1: z, block: 'lantern_light' });
}

/** The footprint of a kit model once it is turned, x by z. */
export function turnedFootprint(model: TownModelName, turns: number): [number, number] {
  const [w, d] = TOWN_MODELS[model].footprint;
  return turns % 2 === 0 ? [w, d] : [d, w];
}

/**
 * Sets a kit model down with its footprint's middle at (cx, cz), which may be a half block. The footprint
 * is whole metres, so its corner is the middle less half of it.
 */
export function modelAt(models: PlanModel[], id: string, model: TownModelName, cx: number, cz: number, turns = 0, place?: PlanModel['place']): PlanModel {
  const [w, d] = turnedFootprint(model, turns);
  const plan: PlanModel = { id, model, x: Math.round(cx - w / 2), z: Math.round(cz - d / 2), turns, ...(place ? { place } : {}) };
  models.push(plan);
  return plan;
}
