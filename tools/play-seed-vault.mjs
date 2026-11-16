import {installReplayDriver} from './workflow/replay.mjs';
import {observeSeedVault} from './seed-vault-observation.mjs';
import {weaponOf} from '../src/game/content/fight.ts';
import {must} from './chapters/seed-vault-contract.mjs';

// Coordinator supplies an exclusive, already running page after the Light handoff.
// No browser/server/build ownership is acquired here.
export async function createSeedInput(page,record) {
  must(page && typeof record==='function','prepared page and persistent input recorder required');
  const held=new Set();let callbacks;
  async function key(code,down) {
    record({type:down?'down':'up',key:code});
    await page.keyboard[down?'down':'up'](code);
    down?held.add(code):held.delete(code);
  }
  async function release() {
    const results=await Promise.allSettled([...held].map(code=>key(code,false)));
    await page.mouse.up();
    const bad=results.find(r=>r.status==='rejected');if(bad)throw bad.reason;
  }
  await page.exposeFunction('__replayInput',async(k,down)=>{
    const code={w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',shift:'ShiftLeft',space:'Space'}[k];
    must(code,'unknown replay key');if(held.has(code)!==down)await key(code,down);
  });
  await page.exposeFunction('__seedReplayAction',async(kind,target)=>callbacks[kind](target));
  async function install() {
    await page.evaluate(installReplayDriver,{mode:'realtime'});
    await page.evaluate(observeSeedVault);
  }
  async function targeted(target,reach,actions) {
    must(!callbacks,'overlapping targeted actions');callbacks=actions;
    try {return await page.evaluate(async({target,reach})=>window.__replay.act(target,{reach,aim:t=>window.__seedReplayAction('aim',t),press:()=>window.__seedReplayAction('press'),done:()=>window.__seedReplayAction('done')}),{target,reach});}
    finally {callbacks=null;}
  }
  const press=async code=>{await key(code,true);await key(code,false);};
  async function walk(goal,options={}) {
    must([goal.x,goal.y,goal.z].every(Number.isFinite),'authored outdoor height required; route remains unproven');
    for(const p of options.via??[])must([p.x,p.y,p.z].every(Number.isFinite),'waypoint height required');
    record({type:'walk',goal,options});
    const result=await page.evaluate(async({goal,options})=>window.__replay.walk(goal,options),{goal,options});
    must(result?.ok===true,'Seed walk failed: '+JSON.stringify(result));return result;
  }
  async function interact(id,prompt,reach,done) {
    const t=await page.evaluate(()=>{const t=window.__game.view.game.systems.interact.nearest();return t?{id:t.id,prompt:t.prompt(),reach:t.radius,pos:t.pos()}:null;});
    must(t?.id===id && t.prompt===prompt && t.reach===reach,'wrong Seed interaction target');
    record({type:'interact',id,prompt,reach,target:t.pos});
    await targeted(t.pos,reach,{aim:async at=>{const p=await page.evaluate(at=>window.__game.view.project(at.x,at.y,at.z),at);must(p,'interaction outside camera');await page.mouse.move(p.x,p.y);},press:()=>press('KeyE'),done});
  }
  async function attack(target,weapon) {
    const move=weaponOf(weapon).quick,reach=move.range||move.reach;
    const y=await page.evaluate(()=>window.__game.view.game.player.pos.y);
    const before=await page.evaluate(()=>{const r=window.__game.view.game.systems.fights.running();return r?{swings:r.fight.record.swings}:null;});must(before,'no fight before attack');
    await targeted({...target,y},reach,{
      aim:async t=>{const p=await page.evaluate(t=>window.__game.view.project(t.x,window.__game.view.playerPosition.y,t.z),t);must(p,'target outside camera');await page.mouse.move(p.x,p.y);},
      press:async()=>{record({type:'attack',target,weapon,reach});await page.mouse.down();try {await page.waitForFunction(n=>{const r=window.__game.view.game.systems.fights.running();return r?r.fight.record.swings>n:window.__game.state().flags['fight.10.won']===true;},before.swings,{timeout:3000});}finally{await page.mouse.up();}},
      done:async()=>page.evaluate(n=>{const r=window.__game.view.game.systems.fights.running();return r?r.fight.record.swings>n:window.__game.state().flags['fight.10.won']===true;},before.swings),
    });
  }
  await install();return {page,install,walk,interact,attack,press,release};
}
// Pure decision function; movement must still skirt the solid arm base.
export function seedCombatPlan(s) {
  must(s?.n===10 && s.keeper,'fight 10 keeper required');
  must(s.hero.health>0,'fainted; preserve failure and diagnose');
  if(s.result==='won' && s.keeper.body.doing==='down')return {kind:'won'};
  must(!s.result,'fight ended without keeper victory');
  const pods=s.keeper.parts.filter(p=>!p.broken);
  const target=pods.sort((a,b)=>Math.hypot(a.x-s.hero.x,a.z-s.hero.z)-Math.hypot(b.x-s.hero.x,b.z-s.hero.z))[0] ?? (s.keeper.heart.open?s.keeper.heart:null);
  return {kind:target?'attack':'observe',target,hold:s.keeper.body.doing!=='held' && (s.keeper.holdRest??0)<=0,dodge:s.shapes?.some(t=>t.live)===true};
}
export async function fightSeedVault(input,{read,approach,observe,deadlineMs=150000,stalledMs=20000}) {
  must([deadlineMs,stalledMs].every(n=>Number.isFinite(n)&&n>0),'bounded fight required');
  const began=Date.now();let changed=began,previous;
  try {
    while(Date.now()-began<deadlineMs) {
      const s=await read();const plan=seedCombatPlan(s);observe({state:s,plan});
      if(plan.kind==='won')return true;
      const progress=JSON.stringify([s.keeper.heart.guard,s.keeper.parts.map(p=>[p.x,p.z,p.guard,p.broken])]);
      if(progress!==previous){changed=Date.now();previous=progress;}
      must(Date.now()-changed<stalledMs,'fight 10 made no progress');
      if(plan.hold)await input.press('KeyC');
      if(plan.dodge)await input.press('ShiftLeft');
      if(plan.target) {
        // Existing combat steering should implement a short leg around the arm, not cross its base.
        await approach(plan.target,weaponOf(s.hero.weapon).quick,s);
        const fresh=await read();must(fresh?.n===10,'fight disappeared before attack');
        if(!fresh.result)await input.attack(plan.target,fresh.hero.weapon);
      }
      await input.page.waitForTimeout(100);
    }
    throw Error('fight 10 deadline exceeded');
  } finally {await input.release();}
}
if(import.meta.main){try {const {runSeedCommand}=await import('./seed-vault-session.mjs');await runSeedCommand(process.argv.slice(2));} catch(error){console.error('FAIL Seed: '+error.message);process.exitCode=1;}}

export async function readSeedFight(page) {
  return page.evaluate(()=>{
    const r=window.__game.view.game.systems.fights.running();if(!r)return null;
    const k=r.keeper;
    return {n:r.n,result:r.result,hero:{...r.fight.hero},shapes:r.fight.shapes.filter(s=>s.live).map(s=>({...s})),keeper:k?{body:{...k.body},heart:{...k.heart},parts:k.parts.map(p=>({...p})),holdRest:k.holdRest,record:k.record()}:null};
  });
}
export async function querySeedOutdoorTargets(page) {
  // Planning only. No route, height or arrival is approved by this query.
  return page.evaluate(()=>{
    const s=window.__game.view.game.systems;
    return {stair:s.region.place('ruin-stair').at,door:s.region.place('seedvault').at,nearest:(()=>{const t=s.interact.nearest();return t?{id:t.id,at:t.pos(),reach:t.radius,prompt:t.prompt()}:null;})(),routeStatus:'UNPROVEN'};
  });
}
