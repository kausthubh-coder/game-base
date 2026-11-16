// Bench and copper from the exact unedited earned grey-wood save. Required actions use browser keys and mouse.
// PLAY_PORT=5559 bun tools/play-bench-copper.mjs --save <earned.save.json> --out <new-directory>
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { firstnightFrame, firstnightIssues, settleDialogue } from './lib/firstnight-framing.mjs';
import { fightPlace } from '../src/game/fights/index.sim.ts';
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
const dist = 'dist-bench-copper';
const pumpChoice=process.argv.includes('--running')?'running':'crated';
const saveIndex = process.argv.indexOf('--save');
mustSave();
function mustSave() { if (saveIndex < 0 || !process.argv[saveIndex+1] || process.argv[saveIndex+1].startsWith('--')) throw Error('--save requires an unedited earned stage save'); }
const rawInput = readFileSync(resolve(root, process.argv[saveIndex+1]), 'utf8');
const inputHash = createHash('sha256').update(rawInput).digest('hex');
const recoverDax=process.argv.includes('--recover-dax');
const resumeGive=process.argv.includes('--resume-earned-give');
const resume=process.argv.includes('--resume-earned-choice')||resumeGive;
if(recoverDax?inputHash!=='9865912499b1f6d8dd5c4ac1ca2ee0f05cb2d363b7bfea6ccac5a9a6df0a30fa':resumeGive?inputHash!=='5d827b4cb2cb992ccc530133f115dad0c086f4545e36830a684eddc35f59333d':resume?inputHash!=='84420052013beb7c95a5e1e78b7578b2b16fe38d6c4f93c0fd54f2c2dfae05b4':inputHash!=='d1de50e2eb48a7de5b9af900e470cabd2a88d6688e2e701a18407db1e2c7290b')throw Error('requires exact historical earned greywood');
mkdirSync(out, { recursive: true });
const qualityIndex = process.argv.indexOf('--quality');
const quality = qualityIndex < 0 ? 'high' : process.argv[qualityIndex + 1];

