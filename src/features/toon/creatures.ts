// The creatures as code: each a few round shapes on a small rig, with its clips keyed by hand. A mossling is a
// ball of moss with a sprout, the leaftail a little green fox with a leaf for a tail, the lanternfly a bug with
// a glowing tail. They look down +z, and their feet are at y = 0.
import * as THREE from 'three';
import { addPiece, emptyPieces, place, type Pieces } from './shapes.ts';

export interface CreatureKit {
  root: THREE.Object3D;
  bones: THREE.Bone[];
  inverses: THREE.Matrix4[];
  clips: THREE.AnimationClip[];
  pieces: Pieces;
  /** The game's animation names to clip names. */
  names: Record<string, string>;
  walk: string;
  feet: string[];
  /** The top of the head, in units of the kit, for a mark over it. */
  height: number;
}

export const CREATURES = ['mossling', 'leaftail', 'lanternfly'] as const;
export type Creature = (typeof CREATURES)[number];

interface BoneSpec { name: string; parent?: string; at: readonly [number, number, number] }

function rig(specs: readonly BoneSpec[]): { root: THREE.Object3D; bones: THREE.Bone[]; index: (name: string) => number; inverses: THREE.Matrix4[] } {
  const root = new THREE.Object3D();
  const bones: THREE.Bone[] = [];
  const world = new Map<string, THREE.Vector3>();
  for (const s of specs) {
    const bone = new THREE.Bone();
    bone.name = s.name;
    const at = new THREE.Vector3(...s.at);
    world.set(s.name, at);
    const parent = s.parent ? bones.find((b) => b.name === s.parent)! : root;
    bone.position.copy(s.parent ? at.clone().sub(world.get(s.parent)!) : at);
    parent.add(bone);
    bones.push(bone);
  }
  root.updateMatrixWorld(true);
  const inverses = bones.map((b) => b.matrixWorld.clone().invert());
  return { root, bones, index: (name) => bones.findIndex((b) => b.name === name), inverses };
}

const q = (x: number, y: number, z: number): number[] => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray();

/** A rotation track sampled from a function of the cycle, 0 to 1. */
function turnTrack(bone: string, seconds: number, steps: number, f: (u: number) => [number, number, number]): THREE.QuaternionKeyframeTrack {
  const times: number[] = [], values: number[] = [];
  for (let i = 0; i <= steps; i++) {
    times.push((i / steps) * seconds);
    values.push(...q(...f(i / steps)));
  }
  return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
}

/** A position track: the bone's rest place plus an offset from a function of the cycle. */
function moveTrack(bone: THREE.Bone, seconds: number, steps: number, f: (u: number) => [number, number, number]): THREE.VectorKeyframeTrack {
  const times: number[] = [], values: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const [x, y, z] = f(i / steps);
    times.push((i / steps) * seconds);
    values.push(bone.position.x + x, bone.position.y + y, bone.position.z + z);
  }
  return new THREE.VectorKeyframeTrack(`${bone.name}.position`, times, values);
}

function scaleTrack(bone: string, seconds: number, steps: number, f: (u: number) => [number, number, number]): THREE.VectorKeyframeTrack {
  const times: number[] = [], values: number[] = [];
  for (let i = 0; i <= steps; i++) {
    times.push((i / steps) * seconds);
    values.push(...f(i / steps));
  }
  return new THREE.VectorKeyframeTrack(`${bone}.scale`, times, values);
}

const TAU = Math.PI * 2;
const wave = (u: number, k = 1, shift = 0): number => Math.sin((u * k + shift) * TAU);

