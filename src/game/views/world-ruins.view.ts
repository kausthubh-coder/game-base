// Draws the ruins (src/game/ruins): the room the hero is in, dressed with the props its plan lists in the state the
// room is in (a lever pulled, a machine rebuilt, an eye lit, a root lock gone); the memory stones and keystones; the
// water in the Pump House's trench; the rope down from the Old Gate; the Old Gate standing open; and the shrine's
// pick, heart or stamina, in the settlement's paper panel.
//
// It also carries the hero through a door: on `ruins.moved` the land round the new place is made at once, the body
// is set down there and the camera with it, behind a short fade to dark and back.
//
// The three vaults are drawn as kits (ruins-kits.ts, src/features/props/builders/rooms.ts), each underground in its
// own light; this view moves their machines, runs their water and keeps the memory stones and keystones.
import * as THREE from 'three';
import { propDef, type PropKind } from '../../content/props.ts';
import { QUALITY } from '../../content/quality.ts';
import { createProps } from '../../features/props/index.ts';
import { paint, shared } from '../../features/painted/index.ts';
import { vaultKeystone, vaultMemoryStone, vaultMovingParts } from '../../features/props/builders/rooms.ts';
import { oldGateParts } from '../../features/props/builders/group-2.ts';
import { groundHeight } from '../../features/world/index.ts';
import type { RuinsView, Systems } from '../api.sim.ts';
import { FLAG } from '../content/flags.ts';
import type { MemoryId, ShrineId, VaultId } from '../content/ids.ts';
import { PLACES, toWorld } from '../content/greenhollow.ts';
import { landmarkSites } from '../region/greenhollow-land.sim.ts';
import { AT, VAULT, VAULTS, pointOf } from '../ruins/index.sim.ts';
import { GALLERY_EYES, ROOMS, ROOM_DEFS, roomOf, roomOrigin, type RoomDef, type RoomId, type RoomProp } from '../ruins/rooms.sim.ts';
import type { GameView } from '../shell/view.ts';
import { KIT_ROOMS, kitOf, replaceVaultParts } from './ruins-kits.ts';
import { bookOf } from '../uiview/book.ts';
import { button, el, homePanel, rule } from '../uiview/home-panel.ts';
import { addStyle } from '../uiview/theme.ts';
import { worldProps } from '../worldview/props.ts';

/** Chunks made at once round where the hero is set down, each way. */
const LOAD_REACH = 3;
/** Seconds of the fade to dark and back. */
const FADE = 0.45;
/** Blocks over the floor a plinth's top is. */
const PLINTH_TOP = 1.02;

const STYLE = /* css */ `
.ui-book .rn-fade { position: absolute; inset: 0; z-index: 30; background: #0d0b10; opacity: 0; pointer-events: none; transition: opacity ${FADE}s ease; }
.ui-book .rn-fade.is-dark { opacity: 1; transition: none; }
.ui-book .rn-gift { font-size: 2.1em; line-height: 1; }
.ui-book .rn-title { padding: 0 40px; }
.ui-book .rn-dark { position: absolute; left: 0; top: 0; width: 400vmax; height: 400vmax; margin: -200vmax 0 0 -200vmax; z-index: 0; pointer-events: none;
  background: radial-gradient(circle at 50% 50%, rgb(14 11 22 / 0) 0, rgb(14 11 22 / 0) 70px, rgb(14 11 22 / 0.9) 300px); opacity: 0; transition: opacity 0.8s ease; will-change: transform, opacity; }
`;

const SHRINE_NAMES: Readonly<Record<ShrineId, string>> = Object.fromEntries(PLACES.filter((p) => p.kind === 'shrine').map((p) => [p.id, p.name])) as Record<ShrineId, string>;

