// From four logs to a fenced plot with a ditch: planks and a workbench by hand, fences and posts at the bench, a
// spade by hand, and a ditch dug from water along tilled soil.
import { blockId } from '../../content/blocks.ts';
import type { Cell, Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const at = (dx: number, dz: number): Cell => ({ place: 'grant.center', dx, dz });
const SOIL: readonly Cell[] = [at(-1, -1), at(0, -1), at(1, -1)];
const times = (count: number, input: Input): Input[] => new Array<Input>(count).fill(input);

export const workbenchCrafting: Scenario = {
  name: 'workbench-crafting',
  about: 'Four logs become planks and a workbench by hand; at the bench, eight fences and four posts; a spade digs a ditch from water along three tilled blocks.',
  seed: 13,
  start: { quest: 'ground', give: { oak_log: 4, fiber: 2, hoe: 1 } },
  inputs: [
    { do: 'teleport', to: { place: 'grant.center', dz: 3 } },
    ...times(4, { do: 'make', recipe: 'plank' }),
    { do: 'make', recipe: 'workbench' },
    // A fence needs a workbench standing within five blocks. One in the bag is not enough.
    { do: 'make', recipe: 'fence', fails: true },
    { do: 'take', item: 'workbench' },
    { do: 'use', at: at(3, 1) },
    ...times(2, { do: 'make', recipe: 'fence' }),
    ...times(2, { do: 'make', recipe: 'post' }),
    { do: 'make', recipe: 'spade' },
    // The fiber is spent.
    { do: 'make', recipe: 'fence', fails: true },
    { do: 'take', item: 'hoe' },
    ...SOIL.map((cell): Input => ({ do: 'use', at: cell })),
    // A pool at the west end of the soil's south side, and a ditch from it that runs along that side.
    { do: 'run', name: 'a pool beside the field', run: (p) => {
      const c = p.sys.region.place('grant.center').at;
      p.world.setBlock(Math.floor(c.x) - 2, c.y - 1, Math.floor(c.z), blockId('water'));
    } },
    { do: 'take', item: 'spade' },
    { do: 'use', at: at(-1, 0) },
    { do: 'use', at: at(0, 0) },
    { do: 'use', at: at(1, 0) },
    { do: 'wait', seconds: 1 },
    { do: 'check', what: 'the ditch filled from the pool', that: (p) => [-1, 0, 1].every((dx) => { const c = p.sys.region.place('grant.center').at; return p.world.getBlock(Math.floor(c.x) + dx, c.y - 1, Math.floor(c.z)) === blockId('water'); }) },
  ],
  expect(p) {
    const crafted = p.heard.filter((event) => event.name === 'item.crafted').length;
    return [
      ['the bag holds 8 fences and 4 posts', p.count('fence') === 8 && p.count('post') === 4],
      ['the bag holds 4 planks and no log or fiber', p.count('plank') === 4 && p.count('oak_log') + p.count('fiber') === 0],
      ['a workbench stands', p.sys.placeables.all().some((placed) => placed.kind === 'workbench')],
      ['the spade dug three holes, and water filled them: a ditch', (p.sys.machines.holes() ?? []).filter((h) => h.wet).length === 3],
      [`ten things were crafted (${crafted})`, crafted === 10],
    ];
  },
};
