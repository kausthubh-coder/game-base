// Turns one chunk of blocks into triangles. It runs in a worker. Hidden faces are skipped, faces
// that look the same merge into large quads, corners are shaded where blocks meet, and light is baked
// per vertex. Water goes to its own mesh because it is see-through.
//
// A vertex is 9 bytes: position (3), info (4: face and flags, tile layer, variant count, corner
// shade 0 to 3) and light (2: sky and block, 0 to 255).
import { BLOCKS } from '../../content/blocks.ts';
import { CHUNK, HEIGHT, LIQUID, OPAQUE, PAD } from './chunk.sim.ts';

export interface MeshArrays {
  positions: Uint8Array;
  info: Uint8Array;
  light: Uint8Array;
  /**
   * Faces the sky's light reaches come first, then the deep ones: faces with no sky light at any
   * corner, which only show when the camera cuts into the ground. `surface` is how many indices the
   * first part has, so the world can leave the deep part out of the draw.
   */
  indices: Uint16Array | Uint32Array;
  surface: number;
  quads: number;
  /** The lowest and highest y of the vertices, and the lowest of the surface part alone. */
  low: number;
  high: number;
  surfaceLow: number;
}

export interface ChunkMesh {
  solid: MeshArrays | null;
  water: MeshArrays | null;
  /** Visible block faces before merging. */
  faces: number;
  minY: number;
  maxY: number;
}

/** Info flag bits, stored above the face number as `face + 8 * flags`. */
export const FLAG_GLOW = 1;
export const FLAG_WATER_TOP = 2;

/**
 * For each block id, six bytes: the tile layer and variant count of its top, side and bottom face.
 * The atlas fills it, because only the atlas knows where a tile ended up.
 */
export type TileTable = Uint8Array;
export const TILE_TABLE_SIZE = 256 * 6;

// The mesher works on its own copy of the padded chunk with one more layer below (solid, dark) and
// above (open sky), so no neighbor lookup needs a bounds check.
const TALL = HEIGHT + 2;
const SX = PAD * TALL, SZ = TALL, SY = 1;
const BASE = (PAD + 1) * TALL + 1;
const WALL = 255;
const ids = new Uint8Array(PAD * PAD * TALL);
const lit = new Uint8Array(PAD * PAD * TALL);
const OPQ = new Uint8Array(256);
const GLOW = new Uint8Array(256);
/** 1 for a block with no tile on any face, such as the barrier inside a station. It is skipped like air. */
const UNSEEN = new Uint8Array(256);
OPQ.set(OPAQUE);
OPQ[WALL] = 1;
for (const b of BLOCKS) {
  GLOW[b.id] = b.glows ? 1 : 0;
  UNSEEN[b.id] = b.id !== 0 && !b.tiles.top && !b.tiles.side && !b.tiles.bottom ? 1 : 0;
}

const STRIDE = [SX, SY, SZ];
const SIZE = [CHUNK, HEIGHT, CHUNK];
// One slice of faces waiting to be merged: what the face looks like, and the light of its four corners.
const mask = new Int32Array(CHUNK * HEIGHT), maskSky = new Int32Array(CHUNK * HEIGHT), maskBlk = new Int32Array(CHUNK * HEIGHT);
const ALONG_U = 1 << 11, ALONG_V = 1 << 12, WATER = 1 << 21;
const cAo = new Uint8Array(4), cSky = new Uint8Array(4), cBlk = new Uint8Array(4);
const p = [0, 0, 0];

class Builder {
  private pos = new Uint8Array(3 << 12);
  private info = new Uint8Array(4 << 12);
  private light = new Uint8Array(2 << 12);
  private idx = new Uint32Array(6 << 10);
  private deep = new Uint32Array(6 << 10);
  private verts = 0;
  private indices = 0;
  private deepIndices = 0;
  low = HEIGHT;
  high = 0;
  private surfaceLow = HEIGHT;

  reset(): void {
    this.verts = 0;
    this.indices = 0;
    this.deepIndices = 0;
    this.low = HEIGHT;
    this.high = 0;
    this.surfaceLow = HEIGHT;
  }

