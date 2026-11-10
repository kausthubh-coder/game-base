// Solid Blender crop stages share one instanced draw call. The stage tag selects the visible model.
// Wet soil is a second instanced draw call.
//
// A plant is lit the way a sprite is: the sky's light dimmed by how much sky reaches it, plus lamp light.
// It moves in the vertex shader, so a field that only sways writes nothing from the page.
import * as THREE from 'three';
import { environmentGeometry } from '../../features/props/models.view.ts';

/** Floats for one plant: where its foot is and a number of its own, its tile and when it last grew, its light. */
export const PLANT_STRIDE = 10;
/** Floats for one wet block: the middle of its top. */
export const WET_STRIDE = 3;

/** How long a plant pops after it grows, in seconds. */
export const POP_SECONDS = 0.2;

const PLANT_VERTEX = /* glsl */ `
uniform float uTime;
uniform vec3 uWind;
uniform vec2 uTile;
uniform vec3 uSky;
uniform vec3 uLamp;
attribute vec3 color;
attribute vec2 aCrop;
attribute vec3 normal;
attribute vec4 aPlace;
attribute vec4 aTile;
attribute vec2 aLight;
varying vec2 vUv;
flat varying vec4 vRect;
flat varying vec3 vColor;
varying vec3 vPaint;
#include <fog_pars_vertex>

void main() {
  // uv.y is 1 at the foot. The sheet's first row is the top of the picture, so v grows downward.
  vUv = aTile.xy + uv * uTile;
  // A quarter of a pixel inside the tile, so a sample never reaches the tile beside it.
  vec2 inset = uTile / 128.0;
  vRect = vec4(aTile.xy + inset, aTile.xy + uTile - inset);

  float sky = pow(0.8, 15.0 * (1.0 - aLight.x));
  float lamp = pow(0.8, 15.0 * (1.0 - aLight.y)) * step(0.02, aLight.y);
  vColor = uSky * sky + uLamp * lamp + 0.06;

  vPaint = color * (0.72 + 0.28 * max(0.0, dot(normal, normalize(vec3(-0.4, 0.85, 0.3)))));
  vec3 p = position;
  // The pop: for a moment after it grows the plant is larger, then it settles.
  float pop = clamp((uTime - aTile.z) / ${POP_SECONDS.toFixed(2)}, 0.0, 1.0);
  float swell = sin(pop * 3.14159);
  p.xz *= 1.0 + 0.22 * swell;
  p.y *= 1.0 + 0.4 * swell;

  // The wind bends the top and leaves the foot where it is. Each plant keeps its own time.
  float bend = position.y * position.y;
  float beat = uTime * (1.3 + aPlace.w * 0.9) + aPlace.w * 6.2832 - dot(aPlace.xz, uWind.xy) * 0.35;
  vec2 across = vec2(-uWind.y, uWind.x);
  p.xz += (uWind.xy * (0.45 + 0.55 * sin(beat)) + across * 0.3 * sin(beat * 1.7 + 1.3)) * (uWind.z * 0.24 * bend);

  vec4 mvPosition = viewMatrix * vec4(aPlace.xyz + p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vec2 selected = floor(aTile.xy / uTile + 0.5);
  if (abs(selected.x - aCrop.x) > 0.1 || abs(selected.y - aCrop.y) > 0.1) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  #include <fog_vertex>
}
`;

const PLANT_FRAGMENT = /* glsl */ `
uniform sampler2D uSheet;
varying vec2 vUv;
flat varying vec4 vRect;
flat varying vec3 vColor;
varying vec3 vPaint;
#include <fog_pars_fragment>

void main() {
  vec4 texel = vec4(vPaint, 1.0);
  // A hard cut: a pixel is there or it is not, so plants sort against blocks by depth alone.
  if (texel.a < 0.5) discard;
  gl_FragColor = vec4(texel.rgb * vColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const WET_VERTEX = /* glsl */ `
attribute vec3 aSpot;
#include <fog_pars_vertex>

