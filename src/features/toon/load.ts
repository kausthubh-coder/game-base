// Reads a model file for the toon cast: a rig, its clips, and bodies skinned to it. Any glTF with skinned meshes
// on one shared rig will do. A body is a skinned mesh, or a group of them (a mesh with several materials loads
// as one skinned mesh per material).
//
// How a body is coloured comes from the file:
// - With a `_TONE` attribute, as tools/models/cast/stand-ins.mjs writes it, each vertex names one of the ten
//   slots in `SLOT`, and the cast data gives every colour.
// - Without one, each material is a slot named after the material, with the material's colour. Vertex colours and
//   a material's texture are kept and multiply that colour. The cast data may override any slot by its name.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { addGeometry, emptyPieces, type Pieces } from './shapes.ts';

export interface ToonFileBody {
  pieces: Pieces;
  /** Part names in order. Part 0 is always worn. */
  parts: string[];
  /** The colour of each slot in the file, as 0xrrggbb sRGB, by slot name. Empty for a file with `_TONE`. */
  colours: Record<string, number>;
  /** A material's texture, when the body has one. */
  map: THREE.Texture | null;
  /** True when the file paints the body with vertex colours. */
  vertexColours: boolean;
}

export interface ToonKit {
  root: THREE.Object3D;
  bones: THREE.Bone[];
  inverses: THREE.Matrix4[];
  clips: THREE.AnimationClip[];
  bodies: Map<string, ToonFileBody>;
  /** A bone's index in the rig, by its name in the file (`upperarm.l` and `upperarml` both work). -1 when there is none. */
  bone(name: string): number;
  /** Where a bone sits in the bind pose. */
  bind(bone: number): THREE.Matrix4;
}

/** The name a skinned mesh's body goes by: its own, or its group's when a mesh with several materials split it. */
function bodyName(mesh: THREE.SkinnedMesh, scene: THREE.Object3D): { name: string; owner: THREE.Object3D } {
  const parent = mesh.parent;
  if (parent && parent !== scene && (parent as THREE.Group).isGroup && parent.children.every((c) => (c as THREE.SkinnedMesh).isSkinnedMesh)) {
    return { name: parent.name, owner: parent };
  }
  return { name: mesh.name, owner: mesh };
}

export async function loadToonKit(url: string): Promise<ToonKit> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const meshes: THREE.SkinnedMesh[] = [];
  gltf.scene.traverse((object) => { if ((object as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(object as THREE.SkinnedMesh); });
  if (meshes.length === 0) throw new Error(`toon: ${url} has no skinned mesh`);
  // The first skeleton is the rig. Every other mesh's bones are found in it by name.
  const { bones, boneInverses } = meshes[0].skeleton;
  const byName = new Map(bones.map((b, i) => [b.name, i]));

  const bodies = new Map<string, ToonFileBody>();
  for (const mesh of meshes) {
    const { name, owner } = bodyName(mesh, gltf.scene);
    // Into the rig's space: the pose the skin was bound in, wherever the file put the mesh.
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.bindMatrix);
    const tone = geometry.getAttribute('_tone');
    let body = bodies.get(name);
    if (!body) {
      const parts = (owner.userData.parts as string[] | undefined) ?? ['body'];
      body = { pieces: emptyPieces(tone ? undefined : []), parts: [...parts], colours: {}, map: null, vertexColours: false };
      bodies.set(name, body);
    }
    const map = mesh.skeleton.bones.map((b) => {
      const i = byName.get(b.name);
      if (i === undefined) throw new Error(`toon: in ${url}, "${name}" is skinned to a bone "${b.name}" the rig does not have`);
      return i;
    });
    if (tone) {
      geometry.setAttribute('tone', tone);
      addGeometry(body.pieces, geometry, { bones: map });
      continue;
    }
    // A slot for each material, named after it.
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const slotName = material.name || `material-${body.pieces.slots.length}`;
    let slot = body.pieces.slots.indexOf(slotName);
    if (slot < 0) {
      body.pieces.slots.push(slotName);
      slot = body.pieces.slots.length - 1;
      body.colours[slotName] = material.color ? material.color.getHex(THREE.SRGBColorSpace) : 0xffffff;
    }
    if (material.map) body.map ??= material.map;
    if (geometry.getAttribute('color')) body.vertexColours = true;
    addGeometry(body.pieces, geometry, { bones: map, slot, part: 0 });
  }

  // Only the bones are kept, to be posed for the bake.
  const drawn: THREE.Object3D[] = [];
  gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) drawn.push(o); });
  for (const m of drawn) m.removeFromParent();
  const sanitized = new Map(bones.map((b, i) => [b.name, i]));
  return {
    root: gltf.scene,
    bones,
    inverses: boneInverses,
    clips: gltf.animations,
    bodies,
    bone: (name) => sanitized.get(name) ?? sanitized.get(THREE.PropertyBinding.sanitizeNodeName(name)) ?? -1,
    bind: (bone) => boneInverses[bone].clone().invert(),
  };
}
