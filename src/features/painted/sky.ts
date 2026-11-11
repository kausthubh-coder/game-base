// What stands behind the land: three rings of far hills and the painted clouds. The game's own sky draws the
// blue, the sun, the moon and the stars. The far land (far.ts) ends about three hundred blocks from the hero,
// and these hills rise behind it, each ring paler and bluer than the one in front. Each cloud is one painting on a card.
//
// Everything here follows the hero, like a backdrop, and sits inside the camera's far plane.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm } from './land.ts';
import { paint } from './paint.ts';
import type { Textures } from './textures.ts';

export interface Backdrop {
  readonly group: THREE.Group;
  /**
   * Call every frame with the hero's place and the height of the land there: the hills stand round it and the
   * clouds drift. `down` is how steeply the camera looks down, 0 level to 1 straight down.
   */
  update(x: number, y: number, z: number, dt: number, down: number): void;
  /** `cloud` tints the clouds, `haze` is what the far things sink into, `fair` is 0 under a grey sky to 1 on a fair day. */
  setColors(cloud: THREE.Color, haze: THREE.Color, fair: number): void;
}

/** One cloud: which painting, where on the compass (0 is north), how high in degrees, how far, how wide. */
const CLOUDS: Array<[number, number, number, number, number]> = [
  [5, -30, 5, 950, 640], [0, 28, 6, 900, 330], [1, 4, 19, 820, 520], [2, -66, 13, 860, 300], [3, 58, 23, 780, 300], [3, -8, 36, 700, 230],
  [4, -48, 2, 1000, 760], [4, 22, 2, 1000, 700], [4, 84, 2.5, 1000, 720], [1, 118, 14, 850, 480], [2, 158, 20, 800, 280], [4, 150, 2, 1000, 700],
  [0, -150, 8, 900, 360], [1, -112, 17, 840, 460], [4, -105, 2, 1000, 740], [2, 96, 30, 760, 240], [5, 200, 6, 950, 560], [3, -170, 27, 780, 280],
];
/** The clouds were laid out for a far plane of 3,000. The game's is 760, so they stand nearer and smaller, the same size to the eye, and still behind the last ridge. */
const NEAR = 0.7;

/** 0 when the camera looks level and 1 when it looks down on the land: then the far hills are all haze, as the land's edge is. */
const DOWN = { value: 0 };

function ridge(radius: number, base: number, amp: number, seed: number, low: string, high: string, hazeHigh: number): THREE.BufferGeometry {
  const segments = 180, positions: number[] = [], normals: number[] = [], colors: number[] = [], haze: number[] = [], index: number[] = [];
  const cLow = new THREE.Color(low), cHigh = new THREE.Color(high), n = new THREE.Vector3();
  const top = (a: number): number => base + amp * fbm(Math.cos(a) * 2.2 + 7, Math.sin(a) * 2.2 + 3, 4, seed) + amp * 0.08 * fbm(a * 60, seed, 2, seed + 5);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a), h = top(a);
    // A slope that faces the sun is lighter: the normal leans the way the ridge line falls.
    const fall = (top(a + 0.02) - top(a - 0.02)) / (0.04 * radius) * 9;
    n.set(-cos * 0.55 - sin * fall, 0.8, -sin * 0.55 + cos * fall).normalize();
    // Three rows: far below the land, level with it, and the crest. The foot of a hill is lost in the haze up to
    // the level of the land, and its crest stands clear of it.
    positions.push(cos * radius, -60, sin * radius, cos * radius, 2, sin * radius, cos * (radius + amp * 0.5), h, sin * (radius + amp * 0.5));
    for (const c of [cLow, cLow, cHigh]) { normals.push(n.x, n.y, n.z); colors.push(c.r, c.g, c.b); }
    haze.push(1, 0.94, hazeHigh);
    if (i < segments) for (const r of [0, 1]) index.push(i * 3 + r, i * 3 + r + 1, i * 3 + r + 3, i * 3 + r + 1, i * 3 + r + 4, i * 3 + r + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('aHaze', new THREE.Float32BufferAttribute(haze, 1));
  g.setIndex(index);
  return g;
}

