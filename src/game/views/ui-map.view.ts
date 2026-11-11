// The map in the running game: the round minimap in the HUD's corner, the full map on M, the tracked
// quest step as the waypoint with its beam, pins for the named places the player has come near, and
// marks for Tamsin, the pet and anyone carrying a quest mark. This is the one file that touches
// src/features/map.
//
// The map asks for a color at each column of blocks. The world keeps only the land around the player in
// memory, so each color is kept the first time its column is read, and the full map can still draw land
// the player has walked away from.
import { BLOCKS } from '../../content/blocks.ts';
import { createMap, type MapMarker, type PinKind } from '../../features/map/index.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { clearOfPanels, type MarkBox } from '../uiview/clear.ts';
import { addStyle } from '../uiview/theme.ts';

/** Within this many blocks of a named place, it gets its pin. */
const PIN_RANGE = 30;
/** Seconds between two looks at the waypoint, the pins and the land that has loaded. */
const LOOK_EVERY = 0.5;
/** Chunks each way around the player that are checked for land that has loaded since the last look. */
const CHUNK_REACH = 7;
/** A waypoint that follows someone is moved when they are this far from where it stands. */
const WAYPOINT_SLACK = 1.5;
/** Closer than this to the quest's waypoint, its beam is switched off. It comes back beyond the second number. */
const BEAM_NEAR = 7, BEAM_FAR = 10;
/** The label of the waypoint this view keeps, so it is found again after the map loads its save. */
const QUEST_TAG = 'Quest: ';
/** Paper, for land that is not in memory and was never read. */
const BLANK = 0xd8bf8e;
/** How much one block of height difference lightens or darkens a column, for relief. */
const RELIEF = 0.07;
/** The region's name, at the top of the full map. */
const REGION_NAME = 'Greenhollow';
/** Within this many blocks of a named place, the full map names it under the region. */
const NEAR_PLACE = 40;

const PIN_OF: Readonly<Record<string, PinKind>> = {
  'grant.stone': 'waystone',
  'grant.center': 'farm',
  'dead.garden': 'farm',
  'gus.field': 'farm',
  'town.gate': 'gate',
  lodge: 'shop',
  granary: 'shop',
  bakery: 'shop',
  carpenter: 'shop',
  kennel: 'shop',
};

