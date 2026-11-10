import { describe, expect, test } from 'bun:test';
import {
  bearingTo, cameraYawOf, clampToDisc, clampToScreen, compassName, distanceTo, emptyEdgeMark, screenAngle, toMinimap,
} from './geometry.sim.ts';
import { MapRules, type Heading } from './map.sim.ts';
import { Marks, PING_SECONDS, WAYPOINT_LIMIT } from './marks.sim.ts';
import { SEEN_CELL, SeenCells } from './seen.sim.ts';

describe('seen cells', () => {
  test('nothing is seen at the start', () => {
    const seen = new SeenCells();
    expect(seen.isSeen(0, 0)).toBe(false);
    expect(seen.count).toBe(0);
  });

  test('walking reveals the cells around the player and no others', () => {
    const seen = new SeenCells();
    const added = seen.reveal(100, 100, 24);
    expect(added).toBeGreaterThan(0);
    expect(seen.count).toBe(added);
    expect(seen.isSeen(100, 100)).toBe(true);
    expect(seen.isSeen(100 + 20, 100)).toBe(true);
    expect(seen.isSeen(100, 100 - 20)).toBe(true);
    expect(seen.isSeen(100 + 40, 100)).toBe(false);
    // A circle, not a square: the corner of the square around it stays unseen.
    expect(seen.isSeen(100 + 22, 100 + 22)).toBe(false);
  });

  test('a cell is 8 blocks: every block in a seen cell is seen', () => {
    const seen = new SeenCells();
    seen.reveal(4, 4, 1);
    expect(SEEN_CELL).toBe(8);
    expect([seen.isSeen(0, 0), seen.isSeen(7, 7), seen.isSeen(8, 0), seen.isSeen(-1, 0)]).toEqual([true, true, false, false]);
    expect(seen.count).toBe(1);
  });

  test('standing still reveals nothing new, and the version only moves when something is new', () => {
    const seen = new SeenCells();
    seen.reveal(0, 0, 24);
    const version = seen.version;
    expect(seen.reveal(1, 1, 24)).toBe(0);
    expect(seen.reveal(0, 0, 24)).toBe(0);
    expect(seen.version).toBe(version);
    expect(seen.reveal(40, 0, 24)).toBeGreaterThan(0);
    expect(seen.version).toBe(version + 1);
  });

  test('it works on both sides of zero and across chunk borders', () => {
    const seen = new SeenCells();
    const changed = new Set<string>();
    seen.onChange = (x, z) => changed.add(`${x},${z}`);
    seen.reveal(-3, -3, 24);
    expect([seen.isSeen(-10, -10), seen.isSeen(10, 10), seen.isSeen(-10, 10), seen.isSeen(10, -10)]).toEqual([true, true, true, true]);
    expect([...changed].sort()).toEqual(['-1,-1', '-1,0', '0,-1', '0,0']);
    expect(seen.chunks.size).toBe(4);
  });

  test('seen cells save and load', () => {
    const seen = new SeenCells();
    seen.reveal(-300, 70, 48);
    seen.reveal(900, -40, 48);
    const save = JSON.parse(JSON.stringify(seen.save()));
    const loaded = new SeenCells();
    expect(loaded.load(save)).toBe(true);
    expect(loaded.count).toBe(seen.count);
    for (const [x, z] of [[-300, 70], [-300 + 44, 70], [-300 + 60, 70], [900, -40], [0, 0], [900, -90]]) {
      expect(loaded.isSeen(x, z)).toBe(seen.isSeen(x, z));
    }
    expect(loaded.isSeen(900, -40)).toBe(true);
    expect(loaded.isSeen(0, 0)).toBe(false);
  });

  test('a save that is not one loads as an empty map', () => {
    const seen = new SeenCells();
    seen.reveal(0, 0, 24);
    expect(seen.load({ cell: 4, chunks: [] })).toBe(false);
    expect(seen.count).toBe(0);
    expect(seen.load(null)).toBe(false);
    expect(seen.load({ cell: 8, chunks: [[0, 0, '!!!'], [0, 1, 'AAAA'], 'x'] })).toBe(true);
    expect(seen.count).toBe(0);
  });
});

