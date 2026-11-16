import {sample,canStartHeavy} from './resource-status.mjs';
import {storyCosts,costIssues} from './lib/story-cost-probe.mjs';
import {dialogueCoverage,presentedDialogueLine,sameDialogueLine} from './lib/dialogue-capture.mjs';
// What the camera shows of what matters: every scene of act 1 with its people and the hero in the shot, and the
// places the first playtest found hidden (docs/bugs/2026-11-12-act1-*-occlusion.md, -town-foliage.md).
//   bun tools/play-sight.mjs [scenes|places|all] [--only 12,16] [--shots] [--port 5541] [--url http://...] [--no-build] [--quality high]
//
// Scenes: for each scene of content/scenes.ts that has words, the game is put at the quest step that plays it,
// the hero stands where a player arrives (a few blocks short of where it is staged, or beside the person who
// starts it), and its conversation starts. On every line the debug door's `sight()` says, for the hero, the person
// speaking and everyone the scene stood in the world, whether their chest is in the frame above the dialogue box
// and whether anything left standing hides their chest or sampled body points. A line fails when one is out of
// frame or hidden, or the speaker, who stands in the world, is not among them. The first line of each scene is photographed.
// Places: the queen asleep in the granary, the Hall of the Shut Door walked through at night, the gearling's fight
// at the old mill. Each fails when the hero, the queen or the gearling is hidden.
//
// The pictures go to .artifacts/sight/. It exits 1 on any failure and prints each.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { firstnightFrame, firstnightIssues, settleDialogue } from './lib/firstnight-framing.mjs';
import { splitCues } from '../src/game/talk/cues.sim.ts';
import { cameraStill } from './play/wait.mjs';
import { launchChrome } from './lib/chrome.mjs';
import { CONVERSATIONS } from '../src/game/content/dialogue.ts';
import { QUESTS, satisfy } from '../src/game/content/quests.ts';
import { NEAR_SCENE, SCENES } from '../src/game/content/scenes.ts';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const part = ['scenes', 'places', 'all'].includes(args[0]) ? args[0] : 'all';
const only = opt('only', '') ? new Set(opt('only', '').split(',').map(Number)) : null;
const root = resolve(import.meta.dirname, '..');
const explicitOut = opt('out', '');
if (args.includes('--out') && (!explicitOut || explicitOut.startsWith('--'))) throw Error('--out requires a directory');
const out = resolve(root, explicitOut || '.artifacts/sight');
if (explicitOut && existsSync(out) && readdirSync(out).length) throw Error('Choose an empty --out directory to preserve evidence');
const PORT = Number(opt('port', process.env.PLAY_PORT || '5541'));
const dist = opt('dist', 'dist-sight');
const quality = opt('quality', 'high');
/** `--shots` photographs every line, not only each scene's first. */
const EVERY_SHOT = args.includes('--shots');
if (!explicitOut) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'tested-runner.mjs'), readFileSync(import.meta.filename));

