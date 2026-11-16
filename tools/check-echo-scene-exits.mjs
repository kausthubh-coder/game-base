// Diagnostic presentation setup only: exact Gold import, disclosed teleport to stone,
// then real E / Escape / reload / Continue. This does not establish earned progression.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { launchChrome } from './lib/chrome.mjs';
const root=resolve(import.meta.dirname,'..'), out=resolve(process.argv[2]);
mkdirSync(out,{recursive:false});
const raw=readFileSync(resolve(root,'.artifacts/gold-arches-input/accepted-earned/earned-gold.save.json'),'utf8');
const hash=createHash('sha256').update(raw).digest('hex');
if(hash!=='22c1a54d698331f83a35d1a8d9c998a80b1825150b13d1d6ca38f07442fca043')throw Error('wrong fixture');
let server,browser;const results=[],errors=[];
const must=(x,why)=>{if(!x)throw Error(why)};
try {
 server=spawn('bun',['tools/serve.mjs','dist-echo-scenes','5569'],{cwd:root,stdio:['ignore','pipe','inherit']});
 await new Promise((done,fail)=>{server.stdout.on('data',b=>{if(/pid \d+/.test(String(b)))done()});server.on('exit',c=>fail(Error('server '+c)))});
 browser=await launchChrome();
 for(const quality of ['high','low']) for(const exit of ['skip','reload']) {
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text())});
  await page.goto('http://127.0.0.1:5569/?quality='+quality);
  await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);
  await page.reload();await page.waitForFunction(()=>!!window.__game);
  await page.getByRole('button',{name:'Begin',exact:true}).click();
  await page.waitForFunction(()=>window.__game.state().started&&!window.__game.state().player.busy);
  await page.evaluate(()=>window.__game.teleport(-19,undefined,-261.8));
  await page.waitForFunction(()=>window.__game.state().prompt==='Touch the dull stone');
  const before=await page.evaluate(async()=>{await window.__game.save();return JSON.parse(localStorage.getItem('greenhollow.save')).game.systems.pets});
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>window.__game.view.game.actors.has('stage:echo-fox'));
  await page.waitForTimeout(1000);await page.screenshot({path:resolve(out,quality+'-'+exit+'-memory.png')});
  if(exit==='skip') {
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!window.__game.view.game.actors.has('stage:echo-fox'));
  } else {
   await page.evaluate(()=>window.__game.save());await page.reload();
   await page.waitForFunction(()=>!!window.__game);
   await page.getByRole('button',{name:'Begin',exact:true}).click();
   await page.waitForFunction(()=>window.__game.state().started);
  }
  await page.waitForTimeout(1000);
  const after=await page.evaluate(async()=>{await window.__game.save();return {pets:JSON.parse(localStorage.getItem('greenhollow.save')).game.systems.pets,actors:[...window.__game.view.game.actors.values()].filter(a=>a.id==='stage:echo-fox'||a.id.startsWith('pet:'))}});
  must(!after.actors.some(a=>a.id==='stage:echo-fox'),'temporary fox leaked');
  must(before.pets.every(p=>after.actors.find(a=>a.id===p.id)?.visible),'present fox not restored');
  for(const pet of before.pets) {const now=after.pets.pets.find(p=>p.id===pet.id);for(const key of ['id','trust','bonded','bed'])must(now[key]===pet[key],'pet '+key+' changed')}
  results.push({quality,exit,before,after,setup:'Exact raw Gold import and debug teleport; real E then '+exit});
  await page.screenshot({path:resolve(out,quality+'-'+exit+'-after.png')});await page.close();
 }
 const middle=readFileSync(resolve(root,'.artifacts/echo-review/earned/middle-memory.save.json'),'utf8');
 const middleHash=createHash('sha256').update(middle).digest('hex');
 must(middleHash==='dd614cc03d03931a629c8296c9780c74f8280805b1817d54093afbb91222002d','wrong middle fixture');
 for(const quality of ['high','low']) {
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text())});
  await page.goto('http://127.0.0.1:5569/?quality='+quality);
  await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),middle);
  await page.reload();await page.waitForFunction(()=>!!window.__game);
  await page.getByRole('button',{name:'Begin',exact:true}).click();
  await page.waitForFunction(()=>window.__game.state().started&&!window.__game.state().player.busy);
  await page.waitForFunction(()=>window.__game.state().prompt==='Touch the stone again');
  const before=await page.evaluate(()=>window.__game.state());
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>!!window.__game.state().talk);
  for(let i=0;i<12;i++) {
   if(!await page.evaluate(()=>!!window.__game.state().talk))break;
   await page.keyboard.press('KeyE');await page.waitForTimeout(200);
  }
  const after=await page.evaluate(()=>({state:window.__game.state(),actors:[...window.__game.view.game.actors.keys()]}));
  must(!after.state.talk,'repeat did not end');
  must(!after.actors.includes('stage:echo-fox'),'repeat created a lasting memory fox');
  must(JSON.stringify(before.bag)===JSON.stringify(after.state.bag)&&before.flags.hearts===after.state.flags.hearts,'repeat duplicated reward');
  must(after.state.flags['vaults.marked'],'restored vault marks lost');
  results.push({quality,exit:'historical-middle-repeat',middleHash,before,after});
  await page.screenshot({path:resolve(out,quality+'-historical-middle-repeat.png')});await page.close();
 }
 must(!errors.length,errors.join('\n'));console.log('PASS skip and reload at high/low');
} finally {
 await browser?.close();if(server&&server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r))}
 writeFileSync(resolve(out,'exits.json'),JSON.stringify({hash,results,errors},null,2));
}
