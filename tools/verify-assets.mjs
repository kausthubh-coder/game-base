// Checks every asset the game ships, with one command:
//
//   bun tools/verify-assets.mjs            exits 0 when every check passes
//   bun tools/verify-assets.mjs --strict   warnings (a name code uses that the manifest lacks) fail too
//   bun tools/verify-assets.mjs --all      lists the failures of every failing check, not only the first
//
// It prints one PASS or FAIL line per check, a size table, every failure of the first failing check,
// the warnings, and a one-line total. How to read each failure: .agents/skills/verify-assets/SKILL.md.
import fs from 'node:fs';
import { inspectGlb } from './models/inspect.mjs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MB = 1024 * 1024;
export const LIMITS = { png: 1 * MB, folder: 12 * MB };

// A palette that leaves a layer out on purpose, with the reason. Anything else missing is a failure.
export const LAYER_EXEMPT = {
  center: {
    bass: 'one held chord, very soft, by design (header of src/content/palettes/center.ts)',
    perc: 'one held chord, very soft, by design (header of src/content/palettes/center.ts)',
  },
};

// The field names a prop entry in src/content/props.ts may use for its builder and its budget.
export const PROP_KEYS = {
  build: ['build', 'builder', 'make', 'create', 'geometry'],
  budget: ['triangles', 'budget', 'triangleBudget', 'maxTriangles', 'tris', 'maxTris'],
  name: ['name', 'kind', 'id', 'key'],
};

// What a message from tools/sprites/check.mjs means, so the failure reads without opening the script.
const SPRITE_CHECK_HINTS = [
  [/ baseline$/, "a frame's lowest drawn pixel is not on the anchor's y (a crop: not on the bottom row of its cell), so it floats or sinks"],
  [/horizontal anchor/, "a frame's silhouette is off the anchor's x, so it slides sideways when it turns"],
  [/unused cell/, "a cell past the animation's frame count has pixels in it"],
  [/ background$| padding$/, 'drawn pixels touch the edge of a frame or a cell: the drawing is too big for it or was cut'],
  [/alpha must be binary|binary alpha/, 'a pixel is half transparent: the image skipped clean() in tools/sprites/lib.mjs'],
  [/outside locked palette| palette$/, 'a color is not in assets-src/palette.json: the image skipped snap() or was edited after the build'],
  [/ (width|height)$/, 'the image is not the size its config entry gives (columns x frame by rows x frame)'],
  [/opaque (tile|title)/, 'an image that must be solid has a transparent pixel'],
  [/(horizontal|vertical) seam/, "a tile's opposite edges differ, so a line shows where two copies meet"],
  [/banding [\d.]+ exceeds/, 'one row or column of a tile is lighter or darker than the rest, so a field of it shows stripes'],
  [/missing content tile/, 'a tile name in src/content/blocks.ts has no cell in the atlas'],
  [/old file changed|\.png unchanged$/, "the bytes of a sheet from an earlier run changed. Those sheets are frozen by the hashes in assets-src/*baseline*.json"],
  [/changed old|missing old|original (sprite|icon entry) unchanged|missing original/, 'a manifest entry from an earlier run changed or is gone. Entries are only ever added'],
  [/^(AssertionError: )?missing /, 'a story set the game ships (a townsperson, portraits, crops, ui) is not in the manifest'],
  [/Empty generated cell/, 'a cell that should hold a frame or an icon is empty'],
  [/strictly deep-equal/, 'two values that must be equal differ: "actual" is what the manifest or the image has, "expected" is what the config or the baseline says'],
  [/falsy value/, 'an assertion with no message failed. The "at" line below names its place in the script'],
  [/ENOENT/, 'a file the check reads is missing'],
];

const rel = (root, file) => path.relative(root, file).split(path.sep).join('/');
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isWhole = (v, least = 0) => Number.isInteger(v) && v >= least;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const kb = (bytes) => (bytes / 1024).toFixed(1);

/** Every file under a folder, as paths relative to it with forward slashes. */
export function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(rel(base, full));
  }
  return out;
}

/** The width and height in a PNG's header, or null when the bytes are not a PNG. */
export function pngSize(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((b, i) => bytes[i] !== b)) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function pngSizeOf(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(24);
    fs.readSync(fd, head, 0, 24, 0);
    return pngSize(head);
  } finally {
    fs.closeSync(fd);
  }
}

// ------------------------------------------------------------------------------------ 1. manifest

/** The first JSON example in docs/assets.md. The manifest is compared with its sections and keys. */
export function docExample(markdown) {
  const block = /```json\s*\n([\s\S]*?)```/.exec(markdown);
  if (!block) return null;
  try {
    return JSON.parse(block[1]);
  } catch {
    return null;
  }
}

const isCell = (v) => Array.isArray(v) && v.length === 2 && isWhole(v[0]) && isWhole(v[1]);

/**
 * Compares public/assets/manifest.json with docs/assets.md and with the files on disk.
 * Returns the parsed manifest (or null), the failures, the warnings and a one-line summary.
 */
