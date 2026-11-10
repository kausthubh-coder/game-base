// The round minimap: about 120 blocks across, turned with the camera, on a 2D canvas.
//
// It has to cost well under a millisecond a frame, so a frame never asks for the land's colors
// directly. The colors live in a small picture, one pixel a block, north up, that follows the
// player. A frame draws that picture once, turned, and then a handful of small marks from a sheet
// drawn once. New land is painted into the picture a strip at a time as the player walks, within a
// budget of pixels a frame.
import './map.css';
import { clampToDisc, emptyEdgeMark, toMinimap, wrapAngle } from './geometry.sim.ts';
import { ARROW_PATH, PIN_PATHS, WAYPOINT_PATHS, hex } from './icons.ts';
import { PIN_KINDS, WAYPOINT_COLORS, WAYPOINT_COLOR_NAMES, WAYPOINT_ICONS, type Marks, type Waypoint } from './marks.sim.ts';

/**
 * The color of the top of a column of blocks, as 0xRRGGBB. The game gives the map this function.
 * It may return a negative number for land that has not loaded yet. The map leaves that land
 * blank and asks again a little later, so no call is needed when the land arrives.
 */
export type ColorAt = (x: number, z: number) => number;

/** Something that moves, shown on the minimap and the full map. The game keeps a list and changes it in place. */
export interface MapMarker {
  kind: 'friend' | 'pet' | 'quest' | 'enemy';
  x: number;
  z: number;
  /** A CSS color for a friend's dot. */
  color?: string;
}

export interface MinimapStats {
  /** Frames since the last reset, and how many of them drew. A frame where nothing moved draws nothing. */
  frames: number;
  drawn: number;
  /** Milliseconds spent in the minimap: all frames added up, the worst frame and the last. */
  totalMs: number;
  maxMs: number;
  lastMs: number;
  reset(): void;
}

export interface MinimapOptions {
  colorAt: ColorAt;
  /** How many blocks the minimap shows across. 120 by default. */
  blocks?: number;
  /** Which waypoints show as an arrow at the rim when they are off the minimap: all of them, or only the active one. */
  edgeArrows?: 'all' | 'active';
  /** New pixels of land painted in one frame at most. */
  fillBudget?: number;
  /** Called when the minimap is clicked, tapped or pressed with Enter. */
  onOpen?: () => void;
}

export interface Minimap {
  readonly element: HTMLElement;
  readonly stats: MinimapStats;
  /** Repaints part of the land after the world changes. Blocks outside what the minimap holds are ignored. */
  invalidate(x: number, z: number, width: number, depth: number): void;
  /** Draws one frame. `facing` is the way the player faces and `yaw` is the camera's, both in radians. */
  draw(playerX: number, playerZ: number, facing: number, yaw: number, markers: readonly MapMarker[]): void;
  dispose(): void;
}

/** The land picture's side in blocks. The minimap shows 60 blocks each way, turned, so it needs a margin all round. */
const CACHE = 192;
/** The picture follows the player once they are this many blocks from its middle. */
const SHIFT = 8;
const BAND = 8;
const QUEUE = 24;
/** A mark's box on the sheet, in CSS pixels. */
const CELL = 22;
const COLS = 10;
const SPRITE_NORTH = 0, SPRITE_PLAYER = 1, SPRITE_PET = 2, SPRITE_QUEST = 3, SPRITE_ENEMY = 4, SPRITE_PIN = 5;
const SPRITE_WAYPOINT = SPRITE_PIN + PIN_KINDS.length;
const SPRITE_ARROW = SPRITE_WAYPOINT + WAYPOINT_ICONS.length * WAYPOINT_COLOR_NAMES.length;
const SPRITE_COUNT = SPRITE_ARROW + WAYPOINT_COLOR_NAMES.length;
const INK = '#2f2116', PAPER = '#f3e7c9', BRASS = '#c79a48';
/** Land that has not loaded yet is drawn as blank parchment, in the canvas's own byte order. */
const UNKNOWN = 0xffa2c8d8;
/** Land is asked for again in squares of 16 blocks, a few every third of a second. */
const RETRY_FRAMES = 20, RETRY_SQUARES = 6;
const PET_PATH = 'M5 9.5 6.6 3l4 3.2h2.8l4-3.2L19 9.5c1.2 6-2 10.5-7 10.5S3.8 15.5 5 9.5z';
const DASH = [3, 3], NO_DASH: number[] = [];
const COLOR_CSS = Object.fromEntries(WAYPOINT_COLOR_NAMES.map((name) => [name, hex(WAYPOINT_COLORS[name])])) as Record<string, string>;

