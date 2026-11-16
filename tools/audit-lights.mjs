// Independent conservation across bag, ground and collector stock. Transfers create no goods.
import { PETS } from '../src/game/content/pets.ts';
import { CREATURES } from '../src/game/content/creatures.ts';
import { recipes } from '../src/game/content/recipes.ts';
import { LEDGER } from '../src/game/content/goods.ts';
import { blockId } from '../src/content/blocks.ts';
import { assertLightsBoundary } from './chapters/lights-contract.mjs';
const add = (bag, id, n) => {
  if (!Number.isSafeInteger(n)) throw Error('noninteger goods');
  bag[id] = (bag[id] ?? 0) + n;
};
export function totalLightsStock(save) {
  const r = {};
  const s = save.game.systems;
  for (const v of s.inventory.slots) if (v) add(r, v.id, v.count);
  for (const [id, n] of s.machines.loose) add(r, id, n);
  for (const [, stacks] of s.machines.chests) for (const [id, n] of stacks) add(r, id, n);
  return r;
}
const products = {
  field: ['wheat'],
  moss: ['moss_fiber'],
  quill: ['quill'],
  copper: ['copper'],
  seed: ['carrot_seeds', 'sunroot_seeds'],
  spring: ['gear_spring'],
  pond: ['frog_slick'],
  bee: ['honey', 'wax'],
  dust: ['glow_dust'],
  rope: ['vine_rope'],
};
export function auditLightsConservation(before, after, rows) {
  const expected = totalLightsStock(before),
    actual = totalLightsStock(after),
    sources = [];
  let foxDue =
    before.game.clock.seconds +
    (before.game.systems.pets.pets.find((p) => p.bonded)?.find ?? Infinity);
  for (const [index, r] of rows.entries()) {
    const d = r.data;
    if (r.name === 'good.made') {
      if (!products[d.farm]?.includes(d.item) || !Number.isSafeInteger(d.count) || d.count <= 0)
        throw Error('invalid production');
      add(expected, d.item, d.count);
      sources.push(r);
    }
    if (r.name === 'creature.gave') {
      const def = CREATURES.find((q) => q.id === d.kind),
        previous = rows
          .slice(0, index)
          .findLast((q) => q.name === 'item.gained' || q.name === 'item.lost');
      if (
        !def?.gives ||
        def.gives.item !== d.item ||
        previous?.name !== 'item.gained' ||
        previous.data.id !== d.item ||
        previous.data.count !== 1
      )
        throw Error('invalid creature gift');
      add(expected, d.item, 1);
      sources.push(r);
    }
    if (r.name === 'toast' && d.text === 'Your leaftail found a seed.') {
      const previous = rows
          .slice(0, index)
          .findLast((q) => q.name === 'item.gained' || q.name === 'item.lost'),
        def = PETS.find((q) => q.finds.toast === d.text),
        pet = r.pets?.find((q) => q.bonded);
      if (
        !def ||
        !pet ||
        previous?.name !== 'item.gained' ||
        previous.data.id !== def.finds.item ||
        previous.data.count !== 1 ||
        r.clock.seconds + 0.1 < foxDue
      )
        throw Error('invalid fox gift');
      foxDue = r.clock.seconds + def.finds.every[0];
      add(expected, def.finds.item, 1);
      sources.push(r);
    }
    if (r.name === 'item.crafted') {
      const recipe = recipes.find((q) => q.id === d.recipe || q.makes.id === d.id);
      if (!recipe || d.count !== recipe.makes.count || d.station !== recipe.station)
        throw Error('unknown craft');
      for (const n of recipe.needs) add(expected, n.id, -n.count);
      add(expected, recipe.makes.id, recipe.makes.count);
    }
    if (r.name === 'placeable.placed') add(expected, d.kind, -1);
    if (r.name === 'block.placed') {
      const id = d.id === blockId('lamp') ? 'lamp' : d.id === blockId('oak_plank') ? 'plank' : null;
      if (!id) throw Error('unaccounted block build');
      add(expected, id, -1);
    }
    if (
      [
        'crop.harvested',
        'crop.planted',
        'block.broken',
        'placeable.removed',
        'coin.changed',
        'fight.ended',
      ].includes(r.name)
    )
      throw Error('additional transaction needs exact audit: ' + r.name);
  }
  for (const def of LEDGER)
    for (const n of def.needs) {
      const a = before.game.systems.goods.ledger[def.section]?.[n.item] ?? 0,
        b = after.game.systems.goods.ledger[def.section]?.[n.item] ?? 0;
      if (b < a || b > n.count) throw Error('ledger bounds');
      add(expected, n.item, a - b);
    }
  const made = new Set(before.game.systems.bench.made);
  for (const r of rows) if (r.name === 'item.crafted') made.add(r.data.id);
  for (const key of ['bench', 'farms'])
    if (
      JSON.stringify([...made].sort()) !== JSON.stringify([...after.game.systems[key].made].sort())
    )
      throw Error('unobserved recipe history ' + key);
  const mismatch = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].filter(
    (k) => (expected[k] ?? 0) !== (actual[k] ?? 0),
  );
  if (mismatch.length)
    throw Error(
      'goods conservation: ' +
        JSON.stringify(
          mismatch.map((id) => ({ id, expected: expected[id] ?? 0, actual: actual[id] ?? 0 })),
        ),
    );
  return { pass: true, expected, actual, sources };
}
export function auditLights(before, after, rows, { final = true } = {}) {
  assertLightsBoundary(before, after, final);
  return auditLightsConservation(before, after, rows);
}
