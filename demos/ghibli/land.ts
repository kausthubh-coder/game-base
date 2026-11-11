// The shape of the test scene's land: rolling meadow, a knoll for the great tree, a hill with a flat top
// for the cottage, a pond, a path between them and higher hills round the edge. Everything else asks this
// file where the ground is and what colour it has.
import * as THREE from 'three';
import { paint } from './paint.ts';
import type { Textures } from './textures.ts';

/** Meters along one side of the land. */
export const SIZE = 290;
export const GREAT_TREE = { x: -25, z: -16 };
export const HOUSE = { x: 30, z: -50, turn: -0.5 };
export const POND = { x: 22, z: 9, radius: 13 };
/** A tree that stands alone on the pond's near bank, to judge one tree against a reference. */
export const SPECIMEN = { x: 19, z: 30 };

function hash(ix: number, iy: number, seed: number): number {
  let n = (ix * 73856093) ^ (iy * 19349663) ^ (seed * 83492791);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function noise(x: number, y: number, seed = 0): number {
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

function rolling(x: number, z: number): number {
  let h = (fbm(x / 72, z / 72, 3, 1) - 0.5) * 10 + (fbm(x / 23, z / 23, 2, 5) - 0.5) * 1.5;
  const dTree = ((x - GREAT_TREE.x) ** 2 + (z - GREAT_TREE.z) ** 2) / (25 * 25);
  h += 6.5 * Math.exp(-dTree * 1.6);
  h += 9 * (1 - smoothstep(8, 42, Math.hypot(x - HOUSE.x, z - HOUSE.z)));
  const edge = smoothstep(72, 140, Math.hypot(x, z + 8));
  return h + edge * edge * (9 + 20 * fbm(x / 64, z / 64, 2, 9));
}

const HOUSE_Y = rolling(HOUSE.x, HOUSE.z);
/** The height of the pond's surface. */
export const WATER_Y = rolling(POND.x, POND.z) - 0.5;

export function heightAt(x: number, z: number): number {
  let h = rolling(x, z);
  const flat = 1 - smoothstep(6.5, 13, Math.hypot(x - HOUSE.x, z - HOUSE.z));
  h += (HOUSE_Y - h) * flat;
  const dPond = Math.hypot(x - POND.x, z - POND.z) + (noise(x / 5, z / 5, 61) - 0.5) * 4;
  const basin = 1 - smoothstep(POND.radius * 0.7, POND.radius * 1.5, dPond);
  const bed = dPond < POND.radius ? WATER_Y - 1.9 * (1 - (dPond / POND.radius) ** 2) : WATER_Y + (dPond - POND.radius) * 0.16;
  return h + (bed - h) * basin;
}

// ---------------------------------------------------------------- the path

function spline(points: Array<[number, number]>, steps: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const at = (i: number): [number, number] => points[Math.min(points.length - 1, Math.max(0, i))] as [number, number];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k]! + (p2[k]! - p0[k]!) * t + (2 * p0[k]! - 5 * p1[k]! + 4 * p2[k]! - p3[k]!) * t2 + (3 * p1[k]! - p0[k]! - 3 * p2[k]! + p3[k]!) * t3)) as [number, number]);
    }
  }
  out.push(at(points.length - 1));
  return out;
}

/** The path from the foreground to the cottage door, and a side path to the great tree. */
const PATHS: Array<{ points: Array<[number, number]>; width: number }> = [
  { points: spline([[5, 70], [3, 46], [0, 30], [-7, 14], [-5, -3], [6, -19], [16, -33], [23, -41], [27, -46]], 8), width: 1.5 },
  { points: spline([[-6, 0], [-12, -5], [-17, -9], [-20, -12]], 6), width: 0.9 },
];

/** Meters from the nearest path's edge. Negative on the path. */
export function pathEdge(x: number, z: number): number {
  let best = Infinity;
  for (const { points, width } of PATHS) {
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i] as [number, number], [bx, bz] = points[i + 1] as [number, number];
      const dx = bx - ax, dz = bz - az;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t) - width);
    }
  }
  return best;
}

// ---------------------------------------------------------------- colour

const hex = (h: string): THREE.Color => new THREE.Color(h);
const C = {
  light: hex('#a9d05a'), mid: hex('#88bd50'), deep: hex('#5c9c4a'), straw: hex('#c6cb72'), hill: hex('#4f9150'),
  path: hex('#e0c898'), pathEdge: hex('#c4a570'), shore: hex('#c9bb8c'), bed: hex('#7f9a86'),
};

