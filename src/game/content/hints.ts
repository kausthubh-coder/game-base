// One-line hints, each sent once as a `hint` event the first time its condition holds.
// The director in src/game/story sends them, in this order when several are due, and never during a
// conversation. The flag `hint.<id>` remembers a hint that was sent.
//
// Every key named here is bound: W, A, S, D, Shift, Q, R, E, 1 to 9 and the two mouse buttons in
// src/game/shell/keys.ts, Tab and M in src/game/views/ui-panels.view.ts. The list a player sees in
// Settings is src/game/uiview/keys.ts. tools/play-ui.mjs presses each key and checks what it does, so
// change a binding, its row in that list and its hint here together.
//
// The rules send `text`. A hint that names camera keys has `mouse` too: the shell swaps in the line for how the
// mouse works when the hint is sent (see MouseMode in src/game/shell/keys.ts). `point` is the 2.5D camera,
// `drag` the free camera with Drag to turn, `lock` first person and the free camera with Lock to turn.

import { WHEAT_SHORT, type Condition } from './quests.ts';

export interface HintDef {
  id: string;
  text: string;
  when: Condition;
  /** The line for each way the mouse works, where it differs from `text`. */
  mouse?: Partial<Record<'point' | 'drag' | 'lock', string>>;
}

export const HINTS: readonly HintDef[] = [
  {
    id: 'move', text: 'Move with W, A, S and D. Drag with the right button held, or press Q and R, to turn the camera.', when: { quest: 'plot', step: 'meet' },
    mouse: {
      drag: 'Move with W, A, S and D. Drag with the right button held to turn the camera.',
      lock: 'Move with W, A, S and D. Click the world and the mouse turns the camera. Alt shows the cursor.',
    },
  },
  { id: 'talk', text: 'Press E to talk to someone close by.', when: { npcNear: 5 } },
  { id: 'almanac', text: 'Press Tab to open the Almanac.', when: { flag: 'has.almanac' } },
  { id: 'slots', text: 'Keys 1 to 9 pick a quick slot.', when: { bag: 'axe' } },
  { id: 'gather', text: 'Hold the left button on a tree or a block to gather it.', when: { quest: 'roof' } },
  { id: 'use', text: 'A click of the right button uses or sets down what you hold.', when: { any: [{ bag: 'workbench' }, { bag: 'bed' }, { bag: 'berry' }, { bag: 'wheat_seeds' }] } },
  { id: 'sleep', text: 'Sleep in a bed to pass the night: press E beside it once evening comes.', when: { placed: 'bed' } },
  { id: 'map', text: 'Press M to open the map.', when: { quest: 'leaftail' } },
  { id: 'soft', text: 'Hold Shift to walk softly near the leaftail.', when: { all: [{ petNear: 'leaftail', within: 14 }, { not: { bonded: 'leaftail' } }] } },
  { id: 'berry', text: 'Hold a berry out to the leaftail with the right button, then stand still.', when: { all: [{ bag: 'berry' }, { petNear: 'leaftail', within: 14 }, { not: { bonded: 'leaftail' } }] } },
  { id: 'water', text: 'With the right button: hoe the grass, plant a seed, then water it. Wet soil grows.', when: { bag: 'watering_can' } },
  { id: 'lamp', text: 'Hold the river lamp and press the right button at the river bank.', when: { bag: 'river_lamp' } },
  // Never stuck: where to go when a tool or the seed runs out.
  { id: 'axe.lost', text: 'No axe? Tamsin has another.', when: { all: [{ flag: 'plot.met' }, { not: { bag: 'axe' } }, { not: { flag: 'owed.axe' } }] } },
  { id: 'seeds.short', text: 'Short of seed? Gus will spot you four more.', when: { all: [{ flag: 'bread.seeds' }, { not: { flag: 'bread.delivered' } }, WHEAT_SHORT] } },
];
