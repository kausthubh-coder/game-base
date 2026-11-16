import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const url = opt('--url', 'http://127.0.0.1:5800');
const out = resolve(opt('--out', '.artifacts/mobile-controls/run'));
mkdirSync(out, { recursive: true });
const results = [], errors = [];
const browser = await launchChrome();
try {
  for (const [name, width, height] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on('pageerror', e => errors.push(String(e)));
    const cdp = await context.newCDPSession(page);
    const fingers = new Map();
    async function finger(type, id, x, y) {
      if (type === 'touchEnd' || type === 'touchCancel') fingers.delete(id);
      else fingers.set(id, { id, x, y });
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...fingers.values()] });
    }
    async function center(selector) {
      const rect = await page.locator(selector).boundingBox();
      if (!rect) throw new Error(`Missing ${selector}`);
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }
    async function tap(selector) { const p = await center(selector); await page.touchscreen.tap(p.x, p.y); }
    const read = () => page.evaluate(() => ({ state: window.__game.state(), right: window.__game.view.keys.right,
      forward: window.__game.view.keys.forward, primary: window.__game.view.keys.primary,
      jump: window.__game.view.keys.jump, calm: window.__game.view.keys.touch.calmHeld,
      pointer: { ...window.__game.view.keys.pointer }, paused: window.__game.view.paused }));
    function check(label, pass) { results.push({ orientation: name, label, pass: !!pass }); if (!pass) throw new Error(`${name}: ${label}`); }
    await page.goto(`${url}/?quality=low`, { waitUntil: 'load' });
    await page.locator('[data-key="title:new"]').waitFor();
    await page.screenshot({ path: resolve(out, `${name}-title.png`) });
    await tap('[data-key="title:new"]');
    await page.locator('.st-film:not([hidden]) [data-key="opening:skip"]').waitFor();
    await page.waitForFunction(()=>document.querySelector('.ui-touch')?.hidden);
    check('opening film hides touch controls and clears holds', await page.evaluate(()=>{const k=window.__game.view.keys;return !k.primary&&!k.jump&&k.right===0&&k.forward===0;}));
    await tap('[data-key="opening:skip"]');
    await page.waitForFunction(() => window.__game?.started && !document.querySelector('.ui-book.st-film-on'));
    await page.locator('.st-film:not([hidden])').waitFor({ state: 'hidden' });
    await page.waitForFunction(()=>window.__game.view.game.flags.is('scene.1') || window.__game.view.game.systems.talk?.active);
    for (let i = 0; i < 50; i++) {
      if (await page.evaluate(()=>window.__game.view.game.flags.is('scene.1')) && await page.locator('.ui-touch:not([hidden])').isVisible() && !await page.locator('.gb-dialogue-box:visible').isVisible()) break;
      const choice = page.locator('[data-choice]:visible').first();
      if (await choice.isVisible()) await choice.tap();
      else {
        const dialogue = page.locator('.gb-dialogue-box:visible');
        if (await dialogue.isVisible()) await dialogue.tap();
      }
      await page.waitForFunction(() => !!window.__game?.started);
    }
    await page.locator('.ui-touch:not([hidden])').waitFor();
    await page.waitForFunction(() => !document.querySelector('.ui-book.st-film-on, .ui-book.ui-talking, .ui-book.st-cinema-on'));
    await page.screenshot({ path: resolve(out, `${name}-controls.png`) });
    const targets = await page.locator('.ui-touch button:visible').evaluateAll(nodes => nodes.map(n => {
      const r = n.getBoundingClientRect(); return { label: n.textContent, x:r.x,y:r.y,width:r.width,height:r.height };
    }));
    check('targets are at least 44px and inside viewport', targets.every(r => r.width >= 44 && r.height >= 44 && r.x >= 0 && r.y >= 0 && r.x + r.width <= width && r.y + r.height <= height));
    const hits = await page.locator('.ui-touch button:visible').evaluateAll(nodes => nodes.map(n => {
      const r = n.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
      return hit === n || n.contains(hit);
    }));
    check('every control receives touches without an overlay', hits.every(Boolean));
    const slotsHit = await page.locator('.gb-slot:visible').evaluateAll(nodes => nodes.every(n => {
      const r=n.getBoundingClientRect(), hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return hit===n || n.contains(hit);
    }));
    check('all quick slots receive touches', slotsHit);
    await page.evaluate(() => { window.__touchObserved=[]; window.__game.view.keys.onPress(p=>window.__touchObserved.push(p)); });
    const readable = await page.evaluate(() => {
      const visible = el => el && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
      const overlap = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const controls = [...document.querySelectorAll('.ui-touch button')].filter(visible).map(el=>el.getBoundingClientRect());
      const words = [...document.querySelectorAll('.gb-hud-sky,.gd-coin,.gb-hud-quest,.gu-hint,.gb-hud-minimap')].filter(visible).map(el=>({selector:el.className,text:el.textContent,rect:el.getBoundingClientRect().toJSON(),textRects:(()=>{const range=document.createRange();range.selectNodeContents(el);return [...range.getClientRects()].map(r=>r.toJSON());})()}));
      const hint=document.querySelector('.gu-hint-text');
      return {words, clear:controls.length>0 && words.length>0 && words.every(el=>[el.rect,...el.textRects].every(text=>!controls.some(r=>overlap(text,r)))),
        touchHelp:!hint || !visible(hint) || (/stick/i.test(hint.textContent) && !/W, A|right button|Q and R/i.test(hint.textContent)),
        hintQuestClear:!words.some(a=>a.selector.includes('gu-hint') && words.some(b=>b.selector.includes('gb-hud-quest') && overlap(a.rect,b.rect)))};
    });
    writeFileSync(resolve(out, `${name}-readable-layout.json`),JSON.stringify(readable,null,2));
    if (!args.includes('--input-only')) {
    check('day, time, coin, quest and hint avoid control rectangles', readable.clear);
    check('visible startup help describes touch controls', readable.touchHelp);
    check('startup help avoids the quest rectangle', readable.hintQuestClear);
    }
    writeFileSync(resolve(out, `${name}-readable-layout.json`),JSON.stringify(readable,null,2));
    const start = (await read()).state.player;
    const move = await center('[data-touch="move"]');
    await finger('touchStart', 1, move.x, move.y);
    await finger('touchMove', 1, move.x + 44, move.y);
    await page.waitForFunction(p => {
      const now = window.__game.state().player; return Math.hypot(now.x-p.x, now.z-p.z) > .15;
    }, start);
    check('stick walks through normal input', (await read()).right > .5);
    await finger('touchEnd', 1);
    check('stick release stops input', (await read()).right === 0);
    const before = (await read()).state.camera.yaw;
    await finger('touchStart', 2, width / 2, height * .45);
    await finger('touchMove', 2, width / 2 + 65, height * .45);
    await finger('touchEnd', 2);
    await page.waitForFunction(yaw => Math.abs(window.__game.state().camera.yaw - yaw) > .01, before);
    check('swipe turns without lock', !(await read()).state.camera.locked);
    await page.touchscreen.tap(width * .45, height * .6);
    check('world touch aims normal pointer', Math.abs((await read()).pointer.x + .1) < .02);
    const use = await center('[data-touch="use"]');
    await finger('touchStart', 3, use.x, use.y);
    check('Use holds primary', (await read()).primary);
    await finger('touchCancel', 3);
    check('cancel releases primary', !(await read()).primary);
    const jump = await center('[data-touch="jump"]');
    await finger('touchStart', 4, jump.x, jump.y);
    check('Jump holds normal jump input', (await read()).jump);
    await finger('touchEnd', 4);
    const calm = await center('[data-touch="calm"]');
    await finger('touchStart', 5, calm.x, calm.y);
    check('Calm holds fight input', (await read()).calm);
    await finger('touchEnd', 5);
    check('Calm release clears fight input', !(await read()).calm);
    await tap('[data-touch="dodge"]');
    await tap('[data-touch="skill"]');
    await tap('[data-touch="place"]');
    await tap('[data-touch="tools"]');
    await tap('[data-touch="build"]');
    await tap('[data-touch="undo"]');
    await tap('[data-touch="tools"]');
    const observed = await page.evaluate(()=>window.__touchObserved);
    check('touch actions enter the normal typed Press channel', ['dodge','skill','use'].every(action=>observed.some(p=>p.kind==='fight'&&p.action===action)) && observed.some(p=>p.kind==='use'&&p.button==='secondary') && observed.some(p=>p.kind==='build') && observed.some(p=>p.kind==='undo'));
    await page.evaluate(()=>{window.__captureEvents=[];for(const name of ['pointerdown','pointermove','gotpointercapture','lostpointercapture'])document.querySelector('[data-touch="use"]').addEventListener(name,e=>{if(name==='pointerdown')window.__touchCaptureId=e.pointerId;window.__captureEvents.push({name,id:e.pointerId,type:e.pointerType});});});
    await finger('touchStart', 8, move.x, move.y);
    await finger('touchMove', 8, move.x + 44, move.y);
    await finger('touchStart', 9, use.x, use.y);
    check('movement and Use hold simultaneously',(await read()).right>.5&&(await read()).primary);
    await finger('touchMove',9,use.x+32,use.y);
    await page.waitForFunction(()=>window.__captureEvents.some(e=>e.name==='gotpointercapture'),{},{timeout:5000});
    await page.evaluate(()=>document.querySelector('[data-touch="use"]').releasePointerCapture(window.__touchCaptureId));
    await finger('touchMove',9,use.x+80,use.y);
    await page.waitForFunction(()=>window.__captureEvents.some(e=>e.name==='lostpointercapture'),{},{timeout:5000});
    await page.waitForFunction(()=>!window.__game.view.keys.primary&&window.__game.view.keys.right===0,{},{timeout:5000});
    writeFileSync(resolve(out, `${name}-capture-lifecycle.json`),JSON.stringify(await page.evaluate(()=>window.__captureEvents),null,2));
    await finger('touchMove',8,move.x+90,move.y);
    check('lost capture cancels all fingers until a new press',(await read()).right===0&&!(await read()).primary);
    await finger('touchEnd',9); await finger('touchEnd',8);
    await tap('[data-touch="pause"]');
    await page.getByRole('button',{name:'Resume',exact:true}).waitFor();
    check('Pause opens and clears input',(await read()).paused&&(await read()).right===0&&!(await read()).primary);
    await page.getByRole('button',{name:'Resume',exact:true}).tap();
    await page.locator('.ui-touch:not([hidden])').waitFor();
    await tap('[data-touch="bag"]');
    check('bag cancels movement and primary', (await read()).right === 0 && !(await read()).primary);
    await page.screenshot({ path: resolve(out, `${name}-bag.png`) });
    const close = page.locator('[data-key="close"]:visible, [data-key="bag:close"]:visible, .gu-screen-close:visible').first();
    if (await close.isVisible()) await close.tap();
    else {
      const button = page.getByRole('button', { name: 'Close', exact: true }).first();
      await button.tap();
    }
    await page.locator('.ui-touch:not([hidden])').waitFor();
    await tap('[data-touch="map"]');
    await page.screenshot({ path: resolve(out, `${name}-map.png`) });
    check('map hides touch actions', !(await page.locator('.ui-touch').isVisible()));
    writeFileSync(resolve(out, `${name}-state.json`), JSON.stringify({ ...(await read()), targets }, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(resolve(out, 'results.json'), JSON.stringify({ mode:args.includes('--input-only')?'input-only-diagnostic':'full-touch',results, errors }, null, 2));
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(`PASS ${results.length} touch checks; evidence ${out}`);
