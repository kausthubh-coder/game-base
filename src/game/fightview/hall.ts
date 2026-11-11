// The Verdant Stag's hall in the world, behind `?scene=stag`: the cells of `src/game/fight/hall-layout.sim.ts`
// stamped into the block world, and the god drawn as part of the room.
//
// The blocks: a stone floor of cobble and stone brick, a low ring of barriers that painted boulders stand on,
// the Stag's body as tall barriers nobody walks through, and in the third phase the vines' ramp as barrier
// steps the hero walks up one block at a time. The rules and the body agree because both read the same cells.
//
// The Stag is a code-built body as tall as an oak: about 8 blocks at the shoulder, its antlers past 14. It is
// simple shapes in the palette, merged into two meshes: the body, and the neck, head and antlers, which turn
// and dip with what the rules say it is doing, so a sweep is seen coming from the head as well as on the
// ground. It is drained grey until it is freed; then the grey runs out of it from the antlers down. Gold
// chains run from the four pins and the collar. The pins, lamps, seed pods, roots and the ramp are the hall's
// own meshes, and its marks on the ground are one more draw call (`ground.ts`).
//
// It reads the fight and the hall, and never writes their state. `looks.ts`, `draw.ts`, `feel.ts` and
// `figures.ts` are left alone: the hall's feel (a hit's freeze, the long freeze of the end) goes through the
// `feel.freeze` number the lab already spends.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AIR, blockId } from '../../content/blocks.ts';
import { SHAPE_AFTER, STAG } from '../content/fight.ts';
import type { Fight, FightEvent, Target, Telegraph } from '../fight/fight.sim.ts';
import { HALL, type RampCell } from '../fight/hall-layout.sim.ts';
import type { Hall, HallEvent } from '../fight/hall.sim.ts';
import { paint } from '../../features/painted/index.ts';
import type { GameView } from '../shell/view.ts';
import type { Feel } from './feel.ts';
import { MARK, createGround } from './ground.ts';
import { GOLD, HOT, PALE, SHADE, TEAL } from './looks.ts';

// The locked palette's colors (assets-src/palette.json), by the names `features/props/palette.ts` gives them.
const C = {
  ink: 0x302529, umber: 0x493335, bark: 0x65453a, wood: 0x815940, tan: 0xa27151, gold: 0xd4aa58, butter: 0xeeca76,
  pewter: 0x918996, iron: 0x726c7a, slate: 0x51455d, ash: 0xb2a8b0, pine: 0x3c5537, moss: 0x516b3c, leaf: 0x6c8043,
  lime: 0x8d9a4a, straw: 0xadac59, lumeLight: 0x66e4cf, lamp: 0xf4d594, lampHot: 0xfcdd9c, bone: 0xeae6cd, coral: 0xd67c59,
} as const;
const LAMP_LIGHT = new THREE.Color(C.lampHot);
const RIM = new THREE.Color(C.butter);

// ---------------------------------------------------------------------------------------- the blocks

/** The ring of boulders, the floor and the Stag's body into the block world, around a middle block whose feet height is `y`. The ramp is left out. */
export function stampHall(view: GameView, ox: number, y: number, oz: number): void {
  const world = view.world.sim, barrier = blockId('barrier'), cobble = blockId('cobble'), brick = blockId('stone_brick'), stone = blockId('stone');
  // Without the painted look nothing draws a boulder over a barrier, so the ring is stone blocks.
  const ring = view.painted ? barrier : stone;
  const reach = HALL.wall + 1;
  for (let x = -reach; x <= reach; x++) {
    for (let z = -reach; z <= reach; z++) {
      const d = Math.hypot(x + 0.5 - 0.5, z + 0.5 - 0.5);
      if (d > HALL.wall + 0.6) continue;
      // Clear what stood on the plot.
      for (let dy = 0; dy < 10; dy++) if (world.getBlock(ox + x, y + dy, oz + z) !== AIR) world.setBlock(ox + x, y + dy, oz + z, AIR);
      if (d <= HALL.radius + 0.5) {
        // Paving, with two rings of brick: one round the middle, one at the rim.
        const band = (d > 5 && d < 6.2) || d > HALL.radius - 0.7;
        world.setBlock(ox + x, y - 1, oz + z, band ? brick : cobble);
      } else {
        for (let dy = 0; dy < 2; dy++) world.setBlock(ox + x, y + dy, oz + z, ring);
      }
    }
  }
  // The posts of the pins and the lamps.
  for (const p of [...HALL.pins, ...HALL.lamps]) for (let dy = 0; dy < 2; dy++) world.setBlock(ox + Math.floor(p.x), y + dy, oz + Math.floor(p.z), barrier);
  // The body: taller than the top of the ramp, so a hero up the vines cannot step onto it.
  const b = HALL.body;
  for (let x = b.x0; x < b.x1; x++) for (let z = b.z0; z < b.z1; z++) for (let dy = 0; dy < 8; dy++) world.setBlock(ox + x, y + dy, oz + z, barrier);
  setRamp(view, ox, y, oz, false);
}

/** The vines' ramp as barrier steps, or takes them away. */
export function setRamp(view: GameView, ox: number, y: number, oz: number, on: boolean): void {
  const world = view.world.sim, barrier = blockId('barrier');
  for (const c of HALL.ramp) for (let dy = 0; dy < 7; dy++) {
    const want = on && dy < c.height ? barrier : AIR;
    if (world.getBlock(ox + c.x, y + dy, oz + c.z) !== want) world.setBlock(ox + c.x, y + dy, oz + c.z, want);
  }
}

