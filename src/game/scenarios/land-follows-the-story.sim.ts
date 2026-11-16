// The land follows the story (src/game/region/story.sim.ts): the Order relights the High Road over your land with
// scene 23, and the grass under it goes grey; the brass pumps come out of Hollowmere's fields as the queen's ledger
// fills, and the road goes dark when it is full; the grey forest turns green once the Stag is free; your plot's
// green reaches further as the Heartstone rises. Each is set by the flag its own system writes.
import { FLAG } from '../content/flags.ts';
import { blightAt } from '../region/greenhollow.sim.ts';
import { readLandState } from '../region/story.sim.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const land = (p: Play) => readLandState(p.game.flags);
/** How grey the grass is 12 blocks south of the lit arches, and in the boar's clearing in the grey forest. */
const underArches = (p: Play): number => { const a = p.sys.region.place('arches').at, s = land(p); return blightAt(Math.floor(a.x), Math.floor(a.z) + 12, s.relit, s.healed, s.pumps); };
const inGreyWood = (p: Play): number => { const a = p.sys.region.place('boar').at, s = land(p); return blightAt(Math.floor(a.x), Math.floor(a.z), s.relit, s.healed, s.pumps); };
const set = (flag: string, value: boolean | number = true) => ({ do: 'run' as const, name: `set ${flag}`, run: (p: Play) => p.game.flags.set(flag, value) });

export const landFollowsTheStory: Scenario = {
  name: 'land-follows-the-story',
  about: 'The relit road greys the land under it, the pumps come out as the ledger fills and the road goes dark, the grey wood heals after the Stag, and your plot greens further as the Heartstone rises.',
  seed: 23,
  start: { quest: 'count' },
  inputs: [
    { do: 'wait', seconds: 1 },
    { do: 'check', what: 'before scene 23 the stretch over your land is dark and its grass green; six pumps stand', that: (p) => !land(p).relit && underArches(p) < 0.2 && land(p).pumps === 6 },
    set(FLAG.scene(23)),
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'the Order has lit the road, and the grass under it is grey', that: (p) => land(p).relit && p.game.flags.get('road.relit') === true && underArches(p) > 0.5 },
    set(FLAG.ledgerFilled('granary')),
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'one section filled: five pumps stand, the road still glows', that: (p) => land(p).pumps === 5 && land(p).relit },
    set(FLAG.ledgerFilled('mill')),
    set(FLAG.ledgerFilled('lamphouse')),
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'three sections filled: two pumps stand', that: (p) => land(p).pumps === 2 },
    set(FLAG.ledgerFilled('wheelwright')),
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'the ledger is full: no pump stands, the road is dark, its grass green again', that: (p) => land(p).pumps === 0 && !land(p).relit && underArches(p) < 0.2 },
    { do: 'check', what: 'the grey forest is grey', that: (p) => inGreyWood(p) > 0.8 && !land(p).healed },
    set(FLAG.fightWon(12)),
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'the Stag is free, and the grey forest has its colour back', that: (p) => land(p).healed && inGreyWood(p) < 0.05 },
    set(FLAG.heartstone, 4),
    { do: 'wait', seconds: 0.5 },
  ],
  expect: (p) => [
    ['your plot greens 11 blocks round what you tend at a Heartstone of 4', land(p).green === 11],
    ['the land\'s flags are what the region wrote', p.game.flags.get('land.pumps') === 0 && p.game.flags.get('land.healed') === true],
  ],
};