export function checkManifest(root) {
  const failures = [], warnings = [];
  const assets = path.join(root, 'public/assets');
  const result = (manifest, detail) => ({ manifest, failures, warnings, detail });

  let doc = null;
  try {
    doc = docExample(fs.readFileSync(path.join(root, 'docs/assets.md'), 'utf8'));
  } catch { /* reported below */ }
  if (!doc) failures.push('docs/assets.md is missing or has no ```json example that parses, so the manifest has nothing to match.');

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(assets, 'manifest.json'), 'utf8'));
  } catch (error) {
    failures.push(`public/assets/manifest.json cannot be read: ${error.message}`);
    return result(null, 'manifest.json cannot be read');
  }
  if (!isObject(manifest)) {
    failures.push('public/assets/manifest.json is not an object.');
    return result(null, 'manifest.json is not an object');
  }

  const files = new Set(walk(assets));
  const lower = new Map([...files].map((f) => [f.toLowerCase(), f]));
  const used = new Set(['manifest.json']);
  const sizes = new Map();

  /** Checks one path from the manifest and returns the image's size, or null. */
  function image(value, where) {
    if (typeof value !== 'string' || !/\.png$/i.test(value)) {
      failures.push(`${where} is ${JSON.stringify(value)}. It must be the path of a PNG inside public/assets/.`);
      return null;
    }
    if (value.startsWith('/') || value.includes('\\') || value.split('/').includes('..')) {
      failures.push(`${where} is "${value}". Paths are relative to public/assets/, with forward slashes and no "..".`);
      return null;
    }
    if (!files.has(value)) {
      const near = lower.get(value.toLowerCase());
      failures.push(near
        ? `${where} is "${value}" and the file is "${near}". The letter case differs: it loads on this Mac and fails on the server.`
        : `${where} is "${value}". No such file in public/assets/.`);
      return null;
    }
    used.add(value);
    if (!sizes.has(value)) sizes.set(value, pngSizeOf(path.join(assets, value)));
    const size = sizes.get(value);
    if (!size) failures.push(`${where} is "${value}", which is not a PNG file inside (wrong bytes).`);
    return size;
  }

  function requireKeys(entry, example, where) {
    if (!isObject(example)) return;
    for (const key of Object.keys(example)) {
      if (entry[key] === undefined) failures.push(`${where} has no "${key}". docs/assets.md lists it.`);
    }
  }

  function sprite(name, entry, example) {
    const where = `sprites.${name}`;
    if (!isObject(entry)) return failures.push(`${where} is not an object.`);
    requireKeys(entry, example, where);
    const size = entry.sheet === undefined ? null : image(entry.sheet, `${where}.sheet`);
    const frame = entry.frame;
    const frameOk = Array.isArray(frame) && frame.length === 2 && isWhole(frame[0], 1) && isWhole(frame[1], 1);
    if (frame !== undefined && !frameOk) failures.push(`${where}.frame is ${JSON.stringify(frame)}. It must be [width, height] in whole pixels.`);
    const anchor = entry.anchor;
    if (anchor !== undefined) {
      const ok = Array.isArray(anchor) && anchor.length === 2 && anchor.every((n) => typeof n === 'number' && Number.isFinite(n));
      if (!ok) failures.push(`${where}.anchor is ${JSON.stringify(anchor)}. It must be a pixel, [x, y].`);
      else if (frameOk && (anchor[0] < 0 || anchor[0] > frame[0] || anchor[1] < 0 || anchor[1] > frame[1])) {
        failures.push(`${where}.anchor ${JSON.stringify(anchor)} is outside the ${frame[0]} by ${frame[1]} frame.`);
      }
    }
    if (entry.worldHeight !== undefined && !(typeof entry.worldHeight === 'number' && entry.worldHeight > 0)) {
      failures.push(`${where}.worldHeight is ${JSON.stringify(entry.worldHeight)}. It must be a height in blocks above 0.`);
    }
    if (entry.animations === undefined) return;
    if (!isObject(entry.animations) || Object.keys(entry.animations).length === 0) {
      return failures.push(`${where}.animations must list at least one animation.`);
    }
    const animationExample = isObject(example?.animations) ? Object.values(example.animations)[0] : null;
    for (const [animName, anim] of Object.entries(entry.animations)) {
      const at = `${where}.animations.${animName}`;
      if (!isObject(anim)) { failures.push(`${at} is not an object.`); continue; }
      requireKeys(anim, animationExample, at);
      if (anim.frames !== undefined && !isWhole(anim.frames, 1)) failures.push(`${at}.frames is ${JSON.stringify(anim.frames)}. It must be a whole number of 1 or more.`);
      if (anim.fps !== undefined && !(typeof anim.fps === 'number' && anim.fps > 0)) failures.push(`${at}.fps is ${JSON.stringify(anim.fps)}. It must be above 0.`);
      if (anim.rows === undefined) continue;
      if (!isObject(anim.rows)) { failures.push(`${at}.rows is not an object.`); continue; }
      if (anim.rows.front === undefined) failures.push(`${at}.rows has no "front". An animation drawn from one side lists only front.`);
      for (const [direction, row] of Object.entries(anim.rows)) {
        if (!['front', 'back', 'side'].includes(direction)) { failures.push(`${at}.rows.${direction}: the only directions are front, back and side.`); continue; }
        if (!isWhole(row)) { failures.push(`${at}.rows.${direction} is ${JSON.stringify(row)}. It must be a row number, 0 or more.`); continue; }
        if (size && frameOk && isWhole(anim.frames, 1)) {
          const needW = anim.frames * frame[0], needH = (row + 1) * frame[1];
          if (needW > size.width || needH > size.height) {
            failures.push(`${at}: the ${direction} view is row ${row} with ${anim.frames} frames of ${frame[0]} by ${frame[1]}, which needs ${needW} by ${needH}. ${entry.sheet} is ${size.width} by ${size.height}.`);
          }
        }
      }
    }
  }

  /** A section shaped like blocks, icons, portraits or crops: one image cut into square tiles with named cells. */
  function tileSheet(section, entry, example) {
    requireKeys(entry, example, section);
    const imageKey = ['atlas', 'sheet'].find((k) => entry[k] !== undefined);
    const namesKey = ['tiles', 'names'].find((k) => entry[k] !== undefined);
    const size = imageKey ? image(entry[imageKey], `${section}.${imageKey}`) : null;
    const tileOk = isWhole(entry.tile, 1);
    if (entry.tile !== undefined && !tileOk) failures.push(`${section}.tile is ${JSON.stringify(entry.tile)}. It must be a tile size in whole pixels.`);
    if (!namesKey) return 0;
    if (!isObject(entry[namesKey])) { failures.push(`${section}.${namesKey} is not an object.`); return 0; }
    // docs/assets.md shows whether a name holds one cell (icons) or a list of cells (blocks).
    const shown = isObject(example?.[namesKey]) ? Object.values(example[namesKey])[0] : undefined;
    const wantsList = shown === undefined ? null : !isCell(shown);
    let cells = 0;
    for (const [name, value] of Object.entries(entry[namesKey])) {
      const at = `${section}.${namesKey}.${name}`;
      const isList = Array.isArray(value) && value.length > 0 && value.every(isCell);
      if (wantsList === true && !isList) { failures.push(`${at} is ${JSON.stringify(value)}. It must be a list of cells, [[column, row], ...].`); continue; }
      if (wantsList === false && !isCell(value)) { failures.push(`${at} is ${JSON.stringify(value)}. It must be one cell, [column, row].`); continue; }
      if (!isList && !isCell(value)) { failures.push(`${at} is ${JSON.stringify(value)}. It must be a cell, [column, row], or a list of cells.`); continue; }
      for (const [column, row] of isList ? value : [value]) {
        cells++;
        if (size && tileOk && ((column + 1) * entry.tile > size.width || (row + 1) * entry.tile > size.height)) {
          failures.push(`${at}: cell [${column}, ${row}] of ${entry.tile} px tiles is outside ${entry[imageKey]} (${size.width} by ${size.height}).`);
        }
      }
    }
    return cells;
  }

  /** Any other value: every string that names an image must be a file that exists. */
  function paths(value, where) {
    if (typeof value === 'string') {
      if (/\.(png|jpe?g|webp|gif)$/i.test(value)) image(value, where);
    } else if (Array.isArray(value)) value.forEach((v, i) => paths(v, `${where}[${i}]`));
    else if (isObject(value)) for (const [k, v] of Object.entries(value)) paths(v, `${where}.${k}`);
  }

  if (doc && manifest.version !== doc.version) failures.push(`version is ${JSON.stringify(manifest.version)}. docs/assets.md says ${JSON.stringify(doc.version)}.`);
  const summary = [];
  for (const section of Object.keys(doc ?? {})) {
    if (section !== 'version' && manifest[section] === undefined) failures.push(`manifest.json has no "${section}" section. docs/assets.md describes one.`);
  }
  for (const [section, entry] of Object.entries(manifest)) {
    if (section === 'version') continue;
    if (doc && doc[section] === undefined && section !== 'models' && section !== 'cast' && section !== 'voice') {
      warnings.push(`manifest.json has a "${section}" section that docs/assets.md does not describe. Add its shape to docs/assets.md.`);
    }
    if (section === 'models') {
      for (const [name, model] of Object.entries(entry)) {
        try {
          if (!/^models\/[a-z0-9-]+\.glb$/.test(model.file)) throw Error('invalid model path');
          const data = fs.readFileSync(path.join(assets, model.file));
          used.add(model.file);
          const { triangles } = inspectGlb(data);
          if (!isWhole(model.budget, 1) || model.budget > (/^(tree|birch|pine)-/.test(name) ? 1500 : 300)) throw Error('invalid triangle budget');
          if (triangles !== model.triangles || triangles > model.budget) throw Error(`${triangles} triangles, declared ${model.triangles}, budget ${model.budget}`);
          if (data.length !== model.bytes) throw Error(`${data.length} bytes, declared ${model.bytes}`);
        } catch (error) { failures.push(`models.${name}: ${error.message}`); }
      }
      summary.push(`${Object.keys(entry).length} models checked against GLB bytes`);
    } else if (section === 'cast') {
      // The characters: one file each, exported from its Blender source by tools/models/cast/build.mjs.
      for (const [name, model] of Object.entries(entry)) {
        try {
          if (model.file !== `models/cast-${name}.glb`) throw Error('invalid cast path');
          if (!fs.existsSync(path.join(root, model.source ?? ''))) throw Error(`no source at ${model.source}`);
          const data = fs.readFileSync(path.join(assets, model.file));
          used.add(model.file);
          const { triangles } = inspectGlb(data);
          if (model.budget !== 4000 && model.budget !== 2000) throw Error('invalid triangle budget');
          if (triangles !== model.triangles || triangles > model.budget) throw Error(`${triangles} triangles, declared ${model.triangles}, budget ${model.budget}`);
          if (data.length !== model.bytes) throw Error(`${data.length} bytes, declared ${model.bytes}`);
        } catch (error) { failures.push(`cast.${name}: ${error.message}`); }
      }
      summary.push(`${Object.keys(entry).length} cast models checked against GLB bytes and their sources`);
    } else if (section === 'voice') {
      // The voiced lines have a list of their own; the voice check reads it. Here its files count as listed.
      try {
        const list = JSON.parse(fs.readFileSync(path.join(assets, entry.lines), 'utf8'));
        used.add(entry.lines);
        for (const line of Object.values(list.lines ?? {})) if (typeof line?.file === 'string') used.add(line.file);
      } catch (error) { failures.push(`voice.lines: ${error.message}`); }
      summary.push('voice');
    } else if (section === 'sprites') {
      if (!isObject(entry)) { failures.push('sprites is not an object.'); continue; }
      const example = isObject(doc?.sprites) ? Object.values(doc.sprites)[0] : null;
      for (const [name, value] of Object.entries(entry)) sprite(name, value, example);
      summary.push(plural(Object.keys(entry).length, 'sprite'));
    } else if (isObject(entry) && (entry.tile !== undefined || entry.names !== undefined || entry.tiles !== undefined)) {
      const before = failures.length;
      const cells = tileSheet(section, entry, doc?.[section]);
      const names = Object.keys(entry.tiles ?? entry.names ?? {}).length;
      if (failures.length === before || names) summary.push(`${section}: ${plural(names, 'name')}, ${plural(cells, 'cell')}`);
      for (const [k, v] of Object.entries(entry)) {
        if (['atlas', 'sheet', 'tiles', 'names', 'tile'].includes(k)) continue;
        if (doc?.[section] && doc[section][k] === undefined) {
          warnings.push(`manifest.json has "${section}.${k}", which docs/assets.md does not describe. Add its shape to docs/assets.md.`);
        }
        // More sheets of the same kind, by name, as in icons.sheets.story.
        const more = k === 'sheets' && isObject(v) ? Object.entries(v).filter(([, sheet]) => isObject(sheet)) : [];
        for (const [key, sheet] of more) {
          const extra = tileSheet(`${section}.${k}.${key}`, sheet, { tile: 0, names: doc?.[section]?.names });
          summary.push(`${section}.${k}.${key}: ${plural(Object.keys(sheet.names ?? {}).length, 'name')}, ${plural(extra, 'cell')}`);
        }
        if (!more.length) paths(v, `${section}.${k}`);
      }
    } else {
      paths(entry, section);
      summary.push(section);
    }
  }
  for (const file of [...files].sort()) {
    if (!used.has(file)) warnings.push(`public/assets/${file} is not in manifest.json, so the game never loads it. List it or delete it.`);
  }
  return result(manifest, `${summary.join('; ')}; ${plural(used.size - 1, 'file')} listed and found`);
}

