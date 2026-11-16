// Production sprites at the game camera, next to the real hero, at their story places.
import {launchChrome} from '../lib/chrome.mjs';
import fs from 'node:fs/promises';
const browser=await launchChrome({args:['--autoplay-policy=no-user-gesture-required']});
const out='.artifacts/beasts-2';
await fs.mkdir(out,{recursive:true});
const errors=[],results=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto((process.argv[2]??'http://localhost:5639')+'/?hold=1');
 await page.waitForFunction(()=>window.__game,null,{timeout:90000});
 await page.evaluate(async()=>{const g=window.__game;g.newGame();g.manual(true);g.skipTo('kitchen');await g.settle();});
 for(const [name,x,z,time,anim]of (process.argv.includes('--scene')?[]:[
  ['boar-blighted',18,-334,.5,'idle'],['boar-calmed',18,-334,.5,'idle'],
  ['lynx',80,-307,.5,'idle'],['lynx',80,-307,.82,'idle'],
  ['custodian-wake',-15,-260,.5,'sleep'],['custodian-wake',-15,-260,.5,'eye'],['custodian-wake',-15,-260,.5,'waking'],['custodian-wake',-15,-260,.5,'idle'],
  ...['fox-blighted','fox','thistlehog-blighted','gearling','rootsnare','mossling','burrower','frog','bee','lanternfly-world','stag'].map(name=>[name,18,-334,.5,'idle'])])){
   const result=await page.evaluate(async({name,x,z,time,anim})=>{
    const g=window.__game,v=g.view;g.teleport(x,z);g.setTime(time);await g.settle();
    g.view.root.style.visibility='hidden';
    for(const actor of v.game.actors.values())actor.visible=actor.id==='player';
    const beam=v.scene.getObjectByName('waypoint-beam');if(beam)beam.visible=false;
    window.beastFigure?.remove();
    const p=v.playerPosition;
    window.beastFigure=v.sprites.add(name,{x:p.x+3.5,y:v.groundAt(p.x+3.5,p.z),z:p.z,facing:Math.PI-v.camera.yaw-Math.PI/2,animation:anim});
    await g.frames(10);if(v.sprites.missing.size)throw Error('Missing sprites: '+[...v.sprites.missing]);
    return {name,time,anim,player:{...p},costs:g.costs()};
   },{name,x,z,time,anim});
   const path=`${out}/camera-${name}-${anim}-${time}.png`;
   await page.screenshot({path});results.push({...result,path});console.log(path);
 }
 // Real scene 12: drive the conversation, verify the actor, retain pictures of the held poses.
 await page.reload();await page.waitForFunction(()=>window.__game,null,{timeout:90000});
 await page.evaluate(()=>window.__game.newGame());await page.waitForFunction(()=>window.__game?.started,null,{timeout:90000});
 await page.evaluate(async()=>{const g=window.__game;g.manual(true);g.advance(.5);g.teleport('hall.custodian');g.view.root.style.visibility='';const actor=g.view.game.actors.get('npc:custodian');if(actor)actor.visible=true;g.view.game.systems.talk.start('custodian.wake');await g.frames(1);});
 for(let i=0;i<7;i++){
  const state=await page.evaluate(async()=>{const g=window.__game;g.advance(.1);await g.frames(2);return {line:g.view.game.systems.talk.current(),actor:g.view.game.actors.get('npc:custodian')};});
  await page.screenshot({path:`${out}/scene12-${i}.png`});results.push(state);
  await page.evaluate(()=>window.__game.view.game.systems.talk.advance());
 }
 await fs.writeFile(`${out}/camera.json`,JSON.stringify({results,errors},null,2));
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
