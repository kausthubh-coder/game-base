import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AssetError, checkCell, checkSheetSize, parseManifest } from './manifest.ts';

const whole = (): Record<string, any> => JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../public/assets/manifest.json'), 'utf8'));
/** The real manifest with the first five sprites only. The asset pipeline keeps adding characters. */
const real = (): Record<string, any> => {
  const { version, sprites, blocks, icons } = whole();
  const firstIcons = { tile: icons.tile, sheet: icons.sheet, names: icons.names };
  return { version, sprites: Object.fromEntries(['hero', 'villager-a', 'villager-b', 'pet', 'critter'].map((name) => [name, sprites[name]])), blocks, icons: firstIcons };
};

/** The message `parseManifest` fails with after `change` has broken a copy of the real manifest. */
function broken(change: (manifest: Record<string, any>) => void): string {
  const manifest = real();
  change(manifest);
  try {
    parseManifest(manifest);
  } catch (error) {
    expect(error).toBeInstanceOf(AssetError);
    return (error as Error).message;
  }
  throw new Error('the broken manifest passed the check');
}

test('the real manifest passes and comes back typed', () => {
  const manifest = parseManifest(real());
  expect(Object.keys(manifest.sprites)).toEqual(['hero', 'villager-a', 'villager-b', 'pet', 'critter']);
  expect(manifest.sprites.hero).toEqual({
    sheet: 'sprites/hero.png', frame: [128, 128], anchor: [64, 120], worldHeight: 2,
    animations: {
      idle: { frames: 4, fps: 4, rows: { front: 0, back: 1, side: 2 } },
      walk: { frames: 6, fps: 10, rows: { front: 3, back: 4, side: 5 } },
      tool: { frames: 3, fps: 8, rows: { front: 6 } },
    },
  });
  expect(manifest.blocks).toEqual(real().blocks);
  expect(manifest.icons).toEqual(real().icons);
});

test('the manifest as it is today passes, whatever the asset pipeline has added', () => {
  const manifest = parseManifest(whole());
  expect(Object.keys(manifest.sprites)).toEqual(Object.keys(whole().sprites));
  expect(manifest.blocks).toEqual(whole().blocks);
  expect(manifest.icons?.names).toEqual(whole().icons.names);
});

test('any other entry shaped like a sheet of tiles is read as one', () => {
  const manifest = parseManifest({
    ...real(),
    portraits: { tile: 128, sheet: 'portraits/portraits.png', names: { tamsin: [0, 0], hero: [2, 2] } },
    crops: { tile: 32, sheet: 'crops/crops.png', names: { wheat: [[0, 0], [1, 0], [2, 0], [3, 0]], berry_bush: [[0, 3], [1, 3]] } },
    // Written like the blocks entry.
    banners: { tile: 16, atlas: 'banners/banners.png', tiles: { red: [[0, 0]] } },
    // Not a sheet of tiles: left out, and not a failure.
    credits: { artist: 'a model' },
    build: 7,
  });
  expect(manifest.sheets).toEqual({
    // A single cell becomes a list of one, so every sheet reads the same way.
    portraits: { tile: 128, sheet: 'portraits/portraits.png', names: { tamsin: [[0, 0]], hero: [[2, 2]] } },
    crops: { tile: 32, sheet: 'crops/crops.png', names: { wheat: [[0, 0], [1, 0], [2, 0], [3, 0]], berry_bush: [[0, 3], [1, 3]] } },
    banners: { tile: 16, sheet: 'banners/banners.png', names: { red: [[0, 0]] } },
  });
  expect(Object.keys(manifest).sort()).toEqual(['blocks', 'icons', 'images', 'sheets', 'sprites', 'version']);
});

test('an entry that maps names to PNG files is read as a list of images', () => {
  const manifest = parseManifest({ ...real(), ui: { panel: 'ui/panel.png', button: 'ui/button.png' }, notes: { author: 'a model' }, empty: {} });
  expect(manifest.images).toEqual({ ui: { panel: 'ui/panel.png', button: 'ui/button.png' } });
  expect(broken((m) => { m.ui = { panel: '../panel.png' }; })).toContain('ui.panel is "../panel.png". It must be the path of a PNG file inside public/assets/');
});

test('the interface kit is read but never listed for loading', () => {
  const uikit = { lazy: true, images: { panel: 'ui/kit/panel.png' }, tabs: { tile: 96, sheet: 'ui/kit/tabs.png', names: { bag: [0, 0], gear: [1, 0] } }, tabs2: { tile: 96, sheet: 'ui/kit/icons2.png', names: { pin: [2, 2] } } };
  const manifest = parseManifest({ ...real(), uikit });
  expect(manifest.uikit).toEqual({
    images: { panel: 'ui/kit/panel.png' },
    tabs: { tile: 96, sheet: 'ui/kit/tabs.png', names: { bag: [[0, 0]], gear: [[1, 0]] } },
    sheets: { tabs2: { tile: 96, sheet: 'ui/kit/icons2.png', names: { pin: [[2, 2]] } } },
  });
  // Neither the images nor the sheet are among what the loader fetches before the first frame.
  expect(manifest.images).toEqual({});
  expect(manifest.sheets).toEqual({});
  expect(broken((m) => { m.uikit = { images: { panel: 'panel.jpg' } }; })).toContain('uikit.images.panel is "panel.jpg"');
});

