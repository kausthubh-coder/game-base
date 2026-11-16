// Render production farm sheets through the real sprite system on the painted land.
// Start this worktree's dev server first. bun tools/critters-crowd.mjs http://127.0.0.1:<PORT>
import {launchChrome} from './lib/chrome.mjs';
import fs from 'node:fs/promises';
const url=process.argv[2];if(!url)throw Error('Pass this worktree dev URL');
await fs.mkdir('.artifacts/critters',{recursive:true});
const browser=await launchChrome({args:['--autoplay-policy=no-user-gesture-required']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url+'/?hold=1&quality=high');await page.waitForFunction(()=>window.__game);
 const state=await page.evaluate(async()=>{
  const g=window.__game;g.newGame();g.manual(true);g.teleport('grant.center');g.setTime(.5);
  g.view.game.systems.time.setWeather('clear',true);g.advance(.2);g.view.root.style.visibility='hidden';
  await g.settle();for(const actor of g.view.game.actors.values())actor.visible=false;const beam=g.view.scene.getObjectByName('waypoint-beam');if(beam){beam.visible=false;beam.traverse(o=>{if(o.material)o.material.visible=false;});}await g.frames(20);
  window.farmFigures=[];
  return {player:{...g.view.playerPosition},camera:g.view.ctx.camera.position.toArray()};
 });
 const names=['mossling','burrower','frog','lanternfly-world','bee'];
 for(const kind of ['mixed',...names]){
  await page.evaluate(async({names,kind})=>{
   const g=window.__game,v=g.view,p=v.playerPosition;
   for(const h of window.farmFigures)h.remove();window.farmFigures=[];
   for(let i=0;i<20;i++){
    const name=kind==='mixed'?names[i%5]:kind,x=p.x+(i%5-2)*1.2,z=p.z+(Math.floor(i/5)-1.5)*1.15;
    const y=v.groundAt(x,z);
    const h=v.sprites.add(name,{x,y:y+(name==='bee'||name==='lanternfly-world'?.65:0),z,facing:Math.PI-v.camera.yaw+[0,Math.PI,-Math.PI/2][i%3],animation:i%2?'walk':'idle'});
    window.farmFigures.push(h);
   }
   await g.frames(5);
  },{names,kind});
  await page.screenshot({path:`.artifacts/critters/crowd-${kind}.png`});
 }
 // Exercise each action in all directions through the renderer, including return to idle.
 for(const [name,action]of [['mossling','settle'],['burrower','surface'],['burrower','dive'],['frog','catch'],['bee','walk'],['lanternfly-world','walk']]){
  await page.evaluate(({name,action})=>{
   const g=window.__game,v=g.view,p=v.playerPosition;
   for(const h of window.farmFigures)h.remove();window.farmFigures=[];
   for(let i=0;i<3;i++){const x=p.x+(i-1)*1.5,z=p.z;window.farmFigures.push(v.sprites.add(name,{x,y:v.groundAt(x,z),z,facing:Math.PI-v.camera.yaw+[0,Math.PI,-Math.PI/2][i],animation:action}));}
  },{name,action});
  for(let frame=0;frame<4;frame++){
   await page.evaluate(async({action,frame})=>{const g=window.__game;for(const h of window.farmFigures)h.play(action,{restart:true,phase:frame/4});await g.frames(1);},{action,frame});
   await page.screenshot({path:`.artifacts/critters/motion-${name}-${action}-${frame}.png`});
  }
  await page.evaluate(async()=>{for(const h of window.farmFigures)h.play('idle');await window.__game.frames(1);});
 }
 await fs.writeFile('.artifacts/critters/crowd.json',JSON.stringify({url,state,errors},null,2));
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: mixed crowd, twenty per species, six actions in three directions; no browser errors.');
}finally{await browser.close();}
