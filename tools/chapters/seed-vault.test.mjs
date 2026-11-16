import {test,expect} from 'bun:test';
import {seedGearCost,auditSeedTransactions,totalSeedStock} from '../audit-seed-vault.mjs';
import {sha256,validateSeedHandoff,assertKeyBeforeMemory,assertSeedContinue} from './seed-vault-contract.mjs';
import {seedCombatPlan} from '../play-seed-vault.mjs';
// Explicit synthetic fixtures. These never establish earned evidence.
const save=(slots=[],flags=[])=>({game:{flags,systems:{inventory:{slots},machines:{loose:[],chests:[]}}}});
const initial=()=>save([{id:'gear_spring',count:7},{id:'old_brass',count:2}]);
const final=()=>save([{id:'heartwood',count:1}]);
const rows=()=>[
 {name:'item.lost',data:{id:'gear_spring',count:7},slots:[{id:'old_brass',count:2}]},
 {name:'item.lost',data:{id:'old_brass',count:2},slots:[]},
 {name:'gear.made',data:{what:'staff',tier:3,fitting:'spring_hilt'}},
 {name:'fight.ended',data:{fight:10,result:'won'}},
 {name:'item.gained',data:{id:'heartwood',count:1},slots:[{id:'heartwood',count:1}]}];
