import {storyCosts,costIssues} from './lib/story-cost-probe.mjs';
// Earned modes use raw checkpoints and ordinary input. --fixture stages a separate diagnostic.
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {launchChrome} from './lib/chrome.mjs';
import {sample,canStartHeavy} from './resource-status.mjs';
import manifest from '../public/assets/manifest.json' with {type:'json'};
import {createKeyboardSteering} from './lib/keyboard-steering.mjs';
import {splitCues} from '../src/game/talk/cues.sim.ts';
import {settleDialogue} from './lib/firstnight-framing.mjs';
import {stopPumpChild} from './play-uphill.mjs';
const opt=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1]};
const port=opt('port','5578');
const dist=opt('dist','dist-uphill-input'),out=resolve(opt('out','.artifacts/uphill-world-check/red'));
mkdirSync(out,{recursive:true});
if(readdirSync(out).length)throw Error('output must be empty');
writeFileSync(resolve(out,'tested-runner.mjs'),readFileSync(import.meta.filename));
writeFileSync(resolve(out,'tested-head.txt'),spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout);
writeFileSync(resolve(out,'tested-working.patch'),spawnSync('git',['diff','HEAD'],{encoding:'utf8'}).stdout);
const buildHashes={};const visitBuild=(rel='')=>{for(const e of readdirSync(resolve(dist,rel),{withFileTypes:true})){const r=rel?rel+'/'+e.name:e.name;if(e.isDirectory())visitBuild(r);else buildHashes[r]=createHash('sha256').update(readFileSync(resolve(dist,r))).digest('hex');}};visitBuild();writeFileSync(resolve(out,'build-hashes.json'),JSON.stringify(buildHashes,null,2));

