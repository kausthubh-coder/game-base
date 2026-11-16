import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { updateMachineBounds } from './machine-bounds.ts';
test('moving pieces refresh bounds, survive shadow view outside eye, and return when moved back', () => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2);
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.count = 1;
  const matrix = new THREE.Matrix4().makeTranslation(30, 0, -10); mesh.setMatrixAt(0, matrix);
  updateMachineBounds(mesh);
  expect(mesh.frustumCulled).toBe(true);
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 100), frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  camera.updateMatrixWorld();frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  expect(frustum.intersectsObject(mesh)).toBe(false);
  camera.position.x = 30; camera.updateMatrixWorld();frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  expect(frustum.intersectsObject(mesh)).toBe(true);
  mesh.setMatrixAt(0, matrix.makeTranslation(0, 0, -10)); updateMachineBounds(mesh);
  camera.position.x = 0; camera.updateMatrixWorld();frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  expect(frustum.intersectsObject(mesh)).toBe(true);
  expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
  mesh.count = 2; mesh.setMatrixAt(1, matrix.makeTranslation(30, 0, -10)); updateMachineBounds(mesh);
  expect(mesh.boundingSphere!.containsPoint(new THREE.Vector3(30,0,-10))).toBe(true);
});
test('deformed machine pieces keep conservative submission', () => {
  const g = new THREE.BoxGeometry(), fx = new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count*2),2);
  fx.setX(0,1); g.setAttribute('aFx',fx);
  const mesh = new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial(),1); updateMachineBounds(mesh);
  expect(mesh.frustumCulled).toBe(false);
});
