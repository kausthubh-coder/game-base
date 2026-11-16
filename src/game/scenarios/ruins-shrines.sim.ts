// The first Echo, the shrines and the small ruins played by the rules: the dull stone under the mural, the oak
// shrine and its pick, the stones of the sunk tower and the forest stair, the mill's old brass after its gearling,
// and the watch post under Calla's seal.
import { FLAG } from '../content/flags.ts';
import type { Scenario } from '../play/scenario.sim.ts';
import { pointOf } from '../ruins/index.sim.ts';

export const ruinsShrines: Scenario = {
  name: 'ruins-shrines',
  about: 'The dull stone under the mural plays the first Echo, the oak shrine gives the heart you pick, and the small ruins give a stone, old brass and a look through Calla\'s seal.',
  seed: 24,
  start: { quest: 'echo' },
  inputs: [
    { do: 'run', name: 'settled in', run: (p) => { p.advance(0.5); p.talkThrough(); } },
    // The first Echo, from the stone itself.
    { do: 'teleport', to: pointOf('stoneHall') },
    { do: 'wait', seconds: 3 },
    { do: 'check', what: 'walking to the stone does not play its memory', that: (p) => !p.sys.talk.active && !p.game.flags.is(FLAG.scene(24)) },
    { do: 'wait', seconds: 0.2, until: (p) => p.sys.talk.active || p.prompt() === 'Touch the dull stone' },
    { do: 'interact', prompt: 'Touch the dull stone' },
    { do: 'wait', seconds: 0.1 },
    { do: 'check', what: 'the first Echo plays', that: (p) => p.sys.talk.current()?.scene === 24 },
    { do: 'run', name: 'watched', run: (p) => p.talkThrough() },
    { do: 'check', what: 'the stone is remembered', that: (p) => p.game.flags.is(FLAG.memory('hall')) },
    { do: 'run', name: 'the Custodian marks the vaults', run: (p) => { p.advance(1.5); p.talkThrough(); } },
    { do: 'interact', prompt: 'Touch the stone again' },
    { do: 'wait', seconds: 0.1 },
    { do: 'check', what: 'one more line from the same moment', that: (p) => (p.sys.talk.log().at(-1)?.text ?? '').length > 0 && p.sys.talk.active },
    { do: 'run', name: 'heard', run: (p) => p.talkThrough() },
    // The oak shrine.
    { do: 'teleport', to: { place: 'shrine-oak', dz: 2 } },
    { do: 'wait', seconds: 0.2 },
    { do: 'run', name: 'its health before', run: (p) => p.game.flags.set('test.health', p.sys.fights.hero().maxHealth) },
    { do: 'interact', prompt: 'Restore the shrine' },
    { do: 'check', what: 'the shrine asks heart or stamina', that: (p) => p.heard.some((e) => e.name === 'shrine.asked') },
    { do: 'run', name: 'pick a heart', run: (p) => p.sys.ruins.restore!('shrine-oak', 'heart') },
    { do: 'wait', seconds: 0.2 },
    { do: 'check', what: 'the shrine is restored', that: (p) => p.sys.ruins.shrine('shrine-oak') === 'heart' && p.game.flags.is(FLAG.step('echo', 'shrine')) && p.prompt() === null },
    { do: 'check', what: 'the hero has more health', that: (p) => p.sys.fights.hero().maxHealth > Number(p.game.flags.get('test.health')) },
    // The sunk tower's stone.
    { do: 'teleport', to: { place: 'ruin-tower', dx: 2, dz: 1 } },
    { do: 'wait', seconds: 0.2 },
    { do: 'interact', prompt: 'Touch the stone' },
    { do: 'wait', seconds: 14 },
    { do: 'check', what: 'the tower remembers', that: (p) => p.game.flags.is(FLAG.memory('ruin-tower')) && p.sys.ruins.state('ruin-tower') === 'cleared' && p.said.some((s) => s.includes('counting boats')) },
    // The mill: its gearling first.
    { do: 'teleport', to: { place: 'ruin-mill', dz: 2 } },
    { do: 'wait', seconds: 0.2 },
    { do: 'check', what: 'nothing to take while its gearling stands', that: (p) => p.prompt() !== 'Take the old brass' },
    { do: 'run', name: 'the gearling is beaten', run: (p) => p.game.flags.set(FLAG.fightWon(6), true) },
    { do: 'run', name: 'the bag has room', run: (p) => p.sys.inventory.remove('old_brass', p.count('old_brass')) },
    { do: 'interact', prompt: 'Take the old brass' },
    { do: 'check', what: 'old brass', that: (p) => p.count('old_brass') === 2 && p.prompt() === null },
    // The watch post.
    { do: 'teleport', to: { place: 'ruin-post', dz: 2 } },
    { do: 'wait', seconds: 0.2 },
    { do: 'interact', prompt: 'Look through the slit' },
    { do: 'wait', seconds: 8 },
  ],
  expect: (p) => [
    ['the first Echo was played from the stone under the mural', p.game.flags.is(FLAG.scene(24)) && p.game.flags.is(FLAG.memory('hall'))],
    ['the oak shrine gave a heart', p.game.flags.get(FLAG.shrine('shrine-oak')) === 'heart'],
    ['the tower\'s stone was remembered', p.game.flags.is(FLAG.memory('ruin-tower'))],
    ['the watch post is under Calla\'s seal', p.sys.ruins.state('ruin-post') === 'sealed' && p.said.some((s) => s.includes('Order\'s engine'))],
  ],
};
