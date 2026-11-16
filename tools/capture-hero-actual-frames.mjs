// Diagnostic capture of actual world draws, with ordinary movement/tool inputs.
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {launchChrome} from './lib/chrome.mjs';
import {sample,canStartHeavy} from './resource-status.mjs';
const out=resolve(process.env.HERO_OUT||'.artifacts/hero-actual-frames/run-03');mkdirSync(out,{recursive:true});if(readdirSync(out).length)throw Error('Use a new output folder; retained captures are immutable.');
const dist=process.env.HERO_DIST||'dist-grantday';
writeFileSync(out+'/tested-runner.mjs',readFileSync(import.meta.filename));
const raw=readFileSync('.artifacts/beta-final/attempt-01/retry-03/03-home/earned-farm.save.json','utf8');
let browser,server;const resources=[];
async function resource(){const s=await sample();resources.push(s);writeFileSync(out+'/resources.json',JSON.stringify(resources,null,2));return s;}
const timer=setInterval(()=>resource().catch(console.error),30000);
try{
 const s=await resource();if(!canStartHeavy(s,Number(process.env.HERO_ACTIVE_HEAVY??1)))throw Error('second heavy job not admitted');
 server=spawn('bun',['tools/serve.mjs',dist,'5841'],{stdio:['ignore','pipe','inherit']});await new Promise((ok,fail)=>{server.stdout.on('data',b=>{console.log(String(b));if(/pid/.test(String(b)))ok()});server.on('exit',fail)});
 browser=await launchChrome();writeFileSync(out+'/provenance.json',JSON.stringify({fixture:'.artifacts/beta-final/attempt-01/retry-03/03-home/earned-farm.save.json',sha256:createHash('sha256').update(raw).digest('hex'),renderer:browser.gameRenderer,serverPID:server.pid,viewport:{width:1366,height:768},dist,indexSha256:createHash('sha256').update(readFileSync(resolve(dist,'index.html'))).digest('hex'),manifestSha256:createHash('sha256').update(readFileSync(resolve(dist,'assets/manifest.json'))).digest('hex'),diagnosticStart:process.env.HERO_START?{x:-18.5,z:-217.5,y:'world.heightAt'}:null,diagnostic:'Raw earned save imported in private context. setLook changes only chosen appearance for coverage; movement and tools use keyboard and mouse.'},null,2));
 const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();
 page.on('pageerror',e=>console.log('PAGEERROR',String(e)));
 await page.goto('http://127.0.0.1:5841/?quality=high');await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),raw);await page.reload();await page.waitForFunction(()=>!!window.__game);await page.getByRole('button',{name:'Begin',exact:true}).click();await page.waitForFunction(()=>window.__game.started&&!window.__game.state().player.busy);
 await page.screenshot({path:out+'/initial.png'});
 writeFileSync(out+'/initial.json',JSON.stringify(await page.evaluate(()=>({state:window.__game.state(),keys:Object.keys(window.__game.view),slots:window.__game.view.game.systems.inventory.slots,look:window.__game.view.game.systems.opening.hero()})),null,2));
 await page.evaluate(()=>{
 const v=window.__game.view,r=v.renderer,gl=r.getContext(),mesh=v.ctx.scene.getObjectByName('sprites'),original=r.render;
 window.__heroCapture={active:false,rows:[],label:''};
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');
 let gpu=null;
 const oldAfter=mesh.onAfterRender;
 mesh.onAfterRender=function(...args){oldAfter.apply(this,args);if(!window.__heroCapture.active)return;
  const program=gl.getParameter(gl.CURRENT_PROGRAM),location=gl.getAttribLocation(program,'aPlace');
  if(location<0)return;const buffer=gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),previous=gl.getParameter(gl.ARRAY_BUFFER_BINDING);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gpu=new Float32Array(mesh.geometry.instanceCount*24);gl.getBufferSubData(gl.ARRAY_BUFFER,0,gpu);gl.bindBuffer(gl.ARRAY_BUFFER,previous);
 };
 r.render=function(...args){const result=original.apply(this,args),cap=window.__heroCapture;if(!cap.active||args[0]!==v.ctx.scene||cap.rows.length>=1200)return result;
  const actor=v.game.actors.get('player'),data=mesh.geometry.attributes.aPlace.data.array;let index=-1,nearest=Infinity;
  for(let i=0;i<mesh.geometry.instanceCount;i++){const o=i*24,d=Math.hypot(data[o]-actor.pos.x,data[o+1]-actor.pos.y,data[o+2]-actor.pos.z);if(d<nearest){nearest=d;index=i}}
  const slot=Array.from(data.slice(index*24,index*24+24)),gpuSlot=gpu?Array.from(gpu.slice(index*24,index*24+24)):null;
  const place=v.assets.spriteAtlas().place(actor.sprite),time=mesh.material.uniforms.uTime.value,count=Math.abs(slot[6]),tick=Math.floor(Math.max(Math.fround(time)-slot[19],0)*slot[7]),frame=slot[6]<0?Math.min(tick,count-1):tick%count;
  const pt=v.project(actor.pos.x,actor.pos.y+.8,actor.pos.z),sx=r.domElement.width/1366,sy=r.domElement.height/768;
  const crop={x:Math.max(0,Math.min(1366-256,Math.round(pt.x-128))),y:Math.max(0,Math.min(768-256,Math.round(pt.y-128)))};
  const row={at:performance.now(),label:cap.label,draw:r.info.render.frame,actor:{sprite:actor.sprite,anim:actor.anim,pos:{...actor.pos},facing:actor.facing},look:v.game.systems.opening.hero(),physics:{...v.game.player.pos},lighting:{drawnFeetSky:v.game.world.skyLightAt(actor.pos.x,actor.pos.y+.5,actor.pos.z),physicalFeetSky:v.game.world.skyLightAt(actor.pos.x,v.game.player.pos.y+.5,actor.pos.z),sampleBlock:v.game.world.getBlock(Math.floor(actor.pos.x),Math.floor(actor.pos.y+.5),Math.floor(actor.pos.z)),top:v.game.world.heightAt(actor.pos.x,actor.pos.z)},camera:v.camera.mode,slot,gpuSlot,index,nearest,place,time,frame,row:(slot[5]-place.y)/slot[9],page:slot[10],crop};
  queueMicrotask(()=>{c.drawImage(r.domElement,crop.x*sx,crop.y*sy,256*sx,256*sy,0,0,256,256);row.png=canvas.toDataURL('image/png');cap.rows.push(row)});return result;
 };
 });
 async function flush(name){const rows=await page.evaluate(()=>{const c=window.__heroCapture;c.active=false;const rows=c.rows;c.rows=[];return rows});const dir=out+'/'+name;mkdirSync(dir,{recursive:true});for(let i=0;i<rows.length;i++){writeFileSync(dir+'/'+String(i).padStart(4,'0')+'.png',Buffer.from(rows[i].png.split(',')[1],'base64'));delete rows[i].png;}writeFileSync(dir+'/frames.json',JSON.stringify(rows));console.log(name,rows.length,'frames',JSON.stringify([...new Set(rows.map(r=>r.actor.sprite+':'+r.actor.anim))]));await page.screenshot({path:dir+'/full.png'});if(process.env.HERO_ASSERT_LIGHT){const dark=rows.filter(r=>r.lighting.physicalFeetSky===15&&r.gpuSlot[20]<.9);writeFileSync(dir+'/light-verdict.json',JSON.stringify({darkFrames:dark.length,total:rows.length},null,2));if(dark.length){console.log('ISSUES: '+dark.length+' outdoor hero frames sample darker light than physical feet');process.exitCode=1;}}return rows;}
 async function capture(label,action){await page.evaluate(label=>{Object.assign(window.__heroCapture,{active:true,label,rows:[]})},label);await action();await flush(label);}
 for(const look of ((process.env.HERO_TOOLS_ONLY||process.env.HERO_SLOPE)?[]:['a','b','c','d'])){
  await page.evaluate(look=>window.__game.view.game.systems.opening.setLook(look),look);
  await capture('look-'+look+'-walk',async()=>{for(const keys of [['KeyW'],['KeyS'],['KeyA'],['KeyD'],['KeyW','KeyA'],['KeyS','KeyD'],['KeyW','KeyD'],['KeyS','KeyA']]){for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(400);for(const k of keys)await page.keyboard.up(k);await page.waitForTimeout(100)}});
 }
 if(process.env.HERO_SLOPE){
 if(process.env.HERO_START)await page.evaluate(()=>{const v=window.__game.view;v.hero.teleport(-18.5,v.game.world.heightAt(-18.5,-217.5),-217.5)});
 await page.waitForTimeout(500);
 await capture('look-d-slope-walk',async()=>{
 const held=new Set();
 try{for(const goal of (process.env.HERO_START?[{x:-18.5,z:-213.5},{x:-18.5,z:-217.5}]:[{x:19.5,z:-231.5},{x:24.5,z:-226.5},{x:18,z:-226.5}])){
 for(let i=0;i<160;i++){
 const p=await page.evaluate(()=>({p:window.__game.state().player,yaw:window.__game.view.camera.yaw}));const dx=goal.x-p.p.x,dz=goal.z-p.p.z;if(Math.hypot(dx,dz)<.25)break;
 const f=-dx*Math.sin(p.yaw)-dz*Math.cos(p.yaw),r=dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw),m=Math.max(Math.abs(f),Math.abs(r)),want=new Set([...(Math.abs(f)>m*.4?[f>0?'KeyW':'KeyS']:[]),...(Math.abs(r)>m*.4?[r>0?'KeyD':'KeyA']:[])]);
 for(const k of held)if(!want.has(k)){await page.keyboard.up(k);held.delete(k)}for(const k of want)if(!held.has(k)){await page.keyboard.down(k);held.add(k)}await page.waitForTimeout(50);
 }} }finally{for(const k of held)await page.keyboard.up(k)}
 });}
 writeFileSync(out+'/after-walk.json',JSON.stringify(await page.evaluate(()=>({state:window.__game.state(),slots:window.__game.view.game.systems.inventory.slots,aim:window.__game.view.aim})),null,2));
 await page.keyboard.press('Digit2');
 for(const look of (process.env.HERO_SLOPE&&!process.env.HERO_SLOPE_TOOLS?[]:['a','b','c','d'])){
  await page.evaluate(look=>window.__game.view.game.systems.opening.setLook(look),look);
  const candidates=await page.evaluate(()=>{const v=window.__game.view,p=v.game.player.pos,list=[];for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){const x=Math.floor(p.x)+dx,z=Math.floor(p.z)+dz,y=v.game.world.heightAt(x,z)-1,pt=v.project(x+.5,y+.99,z+.5);if(pt&&Math.hypot(x+.5-p.x,z+.5-p.z)>1&&Math.hypot(x+.5-p.x,z+.5-p.z)<2.6)list.push({x,y,z,pt,block:v.game.world.getBlock(x,y,z)})}return list});
  let target=null;
  for(const candidate of candidates){await page.mouse.move(candidate.pt.x,candidate.pt.y);await page.waitForTimeout(120);const aim=await page.evaluate(()=>{const a=window.__game.view.aim;return a&&{x:a.x,y:a.y,z:a.z,block:window.__game.view.game.world.getBlock(a.x,a.y,a.z)}});if(aim&&aim.block&&[1,2,3,4,5,6,7,8].includes(aim.block)){target=aim;break}}
  console.log('tool target',look,JSON.stringify(target));
  writeFileSync(out+'/target-'+look+'.json',JSON.stringify({target,candidates}));
  await capture('look-'+look+'-shovel',async()=>{await page.mouse.down();await page.waitForTimeout(2200);await page.mouse.up();await page.waitForTimeout(500)});
 }

 await page.screenshot({path:out+'/after-walk.png'});writeFileSync(out+'/final.json',JSON.stringify(await page.evaluate(()=>({state:window.__game.state(),costs:window.__game.costs()})),null,2));
}finally{clearInterval(timer);await browser?.close();if(server)server.kill('SIGTERM');await resource();}
