// The pond. Everything comes from how deep the water is at a spot: its colour from shallow to deep, the
// pale line where it meets the bank, and where the painted ripples show. Hard steps, not smooth physics,
// make it read as drawn.
import * as THREE from 'three';
import { POND, WATER_Y, pondDepthTexture } from './land.ts';
import { shared } from './paint.ts';

export interface Water { mesh: THREE.Mesh; setColors(shallow: string, deep: string, foam: string, skyLow: THREE.Color, skyHigh: THREE.Color): void }

export function createWater(): Water {
  const depth = pondDepthTexture();
  const uniforms = {
    ...shared,
    uDepth: { value: depth.texture }, uMin: { value: depth.min }, uSize: { value: depth.size },
    uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() },
    uSkyLow: { value: new THREE.Color() }, uSkyHigh: { value: new THREE.Color() }, uBank: { value: new THREE.Color('#5f9a4c') },
  };
  const geometry = new THREE.CircleGeometry(POND.radius * 1.6, 40).rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec3 vWorld; void main() { vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uDepth, uBrush, uCloudMap;
      uniform vec2 uMin;
      uniform float uSize, uTime, uHazeDensity, uHazeMax, uHazeStart;
      uniform vec3 uShallow, uDeep, uFoam, uSkyLow, uSkyHigh, uHaze, uBank;
      varying vec3 vWorld;
      void main() {
        float depth = texture2D(uDepth, (vWorld.xz - uMin) / uSize).r;
        float wobble = texture2D(uBrush, vWorld.xz * 0.06 + uTime * 0.008).r - 0.5;
        vec3 color = mix(uShallow, uDeep, smoothstep(0.05, 1.25, depth + wobble * 0.5));
        // The sky lies on the water, more of it the flatter you look across.
        vec3 view = normalize(cameraPosition - vWorld);
        float across = pow(1.0 - max(view.y, 0.0), 2.5);
        vec3 mirror = mix(uSkyLow, uSkyHigh, 0.35 + wobble);
        // Walk the mirrored line of sight over the ground round the pond: where it meets a bank, the water shows the bank.
        vec2 along = normalize(-view.xz);
        float rise = view.y / max(length(view.xz), 0.001), bank = 0.0;
        for (int i = 1; i <= 8; i++) {
          float s = float(i) * 4.5;
          float ground = -texture2D(uDepth, (vWorld.xz + along * (s + wobble * 3.0) - uMin) / uSize).r;
          bank = max(bank, smoothstep(-0.2, 0.8, ground - s * rise));
        }
        mirror = mix(mirror, uBank, bank * 0.85);
        color = mix(color, mirror, 0.15 + 0.55 * across);
        // Ripples: long thin dashes that slide across, cut hard.
        float dash = texture2D(uCloudMap, vec2(vWorld.x * 0.035 + uTime * 0.012, vWorld.z * 0.55 - uTime * 0.03)).r;
        float patches = texture2D(uCloudMap, vWorld.xz * 0.09 + uTime * 0.004).r;
        color = mix(color, uFoam, smoothstep(0.86, 0.875, dash) * smoothstep(0.5, 0.56, patches) * 0.8 * smoothstep(0.1, 0.5, depth));
        // The shore line breathes in and out a little.
        float edge = 0.07 + 0.035 * sin(uTime * 0.9 + vWorld.x * 0.8 + vWorld.z * 0.6) + wobble * 0.08;
        color = mix(color, uFoam, (1.0 - smoothstep(edge, edge + 0.03, depth)) * 0.7);
        float d = max(0.0, distance(vWorld, cameraPosition) - uHazeStart);
        gl_FragColor = vec4(mix(color, uHaze, (1.0 - exp(-d * uHazeDensity)) * uHazeMax), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(POND.x, WATER_Y, POND.z);
  mesh.name = 'pond';
  return {
    mesh,
    setColors(shallow, deep, foam, skyLow, skyHigh) {
      uniforms.uShallow.value.set(shallow); uniforms.uDeep.value.set(deep); uniforms.uFoam.value.set(foam);
      uniforms.uSkyLow.value.copy(skyLow); uniforms.uSkyHigh.value.copy(skyHigh);
    },
  };
}
