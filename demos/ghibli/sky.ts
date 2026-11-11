// The sky, its painted clouds and the far ridges. The sky is a washed gradient, deep blue overhead and
// pale at the horizon. Each cloud is one painting on a card, far away. Three rings of hills stand behind
// the land, and the haze turns each one paler and bluer than the one in front.
import * as THREE from 'three';
import { fbm } from './land.ts';
import { paint } from './paint.ts';
import type { Textures } from './textures.ts';

export interface SkyColors { zenith: THREE.Color; mid: THREE.Color; horizon: THREE.Color; glow: THREE.Color; cloud: THREE.Color; haze: THREE.Color }

export interface Sky {
  group: THREE.Group;
  /** Call every frame: the sky stays round the camera and the clouds drift. */
  update(camera: THREE.Camera, dt: number): void;
  setColors(colors: SkyColors, sunDirection: THREE.Vector3): void;
}

/** One cloud: which painting, where on the compass (0 is north), how high in degrees, how far, how wide. */
const CLOUDS: Array<[number, number, number, number, number]> = [
  [5, -30, 5, 950, 640], [0, 28, 6, 900, 330], [1, 4, 19, 820, 520], [2, -66, 13, 860, 300], [3, 58, 23, 780, 300], [3, -8, 36, 700, 230],
  [4, -48, 2, 1000, 760], [4, 22, 2, 1000, 700], [4, 84, 2.5, 1000, 720], [1, 118, 14, 850, 480], [2, 158, 20, 800, 280], [4, 150, 2, 1000, 700],
  [0, -150, 8, 900, 360], [1, -112, 17, 840, 460], [4, -105, 2, 1000, 740], [2, 96, 30, 760, 240], [5, 200, 6, 950, 560], [3, -170, 27, 780, 280],
];

function ridge(radius: number, base: number, amp: number, seed: number, low: string, high: string): THREE.Mesh {
  const segments = 220, positions: number[] = [], normals: number[] = [], colors: number[] = [], index: number[] = [];
  const cLow = new THREE.Color(low), cHigh = new THREE.Color(high), n = new THREE.Vector3();
  const top = (a: number): number => base + amp * fbm(Math.cos(a) * 2.2 + 7, Math.sin(a) * 2.2 + 3, 4, seed) + amp * 0.08 * fbm(a * 60, seed, 2, seed + 5);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a), h = top(a);
    // A slope that faces the sun is lighter: the normal leans the way the ridge line falls.
    const fall = (top(a + 0.02) - top(a - 0.02)) / (0.04 * radius) * 9;
    n.set(-cos * 0.55 - sin * fall, 0.8, -sin * 0.55 + cos * fall).normalize();
    positions.push(cos * radius, -14, sin * radius, cos * (radius + amp * 0.9), h, sin * (radius + amp * 0.9));
    for (const c of [cLow, cHigh]) { normals.push(n.x, n.y, n.z); colors.push(c.r, c.g, c.b); }
    if (i < segments) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  const mesh = new THREE.Mesh(g, paint({ vertexColors: true, side: THREE.DoubleSide, keepNormal: true, brush: 0.5, bands: 0.6, wrap: 0.2, brushScale: 0.012 }));
  mesh.name = 'ridge';
  return mesh;
}

export function createSky(textures: Textures): Sky {
  const group = new THREE.Group();
  const uniforms = {
    uZenith: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uBrush: { value: textures.brush },
  };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uMid, uHorizon, uGlow, uSun;
      uniform sampler2D uBrush;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        // The wash is laid with a wide brush: the bands between the blues are not straight.
        float wash = texture2D(uBrush, vec2(atan(d.z, d.x) * 0.9, d.y * 1.6)).r - 0.5;
        float h = d.y + wash * 0.05;
        vec3 color = mix(uHorizon, uMid, smoothstep(-0.02, 0.26, h));
        color = mix(color, uZenith, smoothstep(0.2, 0.8, h));
        color *= 1.0 + wash * 0.05;
        float s = max(dot(d, uSun), 0.0);
        color += uGlow * (pow(s, 12.0) * 0.22 + pow(s, 90.0) * 0.5 + smoothstep(0.9993, 0.9997, s) * 3.0);
        gl_FragColor = vec4(color, 1.0);
      }`,
  }));
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  const clouds = new THREE.Group(), cloudUniforms: Array<{ uTint: THREE.IUniform<THREE.Color>; uHaze: THREE.IUniform<THREE.Color> }> = [];
  for (const [which, compass, lift, distance, width] of CLOUDS) {
    const map = textures.clouds[which] as THREE.Texture, image = map.image as { width: number; height: number };
    const height = width * image.height / image.width, a = THREE.MathUtils.degToRad(compass);
    const own = { map: { value: map }, uTint: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uHazeAmt: { value: THREE.MathUtils.clamp(0.62 - lift * 0.022, 0.08, 0.6) } };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.ShaderMaterial({
      uniforms: own, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D map; uniform vec3 uTint, uHaze; uniform float uHazeAmt; varying vec2 vUv;
        void main() {
          vec4 t = texture2D(map, vUv);
          // A cloud low on the horizon sinks into the haze, most of all at its base.
          gl_FragColor = vec4(mix(t.rgb * uTint, uHaze, uHazeAmt * (1.0 - vUv.y * 0.6)), t.a);
        }`,
    }));
    mesh.position.set(Math.sin(a) * distance, distance * Math.tan(THREE.MathUtils.degToRad(lift)) + height / 2, -Math.cos(a) * distance);
    mesh.lookAt(0, mesh.position.y, 0);
    mesh.renderOrder = -5 - distance / 1000;
    cloudUniforms.push(own);
    clouds.add(mesh);
  }
  group.add(clouds);

  group.add(ridge(152, 15, 17, 3, '#7fb356', '#3f8449'), ridge(265, 22, 44, 11, '#5f9a58', '#3c7a52'), ridge(440, 30, 105, 23, '#55906a', '#3f7a66'));

  return {
    group,
    update(camera, dt) {
      dome.position.copy(camera.position);
      clouds.rotation.y += dt * 0.0016;
    },
    setColors(colors, sunDirection) {
      uniforms.uZenith.value.copy(colors.zenith); uniforms.uMid.value.copy(colors.mid); uniforms.uHorizon.value.copy(colors.horizon);
      uniforms.uGlow.value.copy(colors.glow); uniforms.uSun.value.copy(sunDirection);
      for (const u of cloudUniforms) { u.uTint.value.copy(colors.cloud); u.uHaze.value.copy(colors.haze); }
    },
  };
}
