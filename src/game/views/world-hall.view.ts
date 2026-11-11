// Draws Ilara's Hall: the stone door, shut or open, the Heartstone and how brightly it glows, the dead Gate,
// the four lamps that wake with the Mark, the mural, the plinth and the broken pillars. The rules are
// src/game/hall, and where each thing stands is `HALL` in content/region.ts.
//
// Nothing is sent when a save is loaded, so the flags are read twice a second and a prop whose look has
// changed is set down again.
//
// The lume lights the ground too: one mesh of soft teal pools, under each lit lamp, round the Heartstone and
// on the doorstep, where a little of it leaks under the shut door at night. They breathe slowly, and motes
// of lume drift up from whatever is awake. When the Mark is taken in play the lamps wake one after another,
// the pair by the door first.
import * as THREE from 'three';
import type { Systems } from '../api.sim.ts';
import { HALL } from '../content/region.ts';
import type { GameView } from '../shell/view.ts';
import { worldProps } from '../worldview/props.ts';

/** Seconds between two looks at the flags. */
const EVERY = 0.2;
/** Seconds between one lamp waking and the next. */
const WAKE = 0.45;
/** Seconds between two puffs of motes. */
const MOTES = 0.6;
/** From this level the Heartstone lights the whole court. */
const BRIGHT = 10;
/** The hall's lamps stand a little taller than a town lantern's post. */
const LAMP_SIZE = 1.25;
/** How strongly the Heartstone lights the floor when it is dull, faint and awake. */
const HEART_SHINE = [0, 0.45, 1] as const;
/** Lume, the ancients' teal, as light on the ground. */
const LUME = new THREE.Color(0.16, 0.95, 0.82);

const POOL_VERTEX = /* glsl */ `
varying vec2 vAt;
varying float vStrength;
#include <fog_pars_vertex>
void main() {
  vAt = position.xz;
  // The red of an instance's colour is how strongly its pool shines.
  vStrength = instanceColor.r;
  vec4 mvPosition = viewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const POOL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vAt;
varying float vStrength;
#include <fog_pars_fragment>
void main() {
  // A soft round pool of light, brightest under the lamp.
  float d = length(vAt) * 2.0;
  float pool = pow(max(1.0 - d, 0.0), 2.0) * uStrength * vStrength;
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      pool *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      pool *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
  #endif
  gl_FragColor = vec4(uColor * pool, 1.0);
}
`;
/** The Gate's opening faces east. A prop's front faces south at no rotation. */
const EAST = Math.PI / 2;

interface Piece {
  kind: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  /** The variant to show now. */
  variant: () => number;
  handle: number;
  shown: number;
}

/** One pool of light on the ground: where, how wide, and how strongly it shines now, from 0 to 1. */
interface Pool {
  x: number;
  y: number;
  z: number;
  wide: number;
  strength: () => number;
}

