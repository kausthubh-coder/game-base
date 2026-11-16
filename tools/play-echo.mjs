import { requireBetaHash } from './lib/beta-chain.mjs';
// Echo from the exact earned Gold boundary. All actions use browser input.
// PLAY_PORT=5559 bun tools/play-echo.mjs --save <earned.save.json> --out <new-directory>
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { firstnightFrame, firstnightIssues, settleDialogue } from './lib/firstnight-framing.mjs';
import { createKeyboardSteering } from './lib/keyboard-steering.mjs';
import { launchChrome } from './lib/chrome.mjs';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const outIndex = process.argv.indexOf('--out');
if (outIndex < 0 || !process.argv[outIndex + 1] || process.argv[outIndex + 1].startsWith('--')) {
  throw new Error('--out requires an evidence directory');
}
const out = resolve(root, process.argv[outIndex + 1]);
if(existsSync(out)&&readdirSync(out).length)throw Error('Choose an empty --out directory to preserve prior evidence');

const port = Number(process.env.PLAY_PORT || 5559);
const dist = 'dist-bench-copper'; // Reuse only this completed, regenerable output.
const pumpChoice=process.argv.includes('--running')?'running':'crated';
const saveIndex = process.argv.indexOf('--save');
mustSave();
function mustSave() { if (saveIndex < 0 || !process.argv[saveIndex+1] || process.argv[saveIndex+1].startsWith('--')) throw Error('--save requires an unedited earned stage save'); }
const rawInput = readFileSync(resolve(root, process.argv[saveIndex+1]), 'utf8');
const inputHash = createHash('sha256').update(rawInput).digest('hex');
requireBetaHash(inputHash, '22c1a54d698331f83a35d1a8d9c998a80b1825150b13d1d6ca38f07442fca043', 'gold');
mkdirSync(out, { recursive: true });
const qualityIndex = process.argv.indexOf('--quality');
const quality = qualityIndex < 0 ? 'high' : process.argv[qualityIndex + 1];

