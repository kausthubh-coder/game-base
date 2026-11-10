// Coast, the southeast. Swaying, deep, glassy. Glass bells, a bowed pad, slow swells. Triplets give the 6/8 sway.
import { bowedPad, glassBell, glassLead, subBass } from './instruments.ts';
import type { Palette } from './types.ts';

export const coast: Palette = {
  id: 'coast',
  name: 'Coast',
  feel: 'Swaying, deep, glassy',
  root: 57, // A
  scaleName: 'Dorian, 6/8 sway',
  scale: [0, 2, 3, 5, 7, 9, 10],
  tempo: 72,
  grid: 3,
  swing: 0,
  // The Dorian sway: the minor home chord against the major chord on the fourth.
  chords: [
    { name: 'Am9', root: 0, tones: [0, 3, 7, 14] },
    { name: 'D6', root: 5, tones: [0, 4, 7, 9] },
    { name: 'Am9', root: 0, tones: [0, 3, 7, 14] },
    { name: 'Em7', root: 7, tones: [0, 3, 7, 10] },
    { name: 'Am9', root: 0, tones: [0, 3, 7, 14] },
    { name: 'D6', root: 5, tones: [0, 4, 7, 9] },
    { name: 'G6', root: 10, tones: [0, 4, 7, 9] },
    { name: 'Em7', root: 7, tones: [0, 3, 7, 10] },
  ],
  gain: 1,
  drone: [
    {
      // Each bar's swell overlaps the next, so the pad never stops.
      patch: bowedPad, octave: -1, bars: 1, follow: true, gain: 0.55,
      notes: [{ beat: 0, semi: 0, beats: 4.4 }, { beat: 0, semi: 7, beats: 4.4 }, { beat: 0, semi: 12, beats: 4.4, vel: 0.6 }],
    },
  ],
  bass: {
    patch: subBass, octave: -2, gain: 0.9,
    rhythms: ['R.....5..R..', 'R........5..'],
    fight: 'R.RR.R5.RR.8',
  },
  harmony: {
    patch: glassBell, octave: 0, style: 'arp', gain: 0.42,
    rhythms: ['x.xx.xx.xx.x', 'x.x..xx.x..x'],
    fight: 'X.xX.xX.xX.x',
    shapes: [[0, 2, 3, 4, 3, 2, 5, 4], [1, 3, 4, 5, 4, 3, 2, 3]],
  },
  melody: { patch: glassLead, night: glassBell, octave: 1, rest: 0.3, ornament: 'none', gain: 0.5 },
  perc: [
    { drum: 'shaker', gain: 0.22, steps: ['x..x..x..x..', 'x..x.ox..x..'] },
    { drum: 'handLow', gain: 0.4, steps: ['X.....o.....'] },
  ],
  sparkle: { patch: glassBell, octave: 2, chance: 0.06, gain: 0.26 },
  signature: 'surf',
  life: { birds: 0.7, crickets: 0.6, frogs: 0.5 },
};
