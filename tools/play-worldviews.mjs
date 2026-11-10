// Checks the world views (src/game/views/world-*.view.ts): builds the game, serves it on port 5331, opens
// it in headless Chrome and plays through the debug door (window.__game). It farms a small field, sets
// down the three stations, picks a berry bush, floats the festival lamps, and saves screenshots to
// .artifacts/play/ as wv-*.png, with the numbers in .artifacts/play/worldviews.json.
//   bun tools/play-worldviews.mjs [--no-build] [--dist dist] [--quality low|medium|high] [--w 1280] [--h 800]
// `--dist <folder>` builds into and serves another folder, so two agents do not write the same dist.
// It fails on a console error or a failed check. This Mac draws WebGL in software, so it checks what is
// drawn and counts draw calls, never frames a second.
//
// When the game has no region system (it was left out, or its install threw), the script stands a small
// region of its own by the nearest water: a river bank, two berry bushes, a few town props. The views that
// need a region still show, and the output says which region was used.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/play');
const dist = opt('dist', 'dist');
const PORT = 5331;
mkdirSync(out, { recursive: true });

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['run', 'build', ...(dist === 'dist' ? [] : ['--outDir', dist, '--emptyOutDir'])], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error('FAIL: bun run build'); process.exit(1); }
}

// The server prints its pid, and it is stopped by that pid, never by port.
const server = spawn('bun', ['tools/serve.mjs', dist, String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => {
    text += chunk;
    const pid = /pid (\d+)/.exec(text);
    if (pid) done(Number(pid[1]));
  });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});
console.log(`serving ${dist} on http://127.0.0.1:${PORT}/  pid ${serverPid}`);
// An interrupted run still stops its own server.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    try { process.kill(serverPid); } catch { /* already gone */ }
    process.exit(130);
  });
}

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const errors = [];
const numbers = {};
let browser;