const runnerSha256=createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex');
const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const sourceDiff = spawnSync('git', ['diff', '--binary', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout;
writeFileSync(resolve(out, 'tested-working-tree.patch'), sourceDiff);
const sourceDiffSha256 = createHash('sha256').update(sourceDiff).digest('hex');
let browser, server, page, failure, current = 'build';
const inputs = [], captures = [], errors = [], scenes = [], framing = [], restoration = [], entries = [];
async function observeScenes() {
  await page.exposeFunction('echoScene', data => scenes.push(data)).catch(e => { if (!String(e).includes('already')) throw e; });
  await page.evaluate(() => window.__game.view.game.events.on('scene.played', data => window.echoScene(data)));
}
const must = (ok, why) => { if (!ok) throw new Error(why); };
const record = (action) => { inputs.push({ step: current, time: Date.now(), ...action }); };
const read = () => page.evaluate(() => {
  const g = window.__game, o = g.view.game.systems.opening;
  const state = g.state();
  if (state.talk) state.talk.scene = g.view.game.systems.talk.current()?.scene;
  return { ...state, gear:g.view.game.systems.bench.gear(), health:g.view.game.systems.fights.hero(), farms:g.view.game.systems.farms.all(), opening: { stage: o.stage(), hero: o.hero(), ask: o.asking(), bout: o.bout() } };
});
async function shot(name) {
  await page.waitForTimeout(120);
  const s = await read();
  await page.screenshot({ path: resolve(out, name + '.png') });
  writeFileSync(resolve(out, name + '.json'), JSON.stringify(s, null, 2));
  captures.push({ name, state: s });
  console.log(`ok ${name} ${s.prompt ?? ''}`);
}
async function wait(test, why, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const s = await read();
    must(!s.viewErrors.length && !Object.keys(s.failed).length, JSON.stringify(s.viewErrors));
    if (await test(s)) return s;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out: ${why}`);
}
async function press(key) { record({ type: 'press', key }); await page.keyboard.press(key); await page.waitForTimeout(120); }
async function click(selector) { record({ type: 'click', selector }); await page.locator(selector).click(); }
async function dialogue(name) {
 current=name; await wait(s=>!!s.talk,name+' begins'); await shot(name);
 const expected=({'22-maren':22,'23-relit':23,'16-blessing':16,'17-custodian':17,'18-hobb-dax':18,'19-thistlehog-calm':19,'20-wren':20,'21-not-yet':21,'21-boar-before':21})[name];
 const yaw=await page.evaluate(()=>window.__game.view.camera.yaw);
 entries.push({name,frame:await firstnightFrame(page)});
 for(let i=0;i<160;i++) {
  const s=await read();if(!s.talk){await page.waitForTimeout(1000);const back=await read();if(!back.talk)must(!back.player.busy,'controls remain busy');const restored=await page.evaluate(()=>window.__game.view.camera.yaw);must(Math.abs(restored-yaw)<.001,'camera yaw not restored');restoration.push({name,yaw,restored});return;}
  if(expected)must(s.talk.scene===expected,'wrong scene '+s.talk.scene);
  await settleDialogue(page);const frame=await firstnightFrame(page);framing.push({name,i,frame,issues:firstnightIssues(frame)});
  await page.screenshot({path:resolve(out,name+'-line-'+i+'.png')});
  if(s.talk.choices?.length) {record({type:'choice',choice:pumpChoice});throw Error('unexpected dialogue choice');}
  else await press('KeyE');
  await page.waitForTimeout(150);
 }
 throw Error(name+' never ended');
}
async function walk(x,z,near=.3) {
 try { return await straightWalk(x,z,near); }
 catch(error) {
  if(!/walking stuck|walking exhausted/.test(String(error))) throw error;
  const path=await page.evaluate(([x,z])=>{const g=window.__game.view.game;const to={x,y:g.world.heightAt(Math.floor(x),Math.floor(z)),z};return g.systems.nav.path(g.player.pos,to,20000)??g.systems.nav.toward(g.player.pos,to,20000)},[x,z]);
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
      if(i%100===0)console.log('walk',current,i,p.x,p.z,'to',x,z);
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
   const aim=await page.evaluate(()=>{const a=window.__game.view.aim;return a&&[a.x,a.y,a.z]});record({type:'aim-observation',aim,cell:[x,y,z],terrain:await page.evaluate(([x,y,z])=>{const v=window.__game.view,w=v.game.world,p=v.project(x+.5,y+.99,z+.5);const cam=window.__game.state().camera.at,dx=x+.5-cam.x,dy=y+.99-cam.y,dz=z+.5-cam.z,n=Math.hypot(dx,dy,dz),hit={};const found=w.raycast(cam.x,cam.y,cam.z,dx/n,dy/n,dz/n,500,hit,v.camera.hides);return {rawHit:found?hit:null,height:w.heightAt(x,z),block:w.getBlock(x,y,z),pointer:v.keys.pointer,element:p?document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,400):null,hero:v.playerPosition,claimed:v.claimed('use')}},[x,y,z])});
   if(JSON.stringify(aim)===JSON.stringify([x,y,z])) return;
  }
  await press('KeyQ');await page.waitForTimeout(800);
 }
 throw Error('pointer cannot reach '+[x,y,z]);
}
async function ownedAll(ids) {
 return page.evaluate(ids=>{const g=window.__game.view.game;return ids.every(id=>g.systems.inventory.count(id)>0||g.systems.placeables.all().some(p=>p.kind===id));},ids);
}
async function equip(id) {
 const slots=await page.evaluate(()=>window.__game.view.game.systems.inventory.slots);
 let index=slots.findIndex(s=>s?.id===id);must(index>=0,'missing earned item '+id);
 if(index>=9){await press('KeyI');await click(`[data-key="slot:${index}"]`);await click('[data-key="slot:8"]');await press('Escape');index=8;}
 await press('Digit'+(index+1));
}
async function make(id,count=1,hand=false){
 if(hand){await press('KeyI');await click('[data-key="tab:hand"]');await click(`[data-key="recipe:${id}"]`);}
 else {const bench=await page.evaluate(()=>window.__game.view.game.systems.placeables.all().find(p=>p.kind==='workbench'));must(bench,'earned workbench');await walk(bench.x+.5,bench.z+1.5,.15);await wait(s=>s.prompt==='Craft','workbench prompt');await press('KeyE');}
 for(let i=0;i<count;i++)await click(`[data-key="make:${id}"]`);
 await press('Escape');
}
async function goPlace(id,dx=0,dz=0,near=1){const p=await page.evaluate(id=>window.__game.view.game.systems.region.place(id).at,id);await walk(p.x+dx,p.z+dz,near);return p;}
async function idleUntil(test, why, max = 1800) {
 const started = Date.now();
 for (let i = 0; i < max; i++) {
  if (await test()) {
   record({type:'ordinary-wait-complete',reason:why,elapsedMs:Date.now()-started});
   return;
  }
  const state = await read();
  must(!state.talk, 'unexpected scene during '+why);
  must(!await page.evaluate(()=>window.__game.view.game.systems.fights.running()), 'unexpected combat during '+why);
  record({type:'ordinary-wait',ms:1000,reason:why});
  await page.waitForTimeout(1000);
 }
 throw Error('bounded ordinary wait exhausted '+why);
}
async function continueSave(name,home=true){await press('Escape');await wait(s=>s.paused,'normal pause before checkpoint');const before=await save(name);await page.reload();await page.waitForFunction(()=>!!window.__game);await observeScenes();record({type:'public-save-observer',method:'__game.save',intent:'capture exact restored bytes after the Continue click, before the next frame'});await page.evaluate(()=>{document.addEventListener('click',()=>queueMicrotask(async()=>{await window.__game.save();window.__goldContinueRaw=localStorage.getItem('greenhollow.save')}),{once:true})});await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>!!window.__goldContinueRaw);const raw=await page.evaluate(()=>window.__goldContinueRaw);writeFileSync(resolve(out,name+'-continued.save.json'),raw);const after=JSON.parse(raw);record({type:'save-sha256',name:name+'-continued',sha256:createHash('sha256').update(raw).digest('hex')});await wait(s=>s.started&&!s.player.busy,'Continue');for(const key of ['inventory','bench','placeables','settlement','quests','goods','crops','ruins'])must(JSON.stringify(before.game.systems[key])===JSON.stringify(after.game.systems[key]),key+' changed on Continue');must(JSON.stringify(before.world)===JSON.stringify(after.world),'world changed on Continue');for(const [key,value] of before.game.flags)if(/^(shrine\.|choice\.dinner|dinner\.|scene\.|memory\.|vaults\.|keystone\.|job\.)/.test(key))must(Object.fromEntries(after.game.flags)[key]===value,key+' changed on Continue');const friendship=v=>v.game.systems.people.people.map(p=>[p.id,p.friendship]);must(JSON.stringify(friendship(before))===JSON.stringify(friendship(after)),'friendships changed on Continue');if(home)await wait(s=>s.flags.heartstone===Object.fromEntries(before.game.flags).heartstone&&['moss','quill','copper'].every(id=>s.flags['farm.'+id+'.living']),'settled home systems');await page.waitForFunction(level=>document.querySelector('.ui-heart-name')?.textContent?.startsWith('Heartstone '+level),Object.fromEntries(before.game.flags).heartstone);await page.waitForFunction(()=>!document.querySelector('.ui-heart')?.classList.contains('is-rising'));await shot(name+'-continued');}
async function importRaw(raw) {
 await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=${quality}`);
 await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();await page.waitForFunction(()=>!!window.__game);await observeScenes();
 await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(s=>s.started&&!s.player.busy,'Continue');
}
async function branch(raw,name,run) {
 const main=page; const context=await browser.newContext({viewport:{width:1366,height:768}});page=await context.newPage();
 try {record({type:'independent-raw-import',name,sha256:createHash('sha256').update(raw).digest('hex')});await importRaw(raw);await run();}finally{await context.close();page=main;}
}
async function placeItem(id,x,z) {
 await walk(x+.5,z+3,.4);await equip(id);const y=await page.evaluate(([x,z])=>window.__game.view.game.world.heightAt(x,z)-1,[x,z]);await point(x,y,z);await press('KeyG');const p=await pointer(x,y,z);await page.mouse.click(p.x,p.y);await press('KeyG');
 const placed=await page.evaluate(([id,x,z])=>{const api=window.__game.view.game.systems.placeables;return api.all().find(p=>{if(p.kind!==id)return false;const def=api.defs().find(d=>d.kind===id);const turns=p.quarterTurns;const sx=turns%2?def.size[2]:def.size[0],sz=turns%2?def.size[0]:def.size[2];return p.x===(turns===1?x-sx+1:x)&&p.z===(turns===2?z-sz+1:z)})},[id,x,z]);must(placed,'placement '+id);record({type:'placed-observation',placed});
}
async function shrine(choice) {
 await wait(s=>s.prompt==='Restore the shrine','shrine prompt');const before=await read();await press('KeyE');await shot('shrine-choice-'+choice);await click(`[data-key="shrine:${choice}"]`);await wait(s=>s.flags['shrine.shrine-oak']===choice,'shrine choice');const after=await read();
 must(JSON.stringify(before.bag)===JSON.stringify(after.bag),'shrine restoration costs no materials');
 must(after.health.maxHealth-before.health.maxHealth===(choice==='heart'?20:0),'health reward');
 must(after.health.maxStamina-before.health.maxStamina===(choice==='stamina'?20:0),'stamina reward');must(after.health.health===after.health.maxHealth&&after.health.stamina===after.health.maxStamina,'actual full shrine stats outside combat');await save('shrine-'+choice);await continueSave('shrine-'+choice,false);const restored=await read();must(JSON.stringify(restored.health)===JSON.stringify(after.health),'actual shrine stats survive Continue');await shot('shrine-'+choice);
}
async function dinner(choice) {
 await wait(s=>s.prompt==='Sit down to dinner','dinner prompt');await press('KeyE');await shot('dinner-'+choice+'-asks');const before=await save('dinner-'+choice+'-before');
 record({type:'dinner-choice',choice});await page.getByRole('button',{name:`Grant ${choice==='gus'?'Gus':'Hobb'}'s wish`,exact:true}).click();await shot('dinner-'+choice+'-granted');const after=await save('dinner-'+choice+'-after');
 const flags=x=>Object.fromEntries(x.game.flags);must(flags(after)['choice.dinner']===choice,'dinner choice');must(flags(after).hearts-flags(before).hearts===10,'dinner ten hearts');
 const friend=(v,id)=>v.game.systems.people.people.find(p=>p.id===id).friendship;must(friend(after,choice)===Math.min(5,friend(before,choice)+2),'dinner friendship from ten hearts plus promise');const other=choice==='gus'?'hobb':'gus';must(friend(after,other)===friend(before,other),'other friendship unchanged');must(JSON.stringify(before.game.systems.placeables)===JSON.stringify(after.game.systems.placeables),'dinner promise does not construct buildings');await press('Escape');await continueSave('dinner-'+choice,false);must((await read()).prompt!=='Sit down to dinner','same-evening recurrence blocked');
}
try {
 if(!process.argv.includes('--no-build')){const b=spawn('bun',['x','vite','build','--outDir',dist,'--emptyOutDir','--logLevel','warn'],{cwd:root,stdio:'inherit'});must(await new Promise(r=>b.on('exit',r))===0,'build failed');}
 server=spawn('bun',['tools/serve.mjs',dist,String(port)],{cwd:root,stdio:['ignore','pipe','inherit']});await new Promise((done,fail)=>{server.stdout.on('data',b=>{if(/pid \d+/.test(String(b)))done()});server.on('exit',c=>fail(Error('server exited '+c)))});
 browser=await launchChrome();const context=await browser.newContext({viewport:{width:1366,height:768}});page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 record({type:'import-stage-boundary',path:process.argv[saveIndex+1],sha256:inputHash});await importRaw(rawInput);await wait(s=>s.flags.heartstone===3&&['moss','quill','copper'].every(id=>s.flags['farm.'+id+'.living']),'settled Gold');must(!(await read()).flags['scene.24'],'memory unplayed');await shot('00-boundary');
 current='walk-to-stone';await walk(-19,-261.8,.15);await page.waitForTimeout(2000);must(!(await read()).talk,'memory waits for interaction');await shot('01-stone-before');await wait(s=>s.prompt==='Touch the dull stone','stone prompt');await press('KeyE');await dialogue('24-memory');await dialogue('vault-marks');await wait(s=>s.flags['vaults.marked'],'three marks earned');await press('KeyM');await page.waitForTimeout(1200);const pins=await page.evaluate(()=>JSON.parse(localStorage.getItem('greenhollow.map')).pins);writeFileSync(resolve(out,'vault-pins.json'),JSON.stringify(pins,null,2));must(['pumphouse','lampgallery','seedvault'].every(id=>pins.some(p=>p.id===id&&p.kind==='vault')),'three unvisited vault pins');await shot('02-vault-map');await press('Escape');
 const repeatBefore=await save('before-repeat');await walk(-19,-261.8,.15);await wait(s=>s.prompt==='Touch the stone again','repeat prompt');await press('KeyE');await dialogue('memory-repeat');const repeatAfter=await save('after-repeat');must(JSON.stringify(repeatBefore.game.systems.inventory)===JSON.stringify(repeatAfter.game.systems.inventory),'repeat memory gives no duplicate items');must(Object.fromEntries(repeatBefore.game.flags).hearts===Object.fromEntries(repeatAfter.game.flags).hearts,'repeat memory gives no duplicate hearts');must(scenes.filter(s=>s.scene===24).length===1,'initial memory plays once');await continueSave('middle-memory',false);const restoredPins=await page.evaluate(()=>JSON.parse(localStorage.getItem('greenhollow.map')).pins);must(['pumphouse','lampgallery','seedvault'].every(id=>restoredPins.some(p=>p.id===id)),'markers survive Continue');
 current='oak-shrine';await goPlace('shrine-oak',0,1.5,.3);await press('Escape');await save('pre-shrine');const shrineRaw=readFileSync(resolve(out,'pre-shrine.save.json'),'utf8');await press('Escape');
 await branch(shrineRaw,'stamina',()=>shrine('stamina'));record({type:'independent-raw-import',name:'heart',sha256:createHash('sha256').update(shrineRaw).digest('hex')});await importRaw(shrineRaw);await shrine('heart');
 current='bee-farm';await goPlace('grant.center');await make('bee_box');await make('dinner_table');await placeItem('bee_box',17,-231);await wait(s=>s.farms.some(f=>f.id==='bee'&&f.living&&f.rate>0),'living bees');await shot('03-living-bees');
 await idleUntil(()=>page.evaluate(()=>window.__game.view.game.systems.machines.loose().some(g=>g.item==='honey')||window.__game.view.game.systems.inventory.count('honey')>0),'living bee production',1800);
 const honey=await page.evaluate(()=>window.__game.view.game.systems.machines.loose().find(g=>g.item==='honey'));if(honey)await walk(honey.x,honey.z,.3);await wait(s=>s.bag.some(i=>i.id==='honey'&&i.count>0),'collected actual honey');await shot('04-honey');
 await placeItem('dinner_table',2,-224);current='evening-dinner';await walk(3,-222,.3);await idleUntil(()=>page.evaluate(()=>!!window.__game.view.game.systems.settlement.dinner()||window.__game.state().prompt==='Sit down to dinner'),'ordinary evening',1800);
 await press('Escape');await save('pre-dinner');const dinnerRaw=readFileSync(resolve(out,'pre-dinner.save.json'),'utf8');await press('Escape');await branch(dinnerRaw,'hobb',()=>dinner('hobb'));record({type:'independent-raw-import',name:'gus',sha256:createHash('sha256').update(dinnerRaw).digest('hex')});await importRaw(dinnerRaw);await dinner('gus');
 await wait(s=>s.flags['quest.echo.done']&&['pump','gallery','seeds'].every(q=>s.flags['quest.'+q+'.started']),'Echo complete');must(!(await read()).flags['keystone.1'],'before vault victories');await goPlace('grant.center');await continueSave('final-home');const final=await save('earned-echo');const original=JSON.parse(rawInput);for(const b of original.game.systems.placeables.placed)must(final.game.systems.placeables.placed.some(p=>JSON.stringify(p)===JSON.stringify(b)),'retained building '+b.id);for(const c of original.game.systems.crops.crops)must(final.game.systems.crops.crops.some(p=>p.slice(0,4).join()===c.slice(0,4).join()),'retained crop '+c.slice(0,4));for(const pet of original.game.systems.pets.pets){const now=final.game.systems.pets.pets.find(p=>p.id===pet.id);must(now&&now.trust===pet.trust&&now.bonded===pet.bonded,'retained bonded companion');}for(const key of ['weapons','wielding','armor','kit'])must(JSON.stringify(final.game.systems.bench[key])===JSON.stringify(original.game.systems.bench[key]),'unchanged combat equipment '+key);for(const resident of original.game.systems.settlement.settlers){const now=final.game.systems.settlement.settlers.find(r=>r.who===resident.who);must(now&&now.job===resident.job,'retained resident/job '+resident.who);for(const need of ['bed','meal','lamp'])must(!Object.fromEntries(final.game.flags)['need.'+resident.who+'.'+need],'resident need met '+resident.who+' '+need);}for(const farm of original.game.systems.farms.farms)must(final.game.systems.farms.farms.find(f=>f.id===farm.id)?.mode===farm.mode,'retained farm mode '+farm.id);for(const n of [1,2,3])must(!Object.fromEntries(final.game.flags)['keystone.'+n],'before keystone '+n);for(const id of ['pumphouse','lampgallery','seedvault'])must(!Object.fromEntries(final.game.flags)['vault.'+id+'.cleared'],'before vault clear '+id);for(const id of ['moss','quill','copper'])must((await read()).farms.some(f=>f.id===id&&f.living&&f.mode==='give'),'original living Give '+id);await shot('05-earned-home');must(!errors.length,errors.join('\n'));
}catch(e){failure=String(e.stack??e);console.error(current,failure);if(page){await save('last-earned-checkpoint').catch(()=>{});await shot('failed').catch(()=>{});}}
finally{await browser?.close();if(server&&server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r))}writeFileSync(resolve(out,'replay.json'),JSON.stringify({status:failure?'BLOCKED':'PASS',sha,sourceDiffSha256,runnerSha256,inputHash,current,failure,errors,scenes,inputs,captures,framing,restoration,entries},null,2));}
console.log(failure?'BLOCKED':'PASS Echo');process.exitCode=failure?1:0;
