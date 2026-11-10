// Two sample conversations: Odo the baker and Juniper, a child. They show what a conversation can
// do: a line that depends on a flag, a choice that is offered only when a condition passes, and
// effects that set flags the rest of the game can read. Data only.
//
// Flags these use:
//   met.odo         true once Odo has introduced himself
//   oven            'asked' once Odo has asked for wood, 'lit' once he has it
//   wood            how many logs the player carries
//   sweets          how many sweets the player carries
//   friend.odo      friendship with Odo, a number
//   rumor.leaftail  true once Juniper has told her secret. The map can draw a rumor circle for it.
//   pet.leaftail    true once the player has found the creature
import type { Conversation } from '../features/dialogue/dialogue.sim.ts';

/** Voices for the sound engine, by the `voice` name a speaker uses. The shape is the sound engine's voice. */
export const sampleVoices: Record<string, { pitch: number; wave: 'sine' | 'triangle' | 'square' | 'sawtooth'; speed: number; bright: number }> = {
  odo: { pitch: 52, wave: 'triangle', speed: 26, bright: 1500 },
  juniper: { pitch: 74, wave: 'sine', speed: 36, bright: 3400 },
};

/** Odo names every loaf. His oven went out in the night, and the market opens at noon. */
export const bakerTalk: Conversation = {
  id: 'odo-oven',
  start: 'lit',
  speakers: { odo: { name: 'Odo', voice: 'odo', speed: 26 } },
  lines: {
    // The newest state is tested first. Each line that does not apply passes the talk down the list.
    lit: {
      who: 'odo',
      if: { flag: 'oven', is: 'lit' },
      else: 'waiting',
      text: 'Hear her roar? First loaf is out at dawn. I am calling him Bartholomew.',
    },
    waiting: {
      who: 'odo',
      if: { flag: 'oven', is: 'asked' },
      else: 'hello',
      text: 'Still cold in there. Ten logs, and the market gets its bread.',
      choices: [
        { text: 'Here. Ten logs.', if: { flag: 'wood', atLeast: 10 }, do: [{ add: 'wood', by: -10 }, { set: 'oven', to: 'lit' }, { add: 'friend.odo' }, { add: 'sweets' }], to: 'thanks' },
        { text: 'I am still looking.', to: 'noon' },
      ],
    },
    hello: {
      who: 'odo',
      if: { not: { flag: 'met.odo' } },
      else: 'ask',
      do: [{ set: 'met.odo' }],
      text: 'Morning! Mind the tray. That one is Gerald, and he is not for sale.',
      to: 'ask',
    },
    ask: {
      who: 'odo',
      do: [{ set: 'oven', to: 'asked' }],
      text: 'The oven went out in the night. No fire, no bread, and the market opens at noon.',
      choices: [
        { text: 'I have wood right here.', if: { flag: 'wood', atLeast: 10 }, do: [{ add: 'wood', by: -10 }, { set: 'oven', to: 'lit' }, { add: 'friend.odo' }, { add: 'sweets' }], to: 'thanks' },
        { text: 'I will find you some wood.', to: 'ten' },
        { text: 'Why is he called Gerald?', to: 'gerald' },
      ],
    },
    gerald: {
      who: 'odo',
      text: 'He rose crooked and proud of it. Just like my uncle.',
      choices: [
        { text: 'I will find you some wood.', to: 'ten' },
        { text: 'Good luck with the oven.', to: 'noon' },
      ],
    },
    ten: { who: 'odo', text: 'Ten logs would do it. Gerald and I will be right here.' },
    noon: { who: 'odo', text: 'If the stall is empty at noon, you will know why.' },
    thanks: {
      who: 'odo',
      text: 'Listen to that. She is roaring already! Here, a honey bun for the road.',
    },
  },
};

/** Juniper trades secrets for sweets. Today's secret has a leaf for a tail. */
export const childTalk: Conversation = {
  id: 'juniper-secret',
  start: 'found',
  speakers: { juniper: { name: 'Juniper', voice: 'juniper', speed: 36 } },
  lines: {
    found: {
      who: 'juniper',
      if: { flag: 'pet.leaftail' },
      else: 'told',
      text: 'You found it! Can I pet it? I will be so quiet. Please?',
    },
    told: {
      who: 'juniper',
      if: { flag: 'rumor.leaftail' },
      else: 'psst',
      text: 'Did you look by the mill yet? Go slow. It hides when it hears boots.',
    },
    psst: {
      who: 'juniper',
      text: 'Psst. I know where something lives. Something with a leaf for a tail.',
      choices: [
        { text: 'Trade you a honey bun.', if: { flag: 'sweets', atLeast: 1 }, do: [{ add: 'sweets', by: -1 }, { set: 'rumor.leaftail' }], to: 'secret' },
        { text: 'Just tell me.', to: 'price' },
        { text: 'Not now.', to: 'loss' },
      ],
    },
    price: {
      who: 'juniper',
      text: 'Secrets cost one sweet. Odo has honey buns, if his oven is lit.',
    },
    loss: { who: 'juniper', text: 'Your loss. It is really, really green.' },
    secret: {
      who: 'juniper',
      text: 'Deal. Somewhere by the old mill, where the water turns. It only comes out when it is quiet.',
      to: 'promise',
    },
    promise: { who: 'juniper', text: 'And you did not hear it from me.' },
  },
};

export const sampleConversations: readonly Conversation[] = [bakerTalk, childTalk];
