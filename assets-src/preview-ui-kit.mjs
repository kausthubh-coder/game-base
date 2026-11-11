import sharp from 'sharp';
import fs from 'node:fs/promises';
const specs=JSON.parse(await fs.readFile('assets-src/ui-kit-slices.json'));
const dir='public/assets/ui/kit/';
async function nine(n,W,H){
 const {size:[w,h],slice:[t,r,b,l]}=specs[n];let parts=[];
 const xs=[0,l,w-r,w],ys=t?[0,t,h-b,h]:[0,h];
 const dx=[0,l,W-r,W],dy=t?[0,t,H-b,H]:[0,H];
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<3;i++){
  const sw=xs[i+1]-xs[i],sh=ys[j+1]-ys[j],dw=dx[i+1]-dx[i],dh=dy[j+1]-dy[j];
  parts.push({input:await sharp(dir+n+'.png').extract({left:xs[i],top:ys[j],width:sw,height:sh}).resize(dw,dh,{fit:'fill'}).toBuffer(),left:dx[i],top:dy[j]});
 }
 return sharp({create:{width:W,height:H,channels:4,background:'#0000'}}).composite(parts).png().toBuffer();
}
let rows=[], y=50;
for(const [n,s] of Object.entries(specs)){
 const images=[];
 if(s.slice){const [t,r,b,l]=s.slice;for(const [W,H] of [[Math.max(l+r+32,240),Math.max(t+b+24,112)],[720,Math.max(t+b+24,112)],[Math.max(l+r+32,240),420]])images.push(await nine(n,W,H));}
 else if(n==='stars'){
 let copies=[];for(let j=0;j<3;j++)for(let i=0;i<3;i++)copies.push({input:dir+n+'.png',left:i*512,top:j*512});
 images.push(await sharp({create:{width:1536,height:1536,channels:4,background:'#0000'}}).composite(copies).resize(600,600).png().toBuffer());
 }else images.push(await sharp(dir+n+'.png').resize({width:Math.min(s.size[0],600)}).toBuffer());
 let x=30,maxH=0,items=[];for(const im of images){const resized=await sharp(im).resize({width:Math.round((await sharp(im).metadata()).width*.65)}).toBuffer();const m=await sharp(resized).metadata();items.push({input:resized,left:x,top:y+32});x+=m.width+24;maxH=Math.max(maxH,m.height);}
 rows.push({n,y,items});y+=maxH+80;
}
const W=2400,H=y+30,comps=[];
for(let side=0;side<2;side++){
 comps.push({input:await sharp({create:{width:1200,height:H,channels:4,background:side?'#141824':'#7FB04A'}}).png().toBuffer(),left:side*1200,top:0});
 for(const row of rows){
  comps.push({input:Buffer.from(`<svg width="1100" height="30"><text x="0" y="22" fill="${side?'#ECE5D8':'#141824'}" font-size="22" font-family="sans-serif">${row.n}${row.n==='stars'?' · 3 × 3 repeat':''}</text></svg>`),left:side*1200+30,top:row.y});
  for(const item of row.items)comps.push({...item,left:item.left+side*1200});
 }
}
await sharp({create:{width:W,height:H,channels:4,background:'#141824'}}).composite(comps).png().toFile('.artifacts/ui-kit/preview.png');
await fs.writeFile('.artifacts/ui-kit/preview-rows.json',JSON.stringify(rows.map(({n,y})=>({n,y})),null,2));
console.log({W,H});
