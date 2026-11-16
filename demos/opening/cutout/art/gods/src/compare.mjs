import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
const m=JSON.parse(await readFile('demos/opening/cutout/art/gods/layers.json','utf8'));
const imgs=[];let n=0;
for(const l of m.layers.filter(l=>['stag','lion','tortoise','serpent','bird','elephant'].includes(l.id))){
 for(const [i,p]of ['demos/opening/art/plates/m7-gods.jpg','demos/opening/cutout/art/gods/src/unbanded-raw.png'].entries()){
 const full=await sharp(p).resize(1920,1080).png().toBuffer();const input=await sharp(full).extract({left:l.x,top:l.y,width:l.w,height:l.h}).resize(400,240,{fit:'contain',background:'#333'}).png().toBuffer();imgs.push({input,left:i*400,top:n*240});}n++;
}
await sharp({create:{width:800,height:n*240,channels:3,background:'#333'}}).composite(imgs).png().toFile('.artifacts/opening/art-b/gods-regenerated.png');
