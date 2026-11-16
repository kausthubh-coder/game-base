// The painted world as data: its trees, the colours of its light through the day, and where its haze begins.
// The numbers come from the painted meadow test scene (demos/ghibli), which Kausthubh picked as the look.

/** One kind of tree, as the painted feature's `TreeSpec` wants it. Lengths are meters at a scale of 1. */
export interface PaintedTree {
  seed: number; height: number; trunk: number; crown: number; blobs: number; card: number; cover: number; squash: number; lean: number;
  low?: number; fork?: number;
  /** Roots that run out over the ground from the trunk's foot, and how thick and high they leave it. */
  roots?: number;
  buttress?: number;
  /** The trunk's foot against its body; twin stems; how many boughs and how thick; a hollow this far up. `TreeSpec` says more. */
  flare?: number;
  stems?: number;
  limbs?: number;
  limb?: number;
  hollow?: number;
  /** How many times a tree of its kind's usual size it is built: its leaf cards are that much larger too. */
  scale?: number;
}

const OAK: PaintedTree = { seed: 21, height: 9.5, trunk: 0.42, crown: 4.6, blobs: 8, card: 1.1, cover: 1.45, squash: 0.8, lean: 0.5 };
const ELM: PaintedTree = { seed: 34, height: 12.5, trunk: 0.5, crown: 5.0, blobs: 9, card: 1.15, cover: 1.45, squash: 0.92, lean: -0.6 };
const SPREADING: PaintedTree = { seed: 144, height: 8.5, trunk: 0.34, crown: 6.8, blobs: 12, card: 1.3, cover: 1.5, squash: 0.7, lean: 0.5, low: -0.38, fork: 0.33 };
const BIRCH: PaintedTree = { seed: 61, height: 11, trunk: 0.26, crown: 3.4, blobs: 7, card: 0.95, cover: 1.4, squash: 1.15, lean: 0.4 };
const BIRCH_YOUNG: PaintedTree = { seed: 67, height: 8, trunk: 0.2, crown: 2.6, blobs: 6, card: 0.9, cover: 1.4, squash: 1.2, lean: -0.3 };
const CEDAR: PaintedTree = { seed: 55, height: 13, trunk: 0.38, crown: 2.3, blobs: 6, card: 0.9, cover: 1.5, squash: 2.3, lean: 0 };
const CEDAR_STOUT: PaintedTree = { seed: 58, height: 10.5, trunk: 0.4, crown: 2.8, blobs: 6, card: 0.95, cover: 1.5, squash: 1.9, lean: 0 };

