import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { farmPartParts } from '../../features/props/builders/parts.ts';
import { createMachineStationaryBatch } from './machine-stationary.ts';

test('stationary machine batching preserves all vertices and attributes at their placements, and caches unchanged frames', () => {
  const batch = createMachineStationaryBatch(new THREE.MeshBasicMaterial());
  const sources = ['partPit', 'partDitch', 'partWheel', 'partShaft', 'partPusher', 'partBeeBox'] as const;
  const models = sources.map(key => farmPartParts(key).stationary);
  const matrix = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(14, 22, -224);
  batch.begin();
  for (const geometry of models) expect(batch.add(geometry, matrix)).toBe(true);
  batch.finish();
  const combined = batch.mesh.geometry;
  let offset = 0, indexOffset = 0;
  for (const model of models) {
    const expected = model.clone().applyMatrix4(matrix);
    for (const name of Object.keys(model.attributes)) {
      const a = expected.getAttribute(name), b = combined.getAttribute(name);
      expect(Array.from(b.array.slice(offset * b.itemSize, (offset + a.count) * b.itemSize))).toEqual(Array.from(a.array));
    }
    if (model.index && combined.index) {
      expect(Array.from(combined.index.array.slice(indexOffset, indexOffset + model.index.count))).toEqual(Array.from(model.index.array, value => value + offset));
      indexOffset += model.index.count;
    }
    offset += model.getAttribute('position').count;
    expected.dispose();
  }
  expect(combined.getAttribute('position').count).toBe(offset);
  batch.begin(); for (const geometry of models) batch.add(geometry, matrix); batch.finish();
  expect(batch.mesh.geometry).toBe(combined);
  batch.begin(); batch.add(models[0], matrix.makeTranslation(1, 2, 3)); batch.finish();
  expect(batch.mesh.geometry).not.toBe(combined);
  expect(batch.mesh.geometry.getAttribute('position').count).toBe(models[0].getAttribute('position').count);
  batch.begin(); batch.finish(); expect(batch.mesh.visible).toBe(false);
  batch.begin(); batch.add(models[0], matrix); batch.finish(); expect(batch.mesh.visible).toBe(true);
});

test('wind and flame pieces keep their instanced path and original model origin', () => {
  const batch = createMachineStationaryBatch(new THREE.MeshBasicMaterial());
  const geometry = new THREE.BoxGeometry();
  geometry.setAttribute('aFx', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2).fill(1), 2));
  batch.begin(); expect(batch.add(geometry, new THREE.Matrix4())).toBe(false); batch.finish();
  expect(batch.mesh.visible).toBe(false);
});
