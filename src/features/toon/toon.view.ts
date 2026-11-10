// Characters as toon-shaded 3D models. Every character of one body is one instance of one mesh, posed on the GPU
// from baked clips, so a crowd of one body costs three draw calls whatever its size: the bodies, their outlines,
// and their shapes in the sun's shadow map.
//
// What the CPU does each frame: for each character it steps a phase through its clip (and the one it is fading
// from), turns it toward its facing, and writes thirteen texels: the two clips, which parts it wears, the light
// where it stands, and its ten colours. What the GPU does: it reads two poses from the baked texture and blends
// them, colours each vertex from its slot, and lights it in steps with a soft rim of sun.
//
// A body's geometry needs `skinIndex`, `skinWeight` (four bones each, in the rig's order) and `tone`: the colour
// slot (0 to 9), the shade (0 to 255 for 0 to 2), the part (0 is always worn), and a glow (0 to 255). A body from a
// file may also bring a texture (`uv`) and vertex colours (`color`), which multiply its slot colours.
import * as THREE from 'three';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Quality } from '../../engine/types.ts';
import type { WorldQuery } from '../../engine/world-query.ts';
import { bake, bakedTexture, type BakeOptions, type Baked, type BakedClip } from './bake.ts';

/** One colour per slot, as 0xrrggbb in sRGB. */
export type Palette = readonly number[];
export const SLOTS = 10;
/** The slots, by name. A body paints with these; a palette gives a colour for each. */
export const SLOT = { skin: 0, hair: 1, eyes: 2, top: 3, bottom: 4, accent: 5, leather: 6, metal: 7, hat: 8, extra: 9 } as const;
export type SlotName = keyof typeof SLOT;

export interface ToonRigSpec extends BakeOptions {
  /** The object the bones hang from. Its own transform is left out. */
  root: THREE.Object3D;
  bones: readonly THREE.Bone[];
  inverses: readonly THREE.Matrix4[];
  clips: readonly THREE.AnimationClip[];
  /** The game's animation names to clip names. A name not listed is looked up as it is. */
  names?: Readonly<Record<string, string>>;
  /** The walk and the run, for the gait. The run takes over above `runFrom` blocks a second. */
  walk?: string;
  run?: string;
  runFrom?: number;
}

export interface ToonBodySpec {
  rig: string;
  geometry: THREE.BufferGeometry;
  /** Part names in order. Part 0 is always worn. At most 24. */
  parts: readonly string[];
  /**
   * A rougher shape on the same rig and parts that casts the shadow in place of the body, so the sun's shadow pass
   * does not draw every triangle of every character again. Without it the body casts its own.
   */
  shadow?: THREE.BufferGeometry;
  /** A texture that multiplies the slot colours, read through the geometry's `uv`. */
  map?: THREE.Texture | null;
  /** True to multiply the slot colours by the geometry's `color`. */
  vertexColours?: boolean;
}

export interface ToonAddOptions {
  x?: number;
  y?: number;
  z?: number;
  /** Radians. 0 is north (-z), a quarter turn is east (+x), as for sprites. */
  facing?: number;
  animation?: string;
  visible?: boolean;
  palette: Palette;
  /** Part names worn besides part 0. */
  parts?: readonly string[];
  /** Parts worn only while this animation plays, such as a tool in the hand. */
  partsWhile?: Readonly<Record<string, readonly string[]>>;
  /** Blocks per unit of the body. Default 1. */
  scale?: number;
}

/** One character. The same calls as a sprite handle, so the shell can drive either. After `remove` they do nothing. */
export interface ToonHandle {
  setPosition(x: number, y: number, z: number): void;
  setFacing(radians: number): void;
  /** Fades to the clip for this animation. False when the rig has none. Safe to call every frame. */
  play(animation: string): boolean;
  setVisible(visible: boolean): void;
  remove(): void;
  readonly body: string;
  readonly animation: string;
  readonly alive: boolean;
}

export interface ToonStats {
  characters: number;
  /** Draw calls in the last render: bodies and outlines (the shadow pass is not counted here). */
  drawCalls: number;
  triangles: number;
}

