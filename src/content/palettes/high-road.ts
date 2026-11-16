// The High Road and the north. Grand, a long line: the ancients' causeway on arches, walked for days. A low
// horn holds long notes over a harp in eighths and a bowed drone, with a deep drum on one and three. D major
// with the flat seventh in a C chord, the epic turn. It holds every note of the meadow, the grey forest and
// the terraces but one, so it is the threshold between the valley and the north.
import { bowedPad, chime, deepBass, harp, lowHorn, woodFlute } from './instruments.ts';
import type { Palette } from './types.ts';

export const highRoad: Palette = {
  id: 'highRoad',
  name: 'The High Road',
  feel: 'Grand, a long line',
  root: 50, // D
  scaleName: 'major pentatonic, with the flat seventh in the chords',
  scale: [0, 2, 4, 7, 9],
  color: [10],
  tempo: 76,
  grid: 4,
  swing: 0,
  // I, vi, IV, I, bVII, IV, V: the bVII lifts it like a view opening up.
  chords: [
    { name: 'D', root: 0, tones: [0, 4, 7, 12] },
    { name: 'D', root: 0, tones: [0, 4, 7, 12] },
    { name: 'Bm7', root: 9, tones: [0, 3, 7, 10] },
    { name: 'Gadd9', root: 5, tones: [0, 4, 7, 14] },
    { name: 'D', root: 0, tones: [0, 4, 7, 12] },
    { name: 'Cadd9', root: 10, tones: [0, 4, 7, 14] },
    { name: 'G', root: 5, tones: [0, 4, 7, 12] },
    { name: 'A', root: 7, tones: [0, 4, 7, 12] },
  ],
  // Brought level with the meadow by bun tools/region-music.mjs.
  gain: 1.15,
  drone: [
    {
      patch: bowedPad, octave: 0, bars: 1, follow: true, gain: 0.4,
      notes: [{ beat: 0, semi: 0, beats: 4.3 }, { beat: 0, semi: 7, beats: 4.3, vel: 0.7 }],
    },
  ],
  bass: {
    patch: deepBass, octave: -1, gain: 0.8,
    rhythms: ['R.......R.......', 'R.......5.......', 'R...........a...'],
    fight: 'R.R.R.8.R.R.5.R.',
  },
  harmony: {
    patch: harp, octave: 0, style: 'arp', gain: 0.45,
    rhythms: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x...x.x.x.x.x...'],
    fight: 'X.xxX.xxX.xxX.xx',
    shapes: [[0, 2, 3, 4, 5, 4, 3, 2], [0, 2, 4, 5, 6, 5, 4, 2], [0, 1, 3, 4, 5, 4, 3, 1]],
  },
  melody: { patch: lowHorn, night: woodFlute, octave: 1, rest: 0.1, ornament: 'none', gain: 0.62 },
  perc: [
    { drum: 'deep', gain: 0.45, steps: ['X.......X.......', 'X.......X...x...'] },
    { drum: 'tom', gain: 0.28, steps: ['............x.x.', '................'] },
  ],
  sparkle: { patch: chime, octave: 3, chance: 0.03, gain: 0.22 },
  signature: 'highWindBells',
  life: { birds: 0.6, crickets: 0.5, frogs: 0 },
};
