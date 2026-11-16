// The first dinner of the act, in the quest of the echo: Hobb, Dax and Gus live here, a cottage and a dinner
// table stand, and that evening Gus and Hobb ask. The hero sits down and grants Hobb her river view: ten hearts,
// the story's choice, and Gus's one line. A save and a load before dinner keep everyone where they were.
import type { Cell, Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';
import { HEARTS, SETTLER } from '../content/people.ts';

const at = (dx: number, dz: number): Cell => ({ place: 'grant.center', dx, dz });
const north = (dx: number, dz: number): Input[] => [
  { do: 'teleport', to: { place: 'grant.center', dx, dz: dz + 4 } },
  { do: 'walk', to: { place: 'grant.center', dx, dz }, within: 0.4 },
];

export const settlementDinner: Scenario = {
  name: 'settlement-dinner',
  about: 'Hobb, Dax and Gus at home; a cottage, an oven and table, a lamp and a dinner table; that evening Gus and Hobb ask, Hobb is granted, Gus says his line; a reload before dinner.',
  seed: 32,
  start: { quest: 'echo', give: { plank: 90, fiber: 20, dirt: 20, moss_fiber: 4 } },
  inputs: [
    { do: 'run', name: 'Hobb, Dax and Gus come home', run: (p) => { p.game.flags.set('scene.18', true); p.game.flags.set('fight.5.won', true); } },
    { do: 'wait', seconds: 2 },
    ...north(2, -2),
    { do: 'make', recipe: 'workbench' },
    { do: 'take', item: 'workbench' },
    { do: 'use', at: at(2, 0) },
    ...['oven', 'prep_table', 'cottage', 'lantern', 'dinner_table'].map((recipe): Input => ({ do: 'make', recipe })),
    ...north(2, -6),
    { do: 'take', item: 'oven' },
    { do: 'use', at: at(2, -9) },
    { do: 'take', item: 'prep_table' },
    { do: 'use', at: at(5, -9) },
    ...north(-8, -6),
    { do: 'take', item: 'cottage' },
    { do: 'use', at: at(-8, -9) },
    { do: 'take', item: 'lantern' },
    { do: 'use', at: at(-3, -6) },
    ...north(-1, 2),
    { do: 'take', item: 'dinner_table' },
    { do: 'use', at: at(-1, -1) },
    { do: 'reload' },
    { do: 'wait', until: 'evening' },
    { do: 'wait', seconds: 2 },
    { do: 'check', what: 'dinner is on the table', that: (p) => p.said.includes('Dinner is on the table.') },
    // The table faces south, toward the hero who set it down: its door is the block before its south side.
    { do: 'walk', to: { place: 'grant.center', dx: 0, dz: 1 }, within: 0.6 },
    { do: 'interact', prompt: 'Sit down to dinner' },
    { do: 'check', what: 'Gus and Hobb ask', that: (p) => p.sys.settlement.dinner()?.asks.map((a) => a.who).join() === 'gus,hobb' },
    { do: 'run', name: 'grant Hobb her river view', run: (p) => { if (p.sys.settlement.grant('hobb') !== SETTLER.gus.ask!.other) throw new Error('Gus did not say his line'); } },
    { do: 'wait', seconds: 1 },
  ],
  expect(p) {
    const flags = p.game.flags;
    return [
      [`ten hearts for the ask (${String(flags.get('hearts'))})`, flags.get('hearts') === HEARTS.dinner],
      ['the story remembers Hobb\'s river view', flags.get('choice.dinner') === 'hobb' && flags.is('dinner.hobb') && !flags.is('dinner.gus')],
      ['dinner.asked and dinner.granted were sent', p.heard.some((e) => e.name === 'dinner.asked') && p.heard.some((e) => e.name === 'dinner.granted')],
      ['Hobb, Dax and Gus live here, and Gus sleeps in the cottage\'s third bed', p.sys.settlement.settler('gus')?.home?.residents.join() === 'hobb,dax,gus'],
      ['Gus has his bed, so the count quest\'s step is done', flags.is('step.count.gus')],
    ];
  },
};