function mossling(): CreatureKit {
  const r = rig([
    { name: 'mossBody', at: [0, 0.06, 0] },
    { name: 'mossSprout', parent: 'mossBody', at: [0, 0.6, 0] },
    { name: 'mossFootL', at: [0.13, 0.05, 0.02] },
    { name: 'mossFootR', at: [-0.13, 0.05, 0.02] },
  ]);
  const body = r.index('mossBody'), sprout = r.index('mossSprout');
  const p = emptyPieces();
  addPiece(p, new THREE.SphereGeometry(0.3, 16, 12), { slot: 'skin', bone: body, matrix: place(0, 0.33, 0, 0, 0, 0, 1.05, 0.92, 1) });
  // Tufts of darker moss.
  for (const [x, y, z, s] of [[0.16, 0.5, 0.06, 0.12], [-0.17, 0.48, -0.04, 0.13], [0.02, 0.55, -0.15, 0.12], [0.2, 0.3, -0.16, 0.11], [-0.22, 0.27, 0.1, 0.1]] as const) {
    addPiece(p, new THREE.IcosahedronGeometry(s, 0), { slot: 'hair', bone: body, matrix: place(x, y, z) });
  }
  for (const side of [-1, 1]) {
    addPiece(p, new THREE.SphereGeometry(0.075, 8, 6), { slot: 'hair', bone: body, matrix: place(side * 0.2, 0.58, 0.0, 0, 0, side * 0.4, 1, 0.8, 0.7) });
    addPiece(p, new THREE.SphereGeometry(0.035, 8, 6), { slot: 'eyes', bone: body, matrix: place(side * 0.09, 0.38, 0.272, 0, 0, 0, 1, 1.25, 0.6) });
    addPiece(p, new THREE.SphereGeometry(0.012, 5, 4), { slot: 'accent', bone: body, glow: 0.4, matrix: place(side * 0.09 + 0.012, 0.395, 0.29) });
  }
  addPiece(p, new THREE.CylinderGeometry(0.014, 0.018, 0.12, 5), { slot: 'top', shade: 0.75, bone: sprout, matrix: place(0, 0.04, 0) });
  for (const side of [-1, 1]) {
    addPiece(p, new THREE.SphereGeometry(0.07, 8, 5), { slot: 'top', bone: sprout, matrix: place(side * 0.07, 0.11, 0, 0, 0, side * -0.5, 1.2, 0.25, 0.65) });
  }
  addPiece(p, new THREE.SphereGeometry(0.08, 8, 6), { slot: 'bottom', bone: r.index('mossFootL'), matrix: place(0, 0, 0.02, 0, 0, 0, 1, 0.6, 1.3) });
  addPiece(p, new THREE.SphereGeometry(0.08, 8, 6), { slot: 'bottom', bone: r.index('mossFootR'), matrix: place(0, 0, 0.02, 0, 0, 0, 1, 0.6, 1.3) });

  const [, , footL, footR] = r.bones;
  const bodyBone = r.bones[body];
  const idle = new THREE.AnimationClip('Idle', 2.4, [
    scaleTrack('mossBody', 2.4, 24, (u) => [1 + 0.03 * wave(u), 1 - 0.04 * wave(u), 1 + 0.03 * wave(u)]),
    turnTrack('mossSprout', 2.4, 24, (u) => [0.08 * wave(u, 1, 0.25), 0, 0.18 * wave(u)]),
  ]);
  // A waddle: the body rocks from foot to foot and bobs twice a step.
  const walk = new THREE.AnimationClip('Walk', 0.6, [
    moveTrack(bodyBone, 0.6, 24, (u) => [0, 0.035 * Math.abs(wave(u, 1)), 0]),
    turnTrack('mossBody', 0.6, 24, (u) => [0.06, 0, 0.12 * wave(u)]),
    turnTrack('mossSprout', 0.6, 24, (u) => [-0.2, 0, 0.25 * wave(u, 1, 0.2)]),
    moveTrack(footL, 0.6, 24, (u) => [0, Math.max(0, wave(u)) * 0.06, -0.09 * Math.cos(u * TAU)]),
    moveTrack(footR, 0.6, 24, (u) => [0, Math.max(0, -wave(u)) * 0.06, 0.09 * Math.cos(u * TAU)]),
  ]);
  return { ...r, clips: [idle, walk], pieces: p, names: { idle: 'Idle', walk: 'Walk' }, walk: 'Walk', feet: ['mossFootL', 'mossFootR'], height: 0.7 };
}