test('more icon sheets can hang under the icons entry', () => {
  const manifest = parseManifest({ ...real(), icons: { ...real().icons, sheets: { story: { tile: 32, sheet: 'icons/icons-2.png', names: { plank: [0, 0], heart: [3, 3] } } } } });
  expect(manifest.icons?.sheets).toEqual({ story: { tile: 32, sheet: 'icons/icons-2.png', names: { plank: [[0, 0]], heart: [[3, 3]] } } });
  expect(manifest.icons?.names.lantern).toEqual(real().icons.names.lantern);
  expect(broken((m) => { m.icons.sheets = { story: { tile: 32, names: {} } }; })).toContain('icons.sheets.story.sheet is missing');
  expect(broken((m) => { m.icons.sheets = 'icons-2.png'; })).toContain('icons.sheets is "icons-2.png". It must be an object');
});

test('a broken entry in another sheet fails with its name', () => {
  expect(broken((m) => { m.portraits = { tile: 128, sheet: 'portraits/portraits.png', names: { tamsin: [0] } }; })).toContain('portraits.names.tamsin is [0]. It must be a cell, [column, row].');
  expect(broken((m) => { m.portraits = { tile: 128, sheet: 'portraits/portraits.png', names: { tamsin: 'top left' } }; })).toContain('portraits.names.tamsin is "top left". It must be a cell, [column, row], or a list of cells');
  expect(broken((m) => { m.crops = { tile: 32, sheet: 'crops/crops.png', names: { wheat: [[0, 0], [1]] } }; })).toContain('crops.names.wheat[1] is [1]. It must be a cell');
  expect(broken((m) => { m.crops = { tile: 0, sheet: 'crops/crops.png', names: {} }; })).toContain('crops.tile is 0');
  expect(broken((m) => { m.crops = { tile: 32, sheet: 'crops.jpg', names: {} }; })).toContain('crops.sheet is "crops.jpg". It must be the path of a PNG file');
});

test('a manifest with sprites only is allowed', () => {
  const manifest = parseManifest({ version: 1, sprites: {} });
  expect(manifest).toEqual({ version: 1, sprites: {}, sheets: {}, images: {} });
});

test('each missing or wrong entry fails with a message that names it', () => {
  expect(broken((m) => { delete m.sprites.hero.sheet; })).toBe('manifest.json: sprites.hero.sheet is missing. It must be the path of a PNG file inside public/assets/.');
  expect(broken((m) => { delete m.sprites; })).toBe('manifest.json: sprites is missing. It must be an object.');
  expect(broken((m) => { m.version = 2; })).toBe('manifest.json: version is 2. It must be 1, the only version this loader reads.');
  expect(broken((m) => { delete m.sprites.pet.animations.walk.rows.front; })).toBe('manifest.json: sprites.pet.animations.walk.rows.front is missing. It must be a whole number of 0 or more.');
  expect(broken((m) => { m.sprites.pet.animations.walk.rows.left = 5; })).toContain('sprites.pet.animations.walk.rows.left');
  expect(broken((m) => { m.sprites.critter.animations.idle.frames = 0; })).toContain('sprites.critter.animations.idle.frames is 0');
  expect(broken((m) => { m.sprites.critter.animations.idle.fps = -4; })).toContain('sprites.critter.animations.idle.fps is -4');
  expect(broken((m) => { m.sprites.critter.animations = {}; })).toContain('sprites.critter.animations is {}. It must be a list with at least one animation');
  expect(broken((m) => { m.sprites['villager-a'].frame = [128]; })).toContain('sprites.villager-a.frame is [128]. It must be a frame size in pixels');
  expect(broken((m) => { m.sprites['villager-a'].anchor = [64, 200]; })).toContain('sprites.villager-a.anchor is [64,200]. It must be a pixel inside the 128 by 128 frame');
  expect(broken((m) => { m.sprites['villager-b'].worldHeight = '2'; })).toContain('sprites.villager-b.worldHeight is "2"');
  expect(broken((m) => { m.sprites.hero.sheet = '../secrets.png'; })).toContain('sprites.hero.sheet is "../secrets.png"');
  expect(broken((m) => { delete m.blocks.atlas; })).toContain('blocks.atlas is missing');
  expect(broken((m) => { m.blocks.tiles.dirt = []; })).toContain('blocks.tiles.dirt is []. It must be a list of at least one cell');
  expect(broken((m) => { m.blocks.tiles.stone[1] = [5]; })).toContain('blocks.tiles.stone[1] is [5]. It must be a cell');
  expect(broken((m) => { m.icons.names.coin = 'coin.png'; })).toContain('icons.names.coin is "coin.png"');
  expect(broken((m) => { delete m.icons.tile; })).toContain('icons.tile is missing');
});

test('a file that is not an object fails', () => {
  expect(() => parseManifest([])).toThrow('manifest.json: the file is []. It must be an object.');
  expect(() => parseManifest(null)).toThrow(AssetError);
});

test('a sheet too small for an animation fails with the sprite, the animation and the sizes', () => {
  const hero = parseManifest(real()).sprites.hero;
  expect(() => checkSheetSize('hero', hero, 768, 896)).not.toThrow();
  expect(() => checkSheetSize('hero', hero, 512, 896)).toThrow(
    'sprites.hero.animations.walk puts its front view on row 3 with 6 frames of 128 by 128. That needs a sheet of at least 768 by 512, and sprites/hero.png is 512 by 896.',
  );
  expect(() => checkSheetSize('hero', hero, 768, 768)).toThrow(/sprites\.hero\.animations\.tool puts its front view on row 6/);
});

test('a tile or an icon outside its image fails with its name', () => {
  expect(() => checkCell('icons.names.lantern', 'icons/icons.png', [3, 3], 32, 128, 128)).not.toThrow();
  expect(() => checkCell('icons.names.lantern', 'icons/icons.png', [4, 3], 32, 128, 128)).toThrow(
    'manifest.json: icons.names.lantern is the cell [4, 3] of 32 pixel tiles, which is outside icons/icons.png (128 by 128).',
  );
});
