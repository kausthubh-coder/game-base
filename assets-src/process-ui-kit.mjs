import sharp from 'sharp';
import fs from 'node:fs/promises';
const raw='assets-src/raw/ui-kit/', out='public/assets/ui/kit/';
export const specs={panel:[512,512,112,112,112,112],'panel-dark':[512,512,112,112,112,112],divider:[1024,48],button:[384,112,0,56,0,56],'button-light':[384,112,0,56,0,56],'button-gold':[384,112,0,56,0,56],close:[128,128],back:[128,128],slot:[160,160,40,40,40,40],'slot-selected':[160,160,40,40,40,40],'slot-hover':[160,160,40,40,40,40],card:[192,232],'card-rare':[192,232],'card-epic':[192,232],'minimap-ring':[640,640],dial:[160,160],'name-plate':[512,96,0,96,0,96],hint:[512,96,0,64,0,64],stars:[512,512],tabs:[384,288],tooltip:[256,256,48,48,48,48]};
// Keep generated pixels. Only size, alpha, compression and repeatable edge cleanup occur here.
for(const [name,[w,h,t,r,b,l]] of Object.entries(specs)){
 const records=JSON.parse(await fs.readFile('assets-src/ui-kit-prompts.json'));
 let input=sharp(raw+name+'-'+records[name].kept+'.png');
 if(!['stars','tabs'].includes(name)){
  const {data:a,info:m}=await input.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=m.width,y0=m.height,x1=0,y1=0;
  for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(a[4*(y*m.width+x)+3]>100){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const margin=name.startsWith('slot')?6:name==='divider'?0:2;
  input=input.extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize(w-2*margin,h-2*margin,{fit:'fill'}).extend({top:margin,bottom:margin,left:margin,right:margin,background:'#0000'});
 }else input=input.resize(w,h,{fit:'fill'});
 let {data,info}=await input.ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const pixel=(x,y)=>4*(y*w+x);
 // Remove stray exterior flecks: preserve the largest connected silhouette.
 if(!['tabs','stars','divider'].includes(name)){
  let seen=new Uint8Array(w*h),largest=[];
  for(let start=0;start<w*h;start++)if(!seen[start]&&data[start*4+3]>16){
   let q=[start];seen[start]=1;
   for(let k=0;k<q.length;k++){let p=q[k],x=p%w,y=Math.floor(p/w);for(let n of [x? p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(n>=0&&!seen[n]&&data[n*4+3]>16){seen[n]=1;q.push(n);}}
   if(q.length>largest.length)largest=q;
  }
  let keep=new Uint8Array(w*h);for(const p of largest)keep[p]=1;
  // Retain the antialias fringe adjacent to the main silhouette.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(keep[p])continue;let adjacent=false;for(let yy=Math.max(0,y-2);yy<=Math.min(h-1,y+2);yy++)for(let xx=Math.max(0,x-2);xx<=Math.min(w-1,x+2);xx++)if(keep[yy*w+xx])adjacent=true;if(!adjacent)data[p*4+3]=0;}
 }
 // Restore opaque alpha inside the generated tooltip's enclosed rim. The image
 // generator's background extraction also removed part of its dark interior.
 if(name==='tooltip'){
  const outside=new Uint8Array(w*h),q=[];
  for(let p=0;p<w*h;p++){const x=p%w,y=Math.floor(p/w);if((x===0||y===0||x===w-1||y===h-1)&&data[4*p+3]<16){outside[p]=1;q.push(p);}}
  for(let k=0;k<q.length;k++){const p=q[k],x=p%w,y=Math.floor(p/w);for(const n of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(n>=0&&!outside[n]&&data[4*n+3]<16){outside[n]=1;q.push(n);}}
  for(let p=0;p<w*h;p++)if(!outside[p]&&data[4*p]<110&&data[4*p+1]<125){data[4*p]=31;data[4*p+1]=36;data[4*p+2]=51;data[4*p+3]=255;}
 }
 const original=Buffer.from(data);
 if(t!==undefined){
  // The central sample column/row gives a constant profile along each stretch axis.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let sx=x,sy=y;if(x>=l&&x<w-r)sx=Math.floor(w*.42);if(t&&y>=t&&y<h-b)sy=Math.floor(h*.42);
   original.copy(data,pixel(x,y),pixel(sx,sy),pixel(sx,sy)+4);
  }
 }
 // Keep translucent navy fills at the requested opacity; gold remains crisp.
 const opacity=name==='panel-dark'?.88:name==='hint'?.70:name.startsWith('slot')?.45:1;
 let starMax=0;if(name==='stars')for(let i=3;i<data.length;i+=4)starMax=Math.max(starMax,data[i]);
 for(let i=0;i<data.length;i+=4){
  if(opacity<1 && data[i]<110 && data[i+1]<125 && data[i+2]>=data[i]){
   data[i]=31;data[i+1]=36;data[i+2]=51;data[i+3]=data[i+3]>32?Math.round(255*opacity):Math.round(data[i+3]*opacity);
  }
  if(name==='panel'&&data[i]-data[i+1]<20&&data[i+1]-data[i+2]<30){data[i]=236;data[i+1]=229;data[i+2]=216;}
  if(name==='tooltip'&&data[i]<110&&data[i+1]<125&&data[i+2]>=data[i]){data[i]=31;data[i+1]=36;data[i+2]=51;}
  if(name==='tabs'&&data[i+3]>0){const light=data[i]>210;data[i]=light?240:211;data[i+1]=light?212:188;data[i+2]=light?138:142;}
  if(name==='name-plate'){const x=(i/4)%w;data[i+3]=Math.round(data[i+3]*Math.min(1,x/20,(w-1-x)/20));}
  if(name==='stars'){const p=i/4,x=p%w,y=Math.floor(p/w);data[i+3]=Math.round(data[i+3]/starMax*56*Math.min(1,x/24,(w-1-x)/24,y/24,(h-1-y)/24));}
  if(data[i+3]<3){data[i]=data[i+1]=data[i+2]=data[i+3]=0;}
 }
 // Transparent margins prevent clipping of faint edge antialias in consumers.
 await sharp(data,{raw:{width:w,height:h,channels:4}}).png({palette:true,colours:128,effort:10,dither:.15}).toFile(out+name+'.png');
}
const sizes=Object.fromEntries(Object.entries(specs).map(([n,[w,h,...slice]])=>[n,{size:[w,h],...(slice.length?{slice}:{} )}]));
await fs.writeFile('assets-src/ui-kit-slices.json',JSON.stringify(sizes,null,2)+'\n');
console.log('Processed',Object.keys(specs).length,'generated assets');
