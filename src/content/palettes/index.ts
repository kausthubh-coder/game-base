// The seven starting palettes, named by land, and Hollowmere's. To add a land, add its file and list it here.
import { center } from './center.ts';
import { coast } from './coast.ts';
import { desert } from './desert.ts';
import { forge } from './forge.ts';
import { highlands } from './highlands.ts';
import { meadow } from './meadow.ts';
import { rainvalley } from './rainvalley.ts';
import { town } from './town.ts';
import type { Palette } from './types.ts';

export const palettes: Palette[] = [meadow, desert, coast, rainvalley, highlands, forge, center, town];

export type { Chord, DrumId, Palette, Patch, SignatureBed, WaveName } from './types.ts';
export { bossMotif, worldMotif } from './motif.ts';
