import {expect,test} from 'bun:test';
import * as THREE from 'three';
import {createEvents,createFlags} from '../kernel.sim.ts';
import {CAMP} from '../content/region.ts';
import {install} from './story-stage.view.ts';
import type {GameView} from '../shell/view.ts';
import type {Actor} from '../api.sim.ts';

function fixture(unsafe=false,block: (x:number,y:number,z:number)=>string|null=()=>null){
 const events=createEvents(),flags=createFlags(events);flags.set('camp.pitched',true);
 const p={x:CAMP.tent.x,y:CAMP.tent.y,z:CAMP.tent.z};
 const actor=(id:string,x:number,z:number):Actor=>({id,sprite:'hero',pos:{x,y:p.y,z},facing:0,anim:'idle',visible:true,mark:''});
 const actors=new Map<string,Actor>([['stage:maren',actor('stage:maren',p.x+4,p.z-4)],['stage:gus',actor('stage:gus',p.x+7,p.z-4)]]);
 const lens=new THREE.PerspectiveCamera(40,1.8,.1,800);lens.position.set(p.x+12,p.y+12,p.z+12);lens.lookAt(p.x,p.y,p.z);lens.updateMatrixWorld();
 const moves:unknown[]=[];const frames:((dt:number)=>void)[]=[];
 const view={ctx:{camera:lens,scene:new THREE.Scene(),quality:'low',ambient:{timeOfDay:.5}},game:{events,flags,actors,player:{pos:p},world:{getBlock:()=>unsafe?3:0,heightAt:()=>p.y},systems:{talk:{active:false},region:{place:()=>({at:{x:p.x,y:p.y,z:p.z}})}}},root:{clientHeight:768,querySelector:()=>null,classList:{contains:()=>false}},hero:{body:{facing:0},teleport:(x:number,y:number,z:number)=>{moves.push({x,y,z});Object.assign(p,{x,y,z})}},world:{sim:{}},blocked:block,onFrame:(fn:(dt:number)=>void)=>{frames.push(fn);return()=>{}}} as unknown as GameView;
 install(view);return {events,p,moves,actors,frames,view};
}
test('scene 27 rejects a hero inside canvas even with a clear chest ray',()=>{
 const f=fixture();f.events.emit('talk.started',{npc:'maren',conversation:'scene.27'});expect(f.moves.length).toBe(1);
 const dx=f.p.x-CAMP.tent.x,dz=f.p.z-CAMP.tent.z,c=Math.cos(CAMP.tent.rotation),s=Math.sin(CAMP.tent.rotation);
 expect(Math.abs(c*dx-s*dz)>=CAMP.tentClearance.halfWidth||Math.abs(s*dx+c*dz)>=CAMP.tentClearance.halfDepth).toBe(true);
});
test('exhausted unsafe marks never teleport the hero into the unchecked first candidate',()=>{
 const f=fixture(true),before={...f.p};f.events.emit('talk.started',{npc:'maren',conversation:'scene.27'});expect(f.moves).toEqual([]);expect(f.p).toEqual(before);
});

test('nearby scheduled speakers use distinct stand-ins and restore on completion or interruption',async()=>{
 const {createSceneRunner}=await import('../story/scenes.sim.ts');
 for(const replacement of [false,true]){
 const events=createEvents(),flags=createFlags(events),actors=new Map<string,Actor>();
 const originals=['maren','gus','aldric'].map((id,i):Actor=>({id:'npc:'+id,sprite:id,pos:{x:i,y:20,z:0},facing:.3,anim:'walk',visible:true,mark:''}));
 for(const a of originals)actors.set(a.id,a);const before=structuredClone(originals);
 const game={events,flags,actors,player:{pos:{x:0,y:20,z:0}},world:{heightAt:()=>20},systems:{people:{get:(id:string)=>actors.get('npc:'+id)},region:{place:()=>({at:{x:0,y:20,z:0}})}}};
 createSceneRunner(game as never);events.emit('talk.started',{npc:'maren',conversation:'scene.27'});
 expect(originals.every(a=>!a.visible)).toBe(true);
 expect(['maren','gus','aldric'].map(id=>actors.get('stage:'+id)?.pos.x)).toEqual([2,5,-2]);
 if(replacement)events.emit('talk.started',{npc:'',conversation:'talk.vaults'});else events.emit('talk.ended',{npc:'maren',conversation:'scene.27'});
 expect([...actors.keys()].filter(id=>id.startsWith('stage:'))).toEqual([]);expect(originals).toEqual(before);
 }
});