describe('waypoints', () => {
  test('a waypoint has an icon and a color', () => {
    const marks = new Marks();
    const w = marks.addWaypoint(10, -20, { icon: 'fish', color: 'tide' });
    expect(w).toEqual({ id: 1, x: 10, z: -20, icon: 'fish', color: 'tide', shared: false, label: '' });
    expect(marks.addWaypoint(0, 0)).toMatchObject({ id: 2, icon: 'flag', color: 'flame' });
    marks.updateWaypoint(1, { icon: 'star', color: 'rose', shared: true });
    expect(marks.waypoints[0]).toMatchObject({ id: 1, icon: 'star', color: 'rose', shared: true });
  });

  test('the limit is 20: the 21st is refused, and removing one makes room', () => {
    const marks = new Marks();
    for (let i = 0; i < WAYPOINT_LIMIT; i++) expect(marks.addWaypoint(i, i)).not.toBeNull();
    expect(WAYPOINT_LIMIT).toBe(20);
    expect(marks.hasRoom).toBe(false);
    expect(marks.addWaypoint(99, 99)).toBeNull();
    expect(marks.waypoints.length).toBe(20);
    expect(marks.removeWaypoint(marks.waypoints[3].id)).toBe(true);
    const again = marks.addWaypoint(99, 99);
    expect(again).not.toBeNull();
    expect(marks.waypoints.length).toBe(20);
    // Ids are never reused, so a mark another player still holds cannot point at the wrong waypoint.
    expect(again!.id).toBe(21);
  });

  test('one waypoint is active at a time', () => {
    const marks = new Marks();
    const a = marks.addWaypoint(0, 0)!, b = marks.addWaypoint(5, 5)!;
    expect(marks.active).toBeNull();
    expect(marks.setActive(a.id)).toBe(true);
    expect(marks.active).toBe(a);
    marks.setActive(b.id);
    expect(marks.active).toBe(b);
    expect(marks.setActive(999)).toBe(false);
    expect(marks.active).toBe(b);
    marks.removeWaypoint(b.id);
    expect(marks.active).toBeNull();
    marks.setActive(a.id);
    marks.setActive(null);
    expect(marks.active).toBeNull();
  });

  test('shared waypoints go to the crew, and the crew replaces what one player shares', () => {
    const marks = new Marks();
    marks.addWaypoint(1, 1, { shared: true });
    marks.addWaypoint(2, 2);
    expect(marks.sharedWaypoints().map((w) => w.x)).toEqual([1]);
    marks.setCrew('ana', [{ x: 7, z: 7, icon: 'home', color: 'bloom', label: '' }, { x: 8, z: 8, icon: 'gem', color: 'spark', label: '' }]);
    marks.setCrew('ben', [{ x: 9, z: 9, icon: 'flag', color: 'tide', label: '' }]);
    marks.setCrew('ana', [{ x: 70, z: 70, icon: 'home', color: 'bloom', label: '' }]);
    expect(marks.crew.map((w) => [w.owner, w.x]).sort()).toEqual([['ana', 70], ['ben', 9]]);
    // Crew marks do not count against the player's 20.
    expect(marks.waypoints.length).toBe(2);
  });

  test('a ping lasts 10 seconds', () => {
    const marks = new Marks();
    marks.ping(3, 4, 'ana');
    marks.tick(PING_SECONDS - 0.1);
    expect(marks.pings.length).toBe(1);
    marks.tick(0.2);
    expect(marks.pings.length).toBe(0);
  });

  test('every change moves the version', () => {
    const marks = new Marks();
    const seen: number[] = [marks.version];
    const step = (): void => { expect(marks.version).toBeGreaterThan(seen[seen.length - 1]); seen.push(marks.version); };
    const w = marks.addWaypoint(0, 0)!; step();
    marks.setActive(w.id); step();
    marks.updateWaypoint(w.id, { color: 'tide' }); step();
    marks.setPin({ id: 'shop', kind: 'shop', x: 1, z: 1, label: 'Bakery' }); step();
    marks.setRumor('pet', 50, 50, 30); step();
    marks.removeWaypoint(w.id); step();
  });
});

describe('pins and rumors', () => {
  test('a pin with the same id replaces the old one', () => {
    const marks = new Marks();
    marks.setPin({ id: 'stone-1', kind: 'waystone', x: 1, z: 2, label: 'Mill waystone' });
    marks.setPin({ id: 'stone-1', kind: 'waystone', x: 3, z: 4, label: 'Mill waystone' });
    marks.setPin({ id: 'q', kind: 'quest', x: 9, z: 9, label: 'Wood for the oven' });
    expect(marks.pins.map((p) => [p.id, p.x])).toEqual([['stone-1', 3], ['q', 9]]);
    expect(marks.removePin('q')).toBe(true);
    expect(marks.removePin('q')).toBe(false);
  });

  test('a rumor is a circle that holds the spot and is never centered on it', () => {
    const marks = new Marks();
    for (const id of ['pet-at-the-falls', 'hollow-wall', 'a', 'b', 'c', 'd', 'e', 'f']) {
      const rumor = marks.setRumor(id, 400, -250, 40, 'Something by the falls');
      const off = Math.hypot(rumor.x - 400, rumor.z + 250);
      expect(off).toBeLessThan(40);
      expect(off).toBeGreaterThan(40 * 0.25 - 1);
      // The spot itself is not kept anywhere.
      expect(JSON.stringify(marks.save())).not.toContain('-250');
    }
    // The same rumor gives the same circle on every machine.
    expect(new Marks().setRumor('hollow-wall', 400, -250, 40)).toEqual({ ...marks.rumors[1], label: '' });
  });
});

