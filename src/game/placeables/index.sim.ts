// Stations and furniture the player sets down: the workbench, the bed, the chest. Each one takes up
// its cells, shows an "E" prompt, and is saved. The data is src/game/content/placeables.ts.
import { AIR, BLOCKS } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import { REACH, reachDistance } from '../actions/index.sim.ts';
import type { Interactable, Placed, PlaceableDef, PlaceablesApi, Systems, UseContext } from '../api.sim.ts';
import { PLACEABLES, footprint } from '../content/placeables.ts';
import type { Kernel } from '../kernel.sim.ts';

/** The prompt of a placed thing shows within this many blocks of its middle. */
export const PROMPT_RADIUS = 2;

export const NO_ROOF_TOAST = 'The bed needs a roof over it.';
export const TOO_EARLY_TOAST = 'It is not evening yet.';

/** An unseen solid block that fills the cells of a placed thing, when the block table has one. */
const BARRIER: number | null = BLOCKS.find((block) => block.key === 'barrier')?.id ?? null;

/** The top of the world, in blocks. */
const WORLD_HEIGHT = 64;

export interface PlaceablesSave {
  next: number;
  placed: Placed[];
}

interface Entry {
  placed: Placed;
  def: PlaceableDef;
  /** The size in blocks after turning. */
  sx: number; sy: number; sz: number;
  center: Vec3;
  target: Interactable;
}

const cellKey = (x: number, y: number, z: number): number => ((x + 32768) * 65536 + (z + 32768)) * WORLD_HEIGHT + y;