const hash=b=>createHash('sha256').update(b).digest('hex');
if(dist==='dist-uphill-input'){
 const provenance=JSON.parse(readFileSync('.artifacts/uphill-input/build-provenance.json'));
 const actual={}; const visit=(rel='')=>{for(const e of readdirSync(resolve(dist,rel),{withFileTypes:true})){const r=rel?rel+'/'+e.name:e.name;if(e.isDirectory())visit(r);else actual[r]=hash(readFileSync(resolve(dist,r)));}};visit();
 if(JSON.stringify(Object.entries(actual).sort())!==JSON.stringify(Object.entries(provenance.build).sort()))throw Error('old output provenance mismatch');
 writeFileSync(resolve(out,'build-provenance.json'),JSON.stringify(provenance,null,2));
}
const fixture=process.argv.includes('--fixture');
const continueOnly=process.argv.includes('--continue-earned');
const maren=process.argv.includes('--maren')||fixture||continueOnly;
const raw=readFileSync(continueOnly?opt('continue-input','.artifacts/uphill-world-check/earned-cast/high-1366-maren-ended.save.json'):'.artifacts/uphill-input/attempt-14/'+(maren?'repeat-delivery':'middle-pit')+'.save.json','utf8');
if(!continueOnly&&hash(raw)!==(maren?'789090a7cc6205d2cc4c79926ce60af8a870a2c1ab69af3ffc98230f43cad7f4':'78e18b0e8c46a7b88ccd6971eb48e507fe0a639cc0869d769d1953965c42b9c0'))throw Error('raw input changed');
let browser,server;const resources=[],rows=[],errors=[];
const monitor=setInterval(()=>sample().then(s=>{resources.push(s);writeFileSync(resolve(out,'resources.json'),JSON.stringify(resources,null,2));console.log('resource',JSON.stringify(s));}),30000);
try{
 const s=await sample();resources.push(s);if(!canStartHeavy(s,0))throw Error('heavy launch denied '+JSON.stringify(s));
 server=spawn('bun',['tools/serve.mjs',dist,port],{stdio:['ignore','pipe','inherit']});
 await new Promise((ok,fail)=>{server.stdout.on('data',b=>{console.log(String(b).trim());if(/pid \d+/.test(String(b)))ok()});server.once('exit',c=>fail(Error('server '+c)))});
 const admission=await sample();resources.push(admission);if(!canStartHeavy(admission,0))throw Error('browser launch denied '+JSON.stringify(admission));
 browser=await launchChrome();
 for(const quality of opt('qualities',continueOnly?'high':'high,low').split(','))for(const [width,height] of opt('widths',continueOnly?'1366':'1366,390,800').split(',').map(Number).map(w=>[w,w===390?844:w===800?700:768])){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
 await page.goto('http://127.0.0.1:'+port+'/?seed=41&quality='+quality);
 await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();
 await page.waitForFunction(()=>!!window.__game);
 if(continueOnly)await page.evaluate(()=>{const v=window.__game.view,original=v.continueGame;v.continueGame=()=>{const result=original();window.__game.save();window.__continueRaw=localStorage.getItem('greenhollow.save');return result}});
 if(fixture)await page.evaluate(()=>window.__game.newGame());else await page.getByRole('button',{name:'Begin',exact:true}).click();
 await page.waitForFunction(()=>window.__game.state().started&&!window.__game.state().player.busy);
 await page.waitForTimeout(2200);
 if(await page.evaluate(()=>window.__game.view.ctx.quality)!==quality)throw Error('actual graphics level differs');
 if(fixture){
   await page.evaluate(async()=>{const g=window.__game;g.skipTo('uphill');g.setTime(.45);const sys=g.view.game.systems;if(sys.talk.active)sys.talk.skip();const at=sys.region.place('grant.center').at;g.teleport(at.x+2.45,at.z+2.45);await g.frames(20);g.advance(.2);if(sys.talk.active)sys.talk.skip();});
   // The banner queue leaves a hidden frame between entries. Require sustained quiet
   // while ordinary frames drain the queue; never remove or suppress the banner.
   await page.evaluate(()=>new Promise((resolve,reject)=>{
     const started=performance.now();let quietSince=started;
     function observe(){
       const now=performance.now();
       if(document.querySelector('.hp-banner:not([hidden])'))quietSince=now;
       if(now-quietSince>=1000){resolve();return;}
       if(now-started>=45000){reject(Error('Diagnostic reward banners did not finish'));return;}
       requestAnimationFrame(observe);
     }
     requestAnimationFrame(observe);
   }));
   await page.evaluate(()=>window.__game.view.game.systems.talk.start('scene.27'));
 }

 async function capture(name){
 const row=await page.evaluate(()=>{
 const g=window.__game,v=g.view,p=v.playerPosition,c=v.ctx.camera.position;
 const probes=[];
 // Sample the actual painted surface along camera/body segments. This is a geometry diagnosis,
 // not a shader visibility verdict. Shader-aware screenshots remain required.
 for(const h of [.08,.35,.8,1.3,1.7])for(const side of [-.22,0,.22]){
 const right=c.clone().setFromMatrixColumn(v.ctx.camera.matrixWorld,0),target={x:p.x+right.x*side,y:p.y+h,z:p.z+right.z*side};let hit=null;
 for(let t=.01;t<.995;t+=.002){const x=c.x+(target.x-c.x)*t,z=c.z+(target.z-c.z)*t,y=c.y+(target.y-c.y)*t,ground=v.groundAt(x,z);if(Number.isFinite(ground)&&ground>y+.015){hit={x,y,z,ground,t};break;}}
 probes.push({h,side,target,hit});}
 const materials=[];v.scene.traverse(o=>{if(o.name==='land-sheet')materials.push({name:o.name,see:o.material.userData.see,visible:o.visible})});
 return {state:g.state(),feet:{...p},physics:{...v.game.player.pos},onGround:v.game.player.onGround,ground:v.groundAt(p.x,p.z),camera:{x:c.x,y:c.y,z:c.z},probes,materials,costs:g.costs()};
 });row.name=name;row.quality=quality;row.viewport={width,height};rows.push(row);
 await page.screenshot({path:resolve(out,name+'.png')});writeFileSync(resolve(out,'observations.json'),JSON.stringify({inputHash:hash(raw),renderer:browser.gameRenderer,errors,rows},null,2));
 console.log(name,JSON.stringify({feet:row.feet,ground:row.ground,blocked:row.probes.filter(p=>p.hit).length}));
 }
 if(continueOnly){await page.waitForFunction(()=>!!window.__continueRaw);const afterRaw=await page.evaluate(()=>window.__continueRaw);writeFileSync(resolve(out,'continued-immediate.save.json'),afterRaw);const before=JSON.parse(raw),after=JSON.parse(afterRaw),checks={};for(const key of ['inventory','bench','placeables','settlement','quests','goods','crops','ruins'])checks[key]=JSON.stringify(before.game.systems[key])===JSON.stringify(after.game.systems[key]);checks.world=JSON.stringify(before.world)===JSON.stringify(after.world);checks.noScene=await page.evaluate(()=>!window.__game.view.game.systems.talk.active);writeFileSync(resolve(out,'immediate-continue-invariants.json'),JSON.stringify(checks,null,2));await capture('continued-earned');if(Object.values(checks).some(v=>!v))throw Error('immediate Continue invariant failed');await context.close();continue;}
 if(maren){
 const steer=createKeyboardSteering();
 async function straight(x,z,near=1.5){const held=new Set();let last=null,stuck=0;try{for(let i=0;i<2000;i++){
 const state=await page.evaluate(()=>window.__game.state());if(state.talk)return;if(Math.hypot(x-state.player.x,z-state.player.z)<near)return;
 const yaw=await page.evaluate(()=>window.__game.view.camera.yaw),d=steer(x-state.player.x,z-state.player.z,yaw);
 const want=new Set([...(d.forward>0?['KeyW']:d.forward<0?['KeyS']:[]),...(d.right>0?['KeyD']:d.right<0?['KeyA']:[])]);
 for(const k of held)if(!want.has(k)){await page.keyboard.up(k);held.delete(k)}for(const k of want)if(!held.has(k)){await page.keyboard.down(k);held.add(k)}
 await page.waitForTimeout(50);if(last&&Math.hypot(state.player.x-last.x,state.player.z-last.z)<.03)stuck++;else stuck=0;last=state.player;if(stuck>25)throw Error('stuck '+JSON.stringify(state.player));
 }throw Error('walk timeout');}finally{for(const k of held)await page.keyboard.up(k)}}
 async function walk(x,z){try{await straight(x,z)}catch(e){const path=await page.evaluate(([x,z])=>{const g=window.__game.view.game;return g.systems.nav.path(g.player.pos,{x,y:g.world.heightAt(Math.floor(x),Math.floor(z)),z},20000)},[x,z]);if(!path?.length)throw e;for(const p of path)await straight(p.x,p.z,.3);await straight(x,z)}}
 if(!fixture){for(const [x,z] of [[150,-174],[137,-174],[126,-177],[92,-221],[20,-240]]){console.log('route',x,z);await walk(x,z)}
 const centre=await page.evaluate(()=>window.__game.view.game.systems.region.place('grant.center').at);await walk(centre.x,centre.z);}
 await page.waitForFunction(()=>window.__game.state().talk?.scene===27||window.__game.view.game.systems.talk.current()?.scene===27);
 let revealedLines=0;
 for(let line=0;line<10;line++){
 if(!await page.evaluate(()=>window.__game.view.game.systems.talk.active))break;
 await settleDialogue(page);const expectedText=splitCues(await page.evaluate(()=>window.__game.view.game.systems.talk.current().text)).shown;await page.waitForFunction(text=>{const el=document.querySelector('.gb-dialogue-typed');return el?.textContent===text&&el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})},expectedText,{timeout:30000});
 const frame=await page.evaluate((sheets)=>{const g=window.__game,v=g.view,lens=v.ctx.camera,m=lens.matrixWorld.elements,actors=[];
 for(const a of v.game.actors.values()){if(!a.visible||!(a.id==='player'||a.id.startsWith('stage:')||a.id.startsWith('npc:')||a.id.startsWith('pet:')))continue;
 const sheet=v.assets.sprite(a.sprite);if(!sheet)throw Error('missing actual sprite '+a.sprite);const p=a.id==='player'?v.playerPosition:{...a.pos,y:a.pos.y+v.liftOnLand(a.pos.x,a.pos.y,a.pos.z)};const scale=sheet.worldHeight/sheet.frame[1],b=sheet.body;
 const len=Math.hypot(m[0],m[2]),rx=m[0]/len,rz=m[2]/len,lean=Math.max(Math.asin(Math.max(-1,Math.min(1,lens.matrixWorldInverse.elements[6])))-.628,0);const corners=[b[0],b[2]].flatMap(x=>[b[1],b[3]].map(y=>{const across=(x-sheet.anchor[0])*scale,up=(sheet.anchor[1]-y)*scale;return v.project(p.x+rx*across+rz*Math.sin(lean)*up,p.y+Math.cos(lean)*up,p.z+rz*across-rx*Math.sin(lean)*up)}));
 const box=corners.every(Boolean)?{left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))}:null;
 actors.push({id:a.id,sprite:a.sprite,pos:p,box,drawnGround:v.groundAt(p.x,p.z),logicalGround:v.game.world.heightAt(Math.floor(p.x),Math.floor(p.z))});}
 const band=Math.min(innerHeight-(parseFloat(getComputedStyle(v.root).getPropertyValue('--ui-talk-clear'))||0),innerHeight-(document.querySelector('.ui-talk-bars:not([hidden]) .ui-talk-bar-bottom')?.offsetHeight||0));
 return {line:v.game.systems.talk.current(),actors,band,sight:g.sight(),costs:g.costs(),state:g.state()};},manifest.sprites);
 if(process.argv.includes('--costs')){frame.costFrames=await storyCosts(page);frame.costIssues=costIssues(frame.costFrames,quality);}
 revealedLines++;
 frame.name=`${fixture?'fixture':'earned'}-${quality}-${width}-line-${line}`;
 frame.issues=[];frame.banner=await page.locator('.hp-banner:not([hidden])').count();if(frame.banner)frame.issues.push('reward banner obscures scene');const required=frame.actors.filter(a=>a.id==='player'||['stage:maren','stage:gus','stage:aldric'].includes(a.id));
 for(const a of required){if(!a.box||a.box.bottom>=frame.band||a.box.top<0||a.box.left<0||a.box.right>width)frame.issues.push(a.id+' body cropped');for(const b of frame.actors){if(a===b||!a.box||!b.box)continue;if(Math.min(a.box.right,b.box.right)>Math.max(a.box.left,b.box.left)&&Math.min(a.box.bottom,b.box.bottom)>Math.max(a.box.top,b.box.top))frame.issues.push(a.id+' overlaps '+b.id);}}
 for(const a of frame.sight)if(!a.inFrame||a.hiddenBy)frame.issues.push(a.who+' hidden/cropped '+a.hiddenBy);
 rows.push(frame);writeFileSync(resolve(out,'observations.json'),JSON.stringify({inputHash:hash(raw),renderer:browser.gameRenderer,rows,errors},null,2));await page.screenshot({path:resolve(out,frame.name+'.png')});console.log(frame.name,JSON.stringify(frame.sight));await page.keyboard.press('KeyE');await page.waitForTimeout(200);
 }
 if(revealedLines!==7)throw Error('expected seven revealed lines, got '+revealedLines);
 await page.waitForTimeout(1500);await capture(`${quality}-${width}-maren-ended`);
 const cleanup=await page.evaluate(()=>{const v=window.__game.view;return{stage:[...v.game.actors.keys()].filter(id=>id.startsWith('stage:')),originals:['maren','gus','aldric'].map(id=>({id,visible:v.game.actors.get('npc:'+id)?.visible})),busy:v.game.player.busy,yaw:v.camera.yaw}});writeFileSync(resolve(out,`${quality}-${width}-cleanup.json`),JSON.stringify(cleanup,null,2));
 if(cleanup.stage.length||cleanup.busy||cleanup.originals.some(a=>a.visible===false))throw Error('scene cleanup failed');