export interface ToonCast extends ViewSystem {
  addRig(name: string, spec: ToonRigSpec): void;
  addBody(name: string, spec: ToonBodySpec): void;
  hasBody(name: string): boolean;
  add(body: string, options: ToonAddOptions): ToonHandle;
  /** The sky's sun: the rim takes its colour. */
  setSun(sun: THREE.DirectionalLight | null): void;
  /** Removes every character. Bodies and rigs stay. */
  clear(): void;
  readonly stats: Readonly<ToonStats>;
}

export interface ToonOptions {
  /** The outline's width in blocks. 0 is none. Default 0.028. */
  outline?: number;
  /** Light that is always there, so a character in the darkest cave still shows. Default 0.08. */
  minLight?: number;
  /** The layer only the sun's shadow camera sees, for the bodies' rough shadow shapes. The sky's; default 30. */
  shadowLayer?: number;
}

/** Seconds a change of animation blends over. */
const FADE = 0.18;
/** How fast a character turns toward its facing, per second. */
const TURN_RATE = 14;
/** How fast the measured speed follows the real one, per second. */
const SPEED_EASE = 10;
/** A walk or run is never played slower or faster than this, whatever the speed. */
const GAIT_RATE: readonly [number, number] = [0.55, 1.8];
/** Texels per character in the instance texture: clip A, clip B, wear and light, then the colours. */
const TEXELS = 3 + SLOTS;
/** Lamp light at full strength, as for sprites and the terrain. */
const LAMP: readonly [number, number, number] = [1.3, 1.0, 0.62];
/** How many characters re-read the world's light each frame. */
const REFRESH: Record<Quality, number> = { low: 4, medium: 8, high: 16 };

// ---------------------------------------------------------------- shaders

const VERTEX_PARS = /* glsl */ `
uniform highp sampler2D uBones;
uniform vec2 uBonesSize;
uniform highp sampler2D uInstances;
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute vec4 tone;
varying vec3 vToon;
varying vec3 vToonLight;
varying float vToonGlow;
mat4 toonM;
float toonScale;
float toonWorn;

mat4 toonBone(float bone, float row) {
  float y = (row + 0.5) / uBonesSize.y;
  float x = bone * 3.0 + 0.5;
  vec4 a = texture(uBones, vec2(x / uBonesSize.x, y));
  vec4 b = texture(uBones, vec2((x + 1.0) / uBonesSize.x, y));
  vec4 c = texture(uBones, vec2((x + 2.0) / uBonesSize.x, y));
  return transpose(mat4(a, b, c, vec4(0.0, 0.0, 0.0, 1.0)));
}

mat4 toonPose(vec4 clip) {
  float row = clip.x + clip.z * clip.y;
  mat4 m = skinWeight.x * toonBone(skinIndex.x, row);
  if (skinWeight.y > 0.0) m += skinWeight.y * toonBone(skinIndex.y, row);
  if (skinWeight.z > 0.0) m += skinWeight.z * toonBone(skinIndex.z, row);
  if (skinWeight.w > 0.0) m += skinWeight.w * toonBone(skinIndex.w, row);
  return m;
}

void toonSkin() {
  vec4 clipA = texelFetch(uInstances, ivec2(0, gl_InstanceID), 0);
  vec4 clipB = texelFetch(uInstances, ivec2(1, gl_InstanceID), 0);
  vec4 info = texelFetch(uInstances, ivec2(2, gl_InstanceID), 0);
  toonM = toonPose(clipA);
  if (clipB.w > 0.0) toonM = toonM * (1.0 - clipB.w) + toonPose(clipB) * clipB.w;
  // A part not worn folds to one point, so its triangles draw nothing.
  int part = int(tone.z + 0.5);
  toonWorn = float((int(info.x + 0.5) >> part) & 1);
  if (toonWorn < 0.5) toonM = mat4(0.0);
  vToon = texelFetch(uInstances, ivec2(3 + int(tone.x + 0.5), gl_InstanceID), 0).rgb * (tone.y / 127.5);
  vToonGlow = tone.w / 255.0;
  // Sky light (0 to 1) dims the whole body; lamp light adds warmth, as the blocks around it get.
  vToonLight = vec3(info.y, info.z, 0.0);
  toonScale = clipA.w;
}
`;

