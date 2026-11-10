// The ground the demo's characters walk on: flat grass from `flatWorld`, a stone hollow that is as
// dark as a cave, and two lamps. Ground and lamps are one mesh, drawn with tiles from the block atlas.
// The light is made up here, since `flatWorld` is lit the same everywhere.
import * as THREE from 'three';
import { flatWorld, type WorldQuery } from '../../src/engine/world-query.ts';
import type { Assets, BlockAtlasAsset } from '../../src/features/assets/index.ts';

/** Half the side of the square of ground, in blocks. */
export const HALF = 48;
/** The dark hollow: west, east, north, south. */
export const CAVE = { x0: -16, x1: -4, z0: -14, z1: -6 } as const;
/** Lamp blocks, by the block they stand on. One lights the east end of the hollow, one stands in the open. */
export const LAMPS: readonly (readonly [number, number])[] = [[-6, -11], [9, 8]];
const LAMP_HEIGHT = 2;

/** A `WorldQuery` that can also tell sky light from lamp light, as the world feature's can. */
export interface DemoWorld extends WorldQuery {
  skyLightAt(x: number, y: number, z: number): number;
  blockLightAt(x: number, y: number, z: number): number;
}

/** Sky light at a point, before rounding to a block: 15 in the open, falling to 2 a few blocks into the hollow. */
function skyLight(x: number, z: number): number {
  const inside = Math.min(x - CAVE.x0, CAVE.x1 - x, z - CAVE.z0, CAVE.z1 - z);
  return inside <= 0 ? 15 : Math.max(2, 15 - 5 * inside);
}

/** Lamp light at a point: 14 at a lamp, one less for each block away. */
function lampLight(x: number, z: number): number {
  let best = 0;
  for (let i = 0; i < LAMPS.length; i++) {
    const dx = x - (LAMPS[i][0] + 0.5), dz = z - (LAMPS[i][1] + 0.5);
    best = Math.max(best, 14 - Math.sqrt(dx * dx + dz * dz));
  }
  return best;
}

/** The light of the block a point is in, as whole levels. Whole numbers cross a function call without making garbage. */
const blockSky = (x: number, z: number): number => Math.round(skyLight(Math.floor(x) + 0.5, Math.floor(z) + 0.5));
const blockLamp = (x: number, z: number): number => Math.round(lampLight(Math.floor(x) + 0.5, Math.floor(z) + 0.5));

export const demoWorld: DemoWorld = {
  ...flatWorld,
  skyLightAt: (x, _y, z) => blockSky(x, z),
  blockLightAt: (x, _y, z) => blockLamp(x, z),
  lightAt: (x, _y, z) => Math.max(blockSky(x, z), blockLamp(x, z)),
};

