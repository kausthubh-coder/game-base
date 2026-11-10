// Puts the water feature's material on the world's water. The world draws its water with a plain
// material of its own and has no method to swap it, so this finds the water meshes in the scene by
// what the world sets on them: in the group named `world`, a water mesh is the one that casts no
// shadow and is culled by the view. The cap of the cutaway is not culled, and solid ground casts.
// New meshes appear as chunks load, so the group is walked once a frame. It is about a hundred objects.
import type * as THREE from 'three';

export function dressWater(scene: THREE.Scene, material: THREE.Material): () => void {
  let group: THREE.Object3D | undefined;
  return () => {
    group ??= scene.getObjectByName('world');
    if (!group) return;
    const children = group.children;
    for (let i = 0; i < children.length; i++) {
      const mesh = children[i] as THREE.Mesh;
      if (mesh.isMesh && !mesh.castShadow && mesh.frustumCulled && mesh.material !== material) mesh.material = material;
    }
  };
}
