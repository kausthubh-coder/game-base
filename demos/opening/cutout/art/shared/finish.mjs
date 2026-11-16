import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.dirname(new URL(import.meta.url).pathname);
async function largest(file){const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});const {width:w,height:h}=info,seen=new Uint8Array(w*h),q=new Int32Array(w*h);let best=[];
for(let n=0;n<w*h;n++)if(!seen[n]&&data[n*4+3]>100){let head=0,tail=1;q[0]=n;seen[n]=1;while(head<tail){const k=q[head++];for(const a of [k%w?k-1:-1,k%w<w-1?k+1:-1,k-w,k+w])if(a>=0&&a<w*h&&!seen[a]&&data[a*4+3]>100){seen[a]=1;q[tail++]=a;}}if(tail>best.length)best=Array.from(q.subarray(0,tail));}
const keep=new Uint8Array(w*h);for(const n of best)keep[n]=1;
for(let n=0;n<w*h;n++)if(!keep[n])data[n*4+3]=0;
return sharp(data,{raw:{width:w,height:h,channels:4}}).png().toBuffer();}
for(const name of ['war','king','friends']){const dir=path.join(root,'..',name);const spec=JSON.parse(await readFile(path.join(dir,'layers.json'),'utf8'));
for(const l of spec.layers)if(/^(group|person|friend|boy|hand|fox|banner)/.test(l.id)){const f=path.join(dir,l.file);const b=await largest(f);await sharp(b).webp({quality:90,alphaQuality:100}).toFile(f);}
if(name==='war')for(const l of spec.layers.filter(l=>l.id.startsWith('banner-'))){const color=l.id.slice(7),src=path.join(dir,'src',`${l.id}-raw.png`),m=await sharp(src).metadata();l.frames=[];
for(let j=0;j<2;j++){const half=await sharp(src).extract({left:Math.floor(m.width/2)*j,top:0,width:Math.floor(m.width/2),height:m.height}).toBuffer();const trimmed=await sharp(half).trim({threshold:20}).toBuffer();const image=await sharp(trimmed).resize(l.w-4,l.h-4,{fit:'inside'}).toBuffer(),im=await sharp(image).metadata();const file=`${l.id}-${j+2}.webp`;await sharp({create:{width:l.w,height:l.h,channels:4,background:'#00000000'}}).composite([{input:image,left:j<3&&['green','red','blue'].includes(color)?l.w-im.width-2:2,top:Math.floor((l.h-im.height)/2)}]).webp({quality:90,alphaQuality:100}).toFile(path.join(dir,file));l.frames.push(file);}
l.note='Cloth only; pole stays with group. Alternate frames generated from approved war reference, raw sheet and exact prompt in src/.';}
if(name==='friends'){const l=spec.layers.find(l=>l.id==='fox');const base=await sharp(path.join(dir,l.file)).ensureAlpha().raw().toBuffer();const tail=await sharp(path.join(dir,'src/fox-tail-raw.png')).trim().resize(l.w,l.h,{fit:'fill'}).ensureAlpha().raw().toBuffer();
// Keep every original pixel above the tail. Only the lower-right tail region changes.
for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++){const n=(y*l.w+x)*4;if(y>l.h*.68&&x>l.w*.28){tail.copy(base,n,n,n+4);}}
await sharp(base,{raw:{width:l.w,height:l.h,channels:4}}).webp({quality:90,alphaQuality:100}).toFile(path.join(dir,'fox-2.webp'));l.frames=['fox-2.webp'];l.note='Original head and torso remain pixel-identical; only tail area uses regenerated paint. Raw drawing and prompt in src/.';}
await writeFile(path.join(dir,'layers.json'),JSON.stringify(spec,null,2)+'\n');}
