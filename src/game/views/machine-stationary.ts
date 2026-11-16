import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Static machine pieces share a draw. Rebuild only when their models or placements change. */
export function createMachineStationaryBatch(material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.name = 'machines:stationary';
  mesh.castShadow = mesh.receiveShadow = true;
  const rows: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const safe = new WeakMap<THREE.BufferGeometry, boolean>();
  let count = 0, previousCount = 0, changed = false;
  return {
    mesh,
    begin() { count = 0; changed = false; },
    add(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): boolean {
      let canMerge = safe.get(geometry);
      if (canMerge === undefined) {
        // Deformed vertices need their original model origin for wind/flame timing.
        const fx = geometry.getAttribute('aFx');
        canMerge = true;
        if (fx) for (let i = 0; i < fx.count; i++) if (fx.getX(i) !== 0) { canMerge = false; break; }
        safe.set(geometry, canMerge);
      }
      if (!canMerge) return false;
      let row = rows[count++];
      if (!row) { row = { geometry, matrix: matrix.clone() }; rows.push(row); changed = true; }
      else if (row.geometry !== geometry || !row.matrix.equals(matrix)) {
        row.geometry = geometry; row.matrix.copy(matrix); changed = true;
      }
      return true;
    },
    finish() {
      mesh.visible = count > 0;
      if (count === 0) { previousCount = 0; return; }
      if (!changed && previousCount === count) return;
      const copies = [];
      for (let i = 0; i < count; i++) {
        const row = rows[i];
        copies.push(row.geometry.clone().applyMatrix4(row.matrix));
      }
      const geometry = mergeGeometries(copies);
      for (const copy of copies) copy.dispose();
      if (!geometry) throw new Error('Machine stationary geometry attributes differ');
      geometry.computeBoundingSphere();
      mesh.geometry.dispose(); mesh.geometry = geometry;
      previousCount = count;
    },
  };
}
