// Earned saves remain unedited. Normal route mutates only through keyboard and save/Continue.
// Later diagnostics explicitly use teleport, clock, quality and a region stand-in.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launchChrome} from './lib/chrome.mjs';
import {CAMP} from '../src/game/content/region.ts';
import {clearCampTent} from '../src/game/region/ground.sim.ts';
const out=process.argv[2]??'.artifacts/camp-tent-repair/nov15-sol/input',dist=process.env.TENT_DIST??'dist-tent-verified';mkdirSync(out,{recursive:true});
const report={setup:'Unedited earned saves. Keyboard-only perimeter and sleep first; teleport/time/quality/region stand-in only in diagnostics.',runs:[],errors:[]};
const server=spawn('bun',['tools/serve.mjs',dist,'5563'],{stdio:['ignore','pipe','inherit']});let browser;
const local=(x,z)=>({x:CAMP.tent.x+Math.cos(.15)*x+Math.sin(.15)*z,z:CAMP.tent.z-Math.sin(.15)*x+Math.cos(.15)*z});
try {
 await new Promise((r,j)=>{server.stdout.on('data',b=>{if(/pid \d+/.test(String(b)))r()});server.on('exit',c=>j(Error('server '+c)))});
 browser=await launchChrome({args:['--disk-cache-size=1','--media-cache-size=1','--disable-gpu-shader-disk-cache']});report.renderer=browser.gameRenderer;
 for(const [name,path] of [['copper','.artifacts/copper-return-recovery/final-earned/earned-copper.save.json'],['gold','.artifacts/gold-arches-review/retry/final-home.save.json']]) {
 const raw=readFileSync(path,'utf8'),run={name,path,sha256:createHash('sha256').update(raw).digest('hex'),actions:[],diagnostics:[]};report.runs.push(run);
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:5563/');await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();
 const begin=async()=>{await page.waitForFunction(()=>!!window.__game);await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>window.__game.state().started&&!window.__game.state().player.busy)};await begin();
 const pos=()=>page.evaluate(()=>({...window.__game.view.game.player.pos}));
 const shot=async tag=>{const s=await page.evaluate(()=>({state:window.__game.state(),costs:window.__game.costs()}));writeFileSync(`${out}/${name}-${tag}.json`,JSON.stringify(s,null,2));await page.screenshot({path:`${out}/${name}-${tag}.png`});return s};
 const safe=async()=>{const p=await pos();assert.equal(clearCampTent({...p}),false,'hero intersects canvas');return p};
 const keysToward=target=>page.evaluate(t=>{const v=window.__game.view,p=v.game.player.pos,dx=t.x-p.x,dz=t.z-p.z,y=v.camera.yaw,f=-dx*Math.sin(y)-dz*Math.cos(y),r=dx*Math.cos(y)-dz*Math.sin(y);return [Math.abs(f)>.12?(f>0?'KeyW':'KeyS'):null,Math.abs(r)>.12?(r>0?'KeyD':'KeyA'):null].filter(Boolean)},target);
 const hold=async(keys,ms)=>{for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);for(const k of keys)await page.keyboard.up(k);return safe()};
 const walk=async(target,label)=>{for(let i=0;i<100;i++){const p=await pos();if(Math.hypot(p.x-target.x,p.z-target.z)<.45){run.actions.push({label,pos:p});return}await hold(await keysToward(target),100)}await shot('stalled-'+label);throw Error('walk stalled '+label+' '+JSON.stringify(await pos()))};
 await page.waitForFunction(()=>window.__game.view.hero.body.grounded);await shot('imported');await safe();
 // Both imports start near the canvas; go south before walking the rectangle clockwise.
 await walk(local(3.2,0),'clear-east-flank');await walk(local(3.2,3.2),'round-entrance-corner');await walk(local(0,3.2),'entrance');await shot('normal-entrance');
 for(const [i,[x,z]] of [[3.2,3.2],[3.2,0],[3.2,-3.4],[0,-3.4],[-3.2,-3.4],[-3.2,0],[-3.2,3.2],[0,3.2]].entries()) {await walk(local(x,z),'perimeter-'+i);await shot('normal-side-'+i)}
 // Sleep waits for the genuine clock if necessary. No clock write occurs in this section.
 await walk(CAMP.tentApproach,'sleep-approach');
 await page.waitForFunction(()=>window.__game.state().prompt==='Sleep in your tent' && window.__game.view.game.systems.time.canSleep(),null,{timeout:700000});
 const day=await page.evaluate(()=>window.__game.view.game.clock.day);await page.keyboard.press('KeyE');await page.waitForFunction(d=>window.__game.view.game.clock.day===d+1,day);await page.waitForFunction(()=>!window.__game.state().player.busy);await safe();await shot('normal-wake');
 await page.evaluate(()=>window.__game.save());await page.reload();await begin();await safe();await shot('normal-continued');run.normal='PASS';
 // Diagnostic fixtures are kept separate from the earned approach above.
 for(const q of ['low','medium','high','ultra'])for(const time of [.42,.8]){await page.evaluate(({q,time})=>{window.__game.view.settings.setQuality(q);window.__game.setTime(time)},{q,time});await shot(`diagnostic-${q}-${time}`)}
 // Sustained diagonal input must slide along the front instead of clearing tangential speed.
 await page.evaluate(p=>{window.__game.setCamera('free');window.__game.look(.15*180/Math.PI,35);window.__game.teleport(p.x,p.z)},local(-.8,2.35));await page.waitForFunction(()=>window.__game.view.hero.body.grounded);
 const slideStart=await pos();const slideEnd=await hold(['KeyW','KeyD'],650);
 const tangent=(slideEnd.x-slideStart.x)*Math.cos(.15)-(slideEnd.z-slideStart.z)*Math.sin(.15);
 run.slide={slideStart,slideEnd,tangent};await shot('diagnostic-slide');assert.ok(tangent>.6,'diagonal pressure did not slide along canvas');
 for(let i=0;i<8;i++){
 const angle=i*Math.PI/4, p=local(Math.sin(angle)*3.3,Math.cos(angle)*3.8);await page.evaluate(p=>window.__game.teleport(p.x,p.z),p);await page.waitForFunction(()=>window.__game.view.hero.body.grounded);
 const before=await pos(),keys=await keysToward(CAMP.tent);const contact=await hold(keys,1000);await shot('pressure-'+i);
 // Jump while pushing, checking the peak rather than the landing alone.
 for(const k of [...keys,'Space'])await page.keyboard.down(k);let peak=contact.y;for(let j=0;j<8;j++){await page.waitForTimeout(70);peak=Math.max(peak,(await safe()).y)}for(const k of [...keys,'Space'])await page.keyboard.up(k);assert.ok(peak>contact.y+.3,'jump lost against canvas');
 const awayKeys=await keysToward(p);await hold(awayKeys,700);const away=await pos();assert.ok(Math.hypot(away.x-CAMP.tent.x,away.z-CAMP.tent.z)>Math.hypot(contact.x-CAMP.tent.x,contact.z-CAMP.tent.z)+.3,'cannot walk away');
 run.diagnostics.push({i,before,contact,peak,away});
 }
 // Simulate a current region with no camp, including the sim callback. Restored immediately.
 await page.evaluate(t=>{const g=window.__game;window.__tentRegion=g.view.game.systems.region;g.view.game.systems.region={...window.__tentRegion,place(){throw Error('Unknown place: camp')}};g.teleport(t.x+.01,t.z)},CAMP.tent);
 await page.waitForTimeout(300);const absent=await pos();assert.ok(Math.hypot(absent.x-(CAMP.tent.x+.01),absent.z-CAMP.tent.z)<.1,'phantom camp collision');run.absentRegion=absent;await page.evaluate(()=>{window.__game.view.game.systems.region=window.__tentRegion});
 run.status='PASS';await page.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
 }
 assert.deepEqual(report.errors,[]);
}catch(e){report.failure=String(e.stack??e);console.error(report.failure);process.exitCode=1}
finally{await browser?.close();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r))}writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2))}
