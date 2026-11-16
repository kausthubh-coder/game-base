import { test, expect } from 'bun:test';
import { installReplayDriver } from './replay.mjs';

function fixture() {
  const previous = globalThis.window;
  const pos = {x:0,y:2,z:0};
  const keys = [];
  let advances=0;
  globalThis.window = { __replayInput: async (key, down) => { keys.push([key, down]); }, __game: {
    view:{game:{player:{pos},systems:{nav:{toward:()=>[]}}},camera:{yaw:0}},
    advance:()=>{advances++;}, key:()=>{throw Error('debug key forbidden');}
  }};
  const driver=installReplayDriver({mode:'realtime'});
  return {driver,pos,keys, advances:()=>advances, restore:()=>{globalThis.window=previous;}};
}
test('earned movement never advances simulation and rejects a stationary wrong floor',async()=>{
 const f=fixture();try {
  expect((await f.driver.walk({x:0,y:9,z:0},{seconds:.02,tickMs:1})).ok).toBe(false);
  expect(f.advances()).toBe(0);
  expect(f.keys.slice(-6).every(([,down])=>!down)).toBe(true);
 }finally{f.restore();}
});
test('earned movement rejects no progress, and succeeds only at actual arrival',async()=>{
 const f=fixture();try {
  expect((await f.driver.walk({x:10,y:2,z:0},{seconds:.02,tickMs:1})).ok).toBe(false);
  setTimeout(()=>{f.pos.x=10;},5);
  expect((await f.driver.walk({x:10,y:2,z:0},{seconds:1,tickMs:1})).ok).toBe(true);
  expect(f.advances()).toBe(0);
 }finally{f.restore();}
});
test('earned action awaits aim, press and asynchronous completion, rejecting false and out of reach',async()=>{
 const f=fixture();try {
  const order=[];const target={x:1,y:2,z:0};
  await f.driver.act(target,{reach:2,aim:async value=>{expect(value).toBe(target);await Promise.resolve();order.push('aim');},press:async()=>{order.push('press');},done:async()=>{await Promise.resolve();order.push('done');return true;}});
  expect(order).toEqual(['aim','press','done']);
  await expect(f.driver.act(target,{reach:2,aim:async()=>{},press:async()=>{},done:async()=>false})).rejects.toThrow('did not happen');
  await expect(f.driver.act({x:1,y:9,z:0},{reach:2,aim:()=>{throw Error('aimed');},press:()=>{},done:()=>true})).rejects.toThrow('out of reach');
 }finally{f.restore();}
});
test('authored route legs bypass partial replanning while still requiring actual height and arrival',async()=>{
 const f=fixture();try {
  window.__game.view.game.systems.nav.toward=()=>{throw Error('authored leg was replaced');};
  setTimeout(()=>{f.pos.x=10;},5);
  expect((await f.driver.walk({x:10,y:2,z:0},{authored:true,seconds:1,tickMs:1})).ok).toBe(true);
  expect((await f.driver.walk({x:10,y:9,z:0},{authored:true,seconds:.02,tickMs:1})).ok).toBe(false);
  expect(f.advances()).toBe(0);
 }finally{f.restore();}
});
