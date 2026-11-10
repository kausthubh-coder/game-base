// The shape of a music palette. A palette is data: adding a land means adding one file beside this one
// and listing it in index.ts. The sound engine in src/features/audio reads these and nothing else.
//
// Pitch: `root` is a MIDI note (60 is middle C). Everything else is semitones above it, or scale degrees.
// Time: a bar is always four beats. `grid` is how many steps a beat has: 4 is sixteenths, 3 is triplets
// (the 6/8 sway). Rhythm strings have `grid * 4` characters, one per step.

/** Oscillator shapes. The first four are built in. The rest are harmonic recipes in the engine. */
export type WaveName = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'soft' | 'harp' | 'lute' | 'reed' | 'string' | 'glass' | 'choir';

/** How an instrument is made. Four recipes cover every instrument in the game. */
export type Patch =
  /** A plucked or struck string: a bright start that darkens as it rings. `decay` is seconds to silence. */
  | { kind: 'pluck'; wave: WaveName; decay: number; bright: number; attack?: number; detune?: number; damp?: boolean; bendTime?: number; gain?: number }
  /** A bell: two sine waves, one bending the other. `ratio` sets how metallic, `index` how bright. */
  | { kind: 'bell'; ratio: number; index: number; decay: number; attack?: number; gain?: number }
  /** A blown pipe: a tone, breath noise and a slow vibrato (in cents). */
  | { kind: 'wind'; wave: WaveName; breath: number; vibrato: number; attack: number; release: number; cutoff?: number; gain?: number }
  /** A held pad: detuned oscillators through a filter. `formants` makes it sing a vowel. */
  | { kind: 'pad'; wave: WaveName; voices: 1 | 2 | 3; detune: number; cutoff: number; attack: number; release: number; formants?: [number, number]; gain?: number };

export type DrumId =
  | 'hand' | 'handLow' | 'frameDum' | 'frameTek' | 'tablaLow' | 'tablaHigh' | 'deep' | 'anvil'
  | 'shaker' | 'click' | 'kick' | 'snare' | 'hat' | 'tom' | 'swell' | 'pulse';

/** A chord. `root` is semitones above the palette root, `tones` are semitones above the chord root. */
export interface Chord {
  name: string;
  root: number;
  tones: number[];
}

/** One held or plucked note of the drone. `beat` counts from the start of the drone's cycle. */
export interface DroneNote {
  beat: number;
  semi: number;
  beats: number;
  vel?: number;
}

export interface DroneLayer {
  patch: Patch;
  octave: number;
  /** The cycle length in bars. */
  bars: number;
  notes: DroneNote[];
  /** True moves the notes with the chord. False holds them under every chord. */
  follow?: boolean;
  gain: number;
}

/** Bass rhythm characters: R root, 5 fifth, 8 octave, a approach note into the next chord, . nothing. */
export interface BassLayer {
  patch: Patch;
  octave: number;
  rhythms: string[];
  fight: string;
  gain: number;
}

/** Harmony rhythm characters: X accent, x hit, . nothing. A shape lists steps up the chord's ladder of tones. */
export interface HarmonyLayer {
  /** A list rotates every two bars. */
  patch: Patch | Patch[];
  octave: number;
  style: 'arp' | 'strum';
  rhythms: string[];
  fight?: string;
  shapes: number[][];
  gain: number;
}

export interface MelodyLayer {
  /** A list rotates every two bars. */
  patch: Patch | Patch[];
  /** The lead at night. */
  night: Patch;
  octave: number;
  /** 0 to 1: how often a two-bar cell stays silent. */
  rest: number;
  /** grace: a quick note from above. trill: a turn through the upper neighbor. bend: slides in from the note below. */
  ornament: 'none' | 'grace' | 'trill' | 'bend';
  gain: number;
}

/** Percussion step characters: X accent, x hit, o a ghost note that plays half the time, . nothing. */
export interface PercLine {
  drum: DrumId;
  /** One string per bar. The list cycles. */
  steps: string[];
  gain: number;
  /** rain: only while it rains. town: only in the fuller town arrangement. */
  when?: 'rain' | 'town';
}

export interface SparkleLayer {
  patch: Patch;
  octave: number;
  /** The chance of a note on each step, 0 to 1. */
  chance: number;
  gain: number;
}

/** The background bed only this land has. The engine has one recipe per name. */
export type SignatureBed = 'meadowBreeze' | 'desertWind' | 'surf' | 'distantThunder' | 'highWindBells' | 'forgeHammers' | 'stillAir' | 'none';

export interface Palette {
  id: string;
  name: string;
  feel: string;
  /** MIDI note of the home note, between 45 and 57. */
  root: number;
  scaleName: string;
  /** The melody's notes, in semitones above the root. The world motif indexes this list. */
  scale: number[];
  /** Extra notes the sparkle may touch. */
  color?: number[];
  tempo: number;
  grid: 3 | 4;
  /** 0 to 0.3: how late the off sixteenths fall. */
  swing: number;
  /** One chord per bar. The list cycles. */
  chords: Chord[];
  /** The loudness of the whole palette, set by the checks so every land sits at the same level. */
  gain: number;
  drone: DroneLayer[];
  bass?: BassLayer;
  harmony: HarmonyLayer;
  melody: MelodyLayer;
  perc: PercLine[];
  sparkle: SparkleLayer;
  signature: SignatureBed;
  /** How much wildlife there is here: 0 none, 1 normal. */
  life: { birds: number; crickets: number; frogs: number };
}
