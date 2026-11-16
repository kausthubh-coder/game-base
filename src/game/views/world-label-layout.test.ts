import { expect, test } from 'bun:test';
import { fitLabel, overlaps } from './world-label-layout.ts';
test('a three-resident home stays below the screen edge', () => {
  const box = { x: 0, y: 0, w: 210, h: 80 };
  fitLabel(box, 720, -20, 1366, 768, []);
  expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.x + box.w).toBeLessThan(1366);
});
test('nearby farm tags keep every line clear of each other and the Almanac', () => {
  const hud = { x: 530, y: 16, w: 300, h: 44 };
  const fox = { x: 0, y: 0, w: 340, h: 80 };
  const bait = { x: 0, y: 0, w: 340, h: 80 };
  fitLabel(fox, 680, 450, 1366, 768, [hud]);
  fitLabel(bait, 790, 440, 1366, 768, [hud, fox]);
  expect(overlaps(fox, bait)).toBe(false);
  expect(overlaps(fox, hud)).toBe(false);
});
test('narrow labels stay inside the viewport and remain deterministic', () => {
  const first = { x: 0, y: 0, w: 300, h: 90 };
  const second = { x: 0, y: 0, w: 300, h: 90 };
  fitLabel(first, 20, -30, 390, 844, []);
  fitLabel(second, 200, 110, 390, 844, [first]);
  expect(overlaps(first, second)).toBe(false);
  expect(second.x).toBeGreaterThanOrEqual(8);
  expect(second.x + second.w).toBeLessThanOrEqual(382);
  const y = second.y;
  fitLabel(second, 200, 110, 390, 844, [first]);
  expect(second.y).toBe(y);
});
test('a full vertical column uses clear space beside it', () => {
  const column = { x: 480, y: 72, w: 340, h: 600 };
  const box = { x: 0, y: 0, w: 200, h: 50 };
  expect(fitLabel(box, 650, 400, 1366, 768, [column])).toBe(true);
  expect(overlaps(box, column)).toBe(false);
});
test('crowding reports no position instead of covering the hero or HUD', () => {
  const box = { x: 0, y: 0, w: 300, h: 80 };
  expect(fitLabel(box, 195, 400, 390, 844, [{ x: 0, y: 0, w: 390, h: 844 }], 1, 160)).toBe(false);
});
test('farm displacement stays bounded to its own anchor', () => {
  const box = { x: 0, y: 0, w: 200, h: 40 };
  expect(fitLabel(box, 650, 400, 1366, 768, [{ x: 380, y: 120, w: 540, h: 520 }], 1, 160)).toBe(
    false,
  );
});
