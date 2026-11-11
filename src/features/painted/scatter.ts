// The small things that stand on the painted land: boulders and bushes. Each kind is a few instanced batches,
// so a hundred of them cost a handful of draw calls. The game says where each one stands and takes it away
// again by the number it was given.
import * as THREE from 'three';
import { fbm } from './land.ts';
import { paint } from './paint.ts';
import type { Textures } from './textures.ts';
import { buildTree, createStand, type Foliage, type Placement, type TreeSpec } from './trees.ts';

export interface Scatter {
  readonly group: THREE.Group;
  /** Stands one thing and returns its number, which is never 0. */
  place(x: number, y: number, z: number, turn: number, scale: number, variant: number, ripe?: boolean): number;
  remove(id: number): void;
  /** Call once a frame: it writes the batches again if anything was placed or removed. */
  update(): void;
  readonly count: number;
}

/** A few large planes, as a painter blocks a rock in: a coarse ball pushed out of shape, then cut flat underneath. */
function boulder(seed: number, wide: number, tall: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 1), pos = g.getAttribute('position'), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const push = 0.72 + 0.6 * fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 1.7, 2, seed);
    v.multiplyScalar(push);
    pos.setXYZ(i, v.x * wide, Math.max(-0.25, v.y * 0.72) * tall, v.z);
  }
  g.computeVertexNormals();
  const normal = g.getAttribute('normal'), colors = new Float32Array(pos.count * 3);
  const stone = new THREE.Color('#b3ada0'), low = new THREE.Color('#8d8a8c'), moss = new THREE.Color('#7fa650'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(low).lerp(stone, THREE.MathUtils.smoothstep(pos.getY(i), -0.2, 0.5));
    if (normal.getY(i) > 0.78) c.lerp(moss, 0.75);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

interface Stone { x: number; y: number; z: number; turn: number; scale: number; shape: number }

/** Boulders in three shapes: a round one, a long low one and a tall one. `capacity` is how many of each shape. */
export function createBoulders(textures: Textures, capacity = 384): Scatter {
  const group = new THREE.Group();
  group.name = 'boulders';
  const material = paint({
    vertexColors: true, brush: 0.4, bands: 0.85, wrap: 0.15, brushScale: 0.3,
    uniforms: { uRock: { value: textures.rock } },
    fragmentPars: 'uniform sampler2D uRock;',
    fragmentAlbedo: 'diffuseColor.rgb *= 0.6 + 0.8 * texture2D(uRock, vPaintWorld.xz * 0.2 + vPaintWorld.y * 0.13).g;',
  });
  const batches = [boulder(1, 1.25, 1), boulder(2, 1.7, 0.7), boulder(3, 1.05, 1.35)].map((shape) => {
    const mesh = new THREE.InstancedMesh(shape, material, capacity);
    mesh.count = 0;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  });
  const stones = new Map<number, Stone>();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), size = new THREE.Vector3();
  let next = 1, dirty = false;
  return {
    group,
    place(x, y, z, turn, scale, variant) {
      const id = next++;
      stones.set(id, { x, y, z, turn, scale, shape: Math.abs(variant + Math.floor(x * 3 + z * 7)) % batches.length });
      dirty = true;
      return id;
    },
    remove(id) { dirty = stones.delete(id) || dirty; },
    update() {
      if (!dirty) return;
      dirty = false;
      for (const batch of batches) batch.count = 0;
      for (const s of stones.values()) {
        const batch = batches[s.shape] as THREE.InstancedMesh;
        if (batch.count >= capacity) continue;
        // A boulder sits a little into the ground, so no edge of it floats on a slope.
        m.compose(at.set(s.x, s.y + s.scale * 0.02, s.z), q.setFromAxisAngle(up, s.turn), size.setScalar(s.scale));
        batch.setMatrixAt(batch.count++, m);
      }
      for (const batch of batches) batch.instanceMatrix.needsUpdate = true;
    },
    get count() { return stones.size; },
  };
}

