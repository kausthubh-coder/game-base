import sharp from 'sharp';
import fs from 'node:fs/promises';
const names=process.argv.slice(2); const dir='.artifacts/fight-sprites';await fs.mkdir(dir,{recursive:true});
for(const name of names){const input=`public/assets/sprites/${name}.png`;await sharp(input).flatten({background:'#63804c'}).png().toFile(`${dir}/${name}-green.png`);const layers=[];for(let row=0;row<3;row++){layers.push({input:await sharp('public/assets/sprites/hero.png').extract({left:0,top:row*128,width:128,height:128}).toBuffer(),left:0,top:row*128});layers.push({input:await sharp(input).extract({left:0,top:row*128,width:512,height:128}).toBuffer(),left:128,top:row*128});}await sharp({create:{width:640,height:384,channels:4,background:'#63804c'}}).composite(layers).png().toFile(`${dir}/${name}-vs-idle.png`);}
