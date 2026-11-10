// The atlas packer: finds a place for every sprite sheet on as few pages as it can, and as small a
// page as it can. It is a skyline packer: each page remembers its upper outline, and a sheet goes
// where that outline is lowest. Plain numbers only, so the test can run thousands of cases.
import { AssetError } from './manifest.ts';

export interface PackItem {
  id: string;
  width: number;
  height: number;
}

export interface Placement extends PackItem {
  page: number;
  x: number;
  y: number;
}

export interface PackResult {
  /** The size of every page. Each side is a power of two. */
  width: number;
  height: number;
  pages: number;
  /** In the order the items came in. */
  placements: Placement[];
}

export interface PackOptions {
  /** The longest side a page may have. */
  maxSize: number;
  /** Every x, y and reserved size is a multiple of this, so mipmaps do not mix two sheets. Default 1. */
  align?: number;
  /** The smallest page side to try. Default 256. */
  minSize?: number;
}

interface Segment {
  x: number;
  y: number;
  width: number;
}

/** One page's outline, left to right. The segments always cover the full width. */
class Skyline {
  private readonly segments: Segment[];

  constructor(private readonly width: number, private readonly height: number) {
    this.segments = [{ x: 0, y: 0, width }];
  }

  /** Reserves a `width` by `height` box and returns its corner, or null when the page has no room. */
  place(width: number, height: number): { x: number; y: number } | null {
    const segments = this.segments;
    let bestIndex = -1, bestY = Infinity;
    for (let i = 0; i < segments.length; i++) {
      const x = segments[i].x;
      if (x + width > this.width) break;
      // The box rests on the highest segment under it.
      let y = 0;
      for (let j = i, covered = 0; covered < width; covered += segments[j].width, j++) y = Math.max(y, segments[j].y);
      if (y + height <= this.height && y < bestY) {
        bestY = y;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) return null;

    const x = segments[bestIndex].x;
    const end = x + width;
    segments.splice(bestIndex, 0, { x, y: bestY + height, width });
    // Whatever the new segment covers is gone. The one it half covers starts where the new one ends.
    while (bestIndex + 1 < segments.length) {
      const next = segments[bestIndex + 1];
      if (next.x >= end) break;
      const cut = end - next.x;
      if (next.width <= cut) {
        segments.splice(bestIndex + 1, 1);
      } else {
        next.x += cut;
        next.width -= cut;
        break;
      }
    }
    return { x, y: bestY };
  }
}

const roundUp = (value: number, step: number): number => Math.ceil(value / step) * step;

/** Tries to put every item on pages of one size. Returns null when it needs more than `maxPages`. */
function tryPack(order: PackItem[], width: number, height: number, align: number, maxPages: number): Map<string, { page: number; x: number; y: number }> | null {
  const pages: Skyline[] = [];
  const placed = new Map<string, { page: number; x: number; y: number }>();
  for (const item of order) {
    const w = roundUp(item.width, align), h = roundUp(item.height, align);
    let spot: { x: number; y: number } | null = null;
    let page = 0;
    for (; page < pages.length && !spot; page++) spot = pages[page].place(w, h);
    if (spot) {
      page--;
    } else {
      if (pages.length >= maxPages) return null;
      pages.push(new Skyline(width, height));
      page = pages.length - 1;
      spot = pages[page].place(w, h);
      if (!spot) return null;
    }
    placed.set(item.id, { page, x: spot.x, y: spot.y });
  }
  return placed;
}

/**
 * Packs the items. It tries one page first, from the smallest size up to `maxSize`, and only uses
 * more pages when one page of `maxSize` cannot hold them. No two items ever overlap.
 */
export function packAtlas(items: readonly PackItem[], options: PackOptions): PackResult {
  const align = options.align ?? 1;
  // The largest power of two the limit allows.
  const maxSize = 2 ** Math.floor(Math.log2(Math.max(1, options.maxSize)));
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new AssetError(`The atlas packer got two sheets named "${item.id}".`);
    seen.add(item.id);
    if (!(item.width >= 1 && item.height >= 1)) throw new AssetError(`Sprite sheet "${item.id}" has no size (${item.width} by ${item.height}).`);
    if (roundUp(item.width, align) > maxSize || roundUp(item.height, align) > maxSize) {
      throw new AssetError(`Sprite sheet "${item.id}" is ${item.width} by ${item.height}, larger than the biggest atlas page (${maxSize} by ${maxSize}). Split the sheet.`);
    }
  }

  // Tall sheets first: the outline stays flat and less room is lost under it.
  const order = [...items].sort((a, b) => b.height - a.height || b.width - a.width || (a.id < b.id ? -1 : 1));
  const finish = (width: number, height: number, placed: Map<string, { page: number; x: number; y: number }>): PackResult => {
    let pages = 0;
    const placements = items.map((item) => {
      const spot = placed.get(item.id) as { page: number; x: number; y: number };
      pages = Math.max(pages, spot.page + 1);
      return { ...item, ...spot };
    });
    return { width, height, pages: Math.max(pages, 1), placements };
  };

  // One page: square, then twice as wide as it is tall, then the next square.
  for (let size = Math.min(options.minSize ?? 256, maxSize); size <= maxSize; size *= 2) {
    for (const width of [size, size * 2]) {
      if (width > maxSize) continue;
      const placed = tryPack(order, width, size, align, 1);
      if (placed) return finish(width, size, placed);
    }
  }
  return finish(maxSize, maxSize, tryPack(order, maxSize, maxSize, align, Infinity) as Map<string, { page: number; x: number; y: number }>);
}
