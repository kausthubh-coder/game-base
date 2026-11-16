import {createHash} from 'node:crypto';
import {readFileSync, realpathSync} from 'node:fs';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const must = (value, message) => { if (!value) throw Error(message); };
export const same = (a,b,label) => must(JSON.stringify(a)===JSON.stringify(b), 'changed '+label);
export const flagsOf = save => Object.fromEntries(save.game.flags);

// Identity is supplied by the coordinator, never learned from a candidate file.
export function validateSeedHandoff({reportPath, savePath, acceptedSHA, startingSave}, read=readFileSync, canonical=realpathSync) {
  must(reportPath && savePath && /^[a-f0-9]{64}$/.test(acceptedSHA ?? ''), 'coordinator accepted Light report, save and exact hash required');
  const report=JSON.parse(read(reportPath,'utf8'));
  must(report.id==='lights' && report.status==='accepted', 'accepted lights chapter required');
  must(report.revision && report.input?.sha256 && report.steps?.length && report.steps.every(s=>s.pass===true), 'Light report lacks earned replay');
  must(report.input.path && sha256(read(report.input.path))===report.input.sha256,'changed Light input checkpoint');
  for(const name of ['rules','presentation','budgets']) must(report.checks?.includes(name),'missing Light '+name);
  for(const name of ['earned-save','state','continue','inventory','desktop-high','desktop-low','phone-high','phone-low']) must(report.evidence?.[name], 'missing Light evidence '+name);
  const entry=report.evidence?.['earned-save'];
  must(entry?.sha256===acceptedSHA, 'accepted earned-save hash mismatch');
  // Paths are compared only after the report schema has passed. Symlinks cannot substitute bytes.
  must(canonical(entry.path)===canonical(savePath), 'handoff save is not report earned-save');
  for(const [name,e] of Object.entries(report.evidence)) must(e?.path && sha256(read(e.path))===e.sha256,'changed Light evidence '+name);
  const raw=read(savePath);
  must(sha256(raw)===acceptedSHA && sha256(startingSave ?? '')===acceptedSHA,'Light starting bytes mismatch');
  const save=JSON.parse(raw), f=flagsOf(save);
  must(f['quest.lights.done']===true && f['keystone.1']===true && f['keystone.2']===true && !f['keystone.3'] && !f['scene.29'] && !f['quest.seeds.done'],'wrong Light boundary progression');
  must(f['scene.25']===true && f['choice.calla']==='shown','unexpected Calla provenance');
  return {save, sha256:acceptedSHA, reportPath, savePath};
}
export function assertKeyBeforeMemory(save) {
  const f=flagsOf(save);
  must(f['fight.10.won']===true && f['keystone.3']===true && !f['scene.29'] && !f['memory.seedvault'], 'explicit keystone must precede memory 29');
  return true;
}
export function assertSeedBoundary(before,after,{weapon,fitting,final=true}={}) {
  must(['sword','staff','bow'].includes(weapon) && ['spring_hilt','glow_cap'].includes(fitting),'explicit gear selection required');
  const a=before.game.systems,b=after.game.systems,af=flagsOf(before),bf=flagsOf(after);
  for(const k of new Set([...Object.keys(af),...Object.keys(bf)])) {
    if(/^(choice\.|shrine\.|job\.|dinner\.|memory\.|scene\.|fight\.|keystone\.|quest\.|step\.)/.test(k) && !/^(memory\.seedvault$|scene\.29$|fight\.10\.|keystone\.3$|(quest|step)\.seeds\.|quest\.itself\.(started|step)$)/.test(k)) same(af[k],bf[k],k);
  }
  for(const p of a.placeables.placed) same(p,b.placeables.placed.find(q=>q.id===p.id),'building '+p.id);
  // This runner does not build later machinery or farms.
  same(a.placeables.placed,b.placeables.placed,'placeables');
  for(const p of a.settlement.settlers) {const q=b.settlement.settlers.find(q=>q.who===p.who);must(q,'missing resident');for(const k of ['who','job','day'])same(p[k],q[k],'resident '+k);}
  must(a.settlement.settlers.length===b.settlement.settlers.length,'unexpected resident');
  for(const p of a.pets.pets) {const q=b.pets.pets.find(q=>q.id===p.id);must(q,'missing pet');for(const k of ['id','bonded','trust','bed'])same(p[k],q[k],'pet '+k);}
  same(a.crops.crops.map(c=>c.slice(0,4)),b.crops.crops.map(c=>c.slice(0,4)),'soil/crop identity');
  for(const p of a.farms.farms) {const q=b.farms.farms.find(q=>q.id===p.id);must(q,'missing farm');for(const k of ['mode','away'])same(p[k],q[k],'farm '+p.id+' '+k);}
  same(a.goods.ledger,b.goods.ledger,'Light ledger');
  for(const k of ['machines','deepest','first','eyes']) same(a.ruins[k],b.ruins[k],'ruins '+k);
  const expected=structuredClone(a.bench.weapons), selected=expected.find(w=>w.weapon===weapon);
  must(selected?.tier===2,'inherited selected weapon must be tier 2');
  Object.assign(selected,{tier:3,fitting});same(expected,b.bench.weapons,'selected weapon delta');
  same(weapon,b.bench.wielding,'wielded upgraded weapon');same(a.bench.armor,b.bench.armor,'armor');
  // Kit is a reference to bag stock, not additional inventory. Consumption is audited separately.
  for(const id of b.bench.kit) must(id===null || a.bench.kit.includes(id) || a.inventory.slots.some(s=>s?.id===id),'unexpected kit selection');
  same(a.bench.made,b.bench.made,'recipe history');
  if(final) for(const k of ['vault.seedvault.cleared','vault.seedvault.sealed','fight.10.won','keystone.3','scene.29','memory.seedvault','quest.seeds.done'])must(bf[k]===true,'missing '+k);
  must(!bf['quest.itself.done'] && !bf['quest.roofs.done'] && !bf['quest.rootworks.done'],'later chapter completed');
  return true;
}
export function assertSeedContinue(before,after) {
  for(const key of ['inventory','bench','placeables','settlement','quests','goods','crops','ruins','pets','machines'])same(before.game.systems[key],after.game.systems[key], 'Continue '+key);
  same(before.game.flags,after.game.flags,'Continue flags');
  for(const key of ['player','clock'])same(before.game[key],after.game[key],'Continue '+key);
  same(before.world,after.world,'Continue world');same(before.shell,after.shell,'Continue shell');
  return true;
}