test('a blocked stand-in does not step into another actor',()=>{
 const f=fixture(false,(x,_y,z)=>Math.abs(x-CAMP.tent.x-4)<.01&&Math.abs(z-CAMP.tent.z+4)<.01?'stone':null);
 // Place Gus on Maren's first side-step. The search must reject that otherwise clear mark.
 const a=f.actors.get('stage:maren')!,b=f.actors.get('stage:gus')!;
 b.pos.x=a.pos.x+1.5/Math.sqrt(2);b.pos.z=a.pos.z-1.5/Math.sqrt(2);
 f.events.emit('talk.started',{npc:'maren',conversation:'scene.27'});
 expect(Math.hypot(a.pos.x-b.pos.x,a.pos.z-b.pos.z)).toBeGreaterThanOrEqual(2.5);
});


test('scene 27 clears a passing NPC from the shot and restores it on interruption',()=>{
 const f=fixture();const a:Actor={id:'npc:dax',sprite:'hero',pos:{...f.p},facing:0,anim:'walk',visible:true,mark:''};f.actors.set(a.id,a);
 f.events.emit('talk.started',{npc:'maren',conversation:'scene.27'});
 const talk=f.view.game.systems.talk as unknown as {active:boolean;current:()=>unknown};talk.active=true;talk.current=()=>({scene:27,kind:'film',text:'hello',npc:'maren',choices:[]});
 const before=globalThis.getComputedStyle;globalThis.getComputedStyle=(()=>({getPropertyValue:()=>''})) as unknown as typeof getComputedStyle;
 try { f.frames.at(-1)!(.1);expect(a.visible).toBe(false);f.events.emit('talk.ended',{npc:'maren',conversation:'scene.27'});expect(a.visible).toBe(true);expect(a.anim).toBe('walk'); }
 finally {globalThis.getComputedStyle=before;}
});

test('portrait scene framing keeps the spread cast inside the horizontal picture',()=>{
 const f=fixture();
 f.p.x+=30; f.p.z+=30;
 const lens=f.view.ctx.camera as THREE.PerspectiveCamera;
 lens.aspect=390/844;lens.updateProjectionMatrix();
 const origin=new THREE.Vector3(f.p.x+12,f.p.y+12,f.p.z+12);
 const aim=new THREE.Vector3(f.p.x,f.p.y,f.p.z);
 const side=new THREE.Vector3(1,0,-1).normalize();
 for(const [i,a] of [...f.actors.values()].entries()){
   a.pos.x=f.p.x+side.x*(i?9:-9);a.pos.z=f.p.z+side.z*(i?9:-9);
 }
 const talk=f.view.game.systems.talk as unknown as {active:boolean;current:()=>unknown};
 const oldStyle=globalThis.getComputedStyle;
 globalThis.getComputedStyle=(()=>({getPropertyValue:()=>''})) as unknown as typeof getComputedStyle;
 try{
   lens.position.copy(origin);lens.lookAt(aim);lens.updateMatrixWorld();
   f.events.emit('talk.started',{npc:'maren',conversation:'scene.27'});
   talk.active=true;talk.current=()=>({scene:27,kind:'film',text:'hello',npc:'maren',choices:[]});
   for(let step=0;step<20;step++){
     lens.position.copy(origin);lens.lookAt(aim);lens.updateMatrixWorld();
     f.frames.at(-1)!(.1);lens.updateMatrixWorld();
   }
   const right=new THREE.Vector3().setFromMatrixColumn(lens.matrixWorld,0);
   for(const at of [f.p,...[...f.actors.values()].map(a=>a.pos)]){
     for(const edge of [-.75,.75]){
       const projected=new THREE.Vector3(at.x,at.y+1,at.z).addScaledVector(right,edge).project(lens);
       expect(Math.abs(projected.x)).toBeLessThan(.92);
     }
   }
 }finally{globalThis.getComputedStyle=oldStyle;}
});

