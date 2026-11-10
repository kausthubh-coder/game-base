// Process a generated standalone tile without rewriting the frozen block atlas.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {pixels, snap, png, readJSON, root} from './lib.mjs';
const existing=await readJSON('public/assets/manifest.json');
if(existing.materials?.names?.oak_boards){console.log('Preserved existing materials.oak_boards; use a new name for another revision.');process.exit(0);}
const raw=await pixels('assets-src/raw/oak-boards-2.png');
const data=await sharp(raw.data,{raw:{width:raw.w,height:raw.h,channels:4}}).resize(32,32,{kernel:'lanczos3'}).raw().toBuffer();
const p={data,w:32,h:32};
// Restrict this material to the approved wood ramp; retain generated board joints.
snap(p,['#664930','#916534','#9b6f3e','#b28655','#b78b5a']);
// Match opposite edges as in the block pipeline, preserving the generated interior.
for(let k=0;k<32;k++) for(let c=0;c<4;c++) p.data[(k*32+31)*4+c]=p.data[k*32*4+c];
for(let k=0;k<32;k++) for(let c=0;c<4;c++) p.data[(31*32+k)*4+c]=p.data[k*4+c];
await fs.writeFile(root+'public/assets/blocks/oak-boards.png',await png(data,32,32));
const m=await readJSON('public/assets/manifest.json');
m.materials={...(m.materials??{}),tile:32,sheet:'blocks/oak-boards.png',names:{oak_boards:[0,0]}};
await fs.writeFile(root+'public/assets/manifest.json.valley-tmp',JSON.stringify(m,null,2)+'\n');
await fs.rename(root+'public/assets/manifest.json.valley-tmp',root+'public/assets/manifest.json');
const layers=[];const tile=await png(data,32,32);
for(let y=0;y<6;y++)for(let x=0;x<6;x++)layers.push({input:tile,left:x*32,top:y*32});
await sharp({create:{width:192,height:192,channels:4,background:'#000000'}}).composite(layers).png().toBuffer().then(b=>sharp(b).resize(576,576,{kernel:'nearest'}).png().toFile(root+'.artifacts/assets/oak-boards-repeat.png'));
console.log('Built materials.oak_boards; frozen atlas unchanged. World loader integration pending.');
