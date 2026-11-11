// Written by tools/models/town.mjs from the GLBs of the Hollowmere town kit. Do not edit by hand.
//
// Each model stands with its middle at the middle of its footprint and its front toward +z (south). The
// footprint is whole metres, x by z. `solid` lists the footprint's cells a body cannot walk through, as
// z * width + x counted from the footprint's north-west corner: the cells with surface between ankle and
// head height. Its model is drawn by src/game/views/world-town.view.ts and listed in
// public/assets/manifest.json as `town-<name>`.

export interface TownModelDef {
  category: 'landmark' | 'building' | 'street';
  footprint: readonly [x: number, z: number];
  /** Its size in metres, x by y by z. */
  size: readonly [number, number, number];
  triangles: number;
  solid: readonly number[];
}

export const TOWN_MODELS = {
  'granary-hall': { category: 'landmark', footprint: [14, 12], size: [13.95, 13.1201, 10.07], triangles: 7714, solid: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151] },
  'rootworks-gate': { category: 'landmark', footprint: [12, 8], size: [10.9433, 7.49, 5.9], triangles: 5312, solid: [24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 55, 56, 57, 58, 59, 60, 61, 62, 63, 68, 69, 70, 71, 72, 73, 82, 83] },
  'town-well': { category: 'landmark', footprint: [6, 6], size: [4.09, 5.1201, 3.74], triangles: 2800, solid: [6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 25, 26, 27, 28] },
  'bakery': { category: 'building', footprint: [10, 8], size: [8.77, 6.3265, 6.6153], triangles: 2893, solid: [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 52, 53, 54, 55, 56, 57, 58, 61, 62, 63, 64, 65, 66, 67] },
  'lodge': { category: 'building', footprint: [12, 10], size: [11.54, 8.7665, 8.925], triangles: 3923, solid: [2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 74, 75, 76, 77, 78, 79, 80, 81, 86, 87, 88, 89, 90, 91, 92, 93, 98, 99, 100, 101, 102, 103, 104, 105] },
  'workshop': { category: 'building', footprint: [10, 8], size: [9.05, 6.4265, 5.98], triangles: 2629, solid: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 30, 31, 32, 33, 34, 36, 37, 38, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58, 59, 60, 61, 62, 63, 64, 68, 69] },
  'kennel': { category: 'building', footprint: [10, 8], size: [9.06, 6.1665, 6.69], triangles: 3031, solid: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 61, 62, 64, 65, 67, 68, 71, 72] },
  'ferry-house': { category: 'building', footprint: [10, 10], size: [8.775, 6.3165, 9.045], triangles: 3507, solid: [1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99] },
  'house-a': { category: 'building', footprint: [7, 6], size: [5.75, 5.1765, 5.05], triangles: 2463, solid: [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36, 37, 38, 39, 40] },
  'house-b': { category: 'building', footprint: [9, 8], size: [7.94, 6.5065, 6.75], triangles: 3603, solid: [9, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 64, 65, 66, 67, 70] },
  'house-c': { category: 'building', footprint: [10, 7], size: [8.55, 5.6865, 6.2], triangles: 3294, solid: [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48, 51, 52, 53, 54, 55, 56, 57, 58, 61, 62, 64, 65] },
  'house-d': { category: 'building', footprint: [8, 8], size: [6.92, 8.6965, 6.84], triangles: 3255, solid: [9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 49, 50, 51, 52, 53, 54] },
  'market-stall-a': { category: 'street', footprint: [3, 3], size: [2.65, 2.5108, 1.895], triangles: 684, solid: [0, 2, 3, 4, 5, 6, 7, 8] },
  'market-stall-b': { category: 'street', footprint: [3, 3], size: [2.65, 2.5108, 1.895], triangles: 684, solid: [0, 2, 3, 4, 5, 6, 7, 8] },
  'cart': { category: 'street', footprint: [3, 4], size: [2.2, 1.5645, 2.93], triangles: 660, solid: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  'barrels-crates': { category: 'street', footprint: [3, 2], size: [2.3405, 1.4217, 1.365], triangles: 552, solid: [0, 1, 2, 3, 4, 5] },
  'bench': { category: 'street', footprint: [3, 2], size: [2.34, 1.28, 1.0094], triangles: 512, solid: [0, 1, 2, 3, 4, 5] },
  'signpost': { category: 'street', footprint: [3, 2], size: [2.45, 2.57, 0.8126], triangles: 400, solid: [1, 3, 4, 5] },
  'lamp-post': { category: 'street', footprint: [3, 2], size: [2.3848, 2.78, 0.6], triangles: 652, solid: [1, 4] },
  'string-lights': { category: 'street', footprint: [6, 2], size: [5.7832, 3.09, 0.2771], triangles: 754, solid: [0, 5, 6, 11] },
  'banner-pole': { category: 'street', footprint: [2, 2], size: [1.7151, 3.275, 0.68], triangles: 352, solid: [0, 1, 2, 3] },
  'flower-planter': { category: 'street', footprint: [3, 2], size: [2.52, 1.4076, 1.237], triangles: 728, solid: [0, 1, 2, 3, 4, 5] },
  'fence-straight': { category: 'street', footprint: [3, 1], size: [2.976, 1.32, 0.427], triangles: 308, solid: [0, 1, 2] },
  'fence-corner': { category: 'street', footprint: [3, 3], size: [2.976, 1.32, 2.976], triangles: 336, solid: [0, 1, 2, 3, 6] },
  'stone-bridge': { category: 'street', footprint: [6, 3], size: [6, 1.38, 2.98], triangles: 692, solid: [] },
  'dock-segment': { category: 'street', footprint: [3, 3], size: [2.986, 0.83, 3], triangles: 728, solid: [] },
  'statue-gardener-warden': { category: 'street', footprint: [3, 3], size: [1.72, 2.48, 1.72], triangles: 768, solid: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
} as const satisfies Record<string, TownModelDef>;

export type TownModelName = keyof typeof TOWN_MODELS;
