import { test, expect } from 'bun:test';
import { auditScope } from './audit-uphill.mjs';
const initial = () => ({
  game: {
    systems: {
      inventory: { slots: [{ id: 'oak_log', count: 1 }] },
      machines: { loose: [] },
      goods: { ledger: {} },
    },
  },
});
const scope = (rows) => ({ label: 'test', rows, checkpoints: [] });
const row = (name, id, count, slots) => ({
  name,
  data: { id, count },
  slots,
  loose: [],
  farms: [],
  pets: [],
});
test('crafting must pay the exact recipe cost before producing its exact output', () => {
  const rows = [
    row('item.lost', 'oak_log', 1, []),
    row('item.gained', 'plank', 4, [{ id: 'plank', count: 4 }]),
    { name: 'item.crafted', data: { id: 'plank', count: 4, station: 'hand' } },
  ];
  expect(auditScope(scope(rows), initial(), () => {})).toHaveLength(1);
  rows[0].data.count = 2;
  expect(() => auditScope(scope(rows), initial(), () => {})).toThrow('exact item.lost');
});
test('unrecorded grants and resource costs fail', () => {
  expect(() =>
    auditScope(
      scope([
        row('item.gained', 'copper', 1, [
          { id: 'oak_log', count: 1 },
          { id: 'copper', count: 1 },
        ]),
      ]),
      initial(),
      () => {},
    ),
  ).toThrow('unattributed gain');
  expect(() =>
    auditScope(scope([row('item.lost', 'oak_log', 1, [])]), initial(), () => {}),
  ).toThrow('unattributed cost');
});
test('a checkpoint cannot contain an inventory change outside the event stream', () => {
  const s = scope([]);
  s.checkpoints = [{ name: 'bad', index: 0 }];
  const edited = initial();
  edited.game.systems.inventory.slots[0].count = 2;
  expect(() => auditScope(s, initial(), () => edited)).toThrow('bag conservation');
});
test('contexts cannot borrow loose stock from another branch', () => {
  const rows = [
    row('item.gained', 'gear_spring', 4, [
      { id: 'oak_log', count: 1 },
      { id: 'gear_spring', count: 4 },
    ]),
  ];
  rows[0].data.at = { x: 1.5, y: 22.3, z: 1.5 };
  expect(() => auditScope(scope(rows), initial(), () => {})).toThrow('unattributed gain');
});

test('ledger delivery must debit exactly the delivered goods in its own context', () => {
  const before = initial();
  before.game.systems.inventory.slots = [{ id: 'wheat', count: 3 }];
  before.game.systems.goods.ledger = { granary: { wheat: 14 } };
  const after = structuredClone(before);
  after.game.systems.inventory.slots = [];
  after.game.systems.goods.ledger.granary.wheat = 17;
  const s = scope([row('item.lost', 'wheat', 3, [])]);
  s.checkpoints = [{ name: 'delivered', index: 1 }];
  expect(auditScope(s, before, () => after)).toEqual([]);
  after.game.systems.goods.ledger.granary.wheat = 18;
  expect(() => auditScope(s, before, () => after)).toThrow('ledger costs');
});
test('farm output must reach the saved loose stock and be the authored product', () => {
  const before = initial(),
    after = initial();
  after.game.systems.machines.loose = [['frog_slick', 6, 1.5, 22, 2.5]];
  const production = {
    name: 'good.made',
    data: { farm: 'pond', item: 'frog_slick', count: 6, at: { x: 1.5, y: 22, z: 2.5 } },
    farms: [{ id: 'pond', built: true }],
    slots: before.game.systems.inventory.slots,
  };
  const s = scope([production]);
  s.checkpoints = [{ name: 'produced', index: 1 }];
  expect(auditScope(s, before, () => after)).toEqual([]);
  after.game.systems.machines.loose[0][1] = 7;
  expect(() => auditScope(s, before, () => after)).toThrow('loose conservation');
  production.data.item = 'old_brass';
  expect(() => auditScope(s, before, () => after)).toThrow('authored farm product');
});

test('a pusher moves an observed spring pile without creating extra springs', () => {
  const before = initial();
  before.game.systems.placeables = {
    placed: [{ id: 'p', kind: 'pusher', x: 0, y: 22, z: 0, quarterTurns: 1 }],
  };
  const birth = { id: 9, item: 'gear_spring', count: 1, x: 1.5, y: 21.3, z: 0.5 };
  const fed = [{ id: 'spring', built: true, sub: 'Power: 4 made, 1 used' }];
  const made = {
    name: 'good.made',
    data: { farm: 'spring', item: 'gear_spring', count: 1, at: { x: 1.5, y: 21.3, z: 0.5 } },
    loose: [birth],
    farms: fed,
  };
  const picked = row('item.gained', 'gear_spring', 1, [
    { id: 'oak_log', count: 1 },
    { id: 'gear_spring', count: 1 },
  ]);
  picked.data.at = { x: 2.5, y: 22.3, z: 0.5 };
  picked.player = { x: 2.5, y: 22, z: 0.5 };
  picked.farms = fed;
  picked.loose = [{ ...birth, x: 2.5, y: 22 }];
  const after = structuredClone(before);
  after.game.systems.inventory.slots = picked.slots;
  const s = scope([made, picked]);
  s.checkpoints = [{ name: 'picked', index: 2 }];
  expect(auditScope(s, before, () => after)[0].transport.part).toBe('p');
  picked.loose[0].x = 3.5;
  expect(() => auditScope(s, before, () => after)).toThrow('unexplained stock movement');
  picked.loose[0].x = 2.5;
  picked.data.count = 2;
  expect(() => auditScope(s, before, () => after)).toThrow('stock pickup count');
});

test('recipe history grows only through recorded crafting transactions', () => {
  const before = initial();
  before.game.systems.bench = { made: [] };
  const rows = [
    row('item.lost', 'oak_log', 1, []),
    row('item.gained', 'plank', 4, [{ id: 'plank', count: 4 }]),
    { name: 'item.crafted', data: { id: 'plank', count: 4, station: 'hand' } },
  ];
  const after = structuredClone(before);
  after.game.systems.inventory.slots = [{ id: 'plank', count: 4 }];
  after.game.systems.bench.made = ['plank'];
  const s = scope(rows);
  s.checkpoints = [{ name: 'crafted', index: 3 }];
  expect(auditScope(s, before, () => after)).toHaveLength(1);
  after.game.systems.bench.made.push('waterwheel');
  expect(() => auditScope(s, before, () => after)).toThrow('unobserved recipe history');
});
