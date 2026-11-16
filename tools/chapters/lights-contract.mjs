import { createHash } from 'node:crypto';
export const LIGHTS_START_SHA = '1618cddda6e99fbd8185e916e27d3c0f3af9bd0a170a87e00325ebe7b840523d';
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function validateLightsStart(raw) {
  if (sha256(raw ?? '') !== LIGHTS_START_SHA)
    throw Error('Light requires exact accepted Gallery checkpoint');
  return true;
}
const same = (a, b, label) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw Error('preservation: ' + label);
};
export function assertLightsBoundary(a, b, final = true) {
  const before = Object.fromEntries(a.game.flags),
    after = Object.fromEntries(b.game.flags);
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (
      /^(hero\.|choice\.|scene\.|fight\.|keystone\.|quest\.|step\.)/.test(k) &&
      !/^((quest|step)\.lights\.)/.test(k)
    )
      same(before[k], after[k], k);
  for (const [id, state] of Object.entries(a.game.systems.quests.quests))
    if (id !== 'lights') same(state, b.game.systems.quests.quests[id], 'quest ' + id);
  for (const key of ['weapons', 'wielding', 'armor', 'kit'])
    same(a.game.systems.bench[key], b.game.systems.bench[key], 'equipment ' + key);
  for (const key of ['region', 'opening', 'ruins', 'hall'])
    same(a.game.systems[key], b.game.systems[key], key);
  same(a.game.systems.fights.picked, b.game.systems.fights.picked, 'fight selection');
  for (const person of a.game.systems.people.people) {
    const q = b.game.systems.people.people.find((q) => q.id === person.id);
    if (!q) throw Error('lost person');
    for (const key of ['id', 'sprite', 'friendship'])
      same(person[key], q[key], 'person ' + person.id + ' ' + key);
  }
  for (const farm of a.game.systems.farms.farms) {
    const q = b.game.systems.farms.farms.find((q) => q.id === farm.id);
    if (!q) throw Error('missing farm');
    for (const key of ['mode', 'away']) same(farm[key], q[key], 'farm ' + farm.id + ' ' + key);
    if (q.best < farm.best) throw Error('lost farm best');
  }
  same(a.game.systems.machines.holes, b.game.systems.machines.holes, 'machine holes');
  for (const key of ['levers', 'sensors', 'hatches'])
    for (const entry of a.game.systems.machines[key]) {
      const q = b.game.systems.machines[key].find(
        (q) => JSON.stringify(q[0]) === JSON.stringify(entry[0]),
      );
      same(entry, q, 'existing machine ' + key);
    }
  for (const [k, v] of Object.entries(after))
    if (v && /^keystone\./.test(k) && !['keystone.1', 'keystone.2'].includes(k))
      throw Error('later keystone');
  for (const key of ['opening', 'ruins']) same(a.game.systems[key], b.game.systems[key], key);
  const old = a.game.systems.placeables.placed,
    newParts = b.game.systems.placeables.placed;
  for (const p of old)
    same(
      p,
      newParts.find((q) => q.id === p.id),
      'existing building ' + p.id,
    );
  same(a.game.systems.settlement.lastTake, b.game.systems.settlement.lastTake, 'Take history');
  for (const p of a.game.systems.settlement.settlers) {
    const q = b.game.systems.settlement.settlers.find((q) => q.who === p.who);
    if (!q) throw Error('missing resident ' + p.who);
    same(p.job, q.job, 'job ' + p.who);
  }
  for (const p of a.game.systems.pets?.pets ?? []) {
    const q = b.game.systems.pets.pets.find((q) => q.id === p.id);
    for (const key of ['id', 'trust', 'bonded']) same(p[key], q?.[key], 'companion ' + key);
  }
  for (const crop of a.game.systems.crops?.crops ?? []) {
    const q = (b.game.systems.crops?.crops ?? []).find(
      (q) => JSON.stringify(q.slice(0, 3)) === JSON.stringify(crop.slice(0, 3)),
    );
    if (!q) throw Error('missing crop');
    same(crop[3], q[3], 'crop identity');
  }
  const granary = a.game.systems.goods.ledger.granary;
  same(granary, b.game.systems.goods.ledger.granary, 'granary');
  if (final) {
    if (after['quest.lights.done'] !== true) throw Error('Light unfinished');
    if (after['quest.seeds.step'] !== 'brass' || after['quest.seeds.done'])
      throw Error('Seed scope');
    const ledger = b.game.systems.goods.ledger;
    if (ledger.lamphouse?.glow_dust !== 20 || Object.keys(ledger).length !== 2)
      throw Error('second ledger');
    const holt = b.game.systems.settlement.settlers.find((p) => p.who === 'holt');
    if (holt?.job !== 'lamps') throw Error('Holt job');
  }
  return true;
}
