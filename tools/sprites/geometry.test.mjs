import {test,expect} from 'bun:test';
import {pixels,cell,readJSON,bounds} from './lib.mjs';
import {validateSpriteGeometry} from './geometry.mjs';
const regions=await readJSON('assets-src/hero-braid/ground-contact.json');
const cases=[['hero-braid',6,6,{idle:{frames:4,rows:{front:0,back:1,side:2}},walk:{frames:6,rows:{front:3,back:4,side:5}}}],['hero-braid-swing',3,3,{tool:{frames:3,rows:{front:0,back:1,side:2}}}]];
for(const [name,cols,rows,anims]of cases){
 const c={cols,rows,anchor:[64,120],groundContact:regions[name]};
 test(name+' aligned real pixels pass; old silhouette gate and old body alignment fail',async()=>{
  const p=await pixels(`assets-src/hero-braid/candidates/anchor/${name}.png`);
  expect((await validateSpriteGeometry(p,c,anims)).length).toBe(name==='hero-braid'?30:9);
  await expect(validateSpriteGeometry(p,{...c,groundContact:undefined},anims)).rejects.toThrow();
  const legacy={...c};delete legacy.groundContact;
  await expect(validateSpriteGeometry(p,legacy,anims)).rejects.toThrow('horizontal anchor');
  await expect(validateSpriteGeometry(await pixels(`assets-src/hero-braid/candidates/${name}.png`),c,anims)).rejects.toThrow();
 });
 test(name+' rejects missing, empty, malformed, out of frame and foot slicing regions',async()=>{
  const p=await pixels(`assets-src/hero-braid/candidates/anchor/${name}.png`);
  for(const bad of [null,[],[1,116,127,120],[44,116,85.5,120],[1,119,100,120],[2,116,5,120],[50,116,80,120]]){
   await expect(validateSpriteGeometry(p,{...c,groundContact:{...c.groundContact,'0:0':bad}},anims)).rejects.toThrow();
  }
  const missing={...c.groundContact};delete missing['0:0'];
  await expect(validateSpriteGeometry(p,{...c,groundContact:missing},anims)).rejects.toThrow('missing support');
 });
}
test('actual complete validator measures pixels, ignores asymmetric extensions, and still rejects clipping',async()=>{
 const q=await cell(await pixels('assets-src/hero-braid/candidates/anchor/hero-braid-swing.png'),0,0,3,3);
 const c={cols:1,rows:1,anchor:[64,120],groundContact:{'0:0':[30,116,110,120]}},anims={tool:{frames:1,rows:{front:0}}};
 const origin=(await validateSpriteGeometry(q,c,anims))[0].origin;
 const extended={...q,data:Buffer.from(q.data)};
 for(let x=2;x<40;x++)extended.data.set(q.data.subarray((50*128+60)*4,(50*128+60)*4+4),(30*128+x)*4);
 // Use a known opaque original pixel for an axe/braid extension.
 const ink=q.data.subarray(q.data.findIndex((v,i)=>i%4===3&&v)-3,q.data.findIndex((v,i)=>i%4===3&&v)+1);
 for(let x=2;x<40;x++)extended.data.set(ink,(30*128+x)*4);
 expect((await validateSpriteGeometry(extended,c,anims))[0].origin).toBe(origin);
 extended.data.set(ink,(30*128)*4);
 await expect(validateSpriteGeometry(extended,c,anims)).rejects.toThrow('padding');
 // Move the actual body/feet right, then extend the silhouette left until its centre looks good.
 const shifted={...q,data:Buffer.alloc(q.data.length)};
 for(let y=0;y<128;y++)for(let x=0;x<116;x++)q.data.copy(shifted.data,(y*128+x+12)*4,(y*128+x)*4,(y*128+x)*4+4);
 const b=bounds(shifted),left=128-(b.left+b.width-1);
 shifted.data.set(ink,(30*128+left)*4);
 const box=bounds(shifted);expect(Math.abs(box.left+(box.width-1)/2-64)).toBeLessThanOrEqual(6);
 await expect(validateSpriteGeometry(shifted,c,anims)).rejects.toThrow('horizontal anchor');
 // A claimed new location without moved pixels cannot manufacture support.
 await expect(validateSpriteGeometry(q,{...c,groundContact:{'0:0':[88,116,110,120]}},anims)).rejects.toThrow('empty support');
});

test('real side-strike ground axe cannot move the sole measurement; border clipping fails',async()=>{
 const q=await cell(await pixels('assets-src/hero-braid/candidates/anchor/hero-braid-swing.png'),1,2,3,3);
 const c={cols:1,rows:1,anchor:[64,120],groundContact:{'0:0':regions['hero-braid-swing']['2:1']}},anims={tool:{frames:1,rows:{side:0}}};
 const origin=(await validateSpriteGeometry(q,c,anims))[0].origin;
 const p={...q,data:Buffer.from(q.data)};
 const ink=q.data.subarray((120*128+92)*4,(120*128+92)*4+4);expect(ink[3]).toBe(255);
 for(let x=99;x<=126;x++)p.data.set(ink,(120*128+x)*4);
 expect((await validateSpriteGeometry(p,c,anims))[0].origin).toBe(origin);
 p.data.set(ink,(120*128+127)*4);
 await expect(validateSpriteGeometry(p,c,anims)).rejects.toThrow('padding');
 const airborne={...q,data:Buffer.from(q.data)};
 for(let x=0;x<128;x++)airborne.data[(120*128+x)*4+3]=0;
 await expect(validateSpriteGeometry(airborne,c,anims)).rejects.toThrow('baseline');
});
