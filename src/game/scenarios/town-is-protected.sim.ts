// The town's land is not the player's: on the grass of the square a plank does not go down, the grass does
// not come up, the hoe tills nothing, and a stroke in build mode changes no cell.
import { blockId } from '../../content/blocks.ts';
import { cellOf, type Cell } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const at = (dx: number, dz: number): Cell => ({ place: 'town.square', dx, dz });
/** A block of grass at the edge of the square's paving. */
const GRASS = at(3, 2);
const grass = blockId('grass');

export const townIsProtected: Scenario = {
  name: 'town-is-protected',
  about: 'On the grass of the town square nothing can be placed, dug, tilled or built, and the game says the land belongs to the town.',
  seed: 16,
  start: { quest: 'roof', give: { plank: 2, hoe: 1, fence: 2 } },
  inputs: [
    { do: 'teleport', to: 'town.square' },
    // Grass: anywhere else a hand digs it and a hoe tills it. Here only the town's rule stands in the way.
    { do: 'check', what: 'the block is grass on the town\'s land', that: (p) => { const c = cellOf(p, GRASS); return p.world.getBlock(c.x, c.y, c.z) === grass && p.sys.region.isProtected(c.x, c.y, c.z); } },
    { do: 'take', item: 'plank' },
    { do: 'use', at: GRASS, fails: true },
    { do: 'check', what: 'the game said the land belongs to the town', that: (p) => p.said.at(-1) === 'This belongs to the town.' },
    { do: 'dig', at: GRASS, fails: true },
    { do: 'take', item: 'fence' },
    { do: 'use', at: GRASS, fails: true },
    { do: 'take', item: 'hoe' },
    { do: 'use', at: GRASS, fails: true },
    { do: 'build', on: true },
    { do: 'stroke', from: at(2, 2), to: at(4, 3), changes: 0 },
    { do: 'take', item: 'fence' },
    { do: 'stroke', from: at(2, 2), to: at(4, 2), changes: 0 },
    { do: 'build', on: false },
  ],
  expect(p) {
    const c = cellOf(p, GRASS);
    return [
      ['the bag still holds the 2 planks and the 2 fences', p.count('plank') === 2 && p.count('fence') === 2],
      ['nothing was set down', p.sys.placeables.all().length === 0 && p.world.getBlock(c.x, c.y + 1, c.z) === 0],
      ['the grass is still grass', p.world.getBlock(c.x, c.y, c.z) === grass],
      ['nothing was tilled or planted', p.sys.crops.all().length === 0 && (p.sys.crops.soil?.() ?? []).length === 0],
    ];
  },
};
