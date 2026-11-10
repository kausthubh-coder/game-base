import { expect, test } from 'bun:test';
import { createEvents, createFlags, createRandom } from './kernel.sim.ts';

test('events reach named listeners and the catch-all, until they unsubscribe', () => {
  const events = createEvents();
  const heard: string[] = [];
  const off = events.on('toast', (t) => heard.push(t.text));
  events.onAny((name) => heard.push('any:' + name));
  events.emit('toast', { text: 'hello' });
  off();
  events.emit('toast', { text: 'again' });
  expect(heard).toEqual(['hello', 'any:toast', 'any:toast']);
});

test('a flag change sends one event, and adding counts from zero', () => {
  const events = createEvents();
  const flags = createFlags(events);
  let changes = 0;
  events.on('flag.changed', () => changes++);
  flags.set('met.tamsin', true);
  flags.set('met.tamsin', true);
  expect(flags.is('met.tamsin')).toBe(true);
  expect(flags.add('wheat.delivered', 5)).toBe(5);
  expect(flags.add('wheat.delivered', 3)).toBe(8);
  expect(changes).toBe(3);
});

test('the same seed gives the same numbers', () => {
  const a = createRandom(7), b = createRandom(7);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
