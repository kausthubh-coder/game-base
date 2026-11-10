// Seeded hashes and value noise. Pure numbers, so the same seed gives the same land on any machine.

/** An integer hash of up to three integers and a seed, 0 to 1. */
export function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const hash2 = (x: number, z: number, seed: number): number => hash3(x, 0, z, seed);

const fade = (t: number): number => t * t * (3 - 2 * t);

/** Smooth value noise in two dimensions, 0 to 1. */
export function noise2(x: number, z: number, seed: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const fx = fade(x - xi), fz = fade(z - zi);
  const a = hash3(xi, 0, zi, seed), b = hash3(xi + 1, 0, zi, seed);
  const c = hash3(xi, 0, zi + 1, seed), d = hash3(xi + 1, 0, zi + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Smooth value noise in three dimensions, 0 to 1. */
export function noise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = fade(x - xi), fy = fade(y - yi), fz = fade(z - zi);
  const a0 = hash3(xi, yi, zi, seed), b0 = hash3(xi + 1, yi, zi, seed);
  const c0 = hash3(xi, yi, zi + 1, seed), d0 = hash3(xi + 1, yi, zi + 1, seed);
  const a1 = hash3(xi, yi + 1, zi, seed), b1 = hash3(xi + 1, yi + 1, zi, seed);
  const c1 = hash3(xi, yi + 1, zi + 1, seed), d1 = hash3(xi + 1, yi + 1, zi + 1, seed);
  const low = a0 + (b0 - a0) * fx + (c0 - a0) * fz + (a0 - b0 - c0 + d0) * fx * fz;
  const high = a1 + (b1 - a1) * fx + (c1 - a1) * fz + (a1 - b1 - c1 + d1) * fx * fz;
  return low + (high - low) * fy;
}

/** Layered noise2, 0 to 1. */
export function fbm2(x: number, z: number, seed: number, octaves = 3): number {
  let sum = 0, amp = 0.5, total = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f, z * f, seed + i * 101);
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / total;
}

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export function smoothstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
