// The grey forest, the band north of the High Road. Sparse, sad, still: the same oaks with the colour gone,
// nothing flowers. One soft bell a long way apart, a harp that barely moves, a pulse like a slow heart, and a
// still drone. E Aeolian with the flat sixth; it shares E F# G A B with the Old Forest and all six of its
// notes with the High Road it lies against.
import { glassLead, harp, paleBell, stillPad, subBass, tinyBell } from './instruments.ts';
import type { Palette } from './types.ts';

export const greyForest: Palette = {
  id: 'greyForest',
  name: 'The grey forest',
  feel: 'Sparse, sad, still',
  root: 52, // E
  scaleName: 'Aeolian pentatonic with the flat sixth',
  scale: [0, 2, 3, 7, 8],
  tempo: 56,
  grid: 4,
  swing: 0,
  // i, VI, iv, a suspended V that never resolves to a major chord.
  chords: [
    { name: 'Em(add9)', root: 0, tones: [0, 3, 7, 14] },
    { name: 'Em(add9)', root: 0, tones: [0, 3, 7, 14] },
    { name: 'Cmaj7', root: 8, tones: [0, 4, 7, 11] },
    { name: 'Cmaj7', root: 8, tones: [0, 4, 7, 11] },
    { name: 'Am', root: 5, tones: [0, 3, 7, 12] },
    { name: 'Am', root: 5, tones: [0, 3, 7, 12] },
    { name: 'Bsus4', root: 7, tones: [0, 5, 7, 12] },
    { name: 'Bsus4', root: 7, tones: [0, 5, 7, 12] },
  ],
  // Brought level with the meadow by bun tools/region-music.mjs.
  gain: 1.5,
  drone: [
    {
      patch: stillPad, octave: 0, bars: 4, gain: 0.42,
      notes: [{ beat: 0, semi: 0, beats: 16.5 }, { beat: 0, semi: 7, beats: 16.5, vel: 0.6 }],
    },
  ],
  bass: {
    patch: subBass, octave: -1, gain: 0.5,
    rhythms: ['R...............', '................', 'R...............', '........R.......'],
    fight: 'R.R.R.8.R.R.5.R.',
  },
  harmony: {
    patch: harp, octave: 0, style: 'arp', gain: 0.3,
    rhythms: ['x.......x.......', 'x...........x...', 'x.......x...x...'],
    fight: 'X.xxX.xxX.xxX.xx',
    shapes: [[0, 2, 3, 4, 5, 4, 3, 2], [0, 2, 4, 5, 6, 5, 4, 2], [0, 1, 3, 4, 5, 4, 3, 1]],
  },
  melody: { patch: paleBell, night: glassLead, octave: 1, rest: 0.45, ornament: 'none', gain: 0.55 },
  perc: [
    { drum: 'pulse', gain: 0.16, steps: ['X...............', '................'] },
  ],
  sparkle: { patch: tinyBell, octave: 3, chance: 0.015, gain: 0.15 },
  signature: 'stillAir',
  life: { birds: 0.05, crickets: 0.1, frogs: 0 },
};
