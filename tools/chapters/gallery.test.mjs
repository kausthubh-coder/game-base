import {test,expect} from 'bun:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateGalleryStart,checkBudgets} from './gallery.mjs';
import {auditGalleryChain} from '../audit-gallery.mjs';
test('Gallery rejects edited or unrelated starting bytes',()=>{
 expect(()=>validateGalleryStart('{"version":2}')).toThrow('original-chain');
});
test('chapter budgets inspect actual values and reject missing, incorrect totals and over-budget frames',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gallery-budget-'));
 const write=(drawCalls,triangles,addsUp=true)=>writeFileSync(join(dir,'first.costs.json'),JSON.stringify([{costs:{total:{drawCalls,triangles},addsUp}}]));
 try{
  expect(()=>checkBudgets([{dir,quality:'low'}])).toThrow('missing');
  write(80,150000);expect(checkBudgets([{dir,quality:'low'}])).toBe(true);
  write(81,100);expect(()=>checkBudgets([{dir,quality:'low'}])).toThrow('exceeded');
  write(80,150001);expect(()=>checkBudgets([{dir,quality:'low'}])).toThrow('exceeded');
  write(1,1,false);expect(()=>checkBudgets([{dir,quality:'high'}])).toThrow('exceeded');
 }finally{rmSync(dir,{recursive:true});}
});
test('a forged chain file cannot authorize an unrelated diagnostic save',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gallery-chain-'));
 try{
  writeFileSync(join(dir,'resume-boundary.save.json'),'diagnostic');
  writeFileSync(join(dir,'chain.json'),'{"pass":true}');
  expect(()=>auditGalleryChain(dir)).toThrow('checkpoint hash');
 }finally{rmSync(dir,{recursive:true});}
});
test('every requested view needs cost samples',()=>{
 const populated=mkdtempSync(join(tmpdir(),'gallery-populated-'));
 const empty=mkdtempSync(join(tmpdir(),'gallery-empty-'));
 try {
  writeFileSync(join(populated,'scene.costs.json'),JSON.stringify([{costs:{total:{drawCalls:1,triangles:1},addsUp:true}}]));
  expect(()=>checkBudgets([{dir:populated,quality:'high'},{dir:empty,quality:'low'}])).toThrow('missing');
 } finally {rmSync(populated,{recursive:true});rmSync(empty,{recursive:true});}
});
test('cost evidence rejects absent, nonnumeric and negative measurements',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gallery-invalid-costs-'));
 try {
  for(const value of [undefined,null,'1',-1]) {
   for(const field of ['drawCalls','triangles']) {
    const total={drawCalls:1,triangles:1,[field]:value};
    writeFileSync(join(dir,'scene.costs.json'),JSON.stringify([{costs:{total,addsUp:true}}]));
    expect(()=>checkBudgets([{dir,quality:'low'}])).toThrow('invalid');
   }
  }
 } finally {rmSync(dir,{recursive:true});}
});