export function install(view: GameView): void {
  const { game } = view;
  const { flags } = game;
  const props = worldProps(view);

  const piece = (kind: string, at: { x: number; y: number; z: number }, variant: () => number, rotation = 0, scale = 1): Piece =>
    ({ kind, x: at.x, y: at.y, z: at.z, rotation, scale, variant, handle: 0, shown: -1 });
  /** When the lamps began to wake, on the view's clock. Infinity while they are dark, long ago in a loaded game. */
  let woke = Infinity, looked = false;
  /** For each lamp, whether it has woken: the pair by the door first. */
  const lit = HALL.lamps.map((_, i) => (): number => (view.ctx.time - woke >= i * WAKE ? 1 : 0));
  const level = (): number => (game.systems as Partial<Systems>).hall?.heart().level ?? 0;
  // Dull until the Mark is on the player's hand, faint with it, and awake once the player has touched it.
  const glow = (): number => {
    if (!flags.is('mark')) return 0;
    return flags.is('heart.seen') || level() >= BRIGHT ? 2 : 1;
  };

  const pieces: Piece[] = [
    piece('shutDoor', HALL.doorAt, () => (flags.is('door.open') ? 1 : 0)),
    piece('heartstone', HALL.heartstone, glow),
    piece('gateArch', HALL.gate, () => 0, EAST),
    piece('muralSlab', HALL.mural, () => 0),
    piece('plinth', HALL.plinth, () => 0),
    ...HALL.lamps.map((at, i) => piece('hallLamp', at, lit[i], 0, LAMP_SIZE)),
    ...HALL.pillars.map((at, i) => piece('ruinPillar', at, () => at.variant, i * 1.3)),
  ];

  // ---------------------------------------------------------------- the pools of light
  const pool = (at: { x: number; y: number; z: number }, wide: number, strength: () => number, dz = 0): Pool =>
    ({ x: at.x, y: at.y, z: at.z + dz, wide, strength });
  const pools: Pool[] = [
    ...HALL.lamps.map((at, i) => pool(at, 7, lit[i])),
    // The Heartstone: a breath of light with the Mark, the whole floor before it once it has been touched.
    pool(HALL.heartstone, 11, () => HEART_SHINE[glow()] + Math.min(0.5, level() / (BRIGHT * 2)), 1.2),
    // The doorstep: a thread of lume under the shut door, and the hall's light through it once it stands open.
    pool(HALL.doorAt, 5, () => (flags.is('door.open') ? (flags.is('hall.lit') ? 0.8 : 0.4) : 0.3), 1.6),
    // The Gate is dead. Only the Mark, near it, finds a little light left in its stone.
    pool(HALL.gate, 4, () => (flags.is('mark') ? 0.25 : 0), 0),
  ];
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uColor: { value: LUME },
    uStrength: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    name: 'hall-glow',
    uniforms,
    vertexShader: POOL_VERTEX,
    fragmentShader: POOL_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material, pools.length);
  mesh.name = 'hall-glow';
  mesh.renderOrder = 2;
  // The pools are few and in one place. One box around them all is not worth keeping up to date.
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  view.scene.add(mesh);
  const matrix = new THREE.Matrix4(), at = new THREE.Vector3(), size = new THREE.Vector3(), FLAT = new THREE.Quaternion();
  const shine = new THREE.Color();
  /** Further than this from the door, in blocks, nothing of the Hall's light is drawn. */
  const FAR = 96;

  function setPools(): void {
    let any = false;
    for (let i = 0; i < pools.length; i++) {
      const p = pools[i], strength = p.strength();
      if (strength > 0) any = true;
      // Just over the paving, or over the painted ground outside the door.
      at.set(p.x, p.y + view.lift(p.x, p.y, p.z) + 0.04, p.z);
      mesh.setMatrixAt(i, matrix.compose(at, FLAT, size.set(p.wide, 1, p.wide)));
      mesh.setColorAt(i, shine.setRGB(strength, 0, 0));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    lightUp = any;
  }
  let lightUp = false;
  setPools();

  // What is awake gives off motes: the Heartstone, then each lamp in turn.
  const from = { x: 0, y: 0, z: 0 };
  let puff = 0, turn = 0;
  function motes(): void {
    turn = (turn + 1) % (HALL.lamps.length + 2);
    // The Heartstone has two turns in each round.
    const lamp = turn - 2;
    if (lamp < 0) {
      if (glow() === 0) return;
      from.x = HALL.heartstone.x; from.y = HALL.heartstone.y + 0.6; from.z = HALL.heartstone.z + 0.4;
    } else {
      if (lit[lamp]() === 0) return;
      const at = HALL.lamps[lamp];
      from.x = at.x; from.y = at.y + 1.2; from.z = at.z;
    }
    view.effects.play('lume', from);
  }

  let since = EVERY;
  view.onFrame((dt) => {
    // By day the lume is faint. At night it is what you see first. It breathes, slowly.
    const player = game.player.pos;
    mesh.visible = lightUp && Math.abs(player.x - HALL.doorAt.x) < FAR && Math.abs(player.z - HALL.doorAt.z) < FAR;
    uniforms.uStrength.value = (0.1 + 0.5 * view.sky.look.night) * (1 + 0.12 * Math.sin(view.ctx.time * 0.9));
    puff += dt;
    if (puff >= MOTES && mesh.visible) {
      puff = 0;
      motes();
    }
    since += dt;
    if (since < EVERY) return;
    since = 0;
    if (!flags.is('hall.lit')) woke = Infinity;
    else if (woke === Infinity) woke = looked ? view.ctx.time : -Infinity;
    looked = true;
    for (const p of pieces) {
      if (!props.has(p.kind)) continue;
      const variant = p.variant();
      if (variant === p.shown) continue;
      props.remove(p.handle);
      p.handle = props.place(p.kind, variant, p.x, p.y, p.z, p.rotation, p.scale, true);
      p.shown = variant;
    }
    setPools();
  });
}
