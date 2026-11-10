// For tests and build scripts only: reads the real files in public/assets from disk, the way the
// page reads them over HTTP. The game never imports this.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { AssetIO } from './assets.view.ts';

/** The folder the manifest is in, with a slash at the end. */
export const ASSETS_FOLDER = resolve(import.meta.dirname, '../../../public/assets') + '/';

export const diskIO: AssetIO = {
  async json(url) {
    return JSON.parse(readFileSync(url, 'utf8'));
  },
  async image(url) {
    const { data, info } = await sharp(url).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
  },
};

/** The first characters made, whose sheets the tests know pixel by pixel. */
export const FIRST_SPRITES = ['hero', 'villager-a', 'villager-b', 'pet', 'critter'] as const;

/**
 * The real files with the manifest cut down to what the first asset run made: five sprites, the
 * blocks and the icons. The asset pipeline keeps adding characters and sheets, and a test that
 * counts them must not break each time it does.
 */
export const firstSpritesIO: AssetIO = {
  async json(url) {
    const manifest = (await diskIO.json(url)) as { version: number; sprites: Record<string, unknown>; blocks: unknown; icons: { tile: number; sheet: string; names: unknown } };
    return {
      version: manifest.version,
      sprites: Object.fromEntries(FIRST_SPRITES.map((name) => [name, manifest.sprites[name]])),
      blocks: manifest.blocks,
      icons: { tile: manifest.icons.tile, sheet: manifest.icons.sheet, names: manifest.icons.names },
    };
  },
  image: diskIO.image,
};
