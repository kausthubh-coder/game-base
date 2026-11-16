// The Mere and Saltgate: the river from the north hills to the sea, the landing, and the south toward the
// port where the hero grew up. Sea air, journeys. A wooden flute and a dulcimer trade the tune over a lute in a
// rocking dotted rhythm, a frame drum and a shaker. D major: it shares six notes with the meadow, with
// Hollowmere and with the marsh, the three lands the river runs past.
import { bowedPad, dulcimer, glassBell, lute, softBass, tinyBell, woodFlute } from './instruments.ts';
import type { Palette } from './types.ts';

export const mere: Palette = {
  id: 'mere',
  name: 'The Mere and Saltgate',
  feel: 'Sea air, journeys',
  root: 50, // D
  scaleName: 'major pentatonic, with the fourth in the chords',
  scale: [0, 2, 4, 7, 9],
  color: [5],
  tempo: 80,
  grid: 4,
  swing: 0.08,
  chords: [
    { name: 'D', root: 0, tones: [0, 4, 7, 12] },
    { name: 'G', root: 5, tones: [0, 4, 7, 12] },
    { name: 'Bm', root: 9, tones: [0, 3, 7, 12] },
    { name: 'A', root: 7, tones: [0, 4, 7, 12] },
    { name: 'D', root: 0, tones: [0, 4, 7, 12] },
    { name: 'Em7', root: 2, tones: [0, 3, 7, 10] },
    { name: 'Gadd9', root: 5, tones: [0, 4, 7, 14] },
    { name: 'Asus4', root: 7, tones: [0, 5, 7, 12] },
  ],
  // Brought level with the meadow by bun tools/region-music.mjs.
  gain: 1.1,
  drone: [
    {
      patch: bowedPad, octave: 0, bars: 1, follow: true, gain: 0.35,
      notes: [{ beat: 0, semi: 0, beats: 4.3 }, { beat: 0, semi: 7, beats: 4.3, vel: 0.7 }],
    },
  ],
  bass: {
    patch: softBass, octave: -1, gain: 0.8,
    rhythms: ['R.....5.R.......', 'R.....5...8.....', 'R.....5.R...a...'],
    fight: 'R.R.R.8.R.R.5.R.',
  },
  harmony: {
    patch: lute, octave: 0, style: 'arp', gain: 0.42,
    // Dotted: three, three, two. The boat's rock.
    rhythms: ['x..x..x.x..x..x.', 'x..x..x.x.x.x...', 'x..x..x.x..x..x.'],
    fight: 'X.xxX.xxX.xxX.xx',
    shapes: [[0, 2, 3, 4, 5, 4, 3, 2], [0, 2, 4, 5, 6, 5, 4, 2], [0, 1, 3, 4, 5, 4, 3, 1]],
  },
  melody: { patch: [woodFlute, dulcimer], night: glassBell, octave: 2, rest: 0.15, ornament: 'grace', gain: 0.6 },
  perc: [
    { drum: 'frameDum', gain: 0.35, steps: ['X.....x.X.......', 'X.....x.X...x...'] },
    { drum: 'shaker', gain: 0.22, steps: ['..x..x....x..x..', '..x..x....x..x..'] },
  ],
  sparkle: { patch: tinyBell, octave: 3, chance: 0.04, gain: 0.25 },
  signature: 'none',
  life: { birds: 1, crickets: 0.6, frogs: 0.8 },
};
