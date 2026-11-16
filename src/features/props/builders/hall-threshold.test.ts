import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { SightRule } from '../../camera/sight.sim.ts';
import { hallDoorParts } from './group-3.ts';

for (const detail of [1, 0.5]) {
  test(`Hall threshold has a floor-level walking opening at detail ${detail}`, () => {
    const parts = hallDoorParts(detail);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(parts.hallFrame, material);
    mesh.updateMatrixWorld();
    try {
      for (const x of [-1.24, -1, -0.5, 0, 0.5, 1, 1.24]) {
        for (const y of [0.02, 0.4, 0.7, 1.1, 1.8, 2.5]) {
          const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1), 0, 6);
          expect(ray.intersectObject(mesh), `opening x=${x}, y=${y}`).toHaveLength(0);
        }
      }
    } finally {
      for (const geometry of Object.values(parts)) geometry.dispose();
      material.dispose();
    }
  });

  test(`Hall threshold does not hide the hero behind protected stone at detail ${detail}`, () => {
    // Actual hall.door camera/player capture from the first-half beta sight failure.
    // Translate the capture into the Hall model's coordinates; keep the real sight guard.
    const eye = new THREE.Vector3(19.69375082154535, 20.50159883593557, 17.69375082154536);
    const feet = new THREE.Vector3(0, 0, -2);
    const right = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
    const rule = new SightRule();
    rule.keep(feet.x, feet.y, feet.z);
    rule.update(1, eye.x, eye.y, eye.z, feet.x, feet.y, feet.z, []);
    const parts = hallDoorParts(detail);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(parts.hallFrame, material);
    mesh.updateMatrixWorld();
    try {
      const hidden: { height: number; side: number; point: number[] }[] = [];
      for (const height of [0.4, 0.7, 1.1, 1.5]) for (const side of [-0.3, 0, 0.3]) {
        const target = feet.clone().add(new THREE.Vector3(0, height, 0)).addScaledVector(right, side);
        const ray = new THREE.Raycaster(eye, target.clone().sub(eye).normalize(), 0, eye.distanceTo(target) - 0.05);
        for (const hit of ray.intersectObject(mesh)) {
          const p = hit.point;
          if (rule.cuts(p.x, p.y, p.z) < 0.5) hidden.push({ height, side, point: p.toArray() });
        }
      }
      expect(hidden).toEqual([]);
    } finally {
      for (const geometry of Object.values(parts)) geometry.dispose();
      material.dispose();
    }
  });
}
