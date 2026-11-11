// The full map: a page of parchment that fills the screen. Land the player has seen is drawn on it
// and the rest stays blank. It pans and zooms, and a click drops a waypoint with a small picker for
// its icon and color.
//
// The land is kept as tiles, one per chunk of seen cells, 128 by 128 pixels at one pixel a block. A
// cell is painted soon after the player first sees it, a few cells a frame, whether the map is
// open or not. So the map still shows land the player walked through an hour ago, after the world
// has let go of it, and opening the map never stalls.
import './map.css';
import { ARROW_PATH, PIN_NAMES, PIN_PATHS, WAYPOINT_NAMES, WAYPOINT_PATHS, hex, svgIcon } from './icons.ts';
import type { MapRules } from './map.sim.ts';
import {
  WAYPOINT_COLORS, WAYPOINT_COLOR_NAMES, WAYPOINT_ICONS, WAYPOINT_LIMIT,
  type Waypoint, type WaypointColor, type WaypointIcon,
} from './marks.sim.ts';
import { SEEN_CELL, SEEN_CHUNK, SEEN_CHUNK_BLOCKS, chunkKey, chunkXOf, chunkZOf } from './seen.sim.ts';
import type { ColorAt, MapMarker } from './minimap.view.ts';

export interface FullMapOptions {
  colorAt: ColorAt;
  parent: HTMLElement;
  /** Blocks across the whole world. The farthest zoom shows this much. */
  worldSize: number;
  onToggle?: (open: boolean) => void;
}

export interface FullMap {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  /** Repaints part of the land after the world changes. */
  invalidate(x: number, z: number, width: number, depth: number): void;
  /** Forgets the painted land. Call it after the rules load a save. */
  reset(): void;
  /** Call every frame. It does nothing while the map is closed. */
  update(playerX: number, playerZ: number, facing: number, markers: readonly MapMarker[]): void;
  dispose(): void;
}

interface Tile {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  /** One bit per cell that is painted. */
  painted: Uint8Array;
}

/** Pixels a block takes when the map opens. */
const OPEN_SCALE = 6;
const INK = '#2f2116', PAPER = '#f3e7c9', PAPER_RGB = [0xea, 0xdb, 0xb8];
/** How much of the parchment shows through the land, so the map reads as ink on paper. */
const FADE = 0.2;
/** Cells painted in one frame at most, 64 colors each: a few while the game is played, many while the map is open. */
const CELLS_CLOSED = 12, CELLS_OPEN = 256;
/** Cells whose land had no color yet are tried again this often, in frames. */
const RETRY_FRAMES = 60;
const MAX_SCALE = 12;
const COLOR_CSS = Object.fromEntries(WAYPOINT_COLOR_NAMES.map((name) => [name, hex(WAYPOINT_COLORS[name])])) as Record<WaypointColor, string>;

const paths = new Map<string, Path2D>();
const pathOf = (d: string): Path2D => {
  let path = paths.get(d);
  if (!path) paths.set(d, (path = new Path2D(d)));
  return path;
};

