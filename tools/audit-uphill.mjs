import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { recipes } from '../src/game/content/recipes.ts';
import { blockId } from '../src/content/blocks.ts';
import { LEDGER } from '../src/game/content/goods.ts';
const counts = (slots) => {
  const r = {};
  for (const s of slots) if (s) r[s.id] = (r[s.id] ?? 0) + s.count;
  return r;
};
const equal = (a, b) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].every((k) => (a[k] ?? 0) === (b[k] ?? 0));
export function auditScope(scope, initial, readSave) {
  const must = (v, m) => {
    if (!v) throw Error(scope.label + ': ' + m);
  };
  const rows = scope.rows,
    claimed = new Set(),
    bag = counts(initial.game.systems.inventory.slots),
    sources = [];
  let petDue =
    initial.game.clock?.seconds +
    (initial.game.systems.pets?.pets.find((p) => p.bonded)?.find ?? 0);
  const consume = (index, id, count, name) => {
    const r = rows[index];
    must(
      r && !claimed.has(index) && r.name === name && r.data.id === id && r.data.count === count,
      'exact ' + name + ' ' + id + ' ' + count + ' at ' + index,
    );
    claimed.add(index);
  };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i],
      d = r.data;
    if (r.name === 'item.crafted') {
      const recipe = recipes.find((r) => r.makes.id === d.id);
      must(
        recipe && recipe.makes.count === d.count && recipe.station === d.station,
        'known recipe',
      );
      const items = [];
      for (let j = i - 1; j >= 0 && items.length < recipe.needs.length + 1; j--)
        if (['item.gained', 'item.lost'].includes(rows[j].name)) items.unshift(j);
      must(items.length === recipe.needs.length + 1, 'complete craft transaction');
      recipe.needs.forEach((n, k) => consume(items[k], n.id, n.count, 'item.lost'));
      consume(items.at(-1), d.id, d.count, 'item.gained');
    }
    if (r.name === 'crop.planted') {
      let j = i + 1;
      while (j < rows.length && !['item.gained', 'item.lost'].includes(rows[j].name)) j++;
      consume(j, d.crop === 'berry_bush' ? 'berry' : d.crop + '_seeds', 1, 'item.lost');
    }
    if (r.name === 'placeable.placed' || r.name === 'block.placed') {
      if (r.name === 'block.placed') must(d.id === blockId('lamp'), 'authored lamp block');
      const id = r.name === 'placeable.placed' ? d.kind : 'lamp';
      let j;
      if (r.name === 'placeable.placed')
        j = rows.findIndex((q, k) => k > i && q.name === 'item.lost');
      else {
        j = i - 1;
        while (j >= 0 && rows[j].name !== 'item.lost') j--;
      }
      consume(j, id, 1, 'item.lost');
    }
  }
  // Deliveries debit exactly the change in the saved ledger, per context and checkpoint.
  let previous = initial,
    previousIndex = 0;
  for (const c of scope.checkpoints) {
    const next = readSave(c.name);
    const a = previous.game.systems.goods.ledger,
      b = next.game.systems.goods.ledger;
    for (const section of Object.keys(b))
      for (const [id, n] of Object.entries(b[section])) {
        const delta = n - (a[section]?.[id] ?? 0);
        if (delta > 0) {
          const candidates = rows
            .map((r, i) => ({ r, i }))
            .filter(
              ({ r, i }) =>
                i >= previousIndex &&
                i < c.index &&
                r.name === 'item.lost' &&
                r.data.id === id &&
                !claimed.has(i),
            );
          must(
            candidates.reduce((sum, { r }) => sum + r.data.count, 0) === delta,
            'ledger costs ' + id,
          );
          for (const { i } of candidates) claimed.add(i);
        }
      }
    previous = next;
    previousIndex = c.index;
  }
  const stock = initial.game.systems.machines.loose.map(([item, count, x, y, z]) => ({
    item,
    count,
    x,
    y,
    z,
  }));
  const near = (a, b) => a && b && ['x', 'y', 'z'].every((k) => Math.abs(a[k] - b[k]) < 0.001);
  // Machines move existing stock without creating it. Bind observed pile identities to
  // the one-cell motion of an earned, powered pusher; never add a material allowance.
  const pushers = new Map();
  const register = (placed, fromInput = false) => {
    for (const p of placed ?? [])
      if (p.kind === 'pusher') {
        const index = fromInput
          ? 0
          : rows.findIndex(
              (r) =>
                r.name === 'placeable.placed' &&
                r.data.kind === 'pusher' &&
                r.data.x === p.x &&
                r.data.y === p.y &&
                r.data.z === p.z,
            );
        if (index >= 0) pushers.set(p.id, { ...p, index });
      }
  };
  register(initial.game.systems.placeables?.placed, true);
  for (const c of scope.checkpoints) register(readSave(c.name).game.systems.placeables?.placed);
  const push = (from, to, row, index) => {
    if (
      !row.farms?.some(
        (f) => f.id === 'spring' && f.built && /Power: [1-9]\d* made, [1-9]\d* used/.test(f.sub),
      )
    )
      return null;
    for (const p of pushers.values()) {
      const [dx, dz] = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ][p.quarterTurns & 3];
      if (
        index >= p.index &&
        Math.abs(from.y - p.y) <= 1.5 &&
        near({ x: p.x + dx + 0.5, y: from.y, z: p.z + dz + 0.5 }, from) &&
        near({ x: from.x + dx, y: p.y, z: from.z + dz }, to)
      )
        return {
          part: p.id,
          from: { x: from.x, y: from.y, z: from.z },
          to: { x: to.x, y: to.y, z: to.z },
        };
    }
    return null;
  };
  const follow = (row, index) => {
    for (const v of stock) {
      if (v.count <= 0 || v.observedId === undefined) continue;
      const observed = row.loose?.find((g) => g.id === v.observedId && g.item === v.item);
      if (observed && !near(v, observed)) {
        const moved = push(v, observed, row, index);
        must(moved, 'unexplained stock movement');
        v.transport = moved;
        Object.assign(v, { x: observed.x, y: observed.y, z: observed.z });
      }
    }
  };
  const crafted = new Set(initial.game.systems.bench?.made ?? []);
  const check = (index) => {
    for (const c of scope.checkpoints.filter((c) => c.index === index)) {
      const s = readSave(c.name);
      if (s.game.systems.bench?.made)
        must(
          s.game.systems.bench.made.every((id) => crafted.has(id)),
          'unobserved recipe history ' + c.name,
        );
      must(equal(bag, counts(s.game.systems.inventory.slots)), 'bag conservation ' + c.name);
      const total = (ss) => {
        const o = {};
        for (const v of ss) o[v.item] = (o[v.item] ?? 0) + v.count;
        return o;
      };
      must(
        equal(
          total(stock),
          total(s.game.systems.machines.loose.map(([item, count]) => ({ item, count }))),
        ),
        'loose conservation ' + c.name,
      );
    }
  };
  check(0);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i],
      d = r.data;
    if (r.name === 'item.crafted') crafted.add(d.id);
    follow(r, i);
    if (r.name === 'good.made') {
      must(d.count > 0 && Number.isInteger(d.count), 'production count');
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
        plough: ['old_brass', 'tusk_tip'],
      };
      must(products[d.farm]?.includes(d.item), 'authored farm product');
      const farm = r.farms.find((f) => f.id === d.farm);
      must(farm?.built, 'built producing farm');
      const at = { x: Math.floor(d.at.x) + 0.5, y: d.at.y, z: Math.floor(d.at.z) + 0.5 };
      let v = stock.find((v) => v.item === d.item && near(v, at));
      if (!v) {
        v = { item: d.item, count: 0, ...at };
        stock.push(v);
      }
      v.count += d.count;
      if (d.item === 'gear_spring') {
        const observed = r.loose?.find((g) => g.item === d.item && near(g, at));
        must(observed, 'spring production pile');
        v.observedId = observed.id;
      }
    }
    if (r.name === 'item.lost') {
      must(claimed.has(i), 'unattributed cost ' + d.id + ' ' + d.count);
      bag[d.id] = (bag[d.id] ?? 0) - d.count;
      must(bag[d.id] >= 0, 'no negative inventory');
    }
    if (r.name === 'item.gained') {
      let source = claimed.has(i) ? 'craft' : null,
        transport;
      if (!source && d.at) {
        let v = stock.find(
          (v) => v.count > 0 && v.item === d.id && near({ x: v.x, y: v.y + 0.3, z: v.z }, d.at),
        );
        if (!v) {
          const observed = r.loose?.find(
            (g) => g.item === d.id && near({ x: g.x, y: g.y + 0.3, z: g.z }, d.at),
          );
          if (observed)
            for (const candidate of stock) {
              if (candidate.count < d.count || candidate.item !== d.id) continue;
              const moved = push(candidate, observed, r, i);
              if (moved) {
                candidate.transport = moved;
                Object.assign(candidate, { x: observed.x, y: observed.y, z: observed.z });
                v = candidate;
                break;
              }
            }
        }
        if (v) {
          transport = v.transport;
          must(v.count >= d.count, 'stock pickup count');
          must(
            Math.abs(v.x - r.player.x) < 1.1 &&
              Math.abs(v.z - r.player.z) < 1.1 &&
              Math.abs(v.y - r.player.y) < 1.6,
            'pickup position',
          );
          v.count -= d.count;
          source = 'loose';
        }
        const next = rows[i + 1];
        if (
          !source &&
          d.id === 'moss_fiber' &&
          d.count === 1 &&
          next?.name === 'creature.gave' &&
          near(next.data.at, d.at) &&
          r.creatures.some((c) => c.kind === 'mossling' && near(c.pos, d.at))
        )
          source = 'mossling';
        if (
          !source &&
          d.id === 'wheat_seeds' &&
          d.count === 1 &&
          next?.name === 'toast' &&
          next.data.text === 'Your leaftail found a seed.' &&
          r.pets.some((p) => p.bonded && near(p.pos, d.at))
        ) {
          must(!Number.isFinite(petDue) || r.clock.seconds + 0.1 >= petDue, 'fox gift timer');
          petDue = r.clock.seconds + 50;
          source = 'bonded fox';
        }
        const harvest = rows.slice(i + 1, i + 4).find((r) => r.name === 'crop.harvested');
        if (
          !source &&
          harvest &&
          near(d.at, {
            x: harvest.data.x + 0.5,
            y: harvest.data.y + 1.5,
            z: harvest.data.z + 0.5,
          }) &&
          ((d.id === 'wheat' && d.count === 2) || (d.id === 'wheat_seeds' && d.count === 1))
        )
          source = 'wheat harvest';
      }
      must(source, 'unattributed gain ' + d.id + ' ' + d.count);
      bag[d.id] = (bag[d.id] ?? 0) + d.count;
      sources.push({ index: i, ...d, source, ...(transport ? { transport } : {}) });
    }
    if (['item.gained', 'item.lost'].includes(r.name))
      must(equal(bag, counts(r.slots)), 'transaction snapshot ' + i);
    check(i + 1);
  }
  return sources;
}
if (import.meta.main) {
  const out = resolve(process.argv[2]),
    readSave = (name) => JSON.parse(readFileSync(resolve(out, name + '.save.json'), 'utf8'));
  const scopes = JSON.parse(readFileSync(resolve(out, 'transactions.json'), 'utf8'));
  const saves = new Map();
  for (const scope of scopes) {
    for (const c of scope.checkpoints) {
      const raw = readFileSync(resolve(out, c.name + '.save.json'), 'utf8');
      saves.set(createHash('sha256').update(raw).digest('hex'), JSON.parse(raw));
    }
  }
  const boundaryRaw = readFileSync(resolve(out, 'boundary.save.json'), 'utf8');
  if (
    createHash('sha256').update(boundaryRaw).digest('hex') !==
    '00bfc093d7f1aecb61838f6314d59db27b329dcc235dd7376a6feb28032bdf10'
  )
    throw Error('accepted Pump root bytes changed');
  saves.set(createHash('sha256').update(boundaryRaw).digest('hex'), JSON.parse(boundaryRaw));
  const result = scopes.map((s) => {
    const input = saves.get(s.inputHash);
    if (!input) throw Error('missing scope input ' + s.label);
    return { label: s.label, sources: auditScope(s, input, readSave) };
  });
  writeFileSync(resolve(out, 'transaction-audit.json'), JSON.stringify(result, null, 2));
  console.log('PASS context-local transaction conservation');
  if (
    existsSync(resolve(out, 'take-earned.save.json')) &&
    existsSync(resolve(out, 'give-earned.save.json'))
  ) {
    const choiceHash = createHash('sha256')
      .update(readFileSync(resolve(out, 'pre-choice.save.json')))
      .digest('hex');
    if (
      scopes.find((s) => s.label === 'take')?.inputHash !== choiceHash ||
      scopes.find((s) => s.label === 'give')?.inputHash !== choiceHash
    )
      throw Error('choices must import identical raw checkpoint bytes');
    auditChoices(
      readSave('pre-choice'),
      readSave('take-earned'),
      readSave('take-repeat'),
      readSave('give-earned'),
      readSave('give-repeat'),
    );
    console.log('PASS gearling choices and repeats');
  }
  if (existsSync(resolve(out, 'earned-uphill.save.json'))) {
    const replay = JSON.parse(readFileSync(resolve(out, 'replay.json'), 'utf8'));
    if (replay.status !== 'PASS' || replay.errors.length)
      throw Error('stage runner incomplete or console not clean');
    if (replay.scenes.filter((s) => s.scene === 27).length !== 1)
      throw Error('scene 27 must complete exactly once across Continue');
    const maren = readSave('maren-earned'),
      ending = readSave('earned-uphill');
    if (
      Object.fromEntries(maren.game.flags).hearts !== Object.fromEntries(ending.game.flags).hearts
    )
      throw Error('repeated scene hearts');
    auditPreservation(JSON.parse(boundaryRaw), readSave('earned-uphill'));
    for (const [a, b] of [
      ['take-earned', 'take-repeat'],
      ['give-earned', 'give-repeat'],
      ['after-delivery', 'repeat-delivery'],
    ]) {
      const before = readSave(a),
        after = readSave(b);
      for (const key of ['inventory', 'goods'])
        if (JSON.stringify(before.game.systems[key]) !== JSON.stringify(after.game.systems[key]))
          throw Error('repeat changed ' + key + ' ' + b);
      for (const key of ['coin', 'hearts'])
        if (
          Object.fromEntries(before.game.flags)[key] !== Object.fromEntries(after.game.flags)[key]
        )
          throw Error('repeat reward ' + key);
    }
    console.log('PASS preservation and repeated rewards');
  }
}

