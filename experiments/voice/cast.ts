// The four voiced people of act 1, and the ElevenLabs voice each one speaks with.
// Tamsin, Maren and Gus were made with Voice Design (tools/design-voices.ts) from the descriptions
// below: the account's stock voices are narrators and presenters, and none is an old woman, a tired
// nineteen-year-old queen or a slow farmer. Voice Design will not make a child's voice, so Juniper
// is a shared-library character voice. Every preview is kept in audio/auditions/ so another can be
// swapped in: save it with `design-voices.ts save <id> <n>` and set `voiceId`.

export type CastId = 'tamsin' | 'maren' | 'gus' | 'juniper';

export interface CastMember {
  id: CastId;
  name: string;
  /** Column and row on public/assets/portraits/portraits.png (128 px tiles). */
  portrait: [number, number];
  /** What Voice Design was asked for. */
  description: string;
  /** What the previews say: the person's own lines, at least 100 letters. */
  sample: string;
  /** The saved voice on the account. Empty until tools/design-voices.ts saves one. */
  voiceId: string;
  /** Which preview was kept, and why. */
  chosen: string;
  /** Voice settings for the made-ahead lines. Stability is low for v3, so the tags act. */
  settings: { stability: number; similarity_boost: number; style?: number; speed?: number };
}

export const CAST: Record<CastId, CastMember> = {
  tamsin: {
    id: 'tamsin',
    name: 'Tamsin',
    portrait: [0, 0],
    description:
      'A woman in her mid sixties, a retired adventurer who now keeps a lodge in a farming village. Low, slightly husky alto, warm but dry, ' +
      'unhurried, plain spoken, with quiet wry humour. Soft rural English accent. Close and intimate, like she is standing next to you, not a narrator.',
    sample:
      'Twelve people have asked me for this plot. You are the first who looked at the ground before the view. Take the book. It has been blank for forty years. I only ever looked at things to price them.',
    voiceId: '30hqoTJF3dS5trqljOct',
    chosen: "Preview 2 of 3: the lowest (median 143 Hz against 155 and 168) at an unhurried 2.35 words a second. Preview 3 was slower still (1.78) with long gaps.",
    settings: { stability: 0.5, similarity_boost: 0.8, speed: 0.95 },
  },
  maren: {
    id: 'maren',
    name: 'Maren',
    portrait: [1, 0],
    description:
      'A nineteen year old young woman, a queen who has not slept in days. Quick, clipped and precise, tired and a little hoarse, with a dry sense of humour ' +
      'and sudden warmth. Light, clear English accent. Natural and close, like a young heroine in an animated fantasy film.',
    sample:
      'Forty sacks. I counted twice. It is not enough, and counting again will not make it enough. Twenty sheaves by the festival. I can pay you in thanks and one good meal.',
    voiceId: 'XwYcwSl7JeQ9PUQCBnqY',
    chosen: "Preview 2 of 3: the quickest (2.61 words a second against 2.18 and 2.37), at 208 Hz, a young woman's range.",
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  gus: {
    id: 'gus',
    name: 'Gus',
    portrait: [0, 1],
    description:
      'A farmer in his fifties. Slow, flat and low, a man of few words, earthy and steady, gruff on top and kind underneath. ' +
      'West Country English accent. Close and natural, like he is talking over a fence.',
    sample:
      "Soil's tired. Not lazy. Tired. You'd be too. Wet soil grows. Dry soil waits. That's all I know. It's enough. Rain'd do it better. Rain always does it better.",
    voiceId: 'VAmop9jKbd3fw7i7BY4S',
    chosen: "Preview 2 of 3: the lowest (median 87 Hz against 96 and 100), and slow, 1.34 words a second.",
    settings: { stability: 0.5, similarity_boost: 0.8, speed: 0.95 },
  },
  juniper: {
    id: 'juniper',
    name: 'Juniper',
    portrait: [0, 2],
    description:
      'Shared library voice "Flicker - Cheerful Fairy & Sparkly Sweet": a young British character voice, cheerful, quick and chatty. ' +
      'Juniper is a child who trades secrets for sweets: high and fast.',
    sample:
      "You're the new one! From the stone! Have you got any sweets? A berry's a sweet. A berry counts. I've got secrets. Good ones.",
    voiceId: 'piI8Kku0DcvcL6TTSeQt',
    chosen: "Voice Design refuses any child voice (403, safety guidelines), twice. So a shared-library voice made for animated characters: Flicker (British, 410 Hz) over Lulu Lolipop (American, 400 Hz), to keep the cast English. Lulu's audition is audio/auditions/juniper-lulu.mp3.",
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
};

/** The models compared on one line each. */
export const MODELS = {
  /** Most expressive. Reads audio tags such as [warmly] or [sighs]. */
  v3: 'eleven_v3',
  /** The newest: "fastest and most emotive". */
  v4: 'eleven_v4',
  /** Built for low latency, at half the credits. */
  flash: 'eleven_flash_v2_5',
  /** v4 for low latency, at half the credits. */
  v4turbo: 'eleven_v4_turbo',
} as const;
