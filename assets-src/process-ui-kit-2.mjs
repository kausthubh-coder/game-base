import sharp from 'sharp';
import fs from 'node:fs/promises';
const specs=JSON.parse(await fs.readFile('assets-src/ui-kit-round-two.json'));
const retries=JSON.parse(await fs.readFile('assets-src/ui-kit-round-two-retries.json'));
const prompts=JSON.parse(await fs.readFile('assets-src/ui-kit-prompts.json'));
const slices=JSON.parse(await fs.readFile('assets-src/ui-kit-slices.json'));
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json'));
const out='public/assets/ui/kit/';
for(const [name,s] of Object.entries(specs)){
 const attempt=retries[name]?2:1;
 const raw=`assets-src/raw/ui-kit/${name}-${attempt}.png`;
 try{await fs.access(raw);}catch{await fs.copyFile((retries[name]??s).source,raw);}
 const [w,h]=s.size;
 let input=sharp(raw);
 if(!s.repeat){
  const {data,info}=await input.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=info.width,y0=info.height,x1=0,y1=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>180){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  input=input.extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize(w-4,h-4,{fit:'fill'}).extend({top:2,bottom:2,left:2,right:2,background:'#0000'});
 }else input=input.resize(w,h,{fit:'fill'});
 let {data}=await input.ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(!s.repeat){
  // Remove detached generation flecks while keeping the antialiased main silhouette.
  const seen=new Uint8Array(w*h);let largest=[];
  for(let p=0;p<w*h;p++)if(!seen[p]&&data[p*4+3]>20){let q=[p];seen[p]=1;for(let k=0;k<q.length;k++){let a=q[k],x=a%w,y=Math.floor(a/w);for(const b of [x?a-1:-1,x<w-1?a+1:-1,y?a-w:-1,y<h-1?a+w:-1])if(b>=0&&!seen[b]&&data[b*4+3]>20){seen[b]=1;q.push(b);}}if(q.length>largest.length)largest=q;}
  const keep=new Uint8Array(w*h);for(const p of largest)keep[p]=1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!keep[y*w+x]){let near=false;for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++)if(keep[yy*w+xx])near=true;if(!near)data[(y*w+x)*4+3]=0;}
 }
 if(s.slice){
  // Repeat clean source edge profiles; keep generated ornament in corner squares.
  const [t,r,b,l]=s.slice,src=Buffer.from(data);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let sx=x,sy=y;
   if(x>=l&&x<w-r&&(y<t||y>=h-b))sx=Math.floor(w/2);
   if(y>=t&&y<h-b&&(x<l||x>=w-r))sy=Math.floor(h/2);
   if(name==='book-cover'&&x>=l&&x<w-r&&y>=t&&y<h-b){sx=Math.floor(w/2);sy=Math.floor(h/2);}
   src.copy(data,(y*w+x)*4,(sy*w+sx)*4,(sy*w+sx)*4+4);
  }
 }
 if(name==='map-fog')data=await sharp(data,{raw:{width:w,height:h,channels:4}}).blur(18).raw().toBuffer();
 if(s.repeat){
  // Blend half-tile offsets near boundaries, preserving the generated, asymmetric wisps.
  const src=Buffer.from(data);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const ax=s.repeat==='both'?Math.sin(Math.PI*x/(w-1))**2:1,ay=Math.sin(Math.PI*y/(h-1))**2;
   const xx=(x+Math.floor(w/2))%w,yy=(y+Math.floor(h/2))%h;
   for(let c=0;c<4;c++)data[(y*w+x)*4+c]=Math.round(src[(y*w+x)*4+c]*ax*ay+src[(y*w+xx)*4+c]*(1-ax)*ay+src[(yy*w+x)*4+c]*ax*(1-ay)+src[(yy*w+xx)*4+c]*(1-ax)*(1-ay));
  }
  for(let x=0;x<w;x++)data.copy(data,((h-1)*w+x)*4,x*4,x*4+4);
  if(s.repeat==='both')for(let y=0;y<h;y++)data.copy(data,(y*w+w-1)*4,y*w*4,y*w*4+4);
 }

 const fillSource=Buffer.from(data);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let i=(y*w+x)*4;
  if(name==='book-cover' && data[i]<100 && data[i+1]<110){const c=(Math.floor(h/2)*w+Math.floor(w/2))*4;for(let k=0;k<3;k++)data[i+k]=fillSource[c+k];}
  if(name.startsWith('tile') && data[i]<110 && data[i+1]<125){const c=(y*w+Math.floor(w/2))*4;for(let k=0;k<3;k++)data[i+k]=fillSource[c+k];}
  if(name==='page'||name==='map-paper'){
   const base=name==='page'?[239,230,210]:[227,212,176];
   const delta=(data[i]+data[i+1]+data[i+2])/3-(name==='page'?225:190);
   for(let c=0;c<3;c++)data[i+c]=Math.max(0,Math.min(255,Math.round(base[c]+delta*.23)));
  }
  if(name==='map-fog'){data[i]=244;data[i+1]=239;data[i+2]=226;data[i+3]=Math.round(76+data[i+3]*.40);}
  if(name==='gutter')data[i+3]=Math.round(data[i+3]*.38*Math.min(1,x/30,(w-1-x)/30));
  if(name.startsWith('tile')&&data[i]<110&&data[i+1]<125)data[i+3]=Math.min(data[i+3],230);
  if(data[i+3]<4)data[i]=data[i+1]=data[i+2]=data[i+3]=0;
 }
 await sharp(data,{raw:{width:w,height:h,channels:4}}).png({palette:true,colours:64,quality:name==='detail'?85:100,effort:10,dither:0}).toFile(out+name+'.png');
 prompts[name]={prompt:s.prompt,tool:'built-in image_gen',attempts:[{attempt:1,raw:`assets-src/raw/ui-kit/${name}-1.png`,source:s.source},...(attempt===2?[{attempt:2,raw,prompt:retries[name].prompt,source:retries[name].source}]:[])],kept:attempt};
 slices[name]={size:s.size,...(s.slice?{slice:s.slice}:{}),...(s.repeat?{repeat:s.repeat}:{})};
 manifest.uikit.images[name]=`ui/kit/${name}.png`;
}
for(const [path,value] of [['assets-src/ui-kit-prompts.json',prompts],['assets-src/ui-kit-slices.json',slices],['public/assets/manifest.json',manifest]])await fs.writeFile(path,JSON.stringify(value,null,2)+'\n');
console.log('Processed eleven generated assets.');
