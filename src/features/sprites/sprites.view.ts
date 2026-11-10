// 2D characters in the 3D world. Every character is one instance of one quad, drawn from the one
// sprite atlas, so a crowd costs two draw calls: one for the characters and one for their shadows.
//
// What the CPU does: it keeps 24 numbers per character and rewrites them only when that character
// changes (it moves, turns, starts an animation, or the camera turns). What the GPU does every
// frame: it picks the animation frame from one clock, stands the quad upright facing the camera,
// and multiplies the pixels by the light where the character stands.
import * as THREE from 'three';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Quality } from '../../engine/types.ts';
import type { WorldQuery } from '../../engine/world-query.ts';
import type { Assets, SpriteAsset, SpriteAtlas } from '../assets/index.ts';
import { foldStart, frameAt, loopSeconds, seededRandom, startForPhase } from './animation.ts';
import { VIEW_BACK, VIEW_FRONT, VIEW_SIDE_LEFT, cameraYawOf, pickView, type SpriteView } from './facing.ts';
import { LAMP_LIGHT, dayLight, type Rgb } from './light.ts';

export interface SpritesOptions {
  assets: Assets;
  /** Room for this many characters at the start. The buffers double when it runs out. Default 256. */
  capacity?: number;
  /** Seeds the random animation offsets, so the same seed gives the same crowd. */
  seed?: number;
  /** Light that is always there, so a character in the darkest cave still shows. Default 0.06. */
  minLight?: number;
  /**
   * How solid a pixel must be to be drawn, 0 to 1. The sheets are all-or-nothing, so this only matters
   * when a sprite is drawn smaller than its pixels and edge pixels blend with the clear ones around them.
   * Default 0.35.
   */
  alphaCut?: number;
}

export interface AddOptions {
  x?: number;
  y?: number;
  z?: number;
  /** The way the character faces, in radians. 0 is north (-z), a quarter turn is east (+x). Default: south. */
  facing?: number;
  /** The animation to start in. Default `idle`, or the sprite's first. It starts at a random point in its loop. */
  animation?: string;
  tint?: readonly [number, number, number];
  visible?: boolean;
  /** Scales the shadow. 0 is no shadow. Default 1. */
  shadow?: number;
}

export interface PlayOptions {
  /** False plays the animation once and holds its last frame. Default true. */
  loop?: boolean;
  /** Starts again from the first frame even when this animation is already playing. */
  restart?: boolean;
  /** Where in the loop to start, 0 to 1, or `random`. Default 0. */
  phase?: number | 'random';
}

/** One character. After `remove` every method does nothing. */
export interface SpriteHandle {
  /** Where the feet are. */
  setPosition(x: number, y: number, z: number): void;
  /** The way the character faces, in radians. 0 is north (-z), a quarter turn is east (+x). */
  setFacing(radians: number): void;
  /**
   * Switches to an animation of this sprite. Playing the one already playing changes nothing, so it is
   * safe to call every frame. When the sprite has no such animation it keeps doing what it was doing,
   * the name is listed in `missingAnimations`, and this returns false.
   */
  play(animation: string, options?: PlayOptions): boolean;
  /** True when this sprite has the animation. */
  has(animation: string): boolean;
  /** Multiplies the sprite's color. 1, 1, 1 is no tint. */
  setTint(r: number, g: number, b: number): void;
  setVisible(visible: boolean): void;
  remove(): void;
  readonly sprite: string;
  readonly animation: string;
  /** The frame showing now, counted from 0. */
  readonly frame: number;
  /** True when an animation played once has reached its last frame. */
  readonly finished: boolean;
  readonly alive: boolean;
}

/** The part of the sky the sprites need. `createSky(...).look` fits. */
export interface SpritesSky {
  readonly sunDirection?: THREE.Vector3;
  /** Multiply an unlit color by this and it sits in the scene. */
  readonly light: THREE.Color;
}

export interface SpriteStats {
  /** Draw calls for sprites and their shadows in the last `renderer.render` call. */
  drawCalls: number;
  triangles: number;
}

