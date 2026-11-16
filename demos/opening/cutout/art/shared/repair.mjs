import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
export const ROOT=path.dirname(new URL(import.meta.url).pathname);
export const dirFor=name=>path.join(ROOT,'..',name);
export const specFor=async name=>JSON.parse(await readFile(path.join(dirFor(name),'layers.json'),'utf8'));
export const saveSpec=async(name,s)=>writeFile(path.join(dirFor(name),'layers.json'),JSON.stringify(s,null,2)+'\n');
export async function pixels(file){return sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
export async function writePixels(file,data,w,h){await sharp(data,{raw:{width:w,height:h,channels:4}}).webp({lossless:true,effort:5}).toFile(file);}
export async function svgMask(w,h,d,offsetX=0,offsetY=0){return sharp(Buffer.from(`<svg width="${w}" height="${h}"><path transform="translate(${-offsetX},${-offsetY})" d="${d}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();}
export async function fromPlate(name,id,d){const spec=await specFor(name),l=spec.layers.find(l=>l.id===id);const x=l.x-(name==='friends'?960:0),y=l.y;const file=path.join(dirFor(name),l.file);const plate=path.resolve(dirFor(name),spec.approved);const {data}=await pixels(await sharp(plate).extract({left:x,top:y,width:l.w,height:l.h}).png().toBuffer());const mask=await svgMask(l.w,l.h,d,x,y);for(let n=0;n<l.w*l.h;n++)data[n*4+3]=mask[n*4+3];await writePixels(file,data,l.w,l.h);return l;}
export function sample(data,w,h,x,y){let out=[0,0,0,0];const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;for(let j=0;j<2;j++)for(let i=0;i<2;i++){const sx=ix+i,sy=iy+j;if(sx<0||sy<0||sx>=w||sy>=h)continue;const k=(sy*w+sx)*4,weight=(i?fx:1-fx)*(j?fy:1-fy),a=data[k+3]/255;out[3]+=255*a*weight;for(let c=0;c<3;c++)out[c]+=data[k+c]*a*weight;}if(out[3]>0)for(let c=0;c<3;c++)out[c]=out[c]*255/out[3];return out;}
export async function warp(file,outFile,fn){const {data,info:{width:w,height:h}}=await pixels(file),out=Buffer.alloc(data.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const [sx,sy]=fn(x,y,w,h),v=sample(data,w,h,sx,sy),k=(y*w+x)*4;for(let c=0;c<4;c++)out[k+c]=Math.max(0,Math.min(255,Math.round(v[c])));}await writePixels(outFile,out,w,h);}
// Trim one source pixel from keyed silhouettes. Discard low-alpha JPEG fringes,
// preserving internal line-work and existing intentional negative spaces.
export async function inset(file,radius=1){const {data,info:{width:w,height:h}}=await pixels(file),out=Buffer.from(data);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let a=255;for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++){const sx=x+i,sy=y+j;a=Math.min(a,sx<0||sy<0||sx>=w||sy>=h?0:data[(sy*w+sx)*4+3]);}out[(y*w+x)*4+3]=a<160?0:Math.round((a-160)*255/95);}await writePixels(file,out,w,h);}
export async function captureMask(name,l){const dir=dirFor(name),file=path.join(dir,'src',`${l.id}-mask.png`);try{await readFile(file);}catch{await sharp(path.join(dir,l.file)).extractChannel(3).png().toFile(file);}return file;}
export async function restoreMask(name,l){const mask=await captureMask(name,l),x=l.x-(name==='friends'?960:0),y=l.y,s=await specFor(name);const {data}=await pixels(await sharp(path.resolve(dirFor(name),s.approved)).extract({left:x,top:y,width:l.w,height:l.h}).png().toBuffer());const a=await sharp(mask).greyscale().raw().toBuffer();if(a.length!==l.w*l.h)throw new Error(`${mask}: expected a single-channel alpha mask`);for(let n=0;n<l.w*l.h;n++)data[n*4+3]=a[n];await writePixels(path.join(dirFor(name),l.file),data,l.w,l.h);}
