// Buildings far from the hero, each drawn as a far version of itself: a few dozen triangles in the shape of its
// roofs and walls, wearing pictures of the real model. So a house far off keeps its roof line, its silhouette, its
// timber and plaster and its windows, where a plain block kept only its size.
//
// The far versions are made once, when the buildings are handed in:
//   - the shape: the model is laid on a grid from above, each cell taking the height of the highest thing over it.
//     A cell's corners blend with the cells beside it of about its height, so a roof slope stays a slope and a
//     tower stays a tower. Cells on one plane merge into one rectangle, and walls drop from the edge to the ground,
//     merged along a side where they run straight. A gable house comes out at a few dozen triangles.
//   - the pictures: the model is drawn in its own colours, with no light, from above and from each of its four
//     sides, into one sheet. The top of the far version wears the picture from above, each wall the picture from
//     its side. The painted light then lights the far version by its own slopes.
// Every copy is one run of vertices in one mesh, so all the far buildings are one draw call, and only the copies
// asked for (`show`) are listed in it.
import * as THREE from 'three';
import { paint } from './paint.ts';

/** One part of a model: its geometry in the model's own space, y up from its foot, with a `color` attribute unless `color` is given. */
export interface FarPart { geometry: THREE.BufferGeometry; matrix?: THREE.Matrix4; color?: THREE.Color }

export interface FarBuildings {
  readonly group: THREE.Group;
  /** Draws the copies `shown` is true for, by their place in the list handed in, and no others. */
  show(shown: (copy: number) => boolean): void;
  /** Triangles of each model's far version, by model. */
  readonly each: readonly number[];
  readonly triangles: number;
}

/** Pixels along a side of one picture, and the margin kept round it so a far picture's blur never reaches the next. */
const TILE = 128, PAD = 3;
/**
 * The cells along a model's longer side, finest first, and the smallest a cell may be, in meters. A model whose far
 * version would cost more than MOST triangles is laid on the next, coarser grid, so an intricate one stays cheap.
 */
const GRIDS = [12, 9, 7, 5], SMALLEST = 0.5, MOST = 64;
/** Cells lower than this are the ground round the model, not part of it. */
const GROUND = 0.35;
/** Two cells side by side blend their corners when their heights are this close, in meters, against the cell's size. */
const BLEND = 1.25;
/** How far off a plane a corner may be and still merge into it, in meters. */
const FLAT = 0.3;
/**
 * How far a far version's faces are lit as if turned toward the sky. A real wall is many small faces, sills, beams
 * and eaves, and some of them catch the light even on the shaded side; one flat face turned from the sun would be
 * darker and bluer than the model it stands for.
 */
const SKYWARD = 1;
/** The colour the sheet is cleared to: plaster, so a picture's edge never darkens. */
const CLEAR = new THREE.Color(0xd8ccb4);

/** The pictures of a model in the sheet: above, then the sides facing +z, -z, +x and -x. Each is [u0, v0, u1, v1]. */
type Tiles = [number, number, number, number][];

interface Shape { positions: number[]; normals: number[]; uvs: number[]; index: number[] }

/** The model's parts as one list of triangles in its own space, with each part's colour, for the pictures and the grid. */
function gather(parts: readonly FarPart[]): { triangles: Float32Array; box: THREE.Box3 } {
  const out: number[] = [], box = new THREE.Box3(), v = new THREE.Vector3();
  for (const part of parts) {
    const g = part.geometry, p = g.getAttribute('position'), index = g.index;
    const n = index ? index.count : p.count;
    for (let k = 0; k < n; k++) {
      v.fromBufferAttribute(p, index ? index.getX(k) : k);
      if (part.matrix) v.applyMatrix4(part.matrix);
      out.push(v.x, v.y, v.z);
      box.expandByPoint(v);
    }
  }
  return { triangles: new Float32Array(out), box };
}

