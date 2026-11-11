// One painted light for every surface of the painted world. A Lambert material keeps Three.js's shadows and
// instancing, and its light is replaced: a wrapped sun, soft bands broken up by a brush texture, a warm
// light tint, a blue-violet shade tint and haze toward the sky's colour.
//
// The scene's one DirectionalLight (the game's sun or moon) is read only for its direction and its shadow.
// `uSunRaw` is that light's own brightness with no shadow on it, so what reaches a surface divided by it is
// how much of the surface is in shadow. The colour of the light is `uSunTint`.
import * as THREE from 'three';

/** Soft blobs that repeat without a seam: where the clouds' shadows fall. Each value is the share of the map darker than it. */
function cloudMap(): THREE.DataTexture {
  const n = 128, raw = new Float32Array(n * n), data = new Uint8Array(n * n);
  const hash = (x: number, y: number, s: number): number => { let h = Math.imul(x * 374761393 + y * 668265263 + s * 2246822519, 3266489917); h ^= h >>> 15; return ((Math.imul(h, 2654435761) >>> 0) / 4294967296); };
  const ease = (t: number): number => t * t * (3 - 2 * t);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let sum = 0, amp = 0.5;
      for (const cells of [3, 6, 12]) {
        const x = (i / n) * cells, y = (j / n) * cells, ix = Math.floor(x), iy = Math.floor(y), u = ease(x - ix), v = ease(y - iy);
        const at = (dx: number, dy: number): number => hash((ix + dx) % cells, (iy + dy) % cells, cells);
        sum += amp * (at(0, 0) + (at(1, 0) - at(0, 0)) * u + (at(0, 1) - at(0, 0)) * v + (at(0, 0) - at(1, 0) - at(0, 1) + at(1, 1)) * u * v);
        amp *= 0.5;
      }
      raw[j * n + i] = sum;
    }
  }
  const order = Array.from(raw.keys()).sort((a, b) => (raw[a] as number) - (raw[b] as number));
  order.forEach((at, rank) => { data[at] = Math.round((rank / (n * n - 1)) * 255); });
  const texture = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Uniforms every painted material reads. Set them once per frame. */
export const shared = {
  uTime: { value: 0 },
  uSunTint: { value: new THREE.Color(1, 1, 1) },
  /** The red of the sun light's colour times its strength, as the scene's DirectionalLight has it. */
  uSunRaw: { value: 1 },
  uShadeTint: { value: new THREE.Color(0.3, 0.4, 0.6) },
  uSkyAdd: { value: new THREE.Color(0, 0, 0) },
  /** The colour and strength of lamp light on the land, where a lamp's light reaches it. Strong at night, faint by day. */
  uLamp: { value: new THREE.Color(0, 0, 0) },
  /** The colour far things sink into: the sky's colour at the horizon. */
  uHaze: { value: new THREE.Color(0.7, 0.8, 0.9) },
  /** The colour of the air in the middle distance: things turn this blue first, and the horizon's colour only far off. */
  uHazeNear: { value: new THREE.Color(0.45, 0.62, 0.85) },
  /** The glow of the air toward the sun, and how strong it is. */
  uHazeSun: { value: new THREE.Color(1, 0.9, 0.7) },
  uHazeGlow: { value: 0.5 },
  /** The way to the sun (or the moon), in the world. */
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.4) },
  uHazeDensity: { value: 0.004 },
  uHazeMax: { value: 0.9 },
  /** Meters of clear air in front of the camera before the haze begins. */
  uHazeStart: { value: 30 },
  /** Mist lies in low ground: the height it lies at, and how fast the air clears above it (per meter). */
  uHazeLow: { value: new THREE.Vector2(20, 0.05) },
  /**
   * The hero's place, and how far from it along the ground the near world thins out and is gone. The land in
   * memory ends there, and the far land (drawn from the land's shape alone) takes over.
   */
  uFocus: { value: new THREE.Vector3() },
  uEdge: { value: new THREE.Vector2(1e6, 2e6) },
  /** The same for trees, which the rules know only nearer the hero. Past it a tree is drawn as a picture of itself. */
  uEdgeTree: { value: new THREE.Vector2(1e6, 2e6) },
  /** How dark a cloud's shadow is, and the share of the land the clouds shade. */
  uCloudShade: { value: 0.55 },
  uCloudCover: { value: 0.44 },
  uCloudMap: { value: cloudMap() },
  /** What the sun and the shade do to a leaf's painted tone: white at noon, warm and violet late in the day. */
  uLeafSun: { value: new THREE.Color(1, 1, 1) },
  uLeafShade: { value: new THREE.Color(1, 1, 1) },
  uBrush: { value: null as THREE.Texture | null },
  /** x and y are the wind's direction on the ground, z is its strength. */
  uWind: { value: new THREE.Vector3(0.83, 0.55, 1) },
};