/** A bush is a tree with almost no trunk: a low mound of the same leaf sprays. */
const BUSHES: readonly TreeSpec[] = [
  { seed: 211, height: 0.95, trunk: 0.07, crown: 1.15, blobs: 5, card: 0.45, cover: 2.4, squash: 0.62, lean: 0, inset: [0.55, 1.05], under: -0.5 },
  { seed: 223, height: 0.8, trunk: 0.06, crown: 1.45, blobs: 6, card: 0.45, cover: 2.2, squash: 0.48, lean: 0.2, inset: [0.55, 1.05], under: -0.5 },
  { seed: 239, height: 1.25, trunk: 0.08, crown: 1.0, blobs: 5, card: 0.45, cover: 2.4, squash: 0.85, lean: -0.2, inset: [0.55, 1.05], under: -0.5 },
];
/** Where the berries of a ripe bush hang, on a ball of radius 1 round the bush's middle. */
const BERRIES: readonly (readonly [number, number, number])[] = [
  [0.7, 0.35, 0.5], [-0.6, 0.5, 0.55], [0.15, 0.8, 0.6], [-0.85, 0.1, -0.2], [0.9, 0.2, -0.3], [0.3, 0.3, 0.92], [-0.3, 0.2, -0.9], [0.5, 0.65, -0.55], [-0.5, 0.75, 0.1],
];

interface Bush { place: Placement; shape: number; ripe: boolean }

/** Bushes in three shapes, in the trees' own leaves. A ripe one carries red berries. */
export function createBushes(materials: Foliage, capacity = 256): Scatter {
  const group = new THREE.Group();
  group.name = 'bushes';
  // Leaves only: the stems of a bush are hidden in it, and it is too small for its shadow to be missed.
  const stands = BUSHES.map((spec) => createStand({ ...buildTree(spec), wood: new THREE.BufferGeometry() }, materials, capacity, false));
  const lists: Placement[][] = BUSHES.map(() => []);
  for (const stand of stands) group.add(stand.group);
  const berries = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075, 1), paint({ color: '#d8343f', brush: 0, bands: 0.5, wrap: 0.4 }), 64 * BERRIES.length);
  berries.count = 0;
  berries.frustumCulled = false;
  group.add(berries);
  const bushes = new Map<number, Bush>();
  const m = new THREE.Matrix4();
  let next = 1, dirty = false;
  return {
    group,
    place(x, y, z, turn, scale, variant, ripe = false) {
      const id = next++;
      const warm = ((Math.abs(Math.floor(x * 13 + z * 29)) % 16) / 16 - 0.5) * 0.14;
      bushes.set(id, { place: { x, y: y - 0.05, z, turn, scale, tint: new THREE.Color(1 + warm, 1 + warm * 0.3, 1 - warm) }, shape: Math.abs(variant) % BUSHES.length, ripe });
      dirty = true;
      return id;
    },
    remove(id) { dirty = bushes.delete(id) || dirty; },
    update() {
      if (!dirty) return;
      dirty = false;
      for (const list of lists) list.length = 0;
      berries.count = 0;
      for (const b of bushes.values()) {
        (lists[b.shape] as Placement[]).push(b.place);
        if (!b.ripe) continue;
        const spec = BUSHES[b.shape] as TreeSpec, s = b.place.scale, r = spec.crown * 0.92, cos = Math.cos(b.place.turn), sin = Math.sin(b.place.turn);
        const middle = Math.max(spec.crown * spec.squash * 0.75, spec.height - spec.crown * spec.squash * 0.5);
        for (const [bx, by, bz] of BERRIES) {
          if (berries.count >= berries.instanceMatrix.count) break;
          const x = (bx * cos + bz * sin) * r, z = (bz * cos - bx * sin) * r;
          m.makeTranslation(b.place.x + x * s, b.place.y + (middle + by * r * spec.squash) * s, b.place.z + z * s);
          berries.setMatrixAt(berries.count++, m);
        }
      }
      stands.forEach((stand, i) => stand.plant(lists[i] as Placement[]));
      berries.instanceMatrix.needsUpdate = true;
    },
    get count() { return bushes.size; },
  };
}
