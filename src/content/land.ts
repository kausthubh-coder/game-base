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

/** The greens of a kind of land's grass: sunlit, the usual, deep, and dry straw. */
export interface Greens { light: string; mid: string; deep: string; straw: string }

/**
 * How one kind of land looks (docs/greenhollow-world.md, "The kinds of land"). The land is painted in its greens,
 * and in patches of bare ground where no grass grows: moss and leaf litter in the old forest, mud in the marsh,
 * scree on the cave hills, carved flags on the terraces. `tall`, `thick`, `flowers` and `tufts` scale the
 * meadow's grass. `painting` names the painting laid over its ground, in `public/assets/painted/`.
 */
export interface LandKind {
  greens: Greens;
  /** The share of the ground that is bare, from 0 to 1, and its colour. */
  bare: number;
  bareColor: string;
  tall: number;
  thick: number;
  flowers: number;
  tufts: number;
  painting: 'meadow' | 'moss' | 'mud' | 'scree' | 'terrace-stone';
}

const MEADOW_KIND: LandKind = { greens: LAND_COLORS.grass, bare: 0, bareColor: LAND_COLORS.dirt, tall: 1, thick: 1, flowers: 1, tufts: 1, painting: 'meadow' };

/** Every kind of land by the name `biomeAt` gives it. A name not here is drawn as the meadow. */
export const LAND_KINDS: Readonly<Record<string, LandKind>> = {
  meadow: MEADOW_KIND,
  // Darker and mossier, in the shade of the old oaks. Few flowers, and moss and leaf litter between the ferns.
  oldForest: { greens: { light: '#86b84e', mid: '#5f9c48', deep: '#3a7a46', straw: '#8e9c4c' }, bare: 0.2, bareColor: '#6b7a3e', tall: 0.75, thick: 0.42, flowers: 0.15, tufts: 0.7, painting: 'moss' },
  // Grey-green and dry, the grass short and pale. Nothing flowers.
  greyForest: { greens: { light: '#b9c08f', mid: '#a0aa7e', deep: '#828d6c', straw: '#c8c49a' }, bare: 0.2, bareColor: '#a89f88', tall: 0.5, thick: 0.75, flowers: 0, tufts: 0.45, painting: 'meadow' },
  // Lush rank grass round wet mud and standing pools.
  marsh: { greens: { light: '#9bc95a', mid: '#76ae50', deep: '#4b8d55', straw: '#a7b66a' }, bare: 0.32, bareColor: '#7e6c4f', tall: 1.3, thick: 0.9, flowers: 0.3, tufts: 1.3, painting: 'mud' },
  // Thin turf over rock shelves and scree.
  caveHills: { greens: { light: '#a8c56a', mid: '#88aa5c', deep: '#688b57', straw: '#bab57a' }, bare: 0.42, bareColor: '#a9a397', tall: 0.55, thick: 0.6, flowers: 0.35, tufts: 0.45, painting: 'scree' },
  // Carved stone flags with grey moss between them.
  terraces: { greens: { light: '#a2b67a', mid: '#86a06c', deep: '#667f60', straw: '#aaa983' }, bare: 0.5, bareColor: '#b4af9f', tall: 0.6, thick: 0.6, flowers: 0.1, tufts: 0.4, painting: 'terrace-stone' },
  town: MEADOW_KIND,
};

/**
 * Where the land is grey (`blightAt` 1), every colour of the ground, the grass and the trees is drained toward
 * its own grey times this tint, by `drain` at most: a pale ash with a little green left in it.
 */
export const GREY = { tint: '#d2cfb9', drain: 0.62 } as const;

/** Standing pools in the marsh: the share of the marsh they cover, and their colour, shallow and deep. */
export const POOLS = { share: 0.24, shallow: '#7fae9c', deep: '#3f7a80', rim: '#5d5240' } as const;
