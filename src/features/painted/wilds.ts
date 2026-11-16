// The small things of each kind of land, grown on the land as it loads, like the grass: ferns and roots in the
// old forest, fallen logs, grey grass in the grey forest, bulrushes on the marsh's pool rims and lily pads and
// stepping stones in its pools, scree on the cave hills (WILDS in src/content/painted.ts). The game hands in
// each one's shapes (props built by the props feature's builders); this stands them in the painted light.
//
// The land is cut into cells of one chunk. A cell grows its things once and keeps them. Each shape is one
// instanced draw call, drawn only while some of it stands within its reach of the hero.
import * as THREE from 'three';
import { WILDS, type Wild } from '../../content/painted.ts';
import { QUALITY, type Level } from '../../content/quality.ts';
import type { Land } from './land.ts';
import { POOL_AT } from './nature.ts';
import { paint } from './paint.ts';

export interface Wilds {
  readonly group: THREE.Group;
  /** Grows and keeps the small things round this point. Call it every frame. */
  update(x: number, z: number): void;
  setQuality(quality: Level): void;
  readonly triangles: number;
  /** How many stand in reach now. */
  readonly count: number;
}

const CELL = 16;
/** Cells grown in one frame at most. */
const PER_FRAME = 2;
/** Most copies of one shape drawn at once. */
const CAPACITY = 1200;
/** The props' palette is muted for the old block look. The painted light wants it this much brighter. */
const LIFT = 1.18;
/** Ground this bare, and up to where a plant will not grow, is a verge: the edge of a path or a bare patch. */
const VERGE = 0.04;
/** The green a plant's own colours are made for: a plant that takes the ground's colour is tinted by the ground over this. */
const PLANT_GREEN = new THREE.Color(0x6c8043);

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** One shape: a variant of one wild thing, its draw call and what stands in reach. */
interface Batch { wild: Wild; mesh: THREE.InstancedMesh; greys: THREE.InstancedBufferAttribute; triangles: number }

/** What a cell grew: for each batch, a list of x, y, z, turn, scale, r, g, b, grey. */
interface Cell { stamp: number; items: Float32Array[] }
const STRIDE = 9;