test('memory 28 moves a stand-in whose lower body is covered despite a clear chest',()=>{
 const x=CAMP.tent.x+4,z=CAMP.tent.z-4;
 const f=fixture(false,(px,y,pz)=>Math.hypot(px-x,pz-z)<1&&y<CAMP.tent.y-.3?'vaultDais':null);
 const a={...f.actors.get('stage:maren')!,id:'stage:auren',sprite:'auren'};
 f.actors.clear();f.actors.set(a.id,a);
 f.events.emit('talk.started',{npc:'',conversation:'scene.28'});
 expect(Math.hypot(a.pos.x-x,a.pos.z-z)).toBeGreaterThanOrEqual(1);
});

test('memory 28 rejects solid candidate cells and preserves the hero mark',()=>{
 const f=fixture(true,()=>null),before={...f.p};
 const a={...f.actors.get('stage:maren')!,id:'stage:auren',sprite:'auren'};
 f.actors.clear();f.actors.set(a.id,a);
 const at={...a.pos};
 f.view.blocked=(_x,y,_z)=>y<CAMP.tent.y-.3?'dais':null;
 f.events.emit('talk.started',{npc:'',conversation:'scene.28'});
 expect(a.pos).toEqual(at);expect(f.p).toEqual(before);expect(f.moves).toEqual([]);
});

test('memory 28 rejects candidates with a blocked upper body',()=>{
 const x=CAMP.tent.x+4,z=CAMP.tent.z-4;
 const f=fixture(false,(px,y,pz)=>(Math.hypot(px-x,pz-z)<1&&y<CAMP.tent.y-.3)||(y<CAMP.tent.y&&y>CAMP.tent.y-.35)?'vault piece':null);
 const a={...f.actors.get('stage:maren')!,id:'stage:auren',sprite:'auren'};
 f.actors.clear();f.actors.set(a.id,a);const at={...a.pos};
 f.events.emit('talk.started',{npc:'',conversation:'scene.28'});
 expect(a.pos).toEqual(at);
});

test('memory 28 restores original actors on completion and interruption',async()=>{
 const {createSceneRunner}=await import('../story/scenes.sim.ts');
 for(const replacement of [false,true]){
  const events=createEvents(),flags=createFlags(events);
  const actor=(id:string):Actor=>({id,sprite:'hero',pos:{x:0,y:26,z:0},facing:.3,anim:'walk',visible:true,mark:''});
  const hero=actor('player'),auren=actor('npc:auren');
  const actors=new Map([[hero.id,hero],[auren.id,auren]]),before=structuredClone([...actors]);
  const game={events,flags,actors,player:{pos:hero.pos},world:{heightAt:()=>26},systems:{people:{get:()=>undefined},region:{place:()=>({at:{x:0,y:26,z:0}})}}};
  createSceneRunner(game as never);events.emit('talk.started',{npc:'',conversation:'scene.28'});
  expect(hero.visible).toBe(false);expect(actors.has('stage:auren')).toBe(true);
  if(replacement)events.emit('talk.started',{npc:'',conversation:'talk.vaults'});else events.emit('talk.ended',{npc:'',conversation:'scene.28'});
  expect([...actors]).toEqual(before);
 }
});