export function auditPreservation(initial, final) {
  const must = (v, m) => {
    if (!v) throw Error('preservation: ' + m);
  };
  const a = initial.game.systems,
    b = final.game.systems,
    af = Object.fromEntries(initial.game.flags),
    bf = Object.fromEntries(final.game.flags);
  for (const p of a.placeables.placed)
    must(
      b.placeables.placed.some((q) => JSON.stringify(p) === JSON.stringify(q)),
      'original building ' + p.id,
    );
  for (const c of a.crops.crops)
    must(
      b.crops.crops.some((q) => q[0] === c[0] && q[1] === c[1] && q[2] === c[2] && q[3] === c[3]),
      'original crop identity',
    );
  for (const p of a.pets.pets) {
    const q = b.pets.pets.find((q) => q.id === p.id);
    must(q && q.trust === p.trust && q.bonded === p.bonded, 'original bond');
  }
  for (const [k, v] of Object.entries(af))
    if (
      /^(shrine\.|choice\.|dinner\.|job\.|memory\.|keystone\.)/.test(k) &&
      k !== 'choice.gearlings'
    )
      must(bf[k] === v, 'original ' + k);
  for (const key of ['version', 'weapons', 'wielding', 'armor', 'kit'])
    must(JSON.stringify(a.bench[key]) === JSON.stringify(b.bench[key]), 'equipment ' + key);
  must(
    a.bench.made.every((id) => b.bench.made.includes(id)),
    'original crafting history',
  );
  must((bf.coin ?? 0) === (af.coin ?? 0), 'coin unchanged without trade');
  must(
    (bf['harvested.wheat'] ?? 0) - (af['harvested.wheat'] ?? 0) > 36,
    'actual harvested terrace output',
  );
  must(b.farms.farms.find((f) => f.id === 'field').best > 36, 'terrace best exceeds pumped field');
  must(
    bf['quest.uphill.done'] && bf['scene.27'] && bf['choice.gearlings'] === 'give',
    'earned uphill Give ending',
  );
  must(bf['keystone.1'] && !bf['keystone.2'] && !bf['keystone.3'], 'only first keystone');
  for (const [id, q] of Object.entries(a.quests.quests))
    if (id !== 'uphill' && q.state !== 'done')
      must(b.quests.quests[id]?.state !== 'done', 'extra quest completed ' + id);
  for (const id of ['gallery', 'seeds', 'itself', 'keystones'])
    must(b.quests.quests[id]?.state !== 'done', 'later quest ' + id);
  must(JSON.stringify(a.ruins) === JSON.stringify(b.ruins), 'Rootworks and vault states');
  for (const id of ['moss', 'quill', 'copper', 'seed', 'bee'])
    must(
      a.farms.farms.find((f) => f.id === id).mode === b.farms.farms.find((f) => f.id === id).mode,
      'original farm mode ' + id,
    );
  must(
    LEDGER.filter((s) => bf['ledger.' + s.section + '.filled']).length === 1,
    'exactly one ledger section',
  );
  must(
    b.goods.ledger.granary.wheat === 40 && b.goods.ledger.granary.moss_fiber === 10,
    'granary exact delivery',
  );
  return true;
}

