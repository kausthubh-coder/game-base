// Rebuild farm sprites from retained generated sources. No pixels are drawn here.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {pixels,cell,clean,bounds,snap,fitted,readJSON,writeJSON,png} from './lib.mjs';
import {storySprites} from './story-config.mjs';
const palette=(await readJSON('assets-src/palette.json')).colors;
const manifest=await readJSON('public/assets/manifest.json');
for(const name of ['mossling','burrower','frog','bee','lanternfly-world']){
 const s=storySprites[name],p=await pixels(`assets-src/raw/${name}-3.png`),cells=[];
 for(let row=0;row<s.rows;row++)for(let col=0;col<4;col++){
  let sc=col,sr=row,sourceRows=name==='burrower'?9:s.rows;
  if(name==='frog'){
   // Generator put directions in columns; transpose its pose sequence into animation rows.
   sc=[0,1,2][row%3];
   sr=row<3?[0,1,2,1][col]:row<6?[3,4,5,4][col]:[6,7,8,8][col];
  }
  if(name==='burrower'&&row>=9){sr=row-3;sc=3-col;}
  const q=clean(await cell(p,sc,sr,4,sourceRows));cells.push({q,b:bounds(q),row,col});
 }
 const idle=cells.filter(c=>c.row<3).map(c=>c.b.height).sort((a,b)=>a-b);
 const scale=Math.min(s.height/idle[6],84/Math.max(...cells.map(c=>c.b.width)),83/Math.max(...cells.map(c=>c.b.height)));
 const layers=[];
 for(const c of cells){snap(c.q,palette);const poseScale=name==='mossling'&&c.row>=6?scale*1.16:scale;const q=await fitted(c.q,c.b,poseScale);layers.push({input:q.input,left:c.col*96+48-Math.floor(q.w/2),top:c.row*96+89-q.h});}
 const sheet=`sprites/${name}.png`;
 await sharp({create:{width:384,height:s.rows*96,channels:4,background:'#00000000'}}).composite(layers).png().toFile('public/assets/'+sheet);
 manifest.sprites[name]={sheet,frame:[96,96],anchor:[48,88],worldHeight:s.worldHeight,animations:s.animations};
}
// User explicitly requested replacement, keeping legacy rows, frame, anchor and animation metadata.
await sharp('public/assets/sprites/lanternfly-world.png').extract({left:0,top:0,width:384,height:96}).png().toFile('public/assets/sprites/lanternfly.png');
// Extract only generated amber abdomen pixels, preserving exact registration with the world sheet.
const glow=await pixels('public/assets/sprites/lanternfly-world.png');
for(let y=0;y<glow.h;y++)for(let x=0;x<glow.w;x++){
 const i=(y*glow.w+x)*4,[r,g,b,a]=glow.data.subarray(i,i+4);
 if(!(a&&y%96>65&&x%96>27&&x%96<66&&r>g*1.1&&g>b*1.4&&r>160))glow.data.fill(0,i,i+4);
}
// Keep the largest amber component per cell, removing wing/leg flecks from the mask.
for(let row=0;row<6;row++)for(let col=0;col<4;col++){
 const seen=new Set(),groups=[];
 for(let y=0;y<96;y++)for(let x=0;x<96;x++){
  const k=(row*96+y)*glow.w+col*96+x;if(seen.has(k)||!glow.data[k*4+3])continue;
  const group=[k];seen.add(k);
  for(let j=0;j<group.length;j++){const a=group[j];for(const b of [a-1,a+1,a-glow.w,a+glow.w])if(b>=0&&b<glow.w*glow.h&&!seen.has(b)&&glow.data[b*4+3]){seen.add(b);group.push(b);}}
  groups.push(group);
 }
 groups.sort((a,b)=>b.length-a.length);for(const group of groups.slice(1))for(const k of group)glow.data.fill(0,k*4,k*4+4);
}
await fs.writeFile('public/assets/sprites/lanternfly-glow.png',await png(glow.data,glow.w,glow.h));
manifest.sprites['lanternfly-glow']={...manifest.sprites['lanternfly-world'],sheet:'sprites/lanternfly-glow.png'};
await writeJSON('public/assets/manifest.json',manifest);
console.log('Built five farm creatures, legacy lanternfly and registered amber glow mask.');
