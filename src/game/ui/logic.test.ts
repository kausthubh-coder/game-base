import { expect, test } from 'bun:test';
import type { AlmanacPage, Recipe } from '../api.sim.ts';
import type { ItemDef } from '../api.sim.ts';
import { DEFAULT_SETTINGS, addToast, expireToasts, gridMove, groupPages, half, initials, itemUse, missingReason, readSettings, slotMove, type ToastLine } from './logic.ui.ts';

const bed: Recipe = { id: 'bed', makes: { id: 'bed', count: 1 }, needs: [{ id: 'planks', count: 6 }, { id: 'fiber', count: 3 }], station: 'workbench' };
const names: Record<string, string> = { planks: 'Planks', fiber: 'Fiber' };
const reason = (bag: Record<string, number>, canMake: boolean): string | null => missingReason(bed, (id) => bag[id] ?? 0, (id) => names[id], canMake);

test('a recipe with everything in the bag has no reason', () => {
  expect(reason({ planks: 6, fiber: 3 }, true)).toBeNull();
});

test('the reason names each thing the bag is short of', () => {
  expect(reason({ planks: 2, fiber: 3 }, false)).toBe('Not enough planks');
  expect(reason({ planks: 2 }, false)).toBe('Not enough planks and fiber');
});

test('a recipe that cannot be made for another cause still gets a reason', () => {
  expect(reason({ planks: 6, fiber: 3 }, false)).toBe('Cannot make this right now');
});

test('a repeated toast becomes one line with a count and a fresh three seconds', () => {
  const lines: ToastLine[] = [];
  addToast(lines, 'Oak log', 'wood', 0);
  addToast(lines, 'Fiber', undefined, 500);
  addToast(lines, 'Oak log', 'wood', 2000);
  expect(lines.map((line) => [line.text, line.count, line.until])).toEqual([['Oak log', 2, 5000], ['Fiber', 1, 3500]]);
  expect(expireToasts(lines, 3499)).toBe(false);
  expect(expireToasts(lines, 3500)).toBe(true);
  expect(lines.map((line) => line.text)).toEqual(['Oak log']);
});

test('only three toasts show, and the oldest leaves first', () => {
  const lines: ToastLine[] = [];
  for (const text of ['a', 'b', 'c', 'd', 'e']) addToast(lines, text, undefined, 0);
  expect(lines.map((line) => line.text)).toEqual(['c', 'd', 'e']);
});

const page = (id: string, kind: AlmanacPage['kind'], seen: boolean): AlmanacPage => ({ id, title: id, picture: id, kind, facts: [], complete: false, seen });

test('the Almanac lists only pages the player has met, grouped by kind in a fixed order', () => {
  const groups = groupPages([page('wheat', 'crop', true), page('leaftail', 'pet', false), page('mossling', 'creature', true), page('gus', 'person', true)]);
  expect(groups.map((group) => [group.label, group.pages.map((p) => p.id)])).toEqual([['Creatures', ['mossling']], ['Crops', ['wheat']], ['People', ['gus']]]);
});

test('arrow keys move through the bag grid and stop at its edges', () => {
  expect(gridMove(0, 'ArrowRight', 9, 36)).toBe(1);
  expect(gridMove(8, 'ArrowRight', 9, 36)).toBe(8);
  expect(gridMove(0, 'ArrowLeft', 9, 36)).toBe(0);
  expect(gridMove(4, 'ArrowDown', 9, 36)).toBe(13);
  expect(gridMove(31, 'ArrowDown', 9, 36)).toBe(31);
  expect(gridMove(4, 'ArrowUp', 9, 36)).toBe(4);
  expect(gridMove(13, 'Home', 9, 36)).toBe(9);
  expect(gridMove(13, 'End', 9, 36)).toBe(17);
  expect(gridMove(7, 'ArrowDown', 6, 36)).toBe(13);
  expect(gridMove(7, 'a', 6, 36)).toBe(7);
});

test('stored settings are read back, and anything broken falls back to the default', () => {
  expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
  expect(readSettings('{not json')).toEqual(DEFAULT_SETTINGS);
  expect(readSettings(JSON.stringify({ quality: 'low', music: 0.25, voice: 7, size: 1.15, effects: 'loud' }))).toEqual({
    quality: 'low', music: 0.25, ambience: DEFAULT_SETTINGS.ambience, effects: DEFAULT_SETTINGS.effects, voice: 1, size: 1.15,
  });
  expect(readSettings(JSON.stringify({ quality: 'ultra', size: 3 }))).toEqual(DEFAULT_SETTINGS);
});

test('an item with no icon shows its first two letters', () => {
  expect(initials('Oak planks')).toBe('Oa');
  expect(initials('moss tuft')).toBe('Mo');
  expect(initials('')).toBe('?');
});

test('arrow keys walk the quick row and the bag as two grids, and cross between them', () => {
  // 9 columns: one quick row, three bag rows.
  expect(slotMove(4, 'ArrowDown', 9, 36)).toBe(13);
  expect(slotMove(13, 'ArrowUp', 9, 36)).toBe(4);
  expect(slotMove(31, 'ArrowDown', 9, 36)).toBe(31);
  expect(slotMove(8, 'ArrowRight', 9, 36)).toBe(8);
  expect(slotMove(9, 'ArrowLeft', 9, 36)).toBe(9);
  expect(slotMove(20, 'End', 9, 36)).toBe(26);
  // 6 columns on a phone: the quick row is 6 and 3, the bag 6, 6, 6, 6 and 3.
  expect(slotMove(2, 'ArrowDown', 6, 36)).toBe(8);
  expect(slotMove(4, 'ArrowDown', 6, 36)).toBe(8);
  expect(slotMove(7, 'ArrowDown', 6, 36)).toBe(10);
  expect(slotMove(8, 'ArrowRight', 6, 36)).toBe(8);
  expect(slotMove(11, 'ArrowUp', 6, 36)).toBe(8);
  expect(slotMove(9, 'ArrowUp', 6, 36)).toBe(6);
  expect(slotMove(29, 'ArrowDown', 6, 36)).toBe(35);
  expect(slotMove(35, 'ArrowRight', 6, 36)).toBe(35);
  expect(slotMove(6, 'End', 6, 36)).toBe(8);
});

test('a split takes the bigger half', () => {
  expect([1, 2, 7, 14].map(half)).toEqual([1, 1, 4, 7]);
});

test('an item says what it is for by what it does', () => {
  const item = (more: Partial<ItemDef>): ItemDef => ({ id: 'x', name: 'X', icon: 'x', stack: 99, description: '', ...more });
  expect(itemUse(item({ tool: { kind: 'axe', tier: 1 } }))).toBe('Tool. Hold the left button on a tree to fell it.');
  expect(itemUse(item({ seed: 'wheat' }))).toBe('The right button plants it in tilled soil.');
  expect(itemUse(item({ placeable: 'bed' }))).toBe('The right button sets it down.');
  expect(itemUse(item({ block: 4 }))).toBe('The right button builds with it.');
  expect(itemUse(item({ treat: true }))).toBe('Pets like it. Hold it out with the right button.');
  expect(itemUse(item({}))).toBeNull();
});
