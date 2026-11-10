// Rain valley, the northwest. Rain, rivers, scholars. Drone strings, a bending plucked string, hand drums with pitch.
// A five-note rain scale over a drone that never moves. Flavor through scale, rhythm and timbre only.
import { bendString, chime, droneString, flute, santoor, softBass } from './instruments.ts';
import type { Palette } from './types.ts';

export const rainvalley: Palette = {
  id: 'rainvalley',
  name: 'Rain valley',
  feel: 'Rain, rivers, scholars',
  root: 57, // A
  scaleName: 'five-note rain scale over a drone',
  scale: [0, 2, 5, 7, 10],
  tempo: 100,
  grid: 4,
  swing: 0,
  // The root never moves. Only the color above it does.
  chords: [
    { name: 'A5', root: 0, tones: [0, 7, 12, 14] },
    { name: 'Asus4', root: 0, tones: [0, 5, 7, 12] },
    { name: 'A7sus', root: 0, tones: [0, 7, 10, 14] },
    { name: 'Asus4', root: 0, tones: [0, 5, 7, 10] },
  ],
  gain: 1,
  drone: [
    {
      // Fifth, octave, octave, low root: each string rings into the next.
      patch: droneString, octave: -1, bars: 2, gain: 1.0,
      notes: [
        { beat: 0, semi: 7, beats: 7 },
        { beat: 2, semi: 12, beats: 7, vel: 0.85 },
        { beat: 4, semi: 12, beats: 7, vel: 0.8 },
        { beat: 6, semi: 0, beats: 7 },
      ],
    },
  ],
  bass: {
    patch: softBass, octave: -1, gain: 0.85,
    rhythms: ['R.........R.....', 'R.......5.......'],
    fight: 'R.R.R.5.R.R.R.8.',
  },
  harmony: {
    patch: santoor, octave: 0, style: 'arp', gain: 0.9,
    rhythms: ['x..x..x..x..x.x.', 'x..x..x.x..x..x.'],
    fight: 'XxxxXxxxXxxxXxxx',
    shapes: [[0, 1, 2, 3, 4, 3, 2, 1], [2, 3, 4, 5, 4, 3, 2, 1]],
  },
  melody: { patch: bendString, night: flute, octave: 1, rest: 0.2, ornament: 'bend', gain: 1.1 },
  perc: [
    { drum: 'tablaLow', gain: 0.55, steps: ['X.....x.X..x....', 'X.....x.X..x..o.'] },
    { drum: 'tablaHigh', gain: 0.4, steps: ['..x.x...o.x.x.xo', '..x.x..xo.x.x.xx'] },
    // When it rains here, more drums join.
    { drum: 'hand', gain: 0.35, steps: ['x.xx.xx.x.xx.xxo'], when: 'rain' },
    { drum: 'handLow', gain: 0.4, steps: ['....X.......X..o'], when: 'rain' },
  ],
  sparkle: { patch: chime, octave: 2, chance: 0.035, gain: 0.22 },
  signature: 'distantThunder',
  life: { birds: 0.8, crickets: 0.9, frogs: 1.4 },
};