const iconIndex = (w: Waypoint): number => SPRITE_WAYPOINT + WAYPOINT_ICONS.indexOf(w.icon) * WAYPOINT_COLOR_NAMES.length + WAYPOINT_COLOR_NAMES.indexOf(w.color);
const arrowIndex = (w: Waypoint): number => SPRITE_ARROW + WAYPOINT_COLOR_NAMES.indexOf(w.color);

/** Draws every mark once, so a frame only copies them. */
function drawSheet(sheet: HTMLCanvasElement, dpr: number): void {
  const px = Math.round(CELL * dpr);
  sheet.width = px * COLS;
  sheet.height = px * Math.ceil(SPRITE_COUNT / COLS);
  const g = sheet.getContext('2d')!;
  g.lineJoin = 'round';
  const at = (index: number): void => {
    g.setTransform(px / CELL, 0, 0, px / CELL, (index % COLS) * px, Math.floor(index / COLS) * px);
  };
  // A path from the 24-box icons, centered in the cell at `size` pixels.
  const icon = (path: string, size: number, fill: string, stroke = '', line = 0): void => {
    g.save();
    g.translate(CELL / 2 - size / 2, CELL / 2 - size / 2);
    g.scale(size / 24, size / 24);
    const shape = new Path2D(path);
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = (line * 24) / size;
      g.stroke(shape);
    }
    g.fillStyle = fill;
    g.fill(shape, 'evenodd');
    g.restore();
  };
  const disc = (radius: number, fill: string, line = 1.25): void => {
    g.beginPath();
    g.arc(CELL / 2, CELL / 2, radius, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = line;
    g.stroke();
  };

  at(SPRITE_NORTH);
  disc(7.5, BRASS);
  g.fillStyle = INK;
  g.font = '700 10px ui-serif, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('N', CELL / 2, CELL / 2 + 0.5);

  at(SPRITE_PLAYER);
  icon(ARROW_PATH, 19, '#fffdf4', INK, 2.6);

  at(SPRITE_PET);
  icon(PET_PATH, 13, '#f2a23c', INK, 2.2);

  at(SPRITE_QUEST);
  disc(6.5, '#f4c542');
  icon(PIN_PATHS.quest, 10, INK);

  at(SPRITE_ENEMY);
  icon(WAYPOINT_PATHS.danger, 13, '#c8362c', INK, 2);

  PIN_KINDS.forEach((kind, i) => {
    at(SPRITE_PIN + i);
    disc(7.5, PAPER);
    icon(PIN_PATHS[kind], 10.5, INK);
  });

  WAYPOINT_ICONS.forEach((name, i) => {
    WAYPOINT_COLOR_NAMES.forEach((color, c) => {
      at(SPRITE_WAYPOINT + i * WAYPOINT_COLOR_NAMES.length + c);
      disc(8, COLOR_CSS[color], 1.5);
      icon(WAYPOINT_PATHS[name], 10.5, '#fffdf4');
    });
  });

  WAYPOINT_COLOR_NAMES.forEach((color, c) => {
    at(SPRITE_ARROW + c);
    icon(ARROW_PATH, 16, COLOR_CSS[color], INK, 2.4);
  });
}

