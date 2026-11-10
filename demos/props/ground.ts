// The demo's own ground: a small grid of blocks drawn with the block atlas, so props are judged against
// the textures they will stand on in the game. It is gentle on purpose: a rise under the forest, flat
// land for the village and a pond. The real world feature has its own mesher: this one is the simplest
// that shows a block face, and stamps go into it through `setBlock`.
import * as THREE from 'three';
import { AIR, BLOCKS, blockId } from '../../src/content/blocks.ts';
import type { WorldQuery } from '../../src/engine/world-query.ts';

export const SIZE = 96;
const HIGH = 24;
/** Land near the village and the pond is this many blocks high. */
export const LAND = 6;
/** How far the water's surface sits under the top of its block, as in the world feature. */
const WATER_DROP = 0.12;

interface AtlasInfo {
  tile: number;
  tiles: Record<string, [number, number][]>;
}

export interface Ground {
  readonly world: WorldQuery;
  readonly group: THREE.Group;
  readonly water: THREE.Mesh;
  getBlock(x: number, y: number, z: number): number;
  setBlock(x: number, y: number, z: number, id: number): void;
  /** The y of the water's surface in this column, or undefined on land. */
  waterLevel(x: number, z: number): number | undefined;
  /** Makes the meshes again after blocks change. Blocks at `hideFrom` and above are left out, to look inside roofs. */
  rebuild(hideFrom?: number): void;
  dispose(): void;
}

function hash(x: number, y: number, z: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 1103515245) + Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(x: number, z: number, size: number, salt: number): number {
  const fx = x / size, fz = z / size, ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz, sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const a = hash(ix, salt, iz), b = hash(ix + 1, salt, iz), c = hash(ix, salt, iz + 1), d = hash(ix + 1, salt, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

const POND = { x: 72, z: 73, r: 10.5 };

/** How far inside the pond a column is: below 0 on land, 1 at the middle. */
function pondDepth(x: number, z: number): number {
  const wobble = (smooth(x, z, 7, 5) - 0.5) * 0.35;
  return 1 - Math.hypot(x + 0.5 - POND.x, (z + 0.5 - POND.z) * 1.15) / POND.r + wobble;
}

// The six faces of a block: which way each looks, its four corners counter-clockwise from outside, and which tile it uses.
const FACES: { normal: [number, number, number]; corners: [number, number, number][]; tile: 'top' | 'side' | 'bottom' }[] = [
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], tile: 'top' },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], tile: 'bottom' },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], tile: 'side' },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], tile: 'side' },
  { normal: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], tile: 'side' },
  { normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], tile: 'side' },
];
const UV: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

