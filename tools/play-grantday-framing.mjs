// Local diagnostic fixture only. The full real-input proof remains play-grantday.mjs.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { openingFrame, framingIssues } from './lib/grantday-framing.mjs';
const args = process.argv.slice(2);
const opt = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const out = resolve(opt('--out', '.artifacts/grantday-framing/focused'));
mkdirSync(out, { recursive: true });
const port = process.env.PLAY_PORT || '5587';
const server = spawn('bun', ['tools/serve.mjs', opt('--dist', 'dist-grantday'), port], { stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
const frames = [], issues = [], errors = [];
try {
  await new Promise((r, j) => { server.stdout.on('data', b => { if (/pid \d+/.test(String(b))) r(); }); server.on('exit', c => j(Error('server exited ' + c))); });
  browser = await launchChrome();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(raw => localStorage.setItem('greenhollow.save', raw), readFileSync('.artifacts/grantday-input/mid-spar.save.json', 'utf8'));
  await page.goto(`http://127.0.0.1:${port}/?hold&quality=${opt('--quality', 'high')}`);
  await page.waitForFunction(() => window.__game);
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.waitForFunction(() => window.__game?.state().started && !window.__game.state().paused);
  // Disclosed fixture: finish the spar flag, position at the deed, and start the real scene.
  await page.evaluate(async () => {
    const g = window.__game;
    g.view.game.flags.set('scene.4', true);
    g.teleport(832, 22, 1622);
    await g.settle();
    await g.frames(20);
    if (!g.view.game.systems.talk.active) g.view.game.systems.talk.start('scene.5');
  });
  for (const scene of [5, 6]) {
    let last = '';
    for (let i = 0; i < 60; i++) {
      const frame = await openingFrame(page);
      if (!frame.line || frame.line.scene !== scene) break;
      const key = frame.line.npc + frame.line.text;
      const name = `scene-${scene}-${String(i).padStart(2, '0')}`;
      frames.push({ name, ...frame });
      issues.push(...framingIssues(frame).map(p => name + ': ' + p));
      await page.screenshot({ path: resolve(out, name + '.png') });
      if (key !== last) {
        last = key;
        await page.evaluate(() => window.__game.frames(60));
      } else {
        await page.evaluate(async () => { window.__game.view.game.systems.talk.advance(); await window.__game.frames(2); });
      }
    }
    await page.evaluate(() => window.__game.frames(90));
    if (scene === 5) await page.evaluate(async () => {
      const g = window.__game;
      g.view.game.systems.opening.sign('Fixture');
      g.teleport(852, 22, 1661);
      await g.frames(20);
      if (!g.view.game.systems.talk.active) g.view.game.systems.talk.start('scene.6');
    });
  }
  for (const n of [5, 6]) if (!frames.some(f => f.line.scene === n)) issues.push('missing scene ' + n);
  issues.push(...errors);
} finally {
  await browser?.close();
  if (server.exitCode === null) { server.kill(); await new Promise(r => server.once('exit', r)); }
  writeFileSync(resolve(out, 'framing.json'), JSON.stringify({ frames, issues, errors }, null, 2));
}
console.log(issues.length ? 'FAIL\n' + issues.join('\n') : 'PASS grant and quay framing');
process.exitCode = issues.length ? 1 : 0;
