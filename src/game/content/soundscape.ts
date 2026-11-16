// What Greenhollow sounds like, place by place: which recorded bed plays where and when, and where the spot
// sounds come from. The recordings themselves are made by tools/sound.ts from src/content/sound-samples.ts.
// src/game/sound/soundscape.sim.ts turns this and the hero's position and hour into levels, and
// src/game/views/core-sound.view.ts plays them. Coordinates are blocks, as in region.ts.
import type { Biome } from './greenhollow.ts';
import { REGION, type Rect } from './region.ts';

// ------------------------------------------------------------------------------------------ the regions

/**
 * The regions of Greenhollow that have music of their own. Each is the id of a palette in
 * src/content/palettes (`greenhollowPalettes`), and src/game/sound/soundscape.sim.ts gives each a weight from
 * where the hero stands, so the music crossfades as they walk.
 */
export const MUSIC_REGIONS = ['meadow', 'town', 'oldForest', 'greyForest', 'highRoad', 'terraces', 'marsh', 'caves', 'mere'] as const;
export type MusicRegion = (typeof MUSIC_REGIONS)[number];

/**
 * Which region each kind of land of the plan is. The plan's `town` is played as the meadow here: Hollowmere's
 * music follows the town's sound zone below, as it always has, so the gate is the border band.
 */
export const REGION_OF_BIOME: Record<Biome, MusicRegion> = {
  meadow: 'meadow', oldForest: 'oldForest', greyForest: 'greyForest', marsh: 'marsh', caveHills: 'caves', terraces: 'terraces', town: 'meadow',
};

/**
 * Bands laid over the kinds of land, each from its full weight at `near` blocks to nothing at `far`. The High
 * Road is a region of its own along its line. The river is the Mere south of the road (`from` and `to` are
 * map y, where the river's music fades in going south). Saltgate is past the map's south edge, so its sea
 * air comes in over the last stretch of map before it (`sea`, map y). The river and the sea lead the music
 * only through open meadow; elsewhere they are heard in their beds alone.
 */
export const MUSIC_BANDS = {
  road: { near: 6, far: 20, weight: 1 },
  river: { near: 3, far: 20, weight: 0.85, from: 205, to: 245 },
  sea: { from: 545, to: 595, weight: 1 },
  /** Biomes are sampled on a 5 by 5 grid this many blocks apart, so a border is a band about 25 blocks wide. */
  spacing: 6,
} as const;

/** The bands, for the beds that follow a band and not a region: the river's water, the sea's gulls, the road's wind. */
export type SoundBand = 'river' | 'sea' | 'road';

/** A part of the map that sounds like itself. Inside `rect` it is 1, and it fades to 0 over `fade` blocks. */
export interface SoundZone {
  rect: Rect;
  fade: number;
}

export type ZoneId = 'town' | 'square' | 'bank' | 'lane';

/** When a sound is about. Hours of the game clock. */
export type SoundHours = 'day' | 'night' | 'work' | 'always';

export const ZONES: Record<ZoneId, SoundZone> = {
  // The whole town, a little past its walls, so the murmur rises as the gate comes near.
  town: { rect: { x0: 137, z0: -190, x1: 203, z1: -125 }, fade: 26 },
  // The cobbled square around the well.
  square: { rect: { x0: 159, z0: -161, x1: 187, z1: -141 }, fade: 12 },
  // The quay and the ferry, where the river laps at the stone.
  bank: { rect: { x0: 139, z0: -134, x1: 203, z1: -120 }, fade: 12 },
  // The lane by the carpenter's and the alley up to the main street: the workshop side of town.
  lane: { rect: { x0: 141, z0: -176, x1: 158, z1: -150 }, fade: 9 },
};

/**
 * A recorded bed and the rule for its level. `in` multiplies the weights of zones (all of them must hold);
 * `out` multiplies by one minus a zone's weight. `wild` beds play outside town: `forest` under trees, the
 * rest in the open. `lean` turns the bed toward a point, so the water is on the river's side.
 */
export interface BedRule {
  id: string;
  gain: number;
  hours: SoundHours;
  in?: readonly ZoneId[];
  out?: readonly ZoneId[];
  wild?: 'open' | 'forest' | 'any';
  /** How much of the level stays when the zone is at 0: a floor under `in`. */
  floor?: number;
  lean?: 'quay' | 'lane' | 'well';
  /** The level is multiplied by the summed weight of these regions and bands where the hero stands. */
  region?: readonly (MusicRegion | SoundBand)[];
}

export const BEDS: readonly BedRule[] = [
  { id: 'bed.town.murmur', gain: 0.9, hours: 'day', in: ['town', 'square'], floor: 0.35, out: ['bank'] },
  { id: 'bed.town.square', gain: 0.75, hours: 'day', in: ['square'], lean: 'well' },
  { id: 'bed.town.birds', gain: 0.55, hours: 'day', in: ['town'] },
  { id: 'bed.town.water', gain: 1, hours: 'always', in: ['bank'], floor: 0, lean: 'quay' },
  { id: 'bed.town.workshop', gain: 0.8, hours: 'work', in: ['lane'], lean: 'lane' },
  { id: 'bed.town.night', gain: 0.8, hours: 'night', in: ['town'] },
  { id: 'bed.town.lantern', gain: 0.6, hours: 'night', in: ['town', 'square'], floor: 0.4 },
  { id: 'bed.meadow.day', gain: 0.8, hours: 'day', out: ['town'], wild: 'open', region: ['meadow', 'mere'] },
  { id: 'bed.forest.day', gain: 0.85, hours: 'day', out: ['town'], wild: 'forest', region: ['meadow', 'mere', 'highRoad'] },
  { id: 'bed.meadow.night', gain: 0.8, hours: 'night', out: ['town'], wild: 'any', region: ['meadow', 'mere', 'highRoad', 'oldForest'] },
  // ---- the regions of Greenhollow
  { id: 'bed.oldforest.day', gain: 0.9, hours: 'day', out: ['town'], region: ['oldForest'] },
  { id: 'bed.greyforest', gain: 0.85, hours: 'always', out: ['town'], region: ['greyForest', 'terraces'] },
  { id: 'bed.marsh', gain: 0.9, hours: 'always', out: ['town'], region: ['marsh'] },
  { id: 'bed.caves', gain: 0.9, hours: 'always', out: ['town'], region: ['caves'] },
  { id: 'bed.river', gain: 0.85, hours: 'always', out: ['town'], region: ['river'] },
  { id: 'bed.saltgate', gain: 0.9, hours: 'always', out: ['town'], region: ['sea'] },
  { id: 'bed.highroad.wind', gain: 0.8, hours: 'always', out: ['town'], region: ['road'] },
];

