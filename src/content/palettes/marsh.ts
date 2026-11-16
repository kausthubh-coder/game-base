// Lantern Marsh, the south-east below the town. Soft, misty: pools, reeds, stilt huts, and at night the
// lanternflies. Glass bells arpeggiate slowly over a pad that drifts in like mist; at night the little bells
// come out three times as often, one for each lanternfly. G major with the major seventh: the same notes as
// Hollowmere above it, so the town's edge is the gentlest border there is.
import { glassBell, glassLead, mistPad, paleBell, softBass, tinyBell } from './instruments.ts';
import type { Palette } from './types.ts';

export const marsh: Palette = {
  id: 'marsh',
  name: 'Lantern Marsh',
  feel: 'Soft, misty; lanternflies at night',
  root: 55, // G
  scaleName: 'major pentatonic, with the major seventh',
  scale: [0, 2, 4, 7, 9],
  color: [11],
  tempo: 68,
  grid: 4,
  swing: 0,
  // Imaj9, vi9, IVmaj7, a V that hangs on its sixth: nothing pulls, everything floats.
  chords: [
    { name: 'Gmaj9', root: 0, tones: [0, 4, 11, 14] },
    { name: 'Gmaj9', root: 0, tones: [0, 4, 11, 14] },
    { name: 'Em9', root: 9, tones: [0, 3, 7, 14] },
    { name: 'Em9', root: 9, tones: [0, 3, 7, 14] },
    { name: 'Cmaj7', root: 5, tones: [0, 4, 7, 11] },
    { name: 'Cmaj7', root: 5, tones: [0, 4, 7, 11] },
    { name: 'D6sus4', root: 7, tones: [0, 5, 7, 9] },
    { name: 'D', root: 7, tones: [0, 4, 7, 12] },
  ],
  // Brought level with the meadow by bun tools/region-music.mjs.
  gain: 1.1,
  drone: [
    {
      patch: mistPad, octave: 0, bars: 2, gain: 0.45,
      notes: [{ beat: 0, semi: 0, beats: 8.6 }, { beat: 0, semi: 7, beats: 8.6, vel: 0.6 }],
    },
  ],
  bass: {
    patch: softBass, octave: -1, gain: 0.6,
    rhythms: ['R.......5.......', 'R...............', 'R.......5.....a.'],
    fight: 'R.R.R.8.R.R.5.R.',
  },
  harmony: {
    patch: glassBell, octave: 0, style: 'arp', gain: 0.32,
    rhythms: ['x..x..x..x..x...', 'x.....x..x......', 'x..x.....x..x...'],
    fight: 'X.xxX.xxX.xxX.xx',
    shapes: [[0, 2, 3, 4, 5, 4, 3, 2], [0, 2, 4, 5, 6, 5, 4, 2], [0, 1, 3, 4, 5, 4, 3, 1]],
  },
  melody: { patch: glassLead, night: paleBell, octave: 2, rest: 0.3, ornament: 'bend', gain: 0.55 },
  perc: [
    { drum: 'shaker', gain: 0.18, steps: ['..x...x...x...x.', '..x.......x.....'] },
    { drum: 'handLow', gain: 0.3, steps: ['X...............', 'X.........x.....'] },
  ],
  sparkle: { patch: tinyBell, octave: 3, chance: 0.05, gain: 0.26, night: 3 },
  signature: 'none',
  life: { birds: 0.5, crickets: 1.2, frogs: 2 },
};
