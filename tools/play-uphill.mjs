import { requireBetaHash, verifyRuntime } from './lib/beta-chain.mjs';
// Water uphill from the exact accepted Pump boundary. All actions use browser input.
// PLAY_PORT=5575 bun tools/play-uphill.mjs --save <earned-pump.save.json> --out <new-directory> --active-heavy-jobs 0
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  appendFileSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { firstnightFrame, firstnightIssues, settleDialogue } from './lib/firstnight-framing.mjs';
import { createKeyboardSteering } from './lib/keyboard-steering.mjs';
import { launchChrome } from './lib/chrome.mjs';
import { CAMP } from '../src/game/content/region.ts';
import { observeUphillTransactions } from './uphill-observation.mjs';
import { sample, canStartHeavy } from './resource-status.mjs';
import { createHash } from 'node:crypto';

// A running or interrupted attempt is always BLOCKED, even if cleanup flushes again.
export function createPumpJournal(out, describe) {
  let complete = false, interrupted = null;
  const flush = () => {
    const state = describe();
    const report = { ...state, interrupted, status: complete && !state.failure && !interrupted ? 'PASS' : 'BLOCKED' };
    const temporary = resolve(out, 'replay.json.tmp');
    writeFileSync(temporary, JSON.stringify(report, null, 2));
    renameSync(temporary, resolve(out, 'replay.json'));
    return report;
  };
  return {
    flush,
    interrupt(signal) { interrupted = signal; return flush(); },
    complete() { complete = true; return flush(); },
    get interrupted() { return interrupted; },
  };
}

// Vite's assetsDir is nested. Hash the emitted runtime files by their served paths.
export function pumpBuildHashes(directory) {
  const files = [];
  const visit = (relative = '') => {
    for (const entry of readdirSync(resolve(directory, relative), { withFileTypes: true })) {
      const path = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && /\.(js|css|html)$/.test(entry.name)) files.push(path);
    }
  };
  visit();
  if (!files.some((path) => path.endsWith('.js')) || !files.some((path) => path.endsWith('.css')))
    throw Error('build provenance requires nonempty emitted JS and CSS lists');
  return Object.fromEntries(files.sort().map((path) => [path,
    createHash('sha256').update(readFileSync(resolve(directory, path))).digest('hex'),
  ]));
}

export async function stopPumpChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((done, fail) => {
    let timeout;
    const finish = (error) => {
      clearTimeout(timeout);
      child.removeListener('exit', exited);
      child.removeListener('error', failed);
      error ? fail(error) : done();
    };
    const exited = () => finish(), failed = (error) => finish(error);
    child.once('exit', exited);
    child.once('error', failed);
    child.kill('SIGTERM');
    timeout = setTimeout(() => child.kill('SIGKILL'), 2000);
  });
}

// The combat pointer intersects the hero-foot plane, even on sloping terrain.
export function pumpAimPoint([x, z]) {
  const view = window.__game.view;
  return view.project(x, view.playerPosition.y, z);
}

if (import.meta.main) {
const root = resolve(import.meta.dirname, '..');
const outIndex = process.argv.indexOf('--out');
if (outIndex < 0 || !process.argv[outIndex + 1] || process.argv[outIndex + 1].startsWith('--')) {
  throw new Error('--out requires an evidence directory');
}
const out = resolve(root, process.argv[outIndex + 1]);
if (existsSync(out) && readdirSync(out).length)
  throw Error('Choose an empty --out directory to preserve prior evidence');

const port = Number(process.env.PLAY_PORT || 5575);
const activeIndex = process.argv.indexOf('--active-heavy-jobs');
const activeHeavyJobs = activeIndex < 0 ? NaN : Number(process.argv[activeIndex + 1]);
if (![0, 1].includes(activeHeavyJobs)) throw Error('--active-heavy-jobs requires the coordinator-confirmed machine-wide count, 0 or 1');
const distIndex = process.argv.indexOf('--dist');
const dist = distIndex < 0 ? 'dist-uphill-input' : process.argv[distIndex + 1];
if (!dist || !/^dist-(?:pump-exit|uphill-input)$/.test(dist)) throw Error('--dist requires dist-pump-exit or dist-uphill-input');
if(dist==='dist-pump-exit'&&!process.argv.includes('--no-build'))throw Error('accepted output is read-only; pass --no-build or --dist dist-uphill-input');
// Reuse only a completed output whose runtime source the coordinator has confirmed.
let pumpChoice = 'shown';
const saveIndex = process.argv.indexOf('--save');
mustSave();
function mustSave() {
  if (saveIndex < 0 || !process.argv[saveIndex + 1] || process.argv[saveIndex + 1].startsWith('--'))
    throw Error('--save requires an unedited earned stage save');
}
const rawInput = readFileSync(resolve(root, process.argv[saveIndex + 1]), 'utf8');
const inputHash = createHash('sha256').update(rawInput).digest('hex');
requireBetaHash(inputHash, '00bfc093d7f1aecb61838f6314d59db27b329dcc235dd7376a6feb28032bdf10', 'pump');
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'boundary.save.json'), rawInput);
const qualityIndex = process.argv.indexOf('--quality');
const quality = qualityIndex < 0 ? 'high' : process.argv[qualityIndex + 1];

