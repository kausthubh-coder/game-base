// What a stroke would do, cell by cell, without doing it. A stroke is one press, drag and release in build
// mode: the held item says what it does and which cells it covers, and every cell gets a verdict. The build
// system applies exactly the cells this file calls `ok`, and it asks again at the release, so the picture
// under the pointer and the change to the world come from the same rules.
import { AIR, blockId } from '../../content/blocks.ts';
import { SOLID } from '../../features/world/chunk.sim.ts';
import { bodyInCell } from '../actions/index.sim.ts';
import type { Actor, BuildTool, CellVerdict, Game, PlaceableDef, PlanCell, Stack, StrokeShape, Systems } from '../api.sim.ts';

/** A stroke reaches this many blocks from the player along x and z, and this many up or down. */
export const BUILD_REACH = 12;
export const BUILD_REACH_UP = 4;
/** A rectangle is at most this many cells on a side, and a line this many long. */
export const AREA_SPAN = 12;
export const LINE_SPAN = 16;
/** The most cells a stroke can cover. */
export const MAX_CELLS = AREA_SPAN * AREA_SPAN;

const GRASS = blockId('grass');
const DIRT = blockId('dirt');
const TILLED = blockId('tilled_soil');

export const NO_TOOL: BuildTool = { kind: 'none', shape: 'one', item: null, costs: false, block: AIR, placeable: null };

/** What the held stack does in build mode. The same object for the same item, so a caller can compare by `item`. */
export function toolOf(game: Game, held: Stack | null, cache: Map<string, BuildTool>): BuildTool {
  if (!held) return NO_TOOL;
  let tool = cache.get(held.id);
  if (tool) return tool;
  const def = game.systems.items.get(held.id);
  const none = { item: held.id, block: AIR, placeable: null };
  if (def.tool?.kind === 'hoe') tool = { ...none, kind: 'till', shape: 'area', costs: false };
  else if (def.tool?.kind === 'can') tool = { ...none, kind: 'water', shape: 'area', costs: false };
  else if (def.seed !== undefined) tool = { ...none, kind: 'plant', shape: 'area', costs: true };
  else if (def.block !== undefined) tool = { ...none, kind: 'block', shape: 'line', costs: true, block: def.block };
  else if (def.placeable !== undefined) {
    const placeable = (game.systems as Partial<Systems>).placeables?.defs().find((d) => d.kind === def.placeable) ?? null;
    tool = placeable ? { ...none, kind: 'place', shape: placeable.joins ? 'line' : 'one', costs: true, placeable } : { ...NO_TOOL, item: held.id };
  } else tool = { ...NO_TOOL, item: held.id };
  cache.set(held.id, tool);
  return tool;
}

/**
 * Fills `cells` with the columns a stroke covers from where it was pressed (x0, z0) to the pointer (x1, z1),
 * nearest the press first, so a bag that runs short is spent beside the press. It takes cell objects from
 * `pool` and makes one only when the pool is too small. Returns how many it filled.
 */
export function strokeCells(shape: StrokeShape, x0: number, z0: number, x1: number, z1: number, cells: PlanCell[], pool: PlanCell[]): number {
  let n = 0;
  if (shape === 'one') {
    n = put(cells, pool, n, x1, z1);
  } else if (shape === 'line') {
    // The longer way wins, and x on a tie, so a line never bends.
    const dx = x1 - x0, dz = z1 - z0;
    const alongX = Math.abs(dx) >= Math.abs(dz);
    const length = Math.min(LINE_SPAN - 1, Math.abs(alongX ? dx : dz)), step = Math.sign(alongX ? dx : dz);
    for (let i = 0; i <= length; i++) n = put(cells, pool, n, alongX ? x0 + i * step : x0, alongX ? z0 : z0 + i * step);
  } else {
    const wide = Math.min(AREA_SPAN - 1, Math.abs(x1 - x0)), deep = Math.min(AREA_SPAN - 1, Math.abs(z1 - z0));
    const sx = Math.sign(x1 - x0) || 1, sz = Math.sign(z1 - z0) || 1;
    // Rings around the press: every cell whose longer distance from it is `ring`, the row first and then the column.
    for (let ring = 0; ring <= Math.max(wide, deep); ring++) {
      if (ring <= deep) for (let i = 0; i <= Math.min(ring, wide); i++) n = put(cells, pool, n, x0 + i * sx, z0 + ring * sz);
      if (ring <= wide) for (let j = Math.min(ring - 1, deep); j >= 0; j--) n = put(cells, pool, n, x0 + ring * sx, z0 + j * sz);
    }
  }
  cells.length = n;
  return n;
}

