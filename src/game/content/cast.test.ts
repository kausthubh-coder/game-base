import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ACCESSORIES } from '../../features/toon/accessories.ts';
import { CREATURES as BUILT } from '../../features/toon/creatures.ts';
import { CAST, CAST_ALIAS, CAST_BY_ID, CAST_MODELS } from './cast.ts';
import { CREATURES } from './creatures.ts';
import { PEOPLE } from './people.ts';
import { PETS } from './pets.ts';

/** The optional parts each mesh has in its file, by model and mesh. The cast's files have none. */
const FILE_PARTS: Record<string, readonly string[]> = {};

test('every character the game draws has a 3D look: the hero, the people, the pets and the creatures', () => {
  const sprites = new Set(['hero', 'hero-swing', ...PEOPLE.map((p) => p.sprite), ...PETS.map((p) => p.sprite), ...CREATURES.map((c) => c.sprite)]);
  for (const sprite of sprites) expect({ sprite, look: CAST[CAST_ALIAS[sprite] ?? sprite] !== undefined }).toEqual({ sprite, look: true });
});

test('every look names a model the cast lists, and every model is a file that exists or a creature built by code', () => {
  for (const [sprite, look] of Object.entries(CAST)) expect({ sprite, model: CAST_MODELS[look.model] !== undefined }).toEqual({ sprite, model: true });
  for (const [name, model] of Object.entries(CAST_MODELS)) {
    const ok = model.file.startsWith('code:')
      ? (BUILT as readonly string[]).includes(model.file.slice(5))
      : existsSync(resolve(import.meta.dir, '../../../public', model.file));
    expect({ name, file: model.file, ok }).toEqual({ name, file: model.file, ok: true });
    expect({ name, idle: model.clips.idle !== undefined }).toEqual({ name, idle: true });
  }
});

test('every part a character wears is in its mesh, or is an accessory on a model that names the bones to hang it on', () => {
  for (const [sprite, look] of Object.entries(CAST)) {
    const worn = [...(look.parts ?? []), ...Object.values(look.partsWhile ?? {}).flat()];
    for (const part of worn) {
      const inFile = (FILE_PARTS[`${look.model}/${[look.mesh].flat().join('+')}`] ?? []).includes(part);
      const known = inFile || ((ACCESSORIES as readonly string[]).includes(part) && CAST_MODELS[look.model].bones !== undefined);
      expect({ sprite, part, known }).toEqual({ sprite, part, known: true });
    }
  }
});

test('colours are whole sRGB numbers, and the colours by id are for people the game has', () => {
  for (const look of Object.values(CAST)) {
    for (const value of Object.values(look.colours ?? {})) expect(Number.isInteger(value) && value >= 0 && value <= 0xffffff).toBe(true);
  }
  const ids = new Set(PEOPLE.map((p) => `npc:${p.id}`));
  for (const id of Object.keys(CAST_BY_ID)) expect(ids.has(id)).toBe(true);
});
