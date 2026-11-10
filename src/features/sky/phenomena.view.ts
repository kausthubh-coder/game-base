// The lightning bolt, the rainbow and the dawn light shafts: three kinds of glowing shape in one mesh, so all
// three together cost one draw call, and none at all when nothing is showing.
import * as THREE from 'three';

const BOLT_MAIN = 14;
const BOLT_BRANCH = 5;
const BOLT_BRANCHES = 2;
const BOLT_SEGMENTS = BOLT_MAIN + BOLT_BRANCH * BOLT_BRANCHES;
const BOLT_HEIGHT = 70;
const SHAFTS = 10;
const SHAFT_LENGTH = 26;
/** Shafts stand on a grid this many meters wide, so they hold still as the target moves. */
const SHAFT_GRID = 8;

const KIND_BOLT = 0;
const KIND_RAINBOW = 1;
const KIND_SHAFT = 2;

const VERTEX = /* glsl */ `
attribute vec2 aUv;
attribute float aKind;
attribute vec4 aData;
uniform float uBolt, uRainbow, uShafts, uRainbowRadius;
uniform vec3 uRainbowCenter, uShaftAnchor, uShaftDir;
varying vec2 vUv;
varying float vKind;
varying float vSeed;

void main() {
  vUv = aUv;
  vKind = aKind;
  vSeed = aData.z;
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 camBack = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec3 world;
  float on;
  if (aKind < 0.5) {
    // The bolt: a ribbon along a path worked out when it struck.
    world = position + camRight * aData.x * aData.y * 1.2;
    on = uBolt;
  } else if (aKind < 1.5) {
    // The rainbow: an arc that faces the camera.
    world = uRainbowCenter + (camRight * position.x + camUp * position.y) * uRainbowRadius;
    on = uRainbow;
  } else {
    // A shaft: a long quad from the ground toward the sun, turned about its length to face the camera.
    vec3 base = uShaftAnchor + vec3(aData.x, 0.0, aData.y);
    vec3 side = normalize(cross(uShaftDir, camBack));
    world = base + uShaftDir * position.y * ${SHAFT_LENGTH.toFixed(1)} * aData.w + side * position.x * (1.0 + vSeed * 1.4);
    on = uShafts;
  }
  // Whatever is not showing collapses to nothing.
  gl_Position = on > 0.002 ? projectionMatrix * viewMatrix * vec4(world, 1.0) : vec4(0.0, 0.0, 2.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform float uBolt, uRainbow, uShafts, uTime;
uniform vec3 uShaftColor;
varying vec2 vUv;
varying float vKind;
varying float vSeed;

void main() {
  vec3 color;
  if (vKind < 0.5) {
    float across = abs(vUv.x);
    float core = smoothstep(0.2, 0.0, across);
    float halo = pow(1.0 - across, 3.0) * 0.4;
    color = vec3(0.78, 0.84, 1.0) * (core * 6.0 + halo * 2.0) * uBolt;
  } else if (vKind < 1.5) {
    // Bands by distance from the middle of the base: red outside, violet inside.
    float r = length(vUv);
    float band = clamp((r - 0.8) / 0.18, 0.0, 1.0);
    float hue = (1.0 - band) * 0.78;
    vec3 spectrum = clamp(abs(fract(hue + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
    float arc = sin(band * 3.14159) * step(0.8, r) * step(r, 0.98);
    color = spectrum * arc * smoothstep(0.0, 0.25, vUv.y) * uRainbow * 0.26;
  } else {
    float across = 1.0 - vUv.x * vUv.x;
    float along = smoothstep(0.0, 0.12, vUv.y) * pow(1.0 - vUv.y, 0.8);
    float shimmer = 0.75 + 0.25 * sin(uTime * 0.6 + vSeed * 40.0);
    color = uShaftColor * across * across * along * shimmer * uShafts * 0.16;
  }
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export interface PhenomenaFrame {
  /** Seconds since the game started. */
  time: number;
  /** The point the camera follows. */
  target: THREE.Vector3;
  /** From the ground toward the sun. */
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  rainbow: number;
  /** The middle of the rainbow's base, and how far it reaches from there. */
  rainbowCenter: THREE.Vector3;
  rainbowRadius: number;
  shafts: number;
}

export interface Phenomena {
  readonly mesh: THREE.Mesh;
  /** Draws a new bolt down to this point. */
  strike(x: number, y: number, z: number): void;
  update(dt: number, frame: PhenomenaFrame): void;
  dispose(): void;
}

export function createPhenomena(): Phenomena {
  const quads = BOLT_SEGMENTS + 1 + SHAFTS;
  const positions = new Float32Array(quads * 4 * 3);
  const uvs = new Float32Array(quads * 4 * 2);
  const kinds = new Float32Array(quads * 4);
  const data = new Float32Array(quads * 4 * 4);
  const index = new Uint16Array(quads * 6);
  for (let q = 0; q < quads; q++) index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3], q * 6);

  // Corner order for every quad: left and right at the start, left and right at the end.
  const corner = (quad: number, c: number, x: number, y: number, z: number, u: number, v: number, kind: number, d0 = 0, d1 = 0, d2 = 0, d3 = 0) => {
    const i = quad * 4 + c;
    positions.set([x, y, z], i * 3);
    uvs.set([u, v], i * 2);
    kinds[i] = kind;
    data.set([d0, d1, d2, d3], i * 4);
  };

  for (let q = 0; q < BOLT_SEGMENTS; q++) {
    const width = q < BOLT_MAIN ? 1 : 0.5;
    for (let c = 0; c < 4; c++) corner(q, c, 0, 0, 0, c % 2 === 0 ? -1 : 1, c < 2 ? 0 : 1, KIND_BOLT, c % 2 === 0 ? -1 : 1, width);
  }
  const rainbowQuad = BOLT_SEGMENTS;
  corner(rainbowQuad, 0, -1, 0, 0, -1, 0, KIND_RAINBOW);
  corner(rainbowQuad, 1, 1, 0, 0, 1, 0, KIND_RAINBOW);
  corner(rainbowQuad, 2, -1, 1, 0, -1, 1, KIND_RAINBOW);
  corner(rainbowQuad, 3, 1, 1, 0, 1, 1, KIND_RAINBOW);
  for (let s = 0; s < SHAFTS; s++) {
    // Fixed places around the anchor, spread so they do not line up.
    const turn = s * 2.399963 + 0.7;
    const reach = 4 + ((s * 7) % SHAFTS) * 1.9;
    const offsetX = Math.cos(turn) * reach;
    const offsetZ = Math.sin(turn) * reach;
    const seed = ((s * 0.618034) % 1) + 0.01;
    const length = 0.7 + 0.3 * ((s * 0.382) % 1);
    const quad = BOLT_SEGMENTS + 1 + s;
    corner(quad, 0, -0.5, 0, 0, -1, 0, KIND_SHAFT, offsetX, offsetZ, seed, length);
    corner(quad, 1, 0.5, 0, 0, 1, 0, KIND_SHAFT, offsetX, offsetZ, seed, length);
    corner(quad, 2, -0.5, 1, 0, -1, 1, KIND_SHAFT, offsetX, offsetZ, seed, length);
    corner(quad, 3, 0.5, 1, 0, 1, 1, KIND_SHAFT, offsetX, offsetZ, seed, length);
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
  geometry.setAttribute('aData', new THREE.BufferAttribute(data, 4));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));

  const uniforms = {
    uBolt: { value: 0 },
    uRainbow: { value: 0 },
    uShafts: { value: 0 },
    uTime: { value: 0 },
    uRainbowRadius: { value: 12 },
    uRainbowCenter: { value: new THREE.Vector3() },
    uShaftAnchor: { value: new THREE.Vector3() },
    uShaftDir: { value: new THREE.Vector3(0, 1, 0) },
    uShaftColor: { value: new THREE.Color(1, 1, 1) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sky-phenomena';
  mesh.frustumCulled = false;
  mesh.renderOrder = 60;
  mesh.visible = false;

  let bolt = 0;
  let seed = 12345;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // The path of the bolt and its branches, reused for every strike.
  const path = new Float32Array((BOLT_MAIN + 1) * 3);
  function segment(quad: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    const o = quad * 12;
    positions[o] = positions[o + 3] = ax;
    positions[o + 1] = positions[o + 4] = ay;
    positions[o + 2] = positions[o + 5] = az;
    positions[o + 6] = positions[o + 9] = bx;
    positions[o + 7] = positions[o + 10] = by;
    positions[o + 8] = positions[o + 11] = bz;
  }

  return {
    mesh,

    strike(x, y, z) {
      const leanX = (random() - 0.5) * 18;
      const leanZ = (random() - 0.5) * 18;
      for (let i = 0; i <= BOLT_MAIN; i++) {
        const t = i / BOLT_MAIN;
        const jag = Math.sin(t * Math.PI) * 3.2 + 0.4 * (1 - t);
        path[i * 3] = x + leanX * (1 - t) + (random() - 0.5) * 2 * jag;
        path[i * 3 + 1] = y + BOLT_HEIGHT * (1 - t);
        path[i * 3 + 2] = z + leanZ * (1 - t) + (random() - 0.5) * 2 * jag;
      }
      path[BOLT_MAIN * 3] = x;
      path[BOLT_MAIN * 3 + 2] = z;
      for (let i = 0; i < BOLT_MAIN; i++) {
        segment(i, path[i * 3], path[i * 3 + 1], path[i * 3 + 2], path[i * 3 + 3], path[i * 3 + 4], path[i * 3 + 5]);
      }
      for (let b = 0; b < BOLT_BRANCHES; b++) {
        const from = 3 + b * 4 + Math.floor(random() * 2);
        let px = path[from * 3], py = path[from * 3 + 1], pz = path[from * 3 + 2];
        const turn = random() * Math.PI * 2;
        for (let i = 0; i < BOLT_BRANCH; i++) {
          const nx = px + Math.cos(turn) * (2.5 + random() * 2) + (random() - 0.5) * 2;
          const ny = py - (2.5 + random() * 2.5);
          const nz = pz + Math.sin(turn) * (2.5 + random() * 2) + (random() - 0.5) * 2;
          segment(BOLT_MAIN + b * BOLT_BRANCH + i, px, py, pz, nx, ny, nz);
          px = nx;
          py = ny;
          pz = nz;
        }
      }
      positionAttribute.needsUpdate = true;
      bolt = 1;
    },

    update(dt, frame) {
      bolt = Math.max(0, bolt - dt * 4);
      uniforms.uBolt.value = bolt > 0 ? bolt * (0.6 + 0.4 * Math.sin(frame.time * 70)) : 0;
      uniforms.uRainbow.value = frame.rainbow;
      uniforms.uShafts.value = frame.shafts;
      uniforms.uTime.value = frame.time % 1024;
      mesh.visible = bolt > 0 || frame.rainbow > 0.002 || frame.shafts > 0.002;
      if (!mesh.visible) return;

      uniforms.uRainbowCenter.value.copy(frame.rainbowCenter);
      uniforms.uRainbowRadius.value = frame.rainbowRadius;
      const sun = frame.sunDirection;

      uniforms.uShaftAnchor.value.set(Math.round(frame.target.x / SHAFT_GRID) * SHAFT_GRID, frame.target.y, Math.round(frame.target.z / SHAFT_GRID) * SHAFT_GRID);
      uniforms.uShaftDir.value.copy(sun);
      uniforms.uShaftColor.value.copy(frame.sunColor);
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
