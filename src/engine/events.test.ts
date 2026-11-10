import { expect, test } from 'bun:test';
import { createBus, type GameEvent } from './events.ts';

test('a listener hears events until it unsubscribes', () => {
  const bus = createBus<GameEvent>();
  const heard: string[] = [];
  const off = bus.on((e) => heard.push(e.type));
  bus.emit({ type: 'jump', at: { x: 0, y: 0, z: 0 } });
  off();
  bus.emit({ type: 'pickup', at: { x: 0, y: 0, z: 0 } });
  expect(heard).toEqual(['jump']);
});
