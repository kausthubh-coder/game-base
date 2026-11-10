// The festival's lamps on the river. When the player floats a lamp (the flag `festival.lamp`), a small
// glowing lamp sets off from the water by the place `river.bank` and drifts downstream. During the
// festival the town floats a dozen more, a few seconds apart.
//
// Two draw calls for all of them: the lamps, and the light each one lays on the water.
// Without a region, or without the place `river.bank`, nothing is drawn.
import * as THREE from 'three';
import type { Vec3 } from '../../engine/types.ts';
import type { GameView } from '../shell/view.ts';
import { waterTop } from '../worldview/props.ts';
import { placeAt } from '../worldview/region.ts';

/** Lamps the town floats during the festival. */
const TOWN_LAMPS = 12;
/** Seconds from one of the town's lamps to the next: at least this, and up to this much more. */
const TOWN_GAP = 2.5, TOWN_GAP_MORE = 2;
/** The player may float more than one. This many are drawn. */
const PLAYER_LAMPS = 8;
const CAPACITY = TOWN_LAMPS + PLAYER_LAMPS;
/** Blocks a second while a lamp is carried out from the bank. The Mere is slow. */
const DRIFT = 0.3;
/** After its first stretch a lamp creeps at this share of its pace, so the river by the bank stays lit all evening. */
const CREEP = 0.1;
/** How many blocks the first stretch is: the player's lamp, and the least and the most for one of the town's. */
const PLAYER_STRETCH = 4, TOWN_STRETCH = 1, TOWN_STRETCH_MORE = 8;
/** A lamp looks this far ahead for water, in blocks. */
const AHEAD = 0.9;
/** Water is looked for this far from the bank, in blocks. */
const SEARCH = 10;
/** The town's lamps go in within this many blocks of the launch point, up the river and down. */
const TOWN_SPREAD = 6;
/** The ways a lamp may turn to stay on the water, tried in order, in radians. */
const TURNS = [0, 0.4, -0.4, 0.8, -0.8, 1.25, -1.25, 1.7, -1.7];

interface Lamp {
  x: number;
  z: number;
  /** The water's surface under it. */
  y: number;
  /** The way it drifts, as a direction on the ground. */
  dx: number;
  dz: number;
  speed: number;
  /** A number of its own, so no two bob together. */
  own: number;
  /** Seconds since it was set on the water. */
  age: number;
  /** Blocks it has drifted, and how many it drifts before it slows to a creep. */
  gone: number;
  stretch: number;
  /** False once it has come to rest against a bank. */
  drifting: boolean;
  /** True for a lamp the town floated, false for the player's. */
  town: boolean;
}

/** Where lamps are set on the water, the way the river runs from there, and the point downstream they make for. */
interface Launch extends Vec3 {
  dx: number;
  dz: number;
  goal: { x: number; z: number } | null;
}

