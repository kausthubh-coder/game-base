import { treesInArea, type TreePlacement } from './terrain.sim.ts';
// The world as rules: chunks of blocks, light, the height cache, ray casts and saves. No drawing here.
// It answers `WorldQuery` for every other feature.
import { BLOCKS, blockId } from '../../content/blocks.ts';
import type { Surface } from '../../engine/types.ts';
import type { WorldQuery } from '../../engine/world-query.ts';
import {
  CELLS, CHUNK, HEIGHT, LIQUID, PAD, SOLID, cellIndex, chunkKey, computeHeights, keyX, keyZ, type Chunk,
} from './chunk.sim.ts';
import { LightEngine, initLight } from './light.sim.ts';
import { generateChunk } from './terrain.sim.ts';

/** A save is the seed plus the changed blocks. `edits` holds, per chunk, pairs of cell index and block id. */
export interface WorldSave {
  version: 1;
  seed: number;
  edits: [cx: number, cz: number, cells: number[]][];
}

export interface RayHit {
  /** The block that was hit. */
  x: number; y: number; z: number;
  /** The face that was hit, as a step out of the block. A new block goes at x + nx, y + ny, z + nz. */
  nx: number; ny: number; nz: number;
  id: number;
  distance: number;
}

export const emptyHit = (): RayHit => ({ x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, id: 0, distance: 0 });

export interface ChunkData {
  blocks: Uint8Array;
  light: Uint8Array;
  heights: Uint8Array;
}

/**
 * Makes one chunk from the seed and its saved changes, lit as if alone. It touches no world, so a
 * worker can run it. `edits` holds pairs of cell index and block id.
 */
export function buildChunk(seed: number, cx: number, cz: number, edits: ArrayLike<number> | null): ChunkData {
  const blocks = new Uint8Array(CELLS), light = new Uint8Array(CELLS), heights = new Uint8Array(CHUNK * CHUNK);
  generateChunk(seed, cx, cz, blocks);
  if (edits) for (let i = 0; i < edits.length; i += 2) blocks[edits[i]] = edits[i + 1];
  initLight(blocks, light);
  computeHeights(blocks, heights);
  return { blocks, light, heights };
}

export class World implements WorldQuery {
  seed: number;
  readonly chunks = new Map<number, Chunk>();
  /** Chunk keys whose mesh is stale. The view drains it. A key may appear more than once. */
  readonly dirty: number[] = [];

  private readonly edits = new Map<number, Map<number, number>>();
  private readonly lighting = new LightEngine((cx, cz) => this.chunkAt(cx, cz));
  private last: Chunk | undefined;
  private readonly around: Chunk[] = [];

  constructor(seed: number) {
    this.seed = seed;
  }

  chunkAt(cx: number, cz: number): Chunk | undefined {
    const last = this.last;
    if (last && last.cx === cx && last.cz === cz) return last;
    const found = this.chunks.get(chunkKey(cx, cz));
    if (found) this.last = found;
    return found;
  }

  isLoaded(x: number, z: number): boolean {
    return this.chunkAt(Math.floor(x) >> 4, Math.floor(z) >> 4) !== undefined;
  }

