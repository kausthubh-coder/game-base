// The room played the way the Durable Object plays it, with no server: join, input, step, snap, save.
import { describe, expect, test } from 'bun:test';
import { applySnap, createNear } from '../../src/engine/net/near.ts';
import type { Input, Snap } from '../../src/engine/net/messages.ts';
import { blockId } from '../../src/content/blocks.ts';
import { cellIndex } from '../../src/features/world/chunk.sim.ts';
import { runDev } from '../dev.ts';
import { MAX_PLAYERS, createRoom, type Room } from '../room.ts';

const input = (n: number, more: Partial<Input> = {}): Input => ({ t: 'input', n, mx: 0, mz: 0, jump: false, ...more });

/** Steps the room and returns each player's snap of the last step. */
function run(room: Room, users: string[], steps: number, each?: (step: number) => void): Map<string, Snap> {
  const last = new Map<string, Snap>();
  for (let i = 0; i < steps; i++) {
    each?.(i);
    room.step();
    for (const user of users) last.set(user, room.snap(user) as Snap);
  }
  return last;
}

/** A column of open ground inside the grant, two blocks east of where a new player stands. */
function groundBy(room: Room): { x: number; y: number; z: number } {
  const spawn = room.sys.region.spawn();
  const x = Math.floor(spawn.x) + 2, z = Math.floor(spawn.z);
  return { x, y: room.world.heightAt(x, z) - 1, z };
}

