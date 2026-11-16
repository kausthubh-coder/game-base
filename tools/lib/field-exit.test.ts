import {test,expect} from 'bun:test';
import {createKeyboardSteering} from './keyboard-steering.mjs';
import {World} from '../../src/features/world/world.sim.ts';
import {HeroBody} from '../../src/features/hero/hero.sim.ts';

test('first-night keyboard steering reaches the next field-edge nav cell',()=>{
 const world=new World(41); for(let cx=-2;cx<=3;cx++)for(let cz=-18;cz<=-12;cz++)world.load(cx,cz);
 const b=new HeroBody(world,{x:17.72135337268721,y:22,z:-230.6999},undefined,{stepUp:1});
 const goal={x:17.5,z:-231.5},yaw=-Math.PI/4;
 const steer=createKeyboardSteering();
 for(let i=0;i<150 && Math.hypot(b.x-goal.x,b.z-goal.z)>=.7;i++){
  const dx=goal.x-b.x,dz=goal.z-b.z,len=Math.hypot(dx,dz)||1;
  const {forward,right}=steer(dx,dz,yaw);
  for(let j=0;j<3;j++)b.step({moveX:-Math.sin(yaw)*forward+Math.cos(yaw)*right,moveZ:-Math.cos(yaw)*forward-Math.sin(yaw)*right,jump:false});
 }
 expect(Math.hypot(b.x-goal.x,b.z-goal.z),JSON.stringify({x:b.x,y:b.y,z:b.z})).toBeLessThan(.7);
});

// Whole path in both directions with the real body and the shared key sampler.
for(const yaw of [-Math.PI/4,Math.PI/4,3*Math.PI/4,-3*Math.PI/4]) test('field outward and return at yaw '+yaw,()=>{
 const world=new World(41);for(let cx=-2;cx<=3;cx++)for(let cz=-18;cz<=-12;cz++)world.load(cx,cz);
 const body=new HeroBody(world,{x:18,y:22,z:-224},undefined,{stepUp:1});
 for(const goal of [{x:17.5,z:-231.5},{x:17.5,z:-239},{x:17.5,z:-231.5},{x:18,z:-224}]){
  const steer=createKeyboardSteering();
  for(let i=0;i<500&&Math.hypot(body.x-goal.x,body.z-goal.z)>.2;i++){
   const {forward:f,right:r}=steer(goal.x-body.x,goal.z-body.z,yaw);
   for(let j=0;j<3;j++)body.step({moveX:-Math.sin(yaw)*f+Math.cos(yaw)*r,moveZ:-Math.cos(yaw)*f-Math.sin(yaw)*r,jump:false});
  }
  expect(Math.hypot(body.x-goal.x,body.z-goal.z),JSON.stringify(body)).toBeLessThan(.2);
 }
});

test('the field nav fallback is traversable by keyboard at cell centers', async()=>{
 const {findPath}=await import('../../src/game/nav/nav.sim.ts');
 const world=new World(41);for(let cx=-2;cx<=3;cx++)for(let cz=-18;cz<=-12;cz++)world.load(cx,cz);
 const body=new HeroBody(world,{x:18.03515665892521,y:22,z:-230.6999},undefined,{stepUp:1});
 const path=findPath(world,body,{x:18,y:world.heightAt(18,-239),z:-239},20000);
 expect(path).not.toBeNull();
 for(const goal of path!){
  const steer=createKeyboardSteering();const yaw=-Math.PI/4;
  for(let i=0;i<300&&Math.hypot(body.x-goal.x,body.z-goal.z)>.2;i++){
   const {forward:f,right:r}=steer(goal.x-body.x,goal.z-body.z,yaw);
   for(let j=0;j<3;j++)body.step({moveX:-Math.sin(yaw)*f+Math.cos(yaw)*r,moveZ:-Math.cos(yaw)*f-Math.sin(yaw)*r,jump:false});
  }
  expect(Math.hypot(body.x-goal.x,body.z-goal.z),JSON.stringify({goal,body})).toBeLessThan(.2);
 }
});