/** `shapes` gives each wild's variants by its prop's name. A prop with no shapes is left out. */
export function createWilds(land: Land, shapes: ReadonlyMap<string, readonly THREE.BufferGeometry[]>, quality: Level): Wilds {
  const group = new THREE.Group();
  group.name = 'wilds';
  let level = QUALITY[quality];
  const material = paint({
    vertexColors: true, brush: 0.3, bands: 0.5, wrap: 0.35, brushScale: 0.2, dapple: 1,
    vertexPars: 'attribute vec2 aFx; attribute float aGrey; varying float vGrey;',
    // A leaf or a blade sways with the gusts by how much its builder marked it to; the root stays still.
    vertexWorld: /* glsl */ `
      float gust = paintGust(paintWorldPos.xz);
      paintWorldPos.xz += uWind.xy * aFx.x * (0.04 + 0.22 * gust) * (0.7 + 0.3 * sin(uTime * 2.2 + paintWorldPos.x * 0.7));
      vGrey = aGrey;`,
    // The grey look's uniforms come with the shared ones.
    fragmentPars: 'uniform vec3 uGreyLeaf; uniform float uGreyDrain; varying float vGrey;',
    fragmentAlbedo: 'diffuseColor.rgb = mix(diffuseColor.rgb, uGreyLeaf * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) / dot(uGreyLeaf, vec3(0.3, 0.59, 0.11)), vGrey * uGreyDrain);',
  });
  const batches: Batch[] = [];
  /** For each wild, the index of its first batch. */
  const firstOf: number[] = [];
  for (const wild of WILDS) {
    firstOf.push(batches.length);
    const variants = shapes.get(wild.prop) ?? [];
    for (let v = 0; v < Math.min(wild.variants, variants.length); v++) {
      const geometry = (variants[v] as THREE.BufferGeometry).clone();
      const greys = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1);
      greys.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('aGrey', greys);
      if (!geometry.getAttribute('aFx')) geometry.setAttribute('aFx', new THREE.Float32BufferAttribute(new Float32Array((geometry.getAttribute('position')?.count ?? 0) * 2), 2));
      const mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.name = `wild-${wild.prop}-${v}`;
      group.add(mesh);
      batches.push({ wild, mesh, greys, triangles: (geometry.index ? geometry.index.count : (geometry.getAttribute('position')?.count ?? 0)) / 3 });
    }
  }
  const variantsOf = WILDS.map((_wild, w) => (w + 1 < WILDS.length ? (firstOf[w + 1] as number) : batches.length) - (firstOf[w] as number));

  const cells = new Map<number, Cell>();
  const key = (cx: number, cz: number): number => ((cx + 8192) << 14) | (cz + 8192);
  const ground = land.ground, nature = new Float32Array(ground.size), color = new THREE.Color();
  const reachOf = (wild: Wild): number => wild.reach * level.wildsReach;
  const farthest = (): number => Math.max(...WILDS.map(reachOf));

  function grow(cx: number, cz: number): Cell | null {
    const x0 = cx * CELL, z0 = cz * CELL;
    if (!(land.heightAt(x0 + 8, z0 + 8) === land.heightAt(x0 + 8, z0 + 8))) return null;
    const items: number[][] = batches.map(() => []);
    const r = random(Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 4111);
    WILDS.forEach((wild, w) => {
      const variants = variantsOf[w] as number;
      if (variants === 0) return;
      // A wild that banks along a verge tries that many times as often, and keeps as many of its tries elsewhere.
      const most = Math.max(...Object.values(wild.on)) * (wild.verge ?? 1);
      const tries = Math.round(CELL * CELL * most * level.wilds);
      for (let i = 0; i < tries; i++) {
        const px = x0 + r() * CELL, pz = z0 + r() * CELL, pick = r(), variant = Math.floor(r() * variants), turn = r() * Math.PI * 2, size = r();
        if (!land.natureAt(px, pz, nature)) continue;
        let want = 0;
        for (const name in wild.on) want += ground.share(nature, name) * (wild.on[name] as number);
        const bare = land.bareAt(px, pz), pool = nature[ground.POOL] as number, patch = nature[ground.PATCH] as number;
        if (wild.verge && bare > VERGE && bare <= 0.45) want *= wild.verge;
        if (pick * most > want) continue;
        if (wild.where === 'pool' ? pool < POOL_AT + 0.02 : wild.where === 'rim' ? pool < POOL_AT - 0.06 || pool > POOL_AT + 0.004 : wild.where === 'bare' ? patch < 0.5 || pool > POOL_AT - 0.05 : bare > 0.45) continue;
        const scale = wild.size[0] + size * (wild.size[1] - wild.size[0]);
        const y = land.heightAt(px, pz) - (wild.sink ?? 0) * scale + (wild.where === 'pool' ? 0.01 : 0);
        const grey = nature[ground.GREY] as number;
        if (wild.ground) {
          land.colorAt(px, pz, color);
          color.setRGB(color.r / PLANT_GREEN.r, color.g / PLANT_GREEN.g, color.b / PLANT_GREEN.b).multiplyScalar(0.62);
        } else color.setRGB(LIFT, LIFT, LIFT);
        (items[(firstOf[w] as number) + variant] as number[]).push(px, y, pz, turn, scale, color.r, color.g, color.b, grey);
      }
    });
    return { stamp: land.stampAt(cx, cz), items: items.map((list) => new Float32Array(list)) };
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), size = new THREE.Vector3();
  let lastX = NaN, lastZ = NaN, stale = true, triangles = 0, count = 0;
  /** Writes what stands within each wild's reach of the hero into the batches. */
  function fill(x: number, z: number): void {
    triangles = 0; count = 0;
    batches.forEach((b, i) => {
      const reach = reachOf(b.wild), reach2 = reach * reach;
      let n = 0;
      cells.forEach((cell) => {
        const list = cell.items[i] as Float32Array;
        for (let k = 0; k < list.length && n < CAPACITY; k += STRIDE) {
          const px = list[k] as number, pz = list[k + 2] as number, dx = px - x, dz = pz - z;
          if (dx * dx + dz * dz > reach2) continue;
          m.compose(at.set(px, list[k + 1] as number, pz), q.setFromAxisAngle(up, list[k + 3] as number), size.setScalar(list[k + 4] as number));
          b.mesh.setMatrixAt(n, m);
          b.mesh.setColorAt(n, color.setRGB(list[k + 5] as number, list[k + 6] as number, list[k + 7] as number));
          b.greys.setX(n, list[k + 8] as number);
          n++;
        }
      });
      b.mesh.count = n;
      b.mesh.visible = n > 0;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      b.greys.needsUpdate = true;
      triangles += n * b.triangles; count += n;
    });
  }

  return {
    group,
    update(x, z) {
      const fx = Math.floor(x / CELL), fz = Math.floor(z / CELL), reach = Math.ceil(farthest() / CELL);
      // Listed again when the hero has walked four blocks: a thing comes into reach a few steps before it is seen.
      if (Math.hypot(x - lastX, z - lastZ) > 4) stale = true;
      let budget = PER_FRAME;
      for (let ring = 0; ring <= reach && budget > 0; ring++) {
        for (let dx = -ring; dx <= ring && budget > 0; dx++) {
          for (let dz = -ring; dz <= ring && budget > 0; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const k = key(fx + dx, fz + dz), have = cells.get(k);
            if (have && have.stamp === land.stampAt(fx + dx, fz + dz)) continue;
            const grown = grow(fx + dx, fz + dz);
            if (!grown) continue;
            cells.set(k, grown);
            stale = true;
            budget--;
          }
        }
      }
      if (!stale) return;
      stale = false;
      lastX = x; lastZ = z;
      cells.forEach((_, k) => {
        const cx = (k >> 14) - 8192, cz = (k & 16383) - 8192;
        if (Math.abs(cx - fx) > reach + 1 || Math.abs(cz - fz) > reach + 1) cells.delete(k);
      });
      fill(x, z);
    },
    setQuality(next) { level = QUALITY[next]; cells.clear(); stale = true; },
    get triangles() { return triangles; },
    get count() { return count; },
  };
}
