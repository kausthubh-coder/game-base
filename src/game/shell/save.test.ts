// The save's version rule: act 1 writes version 2, and a save from before it is not continued.
import { afterAll, afterEach, expect, test } from 'bun:test';
import { SAVE_VERSION } from '../kernel.sim.ts';
import { SAVE_KEY, hasOldSave, hasSave, readSave } from './save.ts';

const items = new Map<string, string>();
const store = { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value), removeItem: (key: string) => void items.delete(key) };
const before = (globalThis as { localStorage?: unknown }).localStorage;
(globalThis as { localStorage?: unknown }).localStorage = store;
afterEach(() => items.clear());
afterAll(() => {
  (globalThis as { localStorage?: unknown }).localStorage = before;
});

const file = (version: number): string => JSON.stringify({ version, at: 1, world: { edits: [] }, game: { version, flags: [], player: { x: 0, y: 0, z: 0, facing: 0 }, clock: { day: 1, timeOfDay: 0.3, seconds: 0 }, systems: {} } });

test('a save of this version is continued, and is not an old one', () => {
  expect(SAVE_VERSION).toBe(2);
  items.set(SAVE_KEY, file(2));
  expect(readSave()?.version).toBe(2);
  expect(hasSave()).toBe(true);
  expect(hasOldSave()).toBe(false);
});

test('a save from before act 1 is not continued: Continue has nothing, and a new game knows to say why', () => {
  items.set(SAVE_KEY, file(1));
  expect(readSave()).toBeNull();
  expect(hasSave()).toBe(false);
  expect(hasOldSave()).toBe(true);
});

test('no save, or one that is not a save, is not an old save', () => {
  expect(hasOldSave()).toBe(false);
  items.set(SAVE_KEY, 'not json');
  expect(hasOldSave()).toBe(false);
});
