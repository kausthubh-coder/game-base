// The grey wood from its start, as a player comes to it: the fox's step is done by walking north to the boar's
// place, and Wren's meeting (scene 20) begins there. docs/bugs/2026-11-12-act1-greywood-checkpoint.md: the first
// step was only a flag nothing set, so arriving at the marker never started her.
import { FLAG } from '../content/flags.ts';
import type { Scenario } from '../play/scenario.sim.ts';

export const greywoodArrival: Scenario = {
  name: 'greywood-arrival',
  about: 'From the start of the grey wood, walking to the boar\'s place finishes following the fox and starts Wren\'s meeting.',
  seed: 7,
  start: { quest: 'greywood' },
  inputs: [
    { do: 'wait', seconds: 1 },
    { do: 'check', what: 'the grey wood asks the player to follow the fox', that: (p) => p.game.flags.get(FLAG.questStep('greywood')) === 'follow' },
    { do: 'teleport', to: { place: 'boar', dz: 9 } },
    { do: 'wait', until: (p) => p.sys.talk.active, seconds: 10 },
    { do: 'check', what: 'Wren\'s meeting is the conversation playing', that: (p) => p.sys.talk.current()?.scene === 20 },
    { do: 'run', name: 'hear her out', run: (p) => p.talkThrough() },
    { do: 'wait', seconds: 1 },
  ],
  expect: (p) => [
    ['Wren\'s meeting has played', p.game.flags.is(FLAG.scene(20))],
    ['the step after it, the three foxes, is open', p.game.flags.get(FLAG.questStep('greywood')) === 'foxes'],
  ],
};
