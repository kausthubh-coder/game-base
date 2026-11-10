// The demo's own small world: flat grass, a pond, a few trees, crates, a wall and a lamp.
// It is four draw calls, so what the sky features add on top is easy to count.
import * as THREE from 'three';
import type { Surface } from '../../src/engine/types.ts';
import { flatWorld, type WorldQuery } from '../../src/engine/world-query.ts';

const HALF = 32;
const WATER_LEVEL = -0.2;
const POND = { x: 10, z: 6, rx: 7.5, rz: 5.5 };

export interface DemoScene {
  readonly world: WorldQuery;
  readonly group: THREE.Group;
  readonly pond: THREE.Mesh;
  /** Where the camera looks, where effects are fired, and the middle of the pond's near shore. */
  readonly focus: THREE.Vector3;
  readonly effectSpot: THREE.Vector3;
  readonly pondSpot: THREE.Vector3;
  /** Puts the water feature's material on the pond. null puts the plain one back. */
  setWaterMaterial(material: THREE.Material | null): void;
  /** Darkens the ground, the way the world feature will for wet blocks. */
  setWetness(wetness: number): void;
  dispose(): void;
}

function hash(x: number, z: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** How deep the pond's bed is in this column, or 0 on land. */
function pondBed(x: number, z: number): number {
  const dx = (Math.floor(x) + 0.5 - POND.x) / POND.rx;
  const dz = (Math.floor(z) + 0.5 - POND.z) / POND.rz;
  const d = Math.hypot(dx, dz);
  if (d >= 1) return 0;
  return d > 0.75 ? -1 : d > 0.45 ? -2 : -3;
}

/** A soft grey tile, 32 pixels to a block. The color comes from the vertices. */
function tileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const g = canvas.getContext('2d') as CanvasRenderingContext2D;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const coarse = hash(x >> 2, (y >> 2) + 91);
      const fine = hash(x + 7, y + 13);
      const v = Math.round(222 + coarse * 12 + (fine > 0.86 ? 14 : fine < 0.12 ? -16 : 0));
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Collects quads and boxes into one geometry with positions, normals, colors and uvs. */
class Builder {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private uvs: number[] = [];
  private scratch = new THREE.Color();

  /** Four corners, counter-clockwise seen from the side the normal points to. */
  quad(corners: number[][], normal: number[], color: number, shade = 1): void {
    const c = this.scratch.setHex(color).multiplyScalar(shade);
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = corners[i];
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.colors.push(c.r, c.g, c.b);
      // One tile to a block, read from whichever two axes the face lies along.
      if (normal[1] !== 0) this.uvs.push(p[0], p[2]);
      else if (normal[0] !== 0) this.uvs.push(p[2], p[1]);
      else this.uvs.push(p[0], p[1]);
    }
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number): void {
    this.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], color, 1);
    this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], color, 0.7);
    this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], color, 0.92);
    this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], color, 0.92);
    this.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], color, 0.86);
    this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], color, 0.86);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    return geometry;
  }
}

interface Solid {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  top: number;
  surface: Surface;
}

