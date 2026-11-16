// The cave hills and the root caves, the north-east beyond the river. Cool, echoing: rock shelves, pale
// crystals, the way down to the Lamp Gallery. Glass bells for the crystals, a choir that hangs in the air,
// drips on a wood click, and the game rings it in its stone space. B minor (Dorian colour in the E chord); it
// shares six notes with the meadow and with Hollowmere, five with the grey forest.
import { choirPad, dripBell, glassBell, glassLead, subBass } from './instruments.ts';
import type { Palette } from './types.ts';

export const caves: Palette = {
  id: 'caves',
  name: 'The caves',
  feel: 'Cool, echoing',
  root: 47, // B
  scaleName: 'minor pentatonic, with the fourth in the chords',
  scale: [0, 2, 3, 7, 10],
  color: [5],
  tempo: 62,
  grid: 4,
  swing: 0,
  chords: [
    { name: 'Bm(add9)', root: 0, tones: [0, 3, 7, 14] },
    { name: 'Bm(add9)', root: 0, tones: [0, 3, 7, 14] },
    { name: 'Gmaj7', root: 8, tones: [0, 4, 7, 11] },
    { name: 'Gmaj7', root: 8, tones: [0, 4, 7, 11] },
    { name: 'Em9', root: 5, tones: [0, 3, 7, 14] },
    { name: 'Em9', root: 5, tones: [0, 3, 7, 14] },
    { name: 'Asus2', root: 10, tones: [0, 2, 7, 12] },
    { name: 'A', root: 10, tones: [0, 4, 7, 12] },
  ],
  // Brought level with the meadow by bun tools/region-music.mjs.
  gain: 1.1,
  drone: [
    {
      patch: choirPad, octave: 0, bars: 2, gain: 0.4,
      notes: [{ beat: 0, semi: 0, beats: 8.6 }, { beat: 0, semi: 7, beats: 8.6, vel: 0.6 }],
    },
  ],
  bass: {
    patch: subBass, octave: -1, gain: 0.55,
    rhythms: ['R...............', 'R.......R.......'],
    fight: 'R.R.R.8.R.R.5.R.',
  },
  harmony: {
    patch: glassBell, octave: 0, style: 'arp', gain: 0.3,
    rhythms: ['x...x...x...x...', 'x.....x...x.....', 'x...x.....x.....'],
    fight: 'X.xxX.xxX.xxX.xx',
    shapes: [[0, 2, 3, 4, 5, 4, 3, 2], [0, 2, 4, 5, 6, 5, 4, 2], [0, 1, 3, 4, 5, 4, 3, 1]],
  },
  melody: { patch: glassLead, night: dripBell, octave: 2, rest: 0.35, ornament: 'none', gain: 0.5 },
  perc: [
    // Drips: a dry click here and there, never on the same steps two bars running.
    { drum: 'click', gain: 0.2, steps: ['x.......o.....x.', '....x.......o...'] },
    { drum: 'deep', gain: 0.25, steps: ['X...............', '................'] },
  ],
  sparkle: { patch: dripBell, octave: 3, chance: 0.06, gain: 0.25 },
  signature: 'none',
  life: { birds: 0.1, crickets: 0.3, frogs: 0 },
};
