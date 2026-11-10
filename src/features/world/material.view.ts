// The one material all solid terrain draws with, and its see-through twin for water. Both are a
// stock Lambert material, so they read the scene's lights, shadows and fog, with three additions:
// tiles come from an array texture, baked light and corner shade come from the vertices, and the
// camera's cutaway removes what hides the hero.
import * as THREE from 'three';

/** Shared by every terrain material, so one write moves the cutaway everywhere. */
export interface TerrainUniforms {
  uTiles: { value: THREE.DataArrayTexture };
  /** Center x, center z, the y above which things are cut, and the radius. Radius 0 is off. */
  uCut: { value: THREE.Vector4 };
  /** The width of the circle's faded edge, and 1 when what stands straight above the circle goes too. */
  uCutEdge: { value: THREE.Vector2 };
  /** The point that must stay visible, and the radius of the tunnel bored toward the camera. Radius 0 is off. */
  uSight: { value: THREE.Vector4 };
  /** From the sight point toward the camera. */
  uSightAxis: { value: THREE.Vector3 };
  /** The way the camera looks. An orthographic camera needs it. */
  uViewDir: { value: THREE.Vector3 };
  uWetness: { value: number };
  /** The color of lamp light at full strength. */
  uBlockLight: { value: THREE.Color };
  /** Light that is always there, so the darkest cave is not pure black. */
  uMinLight: { value: number };
}

export function createTerrainUniforms(tiles: THREE.DataArrayTexture): TerrainUniforms {
  return {
    uTiles: { value: tiles },
    uCut: { value: new THREE.Vector4(0, 0, 0, 0) },
    uCutEdge: { value: new THREE.Vector2(2, 0) },
    uSight: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSightAxis: { value: new THREE.Vector3(0, 1, 0) },
    uViewDir: { value: new THREE.Vector3(0, -1, 0) },
    uWetness: { value: 0 },
    uBlockLight: { value: new THREE.Color(1.3, 1.0, 0.62) },
    uMinLight: { value: 0.035 },
  };
}

const VERTEX_PARS = /* glsl */ `
attribute vec4 aInfo;
attribute vec2 aLight;
varying vec3 vWorld;
varying vec2 vTileUv;
varying vec4 vShade;
flat varying vec3 vTile;
flat varying vec2 vCellBase;
const vec3 FACE_NORMAL[6] = vec3[6](vec3(1., 0., 0.), vec3(-1., 0., 0.), vec3(0., 1., 0.), vec3(0., -1., 0.), vec3(0., 0., 1.), vec3(0., 0., -1.));
`;

const VERTEX_NORMAL = /* glsl */ `
float tFlags = floor(aInfo.x / 8.0);
int tFace = int(aInfo.x - tFlags * 8.0 + 0.5);
vec3 objectNormal = FACE_NORMAL[tFace];
`;

const VERTEX_BEGIN = /* glsl */ `
vec3 transformed = vec3(position);
#ifdef TERRAIN_WATER
  // The surface of water sits a little under the top of its block.
  if (mod(tFlags, 4.0) >= 2.0) transformed.y -= 0.12;
#endif
vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vec3 tOrigin = modelMatrix[3].xyz;
if (tFace < 2) { vTileUv = position.zy; vCellBase = tOrigin.zy; }
else if (tFace < 4) { vTileUv = position.xz; vCellBase = tOrigin.xz; }
else { vTileUv = position.xy; vCellBase = tOrigin.xy; }
vShade = vec4(aLight, aInfo.w / 3.0, mod(tFlags, 2.0));
vTile = vec3(aInfo.y, aInfo.z, tFace == 2 ? 1.0 : 0.0);
`;

