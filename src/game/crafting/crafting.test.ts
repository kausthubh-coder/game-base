import { expect, test } from 'bun:test';
import { World } from '../../features/world/world.sim.ts';
import type { GameEvents } from '../api.sim.ts';
import { createKernel } from '../kernel.sim.ts';
import { installFakes } from './fakes.ts';
import { install } from './index.sim.ts';

function setup(room = Infinity) {
  const kernel = createKernel(new World(1), 7);
  const fakes = installFakes(kernel, room);
  install(kernel);
  const crafted: GameEvents['item.crafted'][] = [];
  kernel.game.events.on('item.crafted', (made) => crafted.push(made));
  return { game: kernel.game, crafting: kernel.game.systems.crafting, crafted, ...fakes };
}

const WORKBENCH = { x: 3, y: 0, z: 0 };

test('the recipes are the ones in the design', () => {
  const { crafting } = setup();
  const lines = crafting.recipes().map((r) => `${r.station}: ${r.needs.map((n) => `${n.count} ${n.id}`).join(' + ')} -> ${r.makes.count} ${r.makes.id}`);
  expect(lines).toEqual([
    'hand: 1 oak_log -> 4 plank',
    'hand: 4 plank -> 1 workbench',
    'workbench: 6 plank + 3 fiber -> 1 bed',
    'workbench: 8 plank -> 1 chest',
    'workbench: 1 plank + 1 moss_tuft -> 1 lamp',
    'workbench: 2 plank + 1 fiber -> 4 fence',
    'workbench: 4 plank + 2 moss_tuft -> 1 sprinkler',
  ]);
});

test('available() lists hand recipes, and station recipes only within 5 blocks of the station', () => {
  const { crafting, placeables, game } = setup();
  expect(crafting.available().map((r) => r.id)).toEqual(['plank', 'workbench']);
  placeables.stand('workbench', WORKBENCH);
  expect(crafting.available().map((r) => r.id)).toEqual(['plank', 'workbench', 'bed', 'chest', 'lamp', 'fence', 'sprinkler']);
  game.player.pos.x = -2;
  expect(crafting.available().map((r) => r.id)).toEqual(['plank', 'workbench', 'bed', 'chest', 'lamp', 'fence', 'sprinkler']);
  game.player.pos.x = -2.5;
  expect(crafting.available().map((r) => r.id)).toEqual(['plank', 'workbench']);
});

test('the bed recipe needs a workbench nearby', () => {
  const { crafting, bag, placeables, crafted } = setup();
  bag.add('plank', 6);
  bag.add('fiber', 3);
  expect(crafting.canMake('bed')).toBe(false);
  expect(crafting.make('bed')).toBe(false);
  expect([bag.count('plank'), bag.count('fiber'), bag.count('bed')]).toEqual([6, 3, 0]);

  placeables.stand('workbench', WORKBENCH);
  expect(crafting.canMake('bed')).toBe(true);
  expect(crafting.make('bed')).toBe(true);
  expect([bag.count('plank'), bag.count('fiber'), bag.count('bed')]).toEqual([0, 0, 1]);
  expect(crafted).toEqual([{ id: 'bed', count: 1, station: 'workbench' }]);
});

test('make() removes the inputs, adds the output and sends item.crafted', () => {
  const { crafting, bag, crafted } = setup();
  bag.add('oak_log', 3);
  expect(crafting.make('plank')).toBe(true);
  expect([bag.count('oak_log'), bag.count('plank')]).toEqual([2, 4]);
  expect(crafting.make('workbench')).toBe(true);
  expect([bag.count('plank'), bag.count('workbench')]).toEqual([0, 1]);
  expect(crafted).toEqual([
    { id: 'plank', count: 4, station: 'hand' },
    { id: 'workbench', count: 1, station: 'hand' },
  ]);
});

test('make() fails without the inputs and changes nothing', () => {
  const { crafting, bag, placeables, crafted } = setup();
  placeables.stand('workbench', WORKBENCH);
  bag.add('plank', 5);
  bag.add('fiber', 3);
  expect(crafting.canMake('bed')).toBe(false);
  expect(crafting.make('bed')).toBe(false);
  expect(crafting.make('plank')).toBe(false);
  expect(crafting.make('no such recipe')).toBe(false);
  expect([bag.count('plank'), bag.count('fiber'), bag.count('bed'), bag.count('oak_log')]).toEqual([5, 3, 0, 0]);
  expect(crafted).toEqual([]);
});

test('make() fails when the bag has no room for the output, and the inputs stay', () => {
  // Room for 3 items: one log goes out, four planks do not fit.
  const { crafting, bag, crafted, game } = setup(3);
  const toasts: string[] = [];
  game.events.on('toast', (t) => toasts.push(t.text));
  bag.add('oak_log', 2);
  expect(crafting.make('plank')).toBe(false);
  expect([bag.count('oak_log'), bag.count('plank')]).toEqual([2, 0]);
  expect(crafted).toEqual([]);
  expect(toasts).toEqual(['Your bag is full.']);
});
