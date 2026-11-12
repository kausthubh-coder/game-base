// Steady shadow programs. Three.js draws the sun's shadow of every plain material with one shared depth
// material. A plain mesh and an instanced mesh need different programs from it, so when the shadow pass draws
// them in turn, the renderer looks the program up again at each switch: four times a frame in the meadow, each
// time a fresh set of parameters, a cache key string, and every uniform sent again.
//
// Each instanced mesh that casts a shadow gets a depth material of its own instead: one shared by those with a
// colour per copy, one by those without. Then every depth material always draws the same kind of mesh and keeps
// its program. The shadow is the same: Three.js copies a mesh's material settings onto its own depth material
// exactly as onto the shared one, and a new MeshDepthMaterial is the shared one's twin.
import * as THREE from 'three';

export interface SteadyShadows {
  /** Call once a frame. It looks over the scene every EVERY frames, so things that arrive later are caught. */
  update(): void;
  dispose(): void;
}

const EVERY = 30;

/** True when Three.js gives this material a depth material of its own anyway (WebGLShadowMap's getDepthMaterial). */
function ownDepth(m: THREE.Material): boolean {
  const s = m as THREE.MeshStandardMaterial;
  return (m.clipShadows === true && Array.isArray(m.clippingPlanes) && m.clippingPlanes.length !== 0)
    || (Boolean(s.displacementMap) && s.displacementScale !== 0)
    || (Boolean(s.alphaMap) && m.alphaTest > 0)
    || (Boolean(s.map) && m.alphaTest > 0)
    || m.alphaToCoverage === true;
}

export function createSteadyShadows(scene: THREE.Scene): SteadyShadows {
  const plain = new THREE.MeshDepthMaterial(), coloured = new THREE.MeshDepthMaterial();
  let frame = 0;
  const visit = (o: THREE.Object3D): void => {
    const mesh = o as THREE.InstancedMesh;
    if (mesh.isInstancedMesh !== true || !mesh.castShadow || mesh.customDepthMaterial !== undefined) return;
    if (Array.isArray(mesh.material) || ownDepth(mesh.material)) return;
    mesh.customDepthMaterial = mesh.instanceColor ? coloured : plain;
  };
  return {
    update() {
      if (frame++ % EVERY === 0) scene.traverse(visit);
    },
    dispose() {
      plain.dispose();
      coloured.dispose();
    },
  };
}