const runnerSha256 = createHash('sha256')
  .update(readFileSync(import.meta.filename))
  .digest('hex');
const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const sourceDiff = spawnSync('git', ['diff', '--binary', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).stdout;
writeFileSync(resolve(out, 'tested-working-tree.patch'), sourceDiff);
const sourceDiffSha256 = createHash('sha256').update(sourceDiff).digest('hex');
let browser,
  build,
  server,
  page,
  failure,
  current = 'build';
let routeComplete = false;
const resources = [];
const transactions = [];
let observationScope = null;
async function collectTransactions(checkpoint) {
  if (!observationScope) return;
  const observation = await page.evaluate(() => ({ rows: window.__pumpTransactions.rows, snapshot: window.__pumpTransactions.snapshot() }));
  observationScope.rows = observation.rows;
  if (checkpoint) observationScope.checkpoints.push({ name: checkpoint, index: observation.rows.length, snapshot: observation.snapshot });
  writeFileSync(resolve(out, "transactions.json"), JSON.stringify(transactions, null, 2));
}
async function startTransactions(raw, label) {
  observationScope = { id: transactions.length, label, inputHash: createHash("sha256").update(raw).digest("hex"), rows: [], checkpoints: [] };
  transactions.push(observationScope);
  await page.evaluate(observeUphillTransactions);
}
async function gate() {
  const s = await sample();
  resources.push(s);
  writeFileSync(resolve(out, 'resources.json'), JSON.stringify(resources, null, 2));
  must(canStartHeavy(s, activeHeavyJobs), 'resource probe holds heavy launch with ' + activeHeavyJobs + ' active heavy jobs: ' + JSON.stringify(s));
  must(!journal.interrupted, 'interrupted during admission probe');
  record({ type: 'heavy-admission', activeHeavyJobs, sample: s });
}
const monitor = setInterval(
  () =>
    sample()
      .then((s) => {
        resources.push(s);
        writeFileSync(resolve(out, 'resources.json'), JSON.stringify(resources, null, 2));
        console.log('resource', JSON.stringify(s));
        journal.flush();
      })
      .catch(console.error),
  30000,
);
const inputs = [],
  captures = [],
  errors = [],
  scenes = [],
  framing = [],
  restoration = [],
  entries = [];
const journal = createPumpJournal(out, () => ({
  sha, sourceDiffSha256, runnerSha256, inputHash, dist, quality, current, failure, errors,
  scenes, inputs, captures, framing, restoration, entries,
}));
journal.flush();
let emergencyExit;
const interrupt = (signal) => {
  failure = `Interrupted by ${signal} during ${current}`;
  journal.interrupt(signal); // Persist before closing anything that can reject pending input.
  clearInterval(monitor);
  build?.kill('SIGTERM');
  server?.kill('SIGTERM');
  void browser?.close().catch((error) => console.error('browser cleanup', String(error)));
  // A child or browser transport may never settle. Retain the BLOCKED trace in that case too.
  emergencyExit = setTimeout(() => {
    journal.flush();
    build?.kill('SIGKILL');
    server?.kill('SIGKILL');
    process.exit(signal === 'SIGINT' ? 130 : 143);
  }, 5000);
  emergencyExit.unref();
};
const onTerm = () => interrupt('SIGTERM'), onInt = () => interrupt('SIGINT');
process.once('SIGTERM', onTerm);
process.once('SIGINT', onInt);
async function observeScenes() {
  await page
    .exposeFunction('pumpScene', (data) => scenes.push(data))
    .catch((e) => {
      if (!String(e).includes('already')) throw e;
    });
  await page.evaluate(() =>
    window.__game.view.game.events.on('scene.played', (data) => window.pumpScene(data)),
  );
}
const must = (ok, why) => {
  if (!ok) throw new Error(why);
};
const record = (action) => {
  const entry = { step: current, time: Date.now(), ...action };
  inputs.push(entry);
  appendFileSync(resolve(out, 'inputs.ndjson'), JSON.stringify(entry) + '\n');
};
const read = () =>
  page.evaluate(() => {
    const g = window.__game,
      o = g.view.game.systems.opening;
    const state = g.state();
    if (state.talk) state.talk.scene = g.view.game.systems.talk.current()?.scene;
    return {
      ...state,
      gear: g.view.game.systems.bench.gear(),
      health: g.view.game.systems.fights.hero(),
      farms: g.view.game.systems.farms.all(),
      opening: { stage: o.stage(), hero: o.hero(), ask: o.asking(), bout: o.bout() },
    };
  });
async function shot(name) {
  await page.waitForTimeout(120);
  const s = await read();
  await page.screenshot({ path: resolve(out, name + '.png') });
  writeFileSync(resolve(out, name + '.json'), JSON.stringify(s, null, 2));
  captures.push({ name, state: s });
  journal.flush();
  console.log(`ok ${name} ${s.prompt ?? ''}`);
}
async function wait(test, why, timeout = 15000) {
  const until = Date.now() + timeout;let noted=0;
  while (Date.now() < until) {
    const s = await read();
    must(!s.viewErrors.length && !Object.keys(s.failed).length, JSON.stringify(s.viewErrors));
    if (await test(s)) return s;
    if(timeout>30000&&Date.now()-noted>30000){noted=Date.now();console.log('waiting',why,JSON.stringify({clock:s.clock,player:s.player,prompt:s.prompt}));}
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out: ${why}`);
}
async function press(key) {
  record({ type: 'press', key });
  await page.keyboard.press(key);
  await page.waitForTimeout(120);
}
async function click(selector) {
  record({ type: 'click', selector });
  await page.locator(selector).click();
}
async function sleepNormally(name){
 await walk(CAMP.tentApproach.x,CAMP.tentApproach.z,.25);
 const atTent=await read();record({type:'tent-approach-observation',player:atTent.player,prompt:atTent.prompt});
 must(atTent.prompt==='Sleep in your tent','authored tent entrance in reach');
 await wait(async s=>s.prompt==='Sleep in your tent'&&await page.evaluate(()=>window.__game.view.game.systems.time.canSleep()),'normal evening tent prompt',1500000);
 await shot(name+'-tent');const day=(await read()).clock.day;
 record({type:'normal-sleep',day});await press('KeyE');
 await wait(s=>s.clock.day>day&&!s.player.busy,'wake from tent',30000);await save(name+'-morning');
}
async function repeatControl(selector){const b=await page.locator(selector).boundingBox();must(b,'repeat control visible');record({type:'repeat-control',selector});await page.mouse.click(b.x+b.width/2,b.y+b.height/2);}
async function dialogue(name) {
  current = name;
  await wait((s) => !!s.talk, name + ' begins');
  await shot(name);
  const expected = name === '27-maren' ? 27 : undefined;
  const yaw = await page.evaluate(() => window.__game.view.camera.yaw);
  entries.push({ name, frame: await firstnightFrame(page) });
  for (let i = 0; i < 160; i++) {
    const s = await read();
    if (!s.talk) {
      await page.waitForTimeout(1000);
      const back = await read();
      if (!back.talk) must(!back.player.busy, 'controls remain busy');
      const restored = await page.evaluate(() => window.__game.view.camera.yaw);
      must(Math.abs(restored - yaw) < 0.001, 'camera yaw not restored');
      restoration.push({ name, yaw, restored });
      return;
    }
    if (expected) must(s.talk.scene === expected, 'wrong scene ' + s.talk.scene);
    await settleDialogue(page);
    await page.waitForFunction(()=>!document.querySelector('.gb-dialogue-untyped')?.textContent,{}, {timeout:30000});
    const frame = await firstnightFrame(page);
    const issues = firstnightIssues(frame);
    framing.push({ name, i, frame, issues });
    journal.flush();
    await page.screenshot({ path: resolve(out, name + '-line-' + i + '.png') });
    must(!issues.length, name + ' framing: ' + issues.join('; '));
    if (s.talk.choices?.length) {
      must(s.talk.scene === 25, 'unexpected choice');
      record({ type: 'choice', choice: pumpChoice });
      await press(pumpChoice === 'kept' ? 'Digit2' : 'Digit1');
    } else await press('KeyE');
    await page.waitForTimeout(150);
  }
  throw Error(name + ' never ended');
}
async function walk(x, z, near = 0.3) {
  for (let replans = 0; replans < 12; replans++) {
    try {
      return await straightWalk(x, z, near);
    } catch (error) {
      if (!/walking stuck|walking exhausted/.test(String(error))) throw error;
      const path = await page.evaluate(
        ([x, z]) => {
          const g = window.__game.view.game;
          const to = { x, y: g.world.heightAt(Math.floor(x), Math.floor(z)), z };
          return (
            g.systems.nav.path(g.player.pos, to, 20000) ??
            g.systems.nav.toward(g.player.pos, to, 20000)
          );
        },
        [x, z],
      );
      record({ type: 'read-only-nav-route', goal: { x, z }, path });
      must(path?.length, 'no walkable route');
      for (const p of path) {
        if ((await read()).talk) return;
        await straightWalk(p.x, p.z, 0.2);
      }
      // toward() may return a bounded partial route. Replan from its earned end.
    }
  }
  throw Error('walking exhausted after 12 navigation replans');
}

async function straightWalk(x, z, near = 0.3) {
  const goal = { x, z };
  record({ type: 'walk-goal', goal, near });
  let last,
    stuck = 0,
    best = Infinity,
    withoutProgress = 0;
  const held = new Set();
  const steer = createKeyboardSteering();
  try {
    for (let i = 0; i < 1000; i++) {
      const s = await read(),
        p = s.player;
      if (i % 100 === 0) console.log('walk', current, i, p.x, p.z, 'to', x, z);
      if (s.talk || Math.hypot(goal.x - p.x, goal.z - p.z) < near) return;
      must(!p.busy, 'walk blocked by busy state');
      const t = goal;
      const yaw = await page.evaluate(() => window.__game.view.camera.yaw);
      const dx = t.x - p.x,
        dz = t.z - p.z,
        len = Math.hypot(dx, dz) || 1;
      const direction = steer(dx, dz, yaw);
      const want = new Set([
        ...(direction.forward > 0 ? ['KeyW'] : direction.forward < 0 ? ['KeyS'] : []),
        ...(direction.right > 0 ? ['KeyD'] : direction.right < 0 ? ['KeyA'] : []),
      ]);
      for (const key of held)
        if (!want.has(key)) {
          record({ type: 'up', key });
          await page.keyboard.up(key);
          held.delete(key);
        }
      for (const key of want)
        if (!held.has(key)) {
          record({ type: 'down', key });
          await page.keyboard.down(key);
          held.add(key);
        }
      await page.waitForTimeout(50);
      if (last && Math.hypot(p.x - last.x, p.z - last.z) < 0.03) stuck++;
      else stuck = 0;
      const distance = Math.hypot(goal.x - p.x, goal.z - p.z);
      if (distance < best - 0.03) {
        best = distance;
        withoutProgress = 0;
      } else withoutProgress++;
      if (stuck > 25 || withoutProgress > 25)
        throw new Error(`walking stuck at ${p.x},${p.z}, goal ${goal.x},${goal.z}`);
      last = p;
    }
    throw new Error('walking exhausted');
  } finally {
    for (const key of held) {
      record({ type: 'up', key });
      await page.keyboard.up(key);
    }
  }
}
async function save(name) {
  // Public save entry point, explicitly recorded; no serialization edits or supplied fixture.
  record({ type: 'public-save', method: '__game.save' });
  must(await page.evaluate(() => window.__game.save()), 'save failed');
  const raw = await page.evaluate(() => localStorage.getItem('greenhollow.save'));
  must(raw, 'save missing');
  writeFileSync(resolve(out, name + '.save.json'), raw);
  await collectTransactions(name);
  record({ type: 'save-sha256', name, sha256: createHash('sha256').update(raw).digest('hex') });
  journal.flush();
  return JSON.parse(raw);
}
async function goPlace(id, dx = 0, dz = 0, near = 1) {
  const p = await page.evaluate((id) => window.__game.view.game.systems.region.place(id).at, id);
  await walk(p.x + dx, p.z + dz, near);
  return p;
}
async function continueSave(name, home = true) {
  await press('Escape');
  await wait((s) => s.paused, 'normal pause before checkpoint');
  const before = await save(name);
  await collectTransactions();
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await observeScenes();
  await startTransactions(readFileSync(resolve(out, name + ".save.json"), "utf8"), name + "-continued");
  record({
    type: 'public-save-observer',
    method: '__game.save',
    intent: 'capture exact restored bytes after the Continue click, before the next frame',
  });
  await page.evaluate(() => {
    document.addEventListener(
      'click',
      () =>
        queueMicrotask(async () => {
          await window.__game.save();
          window.__pumpContinueRaw = localStorage.getItem('greenhollow.save');
        }),
      { once: true },
    );
  });
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.waitForFunction(() => !!window.__pumpContinueRaw);
  const raw = await page.evaluate(() => window.__pumpContinueRaw);
  writeFileSync(resolve(out, name + '-continued.save.json'), raw);
  await collectTransactions(name + '-continued');
  const after = JSON.parse(raw);
  record({
    type: 'save-sha256',
    name: name + '-continued',
    sha256: createHash('sha256').update(raw).digest('hex'),
  });
  await wait((s) => s.started && !s.player.busy, 'Continue');
  for (const key of [
    'inventory',
    'bench',
    'placeables',
    'settlement',
    'quests',
    'goods',
    'crops',
    'ruins',
  ])
    must(
      JSON.stringify(before.game.systems[key]) === JSON.stringify(after.game.systems[key]),
      key + ' changed on Continue',
    );
  must(JSON.stringify(before.world) === JSON.stringify(after.world), 'world changed on Continue');
  for (const [key, value] of before.game.flags)
    if (/^(shrine\.|choice\.dinner|dinner\.|scene\.|memory\.|vaults\.|keystone\.|job\.)/.test(key))
      must(Object.fromEntries(after.game.flags)[key] === value, key + ' changed on Continue');
  const friendship = (v) => v.game.systems.people.people.map((p) => [p.id, p.friendship]);
  must(
    JSON.stringify(friendship(before)) === JSON.stringify(friendship(after)),
    'friendships changed on Continue',
  );
  if (home)
    await wait(
      (s) =>
        s.flags.heartstone === Object.fromEntries(before.game.flags).heartstone &&
        ['moss', 'quill', 'copper'].every((id) => s.flags['farm.' + id + '.living']),
      'settled home systems',
    );
  await page.waitForFunction(
    (level) =>
      document.querySelector('.ui-heart-name')?.textContent?.startsWith('Heartstone ' + level),
    Object.fromEntries(before.game.flags).heartstone,
  );
  await page.waitForFunction(
    () => !document.querySelector('.ui-heart')?.classList.contains('is-rising'),
  );
  await shot(name + '-continued');
}
async function importRaw(raw, label = "boundary") {
  await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=${quality}`);
  await page.evaluate((raw) => localStorage.setItem('greenhollow.save', raw), raw);
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await observeScenes();
  await startTransactions(raw, label);
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await wait((s) => s.started && !s.player.busy, 'Continue');
}
async function branch(raw, name, run) {
  await collectTransactions();
  const main = page, mainScope = observationScope;
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  page = await context.newPage();
  try {
    record({
      type: 'independent-raw-import',
      name,
      sha256: createHash('sha256').update(raw).digest('hex'),
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) errors.push(m.text());
    });
    await importRaw(raw, name);
    await run();
  } finally {
    await collectTransactions();
    await context.close();
    page = main; observationScope = mainScope;
  }
}

