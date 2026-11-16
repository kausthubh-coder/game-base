// The bench on a small stage: a workbench, a bag of farm goods, and the four steps.
import { expect, test } from 'bun:test';
import { makeStage } from '../actions/stage.ts';
import type { GameEvents, ItemId } from '../api.sim.ts';
import { FLAG } from '../content/flags.ts';
import { install } from './index.sim.ts';

function setup() {
  const s = makeStage();
  install(s.kernel);
  const game = s.kernel.game;
  const { bench, inventory, placeables } = game.systems;
  placeables.place('workbench', 6, s.ground, 5, 0);
  const give = (goods: Partial<Record<ItemId, number>>) => { for (const [id, n] of Object.entries(goods)) inventory.add(id as ItemId, n as number); };
  const made: GameEvents['gear.made'][] = [];
  game.events.on('gear.made', (e) => made.push(e));
  return { ...s, game, bench, inventory, give, made };
}

test('a new game carries the guild issue: the weapon picked on grant day, canvas, an empty kit', () => {
  const t = setup();
  expect(t.bench.gear()).toEqual({ weapon: 'sword', tier: 1, fitting: null, armor: 1, kit: [null, null, null] });
  t.game.flags.set(FLAG.choice('weapon'), 'bow');
  expect(t.bench.gear()).toMatchObject({ weapon: 'bow', tier: 1 });
  expect(t.bench.weapons().map((w) => w.weapon)).toContain('bow');
});

test('copper-bound takes copper, a shed pelt and the fitting\'s good, once its quest has begun, at a workbench', () => {
  const t = setup();
  t.game.flags.set(FLAG.choice('weapon'), 'sword');
  const quill = { what: 'sword', tier: 2, fitting: 'quill_edge' } as const;
  expect(t.bench.cost(quill)).toEqual([{ id: 'copper', count: 4 }, { id: 'shed_pelt', count: 1 }, { id: 'quill', count: 3 }]);
  expect(t.bench.why(quill)).toBe('The copper-bound step is not open yet.');
  t.game.flags.set(FLAG.questStarted('copper'), true);
  expect(t.bench.why(quill)).toBe('It needs 4 copper.');
  t.give({ copper: 4, shed_pelt: 1, quill: 3 });
  // A fitting from another step is refused.
  expect(t.bench.why({ what: 'sword', tier: 2, fitting: 'glow_cap' })).toBe('That fitting is not one of this step\'s two.');
  // Away from the workbench, nothing is made.
  Object.assign(t.game.player.pos, { x: 13.5, z: 13.5 });
  expect(t.bench.why(quill)).toBe('Stand at a workbench.');
  Object.assign(t.game.player.pos, { x: 5.5, z: 5.5 });
  expect(t.bench.make(quill)).toBe(true);
  expect(t.bench.gear()).toMatchObject({ weapon: 'sword', tier: 2, fitting: 'quill_edge' });
  expect(['copper', 'shed_pelt', 'quill'].map((id) => t.inventory.count(id as ItemId))).toEqual([0, 0, 0]);
  expect(t.made).toEqual([{ what: 'sword', tier: 2, fitting: 'quill_edge' }]);
  // The step is made once; the next needs its own quest.
  expect(t.bench.why(quill)).toBe('Your sword is already this good.');
  expect(t.bench.why({ what: 'sword', tier: 3, fitting: 'spring_hilt' })).toBe('The brass-fitted step is not open yet.');
});

test('from step 2 the bench makes the two weapons you did not pick, each with its own step and fitting', () => {
  const t = setup();
  t.game.flags.set(FLAG.choice('weapon'), 'staff');
  t.game.flags.set(FLAG.questStarted('copper'), true);
  t.give({ copper: 8, shed_pelt: 2, moss_fiber: 3, quill: 3 });
  expect(t.bench.why({ what: 'bow', tier: 3, fitting: 'glow_cap' })).toBe('The brass-fitted step is not open yet.');
  expect(t.bench.make({ what: 'bow', tier: 2, fitting: 'padded_grip' })).toBe(true);
  expect(t.bench.gear()).toMatchObject({ weapon: 'bow', tier: 2, fitting: 'padded_grip' });
  expect(t.bench.weapons()).toEqual([
    { weapon: 'staff', tier: 1, fitting: null },
    { weapon: 'bow', tier: 2, fitting: 'padded_grip' },
  ]);
  expect(t.bench.wield('staff')).toBe(true);
  expect(t.bench.gear()).toMatchObject({ weapon: 'staff', tier: 1, fitting: null });
  expect(t.bench.wield('sword')).toBe(false);
});

