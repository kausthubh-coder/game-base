// Continue one raw earned outcome, checking persisted choices and rewards. No game-state writes after import.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launchChrome} from './lib/chrome.mjs';
const option=k=>{const i=process.argv.indexOf('--'+k);assert.ok(i>=0&&process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'--'+k+' required');return process.argv[i+1];};
const raw=readFileSync(resolve(option('save')),'utf8'),before=JSON.parse(raw),out=resolve(option('out'));
assert.ok(!existsSync(out)||!readdirSync(out).length,'Choose an empty output directory');mkdirSync(out,{recursive:true});
const inputHash=createHash('sha256').update(raw).digest('hex');
const port=Number(process.env.PLAY_PORT||5556),server=spawn('bun',['tools/serve.mjs','dist-bench-copper',String(port)],{stdio:['ignore','pipe','inherit']});
let browser,error,after,observed;
try {
 await new Promise((r,j)=>{server.stdout.on('data',b=>{if(/pid \d+/.test(String(b)))r();});server.on('exit',c=>j(Error('server exited '+c)));});
 browser=await launchChrome();const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=high`);await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();await page.waitForFunction(()=>!!window.__game);await page.getByRole('button',{name:'Begin',exact:true}).click();
 await page.waitForFunction(()=>window.__game.state().started&&!window.__game.state().player.busy);
 await page.waitForFunction(()=>window.__game.view.game.systems.farms.get('moss').living);
 await page.waitForTimeout(2500);
 const expectedHeart=Number(Object.fromEntries(before.game.flags).heartstone);
 await page.waitForFunction(level=>window.__game.state().flags.heartstone===level,expectedHeart);
 observed=await page.evaluate(()=>{const g=window.__game;return{state:g.state(),copper:g.view.game.systems.farms.get('copper'),actors:[...g.view.game.actors.values()].filter(a=>a.id.startsWith('farm:copper:')).map(a=>({id:a.id,visible:a.visible,pos:a.pos}))};});
 if(before.game.systems.farms.farms.find(f=>f.id==='copper').mode==='take'){assert.equal(observed.copper.rate,0);assert.equal(observed.copper.living,false);assert.ok(observed.actors.every(a=>!a.visible));}
 assert.ok(await page.evaluate(()=>window.__game.save()));const restored=await page.evaluate(()=>localStorage.getItem('greenhollow.save'));writeFileSync(resolve(out,'continued.save.json'),restored);after=JSON.parse(restored);
 for(const key of ['bench','placeables','quests'])assert.deepEqual(after.game.systems[key],before.game.systems[key],key);
 const priorSettlement={...before.game.systems.settlement},settled={...after.game.systems.settlement};
 // Settlement notices a newly selected Take on its ordinary periodic read, including after Continue.
 if(before.game.systems.farms.farms.some(f=>f.mode==='take')){assert.ok(settled.lastTake>=priorSettlement.lastTake&&settled.lastTake<=after.game.clock.day);delete settled.lastTake;delete priorSettlement.lastTake;}
 assert.deepEqual(settled,priorSettlement,'settled resident state');
 const modes=s=>s.game.systems.farms.farms.map(({id,mode,away,best})=>({id,mode,away,best}));assert.deepEqual(modes(before),modes(after));assert.deepEqual(before.world,after.world);
 const count=(s,id)=>s.game.systems.inventory.slots.filter(x=>x?.id===id).reduce((n,x)=>n+x.count,0);
 for(const id of ['shed_pelt','quill_strip','copper'])assert.equal(count(before,id),count(after,id),id);
 const copper=s=>count(s,'copper')+s.game.systems.machines.loose.filter(g=>g[0]==='copper').reduce((n,g)=>n+g[1],0);
 if(before.game.systems.farms.farms.find(f=>f.id==='copper').mode==='take')assert.equal(copper(before),copper(after),'Take paid twice');
 await page.waitForTimeout(300);await page.screenshot({path:resolve(out,'continued.png')});
} catch(e){error=String(e.stack??e);console.error(error);} finally {await browser?.close();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}}
writeFileSync(resolve(out,'audit.json'),JSON.stringify({status:error?'BLOCKED':'PASS',inputHash,error,observed,afterHash:after?createHash('sha256').update(readFileSync(resolve(out,'continued.save.json'))).digest('hex'):null},null,2));assert.ok(!error,error);console.log('PASS earned outcome Continue');
