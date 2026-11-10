import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {sprites,tiles,icons,animations} from './config.mjs';
import {root,readJSON,pixels,cell,bounds,writeJSON} from './lib.mjs';
const m=await readJSON('public/assets/manifest.json'),palette=new Set((await readJSON('assets-src/palette.json')).colors.map(s=>s.slice(1)));let frames=0;
assert.equal(m.version,1);assert.deepEqual(Object.keys(m.sprites).sort(),Object.keys(sprites).sort());
async function read(path,w,h){assert(!path.startsWith('/')&&!path.split('/').includes('..'),'relative path required');await fs.access(root+'public/assets/'+path);const p=await pixels('public/assets/'+path);assert.equal(p.w,w,path+' width');assert.equal(p.h,h,path+' height');for(let i=0;i<p.data.length;i+=4){const a=p.data[i+3];assert(a===0||a===255,path+' alpha must be binary');if(a){const hex=p.data.subarray(i,i+3).toString('hex');assert(palette.has(hex),path+' outside locked palette: '+hex);}}return p;}
for(const [name,c]of Object.entries(sprites)){
 const s=m.sprites[name];assert.deepEqual(s.frame,[c.size,c.size]);assert.deepEqual(s.anchor,c.anchor);assert.equal(s.worldHeight,c.worldHeight);assert.deepEqual(s.animations,animations(c));const p=await read(s.sheet,c.cols*c.size,c.rows*c.size);
 for(const a of Object.values(s.animations))for(const row of Object.values(a.rows))for(let col=0;col<c.cols;col++){
 const q=await cell(p,col,row,c.cols,c.rows);if(col>=a.frames){assert(q.data.every((v,i)=>i%4!==3||v===0),name+' unused cell');continue;}
 const b=bounds(q);assert(Math.abs(b.top+b.height-1-s.anchor[1])<=2,name+' feet baseline');assert(Math.abs(b.left+(b.width-1)/2-s.anchor[0])<=2,name+' horizontal anchor');
 for(let x=0;x<c.size;x++)for(const y of [0,c.size-1])assert.equal(q.data[(y*c.size+x)*4+3],0,name+' background');for(let y=0;y<c.size;y++)for(const x of [0,c.size-1])assert.equal(q.data[(y*c.size+x)*4+3],0,name+' background');frames++;
 }console.log('OK '+name+': sizes, anchors, transparency, palette and padding');
}
assert.equal(m.blocks.tile,32);assert.deepEqual(Object.keys(m.blocks.tiles).sort(),[...new Set(tiles)].sort());const bp=await read(m.blocks.atlas,256,128);let tileCount=0;
for(const [name,cells]of Object.entries(m.blocks.tiles)){assert.equal(cells.length,tiles.filter(t=>t===name).length);for(const [x,y]of cells){assert(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<8&&y>=0&&y<4);const p=await cell(bp,x,y,8,4);for(let i=3;i<p.data.length;i+=4)assert.equal(p.data[i],255,name+' opaque tile');for(let k=0;k<32;k++)for(let c=0;c<4;c++){assert.equal(p.data[(k*32)*4+c],p.data[(k*32+31)*4+c],name+' horizontal seam');assert.equal(p.data[k*4+c],p.data[(31*32+k)*4+c],name+' vertical seam');}tileCount++;}}
assert.equal(m.icons.tile,32);assert.deepEqual(Object.keys(m.icons.names).sort(),icons.slice().sort());const ip=await read(m.icons.sheet,128,128);for(const name of icons){const [x,y]=m.icons.names[name];assert.deepEqual([x,y],[icons.indexOf(name)%4,Math.floor(icons.indexOf(name)/4)]);const p=await cell(ip,x,y,4,4),b=bounds(p);assert(b.left>0&&b.top>0&&b.left+b.width<32&&b.top+b.height<32,name+' transparent padding');}
console.log('OK manifest v1: every required asset and path exists');console.log('OK blocks: all opposite edges match exactly');console.log('OK icons: transparent padding and locked palette');
const result=`PASS ${frames} sprite frames; ${tileCount} block tiles; ${icons.length} icons; all PNG colors in locked palette`;
console.log(result);await writeJSON('.artifacts/sprites/check-result.json',{status:'PASS',frames,tiles:tileCount,icons:icons.length,result});