describe('distance and bearing', () => {
  test('distance is along the ground, in blocks', () => {
    expect(distanceTo(0, 0, 30, 40)).toBe(50);
    expect(distanceTo(-10, 5, -10, 5)).toBe(0);
  });

  test('bearing is 0 to the north and grows clockwise', () => {
    expect(bearingTo(0, 0, 0, -10)).toBeCloseTo(0, 10);
    expect(bearingTo(0, 0, 10, 0)).toBeCloseTo(Math.PI / 2, 10);
    expect(Math.abs(bearingTo(0, 0, 0, 10))).toBeCloseTo(Math.PI, 10);
    expect(bearingTo(0, 0, -10, 0)).toBeCloseTo(-Math.PI / 2, 10);
    expect(bearingTo(5, 5, 15, -5)).toBeCloseTo(Math.PI / 4, 10);
    expect(['N', 'E', 'S', 'W', 'NE'].map((_, i) => compassName([0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4][i]))).toEqual(['N', 'E', 'S', 'W', 'NE']);
  });

  test('the active waypoint from the player', () => {
    const map = new MapRules();
    const out: Heading = { distance: 0, bearing: 0 };
    expect(map.headingFrom(0, 0, out).distance).toBe(-1);
    const w = map.marks.addWaypoint(130, 100)!;
    map.marks.addWaypoint(-500, -500);
    map.marks.setActive(w.id);
    map.headingFrom(100, 140, out);
    expect(out.distance).toBe(50);
    // 30 east and 40 north.
    expect(out.bearing).toBeCloseTo(Math.atan2(30, 40), 10);
    expect(compassName(out.bearing)).toBe('NE');
  });

  test('on the screen, a bearing turns with the camera', () => {
    // The camera looks north: east is to the right.
    expect(screenAngle(Math.PI / 2, 0)).toBeCloseTo(Math.PI / 2, 10);
    // The camera stands east and looks west: a target to the west is straight up.
    expect(screenAngle(-Math.PI / 2, Math.PI / 2)).toBeCloseTo(0, 10);
    // And north is then to the right.
    expect(screenAngle(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 10);
  });
});

describe('the minimap turns with the camera', () => {
  const at = (dx: number, dz: number, yaw: number): number[] => {
    const p = toMinimap(dx, dz, yaw, { x: 0, y: 0 });
    return [Math.round(p.x * 1000) / 1000 + 0, Math.round(p.y * 1000) / 1000 + 0];
  };

  test('north is up while the camera looks north', () => {
    expect(at(0, -10, 0)).toEqual([0, -10]);
    expect(at(10, 0, 0)).toEqual([10, 0]);
  });

  test('four quarter turns bring a point to the right, the bottom, the left and back to the top', () => {
    // A point 10 blocks north of the player, as the yaw grows a quarter turn at a time.
    const turns = [0, 1, 2, 3, 4].map((n) => at(0, -10, (n * Math.PI) / 2));
    expect(turns).toEqual([[0, -10], [10, 0], [0, 10], [-10, 0], [0, -10]]);
  });

  test('what is ahead of the camera is up', () => {
    // Yaw PI / 4 is the game's starting view: the camera stands south-east and looks north-west.
    const p = at(-10, -10, Math.PI / 4);
    expect(p[0]).toBeCloseTo(0, 3);
    expect(p[1]).toBeCloseTo(-Math.hypot(10, 10), 3);
  });

  test('the yaw is read from a camera matrix', () => {
    // A camera at (sin yaw, 1, cos yaw) looking at the origin has its back axis along (sin yaw, ., cos yaw).
    const matrix = (yaw: number): number[] => { const m = new Array(16).fill(0); m[8] = Math.sin(yaw) * 0.8; m[9] = 0.6; m[10] = Math.cos(yaw) * 0.8; return m; };
    for (const yaw of [0, Math.PI / 4, Math.PI / 2, -Math.PI / 2, 2.5]) expect(cameraYawOf(matrix(yaw))).toBeCloseTo(yaw, 10);
    // Straight down: the top of the screen decides. Up the screen is north here.
    const down = new Array(16).fill(0); down[9] = 1; down[6] = -1;
    expect(cameraYawOf(down)).toBeCloseTo(0, 10);
  });

  test('a mark inside the disc stays, and one outside becomes an arrow on the rim', () => {
    const mark = emptyEdgeMark();
    clampToDisc(10, -20, 60, mark);
    expect([mark.x, mark.y, mark.off]).toEqual([10, -20, false]);
    clampToDisc(300, 0, 60, mark);
    expect([mark.x, mark.y, mark.off]).toEqual([60, 0, true]);
    expect(mark.angle).toBeCloseTo(Math.PI / 2, 10);
    clampToDisc(0, -500, 60, mark);
    expect(mark.y).toBe(-60);
    expect(mark.angle).toBeCloseTo(0, 10);
  });
});

describe('the arrow at the edge of the screen', () => {
  const mark = emptyEdgeMark();

  test('a target in view is drawn where it is', () => {
    clampToScreen(0.5, 0.5, false, 1000, 600, 50, mark);
    expect([mark.x, mark.y, mark.off]).toEqual([750, 150, false]);
  });

  test('a target off to the right becomes an arrow at the right edge, pointing right', () => {
    clampToScreen(3, 0, false, 1000, 600, 50, mark);
    expect([mark.x, mark.y, mark.off]).toEqual([950, 300, true]);
    expect(mark.angle).toBeCloseTo(Math.PI / 2, 10);
  });

  test('a target above and to the left sits on the top edge', () => {
    clampToScreen(-1, 4, false, 1000, 600, 50, mark);
    expect(mark.off).toBe(true);
    expect(mark.y).toBe(50);
    expect(mark.x).toBeLessThan(500);
    expect(mark.angle).toBeLessThan(0);
  });

  test('a target behind the camera points the other way, and is always an arrow', () => {
    // Behind the camera the projection mirrors the point: one that projects up and right is really down and left.
    clampToScreen(0.2, 0.2, true, 1000, 600, 50, mark);
    expect(mark.off).toBe(true);
    expect(mark.x).toBeLessThan(500);
    expect(mark.y).toBe(550);
    clampToScreen(0, 0, true, 1000, 600, 50, mark);
    expect([mark.x, mark.y, mark.off]).toEqual([500, 550, true]);
  });
});

describe('the whole map saves and loads', () => {
  test('seen cells, waypoints, the active one, pins and rumors come back', () => {
    const map = new MapRules();
    map.seen.reveal(64, 64, 48);
    const a = map.marks.addWaypoint(10, 20, { icon: 'home', color: 'bloom', shared: true, label: 'Farm' })!;
    const b = map.marks.addWaypoint(-300, 44, { icon: 'danger', color: 'flame' })!;
    map.marks.setActive(b.id);
    map.marks.setPin({ id: 'bakery', kind: 'shop', x: 70, z: 60, label: 'Bakery' });
    map.marks.setRumor('falls', 500, 500, 60, 'A pet by the falls');
    map.marks.setCrew('ana', [{ x: 1, z: 1, icon: 'flag', color: 'tide', label: '' }]);

    const text = JSON.stringify(map.save());
    const loaded = new MapRules();
    expect(loaded.load(JSON.parse(text))).toBe(true);
    expect(loaded.seen.count).toBe(map.seen.count);
    expect(loaded.seen.isSeen(64, 64)).toBe(true);
    expect(loaded.marks.waypoints).toEqual([a, b]);
    expect(loaded.marks.active).toEqual(b);
    expect(loaded.marks.pins).toEqual(map.marks.pins);
    expect(loaded.marks.rumors).toEqual(map.marks.rumors);
    // What the crew shares is not the player's to keep.
    expect(loaded.marks.crew).toEqual([]);
    // A new waypoint after a load does not reuse an id.
    expect(loaded.marks.addWaypoint(0, 0)!.id).toBe(3);
    expect(JSON.stringify(loaded.save())).toBe(JSON.stringify({ ...JSON.parse(text), ...loaded.marks.save(), seen: JSON.parse(text).seen }));
  });

  test('a save with too many or broken waypoints loads what is valid, up to 20', () => {
    const waypoints = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, x: i, z: i, icon: 'flag', color: 'flame', shared: false, label: '' }));
    const broken = [{ id: 'x', x: 0, z: 0, icon: 'flag', color: 'flame' }, { id: 77, x: 0, z: 0, icon: 'sword', color: 'flame' }, null];
    const map = new MapRules();
    expect(map.load({ v: 1, seen: { cell: 8, chunks: [] }, waypoints: [...broken, ...waypoints], active: 25, pins: [{ id: 'p', kind: 'castle', x: 0, z: 0 }], rumors: [] })).toBe(true);
    expect(map.marks.waypoints.length).toBe(20);
    expect(map.marks.active).toBeNull();
    expect(map.marks.pins).toEqual([]);
  });

  test('something that is not a save gives an empty map', () => {
    const map = new MapRules();
    map.marks.addWaypoint(1, 1);
    map.seen.reveal(0, 0, 24);
    expect(map.load({ v: 2 })).toBe(false);
    expect(map.marks.waypoints.length).toBe(0);
    expect(map.seen.count).toBe(0);
    expect(map.load('nope')).toBe(false);
  });
});
