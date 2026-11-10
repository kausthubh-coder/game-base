// One-line hints, each sent once as a `hint` event the first time its condition holds.
// The director in src/game/story sends them, in this order when several are due, and never during a
// conversation. The flag `hint.<id>` remembers a hint that was sent.
//
// The keys named here are the ones src/game/shell/keys.ts and the interface bind: Q and R turn the
// camera. Nothing binds M to the map yet: bind it, or change the text of `map` here.

import { WHEAT_SHORT, type Condition } from './quests.ts';

export interface HintDef {
  id: string;
  text: string;
  when: Condition;
}

export const HINTS: readonly HintDef[] = [
  { id: 'move', text: 'Move with W, A, S and D. Q and R turn the camera.', when: { quest: 'plot', step: 'meet' } },
  { id: 'talk', text: 'Press E to talk to someone close by.', when: { npcNear: 5 } },
  { id: 'almanac', text: 'Press Tab to open the Almanac.', when: { flag: 'has.almanac' } },
  { id: 'slots', text: 'Keys 1 to 9 pick a quick slot.', when: { bag: 'axe' } },
  { id: 'gather', text: 'Hold the left button on a tree or a block to gather it.', when: { quest: 'roof' } },
  { id: 'use', text: 'The right button uses or sets down what you hold.', when: { any: [{ bag: 'workbench' }, { bag: 'bed' }, { bag: 'berry' }, { bag: 'wheat_seeds' }] } },
  { id: 'sleep', text: 'Sleep in a bed to pass the night.', when: { placed: 'bed' } },
  { id: 'map', text: 'Press M to open the map.', when: { quest: 'leaftail' } },
  { id: 'soft', text: 'Hold Shift to walk softly near the leaftail.', when: { all: [{ petNear: 'leaftail', within: 14 }, { not: { bonded: 'leaftail' } }] } },
  { id: 'berry', text: 'Hold a berry out to the leaftail with the right button, then stand still.', when: { all: [{ bag: 'berry' }, { petNear: 'leaftail', within: 14 }, { not: { bonded: 'leaftail' } }] } },
  { id: 'water', text: 'Use the hoe on grass, plant a seed, then water it. Wet soil grows.', when: { bag: 'watering_can' } },
  { id: 'lamp', text: 'Hold the river lamp and use it at the river bank.', when: { bag: 'river_lamp' } },
  // Never stuck: where to go when a tool or the seed runs out.
  { id: 'axe.lost', text: 'No axe? Tamsin has another.', when: { all: [{ flag: 'plot.met' }, { not: { bag: 'axe' } }, { not: { flag: 'owed.axe' } }] } },
  { id: 'seeds.short', text: 'Short of seed? Gus will spot you four more.', when: { all: [{ flag: 'bread.seeds' }, { not: { flag: 'bread.delivered' } }, WHEAT_SHORT] } },
];
