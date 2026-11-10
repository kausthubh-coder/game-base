import { expect, test } from 'bun:test';
import { AssetError, PLACEHOLDER_NAME, loadAssets, type AssetIO, type Assets, type LoadProgress, type Pixels, type SpriteAtlas } from './index.ts';
import { ASSETS_FOLDER as FOLDER, diskIO, firstSpritesIO as disk } from './test-io.ts';

const load = (io: AssetIO = disk, onProgress?: (p: LoadProgress) => void): Promise<Assets> => loadAssets({ baseUrl: FOLDER, io, onProgress });

/** The message a load fails with. */
async function failure(io: AssetIO): Promise<string> {
  try {
    await load(io);
  } catch (error) {
    expect(error).toBeInstanceOf(AssetError);
    return (error as Error).message;
  }
  throw new Error('the load did not fail');
}

/** The real manifest with one change. */
function changed(change: (manifest: Record<string, any>) => void): AssetIO {
  return {
    json: async (url) => {
      const manifest = (await disk.json(url)) as Record<string, any>;
      change(manifest);
      return manifest;
    },
    image: disk.image,
  };
}

function pixelAt(pixels: Pixels, x: number, y: number): number[] {
  const i = (y * pixels.width + x) * 4;
  return [...pixels.data.slice(i, i + 4)];
}

function atlasPixel(atlas: SpriteAtlas, page: number, x: number, y: number): number[] {
  const data = atlas.texture.image.data as Uint8Array;
  const i = ((page * atlas.height + y) * atlas.width + x) * 4;
  return [...data.slice(i, i + 4)];
}

test('the real assets load, and each kind gives a typed result', async () => {
  const assets = await load();
  expect(assets.spriteNames()).toEqual(['hero', 'villager-a', 'villager-b', 'pet', 'critter']);

  const hero = assets.sprite('hero');
  expect(hero.frame).toEqual([128, 128]);
  expect(hero.anchor).toEqual([64, 120]);
  expect(hero.worldHeight).toBe(2);
  expect(hero.animations.walk).toEqual({ frames: 6, fps: 10, rows: { front: 3, back: 4, side: 5 } });
  expect([hero.pixels.width, hero.pixels.height]).toEqual([768, 896]);
  // The body stands on the anchor row and is centered on the anchor column, within a few pixels.
  const [left, top, right, bottom] = hero.body;
  expect(bottom).toBeGreaterThanOrEqual(118);
  expect(bottom).toBeLessThanOrEqual(121);
  expect(Math.abs((left + right) / 2 - 64)).toBeLessThan(6);
  expect(bottom - top).toBeGreaterThan(90);

  const blocks = assets.blockAtlas();
  const listed = assets.manifest.blocks!;
  expect(blocks.tile).toBe(listed.tile);
  expect(blocks.cells('grass_top').map((c) => [c.column, c.row])).toEqual(listed.tiles.grass_top);
  const [column, row] = listed.tiles.dirt[0], tile = listed.tile, { width, height } = blocks.pixels;
  expect(blocks.cells('dirt')[0]).toEqual({ column, row, x: column * tile, y: row * tile, uv: [column * tile / width, row * tile / height, (column + 1) * tile / width, (row + 1) * tile / height] });
  expect(blocks.cells('dirt')[0].uv[2]).toBeLessThanOrEqual(1);
  expect(blocks.texture.magFilter).toBe(1003); // THREE.NearestFilter
  expect(blocks.texture.minFilter).toBe(1003);

  const lantern = assets.icon('lantern');
  expect([lantern.x, lantern.y, lantern.tile]).toEqual([96, 96, 32]);
  expect(lantern.uv).toEqual([0.75, 0.75, 1, 1]);
  expect(lantern.texture.magFilter).toBe(1003);
  expect(assets.iconNames()).toEqual(Object.keys(assets.manifest.icons!.names));
});