export function createDemoScene(): DemoScene {
  const group = new THREE.Group();
  group.name = 'demo-scene';
  const tile = tileTexture();
  // Things that stand on the ground. The world answers from this list, so rain lands on a tree, not under it.
  const solids: Solid[] = [];

  // ---- the ground: one quad for each block top, walls where the pond drops, and a wide skirt to the horizon
  const ground = new Builder();
  const GRASS = [0x7dbb5c, 0x79b759, 0x82bf60, 0x76b356];
  for (let z = -HALF; z < HALF; z++) {
    for (let x = -HALF; x < HALF; x++) {
      const y = pondBed(x, z);
      const color = y < 0 ? (y < -1 ? 0x8a7a5c : 0xb8a878) : GRASS[Math.floor(hash(x, z) * GRASS.length)];
      ground.quad([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [x, y, z]], [0, 1, 0], color);
      // A wall wherever the next column is lower.
      const east = pondBed(x + 1, z);
      const south = pondBed(x, z + 1);
      if (east < y) ground.quad([[x + 1, east, z + 1], [x + 1, east, z], [x + 1, y, z], [x + 1, y, z + 1]], [1, 0, 0], 0x9a7a52, 0.9);
      if (east > y) ground.quad([[x + 1, y, z], [x + 1, y, z + 1], [x + 1, east, z + 1], [x + 1, east, z]], [-1, 0, 0], 0x9a7a52, 0.9);
      if (south < y) ground.quad([[x, south, z + 1], [x + 1, south, z + 1], [x + 1, y, z + 1], [x, y, z + 1]], [0, 0, 1], 0x9a7a52, 0.95);
      if (south > y) ground.quad([[x + 1, y, z + 1], [x, y, z + 1], [x, south, z + 1], [x + 1, south, z + 1]], [0, 0, -1], 0x9a7a52, 0.95);
    }
  }
  const FAR = 600;
  const skirt = (x0: number, z0: number, x1: number, z1: number) => ground.quad([[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]], [0, 1, 0], 0x7bb95a);
  skirt(-FAR, -FAR, FAR, -HALF);
  skirt(-FAR, HALF, FAR, FAR);
  skirt(-FAR, -HALF, -HALF, HALF);
  skirt(HALF, -HALF, FAR, HALF);
  const groundMaterial = new THREE.MeshLambertMaterial({ map: tile, vertexColors: true });
  const groundMesh = new THREE.Mesh(ground.build(), groundMaterial);
  groundMesh.name = 'ground';
  groundMesh.receiveShadow = true;

  // ---- things that catch and cast shadows, all in one mesh
  const props = new Builder();
  const tree = (x: number, z: number, trunk: number, leaves: number) => {
    props.box(x - 0.3, 0, z - 0.3, x + 0.3, trunk, z + 0.3, 0x7a5a3a);
    props.box(x - 1.5, trunk, z - 1.5, x + 1.5, trunk + 1.4, z + 1.5, leaves);
    props.box(x - 1.1, trunk + 1.4, z - 1.1, x + 1.1, trunk + 2.5, z + 1.1, leaves);
    props.box(x - 0.6, trunk + 2.5, z - 0.6, x + 0.6, trunk + 3.3, z + 0.6, leaves);
    solids.push({ x0: x - 1.5, z0: z - 1.5, x1: x + 1.5, z1: z + 1.5, top: trunk + 1.4, surface: 'leaves' });
  };
  tree(-4.5, -3.5, 2.6, 0x4f9a4a);
  tree(-9.5, 1.5, 3.2, 0x58a552);
  tree(-1.5, -9.5, 3, 0x478f44);
  tree(6.5, -7.5, 2.4, 0x5fa850);
  tree(15.5, -5.5, 3.4, 0x4f9a4a);
  tree(-12.5, -8.5, 2.8, 0x58a552);
  tree(-6.5, 9.5, 3, 0x478f44);
  tree(20.5, 9.5, 2.6, 0x5fa850);
  tree(1.5, 14.5, 3.2, 0x4f9a4a);
  const crate = (x: number, y: number, z: number) => {
    props.box(x, y, z, x + 1, y + 1, z + 1, 0xb98a52);
    solids.push({ x0: x, z0: z, x1: x + 1, z1: z + 1, top: y + 1, surface: 'wood' });
  };
  crate(1, 0, -2);
  crate(2, 0, -2);
  crate(1, 1, -2);
  crate(-2, 0, 3);
  for (let i = 0; i < 6; i++) {
    props.box(-7 + i, 0, -5, -6 + i, i % 2 === 0 ? 1 : 1.5, -4, 0x9a9da6);
    solids.push({ x0: -7 + i, z0: -5, x1: -6 + i, z1: -4, top: i % 2 === 0 ? 1 : 1.5, surface: 'stone' });
  }
  // The lamp post. Its lantern is in the glow mesh below.
  props.box(4.4, 0, 1.4, 4.6, 2.6, 1.6, 0x4a4038);
  const propsMaterial = new THREE.MeshLambertMaterial({ map: tile, vertexColors: true });
  const propsMesh = new THREE.Mesh(props.build(), propsMaterial);
  propsMesh.name = 'props';
  propsMesh.castShadow = true;
  propsMesh.receiveShadow = true;

  // ---- a glowing thing, brighter than white, for the bloom to catch
  const glow = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  glow.translate(4.5, 2.85, 1.5);
  const glowMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.3, 0.9), fog: false });
  const glowMesh = new THREE.Mesh(glow, glowMaterial);
  glowMesh.name = 'lamp';

  // ---- the pond: a flat quad over every water column, positions only
  const water: number[] = [];
  for (let z = -HALF; z < HALF; z++) {
    for (let x = -HALF; x < HALF; x++) {
      if (pondBed(x, z) === 0) continue;
      water.push(x, WATER_LEVEL, z + 1, x + 1, WATER_LEVEL, z + 1, x + 1, WATER_LEVEL, z, x, WATER_LEVEL, z + 1, x + 1, WATER_LEVEL, z, x, WATER_LEVEL, z);
    }
  }
  const pondGeometry = new THREE.BufferGeometry();
  pondGeometry.setAttribute('position', new THREE.Float32BufferAttribute(water, 3));
  const plainWater = new THREE.MeshBasicMaterial({ color: 0x3aa0c8 });
  const pond: THREE.Mesh<THREE.BufferGeometry, THREE.Material> = new THREE.Mesh(pondGeometry, plainWater);
  pond.name = 'pond';
  pond.renderOrder = 5;

  group.add(groundMesh, propsMesh, glowMesh, pond);

  const solidAt = (x: number, z: number): Solid | undefined => solids.find((s) => x >= s.x0 && x < s.x1 && z >= s.z0 && z < s.z1);
  const world: WorldQuery = {
    ...flatWorld,
    heightAt(x, z) {
      const solid = solidAt(x, z);
      return solid ? solid.top : pondBed(x, z);
    },
    surfaceAt(x, z) {
      const solid = solidAt(x, z);
      if (solid) return solid.surface;
      return pondBed(x, z) < 0 ? 'water' : 'grass';
    },
    openSky(x, y, z) {
      const solid = solidAt(x, z);
      return !solid || y >= solid.top;
    },
  };

  return {
    world,
    group,
    pond,
    focus: new THREE.Vector3(3, 0, 2),
    effectSpot: new THREE.Vector3(1.5, 0, 1.5),
    pondSpot: new THREE.Vector3(POND.x - 2, WATER_LEVEL, POND.z + 3.5),

    setWaterMaterial(material) {
      pond.material = material ?? plainWater;
    },

    setWetness(wetness) {
      groundMaterial.color.setScalar(1 - 0.32 * wetness);
      propsMaterial.color.setScalar(1 - 0.2 * wetness);
    },

    dispose() {
      groundMesh.geometry.dispose();
      propsMesh.geometry.dispose();
      glow.dispose();
      pondGeometry.dispose();
      groundMaterial.dispose();
      propsMaterial.dispose();
      glowMaterial.dispose();
      plainWater.dispose();
      tile.dispose();
    },
  };
}
