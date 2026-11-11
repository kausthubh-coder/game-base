// What a browser is given to keep its copy of the world: the rules' state, the events, the weather, and
// what is a player's own. The room is played as the Durable Object plays it, with no server.
import { describe, expect, test } from 'bun:test';
import { AMBIENT_KEYS, readClientMessage, type Input, type Snap } from '../../src/engine/net/messages.ts';
import { blockId } from '../../src/content/blocks.ts';
import { runDev } from '../dev.ts';
import { createRoom, type Room } from '../room.ts';

const input = (n: number, more: Partial<Input> = {}): Input => ({ t: 'input', n, mx: 0, mz: 0, jump: false, ...more });

function step(room: Room, users: string[]): Map<string, Snap> {
  room.step();
  const out = new Map<string, Snap>();
  for (const user of users) out.set(user, room.snap(user) as Snap);
  return out;
}

function groundBy(room: Room, east = 2): { x: number; y: number; z: number } {
  const spawn = room.sys.region.spawn();
  const x = Math.floor(spawn.x) + east, z = Math.floor(spawn.z);
  return { x, y: room.world.heightAt(x, z) - 1, z };
}

const top = { nx: 0, ny: 1, nz: 0 };
const names = (snap: Snap | undefined): string[] => (snap?.events ?? []).map(([name]) => name);

