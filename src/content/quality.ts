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
   * The spacing between grass blades, against the finest. 2.2 is about a fifth of the blades. The grass holds
   * 70,000 blades at most, and high reaches 46,000 on the road to town, so 0.9 is as dense as ultra can go
   * before blades go missing. (src/features/painted/grass.ts)
   */
  grassSpacing: [2.2, 1.35, 1, 0.9] as Row<number>,
  /** How many of the grass's three rings are grown: fine blades to 34 blocks, coarser to 66, broad strokes to 112. */
  grassRings: [2, 3, 3, 3] as Row<number>,
  /** Meters between two points of the far land, which carries the land on to the horizon. (src/features/painted/far.ts) */
  farLandCell: [14, 8, 8, 8] as Row<number>,
  /** The share of small scattered plants that is kept. (src/features/props) */
  plants: [0.45, 0.8, 1, 1] as Row<number>,
  /**
   * The share of each kind of land's small things that grows (ferns, reeds, crystals, roots), and how far out
   * they grow against their own reach. (src/features/painted/wilds.ts, WILDS in src/content/painted.ts)
   */
  wilds: [0.45, 0.75, 1, 1] as Row<number>,
  wildsReach: [0.6, 0.85, 1, 1] as Row<number>,
  /**
   * Triangles the painted trees near the hero may cost, their shadows included. In a wood thick enough to go
   * over, the trees farthest off are drawn as their pictures sooner, so the nearest stay leaf by leaf.
   * (src/game/views/world-painted.view.ts)
   */
  treeTriangles: [36000, 100000, 150000, 150000] as Row<number>,
  /**
   * How far off a tree is drawn leaf by leaf at most, in blocks; past it the tree is its picture. Each kind of
   * tree drawn leaf by leaf costs its own draw calls, so a shorter reach is fewer of them. (world-painted.view.ts)
   */
  treeReach: [40, 52, 62, 62] as Row<number>,
  /**
   * How far off the painted boulders and bushes are drawn, in blocks, and how near a bush wears its full leaves:
   * past that, or at 0 everywhere, a bush is fewer, larger leaf cards, a third of the triangles. A standing stone
   * is drawn from any distance. (src/features/painted/scatter.ts)
   */
  scatterReach: [64, 72, 88, 112] as Row<number>,
  fineBushReach: [0, 32, 44, 64] as Row<number>,
  /** Shafts of sun through the old forest's crowns. (src/features/painted/shafts.ts) */
  forestShafts: [false, true, true, true] as Row<boolean>,
  /**
   * The landmark models of Greenhollow (the High Road's arches, the terraces, the ruins): the most triangles drawn at
   * once, the nearest and largest first, a near one's shadow counted too, and how far off one is drawn at most, in
   * blocks. (src/game/views/world-landmarks.view.ts)
   */
  landmarkTriangles: [25000, 50000, 70000, 120000] as Row<number>,
  landmarkReach: [220, 300, 380, 460] as Row<number>,
  /**
   * Hollowmere's city (src/game/views/world-city.view.ts): the most triangles its buildings may cost in full, a near
   * one's shadow counted too, how far off a building is drawn in full, and how far its street pieces reach. Past
   * that a building is its far version, a few dozen triangles wearing pictures of its model, out to `landmarkReach`.
   */
  cityTriangles: [16000, 36000, 56000, 100000] as Row<number>,
  cityReach: [50, 80, 110, 150] as Row<number>,
  cityPieceReach: [36, 50, 64, 80] as Row<number>,
  /**
   * The old town round the green (src/game/views/world-town.view.ts): the most triangles its squares drawn whole may
   * cost, a shadow counted too, the nearest square first within `cityReach`. The rest are their far versions.
   */
  townTriangles: [30000, 110000, 110000, 220000] as Row<number>,
  /** Props wear their painted textures (rock, bark, thatch). Off, they keep their colours and shading only. (src/features/props) */
  propTextures: [false, true, true, true] as Row<boolean>,
  /** How finely the soft forms of props are cut (rocks, sweeps, lathes), against the finest. (src/features/props) */
  propDetail: [0.5, 1, 1, 1] as Row<number>,

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

  // ---------------------------------------------------------------- the camera (src/features/camera/sight.sim.ts)
  /**
   * How many points the camera keeps in sight through what stands in front of them: the hero, the person talking,
   * the people of a scene, the beasts of a fight. Each costs a few sums on every pixel of a model that sees through.
   */
  seeThrough: [2, 3, 4, 4] as Row<number>,
  /**
   * Under a grove's crowns (the Old Forest, the grey forest), how wide the hole through the leaves round the hero is,
   * as a share of the camera's distance from the hero: most of the picture, so the trunks and the floor show and the
   * crowns frame its edges. Every pixel cut is one less leaf drawn, so low cuts a little more.
   */
  groveSight: [0.19, 0.18, 0.17, 0.17] as Row<number>,

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
