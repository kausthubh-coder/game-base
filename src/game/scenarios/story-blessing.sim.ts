// The story director plays a quest's scenes as the player reaches them: the blessing at the grant stone, the
// pump's choice right after it, and the Custodian's thoughts in the Hall. Nobody calls a conversation by hand.
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const talking = (p: Play): boolean => p.sys.talk.active;
const said = (p: Play, scene: number): boolean => p.heard.some((event) => event.name === 'scene.played' && (event.data as { scene: number }).scene === scene);

export const storyBlessing: Scenario = {
  name: 'story-blessing',
  about: 'At the grant stone the blessing plays by itself, then the pump in its crate; left in its crate, the Custodian says so in the Hall that evening, and the quest is done.',
  seed: 31,
  start: { quest: 'blessing' },
  inputs: [
    { do: 'teleport', to: { place: 'grant.stone', dz: 2 } },
    { do: 'wait', seconds: 5, until: talking },
    { do: 'check', what: 'the blessing is a film', that: (p) => p.sys.talk.current()?.kind === 'film' && p.sys.talk.current()?.scene === 16 },
    { do: 'talk' },
    { do: 'check', what: 'scene 16 has played', that: (p) => p.game.flags.is('scene.16') && said(p, 16) },
    { do: 'wait', seconds: 5, until: talking },
    { do: 'check', what: 'the pump is offered: set it running or leave it', that: (p) => p.sys.talk.current()?.choices.length === 2 },
    // The second choice: leave it in its crate.
    { do: 'talk', choice: 1 },
    { do: 'check', what: 'the choice is remembered', that: (p) => p.game.flags.get('choice.pump') === 'crated' },
    // The Custodian's scene starts as the player comes into the Hall.
    { do: 'teleport', to: { place: 'hall.door' } },
    { do: 'wait', seconds: 5, until: talking },
    { do: 'check', what: 'it is scene 17, as talk', that: (p) => p.sys.talk.current()?.scene === 17 && p.sys.talk.current()?.kind === 'talk' },
    { do: 'run', name: 'click through the Custodian', run: (p) => { p.talkThrough(); } },
    { do: 'wait', seconds: 1 },
  ],
  expect(p) {
    const lines = p.sys.talk.log().map((entry) => entry.text);
    return [
      ['the Custodian approved of the crate', lines.includes('You left her gift in its crate. Good. I cannot tell you why. Good.')],
      ['and did not talk about a hum', !lines.some((line) => line.includes('Nothing honest hums'))],
      ['it rides in the pack now', p.game.flags.is('custodian.pack')],
      ['the blessing is done and Hobb is on her way', p.game.flags.is('quest.blessing.done') && p.game.flags.get('quest.kitchen.step') === 'gate'],
      ['the player is free', !p.game.player.busy],
    ];
  },
};
