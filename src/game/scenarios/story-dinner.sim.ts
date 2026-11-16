// The first dinner, as the quest of the stone meets it: the step waits for the settlement's table in the evening,
// Gus and Hobb ask there, granting Gus sets the choice, and Hobb answers once. One dinner: the settlement's panel,
// and no conversation of the story's own.
import type { Placed } from '../api.sim.ts';
import { SETTLER } from '../content/people.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

/** Sets a building down `dx` and `dz` blocks from the grant's north-west corner. */
function build(p: Play, kind: string, dx: number, dz: number): Placed {
  const g = p.sys.region.grant(), y = p.sys.region.place('grant.center').at.y;
  const placed = p.sys.placeables.place(kind, g.x + dx, y, g.z + dz, 0);
  if (!placed) throw new Error(`could not set down ${kind}`);
  return placed;
}

const dinnerTalks = (p: Play): number => p.heard.filter((e) => e.name === 'talk.started' && (e.data as { conversation: string }).conversation.startsWith('dinner')).length;

export const storyDinner: Scenario = {
  name: 'story-dinner',
  about: 'The quest of the stone waits for evening at the settlement\'s table; Gus asks for rest and Hobb for a river view, granting Gus sets the choice and finishes the quest, Hobb answers once, and no dinner conversation opens.',
  seed: 33,
  start: { quest: 'echo' },
  inputs: [
    {
      do: 'run', name: 'the stone, the vaults, the shrine and the bees; Hobb, Dax and Gus at home',
      run: (p) => {
        for (const flag of ['scene.24', 'vaults.marked', 'step.echo.shrine', 'step.echo.bees', 'scene.18', 'fight.5.won']) p.game.flags.set(flag, true);
      },
    },
    { do: 'wait', seconds: 2 },
    { do: 'run', name: 'a cottage and a dinner table', run: (p) => { build(p, 'cottage', 2, 2); build(p, 'dinner_table', 10, 8); } },
    { do: 'teleport', to: { place: 'grant.center' } },
    { do: 'wait', seconds: 2 },
    { do: 'check', what: 'nothing is asked by day', that: (p) => !p.sys.talk.active && p.game.flags.get('quest.echo.step') === 'dinner' && p.sys.settlement.dinner() === null },
    { do: 'wait', until: 'evening' },
    { do: 'wait', seconds: 3 },
    { do: 'check', what: 'the table is laid, and the story opens nothing of its own', that: (p) => p.said.includes('Dinner is on the table.') && !p.sys.talk.active },
    {
      do: 'run', name: 'sit down at the table',
      run: (p) => {
        const table = p.sys.placeables.all().find((one) => one.kind === 'dinner_table')!;
        p.teleport({ x: table.x + 1, z: table.z - 1 });
        p.advance(0.5);
        if (p.interact() !== 'Sit down to dinner') throw new Error(`the prompt at the table is ${p.prompt()}`);
      },
    },
    { do: 'check', what: 'one dinner: Gus and Hobb ask on the settlement\'s panel, and no conversation opens', that: (p) => p.sys.settlement.dinner()?.asks.map((a) => a.who).join() === 'gus,hobb' && !p.sys.talk.active },
    { do: 'run', name: 'grant Gus his rest', run: (p) => { if (p.sys.settlement.grant('gus') !== SETTLER.hobb.ask!.other) throw new Error('Hobb did not answer'); } },
    { do: 'wait', seconds: 1 },
  ],
  expect: (p) => [
    ['Gus was granted his rest', p.game.flags.get('choice.dinner') === 'gus'],
    ['the table says so', p.heard.some((event) => event.name === 'dinner.granted' && (event.data as { who: string }).who === 'gus')],
    ['Hobb answers in chapter 22\'s words', SETTLER.hobb.ask!.other === 'Fine. I\'ll keep guessing. You\'ll know when I guess wrong.'],
    ['no dinner conversation was played', dinnerTalks(p) === 0],
    ['the quest of the stone is done', p.game.flags.is('quest.echo.done')],
  ],
};
