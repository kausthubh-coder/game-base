// Draws Hollowmere's city round the old town (src/game/content/town/city.ts): its buildings of the city kit, its
// street and quay pieces, and the working mill's wheel turning on its race. The old town's own models are drawn by
// world-town.view.ts.
//
// A city this size is far over the budgets if every house is drawn whole, so distance decides:
//   - near the hero, a building is its full model, one instanced draw call for each model of the kit in view, the
//     largest and nearest first, inside `cityTriangles` and out to `cityReach` (src/content/quality.ts). Within
//     SHADOWED blocks it casts a shadow, and its shadow counts against the triangles too
//   - past that, out to `landmarkReach`, it is its far version (src/features/painted/far-buildings.ts): a few
//     dozen triangles in the shape of its roofs and walls, wearing pictures of its model. Every far building is
//     one draw call
//   - the street pieces are merged into one mesh for each square of CELL blocks, made the first time the hero comes
//     within `cityPieceReach` of it, and drawn only within that reach. They cast no shadow
// A building that stands between the camera and the hero fades to a dither, as the old town's do.
import * as THREE from 'three';
import { PROPS, propDef } from '../../content/props.ts';
import { QUALITY } from '../../content/quality.ts';
import { createFarBuildings, paint, type FarPart } from '../../features/painted/index.ts';
import { buildProp } from '../../features/props/index.ts';
import { cityTownMillParts } from '../../features/props/builders/city-buildings.ts';
import { darkness } from '../../features/props/light.sim.ts';
import { REGION } from '../content/region.ts';
import { cityPlan, type CityBuilding, type CityModel } from '../content/town/city.ts';
import { TOWN } from '../content/town/pick.ts';
import type { GameView } from '../shell/view.ts';

/** The hero must move this far, or this many seconds pass, before what is drawn whole is chosen again. */
const MOVE = 6, EVERY = 0.6;
/** Nearer than this a building casts a shadow. */
const SHADOWED = 30;
/** The street pieces are merged in squares of this many blocks. */
const CELL = 48;
/** How faded a building between the camera and the hero is, and how fast it gets there, per second. */
const FADED = 0.28, FADE_RATE = 6;

interface Kind {
  model: CityModel;
  near: THREE.InstancedMesh;
  far: THREE.InstancedMesh;
  /** How faded each copy is, by mesh: 1 is solid. */
  nearFade: THREE.InstancedBufferAttribute;
  farFade: THREE.InstancedBufferAttribute;
  triangles: number;
  /** The building each drawn copy is, by mesh, this choice. */
  nearOf: CityBuilding[];
  farOf: CityBuilding[];
}

/** A geometry that shares another's buffers, with its own per-copy fade. */
function sharing(base: THREE.BufferGeometry, count: number): { geometry: THREE.BufferGeometry; fade: THREE.InstancedBufferAttribute } {
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(base.index);
  for (const [name, attribute] of Object.entries(base.attributes)) geometry.setAttribute(name, attribute);
  geometry.boundingSphere = base.boundingSphere;
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count)).fill(1), 1);
  fade.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFade', fade);
  return { geometry, fade };
}

