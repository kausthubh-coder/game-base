// The Mark reaches as deep as the Heartstone, and the Heartstone is what lives on the land. So the pack of three
// foxes (depth 2, fight 3) and the lynx (depth 3, fight 5) are calmed only once the settlement has climbed there:
// the kitchen quest played as settlement-kitchen plays it gives 2, then a thistle run of six posts and a bait
// field of carrots in the dark make three living farms with Hobb and Dax wanting nothing, which gives 3. Nothing
// here sets the Heartstone: it reads the land.
import { FLAG } from '../content/flags.ts';
import type { FightNumber, QuestId } from '../content/ids.ts';
import { QUESTS, satisfy } from '../content/quests.ts';
import { armingSteps, fightPlace } from '../fights/index.sim.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';
import { apply } from '../quests/rules.sim.ts';
import { settlementKitchen } from './settlement-kitchen.sim.ts';

const heart = (p: Play): number => p.sys.hall.heart().level;

/** On to quest q, the quests before it passed by their flags, and fight n's step opened the same way. */
const onTo = (q: QuestId, n: FightNumber): Input => ({
  do: 'run',
  name: `on to fight ${n} in quest ${q}`,
  run(p: Play) {
    p.sys.quests.skipTo(q);
    p.advance(0.5);
    const a = armingSteps(n)!;
    for (const step of QUESTS.find((one) => one.id === q)!.steps) {
      if (a.steps.includes(step.id)) break;
      for (const effect of satisfy(step.done)) apply(p.game, effect);
      p.advance(0.2);
      p.talkThrough();
    }
    p.advance(0.5);
    p.talkThrough();
    const open = String(p.game.flags.get(FLAG.questStep(q)));
    if (!a.steps.includes(open)) throw new Error(`fight ${n}'s step is not open: ${q} is at ${open}`);
  },
});

const near = (n: FightNumber, dz: number): Input => {
  const at = fightPlace(n);
  return { do: 'teleport', to: { x: at.x, z: at.z + dz } };
};

/** The middle player fights it, and the scene after is heard out. */
const fight = (n: FightNumber): Input[] => [
  { do: 'wait', seconds: 0.5 },
  { do: 'check', what: `fight ${n} began`, that: (p) => p.sys.fights.active() === n },
  { do: 'run', name: 'the middle player fights', run: (p) => p.sys.fights.autoplay!('middle') },
  { do: 'wait', until: (p) => p.game.flags.is(FLAG.fightWon(n)) || p.heard.some((h) => h.name === 'fight.denied'), seconds: 240 },
  { do: 'check', what: `the Mark reached fight ${n}`, that: (p) => !p.heard.some((h) => h.name === 'fight.denied' && (h.data as { fight: number }).fight === n) },
  { do: 'check', what: `fight ${n} was calmed`, that: (p) => p.game.flags.is(FLAG.fightWon(n)) },
  { do: 'wait', seconds: 2 },
  { do: 'run', name: 'the scene after is heard out', run: (p) => p.talkThrough() },
];

/** The ground by the plot's east side, as three-farms finds it: y 21. */
const G = 21;
const use = (x: number, z: number): Input => ({ do: 'use', at: { x, y: G, z } });
const set = (item: Parameters<Play['take']>[0], x: number, z: number): Input[] => [{ do: 'take', item }, use(x, z)];
/** Six posts two apart along z -238, a thistle run. */
const POSTS = [4, 6, 8, 10, 12, 14];
/** Eight carrots, four by two, in the dark south-west of the pond, where three-farms has its bait field. */
const CARROTS: [number, number][] = [[8, -236], [9, -236], [10, -236], [11, -236], [8, -235], [9, -235], [10, -235], [11, -235]];

export const calmByTheHeartstone: Scenario = {
  name: 'calm-by-the-heartstone',
  about: 'The settlement climbed to Heartstone 2 by the kitchen quest calms the three foxes, and to 3 by three living farms with everyone\'s needs met calms the lynx; nothing sets the stone.',
  seed: 31,
  start: { quest: 'kitchen', give: { ...settlementKitchen.start!.give, post: 6, hoe: 1, carrot_seeds: 8 } },
  inputs: [
    ...settlementKitchen.inputs,
    { do: 'check', what: 'the kitchen quest gave Heartstone 2', that: (p) => heart(p) === 2 },
    // The grey wood: Wren pins two foxes and the third is the hero's.
    onTo('greywood', 3),
    { do: 'check', what: 'the stone still reads 2 in the grey wood', that: (p) => heart(p) === 2 },
    near(3, 6),
    ...fight(3),
    // Home: a thistle run for the calmed thistlehog, and a bait field for the burrowers.
    onTo('count', 5),
    ...POSTS.flatMap((x): Input[] => [{ do: 'teleport', to: { x: x + 0.5, z: -240.5 } }, ...set('post', x, -238)]),
    { do: 'teleport', to: { x: 10.5, z: -233.5 } },
    { do: 'take', item: 'hoe' },
    ...CARROTS.map(([x, z]) => use(x, z)),
    { do: 'take', item: 'carrot_seeds' },
    ...CARROTS.map(([x, z]) => use(x, z)),
    { do: 'wait', seconds: 3 },
    { do: 'check', what: 'the thistle run and the bait field are living on Give', that: (p) => p.sys.farms.get('quill')?.living === true && p.sys.farms.get('copper')?.living === true },
    { do: 'wait', seconds: 2 },
    { do: 'check', what: 'three living farms and nobody wanting make Heartstone 3', that: (p) => heart(p) === 3 },
    near(5, 6),
    ...fight(5),
  ],
  expect(p) {
    const denied = p.heard.filter((h) => h.name === 'fight.denied').map((h) => (h.data as { fight: number }).fight);
    return [
      ['the three foxes were calmed at Heartstone 2', p.game.flags.is(FLAG.fightWon(3))],
      ['the lynx was calmed at Heartstone 3', p.game.flags.is(FLAG.fightWon(5))],
      [`no fight was out of reach (${denied.join(', ')})`, !denied.includes(3) && !denied.includes(5)],
      // Gus comes home once the lynx is calmed, wanting a bed, so not everyone's needs are met: 2 until he has one.
      [`Gus came home wanting, and the stone reads the land again: ${heart(p)}, flag ${String(p.game.flags.get(FLAG.heartstone))}`, p.sys.settlement.settlers().includes('gus') && heart(p) === 2 && p.game.flags.get(FLAG.heartstone) === 2],
    ];
  },
};
