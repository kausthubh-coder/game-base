// Real street and dialogue evidence, using the game's debug door and keyboard.
import {launchChrome} from '../lib/chrome.mjs';
import fs from 'node:fs/promises';
const browser=await launchChrome({args:['--autoplay-policy=no-user-gesture-required']});
const page=await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 page.setDefaultTimeout(120000);
 await page.goto('http://127.0.0.1:'+process.env.PLAY_PORT+'/?hold=1&seed=7&quality=low',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game);
 await page.evaluate(async()=>{
  const g=window.__game;g.newGame();g.manual(true);
  g.teleport('town.square');g.setTime(.5);g.advance(.2);g.setCamera('tilt');await g.settle();await g.frames(30);
 });
 await page.screenshot({path:'.artifacts/people-world/hollowmere-street.png'});
 await fs.writeFile('.artifacts/people-world/street-state.json',JSON.stringify(await page.evaluate(()=>({state:window.__game.state(),costs:window.__game.costs()})),null,2));
 await page.evaluate(async()=>{
  const g=window.__game;const npc=g.view.game.systems.people.get('maren');g.teleport(npc.pos.x+1,npc.pos.y,npc.pos.z);g.advance(.2);
 });
 await page.keyboard.press('KeyE');
 await page.evaluate(()=>{const g=window.__game;g.view.game.systems.talk.talkTo('maren');const talk=g.view.game.systems.talk;while(talk.active&&!talk.current()?.npc)talk.advance();g.advance(.1);g.manual(false);});
 await page.waitForFunction(()=>window.__game.state().talk?.npc==='maren');
 await page.keyboard.press('Space');
 await page.screenshot({path:'.artifacts/people-world/dialogue-maren.png'});
 await fs.writeFile('.artifacts/people-world/dialogue-state.json',JSON.stringify(await page.evaluate(()=>window.__game.state()),null,2));
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS street and Maren dialogue, no console errors');
}catch(e){await page.screenshot({path:'.artifacts/people-world/look-failure.png'});console.log(errors);console.log(await page.locator('body').innerText());throw e;}finally{await browser.close();}
