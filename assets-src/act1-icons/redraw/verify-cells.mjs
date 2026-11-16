// Run from the repo root. Compare against HEAD~0 captured before this redraw.
import sharp from 'sharp';
import {execFileSync} from 'node:child_process';
import {act1Icons,buildIconRedraw} from '../../../tools/sprites/act1-icons.mjs';
const base='830a426ae01d04e7d727a7918cda568056c16390';
const config=await Bun.file('assets-src/act1-icons/redraw/selected.json').json();
const palette=(await Bun.file('assets-src/palette.json').json()).colors;
let count=0;
for(const [set,spec]of Object.entries(config)) {
 const path='public/assets/icons/'+set+'.png';
 const before=await sharp(execFileSync('git',['show',base+':'+path])).ensureAlpha().raw().toBuffer();
 const now=await sharp(path).ensureAlpha().raw().toBuffer();
 const {names,cols}=act1Icons[set];
 for(const [i,name]of names.entries())if(!spec.names.includes(name)) {
  for(let y=0;y<32;y++) {
   const o=((Math.floor(i/cols)*32+y)*cols*32+i%cols*32)*4;
   if(!before.subarray(o,o+128).equals(now.subarray(o,o+128)))throw Error(set+'/'+name+' changed');
  }
  count++;
 }
 const bytes=await Bun.file(path).bytes();
 await buildIconRedraw(set,palette);
 if(!Buffer.from(bytes).equals(Buffer.from(await Bun.file(path).bytes())))throw Error(set+' rebuild differs');
}
console.log('PASS untouched cells: '+count+' match decoded RGBA at '+base+'; selected sheets rebuild byte for byte');
