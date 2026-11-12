// Rebuild scene 9 art from retained generated sources. No drawing or part replacement.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {pixels, cell, clean, bounds, snap, readJSON, writeJSON} from './lib.mjs';
const source='assets-src/camp-sprites/';
const own=p=>[...new Set(Array.from({length:p.w*p.h},(_,i)=>p.data[i*4+3]?`#${p.data.subarray(i*4,i*4+3).toString('hex')}`:null).filter(Boolean))];
const hero=await pixels('public/assets/sprites/hero.png');
const fox=await pixels(source+'fox-blighted-base.png');
const rawHero=await pixels(source+'hero-camp-3.png');
const rawFox=await pixels(source+'fox-camp-3.png');
const heroCuts=[0,238,439,642,850,1056,1254,1460,1659,1881];
async function extractHero(col,row){const top=heroCuts[row],height=heroCuts[row+1]-top;const q=await sharp(rawHero.data,{raw:{width:rawHero.w,height:rawHero.h,channels:4}}).extract({left:col*209,top,width:209,height}).raw().toBuffer();return clean({data:q,w:209,h:height});}
async function placed(q,palette,size,anchor,sx,sy){clean(q);snap(q,palette);const b=bounds(q),w=Math.round(b.width*sx),h=Math.round(b.height*sy);const input=await sharp(q.data,{raw:{width:q.w,height:q.h,channels:4}}).extract(b).resize(w,h,{kernel:'nearest'}).png().toBuffer();return {input,left:anchor[0]-Math.floor((w-1)/2),top:anchor[1]+1-h};}
const heroLayers=[];
for(let row=0;row<9;row++)for(let col=0;col<(row<6?2:4);col++){
 let p;
 if(row>=6&&col===3){const q=await cell(hero,0,row-6,6,7);p={input:await sharp(q.data,{raw:{width:128,height:128,channels:4}}).png().toBuffer(),left:0,top:0};}
 else p=await placed(await extractHero(col,row),own(hero),128,[64,120],.66,.61);
 heroLayers.push({...p,left:p.left+col*128,top:p.top+row*128});
}
await sharp({create:{width:512,height:1152,channels:4,background:'#00000000'}}).composite(heroLayers).png().toFile('public/assets/sprites/hero-camp.png');
const foxLayers=[{input:await fs.readFile(source+'fox-blighted-base.png'),left:0,top:0}];
for(let row=0;row<6;row++)for(let col=0;col<(row<3?4:2);col++){
 const q=clean(await cell(rawFox,col,row,4,6));const p=await placed(q,own(fox),96,[48,88],.37,.40);
 foxLayers.push({...p,left:p.left+col*96,top:p.top+(row+6)*96});
}
await sharp({create:{width:384,height:1152,channels:4,background:'#00000000'}}).composite(foxLayers).png().toFile('public/assets/sprites/fox-blighted.png');
const m=await readJSON('public/assets/manifest.json');
m.sprites['hero-camp']={sheet:'sprites/hero-camp.png',frame:[128,128],anchor:[64,120],worldHeight:2,animations:{sit:{frames:2,fps:2,rows:{front:0,back:1,side:2}},look:{frames:2,fps:2,rows:{front:3,back:4,side:5}},rise:{frames:4,fps:5,rows:{front:6,back:7,side:8}}}};
m.sprites['fox-blighted'].animations.stalk={frames:4,fps:4,rows:{front:6,back:7,side:8}};
m.sprites['fox-blighted'].animations.shake={frames:2,fps:12,rows:{front:9,back:10,side:11}};
await writeJSON('public/assets/manifest.json',m);
console.log('PASS built hero-camp and fox-blighted from retained generated sources');
