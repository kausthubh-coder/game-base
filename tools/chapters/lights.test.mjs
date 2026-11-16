import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { validateLightsStart, assertLightsBoundary } from './lights-contract.mjs';
import { auditLightsConservation } from '../audit-lights.mjs';
const raw = readFileSync('.artifacts/lights-chapter/fixtures/gallery-start.save.json', 'utf8');
test('only the exact accepted Gallery bytes start Light', () => {
  expect(validateLightsStart(raw)).toBe(true);
  expect(() => validateLightsStart(raw + ' ')).toThrow('checkpoint');
});
test('a later key or Seed change breaks bounded preservation', () => {
  const a = JSON.parse(raw),
    b = structuredClone(a);
  b.game.flags.push(['keystone.3', true]);
  expect(() => assertLightsBoundary(a, b, false)).toThrow();
});
test('unexplained inventory gains fail conservation', () => {
  const a = JSON.parse(raw),
    b = structuredClone(a);
  b.game.systems.inventory.slots[30] = { id: 'glow_dust', count: 20 };
  expect(() => auditLightsConservation(a, b, [])).toThrow('conservation');
});
test('collector transfers conserve goods and cannot mint dust', () => {
  const a = JSON.parse(raw);
  a.game.systems.machines.chests.push(['test', [['glow_dust', 3]]]);
  const b = structuredClone(a);
  b.game.systems.machines.chests.at(-1)[1] = [];
  b.game.systems.inventory.slots[30] = { id: 'glow_dust', count: 3 };
  expect(auditLightsConservation(a, b, []).pass).toBe(true);
  b.game.systems.inventory.slots[30].count++;
  expect(() => auditLightsConservation(a, b, [])).toThrow('conservation');
});
test('production and recipe costs are exact, with no material allowances', () => {
  const a = JSON.parse(raw),
    b = structuredClone(a);
  b.game.systems.inventory.slots[30] = { id: 'glow_dust', count: 2 };
  expect(
    auditLightsConservation(a, b, [
      { name: 'good.made', data: { farm: 'dust', item: 'glow_dust', count: 2 } },
    ]).pass,
  ).toBe(true);
  expect(() =>
    auditLightsConservation(a, b, [
      { name: 'good.made', data: { farm: 'dust', item: 'glow_dust', count: 1 } },
    ]),
  ).toThrow('conservation');
});