test('the manifest as it is today loads whole, and every sheet it lists is in the atlas', async () => {
  const seen: LoadProgress[] = [];
  const assets = await loadAssets({ baseUrl: FOLDER, io: diskIO, onProgress: (p) => seen.push({ ...p }) });
  const names = assets.spriteNames();
  expect(names.length).toBeGreaterThanOrEqual(5);
  expect(seen.at(-1)!.loaded).toBe(seen.at(-1)!.total);
  const atlas = assets.spriteAtlas();
  const places = names.map((name) => ({ name, ...atlas.place(name) }));
  for (const [i, a] of places.entries()) {
    const sprite = assets.sprite(a.name);
    expect([a.width, a.height]).toEqual([sprite.pixels.width, sprite.pixels.height]);
    // Every frame of every animation has something drawn in it.
    for (const [animation, anim] of Object.entries(sprite.animations)) {
      for (const row of Object.values(anim.rows)) {
        for (let frame = 0; frame < anim.frames; frame++) {
          let solid = 0;
          for (let y = 0; y < sprite.frame[1]; y += 2) for (let x = 0; x < sprite.frame[0]; x += 2) if (pixelAt(sprite.pixels, frame * sprite.frame[0] + x, row * sprite.frame[1] + y)[3] === 255) solid++;
          if (solid < 20) throw new Error(`${a.name} ${animation} row ${row} frame ${frame} is empty`);
        }
      }
    }
    // The middle of the first frame is in the atlas where the sheet was placed.
    const x = sprite.frame[0] >> 1, y = sprite.frame[1] >> 1;
    expect(atlasPixel(atlas, a.page, a.x + x, a.y + y)).toEqual(pixelAt(sprite.pixels, x, y));
    for (const b of places.slice(i + 1)) {
      const apart = a.page !== b.page || a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
      if (!apart) throw new Error(`${a.name} and ${b.name} overlap in the atlas`);
    }
  }
  // Every sheet of tiles it lists has its cells inside its image, every icon is found, and every image has a size.
  for (const name of assets.sheetNames()) {
    const sheet = assets.sheet(name);
    for (const tile of sheet.names) for (const cell of sheet.cells(tile)) expect(cell.uv.every((v) => v >= 0 && v <= 1)).toBe(true);
  }
  for (const name of assets.iconNames()) expect(assets.icon(name).name).toBe(name);
  for (const group of assets.imageNames()) for (const name of assets.imageNames(group)) expect(assets.image(group, name).width).toBeGreaterThan(0);
});

test('asking for something the manifest does not have fails with its name', async () => {
  const assets = await load();
  expect(() => assets.sprite('dragon')).toThrow(new AssetError('manifest.json has no sprite named "dragon". It has: hero, villager-a, villager-b, pet, critter.'));
  expect(() => assets.icon('crown')).toThrow(/manifest\.json has no icon named "crown"\. It has: wood, stone, /);
  expect(() => assets.blockAtlas().cells('lava')).toThrow(/manifest\.json has no block tile named "lava"/);
  expect(() => assets.variant('dragon', { '#000000': '#ffffff' })).toThrow(/no sprite named "dragon"/);

  const bare = await load(changed((m) => { delete m.blocks; delete m.icons; }));
  expect(() => bare.blockAtlas()).toThrow('manifest.json has no "blocks" entry, so there is no block atlas.');
  expect(() => bare.icon('wood')).toThrow('manifest.json has no icon named "wood". It has: none.');
  expect(() => bare.sheet('portraits')).toThrow('manifest.json has no "portraits" entry. Its sheets of tiles are: none.');
  expect(() => assets.sheet('banners')).toThrow('manifest.json has no "banners" entry. Its sheets of tiles are: blocks, icons.');
});

