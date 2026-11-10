// Highlands, the northeast. Airy, quick, school days. Chimes, short plucks, light strings, bells.
import { chime, flute, lightStrings, pizzicato, tinyBell } from './instruments.ts';
import type { Palette } from './types.ts';

export const highlands: Palette = {
  id: 'highlands',
  name: 'Highlands',
  feel: 'Airy, quick, school days',
  root: 55, // G
  scaleName: 'bright five-note major, with ninths',
  scale: [0, 2, 4, 7, 9],
  color: [11],
  tempo: 120,
  grid: 4,
  swing: 0,
  chords: [
    { name: 'Gadd9', root: 0, tones: [0, 4, 7, 14] },
    { name: 'Em7', root: 9, tones: [0, 3, 7, 10] },
    { name: 'Cadd9', root: 5, tones: [0, 4, 7, 14] },
    { name: 'Dsus4', root: 7, tones: [0, 5, 7, 12] },
    { name: 'Gadd9', root: 0, tones: [0, 4, 7, 14] },
    { name: 'Em7', root: 9, tones: [0, 3, 7, 10] },
    { name: 'Cadd9', root: 5, tones: [0, 4, 7, 14] },
    { name: 'D', root: 7, tones: [0, 4, 7, 12] },
  ],
  gain: 1,
  drone: [
    {
      patch: lightStrings, octave: 0, bars: 1, follow: true, gain: 0.55,
      notes: [{ beat: 0, semi: 0, beats: 4.1 }, { beat: 0, semi: 7, beats: 4.1 }],
    },
  ],
  bass: {
    patch: pizzicato, octave: -1, gain: 1.3,
    rhythms: ['R.......R...5...', 'R...8...R...5.a.'],
    fight: 'R.R.R.R.R.R.5.8.',
  },
  harmony: {
    patch: pizzicato, octave: 0, style: 'arp', gain: 0.95,
    rhythms: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.xxx.x.'],
    fight: 'X.xxX.xxX.xxX.xx',
    shapes: [[0, 2, 4, 2, 5, 2, 4, 2], [0, 3, 4, 5, 6, 5, 4, 3], [1, 2, 4, 5, 4, 2, 1, 2]],
  },
  melody: { patch: chime, night: flute, octave: 2, rest: 0.15, ornament: 'grace', gain: 1.0 },
  perc: [
    { drum: 'shaker', gain: 0.45, steps: ['x.x.x.x.x.x.x.x.', 'x...x.x.x...x.xx'] },
    { drum: 'click', gain: 0.9, steps: ['....x.......x...', '....x.......x.o.'] },
    { drum: 'hand', gain: 0.4, steps: ['X.....x...X.....'], when: 'town' },
  ],
  sparkle: { patch: tinyBell, octave: 3, chance: 0.07, gain: 0.26 },
  signature: 'highWindBells',
  life: { birds: 1, crickets: 0.7, frogs: 0.2 },
};
