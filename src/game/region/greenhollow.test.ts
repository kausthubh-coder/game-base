import { describe, expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { groundHeight } from '../../features/world/terrain.sim.ts';
import { World } from '../../features/world/world.sim.ts';
import { HIGH_ROAD, LANDMARKS, MAP_SIZE, PLACES, RIVER, TERRACES, toMap, toWorld } from '../content/greenhollow.ts';
import { DECK_Y, highRoadSpans, highRoadStairs, landmarkSites, planStands, waterLevelAt } from './greenhollow-land.sim.ts';
import { biomeAt, blightAt, highRoadDistance, placeAt, riverBank } from './greenhollow.sim.ts';

const SEED = 1;

describe('the plan of Greenhollow', () => {
  test('each place stands on its kind of land', () => {
    const on = (id: string) => { const p = placeAt(id); return biomeAt(p.x, p.z); };
    expect([on('plot'), on('garden'), on('hall'), on('landing')]).toEqual(['meadow', 'meadow', 'meadow', 'meadow']);
    expect([on('seedvault'), on('shrine-forest'), on('ruin-stair')]).toEqual(['oldForest', 'oldForest', 'oldForest']);
    expect([on('boar'), on('terraces'), on('lampgallery'), on('pumphouse'), on('town')]).toEqual(['greyForest', 'terraces', 'caveHills', 'marsh', 'town']);
  });

  test('your plot is dry and green, the landing is on the bank, and the High Road is 80 blocks north', () => {
    const plot = placeAt('plot'), landing = placeAt('landing');
    expect(riverBank(plot.x, plot.z)).toBeGreaterThan(60);
    expect(Math.abs(riverBank(landing.x, landing.z))).toBeLessThan(6);
    expect(blightAt(plot.x, plot.z)).toBe(0);
    expect(highRoadDistance(plot.x, plot.z)).toBeGreaterThan(70);
    expect(highRoadDistance(plot.x, plot.z)).toBeLessThan(90);
  });

  test('grey follows gold: under the lit road it is grey, and the relit stretch greys only once it is lit', () => {
    const arches = placeAt('arches');
    expect(blightAt(arches.x, arches.z + 12)).toBeLessThan(0.2);
    expect(blightAt(arches.x, arches.z + 12, true)).toBeGreaterThan(0.5);
  });

  test('place ids are unique, and so are landmark ids', () => {
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
    expect(new Set(landmarkSites().map((s) => s.id)).size).toBe(landmarkSites().length);
    for (const l of LANDMARKS) expect(PLACES.some((p) => p.id === l.place), l.id).toBe(true);
  });
});

// The land itself: the whole map, made into blocks once. About 1,900 chunks.
const world = new World(SEED);
const X0 = toWorld([0, 0]).x, Z0 = toWorld([0, 0]).z;
for (let cx = (X0 >> 4) - 1; cx <= ((X0 + MAP_SIZE.w) >> 4) + 1; cx++) for (let cz = (Z0 >> 4) - 1; cz <= ((Z0 + MAP_SIZE.h) >> 4) + 1; cz++) world.load(cx, cz);
const WATER = blockId('water'), BARRIER = blockId('barrier');

describe('the land of Greenhollow', () => {
  test('the Mere is water along its whole line, from the north edge to the sea', () => {
    const dry: string[] = [];
    let looked = 0;
    for (let i = 0; i < RIVER.points.length - 1; i++) {
      const [ax, ay] = RIVER.points[i], [bx, by] = RIVER.points[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
      for (let k = 0; k <= n; k++) {
        const p = toWorld([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
        if (p.z < Z0 + 2 || p.z > Z0 + MAP_SIZE.h - 2 || p.x > X0 + MAP_SIZE.w - 2) continue;
        // The lip of the falls is a cliff, not a pool.
        const [fx, fy] = RIVER.points[RIVER.falls], [mx, my] = toMap(p.x, p.z);
        if (Math.hypot(mx - fx, my - fy) < 3) continue;
        looked++;
        const g = groundHeight(SEED, p.x, p.z);
        // A pier or a fallen span stands in it as a barrier.
        if (g >= waterLevelAt(p.x, p.z) || (world.getBlock(p.x, g, p.z) !== WATER && world.getBlock(p.x, g, p.z) !== BARRIER)) dry.push(`${p.x}, ${p.z}`);
      }
    }
    expect(looked).toBeGreaterThan(300);
    expect(dry).toEqual([]);
  });

  test('above the falls the Mere stands high in its gorge, and below them it is at the valley\'s water line', () => {
    const above = toWorld([RIVER.points[0][0] * 0.4 + RIVER.points[1][0] * 0.6, RIVER.points[0][1] * 0.4 + RIVER.points[1][1] * 0.6]);
    const below = toWorld([RIVER.points[2][0], RIVER.points[2][1]]);
    expect(waterLevelAt(above.x, above.z)).toBe(RIVER.high);
    expect(world.getBlock(above.x, RIVER.high - 1, above.z)).toBe(WATER);
    expect(waterLevelAt(below.x, below.z)).toBe(18);
  });

  test('the High Road\'s deck is walkable at its height over its whole length, but for its broken spans', () => {
    const spans = highRoadSpans();
    expect(spans.length).toBeGreaterThan(60);
    expect(spans.filter((s) => s.broken).length).toBe(HIGH_ROAD.broken.length);
    const holes: string[] = [];
    // The Order's engine stands on the deck and blocks it.
    const engines = landmarkSites().filter((s) => s.size.deck);
    for (const s of spans) {
      if (s.broken || engines.some((e) => Math.hypot(e.x - s.x, e.z - s.z) < HIGH_ROAD.span)) continue;
      for (let a = -4; a <= 4; a += 2) for (const b of [-1.5, 0, 1.5]) {
        const x = Math.floor(s.x + s.dx * a - s.dz * b), z = Math.floor(s.z + s.dz * a + s.dx * b);
        // Something solid at the deck's own top, and room to stand on it.
        const under = world.getBlock(x, DECK_Y - 1, z);
        if (under !== BARRIER || world.getBlock(x, DECK_Y, z) !== 0 || world.getBlock(x, DECK_Y + 1, z) !== 0) holes.push(`span ${s.n} at ${x}, ${z}`);
      }
    }
    expect(holes).toEqual([]);
  });

  test('each stair tower climbs from the ground to the deck', () => {
    const solid = (x: number, y: number, z: number): boolean => { const b = world.getBlock(x, y, z); return b !== 0 && b !== WATER; };
    const standable = (x: number, y: number, z: number): boolean => solid(x, y - 1, z) && !solid(x, y, z) && !solid(x, y + 1, z);
    for (const s of highRoadStairs()) {
      // Every place to stand within sixteen blocks of the stair, as x, y, z, walked a block at a time with a step of one.
      const x0 = Math.floor(s.x) - 16, z0 = Math.floor(s.z) - 16, seen = new Set<string>();
      const start = { x: Math.floor(s.x - s.dx * 16), z: Math.floor(s.z - s.dz * 16) };
      const queue = [[start.x, groundHeight(SEED, start.x, start.z), start.z]];
      let deck = false;
      for (let q = 0; q < queue.length && !deck; q++) {
        const [x, y, z] = queue[q];
        if (y === DECK_Y && Math.hypot(x + 0.5 - s.x, z + 0.5 - s.z) <= HIGH_ROAD.half + 1) deck = true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < x0 || nz < z0 || nx > x0 + 32 || nz > z0 + 32) continue;
          for (const ny of [y - 1, y, y + 1]) {
            const key = `${nx},${ny},${nz}`;
            // Climbing a block needs headroom over the block you stand on.
            if (seen.has(key) || !standable(nx, ny, nz) || (ny > y && solid(x, y + 2, z))) continue;
            seen.add(key);
            queue.push([nx, ny, nz]);
          }
        }
      }
      expect(deck, `the stair at ${Math.round(s.x)}, ${Math.round(s.z)}`).toBe(true);
    }
  });

  test('every place of the plan is reachable on foot from your plot', () => {
    const W = MAP_SIZE.w, H = MAP_SIZE.h;
    // Where feet stand in each column, walking on the ground, planks and the High Road's stairs, or NaN where no one can.
    const feet = new Float32Array(W * H).fill(NaN);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = X0 + i, z = Z0 + j;
      // The lowest place to stand: something solid under the feet (not water) and two free blocks over it.
      // A plank over water holds you up; a barrier two high is a wall, and its top is out of reach.
      const solid = (y: number): boolean => { const b = world.getBlock(x, y, z); return b !== 0 && b !== WATER; };
      for (let y = groundHeight(SEED, x, z); y < 60; y++) {
        if (solid(y - 1) && !solid(y) && !solid(y + 1)) { feet[j * W + i] = y; break; }
      }
    }
    const start = placeAt('plot'), reached = new Uint8Array(W * H);
    const queue = [(start.z - Z0) * W + (start.x - X0)];
    reached[queue[0]] = 1;
    for (let q = 0; q < queue.length; q++) {
      const at = queue[q], i = at % W, j = (at - i) / W, h = feet[at];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = nj * W + ni;
        if (reached[n] || !(Math.abs(feet[n] - h) <= 1)) continue;
        reached[n] = 1;
        queue.push(n);
      }
    }
    const missed: string[] = [];
    for (const p of planStands()) {
      if (p.id === 'dawn') continue;
      const i = p.x - X0, j = p.z - Z0;
      // The place or a column beside it.
      let ok = false;
      for (let dj = -2; dj <= 2 && !ok; dj++) for (let di = -2; di <= 2 && !ok; di++) ok = reached[(j + dj) * W + i + di] === 1;
      if (!ok) missed.push(`${p.id} at ${p.x}, ${p.z}`);
    }
    expect(missed).toEqual([]);
    // The top of the terraces too, up their stair.
    const top = toWorld([TERRACES.stair.x, TERRACES.center[1] + 4]);
    expect(reached[(top.z - Z0) * W + top.x - X0]).toBe(1);
  });

  test('no plan path runs through a landmark you cannot walk through', () => {
    const blocked: string[] = [];
    for (const s of landmarkSites()) {
      if (s.size.open || s.size.walk || s.size.deck || s.model === 'highRoadArch') continue;
      for (let x = Math.floor(s.x - s.hx); x <= Math.ceil(s.x + s.hx); x++) for (let z = Math.floor(s.z - s.hz); z <= Math.ceil(s.z + s.hz); z++) {
        if (world.getBlock(x, groundHeight(SEED, x, z) - 1, z) === blockId('path') && world.getBlock(x, groundHeight(SEED, x, z), z) === BARRIER) blocked.push(`${s.id} at ${x}, ${z}`);
      }
    }
    expect(blocked).toEqual([]);
  });
});

