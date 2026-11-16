// The small things that float in the fight lab's air: the Mark's motes, the ash that lifts off a beast as its
// colors come back, the heart over a calmed beast, the flowers the land answers with, the pips of thrown light
// over a beast, and the gift a beast leaves. Each is a tiny pixel picture, 8 by 8, turned to the camera.
//
// All of them are instances of one quad, so they cost one draw call. Two kinds of use, as `ground.ts` has:
// `draw` puts one down for this frame only (the caller works out where it is), and `spawn` starts one that
// flies and fades by itself until its time is up. Nothing is made per frame: the pool is fixed.
import * as THREE from 'three';
import type { GameView } from '../shell/view.ts';

/** Which picture a spark is. */
export const SPARK = {
  /** A soft point of the Mark's light. */
  mote: 0,
  /** A fleck of grey ash. */
  ash: 1,
  heart: 2,
  /** A flower head, standing on the ground. */
  flower: 3,
  /** A four-pointed star: one mark of thrown light. */
  pip: 4,
  quill: 5,
  spring: 6,
  tusk: 7,
} as const;

/** The pictures, one row of 8 pixels to a number, the leftmost pixel the highest bit. */
const GLYPHS: readonly (readonly number[])[] = [
  [0b00000000, 0b00000000, 0b00011000, 0b00111100, 0b00111100, 0b00011000, 0b00000000, 0b00000000],
  [0b00000000, 0b00000000, 0b00000000, 0b00011000, 0b00001000, 0b00000000, 0b00000000, 0b00000000],
  [0b00000000, 0b01100110, 0b11111111, 0b11111111, 0b01111110, 0b00111100, 0b00011000, 0b00000000],
  [0b00011000, 0b01011010, 0b00111100, 0b11100111, 0b00111100, 0b01011010, 0b00011000, 0b00000000],
  [0b00010000, 0b00010000, 0b00111000, 0b11111110, 0b00111000, 0b00010000, 0b00010000, 0b00000000],
  [0b00000011, 0b00000111, 0b00001110, 0b00011100, 0b00111000, 0b01110000, 0b01100000, 0b10000000],
  [0b01111110, 0b00000010, 0b01111110, 0b01000000, 0b01111110, 0b00000010, 0b01111110, 0b00000000],
  [0b00000010, 0b00000001, 0b00000001, 0b00000011, 0b00000110, 0b00011100, 0b11110000, 0b00000000],
];

const CAPACITY = 192;

