import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {firstnightIssues} from '../lib/firstnight-framing.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const must=(v,m)=>{if(!v)throw Error('Gallery preflight: '+m);};
export function measurementInputs(revision='HEAD') {
 const paths=execFileSync('git',['ls-files','tools/lib','tools/play-sight.mjs','tools/resource-status.mjs','vite.config.ts','package.json','bun.lock','index.html'],{encoding:'utf8'}).trim().split('\n');
 const inputs=Object.fromEntries(paths.map(p=>[p,hash(execFileSync('git',['show',revision+':'+p]))]));
 for(const p of paths)must(hash(readFileSync(p))===inputs[p],'dirty measurement input '+p);
 return {src:execFileSync('git',['rev-parse',revision+':src'],{encoding:'utf8'}).trim(),public:execFileSync('git',['rev-parse',revision+':public'],{encoding:'utf8'}).trim(),inputs};
}
export function validatePresentation(directory,expectedInputs) {
 const current=measurementInputs();
 must(JSON.stringify(current)===JSON.stringify(expectedInputs),'fixture, measurement or runtime inputs changed');
 const views=[],raw={},images={};let renderer=null;
 for(const device of ['desktop','phone'])for(const quality of ['high','low']) {
  const name=device+'-'+quality,dir=resolve(directory,name);views.push({dir,quality});
  const log=readFileSync(resolve(directory,name+'.log'),'utf8');
  const observed=log.match(/Chrome renderer: (.+)/)?.[1];
  must(observed && (!renderer || renderer===observed),'renderer mismatch');renderer=observed;
  const read=file=>{const path=resolve(dir,file),bytes=readFileSync(path);raw[path]=hash(bytes);return JSON.parse(bytes);};
  if(existsSync(resolve(dir,'browser-errors.json')))must(read('browser-errors.json').length===0,'browser errors');
  const result=read('sight.json');must(result.length===2 && result.every(r=>r.problems.length===0),'incomplete or failed scene matrix');
  for(const [scene,count] of [[25,6],[28,4]]) {
   for(let i=1;i<=count;i++) {
    const prefix='scene-'+scene;
    const seen=read(prefix+'-line-'+i+'.json');
    must(seen.line.scene===scene && seen.sight.length>0 && seen.sight.every(b=>b.inFrame&&!b.hiddenBy),'actor sight '+name+' '+scene+' '+i);
    if(seen.inWorld)must(seen.sight.some(b=>b.who===seen.inWorld),'speaker absent');
    must(firstnightIssues(read(prefix+'-line-'+i+'.frame.json')).length===0,'body framing');
    const hud=read(prefix+'-line-'+i+'.hud.json');
    must(hud.present && !hud.visible && !hud.hit && hud.pointerEvents==='none','dialogue HUD');
    const costs=read(prefix+'-line-'+i+'.costs.json');must(costs.length>0,'missing costs');
    const picture=resolve(dir,prefix+(i===1?'':'-'+String(i).padStart(2,'0'))+'.png');
    images[picture]=hash(readFileSync(picture));
   }
   const cleanup=read('scene-'+scene+'-cleanup.json');must(!cleanup.active&&!cleanup.busy&&!cleanup.stages.length,'scene cleanup');
   const hud=read('scene-'+scene+'-cleanup.hud.json');must(hud.present && (!hud.heartSeen || hud.visible),'HUD restoration');
   if(scene===25)must(hud.heartSeen && hud.visible,'restore fixture lacks earned Heartstone');
  }
 }
 return {views,raw,images,renderer,inputs:current};
}
