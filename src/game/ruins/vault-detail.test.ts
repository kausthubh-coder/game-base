import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { vaultMovingParts } from '../../features/props/builders/rooms.ts';
import { replaceVaultParts } from '../views/ruins-kits.ts';

test('changing room detail replaces shared moving geometry without resetting animation', () => {
  const root = new THREE.Group();
  let parts = vaultMovingParts(1);
  const gear = new THREE.Mesh(parts.gear), follower = new THREE.Mesh(parts.gear), arm = new THREE.Mesh(parts.arm);
  root.add(gear, new THREE.Group().add(follower), arm);
  arm.position.set(12.5, 29, 12.5);
  arm.rotation.set(0, 1.2, 0.12);
  follower.visible = false;
  for (const detail of [0.5, 1, 0.5, 1]) {
    const next = vaultMovingParts(detail);
    let disposed = 0;
    for (const g of Object.values(parts)) g.addEventListener('dispose', () => disposed++);
    replaceVaultParts(root, parts, next);
    expect(arm.geometry).toBe(next.arm);
    expect(gear.geometry).toBe(next.gear);
    expect(follower.geometry).toBe(next.gear);
    expect(arm.position.toArray()).toEqual([12.5, 29, 12.5]);
    expect(arm.rotation.y).toBe(1.2);
    expect(arm.rotation.z).toBe(0.12);
    expect(follower.visible).toBe(false);
    expect(disposed).toBe(6);
    parts = next;
  }
});
