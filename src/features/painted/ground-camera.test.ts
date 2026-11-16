import {expect, test} from 'bun:test';
import {groundCameraRise} from './ground-camera.ts';
const eye={x:0,y:6,z:12},feet={x:0,y:0,z:0};
test('a foreground ridge clears the feet without moving terrain or body',()=>{
 const ground=(_x:number,z:number)=>z>3&&z<5?3:0;
 const rise=groundCameraRise(eye,feet,ground);
 expect(rise).toBeGreaterThan(0);
 expect(groundCameraRise({...eye,y:eye.y+rise},feet,ground)).toBeCloseTo(0,8);
 expect(feet).toEqual({x:0,y:0,z:0});
});
test('clear ground and underground bodies retain the requested lens',()=>{
 expect(groundCameraRise(eye,feet,()=>0)).toBe(0);
 expect(groundCameraRise(eye,{...feet,y:-3},()=>0)).toBe(0);
 expect(groundCameraRise(eye,feet,()=>NaN)).toBe(0);
});
