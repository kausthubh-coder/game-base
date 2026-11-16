// The terraces and the Stag, the far north. Ancient, solemn: giant stone steps wrapped in roots, a fallen
// colossus, the Verdant Stag's hall. A low choir, a bell that tolls once every four bars, a horn, a deep drum.
// A Aeolian: it shares five notes with the grey forest round it and six with the High Road.
import { droneString, lowChoir, lowHorn, paleBell, subBass, templeBell } from './instruments.ts';
import type { Palette } from './types.ts';

export const terraces: Palette = {
  id: 'terraces',
  name: 'The terraces',
  feel: 'Ancient, solemn',
  root: 45, // A
  scaleName: 'Aeolian pentatonic, with the fourth in the chords',
  scale: [0, 2, 3, 7, 10],
  color: [5],
  tempo: 58,
  grid: 4,
  swing: 0,
  // i, VI, VII, v: an old modal turn with no leading note.
  chords: [
    { name: 'Am(add9)', root: 0, tones: [0, 3, 7, 14] },
    { name: 'Am(add9)', root: 0, tones: [0, 3, 7, 14] },
    { name: 'Fmaj7', root: 8, tones: [0, 4, 7, 11] },
    { name: 'Fmaj7', root: 8, tones: [0, 4, 7, 11] },
    { name: 'G', root: 10, tones: [0, 4, 7, 12] },
    { name: 'G', root: 10, tones: [0, 4, 7, 12] },
    { name: 'Em7', root: 7, tones: [0, 3, 7, 10] },
    { name: 'Esus4', root: 7, tones: [0, 5, 7, 12] },
  ],
  // Brought level with the meadow by bun tools/region-music.mjs.
  gain: 1.3,
  drone: [
    {
      patch: lowChoir, octave: 0, bars: 2, gain: 0.5,
      notes: [{ beat: 0, semi: 0, beats: 8.6 }, { beat: 0, semi: 7, beats: 8.6, vel: 0.7 }],
    },
    // The toll: one deep bell at the top of every fourth bar.
    { patch: templeBell, octave: 0, bars: 4, gain: 0.3, notes: [{ beat: 0, semi: 0, beats: 4, vel: 0.7 }] },
  ],
  bass: {
    patch: subBass, octave: -1, gain: 0.6,
    rhythms: ['R...............', 'R.......5.......'],
    fight: 'R.R.R.8.R.R.5.R.',
  },
  harmony: {
    patch: droneString, octave: 0, style: 'arp', gain: 0.35,
    rhythms: ['x.......x.......', 'x...........x...', 'x...x.......x...'],
    fight: 'X.xxX.xxX.xxX.xx',
    shapes: [[0, 2, 3, 4, 5, 4, 3, 2], [0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 4, 5, 4, 2, 1, 0]],
  },
  melody: { patch: lowHorn, night: paleBell, octave: 2, rest: 0.25, ornament: 'none', gain: 0.58 },
  perc: [
    { drum: 'deep', gain: 0.4, steps: ['X...............', 'X.......x.......'] },
    { drum: 'frameDum', gain: 0.22, steps: ['........x.......', '................'] },
  ],
  sparkle: { patch: templeBell, octave: 2, chance: 0.02, gain: 0.2 },
  signature: 'stillAir',
  life: { birds: 0.2, crickets: 0.2, frogs: 0 },
};