export function install(kernel: Kernel): void {
  const game = kernel.game;
  const { world, events } = game;
  // Another system may be missing in a small test, so they are read as optional.
  const others = game.systems as Partial<Systems>;

  const defs = new Map(PLACEABLES.map((def) => [def.kind, def]));
  const entries = new Map<string, Entry>();
  const cells = new Map<number, Entry>();
  /** The same things as `entries`, kept as the list that all() hands out. */
  const list: Placed[] = [];
  const listeners = new Set<(placed: Placed) => void>();
  let next = 1;
  let wired = false;

  function eachCell(e: Entry, visit: (x: number, y: number, z: number) => void): void {
    const p = e.placed;
    for (let x = p.x; x < p.x + e.sx; x++) for (let y = p.y; y < p.y + e.sy; y++) for (let z = p.z; z < p.z + e.sz; z++) visit(x, y, z);
  }

  /** The bed sleeps by itself. A workbench and a chest only open a panel, so they show while a panel listens. */
  function promptOf(e: Entry): string | null {
    if (e.def.prompt === null) return null;
    return e.def.station === 'bed' || listeners.size > 0 ? e.def.prompt : null;
  }

  function sleepIn(e: Entry): void {
    const time = others.time;
    if (!time) return;
    if (time.canSleep()) {
      time.sleep();
      return;
    }
    // Why not: the time system wants evening, and a roof over the bed or over the player. The bed fills its
    // block, so nobody can stand under the block that covers it: a roof over the bed alone is enough.
    const p = e.placed, at = game.player.pos;
    const roofless = world.openSky(p.x, p.y + e.sy, p.z) && world.openSky(at.x, at.y + 0.5, at.z);
    events.emit('toast', { text: roofless ? NO_ROOF_TOAST : TOO_EARLY_TOAST });
  }

  function use(e: Entry): void {
    if (e.def.station === 'bed') sleepIn(e);
    else events.emit('ui.sound', { sound: 'open' });
    for (const listener of [...listeners]) listener(e.placed);
  }

  /** Stands a thing in the world without asking whether the space is free. */
  function put(placed: Placed, def: PlaceableDef): Entry {
    const [sx, sy, sz] = footprint(def.size, placed.quarterTurns);
    const e: Entry = {
      placed, def, sx, sy, sz,
      center: { x: placed.x + sx / 2, y: placed.y + sy / 2, z: placed.z + sz / 2 },
      target: {
        id: `placeable:${placed.id}`,
        pos: () => e.center,
        radius: PROMPT_RADIUS,
        prompt: () => promptOf(e),
        act: () => use(e),
      },
    };
    entries.set(placed.id, e);
    list.push(placed);
    eachCell(e, (x, y, z) => {
      cells.set(cellKey(x, y, z), e);
      // A save from when the thing was smaller may have a block in a new cell. It stays.
      if (BARRIER !== null && world.getBlock(x, y, z) === AIR) world.setBlock(x, y, z, BARRIER);
    });
    others.interact?.add(e.target);
    return e;
  }

  function remove(id: string): void {
    const e = entries.get(id);
    if (!e) return;
    entries.delete(id);
    list.splice(list.indexOf(e.placed), 1);
    eachCell(e, (x, y, z) => {
      cells.delete(cellKey(x, y, z));
      if (BARRIER !== null && world.getBlock(x, y, z) === BARRIER) world.setBlock(x, y, z, AIR);
    });
    others.interact?.remove(e.target.id);
  }

  const entryAt = (x: number, y: number, z: number): Entry | undefined => cells.get(cellKey(Math.floor(x), Math.floor(y), Math.floor(z)));

  /** The secondary button on a placed thing uses it, the same as "E" beside it. */
  function onClick(context: UseContext): boolean {
    const hit = context.hit;
    if (context.button !== 'secondary' || !hit || game.player.busy) return false;
    const e = entryAt(hit.x, hit.y, hit.z) ?? entryAt(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz);
    if (!e || promptOf(e) === null) return false;
    const p = e.placed;
    if (reachDistance(game.player, p.x, p.y, p.z, p.x + e.sx, p.y + e.sy, p.z + e.sz) > REACH) return false;
    use(e);
    return true;
  }

  /** Adds the click handler once the actions system is there. */
  function wire(): void {
    if (wired || !others.actions) return;
    others.actions.addHandler(onClick);
    wired = true;
  }

  const api: PlaceablesApi = {
    defs: () => PLACEABLES,
    all: () => list,
    place(kind, px, py, pz, quarterTurns) {
      wire();
      const def = defs.get(kind);
      if (!def) return null;
      const x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
      const turns = ((Math.floor(quarterTurns) % 4) + 4) % 4;
      const [sx, sy, sz] = footprint(def.size, turns);
      if (y < 0 || y + sy > WORLD_HEIGHT) return null;
      for (let cx = x; cx < x + sx; cx++) {
        for (let cy = y; cy < y + sy; cy++) {
          for (let cz = z; cz < z + sz; cz++) if (world.getBlock(cx, cy, cz) !== AIR || cells.has(cellKey(cx, cy, cz))) return null;
        }
      }
      const placed: Placed = { id: `${kind}:${next++}`, kind, x, y, z, quarterTurns: turns };
      put(placed, def);
      events.emit('placeable.placed', { kind, x, y, z });
      return placed;
    },
    remove,
    at: (x, y, z) => entryAt(x, y, z)?.placed ?? null,
    near(station, at, radius) {
      for (const e of entries.values()) {
        if (e.def.station !== station) continue;
        const p = e.placed;
        const dx = at.x < p.x ? p.x - at.x : at.x > p.x + e.sx ? at.x - p.x - e.sx : 0;
        const dy = at.y < p.y ? p.y - at.y : at.y > p.y + e.sy ? at.y - p.y - e.sy : 0;
        const dz = at.z < p.z ? p.z - at.z : at.z > p.z + e.sz ? at.z - p.z - e.sz : 0;
        if (dx * dx + dy * dy + dz * dz <= radius * radius) return true;
      }
      return false;
    },
    onUse(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  kernel.add('placeables', api, {
    step: wire,
    save(): PlaceablesSave {
      return { next, placed: list.map((p) => ({ ...p })) };
    },
    load(data) {
      wire();
      const save = data as Partial<PlaceablesSave> | null;
      for (const id of [...entries.keys()]) remove(id);
      const saved = Number(save?.next);
      next = Number.isInteger(saved) && saved > 0 ? saved : 1;
      for (const p of save?.placed ?? []) {
        const def = defs.get(p.kind);
        // A kind that no longer exists is dropped, so an old save still opens.
        if (!def || entries.has(p.id)) continue;
        put({ ...p }, def);
        // The counter stays ahead of every id in use, even when the save's own counter is missing.
        const number = Number(p.id.slice(p.id.lastIndexOf(':') + 1));
        if (Number.isInteger(number) && number >= next) next = number + 1;
      }
    },
  });
}
