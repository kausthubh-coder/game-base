import { describe, expect, test } from 'bun:test';
import { jsonCodec } from './codec.ts';
import { MAX_ACTS, readClientMessage, type Act, type ClientMessage, type Snap } from './messages.ts';
import { applySnap, createNear } from './near.ts';

const use: Act = { a: 'use', button: 'secondary', x: 1, y: 20, z: -3, nx: 0, ny: 1, nz: 0 };

describe('messages from a browser', () => {
  test('a hello and an input come back as they went', () => {
    const messages: ClientMessage[] = [
      { t: 'hello', build: 'abc123', token: 'dev:ann' },
      { t: 'input', n: 7, mx: 0.5, mz: -1, jump: true },
      { t: 'input', n: 8, mx: 0, mz: 0, jump: false, acts: [{ a: 'slot', slot: 3 }, use, { a: 'hold', x: 1, y: 2, z: 3, nx: -1, ny: 0, nz: 0 }] },
    ];
    for (const message of messages) expect(jsonCodec.decodeClient(jsonCodec.encode(message))).toEqual(message);
  });

  test('anything that is not exactly a message is null', () => {
    const bad: unknown[] = [
      null, 7, 'hello', [], {},
      { t: 'hello', build: 'abc' },
      { t: 'hello', build: 7, token: 'x' },
      { t: 'hello', build: 'abc', token: 'x'.repeat(9000) },
      { t: 'input', n: 0, mx: 0, mz: 0, jump: false },
      { t: 'input', n: 1.5, mx: 0, mz: 0, jump: false },
      { t: 'input', n: 1, mx: 2, mz: 0, jump: false },
      { t: 'input', n: 1, mx: Number.NaN, mz: 0, jump: false },
      { t: 'input', n: 1, mx: '1', mz: 0, jump: false },
      { t: 'input', n: 1, mx: 0, mz: 0, jump: 1 },
      { t: 'input', n: 1, mx: 0, mz: 0, jump: false, acts: 'use' },
      { t: 'input', n: 1, mx: 0, mz: 0, jump: false, acts: [{ a: 'slot', slot: 9 }] },
      { t: 'input', n: 1, mx: 0, mz: 0, jump: false, acts: [{ ...use, x: 0.5 }] },
      { t: 'input', n: 1, mx: 0, mz: 0, jump: false, acts: [{ ...use, ny: 2 }] },
      { t: 'input', n: 1, mx: 0, mz: 0, jump: false, acts: [{ ...use, button: 'middle' }] },
      { t: 'input', n: 1, mx: 0, mz: 0, jump: false, acts: [{ a: 'give', item: 'plank' }] },
      { t: 'input', n: 1, mx: 0, mz: 0, jump: false, acts: new Array(MAX_ACTS + 1).fill({ a: 'slot', slot: 0 }) },
      { t: 'snap', step: 1 },
    ];
    for (const value of bad) expect(readClientMessage(value)).toBeNull();
    expect(jsonCodec.decodeClient('{not json')).toBeNull();
    expect(jsonCodec.decodeClient(new ArrayBuffer(4))).toBeNull();
  });

  test('what a message does not name is not carried along', () => {
    expect(readClientMessage({ t: 'input', n: 1, mx: 0, mz: 0, jump: false, admin: true })).toEqual({ t: 'input', n: 1, mx: 0, mz: 0, jump: false });
  });
});

describe('messages from the server', () => {
  test('the three kinds are read, and nothing else', () => {
    expect(jsonCodec.decodeServer('{"t":"welcome","you":"player:a","build":"dev","seed":1,"step":0}')?.t).toBe('welcome');
    expect(jsonCodec.decodeServer('{"t":"refuse","why":"reload","text":"Reload."}')?.t).toBe('refuse');
    expect(jsonCodec.decodeServer('{"t":"input","n":1}')).toBeNull();
  });

  test('snaps add up to what is near', () => {
    const you = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, facing: 0, ground: true, water: false };
    const base: Snap = { t: 'snap', step: 1, ack: 0, you, day: 1, time: 0.3 };
    const near = createNear();
    applySnap(near, { ...base, actors: [{ id: 'a', sprite: 'hero', x: 1, y: 0, z: 0, facing: 0, anim: 'idle' }], placed: [{ id: 'chest:1', kind: 'chest', x: 4, y: 20, z: 4, turns: 0 }] });
    applySnap(near, { ...base, step: 2, ack: 5, day: 2, actors: [{ id: 'a', sprite: 'hero', x: 2, y: 0, z: 0, facing: 0, anim: 'walk' }, { id: 'b', sprite: 'critter', x: 9, y: 0, z: 0, facing: 0, anim: 'idle' }] });
    expect(near.step).toBe(2);
    expect(near.ack).toBe(5);
    expect(near.day).toBe(2);
    expect(near.actors.get('a')?.x).toBe(2);
    expect(near.actors.size).toBe(2);
    applySnap(near, { ...base, step: 3, gone: ['a'], unplaced: ['chest:1'] });
    expect([...near.actors.keys()]).toEqual(['b']);
    expect(near.placed.size).toBe(0);
  });
});
