import { expect, test } from 'bun:test';
import type { AlmanacPage, Recipe } from '../api.sim.ts';
import { DEFAULT_SETTINGS, addToast, expireToasts, gridMove, groupPages, initials, missingReason, readSettings, type ToastLine } from './logic.ui.ts';

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

test('only four toasts show, and the oldest leaves first', () => {
  const lines: ToastLine[] = [];
  for (const text of ['a', 'b', 'c', 'd', 'e']) addToast(lines, text, undefined, 0);
  expect(lines.map((line) => line.text)).toEqual(['b', 'c', 'd', 'e']);
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
