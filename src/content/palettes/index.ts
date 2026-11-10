// The seven starting palettes, named by land. To add a land, add its file and list it here.
import { center } from './center.ts';
import { coast } from './coast.ts';
import { desert } from './desert.ts';
import { forge } from './forge.ts';
import { highlands } from './highlands.ts';
import { meadow } from './meadow.ts';
import { rainvalley } from './rainvalley.ts';
import type { Palette } from './types.ts';

export const palettes: Palette[] = [meadow, desert, coast, rainvalley, highlands, forge, center];

export type { Chord, DrumId, Palette, Patch, SignatureBed, WaveName } from './types.ts';
export { bossMotif, worldMotif } from './motif.ts';
