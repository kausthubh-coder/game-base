// Who was tried for each voice of act 1, on which of their own lines. tools/voice/audition.ts reads it. Every
// candidate is a professional voice from ElevenLabs' shared library, picked from its description
// (GET /v1/shared-voices, 2026-11-12) to fit how the person talks in the handbook's chapter 28. Each says two of
// the person's lines with the settings the person will have in `CAST`, so the take of the voice picked is the
// clip the game plays: tools/voice.ts copies it instead of buying it again.
import type { CastVoice } from '../../src/game/content/cast.ts';

export interface Candidate {
  /** Short and unique within the person. */
  key: string;
  voiceId: string;
  /** The library name, as GET /v1/shared-voices gives it. */
  name: string;
  /** Why it was worth a try. */
  why: string;
}

export interface Audition {
  /** Two lines exactly as dialogue.ts has them. */
  lines: readonly string[];
  settings: CastVoice['settings'];
  candidates: readonly Candidate[];
}

const PLAIN = { stability: 0.5, similarity_boost: 0.8 };

export const AUDITIONS: Readonly<Record<string, Audition>> = {
  custodian: {
    lines: ['(one eye opening) You\'re late.', 'Any order. I did not say they would be pleasant.'],
    settings: PLAIN,
    candidates: [
      { key: 'grimblewood', voiceId: 'ouL9IsyrSnUkCmfnD02u', name: 'Grimblewood Thornwhisker - Snarky Gnome & Magical Maintainer', why: 'Old, British, high and raspy: a small creature that keeps a place running, with snark.' },
      { key: 'gerald', voiceId: 'fGIZlgPQ75MMlvQ6WxgY', name: 'Gerald - Exciting Older Character', why: 'Old, British, eccentric and raspy. Less of a cartoon than a gnome.' },
      { key: 'daniel', voiceId: 'htZQqY7WtacRNV7s62Iy', name: 'Daniel - The Gruff Old British Wizard', why: 'Old, British, gruff with dry wit. The low end of grumpy.' },
    ],
  },
  dax: {
    lines: ['Gate. Fence. Road. Fine.', 'Ground\'s hard. Not complaining. Saying.'],
    settings: { ...PLAIN, speed: 0.95 },
    candidates: [
      { key: 'johnny', voiceId: '8JVbfL6oEdmuxKn5DK2C', name: 'Johnny Kid - Serious and Calm Narrator', why: 'Young British man, serious and calm. Plain, never hurried.' },
      { key: 'archie', voiceId: 'kmSVBPu7loj4ayNinwWM', name: 'Archie - Social Media Narrator', why: 'Young British man, warm and deep.' },
      { key: 'cillian', voiceId: 'B5jEZPqk2OJ2vkPw3wBM', name: 'Cillian - Low, Calm and Authentic', why: 'Young Irish man, low and calm.' },
    ],
  },
  mina: {
    lines: ['I can\'t draw in the dark. I tried. It\'s a very bad map.', '(looking at your hand) Couldn\'t. I\'m going to need a bigger table.'],
    settings: { ...PLAIN, speed: 1.08 },
    candidates: [
      { key: 'emmaline', voiceId: 'nDJIICjR9zfJExIFeSCN', name: 'Emmaline - young British girl', why: 'A young British girl, bright and exact diction, "precocious". The girl who read every map.' },
      { key: 'lucy', voiceId: 'lcMyyd2HUfFzxdCaC4Ta', name: 'Lucy - Fresh & Casual', why: 'Young British, energetic and quick.' },
      { key: 'charlotte', voiceId: '6fZce9LFNG3iEITDfqZZ', name: 'Charlotte - Warm, Clear, Modern, Distinctive', why: 'Young British, crisp and bright.' },
    ],
  },
  wren: {
    lines: ['(softly, to the trees) Easy. It\'s only me. Same as yesterday.', 'His name is Bramble. I raised him on a bottle.'],
    settings: { ...PLAIN, speed: 0.95 },
    candidates: [
      { key: 'emily', voiceId: '1cxc5c3E9K6F1wlqOJGV', name: 'Emily - Gentle, Soft and Meditative', why: 'Young Northern Irish woman, soft and gentle, close to a whisper. Talks to beasts first.' },
      { key: 'labhaoise', voiceId: 'sgk995upfe3tYLvoGcBN', name: 'Labhaoise - Warm and Grounded', why: 'Young Irish woman, warm and grounded, a level lilt.' },
      { key: 'alba', voiceId: 'eh9GHWIaYsZB3Alk8wrY', name: 'Alba Mac - Animated Scottish', why: 'Young Edinburgh woman, soft.' },
    ],
  },
  elowen: {
    lines: ['Look at you. A season ago you had a tent.', 'Have you eaten? You have the look of someone who forgets.'],
    settings: { ...PLAIN, speed: 0.95 },
    candidates: [
      { key: 'beatrice', voiceId: 'kkPJzQOWz2Oz9cUaEaQd', name: 'Beatrice - Mature, Gentle and Engaging', why: 'Old, British, warm and gentle, a calm pace. Already on the account from Tamsin\'s auditions.' },
      { key: 'frances', voiceId: 'mFgXOmlOfXfr6suoQkRH', name: 'Frances - Soft, Warm and Calm', why: 'Irish, soft and warm with a husk. Already on the account from Hobb\'s auditions.' },
      { key: 'colleen', voiceId: '1OYA2kgM85gF2eGN8HEp', name: 'Colleen - Warm Southern Irish Woman', why: 'Southern Irish, soft and warm.' },
    ],
  },
  calla: {
    lines: ['For your safety. These places fall in. What did you find?', '(through the stone, very calm) That is not in my instructions.'],
    settings: { ...PLAIN, stability: 0.6 },
    candidates: [
      { key: 'jade', voiceId: 'tfvhQIydLdGEZP6h00c5', name: 'Jade - Polished, Sophisticated Narrator', why: 'Young British, polished, a precise and crisp accent.' },
      { key: 'lucynews', voiceId: 'EQu48Nbp4OqDxsnYh27f', name: 'Lucy - Engaging News Reporter', why: 'Young British, clear and polished, a professional reading out what is so.' },
      { key: 'shelley', voiceId: '4CrZuIW9am7gYAxgo2Af', name: 'Shelley - Clear, Confident and British', why: 'Young British, crisp, clear and sincere.' },
    ],
  },
  aldric: {
    lines: ['(out of breath) Is it true? No. Do not show me. She is coming herself.', 'Bless you. Is that... may I... no. No. Bless you.'],
    settings: PLAIN,
    candidates: [
      { key: 'tarquin', voiceId: '7cOBG34AiHrAzs842Rdi', name: 'Tarquin - Posh & English RP', why: 'Middle aged, posh RP: the formal half of him.' },
      { key: 'soifur', voiceId: '1SgtCdnh90xU4Bpehczp', name: 'Soifur', why: 'British and anxious by its description: the flustered half.' },
      { key: 'luke', voiceId: 'DEn2UKxERg5VSUMgGDLH', name: 'Luke - Polished, Warm and Versatile', why: 'Middle aged, RP, warm and polished.' },
    ],
  },
  stag: {
    lines: ['Small. Marked.', 'She was kinder, before.'],
    settings: { stability: 0.6, similarity_boost: 0.8, speed: 0.8 },
    candidates: [
      { key: 'mossbeard', voiceId: 'bFrjFL4nlpeYNwNRhXxq', name: 'Mossbeard - The God of the Wild', why: '"Gnarly voice of an ancient creature. Creaking subharmonics. Bark-textured bass. Glacial. Immense. Tender." A god of a wood.' },
      { key: 'gravel', voiceId: 'M5E055lOUxMi0kJpGyE9', name: 'Gravel Midnight – Deep Grit Character Voice', why: 'Old, British, deep and rough with a strong low end.' },
      { key: 'eldrin', voiceId: 'LvmvHEBEmMJBJw9UuhwO', name: 'Eldrin - Wise Ancient Wizard Storyteller', why: 'Deep, resonant, a gentle rasp and a patient cadence.' },
    ],
  },
  tansy: {
    lines: ['Honey\'s not supper. People think it is. It isn\'t.', 'I slept with the hive. They don\'t mind. I do.'],
    settings: { ...PLAIN, speed: 1.05 },
    candidates: [
      { key: 'michelle', voiceId: 'C92s6vssSLlabgIln1iY', name: 'Michelle - Direct and Natural', why: 'Middle aged, Northern Irish, "an authentic straight talker". Warm, then blunt.' },
      { key: 'hannah', voiceId: '73fZMjboCm1aBVyxTbBp', name: 'Hannah - Welsh And friendly', why: 'Middle aged, Welsh, friendly and soft.' },
      { key: 'isla', voiceId: 'h8eW5xfRUGVJrZhAFxqK', name: 'Isla - Youthful, Relaxed, and Warm', why: 'Middle aged, Scottish, warm.' },
    ],
  },
  holt: {
    lines: ['A lamp is a promise. Somebody walks toward it.', '(looking at the arches) No. Ask me about any other lamp.'],
    settings: { ...PLAIN, speed: 0.92 },
    candidates: [
      { key: 'alder', voiceId: 'nTMUXLFSfbWmdKKy7nDC', name: 'Alder - Warm, Raspy and Comforting', why: 'Old, Irish, a gentle rasp, slow.' },
      { key: 'steve', voiceId: 'yvKg3CwzCYDTwyHnWQLg', name: 'Steve - Calm, Expressive and Balanced', why: 'An old Northern English man from Lancashire, calm.' },
      { key: 'beezle', voiceId: 'BBfN7Spa3cqLPH1xAS22', name: 'Beezle Wheezelby', why: 'Old, British, soft and wizened.' },
    ],
  },
  ren: {
    lines: ['(bowing too low) I can carry forty days of it. I have counted.', 'The Mother chose me. I want you to know I asked first.'],
    settings: PLAIN,
    candidates: [
      { key: 'adam', voiceId: 'N7ZPtMSz30kJ869b58WE', name: 'Adam - Middle Eastern Calm Male', why: 'Young, a light Middle Eastern accent, warm. From far off, and the desert.' },
      { key: 'mahmoud', voiceId: 'Os2frcqCuUz8b9F93RuI', name: 'Mahmoud - Deep, Warm, and Clear', why: 'Young, Arab, warm and natural.' },
      { key: 'sara', voiceId: 'jAAHNNqlbAX9iWjJPEtE', name: 'Sara - Soft, Calm and Gentle', why: 'Young, Jordanian, calm. The handbook never says whether Ren is a boy or a girl.' },
    ],
  },
  guildmaster: {
    lines: ['Ward of the guild, sixteen years. By right of the grant: plot forty-one, Greenhollow.'],
    settings: PLAIN,
    candidates: [
      { key: 'nathaniel', voiceId: 'AkzTpEeeEWvyZf4umyCJ', name: 'Nathaniel C – Breaking News & Public Broadcast', why: 'Middle aged, British, formal and calm: words read out for the hundredth time.' },
      { key: 'grant', voiceId: 'VC6vCXhVaI8BZefRtXZV', name: 'Grant Gravitas - Rich, warm, cinematic', why: 'Old, British, "could have read the news on the BBC in 1965".' },
      { key: 'damiaan', voiceId: 'L3NacDtfFuYL0m0wJjjq', name: 'Damiaan - Academic, British English', why: 'Middle aged, formal academic RP.' },
    ],
  },
  ilara: {
    lines: ['He wants to meet you. I said you are frightened of big things.', 'Put your hand flat. Flat. He isn\'t a dog.'],
    settings: PLAIN,
    candidates: [
      { key: 'zoey', voiceId: 'f4EpLLfw2IURnw62TRtz', name: 'Zoey - Upbeat & Refreshing', why: 'Young, whimsical, a slight Celtic lilt. Teasing.' },
      { key: 'ana', voiceId: 'rCmVtv8cYU60uhlsOo1M', name: 'Ana - Emotional, Warm and Expressive', why: 'Young British woman, warm and expressive.' },
      { key: 'niamh', voiceId: '1e9Gn3OQenGu4rjQ3Du1', name: 'Niamh - Soft, Engaging and Friendly', why: 'Young Irish woman, soft, a slight lilt.' },
    ],
  },
  auren: {
    lines: ['Sit down, Nan. I\'ll fetch the other two.', 'I\'m not frightened. I\'m being respectful. From over here.'],
    settings: PLAIN,
    candidates: [
      { key: 'rory', voiceId: 'hmMWXCj9K7N5mCPcRkfC', name: 'Rory - Natural, Warm and Lively', why: 'A young Dublin man, warm and lively, easy to like.' },
      { key: 'samwelsh', voiceId: 'DikmR0aoFXAp1A3NcovW', name: 'Sam - Soft, Slightly Welsh and Friendly', why: 'A young Welsh man, soft, deep and friendly.' },
      { key: 'asher', voiceId: 'UaYTS0wayjmO9KD1LR4R', name: 'Asher - Confident, Charismatic & Playful', why: 'A young British man, charismatic and playful.' },
    ],
  },
};