// ---------------------------------------------------------------------------------------- building in shapes

/** Parts in one color each, merged into one geometry with vertex colors. */
class Kit {
  private parts: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private e = new THREE.Euler();

  /** Adds a geometry in a color, placed, turned and sized. The faces facing down are drawn a little darker. */
  add(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): void {
    geo.deleteAttribute('uv');
    this.m.compose(this.p.set(x, y, z), this.q.setFromEuler(this.e.set(rx, ry, rz)), this.s.set(sx, sy, sz));
    geo.applyMatrix4(this.m);
    this.paint(geo, color);
    this.parts.push(geo.index ? geo.toNonIndexed() : geo);
  }

  /** An egg shape: a sphere of radii `rx`, `ry`, `rz`. */
  blob(color: number, x: number, y: number, z: number, rx: number, ry: number, rz: number, turn = 0, tip = 0): void {
    this.add(new THREE.SphereGeometry(1, 8, 6), color, x, y, z, tip, turn, 0, rx, ry, rz);
  }

  /** A tapered rod from one point to another. */
  rod(color: number, a: readonly number[], b: readonly number[], r0: number, r1: number, sides = 6): void {
    const from = new THREE.Vector3(a[0], a[1], a[2]), to = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = to.clone().sub(from), length = dir.length();
    const geo = new THREE.CylinderGeometry(r1, r0, length, sides, 1);
    geo.deleteAttribute('uv');
    geo.translate(0, length / 2, 0);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    geo.translate(from.x, from.y, from.z);
    this.paint(geo, color);
    this.parts.push(geo.toNonIndexed());
  }

