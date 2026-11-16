import * as THREE from 'three';

/** Compact only non-shadow-casting copies. Shadow casters must also survive outside the eye's frustum. */
export function createLandmarkFrustum() {
  const deformed = new WeakMap<THREE.BufferGeometry, boolean>();
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), sphere = new THREE.Sphere();
  return {
    camera(camera: THREE.Camera): void {
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
    },
    fill(mesh: THREE.InstancedMesh, matrices: readonly THREE.Matrix4[]): void {
      if (mesh.castShadow) throw Error('Eye-frustum compaction cannot discard shadow casters');
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      let moves = deformed.get(mesh.geometry);
      if (moves === undefined) {
        const fx = mesh.geometry.getAttribute('aFx');
        moves = false;
        if (fx) for (let i = 0; i < fx.count; i++) if (fx.getX(i) > 0) { moves = true; break; }
        deformed.set(mesh.geometry, moves);
      }
      let count = 0;
      for (const matrix of matrices) {
        sphere.copy(mesh.geometry.boundingSphere as THREE.Sphere).applyMatrix4(matrix);
        // Model matrices already contain world placement; these batches have an identity parent.
        if (moves || frustum.intersectsSphere(sphere)) mesh.setMatrixAt(count++, matrix);
      }
      mesh.count = count;
      mesh.visible = count > 0;
      if (count) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    },
  };
}
