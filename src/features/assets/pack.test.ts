import { expect, test } from 'bun:test';
import { packAtlas, type PackItem, type PackResult } from './pack.ts';

/** A small seeded random number source, so a failing case can be run again. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every pair of sheets on the same page, checked for a shared pixel. Also checks each sheet is inside its page. */
function expectNoOverlap(result: PackResult, align = 1): void {
  const list = result.placements;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x + a.width).toBeLessThanOrEqual(result.width);
    expect(a.y + a.height).toBeLessThanOrEqual(result.height);
    expect(a.page).toBeLessThan(result.pages);
    expect(a.x % align).toBe(0);
    expect(a.y % align).toBe(0);
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const apart = a.page !== b.page || a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
      if (!apart) throw new Error(`${a.id} at ${a.x},${a.y} (${a.width}x${a.height}) overlaps ${b.id} at ${b.x},${b.y} (${b.width}x${b.height}) on page ${a.page}`);
    }
  }
}

const sheet = (id: string, width: number, height: number): PackItem => ({ id, width, height });

// The sheets in public/assets today, and the color variants the demo adds.
const TODAY = [sheet('hero', 768, 896), sheet('villager-a', 512, 768), sheet('villager-b', 512, 768), sheet('pet', 384, 576), sheet('critter', 384, 576)];

test("today's five sheets fit one 2048 page and none overlap", () => {
  const result = packAtlas(TODAY, { maxSize: 4096, align: 32 });
  expectNoOverlap(result, 32);
  expect(result.pages).toBe(1);
  expect([result.width, result.height]).toEqual([2048, 2048]);
  expect(result.placements.map((p) => p.id)).toEqual(TODAY.map((s) => s.id));
});

test('two sheets never overlap, across 400 random sets of sizes', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const next = random(seed);
    const count = 1 + Math.floor(next() * 40);
    const align = [1, 4, 32][seed % 3];
    const items = Array.from({ length: count }, (_, i) => sheet(`s${i}`, 1 + Math.floor(next() * 700), 1 + Math.floor(next() * 900)));
    const result = packAtlas(items, { maxSize: 2048, align });
    expectNoOverlap(result, align);
    // Every sheet is placed once and keeps its size.
    expect(result.placements.length).toBe(count);
    result.placements.forEach((p, i) => expect([p.id, p.width, p.height]).toEqual([items[i].id, items[i].width, items[i].height]));
  }
});

test('the version 1 art, about ninety sheets, packs without overlap and without waste beyond a page', () => {
  const next = random(90);
  const sizes: [number, number][] = [[768, 896], [512, 768], [384, 576], [512, 512], [256, 384]];
  const items = Array.from({ length: 90 }, (_, i) => sheet(`sheet-${i}`, ...sizes[Math.floor(next() * sizes.length)]));
  const result = packAtlas(items, { maxSize: 4096, align: 32 });
  expectNoOverlap(result, 32);
  const area = items.reduce((sum, s) => sum + s.width * s.height, 0);
  // No more pages than the art needs, plus one for the room a packer always loses.
  expect(result.pages).toBeLessThanOrEqual(Math.ceil(area / (4096 * 4096)) + 1);
});

test('one page is used while one page can hold everything', () => {
  // Four sheets that exactly tile a 1024 page.
  const exact = packAtlas([sheet('a', 512, 512), sheet('b', 512, 512), sheet('c', 512, 512), sheet('d', 512, 512)], { maxSize: 1024 });
  expectNoOverlap(exact);
  expect([exact.width, exact.height, exact.pages]).toEqual([1024, 1024, 1]);
  // A fifth does not fit the biggest page, so a second page opens.
  const more = packAtlas([sheet('a', 512, 512), sheet('b', 512, 512), sheet('c', 512, 512), sheet('d', 512, 512), sheet('e', 512, 512)], { maxSize: 1024 });
  expectNoOverlap(more);
  expect([more.width, more.height, more.pages]).toEqual([1024, 1024, 2]);
});

test('the page is the smallest power of two that fits', () => {
  expect(packAtlas([sheet('a', 100, 100)], { maxSize: 4096 })).toMatchObject({ width: 256, height: 256, pages: 1 });
  expect(packAtlas([sheet('a', 300, 200), sheet('b', 200, 200)], { maxSize: 4096 })).toMatchObject({ width: 512, height: 256, pages: 1 });
  expect(packAtlas([sheet('a', 300, 300)], { maxSize: 4096 })).toMatchObject({ width: 512, height: 512, pages: 1 });
  expect(packAtlas([], { maxSize: 4096 })).toMatchObject({ pages: 1, placements: [] });
});

test('a sheet larger than a page fails with its name', () => {
  expect(() => packAtlas([sheet('hero', 768, 896), sheet('mural', 5000, 300)], { maxSize: 4096 })).toThrow(/"mural" is 5000 by 300, larger than the biggest atlas page \(4096 by 4096\)/);
});

test('two sheets with one name fail with that name', () => {
  expect(() => packAtlas([sheet('pet', 96, 96), sheet('pet', 96, 96)], { maxSize: 1024 })).toThrow(/two sheets named "pet"/);
});
