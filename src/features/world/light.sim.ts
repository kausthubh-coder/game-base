// Light levels, 0 to 15, in two channels: sky light falls from above and block light comes from lamps
// and crystals. Both spread one level weaker per block, and sky light keeps its full 15 straight down.
// A chunk is lit alone when it is made (`initLight`), then joined to its neighbors (`stitch`). A
// changed block only relights the cells around it (`blockChanged`).
import { CELLS, CHUNK, EMIT, HEIGHT, OPAQUE, cellIndex, type Chunk } from './chunk.sim.ts';

const SKY = 4, BLOCK = 0;

// Local flood for one chunk. Cell indices are ((lx * 16 + lz) * 64 + y).
let localQueue = new Int32Array(1 << 14);

function floodLocal(blocks: Uint8Array, light: Uint8Array, shift: number, count: number): void {
  let head = 0, tail = count;
  const push = (i: number): void => {
    if (tail === localQueue.length) {
      const bigger = new Int32Array(localQueue.length * 2);
      bigger.set(localQueue);
      localQueue = bigger;
    }
    localQueue[tail++] = i;
  };
  const visit = (n: number, level: number): void => {
    if (OPAQUE[blocks[n]]) return;
    if (((light[n] >> shift) & 15) >= level) return;
    light[n] = (light[n] & ~(15 << shift)) | (level << shift);
    push(n);
  };
  while (head < tail) {
    const i = localQueue[head++];
    const v = (light[i] >> shift) & 15;
    if (v <= 1) continue;
    const y = i & 63, lz = (i >> 6) & 15, lx = i >> 10;
    if (y > 0) visit(i - 1, shift === SKY && v === 15 ? 15 : v - 1);
    if (y < HEIGHT - 1) visit(i + 1, v - 1);
    if (lz > 0) visit(i - HEIGHT, v - 1);
    if (lz < CHUNK - 1) visit(i + HEIGHT, v - 1);
    if (lx > 0) visit(i - HEIGHT * CHUNK, v - 1);
    if (lx < CHUNK - 1) visit(i + HEIGHT * CHUNK, v - 1);
  }
}

/** Lights one chunk as if nothing were around it. `stitch` joins it to its neighbors afterwards. */
export function initLight(blocks: Uint8Array, light: Uint8Array): void {
  light.fill(0);
  let count = 0;
  const seed = (i: number): void => {
    if (count === localQueue.length) {
      const bigger = new Int32Array(localQueue.length * 2);
      bigger.set(localQueue);
      localQueue = bigger;
    }
    localQueue[count++] = i;
  };

  // Sky light falls down each column until something opaque stops it. Every lit cell that has a
  // darker open cell beside it starts the sideways flood, which is the cells under overhangs.
  for (let col = 0; col < CHUNK * CHUNK; col++) {
    const base = col * HEIGHT;
    for (let y = HEIGHT - 1; y >= 0 && !OPAQUE[blocks[base + y]]; y--) light[base + y] = 15 << SKY;
  }
  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const base = cellIndex(lx, 0, lz);
      for (let y = HEIGHT - 1; y >= 0 && light[base + y] !== 0; y--) {
        const i = base + y;
        if ((lx > 0 && light[i - HEIGHT * CHUNK] === 0) || (lx < CHUNK - 1 && light[i + HEIGHT * CHUNK] === 0)
          || (lz > 0 && light[i - HEIGHT] === 0) || (lz < CHUNK - 1 && light[i + HEIGHT] === 0)) seed(i);
      }
    }
  }
  floodLocal(blocks, light, SKY, count);

  count = 0;
  for (let i = 0; i < CELLS; i++) {
    const e = EMIT[blocks[i]];
    if (e > 0) { light[i] |= e; seed(i); }
  }
  if (count > 0) floodLocal(blocks, light, BLOCK, count);
}

const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];
const DOWN = 3;

/** Spreads and removes light across loaded chunks. One per world. */
export class LightEngine {
  /** The box of cells whose light changed since `resetTouched`. Empty when minX > maxX. */
  minX = 1; maxX = 0; minZ = 1; maxZ = 0;

  private add = new Int32Array(3 << 12);
  private addTail = 0;
  private gone = new Int32Array(4 << 12);
  private goneTail = 0;
  private chunk: Chunk | undefined;
  private index = 0;
  private readonly chunkAt: (cx: number, cz: number) => Chunk | undefined;

  constructor(chunkAt: (cx: number, cz: number) => Chunk | undefined) {
    this.chunkAt = chunkAt;
  }

  resetTouched(): void {
    this.minX = 1; this.maxX = 0; this.minZ = 1; this.maxZ = 0;
  }

  private touch(x: number, z: number): void {
    if (this.minX > this.maxX) { this.minX = this.maxX = x; this.minZ = this.maxZ = z; return; }
    if (x < this.minX) this.minX = x; else if (x > this.maxX) this.maxX = x;
    if (z < this.minZ) this.minZ = z; else if (z > this.maxZ) this.maxZ = z;
  }

  /** Points `chunk` and `index` at a cell. False when it is outside the loaded world. */
  private locate(x: number, y: number, z: number): boolean {
    if (y < 0 || y >= HEIGHT) return false;
    const cx = x >> 4, cz = z >> 4;
    let c = this.chunk;
    if (!c || c.cx !== cx || c.cz !== cz) {
      c = this.chunkAt(cx, cz);
      if (!c) return false;
      this.chunk = c;
    }
    this.index = cellIndex(x & 15, y, z & 15);
    return true;
  }

