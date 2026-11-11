// The water of the painted world: ponds, rivers and anything the player floods. The rules keep water as
// blocks. Here it is one smooth sheet per chunk at the water's own level, drawn a little way past the last
// water block, so the land rises through it and the shore is the land's own curve and not a row of squares.
//
// Everything comes from how deep the water is at a spot: its colour from shallow to deep, how much of the bed
// shows through, the pale line that breathes where it meets the bank, and where the painted ripples slide.
// The sky lies on it, more of it the flatter you look across. Rings spread from feet and from rain.
import * as THREE from 'three';
import { BLOCKS } from '../../content/blocks.ts';
import type { Land, LandBlocks } from './land.ts';
import { FRAGMENT_PARS, shared } from './paint.ts';

export interface WaterLook {
  /** The water's colour over a shallow bed and over a deep one, and the colour of foam. sRGB hex. */
  shallow: string;
  deep: string;
  foam: string;
}

/** Rings on the water that something else starts: each is x, z, the time it began and its strength. `time` is the clock they are read against. */
export interface WaterRings {
  rings: { value: THREE.Vector4[] };
  time: { value: number };
}

export interface PaintedWater {
  readonly group: THREE.Group;
  /** Sheets are kept within `reach` chunks of this point. Call it every frame, after the land's own update. */
  update(x: number, z: number, reach: number): void;
  /** The sky's colour at the horizon and overhead, which the water mirrors, and how hard it rains from 0 to 1. */
  setSky(low: THREE.Color, high: THREE.Color, rain: number): void;
  readonly triangles: number;
}

const CHUNK = 16;
/** Vertices along one side of a sheet. */
const SIDE = CHUNK + 1;
/** How far under the top of its block the water's surface lies. */
const SINK = 0.14;
/** Sheets made in one frame at most. A chunk with no water in it counts as a fifth of one. */
const PER_FRAME = 2;
/** The most rings that can spread at once. The water feature keeps six. */
const RINGS = 6;

const liquid = new Uint8Array(256), solid = new Uint8Array(256);
for (const block of BLOCKS) { liquid[block.id] = block.liquid ? 1 : 0; solid[block.id] = block.solid ? 1 : 0; }

interface Sheet { cx: number; cz: number; mesh: THREE.Mesh | null; stamp: number; triangles: number }