async function admitCostLaunch() {
  if (!args.includes('--costs')) return;
  const status = await sample();
  writeFileSync(resolve(out, 'admission-'+Date.now()+'.json'), JSON.stringify(status,null,2));
  if (!canStartHeavy(status,0)) throw Error('cost browser/server admission denied');
}
let base = opt('url', '');
let serverPid = 0;
if (!base) {
  if (!args.includes('--no-build')) {
    const build = spawnSync('bun', ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
    if (build.status !== 0) { console.error('FAIL: the build'); process.exit(1); }
  }
  // The server prints its pid, and it is stopped by that pid, never by port.
  await admitCostLaunch();
  const server = spawn('bun', ['tools/serve.mjs', dist, String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  serverPid = await new Promise((done, fail) => {
    let text = '';
    server.stdout.on('data', (chunk) => { text += chunk; const pid = /pid (\d+)/.exec(text); if (pid) done(Number(pid[1])); });
    server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
  });
  base = `http://127.0.0.1:${PORT}/`;
}
const URL_ = `${base}${base.includes('?') ? '&' : '?'}seed=7&hold&quality=${quality}`;

const failures = [];
const results = [];
await admitCostLaunch();
const browser = await launchChrome();
const page = await browser.newPage({ viewport: { width: Number(opt('width', '1366')), height: Number(opt('height', '768')) } });
page.on('console', m => { if (['error','warning'].includes(m.type())) { failures.push(m.type()+': '+m.text()); writeFileSync(resolve(out,'browser-errors.json'),JSON.stringify(failures,null,2)); } });
page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));

async function fresh() {
  await page.goto(URL_);
  await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
}

/** The quest and step that play scene n, and the flags that make every step before it done. */
function stepOf(n) {
  for (const quest of QUESTS) {
    const at = quest.steps.findIndex((s) => s.scene === n);
    if (at < 0) continue;
    const flags = quest.steps.slice(0, at).flatMap((s) => satisfy(s.done)).filter((e) => 'flag' in e).map((e) => [e.flag, e.value ?? true]);
    return { quest: quest.id, step: quest.steps[at], flags };
  }
  return null;
}

// Optional focused regression: hidden dialogue HUD must not intercept the actor picture.
async function heartstoneHUD() {
  return page.evaluate(()=>{
    const el=document.querySelector('.ui-heart');
    if(!el)return {present:false};
    const box=el.getBoundingClientRect();
    const points=[[.1,.5],[.5,.5],[.9,.5]];
    return {present:true,visible:el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),pointerEvents:getComputedStyle(el).pointerEvents,
      hit:points.some(([x,y])=>!!document.elementFromPoint(box.x+box.width*x,box.y+box.height*y)?.closest('.ui-heart')),
      heartSeen:window.__game.state().flags['heart.seen']===true};
  });
}

