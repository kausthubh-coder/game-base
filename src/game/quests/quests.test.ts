import { expect, test } from 'bun:test';
import { QUESTS } from '../content/quests.ts';
import { GROUND, PLACES, stage } from '../story/fakes.ts';
import { holds } from './rules.sim.ts';

test('the five quests and their steps have the ids in act1.md', () => {
  expect(QUESTS.map((q) => [q.id, q.steps.map((s) => s.id)])).toEqual([
    ['plot', ['meet', 'watch', 'tell']],
    ['roof', ['wood', 'bench', 'shelter', 'sleep']],
    ['leaftail', ['find', 'berries', 'trust', 'show']],
    ['bread', ['town', 'queen', 'seeds', 'grow', 'deliver']],
    ['festival', ['evening', 'lamp', 'end']],
  ]);
  expect(QUESTS.map((q) => q.title)).toEqual([
    'A plot of your own', 'A roof before dark', 'Leaf and tail', 'The queen\'s bread', 'The harvest festival',
  ]);
});

test('a new game starts the first quest, tracks it and marks Tamsin', () => {
  const s = stage({ story: false });
  expect(s.game.systems.quests.all()).toEqual([]);
  s.run(0.05);
  const quests = s.game.systems.quests;
  expect(s.events('quest.started')).toEqual([{ quest: 'plot' }]);
  expect(s.game.flags.is('quest.plot.started')).toBe(true);
  expect(s.game.flags.is('quest.plot.done')).toBe(false);
  expect(s.game.flags.get('quest.plot.step')).toBe('meet');
  const tracked = quests.tracked()!;
  expect(tracked.id).toBe('plot');
  expect(tracked.state).toBe('active');
  expect(tracked.steps.map((step) => step.done)).toEqual([false, false, false]);
  // The open step points at Tamsin, who stands at the grant stone.
  expect(tracked.steps[0].at).toEqual({ x: PLACES['grant.stone'][0] + 0.5, y: GROUND, z: PLACES['grant.stone'][1] + 0.5 });
  expect(tracked.steps[1].at).toBeUndefined();
  expect(s.marks.get('tamsin')).toBe('quest');
  expect(quests.all().map((q) => q.state)).toEqual(['active', 'hidden', 'hidden', 'hidden', 'hidden']);
  // The same objects come back until something changes, so the HUD can read them every frame.
  expect(quests.tracked()).toBe(tracked);
});

test('a step finishes when its condition holds: flags, events and the mark follow', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.flags.set('plot.met', true);
  s.run(0.05);
  expect(s.events('quest.step')).toEqual([{ quest: 'plot', step: 'meet' }]);
  expect(s.game.flags.get('quest.plot.step')).toBe('watch');
  expect(s.marks.get('tamsin')).toBe('');
  const watch = s.game.systems.quests.tracked()!.steps[1];
  expect(watch).toMatchObject({ id: 'watch', done: false, have: 0, need: 2 });
  expect(watch.at).toEqual({ x: PLACES['grant.rocks'][0] + 0.5, y: GROUND, z: PLACES['grant.rocks'][1] + 0.5 });

  s.game.systems.almanac.learn('mossling', 'needs');
  s.run(0.05);
  expect(s.game.systems.quests.tracked()!.steps[1]).toMatchObject({ done: false, have: 1, need: 2 });
  s.game.systems.almanac.learn('mossling', 'gives');
  s.run(0.05);
  expect(s.game.flags.get('quest.plot.step')).toBe('tell');
  expect(s.marks.get('tamsin')).toBe('quest');

  s.game.flags.set('plot.told', true);
  s.run(0.05);
  expect(s.events('quest.step').map((e) => (e as { step: string }).step)).toEqual(['meet', 'watch', 'tell']);
  expect(s.events('quest.completed')).toEqual([{ quest: 'plot' }]);
  expect(s.game.flags.is('quest.plot.done')).toBe(true);
  expect(s.game.flags.get('quest.plot.step')).toBe('');
  expect(s.marks.get('tamsin')).toBe('');
  // Nothing follows the first quest by itself: Tamsin's words start the next one.
  expect(s.game.systems.quests.tracked()).toBeNull();
  expect(s.game.systems.quests.all()[0].steps.every((step) => step.done)).toBe(true);
});

test('a gate cannot be skipped: the page alone does not pass the talk with Tamsin', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.systems.almanac.learn('mossling', 'needs');
  s.game.systems.almanac.learn('mossling', 'gives');
  s.game.flags.set('plot.told', true);
  s.run(1);
  expect(s.game.flags.get('quest.plot.step')).toBe('meet');
  expect(s.events('quest.step')).toEqual([]);
});

test('conditions without an event are found by the check twice a second', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.systems.quests.skipTo('roof');
  s.bag.set('oak_log', 7);
  s.run(0.6);
  expect(s.game.systems.quests.tracked()!.steps[0]).toMatchObject({ id: 'wood', done: false, have: 7, need: 12 });
  s.bag.set('oak_log', 30);
  s.run(0.3);
  expect(s.game.flags.get('quest.roof.step')).toBe('wood');
  s.run(0.3);
  expect(s.game.flags.get('quest.roof.step')).toBe('bench');
  expect(s.game.systems.quests.tracked()!.steps[0]).toMatchObject({ done: true, have: 12, need: 12 });
});

