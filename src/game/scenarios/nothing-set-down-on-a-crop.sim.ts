// The cell over a growing crop stays open: a fence, a workbench and a plank clicked onto planted soil are
// all refused, and a fence stroke in build mode changes nothing. A bot found a bed going down on wheat
// (docs/bugs/2026-11-11-thing-set-down-on-a-crop.md).
import type { Cell } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const SOIL: Cell = { place: 'grant.center' };

export const nothingSetDownOnACrop: Scenario = {
  name: 'nothing-set-down-on-a-crop',
  about: 'A fence, a workbench and a plank clicked onto planted soil are refused, in build mode too, and the wheat keeps its open cell.',
  seed: 17,
  start: { quest: 'roof', give: { hoe: 1, wheat_seeds: 1, fence: 1, workbench: 1, plank: 1 } },
  inputs: [
    { do: 'teleport', to: { place: 'grant.center', dz: 3 } },
    { do: 'take', item: 'hoe' },
    { do: 'use', at: SOIL },
    { do: 'take', item: 'wheat_seeds' },
    { do: 'use', at: SOIL },
    { do: 'check', what: 'wheat grows on the soil', that: (p) => p.sys.crops.all().length === 1 },
    { do: 'take', item: 'fence' },
    { do: 'use', at: SOIL, fails: true },
    { do: 'take', item: 'workbench' },
    { do: 'use', at: SOIL, fails: true },
    { do: 'take', item: 'plank' },
    { do: 'use', at: SOIL, fails: true },
    { do: 'build', on: true },
    { do: 'take', item: 'fence' },
    { do: 'stroke', from: SOIL, to: SOIL, changes: 0 },
    { do: 'build', on: false },
    { do: 'wait', seconds: 1 },
  ],
  expect(p) {
    const crop = p.sys.crops.all()[0];
    return [
      ['the wheat still grows', p.sys.crops.all().length === 1],
      ['the cell over it is open', crop !== undefined && p.world.getBlock(crop.x, crop.y + 1, crop.z) === 0],
      ['nothing was set down', p.sys.placeables.all().length === 0],
      ['the fence, the workbench and the plank are still in the bag', p.count('fence') === 1 && p.count('workbench') === 1 && p.count('plank') === 1],
    ];
  },
};