/** Where the river meets the quay: the water bed leans toward the nearest point of this line. */
export const QUAY = { x0: 139, x1: 203, z: -128, y: 19 };
/** The carpenter's bench, behind the shop's door. */
export const LANE_AT = { x: 150, y: 21, z: -156 };
export const WELL_AT = { x: 173.5, y: 20.5, z: -149.5 };
/** The Order's chapel north of the town (the plan's `chapel`, map 590, 316), its bell up in the half dome. */
export const CHAPEL_AT = { x: 170, y: 32, z: -222 };

/**
 * A sound that happens now and then in one spot. `at` lists where (one is picked each time), or `near` puts
 * it in a ring around the hero. `every` is the range of seconds between two, `zone` the zone it belongs to:
 * outside it, it does not happen.
 */
export interface SpotRule {
  id: string;
  gain: number;
  every: readonly [number, number];
  hours: SoundHours;
  zone: ZoneId | 'wild';
  at?: readonly (readonly [number, number, number])[];
  near?: readonly [number, number];
  /** How far it may be heard, in blocks. */
  reach: number;
  /** Only where these regions hold: the wild's birds are the meadow's, not the grey forest's. */
  region?: readonly (MusicRegion | SoundBand)[];
}

const doorOf = (name: string): [number, number, number] => {
  const place = REGION.places.find((p) => p.name === name);
  return place ? [place.x + 0.5, place.y + 1, place.z + 0.5] : [0, 0, 0];
};

export const SPOTS: readonly SpotRule[] = [
  { id: 'spot.well', gain: 0.8, every: [22, 45], hours: 'day', zone: 'town', at: [[WELL_AT.x, WELL_AT.y, WELL_AT.z]], reach: 40 },
  { id: 'spot.stall', gain: 0.75, every: [8, 18], hours: 'work', zone: 'town', at: [[176.5, 21, -159.5], [158.5, 21, -150.5], [166.5, 21, -159.5]], reach: 34 },
  { id: 'spot.dog', gain: 0.85, every: [18, 40], hours: 'day', zone: 'town', at: [[198.5, 21, -166.5], [196.5, 21, -164.5]], reach: 70 },
  { id: 'spot.children', gain: 0.7, every: [30, 65], hours: 'work', zone: 'town', near: [20, 34], reach: 60 },
  { id: 'spot.door', gain: 0.8, every: [12, 30], hours: 'day', zone: 'town', at: [doorOf('bakery'), doorOf('lodge'), doorOf('carpenter'), doorOf('granary'), [191.5, 21, -175.5], [179.5, 21, -175.5], [143.5, 21, -175.5]], reach: 36 },
  { id: 'spot.cart', gain: 0.75, every: [40, 85], hours: 'work', zone: 'town', at: [[146.5, 21, -173.5], [168.5, 21, -173.5], [186.5, 21, -173.5], [191.5, 21, -150.5]], reach: 50 },
  { id: 'spot.boat', gain: 0.8, every: [10, 26], hours: 'always', zone: 'bank', at: [[199.5, 18.5, -125.5], [197.5, 19, -124.5]], reach: 30 },
  { id: 'spot.bird', gain: 0.6, every: [5, 13], hours: 'day', zone: 'wild', near: [9, 22], reach: 40, region: ['meadow', 'mere', 'oldForest', 'highRoad'] },
  { id: 'spot.creak', gain: 0.7, every: [14, 34], hours: 'always', zone: 'wild', near: [10, 26], reach: 40, region: ['oldForest'] },
  { id: 'spot.crow', gain: 0.55, every: [30, 70], hours: 'day', zone: 'wild', near: [28, 50], reach: 60, region: ['greyForest', 'terraces'] },
  { id: 'spot.market', gain: 0.6, every: [9, 22], hours: 'work', zone: 'square', at: [[176.5, 21, -159.5], [158.5, 21, -150.5], [186.5, 21, -146.5]], reach: 36 },
  // The chapel's bell, heard over the town and the fields round it.
  { id: 'spot.bells', gain: 0.75, every: [75, 150], hours: 'day', zone: 'town', at: [[CHAPEL_AT.x, CHAPEL_AT.y, CHAPEL_AT.z]], reach: 160 },
  { id: 'spot.bird', gain: 0.45, every: [10, 22], hours: 'day', zone: 'town', near: [10, 20], reach: 40 },
];

/** Someone else's footsteps are this loud against the hero's, and are heard this far. */
export const FOLK_STEPS = { quiet: 0.42, reach: 26, stride: 0.75 };