export function createBackdrop(textures: Textures): Backdrop {
  const group = new THREE.Group();
  group.name = 'backdrop';

  // All the clouds are one mesh too: each card says which painting it shows. The farthest come first, so a
  // near cloud is drawn over a far one.
  const cards: THREE.BufferGeometry[] = [], card = new THREE.Object3D();
  for (const [which, compass, lift, far, wide] of [...CLOUDS].sort((a, b) => b[3] - a[3])) {
    const image = (textures.clouds[which] as THREE.Texture).image as { width: number; height: number };
    const distance = far * NEAR, width = wide * NEAR, height = width * image.height / image.width, a = THREE.MathUtils.degToRad(compass);
    card.position.set(Math.sin(a) * distance, distance * Math.tan(THREE.MathUtils.degToRad(lift)) + height / 2, -Math.cos(a) * distance);
    card.lookAt(0, card.position.y, 0);
    card.updateMatrix();
    const g = new THREE.PlaneGeometry(width, height).applyMatrix4(card.matrix);
    // Which painting, and how far the cloud sinks into the haze: a cloud low on the horizon sinks most.
    const own = new Float32Array(8);
    for (let i = 0; i < 4; i++) { own[i * 2] = which; own[i * 2 + 1] = THREE.MathUtils.clamp(0.62 - lift * 0.022, 0.08, 0.6); }
    g.setAttribute('aCloud', new THREE.BufferAttribute(own, 2));
    cards.push(g);
  }
  const cloudUniforms = { uMaps: { value: textures.clouds.slice(0, 6) }, uTint: { value: new THREE.Color(1, 1, 1) }, uHaze: { value: new THREE.Color() }, uFair: { value: 1 } };
  const clouds = new THREE.Mesh(mergeGeometries(cards), new THREE.ShaderMaterial({
    uniforms: cloudUniforms, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'attribute vec2 aCloud; varying vec2 vUv, vCloud; void main() { vUv = uv; vCloud = aCloud; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uMaps[6]; uniform vec3 uTint, uHaze; uniform float uFair; varying vec2 vUv, vCloud;
      void main() {
        vec4 t = vCloud.x < 0.5 ? texture2D(uMaps[0], vUv) : vCloud.x < 1.5 ? texture2D(uMaps[1], vUv) : vCloud.x < 2.5 ? texture2D(uMaps[2], vUv)
          : vCloud.x < 3.5 ? texture2D(uMaps[3], vUv) : vCloud.x < 4.5 ? texture2D(uMaps[4], vUv) : texture2D(uMaps[5], vUv);
        // Most of all at its base.
        gl_FragColor = vec4(mix(t.rgb * uTint, uHaze, vCloud.y * (1.0 - vUv.y * 0.6)), t.a * uFair);
      }`,
  }));
  clouds.name = 'clouds';
  clouds.frustumCulled = false;
  clouds.renderOrder = -6;
  // The three rings are one mesh, so they cost one draw call.
  const ridges = new THREE.Mesh(mergeGeometries([
    ridge(330, 8, 34, 3, '#6fa85a', '#3f8449', 0.6),
    ridge(440, 12, 70, 11, '#5f9a62', '#3c7a5a', 0.72),
    ridge(560, 16, 130, 23, '#55906e', '#3f7a6e', 0.82),
  ]), paint({
    vertexColors: true, side: THREE.DoubleSide, keepNormal: true, brush: 0.5, bands: 0.6, wrap: 0.2, brushScale: 0.012, fog: false,
    vertexPars: 'attribute float aHaze; varying float vHazeAmt;',
    vertexBegin: 'vHazeAmt = aHaze;',
    uniforms: { uDown: DOWN },
    fragmentPars: 'varying float vHazeAmt; uniform float uDown;',
    // A far hill is not hazed by its distance, as the land is: it follows the hero. It sinks into the haze by a
    // set amount, all the way at its foot.
    fragmentFinal: 'float hazed = clamp(max(vHazeAmt, uDown), 0.0, 1.0); vec3 outgoingLight = mix(paintShade(diffuseColor.rgb, paintLit(0.0)), mix(uHazeNear, uHaze, smoothstep(0.55, 0.95, hazed)), hazed);',
  }));
  ridges.name = 'ridges';
  ridges.frustumCulled = false;
  ridges.renderOrder = -4;
  group.add(clouds, ridges);

  return {
    group,
    update(x, y, z, dt, down) {
      group.position.set(x, y, z);
      DOWN.value = Math.min(1, Math.max(0, (down - 0.3) / 0.22));
      clouds.rotation.y += dt * 0.0016;
    },
    setColors(cloud, haze, fair) {
      cloudUniforms.uTint.value.copy(cloud); cloudUniforms.uHaze.value.copy(haze); cloudUniforms.uFair.value = fair;
    },
  };
}