/** A model's far version alone, with its pictures' coordinates over the whole of [0, 1]: for tests and counts. */
export function farShape(parts: readonly FarPart[]): { positions: number[]; normals: number[]; index: number[]; box: THREE.Box3 } {
  const { triangles, box } = gather(parts);
  box.min.y = Math.min(0, box.min.y);
  const whole: Tiles = [[0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 1]];
  return { ...shapeOf(triangles, box, whole), box };
}

/**
 * The far version's shape: a grid of heights from above, merged into rectangles where flat, with walls to the
 * ground. Texture coordinates point into `tiles`.
 */
function shapeOf(triangles: Float32Array, box: THREE.Box3, tiles: Tiles): Shape {
  let shape = shapeAt(triangles, box, tiles, GRIDS[0] as number);
  for (let g = 1; g < GRIDS.length && shape.index.length / 3 > MOST; g++) shape = shapeAt(triangles, box, tiles, GRIDS[g] as number);
  return shape;
}

/** The far version on a grid of `cells` along the model's longer side. */
function shapeAt(triangles: Float32Array, box: THREE.Box3, tiles: Tiles, cells: number): Shape {
  const x0 = box.min.x, z0 = box.min.z, w = Math.max(0.1, box.max.x - x0), d = Math.max(0.1, box.max.z - z0), top = Math.max(0.1, box.max.y);
  const cell = Math.max(SMALLEST, Math.max(w, d) / cells), nx = Math.max(1, Math.ceil(w / cell)), nz = Math.max(1, Math.ceil(d / cell));
  const cx = w / nx, cz = d / nz;
  // ---- the highest thing over each cell: cell middles inside a triangle seen from above, and points along every edge
  const high = new Float32Array(nx * nz).fill(-Infinity);
  const splat = (x: number, y: number, z: number): void => {
    const i = Math.min(nx - 1, Math.max(0, Math.floor((x - x0) / cx))), j = Math.min(nz - 1, Math.max(0, Math.floor((z - z0) / cz)));
    if (y > (high[j * nx + i] as number)) high[j * nx + i] = y;
  };
  for (let t = 0; t < triangles.length; t += 9) {
    const ax = triangles[t] as number, ay = triangles[t + 1] as number, az = triangles[t + 2] as number;
    const bx = triangles[t + 3] as number, by = triangles[t + 4] as number, bz = triangles[t + 5] as number;
    const qx = triangles[t + 6] as number, qy = triangles[t + 7] as number, qz = triangles[t + 8] as number;
    for (const [px, py, pz, sx, sy, sz] of [[ax, ay, az, bx, by, bz], [bx, by, bz, qx, qy, qz], [qx, qy, qz, ax, ay, az]] as const) {
      const steps = Math.max(1, Math.ceil(Math.hypot(sx - px, sz - pz) / (Math.min(cx, cz) * 0.5)));
      for (let s = 0; s <= steps; s++) { const k = s / steps; splat(px + (sx - px) * k, py + (sy - py) * k, pz + (sz - pz) * k); }
    }
    const area = (bx - ax) * (qz - az) - (qx - ax) * (bz - az);
    if (Math.abs(area) < 1e-6) continue;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, qx) - x0) / cx)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, qx) - x0) / cx));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, qz) - z0) / cz)), j1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, qz) - z0) / cz));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const px = x0 + (i + 0.5) * cx, pz = z0 + (j + 0.5) * cz;
        const u = ((bx - px) * (qz - pz) - (qx - px) * (bz - pz)) / area, v = ((qx - px) * (az - pz) - (ax - px) * (qz - pz)) / area, s = 1 - u - v;
        if (u < -1e-4 || v < -1e-4 || s < -1e-4) continue;
        splat(px, u * ay + v * by + s * qy, pz);
      }
    }
  }
  const filled = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < nx && j < nz && (high[j * nx + i] as number) > GROUND;
  const h = (i: number, j: number): number => high[j * nx + i] as number;
  // ---- each cell's four corners: the mean of the cells round the corner that are about as high as this one
  const near = BLEND * Math.max(cx, cz) + 0.2;
  const corners = new Float32Array(nx * nz * 4);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      if (!filled(i, j)) continue;
      const own = h(i, j);
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([di, dj], c) => {
        let sum = 0, n = 0;
        for (const [oi, oj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
          const ni = i + (di as number) + oi, nj = j + (dj as number) + oj;
          if (!filled(ni, nj) || Math.abs(h(ni, nj) - own) > near) continue;
          sum += h(ni, nj); n++;
        }
        corners[(j * nx + i) * 4 + c] = n > 0 ? sum / n : own;
      });
    }
  }
  const corner = (i: number, j: number, c: number): number => corners[(j * nx + i) * 4 + c] as number;
  const shape: Shape = { positions: [], normals: [], uvs: [], index: [] };
  const [above, front, back, right, left] = tiles as [Tiles[number], Tiles[number], Tiles[number], Tiles[number], Tiles[number]];
  const along = (tile: Tiles[number], s: number, t: number): [number, number] => [tile[0] + (tile[2] - tile[0]) * s, tile[1] + (tile[3] - tile[1]) * t];
  const n = new THREE.Vector3(), lit = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  /**
   * A quad a, b, c, d counter-clockwise from outside. It wears the picture taken from the way it faces: from above
   * when it faces up more than sideways, else from the side its face turns to most.
   */
  const pictureAt = (x: number, y: number, z: number): [number, number] => {
    if (n.y >= 0.5) return along(above, (x - x0) / w, (box.max.z - z) / d);
    if (Math.abs(n.z) >= Math.abs(n.x)) return n.z > 0 ? along(front, (x - x0) / w, y / top) : along(back, (box.max.x - x) / w, y / top);
    return n.x > 0 ? along(right, (box.max.z - z) / d, y / top) : along(left, (z - z0) / d, y / top);
  };
  const quad = (p: number[][]): void => {
    e1.set((p[1]![0]! - p[0]![0]!), (p[1]![1]! - p[0]![1]!), (p[1]![2]! - p[0]![2]!));
    e2.set((p[3]![0]! - p[0]![0]!), (p[3]![1]! - p[0]![1]!), (p[3]![2]! - p[0]![2]!));
    n.crossVectors(e1, e2);
    if (n.lengthSq() < 1e-10) { e1.set(p[2]![0]! - p[1]![0]!, p[2]![1]! - p[1]![1]!, p[2]![2]! - p[1]![2]!); n.crossVectors(e1, e2); }
    if (n.lengthSq() < 1e-10) return;
    n.normalize();
    const first = shape.positions.length / 3;
    lit.set(n.x, n.y + SKYWARD, n.z).normalize();
    for (let k = 0; k < 4; k++) { const q = p[k] as number[]; shape.positions.push(...q); shape.normals.push(lit.x, lit.y, lit.z); shape.uvs.push(...pictureAt(q[0] as number, q[1] as number, q[2] as number)); }
    shape.index.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };
  // ---- the tops: rectangles of cells whose corners lie on one plane
  const used = new Uint8Array(nx * nz);
  const onPlane = (i0: number, j0: number, i1: number, j1: number): boolean => {
    // The plane through three corners of the rectangle; every cell's corners must lie on it.
    const ya = corner(i0, j0, 0), yb = corner(i1, j0, 1), yc = corner(i0, j1, 2);
    const sx = (yb - ya) / ((i1 - i0 + 1) * cx), sz = (yc - ya) / ((j1 - j0 + 1) * cz);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!filled(i, j) || used[j * nx + i]) return false;
      for (let c = 0; c < 4; c++) {
        const px = (i - i0 + (c & 1)) * cx, pz = (j - j0 + (c >> 1)) * cz;
        if (Math.abs(ya + sx * px + sz * pz - corner(i, j, c)) > FLAT) return false;
      }
    }
    return true;
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      if (!filled(i, j) || used[j * nx + i] || !onPlane(i, j, i, j)) {
        if (filled(i, j) && !used[j * nx + i]) {
          // A cell not on one plane: two triangles of its own.
          used[j * nx + i] = 1;
          const xa = x0 + i * cx, xb = xa + cx, za = z0 + j * cz, zb = za + cz;
          quad([[xa, corner(i, j, 2), zb], [xb, corner(i, j, 3), zb], [xb, corner(i, j, 1), za], [xa, corner(i, j, 0), za]]);
        }
        continue;
      }
      let i1 = i, j1 = j;
      while (i1 + 1 < nx && onPlane(i, j, i1 + 1, j)) i1++;
      while (j1 + 1 < nz && onPlane(i, j, i1, j1 + 1)) j1++;
      for (let b = j; b <= j1; b++) for (let a = i; a <= i1; a++) used[b * nx + a] = 1;
      const xa = x0 + i * cx, xb = x0 + (i1 + 1) * cx, za = z0 + j * cz, zb = z0 + (j1 + 1) * cz;
      quad([[xa, corner(i, j1, 2), zb], [xb, corner(i1, j1, 3), zb], [xb, corner(i1, j, 1), za], [xa, corner(i, j, 0), za]]);
    }
  }
  // ---- the walls: where a cell meets the ground or a lower cell, from the lower edge up to its own, merged along a straight run
  interface Run { from: number; to: number; lowA: number; lowB: number; highA: number; highB: number }
  const walls = (facing: 'front' | 'back' | 'right' | 'left'): void => {
    const alongX = facing === 'front' || facing === 'back';
    const lines = alongX ? nz : nx, steps = alongX ? nx : nz, size = alongX ? cx : cz;
    for (let line = 0; line < lines; line++) {
      let run: Run | null = null;
      const flush = (): void => {
        if (!run) return;
        const r: Run = run;
        run = null;
        if (r.highA - r.lowA < 0.02 && r.highB - r.lowB < 0.02) return;
        const a = r.from * size, b = r.to * size;
        if (facing === 'front') {
          const z = z0 + (line + 1) * cz, xa = x0 + a, xb = x0 + b;
          quad([[xa, r.lowA, z], [xb, r.lowB, z], [xb, r.highB, z], [xa, r.highA, z]]);
        } else if (facing === 'back') {
          const z = z0 + line * cz, xa = x0 + a, xb = x0 + b;
          quad([[xb, r.lowB, z], [xa, r.lowA, z], [xa, r.highA, z], [xb, r.highB, z]]);
        } else if (facing === 'right') {
          const x = x0 + (line + 1) * cx, za = z0 + a, zb = z0 + b;
          quad([[x, r.lowB, zb], [x, r.lowA, za], [x, r.highA, za], [x, r.highB, zb]]);
        } else {
          const x = x0 + line * cx, za = z0 + a, zb = z0 + b;
          quad([[x, r.lowA, za], [x, r.lowB, zb], [x, r.highB, zb], [x, r.highA, za]]);
        }
      };
      for (let s = 0; s < steps; s++) {
        // The cell, the one beyond this side of it, and which two of its corners the side runs between.
        const i = alongX ? s : line, j = alongX ? line : s;
        const oi = facing === 'right' ? i + 1 : facing === 'left' ? i - 1 : i, oj = facing === 'front' ? j + 1 : facing === 'back' ? j - 1 : j;
        const [ca, cb] = facing === 'front' ? [2, 3] : facing === 'back' ? [0, 1] : facing === 'right' ? [1, 3] : [0, 2];
        const [na, nb] = facing === 'front' ? [0, 1] : facing === 'back' ? [2, 3] : facing === 'right' ? [0, 2] : [1, 3];
        let wall: Run | null = null;
        if (filled(i, j)) {
          const highA = corner(i, j, ca), highB = corner(i, j, cb);
          const lowA = filled(oi, oj) ? corner(oi, oj, na) : 0, lowB = filled(oi, oj) ? corner(oi, oj, nb) : 0;
          if (highA - lowA > 0.05 || highB - lowB > 0.05) wall = { from: s, to: s + 1, lowA: Math.min(lowA, highA), lowB: Math.min(lowB, highB), highA, highB };
        }
        if (!wall) { flush(); continue; }
        const r = run as Run | null;
        // It carries on the run when its top and bottom carry on the run's in a straight line.
        if (r && r.to === s && Math.abs(r.highB - wall.highA) < FLAT && Math.abs(r.lowB - wall.lowA) < FLAT
          && Math.abs((wall.highB - wall.highA) - (r.highB - r.highA) / (r.to - r.from)) < FLAT && Math.abs((wall.lowB - wall.lowA) - (r.lowB - r.lowA) / (r.to - r.from)) < FLAT) {
          r.to = s + 1; r.highB = wall.highB; r.lowB = wall.lowB;
        } else { flush(); run = wall; }
      }
      flush();
    }
  };
  walls('front'); walls('back'); walls('right'); walls('left');
  return shape;
}

