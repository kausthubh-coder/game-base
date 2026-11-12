// Independent scene 9 playtest. Real browser inputs; debug door only sets the allowed quest/time/place entry.
// bun tools/cut-player-test.mjs [watch|skip|natural|reload|variants] [base URL]
import { launchChrome } from './lib/chrome.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const mode = process.argv[2] || 'watch',
  base = process.argv[3] || 'http://127.0.0.1:5410/experiment/';
const out = '.artifacts/cut-test';
mkdirSync(out, { recursive: true });
const browser = await launchChrome();
const results = [];
const log = (name, data) => {
  results.push({ name, data });
  console.log(name, JSON.stringify(data));
  writeFileSync(`${out}/${mode}.json`, JSON.stringify(results, null, 2));
};
async function open(query = '', options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', (e) => log('pageerror', String(e)));
  await page.goto(base + query);
  await page.waitForFunction(() => !!window.__game);
  return { page, context };
}
const on = (p) => p.waitForFunction(() => document.querySelector('.sf-cinema')?.hidden === false);
const off = (p) =>
  p.waitForFunction(
    () => document.querySelector('.sf-cinema')?.hidden === true && !window.__game.state().paused,
  );
const state = (p) =>
  p.evaluate(() => ({
    state: window.__game.state(),
    fox: window.__game.view.game.systems.hall.fox(),
    text: document.body.innerText,
    audio: window.__game.view.audio?.debug(),
    volumes: ['master', 'music', 'ambience', 'effects'].map((x) => [
      x,
      window.__game.view.audio?.getVolume(x),
    ]),
  }));
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png` });
try {
  if (['watch', 'reduced-live'].includes(mode)) {
    const { page: p, context: c } = await open(
      '',
      mode === 'reduced-live' ? { reducedMotion: 'reduce' } : {},
    );
    // Log actual Web Audio node starts and record the live mix without changing its destination.
    await p.evaluate(() => {
      window.soundStarts = [];
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...a) {
        window.soundStarts.push({
          kind: 'osc',
          time: performance.now(),
          frequency: this.frequency.value,
          type: this.type,
        });
        return start.apply(this, a);
      };
      const bs = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a) {
        window.soundStarts.push({
          kind: 'buffer',
          time: performance.now(),
          loop: this.loop,
          duration: a[2],
        });
        return bs.apply(this, a);
      };
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (...a) {
        if (a[0] instanceof AudioDestinationNode && !window.recorder) {
          const dest = this.context.createMediaStreamDestination();
          connect.call(this, dest);
          window.parts = [];
          window.recorder = new MediaRecorder(dest.stream);
          window.recorder.ondataavailable = (e) => window.parts.push(e.data);
          window.recorder.start();
        }
        return connect.apply(this, a);
      };
    });
    await p.getByRole('button', { name: 'Play scene 9: Something outside', exact: true }).click();
    await on(p);
    const start = Date.now();
    for (const t of [1, 3.5, 7.5, 9.6, 11, 13, 15, 16.5, 18.5, 20.5, 22, 23.5]) {
      await p.waitForTimeout(Math.max(0, t * 1000 - (Date.now() - start)));
      await shot(p, `${mode}-${t}`);
      log(`${mode}-${t}`, await state(p));
    }
    await off(p);
    await shot(p, `${mode}-after`);
    log('after-watch', await state(p));
    const recording = await p.evaluate(async () => {
      if (!window.recorder) return null;
      await new Promise((r) => {
        window.recorder.onstop = r;
        window.recorder.stop();
      });
      const b = new Blob(window.parts, { type: window.recorder.mimeType });
      return { data: Array.from(new Uint8Array(await b.arrayBuffer())), mime: b.type };
    });
    if (recording) writeFileSync(`${out}/${mode}-audio.webm`, Buffer.from(recording.data));
    log('sound-starts', await p.evaluate(() => window.soundStarts));
    await p.keyboard.down('w');
    await p.waitForTimeout(1000);
    await p.keyboard.up('w');
    await p.waitForTimeout(1000);
    await shot(p, 'walk-after');
    log('walk-after', await state(p));
    await c.close();
  }
  if (mode === 'skip')
    for (const method of ['Escape', 'button'])
      for (const t of [0.3, 3, 15, 24]) {
        const { page: p, context: c } = await open('?scene=9');
        await on(p);
        await p.waitForTimeout(t * 1000);
        if (method === 'Escape') await p.keyboard.press('Escape');
        else {
          const box = await p.getByRole('button', { name: /Skip/ }).boundingBox();
          if (box) await p.mouse.click(box.x + box.width / 2, Math.max(1, box.y + box.height / 2));
        }
        await off(p);
        await p.waitForTimeout(650);
        const end = await state(p);
        log(`${method}-${t}`, end);
        if (
          end.state.player.busy ||
          end.state.flags['quest.night.step'] !== 'door' ||
          Math.hypot(end.state.player.x + 20.5, end.state.player.z + 229.5) > 0.3 ||
          !end.fox
        )
          throw new Error('Skip did not restore the expected world');
        await c.close();
      }
  if (mode === 'variants') {
    for (const [name, options, query] of [
      ['narrow', { viewport: { width: 390, height: 844 } }, ''],
      ['reduced', { reducedMotion: 'reduce' }, ''],
      ['low', {}, '&quality=low'],
    ])
      for (const t of [3.5, 7.5, 11, 16.5, 20.5, 23.5]) {
        const { page: p, context: c } = await open('?scene=9&cut-at=' + t + query, options);
        await on(p);
        await p.evaluate(() => window.__game.settle());
        await shot(p, `${name}-${t}`);
        log(`${name}-${t}`, await state(p));
        await c.close();
      }
  }
  if (mode === 'reload')
    for (const t of [3, 15, 25.5]) {
      const { page: p, context: c } = await open('?scene=9');
      await on(p);
      await p.waitForTimeout(t * 1000);
      log(`before-${t}`, await state(p));
      await p.reload();
      await p.waitForFunction(() => window.__game?.state().started);
      await p.waitForTimeout(1500);
      await shot(p, `reload-${t}`);
      log(`reload-${t}`, await state(p));
      await c.close();
    }
  if (mode === 'morning') {
    const { page: p, context: c } = await open('?scene=9', {
      storageState: out + '/journey-storage.json',
    });
    await p.waitForFunction(() => window.__game.state().started);
    await shot(p, 'morning-start');
    log('morning-start', await state(p));
    await p.keyboard.down('w');
    await p.keyboard.down('d');
    await p.waitForTimeout(500);
    await p.keyboard.up('w');
    await p.keyboard.up('d');
    await p.keyboard.press('e');
    for (let i = 0; i < 24; i++) {
      await p.keyboard.press('Enter');
      await p.waitForTimeout(250);
    }
    await shot(p, 'heart-finished');
    log('heart-finished', await state(p));

    for (let i = 0; i < 8; i++) {
      await p.waitForTimeout(25000);
      log('dawn-wait-' + i, await state(p));
      if ((await state(p)).state.flags['night.over']) break;
    }
    await shot(p, 'morning');
    log('morning', await state(p));
    await c.close();
  }
  if (mode === 'portrait-check') {
    for (let trial = 1; trial <= 3; trial++) {
      const { page: p, context: c } = await open('?scene=9&cut-at=20.5', {
        viewport: { width: 390, height: 844 },
      });
      await on(p);
      await p.evaluate(() => window.__game.settle());
      await shot(p, `portrait-repro-${trial}`);
      const positions = await p.evaluate(() => {
        const g = window.__game,
          v = g.view,
          places = v.game.systems.region;
        return ['camp.seat', 'camp.edge'].map((n) => {
          const a = places.place(n).at;
          return { name: n, screen: v.project(a.x, a.y + 0.8, a.z) };
        });
      });
      log(`portrait-${trial}`, positions);
      await c.close();
    }
    if (results.some((r) => r.name.startsWith('portrait-') && r.data.some((a) => !a.screen))) {
      console.error(
        'FAIL: shot 5 must contain hero and fox; projected actors are outside the viewport.',
      );
      process.exitCode = 1;
    } else console.log('PASS: both actors project into the viewport');
  }
  if (mode === 'journey') {
    const { page: p, context: c } = await open('?scene=9');
    await on(p);
    await off(p);
    const hold = async (keys, ms) => {
      for (const k of keys) await p.keyboard.down(k);
      await p.waitForTimeout(ms);
      for (const k of keys) await p.keyboard.up(k);
    };
    await hold(['d'], 1000);
    await hold(['w', 'd'], 2700);
    await shot(p, 'door-arrival');
    log('door-arrival', await state(p));
    for (let i = 0; i < 12; i++) {
      await p.keyboard.press('Enter');
      await p.waitForTimeout(350);
    }
    await shot(p, 'door-after-talk');
    log('door-after-talk', await state(p));
    await hold(['w', 'd'], 1900);
    await shot(p, 'inside-door');
    log('inside-door', await state(p));
    for (let i = 0; i < 12; i++) {
      await p.keyboard.press('Enter');
      await p.waitForTimeout(350);
    }
    await shot(p, 'inside-after-talk');
    log('inside-after-talk', await state(p));
    await hold(['w', 'd'], 1600);
    await shot(p, 'hall-mark');
    log('hall-mark', await state(p));
    for (let i = 0; i < 15; i++) {
      await p.keyboard.press('Enter');
      await p.waitForTimeout(350);
    }
    await shot(p, 'hall-next');
    log('hall-next', await state(p));
    await hold(['w', 'd'], 1400);
    await p.keyboard.press('e');
    await shot(p, 'hall-key');
    log('hall-key', await state(p));
    for (let i = 0; i < 20; i++) {
      await p.keyboard.press('Enter');
      await p.waitForTimeout(350);
    }
    await shot(p, 'hall-key-after');
    log('hall-key-after', await state(p));
    await hold(['s', 'd'], 1350);
    await hold(['s', 'a'], 350);
    await p.keyboard.press('e');
    await shot(p, 'custodian');
    log('custodian', await state(p));
    for (let i = 0; i < 22; i++) {
      await p.keyboard.press('Enter');
      await p.waitForTimeout(250);
    }
    await shot(p, 'custodian-after');
    log('custodian-after', await state(p));
    await hold(['w', 'a'], 1350);
    await hold(['s', 'a'], 1800);
    await p.keyboard.press('e');
    await shot(p, 'fox-hand');
    log('fox-hand', await state(p));
    for (let i = 0; i < 12; i++) {
      await p.keyboard.press('Enter');
      await p.waitForTimeout(250);
    }
    await shot(p, 'fox-hand-after');
    log('fox-hand-after', await state(p));
    await hold(['w', 'd'], 1800);
    await p.keyboard.press('e');
    for (let i = 0; i < 20; i++) {
      await p.keyboard.press('Enter');
      await p.waitForTimeout(250);
    }
    await shot(p, 'heart-after');
    log('heart-after', await state(p));
    await p.evaluate(() => window.__game.save());
    await c.storageState({ path: out + '/journey-storage.json' });

    await c.close();
  }
  if (mode === 'natural') {
    const { page: p, context: c } = await open();
    await p.getByRole('button', { name: 'New game', exact: true }).click();
    await p.waitForFunction(() => window.__game?.state().started);
    await p.locator('.st-cinema:not([hidden])').waitFor();
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => document.querySelector('.st-cinema')?.hidden === true);
    await p.evaluate(() => {
      window.__game.skipTo('night');
      window.__game.teleport('camp.seat');
      window.__game.setTime(0.72);
    });
    await p.waitForTimeout(600);
    await shot(p, 'natural-before');
    log('natural-before', await state(p));
    await p.keyboard.press('w');
    await p.evaluate(() => window.__game.setTime(0.782));
    await on(p);
    log('natural-film', await state(p));
    for (const key of ['b', 'm', 'i', 'q', 'e', ' ', '1', 'Tab']) await p.keyboard.press(key);
    await p.mouse.click(640, 360);
    await p.mouse.wheel(0, 500);
    await p.keyboard.down('w');
    await shot(p, 'inputs-during');
    log('inputs-during', await state(p));
    await off(p);
    await p.keyboard.up('w');
    await p.keyboard.press('m');
    await shot(p, 'inputs-after');
    log('inputs-after', await state(p));
    await p.keyboard.press('Escape');
    await p.keyboard.press('b');
    await shot(p, 'bag-after');
    log('bag-after', await state(p));
    await p.keyboard.press('Escape');
    await p.keyboard.down('w');
    await p.waitForTimeout(1400);
    await p.keyboard.up('w');
    await shot(p, 'natural-walk');
    log('natural-walk', await state(p));
    await c.close();
    const r = await open();
    await r.page.getByRole('button', { name: 'New game', exact: true }).click();
    await r.page.waitForFunction(() => window.__game?.state().started);
    await r.page.locator('.st-cinema:not([hidden])').waitFor();
    await r.page.keyboard.press('Escape');
    await r.page.waitForFunction(() => document.querySelector('.st-cinema')?.hidden === true);
    await r.page.evaluate(() => {
      window.__game.skipTo('night');
      window.__game.teleport('grant.stone');
      window.__game.setTime(0.782);
    });
    await r.page.keyboard.press('w');
    await r.page.waitForTimeout(1500);
    await shot(r.page, 'away-dusk');
    log('away-dusk', await state(r.page));
    await r.context.close();
  }
} finally {
  await browser.close();
}
