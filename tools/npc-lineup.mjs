// Compare shipped crowd frames with the frozen cast, at native size.
import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { storySprites } from './sprites/story-config.mjs';
const out='/Users/dabot/dev/sandbox/game-look-test/design/img/npc';
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('public/assets/manifest.json'));
const names=['hero','tamsin','maren','odo','gus','mira','wren','juniper','brack',...Object.keys(storySprites).filter(n=>n.startsWith('town-'))];
const layers=[];
for(let i=0;i<names.length;i++) {
 const s=manifest.sprites[names[i]];
 for(const [d,row] of Object.entries(s.animations.idle.rows)) {
  const j={front:0,back:1,side:2}[d];
  layers.push({input:await sharp('public/assets/'+s.sheet).extract({left:0,top:row*128,width:128,height:128}).png().toBuffer(),left:i%3*400+j*128,top:Math.floor(i/3)*158+24});
 }
}
const h=Math.ceil(names.length/3)*158;
layers.push({input:Buffer.from(`<svg width="1200" height="${h}"><g font-family="monospace" font-size="16" fill="#302529">${names.map((n,i)=>`<text x="${i%3*400+8}" y="${Math.floor(i/3)*158+20}">${n}</text>`).join('')}</g></svg>`),left:0,top:0});
await sharp({create:{width:1200,height:h,channels:4,background:'#e8dfc4'}}).composite(layers).png().toFile(out+'/cast-and-crowd.png');
console.log(out+'/cast-and-crowd.png');
