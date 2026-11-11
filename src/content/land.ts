// Which blocks are land. The painted world draws the ground as one smooth surface, so the blocks that make
// up natural ground are left out of the block mesher and drawn by the land instead. The rules still see
// every one of them as a block.
//
// `colors` are sRGB hex. Grass takes its greens from a slow noise; the others are one colour each.

/** Blocks the land is made of. The block mesher draws none of their faces when the land is on. */
export const LAND_BLOCKS: readonly string[] = ['grass', 'dirt', 'sand', 'clay', 'stone', 'mossy_stone', 'path'];

/**
 * Ground that somebody made flat and square: a tilled bed, a paved square. It stays a block, and the land
 * lies just under its top so the two never fight for the same pixels.
 */
export const FLAT_BLOCKS: readonly string[] = ['tilled_soil', 'cobble', 'stone_brick'];

/** How far under the top of a flat block the land lies, in blocks. */
export const FLAT_DROP = 0.08;

export const LAND_COLORS = {
  /** The meadow's greens: sunlit, the usual, deep, and dry straw. */
  grass: { light: '#a9d05a', mid: '#88bd50', deep: '#5c9c4a', straw: '#c6cb72' },
  dirt: '#b3905f',
  path: '#e0c898',
  pathEdge: '#c4a570',
  sand: '#e2d4a2',
  clay: '#b9a892',
  stone: '#b8b3a6',
  mossy_stone: '#9aa67f',
  /** A slope too steep for grass shows earth and rock. */
  cliff: '#a69d86',
  /** The riser of a step, where the land is drawn stepped: the earth under the turf. */
  earth: '#a98459',
  /** The bed under water, and the wet shore beside it. */
  bed: '#7f9a86',
  shore: '#c9bb8c',
} as const;
