import { expect, test } from 'bun:test';
import { AssetError } from './manifest.ts';
import { PLACEHOLDER_ANCHOR, PLACEHOLDER_FRAME, drawPlaceholder, measureBody, parseColor, recolor, type Pixels } from './pixels.ts';

/** A one row image from a list of [r, g, b, a]. */
function row(...pixels: [number, number, number, number][]): Pixels {
  return { width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flat()) };
}

const RED: [number, number, number, number] = [0xd6, 0x7c, 0x59, 255];
const BLUE: [number, number, number, number] = [0x4d, 0x71, 0x93, 255];
const NEAR_RED: [number, number, number, number] = [0xd6, 0x7c, 0x5a, 255];
const CLEAR_RED: [number, number, number, number] = [0xd6, 0x7c, 0x59, 0];

test('a color reads with or without the hash, in either case', () => {
  expect(parseColor('#d67c59')).toBe(0xd67c59);
  expect(parseColor('D67C59')).toBe(0xd67c59);
  expect(() => parseColor('#d67')).toThrow(new AssetError('"#d67" is not a color. Write it as #rrggbb.'));
  expect(() => parseColor('red')).toThrow(AssetError);
});

test('only exact colors change, and clear pixels are left alone', () => {
  const source = row(RED, NEAR_RED, CLEAR_RED, BLUE);
  const result = recolor(source, { '#d67c59': '#918996' });
  expect([...result.pixels.data]).toEqual([0x91, 0x89, 0x96, 255, ...NEAR_RED, ...CLEAR_RED, ...BLUE]);
  expect(result.swapped).toBe(1);
  expect(result.unused).toEqual([]);
  // The source is not touched.
  expect([...source.data.slice(0, 4)]).toEqual(RED);
});

test('all swaps happen at once, so two colors can trade places', () => {
  const result = recolor(row(RED, BLUE, RED), { '#d67c59': '#4d7193', '#4d7193': '#d67c59' });
  expect([...result.pixels.data]).toEqual([...BLUE, ...RED, ...BLUE]);
  expect(result.swapped).toBe(3);
});

test('a color no pixel has is reported', () => {
  const result = recolor(row(RED), { '#d67c59': '#918996', '#00ff00': '#ff00ff' });
  expect(result.swapped).toBe(1);
  expect(result.unused).toEqual(['#00ff00']);
});

test('the body is the box around the solid pixels of one frame', () => {
  // Two 4 by 4 frames side by side. The second holds a 2 by 3 block.
  const pixels: Pixels = { width: 8, height: 4, data: new Uint8ClampedArray(8 * 4 * 4) };
  for (const [x, y] of [[5, 1], [6, 1], [5, 2], [6, 2], [5, 3], [6, 3]]) pixels.data[(y * 8 + x) * 4 + 3] = 255;
  expect(measureBody(pixels, 4, 0, 4, 4)).toEqual([1, 1, 3, 4]);
  // An empty frame reports the whole frame.
  expect(measureBody(pixels, 0, 0, 4, 4)).toEqual([0, 0, 4, 4]);
});

test('the placeholder is a solid figure that stands on its anchor', () => {
  const pixels = drawPlaceholder();
  expect([pixels.width, pixels.height]).toEqual([...PLACEHOLDER_FRAME]);
  const [left, top, right, bottom] = measureBody(pixels, 0, 0, pixels.width, pixels.height);
  expect(bottom).toBe(PLACEHOLDER_ANCHOR[1]);
  expect((left + right) / 2).toBe(PLACEHOLDER_ANCHOR[0]);
  expect(top).toBeGreaterThan(0);
  // Alpha is all or nothing, like the generated sheets.
  for (let i = 3; i < pixels.data.length; i += 4) expect(pixels.data[i] === 0 || pixels.data[i] === 255).toBe(true);
});
