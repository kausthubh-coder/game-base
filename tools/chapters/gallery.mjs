import { measurementInputs, validatePresentation } from './gallery-preflight.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { auditGalleryChain } from '../audit-gallery.mjs';
import { playGallery, pumpBuildHashes } from '../play-gallery.mjs';
import { sample, canStartHeavy } from '../resource-status.mjs';
import { QUALITY_BUDGETS } from '../../src/content/quality.ts';

export const id = 'gallery';
export const requirements = ['preflight', 'image-review', 'transactions', 'chain', 'runtime', 'presentation-raw'];
export const ROOT_SHA = '2e87196658d91e6cace033284b2b218414e242c4a4e1214d791ed999abdb771d';
export const START_SHA = 'beaf194efbd23023cd666578e5c2f8a56c3a824ad0e381a2e8cdcf0a9973ff0b';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function validateGalleryStart(raw) {
  if (![START_SHA,'03a5eaeed88ee56edf12cb1ea4793068d47df887ac314c56a18502fa61786707'].includes(hash(raw ?? ''))) throw Error('Gallery requires the preserved original-chain rootsnare Continue bytes');
  return true;
}
export function checkBudgets(directories) {
  if(!directories.length) throw Error('missing actual budget samples');
  for(const {dir,quality} of directories) {
    const budget=QUALITY_BUDGETS[quality];
    if(!budget) throw Error('invalid budget quality: '+quality);
    const files=readdirSync(dir).filter(f=>f.endsWith('.costs.json'));
    if(!files.length) throw Error('missing actual budget samples: '+dir);
    for(const file of files) {
      const frames=JSON.parse(readFileSync(resolve(dir,file),'utf8'));
      if(!Array.isArray(frames) || !frames.length) throw Error('empty or invalid budget sample: '+file);
      for(const frame of frames) {
        const costs=frame?.costs;
        const total=costs?.total;
        if(!total || ![total.drawCalls,total.triangles].every(value=>Number.isFinite(value) && value>=0)) throw Error('invalid budget measurement: '+file);
        if(costs.addsUp!==true || total.drawCalls>budget.drawCalls || total.triangles>budget.triangles) throw Error('quality table budget exceeded: '+file);
      }
    }
  }
  return true;
}
export function runtimeHashes(dir) {
  const files={};
  function visit(relative='') {
    for(const entry of readdirSync(resolve(dir,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const path=relative ? relative+'/'+entry.name : entry.name;
      if(entry.isDirectory())visit(path);
      else if(entry.isFile())files[path]=hash(readFileSync(resolve(dir,path)));
      else throw Error('runtime contains non-file entry: '+path);
    }
  }
  visit();return files;
}
export async function play(run) {
  validateGalleryStart(run.startingSave);
  const out=resolve(process.env.GALLERY_OUT ?? '.artifacts/gallery-chapter/attempt-'+Date.now());
  mkdirSync(out,{recursive:true});
  if(readdirSync(out).length) throw Error('Gallery needs a new empty output');
  const dist=process.env.GALLERY_DIST ?? 'dist-gallery-resume-chapter';
  if(!/^dist-gallery-resume-[a-z0-9]+$/.test(dist))throw Error('invalid Gallery runtime name');
  const port=process.env.PLAY_PORT ?? '5795';
  const resources=[];
  const admission=async()=>{const s=await sample();resources.push(s);writeFileSync(resolve(out,'resources.json'),JSON.stringify(resources,null,2));if(!canStartHeavy(s,0))throw Error('resource admission held: '+JSON.stringify(s));};
  const monitor=setInterval(()=>sample().then(s=>{resources.push(s);writeFileSync(resolve(out,'resources.json'),JSON.stringify(resources,null,2));}).catch(()=>{}),30000);
  async function command(args,name,heavy=false) {
    if(heavy)await admission();
    const log=[];
    const child=spawn('bun',args,{stdio:['ignore','pipe','pipe'],env:{...process.env,PLAY_PORT:port}});
    const take=b=>{log.push(String(b));process.stdout.write(b);writeFileSync(resolve(out,name+'.log'),log.join(''));};
    child.stdout.on('data',take);child.stderr.on('data',take);
    const code=await new Promise((done,fail)=>{child.on('error',fail);child.on('exit',done);});
    if(code!==0)throw Error(name+' failed with '+code);
    return true;
  }
  const views=[];
  try {
    await run.preflight([
      {name:'rules',run:async()=>{
        await command(['test','tools/workflow','tools/audit-gallery.test.mjs','tools/gallery-combat.test.mjs','src/game/ruins','src/game/fights','src/game/views/story-stage.view.test.ts'],'rules');
        await command(['tools/sim.ts','scenarios','ruins-gallery-and-seeds'],'scenarios');
        return true;
      }},
      {name:'presentation',run:async()=>{
        const prior=process.env.GALLERY_REUSE_PREFLIGHT;
        if(prior) {
          const inputs=JSON.parse(readFileSync(resolve(prior,'measurement-inputs.json'),'utf8'));
          const validated=validatePresentation(prior,inputs);views.push(...validated.views);
          const manifest=JSON.parse(readFileSync(resolve(prior,'runtime-manifest.json'),'utf8'));
          if(manifest.src!==inputs.src || manifest.public!==inputs.public || JSON.stringify(runtimeHashes(dist))!==JSON.stringify(manifest.files))throw Error('emitted runtime changed');
          writeFileSync(resolve(out,'runtime-manifest.json'),JSON.stringify(manifest,null,2));
          writeFileSync(resolve(out,'validated-presentation.json'),JSON.stringify(validated,null,2));
        } else {
        const reuse=process.env.GALLERY_REUSE_BUILD_MANIFEST;
        if(reuse) {
          const manifest=JSON.parse(readFileSync(reuse,'utf8'));
          const tree=path=>execFileSync('git',['rev-parse','HEAD:'+path],{encoding:'utf8'}).trim();
          if(manifest.src!==tree('src') || manifest.public!==tree('public') || JSON.stringify(runtimeHashes(dist))!==JSON.stringify(manifest.files))throw Error('reused runtime full provenance mismatch');
          writeFileSync(resolve(out,'runtime-manifest.json'),JSON.stringify(manifest,null,2));
        } else {
          // COW clone the verified immutable runtime; public assets are never copied by the build.
          const original=process.env.GALLERY_RUNTIME_SOURCE ?? '/Users/dabot/.t3/worktrees/game-base/t3-88bc25c2-3820bcdd572e4ec5/dist-gallery-resume-body';
          const expected=JSON.parse(readFileSync('.artifacts/gallery-input/attempt-33/build-hashes.json','utf8'));
          if(JSON.stringify(pumpBuildHashes(original))!==JSON.stringify(expected))throw Error('immutable runtime provenance changed');
          if(existsSync(dist))throw Error('chapter runtime output already exists; preserve it and select a new attempt explicitly');
          execFileSync('cp',['-cR',original,dist]);
          await command(['-e',`import {build} from 'vite'; await build({publicDir:false,build:{outDir:'${dist}',emptyOutDir:false},logLevel:'warn'});`],'build',true);
          const tree=path=>execFileSync('git',['rev-parse','HEAD:'+path],{encoding:'utf8'}).trim();
          writeFileSync(resolve(out,'runtime-manifest.json'),JSON.stringify({src:tree('src'),public:tree('public'),files:runtimeHashes(dist)},null,2));
        }
        writeFileSync(resolve(out,'measurement-inputs.json'),JSON.stringify(measurementInputs(),null,2));
        for(const [device,width,height] of [['desktop',1366,768],['phone',390,844]])for(const quality of ['high','low']) {
          const dir=resolve(out,device+'-'+quality);views.push({dir,quality});
          await command(['tools/play-sight.mjs','scenes','--only','25,28','--shots','--bodies','--costs','--dialogue-hud','--width',String(width),'--height',String(height),'--quality',quality,'--no-build','--dist',dist,'--port',port,'--out',dir],device+'-'+quality,true);
        }
        }
        const validated=validatePresentation(prior ?? out,JSON.parse(readFileSync(resolve(prior ?? out,'measurement-inputs.json'),'utf8')));
        writeFileSync(resolve(out,'validated-presentation.json'),JSON.stringify(validated,null,2));
        // Review is tied to newly produced images, not an earlier screenshot set.
        const images=views.flatMap(({dir})=>readdirSync(dir).filter(f=>f.endsWith('.png')).map(f=>resolve(dir,f)));
        const manifest=Object.fromEntries(images.map(p=>[p,hash(readFileSync(p))]));
        writeFileSync(resolve(out,'images.json'),JSON.stringify(manifest,null,2));
        console.log('Inspect new preflight pictures and write image-review.json with {images: <exact images.json map>, pass:true}. Waiting.');
        const until=Date.now()+15*60*1000;
        while(!existsSync(resolve(out,'image-review.json'))) {if(Date.now()>until)throw Error('image review missing');await new Promise(r=>setTimeout(r,1000));}
        const review=JSON.parse(readFileSync(resolve(out,'image-review.json'),'utf8'));
        if(review.pass!==true || JSON.stringify(review.images)!==JSON.stringify(manifest))throw Error('new image review failed or mismatched');
        return true;
      }},
      {name:'budgets',run:async()=>checkBudgets(views)},
    ]);
    writeFileSync(resolve(out,'preflight.json'),JSON.stringify({views,budgets:QUALITY_BUDGETS,pass:true},null,2));
    const root='.artifacts/uphill-input/attempt-14/earned-uphill.save.json';
    if(hash(readFileSync(root))!==ROOT_SHA)throw Error('original earned root changed');
    const startAudit=resolve(out,'starting-chain');mkdirSync(startAudit);
    writeFileSync(resolve(startAudit,'boundary.save.json'),readFileSync(root));
    writeFileSync(resolve(startAudit,'resume-boundary.save.json'),run.startingSave);
    auditGalleryChain(startAudit);
    const checkpoint=JSON.parse(readFileSync(run.path,'utf8')).input.path;
    const replay=resolve(out,'earned');
    await playGallery({run,startingSave:run.startingSave,args:['bun','tools/play-gallery.mjs','--save',root,'--resume',checkpoint,'--out',replay,'--dist',dist,'--no-build','--active-heavy-jobs','0']});
    await command(['tools/audit-gallery.mjs',replay],'audit');
    for(const [name,file] of Object.entries({'earned-save':'earned/earned-gallery.save.json',state:'earned/05-home.json',continue:'earned/final-home-continued.save.json',inventory:'earned/independent-audit.json',preflight:'preflight.json','image-review':'image-review.json',transactions:'earned/transactions.json',chain:'earned/chain.json',runtime:'runtime-manifest.json','presentation-raw':'validated-presentation.json'}))run.evidence(name,resolve(out,file));
    for(const [name,index] of [['desktop-high',0],['desktop-low',1],['phone-high',2],['phone-low',3]])run.evidence(name,resolve(views[index].dir,'scene-28.png'));
    run.accept();
  } finally {clearInterval(monitor);}
}
