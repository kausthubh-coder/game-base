// Rebuild the Act 1 cast from retained generated art. Never draws replacement pixels.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {pixels,cell,clean,bounds,snap,fitted,readJSON,writeJSON} from './lib.mjs';
import {storySprites,homeCast,portraitRows} from './story-config.mjs';
import {animations} from './config.mjs';
const palette=(await readJSON('assets-src/palette.json')).colors;
const records=await readJSON('assets-src/people-world/outputs.json');
const m=await readJSON('public/assets/manifest.json');
const only=process.argv.slice(2);
// These generated crowd sources put directions in columns. Their measured row gaps
// are retained here so no neighbouring boot or head is cut into another frame.
const sourceBands={
 'town-roan':[0,293,571,848,1088,1320,1536],
 'town-hesper':[0,266,522,777,1034,1290,1536],
 'town-corin':[0,261,518,774,1030,1286,1536],
 'town-pell':[0,288,558,829,1070,1306,1536],
 'town-acolyte-b':[0,277,533,789,1044,1299,1536],
 'town-isolde':[0,256,512,768,1024,1280,1536],
 'town-nessa':[0,241,483,724,965,1207,1448],
 custodian:[0,247,479,692,915,1140,1365,1659],
};
for(const r of records.filter(r=>r.kind==='world'&&(!only.length||only.includes(r.name)))){
 const s=storySprites[r.name],p=await pixels(r.source),cells=[];
 const motion=s.animations??animations(s);
 for(const a of Object.values(motion))for(const row of Object.values(a.rows))for(let col=0;col<a.frames;col++){
  const sourceName=r.source.split('/').at(-1).replace('-world.webp','');
  let sc=col,sr=row,source=p;
  if(sourceBands[sourceName]){
   if(sourceName!=='custodian'&&!(sourceName==='town-isolde'&&row>=3)){sc=[0,1,2][row%3];sr=row<3?col:[3,4,5,4][col];}
   const edges=sourceBands[sourceName],top=edges[sr],height=edges[sr+1]-top;
   source={data:await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).extract({left:0,top,width:p.w,height}).raw().toBuffer(),w:p.w,h:height};
   sr=0;
  }
  const q=clean(await cell(source,sc,sr,s.cols,source===p?s.rows:1),r.name==='stag-free'?0.02:0.005);cells.push({q,b:bounds(q),row,col});
 }
 const heights=cells.slice(0,Math.min(8,cells.length)).map(c=>c.b.height).sort((a,b)=>a-b);
 const scale=Math.min(s.height/heights[Math.floor(heights.length/2)],(s.size-10)/Math.max(...cells.map(c=>c.b.width)),(s.anchor[1]-6)/Math.max(...cells.map(c=>c.b.height)));
 const layers=[];
 for(const c of cells){snap(c.q,palette);const q=await fitted(c.q,c.b,scale*(sourceBands[r.source.split('/').at(-1).replace('-world.webp','')]&&r.name!=='custodian'?heights[Math.floor(heights.length/2)]/c.b.height:1));layers.push({input:q.input,left:c.col*s.size+s.anchor[0]-Math.floor((q.w-1)/2),top:c.row*s.size+s.anchor[1]+1-q.h});}
 const sheet=`sprites/${r.name}.png`;
 await sharp({create:{width:s.cols*s.size,height:s.rows*s.size,channels:4,background:'#00000000'}}).composite(layers).png().toFile('public/assets/'+sheet);
 const entry={sheet,frame:[s.size,s.size],anchor:s.anchor,worldHeight:s.worldHeight,animations:motion};
 if(m.sprites[r.name]&&JSON.stringify(m.sprites[r.name])!==JSON.stringify(entry))throw Error('Existing frame contract changed: '+r.name);
 m.sprites[r.name]=entry;
 console.log('Built '+r.name);
}
if(!only.length||only.includes('--portraits')){
// Keep the original nine portrait cells registered, and the home cast's rows that home.mjs built below them.
// Append one expression row per new person after those.
const portraits=records.filter(r=>r.kind==='portrait'),layers=[{input:'assets-src/people-world/portraits-original.png',left:0,top:0}];
const names={...(await readJSON('assets-src/people-world/portrait-names-original.json'))};
for(const [i,name]of homeCast.entries()){
 layers.push({input:`assets-src/home/${name}-portraits.png`,left:0,top:(i+portraitRows.home)*128});
 for(const [col,expression]of ['calm','glad','troubled'].entries())names[name+'-'+expression]=[col,i+portraitRows.home];
 names[name]=names[name+'-calm'];
}
for(const [i,r]of portraits.entries()){
 const p=await pixels(r.source);
 for(let col=0;col<3;col++){
  const q=clean(await cell(p,col,0,3,1),0.3),b=bounds(q);snap(q,palette);
  const tile=await fitted(q,b,Math.min(116/b.width,116/b.height));
  layers.push({input:tile.input,left:col*128+64-Math.floor(tile.w/2),top:(i+portraitRows.world)*128+122-tile.h});
  names[r.name+'-'+['calm','glad','troubled'][col]]=[col,i+portraitRows.world];
 }
 names[r.name]=names[r.name+'-calm'];
}
await sharp({create:{width:384,height:(portraits.length+portraitRows.world)*128,channels:4,background:'#00000000'}}).composite(layers).png().toFile('public/assets/portraits/portraits.png');
m.portraits={tile:128,sheet:'portraits/portraits.png',names};
}
await writeJSON('public/assets/manifest.json',m);
