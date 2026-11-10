// The asset loader. It reads public/assets/manifest.json, checks it, loads every file it lists and
// hands out typed results. Nothing else in the game guesses a file name.
//
// Sprite sheets do not become one texture each. They are packed into one atlas, an array texture
// with one layer per page, so every character in the world can be drawn in one call.
import * as THREE from 'three';
import {
  AssetError, checkCell, checkSheetSize, parseManifest,
  type AnimationEntry, type Manifest, type SpriteEntry,
} from './manifest.ts';
import { packAtlas } from './pack.ts';
import {
  PLACEHOLDER_ANCHOR, PLACEHOLDER_FRAME, drawPlaceholder, measureBody, recolor,
  type ColorMap, type Pixels,
} from './pixels.ts';

/** How files are read. The page uses `fetch`. A test or a build script passes its own. */
export interface AssetIO {
  json(url: string): Promise<unknown>;
  image(url: string): Promise<Pixels>;
}

export interface LoadProgress {
  /** Files finished so far, the manifest included. */
  loaded: number;
  total: number;
  /** The file that just finished, relative to the assets folder. */
  file: string;
}

export interface AssetsOptions {
  /** The folder that holds manifest.json. Default: `assets/` beside the page. */
  baseUrl?: string;
  onProgress?: (progress: LoadProgress) => void;
  /** The longest side of a sprite atlas page. Default 4096, which every WebGL 2 device this game aims at can hold. */
  maxAtlasSize?: number;
  /**
   * How a sprite is drawn when it is smaller on screen than its pixels. `smooth` (the default) blends
   * with mipmaps, so a far crowd does not sparkle. `nearest` picks single pixels at every size.
   * Either way a sprite drawn larger than its pixels shows them sharp.
   */
  spriteFilter?: 'smooth' | 'nearest';
  io?: AssetIO;
}

export interface SpriteAsset {
  readonly name: string;
  /** The manifest entry the art came from. A color variant names the sprite it was copied from. */
  readonly base: string;
  /** One frame's width and height in pixels. */
  readonly frame: readonly [number, number];
  /** The pixel in a frame where the feet touch the ground. */
  readonly anchor: readonly [number, number];
  /** How tall one frame is in blocks. */
  readonly worldHeight: number;
  readonly animations: Readonly<Record<string, AnimationEntry>>;
  /** The whole sheet. */
  readonly pixels: Pixels;
  /** The solid part of the first standing frame, in frame pixels: left, top, right, bottom. The shadow is sized from it. */
  readonly body: readonly [number, number, number, number];
  /** True for the stand-in drawn when a sprite is missing. */
  readonly placeholder: boolean;
}

