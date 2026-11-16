// Greenhollow's music, region by region: renders each region's palette alone (day, night, and Hollowmere in and
// out of market hours) and five runs across the map with the game's own weights, in the audio demo's offline
// lab. Writes an mp3 and a spectrogram of each to .artifacts/sound/regions, and prints what played: the lead,
// the tempo, the loudness, and for each run every change of lead and how long each crossfade took.
//   bun tools/region-music.mjs --port <port>          everything
//   bun tools/region-music.mjs --only tour            the runs alone (or `region`)
//   bun tools/region-music.mjs --no-build             reuse dist/demos/audio
// Exits 1 when a region is silent, clips, sits more than 6 dB from the meadow at the same hour, or a run cuts
// from one land to the next instead of crossfading. The server is stopped by its pid.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { decodeWav, mono, peakOf, rmsDb, spectrogram, windowsDb } from './audio-analyze.mjs';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/sound/regions');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const PORT = Number(opt('port', process.env.PLAY_PORT ?? 5312));
const only = opt('only', null);
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
mkdirSync(out, { recursive: true });

const REGIONS = [
  ['meadow', 'day'], ['meadow', 'night'], ['town', 'market'], ['town', 'evening'], ['town', 'night'],
  ['oldForest', 'day'], ['oldForest', 'night'], ['greyForest', 'day'], ['highRoad', 'day'], ['highRoad', 'night'],
  ['terraces', 'day'], ['marsh', 'day'], ['marsh', 'night'], ['caves', 'day'], ['mere', 'day'], ['mere', 'night'],
];
const TOURS = ['north', 'west', 'east', 'caves', 'south'];

let failures = 0;
const line = (pass, text) => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${text}`); };

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['tools/demo.mjs', 'build', 'audio'], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) { console.error(build.stdout, build.stderr); process.exit(1); }
}
const server = spawn('bun', ['tools/serve.mjs', 'dist/demos/audio', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (d) => { text += d; const m = /pid (\d+)/.exec(text); if (m) done(Number(m[1])); });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});
console.log(`serving the audio demo on ${PORT}, pid ${serverPid}`);

let browser;
try {
  browser = await launchChrome({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(600000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__audioLab !== undefined);

  async function scene(name, arg) {
    const r = await page.evaluate(([n, a]) => window.__audioLab.run(n, a), [name, arg]);
    const wav = decodeWav(r.wav);
    const base = resolve(out, r.name);
    writeFileSync(`${base}.wav`, wav.bytes);
    // An mp3 to listen to; the wav is only for measuring and is not kept.
    spawnSync(FFMPEG, ['-v', 'error', '-y', '-i', `${base}.wav`, '-b:a', '160k', `${base}.mp3`]);
    rmSync(`${base}.wav`);
    return { ...r, audio: wav };
  }

  // Each region is measured against the meadow at the same hour: night is quieter everywhere on purpose.
  const meadow = {};
  if (!only || only === 'region') {
    console.log('\nEach region alone, music only, 32 s:');
    for (const [region, mood] of REGIONS) {
      const r = await scene('region', `${region}:${mood}`);
      const peak = peakOf(r.audio.channels), loud = rmsDb(r.audio.channels, r.audio.rate * 4);
      const quiet = windowsDb(r.audio.channels, r.audio.rate, 2, 4).reduce((a, b) => (b.db < a.db ? b : a));
      const hour = mood === 'night' ? 'night' : 'day';
      if (region === 'meadow') meadow[hour] = loud;
      const end = r.log.at(-1);
      const off = loud - (meadow[hour] ?? loud);
      line(peak <= 0.98 && quiet.db > -55 && Math.abs(off) <= 6,
        `${`${region} ${mood}`.padEnd(18)} ${end.bpm.toFixed(1).padStart(5)} bpm, ${loud.toFixed(1)} dBFS RMS (${off >= 0 ? '+' : ''}${off.toFixed(1)} on the meadow by ${hour}), peak ${peak.toFixed(2)}, quietest 2 s ${quiet.db.toFixed(1)} dBFS; lead ${end.lead}; layers ${end.layers}; ${r.name}.mp3`);
      await spectrogram(mono(r.audio.channels), r.audio.rate, resolve(out, `${r.name}.png`), { title: `${region}, ${mood}: music only`, marks: [] });
    }
  }

  if (!only || only === 'tour') {
    console.log('\nRuns across Greenhollow at 6 blocks a second, music only, the game\'s own weights:');
    for (const name of TOURS) {
      const r = await scene('tour', name);
      // Every change of lead, and how long the weights took to cross from the old land to the new one.
      const changes = [];
      let worstJump = 0;
      for (let i = 1; i < r.log.length; i++) {
        const a = r.log[i - 1], b = r.log[i];
        for (const id of Object.keys(b.weights)) worstJump = Math.max(worstJump, Math.abs((b.weights[id] ?? 0) - (a.weights[id] ?? 0)));
        if (b.lead !== a.lead) {
          // The crossfade: from when the new land rose past 0.1 to when the old one fell under 0.1.
          let from = i, to = i;
          while (from > 0 && (r.log[from - 1].weights[b.lead] ?? 0) > 0.1) from--;
          while (to < r.log.length - 1 && (r.log[to + 1].weights[a.lead] ?? 0) > 0.1) to++;
          changes.push({ t: b.t, from: a.lead, to: b.lead, fade: r.log[to].t - r.log[from].t, bar: b.bar, beat: b.beat });
        }
      }
      const loudness = windowsDb(r.audio.channels, r.audio.rate, 0.5, 1);
      const quietest = loudness.reduce((a, b) => (b.db < a.db ? b : a));
      // A crossfade: the engine eases each weight at 0.6 a second (0.03 a 50 ms step; with three lands in the air
      // the sum is renormalised, so allow 0.08), the old and new land are heard together for a second or more
      // before the lead changes, and the music never drops out on the way.
      const cuts = changes.filter((c) => c.fade < 1);
      line(worstJump <= 0.08 && cuts.length === 0 && quietest.db > -55,
        `${name.padEnd(6)} ${r.seconds.toFixed(0)} s: largest weight change in a 50 ms step ${worstJump.toFixed(3)} (0.08 allowed), ${changes.length} changes of lead, each heard together a second or more: ${cuts.length === 0}, quietest half second ${quietest.db.toFixed(1)} dBFS; tour-${name}.mp3`);
      for (const c of changes) console.log(`        ${c.t.toFixed(1).padStart(6)} s  ${c.from} -> ${c.to}, bar ${c.bar + 1}; both heard for ${c.fade.toFixed(1)} s`);
      await spectrogram(mono(r.audio.channels), r.audio.rate, resolve(out, `${r.name}.png`), { title: `run ${name}`, marks: changes.map((c) => ({ t: c.t, label: c.to })) });
      writeFileSync(resolve(out, `${r.name}.json`), JSON.stringify({ changes, log: r.log.filter((_, i) => i % 10 === 0).map((s) => ({ t: s.t, lead: s.lead, bpm: s.bpm, weights: s.weights })) }, null, 1));
    }
  }
  line(errors.length === 0, errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors in the lab page');
  console.log(`\nwrote ${out}`);
} finally {
  await browser?.close();
  process.kill(serverPid);
}
process.exit(failures ? 1 : 0);