test('the roof quest: a workbench, a bed with a block over it, a night of sleep, then the leaftail quest starts', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.systems.quests.skipTo('roof');
  expect(s.game.systems.quests.tracked()!.id).toBe('roof');

  // A workbench placed with only four planks passes the wood step too.
  s.game.systems.placeables.place('workbench', 3, GROUND, 3, 0);
  s.run(0.05);
  expect(s.game.flags.get('quest.roof.step')).toBe('shelter');

  s.game.systems.placeables.place('bed', 5, GROUND, 5, 0);
  s.run(0.6);
  expect(s.game.flags.get('quest.roof.step')).toBe('shelter');
  s.game.world.setBlock(5, GROUND + 2, 5, 12);
  s.run(0.6);
  expect(s.game.flags.get('quest.roof.step')).toBe('sleep');

  s.game.systems.time.sleep();
  s.run(0.05);
  expect(s.events('quest.completed')).toEqual([{ quest: 'roof' }]);
  expect(s.events('quest.started').at(-1)).toEqual({ quest: 'leaftail' });
  expect(s.game.systems.quests.tracked()!.id).toBe('leaftail');
});

test('sleeping passes the roof quest even when the bed step was never seen, and only while the quest is open', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.systems.time.sleep();
  s.game.systems.quests.skipTo('roof');
  s.run(0.6);
  // The sleep before the quest began does not count.
  expect(s.game.flags.get('quest.roof.step')).toBe('wood');
  s.game.systems.time.sleep();
  s.run(0.05);
  expect(s.game.flags.is('quest.roof.done')).toBe(true);
});

test('the leaftail quest: feeding berry by berry never leaves a step open, and the waypoint follows the pet', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.systems.quests.skipTo('leaftail');
  const find = s.game.systems.quests.tracked()!.steps[0];
  expect(find.at).toEqual({ x: PLACES['dead.garden'][0] + 0.5, y: GROUND, z: PLACES['dead.garden'][1] + 0.5 });

  s.moveTo('dead.garden');
  s.run(0.6);
  expect(s.game.flags.get('quest.leaftail.step')).toBe('berries');
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
  expect(s.game.flags.get('quest.leaftail.step')).toBe('show');
  expect(s.marks.get('tamsin')).toBe('quest');
  expect(s.marks.get('wren')).toBe('quest');
  // The waypoint is whichever of the two is nearer.
  const show = s.game.systems.quests.tracked()!.steps[3];
  const wren = s.people.get('wren')!.pos, tamsin = s.people.get('tamsin')!.pos;
  const nearer = Math.hypot(wren.x - s.game.player.pos.x, wren.z - s.game.player.pos.z) < Math.hypot(tamsin.x - s.game.player.pos.x, tamsin.z - s.game.player.pos.z) ? wren : tamsin;
  expect(show.at).toEqual({ x: nearer.x, y: nearer.y, z: nearer.z });

  s.game.flags.set('leaftail.shown', true);
  s.run(0.05);
  expect(s.marks.get('tamsin')).toBe('');
  expect(s.marks.get('wren')).toBe('');
});

test('having been to the town gate counts for the bread quest, however long ago', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.moveTo('town.gate');
  s.run(0.6);
  s.moveTo('kennel');
  s.run(0.6);
  expect(s.game.flags.is('been.town.gate')).toBe(true);
  s.game.systems.quests.start('roof');
  s.game.systems.quests.start('bread');
  s.run(0.05);
  expect(s.game.flags.get('quest.bread.step')).toBe('queen');
  expect(s.marks.get('maren')).toBe('quest');
});

test('start does nothing for a quest that is open or done, or that does not exist', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.systems.quests.start('plot');
  s.game.systems.quests.start('nothing');
  expect(s.events('quest.started')).toEqual([{ quest: 'plot' }]);
});