describe('the copy a browser keeps', () => {
  test('a player who comes in is given every copied system, the flags and the weather, and later only what changed', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    const first = step(room, ['ann']).get('ann')!;
    expect(Object.keys(first.state?.systems ?? {}).sort()).toEqual(['almanac', 'crops', 'inventory', 'people', 'pets', 'quests', 'region', 'trees']);
    expect(Array.isArray(first.state?.flags)).toBe(true);
    expect(first.air).toHaveLength(AMBIENT_KEYS.length);
    // Nothing happened, so the next ten steps carry no state at all.
    for (let i = 0; i < 9; i++) expect(step(room, ['ann']).get('ann')!.state).toBeUndefined();
  });

  test('a block placed by one player reaches the other as an event once, and the bag as state', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    room.join('bo', 'Bo');
    for (let i = 0; i < 3; i++) step(room, ['ann', 'bo']);
    runDev(room, { do: 'give', item: 'plank', count: 5 });
    step(room, ['ann', 'bo']);
    const at = groundBy(room);
    room.input('ann', input(1, { acts: [{ a: 'slot', slot: 0 }, { a: 'use', button: 'secondary', ...at, ...top }] }));
    const snaps = step(room, ['ann', 'bo']);
    const bo = snaps.get('bo')!;
    expect(names(bo).filter((name) => name === 'block.placed')).toHaveLength(1);
    expect(bo.events!.find(([name]) => name === 'block.placed')![1]).toMatchObject({ x: at.x, y: at.y + 1, z: at.z, id: blockId('oak_plank') });
    const bag = bo.state?.systems?.inventory as { slots: ({ id: string; count: number } | null)[] };
    expect(bag.slots.find((slot) => slot?.id === 'plank')?.count).toBe(4);
    // The next step has nothing more of it.
    expect(names(step(room, ['ann', 'bo']).get('bo'))).not.toContain('block.placed');
  });

  test('a toast is told only to the player whose act made it', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    room.join('bo', 'Bo');
    step(room, ['ann', 'bo']);
    room.sys.placeables.onUse?.(() => undefined);
    const at = groundBy(room);
    const bed = room.sys.placeables.place('bed', at.x, at.y + 1, at.z, 0);
    expect(bed).not.toBeNull();
    // A bed in the morning says it is too early, to whoever used it.
    room.input('bo', input(1, { acts: [{ a: 'use', button: 'secondary', x: at.x, y: at.y + 1, z: at.z, ...top }] }));
    const snaps = step(room, ['ann', 'bo']);
    expect(names(snaps.get('bo'))).toContain('toast');
    expect(names(snaps.get('ann'))).not.toContain('toast');
  });

  test('soil tilled and seeds planted by one player show in the other\'s crops', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    room.join('bo', 'Bo');
    step(room, ['ann', 'bo']);
    runDev(room, { do: 'give', item: 'hoe', count: 1 });
    runDev(room, { do: 'give', item: 'wheat_seeds', count: 3 });
    const hoe = room.sys.inventory.slots.findIndex((slot) => slot?.id === 'hoe');
    const seeds = room.sys.inventory.slots.findIndex((slot) => slot?.id === 'wheat_seeds');
    const at = groundBy(room);
    room.input('ann', input(1, { acts: [{ a: 'slot', slot: hoe }, { a: 'use', button: 'secondary', ...at, ...top }] }));
    step(room, ['ann', 'bo']);
    room.input('ann', input(2, { acts: [{ a: 'slot', slot: seeds }, { a: 'use', button: 'secondary', ...at, ...top }] }));
    const bo = step(room, ['ann', 'bo']).get('bo')!;
    expect(names(bo)).toContain('crop.planted');
    const crops = bo.state?.systems?.crops as { crops: unknown[][] };
    expect(crops.crops.map((c) => c.slice(0, 4))).toEqual([[at.x, at.y, at.z, 'wheat']]);
  });

  test('a stroke in build mode is one act, and its undo another', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    step(room, ['ann']);
    runDev(room, { do: 'give', item: 'plank', count: 10 });
    const from = groundBy(room, 2), to = groundBy(room, 4);
    room.input('ann', input(1, { acts: [{ a: 'slot', slot: 0 }, { a: 'build', at: { ...from, ...top }, to: { ...to, ...top } }] }));
    step(room, ['ann']);
    const plank = blockId('oak_plank');
    const laid = [2, 3, 4].filter((east) => {
      const at = groundBy(room, east);
      return room.world.getBlock(at.x, at.y, at.z) === plank;
    });
    expect(laid.length).toBeGreaterThan(0);
    expect(room.sys.build.active).toBe(false);
    room.input('ann', input(2, { acts: [{ a: 'undo' }] }));
    step(room, ['ann']);
    expect(room.sys.inventory.count('plank')).toBe(10);
  });

  test('a conversation is told to the player who started it, and only their clicks move it on', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    room.join('bo', 'Bo');
    step(room, ['ann', 'bo']);
    room.sys.talk.start('tamsin.meet', 'tamsin');
    const snaps = step(room, ['ann', 'bo']);
    const line = snaps.get('ann')!.talk;
    expect(line?.text.length).toBeGreaterThan(0);
    expect(snaps.get('bo')!.talk).toBeUndefined();
    room.input('bo', input(1, { acts: [{ a: 'say' }] }));
    expect(step(room, ['ann', 'bo']).get('ann')!.talk).toBeUndefined();
    room.input('ann', input(1, { acts: [{ a: 'say' }] }));
    const next = step(room, ['ann', 'bo']).get('ann')!;
    expect(next.talk === null || next.talk?.text !== line?.text).toBe(true);
  });

  test('an input says how it steered in each body step', () => {
    const steered = createRoom(), plain = createRoom();
    steered.join('ann', 'Ann');
    plain.join('ann', 'Ann');
    const moves = [1, 0, 0, 1, 0, 0, 0, 0, 0];
    steered.input('ann', input(1, { mx: 0, mz: 0, moves }));
    plain.input('ann', input(1, { mx: 1, mz: 0 }));
    const a = step(steered, ['ann']).get('ann')!, b = step(plain, ['ann']).get('ann')!;
    expect(a.you.x).toBeGreaterThan(plain.sys.region.spawn().x);
    expect(a.you.x).toBeLessThan(b.you.x);
  });

  test('the new acts are read, and what is not one is not', () => {
    const ok = { t: 'input', n: 1, mx: 0, mz: 0, jump: false, moves: [0, 0, 0, 1, -1, 1, 0.5, 0, 0], acts: [
      { a: 'interact' }, { a: 'say', choice: 1 }, { a: 'craft', recipe: 'plank' }, { a: 'move', from: 3, to: 12, count: 2 },
      { a: 'build', at: { x: 1, y: 2, z: 3, nx: 0, ny: 1, nz: 0 }, to: { x: 4, y: 2, z: 3, nx: 0, ny: 1, nz: 0 }, turns: 2 }, { a: 'undo' },
    ] };
    expect(readClientMessage(ok)).toEqual(ok as never);
    for (const bad of [
      { ...ok, moves: [0, 0, 0] },
      { ...ok, moves: [2, 0, 0, 0, 0, 0, 0, 0, 0] },
      { ...ok, acts: [{ a: 'move', from: 36, to: 0 }] },
      { ...ok, acts: [{ a: 'craft', recipe: '' }] },
      { ...ok, acts: [{ a: 'build', at: { x: 0.5, y: 0, z: 0, nx: 0, ny: 1, nz: 0 } }] },
      { ...ok, acts: [{ a: 'build', at: { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0 }, turns: 4 }] },
    ]) expect(readClientMessage(bad)).toBeNull();
  });
});
