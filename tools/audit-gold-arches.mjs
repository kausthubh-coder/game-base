// Audit raw earned exports. Never supplies or rewrites game state.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const out=resolve(process.argv[2]??'');
const read=name=>JSON.parse(readFileSync(resolve(out,name),'utf8'));
const must=(v,m)=>{if(!v)throw Error(m)};
const flags=s=>Object.fromEntries(s.game.flags);
const count=(s,id)=>s.game.systems.inventory.slots.reduce((n,v)=>n+(v?.id===id?v.count:0),0);
const replay=read('replay.json');
must(replay.status==='PASS','requires a complete fresh earned route');
must(replay.inputHash==='261ba7810c560e828bf46bb38efc3f90163930707c454b54543d225c42b5b909','historical copper input');
const a=read('before-maren.save.json'),b=read('after-maren.save.json');
for(const [id,n] of [['wheat_seeds',12],['hoe',1],['watering_can',1]])must(count(b,id)-count(a,id)===n,'Maren gifts '+id);
for(const name of ['middle-farming','middle-ledger','final-home']){
 const before=read(name+'.save.json'),after=read(name+'-continued.save.json');
 for(const key of ['inventory','bench','placeables','settlement','quests','goods','crops'])must(JSON.stringify(before.game.systems[key])===JSON.stringify(after.game.systems[key]),name+' persistence '+key);
 must(JSON.stringify(before.world)===JSON.stringify(after.world),name+' world');
}
const middle=read('middle-farming.save.json');
must(middle.game.systems.crops.crops.filter(c=>c[3]==='wheat'&&c[4]===0).length===12,'twelve unfinished wheat at Continue');
const sale=read('after-sale.save.json'),beforeSale=read('before-sale.save.json');
must(count(beforeSale,'wheat')-count(sale,'wheat')===10,'ten earned wheat sold');
must((flags(sale).coin??0)-(flags(beforeSale).coin??0)===20,'twenty actual coin');
must(sale.game.systems.goods.taken.granary.wheat===10,'daily sales cap progress');
const ledger=read('middle-ledger.save.json').game.systems.goods;
must(ledger.picked==='granary'&&ledger.ledger.granary.wheat===14&&ledger.ledger.granary.moss_fiber===10,'actual granary deliveries');
const end=read('earned-gold.save.json'),f=flags(end);
must(f['quest.count.done']&&f['quest.echo.started']&&!f['scene.24'],'exact Gold boundary');
must(f['scene.22']&&f['scene.23']&&f['fight.5.won'],'actual scenes and lynx victory');
for(const n of [22,23])must(replay.scenes.filter(v=>v.scene===n).length===1,'once-only scene '+n);
const expectedBench={...a.game.systems.bench,made:[...a.game.systems.bench.made,'lantern']};
must(JSON.stringify(end.game.systems.bench)===JSON.stringify(expectedBench),'exact gear, kit and the newly crafted lamp recipe');
must(end.game.systems.placeables.placed.filter(p=>p.kind==='lantern').length===a.game.systems.placeables.placed.filter(p=>p.kind==='lantern').length+1,'one actual crafted home lamp');
must(count(end,'quill_strip')===count(a,'quill_strip')+1&&count(end,'shed_pelt')===count(a,'shed_pelt')+2,'actual once-only lynx rewards');
must(f.coin===20&&f.heartstone===3,'earned coin and Heartstone');
const pet=s=>s.game.systems.pets.pets.map(({id,trust,bonded})=>({id,trust,bonded}));
must(JSON.stringify(pet(end))===JSON.stringify(pet(a)),'companion identity trust bond');
for(const placed of a.game.systems.placeables.placed)must(end.game.systems.placeables.placed.some(p=>JSON.stringify(p)===JSON.stringify(placed)),'original building preserved');
for(const old of a.game.systems.settlement.settlers){const now=end.game.systems.settlement.settlers.find(v=>v.who===old.who);must(now&&now.job===old.job,'original resident and job '+old.who);}
for(const old of a.game.systems.farms.farms){const now=end.game.systems.farms.farms.find(v=>v.id===old.id);must(now&&now.mode===old.mode&&now.away===old.away&&now.best>=old.best,'original farm mode, absence and best '+old.id);}
for(const id of ['moss','quill','copper']){must(f['farm.'+id+'.living']===true,'settled living farm '+id);const farm=end.game.systems.farms.farms.find(v=>v.id===id);must(farm.mode==='give'&&farm.away===0,'Give farm '+id);}
must(!Object.keys(end.game.systems.goods.ledger).some(k=>k!=='granary'),'no later ledger section');
const gus=read('gus-home.json');must(gus.home&&gus.home.lit&&gus.needs.bed&&gus.needs.meal&&gus.needs.lamp,'actual Gus bed under a lit roof, fed');
const hashes=Object.fromEntries(readdirSync(out).filter(n=>n.endsWith('.save.json')).map(n=>[n,createHash('sha256').update(readFileSync(resolve(out,n))).digest('hex')]));
writeFileSync(resolve(out,'raw-audit.json'),JSON.stringify({status:'PASS',inputHash:replay.inputHash,source:replay.sha,hashes},null,2));
console.log('PASS raw earned Gold audit');