test('a sheet of tiles the contract does not name loads like the icons do', async () => {
  // The icon sheet again under two new names: one cell per name, and several cells per name.
  const assets = await load(changed((m) => {
    m.portraits = { tile: 64, sheet: 'icons/icons.png', names: { hero: [1, 0], maren: [0, 1] } };
    m.crops = { tile: 32, sheet: 'icons/icons.png', names: { wheat: [[0, 0], [1, 0], [2, 0], [3, 0]] } };
  }));
  expect(assets.sheetNames()).toEqual(['blocks', 'icons', 'portraits', 'crops']);
  const portraits = assets.sheet('portraits');
  expect([portraits.name, portraits.tile, portraits.names]).toEqual(['portraits', 64, ['hero', 'maren']]);
  expect(portraits.cells('hero')).toEqual([{ column: 1, row: 0, x: 64, y: 0, uv: [0.5, 0, 1, 0.5] }]);
  expect(portraits.texture.magFilter).toBe(1003); // THREE.NearestFilter
  expect(assets.sheet('crops').cells('wheat').map((c) => c.x)).toEqual([0, 32, 64, 96]);
  expect(() => portraits.cells('odo')).toThrow('manifest.json has no "portraits" tile named "odo". It has: hero, maren.');
  // The well-known sheets are the same objects by either road.
  expect(assets.sheet('blocks')).toBe(assets.blockAtlas());
  expect(assets.sheet('icons').cells('lantern')[0].uv).toEqual(assets.icon('lantern').uv);

  const outside = await failure(changed((m) => { m.portraits = { tile: 64, sheet: 'icons/icons.png', names: { hero: [2, 0] } }; }));
  expect(outside).toBe('manifest.json: portraits.names.hero is the cell [2, 0] of 64 pixel tiles, which is outside icons/icons.png (128 by 128).');
  const lost = await failure(changed((m) => { m.portraits = { tile: 64, sheet: 'portraits/none.png', names: {} }; }));
  expect(lost).toContain('portraits/none.png, the "portraits" sheet');
});

test('a second icon sheet adds its icons, and the old names keep working', async () => {
  // The block atlas stands in for a second icon sheet.
  const assets = await load(changed((m) => {
    m.icons.sheets = { story: { tile: 32, sheet: 'blocks/atlas.png', names: { plank: [1, 0], heart: [3, 3], wood: [7, 4] } } };
  }));
  const first = Object.keys(assets.manifest.icons!.names);
  expect(assets.iconNames()).toEqual([...first, 'plank', 'heart']);
  const heart = assets.icon('heart'), lantern = assets.icon('lantern');
  expect([heart.x, heart.y, heart.tile, heart.url.endsWith('blocks/atlas.png')]).toEqual([96, 96, 32, true]);
  expect(heart.texture).toBe(assets.sheet('icons.story').texture);
  expect(heart.texture).not.toBe(lantern.texture);
  // A name on both sheets is the first sheet's icon.
  expect(assets.icon('wood').texture).toBe(lantern.texture);
  expect(assets.icon('wood').x).toBe(assets.manifest.icons!.names.wood[0] * 32);
  expect(() => assets.icon('crown')).toThrow(/no icon named "crown"\. It has: .*lantern.*, plank, heart\./);
  expect(await failure(changed((m) => { m.icons.sheets = { story: { tile: 32, sheet: 'icons/none.png', names: {} } }; }))).toContain('icons/none.png, the "story" icon sheet');
});

test('whole images listed by name load, and a missing one fails with its name', async () => {
  const assets = await load(changed((m) => { m.ui = { panel: 'icons/icons.png', title: 'blocks/atlas.png' }; }));
  expect(assets.imageNames()).toEqual(['ui']);
  expect(assets.imageNames('ui')).toEqual(['panel', 'title']);
  const title = assets.image('ui', 'title');
  expect([title.group, title.name, title.width, title.height]).toEqual(['ui', 'title', assets.blockAtlas().pixels.width, assets.blockAtlas().pixels.height]);
  expect(title.url.endsWith('blocks/atlas.png')).toBe(true);
  expect(title.texture.magFilter).toBe(1003); // THREE.NearestFilter
  expect(() => assets.image('ui', 'banner')).toThrow('manifest.json has no image named "banner" in "ui". It has: panel, title.');
  expect(() => assets.image('hud', 'panel')).toThrow('manifest.json has no "hud" entry that lists images. It has: ui.');
  expect(await failure(changed((m) => { m.ui = { panel: 'ui/none.png' }; }))).toContain('ui/none.png, the "panel" image of "ui"');
});

