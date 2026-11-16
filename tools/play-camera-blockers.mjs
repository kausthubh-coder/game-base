import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { cameraStill } from './play/wait.mjs';
import { sample, canStartHeavy } from './resource-status.mjs';
import { HALL } from '../src/game/content/region.ts';
import { BLOCKS } from '../src/content/blocks.ts';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
if (args.includes('--help')) {
  console.log('bun tools/play-camera-blockers.mjs --url <immutable runtime> --out <new directory> --active-heavy-jobs <0|1>');
  process.exit(0);
}
const base = opt('url'), directory = opt('out'), active = Number(opt('active-heavy-jobs'));
if (!base || !directory || !Number.isInteger(active) || active < 0 || active > 1) throw Error('Supply --url, --out and coordinator-confirmed --active-heavy-jobs. This tool starts no server or build.');
const out = resolve(directory);
if (existsSync(out)) throw Error('Choose a new output directory to preserve evidence.');
mkdirSync(out, { recursive: true });
const admission = await sample();
writeFileSync(resolve(out, 'admission.json'), JSON.stringify(admission, null, 2));
if (!canStartHeavy(admission, active)) throw Error('Browser admission denied.');
const monitor = setInterval(async () => { try { const status = await sample(); writeFileSync(resolve(out, `resource-${Date.now()}.json`), JSON.stringify(status, null, 2)); } catch {} }, 30000);
const browser = await launchChrome();
const checks = [], errors = [];
const save = (name, value) => writeFileSync(resolve(out, name), JSON.stringify(value, null, 2));
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(45000);
  page.on('response', r=>{if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`);});
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (['error','warning'].includes(message.type())) errors.push(message.text()); });
  const url = new URL(base);
  url.searchParams.set('hold', '1'); url.searchParams.set('quality', 'high');
  await page.goto(url.href);
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(async () => {
    const g = window.__game;
    g.newGame(); await g.settle(); g.manual(true);
    if (g.view.game.systems.talk.active) g.view.game.systems.talk.skip();
    g.setCamera('tilt');
    g.teleport('grant.center'); await g.settle();
    g.view.game.systems.talk.start('memory.pumphouse.again');
    if (g.view.game.actors.get('player').visible) throw Error('The memory did not hide the hero.');
    g.setCamera('first'); g.talkThrough(); g.look(0, 75);
  });
  // Observe the real actor synchronizer finishing, rather than waiting an arbitrary frame count.
  await page.evaluate(() => new Promise(resolve => {
    const off = window.__game.view.onFrame(() => { off(); requestAnimationFrame(resolve); });
  }));
  await cameraStill(page);
  const body = await page.evaluate(() => {
    const g = window.__game, v = g.view, actor = v.game.actors.get('player');
    const place = v.assets.spriteAtlas().place(actor.sprite);
    const mesh = v.ctx.scene.getObjectByName('sprites');
    const row = mesh.geometry.attributes.aRow, frame = mesh.geometry.attributes.aFrame;
    const slots = [];
    for (let i = 0; i < mesh.geometry.instanceCount; i++) {
      if (row.getX(i) === place.x && row.getY(i) >= place.y && row.getY(i) < place.y + place.height && frame.getZ(i) === place.page)
        slots.push({ index: i, visible: frame.getW(i) !== 0 });
    }
    return { mode: v.camera.mode, actorVisible: actor.visible, slots, sight: g.sight(), state: g.state() };
  });
  save('first-person.json', body);
  await page.screenshot({ path: resolve(out, 'first-person-down.png') });
  checks.push({ name: 'memory cleanup restores logical actor', pass: body.actorVisible === true });
  checks.push({ name: 'first person hides rendered hero', pass: body.mode === 'first' && body.slots.length === 1 && body.slots.every(slot => !slot.visible) });
  checks.push({ name: 'first person excludes hidden body from sight', pass: !body.sight.some(body => body.who === 'player') });

  // Sprites must restore in orbit modes and stay concealed after real memory cleanup.
  for (const chars of ['sprites']) {
    await page.evaluate(async () => {
      const g = window.__game; await g.settle();
      g.setCamera('tilt'); g.view.game.systems.talk.start('memory.pumphouse.again');
      g.setCamera('free');
      if (g.view.game.actors.get('player').visible) throw Error('mode switch restored story-hidden hero');
      g.setCamera('first'); g.talkThrough(); g.look(0,75);
    });
    await cameraStill(page);
    const concealed = await page.evaluate(() => {
      const g=window.__game, meshes=[];
      g.view.ctx.scene.traverse(o=>{if(o.name.startsWith('toon-') && o.name.includes('hero')) meshes.push({name:o.name,count:o.count,visible:o.visible,layers:o.layers.mask,cameraLayers:g.view.ctx.camera.layers.mask,drawnToCamera:g.view.ctx.camera.layers.test(o.layers)});});
      return {actor:g.view.game.actors.get('player').visible,sight:g.sight(),meshes};
    });
    save(chars+'-concealed.json',concealed);
    await page.screenshot({path:resolve(out,chars+'-down.png')});
    checks.push({name:chars+' memory logical restoration',pass:concealed.actor===true});
    for(const mode of ['free','tilt']) {
      await page.evaluate(mode=>{const g=window.__game;g.setCamera(mode);g.look(0,35,14);},mode);
      await cameraStill(page);
      save(chars+'-'+mode+'.json',await page.evaluate(()=>({state:window.__game.state(),sight:window.__game.sight()})));
      await page.screenshot({path:resolve(out,chars+'-'+mode+'.png')});
      checks.push({name:chars+' '+mode+' restores hero sight',pass:await page.evaluate(()=>window.__game.sight().some(b=>b.who==='player'))});
    }
  }
  // A separate copied earned boundary enables ordinary HUD/menu interactions.
  await page.evaluate(raw=>localStorage.setItem('greenhollow.save',raw),readFileSync('.artifacts/grantday-framing-review/input/earned-landing.save.json','utf8'));
  await page.goto(base);await page.waitForFunction(()=>!!window.__game);
  await page.getByRole('button',{name:'Begin',exact:true}).click();
  await page.waitForFunction(()=>window.__game.started&&!window.__game.state().player.busy);
  // Browser-delivered mouse and Escape events, observed after the real handlers.
  await page.evaluate(()=>{
    const g=window.__game;g.setCamera('free');g.view.keys.setMouse('drag');g.manual(false);
    window.__cancelProof=[];
    for(const type of ['keyup','pointerup']) window.addEventListener(type,e=>{
      if(type==='keyup' && e.code!=='Escape')return;
      const look={x:0,y:0};g.view.keys.takeLook(look);
      window.__cancelProof.push({type,look,dragging:g.view.keys.dragging});
    });
  });
  await page.mouse.move(650,350);await page.mouse.down({button:'right'});await page.mouse.move(720,380,{steps:5});
  await page.keyboard.press('Escape');await page.mouse.up({button:'right'});
  await page.keyboard.press('Escape');
  await page.mouse.move(650,350);await page.mouse.down({button:'right'});await page.mouse.move(710,370,{steps:5});await page.mouse.up({button:'right'});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  const uiCancel=await page.evaluate(()=>{const look={x:0,y:0};window.__game.view.keys.takeLook(look);return {look,dragging:window.__game.view.keys.dragging};});
  save('ui-cancel.json',uiCancel);checks.push({name:'Resume UI leaves no pending look',pass:!uiCancel.dragging&&uiCancel.look.x===0&&uiCancel.look.y===0});
  const cancels=await page.evaluate(()=>window.__cancelProof);save('desktop-cancel.json',cancels);
  checks.push({name:'Escape and right release cancel pending look',pass:cancels.length>=2 && cancels.every(c=>!c.dragging && c.look.x===0 && c.look.y===0)});
  await page.screenshot({path:resolve(out,'desktop-cancel.png')});
  await page.evaluate(async (hall) => {
    const g = window.__game;
    g.teleport(hall.court.x1 + 4, hall.ground, hall.court.z1 + 6);
    await g.settle(); g.setCamera('free'); g.look(45, 15, 14);
  }, HALL);
  await cameraStill(page);
  const hall = await page.evaluate(({ hall, blocks }) => {
    const g = window.__game, c = hall.court, y = hall.ground;
    const positions = [[c.x1,y,c.z0+3], [c.x1,y+2,c.z0+3], [c.x0+3,y+2,c.z0], [c.x0+3,y+6,c.z0+3]];
    return { state: g.state(), samples: positions.map(([x,y,z]) => ({ x,y,z, block: blocks[g.view.world.sim.getBlock(x,y,z)]?.key })), cutaway: g.view.camera.cutaway };
  }, { hall: HALL, blocks: BLOCKS });
  save('hall-exterior.json', hall);
  await page.screenshot({ path: resolve(out, 'hall-exterior.png') });
  checks.push({ name: 'no console or page errors', pass: errors.length === 0 });
  save('result.json', { url: base, renderer: browser.gameRenderer, checks, errors });
  for (const check of checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
  if (checks.some(check => !check.pass)) process.exitCode = 1;
} finally {
  if(!existsSync(resolve(out,'result.json'))) save('result.json',{url:base,checks,errors,incomplete:true});
  clearInterval(monitor);
  await browser.close();
}
