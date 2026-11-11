// What stands behind the land: three rings of far hills and the sky's clouds. The game's own sky draws the
// blue, the sun, the moon and the stars, and leaves its clouds out. The clouds here are two layers that follow
// the weather and the hour: painted cumulus, each a painting on a card, and a high layer over them.
//
// The far land (far.ts) ends about three hundred blocks from the hero, and the hills rise behind it, each
// ring paler and bluer than the one in front.
//
// Everything here follows the hero, like a backdrop, and sits inside the camera's far plane.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm } from './land.ts';
import { paint, shared } from './paint.ts';
import type { Textures } from './textures.ts';

/** What the sky is doing, for the clouds to follow. The same object can be handed over every frame. */
export interface SkyWeather {
  /** The share of the painted clouds that stand in the sky, 0 to 1 and a little over. */
  show: number;
  /** How far the high layer has closed, 0 an open sky to 1 a deck from horizon to horizon. */
  deck: number;
  /** How much of the high layer is thin streaks, 0 to 1: the look of a fair day. */
  wisp: number;
  /** 0 fair to 1 rain: the undersides go dark and the lit sides flat. */
  storm: number;
  /** A cloud's lit side, its shaded side, and the rim it has toward the sun or the moon. Linear colours. */
  light: THREE.Color;
  shade: THREE.Color;
  rim: THREE.Color;
  /** What far things sink into. */
  haze: THREE.Color;
  /** The way to the sun by day and the moon at night. */
  sun: THREE.Vector3;
  /** Lightning, 0 to 1. */
  flash: number;
  /** The way the wind blows along the ground (x, z), and how fast the clouds drift, in turns of the sky a second. */
  windX: number;
  windZ: number;
  drift: number;
}

