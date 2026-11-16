import { expect, test } from 'bun:test';
import { newPlay } from '../play/harness.sim.ts';
import type { Game } from '../api.sim.ts';
import { FLAG } from '../content/flags.ts';
import { CHOICES, QUEST_IDS } from '../content/ids.ts';
import { QUESTS, satisfy, waitsFor, type Condition, type QuestDef } from '../content/quests.ts';
import { GROUND, PLACES, stage } from '../story/fakes.ts';
import { apply, holds } from './rules.sim.ts';

// ------------------------------------------------------------------------------------------ act 1's quests

test('the 21 quests are the ids of ids.ts, in order, each started by the one before, and the vaults in any order', () => {
  expect(QUESTS.map((quest) => quest.id)).toEqual([...QUEST_IDS]);
  expect(QUESTS[0].starts).toBe('new game');
  // The three vaults all open with the quest of the stone; what each teaches opens its quest at home.
  const waits: Partial<Record<string, readonly string[]>> = { pump: ['echo'], gallery: ['echo'], seeds: ['echo'], uphill: ['pump'], lights: ['gallery'], itself: ['seeds', 'uphill', 'lights'] };
  QUESTS.slice(1).forEach((quest, i) => expect(waitsFor(quest) as readonly string[], quest.id).toEqual(waits[quest.id] ?? [QUESTS[i].id]));
  // Each waits only for quests before it, so skipTo can pass over them in order.
  QUESTS.forEach((quest, i) => {
    for (const id of waitsFor(quest)) expect(QUESTS.findIndex((q) => q.id === id), `${quest.id} waits for ${id}`).toBeLessThan(i);
  });
  expect(QUESTS.map((quest) => quest.chapter)).toEqual([1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 5, 5]);
  expect(QUESTS.find((quest) => quest.id === 'night')!.steps.map((step) => step.id)).toEqual(['bed', 'door', 'mark', 'key', 'calm', 'heart', 'sleep', 'tamsin']);
});

test('every step has a kind, an id of its own in its quest, and a condition a flag can make hold', () => {
  for (const quest of QUESTS) {
    expect(new Set(quest.steps.map((step) => step.id)).size, quest.id).toBe(quest.steps.length);
    for (const step of quest.steps) {
      expect(step.kind, `${quest.id}.${step.id}`).toBeDefined();
      expect(step.text.length, `${quest.id}.${step.id}`).toBeGreaterThan(0);
      expect(satisfy(step.done).length, `${quest.id}.${step.id}`).toBeGreaterThan(0);
    }
  }
});

test('the quests name each of the 38 scenes once and each of the 12 fights', () => {
  const scenes = QUESTS.flatMap((quest) => quest.steps.flatMap((step) => (step.scene ? [step.scene] : [])));
  expect([...scenes].sort((a, b) => a - b) as number[]).toEqual(Array.from({ length: 38 }, (_, i) => i + 1));
  const fights = new Set(QUESTS.flatMap((quest) => quest.steps.flatMap((step) => (step.fight ? [step.fight] : []))));
  expect([...fights].sort((a, b) => a - b) as number[]).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
});

test('a scene step waits for scene.<n>, a fight for fight.<n>.won, a choice for each of its choice flags', () => {
  const steps = QUESTS.flatMap((quest) => quest.steps.map((step) => ({ quest: quest.id, ...step })));
  const step = (quest: string, id: string) => steps.find((one) => one.quest === quest && one.id === id)!;
  expect(step('grantday', 'wake').done).toEqual({ flag: FLAG.scene(1) });
  // The scene that follows a fight is part of its step.
  expect(step('kitchen', 'thistlehog').done).toEqual({ all: [{ flag: FLAG.fightWon(2) }, { flag: FLAG.scene(19) }] });
  expect(step('greywood', 'boar').done).toEqual({ all: [{ flag: FLAG.fightDenied(4) }, { flag: FLAG.scene(21) }] });
  expect(step('count', 'lynx').done).toEqual({ flag: FLAG.fightWon(5) });
  expect(step('kitchen', 'rooms').done).toEqual({ all: [{ flag: 'choice.hobb' }, { flag: 'choice.dax' }] });
  expect(step('stag', 'overgrowth').done).toEqual({ flag: 'fight.12.phase', atLeast: 2 });
  expect(step('ground', 'ditch').done).toEqual({ flag: 'step.ground.ditch' });
  // skipTo picks each choice's first value.
  expect(satisfy(step('grantday', 'rack').done)).toEqual([{ flag: 'choice.weapon', value: CHOICES.weapon[0] }]);
});

