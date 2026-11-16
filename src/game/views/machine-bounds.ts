import * as THREE from 'three';

/** Refresh bounds after animation/placement, for both the eye and shadow camera tests. */
export function updateMachineBounds(mesh: THREE.InstancedMesh): void {
  const fx = mesh.geometry.getAttribute('aFx');
  // Wind and flame can leave CPU geometry bounds; keep their existing conservative path.
  let rigid = mesh.geometry.userData.machineRigid as boolean | undefined;
  if (rigid === undefined) {
    rigid = true;
    if (fx) for (let i = 0; i < fx.count; i++) if (fx.getX(i) !== 0) { rigid = false; break; }
    mesh.geometry.userData.machineRigid = rigid;
  }
  mesh.frustumCulled = rigid;
  if (rigid && mesh.count > 0) mesh.computeBoundingSphere();
}
