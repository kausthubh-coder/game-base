import { expect, test } from 'bun:test';
import { ACCESSORIES } from '../../features/toon/accessories.ts';
import { CAST, CAST_ALIAS, CAST_BY_ID } from './cast.ts';
import { CREATURES } from './creatures.ts';
import { PEOPLE } from './people.ts';
import { PETS } from './pets.ts';

/** The heads and other parts each stand-in body has in its file (tools/models/cast/stand-ins.mjs). */
const FILE_PARTS: Record<string, readonly string[]> = {
  slim: ['cape'],
  dress: [],
  stout: ['beard'],
  mossling: [],
  leaftail: [],
  lanternfly: [],
};

test('every character the game draws has a 3D look: the hero, the people, the pets and the creatures', () => {
  const sprites = new Set(['hero', 'hero-swing', ...PEOPLE.map((p) => p.sprite), ...PETS.map((p) => p.sprite), ...CREATURES.map((c) => c.sprite)]);
  for (const sprite of sprites) expect({ sprite, look: CAST[CAST_ALIAS[sprite] ?? sprite] !== undefined }).toEqual({ sprite, look: true });
});

test('every part a character wears is in its body or is an accessory built by code', () => {
  for (const [sprite, look] of Object.entries(CAST)) {
    const worn = [...look.parts, ...Object.values(look.partsWhile ?? {}).flat()];
    for (const part of worn) {
      const known = FILE_PARTS[look.body].includes(part) || (ACCESSORIES as readonly string[]).includes(part);
      expect({ sprite, part, known }).toEqual({ sprite, part, known: true });
    }
  }
});

test('colours are whole sRGB numbers, and the colours by id are for people the game has', () => {
  for (const look of Object.values(CAST)) {
    for (const value of Object.values(look.colours)) expect(Number.isInteger(value) && value >= 0 && value <= 0xffffff).toBe(true);
  }
  const ids = new Set(PEOPLE.map((p) => `npc:${p.id}`));
  for (const id of Object.keys(CAST_BY_ID)) expect(ids.has(id)).toBe(true);
});
