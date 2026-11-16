// The three engineered farms against the playthrough site's Build tab. `tinker-expect.json` is what
// `playthrough/tinker.js` says for each of its toy layouts, on Give and on Take: the tag, the line under it, the
// symptom and the fix. The rules here must say the same, word for word.
import { describe, expect, test } from 'bun:test';
import { type At, type FarmCell, type FarmGrid, lampLight, scoreBait, scorePit, scoreTerrace } from './rules.sim.ts';
import tinker from './tinker-expect.json';

type Preset = { name: string; items: [number, number, string][]; give: Said; take?: Said };
type Said = { tag: string; sub: string; symptom: string; fix: string };

const COLS = 8, ROWS = 6;
const gridOf = (items: readonly [number, number, string][]): FarmGrid => {
  const grid: FarmGrid = Array.from({ length: ROWS }, () => Array<FarmCell>(COLS).fill(null));
  for (const [x, y, t] of items) grid[y][x] = t as FarmCell;
  return grid;
};
const expected = tinker as unknown as Record<'pit' | 'bait' | 'terrace', Preset[]>;
const said = (s: Said) => ({ tag: s.tag, sub: s.sub, symptom: s.symptom, fix: s.fix });

const ROOTS: At[] = [[6, 1], [6, 4], [1, 5]];
const DOORS: At[] = [[2, 0], [3, 0], [5, 0], [0, 2], [0, 3], [2, 5], [4, 5], [5, 5]];

describe('the gearling pit says what the Build tab says', () => {
  for (const preset of expected.pit) {
    test(preset.name, () => {
      const grid = gridOf(preset.items);
      const layout = { grid, wheelRow: 3, lit: lampLight(grid), power: 4 };
      expect(said(scorePit(layout, false))).toEqual(preset.give);
      expect(said(scorePit(layout, true))).toEqual(preset.take as Said);
    });
  }
});

describe('the bait field says what the Build tab says', () => {
  for (const preset of expected.bait) {
    test(preset.name, () => {
      const grid = gridOf(preset.items);
      // The house in the corner lights the blocks round its window.
      const layout = { grid, doors: DOORS, roots: ROOTS, lit: lampLight(grid, [[0, 0]]) };
      expect(said(scoreBait(layout, false))).toEqual(preset.give);
      expect(said(scoreBait(layout, true))).toEqual(preset.take as Said);
    });
  }
});

describe('the terrace says what the Build tab says', () => {
  for (const preset of expected.terrace) {
    test(preset.name, () => {
      const layout = { grid: gridOf(preset.items), ditch: (x: number) => x === 1, wheelPower: (_x: number, y: number) => (y < 2 ? 6 : 4) };
      expect(said(scoreTerrace(layout))).toEqual(preset.give);
    });
  }
});

test('the pit with a pusher sends every gearling through, one spring each', () => {
  const grid = gridOf([[4, 0, 'fence'], [4, 1, 'fence'], [4, 2, 'fence'], [4, 4, 'fence'], [4, 5, 'fence'], [3, 3, 'pit'], [3, 4, 'pusher']]);
  const score = scorePit({ grid, wheelRow: 3, lit: lampLight(grid), power: 4 }, false);
  expect(score.rate).toBe(6);
  expect(score.run.g.every((m) => m.state === 'gone')).toBe(true);
  expect(score.run.jammed).toBe(false);
});

test('a lamp over the pit lets a gearling walk into the wheel', () => {
  const grid = gridOf([[4, 0, 'fence'], [4, 1, 'fence'], [4, 2, 'fence'], [4, 4, 'fence'], [4, 5, 'fence'], [3, 3, 'pit'], [3, 4, 'pusher'], [2, 2, 'lamp']]);
  const score = scorePit({ grid, wheelRow: 3, lit: lampLight(grid), power: 4 }, false);
  expect(score.run.jammed).toBe(true);
  expect(score.run.litPass).toBeGreaterThan(0);
  expect(score.symptom).toBe('A gearling walked straight across the pit and into the wheel. The wheel has stopped.');
});
