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
  /**
   * How finely they are drawn: `shadows` says whether they cast shadows, `fine` whether a bush wears all its
   * leaves or fewer, larger ones. The quality level sets both.
   */
  detail?(shadows: boolean, fine: boolean): void;
  /**
   * What is drawn: only things within `reach` blocks of this point, and a bush within `fine` blocks in all its
   * leaves (past it, fewer, larger ones). The quality level sets both. Call it every frame; it plants again only
   * when the point has moved a few steps or the numbers changed. Never called, everything is drawn.
   */
  range?(x: number, z: number, reach: number, fine?: number): void;
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

/** A standing stone: a tall slab set on end, wider at its foot, with moss where it meets the ground and on its head. */
function menhir(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.84, 1.02, 3.7, 7, 5).toNonIndexed(), pos = g.getAttribute('position'), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const up = (v.y + 1.85) / 3.7, out = 1 + 0.16 * fbm(v.x * 1.1 + 5, v.y * 0.9 + v.z * 1.3, 2, 7);
    // The head is cut on a slant and the whole stone leans a little.
    pos.setXYZ(i, v.x * out + up * 0.12, (v.y + 1.75) * (1 - 0.07 * v.x * up), v.z * out * 0.92);
  }
  g.computeVertexNormals();
  const normal = g.getAttribute('normal'), colors = new Float32Array(pos.count * 3);
  const stone = new THREE.Color('#b9b3a6'), low = new THREE.Color('#8f8c8e'), moss = new THREE.Color('#7fa650'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    c.copy(low).lerp(stone, THREE.MathUtils.smoothstep(y, 0.2, 2.6));
    if (normal.getY(i) > 0.6 || y < 0.25 + 0.3 * fbm(pos.getX(i) * 2, pos.getZ(i) * 2, 2, 3)) c.lerp(moss, 0.7);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

/** The variant that asks for the standing stone, which no scattered boulder is. */
export const STANDING_STONE = 100;

interface Stone { x: number; y: number; z: number; turn: number; scale: number; shape: number }

/**
 * Boulders in three shapes: a round one, a long low one and a tall one. `capacity` is how many of each shape.
 * A fourth shape is the standing stone, placed only by asking for the variant `STANDING_STONE`.
 */
export function createBoulders(textures: Textures, capacity = 384): Scatter {
  const group = new THREE.Group();
  group.name = 'boulders';
  const material = paint({
    vertexColors: true, brush: 0.4, bands: 0.85, wrap: 0.15, brushScale: 0.3, see: 'solid',
    uniforms: { uRock: { value: textures.rock } },
    fragmentPars: 'uniform sampler2D uRock;',
    fragmentAlbedo: 'diffuseColor.rgb *= 0.6 + 0.8 * texture2D(uRock, vPaintWorld.xz * 0.2 + vPaintWorld.y * 0.13).g;',
  });
  const SCATTERED = 3;
  const shapes = [boulder(1, 1.25, 1), boulder(2, 1.7, 0.7), boulder(3, 1.05, 1.35), menhir()];
  const batch = (shape: THREE.BufferGeometry, i: number, shadow: boolean): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(shape, material, i < SCATTERED ? capacity : 8);
    mesh.count = 0;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  // The boulders within SHADOWED of the point `range` was given cast shadows; the rest are drawn without.
  const batches = shapes.map((shape, i) => batch(shape, i, true)), unshaded = shapes.map((shape, i) => batch(shape, i, false));
  let shadows = true;
  const stones = new Map<number, Stone>();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), size = new THREE.Vector3();
  let next = 1, dirty = false;
  const near = { x: 0, z: 0, reach: Infinity };
  return {
    group,
    place(x, y, z, turn, scale, variant) {
      const id = next++;
      stones.set(id, { x, y, z, turn, scale, shape: variant === STANDING_STONE ? SCATTERED : Math.abs(variant + Math.floor(x * 3 + z * 7)) % SCATTERED });
      dirty = true;
      return id;
    },
    remove(id) { dirty = stones.delete(id) || dirty; },
    update() {
      if (!dirty) return;
      dirty = false;
      for (const mesh of batches) mesh.count = 0;
      for (const mesh of unshaded) mesh.count = 0;
      const reach2 = near.reach * near.reach;
      for (const s of stones.values()) {
        const away2 = (s.x - near.x) ** 2 + (s.z - near.z) ** 2;
        // A standing stone is a landmark: it is drawn from any distance, with its shadow.
        if (s.shape < SCATTERED && away2 > reach2) continue;
        const batch = ((shadows && (s.shape >= SCATTERED || near.reach === Infinity || away2 < SHADOWED * SHADOWED)) ? batches : unshaded)[s.shape] as THREE.InstancedMesh;
        if (batch.count >= batch.instanceMatrix.count) continue;
        // A boulder sits a little into the ground, so no edge of it floats on a slope.
        m.compose(at.set(s.x, s.y + s.scale * 0.02, s.z), q.setFromAxisAngle(up, s.turn), size.setScalar(s.scale));
        batch.setMatrixAt(batch.count++, m);
      }
      for (const mesh of [...batches, ...unshaded]) { mesh.instanceMatrix.needsUpdate = true; mesh.visible = mesh.count > 0; }
    },
    detail(cast) { if (cast !== shadows) { shadows = cast; dirty = true; } },
    range(x, z, reach) { dirty = moved(near, x, z, reach) || dirty; },
    get count() { return stones.size; },
  };
}