export function createFullMap(rules: MapRules, options: FullMapOptions): FullMap {
  const { colorAt } = options;
  const { seen, marks } = rules;
  const stop = new AbortController();
  const signal = stop.signal;

  const root = document.createElement('div');
  root.className = 'gb-map';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Map');
  root.innerHTML = `
    <div class="gb-map-page">
      <header class="gb-map-head">
        <h2>Map</h2>
        <span class="gb-map-count"></span>
        <div class="gb-map-tools">
          <button type="button" data-do="here">Pin where I stand</button>
          <button type="button" data-do="center">Find me</button>
          <button type="button" data-do="out" class="gb-map-square" aria-label="Zoom out">&minus;</button>
          <button type="button" data-do="in" class="gb-map-square" aria-label="Zoom in">+</button>
          <button type="button" data-do="close">Close</button>
        </div>
      </header>
      <div class="gb-map-view">
        <canvas tabindex="0" aria-label="The map. Arrow keys move it, plus and minus zoom, a click drops a waypoint."></canvas>
        <div class="gb-map-north" aria-hidden="true">${svgIcon(ARROW_PATH)}<span>N</span></div>
        <div class="gb-map-note" role="status"></div>
        <div class="gb-map-picker" role="group" aria-label="Waypoint" hidden>
          <div class="gb-pick-grid" role="radiogroup" aria-label="Icon">
            ${WAYPOINT_ICONS.map((icon) => `<button type="button" role="radio" data-icon="${icon}" aria-label="${WAYPOINT_NAMES[icon]}" title="${WAYPOINT_NAMES[icon]}">${svgIcon(WAYPOINT_PATHS[icon])}</button>`).join('')}
          </div>
          <div class="gb-pick-grid" role="radiogroup" aria-label="Color">
            ${WAYPOINT_COLOR_NAMES.map((color) => `<button type="button" role="radio" data-color="${color}" aria-label="${color}" title="${color}"><i style="background:${COLOR_CSS[color]}"></i></button>`).join('')}
          </div>
          <label class="gb-pick-share"><input type="checkbox" /> Share with the crew</label>
          <div class="gb-pick-actions">
            <button type="button" data-do="follow"></button>
            <button type="button" data-do="remove">Remove</button>
            <button type="button" data-do="done">Done</button>
          </div>
        </div>
      </div>
      <footer class="gb-map-foot">Click to drop a waypoint. Drag to move, scroll or pinch to zoom. Esc closes.</footer>
    </div>`;
  options.parent.append(root);

  const view = root.querySelector<HTMLElement>('.gb-map-view')!;
  const canvas = root.querySelector('canvas')!;
  const g = canvas.getContext('2d')!;
  const count = root.querySelector<HTMLElement>('.gb-map-count')!;
  const note = root.querySelector<HTMLElement>('.gb-map-note')!;
  const picker = root.querySelector<HTMLElement>('.gb-map-picker')!;
  const share = picker.querySelector<HTMLInputElement>('input')!;
  const follow = picker.querySelector<HTMLButtonElement>('[data-do="follow"]')!;

  // The view: the block at the middle of the canvas and how many pixels a block takes.
  let centerX = 0, centerZ = 0, scale = 2.5;
  let width = 1, height = 1, dpr = 1;
  let open = false, dirty = true;
  let playerX = 0, playerZ = 0, playerFacing = 0;
  let markers: readonly MapMarker[] = [];
  let lastMarks = -1, lastSeen = -1, lastPlayerX = NaN, lastPlayerZ = NaN, lastFacing = NaN, lastSum = NaN;
  let returnFocus: HTMLElement | null = null;
  // What a new waypoint looks like: the last icon and color picked.
  let nextIcon: WaypointIcon = 'flag', nextColor: WaypointColor = 'flame';
  let picked: Waypoint | null = null;
  let noteTimer = 0;

  const minScale = (): number => Math.max(0.03, Math.min(width, height) / options.worldSize);
  const toScreenX = (x: number): number => (x - centerX) * scale + width / 2;
  const toScreenY = (z: number): number => (z - centerZ) * scale + height / 2;
  const toWorldX = (sx: number): number => (sx - width / 2) / scale + centerX;
  const toWorldZ = (sy: number): number => (sy - height / 2) / scale + centerZ;

  const zoomAt = (factor: number, sx: number, sy: number): void => {
    const wx = toWorldX(sx), wz = toWorldZ(sy);
    scale = Math.min(MAX_SCALE, Math.max(minScale(), scale * factor));
    centerX = wx - (sx - width / 2) / scale;
    centerZ = wz - (sy - height / 2) / scale;
    dirty = true;
  };

  const say = (text: string): void => {
    note.textContent = text;
    note.classList.add('is-shown');
    clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => note.classList.remove('is-shown'), 3200);
  };

  // Tiles of painted land.
  const tiles = new Map<number, Tile>();
  const cell = g.createImageData(SEEN_CELL, SEEN_CELL);
  const cell32 = new Uint32Array(cell.data.buffer);
  const tileFor = (key: number): Tile => {
    let tile = tiles.get(key);
    if (!tile) {
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = tileCanvas.height = SEEN_CHUNK_BLOCKS;
      tile = { canvas: tileCanvas, g: tileCanvas.getContext('2d')!, painted: new Uint8Array((SEEN_CHUNK * SEEN_CHUNK) / 8) };
      tiles.set(key, tile);
    }
    return tile;
  };
  const fade = (channel: number, paper: number): number => Math.round(channel + (paper - channel) * FADE);
  // Chunks with a seen cell still to paint, and chunks whose land had no color yet and wait for a retry.
  const pending = new Set<number>(seen.chunks.keys());
  const waiting = new Set<number>();
  let frameCount = 0;
  /**
   * Paints up to `budget` cells of one chunk's tile and returns how many it painted. A chunk with
   * nothing left to paint leaves the pending list. One whose land has no color yet waits for a retry.
   */
  const paintTile = (key: number, budget: number): number => {
    const bits = seen.chunks.get(key);
    if (!bits) { pending.delete(key); return 0; }
    const tile = tileFor(key);
    const baseX = chunkXOf(key) * SEEN_CHUNK_BLOCKS, baseZ = chunkZOf(key) * SEEN_CHUNK_BLOCKS;
    let done = 0, blank = false;
    for (let i = 0; i < SEEN_CHUNK * SEEN_CHUNK; i++) {
      const mask = 1 << (i & 7);
      if (!(bits[i >> 3] & mask) || tile.painted[i >> 3] & mask) continue;
      if (done >= budget) return done;
      const cx = (i % SEEN_CHUNK) * SEEN_CELL, cz = Math.floor(i / SEEN_CHUNK) * SEEN_CELL;
      let known = true;
      for (let z = 0, p = 0; z < SEEN_CELL && known; z++) {
        for (let x = 0; x < SEEN_CELL; x++) {
          const color = colorAt(baseX + cx + x, baseZ + cz + z);
          if (color < 0) { known = false; break; }
          cell32[p++] = 0xff000000 | (fade(color & 0xff, PAPER_RGB[2]) << 16) | (fade((color >> 8) & 0xff, PAPER_RGB[1]) << 8) | fade((color >> 16) & 0xff, PAPER_RGB[0]);
        }
      }
      if (!known) { blank = true; continue; }
      tile.g.putImageData(cell, cx, cz);
      tile.painted[i >> 3] |= mask;
      done++;
    }
    pending.delete(key);
    if (blank) waiting.add(key);
    return done;
  };
  const priorChange = seen.onChange;
  seen.onChange = (chunkX, chunkZ) => {
    priorChange?.(chunkX, chunkZ);
    pending.add(chunkKey(chunkX, chunkZ));
  };

  const resize = (): void => {
    const nextDpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const w = Math.max(1, view.clientWidth), h = Math.max(1, view.clientHeight);
    if (w === width && h === height && nextDpr === dpr) return;
    width = w; height = h; dpr = nextDpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = Math.max(scale, minScale());
    dirty = true;
  };
  const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  watcher?.observe(view);

  // The picker.
  const syncPicker = (): void => {
    if (!picked) return;
    for (const b of picker.querySelectorAll<HTMLElement>('[data-icon]')) b.setAttribute('aria-checked', String(b.dataset.icon === picked.icon));
    for (const b of picker.querySelectorAll<HTMLElement>('[data-color]')) b.setAttribute('aria-checked', String(b.dataset.color === picked.color));
    picker.style.setProperty('--pick', COLOR_CSS[picked.color]);
    share.checked = picked.shared;
    const following = marks.active === picked;
    follow.textContent = following ? 'Stop following' : 'Follow';
    follow.setAttribute('aria-pressed', String(following));
  };
  const placePicker = (): void => {
    if (!picked) return;
    // Beside the waypoint, and always whole inside the view.
    const w = picker.offsetWidth, h = picker.offsetHeight;
    const sx = toScreenX(picked.x), sy = toScreenY(picked.z);
    let left = sx + 18, top = sy - h / 2;
    if (left + w > width - 8) left = sx - 18 - w;
    if (left < 8) { left = Math.min(Math.max(8, sx - w / 2), width - 8 - w); top = sy + 20; }
    if (top + h > height - 8) top = sy - 20 - h < 8 ? height - 8 - h : Math.min(top, height - 8 - h);
    picker.style.left = `${Math.round(Math.max(8, left))}px`;
    picker.style.top = `${Math.round(Math.max(8, top))}px`;
  };
  const openPicker = (waypoint: Waypoint): void => {
    picked = waypoint;
    picker.hidden = false;
    syncPicker();
    placePicker();
    dirty = true;
  };
  const closePicker = (): void => {
    if (!picked) return;
    picked = null;
    picker.hidden = true;
    dirty = true;
  };
  picker.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!button || !picked) return;
    if (button.dataset.icon) {
      nextIcon = button.dataset.icon as WaypointIcon;
      marks.updateWaypoint(picked.id, { icon: nextIcon });
    } else if (button.dataset.color) {
      nextColor = button.dataset.color as WaypointColor;
      marks.updateWaypoint(picked.id, { color: nextColor });
    } else if (button.dataset.do === 'follow') {
      marks.setActive(marks.active === picked ? null : picked.id);
    } else if (button.dataset.do === 'remove') {
      marks.removeWaypoint(picked.id);
      closePicker();
      canvas.focus();
      return;
    } else if (button.dataset.do === 'done') {
      closePicker();
      canvas.focus();
      return;
    }
    syncPicker();
  }, { signal });
  share.addEventListener('change', () => { if (picked) marks.updateWaypoint(picked.id, { shared: share.checked }); }, { signal });

  /** Drops a waypoint, makes it the one to follow when nothing is followed, and opens its picker. */
  const drop = (x: number, z: number): void => {
    const waypoint = marks.addWaypoint(x, z, { icon: nextIcon, color: nextColor });
    if (!waypoint) {
      say(`You have ${WAYPOINT_LIMIT} waypoints. Remove one to drop another.`);
      return;
    }
    if (!marks.active) marks.setActive(waypoint.id);
    openPicker(waypoint);
  };
  const waypointAt = (sx: number, sy: number): Waypoint | null => {
    let best: Waypoint | null = null, bestDistance = 16;
    for (const w of marks.waypoints) {
      const d = Math.hypot(toScreenX(w.x) - sx, toScreenY(w.z) - sy);
      if (d < bestDistance) { best = w; bestDistance = d; }
    }
    return best;
  };

  // Dragging, pinching and clicking.
  const fingers = new Map<number, { x: number; y: number }>();
  let downX = 0, downY = 0, moved = false, pinchFrom = 0;
  const local = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
    const box = canvas.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* The pointer is already gone. */ }
    const p = local(e);
    fingers.set(e.pointerId, p);
    if (fingers.size === 1) { downX = p.x; downY = p.y; moved = false; }
    else { moved = true; const [a, b] = [...fingers.values()]; pinchFrom = Math.hypot(a.x - b.x, a.y - b.y); }
  }, { signal });
  canvas.addEventListener('pointermove', (e) => {
    const from = fingers.get(e.pointerId);
    if (!from) return;
    const p = local(e);
    if (fingers.size === 1) {
      if (!moved && Math.hypot(p.x - downX, p.y - downY) < 5) return;
      moved = true;
      centerX -= (p.x - from.x) / scale;
      centerZ -= (p.y - from.y) / scale;
      dirty = true;
    }
    fingers.set(e.pointerId, p);
    if (fingers.size === 2) {
      const [a, b] = [...fingers.values()];
      const apart = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchFrom > 0 && apart > 0) zoomAt(apart / pinchFrom, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchFrom = apart;
    }
  }, { signal });
  const lift = (e: PointerEvent): void => {
    if (!fingers.delete(e.pointerId)) return;
    if (e.type !== 'pointerup' || moved || fingers.size > 0) return;
    const p = local(e);
    const hit = waypointAt(p.x, p.y);
    if (hit) openPicker(hit);
    else if (picked) closePicker();
    else drop(Math.floor(toWorldX(p.x)) + 0.5, Math.floor(toWorldZ(p.y)) + 0.5);
  };
  canvas.addEventListener('pointerup', lift, { signal });
  canvas.addEventListener('pointercancel', lift, { signal });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = local(e);
    zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false, signal });

  const api: FullMap = {
    element: root,
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true;
      root.hidden = false;
      returnFocus = document.activeElement as HTMLElement | null;
      resize();
      // It opens on the hero's surroundings, close enough to read; the farthest zoom is a scroll away.
      centerX = playerX; centerZ = playerZ;
      scale = Math.min(MAX_SCALE, Math.max(minScale(), OPEN_SCALE));
      dirty = true;
      canvas.focus({ preventScroll: true });
      options.onToggle?.(true);
    },
    close() {
      if (!open) return;
      open = false;
      closePicker();
      fingers.clear();
      root.hidden = true;
      returnFocus?.focus?.({ preventScroll: true });
      options.onToggle?.(false);
    },
    invalidate(x, z, w, d) {
      const c0x = Math.floor(x / SEEN_CELL), c1x = Math.floor((x + w - 1) / SEEN_CELL), c0z = Math.floor(z / SEEN_CELL), c1z = Math.floor((z + d - 1) / SEEN_CELL);
      for (let cz = c0z; cz <= c1z; cz++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          const key = chunkKey(cx >> 4, cz >> 4);
          const tile = tiles.get(key);
          if (!tile) continue;
          const i = (cz & 15) * SEEN_CHUNK + (cx & 15);
          tile.painted[i >> 3] &= ~(1 << (i & 7));
          pending.add(key);
        }
      }
    },

    reset() {
      tiles.clear();
      pending.clear();
      waiting.clear();
      for (const key of seen.chunks.keys()) pending.add(key);
      closePicker();
      dirty = true;
    },

    update(x, z, facing, list) {
      playerX = x; playerZ = z; playerFacing = facing; markers = list;

      // Paint a little more of the seen land: the chunks in view first while the map is open.
      if (waiting.size > 0 && ++frameCount % RETRY_FRAMES === 0) {
        for (const key of waiting) pending.add(key);
        waiting.clear();
      }
      const x0 = Math.floor(toWorldX(0) / SEEN_CHUNK_BLOCKS), x1 = Math.floor(toWorldX(width) / SEEN_CHUNK_BLOCKS);
      const z0 = Math.floor(toWorldZ(0) / SEEN_CHUNK_BLOCKS), z1 = Math.floor(toWorldZ(height) / SEEN_CHUNK_BLOCKS);
      if (pending.size > 0) {
        let budget = open ? CELLS_OPEN : CELLS_CLOSED;
        for (let pass = open ? 0 : 1; pass < 2 && budget > 0; pass++) {
          for (const key of pending) {
            if (budget <= 0) break;
            if (pass === 0) {
              const tx = chunkXOf(key), tz = chunkZOf(key);
              if (tx < x0 || tx > x1 || tz < z0 || tz > z1) continue;
            }
            const done = paintTile(key, budget);
            budget -= done;
            if (done > 0) dirty = true;
          }
        }
      }
      if (!open) return;

      let sum = list.length;
      for (let i = 0; i < list.length; i++) sum += list[i].x * 31 + list[i].z * 17;
      if (marks.version !== lastMarks || seen.version !== lastSeen || x !== lastPlayerX || z !== lastPlayerZ || facing !== lastFacing || sum !== lastSum) dirty = true;
      if (!dirty) return;
      dirty = false;
      lastMarks = marks.version; lastSeen = seen.version; lastPlayerX = x; lastPlayerZ = z; lastFacing = facing; lastSum = sum;
      draw(x0, x1, z0, z1);
    },

    dispose() {
      stop.abort();
      watcher?.disconnect();
      clearTimeout(noteTimer);
      seen.onChange = priorChange;
      root.remove();
    },
  };

  // Buttons and keys.
  root.querySelector('.gb-map-tools')!.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('button')?.dataset.do;
    if (action === 'close') api.close();
    else if (action === 'in') zoomAt(1.5, width / 2, height / 2);
    else if (action === 'out') zoomAt(1 / 1.5, width / 2, height / 2);
    else if (action === 'center') { centerX = playerX; centerZ = playerZ; dirty = true; }
    else if (action === 'here') { centerX = playerX; centerZ = playerZ; drop(playerX, playerZ); }
  }, { signal });
  window.addEventListener('keydown', (e) => {
    if (!open || e.ctrlKey || e.metaKey || e.altKey) return;
    const step = 80 / scale;
    if (e.code === 'Escape') {
      if (picked) { closePicker(); canvas.focus(); } else api.close();
    } else if ((e.target as HTMLElement | null)?.closest?.('.gb-map-picker, .gb-map-tools') && e.code !== 'Equal' && e.code !== 'Minus') {
      // Arrow keys and Enter belong to the buttons while one has the focus.
      return;
    } else if (e.code === 'ArrowLeft') { centerX -= step; dirty = true; }
    else if (e.code === 'ArrowRight') { centerX += step; dirty = true; }
    else if (e.code === 'ArrowUp') { centerZ -= step; dirty = true; }
    else if (e.code === 'ArrowDown') { centerZ += step; dirty = true; }
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomAt(1.5, width / 2, height / 2);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomAt(1 / 1.5, width / 2, height / 2);
    else if (e.code === 'Enter' && e.target === canvas) {
      // Enter at the middle of the map does what a click there does.
      const hit = waypointAt(width / 2, height / 2);
      if (hit) openPicker(hit); else drop(Math.floor(centerX) + 0.5, Math.floor(centerZ) + 0.5);
    } else return;
    e.preventDefault();
  }, { signal });

  const icon = (d: string, x: number, y: number, size: number, fill: string): void => {
    g.save();
    g.translate(x - size / 2, y - size / 2);
    g.scale(size / 24, size / 24);
    g.fillStyle = fill;
    g.fill(pathOf(d), 'evenodd');
    g.restore();
  };
  const label = (text: string, x: number, y: number): void => {
    g.font = '600 13px Fraunces, ui-serif, Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineWidth = 3;
    g.strokeStyle = PAPER;
    g.strokeText(text, x, y);
    g.fillStyle = INK;
    g.fillText(text, x, y);
  };
  const badge = (w: Waypoint, isActive: boolean, crewOwner: string | null): void => {
    const isCrew = crewOwner !== null;
    const x = toScreenX(w.x), y = toScreenY(w.z);
    if (x < -20 || y < -20 || x > width + 20 || y > height + 20) return;
    if (isActive) {
      g.beginPath();
      g.arc(x, y, 15, 0, Math.PI * 2);
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.setLineDash([4, 3]);
      g.stroke();
      g.setLineDash([]);
    }
    g.beginPath();
    g.arc(x, y, isCrew ? 8 : 10.5, 0, Math.PI * 2);
    g.fillStyle = COLOR_CSS[w.color];
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    g.stroke();
    icon(WAYPOINT_PATHS[w.icon], x, y, isCrew ? 10 : 13.5, '#fffdf4');
    if (w.shared && !isCrew) {
      // A small second dot: the crew sees this one.
      g.beginPath();
      g.arc(x + 9, y - 9, 4, 0, Math.PI * 2);
      g.fillStyle = PAPER;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.25;
      g.stroke();
    }
  };

  // The edge of what has been seen is a rounded outline that fades into the paper, not a staircase of square cells.
  // The land is shrunk to a quarter and blurred there (cheap at that size); its alpha, pushed through a steep ramp,
  // becomes a soft-edged mask with round corners, and the land is kept only inside it.
  const edge = document.createElement('canvas');
  const eg = edge.getContext('2d', { willReadFrequently: true });
  const feather = (): void => {
    if (!eg) return;
    const w = Math.max(1, Math.ceil(canvas.width / 4)), h = Math.max(1, Math.ceil(canvas.height / 4));
    if (edge.width !== w || edge.height !== h) { edge.width = w; edge.height = h; }
    eg.clearRect(0, 0, w, h);
    // About half a seen cell, in the quarter-size copy's pixels.
    eg.filter = `blur(${Math.max(1.5, (scale * dpr * SEEN_CELL) / 4 * 0.45)}px)`;
    eg.drawImage(canvas, 0, 0, w, h);
    eg.filter = 'none';
    const mask = eg.getImageData(0, 0, w, h), px = mask.data;
    for (let i = 3; i < px.length; i += 4) {
      const a = (px[i] / 255 - 0.42) / 0.22;
      px[i] = a <= 0 ? 0 : a >= 1 ? 255 : Math.round(a * a * (3 - 2 * a) * 255);
    }
    eg.putImageData(mask, 0, 0);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(edge, 0, 0, canvas.width, canvas.height);
    g.restore();
  };

  function draw(x0: number, x1: number, z0: number, z1: number): void {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);

    // Land. Crisp when a block is several pixels, smooth when many blocks share one.
    g.imageSmoothingEnabled = scale < 1;
    const drawTile = (key: number): void => {
      const tile = tiles.get(key);
      if (!tile) return;
      const left = Math.round(toScreenX(chunkXOf(key) * SEEN_CHUNK_BLOCKS)), top = Math.round(toScreenY(chunkZOf(key) * SEEN_CHUNK_BLOCKS));
      const right = Math.round(toScreenX((chunkXOf(key) + 1) * SEEN_CHUNK_BLOCKS)), bottom = Math.round(toScreenY((chunkZOf(key) + 1) * SEEN_CHUNK_BLOCKS));
      if (right < 0 || bottom < 0 || left > width || top > height) return;
      g.drawImage(tile.canvas, left, top, right - left, bottom - top);
    };
    if (tiles.size <= (x1 - x0 + 1) * (z1 - z0 + 1)) for (const key of tiles.keys()) drawTile(key);
    else for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) drawTile(chunkKey(tx, tz));
    g.imageSmoothingEnabled = true;
    feather();

    // Rumors: a dotted circle, never a point.
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.setLineDash([2, 6]);
    g.lineCap = 'round';
    for (const r of marks.rumors) {
      const x = toScreenX(r.x), y = toScreenY(r.z), radius = r.radius * scale;
      if (x + radius < 0 || y + radius < 0 || x - radius > width || y - radius > height) continue;
      g.beginPath();
      g.arc(x, y, Math.max(6, radius), 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([]);
    g.lineCap = 'butt';
    for (const r of marks.rumors) if (r.label) label(r.label, toScreenX(r.x), toScreenY(r.z) - 7);

    for (const p of marks.pins) {
      const x = toScreenX(p.x), y = toScreenY(p.z);
      if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
      g.beginPath();
      g.arc(x, y, 10, 0, Math.PI * 2);
      g.fillStyle = PAPER;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.5;
      g.stroke();
      icon(PIN_PATHS[p.kind], x, y, 13, INK);
    }

    for (const w of marks.crew) badge(w, false, w.owner);
    const active = marks.active;
    for (const w of marks.waypoints) if (w !== active) badge(w, false, null);
    if (active) badge(active, true, null);

    for (const m of markers) {
      const x = toScreenX(m.x), y = toScreenY(m.z);
      if (m.kind === 'friend') {
        g.beginPath();
        g.arc(x, y, 5, 0, Math.PI * 2);
        g.fillStyle = m.color ?? '#fffdf4';
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 1.5;
        g.stroke();
      } else if (m.kind === 'quest') {
        g.beginPath();
        g.arc(x, y, 7.5, 0, Math.PI * 2);
        g.fillStyle = '#f4c542';
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 1.5;
        g.stroke();
        icon(PIN_PATHS.quest, x, y, 11, INK);
      } else {
        icon(m.kind === 'pet' ? WAYPOINT_PATHS.heart : WAYPOINT_PATHS.danger, x, y, 13, m.kind === 'pet' ? '#f2a23c' : '#c8362c');
      }
    }

    for (const p of marks.pings) {
      g.beginPath();
      g.arc(toScreenX(p.x), toScreenY(p.z), 6 + ((p.left * 2) % 1) * 8, 0, Math.PI * 2);
      g.strokeStyle = COLOR_CSS[p.color];
      g.lineWidth = 2.5;
      g.stroke();
    }

    // The player, as an arrow that points the way they face. The full map is always north up.
    g.save();
    g.translate(toScreenX(playerX), toScreenY(playerZ));
    g.rotate(playerFacing);
    g.translate(-11, -11);
    g.scale(22 / 24, 22 / 24);
    g.lineJoin = 'round';
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke(pathOf(ARROW_PATH));
    g.fillStyle = '#fffdf4';
    g.fill(pathOf(ARROW_PATH));
    g.restore();

    // Names last, so no mark covers one.
    if (scale >= 1.2) for (const p of marks.pins) label(p.label || PIN_NAMES[p.kind], toScreenX(p.x), toScreenY(p.z) + 12);
    for (const w of marks.crew) label(w.owner, toScreenX(w.x), toScreenY(w.z) + 11);
    for (const w of marks.waypoints) {
      if (w === active) label(`${Math.round(Math.hypot(w.x - playerX, w.z - playerZ))} blocks`, toScreenX(w.x), toScreenY(w.z) + 17);
      else if (w.label) label(w.label, toScreenX(w.x), toScreenY(w.z) + 13);
    }

    count.textContent = `Waypoints ${marks.waypoints.length} of ${WAYPOINT_LIMIT}`;
    if (picked) {
      if (!marks.waypoints.includes(picked)) closePicker();
      else { syncPicker(); placePicker(); }
    }
  }

  return api;
}
