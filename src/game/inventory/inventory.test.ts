import { expect, test } from 'bun:test';
import { World } from '../../features/world/world.sim.ts';
import type { EventName, GameEvents } from '../api.sim.ts';
import { install as installItems } from '../items/index.sim.ts';
import { createKernel } from '../kernel.sim.ts';
import { install } from './index.sim.ts';

function bag() {
  const kernel = createKernel(new World(1), 1);
  installItems(kernel);
  install(kernel);
  const heard: { name: EventName; data: GameEvents[EventName] }[] = [];
  kernel.game.events.onAny((name, data) => heard.push({ name, data }));
  const named = (name: EventName) => heard.filter((e) => e.name === name).map((e) => e.data);
  return { kernel, inventory: kernel.game.systems.inventory, heard, named };
}

test('the bag has 36 empty slots and holds the first quick slot', () => {
  const { inventory } = bag();
  expect(inventory.slots.length).toBe(36);
  expect(inventory.slots.every((slot) => slot === null)).toBe(true);
  expect(inventory.selected).toBe(0);
  expect(inventory.held()).toBeNull();
});

test('stacks merge up to the stack size, then spill into the next empty slot', () => {
  const { inventory, named } = bag();
  expect(inventory.add('oak_log', 50)).toBe(0);
  expect(inventory.add('oak_log', 60)).toBe(0);
  expect(inventory.slots[0]).toEqual({ id: 'oak_log', count: 99 });
  expect(inventory.slots[1]).toEqual({ id: 'oak_log', count: 11 });
  expect(inventory.slots[2]).toBeNull();
  expect(inventory.count('oak_log')).toBe(110);
  expect(named('item.gained')).toEqual([{ id: 'oak_log', count: 50 }, { id: 'oak_log', count: 60 }]);
  expect(named('inventory.changed').length).toBe(2);
});

test('a tool takes a slot of its own', () => {
  const { inventory } = bag();
  inventory.add('axe', 2);
  expect(inventory.slots[0]).toEqual({ id: 'axe', count: 1 });
  expect(inventory.slots[1]).toEqual({ id: 'axe', count: 1 });
});

test('a full bag returns what did not fit and gains only what did', () => {
  const { inventory, named } = bag();
  expect(inventory.add('oak_log', 99 * 36 - 4)).toBe(0);
  expect(inventory.add('oak_log', 10)).toBe(6);
  expect(inventory.count('oak_log')).toBe(99 * 36);
  expect(named('item.gained').at(-1)).toEqual({ id: 'oak_log', count: 4 });
  const changes = named('inventory.changed').length;
  expect(inventory.add('fiber', 1)).toBe(1);
  expect(inventory.count('fiber')).toBe(0);
  expect(named('item.gained').length).toBe(2);
  expect(named('inventory.changed').length).toBe(changes);
});

test('item.gained carries the place the item came from', () => {
  const { inventory, named } = bag();
  inventory.add('fiber', 1, { x: 3.5, y: 20.5, z: -4.5 });
  expect(named('item.gained')).toEqual([{ id: 'fiber', count: 1, at: { x: 3.5, y: 20.5, z: -4.5 } }]);
});

test('remove takes nothing unless all of them are there', () => {
  const { inventory, named } = bag();
  inventory.add('plank', 5);
  expect(inventory.remove('plank', 6)).toBe(false);
  expect(inventory.count('plank')).toBe(5);
  expect(named('item.lost')).toEqual([]);
  expect(inventory.remove('wheat', 1)).toBe(false);
  expect(inventory.remove('plank', 5)).toBe(true);
  expect(inventory.count('plank')).toBe(0);
  expect(inventory.slots[0]).toBeNull();
  expect(named('item.lost')).toEqual([{ id: 'plank', count: 5 }]);
});

test('remove takes from the held stack first, then from the back of the bag', () => {
  const { inventory } = bag();
  inventory.add('dirt', 99 * 2 + 10);
  inventory.selected = 1;
  expect(inventory.remove('dirt', 1)).toBe(true);
  expect(inventory.slots.slice(0, 3)).toEqual([{ id: 'dirt', count: 99 }, { id: 'dirt', count: 98 }, { id: 'dirt', count: 10 }]);
  expect(inventory.remove('dirt', 110)).toBe(true);
  expect(inventory.slots.slice(0, 3)).toEqual([{ id: 'dirt', count: 97 }, null, null]);
});

test('the selected quick slot wraps around and says what is held', () => {
  const { inventory, named } = bag();
  inventory.add('axe', 1);
  inventory.add('berry', 3);
  expect(inventory.held()).toEqual({ id: 'axe', count: 1 });
  inventory.selected = 1;
  expect(inventory.held()).toEqual({ id: 'berry', count: 3 });
  inventory.selected = 9;
  expect(inventory.selected).toBe(0);
  inventory.selected = -1;
  expect(inventory.selected).toBe(8);
  expect(inventory.held()).toBeNull();
  expect(named('inventory.changed').length).toBe(5);
});

test('move swaps two slots, merges equal items and leaves the rest behind', () => {
  const { inventory } = bag();
  inventory.add('fiber', 129);
  inventory.remove('fiber', 19);
  expect(inventory.slots.slice(0, 2)).toEqual([{ id: 'fiber', count: 80 }, { id: 'fiber', count: 30 }]);
  inventory.move(1, 0);
  expect(inventory.slots.slice(0, 2)).toEqual([{ id: 'fiber', count: 99 }, { id: 'fiber', count: 11 }]);
  inventory.add('axe', 1);
  inventory.move(2, 20);
  expect(inventory.slots[2]).toBeNull();
  expect(inventory.slots[20]).toEqual({ id: 'axe', count: 1 });
  inventory.move(1, 20);
  expect(inventory.slots[1]).toEqual({ id: 'axe', count: 1 });
  expect(inventory.slots[20]).toEqual({ id: 'fiber', count: 11 });
  inventory.move(0, 99);
  inventory.move(-1, 0);
  inventory.move(5, 5);
  expect(inventory.slots[0]).toEqual({ id: 'fiber', count: 99 });
  expect(inventory.count('fiber')).toBe(110);
});

test('save then load gives the same bag, and drops an item that no longer exists', () => {
  const first = bag();
  first.inventory.add('axe', 1);
  first.inventory.add('wheat', 120);
  first.inventory.move(1, 30);
  first.inventory.selected = 4;
  const save = JSON.parse(JSON.stringify(first.kernel.save()));

  const second = bag();
  second.inventory.add('berry', 7);
  second.kernel.load(save);
  expect(second.inventory.slots).toEqual(first.inventory.slots);
  expect(second.inventory.selected).toBe(4);
  expect(second.inventory.count('berry')).toBe(0);
  expect(second.named('inventory.changed').length).toBe(2);

  save.systems.inventory.slots[0] = { id: 'gone', count: 3 };
  second.kernel.load(save);
  expect(second.inventory.slots[0]).toBeNull();
  expect(second.inventory.count('wheat')).toBe(120);
});
