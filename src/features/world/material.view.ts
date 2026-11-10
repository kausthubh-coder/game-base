// The one material all solid terrain draws with, and its see-through twin for water. Both are a
// stock Lambert material, so they read the scene's lights, shadows and fog, with three additions:
// tiles come from an array texture, baked light and corner shade come from the vertices, and the
// camera's cutaway removes what hides the hero.
import * as THREE from 'three';
import { GROUND_SIZE, MAX_LAYERS } from './ground.view.ts';

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
#ifdef TERRAIN_CLEAN
  flat varying float vFace;
#endif
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
#ifdef TERRAIN_CLEAN
  vFace = float(tFace);
#endif
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

#ifdef TERRAIN_CLEAN
  uniform sampler2DArray uSoft;
  uniform sampler2D uGround;
  uniform float uKind[${MAX_LAYERS}];
  uniform float uDirtLayer;
  uniform vec3 uGrassCool;
  uniform vec3 uGrassMid;
  uniform vec3 uGrassWarm;
  uniform vec3 uRockPale;
  flat varying float vFace;
  const vec3 FACE_NORMAL_C[6] = vec3[6](vec3(1., 0., 0.), vec3(-1., 0., 0.), vec3(0., 1., 0.), vec3(0., -1., 0.), vec3(0., 0., 1.), vec3(0., 0., -1.));

  float cHash(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030));
    p += dot(p, p.yx + 33.33);
    return fract((p.x + p.y) * p.x);
  }
  float cNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), u.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  vec3 cLinear(vec3 srgb) { return pow(srgb, vec3(2.2)); }

  // The meadow's color at a point: broad patches of cool and warm green tens of meters across, as a
  // painter would lay them in, with a little variation at the scale of a few blocks.
  vec3 cGrass(vec2 xz) {
    float broad = cNoise(xz / 23.0) * 0.6 + cNoise(xz / 7.0 + 7.3) * 0.4;
    float warm = cNoise(xz / 37.0 + 11.0) * 0.7 + cNoise(xz / 11.0 + 4.0) * 0.3;
    vec3 c = mix(uGrassCool, uGrassMid, smoothstep(0.3, 0.65, broad));
    c = mix(c, uGrassWarm, smoothstep(0.5, 0.75, warm) * 0.9);
    return c * (0.88 + 0.24 * cNoise(xz / 3.3 + 3.1));
  }

  // Rock is painted as pale, warm stone in broad planes, not the tile's dark speckle.
  vec3 cRock(vec3 tile, vec2 xz) {
    return mix(tile, uRockPale, 0.55) * (0.9 + 0.2 * cNoise(xz / 4.0 + 9.0));
  }

  // One column of the ground map: x is the top's height, y is 1 for grass, rgb its color.
  vec4 cColumn(vec2 cell, out vec3 color) {
    vec4 t = texelFetch(uGround, ivec2(mod(cell, ${GROUND_SIZE}.0)), 0);
    color = t.rgb;
    float a = floor(t.a * 255.0 + 0.5);
    return vec4(floor(a / 2.0), mod(a, 2.0), 0.0, 0.0);
  }
#endif

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