export interface Sprites extends ViewSystem {
  /** Adds a character. A name the manifest does not have is drawn as a placeholder and listed in `missing`. */
  add(spriteName: string, options?: AddOptions): SpriteHandle;
  /** Removes every character. */
  clear(): void;
  /** Characters alive now. */
  setShadowsEnabled(enabled: boolean): void;
  readonly count: number;
  readonly capacity: number;
  /** Names asked for that the manifest does not have. */
  readonly missing: readonly string[];
  /** Animations asked for that a sprite does not have, as `sprite: animation`. */
  readonly missingAnimations: readonly string[];
  readonly stats: Readonly<SpriteStats>;
  /** Takes the daylight from the sky feature. Without it, or after `setSky(null)`, the time of day in `ctx.ambient` decides. */
  setSky(sky: SpritesSky | null): void;
}

/** A world that can tell sky light from lamp light. The world feature's query can. `WorldQuery` alone cannot. */
interface SplitLight {
  skyLightAt(x: number, y: number, z: number): number;
  blockLightAt(x: number, y: number, z: number): number;
}

function splitLightOf(world: WorldQuery): SplitLight | null {
  const maybe = world as Partial<SplitLight>;
  return typeof maybe.skyLightAt === 'function' && typeof maybe.blockLightAt === 'function' ? (world as unknown as SplitLight) : null;
}

// ---------------------------------------------------------------- the numbers kept per character

/** Floats per character. Four at each offset below make one vertex attribute. */
export const STRIDE = 24;
/** x, y, z of the feet, and the y of the ground the shadow lies on. */
const PLACE = 0;
/** The atlas pixel where the row starts (x, y), the frame count (negative when played once), frames per second. */
const ROW = 4;
/** Frame width and height in pixels, the atlas page, and the flip: 1 as drawn, -1 mirrored, 0 hidden. */
const FRAME = 8;
/** The anchor pixel (x, y), blocks per pixel, and the shadow's radius in blocks. */
const ANCHOR = 12;
/** The tint (r, g, b) and the time the animation started. */
const TINT = 16;
/** Sky light and lamp light, each 0 to 1, the shadow's strength, and one spare. */
const LIGHT = 20;

const ATTRIBUTES: readonly (readonly [string, number])[] = [
  ['aPlace', PLACE], ['aRow', ROW], ['aFrame', FRAME], ['aAnchor', ANCHOR], ['aTint', TINT], ['aLight', LIGHT],
];

/**
 * A little under half: a sprite drawn at half size keeps more of its dark one-pixel outline, which
 * is what makes a small character read against the grass.
 */
const DEFAULT_ALPHA_CUT = 0.35;
/** Start times are sent to the GPU relative to a moment that moves forward this often, so they stay exact. */
const REBASE_SECONDS = 512;
/** How many characters re-read the world's light and ground each frame, so a new lamp or a dug hole shows within a second or so. */
const REFRESH: Record<Quality, number> = { low: 8, medium: 16, high: 32 };

interface AnimDef {
  name: string;
  frames: number;
  fps: number;
  /** Sheet rows. `back` and `side` are -1 when the animation was not drawn from there. */
  front: number;
  back: number;
  side: number;
}

interface SpriteDef {
  name: string;
  asset: SpriteAsset;
  page: number;
  /** The sheet's top left pixel in the atlas. */
  x: number;
  y: number;
  anims: Map<string, AnimDef>;
  first: AnimDef;
  /** Blocks per pixel. */
  scale: number;
  shadowRadius: number;
}

// ---------------------------------------------------------------- the shaders