/** The lamp: a small raft, a paper shade that glows, a dark lid. Sizes are in blocks. */
function lampGeometry(): THREE.BufferGeometry {
  const parts: [w: number, h: number, y: number, r: number, g: number, b: number][] = [
    [0.54, 0.06, 0, 0.16, 0.1, 0.06],
    // Brighter than white, so the bloom of the final picture catches it.
    [0.32, 0.34, 0.06, 1.9, 1.0, 0.34],
    [0.38, 0.04, 0.4, 0.2, 0.12, 0.07],
  ];
  const positions: number[] = [], colors: number[] = [], index: number[] = [];
  for (const [w, h, y, r, g, b] of parts) {
    const box = new THREE.BoxGeometry(w, h, w).translate(0, y + h / 2, 0);
    const first = positions.length / 3;
    const at = box.getAttribute('position');
    for (let i = 0; i < at.count; i++) {
      positions.push(at.getX(i), at.getY(i), at.getZ(i));
      colors.push(r, g, b);
    }
    for (const i of box.getIndex()!.array) index.push(first + i);
    box.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(index);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

const GLOW_VERTEX = /* glsl */ `
varying vec2 vAt;
#include <fog_pars_vertex>
void main() {
  vAt = position.xz;
  vec4 mvPosition = viewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vAt;
#include <fog_pars_fragment>
void main() {
  // A soft round pool of light, brightest under the lamp.
  float d = length(vAt) * 2.0;
  float pool = pow(max(1.0 - d, 0.0), 2.0) * uStrength;
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

export function install(view: GameView): void {
  const { game } = view;
  const sim = view.world.sim;
  const lamps: Lamp[] = [];
  let playerLamps = 0, townLamps = 0;
  /** Seconds until the town floats its next lamp. Negative when the town is not floating any. */
  let townWait = -1;
  /** Null until the land by the bank is loaded. */
  let launch: Launch | null = null;
  /** True once the morning after the festival has taken the town's lamps away. */
  let cleared = false;
  let seed = 0x9e3779b9;
  const random = (): number => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };

  // ---------------------------------------------------------------- the two meshes
  const lampMesh = new THREE.InstancedMesh(lampGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), CAPACITY);
  const glowUniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uColor: { value: new THREE.Color(1.0, 0.62, 0.24) },
    uStrength: { value: 0 },
  };
  const glowMaterial = new THREE.ShaderMaterial({
    name: 'river-lamp-glow',
    uniforms: glowUniforms,
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
    toneMapped: false,
  });
  const glowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const glowMesh = new THREE.InstancedMesh(glowGeometry, glowMaterial, CAPACITY);
  lampMesh.name = 'river-lamps';
  glowMesh.name = 'river-lamp-glow';
  // After the water, which is see-through too, so the light lies on it.
  glowMesh.renderOrder = 2;
  for (const mesh of [lampMesh, glowMesh]) {
    mesh.count = 0;
    mesh.visible = false;
    // The lamps are few and in one place. One box around them all is not worth keeping up to date.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    view.scene.add(mesh);
  }

  // ---------------------------------------------------------------- the river
  const isWater = (x: number, z: number): boolean => sim.isLoaded(x, z) && sim.surfaceAt(x, z) === 'water';

  /** How many blocks of water lie ahead of a point in a direction, up to `limit`. */
  function run(x: number, z: number, dx: number, dz: number, limit: number): number {
    let far = 0;
    while (far < limit && isWater(x + dx * (far + 1), z + dz * (far + 1))) far++;
    return far;
  }

  /** Finds the water nearest the bank and the way the river runs from it. Null while the land there is not loaded. */
  function findLaunch(): Launch | null {
    if (launch) return launch;
    const bank = placeAt(game, 'river.bank');
    if (!bank || !sim.isLoaded(bank.x, bank.z)) return null;
    const bx = Math.floor(bank.x) + 0.5, bz = Math.floor(bank.z) + 0.5;
    let best = Infinity, x = 0, z = 0;
    for (let ox = -SEARCH; ox <= SEARCH; ox++) {
      for (let oz = -SEARCH; oz <= SEARCH; oz++) {
        const d = ox * ox + oz * oz;
        // Two blocks out from the bank at least, so the lamp is on open water and not in the reeds.
        if (d >= best || d < 4 || !isWater(bx + ox, bz + oz)) continue;
        best = d; x = bx + ox; z = bz + oz;
      }
    }
    if (best === Infinity) return null;
    // Downstream is toward the ferry, a dock down the river. Without one, it is the longest stretch of open water.
    const ferry = placeAt(game, 'ferry');
    let dx = 0, dz = 0, goal: Launch['goal'] = null;
    if (ferry && Math.hypot(ferry.x - x, ferry.z - z) > 4) {
      goal = { x: ferry.x, z: ferry.z };
      const far = Math.hypot(ferry.x - x, ferry.z - z);
      dx = (ferry.x - x) / far;
      dz = (ferry.z - z) / far;
    } else {
      let longest = -1;
      for (let k = 0; k < 16; k++) {
        const tx = Math.cos((k * Math.PI) / 8), tz = Math.sin((k * Math.PI) / 8);
        const far = run(x, z, tx, tz, 48);
        if (far > longest) { longest = far; dx = tx; dz = tz; }
      }
    }
    launch = { x, y: waterTop(view, x, z) ?? bank.y, z, dx, dz, goal };
    return launch;
  }

  /** Sets one lamp on the water. The town's lamps go in along the bank, the player's at the launch point. False when there is no river to set it on yet. */
  function float(town: boolean): boolean {
    const from = findLaunch();
    if (lamps.length >= CAPACITY || !from) return false;
    let x = from.x, z = from.z;
    for (let tries = 0; town && tries < 6; tries++) {
      const tx = from.x + (random() * 2 - 1) * TOWN_SPREAD, tz = from.z + (random() * 2 - 1) * TOWN_SPREAD;
      if (!isWater(tx, tz)) continue;
      x = tx; z = tz;
      break;
    }
    lamps.push({
      x, z, y: waterTop(view, x, z) ?? from.y, dx: from.dx, dz: from.dz,
      speed: DRIFT * (0.8 + 0.4 * random()), own: random(), age: 0, gone: 0,
      stretch: town ? TOWN_STRETCH + random() * TOWN_STRETCH_MORE : PLAYER_STRETCH, drifting: true, town,
    });
    return true;
  }

  // ---------------------------------------------------------------- what the story says
  /** Brings the lamps in line with the flags. A loaded game sets flags without an event, so this also runs now and then. */
  function sync(): void {
    const flags = game.flags;
    const over = flags.is('festival.over');
    if (over && !cleared) {
      // The morning after: the river has carried the town's lamps off. The player's own stays, and a late one still floats.
      for (let i = lamps.length - 1; i >= 0; i--) if (lamps[i].town) lamps.splice(i, 1);
      cleared = true;
      townWait = -1;
    }
    const floated = flags.is('festival.lamp') ? Math.max(1, Number(flags.get('festival.lamps')) || 0) : 0;
    while (playerLamps < Math.min(floated, PLAYER_LAMPS) && float(false)) playerLamps++;
    if (flags.is('festival.started') && !over && townLamps < TOWN_LAMPS && townWait < 0) townWait = 1.5;
  }

  game.events.on('flag.changed', ({ flag }) => {
    if (flag.startsWith('festival.')) sync();
  });
  game.events.on('festival.started', sync);

  // ---------------------------------------------------------------- drifting, on the game's clock
  let sinceSync = 0;
  view.onSimStep((dt) => {
    if ((sinceSync += dt) >= 1) {
      sinceSync = 0;
      sync();
    }
    if (townWait >= 0 && (townWait -= dt) < 0) {
      if (float(true)) townLamps++;
      townWait = townLamps < TOWN_LAMPS ? TOWN_GAP + random() * TOWN_GAP_MORE : -1;
    }
    for (let i = 0; i < lamps.length; i++) {
      const lamp = lamps[i];
      lamp.age += dt;
      if (!lamp.drifting) continue;
      // The land ahead is not loaded: the lamp waits for it.
      if (!sim.isLoaded(lamp.x + lamp.dx * AHEAD, lamp.z + lamp.dz * AHEAD)) continue;
      // Steer for the point downstream while it is far, then straight on, and around whatever is in the way.
      const goal = launch?.goal;
      const base = goal && Math.hypot(goal.x - lamp.x, goal.z - lamp.z) > 6 ? Math.atan2(goal.z - lamp.z, goal.x - lamp.x) : Math.atan2(lamp.dz, lamp.dx);
      let moved = false;
      for (let t = 0; t < TURNS.length && !moved; t++) {
        const tx = Math.cos(base + TURNS[t]), tz = Math.sin(base + TURNS[t]);
        if (!isWater(lamp.x + tx * AHEAD, lamp.z + tz * AHEAD)) continue;
        // Turn a little each step, so a lamp rounds a bend and does not snap.
        lamp.dx += (tx - lamp.dx) * 0.08;
        lamp.dz += (tz - lamp.dz) * 0.08;
        const length = Math.hypot(lamp.dx, lamp.dz) || 1;
        lamp.dx /= length; lamp.dz /= length;
        // Out from the bank at its own pace, slowing over the last two blocks of the stretch to a creep.
        const pace = lamp.speed * Math.max(CREEP, Math.min(1, (lamp.stretch - lamp.gone) / 2));
        const nx = lamp.x + lamp.dx * pace * dt, nz = lamp.z + lamp.dz * pace * dt;
        if (isWater(nx, nz)) { lamp.x = nx; lamp.z = nz; lamp.gone += pace * dt; }
        moved = true;
      }
      // Water on no side: it has come to rest against the bank.
      if (!moved) lamp.drifting = false;
    }
  });

  // ---------------------------------------------------------------- drawing
  const matrix = new THREE.Matrix4(), turn = new THREE.Quaternion(), at = new THREE.Vector3(), size = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), FLAT = new THREE.Quaternion();
  let drawn = 0;

  view.onFrame(() => {
    const count = lamps.length;
    if (count === 0 && drawn === 0) return;
    const time = view.ctx.time;
    for (let i = 0; i < count; i++) {
      const lamp = lamps[i];
      // It rises out of the hand onto the water in its first half second, then bobs and slowly turns.
      const grow = Math.min(1, lamp.age / 0.5);
      const bob = Math.sin(time * 1.6 + lamp.own * 6.2832) * 0.025;
      at.set(lamp.x, lamp.y - 0.02 + bob, lamp.z);
      turn.setFromAxisAngle(UP, lamp.own * 6.2832 + time * 0.15 * (lamp.own - 0.5));
      lampMesh.setMatrixAt(i, matrix.compose(at, turn, size.setScalar(grow)));
      // The pool of light lies on the water and breathes a little, like a flame.
      const pool = 2.6 * grow * (1 + 0.06 * Math.sin(time * 5.1 + lamp.own * 40));
      at.y = lamp.y + 0.015;
      glowMesh.setMatrixAt(i, matrix.compose(at, FLAT, size.set(pool, 1, pool)));
    }
    drawn = count;
    lampMesh.count = glowMesh.count = count;
    lampMesh.visible = glowMesh.visible = count > 0;
    lampMesh.instanceMatrix.needsUpdate = glowMesh.instanceMatrix.needsUpdate = true;
    // By day the pool of light is faint. At night it is what you see first.
    glowUniforms.uStrength.value = 0.08 + 0.3 * view.sky.look.night;
  });
}
