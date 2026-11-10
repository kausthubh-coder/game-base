import {banding,bandThreshold,bandExempt} from './banding.mjs';
import {blockTileNames} from '../../src/content/blocks.ts';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {sprites,tiles,extraTiles,icons,animations} from './config.mjs';
import {root,readJSON,pixels,cell,bounds,writeJSON} from './lib.mjs';
const m=await readJSON('public/assets/manifest.json'),palette=new Set((await readJSON('assets-src/palette.json')).colors.map(s=>s.slice(1)));let frames=0;
assert.equal(m.version,1);for(const name of Object.keys(sprites))assert(m.sprites[name],'missing original '+name);
async function read(path,w,h){assert(!path.startsWith('/')&&!path.split('/').includes('..'),'relative path required');await fs.access(root+'public/assets/'+path);const p=await pixels('public/assets/'+path);assert.equal(p.w,w,path+' width');assert.equal(p.h,h,path+' height');for(let i=0;i<p.data.length;i+=4){const a=p.data[i+3];assert(a===0||a===255,path+' alpha must be binary');if(a){const hex=p.data.subarray(i,i+3).toString('hex');assert(palette.has(hex),path+' outside locked palette: '+hex);}}return p;}
for(const [name,c]of Object.entries(sprites)){
 const s=m.sprites[name];assert.deepEqual(s.frame,[c.size,c.size]);assert.deepEqual(s.anchor,c.anchor);assert.equal(s.worldHeight,c.worldHeight);assert.deepEqual(s.animations,animations(c));const p=await read(s.sheet,c.cols*c.size,c.rows*c.size);
 for(const a of Object.values(s.animations))for(const row of Object.values(a.rows))for(let col=0;col<c.cols;col++){
 const q=await cell(p,col,row,c.cols,c.rows);if(col>=a.frames){assert(q.data.every((v,i)=>i%4!==3||v===0),name+' unused cell');continue;}
 const b=bounds(q);assert(Math.abs(b.top+b.height-1-s.anchor[1])<=2,name+' feet baseline');assert(Math.abs(b.left+(b.width-1)/2-s.anchor[0])<=2,name+' horizontal anchor');
 for(let x=0;x<c.size;x++)for(const y of [0,c.size-1])assert.equal(q.data[(y*c.size+x)*4+3],0,name+' background');for(let y=0;y<c.size;y++)for(const x of [0,c.size-1])assert.equal(q.data[(y*c.size+x)*4+3],0,name+' background');frames++;
 }console.log('OK '+name+': sizes, anchors, transparency, palette and padding');
}
assert.equal(m.blocks.tile,32);assert.deepEqual(Object.keys(m.blocks.tiles).sort(),[...new Set([...tiles,...extraTiles])].sort());const atlasRows=Math.ceil((tiles.length+extraTiles.length)/8);const bp=await read(m.blocks.atlas,256,atlasRows*32);let tileCount=0;
for(const [name,cells]of Object.entries(m.blocks.tiles)){assert.equal(cells.length,[...tiles,...extraTiles].filter(t=>t===name).length);for(const [x,y]of cells){assert(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<8&&y>=0&&y<atlasRows);const p=await cell(bp,x,y,8,atlasRows);for(let i=3;i<p.data.length;i+=4)assert.equal(p.data[i],255,name+' opaque tile');for(let k=0;k<32;k++)for(let c=0;c<4;c++){assert.equal(p.data[(k*32)*4+c],p.data[(k*32+31)*4+c],name+' horizontal seam');assert.equal(p.data[k*4+c],p.data[(31*32+k)*4+c],name+' vertical seam');}assert(bandExempt.has(name)||banding(p)<=bandThreshold,`${name} banding ${banding(p).toFixed(2)} exceeds ${bandThreshold}`);tileCount++;}}
for(const name of blockTileNames().filter(n=>n!=='water'))assert(m.blocks.tiles[name]?.length,'missing content tile '+name);
const baseline=await readJSON('assets-src/block-baseline-2.json');
for(const [name,value]of Object.entries(baseline.manifest.sprites))assert.deepEqual(m.sprites[name],value,'original sprite unchanged '+name);for(const [key,value]of Object.entries(baseline.manifest.icons))assert.deepEqual(m.icons[key],value,'original icon entry unchanged '+key);
for(const [path,hash]of Object.entries(baseline.hashes))assert.equal(createHash('sha256').update(await fs.readFile(root+'public/assets/'+path)).digest('hex'),hash,path+' unchanged');
assert.equal(m.icons.tile,32);assert.deepEqual(Object.keys(m.icons.names).sort(),icons.slice().sort());const ip=await read(m.icons.sheet,128,128);for(const name of icons){const [x,y]=m.icons.names[name];assert.deepEqual([x,y],[icons.indexOf(name)%4,Math.floor(icons.indexOf(name)/4)]);const p=await cell(ip,x,y,4,4),b=bounds(p);assert(b.left>0&&b.top>0&&b.left+b.width<32&&b.top+b.height<32,name+' transparent padding');}
console.log('OK manifest v1: every required asset and path exists');console.log('OK blocks: all opposite edges match exactly');console.log('OK blocks: 4x4 row/column RGB mean deviation <= '+bandThreshold);console.log('OK content: every tile except shader water has atlas cells');console.log('OK sprites and icons: SHA-256 and manifest entries unchanged');console.log('OK icons: transparent padding and locked palette');
const result=`PASS ${frames} sprite frames; ${tileCount} block tiles; ${icons.length} icons; all PNG colors in locked palette`;
console.log(result);await writeJSON('.artifacts/sprites/check-result.json',{status:'PASS',frames,tiles:tileCount,icons:icons.length,result});

await import('./check-story.mjs');