/** Runs in the page before anything else: small helpers the steps below share, kept on `window.__wv`. */
function helpers() {
  const g = window.__game, view = g.view, game = view.game, sim = view.world.sim;
  const wv = (window.__wv = {});
  const blockKey = (x, y, z) => g.block(x, y, z).key;
  /** The top block of a column: the one a foot stands on. */
  wv.ground = (x, z) => sim.heightAt(x + 0.5, z + 0.5) - 1;
  /** Finds a flat rectangle of grass under open air near a point. Returns its corner and ground height. */
  wv.flat = (cx, cz, wide, deep, taken = []) => {
    for (let r = 2; r < 40; r++) {
      for (let ox = -r; ox <= r; ox++) for (let oz = -r; oz <= r; oz++) {
        if (Math.max(Math.abs(ox), Math.abs(oz)) !== r) continue;
        const x0 = Math.floor(cx) + ox, z0 = Math.floor(cz) + oz, y = wv.ground(x0, z0);
        let ok = true;
        // One block of margin all round, so the player can stand beside it.
        for (let x = x0 - 1; ok && x <= x0 + wide; x++) for (let z = z0 - 1; ok && z <= z0 + deep; z++) {
          ok = wv.ground(x, z) === y && blockKey(x, y, z) === 'grass' && blockKey(x, y + 1, z) === 'air' && blockKey(x, y + 2, z) === 'air'
            && !taken.some((t) => x >= t.x - 2 && x <= t.x + t.wide + 1 && z >= t.z - 2 && z <= t.z + t.deep + 1);
        }
        if (ok) return { x: x0, y, z: z0, wide, deep };
      }
    }
    return null;
  };
  /** Holds an item: gives it when the bag has none, and selects its quick slot. */
  wv.hold = (item, count = 1) => {
    const inventory = game.systems.inventory;
    if (inventory.count(item) < count) g.give(item, count - inventory.count(item));
    let slot = inventory.slots.findIndex((s) => s && s.id === item);
    if (slot > 8) { inventory.move(slot, 8); slot = 8; }
    // Not through the digit keys: the script holds the clock, and the shell drops key presses while it is held.
    inventory.selected = slot;
    return inventory.held()?.id === item;
  };
  /** Uses the held item on the top of a ground block. */
  wv.use = (x, y, z) => g.click('secondary', x, y, z).used;
  wv.props = () => ({ ...(view.scene.getObjectByName('props')?.userData.stats ?? {}) });
  /** The draw calls of one frame with and without the props, from the renderer's own count. */
  wv.propCalls = async () => {
    const group = view.scene.getObjectByName('props');
    await g.frames(2);
    const withProps = g.counters().drawCalls;
    if (group) group.visible = false;
    await g.frames(2);
    const without = g.counters().drawCalls;
    if (group) group.visible = true;
    await g.frames(1);
    return { frame: withProps, props: withProps - without, triangles: g.counters().triangles, counted: wv.props(), heaviest: wv.heaviest() };
  };
  /** The five kinds of prop that cost the most triangles in view now. */
  wv.heaviest = () => {
    const group = view.scene.getObjectByName('props');
    const rows = (group?.children ?? []).filter((m) => m.visible && m.count > 0).map((m) => {
      const g0 = m.geometry, each = (g0.index ? g0.index.count : g0.attributes.position.count) / 3;
      return { name: m.name, count: m.count, triangles: Math.round(each * m.count) };
    });
    return rows.sort((a, b) => b.triangles - a.triangles).slice(0, 5).map((r) => `${r.name} x${r.count} = ${r.triangles}`);
  };
  /** How many copies of a prop are drawn now, by its kind and variant. */
  wv.copies = (name) => view.scene.getObjectByName('props')?.children.find((m) => m.name === `props:${name}`)?.count ?? 0;
  /** Noon on a clear, still day, so a picture shows the thing and not the weather. */
  wv.noon = () => {
    g.setTime(0.45);
    game.systems.time?.setWeather('clear');
    g.advance(0.2);
  };
  /** Holds the view's clock at one moment (or lets it run again with no argument), so a short motion can be photographed. */
  wv.freeze = (time) => {
    if (time === undefined) {
      const now = view.ctx.time;
      Object.defineProperty(view.ctx, 'time', { value: now, writable: true, configurable: true, enumerable: true });
    } else {
      Object.defineProperty(view.ctx, 'time', { get: () => time, set: () => {}, configurable: true, enumerable: true });
    }
  };
  /** The rows of the crops mesh: for each plant its place, its tile and when it last grew. */
  wv.plants = () => {
    const mesh = view.scene.getObjectByName('crops');
    if (!mesh) return null;
    const data = mesh.geometry.attributes.aPlace?.data?.array, count = mesh.geometry.instanceCount ?? 0;
    const rows = [];
    for (let i = 0; data && i < count; i++) rows.push(Array.from(data.subarray(i * 10, i * 10 + 10)));
    return { visible: mesh.visible, count, rows, wet: view.scene.getObjectByName('wet-soil')?.geometry.instanceCount ?? 0 };
  };
  /** A small region for when the game has none yet: places by the spawn pond, two bushes, a few town props. */
  wv.fakeRegion = () => {
    const p = game.player.pos;
    // The widest water in the loaded land: the column with the most water in the nine by nine around it.
    let water = null, best = 0;
    const wet = (x, z) => sim.isLoaded(x, z) && sim.surfaceAt(x, z) === 'water';
    for (let ox = -80; ox <= 80; ox += 2) for (let oz = -80; oz <= 80; oz += 2) {
      const x = Math.floor(p.x) + ox + 0.5, z = Math.floor(p.z) + oz + 0.5;
      if (!wet(x, z)) continue;
      let score = 0;
      for (let ax = -4; ax <= 4; ax++) for (let az = -4; az <= 4; az++) if (wet(x + ax, z + az)) score++;
      if (score > best) { best = score; water = { x, z }; }
    }
    const lawn = wv.flat(p.x + 6, p.z - 6, 7, 3) ?? { x: Math.floor(p.x) + 4, y: wv.ground(Math.floor(p.x) + 4, Math.floor(p.z) - 6), z: Math.floor(p.z) - 6 };
    // The bank is the land nearest that water.
    let bank = { x: p.x, y: p.y, z: p.z }, near = Infinity;
    for (let ox = -12; water && ox <= 12; ox++) for (let oz = -12; oz <= 12; oz++) {
      const x = water.x + ox, z = water.z + oz, d = ox * ox + oz * oz;
      if (d < near && sim.isLoaded(x, z) && !wet(x, z)) { near = d; bank = { x, y: sim.heightAt(x, z), z }; }
    }
    const top = lawn.y + 1;
    const bushes = [{ id: 'bush:0', x: lawn.x + 1.5, y: top, z: lawn.z + 1.5, ripe: true }, { id: 'bush:1', x: lawn.x + 3.5, y: top, z: lawn.z + 1.5, ripe: true }];
    const alone = { rotation: 0, scale: 1, quarterTurns: 0, building: '' };
    const props = [
      { kind: 'lampPost', variant: 0, x: lawn.x + 5.5, y: top, z: lawn.z + 0.5, ...alone },
      { kind: 'bench', variant: 0, x: lawn.x + 5.5, y: top, z: lawn.z + 2.5, ...alone },
      { kind: 'barrel', variant: 0, x: lawn.x + 6.6, y: top, z: lawn.z + 1.5, ...alone },
    ];
    const places = [{ name: 'river.bank', at: bank, label: 'Bank' }, { name: 'lawn', at: { x: lawn.x + 3.5, y: top, z: lawn.z + 3.5 }, label: '' }];
    const fake = {
      fake: true,
      spawn: () => ({ ...p }),
      places: () => places,
      place: (name) => { const found = places.find((q) => q.name === name); if (!found) throw new Error(`no place called ${name}`); return found; },
      grant: () => ({ x: Math.floor(p.x) - 14, z: Math.floor(p.z) - 14, width: 28, depth: 28 }),
      isProtected: () => false,
      berryBushes: () => bushes,
      props: () => props,
      scatter: () => ({ density: 1, blocked: (x, z) => x >= lawn.x + 4.5 && x <= lawn.x + 7.5 && z >= lawn.z && z <= lawn.z + 3.5 }),
    };
    game.systems.region = fake;
    return { lawn, bank };
  };
}