test('a new game plays to the end of the act, a step at a time, by the flags each step asks for', () => {
  const s = stage({ story: false });
  s.run(0.05);
  const quests = s.game.systems.quests;
  expect(quests.tracked()!.id).toBe('grantday');
  let steps = 0;
  for (let guard = 0; quests.tracked() && guard < 200; guard++) {
    const quest = QUESTS.find((def) => def.id === quests.tracked()!.id)!;
    const open = quest.steps.find((step) => step.id === s.game.flags.get(`quest.${quest.id}.step`))!;
    for (const effect of satisfy(open.done)) apply(s.game, effect);
    s.run(0.05);
    steps++;
  }
  expect(quests.all().every((quest) => quest.state === 'done')).toBe(true);
  expect(steps).toBe(QUESTS.reduce((sum, quest) => sum + quest.steps.length, 0));
  expect(s.events('quest.completed').map((event) => (event as { quest: string }).quest)).toEqual([...QUEST_IDS]);
});

test('skipTo works for every quest and can be called twice, and passing a quest leaves its flags and gifts', () => {
  for (const def of QUESTS) {
    const s = stage({ story: false });
    s.run(0.05);
    s.game.systems.quests.skipTo(def.id);
    s.game.systems.quests.skipTo(def.id);
    const tracked = s.game.systems.quests.tracked()!;
    expect(tracked.id).toBe(def.id);
    expect(holds(s.game, { quest: def.id, step: def.steps[0].id })).toBe(true);
    const at = QUESTS.indexOf(def);
    // Every step of every quest passed over holds, and none of the quest skipped to.
    for (const passed of QUESTS.slice(0, at)) for (const step of passed.steps) if (step.kind !== 'sleep') expect(holds(s.game, step.done), `${passed.id}.${step.id} when skipped to ${def.id}`).toBe(true);
    // One of each gift, not two: the guild's axe from grant day.
    if (at > 0) expect(s.bag.get('axe')).toBe(1);
    if (at > QUESTS.findIndex((quest) => quest.id === 'night')) expect(s.game.flags.is('has.almanac')).toBe(true);
    if (at > QUESTS.findIndex((quest) => quest.id === 'count')) expect([s.bag.get('hoe'), s.bag.get('watering_can'), s.bag.get('wheat_seeds')]).toEqual([1, 1, 12]);
    // Tamsin waits at the grant stone until the first night is over.
    expect(s.sent.at(-1)).toEqual({ npc: 'tamsin', place: at <= 2 ? 'grant.stone' : 'lodge' });
  }
});

// ------------------------------------------------------------------------------------------ the conditions

test('a flag condition can ask for at least a number, and an unset flag is 0', () => {
  const s = stage({ story: false });
  const game: Game = s.game;
  expect(holds(game, { flag: 'coin', atLeast: 0 })).toBe(true);
  expect(holds(game, { flag: 'coin', atLeast: 150 })).toBe(false);
  game.flags.set('coin', 149);
  expect(holds(game, { flag: 'coin', atLeast: 150 })).toBe(false);
  game.flags.add('coin', 1);
  expect(holds(game, { flag: 'coin', atLeast: 150 })).toBe(true);
  expect(holds(game, { flag: 'coin', is: 150 })).toBe(true);
  expect(satisfy({ flag: 'hearts', atLeast: 60 })).toEqual([{ flag: 'hearts', value: 60 }]);
});

test('holds() throws on a condition it does not know, instead of reading it as another kind', () => {
  const s = stage({ story: false });
  expect(() => holds(s.game, { weather: 'storm' } as unknown as Condition)).toThrow('holds() does not know the condition {"weather":"storm"}');
  expect(() => holds(s.game, { any: [{ flag: 'a' }, { nothing: true } as unknown as Condition] })).toThrow('does not know');
});

// ------------------------------------------------------------------------------------------ the engine
// The engine on quests made for these tests: the shapes the old story's quests had (a talk with a gate, a page to
// fill, items to gather, things to set down, a pet, a place been to, an item someone hands over first).

