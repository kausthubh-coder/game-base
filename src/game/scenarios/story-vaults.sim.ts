// The three vaults open together after the first Echo, the tracker follows the one the player picks, and Calla
// waits at the door of whichever vault is cleared first.
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const open = (p: Play, quest: string): boolean => p.game.flags.is(`quest.${quest}.started`) && !p.game.flags.is(`quest.${quest}.done`);

export const storyVaults: Scenario = {
  name: 'story-vaults',
  about: 'After the stone the pump, the gallery and the seeds are open at once; picking the seeds moves the tracker, and clearing the Seed Vault first brings Calla and her seal there.',
  seed: 32,
  start: { quest: 'pump' },
  inputs: [
    { do: 'wait', seconds: 1 },
    { do: 'check', what: 'all three vaults are open', that: (p) => open(p, 'pump') && open(p, 'gallery') && open(p, 'seeds') },
    { do: 'check', what: 'the tracker follows the first in the act', that: (p) => p.sys.quests.tracked()?.id === 'pump' },
    { do: 'run', name: 'pick the seeds', run: (p) => p.sys.quests.track?.('seeds') },
    { do: 'check', what: 'the tracker follows the seeds', that: (p) => p.sys.quests.tracked()?.id === 'seeds' },
    { do: 'run', name: 'clear the Seed Vault', run: (p) => p.game.flags.set('vault.seedvault.cleared', true) },
    { do: 'wait', seconds: 5, until: (p) => p.sys.talk.active },
    { do: 'check', what: 'Calla is at the door', that: (p) => p.sys.talk.current()?.npc === 'calla' && p.sys.talk.current()?.scene === 25 },
    // Say nothing.
    { do: 'talk', choice: 1 },
  ],
  expect: (p) => [
    ['scene 25 has played, once', p.game.flags.is('scene.25') && p.heard.filter((event) => event.name === 'scene.played').length === 1],
    ['the stone was kept', p.game.flags.get('choice.calla') === 'kept'],
    ['Calla said so in her ledger', p.sys.talk.log().at(-1)?.text === '(writing) "Found nothing." (a look at your pack) Very well. Nothing.'],
    ['Calla stood in for the scene and left with it', ![...p.game.actors.keys()].some((id) => id.startsWith('stage:'))],
  ],
};
