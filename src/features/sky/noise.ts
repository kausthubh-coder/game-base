// One small tiling noise image, made once. The sky reads it for both cloud layers and the sun's shadow reads it
// for the shadows of the clouds, so clouds cost a few texture reads a pixel and no noise math in the shader.

function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Value noise that repeats every `period` cells. */
function valueNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const wrap = (v: number) => ((v % period) + period) % period;
  const a = hash(wrap(xi), wrap(yi), seed);
  const b = hash(wrap(xi + 1), wrap(yi), seed);
  const c = hash(wrap(xi), wrap(yi + 1), seed);
  const d = hash(wrap(xi + 1), wrap(yi + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function layered(x: number, y: number, period: number, seed: number, octaves: number): number {
  let value = 0;
  let weight = 0.5;
  let scale = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += weight * valueNoise(x * scale, y * scale, period * scale, seed + i * 17);
    total += weight;
    weight *= 0.5;
    scale *= 2;
  }
  return value / total;
}

/**
 * RGBA bytes for a `size` by `size` image that tiles. Red is big soft shapes, green is a second set with finer
 * detail, blue is another set for the thin high layer. Each is stretched to use the whole 0 to 255 range.
 */
export function cloudNoise(size = 128): Uint8Array<ArrayBuffer> {
  const channels = [
    { period: 4, seed: 11, octaves: 4 },
    { period: 5, seed: 47, octaves: 4 },
    { period: 4, seed: 83, octaves: 3 },
  ];
  const out = new Uint8Array(size * size * 4);
  const values = new Float32Array(size * size);
  channels.forEach((channel, index) => {
    let low = Infinity;
    let high = -Infinity;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = layered((x / size) * channel.period, (y / size) * channel.period, channel.period, channel.seed, channel.octaves);
        values[y * size + x] = v;
        if (v < low) low = v;
        if (v > high) high = v;
      }
    }
    for (let i = 0; i < size * size; i++) out[i * 4 + index] = Math.round(((values[i] - low) / (high - low)) * 255);
  });
  for (let i = 0; i < size * size; i++) out[i * 4 + 3] = 255;
  return out;
}