const VERTEX = /* glsl */ `
attribute vec4 aPlace;
attribute vec4 aColor;
attribute vec2 aKind;
varying vec2 vUv;
varying vec4 vColor;
varying vec2 vKind;
#include <fog_pars_vertex>

void main() {
  vUv = position.xy + 0.5;
  vColor = aColor;
  vKind = aKind;
  // Turned to the camera: along the screen's right and up.
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 world = aPlace.xyz + (right * position.x + up * position.y) * aPlace.w;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform float uRows[${GLYPHS.length * 8}];
varying vec2 vUv;
varying vec4 vColor;
varying vec2 vKind;
#include <fog_pars_fragment>

float pixel(float kind, float x, float y) {
  if (x < 0.0 || x > 7.0 || y < 0.0 || y > 7.0) return 0.0;
  float row = uRows[int(kind * 8.0 + y + 0.5)];
  return mod(floor(row / exp2(7.0 - x)), 2.0);
}

void main() {
  float x = floor(vUv.x * 8.0), y = floor((1.0 - vUv.y) * 8.0);
  float on = pixel(vKind.x, x, y);
  vec3 color = vColor.rgb;
  if (on < 0.5) {
    // An outline a pixel wide, darker than the picture, so a small thing reads on grass.
    float edge = max(max(pixel(vKind.x, x - 1.0, y), pixel(vKind.x, x + 1.0, y)), max(pixel(vKind.x, x, y - 1.0), pixel(vKind.x, x, y + 1.0)));
    if (edge * vKind.y < 0.5) discard;
    color *= 0.35;
  }
  gl_FragColor = vec4(color, vColor.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export interface Sparks {
  /** Before the frame's `draw` calls. */
  begin(): void;
  /** One spark for this frame only. `size` is blocks across, `outline` 1 gives it a dark rim. */
  draw(kind: number, x: number, y: number, z: number, size: number, color: THREE.Color, alpha: number, outline?: number): void;
  /**
   * One that lives `span` seconds: it flies at (vx, vy, vz), slowed by `drag` a second and pulled down by
   * `gravity` (negative floats up), grows in quickly and fades out. A full pool takes the oldest.
   */
  spawn(kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, span: number, size: number, color: THREE.Color, gravity?: number, drag?: number): void;
  /** Steps the living ones by `dt` and hands the frame to the graphics card. */
  end(dt: number): void;
  /** How many are drawn this frame. */
  readonly count: number;
}

export function createSparks(view: GameView): Sparks {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const place = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  const color = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  const kindOf = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 2), 2);
  for (const attribute of [place, color, kindOf]) attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aPlace', place);
  geometry.setAttribute('aColor', color);
  geometry.setAttribute('aKind', kindOf);
  geometry.instanceCount = 0;
  const rows = GLYPHS.flat();
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, fog: true,
    uniforms: { uRows: { value: rows }, fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 }, fogDensity: { value: 0 } },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'fight-sparks';
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  view.scene.add(mesh);

  // The living ones, a field to an array. `age` past `span` is a free slot.
  const LIVE = 128;
  const px = new Float32Array(LIVE), py = new Float32Array(LIVE), pz = new Float32Array(LIVE);
  const vx = new Float32Array(LIVE), vy = new Float32Array(LIVE), vz = new Float32Array(LIVE);
  const age = new Float32Array(LIVE).fill(1), span = new Float32Array(LIVE).fill(0), size = new Float32Array(LIVE);
  const kinds = new Float32Array(LIVE), cr = new Float32Array(LIVE), cg = new Float32Array(LIVE), cb = new Float32Array(LIVE);
  const pull = new Float32Array(LIVE), slow = new Float32Array(LIVE);
  let count = 0;

  function put(kind: number, x: number, y: number, z: number, s: number, r: number, g: number, b: number, a: number, outline: number): void {
    if (count >= CAPACITY) return;
    const o = count * 4;
    place.array[o] = x; place.array[o + 1] = y; place.array[o + 2] = z; place.array[o + 3] = s;
    color.array[o] = r; color.array[o + 1] = g; color.array[o + 2] = b; color.array[o + 3] = a;
    kindOf.array[count * 2] = kind; kindOf.array[count * 2 + 1] = outline;
    count++;
  }

  return {
    begin() { count = 0; },
    draw(kind, x, y, z, s, c, a, outline = 0) { if (a > 0.004) put(kind, x, y, z, s, c.r, c.g, c.b, a, outline); },
    spawn(kind, x, y, z, sx, sy, sz, life, s, c, gravity = 0, drag = 0) {
      // A free slot, or the one nearest its end.
      let at = 0, most = -Infinity;
      for (let i = 0; i < LIVE; i++) {
        if (age[i] as number >= (span[i] as number)) { at = i; break; }
        const k = (age[i] as number) / (span[i] as number);
        if (k > most) { most = k; at = i; }
      }
      px[at] = x; py[at] = y; pz[at] = z; vx[at] = sx; vy[at] = sy; vz[at] = sz;
      age[at] = 0; span[at] = life; size[at] = s; kinds[at] = kind; pull[at] = gravity; slow[at] = drag;
      cr[at] = c.r; cg[at] = c.g; cb[at] = c.b;
    },
    end(dt) {
      for (let i = 0; i < LIVE; i++) {
        const life = span[i] as number;
        if ((age[i] as number) >= life) continue;
        age[i] = (age[i] as number) + dt;
        const k = Math.min(1, (age[i] as number) / life), keep = Math.exp(-(slow[i] as number) * dt);
        vy[i] = (vy[i] as number) - (pull[i] as number) * dt;
        vx[i] = (vx[i] as number) * keep; vy[i] = (vy[i] as number) * keep; vz[i] = (vz[i] as number) * keep;
        px[i] = (px[i] as number) + (vx[i] as number) * dt;
        py[i] = (py[i] as number) + (vy[i] as number) * dt;
        pz[i] = (pz[i] as number) + (vz[i] as number) * dt;
        // In over the first tenth, out over the last half.
        const a = Math.min(1, k * 10) * Math.min(1, (1 - k) * 2);
        put(kinds[i] as number, px[i] as number, py[i] as number, pz[i] as number, (size[i] as number) * (0.6 + 0.4 * Math.min(1, k * 6)), cr[i] as number, cg[i] as number, cb[i] as number, a, 0);
      }
      geometry.instanceCount = count;
      mesh.visible = count > 0;
      place.needsUpdate = color.needsUpdate = kindOf.needsUpdate = true;
    },
    get count() { return count; },
  };
}