const ENGINE: readonly QuestDef[] = [
  {
    chapter: 1,
    id: 'grantday', title: 'A plot of your own', summary: '', starts: 'new game',
    steps: [
      { id: 'meet', kind: 'talk', text: 'Talk to Tamsin at the grant stone', done: { flag: 'plot.met' }, gate: true, npc: ['tamsin'], place: 'grant.stone' },
      { id: 'watch', kind: 'watch', text: 'Watch a mossling', done: { page: 'mossling' }, place: 'grant.rocks', count: { page: 'mossling' } },
      { id: 'tell', kind: 'talk', text: 'Tell Tamsin what you saw', done: { flag: 'plot.told' }, gate: true, npc: ['tamsin'] },
    ],
    skip: [{ flag: 'plot.met' }, { flag: 'plot.told' }, { give: 'axe' }, { learn: 'mossling' }],
  },
  {
    chapter: 1,
    id: 'ground', title: 'A roof before dark', summary: '',
    steps: [
      { id: 'wood', kind: 'do', text: 'Cut 12 oak logs', done: { bag: 'oak_log', atLeast: 12 }, count: { bag: 'oak_log', need: 12 } },
      { id: 'bench', kind: 'do', text: 'Set a workbench down', done: { placed: 'workbench' } },
      { id: 'shelter', kind: 'do', text: 'Set a bed down with a block over it', done: { placed: 'bed', covered: true } },
    ],
    skip: [],
  },
  { ...QUESTS.find((quest) => quest.id === 'night')!, starts: { after: 'ground' } },
  {
    chapter: 1,
    id: 'blessing', title: 'Leaf and tail', summary: '', starts: { after: 'night' },
    steps: [
      { id: 'find', kind: 'go', text: 'Find the dead garden', done: { any: [{ petNear: 'leaftail', within: 10 }, { place: 'dead.garden', within: 10 }] }, place: 'dead.garden' },
      { id: 'berries', kind: 'do', text: 'Pick 3 berries', done: { bag: 'berry', atLeast: 3 }, count: { bag: 'berry', need: 3 } },
      { id: 'trust', kind: 'do', text: 'Feed the leaftail', done: { bonded: 'leaftail' }, pet: 'leaftail', count: { trust: 'leaftail', need: 3 } },
      { id: 'show', kind: 'talk', text: 'Show it to Tamsin or Wren', done: { flag: 'leaftail.shown' }, gate: true, npc: ['tamsin', 'wren'] },
    ],
    skip: [{ bond: 'leaftail' }, { flag: 'leaftail.shown' }],
  },
  {
    chapter: 1,
    id: 'kitchen', title: 'The queen\'s bread', summary: '',
    steps: [
      { id: 'town', kind: 'go', text: 'Follow the path to Hollowmere', done: { place: 'town.gate', within: 12, ever: true }, place: 'town.gate' },
      { id: 'queen', kind: 'talk', text: 'Meet Queen Maren', done: { flag: 'bread.asked' }, gate: true, npc: ['maren'], place: 'granary' },
    ],
    skip: [],
  },
  {
    chapter: 1,
    id: 'greywood', title: 'The festival', summary: '',
    steps: [
      { id: 'lamp', kind: 'do', text: 'Float a lamp', done: { flag: 'festival.lamp' }, place: 'river.bank', first: { bag: 'river_lamp', npc: ['gus'] } },
    ],
    skip: [],
  },
];

const engine = () => stage({ story: false, quests: ENGINE });

