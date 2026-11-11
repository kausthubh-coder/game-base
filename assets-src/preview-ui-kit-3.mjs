import sharp from 'sharp';
import fs from 'node:fs/promises';
const specs=JSON.parse(await fs.readFile('assets-src/ui-kit-round-three.json'));
const path=n=>`public/assets/ui/kit/${n}.png`;
async function nine(n,W,H){
 const {size:[w,h],slice:[t,r,b,l]}=specs[n],parts=[];
 const xs=[0,l,w-r,w],ys=[0,t,h-b,h],dx=[0,l/2,W-r/2,W],dy=[0,t/2,H-b/2,H];
 for(let y=0;y<3;y++)for(let x=0;x<3;x++){
  if(!xs[x+1]||xs[x+1]===xs[x]||ys[y+1]===ys[y])continue;
  parts.push({input:await sharp(path(n)).extract({left:xs[x],top:ys[y],width:xs[x+1]-xs[x],height:ys[y+1]-ys[y]}).resize(dx[x+1]-dx[x],dy[y+1]-dy[y],{fit:'fill'}).png().toBuffer(),left:dx[x],top:dy[y]});
 }
 return sharp({create:{width:W,height:H,channels:4,background:'#0000'}}).composite(parts).png().toBuffer();
}
const rows=[];let y=30;
for(const [n,s]of Object.entries(specs)){
 let images=[];
 if(s.slice){
  const sizes=['rail','roller'].includes(n)?[[280,64],[780,64],[280,140]]:n==='keycap'?[[80,64],[240,64],[80,150]]:[[160,160],[360,160],[160,280]];
  for(const [w,h]of sizes)images.push(await nine(n,w,h));
 }else if(s.repeat){
  const [w,h]=s.size,parts=[];
  for(let j=0;j<3;j++)for(let i=0;i<3;i++)parts.push({input:path(n),left:i*w,top:j*h});
  const tiled=await sharp({create:{width:w*3,height:h*3,channels:4,background:'#0000'}}).composite(parts).png().toBuffer();
  images.push(await sharp(tiled).resize({height:380}).png().toBuffer());
 }else if(n==='icons2'){
  images.push(await sharp(path(n)).resize(192,192).png().toBuffer());images.push(await sharp(path(n)).resize(96,96).png().toBuffer());
 }else images.push(await sharp(path(n)).resize({height:Math.min(s.size[1]/2,360)}).png().toBuffer());
 let x=20,max=0,items=[];
 for(const im of images){const m=await sharp(im).metadata();items.push({input:im,left:x,top:y+30});x+=m.width+20;max=Math.max(max,m.height);}
 rows.push({n:n+(s.repeat?' / 3x3 repeat':n==='icons2'?' / 48px and 24px glyphs':''),y,items});y+=max+75;
}
const pocket=await nine('pocket',92,92),bag=[];
for(let j=0;j<3;j++)for(let i=0;i<4;i++)bag.push({input:pocket,left:35+i*106,top:40+j*106});
const satchel=await sharp(await nine('leather-panel',500,400)).composite(bag).png().toBuffer();
rows.push({n:'Satchel / 4x3 pockets and item tag',y,items:[{input:satchel,left:20,top:y+30},{input:await sharp(path('tag')).resize(240,360).toBuffer(),left:560,top:y+50}]});y+=480;
const scroll=await sharp({create:{width:800,height:520,channels:4,background:'#0000'}}).composite([
 {input:await sharp(path('map-paper')).resize(680,440).toBuffer(),left:60,top:40},
 {input:await nine('roller',800,64),left:0,top:12},
 {input:await nine('roller',800,64),left:0,top:448},
 {input:await sharp(path('compass')).resize(100,100).toBuffer(),left:600,top:340}
]).png().toBuffer();
rows.push({n:'Unrolled map scroll',y,items:[{input:scroll,left:20,top:y+30}]});y+=600;
const col=1500,parts=[];
for(let side=0;side<2;side++){
 parts.push({input:await sharp({create:{width:col,height:y,channels:4,background:side?'#1f2433':'#ece5d8'}}).png().toBuffer(),left:side*col,top:0});
 for(const row of rows){parts.push({input:Buffer.from(`<svg width="1400" height="28"><text x="0" y="20" fill="${side?'#ece5d8':'#1f2433'}" font-size="18" font-family="sans-serif">${row.n}</text></svg>`),left:side*col+20,top:row.y});for(const p of row.items)parts.push({...p,left:p.left+side*col});}
}
await fs.mkdir('.artifacts/ui-kit',{recursive:true});
await sharp({create:{width:col*2,height:y,channels:4,background:'#1f2433'}}).composite(parts).png().toFile('.artifacts/ui-kit/preview-3.png');
await fs.writeFile('.artifacts/ui-kit/preview-3-rows.json',JSON.stringify(rows.map(({n,y})=>({n,y})),null,2));
console.log({width:col*2,height:y});
