// Hollowmere, the lake town. Warm, busy, a market morning. A strummed lute, a tin whistle trading phrases with
// a dulcimer, a walking bass, a shaker and a hand drum. It is in G, the meadow's neighbor key: the two share
// D E F# A B, so in the band between the fields and the square both play only those and nothing clashes. Its
// tempo, 92, is close enough to the meadow's 84 that the clock glides from one to the other in a few bars.
import { dulcimer, musicBox, softBass, softPad, strumLute, tinyBell, whistle } from './instruments.ts';
import type { Palette } from './types.ts';

export const town: Palette = {
  id: 'town',
  name: 'Hollowmere',
  feel: 'Warm, busy, a market morning',
  root: 55, // G
  scaleName: 'major pentatonic, with the fourth in the chords',
  scale: [0, 2, 4, 7, 9],
  color: [11],
  tempo: 92,
  grid: 4,
  swing: 0.16,
  // I, vi, IV, V, then I, IV, ii, V: a folk turn that keeps coming home.
  chords: [
    { name: 'G', root: 0, tones: [0, 4, 7, 12] },
    { name: 'Em7', root: 9, tones: [0, 3, 7, 10] },
    { name: 'Cadd9', root: 5, tones: [0, 4, 7, 14] },
    { name: 'D', root: 7, tones: [0, 4, 7, 12] },
    { name: 'G', root: 0, tones: [0, 4, 7, 12] },
    { name: 'Cadd9', root: 5, tones: [0, 4, 7, 14] },
    { name: 'Am7', root: 2, tones: [0, 3, 7, 10] },
    { name: 'Dsus4', root: 7, tones: [0, 5, 7, 12] },
  ],
  gain: 1,
  drone: [
    {
      patch: softPad, octave: 0, bars: 1, follow: true, gain: 0.32,
      notes: [{ beat: 0, semi: 0, beats: 4.2 }, { beat: 0, semi: 7, beats: 4.2, vel: 0.7 }],
    },
  ],
  bass: {
    patch: softBass, octave: -1, gain: 0.9,
    rhythms: ['R.....5.R...5...', 'R.....5.8...5.a.', 'R...R.5...8.5...'],
    fight: 'R.R.R.8.R.R.5.R.',
  },
  harmony: {
    patch: strumLute, octave: 0, style: 'strum', gain: 0.42,
    rhythms: ['X..x..x.X..x.x..', 'X..x..x.X.x..xx.', 'X..x..x.X..x.x..'],
    fight: 'X.xxX.xxX.xxX.xx',
    shapes: [[0, 1, 1, 0, 1, 1, 0, 1], [0, 1, 2, 1, 0, 1, 2, 1], [1, 0, 1, 2, 1, 0, 1, 1]],
  },
  melody: { patch: [whistle, dulcimer], night: musicBox, octave: 2, rest: 0.12, ornament: 'grace', gain: 0.6 },
  perc: [
    { drum: 'hand', gain: 0.5, steps: ['X..o..x.X.o.x...', 'X..o..x.X..ox.o.'] },
    { drum: 'handLow', gain: 0.45, steps: ['......X.......x.', '......X...x...x.'] },
    { drum: 'shaker', gain: 0.3, steps: ['..x...x...x...x.', '..x.x.x...x.x.x.'] },
    { drum: 'click', gain: 0.35, steps: ['....x.......x...'], when: 'town' },
  ],
  sparkle: { patch: tinyBell, octave: 3, chance: 0.06, gain: 0.28 },
  signature: 'none',
  life: { birds: 0.6, crickets: 0.5, frogs: 0.3 },
};
