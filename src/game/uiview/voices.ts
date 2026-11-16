// The speaking voice of each person, by the voice id the talk system puts on a line. The shape is the
// sound engine's `VoiceSpec`: a pitch as a MIDI note, a wave, letters a second and a brightness in Hz.
// The words are each person's voice in handbook chapter 22, "How each person talks". Tune them by ear.
import type { VoiceSpec } from '../../features/audio/index.ts';

export const VOICES: Readonly<Record<string, VoiceSpec>> = {
  // Low, dry, slow.
  tamsin: { pitch: 48, wave: 'triangle', speed: 26, bright: 1300 },
  // Quick, tired.
  maren: { pitch: 64, wave: 'sine', speed: 40, bright: 2000 },
  // Slow, flat.
  gus: { pitch: 43, wave: 'triangle', speed: 22, bright: 1000 },
  // Soft.
  wren: { pitch: 62, wave: 'sine', speed: 30, bright: 1600 },
  // Act 1's people. Warm, loud, bossy.
  hobb: { pitch: 53, wave: 'triangle', speed: 34, bright: 1800 },
  // Few words, low.
  dax: { pitch: 45, wave: 'triangle', speed: 24, bright: 1100 },
  // Fast, exact, out of breath.
  mina: { pitch: 70, wave: 'triangle', speed: 46, bright: 3000 },
  // Clipped, grumpy, old: a little brass in it.
  custodian: { pitch: 50, wave: 'square', speed: 28, bright: 1400 },
  // Gentle, unhurried.
  elowen: { pitch: 60, wave: 'sine', speed: 27, bright: 1500 },
  // Exact, polite.
  calla: { pitch: 66, wave: 'sine', speed: 36, bright: 2600 },
  // Flustered.
  aldric: { pitch: 57, wave: 'triangle', speed: 42, bright: 2100 },
  // Two or three words at a time, from far down.
  stag: { pitch: 33, wave: 'sine', speed: 14, bright: 700 },
  // Quick and warm.
  tansy: { pitch: 65, wave: 'triangle', speed: 40, bright: 2400 },
  // Few words, soft.
  holt: { pitch: 47, wave: 'sine', speed: 25, bright: 1200 },
  // Earnest.
  ren: { pitch: 63, wave: 'triangle', speed: 36, bright: 2200 },
  guildmaster: { pitch: 49, wave: 'triangle', speed: 30, bright: 1300 },
  // The memories: soft, as if from far off.
  ilara: { pitch: 67, wave: 'sine', speed: 34, bright: 1900 },
  auren: { pitch: 58, wave: 'sine', speed: 32, bright: 1700 },
  'voice.girl': { pitch: 71, wave: 'sine', speed: 36, bright: 2000 },
  'voice.boy': { pitch: 64, wave: 'sine', speed: 36, bright: 1900 },
  'voice.old-woman': { pitch: 59, wave: 'sine', speed: 26, bright: 1300 },
  // Close and warm.
  'voice.a-voice': { pitch: 52, wave: 'sine', speed: 24, bright: 1100 },
  'villager-a': { pitch: 55, wave: 'triangle', speed: 32, bright: 2000 },
  'villager-b': { pitch: 60, wave: 'sine', speed: 32, bright: 2400 },
};

/** Letters a second for a line with no voice of its own: the narrator. */
export const NARRATOR_SPEED = 36;
