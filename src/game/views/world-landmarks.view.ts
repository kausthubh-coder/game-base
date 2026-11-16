import { createLandmarkFrustum } from './landmark-frustum.ts';
// Draws the landmarks of Greenhollow where the land laid them (src/game/region/greenhollow-land.sim.ts): the
// plan's list, the High Road's arches, pylons and stairs, the terraces' faces and stairs, the boardwalks, and the
// Dawn's dome on the northern horizon. Each is a prop of src/content/props.ts, built once and drawn instanced, one
// draw call for each model and variant in view, in the painted light.
//
// The models are being made by other helpers. One that is not in PROPS yet is skipped, and a debug line names
// them all. `?landmarks=boxes` draws a plain stone box of its size in its place instead, to judge where they stand.
//
// What is drawn is held to a triangle budget and a reach from the quality table: the largest and nearest first.
// The dome is drawn at any distance: past the far plane it is brought in along its line and shrunk to match, so
// it keeps its size to the eye, and it glows through: a translucent shell and a soft halo. The falls of the Mere get
// a curtain of falling water here too, since no block draws it, and the weir its sheet of spilling water.
//
// Some landmarks move or follow the story (src/game/region/story.sim.ts, read from the region's flags):
//   - the Pump House's great wheel turns on its axle in the Mere
//   - the door of Ilara's Hall swings open, both leaves, when `door.open` is set
//   - the stretch of the High Road over your land glows while `road.relit` holds, its pylon with it
//   - the Order's pumps stand in Hollowmere's fields, as many as `land.pumps` says
import * as THREE from 'three';
import { PROPS, propDef } from '../../content/props.ts';
import { QUALITY } from '../../content/quality.ts';
import { paint } from '../../features/painted/index.ts';
import { buildProp } from '../../features/props/index.ts';
import { darkness } from '../../features/props/light.sim.ts';
import { groundHeight } from '../../features/world/index.ts';
import { hallDoorParts } from '../../features/props/builders/group-3.ts';
import { pumpHouseParts, weirWater } from '../../features/props/builders/group-4.ts';
import { HIGH_ROAD, RIVER, toMap, toWorld } from '../content/greenhollow.ts';
import { HALL } from '../content/region.ts';
import { WATER_Y, highRoadSpans, landmarkSites, siteBase, type Site } from '../region/greenhollow-land.sim.ts';
import { readLandState, type LandState } from '../region/story.sim.ts';
import type { RuinsView, Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';

/** The hero must move this far, or this many seconds pass, before the models in view are chosen again. */
const MOVE = 8, EVERY = 0.75;
/** Past this distance the dome is brought in along its line, inside the far plane of 760. */
const DOME_AT = 620;
/** Nearer than this a model casts a shadow; its shadow costs its triangles a second time. */
const SHADOWED = 56;
/** Stone, for a stand-in box, as linear colour. */
const STONE = new THREE.Color(0.62, 0.58, 0.5);

interface Kind {
  key: string;
  /** The copies within SHADOWED blocks, which cast shadows, and the rest, which do not. */
  mesh: THREE.InstancedMesh;
  far: THREE.InstancedMesh;
  farMatrices: THREE.Matrix4[];
  triangles: number;
  /** Each site, and when the story shows it this way: a site with two looks is listed under both kinds. */
  sites: { site: Site; matrix: THREE.Matrix4; when?: (land: LandState) => boolean }[];
}

/** Seconds the Hall's door takes to swing open, and how far each leaf turns. */
const DOOR_OPENS = 2.6, DOOR_ANGLE = 1.45;

/** The y a site's model stands at: the land's own rule (`siteBase`), so the check and the picture agree. */
const baseOf = (seed: number, s: Site): number => siteBase(s, (x, z) => groundHeight(seed, x, z));

export function install(view: GameView): void {
  const seed = view.world.sim.seed;
  const params = new URLSearchParams(location.search);
  const boxes = params.get('landmarks') === 'boxes';
  const sites = landmarkSites();
  const missing = [...new Set(sites.filter((s) => !Object.hasOwn(PROPS, s.model)).map((s) => s.model))];
  if (missing.length) console.debug(`[landmarks] not made yet, so not drawn: ${missing.join(', ')}`);

  const group = new THREE.Group();
  group.name = 'landmarks';
  view.scene.add(group);

  const night = { value: 0 };
  const material = paint({
    vertexColors: true, brush: 0.22, bands: 0.55, wrap: 0.25, brushScale: 0.22, see: 'solid',
    uniforms: { uLmNight: night },
    vertexPars: 'attribute vec2 aFx; varying float vLmGlow; uniform float uLmNight;',
    vertexBegin: 'vLmGlow = aFx.y > 1.5 ? 1.0 : aFx.y * uLmNight;',
    fragmentPars: 'varying float vLmGlow;',
    fragmentFinal: 'vec3 outgoingLight = paintAir(paintShade(diffuseColor.rgb, paintLit(0.0))) + diffuseColor.rgb * vLmGlow * 1.8;',
  });

  // ---------------------------------------------------------------- one instanced mesh a model and variant
  const detail = QUALITY[view.ctx.quality].propDetail;
  const kinds = new Map<string, Kind>();
  const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  // The Pump House is drawn as its house and, apart from it, its wheel that turns.
  const pump = Object.hasOwn(PROPS, 'pumpHouse') ? pumpHouseParts(detail) : null;
  function geometryOf(model: string, variant: number): THREE.BufferGeometry | null {
    if (Object.hasOwn(PROPS, model)) return model === 'pumpHouse' && pump ? pump.stationary : buildProp(model, variant, detail);
    if (!boxes || model === 'dawnDome') return null;
    const g = unit.clone();
    const n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([STONE.r, STONE.g, STONE.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }
  const turn = new THREE.Quaternion(), at = new THREE.Vector3(), scale = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  /** Lists a site under the kind of one of its looks, made the first time it is asked for. */
  function add(s: Site, variantName: string, matrix: THREE.Matrix4, when?: (land: LandState) => boolean): void {
    const known = Object.hasOwn(PROPS, s.model);
    const variant = known ? Math.max(0, propDef(s.model).variants.indexOf(variantName)) : 0;
    const key = known ? `${s.model}:${variant}` : `box:${s.model}`;
    let kind = kinds.get(key);
    if (!kind) {
      const geometry = geometryOf(s.model, variant);
      if (!geometry) return;
      const count = sites.filter((q) => q.model === s.model).length;
      const mesh = new THREE.InstancedMesh(geometry, material, count), far = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = `landmarks: ${key}`;
      far.name = `landmarks: ${key}, far`;
      mesh.count = far.count = 0;
      mesh.castShadow = true;
      far.castShadow = false;
      mesh.receiveShadow = far.receiveShadow = true;
      group.add(mesh, far);
      const index = geometry.index;
      kind = { key, mesh, far, farMatrices: [], triangles: (index ? index.count : geometry.getAttribute('position').count) / 3, sites: [] };
      kinds.set(key, kind);
    }
    kind.sites.push({ site: s, matrix, when });
  }
  // The relit stretch of the High Road: its arches and its pylon glow only while the story says so.
  const relitSpans = new Set(highRoadSpans().filter((span) => span.relit && !span.broken && !span.stair).map((span) => `arch-${span.n}`));
  const relitPylon = (s: Site): boolean => {
    const mx = toMap(s.x, s.z)[0];
    return s.model === 'roadPylon' && mx >= HIGH_ROAD.relit[0] && mx <= HIGH_ROAD.relit[1] && mx < HIGH_ROAD.litFrom;
  };
  for (const s of sites) {
    if (s.model === 'dawnDome') continue;
    at.set(s.x, baseOf(seed, s), s.z);
    turn.setFromAxisAngle(up, s.rotation);
    scale.set(1, 1, 1);
    if (!Object.hasOwn(PROPS, s.model)) scale.set(s.size.w, s.size.h, s.size.d);
    const matrix = new THREE.Matrix4().compose(at, turn, scale);
    if (relitSpans.has(s.id)) {
      add(s, 'dark', matrix, (land) => !land.relit);
      add(s, 'lit', matrix, (land) => land.relit);
    } else if (relitPylon(s)) {
      add(s, 'dormant', matrix, (land) => !land.relit);
      add(s, 'lit', matrix, (land) => land.relit);
    } else if (s.model === 'shrine' || s.model === 'vaultRoots' || s.model === 'oldGate' || s.id === 'waystone-terraces') {
      // The ruins' story (src/game/ruins): a shrine wakes when restored, the Seed Vault's doors open once it is cleared
      // from inside, the Old Gate's open parts are the ruins view's, and the terraces' waystone wakes once it has a level
      // of the Rootworks to take the hero to.
      const flags = view.game.flags;
      const ruins = (): RuinsView | null => (view.game.systems as Partial<Systems>).ruins?.view?.() ?? null;
      if (s.model === 'shrine') {
        add(s, 'dormant', matrix, () => !flags.get(`shrine.${s.id}`));
        add(s, 'restored', matrix, () => !!flags.get(`shrine.${s.id}`));
      } else if (s.model === 'vaultRoots') {
        add(s, 'sealed', matrix, () => !flags.is('vault.seedvault.cleared'));
        add(s, 'open', matrix, () => flags.is('vault.seedvault.cleared'));
      } else if (s.model === 'oldGate') {
        add(s, s.variant, matrix, () => !(ruins()?.gate ?? false));
      } else {
        add(s, 'sleeping', matrix, () => (ruins()?.deepest ?? 0) === 0);
        add(s, 'waking', matrix, () => (ruins()?.deepest ?? 0) > 0);
      }
    } else if (s.model === 'orderPump') {
      // pump-1 comes out last: the pumps stand while their number is under `land.pumps`.
      const n = Number(s.id.split('-')[1]) - 1;
      add(s, s.variant, matrix, (land) => n < land.pumps);
    } else add(s, s.variant, matrix);
  }

  // ---------------------------------------------------------------- the Pump House's wheel
  const pumpSite = sites.find((s) => s.model === 'pumpHouse');
  const pumpWheel = new THREE.Group();
  let wheel: THREE.Mesh | null = null;
  if (pump && pumpSite) {
    pumpWheel.name = 'landmarks: pump wheel';
    pumpWheel.position.set(pumpSite.x, baseOf(seed, pumpSite), pumpSite.z);
    pumpWheel.rotation.y = pumpSite.rotation;
    wheel = new THREE.Mesh(pump.wheel, material);
    wheel.position.set(...pump.pivot);
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    pumpWheel.add(wheel);
    pumpWheel.visible = false;
    group.add(pumpWheel);
  }

  // ---------------------------------------------------------------- the weir's spilling water
  const weirSite = sites.find((s) => s.model === 'weir');
  const flowing = { value: 0 };
  let weirSheet: THREE.Mesh | null = null;
  if (weirSite && Object.hasOwn(PROPS, 'weir')) {
    const water = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: flowing },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // The river's blue, foaming white where it falls: streaks of foam run down the sheet along v.
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        float h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
        void main() {
          float col = floor(vUv.x * 64.0), streak = h(col);
          float run = fract(vUv.y * (1.5 + streak * 1.5) - uTime * (0.8 + streak * 0.5));
          float foam = smoothstep(0.5, 0.95, run) * (0.45 + 0.55 * streak) + smoothstep(0.55, 1.0, vUv.y) * 0.7;
          vec3 c = mix(vec3(0.38, 0.58, 0.68), vec3(0.94, 0.97, 1.0), min(1.0, foam));
          float edge = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x);
          gl_FragColor = vec4(c, (0.55 + foam * 0.4) * edge);
        }`,
    });
    weirSheet = new THREE.Mesh(weirWater(), water);
    weirSheet.name = 'landmarks: weir water';
    weirSheet.position.set(weirSite.x, baseOf(seed, weirSite), weirSite.z);
    weirSheet.rotation.y = weirSite.rotation;
    weirSheet.renderOrder = 1;
    group.add(weirSheet);
  }

  // ---------------------------------------------------------------- the door of Ilara's Hall
  // Its frame stands in the court's south wall over the doorway, and its two leaves swing in on their hinges when
  // the door opens for the Mark (src/game/hall).
  const hallDoor = new THREE.Group();
  const leaves: THREE.Object3D[] = [];
  if (Object.hasOwn(PROPS, 'hallDoor')) {
    const parts = hallDoorParts(detail);
    hallDoor.name = 'landmarks: hall door';
    hallDoor.position.set(HALL.doorAt.x, HALL.doorAt.y, HALL.doorAt.z);
    const frame = new THREE.Mesh(parts.hallFrame, material);
    frame.castShadow = frame.receiveShadow = true;
    hallDoor.add(frame);
    for (const [geometry, hinge] of [[parts.hallLeafLeft, -2.5], [parts.hallLeafRight, 2.5]] as const) {
      // Each leaf turns about the upright line through its hinge.
      const pivot = new THREE.Group();
      pivot.position.set(hinge, 0, 0);
      const leaf = new THREE.Mesh(geometry, material);
      leaf.position.set(-hinge, 0, 0);
      leaf.castShadow = leaf.receiveShadow = true;
      pivot.add(leaf);
      hallDoor.add(pivot);
      leaves.push(pivot);
    }
    group.add(hallDoor);
  }
  let doorOpen = 0;

  // ---------------------------------------------------------------- the Dawn's dome
  const domeSite = sites.find((s) => s.model === 'dawnDome');
  let dome: THREE.Mesh | null = null;
  const domeHome = new THREE.Vector3();
  if (domeSite && (Object.hasOwn(PROPS, 'dawnDome') || boxes)) {
    const geometry = Object.hasOwn(PROPS, 'dawnDome') ? buildProp('dawnDome', 0) : (() => {
      const g = new THREE.SphereGeometry(60, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) colors.set([1.2, 0.85, 0.3], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return g;
    })();
    // A translucent shell of gold that glows brighter at its rim, the city's skyline dark against it, and a soft
    // halo round it all.
    const shell = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uNight: night },
      vertexShader: `attribute vec3 color; varying vec3 vColor; varying vec3 vN; varying vec3 vView;
        void main() {
          vColor = color;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - world.xyz);
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `uniform float uNight; varying vec3 vColor; varying vec3 vN; varying vec3 vView;
        void main() {
          float facing = abs(dot(normalize(vN), normalize(vView)));
          float rim = pow(1.0 - facing, 2.0);
          // The skyline is the dark relief: it stands solid against the glow.
          float dark = 1.0 - smoothstep(0.12, 0.3, dot(vColor, vec3(0.3, 0.55, 0.15)));
          vec3 glow = vColor * (1.05 + 0.5 * uNight) + vec3(1.0, 0.86, 0.55) * rim * (0.7 + 0.5 * uNight);
          vec3 c = mix(glow, vColor * 0.55 + vec3(0.12, 0.09, 0.05), dark);
          gl_FragColor = vec4(c, mix(0.32 + 0.55 * rim, 0.92, dark));
        }`,
    });
    dome = new THREE.Mesh(geometry, shell);
    dome.name = 'landmarks: dawn';
    dome.frustumCulled = false;
    dome.renderOrder = 2;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(74, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      uniforms: { uNight: night },
      vertexShader: `varying vec3 vN; varying vec3 vView;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - world.xyz);
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `uniform float uNight; varying vec3 vN; varying vec3 vView;
        void main() {
          float facing = abs(dot(normalize(vN), normalize(vView)));
          gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * pow(facing, 3.0) * (0.22 + 0.25 * uNight), 1.0);
        }`,
    }));
    halo.name = 'landmarks: dawn halo';
    halo.frustumCulled = false;
    halo.renderOrder = 1;
    dome.add(halo);
    group.add(dome);
    domeHome.set(domeSite.x, Math.max(WATER_Y, groundHeight(seed, Math.floor(domeSite.x), Math.floor(domeSite.z))), domeSite.z);
  }

  // ---------------------------------------------------------------- the falls of the Mere
  {
    const lip = toWorld(RIVER.points[RIVER.falls]), next = toWorld(RIVER.points[RIVER.falls + 1]);
    const dx = next.x - lip.x, dz = next.z - lip.z, len = Math.hypot(dx, dz);
    const width = RIVER.half[RIVER.falls] * 2 + 2, drop = RIVER.high - WATER_Y;
    const curtain = new THREE.PlaneGeometry(width, drop + 1, 1, 6);
    curtain.translate(0, WATER_Y + drop / 2, 0);
    const falling = { value: 0 };
    const water = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: falling },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        float h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
        void main() {
          float col = floor(vUv.x * 46.0), streak = h(col);
          float run = fract(vUv.y * (2.0 + streak * 2.0) + uTime * (0.9 + streak * 0.6));
          float white = smoothstep(0.55, 0.95, run) * (0.5 + 0.5 * streak);
          vec3 c = mix(vec3(0.42, 0.62, 0.72), vec3(0.95, 0.98, 1.0), white * 0.85 + (1.0 - vUv.y) * 0.25);
          float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
          gl_FragColor = vec4(c, (0.62 + white * 0.35) * edge);
        }`,
    });
    const falls = new THREE.Mesh(curtain, water);
    falls.name = 'landmarks: falls';
    falls.position.set(lip.x + (dx / len) * 1.5, 0, lip.z + (dz / len) * 1.5);
    falls.rotation.y = Math.atan2(dx, dz);
    group.add(falls);
    view.onFrame((dt) => { falling.value += dt; });
  }

  // ---------------------------------------------------------------- choosing what is drawn
  let lastX = NaN, lastZ = NaN, since = EVERY;
  const chosen: { kind: Kind; site: Site; matrix: THREE.Matrix4; weight: number; near: boolean }[] = [];
  function choose(): void {
    const p = view.playerPosition, q = QUALITY[view.ctx.quality], land = readLandState(view.game.flags);
    chosen.length = 0;
    for (const kind of kinds.values()) {
      for (const { site, matrix, when } of kind.sites) {
        if (when && !when(land)) continue;
        const d = Math.hypot(site.x - p.x, site.z - p.z);
        const big = Math.max(site.size.w, site.size.h * 1.5);
        // A large model is seen from further off.
        if (d > Math.min(q.landmarkReach, 90 + big * 14)) continue;
        chosen.push({ kind, site, matrix, weight: big / Math.max(8, d), near: q.propShadows && d < SHADOWED });
      }
    }
    chosen.sort((a, b) => b.weight - a.weight);
    for (const kind of kinds.values()) { kind.mesh.count = kind.far.count = 0; kind.farMatrices.length = 0; }
    let budget = q.landmarkTriangles;
    pumpWheel.visible = false;
    if (weirSheet) weirSheet.visible = false;
    for (const c of chosen) {
      const cost = c.kind.triangles * (c.near ? 2 : 1);
      if (cost > budget) continue;
      budget -= cost;
      const mesh = c.near ? c.kind.mesh : c.kind.far;
      mesh.setMatrixAt(mesh.count++, c.matrix);
      if (!c.near) c.kind.farMatrices.push(c.matrix);
      if (c.site === pumpSite) pumpWheel.visible = true;
      if (c.site === weirSite && weirSheet) weirSheet.visible = true;
    }
    // The Hall's door is near the start: drawn within the landmarks' reach, whatever the budget.
    hallDoor.visible = Math.hypot(HALL.doorAt.x - p.x, HALL.doorAt.z - p.z) < q.landmarkReach;
    for (const kind of kinds.values()) {
      for (const mesh of [kind.mesh, kind.far]) {
        mesh.visible = mesh.count > 0;
        if (!mesh.visible) continue;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
  }

  const culling = createLandmarkFrustum();
  const eye = new THREE.Vector3(), toDome = new THREE.Vector3();
  view.onFrame((dt) => {
    since += dt;
    const p = view.playerPosition;
    if (since >= EVERY || !(Math.hypot(p.x - lastX, p.z - lastZ) < MOVE)) {
      since = 0; lastX = p.x; lastZ = p.z;
      choose();
    }
    // Views install by filename: story-stage has now placed this frame's scene lens.
    // Compact after choose as well, so its periodic refill cannot restore offscreen copies.
    view.ctx.camera.updateMatrixWorld();
    culling.camera(view.ctx.camera);
    for (const kind of kinds.values()) culling.fill(kind.far, kind.farMatrices);
    night.value = darkness(view.ctx.ambient.timeOfDay);
    // The wheel turns as the report of act1-models-4 asks: about its own z, 0.12 a second.
    if (wheel && pumpWheel.visible) wheel.rotation.z += dt * 0.12;
    flowing.value += dt;
    if (leaves.length) {
      const goal = view.game.flags.is('door.open') ? 1 : 0;
      doorOpen = goal > doorOpen ? Math.min(goal, doorOpen + dt / DOOR_OPENS) : Math.max(goal, doorOpen - dt / DOOR_OPENS);
      const swing = DOOR_ANGLE * doorOpen * doorOpen * (3 - 2 * doorOpen);
      leaves[0].rotation.y = swing;
      leaves[1].rotation.y = -swing;
    }
    if (dome) {
      eye.copy(view.ctx.camera.position);
      toDome.subVectors(domeHome, eye);
      const d = toDome.length();
      if (d > DOME_AT) {
        dome.position.copy(eye).addScaledVector(toDome, DOME_AT / d);
        dome.scale.setScalar(DOME_AT / d);
      } else {
        dome.position.copy(domeHome);
        dome.scale.setScalar(1);
      }
    }
  });
}
