// Rebuild only the explicitly replaceable hero-swing sheet. The manifest and frozen hero stay untouched.
// Run from the repo root: bun tools/sprites/hero-swing.mjs
import sharp from 'sharp';
import {pixels,cell,clean,bounds,snap,fitted,readJSON} from './lib.mjs';
const p=await pixels('assets-src/raw/hero-swing-3.png');
const palette=(await readJSON('assets-src/palette.json')).colors;
const cells=[];
for(let row=0;row<3;row++)for(let col=0;col<3;col++){
 const q=clean(await cell(p,col,row,3,3));cells.push({q,b:bounds(q),row,col});
}
const scale=Math.min(110/cells[0].b.height,116/Math.max(...cells.map(c=>c.b.width)),115/Math.max(...cells.map(c=>c.b.height)));
const layers=[];
// Whole-figure horizontal scaling matches the approved head/cape width. No parts are redrawn or pasted.
// Head regions exclude the axe and raised arms; coordinates refer to the initial standard pipeline output.
const heads=[[43,11,60,47],[33,9,62,49],[27,11,60,47],[43,11,60,46],[33,10,62,47],[27,11,60,46],[44,10,61,49],[32,10,62,49],[26,10,62,49]];
for(const [i,c]of cells.entries()){
 snap(c.q,palette);const q=await fitted(c.q,c.b,scale);
 const width=Math.round(q.w*56/heads[i][2]),height=c.row===2?Math.round(q.h*106/111):q.h;
 const input=await sharp(q.input).resize(width,height,{fit:'fill',kernel:'nearest'}).png().toBuffer();
 layers.push({input,left:c.col*128+64-Math.floor(width/2),top:c.row*128+121-height});
}
await sharp({create:{width:384,height:384,channels:4,background:'#00000000'}}).composite(layers).png().toFile('public/assets/sprites/hero-swing.png');
console.log('Built only hero-swing; manifest and all other sheets untouched. Whole-figure nearest-neighbor scale and palette/alpha cleanup only.');