export interface Backdrop {
  readonly group: THREE.Group;
  /**
   * Call every frame with the hero's place and the height of the land there: the hills stand round it and the
   * clouds drift. `down` is how steeply the camera looks down, 0 level to 1 straight down.
   */
  update(x: number, y: number, z: number, dt: number, down: number): void;
  /** Call every frame with what the sky is doing. */
  setSky(weather: SkyWeather): void;
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

/** One ring of far hills. `hazeLow` is how far its foot has sunk into the air and `hazeHigh` its crest, 0 to 1. */
function ridge(radius: number, base: number, amp: number, seed: number, low: string, high: string, hazeLow: number, hazeHigh: number): THREE.BufferGeometry {
  const segments = 180, positions: number[] = [], normals: number[] = [], colors: number[] = [], haze: number[] = [], index: number[] = [];
  const cLow = new THREE.Color(low), cHigh = new THREE.Color(high), n = new THREE.Vector3();
  const top = (a: number): number => base + amp * fbm(Math.cos(a) * 2.2 + 7, Math.sin(a) * 2.2 + 3, 4, seed) + amp * 0.08 * fbm(a * 60, seed, 2, seed + 5);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a), h = top(a);
    // A slope that faces the sun is lighter: the normal leans the way the ridge line falls.
    const fall = (top(a + 0.02) - top(a - 0.02)) / (0.04 * radius) * 9;
    n.set(-cos * 0.55 - sin * fall, 0.8, -sin * 0.55 + cos * fall).normalize();
    // Three rows: far below the land, level with it, and the crest. The nearest ring's foot is as green as the
    // far land that ends in front of it, so the land seems to run on into it.
    positions.push(cos * radius, -60, sin * radius, cos * radius, 2, sin * radius, cos * (radius + amp * 0.5), h, sin * (radius + amp * 0.5));
    for (const c of [cLow, cLow, cHigh]) { normals.push(n.x, n.y, n.z); colors.push(c.r, c.g, c.b); }
    haze.push(hazeLow, hazeLow, hazeHigh);
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

/** The order the painted clouds come in as the sky fills: a number from 0 (always there) to 1 (only in a full sky) for each. */
function ranks(count: number): number[] {
  // The low banks along the horizon are there first, one in three. The rest follow in an order that spreads them round the compass.
  const order = CLOUDS.map((c, i) => ({ i, first: c[2] < 4 && i % 3 === 1 ? 0 : 1, turn: (i * 7) % count }));
  order.sort((a, b) => a.first - b.first || a.turn - b.turn);
  const out = new Array<number>(count);
  order.forEach((o, n) => { out[o.i] = n / (count - 1); });
  return out;
}

export function createBackdrop(textures: Textures): Backdrop {
  const group = new THREE.Group();
  group.name = 'backdrop';
  const sky = {
    uShow: { value: 0.5 }, uDeck: { value: 0 }, uWisp: { value: 0.5 }, uStorm: { value: 0 }, uFlash: { value: 0 },
    uLight: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.6, 0.68, 0.85) }, uRim: { value: new THREE.Color(1, 1, 0.9) },
    uSkyHaze: { value: new THREE.Color(0.8, 0.88, 0.95) }, uSun: { value: new THREE.Vector3(0.4, 0.8, 0.4) }, uScroll: { value: new THREE.Vector4() },
  };
  /** A cloud's own colours from its painting's light and dark, the same for both layers. `k` is 0 in its shade to 1 on its lit side. */
  const TONES = /* glsl */ `
    uniform vec3 uLight, uShade, uRim, uSkyHaze, uSun;
    uniform float uStorm, uFlash;
    vec3 cloudTone(float k, float toward) {
      // Rain flattens the lit side and darkens the underside.
      vec3 c = mix(uShade * (1.0 - 0.3 * uStorm), uLight, k * (1.0 - 0.35 * uStorm));
      // The side toward the sun or the moon catches its colour.
      c += uRim * toward * toward * toward * (0.2 + 0.8 * k) * 0.4 * (1.0 - uStorm);
      return c + vec3(0.8, 0.85, 1.0) * uFlash * 0.6;
    }`;

  // ---- the high layer: a dome over the hero. On a fair day it carries thin streaks. As the cover grows it
  // closes into soft billows, and in rain into a deck from horizon to horizon. It is drawn before the painted
  // clouds, which stand in front of it.
  const veil = new THREE.Mesh(new THREE.SphereGeometry(690, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { ...sky, uNoise: shared.uCloudMap, uBrush: shared.uBrush },
    transparent: true, depthWrite: false, fog: false, side: THREE.BackSide,
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      ${TONES}
      uniform sampler2D uNoise, uBrush;
      uniform float uDeck, uWisp;
      uniform vec4 uScroll;
      varying vec3 vDir;
      // Big soft shapes with smaller ones on them. Each value is about the share of the sky that is thinner than it.
      float billow(vec2 p) { return texture2D(uNoise, p).r * 0.68 + texture2D(uNoise, p * 2.9 + 0.31).r * 0.32; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        // The layer lies on a flat sheet overhead, so it gathers toward the horizon as real cloud does.
        vec2 p = d.xz / (h + 0.2);
        vec2 q = p * 0.055 + uScroll.xy;
        float n = billow(q) + (texture2D(uBrush, p * 0.35 + uScroll.xy * 3.0).r - 0.5) * 0.07;
        float open = 1.0 - uDeck;
        float body = smoothstep(open - 0.03, open + 0.2, n) * step(0.001, uDeck);
        // Lit where the cloud thins toward the sun, shaded where it thickens.
        float k = clamp((n - billow(q + normalize(uSun.xz + vec2(1e-4)) * 0.022)) * 4.5 + 0.55, 0.0, 1.0);
        float toward = max(dot(d, uSun), 0.0);
        vec3 color = cloudTone(k, toward);
        // Thin streaks, long across the wind, where the layer is open.
        float streak = smoothstep(0.56, 0.84, texture2D(uNoise, p * vec2(0.011, 0.052) + uScroll.zw).r) * uWisp * (1.0 - body);
        color = mix(cloudTone(0.9, toward), color, body);
        float alpha = max(body * 0.94, streak * 0.5) * smoothstep(0.015, 0.16, h);
        // Toward the horizon it sinks into the air, as the far hills do.
        color = mix(color, uSkyHaze, (1.0 - smoothstep(0.03, 0.42, h)) * 0.75);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  veil.name = 'high-clouds';
  veil.frustumCulled = false;
  veil.renderOrder = -8;

  // ---- the painted clouds: all one mesh, each card saying which painting it shows. The farthest come first,
  // so a near cloud is drawn over a far one. A painting gives the cloud its shape and where it is light and
  // dark. Its colours come from the hour and the weather.
  const rank = ranks(CLOUDS.length);
  const cards: THREE.BufferGeometry[] = [], card = new THREE.Object3D();
  for (const [which, compass, lift, far, wide, order] of CLOUDS.map((c, i) => [...c, rank[i] as number] as const).sort((a, b) => b[3] - a[3])) {
    const image = (textures.clouds[which] as THREE.Texture).image as { width: number; height: number };
    const distance = far * NEAR, width = wide * NEAR, height = width * image.height / image.width, a = THREE.MathUtils.degToRad(compass);
    card.position.set(Math.sin(a) * distance, distance * Math.tan(THREE.MathUtils.degToRad(lift)) + height / 2, -Math.cos(a) * distance);
    card.lookAt(0, card.position.y, 0);
    card.updateMatrix();
    const g = new THREE.PlaneGeometry(width, height).applyMatrix4(card.matrix);
    // Which painting, how far the cloud sinks into the haze (a cloud low on the horizon sinks most), and its place in the order.
    const own = new Float32Array(12);
    for (let i = 0; i < 4; i++) own.set([which, THREE.MathUtils.clamp(0.62 - lift * 0.022, 0.08, 0.6), order], i * 3);
    g.setAttribute('aCloud', new THREE.BufferAttribute(own, 3));
    cards.push(g);
  }
  const clouds = new THREE.Mesh(mergeGeometries(cards), new THREE.ShaderMaterial({
    uniforms: { ...sky, uMaps: { value: textures.clouds.slice(0, 6) } },
    transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `
      attribute vec3 aCloud; varying vec2 vUv; varying vec3 vCloud; varying vec3 vDir;
      void main() { vUv = uv; vCloud = aCloud; vDir = (modelMatrix * vec4(position, 0.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${TONES}
      uniform sampler2D uMaps[6]; uniform float uShow; varying vec2 vUv; varying vec3 vCloud; varying vec3 vDir;
      void main() {
        vec4 t = vCloud.x < 0.5 ? texture2D(uMaps[0], vUv) : vCloud.x < 1.5 ? texture2D(uMaps[1], vUv) : vCloud.x < 2.5 ? texture2D(uMaps[2], vUv)
          : vCloud.x < 3.5 ? texture2D(uMaps[3], vUv) : vCloud.x < 4.5 ? texture2D(uMaps[4], vUv) : texture2D(uMaps[5], vUv);
        // The cloud is there once the sky has filled as far as its place in the order.
        float alpha = t.a * smoothstep(vCloud.z - 0.05, vCloud.z + 0.05, uShow);
        if (alpha < 0.004) discard;
        float lum = dot(t.rgb, vec3(0.3, 0.59, 0.11));
        float k = smoothstep(0.36, 0.86, lum);
        vec3 color = cloudTone(k, max(dot(normalize(vDir), uSun), 0.0));
        // A little of the painting's own warm and cool stays in it.
        color *= mix(vec3(1.0), t.rgb / max(lum, 0.05), 0.28);
        // It sinks into the haze most of all at its base.
        gl_FragColor = vec4(mix(color, uSkyHaze, vCloud.y * (1.0 - vUv.y * 0.6)), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  clouds.name = 'clouds';
  clouds.frustumCulled = false;
  clouds.renderOrder = -6;
  // The three rings are one mesh, so they cost one draw call.
  const ridges = new THREE.Mesh(mergeGeometries([
    ridge(330, 8, 34, 3, '#8fbf58', '#3f8449', 0.46, 0.5),
    ridge(440, 12, 70, 11, '#6fa85a', '#3c7a52', 0.7, 0.64),
    ridge(560, 16, 130, 23, '#55906a', '#3f7a66', 0.86, 0.76),
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
  group.add(veil, clouds, ridges);

  let drift = 0.0016, windX = 1, windZ = 0;
  return {
    group,
    update(x, y, z, dt, down) {
      group.position.set(x, y, z);
      DOWN.value = Math.min(1, Math.max(0, (down - 0.3) / 0.22));
      // The painted clouds ride round the sky, and the high layer slides the way the wind blows, faster.
      clouds.rotation.y += dt * drift * Math.PI * 2;
      const scroll = sky.uScroll.value, slide = dt * drift * 2.2;
      scroll.x = (scroll.x - windX * slide) % 1; scroll.y = (scroll.y - windZ * slide) % 1;
      scroll.z = (scroll.z - windX * slide * 0.5) % 1; scroll.w = (scroll.w - windZ * slide * 0.5) % 1;
    },
    setSky(w) {
      sky.uShow.value = w.show; sky.uDeck.value = w.deck; sky.uWisp.value = w.wisp; sky.uStorm.value = w.storm; sky.uFlash.value = w.flash;
      sky.uLight.value.copy(w.light); sky.uShade.value.copy(w.shade); sky.uRim.value.copy(w.rim); sky.uSkyHaze.value.copy(w.haze); sky.uSun.value.copy(w.sun);
      drift = w.drift; windX = w.windX; windZ = w.windZ;
    },
  };
}
