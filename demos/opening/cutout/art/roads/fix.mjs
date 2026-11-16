import sharp from 'sharp';
import path from 'node:path';
import {dirFor,specFor,saveSpec,pixels,writePixels,captureMask} from '../shared/repair.mjs';
const name='roads',dir=dirFor(name),spec=await specFor(name),W=1920,H=1080;
const {data:plate}=await pixels(path.resolve(dir,spec.approved));
const union=new Uint8Array(W*H);
function grow(mask,w,h,r){const out=new Uint8Array(mask.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){const sx=x+i,sy=y+j;if(sx>=0&&sy>=0&&sx<w&&sy<h)v=Math.max(v,mask[sy*w+sx]);}out[y*w+x]=v;}return out;}
function flood(mask,data,w,h,bg){const gone=new Uint8Array(mask.length),q=new Int32Array(mask.length);let head=0,tail=0;for(let n=0;n<mask.length;n++)if(!mask[n]){gone[n]=1;q[tail++]=n;}while(head<tail){const n=q[head++];for(const a of [n%w?n-1:-1,n%w<w-1?n+1:-1,n-w,n+w])if(a>=0&&a<mask.length&&!gone[a]&&bg(data[a*4],data[a*4+1],data[a*4+2])){gone[a]=1;q[tail++]=a;}}for(let n=0;n<mask.length;n++)if(gone[n])mask[n]=0;return mask;}
function largest(mask,w,h){const seen=new Uint8Array(mask.length),q=new Int32Array(mask.length);let best=[];for(let n=0;n<mask.length;n++)if(mask[n]&&!seen[n]){let head=0,tail=1;q[0]=n;seen[n]=1;while(head<tail){const k=q[head++];for(const a of [k%w?k-1:-1,k%w<w-1?k+1:-1,k-w,k+w])if(a>=0&&a<mask.length&&!seen[a]&&mask[a]){seen[a]=1;q[tail++]=a;}}if(tail>best.length)best=Array.from(q.subarray(0,tail));}const keep=new Uint8Array(mask.length);for(const n of best)keep[n]=mask[n];return keep;}
for(const l of spec.layers.filter(l=>/^(city-|ship-)/.test(l.id))){const srcMask=await captureMask(name,l),a=await sharp(srcMask).greyscale().raw().toBuffer();const raw=await sharp(path.resolve(dir,spec.approved)).extract({left:l.x,top:l.y,width:l.w,height:l.h}).ensureAlpha().raw().toBuffer();let mask=grow(a,l.w,l.h,2);const ship=l.id.startsWith('ship');
 mask=flood(mask,raw,l.w,l.h,ship?(r,g,b)=>b>r*1.12&&b>g*.96:(r,g,b)=>(g>r*.95&&g>b*1.12)||(b>r*1.18&&b>g*.98));mask=largest(mask,l.w,l.h);
 if(ship)for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++){const n=y*l.w+x,r=raw[n*4],g=raw[n*4+1],b=raw[n*4+2];if((b>r*1.12&&b>g*.96)||(y>l.h*.75&&b>140&&Math.abs(r-b)<65&&Math.abs(g-b)<65))mask[n]=0;}
 if(l.id==='city-northwest')for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++)if(x+l.x<718&&y+l.y<126)mask[y*l.w+x]=0;
 // Alpha comes from the semantic matte; no color threshold can perforate an interior.
 for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++){const n=y*l.w+x;raw[n*4+3]=mask[n];if(mask[n])union[(y+l.y)*W+x+l.x]=255;}
 await writePixels(path.join(dir,l.file),raw,l.w,l.h);l.note=ship?'Original ship paint; outside sea removed by a boundary-connected matte.':'Original city paint; outside green removed by a boundary-connected matte. Enclosed green clothes remain intact.';
}
// Sample the complete gold/ivory road surface, including its white leaf pattern.
const roads=spec.layers.find(l=>l.id==='roads');const paths=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(dir,'road-paths.json'),'utf8'));
const corridor=await sharp(Buffer.from(`<svg width="1920" height="1080"><g fill="none" stroke="white" stroke-width="34">${['M750 250 L877 435','M1164 250 L1040 435','M628 520 L790 520','M1110 522 L1263 522','M878 612 L784 750','M1042 612 L1119 752','M831 194 Q959 159 1087 194','M691 268 C638 319 604 376 584 441','M559 565 C576 656 611 738 678 794','M843 846 Q948 875 1061 847','M1243 794 C1300 731 1329 653 1341 565','M1330 443 C1302 364 1270 309 1225 267'].map(d=>`<path d="${d}"/>`).join('')}</g></svg>`)).ensureAlpha().raw().toBuffer();
let roadMask=new Uint8Array(W*H);for(let n=0;n<W*H;n++){const r=plate[n*4],g=plate[n*4+1],b=plate[n*4+2];if(corridor[n*4+3]&&r>175&&g>130&&r>=g*.98&&g>b*1.04&&!union[n]&&Math.hypot(n%W-960,Math.floor(n/W)-520)>140)roadMask[n]=255;}
// Close isolated leaf-pattern pinholes, then constrain the result to the visible road.
const grown=grow(roadMask,W,H,1);for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){let a=255;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)a=Math.min(a,grown[(y+j)*W+x+i]);if(a&&!union[y*W+x])roadMask[y*W+x]=255;}
// Keep complete road branches; discard detached flecks from nearby lamps and plants.
{const seen=new Uint8Array(W*H),q=new Int32Array(W*H);for(let n=0;n<W*H;n++)if(roadMask[n]&&!seen[n]){let head=0,tail=1;q[0]=n;seen[n]=1;while(head<tail){const k=q[head++];for(const a of [k%W?k-1:-1,k%W<W-1?k+1:-1,k-W,k+W])if(a>=0&&a<W*H&&!seen[a]&&roadMask[a]){seen[a]=1;q[tail++]=a;}}if(tail<250)for(let i=0;i<tail;i++)roadMask[q[i]]=0;}}
const roadData=Buffer.alloc(roads.w*roads.h*4);for(let y=0;y<roads.h;y++)for(let x=0;x<roads.w;x++){const n=(y+roads.y)*W+x+roads.x,k=y*roads.w+x;plate.copy(roadData,k*4,n*4,n*4+4);roadData[k*4+3]=roadMask[n];if(roadMask[n])union[n]=255;}
await sharp(roadData,{raw:{width:roads.w,height:roads.h,channels:4}}).webp({quality:92,alphaQuality:100}).toFile(path.join(dir,roads.file));roads.note='Complete gold and ivory road paint. Reveal along road-paths.json, clipped by this alpha. No keyed holes in the white leaf pattern.';
const island=spec.layers.find(l=>l.id==='island'),islandMask=await sharp(await captureMask(name,island)).greyscale().raw().toBuffer();const {data:clean}=await pixels(await sharp(path.join(dir,'src/clean-map-raw.png')).resize(W,H).png().toBuffer());const out=Buffer.alloc(island.w*island.h*4);const remove=grow(union,W,H,4);
for(let y=0;y<island.h;y++)for(let x=0;x<island.w;x++){const k=y*island.w+x,n=(y+island.y)*W+x+island.x;const source=remove[n]?clean:plate;source.copy(out,k*4,n*4,n*4+4);out[k*4+3]=islandMask[k];}
// Original coast and vegetation are untouched outside removed paint footprints.
await sharp(out,{raw:{width:island.w,height:island.h,channels:4}}).webp({quality:91,alphaQuality:100}).toFile(path.join(dir,island.file));island.note='Original coastline and original visible vegetation. Clean underpaint fills ONLY newly exposed city/road footprints; no replacement of visible orchards, flowers, lamps or bread.';
await saveSpec(name,spec);