// The oaks of the Old Forest, from its kit (assets-src/concept/region-forests, kit-trees, pieces 01 to 04 and 15).
// Each is written at the size the kit gives it, in meters, with its leaf cards as much larger as it is (`scale`),
// so a giant costs no more triangles than two oaks. The rules give a giant a size of 2 and a young oak or a bee
// tree a size of 1 (`OLD_OAK_SIZE`, read by the terrain), and the painted tree is drawn at that size, so each
// shape is stored divided by it. A stretch of forest is a hall of giant trunks with young oaks between.
/** A tree drawn at `size` times this shape: the shape divided by it. */
const atRules = (spec: PaintedTree, size: number): PaintedTree => ({
  ...spec, height: spec.height / size, trunk: spec.trunk / size, crown: spec.crown / size, card: spec.card / size, lean: spec.lean / size, scale: (spec.scale ?? 1) / size,
});
/** 01, 24 by 22 and 22 high: a broad buttressed trunk, long low boughs, an uneven shelf of crown. */
const CATHEDRAL_OAK: PaintedTree = { seed: 171, height: 17.5, trunk: 1.45, crown: 11.5, blobs: 14, card: 2.5, cover: 1.5, squash: 0.72, lean: 1.4, low: -0.45, fork: 0.42, roots: 9, buttress: 1.5, flare: 1.2, limbs: 9, limb: 0.42, scale: 2.4 };
/** 02, 28 by 24 and 24 high: two stems joined at the foot, a broad open fork, the widest crown. */
const SPLIT_OAK: PaintedTree = { seed: 182, height: 19, trunk: 1.5, crown: 13.5, blobs: 16, card: 2.6, cover: 1.5, squash: 0.7, lean: 0.6, low: -0.4, fork: 0.5, roots: 10, buttress: 1.4, flare: 1.1, stems: 2, limbs: 10, limb: 0.4, scale: 2.6 };
/** 03, 22 by 18 and 20 high: a trunk reaching to one side, held by its roots, the crown weighted that way. */
const LEANING_OAK: PaintedTree = { seed: 193, height: 16, trunk: 1.25, crown: 10, blobs: 12, card: 2.3, cover: 1.5, squash: 0.72, lean: 5, low: -0.4, fork: 0.5, roots: 8, buttress: 1.6, flare: 1.1, limbs: 7, limb: 0.42, scale: 2.2 };
/** 04, 7 by 6 and 9 high: a slim stem and a compact crown. */
const YOUNG_OAK: PaintedTree = { seed: 204, height: 8.2, trunk: 0.36, crown: 3.4, blobs: 8, card: 1.1, cover: 1.45, squash: 0.85, lean: 0.4, fork: 0.6, roots: 3, scale: 1 };
/** 15, 8 by 7 and 10 high: a young oak grown on, with a hollow at the foot of its trunk where a comb is set. */
const BEE_TREE: PaintedTree = { seed: 215, height: 9, trunk: 0.55, crown: 3.9, blobs: 9, card: 1.15, cover: 1.45, squash: 0.85, lean: 0.5, fork: 0.65, roots: 4, hollow: 0.12, scale: 1.1 };
/** The size the rules give each old oak by its variant (src/features/world/terrain.sim.ts): giants 2, the young 1. */
export const OLD_OAK_SIZE: readonly number[] = [2, 2, 2, 1, 1];
// The willows of the marsh: a crown that hangs to the ground in strands.
const WILLOW: PaintedTree = { seed: 303, height: 8.5, trunk: 0.46, crown: 4.6, blobs: 10, card: 1.0, cover: 1.5, squash: 0.95, lean: 0.7, low: -0.85, fork: 0.45 };
const WILLOW_SMALL: PaintedTree = { seed: 311, height: 6.5, trunk: 0.36, crown: 3.6, blobs: 8, card: 0.95, cover: 1.5, squash: 1.0, lean: -0.5, low: -0.9, fork: 0.5 };

/**
 * One way a kind of tree is drawn. `spray` is which leaf spray it wears: 0 to 2, or 3 for a willow's strands,
 * whose cards `hang` from where they sit instead of standing round it. `tones` are its leaves' four tones (EMERALD when left out). `own` is true for a tree drawn at its
 * own size whatever box the rules give it: an old oak is twice an oak, however the rules fell it.
 */
export interface PaintedVariant { spec: PaintedTree; spray: number; hang?: boolean; tones?: readonly [string, string, string, string]; own?: boolean }

/** The old oaks' olive greens, warm where the sun reaches, as the Old Forest's vista paints them. */
export const OLD_GREEN: readonly [string, string, string, string] = ['#2d4a2a', '#4d6c2e', '#7d9a38', '#c6d46c'];
/** The willow's: yellow-green with a silver sheen on its sunlit strands. */
export const WILLOW_GREEN: readonly [string, string, string, string] = ['#2f6a4c', '#4f9452', '#86ba5e', '#c4df92'];

/** The shape of each kind of tree the rules grow, by its variant. */
export const PAINTED_TREES: Readonly<Record<string, readonly PaintedVariant[]>> = {
  oak: [{ spec: OAK, spray: 0 }, { spec: SPREADING, spray: 0 }, { spec: ELM, spray: 1 }],
  birch: [{ spec: BIRCH, spray: 1 }, { spec: ELM, spray: 1 }, { spec: BIRCH_YOUNG, spray: 1 }],
  pine: [{ spec: CEDAR, spray: 2 }, { spec: CEDAR_STOUT, spray: 2 }, { spec: CEDAR, spray: 2 }],
  // By the variant the terrain gives: the cathedral, split and leaning giants, a young oak, a bee tree.
  oldOak: [CATHEDRAL_OAK, SPLIT_OAK, LEANING_OAK, YOUNG_OAK, BEE_TREE].map((spec, v) => ({ spec: atRules(spec, OLD_OAK_SIZE[v] as number), spray: 0, tones: OLD_GREEN, own: true })),
  willow: [{ spec: WILLOW, spray: 3, hang: true, tones: WILLOW_GREEN }, { spec: WILLOW_SMALL, spray: 3, hang: true, tones: WILLOW_GREEN }, { spec: WILLOW, spray: 3, hang: true, tones: WILLOW_GREEN }],
};

