import {test,expect} from 'bun:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runSeedCommand} from '../seed-vault-session.mjs';
import {auditSeedScopes} from '../audit-seed-vault.mjs';
import {sha256} from './seed-vault-contract.mjs';
// Synthetic lifecycle fixtures only. No browser, server, game simulation or accepted evidence.
test('CLI rejects absent and invalid Light before session, launch or chapter report',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'seed-cli-'));
 try {for(const config of [{},{handoff:{savePath:join(dir,'save'),reportPath:join(dir,'report'),acceptedSHA:'0'.repeat(64)}}]){
 writeFileSync(join(dir,'save'),'{}');writeFileSync(join(dir,'report'),JSON.stringify({id:'lights',status:'failed'}));writeFileSync(join(dir,'config'),JSON.stringify(config));let sessions=0,reports=0;
 await expect(runSeedCommand([join(dir,'config')],{sessionFactory:async()=>{sessions++;},chapterFactory:()=>{reports++;}})).rejects.toThrow();
 expect(sessions).toBe(0);expect(reports).toBe(0);
 }}finally{rmSync(dir,{recursive:true,force:true});}
});
const save=(slots,flags=[])=>({game:{flags,systems:{inventory:{slots},machines:{loose:[],chests:[]}}}});
const scope=(a,b,rows)=>{const input=JSON.stringify(a),final=JSON.stringify(b);return {input,inputSHA:sha256(input),final,finalSHA:sha256(final),rows};};
function fixtures(){
 const a=save([{id:'gear_spring',count:7},{id:'old_brass',count:2}]),b=save([]),c=save([{id:'heartwood',count:1}]);
 const scopes=[scope(a,b,[{name:'item.lost',data:{id:'gear_spring',count:7},slots:[{id:'old_brass',count:2}]},{name:'item.lost',data:{id:'old_brass',count:2},slots:[]},{name:'gear.made',data:{what:'staff',tier:3,fitting:'spring_hilt'}}]),scope(b,c,[{name:'fight.ended',data:{fight:10,result:'won'}},{name:'item.gained',data:{id:'heartwood',count:1},slots:[{id:'heartwood',count:1}]}])];return {a,b,c,scopes};
}
const selection={weapon:'staff',fitting:'spring_hilt'};
test('reload scopes reconcile exact independent bags and require one gear and win across reloads',()=>{const {a,c,scopes}=fixtures();expect(auditSeedScopes(a,c,scopes,selection).pass).toBe(true);});
test('changed scope bytes, skipped reload boundary and duplicate reward fail',()=>{
 for(const mutate of [f=>f.scopes[1].input+=' ',f=>{const altered=save([{id:'copper',count:1}]);Object.assign(f.scopes[1],{input:JSON.stringify(altered),inputSHA:sha256(JSON.stringify(altered))});},f=>f.scopes[1].rows.push(f.scopes[1].rows[0])]){
 const f=fixtures();mutate(f);expect(()=>auditSeedScopes(f.a,f.c,f.scopes,selection)).toThrow();}
});
test('scope audit rejects unobserved gains even when reload hashes are internally consistent',()=>{const f=fixtures();f.scopes[1].rows.pop();expect(()=>auditSeedScopes(f.a,f.c,f.scopes,selection)).toThrow('heartwood');});
test('CLI preflight failure releases exactly once and never constructs earned chapter',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'seed-cli-cleanup-'));
 try {writeFileSync(join(dir,'config'),JSON.stringify({mode:'preflight'}));let released=0,reports=0,actions=0;
 await expect(runSeedCommand([join(dir,'config')],{
  validate:()=>({raw:'synthetic',provenance:{source:'synthetic'}}),
  sessionFactory:async()=>({collectPreflight:async()=>{throw Error('interior fixture failed');},release:async()=>{released++;},startEarned:()=>{actions++;}}),
  chapterFactory:()=>{reports++;},
 })).rejects.toThrow('interior fixture failed');expect(released).toBe(1);expect(reports).toBe(0);expect(actions).toBe(0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
