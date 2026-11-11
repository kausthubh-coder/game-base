// The town's land is not the player's: in the square a plank does not go down, the paving does not come up,
// the hoe tills nothing, and a stroke in build mode changes no cell.
import type { Cell } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const at = (dx: number, dz: number): Cell => ({ place: 'town.square', dx, dz });

export const townIsProtected: Scenario = {
  name: 'town-is-protected',
  about: 'In the town square nothing can be placed, broken, tilled or built, and the game says the land belongs to the town.',
  seed: 16,
  start: { quest: 'roof', give: { plank: 2, hoe: 1, fence: 2 } },
  inputs: [
    { do: 'teleport', to: 'town.square' },
    { do: 'check', what: 'the square is the town\'s land', that: (p) => { const c = p.sys.region.place('town.square').at; return p.sys.region.isProtected(Math.floor(c.x) + 1, c.y, Math.floor(c.z) + 1); } },
    { do: 'take', item: 'plank' },
    { do: 'use', at: at(1, 1), fails: true },
    { do: 'check', what: 'the game said the land belongs to the town', that: (p) => p.said.at(-1) === 'This belongs to the town.' },
    { do: 'dig', at: at(1, 1), fails: true },
    { do: 'take', item: 'fence' },
    { do: 'use', at: at(1, 1), fails: true },
    { do: 'take', item: 'hoe' },
    { do: 'use', at: at(1, 1), fails: true },
    { do: 'build', on: true },
    { do: 'stroke', from: at(1, 1), to: at(3, 2), changes: 0 },
    { do: 'take', item: 'fence' },
    { do: 'stroke', from: at(1, 1), to: at(3, 1), changes: 0 },
    { do: 'build', on: false },
  ],
  expect(p) {
    const c = p.sys.region.place('town.square').at;
    const x = Math.floor(c.x) + 1, z = Math.floor(c.z) + 1;
    return [
      ['the bag still holds the 2 planks and the 2 fences', p.count('plank') === 2 && p.count('fence') === 2],
      ['nothing was set down', p.sys.placeables.all().length === 0 && p.world.getBlock(x, c.y, z) === 0],
      ['the ground is still there', p.world.getBlock(x, c.y - 1, z) !== 0],
      ['nothing was tilled or planted', p.sys.crops.all().length === 0 && (p.sys.crops.soil?.() ?? []).length === 0],
    ];
  },
};
