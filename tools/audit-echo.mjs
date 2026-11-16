import { requireBetaHash } from './lib/beta-chain.mjs';
// Inspect unedited earned exports. This audit never supplies game state.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const out = resolve(process.argv[2] ?? '');
const read = name => JSON.parse(readFileSync(resolve(out, name), 'utf8'));
const must = (value, message) => { if (!value) throw Error(message); };
const flags = save => Object.fromEntries(save.game.flags);
const systems = save => save.game.systems;
const count = (save, id) => systems(save).inventory.slots.reduce((n, slot) => n + (slot?.id === id ? slot.count : 0), 0);
const replay = read('replay.json');
must(replay.status === 'PASS', 'requires a complete fresh earned route');
requireBetaHash(replay.inputHash, '22c1a54d698331f83a35d1a8d9c998a80b1825150b13d1d6ca38f07442fca043', 'gold');
must(replay.scenes.filter(s => s.scene === 24).length === 1, 'memory plays once');
for (const name of ['middle-memory', 'shrine-heart', 'shrine-stamina', 'dinner-gus', 'dinner-hobb', 'final-home']) {
 const a = read(name + '.save.json'), b = read(name + '-continued.save.json');
 for (const key of ['inventory', 'bench', 'placeables', 'settlement', 'quests', 'goods', 'crops', 'ruins']) must(JSON.stringify(systems(a)[key]) === JSON.stringify(systems(b)[key]), name + ' persistence ' + key);
 must(JSON.stringify(a.world) === JSON.stringify(b.world), name + ' world persistence');
}
for (const [a, b] of [['before-repeat', 'after-repeat']]) {
 const before = read(a + '.save.json'), after = read(b + '.save.json');
 must(JSON.stringify(systems(before).inventory) === JSON.stringify(systems(after).inventory), 'repeat inventory unchanged');
 must(flags(before).hearts === flags(after).hearts, 'repeat hearts unchanged');
}
for (const choice of ['heart', 'stamina']) {
 must(flags(read('shrine-' + choice + '.save.json'))['shrine.shrine-oak'] === choice, 'saved shrine choice');
 const imports = replay.inputs.filter(i => i.name === choice && i.type === 'independent-raw-import');
 must(imports.length === 1, 'one raw import for shrine ' + choice);
}
const sameImport = names => {
 const hashes = names.map(name => replay.inputs.find(i => i.name === name && i.type === 'independent-raw-import')?.sha256);
 must(hashes.every(Boolean) && hashes[0] === hashes[1], 'identical raw branches ' + names.join('/'));
};
sameImport(['heart', 'stamina']); sameImport(['gus', 'hobb']);
for (const who of ['gus', 'hobb']) {
 const a = read('dinner-' + who + '-before.save.json'), b = read('dinner-' + who + '-after.save.json');
 must(flags(b).hearts - flags(a).hearts === 10, 'ten dinner hearts ' + who);
 must(flags(b)['choice.dinner'] === who && flags(b)['dinner.' + who], 'promise ' + who);
 for (const id of ['gus', 'hobb']) {
  const friendship = save => systems(save).people.people.find(p => p.id === id).friendship;
  must(friendship(b) === (id === who ? Math.min(5, friendship(a) + 2) : friendship(a)), 'friendship ' + who + '/' + id);
 }
 must(JSON.stringify(systems(a).placeables) === JSON.stringify(systems(b).placeables), 'promise does not build');
}
const end = read('earned-echo.save.json'), f = flags(end);
must(f['quest.echo.done'] && f['scene.24'] && f['memory.hall'] && f['vaults.marked'], 'Echo complete');
for (const id of ['pump', 'gallery', 'seeds']) must(f['quest.' + id + '.started'], 'vault available ' + id);
for (const n of [1, 2, 3]) must(!f['keystone.' + n], 'before keystone ' + n);
for (const id of ['pumphouse', 'lampgallery', 'seedvault']) must(!f['vault.' + id + '.cleared'], 'before keeper ' + id);
must(count(end, 'honey') > 0, 'collected actual honey');
for (const id of ['moss', 'quill', 'copper', 'bee']) must(f['farm.' + id + '.living'] && systems(end).farms.farms.find(v => v.id === id)?.mode === 'give', 'living Give farm ' + id);
must(f['choice.dinner'] === 'gus' && f['shrine.shrine-oak'] === 'heart', 'main choices');
const hashes = Object.fromEntries(readdirSync(out).filter(n => n.endsWith('.save.json')).map(n => [n, createHash('sha256').update(readFileSync(resolve(out, n))).digest('hex')]));
writeFileSync(resolve(out, 'raw-audit.json'), JSON.stringify({ status: 'PASS', source: replay.sha, sourceDiffSha256: replay.sourceDiffSha256, inputHash: replay.inputHash, hashes }, null, 2));
console.log('PASS raw earned Echo audit');
