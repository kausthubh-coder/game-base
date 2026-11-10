// Draws every placed prop. The whole cost is one instanced draw call for each kind and variant on screen,
// plus two for all their shadows.
//
// How it stays cheap:
// - Every copy of one kind and variant is one instanced mesh, however many cells its copies stand in.
// - Props are kept in cells of 32 by 32 blocks. Each cell holds its copies as ready-made rows of numbers.
//   When the set of cells in view changes, the rows of the cells in view are copied into the meshes.
//   Nothing is copied or allocated on a frame where the view holds the same cells.
// - A prop casts shadow through a few stretched balls and boxes its builder listed, not through its own
//   triangles. Every ball in the world is one draw call and every box is another. They live on a layer
//   only the sun's shadow camera sees.
// - All props share one material, so one shader program.
import * as THREE from 'three';
import { propDef, type PropDef, type PropKind } from '../../content/props.ts';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Quality, Vec3 } from '../../engine/types.ts';
import { buildProp, propExtras } from './build.ts';
import { hash3, jitterAt, type Jitter } from './jitter.sim.ts';
import { darkness } from './light.sim.ts';
import { createPropMaterial } from './material.view.ts';
import type { ShapeExtras } from './shape.ts';

/** The side of a cell, in blocks. */
export const CELL = 32;
/** A cell counts as in view this far past its edge, so a tree just off screen still drops its shadow on screen. */
const MARGIN = 8;

export interface PropsOptions {
  /**
   * The layer the shadow balls and boxes live on. Only the sun's shadow camera may see it. The default is
   * the layer the sky feature already gives its sun for cloud shadows, so with the sky there is nothing to wire.
   */
  shadowLayer?: number;
  /** False places every copy exactly as asked, with no turn, size or tint of its own. For previews and contact sheets. */
  vary?: boolean;
}

/** A light a placed prop gives, for the world to light the blocks around it. */
export interface PropLight {
  handle: number;
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  /** Block light, 1 to 15. */
  level: number;
  /** It is lit by day too. The others are lit when `Props.glow` is above 0. */
  always: boolean;
}

export interface PropsStats {
  placed: number;
  /** Copies in the cells in view, after the quality level has thinned the small plants. */
  drawn: number;
  /** Draw calls for the props themselves: one for each kind and variant in view. */
  drawCalls: number;
  /** Draw calls in the shadow pass: 0, 1 or 2. */
  shadowCalls: number;
  /** Triangles of the props in view, without their shadow casters. */
  triangles: number;
  shadowTriangles: number;
  cells: number;
  cellsInView: number;
}

export interface Props extends ViewSystem {
  /** Everything this system draws hangs under this group. */
  setReduceMotion(value: boolean): void;
  setPlantDensity(value: number | null): void;
  readonly group: THREE.Group;
  /** 0 by day, 1 when it is dark and the windows and lamps are lit. */
  readonly glow: number;
  /**
   * Stands a prop in the world and returns its handle. `rotation` is radians around y, and at 0 its front
   * faces +z. Each copy also gets a small turn, size and tint of its own from where it stands.
   */
  place(kind: PropKind, variant: number, position: Vec3, rotation?: number, scale?: number): number;
  remove(handle: number): void;
  /** Removes every prop. */
  clear(): void;
  /** Where the light of every lit prop sits. The same array until a lit prop is placed or removed. */
  lights(): readonly PropLight[];
  stats(): PropsStats;
}

/** How each quality level trims the work. */
const LEVELS: Record<Quality, { plants: number; shadows: boolean }> = {
  low: { plants: 0.45, shadows: false },
  medium: { plants: 0.8, shadows: true },
  high: { plants: 1, shadows: true },
};

/** One instanced mesh and how much of it is filled. */
interface Batch {
  mesh: THREE.InstancedMesh;
  capacity: number;
  count: number;
  /** Copies the cells in view want, counted before they are copied in. */
  wanted: number;
  triangles: number;
  shadow: boolean;
}

/** One kind and variant: its geometry and the mesh that draws every copy. */
interface Model {
  kind: PropKind;
  def: PropDef;
  extras: ShapeExtras;
  height: number;
  batch: Batch;
}