export interface PaintOptions extends THREE.MeshLambertMaterialParameters {
  /** How far the brush texture breaks up the edge between light and shade. */
  brush?: number;
  /** 0 is a smooth gradient, 1 is three flat bands. */
  bands?: number;
  /** How far the sun reaches round a form. */
  wrap?: number;
  /** Repeats of the brush texture per meter. */
  brushScale?: number;
  /** 0 to 1: how much sun gets through the leaves as flecks of light inside a shadow. For the ground. */
  dapple?: number;
  /** Lights both faces with the vertex normal, for leaf cards. */
  keepNormal?: boolean;
  uniforms?: Record<string, THREE.IUniform>;
  vertexPars?: string;
  /** Runs after `transformed` is set, in the object's own space. */
  vertexBegin?: string;
  /** Runs after `objectNormal` is set. */
  vertexNormal?: string;
  /** Changes `paintWorldPos`, the vertex in world space. */
  vertexWorld?: string;
  /** Changes `mvPosition`, the vertex in view space. */
  vertexView?: string;
  /** Changes `worldPosition`, the point whose shadow the vertex takes. */
  vertexShadow?: string;
  fragmentPars?: string;
  /** Changes `diffuseColor` before it is lit. */
  fragmentAlbedo?: string;
  /** Replaces the lighting. It must declare `vec3 outgoingLight`. */
  fragmentFinal?: string;
}

const GUST = /* glsl */ `
uniform float uTime;
uniform vec3 uWind;
// Bands of wind that travel across the ground: 0 in still air, 1 in a gust.
float paintGust(vec2 p) {
  vec2 q = p * 0.05 - uWind.xy * uTime * 0.16;
  float a = sin(q.x * 3.1 + sin(q.y * 2.3 + uTime * 0.21) * 1.7) * 0.5 + 0.5;
  float b = sin(q.y * 1.7 + q.x * 0.9 + 1.3) * 0.5 + 0.5;
  return smoothstep(0.2, 0.85, a * (0.45 + 0.55 * b)) * uWind.z;
}
`;

const projectVertex = (world: string, view: string): string => /* glsl */ `
vec4 paintWorldPos = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  paintWorldPos = instanceMatrix * paintWorldPos;
#endif
paintWorldPos = modelMatrix * paintWorldPos;
${world}
vPaintWorld = paintWorldPos.xyz;
vec4 mvPosition = viewMatrix * paintWorldPos;
${view}
gl_Position = projectionMatrix * mvPosition;
`;