  /** The block id at a cell. Air outside the loaded world and above or below it. */
  getBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= HEIGHT) return 0;
    const c = this.chunkAt(x >> 4, z >> 4);
    return c ? c.blocks[cellIndex(x & 15, y, z & 15)] : 0;
  }

  /** Changes one block, relights around it and marks the meshes it touches. False when nothing changed. */
  setBlock(x: number, y: number, z: number, id: number): boolean {
    if (y < 0 || y >= HEIGHT) return false;
    const c = this.chunkAt(x >> 4, z >> 4);
    if (!c) return false;
    const lx = x & 15, lz = z & 15, i = cellIndex(lx, y, lz);
    const old = c.blocks[i];
    if (old === id) return false;
    c.blocks[i] = id;

    const col = (lx << 4) | lz;
    if (SOLID[id]) {
      if (y + 1 > c.heights[col]) c.heights[col] = y + 1;
    } else if (y + 1 === c.heights[col]) {
      let top = y - 1;
      while (top >= 0 && !SOLID[c.blocks[i - y + top]]) top--;
      c.heights[col] = top + 1;
    }

    const key = chunkKey(c.cx, c.cz);
    let changed = this.edits.get(key);
    if (!changed) this.edits.set(key, (changed = new Map()));
    changed.set(i, id);

    const l = this.lighting;
    l.resetTouched();
    l.blockChanged(x, y, z, old, id);
    this.markDirty(l.minX - 1, l.minZ - 1, l.maxX + 1, l.maxZ + 1);
    return true;
  }

  private markDirty(x0: number, z0: number, x1: number, z1: number): void {
    for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) {
      for (let cz = z0 >> 4; cz <= z1 >> 4; cz++) {
        const c = this.chunkAt(cx, cz);
        if (!c) continue;
        c.rev++;
        this.dirty.push(chunkKey(cx, cz));
      }
    }
  }

  /** The saved changes of one chunk as pairs of cell index and block id, to hand to `buildChunk`. */
  editsOf(cx: number, cz: number): Int32Array | null {
    const changed = this.edits.get(chunkKey(cx, cz));
    if (!changed || changed.size === 0) return null;
    const out = new Int32Array(changed.size * 2);
    let n = 0;
    for (const [i, id] of changed) { out[n++] = i; out[n++] = id; }
    return out;
  }

  /** Takes a chunk made by `buildChunk` into the world and joins its light to its neighbors. */
  adopt(cx: number, cz: number, data: ChunkData): Chunk {
    const chunk: Chunk = { cx, cz, blocks: data.blocks, light: data.light, heights: data.heights, rev: 0 };
    this.chunks.set(chunkKey(cx, cz), chunk);
    this.last = chunk;
    const l = this.lighting;
    l.resetTouched();
    l.stitch(chunk);
    if (l.minX <= l.maxX) this.markDirty(l.minX - 1, l.minZ - 1, l.maxX + 1, l.maxZ + 1);
    return chunk;
  }

  /** Makes and adopts a chunk right now. The view asks a worker instead. */
  load(cx: number, cz: number): Chunk {
    return this.chunkAt(cx, cz) ?? this.adopt(cx, cz, buildChunk(this.seed, cx, cz, this.editsOf(cx, cz)));
  }

  unload(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    if (this.last === this.chunks.get(key)) this.last = undefined;
    this.chunks.delete(key);
  }

  /**
   * Copies a chunk and a one-block rim of its neighbors into the mesher's padded arrays.
   * False when one of the eight neighbors is not loaded yet.
   */
  snapshot(cx: number, cz: number, blocks: Uint8Array, light: Uint8Array): boolean {
    const around = this.around;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const c = this.chunks.get(chunkKey(cx + dx, cz + dz));
        if (!c) return false;
        around[(dx + 1) * 3 + dz + 1] = c;
      }
    }
    for (let px = 0; px < PAD; px++) {
      const lx = px - 1;
      const sx = lx < 0 ? 0 : lx >= CHUNK ? 2 : 1;
      for (let pz = 0; pz < PAD; pz++) {
        const lz = pz - 1;
        const c = around[sx * 3 + (lz < 0 ? 0 : lz >= CHUNK ? 2 : 1)];
        const from = cellIndex(lx & 15, 0, lz & 15), to = (px * PAD + pz) * HEIGHT;
        const cb = c.blocks, cl = c.light;
        for (let y = 0; y < HEIGHT; y++) { blocks[to + y] = cb[from + y]; light[to + y] = cl[from + y]; }
      }
    }
    return true;
  }

  /**
   * Walks a ray through the blocks and stops at the first solid one. Liquids do not stop it.
   * `skip` lets the caller ignore blocks, for example the ones the camera's cutaway hides.
   */
  raycast(
    ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDistance: number,
    hit: RayHit, skip?: (x: number, y: number, z: number) => boolean,
  ): boolean {
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return false;
    dx /= len; dy /= len; dz /= len;
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx === 0 ? Infinity : Math.abs(1 / dx), tdy = dy === 0 ? Infinity : Math.abs(1 / dy), tdz = dz === 0 ? Infinity : Math.abs(1 / dz);
    let tx = dx === 0 ? Infinity : (dx > 0 ? x + 1 - ox : ox - x) * tdx;
    let ty = dy === 0 ? Infinity : (dy > 0 ? y + 1 - oy : oy - y) * tdy;
    let tz = dz === 0 ? Infinity : (dz > 0 ? z + 1 - oz : oz - z) * tdz;
    let t = 0, nx = 0, ny = 0, nz = 0;
    while (t <= maxDistance) {
      const id = this.getBlock(x, y, z);
      if (SOLID[id] && !(skip && skip(x, y, z))) {
        hit.x = x; hit.y = y; hit.z = z; hit.nx = nx; hit.ny = ny; hit.nz = nz; hit.id = id; hit.distance = t;
        return true;
      }
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
      if ((y < 0 && sy < 0) || (y >= HEIGHT && sy > 0)) return false;
    }
    return false;
  }

  // WorldQuery

  heightAt(x: number, z: number): number {
    const fx = Math.floor(x), fz = Math.floor(z);
    const c = this.chunkAt(fx >> 4, fz >> 4);
    return c ? c.heights[((fx & 15) << 4) | (fz & 15)] : 0;
  }

  surfaceAt(x: number, z: number): Surface {
    const fx = Math.floor(x), fz = Math.floor(z);
    const h = this.heightAt(fx, fz);
    if (LIQUID[this.getBlock(fx, h, fz)]) return 'water';
    return h > 0 ? BLOCKS[this.getBlock(fx, h - 1, fz)].surface : 'grass';
  }

  private canopyChunks = new Map<string, TreePlacement[]>();
  canopyAt(x:number,y:number,z:number): boolean {
    const cx=Math.floor(x/16),cz=Math.floor(z/16),key=`${cx},${cz}`;
    let trees=this.canopyChunks.get(key);
    if(!trees){trees=treesInArea(this.seed,cx*16-4,cz*16-4,cx*16+20,cz*16+20);this.canopyChunks.set(key,trees);}
    for(const t of trees) if(y>=t.y && y<t.y+6*t.size && Math.abs(x-t.x-.5)<=2.2*t.size && Math.abs(z-t.z-.5)<=2.2*t.size && this.getBlock(t.x,t.y,t.z)===blockId('barrier')) return true;
    return false;
  }

  openSky(x: number, y: number, z: number): boolean {
    return y >= this.heightAt(x, z) && !this.canopyAt(x,y,z);
  }

  lightAt(x: number, y: number, z: number): number {
    const sky = this.skyLightAt(x, y, z), block = this.blockLightAt(x, y, z);
    return sky > block ? sky : block;
  }

  /** Light from the sky at a point, 0 to 15, before the time of day dims it. */
  skyLightAt(x: number, y: number, z: number): number {
    const fy = Math.floor(y);
    if (fy >= HEIGHT) return 15;
    if (fy < 0) return 0;
    const fx = Math.floor(x), fz = Math.floor(z);
    const c = this.chunkAt(fx >> 4, fz >> 4);
    const light = c ? c.light[cellIndex(fx & 15, fy, fz & 15)] >> 4 : 15;
    return light > 12 && this.canopyAt(x,y,z) ? 12 : light;
  }

  /** Light from lamps and crystals at a point, 0 to 15. */
  blockLightAt(x: number, y: number, z: number): number {
    const fy = Math.floor(y);
    if (fy < 0 || fy >= HEIGHT) return 0;
    const fx = Math.floor(x), fz = Math.floor(z);
    const c = this.chunkAt(fx >> 4, fz >> 4);
    return c ? c.light[cellIndex(fx & 15, fy, fz & 15)] & 15 : 0;
  }

  // Saves

  save(): WorldSave {
    const edits: WorldSave['edits'] = [];
    for (const [key, changed] of this.edits) {
      if (changed.size === 0) continue;
      const cells: number[] = [];
      for (const [i, id] of changed) cells.push(i, id);
      edits.push([keyX(key), keyZ(key), cells]);
    }
    return { version: 1, seed: this.seed, edits };
  }

  /** Replaces this world with a saved one. Every chunk is dropped, so load the ones you need again. */
  restore(save: WorldSave): void {
    if (save.version !== 1) throw new Error(`cannot read a world save of version ${String(save.version)}`);
    this.seed = save.seed;
    this.canopyChunks.clear();
    this.chunks.clear();
    this.last = undefined;
    this.dirty.length = 0;
    this.edits.clear();
    for (const [cx, cz, cells] of save.edits) {
      const changed = new Map<number, number>();
      for (let i = 0; i < cells.length; i += 2) changed.set(cells[i], cells[i + 1]);
      this.edits.set(chunkKey(cx, cz), changed);
    }
  }
}
