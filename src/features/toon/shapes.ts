// Building toon geometry by code: simple shapes hung on bones, painted with a colour slot, and merged into one
// body. A hat, an apron or a whole mossling is a list of pieces.
import * as THREE from 'three';
import { SLOT, SLOTS, type SlotName } from './toon.view.ts';

/**
 * A body's geometry in plain arrays: four bones and a tone (slot, shade x 127.5, part, glow x 255) per vertex, and
 * the texture place and vertex colour a model from a file may bring (0, 0 and white for shapes built here).
 */
export interface Pieces {
  /** The colour slots by name, in order. A palette gives a colour for each. */
  slots: string[];
  position: number[];
  normal: number[];
  skinIndex: number[];
  skinWeight: number[];
  tone: number[];
  uv: number[];
  colour: number[];
  index: number[];
}

/** Starts a body. Its slots are the ten named in `SLOT`, unless it brings its own (a file's materials, say). */
export function emptyPieces(slots: readonly string[] = Object.keys(SLOT)): Pieces {
  return { slots: [...slots], position: [], normal: [], skinIndex: [], skinWeight: [], tone: [], uv: [], colour: [], index: [] };
}

/** A slot's number in this body, added at the end when the body has no slot of that name. */
export function slotIndex(into: Pieces, name: string): number {
  let i = into.slots.indexOf(name);
  if (i < 0) {
    if (into.slots.length >= SLOTS) throw new Error(`toon: a body has room for ${SLOTS} colour slots, and "${name}" would be one more`);
    into.slots.push(name);
    i = into.slots.length - 1;
  }
  return i;
}

export interface PieceOptions {
  slot: SlotName;
  /** The bone it hangs on, by its index in the rig. */
  bone: number;
  /** Where it sits in the bind pose. */
  matrix?: THREE.Matrix4;
  /** Lighter or darker than the slot's colour. Default 1. */
  shade?: number;
  part?: number;
  /** 0 to 1: lit from inside, as a lantern is. */
  glow?: number;
}

/** Adds a shape to `into`, all its weight on one bone. */
export function addPiece(into: Pieces, geometry: THREE.BufferGeometry, options: PieceOptions): void {
  const g = geometry;
  if (options.matrix) g.applyMatrix4(options.matrix);
  const position = g.getAttribute('position'), normal = g.getAttribute('normal');
  const base = into.position.length / 3;
  const slot = slotIndex(into, options.slot);
  for (let i = 0; i < position.count; i++) {
    into.position.push(position.getX(i), position.getY(i), position.getZ(i));
    into.normal.push(normal.getX(i), normal.getY(i), normal.getZ(i));
    into.skinIndex.push(options.bone, 0, 0, 0);
    into.skinWeight.push(1, 0, 0, 0);
    into.tone.push(slot, Math.round((options.shade ?? 1) * 127.5), options.part ?? 0, Math.round((options.glow ?? 0) * 255));
    into.uv.push(0, 0);
    into.colour.push(1, 1, 1);
  }
  if (g.index) for (let i = 0; i < g.index.count; i++) into.index.push(base + g.index.getX(i));
  else for (let i = 0; i < position.count; i++) into.index.push(base + i);
  geometry.dispose();
}

