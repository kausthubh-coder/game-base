import { describe, expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { groundHeight } from '../../features/world/terrain.sim.ts';
import { waterLevelAt } from '../region/greenhollow-land.sim.ts';
import { FLAG } from '../content/flags.ts';
import { begin } from '../play/scenario.sim.ts';
import { cellBlocks, roomsShape } from './land.sim.ts';
import { MACHINES, SHRINES, VAULT, VAULTS } from './index.sim.ts';
import { GALLERY_EYES, ROOMS, ROOM_DEFS, cellOf, roomAt, roomOf, roomOrigin, roomPoint } from './rooms.sim.ts';

const WALKABLE = new Set(['.', ',', ':', '=', '~']);

describe('the rooms', () => {
  test.each(ROOM_DEFS.map((r) => [r.id, r] as const))('%s: its plan is a rectangle of known cells, and its spots stand on its floor', (_, room) => {
    const width = room.plan[0].length;
    for (const row of room.plan) {
      expect(row.length).toBe(width);
      expect(row).toMatch(/^[#+.,:=~wo xXkbr]+$/);
    }
    for (const [name, [x, z]] of Object.entries(room.spots)) {
      const c = cellOf(room, Math.floor(x), Math.floor(z));
      // A way out stands in its doorway or on the floor before it.
      expect(`${name}: ${WALKABLE.has(c) || c === '+' || c === '#' ? 'ok' : c}`).toBe(`${name}: ok`);
    }
    expect(WALKABLE.has(cellOf(room, Math.floor(room.spots.arrive[0]), Math.floor(room.spots.arrive[1])))).toBe(true);
  });

  test('no two rooms overlap, and each is far from Greenhollow and from Saltgate', () => {
    for (const a of ROOM_DEFS) {
      const o = roomOrigin(a);
      expect(roomAt(o.x, o.z)?.id).toBe(a.id);
      for (const b of ROOM_DEFS) {
        if (a === b) continue;
        const p = roomOrigin(b);
        const apart = o.x + a.plan[0].length <= p.x || p.x + b.plan[0].length <= o.x;
        expect(apart).toBe(true);
      }
    }
    expect(roomAt(-16, -234)).toBeNull();
    expect(ROOMS.z).toBeGreaterThan(2000);
  });

  test('a keeper\'s home, its start and its channels, lamps and pod beds are on the floor of its room', () => {
    for (const room of ROOM_DEFS) {
      const k = room.keeper;
      if (!k) continue;
      const floor = (p: readonly [number, number]): string => cellOf(room, Math.floor(p[0]), Math.floor(p[1]));
      expect(WALKABLE.has(floor(k.start))).toBe(true);
      if (k.kind === 'sluice') expect(WALKABLE.has(floor(k.home))).toBe(true);
      for (const c of k.channels ?? []) {
        expect(WALKABLE.has(floor(c.gate))).toBe(true);
        for (let x = c.box[0]; x < c.box[2]; x++) for (let z = c.box[1]; z < c.box[3]; z++) expect(cellOf(room, x, z)).toBe('~');
      }
      for (const p of [...(k.lamps ?? []), ...(k.beds ?? [])]) expect(WALKABLE.has(floor(p))).toBe(true);
    }
  });

  test('the gallery\'s eyes go from the arch to the bars, on alternate walls, out of sight of the middle of the walkway', () => {
    const gallery = roomOf('gallery');
    const bars = gallery.plan.findIndex((row) => row.includes('b'));
    GALLERY_EYES.forEach((eye, i) => {
      expect(eye.z).toBeGreaterThan(bars);
      if (i > 0) expect(eye.z).toBeLessThan(GALLERY_EYES[i - 1].z);
      if (i > 0) expect(eye.x < 8).toBe(GALLERY_EYES[i - 1].x > 8);
      expect(Math.abs(eye.x - 7.5)).toBeGreaterThan(2.6 + 1);
    });
  });
});

describe('the rooms\' ground', () => {
  test('every floor is at the rooms\' height, and the rock round a room stands over its north wall', () => {
    for (const room of ROOM_DEFS) {
      const at = roomPoint(room, room.spots.arrive[0], room.spots.arrive[1]);
      expect(roomsShape(Math.floor(at.x), Math.floor(at.z))).toBe(ROOMS.ground);
      expect(groundHeight(1, Math.floor(at.x), Math.floor(at.z))).toBe(ROOMS.ground);
      const o = roomOrigin(room);
      expect(roomsShape(o.x + 2, o.z - 3)).toBeGreaterThan(ROOMS.ground + 5);
    }
  });

  test('a wall is five blocks of brick with moss on top; bars and root locks are barriers; water lies under the floor', () => {
    const cells = (c: string): Record<number, number> => { const out: Record<number, number> = {}; cellBlocks(c, (y, id) => { out[y - ROOMS.ground] = id; }); return out; };
    const brick = blockId('stone_brick'), barrier = blockId('barrier');
    expect(cells('#')[0]).toBe(brick);
    expect(cells('#')[4]).toBe(blockId('mossy_stone'));
    expect(cells('#')[5]).toBeUndefined();
    expect(cells('b')[1]).toBe(barrier);
    expect(cells('r')[2]).toBe(barrier);
    expect(cells('w')[-1]).toBe(blockId('water'));
    expect(cells('.')[0]).toBeUndefined();
    expect(cells('.')[-1]).toBe(brick);
  });
});

describe('the ruins system', () => {
  test('the shrines, the vaults and the machines are the design\'s', () => {
    expect(SHRINES).toHaveLength(6);
    expect(VAULTS.map((v) => VAULT[v].keystone)).toEqual([1, 2, 3]);
    expect(VAULTS.map((v) => VAULT[v].fight)).toEqual([7, 9, 10]);
    expect(MACHINES.map((m) => m.name)).toEqual(['the wheel', 'the lamp', 'the arm']);
  });

  test('a shrine is not restored before the Mark, and gives what was picked once', () => {
    const p = begin(5, { quest: 'grantday' });
    expect(p.sys.ruins.restore!('shrine-bend', 'stamina')).toBe(false);
    p.game.flags.set('mark', true);
    expect(p.sys.ruins.restore!('shrine-bend', 'stamina')).toBe(true);
    expect(p.sys.ruins.restore!('shrine-bend', 'heart')).toBe(false);
    expect(p.sys.ruins.shrine('shrine-bend')).toBe('stamina');
  });

  test('a vault\'s scene set by any way leaves its keystone in hand and its stone remembered', () => {
    const p = begin(5, { quest: 'echo' });
    p.game.flags.set(FLAG.scene(28), true);
    expect(p.game.flags.is(FLAG.keystone(2))).toBe(true);
    expect(p.sys.ruins.remembered('lampgallery')).toBe(true);
    expect(p.sys.ruins.keystones()).toBe(1);
  });

  test('what the rooms opened is saved, and comes back with the hero in their room', () => {
    const p = begin(5, { quest: 'pump' });
    p.advance(0.5);
    p.talkThrough();
    p.sys.ruins.enter!('pump-upper');
    p.advance(0.2);
    const room = roomOf('pump-upper'), lever = roomPoint(room, room.spots.lever[0], room.spots.lever[1]);
    p.teleport({ x: lever.x, z: lever.z });
    p.advance(0.1);
    expect(p.prompt()).toBe('Pull the lever');
    p.sys.interact.act();
    p.advance(0.5);
    const water = p.game.world.getBlock(roomOrigin(room).x + 18, ROOMS.ground - 1, roomOrigin(room).z + 12);
    expect(water).toBe(0);
    const back = p.reload();
    back.advance(0.5);
    expect(back.sys.ruins.view!().room).toBe('pump-upper');
    expect(back.sys.ruins.view!().lever).toBe(true);
    // The stair stays dry: the land lays its water again, and the system takes it away.
    expect(back.game.world.getBlock(roomOrigin(room).x + 18, ROOMS.ground - 1, roomOrigin(room).z + 12)).toBe(0);
  });
});

test('the open Gallery bars remain passable during its keeper fight', () => {
  const p = begin(5, { quest: 'gallery' });
  p.talkThrough();
  p.sys.ruins.enter!('gallery');
  const room = roomOf('gallery'), o = roomOrigin(room);
  for (const eye of GALLERY_EYES) {
    p.teleport({ x: o.x + eye.x, z: o.z + eye.z });
    p.advance(0.2);
  }
  expect(p.sys.ruins.view!().eyes).toBe(6);
  p.teleport({ x: o.x + 8, z: o.z + 15 });
  p.advance(0.2);
  const fight = p.sys.fights.running!();
  expect(fight).not.toBeNull();
  expect(fight!.stage.solid(o.x + 8, o.z + 17.5)).toBe(false);
});

// Rules fixture, separate from the unchanged earned-save browser replay.
test('leaving Pump uses dry terrain even while the exterior chunks are unloaded', () => {
  const p = begin(41, { quest: 'pump' });
  p.talkThrough();
  p.sys.ruins.enter!('pump-upper');
  const room = roomOf('pump-upper'), out = roomPoint(room, ...room.spots.out);
  p.teleport({ x: out.x, z: out.z });
  p.advance(.2);
  expect(p.prompt()).toBe('Go out to the river');
  p.sys.interact.act();
  const at = p.game.player.pos;
  expect(at.y).toBe(groundHeight(41, Math.floor(at.x), Math.floor(at.z)));
  for (const [dx, dz] of [[0, 0], [2, -1]]) {
    const x = Math.floor(at.x + dx), z = Math.floor(at.z + dz);
    expect(groundHeight(41, x, z)).toBeGreaterThanOrEqual(waterLevelAt(x, z));
  }
});