test('armour climbs the same steps with no fitting, and padding the jacket finishes the bench quest\'s first step', () => {
  const t = setup();
  t.game.flags.set(FLAG.questStarted('copper'), true);
  t.game.flags.set(FLAG.questStep('bench'), 'jacket');
  t.give({ shed_pelt: 2, moss_fiber: 4 });
  expect(t.bench.cost({ what: 'armor', tier: 2 })).toEqual([{ id: 'shed_pelt', count: 2 }, { id: 'moss_fiber', count: 4 }]);
  expect(t.bench.why({ what: 'armor', tier: 3 })).toBe('The brass-fitted step is not open yet.');
  expect(t.bench.make({ what: 'armor', tier: 2 })).toBe(true);
  expect(t.bench.gear().armor).toBe(2);
  expect(t.game.flags.is(FLAG.step('bench', 'jacket'))).toBe(true);
});

test('the kit holds three things from the bag, one of each kind, and a thing used up to the last leaves its slot', () => {
  const t = setup();
  t.give({ quill_strip: 2, salve: 1 });
  expect(t.bench.equip(0, 'lamp_post_kit')).toBe(false);
  expect(t.bench.equip(0, 'quill_strip')).toBe(true);
  expect(t.bench.equip(2, 'salve')).toBe(true);
  expect(t.bench.equip(1, 'quill_strip')).toBe(true);
  expect(t.bench.gear().kit).toEqual([null, 'quill_strip', 'salve']);
  t.inventory.remove('salve', 1);
  expect(t.bench.gear().kit).toEqual([null, 'quill_strip', null]);
  t.inventory.remove('quill_strip', 1);
  expect(t.bench.gear().kit).toEqual([null, 'quill_strip', null]);
});

test('save and load keep every weapon, the one in hand, the armour and the kit', () => {
  const t = setup();
  t.game.flags.set(FLAG.questStarted('copper'), true);
  t.give({ copper: 4, shed_pelt: 3, quill: 3, moss_fiber: 4, salve: 1 });
  t.bench.make({ what: 'staff', tier: 2, fitting: 'quill_edge' });
  t.bench.make({ what: 'armor', tier: 2 });
  t.bench.equip(1, 'salve');
  const save = JSON.parse(JSON.stringify(t.kernel.save()));
  const again = makeStage(1, save);
  install(again.kernel);
  again.kernel.load(save);
  expect(again.kernel.game.systems.bench.gear()).toEqual({ weapon: 'staff', tier: 2, fitting: 'quill_edge', armor: 2, kit: [null, 'salve', null] });
});

 test('the bench quest opens padding before copper, while copper weapons stay locked', () => {
  const t = setup();
  t.game.flags.set(FLAG.questStarted('bench'), true);
  t.game.flags.set(FLAG.questStep('bench'), 'jacket');
  t.give({ shed_pelt: 2, moss_fiber: 4 });
  expect(t.bench.why({ what: 'staff', tier: 2, fitting: 'quill_edge' })).toBe('The copper-bound step is not open yet.');
  expect(t.bench.make({ what: 'armor', tier: 2 })).toBe(true);
  expect(t.bench.gear().armor).toBe(2);
  expect(t.inventory.count('shed_pelt')).toBe(0);
  expect(t.inventory.count('moss_fiber')).toBe(0);
  expect(t.game.flags.is(FLAG.step('bench', 'jacket'))).toBe(true);
  expect(t.bench.make({ what: 'armor', tier: 2 })).toBe(false);
});