const selection={weapon:'staff',fitting:'spring_hilt'};
test('selected fitting adds to weapon base cost',()=>{
 expect(seedGearCost('spring_hilt')).toEqual({gear_spring:7,old_brass:2});
 expect(seedGearCost('glow_cap')).toEqual({gear_spring:4,old_brass:2,glow_dust:2});
});
test('exact debit and one heartwood reconcile',()=>expect(auditSeedTransactions(initial(),final(),rows(),selection).pass).toBe(true));
test('missing fitting debit fails',()=>{const s=final();s.game.systems.inventory.slots.push({id:'gear_spring',count:3});expect(()=>auditSeedTransactions(initial(),s,rows(),selection)).toThrow('unobserved bag change');});
test('duplicate fight and unobserved gear fail',()=>{
 expect(()=>auditSeedTransactions(initial(),final(),[...rows(),rows()[3]],selection)).toThrow('duplicate');
 expect(()=>auditSeedTransactions(initial(),final(),rows().filter(r=>r.name!=='gear.made'),selection)).toThrow('missing gear');
});
test('fight 9 and wrong selected fitting fail',()=>{
 const r=rows();r[3].data.fight=9;expect(()=>auditSeedTransactions(initial(),final(),r,selection)).toThrow();
 expect(()=>auditSeedTransactions(initial(),final(),rows(),{...selection,fitting:'glow_cap'})).toThrow();
});
test('stock transfers do not create inventory; kit references are not stock',()=>{
 const a=save([{id:'quill_strip',count:1}]);a.game.systems.bench={kit:['quill_strip',null,null]};
 const b=save();b.game.systems.machines.chests=[['chest', [['quill_strip',1]]]];
 expect(totalSeedStock(a)).toEqual({quill_strip:1});
 expect(auditSeedTransactions(a,b,[{name:'item.lost',data:{id:'quill_strip',count:1},slots:[]}],{requireGear:false,requireWin:false}).pass).toBe(true);
 b.game.systems.machines.chests=[];expect(()=>auditSeedTransactions(a,b,[],{requireGear:false,requireWin:false})).toThrow();
});
test('production must belong to an observed built farm',()=>{
 const a=save(),b=save(),r={name:'good.made',data:{farm:'spring',item:'gear_spring',count:1},farms:[{id:'spring',built:true}]};
 b.game.systems.machines.loose=[['gear_spring',1,0,0,0]];
 expect(auditSeedTransactions(a,b,[r],{requireGear:false,requireWin:false}).pass).toBe(true);
 expect(()=>auditSeedTransactions(a,b,[{...r,farms:[]}],{requireGear:false,requireWin:false})).toThrow('unbuilt');
});
test('final scene flags cannot replace explicit key checkpoint',()=>{
 const s=save([], [['fight.10.won',true],['keystone.3',true]]);expect(assertKeyBeforeMemory(s)).toBe(true);
 s.game.flags.push(['scene.29',true]);expect(()=>assertKeyBeforeMemory(s)).toThrow('precede');
});
test('Continue rejects hidden inventory changes',()=>{const a=initial(),b=initial();expect(assertSeedContinue(a,b)).toBe(true);b.game.systems.inventory.slots[0].count--;expect(()=>assertSeedContinue(a,b)).toThrow('Continue inventory');});
function handoffFixture(){
 const s=save([], [['quest.lights.done',true],['keystone.1',true],['keystone.2',true],['scene.25',true],['choice.calla','shown']]);
 const raw=JSON.stringify(s),digest=sha256(raw),files={'save':raw,'other':'evidence'};
 const evidence=Object.fromEntries(['earned-save','state','continue','inventory','desktop-high','desktop-low','phone-high','phone-low'].map(k=>[k,{path:k==='earned-save'?'save':'other',sha256:k==='earned-save'?digest:sha256('evidence')}]));
 const report={id:'lights',status:'accepted',revision:'synthetic',input:{path:'other',sha256:sha256('evidence')},checks:['rules','presentation','budgets'],steps:[{pass:true}],evidence};
 const args={reportPath:'report',savePath:'save',acceptedSHA:digest,startingSave:raw};
 return {args,report,files,read:p=>p==='report'?JSON.stringify(report):files[p]};
}
test('handoff requires accepted report and coordinator exact bytes',()=>{
 const f=handoffFixture();expect(validateSeedHandoff(f.args,f.read,p=>p).sha256).toBe(f.args.acceptedSHA);
 f.report.status='preflight';expect(()=>validateSeedHandoff(f.args,f.read,p=>p)).toThrow('accepted');
});
test('Gallery substitution, absent evidence, changed bytes and unknown hash fail',()=>{
 for(const mutate of [f=>f.report.id='gallery',f=>delete f.report.evidence.inventory,f=>f.files.save+=' ',f=>f.args.acceptedSHA=undefined]) {
 const f=handoffFixture();mutate(f);expect(()=>validateSeedHandoff(f.args,f.read,p=>p)).toThrow();}
});
test('combat selects nearest pod before closed heart and rejects faint',()=>{
 const s={n:10,hero:{health:10,x:0,z:0},keeper:{body:{doing:'sweep'},heart:{open:false},parts:[{x:8,z:0},{x:2,z:0}]},shapes:[]};
 expect(seedCombatPlan(s).target).toEqual({x:2,z:0});
 s.keeper.parts=[];s.keeper.heart={open:true,x:4,z:0};expect(seedCombatPlan(s).target).toEqual(s.keeper.heart);
 s.hero.health=0;expect(()=>seedCombatPlan(s)).toThrow('fainted');
});
import {createSeedInput} from '../play-seed-vault.mjs';
import {validateSeedPresentation} from './seed-vault-preflight.mjs';
test('authored y survives the driver call; absent height and failed arrival fail',async()=>{
 const observed=[],page={exposeFunction:async()=>{},evaluate:async(fn,arg)=>{observed.push(arg);return {ok:true};},keyboard:{down:async()=>{},up:async()=>{}},mouse:{up:async()=>{}}};
 const input=await createSeedInput(page,()=>{}),goal={x:1,y:26,z:3},options={via:[{x:4,y:22,z:8}]};
 await input.walk(goal,options);expect(observed.at(-1)).toEqual({goal,options});
 await expect(input.walk({x:1,z:3})).rejects.toThrow('height');
 page.evaluate=async()=>({ok:false,why:'wrong floor'});await expect(input.walk(goal)).rejects.toThrow('walk failed');
});
function presentationFixture(){
 const samples=[],files={};
 for(const device of ['desktop','phone'])for(const quality of ['high','low'])for(const moment of ['line-1','line-2','line-3','line-4','cleanup','repeat','repeat-cleanup']){
 const image=device+quality+moment;files[image]='synthetic image '+image;const costFile=image+'.costs.json';files[costFile]=JSON.stringify([{costs:{addsUp:true,total:{drawCalls:1,triangles:1}}}]);
 samples.push({device,quality,moment,width:device==='desktop'?1366:390,height:device==='desktop'?768:844,image,sha256:sha256(files[image]),costFile,costSHA:sha256(files[costFile]),costs:{addsUp:true,total:{drawCalls:1,triangles:1}},issues:[],cleanup:{playerVisible:true,hud:true,busy:false,talk:false,stageActors:0,cameraReleased:true}});
 }
 return {manifest:{scene:29,location:'seedvault-interior',source:'synthetic',runtime:'synthetic',samples},review:{pass:true,images:Object.fromEntries(samples.map(s=>[s.image,s.sha256]))},read:p=>files[p]};
}
test('presentation requires every interior line, cleanup, review and budgets',()=>{
 const f=presentationFixture();expect(validateSeedPresentation(f.manifest,f.review,f.read)).toBe(true);
 for(const mutate of [f=>f.manifest.location='outdoors',f=>f.manifest.samples.pop(),f=>f.review.pass=false,f=>f.manifest.samples[0].costs.total.drawCalls=999999,f=>f.manifest.samples.find(s=>s.moment==='cleanup').cleanup.stageActors=1]){
 const f=presentationFixture();mutate(f);expect(()=>validateSeedPresentation(f.manifest,f.review,f.read)).toThrow();}
});
test('missing debit events and missing fight delivery cannot pass aggregate audit',()=>{
 expect(()=>auditSeedTransactions(initial(),final(),rows().filter(r=>r.name!=='item.lost'),selection)).toThrow('missing gear debits');
 expect(()=>auditSeedTransactions(initial(),final(),rows().slice(0,-1),selection)).toThrow('heartwood delivery');
});
import {play as playSeedChapter} from './seed-vault.mjs';
test('chapter without accepted Light performs no preflight or earned actions',async()=>{
 let calls=0;await expect(playSeedChapter({startingSave:null,preflight:()=>{calls++;},step:()=>{calls++;}})).rejects.toThrow('coordinator');expect(calls).toBe(0);
});
import {assertSeedBoundary} from './seed-vault-contract.mjs';
function boundaryFixture(){
 const a=save([], [['choice.calla','shown'],['quest.lights.done',true],['keystone.1',true],['keystone.2',true]]);
 Object.assign(a.game.systems,{placeables:{placed:[{id:'light-lamp',kind:'lamp',x:1,y:2,z:3}]},settlement:{settlers:[{who:'holt',job:'lamps',day:1}]},pets:{pets:[{id:'fox',trust:3,bonded:true}]},crops:{crops:[[1,2,3,'wheat',0]]},farms:{farms:[{id:'spring',mode:'give',away:0}]},goods:{ledger:{lamphouse:{glow_dust:20}}},ruins:{machines:[false,false,false],deepest:0,eyes:6,first:'pumphouse'},bench:{weapons:[{weapon:'staff',tier:2,fitting:'padded_grip'}],wielding:'staff',armor:2,kit:[null,null,null],made:[]}});
 const b=structuredClone(a);Object.assign(b.game.systems.bench.weapons[0],{tier:3,fitting:'spring_hilt'});
 for(const k of ['fight.10.won','keystone.3','scene.29','memory.seedvault','quest.seeds.done','vault.seedvault.cleared','vault.seedvault.sealed'])b.game.flags.push([k,true]);
 return {a,b};
}
test('expected equipment delta preserves Light work and later scope',()=>{
 const f=boundaryFixture();expect(assertSeedBoundary(f.a,f.b,selection)).toBe(true);
 for(const mutate of [b=>b.game.systems.placeables.placed[0].x++,b=>b.game.systems.settlement.settlers[0].job='wood',b=>b.game.systems.pets.pets[0].trust++,b=>b.game.systems.farms.farms[0].mode='take',b=>b.game.systems.crops.crops[0][3]='carrot',b=>b.game.systems.ruins.deepest=1,b=>b.game.systems.bench.armor=3,b=>b.game.flags.push(['quest.itself.done',true])]){
 const {a,b}=boundaryFixture();mutate(b);expect(()=>assertSeedBoundary(a,b,selection)).toThrow();}
});

import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('failed Seed preflight releases its owned browser session without earned actions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'seed-preflight-'));
 try {
  const f=handoffFixture();
  for(const [name,bytes] of Object.entries(f.files))writeFileSync(join(dir,name),bytes);
  f.report.input.path=join(dir,f.report.input.path);
  for(const entry of Object.values(f.report.evidence))entry.path=join(dir,entry.path);
  const reportPath=join(dir,'report');writeFileSync(reportPath,JSON.stringify(f.report));
  let released=0,actions=0;
  const run={startingSave:f.files.save,preflight:async checks=>{await checks[0].run();},step:()=>{actions++;}};
  const options={handoff:{reportPath,savePath:join(dir,'save'),acceptedSHA:f.args.acceptedSHA},
   session:{release:async()=>{released++;}},checks:{rules:async()=>{throw Error('rules failed');},presentation:async()=>true,budgets:async()=>true}};
  await expect(playSeedChapter(run,options)).rejects.toThrow('rules failed');
  expect(actions).toBe(0);expect(released).toBe(1);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
