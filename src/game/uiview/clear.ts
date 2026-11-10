// Keeps the waypoint's edge arrow clear of the HUD. The map feature puts the arrow a margin inside the
// screen's edge, pointing at a waypoint off screen, and knows nothing of the panels at the edges: the
// quest tracker, the minimap, the clock and the quick slots. This slides the arrow along the edge it is
// on until its box touches none of them. No page here, so the tests run it. The map view calls it.

/** The arrow's box around its point, in pixels: how far it reaches left, up, right and down. */
export interface MarkBox {
  left: number;
  up: number;
  right: number;
  down: number;
}

/**
 * Where the mark at (x, y) goes so its box clears every rectangle in `rects` by `gap` pixels.
 * `rects` holds `count` rectangles as left, top, right, bottom, in the same pixels. `alongY` is true
 * when the mark is on the left or right edge, so it slides up or down; otherwise it slides sideways.
 * It moves the shortest way that is clear and stays on the screen, tries the other direction when the
 * edge has no room, and stays put when nothing is clear. Writes into `out` and returns it.
 */
export function clearOfPanels(
  x: number, y: number, box: MarkBox, alongY: boolean,
  rects: ArrayLike<number>, count: number, width: number, height: number, gap: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  out.x = x;
  out.y = y;
  if (free(x, y, box, rects, count, width, height, gap)) return out;
  if (slide(x, y, box, alongY, rects, count, width, height, gap, out)) return out;
  if (slide(x, y, box, !alongY, rects, count, width, height, gap, out)) return out;
  out.x = x;
  out.y = y;
  return out;
}

function slide(
  x: number, y: number, box: MarkBox, alongY: boolean,
  rects: ArrayLike<number>, count: number, width: number, height: number, gap: number,
  out: { x: number; y: number },
): boolean {
  let best = Infinity;
  for (let i = 0; i < count; i++) {
    const l = rects[i * 4], t = rects[i * 4 + 1], r = rects[i * 4 + 2], b = rects[i * 4 + 3];
    // Just past each end of this panel, along the edge.
    for (let side = 0; side < 2; side++) {
      const cx = alongY ? x : side === 0 ? l - gap - box.right : r + gap + box.left;
      const cy = alongY ? (side === 0 ? t - gap - box.down : b + gap + box.up) : y;
      const moved = Math.abs(cx - x) + Math.abs(cy - y);
      if (moved >= best || !free(cx, cy, box, rects, count, width, height, gap)) continue;
      best = moved;
      out.x = cx;
      out.y = cy;
    }
  }
  return best < Infinity;
}

function free(x: number, y: number, box: MarkBox, rects: ArrayLike<number>, count: number, width: number, height: number, gap: number): boolean {
  const l = x - box.left, t = y - box.up, r = x + box.right, b = y + box.down;
  if (l < 0 || t < 0 || r > width || b > height) return false;
  for (let i = 0; i < count; i++) {
    if (l < rects[i * 4 + 2] + gap && r > rects[i * 4] - gap && t < rects[i * 4 + 3] + gap && b > rects[i * 4 + 1] - gap) return false;
  }
  return true;
}