// -------------------------------------------------------------------------------- 2. sprite check

/** Runs tools/sprites/check.mjs and turns a failed assertion into lines a reader can act on. */
export function checkSprites(root) {
  const script = 'tools/sprites/check.mjs';
  if (!fs.existsSync(path.join(root, script))) return { failures: [`${script} is missing.`], warnings: [], detail: '' };
  // The script ends by writing its result into .artifacts/sprites, which git ignores, so a fresh checkout lacks it.
  fs.mkdirSync(path.join(root, '.artifacts/sprites'), { recursive: true });
  // --complete also requires every story set the game ships: the townspeople, portraits, crops, icons, ui.
  const run = spawnSync(process.execPath, [script, '--complete'], { cwd: root, encoding: 'utf8', timeout: 300_000 });
  const out = (run.stdout ?? '').split('\n').map((l) => l.trimEnd()).filter(Boolean);
  if (run.status === 0) {
    const passes = out.filter((l) => l.startsWith('PASS ')).map((l) => l.slice(5));
    return { failures: [], warnings: [], detail: passes.length ? passes.join('; ') : out.at(-1) ?? 'exit 0' };
  }

  const err = (run.stderr ?? '').split('\n').map((l) => l.trimEnd());
  const start = err.findIndex((l) => /^(\w*Error\b|error:|ENOENT|EACCES)/.test(l));
  const body = (start < 0 ? err.filter(Boolean).slice(-12) : err.slice(start, start + 30))
    .filter((l) => l && !/^\s*(generatedMessage|operator|diff|code):/.test(l) && !/^Bun v/.test(l));
  const message = body[0] ?? (run.error ? String(run.error.message) : `exit ${run.status}`);
  const hint = SPRITE_CHECK_HINTS.find(([pattern]) => pattern.test(message));
  const lines = [`bun ${script} --complete failed: ${message}`];
  if (hint) lines.push(`  means: ${hint[1]}.`);
  for (const line of body.slice(1, 16)) lines.push(`  ${line.trim()}`);
  const passed = out.filter((l) => /^(OK|PASS) /.test(l));
  lines.push(passed.length ? `  it stops at its first problem. Last step that passed: "${passed.at(-1)}"` : '  it stops at its first problem, before any step passed.');
  return { failures: [lines.join('\n')], warnings: [], detail: '' };
}

