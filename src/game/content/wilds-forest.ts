// The Old Forest and the grey forest, dressed from their approved kits (assets-src/concept/region-forests): the
// models set down there, as `LANDMARKS` and `LANDMARK_SIZES` in greenhollow.ts read them. This file is the
// forest's own, so its builders never edit the shared lists. Plain numbers and names only: the terrain reads it in
// its worker.
//
// The trees themselves are the painted tree system's old oaks (`oldOak` in src/content/painted.ts), grown by the
// terrain as a grove (greenhollow-land.sim.ts, `groveTree`): one giant to a block of 20 by 20, young oaks between.
// This file says where that grove opens (`GLADES`) and where its bee trees stand (`BEE_TREES`).

import type { MapPoint } from './greenhollow.ts';

/**
 * Where the forest opens, after the package's plan (pins A to D) and its Bramble's clearing (27): an oval `w` by `d`
 * blocks round `at`. No young tree grows inside it. A giant oak's trunk stands `canopy` blocks back from its edge, so
 * its crown leaves the sky open over a canopy gap; below 0 a giant may stand that far inside, and the grove is a hall
 * under giant crowns with open ground.
 */
export const GLADES: readonly { id: string; at: MapPoint; w: number; d: number; canopy: number }[] = [
  // A: the Seed Vault's approach, sun on its door.
  { id: 'vault', at: [154, 300], w: 26, d: 20, canopy: 5 },
  // B: a gap over the forest stair, so its descent is seen from above.
  { id: 'stair', at: [252, 257], w: 14, d: 18, canopy: 5 },
  // C: the forest shrine's clearing, light filled.
  { id: 'shrine', at: [232, 416], w: 24, d: 24, canopy: 4 },
  // D: the cathedral grove, open ground under the giants round its rim.
  { id: 'grove', at: [95, 390], w: 50, d: 40, canopy: -6 },
  // 27: Bramble's clearing, the boar's ground kept open, grey giants standing in at its rim so their crowns frame it.
  { id: 'bramble', at: [438, 204], w: 24, d: 18, canopy: -2 },
  // The three foxes' ground at its west edge (fight 3).
  { id: 'foxes', at: [424, 210], w: 16, d: 12, canopy: 0 },
];

/**
 * The bee trees (kit 15): a young oak with a hollow in its trunk, at these columns. Each is chosen where the painted
 * tree's own turn (world-painted.view.ts turns a tree by its column) points the hollow the way `faces` says, in
 * quarter turns as a landmark's `turn` counts them, so the comb (`forestBeeComb`) sits in it. A test holds them to it.
 */
export const BEE_TREES: readonly { at: MapPoint; faces: number }[] = [
  { at: [152, 330], faces: 3 },
  { at: [126, 364], faces: 3 },
  { at: [200, 436], faces: 2 },
];
/**
 * Giant oaks set by hand where the grove's own rule leaves none: round Bramble's clearing, which the High Road, the
 * north path and the clearing itself keep bare, so grey giants frame it as its vista does, the boar's oak east of it.
 * `variant` is the old oak's (0 cathedral, 1 split, 2 leaning).
 */
