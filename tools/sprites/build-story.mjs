import sharp from 'sharp';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {root,readJSON,writeJSON,pixels,cell,clean,bounds,snap,fitted} from './lib.mjs';
import {animations} from './config.mjs';
import {storySprites} from './story-config.mjs';
const palette=(await readJSON('assets-src/palette.json')).colors;
const baselinePath='assets-src/story-baseline-3.json';
try{await fs.access(root+baselinePath);}catch{const manifest=await readJSON('public/assets/manifest.json'),hashes={};for(const path of [...Object.values(manifest.sprites).map(s=>s.sheet),manifest.icons.sheet,manifest.blocks.atlas])hashes[path]=createHash('sha256').update(await fs.readFile(root+'public/assets/'+path)).digest('hex');await writeJSON(baselinePath,{manifest,hashes});}
const additions={};
const existing=await readJSON('public/assets/manifest.json');
for(const [name,s] of Object.entries(storySprites)){
 if(existing.sprites[name])continue; // Approved sheets are append-only.
 try{await fs.access(root+`assets-src/raw/${name}-3.png`);}catch{continue;}
 const p=await pixels(`assets-src/raw/${name}-3.png`),cells=[],anims=s.animations??animations(s);
 for(const [action,a]of Object.entries(anims))for(const [direction,row]of Object.entries(a.rows))for(let col=0;col<a.frames;col++){
 let sc=col,sr=row;
 if(name==='gus'||name==='wren'){sc={front:0,back:1,side:2}[direction];sr=action==='idle'?col:(name==='gus'?[2,3,4,3]:[3,4,5,4])[col];}
 let source=p,sourceRow=sr,sourceRows=s.rows;if(name==='gus'){const edges=[0,270,541,816,1084,1360];const top=edges[sr],height=edges[sr+1]-top;source={data:await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).extract({left:0,top,width:p.w,height}).raw().toBuffer(),w:p.w,h:height};sourceRow=0;sourceRows=1;}const q=clean(await cell(source,sc,sourceRow,s.cols,sourceRows));cells.push({p:q,b:bounds(q),row,col,action});
 }
 const heights=cells.filter(c=>c.action==='idle').map(c=>c.b.height).sort((a,b)=>a-b);const scale=Math.min(s.height/(heights[Math.floor(heights.length/2)]??cells[0].b.height),(s.size-12)/Math.max(...cells.map(c=>c.b.width)),(s.anchor[1]-5)/Math.max(...cells.map(c=>c.b.height)));
 const layers=[];for(const c of cells){snap(c.p,palette);const q=await fitted(c.p,c.b,scale);layers.push({input:q.input,left:c.col*s.size+s.anchor[0]-Math.floor(q.w/2),top:c.row*s.size+s.anchor[1]-q.h+1});}
 const sheet=`sprites/${name}.png`;await sharp({create:{width:s.cols*s.size,height:s.rows*s.size,channels:4,background:'#00000000'}}).composite(layers).png().toFile(root+'public/assets/'+sheet);
 additions[name]={sheet,frame:[s.size,s.size],anchor:s.anchor,worldHeight:s.worldHeight,animations:anims};console.log('Built '+name);
}
// Read immediately before atomic publication, preserving concurrently added entries.
const manifest=await readJSON('public/assets/manifest.json');for(const [n,s]of Object.entries(additions)){if(manifest.sprites[n]&&JSON.stringify(manifest.sprites[n])!==JSON.stringify(s))throw Error('Existing entry differs: '+n);manifest.sprites[n]=s;}
const path=root+'public/assets/manifest.json';await fs.writeFile(path+'.story-tmp',JSON.stringify(manifest,null,2)+'\n');await fs.rename(path+'.story-tmp',path);
