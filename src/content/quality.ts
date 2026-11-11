// The one quality table: every graphics feature that changes with the level, and its value at each of the
// four levels. A view system reads its values from here (`QUALITY[ctx.quality]`). No view system keeps
// a table of its own or decides by the level's name, so a level is tuned in this file and nowhere else.
//
// `docs/architecture.md` ("Four graphics levels") says what each level is for. `docs/fast-everywhere.md`
// has the budgets: 80 draw calls and 150,000 triangles at low, 150 and 400,000 at high.
//
// The level's name is `Level`. `Quality` in src/engine/types.ts still names three of them, so `ctx.quality`
// carries `ultra` under that type until the engine's type has it too.

export type Level = 'low' | 'medium' | 'high' | 'ultra';

/** The levels, cheapest first. */
export const LEVELS: readonly Level[] = ['low', 'medium', 'high', 'ultra'];

/** One feature's value at low, medium, high and ultra, in that order. */
type Row<T> = readonly [low: T, medium: T, high: T, ultra: T];

/** The table. One row a feature, one column a level. */
const TABLE = {
  // ---------------------------------------------------------------- the picture (src/features/post, the shell)
  /** The share of the screen's width and height the 3D picture is drawn at. The interface is HTML and stays sharp. */
  renderScale: [0.75, 1, 1, 1] as Row<number>,
  /** The most device pixels drawn for one CSS pixel. A screen with fewer draws its own. */
  pixelRatio: [1.5, 1.5, 1.5, 2] as Row<number>,
  /** Edge-smoothing samples for the 3D picture when it is drawn off screen. The graphics chip may give fewer. */
  msaa: [0, 2, 4, 8] as Row<number>,
  /** Glow around lamps, the sun and lightning. Off, the picture is drawn straight to the screen with no extra pass. */
  bloom: [false, true, true, true] as Row<boolean>,
  /** A blur toward the top and bottom of the screen. The painted look turns it off at every level. */
  tiltShift: [false, false, true, true] as Row<boolean>,
  /** Darker corners. The painted look turns it off at every level. */
  vignette: [false, true, true, true] as Row<boolean>,
  /** A soft roll-off for bright colours. The painted look turns it off at every level. */
  toneMapping: [true, true, true, true] as Row<boolean>,

  // ---------------------------------------------------------------- sun and shadow (src/features/sky, src/features/props)
  /** The sun's shadow map, in pixels a side. */
  shadowMap: [1024, 1536, 2048, 4096] as Row<number>,
  /** The shadow map is drawn again every this many frames. */
  shadowEvery: [2, 1, 1, 1] as Row<number>,
  /** How far shadows reach, against what the camera asks for. A longer reach spreads the same map thinner. */
  shadowReach: [1, 1, 1, 1.5] as Row<number>,
  /** Props cast shadows, and stand on dark blobs and boxes that seat them on the ground. */
  propShadows: [false, true, true, true] as Row<boolean>,
  /**
   * Cloud shadows through the sun's shadow map. They come out as dark and hard-edged as a tree's: off at every
   * level unless the Graphics setting turns them on, until they are drawn as a soft tint on the ground instead.
   */
  cloudShadows: [false, false, false, false] as Row<boolean>,
  /** Shafts of light at dawn. */
  lightShafts: [false, false, true, true] as Row<boolean>,

  // ---------------------------------------------------------------- the land and what grows on it
  /** How far the block world is loaded and drawn, in chunks of 16 blocks. The far land carries on from there. (src/features/world) */
  viewChunks: [4, 5, 6, 7] as Row<number>,
  /**
   * The spacing between grass blades, against the finest. 1.9 is about a quarter of the blades. The grass holds
   * 70,000 blades at most, and high reaches 46,000 on the road to town, so 0.9 is as dense as ultra can go
   * before blades go missing. (src/features/painted/grass.ts)
   */
  grassSpacing: [1.9, 1.35, 1, 0.9] as Row<number>,
  /** How many of the grass's three rings are grown: fine blades to 34 blocks, coarser to 66, broad strokes to 112. */
  grassRings: [2, 3, 3, 3] as Row<number>,
  /** The share of small scattered plants that is kept. (src/features/props) */
  plants: [0.45, 0.8, 1, 1] as Row<number>,

  // ---------------------------------------------------------------- water, weather and effects
  /** Layers of rain rings on the block world's water. (src/features/water) */
  rainRings: [1, 2, 2, 2] as Row<number>,
  /** The share of each effect's particles that is made. (src/features/effects) */
  particles: [0.5, 0.75, 1, 1] as Row<number>,

  // ---------------------------------------------------------------- people and creatures
  /** How many sprites read the world's light and ground again each frame. The drawing costs the same at every level. (src/features/sprites) */
  spriteLightRefresh: [8, 16, 32, 32] as Row<number>,
  /** How many 3D characters read the world's light again each frame. (src/features/toon) */
  modelLightRefresh: [4, 8, 16, 16] as Row<number>,
  /** The ink outline of 3D characters. It doubles their triangles. */
  modelOutlines: [false, true, true, true] as Row<boolean>,

  // ---------------------------------------------------------------- markers and build mode
  /** The quest beam breathes. Off, it stands still. (src/features/map) */
  beaconPulse: [false, true, true, true] as Row<boolean>,
  /** How far build mode's grid reaches from the pointer, in cells each way. (src/game/views/world-build.view.ts) */
  buildGridReach: [4, 6, 7, 7] as Row<number>,
  /** Build mode flashes a cell when something is set down in it. */
  buildFlashes: [false, true, true, true] as Row<boolean>,

  // ---------------------------------------------------------------- sound (src/features/audio)
  /** The music's sparkle and town arrangement, and the forest and stone spaces of the mix. */
  richSound: [false, true, true, true] as Row<boolean>,
} as const;

