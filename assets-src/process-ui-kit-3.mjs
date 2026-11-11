import sharp from 'sharp';
import fs from 'node:fs/promises';
const specs=JSON.parse(await fs.readFile('assets-src/ui-kit-round-three.json'));
const prompts=JSON.parse(await fs.readFile('assets-src/ui-kit-prompts.json'));
const slices=JSON.parse(await fs.readFile('assets-src/ui-kit-slices.json'));
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json'));
for(const [name,s] of Object.entries(specs)){
 for(const a of s.attempts){try{await fs.access(a.raw);}catch{await fs.copyFile(a.source,a.raw);}}
 const raw=s.attempts.at(-1).raw,[w,h]=s.size;
 let input=sharp(raw).ensureAlpha();
 if(name==='icons2') input=input.resize(w,h,{fit:'fill'});
 else if(!s.repeat){
  const {data,info}=await input.raw().toBuffer({resolveWithObject:true});
  let x0=info.width,y0=info.height,x1=0,y1=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>180){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  input=sharp(raw).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize(w-4,h-4,{fit:'fill'}).extend({top:2,bottom:2,left:2,right:2,background:'#0000'}).ensureAlpha();
 }else input=input.resize(w,h,{fit:'fill'});
 let data=await input.raw().toBuffer();
 if(s.repeat){
  const src=Buffer.from(data);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const ax=s.repeat==='both'?Math.sin(Math.PI*x/(w-1))**2:1,ay=Math.sin(Math.PI*y/(h-1))**2;
   const xx=(x+w/2)%w,yy=(y+h/2)%h;
   for(let c=0;c<4;c++) data[(y*w+x)*4+c]=Math.round(src[(y*w+x)*4+c]*ax*ay+src[(y*w+xx)*4+c]*(1-ax)*ay+src[(yy*w+x)*4+c]*ax*(1-ay)+src[(yy*w+xx)*4+c]*(1-ax)*(1-ay));
  }
 }
 if(name==='icons2'){
  // Preserve generated strokes; suppress backing and normalize to the approved gold.
  for(let i=0;i<data.length;i+=4){const chroma=Math.max(0,data[i]-data[i+2]);data[i+3]=Math.round(data[i+3]*Math.min(1,Math.max(0,(chroma-20)/55)));data[i]=211;data[i+1]=188;data[i+2]=142;}
 }
 if(name==='leather') for(let i=0;i<data.length;i+=4){const d=(data[i]*.3+data[i+1]*.6+data[i+2]*.1-90)*.22;data[i]=101+d;data[i+1]=69+d;data[i+2]=43+d;data[i+3]=255;}
 for(let i=0;i<data.length;i+=4)if(data[i+3]<4)data[i]=data[i+1]=data[i+2]=data[i+3]=0;
 if(['tag','leather-panel'].includes(name)){
  const smooth=await sharp(data,{raw:{width:w,height:h,channels:4}}).blur(.6).raw().toBuffer();
  for(let i=0;i<data.length;i+=4){for(let c=0;c<3;c++)data[i+c]=smooth[i+c];}
 }
 let encoder=sharp(data,{raw:{width:w,height:h,channels:4}});
 let compressed=await encoder.png({palette:true,colors:48,quality:80,dither:0,effort:10}).toBuffer();
 if(s.repeat){
  const d=await sharp(compressed).ensureAlpha().raw().toBuffer();
  for(let x=0;x<w;x++)d.copy(d,((h-1)*w+x)*4,x*4,x*4+4);
  if(s.repeat==='both')for(let y=0;y<h;y++)d.copy(d,(y*w+w-1)*4,y*w*4,y*w*4+4);
  compressed=await sharp(d,{raw:{width:w,height:h,channels:4}}).png({palette:true,colors:48,dither:0,effort:10}).toBuffer();
 }
 await fs.writeFile(`public/assets/ui/kit/${name}.png`,compressed);
 prompts[name]={prompt:s.prompt,tool:'built-in image_gen',attempts:s.attempts,kept:s.attempts.at(-1).attempt};
 slices[name]={size:s.size,...(s.slice?{slice:s.slice}:{}),...(s.repeat?{repeat:s.repeat}:{})};
 manifest.uikit.images[name]=`ui/kit/${name}.png`;
}
const names=['things','by-hand','creatures','pets','crops','people','places','zoom-in','zoom-out','find-me','pin','waypoint','close','page-left','page-right','drag'];
// The current build packager treats a second reference to one file as circular.
// Keep the requested mapping in the source record until the coordinator fixes it.
specs.icons2.requestedTabs2={tile:96,sheet:'ui/kit/icons2.png',names:Object.fromEntries(names.map((n,i)=>[n,[i%4,Math.floor(i/4)]]))};
delete manifest.uikit.tabs2;
await fs.writeFile('assets-src/ui-kit-round-three.json',JSON.stringify(specs,null,2)+'\n');
for(const [p,v]of [['assets-src/ui-kit-prompts.json',prompts],['assets-src/ui-kit-slices.json',slices],['public/assets/manifest.json',manifest]])await fs.writeFile(p,JSON.stringify(v,null,2)+'\n');
console.log('Processed round three');