/** What a painted fragment shader declares: the shared uniforms and the painted light and air. It needs `vPaintWorld`. */
export const FRAGMENT_PARS = /* glsl */ `
varying vec3 vPaintWorld;
uniform vec3 uSunTint, uShadeTint, uSkyAdd, uHaze, uHazeNear, uHazeSun, uSunDir;
uniform float uHazeDensity, uHazeMax, uHazeStart, uHazeGlow, uCloudShade, uCloudCover, uTime, uSunRaw;
uniform vec2 uHazeLow;
uniform vec3 uFocus;
uniform vec2 uEdge, uEdgeTree;
uniform vec3 uWind;
uniform sampler2D uBrush, uCloudMap;
uniform float uBrushAmt, uBands, uWrap, uBrushScale, uDapple;
float paintNdl = 1.0;
float paintShadow = 1.0;
float paintBrush() {
  vec3 p = vPaintWorld * uBrushScale;
  return texture2D(uBrush, p.xz + p.y * vec2(0.31, 0.17)).r;
}
// Shadows of clouds drift over the land: wide soft patches, lighter than a tree's shadow.
float paintClouds() {
  float c = texture2D(uCloudMap, vPaintWorld.xz * 0.0045 - uWind.xy * uTime * 0.004).r;
  return mix(1.0 - uCloudShade, 1.0, smoothstep(uCloudCover - 0.09, uCloudCover + 0.09, c));
}
// 0 in full shade, 1 in full sun.
float paintLit(float jitter) {
  // Flecks of sun that fall through the leaves and shift as the boughs move.
  float flecks = texture2D(uCloudMap, vPaintWorld.xz * 0.13 + vec2(sin(uTime * 0.5), cos(uTime * 0.37)) * 0.004).r;
  float shadow = max(paintShadow, smoothstep(0.8, 0.86, flecks) * 0.9 * uDapple);
  float l = clamp((paintNdl + uWrap) / (1.0 + uWrap), 0.0, 1.0) * shadow * paintClouds();
  l += (paintBrush() - 0.5) * uBrushAmt + jitter;
  float banded = 0.5 * smoothstep(0.2, 0.3, l) + 0.5 * smoothstep(0.55, 0.67, l);
  return clamp(mix(l, banded, uBands), 0.0, 1.0);
}
vec3 paintShade(vec3 albedo, float lit) {
  // The sky fills shade with a little of its own colour. A dark surface takes less of it, or it would turn blue.
  float takes = clamp(dot(albedo, vec3(0.3, 0.6, 0.1)) * 4.0, 0.25, 1.0);
  return albedo * mix(uShadeTint, uSunTint, lit) + uSkyAdd * (1.0 - lit) * takes;
}
// A different number for every pixel, to thin a surface out without blending.
float paintDither() {
  return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
}
// 0 inside the near world, 1 past its edge.
float paintEdge() {
  return smoothstep(uEdge.x, uEdge.y, distance(vPaintWorld.xz, uFocus.xz));
}
// The air between the eye and a far thing: blue first, the horizon's colour last, thicker in low ground and
// aglow toward the sun.
vec3 paintAir(vec3 color) {
  vec3 ray = vPaintWorld - cameraPosition;
  float far = length(ray);
  float d = max(0.0, far - uHazeStart);
  float low = exp(-max(0.0, vPaintWorld.y - uHazeLow.x) * uHazeLow.y);
  float amount = (1.0 - exp(-d * uHazeDensity * (0.3 + 0.7 * low))) * uHazeMax;
  float toSun = max(dot(ray / max(far, 0.001), uSunDir), 0.0);
  vec3 air = mix(uHazeNear, uHaze, smoothstep(0.25, 0.85, amount));
  air = mix(air, uHazeSun, toSun * toSun * toSun * uHazeGlow * amount);
  return mix(color, air, amount);
}
// The same, for what stands in the near world: it thins out at the near world's edge.
vec3 paintHaze(vec3 color) {
  if (paintEdge() > paintDither()) discard;
  return paintAir(color);
}
// 0 where a tree is drawn leaf by leaf, 1 where it is a picture of itself.
float paintTreeEdge() {
  return smoothstep(uEdgeTree.x, uEdgeTree.y, distance(vPaintWorld.xz, uFocus.xz));
}
vec3 paintHazeTree(vec3 color) {
  if (paintTreeEdge() > paintDither()) discard;
  return paintAir(color);
}
`;

