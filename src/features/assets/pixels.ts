// Raw pixels and the few things done to them before they reach the GPU: recoloring a sheet,
// measuring a character's body, and drawing the placeholder. No Three.js and no page here.
import { AssetError } from './manifest.ts';

/** An image as bytes: red, green, blue, alpha for each pixel, rows from the top. Alpha is not multiplied in. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** From one exact color to another, as hex: `{ '#d67c59': '#918996' }`. */
export type ColorMap = Readonly<Record<string, string>>;

/** Reads `#rrggbb` (the `#` is optional) into 0xRRGGBB. */
export function parseColor(text: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(text.trim());
  if (!match) throw new AssetError(`"${text}" is not a color. Write it as #rrggbb.`);
  return parseInt(match[1], 16);
}

export interface Recolored {
  pixels: Pixels;
  /** How many pixels changed. */
  swapped: number;
  /** Colors in the map that no pixel had. */
  unused: string[];
}

/**
 * Copies an image, swapping each color in the map for its partner. Only exact matches change, and
 * all swaps happen at once, so `{ a: b, b: a }` trades two colors. Clear pixels are left alone.
 */
export function recolor(source: Pixels, map: ColorMap): Recolored {
  const swaps = new Map<number, number>();
  const hits = new Map<number, number>();
  const names = new Map<number, string>();
  for (const [from, to] of Object.entries(map)) {
    const key = parseColor(from);
    swaps.set(key, parseColor(to));
    hits.set(key, 0);
    names.set(key, from);
  }
  const data = new Uint8ClampedArray(source.data);
  let swapped = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    const to = swaps.get(key);
    if (to === undefined) continue;
    data[i] = to >> 16;
    data[i + 1] = (to >> 8) & 255;
    data[i + 2] = to & 255;
    hits.set(key, (hits.get(key) as number) + 1);
    swapped++;
  }
  const unused: string[] = [];
  for (const [key, count] of hits) if (count === 0) unused.push(names.get(key) as string);
  return { pixels: { width: source.width, height: source.height, data }, swapped, unused };
}

/** The box around the solid pixels of one frame, in frame pixels: left, top, right, bottom. Right and bottom are one past the last pixel. */
export function measureBody(pixels: Pixels, frameX: number, frameY: number, frameWidth: number, frameHeight: number): [number, number, number, number] {
  let left = frameWidth, top = frameHeight, right = 0, bottom = 0;
  for (let y = 0; y < frameHeight; y++) {
    const row = ((frameY + y) * pixels.width + frameX) * 4;
    for (let x = 0; x < frameWidth; x++) {
      if (pixels.data[row + x * 4 + 3] < 128) continue;
      if (x < left) left = x;
      if (x + 1 > right) right = x + 1;
      if (y < top) top = y;
      if (y + 1 > bottom) bottom = y + 1;
    }
  }
  // An empty frame has no body: report the whole frame so nothing downstream divides by zero.
  return right > left ? [left, top, right, bottom] : [0, 0, frameWidth, frameHeight];
}

export const PLACEHOLDER_FRAME: readonly [number, number] = [32, 64];
export const PLACEHOLDER_ANCHOR: readonly [number, number] = [16, 62];

/** The stand-in for a sprite the manifest does not have: a plain magenta figure with a dark edge, one frame. */
export function drawPlaceholder(): Pixels {
  const [width, height] = PLACEHOLDER_FRAME;
  const data = new Uint8ClampedArray(width * height * 4);
  const inside = (x: number, y: number): boolean => {
    const head = (x - 15.5) ** 2 + (y - 14.5) ** 2 <= 9.5 ** 2;
    const body = x >= 8 && x <= 23 && y >= 24 && y <= 61 && !((x < 10 || x > 21) && (y < 26 || y > 59));
    return head || body;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const i = (y * width + x) * 4;
      data[i] = edge ? 0x4a : 0xd8;
      data[i + 1] = edge ? 0x1e : 0x4f;
      data[i + 2] = edge ? 0x4a : 0xc8;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}
