// From four logs to a fenced, watered plot: planks and a workbench by hand, fences and a sprinkler at the
// bench, and the sprinkler keeping tilled soil wet for longer than one watering lasts.
import type { Cell, Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const at = (dx: number, dz: number): Cell => ({ place: 'grant.center', dx, dz });
const SOIL: readonly Cell[] = [at(-1, -1), at(0, -1), at(1, -1)];
const times = (count: number, input: Input): Input[] => new Array<Input>(count).fill(input);

export const workbenchCrafting: Scenario = {
  name: 'workbench-crafting',
  about: 'Four logs become planks and a workbench by hand; at the bench, eight fences and a sprinkler; the sprinkler keeps three tilled blocks wet for 200 seconds.',
  seed: 13,
  start: { quest: 'roof', give: { oak_log: 4, fiber: 2, moss_tuft: 2, hoe: 1 } },
  inputs: [
    { do: 'teleport', to: { place: 'grant.center', dz: 3 } },
    ...times(4, { do: 'make', recipe: 'plank' }),
    { do: 'make', recipe: 'workbench' },
    // A fence needs a workbench standing within five blocks. One in the bag is not enough.
    { do: 'make', recipe: 'fence', fails: true },
    { do: 'take', item: 'workbench' },
    { do: 'use', at: at(3, 1) },
    ...times(2, { do: 'make', recipe: 'fence' }),
    { do: 'make', recipe: 'sprinkler' },
    // The fiber and the tufts are spent.
    { do: 'make', recipe: 'fence', fails: true },
    { do: 'make', recipe: 'sprinkler', fails: true },
    { do: 'take', item: 'hoe' },
    ...SOIL.map((cell): Input => ({ do: 'use', at: cell })),
    { do: 'take', item: 'sprinkler' },
    { do: 'use', at: at(0, 0) },
    { do: 'wait', seconds: 1 },
    { do: 'check', what: 'the sprinkler wet the three tilled blocks at once', that: (p) => (p.sys.crops.soil?.() ?? []).filter((soil) => soil.wet > 0).length === 3 },
    // One watering lasts 180 seconds. The sprinkler runs every 20.
    { do: 'wait', seconds: 200 },
  ],
  expect(p) {
    const wet = (p.sys.crops.soil?.() ?? []).filter((soil) => soil.wet > 0).length;
    const crafted = p.heard.filter((event) => event.name === 'item.crafted').length;
    return [
      ['the bag holds 8 fences', p.count('fence') === 8],
      ['the bag holds 4 planks and no log, fiber or tuft', p.count('plank') === 4 && p.count('oak_log') + p.count('fiber') + p.count('moss_tuft') === 0],
      ['a workbench and a sprinkler stand', ['sprinkler', 'workbench'].every((kind) => p.sys.placeables.all().some((placed) => placed.kind === kind)) && p.count('sprinkler') === 0],
      [`three blocks of soil are still wet after 200 seconds (${wet})`, wet === 3],
      [`eight things were crafted (${crafted})`, crafted === 8],
      ['setting the workbench down moved the roof quest to its shelter step', p.game.flags.get('quest.roof.step') === 'shelter'],
    ];
  },
};
