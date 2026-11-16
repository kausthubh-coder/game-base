// The shipped sprite layer and dialogue box, reached through the game's debug door.
import fs from 'node:fs/promises';
import {launchChrome} from '../lib/chrome.mjs';
const browser=await launchChrome({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try {
 const page=await(await browser.newContext({viewport:{width:1440,height:900}})).newPage();
 page.setDefaultTimeout(60000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://localhost:5442/?hold=1&quality=high&chars=sprites',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game!==undefined);
 await page.evaluate(async()=>{
  const g=window.__game;g.newGame();g.manual(true);g.setTime(.5);g.advance(.2);
  g.view.game.systems.time?.setWeather('clear');
  const at=g.teleport('grant.stone');await g.settle();
  for(const a of g.view.game.actors.values())a.visible=false;
  const yaw=g.view.camera.yaw??0;
  const names=['hobb','dax','mina','hero','gus','wren','tansy','holt'];
  names.forEach((name,i)=>{const across=(i-3.5)*1.65;
   g.view.game.actors.set('home-proof:'+name,{id:'home-proof:'+name,sprite:name,pos:{x:at.x+Math.cos(yaw)*across,y:at.y,z:at.z-Math.sin(yaw)*across+2},facing:Math.PI-yaw,anim:'idle',visible:true});
  });
  await g.frames(8);
 });
 await page.screenshot({path:'.artifacts/home/together.png'});
 const state=await page.evaluate(()=>window.__game.state());
 await fs.writeFile('.artifacts/home/state.json',JSON.stringify(state,null,2));
 // Capture every walk direction in the real sprite layer, returning to idle.
 for(const [direction,facing] of [['front',Math.PI],['back',0],['side',Math.PI/2]]){
  await page.evaluate(async({facing})=>{const g=window.__game;for(const [id,a]of g.view.game.actors)if(id.startsWith('home-proof:')){a.facing=facing;a.anim='walk';}await g.frames(8);},{facing});
  await page.screenshot({path:`.artifacts/home/walk-${direction}.png`});
 }
 await page.evaluate(async()=>{const g=window.__game;for(const[id,a]of g.view.game.actors)if(id.startsWith('home-proof:')){a.facing=Math.PI;a.anim='idle';}g.view.game.systems.talk.start('gus.first','gus');await g.frames(2);g.view.game.systems.talk.advance();await g.frames(30);});
 await page.screenshot({path:'.artifacts/home/dialogue.png'});
 await fs.writeFile('.artifacts/home/console.json',JSON.stringify(errors));
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS home lineup, three walk directions, return to idle, Gus dialogue; no console errors');
}finally{await browser.close();}
