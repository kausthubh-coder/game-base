// The Build tab's three farms, built by hand on the flat land east of the mossy pond, in the quest Water uphill: a
// ditch dug from the pond with the spade, a gearling pit at one waterwheel, a terrace at another, and a bait field
// of carrots in the dark. Every part is set down with a click, as a player does. Each tag must then say what the
// Build tab says for the same layout, and a day and a night of play must drop their goods.
import type { FarmId } from '../content/ids.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

/** The ground is at y 21 here: a block on it is used at y 21, and a part stands at y 22. */
const G = 21;
const use = (x: number, z: number): Input => ({ do: 'use', at: { x, y: G, z } });
const near = (x: number, z: number): Input => ({ do: 'teleport', to: { x: x + 0.5, z: z + 0.5 } });
/** Sets one part down: in hand, then a click on the ground where it stands. */
const set = (item: Parameters<Play['take']>[0], x: number, z: number): Input[] => [{ do: 'take', item }, use(x, z)];
const farm = (p: Play, id: FarmId) => p.sys.farms.get(id);

/** The stream: a ditch east from the pond along z -230, from x 8 to x 17. */
const DITCH = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
/** The terrace's fields: six along the ditch (the mossy rocks take the rest of its bank), six round the sprinkler at 16, -233, whose seventh block is a step up the hill. */
const BY_DITCH: [number, number][] = [[9, -231], [10, -231], [14, -231], [15, -231], [17, -231], [15, -229]];
const BY_SPRINKLER: [number, number][] = [[15, -232], [17, -232], [15, -233], [17, -233], [15, -234], [16, -234]];
/** The bait field: eight carrots, four by two, in the dark south-west of the ditch. */
const CARROTS: [number, number][] = [[8, -236], [9, -236], [10, -236], [11, -236], [8, -235], [9, -235], [10, -235], [11, -235]];

const loose = (p: Play, item: string): number => p.sys.machines.loose().filter((g) => g.item === item).reduce((n, g) => n + g.count, 0);

export const THREE_FARMS_INPUTS: readonly Input[] = [
  // The stream first: the spade, from the pond's east edge outward. Each hole fills from the one before.
  near(8, -228),
  { do: 'take', item: 'spade' },
  ...DITCH.slice(0, 5).map((x) => use(x, -230)),
  near(14, -228),
  ...DITCH.slice(5).map((x) => use(x, -230)),
  { do: 'wait', seconds: 1 },
  { do: 'check', what: 'the ditch is full of water from end to end', that: (p) => DITCH.every((x) => p.sys.machines.hole(x, G, -230)?.wet === true) },

  // The gearling pit, as the Build tab's "With a pusher": the wheel, a line of fences, a dark pit, a pusher beside it.
  near(11, -228),
  // A wheel goes on the water's top: a click on the ditch's water.
  ...set('waterwheel', 11, -230),
  ...set('gear_shaft', 10, -230),
  ...[[9, -226], [10, -226], [12, -226], [13, -226], [14, -226]].flatMap(([x, z]) => set('fence', x, z)),
  { do: 'take', item: 'spade' },
  use(11, -227),
  near(9, -228),
  ...set('gear_shaft', 10, -229),
  ...set('gear_shaft', 10, -228),
  ...set('pusher', 10, -227),
  { do: 'wait', seconds: 3 },
  { do: 'check', what: 'the pit gives six springs a day, every gearling through', that: (p) => farm(p, 'spring')?.tag === '6 springs a day' && farm(p, 'spring')?.symptom === 'Every gearling goes through the pit, and walks home.' },

  // The terrace: a second wheel, a shaft up the field to a sprinkler, wheat along the ditch and round the sprinkler.
  near(13, -233),
  ...set('waterwheel', 16, -230),
  ...set('gear_shaft', 16, -231),
  ...set('gear_shaft', 16, -232),
  ...set('sprinkler', 16, -233),
  { do: 'take', item: 'hoe' },
  ...[...BY_DITCH, ...BY_SPRINKLER].map(([x, z]) => use(x, z)),
  { do: 'take', item: 'wheat_seeds' },
  ...[...BY_DITCH, ...BY_SPRINKLER].map(([x, z]) => use(x, z)),
  { do: 'wait', seconds: 3 },
  { do: 'check', what: 'the terrace waters twelve fields: 24 wheat a day', that: (p) => farm(p, 'field')?.tag === '24 wheat a day' && farm(p, 'field')?.symptom === 'Every field is wet and every sprinkler turns.' },

  // The bait field: eight dark carrots.
  near(10, -233),
  { do: 'take', item: 'hoe' },
  ...CARROTS.map(([x, z]) => use(x, z)),
  { do: 'take', item: 'carrot_seeds' },
  ...CARROTS.map(([x, z]) => use(x, z)),
  { do: 'wait', seconds: 3 },

  // A day at the pit, from where its springs fall, and then a night at the bait field.
  { do: 'teleport', to: { x: 4.5, z: -236.5 } },
  { do: 'wait', seconds: 50 },
  { do: 'check', what: 'six springs lie in and by the pit', that: (p) => loose(p, 'gear_spring') === 6 },
  { do: 'run', name: 'night falls', run: (p) => p.sys.time.setTimeOfDay(0.8) },
  { do: 'wait', seconds: 62 },
];

export const threeFarms: Scenario = {
  name: 'three-farms',
  about: 'The Build tab\'s gearling pit, terrace and bait field built by hand east of the pond: each tag says what the Build tab says, a day gives six springs and a night copper.',
  seed: 21,
  start: {
    quest: 'uphill',
    give: { spade: 1, hoe: 1, waterwheel: 2, gear_shaft: 6, pusher: 1, sprinkler: 1, fence: 8, wheat_seeds: 12, carrot_seeds: 8 },
  },
  inputs: THREE_FARMS_INPUTS,
  expect(p) {
    const bait = farm(p, 'copper');
    return [
      ['the bait field brings every burrower to the carrots', bait?.tag === '4 copper a day' && bait?.symptom === 'Every burrower comes up in your carrots.'],
      [`copper lies among the carrots after the night (${loose(p, 'copper')})`, loose(p, 'copper') >= 2],
      ['three farms are built and living', (['spring', 'field', 'copper'] as const).every((id) => p.game.flags.is(`farm.${id}.built`) && farm(p, id)?.living)],
      ['a wheel turns, which the quest step asks', p.game.flags.is('step.uphill.wheel')],
      ['the pit finished its quest step', p.game.flags.is('step.uphill.pit')],
    ];
  },
};
