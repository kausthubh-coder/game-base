// Slice generated poses only; keep the original Custodian sheet and baseline frozen.
import sharp from 'sharp';
import {pixels,cell,clean,bounds,snap,fitted,readJSON,writeJSON} from './lib.mjs';
import {storySprites} from './story-config.mjs';
const p=await pixels('assets-src/raw/custodian-wake-3.png');
const palette=(await readJSON('assets-src/palette.json')).colors;
const cells=[];
for(let col=0;col<4;col++){const q=clean(await cell(p,col,0,4,1));cells.push({q,b:bounds(q)});}
const scale=Math.min(68/Math.max(...cells.map(c=>c.b.height)),84/Math.max(...cells.map(c=>c.b.width)));
const layers=[];
for(const [row,c]of cells.entries()){snap(c.q,palette);const f=await fitted(c.q,c.b,scale);layers.push({input:f.input,left:48-Math.floor(f.w/2),top:row*96+89-f.h});}
await sharp({create:{width:384,height:384,channels:4,background:'#00000000'}}).composite(layers).png().toFile('public/assets/sprites/custodian-wake.png');
const m=await readJSON('public/assets/manifest.json'),c=storySprites['custodian-wake'];
m.sprites['custodian-wake']={sheet:'sprites/custodian-wake.png',frame:[96,96],anchor:c.anchor,worldHeight:c.worldHeight,animations:c.animations};
await writeJSON('public/assets/manifest.json',m);
