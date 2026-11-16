import {STEP_COST,FITTING_COST} from '../src/game/content/gear.ts';
import {must,same,flagsOf,assertSeedBoundary,assertKeyBeforeMemory,assertSeedContinue,sha256} from './chapters/seed-vault-contract.mjs';
const add=(stock,id,n)=>{must(typeof id==='string' && Number.isSafeInteger(n),'invalid stock');stock[id]=(stock[id]??0)+n;};
export function totalSeedStock(save) {
  const s=save.game.systems,r={};
  for(const v of s.inventory.slots)if(v){must(v.count>=0,'negative bag');add(r,v.id,v.count);}
  for(const [id,n] of s.machines.loose){must(n>=0,'negative loose');add(r,id,n);}
  for(const [,stacks] of s.machines.chests)for(const [id,n] of stacks){must(n>=0,'negative chest');add(r,id,n);}
  return r;
}
export function seedGearCost(fitting) {
  must(['spring_hilt','glow_cap'].includes(fitting),'tier 3 fitting required');
  const out={};for(const n of [...STEP_COST[3].weapon,...FITTING_COST[fitting]])add(out,n.id,n.count);return out;
}
const counts=slots=>{const out={};for(const v of slots)if(v)add(out,v.id,v.count);return out;};
const equalStock=(a,b,label)=>{for(const id of new Set([...Object.keys(a),...Object.keys(b)]))must((a[id]??0)===(b[id]??0),label+' '+id);};
const products={field:['wheat'],moss:['moss_fiber'],quill:['quill'],copper:['copper'],seed:['carrot_seeds','sunroot_seeds'],spring:['gear_spring'],pond:['frog_slick'],bee:['honey','wax'],dust:['glow_dust'],rope:['vine_rope']};
// Scope is bounded by raw saves. Transfers between bag, loose stock and collectors cancel.
// Unsupported meals, crafts or kit consumption remain a failure, never an allowance.
export function auditSeedTransactions(before,after,rows,{weapon,fitting,requireGear=true,requireWin=true}={}) {
  const expected=totalSeedStock(before),actual=totalSeedStock(after), sources=[];
  let gears=0,wins=0;const af=flagsOf(before),bag=counts(before.game.systems.inventory.slots),claimed=new Set();
  for(let i=0;i<rows.length;i++) {
    const r=rows[i],d=r.data;
    if(r.name==='gear.made') {
      must(++gears===1 && d.what===weapon && d.tier===3 && d.fitting===fitting,'unexpected/duplicate gear transaction');
      const needs=Object.entries(seedGearCost(fitting)),events=[];
      for(let j=i-1;j>=0 && events.length<needs.length;j--)if(['item.gained','item.lost'].includes(rows[j].name))events.unshift(j);
      must(events.length===needs.length,'missing gear debits');
      needs.forEach(([id,n],k)=>{const index=events[k],e=rows[index];must(!claimed.has(index) && e.name==='item.lost' && e.data.id===id && e.data.count===n,'exact gear debit '+id);claimed.add(index);add(expected,id,-n);});
      sources.push({index:i,source:'tier 3 weapon',cost:seedGearCost(fitting)});
    }
    if(r.name==='fight.ended') {
      must(d.fight===10 && d.result==='won' && !af['fight.10.won'] && ++wins===1,'unexpected/duplicate fight reward');
      const gift=rows.slice(i+1).find(r=>['item.gained','item.lost'].includes(r.name));
      must(gift?.name==='item.gained' && gift.data.id==='heartwood' && gift.data.count===1,'fight 10 exact heartwood delivery');
      add(expected,'heartwood',1);sources.push({index:i,source:'fight 10',id:'heartwood',count:1});
    }
    if(r.name==='good.made') {
      must(products[d.farm]?.includes(d.item) && Number.isSafeInteger(d.count) && d.count>0,'invalid production');
      must(r.farms?.some(f=>f.id===d.farm && f.built),'unbuilt producing farm');
      add(expected,d.item,d.count);sources.push({index:i,source:'production',...d});
    }
    if(r.name==='toast' && d.text==='Your leaftail found a seed.') {
      const prev=rows[i-1];must(prev?.name==='item.gained' && prev.data.id==='wheat_seeds' && prev.data.count===1 && prev.data.at && r.pets?.some(p=>p.bonded && Math.hypot(p.pos.x-prev.data.at.x,p.pos.y-prev.data.at.y,p.pos.z-prev.data.at.z)<.001),'unproven pet seed');
      add(expected,'wheat_seeds',1);sources.push({index:i,source:'pet seed'});
    }
    if(['item.gained','item.lost'].includes(r.name)){
      must(Number.isSafeInteger(d.count) && d.count>0 && Array.isArray(r.slots),'invalid item event snapshot');
      add(bag,d.id,(r.name==='item.gained'?1:-1)*d.count);must(bag[d.id]>=0,'negative transaction bag');
      equalStock(bag,counts(r.slots),'item snapshot');
    }
    if(['item.crafted','crop.harvested','crop.planted','creature.gave','block.broken','block.placed','placeable.placed','placeable.removed','coin.changed'].includes(r.name))throw Error('requires exact Seed audit: '+r.name);
  }
  equalStock(bag,counts(after.game.systems.inventory.slots),'unobserved bag change');
  must(!requireGear || gears===1,'missing gear transaction');must(!requireWin || wins===1,'missing fight reward');
  for(const id of new Set([...Object.keys(expected),...Object.keys(actual)]))must((expected[id]??0)===(actual[id]??0),'unexplained stock delta '+id+': expected '+(expected[id]??0)+' actual '+(actual[id]??0));
  return {pass:true,expected,actual,sources};
}
export function auditSeedVault({before,after,keyBeforeMemory,middle,middleContinued,finalHome,finalContinued,scopes,selection}) {
  assertSeedBoundary(before,after,selection);assertKeyBeforeMemory(keyBeforeMemory);
  must(!flagsOf(middle)['fight.10.won'] && flagsOf(middle)['step.seeds.stair'] && flagsOf(middle)['step.seeds.seal'],'middle checkpoint must precede keeper');
  assertSeedContinue(middle,middleContinued);assertSeedContinue(finalHome,finalContinued);
  same(after,finalContinued,'final earned checkpoint');
  return auditSeedScopes(before,after,scopes,selection);
}

// Reloads are explicit conserved boundaries, never an unlabelled flattened event stream.
export function auditSeedScopes(before,after,scopes,selection) {
  must(scopes?.length,'missing transaction scopes');
  let previous=before,gears=0,wins=0;const results=[];
  for(const scope of scopes){
    must(scope.input && scope.final && sha256(scope.input)===scope.inputSHA && sha256(scope.final)===scope.finalSHA,'changed scope bytes');
    const a=JSON.parse(scope.input),b=JSON.parse(scope.final);
    same(previous,a,'reload transaction boundary');
    const g=scope.rows.filter(r=>r.name==='gear.made').length,w=scope.rows.filter(r=>r.name==='fight.ended'&&r.data.fight===10&&r.data.result==='won').length;
    gears+=g;wins+=w;
    results.push(auditSeedTransactions(a,b,scope.rows,{...selection,requireGear:g>0,requireWin:w>0}));
    previous=b;
  }
  same(previous,after,'transaction final checkpoint');must(gears===1 && wins===1,'one fitting and keeper reward across reloads required');
  return {pass:true,results};
}
