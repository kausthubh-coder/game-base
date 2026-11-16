// Generated figures only: uniform slicing, alpha cleanup, palette snap and whole-figure alignment.
// Candidates stay outside public/assets until their visual review passes.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {pixels,cell,clean,bounds,snap,fittedMode,readJSON} from './lib.mjs';
import {storySprites} from './story-config.mjs';
import {validateSpriteGeometry} from './geometry.mjs';
const action=process.argv.includes('--swing'),name=action?'hero-braid-swing':'hero-braid';
if(process.env.ATTEMPT && process.env.ATTEMPT!=='1')throw Error('Attempt needs its own stance metadata before building');
let source=await pixels(`assets-src/hero-braid/${action?'swing':'base'}-attempt-${process.env.ATTEMPT??1}.png`);
if(action){const data=await sharp(source.data,{raw:{width:source.w,height:source.h,channels:4}}).extract({left:580,top:0,width:1002,height:724}).raw().toBuffer();source={data,w:1002,h:724};}
const palette=(await readJSON('assets-src/palette.json')).colors;
let colours=palette;
if(action){const p=await pixels('assets-src/hero-braid/base-identity-reference.png');const own=new Set();for(let i=0;i<p.data.length;i+=4)if(p.data[i+3])own.add('#'+p.data.subarray(i,i+3).toString('hex'));colours=[...own,...palette.filter(h=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));return Math.max(r,g,b)-Math.min(r,g,b)<30;})];}
const cols=action?3:6,rows=action?3:6,cells=[];
for(let row=0;row<rows;row++)for(let col=0;col<(action?3:row<3?4:6);col++){const p=clean(await cell(source,col,row,cols,rows));snap(p,colours);cells.push({p,b:bounds(p),col,row});}
const heights=cells.map(c=>c.b.height).sort((a,b)=>a-b);
const scale=Math.min(110/heights[Math.floor(heights.length/2)],116/Math.max(...cells.map(c=>c.b.height)),116/Math.max(...cells.map(c=>c.b.width)));
const stance=await readJSON('assets-src/hero-braid/stance.json');
const legacy=process.argv.includes('--legacy');
const out=process.env.BRAID_OUT??'.artifacts/hero-braid-anchor';
const layers=[];
for(const {p,b,col,row}of cells){const q=await fittedMode(p,b,scale);const landmark=action?stance.swing[row][col]:row<3?stance.base[row][col]:stance.base[row-3].reduce((a,b)=>a+b)/4;
 const oldLeft=64-Math.floor(q.w/2);
 const rawOrigin=b.left+(landmark-oldLeft)/scale;
 const left=legacy?oldLeft:Math.round(64-(rawOrigin-b.left)*scale);
 if(left<1||left+q.w>=128)throw Error(`Stance clips ${name} row ${row} frame ${col}`);
 layers.push({input:q.input,left:col*128+left,top:row*128+121-q.h});}
await fs.mkdir(out,{recursive:true});
await sharp({create:{width:cols*128,height:rows*128,channels:4,background:'#00000000'}}).composite(layers).png().toFile(`${out}/${name}.png`);
console.log(`${name}: ${cells.length} generated frames; scale ${scale}`);


if(!legacy){const c=storySprites[name];await validateSpriteGeometry(await pixels(`${out}/${name}.png`),c,c.animations,name);}
