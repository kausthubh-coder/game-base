import { test, expect } from 'bun:test';
import fs from 'node:fs';
import { inspectGlb } from './inspect.mjs';
// Real exported files are the fixtures; corrupting one must make validation fail.
test('counts the shipped tree and rejects an incomplete export',()=>{
 const tree=fs.readFileSync(new URL('../../public/assets/models/tree-17.glb',import.meta.url));
 expect(inspectGlb(tree)).toEqual({triangles:1464,primitives:1});
 expect(()=>inspectGlb(tree.subarray(0,tree.length-4))).toThrow('invalid GLB header');
});
test('counts the small models within their declared budgets',()=>{
 for(const [name,count] of [['rock-11',188],['rock-37',188],['bush-29',280]]){
  expect(inspectGlb(fs.readFileSync(new URL(`../../public/assets/models/${name}.glb`,import.meta.url))).triangles).toBe(count);
 }
});
