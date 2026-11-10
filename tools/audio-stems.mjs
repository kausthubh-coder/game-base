// A tuning aid: renders each music layer of a land on its own and prints how loud it is, so the mix can be
// balanced by numbers. It uses the built demo, so run `bun tools/demo.mjs build audio` first.
//
//   bun tools/audio-stems.mjs                  every land, calm day
//   bun tools/audio-stems.mjs meadow fight     one land in a fight (moods: day, fight, town, danger, boss)
//   bun tools/audio-stems.mjs meadow day wav   also writes each stem's WAV to .artifacts/audio/stems
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { centroid, decodeWav, mono, peakOf, rmsDb } from './audio-analyze.mjs';

const root = resolve(import.meta.dirname, '..');
const PORT = 5312;
const [landArg, mood = 'day', wav] = process.argv.slice(2);
const lands = landArg && landArg !== 'all' ? [landArg] : ['meadow', 'desert', 'coast', 'rainvalley', 'highlands', 'forge', 'center'];
const layers = { day: ['drone', 'harmony', 'melody', 'sparkle', 'bass', 'perc'], town: ['drone', 'harmony', 'melody', 'sparkle', 'bass', 'perc', 'full'], fight: ['drone', 'harmony', 'melody', 'bass', 'perc', 'drums'], danger: ['tension'], boss: ['boss'] }[mood];

const server = spawn('bun', ['tools/serve.mjs', 'dist/demos/audio', String(PORT)], { cwd: root });
const pid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (d) => {
    text += d;
    const m = text.match(/pid (\d+)/);
    if (m) done(Number(m[1]));
  });
  server.on('exit', () => fail(new Error('the server did not start')));
});
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForFunction(() => window.__audioLab !== undefined);
  if (wav) mkdirSync(resolve(root, '.artifacts/audio/stems'), { recursive: true });
  console.log(`dBFS RMS of each layer alone, ${mood}. Peak in brackets, then the spectral centroid in Hz.`);
  for (const land of lands) {
    const cells = [];
    for (const layer of layers) {
      const r = await page.evaluate(([a]) => window.__audioLab.run('stem', a), [`${land}:${layer}:${mood}`]);
      const audio = decodeWav(r.wav);
      if (wav) writeFileSync(resolve(root, '.artifacts/audio/stems', `${r.name}.wav`), audio.bytes);
      // Skip the first four seconds, so slow pads have arrived.
      const from = 4 * audio.rate;
      const level = rmsDb(audio.channels, from);
      cells.push(`${layer} ${level === -Infinity ? 'silent' : level.toFixed(1)} [${peakOf(audio.channels).toFixed(2)}] ${Math.round(centroid(mono(audio.channels), audio.rate, 6, 0.37))}`);
    }
    console.log(`${land.padEnd(11)} ${cells.join(' | ')}`);
  }
} finally {
  await browser.close();
  process.kill(pid);
}