const LIGHTS = (keepNormal: boolean): string => /* glsl */ `
varying vec3 vViewPosition;
struct LambertMaterial { vec3 diffuseColor; float specularStrength; };
void RE_Direct_Lambert(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight) {
  paintNdl = dot(${keepNormal ? 'normalize(vNormal)' : 'geometryNormal'}, directLight.direction);
  paintShadow = uSunRaw > 0.0001 ? clamp(directLight.color.r / uSunRaw, 0.0, 1.0) : 1.0;
}
void RE_IndirectDiffuse_Lambert(const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight) {}
#define RE_Direct RE_Direct_Lambert
#define RE_IndirectDiffuse RE_IndirectDiffuse_Lambert
`;

const DEFAULT_FINAL = 'vec3 outgoingLight = paintHaze(paintShade(diffuseColor.rgb, paintLit(0.0))) + totalEmissiveRadiance;';

function replaceOnce(source: string, find: string, put: string): string {
  if (!source.includes(find)) throw new Error(`the Three.js shader has no "${find}" to replace`);
  return source.replace(find, put);
}

function patchVertex(shader: { vertexShader: string }, o: PaintOptions): void {
  let v = shader.vertexShader;
  v = replaceOnce(v, '#include <common>', `#include <common>\nvarying vec3 vPaintWorld;\n${GUST}\n${o.vertexPars ?? ''}`);
  if (o.vertexNormal) v = replaceOnce(v, '#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${o.vertexNormal}`);
  v = replaceOnce(v, '#include <begin_vertex>', `#include <begin_vertex>\n${o.vertexBegin ?? ''}`);
  v = replaceOnce(v, '#include <project_vertex>', projectVertex(o.vertexWorld ?? '', o.vertexView ?? ''));
  if (o.vertexShadow && v.includes('#include <shadowmap_vertex>')) {
    v = replaceOnce(v, '#include <shadowmap_vertex>', `#ifdef USE_SHADOWMAP\n${o.vertexShadow}\n#endif\n#include <shadowmap_vertex>`);
  }
  shader.vertexShader = v;
}

const hookKey = (o: PaintOptions): string =>
  [o.keepNormal, o.vertexPars, o.vertexBegin, o.vertexNormal, o.vertexWorld, o.vertexView, o.vertexShadow, o.fragmentPars, o.fragmentAlbedo, o.fragmentFinal].join('|');

/** A Lambert material lit with the painted light. */
export function paint(options: PaintOptions = {}): THREE.MeshLambertMaterial {
  const { brush = 0.2, bands = 0.4, wrap = 0.3, brushScale = 0.09, dapple = 0, keepNormal = false, uniforms = {}, vertexPars, vertexBegin, vertexNormal,
    vertexWorld, vertexView, vertexShadow, fragmentPars, fragmentAlbedo, fragmentFinal, ...lambert } = options;
  const material = new THREE.MeshLambertMaterial(lambert);
  const own = { uBrushAmt: { value: brush }, uBands: { value: bands }, uWrap: { value: wrap }, uBrushScale: { value: brushScale }, uDapple: { value: dapple }, ...uniforms };
  material.userData.uniforms = own;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, own);
    patchVertex(shader, options);
    let f = shader.fragmentShader;
    f = replaceOnce(f, '#include <common>', `#include <common>\n${FRAGMENT_PARS}\n${fragmentPars ?? ''}`);
    f = replaceOnce(f, '#include <lights_lambert_pars_fragment>', LIGHTS(keepNormal));
    f = replaceOnce(f, 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
      `${fragmentAlbedo ?? ''}\n${fragmentFinal ?? DEFAULT_FINAL}`);
    shader.fragmentShader = f;
  };
  material.customProgramCacheKey = () => 'paint|' + hookKey(options);
  return material;
}

/** The shadow material of a painted material that moves its vertices or cuts its shape with a texture. */
export function paintDepth(options: PaintOptions = {}): THREE.MeshDepthMaterial {
  const material = new THREE.MeshDepthMaterial({ map: options.map ?? null, alphaTest: options.alphaTest ?? 0, side: options.side ?? THREE.FrontSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, options.uniforms ?? {});
    patchVertex(shader, options);
  };
  material.customProgramCacheKey = () => 'paint-depth|' + hookKey(options);
  return material;
}