  private pushAdd(x: number, y: number, z: number): void {
    if (this.addTail + 3 > this.add.length) {
      const bigger = new Int32Array(this.add.length * 2);
      bigger.set(this.add);
      this.add = bigger;
    }
    this.add[this.addTail++] = x; this.add[this.addTail++] = y; this.add[this.addTail++] = z;
  }

  private pushGone(x: number, y: number, z: number, level: number): void {
    if (this.goneTail + 4 > this.gone.length) {
      const bigger = new Int32Array(this.gone.length * 2);
      bigger.set(this.gone);
      this.gone = bigger;
    }
    this.gone[this.goneTail++] = x; this.gone[this.goneTail++] = y; this.gone[this.goneTail++] = z; this.gone[this.goneTail++] = level;
  }

  private spread(shift: number): void {
    let head = 0;
    while (head < this.addTail) {
      const x = this.add[head++], y = this.add[head++], z = this.add[head++];
      if (!this.locate(x, y, z)) continue;
      const v = (this.chunk!.light[this.index] >> shift) & 15;
      if (v <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (!this.locate(nx, ny, nz)) continue;
        const c = this.chunk!, i = this.index;
        if (OPAQUE[c.blocks[i]]) continue;
        const level = shift === SKY && d === DOWN && v === 15 ? 15 : v - 1;
        if (((c.light[i] >> shift) & 15) >= level) continue;
        c.light[i] = (c.light[i] & ~(15 << shift)) | (level << shift);
        this.touch(nx, nz);
        this.pushAdd(nx, ny, nz);
      }
    }
    this.addTail = 0;
  }

  private darken(shift: number): void {
    let head = 0;
    while (head < this.goneTail) {
      const x = this.gone[head++], y = this.gone[head++], z = this.gone[head++], v = this.gone[head++];
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (!this.locate(nx, ny, nz)) continue;
        const c = this.chunk!, i = this.index;
        const cur = (c.light[i] >> shift) & 15;
        if (cur === 0) continue;
        if (cur < v || (shift === SKY && d === DOWN && v === 15)) {
          // This cell was lit through the one that went dark. A lamp here keeps its own light.
          const own = shift === BLOCK ? EMIT[c.blocks[i]] : 0;
          c.light[i] = (c.light[i] & ~(15 << shift)) | (own << shift);
          this.touch(nx, nz);
          this.pushGone(nx, ny, nz, cur);
          if (own > 0) this.pushAdd(nx, ny, nz);
        } else {
          this.pushAdd(nx, ny, nz);
        }
      }
    }
    this.goneTail = 0;
  }

  private clear(x: number, y: number, z: number, shift: number): void {
    if (!this.locate(x, y, z)) return;
    const c = this.chunk!, i = this.index;
    const cur = (c.light[i] >> shift) & 15;
    if (cur === 0) return;
    c.light[i] &= ~(15 << shift);
    this.touch(x, z);
    this.pushGone(x, y, z, cur);
    this.darken(shift);
    this.spread(shift);
  }

  /** Relights around one cell after its block changed from `oldId` to `newId`. The block is already written. */
  blockChanged(x: number, y: number, z: number, oldId: number, newId: number): void {
    this.touch(x, z);
    if (EMIT[oldId] > 0) this.clear(x, y, z, BLOCK);
    if (OPAQUE[newId]) {
      this.clear(x, y, z, BLOCK);
      this.clear(x, y, z, SKY);
    } else if (OPAQUE[oldId]) {
      // The cell opened up: light flows in from the six cells around it.
      for (const shift of [SKY, BLOCK]) {
        if (shift === SKY && y === HEIGHT - 1 && this.locate(x, y, z)) {
          this.chunk!.light[this.index] |= 15 << SKY;
          this.pushAdd(x, y, z);
        }
        for (let d = 0; d < 6; d++) this.pushAdd(x + DX[d], y + DY[d], z + DZ[d]);
        this.spread(shift);
      }
    }
    if (EMIT[newId] > 0 && this.locate(x, y, z)) {
      const c = this.chunk!, i = this.index;
      c.light[i] = (c.light[i] & ~15) | EMIT[newId];
      this.pushAdd(x, y, z);
      this.spread(BLOCK);
    }
  }

  /** Lets light cross the four edges of a chunk that was lit alone, in both directions. */
  stitch(chunk: Chunk): void {
    const ox = chunk.cx * CHUNK, oz = chunk.cz * CHUNK;
    for (const shift of [SKY, BLOCK]) {
      for (let side = 0; side < 4; side++) {
        const other = this.chunkAt(chunk.cx + DX[side < 2 ? side : 4], chunk.cz + (side < 2 ? 0 : DZ[side + 2]));
        if (!other) continue;
        for (let t = 0; t < CHUNK; t++) {
          // `a` is the edge cell on our side, `b` the cell it touches on the other side.
          const ax = side === 0 ? CHUNK - 1 : side === 1 ? 0 : t, az = side === 2 ? CHUNK - 1 : side === 3 ? 0 : t;
          const bx = side === 0 ? 0 : side === 1 ? CHUNK - 1 : t, bz = side === 2 ? 0 : side === 3 ? CHUNK - 1 : t;
          const ai = cellIndex(ax, 0, az), bi = cellIndex(bx, 0, bz);
          for (let y = 0; y < HEIGHT; y++) {
            const la = (chunk.light[ai + y] >> shift) & 15, lb = (other.light[bi + y] >> shift) & 15;
            if (la > lb + 1) this.pushAdd(ox + ax, y, oz + az);
            else if (lb > la + 1) this.pushAdd(other.cx * CHUNK + bx, y, other.cz * CHUNK + bz);
          }
        }
      }
      this.spread(shift);
    }
  }
}
