// Diagnostic fixture. Raw earned saves are imported unchanged; teleport/time are disclosed setup.
// Approaches and sleep use real keyboard input. This does not replay earning the saves.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launchChrome} from './lib/chrome.mjs';
import {CAMP} from '../src/game/content/region.ts';
import {clearCampTent} from '../src/game/region/ground.sim.ts';
const out=process.argv[2]??'.artifacts/camp-tent-repair/approach';mkdirSync(out,{recursive:true});
const server=spawn('bun',['tools/serve.mjs',process.env.TENT_DIST??'dist-tent-verified','5563'],{stdio:['ignore','pipe','inherit']});
let browser;const report={setup:'Unedited earned saves; debug teleport and time; keyboard approaches and E sleep.',runs:[],errors:[]};
try {
 await new Promise((r,j)=>{server.stdout.on('data',b=>{if(/pid \d+/.test(String(b)))r()});server.on('exit',c=>j(Error('server '+c)))});
 browser=await launchChrome({args:["--disk-cache-size=1","--media-cache-size=1","--disable-gpu-shader-disk-cache"]});report.renderer=browser.gameRenderer;
 for(const [name,path] of [['copper','.artifacts/copper-return-recovery/final-earned/earned-copper.save.json'],['gold','.artifacts/gold-arches-review/retry/final-home.save.json']]) {
  const raw=readFileSync(path,'utf8'),run={name,path,sha256:createHash('sha256').update(raw).digest('hex'),sides:[]};report.runs.push(run);
  const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto('http://127.0.0.1:5563/');await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();
  const begin=async()=>{await page.waitForFunction(()=>!!window.__game);await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>window.__game.state().started&&!window.__game.state().player.busy)};await begin();
  const shot=async tag=>{const state=await page.evaluate(()=>({state:window.__game.state(),costs:window.__game.costs()}));writeFileSync(`${out}/${name}-${tag}.json`,JSON.stringify(state,null,2));await page.screenshot({path:`${out}/${name}-${tag}.png`});return state};
  await shot('imported');await page.evaluate(t=>{window.__game.setTime(.42);window.__game.teleport(t.x,t.z)},CAMP.tent);
  await page.waitForFunction(t=>Math.hypot(window.__game.view.game.player.pos.x-t.x,window.__game.view.game.player.pos.z-t.z)>1.8,CAMP.tent);await shot('legacy-center');
  for(let side=0;side<8;side++) {
   const a=side*Math.PI/4+CAMP.tent.rotation,x=CAMP.tent.x+Math.sin(a)*4,z=CAMP.tent.z+Math.cos(a)*4;
   await page.evaluate(({x,z})=>window.__game.teleport(x,z),{x,z});
   for(let step=0;step<12;step++) {
    const keys=await page.evaluate(t=>{const v=window.__game.view,p=v.game.player.pos,dx=t.x-p.x,dz=t.z-p.z,y=v.camera.yaw,f=-dx*Math.sin(y)-dz*Math.cos(y),r=dx*Math.cos(y)-dz*Math.sin(y);return [Math.abs(f)>.35?(f>0?'KeyW':'KeyS'):null,Math.abs(r)>.35?(r>0?'KeyD':'KeyA'):null].filter(Boolean)},CAMP.tent);
    for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(100);for(const k of keys)await page.keyboard.up(k);
    const p=await page.evaluate(()=>({...window.__game.view.game.player.pos}));assert.equal(clearCampTent(p),false,`${name} side ${side} intersects`);
   }
   run.sides.push((await shot('side-'+side)).state.player);
  }
  await page.evaluate(t=>window.__game.teleport(t.x,t.z),CAMP.tentApproach);
  for(const q of ['low','medium','high','ultra']) {await page.evaluate(q=>window.__game.view.settings.setQuality(q),q);await shot('quality-'+q)}
  await page.evaluate(()=>window.__game.setTime(.8));await shot('night');await page.waitForFunction(()=>window.__game.state().prompt==='Sleep in your tent');
  const day=await page.evaluate(()=>window.__game.view.game.clock.day);await page.keyboard.press('KeyE');await page.waitForFunction(day=>window.__game.view.game.clock.day===day+1,day);await page.waitForFunction(()=>!window.__game.state().player.busy);await shot('wake');
  await page.keyboard.press('Escape');await page.evaluate(()=>window.__game.save());writeFileSync(`${out}/${name}-wake.save.json`,await page.evaluate(()=>localStorage.getItem('greenhollow.save')));
  await page.reload();await begin();const continued=await shot('continued');assert.equal(clearCampTent({...continued.state.player}),false);assert.equal(continued.state.flags['camp.pitched'],true);run.status='PASS';await page.close();
 }
 assert.deepEqual(report.errors,[]);
} catch(e){report.failure=String(e.stack??e);console.error(report.failure);process.exitCode=1}
finally {await browser?.close();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r))}writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2))}