const VERTEX = /* glsl */ `
attribute float aLayer;
attribute vec2 aLight;
uniform vec3 uSky;
uniform vec3 uLamp;
varying vec2 vUv;
varying vec3 vLight;
flat varying float vLayer;
void main() {
  vUv = uv;
  vLayer = aLayer;
  // The same light rule the sprites use. A lamp's own faces glow.
  float sky = pow(0.8, 15.0 * (1.0 - aLight.x));
  float lamp = pow(0.8, 15.0 * (1.0 - aLight.y)) * step(0.02, aLight.y);
  vLight = aLight.x < 0.0 ? vec3(1.5, 1.3, 0.95) : uSky * sky + uLamp * lamp + 0.035;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2DArray uTiles;
varying vec2 vUv;
varying vec3 vLight;
flat varying float vLayer;
void main() {
  gl_FragColor = vec4(texture(uTiles, vec3(vUv, vLayer)).rgb * vLight, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** One layer per tile, so a tile can repeat and its mipmaps never take in the tile beside it. */
function tileLayers(blocks: BlockAtlasAsset, names: readonly string[]): { texture: THREE.DataArrayTexture; first: Map<string, number>; count: Map<string, number> } {
  const size = blocks.tile;
  const cells = names.flatMap((name) => blocks.cells(name).map((cell) => ({ name, cell })));
  const data = new Uint8Array(size * size * 4 * cells.length);
  const first = new Map<string, number>(), count = new Map<string, number>();
  cells.forEach(({ name, cell }, layer) => {
    if (!first.has(name)) first.set(name, layer);
    count.set(name, (count.get(name) ?? 0) + 1);
    for (let y = 0; y < size; y++) {
      const from = ((cell.y + y) * blocks.pixels.width + cell.x) * 4;
      // Row 0 of a layer is v = 0. The ground's v grows to the south, so the tile's top row goes first.
      data.set(blocks.pixels.data.subarray(from, from + size * 4), (layer * size + y) * size * 4);
    }
  });
  const texture = new THREE.DataArrayTexture(data, size, size, cells.length);
  texture.format = THREE.RGBAFormat;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return { texture, first, count };
}

export interface DemoScene {
  mesh: THREE.Mesh;
  /** The daylight, set every frame. */
  sky: THREE.Color;
  dispose(): void;
}

export function createDemoScene(assets: Assets): DemoScene {
  const tiles = tileLayers(assets.blockAtlas(), ['grass_top', 'stone', 'path_top', 'oak_log_side', 'lamp_side', 'lamp_top']);
  const positions: number[] = [], uvs: number[] = [], layers: number[] = [], lights: number[] = [], index: number[] = [];

  /** One face from four corners, counter-clockwise seen from outside. `light` of null glows. */
  const quad = (corners: number[][], layer: number, light: ((x: number, z: number) => [number, number]) | null): void => {
    const base = positions.length / 3;
    const uv = [[0, 1], [1, 1], [1, 0], [0, 0]];
    corners.forEach(([x, y, z], i) => {
      positions.push(x, y, z);
      uvs.push(uv[i][0], uv[i][1]);
      layers.push(layer);
      const [sky, lamp] = light ? light(x, z) : [-1, 0];
      lights.push(sky, lamp);
    });
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const groundLight = (x: number, z: number): [number, number] => [skyLight(x, z) / 15, Math.max(0, lampLight(x, z)) / 15];
  // The game picks a tile's variant by position. This hash does the same.
  const variant = (name: string, x: number, z: number): number => {
    const h = Math.abs(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
    return (tiles.first.get(name) as number) + Math.floor((h - Math.floor(h)) * (tiles.count.get(name) as number));
  };

  for (let z = -HALF; z < HALF; z++) {
    for (let x = -HALF; x < HALF; x++) {
      const inCave = x >= CAVE.x0 && x < CAVE.x1 && z >= CAVE.z0 && z < CAVE.z1;
      const onPath = !inCave && (x === 0 || x === -1 || z === 0 || z === -1);
      const layer = inCave ? variant('stone', x, z) : onPath ? (tiles.first.get('path_top') as number) : variant('grass_top', x, z);
      quad([[x, 0, z + 1], [x + 1, 0, z + 1], [x + 1, 0, z], [x, 0, z]], layer, groundLight);
    }
  }

  // A lamp: a thin post with a glowing block on top.
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, side: number, top: number, glow: boolean): void => {
    const light = glow ? null : groundLight;
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], side, light);
    quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], side, light);
    quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], side, light);
    quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], side, light);
    quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], top, light);
  };
  const post = tiles.first.get('oak_log_side') as number;
  for (const [x, z] of LAMPS) {
    box(x + 0.38, 0, z + 0.38, x + 0.62, LAMP_HEIGHT, z + 0.62, post, post, false);
    box(x + 0.2, LAMP_HEIGHT, z + 0.2, x + 0.8, LAMP_HEIGHT + 0.6, z + 0.8, tiles.first.get('lamp_side') as number, tiles.first.get('lamp_top') as number, true);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers, 1));
  geometry.setAttribute('aLight', new THREE.Float32BufferAttribute(lights, 2));
  geometry.setIndex(index);
  const sky = new THREE.Color(1, 1, 1);
  const material = new THREE.ShaderMaterial({
    name: 'demo-ground',
    uniforms: { uTiles: { value: tiles.texture }, uSky: { value: sky }, uLamp: { value: new THREE.Color(1.3, 1.0, 0.62) } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'demo-ground';
  mesh.matrixAutoUpdate = false;

  return {
    mesh, sky,
    dispose() {
      geometry.dispose();
      material.dispose();
      tiles.texture.dispose();
    },
  };
}
