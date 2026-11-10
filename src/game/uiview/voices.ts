// The speaking voice of each person, by the voice id the talk system puts on a line. The shape is the
// sound engine's `VoiceSpec`: a pitch as a MIDI note, a wave, letters a second and a brightness in Hz.
// The words describe each voice in docs/play/act1.md. Nobody has heard these yet, so tune them by ear.
import type { VoiceSpec } from '../../features/audio/index.ts';

export const VOICES: Readonly<Record<string, VoiceSpec>> = {
  // Low, dry, slow.
  tamsin: { pitch: 48, wave: 'triangle', speed: 26, bright: 1300 },
  // Quick, tired.
  maren: { pitch: 64, wave: 'sine', speed: 40, bright: 2000 },
  // Warm, bouncy.
  odo: { pitch: 52, wave: 'triangle', speed: 32, bright: 1700 },
  // Slow, flat.
  gus: { pitch: 43, wave: 'triangle', speed: 22, bright: 1000 },
  // Bright, fast.
  mira: { pitch: 69, wave: 'triangle', speed: 44, bright: 3400 },
  // Soft.
  wren: { pitch: 62, wave: 'sine', speed: 30, bright: 1600 },
  // High, fast.
  juniper: { pitch: 74, wave: 'sine', speed: 42, bright: 3400 },
  // Gravel.
  brack: { pitch: 40, wave: 'sawtooth', speed: 26, bright: 900 },
  'villager-a': { pitch: 55, wave: 'triangle', speed: 32, bright: 2000 },
  'villager-b': { pitch: 60, wave: 'sine', speed: 32, bright: 2400 },
};

/** Letters a second for a line with no voice of its own: the narrator. */
export const NARRATOR_SPEED = 36;
