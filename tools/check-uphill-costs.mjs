// Exact earned pit costs through Continue and ordinary keys. No progression edits.
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {launchChrome} from './lib/chrome.mjs';
import {sample,canStartHeavy} from './resource-status.mjs';
import {stopPumpChild} from './play-uphill.mjs';
const opt=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1]};
const port=opt('port','5579');
const dist=opt('dist','dist-uphill-input'),out=resolve(opt('out','.artifacts/uphill-costs/baseline'));
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
const raw=readFileSync('.artifacts/uphill-input/attempt-14/middle-pit.save.json','utf8');
if(hash(raw)!=='78e18b0e8c46a7b88ccd6971eb48e507fe0a639cc0869d769d1953965c42b9c0')throw Error('raw input changed');
let browser,server;const resources=[],rows=[],errors=[];
const monitor=setInterval(()=>sample().then(s=>{resources.push(s);writeFileSync(resolve(out,'resources.json'),JSON.stringify(resources,null,2));console.log('resource',JSON.stringify(s));}),30000);
try{
 const s=await sample();resources.push(s);if(!canStartHeavy(s,0))throw Error('heavy launch denied '+JSON.stringify(s));
 server=spawn('bun',['tools/serve.mjs',dist,port],{stdio:['ignore','pipe','inherit']});
 await new Promise((ok,fail)=>{server.stdout.on('data',b=>{console.log(String(b).trim());if(/pid \d+/.test(String(b)))ok()});server.once('exit',c=>fail(Error('server '+c)))});
 const admission=await sample();resources.push(admission);if(!canStartHeavy(admission,0))throw Error('browser launch denied '+JSON.stringify(admission));
 browser=await launchChrome();
 for(const quality of ['high','low'])for(const [width,height] of [[1366,768]]){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
 await page.goto('http://127.0.0.1:'+port+'/?seed=41&quality='+quality);
 await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();
 await page.waitForFunction(()=>!!window.__game);
 await page.getByRole('button',{name:'Begin',exact:true}).click();
 await page.waitForFunction(()=>window.__game.state().started&&!window.__game.state().player.busy);
 await page.waitForTimeout(2200);
 if(await page.evaluate(()=>window.__game.view.ctx.quality)!==quality)throw Error('actual graphics level differs');
 await page.evaluate(()=>{const v=window.__game.view,r=v.renderer,draw=r.renderBufferDirect;let frame=-1,rows=[];window.__meshCosts=()=>rows;r.renderBufferDirect=function(...args){if(frame!==r.info.render.frame){frame=r.info.render.frame;rows=[]}const before=r.info.render.calls;draw.apply(this,args);const o=args[4];if(r.info.render.calls>before)rows.push({id:o.id,name:o.name,type:o.type,parent:o.parent?.name,material:args[3].name,triangles:r.info.render.triangles,shadow:args[1]===null});};});
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
 return {state:g.state(),feet:{...p},physics:{...v.game.player.pos},onGround:v.game.player.onGround,ground:v.groundAt(p.x,p.z),camera:{x:c.x,y:c.y,z:c.z},probes,materials,costs:g.costs(),meshes:window.__meshCosts()};
 });row.name=name;row.quality=quality;row.viewport={width,height};rows.push(row);
 await page.screenshot({path:resolve(out,name+'.png')});writeFileSync(resolve(out,'observations.json'),JSON.stringify({inputHash:hash(raw),renderer:browser.gameRenderer,errors,rows},null,2));
 console.log(name,JSON.stringify({feet:row.feet,ground:row.ground,blocked:row.probes.filter(p=>p.hit).length}));
 }
 await capture(`${quality}-${width}-initial`);
 if(process.argv.includes('--movement')){for(const key of ['KeyW','KeyS','KeyQ','KeyE']){await page.keyboard.down(key);await page.waitForTimeout(key==='KeyQ'||key==='KeyE'?100:400);await page.keyboard.up(key);await page.waitForTimeout(800);await capture(`${quality}-${width}-${key}`);}}

 const machineState=()=>page.evaluate(()=>{const rows=[];window.__game.view.scene.traverse(o=>{if(o.name.startsWith('machines:')&&o.instanceMatrix)rows.push({name:o.name,count:o.count,matrix:Array.from(o.instanceMatrix.array.slice(0,o.count*16)),shadow:o.castShadow,receive:o.receiveShadow})});return rows});
 const animationBefore=await machineState();await page.waitForTimeout(600);const animationAfter=await machineState();
 const animation=animationBefore.map(a=>({name:a.name,count:a.count,changed:JSON.stringify(a.matrix)!==JSON.stringify(animationAfter.find(b=>b.name===a.name)?.matrix),shadow:a.shadow,receive:a.receive}));
 writeFileSync(resolve(out,quality+'-animation.json'),JSON.stringify({before:animationBefore,after:animationAfter,checks:animation},null,2));
 for(const kind of ['partWheel','partShaft','partPusher'])if(!animation.some(a=>a.name.includes(kind)&&a.name.endsWith(':m')&&a.count>0&&a.changed))errors.push('moving animation absent '+kind);
 await context.close();
 }
}finally{clearInterval(monitor);writeFileSync(resolve(out,'resources.json'),JSON.stringify(resources,null,2));await browser?.close();await stopPumpChild(server);}
const blocked=errors.length||rows.some(r=>r.costs.total.drawCalls>(r.quality==='low'?80:150)||r.costs.total.triangles>(r.quality==='low'?150000:400000));
console.log(blocked?'ISSUES: draw budget exceeded or browser errors':'PASS: captured draw budgets');process.exitCode=blocked?1:0;
