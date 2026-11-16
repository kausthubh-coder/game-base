// Rebuild the explicitly commissioned look-A replacements. Never edits manifest or baselines.
// Generated source pixels only: alpha cleanup, palette snap, whole-figure nearest scaling and alignment.
import sharp from 'sharp';
import {pixels,clean,bounds,snap,fitted,readJSON} from './lib.mjs';
const names=process.argv.slice(2);
const manifest=await readJSON('public/assets/manifest.json');
const palette=(await readJSON('assets-src/palette.json')).colors;
// Uneven generated spacing can leave disconnected scraps from the next row. Keep the figure
// and nearby tool particles, discard only disconnected marks beyond its bounding rectangle.
function isolated(p){
  const seen=new Uint8Array(p.w*p.h),parts=[];
  for(let i=0;i<seen.length;i++)if(!seen[i]&&p.data[i*4+3]){
    const part=[i];seen[i]=1;
    for(let j=0;j<part.length;j++){const k=part[j],x=k%p.w,y=Math.floor(k/p.w);for(const n of [x?k-1:-1,x<p.w-1?k+1:-1,y?k-p.w:-1,y<p.h-1?k+p.w:-1])if(n>=0&&!seen[n]&&p.data[n*4+3]){seen[n]=1;part.push(n);}}
    parts.push(part);
  }
  parts.sort((a,b)=>b.length-a.length);
  const main=parts[0],xs=main.map(k=>k%p.w),ys=main.map(k=>Math.floor(k/p.w));
  const l=Math.min(...xs)-4,r=Math.max(...xs)+4,t=Math.min(...ys)-4,b=Math.max(...ys)+4;
  for(const part of parts.slice(1))if(!part.some(k=>k%p.w>=l&&k%p.w<=r&&Math.floor(k/p.w)>=t&&Math.floor(k/p.w)<=b))for(const k of part)p.data[k*4+3]=0;
  return p;
}
for(const name of names.length?names:['hero','hero-moves','hero-swing','hero-cut','hero-cut-back','hero-bow','hero-staff','hero-call']){
  if(!/^hero(?:-(moves|swing|cut|cut-back|bow|staff|call))?$/.test(name))throw Error('Unknown hero sheet '+name);
  const config=manifest.sprites[name], source=await pixels(`assets-src/act1-hero/sources/${name}.png`);
  let colours=palette;
  if(name!=='hero'){
    const hero=await pixels('public/assets/sprites/hero.png'),own=new Set();
    for(let i=0;i<hero.data.length;i+=4)if(hero.data[i+3])own.add('#'+hero.data.subarray(i,i+3).toString('hex'));
    // The kid's shades plus neutral metal and reserved teal for held gear/magic.
    colours=[...own,...palette.filter(h=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));return Math.max(r,g,b)-Math.min(r,g,b)<30||(g>r*1.15&&b>r*1.15);})];
  }
  const old=await sharp('public/assets/'+config.sheet).metadata(),cols=old.width/128,rows=old.height/128;
  const cells=[];
  for(const anim of Object.values(config.animations))for(const row of Object.values(anim.rows))for(let col=0;col<anim.frames;col++){
    const left=Math.max(0,Math.round(col*source.w/cols)-12),top=Math.max(0,Math.round(row*source.h/rows)-20);
    const right=Math.min(source.w,Math.round((col+1)*source.w/cols)+12),bottom=Math.min(source.h,Math.round((row+1)*source.h/rows)+20);
    const p={w:right-left,h:bottom-top,data:await sharp(source.data,{raw:{width:source.w,height:source.h,channels:4}}).extract({left,top,width:right-left,height:bottom-top}).raw().toBuffer()};
    isolated(clean(p));
    snap(p,colours);cells.push({p,b:bounds(p),col,row});
  }
  const heights=cells.filter(c=>name!=='hero'||c.row<3).map(c=>c.b.height).sort((a,b)=>a-b);
  const scale=Math.min(108/heights[Math.floor(heights.length/2)],116/Math.max(...cells.map(c=>c.b.width)),116/Math.max(...cells.map(c=>c.b.height)));
  const layers=[];
  for(const {p,b,col,row}of cells){const q=await fitted(p,b,scale);layers.push({input:q.input,left:col*128+64-Math.floor(q.w/2),top:row*128+121-q.h});}
  await sharp({create:{width:old.width,height:old.height,channels:4,background:'#00000000'}}).composite(layers).png().toFile('public/assets/'+config.sheet);
  console.log(`Built ${name}: ${cols}x${rows}, ${cells.length} frames; manifest and baselines untouched`);
}
