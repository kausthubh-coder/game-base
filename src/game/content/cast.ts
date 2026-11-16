// Who speaks out loud, and in which ElevenLabs voice. Only tools/voice.ts reads this file: it makes a clip for
// every line these people say in dialogue.ts, ahead of time, into public/assets/voice/. The game never calls
// ElevenLabs. It plays the clips the manifest lists, and anyone not here keeps the typed blips.
//
// To change a voice, change its `voiceId` and run `bun --env-file=.env.local tools/voice.ts`. Only that
// person's lines are made again. The auditions behind Tamsin are in experiments/voice/audio/auditions/, and the
// auditions behind everyone cast on 2026-11-12 in assets-src/voice/auditions/ (tools/voice/audition.ts).

/** The model every clip is made with. Kausthubh picked v4 Turbo by ear over v3, v4 and Flash (2026-11-10). */
export const VOICE_MODEL = 'eleven_v4_turbo';
/** Mono mp3 at 64 kbit/s: plain speech, about 8 KB a second. */
export const VOICE_FORMAT = 'mp3_44100_64';

/** Everyone who speaks out loud in act 1. Only the player and the narrator have no voice. */
export type VoicedId =
  | 'tamsin' | 'maren' | 'gus' | 'hobb' | 'custodian' | 'dax' | 'mina' | 'wren' | 'elowen' | 'calla' | 'aldric' | 'stag'
  | 'tansy' | 'holt' | 'ren' | 'guildmaster' | 'ilara' | 'auren' | 'voice.girl' | 'voice.boy' | 'voice.old-woman' | 'voice.a-voice';

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
  // From here down, cast on 2026-11-12 from three library voices each, every one saying two of the person's own lines
  // (tools/voice/audition.ts; the takes and their measures are in assets-src/voice/auditions/). Nobody listened:
  // each pick is by fit to chapter 28 of the handbook and by measures, keeping the cast apart by pitch, accent and
  // age. Every take was heard back word for word. A take far quieter than the rest of the cast (below -30 dBFS)
  // was ruled out, since the game plays every clip at one level. To swap a voice, put another candidate's id here
  // with the same settings: its two takes are copied and only the person's other lines are bought.
  hobb: {
    voiceId: 'Nk0iUG137ZABNEQYgAMl',
    why: 'Millie, library: middle aged, a soft Geordie. Of the three takes of the opening film (lab/opening), the only one with the northern port accent she was written with, and the widest pitch range (13.8 semitones) for a loud, bossy cook. Beatrice reads like a bedtime narrator, and Frances is low and husky like Tamsin. The film plays her take too, so the voice of the legend is the voice that wakes you. 198 Hz.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  custodian: {
    voiceId: 'htZQqY7WtacRNV7s62Iy',
    why: 'Daniel, "The Gruff Old British Wizard", library: old, gruff, dry wit. The dry one of the three, at an even level (-23 dBFS) and a clipped 3.2 words a second. Gerald was as good a fit but 7 dB louder than the cast; Grimblewood the gnome was too quiet (-32 dBFS) and rushed. 139 Hz, old Southern English, unlike every other man here.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  dax: {
    voiceId: 'kmSVBPu7loj4ayNinwWM',
    why: 'Archie, library: a young British man, warm and deep. The lowest (99 Hz) and slowest (2.3 words a second) of the three: few words, low and plain, never hurried. Johnny was higher and quicker; Cillian\'s Irish was a semitone from Gus.',
    settings: { stability: 0.5, similarity_boost: 0.8, speed: 0.95 },
  },
  mina: {
    voiceId: 'nDJIICjR9zfJExIFeSCN',
    why: 'Emmaline, "young British girl", library: bright, exact diction, "precocious". The youngest sounding and highest of the three (236 Hz) at 4.1 words a second, fast and exact. Lucy and Charlotte sounded older.',
    settings: { stability: 0.5, similarity_boost: 0.8, speed: 1.08 },
  },
  wren: {
    voiceId: 'sgk995upfe3tYLvoGcBN',
    why: 'Labhaoise, library: a young Irish woman, warm and grounded with a level lilt. The lowest woman in the cast (184 Hz), quiet and level. Emily (-40 dBFS) and Alba (-36 dBFS) whispered under the rest of the cast.',
    settings: { stability: 0.5, similarity_boost: 0.8, speed: 0.95 },
  },
  elowen: {
    voiceId: 'kkPJzQOWz2Oz9cUaEaQd',
    why: 'Beatrice, library: the only one listed old, British, warm and gentle with a calm pace. 236 Hz, three semitones above Tamsin\'s husky voice and much softer. Frances and Colleen are Irish like Wren.',
    settings: { stability: 0.5, similarity_boost: 0.8, speed: 0.95 },
  },
  calla: {
    voiceId: 'tfvhQIydLdGEZP6h00c5',
    why: 'Jade, library: a young British woman, polished, a precise and crisp accent. The slowest and most even of the three (3.3 words a second): whole sentences, nothing felt. Clearly apart from Mina, who runs at 4.1.',
    settings: { stability: 0.6, similarity_boost: 0.8 },
  },
  aldric: {
    voiceId: '1SgtCdnh90xU4Bpehczp',
    why: 'Soifur, library: British, nerdy and anxious. Its first take ran "Is it true no do not show me" with no breath between: flustered. 180 Hz, the highest man in the cast, so apart from the Custodian and the guildmaster. Tarquin and Luke were posh and steady, and a semitone from the Custodian.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  stag: {
    voiceId: 'bFrjFL4nlpeYNwNRhXxq',
    why: 'Mossbeard, "The God of the Wild", library: "an ancient creature, creaking subharmonics, bark-textured bass. Glacial. Immense. Tender." The deepest voice in the game (95 Hz) and the slowest (1.7 words a second). Gravel and Eldrin were near 160 Hz, and Eldrin\'s second take was heard as nonsense.',
    settings: { stability: 0.6, similarity_boost: 0.8, speed: 0.8 },
  },
  tansy: {
    voiceId: 'h8eW5xfRUGVJrZhAFxqK',
    why: 'Isla, library: Scottish, youthful, relaxed and warm. The quickest of the three (4.5 words a second): quick and warm, then blunt. The only Scot in the cast. Michelle is Northern Irish like Wren; Hannah\'s Welsh was slower and softer.',
    settings: { stability: 0.5, similarity_boost: 0.8, speed: 1.05 },
  },
  holt: {
    voiceId: 'yvKg3CwzCYDTwyHnWQLg',
    why: 'Steve, library: an old Northern English man from Lancashire, calm. 130 Hz, at an even level. Alder (-36 to -39 dBFS) and Beezle (-28 to -32) were too quiet beside the cast.',
    settings: { stability: 0.5, similarity_boost: 0.8, speed: 0.92 },
  },
  ren: {
    voiceId: 'Os2frcqCuUz8b9F93RuI',
    why: 'Mahmoud, library: a young Arab man, warm and natural. A light accent from far off, for a novice from the desert, and earnest at 4 words a second. Adam was too quiet (-36 dBFS). The handbook never says whether Ren is a boy or a girl; this voice makes Ren sound like a boy, after the name Auren. Sara (jAAHNNqlbAX9iWjJPEtE) has takes ready if not.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  guildmaster: {
    voiceId: 'VC6vCXhVaI8BZefRtXZV',
    why: 'Grant Gravitas, library: "could have read the news on the BBC in 1965", unhurried, with authority. The slowest reading of the grant (3.3 words a second), a ceremony said a hundred times, and at 119 Hz well under the Custodian. Nathaniel was a semitone from the Custodian; Damiaan was quiet.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  ilara: {
    voiceId: 'rCmVtv8cYU60uhlsOo1M',
    why: 'Ana, library: a young British woman, emotional, warm and expressive. The highest voice in the cast (279 Hz), so the girl in the memories is never mistaken for anyone alive. Zoey sat a semitone from Calla; Niamh was quiet (-33 dBFS).',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  auren: {
    voiceId: 'hmMWXCj9K7N5mCPcRkfC',
    why: 'Rory, library: a young Dublin man, natural, warm and lively, easy to like. The only Irish man in the cast, at 146 Hz. Sam\'s Welsh sat between Holt and the guildmaster; Asher was British like most of the men.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  // The three in the first memory are Ilara, Auren and a woman of their village. The children have the grown voices,
  // so the player can hear who they become.
  'voice.girl': {
    voiceId: 'rCmVtv8cYU60uhlsOo1M',
    why: 'Ilara as a girl: Ana, Ilara\'s voice.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  'voice.boy': {
    voiceId: 'hmMWXCj9K7N5mCPcRkfC',
    why: 'Auren as a boy: Rory, Auren\'s voice.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  'voice.old-woman': {
    voiceId: 'mFgXOmlOfXfr6suoQkRH',
    why: 'Frances, library: Irish, soft and warm with a husk, the lowest and oldest sounding of Hobb\'s auditions (162 Hz). One line, a thousand years ago, nobody else\'s voice.',
    settings: { stability: 0.5, similarity_boost: 0.8 },
  },
  'voice.a-voice': {
    voiceId: 'hmMWXCj9K7N5mCPcRkfC',
    why: 'The warm voice in the dream is Auren\'s (chapter 28: "The voice that thanks you in the dream is his"), so it is Rory, whispered close (DIRECTION).',
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
  '(waking, not getting up) Forty sacks. I counted twice. Counting a third time won\'t help.':
    '[sleepily] Forty sacks. I counted twice. Counting a third time won\'t help.',
  '(not opening her eyes) If it\'s about the sacks, there are forty. Come back later.': '[sleepily] If it\'s about the sacks, there are forty. Come back later.',
  'They crowned me at sixteen because I could add. Nobody said the adding never stops.': '[sighs] They crowned me at sixteen because I could add. Nobody said the adding never stops.',
  'You have a valley. I have a winter\'s bread. Fair trade. Sit down, I\'m tired.': 'You have a valley. I have a winter\'s bread. Fair trade. [sighs] Sit down, I\'m tired.',
  '(watching the white coat go) Not that it\'ll help. He\'ll be at his bell by now.': '[dryly] Not that it\'ll help. He\'ll be at his bell by now.',
  '(softly, to the trees) Easy. It\'s only me. Same as yesterday.': '[softly] Easy. It\'s only me. Same as yesterday.',
  '(through the stone, very calm) That is not in my instructions.': '[calmly] That is not in my instructions.',
  '(out of breath) Is it true? No. Do not show me. She is coming herself.': '[out of breath] Is it true? No. Do not show me. She is coming herself.',
  '(looking at the arches) No. Ask me about any other lamp.': '[quietly] No. Ask me about any other lamp.',
  '(from the door) Up, Button. Grant day. Nobody signs a deed on an empty stomach.': '[calling out] Up, Button. Grant day. Nobody signs a deed on an empty stomach.',
  '(quietly, behind you) Let them laugh. They\'ll all come visiting once you\'ve got a kitchen.': '[quietly] Let them laugh. They\'ll all come visiting once you\'ve got a kitchen.',
  '(on a cart, arms raised) For the Ascended, who lit the way! Let it be lit again!': '[shouting] For the Ascended, who lit the way! Let it be lit again!',
  '(laughing) Then tell it I\'ll be king one day. It can say that to my face.': '[laughing] Then tell it I\'ll be king one day. It can say that to my face.',
  '(into his neck) You great fool. Two winters. You great fool.': '[tearful] You great fool. Two winters. You great fool.',
  '(quietly) Hello, old friend. You have moss on you.': '[quietly] Hello, old friend. You have moss on you.',
  '(from the pack) Ha.': '[dryly] Ha.',
  // The voice in the dream is Auren's, said close: the same voice as the boy in the memories, so it can be known again.
  'There you are. I have waited a long time to say thank you.': '[whispers] There you are. I have waited a long time to say thank you.',
  'Rest now. There are five more to wake.': '[whispers] Rest now. There are five more to wake.',
};
