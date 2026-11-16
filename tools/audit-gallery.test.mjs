import {test,expect} from 'bun:test';
import {auditScope,auditGallery} from './audit-gallery.mjs';
const initial=()=>({game:{flags:[],systems:{inventory:{slots:[]},machines:{loose:[]},bench:{made:[]},pets:{pets:[]}}}});
const gained=(id,count)=>({name:'item.gained',data:{id,count},slots:[{id,count}]});
const run=rows=>auditScope({label:'fixture',rows,checkpoints:[]},initial(),()=>{throw Error('unexpected checkpoint')});
test('observed rootsnare win attributes exactly two vine ropes',()=>expect(run([{name:'fight.ended',data:{fight:8,result:'won'}},gained('vine_rope',2)])[0].count).toBe(2));
test('observed Lamplighter win attributes exactly one brass',()=>expect(run([{name:'fight.ended',data:{fight:9,result:'won'}},gained('old_brass',1)])[0].count).toBe(1));
test('unobserved reward cannot be accepted',()=>expect(()=>run([gained('vine_rope',2)])).toThrow('unattributed gain'));
test('wrong reward count fails',()=>expect(()=>run([{name:'fight.ended',data:{fight:8,result:'won'}},gained('vine_rope',3)])).toThrow('exact item.gained'));
test('repeated win cannot authorize a duplicated reward',()=>expect(()=>run([{name:'fight.ended',data:{fight:8,result:'won'}},gained('vine_rope',2),{name:'fight.ended',data:{fight:8,result:'won'}},gained('vine_rope',2)])).toThrow('duplicate fight win'));

import {readFileSync} from 'node:fs';
function completedFixture(){
 const a=JSON.parse(readFileSync('.artifacts/uphill-input/attempt-14/earned-uphill.save.json','utf8')),b=structuredClone(a);
 b.game.flags=Object.entries({...Object.fromEntries(b.game.flags),'keystone.2':true,'quest.gallery.done':true,'quest.lights.started':true});b.game.systems.ruins.eyes=6;
 return [a,b];
}
test('preservation audit accepts a bounded synthetic completion fixture',()=>expect(()=>auditGallery(...completedFixture())).not.toThrow());
test('preservation audit rejects a changed settler job',()=>{const [a,b]=completedFixture();b.game.systems.settlement.settlers[0].job='watch';expect(()=>auditGallery(a,b)).toThrow('settler job');});
test('preservation audit rejects a removed farm',()=>{const [a,b]=completedFixture();b.game.systems.farms.farms.pop();expect(()=>auditGallery(a,b)).toThrow('farm identity');});