/** Plays one conversation line by line and checks what the camera shows on each. */
async function playLines(label, shotName, expectedScene) {
  const problems = [];
  const captured = [];
  const logBefore = await page.evaluate(() => window.__game.view.game.systems.talk.log().slice(0, -1).map(entry => entry.text));
  const observe = async (frames) => page.evaluate(async (frames) => {
      const g = window.__game;
      if (frames) await g.frames(frames);
      const talk = g.view.game.systems.talk;
      if (!talk.active) return null;
      const line = talk.current();
      const actors = g.view.game.actors;
      // A speaker standing in the picture must be seen. One farther off speaks from out of it.
      const p = g.view.game.player.pos;
      const inWorld = line.npc ? [`npc:${line.npc}`, `stage:${line.npc}`].find((id) => { const a = actors.get(id); return a?.visible && Math.hypot(a.pos.x - p.x, a.pos.z - p.z) <= 16; }) ?? null : null;
      const lens = g.view.ctx.camera.position, r = (n) => Math.round(n * 10) / 10;
      const where = `hero at ${r(p.x)}, ${r(p.y)}, ${r(p.z)}, lens at ${r(lens.x)}, ${r(lens.y)}, ${r(lens.z)}`;
      return { line: { scene: line.scene, npc: line.npc, text: line.text, choices: line.choices.length, kind: line.kind }, inWorld, sight: g.sight(), where, costs: g.costs(), camera: {x:lens.x,y:lens.y,z:lens.z} };
    }, frames);
  for (let i = 0; i < 60; i++) {
    let seen = await observe(i === 0 ? 50 : 8);
    if (!seen) break;
    // Films advance while the camera moves. A second settle can outlast a whole
    // phone shot; observe later lines as shown and fail if any line is missed.
    const ready = await presentedDialogueLine({expected:seen,first:i===0,
      settle:()=>settleDialogue(page),
      waitText:text=>page.waitForFunction(text => { const el=document.querySelector('.gb-dialogue-typed'); return el?.textContent === text && el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}); }, splitCues(text).shown, {timeout:30000}),
      waitClear:()=>page.evaluate(()=>new Promise((resolve,reject)=>{
      const started=performance.now();let quietSince=started;
      function observe(){
        const now=performance.now();
        if(document.querySelector('.hp-banner:not([hidden])'))quietSince=now;
        if(now-quietSince>=1000){resolve();return;}
        if(now-started>=45000){reject(Error('line reward banners did not finish'));return;}
        requestAnimationFrame(observe);
      }
      requestAnimationFrame(observe);
    })),read:()=>observe(0)});
    if (!ready.same) {
      writeFileSync(resolve(out, shotName.replace('.png', `-line-${i+1}.changed.json`)),JSON.stringify(ready,null,2));
      problems.push(`line ${i+1}: dialogue advanced before its capture`);
      break;
    }
    seen = ready.actual;
    if (await page.locator('.hp-banner:not([hidden])').count()) problems.push(`line ${i+1}: reward banner obscures scene`);
    if ((i === 0 || EVERY_SHOT) && shotName) await page.screenshot({ path: resolve(out, i === 0 ? shotName : shotName.replace('.png', `-${String(i + 1).padStart(2, '0')}.png`)) });
    if (expectedScene && seen.line.scene !== expectedScene) problems.push(`line ${i + 1}: expected scene ${expectedScene}, got ${seen.line.scene}`);
    if (args.includes('--bodies')) { const frame=await firstnightFrame(page); writeFileSync(resolve(out, shotName.replace('.png', `-line-${i+1}.frame.json`)),JSON.stringify(frame,null,2));problems.push(...firstnightIssues(frame).map(p => `line ${i+1}: ${p}`)); }
    writeFileSync(resolve(out, shotName.replace('.png', `-line-${i+1}.json`)), JSON.stringify(seen,null,2));
    if(args.includes('--costs')){const frames=await storyCosts(page);writeFileSync(resolve(out,shotName.replace('.png',`-line-${i+1}.costs.json`)),JSON.stringify(frames,null,2));if(costIssues(frames,quality).length)problems.push(`line ${i+1}: draw budget exceeded`);}
    if(args.includes('--dialogue-hud')) {
      const hud=await heartstoneHUD();writeFileSync(resolve(out,shotName.replace('.png',`-line-${i+1}.hud.json`)),JSON.stringify(hud,null,2));
      if(!hud.present || hud.visible || hud.hit || hud.pointerEvents!=='none') problems.push(`line ${i+1}: Heartstone HUD visible or hit-testable during dialogue`);
    }
    const words = seen.line.text.slice(0, 48);
    for (const body of seen.sight) {
      if (!body.inFrame) problems.push(`line ${i + 1} "${words}": ${body.who} is out of the frame (${body.screen ? `${body.screen.x.toFixed(2)}, ${body.screen.y.toFixed(2)}` : 'behind the lens'}; ${seen.where})`);
      if (body.hiddenBy) problems.push(`line ${i + 1} "${words}": ${body.who} is hidden by ${body.hiddenBy}`);
    }
    if (seen.inWorld && !seen.sight.some((b) => b.who === seen.inWorld)) problems.push(`line ${i + 1} "${words}": the speaker ${seen.inWorld} is not kept in sight`);
    captured.push(seen.line.text);
    const after = await observe(0);
    if (!sameDialogueLine(seen, after)) {
      writeFileSync(resolve(out, shotName.replace('.png', `-line-${i+1}.changed.json`)),JSON.stringify({expected:seen,actual:after},null,2));
      problems.push(`line ${i+1}: dialogue advanced during its capture`);
      break;
    }
    await page.evaluate((choices) => { const t = window.__game.view.game.systems.talk; if (choices) t.choose(0); else t.advance(); }, seen.line.choices);
  }
  const logAfter = await page.evaluate(() => window.__game.view.game.systems.talk.log().map(entry => entry.text));
  const coverage = dialogueCoverage(logBefore, captured, logAfter);
  writeFileSync(resolve(out,shotName.replace('.png','-coverage.json')),JSON.stringify(coverage,null,2));
  if (!coverage.complete) problems.push('dialogue line coverage differs from its actual log');
  const cleanup = await page.evaluate(async()=>{
    const g=window.__game;await g.frames(30);
    return {active:g.view.game.systems.talk.active,busy:g.view.game.player.busy,stages:[...g.view.game.actors.keys()].filter(id=>id.startsWith('stage:')),yaw:g.view.camera.yaw,ask:g.view.game.systems.opening.asking(),openingStage:g.view.game.systems.opening.stage(),deedVisible:!!document.querySelector('[data-key="deed:sign"]')?.checkVisibility(),riverVisible:!!document.querySelector('[data-key="river:skip"]')?.checkVisibility()};
  });
  writeFileSync(resolve(out,shotName.replace('.png','-cleanup.json')),JSON.stringify(cleanup,null,2));
  if(args.includes('--dialogue-hud')) {
    const hud=await heartstoneHUD();writeFileSync(resolve(out,shotName.replace('.png','-cleanup.hud.json')),JSON.stringify(hud,null,2));
    if(!hud.present || (hud.heartSeen && !hud.visible))problems.push('Heartstone HUD did not return after dialogue cleanup');
  }
  const handoff = (expectedScene === 5 && cleanup.ask === 'deed' && cleanup.deedVisible) || (expectedScene === 6 && cleanup.openingStage === 'ferry' && cleanup.riverVisible);
  if(cleanup.active || (cleanup.busy && !handoff) || cleanup.stages.length) problems.push('scene end did not release stage and controls or reach its opening handoff');
  return problems;
}

