// Tests for the art rules: sheets drawn here, each with one fault, and the rule that must name it.
//   bun test tools/art
import { beforeAll, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import sharp from 'sharp';
import { at, style } from './lib.mjs';
import { sheetFaults } from './rules.mjs';

const DIR = '.artifacts/art/test', SIZE = 96, DARK = [48, 37, 41, 255], FUR = [162, 113, 81, 255], WHITE = [250, 250, 250, 255];
const idleWalk = { idle: { frames: 2, fps: 4, rows: { front: 0, back: 1, side: 2 } }, walk: { frames: 4, fps: 10, rows: { front: 3, back: 4, side: 5 } } };
const contract = {
  kinds: { creature: { required: { idle: { frames: 2, dirs: ['front', 'back', 'side'] }, walk: { frames: 4, dirs: ['front', 'back', 'side'] } } } },
  poses: { loops: ['idle', 'walk'], once: ['wake'], held: ['poses'] },
  characters: { hero: { kind: 'creature' }, beast: { kind: 'creature', sheets: ['beast-wake'], stated: { blocks: 0.9, hero: 0.9 } } },
};

/** A sheet of 4 by 6 frames, each a brown box 40 wide and 60 high with a dark outline, feet on row 88. `change(col, row)` returns what differs. */
async function sheet(name, change = () => ({}), rows = 6) {
  const data = Buffer.alloc(SIZE * 4 * SIZE * rows * 4);
  for (let row = 0; row < rows; row++) for (let col = 0; col < (row < 3 ? 2 : 4); col++) {
    const { dx = 0, dy = 0, fill = FUR, rim = DARK, high = 60 } = change(col, row);
    for (let y = 0; y < high; y++) for (let x = 0; x < 40; x++) {
      const px = col * SIZE + 28 + x + dx, py = row * SIZE + 88 - high + 1 + y + dy;
      Buffer.from(x === 0 || y === 0 || x === 39 || y === high - 1 ? rim : fill).copy(data, (py * SIZE * 4 + px) * 4);
    }
    // A mark that moves from frame to frame, so no two frames are one picture.
    for (let k = 0; k < 6; k++) Buffer.from(DARK).copy(data, ((row * SIZE + 60 + dy) * SIZE * 4 + col * SIZE + 34 + col * 7 + k + dx) * 4);
  }
  await sharp(data, { raw: { width: SIZE * 4, height: SIZE * rows, channels: 4 } }).png().toFile(at(`${DIR}/${name}.png`));
  return { sheet: `../../${DIR}/${name}.png`, frame: [SIZE, SIZE], anchor: [48, 88], worldHeight: 1.4, animations: idleWalk };
}
const rulesOf = async (m, name) => (await sheetFaults(name, { m: { sprites: m }, s: style(), c: contract })).map((f) => f.rule).sort();

let hero;
beforeAll(async () => { fs.mkdirSync(at(DIR), { recursive: true }); hero = await sheet('hero'); });

describe('a sprite sheet against the style', () => {
  test('a clean sheet that stands as tall as its concept says breaks no rule', async () => {
    expect(await rulesOf({ hero, beast: await sheet('clean') }, 'beast')).toEqual([]);
  });

  test('a frame whose feet leave the anchor row is a baseline fault', async () => {
    expect(await rulesOf({ hero, beast: await sheet('floats', (col, row) => (row === 3 && col === 2 ? { dy: -4 } : {})) }, 'beast')).toEqual(['baseline']);
  });

  test('a body that slides sideways inside a loop is a steady fault', async () => {
    expect(await rulesOf({ hero, beast: await sheet('slides', (col, row) => (row === 0 && col === 1 ? { dx: 6 } : {})) }, 'beast')).toEqual(['steady']);
  });

  test('a figure with no dark outline is an outline fault, and a white rim a fringe fault', async () => {
    expect(await rulesOf({ hero, beast: await sheet('bare', () => ({ rim: FUR })) }, 'beast')).toEqual(['outline']);
    expect(await rulesOf({ hero, beast: await sheet('pale', () => ({ rim: WHITE })) }, 'beast')).toEqual(['fringe', 'outline']);
  });

  test('a frame recoloured from the first of its row is an identity fault', async () => {
    expect(await rulesOf({ hero, beast: await sheet('recoloured', (col, row) => (row === 4 && col === 3 ? { fill: [77, 113, 147, 255] } : {})) }, 'beast')).toEqual(['identity']);
  });

  test('a sheet that stands taller than its concept sheet states is a scale fault', async () => {
    const tall = { ...(await sheet('tall')), worldHeight: 2.1 };
    expect(await rulesOf({ hero, beast: tall }, 'beast')).toEqual(['scale']);
  });

  test('an action sheet at another size from its character is a same-size fault', async () => {
    const beast = await sheet('base'), wake = { ...(await sheet('wake', () => ({}), 1)), worldHeight: 2.2, animations: { wake: { frames: 2, fps: 2, rows: { front: 0 } } } };
    expect(await rulesOf({ hero, beast, 'beast-wake': wake }, 'beast-wake')).toEqual(['same-size']);
  });

  test('a sheet no character lists, with an animation the contract does not name, is a contract fault', async () => {
    const stray = { ...(await sheet('stray', () => ({}), 1)), animations: { wobble: { frames: 2, fps: 2, rows: { front: 0 } } } };
    expect([...new Set(await rulesOf({ hero, stray }, 'stray'))]).toEqual(['contract']);
  });
});
