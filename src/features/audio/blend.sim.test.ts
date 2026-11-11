import { expect, test } from 'bun:test';
import { palettes } from '../../content/palettes/index.ts';
import {
  allowedMasks, blendTempo, countBits, crossoverGains, dayAmount, maskNames, normalizeWeights, PALETTE_LAYERS, pitchMask, slewWeights, snapToMask,
} from './blend.sim.ts';

const ids = palettes.map((p) => p.id);
const masks = palettes.map(pitchMask);
const at = (id: string): number => ids.indexOf(id);
/** Weights with two lands sharing the air. */
function pair(a: string, b: string, share: number): number[] {
  const w = ids.map(() => 0);
  w[at(a)] = 1 - share;
  w[at(b)] = share;
  return w;
}

test('weights from the game are cleaned up', () => {
  const out: number[] = [];
  normalizeWeights({ meadow: 2, desert: 2, nowhere: 5, coast: -1 }, ids, out);
  expect(out[at('meadow')]).toBeCloseTo(0.5);
  expect(out[at('desert')]).toBeCloseTo(0.5);
  expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  normalizeWeights({}, ids, out);
  expect(out[0]).toBe(1);
});

test('inside one land only that land plays, on every layer', () => {
  const out: number[] = [];
  for (const layer of PALETTE_LAYERS) {
    crossoverGains(layer, pair('meadow', 'desert', 0), out);
    expect(out[at('meadow')]).toBe(1);
    expect(out[at('desert')]).toBe(0);
  }
});

test('halfway through a border band both lands sound', () => {
  const out: number[] = [];
  for (const layer of ['drone', 'harmony', 'melody', 'bass', 'perc'] as const) {
    crossoverGains(layer, pair('meadow', 'desert', 0.5), out);
    expect(out[at('meadow')]).toBeGreaterThan(0.2);
    expect(out[at('desert')]).toBeCloseTo(out[at('meadow')] as number);
  }
});

test('the layers cross one at a time: the drone first, the lead in the middle, the sparkle last', () => {
  const out: number[] = [];
  const gain = (layer: (typeof PALETTE_LAYERS)[number], share: number): number => {
    crossoverGains(layer, pair('meadow', 'desert', share), out);
    return out[at('desert')] as number;
  };
  expect(gain('drone', 0.3)).toBeGreaterThan(0.1);
  expect(gain('melody', 0.3)).toBe(0);
  expect(gain('melody', 0.6)).toBeGreaterThan(0.6);
  expect(gain('sparkle', 0.6)).toBeLessThan(0.1);
  expect(gain('sparkle', 0.95)).toBeGreaterThan(0.9);
});

test('a layer only grows as its land comes nearer, and never doubles the power', () => {
  const out: number[] = [];
  for (const layer of PALETTE_LAYERS) {
    let last = 0;
    for (let share = 0; share <= 1.0001; share += 0.02) {
      crossoverGains(layer, pair('coast', 'highlands', share), out);
      const coming = out[at('highlands')] as number;
      const going = out[at('coast')] as number;
      expect(coming).toBeGreaterThanOrEqual(last - 1e-9);
      expect(coming * coming + going * going).toBeLessThanOrEqual(1 + 1e-9);
      last = coming;
    }
  }
});

test('every pair of neighbors shares at least four notes', () => {
  const ring = ['meadow', 'desert', 'rainvalley', 'forge', 'highlands', 'coast'];
  for (let i = 0; i < ring.length; i++) {
    const a = masks[at(ring[i] as string)] as number;
    const b = masks[at(ring[(i + 1) % ring.length] as string)] as number;
    expect(countBits(a & b)).toBeGreaterThanOrEqual(4);
    expect(countBits(a & (masks[at('center')] as number))).toBeGreaterThanOrEqual(4);
  }
});

test('the town and the meadow around it share five notes, and their tempos are close enough to glide', () => {
  const shared = (masks[at('meadow')] as number) & (masks[at('town')] as number);
  expect(maskNames(shared).split(' ').sort()).toEqual(['A', 'B', 'D', 'E', 'F#']);
  const meadowTempo = palettes[at('meadow')]?.tempo as number, townTempo = palettes[at('town')]?.tempo as number;
  expect(Math.abs(townTempo / meadowTempo - 1)).toBeLessThan(0.12);
});

test('in a border band both lands keep to the notes they share', () => {
  const out: number[] = [];
  allowedMasks(masks, pair('meadow', 'desert', 0.5), out);
  const shared = (masks[at('meadow')] as number) & (masks[at('desert')] as number);
  expect(out[at('meadow')]).toBe(shared);
  expect(out[at('desert')]).toBe(shared);
  // Deep inside, a land has its whole scale. The faint neighbor still keeps to the shared notes.
  allowedMasks(masks, pair('meadow', 'desert', 0.1), out);
  expect(out[at('meadow')]).toBe(masks[at('meadow')] as number);
  expect(out[at('desert')]).toBe(shared);
});

test('a snapped note is allowed, close, and left alone when it was already fine', () => {
  const mask = (masks[at('meadow')] as number) & (masks[at('desert')] as number);
  for (let midi = 40; midi < 90; midi++) {
    const to = snapToMask(midi, mask);
    expect(mask & (1 << (to % 12))).not.toBe(0);
    expect(Math.abs(to - midi)).toBeLessThanOrEqual(3);
    if (mask & (1 << (midi % 12))) expect(to).toBe(midi);
  }
});

test('one tempo for the mix, between the two lands', () => {
  const tempos = palettes.map((p) => p.tempo);
  expect(blendTempo(tempos, pair('meadow', 'desert', 0))).toBeCloseTo(84);
  expect(blendTempo(tempos, pair('meadow', 'desert', 1))).toBeCloseTo(96);
  const mid = blendTempo(tempos, pair('meadow', 'desert', 0.5));
  expect(mid).toBeGreaterThan(84);
  expect(mid).toBeLessThan(96);
});

test('a teleport is a morph: the weights glide and still sum to 1', () => {
  const now = pair('meadow', 'desert', 0);
  const goal = pair('forge', 'desert', 0);
  slewWeights(now, goal, 0.05);
  expect(now[at('meadow')]).toBeGreaterThan(0.9);
  // One second in, both lands still sound.
  for (let i = 0; i < 15; i++) slewWeights(now, goal, 0.05);
  expect(now[at('meadow')]).toBeGreaterThan(0.3);
  expect(now[at('forge')]).toBeGreaterThan(0.3);
  expect(now.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  for (let i = 0; i < 60; i++) slewWeights(now, goal, 0.05);
  expect(now[at('forge')]).toBe(1);
});

test('walking is slower than the limit, so the mix follows position exactly', () => {
  const now = pair('meadow', 'desert', 0);
  // The demo's run crosses a 60-unit band in 1.8 seconds: the weight moves 0.028 every 50 ms.
  for (let share = 0; share <= 1; share += 0.028) {
    slewWeights(now, pair('meadow', 'desert', share), 0.05);
    expect(now[at('desert')]).toBeCloseTo(share, 6);
  }
});

test('day and night', () => {
  expect(dayAmount(0.5)).toBe(1);
  expect(dayAmount(0)).toBe(0);
  expect(dayAmount(0.25)).toBeGreaterThan(0);
  expect(dayAmount(0.25)).toBeLessThan(1);
});
