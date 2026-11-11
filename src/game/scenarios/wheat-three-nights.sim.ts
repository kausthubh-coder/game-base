// Wheat planted at dusk, watered and slept on for three nights, then harvested: the bag holds wheat.
// A night in wet soil is worth two stages, so the first morning finds every plant at stage 2.
import type { Cell, Input } from '../play/inputs.sim.ts';
import type { Fact, Scenario, Start } from '../play/scenario.sim.ts';
import type { Play } from '../play/harness.sim.ts';
import { NO_ROOF_TOAST, TOO_EARLY_TOAST } from '../placeables/index.sim.ts';

/** A block of the grant's meadow, counted from its middle. `dy` -1 is the ground. */
const at = (dx: number, dz: number, dy = -1): Cell => ({ place: 'grant.center', dx, dy, dz });

const FIELD: readonly Cell[] = [at(-1, -1), at(0, -1), at(1, -1), at(-1, 0), at(0, 0), at(1, 0)];

/** One evening: water the field and sleep. One use of the can wets three by three, which covers the field. */
const night: readonly Input[] = [
  { do: 'wait', until: 'evening' },
  { do: 'take', item: 'watering_can' },
  { do: 'use', at: at(0, -1) },
  { do: 'interact', prompt: 'Sleep' },
];

export const WHEAT_START: Start = { quest: 'roof', give: { hoe: 1, watering_can: 1, wheat_seeds: 6, bed: 1, plank: 3 } };

export const WHEAT_INPUTS: readonly Input[] = [
  // Two blocks east of the field, come to from the south, so the hero faces north and the bed lies north to south.
  { do: 'teleport', to: { place: 'grant.center', dx: 2, dz: 3 } },
  { do: 'walk', to: { place: 'grant.center', dx: 2, dz: 1 }, within: 0.1 },
  // A bed, and a roof over its pillow: two planks beside it and one out over it.
  { do: 'take', item: 'bed' },
  { do: 'use', at: at(3, 1) },
  // Under open sky the bed says why not.
  { do: 'interact', prompt: 'Sleep' },
  { do: 'check', what: 'a bed under open sky asks for a roof', that: (p) => p.game.clock.day === 1 && p.said.at(-1) === NO_ROOF_TOAST },
  { do: 'take', item: 'plank' },
  { do: 'use', at: at(4, 0) },
  { do: 'use', at: at(4, 0, 0) },
  { do: 'use', at: at(4, 0, 1), face: [-1, 0, 0] },
  { do: 'check', what: 'the bed is two blocks long with a plank over its pillow', that: (p) => bedAt(p, 3, 0) && bedAt(p, 3, 1) && !p.world.openSky(Math.floor(center(p).x) + 3, center(p).y + 1, Math.floor(center(p).z)) },
  // In the morning the bed says it is too early.
  { do: 'interact', prompt: 'Sleep' },
  { do: 'check', what: 'a roofed bed in the morning says it is not evening yet', that: (p) => p.game.clock.day === 1 && p.said.at(-1) === TOO_EARLY_TOAST },
  // The field goes in at dusk, so nothing grows before the first night.
  { do: 'wait', until: 'evening' },
  { do: 'take', item: 'hoe' },
  ...FIELD.map((cell): Input => ({ do: 'use', at: cell })),
  { do: 'take', item: 'wheat_seeds' },
  ...FIELD.map((cell): Input => ({ do: 'use', at: cell })),
  // The roof is done, and the first night is the Shut Door's, which keeps the player awake. The field is
  // about the nights after it, so the night's quest is passed over.
  { do: 'check', what: 'the roof quest is done and the first night has begun', that: (p) => p.game.flags.is('quest.roof.done') },
  { do: 'run', name: 'pass over the first night', run: (p) => p.sys.quests.skipTo('leaftail') },
  ...night,
  { do: 'check', what: 'on the morning of day 2 every plant is at stage 2', that: (p) => p.game.clock.day === 2 && p.sys.crops.all().length === 6 && p.sys.crops.all().every((crop) => crop.state.stage === 2) },
  ...night,
  { do: 'check', what: 'on the morning of day 3 every plant is ripe', that: (p) => p.game.clock.day === 3 && p.sys.crops.all().every((crop) => crop.state.ripe) },
  ...night,
  ...FIELD.map((cell): Input => ({ do: 'hit', at: cell })),
];

const center = (p: Play): { x: number; y: number; z: number } => p.sys.region.place('grant.center').at;
const bedAt = (p: Play, dx: number, dz: number): boolean => p.sys.placeables.at(Math.floor(center(p).x) + dx, center(p).y, Math.floor(center(p).z) + dz)?.kind === 'bed';

export function wheatFacts(p: Play): Fact[] {
  return [
    ['it is day 4', p.game.clock.day === 4],
    [`the bag holds 12 wheat (it holds ${p.count('wheat')})`, p.count('wheat') === 12],
    ['the harvest was counted', p.game.flags.get('harvested.wheat') === 12],
    ['nothing is left in the ground', p.sys.crops.all().length === 0],
    ['three nights were slept', p.heard.filter((event) => event.name === 'slept').length === 3],
    ['a bed under a roof and a night in it finished the quest of the roof', p.game.flags.is('quest.roof.done')],
  ];
}

export const wheatThreeNights: Scenario = {
  name: 'wheat-three-nights',
  about: 'Wheat planted at dusk, watered and slept on for three nights, then harvested: the bag holds 12 wheat.',
  seed: 11,
  start: WHEAT_START,
  inputs: WHEAT_INPUTS,
  expect: wheatFacts,
};
