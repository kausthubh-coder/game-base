// Hobb's three takes: which ElevenLabs voice says the film's eleven lines, and how. Only make.ts reads the voice
// ids; the page reads the names. The auditions behind the three are in voice/auditions.json (audition.ts).
import type { ShotId } from '../types.ts';

/** The game's model, Kausthubh's pick by ear (src/game/content/cast.ts). */
export const MODEL = 'eleven_v4_turbo';

export interface Take {
  id: string;
  /** What the page's voice picker shows. */
  name: string;
  voiceId: string;
  /** Why this voice, from its library description and the audition's measures. */
  why: string;
}

/**
 * The first is the one the page starts with, and the one the game's film plays. Millie is Hobb's voice in the game too
 * (src/game/content/cast.ts), so the woman who tells the film is the woman who wakes you. They differ by accent and
 * by grain, so the pick is a real choice.
 */
export const TAKES: readonly Take[] = [
  {
    id: 'b', name: 'Millie: a cook from the north, Geordie', voiceId: 'Nk0iUG137ZABNEQYgAMl',
    why: 'Library voice, middle aged, a soft North-Eastern accent, "natural, warm and characterful". The widest pitch range of the three (13.8 semitones). A woman who runs a kitchen, not a reader.',
  },
  {
    id: 'a', name: 'Beatrice: an old storyteller, English', voiceId: 'kkPJzQOWz2Oz9cUaEaQd',
    why: 'Library voice listed as old, British, "warm, rich tone and a calm, steady pace". The audition was mid-low (190 Hz) and unhurried. The bedtime story read the classic way.',
  },
  {
    id: 'c', name: 'Frances: low and husky, Irish', voiceId: 'mFgXOmlOfXfr6suoQkRH',
    why: 'Library voice, Irish, "soft, warm, calm with husky tones". The lowest and darkest of the eleven auditions (170 Hz), so the oldest sounding.',
  },
];

/** How the legend is told: unhurried, a story told a hundred times. */
const STORY = { stability: 0.5, similarity_boost: 0.8, speed: 0.92 };
/** The last three lines, to the child in the dark room: steadier, slower, closer. */
const CLOSE = { stability: 0.55, similarity_boost: 0.8, speed: 0.88 };

/** The settings for a shot's line. Part 1 is the three close lines. */
export const settingsOf = (part: 0 | 1) => (part === 1 ? CLOSE : STORY);

/**
 * What the voice is given for a line, where the words alone are not enough. v4 Turbo performs a tag such as
 * [softly] and does not read it out; make.ts checks that by transcribing every clip back. Kept light: the take
 * Kausthubh liked best for Tamsin had no tags at all.
 */
export const DIRECTION: Partial<Record<ShotId, string>> = {
  wall: '[softly] That one? Damp got at it, I expect. Bed, Button.',
  doorstep: '[softly] You came to us in the rain, with a key round your neck.',
  morning: '[softly] That was sixteen years ago.',
};