/** How much of the ground at a spot is path, shore or water, from 0 to 1. Grass and trees stay off it. */
export function bare(x: number, z: number): number {
  const path = 1 - smoothstep(-0.2, 0.7, pathEdge(x, z) + (noise(x * 1.1, z * 1.1, 71) - 0.5) * 0.9);
  const shore = 1 - smoothstep(WATER_Y + 0.08, WATER_Y + 0.45, heightAt(x, z));
  return Math.max(path, shore);
}

/** The ground's painted colour at a spot. */
export function groundColor(x: number, z: number, out: THREE.Color): THREE.Color {
  out.copy(C.mid).lerp(C.light, smoothstep(0.35, 0.68, fbm(x / 36, z / 36, 3, 21)));
  out.lerp(C.deep, smoothstep(0.5, 0.78, fbm(x / 10, z / 10, 2, 33)) * 0.55);
  out.lerp(C.straw, smoothstep(0.6, 0.78, fbm(x / 52, z / 52, 2, 44)) * 0.5);
  out.lerp(C.hill, smoothstep(80, 130, Math.hypot(x, z + 8)) * 0.8);
  const edge = pathEdge(x, z) + (noise(x * 1.1, z * 1.1, 71) - 0.5) * 0.9;
  out.lerp(C.pathEdge, 1 - smoothstep(-0.1, 0.9, edge));
  out.lerp(C.path, 1 - smoothstep(-0.9, -0.1, edge));
  const h = heightAt(x, z);
  out.lerp(C.shore, 1 - smoothstep(WATER_Y + 0.05, WATER_Y + 0.5, h));
  out.lerp(C.bed, 1 - smoothstep(WATER_Y - 1.2, WATER_Y - 0.1, h));
  return out;
}

// ---------------------------------------------------------------- the mesh

export function createLand(textures: Textures): THREE.Mesh {
  const cells = 170, side = cells + 1, step = SIZE / cells;
  const positions = new Float32Array(side * side * 3), normals = new Float32Array(side * side * 3), colors = new Float32Array(side * side * 3);
  const color = new THREE.Color(), normal = new THREE.Vector3();
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const x = -SIZE / 2 + i * step, z = -SIZE / 2 + j * step, k = (j * side + i) * 3;
      positions[k] = x; positions[k + 1] = heightAt(x, z); positions[k + 2] = z;
      normal.set(heightAt(x - 0.5, z) - heightAt(x + 0.5, z), 1, heightAt(x, z - 0.5) - heightAt(x, z + 0.5)).normalize();
      normals[k] = normal.x; normals[k + 1] = normal.y; normals[k + 2] = normal.z;
      groundColor(x, z, color);
      colors[k] = color.r; colors[k + 1] = color.g; colors[k + 2] = color.b;
    }
  }
  const index = new Uint32Array(cells * cells * 6);
  for (let j = 0, n = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * side + i, b = a + 1, c = a + side, d = c + 1;
      index[n++] = a; index[n++] = c; index[n++] = b; index[n++] = b; index[n++] = c; index[n++] = d;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  const material = paint({
    vertexColors: true, brush: 0.3, bands: 0.3, wrap: 0.25, brushScale: 0.06, dapple: 1,
    uniforms: { uGround: { value: textures.ground }, uGroundMean: { value: textures.groundMean } },
    fragmentPars: 'uniform sampler2D uGround; uniform vec3 uGroundMean;',
    // The painted meadow texture at two sizes, divided by its own average: it varies the colour, it does not tint it.
    fragmentAlbedo: /* glsl */ `
      vec3 dabs = texture2D(uGround, vPaintWorld.xz * 0.13).rgb * 0.55 + texture2D(uGround, vPaintWorld.xz * 0.031 + 0.37).rgb * 0.45;
      diffuseColor.rgb *= mix(vec3(1.0), dabs / uGroundMean, 0.5);`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'land';
  mesh.receiveShadow = true;
  return mesh;
}

/** Ground heights round the pond as a texture, so the water knows how deep it is. */
export function pondDepthTexture(): { texture: THREE.DataTexture; min: THREE.Vector2; size: number } {
  const n = 96, size = POND.radius * 3.4, data = new Float32Array(n * n);
  const min = new THREE.Vector2(POND.x - size / 2, POND.z - size / 2);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = WATER_Y - heightAt(min.x + ((i + 0.5) / n) * size, min.y + ((j + 0.5) / n) * size);
  const texture = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.FloatType);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, min, size };
}
