// Blessing and kitchen from an unedited earned morning save. Required actions use browser keys and mouse.
// PLAY_PORT=5559 bun tools/play-homestead.mjs --save <earned.save.json> --out <new-directory>
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
mkdirSync(out, { recursive: true });
const port = Number(process.env.PLAY_PORT || 5559);
const dist = 'dist-homestead';
const pumpChoice=process.argv.includes('--running')?'running':'crated';
const saveIndex = process.argv.indexOf('--save');
mustSave();
function mustSave() { if (saveIndex < 0 || !process.argv[saveIndex+1] || process.argv[saveIndex+1].startsWith('--')) throw Error('--save requires an unedited earned stage save'); }
const rawInput = readFileSync(resolve(root, process.argv[saveIndex+1]), 'utf8');
const inputHash = createHash('sha256').update(rawInput).digest('hex');
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
  return { ...state, opening: { stage: o.stage(), hero: o.hero(), ask: o.asking(), bout: o.bout() } };
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
 const expected=({'16-blessing':16,'17-custodian':17,'18-hobb-dax':18,'19-thistlehog-calm':19})[name];
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
async function place(id,x,y,z){
 if(await page.evaluate(id=>window.__game.view.game.systems.placeables.all().some(p=>p.kind===id),id))return;
 await walk(x+.5,z+3.5,.3);await equip(id);await point(x,y,z);await press('KeyG');await page.waitForTimeout(200);
 record({type:'build-preview',id,cell:[x,y,z],plan:await page.evaluate(()=>window.__game.view.game.systems.build.plan())});
 const at=await pointer(x,y,z);record({type:'place-mouse',id,cell:[x,y,z],mode:'build'});await page.mouse.click(at.x,at.y);await page.waitForTimeout(500);await press('KeyG');
 await page.waitForFunction(id=>window.__game.view.game.systems.placeables.all().some(p=>p.kind===id),id,{timeout:3000});

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
  await shot('00-earned-morning');
  if(process.argv.includes('--guidance-only')){
    current='calm-guidance';await press('KeyJ');await shot('calm-guidance');
    must(await page.getByText('Hold the left button to attack. When its guard breaks, hold F nearby to calm it.',{exact:true}).isVisible(),'calming key is missing from the current quest guidance');
    await press('Escape');
  } else {
  const places=await page.evaluate(()=>Object.fromEntries(window.__game.view.game.systems.region.places().map(p=>[p.name,p.at])));
  if(!(await read()).flags['quest.blessing.done']) {
  current='blessing';for(let turn=0;turn<Number(process.env.INCOMING_TURNS||0);turn++)await press('KeyQ');await walk(places['grant.stone'].x,places['grant.stone'].z,2);
  await dialogue('16-blessing');
  await wait(s=>!!s.talk,'pump choice');await dialogue('pump-choice');
  await wait(s=>s.flags['choice.pump']===pumpChoice,'choice persisted');
  const pump=await page.evaluate(()=>window.__game.view.game.systems.goods.pump());
  writeFileSync(resolve(out,'pump.json'),JSON.stringify(pump,null,2));
  must(pump.running===(pumpChoice==='running'),'pump actual state');
  await shot('pump-'+pumpChoice);
  if(pumpChoice==='running') {
    await walk(pump.at.x,pump.at.z,2);
    await wait(s=>!!s.prompt?.includes('pump'),'running pump interaction');
    await shot('running-pump-interaction');
    must((await read()).flags.heartstone===0,'running pump Heartstone consequence');
  }
  for(let turn=0;turn<Number(process.env.INCOMING_TURNS||0);turn++)await press('KeyR');
  current='custodian';await walk(-17,-250.5);await dialogue('17-custodian');
  await wait(s=>s.flags['quest.blessing.done']===true,'blessing complete');
  await save('earned-blessing-'+pumpChoice);
  }
  if(pumpChoice==='crated'&&!process.argv.includes('--blessing-only')) {
    if(!(await read()).flags['scene.18']) {
    current='hobb-arrival';await walk(-17,-245);await walk(places['grant.stone'].x,places['grant.stone'].z,2);await dialogue('18-hobb-dax');
    await save('earned-arrival');
    }
    if(!await ownedAll(['oven','prep_table','cottage','watch_post','fence'])) {
    current='gather';await press('Digit1');
    // Read trees to locate harvestable trunks; all gathering remains a held mouse action.
    for(let n=0;n<40;n++){
      if((await read()).bag.find(s=>s.id==='fiber')?.count>=21)break;
      const tree=await page.evaluate(()=>{const g=window.__game.view.game;return g.systems.trees.all().filter(t=>t.standing&&!t.protected&&t.x<10&&t.z<-190&&t.z>-300).sort((a,b)=>Math.hypot(a.x-g.player.pos.x,a.z-g.player.pos.z)-Math.hypot(b.x-g.player.pos.x,b.z-g.player.pos.z))[0]});
      must(tree,'harvestable tree');
      let aimed=false;
      for(const [dx,dz] of [[2,2],[-2,2],[2,-2],[-2,-2]]){
        try{
          const stand=await page.evaluate(([x,y,z])=>window.__game.view.game.systems.nav.near({x,y,z},3),[tree.x+dx,tree.y,tree.z+dz]);
          must(stand,'no standing position beside tree');await walk(stand.x,stand.z,.2);
          for(const height of [3.5,5.5,.99]){try{await point(tree.x,tree.y,tree.z,height);aimed=true;break;}catch(error){record({type:'tree-aim-height',height,error:String(error)});}}
          if(aimed)break;}catch(error){record({type:'occluded-tree-approach',tree,dx,dz,error:String(error)});}
      }
      must(aimed,'tree cannot be aimed from four approaches');record({type:'hold-mouse',button:'left',tree});await page.mouse.down();
      await page.waitForFunction(([x,z])=>!window.__game.view.game.systems.trees.all().find(t=>t.x===x&&t.z===z)?.standing,[tree.x,tree.z],{timeout:12000});await page.mouse.up();console.log('harvested',tree.x,tree.z);
    }
    await shot('gathered-wood');await save('earned-materials');
    current='craft-workbench';await walk(0,-222);
    const boards=(await read()).bag.find(s=>s.id==='plank')?.count??0;
    if(boards<100)await make('plank',Math.ceil((100-boards)/4),true);
    if(!await page.evaluate(()=>window.__game.view.game.systems.placeables.all().some(p=>p.kind==='workbench'))){await make('workbench',1,true);await place('workbench',-2,21,-224);}
    // Dig earth outside the watered field. The spade and axe remain earned tools.
    current='gather-earth';await equip('spade');
    for(let x=-27;x<=-10;x++)for(const z of [-222,-221]){
      if(((await read()).bag.find(s=>s.id==='dirt')?.count??0)>=18)continue;
      await walk(x+.5,z+1.5,.5);const y=await page.evaluate(([x,z])=>window.__game.view.game.world.heightAt(x,z)-1,[x,z]);
      if(await page.evaluate(([x,y,z])=>window.__game.view.game.systems.region.isProtected(x,y,z),[x,y,z]))continue;
      await point(x,y,z);record({type:'dig',cell:[x,y,z]});await page.mouse.down();
      await page.waitForFunction(([x,y,z])=>window.__game.view.game.world.getBlock(x,y,z)===0,[x,y,z],{timeout:6000});await page.mouse.up();
    }
    await walk(-2,-222);
    current='craft-buildings';for(const id of ['oven','prep_table','cottage','watch_post','fence'])if(!await ownedAll([id]))await make(id);
    }
    await place('oven',-14,21,-243);await place('prep_table',-11,21,-243);await walk(-13,-240);await shot('kitchen-built');
    await place('cottage',-24,21,-243);await walk(-22,-240);await shot('roof-and-beds');await place('watch_post',-24,21,-226);
    await shot('construction');await save('earned-construction');
    current='mossling-observation';await walk(places['grant.rocks'].x,places['grant.rocks'].z,3);
    await wait(s=>s.flags['step.kitchen.mosslings']===true,'watch mosslings',30000);await shot('mosslings-observed');
    // Existing damp stone is already shaded by the pond canopy; a fence makes a pen.
    await place('fence',10,21,-230);
    await wait(s=>s.flags['farm.moss.built']===true&&s.flags['farm.moss.living']===true,'living moss farm',5000);await shot('moss-farm');
    await save('earned-farm');
    current='rooms';for(const [who,job,target] of [['hobb','The kitchen',[-13,-240]],['dax','The watch',[-23,-223]]]){
      if((await read()).flags['choice.'+who])continue;
      const at=await page.evaluate(who=>window.__game.view.game.actors.get('npc:'+who)?.pos,who);must(at,'settler actor '+who);
      await walk(at.x,at.z,.3);await wait(s=>s.prompt==='Talk to '+(who==='hobb'?'Hobb':'Dax'),'resident prompt '+who,3000);await press('KeyE');await shot(who+'-card');await click(`[data-job="${who==='hobb'?'kitchen':'watch'}"]`);
      const button=page.getByRole('button',{name:new RegExp('Walk '+(who==='hobb'?'Hobb':'Dax')+' to')});record({type:'assign-job',who,job});await button.click();
      await walk(...target);await wait(s=>!!s.flags['choice.'+who],who+' takes room',15000);
      if((await read()).talk)await dialogue(who+'-job');
    }
    current='middle-Continue';const before=await save('mid-construction');record({type:'reload'});await page.reload();await page.waitForFunction(()=>!!window.__game);await observeScenes();
    await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(s=>s.started&&!s.player.busy,'Continue');
    const after=await save('mid-continued');
    must(JSON.stringify(before.game.flags)===JSON.stringify(after.game.flags),'flags changed on Continue');
    for(const key of ['inventory','placeables','settlement','quests'])must(JSON.stringify(before.game.systems[key])===JSON.stringify(after.game.systems[key]),key+' changed on Continue');
    must(JSON.stringify(before.world)===JSON.stringify(after.world),'world edits changed on Continue');
    const modes=save=>save.game.systems.farms.farms.map(f=>({id:f.id,mode:f.mode,away:f.away,best:f.best}));
    must(JSON.stringify(modes(before))===JSON.stringify(modes(after)),'farm choices changed on Continue');await shot('continued');
    if(!(await read()).flags['step.kitchen.meal']){
    current='meal';const ovenDoor=await page.evaluate(()=>{const g=window.__game.view.game,p=g.systems.placeables.all().find(p=>p.kind==='oven'),d=g.systems.placeables.defs().find(d=>d.kind==='oven');const [sx,sy,sz]=p.quarterTurns&1?[d.size[2],d.size[1],d.size[0]]:d.size;const t=p.quarterTurns&3;return{x:p.x+sx/2+(t===1?1:t===3?-1:0)*(sx/2+1),z:p.z+sz/2+(t===0?-1:t===2?1:0)*(sz/2+1)};});await walk(ovenDoor.x,ovenDoor.z,.15);await wait(s=>s.prompt==="Eat Hobb's cooking",'meal prompt');await press('KeyE');await shot('meal');
    }
    await save('earned-before-thistlehog');
    current='wait-for-thistlehog-night';
    must((await read()).flags['step.kitchen.meal']===true,'meal earned before idle wait');
    for(let i=0;i<1200;i++){
      const state=await read();if(state.clock.timeOfDay>=.75||state.clock.timeOfDay<.25)break;
      record({type:'noninteractive-wait-advance',seconds:1,reason:'idle after earned homestead actions until night encounter'});
      await page.evaluate(()=>window.__game.advance(1));await page.waitForTimeout(10);
    }
    current='thistlehog';const den=fightPlace(2);await walk(den.x,den.z,3);
    if((await read()).talk){await dialogue('19-thistlehog-before');await walk(den.x,den.z,3);}
    await page.waitForFunction(()=>window.__fights?.state()?.n===2,{timeout:10000});
    await shot('thistlehog-start');
    let broke=false;
    try {
      for(let i=0;i<1200;i++){
        const fight=await page.evaluate(()=>window.__fights.state());
        if(!fight||fight.over>=0)break;
        const beast=fight.beasts.find(b=>b.doing!=='calmed');if(!beast)break;
        record({type:'combat-observation',fight});
        const p=await page.evaluate(([x,z])=>window.__game.view.project(x,window.__game.view.game.player.pos.y+.3,z),[beast.x,beast.z]);
        if(p)await page.mouse.move(p.x,p.y);
        const distance=Math.hypot(beast.x-fight.hero.x,beast.z-fight.hero.z);
        const held=[];
        if(distance>2){
          const yaw=await page.evaluate(()=>window.__game.view.camera.yaw),dx=beast.x-fight.hero.x,dz=beast.z-fight.hero.z;
          const forward=-dx*Math.sin(yaw)-dz*Math.cos(yaw),right=dx*Math.cos(yaw)-dz*Math.sin(yaw);
          for(const key of [forward>.5?'KeyW':forward<-.5?'KeyS':null,right>.5?'KeyD':right<-.5?'KeyA':null].filter(Boolean)){record({type:'down',key});await page.keyboard.down(key);held.push(key);}
        }
        if(beast.guard<=0){if(!broke){await shot('thistlehog-guard-broken');broke=true;}await page.mouse.up();await page.keyboard.down('KeyF');record({type:'down',key:'KeyF'});}
        else{await page.keyboard.up('KeyF');await page.mouse.down();record({type:'down',button:'left'});}
        await page.waitForTimeout(100);
        for(const key of held){record({type:'up',key});await page.keyboard.up(key);}
      }
    }finally{await page.mouse.up();for(const key of ['KeyF','KeyW','KeyA','KeyS','KeyD'])await page.keyboard.up(key);}
    must(broke,'guard break observed');await wait(s=>s.flags['fight.2.won']===true,'thistlehog calmed',10000);
    if((await read()).talk)await dialogue('19-thistlehog-calm');
    await wait(s=>s.flags['quest.kitchen.done']===true&&s.flags['scene.19']===true,'earned kitchen completion');
    await shot('earned-homestead');
    must((await read()).flags['quest.greywood.started']===true,'grey wood available');
    must((await read()).flags.heartstone===2,'earned Heartstone 2');
    await save('earned-homestead');

  }
  }
  const end=await read();
  if(!process.argv.includes('--guidance-only'))for(const n of pumpChoice==='running'||process.argv.includes('--blessing-only')?[16,17]:[16,17,18,19])must(end.flags['scene.'+n]===true,'scene missing '+n);
  for(const n of [16,17,18,19])must(scenes.filter(s=>s.scene===n).length<=1,'scene repeated '+n);
  must(!end.talk&&!end.player.busy,'controls released at end');
  must(!framing.some(f=>f.issues.length),'framing issues: '+framing.filter(f=>f.issues.length).map(f=>f.name+' '+f.i+': '+f.issues.join('; ')).join('\n'));
  must(!errors.length,errors.join('\n'));

} catch(e) { failure=String(e.stack??e); console.error(current,failure); if(page) {await save('last-earned-checkpoint').catch(()=>{});await shot('failed').catch(()=>{});} }
finally {
  await browser?.close();
  if(server && server.exitCode===null) {server.kill();await new Promise(r=>server.once('exit',r));}
  writeFileSync(resolve(out,'replay.json'),JSON.stringify({status:failure?'BLOCKED':'PASS',sha,inputHash,current,failure,renderer:browser?.gameRenderer,errors,scenes,inputs,captures,framing,restoration,entries},null,2));
}
console.log(failure?'BLOCKED':'PASS homestead input replay');process.exitCode=failure?1:0;
