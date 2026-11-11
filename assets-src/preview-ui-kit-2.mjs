import sharp from 'sharp';
import fs from 'node:fs/promises';
const specs=JSON.parse(await fs.readFile('assets-src/ui-kit-round-two.json'));
const path=n=>`public/assets/ui/kit/${n}.png`;
async function nine(n,W,H){
 const {size:[w,h],slice:[t,r,b,l]}=specs[n],parts=[];
 const xs=[0,l,w-r,w],ys=[0,t,h-b,h],dx=[0,l/2,W-r/2,W],dy=[0,t/2,H-b/2,H];
 for(let y=0;y<3;y++)for(let x=0;x<3;x++)parts.push({input:await sharp(path(n)).extract({left:xs[x],top:ys[y],width:xs[x+1]-xs[x],height:ys[y+1]-ys[y]}).resize(dx[x+1]-dx[x],dy[y+1]-dy[y],{fit:'fill'}).png().toBuffer(),left:dx[x],top:dy[y]});
 return sharp({create:{width:W,height:H,channels:4,background:'#0000'}}).composite(parts).png().toBuffer();
}
const rows=[];let y=40;
for(const [n,s] of Object.entries(specs)){
 let images=[];
 if(s.slice)for(const [w,h] of [[180,180],[400,180],[180,300]])images.push(await nine(n,w,h));
 else if(s.repeat){
  const [w,h]=s.size,parts=[];for(let j=0;j<3;j++)for(let i=0;i<3;i++)parts.push({input:path(n),left:i*w,top:j*h});
  const repeated=await sharp({create:{width:w*3,height:h*3,channels:4,background:'#0000'}}).composite(parts).png().toBuffer(); images.push(await sharp(repeated).resize({width:n==='gutter'?150:450}).png().toBuffer());
 }else images.push(await sharp(path(n)).resize({width:Math.min(s.size[0]/2,320)}).png().toBuffer());
 let x=30,max=0,items=[];for(const im of images){const m=await sharp(im).metadata();items.push({input:im,left:x,top:y+35});x+=m.width+20;max=Math.max(max,m.height);}
 rows.push({n:n+(s.repeat?' / 3x3 repeat':''),y,items});y+=max+80;
}
const spread=await sharp(await nine('book-cover',860,520)).composite([
 {input:await sharp(path('page')).resize(396,480).png().toBuffer(),left:30,top:20},
 {input:await sharp(path('page')).resize(396,480).png().toBuffer(),left:434,top:20},
 {input:await sharp(path('gutter')).resize(64,480).png().toBuffer(),left:398,top:20},
 {input:await sharp(path('ribbon')).resize(27,120).png().toBuffer(),left:780,top:20}
]).png().toBuffer();
rows.push({n:'Open two-page spread',y,items:[{input:spread,left:30,top:y+35}]});y+=600;
// A real 6x6 grid checks that empty wells remain quiet at intended CSS size.
const grid=[];for(let j=0;j<6;j++)for(let i=0;i<6;i++)grid.push({input:await sharp(path('slot-empty')).resize(80,80).toBuffer(),left:30+i*86,top:y+35+j*86});
rows.push({n:'Empty bag / 36 slots',y,items:grid});y+=600;
const parts=[];for(let side=0;side<2;side++){
 parts.push({input:await sharp({create:{width:950,height:y,channels:4,background:side?'#141824':'#ece5d8'}}).png().toBuffer(),left:side*950,top:0});
 for(const row of rows){parts.push({input:Buffer.from(`<svg width="900" height="30"><text x="0" y="22" fill="${side?'#ece5d8':'#141824'}" font-size="20" font-family="sans-serif">${row.n}</text></svg>`),left:side*950+30,top:row.y});for(const item of row.items)parts.push({...item,left:item.left+side*950});}
}
await sharp({create:{width:1900,height:y,channels:4,background:'#141824'}}).composite(parts).png().toFile('.artifacts/ui-kit/preview-2.png');
await fs.writeFile('.artifacts/ui-kit/preview-2-rows.json',JSON.stringify(rows.map(({n,y})=>({n,y})),null,2));
console.log({width:1900,height:y});
