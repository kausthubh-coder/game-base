// The seven starting palettes, named by land, and Hollowmere's. To add a land, add its file and list it here.
// The game plays Greenhollow's own set: the meadow and Hollowmere, and a palette for each region of the map.
import { caves } from './caves.ts';
import { center } from './center.ts';
import { coast } from './coast.ts';
import { desert } from './desert.ts';
import { forge } from './forge.ts';
import { greyForest } from './grey-forest.ts';
import { highRoad } from './high-road.ts';
import { highlands } from './highlands.ts';
import { marsh } from './marsh.ts';
import { meadow } from './meadow.ts';
import { mere } from './mere.ts';
import { oldForest } from './old-forest.ts';
import { rainvalley } from './rainvalley.ts';
import { terraces } from './terraces.ts';
import { town } from './town.ts';
import type { Palette } from './types.ts';

export const palettes: Palette[] = [meadow, desert, coast, rainvalley, highlands, forge, center, town];

/**
 * Greenhollow's music, region by region (src/game/content/soundscape.ts says which plays where). The meadow
 * is first, so it is what plays when the game sends no weights. Every two that meet on the map share at least
 * four notes.
 */
export const greenhollowPalettes: Palette[] = [meadow, town, oldForest, greyForest, highRoad, terraces, marsh, caves, mere];

export type { Chord, DrumId, Palette, Patch, SignatureBed, WaveName } from './types.ts';
export { bossMotif, worldMotif } from './motif.ts';
