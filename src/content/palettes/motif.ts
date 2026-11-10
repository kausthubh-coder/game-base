// The one tune the whole world shares. Every land plays it in its own scale and instrument, which is
// what lets two lands blend. Degrees index a palette's `scale`: 0 is the home note, and a degree past
// the end of the scale carries on into the next octave.

export interface Motif {
  degrees: number[];
  /** The beat each note starts on. The tune fills two bars. */
  beats: number[];
  /** How long each note is held, in beats. */
  lengths: number[];
}

/** Up through the scale in two leaps, then home by step. */
export const worldMotif: Motif = {
  degrees: [0, 2, 4, 3, 2, 1, 0],
  beats: [0, 1, 2, 3.5, 4, 5, 6],
  lengths: [1, 1, 1.5, 0.5, 1, 1, 2],
};

/** The boss's own tune, laid over whatever the land is playing. Semitones above the land's root. */
export const bossMotif: { semis: number[]; beats: number[]; lengths: number[] } = {
  semis: [0, 0, 7, 5, 0, 1, 0],
  beats: [0, 1.5, 2, 3, 4, 6, 6.5],
  lengths: [1.5, 0.5, 1, 1, 2, 0.5, 1.5],
};
