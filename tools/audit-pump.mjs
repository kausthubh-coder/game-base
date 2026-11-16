import { requireBetaHash } from './lib/beta-chain.mjs';
import { reconcilePumpScope } from './pump-reconcile.mjs';
// Read raw browser exports. Never supplies or rewrites game state.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const out = resolve(process.argv[2] ?? '');
const raw = (name) => readFileSync(resolve(out, name + '.save.json'));
const read = (name) => JSON.parse(raw(name));
const must = (ok, message) => {
  if (!ok) throw Error(message);
};
const flags = (s) => Object.fromEntries(s.game.flags);
const sys = (s) => s.game.systems;
const same = (a, b, message) => must(JSON.stringify(a) === JSON.stringify(b), message);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inputBytes = process.env.BETA_PREDECESSOR ? raw('boundary') : readFileSync(resolve(import.meta.dirname, '../.artifacts/echo-review/earned/earned-echo.save.json'));
const expectedInputHash = '4e2c5132b90538983fdb9336efa16320ff4a736aa8643c44354a5f86f360930f';
requireBetaHash(sha256(inputBytes), expectedInputHash, 'echo');
requireBetaHash(sha256(raw('boundary')), expectedInputHash, 'echo');
const input = JSON.parse(inputBytes);
const replay = JSON.parse(readFileSync(resolve(out, 'replay.json')));
must(replay.status === 'PASS' && !replay.failure && !replay.interrupted, 'complete earned route required');
must(Array.isArray(replay.errors) && !replay.errors.length, 'no browser warnings or errors');
must(Array.isArray(replay.framing) && replay.framing.length > 0, 'dialogue framing evidence required');
for (const line of replay.framing) must(Array.isArray(line.issues) && !line.issues.length, 'dialogue framing ' + line.name + ': ' + JSON.stringify(line.issues));
for (const name of ['26-pails', '25-calla-kept', '25-calla-shown']) must(replay.framing.some((line) => line.name === name), 'dialogue framing missing ' + name);
must(
  requireBetaHash(replay.inputHash, expectedInputHash, 'echo'),
  'exact Echo boundary',
);
const restoredBoundary = read('boundary-restored');
for (const key of ['inventory', 'bench', 'quests', 'ruins', 'placeables'])
  same(sys(input)[key], sys(restoredBoundary)[key], 'restored boundary ' + key);
for (const checkpoint of ['middle-drained', 'final-home']) {
  const a = read(checkpoint),
    b = read(checkpoint + '-continued');
  for (const key of [
    'inventory',
    'bench',
    'placeables',
    'settlement',
    'quests',
    'goods',
    'crops',
    'ruins',
  ])
    same(sys(a)[key], sys(b)[key], checkpoint + ' ' + key);
  same(a.world, b.world, checkpoint + ' world');
}
const branches = ['kept', 'shown'].map(
  (name) =>
    replay.inputs.find((i) => i.type === 'independent-raw-import' && i.name === name)?.sha256,
);
must(branches[0] && branches[0] === branches[1], 'identical raw Calla branch imports');
must(branches.every((hash) => hash === sha256(raw('pre-calla'))), 'actual pre-choice bytes match both imports');
const kept = read('calla-kept'),
  shown = read('calla-shown');
for (const [choice, s] of [
  ['kept', kept],
  ['shown', shown],
]) {
  must(flags(s)['choice.calla'] === choice, 'Calla ' + choice);
  must(flags(s)['scene.25'], 'Calla finished');
}
same(sys(kept).inventory, sys(shown).inventory, 'Calla choices have no inventory effect');
must(flags(read('keystone-earned'))['keystone.1'], 'keystone earned before memory');
must(!flags(read('keystone-earned'))['scene.26'], 'keystone checkpoint precedes memory');
const end = read('earned-pump'),
  f = flags(end);
for (const key of [
  'quest.pump.done',
  'quest.uphill.started',
  'fight.6.won',
  'fight.7.won',
  'keystone.1',
  'memory.pumphouse',
  'scene.26',
  'scene.25',
  'vault.pumphouse.cleared',
  'vault.pumphouse.sealed',
])
  must(f[key], 'earned ' + key);
must(f['choice.calla'] === 'shown', 'main choice');
for (const n of [2, 3]) must(!f['keystone.' + n], 'no later keystone');
for (const id of ['gallery', 'seeds'])
  must(sys(end).quests.quests[id].state !== 'done', 'later quest ' + id);
must(sys(end).ruins.deepest === 0 && !sys(end).ruins.machines.some(Boolean), 'no Rootworks');
for (const key of ['weapons', 'wielding', 'armor', 'kit'])
  same(sys(input).bench[key], sys(end).bench[key], 'equipment ' + key);
for (const p of sys(input).placeables.placed)
  must(
    sys(end).placeables.placed.some((q) => JSON.stringify(q) === JSON.stringify(p)),
    'building ' + p.id,
  );