test('a new game starts the first quest, tracks it and marks whoever its step names', () => {
  const s = engine();
  expect(s.game.systems.quests.all()).toEqual([]);
  s.run(0.05);
  const quests = s.game.systems.quests;
  expect(s.events('quest.started')).toEqual([{ quest: 'grantday' }]);
  expect(s.game.flags.is('quest.grantday.started')).toBe(true);
  expect(s.game.flags.is('quest.grantday.done')).toBe(false);
  expect(s.game.flags.get('quest.grantday.step')).toBe('meet');
  const tracked = quests.tracked()!;
  expect(tracked).toMatchObject({ id: 'grantday', state: 'active' });
  expect(tracked.steps.map((step) => step.done)).toEqual([false, false, false]);
  // The open step points at Tamsin, who stands at the grant stone.
  expect(tracked.steps[0].at).toEqual({ x: PLACES['grant.stone'][0] + 0.5, y: GROUND, z: PLACES['grant.stone'][1] + 0.5 });
  expect(tracked.steps[1].at).toBeUndefined();
  expect(s.marks.get('tamsin')).toBe('quest');
  expect(quests.all().map((q) => q.state)).toEqual(['active', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden']);
  // The same objects come back until something changes, so the HUD can read them every frame.
  expect(quests.tracked()).toBe(tracked);
});

test('a step finishes when its condition holds: flags, events and the mark follow', () => {
  const s = engine();
  s.run(0.05);
  s.game.flags.set('plot.met', true);
  s.run(0.05);
  expect(s.events('quest.step')).toEqual([{ quest: 'grantday', step: 'meet' }]);
  expect(s.game.flags.get('quest.grantday.step')).toBe('watch');
  expect(s.marks.get('tamsin')).toBe('');
  const watch = s.game.systems.quests.tracked()!.steps[1];
  expect(watch).toMatchObject({ id: 'watch', done: false, have: 0, need: 2 });
  expect(watch.at).toEqual({ x: PLACES['grant.rocks'][0] + 0.5, y: GROUND, z: PLACES['grant.rocks'][1] + 0.5 });

  s.game.systems.almanac.learn('mossling', 'needs');
  s.run(0.05);
  expect(s.game.systems.quests.tracked()!.steps[1]).toMatchObject({ done: false, have: 1, need: 2 });
  s.game.systems.almanac.learn('mossling', 'gives');
  s.run(0.05);
  expect(s.game.flags.get('quest.grantday.step')).toBe('tell');
  expect(s.marks.get('tamsin')).toBe('quest');

  s.game.flags.set('plot.told', true);
  s.run(0.05);
  expect(s.events('quest.step').map((e) => (e as { step: string }).step)).toEqual(['meet', 'watch', 'tell']);
  expect(s.events('quest.completed')).toEqual([{ quest: 'grantday' }]);
  expect(s.game.flags.is('quest.grantday.done')).toBe(true);
  expect(s.game.flags.get('quest.grantday.step')).toBe('');
  expect(s.marks.get('tamsin')).toBe('');
  // A quest with no `starts` waits to be started by something else.
  expect(s.game.systems.quests.tracked()).toBeNull();
});

test('a gate cannot be skipped: the page alone does not pass the talk with Tamsin', () => {
  const s = engine();
  s.run(0.05);
  s.game.systems.almanac.learn('mossling', 'needs');
  s.game.systems.almanac.learn('mossling', 'gives');
  s.game.flags.set('plot.told', true);
  s.run(1);
  expect(s.game.flags.get('quest.grantday.step')).toBe('meet');
  expect(s.events('quest.step')).toEqual([]);
});

test('conditions without an event are found by the check twice a second', () => {
  const s = engine();
  s.run(0.05);
  s.game.systems.quests.skipTo('ground');
  s.bag.set('oak_log', 7);
  s.run(0.6);
  expect(s.game.systems.quests.tracked()!.steps[0]).toMatchObject({ id: 'wood', done: false, have: 7, need: 12 });
  s.bag.set('oak_log', 30);
  s.run(0.3);
  expect(s.game.flags.get('quest.ground.step')).toBe('wood');
  s.run(0.3);
  expect(s.game.flags.get('quest.ground.step')).toBe('bench');
  expect(s.game.systems.quests.tracked()!.steps[0]).toMatchObject({ done: true, have: 12, need: 12 });
});

test('a step that is not a gate counts as done when a later one is, and a block over the bed is the roof', () => {
  const s = engine();
  s.run(0.05);
  s.game.systems.quests.skipTo('ground');
  // A workbench placed with only four planks passes the wood step too.
  s.game.systems.placeables.place('workbench', 3, GROUND, 3, 0);
  s.run(0.05);
  expect(s.game.flags.get('quest.ground.step')).toBe('shelter');

  s.game.systems.placeables.place('bed', 5, GROUND, 5, 0);
  s.run(0.6);
  expect(s.game.flags.get('quest.ground.step')).toBe('shelter');
  s.game.world.setBlock(5, GROUND + 2, 5, 12);
  s.run(0.6);
  expect(s.events('quest.completed')).toEqual([{ quest: 'ground' }]);
  expect(s.events('quest.started').at(-1)).toEqual({ quest: 'night' });
  expect(s.game.systems.quests.tracked()!.id).toBe('night');
  expect(s.game.flags.get('quest.night.step')).toBe('bed');
});

test('the night quest: each scene\'s flag passes a step, a night of sleep the next, and Tamsin\'s flag the last', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.systems.quests.skipTo('night');
  const { flags } = s.game;
  for (const [flag, next] of [['night.fox', 'door'], ['door.open', 'mark'], ['mark', 'key'], ['custodian.awake', 'calm'], ['fox.calmed', 'heart'], ['heart.seen', 'sleep']] as const) {
    flags.set(flag, true);
    s.run(0.05);
    expect(flags.get('quest.night.step')).toBe(next);
  }
  s.game.systems.time.sleep();
  s.run(0.05);
  expect(flags.get('quest.night.step')).toBe('tamsin');
  // The last step is a gate: nothing but its own flag passes it, and Tamsin carries the mark.
  expect(s.marks.get('tamsin')).toBe('quest');
  s.run(1);
  expect(flags.get('quest.night.step')).toBe('tamsin');
  flags.set('night.told', true);
  s.run(0.05);
  expect(s.events('quest.completed')).toEqual([{ quest: 'night' }]);
  expect(s.game.systems.quests.tracked()!.id).toBe('blessing');
});

test('a night of sleep counts for the night quest only while that quest is open', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.systems.time.sleep();
  s.game.systems.quests.skipTo('night');
  for (const flag of ['night.fox', 'door.open', 'mark', 'custodian.awake', 'fox.calmed', 'heart.seen']) s.game.flags.set(flag, true);
  s.run(0.6);
  // The sleep before the quest began does not count.
  expect(s.game.flags.get('quest.night.step')).toBe('sleep');
  s.game.systems.time.sleep();
  s.run(0.05);
  expect(s.game.flags.get('quest.night.step')).toBe('tamsin');
});

