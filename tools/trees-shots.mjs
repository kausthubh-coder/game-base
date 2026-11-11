import { launchChrome } from './lib/chrome.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
const out='/Users/dabot/dev/sandbox/game-look-test/design/img/options/trees';mkdirSync(out,{recursive:true});
const browser=await launchChrome({headless:true,args:[]});
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const counts={};
try{
await page.goto('http://127.0.0.1:5364/?quality=high&hold=1');await page.waitForFunction(()=>!!window.__game);await page.evaluate(()=>{const g=window.__game;g.newGame();g.manual(true);g.setTime(16/24);});
async function shot(name){await page.evaluate(async()=>{await window.__game.settle();await window.__game.frames(2);});counts[name]=await page.evaluate(()=>{const c=window.__game.counters();return {drawCalls:c.drawCalls,triangles:c.triangles};});await page.screenshot({path:`${out}/${name}.png`});console.log(name,JSON.stringify(counts[name]));}
for(const [name,place] of (process.argv.includes('--fell-only')?[]:[['spawn',null],['meadow',[-15,-232]],['mossy-rocks',[8,-227]]])){
 if(place)await page.evaluate(p=>window.__game.teleport(...p),place);
 await shot(name);await page.evaluate(()=>{window.__game.view.camera.zoomBy(-1);window.__game.view.camera.zoomBy(-1);});await shot(`${name}-close`);await page.evaluate(()=>{window.__game.view.camera.zoomBy(1);window.__game.view.camera.zoomBy(1);});
}
await page.evaluate(()=>{
 const g=window.__game,s=g.view.game.systems;const t=s.trees.all().filter(t=>t.standing&&!t.protected&&t.kind==='oak').sort((a,b)=>Math.hypot(a.x+10,a.z+230)-Math.hypot(b.x+10,b.z+230))[0];
 const spot=s.nav.near({x:t.x+.5,y:t.y,z:t.z+.5},1.5,(x,z)=>x===t.x&&z===t.z);if(!spot)throw Error('no tree approach');g.teleport(spot.x,spot.z);g.give('axe',1);s.inventory.selected=s.inventory.slots.findIndex(s=>s?.id==='axe');window.__shotTree=t;
});
await page.evaluate(async()=>await window.__game.settle());
for(let i=0;i<4;i++){
 const pos=await page.evaluate(()=>{const t=window.__shotTree;return window.__game.view.project(t.x+.5,t.y+.5,t.z+.5);});
 await page.mouse.move(pos.x,pos.y);await page.evaluate(()=>window.__game.frames(3));
 const aim=await page.evaluate(()=>window.__game.view.aim);if(aim)break;
 await page.evaluate(()=>window.__game.turn(1));
}
await page.evaluate(()=>window.__game.manual(false));await shot('fell-aim');
await page.evaluate(()=>window.__game.manual(true));
const ctx=await page.evaluate(()=>{const g=window.__game,s=g.view.game.systems,t=window.__shotTree;return {button:'primary',held:s.inventory.held(),hit:{x:t.x,y:t.y,z:t.z,nx:0,ny:1,nz:0,id:g.block(t.x,t.y,t.z).id,distance:2}};});
await page.evaluate(ctx=>{const s=window.__game.view.game.systems;s.actions.use(ctx);s.actions.hold(ctx,.6);},ctx);await shot('fell-chopping');
await page.evaluate(ctx=>{const s=window.__game.view.game.systems;for(let i=0;i<50;i++)s.actions.hold(ctx,.05);},ctx);
const result=await page.evaluate(()=>{const g=window.__game,t=window.__shotTree;return {standing:g.view.game.systems.trees.all().find(q=>q.x===t.x&&q.z===t.z)?.standing,logs:g.view.game.systems.inventory.count('oak_log')};});
console.log('felling',JSON.stringify(result));if(result.standing)throw Error('tree did not fall');
await page.evaluate(()=>window.__game.frames(2));
counts['fell-fallen']=await page.evaluate(()=>{const c=window.__game.counters();return {drawCalls:c.drawCalls,triangles:c.triangles};});
await page.screenshot({path:`${out}/fell-fallen.png`});console.log('fell-fallen',JSON.stringify(counts['fell-fallen']));
writeFileSync(`${out}/${process.argv.includes('--fell-only')?'fell-counts':'counts'}.json`,JSON.stringify({counts,errors},null,2));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
