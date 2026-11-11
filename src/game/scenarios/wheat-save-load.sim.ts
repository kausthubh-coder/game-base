// The same field and the same three nights as wheat-three-nights, with the game saved and loaded into a
// fresh world and kernel twice on the way: after the first night, and before the harvest. It must end the same.
import type { Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';
import { WHEAT_INPUTS, WHEAT_START, wheatFacts } from './wheat-three-nights.sim.ts';

// The check on the morning of day 2 is the last input of the first night.
const firstNight = WHEAT_INPUTS.findIndex((input) => input.do === 'check' && input.what.startsWith('on the morning of day 2'));
const harvest = WHEAT_INPUTS.findIndex((input) => input.do === 'hit');
const reload: Input = { do: 'reload' };

export const wheatSaveLoad: Scenario = {
  name: 'wheat-save-load',
  about: 'The three nights of wheat with a save and a load after the first night and before the harvest: the same 12 wheat on day 4.',
  seed: 11,
  start: WHEAT_START,
  inputs: [...WHEAT_INPUTS.slice(0, firstNight + 1), reload, ...WHEAT_INPUTS.slice(firstNight + 1, harvest), reload, ...WHEAT_INPUTS.slice(harvest)],
  // The events heard before a load stay with the game that was left, so the nights are counted by the day.
  expect: (p) => wheatFacts(p).filter(([what]) => what !== 'three nights were slept'),
};
