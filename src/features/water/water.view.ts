// One material for ponds, rivers and the sea. Put `createWaterMaterial(ctx).material` on any water mesh.
//
// The mesh needs nothing but positions. The material asks the world how deep the water is and where the land
// starts: it keeps a small picture of the land around the focus (its height, and whether each column is water)
// and the shader reads depth and shoreline from that. A few rows of the picture are re-read every frame, so it
// follows the player and picks up dug or filled blocks within about half a second.
//
// Optional: a `aFlow` attribute (vec2, blocks a second along x and z) makes a river show which way it runs.
import * as THREE from 'three';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Quality, Vec3 } from '../../engine/types.ts';

export interface WaterOptions {
  /** The side of the picture of the land, in blocks. A power of two. Water farther than half of this from the focus is drawn plain. */
  landSize?: number;
  /** Rows of the picture re-read each frame. */
  rowsPerFrame?: number;
}

/** The part of the sky the water needs. `createSky(...).look` fits. */
export interface WaterSky {
  readonly light: THREE.Color;
  readonly horizon: THREE.Color;
  readonly zenith: THREE.Color;
  /** The sun or moon light: its color times its strength. */
  readonly sun: THREE.Color;
  /** Toward the light: the sun by day, the moon at night. */
  readonly sunDirection: THREE.Vector3;
  /** Where the sun is in the sky, and the glow around it. The glow is 0 when the sun is down. */
  readonly sunInSky: THREE.Vector3;
  readonly glow: THREE.Color;
  readonly night: number;
}

export interface Water extends ViewSystem {
  readonly material: THREE.ShaderMaterial;
  setSky(sky: WaterSky): void;
  /** The picture of the land follows this point, usually the hero. */
  setFocus(position: Vec3): void;
  /** Starts a ring on the water, for a foot or a thrown stone. `strength` is 0 to 1. */
  ripple(position: Vec3, strength?: number): void;
  /** Re-reads all the land around the focus now, after a jump to a new place. */
  refresh(): void;
}

const RIPPLES = 6;
/** The clock wraps here so the shader's time stays exact. */
const TIME_WRAP = 4096;

