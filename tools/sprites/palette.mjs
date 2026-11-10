import sharp from 'sharp';
import {root,writeJSON,png} from './lib.mjs';
// Targets select balanced ramps; stored colors are actual RGB samples from the mood references.
const targets=['302529','493335','65453b','815840','a27150','c48d63','e4ae7c','f7d4a1','fff0cf','603639','88494a','ab5c50','d67b5c','efab7c','352e3f','51465d','726b7b','928997','b4a8b0','d4c8c5','253d34','3c5637','516a3c','6c8244','8d9a4b','adad59','c9c478','35506a','4c7192','6e99b5','96c4cf','cadde0','6b4a2e','936737','b58a41','d5aa56','edca77','f9df99','684354','926078','b68e9b','e8bdb4','1f645f','2caaa0','68e8cc','d8fff1','263442','e5e5ce'];
const refs=['/Users/dabot/dev/sandbox/game-look-test/mockups/B1-side-25d-village.jpg','/Users/dabot/dev/sandbox/game-look-test/mockups/C1-fixed-3d-village.jpg'];
const samples=[];for(const path of refs){const d=await sharp(path).removeAlpha().raw().toBuffer();for(let i=0;i<d.length;i+=9)samples.push([d[i],d[i+1],d[i+2]]);}
const colors=targets.map(h=>{const t=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));let best,dist=Infinity;for(const c of samples){const d=c.reduce((v,x,i)=>v+(x-t[i])**2,0);if(d<dist){dist=d;best=c;}}return '#'+best.map(v=>v.toString(16).padStart(2,'0')).join('');});
if(new Set(colors).size!==48)throw Error('Duplicate palette colors');
await writeJSON('assets-src/palette.json',{version:1,colors,references:refs,method:'Nearest reference RGB to balanced material ramps; lume occupies final teal ramp.'});
const data=Buffer.alloc(8*24*6*24*4);for(let y=0;y<144;y++)for(let x=0;x<192;x++){const c=colors[Math.floor(y/24)*8+Math.floor(x/24)];const i=(y*192+x)*4;data.set([1,3,5].map(j=>parseInt(c.slice(j,j+2),16)),i);data[i+3]=255;}await sharp(await png(data,192,144)).toFile(root+'assets-src/palette.png');console.log('Wrote locked palette');
