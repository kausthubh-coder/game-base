// The world's fights, played by the rules with the rule-made player in the hero's place: fight 2's thistlehog
// at night on the plot with Dax, fight 4's boar out of the Mark's reach, and the Sluice Keeper in its room. Each
// is started by walking to its place with its quest step open, as a player would.
import { FLAG } from '../content/flags.ts';
import type { FightNumber } from '../content/ids.ts';
import { QUESTS, satisfy } from '../content/quests.ts';
import { keeperRoom } from '../fight/keepers.sim.ts';
import { armingSteps, fightPlace } from '../fights/index.sim.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';
import { apply } from '../quests/rules.sim.ts';

/** Opens fight n's step: the steps before it in its quest done by their flags. */
const open = (n: FightNumber): Input => ({
  do: 'run',
  name: `the steps before fight ${n} are done`,
  run(p: Play) {
    const a = armingSteps(n)!;
    for (const step of QUESTS.find((q) => q.id === a.quest)!.steps) {
      if (a.steps.includes(step.id)) break;
      for (const effect of satisfy(step.done)) apply(p.game, effect);
      p.advance(0.2);
    }
    // The story director plays the fight's scene as its step opens (scene 19 before fight 2): hear it out.
    p.advance(0.5);
    p.talkThrough();
  },
});

const near = (n: FightNumber, dz: number): Input => {
  const at = fightPlace(n);
  return { do: 'teleport', to: { x: at.x, z: at.z + dz } };
};

const play = (level: 'middle' | 'perfect'): Input => ({ do: 'run', name: `the ${level} player fights`, run: (p: Play) => p.sys.fights.autoplay!(level) });

export const fightsInTheWorld: Scenario = {
  name: 'fights-in-the-world',
  about: 'Fight 2 at night on the plot with Dax, fight 4 held out of reach, and and the Sluice Keeper shut down in the room the ruins start it in, each with its step open.',
  seed: 11,
  start: { quest: 'kitchen' },
  inputs: [
    open(2),
    near(2, 6),
    { do: 'wait', seconds: 1 },
    { do: 'check', what: 'the thistlehog waits for night', that: (p) => p.sys.fights.active() === null },
    { do: 'run', name: 'dusk', run: (p) => p.sys.time.setTimeOfDay(0.8) },
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'fight 2 began, with Dax', that: (p) => p.sys.fights.active() === 2 && p.sys.fights.running!()!.fight.companion.def.kind === 'dax' },
    play('middle'),
    { do: 'wait', until: (p) => p.game.flags.is(FLAG.fightWon(2)), seconds: 240 },
    { do: 'run', name: 'the scene after the fight is heard out', run: (p) => { p.until(() => p.sys.talk.active, 10); p.talkThrough(); } },
    { do: 'wait', seconds: 4 },
    { do: 'check', what: 'the thistlehog went home and the kitchen quest is done', that: (p) => p.game.flags.is(FLAG.beastHome('thistlehog')) && p.game.flags.is(FLAG.questDone('kitchen')) },
    // The grey wood, to the boar.
    { do: 'run', name: 'the grey wood is open to the boar', run: (p) => { p.sys.quests.skipTo('greywood'); p.advance(0.5); } },
    open(4),
    near(4, 8),
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'fight 4 began and the boar does not fight', that: (p) => p.sys.fights.active() === 4 && p.sys.fights.running!()!.fight.beasts[0]!.passive },
    { do: 'wait', until: (p) => p.game.flags.is(FLAG.fightDenied(4)), seconds: 30 },
    { do: 'run', name: 'the scene after the fight is heard out', run: (p) => { p.until(() => p.sys.talk.active, 10); p.talkThrough(); } },
    { do: 'wait', seconds: 4 },
    // The Pump House.
    { do: 'run', name: 'on to the Pump House', run: (p) => { p.sys.quests.skipTo('pump'); p.advance(0.5); } },
    open(7),
    near(7, 4),
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'the Sluice Keeper waits for the ruins to open its room', that: (p) => p.sys.fights.active() === null },
    { do: 'run', name: 'the ruins start it in its test room', run: (p) => { const at = p.game.player.pos; p.sys.fights.startKeeper!(7, keeperRoom('sluice', Math.floor(at.x), Math.floor(at.z) - 4)); } },
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'the Sluice Keeper wakes in its room', that: (p) => p.sys.fights.active() === 7 && p.sys.fights.running!()!.keeper?.kind === 'sluice' },
    { do: 'wait', until: (p) => p.game.flags.is(FLAG.fightWon(7)), seconds: 300 },
  ],
  expect(p) {
    const denied = p.heard.find((h) => h.name === 'fight.denied');
    return [
      ['fight 2 was won by playing it', p.game.flags.is(FLAG.fightWon(2)) && p.count('quill') >= 4],
      ['fight 4 was held out of reach at Heartstone 1', p.game.flags.is(FLAG.fightDenied(4)) && JSON.stringify(denied?.data) === JSON.stringify({ fight: 4, depth: 5, heartstone: 1 })],
      ['the grey wood is done', p.game.flags.is(FLAG.questDone('greywood'))],
      ['the Sluice Keeper is shut down', p.game.flags.is(FLAG.fightWon(7))],
      ['every fight that began ended', p.heard.filter((h) => h.name === 'fight.started').length === p.heard.filter((h) => h.name === 'fight.ended').length],
    ];
  },
};
