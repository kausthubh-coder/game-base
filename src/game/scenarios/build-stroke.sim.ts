// Build mode: one stroke tills a field, one plants it, one waters it, and a line of fence goes down beside it.
// The bag is two seeds short, so the planting stops two cells early, and the fence is taken back and laid again.
import { blockId } from '../../content/blocks.ts';
import type { Cell } from '../play/inputs.sim.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const at = (dx: number, dz: number): Cell => ({ place: 'grant.center', dx, dz });
const TILLED = blockId('tilled_soil');

/** The field: four by three. The fence: six posts along its north side. */
const FIELD = { from: at(-2, -1), to: at(1, 1) };
const FENCE = { from: at(-3, -2), to: at(2, -2) };

const fences = (p: Play): number => p.sys.placeables.all().filter((placed) => placed.kind === 'fence').length;

export const buildStroke: Scenario = {
  name: 'build-stroke',
  about: 'In build mode a stroke tills twelve cells, ten seeds plant ten of them, a stroke waters them, and six fences go down, come back with undo and go down again.',
  seed: 12,
  start: { quest: 'roof', give: { hoe: 1, watering_can: 1, wheat_seeds: 10, fence: 8 } },
  inputs: [
    { do: 'teleport', to: { place: 'grant.center', dz: 4 } },
    { do: 'build', on: true },
    { do: 'take', item: 'hoe' },
    { do: 'stroke', ...FIELD, changes: 12 },
    { do: 'take', item: 'wheat_seeds' },
    { do: 'stroke', ...FIELD, changes: 10 },
    { do: 'take', item: 'watering_can' },
    { do: 'stroke', ...FIELD, changes: 12 },
    { do: 'take', item: 'fence' },
    { do: 'stroke', ...FENCE, changes: 6 },
    { do: 'check', what: 'six fences stand and two are left in the bag', that: (p) => fences(p) === 6 && p.count('fence') === 2 },
    { do: 'undo' },
    { do: 'check', what: 'undo took the six fences back into the bag', that: (p) => fences(p) === 0 && p.count('fence') === 8 },
    { do: 'stroke', ...FENCE, changes: 6 },
    // A second stroke over the same line has nothing left to do.
    { do: 'stroke', ...FENCE, changes: 0 },
    { do: 'build', on: false },
    { do: 'wait', seconds: 1 },
  ],
  expect(p) {
    const c = p.sys.region.place('grant.center').at;
    let tilled = 0;
    for (let dx = -2; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (p.world.getBlock(Math.floor(c.x) + dx, c.y - 1, Math.floor(c.z) + dz) === TILLED) tilled++;
    const crops = p.sys.crops.all();
    const row = p.sys.placeables.all().filter((placed) => placed.kind === 'fence');
    return [
      [`twelve cells are tilled (${tilled})`, tilled === 12],
      [`ten wheat grow (${crops.length}), all in wet soil`, crops.length === 10 && crops.every((crop) => crop.state.wet > 0)],
      ['no seed is left in the bag', p.count('wheat_seeds') === 0],
      ['six fences stand in one row north of the field', row.length === 6 && row.every((fence) => fence.z === Math.floor(c.z) - 2 && fence.y === c.y)],
      ['two fences are left in the bag', p.count('fence') === 2],
      ['build mode is off', !p.sys.build.active],
    ];
  },
};
