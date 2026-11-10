// Reads a toon kit file: one rig, its clips, and bodies skinned to it, as tools/models/cast/stand-ins.mjs writes
// them. Each body keeps a `_TONE` attribute and names its parts in `extras.parts`.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { geometryPieces, type Pieces } from './shapes.ts';

export interface ToonKit {
  root: THREE.Object3D;
  bones: THREE.Bone[];
  inverses: THREE.Matrix4[];
  clips: THREE.AnimationClip[];
  bodies: Map<string, { pieces: Pieces; parts: string[] }>;
  /** A bone's index in the rig, by name. -1 when there is none. */
  bone(name: string): number;
  /** Where a bone sits in the bind pose. */
  bind(bone: number): THREE.Matrix4;
}

export async function loadToonKit(url: string): Promise<ToonKit> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const bodies = new Map<string, { pieces: Pieces; parts: string[] }>();
  let skeleton: THREE.Skeleton | null = null;
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    skeleton ??= mesh.skeleton;
    const geometry = mesh.geometry;
    const tone = geometry.getAttribute('_tone');
    if (!tone) throw new Error(`toon: body "${mesh.name}" in ${url} has no _TONE`);
    geometry.setAttribute('tone', tone);
    const parts = (mesh.userData.parts as string[] | undefined) ?? (geometry.userData.parts as string[] | undefined) ?? ['body'];
    bodies.set(mesh.name, { pieces: geometryPieces(geometry), parts: [...parts] });
  });
  if (!skeleton) throw new Error(`toon: ${url} has no skinned body`);
  const { bones, boneInverses } = skeleton as THREE.Skeleton;
  // The skinned meshes go: only the bones are kept, to be posed for the bake.
  const meshes: THREE.Object3D[] = [];
  gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o); });
  for (const m of meshes) m.removeFromParent();
  return {
    root: gltf.scene,
    bones,
    inverses: boneInverses,
    clips: gltf.animations,
    bodies,
    bone: (name) => bones.findIndex((b) => b.name === name),
    bind: (bone) => boneInverses[bone].clone().invert(),
  };
}