export function install(view: GameView): void {
  const { game } = view;
  const sys = game.systems as Partial<Systems>;
  const ruins = sys.ruins;
  if (!ruins?.view) return;
  const seed = view.world.sim.seed;
  const book = bookOf(view);
  addStyle(view.root, 'ruins', STYLE);

  // ---------------------------------------------------------------- through a door
  const fade = el('div', 'rn-fade');
  view.root.append(fade);
  game.events.on('ruins.moved', ({ x, y, z, facing }) => {
    fade.classList.add('is-dark');
    const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
    for (let dx = -LOAD_REACH; dx <= LOAD_REACH; dx++) for (let dz = -LOAD_REACH; dz <= LOAD_REACH; dz++) view.world.sim.load(cx + dx, cz + dz);
    view.hero.teleport(x, y, z, facing);
    view.camera.follow(x, y, z);
    view.camera.snap();
    view.world.setFocus(x, z);
    view.water.setFocus({ x, y, z });
    requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.remove('is-dark')));
    dressed = '';
  });

  // ---------------------------------------------------------------- the dark gallery
  // The Lamp Gallery is dark but for the lamp the hero carries in: a pool of light round them, until the eyes have
  // lit the gallery's twelve lamps one pair after another.
  const dark = el('div', 'rn-dark');
  view.root.prepend(dark);
  const screen = { x: 0, y: 0 };
  let darkX = NaN, darkY = NaN, darkShade = 0;

  // ---------------------------------------------------------------- the room's props
  const props = worldProps(view);
  /** The vault kits (ruins-kits.ts): props of their own, drawn only while the hero is in a vault. */
  const kits = createProps(view.ctx, { vary: false, thin: false, painted: true });
  kits.group.name = 'vault-kits';
  kits.group.visible = false;
  let handles: number[] = [];
  /** The room and state the props now stand for. */
  let dressed = '';

  const variantOf = (kind: string, name?: string): number => (name ? Math.max(0, propDef(kind as never).variants.indexOf(name)) : 0);
  function stand(room: RoomDef, p: RoomProp, variant?: string): void {
    if (!props.has(p.kind)) return;
    const o = roomOrigin(room), x = o.x + p.x, z = o.z + p.z, y = ROOMS.ground + (p.y ?? 0);
    const handle = props.place(p.kind, variantOf(p.kind, variant ?? p.variant), x, y + view.lift(x, y, z), z, p.turn ?? 0, p.scale ?? 1, true);
    if (handle) handles.push(handle);
  }

  /** The props of a room in the state it is in. */
  function dress(room: RoomDef, v: RuinsView): void {
    for (const h of handles) props.remove(h);
    handles = [];
    kits.clear();
    pods.clear();
    if (KIT_ROOMS.has(room.id)) {
      const o = roomOrigin(room);
      for (const p of kitOf(room, { lever: v.lever, eyes: v.eyes })) kits.place(p.kind as PropKind, variantOf(p.kind, p.variant), { x: o.x + p.x, y: ROOMS.ground + (p.y ?? 0), z: o.z + p.z }, p.turn ?? 0, p.scale ?? 1);
      pools();
      return;
    }
    const level = room.id.startsWith('rootworks-') ? Number(room.id.slice(-1)) - 1 : -1;
    const fixed = level >= 0 && v.machines[level];
    for (const p of room.props) {
      // A root lock's roots are gone once its machine moved.
      if (fixed && p.kind === 'giantRoot' && p.z < 3) continue;
      let variant = p.variant;
      if (level >= 0 && p.variant === 'starved') variant = fixed ? 'working' : 'starved';
      stand(room, p, variant);
    }
  }

  // ---------------------------------------------------------------- a vault's own light
  // A vault is underground. While the hero is in one, nothing of the world above is drawn: the kit's dark rock stands
  // round the room, the picture's ground is the dark, and the painted light is the room's own, from the upper left
  // as the sheets paint it: warm lamplight in the Pump House, dark in the Lamp Gallery until its lamps wake, green
  // gloom in the Seed Vault.
  /** What is still drawn in a vault: the kit, this view's own things, and whoever stands in the room. */
  const INDOORS = new Set(['vault-kits', 'ruins', 'hero', 'sprites', 'sprite-shadows', 'effects', 'aim', 'ghost', 'waypoint-beam']);
  const indoors = (object: THREE.Object3D): boolean => (object as THREE.Light).isLight === true || INDOORS.has(object.name) || object.name.startsWith('fight-') || object.name.startsWith('toon');
  type RGB = readonly [number, number, number];
  interface Mood { key: RGB; shade: RGB; back: number }
  const MOODS: Readonly<Record<string, Mood>> = {
    'pump-upper': { key: [1.06, 0.9, 0.66], shade: [0.52, 0.45, 0.53], back: 0x15121a },
    'pump-lower': { key: [1.02, 0.85, 0.6], shade: [0.47, 0.41, 0.52], back: 0x120f18 },
    gallery: { key: [1, 0.84, 0.62], shade: [0.47, 0.4, 0.55], back: 0x100e18 },
    seedvault: { key: [1.03, 0.92, 0.66], shade: [0.42, 0.46, 0.43], back: 0x0f130f },
  };
  /** The gallery before its lamps wake. */
  const UNLIT: Mood = { key: [0.3, 0.27, 0.44], shade: [0.17, 0.16, 0.28], back: 0x0a0912 };
  /** Where the light comes from in a vault, toward it. */
  const LIGHT_FROM = new THREE.Vector3(-0.42, 0.72, 0.55).normalize();
  /** How far off the light stands, as the sky's own does. */
  const LIGHT_FAR = 120;
  const hidden = new Map<THREE.Object3D, boolean>();
  const dim = new THREE.Color();
  let skyBefore = view.scene.background;
  let underground = false;
  function environment(room: RoomDef | null, eyes: number): void {
    const mood = room ? MOODS[room.id] : undefined;
    if (!mood) {
      if (underground) {
        for (const [object, visible] of hidden) object.visible = visible;
        hidden.clear();
        view.scene.background = skyBefore;
        kits.group.visible = false;
        underground = false;
      }
      return;
    }
    if (!underground) skyBefore = view.scene.background;
    underground = true;
    kits.group.visible = true;
    // Whatever else the scene holds is the world above, and other views may show it again each frame.
    for (const object of view.scene.children) {
      if (indoors(object)) continue;
      if (!hidden.has(object)) hidden.set(object, object.visible);
      object.visible = false;
    }
    const awake = room?.id === 'gallery' ? eyes / GALLERY_EYES.length : 1, mix = (a: number, b: number): number => a + (b - a) * awake;
    dim.setHex(mood.back).lerp(tint.setHex(UNLIT.back), 1 - awake);
    view.scene.background = dim;
    shared.uSunTint.value.setRGB(mix(UNLIT.key[0], mood.key[0]), mix(UNLIT.key[1], mood.key[1]), mix(UNLIT.key[2], mood.key[2]));
    shared.uShadeTint.value.setRGB(mix(UNLIT.shade[0], mood.shade[0]), mix(UNLIT.shade[1], mood.shade[1]), mix(UNLIT.shade[2], mood.shade[2]));
    shared.uSkyAdd.value.setRGB(0, 0, 0);
    shared.uLamp.value.setRGB(1, 0.72, 0.4);
    shared.uCloudShade.value = 0;
    // The rock falls away into the dark: what is far from the hero is the colour of the dark.
    const p = view.playerPosition, reach = view.ctx.camera.position.distanceTo(tint3.set(p.x, p.y, p.z));
    shared.uHaze.value.copy(dim);
    shared.uHazeNear.value.copy(dim);
    shared.uHazeGlow.value = 0;
    shared.uHazeStart.value = reach + 9;
    shared.uHazeDensity.value = 0.045;
    shared.uHazeMax.value = 0.9;
    const sun = view.scene.getObjectByName('sun') as THREE.DirectionalLight | undefined;
    const fill = view.scene.getObjectByName('sky-fill') as THREE.HemisphereLight | undefined;
    if (sun) {
      sun.position.copy(sun.target.position).addScaledVector(LIGHT_FROM, LIGHT_FAR);
      sun.color.setRGB(1, 0.84, 0.6);
      sun.intensity = mix(0.35, 1.05);
      sun.shadow.intensity = 0.8;
      shared.uSunRaw.value = sun.intensity;
    }
    shared.uSunDir.value.copy(LIGHT_FROM);
    if (fill) { fill.intensity = mix(0.3, 0.75); fill.color.setRGB(0.78, 0.7, 0.82); fill.groundColor.setRGB(0.42, 0.36, 0.4); }
    if (view.scene.fog instanceof THREE.Fog) { view.scene.fog.color.copy(dim); view.scene.fog.near = reach + 12; view.scene.fog.far = reach + 70; }
  }
  const tint = new THREE.Color(), tint3 = new THREE.Vector3();

  // ---------------------------------------------------------------- stones, keystones, the rope, the trench's water
  const group = new THREE.Group();
  group.name = 'ruins';
  view.scene.add(group);
  let detail = QUALITY[view.ctx.quality].propDetail;
  let parts = vaultMovingParts(detail);
  /** What the game moves is painted as the kit is. */
  const machine = paint({ vertexColors: true, brush: 0.2, bands: 0.45, wrap: 0.3 });

  // Lamplight: a pool on the floor under every lit lamp of a kit, and a halo round the lamp itself.
  const GLOW = /* glsl */ `varying vec2 vUv; uniform float uTime, uStrength;
    void main() { float r = length(vUv - 0.5) * 2.0, a = pow(max(0.0, 1.0 - r), 2.2) * uStrength * (0.94 + 0.06 * sin(uTime * 3.1));
      gl_FragColor = vec4(1.0, 0.62, 0.24, 1.0) * a; }`;
  const glowClock = { value: 0 };
  const glowOf = (vertex: string, strength: number): THREE.ShaderMaterial => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: glowClock, uStrength: { value: strength } }, vertexShader: vertex, fragmentShader: GLOW,
  });
  const LIGHTS = 64;
  const poolMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(6.4, 6.4).rotateX(-Math.PI / 2), glowOf(/* glsl */ `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`, 0.48), LIGHTS);
  const haloMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.6, 2.6), glowOf(/* glsl */ `varying vec2 vUv;
    void main() { vUv = uv; vec4 at = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); at.xy += position.xy; gl_Position = projectionMatrix * at; }`, 0.55), LIGHTS);
  poolMesh.name = 'vault: lamp pools';
  haloMesh.name = 'vault: lamp halos';
  for (const mesh of [poolMesh, haloMesh]) { mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.visible = false; group.add(mesh); }
  const place = new THREE.Matrix4();
  function pools(): void {
    let i = 0;
    for (const l of kits.lights()) {
      if (i >= LIGHTS) break;
      poolMesh.setMatrixAt(i, place.makeTranslation(l.x, ROOMS.ground + 0.07, l.z));
      haloMesh.setMatrixAt(i++, place.makeTranslation(l.x, l.y, l.z));
    }
    poolMesh.count = haloMesh.count = i;
    poolMesh.instanceMatrix.needsUpdate = haloMesh.instanceMatrix.needsUpdate = true;
  }

  const stoneGeometry = vaultMemoryStone(detail);
  const dull = new THREE.MeshLambertMaterial({ color: 0x9c91a7 });
  const warm = new THREE.MeshLambertMaterial({ color: 0xc9b6c8, emissive: 0xf0c98a, emissiveIntensity: 0.65 });
  // The keystone stands on its edge, its leaf toward the south.
  const keyGeometry = vaultKeystone(0, null, detail).rotateX(Math.PI / 2);
  const brass = new THREE.MeshLambertMaterial({ color: 0xb58c47 });
  const ropeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 6).translate(0, 0.5, 0);
  const rope = new THREE.MeshLambertMaterial({ color: 0x98613c });

  interface Stone { id: MemoryId; mesh: THREE.Mesh; vault: VaultId | null }
  const stones: Stone[] = [];
  function addStone(id: MemoryId, x: number, y: number, z: number, vault: VaultId | null): void {
    const mesh = new THREE.Mesh(stoneGeometry, dull);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    stones.push({ id, mesh, vault });
  }
  // In the world: under the mural, and by the two small ruins.
  const hallStone = AT.stoneHall as { x: number; z: number };
  addStone('hall', hallStone.x, groundHeight(seed, Math.floor(hallStone.x), Math.floor(hallStone.z)), hallStone.z, null);
  for (const id of ['ruin-tower', 'ruin-stair'] as const) {
    const place = PLACES.find((p) => p.id === id)!;
    const stand = placeOf(id) ?? toWorld(place.at);
    addStone(id, stand.x + 2, groundHeight(seed, Math.floor(stand.x + 2), Math.floor(stand.z + 1)), stand.z + 1, null);
  }
  // On each vault's dais, and its keystone beside it.
  const keys = new Map<VaultId, THREE.Mesh>();
  for (const v of VAULTS) {
    const room = roomOf(VAULT[v].room), o = roomOrigin(room);
    const [mx, mz] = room.spots.memory, [kx, kz] = room.spots.keystone;
    addStone(v, o.x + mx, ROOMS.ground + PLINTH_TOP, o.z + mz - 0.3, v);
    const key = new THREE.Mesh(keyGeometry, machine);
    key.position.set(o.x + kx, ROOMS.ground + PLINTH_TOP + 0.38, o.z + kz - 0.3);
    key.castShadow = true;
    group.add(key);
    keys.set(v, key);
  }
  function placeOf(name: string): { x: number; z: number } | null {
    try {
      const at = sys.region?.place(name).at;
      return at ? { x: at.x, z: at.z } : null;
    } catch {
      return null;
    }
  }

  // The rope: down from the Old Gate's ring once the hero has gone down, and up out of each level's landing.
  const ropes: THREE.Mesh[] = [];
  for (let level = 1; level <= 3; level++) {
    const room = roomOf(`rootworks-${level}` as RoomId), o = roomOrigin(room), [ux, uz] = room.spots.up;
    const r = new THREE.Mesh(ropeGeometry, rope);
    r.position.set(o.x + ux, ROOMS.ground, o.z + uz + 0.2);
    r.scale.set(1, 10, 1);
    group.add(r);
    ropes.push(r);
  }
  const gateRope = new THREE.Mesh(ropeGeometry, rope);
  {
    const g = pointOf('gate');
    gateRope.position.set(g.x + 1.6, groundHeight(seed, Math.floor(g.x), Math.floor(g.z)) - 0.2, g.z - 0.6);
    gateRope.scale.set(1, 1.6, 1);
    gateRope.rotation.z = 0.25;
    group.add(gateRope);
  }

  /** A part the game moves, at a place of a room, hidden until its room is the one drawn. */
  function moving(geometry: THREE.BufferGeometry, room: RoomDef, x: number, y: number, z: number, material: THREE.Material = machine): THREE.Mesh {
    const o = roomOrigin(room), mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(o.x + x, ROOMS.ground + y, o.z + z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  }
  /** A gear stood on its edge to turn about x: the group stands it up, the gear in it turns. */
  function upright(geometry: THREE.BufferGeometry, room: RoomDef, x: number, y: number, z: number): THREE.Mesh {
    const stand = new THREE.Group(), gear = moving(geometry, room, x, y, z);
    stand.position.copy(gear.position);
    gear.position.set(0, 0, 0);
    stand.rotation.z = Math.PI / 2;
    stand.add(gear);
    group.add(stand);
    return gear;
  }

  // The shaft from the great wheel through the Pump House's west wall, turning in its bearings, the gears it turns
  // against the wall, and the crank from it down to the lever on its dais.
  const upper = roomOf('pump-upper'), lower = roomOf('pump-lower');
  const [shaftX, shaftZ] = upper.spots.shaft, [leverX] = upper.spots.lever;
  const shaft = moving(parts.shaft, upper, shaftX + 4.65, 0.78, shaftZ);
  const crank = moving(new THREE.CylinderGeometry(0.09, 0.09, 2.9, 10).rotateX(Math.PI / 2), upper, leverX, 0.78, shaftZ + 1.45, brass);
  const pinion = upright(parts.pinion, upper, 2.7, 0.78, shaftZ), wheel = upright(parts.gear, upper, 2.7, 2.28, shaftZ - 0.96);
  const axle = moving(new THREE.CylinderGeometry(0.11, 0.11, 1.9, 8).rotateZ(Math.PI / 2), upper, 1.9, 2.28, shaftZ - 0.96, brass);
  // Below: the gear on the foot of the shaft that comes down from above, and the small one it drives.
  const turbine = moving(parts.gear, lower, 7.75, 1.5, 1.95), follower = moving(parts.pinion, lower, 9.53, 1.5, 1.95);
  const post = moving(new THREE.CylinderGeometry(0.09, 0.12, 1.6, 8).translate(0, -0.8, 0), lower, 9.53, 1.6, 1.95, brass);
  const upperParts = [shaft, crank, pinion, wheel, axle], lowerParts = [turbine, follower, post];

  // The water. The trench is drawn sunk, with a little water always in it: it runs east, from the inlet's fall to the
  // outlet's, and stands higher and runs faster where the keeper's rule floods a channel. Each sluice has its flume.
  const waterClock = { value: 0 };
  const WATER_VERTEX = /* glsl */ `varying vec2 vUv; varying vec3 vWorld;
    void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const WATER = /* glsl */ `uniform float uTime, uFlood, uFall, uWide, uSplash; uniform vec2 uFlow; varying vec2 vUv; varying vec3 vWorld;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main() {
      if (uFall > 0.5) {
        // A falling sheet: streaks running down it, thin at its edges.
        float x = vUv.x * uWide * 3.2, streak = noise(vec2(x, vUv.y * 2.6 + uTime * 2.4)), fine = noise(vec2(x * 3.0, vUv.y * 7.0 + uTime * 4.2));
        float f = smoothstep(0.3, 0.85, streak * 0.6 + fine * 0.4), edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        gl_FragColor = vec4(mix(vec3(0.2, 0.55, 0.57), vec3(0.88, 0.97, 0.94), f), (0.7 + 0.3 * f) * edge * smoothstep(0.0, 0.12, vUv.y));
        return;
      }
      float along = dot(vWorld.xz, uFlow), across = dot(vWorld.xz, vec2(-uFlow.y, uFlow.x)), speed = mix(0.3, 1.5, uFlood);
      float a = noise(vec2(along * 0.8 - uTime * speed, across * 1.5)), b = noise(vec2(along * 2.1 - uTime * speed * 1.6, across * 3.0 + 7.0));
      float ripple = a * 0.6 + b * 0.4, lines = pow(1.0 - abs(ripple * 2.0 - 1.0), 7.0);
      // Darker under each bank, so the trench reads as deep.
      float bank = smoothstep(0.0, 0.7, min(vUv.y, 1.0 - vUv.y) * uWide);
      vec3 c = mix(vec3(0.04, 0.2, 0.25), vec3(0.15, 0.47, 0.49), ripple * 0.75 + 0.1 + uFlood * 0.2) * mix(0.62, 1.0, bank);
      c += vec3(0.6, 0.86, 0.8) * lines * (0.3 + 0.5 * uFlood);
      float foam = smoothstep(0.72, 1.0, noise(vec2(along * 1.4 - uTime * speed * 2.0, across * 4.0))) * uFlood;
      foam = max(foam, smoothstep(2.6, 0.2, abs(vWorld.x - uSplash)) * smoothstep(0.35, 0.8, b));
      gl_FragColor = vec4(mix(c, vec3(0.9, 0.97, 0.95), foam * 0.75), 0.88);
    }`;
  interface Water { mesh: THREE.Mesh; flood: { value: number } }
  function water(room: RoomDef, x0: number, z0: number, x1: number, z1: number, y: number, o: { fall?: number; flow?: readonly [number, number]; splash?: number } = {}): Water {
    const upright = o.fall !== undefined, flood = { value: 0 }, w = upright ? z1 - z0 : x1 - x0;
    const geometry = upright ? new THREE.PlaneGeometry(w, o.fall).rotateY(Math.PI / 2).translate(0, -o.fall! / 2, 0) : new THREE.PlaneGeometry(w, z1 - z0).rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: WATER_VERTEX, fragmentShader: WATER,
      uniforms: { uTime: waterClock, uFlood: flood, uFall: { value: upright ? 1 : 0 }, uWide: { value: upright ? w : z1 - z0 }, uSplash: { value: o.splash ?? -1e6 }, uFlow: { value: new THREE.Vector2(...(o.flow ?? [1, 0])) } },
    });
    const mesh = moving(geometry, room, (x0 + x1) / 2, y, (z0 + z1) / 2, material);
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.renderOrder = upright ? 2 : 1;
    return { mesh, flood };
  }
  const channels = lower.keeper?.channels ?? [];
  const STILL = -0.06, FLOODED = 0.08;
  const inletX = roomOrigin(lower).x + 1.7;
  // The east channel's water runs on out through the culvert to the lip of the outlet.
  const sheets = channels.map((c, i) => water(lower, c.box[0], c.box[1], i === channels.length - 1 ? 26.7 : c.box[2], c.box[3], STILL, { splash: i === 0 ? inletX : undefined }));
  const flumes = channels.map((c) => water(lower, c.gate[0] - 0.62, c.gate[1] + 0.1, c.gate[0] + 0.62, c.gate[1] + 1.4, 0.05, { flow: [0, 1] }));
  const gates = channels.map((c) => moving(parts.gate, lower, c.gate[0], 0, c.gate[1]));
  const falls = [water(lower, 1.7, 9.3, 1.7, 12.7, 1.28, { fall: 1.36 }), water(lower, 26.78, 9, 26.78, 13, STILL - 0.02, { fall: 6 })];
  // The stair down from the shaft room, under water until the lever is pulled.
  const well = water(upper, 17, 10, 21, 15, -0.12);
  let wellLevel = -0.12;

  // The gallery's bars, which sink into the floor when the last eye is lit, and the Wild Harvester's arm on its base.
  const gallery = roomOf('gallery'), seedVault = roomOf('seedvault');
  const bars = moving(parts.bars, gallery, 8, 0, 17.5);
  let barsDown = ruins.view().eyes >= GALLERY_EYES.length ? 1 : 0;
  const arm = moving(parts.arm, seedVault, seedVault.keeper!.home[0], 3, seedVault.keeper!.home[1]);
  arm.name = 'vault: harvester arm';
  arm.rotation.order = 'YZX';
  arm.rotation.y = 0.9;
  /** The root pods of the Wild Harvester's fight, by the target each stands for. */
  const pods = new Map<object, number>();

  // ---------------------------------------------------------------- the Old Gate, open
  const gateSite = landmarkSites().find((s) => s.model === 'oldGate');
  const gateOpen = new THREE.Group();
  let disc: THREE.Mesh | null = null;
  const pivot = new THREE.Vector3();
  /** How far the gate has opened, 0 to 1. A gate already open when the game loads stands open. */
  let opened = ruins.view().gate ? 1 : 0;
  if (gateSite) {
    const parts = oldGateParts(QUALITY[view.ctx.quality].propDetail);
    const material = paint({ vertexColors: true, brush: 0.22, bands: 0.55, wrap: 0.25, brushScale: 0.22 });
    gateOpen.name = 'ruins: the Old Gate, open';
    gateOpen.position.set(gateSite.x, groundHeight(seed, Math.floor(gateSite.x), Math.floor(gateSite.z)), gateSite.z);
    gateOpen.rotation.y = gateSite.rotation;
    const body = new THREE.Mesh(parts.stationary, material);
    disc = new THREE.Mesh(parts.disc, material);
    disc.position.set(...parts.pivot);
    pivot.copy(disc.position);
    body.castShadow = disc.castShadow = true;
    body.receiveShadow = disc.receiveShadow = true;
    gateOpen.add(body, disc);
    gateOpen.visible = false;
    group.add(gateOpen);
  }

  // ---------------------------------------------------------------- the shrine's pick
  const panel = homePanel(view, book);
  game.events.on('shrine.asked', ({ shrine }) => {
    panel.open((body) => {
      body.append(el('h2', 'hp-title rn-title', SHRINE_NAMES[shrine] ?? 'The shrine'), rule(1, 3));
      body.append(el('p', 'hp-sub', 'It wakes under your marked hand, and asks what you will carry from it. For good.'));
      const gifts = el('div', 'hp-jobs');
      for (const [gift, name, text] of [['heart', 'One more heart', 'You can take one more blow before you fall.'], ['stamina', 'More stamina', 'You can dodge, sprint and swing for longer.']] as const) {
        const card = el('button', 'hp-job');
        card.type = 'button';
        card.dataset.key = `shrine:${gift}`;
        card.append(el('span', 'rn-gift', gift === 'heart' ? '♥' : '❖'), el('span', 'hp-job-name', name), el('span', 'hp-job-text', text));
        card.addEventListener('click', () => { ruins.restore?.(shrine, gift); panel.close(); });
        gifts.append(card);
      }
      body.append(gifts);
      const actions = el('div', 'hp-actions');
      actions.append(button('Not yet', false, () => panel.close()));
      body.append(actions);
    });
  });

  // ---------------------------------------------------------------- once a frame
  // Scene 29 includes the thirteen-metre Stag. The ordinary human-height stage
  // framing crops its head; this room shot frames the full cast above the film bars.
  const memoryAim = new THREE.Vector3(), memoryDirection = new THREE.Vector3();
  let clock = 0;
  view.onFrame((dt) => {
    clock += dt;
    const nextDetail = QUALITY[view.ctx.quality].propDetail;
    if (nextDetail !== detail) {
      const next = vaultMovingParts(nextDetail);
      replaceVaultParts(group, parts, next);
      parts = next;
      detail = nextDetail;
    }
    const v = ruins.view!();
    if (v.room === 'seedvault' && sys.talk?.active && sys.talk.current()?.scene === 29) {
      const stag = game.actors.get('stage:stag');
      const ilara = game.actors.get('stage:ilara');
      const auren = game.actors.get('stage:auren');
      if (stag && ilara && auren) {
        memoryAim.set((stag.pos.x + ilara.pos.x + auren.pos.x) / 3, stag.pos.y + 4.2, (stag.pos.z + ilara.pos.z + auren.pos.z) / 3);
        view.ctx.camera.getWorldDirection(memoryDirection);
        view.ctx.camera.position.copy(memoryAim).addScaledVector(memoryDirection, -55);
        view.ctx.camera.lookAt(memoryAim);
      }
    }
    // The room's props, again whenever the room or what it shows changes.
    const room = v.room ? ROOM_DEFS.find((r) => r.id === v.room) ?? null : null;
    const want = room ? `${room.id}:${v.lever}:${v.eyes}:${v.machines.join(',')}` : '';
    if (want !== dressed) {
      dressed = want;
      if (room) dress(room, v);
      else { for (const h of handles) props.remove(h); handles = []; kits.clear(); pods.clear(); }
    }
    environment(room, v.eyes);
    poolMesh.visible = haloMesh.visible = underground;
    glowClock.value = clock;
    kits.update(dt, view.ctx);
    // Stones: warm while they wait to be touched, dull after; a vault's only once its keeper is down.
    for (const s of stones) {
      const there = v.stones.includes(s.id);
      s.mesh.visible = there;
      if (!there) continue;
      const won = s.vault ? game.flags.is(FLAG.fightWon(VAULT[s.vault].fight)) : game.flags.is('mark');
      s.mesh.material = won && !game.flags.is(FLAG.memory(s.id)) ? warm : dull;
      if (s.mesh.material === warm) s.mesh.position.y += Math.sin(clock * 2.4) * 0.0015;
    }
    for (const [vault, key] of keys) {
      key.visible = !v.taken[vault];
      key.rotation.y = clock * 0.6;
    }
    ropes.forEach((r, i) => { r.visible = v.room === `rootworks-${i + 1}`; });
    // The Pump House's machines turn.
    for (const part of upperParts) part.visible = v.room === 'pump-upper';
    for (const part of lowerParts) part.visible = v.room === 'pump-lower';
    shaft.rotation.x = clock * 1.6;
    pinion.rotation.y = clock * 1.6;
    wheel.rotation.y = -clock * 0.8 + 0.16;
    crank.rotation.z = v.lever ? clock * 1.6 : 0;
    turbine.rotation.y = clock * 0.5;
    follower.rotation.y = -clock + 0.3;
    // The gallery's dark, round the hero's lamp.
    const darkness = v.room === 'gallery' ? 1 - v.eyes / GALLERY_EYES.length : 0;
    const shade = Math.round(darkness * 20) / 20;
    if (shade !== darkShade) { darkShade = shade; dark.style.opacity = String(shade); }
    if (darkness > 0) {
      const p = view.playerPosition;
      const at = view.project(p.x, p.y + 0.9, p.z, screen);
      if (at && !(Math.abs(at.x - darkX) <= 0.5 && Math.abs(at.y - darkY) <= 0.5)) {
        darkX = at.x;
        darkY = at.y;
        dark.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
      }
    }
    gateRope.visible = v.deepest > 0 && v.room === null;
    // The trench: where the keeper's rule floods a channel its gate lifts, its flume runs and its water stands higher.
    const keeper = sys.fights?.running?.()?.keeper;
    const inLower = v.room === 'pump-lower', ease = Math.min(1, dt * 3);
    waterClock.value = clock;
    for (let i = 0; i < sheets.length; i++) {
      const flooded = inLower && keeper?.kind === 'sluice' && keeper.flooded(i) > 0 ? 1 : 0, sheet = sheets[i]!, gate = gates[i]!, flume = flumes[i]!;
      sheet.flood.value += (flooded - sheet.flood.value) * ease;
      sheet.mesh.visible = gate.visible = inLower;
      sheet.mesh.position.y = ROOMS.ground + STILL + (FLOODED - STILL) * sheet.flood.value;
      gate.position.y = ROOMS.ground + 1.5 * sheet.flood.value;
      flume.flood.value = 1;
      flume.mesh.visible = inLower && sheet.flood.value > 0.05;
    }
    for (const fall of falls) fall.mesh.visible = inLower;
    // The flooded stair: its water sinks away once the lever is pulled.
    wellLevel += ((v.lever ? -2.1 : -0.12) - wellLevel) * Math.min(1, dt * 0.8);
    well.mesh.visible = v.room === 'pump-upper' && wellLevel > -2;
    well.mesh.position.y = ROOMS.ground + wellLevel;
    // The gallery's bars sink into the floor.
    barsDown += ((v.eyes >= GALLERY_EYES.length ? 1 : 0) - barsDown) * Math.min(1, dt * 1.6);
    bars.visible = v.room === 'gallery' && barsDown < 0.98;
    bars.position.y = ROOMS.ground - 2.9 * barsDown;
    // The Wild Harvester is its arm: it turns on its base the way the keeper faces, lifts to strike and comes down,
    // and a root pod stands at each part of it still to break. The keeper's stand-in sprite is not drawn.
    arm.visible = v.room === 'seedvault';
    if (keeper?.kind === 'harvester' && arm.visible) {
      const body = keeper.body;
      arm.rotation.y = -body.facing - Math.PI / 2;
      const lift = body.doing === 'windup' ? -0.3 : body.doing === 'down' ? 0.22 : body.doing === 'held' ? 0.12 : 0.03 * Math.sin(clock * 1.5);
      arm.rotation.z += (lift - arm.rotation.z) * Math.min(1, dt * 8);
      for (const target of keeper.parts) if (!target.broken && !pods.has(target)) pods.set(target, kits.place('vaultPod', 0, { x: target.x, y: ROOMS.ground, z: target.z }, target.x * 1.7));
      for (const [target, handle] of pods) if ((target as { broken: boolean }).broken) { kits.remove(handle); pods.delete(target); }
      const figures = view.scene.getObjectByName('fight-figures');
      if (figures) for (const object of figures.children) {
        const at = ((object as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms?.uPlace?.value as { x: number; z: number } | undefined;
        if (at && Math.abs(at.x - body.x) < 0.01 && Math.abs(at.z - body.z) < 0.01) object.visible = false;
      }
    }
    // The Old Gate: its disc slides out of its rebate and rises.
    gateOpen.visible = v.gate;
    if (disc && v.gate) {
      opened = Math.min(1, opened + dt / 3);
      const slide = Math.min(1, opened * 2), rise = Math.max(0, opened * 2 - 1);
      disc.position.z = pivot.z + slide * 0.9;
      disc.position.y = pivot.y + rise * 9.5;
    }
  });
}