/**
 * Makes the far versions of `models` and stands a copy of one at each of `copies`. Each model is a list of parts;
 * a copy is its model's number and a matrix into the world.
 */
export function createFarBuildings(renderer: THREE.WebGLRenderer, models: readonly (readonly FarPart[])[], copies: readonly { model: number; matrix: THREE.Matrix4 }[]): FarBuildings {
  const group = new THREE.Group();
  group.name = 'far-buildings';
  // ---- the sheet of pictures, five a model
  const across = Math.max(1, Math.ceil(Math.sqrt(models.length * 5))), rows = Math.ceil((models.length * 5) / across);
  const target = new THREE.WebGLRenderTarget(across * TILE, rows * TILE, { depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  // Three draws into a sheet like this in linear colour, so the sheet is read back as linear: marked sRGB, every
  // far building would come out darker than its model.
  const before = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), auto: renderer.autoClear, shadows: renderer.shadowMap.autoUpdate };
  renderer.shadowMap.autoUpdate = false;
  renderer.autoClear = false;
  renderer.setRenderTarget(target);
  renderer.setClearColor(CLEAR, 1);
  renderer.clear();
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(), own = new THREE.MeshBasicMaterial({ vertexColors: true });
  const shapes: Shape[] = [];
  models.forEach((parts, m) => {
    const { triangles, box } = gather(parts);
    box.min.y = Math.min(0, box.min.y);
    const tiles: Tiles = [];
    const meshes = parts.map((part) => {
      const mesh = new THREE.Mesh(part.geometry, part.color ? new THREE.MeshBasicMaterial({ color: part.color }) : own);
      if (part.matrix) { mesh.matrixAutoUpdate = false; mesh.matrix.copy(part.matrix); }
      scene.add(mesh);
      return mesh;
    });
    const mid = box.getCenter(new THREE.Vector3()), w = box.max.x - box.min.x, d = box.max.z - box.min.z, h = box.max.y;
    // Above, then the sides facing +z, -z, +x and -x: where the camera stands, its up, and the picture's width and height.
    const views: [THREE.Vector3, THREE.Vector3, number, number][] = [
      [new THREE.Vector3(mid.x, h + 50, mid.z), new THREE.Vector3(0, 0, -1), w, d],
      [new THREE.Vector3(mid.x, h / 2, box.max.z + 50), new THREE.Vector3(0, 1, 0), w, h],
      [new THREE.Vector3(mid.x, h / 2, box.min.z - 50), new THREE.Vector3(0, 1, 0), w, h],
      [new THREE.Vector3(box.max.x + 50, h / 2, mid.z), new THREE.Vector3(0, 1, 0), d, h],
      [new THREE.Vector3(box.min.x - 50, h / 2, mid.z), new THREE.Vector3(0, 1, 0), d, h],
    ];
    views.forEach(([eye, up, width, height], k) => {
      const slot = m * 5 + k, tx = (slot % across) * TILE, ty = Math.floor(slot / across) * TILE;
      camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2;
      camera.near = 1; camera.far = 200 + Math.max(w, d, h);
      camera.position.copy(eye); camera.up.copy(up);
      camera.lookAt(mid.x, k === 0 ? 0 : eye.y, mid.z);
      camera.updateProjectionMatrix();
      target.viewport.set(tx + PAD, ty + PAD, TILE - PAD * 2, TILE - PAD * 2);
      target.scissor.set(tx, ty, TILE, TILE);
      target.scissorTest = true;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const sx = across * TILE, sy = rows * TILE;
      tiles.push([(tx + PAD) / sx, (ty + PAD) / sy, (tx + TILE - PAD) / sx, (ty + TILE - PAD) / sy]);
    });
    for (const mesh of meshes) { scene.remove(mesh); if (mesh.material !== own) (mesh.material as THREE.Material).dispose(); }
    shapes.push(shapeOf(triangles, box, tiles));
  });
  own.dispose();
  target.scissorTest = false;
  target.viewport.set(0, 0, across * TILE, rows * TILE);
  renderer.setRenderTarget(before.target);
  renderer.setClearColor(before.color, before.alpha);
  renderer.autoClear = before.auto;
  renderer.shadowMap.autoUpdate = before.shadows;

  // ---- every copy, in the world, in one mesh
  let vertices = 0, indices = 0;
  for (const copy of copies) { const s = shapes[copy.model] as Shape; vertices += s.positions.length / 3; indices += s.index.length; }
  const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3), uv = new Float32Array(vertices * 2);
  const runs: { first: number; index: number[] }[] = [];
  const p = new THREE.Vector3(), nm = new THREE.Matrix3();
  let at = 0;
  for (const copy of copies) {
    const s = shapes[copy.model] as Shape, count = s.positions.length / 3;
    nm.getNormalMatrix(copy.matrix);
    for (let k = 0; k < count; k++) {
      p.fromArray(s.positions, k * 3).applyMatrix4(copy.matrix).toArray(position, (at + k) * 3);
      p.fromArray(s.normals, k * 3).applyMatrix3(nm).normalize().toArray(normal, (at + k) * 3);
      uv[(at + k) * 2] = s.uvs[k * 2] as number; uv[(at + k) * 2 + 1] = s.uvs[k * 2 + 1] as number;
    }
    runs.push({ first: at, index: s.index });
    at += count;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const listed = new THREE.BufferAttribute(new Uint32Array(Math.max(1, indices)), 1);
  listed.setUsage(THREE.DynamicDrawUsage);
  geometry.setIndex(listed);
  geometry.setDrawRange(0, 0);
  geometry.computeBoundingSphere();
  const material = paint({
    map: target.texture, brush: 0.22, bands: 0.55, wrap: 0.25, brushScale: 0.22, see: 'solid',
    fragmentFinal: 'vec3 outgoingLight = paintAir(paintShade(diffuseColor.rgb, paintLit(0.0)));',
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'far buildings';
  // The sheet of pictures, for a tool that wants to look at it.
  mesh.userData.sheet = target;
  mesh.matrixAutoUpdate = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.visible = false;
  group.add(mesh);
  let drawn = 0;
  return {
    group,
    show(shown) {
      const array = listed.array as Uint32Array;
      let n = 0;
      runs.forEach((run, c) => {
        if (!shown(c)) return;
        for (let k = 0; k < run.index.length; k++) array[n++] = run.first + (run.index[k] as number);
      });
      listed.clearUpdateRanges();
      listed.addUpdateRange(0, n);
      listed.needsUpdate = true;
      geometry.setDrawRange(0, n);
      mesh.visible = n > 0;
      drawn = n / 3;
    },
    each: shapes.map((s) => s.index.length / 3),
    get triangles() { return drawn; },
  };
}