const SPRITE_VERTEX = /* glsl */ `
uniform float uTime;
uniform vec2 uAtlasSize;
uniform vec3 uSky;
uniform vec3 uLamp;
uniform float uMinLight;
// Radians. Past this pitch down a sprite leans back, away from the camera. The 2.5D camera looks down 35 degrees at most.
const float LEAN_FROM = 0.628;
attribute vec4 aPlace;
attribute vec4 aRow;
attribute vec4 aFrame;
attribute vec4 aAnchor;
attribute vec4 aTint;
attribute vec4 aLight;
varying vec2 vUv;
flat varying vec4 vRect;
flat varying float vPage;
flat varying vec3 vColor;
#include <fog_pars_vertex>

void main() {
  // The frame: the same rule as frameAt in animation.ts.
  float frames = abs(aRow.z);
  float frame = floor(max(uTime - aTint.w, 0.0) * aRow.w);
  frame = aRow.z < 0.0 ? min(frame, frames - 1.0) : mod(frame, frames);

  // position is a corner of the quad: x 0 to 1 left to right, y 0 to 1 bottom to top.
  vec2 origin = vec2(aRow.x + frame * aFrame.x, aRow.y);
  vUv = (origin + vec2(position.x, 1.0 - position.y) * aFrame.xy) / uAtlasSize;
  // Half a pixel inside the frame, so no sample ever reaches the frame next to it.
  vRect = vec4(origin + 0.5, origin + aFrame.xy - 0.5) / uAtlasSize.xyxy;
  vPage = aFrame.z;

  float sky = pow(0.8, 15.0 * (1.0 - aLight.x));
  float lamp = pow(0.8, 15.0 * (1.0 - aLight.y)) * step(0.02, aLight.y);
  vColor = aTint.rgb * (uSky * sky + uLamp * lamp + uMinLight);

  // Upright, turned about the up axis to face the camera, with the anchor pixel on the feet.
  float across = (position.x * aFrame.x - aAnchor.x) * aAnchor.z * aFrame.w;
  float up = (aAnchor.y - (1.0 - position.y) * aFrame.y) * aAnchor.z;
  vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
  // A camera looking down steeper than LEAN_FROM would see an upright quad squashed, so the quad leans back,
  // away from it, about the feet by the difference, and is always seen as from LEAN_FROM. The 2.5D camera never
  // looks down that far, so there it stands upright.
  float lean = max(asin(clamp(viewMatrix[1][2], -1.0, 1.0)) - LEAN_FROM, 0.0);
  vec3 rise = vec3(right.z * sin(lean), cos(lean), -right.x * sin(lean));
  vec4 mvPosition = viewMatrix * vec4(aPlace.xyz + right * across + rise * up, 1.0);
  gl_Position = aFrame.w == 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const SPRITE_FRAGMENT = /* glsl */ `
uniform sampler2DArray uAtlas;
uniform float uAlphaCut;
varying vec2 vUv;
flat varying vec4 vRect;
flat varying float vPage;
flat varying vec3 vColor;
#include <fog_pars_fragment>