// ------------------------------------------------------------------------------- 3. names in code

const NAME_PATTERN = /\b(sprite|icon|portrait|picture)['"]?\s*:\s*(['"])([^'"\n]*)\2/g;
// The same keys set from a variable, as in `picture: id,`. They are counted and cannot be checked.
const VARIABLE_PATTERN = /\b(sprite|icon|portrait|picture)['"]?\s*:\s*(?!string\b)[A-Za-z_$][\w$.]*\s*[,}]/g;

/** Every `sprite: '...'`, `icon: '...'`, `portrait: '...'` and `picture: '...'` in the game's content files. */
export function scanNames(root, folder = 'src/game/content') {
  const refs = [];
  let variables = 0;
  const dir = path.join(root, folder);
  const files = walk(dir).filter((f) => f.endsWith('.ts') && !/\.test\.ts$/.test(f)).sort();
  for (const file of files) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    lines.forEach((text, i) => {
      for (const m of text.matchAll(NAME_PATTERN)) {
        if (m[3]) refs.push({ file: `${folder}/${file}`, line: i + 1, kind: m[1], name: m[3] });
      }
      variables += [...text.matchAll(VARIABLE_PATTERN)].length;
    });
  }
  return { refs, files: files.length, variables };
}

/** The names the manifest offers, by the kind of reference that may use them. */
export function manifestNames(manifest) {
  const sprites = new Set(Object.keys(manifest?.sprites ?? {}));
  // Icons live in icons.names and in every further sheet under icons.sheets.
  const icons = new Set();
  (function collect(entry) {
    if (!isObject(entry)) return;
    if (isObject(entry.names)) for (const name of Object.keys(entry.names)) icons.add(name);
    for (const sheet of Object.values(isObject(entry.sheets) ? entry.sheets : {})) collect(sheet);
  })(manifest?.icons);
  const portraits = new Set(Object.keys(manifest?.portraits?.names ?? {}));
  return {
    sprite: { names: sprites, where: 'manifest.sprites' },
    icon: { names: icons, where: 'manifest.icons.names or a sheet under manifest.icons.sheets' },
    portrait: { names: portraits, where: 'manifest.portraits.names' },
    // An Almanac page's picture is a sprite, a portrait or an icon (src/game/content/almanac.ts).
    picture: { names: new Set([...sprites, ...icons, ...portraits]), where: 'the manifest\'s sprites, icons or portraits' },
  };
}