const pointer=(x,y,z,height=.99)=>page.evaluate(([x,y,z,height])=>window.__game.view.project(x+.5,y+height,z+.5),[x,y,z,height]);
async function point(x,y,z,height=.99) {
 await page.waitForTimeout(500);
 for(let turn=0;turn<16;turn++) {
  if(turn===12){await press('KeyV');await page.waitForTimeout(800);record({type:'camera-drag',from:[650,200],to:[650,500]});await page.mouse.move(650,200);await page.mouse.down({button:'right'});await page.mouse.move(650,500,{steps:15});await page.mouse.up({button:'right'});await page.waitForTimeout(800);}
  const at=await pointer(x,y,z,height);
  if(at) {
   record({type:'pointer',cell:[x,y,z],height,at});await page.mouse.move(at.x,at.y);await page.waitForTimeout(150);
   const aim=await page.evaluate(()=>{const a=window.__game.view.aim;return a&&[a.x,a.y,a.z]});record({type:'aim-observation',aim,cell:[x,y,z],terrain:await page.evaluate(([x,y,z])=>{const v=window.__game.view,w=v.game.world,p=v.project(x+.5,y+.99,z+.5);const cam=window.__game.state().camera.at,dx=x+.5-cam.x,dy=y+.99-cam.y,dz=z+.5-cam.z,n=Math.hypot(dx,dy,dz),hit={};const found=w.raycast(cam.x,cam.y,cam.z,dx/n,dy/n,dz/n,500,hit,v.camera.hides);const treeHit={};const treeFound=v.game.systems.trees.raycast(cam,{x:dx/n,y:dy/n,z:dz/n},found?hit.distance:500,treeHit);return {treeHit:treeFound?treeHit:null,rawHit:found?hit:null,height:w.heightAt(x,z),block:w.getBlock(x,y,z),pointer:v.keys.pointer,element:p?document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,400):null,hero:v.playerPosition,claimed:v.claimed('use')}},[x,y,z])});
   if(JSON.stringify(aim)===JSON.stringify([x,y,z])) return;
  }
  if(turn%3===2)await press('KeyQ');await page.waitForTimeout(800);
 }
 throw Error('pointer cannot reach '+[x,y,z]);
}
async function ownedAll(ids) {
 return page.evaluate(ids=>{const g=window.__game.view.game;return ids.every(id=>g.systems.inventory.count(id)>0||g.systems.placeables.all().some(p=>p.kind===id));},ids);
}
async function equip(id) {
 const slots=await page.evaluate(()=>window.__game.view.game.systems.inventory.slots);
 let index=slots.findIndex(s=>s?.id===id);must(index>=0,'missing earned item '+id);
 if(index>=9){await press('KeyI');await click(`[data-key="slot:${index}"]`);await click('[data-key="slot:8"]');await press('Escape');index=8;}
 await press('Digit'+(index+1));
}
async function make(id,count=1,hand=false){
 if(hand){await press('KeyI');await click('[data-key="tab:hand"]');await click(`[data-key="recipe:${id}"]`);}
 else {const bench=await page.evaluate(()=>window.__game.view.game.systems.placeables.all().find(p=>p.kind==='workbench'));must(bench,'earned workbench');await walk(bench.x+.5,bench.z+1.5,.15);await wait(s=>s.prompt==='Craft','workbench prompt');await press('KeyE');}
 for(let i=0;i<count;i++)await click(`[data-key="make:${id}"]`);
 await press('Escape');
}

