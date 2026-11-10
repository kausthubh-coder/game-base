// The map feature in one piece: the rules, the round minimap, the full map and the beam of the
// active waypoint. The game gives it a color for each column of blocks and tells it where the
// player is. It reads the camera's turn from the frame.
import type { Bus, GameEvent } from '../../engine/events.ts';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import { createBeacon, type Beacon } from './beacon.view.ts';
import { createFullMap } from './fullmap.ui.ts';
import { cameraYawOf } from './geometry.sim.ts';
import { MapRules, type MapSave } from './map.sim.ts';
import type { Waypoint, WaypointOptions } from './marks.sim.ts';
import { createMinimap, type ColorAt, type MapMarker, type MinimapStats } from './minimap.view.ts';

/** Where the map is kept between visits. `localStorage` fits. */
export interface MapStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MapOptions {
  /** The color of the top of the column of blocks at (x, z), as 0xRRGGBB. Called a lot: keep it to a lookup. */
  colorAt: ColorAt;
  /** Where the full map and the edge arrow go. The page body by default. */
  parent?: HTMLElement;
  /** Rules to use, for a game that keeps its own. A new empty map by default. */
  rules?: MapRules;
  /** How many blocks the minimap shows across. 120 by default. */
  minimapBlocks?: number;
  /** Waypoints off the minimap show as arrows at its rim: all of them, or only the active one. */
  edgeArrows?: 'all' | 'active';
  /** The player sees this many blocks around them, and the full map fills in that far. 56 by default, a little less than the minimap. */
  revealRadius?: number;
  /** Blocks across the whole world. The full map's farthest zoom shows this much. 4096 by default. */
  worldSize?: number;
  /** Draw the beam and the edge arrow for the active waypoint. True by default. */
  beam?: boolean;
  /** Where the map saves itself. `localStorage` by default. Pass null and call `save` and `load` yourself. */
  storage?: MapStorage | null;
  storageKey?: string;
  /** Open and close sounds go here as `ui` events. */
  bus?: Bus<GameEvent>;
  onToggle?: (open: boolean) => void;
}

export interface MapView extends ViewSystem {
  /** The map as rules: `rules.marks` holds waypoints, pins and rumors, `rules.seen` what has been seen. */
  readonly rules: MapRules;
  /** The round minimap. Put it where you want it, for example in the HUD's minimap slot. */
  readonly minimap: HTMLElement;
  /** How long the minimap takes to draw. */
  readonly stats: MinimapStats;
  /** True while the full map is open. */
  readonly isOpen: boolean;
  /** The camera's yaw the minimap drew with last frame. */
  readonly yaw: number;
  /** Where the player is and which way they face (0 north, PI / 2 east). Call it every frame. */
  setPlayer(x: number, z: number, facing: number): void;
  /** Friends, a pet, people with a quest. The map reads this list every frame, so change it in place. */
  setMarkers(markers: readonly MapMarker[]): void;
  /** Redraws part of the map after blocks change. */
  invalidate(x: number, z: number, width: number, depth: number): void;
  open(): void;
  close(): void;
  toggle(): void;
  /** Drops a waypoint, where the player stands by default. Null when the player has 20. */
  dropWaypoint(x?: number, z?: number, options?: WaypointOptions): Waypoint | null;
  save(): MapSave;
  load(save: unknown): boolean;
}

function defaultStorage(): MapStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Seconds between saves while the player walks and the map fills in. A change to a waypoint saves within half a second. */
const SEEN_SAVE_SECONDS = 15;

export function createMap(ctx: ViewContext, options: MapOptions): MapView {
  const rules = options.rules ?? new MapRules();
  const parent = options.parent ?? document.body;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const storageKey = options.storageKey ?? 'game-base.map';
  const revealRadius = options.revealRadius ?? 56;
  const stop = new AbortController();

  if (storage && !options.rules) {
    try {
      const text = storage.getItem(storageKey);
      if (text) rules.load(JSON.parse(text));
    } catch {
      // No save, or one that cannot be read. Start with an empty map.
    }
  }

  const full = createFullMap(rules, {
    colorAt: options.colorAt,
    parent,
    worldSize: options.worldSize ?? 4096,
    onToggle: (open) => {
      options.bus?.emit({ type: 'ui', sound: open ? 'open' : 'close' });
      if (!open) persist();
      options.onToggle?.(open);
    },
  });
  const minimap = createMinimap(rules.marks, {
    colorAt: options.colorAt,
    blocks: options.minimapBlocks,
    edgeArrows: options.edgeArrows,
    onOpen: () => full.open(),
  });
  const beacon: Beacon | null = options.beam === false ? null : createBeacon(ctx, rules.marks, { parent });

  let playerX = 0, playerZ = 0, facing = 0, yaw = 0;
  let markers: readonly MapMarker[] = [];
  let savedMarks = rules.marks.version, savedSeen = rules.seen.version;
  let marksClock = 0, seenClock = 0;

  function persist(): void {
    savedMarks = rules.marks.version;
    savedSeen = rules.seen.version;
    marksClock = seenClock = 0;
    if (!storage) return;
    try {
      storage.setItem(storageKey, JSON.stringify(rules.save()));
    } catch {
      // Storage full or blocked. The map still works until the page closes.
    }
  }
  window.addEventListener('pagehide', persist, { signal: stop.signal });

  return {
    rules,
    minimap: minimap.element,
    stats: minimap.stats,
    get isOpen() { return full.isOpen; },
    get yaw() { return yaw; },
    setPlayer(x, z, heading) {
      playerX = x; playerZ = z; facing = heading;
    },
    setMarkers(list) {
      markers = list;
    },
    invalidate(x, z, width, depth) {
      minimap.invalidate(x, z, width, depth);
      full.invalidate(x, z, width, depth);
    },
    open: () => full.open(),
    close: () => full.close(),
    toggle: () => (full.isOpen ? full.close() : full.open()),
    dropWaypoint(x = playerX, z = playerZ, waypoint) {
      const dropped = rules.marks.addWaypoint(x, z, waypoint);
      if (dropped && !rules.marks.active) rules.marks.setActive(dropped.id);
      return dropped;
    },
    save: () => rules.save(),
    load(save) {
      const ok = rules.load(save);
      full.reset();
      persist();
      return ok;
    },

    update(dt, frame) {
      yaw = cameraYawOf(frame.camera.matrixWorld.elements);
      rules.marks.tick(dt);
      rules.seen.reveal(playerX, playerZ, revealRadius);
      minimap.draw(playerX, playerZ, facing, yaw, markers);
      full.update(playerX, playerZ, facing, markers);
      beacon?.update(dt, frame, playerX, playerZ);

      // Save soon after a waypoint changes, and now and then while walking fills in the map.
      if (rules.marks.version !== savedMarks) {
        marksClock += dt;
        if (marksClock > 0.5) persist();
      } else if (rules.seen.version !== savedSeen) {
        seenClock += dt;
        if (seenClock > SEEN_SAVE_SECONDS) persist();
      }
    },

    setQuality(quality) {
      beacon?.setQuality(quality);
    },

    dispose() {
      persist();
      stop.abort();
      minimap.dispose();
      full.dispose();
      beacon?.dispose();
    },
  };
}