  private paint(geo: THREE.BufferGeometry, color: number): void {
    const base = new THREE.Color(color), normal = geo.getAttribute('normal'), n = geo.getAttribute('position').count;
    const colors = new Float32Array(n * 3), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const up = normal ? normal.getY(i) : 0;
      c.copy(base).multiplyScalar(0.86 + 0.14 * up);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  done(): THREE.BufferGeometry {
    const geo = mergeGeometries(this.parts);
    if (!geo) throw new Error('hall: the parts would not merge');
    for (const p of this.parts) p.dispose();
    this.parts = [];
    geo.computeBoundingSphere();
    return geo;
  }
}

/** A seeded random number for the shapes, so the Stag is built the same way every time. */
function shapeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** The Stag's body, its local +z to the south (the way it faces), its chest at the origin, the floor at 0. */
function buildBody(): THREE.BufferGeometry {
  const k = new Kit(), r = shapeRandom(11);
  // Torso, shoulders, haunch and belly.
  k.blob(C.moss, 0, 6.0, -4, 2.3, 1.9, 4.4);
  k.blob(C.moss, 0, 6.6, -1.0, 2.25, 2.2, 1.9);
  k.blob(C.moss, 0, 6.2, -7.0, 2.15, 2.0, 1.8);
  k.blob(C.lime, 0, 5.0, -4, 1.8, 1.0, 3.6);
  k.blob(C.straw, 0, 6.0, 0.4, 1.5, 1.6, 1.0);
  // Legs: an upper leg, a shank and a dark hoof.
  for (const [x, z, hind] of [[-2, -0.6, 0], [2, -0.6, 0], [-2, -7.4, 1], [2, -7.4, 1]] as const) {
    const sx = Math.sign(x) * 1.7;
    k.blob(C.moss, sx, 4.3, z - 0.2 * hind, 0.8, 1.5, hind ? 1.05 : 0.85);
    k.rod(C.bark, [sx, 3.2, z - 0.3 * hind], [x, 0.38, z], 0.46, 0.3);
    k.add(new THREE.CylinderGeometry(0.38, 0.46, 0.42, 7), C.ink, x, 0.21, z);
  }
  // Moss and leaves along the back, and a short tail.
  for (let i = 0; i < 14; i++) {
    const z = -0.5 - i * 0.55, x = (r() - 0.5) * 2.4;
    k.blob(i % 3 ? C.leaf : C.lime, x, 7.7 + r() * 0.5 - Math.abs(x) * 0.25 + (i < 3 ? 0.6 : 0), z, 0.55 + r() * 0.3, 0.35, 0.5 + r() * 0.3, r() * 3);
  }
  k.blob(C.straw, 0, 6.9, -8.9, 0.45, 0.6, 0.4, 0, -0.6);
  return k.done();
}

/** The neck, head and antlers, from the neck's root on the shoulders: +y up, +z the way it faces. */
function buildHead(): THREE.BufferGeometry {
  const k = new Kit(), r = shapeRandom(23);
  k.rod(C.moss, [0, -0.4, -0.4], [0, 2.6, 1.8], 1.15, 0.72, 8);
  k.blob(C.straw, 0, 1.0, 0.9, 0.75, 1.3, 0.7, 0, 0.6);
  // The head, the muzzle, the eyes and the ears.
  k.blob(C.wood, 0, 3.0, 2.6, 0.78, 0.78, 1.3, 0, 0.25);
  k.blob(C.umber, 0, 2.62, 3.75, 0.5, 0.45, 0.62);
  k.blob(C.lumeLight, -0.6, 3.25, 3.0, 0.14, 0.14, 0.14);
  k.blob(C.lumeLight, 0.6, 3.25, 3.0, 0.14, 0.14, 0.14);
  k.blob(C.tan, -0.85, 3.55, 2.1, 0.5, 0.16, 0.26, 0.4, 0);
  k.blob(C.tan, 0.85, 3.55, 2.1, 0.5, 0.16, 0.26, -0.4, 0);
  // The antlers: a beam each side that sweeps out and up, with tines and leaves at the tips.
  for (const side of [-1, 1]) {
    const beam = [[0.35, 3.6, 2.3], [1.5, 5.0, 1.8], [2.7, 6.1, 1.1], [3.7, 6.9, 0.2], [4.3, 7.3, -0.6]];
    for (let i = 0; i < beam.length - 1; i++) {
      const a = beam[i] as number[], b = beam[i + 1] as number[];
      k.rod(C.tan, [a[0]! * side, a[1]!, a[2]!], [b[0]! * side, b[1]!, b[2]!], 0.26 - i * 0.04, 0.22 - i * 0.04);
    }
    for (let i = 1; i < beam.length; i++) {
      const a = beam[i] as number[], up = 1.2 + r() * 0.8;
      const tip = [a[0]! * side + side * 0.2, a[1]! + up, a[2]! + 0.5 - r() * 0.4];
      k.rod(C.tan, [a[0]! * side, a[1]!, a[2]!], tip, 0.15, 0.06, 5);
      k.blob(i % 2 ? C.lime : C.leaf, tip[0]!, tip[1]! + 0.1, tip[2]!, 0.42, 0.3, 0.42, r() * 3);
    }
  }
  return k.done();
}

/** One pin: a stone base and a gold stake with a ring at its top. */
function buildPin(): THREE.BufferGeometry {
  const k = new Kit();
  k.add(new THREE.CylinderGeometry(0.75, 0.9, 0.3, 8), C.pewter, 0, 0.15, 0);
  k.add(new THREE.CylinderGeometry(0.16, 0.24, 1.5, 6), C.gold, 0, 1.0, 0);
  k.add(new THREE.TorusGeometry(0.3, 0.08, 5, 10), C.butter, 0, 1.75, 0);
  return k.done();
}

/** The post of a lamp, and its head on its own, so a lit head can glow. */
function buildLampPost(): THREE.BufferGeometry {
  const k = new Kit();
  k.add(new THREE.CylinderGeometry(0.45, 0.6, 0.25, 7), C.slate, 0, 0.12, 0);
  k.add(new THREE.CylinderGeometry(0.1, 0.14, 1.7, 6), C.iron, 0, 1.0, 0);
  k.add(new THREE.CylinderGeometry(0.42, 0.3, 0.14, 7), C.iron, 0, 1.92, 0);
  return k.done();
}
function buildLampHead(): THREE.BufferGeometry {
  const k = new Kit();
  k.blob(0xffffff, 0, 2.2, 0, 0.3, 0.3, 0.3);
  k.add(new THREE.ConeGeometry(0.4, 0.3, 7), C.iron, 0, 2.6, 0);
  return k.done();
}

/** A seed pod: a bulb on a short stalk, with two leaves. Instanced, tinted by its own color. */
function buildPod(): THREE.BufferGeometry {
  const k = new Kit();
  k.blob(0xffffff, 0, 0.55, 0, 0.42, 0.5, 0.42);
  k.rod(0xffffff, [0, 0, 0], [0, 0.2, 0], 0.1, 0.1, 5);
  k.blob(0xc8d8a8, 0.35, 0.12, 0, 0.35, 0.06, 0.16, 0, 0);
  k.blob(0xc8d8a8, -0.3, 0.12, 0.1, 0.32, 0.06, 0.15, 0.8, 0);
  return k.done();
}

/** Roots that flood the floor from the Stag's legs in the second phase. Points are from the hall's middle corner. */
function buildRoots(): THREE.BufferGeometry {
  const k = new Kit(), r = shapeRandom(5);
  const legs = HALL.legs;
  for (let i = 0; i < 18; i++) {
    const leg = legs[i % 2 ? 1 : 0] as { x: number; z: number };
    let x = leg.x + 0.5 - 0.5 + (r() - 0.5), z = leg.z + 0.5;
    let angle = Math.PI * (0.15 + r() * 0.7) * (i % 2 ? 1 : -1) + Math.PI;
    for (let s = 0; s < 4; s++) {
      const length = 1.6 + r() * 1.8, nx = x + Math.sin(angle) * length, nz = z - Math.cos(angle) * length;
      if (Math.hypot(nx - 0.5, nz - 0.5) > HALL.radius - 0.6) break;
      k.rod(s % 2 ? C.bark : C.umber, [x, 0.08, z], [nx, 0.08, nz], 0.22 - s * 0.04, 0.17 - s * 0.04, 5);
      x = nx; z = nz;
      angle += (r() - 0.5) * 1.1;
    }
  }
  return k.done();
}

/**
 * The vines' ramp: a mat of leaves on each step at its height, held up on twisted stems that grow from the
 * floor, with vines winding up its outer side. The steps' blocks are solid all the way down, but the picture
 * is a bridge of vines, not a wall.
 */
function buildRamp(): THREE.BufferGeometry {
  const k = new Kit(), r = shapeRandom(9);
  for (const c of HALL.ramp as readonly RampCell[]) {
    k.add(new THREE.BoxGeometry(1.04, 0.32, 1.04), r() > 0.45 ? C.leaf : C.moss, c.x + 0.5, c.height - 0.16, c.z + 0.5);
    k.add(new THREE.BoxGeometry(0.9, 0.22, 0.9), r() > 0.5 ? C.bark : C.umber, c.x + 0.5, c.height - 0.4, c.z + 0.5);
    // A leafy lip on the outer edge, so the step reads from the camera's side.
    if (c.x === 4) k.blob(r() > 0.5 ? C.lime : C.leaf, c.x + 1, c.height - 0.15, c.z + 0.5, 0.3, 0.26, 0.55, r() * 3);
  }
  // Stems: from the floor up under every other step, leaning a little.
  for (let i = 0; i < HALL.ramp.length; i += 2) {
    const c = HALL.ramp[i] as RampCell;
    if (c.height < 2) continue;
    const x = c.x + 0.5 + (r() - 0.5) * 0.4, z = c.z + 0.5;
    k.rod(i % 4 ? C.bark : C.umber, [x + (r() - 0.5) * 0.8, 0, z + 0.6], [x, c.height - 0.45, z], 0.2, 0.13, 5);
  }
  // Vines winding up its outer side to the shoulder.
  for (let i = 0; i < 4; i++) {
    const x = 5.05 + i * 0.05;
    k.rod(C.leaf, [x, 0.1, 7 - i * 0.3], [x - 0.2, 3, 1 - i * 0.4], 0.13, 0.11, 5);
    k.rod(C.moss, [x - 0.2, 3, 1 - i * 0.4], [x - 0.5, 6.2, -4.6 + i * 0.25], 0.11, 0.08, 5);
  }
  return k.done();
}

/** The drained grey: a line in the world's height above which the colors are back. Very high, the whole body is grey. */
type Drain = { uDrain: { value: number } };

function bodyMaterial(view: GameView, drain: Drain): THREE.Material {
  const fragmentPars = 'uniform float uDrain;';
  const back = (y: string) => /* glsl */ `
    float hallGrey = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(vec3(hallGrey) * vec3(0.9, 0.9, 0.95), diffuseColor.rgb, smoothstep(uDrain - 0.9, uDrain + 0.9, ${y}));`;
  if (view.painted) return paint({ vertexColors: true, uniforms: drain, fragmentPars, fragmentAlbedo: back('vPaintWorld.y') });
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, drain);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vHallY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHallY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying float vHallY;\n${fragmentPars}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${back('vHallY')}`);
  };
  return material;
}

const plain = (view: GameView, options: THREE.MeshLambertMaterialParameters = {}): THREE.Material =>
  view.painted ? paint({ vertexColors: true, ...options }) : new THREE.MeshLambertMaterial({ vertexColors: true, ...options });

// ---------------------------------------------------------------------------------------- chains

const LINKS = 16;

interface Chain {
  /** One end: a pin's ring, or the floor under the collar. The other: a leg, or the collar. */
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** Seconds since each end let go and fell to the floor, or -1 while it holds. */
  fromFell: number;
  toFell: number;
  /** True for a chain that ends at the collar and so moves with the head. */
  neck: boolean;
}

// ---------------------------------------------------------------------------------------- the view

export interface HallView {
  /** Once a step of the body, right after the hall's own step: the ramp's blocks, and a hero who stands where they come up. */
  afterStep(): void;
  /** Once a frame, after the lab's own drawing. */
  frame(dt: number, clock: number): void;
  /** A fight event: a hit on a target freezes the fight a moment and throws chips, as a hit on a beast does. */
  hear(e: FightEvent): void;
  /** The target the hero hit last, for the hall's bar. */
  readonly lastHit: Target | null;
  /** True for the shape of a shake, which the hall draws on its vines: `draw.ts` leaves it out. */
  owns(shape: Telegraph): boolean;
  /** Seconds since the Stag was freed, or -1. */
  readonly freedFor: number;
  /** The Stag's group, for a test that wants to know it is there. */
  readonly stag: THREE.Group;
  /** The triangles the hall's own meshes draw now, counting the shadow pass for those that cast one. */
  triangles(): number;
}

/** The hour of the hall in each phase, as the game's time of day: morning, then dusk while the lamps are dark, then morning again once they are lit. */
const HOURS = [0.42, 0.8, 0.42] as const;

/** `setTime` sets the game's time of day, so the overgrowth's dark is the world's own dusk. */
export function createHallView(view: GameView, fight: Fight, hall: Hall, ox: number, y: number, oz: number, feel: Feel, setTime?: (timeOfDay: number) => void): HallView {
  const group = new THREE.Group();
  group.name = 'stag-hall';
  view.scene.add(group);
  const at = (p: { x: number; z: number }) => ({ x: ox + p.x, z: oz + p.z });
  const chest = at(HALL.chest);

  // ---------------------------------------------------------------- the Stag
  const drain: Drain = { uDrain: { value: 1000 } };
  const skin = bodyMaterial(view, drain);
  const stag = new THREE.Group();
  stag.name = 'stag';
  stag.position.set(chest.x, y, chest.z);
  // A rear pivot at the hind hooves, so a stamp rears the front up.
  const rear = new THREE.Group();
  rear.position.set(0, 0, -7.4);
  const body = new THREE.Mesh(buildBody(), skin);
  body.position.z = 7.4;
  body.castShadow = body.receiveShadow = true;
  const neck = new THREE.Group();
  neck.position.set(0, 7.4, -0.2 + 7.4);
  const head = new THREE.Mesh(buildHead(), skin);
  head.castShadow = true;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.24, 6, 16), plain(view, { color: C.gold, vertexColors: false }));
  collar.position.set(0, 1.15, 0.75);
  collar.rotation.x = Math.PI / 2 - 0.6;
  collar.castShadow = true;
  neck.add(head, collar);
  rear.add(body, neck);
  stag.add(rear);
  group.add(stag);

  // ---------------------------------------------------------------- pins, lamps, pods, roots and the ramp
  const metal = plain(view);
  const pinGeo = buildPin();
  const pins = hall.pins.map((p) => {
    const mesh = new THREE.Mesh(pinGeo, metal);
    mesh.position.set(p.x, y, p.z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  });
  const posts = new THREE.Group();
  const postGeo = buildLampPost(), headGeo = buildLampHead();
  const dark = plain(view, { color: C.ash }), bright = new THREE.MeshBasicMaterial({ vertexColors: true, color: C.lampHot });
  const lampHeads = hall.lamps.map((l) => {
    const post = new THREE.Mesh(postGeo, metal);
    post.position.set(l.x, y, l.z);
    post.castShadow = true;
    const lampHead = new THREE.Mesh(headGeo, dark);
    lampHead.position.copy(post.position);
    posts.add(post, lampHead);
    return lampHead;
  });
  group.add(posts);

  const podMesh = new THREE.InstancedMesh(buildPod(), plain(view), STAG.pod.most + 2);
  podMesh.count = 0;
  podMesh.frustumCulled = false;
  podMesh.castShadow = true;
  group.add(podMesh);

  const roots = new THREE.Mesh(buildRoots(), skin);
  roots.position.set(ox, y, oz);
  roots.visible = false;
  roots.receiveShadow = true;
  group.add(roots);

  // The vines are alive: they keep their colors while the Stag is grey.
  const ramp = new THREE.Mesh(buildRamp(), plain(view));
  ramp.position.set(ox, y, oz);
  ramp.visible = false;
  ramp.receiveShadow = true;
  group.add(ramp);

  // ---------------------------------------------------------------- the chains
  // Big links, few of them: a chain reads from the furthest step, and its shadow adds nothing there.
  const linkGeo = new THREE.TorusGeometry(0.26, 0.075, 3, 6);
  linkGeo.deleteAttribute('uv');
  const links = new THREE.InstancedMesh(linkGeo, view.painted ? paint({ color: C.gold }) : new THREE.MeshLambertMaterial({ color: C.gold }), LINKS * 5);
  links.frustumCulled = false;
  group.add(links);
  const collarWorld = new THREE.Vector3();
  const chains: Chain[] = [];
  const legsAt = HALL.legs.map((l) => at(l));
  // The two pins by its front hold its front legs. The two toward the door hold its neck. The collar is held to the floor under its chin.
  hall.pins.forEach((p, i) => {
    const leg = legsAt[i] as { x: number; z: number };
    chains.push({ from: new THREE.Vector3(p.x, y + 1.75, p.z), to: i < 2 ? new THREE.Vector3(leg.x, y + 2.6, leg.z) : new THREE.Vector3(), fromFell: -1, toFell: -1, neck: i >= 2 });
  });
  chains.push({ from: new THREE.Vector3(chest.x + 0.8, y + 0.1, chest.z + 4.2), to: new THREE.Vector3(), fromFell: -1, toFell: -1, neck: true });

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), point = new THREE.Vector3(), next = new THREE.Vector3(), dir = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);
  const quarter = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), tint = new THREE.Color();
  const endA = new THREE.Vector3(), endB = new THREE.Vector3(), held = new THREE.Vector3();

  /** Lays one chain's links along a sagging curve from `a` to `b`. */
  function layChain(index: number, a: THREE.Vector3, b: THREE.Vector3, sag: number): void {
    for (let i = 0; i < LINKS; i++) {
      const t0 = i / LINKS, t1 = (i + 1) / LINKS;
      point.lerpVectors(a, b, t0);
      point.y -= sag * 4 * t0 * (1 - t0);
      next.lerpVectors(a, b, t1);
      next.y -= sag * 4 * t1 * (1 - t1);
      dir.subVectors(next, point).normalize();
      q.setFromUnitVectors(zAxis, dir);
      // Every other link turned a quarter round its length.
      if (i % 2) q.multiply(quarter);
      m.compose(point.lerp(next, 0.5), q, one);
      links.setMatrixAt(index * LINKS + i, m);
    }
  }

  /** Where an end that let go lies: on the floor, a third of the way toward the other end. `fell` is seconds since it let go. */
  function dropEnd(out: THREE.Vector3, end: THREE.Vector3, other: THREE.Vector3, fell: number): number {
    if (fell < 0) { out.copy(end); return 0; }
    const k = Math.min(1, fell / 0.55), ease = k * k;
    held.set(end.x + (other.x - end.x) * 0.3, y + 0.08, end.z + (other.z - end.z) * 0.3);
    out.copy(end).lerp(held, ease);
    return ease;
  }

  function placeChains(dt: number): void {
    collar.getWorldPosition(collarWorld);
    for (let i = 0; i < chains.length; i++) {
      const c = chains[i] as Chain;
      // A neck chain follows the collar until the collar is gone.
      if (c.neck && c.toFell < 0) c.to.copy(collarWorld);
      if (c.fromFell >= 0) c.fromFell += dt;
      if (c.toFell >= 0) c.toFell += dt;
      const a = dropEnd(endA, c.from, c.to, c.fromFell), b = dropEnd(endB, c.to, c.from, c.toFell);
      layChain(i, endA, endB, 0.25 + Math.max(a, b) * 1.1);
    }
    links.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the marks on the ground
  const ground = createGround(view);
  const lit = new THREE.Color(C.lamp), root = new THREE.Color(C.moss);

  // ---------------------------------------------------------------- following the rules
  let rampOn = false, rampGrow = 0, rootsGrow = 0, freedFor = -1, shownRound = -1, lastHit: Target | null = null, hour: number = HOURS[0], holdFor = 0;
  const flashes = new Map<number, number>();
  const spot = { x: 0, y: 0, z: 0 };
  const effect = (id: Parameters<GameView['effects']['play']>[0], x: number, z: number, lift: number, color?: number, scale?: number): void => {
    spot.x = x; spot.y = y + lift; spot.z = z;
    view.effects.play(id, spot, color === undefined && scale === undefined ? undefined : { color, scale });
  };
  const sound = (event: Parameters<NonNullable<GameView['audio']>['emit']>[0]): void => { view.audio?.emit(event); };

  /** Puts the room back as the hall starts again. */
  function reset(): void {
    shownRound = hall.round;
    for (const c of chains) c.fromFell = c.toFell = -1;
    collar.visible = true;
    collar.position.set(0, 1.15, 0.75);
    drain.uDrain.value = 1000;
    freedFor = -1;
    rootsGrow = 0;
    roots.visible = false;
    rampGrow = 0;
    ramp.visible = false;
    for (const pin of pins) { pin.rotation.set(0, 0, 0); pin.position.y = y; }
    for (const l of lampHeads) l.material = dark;
    lastHit = null;
    hour = HOURS[0];
    setTime?.(hour);
  }

  function hearHall(e: HallEvent): void {
    spot.x = e.x; spot.y = y + 0.6; spot.z = e.z;
    switch (e.type) {
      case 'woke': sound({ type: 'pet', mood: 'alert', at: spot }); break;
      case 'pin': {
        // The pin's end of its chain lets go.
        const chain = chains[e.n];
        if (chain) chain.fromFell = 0;
        const pin = pins[e.n];
        if (pin) { pin.rotation.set(0.25, e.n * 1.3, 1.25); pin.position.y = y - 0.35; }
        feel.freeze = Math.max(feel.freeze, 8 / 60);
        effect('chips', e.x, e.z, 1.2, C.butter, 1.2);
        effect('pop', e.x, e.z, 0.1);
        sound({ type: 'blockBroken', surface: 'stone', at: spot });
        break;
      }
      case 'stagger': effect('popDust', chest.x, chest.z + 1, 0.2, undefined, 3); break;
      case 'phase':
        feel.freeze = Math.max(feel.freeze, 10 / 60);
        sound({ type: 'stinger' });
        effect('leafBurst', chest.x, chest.z + 2, 1.5);
        break;
      case 'lamp': effect('trail', e.x, e.z, 2.2, C.lampHot, 1.2); sound({ type: 'spell', element: 'bloom', at: spot }); break;
      case 'sprout': effect('leafBurst', e.x, e.z, 0.2); break;
      case 'burst': effect('popDust', e.x, e.z, 0.3, 0xc8d8a8, 2); effect('chips', e.x, e.z, 0.5, C.lime, 1); sound({ type: 'land', surface: 'grass', at: spot }); break;
      case 'cut': effect('leafBurst', e.x, e.z, 0.5); break;
      case 'wither': effect('trail', e.x, e.z, 0.4, C.lampHot, 0.4); break;
      case 'fall': sound({ type: 'pet', mood: 'sad', at: spot }); break;
      case 'freed':
        // Note 05: a Warden phase ends with 20 frames of stop. This is the end of the whole hall.
        feel.freeze = Math.max(feel.freeze, STAG.freeFreeze / 60);
        freedFor = 0;
        // Every end on the collar lets go, and the collar's own chain falls from the floor ring too.
        for (const c of chains) if (c.neck && c.toFell < 0) c.toFell = 0;
        if (chains[4]!.fromFell < 0) chains[4]!.fromFell = 0.2;
        effect('chips', e.x, e.z, 7, C.butter, 2.5);
        sound({ type: 'blockBroken', surface: 'stone', at: spot });
        sound({ type: 'stinger' });
        break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- the head and antlers, from what the Stag is doing
  let yaw = 0, pitch = 0, rearUp = 0, roll = 0;
  const towards = (from: number, to: number, rate: number, dt: number): number => from + (to - from) * Math.min(1, rate * dt);

  function pose(dt: number, clock: number): void {
    const s = hall.stag;
    // Where it looks: the hero, or the side its attack comes from.
    const lx = s.lookX - chest.x, lz = s.lookZ - chest.z;
    let wantYaw = Math.max(-0.7, Math.min(0.7, Math.atan2(lx, Math.max(1, lz)))), wantPitch = 0.1, wantRear = 0, wantRoll = 0, rate = 4;
    const k = s.until > 0 ? Math.min(1, s.t / s.until) : 1;
    if (s.doing === 'asleep') { wantPitch = 0.45; wantYaw = 0; }
    if (s.doing === 'windup' && s.attack === 'sweep') {
      // It turns its head to the side the sweep comes from and lowers its antlers, drawing back at the end.
      wantYaw = s.from * 0.95;
      wantPitch = 0.35 + 0.25 * k - (k > 0.8 ? 0.4 * (k - 0.8) / 0.2 : 0);
      rate = 3;
    } else if (s.doing === 'recover' && s.attack === 'sweep' && s.t < 0.45) {
      // The sweep: the head swings across to the other side, antlers low.
      const swing = Math.min(1, s.t / 0.3);
      wantYaw = s.from * 0.95 * (1 - 2 * swing);
      wantPitch = 0.8;
      rate = 30;
    } else if (s.doing === 'windup' && s.attack === 'stamp') {
      wantRear = 0.11 * k;
      wantPitch = -0.2;
      rate = 5;
    } else if (s.doing === 'recover' && s.attack === 'stamp' && s.t < 0.25) {
      wantRear = -0.01;
      rate = 40;
    } else if (s.doing === 'windup' && s.attack === 'shake') {
      wantRoll = Math.sin(clock * 22) * 0.03 * k;
      wantPitch = 0.3;
      rate = 12;
    } else if (s.doing === 'recover' && s.attack === 'shake' && s.t < 0.5) {
      wantRoll = Math.sin(clock * 30) * 0.06 * (1 - s.t / 0.5);
      rate = 30;
    } else if (s.doing === 'stagger') {
      wantPitch = 0.65 + Math.sin(clock * 5) * 0.1;
      wantYaw = Math.sin(clock * 3) * 0.3;
      wantRoll = Math.sin(clock * 4) * 0.025;
      rate = 6;
    } else if (s.doing === 'rise') {
      // Between phases it throws its head up.
      wantPitch = -0.45;
      wantRear = 0.05;
      rate = 5;
    } else if (s.doing === 'freed') {
      // It stands very still, then lowers its head to the hero.
      wantPitch = freedFor > 2.4 ? 0.75 : 0;
      wantYaw = freedFor > 2.4 ? Math.max(-0.7, Math.min(0.7, Math.atan2(fight.hero.x - chest.x, Math.max(1, fight.hero.z - chest.z)))) : 0;
      rate = 1.2;
    }
    // A slow breath under everything.
    const breath = Math.sin(clock * 1.3) * 0.015;
    yaw = towards(yaw, wantYaw, rate, dt);
    pitch = towards(pitch, wantPitch, rate, dt);
    rearUp = towards(rearUp, wantRear, rate, dt);
    roll = towards(roll, wantRoll, rate, dt);
    neck.rotation.set(pitch + breath, yaw, 0);
    rear.rotation.set(-rearUp, 0, roll);
    body.scale.y = 1 + breath * 0.5;
  }

  // ---------------------------------------------------------------- one frame
  function frame(dt: number, clock: number): void {
    if (hall.round !== shownRound) reset();
    for (const e of hall.events) hearHall(e);
    hall.events.length = 0;
    pose(dt, clock);

    // The roots flood in with the overgrowth and stay. The ramp grows up with the collar's phase.
    if (hall.phase >= 1) { roots.visible = true; rootsGrow = Math.min(1, rootsGrow + dt / Math.max(0.3, STAG.rise)); roots.scale.set(rootsGrow, 1, rootsGrow); roots.position.set(chest.x - chest.x * rootsGrow + ox * rootsGrow, y, chest.z - chest.z * rootsGrow + oz * rootsGrow); }
    if (hall.phase >= 2) { ramp.visible = true; rampGrow = Math.min(1, rampGrow + dt / Math.max(0.3, STAG.rise)); ramp.scale.y = Math.max(0.02, rampGrow); }
    // Dusk falls over the rise into the overgrowth, and the morning comes back with the last lamp.
    // The hall keeps its hour while it is fought: the game's clock is put back every few seconds.
    const want = HOURS[hall.phase] as number;
    holdFor -= dt;
    if (setTime && (Math.abs(want - hour) > 0.001 || holdFor <= 0)) {
      hour += Math.sign(want - hour) * Math.min(Math.abs(want - hour), dt * 0.3);
      setTime(hour);
      holdFor = 4;
    }

    if (freedFor >= 0) {
      freedFor += dt;
      // The collar drops, then the grey runs out of the body from the antlers down.
      collar.position.y = 1.15 - Math.min(9, freedFor * freedFor * 9);
      collar.visible = freedFor < 1.2;
      drain.uDrain.value = freedFor < 0.6 ? 1000 : y + 16 - (freedFor - 0.6) * 7;
    }
    placeChains(dt);

    for (let i = 0; i < hall.lamps.length; i++) lampHeads[i]!.material = hall.lamps[i]!.broken ? bright : dark;

    // The pods, growing toward their burst, warmer at the end.
    let n = 0;
    for (const p of hall.pods) {
      const s = p.shape, k = s && s.live ? Math.min(1, s.t / s.lead) : 1, size = 0.5 + 0.8 * k;
      m.compose(point.set(p.target.x, y, p.target.z), q.setFromEuler(e.set(0, p.target.id * 1.7, 0)), dir.set(size, size * (1 + 0.08 * Math.sin(clock * 9 * k)), size));
      podMesh.setMatrixAt(n, m);
      podMesh.setColorAt(n, tint.copy(k > 0.8 ? HOT : lit).lerp(root, 1 - k));
      n++;
    }
    podMesh.count = n;
    podMesh.instanceMatrix.needsUpdate = true;
    if (podMesh.instanceColor) podMesh.instanceColor.needsUpdate = true;

    drawMarks(clock);
    for (const [id, left] of flashes) { if (left - dt <= 0) flashes.delete(id); else flashes.set(id, left - dt); }
  }

  function drawMarks(clock: number): void {
    ground.begin();
    const top = y + 0.02;
    // The dark of the overgrowth, and the light of the lamps that are lit.
    if (hall.phase === 1) {
      ground.draw(MARK.shadow, ox + 0.5, top, oz + 0.5, 0, HALL.radius * 1.5, 0, 0, SHADE, 0.6);
      for (const l of hall.lamps) if (l.broken) ground.draw(MARK.circle, l.x, top, l.z, 0, STAG.lamp.light, 0, 1, LAMP_LIGHT, 0.75, 0.35);
    }
    // Each target the hero can hit now: a ring, and its guard as a gold arc that runs down. A fresh hit flashes it.
    const marks = (t: Target, h: number): void => {
      if (!t.open || t.broken) return;
      const flash = flashes.get(t.id) ?? 0;
      ground.draw(MARK.ring, t.x, h, t.z, 0, t.radius + 0.55, 0.05, 1, PALE, 0.5 + 0.2 * Math.sin(clock * 5));
      ground.draw(MARK.ring, t.x, h, t.z, 0, t.radius + 0.55, 0.12, t.guard / t.full, flash > 0 ? RIM : GOLD, 1, flash > 0 ? 1 : 0.2);
    };
    for (const t of hall.pins) marks(t, top);
    for (const t of hall.lamps) marks(t, top);
    for (const p of hall.pods) marks(p.target, top);
    // The collar's ring lies on the top of the ramp, where it is cut from.
    const reach = HALL.ramp[HALL.ramp.length - 1] as RampCell;
    if (hall.collar.open || (hall.phase === 2 && !hall.freed)) {
      const cx = ox + reach.x - 0.5, cz = oz + reach.z + 1, h = y + reach.height + 0.03;
      ground.draw(MARK.ring, cx, h, cz, 0, 0.9, 0.05, 1, hall.collar.open ? TEAL : PALE, 0.8);
      ground.draw(MARK.ring, cx, h, cz, 0, 0.9, 0.14, hall.collar.guard / hall.collar.full, GOLD, 1, (flashes.get(hall.collar.id) ?? 0) > 0 ? 1 : 0.2);
    }
    // A shake is drawn where it lands: on each step of the vines it covers, at that step's height, over the
    // ramp's two cells. It runs north from `s.z`, and fills the same way.
    const s = shake;
    if (s && s.live) {
      const landed = s.t >= s.lead, k = landed ? 1 : s.t / s.lead, late = !landed && s.lead - s.t < 0.25;
      const alpha = landed ? Math.max(0, 1 - (s.t - s.lead) / SHAPE_AFTER) : 1, filledTo = s.reach * k;
      for (let i = 0; i < HALL.ramp.length; i += 2) {
        const c = HALL.ramp[i] as RampCell, north = oz + c.z, south = north + 1;
        const from = Math.min(south, s.z), to = Math.max(north, s.z - s.reach);
        if (from - to <= 0.01) continue;
        const along = s.z - from, length = from - to, fill = Math.max(0, Math.min(1, (filledTo - along) / length));
        ground.draw(MARK.line, ox + c.x + 1, y + c.height + 0.03, from, s.facing, length, 2.1, fill, late ? HOT : GOLD, alpha, landed ? 1 : 0);
      }
    }
    ground.end();
  }

  // ---------------------------------------------------------------- one step of the body
  const hero = view.hero;
  /** The shape of the Stag's last shake, while it is its latest attack. Shapes are a pool, so the attack says which one it is. */
  let shake: Telegraph | null = null;
  function afterStep(): void {
    const st = hall.stag;
    if (st.shape && st.attack) shake = st.attack === 'shake' ? st.shape : null;
    const want = hall.stage.ramp;
    if (want === rampOn) return;
    rampOn = want;
    setRamp(view, ox, y, oz, want);
    if (!want) return;
    // A hero standing where the vines come up is set on top of them.
    const h = hall.stage.rampAt(hero.body.x, hero.body.z);
    if (h > 0) hero.teleport(hero.body.x, y + h, hero.body.z);
  }

  function hear(e: FightEvent): void {
    if (e.type !== 'targetHit' && e.type !== 'targetBroken') return;
    const t = fight.targets.find((target) => Math.abs(target.x - e.x) < 1e-6 && Math.abs(target.z - e.z) < 1e-6) ?? null;
    if (t) { lastHit = t; flashes.set(t.id, 0.07); }
    if (e.type === 'targetHit') {
      // A hit on a target freezes the fight as a hit on a beast does, a little less for a pod.
      feel.freeze = Math.max(feel.freeze, (e.text === 'pod' ? 3 : 4) / 60);
      const high = e.text === 'collar' ? 7.5 : e.text.startsWith('lamp') ? 2.1 : 1.1;
      effect('chips', e.x, e.z, high, e.text.startsWith('lamp') ? C.lampHot : 0xfff2c8, 0.5);
      sound({ type: 'hit', at: spot });
    }
  }

  reset();
  return {
    afterStep,
    frame,
    hear,
    get lastHit() { return lastHit; },
    owns: (shape) => shape === shake,
    get freedFor() { return freedFor; },
    stag,
    triangles() {
      let n = 0;
      group.traverseVisible((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const g = mesh.geometry, each = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        const copies = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
        n += each * copies * (mesh.castShadow ? 2 : 1);
      });
      return n + ground.count * 2;
    },
  };
}

/** Sets the painted boulders on the ring round the floor. The painted look only: without it the ring stands as stone blocks. */
export function dressHall(view: GameView, ox: number, y: number, oz: number): void {
  if (!view.painted) return;
  const rock = view.standIns.get('rock');
  if (!rock) return;
  const around = Math.round((Math.PI * 2 * HALL.wall) / 2.1);
  for (let i = 0; i < around; i++) {
    const angle = (i / around) * Math.PI * 2, x = ox + 0.5 + Math.sin(angle) * (HALL.wall + 0.1), z = oz + 0.5 - Math.cos(angle) * (HALL.wall + 0.1);
    // Low stones, each turned and sized a little differently.
    rock.place(x, y, z, i * 2.1, 1.7 + (i % 3) * 0.25, i);
  }
}
