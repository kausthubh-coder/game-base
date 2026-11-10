// Tests for tools/verify-assets.mjs. The name starts with the script's own path so that
// `bun test tools/verify-assets.mjs` finds it: bun test does not look inside dot folders such as .agents.
import { afterAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  checkBlockTiles, checkManifest, checkNames, checkPalettes, checkProps, checkSizes, checkSprites, checkVoice,
  countTriangles, inspectProps, pngSize,
} from './verify-assets.mjs';

const script = path.join(import.meta.dirname, 'verify-assets.mjs');
const repo = path.join(import.meta.dirname, '..');
const made = [];
// Several tests start the script as its own process, which is slow while other agents load the machine.
setDefaultTimeout(60_000);
afterAll(() => made.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

/** The first 24 bytes of a PNG of this size, which is all the size reader needs, padded to `bytes`. */
function png(width, height, bytes = 64) {
  const data = Buffer.alloc(Math.max(24, bytes));
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).copy(data);
  data.write('IHDR', 12);
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return data;
}

const DOC = [
  '# The asset contract', '', '```json',
  JSON.stringify({
    version: 1,
    sprites: { hero: { sheet: 'sprites/hero.png', frame: [128, 128], anchor: [64, 120], worldHeight: 2, animations: { idle: { frames: 4, fps: 4, rows: { front: 0, back: 1, side: 2 } } } } },
    blocks: { tile: 32, atlas: 'blocks/atlas.png', tiles: { dirt: [[3, 0]] } },
    icons: { tile: 32, sheet: 'icons/icons.png', names: { wood: [0, 0] } },
  }),
  '```', '',
].join('\n');

const goodManifest = () => ({
  version: 1,
  sprites: {
    hero: { sheet: 'sprites/hero.png', frame: [32, 32], anchor: [16, 30], worldHeight: 2, animations: { idle: { frames: 2, fps: 4, rows: { front: 0, back: 1, side: 2 } } } },
  },
  blocks: { tile: 32, atlas: 'blocks/atlas.png', tiles: { grass_top: [[0, 0], [1, 0]], dirt: [[0, 1]] } },
  icons: { tile: 32, sheet: 'icons/icons.png', names: { wood: [0, 0], stone: [1, 0] } },
});

const palette = (id, extra = {}) => `export const ${id} = ${JSON.stringify({
  id, root: 50, scale: [0, 2, 4, 7, 9], tempo: 84,
  drone: [{ patch: { kind: 'pad' }, gain: 1 }],
  bass: { patch: { kind: 'pluck' } },
  melody: { patch: { kind: 'wind' }, night: { kind: 'bell' } },
  perc: [{ drum: 'hand', steps: ['x...'] }],
  ...extra,
})};\n`;