interface Placed {
  handle: number;
  model: Model;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  r: number;
  g: number;
  b: number;
  /** 0 to 1. Lower quality levels drop small plants whose rank is high. */
  rank: number;
  cell: Cell;
}

/** A cell's copies of one batch, as the numbers the mesh needs. */
interface Rows {
  batch: Batch;
  matrices: Float32Array;
  colors: Float32Array | null;
  count: number;
}

interface Cell {
  key: number;
  box: THREE.Box3;
  props: Map<number, Placed>;
  rows: Rows[];
  /** Its props changed since its rows were made. */
  stale: boolean;
  inView: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const SAME: Jitter = { turn: 0, size: 1, r: 1, g: 1, b: 1 };

export function createProps(ctx: ViewContext, options: PropsOptions = {}): Props {
  const shadowLayer = options.shadowLayer ?? 30;
  const vary = options.vary ?? true;
  const { material, uniforms } = createPropMaterial();
  const shadowMaterial = new THREE.MeshBasicMaterial();
  const group = new THREE.Group();
  group.name = 'props';
  ctx.scene.add(group);

  const models = new Map<string, Model>();
  const batches: Batch[] = [];
  const cells = new Map<number, Cell>();
  /** The same cells as a list, so a frame can walk them without making an iterator. */
  const cellList: Cell[] = [];
  const placed = new Map<number, Placed>();
  let nextHandle = 1;
  let quality = ctx.quality;
  let reduceMotion = false;
  let plantDensity: number | null = null;
  let glow = darkness(ctx.ambient.timeOfDay);
  /** The meshes no longer match the cells in view. */
  let refill = true;
  let lightList: PropLight[] | null = [];
  const stats: PropsStats = { placed: 0, drawn: 0, drawCalls: 0, shadowCalls: 0, triangles: 0, shadowTriangles: 0, cells: 0, cellsInView: 0 };

  const frustum = new THREE.Frustum();
  const _matrix = new THREE.Matrix4();
  const _part = new THREE.Matrix4();
  const _position = new THREE.Vector3();
  const _scale = new THREE.Vector3();
  const _turn = new THREE.Quaternion();
  const _jitter: Jitter = { turn: 0, size: 1, r: 1, g: 1, b: 1 };

  function makeMesh(geometry: THREE.BufferGeometry, capacity: number, shadow: boolean): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, shadow ? shadowMaterial : material, capacity);
    mesh.count = 0;
    mesh.visible = false;
    // The cells decide what is drawn, so the mesh itself is never tested against the view.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    if (shadow) {
      mesh.castShadow = true;
      mesh.layers.set(shadowLayer);
    } else {
      mesh.receiveShadow = true;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    }
    group.add(mesh);
    return mesh;
  }

  function makeBatch(geometry: THREE.BufferGeometry, name: string, shadow: boolean): Batch {
    const capacity = 16;
    const mesh = makeMesh(geometry, capacity, shadow);
    mesh.name = name;
    const batch: Batch = { mesh, capacity, count: 0, wanted: 0, triangles: (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3, shadow };
    batches.push(batch);
    return batch;
  }

  /** Swaps a batch's mesh for a larger one. It happens when a view first holds more copies than before, never every frame. */
  function grow(batch: Batch, needed: number): void {
    let capacity = batch.capacity;
    while (capacity < needed) capacity *= 2;
    const old = batch.mesh;
    batch.mesh = makeMesh(old.geometry, capacity, batch.shadow);
    batch.mesh.name = old.name;
    batch.capacity = capacity;
    group.remove(old);
    old.dispose();
  }

  // All shadows: a ball of 20 triangles and a box of 12, stretched by each prop's list.
  const ballGeometry = new THREE.IcosahedronGeometry(1, 0);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const balls = makeBatch(ballGeometry, 'props:shadow-balls', true);
  const boxes = makeBatch(boxGeometry, 'props:shadow-boxes', true);

  function modelFor(kind: PropKind, variant: number): Model {
    const key = `${kind}:${variant}`;
    let model = models.get(key);
    if (!model) {
      const def = propDef(kind);
      const geometry = buildProp(kind, variant);
      const height = geometry.boundingBox ? geometry.boundingBox.max.y : 1;
      model = { kind, def, extras: propExtras(geometry), height, batch: makeBatch(geometry, `props:${key}`, false) };
      models.set(key, model);
    }
    return model;
  }

  function cellAt(x: number, z: number): Cell {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const key = (cx + 32768) * 65536 + (cz + 32768);
    let cell = cells.get(key);
    if (!cell) {
      const box = new THREE.Box3(new THREE.Vector3(cx * CELL - MARGIN, Infinity, cz * CELL - MARGIN), new THREE.Vector3((cx + 1) * CELL + MARGIN, -Infinity, (cz + 1) * CELL + MARGIN));
      cell = { key, box, props: new Map(), rows: [], stale: true, inView: false };
      cells.set(key, cell);
      cellList.push(cell);
    }
    return cell;
  }

  function rowsFor(cell: Cell, batch: Batch): Rows {
    for (const rows of cell.rows) if (rows.batch === batch) return rows;
    const rows: Rows = { batch, matrices: new Float32Array(16 * 8), colors: batch.shadow ? null : new Float32Array(3 * 8), count: 0 };
    cell.rows.push(rows);
    return rows;
  }

  function addRow(rows: Rows, matrix: THREE.Matrix4, r: number, g: number, b: number): void {
    if ((rows.count + 1) * 16 > rows.matrices.length) {
      const matrices = new Float32Array(rows.matrices.length * 2);
      matrices.set(rows.matrices);
      rows.matrices = matrices;
      if (rows.colors) {
        const colors = new Float32Array(rows.colors.length * 2);
        colors.set(rows.colors);
        rows.colors = colors;
      }
    }
    rows.matrices.set(matrix.elements, rows.count * 16);
    if (rows.colors) {
      rows.colors[rows.count * 3] = r;
      rows.colors[rows.count * 3 + 1] = g;
      rows.colors[rows.count * 3 + 2] = b;
    }
    rows.count++;
  }

  /** Writes a cell's props out again as rows. It runs once after the cell's props change, when the cell is next in view. */
  function remake(cell: Cell): void {
    const level = LEVELS[quality];
    for (const rows of cell.rows) rows.count = 0;
    for (const p of cell.props.values()) {
      if (p.model.def.group === 'plant' && p.rank >= (plantDensity ?? level.plants)) continue;
      _matrix.compose(_position.set(p.x, p.y, p.z), _turn.setFromAxisAngle(UP, p.rotation), _scale.set(p.scale, p.scale, p.scale));
      addRow(rowsFor(cell, p.model.batch), _matrix, p.r, p.g, p.b);
      if (!level.shadows) continue;
      const { blobs, boxes: boxList } = p.model.extras;
      for (let i = 0; i < blobs.length; i += 16) addRow(rowsFor(cell, balls), _part.fromArray(blobs, i).premultiply(_matrix), 1, 1, 1);
      for (let i = 0; i < boxList.length; i += 16) addRow(rowsFor(cell, boxes), _part.fromArray(boxList, i).premultiply(_matrix), 1, 1, 1);
    }
    cell.stale = false;
  }

  /** Copies the rows of every cell in view into the meshes. */
  function fill(): void {
    for (const batch of batches) batch.wanted = 0;
    for (const cell of cellList) {
      if (!cell.inView) continue;
      if (cell.stale) remake(cell);
      for (const rows of cell.rows) rows.batch.wanted += rows.count;
    }
    for (const batch of batches) {
      if (batch.wanted > batch.capacity) grow(batch, batch.wanted);
      batch.count = 0;
    }
    for (const cell of cellList) {
      if (!cell.inView) continue;
      for (const rows of cell.rows) {
        if (rows.count === 0) continue;
        const { batch } = rows;
        batch.mesh.instanceMatrix.array.set(rows.matrices.subarray(0, rows.count * 16), batch.count * 16);
        if (rows.colors && batch.mesh.instanceColor) batch.mesh.instanceColor.array.set(rows.colors.subarray(0, rows.count * 3), batch.count * 3);
        batch.count += rows.count;
      }
    }
    stats.drawn = stats.drawCalls = stats.shadowCalls = stats.triangles = stats.shadowTriangles = 0;
    for (const batch of batches) {
      const { mesh, count } = batch;
      mesh.count = count;
      mesh.visible = count > 0;
      if (count === 0) continue;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, count * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.clearUpdateRanges();
        mesh.instanceColor.addUpdateRange(0, count * 3);
        mesh.instanceColor.needsUpdate = true;
      }
      if (batch.shadow) {
        stats.shadowCalls++;
        stats.shadowTriangles += count * batch.triangles;
      } else {
        stats.drawCalls++;
        stats.drawn += count;
        stats.triangles += count * batch.triangles;
      }
    }
    refill = false;
  }

  function setQuality(next: Quality): void {
    if (next === quality) return;
    quality = next;
    for (const cell of cellList) cell.stale = true;
    refill = true;
  }

  return {
    setReduceMotion(value) { reduceMotion = value; },
    setPlantDensity(value: number | null) {
      if (plantDensity === value) return;
      plantDensity = value;
      for (const cell of cellList) cell.stale = true;
      refill = true;
    },
    group,
    get glow() {
      return glow;
    },

    place(kind, variant, position, rotation = 0, scale = 1) {
      const model = modelFor(kind, variant);
      const { x, y, z } = position;
      const jitter = vary ? jitterAt(model.def.vary, x, y, z, _jitter) : SAME;
      const cell = cellAt(x, z);
      const handle = nextHandle++;
      const p: Placed = { handle, model, x, y, z, rotation: rotation + jitter.turn, scale: scale * jitter.size, r: jitter.r, g: jitter.g, b: jitter.b, rank: hash3(x, y, z, 5), cell };
      placed.set(handle, p);
      cell.props.set(handle, p);
      cell.box.min.y = Math.min(cell.box.min.y, y - 1);
      cell.box.max.y = Math.max(cell.box.max.y, y + model.height * p.scale + 1);
      cell.stale = true;
      if (cell.inView) refill = true;
      if (model.def.light > 0) lightList = null;
      return handle;
    },

    remove(handle) {
      const p = placed.get(handle);
      if (!p) return;
      placed.delete(handle);
      p.cell.props.delete(handle);
      p.cell.stale = true;
      if (p.cell.inView) refill = true;
      if (p.model.def.light > 0) lightList = null;
    },

    clear() {
      placed.clear();
      cells.clear();
      cellList.length = 0;
      lightList = null;
      refill = true;
    },

    lights() {
      if (!lightList) {
        lightList = [];
        for (const p of placed.values()) {
          const { def, extras, kind } = p.model;
          if (def.light <= 0) continue;
          const cos = Math.cos(p.rotation), sin = Math.sin(p.rotation);
          for (let i = 0; i < extras.lights.length; i += 3) {
            const lx = extras.lights[i] * p.scale, ly = extras.lights[i + 1] * p.scale, lz = extras.lights[i + 2] * p.scale;
            lightList.push({ handle: p.handle, kind, x: p.x + lx * cos + lz * sin, y: p.y + ly, z: p.z - lx * sin + lz * cos, level: def.light, always: def.alwaysLit === true });
          }
        }
      }
      return lightList;
    },

    stats() {
      stats.placed = placed.size;
      stats.cells = cells.size;
      return stats;
    },

    update(_dt, frame) {
      const a = frame.ambient;
      uniforms.uPropTime.value = reduceMotion ? 0 : frame.time;
      uniforms.uPropWind.value.set(Math.cos(a.windDir), Math.sin(a.windDir), reduceMotion ? 0 : a.wind);
      glow = darkness(a.timeOfDay);
      uniforms.uPropNight.value = glow;
      if (frame.quality !== quality) setQuality(frame.quality);

      // Which cells are in view. Copy rows only when that set, or a cell in it, has changed.
      const camera = frame.camera;
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(_matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      let inView = 0;
      for (let i = 0; i < cellList.length; i++) {
        const cell = cellList[i];
        const seen = cell.props.size > 0 && frustum.intersectsBox(cell.box);
        if (seen !== cell.inView) {
          cell.inView = seen;
          refill = true;
        }
        if (seen) inView++;
      }
      stats.cellsInView = inView;
      if (refill) fill();
    },

    setQuality,

    dispose() {
      ctx.scene.remove(group);
      for (const batch of batches) {
        batch.mesh.geometry.dispose();
        batch.mesh.dispose();
      }
      material.dispose();
      shadowMaterial.dispose();
      batches.length = 0;
      models.clear();
      cells.clear();
      cellList.length = 0;
      placed.clear();
    },
  };
}
