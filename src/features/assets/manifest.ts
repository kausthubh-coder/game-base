// The shape of public/assets/manifest.json (see docs/assets.md) and the check that a file has it.
// No Three.js and no page here: plain data in, plain data out, so a test or a build script can use it.

export type SpriteDirection = 'front' | 'back' | 'side';

export interface AnimationEntry {
  frames: number;
  fps: number;
  /** The sheet row for each direction. An animation drawn from one direction lists only `front`. */
  rows: { front: number; back?: number; side?: number };
}

export interface SpriteEntry {
  sheet: string;
  /** The width and height of one frame in pixels. */
  frame: [number, number];
  /** The pixel in a frame where the feet touch the ground. */
  anchor: [number, number];
  /** How tall one frame is in blocks. */
  worldHeight: number;
  animations: Record<string, AnimationEntry>;
}

export interface BlocksEntry {
  tile: number;
  atlas: string;
  /** A tile name maps to its cells, `[column, row]`. More than one cell means variants. */
  tiles: Record<string, [number, number][]>;
}

export interface IconsEntry {
  tile: number;
  sheet: string;
  names: Record<string, [number, number]>;
  /** More icon sheets, added when the first one filled up. An icon is found by its name whichever sheet it is on. */
  sheets?: Record<string, TileSheetEntry>;
}

/**
 * Any other sheet of square tiles, such as `portraits` or `crops`. In the file a name maps to one
 * cell or to a list of cells. Here it is always a list.
 */
export interface TileSheetEntry {
  tile: number;
  sheet: string;
  names: Record<string, [number, number][]>;
}

export interface Manifest {
  version: 1;
  sprites: Record<string, SpriteEntry>;
  blocks?: BlocksEntry;
  icons?: IconsEntry;
  /** Every other entry that is a sheet of tiles, by its name in the file. */
  sheets: Record<string, TileSheetEntry>;
  /** Every other entry that is a list of whole images, such as `ui`: a name maps to a file. An entry of any other shape is left out. */
  images: Record<string, Record<string, string>>;
  /**
   * The interface's painted kit, `uikit` in the file. It is lazy: the loader never fetches it, so it costs the first
   * frame nothing. The page asks for each file as CSS draws it. Paths are relative to the manifest's folder.
   */
  uikit?: UiKitEntry;
}

export interface UiKitEntry {
  /** Whole images by name: `panel`, `slot`, `minimap-ring` … */
  images: Record<string, string>;
  /** A sheet of square line icons by name, or undefined. */
  tabs?: TileSheetEntry;
  /** More sheets of icons: every other entry shaped like a sheet of tiles, such as `tabs2`. */
  sheets: Record<string, TileSheetEntry>;
}

/** A problem with the manifest or a file it lists. The message names the entry or the file. */
export class AssetError extends Error {
  override name = 'AssetError';
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isWhole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

function describe(value: unknown): string {
  if (value === undefined) return 'missing';
  const text = JSON.stringify(value);
  return text.length > 40 ? text.slice(0, 37) + '...' : text;
}

function fail(path: string, expected: string, value: unknown): never {
  throw new AssetError(`manifest.json: ${path} is ${describe(value)}. It must be ${expected}.`);
}

function object(value: unknown, path: string): Json {
  return isObject(value) ? value : fail(path, 'an object', value);
}

function wholeAtLeast(value: unknown, least: number, path: string): number {
  return isWhole(value) && value >= least ? value : fail(path, `a whole number of ${least} or more`, value);
}

function positive(value: unknown, path: string): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fail(path, 'a number above 0', value);
}

function filePath(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/\.png$/i.test(value) || value.startsWith('/') || value.includes('..')) {
    return fail(path, 'the path of a PNG file inside public/assets/', value);
  }
  return value;
}

function pair(value: unknown, path: string, expected: string, ok: (n: unknown) => boolean): [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !ok(value[0]) || !ok(value[1])) return fail(path, expected, value);
  return [value[0] as number, value[1] as number];
}

const cell = (value: unknown, path: string): [number, number] =>
  pair(value, path, 'a cell, [column, row]', (n) => isWhole(n) && n >= 0);