test('preserved crop locations cannot silently change species', () => {
  const a = JSON.parse(raw),
    b = structuredClone(a);
  b.game.systems.crops.crops[0][3] = 'wheat';
  expect(() => assertLightsBoundary(a, b, false)).toThrow('crop identity');
});
test('companion trust, later quest flags, equipment and farm mode are preserved', () => {
  for (const change of [
    (s) => (s.game.systems.pets.pets[0].trust = 0),
    (s) => s.game.flags.push(['quest.keystones.done', true]),
    (s) => (s.game.systems.bench.armor = 0),
    (s) => (s.game.systems.farms.farms[0].mode = 'take'),
  ]) {
    const a = JSON.parse(raw),
      b = structuredClone(a);
    change(b);
    expect(() => assertLightsBoundary(a, b, false)).toThrow();
  }
});
test('hero identity and unobserved recipe history cannot change', () => {
  const a = JSON.parse(raw),
    b = structuredClone(a);
  b.game.flags.push(['hero.name', 'Someone else']);
  expect(() => assertLightsBoundary(a, b, false)).toThrow();
  const c = structuredClone(a);
  c.game.systems.bench.made.push('sensor');
  expect(() => auditLightsConservation(a, c, [])).toThrow('recipe history');
});
test('sensor crafting pays exactly its dust and copper', () => {
  const a = JSON.parse(raw);
  a.game.systems.inventory.slots[30] = { id: 'glow_dust', count: 1 };
  const b = structuredClone(a);
  b.game.systems.inventory.slots[30] = { id: 'sensor', count: 1 };
  b.game.systems.inventory.slots.find((s) => s?.id === 'copper').count--;
  b.game.systems.bench.made.push('sensor');
  b.game.systems.farms.made.push('sensor');
  const rows = [{ name: 'item.crafted', data: { id: 'sensor', count: 1, station: 'workbench' } }];
  expect(auditLightsConservation(a, b, rows).pass).toBe(true);
  b.game.systems.inventory.slots[31] = { id: 'glow_dust', count: 1 };
  expect(() => auditLightsConservation(a, b, rows)).toThrow('conservation');
});
test('fox gifts need the real item, bonded fox and elapsed timer', () => {
  const a = JSON.parse(raw),
    b = structuredClone(a);
  b.game.systems.inventory.slots.find((s) => s?.id === 'wheat_seeds').count++;
  const rows = [
    { name: 'item.gained', data: { id: 'wheat_seeds', count: 1 } },
    { name: 'inventory.changed', data: {} },
    {
      name: 'toast',
      data: { text: 'Your leaftail found a seed.' },
      clock: { seconds: a.game.clock.seconds + 70 },
      pets: [{ bonded: true }],
    },
  ];
  expect(auditLightsConservation(a, b, rows).pass).toBe(true);
  rows.at(-1).clock.seconds = a.game.clock.seconds;
  expect(() => auditLightsConservation(a, b, rows)).toThrow('fox gift');
});
test('diagnostic and unrelated checkpoints cannot authorize earned resume', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs'),
    { tmpdir } = await import('node:os'),
    { join } = await import('node:path'),
    { lightsResume } = await import('./lights-resume.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'light-resume-'));
  try {
    writeFileSync(join(dir, 'result.json'), '{"diagnostic":true}');
    expect(() => lightsResume(dir, raw)).toThrow('diagnostic');
    writeFileSync(join(dir, 'result.json'), '{"diagnostic":false}');
    writeFileSync(join(dir, 'replay-source.json'), '{"root":"unrelated"}');
    expect(() => lightsResume(dir, raw)).toThrow('root');
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test('visible clipped text and an arrival over the HUD are rejected', async () => {
  const { lightsLayoutIssues } = await import('./lights-layout.mjs');
  const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
  const f = {
    width: 390,
    height: 844,
    elements: [
      { selector: '.bd-bar', visible: true, rect: rect(-50, 618, 440, 655), textRects: [] },
    ],
    hud: [],
  };
  expect(lightsLayoutIssues(f)).toContain('.bd-bar leaves viewport');
  f.elements = [
    { selector: '.hp-banner', visible: true, rect: rect(65, 270, 325, 330), textRects: [] },
  ];
  f.hud = [
    { selector: '.ui-heart', visible: true, pointerEvents: 'auto', rect: rect(220, 285, 385, 310) },
  ];
  expect(lightsLayoutIssues(f)).toContain('arrival overlaps .ui-heart');
  f.hud[0].visible = false;
  f.hud[0].pointerEvents = 'none';
  expect(lightsLayoutIssues(f)).toEqual([]);
});
test('natural pet bed-index movement is allowed but Take history is preserved', () => {
  const a = JSON.parse(raw),
    b = structuredClone(a);
  b.game.systems.pets.pets[0].bed = 0;
  expect(assertLightsBoundary(a, b, false)).toBe(true);
  b.game.systems.settlement.lastTake++;
  expect(() => assertLightsBoundary(a, b, false)).toThrow('Take history');
});
test('shelter proof binds the exact added bed and every required roof cell', async () => {
  const { assertLightsShelter } = await import('./lights-shelter.mjs');
  const bed = { id: 'home_bed:new', kind: 'home_bed', x: -5, y: 22, z: -236, quarterTurns: 0 },
    cells = [];
  for (let x = -5; x <= -2; x++)
    for (let z = -237; z <= -233; z++) cells.push({ x, y: 25, z, key: 'oak_plank' });
  const reading = {
    bed,
    cells,
    bedCover: [-236, -235].map((z) => ({ x: -5, y: 25, z, key: 'oak_plank' })),
  };
  expect(assertLightsShelter(reading, bed.id)).toBe(true);
  expect(() => assertLightsShelter(reading, 'home_bed:old')).toThrow('exact added bed');
  reading.cells[0].key = 'air';
  expect(() => assertLightsShelter(reading, bed.id)).toThrow('roof cell');
  reading.cells[0].key = 'oak_plank';
  reading.bedCover.pop();
  expect(() => assertLightsShelter(reading, bed.id)).toThrow('both bed cells');
});
