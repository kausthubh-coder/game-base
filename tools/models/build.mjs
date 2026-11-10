import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { inspectGlb } from './inspect.mjs';
const root=resolve(import.meta.dirname,'../..');
for (const model of ['tree','rock','bush']) {
  const code=await new Promise((done,reject)=>{ const p=spawn('/Applications/Blender.app/Contents/MacOS/Blender',['--background','--factory-startup','--python-exit-code','1','--python',`tools/models/${model}.py`,'--',...process.argv.slice(2)],{cwd:root,stdio:'inherit'}); p.on('error',reject);p.on('exit',done); });
  if(code!==0) process.exit(code??1);
}
const manifest=JSON.parse(fs.readFileSync(`${root}/public/assets/manifest.json`));
manifest.models={};
for(const name of ['tree-17','tree-41','tree-83','rock-11','rock-37','bush-29']) {
 const file=`models/${name}.glb`, buffer=fs.readFileSync(`${root}/public/assets/${file}`);
 manifest.models[name]={file,seed:Number(name.split('-')[1]),triangles:inspectGlb(buffer).triangles,budget:name.startsWith('tree')?1500:300,bytes:buffer.length};
 console.log(name,manifest.models[name]);
}
fs.writeFileSync(`${root}/public/assets/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
