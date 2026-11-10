// GLBs are decoded once at boot. Instances keep the existing shared material, shadows and wind.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PROPS, type PropKind } from '../../content/props.ts';
const counts: Record<string, number> = { grassTuft:3,tallGrass:1,flower:6,wildflowers:1,reeds:2,bush:3,berryBush:1,rock:4,mossStump:1,lilyPad:2,mushroom:3,cropwheat:4,cropturnip:4,cropcarrot:4 };
const geometries = new Map<string, THREE.BufferGeometry>();
let pending: Promise<void> | undefined;
export function environmentGeometry(kind: string, variant: number): THREE.BufferGeometry | undefined { return geometries.get(`${kind}:${variant}`); }
export function loadEnvironmentModels(): Promise<void> {
  return pending ??= (async () => {
    const loader = new GLTFLoader();
    await Promise.all(Object.entries(counts).flatMap(([kind, count]) => Array.from({ length: count }, async (_, variant) => {
      const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/models/env-${kind.toLowerCase()}-${variant}.glb`);
      gltf.scene.updateMatrixWorld(true);
      let geometry: THREE.BufferGeometry | undefined;
      gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) {
        geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
        const material = object.material;
        if (Array.isArray(material)) material.forEach(m => m.dispose()); else material.dispose();
        object.geometry.dispose();
      } });
      if (!geometry) throw new Error(`Empty environment model ${kind}:${variant}`);
      const g = geometry as THREE.BufferGeometry;
      const p = g.getAttribute('position'); const fx = new Float32Array(p.count * 2);
      const wind = kind.startsWith('crop') || PROPS[kind as PropKind]?.wind;
      for (let i=0;i<p.count;i++) fx[i*2] = wind ? Math.min(.7, Math.max(0,p.getY(i)-.02)*.7) : 0;
      g.setAttribute('aFx',new THREE.BufferAttribute(fx,2));
      g.computeBoundingBox();g.computeBoundingSphere();
      geometries.set(`${kind}:${variant}`,g);
    })));
  })();
}
