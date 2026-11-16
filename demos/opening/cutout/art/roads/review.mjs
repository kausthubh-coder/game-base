import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {dirFor,specFor,pixels} from '../shared/repair.mjs';
const dir=dirFor('roads'),spec=await specFor('roads'),out=path.resolve(process.argv[2]??'.artifacts/opening/art-a-fix');await mkdir(out,{recursive:true});
const road=spec.layers.find(l=>l.id==='roads'),source=await pixels(path.join(dir,road.file)),whole=[],masks=[],record=[];
for(let i=0;i<6;i++){const progress=i/5,data=Buffer.from(source.data),radius=progress*650;for(let y=0;y<road.h;y++)for(let x=0;x<road.w;x++){const r=Math.hypot(x+road.x-960,y+road.y-520),k=(y*road.w+x)*4;data[k+3]=Math.round(data[k+3]*Math.max(0,Math.min(1,(radius-r)/4)));}
 const roadFrame=await sharp(data,{raw:{width:road.w,height:road.h,channels:4}}).png().toBuffer();const stack=[];for(const l of [...spec.layers].sort((a,b)=>a.z-b.z))stack.push({input:l.id==='roads'?roadFrame:path.resolve(dir,l.file),left:l.x,top:l.y});
 const left=Math.round(96+(progress-.5)*100),top=Math.round(54+(progress-.5)*40),width=1728,height=972;const frame=await sharp({create:{width:1920,height:1080,channels:4,background:'#00000000'}}).composite(stack).png().toBuffer();const camera=await sharp(frame).extract({left,top,width,height}).resize(960,540).png().toBuffer();await sharp(camera).png({palette:true}).toFile(`${out}/roads-move-${i}.png`);whole.push({input:camera,left:(i%3)*960,top:Math.floor(i/3)*540});
 const mask=await sharp({create:{width:1920,height:1080,channels:4,background:i%2?'#ff0000':'#303030'}}).composite([{input:roadFrame,left:road.x,top:road.y}]).png().toBuffer();const masked=await sharp(mask).extract({left,top,width,height}).resize(960,540).png().toBuffer();masks.push({input:masked,left:(i%3)*960,top:Math.floor(i/3)*540});record.push({frame:i,progress,camera:{left,top,width,height},reveal:{center:[960,520],radius,softEdge:4}});
}
for(const [name,composite] of [['roads-move-strip',whole],['roads-mask-move',masks]])await sharp({create:{width:2880,height:1080,channels:3,background:'#303030'}}).composite(composite).png({palette:true}).toFile(`${out}/${name}.png`);
await writeFile(`${out}/roads-move.json`,JSON.stringify(record,null,2)+'\n');console.log('PASS roads: 6 camera/reveal frames; roads-move-strip.png and roads-mask-move.png');
