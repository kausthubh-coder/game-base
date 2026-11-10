// Draws the block world. It keeps the chunks around a focus point loaded and asks a worker to make
// and mesh them, one mesh per chunk. To draw, the meshes of four chunks (a region of 32 by 32
// blocks) are joined into one, so the renderer handles a quarter as many objects. Water is a second
// mesh per region because it is see-through. One material draws all solid terrain.
// All chunk work on the page is metered, and stops for the frame when the budget is spent.
import * as THREE from 'three';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Quality } from '../../engine/types.ts';
import type { WorldQuery } from '../../engine/world-query.ts';
import { buildBlockTextures, drawBlockAtlas, type AtlasSource } from './atlas.view.ts';
import { CHUNK, HEIGHT, OPAQUE, PAD_CELLS, chunkKey } from './chunk.sim.ts';
import { buildSoftTiles, createGroundMap, topMeans } from './ground.view.ts';
import { createCleanUniforms, createTerrainMaterial, createTerrainUniforms } from './material.view.ts';
import type { MeshArrays } from './mesh.sim.ts';
import type { WorkerReply, WorkerRequest } from './mesher.worker.ts';
import { World, type WorldSave } from './world.sim.ts';

/**
 * What to hide so the hero stays visible. The camera feature works it out, the world only draws it.
 * Above height `y`, everything that covers the circle (`x`, `z`, `radius`) as seen from the camera
 * is removed, with an edge `soft` blocks wide. With `column`, what stands straight above the circle
 * is removed too, which is right for a roof and wrong for a hill. `sightRadius` is the width of the
 * tunnel cleared from the sight point toward the camera. A radius of 0 turns that part off.
 */
export interface Cutaway {
  x: number; y: number; z: number;
  radius: number;
  soft: number;
  column: boolean;
  sightX: number; sightY: number; sightZ: number;
  sightRadius: number;
}

export interface WorldOptions {
  seed?: number;
  /** A painted atlas from `loadBlockAtlas`. Without one the tiles are drawn in code. */
  atlas?: AtlasSource;
  /** Multiplies the view distance. The demo passes `?stress=N` here. */
  viewScale?: number;
  /** Main-thread milliseconds per frame that chunk work may use. */
  budgetMs?: number;
  /** `clean` draws the ground as painted land: softer tiles, broad grass color, blended edges. See ground.view.ts. */
  ground?: 'today' | 'clean';
}

export interface WorldStats {
  /** Chunks held in memory. */
  chunks: number;
  /** Chunks that have a mesh. */
  meshes: number;
  /** Meshes in the scene: one per region of four chunks, and one more where the region has water. */
  drawn: number;
  /** Chunks still waiting to be made or meshed. */
  queue: number;
  /** Main-thread time spent on chunk work in the last frame, and the worst frame since `resetWorst`. */
  meshMs: number;
  worstMeshMs: number;
  /** View distance in chunks. */
  radius: number;
}

export interface WorldView extends ViewSystem {
  /** The world as rules: blocks, light, ray casts. */
  readonly sim: World;
  /** The same world, as other features see it. Put it in `ViewContext.world`. */
  readonly query: WorldQuery;
  readonly stats: WorldStats;
  /** The atlas in use, for block swatches in a panel. */
  readonly atlas: AtlasSource;
  /** Chunks load around this point. Call it with the hero's position. */
  setViewDistance(scale: number): void;
  setFocus(x: number, z: number): void;
  setCutaway(cutaway: Cutaway | null): void;
  setBlock(x: number, y: number, z: number, id: number): boolean;
  save(): WorldSave;
  load(save: WorldSave): void;
  resetWorst(): void;
}

/** View distance in chunks at each quality level. */
const RADIUS: Record<Quality, number> = { low: 4, medium: 5, high: 6 };
const MAX_IN_FLIGHT = 4;
const CAP_REACH = 18;
const CAP_QUADS = (CAP_REACH * 2 + 1) ** 2;

interface Shown {
  cx: number;
  cz: number;
  making: boolean;
  meshing: boolean;
  /** The chunk revision the mesh on screen was made from. -1 before the first mesh. */
  meshedRev: number;
  solid: MeshArrays | null;
  water: MeshArrays | null;
}

/** One drawn mesh of a region, and what is needed to switch its deep faces on and off. */
interface Part {
  mesh: THREE.Mesh;
  /** True while the deep faces are drawn. */
  deep: boolean;
  /** Index counts: the faces sky light reaches, and all faces. */
  surface: number;
  total: number;
  low: number;
  surfaceLow: number;
  high: number;
}

