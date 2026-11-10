// The final picture: the air between the camera and the land, bloom for glowing things, a soft blur far from
// the focus for the miniature look, a vignette, the color grade, tone mapping and the render size. Call
// `post.render()` in place of `renderer.render(scene, camera)`.
//
// Every part has a switch and a known cost (`post.costs`). With all of them off there are no extra passes at
// all: the scene is drawn straight to the screen, and tone mapping happens in each material for free. That is
// the `low` level, at three-quarter size, where the materials' own fog is the only haze.
//
//   scene -> [bright parts, 1/4] -> [blur across] -> [blur down] -> [blur across, 1/8] -> [blur down] -> final pass -> screen
//
// With everything on that is six small draw calls after the scene.
import * as THREE from 'three';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Quality, Vec3 } from '../../engine/types.ts';

export interface PostSettings {
  /** Glow around bright things: lamps, lume, the sun, lightning, glowing particles. */
  bloom: boolean;
  /**
   * The air: far land takes the color of the sky behind it, warm toward the sun, and low mist gathers in
   * hollows. It reads the scene's depth. Without it the materials' fog alone fades the distance, in one color.
   */
  atmosphere: boolean;
  /** The color grade: warm light, cool shade, rich greens that never go neon. */
  grade: boolean;
  /** A blur that grows toward the top and bottom of the screen, away from the focus point. */
  tiltShift: boolean;
  vignette: boolean;
  /** A soft roll-off for bright colors. Mid-tones stay as painted. */
  toneMapping: boolean;
  /** The size the scene is drawn at, against the full size. 0.5 to 1. */
  renderScale: number;
  /** Edge smoothing samples for the scene when it is drawn off screen. 0 turns it off. */
  msaa: number;
}

export interface PostOptions {
  /** The pixel ratio at full size. Taken from the renderer when left out. */
  pixelRatio?: number;
  bloomStrength?: number;
  /** Brightness above which a pixel glows. 1 is the brightest a lit surface normally gets. */
  bloomThreshold?: number;
}

/** The part of the sky the air needs. `createSky(...).look` fits. Colors are linear. */
export interface PostSky {
  readonly zenith: THREE.Color;
  readonly middle: THREE.Color;
  readonly horizon: THREE.Color;
  /** The color the materials' fog fades to. */
  readonly fog: THREE.Color;
  readonly glow: THREE.Color;
  readonly sunInSky: THREE.Vector3;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly mist: number;
  readonly mistLevel: number;
}

export interface PostCost {
  /** Draw calls added after the scene. */
  passes: number;
  /** Pixels shaded by those passes, in full screens. */
  screens: number;
  /** Megabytes of render targets held. */
  megabytes: number;
}

export interface Post extends ViewSystem {
  readonly settings: Readonly<PostSettings>;
  /** What each switch costs, in words, for a settings screen or a report. */
  readonly costs: Readonly<Record<keyof PostSettings, string>>;
  /** Draws the frame. */
  render(): void;
  /** Changes one or more switches. They stay until the next `setQuality`. */
  set(settings: Partial<PostSettings>): void;
  /** Draws the scene smaller than the screen. The automatic quality mode should call this first. */
  setRenderScale(scale: number): void;
  /** The blur leaves this point sharp, usually the hero. */
  setFocus(position: Vec3): void;
  /** Tell it when the screen's pixel ratio changes. */
  setPixelRatio(pixelRatio: number): void;
  /** The sky the air takes its colors from. Without one the atmosphere does nothing. */
  setSky(sky: PostSky | null): void;
  /** The cost of the current settings. */
  cost(): PostCost;
}

const LEVELS: Record<Quality, PostSettings> = {
  low: { bloom: false, atmosphere: false, grade: false, tiltShift: false, vignette: false, toneMapping: true, renderScale: 0.75, msaa: 0 },
  medium: { bloom: true, atmosphere: true, grade: true, tiltShift: false, vignette: true, toneMapping: true, renderScale: 1, msaa: 2 },
  high: { bloom: true, atmosphere: true, grade: true, tiltShift: true, vignette: true, toneMapping: true, renderScale: 1, msaa: 4 },
};

