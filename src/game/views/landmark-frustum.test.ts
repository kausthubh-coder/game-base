import { test, expect } from 'bun:test';
import * as THREE from 'three';
import { createLandmarkFrustum } from './landmark-frustum.ts';

test('far landmarks keep full geometry at the edge, remove offscreen copies and return after camera turns', () => {
  const geometry = new THREE.BoxGeometry(2, 2, 2), material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, 4);
  const camera = new THREE.PerspectiveCamera(90, 1, 1, 100);
  camera.updateMatrixWorld();
  const matrices = [new THREE.Matrix4().makeTranslation(0, 0, -10),
    new THREE.Matrix4().makeTranslation(10.5, 0, -10), // center outside, model still crosses the edge
    new THREE.Matrix4().makeTranslation(40, 0, -10),
    new THREE.Matrix4().makeTranslation(0, 0, 10)];
  const cull = createLandmarkFrustum();
  cull.camera(camera); cull.fill(mesh, matrices);
  expect(mesh.count).toBe(2);
  const actual = new THREE.Matrix4();
  for (let i = 0; i < 2; i++) { mesh.getMatrixAt(i, actual); expect(actual.elements).toEqual(matrices[i]!.elements); }
  expect(mesh.geometry).toBe(geometry); expect(mesh.material).toBe(material);
  camera.rotation.y = Math.PI; camera.updateMatrixWorld(); cull.camera(camera); cull.fill(mesh, matrices);
  expect(mesh.count).toBe(1); mesh.getMatrixAt(0, actual); expect(actual.elements).toEqual(matrices[3]!.elements);
  cull.fill(mesh, []); expect(mesh.visible).toBe(false);
  cull.fill(mesh, matrices); expect(mesh.visible).toBe(true);
  mesh.castShadow = true; expect(() => cull.fill(mesh, matrices)).toThrow('shadow casters');
});

test('shader-deformed landmarks retain offscreen instances', () => {
  const geometry = new THREE.BoxGeometry();
  const fx = new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count * 2), 2);
  fx.setX(0, 1); geometry.setAttribute('aFx', fx);
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 1);
  const camera = new THREE.PerspectiveCamera(); camera.updateMatrixWorld();
  const cull = createLandmarkFrustum(); cull.camera(camera);
  cull.fill(mesh, [new THREE.Matrix4().makeTranslation(0, 0, 100)]);
  expect(mesh.count).toBe(1);
});
