import { expect, test } from 'bun:test';
import { BLOCKS, blockId } from '../../content/blocks.ts';
import { World } from '../../features/world/world.sim.ts';
import { ITEM_IDS } from '../content/ids.ts';
import { PLACEABLES } from '../content/placeables.ts';
import { createKernel } from '../kernel.sim.ts';
import type { ItemId } from '../api.sim.ts';
import { install } from './index.sim.ts';
import manifest from '../../../public/assets/manifest.json';

// The icons the manifest has: the first sheet's names and every named sheet's.
const ICONS = new Set([
  ...Object.keys(manifest.icons.names),
  ...Object.values(manifest.icons.sheets as Record<string, { names: Record<string, unknown> }>).flatMap((sheet) => Object.keys(sheet.names)),
]);

function items() {
  const kernel = createKernel(new World(1), 1);
  install(kernel);
  return kernel.game.systems.items;
}

test('every item id of src/game/content/ids.ts is in the table, once, and the table has no other', () => {
  const ids = items().all().map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect([...ids].sort()).toEqual([...ITEM_IDS].sort());
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
  for (const id of ['dirt', 'stone', 'cobble', 'oak_plank', 'lamp', 'glass', 'thatch', 'plaster', 'stone_brick', 'sand'] as const) {
    expect(table.get(id).block).toBe(blockId(id));
  }
  // A plank is what the player builds with: it places the oak plank block.
  expect(table.get('plank').block).toBe(blockId('oak_plank'));
  expect(table.get('oak_log').block).toBeUndefined();
});

test('an id that is not in the table throws', () => {
  expect(() => items().get('plnak' as ItemId)).toThrow('no item called plnak');
});
