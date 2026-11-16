import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,appendFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {launchChrome} from './lib/chrome.mjs';
import {createChapterRun} from './workflow/chapter.mjs';
import {sample,canStartHeavy} from './resource-status.mjs';
import {settleDialogue,firstnightFrame,firstnightIssues} from './lib/firstnight-framing.mjs';
import {storyCosts} from './lib/story-cost-probe.mjs';
import {createSeedInput,readSeedFight,fightSeedVault} from './play-seed-vault.mjs';
import {play,id,requirements} from './chapters/seed-vault.mjs';
import {validateSeedPresentation} from './chapters/seed-vault-preflight.mjs';
import {validateSeedHandoff,sha256,must,same,assertSeedContinue,flagsOf} from './chapters/seed-vault-contract.mjs';
import {runtimeHashes} from './chapters/gallery.mjs';
import {CONVERSATIONS} from '../src/game/content/dialogue.ts';
import {QUALITY_BUDGETS} from '../src/content/quality.ts';

export function validateSeedConfig(c) {
  // This gate runs before directories, chapter reports, child processes or game input.
  must(c?.handoff,'coordinator accepted Light handoff required');
  const raw=readFileSync(c.handoff.savePath,'utf8');
  validateSeedHandoff({...c.handoff,startingSave:raw});
  must(['preflight','earned'].includes(c.mode),'explicit preflight or earned mode required');
  must(Number.isInteger(c.port)&&c.port>=5400&&c.port<=5999&&![5795,5796].includes(c.port),'exclusive coordinator-assigned port required');
  must(c.dist && resolve(c.dist)!==resolve('dist-gallery-resume-hud'),'separate Seed runtime required');
  must(c.buildRevision,'built runtime provenance required');
  execFileSync('git',['merge-base','--is-ancestor','4fc25cf4',c.buildRevision]);
  must(c.selection && ['sword','staff','bow'].includes(c.selection.weapon)&&['spring_hilt','glow_cap'].includes(c.selection.fitting),'explicit fitting selection required');
  for(const leg of ['bench','stair','door','roots','home']) {
    const route=c.routes?.[leg];must(route?.length,'explicit authored route required: '+leg);
    for(const p of route)must([p.x,p.y,p.z].every(Number.isFinite),'route requires full x/y/z: '+leg);
  }
  const runtime=runtimeHashes(c.dist);
  const boundary=JSON.parse(raw).game.player,last=c.routes.home.at(-1);
  must(Math.hypot(last.x-boundary.x,last.y-boundary.y,last.z-boundary.z)<=2,'home route must end at accepted Light home boundary');
  const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  return {raw,provenance:{source,buildRevision:c.buildRevision,runtime}};
}

export async function runSeedCommand(args,{validate=validateSeedConfig,sessionFactory=createSeedSession,chapterFactory=createChapterRun}={}) {
  must(args.length===1,'usage: bun tools/play-seed-vault.mjs <coordinator-config.json>');
  const c=JSON.parse(readFileSync(args[0],'utf8'));
  const {raw,provenance}=validate(c);
  const session=await sessionFactory(c,raw,provenance);
  let run;
  try {
    if(c.mode==='preflight')return await session.collectPreflight();
    run=chapterFactory({id,requirements,revision:provenance.source,out:resolve(c.out,'reports'),checkpoint:c.handoff.savePath});
    const checks={
      rules:async()=>{
        execFileSync('bun',['test','tools/chapters/seed-vault.test.mjs','tools/chapters/seed-vault-lifecycle.test.mjs','src/game/bench/bench.test.ts','src/game/ruins/ruins.test.ts','src/game/ruins/vault-detail.test.ts','src/game/fight/keepers.test.ts'],{stdio:'pipe',timeout:60000});
        session.write('rules.json',{pass:true,source:provenance.source});return true;
      },
      presentation:async()=>session.checkPreflight(),
      budgets:async()=>session.checkPreflight(),
    };
    return await play(run,{handoff:c.handoff,checks,session});
  } catch(e) {await session.failure?.(e).catch(()=>{});if(run)try{run.abort(e);}catch{} throw e;}
  finally {await session.release();}
}

