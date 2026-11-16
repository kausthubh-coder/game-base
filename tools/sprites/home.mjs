// Rebuild the home cast from generated pixels. Slice, clean, scale and palette-snap only.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {pixels,cell,clean,bounds,snap,fitted,readJSON,writeJSON} from './lib.mjs';
import {storySprites,homeCast as names,portraitRows} from './story-config.mjs';
const palette=(await readJSON('assets-src/palette.json')).colors;
const manifest=await readJSON('public/assets/manifest.json');
// Retain the approved portrait cells; rebuild from this stable source on subsequent runs.
const old=await sharp('assets-src/home/portraits-before.png').png().toBuffer();
const layers=[{input:old,left:0,top:0}];
// Some generated rows sit above the mathematical grid line. Find the seven separated
// alpha bands before slicing so a neighbouring head never enters a walking cell.
function bands(p){
 const runs=[];let start=-1;
 for(let y=0;y<=p.h;y++){
  let count=0;for(let x=0;x<p.w&&y<p.h;x++)count+=p.data[(y*p.w+x)*4+3]>=210;
  if(count>15&&start<0)start=y;
  if(count<=15&&start>=0){if(y-start>5)runs.push([start,y]);start=-1;}
 }
 if(runs.length!==7)throw Error('Expected seven separated source rows, found '+runs.length);
 return runs;
}
for(const [index,name] of names.entries()){
 if(process.argv[2]&&process.argv[2]!==name){
  layers.push({input:await fs.readFile(`assets-src/home/${name}-portraits.png`),left:0,top:(index+portraitRows.home)*128});
  continue;
 }
 const s=storySprites[name],p=await pixels(`assets-src/home/sources/${name}.png`),cells=[];
 const rows=bands(p);
 const sourceCell=async(col,row)=>{
  const [top,bottom]=rows[row];
  const data=await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).extract({left:0,top,width:p.w,height:bottom-top}).raw().toBuffer();
  return cell({data,w:p.w,h:bottom-top},col,0,4,1);
 };
 for(let row=0;row<6;row++)for(let col=0;col<(row<3?2:4);col++){
  const q=clean(await sourceCell(col,row));cells.push({q,b:bounds(q),row,col});
 }
 const heights=cells.filter(c=>c.row<3).map(c=>c.b.height).sort((a,b)=>a-b);
 const scale=Math.min(s.height/heights[3],112/Math.max(...cells.map(c=>c.b.width)),115/Math.max(...cells.map(c=>c.b.height)));
 const sprite=[];
 for(const c of cells){snap(c.q,palette);const q=await fitted(c.q,c.b,scale);sprite.push({input:q.input,left:c.col*128+64-Math.floor(q.w/2),top:c.row*128+121-q.h});}
 const sheet=`sprites/${name}.png`;
 await sharp({create:{width:512,height:768,channels:4,background:'#00000000'}}).composite(sprite).png().toFile('public/assets/'+sheet);
 manifest.sprites[name]={sheet,frame:[128,128],anchor:[64,120],worldHeight:s.worldHeight,animations:{idle:{frames:2,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:10,rows:{front:3,back:4,side:5}}}};
 const portrait=[];
 for(const [col,expression] of ['calm','glad','troubled'].entries()){
  const pcell=clean(await sourceCell(col,6)),b=bounds(pcell);snap(pcell,palette);
  const q=await fitted(pcell,b,Math.min(118/b.width,118/b.height));
  portrait.push({input:q.input,left:col*128+64-Math.floor(q.w/2),top:123-q.h});
  manifest.portraits.names[`${name}-${expression}`]=[col,index+portraitRows.home];
 }
 manifest.portraits.names[name]=[0,index+portraitRows.home];
 const row=await sharp({create:{width:384,height:128,channels:4,background:'#00000000'}}).composite(portrait).png().toBuffer();
 layers.push({input:row,left:0,top:(index+portraitRows.home)*128});
 await fs.writeFile(`assets-src/home/${name}-portraits.png`,row);
 console.log('Built '+name+' and calm/glad/troubled portraits');
}
// The world cast's rows below the home cast's are people-world.mjs's: keep them as they are.
const sheet=await sharp('public/assets/portraits/portraits.png').metadata(),homeEnd=portraitRows.world*128;
const retainedEnd=Math.min(sheet.height,portraitRows.hero*128);
if(retainedEnd>homeEnd)layers.push({input:await sharp('public/assets/portraits/portraits.png').extract({left:0,top:homeEnd,width:384,height:retainedEnd-homeEnd}).png().toBuffer(),left:0,top:homeEnd});
// The hero's generated expression row is independent of the cast's body sheets.
// Keep the old hero cell untouched; only its name now selects this appended calm face.
const heroSource=await pixels('assets-src/home/hero-portraits.png'),heroPortrait=[];
for(const [col,expression] of ['calm','glad','troubled'].entries()){
 const p=clean(await cell(heroSource,col,0,3,1)),b=bounds(p);snap(p,palette);
 const q=await fitted(p,b,Math.min(118/b.width,118/b.height));
 heroPortrait.push({input:q.input,left:col*128+64-Math.floor(q.w/2),top:123-q.h});
 manifest.portraits.names[`hero-${expression}`]=[col,portraitRows.hero];
}
manifest.portraits.names.hero=[0,portraitRows.hero];
layers.push({input:await sharp({create:{width:384,height:128,channels:4,background:'#00000000'}}).composite(heroPortrait).png().toBuffer(),left:0,top:portraitRows.hero*128});
console.log('Built hero calm/glad/troubled portraits');
await sharp({create:{width:384,height:Math.max((portraitRows.hero+1)*128,sheet.height),channels:4,background:'#00000000'}}).composite(layers).png().toFile('public/assets/portraits/portraits.png');
await writeJSON('public/assets/manifest.json',manifest);
