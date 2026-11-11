// The fighters of the fight lab, drawn from the same sprite sheets as everyone else but one quad each, so a
// fighter can do what the shared sprite layer cannot: stand at any size, flash white on a hit, shake, squash,
// hold one frame of a pose sheet, and be drained grey with its colors coming back from the head down.
//
// A handful of fighters, one draw call each. The quad stands upright and turns to the camera about the up
// axis, with the sheet's anchor pixel on the feet, exactly as src/features/sprites draws a character.
import * as THREE from 'three';
import type { SpriteAsset } from '../../features/assets/index.ts';
import { VIEW_BACK, VIEW_FRONT, VIEW_SIDE_LEFT, pickView, type SpriteView } from '../../features/sprites/index.ts';
import type { GameView } from '../shell/view.ts';

export interface Figure {
  /** Where the feet are. */
  place(x: number, y: number, z: number): void;
  /** The way it faces, in radians: 0 is north, a quarter turn is east. */
  face(facing: number): void;
  /** Plays a looping animation of a sheet. Safe to call every frame. */
  play(sheet: string, animation: string): void;
  /** Holds one frame of an animation of a sheet: a pose. */
  pose(sheet: string, animation: string, frame: number): void;
  /** Plays an animation once from its first frame, over this many seconds, and holds its last frame. Safe to call every frame with the same `started`. */
  once(sheet: string, animation: string, elapsed: number, seconds: number): void;
  /** How many times the sheet's own height it is drawn. */
  scale: number;
  /** The color it is multiplied by. */
  readonly tint: THREE.Color;
  /** 0 its own colors, 1 drained grey. */
  drained: number;
  /** How far the colors have come back, from the head (0) to the feet (1). Only seen while `drained` is above 0. */
  sweep: number;
  /** 0 to 1: how white it is, for a hit. */
  flash: number;
  /** Blocks it is drawn to the side of where it stands, for a shake. */
  shake: number;
  /** Width and height it is stretched by, about the feet. */
  squashX: number;
  squashY: number;
  /** Radians it is tipped over about its feet, in the picture's plane: a faint, a tumble. Positive falls toward its back. */
  roll: number;
  /** 0 to 1: a warm glow, the last moment before an attack lands. Warmer light, not a darker color. */
  warm: number;
  /** 0 to 1: the pale teal light of the Mark, for the moment of calming. Not the white of a hit. */
  glow: number;
  /** True mirrors the drawing seen from the front or the back, for a swing that goes the other way. A side view is never mirrored by it. */
  mirror: boolean;
  /** 0 to 1. Below 1 only for a figure made with `ghost`. */
  alpha: number;
  visible: boolean;
  /** The height of the sheet's drawn body in blocks, at this scale: where a bar or a mark floats. */
  readonly height: number;
  remove(): void;
}

export interface Figures {
  /** A new fighter, drawn from this sheet until it plays another. `ghost` makes one that can fade, for an afterimage. */
  add(sheet: string, options?: { ghost?: boolean }): Figure;
  /** True when the manifest has this sheet. */
  has(sheet: string): boolean;
  /** Once a frame, after every figure was placed. */
  update(dt: number): void;
  readonly count: number;
}