function animation(value: unknown, path: string): AnimationEntry {
  const entry = object(value, path);
  const rows = object(entry.rows, `${path}.rows`);
  const result: AnimationEntry = {
    frames: wholeAtLeast(entry.frames, 1, `${path}.frames`),
    fps: positive(entry.fps, `${path}.fps`),
    rows: { front: wholeAtLeast(rows.front, 0, `${path}.rows.front`) },
  };
  if (rows.back !== undefined) result.rows.back = wholeAtLeast(rows.back, 0, `${path}.rows.back`);
  if (rows.side !== undefined) result.rows.side = wholeAtLeast(rows.side, 0, `${path}.rows.side`);
  for (const key of Object.keys(rows)) {
    if (key !== 'front' && key !== 'back' && key !== 'side') fail(`${path}.rows.${key}`, 'one of front, back or side', key);
  }
  return result;
}

function sprite(value: unknown, path: string): SpriteEntry {
  const entry = object(value, path);
  const frame = pair(entry.frame, `${path}.frame`, 'a frame size in pixels, [width, height]', (n) => isWhole(n) && n >= 1);
  const anchor = pair(entry.anchor, `${path}.anchor`, 'a pixel inside the frame, [x, y]', (n) => typeof n === 'number' && Number.isFinite(n));
  if (anchor[0] < 0 || anchor[0] > frame[0] || anchor[1] < 0 || anchor[1] > frame[1]) {
    fail(`${path}.anchor`, `a pixel inside the ${frame[0]} by ${frame[1]} frame`, anchor);
  }
  const listed = object(entry.animations, `${path}.animations`);
  const names = Object.keys(listed);
  if (names.length === 0) fail(`${path}.animations`, 'a list with at least one animation', listed);
  const animations: Record<string, AnimationEntry> = {};
  for (const name of names) animations[name] = animation(listed[name], `${path}.animations.${name}`);
  return {
    sheet: filePath(entry.sheet, `${path}.sheet`),
    frame,
    anchor,
    worldHeight: positive(entry.worldHeight, `${path}.worldHeight`),
    animations,
  };
}

function blocks(value: unknown): BlocksEntry {
  const entry = object(value, 'blocks');
  const listed = object(entry.tiles, 'blocks.tiles');
  const tiles: Record<string, [number, number][]> = {};
  for (const name of Object.keys(listed)) {
    const cells = listed[name];
    if (!Array.isArray(cells) || cells.length === 0) fail(`blocks.tiles.${name}`, 'a list of at least one cell, [column, row]', cells);
    tiles[name] = (cells as unknown[]).map((c, i) => cell(c, `blocks.tiles.${name}[${i}]`));
  }
  return { tile: wholeAtLeast(entry.tile, 1, 'blocks.tile'), atlas: filePath(entry.atlas, 'blocks.atlas'), tiles };
}

function icons(value: unknown): IconsEntry {
  const entry = object(value, 'icons');
  const listed = object(entry.names, 'icons.names');
  const names: Record<string, [number, number]> = {};
  for (const name of Object.keys(listed)) names[name] = cell(listed[name], `icons.names.${name}`);
  const result: IconsEntry = { tile: wholeAtLeast(entry.tile, 1, 'icons.tile'), sheet: filePath(entry.sheet, 'icons.sheet'), names };
  if (entry.sheets !== undefined) {
    const more = object(entry.sheets, 'icons.sheets');
    result.sheets = {};
    for (const name of Object.keys(more)) result.sheets[name] = tileSheet(object(more[name], `icons.sheets.${name}`), `icons.sheets.${name}`);
  }
  return result;
}

/** True for an entry shaped like a sheet of tiles: a tile size, one image and a list of names. */
function looksLikeTileSheet(value: unknown): value is Json {
  return isObject(value) && 'tile' in value && ('sheet' in value || 'atlas' in value) && (isObject(value.names) || isObject(value.tiles));
}

/** True for an entry that lists whole images: every value is the path of a PNG. */
function looksLikeImages(value: unknown): value is Record<string, string> {
  if (!isObject(value)) return false;
  const files = Object.values(value);
  return files.length > 0 && files.every((file) => typeof file === 'string' && /\.png$/i.test(file));
}