void main() {
  vec4 texel = texture(uAtlas, vec3(clamp(vUv, vRect.xy, vRect.zw), vPage));
  // A hard cut: a pixel is there or it is not, so sprites sort against blocks by depth alone.
  if (texel.a < uAlphaCut) discard;
  // The atlas holds color times alpha, so a blended edge pixel keeps its true color.
  gl_FragColor = vec4(texel.rgb / texel.a * vColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const SHADOW_VERTEX = /* glsl */ `
uniform float uStrength;
uniform vec3 uSunDirection;
attribute vec4 aPlace;
attribute vec4 aFrame;
attribute vec4 aAnchor;
attribute vec4 aLight;
varying vec2 vDisc;
varying float vAlpha;
#include <fog_pars_vertex>

void main() {
  vDisc = position.xy * 2.0 - 1.0;
  // A character in the air casts a smaller, fainter shadow.
  float lift = max(aPlace.y - aPlace.w, 0.0);
  float radius = aAnchor.w / (1.0 + 0.35 * lift);
  // Fainter where little sky reaches, since there is little light to block.
  float open = pow(0.8, 15.0 * (1.0 - max(aLight.x, aLight.y)));
  vAlpha = uStrength * aLight.z * mix(0.5, 1.0, open) / (1.0 + 1.2 * lift);
  // An oval that starts under the feet and reaches away from the sun, longer as the sun sinks. A disc pushed
  // away whole would leave the feet and float beside the character.
  vec2 away = -uSunDirection.xz;
  float reach = length(away);
  vec2 along = reach > 1e-3 ? away / reach : vec2(0.0, 1.0);
  vec2 across = vec2(-along.y, along.x);
  float stretch = clamp(reach / max(0.45, uSunDirection.y), 0.0, 1.2);
  vec2 ground = across * (vDisc.x * radius) + along * (vDisc.y * radius * (1.0 + stretch) + radius * stretch);
  vec4 mvPosition = viewMatrix * vec4(aPlace.x + ground.x, aPlace.w + 0.02, aPlace.z + ground.y, 1.0);
  gl_Position = aFrame.w == 0.0 || vAlpha <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const SHADOW_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying vec2 vDisc;
varying float vAlpha;
#include <fog_pars_fragment>

void main() {
  float alpha = vAlpha * (1.0 - smoothstep(0.3, 1.0, length(vDisc)));
  #ifdef USE_FOG
    // Fog hides a shadow. It does not paint it the color of fog.
    #ifdef FOG_EXP2
      alpha *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      alpha *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
  #endif
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
`;

// ---------------------------------------------------------------- the system

export function createSprites(ctx: ViewContext, options: SpritesOptions): Sprites {
  const { assets } = options;
  const random = seededRandom(options.seed ?? 1);

  let capacity = Math.max(1, Math.floor(options.capacity ?? 256));
  let data = new Float32Array(capacity * STRIDE);
  let count = 0;
  /** The first and last character changed since the last upload. */
  let dirtyFrom = Infinity, dirtyTo = -1;
  /** The one upload range handed to Three.js, reused every frame. */
  const range = { start: 0, count: 0 };

  // Numbers that change every frame live in one object. A changing number in a plain `let` that
  // functions close over is a new heap object each time it is written, and this must allocate nothing per frame.
  const clock = {
    /** Game seconds at the last update. */
    now: ctx.time,
    /** The moment the GPU's clock counts from. */
    epoch: ctx.time,
    /** The camera's yaw at the last update. */
    yaw: cameraYawOf(ctx.camera.matrixWorld.elements),
  };
  let world = ctx.world;
  let splitLight = splitLightOf(world);
  let refresh = REFRESH[ctx.quality];
  let cursor = 0;
  let sky: SpritesSky | null = null;
  const daylight: Rgb = [1, 1, 1];

  let atlas: SpriteAtlas = assets.spriteAtlas();
  const defs = new Map<string, SpriteDef>();
  let placeholder: SpriteDef | null = null;
  const missing: string[] = [];
  const missingAnimations: string[] = [];
  const stats: SpriteStats = { drawCalls: 0, triangles: 0 };
  /** The render call the stats were last counted in. */
  let countedCall = -1;

  // ------------------------------------------------ sprites and their place in the atlas

  function describe(asset: SpriteAsset): SpriteDef {
    const anims = new Map<string, AnimDef>();
    for (const [name, a] of Object.entries(asset.animations)) {
      anims.set(name, { name, frames: a.frames, fps: a.fps, front: a.rows.front, back: a.rows.back ?? -1, side: a.rows.side ?? -1 });
    }
    const scale = asset.worldHeight / asset.frame[1];
    const place = atlas.place(asset.name);
    return {
      name: asset.name, asset, page: place.page, x: place.x, y: place.y, anims,
      first: anims.get('idle') ?? (anims.values().next().value as AnimDef),
      scale,
      // A little narrower than the body, so the shadow sits under it and not around it.
      shadowRadius: (asset.body[2] - asset.body[0]) * scale * 0.45,
    };
  }

  function defFor(name: string): SpriteDef {
    let def = defs.get(name);
    if (def) return def;
    if (assets.hasSprite(name)) {
      def = describe(assets.sprite(name));
    } else {
      placeholder ??= describe(assets.placeholder());
      def = placeholder;
      missing.push(name);
      console.warn(`sprites: the manifest has no sprite named "${name}". A placeholder is drawn in its place.`);
    }
    defs.set(name, def);
    return def;
  }

  /** Notes, once, an animation a sprite was asked for and does not have. The game goes on. Always false. */
  function lacks(def: SpriteDef, animation: string): false {
    const entry = `${def.name}: ${animation}`;
    if (!missingAnimations.includes(entry)) {
      missingAnimations.push(entry);
      console.warn(`sprites: "${def.name}" has no animation named "${animation}". It has: ${[...def.anims.keys()].join(', ')}.`);
    }
    return false;
  }

  /** After a new color variant the atlas is packed again: every sheet may have moved. */
  function syncAtlas(): void {
    atlas = assets.spriteAtlas();
    spriteUniforms.uAtlas.value = atlas.texture;
    spriteUniforms.uAtlasSize.value.set(atlas.width, atlas.height);
    const moved = new Set<SpriteDef>(defs.values());
    for (const def of moved) {
      const place = atlas.place(def.asset.name);
      def.page = place.page;
      def.x = place.x;
      def.y = place.y;
    }
    for (let i = 0; i < count; i++) writeSprite(handles[i]);
  }

  // ------------------------------------------------ writing a character's numbers

  function touch(index: number): void {
    if (index < dirtyFrom) dirtyFrom = index;
    if (index > dirtyTo) dirtyTo = index;
  }

  /** The row for the way the camera sees the character, the flip, and the animation's speed. */
  function writeRow(h: Handle): void {
    const o = h.index * STRIDE, def = h.def, anim = h.anim;
    let row = anim.front, flip = 1;
    if (h.view === VIEW_BACK) {
      if (anim.back >= 0) row = anim.back;
    } else if (h.view !== VIEW_FRONT && anim.side >= 0) {
      row = anim.side;
      if (h.view === VIEW_SIDE_LEFT) flip = -1;
    }
    data[o + ROW] = def.x;
    data[o + ROW + 1] = def.y + row * def.asset.frame[1];
    data[o + ROW + 2] = h.loop ? anim.frames : -anim.frames;
    data[o + ROW + 3] = anim.fps;
    data[o + FRAME + 3] = h.visible ? flip : 0;
    touch(h.index);
  }

  /** Everything that comes from the sprite itself. */
  function writeSprite(h: Handle): void {
    const o = h.index * STRIDE, def = h.def, asset = def.asset;
    data[o + FRAME] = asset.frame[0];
    data[o + FRAME + 1] = asset.frame[1];
    data[o + FRAME + 2] = def.page;
    data[o + ANCHOR] = asset.anchor[0];
    data[o + ANCHOR + 1] = asset.anchor[1];
    data[o + ANCHOR + 2] = def.scale;
    data[o + ANCHOR + 3] = def.shadowRadius * h.shadow;
    writeRow(h);
  }

  /** The ground under the character and the light around it. It writes only when one of them changed. */
  function readWorld(h: Handle): void {
    const o = h.index * STRIDE;
    const x = data[o + PLACE], y = data[o + PLACE + 1], z = data[o + PLACE + 2];
    // The middle of the block the feet are in.
    const lightY = y + 0.5;
    const skyLight = (splitLight ? splitLight.skyLightAt(x, lightY, z) : world.lightAt(x, lightY, z)) / 15;
    const lampLight = splitLight ? splitLight.blockLightAt(x, lightY, z) / 15 : 0;
    const top = world.heightAt(x, z);
    // The shadow lies on the ground below. Under a roof the column's top is above the head, so it lies at the feet.
    const ground = top <= y + 0.05 ? top : y;
    if (data[o + LIGHT] === Math.fround(skyLight) && data[o + LIGHT + 1] === Math.fround(lampLight) && h.top === top && data[o + PLACE + 3] === Math.fround(ground)) return;
    h.top = top;
    data[o + LIGHT] = skyLight;
    data[o + LIGHT + 1] = lampLight;
    data[o + PLACE + 3] = ground;
    touch(h.index);
  }

  // ------------------------------------------------ handles

  class Handle implements SpriteHandle {
    index: number;
    def: SpriteDef;
    anim: AnimDef;
    facing = Math.PI;
    view: SpriteView = VIEW_FRONT;
    visible = true;
    loop = true;
    /** When the animation started, in game seconds. */
    start = 0;
    shadow = 1;
    /** The block the light was last read in. */
    cellX = NaN;
    cellY = NaN;
    cellZ = NaN;
    /** The top of the column the character stands in. */
    top = 0;

    constructor(index: number, def: SpriteDef) {
      this.index = index;
      this.def = def;
      this.anim = def.first;
    }

    get sprite(): string { return this.def.name; }
    get animation(): string { return this.anim.name; }
    get alive(): boolean { return this.index >= 0; }
    get frame(): number { return frameAt(clock.now - this.start, this.anim.frames, this.anim.fps, this.loop); }
    get finished(): boolean { return !this.loop && clock.now - this.start >= loopSeconds(this.anim.frames, this.anim.fps); }

    setPosition(x: number, y: number, z: number): void {
      if (this.index < 0) return;
      const o = this.index * STRIDE;
      data[o + PLACE] = x;
      data[o + PLACE + 1] = y;
      data[o + PLACE + 2] = z;
      const cellX = Math.floor(x), cellY = Math.floor(y + 0.5), cellZ = Math.floor(z);
      if (cellX !== this.cellX || cellY !== this.cellY || cellZ !== this.cellZ) {
        this.cellX = cellX;
        this.cellY = cellY;
        this.cellZ = cellZ;
        readWorld(this);
      }
      // Within one block the ground does not change, but a jump lifts the feet off it.
      data[o + PLACE + 3] = this.top <= y + 0.05 ? this.top : y;
      touch(this.index);
    }

    setFacing(radians: number): void {
      if (this.index < 0) return;
      this.facing = radians;
      const view = pickView(radians, clock.yaw, this.view);
      if (view === this.view) return;
      this.view = view;
      writeRow(this);
    }

    has(animation: string): boolean {
      return this.def.anims.has(animation);
    }

    play(animation: string, playOptions?: PlayOptions): boolean {
      if (this.index < 0) return false;
      let anim = this.def.anims.get(animation);
      if (!anim) {
        // The placeholder has one drawing. It stands in for any animation.
        if (this.def.asset.placeholder) anim = this.def.first;
        else return lacks(this.def, animation);
      }
      const loop = playOptions?.loop ?? true;
      if (anim === this.anim && loop === this.loop && !playOptions?.restart) return true;
      this.anim = anim;
      this.loop = loop;
      const phase = playOptions?.phase;
      this.start = phase === undefined ? clock.now : startForPhase(clock.now, anim.frames, anim.fps, phase === 'random' ? random() : phase);
      data[this.index * STRIDE + TINT + 3] = this.start - clock.epoch;
      writeRow(this);
      return true;
    }

    setTint(r: number, g: number, b: number): void {
      if (this.index < 0) return;
      const o = this.index * STRIDE + TINT;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      touch(this.index);
    }

    setVisible(visible: boolean): void {
      if (this.index < 0 || visible === this.visible) return;
      this.visible = visible;
      writeRow(this);
    }

    remove(): void {
      const index = this.index;
      if (index < 0) return;
      // The last character takes the freed place, so the live ones stay packed at the front.
      const last = count - 1;
      const moved = handles[last];
      if (moved !== this) {
        data.copyWithin(index * STRIDE, last * STRIDE, (last + 1) * STRIDE);
        moved.index = index;
        handles[index] = moved;
        touch(index);
      }
      handles.pop();
      count = last;
      this.index = -1;
    }
  }

  const handles: Handle[] = [];

  // ------------------------------------------------ what is drawn

  // One quad. Its corners are the only per-vertex data: x and y run 0 to 1.
  const corners = new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3);
  const cornerIndex = new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1);
  let buffer: THREE.InstancedInterleavedBuffer;
  let spriteGeometry: THREE.InstancedBufferGeometry;
  let shadowGeometry: THREE.InstancedBufferGeometry;

  function geometryFor(names: readonly string[]): THREE.InstancedBufferGeometry {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex(cornerIndex);
    geometry.setAttribute('position', corners);
    for (const [name, offset] of ATTRIBUTES) {
      if (names.includes(name)) geometry.setAttribute(name, new THREE.InterleavedBufferAttribute(buffer, 4, offset));
    }
    geometry.instanceCount = 0;
    return geometry;
  }

  /** Both meshes read the same per-character buffer, so it is uploaded once. */
  function buildGeometry(): void {
    buffer = new THREE.InstancedInterleavedBuffer(data, STRIDE, 1);
    buffer.setUsage(THREE.DynamicDrawUsage);
    spriteGeometry = geometryFor(['aPlace', 'aRow', 'aFrame', 'aAnchor', 'aTint', 'aLight']);
    shadowGeometry = geometryFor(['aPlace', 'aFrame', 'aAnchor', 'aLight']);
  }

  function grow(): void {
    capacity *= 2;
    const larger = new Float32Array(capacity * STRIDE);
    larger.set(data);
    data = larger;
    spriteGeometry.dispose();
    shadowGeometry.dispose();
    buildGeometry();
    spriteMesh.geometry = spriteGeometry;
    shadowMesh.geometry = shadowGeometry;
    // The new buffer is uploaded whole the first time it is drawn.
    dirtyFrom = Infinity;
    dirtyTo = -1;
    spriteGeometry.instanceCount = shadowGeometry.instanceCount = count;
  }

  const spriteUniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uAtlas: { value: atlas.texture },
    uAtlasSize: { value: new THREE.Vector2(atlas.width, atlas.height) },
    uTime: { value: 0 },
    uSky: { value: new THREE.Color(1, 1, 1) },
    uLamp: { value: new THREE.Color(LAMP_LIGHT[0], LAMP_LIGHT[1], LAMP_LIGHT[2]) },
    uMinLight: { value: options.minLight ?? 0.06 },
    uAlphaCut: { value: options.alphaCut ?? DEFAULT_ALPHA_CUT },
  };
  const spriteMaterial = new THREE.ShaderMaterial({
    name: 'sprites',
    uniforms: spriteUniforms,
    vertexShader: SPRITE_VERTEX,
    fragmentShader: SPRITE_FRAGMENT,
    // A mirrored quad winds the other way.
    side: THREE.DoubleSide,
    fog: true,
  });

  let shadowsEnabled = true;
  const shadowUniforms = {
    uSunDirection: { value: new THREE.Vector3(0.5, 0.76, 0.4) },
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uStrength: { value: 0.45 },
    // Dark and a little purple, like the outlines of the art. Never pure black.
    uColor: { value: new THREE.Color(0.02, 0.014, 0.035) },
  };
  const shadowMaterial = new THREE.ShaderMaterial({
    name: 'sprite-shadows',
    uniforms: shadowUniforms,
    vertexShader: SHADOW_VERTEX,
    fragmentShader: SHADOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: false,
  });

  buildGeometry();
  const spriteMesh = new THREE.Mesh(spriteGeometry!, spriteMaterial);
  const shadowMesh = new THREE.Mesh(shadowGeometry!, shadowMaterial);
  spriteMesh.name = 'sprites';
  shadowMesh.name = 'sprite-shadows';
  for (const mesh of [spriteMesh, shadowMesh]) {
    // Characters are anywhere, so there is no box to test against the view. It is one draw call either way.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.onAfterRender = (drawing) => {
      // Count from zero in each new render call, as renderer.info.render does.
      const call = drawing.info.render.frame;
      if (call !== countedCall) {
        countedCall = call;
        stats.drawCalls = 0;
        stats.triangles = 0;
      }
      stats.drawCalls++;
      stats.triangles += (mesh.geometry as THREE.InstancedBufferGeometry).instanceCount * 2;
    };
  }
  // Shadows blend onto the ground before water and other see-through things are drawn over them.
  shadowMesh.renderOrder = -1;
  ctx.scene.add(shadowMesh, spriteMesh);

  /** Hands the changed characters to the GPU. */
  function flush(): void {
    if (dirtyTo >= dirtyFrom) {
      let from = dirtyFrom * STRIDE, to = (dirtyTo + 1) * STRIDE;
      if (buffer.updateRanges.length > 0) {
        // The last range has not been uploaded yet: cover both.
        from = Math.min(from, range.start);
        to = Math.max(to, range.start + range.count);
      } else {
        buffer.updateRanges.push(range);
      }
      range.start = from;
      range.count = to - from;
      buffer.needsUpdate = true;
      dirtyFrom = Infinity;
      dirtyTo = -1;
    }
    spriteGeometry.instanceCount = shadowGeometry.instanceCount = count;
  }

  /** Moves the GPU's clock forward and folds every start time to within one loop of now. */
  function rebase(): void {
    clock.epoch = clock.now;
    for (let i = 0; i < count; i++) {
      const h = handles[i];
      h.start = foldStart(h.start, clock.now, h.anim.frames, h.anim.fps, h.loop);
      data[i * STRIDE + TINT + 3] = h.start - clock.epoch;
    }
    if (count > 0) {
      touch(0);
      touch(count - 1);
    }
  }

  return {
    setShadowsEnabled(enabled) { shadowsEnabled = enabled; },
    get count() { return count; },
    get capacity() { return capacity; },
    missing,
    missingAnimations,
    stats,

    add(spriteName, addOptions = {}) {
      if (assets.spriteAtlas() !== atlas) syncAtlas();
      const def = defFor(spriteName);
      if (count === capacity) grow();
      const h = new Handle(count, def);
      handles.push(h);
      count++;

      const wanted = addOptions.animation;
      if (wanted !== undefined) {
        const anim = def.anims.get(wanted);
        if (anim) h.anim = anim;
        else if (!def.asset.placeholder) lacks(def, wanted);
      }
      // A random point in the loop, so a crowd added in one frame does not move in step.
      h.start = startForPhase(clock.now, h.anim.frames, h.anim.fps, random());
      h.facing = addOptions.facing ?? Math.PI;
      h.view = pickView(h.facing, clock.yaw);
      h.visible = addOptions.visible ?? true;
      h.shadow = addOptions.shadow ?? 1;

      const o = h.index * STRIDE;
      const tint = addOptions.tint;
      data[o + TINT] = tint ? tint[0] : 1;
      data[o + TINT + 1] = tint ? tint[1] : 1;
      data[o + TINT + 2] = tint ? tint[2] : 1;
      data[o + TINT + 3] = h.start - clock.epoch;
      data[o + LIGHT + 2] = 1;
      data[o + LIGHT + 3] = 0;
      writeSprite(h);
      h.setPosition(addOptions.x ?? 0, addOptions.y ?? 0, addOptions.z ?? 0);
      return h;
    },

    clear() {
      for (let i = 0; i < count; i++) handles[i].index = -1;
      handles.length = 0;
      count = 0;
    },

    setSky(next) {
      sky = next;
    },

    setQuality(quality: Quality) {
      // The drawing costs the same at every level. Only the upkeep changes.
      refresh = REFRESH[quality];
    },

    update(_dt, frame) {
      clock.now = frame.time;
      if (frame.world !== world) {
        world = frame.world;
        splitLight = splitLightOf(world);
        for (let i = 0; i < count; i++) readWorld(handles[i]);
      }
      if (assets.spriteAtlas() !== atlas) syncAtlas();

      // When the camera turns, every character may show another side.
      frame.camera.updateMatrixWorld();
      const turned = cameraYawOf(frame.camera.matrixWorld.elements);
      if (turned !== clock.yaw) {
        clock.yaw = turned;
        for (let i = 0; i < count; i++) {
          const h = handles[i];
          const view = pickView(h.facing, clock.yaw, h.view);
          if (view !== h.view) {
            h.view = view;
            writeRow(h);
          }
        }
      }

      if (clock.now - clock.epoch > REBASE_SECONDS || clock.now < clock.epoch) rebase();
      spriteUniforms.uTime.value = clock.now - clock.epoch;

      const light = spriteUniforms.uSky.value;
      if (sky) light.copy(sky.light);
      else {
        dayLight(frame.ambient, daylight);
        light.r = daylight[0];
        light.g = daylight[1];
        light.b = daylight[2];
      }
      if (sky?.sunDirection) shadowUniforms.uSunDirection.value.copy(sky.sunDirection);
      // Shadows are strongest under a bright sky.
      const bright = Math.min(1, light.r * 0.3 + light.g * 0.5 + light.b * 0.2);
      shadowUniforms.uStrength.value = shadowsEnabled ? 0.2 + 0.25 * bright : 0;

      // A few characters a frame look at the world again, in turn.
      for (let n = Math.min(refresh, count); n > 0; n--) {
        if (cursor >= count) cursor = 0;
        readWorld(handles[cursor++]);
      }
      flush();
    },

    dispose() {
      ctx.scene.remove(shadowMesh, spriteMesh);
      for (let i = 0; i < count; i++) handles[i].index = -1;
      handles.length = 0;
      count = 0;
      spriteGeometry.dispose();
      shadowGeometry.dispose();
      spriteMaterial.dispose();
      shadowMaterial.dispose();
    },
  };
}
