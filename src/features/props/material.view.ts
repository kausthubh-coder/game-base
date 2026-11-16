// The one material every prop draws with. It is Three.js's Lambert material, so the sky's sun, fill light,
// shadows and fog all work on it, with these things added:
//   wind  each corner moves by its `sway` in the vertex shader. A prop's timing comes from where it stands.
//   glow  corners marked as lights turn warm and bright when it is dark.
//   skin  a part that wears a skin (skins.ts) takes that layer of one texture array, painted on from three
//         sides or along its own coordinates, multiplied into its vertex colour. It is lit by the painted
//         world's one light (src/features/painted/paint.ts) when that world is drawn, and by Lambert otherwise.
//   flame corners that sway and keep their own glowing color flicker, with or without wind.
// Wind, glow and flame read the `aFx` attribute a `Shape` writes (x is sway, y is glow); the skin reads `aSkin`
// (its number, moss, u and v). A part with no skin draws exactly as props always did.
import * as THREE from 'three';
import { FRAGMENT_PARS, shared } from '../painted/paint.ts';
import { SKIN_NAMES, SKIN_UV, SKINS } from './skins.ts';

/** Meters a corner with a sway of 1 moves in the strongest wind. */
const SWAY_REACH = 0.42;

const VERTEX_HEAD = /* glsl */ `
attribute vec2 aFx;
attribute vec4 aSkin;
uniform float uPropTime;
uniform vec3 uPropWind;
uniform float uPropNight;
varying vec2 vPropGlow;
varying vec4 vSkin;
varying vec3 vPaintWorld;
varying vec3 vSkinNormal;
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
// A flame (a corner that sways and gives off its own color) flickers in still air too: it stretches, sinks and
// licks sideways, faster than any gust. Its root has no sway, so it stays in the logs.
if (aFx.x > 0.0 && aFx.y > 1.5) {
  float pSeed = fract(sin(dot(pPlace[3].xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
  float pLick = uPropTime * 7.3 + pSeed + position.y * 4.1;
  float pTall = sin(uPropTime * 9.1 + pSeed) * 0.6 + sin(uPropTime * 13.7 + pSeed * 1.7) * 0.4;
  transformed += vec3(sin(pLick) * 0.05, pTall * 0.07, cos(pLick * 1.3) * 0.04) * aFx.x;
}
vPropGlow = aFx.y > 1.5 ? vec2(0.0, 1.0) : vec2(aFx.y * uPropNight, 0.0);
vSkin = aSkin;
// The texture coordinates are meters of the prop: a copy drawn larger wears a larger texture.
vSkin.zw *= length(pPlace[0].xyz);
#ifdef USE_INSTANCING
  vSkinNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
  vSkinNormal = normalize(mat3(modelMatrix) * objectNormal);
#endif
`;

// Where the painted light needs the point in the world.
const VERTEX_PROJECT = /* glsl */ `
vec4 pWorldPos = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  pWorldPos = instanceMatrix * pWorldPos;
#endif
pWorldPos = modelMatrix * pWorldPos;
vPaintWorld = pWorldPos.xyz;
vec4 mvPosition = viewMatrix * pWorldPos;
gl_Position = projectionMatrix * mvPosition;
`;

const SKIN_COUNT = SKIN_NAMES.length;
const MOSS_LAYER = SKIN_NAMES.indexOf('moss');

const FRAGMENT_HEAD = /* glsl */ `
${FRAGMENT_PARS}
uniform vec3 uPropGlow;
varying vec2 vPropGlow;
varying vec4 vSkin;
varying vec3 vSkinNormal;
uniform sampler2DArray uSkinMap;
uniform float uSkinOn;
uniform float uPropPaint;
uniform float uSkinScale[${SKIN_COUNT}];
uniform float uSkinAmount[${SKIN_COUNT}];
// The skin's number, 0 with none, and whether the part carries its own texture coordinates.
float pSkinId;
bool pSkinUv;
`;

// A lamp turns to the color of its light. A coal keeps its own color and gives it off.
const FRAGMENT_COLOR = /* glsl */ `
#include <color_fragment>
vec3 pOwnColor = diffuseColor.rgb;
diffuseColor.rgb = mix(diffuseColor.rgb, uPropGlow, vPropGlow.x * 0.7);
`;