export function checkNames(root, manifest) {
  const { refs, files, variables } = scanNames(root);
  const known = manifestNames(manifest);
  const missing = refs
    .filter((r) => !known[r.kind].names.has(r.name))
    .map((r) => `${r.file}:${r.line}  ${r.kind} '${r.name}' is not in ${known[r.kind].where}`);
  const unchecked = variables ? `, ${variables} more set from a variable and not checked` : '';
  return { missing, detail: `${plural(refs.length, 'name')} in ${plural(files, 'file')} under src/game/content${unchecked}` };
}

// --------------------------------------------------------------------------------- 4. block tiles

export async function checkBlockTiles(root, manifest) {
  const failures = [];
  let blocks;
  try {
    blocks = await import(pathToFileURL(path.join(root, 'src/content/blocks.ts')).href);
  } catch (error) {
    return { failures: [`src/content/blocks.ts cannot be imported: ${error.message}`], warnings: [], detail: '' };
  }
  if (typeof blocks.blockTileNames !== 'function') {
    return { failures: ['src/content/blocks.ts no longer exports blockTileNames(), which lists the tile names to check.'], warnings: [], detail: '' };
  }
  const names = blocks.blockTileNames().filter((n) => n !== 'water');
  const tiles = manifest?.blocks?.tiles ?? {};
  for (const name of names) {
    if (Array.isArray(tiles[name]) && tiles[name].length) continue;
    const users = (blocks.BLOCKS ?? []).filter((b) => Object.values(b.tiles).includes(name)).map((b) => b.key);
    failures.push(`tile '${name}'${users.length ? ` (block ${users.join(', ')})` : ''} has no cell in manifest.blocks.tiles`);
  }
  return { failures, warnings: [], detail: `${plural(names.length, 'tile name')} from src/content/blocks.ts, water left out` };
}

// --------------------------------------------------------------------------------------- 5. props

const lengthOf = (v) => (v && typeof v.length === 'number' ? v.length : null);

/** Triangles in what a builder returned: a Three.js geometry, plain arrays, a mesh, or a list of those. */
export function countTriangles(made) {
  if (made == null) return null;
  if (Array.isArray(made)) {
    let sum = 0;
    for (const part of made) {
      const n = countTriangles(part);
      if (n == null) return null;
      sum += n;
    }
    return made.length ? sum : null;
  }
  if (typeof made !== 'object') return null;
  if (typeof made.triangles === 'number') return made.triangles;
  if (made.geometry) return countTriangles(made.geometry);
  const index = typeof made.getIndex === 'function' ? made.getIndex() : made.index ?? made.indices;
  if (index) {
    const count = typeof index.count === 'number' ? index.count : lengthOf(index);
    if (count != null) return count / 3;
  }
  const position = made.attributes?.position ?? made.positions ?? made.position ?? made.vertices;
  if (position) {
    if (typeof position.count === 'number') return position.count / 3;
    if (lengthOf(position) != null) return lengthOf(position) / 9;
  }
  return null;
}

const firstKey = (entry, keys, test) => keys.find((k) => test(entry[k]));

/** Finds the prop entries a module exports, builds every variant and counts its triangles. */
export function inspectProps(module) {
  const rows = [], problems = [];
  const seen = new Set();
  const consider = (entry, fallbackName) => {
    if (!isObject(entry) || seen.has(entry)) return;
    const buildKey = firstKey(entry, PROP_KEYS.build, (v) => typeof v === 'function');
    if (!buildKey) return;
    seen.add(entry);
    const nameKey = firstKey(entry, PROP_KEYS.name, (v) => typeof v === 'string');
    const name = nameKey ? entry[nameKey] : fallbackName;
    const budgetKey = firstKey(entry, PROP_KEYS.budget, (v) => typeof v === 'number' || typeof v?.triangles === 'number');
    if (!budgetKey) return problems.push(`${name}: the entry declares no triangle budget (looked for ${PROP_KEYS.budget.join(', ')})`);
    const budget = typeof entry[budgetKey] === 'number' ? entry[budgetKey] : entry[budgetKey].triangles;
    const variants = Array.isArray(entry.variants) ? entry.variants : Array.from({ length: Math.max(1, Number(entry.variants) || 1) }, (_, i) => i);
    variants.forEach((variant, i) => {
      const label = variants.length > 1 ? `${name} variant ${i}` : name;
      let triangles = null, thrown = null;
      // A builder takes its variant (a number, or the entry from the variants list) or the variant's index.
      for (const args of variant === i ? [[i]] : [[variant, i], [i]]) {
        try {
          triangles = countTriangles(entry[buildKey](...args));
          if (triangles != null) break;
        } catch (error) {
          thrown = error;
        }
      }
      if (triangles == null) problems.push(thrown ? `${label}: the builder threw "${thrown.message}"` : `${label}: the builder returned nothing with triangles to count`);
      else rows.push({ name: label, triangles: Math.ceil(triangles), budget });
    });
  };
  for (const [exportName, value] of Object.entries(module)) {
    if (Array.isArray(value)) value.forEach((entry, i) => consider(entry, `${exportName}[${i}]`));
    else if (value instanceof Map) for (const [key, entry] of value) consider(entry, String(key));
    else if (isObject(value)) {
      consider(value, exportName);
      if (!seen.has(value)) for (const [key, entry] of Object.entries(value)) consider(entry, key);
    }
  }
  return { rows, problems };
}

