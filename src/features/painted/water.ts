// The water of the painted world: ponds, rivers and anything the player floods. The rules keep water as
// blocks. Here it is one smooth sheet per chunk at the water's own level, drawn a little way past the last
// water block, so the land rises through it and the shore is the land's own curve and not a row of squares.
//
// Everything comes from how deep the water is at a spot: its colour from shallow to deep, how much of the bed
// shows through, the pale line that breathes where it meets the bank, and where the painted ripples slide.
// The sky lies on it, more of it the flatter you look across. Rings spread from feet and from rain.
//
// All the sheets are one mesh, as the land's tiles are, so the water costs one draw call however many chunks of
// it are in view, and only the sheets the camera sees are listed in it. Each sheet owns a run of 17 by 17
// vertices; when a sheet goes, the last one moves into its place.
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
  /** Sheets are kept within `reach` chunks of this point, and those `view` sees are drawn. Call it every frame, after the land's own update. */
  update(x: number, z: number, reach: number, view?: THREE.Frustum): void;
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

/** A chunk's water: its run in the one mesh (-1 while it has none), its own triangles in that run's numbering, and its bounds. */
interface Sheet { cx: number; cz: number; slot: number; index: Uint16Array; ball: THREE.Sphere; stamp: number; triangles: number }
const RUN = SIDE * SIDE, RUN_INDEX = CHUNK * CHUNK * 6;
const EMPTY = new Uint16Array(0);

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

  // ---- the one mesh. Its runs in use are kept together at the front.
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.name = 'water-sheet';
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  mesh.visible = false;
  // After the land and what stands on it, so the bed shows through.
  mesh.renderOrder = 2;
  group.add(mesh);
  const live: Sheet[] = [];
  let room = 0, listed = -1, drawn = 0;
  /** Makes room for `count` sheets, keeping what is there. */
  function grow(count: number): void {
    const old = mesh.geometry, geometry = new THREE.BufferGeometry();
    for (const [name, size] of [['position', 3], ['aDepth', 1]] as const) {
      const array = new Float32Array(count * RUN * size), before = old.getAttribute(name) as THREE.BufferAttribute | undefined;
      if (before) array.set(before.array as Float32Array);
      const attribute = new THREE.BufferAttribute(array, size);
      attribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(name, attribute);
    }
    const index = new THREE.BufferAttribute(new Uint32Array(count * RUN_INDEX), 1);
    index.setUsage(THREE.DynamicDrawUsage);
    geometry.setIndex(index);
    geometry.setDrawRange(0, 0);
    mesh.geometry = geometry;
    old.dispose();
    room = count;
    listed = -1;
  }
  /** Sends one run of a vertex attribute to the graphics chip. */
  function sendRun(name: 'position' | 'aDepth', slot: number): void {
    const attribute = mesh.geometry.getAttribute(name) as THREE.BufferAttribute;
    attribute.addUpdateRange(slot * RUN * attribute.itemSize, RUN * attribute.itemSize);
    attribute.needsUpdate = true;
  }
  function release(sheet: Sheet): void {
    if (sheet.slot < 0) return;
    const last = live.pop() as Sheet;
    if (last !== sheet) {
      // The last run moves into the freed one.
      for (const name of ['position', 'aDepth'] as const) {
        const attribute = mesh.geometry.getAttribute(name) as THREE.BufferAttribute, array = attribute.array as Float32Array, size = attribute.itemSize;
        array.copyWithin(sheet.slot * RUN * size, last.slot * RUN * size, (last.slot + 1) * RUN * size);
        sendRun(name, sheet.slot);
      }
      last.slot = sheet.slot;
      live[sheet.slot] = last;
    }
    sheet.slot = -1;
    sheet.triangles = 0;
    listed = -1;
  }
  /** Lists the triangles of the sheets the camera sees. */
  function list(view: THREE.Frustum | undefined): void {
    let mark = live.length;
    for (const sheet of live) mark = (Math.imul(mark, 31) + (!view || view.intersectsSphere(sheet.ball) ? 1 : 0) + sheet.stamp * 7 + sheet.slot * 13) | 0;
    if (mark === listed) return;
    listed = mark;
    const attribute = mesh.geometry.getIndex() as THREE.BufferAttribute, index = attribute.array as Uint32Array;
    let n = 0;
    for (const sheet of live) {
      if (view && !view.intersectsSphere(sheet.ball)) continue;
      const first = sheet.slot * RUN, own = sheet.index;
      for (let i = 0; i < own.length; i++) index[n++] = first + (own[i] as number);
    }
    attribute.clearUpdateRanges();
    attribute.addUpdateRange(0, n);
    attribute.needsUpdate = true;
    mesh.geometry.setDrawRange(0, n);
    mesh.visible = n > 0;
    drawn = n / 3;
  }

  const slotOf = new Int32Array(SIDE * SIDE), local: number[] = [];
  function build(sheet: Sheet): void {
    const x0 = sheet.cx * CHUNK, z0 = sheet.cz * CHUNK;
    let any = false;
    for (let j = 0; j < COLS; j++) for (let i = 0; i < COLS; i++) { const s = surfaceAt(x0 + i - 2, z0 + j - 2); surface[j * COLS + i] = s; if (s === s) any = true; }
    if (!any) { release(sheet); return; }
    // A vertex sits where four columns meet. Its water level is the highest among the sixteen columns round it, so
    // the sheet runs level for one cell past the water's edge and the land cuts it there.
    const level = (i: number, j: number): number => {
      let best = NaN;
      for (let dj = 0; dj < 4; dj++) for (let di = 0; di < 4; di++) { const s = surface[(j + dj) * COLS + i + di] as number; if (s === s && !(best >= s)) best = s; }
      return best;
    };
    local.length = 0;
    slotOf.fill(-1);
    for (let j = 0; j < CHUNK; j++) {
      for (let i = 0; i < CHUNK; i++) {
        // A cell gets water when its own column or one beside it is wet.
        let wet = false;
        for (let dj = 1; dj <= 3 && !wet; dj++) for (let di = 1; di <= 3 && !wet; di++) wet = (surface[(j + dj) * COLS + i + di] as number) === (surface[(j + dj) * COLS + i + di] as number);
        if (!wet) continue;
        const a = j * SIDE + i, b = a + 1, c = a + SIDE, d = c + 1;
        slotOf[a] = slotOf[b] = slotOf[c] = slotOf[d] = 1;
        local.push(a, c, b, b, c, d);
      }
    }
    if (local.length === 0) { release(sheet); return; }
    if (sheet.slot < 0) {
      if (live.length >= room) grow(Math.max(16, room * 2));
      sheet.slot = live.length;
      live.push(sheet);
    }
    const positions = mesh.geometry.getAttribute('position').array as Float32Array, depths = mesh.geometry.getAttribute('aDepth').array as Float32Array;
    const first = sheet.slot * RUN;
    let low = Infinity, high = -Infinity;
    for (let j = 0; j < SIDE; j++) {
      for (let i = 0; i < SIDE; i++) {
        const n = j * SIDE + i;
        if ((slotOf[n] as number) < 0) continue;
        // Asked a hair inside the sheet, so the land's own tile answers for the far edge too.
        const y = level(i, j), ground = land.heightAt(Math.min(x0 + i, x0 + CHUNK - 0.001), Math.min(z0 + j, z0 + CHUNK - 0.001));
        positions[(first + n) * 3] = x0 + i; positions[(first + n) * 3 + 1] = y; positions[(first + n) * 3 + 2] = z0 + j;
        depths[first + n] = y - (ground === ground ? ground : y);
        low = Math.min(low, y); high = Math.max(high, y);
      }
    }
    sendRun('position', sheet.slot);
    sendRun('aDepth', sheet.slot);
    sheet.index = new Uint16Array(local);
    sheet.ball.set(sheet.ball.center.set(x0 + 8, (low + high) / 2, z0 + 8), Math.hypot(11.4, (high - low) / 2 + 0.5));
    sheet.triangles = local.length / 3;
    listed = -1;
  }

  return {
    group,
    update(x, z, reach, view) {
      const fx = Math.floor(x / CHUNK), fz = Math.floor(z / CHUNK);
      // forEach, not for-of: this runs every frame, and for-of makes an entry for each sheet.
      sheets.forEach((sheet, k) => {
        if (Math.abs(sheet.cx - fx) <= reach + 1 && Math.abs(sheet.cz - fz) <= reach + 1) return;
        release(sheet);
        sheets.delete(k);
      });
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
            if (!sheet) sheets.set(key(cx, cz), (sheet = { cx, cz, slot: -1, index: EMPTY, ball: new THREE.Sphere(), stamp: -1, triangles: 0 }));
            build(sheet);
            sheet.stamp = stamp;
            budget -= sheet.slot >= 0 ? 1 : 0.2;
          }
        }
      }
      if (room > 0) list(view);
    },
    setSky(low, high, rain) { uniforms.uSkyLow.value.copy(low); uniforms.uSkyHigh.value.copy(high); uniforms.uRain.value = rain; },
    get triangles() { return drawn; },
  };
}
