// The leaftail: a hero who runs at it startles it, and one who walks softly and holds out three berries bonds
// it. From then on it follows.
import { distance2d } from '../move.sim.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const pet = (p: Play) => p.sys.pets.all()[0];
const count = (p: Play, name: string): number => p.heard.filter((event) => event.name === name).length;

export const befriendAPet: Scenario = {
  name: 'befriend-a-pet',
  about: 'Running at the leaftail startles it. Three berries held out after a soft walk bond it, with a click and with E, and it follows the hero.',
  seed: 15,
  start: { quest: 'leaftail', give: { berry: 4 } },
  inputs: [
    { do: 'teleport', to: { place: 'dead.garden', dx: 14 } },
    { do: 'wait', seconds: 1 },
    // A run of nine blocks, into the garden. The leaftail backs off as long as it is run at, so the run is short.
    { do: 'walk', to: { place: 'dead.garden', dx: 5 } },
    { do: 'check', what: 'a run toward it startled it and it trusts nobody yet', that: (p) => count(p, 'pet.startled') >= 1 && pet(p).trust === 0 },
    // It will not eat for 15 seconds after a fright.
    { do: 'wait', seconds: 16 },
    { do: 'feed', pet: 'leaftail' },
    { do: 'feed', pet: 'leaftail', by: 'key' },
    { do: 'check', what: 'two berries do not bond it', that: (p) => pet(p).trust === 2 && !pet(p).bonded },
    { do: 'feed', pet: 'leaftail' },
    { do: 'walk', to: { place: 'dead.garden', dx: 16, dz: 6 } },
    { do: 'wait', seconds: 4 },
  ],
  expect(p) {
    const one = pet(p);
    return [
      ['the leaftail is bonded, and the flag says so', one.bonded && one.trust === 3 && p.game.flags.is('pet.leaftail.bonded')],
      ['it is the companion', p.sys.pets.companion()?.id === one.id],
      [`it followed the hero (${distance2d(one.pos, p.game.player.pos).toFixed(1)} blocks away)`, distance2d(one.pos, p.game.player.pos) <= 4],
      ['it ate three berries and one is left', count(p, 'pet.fed') === 3 && p.count('berry') === 1],
      ['it bonded once', count(p, 'pet.bonded') === 1],
      ['the quest moved on to showing it', p.game.flags.get('quest.leaftail.step') === 'show'],
    ];
  },
};
