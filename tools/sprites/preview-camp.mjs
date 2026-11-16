import sharp from 'sharp';
import fs from 'node:fs/promises';
import {pixels,cell,readJSON,png} from './lib.mjs';
await fs.mkdir('.artifacts/camp-sprites',{recursive:true});
const m=await readJSON('public/assets/manifest.json');
for(const [name,baseName,actions]of [['hero-camp','hero',['sit','look','rise']],['fox-blighted','fox-blighted',['stalk','shake']]]){
 const s=m.sprites[name],p=await pixels('public/assets/'+s.sheet),base=await pixels('public/assets/'+m.sprites[baseName].sheet),size=s.frame[0],cols=p.w/size,rows=p.h/size;
 const pairs=[],strips=[];let line=0;
 for(const action of actions)for(const [direction,row]of Object.entries(s.animations[action].rows)){
  const idleRow=m.sprites[baseName].animations.idle.rows[direction];const ref=await png((await cell(base,0,idleRow,base.w/size,base.h/size)).data,size,size);
  for(let col=0;col<s.animations[action].frames;col++){
   const input=await png((await cell(p,col,row,cols,rows)).data,size,size);
   pairs.push({input:ref,left:col*size*2,top:line*size},{input,left:col*size*2+size,top:line*size});
   strips.push({input,left:col*size,top:line*size});
  }line++;
 }
 for(const [bg,color]of [['light','#ddd4b9'],['dusk','#202b46']])await sharp({create:{width:size*8,height:line*size,channels:4,background:color}}).composite(pairs).png().toFile(`.artifacts/camp-sprites/${name}-${bg}.png`);
 await sharp({create:{width:size*4,height:line*size,channels:4,background:'#202b46'}}).composite(strips).png().toFile(`.artifacts/camp-sprites/${name}-strips.png`);
 await sharp({create:{width:p.w,height:p.h,channels:4,background:'#42783b'}}).composite([{input:await fs.readFile('public/assets/'+s.sheet)}]).png().toFile(`.artifacts/camp-sprites/${name}-green.png`);
}
console.log('PASS eight contact sheets: light/dusk idle pairs, ordered strips, full sheets on green');
