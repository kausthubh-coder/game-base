// Forge, the north. Heavy, proud, a work song. Anvil hits, low reed drone, deep drum, low choir pad.
import { choirPad, deepBass, dulcimer, horn, ironTing, lowReed, reedFlute } from './instruments.ts';
import type { Palette } from './types.ts';

export const forge: Palette = {
  id: 'forge',
  name: 'Forge',
  feel: 'Heavy, proud, work song',
  root: 47, // B
  scaleName: 'natural minor, open fifths',
  scale: [0, 2, 3, 5, 7, 8, 10],
  tempo: 80,
  grid: 4,
  swing: 0,
  // Open fifths: no chord carries a third. The melody supplies the minor.
  chords: [
    { name: 'B5', root: 0, tones: [0, 7, 12, 19] },
    { name: 'B5', root: 0, tones: [0, 7, 12, 19] },
    { name: 'G5', root: 8, tones: [0, 7, 12, 19] },
    { name: 'A5', root: 10, tones: [0, 7, 12, 19] },
    { name: 'B5', root: 0, tones: [0, 7, 12, 19] },
    { name: 'B5', root: 0, tones: [0, 7, 12, 19] },
    { name: 'D5', root: 3, tones: [0, 7, 12, 19] },
    { name: 'A5', root: 10, tones: [0, 7, 12, 19] },
  ],
  gain: 1,
  drone: [
    {
      patch: lowReed, octave: -1, bars: 2, gain: 0.3,
      notes: [{ beat: 0, semi: 0, beats: 8.5 }, { beat: 0, semi: 7, beats: 8.5, vel: 0.7 }],
    },
    {
      patch: choirPad, octave: 0, bars: 1, follow: true, gain: 0.4,
      notes: [{ beat: 0, semi: 0, beats: 4.2 }, { beat: 0, semi: 7, beats: 4.2, vel: 0.8 }],
    },
  ],
  bass: {
    patch: deepBass, octave: -1, gain: 1.1,
    rhythms: ['R.......R..R....', 'R.......R.....5.'],
    fight: 'R.R.R.R.R.R.R.5.',
  },
  harmony: {
    // The stomp of a work song: heavy on one and three.
    patch: dulcimer, octave: 0, style: 'strum', gain: 0.42,
    rhythms: ['X.....x.X.....x.', 'X.....x.X...x.x.'],
    fight: 'X.x.X.x.X.x.X.xx',
    shapes: [[0, 1, 0, 2], [0, 2, 1, 2]],
  },
  melody: { patch: horn, night: reedFlute, octave: 1, rest: 0.25, ornament: 'none', gain: 0.62 },
  perc: [
    { drum: 'deep', gain: 0.7, steps: ['X.......X.x.....', 'X.......X.x...o.'] },
    { drum: 'anvil', gain: 0.38, steps: ['....X.......X...', '....X.......X.x.'] },
    { drum: 'handLow', gain: 0.35, steps: ['..o...x...o...x.'], when: 'town' },
  ],
  sparkle: { patch: ironTing, octave: 3, chance: 0.03, gain: 0.2 },
  signature: 'forgeHammers',
  life: { birds: 0.3, crickets: 0.5, frogs: 0.1 },
};
