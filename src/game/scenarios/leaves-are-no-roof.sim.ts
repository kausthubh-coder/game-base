// A tree's leaves are no roof. A bed under an oak with no block over it does not let the hero sleep, so one
// night under a tree cannot finish "A roof before dark" with no wood, no workbench and no roof
// (docs/bugs/2026-11-11-sleep-under-a-tree-finishes-the-roof-quest.md).
import { NO_ROOF_TOAST } from '../placeables/index.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

// Beside the oak at -44, 22, -222, west of the grant.
const BED = { x: -44, y: 21, z: -220 };

export const leavesAreNoRoof: Scenario = {
  name: 'leaves-are-no-roof',
  about: 'A bed under a tree, with no block over it, does not let the hero sleep.',
  seed: 23,
  start: { quest: 'roof', give: { bed: 1 } },
  inputs: [
    { do: 'teleport', to: { x: -43.5, y: 22, z: -217.5 } },
    { do: 'take', item: 'bed' },
    { do: 'use', at: BED },
    { do: 'check', what: 'the bed stands under the oak\'s leaves', that: (p) => p.sys.placeables.all().some((placed) => placed.kind === 'bed') && !p.world.openSky(BED.x, BED.y + 2, BED.z) },
    { do: 'wait', until: 'evening' },
    { do: 'interact' },
    { do: 'wait', seconds: 3 },
    { do: 'check', what: 'the hero did not sleep under the leaves', that: (p) => p.game.clock.day === 1 && !p.game.flags.is('quest.roof.done') },
    { do: 'check', what: 'the bed asked for a roof', that: (p) => p.said.at(-1) === NO_ROOF_TOAST },
  ],
  expect: (p) => [
    ['it is still the first day', p.game.clock.day === 1],
    ['the roof quest is not done', !p.game.flags.is('quest.roof.done')],
  ],
};
