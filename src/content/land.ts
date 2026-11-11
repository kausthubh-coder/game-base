// Which blocks are land. The painted world draws the ground as one smooth surface, so the blocks that make
// up natural ground are left out of the block mesher and drawn by the land instead. The rules still see
// every one of them as a block.
//
// `colors` are sRGB hex. Grass takes its greens from a slow noise; the others are one colour each.

/**
 * Blocks the land is made of. The block mesher draws none of their faces where they are natural ground, and
 * the land draws them instead. Tilled soil and paving are land too: a field or a paved square is painted into
 * the ground, with a soft edge where it meets the grass.
 */
export const LAND_BLOCKS: readonly string[] = ['grass', 'dirt', 'sand', 'clay', 'stone', 'mossy_stone', 'path', 'tilled_soil', 'cobble', 'stone_brick'];

/** Ground that somebody made, and what is painted on it: the furrows of a field, or paving stones. */
export const MADE_GROUND: Readonly<Record<string, 'soil' | 'paving'>> = { tilled_soil: 'soil', cobble: 'paving', stone_brick: 'paving' };

/**
 * How far under its top the land lies where the ground is a block that is not land (a plank floor let into
 * the earth). That block is drawn as a block, and the two never fight for the same pixels.
 */
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
  tilled_soil: '#9a7450',
  cobble: '#c2bcae',
  stone_brick: '#b9b6ae',
  /** A slope too steep for grass shows earth and rock. */
  cliff: '#a69d86',
  /** The riser of a step, where the land is drawn stepped: the earth under the turf. */
  earth: '#a98459',
  /** The bed under water, and the wet shore beside it. */
  bed: '#7f9a86',
  shore: '#c9bb8c',
} as const;