/** Steps the point may move before what is in range is chosen again. */
const STEP = 6;
/** Nearer than this to that point a boulder casts a shadow. Its shadow costs its triangles again. */
const SHADOWED = 32;
/** Moves `near` to a point, and says whether what is in range must be chosen again. */
function moved(near: { x: number; z: number; reach: number; fine?: number }, x: number, z: number, reach: number, fine = 0): boolean {
  if (reach === near.reach && fine === (near.fine ?? 0) && (x - near.x) ** 2 + (z - near.z) ** 2 < STEP * STEP) return false;
  near.x = x; near.z = z; near.reach = reach; near.fine = fine;
  return true;
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
/** `greyAt` says how grey the land is at a bush, from 0 to 1. Left out, no bush is grey. */
export function createBushes(materials: Foliage, capacity = 256, greyAt?: (x: number, z: number) => number): Scatter {
  const group = new THREE.Group();
  group.name = 'bushes';
  // Leaves only: the stems of a bush are hidden in it, and it is too small for its shadow to be missed.
  const stands = BUSHES.map((spec) => createStand({ ...buildTree(spec), wood: new THREE.BufferGeometry() }, materials, capacity, false));
  // The same bushes in larger, fewer cards, for a level that keeps fewer triangles.
  const coarse = BUSHES.map((spec) => createStand({ ...buildTree({ ...spec, card: spec.card * 1.7, cover: 1.4 }), wood: new THREE.BufferGeometry() }, materials, capacity, false));
  const lists: Placement[][] = BUSHES.map(() => []), farLists: Placement[][] = BUSHES.map(() => []);
  for (const stand of [...stands, ...coarse]) group.add(stand.group);
  let fine = true;
  const berries = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075, 1), paint({ color: '#d8343f', brush: 0, bands: 0.5, wrap: 0.4 }), 64 * BERRIES.length);
  berries.count = 0;
  berries.frustumCulled = false;
  group.add(berries);
  const bushes = new Map<number, Bush>();
  const m = new THREE.Matrix4();
  let next = 1, dirty = false;
  const near = { x: 0, z: 0, reach: Infinity, fine: Infinity };
  return {
    group,
    place(x, y, z, turn, scale, variant, ripe = false) {
      const id = next++;
      const warm = ((Math.abs(Math.floor(x * 13 + z * 29)) % 16) / 16 - 0.5) * 0.14;
      bushes.set(id, { place: { x, y: y - 0.05, z, turn, scale, tint: new THREE.Color(1 + warm, 1 + warm * 0.3, 1 - warm), grey: greyAt?.(x, z) ?? 0 }, shape: Math.abs(variant) % BUSHES.length, ripe });
      dirty = true;
      return id;
    },
    remove(id) { dirty = bushes.delete(id) || dirty; },
    detail(_shadows, isFine) { if (isFine !== fine) { fine = isFine; dirty = true; } },
    range(x, z, reach, fineReach = Infinity) { dirty = moved(near, x, z, reach, fineReach) || dirty; },
    update() {
      if (!dirty) return;
      dirty = false;
      for (const list of lists) list.length = 0;
      for (const list of farLists) list.length = 0;
      berries.count = 0;
      const reach2 = near.reach * near.reach, fine2 = near.fine * near.fine;
      for (const b of bushes.values()) {
        const away2 = (b.place.x - near.x) ** 2 + (b.place.z - near.z) ** 2;
        if (away2 > reach2) continue;
        // Past `fine`, a bush wears fewer, larger leaves.
        (fine && away2 <= fine2 ? lists : farLists)[b.shape]?.push(b.place);
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
      coarse.forEach((stand, i) => stand.plant(farLists[i] as Placement[]));
      berries.instanceMatrix.needsUpdate = true;
    },
    get count() { return bushes.size; },
  };
}
