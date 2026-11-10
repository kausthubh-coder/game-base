import { expect, test } from 'bun:test';
import { ambientLayers, windLevel } from './ambience.sim.ts';
const pick = (day=1, rain=0, town=0, trees=0.5, water=0, indoors=0) => ambientLayers(day,rain,town,trees,water,indoors,{birds:0,owl:0,town:0,water:0,rain:0,leaves:0});
test('calm wind can fall quiet rather than having a permanent hiss floor',()=>{
 expect(windLevel(0,0.5)).toBe(0);
 expect(windLevel(0.2,0.4)).toBeLessThan(0.015);
});
test('day meadow and trees have birds; midnight has owl instead',()=>{
 expect(pick().birds).toBeGreaterThan(0);
 expect(pick(1,0,0,1).birds).toBeGreaterThan(pick(1,0,0,0).birds);
 expect(pick(0).birds).toBe(0);expect(pick(0).owl).toBeGreaterThan(0);expect(pick().owl).toBe(0);
});
test('town activity follows town and daytime; water follows proximity',()=>{
 expect(pick().town).toBe(0);expect(pick(1,0,1).town).toBe(1);
 expect(pick(0,0,1).town).toBeLessThan(pick(1,0,1).town);
 expect(pick().water).toBe(0);expect(pick(1,0,0,0,1).water).toBe(1);
});
test('rain shelters birds and buildings shelter outdoor layers',()=>{
 expect(pick(1,1).birds).toBe(0);expect(pick(1,1).rain).toBe(1);
 expect(pick(1,0,0,1,1,1).water).toBeLessThan(pick(1,0,0,1,1,0).water);
});
test('all habitat transitions are continuous and bounded',()=>{
 for(let i=0;i<100;i++){const a=pick(i/100,i/100,i/100,i/100,i/100),b=pick((i+1)/100,(i+1)/100,(i+1)/100,(i+1)/100,(i+1)/100);for(const key of Object.keys(a) as (keyof typeof a)[]){expect(a[key]).toBeGreaterThanOrEqual(0);expect(a[key]).toBeLessThanOrEqual(1);expect(Math.abs(a[key]-b[key])).toBeLessThan(0.04);}}
});
