// The kitchen quest as the settlement plays it, with real inputs: Hobb and Dax come after scene 18, the hero
// makes an oven, a table, a cottage and a lamp at the workbench and sets them down, eats Hobb's first meal,
// and walks Hobb to the kitchen, where she says so. The camp becomes a homestead, and with a mossling pen by the
// pond living on Give the Heartstone holds 2.
import { blockId } from '../../content/blocks.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Cell, Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

/** A mossling pen by the pond as the field book draws it: a fence by the wild mossy stones, three of them roofed with thatch for shade. */
export function mossPen(p: Play): void {
  const rocks = p.sys.region.place('grant.rocks').at;
  const x = Math.floor(rocks.x), y = Math.floor(rocks.y), z = Math.floor(rocks.z);
  for (const [dx, dz] of [[-3, -1], [-3, 0], [-2, -3]]) p.game.world.setBlock(x + dx, y + 1, z + dz, blockId('thatch'));
  if (!p.sys.placeables.place('fence', x - 4, y, z - 2, 0)) throw new Error('could not set the pen\'s fence down');
  p.advance(3);
}

const at = (dx: number, dz: number): Cell => ({ place: 'grant.center', dx, dz });
const near = (dx: number, dz: number): Input => ({ do: 'teleport', to: { place: 'grant.center', dx, dz } });

export const settlementKitchen: Scenario = {
  name: 'settlement-kitchen',
  about: 'Hobb and Dax come; an oven and a table, a cottage and a lamp are made and set down; Hobb\'s first meal; Hobb walked to the kitchen; a homestead, and the Heartstone at 2.',
  seed: 31,
  start: { quest: 'kitchen', give: { plank: 80, fiber: 20, dirt: 20, moss_fiber: 4 } },
  inputs: [
    // Scene 18 starts as the hero comes to the grant stone, and the player clicks through it.
    { do: 'teleport', to: { place: 'grant.stone' } },
    { do: 'wait', seconds: 5, until: (p) => p.sys.talk.active },
    { do: 'talk' },
    { do: 'check', what: 'scene 18 played', that: (p) => p.game.flags.is('scene.18') },
    { do: 'wait', seconds: 2 },
    { do: 'check', what: 'Hobb and Dax live here now', that: (p) => p.sys.settlement.settlers().join() === 'hobb,dax' },
    near(2, -2),
    { do: 'make', recipe: 'workbench' },
    { do: 'take', item: 'workbench' },
    { do: 'use', at: at(2, 0) },
    ...['oven', 'prep_table', 'cottage', 'lantern'].map((recipe): Input => ({ do: 'make', recipe })),
    // Each thing turns its front to the hero and runs on away from them, so the hero walks up facing north.
    near(2, -2),
    { do: 'walk', to: { place: 'grant.center', dx: 2, dz: -6 }, within: 0.4 },
    { do: 'take', item: 'oven' },
    { do: 'use', at: at(2, -9) },
    { do: 'take', item: 'prep_table' },
    { do: 'use', at: at(5, -9) },
    near(-8, -2),
    { do: 'walk', to: { place: 'grant.center', dx: -8, dz: -6 }, within: 0.4 },
    { do: 'take', item: 'cottage' },
    { do: 'use', at: at(-8, -9) },
    { do: 'take', item: 'lantern' },
    { do: 'use', at: at(-3, -6) },
    { do: 'wait', seconds: 2 },
    { do: 'check', what: 'the kitchen and the beds are done', that: (p) => p.game.flags.is('step.kitchen.kitchen') && p.game.flags.is('step.kitchen.beds') },
    { do: 'check', what: 'Hobb has a bed under a roof, a meal and a lamp', that: (p) => { const n = p.sys.settlement.settler('hobb')!.needs; return n.bed && n.meal && n.lamp; } },
    // The oven faces the hero who set it down, south: its door is the block before its south side.
    { do: 'walk', to: { place: 'grant.center', dx: 3, dz: -6 }, within: 0.8 },
    { do: 'interact', prompt: 'Eat Hobb\'s cooking' },
    { do: 'check', what: 'the hero ate Hobb\'s first meal', that: (p) => p.game.flags.get('meal.day') === p.game.clock.day && p.game.flags.is('step.kitchen.meal') },
    // Hobb follows the hero from her door to the kitchen.
    { do: 'walk', to: { place: 'grant.center', dx: -6, dz: -4 }, within: 1 },
    { do: 'run', name: 'walk Hobb to the kitchen', run: (p) => { const why = p.sys.settlement.lead('hobb', 'kitchen'); if (why) throw new Error(why); } },
    { do: 'wait', seconds: 3 },
    {
      do: 'run', name: 'walk back to the oven, Hobb behind, until she takes the kitchen',
      run: (p) => {
        const c = p.sys.region.place('grant.center').at;
        const job = (): boolean => p.sys.settlement.settler('hobb')!.job === 'kitchen';
        if (!p.walkTo({ x: c.x + 3.5, y: c.y, z: c.z - 5.5 }, { within: 0.8, soft: true, seconds: 30, until: job }) && !job()) throw new Error('Hobb did not take the kitchen');
      },
    },
    // She says so in the dialogue box.
    { do: 'wait', seconds: 5, until: (p) => p.sys.talk.active },
    { do: 'check', what: 'Hobb says what a kitchen is for', that: (p) => p.sys.talk.current()?.text === 'A meal a day for everyone on this hill. That\'s what a kitchen\'s for.' },
    { do: 'talk' },
    { do: 'run', name: 'a mossling pen by the pond', run: mossPen },
    { do: 'wait', seconds: 1 },
  ],
  expect(p) {
    const flags = p.game.flags;
    return [
      ['the kitchen quest\'s building steps are done', ['step.kitchen.kitchen', 'step.kitchen.beds', 'step.kitchen.meal'].every((f) => flags.is(f))],
      ['Hobb keeps the kitchen, as the story remembers', flags.get('job.hobb') === 'kitchen' && flags.get('choice.hobb') === 'kitchen'],
      ['the camp is a homestead', p.sys.settlement.step() === 'homestead'],
      ['the pen is a living farm on Give', p.sys.farms.get('moss')?.living === true && p.sys.farms.get('moss')?.mode === 'give'],
      [`the Heartstone holds 2 (${p.sys.hall.heart().level})`, p.sys.hall.heart().level === 2 && flags.get('heartstone') === 2],
      ['the Custodian said its line for 2', p.said.some((line) => line.startsWith('The Custodian: A kitchen.'))],
    ];
  },
};
