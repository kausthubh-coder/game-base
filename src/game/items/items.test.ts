import { expect, test } from 'bun:test';
import { BLOCKS, blockId } from '../../content/blocks.ts';
import { World } from '../../features/world/world.sim.ts';
import { PLACEABLES } from '../content/placeables.ts';
import { createKernel } from '../kernel.sim.ts';
import { install } from './index.sim.ts';

// The icons the manifest has now, and the ones the art agent is adding.
const ICONS = new Set([
  'wood', 'stone', 'seed', 'wheat', 'berry', 'fish', 'pickaxe', 'axe', 'sword', 'bow', 'staff', 'potion', 'coin', 'key', 'book', 'lantern',
  'plank', 'fiber', 'moss_tuft', 'bread', 'wheat_seeds', 'hoe', 'watering_can', 'shovel', 'hammer', 'workbench', 'bed', 'chest', 'lamp', 'treat', 'map', 'heart',
]);

function items() {
  const kernel = createKernel(new World(1), 1);
  install(kernel);
  return kernel.game.systems.items;
}

test('every item the first part needs is in the table, once', () => {
  const ids = items().all().map((item) => item.id);
  expect(ids.sort()).toEqual([
    'oak_log', 'plank', 'fiber', 'moss_tuft', 'berry', 'wheat', 'wheat_seeds', 'bread',
    'axe', 'hoe', 'watering_can', 'pickaxe',
    'workbench', 'bed', 'chest', 'fence', 'sprinkler',
    'dirt', 'stone', 'cobble', 'oak_plank', 'lamp', 'glass', 'thatch', 'plaster', 'stone_brick', 'sand',
    'almanac', 'river_lamp',
  ].sort());
});

test('each item has a name, a known icon and a stack size, and what it places exists', () => {
  const kinds = new Set(PLACEABLES.map((def) => def.kind));
  for (const item of items().all()) {
    expect(item.name.length).toBeGreaterThan(0);
    expect(item.description.length).toBeGreaterThan(0);
    expect(ICONS.has(item.icon)).toBe(true);
    expect(item.stack).toBeGreaterThanOrEqual(1);
    if (item.block !== undefined) expect(BLOCKS[item.block].solid).toBe(true);
    if (item.placeable !== undefined) expect(kinds.has(item.placeable)).toBe(true);
  }
});

test('the tools, the seed, the treat and the block items say what they are', () => {
  const table = items();
  expect(table.get('axe').tool).toEqual({ kind: 'axe', tier: 1 });
  expect(table.get('pickaxe').tool?.kind).toBe('pickaxe');
  expect(table.get('hoe').tool?.kind).toBe('hoe');
  expect(table.get('watering_can').tool?.kind).toBe('can');
  expect(table.get('axe').stack).toBe(1);
  expect(table.get('wheat_seeds').seed).toBe('wheat');
  expect(table.get('berry').treat).toBe(true);
  expect(table.get('bed').placeable).toBe('bed');
  for (const id of ['dirt', 'stone', 'cobble', 'oak_plank', 'lamp', 'glass', 'thatch', 'plaster', 'stone_brick', 'sand']) {
    expect(table.get(id).block).toBe(blockId(id));
  }
  // A plank is what the player builds with: it places the oak plank block.
  expect(table.get('plank').block).toBe(blockId('oak_plank'));
  expect(table.get('oak_log').block).toBeUndefined();
});

test('an id that is not in the table throws', () => {
  expect(() => items().get('plnak')).toThrow('no item called plnak');
});
