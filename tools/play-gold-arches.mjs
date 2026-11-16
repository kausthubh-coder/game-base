// Gold on the arches from the exact earned copper boundary. All actions use browser input.
// PLAY_PORT=5559 bun tools/play-gold-arches.mjs --save <earned.save.json> --out <new-directory>
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
const dist = 'dist-bench-copper'; // Reuse only this completed, regenerable output.
const pumpChoice=process.argv.includes('--running')?'running':'crated';
const saveIndex = process.argv.indexOf('--save');
mustSave();
function mustSave() { if (saveIndex < 0 || !process.argv[saveIndex+1] || process.argv[saveIndex+1].startsWith('--')) throw Error('--save requires an unedited earned stage save'); }
const rawInput = readFileSync(resolve(root, process.argv[saveIndex+1]), 'utf8');
const inputHash = createHash('sha256').update(rawInput).digest('hex');
const continueEarned=process.argv.includes('--continue-earned');
const resumeFinal=process.argv.includes('--resume-final')||continueEarned;
const resumeNeeds=process.argv.includes('--resume-needs');
const resumeCounter=process.argv.includes('--resume-counter')||resumeNeeds;
const resumeHarvest=process.argv.includes('--resume-harvest')||resumeCounter;
const resumeCrops=process.argv.includes('--resume-crops');
const resumeField=process.argv.includes('--resume-field')||resumeCrops||resumeHarvest;
const resume=process.argv.includes('--resume-maren')||resumeField||resumeFinal;
if(continueEarned?inputHash!=='22c1a54d698331f83a35d1a8d9c998a80b1825150b13d1d6ca38f07442fca043':resumeFinal?inputHash!=='cf00d45dd7498cc3895d58b65008487b02aeed18fde477aa2712aa78891c2d0c':resumeNeeds?inputHash!=='d218c01d5d2cbe4f76e767a59c25cccdc0cd2f1fcdfde99df350b33dc6d51a0b':resumeCounter?inputHash!=='a0c7e9882cdf4a1bb61a9180714399dcc274330d6070b9899b606a3d435b7b21':resumeHarvest?inputHash!=='a3e34e2f8c3e23e120e29f3cf016a7713dace124a5ef3dded9f117ca4f47270d':resumeCrops?inputHash!=='3dfe665d5531429a942e10348822fe55717d3d576c747beec9f3be8a33de9bb3':resumeField?inputHash!=='1212e7b590199b16802583255152a2b228a57da54833071175c7cd40b3970897':resume?inputHash!=='0bed9db10191460fa89742620cdd77dbafdbe7c21e045563a52c697e7b22aca5':inputHash!=='261ba7810c560e828bf46bb38efc3f90163930707c454b54543d225c42b5b909')throw Error('requires exact unedited earned copper boundary');
mkdirSync(out, { recursive: true });
const qualityIndex = process.argv.indexOf('--quality');
const quality = qualityIndex < 0 ? 'high' : process.argv[qualityIndex + 1];