void main() {
  vec4 mvPosition = viewMatrix * vec4(aSpot + position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const WET_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform vec3 uSky;
#include <fog_pars_fragment>

void main() {
  // One even tone over the whole block, so wet blocks side by side read as one field.
  float alpha = uStrength;
  #ifdef USE_FOG
    // Fog hides the patch. It does not paint it the color of fog.
    #ifdef FOG_EXP2
      alpha *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      alpha *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
  #endif
  gl_FragColor = vec4(uColor * uSky, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface CropMeshes {
  readonly plants: THREE.Mesh;
  readonly wet: THREE.Mesh;
  /** Rows of PLANT_STRIDE floats: x, y, z of the foot, a number from 0 to 1 of its own, u, v of its tile, the second it last grew, 0, sky light, lamp light (0 to 1). */
  plantData: Float32Array;
  /** Rows of WET_STRIDE floats. */
  wetData: Float32Array;
  /** Makes room for this many plants and wet blocks. What was written is kept. */
  reserve(plants: number, wet: number): void;
  /** Sends the first `plants` and `wet` rows to the GPU and draws that many. */
  commit(plants: number, wet: number, plantsChanged: boolean, wetChanged: boolean): void;
  /** Seconds, the wind as (x of its direction, z of its direction, strength), and the sky's light. */
  frame(time: number, windX: number, windZ: number, wind: number, sky: THREE.Color): void;
}

/** `tileU` and `tileV` are the size of one tile of the sheet in texture coordinates. */
export function createCropMeshes(sheet: THREE.Texture, tileU: number, tileV: number): CropMeshes {
  const corners: number[] = [], colors: number[] = [], normals: number[] = [], cropTags: number[] = [], uvs: number[] = [], index: number[] = [];
  for (const [row, crop] of ['wheat','turnip','carrot'].entries()) {
    for (let stage=0;stage<4;stage++) {
      const source = environmentGeometry('crop'+crop,stage);
      if (!source) throw new Error(`Crop model missing: ${crop} ${stage}`);
      const g = source.index ? source.toNonIndexed() : source;
      const p=g.getAttribute('position'), c=g.getAttribute('color'), n=g.getAttribute('normal');
      for (let i=0;i<p.count;i++) {
        index.push(index.length); corners.push(p.getX(i),p.getY(i),p.getZ(i));
        colors.push(c.getX(i),c.getY(i),c.getZ(i)); normals.push(n.getX(i),n.getY(i),n.getZ(i));
        cropTags.push(stage,row);uvs.push(0,0);
      }
      if (g!==source) g.dispose();
    }
  }
  const plantUniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uSheet: { value: sheet },
    uTile: { value: new THREE.Vector2(tileU, tileV) },
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector3(1, 0, 0) },
    uSky: { value: new THREE.Color(1, 1, 1) },
    // The color of lamp light at full strength. The terrain and the sprites use the same.
    uLamp: { value: new THREE.Color(1.3, 1.0, 0.62) },
  };
  const plantMaterial = new THREE.ShaderMaterial({
    name: 'crops',
    uniforms: plantUniforms,
    vertexShader: PLANT_VERTEX,
    fragmentShader: PLANT_FRAGMENT,
    side: THREE.DoubleSide,
    fog: true,
  });

  const wetUniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    // Wet earth: nearly black with a little red-brown, laid over the soil's own furrows.
    uColor: { value: new THREE.Color(0.05, 0.03, 0.022) },
    uStrength: { value: 0.52 },
    uSky: { value: new THREE.Color(1, 1, 1) },
  };
  const wetMaterial = new THREE.ShaderMaterial({
    name: 'wet-soil',
    uniforms: wetUniforms,
    vertexShader: WET_VERTEX,
    fragmentShader: WET_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: true,
    // Just above the soil. The offset keeps it from flickering against the block's top from far away.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const plants = new THREE.Mesh(undefined, plantMaterial);
  const wet = new THREE.Mesh(undefined, wetMaterial);
  plants.name = 'crops';
  wet.name = 'wet-soil';
  for (const mesh of [plants, wet]) {
    // Crops are wherever the player farms, so there is no box to test against the view. It is one draw call either way.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
  }
  // The patch is drawn before other see-through things such as water spray and rain.
  wet.renderOrder = -1;

  let plantBuffer: THREE.InstancedInterleavedBuffer | null = null;
  let wetBuffer: THREE.InstancedBufferAttribute | null = null;
  let plantRoom = 0, wetRoom = 0;

  const meshes: CropMeshes = {
    plants,
    wet,
    plantData: new Float32Array(0),
    wetData: new Float32Array(0),

    reserve(plantCount, wetCount) {
      if (plantCount > plantRoom) {
        plantRoom = Math.max(64, plantRoom);
        while (plantRoom < plantCount) plantRoom *= 2;
        const data = new Float32Array(plantRoom * PLANT_STRIDE);
        data.set(meshes.plantData);
        meshes.plantData = data;
        plantBuffer = new THREE.InstancedInterleavedBuffer(data, PLANT_STRIDE);
        plantBuffer.setUsage(THREE.DynamicDrawUsage);
        const geometry = new THREE.InstancedBufferGeometry();
        geometry.setIndex(index);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('aCrop', new THREE.Float32BufferAttribute(cropTags, 2));
        geometry.setAttribute('aPlace', new THREE.InterleavedBufferAttribute(plantBuffer, 4, 0));
        geometry.setAttribute('aTile', new THREE.InterleavedBufferAttribute(plantBuffer, 4, 4));
        geometry.setAttribute('aLight', new THREE.InterleavedBufferAttribute(plantBuffer, 2, 8));
        geometry.instanceCount = 0;
        plants.geometry.dispose();
        plants.geometry = geometry;
      }
      if (wetCount > wetRoom) {
        wetRoom = Math.max(64, wetRoom);
        while (wetRoom < wetCount) wetRoom *= 2;
        const data = new Float32Array(wetRoom * WET_STRIDE);
        data.set(meshes.wetData);
        meshes.wetData = data;
        wetBuffer = new THREE.InstancedBufferAttribute(data, WET_STRIDE);
        wetBuffer.setUsage(THREE.DynamicDrawUsage);
        const geometry = new THREE.InstancedBufferGeometry();
        // A flat square the size of a block's top, facing up.
        geometry.setIndex([0, 2, 1, 0, 3, 2]);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
        geometry.setAttribute('aSpot', wetBuffer);
        geometry.instanceCount = 0;
        wet.geometry.dispose();
        wet.geometry = geometry;
      }
    },

    commit(plantCount, wetCount, plantsChanged, wetChanged) {
      if (plantBuffer && plantsChanged) plantBuffer.needsUpdate = true;
      if (wetBuffer && wetChanged) wetBuffer.needsUpdate = true;
      (plants.geometry as THREE.InstancedBufferGeometry).instanceCount = plantCount;
      (wet.geometry as THREE.InstancedBufferGeometry).instanceCount = wetCount;
      plants.visible = plantCount > 0;
      wet.visible = wetCount > 0;
    },

    frame(time, windX, windZ, wind, sky) {
      plantUniforms.uTime.value = time;
      plantUniforms.uWind.value.set(windX, windZ, wind);
      plantUniforms.uSky.value.copy(sky);
      wetUniforms.uSky.value.copy(sky);
    },
  };
  meshes.reserve(1, 1);
  return meshes;
}