// The clean look's version of the tile lookup. Ground tiles come from the soft copy and are repainted:
// grass from broad color fields, edges between grass and earth blended with a ragged line, grass sides
// with a lip of turf over the earth, and a rounded rim where a top face drops away.
const FRAGMENT_MAP_CLEAN = /* glsl */ `
float tThreshold = tDither();
#ifdef TERRAIN_CAP
  if (tCut() <= tThreshold || tSight() > tThreshold) discard;
#else
  if (max(tCut(), tSight()) > tThreshold) discard;
#endif
vec2 tCell = mod(floor(vTileUv) + vCellBase, 64.0);
float tPick = fract(52.9829189 * fract(dot(tCell, vec2(0.06711056, 0.00583715))));
vec3 tLayer = vec3(vTileUv, vTile.x + floor(tPick * vTile.y));
int cKind = vTile.x < ${MAX_LAYERS}.0 ? int(uKind[int(vTile.x)] + 0.5) : 0;
int cFace = int(vFace + 0.5);
vec4 tTexel = cKind == 0 ? texture(uTiles, tLayer) : texture(uSoft, tLayer);
if (tTexel.a < 0.5) discard;
vec3 cAlbedo = tTexel.rgb;
if (cKind != 0) {
  vec2 xz = vWorld.xz;
  // Broad, quiet variation over every ground tile, so no two hillsides are quite the same.
  if (cKind != 1) cAlbedo *= 0.92 + 0.16 * cNoise(xz / 17.0 + 2.0);
  if (cKind == 4 || cKind == 6) cAlbedo = cRock(cAlbedo, xz + vWorld.y);

  if (cFace == 2 && cKind != 5) {
    // Blend grass and earth across block edges. The four columns nearest this point vote, and a column
    // at another height votes as this one does, so a step keeps its own top.
    float selfGrass = cKind == 1 ? 1.0 : 0.0;
    vec2 p = xz - 0.5, i = floor(p), f = fract(p);
    float g = 0.0, earthW = 0.0;
    vec3 earth = vec3(0.0), col;
    for (int k = 0; k < 4; k++) {
      vec2 o = vec2(float(k & 1), float(k >> 1));
      vec4 c = cColumn(i + o, col);
      float w = (o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y);
      bool same = abs(c.x - vWorld.y) < 0.5;
      float grass = same ? c.y : selfGrass;
      g += grass * w;
      if (same && c.y < 0.5) { earth += cLinear(col) * w; earthW += w; }
    }
    // Earth meets grass along a ragged line. Rock keeps a smooth, rounded outline, so a flat stone in the
    // grass reads as a stepping stone and not as a stain.
    bool rock = cKind == 4 || cKind == 6;
    float edge = rock ? 0.4 + (cNoise(xz * 0.7 + 5.0) - 0.5) * 0.1
      : 0.5 + (cNoise(xz * 2.4) - 0.5) * 0.55 + (cNoise(xz * 0.7 + 5.0) - 0.5) * 0.3;
    float grassAmt = smoothstep(edge - 0.04, edge + 0.04, g);
    vec3 meadow = cGrass(xz);
    if (cKind == 1) {
      float lum = dot(tTexel.rgb, vec3(0.3, 0.59, 0.11)) / max(0.02, dot(textureLod(uSoft, tLayer, 6.0).rgb, vec3(0.3, 0.59, 0.11)));
      meadow *= mix(1.0, lum, 0.45);
      vec3 bare = earthW > 0.0 ? earth / earthW : meadow;
      bare *= 0.9 + 0.2 * cNoise(xz * 3.0);
      cAlbedo = mix(bare, meadow, grassAmt);
    } else {
      // Grass reaching onto earth throws a thin shade just past its edge.
      float shade = 1.0 - 0.2 * smoothstep(edge - 0.22, edge - 0.02, g) * (1.0 - grassAmt);
      cAlbedo = mix(cAlbedo * shade, meadow, grassAmt);
    }

    // Mossy stone wears a cushion of moss on top, broken in a few places.
    if (cKind == 6) cAlbedo = mix(cAlbedo, cGrass(xz) * vec3(0.78, 0.86, 0.7), smoothstep(0.4, 0.5, cNoise(xz * 1.1 + 4.0)) * 0.9);

    // A rounded rim where the top drops away to a lower neighbor.
    vec3 skip;
    vec2 here = floor(xz), inCell = fract(xz);
    float h = vWorld.y - 0.5, rim = 1.0;
    if (cColumn(here + vec2(1.0, 0.0), skip).x < h) rim = min(rim, 1.0 - inCell.x);
    if (cColumn(here - vec2(1.0, 0.0), skip).x < h) rim = min(rim, inCell.x);
    if (cColumn(here + vec2(0.0, 1.0), skip).x < h) rim = min(rim, 1.0 - inCell.y);
    if (cColumn(here - vec2(0.0, 1.0), skip).x < h) rim = min(rim, inCell.y);
    cAlbedo *= 1.0 + 0.13 * (1.0 - smoothstep(0.0, 0.14, rim));
  } else if (cFace != 3) {
    float fy = fract(vWorld.y), floorY = floor(vWorld.y);
    float along = vWorld.x + vWorld.z;
    vec3 skip;
    vec2 normal = FACE_NORMAL_C[cFace].xz;
    // Is this block the top of its column? Only then does turf or moss hang over its upper edge.
    bool top = cColumn(floor(xz - normal * 0.5), skip).x <= floorY + 1.0;
    if (cKind == 2) {
      // A lip of turf over the earth. The ragged line follows x + z, so it meets itself round a corner.
      float lip = 0.5 + (cNoise(vec2(along * 1.3, floorY * 7.0)) - 0.5) * 0.34 + (cNoise(vec2(along * 4.0, 1.7)) - 0.5) * 0.08;
      float depth = 1.0 - fy;
      float turf = 1.0 - smoothstep(lip - 0.02, lip + 0.02, depth);
      vec3 soil = texture(uSoft, vec3(vTileUv, uDirtLayer + floor(tPick * 3.0))).rgb;
      soil *= (0.92 + 0.16 * cNoise(xz / 17.0 + 2.0)) * mix(0.72, 1.0, smoothstep(lip, lip + 0.16, depth));
      cAlbedo = mix(soil, cGrass(xz) * 0.93, turf);
    } else if (cKind == 6 && top) {
      // Moss creeps down mossy stone from the top, deeper in some places than others.
      float creep = 0.2 + 0.45 * cNoise(vec2(along * 1.7, floorY * 3.0 + 2.0));
      float moss = 1.0 - smoothstep(creep - 0.03, creep + 0.03, 1.0 - fy);
      cAlbedo = mix(cAlbedo, cGrass(xz) * vec3(0.7, 0.8, 0.62), moss);
    }
    // Where this face stands on grass, the grass grows a little way up it.
    vec4 front = cColumn(floor(xz + normal * 0.5), skip);
    if (front.y > 0.5 && abs(front.x - floorY) < 0.5) {
      float skirt = 0.08 + 0.2 * cNoise(vec2(along * 2.2, floorY + 5.0));
      cAlbedo = mix(cAlbedo, cGrass(xz) * 0.85, 1.0 - smoothstep(skirt - 0.025, skirt + 0.025, fy));
    }
    // The top edge of the highest block in a column rounds over into the top face.
    if (top) cAlbedo *= 1.0 + 0.1 * smoothstep(0.86, 1.0, fy);
  }
}
diffuseColor.rgb *= cAlbedo;
diffuseColor.rgb *= 1.0 - 0.45 * uWetness * vTile.z * smoothstep(0.9, 1.0, vShade.x);
`;