function report(label, problems) {
  results.push({ label, problems });
  writeFileSync(resolve(out, 'sight.json'), JSON.stringify(results, null, 2));
  if (problems.length === 0) console.log(`ok   ${label}`);
  else { console.log(`FAIL ${label}`); for (const p of problems.slice(0, 6)) console.log(`       ${p}`); if (problems.length > 6) console.log(`       and ${problems.length - 6} more`); }
  failures.push(...problems.map((p) => `${label}: ${p}`));
}

try {
// ---------------------------------------------------------------------------------------------- scenes
if (part !== 'places') {
  for (const scene of SCENES) {
    if (only && !only.has(scene.n)) continue;
    const conversation = CONVERSATIONS.find((c) => c.scene === scene.n && !c.id.endsWith('.before'));
    if (!conversation) { console.log(`--   scene ${scene.n} ${scene.title}: no lines (a film of its own)`); continue; }
    // Every scene gets its own world; the result must not depend on which scene ran before it.
    await fresh();
    const where = stepOf(scene.n);
    const place = where?.step.place ?? scene.at ?? where?.step.at ?? null;
    const label = `scene ${String(scene.n).padStart(2)} ${scene.title}`;
    const night = scene.start === 'hall' || scene.n === 9;
    const setup = await page.evaluate(async ({ quest, flags, place, near, npc, night, id, n, vaultExit }) => {
      const g = window.__game;
      if (!g.started) g.newGame();
      const sys = g.view.game.systems;
      if (sys.talk.active) sys.talk.skip();
      // skipTo fills old ledger sections; its queued road-dark scene belongs to prior progression.
      g.view.game.flags.set('story.seen.scene.27.dark', true);
      if (quest) g.skipTo(quest);
      for (const [flag, value] of flags) g.view.game.flags.set(flag, value);
      g.setTime(night ? 0.9 : 0.45);
      g.advance(0.2);
      // Where a player arrives: beside the person who starts it, or a few blocks short of its place.
      let at = null;
      const person = npc ? g.view.game.actors.get(`npc:${npc}`) : null;
      if (person?.visible) at = { x: person.pos.x + 2, z: person.pos.z + 1.5 };
      else if (place) {
        try {
          const p = sys.region.place(place).at;
          // The ferry and ruins.outOfVault arrive at these exact places. An approach
          // offset moves the landing fixture off the jetty and into the river.
          at = vaultExit || n === 7 ? { x: p.x, y: p.y, z: p.z } : { x: p.x + near * 0.7, z: p.z + near * 0.7 };
        } catch { at = null; }
      }
      if (at) g.teleport(at.x, at.y, at.z);
      await g.frames(20);
      g.advance(0.2);
      if (sys.talk.active) sys.talk.skip();
      // Fixture rewards use the real banner lifecycle. Keep the normal HUD in every capture.
      await new Promise((resolve,reject) => {
        const started=performance.now();let quietSince=started;
        function observe(){
          const now=performance.now();
          if(document.querySelector('.hp-banner:not([hidden])'))quietSince=now;
          if(now-quietSince>=1000){resolve();return;}
          if(now-started>=45000){reject(Error('fixture reward banners did not finish'));return;}
          requestAnimationFrame(observe);
        }
        requestAnimationFrame(observe);
      });
      if (sys.talk.active) sys.talk.skip();
      sys.talk.start(id);
      return { at, talking: sys.talk.active, scene: sys.talk.current()?.scene ?? 0, n };
    }, { quest: where?.quest ?? null, flags: where?.flags ?? [], place, near: NEAR_SCENE - 0.5, npc: scene.start === 'npc' ? conversation.npc : null, night, id: conversation.id, n: scene.n, vaultExit: scene.start === 'vault' });
    if (setup.scene !== scene.n) { report(label, [`expected scene ${scene.n}, got ${setup.scene}`]); continue; }
    if (!setup.talking) { report(label, [`its conversation ${conversation.id} did not start`]); continue; }
    report(label, await playLines(label, `scene-${String(scene.n).padStart(2, '0')}.png`, scene.n));
  }
}

// ---------------------------------------------------------------------------------------------- places
if (part !== 'scenes') {
  const place = async (label, shotName, run) => {
    await fresh();
    const problems = await page.evaluate(run);
    await page.screenshot({ path: resolve(out, shotName) });
    report(label, problems);
  };
  /** In the page: the problems with what `sight()` shows now. */
  const looks = `(tag) => window.__game.sight().flatMap((b) => [...(b.hiddenBy ? [tag + ': ' + b.who + ' is hidden by ' + b.hiddenBy] : []), ...(b.inFrame ? [] : [tag + ': ' + b.who + ' is out of the frame'])])`;

  // The queen asleep in the granary: the hero walks up to her and talks (town-foliage).
  await place('the queen in the granary', 'place-queen.png', new Function(`return (async () => {
    const look = ${looks};
    const g = window.__game; g.newGame(); g.skipTo('count'); g.setTime(0.45);
    const maren = g.view.game.actors.get('npc:maren');
    g.teleport(maren.pos.x + 1.5, maren.pos.z + 1); await g.frames(40);
    const problems = look('walking up');
    // E beside her opens the granary's sale first (the nearest prompt), so she is spoken to directly.
    g.view.game.systems.talk.talkTo('maren'); await g.frames(50);
    if (!g.view.game.systems.talk.active) problems.push('talking to Maren: the conversation did not start');
    problems.push(...look('talking'));
    if (!g.sight().some((b) => b.who === 'npc:maren')) problems.push('talking: Maren is not kept in sight');
    return problems;
  })()`));

  // The Hall of the Shut Door at night: through the door, across the court, to the plinth and back (hall-occlusion).
  await fresh();
  await page.evaluate(() => { const g=window.__game; g.newGame(); g.skipTo('night'); g.setTime(0.9); });
  const hallProblems = [];
  for (const name of ['shut.door', 'hall.door', 'hall.heart', 'hall.mural', 'hall.custodian', 'hall.door']) {
    await page.evaluate(name => window.__game.teleport(name), name);
    await cameraStill(page);
    await page.evaluate(() => { const t=window.__game.view.game.systems.talk; if(t.active)t.skip(); });
    await cameraStill(page);
    const sight = await page.evaluate(() => window.__game.sight());
    writeFileSync(resolve(out, 'hall-'+name+'-'+hallProblems.length+'.json'), JSON.stringify(sight,null,2));
    for (const body of sight) {
      if(body.hiddenBy) hallProblems.push(name+': '+body.who+' is hidden by '+body.hiddenBy);
      if(!body.inFrame) hallProblems.push(name+': '+body.who+' is out of the frame');
    }
  }
  await page.screenshot({path:resolve(out,'place-hall.png')});
  report('the Hall of the Shut Door',hallProblems);

  // The gearling at the old mill: the fight starts, and the hero and the gearling stay in sight (mill-occlusion).
  await place('the gearling at the old mill', 'place-mill.png', new Function(`return (async () => {
    const look = ${looks};
    const g = window.__game; g.newGame(); g.skipTo('pump'); g.setTime(0.45);
    g.teleport('ruin-mill'); await g.frames(60);
    for (let i = 0; i < 4 && g.view.game.systems.talk.active; i++) { g.talkThrough(); await g.frames(10); }
    await g.frames(60);
    const running = g.view.game.systems.fights.running?.();
    if (!running) return ['the gearling fight did not start at the old mill'];
    const problems = look('fight start');
    if (!g.sight().some((b) => b.who.startsWith('beast:'))) problems.push('fight start: no beast is kept in sight');
    return problems;
  })()`));
}

} catch(error) { failures.push(String(error)); console.error(error); } finally {
await browser.close();
if (serverPid) {try { process.kill(serverPid); } catch(error) {if(error.code!=='ESRCH')failures.push('server cleanup: '+String(error));} }
}
writeFileSync(resolve(out, 'sight.json'), JSON.stringify(results, null, 2));
console.log(failures.length === 0 ? `PASS: ${results.length} checked` : `FAIL: ${failures.length} problems in ${results.filter((r) => r.problems.length).length} of ${results.length}`);
process.exit(failures.length === 0 ? 0 : 1);
