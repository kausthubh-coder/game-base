import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const phase=process.argv[2]??'after';
const after=phase==='after';
const port=process.env.GFX_PORT ?? '5373';
const out='/Users/dabot/dev/sandbox/game-look-test/design/img/options/weather';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}); const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(`http://localhost:${port}/?hold=1&quality=high`);
await page.waitForFunction(()=>window.__game);await page.evaluate(async()=>{const g=window.__game;g.newGame();g.manual(true);g.setTime(10/24);await g.settle();});
const counts={};
async function shot(name){await page.evaluate(()=>window.__game.frames(3));await page.screenshot({path:`${out}/${phase}-${name}.png`});counts[name]=await page.evaluate(()=>{const {drawCalls,triangles,quality,particles}=window.__game.counters();return {drawCalls,triangles,quality,particles};});console.log('captured '+name);}
await page.evaluate(()=>{const a=window.__game.view.game.ambient;a.rain=.7;a.cloud=.8;a.wetness=.8;a.wind=.35;});await page.evaluate(()=>window.__game.frames(20));await shot('rain-out');
await page.evaluate((close)=>{window.__game.view.camera.zoomBy(-1);if(close)window.__game.view.camera.zoomBy(-1);},after);await page.evaluate(()=>window.__game.frames(30));await shot('rain-in');
await page.evaluate(()=>{const v=window.__game.view;v.game.ambient.rain=0;v.game.ambient.cloud=.25;v.game.ambient.wetness=.8;});await page.evaluate(()=>{const v=window.__game.view;v.sky.update(16,v.ctx);});await page.evaluate(()=>window.__game.frames(5));await shot('rainbow');
if(after) {
  const result=await page.evaluate(async()=>{
    const v=window.__game.view, mesh=v.scene.getObjectByName('sky-phenomena'), u=mesh.material.uniforms;
    const before=u.uRainbowCenter.value.toArray();
    const x=v.playerPosition.x,z=v.playerPosition.z;window.__game.teleport(x+5,z);await window.__game.frames(2);
    const fixed=before.every((x,i)=>x===u.uRainbowCenter.value.toArray()[i]);
    const visible=u.uRainbow.value>0;
    v.sky.update(120,v.ctx);v.sky.update(10,v.ctx);
    const faded=u.uRainbow.value===0;window.__game.teleport(x,z);
    return {fixed,visible,faded};
  });
  console.log('rainbow assertions',JSON.stringify(result));
  if(!result.fixed || !result.visible || !result.faded) errors.push('rainbow assertions failed');
}

await page.evaluate((close)=>{window.__game.view.camera.zoomBy(1);if(close)window.__game.view.camera.zoomBy(1);window.__game.view.game.ambient.wetness=0;window.__game.setTime(10/24);},after);await shot('shadows-10');await page.evaluate(()=>window.__game.setTime(16/24));await shot('shadows-16');
await page.keyboard.press('Escape');await page.getByRole('button',{name:'Settings',exact:true}).click();await shot('graphics');
if(after) {
  await page.evaluate(()=>window.__game.view.settings.setGraphics({bloom:false,plantDensity:.3,reduceMotion:true}));
  await page.reload();await page.waitForFunction(()=>window.__game);
  const saved=await page.evaluate(()=>window.__game.view.settings.graphics);
  if(saved.bloom!==false || saved.plantDensity!==.3 || !saved.reduceMotion) errors.push('graphics persistence failed');
  console.log('graphics persistence',JSON.stringify(saved));
}
writeFileSync(`${out}/${phase}-counters.json`,JSON.stringify({counts,errors},null,2));await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log(phase+' screenshots saved');
