import sharp from 'sharp';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {parseManifest} from '../src/features/assets/manifest.ts';
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json'));
const m=parseManifest(manifest);assert(m.images.ui);assert(!m.images.uikit&&!m.sheets.uikit&&!m.sheets.uitabs);
assert.equal(manifest.uikit.lazy,true);
const iconNames=['bag','make','almanac','quests','map','settings','account','resume','save-quit','sun','moon','diamond'];
assert.deepEqual(manifest.uikit.tabs.names,Object.fromEntries(iconNames.map((n,i)=>[n,[i%4,Math.floor(i/4)]])));
const specs=JSON.parse(await fs.readFile('assets-src/ui-kit-slices.json'));
let total=0,report=[];
for(const [name,s] of Object.entries(specs)){
 const file='public/assets/ui/kit/'+name+'.png';const bytes=(await fs.stat(file)).size;total+=bytes;
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.deepEqual([info.width,info.height],s.size,name+' size');assert(bytes<1024*1024);
 let min=255,max=0;for(let i=3;i<data.length;i+=4){min=Math.min(min,data[i]);max=Math.max(max,data[i]);}assert.equal(min,0,name+' transparent ground');assert(max>0,name+' visible art');
 if(['dial','minimap-ring'].includes(name))assert.equal(data[4*(Math.floor(info.height/2)*info.width+Math.floor(info.width/2))+3],0,name+' transparent centre');
 if(name==='stars')for(let a=0;a<512;a++){assert.equal(data[4*a+3],0);assert.equal(data[4*(511*512+a)+3],0);assert.equal(data[4*(a*512)+3],0);assert.equal(data[4*(a*512+511)+3],0);}
 report.push({name,bytes,size:s.size,alpha:[min,max]});
 if(s.slice){
  const [t,r,b,l]=s.slice,[w,h]=s.size,p=(x,y)=>data.subarray(4*(y*w+x),4*(y*w+x)+4);
  for(let y=0;y<h;y++)for(let x=l+1;x<w-r;x++)assert(p(x,y).equals(p(l,y)),name+' horizontal stretch profile');
  if(t)for(let x=0;x<w;x++)for(let y=t+1;y<h-b;y++)assert(p(x,y).equals(p(x,t)),name+' vertical stretch profile');
 }
}
assert(total<900*1024,'kit under 900 KiB');
console.log(JSON.stringify({totalBytes:total,totalKiB:total/1024,images:Object.keys(m.images),sheets:Object.keys(m.sheets),files:report},null,2));
