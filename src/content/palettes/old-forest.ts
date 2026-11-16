// The Old Forest, the west. Deep, slow, wonder: old oaks twice a house high, shafts of light. A wooden flute
// low over a harp that plays a note a beat, a bowed drone, a woodpecker's click. E Dorian: it shares six notes
// with the meadow's D (D E F# A B C#), so the edge of the trees is a crossfade through common notes.
import { bowedPad, chime, glassBell, harp, subBass, woodFlute } from './instruments.ts';
import type { Palette } from './types.ts';

export const oldForest: Palette = {
  id: 'oldForest',
  name: 'The Old Forest',
  feel: 'Deep, slow, wonder',
  root: 52, // E
  scaleName: 'Dorian pentatonic, with the raised sixth in the IV chord',
  scale: [0, 2, 3, 7, 10],
  color: [9],
  tempo: 66,
  grid: 4,
  swing: 0,
  // i, IV, III, VII: the major IV is the Dorian light through the canopy.
  chords: [
    { name: 'Em9', root: 0, tones: [0, 3, 7, 14] },
    { name: 'Em9', root: 0, tones: [0, 3, 7, 14] },
    { name: 'A', root: 5, tones: [0, 4, 7, 12] },
    { name: 'A', root: 5, tones: [0, 4, 7, 12] },
    { name: 'Gmaj7', root: 3, tones: [0, 4, 7, 11] },
    { name: 'Gmaj7', root: 3, tones: [0, 4, 7, 11] },
    { name: 'D', root: 10, tones: [0, 4, 7, 12] },
    { name: 'Dsus2', root: 10, tones: [0, 2, 7, 12] },
  ],
  // Brought level with the meadow by bun tools/region-music.mjs.
  gain: 1.1,
  drone: [
    {
      patch: bowedPad, octave: 0, bars: 2, gain: 0.48,
      notes: [{ beat: 0, semi: 0, beats: 8.6 }, { beat: 0, semi: 7, beats: 8.6, vel: 0.7 }],
    },
  ],
  bass: {
    patch: subBass, octave: -1, gain: 0.7,
    rhythms: ['R...............', 'R.......5.......', 'R...........a...'],
    fight: 'R.R.R.8.R.R.5.R.',
  },
  harmony: {
    patch: harp, octave: 0, style: 'arp', gain: 0.45,
    rhythms: ['x...x...x...x...', 'x...x.x.x...x...', 'x.....x.x...x...'],
    fight: 'X.xxX.xxX.xxX.xx',
    shapes: [[0, 2, 3, 4, 5, 4, 3, 2], [0, 2, 4, 5, 6, 5, 4, 2], [0, 1, 3, 4, 5, 4, 3, 1]],
  },
  melody: { patch: woodFlute, night: glassBell, octave: 1, rest: 0.3, ornament: 'bend', gain: 0.62 },
  perc: [
    { drum: 'handLow', gain: 0.35, steps: ['X.......x.......', 'X.........x.....'] },
    { drum: 'click', gain: 0.18, steps: ['......x.......x.', '..............xx'] },
  ],
  sparkle: { patch: chime, octave: 3, chance: 0.04, gain: 0.24 },
  signature: 'none',
  life: { birds: 1.6, crickets: 0.8, frogs: 0.3 },
};