export function install(view: GameView): void {
  if (TOWN !== 'b') return;
  const plan = cityPlan();
  const quality = QUALITY[view.ctx.quality];
  const detail = quality.propDetail;
  const group = new THREE.Group();
  group.name = 'city';
  view.scene.add(group);

  // ---------------------------------------------------------------- the one material
  const night = { value: 0 };
  const material = paint({
    vertexColors: true, brush: 0.22, bands: 0.55, wrap: 0.25, brushScale: 0.22, see: 'solid',
    uniforms: { uLmNight: night },
    vertexPars: 'attribute vec2 aFx; attribute float aFade; varying float vLmGlow; varying float vFade; uniform float uLmNight;',
    vertexBegin: 'vLmGlow = aFx.y > 1.5 ? 1.0 : aFx.y * uLmNight; vFade = aFade;',
    fragmentPars: 'varying float vLmGlow; varying float vFade;',
    fragmentAlbedo: 'if (vFade < 0.99 && fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > vFade) discard;',
    fragmentFinal: 'vec3 outgoingLight = paintAir(paintShade(diffuseColor.rgb, paintLit(0.0))) + diffuseColor.rgb * vLmGlow * 1.8;',
  });

  // ---------------------------------------------------------------- the buildings, one kind a model
  const kinds = new Map<CityModel, Kind>();
  const matrices = new Map<CityBuilding, THREE.Matrix4>();
  const turn = new THREE.Quaternion(), at = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const mill = plan.buildings.find((b) => b.model === 'cityTownMill');
  const millParts = mill ? cityTownMillParts(detail) : null;
  /** Each model's parts, for its far version. */
  const farParts = new Map<CityModel, FarPart[]>();
  for (const b of plan.buildings) {
    matrices.set(b, new THREE.Matrix4().compose(at.set(b.x, REGION.townGround, b.z), turn.setFromAxisAngle(up, (b.turns * Math.PI) / 2), one));
    if (kinds.has(b.model) || !Object.hasOwn(PROPS, b.model)) continue;
    const count = plan.buildings.filter((q) => q.model === b.model).length;
    const base = b.model === 'cityTownMill' && millParts ? millParts.fixed : buildProp(b.model, Math.max(0, propDef(b.model).variants.indexOf('hollowmere')), detail);
    base.computeBoundingSphere();
    farParts.set(b.model, b.model === 'cityTownMill' && millParts ? [{ geometry: base }, { geometry: millParts.wheel, matrix: new THREE.Matrix4().makeTranslation(...millParts.pivot) }] : [{ geometry: base }]);
    const n = sharing(base, count), f = sharing(base, count);
    const near = new THREE.InstancedMesh(n.geometry, material, count), far = new THREE.InstancedMesh(f.geometry, material, count);
    near.name = `city: ${b.model}`;
    far.name = `city: ${b.model}, far`;
    near.count = far.count = 0;
    near.castShadow = true;
    far.castShadow = false;
    near.receiveShadow = far.receiveShadow = true;
    group.add(near, far);
    kinds.set(b.model, { model: b.model, near, far, nearFade: n.fade, farFade: f.fade, triangles: (base.index ? base.index.count : base.getAttribute('position').count) / 3, nearOf: [], farOf: [] });
  }

  // The mill's wheel turns on its axle over the race: its own mesh, drawn while the mill is drawn whole.
  let wheel: THREE.Mesh | null = null;
  const wheelPivot = new THREE.Object3D();
  if (mill && millParts) {
    const g = millParts.wheel;
    g.setAttribute('aFade', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(1), 1));
    wheel = new THREE.Mesh(g, material);
    wheel.name = 'city: mill wheel';
    wheel.castShadow = true;
    wheelPivot.position.set(mill.x, REGION.townGround, mill.z);
    wheelPivot.rotation.y = (mill.turns * Math.PI) / 2;
    const axle = new THREE.Object3D();
    axle.position.set(...millParts.pivot);
    axle.add(wheel);
    wheelPivot.add(axle);
    wheelPivot.visible = false;
    group.add(wheelPivot);
  }

  // ---------------------------------------------------------------- the far versions, far off
  const farModels = [...farParts.keys()], farCopies = plan.buildings.filter((b) => farParts.has(b.model));
  const far = createFarBuildings(view.renderer, farModels.map((m) => farParts.get(m) as FarPart[]), farCopies.map((b) => ({ model: farModels.indexOf(b.model), matrix: matrices.get(b) as THREE.Matrix4 })));
  group.add(far.group);
  // A hero inside a building has its roof and upper walls lifted (the camera's sight rule).
  for (const b of plan.buildings) view.camera.roofs.push({ x0: b.x0, z0: b.z0, x1: b.x1 + 1, z1: b.z1 + 1, floor: REGION.townGround, eaves: REGION.townGround + Math.max(2.4, b.h * 0.55) });

  // ---------------------------------------------------------------- the street pieces, merged by cell
  interface Cell { x: number; z: number; pieces: typeof plan.pieces; mesh: THREE.Mesh | null }
  const cells = new Map<string, Cell>();
  for (const p of plan.pieces) {
    if (!Object.hasOwn(PROPS, p.model)) continue;
    const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL), key = `${cx},${cz}`;
    let cell = cells.get(key);
    if (!cell) cells.set(key, (cell = { x: (cx + 0.5) * CELL, z: (cz + 0.5) * CELL, pieces: [], mesh: null }));
    cell.pieces.push(p);
  }
  const pieceGeometry = new Map<string, THREE.BufferGeometry>();
  function geometryOf(model: string, variant: string): THREE.BufferGeometry {
    const key = `${model}:${variant}`;
    let g = pieceGeometry.get(key);
    if (!g) {
      const def = propDef(model);
      g = buildProp(model, Math.max(0, def.variants.indexOf(variant)), detail);
      pieceGeometry.set(key, g);
    }
    return g;
  }
  /** Every piece of a cell, as one geometry in the world's space. */
  function makeCell(cell: Cell): THREE.Mesh {
    let vertices = 0, indices = 0;
    for (const p of cell.pieces) {
      const g = geometryOf(p.model, p.variant);
      vertices += g.getAttribute('position').count;
      indices += g.index ? g.index.count : g.getAttribute('position').count;
    }
    const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3), color = new Float32Array(vertices * 3);
    const fx = new Float32Array(vertices * 2), index = new Uint32Array(indices);
    const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
    let vAt = 0, iAt = 0;
    for (const p of cell.pieces) {
      const g = geometryOf(p.model, p.variant);
      m.compose(at.set(p.x, p.y, p.z), turn.setFromAxisAngle(up, p.rotation), one);
      nm.getNormalMatrix(m);
      const pos = g.getAttribute('position'), nrm = g.getAttribute('normal'), col = g.getAttribute('color'), f = g.getAttribute('aFx');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        position[(vAt + i) * 3] = v.x; position[(vAt + i) * 3 + 1] = v.y; position[(vAt + i) * 3 + 2] = v.z;
        if (nrm) { v.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize(); normal[(vAt + i) * 3] = v.x; normal[(vAt + i) * 3 + 1] = v.y; normal[(vAt + i) * 3 + 2] = v.z; }
        if (col) { color[(vAt + i) * 3] = col.getX(i); color[(vAt + i) * 3 + 1] = col.getY(i); color[(vAt + i) * 3 + 2] = col.getZ(i); }
        if (f) { fx[(vAt + i) * 2] = f.getX(i); fx[(vAt + i) * 2 + 1] = f.getY(i); }
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) index[iAt + i] = g.index.getX(i) + vAt;
      else for (let i = 0; i < pos.count; i++) index[iAt + i] = vAt + i;
      vAt += pos.count;
      iAt += g.index ? g.index.count : pos.count;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geometry.setAttribute('aFx', new THREE.BufferAttribute(fx, 2));
    geometry.setAttribute('aFade', new THREE.BufferAttribute(new Float32Array(vertices).fill(1), 1));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `city: pieces ${cell.x},${cell.z}`;
    // A cell's shadow would cost every piece in it again, near or far: the pieces are small, so they cast none.
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // ---------------------------------------------------------------- choosing what is drawn
  let lastX = NaN, lastZ = NaN, since = EVERY;
  const chosen: { b: CityBuilding; kind: Kind; weight: number; d: number }[] = [];
  function choose(): void {
    const p = view.playerPosition, q = QUALITY[view.ctx.quality];
    chosen.length = 0;
    for (const b of plan.buildings) {
      const kind = kinds.get(b.model);
      if (!kind) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d > q.cityReach) continue;
      chosen.push({ b, kind, weight: (b.h + (b.x1 - b.x0)) / Math.max(6, d), d });
    }
    chosen.sort((a, b) => b.weight - a.weight);
    for (const kind of kinds.values()) { kind.near.count = kind.far.count = 0; kind.nearOf.length = kind.farOf.length = 0; }
    let budget = q.cityTriangles;
    const whole = new Set<CityBuilding>();
    for (const c of chosen) {
      const shadow = q.propShadows && c.d < SHADOWED;
      const cost = c.kind.triangles * (shadow ? 2 : 1);
      if (cost > budget) continue;
      budget -= cost;
      whole.add(c.b);
      const mesh = shadow ? c.kind.near : c.kind.far;
      (shadow ? c.kind.nearOf : c.kind.farOf).push(c.b);
      mesh.setMatrixAt(mesh.count++, matrices.get(c.b) as THREE.Matrix4);
    }
    for (const kind of kinds.values()) {
      for (const mesh of [kind.near, kind.far]) {
        mesh.visible = mesh.count > 0;
        if (!mesh.visible) continue;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
    if (wheel && mill) wheelPivot.visible = whole.has(mill);
    // Everything else in sight is its far version.
    far.show((c) => { const b = farCopies[c] as CityBuilding; return !whole.has(b) && Math.hypot(b.x - p.x, b.z - p.z) <= q.landmarkReach; });
    // The street pieces near the hero.
    for (const cell of cells.values()) {
      const near = Math.max(Math.abs(cell.x - p.x), Math.abs(cell.z - p.z)) - CELL / 2 < q.cityPieceReach;
      if (near && !cell.mesh) cell.mesh = makeCell(cell);
      if (cell.mesh) cell.mesh.visible = near;
    }
  }

  // ---------------------------------------------------------------- once a frame
  const eye = new THREE.Vector3(), head = new THREE.Vector3(), ray = new THREE.Vector3();
  let nearT = 0, farT = 1;
  const slab = (o: number, d: number, lo: number, hi: number): void => {
    if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) nearT = 2; return; }
    const t0 = (lo - o) / d, t1 = (hi - o) / d;
    nearT = Math.max(nearT, Math.min(t0, t1));
    farT = Math.min(farT, Math.max(t0, t1));
  };
  /** How faded each building is, 1 solid: it follows the building whichever copy draws it. */
  const faded = new Map<CityBuilding, number>();
  /** Moves each drawn building's fade toward faded when it stands between the camera and the hero's head. */
  function fade(list: CityBuilding[], attribute: THREE.InstancedBufferAttribute, step: number): void {
    const values = attribute.array as Float32Array;
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      nearT = 0; farT = 1;
      slab(eye.x, ray.x, b.x0, b.x1 + 1);
      slab(eye.y, ray.y, -1e9, REGION.townGround + b.h);
      slab(eye.z, ray.z, b.z0, b.z1 + 1);
      const goal = nearT <= farT ? FADED : 1, now = faded.get(b) ?? 1;
      const next = Math.abs(goal - now) < 0.01 ? goal : now + (goal - now) * step;
      if (next !== 1 || now !== 1) faded.set(b, next);
      if (values[i] !== next) { values[i] = next; changed = true; }
    }
    if (changed) attribute.needsUpdate = true;
  }
  let spin = 0;
  view.onFrame((dt) => {
    since += dt;
    const p = view.playerPosition;
    if (since >= EVERY || !(Math.hypot(p.x - lastX, p.z - lastZ) < MOVE)) {
      since = 0; lastX = p.x; lastZ = p.z;
      choose();
    }
    night.value = darkness(view.ctx.ambient.timeOfDay);
    eye.copy(view.ctx.camera.position);
    head.set(p.x, p.y + 1.2, p.z);
    ray.subVectors(head, eye);
    const step = Math.min(1, dt * FADE_RATE);
    for (const kind of kinds.values()) {
      if (kind.near.count) fade(kind.nearOf, kind.nearFade, step);
      if (kind.far.count) fade(kind.farOf, kind.farFade, step);
    }
    if (wheel && mill && wheelPivot.visible) {
      spin += dt * 0.12;
      wheel.rotation.x = spin;
      // The wheel fades with its mill.
      const fadeAt = wheel.geometry.getAttribute('aFade') as THREE.BufferAttribute, now = faded.get(mill) ?? 1;
      if (fadeAt.getX(0) !== now) { (fadeAt.array as Float32Array).fill(now); fadeAt.needsUpdate = true; }
    }
  });
}
