// Real title Begin path; no build and no simulation clock changes.
// bun tools/play-opening-audio.mjs --dist <immutable-dist> --port 5833 --source <sha> --out <new-dir> [--cases skip,natural,initial-failure,late-skip]
// The disclosed probe inserts transparent analysers at actual destination connections.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { canStartHeavy, sample } from './resource-status.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const dist = opt('dist');
const source = opt('source');
const outArg = opt('out');
const cases = opt('cases', 'skip').split(',');
if (!dist || !source || !outArg || cases.some(c => !['skip', 'natural', 'initial-failure', 'late-skip'].includes(c))) {
  throw new Error('Required: --dist <existing-runtime> --source <sha> --out <new-directory>; optional --port, --cases');
}
const root = resolve(import.meta.dirname, '..');
const runtime = resolve(root, dist);
const out = resolve(root, outArg);
if (existsSync(out)) throw new Error(`Refusing to replace evidence: ${out}`);
mkdirSync(out, { recursive: true });
const port = Number(opt('port', '5833'));
// The coordinator supplies the machine-wide active count; the probe cannot reserve a slot.
const activeHeavyJobs = Number(opt('active-heavy-jobs', '0'));
const report = {
  source, runtime, indexSha256: createHash('sha256').update(readFileSync(resolve(runtime, 'index.html'))).digest('hex'),
  toolSha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'),
  command: process.argv.slice(1), activeHeavyJobs, started: new Date().toISOString(),
  instrumentation: 'AudioNode.connect intercepts only live context destination connections and inserts a transparent AnalyserNode. Production gain, scheduling and playback methods are unchanged. The world is identified by __game.view.audio.context. Other live context output is the film. This observes digital output before the OS audio device; it does not record room sound.',
  cases: [], resources: [], problems: [],
};
const save = () => writeFileSync(resolve(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
let server, browser, monitor;
try {
  // Admission belongs to the coordinator; this records the fresh launch sample too.
  report.resources.push(await sample());
  save();
  if (!canStartHeavy(report.resources.at(-1), activeHeavyJobs)) throw new Error('Fresh resource admission denied browser launch');
  server = spawn('bun', ['tools/serve.mjs', runtime, String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error('Server did not answer within 10 seconds')), 10000);
    server.stdout.on('data', chunk => { if (/pid \d+/.test(String(chunk))) { clearTimeout(timer); done(); } });
    server.once('exit', code => { clearTimeout(timer); fail(new Error(`Server exited ${code}`)); });
    server.once('error', fail);
  });
  report.serverPid = server.pid;
  browser = await launchChrome({ headless: true });
  report.renderer = browser.gameRenderer;
  monitor = setInterval(() => { void sample().then(s => { report.resources.push(s); save(); }).catch(e => { report.resources.push({ error: String(e) }); save(); }); }, 30000);
  for (const name of cases) {
    const result = { name, events: [], observations: [], problems: [], errors: [], warnings: [] };
    report.cases.push(result);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    let releaseLate;
    try {
      await context.addInitScript(() => {
        localStorage.setItem('greenhollow.settings', JSON.stringify({ quality: 'low', volumes: { master: 0.65, music: 0.8, ambience: 0.7, effects: 0.8, voice: 0.8 } }));
        const taps = [];
        const nativeConnect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (destination, ...rest) {
          if (destination === this.context.destination && this.context instanceof AudioContext) {
            const analyser = this.context.createAnalyser();
            analyser.fftSize = 256;
            nativeConnect.call(this, analyser, ...rest);
            nativeConnect.call(analyser, destination);
            taps.push({ context: this.context, analyser, data: new Float32Array(256), source: this.constructor.name });
            return destination;
          }
          return nativeConnect.call(this, destination, ...rest);
        };
        window.__openingAudioProbe = () => {
          const world = window.__game?.view.audio?.context;
          return {
            at: performance.now(), filmVisible: !!document.querySelector('.st-film:not([hidden])'),
            fading: !!document.querySelector('.st-film.st-out:not([hidden])'),
            game: window.__game?.state(),
            preference: window.__game?.view.settings.volume('master'),
            effectiveMaster: window.__game?.view.audio?.getVolume('master'),
            storedMaster: JSON.parse(localStorage.getItem('greenhollow.settings') ?? '{}').volumes?.master,
            outputs: taps.map((tap, id) => {
              tap.analyser.getFloatTimeDomainData(tap.data);
              let sum = 0, peak = 0;
              for (const x of tap.data) { sum += x * x; peak = Math.max(peak, Math.abs(x)); }
              return { id, role: tap.context === world ? 'world' : 'film', state: tap.context.state, source: tap.source, rms: Math.sqrt(sum / tap.data.length), peak, time: tap.context.currentTime };
            }),
          };
        };
      });
      const page = await context.newPage();
      page.setDefaultTimeout(45000);
      page.on('pageerror', e => result.errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); if (m.type() === 'warning') result.warnings.push(m.text()); });
      const must = (yes, message) => { if (!yes && !result.problems.includes(message)) result.problems.push(message); };
      const quiet = value => must(value.outputs.filter(o => o.role === 'world').every(o => o.peak <= 0.0000001), 'World output overlapped the audible film');
      const observe = async label => {
        const value = await page.evaluate(() => window.__openingAudioProbe());
        // Full game state only at labelled milestones, not every waveform sample.
        if (!label) delete value.game;
        result.observations.push({ label, ...value });
        return value;
      };
      const until = async (predicate, label, timeout = 15000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          const value = await observe();
          if (predicate(value)) { result.events.push({ type: label, at: value.at }); return value; }
          await new Promise(done => setTimeout(done, 100));
        }
        throw new Error(`Timed out waiting for ${label}`);
      };
      let delayed = false;
      const late = new Promise(done => { releaseLate = done; });
      if (name === 'initial-failure' || name === 'late-skip') {
        // This is an actual opening voice asset, not a world ambience/voice file.
        await page.route(/\/wall-[^/]+\.mp3(?:\?.*)?$/, async route => {
          result.events.push({ type: name, url: route.request().url() });
          delayed = true;
          if (name === 'initial-failure') await route.abort('failed');
          else { await late; await route.continue(); }
        });
      }
      await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=low`, { waitUntil: 'load' });
      await page.waitForSelector('.gu-stage-title:not([hidden])');
      await page.screenshot({ path: resolve(out, `${name}-title.png`) });
      result.events.push({ type: 'real-click', key: 'title:new' });
      await page.click('[data-key="title:new"]');
      await page.waitForSelector('.st-film:not([hidden])');
      await observe('film-visible');
      if (name === 'late-skip' || name === 'initial-failure') {
        await page.waitForFunction(() => !!window.__game.view.audio);
        const deadline = Date.now() + 20000;
        while (!delayed && Date.now() < deadline) await new Promise(done => setTimeout(done, 100));
        must(delayed, 'The opening voice request was never intercepted');
      }
      if (name === 'skip' || name === 'natural') {
        const firstAudible = await until(v => v.outputs.some(o => o.role === 'film' && o.state === 'running' && o.rms > 0.00001), 'film-actually-audible', 60000);
        quiet(firstAudible);
        await page.screenshot({ path: resolve(out, `${name}-playing.png`) });
        const start = Date.now();
        let audibleSamples = 0;
        while (Date.now() - start < 2000) {
          const value = await observe();
          if (value.outputs.some(o => o.role === 'film' && o.rms > 0.00001)) {
            audibleSamples++;
            quiet(value);
          }
          await new Promise(done => setTimeout(done, 100));
        }
        must(audibleSamples > 0, 'No audible film samples in overlap observation');
        // A normal key and pointer press also exercise the shell gesture listeners.
        await page.keyboard.press('Shift');
        await page.mouse.click(100, 100);
        result.events.push({ type: 'gesture-probes', keys: ['Shift', 'pointer-click'] });
        // Public saved-settings API, with no direct gain or sound-engine mutation.
        await page.evaluate(() => window.__game.view.settings.setVolume('master', 0.35));
        const changed = await until(v => v.preference === 0.35 && v.storedMaster === 0.35, 'current-preference-saved');
        must(changed.effectiveMaster === 0, 'Changing the saved master volume unmuted the world during film');
        await until(v => v.outputs.filter(o => o.role === 'world').every(o => o.peak <= 0.0000001), 'world-silent-after-gestures');
      }
      if (name === 'skip' || name === 'late-skip') {
        result.events.push({ type: 'real-click', key: 'opening:skip' });
        await page.click('[data-key="opening:skip"]');
      }
      if (name === 'natural') {
        await until(value => {
          if (!value.filmVisible) return true;
          quiet(value);
          return false;
        }, 'natural-production-clock-completion', 240000);
      } else await page.waitForSelector('.st-film', { state: 'hidden', timeout: 30000 });
      if (name === 'late-skip') {
        releaseLate();
        result.events.push({ type: 'released-old-voice-after-cleanup' });
        await page.waitForLoadState('networkidle');
      }
      await observe('film-hidden');
      const resumed = await until(v => v.outputs.some(o => o.role === 'world' && o.state === 'running' && o.rms > 0.00001), 'world-actually-audible-again', 20000);
      const expectedVolume = name === 'skip' || name === 'natural' ? 0.35 : 0.65;
      must(resumed.effectiveMaster === expectedVolume && resumed.preference === expectedVolume && resumed.storedMaster === expectedVolume, 'World did not restore the current saved master volume');
      must(resumed.outputs.filter(o => o.role === 'film').every(o => o.state === 'closed'), 'A film-owned audio context remained open after cleanup');
      if (name === 'late-skip') must(!resumed.outputs.some(o => o.role === 'film' && o.state === 'running'), 'The late result started film playback after Skip');
      await page.screenshot({ path: resolve(out, `${name}-resumed.png`) });
      await observe('final');
      const unexpected = result.errors.filter(e => name !== 'initial-failure' || !/opening|Failed to load resource|Failed to fetch|EncodingError/.test(e));
      must(unexpected.length === 0, `Unexpected browser errors: ${unexpected.join(' | ')}`);
    } catch (error) {
      result.problems.push(String(error?.stack ?? error));
    } finally {
      releaseLate?.();
      await context.close();
      save();
    }
    console.log(`${result.problems.length ? 'FAIL' : 'PASS'} ${name}: ${[...new Set(result.problems)].join('; ')}`);
  }
} catch (error) {
  report.problems.push(String(error?.stack ?? error));
} finally {
  clearInterval(monitor);
  await browser?.close();
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise(done => server.once('exit', done)); }
  report.finished = new Date().toISOString();
  save();
}
if (report.problems.length || report.cases.some(c => c.problems.length)) process.exitCode = 1;
console.log(`${process.exitCode ? 'FAIL' : 'PASS'} evidence ${out}`);