const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
let browser, server, page, failure, current = 'build';
const inputs = [], captures = [], errors = [], scenes = [], framing = [], restoration = [], entries = [];
async function observeScenes() {
  await page.exposeFunction('grantdayScene', data => scenes.push(data)).catch(e => { if (!String(e).includes('already')) throw e; });
  await page.evaluate(() => window.__game.view.game.events.on('scene.played', data => window.grantdayScene(data)));
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
    if (test(s)) return s;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out: ${why}`);
}
async function press(key) { record({ type: 'press', key }); await page.keyboard.press(key); await page.waitForTimeout(120); }
async function click(selector) { record({ type: 'click', selector }); await page.locator(selector).click(); }
async function dialogue(name) {
 current=name; await wait(s=>!!s.talk,name+' begins'); await shot(name);
 const expected=({'16-blessing':16,'17-custodian':17,'18-hobb-dax':18,'19-thistlehog-calm':19,'20-wren':20,'21-not-yet':21,'21-boar-before':21})[name];
 const yaw=await page.evaluate(()=>window.__game.view.camera.yaw);
 entries.push({name,frame:await firstnightFrame(page)});
 for(let i=0;i<160;i++) {
  const s=await read();if(!s.talk){await page.waitForTimeout(1000);const back=await read();if(!back.talk)must(!back.player.busy,'controls remain busy');const restored=await page.evaluate(()=>window.__game.view.camera.yaw);must(Math.abs(restored-yaw)<.001,'camera yaw not restored');restoration.push({name,yaw,restored});return;}
  if(expected)must(s.talk.scene===expected,'wrong scene '+s.talk.scene);
  await settleDialogue(page);const frame=await firstnightFrame(page);framing.push({name,i,frame,issues:firstnightIssues(frame)});
  await page.screenshot({path:resolve(out,name+'-line-'+i+'.png')});
  if(s.talk.choices?.length) {record({type:'choice',choice:pumpChoice});await press(pumpChoice==='running'?'Digit1':'Digit2');}
  else await press('KeyE');
  await page.waitForTimeout(150);
 }
 throw Error(name+' never ended');
}
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
async function calmVisitor(){
  let broke=false,target=-1,stripPlaced=false,dodged=false;
  try {
    for(let i=0;i<1800;i++){
      const fight=await page.evaluate(()=>window.__fights.state());
      if(!fight||fight.over>=0)break;
      record({type:'combat-observation',fight});if(i%100===0)console.log('visitor combat',i,fight.beasts[0].kind,fight.beasts[0].guard,fight.record.rigsPlaced,fight.record.rigsTriggered);
      if(!dodged&&(await read()).gear.tier===2){const before={...fight.hero};await page.keyboard.down('KeyW');await press('ShiftLeft');await page.waitForTimeout(200);await page.keyboard.up('KeyW');const after=await page.evaluate(()=>window.__fights.state().hero);record({type:'copper-grip-dodge',before,after});must(Math.hypot(after.x-before.x,after.z-before.z)>.5,'copper grip dodge did not move');dodged=true;await shot('copper-grip-dodge');}

      if(target<0||fight.beasts[target]?.doing==='calmed')target=fight.beasts.findIndex(b=>b.doing!=='calmed');
      const beast=fight.beasts[target];if(!beast)break;
      if(!stripPlaced&&fight.kit[0]==='quill_strip'){
        await press('Digit1');
        for(let attempt=0;attempt<8;attempt++){
          const cell=await page.evaluate(attempt=>{const v=window.__game.view,f=v.game.systems.fights.running().fight,h=f.hero,b=f.beasts[0],cells=[];for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const x=Math.floor(h.x)+dx+.5,z=Math.floor(h.z)+dz+.5;if(f.canPlace('quill_strip',x,z)===null)cells.push({x,z,d:Math.hypot(x-b.x,z-b.z)});}cells.sort((a,b)=>a.d-b.d);const p=cells[attempt%cells.length];return p?{...p,screen:v.project(p.x,v.playerPosition.y,p.z)}:null;},attempt);
          must(cell?.screen,'no reachable clear strip placement');await page.mouse.move(cell.screen.x,cell.screen.y);await page.waitForTimeout(180);
          const aim=await page.evaluate(()=>{const f=window.__game.view.game.systems.fights.running().fight;return{x:f.input.aimX,z:f.input.aimZ,why:f.canPlace('quill_strip',f.input.aimX,f.input.aimZ)}});record({type:'strip-pointer-observation',cell,aim});
          if(aim.why!==null)continue;
          record({type:'place-earned-strip',cell});await page.mouse.click(cell.screen.x,cell.screen.y);await page.waitForTimeout(150);const placed=await page.evaluate(()=>window.__fights.state());if(placed.record.rigsPlaced>0&&placed.held===null){stripPlaced=true;await shot('visitor-strip');break;}
        }
        must(stripPlaced,'strip click refused after clear pointer aims');
      }
      if(i%100===0)await press('KeyC');
      // Placement alone does not exercise the strip. Bait the beast across it before attacking.
      if(stripPlaced&&fight.record.rigsTriggered===0){
        await page.mouse.up();await page.keyboard.up('KeyF');
        const rig=await page.evaluate(()=>{const f=window.__game.view.game.systems.fights.running().fight;return f.rigs.find(r=>r.kind==='quill_strip'&&r.armed)});
        must(rig,'placed quill strip vanished before triggering');
        const dx=rig.x-beast.x,dz=rig.z-beast.z,len=Math.hypot(dx,dz)||1;
        const goal={x:rig.x+dx/len*5,z:rig.z+dz/len*5};
        const yaw=await page.evaluate(()=>window.__game.view.camera.yaw);
        const gx=goal.x-fight.hero.x,gz=goal.z-fight.hero.z;
        const forward=-gx*Math.sin(yaw)-gz*Math.cos(yaw),right=gx*Math.cos(yaw)-gz*Math.sin(yaw);
        const keys=[forward>.4?'KeyW':forward<-.4?'KeyS':null,right>.4?'KeyD':right<-.4?'KeyA':null].filter(Boolean);
        record({type:'lure-across-earned-strip',rig,goal,keys});
        for(const key of keys)await page.keyboard.down(key);
        await page.waitForTimeout(100);
        for(const key of keys)await page.keyboard.up(key);
        continue;
      }

      if(beast.guard>0&&fight.beasts.some(b=>b.doing==='windup')&&i%8===0){
        const yaw=await page.evaluate(()=>window.__game.view.camera.yaw),dx=fight.center.x-fight.hero.x,dz=fight.center.z-fight.hero.z;
        const fw=-dx*Math.sin(yaw)-dz*Math.cos(yaw),rt=dx*Math.cos(yaw)-dz*Math.sin(yaw);
        const key=Math.abs(fw)>Math.abs(rt)?(fw>0?'KeyW':'KeyS'):(rt>0?'KeyD':'KeyA');
        record({type:'down',key,intent:'dodge toward arena center'});await page.keyboard.down(key);await page.waitForTimeout(50);await press('ShiftLeft');await page.keyboard.up(key);record({type:'up',key});
      }
      const at=await page.evaluate(([x,z])=>window.__game.view.project(x,window.__game.view.game.player.pos.y+.3,z),[beast.x,beast.z]);if(at)await page.mouse.move(at.x,at.y);
      const distance=Math.hypot(beast.x-fight.hero.x,beast.z-fight.hero.z),held=[];
      if(distance>1.8){const yaw=await page.evaluate(()=>window.__game.view.camera.yaw),dx=beast.x-fight.hero.x,dz=beast.z-fight.hero.z;
        const forward=-dx*Math.sin(yaw)-dz*Math.cos(yaw),right=dx*Math.cos(yaw)-dz*Math.sin(yaw);
        for(const key of [forward>.5?'KeyW':forward<-.5?'KeyS':null,right>.5?'KeyD':right<-.5?'KeyA':null].filter(Boolean)){record({type:'down',key});await page.keyboard.down(key);held.push(key);}}
      if(beast.guard<=0){if(!broke){await shot('04-guard-broken');broke=true;}await page.mouse.up();await page.keyboard.down('KeyF');record({type:'down',key:'KeyF'});}
      else{await page.keyboard.up('KeyF');await page.mouse.down();record({type:'down',button:'left'});}
      await page.waitForTimeout(100);for(const key of held){record({type:'up',key});await page.keyboard.up(key);}
    }
  }finally{await page.mouse.up();for(const key of ['KeyF','KeyW','KeyA','KeyS','KeyD'])await page.keyboard.up(key);}

}
// Residents keep walking while the hero approaches. Recheck the prompt and resample after each walk.
async function approachDax() {
  for(let i=0;i<20;i++) {
    const s=await read();
    const at=await page.evaluate(()=>window.__game.view.game.actors.get('npc:dax').pos);
    record({type:'dax-approach',at,hero:s.player,prompt:s.prompt});
    if(s.prompt==='Talk to Dax')return;
    await walk(at.x,at.z,.3);
  }
  throw Error('could not approach moving Dax');
}
async function jobDax(job,target){
  await approachDax();await wait(s=>s.prompt==='Talk to Dax','Dax prompt');
  await press('KeyE');await click(`[data-job="${job}"]`);
  await page.getByRole('button',{name:/Walk Dax to/}).click();
  record({type:'assign-job',who:'dax',job});await walk(...target);
  await wait(s=>s.flags['job.dax']===job,'Dax '+job);
  if((await read()).talk)await dialogue('dax-'+job);
}

try {
  if (!process.argv.includes('--no-build')) {
    const build = spawn('bun', ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
    must(await new Promise(r => build.on('exit', r)) === 0, 'build failed');
  }
  server = spawn('bun', ['tools/serve.mjs', dist, String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((done, fail) => { server.stdout.on('data', b => { if (/pid \d+/.test(String(b))) done(); }); server.on('exit', c => fail(new Error('server exited ' + c))); });
  browser = await launchChrome();
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=${quality}`);
  record({type:'import-stage-boundary', path:process.argv[saveIndex+1], sha256:inputHash});
  await page.evaluate(raw => localStorage.setItem('greenhollow.save', raw), rawInput);
  await page.reload(); await page.waitForFunction(() => !!window.__game);
  await observeScenes();
  await page.getByText('Carries on from your save.', {exact:true}).waitFor();
  record({type:'click',text:'Begin',intent:'Continue'});
  await page.getByRole('button',{name:'Begin',exact:true}).click();
  await wait(s=>s.started && !s.player.busy,'landing Continue');
  if(recoverDax){
    current='recover-dax-watch';await shot('00-recovery');await jobDax('watch',[-23,-223]);await shot('01-watch');await jobDax('yard',[-18,-222]);await shot('02-yard');await jobDax('watch',[-23,-223]);await shot('03-watch');await save('recovered-copper');
  }else{
  if(!resume){
  await shot('00-imported-greywood');
  await wait(s=>s.flags['farm.moss.living']===true&&s.flags.heartstone===2,'settled earned home',30000);
  await shot('01-settled-home'); await save('settled-home');
  const healthBefore=(await read()).health;
  current='jacket';
  const bench=await page.evaluate(()=>window.__game.view.game.systems.placeables.all().find(p=>p.kind==='workbench'));
  await walk(bench.x+.5,bench.z+1.5,.15);await wait(s=>s.prompt==='Craft','workbench prompt');await press('KeyE');await click('[data-key="open-bench"]');await click('[data-key="armor"]');await shot('02-jacket-before');
  must(await page.locator('[data-key="make"]').isEnabled(),'Padded jacket unavailable during A bench of your own: '+await page.locator('.fm-why').innerText());
  await click('[data-key="make"]');await press('Escape');
  await wait(s=>s.flags['step.bench.jacket']===true,'jacket earned');await shot('03-jacket-made');await save('earned-jacket');must((await read()).gear.armor===2&&(await read()).health.maxHealth>healthBefore.maxHealth,'padding must increase actual maximum health');
  current='thistle-posts'; await make('post',3);
  for(let x=-8;x<=-3;x++){
    await walk(x+.5,-218.5,.2);await equip('post');await point(x,21,-220);record({type:'use-post',cell:[x,21,-220]});await press('KeyG');await page.mouse.click((await pointer(x,21,-220)).x,(await pointer(x,21,-220)).y);await press('KeyG');
    await page.waitForTimeout(300);
  }
  await wait(s=>s.flags['farm.quill.living']===true,'living quill farm');await shot('04-quill-farm');
  // Let one normal fox find finish before saving, so Continue cannot coincide with its nearly expired timer.
  current='checkpoint-fox-find';const seedCount=(await read()).bag.find(s=>s.id==='wheat_seeds')?.count??0;
  await wait(s=>(s.bag.find(v=>v.id==='wheat_seeds')?.count??0)>seedCount,'normal bonded fox seed before checkpoint',75000);
  // Posts and machine membership are read periodically. Save only after their ordinary reread.
  await page.waitForTimeout(2300);
  current='middle-Continue';const before=await save('middle-bench');
  record({type:'reload'});await page.reload();await page.waitForFunction(()=>!!window.__game);await observeScenes();await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(s=>s.started&&!s.player.busy,'Continue');
  const after=await save('middle-continued');
  for(const key of ['inventory','bench','placeables','settlement','quests'])must(JSON.stringify(before.game.systems[key])===JSON.stringify(after.game.systems[key]),key+' changed on Continue');
  const identity=s=>s.game.systems.pets.pets.map(({id,trust,bonded})=>({id,trust,bonded}));must(JSON.stringify(identity(before))===JSON.stringify(identity(after)),'companion identity/bond changed');
  must(JSON.stringify(before.world)===JSON.stringify(after.world),'world changed on Continue');
  await wait(s=>s.flags['farm.quill.living']===true&&s.flags['farm.moss.living']===true,'settled farms');await shot('05-middle-continued');
  current='gather-quills';const initial=(await read()).bag.find(s=>s.id==='quill')?.count??0;
  // The earned post farm produces quills in daylight. Bounded idle advancement only.
  for(let i=0;i<2400;i++){
    const loose=await page.evaluate(()=>window.__game.view.game.systems.machines.loose().filter(g=>g.item==='quill'));
    if(loose.length){const p=loose[0];await walk(p.x,p.z,.5);}
    if(((await read()).bag.find(s=>s.id==='quill')?.count??0)>initial)break;
    record({type:'noninteractive-wait-advance',seconds:1,reason:'earned thistle farm output'});await page.evaluate(()=>window.__game.advance(1));await page.waitForTimeout(10);
  }
  must(((await read()).bag.find(s=>s.id==='quill')?.count??0)>initial,'no quill collected from farm');await shot('06-quills-gathered');
  current='first-strip';await make('quill_strip');await press('KeyK');await click('[data-key="quill_strip"]');await click('[data-key="equip"]');await shot('07-equipped-strip');await press('Escape');
  await wait(s=>s.flags['quest.bench.done']===true&&s.flags['quest.copper.started']===true,'Copper available');await save('earned-bench');
  current='hedge-prerequisite';
  const bushes=await page.evaluate(()=>window.__game.view.game.systems.region.berryBushes().filter(b=>b.ripe));
  for(const b of bushes){if(((await read()).bag.find(s=>s.id==='berry')?.count??0)>=3)break;await walk(b.x,b.z,1);await press('KeyE');}
  await shot('08-hedge-prerequisites');await save('earned-before-hedge');
  // The grant's authored dry garden already has tilled soil. Irrigation was earned in the first night.
  for(const x of [18,19,20]){await walk(x+.5,-226,.3);await equip('berry');await point(x,21,-227);record({type:'plant-berry',cell:[x,21,-227]});const p=await pointer(x,21,-227);await page.mouse.click(p.x,p.y,{button:'right'});await page.waitForTimeout(200);}
  await wait(s=>s.flags['farm.seed.built']===true,'berry hedge built');await shot('09-hedge-planted');await save('earned-hedge');
  current='irrigate-hedge';await equip('spade');
  for(const z of [-228,-227]){await walk(16.5,z+.5,.3);await point(17,21,z);const p=await pointer(17,21,z);record({type:'dig-irrigation',cell:[17,21,z]});await page.mouse.click(p.x,p.y,{button:'right'});await page.waitForTimeout(700);}
  current='hedge-fruit-and-seeds';await walk(19,-225,.4);
  for(let i=0;i<4800;i++){
    const loose=await page.evaluate(()=>window.__game.view.game.systems.machines.loose().filter(g=>g.item==='carrot_seeds'));
    if(loose.length){const p=loose[0];await walk(p.x,p.z,.5);}
    if(((await read()).bag.find(s=>s.id==='carrot_seeds')?.count??0)>=8)break;
    if((await read()).talk)throw Error('unexpected dialogue while waiting for hedge');
    record({type:'noninteractive-wait-advance',seconds:1,reason:'wet earned berry hedge grows and bonded fox supplies carrot seed'});await page.evaluate(()=>window.__game.advance(1));await page.waitForTimeout(10);
  }
  must(((await read()).bag.find(s=>s.id==='carrot_seeds')?.count??0)>=8,'hedge did not supply eight carrot seeds');await shot('10-hedge-seeds');
  current='carrots';
  const cells=[[18,-229],[19,-229],[20,-229],[21,-229],[18,-228],[19,-228],[20,-228],[21,-228]];
  for(const [x,z] of cells){await walk(x+.5,-225.8,.4);await equip('carrot_seeds');await point(x,21,z);const p=await pointer(x,21,z);record({type:'plant-carrot',cell:[x,21,z]});await page.mouse.click(p.x,p.y,{button:'right'});await page.waitForTimeout(200);}
  await shot('11-bait-field');
  current='watch-burrowers';
  for(let i=0;i<2400;i++){const state=await read();if(state.talk||state.flags['step.copper.burrower'])break;record({type:'noninteractive-wait-advance',seconds:1,reason:'night approaches at earned dark carrot field'});await page.evaluate(()=>window.__game.advance(1));await page.waitForTimeout(10);}
  }
  if(!resumeGive){
  current='approach-choice';const homeChoice=await page.evaluate(()=>window.__game.view.game.systems.region.place('grant.center').at);await walk(homeChoice.x,homeChoice.z,3);
  await wait(s=>!!s.talk,'burrower choice');await shot('12-pre-choice');await save('earned-pre-choice');

  const choiceRaw=readFileSync(resolve(out,'earned-pre-choice.save.json'),'utf8');
  const choiceHash=createHash('sha256').update(choiceRaw).digest('hex');
  await page.context().close();
  for(const mode of ['take','give']){
    const fork=await browser.newContext({viewport:{width:1366,height:768}});page=await fork.newPage();
    await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=${quality}`);await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),choiceRaw);await page.reload();await page.waitForFunction(()=>!!window.__game);
    record({type:'import-earned-pre-choice',mode,sha256:choiceHash});await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(s=>s.started,'fork Continue');await wait(s=>!!s.talk,'choice restored');
    const goods=()=>page.evaluate(()=>{const s=window.__game.view.game.systems;return s.inventory.count('copper')+s.machines.loose().filter(g=>g.item==='copper').reduce((n,g)=>n+g.count,0)});const beforeGoods=await goods(),lump=(await read()).farms.find(f=>f.id==='copper').take;
    current='choice-'+mode;await settleDialogue(page);await click(mode==='take'?'[data-choice="1"]':'[data-choice="0"]');for(let i=0;i<10&&(await read()).talk;i++){await settleDialogue(page);await press('KeyE');}await wait(s=>!s.talk,'choice ended');await shot('13-'+mode);
    const result=await save('earned-'+mode),farm=result.game.systems.farms.farms.find(f=>f.id==='copper');
    must(Object.fromEntries(result.game.flags)['choice.burrowers']===mode,'dialogue choice missing');
    must(farm.mode===mode,'dialogue '+mode+' did not change actual copper farm mode');
    must(mode==='take'?farm.away>0:farm.away===0,'wrong farm absence consequence');
    if(mode==='take')must((await goods())===beforeGoods+lump,'wrong actual Take payout');
    record({type:'choice-consequences',mode,beforeGoods,afterGoods:await goods(),lump,farm,heartstone:(await read()).flags.heartstone});
    if(mode==='take')await fork.close();
  }
  }
  // Dax's earned watch job turns visitors back. Ask him to carry goods at a crafted chest while earning a pelt.
  current='dax-yard';await make('chest');await walk(-18.5,-221.5,.3);await equip('chest');await point(-19,21,-224);await press('KeyG');const chestPoint=await pointer(-19,21,-224);await page.mouse.click(chestPoint.x,chestPoint.y);await press('KeyG');
  must(await page.evaluate(()=>window.__game.view.game.systems.placeables.all().some(p=>p.kind==='chest')),'chest was not placed');
  await jobDax('yard',[-18,-222]);await shot('14-dax-yard');
  current='farm-goods-and-pelt';
  for(let i=0;i<12000;i++){
    if(i%300===0)console.log('farm waiting',i,(await read()).clock);
    const st=await read();if((st.bag.find(s=>s.id==='copper')?.count??0)>=4&&(st.bag.find(s=>s.id==='shed_pelt')?.count??0)>=1&&(st.bag.find(s=>s.id==='moss_fiber')?.count??0)>=3)break;
    const visitor=await page.evaluate(()=>window.__game.view.game.systems.fights.visitor());
    if(visitor){await walk(visitor.x,visitor.z,2);await calmVisitor();continue;}
    const loose=await page.evaluate(()=>{const s=window.__game.view.game.systems;return s.machines.loose().filter(g=>(g.item==='copper'&&s.inventory.count('copper')<4)||(g.item==='moss_fiber'&&s.inventory.count('moss_fiber')<3));});
    if(loose.length){await walk(loose[0].x,loose[0].z,.5);const home=await page.evaluate(()=>window.__game.view.game.systems.region.place('grant.center').at);await walk(home.x,home.z,3);continue;}
    record({type:'noninteractive-wait-advance',seconds:1,reason:'earned farms and normal night visitor'});await page.evaluate(()=>window.__game.advance(1));await page.waitForTimeout(10);
  }
  current='copper-binding';const bindingBench=await page.evaluate(()=>window.__game.view.game.systems.placeables.all().find(p=>p.kind==='workbench'));await walk(bindingBench.x+.5,bindingBench.z+1.5,.15);await wait(s=>s.prompt==='Craft','Craft prompt');await press('KeyE');await click('[data-key="open-bench"]');await click('[data-key="padded_grip"]');await shot('14-binding-before');await click('[data-key="make"]');await press('Escape');
  await wait(s=>s.flags['quest.copper.done']===true&&s.flags['quest.count.started']===true,'Gold on the arches available');
  must((await read()).gear.tier===2&&(await read()).gear.fitting==='padded_grip','actual copper gear');
  await shot('15-copper-gear');
  current='use-copper-grip';let usedGrip=false;const homeWait=await page.evaluate(()=>window.__game.view.game.systems.region.place('grant.center').at);await walk(homeWait.x,homeWait.z,3);
  for(let i=0;i<12000;i++){const visitor=await page.evaluate(()=>window.__game.view.game.systems.fights.visitor());if(visitor){await walk(visitor.x,visitor.z,2);await calmVisitor();usedGrip=true;break;}record({type:'noninteractive-wait-advance',seconds:1,reason:'ordinary home visitor to exercise copper grip'});await page.evaluate(()=>window.__game.advance(1));await page.waitForTimeout(10);}
  must(usedGrip,'no ordinary visitor for copper grip exercise');
  await jobDax('watch',[-23,-223]);
  current='return-home';const home=await page.evaluate(()=>window.__game.view.game.systems.region.place('grant.center').at);await walk(home.x,home.z,3);await wait(s=>s.flags['farm.moss.living']===true&&s.flags['farm.quill.living']===true&&s.flags['farm.copper.living']===true,'settled home farms');await shot('16-home');const final=await save('earned-copper');
  const flags=Object.fromEntries(final.game.flags);
  must(flags['quest.bench.done']===true&&flags['quest.copper.done']===true&&flags['quest.count.started']===true&&!flags['scene.22'],'exact quest boundary');
  must(final.game.systems.bench.armor===2&&final.game.systems.bench.made.includes('quill_strip'),'gear persistence');
  must(final.game.systems.pets.pets.some(p=>p.id==='pet:leaftail:1'&&p.bonded&&p.trust===3),'bond persistence');
  const baseline=JSON.parse(rawInput);
  if(!resume)for(const building of baseline.game.systems.placeables.placed)must(final.game.systems.placeables.placed.some(p=>JSON.stringify(p)===JSON.stringify(building)),'original building changed');

  must(!errors.length,errors.join('\n'));




  }
} catch(e) { failure=String(e.stack??e); console.error(current,failure); if(page) {await save('last-earned-checkpoint').catch(()=>{});await shot('failed').catch(()=>{});} }
finally {
  await browser?.close();
  if(server && server.exitCode===null) {server.kill();await new Promise(r=>server.once('exit',r));}
  writeFileSync(resolve(out,'replay.json'),JSON.stringify({status:failure?'BLOCKED':'PASS',sha,inputHash,current,failure,renderer:browser?.gameRenderer,errors,scenes,inputs,captures,framing,restoration,entries},null,2));
}
console.log(failure?'BLOCKED':'PASS bench copper input replay');process.exitCode=failure?1:0;
