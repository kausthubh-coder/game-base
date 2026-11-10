// Center. A perfect afternoon that never ends. One held chord that never resolves: four notes stacked in
// fifths, with no third to make it major or minor. All six lands' instruments take turns, very soft.
import { bendString, chime, flute, glassBell, glassLead, harp, horn, lute, musicBox, reedFlute, stillPad } from './instruments.ts';
import type { Palette } from './types.ts';

export const center: Palette = {
  id: 'center',
  name: 'Center',
  feel: 'A perfect afternoon that never ends',
  root: 50, // D
  scaleName: 'one held chord of stacked fifths',
  scale: [0, 2, 5, 7, 9],
  tempo: 60,
  grid: 4,
  swing: 0,
  // D, A, E, B: the four notes every land shares.
  chords: [{ name: 'D A E B', root: 0, tones: [0, 7, 14, 21] }],
  gain: 1,
  drone: [
    {
      patch: stillPad, octave: -1, bars: 4, gain: 0.6,
      notes: [
        { beat: 0, semi: 0, beats: 18 },
        { beat: 0, semi: 7, beats: 18 },
        { beat: 4, semi: 14, beats: 15, vel: 0.8 },
        { beat: 8, semi: 21, beats: 12, vel: 0.6 },
      ],
    },
  ],
  harmony: {
    patch: [harp, lute, glassBell, bendString, chime, harp],
    octave: 0, style: 'arp', gain: 0.7,
    rhythms: ['x.....x...x.....', 'x.......x.....x.', '..x.....x...x...'],
    shapes: [[0, 2, 1, 3], [3, 1, 2, 0], [1, 3, 2, 4]],
  },
  melody: { patch: [flute, reedFlute, glassLead, bendString, chime, horn], night: musicBox, octave: 1, rest: 0.45, ornament: 'none', gain: 0.35 },
  perc: [],
  sparkle: { patch: glassBell, octave: 2, chance: 0.03, gain: 0.25 },
  signature: 'stillAir',
  life: { birds: 0.8, crickets: 0.8, frogs: 0.3 },
};
