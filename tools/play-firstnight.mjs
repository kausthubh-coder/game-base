// First night from an unedited earned landing save. Required actions use browser keys and mouse.
// PLAY_PORT=5559 bun tools/play-firstnight.mjs --save <earned.save.json> --out <new-directory>
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createKeyboardSteering } from './lib/keyboard-steering.mjs';
import { launchChrome } from './lib/chrome.mjs';
import { CONVERSATIONS } from '../src/game/content/dialogue.ts';
import { createHash } from 'node:crypto';
import { firstnightFrame, firstnightIssues, settleDialogue } from './lib/firstnight-framing.mjs';
const root = resolve(import.meta.dirname, '..');
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0 && (!process.argv[outIndex + 1] || process.argv[outIndex + 1].startsWith('--'))) {
  throw new Error('--out requires an evidence directory');
}
const out = resolve(root, outIndex >= 0 ? process.argv[outIndex + 1] : '.artifacts/first-night-input/run');
mkdirSync(out, { recursive: true });
if (existsSync(resolve(out, 'replay.json'))) throw Error('Choose a new --out directory to preserve prior evidence');
const port = Number(process.env.PLAY_PORT || 5559);
const dist = 'dist-firstnight';
const saveIndex = process.argv.indexOf('--save');
mustSave();
function mustSave() { if (saveIndex < 0 || !process.argv[saveIndex+1] || process.argv[saveIndex+1].startsWith('--')) throw Error('--save requires the unedited earned landing save'); }
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
const record = (action) => { inputs.push({ step: current, at: Date.now(), ...action }); };
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
 current=name;await wait(s=>!!s.talk,name+' begins');await shot(name);
 const expected = ({'08-shut-door':8,'10-door-opens':10,'11-mark':11,'12-custodian':12,'13-calm':13,'14-heart':14,'16-tamsin':15})[name];
 must((await read()).talk.scene===expected,'wrong entry scene');
 const incomingYaw=await page.evaluate(()=>window.__game.view.camera.yaw);
 const entry=await firstnightFrame(page);entries.push({name,frame:entry,issues:firstnightIssues(entry)});writeFileSync(resolve(out,name+'-entry-frame.json'),JSON.stringify(entry,null,2));
 await save(name + '-entry');
 for(let i=0;i<120;i++) {
  const s=await read(); if(!s.talk) {
   await settleDialogue(page);
   const restored = await page.evaluate(() => { const v=window.__game.view; return {busy:v.game.player.busy, yaw:v.camera.yaw, camera:{...v.ctx.camera.position}, player:{...v.game.player.pos}}; });
   must(!restored.busy, name+' controls still busy'); must(Math.abs(restored.yaw-incomingYaw)<.001,name+' camera heading not restored');
   const distance=Math.hypot(restored.camera.x-restored.player.x,restored.camera.y-restored.player.y,restored.camera.z-restored.player.z);
   must(distance>30,name+' camera still in dialogue close-up'); restoration.push({name,...restored}); return;
  }
  must(s.talk.scene===expected,'wrong dialogue scene');must(!s.talk.choices?.length,'unexpected choice');
  await settleDialogue(page);
  const frame=await firstnightFrame(page), issues=firstnightIssues(frame);
  const tag=name+'-line-'+String(i+1).padStart(2,'0');
  await page.screenshot({path:resolve(out,tag+'.png')});
  framing.push({tag,frame,issues});
  writeFileSync(resolve(out,tag+'.json'),JSON.stringify({frame,issues},null,2));
  // Record all lines even on a presentation failure, so diagnosis retains the whole conversation.
  await press('KeyE');
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
      const dx = t.x - p.x, dz = t.z - p.z;
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
  return JSON.parse(raw);
}
const pointer=(x,y,z)=>page.evaluate(([x,y,z])=>window.__game.view.project(x+.5,y+.99,z+.5),[x,y,z]);
async function point(x,y,z) {
 for(let turn=0;turn<4;turn++) {
  const at=await pointer(x,y,z);
  if(at) {
   record({type:'pointer',cell:[x,y,z],at});await page.mouse.move(at.x,at.y);await page.waitForTimeout(150);
   const aim=await page.evaluate(()=>{const a=window.__game.view.aim;return a&&[a.x,a.y,a.z]});
   if(JSON.stringify(aim)===JSON.stringify([x,y,z])) return;
  }
  await press('KeyQ');await page.waitForTimeout(800);
 }
 throw Error('pointer cannot reach '+[x,y,z]);
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
  await shot('00-landing');
  current='walk-to-plot';
  await walk(90,-210); await walk(20,-215); await walk(1,-226);
  await shot('01-pond');
  const survey=await page.evaluate(()=>{
    const g=window.__game.view.game, cells=[];
    for(let x=-32;x<=14;x++) for(let z=-250;z<=-218;z++) {
      const y=g.world.heightAt(x,z)-1;
      cells.push([x,y,z,g.world.getBlock(x,y,z)]);
    }
    return {cells,places:g.systems.region.places()};
  });
  writeFileSync(resolve(out,'survey.json'),JSON.stringify(survey,null,2));
  current='dig-water-connection';
  await walk(10,-227);
  await press('Digit2');
  for(let x=8;x<=17;x++) { const z=-229; await walk(x+.5,-227);
    await point(x,21,z);
    record({type:'mouse-click',button:'right',x,z}); await page.mouse.click((await pointer(x,21,z)).x,(await pointer(x,21,z)).y,{button:'right'});
    await page.waitForTimeout(600);
  }
  await shot('02-ditch-attempt');
  await wait(s=>s.flags['step.ground.ditch']===true,'water reaches the dry field',3000);
  current='middle-Continue';
  const before=await read(); await save('mid-ditch');
  const holesBefore=await page.evaluate(()=>window.__game.view.game.systems.machines.holes());
  record({type:'reload'});await page.reload();await page.waitForFunction(()=>!!window.__game);await observeScenes();
  await page.getByText('Carries on from your save.',{exact:true}).waitFor();
  record({type:'click',text:'Begin',intent:'middle Continue'});await page.getByRole('button',{name:'Begin',exact:true}).click();
  const after=await wait(s=>s.started&&!s.player.busy,'middle Continue');
  must(JSON.stringify(before.flags)===JSON.stringify(after.flags),'flags lost on Continue');
  must(JSON.stringify(before.bag)===JSON.stringify(after.bag),'inventory changed on Continue');
  must(JSON.stringify(holesBefore)===JSON.stringify(await page.evaluate(()=>window.__game.view.game.systems.machines.holes())),'ditch lost on Continue');
  await shot('03-ditch-continued');
  current='brambles';await press('Digit1');await walk(19,-223);
  for(const x of [20,19,18]) {
    await point(x,22,-225);record({type:'hold-mouse',button:'left',cell:[x,22,-225]});await page.mouse.down();
    await page.waitForFunction(x=>window.__game.view.game.world.getBlock(x,22,-225)===0,x,{timeout:5000});await page.mouse.up();
  }
  await wait(s=>s.flags['step.ground.brambles']===true,'brambles cleared');await shot('04-brambles');
  current='gather-camp-material';await walk(18,-224);await walk(18,-239);await walk(5,-239);
  const tree=await page.evaluate(()=>window.__game.view.game.systems.trees.all().find(t=>t.x===3&&t.z===-242));
  must(tree?.standing,'camp tree missing');
  await point(tree.x,tree.y,tree.z);
  record({type:'hold-mouse',button:'left',tree});await page.mouse.down();
  await page.waitForFunction(()=>!window.__game.view.game.systems.trees.all().find(t=>t.x===3&&t.z===-242)?.standing,null,{timeout:8000});await page.mouse.up();
  await shot('05-gathered');
  current='field-exit-return';await walk(18,-224);await shot('05-field-return');await walk(18,-239);await shot('05-field-outward');
  current='pitch-camp';await walk(0,-222);await walk(-16,-229);await walk(-17,-231);
  await wait(s=>s.prompt==='Pitch your tent (2 logs, 1 fiber)','tent prompt');await shot('06-tent-prompt');await press('KeyE');
  await wait(s=>s.flags['camp.pitched']===true,'tent pitched');await walk(-20,-228);
  await wait(s=>s.prompt==='Light your fire (1 log)','fire prompt');await press('KeyE');
  await wait(s=>s.flags['step.ground.camp']===true,'fire lit');await shot('07-camp');
  current='shut-door';await walk(-17,-250.5);await wait(s=>s.prompt==='Push the door','door prompt');await press('KeyE');await dialogue('08-shut-door');
  await wait(s=>s.flags['quest.ground.done']===true,'ground complete');
  current='wait-for-night';await walk(-20,-229);
  const preNight=await read();
  must(preNight.flags['quest.ground.done']===true,'all work must be earned before idle time');
  for(let seconds=0;seconds<900 && !(await read()).flags['night.fox'];seconds++) {
   record({type:'noninteractive-wait-advance',seconds:1,reason:'idle until dusk after all ground actions'});
   await page.evaluate(()=>window.__game.advance(1));await page.waitForTimeout(10);
  }
  await wait(s=>s.flags['night.fox']===true,'fox arrival');
  await shot('09-fox');
  await page.waitForFunction(()=>{const r=window.__game.view.root, c=r.querySelector('.sf-cinema');return r.classList.contains('sf-on') && c && Number(c.style.getPropertyValue('--sf-black')) < .05;},null,{timeout:15000});
  await shot('09-fox-after-fade');
  await wait(s=>!s.player.busy,'fox film ends',120000);
  current='retreat';await walk(-17,-250.5);await dialogue('10-door-opens');
  await wait(s=>s.flags['door.open']===true,'door opens');
  current='enter-hall';await walk(-17,-255);await dialogue('11-mark');
  const places=await page.evaluate(()=>Object.fromEntries(window.__game.view.game.systems.region.places().map(p=>[p.name,p.at])));
  current='custodian';await walk(places['hall.custodian'].x,places['hall.custodian'].z,.5);await wait(s=>s.prompt==='Turn the key','key prompt');await press('KeyE');await dialogue('12-custodian');
  current='calm-fox';const fox=await page.evaluate(()=>window.__game.view.game.systems.hall.fox());await walk(fox.x,fox.z,2.5);await wait(s=>s.prompt==='Hold out your hand','fox prompt');await press('KeyE');await dialogue('13-calm');
  current='heartstone';await walk(places['hall.heart'].x,places['hall.heart'].z,.5);await wait(s=>s.prompt==='Touch the Heartstone','heart prompt');await press('KeyE');await dialogue('14-heart');
  current='sleep';await walk(-17,-251);await walk(-17,-231);
  await wait(s=>s.prompt==='Sleep in your tent','sleep prompt');await press('KeyE');await wait(s=>s.flags['night.over']===true&&!s.player.busy,'wake',30000);await shot('15-morning');
  current='tamsin';await walk(places['grant.stone'].x,places['grant.stone'].z,2);await press('KeyE');await dialogue('16-tamsin');
  const end=await wait(s=>s.flags['quest.night.done']===true&&!s.player.busy&&!s.talk,'morning conversation ends');
  must(end.flags['night.told']===true,'morning not told');await save('earned-morning');await shot('17-earned-morning');
  for(let n=8;n<=15;n++) must(end.flags['scene.'+n]===true,'missing scene '+n);
  for(const n of [8,10,11,12,13,14,15]) must(scenes.filter(s=>s.scene===n).length===1,'scene not once-only: '+n);
  for(const flag of ['mark','glove','has.almanac','quest.ground.done','quest.night.done']) must(end.flags[flag]===true,'missing reward '+flag);
  must(end.flags.heartstone===1,'Heartstone reward');
  for(const id of ['axe','spade']) must(end.bag.find(s=>s.id===id)?.count===1,'tool reward '+id);
  for (const n of [8,10,11,12,13,14,15]) {
    const expected = CONVERSATIONS.find(c=>c.scene===n && !c.id.endsWith('.before')).lines.length;
    const settled = new Set(framing.filter(f=>f.frame.line.scene===n).map(f=>f.frame.line.text));
    const entry = entries.find(e=>e.frame.line.scene===n);
    // A short film line can finish during the intentional camera drift. Its retained entry is still an
    // observation of that line: require its bodies clear too, rather than silently skipping it.
    if (entry && !settled.has(entry.frame.line.text)) must(!entry.issues.length,`scene ${n}: opening line framing: ${entry.issues.join('; ')}`);
    const observed = new Set([...settled, ...(entry ? [entry.frame.line.text] : [])]).size;
    must(observed===expected,`scene ${n}: captured ${observed} of ${expected} distinct lines`);
  }
  must(!errors.length,errors.join('\n'));
  must(!framing.some(f=>f.issues.length), 'framing issues: '+framing.filter(f=>f.issues.length).map(f=>f.tag+': '+f.issues.join('; ')).join('\n'));


} catch(e) { failure=String(e.stack??e); console.error(current,failure); if(page) await shot('failed').catch(()=>{}); }
finally {
  await browser?.close();
  if(server && server.exitCode===null) {server.kill();await new Promise(r=>server.once('exit',r));}
  writeFileSync(resolve(out,'replay.json'),JSON.stringify({status:failure?'BLOCKED':'PASS',sha,inputHash,current,failure,renderer:browser?.gameRenderer,errors,scenes,inputs,captures,framing,restoration,entries},null,2));
}
console.log(failure?'BLOCKED':'PASS first night input replay');process.exitCode=failure?1:0;