function leaftail(): CreatureKit {
  const legs: BoneSpec[] = [];
  for (const [name, x, z] of [['FL', 0.1, 0.15], ['FR', -0.1, 0.15], ['BL', 0.1, -0.15], ['BR', -0.1, -0.15]] as const) {
    legs.push({ name: `leg${name}`, parent: 'tailBody', at: [x, 0.3, z] }, { name: `paw${name}`, parent: `leg${name}`, at: [x, 0.03, z] });
  }
  const r = rig([
    { name: 'tailBody', at: [0, 0.34, 0] },
    { name: 'tailHead', parent: 'tailBody', at: [0, 0.5, 0.2] },
    { name: 'tailLeaf', parent: 'tailBody', at: [0, 0.42, -0.24] },
    ...legs,
  ]);
  const body = r.index('tailBody'), head = r.index('tailHead'), leaf = r.index('tailLeaf');
  const p = emptyPieces();
  addPiece(p, new THREE.CapsuleGeometry(0.15, 0.26, 4, 12), { slot: 'skin', bone: body, matrix: place(0, 0.4, -0.01, Math.PI / 2, 0, 0, 1, 1, 0.95) });
  addPiece(p, new THREE.SphereGeometry(0.12, 10, 8), { slot: 'accent', bone: body, matrix: place(0, 0.38, 0.13, 0, 0, 0, 0.95, 1.05, 0.7) });
  // The head: round, with a cream muzzle, big eyes and tall ears.
  addPiece(p, new THREE.SphereGeometry(0.17, 14, 11), { slot: 'skin', bone: head, matrix: place(0, 0.64, 0.24, 0, 0, 0, 1.08, 0.98, 1) });
  addPiece(p, new THREE.SphereGeometry(0.09, 10, 7), { slot: 'accent', bone: head, matrix: place(0, 0.585, 0.37, 0, 0, 0, 1.2, 0.8, 0.8) });
  addPiece(p, new THREE.SphereGeometry(0.022, 6, 5), { slot: 'eyes', bone: head, matrix: place(0, 0.615, 0.44) });
  for (const side of [-1, 1]) {
    addPiece(p, new THREE.ConeGeometry(0.075, 0.2, 4), { slot: 'skin', bone: head, matrix: place(side * 0.1, 0.81, 0.21, -0.1, 0, side * -0.32, 1, 1, 0.55) });
    addPiece(p, new THREE.ConeGeometry(0.045, 0.13, 4), { slot: 'accent', bone: head, matrix: place(side * 0.095, 0.79, 0.235, -0.1, 0, side * -0.32, 1, 1, 0.4) });
    addPiece(p, new THREE.SphereGeometry(0.034, 8, 6), { slot: 'eyes', bone: head, matrix: place(side * 0.07, 0.66, 0.39, 0, 0, 0, 0.9, 1.2, 0.6) });
    addPiece(p, new THREE.SphereGeometry(0.011, 5, 4), { slot: 'accent', bone: head, glow: 0.4, matrix: place(side * 0.07 + 0.012, 0.675, 0.41) });
  }
  // The leaf of a tail, with a darker vein.
  addPiece(p, new THREE.SphereGeometry(0.2, 12, 8), { slot: 'extra', bone: leaf, matrix: place(0, 0.17, -0.12, -0.75, 0, 0, 0.62, 1.25, 0.16) });
  addPiece(p, new THREE.CylinderGeometry(0.012, 0.016, 0.42, 4), { slot: 'extra', shade: 0.6, bone: leaf, matrix: place(0, 0.17, -0.105, -0.75) });
  for (const [name] of [['FL'], ['FR'], ['BL'], ['BR']] as const) {
    const leg = r.bones[r.index(`leg${name}`)];
    const at = leg.getWorldPosition(new THREE.Vector3());
    addPiece(p, new THREE.CylinderGeometry(0.045, 0.04, 0.28, 7), { slot: 'skin', shade: 0.9, bone: r.index(`leg${name}`), matrix: place(at.x, 0.17, at.z) });
    addPiece(p, new THREE.SphereGeometry(0.05, 7, 5), { slot: 'accent', bone: r.index(`leg${name}`), matrix: place(at.x, 0.035, at.z + 0.01, 0, 0, 0, 1, 0.7, 1.2) });
  }

  const bodyBone = r.bones[body];
  const idle = new THREE.AnimationClip('Idle', 2.6, [
    turnTrack('tailLeaf', 2.6, 26, (u) => [0.08 * wave(u, 1, 0.3), 0.35 * wave(u), 0]),
    turnTrack('tailHead', 2.6, 26, (u) => [0.05 * wave(u, 1, 0.5), 0.12 * wave(u, 0.5), 0.08 * Math.max(0, wave(u, 0.5, 0.2))]),
    scaleTrack('tailBody', 2.6, 26, (u) => [1 + 0.02 * wave(u, 2), 1 + 0.025 * wave(u, 2), 1]),
  ]);
  const swing = (shift: number) => (u: number): [number, number, number] => [0.55 * wave(u, 1, shift), 0, 0];
  const walk = new THREE.AnimationClip('Walk', 0.56, [
    moveTrack(bodyBone, 0.56, 24, (u) => [0, 0.018 * Math.abs(wave(u)), 0]),
    turnTrack('tailHead', 0.56, 24, (u) => [0.05 * wave(u, 2), 0, 0]),
    turnTrack('tailLeaf', 0.56, 24, (u) => [-0.15, 0.3 * wave(u), 0]),
    turnTrack('legFL', 0.56, 24, swing(0)),
    turnTrack('legBR', 0.56, 24, swing(0)),
    turnTrack('legFR', 0.56, 24, swing(0.5)),
    turnTrack('legBL', 0.56, 24, swing(0.5)),
  ]);
  return { ...r, clips: [idle, walk], pieces: p, names: { idle: 'Idle', walk: 'Walk' }, walk: 'Walk', feet: ['pawFL', 'pawFR', 'pawBL', 'pawBR'], height: 0.95 };
}

