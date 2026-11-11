// Turns the rendered frame into a painting. The main step is an anisotropic Kuwahara filter (Kyprianidis,
// Kang and Döllner 2009, with the polynomial weights of their 2010 paper): each pixel takes the average of
// the calmest of eight sectors round it, and the sectors stretch along the edges in the picture. Flat
// areas become flat dabs of one colour and edges stay sharp, which is what a loaded brush does.
//
// The order: the scene in linear light, then display colour, then the picture's local direction (a
// structure tensor, blurred), then the filter, then the grade and the paper.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export interface PostSettings {
  /** Runs the paint filter. */
  paint: boolean;
  /** The brush's radius in pixels. 0 turns the filter off. */
  radius: number;
  /** How strongly the paper's grain shows. */
  grain: number;
  saturation: number;
}

export interface Post {
  settings: PostSettings;
  /** Draw calls and triangles of the scene itself in the last frame, shadows included, the filter's passes left out. */
  stats: { calls: number; triangles: number };
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void;
  setSize(width: number, height: number): void;
}

const VERTEX = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const ENCODE = /* glsl */ `
uniform sampler2D tInput; varying vec2 vUv;
void main() {
  vec3 c = max(texture2D(tInput, vUv).rgb, 0.0);
  // Soft shoulder for the few values over 1, then the display curve.
  c = mix(c, 1.0 - exp(-c), smoothstep(0.7, 1.4, c));
  gl_FragColor = vec4(mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)), 1.0);
}`;

const TENSOR = /* glsl */ `
uniform sampler2D tInput; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec3 tl = texture2D(tInput, vUv + uTexel * vec2(-1.0, -1.0)).rgb, tc = texture2D(tInput, vUv + uTexel * vec2(0.0, -1.0)).rgb, tr = texture2D(tInput, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  vec3 ml = texture2D(tInput, vUv + uTexel * vec2(-1.0, 0.0)).rgb, mr = texture2D(tInput, vUv + uTexel * vec2(1.0, 0.0)).rgb;
  vec3 bl = texture2D(tInput, vUv + uTexel * vec2(-1.0, 1.0)).rgb, bc = texture2D(tInput, vUv + uTexel * vec2(0.0, 1.0)).rgb, br = texture2D(tInput, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  vec3 sx = (-tl - 2.0 * ml - bl + tr + 2.0 * mr + br) * 0.25;
  vec3 sy = (-tl - 2.0 * tc - tr + bl + 2.0 * bc + br) * 0.25;
  gl_FragColor = vec4(dot(sx, sx), dot(sy, sy), dot(sx, sy), 1.0);
}`;

const BLUR = /* glsl */ `
uniform sampler2D tInput; uniform vec2 uStep; varying vec2 vUv;
void main() {
  vec4 sum = texture2D(tInput, vUv) * 0.227;
  sum += (texture2D(tInput, vUv + uStep * 1.385) + texture2D(tInput, vUv - uStep * 1.385)) * 0.316;
  sum += (texture2D(tInput, vUv + uStep * 3.231) + texture2D(tInput, vUv - uStep * 3.231)) * 0.0705;
  gl_FragColor = sum;
}`;

const KUWAHARA = /* glsl */ `
uniform sampler2D tInput, tTensor; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
const float ALPHA = 1.0, ZERO_CROSSING = 0.58, HARDNESS = 8.0, SHARPNESS = 8.0;
void main() {
  vec3 t = texture2D(tTensor, vUv).xyz;
  float root = sqrt(max(0.0, t.y * t.y - 2.0 * t.x * t.y + t.x * t.x + 4.0 * t.z * t.z));
  float lambda1 = 0.5 * (t.y + t.x + root), lambda2 = 0.5 * (t.y + t.x - root);
  vec2 v = vec2(lambda1 - t.x, -t.z);
  vec2 dir = length(v) > 0.0 ? normalize(v) : vec2(0.0, 1.0);
  float phi = -atan(dir.y, dir.x);
  float aniso = lambda1 + lambda2 > 0.0 ? (lambda1 - lambda2) / (lambda1 + lambda2) : 0.0;

  // The brush is an ellipse: long across the picture's local direction, short along it.
  float a = uRadius * clamp((ALPHA + aniso) / ALPHA, 0.1, 2.0), b = uRadius * clamp(ALPHA / (ALPHA + aniso), 0.1, 2.0);
  float cosPhi = cos(phi), sinPhi = sin(phi);
  mat2 SR = mat2(0.5 / a, 0.0, 0.0, 0.5 / b) * mat2(cosPhi, sinPhi, -sinPhi, cosPhi);
  int maxX = int(sqrt(a * a * cosPhi * cosPhi + b * b * sinPhi * sinPhi));
  int maxY = int(sqrt(a * a * sinPhi * sinPhi + b * b * cosPhi * cosPhi));
  float zeta = 2.0 / uRadius, sinZero = sin(ZERO_CROSSING), eta = (zeta + cos(ZERO_CROSSING)) / (sinZero * sinZero);

  vec4 m[8]; vec3 s[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
  for (int y = -maxY; y <= maxY; y++) {
    for (int x = -maxX; x <= maxX; x++) {
      vec2 p = SR * vec2(float(x), float(y));
      if (dot(p, p) > 0.25) continue;
      vec3 c = texture2D(tInput, vUv + vec2(float(x), float(y)) * uTexel).rgb;
      float w[8]; float sum = 0.0, z, vxx = zeta - eta * p.x * p.x, vyy = zeta - eta * p.y * p.y;
      z = max(0.0, p.y + vxx); w[0] = z * z; sum += w[0];
      z = max(0.0, -p.x + vyy); w[2] = z * z; sum += w[2];
      z = max(0.0, -p.y + vxx); w[4] = z * z; sum += w[4];
      z = max(0.0, p.x + vyy); w[6] = z * z; sum += w[6];
      vec2 q = 0.70710678 * vec2(p.x - p.y, p.x + p.y);
      vxx = zeta - eta * q.x * q.x; vyy = zeta - eta * q.y * q.y;
      z = max(0.0, q.y + vxx); w[1] = z * z; sum += w[1];
      z = max(0.0, -q.x + vyy); w[3] = z * z; sum += w[3];
      z = max(0.0, -q.y + vxx); w[5] = z * z; sum += w[5];
      z = max(0.0, q.x + vyy); w[7] = z * z; sum += w[7];
      float g = exp(-3.125 * dot(q, q)) / sum;
      for (int k = 0; k < 8; k++) { float wk = w[k] * g; m[k] += vec4(c * wk, wk); s[k] += c * c * wk; }
    }
  }
  vec4 result = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    float total = max(m[k].w, 1e-5);
    vec3 mean = m[k].rgb / total, variance = abs(s[k] / total - mean * mean);
    float weight = 1.0 / (1.0 + pow(HARDNESS * 1000.0 * (variance.r + variance.g + variance.b), 0.5 * SHARPNESS));
    result += vec4(mean * weight, weight);
  }
  gl_FragColor = vec4(clamp(result.rgb / result.w, 0.0, 1.0), 1.0);
}`;

