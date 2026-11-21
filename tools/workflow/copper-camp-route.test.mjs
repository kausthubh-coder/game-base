import {expect,test} from 'bun:test';
import {clearCampTent} from '../../src/game/region/ground.sim.ts';
import {CAMP} from '../../src/game/content/region.ts';
import {campContains, campSegmentBlocked, planCampRoute} from '../lib/copper-camp-route.mjs';
const cases=[
 ['original home',[-15.467,-229.455],[-15.5,-233.5],3],
 ['Dax escort',[-13.5,-240.5],[-18,-222],.3],
 ['west failed position',[-19.0159,-232.452],[-18,-222],.3],
 ['west visitor',[-15.1392,-231.5739],[-27.9185,-229.0737],2],
 ['moving Dax west',[-18,-222],[-22.7868,-231.2132],.3],
 ['east from west visitor',[-27.9185,-229.0737],[-15.5,-233.5],3],
 ['watch to yard',[-23,-223],[-18,-222],.3],
 ['bench home',[-1.284,-222.7],[-15.5,-233.5],3],
];
for(const[name,a,b,near]of cases)test(name+' keeps every leg outside the authored tent and reaches the original tolerance',()=>{
 const start={x:a[0],z:a[1]},goal={x:b[0],z:b[1]},route=planCampRoute(start,goal,near,CAMP);
 let previous=start;for(const point of route){expect(campContains(point,CAMP)).toBe(false);expect(campSegmentBlocked(previous,point,CAMP)).toBe(false);for(let t=0;t<=1;t+=.02){const at={x:previous.x+(point.x-previous.x)*t,y:CAMP.ground,z:previous.z+(point.z-previous.z)*t};expect(clearCampTent(at)).toBe(false);}previous=point;}
 expect(Math.hypot(previous.x-goal.x,previous.z-goal.z)).toBeLessThan(near);
});
test('the real fallback interior grid nodes are rejected',()=>{
 for(const[x,z]of[[-15.5,-231.5],[-18.5,-232.5],[-17.5,-231.5]])expect(campContains({x,z},CAMP)).toBe(true);
});
test('an unreachable final point fails rather than widening arrival',()=>{
 expect(()=>planCampRoute({x:-10,z:-231.5},{x:-17,z:-231.5},.2,CAMP)).toThrow('arrival');
});
test('an already reached clear goal needs no movement',()=>expect(planCampRoute({x:-10,z:-225},{x:-10,z:-225},.3,CAMP)).toEqual([]));
