import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
const root='demos/opening/cutout/art';let failures=0;
for(const [shot,id,x,y,opaque] of [
 ['sickness','grave-1',1289,729,false],
 ['sickness','grave-1',1307,738,true],
 ['sickness','grave-1',1333,766,true],
 ['gods','lion',1374,419,false],
 ['gods','elephant',1245,830,true],
 ['mark','elephant',1080,933,true],
 ['mark','hand',950,520,true],
 ['mark','hand',800,640,false],
 ['mark','hand',681,353,false],
 ['night','king',1015,403,false],
]){
 const m=JSON.parse(await readFile(`${root}/${shot}/layers.json`));const l=m.layers.find(l=>l.id===id);const {data,info}=await sharp(`${root}/${shot}/${l.file}`).ensureAlpha().raw().toBuffer({resolveWithObject:true});const alpha=data[((y-l.y)*info.width+x-l.x)*4+3];const pass=opaque?alpha>240:alpha<10;
 console.log(`${pass?'PASS':'FAIL'} ${shot}/${id} at ${x},${y}: alpha ${alpha}, expected ${opaque?'opaque':'clear'}`);if(!pass)failures++;
}process.exitCode=failures?1:0;
