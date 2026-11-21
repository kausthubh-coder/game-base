// Focused guidance presentation and ordinary fence placement from an unchanged earned save.
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {launchChrome} from './lib/chrome.mjs';
import {verifyRuntime,digest} from './lib/beta-chain.mjs';
import {sample,canStartHeavy} from './resource-status.mjs';
import {storyCosts,costIssues} from './lib/story-cost-probe.mjs';
import {createKeyboardSteering} from './lib/keyboard-steering.mjs';
const args=process.argv.slice(2);const option=n=>{const i=args.indexOf(n);if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw Error(n+' required');return args[i+1];};
const out=resolve(option('--out')),dist=option('--dist'),manifest=option('--manifest'),port=option('--port');mkdirSync(out);
const farmPath='.artifacts/beta-final/attempt-01/retry-03/03-home/earned-construction.save.json';
const landingPath='.artifacts/beta-final/attempt-01/01-grant/earned-landing.save.json';
const farmRaw=readFileSync(farmPath,'utf8'),landingRaw=readFileSync(landingPath,'utf8');
const report={scope:'targeted diagnostic, not a new earned beta chain; farm actions resume unchanged earned bytes; guide presentation uses disclosed teleport only',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtime:dist,manifestSHA:digest(readFileSync(manifest)),inputs:[],captures:[],errors:[],resources:[],checkpoints:[{path:farmPath,sha256:digest(farmRaw)},{path:landingPath,sha256:digest(landingRaw)}]};
let browser,server,page,monitor,pending=Promise.resolve(),current='start';
const persist=()=>writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));
const must=(ok,why)=>{if(!ok)throw Error(why);};
const record=action=>report.inputs.push({step:current,time:Date.now(),...action});
const read=()=>page.evaluate(()=>window.__game.state());
async function wait(test,why,timeout=15000){const until=Date.now()+timeout;while(Date.now()<until){const s=await read();must(!s.viewErrors.length&&!Object.keys(s.failed).length,'runtime errors');if(test(s))return s;await page.waitForTimeout(100);}throw Error('Timed out: '+why);}
async function press(key){record({type:'press',key});await page.keyboard.press(key);await page.waitForTimeout(150);}
async function click(selector){record({type:'click',selector});await page.locator(selector).click();}
async function shot(name){await page.waitForTimeout(400);const data=await page.evaluate(()=>({state:window.__game.state(),text:document.body.innerText,guide:[...document.querySelectorAll('[data-irrigation]')].map(e=>({id:e.dataset.irrigation,visible:e.checkVisibility(),rect:e.getBoundingClientRect().toJSON()}))}));await page.screenshot({path:resolve(out,name+'.png')});writeFileSync(resolve(out,name+'.json'),JSON.stringify(data,null,2));report.captures.push({name,sha256:digest(readFileSync(resolve(out,name+'.png'))),...data});persist();console.log('capture '+name);return data;}
async function load(raw,quality,width,height){if(page)await page.close();page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:'+port+'/?seed=41&quality='+quality);await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();await page.waitForFunction(()=>!!window.__game);await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(s=>s.started&&!s.player.busy,'Continue');}
async function walk(x,z,near=.3) {
 try { return await straightWalk(x,z,near); }
 catch(error) {
  if(!String(error).includes('walking stuck')) throw error;
  const path=await page.evaluate(([x,z])=>{const g=window.__game.view.game;return g.systems.nav.path(g.player.pos,{x,y:g.world.heightAt(Math.floor(x),Math.floor(z)),z},20000)},[x,z]);
  record({type:'read-only-nav-route',goal:{x,z},path});must(path?.length,'no walkable route');
  for(const p of path) {if((await read()).talk)return;await straightWalk(p.x,p.z,.2);}
  return straightWalk(x,z,near);
 }
}
async function straightWalk(x, z, near = 0.3) {
  const goal = { x, z };
  record({ type: 'walk-goal', goal, near });
  let last, stuck = 0, best = Infinity, withoutProgress = 0;
  const held = new Set();
  const steer = createKeyboardSteering();
  try {
    for (let i = 0; i < 1000; i++) {
      const s = await read(), p = s.player;
      if (s.talk || Math.hypot(goal.x - p.x, goal.z - p.z) < near) return;
      must(!p.busy, 'walk blocked by busy state');
      const t = goal;
      const yaw = await page.evaluate(() => window.__game.view.camera.yaw);
      const dx = t.x - p.x, dz = t.z - p.z, len = Math.hypot(dx, dz) || 1;
      const f = (-dx * Math.sin(yaw) - dz * Math.cos(yaw)) / len;
      const r = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / len;
      const direction = steer(dx, dz, yaw);
      const want = new Set([...(direction.forward > 0 ? ['KeyW'] : direction.forward < 0 ? ['KeyS'] : []), ...(direction.right > 0 ? ['KeyD'] : direction.right < 0 ? ['KeyA'] : [])]);
      for (const key of held) if (!want.has(key)) { record({ type: 'up', key }); await page.keyboard.up(key); held.delete(key); }
      for (const key of want) if (!held.has(key)) { record({ type: 'down', key }); await page.keyboard.down(key); held.add(key); }
      await page.waitForTimeout(50);
      if (last && Math.hypot(p.x - last.x, p.z - last.z) < .03) stuck++; else stuck = 0;
      const distance = Math.hypot(goal.x-p.x,goal.z-p.z);
      if(distance < best-.03){best=distance;withoutProgress=0;}else withoutProgress++;
      if (stuck > 25 || withoutProgress > 25) throw new Error(`walking stuck at ${p.x},${p.z}, goal ${goal.x},${goal.z}`);
      last = p;
    }
    throw new Error('walking exhausted');
  } finally { for (const key of held) { record({ type: 'up', key }); await page.keyboard.up(key); } }
}
async function save(name) {
  // Public save entry point, explicitly recorded; no serialization edits or supplied fixture.
  record({ type: 'public-save', method: '__game.save' });
  must(await page.evaluate(() => window.__game.save()), 'save failed');
  const raw = await page.evaluate(() => localStorage.getItem('greenhollow.save'));
  must(raw, 'save missing'); writeFileSync(resolve(out, name + '.save.json'), raw);
  record({type:'save-sha256',name,sha256:createHash('sha256').update(raw).digest('hex')});return JSON.parse(raw);
}
const pointer=(x,y,z,height=.99)=>page.evaluate(([x,y,z,height])=>window.__game.view.project(x+.5,y+height,z+.5),[x,y,z,height]);
async function point(x,y,z,height=.99) {
 await page.waitForTimeout(500);
 for(let turn=0;turn<4;turn++) {
  const at=await pointer(x,y,z,height);
  if(at) {
   record({type:'pointer',cell:[x,y,z],height,at});await page.mouse.move(at.x,at.y);await page.waitForTimeout(150);
   const aim=await page.evaluate(()=>{const a=window.__game.view.aim;return a&&[a.x,a.y,a.z]});
   if(JSON.stringify(aim)===JSON.stringify([x,y,z])) return;
  }
  await press('KeyQ');await page.waitForTimeout(800);
 }
 throw Error('pointer cannot reach '+[x,y,z]);
}
async function equip(id) {
 const slots=await page.evaluate(()=>window.__game.view.game.systems.inventory.slots);
 let index=slots.findIndex(s=>s?.id===id);must(index>=0,'missing earned item '+id);
 if(index>=9){await press('KeyI');await click(`[data-key="slot:${index}"]`);await click('[data-key="slot:8"]');await press('Escape');index=8;}
 await press('Digit'+(index+1));
}
async function place(id,x,y,z){
 if(await page.evaluate(id=>window.__game.view.game.systems.placeables.all().some(p=>p.kind===id),id))return;
 await walk(x+.5,z+3.5,.3);await equip(id);await point(x,y,z);await press('KeyG');await page.waitForTimeout(200);
 record({type:'build-preview',id,cell:[x,y,z],plan:await page.evaluate(()=>window.__game.view.game.systems.build.plan())});
 const at=await pointer(x,y,z);record({type:'place-mouse',id,cell:[x,y,z],mode:'build'});await page.mouse.click(at.x,at.y);await page.waitForTimeout(500);await press('KeyG');
 await page.waitForFunction(id=>window.__game.view.game.systems.placeables.all().some(p=>p.kind===id),id,{timeout:3000});

}

try{
 verifyRuntime(dist,manifest);const resources=await sample();report.resources.push(resources);must(canStartHeavy(resources,Number(option('--active-heavy-jobs'))),'resource admission held');
 monitor=setInterval(()=>{pending=pending.then(async()=>{report.resources.push(await sample());persist();});},30000);
 server=spawn('bun',['tools/serve.mjs',dist,port],{stdio:['ignore','pipe','inherit']});report.serverPID=server.pid;
 await new Promise((done,fail)=>{server.stdout.on('data',b=>{/pid \d+/.test(String(b))&&done()});server.on('error',fail);});
 browser=await launchChrome();report.renderer=browser.gameRenderer;
 if(!args.includes('--anchors-only')&&!args.includes('--budgets-only')){
 for(const [label,width,height] of [['desktop',1366,768],['phone',390,844]])for(const quality of ['high','low']){
  current='farm-help-'+label+'-'+quality;await load(farmRaw,quality,width,height);await shot(current+'-hud');await press('KeyJ');const cap=await shot(current+'-quest');must(cap.text.includes('2 planks and 1 fiber')&&cap.text.includes('One fence piece is enough'),'missing first farm hint');
 }
 current='ordinary-fence';await load(farmRaw,'high',1366,768);report.beforeFarm=await read();
 const bench=await page.evaluate(()=>window.__game.view.game.systems.placeables.all().find(p=>p.kind==='workbench'));await walk(bench.x+.5,bench.z+1.5,.15);await wait(s=>s.prompt==='Craft','workbench prompt');await press('KeyE');await shot('fence-recipe');must(await page.locator('[data-key=\"make:fence\"]').count()===1,'Fence recipe absent');await press('Escape');await place('fence',10,21,-230);
 await wait(s=>s.flags['farm.moss.built']===true&&s.flags['farm.moss.living']===true,'living moss farm',5000);await shot('fence-created-farm');await save('earned-farm-targeted');
 report.afterFarm=await read();
 await walk(10.5,-228,.3);await shot('farm-approach');
 if((await read()).prompt?.includes('Moss')){await press('KeyE');await shot('farm-panel');await press('Escape');}
 for(const [label,width,height] of [['desktop',1366,768],['phone',390,844]])for(const quality of ['high','low']){
  current='ditch-guide-'+label+'-'+quality;await load(landingRaw,quality,width,height);
  // Presentation diagnostic only: the checkpoint remains unmodified; positioning is not earned travel.
  record({type:'diagnostic-teleport',at:[15,22,-224]});await page.evaluate(async()=>{window.__game.teleport(15,22,-224);await window.__game.settle();});
  await shot(current);await press('KeyJ');const cap=await shot(current+'-quest');must(cap.text.includes('gold-outlined dry field'),'missing ditch hint');must(cap.guide.every(g=>!g.visible),'guide visible through menu');await press('Escape');
 }
 }
 if(args.includes('--anchors-only'))for(const [label,width,height] of [['desktop',1366,768],['phone',390,844]])for(const quality of ['high','low']){
  await load(landingRaw,quality,width,height);
  for(const [anchor,x,z] of [['source',7,-225],['field',20,-224]]){
   current='anchor-'+anchor+'-'+label+'-'+quality;for(const [px,pz] of [[x+2,z-2],[x+4,z-2],[x+3,z-4],[x,z-6]]){record({type:'diagnostic-teleport',at:[px,22,pz]});await page.evaluate(async([px,pz])=>{window.__game.teleport(px,22,pz);await window.__game.settle();},[px,pz]);await page.waitForTimeout(500);if(await page.locator('[data-irrigation='+anchor+']').isVisible())break;}const cap=await shot(current);must(cap.guide.find(g=>g.id===anchor)?.visible,'anchor label not visible: '+current);
  }
  await press('KeyJ');const menu=await shot('hidden-menu-'+label+'-'+quality);must(menu.guide.every(g=>!g.visible),'menu guide visible');await press('Escape');
  record({type:'diagnostic-film-state',enabled:true});await page.evaluate(()=>window.__game.view.root.classList.add('sf-on'));const film=await shot('hidden-film-'+label+'-'+quality);must(film.guide.every(g=>!g.visible),'film guide visible');await page.evaluate(()=>window.__game.view.root.classList.remove('sf-on'));
  record({type:'diagnostic-completion-flag',flag:'step.ground.ditch'});await page.evaluate(()=>window.__game.view.game.flags.set('step.ground.ditch',true));const done=await shot('hidden-done-'+label+'-'+quality);must(done.guide.every(g=>!g.visible),'completed guide visible');
 }
 if(args.includes('--budgets-only'))for(const quality of ['high','low']){
  await load(landingRaw,quality,1366,768);record({type:'diagnostic-teleport',at:[9,22,-227]});await page.evaluate(async()=>{window.__game.teleport(9,22,-227);await window.__game.settle();});await shot('budget-guide-'+quality);const frames=await storyCosts(page),issues=costIssues(frames,quality);writeFileSync(resolve(out,'budget-'+quality+'.json'),JSON.stringify({quality,frames,issues},null,2));must(issues.length===0,'guide budget exceeded '+quality);
 }
 must(report.errors.length===0,'page errors');for(const c of report.checkpoints)must(digest(readFileSync(c.path))===c.sha256,'checkpoint modified');report.status='PASS';persist();
}catch(error){report.status='FAILED';report.error=String(error.stack??error);persist();if(page)await shot('failed').catch(()=>{});throw error;}
finally{clearInterval(monitor);await pending;await browser?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('close',r));}persist();}