/** The name of a row of the table. */
export type QualityFeature = keyof typeof TABLE;

/** Every feature's value at one level. */
export type QualityValues = { readonly [K in QualityFeature]: (typeof TABLE)[K][number] };

function column(index: number): QualityValues {
  const values: Record<string, number | boolean> = {};
  for (const feature of Object.keys(TABLE) as QualityFeature[]) values[feature] = TABLE[feature][index] as number | boolean;
  return values as unknown as QualityValues;
}

/** What each level sets. `QUALITY[ctx.quality].grassRings`. */
export const QUALITY: Readonly<Record<Level, QualityValues>> = { low: column(0), medium: column(1), high: column(2), ultra: column(3) };

/** The whole table, a row a feature, for a report or a settings screen. */
export const QUALITY_ROWS: Readonly<Record<QualityFeature, Row<number | boolean>>> = TABLE;

/** The level a name stands for, or null: what an address (`?quality=ultra`) or a stored setting asks for. */
export function levelOf(name: unknown): Level | null {
  return LEVELS.find((level) => level === name) ?? null;
}

/**
 * The steps automatic quality takes, best first: it gives up render size before it gives up effects. It starts
 * at high and never picks ultra by itself. Ultra is set by hand, until the game can tell a good graphics card.
 */
export const QUALITY_LADDER: readonly { readonly quality: Level; readonly scale: number }[] = [
  { quality: 'high', scale: 1 },
  { quality: 'high', scale: 0.85 },
  { quality: 'high', scale: 0.7 },
  { quality: 'medium', scale: 0.7 },
  { quality: 'low', scale: 0.7 },
];

/** The budgets a level is held to, from docs/fast-everywhere.md. Medium and ultra have none of their own yet. */
export const QUALITY_BUDGETS: Readonly<Record<Level, { readonly drawCalls: number; readonly triangles: number } | null>> = {
  low: { drawCalls: 80, triangles: 150000 },
  medium: null,
  high: { drawCalls: 150, triangles: 400000 },
  ultra: null,
};