const FINAL = /* glsl */ `
uniform sampler2D tInput, tPaper; uniform vec2 uSize; uniform float uGrain, uSaturation, uPaperMean; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb;
  c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uSaturation);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.12);
  // Paper: its grain lightens and darkens the paint a little, and the paint thins toward the sheet's edge.
  float paper = texture2D(tPaper, vUv * uSize / 620.0).r / uPaperMean - 1.0;
  c *= 1.0 + paper * uGrain;
  vec2 e = vUv - 0.5;
  c = mix(c, c * 0.95 + 0.025, smoothstep(0.42, 0.75, length(e * vec2(1.0, 0.85))));
  gl_FragColor = vec4(c, 1.0);
}`;

export function createPost(paper: THREE.Texture, paperMean: number): Post {
  const settings: PostSettings = { paint: true, radius: 5, grain: 0.5, saturation: 1.1 };
  const target = (type: THREE.TextureDataType, samples = 0): THREE.WebGLRenderTarget =>
    new THREE.WebGLRenderTarget(4, 4, { type, samples, depthBuffer: samples > 0, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const sceneTarget = target(THREE.HalfFloatType, 4), display = target(THREE.UnsignedByteType), painted = target(THREE.UnsignedByteType);
  const tensorA = target(THREE.HalfFloatType), tensorB = target(THREE.HalfFloatType);
  const pass = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial =>
    new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  const texel = new THREE.Vector2(), size = new THREE.Vector2();
  const encode = pass(ENCODE, { tInput: { value: sceneTarget.texture } });
  const tensor = pass(TENSOR, { tInput: { value: display.texture }, uTexel: { value: texel } });
  const blur = pass(BLUR, { tInput: { value: null }, uStep: { value: new THREE.Vector2() } });
  const kuwahara = pass(KUWAHARA, { tInput: { value: display.texture }, tTensor: { value: tensorA.texture }, uTexel: { value: texel }, uRadius: { value: 5 } });
  const final = pass(FINAL, { tInput: { value: null }, tPaper: { value: paper }, uSize: { value: size }, uGrain: { value: 0 }, uSaturation: { value: 1 }, uPaperMean: { value: paperMean } });
  const quad = new FullScreenQuad();
  const draw = (renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, to: THREE.WebGLRenderTarget | null): void => {
    quad.material = material;
    renderer.setRenderTarget(to);
    quad.render(renderer);
  };

  const stats = { calls: 0, triangles: 0 };
  return {
    settings, stats,
    setSize(width, height) {
      for (const t of [sceneTarget, display, painted, tensorA, tensorB]) t.setSize(width, height);
      texel.set(1 / width, 1 / height);
      size.set(width, height);
    },
    render(renderer, scene, camera) {
      renderer.info.reset();
      renderer.setRenderTarget(sceneTarget);
      renderer.render(scene, camera);
      stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
      draw(renderer, encode, display);
      const on = settings.paint && settings.radius >= 1;
      if (on) {
        draw(renderer, tensor, tensorA);
        blur.uniforms.tInput!.value = tensorA.texture; (blur.uniforms.uStep!.value as THREE.Vector2).set(texel.x, 0);
        draw(renderer, blur, tensorB);
        blur.uniforms.tInput!.value = tensorB.texture; (blur.uniforms.uStep!.value as THREE.Vector2).set(0, texel.y);
        draw(renderer, blur, tensorA);
        kuwahara.uniforms.uRadius!.value = settings.radius;
        draw(renderer, kuwahara, painted);
      }
      final.uniforms.tInput!.value = on ? painted.texture : display.texture;
      final.uniforms.uGrain!.value = settings.grain * 0.16;
      final.uniforms.uSaturation!.value = settings.saturation;
      draw(renderer, final, null);
    },
  };
}