const COSTS: Record<keyof PostSettings, string> = {
  bloom: 'Five draw calls at a quarter and an eighth of the width and height: about a fifth of one full-screen pass, plus two texture reads in the final pass.',
  atmosphere: 'One depth read and a few dozen instructions in the final pass, and a depth texture beside the scene.',
  grade: 'A few dozen instructions in the final pass.',
  tiltShift: 'Eight more texture reads in the final pass, only on the blurred bands at the top and bottom of the screen.',
  vignette: 'A few instructions in the final pass.',
  toneMapping: 'Free: it runs in the final pass, or in each material when there is no final pass.',
  renderScale: 'Every pixel of the scene. 0.75 shades 56 percent of the pixels.',
  msaa: 'Memory and fill for the off-screen scene: 4 samples is four times the color and depth memory.',
};

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Keeps what is brighter than the threshold, with a soft knee so a glow fades in rather than switching on, and
// shrinks it to a quarter in the same pass: four reads, each the average of four pixels.
const BRIGHT = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform float uThreshold;
void main() {
  vec3 c = texture2D(tScene, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tScene, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(tScene, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tScene, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float brightest = max(c.r, max(c.g, c.b));
  const float KNEE = 0.3;
  float soft = clamp(brightest - uThreshold + KNEE, 0.0, 2.0 * KNEE);
  soft = soft * soft / (4.0 * KNEE);
  c *= max(soft, brightest - uThreshold) / max(brightest, 1e-4);
  c = clamp(c, vec3(0.0), vec3(6.0));
  // Never let one bad pixel smear across the screen.
  if (!(brightest < 1e4)) c = vec3(0.0);
  gl_FragColor = vec4(c, 1.0);
}`;

const BLUR = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tSource;
uniform vec2 uStep;
void main() {
  vec3 c = texture2D(tSource, vUv).rgb * 0.2270270270;
  c += (texture2D(tSource, vUv + uStep * 1.3846153846).rgb + texture2D(tSource, vUv - uStep * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(tSource, vUv + uStep * 3.2307692308).rgb + texture2D(tSource, vUv - uStep * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

// The clear sky in one direction, as the sky draws it near the horizon. Keep it the same as SKY_CLEAR in
// sky.view.ts: far land fades to exactly this, so it melts into the sky behind it.
const HAZE = /* glsl */ `
vec3 skyClear(vec3 d) {
  float h = d.y;
  vec3 color = mix(uBot, uMid, smoothstep(0.0, 0.25, h));
  color = mix(color, uTop, smoothstep(0.18, 0.9, h));
  float s = max(dot(d, uSunDir), 0.0);
  vec3 glow = uSunColor * (0.16 * pow(s, 3.0) * (1.0 - 0.6 * smoothstep(0.0, 0.5, h)) + 0.22 * pow(s, 24.0));
  vec3 haze = uFog + glow * 0.8;
  return mix(haze, color + glow, smoothstep(-0.12, 0.08, h));
}`;

const FINAL = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tScene, tBloom, tBloomWide, tDepth;
uniform vec2 uTexel;
uniform float uBloom, uTilt, uFocusY, uVignette;
uniform mat4 uProjectionInverse, uCameraWorld;
uniform vec3 uTop, uMid, uBot, uFog, uSunColor, uSunDir;
// Fog near and far, mist density and the height it lies under.
uniform vec4 uAir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
${HAZE}

#ifdef ATMOSPHERE
// The air between the camera and a point. The materials' fog has already faded the point toward one color,
// uFog, by the same amount as here. This turns that color into the sky's own in this direction, then adds
// a light haze from the camera out and the mist in hollows.
vec3 air(vec3 c, float depth) {
  if (depth >= 0.99999) return c;
  vec4 view = uProjectionInverse * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  view.xyz /= view.w;
  vec3 world = (uCameraWorld * vec4(view.xyz, 1.0)).xyz;
  vec3 eye = uCameraWorld[3].xyz;
  vec3 ray = world - eye;
  float dist = length(ray);
  vec3 dir = ray / max(dist, 1e-4);
  vec3 sky = skyClear(dir);
  float fogged = smoothstep(uAir.x, uAir.y, -view.z);
  c += (sky - uFog) * fogged;
  // A little air even short of the fog: the middle distance turns a touch toward the sky.
  float aerial = 0.1 * (1.0 - exp(-max(dist - uAir.x * 0.4, 0.0) / max(uAir.y, 1.0)));
  c = mix(c, sky, aerial * (1.0 - fogged));
  // Mist: denser the lower it lies, summed along the ray, so it thickens over a hollow seen across.
  if (uAir.z > 0.0) {
    const float H = 2.2;
    float above = eye.y - uAir.w;
    float low = min((uAir.w - world.y) / H, 2.5);
    float k = abs(dir.y) < 1e-3 ? dist * exp(-above / H) : H * (exp(-above / H) - exp(low)) / dir.y;
    float mist = (1.0 - exp(-uAir.z * max(k, 0.0))) * 0.7;
    c = mix(c, sky * 1.05, mist);
  }
  return c;
}
#endif

#ifdef GRADE
// In light: warm highlights over cool shade, the way a sunny afternoon looks.
vec3 gradeLinear(vec3 c) {
  c *= 1.12;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float lit = smoothstep(0.03, 0.45, l);
  vec3 shade = vec3(0.9, 0.98, 1.08);
  vec3 light = vec3(1.04, 1.0, 0.95);
  c *= mix(shade, light, lit);
  // Shade takes a little of the blue sky into it, so a shadow on grass is teal, not dark green.
  return c + vec3(0.0, 0.005, 0.016) * (1.0 - lit);
}
// On screen: a gentle S curve, quiet colors lifted, loud ones held back so a green stays rich and never neon.
vec3 gradeScreen(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float boost = mix(1.18, 1.0, smoothstep(0.15, 0.6, sat));
  // Yellow-greens lean a little toward green, so a meadow in warm light stays fresh and never goes olive.
  float yellowGreen = smoothstep(0.1, 0.35, c.g - c.b) * smoothstep(-0.05, 0.12, c.g - c.r);
  c.r -= 0.035 * yellowGreen * sat;
  // Only the very bright and very saturated, the neon ones, are held back.
  float neon = smoothstep(0.45, 0.75, sat) * smoothstep(0.7, 0.92, l);
  c = l + (c - l) * boost * (1.0 - 0.2 * neon);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
  // Shadows never go to grey-black: they keep a little blue.
  c = c + vec3(0.012, 0.018, 0.04) * (1.0 - smoothstep(0.0, 0.35, l));
  return clamp(c, 0.0, 1.0);
}
#endif

void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  #ifdef TILT_SHIFT
  // The blur grows away from a band across the focus. Inside the band this costs nothing.
  float radius = uTilt * smoothstep(0.24, 0.55, abs(vUv.y - uFocusY));
  if (radius > 0.25) {
    vec2 s = uTexel * radius;
    c += texture2D(tScene, vUv + s * vec2(1.0, 0.0)).rgb + texture2D(tScene, vUv + s * vec2(-1.0, 0.0)).rgb
       + texture2D(tScene, vUv + s * vec2(0.0, 1.0)).rgb + texture2D(tScene, vUv + s * vec2(0.0, -1.0)).rgb
       + texture2D(tScene, vUv + s * vec2(0.7, 0.7)).rgb + texture2D(tScene, vUv + s * vec2(-0.7, 0.7)).rgb
       + texture2D(tScene, vUv + s * vec2(0.7, -0.7)).rgb + texture2D(tScene, vUv + s * vec2(-0.7, -0.7)).rgb;
    c /= 9.0;
  }
  #endif
  #ifdef ATMOSPHERE
  c = air(c, texture2D(tDepth, vUv).r);
  #endif
  #ifdef BLOOM
  c += (texture2D(tBloom, vUv).rgb * 0.55 + texture2D(tBloomWide, vUv).rgb * 0.75) * uBloom;
  #endif
  #ifdef VIGNETTE
  vec2 v = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(v * vec2(1.0, 0.8)) * 1.35);
  #endif
  #ifdef GRADE
  c = gradeLinear(c);
  #endif
  gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef GRADE
  gl_FragColor.rgb = gradeScreen(gl_FragColor.rgb);
  #endif
  // A little noise hides banding in skies and fog.
  gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
}`;

export function createPost(ctx: ViewContext, options: PostOptions = {}): Post {
  const { renderer } = ctx;
  // The scene and camera to draw: the ones from the latest `update`.
  let view = ctx;
  const settings: PostSettings = { ...LEVELS[ctx.quality] };
  let basePixelRatio = options.pixelRatio ?? renderer.getPixelRatio();
  let appliedPixelRatio = basePixelRatio;
  const toneMappingBefore = renderer.toneMapping;

  // One triangle that covers the screen, for every pass.
  const triangle = new THREE.BufferGeometry();
  triangle.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const passScene = new THREE.Scene();
  const passMesh = new THREE.Mesh(triangle);
  passMesh.frustumCulled = false;
  passScene.add(passMesh);

  const pass = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, toneMapped: boolean) =>
    new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped });

  const bright = pass(BRIGHT, { tScene: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: options.bloomThreshold ?? 1 } }, false);
  const blur = pass(BLUR, { tSource: { value: null }, uStep: { value: new THREE.Vector2() } }, false);
  const final = pass(
    FINAL,
    {
      tScene: { value: null },
      tBloom: { value: null },
      tBloomWide: { value: null },
      tDepth: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uBloom: { value: options.bloomStrength ?? 0.6 },
      uTilt: { value: 2.2 },
      uFocusY: { value: 0.5 },
      uVignette: { value: 0.2 },
      uProjectionInverse: { value: new THREE.Matrix4() },
      uCameraWorld: { value: new THREE.Matrix4() },
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uBot: { value: new THREE.Color() },
      uFog: { value: new THREE.Color() },
      uSunColor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uAir: { value: new THREE.Vector4(60, 200, 0, 0) },
    },
    true,
  );
  let sky: PostSky | null = null;

  // Render targets are made when first needed and resized with the screen.
  const targetOptions = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  let sceneTarget: THREE.WebGLRenderTarget | null = null;
  let bloomA: THREE.WebGLRenderTarget | null = null;
  let bloomB: THREE.WebGLRenderTarget | null = null;
  let wideA: THREE.WebGLRenderTarget | null = null;
  let wideB: THREE.WebGLRenderTarget | null = null;
  let width = 0;
  let height = 0;

  const size = new THREE.Vector2();
  const focus = new THREE.Vector3();
  const projected = new THREE.Vector3();
  let hasFocus = false;

  const offScreen = () => settings.bloom || settings.tiltShift || settings.vignette || settings.atmosphere || settings.grade;
  const air = () => settings.atmosphere && sky !== null;

  function freeBloom(): void {
    for (const target of [bloomA, bloomB, wideA, wideB]) target?.dispose();
    bloomA = bloomB = wideA = wideB = null;
  }

  function freeTargets(): void {
    sceneTarget?.depthTexture?.dispose();
    sceneTarget?.dispose();
    sceneTarget = null;
    freeBloom();
  }

  function applySettings(): void {
    renderer.toneMapping = settings.toneMapping ? THREE.NeutralToneMapping : THREE.NoToneMapping;
    const defines: Record<string, string> = {};
    if (settings.bloom) defines.BLOOM = '';
    if (settings.tiltShift) defines.TILT_SHIFT = '';
    if (settings.vignette) defines.VIGNETTE = '';
    if (air()) defines.ATMOSPHERE = '';
    if (settings.grade) defines.GRADE = '';
    final.defines = defines;
    final.needsUpdate = true;
    // A changed sample count needs a new target, and so does the air, which needs the depth. So does going
    // back to drawing straight to the screen.
    if (!offScreen() || (sceneTarget && (sceneTarget.samples !== settings.msaa || !!sceneTarget.depthTexture !== air()))) freeTargets();
    if (!settings.bloom && bloomA) freeBloom();
  }

  function setPixelRatio(ratio: number): void {
    if (Math.abs(ratio - appliedPixelRatio) < 1e-4) return;
    appliedPixelRatio = ratio;
    renderer.setPixelRatio(ratio);
  }

  function draw(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    passMesh.material = material;
    renderer.setRenderTarget(target);
    renderer.render(passScene, passCamera);
  }

  applySettings();

  const post: Post = {
    settings,
    costs: COSTS,

    set(changes) {
      Object.assign(settings, changes);
      settings.renderScale = Math.min(1, Math.max(0.5, settings.renderScale));
      applySettings();
    },

    setRenderScale(scale) {
      settings.renderScale = Math.min(1, Math.max(0.5, scale));
    },

    setFocus(position) {
      focus.set(position.x, position.y, position.z);
      hasFocus = true;
    },

    setPixelRatio(pixelRatio) {
      basePixelRatio = pixelRatio;
    },

    setSky(next) {
      sky = next;
      applySettings();
    },

    setQuality(quality) {
      Object.assign(settings, LEVELS[quality]);
      applySettings();
    },

    cost() {
      if (!offScreen()) return { passes: 0, screens: 0, megabytes: 0 };
      const pixels = width * height;
      // Half-float color is 8 bytes a pixel and depth is 4. Multisampling keeps a second, larger copy of both.
      let bytes = pixels * 8 + (settings.msaa > 0 ? pixels * 12 * settings.msaa : pixels * 4);
      if (settings.bloom) bytes += 2 * (width >> 2) * (height >> 2) * 8 + 2 * (width >> 3) * (height >> 3) * 8;
      if (air()) bytes += pixels * 4;
      const scale = settings.renderScale * settings.renderScale;
      return {
        passes: settings.bloom ? 6 : 1,
        screens: 1 + (settings.bloom ? (3 / 16 + 2 / 64) * scale : 0),
        megabytes: Math.round((bytes / 1048576) * 10) / 10,
      };
    },

    update(_dt, latest) {
      view = latest;
    },

    render() {
      // Several passes are one frame. Count their draw calls together, whoever reads the counter.
      const autoReset = renderer.info.autoReset;
      renderer.info.autoReset = false;
      renderer.info.reset();

      if (!offScreen()) {
        // No passes at all: the size change is the canvas's own.
        setPixelRatio(basePixelRatio * settings.renderScale);
        renderer.setRenderTarget(null);
        renderer.render(view.scene, view.camera);
        renderer.info.autoReset = autoReset;
        return;
      }

      setPixelRatio(basePixelRatio);
      renderer.getDrawingBufferSize(size);
      const w = Math.max(2, Math.round(size.x * settings.renderScale));
      const h = Math.max(2, Math.round(size.y * settings.renderScale));
      if (!sceneTarget) {
        sceneTarget = new THREE.WebGLRenderTarget(w, h, { ...targetOptions, depthBuffer: true, samples: settings.msaa });
        // The air reads the depth. A multisampled target resolves it into this texture after the scene.
        if (air()) sceneTarget.depthTexture = new THREE.DepthTexture(w, h);
        width = 0;
      }
      if (settings.bloom && !bloomA) {
        bloomA = new THREE.WebGLRenderTarget(2, 2, targetOptions);
        bloomB = new THREE.WebGLRenderTarget(2, 2, targetOptions);
        wideA = new THREE.WebGLRenderTarget(2, 2, targetOptions);
        wideB = new THREE.WebGLRenderTarget(2, 2, targetOptions);
        width = 0;
      }
      if (w !== width || h !== height) {
        width = w;
        height = h;
        sceneTarget.setSize(w, h);
        bloomA?.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
        bloomB?.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
        wideA?.setSize(Math.max(1, w >> 3), Math.max(1, h >> 3));
        wideB?.setSize(Math.max(1, w >> 3), Math.max(1, h >> 3));
      }

      renderer.setRenderTarget(sceneTarget);
      renderer.render(view.scene, view.camera);

      if (settings.bloom && bloomA && bloomB && wideA && wideB) {
        // A tight glow at a quarter size, and a wide one at an eighth, blurred from the tight one.
        bright.uniforms.tScene.value = sceneTarget.texture;
        bright.uniforms.uTexel.value.set(1 / w, 1 / h);
        draw(bright, bloomA);
        blur.uniforms.tSource.value = bloomA.texture;
        blur.uniforms.uStep.value.set(4 / w, 0);
        draw(blur, bloomB);
        blur.uniforms.tSource.value = bloomB.texture;
        blur.uniforms.uStep.value.set(0, 4 / h);
        draw(blur, bloomA);
        blur.uniforms.tSource.value = bloomA.texture;
        blur.uniforms.uStep.value.set(12 / w, 0);
        draw(blur, wideA);
        blur.uniforms.tSource.value = wideA.texture;
        blur.uniforms.uStep.value.set(0, 12 / h);
        draw(blur, wideB);
        final.uniforms.tBloom.value = bloomA.texture;
        final.uniforms.tBloomWide.value = wideB.texture;
      }

      if (air() && sky && sceneTarget.depthTexture) {
        const u = final.uniforms;
        u.tDepth.value = sceneTarget.depthTexture;
        u.uProjectionInverse.value.copy(view.camera.projectionMatrixInverse);
        u.uCameraWorld.value.copy(view.camera.matrixWorld);
        u.uTop.value.copy(sky.zenith);
        u.uMid.value.copy(sky.middle);
        u.uBot.value.copy(sky.horizon);
        u.uFog.value.copy(sky.fog);
        u.uSunColor.value.copy(sky.glow);
        u.uSunDir.value.copy(sky.sunInSky);
        // Mist density per meter at its level.
        u.uAir.value.set(sky.fogNear, sky.fogFar, sky.mist * 0.03, sky.mistLevel);
      }

      if (settings.tiltShift) {
        // The focus point's height on screen. Without one, the middle.
        let focusY = 0.5;
        if (hasFocus) {
          projected.copy(focus).project(view.camera);
          focusY = Math.min(0.8, Math.max(0.2, projected.y * 0.5 + 0.5));
        }
        final.uniforms.uFocusY.value = focusY;
      }
      final.uniforms.tScene.value = sceneTarget.texture;
      // The blur is sized against a screen 820 pixels tall, so it looks the same at any size.
      final.uniforms.uTexel.value.set(1 / w, 1 / h).multiplyScalar(h / 820);
      draw(final, null);

      renderer.info.autoReset = autoReset;
    },

    dispose() {
      freeTargets();
      triangle.dispose();
      bright.dispose();
      blur.dispose();
      final.dispose();
      sky = null;
      renderer.toneMapping = toneMappingBefore;
      setPixelRatio(basePixelRatio);
    },
  };
  return post;
}
