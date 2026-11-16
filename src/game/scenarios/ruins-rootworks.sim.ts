// The Old Gate, the Rootworks and the Stag's hall played by the rules: three keystones set in the gate, the climb on
// your own rope, each level's dead machine rebuilt from parts in the pack, the root locks, the Stag freed in its hall,
// and the Hall's second level opening after it.
import { FLAG } from '../content/flags.ts';
import type { ItemId } from '../content/ids.ts';
import type { Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';
import { MACHINES, pointOf } from '../ruins/index.sim.ts';
import { roomIs, toSpot } from './ruins-pump-house.sim.ts';

const give = (items: readonly { id: ItemId; count: number }[]): Input => ({
  do: 'run', name: `the pack holds ${items.map((i) => i.id).join(', ')}`, run: (p) => { for (const i of items) p.sys.inventory.add(i.id, i.count); },
});

/** One level: its machine refused with an empty pack, rebuilt with the parts, and down through its lock. */
const level = (n: 1 | 2 | 3): Input[] => {
  const room = `rootworks-${n}` as const, m = MACHINES[n - 1]!;
  return [
    roomIs(room),
    toSpot(room, 'lock'),
    { do: 'check', what: `level ${n}'s root lock is shut`, that: (p) => p.prompt() === null },
    toSpot(room, 'machine'),
    { do: 'interact', prompt: `Rebuild ${m.name}` },
    { do: 'check', what: `${m.name} wants parts from the pack`, that: (p) => !p.sys.ruins.view!().machines[n - 1] },
    give(m.needs),
    { do: 'interact', prompt: `Rebuild ${m.name}` },
    { do: 'check', what: `${m.name} is rebuilt, and the parts are used`, that: (p) => p.sys.ruins.view!().machines[n - 1] === true && m.needs.every((need) => p.count(need.id) === 0) },
    { do: 'wait', seconds: 0.3 },
    { do: 'run', name: 'whatever the story says now', run: (p) => p.talkThrough() },
    toSpot(room, 'lock'),
    { do: 'interact', prompt: n === 3 ? 'Go down to the Stag\'s hall' : `Climb down to level ${n + 1}` },
    { do: 'wait', seconds: 0.3 },
  ];
};

export const ruinsRootworks: Scenario = {
  name: 'ruins-rootworks',
  about: 'The Old Gate takes three keystones, the Rootworks wants your own rope and a rebuilt machine on each level, the Stag is freed in its hall, and the Hall\'s second level opens.',
  seed: 32,
  start: { quest: 'keystones' },
  inputs: [
    { do: 'run', name: 'the settlers have said their piece', run: (p) => { p.advance(0.5); p.talkThrough(); } },
    // The bench's step: tusk and root gear, and a climbing rope.
    { do: 'run', name: 'tusk gear from the bench', run: (p) => p.game.flags.set(FLAG.step('keystones', 'tusk'), true) },
    { do: 'teleport', to: pointOf('gate') },
    { do: 'wait', seconds: 0.3 },
    { do: 'check', what: 'the three keystones from the vaults', that: (p) => p.sys.ruins.keystones() === 3 },
    { do: 'interact', prompt: 'Set the three keystones' },
    { do: 'wait', seconds: 0.3 },
    { do: 'check', what: 'scene 32 plays at the gate', that: (p) => p.sys.talk.current()?.scene === 32 },
    { do: 'run', name: 'the gate shuts on Calla', run: (p) => p.talkThrough() },
    { do: 'check', what: 'the gate is open', that: (p) => p.sys.ruins.view!().gate },
    { do: 'run', name: 'no rope in the pack', run: (p) => { p.sys.inventory.remove('rope_ladder', p.count('rope_ladder')); p.sys.inventory.remove('vine_rope', p.count('vine_rope')); } },
    { do: 'interact', prompt: 'Climb down into the Rootworks' },
    roomIs(null),
    give([{ id: 'rope_ladder', count: 1 }]),
    { do: 'interact', prompt: 'Climb down into the Rootworks' },
    { do: 'wait', seconds: 0.3 },
    { do: 'check', what: 'down on your own rope', that: (p) => p.game.flags.is(FLAG.step('keystones', 'climb')) },
    ...level(1),
    ...level(2),
    // Up and home by the waystone, and back down by the terraces' stone to the deepest level.
    toSpot('rootworks-3', 'waystone'),
    { do: 'interact', prompt: 'Touch the waystone: home' },
    { do: 'wait', seconds: 0.3 },
    roomIs(null),
    { do: 'teleport', to: pointOf('waystone') },
    { do: 'wait', seconds: 0.3 },
    { do: 'interact', prompt: 'Touch the waystone: the Rootworks, level 3' },
    { do: 'wait', seconds: 0.3 },
    ...level(3),
    roomIs('stag'),
    { do: 'check', what: 'every machine is rebuilt', that: (p) => p.game.flags.is(FLAG.step('keystones', 'machines')) && p.game.flags.is(FLAG.questDone('keystones')) },
    toSpot('stag', 'middle', 0.5, 8),
    // The Custodian's words before the chains have been said, by the director as the step opened or here.
    { do: 'run', name: 'heard out', run: (p) => { p.advance(0.3); p.talkThrough(); } },
    { do: 'check', what: 'the Custodian spoke before the chains', that: (p) => p.game.flags.is('story.seen.scene.33.before') },
    { do: 'wait', seconds: 1, until: (p) => p.sys.fights.active() === 12 },
    { do: 'check', what: 'the Stag wakes in its hall', that: (p) => p.sys.fights.active() === 12 && p.sys.fights.running!()!.hall !== null },
    { do: 'run', name: 'the rule-made player frees it', run: (p) => p.sys.fights.autoplay!('perfect') },
    { do: 'wait', until: (p) => p.game.flags.is(FLAG.fightWon(12)), seconds: 600 },
    { do: 'run', name: 'scene 33', run: (p) => { p.until(() => p.sys.talk.active, 10); p.talkThrough(); } },
    { do: 'wait', seconds: 20, until: (p) => p.sys.fights.running!() === null },
    // The quest after it begins at once with the morning's film.
    { do: 'run', name: 'green overnight', run: (p) => { p.advance(0.5); p.talkThrough(); } },
    toSpot('stag', 'out'),
    { do: 'interact', prompt: 'Climb out under the sky' },
    { do: 'wait', seconds: 0.3 },
    roomIs(null),
    // The Hall's second level.
    { do: 'run', name: 'the morning after', run: (p) => { p.sys.quests.skipTo('green'); p.game.flags.set(FLAG.scene(34), true); p.game.flags.set(FLAG.settlementStep, 'freehold'); p.advance(0.5); p.talkThrough(); } },
    { do: 'teleport', to: pointOf('hallBelow') },
    { do: 'wait', seconds: 0.3 },
    { do: 'interact', prompt: 'Go down to the Hall\'s second level' },
    { do: 'wait', seconds: 0.3 },
    roomIs('hall-below'),
    toSpot('hall-below', 'out'),
    { do: 'interact', prompt: 'Go back up to the court' },
    { do: 'wait', seconds: 0.3 },
    roomIs(null),
  ],
  expect: (p) => [
    ['the Stag is free', p.game.flags.is(FLAG.fightWon(12)) && p.game.flags.is(FLAG.scene(33))],
    ['the stag quest is done', p.game.flags.is(FLAG.questDone('stag'))],
    ['the Hall\'s second level was reached', p.game.flags.is(FLAG.step('green', 'level'))],
    ['the Rootworks remember how deep you went', p.sys.ruins.view!().deepest === 3],
  ],
};
