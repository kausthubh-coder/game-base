import {expect,test} from 'bun:test';
import {firstnightIssues} from './firstnight-framing.mjs';
// Actual settled earned-approach projection at b4602de2; the Custodian's chest is behind the hero's head.
import frame from './firstnight-overlap.fixture.json';
test('earned Custodian body behind the hero is reported separately from scenery',()=>{
 expect(firstnightIssues(frame)).toContain('npc:custodian: chest overlapped by player');
 expect(frame.sight).toEqual([]);
});
test('separate bodies are clear and a missing Custodian fails',()=>{
 const separate=structuredClone(frame);separate.actors[1].chest.x=900;separate.actors[1].face.x=900;
 expect(firstnightIssues(separate)).toEqual([]);
 separate.actors.pop();expect(firstnightIssues(separate)).toContain('npc:custodian: body cropped');
});
test('scenery obstruction and cropped feet remain failures',()=>{
 const f=structuredClone(frame);f.actors[0].inFrame=false;f.sight=[{who:'player',inFrame:true,hiddenBy:'boulders: Mesh'}];
 expect(firstnightIssues(f)).toContain('player: body cropped');
 expect(firstnightIssues(f)).toContain('player: hidden by boulders: Mesh');
});

import blessing from './blessing-slope.fixture.json';
test('earned blessing slope hides Elowen despite settled camera',()=>{
 expect(firstnightIssues(blessing)).toContain('stage:elowen: hidden by land: land-sheet');
});
test('crowd body can hide a required speaker independently of scenery',()=>{
 const f=structuredClone(frame);f.actors[0].id='crowd:0';f.sight=[{who:'npc:custodian',inFrame:true}];
 f.actors.push({...f.actors[0],id:'player',depth:-999,inFrame:true,face:null,chest:null});
 expect(firstnightIssues(f)).toContain('npc:custodian: chest overlapped by crowd:0');
});

import wren from './greywood-wren.fixture.json';
test('a stage Wren and the fight companion cannot both stand in the scene',()=>{
 expect(firstnightIssues(wren)).toContain('duplicate stage and fight companion: wren');
 const single=structuredClone(wren);single.actors=single.actors.filter(a=>a.id!=='stage:wren');
 expect(firstnightIssues(single)).not.toContain('duplicate stage and fight companion: wren');
});

import {companionBounds} from './firstnight-framing.mjs';
import manifest from '../../public/assets/manifest.json';
test('fox body observations use its shipped sheet size, while Wren remains human sized',()=>{
 const fox=manifest.sprites.fox;
 expect(companionBounds('fox')).toEqual({height:fox.worldHeight,halfWidth:fox.worldHeight*fox.frame[0]/fox.frame[1]/2});
 expect(companionBounds('wren')).toEqual({height:1.8,halfWidth:.45});
});

test('memory scenes check their visible cast while the present-day hero is deliberately hidden',()=>{
 const f=structuredClone(frame);f.line={scene:24};f.actors=f.actors.filter(a=>a.id!=='player');f.sight=[];
 expect(firstnightIssues(f)).not.toContain('player: body cropped');
 f.line={scene:23};expect(firstnightIssues(f)).toContain('player: body cropped');
});