const VERTEX = /* glsl */ `
uniform vec3 uPlace;
uniform vec2 uSize;
uniform vec2 uAnchor;
uniform vec4 uRect;
uniform vec3 uMove;
uniform float uRoll;
uniform vec2 uBody;
varying vec2 vUv;
varying float vDown;
#include <fog_pars_vertex>
// Radians. Past this pitch down the quad leans back, as the shared sprites do.
const float LEAN_FROM = 0.628;

void main() {
  vUv = mix(uRect.xy, uRect.zw, vec2(position.x, 1.0 - position.y));
  // 0 at the top of the drawn body, 1 at its feet.
  vDown = ((1.0 - position.y) - uBody.x) / max(uBody.y - uBody.x, 0.001);
  // uMove is the flip (1 or -1) times the squash across, the squash up, and the shake.
  float across0 = (position.x - uAnchor.x) * uSize.x * uMove.x;
  float up0 = (position.y - uAnchor.y) * uSize.y * uMove.y;
  // Tipped over about the feet, in the picture's plane.
  float cr = cos(uRoll), sr = sin(uRoll);
  float across = across0 * cr - up0 * sr + uMove.z;
  float up = across0 * sr + up0 * cr;
  vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
  float lean = max(asin(clamp(viewMatrix[1][2], -1.0, 1.0)) - LEAN_FROM, 0.0);
  vec3 rise = vec3(right.z * sin(lean), cos(lean), -right.x * sin(lean));
  vec4 mvPosition = viewMatrix * vec4(uPlace + right * across + rise * up, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uTint;
uniform vec3 uLight;
uniform vec3 uGlow;
// Drained, the sweep, the flash and the alpha.
uniform vec4 uLook;
// The warm glow of a tell and the teal glow of the Mark.
uniform vec2 uHeat;
varying vec2 vUv;
varying float vDown;
#include <fog_pars_fragment>

void main() {
  vec4 texel = texture2D(uMap, vUv);
  if (texel.a < 0.5) discard;
  vec3 color = texel.rgb;
  // Drained: ash grey, a little cold and a little dark. Never black.
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 ash = vec3(luma) * vec3(0.8, 0.82, 0.9) + 0.035;
  // The colors come back from the head down. Under the line it is still grey.
  float under = smoothstep(uLook.y - 0.05, uLook.y + 0.03, vDown);
  color = mix(color, ash, uLook.x * under);
  color *= uTint * uLight;
  // The line itself is light.
  float line = (1.0 - smoothstep(0.0, 0.08, abs(vDown - uLook.y))) * step(0.004, uLook.y) * step(uLook.y, 0.996) * uLook.x;
  color += uGlow * line;
  // Warmer light, a little brighter: the drawing stays readable under it.
  color = color * (1.0 + vec3(0.22, 0.04, -0.08) * uHeat.x) + vec3(0.07, 0.025, 0.0) * uHeat.x;
  color = mix(color, vec3(0.78, 1.0, 0.95), uHeat.y);
  color = mix(color, vec3(1.0), uLook.z);
  gl_FragColor = vec4(color, uLook.w);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

interface Sheet {
  asset: SpriteAsset;
  texture: THREE.DataTexture;
}

/** The stand-in teal of the player's magic, as light. See `LOOK` in the lab's view. */
const GLOW = new THREE.Color(0.35, 1.5, 1.25);

export function createFigures(view: GameView): Figures {
  const quad = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
  const sheets = new Map<string, Sheet>();
  const live = new Set<Made>();
  const group = new THREE.Group();
  group.name = 'fight-figures';
  view.scene.add(group);
  const light = new THREE.Color(1, 1, 1);

  function sheetOf(name: string): Sheet {
    let sheet = sheets.get(name);
    if (sheet) return sheet;
    const asset = view.assets.sprite(name);
    const texture = new THREE.DataTexture(asset.pixels.data, asset.pixels.width, asset.pixels.height, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    sheet = { asset, texture };
    sheets.set(name, sheet);
    return sheet;
  }

  class Made implements Figure {
    scale = 1;
    readonly tint = new THREE.Color(1, 1, 1);
    drained = 0;
    sweep = 0;
    flash = 0;
    shake = 0;
    squashX = 1;
    squashY = 1;
    roll = 0;
    warm = 0;
    glow = 0;
    mirror = false;
    alpha = 1;
    visible = true;
    private sheet: Sheet;
    private animation = '';
    private frame = -1;
    private clock = 0;
    private facing = Math.PI;
    private seen: SpriteView | undefined;
    private readonly uniforms = {
      uMap: { value: null as THREE.Texture | null },
      uPlace: { value: new THREE.Vector3() },
      uSize: { value: new THREE.Vector2(1, 1) },
      uAnchor: { value: new THREE.Vector2(0.5, 0) },
      uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      uMove: { value: new THREE.Vector3(1, 1, 0) },
      uRoll: { value: 0 },
      uHeat: { value: new THREE.Vector2(0, 0) },
      uBody: { value: new THREE.Vector2(0, 1) },
      uTint: { value: this.tint },
      uLight: { value: light },
      uGlow: { value: GLOW },
      uLook: { value: new THREE.Vector4(0, 0, 0, 1) },
      fogColor: { value: new THREE.Color() },
      fogNear: { value: 1 },
      fogFar: { value: 1000 },
      fogDensity: { value: 0 },
    };
    private readonly mesh: THREE.Mesh;

    constructor(sheet: string, ghost: boolean) {
      this.sheet = sheetOf(sheet);
      const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, fog: true, transparent: ghost, depthWrite: !ghost, side: THREE.DoubleSide });
      this.mesh = new THREE.Mesh(quad, material);
      // The quad is placed in the shader, so its own box says nothing about where it is.
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = ghost ? 2 : 0;
      group.add(this.mesh);
      this.animation = Object.keys(this.sheet.asset.animations)[0] ?? '';
    }

    place(x: number, y: number, z: number): void { this.uniforms.uPlace.value.set(x, y, z); }
    face(facing: number): void { this.facing = facing; }

    private use(sheet: string, animation: string): void {
      const next = sheetOf(sheet);
      if (next !== this.sheet || animation !== this.animation) this.clock = 0;
      this.sheet = next;
      this.animation = next.asset.animations[animation] ? animation : Object.keys(next.asset.animations)[0] ?? '';
    }

    play(sheet: string, animation: string): void {
      this.use(sheet, animation);
      this.frame = -1;
    }

    pose(sheet: string, animation: string, frame: number): void {
      this.use(sheet, animation);
      this.frame = frame;
    }

    once(sheet: string, animation: string, elapsed: number, seconds: number): void {
      this.use(sheet, animation);
      const frames = this.sheet.asset.animations[this.animation]?.frames ?? 1;
      this.frame = Math.min(frames - 1, Math.max(0, Math.floor((elapsed / seconds) * frames)));
    }

    get height(): number {
      const a = this.sheet.asset;
      return ((a.anchor[1] - a.body[1]) / a.frame[1]) * a.worldHeight * this.scale;
    }

    /** Writes this frame's numbers for the shader. */
    write(dt: number, cameraYaw: number): void {
      this.mesh.visible = this.visible;
      if (!this.visible) return;
      this.clock += dt;
      const a = this.sheet.asset, anim = a.animations[this.animation];
      if (!anim) return;
      this.seen = pickView(this.facing, cameraYaw, this.seen);
      const rows = anim.rows;
      let row = rows.front, flip = 1;
      if (this.seen === VIEW_BACK) row = rows.back ?? rows.front;
      else if (this.seen !== VIEW_FRONT && rows.side !== undefined) { row = rows.side; if (this.seen === VIEW_SIDE_LEFT) flip = -1; }
      if (this.mirror && (this.seen === VIEW_FRONT || this.seen === VIEW_BACK)) flip = -flip;
      const frame = this.frame >= 0 ? Math.min(this.frame, anim.frames - 1) : Math.floor(this.clock * anim.fps) % anim.frames;
      const w = a.pixels.width, h = a.pixels.height, fw = a.frame[0], fh = a.frame[1];
      const u = this.uniforms;
      // Half a pixel inside the frame, so no sample reaches its neighbor.
      u.uRect.value.set((frame * fw + 0.5) / w, (row * fh + 0.5) / h, ((frame + 1) * fw - 0.5) / w, ((row + 1) * fh - 0.5) / h);
      u.uMap.value = this.sheet.texture;
      const tall = a.worldHeight * this.scale;
      u.uSize.value.set((tall * fw) / fh, tall);
      u.uAnchor.value.set(a.anchor[0] / fw, 1 - a.anchor[1] / fh);
      u.uBody.value.set(a.body[1] / fh, a.body[3] / fh);
      u.uMove.value.set(flip * this.squashX, this.squashY, this.shake);
      // A roll tips it toward its back whichever way the drawing faces.
      u.uRoll.value = this.roll * flip;
      u.uHeat.value.set(this.warm, this.glow);
      u.uLook.value.set(this.drained, this.sweep, this.flash, this.alpha);
    }

    remove(): void {
      group.remove(this.mesh);
      (this.mesh.material as THREE.Material).dispose();
      live.delete(this);
    }
  }

  return {
    add(sheet, options) {
      const made = new Made(sheet, options?.ghost ?? false);
      live.add(made);
      return made;
    },
    has: (sheet) => view.assets.hasSprite(sheet),
    update(dt) {
      light.copy(view.sky.look.light);
      const yaw = view.camera.yaw;
      for (const made of live) made.write(dt, yaw);
    },
    get count() { return live.size; },
  };
}