export function checkProps(root, self) {
  const file = 'src/content/props.ts';
  if (!fs.existsSync(path.join(root, file))) return { failures: [], warnings: [], detail: `${file} does not exist, nothing to check` };
  // A separate process, so a builder that throws at import or never returns cannot take this script down.
  const run = spawnSync(process.execPath, [self, '--props-worker', path.join(root, file)], { cwd: root, encoding: 'utf8', timeout: 120_000 });
  let report;
  try {
    report = JSON.parse((run.stdout ?? '').split('\n').filter((l) => l.startsWith('{')).at(-1));
  } catch {
    const why = (run.stderr ?? '').split('\n').filter(Boolean).slice(0, 6).join(' | ') || (run.error ? run.error.message : `exit ${run.status}`);
    return { failures: [`${file} cannot be imported and built in bun: ${why}`], warnings: [], detail: '' };
  }
  const failures = [...report.problems];
  for (const row of report.rows) {
    if (row.triangles > row.budget) failures.push(`${row.name}: ${row.triangles} triangles, and its entry allows ${row.budget}`);
  }
  if (!report.rows.length && !report.problems.length) {
    failures.push(`${file} exports nothing this check knows as a prop entry: an object with a builder (${PROP_KEYS.build.join(', ')}) and a budget (${PROP_KEYS.budget.join(', ')}). Add the entry's field names to PROP_KEYS in tools/verify-assets.mjs.`);
  }
  const worst = report.rows.reduce((a, b) => (a && a.triangles / a.budget >= b.triangles / b.budget ? a : b), null);
  const detail = worst ? `${plural(report.rows.length, 'prop shape')} built; fullest is ${worst.name} at ${worst.triangles} of ${worst.budget} triangles` : '';
  return { failures, warnings: [], detail };
}

// ------------------------------------------------------------------------------------ 6. palettes

const PALETTE_SIGNS = ['root', 'scale', 'tempo', 'chords', 'harmony', 'melody', 'drone'];
const isPatch = (v) => (Array.isArray(v) ? v.length > 0 && v.every(isPatch) : isObject(v) && typeof v.kind === 'string');
const looksLikePalette = (v) => isObject(v) && PALETTE_SIGNS.filter((k) => v[k] !== undefined).length >= 2;
const hasLayer = (v) => (Array.isArray(v) ? v.length > 0 : isObject(v));
const voice = (item) => isObject(item) && (item.patch !== undefined || item.drum !== undefined);

/**
 * `palettes` is a list of { label, palette }. Each needs a root, a scale, a tempo, and an instrument in
 * every layer that any other palette has. A layer is a field that holds a patch or a drum.
 */
export function checkPalettes(palettes, exempt = LAYER_EXEMPT) {
  const failures = [], notes = [], skipped = new Map();
  const layers = new Map(); // layer name -> the patch fields seen in it
  for (const { palette } of palettes) {
    for (const [key, value] of Object.entries(palette)) {
      const items = Array.isArray(value) ? value : [value];
      if (!items.some(voice)) continue;
      const fields = layers.get(key) ?? new Set();
      for (const item of items) for (const [k, v] of Object.entries(item)) if (isPatch(v)) fields.add(k);
      layers.set(key, fields);
    }
  }
  for (const { label, palette } of palettes) {
    if (!Number.isFinite(palette.root)) failures.push(`${label}: no root. It must be a MIDI note number.`);
    if (!(Array.isArray(palette.scale) && palette.scale.length && palette.scale.every(Number.isFinite))) failures.push(`${label}: no scale. It must be a list of semitones above the root.`);
    if (!(Number.isFinite(palette.tempo) && palette.tempo > 0)) failures.push(`${label}: no tempo. It must be beats a minute, above 0.`);
    for (const [layer, fields] of layers) {
      const value = palette[layer];
      if (!hasLayer(value)) {
        const reason = exempt[palette.id ?? label]?.[layer];
        const others = palettes.filter((p) => p.palette !== palette && hasLayer(p.palette[layer])).map((p) => p.label);
        if (reason) {
          notes.push(`${label} has no ${layer}: ${reason}`);
          skipped.set(label, [...(skipped.get(label) ?? []), layer]);
        }
        else failures.push(`${label}: no ${layer} layer, and ${others.join(', ')} ${others.length === 1 ? 'has' : 'have'} one.`);
        continue;
      }
      (Array.isArray(value) ? value : [value]).forEach((item, i) => {
        const at = Array.isArray(value) ? `${layer}[${i}]` : layer;
        if (!isObject(item)) return failures.push(`${label}: ${at} is not a layer entry.`);
        if (item.drum !== undefined) {
          if (typeof item.drum !== 'string' || !item.drum) failures.push(`${label}: ${at} has no drum.`);
          return;
        }
        for (const field of fields.size ? fields : ['patch']) {
          if (!isPatch(item[field])) failures.push(`${label}: ${at}.${field} is not an instrument (a patch with a kind).`);
        }
      });
    }
  }
  const onPurpose = [...skipped].map(([label, list]) => `${label} has no ${list.join(' and no ')}`).join('; ');
  return { failures, notes, onPurpose, layers: [...layers.keys()] };
}

export async function loadPalettes(root) {
  const folder = 'src/content/palettes';
  const dir = path.join(root, folder);
  const found = new Map(); // palette object -> label
  const warnings = [], failures = [];
  let listed = null;
  if (!fs.existsSync(dir)) return { palettes: [], warnings, failures: [`${folder} does not exist.`] };
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !/\.test\.ts$/.test(f)).sort()) {
    let module;
    try {
      module = await import(pathToFileURL(path.join(dir, file)).href);
    } catch (error) {
      failures.push(`${folder}/${file} cannot be imported: ${error.message}`);
      continue;
    }
    for (const [name, value] of Object.entries(module)) {
      if (file === 'index.ts' && name === 'palettes' && Array.isArray(value)) listed = value;
      for (const item of Array.isArray(value) ? value : [value]) {
        if (looksLikePalette(item) && !found.has(item)) found.set(item, typeof item.id === 'string' ? item.id : `${name} (${file})`);
      }
    }
  }
  if (listed) {
    for (const [palette, label] of found) {
      if (!listed.includes(palette)) warnings.push(`${folder}: palette ${label} is not in the list in index.ts, so the sound engine never plays it.`);
    }
  }
  return { palettes: [...found].map(([palette, label]) => ({ label, palette })), warnings, failures };
}