test('skipTo(\'bread\') gives a state the bread quest can finish from', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.systems.quests.skipTo('bread');
  const quests = s.game.systems.quests;
  expect(quests.all().map((q) => q.state)).toEqual(['done', 'done', 'done', 'active', 'hidden']);
  expect(quests.tracked()!.id).toBe('bread');
  for (const flag of ['quest.plot.done', 'quest.roof.done', 'quest.leaftail.done', 'quest.bread.started', 'plot.met', 'plot.told', 'leaftail.shown', 'has.almanac']) {
    expect(s.game.flags.is(flag)).toBe(true);
  }
  expect(s.game.flags.is('quest.bread.done')).toBe(false);
  expect(s.bag.get('almanac')).toBeUndefined();
  expect(s.bag.get('axe')).toBe(1);
  expect(s.game.systems.almanac.page('mossling')!.complete).toBe(true);
  // The leaftail quest was passed over, so the leaftail is bonded.
  expect(s.pet).toMatchObject({ trust: 3, bonded: true });
  expect(s.game.flags.is('pet.leaftail.bonded')).toBe(true);
  // Tamsin has left the grant stone for the lodge.
  expect(s.sent).toContainEqual({ npc: 'tamsin', place: 'lodge' });
  // Skipping sends no quest events for the quests it passed over.
  expect(s.events('quest.completed')).toEqual([]);
  expect(s.events('quest.started').at(-1)).toEqual({ quest: 'bread' });

  // From here the quest plays to its end through the real conversations.
  s.moveTo('town.gate');
  s.run(0.6);
  expect(s.game.flags.get('quest.bread.step')).toBe('queen');
  s.talk('maren');
  s.run(0.05);
  expect(s.game.flags.get('quest.bread.step')).toBe('seeds');
  s.talk('gus');
  s.run(0.05);
  expect(s.game.flags.get('quest.bread.step')).toBe('grow');
  expect([s.bag.get('hoe'), s.bag.get('watering_can'), s.bag.get('wheat_seeds')]).toEqual([1, 1, 12]);
  s.bag.set('wheat', 24);
  s.run(0.6);
  expect(s.game.flags.get('quest.bread.step')).toBe('deliver');
  expect(quests.tracked()!.steps[4]).toMatchObject({ id: 'deliver', have: 20, need: 20 });
  s.talk('maren');
  s.run(0.05);
  expect(s.bag.get('wheat')).toBe(4);
  expect(s.game.flags.is('quest.bread.done')).toBe(true);
  expect(quests.tracked()!.id).toBe('festival');
});

test('skipTo works for every quest and can be called twice', () => {
  for (const def of QUESTS) {
    const s = stage({ story: false });
    s.run(0.05);
    s.game.systems.quests.skipTo(def.id);
    s.game.systems.quests.skipTo(def.id);
    const tracked = s.game.systems.quests.tracked()!;
    expect(tracked.id).toBe(def.id);
    expect(holds(s.game, { quest: def.id, step: tracked.steps.find((step) => !step.done)!.id })).toBe(true);
    // One of each gift, not two.
    if (def.id !== 'plot') expect(s.bag.get('axe')).toBe(1);
    expect(s.sent.at(-1)).toEqual({ npc: 'tamsin', place: def.id === 'plot' ? 'grant.stone' : 'lodge' });
  }
});

test('quests are saved and loaded: the open step, the event already seen and the mark come back', () => {
  const a = stage({ story: false });
  a.run(0.05);
  a.game.systems.quests.skipTo('roof');
  a.game.systems.placeables.place('workbench', 3, GROUND, 3, 0);
  a.run(0.05);
  const save = JSON.parse(JSON.stringify(a.kernel.save()));

  const b = stage({ story: false });
  b.run(0.05);
  b.kernel.load(save);
  b.run(0.05);
  const quests = b.game.systems.quests;
  expect(quests.all().map((q) => q.state)).toEqual(['done', 'active', 'hidden', 'hidden', 'hidden']);
  expect(quests.tracked()!.id).toBe('roof');
  expect(b.game.flags.get('quest.roof.step')).toBe('shelter');
  // Loading sends no quest events of its own.
  expect(b.events('quest.started')).toEqual([{ quest: 'plot' }]);
  expect(b.events('quest.step')).toEqual([]);
  // The mark the new game put over Tamsin is gone, because the loaded quest has nobody to talk to.
  expect(b.marks.get('tamsin')).toBe('');

  // The loaded quest goes on from its step.
  const c = stage({ story: false });
  c.run(0.05);
  c.game.systems.quests.skipTo('bread');
  const later = JSON.parse(JSON.stringify(c.kernel.save()));
  const d = stage({ story: false });
  d.kernel.load(later);
  d.run(0.05);
  expect(d.game.flags.get('quest.bread.step')).toBe('town');
  expect(d.game.systems.quests.tracked()!.steps[0].at).toEqual({ x: PLACES['town.gate'][0] + 0.5, y: GROUND, z: PLACES['town.gate'][1] + 0.5 });
  d.moveTo('town.gate');
  d.run(0.6);
  expect(d.game.flags.get('quest.bread.step')).toBe('queen');
  expect(d.marks.get('maren')).toBe('quest');
});

test('the lamp step points at Odo until the river lamp is in the bag, then at the river bank', () => {
  const s = stage({ story: false });
  s.run(0.05);
  s.game.systems.quests.skipTo('festival');
  s.game.flags.set('festival.started', true);
  s.moveTo('town.square');
  s.run(0.6);
  expect(s.game.flags.get('quest.festival.step')).toBe('lamp');
  const odo = s.people.get('odo')!.pos;
  expect(s.game.systems.quests.tracked()!.steps[1].at).toEqual({ x: odo.x, y: odo.y, z: odo.z });
  expect(s.marks.get('odo')).toBe('quest');

  s.bag.set('river_lamp', 1);
  s.run(0.6);
  expect(s.game.systems.quests.tracked()!.steps[1].at).toEqual({ x: PLACES['river.bank'][0] + 0.5, y: GROUND, z: PLACES['river.bank'][1] + 0.5 });
  expect(s.marks.get('odo')).toBe('');
});
