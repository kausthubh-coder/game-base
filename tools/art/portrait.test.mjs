import { expect, test } from 'bun:test';
import { contract, manifest, style } from './lib.mjs';
import { portraitFaults } from './rules.mjs';

// Real frozen artwork: Ilara's glad portrait matches the boar's head colours
// better than its own. The boar's four sheets still represent one character.
function fixture() {
  const original = manifest(), m = structuredClone(original), c = contract(), s = style();
  m.portraits.names = { 'ilara-glad': original.portraits.names['ilara-glad'] };
  m.sprites = Object.fromEntries(['ilara', 'boar', 'boar-fight', 'boar-blighted', 'boar-calmed'].map(n => [n, original.sprites[n]]));
  s.limits.portrait.rank = 2;
  return { m, c, s };
}

test('another character counts once across its action and variant sheets', async () => {
  expect(await portraitFaults(fixture())).toEqual({});
});

test('another distinct character still counts even when its pixels match a competitor', async () => {
  const f = fixture();
  f.m.sprites.other = structuredClone(f.m.sprites.boar);
  f.c.characters.other = { kind: 'creature' };
  expect((await portraitFaults(f)).ilara?.[0].rule).toBe('portrait');
});

test('a portrait must still meet its own base-head similarity threshold', async () => {
  const f = fixture();
  f.s.limits.portrait.like = 0.99;
  expect((await portraitFaults(f)).ilara?.[0].rule).toBe('portrait');
});

test('a flattering action head cannot replace the own base-head match', async () => {
  const f = fixture();
  f.m.sprites['ilara-action'] = structuredClone(f.m.sprites['boar-fight']);
  f.c.characters.ilara.sheets = [...(f.c.characters.ilara.sheets ?? []), 'ilara-action'];
  f.s.limits.portrait.like = 0.9;
  expect((await portraitFaults(f)).ilara?.[0].rule).toBe('portrait');
});