/**
 * The two looks of the grey forest, behind `?grey=a` and `?grey=b`. Kausthubh picks. Each says what grey does
 * to a tree that `blightAt` drains: its leaves' and bark's colour (drained toward its own grey times `leaf` and
 * `bark`, by `drain` at most), and `thin`, the share of its leaves that are gone, so bare branches show.
 *   - `a`: the same oaks with the colour gone. Lavender-grey bark, ashen cream leaves (`leaf` lifted a little by
 *     the trees' own shader), a full crown, and pale grey-green grass, which drains toward `leaf` itself.
 *   - `b`: the oaks dying. Dull olive-grey leaves, the crown thinned to its boughs.
 */
export const GREY_LOOKS = {
  a: { leaf: '#cdd1c0', bark: '#bab3bb', drain: 0.92, thin: 0 },
  b: { leaf: '#bdb48c', bark: '#aaa196', drain: 0.74, thin: 0.62 },
} as const;
export type GreyLook = keyof typeof GREY_LOOKS;

/**
 * How the trees of each kind of land are tinted, as a multiplier on their leaves: the old forest's a little deeper
 * and warmer in their own shade. A kind not listed keeps its leaves as they are.
 */
export const KIND_LEAVES: Readonly<Record<string, readonly [number, number, number]>> = {
  oldForest: [0.92, 0.95, 0.82],
  marsh: [1.02, 1.03, 0.95],
  caveHills: [0.95, 0.98, 1.0],
};

/** Deep shade, shade, light, the sunlit top: a clear emerald, pale mint where the sun catches a spray. */
export const EMERALD: readonly [string, string, string, string] = ['#0d6248', '#128a4c', '#24a957', '#66d68e'];

/**
 * The Hollow Oak of Hollowmere: older than the kingdom and far larger than any tree of the woods. It is drawn
 * leaf by leaf from any distance, where the region plan stands a prop of this kind.
 */
export const GREAT_OAK = { prop: 'elderOak', spec: { ...SPREADING, seed: 91, height: 8.4, trunk: 0.95, crown: 6.2, blobs: 20, card: 1.5, squash: 0.62, lean: 0.5, fork: 0.42, low: -0.5 } as PaintedTree, scale: 2.1 };

/** A tree nearer than this is drawn leaf by leaf and casts a shadow. Farther, it is fewer and larger cards. */
export const TREE_NEAR = 40;

/** The colour of the light at one time of day. The three-number colours are in linear light. */
export interface Mood {
  /** What the sun and the shade multiply a surface's colour by. */
  sunTint: [number, number, number];
  shadeTint: [number, number, number];
  /** Sky light added to everything in shade. */
  skyAdd: [number, number, number];
  /** What the sun and the shade do to the leaves' painted tones. */
  leafSun: [number, number, number];
  leafShade: [number, number, number];
  /** A cloud's sunlit side, its shaded side, and the rim it has toward the sun or the moon. */
  cloudLight: [number, number, number];
  cloudShade: [number, number, number];
  cloudRim: [number, number, number];
  /** The colour far things turn first, before they reach the horizon's colour. */
  air: [number, number, number];
  /** The glow of the air toward the sun or the moon, and how strong it is from 0 to 1. */
  glow: [number, number, number];
  glowing: number;
}

const NIGHT: Mood = { sunTint: [0.13, 0.2, 0.36], shadeTint: [0.04, 0.065, 0.15], skyAdd: [0.003, 0.006, 0.02], leafSun: [0.22, 0.32, 0.55], leafShade: [0.16, 0.24, 0.46], cloudLight: [0.11, 0.15, 0.3], cloudShade: [0.035, 0.05, 0.125], cloudRim: [0.34, 0.42, 0.66], air: [0.035, 0.06, 0.15], glow: [0.2, 0.3, 0.55], glowing: 0.35 };
const DAWN: Mood = { sunTint: [1.22, 0.92, 0.68], shadeTint: [0.27, 0.32, 0.56], skyAdd: [0.022, 0.02, 0.06], leafSun: [1.2, 0.95, 0.7], leafShade: [0.86, 0.78, 1.0], cloudLight: [1.18, 0.84, 0.68], cloudShade: [0.4, 0.36, 0.58], cloudRim: [1.3, 0.68, 0.36], air: [0.62, 0.52, 0.66], glow: [1.25, 0.72, 0.42], glowing: 0.9 };
const NOON: Mood = { sunTint: [1.06, 1.0, 0.84], shadeTint: [0.21, 0.37, 0.58], skyAdd: [0.008, 0.022, 0.05], leafSun: [1, 1, 1], leafShade: [1, 1, 1], cloudLight: [1.0, 0.985, 0.93], cloudShade: [0.58, 0.67, 0.86], cloudRim: [1.0, 0.96, 0.82], air: [0.47, 0.68, 0.87], glow: [1.0, 0.95, 0.8], glowing: 0.45 };
const EVENING: Mood = { sunTint: [1.3, 0.9, 0.55], shadeTint: [0.3, 0.33, 0.6], skyAdd: [0.03, 0.022, 0.07], leafSun: [1.28, 0.93, 0.6], leafShade: [0.86, 0.74, 1.0], cloudLight: [1.22, 0.8, 0.56], cloudShade: [0.38, 0.32, 0.56], cloudRim: [1.45, 0.62, 0.28], air: [0.58, 0.42, 0.6], glow: [1.35, 0.66, 0.3], glowing: 1 };

