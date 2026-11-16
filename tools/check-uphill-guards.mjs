// Diagnostic only. Separate from all earned-route evidence.
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {launchChrome} from './lib/chrome.mjs';
import {sample,canStartHeavy} from './resource-status.mjs';
import {stopPumpChild} from './play-uphill.mjs';
const opt=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1]};
const out=resolve(opt('out','.artifacts/uphill-combined/guards')),dist=opt('dist','dist-uphill-combined'),port=opt('port','5580');
mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'tested-runner.mjs'),readFileSync(import.meta.filename));
let browser,server;const rows=[],errors=[];
try{
 const s=await sample();if(!canStartHeavy(s,0))throw Error('resource denied');
 server=spawn('bun',['tools/serve.mjs',dist,port],{stdio:['ignore','pipe','inherit']});
 await new Promise((ok,no)=>{server.stdout.on('data',b=>{if(/pid \d+/.test(String(b)))ok()});server.once('exit',no)});
 const b=await sample();if(!canStartHeavy(b,0))throw Error('browser denied');browser=await launchChrome();
 for(const quality of ['high','low']){
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
 await page.goto('http://127.0.0.1:'+port+'/?quality='+quality);
 await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),readFileSync('.artifacts/uphill-input/attempt-14/middle-pit.save.json','utf8'));await page.reload();await page.waitForFunction(()=>!!window.__game);await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>window.__game.started&&!window.__game.state().player.busy);
 for(const place of (process.argv.includes('--underground')?['gallery']:['pit','hall.heart','hall.door','lampgallery'])){
 if(place==='gallery'){await page.evaluate(()=>{const g=window.__game;g.teleport('lampgallery');g.give('lantern',1)});await page.waitForTimeout(600);await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__game.view.game.systems.ruins.view().room==='gallery');}
 else if(place!=='pit')await page.evaluate(p=>{const g=window.__game;g.skipTo('night');if(!g.teleport(p))throw Error('diagnostic place unavailable '+p);if(g.view.game.systems.talk.active)g.view.game.systems.talk.skip()},place);
 for(const mode of ['tilt','free','first']){
 await page.evaluate(m=>window.__game.setCamera(m),mode);await page.waitForTimeout(800);
 const row=await page.evaluate(()=>{const g=window.__game,v=g.view,c=v.ctx.camera,actual=c.clone();v.camera.update(0,v.ctx);const delta=actual.position.distanceTo(c.position);const expected={position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov};c.copy(actual);c.updateMatrixWorld();return{camera:g.state().camera,feet:{...v.playerPosition},ground:v.groundAt(v.playerPosition.x,v.playerPosition.z),delta,expected,sight:g.sight()}});
 row.name=quality+'-'+place+'-'+mode;rows.push(row);
 if((mode!=='tilt'||place==='gallery')&&row.delta>0.02)errors.push(row.name+' lens displaced '+row.delta);
 
 if(place==='pit'&&mode!=='first'){
 const targets=await page.evaluate(()=>{const v=window.__game.view,p=v.playerPosition;return [[2,0],[0,2],[-2,0],[0,-2]].map(([dx,dz])=>{const x=Math.floor(p.x)+dx,z=Math.floor(p.z)+dz,y=v.world.sim.heightAt(x,z)-1;return{x,y,z,at:v.project(x+.5,y+1,z+.5)}}).filter(t=>t.at&&t.at.x>100&&t.at.x<1200&&t.at.y>150&&t.at.y<600)});
 let matched=false;row.aimSamples=[];
 for(const t of targets){await page.mouse.move(t.at.x,t.at.y);await page.waitForTimeout(100);const aim=await page.evaluate(()=>window.__game.state().aim);row.aimSamples.push({target:t,aim});if(aim&&aim.x===t.x&&aim.z===t.z)matched=true;}
 if(!matched)errors.push(row.name+' no projected ground target agrees with ordinary mouse aim');
 }
await page.screenshot({path:resolve(out,row.name+'.png')});
 if(place==='pit'&&mode==='tilt'&&quality==='high'){
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 await page.waitForTimeout(2000);const profile=await cdp.send('Profiler.stop');writeFileSync(resolve(out,'label-cpu-profile.json'),JSON.stringify(profile));await cdp.detach();
 }

 }
 }
 await page.evaluate(()=>window.__game.setCamera('tilt'));await page.keyboard.press('Escape');await page.close();
 }
}finally{await browser?.close();await stopPumpChild(server);writeFileSync(resolve(out,'report.json'),JSON.stringify({rows,errors},null,2));}
if(errors.length)process.exitCode=1;