// --------------------------------------------------------------------------------------- 7. sizes

export function checkSizes(root, limits = LIMITS) {
  const dir = path.join(root, 'public/assets');
  const rows = walk(dir).map((file) => {
    const full = path.join(dir, file);
    const size = /\.png$/i.test(file) ? pngSizeOf(full) : null;
    return { file, bytes: fs.statSync(full).size, pixels: size ? `${size.width} x ${size.height}` : '' };
  }).sort((a, b) => b.bytes - a.bytes);
  const total = rows.reduce((sum, r) => sum + r.bytes, 0);
  const pngs = rows.filter((r) => /\.png$/i.test(r.file));
  const failures = pngs.filter((r) => r.bytes > limits.png)
    .map((r) => `public/assets/${r.file} is ${kb(r.bytes)} KB (${r.pixels}). One PNG may be ${kb(limits.png)} KB at most.`);
  if (total >= limits.folder) failures.push(`public/assets is ${(total / MB).toFixed(2)} MB. The whole folder must stay under ${limits.folder / MB} MB.`);
  const width = Math.max(4, ...rows.map((r) => r.file.length));
  const table = [`  ${'file'.padEnd(width)}  ${'KB'.padStart(8)}  pixels`];
  for (const r of rows) table.push(`  ${r.file.padEnd(width)}  ${kb(r.bytes).padStart(8)}  ${r.pixels}`);
  table.push(`  ${'total'.padEnd(width)}  ${kb(total).padStart(8)}  ${(total / MB).toFixed(2)} MB of ${limits.folder / MB} MB`);
  const largest = pngs[0];
  const detail = `${plural(pngs.length, 'PNG')}, largest ${largest ? `${kb(largest.bytes)} KB` : 'none'} of ${kb(limits.png)} KB; folder ${(total / MB).toFixed(2)} MB of ${limits.folder / MB} MB`;
  return { failures, warnings: [], detail, table };
}

// ---------------------------------------------------------------------------------------- 8. voice

/** The voiced lines (docs/assets.md, Voiced lines): every clip the list names is there, and every clip there is listed. */
export function checkVoice(root, manifest) {
  const failures = [];
  const assets = path.join(root, 'public/assets');
  const pointer = manifest?.voice?.lines;
  const folder = path.join(assets, 'voice');
  const clips = fs.existsSync(folder) ? walk(folder).filter((f) => f.endsWith('.mp3')).map((f) => `voice/${f}`) : [];
  if (pointer === undefined) {
    if (clips.length) failures.push(`public/assets/voice holds ${plural(clips.length, 'clip')} but manifest.json has no "voice.lines" to list them.`);
    return { failures, detail: 'no voiced lines' };
  }
  let list;
  try {
    list = JSON.parse(fs.readFileSync(path.join(assets, pointer), 'utf8'));
  } catch (error) {
    failures.push(`manifest.json names ${pointer} for the voiced lines, and it cannot be read: ${error.message}`);
    return { failures, detail: pointer };
  }
  const listed = new Set();
  let seconds = 0;
  for (const [key, line] of Object.entries(list.lines ?? {})) {
    const text = key.slice(key.indexOf('|') + 1);
    if (!key.includes('|')) failures.push(`${pointer}: "${key}" is not <speaker>|<text>.`);
    if (!line || typeof line.file !== 'string' || !fs.existsSync(path.join(assets, line.file))) failures.push(`${pointer}: the clip of "${key}" (${line?.file}) is missing.`);
    else listed.add(line.file);
    if (!(line?.seconds > 0)) failures.push(`${pointer}: "${key}" has no length.`);
    else seconds += line.seconds;
    const reveal = line?.reveal;
    if (!Array.isArray(reveal) || reveal.length !== text.length || reveal.some((t, i) => !isWhole(t) || (i > 0 && t < reveal[i - 1]))) {
      failures.push(`${pointer}: "${key}" needs one whole, rising millisecond per character of its text in "reveal".`);
    }
  }
  for (const [conversation, keys] of Object.entries(list.conversations ?? {})) {
    for (const key of keys) if (!list.lines?.[key]) failures.push(`${pointer}: conversation ${conversation} names "${key}", which has no clip.`);
  }
  for (const clip of clips) if (!listed.has(clip)) failures.push(`public/assets/${clip} is not in ${pointer}. Run tools/voice.ts, which deletes the clips of lines that are gone.`);
  return { failures, detail: `${plural(listed.size, 'clip')}, ${(seconds / 60).toFixed(1)} minutes, model ${list.model}` };
}

// ---------------------------------------------------------------------------------------- the run

const USUAL_FIX = {
  manifest: 'make manifest.json and the files agree: rebuild with the script that owns the entry, or correct the path. Never hand-edit a sheet.',
  'sprite-check': 'find the message in .agents/skills/make-sprite/check-failures.md, fix the build step it names, rebuild, and run bun tools/sprites/check.mjs --complete alone until it passes.',
  names: 'correct the name in the content file, or make the asset under that exact name (.agents/skills/make-sprite/SKILL.md).',
  'block-tiles': 'correct the tile name in src/content/blocks.ts, or make the tile (.agents/skills/make-sprite/SKILL.md).',
  props: 'simplify the builder (fewer segments, merged faces). Raise the budget only inside the limits in docs/style-sheet.md.',
  palettes: 'give the palette the missing field or layer, copying the shape from src/content/palettes/meadow.ts.',
  sizes: 'a sheet this heavy is not palette-snapped pixel art. Rebuild it through tools/sprites, or cut its size in pixels.',
  voice: 'run bun --env-file=.env.local tools/voice.ts, which makes the missing clips, deletes the ones no line uses and writes the list again. Never edit voice/ by hand.',
};