/** The moods through the day, by the clock: 0 is midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
export const MOODS: readonly (readonly [number, Mood])[] = [
  [0, NIGHT], [0.2, NIGHT], [0.27, DAWN], [0.36, NOON], [0.62, NOON], [0.73, EVENING], [0.8, NIGHT], [1, NIGHT],
];

/**
 * The air. `start` is meters of clear air before the haze begins and `density` how fast it thickens after
 * that. `most` is the most of a thing's colour the air can take. Mist lies in low ground: the air is thickest
 * at the height `low` and clears by `clears` for every meter above it, so a hilltop stands out of it.
 * `fog` is where the fog on what is not painted (blocks, sprites) starts and is whole, measured from the hero.
 */
export const HAZE = { start: 48, density: 0.0026, most: 0.82, low: 20, clears: 0.03, fog: [70, 520] };

/**
 * How the weather shows in the painted sky. The sky has two layers: the painted clouds (big cumulus, each a
 * painting) and a high layer over them (streaks on a fair day, a grey deck in rain).
 *   - `few` and `all`: the share of the painted clouds that stand in a sky with no cloud cover and in a full one.
 *   - `deckFrom`: the cloud cover at which the high layer starts to close. Rain closes it whatever the cover.
 *   - `storm`: what the clouds' lit and shaded sides turn to under rain, as a share of their fair colours and a tint.
 *   - `drift`: how fast the clouds move in still air and in a full wind, in turns of the sky a second.
 */
export const SKY = {
  few: 0.3, all: 1.06, deckFrom: 0.5,
  storm: { light: 0.52, shade: 0.42, tint: [0.92, 0.96, 1.08] as [number, number, number] },
  drift: [0.0006, 0.0052] as [number, number],
};

/** The colour of water over a shallow bed and over a deep one, of its foam, and of water on the far land. */
export const PAINTED_WATER = { shallow: '#8fd6c4', deep: '#3c88b4', foam: '#f6fbf8', far: '#86bfd9' };

/** How far from the hero a tree is drawn leaf by leaf. Past it a tree is a picture of itself. The rules know trees this far at least. */
export const TREE_REACH = 62;
/** How far out the far trees stand. */
export const FAR_TREES = 288;

/**
 * The small things that grow in each kind of land, drawn by the painted feature's wilds. `prop` is a kind of
 * src/content/props.ts and `variants` how many of its variants are used. `on` is how many stand on a square
 * meter of each kind of land at most. `where` is the ground they want: `land` anywhere grass grows, `bare` on
 * bare ground (scree, flags, mud), `pool` in a marsh pool, `rim` on a pool's edge, `shade` under trees' crowns
 * (land too, more where the kind is thickest). `ground` true takes the colour of the ground under it, as the
 * grass does, so it goes grey with it. `reach` is how far from the hero it is drawn, and `size` its scale.
 */
export interface Wild {
  prop: string;
  variants: number;
  on: Readonly<Record<string, number>>;
  where: 'land' | 'bare' | 'pool' | 'rim';
  ground: boolean;
  reach: number;
  size: readonly [number, number];
  /** Sits this far into the ground, in meters at scale 1. */
  sink?: number;
  /** Grows this many times as thick along the edge of bare ground, a path's verge: a bank of ferns either side of it. */
  verge?: number;
}

