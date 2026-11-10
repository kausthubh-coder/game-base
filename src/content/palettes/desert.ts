// Desert, the southwest. Bright, caravans. Plucked lute, breathy reed flute, frame drum, drone.
// The flavor comes from the scale and the rhythm. Nothing sacred is quoted.
import { deepBass, fingerCymbal, lowReed, lute, reedFlute } from './instruments.ts';
import type { Palette } from './types.ts';

export const desert: Palette = {
  id: 'desert',
  name: 'Desert',
  feel: 'Bright desert, caravans',
  root: 52, // E
  scaleName: 'Phrygian dominant',
  scale: [0, 1, 4, 5, 7, 8, 10],
  tempo: 96,
  grid: 4,
  swing: 0,
  // Home, the flat second, home, the minor chord below.
  chords: [
    { name: 'E', root: 0, tones: [0, 4, 7, 12] },
    { name: 'E', root: 0, tones: [0, 4, 7, 12] },
    { name: 'F', root: 1, tones: [0, 4, 7, 12] },
    { name: 'E', root: 0, tones: [0, 4, 7, 12] },
    { name: 'E', root: 0, tones: [0, 4, 7, 12] },
    { name: 'Dm', root: 10, tones: [0, 3, 7, 12] },
    { name: 'F', root: 1, tones: [0, 4, 7, 12] },
    { name: 'E', root: 0, tones: [0, 4, 7, 12] },
  ],
  gain: 1,
  drone: [
    {
      patch: lowReed, octave: -1, bars: 2, gain: 0.5,
      notes: [{ beat: 0, semi: 0, beats: 8.5 }, { beat: 0, semi: 7, beats: 8.5, vel: 0.7 }],
    },
  ],
  bass: {
    patch: deepBass, octave: -1, gain: 1.0,
    rhythms: ['R.....R.5.......', 'R.....R.5.....a.'],
    fight: 'R.R.5.R.R.R.5.8.',
  },
  harmony: {
    // Three, three, two: the caravan sway.
    patch: lute, octave: 0, style: 'arp', gain: 0.75,
    rhythms: ['X..x..x.X..x..x.', 'X..x..x.X..x.xx.'],
    fight: 'X.xxx.xxX.xxx.xx',
    shapes: [[0, 2, 3, 2, 1, 2, 3, 2], [0, 1, 2, 3, 4, 3, 2, 1], [3, 2, 1, 2, 0, 2, 1, 2]],
  },
  melody: { patch: reedFlute, night: lute, octave: 1, rest: 0.2, ornament: 'trill', gain: 0.7 },
  perc: [
    { drum: 'frameDum', gain: 0.6, steps: ['X.......X.......', 'X.......X.....o.'] },
    { drum: 'frameTek', gain: 0.4, steps: ['..x...x.....x...', '..x...x.....x.o.'] },
    { drum: 'shaker', gain: 0.22, steps: ['x.x.x.x.x.x.x.x.'], when: 'town' },
  ],
  sparkle: { patch: fingerCymbal, octave: 3, chance: 0.035, gain: 0.25 },
  signature: 'desertWind',
  life: { birds: 0.3, crickets: 1.2, frogs: 0 },
};