const FRAGMENT_PARS = /* glsl */ `
uniform sampler2DArray uTiles;
uniform vec4 uCut;
uniform vec2 uCutEdge;
uniform vec4 uSight;
uniform vec3 uSightAxis;
uniform vec3 uViewDir;
uniform float uWetness;
uniform vec3 uBlockLight;
uniform float uMinLight;
varying vec3 vWorld;
varying vec2 vTileUv;
varying vec4 vShade;
flat varying vec3 vTile;
flat varying vec2 vCellBase;

float tDither() {
  const float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
  return (bayer[p.x + p.y * 4] + 0.5) / 16.0;
}

// The cutaway. Both parts return how much of this fragment to remove, 0 to 1.
//   tCut, above the cut height: follow the camera's ray down to the cut height. If it lands inside
//   the circle around the hero, this fragment hides part of that circle, so it goes. Indoors, what
//   stands straight above the circle goes too, so no piece of roof is left floating.
//   tSight, anywhere: a tunnel from the hero toward the camera clears what stands between them.
// The cap is the flat face drawn where solid ground was sliced. It shows exactly where tCut removed
// what was above it, so it uses the same number the other way round.
float tCut() {
  if (uCut.w <= 0.0) return 0.0;
  #ifdef TERRAIN_CAP
    float reach = distance(vWorld.xz, uCut.xy);
  #else
    vec3 ray = isOrthographic ? uViewDir : vWorld - cameraPosition;
    if (vWorld.y <= uCut.z + 0.01 || ray.y > -0.0001) return 0.0;
    float reach = distance(vWorld.xz + ray.xz * ((uCut.z - vWorld.y) / ray.y), uCut.xy);
    if (uCutEdge.y > 0.5) reach = min(reach, distance(vWorld.xz, uCut.xy));
  #endif
  return 1.0 - smoothstep(uCut.w - uCutEdge.x, uCut.w, reach);
}

float tSight() {
  if (uSight.w <= 0.0) return 0.0;
  vec3 rel = vWorld - uSight.xyz;
  float along = dot(rel, uSightAxis);
  float away = length(rel - uSightAxis * along);
  return smoothstep(1.0, 2.2, along) * (1.0 - smoothstep(uSight.w * 0.55, uSight.w, away));
}
`;

const FRAGMENT_MAP = /* glsl */ `
float tThreshold = tDither();
#ifdef TERRAIN_CAP
  if (tCut() <= tThreshold || tSight() > tThreshold) discard;
#else
  if (max(tCut(), tSight()) > tThreshold) discard;
#endif
vec2 tCell = mod(floor(vTileUv) + vCellBase, 64.0);
float tPick = fract(52.9829189 * fract(dot(tCell, vec2(0.06711056, 0.00583715))));
vec4 tTexel = texture(uTiles, vec3(vTileUv, vTile.x + floor(tPick * vTile.y)));
#ifndef TERRAIN_WATER
  if (tTexel.a < 0.5) discard;
#endif
diffuseColor.rgb *= tTexel.rgb;
// Rain darkens ground that lies open to the sky.
diffuseColor.rgb *= 1.0 - 0.45 * uWetness * vTile.z * smoothstep(0.9, 1.0, vShade.x);
`;

const FRAGMENT_LIGHT = /* glsl */ `
float tSky = pow(0.8, 15.0 * (1.0 - vShade.x));
// Lamp light fades all the way to nothing at its edge, so the edge does not show on dark ground.
float tBlock = max(0.0, pow(0.8, 15.0 * (1.0 - vShade.y)) - 0.0352) * 1.0365;
float tCorner = mix(0.42, 1.0, vShade.z);
// Inside the cutaway a dim glow follows the hero, so a dark cave still reads. Open ground gets none.
float tAura = uCut.w > 0.0 ? 0.16 * (1.0 - vShade.x) * (1.0 - smoothstep(0.0, uCut.w, distance(vWorld.xz, uCut.xy))) : 0.0;
vec3 outgoingLight = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * tSky * tCorner
  + diffuseColor.rgb * (uBlockLight * tBlock + uMinLight + tAura) * tCorner
  + diffuseColor.rgb * vShade.w * 1.25
  + totalEmissiveRadiance;
`;

export type TerrainKind = 'solid' | 'water' | 'cap';

/** One of the terrain materials. They share `uniforms`, and each kind compiles its own program. */
export function createTerrainMaterial(kind: TerrainKind, uniforms: TerrainUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial(
    kind === 'water' ? { transparent: true, opacity: 0.74, depthWrite: false } : {},
  );
  material.defines = kind === 'water' ? { TERRAIN_WATER: '' } : kind === 'cap' ? { TERRAIN_CAP: '' } : {};
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERTEX_PARS)
      .replace('#include <beginnormal_vertex>', VERTEX_NORMAL)
      .replace('#include <begin_vertex>', VERTEX_BEGIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAGMENT_PARS)
      .replace('#include <map_fragment>', FRAGMENT_MAP)
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', FRAGMENT_LIGHT);
  };
  material.customProgramCacheKey = () => 'terrain-' + kind;
  return material;
}
