import { chromium } from 'playwright-core';
import { mkdirSync,writeFileSync } from 'node:fs';
const out='/Users/dabot/dev/sandbox/game-look-test/design/img/options/trees';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const counts={};
try{
await page.goto('http://127.0.0.1:5364/?quality=high&hold=1');await page.waitForFunction(()=>!!window.__game);await page.evaluate(()=>{const g=window.__game;g.newGame();g.manual(true);g.setTime(16/24);});
async function shot(name){await page.evaluate(async()=>{await window.__game.settle();await window.__game.frames(2);});counts[name]=await page.evaluate(()=>window.__game.counters());await page.screenshot({path:`${out}/${name}.png`});console.log(name,JSON.stringify(counts[name]));}
for(const [name,place] of [['spawn',null],['meadow',[-15,-232]],['mossy-rocks',[8,-227]]]){
 if(place)await page.evaluate(p=>window.__game.teleport(...p),place);
 await shot(name);await page.evaluate(()=>{window.__game.view.camera.zoomBy(-1);window.__game.view.camera.zoomBy(-1);});await shot(`${name}-close`);await page.evaluate(()=>{window.__game.view.camera.zoomBy(1);window.__game.view.camera.zoomBy(1);});
}
await page.evaluate(()=>{
 const g=window.__game,s=g.view.game.systems;const t=s.trees.all().filter(t=>t.standing&&!t.protected&&t.kind==='oak').sort((a,b)=>Math.hypot(a.x+10,a.z+230)-Math.hypot(b.x+10,b.z+230))[0];
 g.teleport(t.x+2,t.z+3);g.give('axe',1);s.inventory.selected=s.inventory.slots.findIndex(s=>s?.id==='axe');window.__shotTree=t;
});
await page.evaluate(async()=>await window.__game.settle());
const pos=await page.evaluate(()=>{const t=window.__shotTree;return window.__game.view.project(t.x+.5,t.y+1,t.z+.5);});
await page.mouse.move(pos.x,pos.y);await shot('fell-aim');
await page.mouse.down();await page.evaluate(()=>window.__game.advance(.6));await shot('fell-chopping');
await page.evaluate(()=>{const g=window.__game,s=g.view.game.systems,t=window.__shotTree;const ctx={button:'primary',held:s.inventory.held(),hit:{x:t.x,y:t.y,z:t.z,nx:0,ny:1,nz:0,id:g.block(t.x,t.y,t.z).id,distance:2}};for(let i=0;i<80&&t.standing;i++){g.advance(.05);s.actions.hold(ctx,.05);}});await page.mouse.up();await shot('fell-fallen');
writeFileSync(`${out}/counts.json`,JSON.stringify({counts,errors},null,2));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
