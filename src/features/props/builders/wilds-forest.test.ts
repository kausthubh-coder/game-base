import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { buildProp } from '../build.ts';
import { PROPS } from '../../../content/props.ts';

const dimensions: Record<string, number[]> = {
  forestSnag: [5, 4, 11],
  forestHollowTrunk: [6, 5, 8],
  forestStumps: [4, 3, 1.2],
  forestRootFan: [8, 5, 1.5],
  forestMushrooms: [2, 1.5, 0.6],
  forestMossMound: [4, 3, 0.8],
  forestBranch: [6, 2, 0.8],
  forestRocks: [4, 3, 2.5],
  forestVines: [3, 1, 6],
  forestBeeComb: [0.65, 0.25, 1],
  forestWall: [8, 2, 2.5],
  forestStatue: [5, 4, 6],
  forestGatePost: [2, 2, 5],
  forestShrineRing: [10, 10, 1],
  greyBrush: [4, 3, 1.5],
  greyDrift: [3, 2, 0.15],
  greyDen: [8, 6, 3.5],
  wrenCamp: [6, 5, 2.4],
};
for (const [kind, [w, d, h]] of Object.entries(dimensions))
  test(`${kind} envelope, finite normals and low detail`, () => {
    for (const detail of [1, 0.5]) {
      const g = buildProp(kind, 0, detail),
        b = g.boundingBox!,
        size = b.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(w, 4);
      expect(size.z).toBeCloseTo(d, 4);
      expect(size.y).toBeCloseTo(h, 4);
      expect(b.min.y).toBeCloseTo(kind === 'forestVines' ? -6 : 0, 4);
      const normals = g.getAttribute('normal');
      for (let i = 0; i < normals.count; i++)
        expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 3);
      expect(g.index!.count / 3).toBeLessThanOrEqual(PROPS[kind as keyof typeof PROPS].triangles);
    }
  });
for (const kind of ['forestSnag', 'forestHollowTrunk', 'forestStumps'])
  test(`${kind} grey preserves geometry`, () => {
    for (const detail of [1, 0.5])
      expect(Array.from(buildProp(kind, 0, detail).getAttribute('position').array)).toEqual(
        Array.from(buildProp(kind, 1, detail).getAttribute('position').array),
      );
  });
function clear(kind: string, w: number, h: number, depth: number) {
  const g = buildProp(kind, 0),
    mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld();
  // The whole rectangle, both jambs and the head included.
  for (let i = 0; i <= 24; i++)
    for (let y = 0.02; y <= h; y += 0.09) {
      const x = (-w / 2 + 0.01) + ((w - 0.02) * i) / 24;
      const ray = new THREE.Raycaster(
        new THREE.Vector3(x, y, 10),
        new THREE.Vector3(0, 0, -1),
        0,
        10 - depth,
      );
      expect(ray.intersectObject(mesh).length, `${kind}: ${x.toFixed(2)},${y.toFixed(2)}`).toBe(0);
    }
}
test('trunk entrance admits a 2 by 3 rectangle to its centre', () =>
  clear('forestHollowTrunk', 2, 3, 0));
test('den entrance admits a 2 by 2 rectangle to its centre', () => clear('greyDen', 2, 2, 0));
test('shrine centre and south approach remain empty', () => {
  const mesh = new THREE.Mesh(
    buildProp('forestShrineRing', 0),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  mesh.updateMatrixWorld();
  for (let x = -2.5; x <= 2.5; x += 0.25)
    for (let z = -2.5; z <= 2.5; z += 0.25)
      expect(
        new THREE.Raycaster(
          new THREE.Vector3(x, 3, z),
          new THREE.Vector3(0, -1, 0),
        ).intersectObject(mesh),
      ).toHaveLength(0);
  clear('forestShrineRing', 3, 1, 0);
});
