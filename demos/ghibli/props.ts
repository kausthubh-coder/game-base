// The things that stand on the land: the cottage and its yard from the Hollowmere town kit, and boulders
// made here. The kit's models carry their colours in their vertices and take the same painted light as
// everything else.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GREAT_TREE, HOUSE, POND, fbm, heightAt } from './land.ts';
import { paint } from './paint.ts';
import type { Textures } from './textures.ts';

const kit = import.meta.glob('./assets/kit/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Where each kit piece stands: name, x, z and turn in radians. */
const KIT: Array<[string, number, number, number]> = [
  ['house-c', HOUSE.x, HOUSE.z, HOUSE.turn],
  ['town-well', HOUSE.x - 9.5, HOUSE.z + 5.5, 0.4],
  ['cart', HOUSE.x + 7.5, HOUSE.z + 3.5, 1.9],
  ['flower-planter', HOUSE.x - 3.2, HOUSE.z + 5.2, HOUSE.turn],
  ['signpost', -8.6, 1.2, 0.9],
  ['bench', GREAT_TREE.x + 5.2, GREAT_TREE.z + 4.4, -0.9],
  ...fence([[12, -22], [15.5, -26.5], [19, -31], [22.5, -35.5]]),
  ...fence([[-1.5, 21], [-4.6, 16.2], [-7.4, 11.2]]),
];

/** Fence panels between posts, each turned to run along the line. */
function fence(posts: Array<[number, number]>): Array<[string, number, number, number]> {
  const out: Array<[string, number, number, number]> = [];
  for (let i = 0; i < posts.length - 1; i++) {
    const [ax, az] = posts[i] as [number, number], [bx, bz] = posts[i + 1] as [number, number];
    out.push(['fence-straight', (ax + bx) / 2, (az + bz) / 2, Math.atan2(-(bz - az), bx - ax)]);
  }
  return out;
}

function boulder(seed: number): THREE.BufferGeometry {
  // A few large planes, as a painter blocks a rock in: a coarse ball pushed out of shape, then cut flat.
  const g = new THREE.IcosahedronGeometry(1, 1), pos = g.getAttribute('position'), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const push = 0.72 + 0.6 * fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 1.7, 2, seed);
    v.multiplyScalar(push); v.y = Math.max(-0.25, v.y * 0.72);
    pos.setXYZ(i, v.x, v.y, v.z);
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

/** Where each boulder sits: x, z, size. */
const ROCKS: Array<[number, number, number]> = [
  [POND.x - 11, POND.z + 7, 1.5], [POND.x - 13.5, POND.z + 4, 0.8], [POND.x + 9, POND.z - 11, 1.9], [POND.x + 13, POND.z - 8, 1.0],
  [-9.5, 20, 1.1], [7, -12, 0.9], [GREAT_TREE.x - 6, GREAT_TREE.z + 7, 1.6], [GREAT_TREE.x - 8.5, GREAT_TREE.z + 5, 0.8],
  [-34, 22, 2.4], [-37, 19, 1.2], [44, -18, 2.2], [8.5, 40, 0.9], [-52, -42, 3.0], [58, -70, 2.6],
];

export async function createProps(textures: Textures): Promise<THREE.Group> {
  const group = new THREE.Group(), loader = new GLTFLoader();
  const body = paint({ vertexColors: true, brush: 0.22, bands: 0.55, wrap: 0.25, brushScale: 0.22 });
  const glow = paint({ color: '#fff0c8', emissive: '#ffd28a', emissiveIntensity: 0.25, brush: 0, bands: 0 });
  const models = new Map<string, THREE.Object3D>();
  await Promise.all([...new Set(KIT.map(([name]) => name))].map(async (name) => {
    const url = kit[`./assets/kit/${name}.glb`];
    if (!url) throw new Error(`the kit has no ${name}.glb in demos/ghibli/assets/kit`);
    const { scene } = await loader.loadAsync(url);
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const old = o.material as THREE.Material;
      o.material = old.name === 'Glow' ? glow : body;
      old.dispose();
      o.castShadow = o.receiveShadow = true;
    });
    models.set(name, scene);
  }));
  for (const [name, x, z, turn] of KIT) {
    const model = (models.get(name) as THREE.Object3D).clone();
    model.position.set(x, heightAt(x, z) - 0.04, z);
    model.rotation.y = turn;
    group.add(model);
  }

  const rock = paint({
    vertexColors: true, brush: 0.4, bands: 0.85, wrap: 0.15, brushScale: 0.3,
    uniforms: { uRock: { value: textures.rock } },
    fragmentPars: 'uniform sampler2D uRock;',
    fragmentAlbedo: 'diffuseColor.rgb *= 0.6 + 0.8 * texture2D(uRock, vPaintWorld.xz * 0.2 + vPaintWorld.y * 0.13).g;',
  });
  const shapes = [boulder(1), boulder(2), boulder(3)];
  ROCKS.forEach(([x, z, size], i) => {
    const mesh = new THREE.Mesh(shapes[i % shapes.length], rock);
    mesh.position.set(x, heightAt(x, z) + size * 0.05, z);
    mesh.scale.set(size * 1.25, size, size);
    mesh.rotation.y = i * 2.1;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}
