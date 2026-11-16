// Plays whole conversations in the real page and listens to each voiced line: builds the game, serves it, starts
// a new game with a real click, and opens each conversation through the talk system. Each voiced line must fetch
// its clip (200), decode to the length the list gives, play to its end and finish typing with it; then a real
// Enter goes on (or a click on the first choice).
//   bun tools/play-voices.mjs [scene.33 scene.16 ...] [--port 5340] [--dist dist-voices] [--no-build]
//
// With no conversation named it plays scene 33 (the Stag), scene 16 (the Green Mother's visit) and scene 24 (the
// first memory). One line per voiced line, and the whole log in .artifacts/voice/play-voices.json.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const valued = new Set(['--port', '--dist']);
const named = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
const CONVERSATIONS = named.length ? named : ['scene.33', 'scene.16', 'scene.24'];
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/voice');
const PORT = Number(opt('port', process.env.PLAY_PORT || '5340'));
const dist = opt('dist', 'dist-voices');
const BASE = `http://127.0.0.1:${PORT}/?quality=low`;
mkdirSync(out, { recursive: true });

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error(`FAIL: the build into ${dist}`); process.exit(1); }
}

// The server prints its pid, and it is stopped by that pid, never by port.
const server = spawn('bun', ['tools/serve.mjs', dist, String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => { text += chunk; const pid = /pid (\d+)/.exec(text); if (pid) done(Number(pid[1])); });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});
console.log(`serving ${dist} on ${BASE}  pid ${serverPid}`);

const problems = [];
const must = (ok, text) => { if (!ok) problems.push(text); };
const errors = [];
const clipStatus = new Map();
const log = [];
let browser;
try {
  browser = await launchChrome({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.setDefaultTimeout(180000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { const m = /\/assets\/((?:fingerprinted\/)?voice\/.+\.mp3)$/.exec(r.url()); if (m) clipStatus.set(m[1], r.status()); });
  const game = (js, arg) => page.evaluate(js, arg);
  const frames = (n = 2) => game((count) => window.__game.frames(count), n);

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 180000 });
  await page.waitForSelector('.gu-stage-title:not([hidden])');
  await page.click('[data-key="title:new"]');
  await page.waitForFunction(() => window.__game.started);
  await page.waitForSelector('.st-film:not([hidden]) [data-key="opening:skip"]', { timeout: 60000 }).then(() => page.click('[data-key="opening:skip"]'), () => {});
  await page.waitForSelector('.st-film', { state: 'hidden', timeout: 60000 }).catch(() => {});
  await game(() => window.__game.settle());

  const open = () => game(() => window.__game.view.game.systems.talk.active);
  /** Listens through the open conversation to its end. */
  async function listen(id) {
    console.log(`\n${id}`);
    let said = '';
    for (let n = 0; n < 80 && (await open()); n++) {
      const line = await game(() => { const l = window.__game.view.game.systems.talk.current(); return l && { npc: l.npc, name: l.name, text: l.text, choices: l.choices.length }; });
      if (line?.npc) {
        const key = `${line.npc}|${line.text}`;
        // The record of this line appears when the box shows it.
        await page.waitForFunction((k) => window.__voice?.log.at(-1)?.key === k, key, { timeout: 5000, polling: 50 }).catch(() => {});
        if (!(await game((k) => window.__voice?.log.at(-1)?.key === k, key))) {
          log.push({ conversation: id, key, status: 'no clip' });
          must(false, `${key} has no clip`);
          console.log(`  ${line.name.padEnd(14)} NO CLIP  ${line.text}`);
        } else {
          await page.waitForFunction((k) => { const r = window.__voice.log.at(-1); return r.key !== k || !['loading', 'playing'].includes(r.status); }, key, { timeout: 30000, polling: 50 });
          await frames(2);
          const r = await game((k) => window.__voice.log.findLast((x) => x.key === k), key);
          log.push({ conversation: id, ...r });
          must(r.status === 'ended', `${key} did not play to its end (${r.status})`);
          must(r.http === 200, `${key}: its clip answered ${r.http}`);
          must(Math.abs((r.decoded ?? 0) - r.seconds) <= 0.1, `${key} decoded to ${r.decoded} s, the list says ${r.seconds} s`);
          must(r.typedAt !== undefined && r.typedAt >= r.lastLetter - 0.05, `${key} did not type in time with its clip (typed at ${r.typedAt}, last letter due at ${r.lastLetter})`);
          console.log(`  ${line.name.padEnd(14)} ${r.status.padEnd(7)} ${r.seconds.toFixed(2)} s  ${r.file}  ${line.text}`);
        }
      } else if (line && line.text !== said) {
        console.log(`  ${'(narration)'.padEnd(14)} ${line.text}`);
      }
      // The first Enter on a narrated line finishes its typing, the second goes on.
      said = line?.text ?? '';
      if (line?.choices) await page.click('.gb-dialogue-choices:not([hidden]) button');
      else await page.keyboard.press('Enter');
      await frames(1);
    }
    must(!(await open()), `${id} did not end`);
  }

  // A new game opens on a conversation of its own, and one may follow another: whatever is open is played first.
  const conversationNow = () => game(() => window.__voice?.log.at(-1)?.key ?? '');
  for (let n = 0; n < 4 && (await open()); n++) await listen(`the conversation open after a new game (${await conversationNow()})`);
  for (const id of CONVERSATIONS) {
    await game((c) => window.__game.view.game.systems.talk.start(c), id);
    await frames(2);
    must(await open(), `${id} did not open`);
    await listen(id);
    for (let n = 0; n < 4 && (await open()); n++) await listen(`the conversation open after ${id}`);
  }
  for (const [file, status] of clipStatus) must(status === 200, `${file} answered ${status}`);
  must(errors.length === 0, `console errors: ${errors.join(' | ').slice(0, 600)}`);
} catch (error) {
  problems.push(String(error?.stack ?? error));
} finally {
  await browser?.close();
  process.kill(serverPid);
}
writeFileSync(resolve(out, 'play-voices.json'), JSON.stringify({ conversations: CONVERSATIONS, log, problems }, null, 1) + '\n');
const played = log.filter((r) => r.status === 'ended').length;
console.log(`\n${played} of ${log.length} voiced lines played to their end; log in .artifacts/voice/play-voices.json`);
if (problems.length) {
  console.log(`FAIL:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('PASS');
