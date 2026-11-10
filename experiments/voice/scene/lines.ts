// The voiced scene: five short moments of act 1, word for word from src/game/content/dialogue.ts
// (tools/generate-lines.ts fails if a line is not there). `say` is what the voice is given: the line
// with its stage cue turned into an eleven_v3 audio tag, such as [warmly] or [sighs]. The box shows `text`.
import type { CastId } from '../cast.ts';

export type SceneLine =
  | { by: CastId; text: string; say: string }
  | { by: 'narrator'; text: string }
  /** What the player picks. The scene picks it for them. */
  | { by: 'player'; text: string };

export interface Scene {
  id: string;
  title: string;
  /** The conversation ids in dialogue.ts the lines come from. */
  from: string[];
  lines: SceneLine[];
}

export const SCENES: Scene[] = [
  {
    id: 'stone',
    title: 'The grant stone, dawn',
    from: ['tamsin.meet'],
    lines: [
      { by: 'tamsin', text: 'Twelve people have asked me for this plot.', say: '[slowly] Twelve people have asked me for this plot.' },
      { by: 'tamsin', text: 'You are the first who looked at the ground before the view.', say: '[warmly] You are the first who looked at the ground before the view.' },
      { by: 'tamsin', text: 'Take the book. It has been blank for forty years.', say: 'Take the book. [softly] It has been blank for forty years.' },
      { by: 'tamsin', text: 'I only ever looked at things to price them.', say: '[wryly] I only ever looked at things to price them.' },
      { by: 'narrator', text: 'She puts it in your hands. The cover is soft with use. Every page is empty.' },
      { by: 'tamsin', text: 'Mosslings keep the rocks by the pond. Sit near one and write down what you see.', say: 'Mosslings keep the rocks by the pond. Sit near one and write down what you see.' },
      { by: 'tamsin', text: 'Two columns. What it needs, and what it gives. Fill both.', say: '[patiently] Two columns. What it needs, and what it gives. Fill both.' },
      { by: 'tamsin', text: 'And an axe. You will want a roof before you want anything else.', say: '[chuckles] And an axe. You will want a roof before you want anything else.' },
      { by: 'tamsin', text: 'That is the advice. It weighs more than the axe.', say: '[warmly] That is the advice. It weighs more than the axe.' },
    ],
  },
  {
    id: 'granary',
    title: 'The granary',
    from: ['maren.ask'],
    lines: [
      { by: 'narrator', text: 'A girl is asleep across the ledgers, a pen still in her hand.' },
      {
        by: 'maren',
        text: '(waking) Forty sacks. I counted twice. It is not enough, and counting again will not make it enough.',
        say: '[sleepily] Forty sacks. I counted twice. [tired] It is not enough, and counting again will not make it enough.',
      },
      { by: 'maren', text: 'Twenty sheaves by the festival. I can pay you in thanks and one good meal.', say: '[briskly] Twenty sheaves by the festival. I can pay you in thanks and one good meal.' },
      { by: 'maren', text: 'You are the one on Tamsin\'s grant. You have a field. I have a winter.', say: '[dryly] You are the one on Tamsin\'s grant. You have a field. I have a winter.' },
      { by: 'player', text: 'Is being queen always this?' },
      { by: 'maren', text: 'They crowned me at sixteen because I could add. Nobody said the adding never stops.', say: '[sighs] They crowned me at sixteen because I could add. Nobody said the adding never stops.' },
      { by: 'maren', text: 'Gus has seed. Go, before I count something.', say: '[half-laughing] Gus has seed. Go, before I count something.' },
    ],
  },
  {
    id: 'field',
    title: 'Gus\'s field',
    from: ['gus.seeds.first'],
    lines: [
      { by: 'narrator', text: 'A man is crouched in a furrow, rubbing dirt between two fingers.' },
      { by: 'gus', text: 'Soil\'s tired. Not lazy. Tired. You\'d be too.', say: '[slowly] Soil\'s tired. Not lazy. Tired. You\'d be too.' },
      { by: 'gus', text: 'Maren sent you. She said please? Huh. She\'s worried, then.', say: 'Maren sent you. She said please? [grunts] Huh. She\'s worried, then.' },
      { by: 'gus', text: 'Hoe. Can. Twelve seeds. Break the ground, plant, keep it wet.', say: 'Hoe. Can. Twelve seeds. Break the ground, plant, keep it wet.' },
      { by: 'gus', text: 'Wet soil grows. Dry soil waits. That\'s all I know. It\'s enough.', say: 'Wet soil grows. Dry soil waits. That\'s all I know. It\'s enough.' },
      { by: 'gus', text: 'Rain\'d do it better. Rain always does it better.', say: '[wistfully] Rain\'d do it better. Rain always does it better.' },
    ],
  },
  {
    id: 'square',
    title: 'The square',
    from: ['juniper.first', 'juniper.trade'],
    lines: [
      { by: 'juniper', text: 'You\'re the new one! From the stone! Have you got any sweets?', say: '[excited] You\'re the new one! From the stone! Have you got any sweets?' },
      { by: 'juniper', text: 'A berry\'s a sweet. A berry counts. I\'ve got secrets. Good ones.', say: '[mischievously] A berry\'s a sweet. A berry counts. I\'ve got secrets. Good ones.' },
      { by: 'juniper', text: 'Is that a berry? That\'s a sweet! Swap you. One berry, one secret.', say: '[gasps] Is that a berry? That\'s a sweet! Swap you. One berry, one secret.' },
      { by: 'player', text: 'Give her a berry.' },
      { by: 'juniper', text: 'Secret. Tamsin\'s sword is under the lodge floor. She grew beans on top.', say: '[whispers] Secret. Tamsin\'s sword is under the lodge floor. [giggles] She grew beans on top.' },
    ],
  },
  {
    id: 'bank',
    title: 'The river bank, the festival',
    from: ['tamsin.end'],
    lines: [
      { by: 'tamsin', text: 'Good harvest. Small, and good.', say: '[warmly] Good harvest. Small, and good.' },
      { by: 'tamsin', text: '(looking west) Evening came early again. A little sooner every week.', say: '[quietly] Evening came early again. [pause] A little sooner every week.' },
      { by: 'tamsin', text: 'Go on. Float your lamp.', say: '[gently] Go on. Float your lamp.' },
    ],
  },
];

/** One line per person, made with every model, so the models can be heard side by side. */
export const COMPARE: { scene: string; index: number }[] = [
  { scene: 'stone', index: 1 },
  { scene: 'granary', index: 1 },
  { scene: 'field', index: 1 },
  { scene: 'square', index: 4 },
];