/** Two by two chunks, drawn as one. */
interface Region {
  rx: number;
  rz: number;
  stale: boolean;
  solid: Part | null;
  water: Part | null;
}

const REGION = CHUNK * 2;

export function createWorld(ctx: ViewContext, options: WorldOptions = {}): WorldView {
  const sim = new World(options.seed ?? 1);
  const atlas = options.atlas ?? drawBlockAtlas();
  const textures = buildBlockTextures(atlas);
  const uniforms = createTerrainUniforms(textures.texture);
  const soft = options.ground === 'clean' ? buildSoftTiles(atlas) : null;
  const ground = soft ? createGroundMap(sim, topMeans(atlas)) : null;
  const clean = soft && ground ? createCleanUniforms(soft.texture, ground.texture, soft.kinds, soft.dirtLayer) : undefined;
  const solidMaterial = createTerrainMaterial('solid', uniforms, clean);
  const waterMaterial = createTerrainMaterial('water', uniforms);
  const capMaterial = createTerrainMaterial('cap', uniforms, clean);
  const group = new THREE.Group();
  group.name = 'world';
  ctx.scene.add(group);

  // The worker cannot read the page's address, so it gets the query as its name: the region plan reads
  // `?town=` from it (src/game/content/town/pick.ts).
  const worker = new Worker(new URL('./mesher.worker.ts', import.meta.url), { type: 'module', name: location.search });
  const post = (message: WorkerRequest, transfer: Transferable[] = []): void => worker.postMessage(message, transfer);
  post({ type: 'tiles', tiles: textures.table });

  let viewScale = options.viewScale ?? 1;
  let quality = ctx.quality;
  const budget = options.budgetMs ?? 3;
  const shown = new Map<number, Shown>();
  const made: Extract<WorkerReply, { type: 'made' }>[] = [];
  const meshed: Extract<WorkerReply, { type: 'meshed' }>[] = [];
  const pads: { blocks: Uint8Array; light: Uint8Array }[] = [];
  const spare: THREE.Mesh[] = [];
  const stats: WorldStats = { chunks: 0, meshes: 0, drawn: 0, queue: 0, meshMs: 0, worstMeshMs: 0, radius: 0 };

  let epoch = 0, inFlight = 0, spent = 0;
  let focusX = 0, focusZ = 0, centerX = NaN, centerZ = NaN;
  let radius = 0;
  let meshOffsets: Int16Array = new Int16Array(0), dataOffsets: Int16Array = new Int16Array(0);

  function setRadius(r: number): void {
    radius = Math.max(1, Math.round(r));
    stats.radius = radius;
    const near: [number, number, number][] = [], far: [number, number, number][] = [];
    for (let dx = -radius - 1; dx <= radius + 1; dx++) {
      for (let dz = -radius - 1; dz <= radius + 1; dz++) {
        const d = dx * dx + dz * dz;
        if (d <= radius * radius) near.push([dx, dz, d]);
        // A chunk can be meshed once the eight around it exist, so data reaches one chunk further.
        const ex = Math.max(Math.abs(dx) - 1, 0), ez = Math.max(Math.abs(dz) - 1, 0);
        if (ex * ex + ez * ez <= radius * radius) far.push([dx, dz, d]);
      }
    }
    const flat = (list: [number, number, number][]): Int16Array => Int16Array.from(list.sort((a, b) => a[2] - b[2]).flatMap((o) => [o[0], o[1]]));
    meshOffsets = flat(near);
    dataOffsets = flat(far);
    centerX = NaN;
  }

  const regions = new Map<number, Region>();
  const staleRegions: Region[] = [];
  // Deep faces are the ones no sky light reaches. A region leaves them out until the camera cuts
  // into the ground next to it.
  let deepReach = Infinity, deepX = 0, deepZ = 0;

  function wantsDeep(region: Region): boolean {
    if (deepReach === Infinity) return true;
    if (deepReach < 0) return false;
    const dx = Math.max(region.rx * REGION - deepX, 0, deepX - (region.rx + 1) * REGION);
    const dz = Math.max(region.rz * REGION - deepZ, 0, deepZ - (region.rz + 1) * REGION);
    return dx * dx + dz * dz <= deepReach * deepReach;
  }

  function release(part: Part): void {
    part.mesh.geometry.dispose();
    group.remove(part.mesh);
    spare.push(part.mesh);
  }

  function markRegion(cx: number, cz: number): void {
    const rx = cx >> 1, rz = cz >> 1, key = chunkKey(rx, rz);
    let region = regions.get(key);
    if (!region) regions.set(key, (region = { rx, rz, stale: false, solid: null, water: null }));
    if (region.stale) return;
    region.stale = true;
    staleRegions.push(region);
  }

  function drop(key: number, entry: Shown): void {
    // The region is rebuilt without this chunk, and forgotten once its last chunk is gone.
    if (regions.has(chunkKey(entry.cx >> 1, entry.cz >> 1))) markRegion(entry.cx, entry.cz);
    sim.unload(entry.cx, entry.cz);
    shown.delete(key);
  }

  /** Drops what is too far from the new center. The reach is wider than the load reach, so walking back and forth does not thrash. */
  function recenter(cx: number, cz: number): void {
    centerX = cx; centerZ = cz;
    const keep = (radius + 3) * (radius + 3);
    for (const [key, entry] of shown) {
      const dx = entry.cx - cx, dz = entry.cz - cz;
      if (dx * dx + dz * dz > keep) drop(key, entry);
    }
  }

  /** Sets how much of a mesh is drawn, and the bounds the renderer culls it by. */
  function applyDeep(part: Part, on: boolean): void {
    part.deep = on;
    const count = on ? part.total : part.surface;
    const low = on ? part.low : part.surfaceLow;
    const geometry = part.mesh.geometry;
    geometry.setDrawRange(0, count);
    geometry.boundingSphere!.center.set(REGION / 2, (low + part.high) / 2, REGION / 2);
    geometry.boundingSphere!.radius = Math.hypot(REGION / 2, REGION / 2, (part.high - low) / 2);
    part.mesh.visible = count > 0;
  }

  const four: (MeshArrays | null)[] = [null, null, null, null];

  /** Joins the meshes of a region's four chunks into one. */
  function joinPart(region: Region, which: 'solid' | 'water', withDeep: boolean): void {
    let verts = 0, total = 0, surface = 0, low = HEIGHT, surfaceLow = HEIGHT, high = 0;
    for (let k = 0; k < 4; k++) {
      const a = shown.get(chunkKey(region.rx * 2 + (k & 1), region.rz * 2 + (k >> 1)))?.[which] ?? null;
      four[k] = a;
      if (!a) continue;
      verts += a.positions.length / 3; total += a.indices.length; surface += a.surface;
      low = Math.min(low, a.low); high = Math.max(high, a.high);
      if (a.surface > 0) surfaceLow = Math.min(surfaceLow, a.surfaceLow);
    }
    const old = region[which];
    if (verts === 0) {
      if (old) { release(old); region[which] = null; }
      return;
    }
    const positions = new Uint8Array(verts * 3), info = new Uint8Array(verts * 4), light = new Uint8Array(verts * 2);
    const indices = verts > 65535 ? new Uint32Array(total) : new Uint16Array(total);
    let v = 0, si = 0, di = surface;
    for (let k = 0; k < 4; k++) {
      const a = four[k];
      if (!a) continue;
      const count = a.positions.length / 3, ox = (k & 1) * CHUNK, oz = (k >> 1) * CHUNK;
      positions.set(a.positions, v * 3);
      if (ox !== 0) for (let i = v * 3, end = (v + count) * 3; i < end; i += 3) positions[i] += ox;
      if (oz !== 0) for (let i = v * 3 + 2, end = (v + count) * 3; i < end; i += 3) positions[i] += oz;
      info.set(a.info, v * 4);
      light.set(a.light, v * 2);
      const from = a.indices;
      for (let i = 0; i < a.surface; i++) indices[si++] = from[i] + v;
      for (let i = a.surface; i < from.length; i++) indices[di++] = from[i] + v;
      v += count;
      four[k] = null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
    geometry.setAttribute('aLight', new THREE.BufferAttribute(light, 2, true));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    // The bounds are known, so the renderer does not have to scan the vertices for them.
    geometry.boundingSphere = new THREE.Sphere();
    let part = old;
    if (part) {
      part.mesh.geometry.dispose();
    } else {
      const mesh = spare.pop() ?? new THREE.Mesh();
      mesh.material = which === 'solid' ? solidMaterial : waterMaterial;
      mesh.castShadow = which === 'solid';
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.position.set(region.rx * REGION, 0, region.rz * REGION);
      mesh.updateMatrix();
      group.add(mesh);
      region[which] = part = { mesh, deep: false, surface: 0, total: 0, low: 0, surfaceLow: 0, high: 0 };
    }
    part.mesh.geometry = geometry;
    part.surface = surface; part.total = total; part.low = low; part.high = high; part.surfaceLow = Math.min(surfaceLow, high);
    applyDeep(part, withDeep);
  }

  /**
   * Rebuilds the regions whose chunks changed. While the world loads, a region waits for a chunk that
   * is at the worker for its first mesh, so it is built once and not four times. A changed chunk
   * never waits: its region is rebuilt the moment the new mesh arrives.
   */
  function joinRegions(start: number, left: number): void {
    for (let i = 0; i < staleRegions.length && performance.now() - start < left;) {
      const region = staleRegions[i];
      let waiting = false, alive = false;
      for (let k = 0; k < 4; k++) {
        const entry = shown.get(chunkKey(region.rx * 2 + (k & 1), region.rz * 2 + (k >> 1)));
        if (entry) { alive = true; if (entry.meshing && entry.meshedRev < 0) waiting = true; }
      }
      if (waiting) { i++; continue; }
      staleRegions.splice(i, 1);
      region.stale = false;
      const withDeep = wantsDeep(region);
      joinPart(region, 'solid', withDeep);
      joinPart(region, 'water', withDeep);
      if (!alive) regions.delete(chunkKey(region.rx, region.rz));
    }
  }

  function takeMeshed(reply: Extract<WorkerReply, { type: 'meshed' }>): void {
    inFlight--;
    pads.push({ blocks: reply.blocks, light: reply.light });
    const entry = shown.get(chunkKey(reply.cx, reply.cz));
    if (!entry || reply.epoch !== epoch) return;
    entry.meshing = false;
    entry.meshedRev = reply.rev;
    entry.solid = reply.mesh.solid;
    entry.water = reply.mesh.water;
    ground?.writeChunk(entry.cx, entry.cz);
    markRegion(entry.cx, entry.cz);
    capStale = true;
  }

  function takeMade(reply: Extract<WorkerReply, { type: 'made' }>): void {
    inFlight--;
    const entry = shown.get(chunkKey(reply.cx, reply.cz));
    if (!entry || reply.epoch !== epoch || !entry.making) return;
    entry.making = false;
    if (!sim.chunkAt(reply.cx, reply.cz)) sim.adopt(reply.cx, reply.cz, reply);
  }

  function sendMesh(entry: Shown, rev: number): void {
    const pad = pads.pop() ?? { blocks: new Uint8Array(PAD_CELLS), light: new Uint8Array(PAD_CELLS) };
    if (!sim.snapshot(entry.cx, entry.cz, pad.blocks, pad.light)) {
      pads.push(pad);
      return;
    }
    entry.meshing = true;
    inFlight++;
    post({ type: 'mesh', epoch, cx: entry.cx, cz: entry.cz, rev, blocks: pad.blocks, light: pad.light }, [pad.blocks.buffer, pad.light.buffer]);
  }

  /** Sends the most useful job to the worker. False when there is nothing to send. */
  function sendNext(): boolean {
    if (Number.isNaN(centerX)) return false;
    // 1. A chunk on screen that changed: the player is looking at it.
    // 2. A chunk that has its neighbors and no mesh yet, nearest first.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < meshOffsets.length; i += 2) {
        const cx = centerX + meshOffsets[i], cz = centerZ + meshOffsets[i + 1];
        const entry = shown.get(chunkKey(cx, cz));
        if (!entry || entry.meshing || (pass === 0) !== (entry.meshedRev >= 0)) continue;
        const chunk = sim.chunkAt(cx, cz);
        if (!chunk || chunk.rev === entry.meshedRev) continue;
        if (pass === 1 && !hasNeighbors(cx, cz)) continue;
        sendMesh(entry, chunk.rev);
        if (entry.meshing) return true;
      }
    }
    // 3. A chunk that does not exist yet, nearest first.
    for (let i = 0; i < dataOffsets.length; i += 2) {
      const cx = centerX + dataOffsets[i], cz = centerZ + dataOffsets[i + 1];
      const key = chunkKey(cx, cz);
      if (shown.has(key)) continue;
      shown.set(key, { cx, cz, making: true, meshing: false, meshedRev: -1, solid: null, water: null });
      inFlight++;
      post({ type: 'make', epoch, seed: sim.seed, cx, cz, edits: sim.editsOf(cx, cz) });
      return true;
    }
    return false;
  }

  function hasNeighbors(cx: number, cz: number): boolean {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!sim.chunks.has(chunkKey(cx + dx, cz + dz))) return false;
    return true;
  }

  /** Does chunk work until the frame's budget is spent. It runs every frame and whenever the worker answers. */
  function pump(): void {
    const start = performance.now();
    const left = budget - spent;
    if (left <= 0) return;
    while (meshed.length > 0 && performance.now() - start < left) takeMeshed(meshed.shift()!);
    while (made.length > 0 && performance.now() - start < left) takeMade(made.shift()!);
    if (staleRegions.length > 0) joinRegions(start, left);
    while (inFlight < MAX_IN_FLIGHT && performance.now() - start < left && sendNext());
    spent += performance.now() - start;
  }

  worker.onmessage = (e: MessageEvent<WorkerReply>) => {
    if (e.data.type === 'made') made.push(e.data);
    else meshed.push(e.data);
    pump();
  };

  // The cap: flat faces drawn where the cutaway slices through solid ground, so a cut hill shows
  // rock and not a hole. It is one small mesh, refilled when the cut moves.
  const capPositions = new Float32Array(CAP_QUADS * 12), capInfo = new Uint8Array(CAP_QUADS * 16), capLight = new Uint8Array(CAP_QUADS * 8);
  const capIndex = new Uint16Array(CAP_QUADS * 6);
  for (let q = 0; q < CAP_QUADS; q++) capIndex.set([q * 4, q * 4 + 2, q * 4 + 1, q * 4, q * 4 + 3, q * 4 + 2], q * 6);
  const capGeometry = new THREE.BufferGeometry();
  const capAttributes = [new THREE.BufferAttribute(capPositions, 3), new THREE.BufferAttribute(capInfo, 4), new THREE.BufferAttribute(capLight, 2, true)];
  for (const a of capAttributes) a.setUsage(THREE.DynamicDrawUsage);
  capGeometry.setAttribute('position', capAttributes[0]);
  capGeometry.setAttribute('aInfo', capAttributes[1]);
  capGeometry.setAttribute('aLight', capAttributes[2]);
  capGeometry.setIndex(new THREE.BufferAttribute(capIndex, 1));
  capGeometry.setDrawRange(0, 0);
  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.frustumCulled = false;
  cap.receiveShadow = true;
  cap.visible = false;
  cap.matrixAutoUpdate = false;
  group.add(cap);
  let capStale = true, capX = 0, capY = -1, capZ = 0, capReach = 0;
  const cut: Cutaway = { x: 0, y: 0, z: 0, radius: 0, soft: 1, column: false, sightX: 0, sightY: 0, sightZ: 0, sightRadius: 0 };

  function fillCap(): void {
    const reach = Math.min(CAP_REACH, Math.ceil(cut.radius) + 1);
    const cx = Math.floor(cut.x), cz = Math.floor(cut.z), y = Math.round(cut.y);
    if (!capStale && cx === capX && cz === capZ && y === capY && reach === capReach) {
      cap.visible = capGeometry.drawRange.count > 0;
      return;
    }
    capStale = false; capX = cx; capY = y; capZ = cz; capReach = reach;
    let q = 0;
    for (let x = cx - reach; x <= cx + reach; x++) {
      for (let z = cz - reach; z <= cz + reach; z++) {
        const below = sim.getBlock(x, y - 1, z);
        if (!OPAQUE[below] || !OPAQUE[sim.getBlock(x, y, z)]) continue;
        const layer = textures.table[below * 6], variants = textures.table[below * 6 + 1];
        for (let c = 0; c < 4; c++) {
          const v = q * 4 + c;
          capPositions[v * 3] = x + (c === 1 || c === 2 ? 1 : 0); capPositions[v * 3 + 1] = y; capPositions[v * 3 + 2] = z + (c >= 2 ? 1 : 0);
          capInfo[v * 4] = 2; capInfo[v * 4 + 1] = layer; capInfo[v * 4 + 2] = variants; capInfo[v * 4 + 3] = 3;
          capLight[v * 2] = 150; capLight[v * 2 + 1] = 0;
        }
        q++;
      }
    }
    for (const a of capAttributes) a.needsUpdate = true;
    capGeometry.setDrawRange(0, q * 6);
    cap.visible = q > 0;
  }

  const lookDir = new THREE.Vector3();
  setRadius(RADIUS[ctx.quality] * viewScale);

  return {
    sim,
    query: sim,
    stats,
    atlas: textures.source,

    setViewDistance(scale) { viewScale = scale; setRadius(RADIUS[quality] * viewScale); },
    setFocus(x, z) {
      focusX = x; focusZ = z;
    },

    setCutaway(next) {
      if (!next) { cut.radius = 0; cut.sightRadius = 0; return; }
      cut.x = next.x; cut.y = next.y; cut.z = next.z; cut.radius = next.radius; cut.soft = next.soft; cut.column = next.column;
      cut.sightX = next.sightX; cut.sightY = next.sightY; cut.sightZ = next.sightZ; cut.sightRadius = next.sightRadius;
    },

    setBlock(x, y, z, id) {
      capStale = true;
      return sim.setBlock(x, y, z, id);
    },

    save: () => sim.save(),

    load(save) {
      epoch++;
      for (const region of regions.values()) {
        if (region.solid) release(region.solid);
        if (region.water) release(region.water);
      }
      regions.clear();
      staleRegions.length = 0;
      shown.clear();
      sim.restore(save);
      capStale = true;
    },

    resetWorst() {
      stats.worstMeshMs = 0;
    },

    update(_dt, frame) {
      const cx = Math.floor(focusX) >> 4, cz = Math.floor(focusZ) >> 4;
      if (cx !== centerX || cz !== centerZ) recenter(cx, cz);
      pump();
      stats.meshMs = spent;
      if (spent > stats.worstMeshMs) stats.worstMeshMs = spent;
      spent = 0;

      let meshes = 0, waiting = 0;
      for (let i = 0; i < meshOffsets.length; i += 2) {
        const x = cx + meshOffsets[i], z = cz + meshOffsets[i + 1];
        const entry = shown.get(chunkKey(x, z));
        const chunk = sim.chunkAt(x, z);
        if (entry && entry.meshedRev >= 0) meshes++;
        if (!entry || !chunk || chunk.rev !== entry.meshedRev) waiting++;
      }
      stats.chunks = sim.chunks.size;
      stats.meshes = meshes;
      stats.queue = waiting;

      const camera = frame.camera;
      camera.getWorldDirection(lookDir);
      uniforms.uViewDir.value.copy(lookDir);
      uniforms.uWetness.value = frame.ambient.wetness;
      uniforms.uCut.value.set(cut.x, cut.z, cut.y, cut.radius);
      uniforms.uCutEdge.value.set(Math.max(0.01, cut.soft), cut.column ? 1 : 0);
      uniforms.uSight.value.set(cut.sightX, cut.sightY, cut.sightZ, cut.sightRadius);
      const axis = uniforms.uSightAxis.value;
      if ((camera as THREE.OrthographicCamera).isOrthographicCamera) axis.copy(lookDir).negate();
      else axis.set(camera.position.x - cut.sightX, camera.position.y - cut.sightY, camera.position.z - cut.sightZ).normalize();
      if (cut.radius > 0 && cut.y > 0 && cut.y < HEIGHT) fillCap();
      else cap.visible = false;

      // Faces no sky light reaches only show where the view cuts into the ground, or around a hero
      // who stands in the dark. Without a cutaway to go by, draw everything.
      const cutting = cut.radius > 0 || sim.skyLightAt(cut.sightX, cut.sightY, cut.sightZ) < 12;
      deepReach = cut.sightRadius <= 0 ? Infinity : cutting ? Math.max(cut.radius, 8) + 16 : -1;
      deepX = cut.sightX; deepZ = cut.sightZ;
      let drawn = 0;
      for (const region of regions.values()) {
        const on = wantsDeep(region);
        if (region.solid && region.solid.deep !== on) applyDeep(region.solid, on);
        if (region.water && region.water.deep !== on) applyDeep(region.water, on);
        drawn += (region.solid ? 1 : 0) + (region.water ? 1 : 0);
      }
      stats.drawn = drawn;
      ground?.upload();
    },

    setQuality(next) {
      quality = next;
      setRadius(RADIUS[quality] * viewScale);
    },

    dispose() {
      worker.terminate();
      for (const region of regions.values()) {
        region.solid?.mesh.geometry.dispose();
        region.water?.mesh.geometry.dispose();
      }
      regions.clear();
      shown.clear();
      capGeometry.dispose();
      solidMaterial.dispose();
      waterMaterial.dispose();
      capMaterial.dispose();
      textures.texture.dispose();
      soft?.texture.dispose();
      ground?.dispose();
      ctx.scene.remove(group);
    },
  };
}
