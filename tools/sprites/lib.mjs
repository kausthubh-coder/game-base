import sharp from 'sharp';
import fs from 'node:fs/promises';
export const root = new URL('../../',import.meta.url).pathname;
export const readJSON = async p => JSON.parse(await fs.readFile(root+p,'utf8'));
export const writeJSON = (p,v) => fs.writeFile(root+p,JSON.stringify(v,null,2)+'\n');
export async function pixels(path){const {data,info}=await sharp(root+path).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,w:info.width,h:info.height};}
export const png=(data,w,h)=>sharp(data,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
export async function cell(p,col,row,cols,rows){const left=Math.round(col*p.w/cols),top=Math.round(row*p.h/rows);const w=Math.round((col+1)*p.w/cols)-left,h=Math.round((row+1)*p.h/rows)-top;return {data:await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).extract({left,top,width:w,height:h}).raw().toBuffer(),w,h};}
// Harden alpha and discard disconnected background specks. Never erase enclosed light clothing.
export function clean(p,minShare=0.005){const seen=new Uint8Array(p.w*p.h),components=[];for(let i=0;i<seen.length;i++){p.data[i*4+3]=p.data[i*4+3]>=210?255:0;}
 for(let i=0;i<seen.length;i++){if(seen[i]||!p.data[i*4+3])continue;let queue=[i];seen[i]=1;for(let q=0;q<queue.length;q++){const k=queue[q],x=k%p.w,y=Math.floor(k/p.w);for(const n of [x>0?k-1:-1,x<p.w-1?k+1:-1,y>0?k-p.w:-1,y<p.h-1?k+p.w:-1])if(n>=0&&!seen[n]&&p.data[n*4+3]){seen[n]=1;queue.push(n);}}components.push(queue);}
 const max=Math.max(0,...components.map(c=>c.length));for(const c of components)if(c.length<Math.max(5,max*minShare))for(const k of c)p.data[k*4+3]=0;
 return p;
}
export function bounds(p){let l=p.w,t=p.h,r=-1,b=-1;for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++)if(p.data[(y*p.w+x)*4+3]){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}if(r<0)throw Error('Empty generated cell');return {left:l,top:t,width:r-l+1,height:b-t+1};}
export function snap(p,palette){const colors=palette.map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16))),cache=new Map();for(let i=0;i<p.data.length;i+=4){if(!p.data[i+3]){p.data.fill(0,i,i+4);continue;}const key=(p.data[i]<<16)|(p.data[i+1]<<8)|p.data[i+2];let best=cache.get(key);if(!best){let d=Infinity;for(const c of colors){const v=2*(p.data[i]-c[0])**2+3*(p.data[i+1]-c[1])**2+(p.data[i+2]-c[2])**2;if(v<d){d=v;best=c;}}cache.set(key,best);}p.data.set(best,i);p.data[i+3]=255;}return p;}
export async function fitted(p,b,scale){const w=Math.max(1,Math.round(b.width*scale)),h=Math.max(1,Math.round(b.height*scale));return {input:await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).extract(b).resize(w,h,{kernel:'nearest'}).png().toBuffer(),w,h};}
// `fitted` for a new builder: each target pixel takes the commonest colour of the source pixels it covers, and a dark
// outline colour wins from 30% of them. Nearest-neighbour scaling of a generated source (blocks about 3 pixels wide,
// scaled by about 0.6) breaks thin lines and doubles others; this keeps the outline closed. Snap colours before it.
export async function fittedMode(p,b,scale){const w=Math.max(1,Math.round(b.width*scale)),h=Math.max(1,Math.round(b.height*scale)),data=Buffer.alloc(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const x0=b.left+x/scale,x1=b.left+(x+1)/scale,y0=b.top+y/scale,y1=b.top+(y+1)/scale,counts=new Map();let total=0,clear=0;
  for(let sy=Math.floor(y0);sy<Math.min(p.h,Math.ceil(y1));sy++)for(let sx=Math.floor(x0);sx<Math.min(p.w,Math.ceil(x1));sx++){const share=(Math.min(x1,sx+1)-Math.max(x0,sx))*(Math.min(y1,sy+1)-Math.max(y0,sy)),o=(sy*p.w+sx)*4;total+=share;if(!p.data[o+3]){clear+=share;continue;}const key=(p.data[o]<<16)|(p.data[o+1]<<8)|p.data[o+2];counts.set(key,(counts.get(key)??0)+share);}
  if(clear>total/2||!counts.size)continue;
  let best=0,most=0,dark=0,darkMost=0;for(const [k,v]of counts){if(v>most){best=k;most=v;}if(0.2126*(k>>16)+0.7152*((k>>8)&255)+0.0722*(k&255)<70&&v>darkMost){dark=k;darkMost=v;}}
  const pick=darkMost>=0.3*(total-clear)?dark:best,o=(y*w+x)*4;data[o]=pick>>16;data[o+1]=(pick>>8)&255;data[o+2]=pick&255;data[o+3]=255;}
 return {input:await png(data,w,h),w,h};}