/** Writes one cell at place `n`, taking its object from the pool, and returns the next place. */
function put(cells: PlanCell[], pool: PlanCell[], n: number, x: number, z: number): number {
  const cell = pool[n] ?? (pool[n] = { x: 0, z: 0, verdict: 'ok' });
  cell.x = x;
  cell.z = z;
  cell.verdict = 'ok';
  cells[n] = cell;
  return n + 1;
}

/** The corner a placeable stands at when the cell (x, z) is pointed at: a turned thing longer than a block starts at the pointed cell and goes on behind it. */
export function cornerOf(def: PlaceableDef, turns: number, x: number, z: number, out: { x: number; z: number }): void {
  // The size along x and z after turning, as `footprint` gives it, without making an array on every call.
  const sx = turns & 1 ? def.size[2] : def.size[0], sz = turns & 1 ? def.size[0] : def.size[2];
  out.x = turns === 1 ? x - sx + 1 : x;
  out.z = turns === 2 ? z - sz + 1 : z;
}

// The cell `bodyAt` asks about, and its answer. They sit out here so that the walk over the actors makes nothing.
const asked = { x: 0, y: 0, z: 0, found: false };
const standsIn = (actor: Actor): void => {
  if (!asked.found && actor.id !== 'player' && bodyInCell(actor.pos.x, actor.pos.y, actor.pos.z, asked.x, asked.y, asked.z)) asked.found = true;
};

/** True when a person, a pet, a creature or the player stands in the cell. */
function bodyAt(game: Game, x: number, y: number, z: number): boolean {
  const p = game.player.pos;
  if (bodyInCell(p.x, p.y, p.z, x, y, z)) return true;
  asked.x = x;
  asked.y = y;
  asked.z = z;
  asked.found = false;
  game.actors.forEach(standsIn);
  return asked.found;
}

/**
 * The verdict for one cell, before the bag is counted. `y` is the height of the ground block the stroke works
 * on. `turns` is the quarter turns of a placeable.
 */
