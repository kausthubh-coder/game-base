// The painted world as data: its trees, the colours of its light through the day, and where its haze begins.
// The numbers come from the painted meadow test scene (demos/ghibli), which Kausthubh picked as the look.

/** One kind of tree, as the painted feature's `TreeSpec` wants it. Lengths are meters at a scale of 1. */
export interface PaintedTree {
  seed: number; height: number; trunk: number; crown: number; blobs: number; card: number; cover: number; squash: number; lean: number;
  low?: number; fork?: number;
}

const OAK: PaintedTree = { seed: 21, height: 9.5, trunk: 0.42, crown: 4.6, blobs: 8, card: 1.1, cover: 1.45, squash: 0.8, lean: 0.5 };
const ELM: PaintedTree = { seed: 34, height: 12.5, trunk: 0.5, crown: 5.0, blobs: 9, card: 1.15, cover: 1.45, squash: 0.92, lean: -0.6 };
const SPREADING: PaintedTree = { seed: 144, height: 8.5, trunk: 0.34, crown: 6.8, blobs: 12, card: 1.3, cover: 1.5, squash: 0.7, lean: 0.5, low: -0.38, fork: 0.33 };
const BIRCH: PaintedTree = { seed: 61, height: 11, trunk: 0.26, crown: 3.4, blobs: 7, card: 0.95, cover: 1.4, squash: 1.15, lean: 0.4 };
const BIRCH_YOUNG: PaintedTree = { seed: 67, height: 8, trunk: 0.2, crown: 2.6, blobs: 6, card: 0.9, cover: 1.4, squash: 1.2, lean: -0.3 };
const CEDAR: PaintedTree = { seed: 55, height: 13, trunk: 0.38, crown: 2.3, blobs: 6, card: 0.9, cover: 1.5, squash: 2.3, lean: 0 };
const CEDAR_STOUT: PaintedTree = { seed: 58, height: 10.5, trunk: 0.4, crown: 2.8, blobs: 6, card: 0.95, cover: 1.5, squash: 1.9, lean: 0 };

/** The shape of each kind of tree the rules grow, by its variant. `spray` is which leaf spray it wears, 0 to 2. */
export const PAINTED_TREES: Readonly<Record<string, readonly { spec: PaintedTree; spray: number }[]>> = {
  oak: [{ spec: OAK, spray: 0 }, { spec: SPREADING, spray: 0 }, { spec: ELM, spray: 1 }],
  birch: [{ spec: BIRCH, spray: 1 }, { spec: ELM, spray: 1 }, { spec: BIRCH_YOUNG, spray: 1 }],
  pine: [{ spec: CEDAR, spray: 2 }, { spec: CEDAR_STOUT, spray: 2 }, { spec: CEDAR, spray: 2 }],
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

/** The colour of water over a shallow bed and over a deep one, and of water on the far land. */
export const PAINTED_WATER = { shallow: '#8fd6c4', deep: '#3c88b4', far: '#74b9d4' };

/** How far from the hero a tree is drawn leaf by leaf. Past it a tree is a picture of itself. The rules know trees this far at least. */
export const TREE_REACH = 62;
/** How far out the far trees stand. */
export const FAR_TREES = 288;
