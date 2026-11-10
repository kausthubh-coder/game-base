import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const phase=process.argv[2]??'after';
const out='/Users/dabot/dev/sandbox/game-look-test/design/img/options/weather';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}); const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://localhost:5374/?hold=1&quality=high');
await page.waitForFunction(()=>window.__game);await page.evaluate(async()=>{const g=window.__game;g.newGame();g.manual(true);g.setTime(10/24);await g.settle();});
const counts={};
async function shot(name){await page.evaluate(()=>window.__game.frames(3));await page.screenshot({path:`${out}/${phase}-${name}.png`});counts[name]=await page.evaluate(()=>window.__game.counters());}
await page.evaluate(()=>{const a=window.__game.view.game.ambient;a.rain=.7;a.cloud=.8;a.wetness=.8;a.wind=.35;});await page.evaluate(()=>window.__game.frames(20));await shot('rain-out');
await page.evaluate(()=>window.__game.view.camera.zoomBy(-10));await page.evaluate(()=>window.__game.frames(30));await shot('rain-in');
await page.evaluate(()=>{const v=window.__game.view;v.game.ambient.rain=0;v.game.ambient.cloud=.25;v.game.ambient.wetness=.8;});await page.evaluate(()=>window.__game.frames(80));await shot('rainbow');
await page.evaluate(()=>{window.__game.view.camera.zoomBy(1);window.__game.view.game.ambient.wetness=0;window.__game.setTime(10/24);});await shot('shadows-10');await page.evaluate(()=>window.__game.setTime(16/24));await shot('shadows-16');
await page.keyboard.press('Escape');await page.getByRole('button',{name:'Settings',exact:true}).click();await shot('graphics');
writeFileSync(`${out}/${phase}-counters.json`,JSON.stringify({counts,errors},null,2));await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log(phase+' screenshots saved');