export function createMinimap(marks: Marks, options: MinimapOptions): Minimap {
  const colorAt = options.colorAt;
  const blocks = options.blocks ?? 120;
  const allArrows = (options.edgeArrows ?? 'all') === 'all';
  const fillBudget = options.fillBudget ?? 1024;

  const element = document.createElement('div');
  element.className = 'gb-minimap';
  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  element.setAttribute('aria-label', 'Minimap. Open the full map.');
  const canvas = document.createElement('canvas');
  element.append(canvas);
  const g = canvas.getContext('2d', { alpha: false })!;
  const stop = new AbortController();
  element.addEventListener('click', () => options.onOpen?.(), { signal: stop.signal });
  element.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault();
    e.stopPropagation();
    options.onOpen?.();
  }, { signal: stop.signal });

  // The land picture: one pixel a block, north up. Pixel (0, 0) is the block at (originX, originZ).
  const cache = document.createElement('canvas');
  cache.width = cache.height = CACHE;
  const cg = cache.getContext('2d', { alpha: false })!;
  const band = cg.createImageData(CACHE, BAND);
  const band32 = new Uint32Array(band.data.buffer);
  let originX = 0, originZ = 0, valid = false;
  // Strips of land waiting to be painted, as x, z, width, depth in blocks.
  const rects = new Int32Array(QUEUE * 4);
  let rectCount = 0;
  // Squares of 16 blocks that held land with no color yet, to ask for again.
  const unknown = new Set<number>();
  let lastUnknown = -1, retryClock = 0;

  const paint = (x: number, z: number, width: number, rows: number): void => {
    for (let r = 0; r < rows; r++) {
      let p = r * CACHE;
      for (let c = 0; c < width; c++) {
        const color = colorAt(x + c, z + r);
        if (color < 0) {
          const square = (((x + c) >> 4) + 32768) * 65536 + (((z + r) >> 4) + 32768);
          if (square !== lastUnknown) unknown.add((lastUnknown = square));
          band32[p++] = UNKNOWN;
          continue;
        }
        // Canvas pixels are red, green, blue, alpha in memory order.
        band32[p++] = 0xff000000 | ((color & 0xff) << 16) | (color & 0xff00) | ((color >> 16) & 0xff);
      }
    }
    cg.putImageData(band, x - originX, z - originZ, 0, 0, width, rows);
  };

  const enqueue = (x: number, z: number, width: number, depth: number): void => {
    let x0 = Math.max(Math.floor(x), originX), z0 = Math.max(Math.floor(z), originZ);
    let x1 = Math.min(Math.ceil(x + width), originX + CACHE), z1 = Math.min(Math.ceil(z + depth), originZ + CACHE);
    if (x1 <= x0 || z1 <= z0) return;
    if (rectCount === QUEUE) {
      // Too many small changes at once: paint one box that holds them all.
      for (let i = 0; i < rectCount * 4; i += 4) {
        x0 = Math.min(x0, rects[i]); z0 = Math.min(z0, rects[i + 1]);
        x1 = Math.max(x1, rects[i] + rects[i + 2]); z1 = Math.max(z1, rects[i + 1] + rects[i + 3]);
      }
      rectCount = 0;
    }
    const i = rectCount++ * 4;
    rects[i] = x0; rects[i + 1] = z0; rects[i + 2] = x1 - x0; rects[i + 3] = z1 - z0;
  };

  /** Paints waiting land, up to `budget` pixels. Returns true when it painted anything. */
  const work = (budget: number): boolean => {
    let painted = false;
    while (rectCount > 0 && budget > 0) {
      const i = (rectCount - 1) * 4;
      // The picture may have moved since this strip was asked for, so cut it to the picture again.
      const x = Math.max(rects[i], originX), z = Math.max(rects[i + 1], originZ);
      const width = Math.min(rects[i] + rects[i + 2], originX + CACHE) - x, depth = Math.min(rects[i + 1] + rects[i + 3], originZ + CACHE) - z;
      if (width <= 0 || depth <= 0) { rectCount--; continue; }
      const rows = Math.min(BAND, depth, Math.max(1, Math.floor(budget / width)));
      paint(x, z, width, rows);
      painted = true;
      budget -= width * rows;
      if (rows === depth) rectCount--;
      else { rects[i] = x; rects[i + 1] = z + rows; rects[i + 2] = width; rects[i + 3] = depth - rows; }
    }
    return painted;
  };

  /** Keeps the player near the middle of the land picture. */
  const follow = (playerX: number, playerZ: number): void => {
    const wantX = Math.floor(playerX) - CACHE / 2, wantZ = Math.floor(playerZ) - CACHE / 2;
    const dx = wantX - originX, dz = wantZ - originZ;
    if (!valid || Math.abs(dx) >= CACHE || Math.abs(dz) >= CACHE) {
      // The first frame, or a jump across the world: paint all of it now. About 37,000 colors, once.
      originX = wantX; originZ = wantZ; valid = true; rectCount = 0;
      for (let z = 0; z < CACHE; z += BAND) paint(originX, originZ + z, CACHE, BAND);
      return;
    }
    if (Math.abs(dx) <= SHIFT && Math.abs(dz) <= SHIFT) return;
    // Slide what is painted and queue the strips that came into the picture.
    cg.globalCompositeOperation = 'copy';
    cg.drawImage(cache, -dx, -dz);
    cg.globalCompositeOperation = 'source-over';
    originX = wantX; originZ = wantZ;
    if (dx > 0) enqueue(originX + CACHE - dx, originZ, dx, CACHE);
    else if (dx < 0) enqueue(originX, originZ, -dx, CACHE);
    if (dz > 0) enqueue(originX, originZ + CACHE - dz, CACHE, dz);
    else if (dz < 0) enqueue(originX, originZ, CACHE, -dz);
  };

  // What the last drawn frame showed, to skip a frame where nothing changed.
  let lastX = NaN, lastZ = NaN, lastFacing = NaN, lastYaw = NaN, lastVersion = -1, lastSum = NaN;
  let lastMarkers: readonly MapMarker[] = [];
  let drawnOnce = false;

  // The sheet of marks, and the canvas's size. Both follow the element's size on the page.
  const sheet = document.createElement('canvas');
  let dpr = 0, size = 0, cellPx = 0;
  const resize = (): void => {
    const nextDpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const nextSize = element.clientWidth || 168;
    if (nextDpr === dpr && nextSize === size) return;
    if (nextDpr !== dpr) drawSheet(sheet, nextDpr);
    dpr = nextDpr; size = nextSize; cellPx = Math.round(CELL * dpr);
    canvas.width = canvas.height = Math.round(size * dpr);
    lastVersion = -1;
    // A canvas is wiped when its size changes. Draw the last frame again now, so it never shows empty.
    if (drawnOnce) api.draw(lastX, lastZ, lastFacing, lastYaw, lastMarkers);
  };
  const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  watcher?.observe(element);

  const sprite = (index: number, x: number, y: number, box: number): void => {
    g.drawImage(sheet, (index % COLS) * cellPx, Math.floor(index / COLS) * cellPx, cellPx, cellPx, x - box / 2, y - box / 2, box, box);
  };
  const turned = (index: number, x: number, y: number, angle: number, box: number): void => {
    const c = Math.cos(angle) * dpr, s = Math.sin(angle) * dpr;
    g.setTransform(c, s, -s, c, x * dpr, y * dpr);
    g.drawImage(sheet, (index % COLS) * cellPx, Math.floor(index / COLS) * cellPx, cellPx, cellPx, -box / 2, -box / 2, box, box);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const spot = { x: 0, y: 0 };
  const mark = emptyEdgeMark();
  // This frame's numbers, kept out here so drawing a waypoint makes no new function each frame.
  let fromX = 0, fromZ = 0, camYaw = 0, radius = 0, perBlock = 0, rim = 0;
  // A waypoint: on the minimap as its icon, off it as an arrow at the rim. The active one is larger.
  const waypoint = (w: Waypoint, isActive: boolean): void => {
    toMinimap(w.x - fromX, w.z - fromZ, camYaw, spot);
    clampToDisc(spot.x * perBlock, spot.y * perBlock, rim, mark);
    if (!mark.off) sprite(iconIndex(w), radius + mark.x, radius + mark.y, isActive ? CELL + 4 : CELL);
    else if (isActive || allArrows) turned(arrowIndex(w), radius + mark.x, radius + mark.y, mark.angle, isActive ? CELL + 4 : CELL - 6);
  };

  const stats: MinimapStats = {
    frames: 0, drawn: 0, totalMs: 0, maxMs: 0, lastMs: 0,
    reset() { this.frames = this.drawn = 0; this.totalMs = this.maxMs = this.lastMs = 0; },
  };

  const api: Minimap = {
    element,
    stats,
    invalidate(x, z, width, depth) {
      if (valid) enqueue(x, z, width, depth);
    },

    draw(playerX, playerZ, facing, yaw, markers) {
      const started = performance.now();
      if (dpr === 0) resize();
      follow(playerX, playerZ);
      if (unknown.size > 0 && ++retryClock >= RETRY_FRAMES) {
        // Ask again for a few squares that had no color. One that is still blank puts itself back on the list.
        retryClock = 0;
        lastUnknown = -1;
        let asked = 0;
        for (const square of unknown) {
          unknown.delete(square);
          enqueue((Math.floor(square / 65536) - 32768) * 16, ((square % 65536) - 32768) * 16, 16, 16);
          if (++asked >= RETRY_SQUARES) break;
        }
      }
      const painted = work(fillBudget);

      // Nothing moved and nothing changed: the last frame's picture is still right.
      let sum = markers.length;
      for (let i = 0; i < markers.length; i++) sum += markers[i].x * 31 + markers[i].z * 17;
      const still = !painted && playerX === lastX && playerZ === lastZ && facing === lastFacing && yaw === lastYaw
        && marks.version === lastVersion && sum === lastSum && marks.pings.length === 0;
      if (!still) {
        lastX = playerX; lastZ = playerZ; lastFacing = facing; lastYaw = yaw; lastVersion = marks.version; lastSum = sum;
        lastMarkers = markers;
        drawnOnce = true;

        // The land, turned so that what is ahead of the camera is up.
        const half = canvas.width / 2, k = canvas.width / blocks;
        const cos = Math.cos(yaw) * k, sin = Math.sin(yaw) * k;
        g.imageSmoothingEnabled = false;
        g.setTransform(cos, sin, -sin, cos, half, half);
        g.drawImage(cache, originX - playerX, originZ - playerZ);
        g.imageSmoothingEnabled = true;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);

        fromX = playerX; fromZ = playerZ; camYaw = yaw;
        radius = size / 2; perBlock = size / blocks; rim = radius - 10;

        const rumors = marks.rumors;
        if (rumors.length > 0) {
          g.strokeStyle = INK;
          g.lineWidth = 1.5;
          g.setLineDash(DASH);
          for (let i = 0; i < rumors.length; i++) {
            const r = rumors[i];
            toMinimap(r.x - playerX, r.z - playerZ, yaw, spot);
            const reach = r.radius * perBlock;
            if (Math.hypot(spot.x, spot.y) * perBlock - reach > radius) continue;
            g.beginPath();
            g.arc(radius + spot.x * perBlock, radius + spot.y * perBlock, reach, 0, Math.PI * 2);
            g.stroke();
          }
          g.setLineDash(NO_DASH);
        }

        const pins = marks.pins;
        for (let i = 0; i < pins.length; i++) {
          const p = pins[i];
          toMinimap(p.x - playerX, p.z - playerZ, yaw, spot);
          if (Math.hypot(spot.x, spot.y) * perBlock > rim) continue;
          sprite(SPRITE_PIN + PIN_KINDS.indexOf(p.kind), radius + spot.x * perBlock, radius + spot.y * perBlock, CELL);
        }

        // The active waypoint is drawn last, over the others.
        const active = marks.active;
        const crew = marks.crew;
        for (let i = 0; i < crew.length; i++) waypoint(crew[i], false);
        const own = marks.waypoints;
        for (let i = 0; i < own.length; i++) if (own[i] !== active) waypoint(own[i], false);

        for (let i = 0; i < markers.length; i++) {
          const m = markers[i];
          toMinimap(m.x - playerX, m.z - playerZ, yaw, spot);
          if (Math.hypot(spot.x, spot.y) * perBlock > rim) continue;
          const x = radius + spot.x * perBlock, y = radius + spot.y * perBlock;
          if (m.kind === 'friend') {
            g.beginPath();
            g.arc(x, y, 4, 0, Math.PI * 2);
            g.fillStyle = m.color ?? '#fffdf4';
            g.fill();
            g.strokeStyle = INK;
            g.lineWidth = 1.25;
            g.stroke();
          } else {
            sprite(m.kind === 'pet' ? SPRITE_PET : m.kind === 'quest' ? SPRITE_QUEST : SPRITE_ENEMY, x, y, CELL);
          }
        }

        const pings = marks.pings;
        for (let i = 0; i < pings.length; i++) {
          const p = pings[i];
          toMinimap(p.x - playerX, p.z - playerZ, yaw, spot);
          clampToDisc(spot.x * perBlock, spot.y * perBlock, rim, mark);
          g.beginPath();
          g.arc(radius + mark.x, radius + mark.y, 4 + ((p.left * 2) % 1) * 5, 0, Math.PI * 2);
          g.strokeStyle = COLOR_CSS[p.color];
          g.lineWidth = 2;
          g.stroke();
        }

        if (active) waypoint(active, true);
        turned(SPRITE_PLAYER, radius, radius, wrapAngle(facing + yaw), CELL);
        // North, on the rim. Bearing 0 shows at the camera's yaw, clockwise from the top.
        sprite(SPRITE_NORTH, radius + Math.sin(yaw) * (radius - 9), radius - Math.cos(yaw) * (radius - 9), CELL);
        stats.drawn++;
      }

      const ms = performance.now() - started;
      stats.frames++;
      stats.totalMs += ms;
      stats.lastMs = ms;
      if (ms > stats.maxMs) stats.maxMs = ms;
    },

    dispose() {
      stop.abort();
      watcher?.disconnect();
      element.remove();
    },
  };
  return api;
}
