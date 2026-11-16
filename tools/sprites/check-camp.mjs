import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {pixels,cell,bounds,readJSON} from './lib.mjs';
const m=await readJSON('public/assets/manifest.json');
// Compare with the hero the game actually draws, never a retained old identity.
const hero=await pixels('public/assets/sprites/hero.png');
const camp=await pixels('public/assets/sprites/hero-camp.png');
const fox=await pixels('public/assets/sprites/fox-blighted.png');
const oldFox=await pixels('assets-src/camp-sprites/fox-blighted-base.png');
assert.equal(camp.w,512,'camp sheet width');
assert.equal(camp.h,1152,'camp sheet height');
assert.deepEqual(m.sprites['hero-camp'],{sheet:'sprites/hero-camp.png',frame:[128,128],anchor:[64,120],worldHeight:2,animations:{sit:{frames:2,fps:2,rows:{front:0,back:1,side:2}},look:{frames:2,fps:2,rows:{front:3,back:4,side:5}},rise:{frames:4,fps:5,rows:{front:6,back:7,side:8}}}},'camp animation contract');
for(let row=0;row<6;row++)for(let col=2;col<4;col++){
 const q=await cell(camp,col,row,4,9);
 assert(q.data.every((v,i)=>i%4!==3||v===0),'unused camp cell is transparent');
}

const palette=p=>new Set(Array.from({length:p.w*p.h},(_,i)=>p.data[i*4+3]?p.data.subarray(i*4,i*4+3).toString('hex'):null).filter(Boolean));
for(const [name,p,ref,actions,expected]of [['hero-camp',camp,hero,['sit','look','rise'],24],['fox-blighted',fox,oldFox,['stalk','shake'],18]]){
 let frames=0;const colors=palette(ref),s=m.sprites[name],size=s.frame[0];
 for(const action of actions)for(const row of Object.values(s.animations[action].rows))for(let col=0;col<s.animations[action].frames;col++){
  const q=await cell(p,col,row,p.w/size,p.h/size),b=bounds(q);
  assert.equal(b.top+b.height-1,s.anchor[1],'ground line');
  for(let i=0;i<q.data.length;i+=4)if(q.data[i+3]){assert.equal(q.data[i+3],255);assert(colors.has(q.data.subarray(i,i+3).toString('hex')),'character own palette');}
  frames++;
 }
 assert.equal(frames,expected);console.log(`PASS ${name}: ${frames} frames, exact ground line, binary alpha, character own palette`);
}
for(let row=0;row<3;row++)assert.deepEqual((await cell(camp,3,row+6,4,9)).data,(await cell(hero,0,row,6,7)).data);
console.log('PASS rise endpoints: all three directions pixel-identical to approved idle frame 0');
// Compare the upper 42-pixel head band to approved idle; this catches scale drift, not identity.
for(let row=0;row<9;row++)for(let col=0;col<(row<6?2:4);col++){
 const q=await cell(camp,col,row,4,9),b=bounds(q),xs=[];
 for(let y=b.top;y<b.top+42;y++)for(let x=0;x<128;x++)if(q.data[(y*128+x)*4+3])xs.push(x);
 const ref=await cell(hero,0,row%3,6,7),rb=bounds(ref),rx=[];
 for(let y=rb.top;y<rb.top+42;y++)for(let x=0;x<128;x++)if(ref.data[(y*128+x)*4+3])rx.push(x);
 const expected=Math.max(...rx)-Math.min(...rx)+1;
 const width=Math.max(...xs)-Math.min(...xs)+1;assert(Math.abs(width-expected)<=2,`head band ${row}/${col}: ${width}, hero ${expected}`);
}
console.log('PASS head scale: upper 42-pixel silhouette width within 2 pixels of shipped hero head band in the same direction');
assert.deepEqual(fox.data.subarray(0,oldFox.data.length),oldFox.data);
console.log('PASS fox: original idle and walk rows pixel-identical');
if(process.argv.includes('--rebuild')){
const paths=['public/assets/sprites/hero-camp.png','public/assets/sprites/fox-blighted.png','public/assets/manifest.json'];
const hashes=async()=>Promise.all(paths.map(async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex')));
const before=await hashes();
for(let i=0;i<2;i++){const r=Bun.spawnSync(['bun','tools/sprites/camp-sprites.mjs']);assert.equal(r.exitCode,0);assert.deepEqual(await hashes(),before);}
console.log('PASS rebuild twice: both PNGs and manifest byte-identical');
}