function lanternfly(): CreatureKit {
  const r = rig([
    { name: 'flyBody', at: [0, 0.42, 0] },
    { name: 'flyWingL', parent: 'flyBody', at: [0.05, 0.5, 0.02] },
    { name: 'flyWingR', parent: 'flyBody', at: [-0.05, 0.5, 0.02] },
  ]);
  const body = r.index('flyBody');
  const p = emptyPieces();
  addPiece(p, new THREE.SphereGeometry(0.075, 10, 8), { slot: 'skin', bone: body, matrix: place(0, 0.47, 0.1) });
  addPiece(p, new THREE.SphereGeometry(0.08, 10, 8), { slot: 'top', bone: body, matrix: place(0, 0.44, 0.0) });
  // The lantern: a fat glowing tail.
  addPiece(p, new THREE.SphereGeometry(0.11, 12, 9), { slot: 'extra', glow: 1, bone: body, matrix: place(0, 0.38, -0.13, 0.45, 0, 0, 1, 1, 1.35) });
  for (const side of [-1, 1]) {
    addPiece(p, new THREE.SphereGeometry(0.022, 6, 5), { slot: 'eyes', bone: body, matrix: place(side * 0.04, 0.49, 0.165) });
    addPiece(p, new THREE.CylinderGeometry(0.006, 0.006, 0.14, 3), { slot: 'eyes', bone: body, matrix: place(side * 0.04, 0.58, 0.14, 0.4, 0, side * -0.35) });
    addPiece(p, new THREE.SphereGeometry(0.018, 5, 4), { slot: 'extra', glow: 0.6, bone: body, matrix: place(side * 0.065, 0.645, 0.17) });
    const wing = r.index(side > 0 ? 'flyWingL' : 'flyWingR');
    addPiece(p, new THREE.SphereGeometry(0.13, 10, 6), { slot: 'accent', bone: wing, matrix: place(side * 0.14, 0.52, -0.03, 0, side * 0.35, side * 0.2, 1, 0.12, 0.62) });
  }
  const flutter = new THREE.AnimationClip('Flutter', 0.24, [
    turnTrack('flyWingL', 0.24, 12, (u) => [0, 0, 0.75 * wave(u)]),
    turnTrack('flyWingR', 0.24, 12, (u) => [0, 0, -0.75 * wave(u)]),
    moveTrack(r.bones[body], 0.24, 12, (u) => [0, 0.012 * wave(u, 1, 0.25), 0]),
  ]);
  return { ...r, clips: [flutter], pieces: p, names: { idle: 'Flutter', walk: 'Flutter', flutter: 'Flutter' }, walk: '', feet: [], height: 0.75 };
}

export function buildCreature(creature: Creature): CreatureKit {
  return creature === 'mossling' ? mossling() : creature === 'leaftail' ? leaftail() : lanternfly();
}
