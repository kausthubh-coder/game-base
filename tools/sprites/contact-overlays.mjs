import fs from 'node:fs/promises';
import sharp from 'sharp';
import {storySprites} from './story-config.mjs';
import {pixels,readJSON} from './lib.mjs';
import {validateSpriteGeometry} from './geometry.mjs';
const [name,out]=process.argv.slice(2),c=storySprites[name];
if(!c?.groundContact||!out)throw Error('Usage: contact-overlays.mjs <registered-name> <output-folder>');
const entry=(await readJSON('public/assets/manifest.json')).sprites[name];
const p=await pixels('public/assets/'+entry.sheet);
const measured=await validateSpriteGeometry(p,c,entry.animations,name);
const marks=Object.entries(c.groundContact).map(([key,[l,t,r,b]])=>{
 const [row,col]=key.split(':').map(Number),x=col*c.size,y=row*c.size;
 return `<rect x="${x+l}" y="${y+t}" width="${r-l}" height="${b-t}" fill="none" stroke="#ff00ff" stroke-width="0.5"/><path d="M${x+64} ${y+100}v25" stroke="#00ffff" stroke-width="0.5"/>`;
}).join('');
await fs.mkdir(out,{recursive:true});
const overlay=await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).flatten({background:'#7f9a4c'}).composite([{input:Buffer.from(`<svg width="${p.w}" height="${p.h}">${marks}</svg>`)}]).png().toBuffer();
await sharp(overlay).resize(p.w*2,p.h*2,{kernel:'nearest'}).png().toFile(`${out}/${name}-contact.png`);
await fs.writeFile(`${out}/${name}-contact.json`,JSON.stringify(measured,null,2)+'\n');