export interface AtlasPlace {
  page: number;
  /** The sheet's top left pixel on its page. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Every sprite sheet on one array texture. Row 0 of the data is the top of the image, so v grows downward. */
export interface SpriteAtlas {
  readonly texture: THREE.DataArrayTexture;
  /** The size of one page in pixels. */
  readonly width: number;
  readonly height: number;
  readonly pages: number;
  place(spriteName: string): AtlasPlace;
}

export interface TileCell {
  column: number;
  row: number;
  /** The cell's top left pixel. */
  x: number;
  y: number;
  /** Left, top, right, bottom as texture coordinates. The texture is not flipped, so v 0 is the top row. */
  uv: readonly [number, number, number, number];
}

/** One image of square tiles: the block atlas, the icons, or any other sheet the manifest lists. */
export interface TileSheetAsset {
  /** The entry's name in the manifest: `blocks`, `icons`, `portraits`. */
  readonly name: string;
  readonly texture: THREE.DataTexture;
  readonly pixels: Pixels;
  readonly url: string;
  /** The side of one tile in pixels. */
  readonly tile: number;
  readonly names: readonly string[];
  /** Every cell of a tile. More than one means variants or stages, and the game picks one. */
  cells(tileName: string): readonly TileCell[];
}

export type BlockAtlasAsset = TileSheetAsset;

export interface IconAsset extends TileCell {
  readonly name: string;
  readonly texture: THREE.DataTexture;
  readonly url: string;
  /** The side of the icon in pixels. */
  readonly tile: number;
}

/** One whole image the manifest lists by name, such as a panel of the interface. */
export interface ImageAsset {
  /** The entry it is listed under, such as `ui`. */
  readonly group: string;
  readonly name: string;
  readonly texture: THREE.DataTexture;
  readonly pixels: Pixels;
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

export interface Assets {
  readonly manifest: Manifest;
  /** Every sprite that can be drawn: the manifest's, then the variants made so far. */
  spriteNames(): string[];
  hasSprite(name: string): boolean;
  /** Throws an `AssetError` that names the sprite when the manifest does not have it. */
  sprite(name: string): SpriteAsset;
  /**
   * A recolored copy of a sprite: every pixel of an exact color in the map takes its partner. Asking
   * twice for the same colors gives the same variant. Make variants before the sprite system starts,
   * since each new one repacks the atlas. `as` names the variant. Without it the name is `base~1`, `base~2`.
   */
  variant(name: string, colorMap: ColorMap, as?: string): SpriteAsset;
  /** The stand-in for a sprite that is missing. It is always in the atlas. */
  placeholder(): SpriteAsset;
  /** Packs every sheet the first time it is asked, and again after a new variant. Keep no reference across a `variant` call. */
  spriteAtlas(): SpriteAtlas;
  blockAtlas(): BlockAtlasAsset;
  icon(name: string): IconAsset;
  iconNames(): string[];
  /** Any sheet of tiles by its name in the manifest: `blocks`, `icons`, and whatever else it lists, such as `portraits` or `crops`. */
  sheet(name: string): TileSheetAsset;
  sheetNames(): string[];
  /** A whole image from an entry that maps names to files, such as `image('ui', 'panel')`. */
  image(group: string, name: string): ImageAsset;
  /** The names in one such entry, or the entries themselves when no group is given. */
  imageNames(group?: string): string[];
  dispose(): void;
}

export const PLACEHOLDER_NAME = '(placeholder)';

/** What one tile of a well-known sheet is called in a message. */
const KIND: Record<string, string> = { blocks: 'block tile', icons: 'icon' };

/** Sheets start on multiples of this, so the first five mipmap levels of a frame never take in a neighbor. */
const ATLAS_ALIGN = 32;

// ---------------------------------------------------------------- reading files in the page

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`the server answered ${response.status}`);
  return response;
}

/** The page's way of reading files. Colors come back exactly as the PNG stores them. */
export const browserIO: AssetIO = {
  async json(url) {
    return (await fetchOk(url)).json();
  },
  async image(url) {
    const blob = await (await fetchOk(url)).blob();
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    } catch {
      throw new Error('it is not an image the browser can read');
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('the browser gave no 2D canvas to read it with');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return { width: image.width, height: image.height, data: image.data };
  },
};

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// ---------------------------------------------------------------- building the typed results