async function useCell(item,x,z,button='right') {
 const stand=await page.evaluate(([x,z])=>{const g=window.__game.view.game;return [[x+.5,z+2],[x+2,z+.5],[x-2,z+.5],[x+.5,z-2]].find(([sx,sz])=>{const cx=Math.floor(sx),cz=Math.floor(sz);return [1,2,3,7,8].includes(g.world.getBlock(cx,21,cz))&&g.world.getBlock(cx,22,cz)===0&&!g.systems.placeables.at(cx,22,cz);});},[x,z]);
 must(stand,'dry approach '+x+','+z);await walk(...stand,.3); await equip(item);
 const y=await page.evaluate(([x,z])=>window.__game.view.game.world.heightAt(x,z)-1,[x,z]);
 await point(x,y,z); const at=await pointer(x,y,z);
 record({type:'cell-input',item,x,y,z,button});await page.mouse.click(at.x,at.y,{button});
 if((await read()).camera.mode==='free'){await press('KeyV');await press('KeyV');await page.waitForTimeout(800);}
}
async function placeWater(item,x,z){
 await walk(x+.5,z+2,.3);await equip(item);
 for(let turn=0;turn<4;turn++){
  for(const [dx,dz]of [[0,-1],[1,0],[0,1],[-1,0]]){
   const pos=await page.evaluate(([x,z,dx,dz])=>window.__game.view.project(x+.5+dx*.5,21.6,z+.5+dz*.5),[x,z,dx,dz]);
   if(!pos)continue;await page.mouse.move(pos.x,pos.y);await page.waitForTimeout(200);
   const hit=await page.evaluate(()=>{const a=window.__game.view.aim;return a&&{...a};});record({type:'water-bank-aim',hit,target:[x,z]});
   if(hit&&hit.x+hit.nx===x&&hit.z+hit.nz===z&&hit.y===21&&hit.ny===0){await page.mouse.click(pos.x,pos.y,{button:'right'});await wait(()=>page.evaluate(([item,x,z])=>window.__game.view.game.systems.placeables.all().some(p=>p.kind===item&&p.x===x&&p.z===z),[item,x,z]),'water part');return;}
  }
  await press('KeyQ');await page.waitForTimeout(800);
 }
 throw Error('no ordinary bank-face placement '+x+','+z);
}
async function place(item,x,z){
 await useCell(item,x,z);
 await wait(()=>page.evaluate(([item,x,z])=>window.__game.view.game.systems.placeables.all().some(p=>p.kind===item&&p.x===x&&p.z===z),[item,x,z]),'placed '+item+' '+x+','+z);
}
async function usePrompt(text) {
  await wait((s) => s.prompt === text, text);
  await press('KeyE');
}

