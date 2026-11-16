import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { farShape } from './far-buildings.ts';

/** A house 8 wide (x), 6 deep (z): walls 4 high, a gable roof to 7 with its ridge along x, 0.3 of eave all round. */
function house(): THREE.BufferGeometry {
  const walls = new THREE.BoxGeometry(8, 4, 6).translate(0, 2, 0);
  const roof = new THREE.BufferGeometry();
  const e = 0.3, w = 4 + e, d = 3 + e;
  roof.setAttribute('position', new THREE.Float32BufferAttribute([
    -w, 4, d, w, 4, d, w, 7, 0, -w, 4, d, w, 7, 0, -w, 7, 0,
    w, 4, -d, -w, 4, -d, -w, 7, 0, w, 4, -d, -w, 7, 0, w, 7, 0,
    -w, 4, -d, -w, 4, d, -w, 7, 0, w, 4, d, w, 4, -d, w, 7, 0,
  ], 3));
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute([...walls.toNonIndexed().getAttribute('position').array, ...roof.getAttribute('position').array], 3));
  return merged;
}

test("a gable house's far version is a few dozen triangles, stays inside its box, reaches its ridge and stands on the ground", () => {
  const shape = farShape([{ geometry: house() }]);
  const triangles = shape.index.length / 3;
  expect(triangles).toBeGreaterThan(8);
  expect(triangles).toBeLessThanOrEqual(48);
  let top = -Infinity, bottom = Infinity;
  for (let i = 0; i < shape.positions.length; i += 3) {
    const [x, y, z] = shape.positions.slice(i, i + 3) as [number, number, number];
    expect(Math.abs(x)).toBeLessThanOrEqual(4.3 + 1e-3);
    expect(Math.abs(z)).toBeLessThanOrEqual(3.3 + 1e-3);
    top = Math.max(top, y); bottom = Math.min(bottom, y);
  }
  // Heights are taken at cell middles, so the ridge comes out a little under its true 7.
  expect(top).toBeGreaterThan(6.2);
  expect(top).toBeLessThanOrEqual(7 + 1e-3);
  expect(bottom).toBe(0);
});

test('every face of a far version faces out of the house', () => {
  const shape = farShape([{ geometry: house() }]);
  for (let t = 0; t < shape.index.length; t += 3) {
    const [a, b, c] = [shape.index[t], shape.index[t + 1], shape.index[t + 2]] as [number, number, number];
    const p = (k: number): THREE.Vector3 => new THREE.Vector3().fromArray(shape.positions, k * 3);
    const middle = p(a).add(p(b)).add(p(c)).multiplyScalar(1 / 3);
    const facing = new THREE.Vector3().crossVectors(p(b).sub(p(a)), p(c).sub(p(a)));
    // Out of the house: away from the middle of its footprint, sideways or up.
    const out = new THREE.Vector3(middle.x, 0, middle.z);
    expect(facing.y > 1e-6 || facing.dot(out) > 0).toBe(true);
  }
});
