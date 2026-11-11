// Every particle in the game, drawn in one call. The pool (particles.ts) holds what each particle was born
// with and the vertex shader moves it, so the main thread only writes the particles born this frame.
//
// One draw call covers both blends: the shader writes premultiplied color, with alpha for `normal` particles
// and without it for `add` ones. The sprites are drawn by the shader, so there is no texture.
import * as THREE from 'three';
import type { GameEvent } from '../../engine/events.ts';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Quality, Vec3 } from '../../engine/types.ts';
import { QUALITY } from '../../content/quality.ts';
import type { EffectId } from '../../content/effects.ts';
import { playEvent } from './event-effects.ts';
import { createParticleStore, STRIDE, type EmitOptions } from './particles.ts';
import { createWeatherEmitters } from './weather-emitters.ts';

export type PlayOptions = EmitOptions;

export interface EffectsOptions {
  seed?: number;
}

/** The part of the sky the effects need. `createSky(...).look` fits. */
export interface EffectsSky {
  /** Particles that are not light themselves are multiplied by this, so dust is dark at night. */
  readonly light: THREE.Color;
}

export interface Effects extends ViewSystem {
  /** Particles alive now. Never more than `capacity`. */
  setWeatherEnabled(enabled: boolean): void;
  readonly live: number;
  readonly capacity: number;
  /** Starts an entry from content/effects.ts at a point. */
  play(id: EffectId, position: Vec3, options?: PlayOptions): void;
  /** Answers a game event: dust or a splash under a foot, chips from a broken block, a pop, a pickup trail. */
  onEvent(event: GameEvent): void;
  /** Weather falls around this point, usually the hero. */
  setFocus(position: Vec3): void;
  setSky(sky: EffectsSky): void;
  /** 0 to 1. The glowing motes are not in Ambient yet, so the weather's number comes in here. */
  setMotes(amount: number): void;
}

const VERTEX = /* glsl */ `
attribute vec4 aOrigin, aVelocity, aColor0, aColor1, aMotion, aLook, aFade;
uniform float uTime;
uniform float uWeather;
uniform vec3 uLight;
varying vec2 vUv;
varying vec4 vColor;
varying float vShape;
varying float vAdd;

void main() {
  float age = uTime - aOrigin.w;
  float life = aVelocity.w;
  float f = age / max(life, 1e-4);
  vUv = position.xy;
  // Not born yet, or over: collapse to nothing.
  if (age < 0.0 || f >= 1.0) {
    vColor = vec4(0.0);
    vShape = 0.0;
    vAdd = 0.0;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  float facing = floor(aLook.x / 16.0);
  vShape = aLook.x - facing * 16.0;
  float flags = aFade.z;
  float weather = step(8.0, flags);
  flags -= weather * 8.0;
  float add = step(4.0, flags);
  flags -= add * 4.0;
  float blink = step(2.0, flags);
  flags -= blink * 2.0;
  float lit = step(1.0, flags);
  vAdd = add;

  // Drag slows the particle's own clock, so it bursts out and then hangs.
  float drag = aMotion.w;
  float t = drag > 0.0 ? (1.0 - exp(-drag * age)) / drag : age;
  float seed = aLook.w;
  vec3 center = aOrigin.xyz + aVelocity.xyz * t;
  center.y -= 0.5 * aMotion.z * t * t;
  float sway = age * aFade.w;
  center += vec3(sin(sway + seed * 6.283), sin(sway * 0.7 + seed * 17.0) * 0.4, cos(sway * 0.83 + seed * 29.0)) * aLook.z * min(1.0, age * 2.0);

  float size = mix(aMotion.x, aMotion.y, f);
  vec4 color = mix(aColor0, aColor1, f);
  float alpha = color.a * clamp(f / max(aFade.x, 1e-4), 0.0, 1.0) * clamp((1.0 - f) / max(aFade.y, 1e-4), 0.0, 1.0);
  alpha *= mix(1.0, uWeather, weather);
  alpha *= mix(1.0, smoothstep(0.1, 0.9, 0.5 + 0.5 * sin(age * 2.3 + seed * 40.0)), blink);
  if (vShape > 2.5 && vShape < 3.5 && facing > 0.5 && facing < 1.5) alpha *= smoothstep(4.0, 18.0, distance(center, cameraPosition));
  vColor = vec4(color.rgb * mix(vec3(1.0), uLight, lit), alpha);

  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 camBack = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec3 world;
  if (facing < 0.5) {
    // Turned to the camera, spinning. A leaf also flips over as it falls.
    vec2 corner = position.xy;
    if (vShape > 4.5 && vShape < 5.5) corner.y *= cos(age * 3.3 + seed * 9.0);
    float turn = seed * 6.283 + age * aLook.y;
    corner = vec2(corner.x * cos(turn) - corner.y * sin(turn), corner.x * sin(turn) + corner.y * cos(turn));
    world = center + (camRight * corner.x + camUp * corner.y) * size * 0.5;
  } else if (facing < 1.5) {
    // Stretched along the way it is going.
    vec3 along = normalize(aVelocity.xyz - vec3(0.0, aMotion.z * age, 0.0) + vec3(0.0, 1e-5, 0.0));
    vec3 side = normalize(cross(along, camBack));
    world = center + along * position.y * size * 0.5 * aLook.y + side * position.x * size * 0.5;
  } else {
    // Flat on the ground.
    world = center + vec3(position.x, 0.0, position.y) * size * 0.5;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec4 vColor;
varying float vShape;
varying float vAdd;

void main() {
  vec2 q = vUv;
  float r = length(q);
  float a;
  if (vShape < 0.5) {
    // glow: a soft light
    a = pow(max(0.0, 1.0 - r), 2.0);
  } else if (vShape < 1.5) {
    // square: a pixel chip
    a = 1.0;
  } else if (vShape < 2.5) {
    // puff: a chunky round blob
    a = smoothstep(1.0, 0.72, r);
  } else if (vShape < 3.5) {
    // streak: thin, with soft ends
    a = (1.0 - q.x * q.x) * (1.0 - q.y * q.y);
  } else if (vShape < 4.5) {
    // ring
    a = smoothstep(0.2, 0.05, abs(r - 0.78));
  } else if (vShape < 5.5) {
    // leaf: a pointed oval with a darker rib
    a = step(length(q * vec2(1.0, 1.9)) + abs(q.x) * 0.25, 1.0) * (1.0 - 0.3 * step(abs(q.y), 0.09));
  } else {
    // spark: a four-pointed star
    a = clamp(1.0 - r, 0.0, 1.0) * clamp(1.0 - 9.0 * abs(q.x * q.y), 0.0, 1.0) * 1.6;
  }
  float alpha = clamp(a * vColor.a, 0.0, 1.0);
  if (alpha < 0.004) discard;

  // Tone map the plain color, then premultiply: a normal particle covers, an added one only brightens.
  gl_FragColor = vec4(vColor.rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * alpha, alpha * (1.0 - vAdd));
}`;