test('feeding berry by berry never leaves a step open, and the waypoint follows the pet, then the nearer of two people', () => {
  const s = engine();
  s.run(0.05);
  s.game.systems.quests.skipTo('blessing');
  const find = s.game.systems.quests.tracked()!.steps[0];
  expect(find.at).toEqual({ x: PLACES['dead.garden'][0] + 0.5, y: GROUND, z: PLACES['dead.garden'][1] + 0.5 });

  s.moveTo('dead.garden');
  s.run(0.6);
  expect(s.game.flags.get('quest.blessing.step')).toBe('berries');
  s.bag.set('berry', 1);
  s.pet.trust = 2;
  s.run(0.6);
  const steps = s.game.systems.quests.tracked()!.steps;
  expect(steps[1]).toMatchObject({ id: 'berries', have: 1, need: 3 });
  expect(steps[2]).toMatchObject({ id: 'trust', have: 2, need: 3 });

  // It bonds though the player never held three berries at once.
  s.bag.set('berry', 0);
  s.pet.trust = 3;
  s.pet.bonded = true;
  s.game.events.emit('pet.bonded', { pet: s.pet.id });
  s.run(0.05);
  expect(s.game.flags.get('quest.blessing.step')).toBe('show');
  expect(s.marks.get('tamsin')).toBe('quest');
  expect(s.marks.get('wren')).toBe('quest');
  const show = s.game.systems.quests.tracked()!.steps[3];
  const wren = s.people.get('wren')!.pos, tamsin = s.people.get('tamsin')!.pos;
  const nearer = Math.hypot(wren.x - s.game.player.pos.x, wren.z - s.game.player.pos.z) < Math.hypot(tamsin.x - s.game.player.pos.x, tamsin.z - s.game.player.pos.z) ? wren : tamsin;
  expect(show.at).toEqual({ x: nearer.x, y: nearer.y, z: nearer.z });

  s.game.flags.set('leaftail.shown', true);
  s.run(0.05);
  expect(s.marks.get('tamsin')).toBe('');
  expect(s.marks.get('wren')).toBe('');
});

test('having been to a place counts for a step that asks for `ever`, however long ago', () => {
  const s = engine();
  s.run(0.05);
  s.moveTo('town.gate');
  s.run(0.6);
  s.moveTo('kennel');
  s.run(0.6);
  expect(s.game.flags.is('been.town.gate')).toBe(true);
  s.game.systems.quests.start('kitchen');
  s.run(0.05);
  expect(s.game.flags.get('quest.kitchen.step')).toBe('queen');
  expect(s.marks.get('maren')).toBe('quest');
});