try {
  if (!process.argv.includes('--no-build')) {
    await gate();
    build = spawn(
      'bun',
      ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'],
      { cwd: root, stdio: 'inherit' },
    );
    must((await new Promise((done, fail) => { build.once('error', fail); build.once('exit', done); })) === 0, 'build failed');
  }
  if (process.env.BETA_RUNTIME_MANIFEST) {
    if (!process.env.BETA_PREDECESSOR || !process.argv.includes('--no-build')) throw Error('beta runtime requires the earned chain and no-build');
    const expected = verifyRuntime(dist, process.env.BETA_RUNTIME_MANIFEST);
    writeFileSync(resolve(out, 'accepted-build-provenance.json'), JSON.stringify(expected, null, 2));
  } else if(dist === 'dist-pump-exit'||process.argv.includes('--no-build')) {
    const provenance=dist==='dist-pump-exit'?'.artifacts/pump-exit-staging/checks/provenance.json':'.artifacts/uphill-input/build-provenance.json';
    const expected=JSON.parse(readFileSync(provenance,'utf8'));
    must(!spawnSync('git',['diff',expected.source,'--','src','public','index.html','vite.config.ts','package.json'],{encoding:'utf8'}).stdout,'runtime differs from accepted build');
    const actual={};
    function visit(dir,rel=''){for(const e of readdirSync(dir,{withFileTypes:true})){const r=rel?rel+'/'+e.name:e.name;if(e.isDirectory())visit(resolve(dir,e.name),r);else actual[r]=createHash('sha256').update(readFileSync(resolve(dir,e.name))).digest('hex');}}
    visit(resolve(dist));
    must(JSON.stringify(Object.entries(actual).sort())===JSON.stringify(Object.entries(expected.build).sort()),'full accepted build hashes');
    writeFileSync(resolve(out,'accepted-build-provenance.json'),JSON.stringify(expected,null,2));
  }
  writeFileSync(resolve(out, 'build-hashes.json'), JSON.stringify(pumpBuildHashes(resolve(root, dist)), null, 2));
  must(!journal.interrupted, 'interrupted before server launch');
  server = spawn('bun', ['tools/serve.mjs', dist, String(port)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((done, fail) => {
    server.stdout.on('data', (b) => {
      if (/pid \d+/.test(String(b))) done();
    });
    server.on('exit', (c) => fail(Error('server exited ' + c)));
  });
  await gate();
  must(!journal.interrupted, 'interrupted before browser launch');
  browser = await launchChrome();
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push(m.text());
  });

  record({ type: 'import-stage-boundary', path: process.argv[saveIndex + 1], sha256: inputHash });
  await importRaw(rawInput);
  const initial = JSON.parse(rawInput);
  must(initial.game.systems.quests.quests.pump.state === 'done', 'Pump completed boundary');
  requireBetaHash(inputHash, '00bfc093d7f1aecb61838f6314d59db27b329dcc235dd7376a6feb28032bdf10', 'pump');
  await shot('00-boundary');
  current = 'craft-machines';
  await make('waterwheel');
  await make('gear_shaft', 2);
  await make('pusher');
  await make('plank', 4, true);
  await make('fence', 2);
  await make('lamp');
  await save('crafted-machines');
  current = 'wheel-and-pit';
  // Existing earned ditch is one row north of the old diagnostic three-farms route.
  for(const x of [18,17,16,14,13])await place('fence',x,-226);
  await useCell('spade',15,-227);
  await place('gear_shaft',14,-230);
  await placeWater('gear_shaft',14,-229);
  await place('gear_shaft',14,-228);
  await place('pusher',14,-227);
  await place('waterwheel',15,-230);
  await wait(s=>s.flags['step.uphill.wheel'],'turning wheel');
  await shot('01-turning-wheel');
  await walk(15,-224,0.5);
  await wait(s=>s.farms.find(f=>f.id==='spring')?.rate===6,'productive pit',15000);
  await shot('02-unlit-pit');
  await press('KeyQ');await page.waitForTimeout(800);await shot('02-unlit-pit-alt');
  await continueSave('middle-pit',false);
  await press('Escape');
  await save('pre-choice');
  if(process.argv.includes('--stop-after-pit')) throw Error('development checkpoint: pit earned, route incomplete');
  const choiceRaw=readFileSync(resolve(out,'pre-choice.save.json'),'utf8');
  const farmPanel=async()=>{const f=(await read()).farms.find(f=>f.id==='spring');await walk(f.at.x,f.at.z+1.5,.3);await wait(s=>s.prompt==='Look at the gearling pit','pit interaction');await press('KeyE');};
  await branch(choiceRaw,'take',async()=>{await farmPanel();await shot('03-take-choice');await click('[data-key="take"]');await save('take-earned');await shot('04-take-result');await repeatControl('[data-key="take"]');await save('take-repeat');});
  await collectTransactions();await importRaw(choiceRaw,'give');
  await farmPanel();await shot('05-give-choice');await click('[data-key="give"]');await save('give-earned');await click('[data-key="give"]');await save('give-repeat');await press('Escape');
  current='pond-lamp';for(let tries=0;tries<4;tries++){await useCell('lamp',10,-228);const placed=await page.evaluate(()=>window.__game.view.game.systems.farms.get('pond')?.built||window.__game.view.game.world.getBlock(10,22,-228)===window.__game.view.game.systems.items.get('lamp').block);if(placed)break;await page.waitForTimeout(1500);}await walk(10,-225,.5);await wait(s=>s.farms.find(f=>f.id==='pond')?.rate>0,'frog pond');await shot('06-pond');
  current='frog-production';await sleepNormally('pond-night');await wait(()=>page.evaluate(()=>window.__game.view.game.systems.machines.loose().some(g=>g.item==='frog_slick')),'actual frog slick',1500000);
  await save('frog-produced');await walk(10,-225,.5);await shot('07-frog-production');
  const slick=await page.evaluate(()=>window.__game.view.game.systems.machines.loose().find(g=>g.item==='frog_slick'));await walk(slick.x,slick.z,.3);
  await wait(s=>s.bag.filter(v=>v.id==='frog_slick').reduce((n,v)=>n+v.count,0)>=2,'collect slick',180000);
  current='terrace';await make('sprinkler',2);await make('waterwheel');await place('waterwheel',9,-228);await place('sprinkler',9,-227);await place('sprinkler',8,-227);
  await wait(()=>page.evaluate(()=>window.__game.view.game.systems.machines.parts().filter(p=>p.kind==='sprinkler'&&p.state==='working'&&p.speed===1).length===2),'both sprinklers working');
  const cells=await page.evaluate(()=>{const g=window.__game.view.game,r=[];for(let x=7;x<=16;x++)for(let z=-231;z<=-225;z++){const y=21,b=g.world.getBlock(x,y,z);if(![1,2].includes(b)||g.world.getBlock(x,22,z)!==0||g.systems.crops.at(x,y,z)||g.systems.placeables.at(x,22,z)||g.systems.machines.hole(x,y,z))continue;const water=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>g.world.getBlock(x+dx,y,z+dz)===21);if(water||g.systems.machines.sprinkled(x,y,z)>0)r.push([x,z]);}return r;});
  must(cells.length>=19,'enough irrigated terrace ground');
  for(const [x,z]of cells){await useCell('hoe',x,z);await useCell('wheat_seeds',x,z);}
  await wait(s=>s.farms.find(f=>f.id==='field')?.rate>36,'terrace exceeds pumped field');await shot('08-terrace');await save('terrace-planted');
  current='wheat-growth';await sleepNormally('terrace-night');await wait(()=>page.evaluate(()=>window.__game.view.game.systems.crops.all().filter(c=>c.def.id==='wheat'&&c.state.ripe).length>=19),'real wheat growth',1800000);
  await walk(11,-225,1);await shot('09-ripe-wheat');for(const [x,z]of cells){if(await page.evaluate(([x,z])=>window.__game.view.game.systems.crops.at(x,21,z)?.ripe,[x,z]))await useCell('axe',x,z,'left');}
  await save('harvested');
  current='ledger';for(const [x,z] of [[20,-240],[92,-221],[126,-177],[137,-174],[150,-174]])await walk(x,z,1.5);await goPlace('granary',2.5,0,.3);await wait(s=>s.prompt?.includes('Sell at the granary'),'granary');await press('KeyE');await click('[data-key="open-ledger"]');await click('[data-key="section:granary"]');await save('before-delivery');await click('[data-key="deliver"]');await save('after-delivery');await shot('10-ledger');await repeatControl('[data-key="deliver"]');await save('repeat-delivery');await press('Escape');
  current='return-maren';for(const [x,z]of [[150,-174],[137,-174],[126,-177],[92,-221],[20,-240]])await walk(x,z,1.5);await goPlace('grant.center');await dialogue('27-maren');await save('maren-earned');await continueSave('final-home');await save('earned-uphill');await shot('11-earned-home');
  must((await read()).flags['quest.uphill.done'],'uphill complete');must(!errors.length,errors.join('\n'));routeComplete=true;


} catch (e) {
  failure ??= String(e.stack ?? e);
  journal.flush();
  console.error(current, failure);
  if (page) {
    await save('last-earned-checkpoint').catch(() => {});
    await shot('failed').catch(() => {});
  }
} finally {
  clearInterval(monitor);
  await stopPumpChild(build).catch((error) => { failure ??= 'build cleanup: ' + String(error); });
  try { await browser?.close(); } catch (error) { failure ??= 'browser cleanup: ' + String(error); }
  await stopPumpChild(server).catch((error) => { failure ??= 'server cleanup: ' + String(error); });
  journal.flush();
  clearTimeout(emergencyExit);
  process.removeListener('SIGTERM', onTerm);
  process.removeListener('SIGINT', onInt);
}
const verdict = (routeComplete && !failure ? journal.complete() : journal.flush()).status;
console.log(verdict === 'PASS' ? 'PASS Water uphill' : 'BLOCKED');
process.exitCode = journal.interrupted ? (journal.interrupted === 'SIGINT' ? 130 : 143) : verdict === 'PASS' ? 0 : 1;
}