for (const c of sys(input).crops.crops)
  must(
    sys(end).crops.crops.some((q) => q.slice(0, 4).join() === c.slice(0, 4).join()),
    'crop ' + c.slice(0, 4),
  );
for (const pet of sys(input).pets.pets) {
  const p = sys(end).pets.pets.find((p) => p.id === pet.id);
  must(p && p.bonded === pet.bonded && p.trust === pet.trust, 'companion');
}
for (const farm of sys(input).farms.farms)
  must(
    sys(end).farms.farms.find((f) => f.id === farm.id)?.mode === farm.mode,
    'farm mode ' + farm.id,
  );
for (const who of sys(input).settlement.settlers)
  must(
    sys(end).settlement.settlers.find((s) => s.who === who.who)?.job === who.job,
    'job ' + who.who,
  );
for (const [key, value] of input.game.flags)
  if (/^(shrine\.|choice.dinner|dinner\.)/.test(key)) same(f[key], value, 'choice ' + key);
const count = (s) =>
  Object.fromEntries(
    [
      ...new Set(
        sys(s)
          .inventory.slots.filter(Boolean)
          .map((s) => s.id),
      ),
    ].map((id) => [
      id,
      sys(s).inventory.slots.reduce((n, s) => n + (s?.id === id ? s.count : 0), 0),
    ]),
  );
const delta = (a, b) => {
  const x = count(a),
    y = count(b);
  return Object.fromEntries(
    [...new Set([...Object.keys(x), ...Object.keys(y)])]
      .map((id) => [id, (y[id] ?? 0) - (x[id] ?? 0)])
      .filter(([, n]) => n),
  );
};
// This runner gathers no materials and spends no kit. If its route gains such inputs,
// add the authored transaction and its own checkpoint here before accepting it.
const itemCount = (s, id) => count(s)[id] ?? 0;
const gained = (a, b, id) => itemCount(b, id) - itemCount(a, id);
must(gained(input, read('fight-6-rewards'), 'old_brass') === 2, 'fight 6 authored brass reward');
must(gained(read('fight-6-rewards'), read('mill-brass'), 'old_brass') === 2, 'separate mill brass pickup');
must(gained(read('mill-brass'), read('fight-7-rewards'), 'gear_spring') === 2, 'fight 7 authored spring reward');
const materials = delta(input, end);
const traces = JSON.parse(readFileSync(resolve(out, 'transactions.json')));
const scopeInputs = ['boundary','middle-drained','pre-calla','pre-calla','final-home'];
const scopeLabels = ['boundary','middle-drained-continued','kept','shown','final-home-continued'];
same(traces.map(t=>t.label), scopeLabels, 'transaction import branches');
const transactions = traces.map((trace,i)=>{
  must(trace.id===i && trace.inputHash===sha256(raw(scopeInputs[i])), 'transaction branch input hash');
  return {label:trace.label, gains:reconcilePumpScope(trace,read(scopeInputs[i]),read)};
});
for(const [i,names] of [ ['boundary-restored','fight-6-rewards','mill-brass','middle-drained'], ['middle-drained-continued','fight-7-rewards','keystone-earned','memory-earned','repeat-before','repeat-after','pre-calla'], ['calla-kept'], ['calla-shown','repeat-exit','final-home'], ['final-home-continued','earned-pump'] ].entries())
  for(const name of names) must(traces[i].checkpoints.some(c=>c.name===name),'transaction checkpoint '+name);
must(materials.old_brass===4 && materials.gear_spring===2, 'authored reward totals');
same(sys(read('repeat-before')).inventory, sys(read('repeat-after')).inventory, 'repeat items');
same(flags(read('repeat-before')).hearts, flags(read('repeat-after')).hearts, 'repeat hearts');
same(sys(shown).inventory, sys(read('repeat-exit')).inventory, 'repeat sealed exit items');
same(flags(shown).hearts, flags(read('repeat-exit')).hearts, 'repeat sealed exit hearts');
const hashes = Object.fromEntries(
  readdirSync(out)
    .filter((n) => n.endsWith('.save.json'))
    .map((n) => [
      n,
      createHash('sha256')
        .update(readFileSync(resolve(out, n)))
        .digest('hex'),
    ]),
);
writeFileSync(
  resolve(out, 'raw-audit.json'),
  JSON.stringify(
    {
      status: 'PASS',
      source: replay.sha,
      hashes,
      materials: delta(input, end),
      transactions,
      farmBefore: sys(input).farms,
      farmAfter: sys(end).farms,
      settlementBefore: sys(input).settlement,
      settlementAfter: sys(end).settlement,
      ruins: sys(end).ruins,
    },
    null,
    2,
  ),
);
console.log('PASS raw earned Pump audit');