export function auditChoices(before, take, takeRepeat, give, giveRepeat) {
  const must = (v, m) => {
    if (!v) throw Error('choices: ' + m);
  };
  const stock = (s) =>
    s.game.systems.machines.loose
      .filter((v) => v[0] === 'gear_spring')
      .reduce((n, v) => n + v[1], 0);
  const farm = (s) => s.game.systems.farms.farms.find((f) => f.id === 'spring');
  must(
    farm(before).mode === 'give' && farm(before).away === 0 && farm(before).best === 6,
    'earned productive pre-choice farm',
  );
  must(farm(take).mode === 'take' && farm(take).away === take.game.clock.day + 3, 'Take absence');
  must(stock(take) - stock(before) === 24, 'exact authored Take production');
  must(Object.fromEntries(take.game.flags)['choice.gearlings'] === 'take', 'Take flag');
  must(farm(give).mode === 'give' && farm(give).away === 0, 'Give keeps gearlings');
  must(Object.fromEntries(give.game.flags)['choice.gearlings'] === 'give', 'Give flag');
  for (const [a, b] of [
    [take, takeRepeat],
    [give, giveRepeat],
  ]) {
    must(stock(a) === stock(b), 'no repeat spring reward');
    must(
      equal(counts(a.game.systems.inventory.slots), counts(b.game.systems.inventory.slots)),
      'no repeat inventory reward',
    );
    for (const key of ['coin', 'hearts'])
      must(
        Object.fromEntries(a.game.flags)[key] === Object.fromEntries(b.game.flags)[key],
        'no repeat ' + key,
      );
  }
  return true;
}
