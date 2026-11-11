import sharp from 'sharp';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {parseManifest} from '../src/features/assets/manifest.ts';
const specs=JSON.parse(await fs.readFile('assets-src/ui-kit-round-three.json'));
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json'));
const before=JSON.parse(execFileSync('git',['show','ui/game-look:public/assets/manifest.json'],{encoding:'utf8'}));
const copy=structuredClone(manifest);for(const n of Object.keys(specs))delete copy.uikit.images[n];delete copy.uikit.tabs2;assert.deepEqual(copy,before);
let total=0;const files=[];
for(const [n,s]of Object.entries(specs)){
 const p=`public/assets/ui/kit/${n}.png`,m=await sharp(p).metadata(),[w,h]=s.size;
 assert.deepEqual([m.width,m.height],s.size,n);assert.equal(manifest.uikit.images[n],`ui/kit/${n}.png`);
 const data=await sharp(p).ensureAlpha().raw().toBuffer(),pix=(x,y)=>data.subarray((y*w+x)*4,(y*w+x)*4+4);
 if(s.repeat){for(let x=0;x<w;x++)assert.deepEqual(pix(x,0),pix(x,h-1),`${n} vertical seam`);if(s.repeat==='both')for(let y=0;y<h;y++)assert.deepEqual(pix(0,y),pix(w-1,y),`${n} horizontal seam`);}
 else assert.equal(data[3],0,`${n} transparent exterior`);
 if(n==='card-frame')assert.equal(pix(w/2,h/2)[3],0,'frame interior');
 const bytes=(await fs.stat(p)).size;total+=bytes;files.push({name:n,size:s.size,bytes});
}
assert(total<700000,`new PNGs exceed 700 KB: ${total}`);
const parsed=parseManifest(manifest),old=parseManifest(before);
assert.deepEqual(parsed.images,old.images);assert.deepEqual(parsed.sheets,old.sheets);
const report={files,totalBytes:total,totalKB:total/1000,existingManifestUnchanged:true,lazyImages:Object.keys(parsed.uikit.images).length,loaderImages:Object.keys(parsed.images),loaderSheets:Object.keys(parsed.sheets),tabs2Omitted:'Parser accepts it; production packager rejects the duplicate PNG reference as Circular asset list'};
await fs.writeFile('.artifacts/ui-kit/sanity-3.json',JSON.stringify(report,null,2)+'\n');console.log(report);
