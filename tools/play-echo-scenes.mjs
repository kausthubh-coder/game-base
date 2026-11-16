// Bounded presentation regression from the historical unedited Gold boundary.
// Retains the original Echo runner's real movement, memory, map and repeat inputs.
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
const dist = 'dist-echo-scenes'; // Reuse only this completed, regenerable output.
const pumpChoice=process.argv.includes('--running')?'running':'crated';
const saveIndex = process.argv.indexOf('--save');
mustSave();
function mustSave() { if (saveIndex < 0 || !process.argv[saveIndex+1] || process.argv[saveIndex+1].startsWith('--')) throw Error('--save requires an unedited earned stage save'); }
const rawInput = readFileSync(resolve(root, process.argv[saveIndex+1]), 'utf8');
const inputHash = createHash('sha256').update(rawInput).digest('hex');
if(inputHash!=='22c1a54d698331f83a35d1a8d9c998a80b1825150b13d1d6ca38f07442fca043')throw Error('requires exact unedited earned Gold boundary');
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
  if (name === '24-memory' && frame.line.scene === 24) {
   const fox = frame.actors.find(a => a.id === 'stage:echo-fox');
   must(fox?.source === 'memory-stage' && fox.sprite === 'fox' && fox.inFrame, 'independent past fox must be visible');
   const companion = await page.evaluate(() => [...window.__game.view.game.actors.values()].filter(a=>a.id.startsWith('pet:')).map(a=>({id:a.id,visible:a.visible})));
   must(companion.every(a=>!a.visible), 'present companion must not impersonate the memory fox');
  }
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
async function continueSave(name,home=true){await press('Escape');await wait(s=>s.paused,'normal pause before checkpoint');const before=await save(name);await page.reload();await page.waitForFunction(()=>!!window.__game);await observeScenes();record({type:'public-save-observer',method:'__game.save',intent:'capture exact restored bytes after the Continue click, before the next frame'});await page.evaluate(()=>{document.addEventListener('click',()=>queueMicrotask(async()=>{await window.__game.save();window.__goldContinueRaw=localStorage.getItem('greenhollow.save')}),{once:true})});await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>!!window.__goldContinueRaw);const raw=await page.evaluate(()=>window.__goldContinueRaw);writeFileSync(resolve(out,name+'-continued.save.json'),raw);const after=JSON.parse(raw);record({type:'save-sha256',name:name+'-continued',sha256:createHash('sha256').update(raw).digest('hex')});await wait(s=>s.started&&!s.player.busy,'Continue');for(const key of ['inventory','bench','placeables','settlement','quests','goods','crops','ruins'])must(JSON.stringify(before.game.systems[key])===JSON.stringify(after.game.systems[key]),key+' changed on Continue');must(JSON.stringify(before.world)===JSON.stringify(after.world),'world changed on Continue');for(const [key,value] of before.game.flags)if(/^(shrine\.|choice\.dinner|dinner\.|scene\.|memory\.|vaults\.|keystone\.|job\.)/.test(key))must(Object.fromEntries(after.game.flags)[key]===value,key+' changed on Continue');const friendship=v=>v.game.systems.people.people.map(p=>[p.id,p.friendship]);must(JSON.stringify(friendship(before))===JSON.stringify(friendship(after)),'friendships changed on Continue');if(home)await wait(s=>s.flags.heartstone===Object.fromEntries(before.game.flags).heartstone&&['moss','quill','copper'].every(id=>s.flags['farm.'+id+'.living']),'settled home systems');await page.waitForFunction(level=>document.querySelector('.ui-heart-name')?.textContent?.startsWith('Heartstone '+level),Object.fromEntries(before.game.flags).heartstone);await page.waitForFunction(()=>!document.querySelector('.ui-heart')?.classList.contains('is-rising'));await shot(name+'-continued');}
async function importRaw(raw) {
 await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=${quality}`);
 await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();await page.waitForFunction(()=>!!window.__game);await observeScenes();
 await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(s=>s.started&&!s.player.busy,'Continue');
}
try {
 if(!process.argv.includes('--no-build')){const b=spawn('bun',['x','vite','build','--outDir',dist,'--emptyOutDir','--logLevel','warn'],{cwd:root,stdio:'inherit'});must(await new Promise(r=>b.on('exit',r))===0,'build failed');}
 server=spawn('bun',['tools/serve.mjs',dist,String(port)],{cwd:root,stdio:['ignore','pipe','inherit']});await new Promise((done,fail)=>{server.stdout.on('data',b=>{if(/pid \d+/.test(String(b)))done()});server.on('exit',c=>fail(Error('server exited '+c)))});
 browser=await launchChrome();const context=await browser.newContext({viewport:{width:1366,height:768}});page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text())});
 record({type:'import-stage-boundary',path:process.argv[saveIndex+1],sha256:inputHash});await importRaw(rawInput);await wait(s=>s.flags.heartstone===3&&['moss','quill','copper'].every(id=>s.flags['farm.'+id+'.living']),'settled Gold');must(!(await read()).flags['scene.24'],'memory unplayed');await shot('00-boundary');
 current='walk-to-stone';await walk(-19,-261.8,.15);await page.waitForTimeout(2000);must(!(await read()).talk,'memory waits for interaction');await shot('01-stone-before');await wait(s=>s.prompt==='Touch the dull stone','stone prompt');await press('KeyE');await dialogue('24-memory');await dialogue('vault-marks');await wait(s=>s.flags['vaults.marked'],'three marks earned');await press('KeyM');await page.waitForTimeout(1200);const pins=await page.evaluate(()=>JSON.parse(localStorage.getItem('greenhollow.map')).pins);writeFileSync(resolve(out,'vault-pins.json'),JSON.stringify(pins,null,2));must(['pumphouse','lampgallery','seedvault'].every(id=>pins.some(p=>p.id===id&&p.kind==='vault')),'three unvisited vault pins');await shot('02-vault-map');await press('Escape');
 const repeatBefore=await save('before-repeat');await walk(-19,-261.8,.15);await wait(s=>s.prompt==='Touch the stone again','repeat prompt');await press('KeyE');await dialogue('memory-repeat');const repeatAfter=await save('after-repeat');must(JSON.stringify(repeatBefore.game.systems.inventory)===JSON.stringify(repeatAfter.game.systems.inventory),'repeat memory gives no duplicate items');must(Object.fromEntries(repeatBefore.game.flags).hearts===Object.fromEntries(repeatAfter.game.flags).hearts,'repeat memory gives no duplicate hearts');must(scenes.filter(s=>s.scene===24).length===1,'initial memory plays once');await continueSave('middle-memory',false);const restoredPins=await page.evaluate(()=>JSON.parse(localStorage.getItem('greenhollow.map')).pins);must(['pumphouse','lampgallery','seedvault'].every(id=>restoredPins.some(p=>p.id===id)),'markers survive Continue');

 const finalPets = (await save('presentation-final')).game.systems.pets;
 const originalPets = JSON.parse(rawInput).game.systems.pets;
 for (const pet of originalPets.pets) {
  const now = finalPets.pets.find(p=>p.id===pet.id);
  must(now && now.bed===pet.bed && now.trust===pet.trust && now.bonded===pet.bonded, 'companion identity and bond preserved');
 }
 must(await page.evaluate(() => !window.__game.view.game.actors.has('stage:echo-fox') && [...window.__game.view.game.actors.values()].filter(a=>a.id.startsWith('pet:')).every(a=>a.visible)), 'temporary cast cleaned after completion, repeat and Continue');
 must(!errors.length, errors.join('\n'));
 must(!framing.some(f=>f.issues.length), 'framing failures: '+JSON.stringify(framing.filter(f=>f.issues.length).map(f=>({name:f.name,i:f.i,issues:f.issues}))));
}catch(e){failure=String(e.stack??e);console.error(current,failure);if(page){await save('last-earned-checkpoint').catch(()=>{});await shot('failed').catch(()=>{});}}
finally{await browser?.close();if(server&&server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r))}writeFileSync(resolve(out,'replay.json'),JSON.stringify({status:failure?'BLOCKED':'PASS',sha,sourceDiffSha256,runnerSha256,inputHash,current,failure,errors,scenes,inputs,captures,framing,restoration,entries},null,2));}
console.log(failure?'ISSUES':'PASS Echo scenes');process.exitCode=failure?1:0;
