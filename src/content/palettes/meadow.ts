// Meadow, the south. Cozy, green, morning. Small harp, wooden flute, soft pad, hand drum.
import { flute, harp, musicBox, softBass, softPad, tinyBell } from './instruments.ts';
import type { Palette } from './types.ts';

export const meadow: Palette = {
  id: 'meadow',
  name: 'Meadow',
  feel: 'Cozy, green, morning',
  root: 50, // D
  scaleName: 'major pentatonic, Lydian color',
  scale: [0, 2, 4, 7, 9],
  color: [6],
  tempo: 84,
  grid: 4,
  swing: 0.1,
  // I, vi, II, V. The II chord carries the raised fourth, which is the Lydian color.
  chords: [
    { name: 'Dadd9', root: 0, tones: [0, 4, 7, 14] },
    { name: 'Dadd9', root: 0, tones: [0, 4, 7, 14] },
    { name: 'Bm7', root: 9, tones: [0, 3, 7, 10] },
    { name: 'Bm7', root: 9, tones: [0, 3, 7, 10] },
    { name: 'E', root: 2, tones: [0, 4, 7, 12] },
    { name: 'E', root: 2, tones: [0, 4, 7, 12] },
    { name: 'A', root: 7, tones: [0, 4, 7, 12] },
    { name: 'Asus4', root: 7, tones: [0, 5, 7, 12] },
  ],
  gain: 1,
  drone: [
    {
      patch: softPad, octave: 0, bars: 2, gain: 0.5,
      notes: [{ beat: 0, semi: 0, beats: 8.6 }, { beat: 0, semi: 7, beats: 8.6 }, { beat: 4, semi: 12, beats: 4.4, vel: 0.6 }],
    },
  ],
  bass: {
    patch: softBass, octave: -1, gain: 0.8,
    rhythms: ['R.......5...R...', 'R.....R...5.....', 'R.......5.....a.'],
    fight: 'R.R.R.8.R.R.5.R.',
  },
  harmony: {
    patch: harp, octave: 0, style: 'arp', gain: 0.55,
    rhythms: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.x.'],
    fight: 'X.xxX.xxX.xxX.xx',
    shapes: [[0, 2, 3, 4, 5, 4, 3, 2], [0, 2, 4, 5, 6, 5, 4, 2], [0, 1, 3, 4, 5, 4, 3, 1]],
  },
  melody: { patch: flute, night: musicBox, octave: 2, rest: 0.2, ornament: 'grace', gain: 0.62 },
  perc: [
    { drum: 'hand', gain: 0.5, steps: ['X..o..x.X..ox...', 'X..o..x.X.x.x.o.'] },
    { drum: 'handLow', gain: 0.45, steps: ['......X.......x.'] },
    { drum: 'shaker', gain: 0.25, steps: ['..x...x...x...x.'], when: 'town' },
  ],
  sparkle: { patch: tinyBell, octave: 3, chance: 0.05, gain: 0.3 },
  signature: 'meadowBreeze',
  life: { birds: 1.4, crickets: 1, frogs: 0.6 },
};
