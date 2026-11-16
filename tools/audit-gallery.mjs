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
  const combatRewards = new Map();
  const won = new Set(
    initial.game.flags
      .filter(([k, v]) => v && /^fight\.\d+\.won$/.test(k))
      .map(([k]) => Number(k.split('.')[1])),
  );
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
    if (r.name === 'fight.ended' && r.data.result === 'won') {
      must(!won.has(r.data.fight), 'duplicate fight win');
      won.add(r.data.fight);
      const gift =
        r.data.fight === 8
          ? { id: 'vine_rope', count: 2 }
          : r.data.fight === 9
            ? { id: 'old_brass', count: 1 }
            : null;
      must(gift, 'bounded fight reward');
      let j = i + 1;
      while (j < rows.length && !['item.gained', 'item.lost'].includes(rows[j].name)) j++;
      consume(j, gift.id, gift.count, 'item.gained');
      combatRewards.set(j, r.data.fight);
    }
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
      let source = combatRewards.has(i)
          ? 'fight ' + combatRewards.get(i)
          : claimed.has(i)
            ? 'craft'
            : null,
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

export function auditGallery(initial, final) {
  const must = (v, m) => {
      if (!v) throw Error(m);
    },
    a = initial.game.systems,
    b = final.game.systems,
    af = Object.fromEntries(initial.game.flags),
    bf = Object.fromEntries(final.game.flags);
  for (const p of a.placeables.placed)
    must(
      b.placeables.placed.some((q) => JSON.stringify(p) === JSON.stringify(q)),
      'building ' + p.id,
    );
  for (const c of a.crops.crops)
    must(
      b.crops.crops.some((q) => q.slice(0, 4).every((v, i) => v === c[i])),
      'crop identity',
    );
  for (const p of a.pets.pets) {
    const q = b.pets.pets.find((q) => q.id === p.id);
    must(q && p.trust === q.trust && p.bonded === q.bonded, 'fox identity/bond');
  }
  for (const settler of a.settlement.settlers) {
    const restored = b.settlement.settlers.find(s => s.who === settler.who);
    must(restored && restored.day === settler.day && restored.job === settler.job, 'settler job ' + settler.who);
  }
  for (const farm of a.farms.farms) {
    const restored = b.farms.farms.find(f => f.id === farm.id);
    must(restored && restored.mode === farm.mode, 'farm identity/mode ' + farm.id);
  }
  for (const [k, v] of Object.entries(af))
    if (/^(choice\.|shrine\.|job\.|dinner\.|memory\.|keystone\.)/.test(k))
      must(bf[k] === v, 'earlier flag ' + k);
  for (const k of ['weapons', 'wielding', 'armor', 'kit'])
    must(JSON.stringify(a.bench[k]) === JSON.stringify(b.bench[k]), 'equipment ' + k);
  must(bf['keystone.1'] && bf['keystone.2'] && !bf['keystone.3'], 'only keys 1+2');
  must(
    bf['quest.gallery.done'] &&
      bf['quest.lights.started'] &&
      !bf['quest.lights.done'] &&
      !bf['quest.seeds.done'],
    'bounded quests',
  );
  for (const k of ['machines', 'deepest'])
    must(JSON.stringify(a.ruins[k]) === JSON.stringify(b.ruins[k]), 'Rootworks ' + k);
  must(b.ruins.eyes === 6, 'six eyes');
}
// Only this preserved original-chain continuation is eligible. Diagnostic completions stay rejected.
export function auditGalleryChain(out) {
  const must=(value,message)=>{if(!value)throw Error(message);};
  const historical = resolve('.artifacts/gallery-input/attempt-33');
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  const start = readFileSync(resolve(out,'resume-boundary.save.json'));
  const baseSHA='beaf194efbd23023cd666578e5c2f8a56c3a824ad0e381a2e8cdcf0a9973ff0b';
  const fightSHA='03a5eaeed88ee56edf12cb1ea4793068d47df887ac314c56a18502fa61786707';
  must([baseSHA,fightSHA].includes(digest(start)),'original-chain checkpoint hash');
  const root=readFileSync(resolve(out,'boundary.save.json'));
  must(digest(root)==='2e87196658d91e6cace033284b2b218414e242c4a4e1214d791ed999abdb771d','original earned root hash');
  const files=['transactions.json','inputs.ndjson','rootsnare-ready.save.json','rootsnare-ready-continued.save.json','lamp-crafted.save.json'];
  const provenance=Object.fromEntries(files.map(file=>[resolve(historical,file),digest(readFileSync(resolve(historical,file)))]));
  must(digest(readFileSync(resolve(historical,'rootsnare-ready-continued.save.json')))===baseSHA,'preserved checkpoint identity');
  const scopes=JSON.parse(readFileSync(resolve(historical,'transactions.json'),'utf8'));
  const readOld=name=>JSON.parse(readFileSync(resolve(historical,name+'.save.json'),'utf8'));
  const first=scopes[0], last=first.checkpoints.find(c=>c.name==='rootsnare-ready');
  must(first.inputHash===digest(root) && !!last,'original root scope');
  auditScope({...first,rows:first.rows.slice(0,last.index),checkpoints:first.checkpoints.filter(c=>c.index<=last.index)},JSON.parse(root),readOld);
  const continued=scopes[1], mark=continued.checkpoints.find(c=>c.name==='rootsnare-ready-continued');
  must(continued.inputHash===digest(readFileSync(resolve(historical,'rootsnare-ready.save.json'))) && mark?.index===0,'Continue scope identity');
  auditScope({...continued,rows:[],checkpoints:[mark]},readOld('rootsnare-ready'),readOld);
  if(digest(start)===fightSHA) {
    const previous=resolve('.artifacts/gallery-chapter/attempt-04/earned');
    const previousRead=name=>JSON.parse(readFileSync(resolve(previous,name+'.save.json'),'utf8'));
    const previousStart=readFileSync(resolve(previous,'resume-boundary.save.json'));
    must(digest(previousStart)===baseSHA,'fight prefix original starting bytes');
    const scopes=JSON.parse(readFileSync(resolve(previous,'transactions.json'),'utf8'));
    const scope=scopes.find(s=>s.inputHash===baseSHA);
    const end=scope?.checkpoints.find(c=>c.name==='fight-8-rewards');
    must(end && digest(readFileSync(resolve(previous,'fight-8-rewards.save.json')))===fightSHA,'fight reward prefix hash');
    auditScope({...scope,rows:scope.rows.slice(0,end.index),checkpoints:scope.checkpoints.filter(c=>c.index<=end.index)},JSON.parse(previousStart),previousRead);
    const flags=Object.fromEntries(JSON.parse(start).game.flags);
    must(flags['fight.8.won']===true && !flags['fight.9.won'] && !flags['keystone.2'],'bounded earned fight checkpoint');
    for(const file of ['transactions.json','inputs.ndjson','resume-boundary.save.json','fight-8-rewards.save.json','replay.json'])provenance[resolve(previous,file)]=digest(readFileSync(resolve(previous,file)));
  }
  const result={root:digest(root),start:digest(start),provenance};
  writeFileSync(resolve(out,'chain.json'),JSON.stringify(result,null,2));
  return result;
}
if (import.meta.main) {
  const out = resolve(process.argv[2]),
    readSave = (name) => JSON.parse(readFileSync(resolve(out, name + '.save.json'), 'utf8'));
  const scopes = JSON.parse(readFileSync(resolve(out, 'transactions.json'), 'utf8')),
    saves = new Map();
  const register = (name) => {
    const raw = readFileSync(resolve(out, name + '.save.json'), 'utf8');
    saves.set(createHash('sha256').update(raw).digest('hex'), JSON.parse(raw));
  };
  register('boundary');
  if (existsSync(resolve(out,'resume-boundary.save.json'))) { auditGalleryChain(out); register('resume-boundary'); }
  for (const s of scopes) for (const c of s.checkpoints) register(c.name);
  const results = scopes.map((s) => {
    const initial = saves.get(s.inputHash);
    if (!initial) throw Error('unknown input ' + s.label);
    return { label: s.label, sources: auditScope(s, initial, readSave) };
  });
  auditGallery(readSave('boundary'), readSave('earned-gallery'));
  const replay = JSON.parse(readFileSync(resolve(out, 'replay.json'), 'utf8'));
  if ((replay.diagnosticResume || replay.inputs.some((i) => i.type === 'earned-checkpoint-import')) && !auditGalleryChain(out))
    throw Error('diagnostic resume is not a complete original-input replay');
  if (replay.status !== 'PASS' || replay.errors.length) throw Error('runner incomplete/console');
  const flags = (name) => Object.fromEntries(readSave(name).game.flags);
  if (!flags('keystone-earned')['keystone.2'] || flags('keystone-earned')['scene.28'])
    throw Error('second keystone must precede memory 28');
  if (!flags('memory-earned')['scene.28']) throw Error('earned memory 28 missing');
  for (const name of ['middle-eyes', 'final-home']) {
    const before = readSave(name),
      after = readSave(name + '-continued');
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
      if (JSON.stringify(before.game.systems[key]) !== JSON.stringify(after.game.systems[key]))
        throw Error(name + ' Continue changed ' + key);
  }
  if (replay.framing.some((f) => f.issues.length)) throw Error('dialogue framing failed');
  writeFileSync(resolve(out, 'independent-audit.json'), JSON.stringify(results, null, 2));
  console.log('PASS Gallery transaction and preservation audit');
}
