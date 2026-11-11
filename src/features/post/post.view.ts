// The final picture: bloom for glowing things, a soft blur far from the focus for the miniature look, a
// vignette, tone mapping and the render size. Call `post.render()` in place of `renderer.render(scene, camera)`.
//
// Every part has a switch and a known cost (`post.costs`). With bloom, blur and vignette all off there are no
// extra passes at all: the scene is drawn straight to the screen, and tone mapping happens in each material
// for free. That is the `low` level, at three-quarter size.
//
//   scene -> [bright parts, quarter size] -> [blur across] -> [blur down] -> final pass -> screen
//
// With everything on that is four small draw calls after the scene.
import * as THREE from 'three';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Vec3 } from '../../engine/types.ts';
import { QUALITY, type Level } from '../../content/quality.ts';

export interface PostSettings {
  /** Glow around bright things: lamps, lume, the sun, lightning, glowing particles. */
  bloom: boolean;
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
  /** How much stronger than drawn the colours come out. 1 leaves them as they are; 1.08 when left out. */
  saturation?: number;
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
  /** The cost of the current settings. */
  cost(): PostCost;
}

/** A level's switches, from the quality table. */
function levelSettings(level: Level): PostSettings {
  const q = QUALITY[level];
  return { bloom: q.bloom, tiltShift: q.tiltShift, vignette: q.vignette, toneMapping: q.toneMapping, renderScale: q.renderScale, msaa: q.msaa };
}

const COSTS: Record<keyof PostSettings, string> = {
  bloom: 'Three draw calls at a quarter of the width and height: about a fifth of one full-screen pass, plus one texture read in the final pass.',
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

// Keeps only what is brighter than the threshold, and shrinks it to a quarter in the same pass:
// four reads, each the average of four pixels.
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
  c *= max(brightest - uThreshold, 0.0) / max(brightest, 1e-4);
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

const FINAL = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tScene, tBloom;
uniform vec2 uTexel;
uniform float uBloom, uTilt, uFocusY, uVignette, uSaturation;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
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
  #ifdef BLOOM
  c += texture2D(tBloom, vUv).rgb * uBloom;
  #endif
  #ifdef VIGNETTE
  vec2 v = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(v * vec2(1.0, 0.8)) * 1.35);
  #endif
  c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uSaturation);
  gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // A little noise hides banding in skies and fog.
  gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
}`;

export function createPost(ctx: ViewContext, options: PostOptions = {}): Post {
  const { renderer } = ctx;
  // The scene and camera to draw: the ones from the latest `update`.
  let view = ctx;
  const settings: PostSettings = levelSettings(ctx.quality);
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
      uTexel: { value: new THREE.Vector2() },
      uBloom: { value: options.bloomStrength ?? 0.7 },
      uTilt: { value: 2.2 },
      uFocusY: { value: 0.5 },
      uVignette: { value: 0.22 },
      uSaturation: { value: options.saturation ?? 1.08 },
    },
    true,
  );

  // Render targets are made when first needed and resized with the screen.
  const targetOptions = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  let sceneTarget: THREE.WebGLRenderTarget | null = null;
  let bloomA: THREE.WebGLRenderTarget | null = null;
  let bloomB: THREE.WebGLRenderTarget | null = null;
  let width = 0;
  let height = 0;

  const size = new THREE.Vector2();
  const focus = new THREE.Vector3();
  const projected = new THREE.Vector3();
  let hasFocus = false;

  const offScreen = () => settings.bloom || settings.tiltShift || settings.vignette;

  function freeTargets(): void {
    sceneTarget?.dispose();
    bloomA?.dispose();
    bloomB?.dispose();
    sceneTarget = bloomA = bloomB = null;
  }

  function applySettings(): void {
    renderer.toneMapping = settings.toneMapping ? THREE.NeutralToneMapping : THREE.NoToneMapping;
    const defines: Record<string, string> = {};
    if (settings.bloom) defines.BLOOM = '';
    if (settings.tiltShift) defines.TILT_SHIFT = '';
    if (settings.vignette) defines.VIGNETTE = '';
    final.defines = defines;
    final.needsUpdate = true;
    // A changed sample count needs a new target. So does going back to drawing straight to the screen.
    if (!offScreen() || (sceneTarget && sceneTarget.samples !== settings.msaa)) freeTargets();
    if (!settings.bloom && bloomA) {
      bloomA.dispose();
      bloomB?.dispose();
      bloomA = bloomB = null;
    }
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

    setQuality(quality) {
      Object.assign(settings, levelSettings(quality));
      applySettings();
    },

    cost() {
      if (!offScreen()) return { passes: 0, screens: 0, megabytes: 0 };
      const pixels = width * height;
      // Half-float color is 8 bytes a pixel and depth is 4. Multisampling keeps a second, larger copy of both.
      let bytes = pixels * 8 + (settings.msaa > 0 ? pixels * 12 * settings.msaa : pixels * 4);
      if (settings.bloom) bytes += 2 * (width >> 2) * (height >> 2) * 8;
      const scale = settings.renderScale * settings.renderScale;
      return {
        passes: settings.bloom ? 4 : 1,
        screens: 1 + (settings.bloom ? (3 / 16) * scale : 0),
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
      if (!sceneTarget) sceneTarget = new THREE.WebGLRenderTarget(w, h, { ...targetOptions, depthBuffer: true, samples: settings.msaa });
      if (settings.bloom && !bloomA) {
        bloomA = new THREE.WebGLRenderTarget(2, 2, targetOptions);
        bloomB = new THREE.WebGLRenderTarget(2, 2, targetOptions);
        width = 0;
      }
      if (w !== width || h !== height) {
        width = w;
        height = h;
        sceneTarget.setSize(w, h);
        bloomA?.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
        bloomB?.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
      }

      renderer.setRenderTarget(sceneTarget);
      renderer.render(view.scene, view.camera);

      if (settings.bloom && bloomA && bloomB) {
        bright.uniforms.tScene.value = sceneTarget.texture;
        bright.uniforms.uTexel.value.set(1 / w, 1 / h);
        draw(bright, bloomA);
        blur.uniforms.tSource.value = bloomA.texture;
        blur.uniforms.uStep.value.set(6 / w, 0);
        draw(blur, bloomB);
        blur.uniforms.tSource.value = bloomB.texture;
        blur.uniforms.uStep.value.set(0, 6 / h);
        draw(blur, bloomA);
        final.uniforms.tBloom.value = bloomA.texture;
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
      renderer.toneMapping = toneMappingBefore;
      setPixelRatio(basePixelRatio);
    },
  };
  return post;
}
