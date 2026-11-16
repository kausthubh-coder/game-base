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
//
// A quest step's own how-to line is its `hint` in ./quests.ts, shown in the quest log. These are the keys.

import type { QuestId } from './ids.ts';
import type { Condition } from './quests.ts';

export interface HintDef {
  id: string;
  text: string;
  /** The line for a phone or tablet with touch controls. */
  touch?: string;
  when: Condition;
  /** The line for each way the mouse works, where it differs from `text`. */
  mouse?: Partial<Record<'point' | 'drag' | 'lock', string>>;
}

/** The quest's open step is this one. */
const open = (quest: QuestId, step: string): Condition => ({ quest, step });

export const HINTS: readonly HintDef[] = [
  {
    touch: 'Move with the left stick. Swipe the world to turn the camera.',
    id: 'move', text: 'Move with W, A, S and D. Drag with the right button held, or press Q and R, to turn the camera.', when: { quest: 'grantday' },
    mouse: {
      drag: 'Move with W, A, S and D. Drag with the right button held to turn the camera.',
      lock: 'Move with W, A, S and D. Click the world and the mouse turns the camera. Alt shows the cursor.',
    },
  },
  { id: 'talk', text: 'Press E to talk to someone close by.', when: { npcNear: 5 } },
  { id: 'slots', text: 'Keys 1 to 9 pick a quick slot.', when: { bag: 'axe' } },
  { id: 'gather', text: 'Hold the left button on a tree or a block to gather it.', when: open('ground', 'brambles') },
  { id: 'door', text: 'Walk up to the stone door and press E.', when: open('ground', 'door') },
  { id: 'back', text: 'Walk backwards to the stone door. It is slower than you.', when: open('night', 'door') },
  { id: 'almanac', text: 'Press Tab to open the field book.', when: { flag: 'has.almanac' } },
  { id: 'use', text: 'A click of the right button uses or sets down what you hold.', when: { any: [{ bag: 'workbench' }, { bag: 'bed' }, { bag: 'wheat_seeds' }] } },
  { id: 'sleep', text: 'Sleep in a bed to pass the night: press E beside it once evening comes.', when: { any: [{ placed: 'bed' }, open('night', 'sleep')] } },
  { id: 'soft', text: 'Hold Shift to walk softly, so a wild beast does not bolt.', when: { quest: 'greywood' } },
  { id: 'map', text: 'Press M to open the map.', when: { quest: 'blessing' } },
  { id: 'quests', text: 'More than one quest is open. Pick the one to follow in the quest log.', when: { all: [{ quest: 'pump' }, { quest: 'gallery' }] } },
  { id: 'water', text: 'With the right button: hoe the grass, plant a seed, then water it. Wet soil grows.', when: { bag: 'watering_can' } },
  // Never stuck: where to go when a tool runs out.
  { id: 'axe.lost', text: 'No axe? Tamsin keeps a spare at the lodge.', when: { all: [{ quest: 'grantday', state: 'done' }, { not: { bag: 'axe' } }, { not: { flag: 'owed.axe' } }] } },
];
