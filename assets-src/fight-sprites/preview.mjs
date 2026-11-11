// Native-size inspection only. No sprite pixels are drawn or changed here.
import sharp from 'sharp';
import fs from 'node:fs/promises';
const out = '.artifacts/fight-sprites';
await fs.mkdir(out, {recursive:true});
for (const name of ['hero-cut','hero-moves','hero-call','leaftail-fight','pebblepup','pebblepup-fight']) {
  const path = `public/assets/sprites/${name}.png`;
  try { await fs.access(path); } catch { continue; }
  await sharp(path).flatten({background:'#667f46'}).png().toFile(`${out}/${name}-green.png`);
  if (!name.startsWith('hero-')) continue;
  const layers=[];
  for(let row=0;row<3;row++) {
    layers.push({input:await sharp('public/assets/sprites/hero.png').extract({left:0,top:row*128,width:128,height:128}).png().toBuffer(),left:0,top:row*128});
    layers.push({input:await sharp(path).extract({left:0,top:row*128,width:512,height:128}).png().toBuffer(),left:128,top:row*128});
  }
  await sharp({create:{width:640,height:384,channels:4,background:'#667f46'}}).composite(layers).png().toFile(`${out}/${name}-vs-idle.png`);
}
