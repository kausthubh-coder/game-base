import sharp from 'sharp';
import {readFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('demos/opening/cutout/art'),out=path.resolve('.artifacts/opening/art-b');await mkdir(out,{recursive:true});
for(const shot of ['sickness','night','gods','mark']){
 const m=JSON.parse(await readFile(`${root}/${shot}/layers.json`,'utf8'));let bytes=0;const composites=[],tiles=[];
 for(const l of [...m.layers].sort((a,b)=>a.z-b.z)){
  for(const f of [l.file,...l.frames??[]]){const p=`${root}/${shot}/${f}`,meta=await sharp(p).metadata();if(meta.width!==l.w||meta.height!==l.h)throw Error(`${p}: ${meta.width}x${meta.height} != ${l.w}x${l.h}`);if(l.x<0||l.y<0||l.x+l.w>1920||l.y+l.h>1080)throw Error(`${l.id}: out of frame`);bytes+=(await stat(p)).size;
   const thumb=await sharp(p).resize(280,215,{fit:'inside'}).png().toBuffer();const t=await sharp(thumb).metadata();
   const label=Buffer.from(`<svg width="600" height="30"><text x="8" y="21" fill="white" font-size="17">${f}</text></svg>`);
   tiles.push(await sharp({create:{width:600,height:250,channels:4,background:'#333333'}}).composite([{input:await sharp({create:{width:300,height:250,channels:4,background:'#ff0000'}}).png().toBuffer(),left:300,top:0},{input:thumb,left:Math.floor((300-t.width)/2),top:32},{input:thumb,left:300+Math.floor((300-t.width)/2),top:32},{input:label,left:0,top:0}]).png().toBuffer());
  }
  composites.push({input:`${root}/${shot}/${l.file}`,left:l.x,top:l.y});
 }
 if(bytes>=1500000)throw Error(`${shot}: ${bytes} bytes exceeds shot budget`);
 const rest=await sharp({create:{width:1920,height:1080,channels:4,background:'#000'}}).composite(composites).png().toBuffer();await sharp(rest).toFile(`${out}/${shot}-stack.png`);
 const plates={sickness:'m5-sickness',night:'m6-ascent',gods:'m7-gods',mark:'m8-hand'};
 await sharp({create:{width:1920,height:540,channels:4,background:'#333'}}).composite([{input:await sharp(`demos/opening/art/plates/${plates[shot]}.jpg`).resize(960,540).png().toBuffer(),left:0,top:0},{input:await sharp(rest).resize(960,540).png().toBuffer(),left:960,top:0}]).png().toFile(`${out}/${shot}-rest.png`);
 for(let start=0;start<tiles.length;start+=12){const page=tiles.slice(start,start+12),rows=Math.ceil(page.length/3);await sharp({create:{width:1800,height:rows*250,channels:4,background:'#333'}}).composite(page.map((input,n)=>({input,left:(n%3)*600,top:Math.floor(n/3)*250}))).png().toFile(`${out}/${shot}-pieces-${Math.floor(start/12)+1}.png`);}
 console.log(`PASS ${shot}: ${m.layers.length} layers, ${bytes} shipped WebP bytes, dimensions and frame bounds match`);
}