// The skin: one layer of the array, from three sides or along the part, with moss from above on the upward
// faces. Each layer was divided by its own mean when it was loaded, so 0.5 leaves the colour as it is.
// The slopes are taken before any branch, so a texture's detail level is right on every pixel.
const FRAGMENT_SKIN = /* glsl */ `
pSkinId = floor(vSkin.x + 0.5);
pSkinUv = pSkinId >= ${SKIN_UV.toFixed(1)};
if (pSkinUv) pSkinId -= ${SKIN_UV.toFixed(1)};
vec3 pP = vPaintWorld;
vec3 pPdx = dFdx(pP), pPdy = dFdy(pP);
vec2 pUv = vSkin.zw, pUvdx = dFdx(pUv), pUvdy = dFdy(pUv);
if (uSkinOn > 0.5 && pSkinId > 0.5) {
  int pLayer = int(pSkinId) - 1;
  float pScale = 1.0 / uSkinScale[pLayer], pAmount = uSkinAmount[pLayer];
  vec3 pMod = vec3(1.0);
  if (pAmount > 0.0) {
    float pL = float(pLayer);
    if (pSkinUv) {
      pMod = textureGrad(uSkinMap, vec3(pUv * pScale, pL), pUvdx * pScale, pUvdy * pScale).rgb * 2.0;
    } else {
      vec3 pW = pow(abs(normalize(vSkinNormal)), vec3(4.0));
      pW /= pW.x + pW.y + pW.z;
      vec3 pX = textureGrad(uSkinMap, vec3(pP.zy * pScale, pL), pPdx.zy * pScale, pPdy.zy * pScale).rgb;
      vec3 pY = textureGrad(uSkinMap, vec3(pP.xz * pScale, pL), pPdx.xz * pScale, pPdy.xz * pScale).rgb;
      vec3 pZ = textureGrad(uSkinMap, vec3(pP.xy * pScale, pL), pPdx.xy * pScale, pPdy.xy * pScale).rgb;
      pMod = (pX * pW.x + pY * pW.y + pZ * pW.z) * 2.0;
    }
    pMod = max(mix(vec3(1.0), pMod, pAmount), vec3(0.0));
  }
  if (vSkin.y > 0.01) {
    float pMs = 1.0 / uSkinScale[${MOSS_LAYER}];
    vec3 pMoss = textureGrad(uSkinMap, vec3(pP.xz * pMs, ${MOSS_LAYER.toFixed(1)}), pPdx.xz * pMs, pPdy.xz * pMs).rgb * 2.0;
    pMod = mix(pMod, max(mix(vec3(1.0), pMoss, uSkinAmount[${MOSS_LAYER}]), vec3(0.0)), clamp(vSkin.y, 0.0, 1.0));
  }
  diffuseColor.rgb *= pMod;
}
#include <emissivemap_fragment>
totalEmissiveRadiance += uPropGlow * vPropGlow.x * 1.6 + pOwnColor * vPropGlow.y * 2.2;
`;

// The painted light reads the sun's direction and how much of it is in shadow; Lambert still adds its own.
const FRAGMENT_LIGHTS = /* glsl */ `
#include <lights_lambert_pars_fragment>
void RE_Direct_Prop(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight) {
  paintNdl = dot(geometryNormal, directLight.direction);
  paintShadow = uSunRaw > 0.0001 ? clamp(directLight.color.r / uSunRaw, 0.0, 1.0) : 1.0;
  RE_Direct_Lambert(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
}
#undef RE_Direct
#define RE_Direct RE_Direct_Prop
`;

const LAMBERT_FINAL = 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';
// Anything between the camera and what must stay in sight is cut away first (`paintSee` in the painted light).
const FRAGMENT_FINAL = /* glsl */ `
paintSee(0.0);
${LAMBERT_FINAL}
if (uPropPaint > 0.5 && pSkinId > 0.5) outgoingLight = paintHaze(paintShade(diffuseColor.rgb, paintLit(0.0))) + totalEmissiveRadiance;
`;

export interface PropMaterial {
  readonly material: THREE.MeshLambertMaterial;
  /** Seconds, the wind as (x of its direction, z of its direction, strength), and how dark it is from 0 to 1. */
  readonly uniforms: {
    uPropTime: { value: number };
    uPropWind: { value: THREE.Vector3 };
    uPropNight: { value: number };
    uPropGlow: { value: THREE.Color };
    /** 1 draws the skins' textures, 0 leaves them out (`propTextures` in src/content/quality.ts). */
    uSkinOn: { value: number };
    /** 1 lights skinned parts with the painted light. */
    uPropPaint: { value: number };
    uSkinMap: { value: THREE.DataArrayTexture };
  };
}

/** One plain layer for every skin, so the material draws before the paintings arrive. */
function blankSkins(): THREE.DataArrayTexture {
  const data = new Uint8Array(4 * SKIN_COUNT).fill(128);
  const texture = new THREE.DataArrayTexture(data, 1, 1, SKIN_COUNT);
  texture.needsUpdate = true;
  return texture;
}

/** True when the painted world is drawn: it hands the painted light its brush. */
export function paintedLightLive(): boolean {
  return shared.uBrush.value !== null;
}

export function createPropMaterial(): PropMaterial {
  const uniforms = {
    uPropTime: { value: 0 },
    uPropWind: { value: new THREE.Vector3(1, 0, 0) },
    uPropNight: { value: 0 },
    // The palette's lamp light.
    uPropGlow: { value: new THREE.Color(0xfcdd9c) },
    uSkinOn: { value: 1 },
    uPropPaint: { value: 0 },
    uSkinMap: { value: blankSkins() },
    uSkinScale: { value: SKIN_NAMES.map((name) => SKINS[name].scale) },
    uSkinAmount: { value: SKIN_NAMES.map((name) => SKINS[name].amount) },
    // The painted light's own settings for props: a little softer than the land's bands.
    uBrushAmt: { value: 0.28 },
    uBands: { value: 0.55 },
    uWrap: { value: 0.25 },
    uBrushScale: { value: 0.22 },
    uDapple: { value: 0 },
  };
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.name = 'props';
  material.userData.see = 'solid';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERTEX_HEAD)
      .replace('#include <begin_vertex>', VERTEX_BEGIN)
      .replace('#include <project_vertex>', VERTEX_PROJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAGMENT_HEAD)
      .replace('#include <color_fragment>', FRAGMENT_COLOR)
      .replace('#include <lights_lambert_pars_fragment>', FRAGMENT_LIGHTS)
      .replace('#include <emissivemap_fragment>', FRAGMENT_SKIN)
      .replace(LAMBERT_FINAL, FRAGMENT_FINAL);
  };
  material.customProgramCacheKey = () => 'props-v3';
  return { material, uniforms };
}