/** Patches a built-in material to pose its vertices from the baked clips. */
function poseVertices(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: Record<string, THREE.IUniform>, skinIn: 'normal' | 'position', extra = ''): void {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${VERTEX_PARS}`);
  if (skinIn === 'normal') {
    shader.vertexShader = shader.vertexShader
      .replace('#include <beginnormal_vertex>', 'toonSkin();\nvec3 objectNormal = mat3(toonM) * vec3(normal);\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(tangent.xyz);\n#endif')
      .replace('#include <begin_vertex>', `vec3 transformed = (toonM * vec4(position, 1.0)).xyz;\n${extra}`);
  } else {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `toonSkin();\nvec3 transformed = (toonM * vec4(position, 1.0)).xyz;\n${extra}`);
  }
}

// ---------------------------------------------------------------- the system

interface Rig {
  baked: Baked;
  texture: THREE.DataTexture;
  names: Readonly<Record<string, string>>;
  walk: BakedClip | null;
  run: BakedClip | null;
  runFrom: number;
}

interface Body {
  name: string;
  rig: Rig;
  parts: readonly string[];
  geometry: THREE.BufferGeometry;
  mesh: THREE.InstancedMesh;
  outline: THREE.InstancedMesh;
  /** The rough shape that casts the shadow, or null when the body casts its own. */
  shadow: THREE.InstancedMesh | null;
  capacity: number;
  instances: Float32Array;
  instanceTexture: THREE.DataTexture;
  /** The uniforms all three materials read, so a new instance texture reaches them all. */
  uniforms: { uInstances: THREE.IUniform<THREE.DataTexture> };
  material: THREE.MeshToonMaterial;
  outlineMaterial: THREE.MeshBasicMaterial;
  depthMaterial: THREE.MeshDepthMaterial;
  triangles: number;
  members: Character[];
}

/** One clip playing, and where it is. */
interface Track {
  clip: BakedClip | null;
  phase: number;
}

class Character implements ToonHandle {
  x = 0; y = 0; z = 0;
  /** Where it was at the last update, for its speed. */
  lastX = NaN; lastZ = NaN;
  speed = 0;
  facing = Math.PI;
  turned = Math.PI;
  visible = true;
  alive = true;
  animation = '';
  current: Track = { clip: null, phase: 0 };
  previous: Track = { clip: null, phase: 0 };
  /** 0 to 1 through the fade from `previous` to `current`. 1 when there is none. */
  fade = 1;
  wear: number;
  wearWhile: Map<string, number>;
  colours = new Float32Array(SLOTS * 3);
  sky = 1;
  lamp = 0;
  cellX = NaN; cellY = NaN; cellZ = NaN;

  constructor(readonly owner: Body, readonly scale: number, wear: number, wearWhile: Map<string, number>, private readonly onRemove: (c: Character) => void) {
    this.wear = wear;
    this.wearWhile = wearWhile;
  }

  get body(): string { return this.owner.name; }

  setPosition(x: number, y: number, z: number): void {
    if (!this.alive) return;
    this.x = x; this.y = y; this.z = z;
  }

  setFacing(radians: number): void {
    if (this.alive) this.facing = radians;
  }

  play(animation: string): boolean {
    if (!this.alive) return false;
    if (animation === this.animation) return true;
    const rig = this.owner.rig;
    const clip = rig.baked.clips.get(rig.names[animation] ?? animation) ?? null;
    if (!clip) return false;
    this.animation = animation;
    this.switchTo(clip);
    return true;
  }

  /** Starts a clip, fading from what was playing. A walk and a run keep the step they are on, so the feet stay in time. */
  switchTo(clip: BakedClip): void {
    const from = this.current;
    if (from.clip === clip) return;
    const rig = this.owner.rig;
    const gait = (c: BakedClip | null): boolean => c !== null && (c === rig.walk || c === rig.run);
    const phase = gait(from.clip) && gait(clip) ? from.phase : 0;
    if (from.clip) {
      this.previous.clip = from.clip;
      this.previous.phase = from.phase;
      this.fade = 0;
    }
    this.current = { clip, phase };
  }

  setVisible(visible: boolean): void {
    if (this.alive) this.visible = visible;
  }

  remove(): void {
    if (!this.alive) return;
    this.alive = false;
    this.onRemove(this);
  }

  step(dt: number): void {
    // Speed along the ground, from where it is drawn.
    if (dt > 0 && !Number.isNaN(this.lastX)) {
      const moved = Math.hypot(this.x - this.lastX, this.z - this.lastZ) / dt;
      // A jump of more than a few blocks is a teleport, not a stride.
      const measured = moved > 20 ? 0 : moved;
      this.speed += (measured - this.speed) * (1 - Math.exp(-SPEED_EASE * dt));
    }
    this.lastX = this.x;
    this.lastZ = this.z;

    let delta = this.facing - this.turned;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.turned += delta * (1 - Math.exp(-TURN_RATE * dt));

    const rig = this.owner.rig;
    // The walk turns into a run above `runFrom`, and back.
    const clip = this.current.clip;
    if (clip && rig.walk && rig.run && (clip === rig.walk || clip === rig.run)) {
      const want = this.speed > rig.runFrom ? rig.run : rig.walk;
      if (want !== clip) this.switchTo(want);
    }
    this.advance(this.current, dt);
    if (this.fade < 1) {
      this.advance(this.previous, dt);
      this.fade = Math.min(1, this.fade + dt / FADE);
    }
  }

  advance(track: Track, dt: number): void {
    const clip = track.clip;
    if (!clip) return;
    let rate = 1;
    if (clip.stride > 0) {
      // Played at the speed the feet would move, so they do not slide.
      rate = Math.min(GAIT_RATE[1], Math.max(GAIT_RATE[0], this.speed / (clip.stride * this.scale)));
    }
    track.phase += (dt * rate) / clip.seconds;
    track.phase = clip.loop ? track.phase - Math.floor(track.phase) : Math.min(1, track.phase);
  }
}

/** Two or three steps of light. Nearest filtering keeps the steps hard. */
function stepRamp(): THREE.DataTexture {
  const ramp = new THREE.DataTexture(new Uint8Array([
    132, 132, 132, 255,
    132, 132, 132, 255,
    200, 200, 200, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
  ]), 5, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

interface SplitLight {
  skyLightAt(x: number, y: number, z: number): number;
  blockLightAt(x: number, y: number, z: number): number;
}

function splitLightOf(world: WorldQuery): SplitLight | null {
  const maybe = world as Partial<SplitLight>;
  return typeof maybe.skyLightAt === 'function' && typeof maybe.blockLightAt === 'function' ? (world as unknown as SplitLight) : null;
}

export function createToonCast(ctx: ViewContext, options: ToonOptions = {}): ToonCast {
  const rigs = new Map<string, Rig>();
  const bodies = new Map<string, Body>();
  const ramp = stepRamp();
  const outlineWidth = options.outline ?? 0.028;
  const shadowLayer = options.shadowLayer ?? 30;
  const hidden = new THREE.MeshBasicMaterial({ name: 'toon-shadow-only' });
  const shared = {
    uRim: { value: new THREE.Color(0, 0, 0) },
    uLamp: { value: new THREE.Color(LAMP[0], LAMP[1], LAMP[2]) },
    uMinLight: { value: options.minLight ?? 0.08 },
    uOutline: { value: outlineWidth },
  };
  const stats: ToonStats = { characters: 0, drawCalls: 0, triangles: 0 };
  let countedCall = -1;
  let sun: THREE.DirectionalLight | null = null;
  let quality: Quality = ctx.quality;
  let world = ctx.world;
  let splitLight = splitLightOf(world);
  let cursor = 0;
  const all: Character[] = [];

  function readLight(c: Character): void {
    const lightY = c.y + 0.5;
    c.sky = (splitLight ? splitLight.skyLightAt(c.x, lightY, c.z) : world.lightAt(c.x, lightY, c.z)) / 15;
    c.lamp = splitLight ? splitLight.blockLightAt(c.x, lightY, c.z) / 15 : 0;
  }

  function instanceTexture(capacity: number): { data: Float32Array; texture: THREE.DataTexture } {
    const data = new Float32Array(capacity * TEXELS * 4);
    const texture = new THREE.DataTexture(data, TEXELS, capacity, THREE.RGBAFormat, THREE.FloatType);
    texture.minFilter = texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return { data, texture };
  }

  function makeBody(name: string, rig: Rig, spec: ToonBodySpec): Body {
    const capacity = 16;
    const { data, texture } = instanceTexture(capacity);
    const uniforms = {
      uBones: { value: rig.texture },
      uBonesSize: { value: new THREE.Vector2(rig.baked.bones * 3, rig.baked.rows) },
      uInstances: { value: texture },
    };

    const material = new THREE.MeshToonMaterial({ gradientMap: ramp, name: `toon-${name}`, map: spec.map ?? null, vertexColors: spec.vertexColours ?? false });
    material.onBeforeCompile = (shader) => {
      poseVertices(shader, { ...uniforms, ...shared }, 'normal');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform vec3 uRim;
uniform vec3 uLamp;
uniform float uMinLight;
varying vec3 vToon;
varying vec3 vToonLight;
varying float vToonGlow;`)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vToon, opacity );')
        .replace('#include <opaque_fragment>', `
          // Sky light where it stands dims everything; lamp light adds warmth.
          float sky = pow(0.8, 15.0 * (1.0 - vToonLight.x));
          float lamp = pow(0.8, 15.0 * (1.0 - vToonLight.y)) * step(0.02, vToonLight.y);
          outgoingLight = outgoingLight * (sky + uMinLight) + diffuseColor.rgb * uLamp * lamp * 0.6;
          // A soft rim of sun on the edges that face it, the way toon games pick a body out of the field.
          #if NUM_DIR_LIGHTS > 0
            float edge = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
            float toSun = saturate(dot(normal, directionalLights[0].direction) + 0.2);
            outgoingLight += diffuseColor.rgb * uRim * smoothstep(0.62, 0.9, edge) * toSun * sky;
          #endif
          outgoingLight += vToon * vToonGlow * 1.6;
          #include <opaque_fragment>`);
    };

    const outlineMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: true, name: `toon-outline-${name}` });
    outlineMaterial.onBeforeCompile = (shader) => {
      // Pushed out along the normal by a width in blocks, whatever the character's scale.
      poseVertices(shader, { ...uniforms, ...shared }, 'position',
        'if (toonWorn > 0.5) transformed += normalize(mat3(toonM) * normal) * (uOutline / max(toonScale, 0.01));');
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uOutline;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vToon;\nvarying vec3 vToonLight;\nvarying float vToonGlow;')
        // A soft outline: the colour underneath, darkened, not black.
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vToon * 0.3 + vec3(0.035, 0.022, 0.045), opacity );');
    };

    const depthMaterial = new THREE.MeshDepthMaterial();
    depthMaterial.onBeforeCompile = (shader) => poseVertices(shader, uniforms, 'position');

    const mesh = new THREE.InstancedMesh(spec.geometry, material, capacity);
    const outline = new THREE.InstancedMesh(spec.geometry, outlineMaterial, capacity);
    mesh.name = `toon-${name}`;
    outline.name = `toon-outline-${name}`;
    mesh.receiveShadow = true;
    let shadow: THREE.InstancedMesh | null = null;
    if (spec.shadow) {
      // Seen by the sun's shadow camera only. Its own material is never drawn.
      shadow = new THREE.InstancedMesh(spec.shadow, hidden, capacity);
      shadow.name = `toon-shadow-${name}`;
      shadow.customDepthMaterial = depthMaterial;
      shadow.castShadow = true;
      shadow.layers.set(shadowLayer);
      shadow.instanceMatrix = mesh.instanceMatrix;
      shadow.frustumCulled = false;
      ctx.scene.add(shadow);
    } else {
      mesh.customDepthMaterial = depthMaterial;
      mesh.castShadow = true;
    }
    // The outline shares the bodies' matrices.
    outline.instanceMatrix = mesh.instanceMatrix;
    const triangles = (spec.geometry.index ? spec.geometry.index.count : spec.geometry.getAttribute('position').count) / 3;
    for (const m of [mesh, outline]) {
      m.frustumCulled = false;
      m.count = 0;
      m.visible = false;
      m.onAfterRender = (renderer) => {
        const call = renderer.info.render.frame;
        if (call !== countedCall) {
          countedCall = call;
          stats.drawCalls = 0;
          stats.triangles = 0;
        }
        stats.drawCalls++;
        stats.triangles += triangles * m.count;
      };
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ctx.scene.add(mesh, outline);
    return {
      name, rig, parts: spec.parts, geometry: spec.geometry, mesh, outline, shadow, capacity, instances: data, instanceTexture: texture, uniforms,
      material, outlineMaterial, depthMaterial, triangles, members: [],
    };
  }

  function grow(body: Body): void {
    const capacity = body.capacity * 2;
    const { data, texture } = instanceTexture(capacity);
    body.instanceTexture.dispose();
    body.instances = data;
    body.instanceTexture = texture;
    body.capacity = capacity;
    const matrices = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
    matrices.setUsage(THREE.DynamicDrawUsage);
    for (const mesh of [body.mesh, body.outline, body.shadow]) if (mesh) mesh.instanceMatrix = matrices;
    body.uniforms.uInstances.value = texture;
  }

  function write(body: Body, slot: number, c: Character): void {
    const o = slot * TEXELS * 4, d = body.instances;
    const cur = c.current, prev = c.previous;
    // Clip A is the one fading out, so clip B carries the weight that grows to 1.
    const fading = c.fade < 1 && prev.clip !== null;
    const a = fading ? prev : cur, b = cur;
    d[o] = a.clip!.row; d[o + 1] = a.clip!.frames; d[o + 2] = a.phase; d[o + 3] = c.scale;
    d[o + 4] = b.clip!.row; d[o + 5] = b.clip!.frames; d[o + 6] = b.phase; d[o + 7] = fading ? c.fade * c.fade * (3 - 2 * c.fade) : 0;
    let wear = c.wear;
    const extra = c.wearWhile.get(c.animation);
    if (extra !== undefined) wear |= extra;
    d[o + 8] = wear; d[o + 9] = c.sky; d[o + 10] = c.lamp; d[o + 11] = 0;
    for (let s = 0; s < SLOTS; s++) {
      d[o + 12 + s * 4] = c.colours[s * 3];
      d[o + 13 + s * 4] = c.colours[s * 3 + 1];
      d[o + 14 + s * 4] = c.colours[s * 3 + 2];
    }
    // The model looks down +z. Facing 0 is -z, so the turn about y is PI less the facing.
    const angle = Math.PI - c.turned;
    const cos = Math.cos(angle) * c.scale, sin = Math.sin(angle) * c.scale;
    const m = body.mesh.instanceMatrix.array as Float32Array, k = slot * 16;
    m[k] = cos; m[k + 1] = 0; m[k + 2] = -sin; m[k + 3] = 0;
    m[k + 4] = 0; m[k + 5] = c.scale; m[k + 6] = 0; m[k + 7] = 0;
    m[k + 8] = sin; m[k + 9] = 0; m[k + 10] = cos; m[k + 11] = 0;
    m[k + 12] = c.x; m[k + 13] = c.y; m[k + 14] = c.z; m[k + 15] = 1;
  }

  const colour = new THREE.Color();
  // For leaving out characters the camera cannot see: an instanced mesh is one box to three.js, so it cannot.
  const frustum = new THREE.Frustum();
  const viewProjection = new THREE.Matrix4();
  const sphere = new THREE.Sphere();

  /** True when a character's box, with room for its shadow at the edge, is in view. */
  function inView(c: Character): boolean {
    sphere.center.set(c.x, c.y + c.scale, c.z);
    sphere.radius = 1.6 * c.scale + 1;
    return frustum.intersectsSphere(sphere);
  }

  return {
    stats,

    addRig(name, spec) {
      const baked = bake(spec.root, spec.bones, spec.inverses, spec.clips, spec);
      const names = spec.names ?? {};
      const clipOf = (n: string | undefined): BakedClip | null => (n ? baked.clips.get(names[n] ?? n) ?? null : null);
      rigs.set(name, { baked, texture: bakedTexture(baked), names, walk: clipOf(spec.walk), run: clipOf(spec.run), runFrom: spec.runFrom ?? 3.2 });
    },

    addBody(name, spec) {
      const rig = rigs.get(spec.rig);
      if (!rig) throw new Error(`toon: no rig named "${spec.rig}"`);
      if (spec.parts.length > 24) throw new Error(`toon: body "${name}" has more than 24 parts`);
      bodies.set(name, makeBody(name, rig, spec));
    },

    hasBody: (name) => bodies.has(name),

    add(bodyName, add) {
      const body = bodies.get(bodyName);
      if (!body) throw new Error(`toon: no body named "${bodyName}"`);
      let wear = 1;
      for (const part of add.parts ?? []) {
        const i = body.parts.indexOf(part);
        if (i < 0) throw new Error(`toon: body "${bodyName}" has no part "${part}". It has: ${body.parts.join(', ')}`);
        wear |= 1 << i;
      }
      const wearWhile = new Map<string, number>();
      for (const [animation, parts] of Object.entries(add.partsWhile ?? {})) {
        let bits = 0;
        for (const part of parts) {
          const i = body.parts.indexOf(part);
          if (i >= 0) bits |= 1 << i;
        }
        wearWhile.set(animation, bits);
      }
      const c = new Character(body, add.scale ?? 1, wear, wearWhile, (gone) => {
        body.members.splice(body.members.indexOf(gone), 1);
        all.splice(all.indexOf(gone), 1);
        stats.characters = all.length;
      });
      for (let s = 0; s < SLOTS; s++) {
        colour.setHex(add.palette[s] ?? 0xff00ff, THREE.SRGBColorSpace);
        c.colours[s * 3] = colour.r; c.colours[s * 3 + 1] = colour.g; c.colours[s * 3 + 2] = colour.b;
      }
      c.setPosition(add.x ?? 0, add.y ?? 0, add.z ?? 0);
      c.facing = c.turned = add.facing ?? Math.PI;
      c.visible = add.visible ?? true;
      if (!c.play(add.animation ?? 'idle')) c.play('idle');
      // A crowd added in one frame does not move in step.
      c.current.phase = Math.random();
      readLight(c);
      body.members.push(c);
      all.push(c);
      stats.characters = all.length;
      return c;
    },

    setSun(next) {
      sun = next;
      if (!sun) shared.uRim.value.setRGB(0, 0, 0);
    },

    clear() {
      for (const c of [...all]) c.remove();
    },

    setQuality(next) {
      quality = next;
    },

    update(dt, frame) {
      if (frame.world !== world) {
        world = frame.world;
        splitLight = splitLightOf(world);
        for (const c of all) readLight(c);
      }
      for (let n = Math.min(REFRESH[quality], all.length); n > 0; n--) {
        if (cursor >= all.length) cursor = 0;
        readLight(all[cursor++]);
      }
      if (sun) shared.uRim.value.copy(sun.color).multiplyScalar(sun.intensity * 0.2);
      frame.camera.updateMatrixWorld();
      viewProjection.multiplyMatrices(frame.camera.projectionMatrix, frame.camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      for (const body of bodies.values()) {
        while (body.members.length > body.capacity) grow(body);
        let count = 0;
        for (const c of body.members) {
          c.step(dt);
          if (!c.visible || !c.current.clip || !inView(c)) continue;
          const cellX = Math.floor(c.x), cellY = Math.floor(c.y + 0.5), cellZ = Math.floor(c.z);
          if (cellX !== c.cellX || cellY !== c.cellY || cellZ !== c.cellZ) {
            c.cellX = cellX; c.cellY = cellY; c.cellZ = cellZ;
            readLight(c);
          }
          write(body, count++, c);
        }
        body.mesh.count = count;
        body.outline.count = count;
        body.mesh.visible = count > 0;
        if (body.shadow) {
          body.shadow.count = count;
          body.shadow.visible = count > 0;
        }
        // The outline is the first thing to go on a weak machine: it doubles the triangles.
        body.outline.visible = count > 0 && outlineWidth > 0 && quality !== 'low';
        if (count > 0) {
          body.mesh.instanceMatrix.needsUpdate = true;
          body.instanceTexture.needsUpdate = true;
        }
      }
    },

    dispose() {
      for (const c of [...all]) c.remove();
      for (const body of bodies.values()) {
        ctx.scene.remove(body.mesh, body.outline);
        if (body.shadow) ctx.scene.remove(body.shadow);
        body.instanceTexture.dispose();
        body.material.dispose();
        body.outlineMaterial.dispose();
        body.depthMaterial.dispose();
        body.mesh.dispose();
      }
      for (const rig of rigs.values()) rig.texture.dispose();
      ramp.dispose();
      hidden.dispose();
    },
  };
}