const STYLE = /* css */ `
/* ---- the minimap: a round window in a gold compass ring ---- */
.ui-book .gb-minimap { border: 0; background: var(--ui-paper-3); box-shadow: 0 0 0 3px var(--ui-gold), 0 0 0 5px rgb(22 26 38 / 0.55), 0 0 0 6px rgb(211 188 142 / 0.6), 0 6px 16px rgb(10 12 20 / 0.4); }
.ui-book .gb-minimap:focus-visible { outline: 2px solid var(--ui-gold-bright); outline-offset: 6px; }
.ui-book .gb-hud-minimap { padding: 8px; }

/* ---- the active waypoint on the screen. It is drawn over the HUD, so its arrow is never lost behind the quick slots. ---- */
.ui-book .gb-beacon { z-index: 12; }
/* A panel and the full map have the screen to themselves. */
.ui-book.ui-covered .gb-beacon { visibility: hidden; }
.ui-book .gb-beacon-chip { padding: 2px 10px 3px; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums lining-nums; color: var(--ui-glass-ink); background: var(--ui-glass); border: 0; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--ui-glass-line), var(--ui-glass-shadow); }
.ui-book .gb-beacon-arrow path { stroke: var(--ui-night); }

/* ---- the full map: the parchment chart is the whole screen. The menus' rails cross it: the region's name at the top,
   key prompts at the bottom. Round night tools down the right edge, the compass below them. ---- */
.ui-book .gb-map { padding: 0; font-size: 16px; line-height: 1.45; pointer-events: auto; }
.ui-book .gb-map-page { animation: ui-map-in 200ms var(--ui-ease); }
@keyframes ui-map-in { from { transform: translateY(12px); } }
.ui-book .gb-map-head { left: 0; right: 0; top: 0; transform: none; isolation: isolate; display: grid; justify-items: center; padding: 14px 80px 0; }
.ui-book .gb-map-head::before { content: ''; position: absolute; z-index: -1; left: 0; right: 0; top: 0; height: 76px; background: linear-gradient(180deg, rgb(10 12 20 / 0.78), rgb(20 24 38 / 0.62)); box-shadow: 0 1px 0 rgb(211 188 142 / 0.55); }
.ui-book .gb-map-head h2 { font-family: var(--ui-display); font-size: 30px; font-weight: 650; line-height: 1.2; letter-spacing: 0.02em; color: var(--ui-paper-light); text-shadow: 0 2px 8px rgb(0 0 0 / 0.5); }
.ui-book .gb-map-place { margin-top: 18px; padding: 3px 16px; font-family: var(--ui-display); font-size: 16px; font-weight: 600; color: var(--ui-ink); background: rgb(246 241 231 / 0.78); border-radius: 999px; box-shadow: inset 0 0 0 1px rgb(166 137 90 / 0.6); }
/* Round night buttons with gold line icons, like the menus' tabs. */
.ui-book .gb-map-tools { gap: 12px; }
.ui-book .gb-map-tools button, .ui-book .gb-map .gb-map-close {
  width: 52px; height: 52px; color: var(--ui-gold-bright); border: 0;
  background: radial-gradient(circle at 50% 30%, #3a4460, var(--ui-night) 75%);
  box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.6), 0 4px 10px rgb(10 12 20 / 0.4); transition: transform 140ms var(--ui-ease), box-shadow 140ms var(--ui-ease);
}
.ui-book .gb-map .gb-map-close { top: 10px; right: 20px; width: 52px; height: 52px; }
.ui-book .gb-map-tools button:hover, .ui-book .gb-map .gb-map-close:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 1.5px var(--ui-gold-bright), 0 0 16px rgb(240 212 138 / 0.45), 0 6px 12px rgb(10 12 20 / 0.4); }
.ui-book .gb-map-tools button:active, .ui-book .gb-map .gb-map-close:active { transform: translateY(0) scale(0.96); }
.ui-book .gb-map-tools button > .ui-cell, .ui-book .gb-map-close > .ui-cell { width: 36px; height: 36px; filter: brightness(1.35) drop-shadow(0 0 4px rgb(240 212 138 / 0.45)); }
.ui-book .gb-map-tools svg, .ui-book .gb-map-close svg { width: 26px; height: 26px; }
.ui-book .gb-map-count { margin-top: 2px; padding: 2px 10px; font-size: 13px; font-weight: 800; color: var(--ui-glass-ink); background: var(--ui-glass); border-radius: 999px; box-shadow: inset 0 0 0 1px var(--ui-glass-line); }
.ui-book .gb-map button:focus-visible, .ui-book .gb-map canvas:focus-visible, .ui-book .gb-map input:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
/* The chart: warm parchment, a faint grid of latitude lines, tea-stained edges. */
.ui-book .gb-map-view {
  background:
    radial-gradient(ellipse at 50% 50%, transparent 50%, rgb(120 84 40 / 0.32) 100%),
    linear-gradient(rgb(120 84 40 / 0.08) 1px, transparent 1px) 0 0 / 64px 64px,
    linear-gradient(90deg, rgb(120 84 40 / 0.08) 1px, transparent 1px) 0 0 / 64px 64px,
    radial-gradient(ellipse at 22% 18%, rgb(255 250 235 / 0.5), transparent 50%),
    radial-gradient(ellipse at 80% 85%, rgb(150 100 40 / 0.16), transparent 55%),
    #e6d8b6;
  box-shadow: inset 0 0 80px rgb(120 84 40 / 0.35);
}
/* The land is inked onto the parchment: multiplied, so it takes the paper's warmth and its stains. */
.ui-book .gb-map-view canvas { mix-blend-mode: multiply; filter: saturate(0.8) contrast(1.05); }
.ui-book .gb-map-north { right: 26px; bottom: 84px; width: 40px; height: 40px; place-items: center; align-content: center; gap: 0; color: var(--ui-ink); font-family: var(--ui-display); font-size: 12px; background: rgb(246 241 231 / 0.75); border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--ui-gold), 0 2px 6px rgb(90 60 20 / 0.25); }
.ui-book .gb-map-north svg { width: 18px; height: 18px; }
.ui-book .gb-map-note { bottom: 84px; padding: 8px 16px; border-radius: 999px; background: var(--ui-night); color: var(--ui-paper); box-shadow: inset 0 0 0 1px var(--ui-glass-line); }
/* The bottom rail of key prompts, as in the menus. */
.ui-book .gb-map-foot { min-height: 64px; padding: 10px 36px 16px; gap: 10px 30px; font-size: 15px; color: var(--ui-paper-light); text-shadow: 0 1px 2px rgb(0 0 0 / 0.6); background: linear-gradient(0deg, rgb(10 12 20 / 0.7), rgb(10 12 20 / 0)); }
.ui-book .gb-cue { gap: 10px; }
.ui-book .gb-cue kbd { min-width: 34px; height: 32px; padding: 0 10px; font-size: 13px; font-weight: 800; color: var(--ui-paper-light); text-shadow: none; border: 0; border-radius: 9px; background: linear-gradient(180deg, #3d4660, #232a3c); box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.7), inset 0 -3px 0 rgb(0 0 0 / 0.3), 0 2px 4px rgb(0 0 0 / 0.4); }
.ui-book .gb-map-picker { gap: 8px; padding: 14px; border: 0; border-radius: var(--ui-radius); background: var(--ui-paper); box-shadow: inset 0 0 0 1px var(--ui-gold), var(--ui-lift); }
.ui-book .gb-map-picker button { min-height: 40px; padding: 0 12px; font-weight: 700; color: var(--ui-paper-light); background: linear-gradient(180deg, #56607a, #4a5366 55%, #424a5c); border: 0; border-radius: 999px; box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55); }
.ui-book .gb-map-picker button:hover { filter: brightness(1.12); }
.ui-book .gb-map .gb-pick-grid button { min-height: 0; padding: 0; color: var(--ui-ink); background: var(--ui-paper-2); border: 0; box-shadow: none; border-radius: 8px; }
.ui-book .gb-map .gb-pick-grid button:hover { background: var(--ui-paper-3); }
.ui-book .gb-map .gb-pick-grid [data-icon][aria-checked='true'] { color: #fffdf4; box-shadow: inset 0 0 0 2px var(--ui-gold); }
.ui-book .gb-pick-share { min-height: 40px; font-size: 15px; }
.ui-book .gb-pick-actions { gap: 8px; }
.ui-book .gb-pick-actions button { padding: 0 8px; }

@media (max-width: 640px) {
  .ui-book .gb-map-head { padding: 12px 64px 0; }
  .ui-book .gb-map-head::before { height: 62px; }
  .ui-book .gb-map-head h2 { font-size: 24px; }
  .ui-book .gb-map-place { margin-top: 14px; font-size: 14px; }
  .ui-book .gb-map .gb-map-close { top: 7px; right: 12px; width: 48px; height: 48px; }
  .ui-book .gb-map-tools { right: 12px; gap: 10px; }
  .ui-book .gb-map-tools button { width: 48px; height: 48px; }
  .ui-book .gb-map-north { right: 16px; bottom: 76px; }
  .ui-book .gb-map-foot { justify-content: center; min-height: 0; padding: 8px 12px 12px; gap: 6px 18px; font-size: 13.5px; }
  .ui-book .gb-cue kbd { min-width: 28px; height: 28px; padding: 0 8px; font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-book .gb-map-page { animation: none; }
  .ui-book .gb-map button { transition: none; }
}
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  const { sys } = book;
  const sim = view.world.sim;
  addStyle(root, 'map', STYLE);

  // ---------------------------------------------------------------- the color of a column of blocks
  /** One list of 256 colors for each chunk that was read, each stored as its color plus one so 0 means "not read". */
  const tiles = new Map<number, Uint32Array>();
  const keyOf = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768);

  function shade(color: number, by: number): number {
    const k = 1 + Math.max(-2, Math.min(2, by)) * RELIEF;
    const r = Math.min(255, ((color >> 16) & 0xff) * k), g = Math.min(255, ((color >> 8) & 0xff) * k), b = Math.min(255, (color & 0xff) * k);
    return (r << 16) | (g << 8) | b;
  }

  /** The top block's flat color, lighter where the ground rises toward the south-east and darker where it falls. */
  function readColumn(x: number, z: number): number {
    const height = sim.heightAt(x, z);
    let id = sim.getBlock(x, height, z);
    if (BLOCKS[id]?.liquid) return BLOCKS[id]?.color ?? BLANK;
    id = height > 0 ? sim.getBlock(x, height - 1, z) : 0;
    const color = BLOCKS[id]?.color;
    if (color === undefined || id === 0) return BLANK;
    const behind = sim.chunkAt((x - 1) >> 4, (z - 1) >> 4) ? sim.heightAt(x - 1, z - 1) : height;
    return shade(color, height - behind);
  }

  function colorAt(x: number, z: number): number {
    const bx = Math.floor(x), bz = Math.floor(z);
    const cx = bx >> 4, cz = bz >> 4;
    const key = keyOf(cx, cz), at = ((bx & 15) << 4) | (bz & 15);
    let tile = tiles.get(key);
    const kept = tile ? (tile[at] as number) : 0;
    if (kept !== 0) return kept - 1;
    if (!sim.chunkAt(cx, cz)) return BLANK;
    if (!tile) tiles.set(key, (tile = new Uint32Array(256)));
    const canopy=sim.canopyAt(bx,sim.heightAt(bx,bz)+2,bz);
    const color = canopy ? 0x516b3c : readColumn(bx, bz);
    tile[at] = color + 1;
    return color;
  }

  game.events.on('tree.felled',()=>tiles.clear());

  // ---------------------------------------------------------------- the map
  const map = createMap(view.ctx, {
    colorAt,
    parent: root,
    edgeArrows: 'active',
    // The far zoom of the full map shows the grant, the dead garden and Hollowmere together.
    worldSize: 640,
    storageKey: 'greenhollow.map',
    onToggle(open) {
      book.settle();
      if (open) view.keys.release();
      game.events.emit('ui.sound', { sound: open ? 'open' : 'close' });
    },
  });
  // The map's round tools take the kit's gold line icons when it has them; the feature's own drawn ones stay otherwise.
  for (const button of root.querySelectorAll<HTMLElement>('.gb-map [data-icon]')) {
    const art = book.art.tabElement(button.dataset.icon ?? '');
    if (art) button.replaceChildren(art);
  }

  /** The named place nearest the player, when one is near enough to name. */
  function nearPlace(): string | null {
    const p = view.playerPosition;
    let best: string | null = null, bestDistance = NEAR_PLACE;
    for (const place of sys.region?.places() ?? []) {
      const distance = Math.hypot(place.at.x - p.x, place.at.z - p.z);
      if (place.label && distance < bestDistance) { best = place.label; bestDistance = distance; }
    }
    return best;
  }

  if (book.minimapSlot) {
    book.minimapSlot.append(map.minimap);
  } else {
    // No HUD to sit in: the minimap takes the top right corner by itself.
    const corner = document.createElement('div');
    corner.style.cssText = 'position: absolute; top: 12px; right: 12px; width: 168px; padding: 5px; pointer-events: auto;';
    corner.append(map.minimap);
    root.append(corner);
  }
  book.map = {
    get isOpen() { return map.isOpen; },
    open() {
      if (!view.started || book.menuOpen || (sys.talk?.active ?? false)) return;
      map.setTitle(REGION_NAME, nearPlace());
      map.open();
    },
    close: () => map.close(),
  };

  /** Forgets the colors of a patch of land and has the map draw it again. */
  function redraw(x: number, z: number, width: number, depth: number): void {
    for (let bx = x; bx < x + width; bx++) {
      for (let bz = z; bz < z + depth; bz++) {
        const tile = tiles.get(keyOf(bx >> 4, bz >> 4));
        if (tile) tile[((bx & 15) << 4) | (bz & 15)] = 0;
      }
    }
    map.invalidate(x, z, width, depth);
  }
  // A changed block changes its own column, and the relief of the column to its south-east.
  const changed = (e: { x: number; z: number }): void => redraw(e.x, e.z, 2, 2);
  game.events.on('block.placed', changed);
  game.events.on('block.broken', changed);
  game.events.on('soil.tilled', changed);

  /** Land comes into memory a chunk at a time. Each new chunk is drawn, with the edge of its south-east neighbors. */
  const loaded = new Set<number>();
  let drawnOnce = false;
  function lookForLand(px: number, pz: number): void {
    const cx0 = Math.floor(px) >> 4, cz0 = Math.floor(pz) >> 4;
    for (let cx = cx0 - CHUNK_REACH; cx <= cx0 + CHUNK_REACH; cx++) {
      for (let cz = cz0 - CHUNK_REACH; cz <= cz0 + CHUNK_REACH; cz++) {
        const key = keyOf(cx, cz);
        if (loaded.has(key) || !sim.chunkAt(cx, cz)) continue;
        loaded.add(key);
        // Before the map has drawn anything there is nothing to draw again.
        if (drawnOnce) redraw(cx * 16, cz * 16, 17, 17);
      }
    }
    drawnOnce = true;
  }

  // ---------------------------------------------------------------- the waypoint and the pins
  const marks = map.rules.marks;
  const pinned = new Set<string>();

  /** True while the quest's waypoint is switched off because the player stands at it. */
  let parked = false;

  function syncWaypoint(px: number, pz: number): void {
    const step = sys.quests?.tracked()?.steps.find((each) => !each.done);
    const at = step?.at;
    let mine = marks.waypoints.find((waypoint) => waypoint.label.startsWith(QUEST_TAG)) ?? null;
    if (!step || !at) {
      if (mine) marks.removeWaypoint(mine.id);
      parked = false;
      return;
    }
    const label = QUEST_TAG + step.text;
    const far = Math.hypot(at.x - px, at.z - pz);
    if (!mine) {
      mine = marks.addWaypoint(at.x, at.z, { icon: 'star', color: 'ochre', label });
      if (!mine) return;
      parked = far < BEAM_NEAR;
      if (!parked) marks.setActive(mine.id);
      return;
    }
    if (mine.label !== label) {
      // A new step: point at it, whatever the player was following.
      marks.updateWaypoint(mine.id, { x: at.x, z: at.z, label });
      parked = far < BEAM_NEAR;
      if (!parked) marks.setActive(mine.id);
      else if (marks.active === mine) marks.setActive(null);
      return;
    }
    if (Math.hypot(mine.x - at.x, mine.z - at.z) > WAYPOINT_SLACK) marks.updateWaypoint(mine.id, { x: at.x, z: at.z });
    // The beam stands on the spot it marks. Up close it would stand on the person the player came to see.
    if (marks.active === mine && far < BEAM_NEAR) {
      marks.setActive(null);
      parked = true;
    } else if (parked && marks.active === null && far > BEAM_FAR) {
      marks.setActive(mine.id);
      parked = false;
    }
  }

  function syncPins(px: number, pz: number): void {
    const places = sys.region?.places();
    if (!places) return;
    for (const place of places) {
      if (!place.label || pinned.has(place.name)) continue;
      if (Math.hypot(place.at.x - px, place.at.z - pz) > PIN_RANGE) continue;
      pinned.add(place.name);
      marks.setPin({ id: place.name, kind: PIN_OF[place.name] ?? 'waystone', x: place.at.x, z: place.at.z, label: place.label });
    }
  }

  // ---------------------------------------------------------------- who is marked
  const markers: MapMarker[] = [];
  map.setMarkers(markers);

  function syncMarkers(): void {
    const companion = sys.pets?.companion()?.id ?? '';
    let count = 0;
    for (const actor of game.actors.values()) {
      if (!actor.visible || actor.id === 'player') continue;
      let kind: MapMarker['kind'];
      if (actor.mark === 'quest') kind = 'quest';
      else if (actor.id === 'npc:tamsin') kind = 'friend';
      else if (actor.id === companion) kind = 'pet';
      else continue;
      let marker = markers[count];
      if (!marker) markers[count] = marker = { kind, x: 0, z: 0 };
      marker.kind = kind;
      marker.x = actor.pos.x;
      marker.z = actor.pos.z;
      count++;
    }
    markers.length = count;
  }

  // A new game starts with a blank map. A loaded one keeps what the map saved: the land seen, the pins, the player's waypoints.
  book.onStart((fresh) => {
    if (fresh) map.load(null);
    pinned.clear();
    for (const pin of marks.pins) pinned.add(pin.id);
    // A saved map may hold the quest's waypoint switched off, from a save made beside it.
    parked = marks.active === null && marks.waypoints.some((waypoint) => waypoint.label.startsWith(QUEST_TAG));
  });

  let sinceLook = LOOK_EVERY;
  view.onFrame((dt) => {
    if (!view.started) return;
    const p = view.playerPosition;
    sinceLook += dt;
    if (sinceLook >= LOOK_EVERY) {
      sinceLook = 0;
      lookForLand(p.x, p.z);
      syncWaypoint(p.x, p.z);
      syncPins(p.x, p.z);
    }
    syncMarkers();
    map.setPlayer(p.x, p.z, game.player.facing);
    map.update(dt, view.ctx);
    keepArrowClear(dt);
  });

  // ---------------------------------------------------------------- the edge arrow, clear of the HUD
  // The map feature puts the arrow for a waypoint off screen a margin inside the edge, and knows nothing
  // of the HUD there: off to the right it lay over the quest tracker. After the map has placed it, it is
  // slid along its edge until it touches no panel. The panels are measured four times a second.
  const beacon = root.querySelector<HTMLElement>('.gb-beacon');
  const PANELS = ['.gb-hud-quest', '.gb-hud-minimap', '.gb-hud-sky', '.gb-hud-slots', '.ui-bookbtn'];
  const rects = new Float64Array(PANELS.length * 4);
  let rectCount = 0, sinceMeasure = LOOK_EVERY;
  /** The arrow's reach around its point: the 46-pixel arrow, and the "19 blocks" chip under it or over it. */
  const BELOW: MarkBox = { left: 48, up: 25, right: 48, down: 52 };
  const ABOVE: MarkBox = { left: 48, up: 52, right: 48, down: 25 };
  /** The margin the map feature keeps from the screen's edge, and the room kept around a panel. */
  const EDGE = 72, GAP = 10;
  const moved = { x: 0, y: 0 };
  let written = '';
  /** The point the map gave the arrow, before it was slid. */
  let pointX = 0, pointY = 0;

  function measure(): void {
    rectCount = 0;
    const origin = root.getBoundingClientRect();
    for (const selector of PANELS) {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element || element.closest('[hidden]') || getComputedStyle(element).visibility === 'hidden') continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const i = rectCount++ * 4;
      rects[i] = box.left - origin.left; rects[i + 1] = box.top - origin.top;
      rects[i + 2] = box.right - origin.left; rects[i + 3] = box.bottom - origin.top;
    }
  }

  function keepArrowClear(dt: number): void {
    if (!beacon || beacon.hidden) return;
    sinceMeasure += dt;
    const transform = beacon.style.transform;
    // The map rewrites the transform only when its point moves. A transform this view wrote is still right,
    // until the panels are measured again.
    if (transform === written && sinceMeasure < LOOK_EVERY) return;
    if (sinceMeasure >= LOOK_EVERY) {
      sinceMeasure = 0;
      measure();
    }
    if (!beacon.classList.contains('is-off')) return;
    const at = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(transform);
    if (!at) return;
    // Its own point, from the map, unless this view moved it last.
    if (transform !== written) { pointX = Number(at[1]); pointY = Number(at[2]); }
    const width = root.clientWidth, height = root.clientHeight;
    const onSide = Math.abs(pointX - EDGE) < 2 || Math.abs(pointX - (width - EDGE)) < 2;
    clearOfPanels(pointX, pointY, beacon.classList.contains('is-above') ? ABOVE : BELOW, onSide, rects, rectCount, width, height, GAP, moved);
    const next = `translate(${Math.round(moved.x)}px, ${Math.round(moved.y)}px)`;
    if (next !== transform) beacon.style.transform = next;
    written = beacon.style.transform;
  }
}
