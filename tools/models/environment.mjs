import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {inspectGlb} from './inspect.mjs';
const p=spawn('/Applications/Blender.app/Contents/MacOS/Blender',['--background','--factory-startup','--python-exit-code','1','--python','tools/models/environment.py'],{stdio:'inherit'});
if(await new Promise(r=>p.on('exit',r)))process.exit(1);
const path='public/assets/manifest.json',manifest=JSON.parse(fs.readFileSync(path));
for(const key of Object.keys(manifest.models))if(key.startsWith('env-')&&key!==key.toLowerCase()){fs.rmSync('public/assets/'+manifest.models[key].file,{force:true});delete manifest.models[key];}
for(const name of fs.readdirSync('public/assets/models').filter(n=>n.startsWith('env-')&&n.endsWith('.glb'))){const data=fs.readFileSync('public/assets/models/'+name);const triangles=inspectGlb(data).triangles;if(triangles>300)throw Error(name+' '+triangles);manifest.models[name.slice(0,-4)]={file:'models/'+name,seed:300+Number(name.split('-').at(-1).slice(0,-4)),triangles,budget:300,bytes:data.length};}
fs.writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
