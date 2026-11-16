import {test,expect} from 'bun:test';
import {loadPlay} from '../play/harness.sim.ts';
import {readFileSync} from 'node:fs';
test('the caves rootsnare can be reached from its earned western approach',()=>{
 const save=JSON.parse(readFileSync('.artifacts/uphill-input/attempt-14/earned-uphill.save.json','utf8'));
 const p=loadPlay(save);p.teleport({x:214.5,z:-297.5});p.advance(.2);
 const run=p.sys.fights.running!()!;expect(run.n).toBe(8);
 const b=run.fight.beasts[0]!;const to={x:b.x,y:p.game.world.heightAt(Math.floor(b.x),Math.floor(b.z)),z:b.z};
 expect(p.sys.nav.path(p.game.player.pos,to,20000)).not.toBeNull();
});
