// The sky and the scene's light. This feature owns the lights: one sun (the moon at night) with one shadow,
// one fill light from the sky, and the fog. Everything follows `ctx.ambient`.
//
// What it costs: the sky is one full-screen triangle drawn after everything solid, so pixels hidden by land
// are never shaded, and its clouds are five reads of one small noise image. Cloud shadows are one extra quad
// in the sun's shadow pass. The bolt, the rainbow and the light shafts share one more draw call.
import * as THREE from 'three';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Quality, Vec3 } from '../../engine/types.ts';
import { cloudNoise } from './noise.ts';
import { arcDirection, dull, emptySkyKey, moonArc, moonLit, sampleSky, sunArc, SUN_DOWN, SUN_UP } from './palette.ts';
import { createPhenomena, type PhenomenaFrame } from './phenomena.view.ts';

export interface SkyOptions {
  /** Half the width of the square the shadow covers around its target, in meters. */
  shadowRange?: number;
  /** A layer no other feature uses. The cloud-shadow sheet lives on it so only the shadow pass draws it. */
  shadowLayer?: number;
}

/** The sky as other features see it. The same objects are updated in place every frame, so keep the reference. */
export interface SkyLook {
  /** From the ground toward the sun by day and the moon at night. */
  readonly sunDirection: THREE.Vector3;
  readonly zenith: THREE.Color;
  readonly horizon: THREE.Color;
  readonly fog: THREE.Color;
  /** The sun or moon light: its color times its strength. */
  readonly sun: THREE.Color;
  /** The fill light from the sky. */
  readonly ambient: THREE.Color;
  /** Multiply an unlit color by this and it sits in the scene: water and particles use it. */
  readonly light: THREE.Color;
  /** 0 by day, 1 at night. */
  night: number;
  /** 0 to 7. 0 is new, 4 is full. */
  moonPhase: number;
}

export interface Sky extends ViewSystem {
  readonly look: SkyLook;
  /** The same vector as `look.sunDirection`. */
  readonly sunDirection: THREE.Vector3;
  readonly sun: THREE.DirectionalLight;
  readonly fill: THREE.HemisphereLight;
  /** The shadow and the fog follow this point, usually the hero. */
  setShadowTarget(position: Vec3): void;
  setShadowRange(range: number): void;
  /** 0 to 7. Ambient has no moon yet, so the clock's phase comes in here. */
  setMoonPhase(phase: number): void;
  /** 0 to 1. The weather decides when there is a rainbow. */
  setRainbow(amount: number): void;
  /** Draws a lightning bolt down to this point. The flash itself comes from `ambient.flash`. */
  strike(at: Vec3): void;
}

const LEVELS: Record<Quality, { shadowMap: number; shadowEvery: number; cloudShadows: boolean; shafts: boolean }> = {
  low: { shadowMap: 1024, shadowEvery: 2, cloudShadows: false, shafts: false },
  medium: { shadowMap: 1536, shadowEvery: 1, cloudShadows: true, shafts: false },
  high: { shadowMap: 2048, shadowEvery: 1, cloudShadows: true, shafts: true },
};

/** How far the light sits from the shadow target. */
const LIGHT_DISTANCE = 120;
/** Meters of ground one repeat of the cloud-shadow pattern covers. */
const CLOUD_SHADOW_TILE = 70;

const SKY_VERTEX = /* glsl */ `
uniform vec2 uTan;
varying vec3 vDir;
void main() {
  // The direction this pixel looks in, in world space. An orthographic camera gets a made-up lens.
  vDir = vec3(position.xy * uTan, -1.0) * mat3(viewMatrix);
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`;

const SKY_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uTop, uMid, uBot, uFog, uSunColor, uMoonColor, uCloudLit, uCloudShade;
uniform vec3 uSunDir, uMoonDir;
uniform float uSunShow, uMoonShow, uStars, uCover, uFlash, uPhase, uTime;
uniform vec4 uScroll;
uniform sampler2D uNoise;

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

