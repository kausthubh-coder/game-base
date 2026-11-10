import sharp from 'sharp';
import fs from 'node:fs/promises';
import {sprites,tiles,icons} from './config.mjs';
import {root,readJSON,pixels,cell,png} from './lib.mjs';
const m=await readJSON('public/assets/manifest.json'),out=root+'.artifacts/sprites/';await fs.mkdir(out,{recursive:true});
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const label=(s,w=900,h=24)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="6" y="17" fill="#f4e2ba" font-family="monospace" font-size="13">${escape(s)}</text></svg>`);
const canvas=(w,h,bg='#414751')=>sharp({create:{width:w,height:h,channels:4,background:bg}});
const outputs=[];
async function save(name,w,h,layers,bg){await canvas(w,h,bg).composite(layers).png().toFile(out+name);outputs.push(name);}
for(const [name,s]of Object.entries(m.sprites)){
 const c=sprites[name],p=await pixels('public/assets/'+s.sheet),fw=c.size,band=fw+28,layers=[];
 for(const [an,a]of Object.entries(s.animations))for(const [dir,row]of Object.entries(a.rows)){
 layers.push({input:label(`${name} ${an} ${an==='tool'?'right profile (front key)':dir}`,c.cols*fw),left:0,top:row*band});
 for(let col=0;col<a.frames;col++){const q=await cell(p,col,row,c.cols,c.rows);layers.push({input:await png(q.data,q.w,q.h),left:col*fw,top:row*band+24});layers.push({input:label(String(col),32,24),left:col*fw,top:row*band+24});}}
 await save(name+'.png',c.cols*fw,c.rows*band,layers);
}
const bp=await pixels('public/assets/'+m.blocks.atlas);const tileNames=[];for(const [name,cells]of Object.entries(m.blocks.tiles))cells.forEach((xy,v)=>tileNames.push({name:name+(cells.length>1?' '+(v+1):''),xy}));
for(let page=0;page<Math.ceil(tileNames.length/4);page++){
 const layers=[];for(let k=0;k<4;k++){const t=tileNames[page*4+k];if(!t)continue;const x=(k%2)*208,y=Math.floor(k/2)*224;layers.push({input:label(t.name,208),left:x,top:y});const q=await cell(bp,...t.xy,8,bp.h/32),buf=await png(q.data,32,32);for(let cy=0;cy<6;cy++)for(let cx=0;cx<6;cx++)layers.push({input:buf,left:x+cx*32,top:y+24+cy*32});}
 await save(`blocks-${page+1}.png`,416,448,layers);
}
const ip=await pixels('public/assets/'+m.icons.sheet),il=[];for(let i=0;i<icons.length;i++){const q=await cell(ip,...m.icons.names[icons[i]],4,4),x=(i%4)*144,y=Math.floor(i/4)*94;il.push({input:label(icons[i],144),left:x,top:y});il.push({input:await sharp(await png(q.data,32,32)).resize(64,64,{kernel:'nearest'}).png().toBuffer(),left:x+32,top:y+24});}await save('icons.png',576,376,il);
const all=[{input:label('All assets / locked palette / grass-green ground',1152),left:0,top:0}];let i=0;
for(const [name,s]of Object.entries(m.sprites)){const p=await pixels('public/assets/'+s.sheet),c=sprites[name];all.push({input:label(name,210),left:i*220,top:32});for(let d=0;d<3;d++){const q=await cell(p,0,d,c.cols,c.rows);all.push({input:await sharp(await png(q.data,q.w,q.h)).resize(Math.round(q.w/2),Math.round(q.h/2),{kernel:'nearest'}).png().toBuffer(),left:i*220+d*70,top:92});}i++;}
for(let j=0;j<tileNames.length;j++){const t=tileNames[j],x=(j%8)*142,y=212+Math.floor(j/8)*108,q=await cell(bp,...t.xy,8,bp.h/32);all.push({input:label(t.name,142),left:x,top:y});all.push({input:await sharp(await png(q.data,32,32)).resize(64,64,{kernel:'nearest'}).png().toBuffer(),left:x+10,top:y+26});}
for(let j=0;j<icons.length;j++){const x=(j%8)*142,y=224+Math.ceil(tileNames.length/8)*108+Math.floor(j/8)*80,q=await cell(ip,...m.icons.names[icons[j]],4,4);all.push({input:label(icons[j],142),left:x,top:y});all.push({input:await png(q.data,32,32),left:x+20,top:y+28});}await save('side-by-side.png',1152,224+Math.ceil(tileNames.length/8)*108+168,all,'#647e46');
await fs.writeFile(out+'preview-index.json',JSON.stringify(outputs,null,2)+'\n');console.log('Wrote '+outputs.length+' previews');
