import * as T from 'three';
import type {Quality} from '../../src/engine/types.ts';
export interface Placement {x:number;z:number;y?:number;rotation?:number;scale?:number}
/** Caller owns geometry and material. Dispose this batch separately. */
export function instances(geometry:T.BufferGeometry,material:T.Material,placements:Placement[],quality:Quality='high'){
 const mesh=new T.InstancedMesh(geometry,material,placements.length),dummy=new T.Object3D();
 placements.forEach((p,i)=>{dummy.position.set(p.x,p.y??0,p.z);dummy.rotation.set(0,p.rotation??0,0);dummy.scale.setScalar(p.scale??1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
 mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=quality!=='low';mesh.receiveShadow=true;mesh.computeBoundingSphere();return mesh;
}