/** A tiny repo with every folder the script reads. `files` adds or replaces files, and null removes one. */
function repoWith(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-assets-'));
  made.push(root);
  const all = {
    'docs/assets.md': DOC,
    'public/assets/manifest.json': JSON.stringify(goodManifest()),
    'public/assets/sprites/hero.png': png(64, 96),
    'public/assets/blocks/atlas.png': png(64, 64),
    'public/assets/icons/icons.png': png(64, 32),
    'src/content/blocks.ts': "export const BLOCKS = [{ key: 'grass', tiles: { top: 'grass_top', side: 'dirt', bottom: 'dirt' } }, { key: 'water', tiles: { top: 'water', side: 'water', bottom: 'water' } }];\nexport const blockTileNames = () => ['grass_top', 'dirt', 'water'];\n",
    'src/content/palettes/meadow.ts': palette('meadow'),
    'src/content/palettes/coast.ts': palette('coast'),
    'src/content/palettes/index.ts': "import { meadow } from './meadow.ts';\nimport { coast } from './coast.ts';\nexport const palettes = [meadow, coast];\n",
    'src/game/content/items.ts': "export const items = [{ id: 'log', icon: 'wood' }];\n",
    'tools/sprites/check.mjs': "console.log('OK hero');\nconsole.log('PASS 2 sprite frames');\n",
    ...files,
  };
  for (const [file, content] of Object.entries(all)) {
    if (content === null) continue;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

const withManifest = (change, files = {}) => {
  const manifest = goodManifest();
  change(manifest);
  return repoWith({ 'public/assets/manifest.json': JSON.stringify(manifest), ...files });
};

function run(root, ...flags) {
  const result = spawnSync(process.execPath, [script, '--root', root, ...flags], { encoding: 'utf8' });
  return { status: result.status, out: result.stdout };
}

describe('the manifest check', () => {
  test('a manifest that matches the doc and the files has no failures and no warnings', () => {
    const result = checkManifest(repoWith());
    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.detail).toBe('1 sprite; blocks: 2 names, 3 cells; icons: 2 names, 2 cells; 3 files listed and found');
  });

  test('a path with no file is a failure that names the entry and the path', () => {
    const root = withManifest((m) => { m.sprites.hero.sheet = 'sprites/heroo.png'; });
    expect(checkManifest(root).failures).toEqual(['sprites.hero.sheet is "sprites/heroo.png". No such file in public/assets/.']);
  });

  test('a path that differs from the file only in letter case is a failure', () => {
    const root = withManifest((m) => { m.icons.sheet = 'icons/Icons.png'; });
    expect(checkManifest(root).failures).toEqual([
      'icons.sheet is "icons/Icons.png" and the file is "icons/icons.png". The letter case differs: it loads on this Mac and fails on the server.',
    ]);
  });

  test('a cell outside its image is a failure', () => {
    const root = withManifest((m) => { m.icons.names.stone = [2, 0]; });
    expect(checkManifest(root).failures).toEqual(['icons.names.stone: cell [2, 0] of 32 px tiles is outside icons/icons.png (64 by 32).']);
  });

  test('an animation row below the bottom of its sheet is a failure', () => {
    const root = withManifest((m) => { m.sprites.hero.animations.walk = { frames: 2, fps: 10, rows: { front: 3 } }; });
    expect(checkManifest(root).failures).toEqual([
      'sprites.hero.animations.walk: the front view is row 3 with 2 frames of 32 by 32, which needs 64 by 128. sprites/hero.png is 64 by 96.',
    ]);
  });

  test('a key the doc lists and the entry lacks is a failure', () => {
    const root = withManifest((m) => { delete m.sprites.hero.worldHeight; });
    expect(checkManifest(root).failures).toEqual(['sprites.hero has no "worldHeight". docs/assets.md lists it.']);
  });

  test('a section the doc describes and the manifest lacks is a failure', () => {
    const root = withManifest((m) => { delete m.icons; }, { 'public/assets/icons/icons.png': null });
    expect(checkManifest(root).failures).toEqual(['manifest.json has no "icons" section. docs/assets.md describes one.']);
  });

  test('a section the doc does not describe is a warning, and its cells and paths are still checked', () => {
    const root = withManifest((m) => {
      m.portraits = { tile: 32, sheet: 'portraits/portraits.png', names: { tamsin: [0, 0], odo: [5, 0] } };
      m.ui = { panel: 'ui/panel.png' };
    }, { 'public/assets/portraits/portraits.png': png(64, 32) });
    const result = checkManifest(root);
    expect(result.failures).toEqual([
      'portraits.names.odo: cell [5, 0] of 32 px tiles is outside portraits/portraits.png (64 by 32).',
      'ui.panel is "ui/panel.png". No such file in public/assets/.',
    ]);
    expect(result.warnings).toEqual([
      'manifest.json has a "portraits" section that docs/assets.md does not describe. Add its shape to docs/assets.md.',
      'manifest.json has a "ui" section that docs/assets.md does not describe. Add its shape to docs/assets.md.',
    ]);
  });

  test('a further sheet under icons.sheets has its file and cells checked, and is a warning until the doc shows it', () => {
    const root = withManifest((m) => {
      m.icons.sheets = { story: { tile: 32, sheet: 'icons/icons-2.png', names: { plank: [0, 0], hoe: [0, 4] } } };
    }, { 'public/assets/icons/icons-2.png': png(64, 64) });
    const result = checkManifest(root);
    expect(result.failures).toEqual(['icons.sheets.story.names.hoe: cell [0, 4] of 32 px tiles is outside icons/icons-2.png (64 by 64).']);
    expect(result.warnings).toEqual(['manifest.json has "icons.sheets", which docs/assets.md does not describe. Add its shape to docs/assets.md.']);
    expect(result.detail).toBe('1 sprite; blocks: 2 names, 3 cells; icons: 2 names, 2 cells; icons.sheets.story: 2 names, 2 cells; 4 files listed and found');
  });

  test('a file the manifest does not list is a warning', () => {
    const root = repoWith({ 'public/assets/sprites/old.png': png(8, 8) });
    expect(checkManifest(root).warnings).toEqual(['public/assets/sprites/old.png is not in manifest.json, so the game never loads it. List it or delete it.']);
  });

  test('a file that is not a PNG inside is a failure', () => {
    const root = repoWith({ 'public/assets/icons/icons.png': 'not a png at all, just some text' });
    expect(checkManifest(root).failures).toEqual(['icons.sheet is "icons/icons.png", which is not a PNG file inside (wrong bytes).']);
  });
});

describe('the sprite check', () => {
  test('a passing run reports every PASS line the script printed', () => {
    expect(checkSprites(repoWith())).toEqual({ failures: [], warnings: [], detail: '2 sprite frames' });
  });

  test('a failed assertion is reported with what it means and the last step that passed', () => {
    const root = repoWith({ 'tools/sprites/check.mjs': "import assert from 'node:assert/strict';\nconsole.log('OK hero: sizes');\nassert(false, 'pet feet baseline');\n" });
    const [failure] = checkSprites(root).failures;
    expect(failure).toStartWith('bun tools/sprites/check.mjs --complete failed: AssertionError: pet feet baseline\n');
    expect(failure).toContain("means: a frame's lowest drawn pixel is not on the anchor's y");
    expect(failure).toEndWith('Last step that passed: "OK hero: sizes"');
  });
});

describe('names that code refers to', () => {
  const content = [
    'export interface Def { icon: string; sprite: string }',
    "export const items = [{ id: 'log', icon: 'wood' }, { id: 'plank', icon: 'plank' }];",
    "export const npc = { sprite: 'tamsin', portrait: \"tamsin\" };",
    "export const page = { picture: 'stone', other: { picture: id, } };",
  ].join('\n');

  test('each missing name is reported with its file and line, and known names are not', () => {
    const root = repoWith({
      'src/game/content/items.ts': content,
      'src/game/content/items.test.ts': "const fake = { icon: 'nothing-real' };",
    });
    const result = checkNames(root, goodManifest());
    expect(result.missing).toEqual([
      "src/game/content/items.ts:2  icon 'plank' is not in manifest.icons.names or a sheet under manifest.icons.sheets",
      "src/game/content/items.ts:3  sprite 'tamsin' is not in manifest.sprites",
      "src/game/content/items.ts:3  portrait 'tamsin' is not in manifest.portraits.names",
    ]);
    expect(result.detail).toBe('5 names in 1 file under src/game/content, 1 more set from a variable and not checked');
  });

  test('an icon on a further sheet under icons.sheets and a portrait are found', () => {
    const manifest = goodManifest();
    manifest.icons.sheets = { story: { tile: 32, sheet: 'icons/icons-2.png', names: { plank: [0, 0] } } };
    manifest.portraits = { tile: 128, sheet: 'portraits/portraits.png', names: { tamsin: [0, 0] } };
    const root = repoWith({ 'src/game/content/items.ts': content });
    expect(checkNames(root, manifest).missing).toEqual(["src/game/content/items.ts:3  sprite 'tamsin' is not in manifest.sprites"]);
  });

  test('a missing name is a warning by default and a failure with --strict', () => {
    const root = repoWith({ 'src/game/content/items.ts': content });
    const plain = run(root);
    expect(plain.status).toBe(0);
    expect(plain.out).toContain("  - [names] src/game/content/items.ts:2  icon 'plank' is not in manifest.icons.names or a sheet under manifest.icons.sheets");
    expect(plain.out).toEndWith('TOTAL PASS: 8 checks, 8 passed, 0 failed, 3 warnings\n');
    const strict = run(root, '--strict');
    expect(strict.status).toBe(1);
    expect(strict.out).toContain('FAILED names: 3 failures');
    expect(strict.out).toEndWith('TOTAL FAIL: 8 checks, 7 passed, 1 failed, 0 warnings. First failure: names\n');
  });
});

describe('block tiles', () => {
  test('every tile name except water must have a cell, and the failure names the block', async () => {
    const manifest = goodManifest();
    expect((await checkBlockTiles(repoWith(), manifest)).failures).toEqual([]);
    delete manifest.blocks.tiles.dirt;
    expect((await checkBlockTiles(repoWith(), manifest)).failures).toEqual(["tile 'dirt' (block grass) has no cell in manifest.blocks.tiles"]);
  });
});

describe('prop triangle budgets', () => {
  test('triangles are counted in indexed, plain and Three.js-shaped geometry', () => {
    expect(countTriangles({ index: { count: 36 }, attributes: { position: { count: 24 } } })).toBe(12);
    expect(countTriangles({ getIndex: () => null, attributes: { position: { count: 9 } } })).toBe(3);
    expect(countTriangles({ positions: new Float32Array(27) })).toBe(3);
    expect(countTriangles({ indices: [0, 1, 2, 2, 3, 0], positions: new Float32Array(12) })).toBe(2);
    expect(countTriangles({ nothing: true })).toBe(null);
  });

  test('every variant of every entry is built and compared with its own budget', () => {
    const flat = (triangles) => ({ positions: new Float32Array(triangles * 9) });
    const { rows, problems } = inspectProps({
      props: [
        { name: 'oak', variants: 3, triangles: 100, build: (v) => flat(80 + v * 20) },
        { name: 'rock', triangles: 50, build: () => flat(10) },
        { name: 'sign', build: () => flat(10) },
        { name: 'well', triangles: 50, build: () => { throw new Error('no wood'); } },
      ],
    });
    expect(rows).toEqual([
      { name: 'oak variant 0', triangles: 80, budget: 100 },
      { name: 'oak variant 1', triangles: 100, budget: 100 },
      { name: 'oak variant 2', triangles: 120, budget: 100 },
      { name: 'rock', triangles: 10, budget: 50 },
    ]);
    expect(problems).toEqual([
      'sign: the entry declares no triangle budget (looked for triangles, budget, triangleBudget, maxTriangles, tris, maxTris)',
      'well: the builder threw "no wood"',
    ]);
  });

  test('a props file is imported in its own process and a shape over its budget fails', () => {
    const root = repoWith({
      'src/content/props.ts': "const flat = (n: number) => ({ positions: new Float32Array(n * 9) });\nexport const PROPS = { barrel: { budget: 300, build: () => flat(301) }, crate: { budget: 300, build: () => flat(12) } };\n",
    });
    const result = checkProps(root, script);
    expect(result.failures).toEqual(['barrel: 301 triangles, and its entry allows 300']);
    expect(result.detail).toBe('2 prop shapes built; fullest is barrel at 301 of 300 triangles');
  });

  test('no props file passes, and a props file with no entry this check knows fails', () => {
    expect(checkProps(repoWith(), script)).toEqual({ failures: [], warnings: [], detail: 'src/content/props.ts does not exist, nothing to check' });
    const [failure] = checkProps(repoWith({ 'src/content/props.ts': 'export const things = [1, 2, 3];\n' }), script).failures;
    expect(failure).toStartWith('src/content/props.ts exports nothing this check knows as a prop entry');
  });
});

describe('music palettes', () => {
  const full = () => ({
    id: 'a', root: 50, scale: [0, 2], tempo: 80,
    drone: [{ patch: { kind: 'pad' } }],
    bass: { patch: { kind: 'pluck' } },
    melody: { patch: [{ kind: 'wind' }, { kind: 'bell' }], night: { kind: 'bell' } },
    perc: [{ drum: 'hand' }],
  });
  const list = (...palettes) => palettes.map((p) => ({ label: p.id, palette: p }));

  test('complete palettes pass', () => {
    expect(checkPalettes(list(full(), { ...full(), id: 'b' }), {}).failures).toEqual([]);
  });

  test('a missing root, scale or tempo is a failure', () => {
    const broken = { ...full(), id: 'b', root: undefined, scale: [], tempo: 0 };
    expect(checkPalettes(list(full(), broken), {}).failures).toEqual([
      'b: no root. It must be a MIDI note number.',
      'b: no scale. It must be a list of semitones above the root.',
      'b: no tempo. It must be beats a minute, above 0.',
    ]);
  });

  test('a layer the others have must be there with an instrument in each of its voices', () => {
    const broken = { ...full(), id: 'b', bass: undefined, perc: [], melody: { patch: { kind: 'wind' } }, drone: [{ patch: {} }] };
    expect(checkPalettes(list(full(), broken), {}).failures).toEqual([
      'b: drone[0].patch is not an instrument (a patch with a kind).',
      'b: no bass layer, and a has one.',
      'b: melody.night is not an instrument (a patch with a kind).',
      'b: no perc layer, and a has one.',
    ]);
  });

  test('a layer left out on purpose is listed with its reason and does not fail', () => {
    const quiet = { ...full(), id: 'b', bass: undefined };
    const result = checkPalettes(list(full(), quiet), { b: { bass: 'one held chord' } });
    expect(result.failures).toEqual([]);
    expect(result.notes).toEqual(['b has no bass: one held chord']);
  });
});

describe('voiced lines', () => {
  const list = (lines) => JSON.stringify({ version: 1, model: 'eleven_v4_turbo', lines, conversations: { 'gus.first': Object.keys(lines) } });
  const voiced = (files) => withManifest((m) => { m.voice = { lines: 'voice/voice.json', model: 'eleven_v4_turbo' }; }, files);

  test('every listed clip is there with a rising letter time per character, and its files count as listed', () => {
    const root = voiced({
      'public/assets/voice/voice.json': list({ 'gus|Hoe.': { file: 'voice/gus/abc.mp3', seconds: 1.2, reveal: [100, 200, 300, 300] } }),
      'public/assets/voice/gus/abc.mp3': 'mp3',
    });
    expect(checkVoice(root, JSON.parse(fs.readFileSync(path.join(root, 'public/assets/manifest.json'), 'utf8')))).toEqual({ failures: [], detail: '1 clip, 0.0 minutes, model eleven_v4_turbo' });
    expect(checkManifest(root).warnings).toEqual([]);
  });

  test('a missing clip, a clip nobody lists, and letter times that do not fit the text fail', () => {
    const root = voiced({
      'public/assets/voice/voice.json': list({ 'gus|Hoe.': { file: 'voice/gus/gone.mp3', seconds: 1.2, reveal: [100, 50] } }),
      'public/assets/voice/gus/old.mp3': 'mp3',
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/assets/manifest.json'), 'utf8'));
    expect(checkVoice(root, manifest).failures).toEqual([
      'voice/voice.json: the clip of "gus|Hoe." (voice/gus/gone.mp3) is missing.',
      'voice/voice.json: "gus|Hoe." needs one whole, rising millisecond per character of its text in "reveal".',
      'public/assets/voice/gus/old.mp3 is not in voice/voice.json. Run tools/voice.ts, which deletes the clips of lines that are gone.',
    ]);
  });

  test('clips with no list in the manifest fail', () => {
    const root = repoWith({ 'public/assets/voice/gus/abc.mp3': 'mp3' });
    expect(checkVoice(root, goodManifest()).failures).toEqual(['public/assets/voice holds 1 clip but manifest.json has no "voice.lines" to list them.']);
  });
});

describe('file sizes', () => {
  test('a PNG over the limit and a folder over the limit both fail, and the table lists every file', () => {
    const root = repoWith({ 'public/assets/sprites/hero.png': png(64, 96, 3000) });
    const result = checkSizes(root, { png: 2048, folder: 3000 });
    expect(result.failures).toEqual([
      'public/assets/sprites/hero.png is 2.9 KB (64 x 96). One PNG may be 2.0 KB at most.',
      'public/assets is 0.00 MB. The whole folder must stay under 0.00286102294921875 MB.',
    ]);
    expect(result.table.map((line) => line.trim().split(/\s+/)[0])).toEqual(['file', 'sprites/hero.png', 'manifest.json', 'blocks/atlas.png', 'icons/icons.png', 'total']);
    expect(checkSizes(root).failures).toEqual([]);
  });

  test('pngSize reads the header and rejects other bytes', () => {
    expect(pngSize(png(768, 896))).toEqual({ width: 768, height: 896 });
    expect(pngSize(Buffer.from('GIF89a, not a png, padded out to length'))).toBe(null);
  });
});

describe('the command', () => {
  test('a clean repo prints one PASS line per check and a total, and exits 0', () => {
    const { status, out } = run(repoWith());
    expect(status).toBe(0);
    expect(out.split('\n').filter((l) => /^(PASS|FAIL) /.test(l)).map((l) => l.split(/\s+/).slice(0, 2).join(' '))).toEqual([
      'PASS manifest', 'PASS sprite-check', 'PASS names', 'PASS block-tiles', 'PASS props', 'PASS palettes', 'PASS sizes', 'PASS voice',
    ]);
    expect(out).toEndWith('TOTAL PASS: 8 checks, 8 passed, 0 failed, 0 warnings\n');
  });

  test('it exits 1, lists every failure of the first failing check, and only counts the later ones', () => {
    const root = withManifest((m) => {
      m.sprites.hero.sheet = 'sprites/gone.png';
      m.icons.names.stone = [9, 9];
      delete m.blocks.tiles.dirt;
    });
    const { status, out } = run(root);
    expect(status).toBe(1);
    expect(out).toContain('FAILED manifest: 2 failures\n  - sprites.hero.sheet is "sprites/gone.png". No such file in public/assets/.\n  - icons.names.stone: cell [9, 9]');
    expect(out).toContain('Also failing: block-tiles (1). Fix manifest first, or list everything with --all.');
    expect(out).not.toContain('FAILED block-tiles');
    expect(out).toEndWith('TOTAL FAIL: 8 checks, 6 passed, 2 failed, 1 warning. First failure: manifest\n');
    expect(run(root, '--all').out).toContain("FAILED block-tiles: 1 failure\n  - tile 'dirt' (block grass) has no cell in manifest.blocks.tiles");
  });

  test('on this repo it prints a line for each of the eight checks and exits 1 exactly when one says FAIL', () => {
    const result = spawnSync(process.execPath, [script], { cwd: repo, encoding: 'utf8' });
    const lines = result.stdout.split('\n').filter((l) => /^(PASS|FAIL) /.test(l));
    expect(lines.map((l) => l.split(/\s+/)[1])).toEqual(['manifest', 'sprite-check', 'names', 'block-tiles', 'props', 'palettes', 'sizes', 'voice']);
    expect(result.status).toBe(lines.some((l) => l.startsWith('FAIL')) ? 1 : 0);
    expect(result.stdout).toMatch(/\nTOTAL (PASS|FAIL): 8 checks, \d passed, \d failed, \d+ warnings?(\. First failure: [a-z-]+)?\n$/);
  });
});