test('a file that is listed but missing fails with the file and the entry that lists it', async () => {
  const io: AssetIO = {
    json: disk.json,
    image: (url) => (url.endsWith('sprites/pet.png') || url.endsWith('icons/icons.png') ? Promise.reject(new Error('the server answered 404')) : disk.image(url)),
  };
  expect(await failure(io)).toBe(
    '2 asset files listed in manifest.json did not load: icons/icons.png, the icon sheet (the server answered 404); sprites/pet.png, the sheet of sprite "pet" (the server answered 404).',
  );
});

test('a missing or broken manifest fails with its address', async () => {
  const message = await failure({ json: () => Promise.reject(new Error('the server answered 404')), image: disk.image });
  expect(message).toBe(`The asset manifest did not load from ${FOLDER}manifest.json: the server answered 404.`);
  expect(await failure(changed((m) => { delete m.sprites.hero.frame; }))).toContain('sprites.hero.frame is missing');
});

test('a sheet smaller than its animations need fails with the animation', async () => {
  const message = await failure(changed((m) => { m.sprites.critter.animations.walk.frames = 5; }));
  expect(message).toContain('sprites.critter.animations.walk puts its front view on row 3 with 5 frames of 96 by 96');
  expect(message).toContain('sprites/critter.png is 384 by 576');
  expect(await failure(changed((m) => { m.icons.names.crown = [4, 0]; }))).toContain('icons.names.crown is the cell [4, 0]');
});

