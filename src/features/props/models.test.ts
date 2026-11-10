import {test,expect} from 'bun:test';
import {readFileSync,readdirSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {PROPS,type PropKind} from '../../content/props.ts';
test('shipped environment GLBs have one solid mesh and stay inside each kind budget',async()=>{
 const dir=new URL('../../../public/assets/models/',import.meta.url);
 for(const name of readdirSync(dir).filter(n=>n.startsWith('env-')&&n.endsWith('.glb'))){
  const data=readFileSync(new URL(name,dir));const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  let count=0;gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){count++;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const kind=Object.keys(PROPS).find(k=>k.toLowerCase()===name.split('-')[1]) as PropKind;expect((g.index?.count??g.getAttribute('position').count)/3,name).toBeLessThanOrEqual(PROPS[kind]?.triangles??300);g.computeBoundingBox();expect(g.boundingBox!.min.y,name).toBeGreaterThanOrEqual(-.001);expect(g.getAttribute('normal')).toBeDefined();expect(g.getAttribute('color')).toBeDefined();expect((o.material as THREE.MeshStandardMaterial).alphaMap).toBeNull();expect((o.material as THREE.MeshStandardMaterial).map).toBeNull();g.dispose();}});expect(count,name).toBe(1);
 }
});

test('every crop growth stage has a shipped model, including the fifth carrot stage',async()=>{
 const {crops}=await import('../../game/content/crops.ts');
 for(const crop of crops)for(let stage=0;stage<crop.stages;stage++){
  const file=new URL(`../../../public/assets/models/env-crop${crop.id}-${stage}.glb`,import.meta.url);
  expect(readFileSync(file).readUInt32LE(0),`${crop.id} stage ${stage}`).toBe(0x46546c67);
 }
});
