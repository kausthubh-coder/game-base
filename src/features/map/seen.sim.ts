// Which parts of the world the player has seen. The world is cut into cells of 8 by 8 blocks, and a
// cell is seen or it is not. Cells are kept in chunks of 16 by 16 cells, one bit each, so a whole
// explored region is a few kilobytes and a save is small.

/** Blocks along one side of a cell. */
export const SEEN_CELL = 8;
/** Cells along one side of a chunk. */
export const SEEN_CHUNK = 16;
/** Blocks along one side of a chunk. */
export const SEEN_CHUNK_BLOCKS = SEEN_CELL * SEEN_CHUNK;

const BYTES = (SEEN_CHUNK * SEEN_CHUNK) / 8;
const OFFSET = 32768;

/** One number for a chunk's place, so a lookup makes no string. Good for 4 million blocks either way. */
export function chunkKey(chunkX: number, chunkZ: number): number {
  return (chunkX + OFFSET) * 65536 + (chunkZ + OFFSET);
}
export function chunkXOf(key: number): number {
  return Math.floor(key / 65536) - OFFSET;
}
export function chunkZOf(key: number): number {
  return (key % 65536) - OFFSET;
}

export interface SeenSave {
  cell: number;
  /** One entry per chunk: its x, its z and its bits as base64. */
  chunks: [number, number, string][];
}

export class SeenCells {
  /** The bits of each chunk that has a seen cell, by `chunkKey`. */
  readonly chunks = new Map<number, Uint8Array>();
  /** How many cells are seen. */
  count = 0;
  /** Goes up every time a new cell is seen. A drawing compares it to know when to redraw. */
  version = 0;
  /** Called for each chunk that gains a cell in a `reveal`. It can be called more than once for the same chunk. */
  onChange: ((chunkX: number, chunkZ: number) => void) | null = null;

  private lastCellX = NaN;
  private lastCellZ = NaN;
  private lastRadius = NaN;

  /** True when the cell that holds this block has been seen. */
  isSeen(x: number, z: number): boolean {
    return this.cellSeen(Math.floor(x / SEEN_CELL), Math.floor(z / SEEN_CELL));
  }

  cellSeen(cellX: number, cellZ: number): boolean {
    const bits = this.chunks.get(chunkKey(cellX >> 4, cellZ >> 4));
    if (!bits) return false;
    const i = (cellZ & 15) * SEEN_CHUNK + (cellX & 15);
    return (bits[i >> 3] & (1 << (i & 7))) !== 0;
  }

  /**
   * Marks every cell whose middle is within `radius` blocks of a point. Call it every frame with
   * the player's position: it does no work until the player crosses into another cell. Returns how
   * many cells are new.
   */
  reveal(x: number, z: number, radius: number): number {
    const cellX = Math.floor(x / SEEN_CELL), cellZ = Math.floor(z / SEEN_CELL);
    if (cellX === this.lastCellX && cellZ === this.lastCellZ && radius === this.lastRadius) return 0;
    this.lastCellX = cellX; this.lastCellZ = cellZ; this.lastRadius = radius;

    // Measured from the middle of the player's cell, so the seen shape does not depend on where in the cell they stand.
    const midX = (cellX + 0.5) * SEEN_CELL, midZ = (cellZ + 0.5) * SEEN_CELL;
    const reach = Math.ceil(radius / SEEN_CELL);
    let added = 0;
    let lastChunk = NaN;
    for (let cz = cellZ - reach; cz <= cellZ + reach; cz++) {
      for (let cx = cellX - reach; cx <= cellX + reach; cx++) {
        const dx = (cx + 0.5) * SEEN_CELL - midX, dz = (cz + 0.5) * SEEN_CELL - midZ;
        if (dx * dx + dz * dz > radius * radius) continue;
        const key = chunkKey(cx >> 4, cz >> 4);
        let bits = this.chunks.get(key);
        if (!bits) {
          bits = new Uint8Array(BYTES);
          this.chunks.set(key, bits);
        }
        const i = (cz & 15) * SEEN_CHUNK + (cx & 15);
        const mask = 1 << (i & 7);
        if (bits[i >> 3] & mask) continue;
        bits[i >> 3] |= mask;
        added++;
        if (key !== lastChunk) {
          lastChunk = key;
          this.onChange?.(cx >> 4, cz >> 4);
        }
      }
    }
    if (added > 0) {
      this.count += added;
      this.version++;
    }
    return added;
  }

  /** Forgets everything. */
  clear(): void {
    this.chunks.clear();
    this.count = 0;
    this.version++;
    this.lastCellX = this.lastCellZ = this.lastRadius = NaN;
  }

  save(): SeenSave {
    const chunks: SeenSave['chunks'] = [];
    for (const [key, bits] of this.chunks) chunks.push([chunkXOf(key), chunkZOf(key), btoa(String.fromCharCode(...bits))]);
    return { cell: SEEN_CELL, chunks };
  }

  /** Replaces what is seen with a save. Returns false, and forgets everything, when the save is not one this version can read. */
  load(save: unknown): boolean {
    this.clear();
    const data = save as Partial<SeenSave> | null;
    if (!data || data.cell !== SEEN_CELL || !Array.isArray(data.chunks)) return false;
    for (const entry of data.chunks) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'number' || typeof entry[1] !== 'number' || typeof entry[2] !== 'string') continue;
      let text: string;
      try {
        text = atob(entry[2]);
      } catch {
        continue;
      }
      if (text.length !== BYTES) continue;
      const bits = new Uint8Array(BYTES);
      for (let i = 0; i < BYTES; i++) {
        bits[i] = text.charCodeAt(i);
        for (let b = bits[i]; b; b &= b - 1) this.count++;
      }
      this.chunks.set(chunkKey(entry[0], entry[1]), bits);
    }
    this.version++;
    return true;
  }
}
