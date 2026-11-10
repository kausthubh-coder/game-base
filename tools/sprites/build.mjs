import sharp from 'sharp';
import fs from 'node:fs/promises';
import {sprites,tiles,icons,animations} from './config.mjs';
import {root,readJSON,writeJSON,pixels,cell,clean,bounds,snap,fitted,png} from './lib.mjs';
const palette=(await readJSON('assets-src/palette.json')).colors;
const manifest={version:1,sprites:{},blocks:{tile:32,atlas:'blocks/atlas.png',tiles:{}},icons:{tile:32,sheet:'icons/icons.png',names:{}}};
for(const folder of ['sprites','blocks','icons'])await fs.mkdir(root+'public/assets/'+folder,{recursive:true});
for(const [name,s] of Object.entries(sprites)){
 const p=await pixels(`assets-src/raw/${name}-1.png`),cells=[];
 const anims=animations(s);
 for(const [action,a] of Object.entries(anims))for(const [direction,row] of Object.entries(a.rows))for(let col=0;col<a.frames;col++){let source=p; let sourceRow=row, sourceRows=s.rows; if(name==='hero'){const edges=[0,199,395,584,769,948,1144,1355].map(y=>Math.round(y*p.h/1355));const top=edges[row],height=edges[row+1]-top;source={data:await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).extract({left:0,top,width:p.w,height}).raw().toBuffer(),w:p.w,h:height};sourceRow=0;sourceRows=1;} const c=clean(await cell(source,col,sourceRow,s.cols,sourceRows));cells.push({action,direction,row,col,p:c,b:bounds(c)});}
 const ref=cells.filter(c=>c.action==='idle').map(c=>c.b.height).sort((a,b)=>a-b);const scale=Math.min(s.height/ref[Math.floor(ref.length/2)],(s.size-12)/Math.max(...cells.map(c=>c.b.width)),(s.anchor[1]-5)/Math.max(...cells.map(c=>c.b.height)));
 const layers=[];for(const c of cells){snap(c.p,palette);const q=await fitted(c.p,c.b,scale);layers.push({input:q.input,left:c.col*s.size+s.anchor[0]-Math.floor(q.w/2),top:c.row*s.size+s.anchor[1]-q.h+1});}
 const sheet=`sprites/${name}.png`;await sharp({create:{width:s.cols*s.size,height:s.rows*s.size,channels:4,background:'#00000000'}}).composite(layers).png().toFile(root+'public/assets/'+sheet);
 manifest.sprites[name]={sheet,frame:[s.size,s.size],anchor:s.anchor,worldHeight:s.worldHeight,animations:anims};
}
// Blend opposite edge bands before quantization. Exact opposite pixels share the same color.
function periodic(p){for(const axis of [0,1]){const old=Buffer.from(p.data);for(let k=0;k<4;k++){const t=(4-k)/4;for(let j=0;j<32;j++){const a=axis===0?(j*32+k)*4:(k*32+j)*4,b=axis===0?(j*32+31-k)*4:((31-k)*32+j)*4;for(let c=0;c<3;c++){const mean=(old[a+c]+old[b+c])/2;p.data[a+c]=Math.round(old[a+c]*(1-t)+mean*t);p.data[b+c]=Math.round(old[b+c]*(1-t)+mean*t);}}}}return p;}
const raw=await pixels('assets-src/raw/blocks-1.png'),tileLayers=[];
for(let i=0;i<tiles.length;i++){
 let c=tiles[i]==='clay'?await pixels('assets-src/raw/clay-2.png'):await cell(raw,i%6,Math.floor(i/6),6,6);
 c={data:await sharp(c.data,{raw:{width:c.w,height:c.h,channels:4}}).resize(32,32,{kernel:'nearest'}).raw().toBuffer(),w:32,h:32};for(let a=3;a<c.data.length;a+=4)c.data[a]=255;
 snap(periodic(c),palette);const xy=[i%8,Math.floor(i/8)];(manifest.blocks.tiles[tiles[i]]??=[]).push(xy);tileLayers.push({input:await png(c.data,32,32),left:xy[0]*32,top:xy[1]*32});
}
await sharp({create:{width:256,height:128,channels:4,background:'#00000000'}}).composite(tileLayers).png().toFile(root+'public/assets/blocks/atlas.png');
const ip=await pixels('assets-src/raw/icons-1.png'),il=[];
for(let i=0;i<icons.length;i++){const p=clean(await cell(ip,i%4,Math.floor(i/4),4,4)),b=bounds(p);snap(p,palette);const q=await fitted(p,b,26/Math.max(b.width,b.height)),xy=[i%4,Math.floor(i/4)];il.push({input:q.input,left:xy[0]*32+Math.floor((32-q.w)/2),top:xy[1]*32+Math.floor((32-q.h)/2)});manifest.icons.names[icons[i]]=xy;}
await sharp({create:{width:128,height:128,channels:4,background:'#00000000'}}).composite(il).png().toFile(root+'public/assets/icons/icons.png');
await writeJSON('public/assets/manifest.json',manifest);console.log('Built five sprite sheets, block atlas, icon sheet and manifest');