function tileSheet(value: Json, path: string): TileSheetEntry {
  const key = isObject(value.tiles) && !isObject(value.names) ? 'tiles' : 'names';
  const listed = object(value[key], `${path}.${key}`);
  const names: Record<string, [number, number][]> = {};
  for (const name of Object.keys(listed)) {
    const cells = listed[name];
    // A list that starts with a number is meant as one cell, and is checked as one.
    const one = Array.isArray(cells) && typeof cells[0] === 'number';
    if (one) names[name] = [cell(cells, `${path}.${key}.${name}`)];
    else if (Array.isArray(cells) && cells.length > 0) names[name] = (cells as unknown[]).map((c, i) => cell(c, `${path}.${key}.${name}[${i}]`));
    else fail(`${path}.${key}.${name}`, 'a cell, [column, row], or a list of cells', cells);
  }
  const file = 'atlas' in value && !('sheet' in value) ? 'atlas' : 'sheet';
  return { tile: wholeAtLeast(value.tile, 1, `${path}.tile`), sheet: filePath(value[file], `${path}.${file}`), names };
}

function uiKit(value: Json): UiKitEntry {
  const listed = object(value.images, 'uikit.images');
  const images: Record<string, string> = {};
  for (const name of Object.keys(listed)) images[name] = filePath(listed[name], `uikit.images.${name}`);
  const tabs = value.tabs === undefined ? undefined : tileSheet(object(value.tabs, 'uikit.tabs'), 'uikit.tabs');
  const sheets: Record<string, TileSheetEntry> = {};
  for (const [name, entry] of Object.entries(value)) if (name !== 'tabs' && looksLikeTileSheet(entry)) sheets[name] = tileSheet(entry, `uikit.${name}`);
  return { images, tabs, sheets };
}

/** Checks parsed JSON against the contract and returns it typed. Throws an `AssetError` that names what is wrong. */
export function parseManifest(json: unknown): Manifest {
  const root = object(json, 'the file');
  if (root.version !== 1) fail('version', '1, the only version this loader reads', root.version);
  const listed = object(root.sprites, 'sprites');
  const sprites: Record<string, SpriteEntry> = {};
  for (const name of Object.keys(listed)) sprites[name] = sprite(listed[name], `sprites.${name}`);
  const manifest: Manifest = { version: 1, sprites, sheets: {}, images: {} };
  if (root.blocks !== undefined) manifest.blocks = blocks(root.blocks);
  if (root.icons !== undefined) manifest.icons = icons(root.icons);
  // The asset pipeline adds entries as the game grows. One shaped like a sheet of tiles is read as one,
  // and one that maps names to PNG files as a list of images. Anything else is not this loader's to judge.
  for (const [name, value] of Object.entries(root)) {
    if (name === 'version' || name === 'sprites' || name === 'blocks' || name === 'icons') continue;
    if (name === 'uikit') {
      manifest.uikit = uiKit(object(value, 'uikit'));
      continue;
    }
    if (looksLikeTileSheet(value)) manifest.sheets[name] = tileSheet(value, name);
    else if (looksLikeImages(value)) {
      manifest.images[name] = {};
      for (const [image, file] of Object.entries(value)) manifest.images[name][image] = filePath(file, `${name}.${image}`);
    }
  }
  return manifest;
}

/** The sheet size an animation needs, so a sheet that is too small fails with the animation's name. */
export function checkSheetSize(name: string, entry: SpriteEntry, width: number, height: number): void {
  const [fw, fh] = entry.frame;
  for (const [animationName, anim] of Object.entries(entry.animations)) {
    for (const direction of ['front', 'back', 'side'] as const) {
      const row = anim.rows[direction];
      if (row === undefined) continue;
      const needWidth = anim.frames * fw, needHeight = (row + 1) * fh;
      if (needWidth > width || needHeight > height) {
        throw new AssetError(
          `manifest.json: sprites.${name}.animations.${animationName} puts its ${direction} view on row ${row} with ${anim.frames} frames of ${fw} by ${fh}. ` +
          `That needs a sheet of at least ${needWidth} by ${needHeight}, and ${entry.sheet} is ${width} by ${height}.`,
        );
      }
    }
  }
}

/** Fails with the cell's name when a tile or an icon lies outside its image. */
export function checkCell(path: string, file: string, [column, row]: [number, number], tile: number, width: number, height: number): void {
  if ((column + 1) * tile > width || (row + 1) * tile > height) {
    throw new AssetError(`manifest.json: ${path} is the cell [${column}, ${row}] of ${tile} pixel tiles, which is outside ${file} (${width} by ${height}).`);
  }
}
