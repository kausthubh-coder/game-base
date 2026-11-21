import {test,expect} from 'bun:test';
import {galleryShotRay} from '../play-gallery.mjs';

// The recorded failed ray crosses the tree at x=216,z=-294.
function query(from,target,solid) {
  const prior=globalThis.window;
  globalThis.window={__game:{view:{game:{systems:{fights:{running:()=>({fight:{hero:from},stage:{solid,inside:()=>true}})}}}}}};
  try{return galleryShotRay(target);}finally{globalThis.window=prior;}
}
const tree=(x,z)=>x>=216&&x<217&&z>=-294&&z< -293;
test('recorded rootsnare vine ray is blocked before attack',()=>{
  const ray=query({x:216.00462513498877,z:-291.81655616534425},[216.03545517145912,-297.0844604258598],tree);
  expect(ray.clear).toBe(false);
  expect(tree(ray.blocked.x,ray.blocked.z)).toBe(true);
});
test('moving around the tree opens the same target ray',()=>{
  expect(query({x:215,z:-295},[216.03545517145912,-297.0844604258598],tree).clear).toBe(true);
});
test('obstacles beyond the target do not prevent a shot',()=>{
  expect(query({x:0,z:0},[0,-2],(_x,z)=>z< -3).clear).toBe(true);
});