export function createGround(atlas: THREE.Texture, info: AtlasInfo): Ground {
  const blocks = new Uint8Array(SIZE * SIZE * HIGH);
  /** 1 where a block was set after the land was made. Only those cast shadow: the land is too gentle to need it. */
  const built = new Uint8Array(SIZE * SIZE * HIGH);
  const index = (x: number, y: number, z: number) => (z * SIZE + x) * HIGH + y;
  const inside = (x: number, y: number, z: number) => x >= 0 && x < SIZE && z >= 0 && z < SIZE && y >= 0 && y < HIGH;
  const getBlock = (x: number, y: number, z: number) => (inside(x, y, z) ? blocks[index(x, y, z)] : AIR);
  const B = { grass: blockId('grass'), dirt: blockId('dirt'), stone: blockId('stone'), sand: blockId('sand'), water: blockId('water'), clay: blockId('clay') };

  // ---- the land
  for (let z = 0; z < SIZE; z++) {
    for (let x = 0; x < SIZE; x++) {
      const depth = pondDepth(x, z);
      let top = LAND;
      if (depth > 0) top = LAND - 1 - Math.min(2, Math.floor(depth * 5));
      else {
        // A rise under the forest in the north, and a low swell in the far corners.
        const north = Math.max(0, Math.min(1, (34 - z) / 22));
        const swell = Math.max(0, Math.min(1, (Math.hypot(x - 40, z - 60) - 44) / 14));
        top = LAND + Math.round(north * (1 + smooth(x, z, 13, 1) * 2.4) + swell * smooth(x, z, 11, 2) * 1.6);
      }
      const shore = depth > -0.16;
      for (let y = 0; y < top; y++) {
        blocks[index(x, y, z)] = y < top - 3 ? B.stone : y < top - 1 ? B.dirt : shore ? (depth > 0.45 ? B.clay : B.sand) : B.grass;
      }
      if (depth > 0) for (let y = top; y < LAND; y++) blocks[index(x, y, z)] = B.water;
    }
  }

  const solidTop = (x: number, z: number): number => {
    const cx = Math.max(0, Math.min(SIZE - 1, Math.floor(x))), cz = Math.max(0, Math.min(SIZE - 1, Math.floor(z)));
    for (let y = HIGH - 1; y >= 0; y--) if (BLOCKS[blocks[index(cx, y, cz)]].solid) return y + 1;
    return 0;
  };
  const world: WorldQuery = {
    heightAt: solidTop,
    surfaceAt(x, z) {
      const top = solidTop(x, z);
      if (BLOCKS[getBlock(Math.floor(x), top, Math.floor(z))].liquid) return 'water';
      return top > 0 ? BLOCKS[getBlock(Math.floor(x), top - 1, Math.floor(z))].surface : 'grass';
    },
    openSky: (x, y, z) => y >= solidTop(x, z),
    lightAt: () => 15,
  };

  // ---- the meshes
  const group = new THREE.Group();
  group.name = 'ground';
  const material = new THREE.MeshLambertMaterial({ map: atlas });
  const land = new THREE.Mesh(new THREE.BufferGeometry(), material);
  land.name = 'ground:land';
  land.receiveShadow = true;
  const town = new THREE.Mesh(new THREE.BufferGeometry(), material);
  town.name = 'ground:built';
  town.castShadow = true;
  town.receiveShadow = true;
  const plainWater = new THREE.MeshBasicMaterial({ color: 0x3f86c8 });
  const water = new THREE.Mesh(new THREE.BufferGeometry(), plainWater);
  water.name = 'ground:water';
  water.renderOrder = 5;
  group.add(land, town, water);

  const image = atlas.image as { width: number; height: number };
  const tileU = info.tile / image.width, tileV = info.tile / image.height;
  // Half a pixel in from each edge of a tile, so a face never picks up its neighbor in the atlas.
  const inset = 0.5 / info.tile;

  interface Faces {
    positions: number[];
    normals: number[];
    uvs: number[];
    indices: number[];
  }

  function fill(mesh: THREE.Mesh, faces: Faces): void {
    mesh.geometry.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(faces.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(faces.uvs, 2));
    geometry.setIndex(faces.indices);
    mesh.geometry = geometry;
  }

  function rebuild(hideFrom = HIGH): void {
    const natural: Faces = { positions: [], normals: [], uvs: [], indices: [] };
    const made: Faces = { positions: [], normals: [], uvs: [], indices: [] };
    const wet: number[] = [];
    const shown = (x: number, y: number, z: number) => (y >= hideFrom ? AIR : getBlock(x, y, z));
    for (let z = 0; z < SIZE; z++) {
      for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < Math.min(HIGH, hideFrom); y++) {
          const id = blocks[index(x, y, z)];
          if (id === AIR) continue;
          const def = BLOCKS[id];
          const { positions, normals, uvs, indices } = built[index(x, y, z)] ? made : natural;
          if (def.liquid) {
            if (!BLOCKS[shown(x, y + 1, z)].liquid) {
              const top = y + 1 - WATER_DROP;
              wet.push(x, top, z + 1, x + 1, top, z + 1, x + 1, top, z, x, top, z + 1, x + 1, top, z, x, top, z);
            }
            continue;
          }
          for (const face of FACES) {
            const nx = x + face.normal[0], ny = y + face.normal[1], nz = z + face.normal[2];
            // The underside of the land is never seen.
            if (ny < 0) continue;
            const next = BLOCKS[shown(nx, ny, nz)];
            if (next.opaque || (next.id === id && !def.opaque)) continue;
            const variants = info.tiles[def.tiles[face.tile]];
            if (!variants) continue;
            const [col, row] = variants[Math.floor(hash(x, y, z) * variants.length)];
            const base = positions.length / 3;
            for (let i = 0; i < 4; i++) {
              const c = face.corners[i];
              positions.push(x + c[0], y + c[1], z + c[2]);
              normals.push(face.normal[0], face.normal[1], face.normal[2]);
              uvs.push((col + inset + UV[i][0] * (1 - 2 * inset)) * tileU, 1 - (row + 1 - inset - UV[i][1] * (1 - 2 * inset)) * tileV);
            }
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }
    fill(land, natural);
    fill(town, made);
    water.geometry.dispose();
    const pond = new THREE.BufferGeometry();
    pond.setAttribute('position', new THREE.Float32BufferAttribute(wet, 3));
    water.geometry = pond;
  }

  return {
    world,
    group,
    water,
    getBlock,
    setBlock(x, y, z, id) {
      if (!inside(x, y, z)) return;
      blocks[index(x, y, z)] = id;
      built[index(x, y, z)] = 1;
    },
    waterLevel(x, z) {
      const fx = Math.floor(x), fz = Math.floor(z);
      for (let y = HIGH - 1; y >= 0; y--) if (BLOCKS[getBlock(fx, y, fz)].liquid) return y + 1 - WATER_DROP;
      return undefined;
    },
    rebuild,
    dispose() {
      land.geometry.dispose();
      town.geometry.dispose();
      water.geometry.dispose();
      material.dispose();
      plainWater.dispose();
    },
  };
}
