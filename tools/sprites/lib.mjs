import sharp from 'sharp';
import fs from 'node:fs/promises';
export const root = new URL('../../',import.meta.url).pathname;
export const readJSON = async p => JSON.parse(await fs.readFile(root+p,'utf8'));
export const writeJSON = (p,v) => fs.writeFile(root+p,JSON.stringify(v,null,2)+'\n');
export async function pixels(path){const {data,info}=await sharp(root+path).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,w:info.width,h:info.height};}
export const png=(data,w,h)=>sharp(data,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
export async function cell(p,col,row,cols,rows){const left=Math.round(col*p.w/cols),top=Math.round(row*p.h/rows);const w=Math.round((col+1)*p.w/cols)-left,h=Math.round((row+1)*p.h/rows)-top;return {data:await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).extract({left,top,width:w,height:h}).raw().toBuffer(),w,h};}
// Harden alpha and discard disconnected background specks. Never erase enclosed light clothing.
export function clean(p){const seen=new Uint8Array(p.w*p.h),components=[];for(let i=0;i<seen.length;i++){p.data[i*4+3]=p.data[i*4+3]>=210?255:0;}
 for(let i=0;i<seen.length;i++){if(seen[i]||!p.data[i*4+3])continue;let queue=[i];seen[i]=1;for(let q=0;q<queue.length;q++){const k=queue[q],x=k%p.w,y=Math.floor(k/p.w);for(const n of [x>0?k-1:-1,x<p.w-1?k+1:-1,y>0?k-p.w:-1,y<p.h-1?k+p.w:-1])if(n>=0&&!seen[n]&&p.data[n*4+3]){seen[n]=1;queue.push(n);}}components.push(queue);}
 const max=Math.max(0,...components.map(c=>c.length));for(const c of components)if(c.length<Math.max(5,max*0.005))for(const k of c)p.data[k*4+3]=0;
 return p;
}
export function bounds(p){let l=p.w,t=p.h,r=-1,b=-1;for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++)if(p.data[(y*p.w+x)*4+3]){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}if(r<0)throw Error('Empty generated cell');return {left:l,top:t,width:r-l+1,height:b-t+1};}
export function snap(p,palette){const colors=palette.map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16))),cache=new Map();for(let i=0;i<p.data.length;i+=4){if(!p.data[i+3]){p.data.fill(0,i,i+4);continue;}const key=(p.data[i]<<16)|(p.data[i+1]<<8)|p.data[i+2];let best=cache.get(key);if(!best){let d=Infinity;for(const c of colors){const v=2*(p.data[i]-c[0])**2+3*(p.data[i+1]-c[1])**2+(p.data[i+2]-c[2])**2;if(v<d){d=v;best=c;}}cache.set(key,best);}p.data.set(best,i);p.data[i+3]=255;}return p;}
export async function fitted(p,b,scale){const w=Math.max(1,Math.round(b.width*scale)),h=Math.max(1,Math.round(b.height*scale));return {input:await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).extract(b).resize(w,h,{kernel:'nearest'}).png().toBuffer(),w,h};}
