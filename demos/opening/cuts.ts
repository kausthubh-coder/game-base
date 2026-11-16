// The cuts the lab can play: which way draws each part of the film. `?cut=<name>` picks one.
// Each way is loaded only when a cut uses it, so one way's broken build cannot stop another from playing.
import type { CreateRenderer, Way } from './types.ts';

export interface Cut {
  name: string;
  /** One line under the name on the lab page. */
  about: string;
  /** The way that draws the legend, then the way that draws you. */
  parts: readonly [Way, Way];
}

export const CUTS = {
  plates: { name: 'The mockup', about: 'One painted picture a shot under a slow camera. What the planning site plays today.', parts: ['plates', 'plates'] },
  drawn: { name: 'Drawn by code', about: 'No picture files. Code paints every frame.', parts: ['drawn', 'drawn'] },
  cutout: { name: 'Painted layers', about: 'Painted pieces from Sol, moved and lit like a cut-out film.', parts: ['cutout', 'cutout'] },
  engine: { name: 'In the game', about: 'Real 3D rooms, the game\'s people, a moving camera, weather and light.', parts: ['engine', 'engine'] },
  'mix-drawn': { name: 'Drawn legend, then the game', about: 'The legend drawn by code, then the dark room and the doorstep in the game.', parts: ['drawn', 'engine'] },
  'mix-cutout': { name: 'Painted legend, then the game', about: 'The legend in painted layers, then the dark room and the doorstep in the game.', parts: ['cutout', 'engine'] },
} as const satisfies Record<string, Cut>;

export type CutName = keyof typeof CUTS;

export const WAYS: Record<Way, () => Promise<{ create: CreateRenderer }>> = {
  plates: () => import('./plates/index.ts'),
  drawn: () => import('./drawn/index.ts'),
  cutout: () => import('./cutout/index.ts'),
  engine: () => import('./engine/index.ts'),
};
