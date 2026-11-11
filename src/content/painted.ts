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
  cloud: [number, number, number];
}

const NIGHT: Mood = { sunTint: [0.13, 0.2, 0.36], shadeTint: [0.04, 0.065, 0.15], skyAdd: [0.003, 0.006, 0.02], leafSun: [0.22, 0.32, 0.55], leafShade: [0.16, 0.24, 0.46], cloud: [0.2, 0.25, 0.4] };
const DAWN: Mood = { sunTint: [1.22, 0.92, 0.68], shadeTint: [0.27, 0.32, 0.56], skyAdd: [0.022, 0.02, 0.06], leafSun: [1.2, 0.95, 0.7], leafShade: [0.86, 0.78, 1.0], cloud: [1.1, 0.88, 0.8] };
const NOON: Mood = { sunTint: [1.06, 1.0, 0.84], shadeTint: [0.21, 0.37, 0.58], skyAdd: [0.008, 0.022, 0.05], leafSun: [1, 1, 1], leafShade: [1, 1, 1], cloud: [1, 1, 1] };
const EVENING: Mood = { sunTint: [1.3, 0.9, 0.55], shadeTint: [0.3, 0.33, 0.6], skyAdd: [0.03, 0.022, 0.07], leafSun: [1.28, 0.93, 0.6], leafShade: [0.86, 0.74, 1.0], cloud: [1.12, 0.84, 0.74] };

/** The moods through the day, by the clock: 0 is midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
export const MOODS: readonly (readonly [number, Mood])[] = [
  [0, NIGHT], [0.2, NIGHT], [0.27, DAWN], [0.36, NOON], [0.62, NOON], [0.73, EVENING], [0.8, NIGHT], [1, NIGHT],
];

/** Meters of clear air before the haze begins, and how fast it thickens. */
export const HAZE = { start: 30, density: 0.003 };