await page.evaluate(()=>window.__game.save());const beforeRaw=await page.evaluate(()=>localStorage.getItem('greenhollow.save'));writeFileSync(resolve(out,`${quality}-${width}-maren-ended.save.json`),beforeRaw);
 await page.reload();await page.waitForFunction(()=>!!window.__game);await page.evaluate(raw=>{localStorage.setItem('greenhollow.save',raw);const v=window.__game.view,original=v.continueGame;v.continueGame=()=>{const result=original();window.__game.save();window.__restoredRaw=localStorage.getItem('greenhollow.save');return result}},beforeRaw);await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>window.__game.state().started&&!window.__game.state().player.busy);await page.waitForTimeout(1200);
 await page.waitForFunction(()=>!!window.__restoredRaw);const afterRaw=await page.evaluate(()=>window.__restoredRaw);writeFileSync(resolve(out,`${quality}-${width}-maren-continued.save.json`),afterRaw);const before=JSON.parse(beforeRaw),after=JSON.parse(afterRaw),invariants={};
 for(const key of ['inventory','bench','placeables','settlement','quests','goods','crops','ruins'])invariants[key]=JSON.stringify(before.game.systems[key])===JSON.stringify(after.game.systems[key]);invariants.world=JSON.stringify(before.world)===JSON.stringify(after.world);invariants.noScene=await page.evaluate(()=>!window.__game.view.game.systems.talk.active);writeFileSync(resolve(out,`${quality}-${width}-continue-invariants.json`),JSON.stringify(invariants,null,2));if(Object.values(invariants).some(v=>!v))errors.push(quality+'-'+width+' Continue changed invariant');await capture(`${quality}-${width}-maren-continued`);
 if(fixture){
 await page.evaluate(()=>window.__game.view.game.systems.talk.start('scene.27'));await page.waitForTimeout(900);await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__game.view.game.systems.talk.active&&!window.__game.state().player.busy);await page.waitForTimeout(900);await page.evaluate(()=>window.__game.save());const skipRaw=JSON.parse(await page.evaluate(()=>localStorage.getItem('greenhollow.save')));const skip=await page.evaluate(()=>{const v=window.__game.view;return{stages:[...v.game.actors.keys()].filter(k=>k.startsWith('stage:')),yaw:v.camera.yaw,busy:v.game.player.busy,hidden:[...v.game.actors.values()].filter(a=>a.id.startsWith('npc:')&&!a.visible).map(a=>a.id)}});skip.inventory=JSON.stringify(skipRaw.game.systems.inventory)===JSON.stringify(after.game.systems.inventory);skip.world=JSON.stringify(skipRaw.world)===JSON.stringify(after.world);writeFileSync(resolve(out,`${quality}-${width}-skip.json`),JSON.stringify(skip,null,2));await capture(`${quality}-${width}-skip-ended`);if(skip.stages.length||skip.busy||!skip.inventory||!skip.world)throw Error('diagnostic Escape cleanup failed');
 }


 await context.close();continue;
 }
 await capture(`${quality}-${width}-initial`);
 if(process.argv.includes('--movement')){for(const key of ['KeyW','KeyS','KeyQ','KeyE']){await page.keyboard.down(key);await page.waitForTimeout(key==='KeyQ'||key==='KeyE'?100:400);await page.keyboard.up(key);await page.waitForTimeout(800);await capture(`${quality}-${width}-${key}`);}}
 await context.close();
 }
}finally{clearInterval(monitor);writeFileSync(resolve(out,'resources.json'),JSON.stringify(resources,null,2));await browser?.close();await stopPumpChild(server);}
const blocked=errors.length||rows.some(r=>r.probes?.some(p=>p.hit)||r.issues?.length||r.costIssues?.length);
console.log(blocked?'ISSUES: body visibility, framing or draw budget failed; inspect observations and captures':'No painted terrain intersects sampled body sight segments; visual acceptance pending');
process.exitCode=blocked?1:0;