  /** One quad on the plane `plane` of the face direction `d`, from (u0, v0) with size (w, h). Corner values come from cAo, cSky, cBlk. */
  quad(d: number, plane: number, u0: number, v0: number, w: number, h: number, layer: number, variants: number, flags: number, topFlags: number): void {
    if ((this.verts + 4) * 3 > this.pos.length) {
      const grow = (a: Uint8Array): Uint8Array<ArrayBuffer> => {
        const bigger = new Uint8Array(a.length * 2);
        bigger.set(a);
        return bigger;
      };
      this.pos = grow(this.pos); this.info = grow(this.info); this.light = grow(this.light);
    }
    const isDeep = (cSky[0] | cSky[1] | cSky[2] | cSky[3]) === 0;
    let x = isDeep ? this.deep : this.idx;
    const i = isDeep ? this.deepIndices : this.indices;
    if (i + 6 > x.length) {
      const bigger = new Uint32Array(x.length * 2);
      bigger.set(x);
      x = bigger;
      if (isDeep) this.deep = x; else this.idx = x;
    }
    const an = d >> 1, au = d < 2 ? 2 : 0, av = d >= 2 && d < 4 ? 2 : 1;
    const first = this.verts;
    let low = HEIGHT;
    for (let c = 0; c < 4; c++) {
      const cu = c === 1 || c === 2 ? 1 : 0, cv = c >= 2 ? 1 : 0;
      p[an] = plane; p[au] = u0 + cu * w; p[av] = v0 + cv * h;
      const v = this.verts++;
      this.pos[v * 3] = p[0]; this.pos[v * 3 + 1] = p[1]; this.pos[v * 3 + 2] = p[2];
      this.info[v * 4] = d + 8 * (cv ? topFlags : flags); this.info[v * 4 + 1] = layer; this.info[v * 4 + 2] = variants; this.info[v * 4 + 3] = cAo[c];
      this.light[v * 2] = cSky[c]; this.light[v * 2 + 1] = cBlk[c];
      if (p[1] < low) low = p[1];
      if (p[1] > this.high) this.high = p[1];
    }
    if (low < this.low) this.low = low;
    if (!isDeep && low < this.surfaceLow) this.surfaceLow = low;
    // Wind the triangles to face outward, and split the quad along its brighter diagonal so a
    // shaded corner looks the same from every side.
    const reversed = d === 0 || d === 2 || d === 5;
    const q0 = cAo[0] * 64 + cSky[0] + cBlk[0], q1 = cAo[1] * 64 + cSky[1] + cBlk[1];
    const q2 = cAo[2] * 64 + cSky[2] + cBlk[2], q3 = cAo[3] * 64 + cSky[3] + cBlk[3];
    const a = q0 + q2 < q1 + q3 ? 1 : 0;
    x[i] = first + a; x[i + 3] = first + a;
    if (reversed) {
      x[i + 1] = first + ((a + 2) & 3); x[i + 2] = first + ((a + 1) & 3);
      x[i + 4] = first + ((a + 3) & 3); x[i + 5] = first + ((a + 2) & 3);
    } else {
      x[i + 1] = first + ((a + 1) & 3); x[i + 2] = first + ((a + 2) & 3);
      x[i + 4] = first + ((a + 2) & 3); x[i + 5] = first + ((a + 3) & 3);
    }
    if (isDeep) this.deepIndices += 6; else this.indices += 6;
  }

  take(): MeshArrays | null {
    if (this.verts === 0) return null;
    const total = this.indices + this.deepIndices;
    const indices = this.verts > 65535 ? new Uint32Array(total) : new Uint16Array(total);
    indices.set(this.idx.subarray(0, this.indices));
    indices.set(this.deep.subarray(0, this.deepIndices), this.indices);
    return {
      positions: this.pos.slice(0, this.verts * 3),
      info: this.info.slice(0, this.verts * 4),
      light: this.light.slice(0, this.verts * 2),
      indices,
      surface: this.indices,
      quads: this.verts / 4,
      low: this.low,
      high: this.high,
      surfaceLow: Math.min(this.surfaceLow, this.high),
    };
  }
}

const solid = new Builder(), water = new Builder();

/** Shade and light of one corner of a face, read from the four cells in front of the face that touch it. */
function corner(c: number, f: number, ou: number, ov: number): void {
  const o1 = OPQ[ids[f + ou]], o2 = OPQ[ids[f + ov]], o3 = OPQ[ids[f + ou + ov]];
  let l = lit[f], sky = l >> 4, blk = l & 15, n = 1;
  if (!o1) { l = lit[f + ou]; sky += l >> 4; blk += l & 15; n++; }
  if (!o2) { l = lit[f + ov]; sky += l >> 4; blk += l & 15; n++; }
  if (!o3 && !(o1 && o2)) { l = lit[f + ou + ov]; sky += l >> 4; blk += l & 15; n++; }
  cAo[c] = o1 && o2 ? 0 : 3 - o1 - o2 - o3;
  cSky[c] = Math.round((sky * 17) / n);
  cBlk[c] = Math.round((blk * 17) / n);
}

/**
 * Meshes one chunk. `blocks` and `light` are the padded copies from `World.snapshot`.
 */
