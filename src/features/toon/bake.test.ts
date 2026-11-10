import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { BAKE_RATE, bake, strideOf } from './bake.ts';
import { buildCreature, CREATURES } from './creatures.ts';

/** A root bone and an arm one unit up it, and a clip that turns the arm a quarter turn about z over a second. */
function arm(): { root: THREE.Object3D; bones: THREE.Bone[]; inverses: THREE.Matrix4[]; clip: THREE.AnimationClip } {
  const root = new THREE.Object3D();
  const base = new THREE.Bone(), tip = new THREE.Bone();
  base.name = 'base';
  tip.name = 'tip';
  tip.position.set(0, 1, 0);
  base.add(tip);
  root.add(base);
  root.position.set(5, 0, 0); // the root's own place is left out of the bake
  root.updateMatrixWorld(true);
  const bones = [base, tip];
  const inverses = bones.map((b) => new THREE.Matrix4().copy(b.matrixWorld).premultiply(root.matrixWorld.clone().invert()).invert());
  const quarter = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2).toArray();
  const clip = new THREE.AnimationClip('Bend', 1, [new THREE.QuaternionKeyframeTrack('tip.quaternion', [0, 1], [0, 0, 0, 1, ...quarter])]);
  return { root, bones, inverses, clip };
}

/** The matrix of one bone in one row, as a Matrix4. */
function matrixAt(baked: ReturnType<typeof bake>, row: number, bone: number): THREE.Matrix4 {
  const o = row * baked.bones * 12 + bone * 12;
  const d = baked.data;
  return new THREE.Matrix4().set(d[o], d[o + 1], d[o + 2], d[o + 3], d[o + 4], d[o + 5], d[o + 6], d[o + 7], d[o + 8], d[o + 9], d[o + 10], d[o + 11], 0, 0, 0, 1);
}

test('the first row of a clip is its first frame, and a vertex on the arm goes where the bent arm takes it', () => {
  const { root, bones, inverses, clip } = arm();
  const baked = bake(root, bones, inverses, [clip], { once: ['Bend'] });
  const info = baked.clips.get('Bend')!;
  expect(info).toEqual({ name: 'Bend', row: 0, frames: BAKE_RATE, seconds: 1, loop: false, stride: 0 });
  expect(baked.rows).toBe(BAKE_RATE + 1);
  // A vertex at the end of the arm, two units up, in the bind pose.
  const vertex = new THREE.Vector3(0, 2, 0);
  const start = vertex.clone().applyMatrix4(matrixAt(baked, 0, 1));
  expect(start.x).toBeCloseTo(0, 5);
  expect(start.y).toBeCloseTo(2, 5);
  // At the end of the clip the arm has turned a quarter to the left: the vertex is one unit out along -x.
  const end = vertex.clone().applyMatrix4(matrixAt(baked, BAKE_RATE, 1));
  expect(end.x).toBeCloseTo(-1, 4);
  expect(end.y).toBeCloseTo(1, 4);
  // The base bone never moves.
  expect(matrixAt(baked, BAKE_RATE, 0).equals(new THREE.Matrix4())).toBe(true);
});

test('a looping clip ends on a copy of its first row, so filtering between rows wraps cleanly', () => {
  const { root, bones, inverses, clip } = arm();
  const baked = bake(root, bones, inverses, [clip, clip.clone()]);
  const first = baked.clips.get('Bend')!;
  expect(first.loop).toBe(true);
  expect(matrixAt(baked, first.row + first.frames, 1).equals(matrixAt(baked, first.row, 1))).toBe(true);
  // The second clip starts on the row after.
  expect(baked.rows).toBe(2 * (BAKE_RATE + 1));
});

test('the stride is how fast a planted foot moves back', () => {
  // A foot down for the first half, moving back 0.5 units in 0.5 seconds, then lifted and swung forward.
  const heights = [[0, 0, 0, 0, 0, 0.2, 0.3, 0.2, 0]];
  const along = [[0.25, 0.125, 0, -0.125, -0.25, -0.1, 0.05, 0.2, 0.25]];
  expect(strideOf(heights, along, 0.125)).toBeCloseTo(1, 5);
});

test('every creature bakes, and the walks move their feet', () => {
  for (const name of CREATURES) {
    const kit = buildCreature(name);
    const baked = bake(kit.root, kit.bones, kit.inverses, kit.clips, { feet: kit.feet, gaits: kit.walk ? [kit.walk] : [] });
    expect(baked.rows).toBeGreaterThan(1);
    for (const value of baked.data) expect(Number.isFinite(value)).toBe(true);
    if (kit.walk) expect(baked.clips.get(kit.walk)!.stride).toBeGreaterThan(0.1);
    // Every vertex is skinned to a bone the rig has.
    for (const bone of kit.pieces.skinIndex) expect(bone).toBeLessThan(kit.bones.length);
  }
});
