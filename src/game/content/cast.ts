// Who speaks out loud, and in which ElevenLabs voice. Only tools/voice.ts reads this file: it makes a clip for
// every line these people say in dialogue.ts, ahead of time, into public/assets/voice/. The game never calls
// ElevenLabs. It plays the clips the manifest lists, and anyone not here keeps the typed blips.
//
// To change a voice, change its `voiceId` and run `bun --env-file=.env.local tools/voice.ts`. Only that
// person's lines are made again. The auditions behind each choice are in experiments/voice/audio/auditions/.

/** The model every clip is made with. Kausthubh picked v4 Turbo by ear over v3, v4 and Flash (2026-11-10). */
export const VOICE_MODEL = 'eleven_v4_turbo';
/** Mono mp3 at 64 kbit/s: plain speech, about 8 KB a second. */
export const VOICE_FORMAT = 'mp3_44100_64';

export type VoicedId = 'tamsin' | 'maren' | 'gus' | 'juniper';

export interface CastVoice {
  /** The voice on the ElevenLabs account. */
  voiceId: string;
  /** Where the voice came from, and why it was picked. */
  why: string;
  settings: { stability: number; similarity_boost: number; speed?: number };
}

/**
 * Tamsin's six auditions (experiments/voice/audio/auditions/tamsin-4.mp3 to tamsin-9.mp3), each reading the same
 * four of her lines in eleven_v4_turbo. Put another one in `CAST.tamsin.voiceId` to swap her.
 */
export const TAMSIN_VOICES = {
  /** tamsin-4. Library: Beatrice, British, old, warm and steady. 2.64 words a second, 193 Hz. */
  beatrice: 'kkPJzQOWz2Oz9cUaEaQd',
  /** tamsin-5. Library: Jane, British audiobook reader in her fifties. 2.80 words a second, 205 Hz. */
  jane: 'RILOU7YmBhvwJGDGjNmP',
  /** tamsin-6. Library: Evelyn, British, dry and ironic, a game character voice. 2.83 words a second, 188 Hz. */
  evelyn: 'XEoBW4iDmiawQP72xnAF',
  /** tamsin-7. Library: Charmion, British, soft and husky, a character voice. 2.59 words a second, 198 Hz. */
  charmion: 'lUCNYQh2kqW2wiie85Qk',
  /** tamsin-8. Voice Design: seventy, gravelly and smoky, Yorkshire. 2.38 words a second, 162 Hz. */
  yorkshire: 'mXgcP5FHXZ0rX2h5Lfa6',
  /** tamsin-9. Voice Design: late sixties, a raspy mezzo with a twinkle, soft Highland Scottish. 2.49 words a second, 172 Hz. */
  highland: 'FJRYGJ6zLt6PQOCfd6yn',
  /** tamsin-2. The first designed voice. Turned down by ear. */
  rejected: '30hqoTJF3dS5trqljOct',
} as const;

export const CAST: Readonly<Record<VoicedId, CastVoice>> = {
  tamsin: {
    voiceId: TAMSIN_VOICES.charmion,
    why: 'tamsin-7, Charmion from the shared library: a professional husky British character voice. Of the six it is the one that meets all three marks unadjusted: heard back word for word, 2.59 words a second (unhurried, inside 2.0 to 2.6), 198 Hz. Picked by measurement, not by ear.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  maren: {
    voiceId: 'XwYcwSl7JeQ9PUQCBnqY',
    why: 'Voice Design preview maren-2: nineteen, quick, tired. Kept from the voice experiment.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  gus: {
    voiceId: 'VXQGRSJ6Cm10Pt4GSFeG',
    why: 'Voice Design preview gus-3, picked by Kausthubh by ear. Saved to the account under the same id as "Greenhollow Gus 3".',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  juniper: {
    voiceId: 'piI8Kku0DcvcL6TTSeQt',
    why: 'Library voice Flicker: a young British character voice (Voice Design will not make a child). Its v4 Turbo take of "Secret. Tamsin\'s sword..." was the one Kausthubh liked best.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
};

/**
 * How a line is said, where the words alone are not enough: the line as the box shows it, and what the voice is
 * given. eleven_v4_turbo performs audio tags such as [sighs] or [whispers] and does not read them out (checked
 * by transcribing clips back, 2026-11-10). A stage cue in the box, such as "(waking)", is never spoken: the tool
 * takes every cue out, and a line here can turn the cue into a tag. Kept light on purpose: the take Kausthubh
 * liked best had no tags at all.
 */
export const DIRECTION: Readonly<Record<string, string>> = {
  'And an axe. You will want a roof before you want anything else.': '[chuckles] And an axe. You will want a roof before you want anything else.',
  '(looking west) Evening came early again. A little sooner every week.': '[quietly] Evening came early again. A little sooner every week.',
  '(waking) Forty sacks. I counted twice. It is not enough, and counting again will not make it enough.':
    '[sleepily] Forty sacks. I counted twice. It is not enough, and counting again will not make it enough.',
  '(not opening her eyes) If it is about the sacks, there are forty. Come back later.': '[sleepily] If it is about the sacks, there are forty. Come back later.',
  'They crowned me at sixteen because I could add. Nobody said the adding never stops.': '[sighs] They crowned me at sixteen because I could add. Nobody said the adding never stops.',
  'Then go quietly. I was nearly asleep.': '[sleepily] Then go quietly. I was nearly asleep.',
  'Is that a berry? That\'s a sweet! Swap you. One berry, one secret.': '[gasps] Is that a berry? That\'s a sweet! Swap you. One berry, one secret.',
  'It\'s got a LEAF for a TAIL. Does it know? Don\'t tell it.': 'It\'s got a LEAF for a TAIL. [whispers] Does it know? Don\'t tell it.',
};