describe('the room', () => {
  test('an empty world does not step', () => {
    const room = createRoom();
    room.step();
    room.step();
    expect(room.steps).toBe(0);
  });

  test('a player walks where their inputs say, and the snap answers with the last input used', () => {
    const room = createRoom();
    expect(room.join('ann', 'Ann')).toBe('player:ann');
    const first = run(room, ['ann'], 1).get('ann') as Snap;
    expect(first.ack).toBe(0);
    let n = 0;
    const last = run(room, ['ann'], 20, () => room.input('ann', input(++n, { mx: 1 }))).get('ann') as Snap;
    expect(last.ack).toBe(20);
    // A second at 4.4 blocks a second, less the time it takes to get up to speed.
    expect(last.you.x - first.you.x).toBeGreaterThan(3.5);
    expect(last.you.x - first.you.x).toBeLessThan(4.5);
    expect(room.steps).toBe(21);
  });

  test('an input is used once, and a repeat is dropped', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    room.input('ann', input(1, { mx: 1 }));
    room.input('ann', input(1, { mx: 1 }));
    room.input('ann', input(2, { mx: 1 }));
    const snaps: number[] = [];
    for (let i = 0; i < 4; i++) {
      room.step();
      snaps.push((room.snap('ann') as Snap).ack);
    }
    expect(snaps).toEqual([1, 2, 2, 2]);
  });

  test('two inputs that arrive together after a step with none are both used, so none waits a step behind', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    const acks: number[] = [];
    const step = (): void => {
      room.step();
      acks.push((room.snap('ann') as Snap).ack);
    };
    room.input('ann', input(1));
    step();
    step();
    room.input('ann', input(2));
    room.input('ann', input(3));
    step();
    room.input('ann', input(4));
    step();
    expect(acks).toEqual([1, 1, 3, 4]);
  });

  test('a flood of inputs does not let a player run ahead', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    for (let n = 1; n <= 100; n++) room.input('ann', input(n, { mx: 1 }));
    const before = (run(room, ['ann'], 1).get('ann') as Snap).you.x;
    const after = (run(room, ['ann'], 19).get('ann') as Snap).you.x;
    // All but the newest six are dropped, and those six are used one a step: the body moves no farther
    // than six steps of walking.
    expect(after - before).toBeLessThan(1.5);
    expect(room.stats().inputsDropped).toBe(94);
  });

  test('two players each see the other move', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    room.join('bo', 'Bo');
    const ann = createNear(), bo = createNear();
    const take = (): void => {
      applySnap(ann, room.snap('ann') as Snap);
      applySnap(bo, room.snap('bo') as Snap);
    };
    room.step();
    take();
    const boAtFirst = { ...ann.actors.get('player:bo')! };
    const annAtFirst = { ...bo.actors.get('player:ann')! };
    expect(ann.actors.has('player:ann')).toBe(false);
    for (let n = 1; n <= 20; n++) {
      room.input('ann', input(n, { mx: 1 }));
      room.input('bo', input(n, { mx: -1 }));
      room.step();
      take();
    }
    expect(boAtFirst.x - ann.actors.get('player:bo')!.x).toBeGreaterThan(3);
    expect(bo.actors.get('player:ann')!.x - annAtFirst.x).toBeGreaterThan(3);
    expect(ann.actors.get('player:bo')!.anim).toBe('walk');
    // What Ann is told of Bo is where Bo's own snap says Bo is, to the centimeter.
    expect(ann.actors.get('player:bo')!.x).toBeCloseTo(bo.you!.x, 2);
  });

  test('an actor that does not change is sent once', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    room.join('bo', 'Bo');
    const snaps: Snap[] = [];
    for (let i = 0; i < 10; i++) {
      room.step();
      snaps.push(room.snap('ann') as Snap);
      room.snap('bo');
    }
    const told = snaps.filter((snap) => snap.actors?.some((actor) => actor.id === 'player:bo')).length;
    // Bo falls to the ground in the first steps and then stands still.
    expect(told).toBeGreaterThan(0);
    expect(told).toBeLessThan(10);
    expect(snaps[9].actors?.some((actor) => actor.id === 'player:bo') ?? false).toBe(false);
  });

  test('a player who leaves is gone from the other one\'s world', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    room.join('bo', 'Bo');
    const ann = createNear();
    room.step();
    applySnap(ann, room.snap('ann') as Snap);
    expect(ann.actors.has('player:bo')).toBe(true);
    room.leave('bo');
    room.step();
    applySnap(ann, room.snap('ann') as Snap);
    expect(ann.actors.has('player:bo')).toBe(false);
    expect(room.who()).toEqual([{ id: 'ann', name: 'Ann' }]);
  });

  test('a block one player places reaches the other, and is in the save', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    room.join('bo', 'Bo');
    run(room, ['ann', 'bo'], 5);
    expect(runDev(room, { do: 'give', item: 'plank', count: 5 })).toEqual({ ok: true, left: 0 });
    const at = groundBy(room);
    room.input('ann', input(1, { acts: [{ a: 'slot', slot: 0 }, { a: 'use', button: 'secondary', ...at, nx: 0, ny: 1, nz: 0 }] }));
    const snaps = run(room, ['ann', 'bo'], 1);
    const plank = blockId('oak_plank');
    expect(room.world.getBlock(at.x, at.y + 1, at.z)).toBe(plank);
    expect(snaps.get('bo')!.blocks).toEqual([at.x, at.y + 1, at.z, plank]);
    expect(snaps.get('ann')!.blocks).toEqual([at.x, at.y + 1, at.z, plank]);
    expect(room.sys.inventory.count('plank')).toBe(4);

    // A new room from the save has the block, and tells a player who walks in about it.
    const again = createRoom(JSON.parse(JSON.stringify(room.save())));
    again.join('cy', 'Cy');
    again.step();
    const snap = again.snap('cy') as Snap;
    expect(again.world.getBlock(at.x, at.y + 1, at.z)).toBe(plank);
    const chunk = snap.chunks?.find(([cx, cz]) => cx === at.x >> 4 && cz === at.z >> 4);
    expect(chunk).toBeDefined();
    const cells = chunk![2];
    const cell = cellIndex(at.x & 15, at.y + 1, at.z & 15);
    expect(cells[cells.indexOf(cell) + 1]).toBe(plank);
    expect(again.steps).toBe(room.steps + 1);
  });

  test('a click out of reach does nothing', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    run(room, ['ann'], 5);
    runDev(room, { do: 'give', item: 'plank', count: 5 });
    const at = groundBy(room);
    const far = { x: at.x + 30, y: room.world.heightAt(at.x + 30, at.z) - 1, z: at.z };
    room.input('ann', input(1, { acts: [{ a: 'use', button: 'secondary', ...far, nx: 0, ny: 1, nz: 0 }] }));
    const snap = run(room, ['ann'], 1).get('ann') as Snap;
    expect(snap.blocks).toBeUndefined();
    expect(room.sys.inventory.count('plank')).toBe(5);
  });

  test('a placed thing is told once, and its taking away is told too', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    const near = createNear();
    const step = (): void => {
      room.step();
      applySnap(near, room.snap('ann') as Snap);
    };
    step();
    const at = groundBy(room);
    const placed = room.sys.placeables.place('chest', at.x, at.y + 1, at.z, 0);
    expect(placed).not.toBeNull();
    step();
    expect([...near.placed.values()]).toEqual([{ id: placed!.id, kind: 'chest', x: at.x, y: at.y + 1, z: at.z, turns: 0 }]);
    room.sys.placeables.remove(placed!.id);
    step();
    expect(near.placed.size).toBe(0);
  });

  test('a player comes back where they left', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    let n = 0;
    const walked = run(room, ['ann'], 30, () => room.input('ann', input(++n, { mx: 1 }))).get('ann') as Snap;
    room.leave('ann');
    const again = createRoom(JSON.parse(JSON.stringify(room.save())));
    again.join('ann', 'Ann');
    again.step();
    const back = again.snap('ann') as Snap;
    expect(back.you.x).toBeCloseTo(walked.you.x, 1);
    expect(back.you.z).toBeCloseTo(walked.you.z, 1);
  });

  test('the world holds eight players and no more', () => {
    const room = createRoom();
    for (let i = 0; i < MAX_PLAYERS; i++) expect(room.join(`p${i}`, `P${i}`)).toBe(`player:p${i}`);
    expect(room.join('late', 'Late')).toBeNull();
    // The same player joining again takes their own place, not a new one.
    expect(room.join('p3', 'P3')).toBe('player:p3');
    expect(room.playerCount).toBe(MAX_PLAYERS);
  });

  test('the fill for the memory test adds what it says it adds', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    run(room, ['ann'], 2);
    const result = runDev(room, { do: 'fill', creatures: 300, placed: 3000 });
    expect(result.creatures).toBe(300);
    expect(result.placed).toBe(3000);
    run(room, ['ann'], 40);
    const stats = room.stats();
    expect(stats.creatures).toBeGreaterThanOrEqual(300);
    expect(stats.creaturesAwake).toBeGreaterThanOrEqual(300);
    expect(stats.placed).toBe(result.placed as number);
  });
});

