// Optional visual experiment. No world blocks, collisions, or felling rules are changed.
import * as THREE from 'three';
import type { GameView } from '../shell/view.ts';

const PLACEMENTS: Record<string, readonly (readonly [number, number, number, number])[]> = {
  'tree-17': [[-9,-224,1,0],[-19,-238,1.05,1.4],[10,-240,.95,2]],
  'tree-41': [[-17,-218,.95,.4],[-26,-230,1,2.3],[17,-229,1.05,1]],
  'tree-83': [[-1,-235,1,1.2],[-28,-242,.9,2],[18,-242,1,0]],
  'rock-11': [[-11,-222,1,.5],[6,-228,1.2,2],[-22,-236,.8,0]],
  'rock-37': [[-15,-228,.9,1],[13,-232,1.1,2],[-25,-240,1,1]],
  'bush-29': [[-7,-225,1.1,0],[-11,-226,1.3,1],[-16,-219,1,0],[-18,-238,1.4,2],[4,-230,1.3,1],[14,-234,1.5,2],[17,-242,1,0]],
};

export async function install(view: GameView): Promise<void> {
  if (new URLSearchParams(location.search).get('models') !== '1') return;
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const clock = { value: 0 };
  const group = new THREE.Group(); group.name = 'Blender model look test';
  const manifest = await (await fetch('/assets/manifest.json')).json();
  // Load everything before changing the scene, so a failed request leaves no half-installed fixture.
  const loaded = await Promise.all(Object.keys(PLACEMENTS).map(async name => ({ name, gltf: await loader.loadAsync(`/assets/${manifest.models[name].file}`) })));
  for (const { name, gltf } of loaded) {
    gltf.scene.updateMatrixWorld(true);
    let source: THREE.Mesh | undefined;
    gltf.scene.traverse(node => { if (node instanceof THREE.Mesh) source = node; });
    if (!source) throw new Error(`model ${name} has no mesh`);
    const mesh = source as THREE.Mesh;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const original = mesh.material as THREE.MeshStandardMaterial;
    const material = new THREE.MeshToonMaterial({ map: original.map, vertexColors: true, alphaTest: .5, side: THREE.DoubleSide });
    // A small stepped ramp keeps broad crown normals softly lit. Bark and foliage share one primitive.
    const ramp = new THREE.DataTexture(new Uint8Array([110,110,110,255,168,168,168,255,218,218,218,255,255,255,255,255]),4,1,THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true; material.gradientMap = ramp;
    material.onBeforeCompile = shader => {
      shader.uniforms.modelTime = clock;
      shader.vertexShader = 'uniform float modelTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float leaf = step(0.49, uv.x);
        float weight = leaf * smoothstep(0.0, 4.0, position.y);
        transformed.x += sin(modelTime * 1.15 + position.y * 1.2 + position.z) * 0.055 * weight;
        transformed.z += cos(modelTime * 0.85 + position.x) * 0.035 * weight;`);
    };
    const positions = PLACEMENTS[name];
    const instances = new THREE.InstancedMesh(geometry, material, positions.length);
    instances.name = name;
    const transform = new THREE.Object3D();
    for (let i=0;i<positions.length;i++) {
      const [x,z,scale,yaw] = positions[i];
      transform.position.set(x, view.world.sim.heightAt(x,z), z);
      transform.rotation.y = yaw; transform.scale.setScalar(scale); transform.updateMatrix();
      instances.setMatrixAt(i,transform.matrix);
    }
    instances.instanceMatrix.needsUpdate=true; instances.computeBoundingSphere(); group.add(instances);
    mesh.geometry.dispose(); original.dispose();
  }
  view.scene.add(group);
  // Views install before newGame generates the land. Ground the fixture once that land exists.
  let grounded = false;
  const transform = new THREE.Object3D();
  view.onFrame(dt => {
    clock.value += dt;
    if (!view.started || grounded) return;
    for (const child of group.children) {
      const instances = child as THREE.InstancedMesh;
      const positions = PLACEMENTS[child.name];
      for (let i = 0; i < positions.length; i++) {
        const [x,z,scale,yaw] = positions[i];
        transform.position.set(x,view.world.sim.heightAt(x,z),z);
        transform.rotation.y=yaw; transform.scale.setScalar(scale); transform.updateMatrix();
        instances.setMatrixAt(i,transform.matrix);
      }
      instances.instanceMatrix.needsUpdate=true; instances.computeBoundingSphere();
    }
    grounded=true;
  });
}
