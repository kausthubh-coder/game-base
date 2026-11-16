import { test, expect } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
mkdirSync(resolve(root, '.artifacts/pump-runner-review/unit-fixtures'), { recursive: true });
const rawBoundary = readFileSync(resolve(root, '.artifacts/echo-review/earned/earned-echo.save.json'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Synthetic audit fixtures only. These bytes never enter a game or earned evidence directory.
function fixture(change = () => {}) {
  const base = resolve(root, '.artifacts/pump-runner-review/unit-fixtures');
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(resolve(base, 'audit-'));
  const initial = JSON.parse(rawBoundary);
  const end = structuredClone(initial);
  const flags = Object.fromEntries(end.game.flags);
  for (const key of ['quest.pump.done', 'quest.uphill.started', 'fight.6.won', 'fight.7.won', 'keystone.1', 'memory.pumphouse', 'scene.26', 'scene.25', 'vault.pumphouse.cleared', 'vault.pumphouse.sealed']) flags[key] = true;
  flags['choice.calla'] = 'shown';
  end.game.flags = Object.entries(flags);
  end.game.systems.quests.quests.pump = { state: 'done', step: null };
  end.game.systems.inventory.slots[24] = { id: 'old_brass', count: 4 };
  end.game.systems.inventory.slots[25] = { id: 'gear_spring', count: 2 };
  const saves = { 'boundary-restored': structuredClone(initial) };
  for (const name of ['middle-drained', 'middle-drained-continued', 'final-home', 'final-home-continued', 'pre-calla', 'calla-shown', 'earned-pump', 'repeat-before', 'repeat-after', 'repeat-exit', 'memory-earned', 'keystone-earned', 'mill-brass', 'fight-7-rewards']) saves[name] = structuredClone(end);
  saves['fight-6-rewards'] = structuredClone(initial);
  saves['fight-6-rewards'].game.systems.inventory.slots[24] = { id: 'old_brass', count: 2 };
  saves['mill-brass'].game.systems.inventory.slots[25] = null;
  saves['calla-kept'] = structuredClone(end);
  saves['calla-kept'].game.flags = Object.entries({ ...flags, 'choice.calla': 'kept' });
  saves['keystone-earned'].game.flags = saves['keystone-earned'].game.flags.filter(([k]) => k !== 'scene.26');
  const preHash = hash(JSON.stringify(saves['pre-calla']));
  const replay = { status: 'PASS', inputHash: hash(rawBoundary), sha: 'synthetic-unit-fixture', errors: [], failure: null, framing: [{ name: '26-pails', issues: [] }, { name: '25-calla-kept', issues: [] }, { name: '25-calla-shown', issues: [] }], inputs: ['kept', 'shown'].map(name => ({ type: 'independent-raw-import', name, sha256: preHash })) };
  const groups = [ ['boundary-restored','fight-6-rewards','mill-brass','middle-drained'], ['middle-drained-continued','fight-7-rewards','keystone-earned','memory-earned','repeat-before','repeat-after','pre-calla'], ['calla-kept'], ['calla-shown','repeat-exit','final-home'], ['final-home-continued','earned-pump'] ];
  // The middle checkpoint is before the keeper, as in the real route.
  for(const n of ['middle-drained','middle-drained-continued']) saves[n].game.systems.inventory.slots[25]=null;
  const scopeInputs=[initial,saves['middle-drained'],saves['pre-calla'],saves['pre-calla'],saves['final-home']];
  const labels=['boundary','middle-drained-continued','kept','shown','final-home-continued'];
  const counts=(slots)=>{const c={};for(const s of slots)if(s)c[s.id]=(c[s.id]??0)+s.count;return c;};
  const traces=groups.map((names,i)=>{
    let previous=counts(scopeInputs[i].game.systems.inventory.slots);
    const scope={id:i,label:labels[i],inputHash:hash(i===0?rawBoundary:JSON.stringify(scopeInputs[i])),rows:[],checkpoints:[]};
    for(const name of names){
      const save=saves[name],now=counts(save.game.systems.inventory.slots);
      for(const id of Object.keys(now)) if(now[id]>(previous[id]??0)) {
        if(id==='gear_spring'||(id==='old_brass'&&(previous[id]??0)===0)) scope.rows.push({name:'fight.ended',data:{fight:id==='old_brass'?6:7,result:'won'}});
        scope.rows.push({name:'item.gained',data:{id,count:now[id]-(previous[id]??0)},slots:structuredClone(save.game.systems.inventory.slots),flags:{'fight.6.won':true}});
      }
      scope.checkpoints.push({name,index:scope.rows.length}); previous=now;
    }return scope;
  });
  change({ saves, replay, traces });
  try {
    writeFileSync(resolve(dir, 'boundary.save.json'), rawBoundary);
    for (const [name, value] of Object.entries(saves)) writeFileSync(resolve(dir, name + '.save.json'), JSON.stringify(value));
    writeFileSync(resolve(dir, 'replay.json'), JSON.stringify(replay));
    writeFileSync(resolve(dir, 'transactions.json'), JSON.stringify(traces));
    return spawnSync('bun', ['tools/audit-pump.mjs', dir], { cwd: root, encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('audit accepts a complete synthetic contract fixture', () => { const r = fixture(); expect(r.status, r.stderr).toBe(0); });
test('audit rejects recorded framing failures', () => { const r = fixture(({ replay }) => { replay.framing[0].issues = ['stage:auren: body cropped']; }); expect(r.status).not.toBe(0); expect(r.stderr).toContain('framing'); });
test('audit hashes the actual pre-choice raw bytes', () => { const r = fixture(({ replay }) => { for (const input of replay.inputs) input.sha256 = 'invented-equal-hash'; }); expect(r.status).not.toBe(0); expect(r.stderr).toContain('pre-choice'); });
test('audit rejects a missing separate brass pickup', () => { const r = fixture(({ saves }) => { saves['mill-brass'].game.systems.inventory.slots[24].count = 2; }); expect(r.status).not.toBe(0); expect(r.stderr).toContain('brass'); });
test('audit requires a keystone before the memory scene', () => { const r = fixture(({ saves }) => { saves['keystone-earned'].game.flags = saves['keystone-earned'].game.flags.filter(([k]) => k !== 'keystone.1'); }); expect(r.status).not.toBe(0); expect(r.stderr).toContain('before memory'); });
test('audit rejects browser errors despite a PASS label', () => { const r = fixture(({ replay }) => { replay.errors = ['test page error']; }); expect(r.status).not.toBe(0); expect(r.stderr).toContain('browser'); });

import { createPumpJournal, stopPumpChild, pumpBuildHashes } from './play-pump.mjs';
test('an interruption immediately saves BLOCKED and survives later completion', () => {
  const dir = mkdtempSync(resolve(root, '.artifacts/pump-runner-review/unit-fixtures/journal-'));
  const state = { current: 'fight-6', inputs: [{ type: 'mouse-attack' }], failure: null };
  try {
    const journal = createPumpJournal(dir, () => state);
    expect(journal.flush().status).toBe('BLOCKED');
    journal.interrupt('SIGTERM');
    const interrupted = JSON.parse(readFileSync(resolve(dir, 'replay.json')));
    expect(interrupted.status).toBe('BLOCKED');
    expect(interrupted.interrupted).toBe('SIGTERM');
    expect(interrupted.current).toBe('fight-6');
    expect(interrupted.inputs).toEqual(state.inputs);
    expect(journal.complete().status).toBe('BLOCKED');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('journal passes only on completed work and downgrades cleanup failures', () => {
  const dir = mkdtempSync(resolve(root, '.artifacts/pump-runner-review/unit-fixtures/journal-'));
  const state = { failure: null };
  try {
    const journal = createPumpJournal(dir, () => state);
    expect(journal.complete().status).toBe('PASS');
    state.failure = 'cleanup failed';
    expect(journal.flush().status).toBe('BLOCKED');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('cleanup returns for a child that already exited on SIGTERM', async () => {
  const child = spawn('bun', ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const exited = new Promise((done) => child.once('exit', done));
  child.kill('SIGTERM');
  await exited;
  expect(child.exitCode).toBeNull();
  expect(child.signalCode).toBe('SIGTERM');
  await stopPumpChild(child);
}, 1000);
test('cleanup stops and awaits its live child', async () => {
  const child = spawn('bun', ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  await stopPumpChild(child);
  expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
}, 1000);

test('build hashes include nested Vite runtime assets', () => {
  const dir = mkdtempSync(resolve(root, '.artifacts/pump-runner-review/unit-fixtures/build-'));
  try {
    mkdirSync(resolve(dir, 'assets/fingerprinted'), { recursive: true });
    writeFileSync(resolve(dir, 'index.html'), '<html>fixture</html>');
    writeFileSync(resolve(dir, 'assets/fingerprinted/main.js'), 'fixture javascript');
    writeFileSync(resolve(dir, 'assets/fingerprinted/main.css'), 'fixture css');
    expect(pumpBuildHashes(dir)).toEqual({
      'assets/fingerprinted/main.css': hash('fixture css'),
      'assets/fingerprinted/main.js': hash('fixture javascript'),
      'index.html': hash('<html>fixture</html>'),
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('build provenance refuses an empty runtime asset list', () => {
  const dir = mkdtempSync(resolve(root, '.artifacts/pump-runner-review/unit-fixtures/build-'));
  try { expect(() => pumpBuildHashes(dir)).toThrow('nonempty emitted JS and CSS'); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

import * as THREE from 'three';
import { pumpAimPoint } from './play-pump.mjs';
test('mouse aim returns the requested combat point on a slope', () => {
  const camera = new THREE.PerspectiveCamera(45, 1366 / 768, 0.1, 1000);
  camera.position.set(12, 24, 28); camera.lookAt(0, 3, 0); camera.updateMatrixWorld();
  const view = { playerPosition: { y: 3 }, project(x, y, z) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    return { x: (p.x + 1) * 683, y: (1 - p.y) * 384 };
  } };
  const previous = globalThis.window;
  let pixel;
  try { globalThis.window = { __game: { view } }; pixel = pumpAimPoint([5, -4]); }
  finally { globalThis.window = previous; }
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(pixel.x / 683 - 1, 1 - pixel.y / 384), camera);
  const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -3), new THREE.Vector3());
  expect(hit.x).toBeCloseTo(5, 8); expect(hit.z).toBeCloseTo(-4, 8);
});

test('audit rejects an unrecorded inventory gain',()=>{const r=fixture(({saves})=>{saves['earned-pump'].game.systems.inventory.slots[26]={id:'wheat_seeds',count:1000};});expect(r.status).not.toBe(0);expect(r.stderr).toContain('unrecorded inventory');});
test('audit rejects a reward count inconsistent with its event',()=>{const r=fixture(({traces})=>{traces[0].rows.find(r=>r.name==='item.gained').data.count=3;});expect(r.status).not.toBe(0);expect(r.stderr).toContain('unattributed gain');});
test('audit rejects reward events copied from another branch',()=>{const r=fixture(({traces})=>{traces[3].rows=structuredClone(traces[0].rows);});expect(r.status).not.toBe(0);});
test('audit rejects a wrong source for the keeper reward',()=>{const r=fixture(({traces})=>{traces[1].rows.find(r=>r.name==='fight.ended').data.fight=6;});expect(r.status).not.toBe(0);expect(r.stderr).toContain('unattributed gain');});

import { reconcilePumpScope } from './pump-reconcile.mjs';
function livingTrace() {
  const initial={game:{systems:{inventory:{slots:[]},machines:{loose:[['carrot_seeds',33,18.5,22,-226.5]]},farms:{farms:[{id:'seed',mode:'give'}]}}}};
  const stock={id:1,item:'carrot_seeds',count:34,x:18.5,y:22,z:-226.5};
  const rows=[{name:'good.made',data:{farm:'seed',item:'carrot_seeds',count:1,at:{x:18,y:22,z:-227}},loose:[stock]}, {name:'item.gained',data:{id:'carrot_seeds',count:34,at:{x:18.5,y:22.3,z:-226.5}},slots:[{id:'carrot_seeds',count:34}],loose:[stock],player:{x:18.5,y:22,z:-226.5},clock:{seconds:20}}];
  const end=structuredClone(initial);end.game.systems.inventory.slots=[{id:'carrot_seeds',count:34}];end.game.systems.machines.loose=[];
  return {initial,end,scope:{label:'shown',rows,checkpoints:[{name:'home',index:2}]}};
}
test('existing loose seeds plus new farm production reconcile exactly once',()=>{const {initial,end,scope}=livingTrace();expect(reconcilePumpScope(scope,initial,()=>end)).toEqual([{index:1,item:'carrot_seeds',count:34,source:'loose',at:{x:18.5,y:22.3,z:-226.5},clock:{seconds:20}}]);});
test('loose pickup cannot claim more than import and production',()=>{const {initial,end,scope}=livingTrace();scope.rows[1].data.count=35;expect(()=>reconcilePumpScope(scope,initial,()=>end)).toThrow('exceeds observed stock');});
test('seed gains without the matching loose position are rejected',()=>{const {initial,end,scope}=livingTrace();scope.rows[1].data.at.x=200;expect(()=>reconcilePumpScope(scope,initial,()=>end)).toThrow('unattributed gain');});
test('farm production cannot hide unrecorded ground stock',()=>{const {initial,end,scope}=livingTrace();scope.rows[0].loose[0].count=35;expect(()=>reconcilePumpScope(scope,initial,()=>end)).toThrow('farm stock count');});
test('pet gift requires the bonded pet at the gain and the actual toast',()=>{
 const initial={game:{systems:{inventory:{slots:[]},machines:{loose:[]}}}};
 const at={x:4,y:2,z:8};const scope={label:'shown',checkpoints:[],rows:[{name:'item.gained',data:{id:'wheat_seeds',count:1,at},loose:[],slots:[{id:'wheat_seeds',count:1}],pets:[{kind:'leaftail',bonded:true,pos:at}],creatures:[]},{name:'toast',data:{text:'Your leaftail found a seed.'}}]};
 expect(reconcilePumpScope(scope,initial,()=>{}).map(s=>s.source)).toEqual(['leaftail']);scope.rows[0].pets[0].bonded=false;expect(()=>reconcilePumpScope(scope,initial,()=>{})).toThrow('unattributed gain');
});
test('farm event with a wrong authored product is rejected',()=>{const {initial,end,scope}=livingTrace();scope.rows[0].data.item='old_brass';expect(()=>reconcilePumpScope(scope,initial,()=>end)).toThrow('wrong farm product');});