/** The pieces as one geometry, with the attributes a toon body reads. */
export function piecesGeometry(pieces: Pieces): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pieces.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(pieces.normal, 3));
  geometry.setAttribute('skinIndex', new THREE.Float32BufferAttribute(pieces.skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(pieces.skinWeight, 4));
  geometry.setAttribute('tone', new THREE.Float32BufferAttribute(pieces.tone, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(pieces.uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(pieces.colour, 3));
  geometry.setIndex(pieces.position.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(pieces.index, 1) : new THREE.Uint16BufferAttribute(pieces.index, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export interface FromGeometry {
  /** The geometry's bone numbers to the body's. Default: the same. */
  bones?: readonly number[];
  /** Without a `tone` attribute: the slot every vertex takes, and the part. */
  slot?: number;
  part?: number;
}

/** Adds a skinned geometry from a file to `into`, so more can be added to it. */
export function addGeometry(into: Pieces, geometry: THREE.BufferGeometry, options: FromGeometry = {}): void {
  const base = into.position.length / 3;
  const count = geometry.getAttribute('position').count;
  const read = (name: string, size: number, to: number[], fallback: readonly number[], map?: (v: number) => number): void => {
    const a = geometry.getAttribute(name);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < size; k++) {
        const v = a ? a.getComponent(i, k) : fallback[k];
        to.push(map ? map(v) : v);
      }
    }
  };
  read('position', 3, into.position, [0, 0, 0]);
  read('normal', 3, into.normal, [0, 1, 0]);
  const bones = options.bones;
  read('skinIndex', 4, into.skinIndex, [0, 0, 0, 0], bones ? (b) => bones[b] ?? 0 : undefined);
  read('skinWeight', 4, into.skinWeight, [1, 0, 0, 0]);
  // A file's tone is in bytes as they were written, and getComponent does not scale a byte that is not normalized.
  read('tone', 4, into.tone, [options.slot ?? 0, 127.5, options.part ?? 0, 0]);
  read('uv', 2, into.uv, [0, 0]);
  read('color', 3, into.colour, [1, 1, 1]);
  const index = geometry.getIndex();
  if (index) for (let i = 0; i < index.count; i++) into.index.push(base + index.getX(i));
  else for (let i = 0; i < count; i++) into.index.push(base + i);
}

/** The box of the vertices of one part. */
export function partBox(pieces: Pieces, part: number): THREE.Box3 {
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (let i = 0; i < pieces.tone.length / 4; i++) {
    if (pieces.tone[i * 4 + 2] !== part) continue;
    box.expandByPoint(p.fromArray(pieces.position, i * 3));
  }
  return box;
}

export interface ShellOptions {
  slot: SlotName;
  part: number;
  shade?: number;
  /** Corners of the patch, seen from the front: x from left to right, y from top to bottom. */
  x: readonly [number, number];
  y: readonly [number, number];
  /** How far it stands off the body. Default 0.02. */
  lift?: number;
  /** How much wider it flares at the bottom, as a skirt or an apron does. Default 0. */
  flare?: number;
  /** Rows and columns. Default 8 x 6. */
  rows?: number;
  columns?: number;
  /** `front` (+z, the default) or `back`. */
  side?: 'front' | 'back';
}

/**
 * A patch of cloth laid over the body's front: each point finds the body's surface behind it and takes that
 * vertex's bones, so the patch moves with the legs and the chest as the clothes under it do. An apron.
 */
export function addShell(into: Pieces, body: Pieces, options: ShellOptions): void {
  const rows = options.rows ?? 8, columns = options.columns ?? 6;
  const lift = options.lift ?? 0.02, flare = options.flare ?? 0;
  const sign = options.side === 'back' ? -1 : 1;
  const count = body.position.length / 3;
  const base = into.position.length / 3;
  const slot = slotIndex(into, options.slot);
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const y = options.y[0] + (options.y[1] - options.y[0]) * v;
    const widen = 1 + flare * v;
    const mid = (options.x[0] + options.x[1]) / 2, half = ((options.x[1] - options.x[0]) / 2) * widen;
    for (let c = 0; c <= columns; c++) {
      const x = mid - half + (2 * half * c) / columns;
      // The outermost body vertex near this point, front or back.
      let best = -1, front = -Infinity;
      for (let i = 0; i < count; i++) {
        if (body.tone[i * 4 + 2] !== 0) continue;
        const dx = body.position[i * 3] - x, dy = body.position[i * 3 + 1] - y;
        if (dx * dx + dy * dy > 0.012) continue;
        const z = body.position[i * 3 + 2] * sign;
        if (z > front) { front = z; best = i; }
      }
      if (best < 0) {
        // Nothing there: past the edge of the body. Use the nearest vertex at all.
        let near = Infinity;
        for (let i = 0; i < count; i++) {
          if (body.tone[i * 4 + 2] !== 0) continue;
          const dx = body.position[i * 3] - x, dy = body.position[i * 3 + 1] - y;
          if (dx * dx + dy * dy < near) { near = dx * dx + dy * dy; best = i; }
        }
        front = body.position[best * 3 + 2] * sign;
      }
      into.position.push(x, y, (front + lift) * sign);
      into.normal.push(0, 0, sign);
      for (let k = 0; k < 4; k++) {
        into.skinIndex.push(body.skinIndex[best * 4 + k]);
        into.skinWeight.push(body.skinWeight[best * 4 + k]);
      }
      into.tone.push(slot, Math.round((options.shade ?? 1) * 127.5), options.part, 0);
      into.uv.push(0, 0);
      into.colour.push(1, 1, 1);
    }
  }
  const firstIndex = into.index.length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const a = base + r * (columns + 1) + c, b = a + 1, d = a + columns + 1, e = d + 1;
      // Both faces, so it reads from behind as well as in front.
      if (sign > 0) into.index.push(a, d, b, b, d, e);
      else into.index.push(a, b, d, b, e, d);
    }
  }
  smoothShellNormals(into, base, (rows + 1) * (columns + 1), firstIndex);
}

/** Normals from the shell's own shape, now that each point knows how far it stands out. */
function smoothShellNormals(into: Pieces, base: number, count: number, firstIndex: number): void {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(into.position.slice(base * 3, (base + count) * 3), 3));
  g.setIndex(into.index.slice(firstIndex).map((i) => i - base));
  g.computeVertexNormals();
  const n = g.getAttribute('normal');
  for (let i = 0; i < count; i++) {
    into.normal[(base + i) * 3] = n.getX(i);
    into.normal[(base + i) * 3 + 1] = n.getY(i);
    into.normal[(base + i) * 3 + 2] = n.getZ(i);
  }
  g.dispose();
}

/** A turned shape, as a hat is: points of (radius, height) from the top down, turned about y. */
export function lathe(points: readonly (readonly [number, number])[], segments = 14): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h)), segments);
  return g;
}

/** A matrix from a place, a turn in radians about x, y, z, and a scale. */
export function place(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}

/** A capsule from `a` to `b`, all its weight on one bone: a limb of a body's shadow. */
export function addLimb(into: Pieces, a: THREE.Vector3, b: THREE.Vector3, radius: number, bone: number, part = 0): void {
  const length = a.distanceTo(b);
  const capsule = new THREE.CapsuleGeometry(radius, Math.max(0.001, length), 2, 6);
  const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  const matrix = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), turn, new THREE.Vector3(1, 1, 1));
  addPiece(into, capsule, { slot: 'skin', bone, part, matrix });
}