export function createWater(blocks: LandBlocks, land: Land, look: WaterLook, rings?: WaterRings): PaintedWater {
  const group = new THREE.Group();
  group.name = 'painted-water';
  const uniforms = {
    ...shared,
    uBrushAmt: { value: 0 }, uBands: { value: 0 }, uWrap: { value: 0 }, uBrushScale: { value: 0.05 }, uDapple: { value: 0 },
    uShallow: { value: new THREE.Color(look.shallow) }, uDeep: { value: new THREE.Color(look.deep) }, uFoam: { value: new THREE.Color(look.foam) },
    uSkyLow: { value: new THREE.Color(0.7, 0.85, 0.95) }, uSkyHigh: { value: new THREE.Color(0.3, 0.55, 0.9) }, uRain: { value: 0 },
    uRings: rings?.rings ?? { value: Array.from({ length: RINGS }, () => new THREE.Vector4()) },
    uRingTime: rings?.time ?? { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aDepth;
      varying vec3 vPaintWorld;
      varying float vDepth;
      void main() {
        vDepth = aDepth;
        vPaintWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vPaintWorld, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${FRAGMENT_PARS}
      uniform vec3 uShallow, uDeep, uFoam, uSkyLow, uSkyHigh;
      uniform float uRain, uRingTime;
      uniform vec4 uRings[${RINGS}];
      varying float vDepth;
      float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main() {
        vec2 p = vPaintWorld.xz;
        float wobble = texture2D(uBrush, p * 0.06 + uTime * 0.008).r - 0.5;
        float depth = vDepth + wobble * 0.12;
        // Above the water line there is no water: the land has risen through the sheet.
        if (depth < -0.02) discard;
        // The day's light on the water: the sun's colour in the open, dimmer under a cloud, dark at night.
        vec3 light = mix(uShadeTint * 1.5, uSunTint, 0.8) * paintClouds();
        vec3 color = mix(uShallow, uDeep, smoothstep(0.05, 1.6, depth + wobble * 0.4)) * light;
        // The sky lies on the water, more of it the flatter you look across.
        vec3 view = normalize(cameraPosition - vPaintWorld);
        float across = pow(1.0 - max(view.y, 0.0), 2.5);
        color = mix(color, mix(uSkyLow, uSkyHigh, 0.35 + wobble), 0.12 + 0.56 * across);
        // Ripples: long thin dashes that slide across, cut hard, brightest on the way to the sun.
        float dash = texture2D(uCloudMap, vec2(p.x * 0.035 + uTime * 0.012, p.y * 0.55 - uTime * 0.03)).r;
        float patches = texture2D(uCloudMap, p * 0.09 + uTime * 0.004).r;
        float toSun = pow(max(dot(reflect(-view, vec3(0.0, 1.0, 0.0)), uSunDir), 0.0), 6.0);
        float glint = smoothstep(0.86, 0.875, dash) * smoothstep(0.5, 0.56, patches) * smoothstep(0.1, 0.5, depth);
        // Rings from feet and thrown things, and small ones where rain falls.
        float ring = 0.0;
        for (int i = 0; i < ${RINGS}; i++) {
          vec4 r = uRings[i];
          float age = uRingTime - r.z;
          if (r.w > 0.0 && age >= 0.0 && age < 1.6) {
            float d = length(p - r.xy), fade = (1.0 - age / 1.6) * r.w;
            ring += smoothstep(0.09, 0.0, abs(d - (0.15 + age * 1.3))) * fade + smoothstep(0.07, 0.0, abs(d - age * 0.8)) * fade * 0.5;
          }
        }
        if (uRain > 0.02) {
          vec2 cell = floor(p * 1.4);
          float own = hash21(cell), age = fract(uTime * 0.9 + own);
          vec2 middle = (cell + 0.3 + 0.4 * vec2(hash21(cell + 3.1), hash21(cell + 7.7))) / 1.4;
          ring += smoothstep(0.045, 0.0, abs(length(p - middle) - age * 0.3)) * (1.0 - age) * step(1.0 - uRain * 0.85, hash21(cell + 11.3)) * 0.8;
        }
        color = mix(color, uFoam * light, clamp(glint * (0.55 + 1.2 * toSun) + ring * 0.7, 0.0, 1.0));
        // The shore line breathes in and out a little.
        float edge = 0.08 + 0.035 * sin(uTime * 0.9 + p.x * 0.8 + p.y * 0.6) + wobble * 0.08;
        float foam = 1.0 - smoothstep(edge, edge + 0.035, depth);
        color = mix(color, uFoam * light, foam * 0.75);
        // Shallow water lets the bed show. Deep water, foam and the mirrored sky do not.
        float alpha = max(mix(0.5, 0.95, smoothstep(0.0, 1.3, depth)), max(foam * 0.9, across * 0.9));
        gl_FragColor = vec4(paintHaze(color), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sheets = new Map<number, Sheet>();
  const key = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768);

  // The water's surface over each column of a sheet and two more each way, or NaN where a column is dry.
  const COLS = CHUNK + 4;
  const surface = new Float32Array(COLS * COLS);
  /** The y of the water's surface over a column, or NaN. Water lies on the ground: it is looked for upward from the ground's top. */
  function surfaceAt(x: number, z: number): number {
    let y = Math.min(blocks.heightAt(x, z), blocks.groundAt(x, z)) - 1;
    for (; y >= 0; y--) { const id = blocks.getBlock(x, y, z); if (solid[id] && !liquid[id]) break; }
    let top = y + 1;
    while (top < y + 24 && liquid[blocks.getBlock(x, top, z)]) top++;
    return top > y + 1 ? top - SINK : NaN;
  }

  function build(sheet: Sheet): void {
    const x0 = sheet.cx * CHUNK, z0 = sheet.cz * CHUNK;
    let any = false;
    for (let j = 0; j < COLS; j++) for (let i = 0; i < COLS; i++) { const s = surfaceAt(x0 + i - 2, z0 + j - 2); surface[j * COLS + i] = s; if (s === s) any = true; }
    if (sheet.mesh) { group.remove(sheet.mesh); sheet.mesh.geometry.dispose(); sheet.mesh = null; sheet.triangles = 0; }
    if (!any) return;
    // A vertex sits where four columns meet. Its water level is the highest among the sixteen columns round it, so
    // the sheet runs level for one cell past the water's edge and the land cuts it there.
    const positions: number[] = [], depths: number[] = [], index: number[] = [], at = new Int32Array(SIDE * SIDE).fill(-1);
    const level = (i: number, j: number): number => {
      let best = NaN;
      for (let dj = 0; dj < 4; dj++) for (let di = 0; di < 4; di++) { const s = surface[(j + dj) * COLS + i + di] as number; if (s === s && !(best >= s)) best = s; }
      return best;
    };
    const vertex = (i: number, j: number): number => {
      const n = j * SIDE + i;
      if ((at[n] as number) >= 0) return at[n] as number;
      // Asked a hair inside the sheet, so the land's own tile answers for the far edge too.
      const y = level(i, j), ground = land.heightAt(Math.min(x0 + i, x0 + CHUNK - 0.001), Math.min(z0 + j, z0 + CHUNK - 0.001));
      positions.push(x0 + i, y, z0 + j);
      depths.push(y - (ground === ground ? ground : y));
      return (at[n] = positions.length / 3 - 1);
    };
    let low = Infinity, high = -Infinity;
    for (let j = 0; j < CHUNK; j++) {
      for (let i = 0; i < CHUNK; i++) {
        // A cell gets water when its own column or one beside it is wet.
        let wet = false;
        for (let dj = 1; dj <= 3 && !wet; dj++) for (let di = 1; di <= 3 && !wet; di++) wet = (surface[(j + dj) * COLS + i + di] as number) === (surface[(j + dj) * COLS + i + di] as number);
        if (!wet) continue;
        const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i, j + 1), d = vertex(i + 1, j + 1);
        index.push(a, c, b, b, c, d);
        for (const v of [a, b, c, d]) { const y = positions[v * 3 + 1] as number; low = Math.min(low, y); high = Math.max(high, y); }
      }
    }
    if (index.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aDepth', new THREE.Float32BufferAttribute(depths, 1));
    geometry.setIndex(index);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + 8, (low + high) / 2, z0 + 8), Math.hypot(11.4, (high - low) / 2 + 0.5));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    // After the land and what stands on it, so the bed shows through.
    mesh.renderOrder = 2;
    group.add(mesh);
    sheet.mesh = mesh;
    sheet.triangles = index.length / 3;
  }

  return {
    group,
    update(x, z, reach) {
      const fx = Math.floor(x / CHUNK), fz = Math.floor(z / CHUNK);
      for (const [k, sheet] of sheets) {
        if (Math.abs(sheet.cx - fx) <= reach + 1 && Math.abs(sheet.cz - fz) <= reach + 1) continue;
        if (sheet.mesh) { group.remove(sheet.mesh); sheet.mesh.geometry.dispose(); }
        sheets.delete(k);
      }
      // A sheet is made once its land is, and again whenever that land is: the land's stamp changes with any block near it.
      let budget = PER_FRAME;
      for (let ring = 0; ring <= reach && budget > 0; ring++) {
        for (let dx = -ring; dx <= ring && budget > 0; dx++) {
          for (let dz = -ring; dz <= ring && budget > 0; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const cx = fx + dx, cz = fz + dz, stamp = land.stampAt(cx, cz);
            if (stamp < 0) continue;
            let sheet = sheets.get(key(cx, cz));
            if (sheet && sheet.stamp === stamp) continue;
            if (!sheet) sheets.set(key(cx, cz), (sheet = { cx, cz, mesh: null, stamp: -1, triangles: 0 }));
            build(sheet);
            sheet.stamp = stamp;
            budget -= sheet.mesh ? 1 : 0.2;
          }
        }
      }
    },
    setSky(low, high, rain) { uniforms.uSkyLow.value.copy(low); uniforms.uSkyHigh.value.copy(high); uniforms.uRain.value = rain; },
    get triangles() { let n = 0; for (const sheet of sheets.values()) n += sheet.triangles; return n; },
  };
}