test('start does nothing for a quest that is open or done, or that the list does not have', () => {
  const s = engine();
  s.run(0.05);
  s.game.systems.quests.start('grantday');
  s.game.systems.quests.start('pilgrimage');
  expect(s.events('quest.started')).toEqual([{ quest: 'grantday' }]);
});

test('skipTo passes over the quests before, with their skip effects and no quest events', () => {
  const s = engine();
  s.run(0.05);
  s.game.systems.quests.skipTo('blessing');
  const quests = s.game.systems.quests;
  expect(quests.all().map((q) => q.state)).toEqual(['done', 'done', 'done', 'active', 'hidden', 'hidden']);
  for (const flag of ['quest.grantday.done', 'quest.ground.done', 'quest.night.done', 'quest.blessing.started', 'plot.met', 'door.open', 'night.told', 'has.almanac']) expect(s.game.flags.is(flag), flag).toBe(true);
  expect(s.bag.get('axe')).toBe(1);
  expect(s.game.systems.almanac.page('mossling')!.complete).toBe(true);
  expect(s.sent).toContainEqual({ npc: 'tamsin', place: 'lodge' });
  expect(s.events('quest.completed')).toEqual([]);
  expect(s.events('quest.started').at(-1)).toEqual({ quest: 'blessing' });
});

test('quests are saved and loaded: the open step and the mark come back, and a loaded quest goes on', () => {
  const a = engine();
  a.run(0.05);
  a.game.systems.quests.skipTo('ground');
  a.game.systems.placeables.place('workbench', 3, GROUND, 3, 0);
  a.run(0.05);
  const save = JSON.parse(JSON.stringify(a.kernel.save()));

  const b = engine();
  b.run(0.05);
  b.kernel.load(save);
  b.run(0.05);
  const quests = b.game.systems.quests;
  expect(quests.all().map((q) => q.state)).toEqual(['done', 'active', 'hidden', 'hidden', 'hidden', 'hidden']);
  expect(quests.tracked()!.id).toBe('ground');
  expect(b.game.flags.get('quest.ground.step')).toBe('shelter');
  // Loading sends no quest events of its own.
  expect(b.events('quest.started')).toEqual([{ quest: 'grantday' }]);
  expect(b.events('quest.step')).toEqual([]);
  // The mark the new game put over Tamsin is gone, because the loaded quest has nobody to talk to.
  expect(b.marks.get('tamsin')).toBe('');

  const c = engine();
  c.run(0.05);
  c.game.systems.quests.skipTo('kitchen');
  const later = JSON.parse(JSON.stringify(c.kernel.save()));
  const d = engine();
  d.kernel.load(later);
  d.run(0.05);
  expect(d.game.flags.get('quest.kitchen.step')).toBe('town');
  expect(d.game.systems.quests.tracked()!.steps[0].at).toEqual({ x: PLACES['town.gate'][0] + 0.5, y: GROUND, z: PLACES['town.gate'][1] + 0.5 });
  d.moveTo('town.gate');
  d.run(0.6);
  expect(d.game.flags.get('quest.kitchen.step')).toBe('queen');
  expect(d.marks.get('maren')).toBe('quest');
});

test('a step points at whoever hands over what it needs until the bag holds it, then at its place', () => {
  const s = engine();
  s.run(0.05);
  s.game.systems.quests.skipTo('greywood');
  s.run(0.6);
  const gus = s.people.get('gus')!.pos;
  expect(s.game.systems.quests.tracked()!.steps[0].at).toEqual({ x: gus.x, y: gus.y, z: gus.z });
  expect(s.marks.get('gus')).toBe('quest');

  s.bag.set('river_lamp', 1);
  s.run(0.6);
  expect(s.game.systems.quests.tracked()!.steps[0].at).toEqual({ x: PLACES['river.bank'][0] + 0.5, y: GROUND, z: PLACES['river.bank'][1] + 0.5 });
  expect(s.marks.get('gus')).toBe('');
});

test('the grey fox pack marker points at its authored encounter, rather than the boar', () => {
 const p = newPlay({seed:7});p.advance(.5);p.sys.quests.skipTo('greywood');
 const q = QUESTS.find(q=>q.id==='greywood')!;
 const pack=q.steps.find(s=>s.id==='foxes')!;
 const at=p.sys.region.place(pack.place!).at;
 expect(Math.hypot(at.x-4,at.z+328)).toBeLessThan(1);
});
