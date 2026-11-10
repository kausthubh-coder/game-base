// Count exported primitives, not the Blender source mesh's pre-triangulation faces.
// \`primitives\` is the most a model may have: one for a tree or a rock, two for a town model with its Body and Glow.
export function inspectGlb(b, { primitives: most = 1 } = {}) {
 if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length) throw Error('invalid GLB header');
 const length=b.readUInt32LE(12); if(b.readUInt32LE(16)!==0x4e4f534a) throw Error('missing JSON');
 const doc=JSON.parse(b.subarray(20,20+length).toString()); let triangles=0,primitives=0;
 for(const mesh of doc.meshes??[]) for(const p of mesh.primitives) {
  if((p.mode??4)!==4) throw Error('expected triangles');
  const count=doc.accessors[p.indices??p.attributes.POSITION].count;
  if(count%3) throw Error('incomplete triangle'); triangles+=count/3;primitives++;
 }
 if(!triangles||primitives<1||primitives>most) throw Error(most===1?'expected one nonempty primitive':`expected 1 to ${most} nonempty primitives`);
 return {triangles,primitives};
}
