import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { LEVELS, QUALITY, QUALITY_BUDGETS, QUALITY_LADDER, QUALITY_ROWS, levelOf, type QualityFeature } from './quality.ts';

test('every feature has a value at each of the four levels', () => {
  expect(LEVELS).toEqual(['low', 'medium', 'high', 'ultra']);
  for (const feature of Object.keys(QUALITY_ROWS) as QualityFeature[]) {
    expect(QUALITY_ROWS[feature]).toHaveLength(4);
    LEVELS.forEach((level, i) => expect(QUALITY[level][feature]).toBe(QUALITY_ROWS[feature][i] as number | boolean));
  }
});

test('a higher level never gives less', () => {
  const rising: QualityFeature[] = ['renderScale', 'pixelRatio', 'msaa', 'shadowMap', 'shadowReach', 'viewChunks', 'grassRings', 'plants', 'rainRings', 'particles', 'spriteLightRefresh', 'modelLightRefresh', 'buildGridReach'];
  for (const feature of rising) for (let i = 1; i < LEVELS.length; i++) expect(Number(QUALITY_ROWS[feature][i])).toBeGreaterThanOrEqual(Number(QUALITY_ROWS[feature][i - 1]));
  // Wider spacing is thinner grass, and a shadow map drawn every second frame is the cheaper one.
  for (const feature of ['grassSpacing', 'shadowEvery'] as QualityFeature[]) for (let i = 1; i < LEVELS.length; i++) expect(Number(QUALITY_ROWS[feature][i])).toBeLessThanOrEqual(Number(QUALITY_ROWS[feature][i - 1]));
  // A switch that is on at a level stays on above it.
  for (const feature of Object.keys(QUALITY_ROWS) as QualityFeature[]) {
    const row = QUALITY_ROWS[feature];
    if (typeof row[0] !== 'boolean') continue;
    for (let i = 1; i < LEVELS.length; i++) expect(Number(row[i])).toBeGreaterThanOrEqual(Number(row[i - 1]));
  }
});

test('ultra is high and more', () => {
  const more = (Object.keys(QUALITY_ROWS) as QualityFeature[]).filter((feature) => QUALITY.ultra[feature] !== QUALITY.high[feature]);
  expect(more.sort()).toEqual(['grassSpacing', 'msaa', 'pixelRatio', 'shadowMap', 'shadowReach', 'viewChunks']);
});

test('a level is read from an address or a stored setting by its name only', () => {
  expect(levelOf('ultra')).toBe('ultra');
  expect(levelOf('low')).toBe('low');
  for (const name of ['auto', 'Ultra', '', null, undefined, 3]) expect(levelOf(name)).toBeNull();
});

test('automatic quality starts at high, gives up size before effects, and never picks ultra', () => {
  expect(QUALITY_LADDER[0]).toEqual({ quality: 'high', scale: 1 });
  expect(QUALITY_LADDER.some((step) => step.quality === 'ultra')).toBe(false);
  for (let i = 1; i < QUALITY_LADDER.length; i++) {
    const a = QUALITY_LADDER[i - 1]!, b = QUALITY_LADDER[i]!;
    expect(LEVELS.indexOf(b.quality)).toBeLessThanOrEqual(LEVELS.indexOf(a.quality));
    expect(b.scale).toBeLessThanOrEqual(a.scale);
    expect(b.scale).toBeGreaterThanOrEqual(0.5);
  }
  expect(QUALITY_LADDER.at(-1)?.quality).toBe('low');
});

test('the budgets are the ones in docs/fast-everywhere.md', () => {
  expect(QUALITY_BUDGETS.low).toEqual({ drawCalls: 80, triangles: 150000 });
  expect(QUALITY_BUDGETS.high).toEqual({ drawCalls: 150, triangles: 400000 });
});

// The rule the table is there for: no view system keeps a table of its own or decides by the level's name.
// This reads the game's source and fails on a `Record<Quality, ...>` or a comparison with a level's name
// anywhere but here. The settings menu's list of names is the one exception: it is words, not graphics.
test('no file but this table decides anything by the quality level', () => {
  const src = resolve(import.meta.dir, '..');
  const allowed = new Set(['content/quality.ts', 'game/ui/menus.ui.ts']);
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      const name = relative(src, path);
      if (!name.endsWith('.ts') || name.endsWith('.test.ts') || allowed.has(name)) continue;
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        if (/Record<(Quality|Level)\b/.test(line) || /quality\w*\s*[!=]==\s*'(low|medium|high|ultra)'|'(low|medium|high|ultra)'\s*[!=]==\s*\w*quality/i.test(line)) found.push(`${name}:${i + 1}: ${line.trim()}`);
      });
    }
  };
  walk(src);
  expect(found).toEqual([]);
});
