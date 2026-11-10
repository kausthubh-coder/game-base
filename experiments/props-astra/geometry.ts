import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export const P = {wood:0x815940, light:0xc48d64, end:0xe4af7b, dark:0x493335, iron:0x51455d, brass:0xd4aa58, stone:0x898780, pale:0xd3c8c6, leaf:0x60793a, lime:0x8d9a4a, pine:0x3c5537, cream:0xfff0cf, red:0xab5e4e, water:0x4d7193};
export type V = [number,number,number];
/** Bakes transforms and linear vertex colors, then merges to one unindexed geometry. */
export class Parts {
  private parts:T.BufferGeometry[]=[];
  add(g:T.BufferGeometry,c:number,p:V=[0,0,0],s:V=[1,1,1],r:V=[0,0,0]) {
    let b=g.index?g.toNonIndexed():g; if(b!==g)g.dispose();
    b.deleteAttribute('uv');
    b.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...r)),new T.Vector3(...s)));
    const color=new T.Color(c), a=new Float32Array(b.getAttribute('position').count*3);
    for(let i=0;i<a.length;i+=3){a[i]=color.r;a[i+1]=color.g;a[i+2]=color.b;}
    b.setAttribute('color',new T.BufferAttribute(a,3));this.parts.push(b);return this;
  }
  box(p:V,s:V,c=P.wood,r:V=[0,0,0]){return this.add(new T.BoxGeometry(),c,p,s,r);}
  blob(p:V,s:V,c=P.leaf,detail=0){return this.add(new T.IcosahedronGeometry(1,detail),c,p,s,[0,.31,0]);}
  cyl(p:V,rt:number,rb:number,h:number,c=P.wood,n=8,r:V=[0,0,0]){return this.add(new T.CylinderGeometry(rt,rb,h,n),c,p,[1,1,1],r);}
  beam(a:V,b:V,w:number,c=P.wood){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const g=new T.BoxGeometry(w,d.length(),w);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));return this.add(g,c,av.add(bv).multiplyScalar(.5).toArray() as V);}
  done(){const g=mergeGeometries(this.parts,false);this.parts.forEach(p=>p.dispose());g.computeBoundingBox();g.computeBoundingSphere();return g;}
}
export const triangles=(g:T.BufferGeometry)=>(g.index?.count??g.getAttribute('position').count)/3;