const VERTEX = /* glsl */ `
attribute vec2 aFlow;
varying vec3 vWorld;
varying vec2 vFlow;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vFlow = aFlow;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uTime, uRain, uFlash, uLandSize, uNight;
uniform vec3 uLight, uZenith, uHorizon, uGlow, uSunPlace, uMoonDir, uMoonColor, uShallow, uDeep, uFocus;
uniform sampler2D uLand;
uniform vec4 uRipples[${RIPPLES}];
varying vec3 vWorld;
varying vec2 vFlow;
#include <fog_pars_fragment>

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Value noise and its slope along x and y.
vec3 vnoised(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y,
              du * (vec2(b - a, c - a) + (a - b - c + d) * u.yx));
}

void main() {
  vec3 facing = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  bool side = abs(facing.y) < 0.5;
  vec2 p = side ? vec2(vWorld.x + vWorld.z, vWorld.y) : vWorld.xz;
  float t = uTime;
  // The side of a water block is falling water.
  vec2 flow = side ? vec2(0.0, 2.4) : vFlow;

  // Depth and shoreline from the picture of the land.
  vec2 column = side ? vWorld.xz : p;
  vec2 land = texture2D(uLand, column / uLandSize).rg;
  float reach = uLandSize * 0.5;
  float beyond = smoothstep(reach - 10.0, reach - 2.0, max(abs(column.x - uFocus.x), abs(column.y - uFocus.z)));
  float depth = mix(max(vWorld.y - land.r, 0.0), 2.5, beyond);
  float shore = side ? 0.0 : land.g * (1.0 - beyond);

  // Two layers of slow swell crossing each other, and the river's flow carrying them.
  vec3 w1 = vnoised(p * 0.9 - flow * t * 0.9 + vec2(t * 0.11, t * 0.05));
  vec3 w2 = vnoised(p * 2.3 - flow * t * 1.5 - vec2(t * 0.09, -t * 0.13) + 7.0);
  float n = w1.x * 0.6 + w2.x * 0.4;
  vec2 slope = w1.yz * 0.9 * 0.6 + w2.yz * 2.3 * 0.4;
  vec3 normal = side ? facing : normalize(vec3(-slope.x * 0.12, 1.0, -slope.y * 0.12));

  vec3 toEye = normalize(cameraPosition - vWorld);
  float facingEye = max(dot(normal, toEye), 0.0);
  // Fresnel, a little stronger than real water so the sky shows from the high camera too.
  float fresnel = 0.06 + 0.94 * pow(1.0 - facingEye, 4.0);
  vec3 bounce = reflect(-toEye, normal);
  bounce.y = abs(bounce.y);
  float toSun = max(dot(bounce, uSunPlace), 0.0);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, bounce.y)) + uGlow * (0.25 * pow(toSun, 6.0));

  // The water itself: clear and bright in the shallows, deep blue-green further out, lit by the sky.
  vec3 body = mix(uShallow, uDeep, smoothstep(0.15, 2.8, depth)) * uLight;
  // Soft bright lines where the swell crests, like light caught on the ridges.
  float lines = smoothstep(0.05, 0.0, abs(n - 0.52)) * 0.5 + smoothstep(0.03, 0.0, abs(n - 0.7)) * 0.3;
  body += uLight * vec3(0.55, 0.8, 0.85) * lines * 0.22;
  vec3 color = mix(body, sky, fresnel * 0.85);

  // Glints: a tight hot spot where the sun's reflection lands, and glitter scattered around it. They are far
  // brighter than the rest of the picture, so they bloom.
  float glitter = step(0.93, hash21(floor(p * 12.0) + floor(t * 4.0) * 13.0));
  vec3 glint = uGlow * (pow(toSun, 600.0) * 18.0 + pow(toSun, 90.0) * glitter * 6.0);
  glint += uMoonColor * uNight * pow(max(dot(bounce, uMoonDir), 0.0), 200.0) * glitter * 4.0;

  // Foam where the water meets land, and a thin line lapping a little way out.
  float foam = smoothstep(0.16, 0.34, shore + (n - 0.5) * 0.4);
  float lap = 0.1 + 0.05 * sin(t * 1.1 + p.x * 1.4 + p.y * 1.1);
  foam = max(foam, 0.5 * smoothstep(0.05, 0.0, abs(shore + (n - 0.5) * 0.12 - lap)));
  vec3 foamColor = vec3(0.9, 0.96, 1.0) * (uLight * 0.85 + 0.15 * uGlow);
  color = mix(color, foamColor, foam * 0.8);

  // Rings where rain lands: in each cell of two grids a ring grows from a new point, over and over.
  float rings = 0.0;
  if (uRain > 0.01 && !side) {
    for (int i = 0; i < RAIN_GRIDS; i++) {
      vec2 g = p * (i == 0 ? 1.3 : 2.1) + float(i) * 13.7;
      vec2 cell = floor(g);
      float pick = hash21(cell + float(i) * 3.1);
      float clock = t * (0.9 + pick * 0.6) + pick * 7.0;
      float turn = floor(clock);
      float age = clock - turn;
      vec2 center = cell + 0.4 + 0.2 * vec2(hash21(cell + turn), hash21(cell + turn + 5.3));
      float falls = step(hash21(cell - turn), uRain);
      rings += smoothstep(0.07, 0.0, abs(length(g - center) - age * 0.4)) * (1.0 - age) * falls;
    }
  }
  // Rings from feet and thrown things.
  if (!side) {
    for (int i = 0; i < ${RIPPLES}; i++) {
      vec4 ripple = uRipples[i];
      float age = t - ripple.z;
      if (ripple.w > 0.0 && age >= 0.0 && age < 1.6) {
        float d = length(p - ripple.xy);
        float fade = (1.0 - age / 1.6) * ripple.w;
        rings += smoothstep(0.09, 0.0, abs(d - (0.15 + age * 1.3))) * fade * 1.2;
        rings += smoothstep(0.07, 0.0, abs(d - age * 0.8)) * fade * 0.6;
      }
    }
  }
  color += rings * 0.45 * (uLight + sky * 0.5);

  vec3 lit = color + glint * (1.0 - foam) + uFlash * 0.25;
  // See-through in the shallows, so the bed shows, and nearly opaque where it reflects the sky.
  float alpha = max(max(mix(0.62, 0.93, smoothstep(0.0, 2.2, depth)), fresnel * 0.95), foam);
  if (side) {
    lit = body * 0.95 + sky * 0.15 + lines * 0.1;
    alpha = 0.86;
  }
  gl_FragColor = vec4(lit, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const RAIN_GRIDS: Record<Quality, number> = { low: 1, medium: 2, high: 2 };

export function createWaterMaterial(ctx: ViewContext, options: WaterOptions = {}): Water {
  const size = options.landSize ?? 128;
  const rowsPerFrame = options.rowsPerFrame ?? 4;
  let world = ctx.world;

  // The picture of the land: red is the height of the ground, green is 1 on land and 0 on water.
  const pixels = new Uint16Array(size * size * 2);
  const land = new THREE.DataTexture(pixels, size, size, THREE.RGFormat, THREE.HalfFloatType);
  land.wrapS = land.wrapT = THREE.RepeatWrapping;
  land.magFilter = land.minFilter = THREE.LinearFilter;
  const ONE = THREE.DataUtils.toHalfFloat(1);
  const ZERO = THREE.DataUtils.toHalfFloat(0);

  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: { value: 0 },
    uRain: { value: 0 },
    uFlash: { value: 0 },
    uLandSize: { value: size },
    uNight: { value: 0 },
    uLight: { value: new THREE.Color(1, 1, 1) },
    uZenith: { value: new THREE.Color(0.3, 0.55, 0.9) },
    uHorizon: { value: new THREE.Color(0.7, 0.85, 0.95) },
    uGlow: { value: new THREE.Color(1, 0.95, 0.85) },
    uSunPlace: { value: new THREE.Vector3(0.3, 0.8, 0.5) },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonColor: { value: new THREE.Color() },
    uShallow: { value: new THREE.Color(0.2, 0.62, 0.6) },
    uDeep: { value: new THREE.Color(0.025, 0.2, 0.36) },
    uFocus: { value: new THREE.Vector3() },
    uLand: { value: land },
    uRipples: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0)) },
  };
  const material = new THREE.ShaderMaterial({
    name: 'water',
    uniforms,
    defines: { RAIN_GRIDS: RAIN_GRIDS[ctx.quality] },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });

  const focus = uniforms.uFocus.value;
  let sky: WaterSky | null = null;
  let time = 0;
  let nextRow = 0;
  let nextRipple = 0;

  const wrap = (v: number) => ((v % size) + size) % size;

  /** Re-reads one row of the picture. Returns true when anything in it changed. */
  function readRow(row: number): boolean {
    // Each texel stands for the one column near the focus whose coordinates wrap onto it.
    const fromX = Math.floor(focus.x) - size / 2;
    const fromZ = Math.floor(focus.z) - size / 2;
    const z = fromZ + wrap(row - fromZ);
    let changed = false;
    for (let i = 0; i < size; i++) {
      const x = fromX + wrap(i - fromX);
      const height = THREE.DataUtils.toHalfFloat(world.heightAt(x + 0.5, z + 0.5));
      const dry = world.surfaceAt(x + 0.5, z + 0.5) === 'water' ? ZERO : ONE;
      const o = (row * size + i) * 2;
      if (pixels[o] !== height || pixels[o + 1] !== dry) {
        pixels[o] = height;
        pixels[o + 1] = dry;
        changed = true;
      }
    }
    return changed;
  }

  function refresh(): void {
    for (let row = 0; row < size; row++) readRow(row);
    land.needsUpdate = true;
  }
  refresh();

  return {
    material,

    setSky(look) {
      sky = look;
    },

    setFocus(position) {
      focus.set(position.x, position.y, position.z);
    },

    ripple(position, strength = 1) {
      uniforms.uRipples.value[nextRipple].set(position.x, position.z, time, strength);
      nextRipple = (nextRipple + 1) % RIPPLES;
    },

    refresh,

    setQuality(quality) {
      material.defines.RAIN_GRIDS = RAIN_GRIDS[quality];
      material.needsUpdate = true;
    },

    update(dt, view) {
      world = view.world;
      time += dt;
      if (time > TIME_WRAP) {
        time -= TIME_WRAP;
        for (const ripple of uniforms.uRipples.value) ripple.w = 0;
      }
      uniforms.uTime.value = time;
      uniforms.uRain.value = view.ambient.rain;
      uniforms.uFlash.value = view.ambient.flash;
      if (sky) {
        uniforms.uLight.value.copy(sky.light);
        uniforms.uZenith.value.copy(sky.zenith);
        uniforms.uHorizon.value.copy(sky.horizon);
        uniforms.uGlow.value.copy(sky.glow);
        uniforms.uSunPlace.value.copy(sky.sunInSky);
        uniforms.uMoonDir.value.copy(sky.sunDirection);
        uniforms.uMoonColor.value.copy(sky.sun);
        uniforms.uNight.value = sky.night;
      }

      let changed = false;
      for (let i = 0; i < rowsPerFrame; i++) {
        if (readRow(nextRow)) changed = true;
        nextRow = (nextRow + 1) % size;
      }
      if (changed) land.needsUpdate = true;
    },

    dispose() {
      material.dispose();
      land.dispose();
    },
  };
}
