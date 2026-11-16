// Run focused sight scenes on an existing immutable runtime. Never builds or serves.
import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {sample,canStartHeavy} from './resource-status.mjs';
const [url,folder]=process.argv.slice(2);if(!url||!folder||existsSync(folder))throw Error('Supply runtime URL and new output directory');
mkdirSync(folder,{recursive:true});const save=(name,data)=>writeFileSync(resolve(folder,name),JSON.stringify(data,null,2));
const status=await sample();save('admission.json',status);if(!canStartHeavy(status,1))throw Error('Additional heavy job denied');
const monitor=setInterval(async()=>save('resource-'+Date.now()+'.json',await sample()),30000);
try{const p=spawn('bun',['tools/play-sight.mjs','scenes','--only','12,14,17,24','--url',url,'--out',resolve(folder,'sight'),'--shots'],{stdio:'inherit'});process.exitCode=await new Promise(r=>p.on('exit',r));}finally{clearInterval(monitor);}
