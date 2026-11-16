// Diagnostic recovery only. Preserved old primary cells supply the unregistered trench.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {launchChrome} from './lib/chrome.mjs';
import {cameraStill} from './play/wait.mjs';
import {sample,canStartHeavy} from './resource-status.mjs';
const [url,directory]=process.argv.slice(2);if(!url||!directory)throw Error('Supply runtime URL and new output directory');
const out=resolve(directory);if(existsSync(out))throw Error('Output exists');mkdirSync(out,{recursive:true});
const save=(name,data)=>writeFileSync(resolve(out,name),JSON.stringify(data,null,2));
const admission=await sample();save('admission.json',admission);assert(canStartHeavy(admission,1));
const oldPath='.artifacts/irrigation-blocker/primary.json',landingPath='.artifacts/grantday-framing-review/input/earned-landing.save.json';
const oldRaw=readFileSync(oldPath,'utf8'),raw=readFileSync(landingPath,'utf8'),old=JSON.parse(oldRaw);
writeFileSync(resolve(out,'original-diagnostic.json'),oldRaw);writeFileSync(resolve(out,'original-landing.save.json'),raw);
save('input-provenance.json',{diagnosticOnly:true,oldPath,landingPath,oldHash:createHash('sha256').update(oldRaw).digest('hex'),landingHash:createHash('sha256').update(raw).digest('hex'),setup:'Load unchanged earned landing; reproduce old primary diagnostic air cells without holes; supply ten dirt representing old primary drops and position beside bank. Recovery uses browser keys/mouse. This is not earned replay.'});
const browser=await launchChrome(),inputs=[],errors=[];let page,failure;
const monitor=setInterval(async()=>{save('resource-'+Date.now()+'.json',await sample());},30000);
try{
 page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url+'?seed=41&quality=high');await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();await page.waitForFunction(()=>!!window.__game);
 await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>window.__game.started&&!window.__game.state().player.busy);
 await page.evaluate(async cells=>{const g=window.__game;g.teleport(8.5,22,-227.5);await g.settle();for(const c of cells)g.view.game.world.setBlock(c.x,c.y,c.z,c.after);g.view.game.systems.inventory.add('dirt',10);g.teleport(8.5,22,-227.5);g.setCamera('first');g.view.settings.setMouse('drag');},old.cells);
 assert(await page.evaluate(()=>window.__game.view.game.systems.machines.holes().length===0));
 await page.evaluate(()=>window.__game.save());writeFileSync(resolve(out,'legacy-diagnostic.save.json'),await page.evaluate(()=>localStorage.getItem('greenhollow.save')));
 const point=async(x,y,z)=>{await page.evaluate(([x,y,z])=>{const g=window.__game;g.setCamera('first');g.view.keys.setMouse('drag');g.aimAt(x+.5,y+.99,z+.5);},[x,y,z]);await cameraStill(page);await page.mouse.move(683,384);await page.waitForFunction(([x,y,z])=>{const a=window.__game.view.aim;return a?.x===x&&a.y===y&&a.z===z;},[x,y,z],{timeout:3000});inputs.push({point:[x,y,z],aim:await page.evaluate(()=>window.__game.view.aim)});};
 for(const c of old.cells){
  // Positioning is disclosed fixture diagnosis; placement and digging are actual UI actions.
  await page.evaluate(x=>window.__game.teleport(x+.5,22,-227.5),c.x);await page.keyboard.press('Digit3');await point(c.x,20,c.z);
  inputs.push({action:'right-click-place',cell:c});await page.mouse.click(683,384,{button:'right'});
  await page.waitForFunction(c=>window.__game.view.game.world.getBlock(c.x,c.y,c.z)!==0,c,{timeout:4000});
  await page.screenshot({path:resolve(out,'placed-'+c.x+'.png')});
  await page.keyboard.press('Digit2');await point(c.x,21,c.z);inputs.push({action:'left-hold-spade',cell:c});await page.mouse.down({button:'left'});
  try{await page.waitForFunction(c=>!!window.__game.view.game.systems.machines.hole(c.x,c.y,c.z),c,{timeout:5000});}finally{await page.mouse.up({button:'left'});}
 }
 await page.waitForFunction(()=>window.__game.state().flags['step.ground.ditch']===true);
 const before=await page.evaluate(()=>({state:window.__game.state(),holes:window.__game.view.game.systems.machines.holes()}));save('recovered.json',before);assert(before.holes.length===10&&before.holes.every(h=>h.wet));
 await page.screenshot({path:resolve(out,'wet-ditch.png')});assert(await page.evaluate(()=>window.__game.save()));writeFileSync(resolve(out,'recovered.save.json'),await page.evaluate(()=>localStorage.getItem('greenhollow.save')));
 await page.reload();await page.waitForFunction(()=>!!window.__game);await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>window.__game.started&&!window.__game.state().player.busy);
 const after=await page.evaluate(()=>({state:window.__game.state(),holes:window.__game.view.game.systems.machines.holes()}));save('continued.json',after);assert.deepEqual(after.holes,before.holes);assert(after.state.flags['step.ground.ditch']);assert.deepEqual(after.state.bag,before.state.bag);await page.screenshot({path:resolve(out,'continued.png')});
}catch(e){failure=String(e.stack??e);if(page){save('failed-state.json',await page.evaluate(()=>window.__game?.state()));await page.screenshot({path:resolve(out,'failed.png')});}}
finally{clearInterval(monitor);await browser.close();save('result.json',{status:failure?'ISSUES':'PASS',failure,errors,inputs,renderer:browser.gameRenderer});}
console.log(failure??'PASS legacy UI recovery and Continue');if(failure)process.exitCode=1;
