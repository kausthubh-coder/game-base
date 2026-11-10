// The one material every prop draws with. It is Three.js's Lambert material, so the sky's sun, fill light,
// shadows and fog all work on it, with two things added:
//   wind  each corner moves by its `sway` in the vertex shader. A prop's timing comes from where it stands.
//   glow  corners marked as lights turn warm and bright when it is dark.
// Both read the `aFx` attribute a `Shape` writes: x is sway, y is glow.
import * as THREE from 'three';

/** Meters a corner with a sway of 1 moves in the strongest wind. */
const SWAY_REACH = 0.42;

const VERTEX_HEAD = /* glsl */ `
attribute vec2 aFx;
uniform float uPropTime;
uniform vec3 uPropWind;
uniform float uPropNight;
varying vec2 vPropGlow;
`;

const VERTEX_BEGIN = /* glsl */ `
vec3 transformed = vec3(position);
#ifdef USE_INSTANCING
  mat4 pPlace = instanceMatrix;
#else
  mat4 pPlace = modelMatrix;
#endif
if (aFx.x > 0.0 && uPropWind.z > 0.0) {
  vec3 pOrigin = pPlace[3].xyz;
  // Each prop keeps its own time, so a field never moves as one.
  float pOwn = fract(sin(dot(pOrigin.xz, vec2(12.9898, 78.233))) * 43758.5453);
  // Gusts roll across the land the way the wind blows.
  float pGust = 0.5 + 0.5 * sin(uPropTime * 0.8 - dot(pOrigin.xz, uPropWind.xy) * 0.13 + pOwn * 1.6);
  float pPower = uPropWind.z * (0.3 + 0.7 * pGust);
  float pBeat = uPropTime * (1.2 + pOwn * 0.9) + pOwn * 6.2832 + position.y * 0.9 + position.x * 0.7;
  vec2 pAcross = vec2(-uPropWind.y, uPropWind.x);
  vec2 pPush = (uPropWind.xy * (0.55 + 0.45 * sin(pBeat)) + pAcross * sin(pBeat * 2.3 + position.z * 1.7) * 0.22) * (pPower * aFx.x * ${SWAY_REACH.toFixed(2)});
  // The push is in the world. Turning it by the transpose and dividing by the scale squared brings it into the prop's own space.
  vec3 pWorld = vec3(pPush.x, -0.3 * length(pPush), pPush.y);
  transformed += (pWorld * mat3(pPlace)) / dot(pPlace[0].xyz, pPlace[0].xyz);
}
vPropGlow = aFx.y > 1.5 ? vec2(0.0, 1.0) : vec2(aFx.y * uPropNight, 0.0);
`;

const FRAGMENT_HEAD = /* glsl */ `
uniform vec3 uPropGlow;
varying vec2 vPropGlow;
`;

// A lamp turns to the color of its light. A coal keeps its own color and gives it off.
const FRAGMENT_COLOR = /* glsl */ `
#include <color_fragment>
vec3 pOwnColor = diffuseColor.rgb;
diffuseColor.rgb = mix(diffuseColor.rgb, uPropGlow, vPropGlow.x * 0.7);
`;

const FRAGMENT_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += uPropGlow * vPropGlow.x * 1.6 + pOwnColor * vPropGlow.y * 2.2;
`;

export interface PropMaterial {
  readonly material: THREE.MeshLambertMaterial;
  /** Seconds, the wind as (x of its direction, z of its direction, strength), and how dark it is from 0 to 1. */
  readonly uniforms: {
    uPropTime: { value: number };
    uPropWind: { value: THREE.Vector3 };
    uPropNight: { value: number };
    uPropGlow: { value: THREE.Color };
  };
}

export function createPropMaterial(): PropMaterial {
  const uniforms = {
    uPropTime: { value: 0 },
    uPropWind: { value: new THREE.Vector3(1, 0, 0) },
    uPropNight: { value: 0 },
    // The palette's lamp light.
    uPropGlow: { value: new THREE.Color(0xfcdd9c) },
  };
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.name = 'props';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERTEX_HEAD)
      .replace('#include <begin_vertex>', VERTEX_BEGIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAGMENT_HEAD)
      .replace('#include <color_fragment>', FRAGMENT_COLOR)
      .replace('#include <emissivemap_fragment>', FRAGMENT_EMISSIVE);
  };
  material.customProgramCacheKey = () => 'props-v1';
  return { material, uniforms };
}