test('progress counts every file once and ends at the total', async () => {
  const seen: LoadProgress[] = [];
  await load(disk, (p) => seen.push({ ...p }));
  // The manifest, five sheets, the block atlas and the icon sheet.
  expect(seen.length).toBe(8);
  expect(seen[0]).toEqual({ loaded: 1, total: 8, file: 'manifest.json' });
  expect(seen.map((p) => p.loaded)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(seen.map((p) => p.file).sort()).toEqual([
    'blocks/atlas.png', 'icons/icons.png', 'manifest.json', 'sprites/critter.png', 'sprites/hero.png', 'sprites/pet.png', 'sprites/villager-a.png', 'sprites/villager-b.png',
  ]);
});

test('the atlas holds every sheet, pixel for pixel, on one page', async () => {
  const assets = await load();
  const atlas = assets.spriteAtlas();
  expect([atlas.width, atlas.height, atlas.pages]).toEqual([2048, 2048, 1]);
  expect(atlas.texture.magFilter).toBe(1003); // THREE.NearestFilter
  expect(assets.spriteAtlas()).toBe(atlas);

  const next = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  for (const name of [...assets.spriteNames(), PLACEHOLDER_NAME]) {
    const sprite = name === PLACEHOLDER_NAME ? assets.placeholder() : assets.sprite(name);
    const place = atlas.place(name);
    expect([place.width, place.height]).toEqual([sprite.pixels.width, sprite.pixels.height]);
    let solid = 0;
    for (let i = 0; i < 4000; i++) {
      const x = Math.floor(next() * place.width), y = Math.floor(next() * place.height);
      const want = pixelAt(sprite.pixels, x, y);
      expect(atlasPixel(atlas, place.page, place.x + x, place.y + y)).toEqual(want);
      if (want[3] === 255) solid++;
    }
    expect(solid).toBeGreaterThan(100);
  }
  expect(() => atlas.place('dragon')).toThrow('The sprite atlas has no sheet named "dragon".');
});

test('a variant swaps exact colors and leaves the rest of the sheet alone', async () => {
  const assets = await load();
  const pet = assets.sprite('pet');
  // The fox's orange coat, to grey.
  const grey = assets.variant('pet', { '#d67c59': '#918996', '#ab5e4e': '#726c7a' });
  expect(grey.name).toBe('pet~1');
  expect(grey.base).toBe('pet');
  expect(grey.frame).toEqual(pet.frame);
  expect(grey.animations).toEqual(pet.animations);
  expect(assets.hasSprite('pet~1')).toBe(true);
  expect(assets.sprite('pet~1')).toBe(grey);

  let coat = 0, shade = 0, other = 0;
  for (let i = 0; i < pet.pixels.data.length; i += 4) {
    const before = [...pet.pixels.data.slice(i, i + 4)], after = [...grey.pixels.data.slice(i, i + 4)];
    const hex = before[3] ? ((before[0] << 16) | (before[1] << 8) | before[2]).toString(16).padStart(6, '0') : 'clear';
    if (hex === 'd67c59') { expect(after).toEqual([0x91, 0x89, 0x96, 255]); coat++; }
    else if (hex === 'ab5e4e') { expect(after).toEqual([0x72, 0x6c, 0x7a, 255]); shade++; }
    else { if (before.join() !== after.join()) throw new Error(`pixel ${i / 4} changed from ${before} to ${after}`); other++; }
  }
  // The counts the sheet really has.
  expect([coat, shade]).toEqual([17253, 6103]);
  expect(other).toBe(384 * 576 - 17253 - 6103);

  // The same colors again give the same variant. New colors give the next name, and a name can be chosen.
  expect(assets.variant('pet', { '#AB5E4E': '#726C7A', '#d67c59': '#918996' })).toBe(grey);
  expect(assets.variant('pet', { '#d67c59': '#4d7193' }).name).toBe('pet~2');
  expect(assets.variant('critter', { '#6c8043': '#925d79' }, 'pink-critter').name).toBe('pink-critter');
  expect(() => assets.variant('critter', { '#6c8043': '#b68e99' }, 'hero')).toThrow('there is already a sprite named "hero"');
  expect(assets.spriteNames()).toEqual(['hero', 'villager-a', 'villager-b', 'pet', 'critter', 'pet~1', 'pet~2', 'pink-critter']);
});

test('a variant whose colors are not in the sheet fails and names them', async () => {
  const assets = await load();
  expect(() => assets.variant('critter', { '#123456': '#ffffff', '#abcdef': '#000000' })).toThrow(
    new AssetError('assets.variant("critter"): none of the colors #123456, #abcdef are in its sheet. A variant swaps exact colors.'),
  );
});

test('a new variant repacks the atlas with the variant in it', async () => {
  const assets = await load();
  const before = assets.spriteAtlas();
  const grey = assets.variant('pet', { '#d67c59': '#918996' });
  const after = assets.spriteAtlas();
  expect(after).not.toBe(before);
  const place = after.place('pet~1');
  // A pixel of the coat: grey in the variant's part of the atlas, orange in the pet's.
  const pet = assets.sprite('pet');
  let x = 0, y = 0;
  search: for (y = 0; y < 96; y++) for (x = 0; x < 96; x++) if (pixelAt(pet.pixels, x, y).join() === '214,124,89,255') break search;
  expect(pixelAt(grey.pixels, x, y)).toEqual([0x91, 0x89, 0x96, 255]);
  expect(atlasPixel(after, place.page, place.x + x, place.y + y)).toEqual([0x91, 0x89, 0x96, 255]);
  const original = after.place('pet');
  expect(atlasPixel(after, original.page, original.x + x, original.y + y)).toEqual([214, 124, 89, 255]);
});

test('sheets too many for one page go to a second page of the same texture', async () => {
  const assets = await loadAssets({ baseUrl: FOLDER, io: disk, maxAtlasSize: 1024 });
  const atlas = assets.spriteAtlas();
  expect([atlas.width, atlas.height]).toEqual([1024, 1024]);
  expect(atlas.pages).toBeGreaterThan(1);
  expect(atlas.texture.image.depth).toBe(atlas.pages);
  const hero = assets.sprite('hero'), place = atlas.place('hero');
  // The hero's face, wherever its page is.
  expect(atlasPixel(atlas, place.page, place.x + 64, place.y + 40)).toEqual(pixelAt(hero.pixels, 64, 40));
  expect(pixelAt(hero.pixels, 64, 40)[3]).toBe(255);
});
