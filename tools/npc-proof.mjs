// Reproduce square, bank and market proof at the same clock and camera settings.
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const phase=process.argv[2]??'after';
const out='/Users/dabot/dev/sandbox/game-look-test/design/img/npc';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.setDefaultTimeout(180000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5389/?hold=1&quality=high');
 await page.waitForFunction(()=>!!window.__game);
 await page.evaluate(()=>{window.__game.newGame();window.__game.manual(true);window.__game.setTime(0.4);});
 if(phase==='after') {
  const sprites=await page.evaluate(()=>window.__game.view.game.systems.people.all().filter(p=>p.id.startsWith('villager-')).map(p=>p.sprite));
  if(sprites.length!==10 || new Set(sprites).size!==10 || sprites.filter(s=>s.startsWith('town-')).length!==8) throw Error('Expected ten distinct crowd sprites: '+JSON.stringify(sprites));
 }
 for(const [name,place] of [['square','town.square'],['bank','river.bank'],['market','town.square']]) {
  await page.evaluate(({place,name})=>{const g=window.__game;g.teleport(place);if(name==='market')g.teleport(166,-157);g.advance(.05);}, {place,name});
  await page.evaluate(()=>window.__game.settle());
  await page.evaluate(()=>window.__game.frames(3));
  await page.screenshot({path:resolve(out,`${phase}-${name}-default.png`)});
  await page.evaluate(()=>{window.__game.view.camera.zoomBy(-1);window.__game.view.camera.zoomBy(-1);});
  await page.evaluate(()=>window.__game.frames(3));
  await page.screenshot({path:resolve(out,`${phase}-${name}-close.png`)});
  await page.evaluate(()=>{window.__game.view.camera.zoomBy(1);window.__game.view.camera.zoomBy(1);});
  console.log('captured',phase,name);
 }
 writeFileSync(resolve(out,`${phase}-state.json`),JSON.stringify(await page.evaluate(()=>({people:window.__game.view.game.systems.people.all(),state:window.__game.state()})),null,2));
 if(errors.length)throw Error(errors.join('\n'));
} finally {await browser.close();}