export function createEffects(ctx: ViewContext, options: EffectsOptions = {}): Effects {
  const { scene } = ctx;
  const store = createParticleStore({ seed: options.seed });
  const weather = createWeatherEmitters(store);
  store.quality = QUALITY[ctx.quality].particles;
  let world = ctx.world;
  store.groundAt = (x, z) => world.heightAt(x, z);

  // One quad, drawn once for each particle.
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const buffer = new THREE.InstancedInterleavedBuffer(store.data, STRIDE, 1);
  buffer.setUsage(THREE.DynamicDrawUsage);
  ['aOrigin', 'aVelocity', 'aColor0', 'aColor1', 'aMotion', 'aLook', 'aFade'].forEach((name, i) => {
    geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(buffer, 4, i * 4));
  });
  geometry.instanceCount = 0;

  const uniforms = {
    uTime: { value: 0 },
    uWeather: { value: 1 },
    uLight: { value: new THREE.Color(1, 1, 1) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'effects';
  mesh.frustumCulled = false;
  mesh.renderOrder = 50;
  mesh.visible = false;
  scene.add(mesh);

  // The slots written since the last upload. One range object is reused, so nothing is allocated.
  const range = { start: 0, count: 0 };
  let pendingFrom = store.capacity;
  let pendingTo = 0;
  buffer.onUpload(() => {
    pendingFrom = store.capacity;
    pendingTo = 0;
  });

  const focus: Vec3 = { x: 0, y: 0, z: 0 };
  let light: THREE.Color | null = null;
  let motes = 0, weatherEnabled = true;

  const effects: Effects = {
    setWeatherEnabled(enabled) { weatherEnabled = enabled; uniforms.uWeather.value = enabled ? 1 : 0; },
    capacity: store.capacity,
    get live() {
      return store.live;
    },

    play(id, position, playOptions) {
      store.emit(id, position.x, position.y, position.z, playOptions);
    },

    onEvent(event) {
      playEvent(store, event);
    },

    setFocus(position) {
      focus.x = position.x;
      focus.y = position.y;
      focus.z = position.z;
    },

    setSky(sky) {
      light = sky.light;
    },

    setMotes(amount) {
      motes = amount;
    },

    setQuality(quality: Quality) {
      store.quality = QUALITY[quality].particles;
    },

    update(dt, view) {
      world = view.world;
      store.advance(dt);
      if (weatherEnabled) weather.update(dt, view.ambient, view.world, focus, motes);

      if (store.dirtyFrom < store.dirtyTo) {
        pendingFrom = Math.min(pendingFrom, store.dirtyFrom);
        pendingTo = Math.max(pendingTo, store.dirtyTo);
        store.clearDirty();
        range.start = pendingFrom * STRIDE;
        range.count = (pendingTo - pendingFrom) * STRIDE;
        if (buffer.updateRanges.length === 0) buffer.updateRanges.push(range);
        buffer.needsUpdate = true;
      }

      uniforms.uTime.value = store.now;
      if (light) uniforms.uLight.value.copy(light);
      geometry.instanceCount = store.highWater;
      mesh.visible = store.highWater > 0;
    },

    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
  return effects;
}