try {
  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const width = Number(opt('w', 1280)), height = Number(opt('h', 800));
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  page.setDefaultTimeout(240000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const game = (js, arg) => page.evaluate(js, arg);
  /** Draws a few frames and saves the picture. `zoom` cuts the middle out, where the player stands. */
  const shot = async (name, zoom = 1) => {
    await game(() => window.__game.frames(3));
    const w = Math.round(width / zoom), h = Math.round(height / zoom);
    await page.screenshot({ path: resolve(out, name), clip: { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), width: w, height: h } });
    console.log(`     wrote .artifacts/play/${name}`);
  };
  const url = `http://127.0.0.1:${PORT}/?hold=1&quality=${opt('quality', 'high')}`;

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await game(() => { localStorage.clear(); window.__game.newGame(); });
  await game(() => window.__game.settle());
  await game(helpers);
  const start = await game(() => { window.__game.manual(true); return window.__game.state(); });
  check('a new game started with the crops and placeables systems', start.started && start.systems.includes('crops') && start.systems.includes('placeables'), start.systems.join(', '));
  const realRegion = start.systems.includes('region');
  let fake = null;
  if (!realRegion) {
    fake = await game(() => window.__wv.fakeRegion());
    console.log(`     the game has no region yet, so the script stands its own: a lawn at ${fake.lawn.x}, ${fake.lawn.z} and a bank at ${fake.bank.x}, ${fake.bank.z}`);
  }
  numbers.region = realRegion ? 'the game\'s' : 'the script\'s stand-in';

  // ------------------------------------------------------------------ the field: dry soil, wet soil, four stages
  const field = await game(() => {
    const g = window.__game, wv = window.__wv, p = g.state().player;
    const spot = wv.flat(p.x, p.z, 5, 4);
    if (!spot) return null;
    // Stand just south of the field at noon on a clear day.
    g.teleport(spot.x + 2.5, spot.z + spot.deep + 1.5);
    wv.noon();
    wv.hold('hoe');
    let tilled = 0;
    for (let x = spot.x; x < spot.x + spot.wide; x++) for (let z = spot.z; z < spot.z + spot.deep; z++) if (wv.use(x, spot.y, z)) tilled++;
    // Water the left half only: the can wets three by three, so aim at the second column.
    wv.hold('watering_can');
    const watered = wv.use(spot.x + 1, spot.y, spot.z + 1) && wv.use(spot.x + 1, spot.y, spot.z + 2);
    g.advance(0.2);
    g.view.camera.zoomBy(-1);
    g.view.camera.zoomBy(-1);
    return { spot, tilled, watered };
  });
  check('a flat field was found and tilled', field && field.tilled === 20, JSON.stringify(field));
  await shot('wv-01-soil-wet-left-dry-right.png', 2);
  const soil = await game(() => window.__wv.plants());
  check('wet soil with no crop gets a patch', soil && soil.wet === 12 && soil.count === 0, `${soil?.wet} patches, ${soil?.count} plants`);

  // Plant one column at a time, 45 seconds apart, so the four stages stand side by side at the end.
  const stages = [];
  for (let column = 0; column < 4; column++) {
    stages.push(await game(({ spot, column }) => {
      const g = window.__game, wv = window.__wv, crops = g.view.game.systems.crops;
      wv.hold('wheat_seeds', 20);
      let planted = 0;
      for (let z = spot.z; z < spot.z + spot.deep; z++) if (wv.use(spot.x + column, spot.y, z)) planted++;
      // Keep the whole field wet: both halves, every round.
      wv.hold('watering_can');
      for (const x of [spot.x + 1, spot.x + 3]) for (const z of [spot.z + 1, spot.z + 2]) wv.use(x, spot.y, z);
      if (column < 3) g.advance(45);
      else g.advance(0.2);
      return { planted, stages: [0, 1, 2, 3].map((c) => crops.at(spot.x + c, spot.y, spot.z)?.stage ?? null) };
    }, { spot: field.spot, column }));
    if (column === 0) await shot('wv-02-crops-first-column.png', 2);
  }
  // The story rains on the day the wheat goes in. The pictures want a clear sky.
  await game(() => window.__wv.noon());
  const last = stages[3];
  check('four columns were planted', stages.every((s) => s.planted === 4), JSON.stringify(stages.map((s) => s.planted)));
  check('the columns stand at stages 3, 2, 1 and 0', JSON.stringify(last.stages) === '[3,2,1,0]', JSON.stringify(last.stages));
  await shot('wv-03-crops-four-stages.png', 2);
  const plants = await game(() => window.__wv.plants());
  const tilesUsed = new Set(plants.rows.map((r) => r[4].toFixed(3)));
  check('every crop is one instance of one mesh', plants.count === 16 && plants.visible, `${plants.count} plants, ${plants.wet} wet patches`);
  check('each stage has its own tile', tilesUsed.size === 4, [...tilesUsed].join(' '));
  check('a plant stands in the middle of the block above its soil', plants.rows.every((r) => Math.abs(r[0] % 1) === 0.5 && Math.abs(r[2] % 1) === 0.5 && r[1] === field.spot.y + 1), JSON.stringify(plants.rows[0].slice(0, 3)));

  // The pop: grow the last column one stage, then hold the view's clock in the middle of the 0.2 seconds.
  const pop = await game(async ({ spot }) => {
    const g = window.__game, wv = window.__wv;
    g.advance(45);
    await g.frames(1);
    const rows = wv.plants().rows;
    const grew = Math.max(...rows.map((r) => r[6]));
    const now = g.view.ctx.time;
    wv.freeze(grew + 0.1);
    return { grew, now, popping: rows.filter((r) => r[6] === grew).length, stage: g.view.game.systems.crops.at(spot.x + 3, spot.y, spot.z)?.stage };
  }, { spot: field.spot });
  check('a crop that grows is marked to pop', pop.popping >= 4 && pop.now - pop.grew < 0.5, `${pop.popping} plants grew at ${pop.grew.toFixed(2)}, now ${pop.now.toFixed(2)}`);
  await shot('wv-04-crops-pop-mid.png', 2);
  await game(() => window.__wv.freeze());
  await shot('wv-05-crops-after-pop.png', 2);

  // Wind: the same field at two moments of a strong wind.
  await game(() => { const g = window.__game; g.view.game.ambient.wind = 1; window.__wv.freeze(100); });
  await shot('wv-06-crops-wind-a.png', 2);
  await game(() => window.__wv.freeze(101.2));
  await shot('wv-07-crops-wind-b.png', 2);
  await game(() => window.__wv.freeze());

  // Dry out: three minutes on, the patches go. Then harvest the ripe column and see it leave the mesh.
  const dry = await game(({ spot }) => {
    const g = window.__game;
    g.advance(185);
    return { wetCrops: g.view.game.systems.crops.all().filter((c) => c.state.wet > 0).length };
  }, { spot: field.spot });
  await game(() => window.__game.frames(2));
  const dried = await game(() => window.__wv.plants());
  check('dry soil loses its patch', dry.wetCrops === 0 && dried.wet === 0, `${dry.wetCrops} wet crops, ${dried.wet} patches`);
  await shot('wv-08-crops-dry.png', 2);
  const harvest = await game(({ spot }) => {
    const g = window.__game;
    let picked = 0;
    for (let z = spot.z; z < spot.z + spot.deep; z++) if (g.click('primary', spot.x, spot.y, z).used) picked++;
    g.advance(0.1);
    return { picked, left: g.view.game.systems.crops.all().length };
  }, { spot: field.spot });
  await game(() => window.__game.frames(2));
  const after = await game(() => window.__wv.plants());
  check('a harvested crop leaves the mesh', harvest.picked === 4 && after.count === harvest.left, `${harvest.picked} picked, ${after.count} drawn of ${harvest.left}`);
  await shot('wv-09-crops-harvested.png', 2);

  // ------------------------------------------------------------------ the three stations
  const stations = await game(({ spot }) => {
    const g = window.__game, wv = window.__wv, placeables = g.view.game.systems.placeables;
    const yard = wv.flat(spot.x + 2, spot.z + spot.deep + 6, 7, 3, [spot]);
    if (!yard) return null;
    g.teleport(yard.x + 3.5, yard.z + yard.deep + 1.5);
    wv.noon();
    const placed = [];
    // A station turns its front toward the player, so the player looks a different way for each: north, east, west.
    const plan = [['workbench', yard.x + 1, yard.z + 1, 0], ['chest', yard.x + 3, yard.z + 1, Math.PI / 2], ['bed', yard.x + 5, yard.z + 1, -Math.PI / 2]];
    for (const [kind, x, z, facing] of plan) {
      wv.hold(kind);
      g.view.game.player.facing = facing;
      const used = wv.use(x, yard.y, z);
      const at = placeables.at(x, yard.y + 1, z);
      placed.push({ kind, used, id: at?.id ?? null, turns: at?.quarterTurns ?? null, block: g.block(x, yard.y + 1, z).key });
    }
    g.advance(0.2);
    return { yard, placed };
  }, { spot: field.spot });
  check('the three stations were placed', stations && stations.placed.every((p) => p.used && p.id), JSON.stringify(stations?.placed));
  check('a station fills its cell with the barrier block', stations.placed.every((p) => p.block === 'barrier'), stations.placed.map((p) => p.block).join(', '));
  check('the stations face south, west and east', JSON.stringify(stations.placed.map((p) => p.turns)) === '[2,3,1]', JSON.stringify(stations.placed.map((p) => p.turns)));
  await shot('wv-10-stations.png', 2);
  const drawnStations = await game(() => ['workbench:0', 'chest:0', 'bed:0'].map((name) => window.__wv.copies(name)));
  check('each station has a prop', JSON.stringify(drawnStations) === '[1,1,1]', `workbench, chest, bed: ${drawnStations.join(', ')}`);

  // A station stops the player: walk straight at the chest and see that the body never enters its block.
  // The camera looks along a diagonal, so W walks along one too. The walk is measured first, then aimed.
  const bump = await game(({ yard }) => {
    const g = window.__game, cx = yard.x + 3.5, cz = yard.z + 1.5;
    g.teleport(cx, yard.z + 6.5);
    g.advance(0.2);
    const a = g.state().player;
    g.key('w', true); g.advance(0.4); g.key('w', false);
    const b = g.state().player;
    const far = Math.hypot(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / far, dz = (b.z - a.z) / far;
    // Start two and a half blocks before the chest on that line, and walk three seconds.
    g.teleport(cx - dx * 2.5, yard.y + 1, cz - dz * 2.5);
    g.advance(0.2);
    let inside = 0, steps = 0;
    g.key('w', true);
    for (; steps < 60; steps++) {
      g.advance(0.05);
      const p = g.state().player;
      if (p.x > yard.x + 3 && p.x < yard.x + 4 && p.z > yard.z + 1 && p.z < yard.z + 2 && p.y < yard.y + 2) inside++;
    }
    g.key('w', false);
    const end = g.state().player;
    return { walked: far, inside, end: [end.x, end.y, end.z], chest: [yard.x + 3, yard.y + 1, yard.z + 1] };
  }, { yard: stations.yard });
  check('the barrier keeps the player out of a station\'s block', bump.walked > 1 && bump.inside === 0,
    `W walks ${bump.walked.toFixed(2)} blocks in 0.4 seconds. Walking at the chest at ${bump.chest.join(', ')}: ${bump.inside} of 60 steps inside its block, ended at ${bump.end.map((v) => v.toFixed(2)).join(', ')}`);

  // Take the chest back: its prop goes without any event.
  const taken = await game(({ yard }) => {
    const g = window.__game;
    g.teleport(yard.x + 3.5, yard.z + yard.deep + 1.5);
    g.advance(0.2);
    const result = g.click('primary', yard.x + 3, yard.y + 1, yard.z + 1);
    g.advance(0.2);
    return { result, left: g.view.game.systems.placeables.all().length, block: g.block(yard.x + 3, yard.y + 1, yard.z + 1).key };
  }, { yard: stations.yard });
  await game(() => window.__game.frames(2));
  const afterTake = await game(() => window.__wv.copies('chest:0'));
  check('a station taken back loses its prop', taken.left === 2 && afterTake === 0 && taken.block === 'air', `${taken.left} stations, ${afterTake} chest props, the cell is ${taken.block}`);
  await shot('wv-11-stations-chest-taken.png', 2);

  // ------------------------------------------------------------------ the land: scatter, bushes, the region's props
  const land = await game(async () => {
    const g = window.__game, wv = window.__wv, region = g.view.game.systems.region;
    const bushes = region?.berryBushes?.() ?? [];
    wv.noon();
    await g.frames(3);
    return { bushes: bushes.length, first: bushes[0] ? { x: bushes[0].x, y: bushes[0].y, z: bushes[0].z } : null, regionProps: region?.props?.().length ?? 0 };
  });
  numbers.bushes = land.bushes;
  if (land.first) {
    await game(async ({ x, z }) => {
      const g = window.__game;
      // Stand behind the bush as the camera sees it, so the hero does not cover it.
      g.teleport(Math.floor(x) - 0.5, Math.floor(z) - 0.5);
      g.view.camera.zoomBy(-1); g.view.camera.zoomBy(-1);
      g.advance(0.3);
      await g.settle();
    }, land.first);
    const ripe = await game(() => ({ withBerries: window.__wv.copies('berryBush:0'), prompt: window.__game.state().prompt }));
    check('a bush with berries is drawn as a berry bush', ripe.withBerries >= 1, JSON.stringify(ripe));
    await shot('wv-12-bush-with-berries.png', 2);
    const picked = await game(({ fake }) => {
      const g = window.__game, region = g.view.game.systems.region;
      const before = g.state().bag.find((s) => s.id === 'berry')?.count ?? 0;
      if (fake) { for (const bush of region.berryBushes()) bush.ripe = false; }
      else { g.interact(); g.advance(0.3); }
      return { before, after: g.state().bag.find((s) => s.id === 'berry')?.count ?? 0, prompt: g.state().prompt };
    }, { fake: !realRegion });
    if (realRegion) check('E at a bush picks berries', picked.after > picked.before, `${picked.before} to ${picked.after} berries`);
    await shot('wv-13-bush-picked.png', 2);
    const swapped = await game(() => ({ withBerries: window.__wv.copies('berryBush:0'), plain: window.__wv.copies('bush:0') }));
    check('a picked bush is drawn without berries', swapped.withBerries < ripe.withBerries && swapped.plain >= 1, `berry bushes in view: ${ripe.withBerries} before, ${swapped.withBerries} after`);
  } else {
    console.log('     the region lists no berry bushes, so the bush pictures are skipped');
  }

  if (!realRegion) {
    await game(({ lawn }) => { const g = window.__game; g.teleport(lawn.x + 5.5, lawn.z + 4.5); g.advance(0.3); }, fake);
    await shot('wv-14-region-props.png', 2);
  } else {
    const town = await game(() => { const g = window.__game; const at = g.teleport('town.square'); window.__wv.noon(); return at; });
    if (town) {
      await game(() => window.__game.settle());
      await game(() => window.__game.frames(6));
      await shot('wv-14-town-square.png');
      await game(() => { for (let i = 0; i < 4; i++) window.__game.view.camera.zoomBy(1); });
      await game(() => window.__game.settle());
      await game(() => window.__game.frames(6));
      await shot('wv-14b-town-wide.png');
      numbers.town = await game(() => window.__wv.propCalls());
      check('the town stays inside 40 draw calls for props', numbers.town.props <= 40,
        `the renderer drew ${numbers.town.props} calls for props of ${numbers.town.frame} in the frame, ${numbers.town.counted.drawn} props in view`);
    }
  }

  // The wide view: zoom all the way out at the start. Every tree is a block tree of the terrain, which can be
  // cut. The props draw none, so no smooth tree stands among them.
  const wide = await game(async () => {
    const g = window.__game, wv = window.__wv, group = g.view.scene.getObjectByName('props');
    const at = g.teleport('spawn');
    for (let i = 0; i < 4; i++) g.view.camera.zoomBy(1);
    wv.noon();
    await g.settle();
    await g.frames(8);
    const propTrees = group.children.filter((m) => /^props:(oak|birch|pine):/.test(m.name) && m.count > 0);
    let blockTrees = 0;
    for (let x = Math.floor(at.x) - 30; x <= Math.floor(at.x) + 30; x++) for (let z = Math.floor(at.z) - 30; z <= Math.floor(at.z) + 30; z++) {
      for (let y = Math.floor(at.y) - 4; y <= Math.floor(at.y) + 4; y++) if (/_log$/.test(g.block(x, y, z).key)) { blockTrees++; break; }
    }
    const modelTrees=g.view.game.systems.trees.all().filter(t=>t.standing&&Math.hypot(t.x-at.x,t.z-at.z)<30).length;
    return { at, modelTrees, blockTrees, propTrees: propTrees.map((m) => `${m.name} x${m.count}`), calls: await wv.propCalls() };
  });
  numbers.wide = wide.calls;
  check('model trees stand near the start, without block trees', wide.modelTrees >= 5 && wide.blockTrees === 0 && wide.propTrees.length === 0, `${wide.modelTrees} model trees; ${wide.blockTrees} block trees within 30 blocks`);
  check('the props stay inside 40 draw calls', wide.calls.props <= 40 && wide.calls.counted.drawCalls + wide.calls.counted.shadowCalls <= 40,
    `the renderer drew ${wide.calls.props} calls for props of ${wide.calls.frame} in the frame. Counted: ${wide.calls.counted.drawCalls} kinds and ${wide.calls.counted.shadowCalls} for shadows, ${wide.calls.counted.drawn} props in view`);
  console.log(`     triangles: ${wide.calls.triangles} in the frame, ${wide.calls.counted.triangles} of them props and their shadows. Heaviest: ${wide.calls.heaviest.join('; ')}`);
  await shot('wv-15-wide-with-trees.png');

  // Back at the field from far: the crops and stations are still there in the wide view.
  await game(({ spot }) => { const g = window.__game; g.teleport(spot.x + 2.5, spot.z + spot.deep + 3.5); window.__wv.noon(); }, { spot: field.spot });
  await game(() => window.__game.settle());
  await shot('wv-16-wide-farm.png');
  numbers.farm = await game(() => window.__wv.propCalls());
  check('the farm stays inside 40 draw calls for props', numbers.farm.props <= 40, `the renderer drew ${numbers.farm.props} calls for props of ${numbers.farm.frame} in the frame`);

  // A changed block takes the scatter off it: till the block under a grass tuft and look for the tuft.
  const cleared = await game(async () => {
    const g = window.__game, wv = window.__wv, group = g.view.scene.getObjectByName('props');
    /** Grass tufts drawn in one column. */
    const tuftsAt = (x, z) => {
      let n = 0;
      for (const m of group.children) {
        if (!/^props:grassTuft:/.test(m.name)) continue;
        for (let i = 0; i < m.count; i++) if (Math.floor(m.instanceMatrix.array[i * 16 + 12]) === x && Math.floor(m.instanceMatrix.array[i * 16 + 14]) === z) n++;
      }
      return n;
    };
    // The tuft nearest the player, but not under their feet.
    const p = g.state().player;
    let best = Infinity, x = 0, z = 0;
    for (const m of group.children) {
      if (!/^props:grassTuft:/.test(m.name)) continue;
      for (let i = 0; i < m.count; i++) {
        const tx = m.instanceMatrix.array[i * 16 + 12], tz = m.instanceMatrix.array[i * 16 + 14], d = Math.hypot(tx - p.x, tz - p.z);
        if (d < best && d > 2 && g.block(Math.floor(tx), wv.ground(Math.floor(tx), Math.floor(tz)), Math.floor(tz)).key === 'grass') { best = d; x = Math.floor(tx); z = Math.floor(tz); }
      }
    }
    if (best === Infinity) return null;
    const before = tuftsAt(x, z);
    wv.hold('hoe');
    const used = wv.use(x, wv.ground(x, z), z);
    g.advance(0.1);
    await g.frames(3);
    return { x, z, used, before, after: tuftsAt(x, z), block: g.block(x, wv.ground(x, z), z).key };
  });
  if (cleared) check('tilling a block takes the grass tuft off it', cleared.used && cleared.before >= 1 && cleared.after === 0, JSON.stringify(cleared));

  // The heaviest place for props: the dead garden's wood, at the widest zoom.
  const dense = await game(async () => {
    const g = window.__game, wv = window.__wv;
    if (!g.teleport('dead.garden')) return null;
    wv.noon();
    await g.settle();
    await g.frames(8);
    return wv.propCalls();
  });
  if (dense) {
    numbers.deadGarden = dense;
    check('the dead garden stays inside 40 draw calls for props and 400,000 triangles', dense.props <= 40 && dense.triangles <= 400000,
      `${dense.props} calls for props of ${dense.frame}, ${dense.triangles} triangles in the frame, ${dense.counted.triangles} of them props. Heaviest: ${dense.heaviest.join('; ')}`);
    await shot('wv-16b-dead-garden-wide.png');
  }

  // ------------------------------------------------------------------ the festival lamps
  const bank = await game(async () => {
    const g = window.__game, game = g.view.game;
    const at = g.teleport('river.bank');
    if (!at) return null;
    g.advance(0.3);
    await g.settle();
    for (let i = 0; i < 4; i++) g.view.camera.zoomBy(-1);
    g.view.camera.zoomBy(1);
    g.setTime(0.74);
    game.systems.time.setWeather('clear');
    // What the story does when the player floats a lamp, and when the festival starts.
    game.flags.set('festival.lamp', true);
    game.flags.add('festival.lamps', 1);
    g.advance(3);
    await g.frames(2);
    const one = g.view.scene.getObjectByName('river-lamps')?.count ?? 0;
    game.flags.set('festival.started', true);
    game.events.emit('festival.started', {});
    g.advance(60);
    await g.frames(2);
    const mesh = g.view.scene.getObjectByName('river-lamps');
    const spots = [];
    for (let i = 0; mesh && i < mesh.count; i++) spots.push([mesh.instanceMatrix.array[i * 16 + 12], mesh.instanceMatrix.array[i * 16 + 13], mesh.instanceMatrix.array[i * 16 + 14]]);
    const onWater = spots.filter(([x, , z]) => g.view.world.sim.surfaceAt(x, z) === 'water').length;
    return { at, one, all: mesh?.count ?? 0, onWater, spots };
  });
  if (bank) {
    check('the player\'s lamp floats when the flag is set', bank.one === 1, `${bank.one} lamp`);
    check('the town floats a dozen more during the festival', bank.all === 13, `${bank.all} lamps`);
    check('every lamp is on the water', bank.onWater === bank.all, `${bank.onWater} of ${bank.all}`);
    await shot('wv-17-lamps-dusk.png');
    // Two minutes on, deep in the evening, the lamps are still by the bank.
    const late = await game(async ({ at }) => {
      const g = window.__game;
      g.setTime(0.82);
      g.advance(120);
      await g.frames(2);
      const mesh = g.view.scene.getObjectByName('river-lamps');
      let near = 0;
      for (let i = 0; i < mesh.count; i++) if (Math.hypot(mesh.instanceMatrix.array[i * 16 + 12] - at.x, mesh.instanceMatrix.array[i * 16 + 14] - at.z) < 16) near++;
      return { near, all: mesh.count };
    }, { at: bank.at });
    check('the lamps stay near the bank through the evening', late.near >= 10, `${late.near} of ${late.all} within 16 blocks of the bank three minutes after the first`);
    await shot('wv-18-lamps-night.png');
    numbers.lamps = await game(() => {
      const scene = window.__game.view.scene;
      return { lamps: scene.getObjectByName('river-lamps').count, drawCalls: ['river-lamps', 'river-lamp-glow'].filter((name) => scene.getObjectByName(name).visible).length };
    });
  } else {
    console.log('     the region has no place called river.bank, so the lamp pictures are skipped');
  }

  // ------------------------------------------------------------------ a saved game draws the same things
  const saved = await game(({ spot }) => {
    const g = window.__game;
    g.teleport(spot.x + 2.5, spot.z + spot.deep + 3.5);
    window.__wv.noon();
    return { ok: g.save(), crops: g.view.game.systems.crops.all().length, stations: g.view.game.systems.placeables.all().length };
  }, { spot: field.spot });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await game(() => window.__game.continueGame());
  await game(() => window.__game.settle());
  await game(helpers);
  await game(async () => { const g = window.__game; g.manual(true); g.view.camera.zoomBy(-1); await g.frames(4); });
  const again = await game(() => ({ plants: window.__wv.plants().count, props: window.__wv.props(), stations: window.__game.view.game.systems.placeables.all().length, errors: window.__game.state().viewErrors }));
  check('a loaded game draws its crops without an event', saved.ok && again.plants === saved.crops && again.plants > 0, `${again.plants} plants of ${saved.crops} saved`);
  check('a loaded game draws its stations without an event', again.stations === saved.stations && again.stations === 2, `${again.stations} stations`);
  check('no view listener failed', again.errors.length === 0, again.errors.join('; '));
  await shot('wv-19-continued.png');
  await game(() => localStorage.clear());

  check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (error) {
  check('the script ran to its end', false, String(error?.stack ?? error));
} finally {
  await browser?.close();
  // Stop the server by the pid it printed.
  try { process.kill(serverPid); } catch { /* already gone */ }
}

const failed = checks.filter((c) => !c.pass);
writeFileSync(resolve(out, 'worldviews.json'), JSON.stringify({ at: new Date().toISOString(), numbers, checks, errors }, null, 2));
console.log(`\n${checks.length - failed.length} of ${checks.length} checks passed. Numbers are in .artifacts/play/worldviews.json`);
process.exit(failed.length ? 1 : 0);