const FRAGMENT_LIGHT = /* glsl */ `
float tSky = pow(0.8, 15.0 * (1.0 - vShade.x));
// Lamp light fades all the way to nothing at its edge, so the edge does not show on dark ground.
float tBlock = max(0.0, pow(0.8, 15.0 * (1.0 - vShade.y)) - 0.0352) * 1.0365;
#ifdef TERRAIN_CLEAN
  // Softer corners: the shade still reads, without a dark seam in every crease.
  float tCorner = mix(0.55, 1.0, smoothstep(0.0, 1.0, vShade.z));
#else
  float tCorner = mix(0.42, 1.0, vShade.z);
#endif
// Inside the cutaway a dim glow follows the hero, so a dark cave still reads. Open ground gets none.
float tAura = uCut.w > 0.0 ? 0.16 * (1.0 - vShade.x) * (1.0 - smoothstep(0.0, uCut.w, distance(vWorld.xz, uCut.xy))) : 0.0;
vec3 outgoingLight = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * tSky * tCorner
  + diffuseColor.rgb * (uBlockLight * tBlock + uMinLight + tAura) * tCorner
  + diffuseColor.rgb * vShade.w * 1.25
  + totalEmissiveRadiance;
`;

export type TerrainKind = 'solid' | 'water' | 'cap';

/** What the clean ground look adds. See ground.view.ts. */
export interface CleanUniforms {
  uSoft: { value: THREE.DataArrayTexture };
  uGround: { value: THREE.DataTexture };
  uKind: { value: Float32Array };
  uDirtLayer: { value: number };
  /** The meadow's three greens, linear. */
  uGrassCool: { value: THREE.Color };
  uGrassMid: { value: THREE.Color };
  uGrassWarm: { value: THREE.Color };
  uRockPale: { value: THREE.Color };
}

export function createCleanUniforms(soft: THREE.DataArrayTexture, ground: THREE.DataTexture, kinds: Float32Array, dirtLayer: number): CleanUniforms {
  return {
    uSoft: { value: soft },
    uGround: { value: ground },
    uKind: { value: kinds },
    uDirtLayer: { value: dirtLayer },
    uGrassCool: { value: new THREE.Color(0x4f9446) },
    uGrassMid: { value: new THREE.Color(0x88bd52) },
    uGrassWarm: { value: new THREE.Color(0xbccd62) },
    uRockPale: { value: new THREE.Color(0xb4b0a4) },
  };
}

/**
 * One of the terrain materials. They share `uniforms`, and each kind compiles its own program. With `clean`,
 * solid ground and the cap draw in the clean ground look; water is the same either way.
 */
export function createTerrainMaterial(kind: TerrainKind, uniforms: TerrainUniforms, clean?: CleanUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial(
    kind === 'water' ? { transparent: true, opacity: 0.74, depthWrite: false } : {},
  );
  const isClean = clean !== undefined && kind !== 'water';
  material.defines = kind === 'water' ? { TERRAIN_WATER: '' } : kind === 'cap' ? { TERRAIN_CAP: '' } : {};
  if (isClean) material.defines.TERRAIN_CLEAN = '';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, isClean ? clean : {});
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERTEX_PARS)
      .replace('#include <beginnormal_vertex>', VERTEX_NORMAL)
      .replace('#include <begin_vertex>', VERTEX_BEGIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAGMENT_PARS)
      .replace('#include <map_fragment>', isClean ? FRAGMENT_MAP_CLEAN : FRAGMENT_MAP)
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', FRAGMENT_LIGHT);
  };
  material.customProgramCacheKey = () => 'terrain-' + kind + (isClean ? '-clean' : '');
  return material;
}
