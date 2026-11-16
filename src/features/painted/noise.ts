// Smooth value noise for the painted world: where a meadow's greens drift, where grass grows tall, where a
// marsh has its pools. The same numbers in the page and in a test.

function hash(ix: number, iy: number, seed: number): number {
  let n = (ix * 73856093) ^ (iy * 19349663) ^ (seed * 83492791);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Layered noise between 0 and 1. */
export function fbm(x: number, y: number, octaves: number, seed: number): number {
  let sum = 0, amp = 0.5, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(x * freq, y * freq, seed + i * 17); total += amp; amp *= 0.5; freq *= 2; }
  return sum / total;
}
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

