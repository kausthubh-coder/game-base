import { requireBetaHash } from './lib/beta-chain.mjs';
// Grey wood from an unedited earned morning save. Required actions use browser keys and mouse.
// PLAY_PORT=5559 bun tools/play-greywood.mjs --save <earned.save.json> --out <new-directory>
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
const dist = 'dist-greywood';
const pumpChoice=process.argv.includes('--running')?'running':'crated';
const saveIndex = process.argv.indexOf('--save');
mustSave();
function mustSave() { if (saveIndex < 0 || !process.argv[saveIndex+1] || process.argv[saveIndex+1].startsWith('--')) throw Error('--save requires an unedited earned stage save'); }
const rawInput = readFileSync(resolve(root, process.argv[saveIndex+1]), 'utf8');
const inputHash = createHash('sha256').update(rawInput).digest('hex');
requireBetaHash(inputHash, 'bbfc0fce50f455acf3699ab04f3a328398585d398a372f3988c69f85fd23e9c3', 'home');
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
  await shot('00-earned-homestead');
  const baseline=JSON.parse(rawInput);
  must((await read()).flags['quest.greywood.step']==='follow','starts at forest travel');
  await page.waitForTimeout(2200);
  const fox=await page.evaluate(()=>[...window.__game.view.game.actors.values()].filter(a=>a.visible&&/fox|leaftail/.test(a.id+ a.sprite)));
  record({type:'fox-cue',actors:fox});must(fox.some(a=>a.id==='pet:leaftail:1'),'fox cue actor absent');await shot('01-fox-cue');
  const den=await page.evaluate(()=>window.__game.view.game.systems.region.place('foxes').at);const boar=await page.evaluate(()=>window.__game.view.game.systems.region.place('boar').at);current='forest-travel';await walk(boar.x,boar.z,10);
  await dialogue('20-wren');
  await wait(s=>s.flags['scene.20']===true,'Wren meeting completed');
  // Save before combat, while the fox pack is unfinished. No fight state is supplied on reload.
  current='middle-Continue';const before=await save('middle-forest');
  record({type:'reload'});await page.reload();await page.waitForFunction(()=>!!window.__game);await observeScenes();
  await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(s=>s.started,'Continue');
  const after=await save('middle-continued');
  for(const key of ['inventory','placeables','settlement','quests','pets'])must(JSON.stringify(before.game.systems[key])===JSON.stringify(after.game.systems[key]),key+' changed on Continue');
  must(JSON.stringify(before.world)===JSON.stringify(after.world),'world changed on Continue');
  await shot('02-continued-forest');
  current='fox-pack';await walk(den.x,den.z,8);await page.waitForFunction(()=>window.__fights?.state()?.n===3,{timeout:15000});await shot('03-pack-start');
  let assisted=false,broke=false,target=-1;
  try {
    for(let i=0;i<1800;i++){
      const fight=await page.evaluate(()=>window.__fights.state());
      if(!fight||fight.over>=0)break;
      record({type:'combat-observation',fight});
      assisted ||= fight.companion==='wren';
      if(target<0||fight.beasts[target]?.doing==='calmed')target=fight.beasts.findIndex(b=>b.doing!=='calmed');
      const beast=fight.beasts[target];if(!beast)break;
      if(i%100===0)await press('KeyC');
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
  must(assisted,'Wren assistance absent');
  await wait(s=>s.flags['fight.3.won']===true,'pack calmed');await shot('05-pack-calmed');await save('earned-pack');
  current='boar-denial';await wait(s=>!!s.talk,'boar introduction');await dialogue('21-boar-before');await walk(boar.x,boar.z,8);await page.waitForFunction(()=>window.__fights?.state()?.n===4,{timeout:15000});await shot('06-boar');
  for(let i=0;i<200;i++){
    const f=await page.evaluate(()=>window.__fights.state());if(!f||f.over>=0)break;
    const b=f.beasts[0],dx=b.x-f.hero.x,dz=b.z-f.hero.z,d=Math.hypot(dx,dz),held=[];
    if(d>2){const yaw=await page.evaluate(()=>window.__game.view.camera.yaw),fw=-dx*Math.sin(yaw)-dz*Math.cos(yaw),rt=dx*Math.cos(yaw)-dz*Math.sin(yaw);
      for(const key of [fw>.4?'KeyW':fw<-.4?'KeyS':null,rt>.4?'KeyD':rt<-.4?'KeyA':null].filter(Boolean)){await page.keyboard.down(key);record({type:'down',key});held.push(key);}}
    await page.keyboard.down('KeyF');record({type:'down',key:'KeyF',intent:'offer Mark to boar'});await page.waitForTimeout(100);for(const key of held)await page.keyboard.up(key);
  }await page.keyboard.up('KeyF');
  await wait(s=>s.flags['fight.4.denied']===true,'boar intended denial');must(!(await read()).flags['fight.4.won'],'boar must remain uncalmed');
  await dialogue('21-not-yet');await wait(s=>s.flags['quest.greywood.done']===true&&s.flags['quest.bench.started']===true,'bench quest available');await shot('07-bonded');
  current='home-return';const home=await page.evaluate(()=>window.__game.view.game.systems.region.place('grant.center').at);await walk(home.x,home.z,3);await shot('08-home');
  const final=await save('earned-greywood');
  for(const key of ['placeables','settlement'])must(JSON.stringify(baseline.game.systems[key])===JSON.stringify(final.game.systems[key]),key+' did not persist away');
  must(JSON.stringify(baseline.world)===JSON.stringify(final.world),'home world edits lost');
  must(final.game.flags.heartstone===baseline.game.flags.heartstone,'legitimate Heartstone changed');
  const modes=s=>s.game.systems.farms.farms.map(f=>({id:f.id,mode:f.mode,away:f.away,best:f.best}));must(JSON.stringify(modes(baseline))===JSON.stringify(modes(final)),'farm choices changed');
  const pets=await page.evaluate(()=>window.__game.view.game.systems.pets.all());record({type:'final-pets',pets});must(pets.some(p=>p.kind==='leaftail'&&p.bonded),'bonded leaftail missing');
  const end=await read();for(const n of [20,21]){must(end.flags['scene.'+n]===true,'scene missing '+n);must(scenes.filter(s=>s.scene===n).length===1,'scene count '+n);}
  must(!end.talk&&!end.player.busy,'controls released');must(!errors.length,errors.join('\n'));
  must(!framing.some(f=>f.issues.length),'framing issues: '+framing.filter(f=>f.issues.length).map(f=>f.name+': '+f.issues.join('; ')).join('\n'));
} catch(e) { failure=String(e.stack??e); console.error(current,failure); if(page) {await save('last-earned-checkpoint').catch(()=>{});await shot('failed').catch(()=>{});} }
finally {
  await browser?.close();
  if(server && server.exitCode===null) {server.kill();await new Promise(r=>server.once('exit',r));}
  writeFileSync(resolve(out,'replay.json'),JSON.stringify({status:failure?'BLOCKED':'PASS',sha,inputHash,current,failure,renderer:browser?.gameRenderer,errors,scenes,inputs,captures,framing,restoration,entries},null,2));
}
console.log(failure?'BLOCKED':'PASS greywood input replay');process.exitCode=failure?1:0;