export const PLANTED_OAKS: readonly { at: MapPoint; variant: number }[] = [
  { at: [455, 202], variant: 0 },
  { at: [440, 184], variant: 1 },
  { at: [426, 184], variant: 2 },
  { at: [414, 200], variant: 0 },
];
/** How far out from a bee tree's middle its comb stands, in the hollow at the trunk's foot. */
const COMB_OUT = 0.45;
/** The way each quarter turn faces on the map, as a step in x and y. */
const FACES: readonly MapPoint[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

type Site = { id: string; model: string; place: string; at?: MapPoint; turn: number; variant?: string; wet?: boolean };

/**
 * The forest's sites, the shape of an entry of `LANDMARKS` in greenhollow.ts: the kit's pieces that hold up beside
 * their sheets (stumps, rocks, moss mounds, the shrine's ring, drift, the combs), in groups at giant oaks' feet by the
 * paths rather than sprinkled. The giants' own buttress roots are the roots at their feet.
 */
export const FOREST_SITES: readonly Site[] = [
  // A: the Seed Vault's approach.
  { id: 'forest-moss-vault', model: 'forestMossMound', place: 'seedvault', at: [148, 316], turn: 1 },
  // By the west path: two giants south of it, moss and a stump cluster at one's feet, rocks at the other's.
  { id: 'forest-moss-path', model: 'forestMossMound', place: 'seedvault', at: [199, 294], turn: 0 },
  { id: 'forest-stumps-path', model: 'forestStumps', place: 'seedvault', at: [205, 296], turn: 1, variant: 'green' },
  { id: 'forest-rocks-path', model: 'forestRocks', place: 'seedvault', at: [214, 290], turn: 2 },
  // Along the loop from the vault to the grove.
  { id: 'forest-moss-loop', model: 'forestMossMound', place: 'seedvault', at: [122, 342], turn: 3 },
  { id: 'forest-rocks-1', model: 'forestRocks', place: 'seedvault', at: [112, 340], turn: 0 },
  { id: 'forest-stumps-1', model: 'forestStumps', place: 'seedvault', at: [136, 374], turn: 2, variant: 'green' },
  // D: the cathedral grove, at the feet of the giants on its rim.
  { id: 'forest-moss-grove', model: 'forestMossMound', place: 'seedvault', at: [110, 384], turn: 0 },
  { id: 'forest-stumps-grove', model: 'forestStumps', place: 'seedvault', at: [112, 391], turn: 3, variant: 'green' },
  { id: 'forest-moss-grove-2', model: 'forestMossMound', place: 'seedvault', at: [102, 406], turn: 2 },
  { id: 'forest-rocks-grove', model: 'forestRocks', place: 'seedvault', at: [94, 414], turn: 1 },
  // From the grove to the shrine.
  { id: 'forest-rocks-2', model: 'forestRocks', place: 'shrine-forest', at: [186, 441], turn: 1 },
  // C: the ring round the forest shrine, open to the south; moss at the feet of the giant south of it.
  { id: 'forest-ring', model: 'forestShrineRing', place: 'shrine-forest', at: [234, 414], turn: 0 },
  { id: 'forest-moss-shrine', model: 'forestMossMound', place: 'shrine-forest', at: [231, 431], turn: 2 },
  // B: the forest stair, at the feet of the giant south of its gap.
  { id: 'forest-moss-stair', model: 'forestMossMound', place: 'ruin-stair', at: [256, 272], turn: 1 },
  { id: 'forest-rocks-stair', model: 'forestRocks', place: 'ruin-stair', at: [263, 271], turn: 0 },
  // By the forest path to the sunk tower.
  { id: 'forest-stumps-2', model: 'forestStumps', place: 'ruin-tower', at: [249, 380], turn: 0, variant: 'green' },
  // The kit's rebuilt pieces (3f32176): snags, hollow trunks, root fans, mushrooms and a gate post by the paths.
  { id: 'forest-rootfan-vault', model: 'forestRootFan', place: 'seedvault', at: [169, 291], turn: 0 },
  { id: 'forest-mushrooms-vault', model: 'forestMushrooms', place: 'seedvault', at: [170, 304], turn: 3 },
  { id: 'forest-snag-1', model: 'forestSnag', place: 'seedvault', at: [134, 330], turn: 1, variant: 'green' },
  { id: 'forest-hollow-1', model: 'forestHollowTrunk', place: 'seedvault', at: [88, 360], turn: 0, variant: 'green' },
  { id: 'forest-mushrooms-grove', model: 'forestMushrooms', place: 'seedvault', at: [77, 380], turn: 2 },
  { id: 'forest-rootfan-grove', model: 'forestRootFan', place: 'seedvault', at: [92, 372], turn: 2 },
  { id: 'forest-snag-2', model: 'forestSnag', place: 'shrine-forest', at: [176, 415], turn: 2, variant: 'green' },
  { id: 'forest-gatepost-shrine', model: 'forestGatePost', place: 'shrine-forest', at: [222, 410], turn: 1 },
  // At the foot of the giant south of the stair's gap, on level ground, not the gap's slope where it stood up like a claw.
  { id: 'forest-rootfan-stair', model: 'forestRootFan', place: 'ruin-stair', at: [265, 273], turn: 0 },
  { id: 'forest-hollow-2', model: 'forestHollowTrunk', place: 'ruin-tower', at: [272, 350], turn: 1, variant: 'green' },
  { id: 'grey-snag', model: 'forestSnag', place: 'boar', at: [462, 188], turn: 0, variant: 'grey' },
  // The combs, each in its bee tree's hollow.
  ...BEE_TREES.map((b, i) => ({ id: `forest-comb-${i + 1}`, model: 'forestBeeComb', place: 'seedvault', at: [b.at[0] + 0.5 + (FACES[b.faces] as MapPoint)[0] * COMB_OUT, b.at[1] + 0.5 + (FACES[b.faces] as MapPoint)[1] * COMB_OUT] as MapPoint, turn: b.faces })),
  // 27: Bramble's clearing. Pale drift on the open ground, grey stumps at its west edge.
  { id: 'grey-drift-1', model: 'greyDrift', place: 'boar', at: [450, 214], turn: 0 },
  { id: 'grey-drift-2', model: 'greyDrift', place: 'boar', at: [433, 196], turn: 1 },
  { id: 'grey-drift-3', model: 'greyDrift', place: 'boar', at: [452, 208], turn: 3 },
  { id: 'grey-stumps', model: 'forestStumps', place: 'boar', at: [418, 206], turn: 1, variant: 'grey' },
];

/**
 * Laid out but held back: the kit's pieces that fall clearly short of their sheets as built on act1-wilds-kit-forest at
 * 10809ca, until the rework lands. Each is placed where it belongs; to show one, move it into FOREST_SITES.
 *   forestRootFan: a flat orange boomerang, read as a carrot standing up at the stair. forestStatue: a block figure.
 *   forestSnag, forestHollowTrunk: a pole and a box, no bark ribs or broken top. forestWall: plain boxes.
 *   forestVines: nothing shows. forestBranch: a flat plank. forestGatePost: an uncarved box. forestMushrooms: flat
 *   discs. greyBrush: three spikes, not twig fans. greyDen: a grey half-pipe. wrenCamp: a blue tarp, not cream canvas.
 */
export const FOREST_HELD: readonly Site[] = [
  { id: 'forest-vines-vault', model: 'forestVines', place: 'seedvault', at: [146, 288], turn: 0 },
  { id: 'forest-branch-1', model: 'forestBranch', place: 'seedvault', at: [150, 344], turn: 1 },
  // D: the Gardener in the roots looks east to the loop; a buried wall on the west rim.
  { id: 'forest-statue', model: 'forestStatue', place: 'seedvault', at: [84, 392], turn: 1 },
  { id: 'forest-wall-grove', model: 'forestWall', place: 'seedvault', at: [72, 404], turn: 1 },
  { id: 'forest-vines-grove', model: 'forestVines', place: 'seedvault', at: [116, 398], turn: 3 },
  { id: 'forest-branch-2', model: 'forestBranch', place: 'shrine-forest', at: [140, 434], turn: 0 },
  { id: 'forest-wall-stair', model: 'forestWall', place: 'ruin-stair', at: [244, 248], turn: 0 },
  { id: 'grey-den', model: 'greyDen', place: 'boar', at: [459, 200], turn: 3 },
  { id: 'grey-brush-1', model: 'greyBrush', place: 'boar', at: [420, 196], turn: 0 },
  { id: 'grey-brush-2', model: 'greyBrush', place: 'boar', at: [455, 214], turn: 1 },
  { id: 'grey-brush-3', model: 'greyBrush', place: 'boar', at: [432, 189], turn: 2 },
  // 28: Wren's camp on the green side, south of the High Road, looking north to Bramble; west of the north path.
  { id: 'wren-camp', model: 'wrenCamp', place: 'boar', at: [420, 234], turn: 2 },
];

/** The sizes of the forest's own models, the shape of an entry of `LANDMARK_SIZES` in greenhollow.ts. */
export const FOREST_SIZES: Readonly<Record<string, { w: number; d: number; h: number; walk?: boolean; open?: boolean; back?: number; wet?: boolean; deck?: boolean; dress?: boolean }>> = {
  // Solid: walked round, on level ground.
  forestSnag: { w: 5, d: 4, h: 11 },
  forestHollowTrunk: { w: 6, d: 5, h: 8 },
  forestRocks: { w: 4, d: 3, h: 2.5 },
  forestWall: { w: 8, d: 2, h: 2.5 },
  forestStatue: { w: 5, d: 4, h: 6 },
  forestGatePost: { w: 2, d: 2, h: 5 },
  greyDen: { w: 8, d: 6, h: 3.5 },
  // Laid on the land as it is, walked over or through.
  forestStumps: { w: 4, d: 3, h: 1.2, open: true, dress: true },
  forestRootFan: { w: 8, d: 5, h: 1.5, open: true, dress: true },
  forestMushrooms: { w: 2, d: 1.5, h: 0.6, open: true, dress: true },
  forestMossMound: { w: 4, d: 3, h: 0.8, open: true, dress: true },
  forestBranch: { w: 6, d: 2, h: 0.8, open: true, dress: true },
  forestVines: { w: 3, d: 1, h: 6, open: true, dress: true },
  forestBeeComb: { w: 0.65, d: 0.25, h: 1, open: true, dress: true },
  forestShrineRing: { w: 10, d: 10, h: 1, open: true, dress: true },
  greyBrush: { w: 4, d: 3, h: 1.5, open: true, dress: true },
  greyDrift: { w: 3, d: 2, h: 0.15, open: true, dress: true },
  wrenCamp: { w: 6, d: 5, h: 2.4, open: true, dress: true },
};