export function meshChunk(blocks: Uint8Array, light: Uint8Array, tiles: TileTable): ChunkMesh {
  for (let col = 0; col < PAD * PAD; col++) {
    const to = col * TALL, from = col * HEIGHT;
    ids[to] = WALL; lit[to] = 0;
    for (let y = 0; y < HEIGHT; y++) { ids[to + 1 + y] = blocks[from + y]; lit[to + 1 + y] = light[from + y]; }
    ids[to + TALL - 1] = 0; lit[to + TALL - 1] = 0xf0;
  }
  solid.reset();
  water.reset();
  let faces = 0;

  for (let d = 0; d < 6; d++) {
    const an = d >> 1, au = d < 2 ? 2 : 0, av = d >= 2 && d < 4 ? 2 : 1;
    const sn = STRIDE[an], su = STRIDE[au], sv = STRIDE[av];
    const nn = SIZE[an], nu = SIZE[au], nv = SIZE[av];
    const step = d & 1 ? -sn : sn;
    const group = d === 2 ? 0 : d === 3 ? 4 : 2;

    for (let s = 0; s < nn; s++) {
      const plane = d & 1 ? s : s + 1;
      let any = false;
      for (let v = 0; v < nv; v++) {
        for (let u = 0; u < nu; u++) {
          const i = BASE + s * sn + u * su + v * sv, m = v * nu + u;
          const b = ids[i];
          let key = 0;
          if (b !== 0 && !UNSEEN[b]) {
            const f = i + step, nb = ids[f];
            if (LIQUID[b]) {
              if (nb !== b && !OPQ[nb]) {
                faces++;
                const l = lit[f], sky = (l >> 4) * 17, blk = (l & 15) * 17;
                if (d === 2) {
                  key = tiles[b * 6] | (1 << 8) | ALONG_U | ALONG_V | (0xff << 13) | WATER;
                  maskSky[m] = sky * 0x01010101; maskBlk[m] = blk * 0x01010101;
                } else {
                  cAo.fill(3); cSky.fill(sky); cBlk.fill(blk);
                  const open = d !== 3 && !LIQUID[ids[i + SY]];
                  water.quad(d, plane, u, v, 1, 1, tiles[b * 6 + group], 1, 0, open ? FLAG_WATER_TOP : 0);
                }
              }
            } else if (nb !== b && !OPQ[nb]) {
              faces++;
              corner(0, f, -su, -sv); corner(1, f, su, -sv); corner(2, f, su, sv); corner(3, f, -su, sv);
              const layer = tiles[b * 6 + group], variants = tiles[b * 6 + group + 1], glow = GLOW[b];
              // A face may join its neighbor along one direction when its shade and light do not
              // change along that direction: then one long quad draws exactly the same picture.
              const alongU = cAo[0] === cAo[1] && cAo[3] === cAo[2] && cSky[0] === cSky[1] && cSky[3] === cSky[2] && cBlk[0] === cBlk[1] && cBlk[3] === cBlk[2];
              const alongV = cAo[0] === cAo[3] && cAo[1] === cAo[2] && cSky[0] === cSky[3] && cSky[1] === cSky[2] && cBlk[0] === cBlk[3] && cBlk[1] === cBlk[2];
              if (alongU || alongV) {
                key = layer | (variants << 8) | (glow << 10) | (alongU ? ALONG_U : 0) | (alongV ? ALONG_V : 0)
                  | (cAo[0] << 13) | (cAo[1] << 15) | (cAo[2] << 17) | (cAo[3] << 19);
                maskSky[m] = cSky[0] | (cSky[1] << 8) | (cSky[2] << 16) | (cSky[3] << 24);
                maskBlk[m] = cBlk[0] | (cBlk[1] << 8) | (cBlk[2] << 16) | (cBlk[3] << 24);
              } else {
                solid.quad(d, plane, u, v, 1, 1, layer, variants, glow, glow);
              }
            }
          }
          mask[m] = key;
          if (key !== 0) any = true;
        }
      }
      if (!any) continue;

      // Merge runs of equal faces into rectangles.
      for (let v = 0; v < nv; v++) {
        for (let u = 0; u < nu;) {
          const m = v * nu + u, key = mask[m];
          if (key === 0) { u++; continue; }
          const sky = maskSky[m], blk = maskBlk[m];
          let w = 1, h = 1;
          if (key & ALONG_U) while (u + w < nu && mask[m + w] === key && maskSky[m + w] === sky && maskBlk[m + w] === blk) w++;
          if (key & ALONG_V) {
            grow: while (v + h < nv) {
              for (let k = 0, n = m + h * nu; k < w; k++, n++) if (mask[n] !== key || maskSky[n] !== sky || maskBlk[n] !== blk) break grow;
              h++;
            }
          }
          for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) mask[m + j * nu + k] = 0;
          for (let c = 0; c < 4; c++) { cAo[c] = (key >> (13 + c * 2)) & 3; cSky[c] = (sky >> (c * 8)) & 255; cBlk[c] = (blk >> (c * 8)) & 255; }
          if (key & WATER) water.quad(d, plane, u, v, w, h, key & 255, 1, FLAG_WATER_TOP, FLAG_WATER_TOP);
          else solid.quad(d, plane, u, v, w, h, key & 255, (key >> 8) & 3, (key >> 10) & 1, (key >> 10) & 1);
          u += w;
        }
      }
    }
  }

  return {
    solid: solid.take(),
    water: water.take(),
    faces,
    minY: Math.min(solid.low, water.low),
    maxY: Math.max(solid.high, water.high),
  };
}
