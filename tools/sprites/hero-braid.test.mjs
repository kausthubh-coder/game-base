import {beforeAll,test,expect} from 'bun:test';
import {execFileSync} from 'node:child_process';
import {pixels,cell,bounds} from './lib.mjs';
// Observed boot pairs on the rejected real pixels. Narrow ROIs deliberately exclude
// the axe on the ground in front/back strike and right strike/recovery.
const rois=[[[57,115,94,120],[52,115,90,120],[38,115,75,120]],[[56,115,94,120],[48,115,87,120],[34,115,71,120]],[[59,115,95,120],[45,115,75,120],[44,115,77,120]]];
const folder=process.env.BRAID_TEST_OUT??'.artifacts/hero-braid-anchor';
beforeAll(()=>{if(!process.env.BRAID_TEST_OUT)for(const args of [[],['--swing']])execFileSync('bun',['tools/sprites/hero-braid.mjs',...args],{cwd:new URL('../../',import.meta.url),stdio:'pipe'});});
async function displacement(old,now,roi){
 const [l,t,r,b]=roi;
 // Match the complete boot region, including transparent gaps, in the new frame.
 for(let dx=-30;dx<=30;dx++){let same=true;for(let y=t;y<=b&&same;y++)for(let x=l;x<=r&&same;x++)for(let c=0;c<4;c++)if(now.data[(y*128+x+dx)*4+c]!==old.data[(y*128+x)*4+c]){same=false;break;}if(same)return dx;}
 throw Error('Boot pixels were modified or rescaled');
}
test('real Braid tool boot pairs stay at the stance origin as the axe crosses the body',async()=>{
 const old=await pixels('assets-src/hero-braid/candidates/hero-braid-swing.png'),now=await pixels(`${folder}/hero-braid-swing.png`);
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
 const roi=rois[row][col],dx=await displacement(await cell(old,col,row,3,3),await cell(now,col,row,3,3),roi);
 expect(Math.abs((roi[0]+roi[2])/2+dx-64),`boot origin row ${row} frame ${col}`).toBeLessThanOrEqual(.5);
 }
});
test('walking keeps the same translation throughout each direction, preserving stride and sway',async()=>{
 const old=await pixels('assets-src/hero-braid/candidates/hero-braid.png'),now=await pixels(`${folder}/hero-braid.png`);
 for(let row=3;row<6;row++){const offsets=[];for(let col=0;col<6;col++)offsets.push(await displacement(await cell(old,col,row,6,6),await cell(now,col,row,6,6),[40,94,90,120]));expect(new Set(offsets).size).toBe(1);}
});

test('all 39 figures preserve every generated pixel, including braid and ground-reaching axe',async()=>{
 for(const [name,cols,rows]of [['hero-braid',6,6],['hero-braid-swing',3,3]]){
  const old=await pixels(`assets-src/hero-braid/candidates/${name}.png`),now=await pixels(`${folder}/${name}.png`);
  for(let row=0;row<rows;row++)for(let col=0;col<(cols===3?3:row<3?4:6);col++){
   const a=await cell(old,col,row,cols,rows),b=await cell(now,col,row,cols,rows),box=bounds(a);
   await displacement(a,b,[box.left,box.top,box.left+box.width-1,box.top+box.height-1]);
   expect(b.data.filter((v,i)=>i%4===3&&v).length).toBe(a.data.filter((v,i)=>i%4===3&&v).length);
  }
 }
});