describe('how often', () => {
  test('a creature that keeps moving is told every fourth step, and a player every step', () => {
    const room = createRoom();
    room.join('ann', 'Ann');
    room.join('bo', 'Bo');
    run(room, ['ann', 'bo'], 2);
    runDev(room, { do: 'fill', creatures: 40, placed: 0 });
    const told = new Map<string, number[]>();
    let n = 0;
    for (let i = 0; i < 400; i++) {
      room.input('bo', input(++n, { mx: i % 80 < 40 ? 1 : -1 }));
      room.step();
      const snap = room.snap('ann') as Snap;
      room.snap('bo');
      for (const actor of snap.actors ?? []) told.set(actor.id, [...(told.get(actor.id) ?? []), snap.step]);
    }
    // Bo walks the whole time and is in nearly every snap.
    expect(told.get('player:bo')!.length).toBeGreaterThan(380);
    const creatures = [...told].filter(([id]) => id.startsWith('creature:'));
    expect(creatures.length).toBeGreaterThanOrEqual(40);
    let moved = 0;
    for (const [, steps] of creatures) {
      // The first telling is at once, when it comes into range. Every later one is in the creature's own turn.
      const turns = new Set(steps.slice(1).map((step) => step % 4));
      expect(turns.size).toBeLessThanOrEqual(1);
      if (steps.length > 1) moved++;
    }
    // Twenty seconds is long enough for most of them to have walked somewhere.
    expect(moved).toBeGreaterThan(20);
  });
});