const runnerSha256=createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex');
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
  if(s.talk.choices?.length) {record({type:'choice',choice:pumpChoice});await press(pumpChoice==='running'?'Digit1':'Digit2');}
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
async function lightHome(){ current='light-the-home';await make('lantern');const home=await page.evaluate(()=>window.__game.view.game.systems.settlement.homes().find(h=>h.residents.includes('hobb')));must(home,'Hobb actual home');const x=Math.floor(home.door.x+2),z=Math.floor(home.door.z+1);await walk(x,z+2,.5);await equip('lantern');await point(x,21,z);await press('KeyG');const lamp=await pointer(x,21,z);await page.mouse.click(lamp.x,lamp.y);await press('KeyG');await shot('07-home-lamp');}
async function stockHome(){ const berries=await page.evaluate(()=>{const g=window.__game.view.game;return g.systems.region.berryBushes().filter(b=>b.ripe).sort((a,b)=>Math.hypot(a.x-g.player.pos.x,a.z-g.player.pos.z)-Math.hypot(b.x-g.player.pos.x,b.z-g.player.pos.z))});
 for(const b of berries){if((await read()).bag.filter(v=>v.id==='berry').reduce((n,v)=>n+v.count,0)>=6)break;await walk(b.x,b.z,1);await press('KeyE');}
 must((await read()).bag.filter(v=>v.id==='berry').reduce((n,v)=>n+v.count,0)>=6,'six legitimately gathered berries for the larder');
 const oven=await page.evaluate(()=>window.__game.view.game.systems.placeables.all().find(v=>v.kind==='oven'));await walk(oven.x+1,oven.z+3,.5);await wait(s=>/larder|Hobb|Eat/.test(s.prompt??''),'kitchen prompt');await press('KeyE');await press('KeyE');await shot('07-stocked-kitchen');
}
async function goPlace(id,dx=0,dz=0,near=1){const p=await page.evaluate(id=>window.__game.view.game.systems.region.place(id).at,id);await walk(p.x+dx,p.z+dz,near);return p;}
async function idleUntil(test,why,max=1800){for(let i=0;i<max;i++){if(await test())return;must(!(await read()).talk,'unexpected scene during '+why);must(!await page.evaluate(()=>window.__game.view.game.systems.fights.running()),'no accelerated combat');record({type:'noninteractive-wait-advance',seconds:1,reason:why});await page.evaluate(()=>window.__game.advance(1));await page.waitForTimeout(10);}throw Error('bounded wait exhausted '+why);}
async function continueSave(name,home=true){await press('Escape');await wait(s=>s.paused,'normal pause before checkpoint');const before=await save(name);await page.reload();await page.waitForFunction(()=>!!window.__game);await observeScenes();record({type:'public-save-observer',method:'__game.save',intent:'capture exact restored bytes after the Continue click, before the next frame'});await page.evaluate(()=>{document.addEventListener('click',()=>queueMicrotask(async()=>{await window.__game.save();window.__goldContinueRaw=localStorage.getItem('greenhollow.save')}),{once:true})});await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>!!window.__goldContinueRaw);const raw=await page.evaluate(()=>window.__goldContinueRaw);writeFileSync(resolve(out,name+'-continued.save.json'),raw);const after=JSON.parse(raw);record({type:'save-sha256',name:name+'-continued',sha256:createHash('sha256').update(raw).digest('hex')});await wait(s=>s.started&&!s.player.busy,'Continue');for(const key of ['inventory','bench','placeables','settlement','quests','goods','crops'])must(JSON.stringify(before.game.systems[key])===JSON.stringify(after.game.systems[key]),key+' changed on Continue');must(JSON.stringify(before.world)===JSON.stringify(after.world),'world changed on Continue');if(home)await wait(s=>s.flags.heartstone===Object.fromEntries(before.game.flags).heartstone&&['moss','quill','copper'].every(id=>s.flags['farm.'+id+'.living']),'settled home systems');await page.waitForFunction(level=>document.querySelector('.ui-heart-name')?.textContent?.startsWith('Heartstone '+level),Object.fromEntries(before.game.flags).heartstone);await page.waitForFunction(()=>!document.querySelector('.ui-heart')?.classList.contains('is-rising'));await shot(name+'-continued');}
try{
 if(!process.argv.includes('--no-build')){const b=spawn('bun',['x','vite','build','--outDir',dist,'--emptyOutDir','--logLevel','warn'],{cwd:root,stdio:'inherit'});must(await new Promise(r=>b.on('exit',r))===0,'build failed');}
 server=spawn('bun',['tools/serve.mjs',dist,String(port)],{cwd:root,stdio:['ignore','pipe','inherit']});await new Promise((done,fail)=>{server.stdout.on('data',b=>{if(/pid \d+/.test(String(b)))done()});server.on('exit',c=>fail(Error('server exited '+c)))});
 browser=await launchChrome();const context=await browser.newContext({viewport:{width:1366,height:768}});page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=${quality}`);record({type:'import-stage-boundary',path:process.argv[saveIndex+1],sha256:inputHash});await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),rawInput);await page.reload();await page.waitForFunction(()=>!!window.__game);await observeScenes();await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(s=>s.started&&!s.player.busy,'copper Continue');if(!resume)await wait(s=>s.flags.heartstone===2&&['moss','quill','copper'].every(id=>s.flags['farm.'+id+'.living']),'settled copper');if(resumeFinal){await page.waitForTimeout(2500);await page.waitForFunction(()=>window.__game.state().flags.heartstone===3&&document.querySelector('.ui-heart-name')?.textContent?.startsWith('Heartstone 3'));}await shot('00-copper');
 if(resumeFinal){await continueSave('final-home');await save('earned-gold');}else{
 if(!resume){current='road-to-Hollowmere';await goPlace('town',0,0,35);await shot('01-town');await goPlace('granary',0,1,1);await wait(s=>s.prompt==='Talk to Maren','Maren prompt');const before=await save('before-maren');await press('KeyE');await dialogue('22-maren');await wait(s=>s.flags['scene.22']===true,'Maren finished');const after=await save('after-maren');for(const [id,n] of [['wheat_seeds',12],['hoe',1],['watering_can',1]]){const count=v=>v.game.systems.inventory.slots.filter(v=>v?.id===id).reduce((n,v)=>n+v.count,0);must(count(after)-count(before)===n,'Maren gift '+id);}await shot('02-gifts');}
 if(!resumeNeeds){if(!resumeHarvest){current='sow-wheat';if(!resumeField){for(const [x,z] of [[150,-174],[137,-174],[126,-177],[92,-221]])await walk(x,z,1.5);await goPlace('grant.center',0,0,3);}
 // Till a fresh field by the camp. The copper garden and hedge remain intact.
 const cells=[];for(const [x,z] of [...Array.from({length:5},(_,x)=>[[x,-235],[x,-234]]).flat(),[0,-233],[1,-233]]){const y=await page.evaluate(([x,z])=>window.__game.view.game.world.heightAt(x,z)-1,[x,z]);cells.push([x,y,z]);}
 for(const [x,y,z] of cells){if(await page.evaluate(([x,y,z])=>window.__game.view.game.systems.crops.at(x,y,z)?.crop==='wheat',[x,y,z]))continue;await walk(x+.5,z+2,.3);await equip('hoe');await point(x,y,z);let p=await pointer(x,y,z);await page.mouse.click(p.x,p.y,{button:'right'});await equip('wheat_seeds');await point(x,y,z);p=await pointer(x,y,z);await page.mouse.click(p.x,p.y,{button:'right'});}
 must(await page.evaluate(()=>window.__game.view.game.systems.crops.all().filter(c=>c.state.crop==='wheat').length)>=12,'twelve wheat planted');await shot('03-sown');await continueSave('middle-farming');
 current='grow-wheat';
 for(let cycle=0;cycle<9;cycle++){
   for(const [x,y,z] of cells.filter(([x,,z])=>(x===1||x===4)&&z===-234)){await walk(x+.5,z+2,.3);await equip('watering_can');await point(x,y,z);const p=await pointer(x,y,z);await page.mouse.click(p.x,p.y,{button:'right'});}
   if(await page.evaluate(()=>window.__game.view.game.systems.crops.all().filter(c=>c.def.id==='wheat').every(c=>c.state.ripe)))break;
   await idleUntil(async()=>false,'watered wheat growth',150).catch(e=>{if(!String(e).includes('bounded wait exhausted'))throw e;});
 }
 await shot('04-grown');
 for(const [x,y,z] of cells){await walk(x+.5,z+2,.3);await point(x,y,z);const p=await pointer(x,y,z);await page.mouse.click(p.x,p.y);}
 must((await read()).flags['harvested.wheat']>=24,'earned wheat harvest');await shot('05-harvest');}
 current='granary-sales';if(!resumeCounter)for(const [x,z] of [[20,-230],[92,-221],[126,-177],[137,-174],[150,-174]])await walk(x,z,1.5);await goPlace('granary',2.5,0,.3);await wait(s=>s.prompt?.includes('Sell at the granary'),'granary counter');await press('KeyE');const saleBefore=await save('before-sale');await click('[data-key="sell10:wheat"]');const saleAfter=await save('after-sale');must((Object.fromEntries(saleAfter.game.flags).coin??0)-(Object.fromEntries(saleBefore.game.flags).coin??0)===20,'ten sacks pay twenty coin');must(saleAfter.game.systems.goods.taken.granary.wheat===10,'ten sacks counted toward daily cap');await click('[data-key="open-ledger"]');await click('[data-key="section:granary"]');await click('[data-key="deliver"]');await shot('06-ledger');await press('Escape');await wait(s=>s.flags['step.count.sow']===true,'sow sale pick');await continueSave('middle-ledger',false);
 current='feed-and-light-home';for(const [x,z] of [[150,-174],[137,-174],[126,-177],[92,-221]])await walk(x,z,1.5);await goPlace('grant.center',0,0,3);await stockHome();await lightHome();current='evening-road';await goPlace('arches',0,10);await idleUntil(async()=>(await read()).clock.timeOfDay>=.73,'ordinary dusk',1200);await goPlace('arches');await dialogue('23-relit');await shot('07-relit');
 current='next-morning';await goPlace('grant.center');
 await walk(-17,-231,.8);await wait(s=>s.prompt==='Sleep in your tent','home sleep');await press('KeyE');await wait(s=>!s.player.busy,'wake',30000);}
 if(resumeNeeds){await lightHome();await idleUntil(async()=>{const f=(await read()).flags;return !f['need.hobb.meal']&&!f['need.dax.meal']},'stocked larder waits for ordinary supper',1200);}
 await wait(s=>s.flags.heartstone===3,'earned Heartstone 3 after feeding everyone',30000);await save('earned-heartstone-three');await goPlace('arches');await shot('08-grey-road');await wait(s=>s.flags['step.count.grey']===true,'grey grass');await wait(async s=>s.flags['fight.5.won']||page.evaluate(()=>!!window.__game.view.game.systems.fights.running()),'lynx');await calmVisitor();await wait(s=>s.flags['fight.5.won']===true,'lynx victory',30000);await shot('09-victory');
 current='Gus-home';await goPlace('grant.center');await wait(s=>s.flags['quest.count.done']&&s.flags['quest.echo.started']&&!s.flags['scene.24'],'Gus roof and bed');const gus=await page.evaluate(()=>window.__game.view.game.systems.settlement.settler('gus'));must(gus?.home&&gus.needs?.bed!==false,'Gus actual home and bed');writeFileSync(resolve(out,'gus-home.json'),JSON.stringify(gus,null,2));await shot('10-home');await continueSave('final-home');await save('earned-gold');must(!errors.length,errors.join('\n'));}
}catch(e){failure=String(e.stack??e);console.error(current,failure);if(page){await save('last-earned-checkpoint').catch(()=>{});await shot('failed').catch(()=>{});}}
finally{await browser?.close();if(server&&server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r))}writeFileSync(resolve(out,'replay.json'),JSON.stringify({status:failure?'BLOCKED':resume?'RECOVERY':'PASS',sha,runnerSha256,inputHash,current,failure,errors,scenes,inputs,captures,framing,restoration,entries},null,2));}
console.log(failure?'BLOCKED':resume?'RECOVERY gold arches':'PASS gold arches');process.exitCode=failure?1:0;
