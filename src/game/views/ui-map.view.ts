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
import { addStyle, frame } from '../uiview/theme.ts';

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
/* ---- the minimap: an ink line, a brass ring, an ink line ---- */
.ui-book .gb-minimap { border: 2px solid var(--ui-ink); background: var(--ui-paper-3); box-shadow: 0 0 0 3px var(--ui-brass), 0 0 0 5px var(--ui-ink), 0 4px 14px var(--ui-shadow); }
.ui-book .gb-minimap:focus-visible { outline: 2px solid var(--ui-paper-light); outline-offset: 7px; }
.ui-book .gb-hud-minimap { padding: 5px; }

/* ---- the active waypoint on the screen. It is drawn over the HUD, so its arrow is never lost behind the quick slots. ---- */
.ui-book .gb-beacon { z-index: 12; }
/* A panel and the full map have the screen to themselves. */
.ui-book.ui-covered .gb-beacon { visibility: hidden; }
.ui-book .gb-beacon-chip { padding: 1px 8px 2px; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums lining-nums; color: var(--ui-ink); background: var(--ui-paper); border: 2px solid var(--ui-ink); border-radius: 2px; box-shadow: 0 3px 10px var(--ui-shadow); }
.ui-book .gb-beacon-arrow path { stroke: var(--ui-ink); }

/* ---- the full map: a page of the book ---- */
.ui-book .gb-map { padding: 16px; background: var(--ui-scrim); font-size: 16px; line-height: 1.45; pointer-events: auto; }
.ui-book .gb-map-page { gap: 16px; padding: 36px 40px 32px; animation: ui-map-in 120ms var(--ui-ease); }
@keyframes ui-map-in { from { transform: scale(0.97); } }
.ui-book .gb-map-head { gap: 8px 16px; padding: 0; min-height: 40px; }
.ui-book .gb-map-head h2 { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
.ui-book .gb-map-count { font-size: 14px; color: var(--ui-ink-2); }
.ui-book .gb-map-tools { gap: 8px; }
.ui-book .gb-map button { min-height: 40px; padding: 0 16px; font-weight: 600; color: var(--ui-ink); background: var(--ui-plate); border: 2px solid var(--ui-ink); border-radius: 2px; box-shadow: none; transition: transform 80ms var(--ui-ease); }
.ui-book .gb-map button:hover { background: var(--ui-paper-light); }
.ui-book .gb-map button:active { background: var(--ui-paper-2); transform: translateY(1px); box-shadow: none; }
.ui-book .gb-map button:focus-visible, .ui-book .gb-map canvas:focus-visible, .ui-book .gb-map input:focus-visible { outline: 2px solid var(--ui-ink); outline-offset: 2px; }
.ui-book .gb-map .gb-map-square { width: 40px; padding: 0; font-size: 20px; }
.ui-book .gb-map-view { border: 2px solid var(--ui-ink); border-radius: 2px; background: var(--ui-paper-2); box-shadow: inset 0 0 24px oklch(0.402 0.055 61 / 0.25); }
.ui-book .gb-map-note { padding: 8px 16px; border-radius: 2px; background: var(--ui-ink); color: var(--ui-paper); }
.ui-book .gb-map-foot { padding: 0; font-size: 14px; color: var(--ui-ink-2); }
.ui-book .gb-map-picker { gap: 8px; padding: 12px; border: 2px solid var(--ui-ink); border-radius: 2px; background: var(--ui-paper); box-shadow: 0 6px 20px var(--ui-shadow); }
.ui-book .gb-map .gb-pick-grid button { min-height: 0; padding: 0; background: var(--ui-paper-2); border: 0; }
.ui-book .gb-map .gb-pick-grid button:hover { background: var(--ui-paper-3); }
.ui-book .gb-map .gb-pick-grid [data-icon][aria-checked='true'] { box-shadow: inset 0 0 0 2px var(--ui-paper); }
.ui-book .gb-pick-share { min-height: 40px; font-size: 15px; }
.ui-book .gb-pick-actions { gap: 8px; }
.ui-book .gb-pick-actions button { padding: 0 8px; }

@media (max-width: 640px) {
  .ui-book .gb-map { padding: 8px; }
  .ui-book.ui-art .gb-map-page { --u: 1px; }
  .ui-book .gb-map-page { height: 100%; gap: 12px; padding: 24px 20px 20px; }
  .ui-book .gb-map-tools { gap: 4px; }
  .ui-book .gb-map button { min-height: 44px; padding: 0 8px; }
  .ui-book .gb-map .gb-map-square { flex: 0 0 44px; width: 44px; }
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
    const color = readColumn(bx, bz);
    tile[at] = color + 1;
    return color;
  }

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
  frame(root.querySelector('.gb-map-page'));

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
      if (view.started && !book.menuOpen && !(sys.talk?.active ?? false)) map.open();
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
  });
}