// The low layer: big shapes with finer ones on top.
float cumulus(vec2 p) {
  return texture2D(uNoise, p).r * 0.62 + texture2D(uNoise, p * 3.0 + 0.37).g * 0.38;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 color = mix(uBot, uMid, smoothstep(0.0, 0.22, h));
  color = mix(color, uTop, smoothstep(0.15, 0.85, h));

  if (uStars > 0.01 && h > 0.0) {
    vec2 grid = d.xz / (h + 0.35) * 46.0;
    float pick = hash21(floor(grid));
    float star = step(0.95, pick) * (1.0 - smoothstep(0.05, 0.24, length(fract(grid) - 0.5)));
    star *= (0.5 + 0.5 * sin(uTime * 2.5 + pick * 90.0)) * (0.4 + 0.6 * fract(pick * 57.0));
    color += vec3(0.85, 0.92, 1.0) * star * uStars * smoothstep(0.03, 0.3, h) * 1.25;
  }

  float toSun = sqrt(max(0.0, 2.0 - 2.0 * dot(d, uSunDir)));
  color += uSunColor * (smoothstep(0.05, 0.043, toSun) * 2.4 + 0.45 * exp(-toSun * 8.0) + 0.22 * exp(-toSun * 2.4)) * uSunShow;

  // The moon: a disc with its lit part cut by the phase.
  if (uMoonShow > 0.01 && dot(d, uMoonDir) > 0.9) {
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), uMoonDir));
    vec3 up = cross(uMoonDir, right);
    vec2 q = vec2(dot(d, right), dot(d, up)) / 0.055;
    float r = length(q);
    float disc = smoothstep(1.0, 0.94, r);
    float edge = cos(uPhase * 6.28318) * sqrt(max(0.0, 1.0 - q.y * q.y));
    float lit = uPhase < 0.5 ? smoothstep(edge - 0.07, edge + 0.07, q.x) : 1.0 - smoothstep(-edge - 0.07, -edge + 0.07, q.x);
    float seas = 1.0 - 0.22 * smoothstep(0.5, 0.2, length(q - vec2(-0.3, 0.25))) - 0.16 * smoothstep(0.35, 0.1, length(q - vec2(0.35, -0.3)));
    float full = (1.0 - cos(uPhase * 6.28318)) * 0.5;
    color += uMoonColor * (disc * (0.06 + 1.55 * lit * seas) + 0.16 * full * exp(-r * 0.5)) * uMoonShow;
  }

  float sky = smoothstep(0.0, 0.14, h);
  if (sky > 0.0) {
    // Both layers lie on flat sheets overhead. The low one is shaded in three flat tones, lit from the sun's side.
    vec2 p = d.xz / (h + 0.18);
    vec2 pa = p * 0.16 + uScroll.xy;
    float density = cumulus(pa);
    float edge = mix(0.66, 0.16, uCover);
    float cover = smoothstep(edge, edge + 0.09, density) * sky;
    float towards = cumulus(pa + normalize(uSunDir.xz + vec2(1e-4)) * 0.03);
    float lit = clamp((density - towards) * 3.2 + 0.55, 0.0, 1.0);
    lit = floor(lit * 3.0 + 0.5) / 3.0;
    color = mix(color, mix(uCloudShade, uCloudLit, lit), cover * 0.94);

    float streaks = smoothstep(0.5, 0.72, texture2D(uNoise, p * vec2(0.05, 0.15) + uScroll.zw).b) * sky * (0.3 + 0.6 * uCover);
    color = mix(color, uCloudLit, streaks * 0.5 * (1.0 - cover));
  }

  // At the horizon and below it the sky is the fog color, so far land fades into it without a line.
  color = mix(uFog, color, smoothstep(-0.1, 0.06, h));
  color += vec3(0.75, 0.8, 1.0) * uFlash * 0.5;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function createSky(ctx: ViewContext, options: SkyOptions = {}): Sky {
  const { scene, renderer } = ctx;
  const shadowLayer = options.shadowLayer ?? 30;
  let shadowRange = options.shadowRange ?? 40;
  let level = LEVELS[ctx.quality];

  // ---- the noise image shared by the clouds and their shadows
  const noiseSize = 128;
  const noise = new THREE.DataTexture(cloudNoise(noiseSize), noiseSize, noiseSize, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = noise.minFilter = THREE.LinearFilter;
  noise.matrixAutoUpdate = false;
  noise.needsUpdate = true;

  // ---- the sky itself
  const uniforms = {
    uTan: { value: new THREE.Vector2(1, 1) },
    uTop: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uBot: { value: new THREE.Color() },
    uFog: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uMoonColor: { value: new THREE.Color(0xdfe8ff) },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uSunShow: { value: 1 },
    uMoonShow: { value: 0 },
    uStars: { value: 0 },
    uCover: { value: 0.2 },
    uFlash: { value: 0 },
    uPhase: { value: 0.5 },
    uTime: { value: 0 },
    uScroll: { value: new THREE.Vector4() },
    uNoise: { value: noise },
  };
  const skyGeometry = new THREE.BufferGeometry();
  skyGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    fog: false,
  });
  const dome = new THREE.Mesh(skyGeometry, skyMaterial);
  dome.name = 'sky';
  dome.frustumCulled = false;
  // After everything solid, so the depth test skips the pixels the land covers.
  dome.renderOrder = 1000;

  // ---- the lights
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.name = 'sun';
  sun.castShadow = true;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  sun.shadow.camera.layers.enable(shadowLayer);
  const fill = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  fill.name = 'sky-fill';

  const hadShadows = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = true;
  const fogBefore = scene.fog;
  const fog = new THREE.Fog(0xffffff, 60, 200);
  scene.fog = fog;

  // ---- the shadows of the clouds: a sheet in front of the sun that only the shadow pass draws
  const sheetGeometry = new THREE.PlaneGeometry(1, 1);
  const sheetMaterial = new THREE.MeshBasicMaterial({ alphaMap: noise, alphaTest: 0.6, side: THREE.DoubleSide });
  const sheet = new THREE.Mesh(sheetGeometry, sheetMaterial);
  sheet.name = 'cloud-shadows';
  sheet.castShadow = true;
  sheet.frustumCulled = false;
  sheet.matrixAutoUpdate = false;
  sheet.layers.set(shadowLayer);

  const phenomena = createPhenomena();
  scene.add(dome, sun, sun.target, fill, sheet, phenomena.mesh);

  const look: SkyLook = {
    sunDirection: new THREE.Vector3(0.3, 0.8, 0.5).normalize(),
    zenith: new THREE.Color(),
    horizon: new THREE.Color(),
    fog: new THREE.Color(),
    sun: new THREE.Color(),
    ambient: new THREE.Color(),
    light: new THREE.Color(1, 1, 1),
    night: 0,
    moonPhase: 4,
  };

  // Scratch values, so a frame allocates nothing.
  const key = emptySkyKey();
  const target = new THREE.Vector3();
  const sunPlace = new THREE.Vector3();
  const moonPlace = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const scaledRight = new THREE.Vector3();
  const scaledUp = new THREE.Vector3();
  const sunColor = new THREE.Color();
  const cloudScroll = new THREE.Vector2();
  const cameraUp = new THREE.Vector3();
  const showing: PhenomenaFrame = { time: 0, target, sunDirection: look.sunDirection, sunColor, rainbow: 0, rainbowCenter: new THREE.Vector3(), rainbowRadius: 12, shafts: 0 };
  let rainbow = 0;
  let frame = 0;

  function applyShadowSettings(): void {
    const camera = sun.shadow.camera;
    camera.left = -shadowRange;
    camera.right = shadowRange;
    camera.top = shadowRange;
    camera.bottom = -shadowRange;
    camera.near = 1;
    camera.far = LIGHT_DISTANCE * 2;
    camera.updateProjectionMatrix();
    if (sun.shadow.mapSize.x !== level.shadowMap) {
      sun.shadow.mapSize.set(level.shadowMap, level.shadowMap);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    sun.shadow.autoUpdate = level.shadowEvery === 1;
    sun.shadow.needsUpdate = true;
    sheet.visible = level.cloudShadows;
  }
  applyShadowSettings();

  /** Puts the light over the target, snapped to whole shadow texels so shadow edges do not crawl. */
  function placeLight(): void {
    const dir = look.sunDirection;
    right.set(dir.z, 0, -dir.x).normalize();
    up.crossVectors(dir, right);
    const texel = (shadowRange * 2) / level.shadowMap;
    const x = Math.round(target.dot(right) / texel) * texel;
    const y = Math.round(target.dot(up) / texel) * texel;
    const z = target.dot(dir);
    sun.target.position.set(0, 0, 0).addScaledVector(right, x).addScaledVector(up, y).addScaledVector(dir, z);
    sun.position.copy(sun.target.position).addScaledVector(dir, LIGHT_DISTANCE);
  }

  /** Stands the cloud sheet in front of the light and maps the noise onto the ground under it. */
  function placeCloudShadows(cover: number, dt: number, windX: number, windZ: number, wind: number): void {
    const dir = look.sunDirection;
    const size = shadowRange * 2;
    sheet.position.copy(sun.position).addScaledVector(dir, -3);
    scaledRight.copy(right).multiplyScalar(size);
    scaledUp.copy(up).multiplyScalar(size);
    sheet.matrix.makeBasis(scaledRight, scaledUp, dir).setPosition(sheet.position);
    sheet.matrixWorldNeedsUpdate = true;
    // The noise is spread evenly from 0 to 1: this shades about a tenth of the ground on a clear day and most of it under full cloud.
    sheetMaterial.alphaTest = mix(0.83, 0.25, cover);

    // Follow each corner of the sheet down the light to the ground: that is where its piece of cloud belongs.
    // The path is a straight line, so one 3 by 3 matrix does it for the whole sheet.
    const drift = (1.2 + wind * 5) * dt;
    cloudScroll.x = (cloudScroll.x - (windX * drift) / CLOUD_SHADOW_TILE) % 1;
    cloudScroll.y = (cloudScroll.y - (windZ * drift) / CLOUD_SHADOW_TILE) % 1;
    const scale = 1 / CLOUD_SHADOW_TILE;
    const kx = dir.x / dir.y;
    const kz = dir.z / dir.y;
    const drop = sheet.position.y - target.y;
    const uX = size * right.x;
    const vX = size * (up.x - kx * up.y);
    const uZ = size * right.z;
    const vZ = size * (up.z - kz * up.y);
    const originX = sheet.position.x - kx * drop - 0.5 * uX - 0.5 * vX;
    const originZ = sheet.position.z - kz * drop - 0.5 * uZ - 0.5 * vZ;
    noise.matrix.set(
      uX * scale, vX * scale, ((originX * scale) % 1) + cloudScroll.x,
      uZ * scale, vZ * scale, ((originZ * scale) % 1) + cloudScroll.y,
      0, 0, 1,
    );
  }

  const sky: Sky = {
    look,
    sunDirection: look.sunDirection,
    sun,
    fill,

    setShadowTarget(position) {
      target.set(position.x, position.y, position.z);
    },

    setShadowRange(range) {
      shadowRange = range;
      applyShadowSettings();
    },

    setMoonPhase(phase) {
      look.moonPhase = ((Math.round(phase) % 8) + 8) % 8;
    },

    setRainbow(amount) {
      rainbow = amount;
    },

    strike(at) {
      phenomena.strike(at.x, at.y, at.z);
    },

    setQuality(quality) {
      level = LEVELS[quality];
      applyShadowSettings();
    },

    update(dt, view) {
      const a = view.ambient;
      const time = ((a.timeOfDay % 1) + 1) % 1;
      sampleSky(time, key);

      // Cloud, and a little fog, wash the color out of everything.
      const overcast = Math.max(smoothstep(0.35, 0.95, a.cloud), a.fog * 0.45);
      dull(key.top, overcast, 0.35);
      dull(key.mid, overcast, 0.3);
      dull(key.bot, overcast, 0.22);
      dull(key.cloudLit, overcast, 0.38);
      dull(key.cloudShade, overcast, 0.45);
      dull(key.fog, overcast, 0.2);
      dull(key.skyFill, overcast, 0.1);

      // ---- where the sun and the moon are, and which one lights the world
      arcDirection(sunArc(time), sunPlace);
      arcDirection(moonArc(time), moonPlace);
      const day = time >= SUN_UP && time < SUN_DOWN;
      look.sunDirection.copy(day ? sunPlace : moonPlace);
      if (look.sunDirection.y < 0.45) {
        // Never a light from the horizon: its shadows would run forever and, seen from above, the ground would go dark.
        look.sunDirection.y = 0.45;
        look.sunDirection.normalize();
      }
      const moonPower = day ? 1 : 0.55 + 0.45 * moonLit(look.moonPhase);
      const strength = key.sunStrength * (1 - overcast * 0.72) * moonPower;
      const flash = a.flash * (0.6 + 0.4 * Math.sin(view.time * 70));

      sunColor.setRGB(key.sun[0], key.sun[1], key.sun[2]);
      sun.color.copy(sunColor);
      sun.intensity = strength;
      sun.shadow.intensity = (1 - overcast * 0.8) * (1 - a.fog * 0.6);
      fill.color.setRGB(key.skyFill[0], key.skyFill[1], key.skyFill[2]);
      fill.groundColor.setRGB(key.groundFill[0], key.groundFill[1], key.groundFill[2]);
      fill.intensity = key.fillStrength * (1 - overcast * 0.16) + flash * 3.5;

      placeLight();
      frame++;
      if (level.shadowEvery > 1 && frame % level.shadowEvery === 0) sun.shadow.needsUpdate = true;

      // ---- fog: it starts just past the target and thickens with distance from the camera
      const thick = Math.max(a.fog, a.rain * 0.3);
      const reach = view.camera.position.distanceTo(target);
      fog.color.setRGB(key.fog[0], key.fog[1], key.fog[2]);
      fog.near = reach + mix(30, -6, thick);
      fog.far = reach + mix(170, 22, thick);

      // ---- the sky
      const camera = view.camera;
      // Half the height of the view at the target's distance, in meters.
      let viewHalf: number;
      const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
      if (perspective) {
        const lens = camera as THREE.PerspectiveCamera;
        const tan = Math.tan((lens.fov * Math.PI) / 360) / lens.zoom;
        uniforms.uTan.value.set(tan * lens.aspect, tan);
        viewHalf = reach * tan;
      } else {
        const flat = camera as THREE.OrthographicCamera;
        uniforms.uTan.value.set((0.36 * (flat.right - flat.left)) / (flat.top - flat.bottom), 0.36);
        viewHalf = (flat.top - flat.bottom) / (2 * flat.zoom);
      }
      uniforms.uTop.value.setRGB(key.top[0], key.top[1], key.top[2]);
      uniforms.uMid.value.setRGB(key.mid[0], key.mid[1], key.mid[2]);
      uniforms.uBot.value.setRGB(key.bot[0], key.bot[1], key.bot[2]);
      uniforms.uFog.value.copy(fog.color);
      uniforms.uSunColor.value.copy(sunColor);
      uniforms.uCloudLit.value.setRGB(key.cloudLit[0], key.cloudLit[1], key.cloudLit[2]);
      uniforms.uCloudShade.value.setRGB(key.cloudShade[0], key.cloudShade[1], key.cloudShade[2]);
      uniforms.uSunDir.value.copy(sunPlace);
      uniforms.uMoonDir.value.copy(moonPlace);
      uniforms.uSunShow.value = (1 - overcast * 0.9) * (1 - smoothstep(0.75, 1, key.night));
      uniforms.uMoonShow.value = (1 - overcast * 0.9) * smoothstep(0.3, 0.8, key.night);
      uniforms.uStars.value = key.stars * (1 - overcast);
      uniforms.uCover.value = a.cloud;
      uniforms.uFlash.value = flash;
      uniforms.uPhase.value = look.moonPhase / 8;
      uniforms.uTime.value = view.time % 1024;
      const windX = Math.cos(a.windDir);
      const windZ = Math.sin(a.windDir);
      const drift = (0.004 + a.wind * 0.014) * dt;
      const scroll = uniforms.uScroll.value;
      scroll.x = (scroll.x - windX * drift) % 1;
      scroll.y = (scroll.y - windZ * drift) % 1;
      scroll.z = (scroll.z - windX * drift * 0.4) % 1;
      scroll.w = (scroll.w - windZ * drift * 0.4) % 1;

      if (level.cloudShadows) placeCloudShadows(a.cloud, dt, windX, windZ, a.wind);

      // ---- what other features read
      look.zenith.copy(uniforms.uTop.value);
      look.horizon.copy(uniforms.uBot.value);
      look.fog.copy(fog.color);
      look.sun.copy(sunColor).multiplyScalar(strength);
      look.ambient.copy(fill.color).lerp(fill.groundColor, 0.3).multiplyScalar(fill.intensity / Math.PI);
      look.light.copy(sunColor).multiplyScalar((strength * 0.62) / Math.PI).add(look.ambient);
      look.night = key.night;

      // ---- the bolt, the rainbow, and shafts of light on a clear dawn
      const dawn = smoothstep(0.232, 0.262, time) * (1 - smoothstep(0.3, 0.345, time));
      showing.time = view.time;
      showing.rainbow = rainbow * (1 - key.night);
      if (showing.rainbow > 0) {
        // The game's camera looks down and never sees the sky, so the rainbow is not put where a real one
        // would be. It arches over the middle of the view, sized to the view, and stands nearer the camera
        // than anything on the ground so nothing cuts through it.
        const near = 0.3;
        cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        showing.rainbowCenter.copy(target).addScaledVector(cameraUp, -0.35 * viewHalf).sub(camera.position).multiplyScalar(near).add(camera.position);
        showing.rainbowRadius = 0.9 * viewHalf * (perspective ? near : 1);
      }
      showing.shafts = level.shafts ? dawn * (1 - overcast) * (1 - a.fog) : 0;
      phenomena.update(dt, showing);
    },

    dispose() {
      scene.remove(dome, sun, sun.target, fill, sheet, phenomena.mesh);
      scene.fog = fogBefore;
      renderer.shadowMap.enabled = hadShadows;
      sun.shadow.map?.dispose();
      sun.dispose();
      fill.dispose();
      skyGeometry.dispose();
      skyMaterial.dispose();
      sheetGeometry.dispose();
      sheetMaterial.dispose();
      noise.dispose();
      phenomena.dispose();
    },
  };
  return sky;
}