export async function verify({ root, strict = false, self }) {
  const checks = [];
  const add = (name, { failures = [], warnings = [], detail = '' }) => checks.push({ name, failures, warnings, detail });

  const manifest = checkManifest(root);
  add('manifest', manifest);
  add('sprite-check', checkSprites(root));

  if (manifest.manifest) {
    const names = checkNames(root, manifest.manifest);
    add('names', {
      failures: strict ? names.missing : [],
      warnings: strict ? [] : names.missing,
      detail: names.detail + (names.missing.length && !strict ? `; ${names.missing.length} missing (warnings below, failures with --strict)` : ''),
    });
    add('block-tiles', await checkBlockTiles(root, manifest.manifest));
  } else {
    add('names', { failures: ['manifest.json cannot be read, so no name can be looked up.'] });
    add('block-tiles', { failures: ['manifest.json cannot be read, so no tile can be looked up.'] });
  }

  add('props', checkProps(root, self));

  const loaded = await loadPalettes(root);
  const music = checkPalettes(loaded.palettes);
  const paletteFailures = [...loaded.failures, ...music.failures];
  if (!loaded.palettes.length && !loaded.failures.length) paletteFailures.push('src/content/palettes holds no palette.');
  add('palettes', {
    failures: paletteFailures,
    warnings: loaded.warnings,
    detail: `${plural(loaded.palettes.length, 'palette')}; layers ${music.layers.join(', ')}${music.onPurpose ? `; on purpose (LAYER_EXEMPT): ${music.onPurpose}` : ''}`,
  });

  const sizes = checkSizes(root);
  add('sizes', sizes);
  add('voice', checkVoice(root, manifest.manifest));

  if (strict) {
    for (const check of checks) {
      check.failures.push(...check.warnings);
      check.warnings = [];
    }
  }
  return { checks, table: sizes.table };
}

export function report({ checks, table }, { all = false, strict = false } = {}) {
  const lines = [];
  const width = Math.max(...checks.map((c) => c.name.length));
  for (const check of checks) {
    const failed = check.failures.length > 0;
    const text = failed ? `${plural(check.failures.length, 'failure')}${check.detail ? ` (${check.detail})` : ''}` : check.detail;
    lines.push(`${failed ? 'FAIL' : 'PASS'}  ${check.name.padEnd(width)}  ${text}`);
  }
  lines.push('', 'Sizes in public/assets (1 MB = 1,048,576 bytes)', ...table);

  const failing = checks.filter((c) => c.failures.length);
  const indent = (text) => text.split('\n').map((l, i) => (i ? `    ${l}` : `  - ${l}`)).join('\n');
  (all ? failing : failing.slice(0, 1)).forEach((check) => {
    lines.push('', `FAILED ${check.name}: ${plural(check.failures.length, 'failure')}`, ...check.failures.map(indent));
    lines.push(`  Usual fix: ${USUAL_FIX[check.name]}`);
  });
  if (!all && failing.length > 1) {
    lines.push('', `Also failing: ${failing.slice(1).map((c) => `${c.name} (${c.failures.length})`).join(', ')}. Fix ${failing[0].name} first, or list everything with --all.`);
  }

  const warnings = checks.flatMap((c) => c.warnings.map((w) => `[${c.name}] ${w}`));
  if (warnings.length) {
    lines.push('', `Warnings: ${warnings.length}${strict ? '' : ' (they do not fail the run; --strict makes them failures)'}`, ...warnings.map((w) => `  - ${w}`));
  }

  const passed = checks.length - failing.length;
  lines.push('', `TOTAL ${failing.length ? 'FAIL' : 'PASS'}: ${plural(checks.length, 'check')}, ${passed} passed, ${failing.length} failed, ${plural(warnings.length, 'warning')}${failing.length ? `. First failure: ${failing[0].name}` : ''}`);
  return { text: lines.join('\n'), ok: failing.length === 0 };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args[0] === '--props-worker') {
    // The small script the props check runs: import the builders, build every shape, print the counts.
    let module = await import(pathToFileURL(path.resolve(args[1])).href);
    // An entry may name its builder instead of holding it: the functions then live in the props feature's
    // builders index, keyed by that name, and take (variant index, entry).
    const index = path.join(path.dirname(path.dirname(path.resolve(args[1]))), 'features/props/builders/index.ts');
    if (fs.existsSync(index)) {
      const builders = Object.values(await import(pathToFileURL(index).href)).find((v) => isObject(v) && Object.values(v).some((f) => typeof f === 'function'));
      if (builders) {
        const named = {};
        for (const [exportName, value] of Object.entries(module)) {
          if (!isObject(value) || Array.isArray(value)) continue;
          for (const [key, entry] of Object.entries(value)) {
            const fn = isObject(entry) && typeof entry.builder === 'string' ? builders[entry.builder] : undefined;
            if (fn) named[`${exportName}.${key}`] = { ...entry, name: entry.name ?? key, builder: (_variant, i) => fn(i, entry) };
          }
        }
        if (Object.keys(named).length) module = { named };
      }
    }
    console.log(JSON.stringify(inspectProps(module)));
    process.exit(0);
  }
  const unknown = args.filter((a, i) => !['--strict', '--all', '--root'].includes(a) && args[i - 1] !== '--root');
  if (unknown.length) {
    console.error(`verify-assets: unknown option ${unknown.join(' ')}. Options: --strict, --all.`);
    process.exit(1);
  }
  const rootAt = args.indexOf('--root'); // for the tests, which check a small made-up repo
  const root = path.resolve(rootAt >= 0 ? args[rootAt + 1] : path.join(import.meta.dirname, '..'));
  const strict = args.includes('--strict');
  const result = await verify({ root, strict, self: import.meta.filename });
  const { text, ok } = report(result, { all: args.includes('--all'), strict });
  console.log(`verify-assets${strict ? ' --strict' : ''}: ${root}\n\n${text}`);
  process.exit(ok ? 0 : 1);
}
