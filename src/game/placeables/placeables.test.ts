import { expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import type { Placed } from '../api.sim.ts';
import { makeStage, type Stage } from '../actions/stage.ts';
import { NO_ROOF_TOAST, TOO_EARLY_TOAST } from './index.sim.ts';

const STONE = blockId('stone');

const named = (s: Stage, name: string) => s.heard.filter((e) => e.name === name).map((e) => e.data);

test('the three kinds are a workbench, a bed and a chest, each with its station', () => {
  const { placeables } = makeStage().kernel.game.systems;
  expect(placeables.defs().map((def) => [def.kind, def.station, def.prompt])).toEqual([
    ['workbench', 'workbench', 'Craft'],
    ['bed', 'bed', 'Sleep'],
    ['chest', 'chest', 'Open'],
  ]);
});

test('placing a workbench sends placeable.placed, fills its cell, and near() is true within the radius', () => {
  const s = makeStage();
  const g = s.ground, { placeables } = s.kernel.game.systems;
  const bench = placeables.place('workbench', 7, g, 5, 1);
  expect(bench).toEqual({ id: 'workbench:1', kind: 'workbench', x: 7, y: g, z: 5, quarterTurns: 1 });
  expect(named(s, 'placeable.placed')).toEqual([{ kind: 'workbench', x: 7, y: g, z: 5 }]);
  expect(placeables.all()).toEqual([bench as Placed]);
  expect(placeables.at(7, g, 5)).toBe(bench);
  expect(placeables.at(7.9, g + 0.5, 5.2)).toBe(bench);
  expect(placeables.at(8, g, 5)).toBeNull();
  expect(placeables.at(7, g + 1, 5)).toBeNull();

  expect(placeables.near('workbench', { x: 5.5, y: g, z: 5.5 }, 5)).toBe(true);
  expect(placeables.near('bed', { x: 5.5, y: g, z: 5.5 }, 5)).toBe(false);
  // The distance is to its nearest side: 5.5 blocks from here.
  expect(placeables.near('workbench', { x: 1.5, y: g, z: 5.5 }, 5)).toBe(false);
  expect(placeables.near('workbench', { x: 1.5, y: g, z: 5.5 }, 5.5)).toBe(true);
});

test('a taken space, a solid block and an unknown kind all return null', () => {
  const s = makeStage();
  const g = s.ground, { placeables } = s.kernel.game.systems;
  expect(placeables.place('workbench', 7, g, 5, 0)).not.toBeNull();
  expect(placeables.place('chest', 7, g, 5, 0)).toBeNull();
  expect(placeables.place('chest', 7, g - 1, 5, 0)).toBeNull();
  expect(placeables.place('throne', 8, g, 5, 0)).toBeNull();
  expect(placeables.place('chest', 8, g, 5, -1)).toMatchObject({ id: 'chest:2', quarterTurns: 3 });
  expect(placeables.all().length).toBe(2);
  expect(named(s, 'placeable.placed').length).toBe(2);
});

test('the bed shows "Sleep", sleeps when the time system allows it, and says why not when it does not', () => {
  const s = makeStage();
  const g = s.ground, { placeables, interact } = s.kernel.game.systems;
  placeables.place('bed', 6, g, 5, 0);
  expect(interact.nearest()?.prompt()).toBe('Sleep');

  expect(interact.act()).toBe(true);
  expect(s.toasts()).toEqual([NO_ROOF_TOAST]);
  // One block over the bed is a roof, with the player beside it in the open: the bed fills its block,
  // so nobody can stand under that block. The only reason left is the hour.
  s.world.setBlock(6, g + 1, 5, STONE);
  interact.act();
  expect(s.toasts()).toEqual([NO_ROOF_TOAST, TOO_EARLY_TOAST]);
  // A roof over the player alone is a roof too.
  s.world.setBlock(6, g + 1, 5, 0);
  s.world.setBlock(5, g + 2, 5, STONE);
  interact.act();
  expect(s.toasts()).toEqual([NO_ROOF_TOAST, TOO_EARLY_TOAST, TOO_EARLY_TOAST]);
  expect(s.time.slept).toBe(0);

  s.time.canSleep = true;
  expect(interact.act()).toBe(true);
  expect(s.time.slept).toBe(1);
  expect(s.toasts().length).toBe(3);
});

test('a workbench and a chest show their prompt only while a panel listens, and tell it when they are used', () => {
  const s = makeStage();
  const g = s.ground, { placeables, interact } = s.kernel.game.systems;
  placeables.place('workbench', 4, g, 5, 0);
  const chest = placeables.place('chest', 6, g, 6, 0);
  expect(interact.nearest()).toBeNull();
  expect(interact.act()).toBe(false);

  const used: Placed[] = [];
  const off = placeables.onUse?.((placed) => used.push(placed));
  expect(interact.nearest()?.prompt()).toBe('Craft');
  expect(interact.nearest()?.id).toBe('placeable:workbench:1');

  // Both are in range from here, and the chest is the closer of the two.
  Object.assign(s.kernel.game.player.pos, { x: 5.7, z: 6.5 });
  expect(interact.nearest()?.prompt()).toBe('Open');
  expect(interact.act()).toBe(true);
  expect(used).toEqual([chest as Placed]);
  expect(named(s, 'ui.sound')).toEqual([{ sound: 'open' }]);

  off?.();
  expect(interact.nearest()).toBeNull();
});

test('the secondary button on a placed thing uses it', () => {
  const s = makeStage();
  const g = s.ground, { placeables, actions, inventory } = s.kernel.game.systems;
  placeables.place('bed', 7, g, 5, 0);
  inventory.add('dirt', 3);
  s.time.canSleep = true;
  // The pointer crosses the bed's cell and lands on the floor under it.
  expect(actions.use(s.context('secondary', s.hit(7, g - 1, 5)))).toBe(true);
  expect(s.time.slept).toBe(1);
  expect(inventory.count('dirt')).toBe(3);
  // The primary button does not use it.
  expect(actions.use(s.context('primary', null))).toBe(false);
  expect(s.time.slept).toBe(1);
  // Busy: nothing happens.
  s.kernel.game.player.busy = true;
  expect(actions.use(s.context('secondary', s.hit(7, g - 1, 5)))).toBe(false);
  expect(s.time.slept).toBe(1);
});

test('remove takes it out of the world and out of the prompts', () => {
  const s = makeStage();
  const g = s.ground, { placeables, interact } = s.kernel.game.systems;
  const bed = placeables.place('bed', 6, g, 5, 0) as Placed;
  placeables.remove(bed.id);
  placeables.remove(bed.id);
  expect(placeables.all()).toEqual([]);
  expect(placeables.at(6, g, 5)).toBeNull();
  expect(placeables.near('bed', s.kernel.game.player.pos, 5)).toBe(false);
  expect(interact.nearest()).toBeNull();
  expect(placeables.place('bed', 6, g, 5, 0)).toMatchObject({ id: 'bed:2' });
});

test('save then load gives the same bag and the same stations', () => {
  const first = makeStage();
  const g = first.ground, a = first.kernel.game.systems;
  a.inventory.add('axe', 1);
  a.inventory.add('plank', 130);
  a.inventory.add('berry', 3);
  a.inventory.move(3, 17);
  a.inventory.selected = 2;
  a.placeables.place('workbench', 7, g, 5, 0);
  const gone = a.placeables.place('chest', 8, g, 5, 0) as Placed;
  // The bed is two blocks long: turned three times it lies along x, on 5 and 6.
  a.placeables.place('bed', 5, g, 5, 3);
  a.placeables.remove(gone.id);
  const save = JSON.parse(JSON.stringify(first.kernel.save()));

  const second = makeStage(1, save);
  const b = second.kernel.game.systems;
  expect(b.inventory.slots).toEqual(a.inventory.slots);
  expect(b.inventory.slots[17]).toEqual({ id: 'berry', count: 3 });
  expect(b.inventory.selected).toBe(2);
  expect(b.inventory.held()).toEqual({ id: 'plank', count: 31 });
  expect(b.placeables.all()).toEqual(a.placeables.all());
  expect(b.placeables.all()).toEqual([
    { id: 'workbench:1', kind: 'workbench', x: 7, y: g, z: 5, quarterTurns: 0 },
    { id: 'bed:3', kind: 'bed', x: 5, y: g, z: 5, quarterTurns: 3 },
  ]);

  // The loaded stations work: cells, near(), the prompt, and the next id.
  expect(b.placeables.at(7, g, 5)?.kind).toBe('workbench');
  expect([b.placeables.at(5, g, 5)?.kind, b.placeables.at(6, g, 5)?.kind]).toEqual(['bed', 'bed']);
  expect(b.placeables.near('workbench', second.kernel.game.player.pos, 5)).toBe(true);
  expect(b.interact.nearest()?.prompt()).toBe('Sleep');
  expect(b.placeables.place('chest', 7, g, 5, 0)).toBeNull();
  expect(b.placeables.place('chest', 8, g, 5, 0)).toMatchObject({ id: 'chest:4' });

  // Loading over a game in progress replaces what stood there, and does not announce the stations again.
  second.kernel.load(save);
  expect(b.placeables.all().length).toBe(2);
  expect(b.placeables.at(8, g, 5)).toBeNull();
  expect(b.interact.nearest()?.id).toBe('placeable:bed:3');
  expect(named(second, 'placeable.placed')).toEqual([{ kind: 'chest', x: 8, y: g, z: 5 }]);
});
