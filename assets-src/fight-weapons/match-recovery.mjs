// Slice existing generated recovery art, without drawing replacement pixels.
import sharp from 'sharp';
const path='public/assets/sprites/hero-cut-back.png';const layers=[];
for(let row=0;row<3;row++)layers.push({input:await sharp('public/assets/sprites/hero-cut.png').extract({left:384,top:row*128,width:128,height:128}).toBuffer(),left:384,top:row*128});
const base=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let y=0;y<384;y++)base.data.fill(0,(y*512+384)*4,(y*512+512)*4);
await sharp(base.data,{raw:{width:512,height:384,channels:4}}).composite(layers).png().toFile(path+'.tmp');await (await import('node:fs/promises')).rename(path+'.tmp',path);
