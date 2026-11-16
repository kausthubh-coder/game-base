import {test,expect} from 'bun:test';
import {holdFirstnightBlock} from './firstnight-input.mjs';
const cell=[20,22,-225];
const target=(x=10)=>({block:19,aim:[...cell],at:{x,y:20}});
function browser(samples) {
  const calls=[];
  return {calls,page:{evaluate:async()=>{if(!samples.length)throw Error('unexpected extra observation');return samples.shift();},mouse:{move:async(x,y)=>calls.push(['move',x,y]),down:async()=>calls.push(['down']),up:async()=>calls.push(['up'])},waitForTimeout:async()=>{}}};
}
test('the hold follows the camera and releases as soon as the requested block is gone',async()=>{
 const f=browser([target(10),target(11),{block:0,aim:[20,21,-225],at:{x:12,y:20}}]);
 await holdFirstnightBlock(f.page,cell);
 expect(f.calls).toEqual([['down'],['move',10,20],['move',11,20],['up']]);
});
test('another block under the pointer is released before aim is reacquired',async()=>{
 const f=browser([target(),{block:19,aim:[20,21,-225],at:{x:13,y:20}},target(14),{block:0,aim:null,at:null}]);
 await holdFirstnightBlock(f.page,cell);
 expect(f.calls).toEqual([['down'],['move',10,20],['up'],['move',13,20],['down'],['move',14,20],['up']]);
});
test('the initial press requires the exact target, and errors still release the button',async()=>{
 const f=browser([{block:19,aim:[19,22,-225],at:{x:9,y:20}},target()]);
 await expect(holdFirstnightBlock(f.page,cell)).rejects.toThrow('unexpected extra observation');
 expect(f.calls).toEqual([['move',9,20],['down'],['move',10,20],['up']]);
});
