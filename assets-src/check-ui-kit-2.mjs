import sharp from 'sharp';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const specs=JSON.parse(await fs.readFile('assets-src/ui-kit-round-two.json'));
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json'));
const before=JSON.parse(execFileSync('git',['show','ui/game-look:public/assets/manifest.json'],{encoding:'utf8'}));
const copy=structuredClone(manifest);for(const n of Object.keys(specs))delete copy.uikit.images[n];assert.deepEqual(copy,before);
let total=0;const files=[];
for(const [n,s] of Object.entries(specs)){
 const p=`public/assets/ui/kit/${n}.png`,m=await sharp(p).metadata();
 assert.deepEqual([m.width,m.height],s.size,n);
 assert.equal(manifest.uikit.images[n],`ui/kit/${n}.png`);
 const {data,info}=await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height;
 const pix=(x,y)=>data.subarray((y*w+x)*4,(y*w+x)*4+4);
 if(s.repeat){for(let x=0;x<w;x++)assert.deepEqual(pix(x,0),pix(x,h-1),`${n} vertical seam`);if(s.repeat==='both')for(let y=0;y<h;y++)assert.deepEqual(pix(0,y),pix(w-1,y),`${n} horizontal seam`);}
 if(!['page','map-paper','map-fog'].includes(n))assert.equal(data[3],0,`${n} transparent exterior`);
 let minAlpha=255,maxAlpha=0;for(let i=3;i<data.length;i+=4){minAlpha=Math.min(minAlpha,data[i]);maxAlpha=Math.max(maxAlpha,data[i]);}
 if(n==='map-fog'){assert(minAlpha>=76);assert(maxAlpha<=179);}
 const bytes=(await fs.stat(p)).size;total+=bytes;files.push({name:n,width:w,height:h,bytes,minAlpha,maxAlpha});
}
assert(total<450000,`New PNGs exceed 450 KB: ${total}`);
const report={files,totalBytes:total,totalKB:total/1000,existingManifestUnchanged:true};
await fs.writeFile('.artifacts/ui-kit/sanity-2.json',JSON.stringify(report,null,2)+'\n');
console.log(report);