export async function createSeedSession(c,raw,provenance) {
  const out=resolve(c.out);must(!existsSync(out)||readdirSync(out).length===0,'preserve old output; choose empty out');mkdirSync(out,{recursive:true});
  const write=(name,data)=>{const path=resolve(out,name);writeFileSync(path,typeof data==='string'?data:JSON.stringify(data,null,2));return path;};
  const record=data=>appendFileSync(resolve(out,'inputs.ndjson'),JSON.stringify({at:Date.now(),...data})+'\n');
  let browser,server,page,input,closed=false,cleanupObserved=false,current,finalRaw;
  const scopes=[],errors=[],captures=[],repeats=[],continues=[];
  const wait=async(fn,label,timeout=20000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await page.waitForTimeout(80);}throw Error('Timed out: '+label);};
  const state=()=>page.evaluate(()=>window.__game.state());
  const flag=k=>page.evaluate(k=>window.__game.state().flags[k]===true,k);
  const room=()=>page.evaluate(()=>window.__game.view.game.systems.ruins.view().room);
  const click=async selector=>{record({type:'click',selector});await page.locator(selector).click();};
  async function boot(){
    if(browser)return;
    const resources=await sample();write('resources.json',resources);must(canStartHeavy(resources,0),'resource admission held');
    server=spawn('bun',['tools/serve.mjs',c.dist,String(c.port)],{stdio:['ignore','pipe','pipe']});
    write('owned-pids.json',{server:server.pid});
    server.stderr.on('data',d=>appendFileSync(resolve(out,'server.log'),d));
    await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('owned server readiness timeout')),15000);server.stdout.once('data',()=>{clearTimeout(timer);ok();});server.once('error',fail);server.once('exit',n=>fail(Error('owned server exited '+n)));});
    browser=await launchChrome();write('runtime.json',{...provenance,renderer:browser.gameRenderer});
    page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>{errors.push(String(e));write('runtime-errors.json',errors);});
    await page.goto(`http://127.0.0.1:${c.port}/?quality=high`);await page.waitForFunction(()=>!!window.__game);
  }
  async function rows(){return page.evaluate(()=>window.__seedVaultObservation.rows);}
  async function flush(bytes){
    must(current,'missing transaction scope');current.rows=await rows();current.final=bytes;current.finalSHA=sha256(bytes);write('transactions.json',scopes);
  }
  async function saveBytes(name){
    must(current,'no earned scope');record({type:'public-save',name});must(await page.evaluate(()=>window.__game.save()),'public save failed');
    const bytes=await page.evaluate(()=>localStorage.getItem('greenhollow.save'));must(bytes,'missing public save bytes');write(name+'.save.json',bytes);await flush(bytes);finalRaw=bytes;return bytes;
  }
  async function installScope(bytes,label){
    current={label,input:bytes,inputSHA:sha256(bytes),rows:[]};scopes.push(current);
    if(input)await input.install();else input=await createSeedInput(page,record);
  }
  async function load(bytes){
    record({type:'raw-local-import',sha256:sha256(bytes)});await page.evaluate(bytes=>localStorage.setItem('greenhollow.save',bytes),bytes);await page.reload();await page.waitForFunction(()=>!!window.__game);
    await installScope(bytes,'accepted-Light');await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(async()=>{const s=await state();return s.started&&!s.player.busy;},'Continue accepted Light');
  }
  async function continueAt(name){
    await input.press('Escape');await wait(async()=>(await state()).paused,'pause');
    const before=await saveBytes(name+'-paused');await input.release();await page.reload();await page.waitForFunction(()=>!!window.__game);
    await installScope(before,name+'-Continue');
    // Capture public save in the menu click microtask, before elapsed production starts again.
    await page.evaluate(()=>document.addEventListener('click',()=>queueMicrotask(async()=>{await window.__game.save();window.__seedContinued=localStorage.getItem('greenhollow.save');window.__seedContinuedRows=window.__seedVaultObservation.rows.slice();}),{once:true}));
    await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>!!window.__seedContinued);
    const after=await page.evaluate(()=>window.__seedContinued);write(name+'-continued.save.json',after);assertSeedContinue(JSON.parse(before),JSON.parse(after));
    continues.push({name,beforeSHA:sha256(before),afterSHA:sha256(after)});write('continue.json',continues);
    // installScope reinstalled realtime driver and observer before the menu click.
    api.continueBefore=JSON.parse(before);
    current.rows=await page.evaluate(()=>window.__seedContinuedRows);current.final=after;current.finalSHA=sha256(after);write('transactions.json',scopes);finalRaw=after;
    return JSON.parse(after);
  }
  const route=async name=>{for(const point of c.routes[name])await input.walk(point,{authored:true,within:.3,seconds:90});};
  const walk=async(x,z)=>input.walk({x,y:26,z},{authored:true,within:.25,seconds:30});
  const interact=async(id,prompt,reach,done)=>input.interact(id,prompt,reach,async()=>{await wait(done,id);return true;});
  async function cleanup(yaw){
    await wait(async()=>{const s=await state();return !s.talk&&!s.player.busy;},'scene controls released');
    const observed=await page.evaluate(yaw=>{const v=window.__game.view,g=v.game;return {playerVisible:g.actors.get('player')?.visible===true,hud:document.querySelector('.ui-heart')?.checkVisibility()===true,busy:g.player.busy,talk:g.systems.talk.active,stageActors:[...g.actors.keys()].filter(k=>k.startsWith('stage:')).length,cameraReleased:Math.abs(v.camera.yaw-yaw)<.001};},yaw);
    must(observed.playerVisible&&observed.hud&&!observed.busy&&!observed.talk&&!observed.stageActors&&observed.cameraReleased,'scene cleanup failed: '+JSON.stringify(observed));return observed;
  }
  async function capture(device,quality,moment,extra={}){
    const name=`${device}-${quality}-${moment}-${captures.length}`,image=resolve(out,name+'.png');
    const frames=await storyCosts(page),costFile=write(name+'.costs.json',frames),costSHA=sha256(readFileSync(costFile));
    const budget=QUALITY_BUDGETS[quality];for(const f of frames)must(f.costs.addsUp&&f.costs.total.drawCalls<=budget.drawCalls&&f.costs.total.triangles<=budget.triangles,'scene budget failed');
    const costs=frames.reduce((a,f)=>f.costs.total.drawCalls>a.total.drawCalls?f.costs:a,frames[0].costs);
    const frame=await firstnightFrame(page),issues=firstnightIssues(frame);write(name+'.frame.json',frame);
    const staging=await page.evaluate(()=>{const g=window.__game,v=g.view,el=document.querySelector('.gb-dialogue-typed'),r=el?.getBoundingClientRect();return {room:v.game.systems.ruins.view().room,playerVisible:v.game.actors.get('player')?.visible,actors:[...v.game.actors.keys()].filter(k=>k.startsWith('stage:')),sight:g.sight(),textVisible:!!el?.checkVisibility()&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};});
    must(staging.room==='seedvault','capture left actual vault interior');
    if(moment.startsWith('line-')||moment==='repeat'){must(staging.playerVisible===false&&staging.textVisible,'memory player hiding or dialogue visibility failed');for(const b of staging.sight)if(!b.inFrame||b.hiddenBy)issues.push('staged body hidden: '+b.who);}
    await page.screenshot({path:image});const size=page.viewportSize();
    const sample={device,quality,moment,width:size.width,height:size.height,image,sha256:sha256(readFileSync(image)),costs,costFile,costSHA,staging,issues,...extra};captures.push(sample);write('presentation-raw.json',captures);must(!issues.length,'scene framing: '+issues.join('; '));return sample;
  }
  async function dialogue({repeat=false,device='desktop',quality='high'}={}){
    const yaw=await page.evaluate(()=>window.__game.view.camera.yaw),lines=[];
    for(let i=0;i<(repeat?1:4);i++){
      await wait(async()=>!!(await state()).talk,'memory line');await settleDialogue(page);
      await page.waitForFunction(()=>!document.querySelector('.gb-dialogue-untyped')?.textContent,{}, {timeout:30000});
      const line=await page.evaluate(()=>{const t=window.__game.view.game.systems.talk;return {text:t.current()?.text,scene:t.current()?.scene};});
      must(repeat||line.scene===29,'wrong memory scene');const expected=CONVERSATIONS.find(c=>c.id===(repeat?'memory.seedvault.again':'scene.29')).lines[i];must(line.text===(typeof expected==='string'?expected:expected.text),'wrong or repeated memory line');lines.push(line);
      await capture(device,quality,repeat?'repeat':'line-'+(i+1));await input.press('KeyE');
      await wait(async()=>{const s=await state();return !s.talk||s.talk.text!==line.text;},'next memory line');
    }
    const observed=await cleanup(yaw);await capture(device,quality,repeat?'repeat-cleanup':'cleanup',{cleanup:observed});write('dialogue-'+captures.length+'.json',lines);cleanupObserved=true;return lines;
  }
  async function release(){
    if(closed)return;closed=true;
    try{await input?.release();}finally{try{await browser?.close();}finally{if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>{server.once('exit',r);setTimeout(()=>{if(server.exitCode===null)server.kill('SIGKILL');r();},5000);});}}}
  }
  const api={selection:c.selection,write,release,rows,
    failure:async error=>{write('failure.json',{error:String(error.stack??error)});if(page){write('failed-state.json',await state());await page.screenshot({path:resolve(out,'failed.png')});if(current)await saveBytes('failed-checkpoint');}},
    get cleanupObserved(){return cleanupObserved;},
    startEarned:async()=>{await boot();await load(raw);},
    save:async name=>JSON.parse(await saveBytes(name)),continue:continueAt,
    scopes:async()=>scopes,
    fitWeapon:async()=>{await route('bench');const t=await page.evaluate(()=>{const t=window.__game.view.game.systems.interact.nearest();return t?{id:t.id,prompt:t.prompt(),radius:t.radius}:null;});must(t?.id.startsWith('placeable:workbench:')&&t.prompt==='Craft','authored bench route must reach actual workbench');await interact(t.id,t.prompt,t.radius,()=>page.locator('[data-key="open-bench"]').isVisible());await click('[data-key="open-bench"]');await page.getByRole('dialog',{name:'Workbench',exact:true}).waitFor();for(const key of ['step-3',c.selection.weapon,c.selection.fitting,'make'])await click(`[data-key="${key}"]`);await input.press('Escape');await wait(()=>flag('step.seeds.brass'),'tier 3 weapon');},
    stair:async()=>{await route('stair');await interact('ruin-stair','Go down the forest stair with Wren',3,()=>flag('step.seeds.stair'));},
    enterRoots:async()=>{await route('door');await interact('ruins:seedvault',"Calla's seal is on the door",4.5,async()=>!(await state()).player.busy);await route('roots');await interact('ruins:roots','Go in through the roots',3,async()=>await room()==='seedvault');const s=await state();must(Math.abs(s.player.y-26)<.1,'root entry floor');must(!(await readSeedFight(page)),'keeper triggered before middle Continue');},
    fight:async()=>{await walk(-367.5,2412.5);await wait(async()=>!!(await readSeedFight(page)),'keeper trigger');await input.press('KeyE');await fightSeedVault(input,{read:()=>readSeedFight(page),observe:data=>appendFileSync(resolve(out,'combat.ndjson'),JSON.stringify(data)+'\n'),approach:async(target,move,s)=>{
      const center={x:-359.5,z:2412.5},h=s.hero,r=4;
      let a=Math.atan2(h.z-center.z,h.x-center.x),b=Math.atan2(target.z-center.z,target.x-center.x),delta=Math.atan2(Math.sin(b-a),Math.cos(b-a));
      if(Math.hypot(target.x-h.x,target.z-h.z)<(move.range||move.reach)*.8)return;
      // Follow the safe side of the base in short ordinary-input legs.
      const d=Math.hypot(target.x-h.x,target.z-h.z),step=Math.min(.8,Math.max(0,d-(move.range||move.reach)*.75));
      const next={x:h.x+(target.x-h.x)/d*step,z:h.z+(target.z-h.z)/d*step};
      const dx=next.x-h.x,dz=next.z-h.z,t=Math.max(0,Math.min(1,((center.x-h.x)*dx+(center.z-h.z)*dz)/(dx*dx+dz*dz||1)));
      if(Math.hypot(h.x+dx*t-center.x,h.z+dz*t-center.z)>=3.2)await walk(next.x,next.z);
      else {const angle=a+Math.sign(delta)*Math.min(Math.abs(delta),.2);await walk(center.x+Math.cos(angle)*r,center.z+Math.sin(angle)*r);}
    }});await wait(async()=>!(await readSeedFight(page))&&!(await state()).player.busy,'keeper drawing released');},
    takeKey:async()=>{await walk(-363,2403.8);await walk(-360.5,2403.8);await interact('ruins:seedvault:keystone','Take the keystone',1.8,()=>flag('keystone.3'));},
    memory:async()=>{await walk(-358.5,2403.8);await interact('ruins:seedvault:memory','Touch the stone',1.8,async()=>!!(await state()).talk);await dialogue();},
    repeats:async()=>{
      const before=await saveBytes('repeat-before');await walk(-367.5,2412.5);must(!(await readSeedFight(page)),'keeper respawned');await walk(-363,2403.8);await walk(-360.5,2403.8);
      must(await page.evaluate(()=>window.__game.view.game.systems.interact.nearest()?.prompt()!=='Take the keystone'),'repeat key prompt');await walk(-358.5,2403.8);await interact('ruins:seedvault:memory','Touch the stone again',1.8,async()=>!!(await state()).talk);const lines=await dialogue({repeat:true});
      const after=await saveBytes('repeat-after');for(const k of ['keystone.3','scene.29','memory.seedvault','fight.10.won'])same(flagsOf(JSON.parse(before))[k],flagsOf(JSON.parse(after))[k],'repeat '+k);must(lines.length===1,'repeat line count');repeats.push({beforeSHA:sha256(before),afterSHA:sha256(after),lines});write('repeat-checks.json',repeats);return true;
    },
    returnHome:async()=>{await walk(-355,2408);await walk(-355,2420);await walk(-359.5,2422.1);await interact('ruins:seedvault:door','Push the doors open',2,async()=>await room()===null);await route('home');must(await room()===null,'home outside');},
    collectPreflight:async()=>{
      await boot();
      for(const device of ['desktop','phone'])for(const quality of ['high','low']){
        await page.setViewportSize(device==='desktop'?{width:1366,height:768}:{width:390,height:844});
        await page.goto(`http://127.0.0.1:${c.port}/?quality=${quality}`);await page.waitForFunction(()=>!!window.__game);
        record({type:'diagnostic-interior-fixture',device,quality});
        await page.evaluate(()=>{const g=window.__game;g.newGame();g.skipTo('seeds');const f=g.view.game.flags;f.set('story.seen.scene.27.dark',true);if(g.view.game.systems.talk.active)g.view.game.systems.talk.skip();f.set('fight.10.won',true);f.set('keystone.3',true);f.set('scene.29',false);f.set('memory.seedvault',false);g.view.game.systems.ruins.enter('seedvault');g.teleport(-358.5,26,2403.8);});
        if(input)await input.install();else input=await createSeedInput(page,record);
        must(await room()==='seedvault','diagnostic interior staging');
        await interact('ruins:seedvault:memory','Touch the stone',1.8,async()=>!!(await state()).talk);await dialogue({device,quality});
        await interact('ruins:seedvault:memory','Touch the stone again',1.8,async()=>!!(await state()).talk);await dialogue({repeat:true,device,quality});
      }
      must(!errors.length,'runtime errors');return write('preflight.json',{scene:29,location:'seedvault-interior',source:provenance.source,runtime:provenance,samples:captures});
    },
    checkPreflight:async()=>{
      must(c.preflight && c.review,'reviewed interior preflight paths required');
      const manifest=JSON.parse(readFileSync(c.preflight,'utf8')),review=JSON.parse(readFileSync(c.review,'utf8'));
      same(manifest.runtime,provenance,'preflight runtime and source provenance');
      validateSeedPresentation(manifest,review,readFileSync);write('preflight.json',manifest);write('image-review.json',review);return true;
    },
    evidence:async()=>{
      must(!errors.length,'runtime errors');const save=JSON.parse(finalRaw);
      must(c.earnedReview,'human review of actual earned captures required before acceptance');
      const earnedReview=JSON.parse(readFileSync(c.earnedReview,'utf8'));
      must(earnedReview.pass===true,'earned image review required');
      same(Object.fromEntries(captures.map(s=>[s.image,s.sha256])),earnedReview.images,'reviewed earned captures');
      for(const s of captures)must(sha256(readFileSync(s.image))===s.sha256,'changed earned capture');
      const files={
        'earned-save':write('earned-seed-vault.save.json',finalRaw),
        state:write('state.json',await state()),
        continue:resolve(out,'continue.json'),inventory:write('inventory.json',{stock:save.game.systems.inventory,scopes}),
        'light-handoff':write('light-handoff.json',c.handoff),preflight:resolve(out,'preflight.json'),
        'image-review':write('complete-image-review.json',{preflight:JSON.parse(readFileSync(c.review,'utf8')),earned:earnedReview}),transactions:resolve(out,'transactions.json'),
        'key-before-memory':resolve(out,'key-before-memory29.save.json'),
        'middle-continue':resolve(out,'root-entry-before-fight-continued.save.json'),
        'repeat-checks':resolve(out,'repeat-checks.json'),runtime:resolve(out,'runtime.json'),
        'presentation-raw':resolve(out,'presentation-raw.json'),
      };
      const manifest=JSON.parse(readFileSync(c.preflight,'utf8'));
      for(const device of ['desktop','phone'])for(const quality of ['high','low'])files[device+'-'+quality]=manifest.samples.find(s=>s.device===device&&s.quality===quality&&s.moment==='line-4').image;
      return files;
    },
  };
  return api;
}