export function judge(game: Game, tool: BuildTool, x: number, y: number, z: number, turns: number): CellVerdict {
  const { world, player } = game;
  const sys = game.systems as Partial<Systems>;
  if (Math.max(Math.abs(x + 0.5 - player.pos.x), Math.abs(z + 0.5 - player.pos.z)) > BUILD_REACH || Math.abs(y + 1 - player.pos.y) > BUILD_REACH_UP) return 'far';
  const ground = world.getBlock(x, y, z), above = world.getBlock(x, y + 1, z);

  if (tool.kind === 'till' || tool.kind === 'plant' || tool.kind === 'water') {
    if (sys.region?.isProtected(x, y, z)) return 'town';
    if (!SOLID[ground]) return 'ground';
    if (tool.kind === 'water') return ground === TILLED ? 'ok' : 'skip';
    if (tool.kind === 'till') {
      if (ground === TILLED) return 'skip';
      if (ground !== GRASS && ground !== DIRT) return 'wrong';
      return above === AIR ? 'ok' : 'blocked';
    }
    if (ground !== TILLED) return 'wrong';
    if (sys.crops?.at(x, y, z)) return 'skip';
    return above === AIR && !sys.placeables?.at(x, y + 1, z) ? 'ok' : 'blocked';
  }

  if (tool.kind === 'block') {
    if (sys.region?.isProtected(x, y + 1, z)) return 'town';
    if (!SOLID[ground]) return 'ground';
    if (above === tool.block) return 'skip';
    if (SOLID[above] || sys.placeables?.at(x, y + 1, z) || sys.crops?.at(x, y, z) || bodyAt(game, x, y + 1, z)) return 'blocked';
    return 'ok';
  }

  if (tool.kind === 'place' && tool.placeable) {
    const def = tool.placeable;
    if (def.joins && sys.placeables?.at(x, y + 1, z)?.kind === def.kind) return 'skip';
    const sx = turns & 1 ? def.size[2] : def.size[0], sy = def.size[1], sz = turns & 1 ? def.size[0] : def.size[2];
    cornerOf(def, turns, x, z, corner);
    let verdict: CellVerdict = 'ok';
    for (let cx = corner.x; cx < corner.x + sx; cx++) {
      for (let cz = corner.z; cz < corner.z + sz; cz++) {
        if (sys.region?.isProtected(cx, y + 1, cz)) return 'town';
        if (!SOLID[world.getBlock(cx, y, cz)]) verdict = 'ground';
        if (verdict !== 'ok') continue;
        if (sys.crops?.at(cx, y, cz)) verdict = 'blocked';
        for (let cy = y + 1; cy <= y + sy && verdict === 'ok'; cy++) {
          if (world.getBlock(cx, cy, cz) !== AIR || sys.placeables?.at(cx, cy, cz) || bodyAt(game, cx, cy, cz)) verdict = 'blocked';
        }
      }
    }
    return verdict;
  }
  return 'skip';
}
const corner = { x: 0, z: 0 };

/** North, east, south, west: the way a placeable's front faces at 0, 1, 2 and 3 quarter turns. */
export const FRONT: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
/** The turns `snapTurns` tries, counted from the one that faces the player: that one, either side, then away. */
const TRY: readonly number[] = [0, 1, 3, 2];

/** The quarter turns that face a placeable's front toward the player, as a click outside build mode places it. */
export function facingPlayer(game: Game): number {
  return (Math.round(game.player.facing / (Math.PI / 2)) + 2) & 3;
}

/**
 * The quarter turns a placeable takes by itself in the cell above the ground block (x, y, z). A thing that
 * `backs` turns its back to a wall beside it and its front to open ground: toward the player when it can,
 * then to either side, then away. With no wall it faces the player.
 */
export function snapTurns(game: Game, def: PlaceableDef, x: number, y: number, z: number): number {
  const toward = facingPlayer(game);
  if (!def.backs) return toward;
  const { world } = game;
  const placeables = (game.systems as Partial<Systems>).placeables;
  const wall = (cx: number, cz: number): boolean => Boolean(SOLID[world.getBlock(cx, y + 1, cz)]) && !placeables?.at(cx, y + 1, cz);
  for (let i = 0; i < TRY.length; i++) {
    const turns = (toward + TRY[i]) & 3;
    const fx = FRONT[turns][0], fz = FRONT[turns][1];
    if (wall(x - fx, z - fz) && !SOLID[world.getBlock(x + fx, y + 1, z + fz)]) return turns;
  }
  return toward;
}

/** A line to say why a cell is refused, or an empty string for a cell that needs no words. */
export function reasonOf(verdict: CellVerdict, tool: BuildTool): string {
  if (verdict === 'far') return 'Too far away.';
  if (verdict === 'town') return 'This belongs to the town.';
  if (verdict === 'ground') return 'It needs level ground.';
  if (verdict === 'blocked') return 'Something is in the way.';
  if (verdict === 'short') return 'Not enough in the bag.';
  if (verdict === 'wrong') return tool.kind === 'till' ? 'Only grass and dirt can be tilled.' : 'It needs tilled soil.';
  return '';
}
