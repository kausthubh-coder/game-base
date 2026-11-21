// Targeted ordinary-input proof from preserved earned camp bytes. No supplied time or rewards.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { digest, verifyRuntime } from './lib/beta-chain.mjs';
import { installReplayDriver } from './workflow/replay.mjs';
import { sample, canStartHeavy } from './resource-status.mjs';
import { CAMP } from '../src/game/content/region.ts';
const args = process.argv.slice(2);
function option(name) { const i=args.indexOf(name); if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw Error(name+' requires a value');return args[i+1]; }
const out=resolve(option('--out')),dist=option('--dist'),manifest=option('--manifest'),save=resolve(option('--save')),port=option('--port'),activeHeavyJobs=Number(option('--active-heavy-jobs')); 
mkdirSync(out);const raw=readFileSync(save,'utf8');
const report={scope:'targeted camp dusk diagnostic from unedited earned checkpoint',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtime:dist,manifestSHA:digest(readFileSync(manifest)),input:{path:save,sha256:digest(raw)},events:[],inputs:[],captures:[],resources:[]};
const persist=()=>writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));
let browser,server,page,monitor,pending=Promise.resolve();
const read=()=>page.evaluate(()=>({...window.__game.state(),health:window.__game.view.game.systems.fights.hero()}));
async function wait(test,why,limit=15000){const until=Date.now()+limit;while(Date.now()<until){const s=await read();if(test(s))return s;await page.waitForTimeout(100);}throw Error('timed out: '+why);}
async function press(key){report.inputs.push({key,at:Date.now()});await page.keyboard.press(key);await page.waitForTimeout(120);}
async function shot(name){await page.screenshot({path:resolve(out,name+'.png')});report.captures.push({name,state:await read()});persist();console.log('captured '+name);}
async function observe(){await page.evaluate(()=>{for(const name of['slept','waited','item.gained','scene.played','flag.changed'])window.__game.view.game.events.on(name,data=>window.__campObserved({name,data}));});}
try{
 verifyRuntime(dist,manifest);const resources=await sample();report.resources.push(resources);if(!canStartHeavy(resources,activeHeavyJobs))throw Error('resource admission held');
 monitor=setInterval(()=>{pending=pending.then(async()=>{report.resources.push(await sample());persist();});},30000);
 server=spawn('bun',['tools/serve.mjs',dist,port],{stdio:['ignore','pipe','inherit']});report.serverPID=server.pid;
 await new Promise((done,fail)=>{server.stdout.on('data',b=>{/pid \d+/.test(String(b))&&done()});server.on('error',fail);});
 browser=await launchChrome();page=await browser.newPage({viewport:{width:1366,height:768}});await page.exposeFunction('__campObserved',e=>report.events.push(e));await page.goto('http://127.0.0.1:'+port+'/?seed=41&quality=high');await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();await page.waitForFunction(()=>!!window.__game);await observe();await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(s=>s.started&&!s.player.busy,'Continue');
 if(!(await read()).flags['quest.ground.done']){
  await wait(s=>s.prompt==='Push the door','normal door prompt');await press('KeyE');await wait(s=>!!s.talk,'door dialogue');
  for(let i=0;i<30&&(await read()).talk;i++){await page.waitForFunction(()=>!document.querySelector('.gb-dialogue-untyped')?.textContent);await press('KeyE');}
  await wait(s=>s.flags['quest.ground.done']&&!s.player.busy,'door completed');
 }
 await page.exposeFunction('__replayInput',async(key,down)=>{const code={w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',shift:'ShiftLeft',space:'Space'}[key];report.inputs.push({key:code,down});await page.keyboard[down?'down':'up'](code);});await page.evaluate(installReplayDriver,{mode:'realtime'});
 for(const[x,z]of[[-12,-236],[-12,-227],[CAMP.fire.x,CAMP.fire.z]]){const result=await page.evaluate(({x,z})=>window.__replay.walk({x,y:22,z},{within:.3,seconds:30,authored:true}),{x,z});if(!result.ok)throw Error(JSON.stringify(result));}
 await wait(s=>s.prompt==='Wait until dusk','campfire wait prompt');await shot('01-wait-until-dusk');
 const before=await read(),eventStart=report.events.length;await press('KeyE');await wait(s=>s.flags['night.fox']===true,'first night begins');await shot('02-dusk-start');await wait(s=>!s.player.busy,'fox film normal completion',120000);await shot('03-dusk-complete');
 const after=await read(),events=report.events.slice(eventStart);
 if(after.clock.day!==before.clock.day||after.clock.timeOfDay<.73||after.flags['night.over'])throw Error('wait acted like sleep or missed dusk');
 if(events.filter(e=>e.name==='waited').length!==1||events.some(e=>e.name==='slept'||e.name==='item.gained'))throw Error('wait repeated, slept or gave items');
 if(JSON.stringify(after.bag)!==JSON.stringify(before.bag)||after.health.health!==before.health.health)throw Error('wait changed bag or healed');
 await page.reload();await page.waitForFunction(()=>!!window.__game);const saved=await page.evaluate(()=>localStorage.getItem('greenhollow.save'));writeFileSync(resolve(out,'normal-pagehide.save.json'),saved);await observe();await page.getByRole('button',{name:'Begin',exact:true}).click();await wait(s=>s.started&&!s.player.busy,'dusk Continue');await page.waitForTimeout(1500);await shot('04-continued');const continued=await read();
 if(continued.clock.day!==before.clock.day||!continued.flags['night.fox']||continued.flags['night.over']||continued.prompt==='Wait until dusk'||continued.player.busy)throw Error('Continue repeated or lost dusk state');
 if(report.events.filter(e=>e.name==='flag.changed'&&e.data.flag==='night.fox'&&e.data.value===true).length!==1||!continued.flags['scene.9']||report.events.some(e=>e.name==='slept'))throw Error('first-night film repeated or sleep emitted');
 if(digest(readFileSync(save))!==report.input.sha256)throw Error('starting checkpoint changed');
 report.status='PASS';report.before=before;report.after=after;report.continued=continued;report.pagehideSHA=digest(saved);persist();console.log('PASS ordinary campfireE reaches same-day dusk once, no sleep/items/heal, Continue preserved');
}catch(error){report.status='FAILED';report.error=String(error.stack??error);persist();if(page)await shot('failed').catch(()=>{});throw error;}
finally{clearInterval(monitor);await pending;await browser?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('close',r));}persist();}