function dataTexture(pixels: Pixels): THREE.DataTexture {
  const texture = new THREE.DataTexture(pixels.data, pixels.width, pixels.height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function tileCell(column: number, row: number, tile: number, width: number, height: number): TileCell {
  const x = column * tile, y = row * tile;
  return { column, row, x, y, uv: [x / width, y / height, (x + tile) / width, (y + tile) / height] };
}

function spriteAsset(name: string, base: string, entry: Pick<SpriteEntry, 'frame' | 'anchor' | 'worldHeight' | 'animations'>, pixels: Pixels, placeholder = false): SpriteAsset {
  const standing = entry.animations.idle ?? Object.values(entry.animations)[0];
  const body = measureBody(pixels, 0, standing.rows.front * entry.frame[1], entry.frame[0], entry.frame[1]);
  return { name, base, frame: entry.frame, anchor: entry.anchor, worldHeight: entry.worldHeight, animations: entry.animations, pixels, body, placeholder };
}

function buildAtlas(sprites: Iterable<SpriteAsset>, maxSize: number, filter: 'smooth' | 'nearest'): SpriteAtlas {
  const list = [...sprites];
  const packed = packAtlas(list.map((s) => ({ id: s.name, width: s.pixels.width, height: s.pixels.height })), { maxSize, align: ATLAS_ALIGN });
  const { width, height, pages } = packed;
  const data = new Uint8Array(width * height * 4 * pages);
  const places = new Map<string, AtlasPlace>();
  packed.placements.forEach((spot, i) => {
    const source = list[i].pixels;
    for (let y = 0; y < source.height; y++) {
      const from = y * source.width * 4;
      data.set(source.data.subarray(from, from + source.width * 4), ((spot.page * height + spot.y + y) * width + spot.x) * 4);
    }
    places.set(spot.id, { page: spot.page, x: spot.x, y: spot.y, width: spot.width, height: spot.height });
  });
  // A clear pixel must carry no color: the mipmaps average color times alpha, and the shader divides the alpha back out.
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = 0;
  }

  const texture = new THREE.DataArrayTexture(data, width, height, pages);
  texture.format = THREE.RGBAFormat;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = filter === 'smooth' ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
  texture.generateMipmaps = filter === 'smooth';
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return {
    texture, width, height, pages,
    place(spriteName) {
      const place = places.get(spriteName);
      if (!place) throw new AssetError(`The sprite atlas has no sheet named "${spriteName}".`);
      return place;
    },
  };
}

function listNames(names: string[]): string {
  return names.length ? names.join(', ') : 'none';
}

// ---------------------------------------------------------------- loading

/** Loads the manifest and every file it lists. It rejects with an `AssetError` that names what is missing or wrong. */
export async function loadAssets(options: AssetsOptions = {}): Promise<Assets> {
  const io = options.io ?? browserIO;
  const base = options.baseUrl ?? new URL('assets/', document.baseURI).href;
  const baseUrl = base.endsWith('/') ? base : base + '/';
  const maxAtlasSize = options.maxAtlasSize ?? 4096;
  const spriteFilter = options.spriteFilter ?? 'smooth';

  let json: unknown;
  try {
    json = await io.json(baseUrl + 'manifest.json');
  } catch (error) {
    throw new AssetError(`The asset manifest did not load from ${baseUrl}manifest.json: ${reason(error)}.`);
  }
  const manifest = parseManifest(json);

  // Each file once, with the entry that lists it, so a missing file can say who needs it.
  const wanted = new Map<string, string>();
  for (const [name, entry] of Object.entries(manifest.sprites)) if (!wanted.has(entry.sheet)) wanted.set(entry.sheet, `the sheet of sprite "${name}"`);
  if (manifest.blocks && !wanted.has(manifest.blocks.atlas)) wanted.set(manifest.blocks.atlas, 'the block atlas');
  if (manifest.icons && !wanted.has(manifest.icons.sheet)) wanted.set(manifest.icons.sheet, 'the icon sheet');
  for (const [name, entry] of Object.entries(manifest.icons?.sheets ?? {})) if (!wanted.has(entry.sheet)) wanted.set(entry.sheet, `the "${name}" icon sheet`);
  for (const [name, entry] of Object.entries(manifest.sheets)) if (!wanted.has(entry.sheet)) wanted.set(entry.sheet, `the "${name}" sheet`);
  for (const [group, listed] of Object.entries(manifest.images)) {
    for (const [name, file] of Object.entries(listed)) if (!wanted.has(file)) wanted.set(file, `the "${name}" image of "${group}"`);
  }

  const total = wanted.size + 1;
  let loaded = 1;
  options.onProgress?.({ loaded, total, file: 'manifest.json' });

  const files = new Map<string, Pixels>();
  const problems: string[] = [];
  await Promise.all([...wanted].map(async ([file, owner]) => {
    try {
      files.set(file, await io.image(baseUrl + file));
    } catch (error) {
      problems.push(`${file}, ${owner} (${reason(error)})`);
    }
    options.onProgress?.({ loaded: ++loaded, total, file });
  }));
  if (problems.length) {
    problems.sort();
    throw new AssetError(`${problems.length === 1 ? 'An asset file' : `${problems.length} asset files`} listed in manifest.json did not load: ${problems.join('; ')}.`);
  }

  const sprites = new Map<string, SpriteAsset>();
  for (const [name, entry] of Object.entries(manifest.sprites)) {
    const pixels = files.get(entry.sheet) as Pixels;
    checkSheetSize(name, entry, pixels.width, pixels.height);
    sprites.set(name, spriteAsset(name, name, entry, pixels));
  }
  const stand = spriteAsset(PLACEHOLDER_NAME, PLACEHOLDER_NAME, {
    frame: [PLACEHOLDER_FRAME[0], PLACEHOLDER_FRAME[1]],
    anchor: [PLACEHOLDER_ANCHOR[0], PLACEHOLDER_ANCHOR[1]],
    worldHeight: 2,
    animations: { idle: { frames: 1, fps: 1, rows: { front: 0 } } },
  }, drawPlaceholder(), true);

  // Every sheet of tiles: the blocks, the icons, and the entries the contract does not name.
  const sheets = new Map<string, TileSheetAsset>();
  function tileSheet(name: string, file: string, tile: number, path: string, listed: Record<string, [number, number][]>): TileSheetAsset {
    const pixels = files.get(file) as Pixels;
    const cells = new Map<string, TileCell[]>();
    for (const [tileName, list] of Object.entries(listed)) {
      list.forEach((c, i) => checkCell(list.length > 1 ? `${path}.${tileName}[${i}]` : `${path}.${tileName}`, file, c, tile, pixels.width, pixels.height));
      cells.set(tileName, list.map(([column, row]) => tileCell(column, row, tile, pixels.width, pixels.height)));
    }
    const sheet: TileSheetAsset = {
      name, texture: dataTexture(pixels), pixels, url: baseUrl + file, tile, names: [...cells.keys()],
      cells(tileName) {
        const found = cells.get(tileName);
        if (!found) throw new AssetError(`manifest.json has no ${KIND[name] ?? `"${name}" tile`} named "${tileName}". It has: ${listNames([...cells.keys()])}.`);
        return found;
      },
    };
    sheets.set(name, sheet);
    return sheet;
  }
  if (manifest.blocks) tileSheet('blocks', manifest.blocks.atlas, manifest.blocks.tile, 'blocks.tiles', manifest.blocks.tiles);
  if (manifest.icons) {
    const each = Object.fromEntries(Object.entries(manifest.icons.names).map(([name, c]) => [name, [c]]));
    tileSheet('icons', manifest.icons.sheet, manifest.icons.tile, 'icons.names', each);
  }
  for (const [name, entry] of Object.entries(manifest.sheets)) tileSheet(name, entry.sheet, entry.tile, `${name}.names`, entry.names);

  // An icon is found by name on whichever icon sheet has it. The first sheet wins a name that is on two.
  const icons = new Map<string, IconAsset>();
  const iconSheets: TileSheetAsset[] = sheets.has('icons') ? [sheets.get('icons') as TileSheetAsset] : [];
  for (const [name, entry] of Object.entries(manifest.icons?.sheets ?? {})) {
    iconSheets.push(tileSheet(`icons.${name}`, entry.sheet, entry.tile, `icons.sheets.${name}.names`, entry.names));
  }
  for (const from of iconSheets) {
    for (const name of from.names) if (!icons.has(name)) icons.set(name, { name, texture: from.texture, url: from.url, tile: from.tile, ...from.cells(name)[0] });
  }

  const images = new Map<string, Map<string, ImageAsset>>();
  for (const [group, listed] of Object.entries(manifest.images)) {
    const list = new Map<string, ImageAsset>();
    for (const [name, file] of Object.entries(listed)) {
      const pixels = files.get(file) as Pixels;
      list.set(name, { group, name, texture: dataTexture(pixels), pixels, url: baseUrl + file, width: pixels.width, height: pixels.height });
    }
    images.set(group, list);
  }

  function sheet(name: string): TileSheetAsset {
    const found = sheets.get(name);
    if (!found) throw new AssetError(`manifest.json has no "${name}" entry. Its sheets of tiles are: ${listNames([...sheets.keys()])}.`);
    return found;
  }

  const variants = new Map<string, SpriteAsset>();
  const variantCount = new Map<string, number>();
  let atlas: SpriteAtlas | null = null;

  function sprite(name: string): SpriteAsset {
    const found = sprites.get(name);
    if (!found) throw new AssetError(`manifest.json has no sprite named "${name}". It has: ${listNames([...sprites.keys()])}.`);
    return found;
  }

  return {
    manifest,
    spriteNames: () => [...sprites.keys()],
    hasSprite: (name) => sprites.has(name),
    sprite,
    placeholder: () => stand,

    variant(name, colorMap, as) {
      const from = sprite(name);
      const key = name + '|' + Object.entries(colorMap).map(([a, b]) => `${a.toLowerCase()}>${b.toLowerCase()}`).sort().join(',');
      const made = variants.get(key);
      if (made && (as === undefined || as === made.name)) return made;
      const { pixels, swapped } = recolor(from.pixels, colorMap);
      if (swapped === 0) {
        throw new AssetError(`assets.variant("${name}"): none of the colors ${listNames(Object.keys(colorMap))} are in its sheet. A variant swaps exact colors.`);
      }
      let variantName = as;
      if (variantName === undefined) {
        let n = variantCount.get(name) ?? 0;
        do variantName = `${name}~${++n}`; while (sprites.has(variantName));
        variantCount.set(name, n);
      } else if (sprites.has(variantName)) {
        throw new AssetError(`assets.variant("${name}"): there is already a sprite named "${variantName}".`);
      }
      const asset: SpriteAsset = { ...from, name: variantName, base: from.base, pixels };
      sprites.set(variantName, asset);
      variants.set(key, asset);
      if (atlas) {
        atlas.texture.dispose();
        atlas = null;
      }
      return asset;
    },

    spriteAtlas() {
      atlas ??= buildAtlas([...sprites.values(), stand], maxAtlasSize, spriteFilter);
      return atlas;
    },

    blockAtlas() {
      if (!sheets.has('blocks')) throw new AssetError('manifest.json has no "blocks" entry, so there is no block atlas.');
      return sheet('blocks');
    },

    icon(name) {
      const found = icons.get(name);
      if (!found) throw new AssetError(`manifest.json has no icon named "${name}". It has: ${listNames([...icons.keys()])}.`);
      return found;
    },
    iconNames: () => [...icons.keys()],
    sheet,
    sheetNames: () => [...sheets.keys()],

    image(group, name) {
      const list = images.get(group);
      if (!list) throw new AssetError(`manifest.json has no "${group}" entry that lists images. It has: ${listNames([...images.keys()])}.`);
      const found = list.get(name);
      if (!found) throw new AssetError(`manifest.json has no image named "${name}" in "${group}". It has: ${listNames([...list.keys()])}.`);
      return found;
    },
    imageNames: (group) => (group === undefined ? [...images.keys()] : [...(images.get(group)?.keys() ?? [])]),

    dispose() {
      atlas?.texture.dispose();
      atlas = null;
      for (const each of sheets.values()) each.texture.dispose();
      for (const list of images.values()) for (const each of list.values()) each.texture.dispose();
    },
  };
}