export const WILDS: readonly Wild[] = [
  { prop: 'fern', variants: 2, on: { oldForest: 0.03, terraces: 0.01, marsh: 0.008 }, where: 'land', ground: true, reach: 44, size: [0.8, 1.45], verge: 6 },
  { prop: 'surfaceRoot', variants: 2, on: { oldForest: 0.005, terraces: 0.008 }, where: 'land', ground: false, reach: 56, size: [0.9, 1.6], sink: 0.06 },
  { prop: 'fallenLog', variants: 1, on: { oldForest: 0.0007, greyForest: 0.0005 }, where: 'land', ground: false, reach: 60, size: [1.1, 1.6], sink: 0.05 },
  { prop: 'mushroom', variants: 1, on: { oldForest: 0.006 }, where: 'land', ground: false, reach: 30, size: [0.9, 1.5] },
  { prop: 'greyGrass', variants: 1, on: { greyForest: 0.07, terraces: 0.015 }, where: 'land', ground: false, reach: 36, size: [0.8, 1.3] },
  { prop: 'bulrush', variants: 2, on: { marsh: 0.12 }, where: 'rim', ground: true, reach: 50, size: [0.85, 1.3] },
  { prop: 'lilyPad', variants: 2, on: { marsh: 0.1 }, where: 'pool', ground: false, reach: 40, size: [0.9, 1.5] },
  { prop: 'steppingStone', variants: 2, on: { marsh: 0.012 }, where: 'pool', ground: false, reach: 50, size: [0.9, 1.2], sink: 0.04 },
  { prop: 'scree', variants: 1, on: { caveHills: 0.05, terraces: 0.012 }, where: 'bare', ground: false, reach: 40, size: [0.8, 1.3], sink: 0.03 },
];

/**
 * The air in each kind of land, mixed by how much of each is round the hero. `sun` and `shade` multiply the
 * light's tints, `air` is the colour the middle distance turns and how far (0 to 1), `haze` multiplies how
 * thick the air is, `still` takes that share of the wind away. `fleck` is the effect that drifts round the
 * hero (src/content/effects.ts), how many start a second at most, and when: `day`, `night`, `dawn` or `always`.
 */
export interface KindAir {
  sun: readonly [number, number, number];
  shade: readonly [number, number, number];
  air: string;
  airShare: number;
  haze: number;
  still: number;
  flecks?: readonly { effect: string; rate: number; when: 'day' | 'night' | 'dawn' | 'always' }[];
}

export const KIND_AIR: Readonly<Record<string, KindAir>> = {
  // Warm olive shade under the old oaks, gold air between their trunks, and shafts of sun through the gaps (FOREST_SHAFTS).
  oldForest: { sun: [1.06, 0.96, 0.74], shade: [0.95, 0.78, 0.5], air: '#a9b47a', airShare: 0.4, haze: 1.5, still: 0.35, flecks: [{ effect: 'pollen', rate: 3, when: 'day' }, { effect: 'firefly', rate: 0.6, when: 'night' }] },
  // Still and pale, in cool light with lavender shade: flecks like ash rise slowly and vanish.
  greyForest: { sun: [0.9, 0.97, 1.12], shade: [1.9, 1.15, 0.92], air: '#c9c8bc', airShare: 0.4, haze: 1.25, still: 0.8, flecks: [{ effect: 'ash', rate: 9, when: 'always' }] },
  // Low mist at dawn, lanternflies at night.
  marsh: { sun: [1, 1, 0.98], shade: [0.95, 1.0, 1.0], air: '#a3c3bd', airShare: 0.25, haze: 1.3, still: 0, flecks: [{ effect: 'marshMist', rate: 3, when: 'dawn' }, { effect: 'lanternfly', rate: 1.6, when: 'night' }] },
  // Cool and clear.
  caveHills: { sun: [0.98, 1.0, 1.05], shade: [0.95, 0.98, 1.06], air: '#9bbbd8', airShare: 0.2, haze: 0.6, still: 0 },
  // The Dawn's gold on the horizon behind them.
  terraces: { sun: [1.03, 1.0, 0.94], shade: [1, 0.98, 0.98], air: '#d8c28e', airShare: 0.3, haze: 1, still: 0.3 },
};

/**
 * Shafts of sun through gaps in the old forest's crowns: how many stand round the hero at most, how far out,
 * how tall and wide, and how bright at full sun. They stand only by day, where the old forest is.
 */
export const FOREST_SHAFTS = { count: 16, reach: 30, height: 24, width: [1.8, 3.6] as const, strength: 0.34, color: '#fff2c4' };
