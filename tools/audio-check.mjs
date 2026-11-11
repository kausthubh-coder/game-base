// The sound engine's checks: `bun tools/audio-check.mjs`. It builds the demo, serves it on port 5312,
// renders scripted scenes in headless Chrome with an offline audio context, measures the results and
// writes a WAV and a spectrogram for each to .artifacts/audio. Every "Done" line in docs/briefs/audio.md
// prints PASS or FAIL. The exit code is 1 if any line fails.
//
//   bun tools/audio-check.mjs                 everything
//   bun tools/audio-check.mjs --only fight    one scene (solo, crossing, fight, footsteps, stress, soak, page, code, moods, effects, ambience)
//   bun tools/audio-check.mjs --no-build      reuse dist/demos/audio
//   bun tools/audio-check.mjs --port 5313     serve on another port, when 5312 is taken
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { centroid, decodeWav, likeness, loudestHz, mono, onsets, peakOf, rmsDb, spectrogram, windowsDb } from './audio-analyze.mjs';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/audio');
const args = process.argv.slice(2);
const PORT = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : 5312;
const url = `http://127.0.0.1:${PORT}/`;
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const wants = (name) => !only || only.includes(name);
mkdirSync(out, { recursive: true });

const results = [];
const numbers = {};
function line(pass, name, detail = '') {
  results.push({ pass, name });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '\n      ' + detail : ''}`);
}
const note = (text) => console.log(`      ${text}`);
const f1 = (v) => v.toFixed(1);
const f2 = (v) => v.toFixed(2);

function run(command, commandArgs) {
  const r = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8' });
  return { ok: r.status === 0, text: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

// ---- Line 8: the code checks ----
if (wants('code')) {
  const types = run('bun', ['tools/typecheck.mjs', 'audio']);
  line(types.ok, '8a. bun tools/typecheck.mjs audio', types.ok ? 'no type errors' : types.text.split('\n').slice(0, 6).join('\n      '));
  const tests = run('bun', ['test', 'src/features/audio']);
  line(tests.ok, '8b. bun test src/features/audio', tests.text.split('\n').filter((l) => /\b(pass|fail|Ran)\b/.test(l)).join(', ').replace(/\s+/g, ' '));
  const bounds = run('bun', ['run', 'boundaries']);
  line(bounds.ok, '8c. bun run boundaries', bounds.text.split('\n').filter((l) => !l.startsWith('$')).join(' '));
}

// ---- Build and serve ----
if (!args.includes('--no-build')) {
  const build = run('bun', ['tools/demo.mjs', 'build', 'audio']);
  line(build.ok, '7a. bun tools/demo.mjs build audio', build.ok ? build.text.split('\n').filter((l) => l.includes('dist/')).map((l) => l.trim().replace(/\s+/g, ' ')).join('; ') : build.text.slice(-400));
  if (!build.ok) process.exit(1);
}
const server = spawn('bun', ['tools/serve.mjs', 'dist/demos/audio', String(PORT)], { cwd: root });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (d) => {
    text += d;
    const m = text.match(/pid (\d+)/);
    if (m) done(Number(m[1]));
  });
  server.on('exit', () => fail(new Error(`the server on port ${PORT} did not start: ${text}`)));
  setTimeout(() => fail(new Error('the server did not answer in 10 s')), 10000);
});
const stopServer = () => {
  try { process.kill(serverPid); } catch { /* already gone */ }
};

const browser = await launchChrome({ headless: true });
const fail = async (error) => {
  console.error(error);
  await browser.close();
  stopServer();
  process.exit(1);
};

async function openPage(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__audioDemo !== undefined);
  return { page, errors };
}

try {
  // ---- Line 7: the built page ----
  if (wants('page')) {
    const { page, errors } = await openPage(1280, 800);
    await page.waitForTimeout(1200);
    const before = await page.evaluate(() => window.__audioDemo.contextState());
    await page.screenshot({ path: resolve(out, 'demo-before-click.png') });
    await page.click('#start');
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => window.__audioDemo.contextState());
    // Walk, run, jump, fight, talk to nobody, cross a border: the page should take it all without an error.
    await page.keyboard.down('d');
    await page.waitForTimeout(2500);
    await page.keyboard.press('Space');
    await page.keyboard.press('f');
    await page.waitForTimeout(3000);
    await page.keyboard.up('d');
    await page.keyboard.press('q');
    for (const k of ['1', '2', '3', '4', '5', '6', 'h', 'b', 'n', 'e']) await page.keyboard.press(k);
    await page.evaluate(() => window.__audioDemo.teleport(-259, 150));
    await page.waitForTimeout(600);
    await page.keyboard.press('e');
    await page.waitForTimeout(2500);
    await page.keyboard.press('f');
    await page.evaluate(() => window.__audioDemo.teleport(-150, 260));
    await page.waitForTimeout(4000);
    const d = await page.evaluate(() => window.__audioDemo.debug());
    const cost = await page.evaluate(() => window.__audioDemo.cost());
    await page.screenshot({ path: resolve(out, 'demo-playing.png') });
    numbers.liveCost = cost;
    line(before !== 'running' && after === 'running', '7b. no sound before the first click', `audio context before the click: ${before}; after: ${after}`);
    line(d && d.bar >= 3 && d.voices > 0, '7c. the page plays after the click', `bar ${d?.bar + 1}, ${d?.voices} voices, ${f1(d?.bpm ?? 0)} bpm, lead ${d?.lead}, weights meadow ${f2(d?.weights.meadow ?? 0)} desert ${f2(d?.weights.desert ?? 0)}`);
    note(`update cost in the live page: ${f2(cost.mean)} ms a frame, worst ${f2(cost.worst)} ms (headless Chrome on this Mac, 120 frames)`);
    await page.close();
    const narrow = await openPage(728, 900);
    await narrow.page.waitForTimeout(800);
    await narrow.page.click('#start');
    await narrow.page.waitForTimeout(1500);
    await narrow.page.screenshot({ path: resolve(out, 'demo-728.png'), fullPage: true });
    const overflow = await narrow.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await narrow.page.close();
    const all = errors.concat(narrow.errors);
    line(all.length === 0 && overflow <= 0, '7d. no console errors, at 1280 and at 728 wide', all.length ? all.slice(0, 4).join(' | ') : `0 errors; sideways overflow at 728: ${overflow}px`);
  }

  // ---- The scripted scenes ----
  const { page: lab, errors: labErrors } = await openPage(900, 700);
  const cdp = await lab.context().newCDPSession(lab);
  // Chrome's own count of live audio nodes, for the five-minute check.
  const liveNodes = new Map();
  const chromeCounts = [];
  cdp.on('WebAudio.audioNodeCreated', ({ node }) => {
    if (!liveNodes.has(node.contextId)) liveNodes.set(node.contextId, new Set());
    liveNodes.get(node.contextId).add(node.nodeId);
  });
  cdp.on('WebAudio.audioNodeWillBeDestroyed', ({ contextId, nodeId }) => liveNodes.get(contextId)?.delete(nodeId));
  cdp.on('WebAudio.contextWillBeDestroyed', ({ contextId }) => liveNodes.delete(contextId));
  let watching = false;
  await lab.exposeFunction('__labMark', async (time) => {
    if (!watching) return;
    await cdp.send('HeapProfiler.collectGarbage').catch(() => undefined);
    await new Promise((r) => setTimeout(r, 400));
    let most = 0;
    for (const set of liveNodes.values()) most = Math.max(most, set.size);
    chromeCounts.push({ time, nodes: most });
  });

  async function scene(name, arg = '') {
    const started = Date.now();
    const result = await lab.evaluate(([n, a]) => window.__audioLab.run(n, a), [name, arg]);
    const wav = decodeWav(result.wav);
    writeFileSync(resolve(out, `${result.name}.wav`), wav.bytes);
    result.audio = wav;
    result.mono = mono(wav.channels);
    result.took = (Date.now() - started) / 1000;
    return result;
  }
  const picture = (r, title, marks = r.marks) => spectrogram(r.mono, r.audio.rate, resolve(out, `${r.name}.png`), { title, marks });
  const updates = [];
  const speeds = [];
  const keep = (r) => {
    updates.push(r.update);
    // The soak stops ten times to ask Chrome for its node count, so its speed says nothing.
    if (r.name !== 'soak') speeds.push({ name: r.name, speed: (r.seconds * 1000) / r.renderMs });
  };
  const sampleAt = (log, t) => log.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
  const barsAt = (s) => s.bar + s.beat / 4;

  // 1. Each land alone for 60 seconds
  if (wants('solo')) {
    for (const land of ['meadow', 'desert', 'coast', 'rainvalley', 'highlands', 'forge', 'center']) {
      const r = await scene('solo', land);
      keep(r);
      const peak = peakOf(r.audio.channels);
      const loud = rmsDb(r.audio.channels);
      const quiet = windowsDb(r.audio.channels, r.audio.rate, 1).reduce((a, b) => (b.db < a.db ? b : a));
      const end = r.log.at(-1);
      numbers[`solo ${land}`] = { peak, loud, quietest: quiet.db };
      line(peak <= 0.98 && loud >= -30 && loud <= -12 && quiet.db > -50, `1. ${land} alone for 60 s`,
        `peak ${f2(peak)} (limit 0.98), ${f1(loud)} dBFS RMS (-30 to -12), quietest second ${f1(quiet.db)} dBFS at ${quiet.t}s (silent is below -50); ${f1(end.bpm)} bpm, ${end.bar + 1} bars, layers: ${end.layers}`);
      await picture(r, `${land} alone, 60 s, music only. ${r.log[0].layers}`);
    }
  }

  // 2. A walk across a border and back
  if (wants('crossing')) {
    const r = await scene('crossing');
    keep(r);
    let up = true;
    for (let i = 1; i < r.log.length; i++) if (r.log[i].bar < r.log[i - 1].bar) up = false;
    const quiet = windowsDb(r.audio.channels, r.audio.rate, 0.25, 1).reduce((a, b) => (b.db < a.db ? b : a));
    const both = [25, 65].every((t) => ['meadow', 'desert'].every((land) => sampleAt(r.log, t + 1.5).notes[land] > sampleAt(r.log, t - 1.5).notes[land]));
    const mid = sampleAt(r.log, 25);
    const far = sampleAt(r.log, 45);
    const back = r.log.at(-1);
    const desertOnly = sampleAt(r.log, 48).notes.meadow === sampleAt(r.log, 43).notes.meadow;
    const meadowOnly = back.notes.desert === sampleAt(r.log, 84).notes.desert;
    line(up && quiet.db >= -45 && both && desertOnly && meadowOnly, '2. meadow to desert and back, 90 s',
      `bar counter only goes up: ${up} (ends at bar ${back.bar + 1}); quietest 250 ms ${f1(quiet.db)} dBFS at ${f2(quiet.t)}s (limit -45); ` +
      `mid band (25 s): weights meadow ${f2(mid.weights.meadow)} desert ${f2(mid.weights.desert)}, notes from both lands scheduled: ${both}; ` +
      `tempo ${f1(r.log[0].bpm)} -> ${f1(mid.bpm)} -> ${f1(far.bpm)} -> ${f1(back.bpm)} bpm; only desert plays at 45 s: ${desertOnly}; only meadow at the end: ${meadowOnly}; ` +
      `voice peak ${r.voicePeak}, ${r.dropped} sounds refused`);
    await picture(r, 'Crossing: meadow, into desert, and back. Music only.');
  }

  // 3. A fight
  if (wants('fight')) {
    const r = await scene('fight');
    keep(r);
    const base = r.log[0].baseBpm;
    const on = sampleAt(r.log, 20);
    const off = sampleAt(r.log, 50);
    const fast = r.log.find((s) => s.t >= 20 && s.bpm >= base * 1.2);
    const drums = r.log.find((s) => s.t >= 20 && s.layers.includes('drums'));
    const drumsBefore = r.log.some((s) => s.t < 20 && s.layers.includes('drums'));
    const drumsGone = r.log.find((s) => s.t >= 50 && !s.layers.includes('drums'));
    const settled = r.log.find((s) => s.t >= 50 && s.bpm <= base * 1.03);
    const top = Math.max(...r.log.map((s) => s.bpm));
    let up = true;
    for (let i = 1; i < r.log.length; i++) if (r.log[i].bar < r.log[i - 1].bar) up = false;
    const rise = fast ? barsAt(fast) - barsAt(on) : Infinity;
    const fall = settled ? barsAt(settled) - barsAt(off) : Infinity;
    numbers.fight = { base, top, rise, fall };
    line(rise <= 4 && Boolean(drums) && !drumsBefore && fall <= 8 && up && top / base <= 1.35, '3. a fight from 20 s to 50 s',
      `base ${f1(base)} bpm; reached 1.2x (${f1(base * 1.2)}) after ${f2(rise)} bars (limit 4); top ${f1(top)} bpm = ${f2(top / base)}x; ` +
      `drums on ${drums ? f2(drums.t - 20) + ' s after it starts' : 'never'}, off ${drumsGone ? f2(drumsGone.t - 50) + ' s after it ends' : 'never'}; ` +
      `back within 3% of base after ${f2(fall)} bars (limit 8); bar counter never reset: ${up} (ends at bar ${r.log.at(-1).bar + 1}); ` +
      `voice peak ${r.voicePeak}, ${r.dropped} sounds refused`);
    await picture(r, 'Fight: on at 20 s, off at 50 s. Music only.');
  }

  // 4. Footsteps
  if (wants('footsteps')) {
    const r = await scene('footsteps');
    const by = {};
    for (const e of r.events) (by[e.label] ??= []).push(e.t);
    const cents = {};
    let same = 0;
    let silent = [];
    const peaks = {};
    for (const [surface, [a, b]] of Object.entries(by)) {
      peaks[surface] = peakOf([r.mono.subarray(Math.floor(a * r.audio.rate), Math.floor((a + 0.3) * r.audio.rate))]);
      cents[surface] = (centroid(r.mono, r.audio.rate, a, 0.32) + centroid(r.mono, r.audio.rate, b, 0.32)) / 2;
      same = Math.max(same, likeness(r.mono, r.audio.rate, a, b, 0.3));
      if (rmsDb([r.mono], Math.floor(a * r.audio.rate), Math.floor((a + 0.3) * r.audio.rate)) < -55) silent.push(surface);
    }
    const four = ['grass', 'stone', 'wood', 'water'];
    let closest = Infinity;
    for (let i = 0; i < four.length; i++) {
      for (let j = i + 1; j < four.length; j++) {
        const [x, y] = [cents[four[i]], cents[four[j]]];
        closest = Math.min(closest, Math.abs(x - y) / Math.min(x, y));
      }
    }
    numbers.footsteps = cents;
    line(closest > 0.15 && same < 0.98 && silent.length === 0, '4. footsteps differ by surface',
      `spectral centroid: ${Object.entries(cents).map(([s, c]) => `${s} ${Math.round(c)} Hz`).join(', ')}; ` +
      `closest pair among grass, stone, wood, water is ${Math.round(closest * 100)}% apart (limit 15%); ` +
      `two steps on one surface are at most ${f2(same)} alike (1.00 would be identical); silent surfaces: ${silent.length ? silent.join(' ') : 'none'}; ` +
      `peak of each: ${Object.entries(peaks).map(([s, p]) => `${s} ${f2(p)}`).join(', ')}`);
    await picture(r, 'Footsteps: two on each surface. Effects only.', r.events.filter((_, i) => i % 2 === 0));
  }

  // 5. Stress
  if (wants('stress')) {
    const r = await scene('stress');
    keep(r);
    const most = Math.max(...r.log.map((s) => s.voices));
    numbers.stress = { sampledPeak: most, enginePeak: r.voicePeak, refused: r.dropped };
    line(most <= 64 && r.voicePeak <= 64, '5. stress: never more than 64 voices',
      `boss fight in a town on a border in a storm, with machines, talk, pickups, steps, spells, hits, blocks, a pet: ` +
      `most voices at any update ${most}, the engine's own peak ${r.voicePeak} (it counts sounds scheduled ahead at the moment they play), ` +
      `${r.dropped} sounds refused for lack of room (${Object.entries(r.refused).map(([b, n]) => `${b} ${n}`).join(', ')}); peak sample ${f2(peakOf(r.audio.channels))}, ${f1(rmsDb(r.audio.channels))} dBFS RMS`);
    await picture(r, 'Stress: everything at once for 45 s.');
  }

  // 6. Five minutes
  if (wants('soak')) {
    watching = true;
    await cdp.send('WebAudio.enable').catch(() => undefined);
    const r = await scene('soak');
    watching = false;
    await cdp.send('WebAudio.disable').catch(() => undefined);
    keep(r);
    const part = (from, to) => r.log.filter((s) => s.t >= from && s.t < to).map((s) => s.nodes);
    const mean = (from, to) => part(from, to).reduce((a, n) => a + n, 0) / part(from, to).length;
    const range = (from, to) => `${Math.min(...part(from, to))} to ${Math.max(...part(from, to))}`;
    // One sample of the count moves by tens of nodes from beat to beat, as notes start and end. So the
    // count "at one minute" and "at the end" is the mean of the ten seconds before each, and one sample
    // of each is printed beside it. Every minute of the scene is the same loop, so both stretches hold
    // the same ten seconds of play.
    const atOne = mean(50, 60);
    const atFive = mean(290, 300);
    const oneSample = sampleAt(r.log, 59.95).nodes;
    const fiveSample = r.log.at(-1).nodes;
    const minuteOne = mean(0, 60);
    const minuteFive = mean(240, 300);
    const most = Math.max(...r.log.map((s) => s.nodes));
    const drift = Math.abs(atFive - atOne) / atOne;
    const meanDrift = Math.abs(minuteFive - minuteOne) / minuteOne;
    const sampleDrift = Math.abs(fiveSample - oneSample) / oneSample;
    numbers.soak = { fixed: r.fixedNodes, atOne, atFive, oneSample, fiveSample, minuteOne, minuteFive, most, chrome: chromeCounts, voicePeak: r.voicePeak };
    const early = chromeCounts.filter((c) => c.time < 150).map((c) => c.nodes);
    const late = chromeCounts.filter((c) => c.time >= 150).map((c) => c.nodes);
    const avg = (list) => list.reduce((a, n) => a + n, 0) / list.length;
    const chromeDrift = early.length && late.length ? Math.abs(avg(late) - avg(early)) / avg(early) : 0;
    const chrome = early.length && late.length
      ? `Chrome's own count of live nodes, after a forced garbage collection each time: ${early.join(', ')} around one minute and ${late.join(', ')} around five (means ${Math.round(avg(early))} and ${Math.round(avg(late))}, ${f1(chromeDrift * 100)}% apart)`
      : 'Chrome did not report its own node count';
    line(drift <= 0.1 && meanDrift <= 0.1 && chromeDrift <= 0.1, '6. five minutes: the live node count is flat',
      `live nodes at one minute ${Math.round(atOne)}, at five minutes ${Math.round(atFive)} (${f1(drift * 100)}% apart, limit 10%; each is the mean of the 10 s before it); ` +
      `one sample of each: ${oneSample} and ${fiveSample} (${f1(sampleDrift * 100)}% apart; within those 10 s the count runs ${range(50, 60)} and ${range(290, 300)}); ` +
      `${r.fixedNodes} of them are the fixed graph; mean over minute one ${Math.round(minuteOne)}, over minute five ${Math.round(minuteFive)} (${f1(meanDrift * 100)}% apart); most at any update ${most}; ` +
      `voice peak ${r.voicePeak}, ${r.dropped} sounds refused (${Object.entries(r.refused).map(([b, n]) => `${b} ${n}`).join(', ')}); ${chrome}`);
    await picture(r, 'Five minutes of play (mono, to 5.5 kHz). Each minute repeats the same loop.');
  }

  // Extra scenes: not in the nine lines, but they show the parts the nine do not reach.
  if (wants('moods')) {
    const r = await scene('moods');
    keep(r);
    const at = (t) => sampleAt(r.log, t).layers.split(' ');
    const day = at(12);
    const town = at(27);
    const night = at(47);
    const danger = at(85);
    const boss = at(99);
    const ok = day.includes('bass') && day.includes('perc') && !day.includes('full') && town.includes('full') && !night.includes('bass') && !night.includes('perc') && night.includes('melody')
      && danger.includes('tension') && !danger.includes('drums') && boss.includes('boss') && boss.includes('drums');
    const nightBpm = sampleAt(r.log, 47).bpm;
    const dark = rmsDb(r.audio.channels, 68 * r.audio.rate, 74 * r.audio.rate);
    line(ok && nightBpm < 84 * 0.94, 'extra. the meadow through its moods',
      `day: ${day.join(' ')} | town: +${town.filter((l) => !day.includes(l)).join(' ')} | night: ${night.join(' ')} at ${f1(nightBpm)} bpm (${f1((1 - nightBpm / 84) * 100)}% slower) | ` +
      `danger: +${danger.filter((l) => !day.includes(l)).join(' ')} | boss fight: +${boss.filter((l) => !day.includes(l)).join(' ')} | indoors ${f1(dark)} dBFS RMS`);
    await picture(r, 'Meadow moods: day, town, night, rain, indoors, danger, boss fight. Music only.');
  }
  if (wants('effects')) {
    const r = await scene('effects');
    const pitches = r.events.filter((e) => e.label === 'pickup').map((e) => loudestHz(r.mono, r.audio.rate, e.t + 0.01, 0.25, 400, 4000));
    const climbs = pitches.every((p, i) => i === 0 || p > pitches[i - 1] * 1.02);
    // Machine ticks: the gaps between them should be whole half beats.
    const half = 60 / r.log[0].bpm / 2;
    const ticks = onsets(r.mono, r.audio.rate, 30, 40.4, -46, half * 0.6);
    let worst = 0;
    for (let i = 1; i < ticks.length; i++) {
      const gap = (ticks[i] - ticks[i - 1]) / half;
      worst = Math.max(worst, Math.abs(gap - Math.round(gap)) * half);
    }
    const quiet = r.events.filter((e) => e.label !== 'machine' && e.label !== 'stinger' && e.label !== 'thunder' && !e.label.startsWith('talk') && rmsDb([r.mono], Math.floor(e.t * r.audio.rate), Math.floor((e.t + 0.3) * r.audio.rate)) < -55).map((e) => e.label);
    const stinger = rmsDb([r.mono], Math.floor(41.5 * r.audio.rate), Math.floor(44.5 * r.audio.rate));
    const thunder = rmsDb([r.mono], Math.floor(45 * r.audio.rate), Math.floor(48 * r.audio.rate));
    const speech = [20, 23, 26].map((t) => rmsDb([r.mono], Math.floor(t * r.audio.rate), Math.floor((t + 2.4) * r.audio.rate)));
    const loud = r.events.filter((e) => !e.label.startsWith('talk') && e.label !== 'machine').map((e) => `${e.label} ${f2(peakOf([r.mono.subarray(Math.floor(e.t * r.audio.rate), Math.floor((e.t + (e.label === 'stinger' || e.label === 'thunder' ? 4 : 0.3)) * r.audio.rate))]))}`);
    note(`peak of each effect: ${loud.join(', ')}; machine ${f2(peakOf([r.mono.subarray(30 * r.audio.rate, 40 * r.audio.rate)]))}; voices ${[20, 23, 26].map((t) => f2(peakOf([r.mono.subarray(t * r.audio.rate, (t + 2.4) * r.audio.rate)]))).join(', ')}`);
    numbers.effects = { pitches, ticks: ticks.length, worst };
    line(climbs && ticks.length >= 12 && worst < 0.02 && quiet.length === 0 && stinger > -50 && thunder > -50 && speech.every((s) => s > -50), 'extra. effects that are music',
      `six quick pickups climb: ${pitches.map((p) => Math.round(p)).join(' < ')} Hz: ${climbs}; ` +
      `${ticks.length} machine ticks, each within ${Math.round(worst * 1000)} ms of a half beat (${Math.round(half * 1000)} ms apart); ` +
      `silent effects: ${quiet.length ? quiet.join(', ') : 'none'}; stinger ${f1(stinger)} dBFS; thunder ${f1(thunder)} dBFS; three voices ${speech.map(f1).join(', ')} dBFS`);
    await picture(r, 'Effects: pickups, spells, hit, jump, blocks, interface, pet, three voices, machine, stinger, thunder.');
  }
  if (wants('ambience')) {
    const r = await scene('ambience');
    const peak = peakOf(r.audio.channels);
    const parts = r.marks.map((m, i) => `${m.label} ${f1(rmsDb(r.audio.channels, Math.floor((m.t + 1) * r.audio.rate), Math.floor(((r.marks[i + 1]?.t ?? r.seconds) - 0.2) * r.audio.rate)))}`);
    line(peak <= 0.98 && r.voicePeak <= 48, 'extra. the ambience alone', `dBFS RMS by part: ${parts.join(' | ')}; peak ${f2(peak)}; voice peak ${r.voicePeak}`);
    await picture(r, 'Ambience alone: wind, leaves, water, rain and thunder, night, then each land in turn.');
  }

  if (updates.length) {
    const calls = updates.reduce((a, u) => a + u.calls, 0);
    const mean = updates.reduce((a, u) => a + u.mean * u.calls, 0) / calls;
    numbers.update = { mean, p95: Math.max(...updates.map((u) => u.p95)), max: Math.max(...updates.map((u) => u.max)), calls };
    note(`scheduling cost in the offline renders: ${numbers.update.mean.toFixed(3)} ms a call on average, worst scene's 95th percentile ${f2(numbers.update.p95)} ms, worst single call ${f2(numbers.update.max)} ms, over ${calls} calls. ` +
      'Each call covers 50 ms of music, three frames of a 60 Hz game, so a real frame costs less.');
  }
  if (speeds.length) {
    const slow = speeds.reduce((a, b) => (b.speed < a.speed ? b : a));
    numbers.renderSpeed = speeds;
    note(`rendering speed, the audio thread's work included: the slowest scene (${slow.name}) rendered at ${f1(slow.speed)} times real time, so it would use about ${Math.round(100 / slow.speed)}% of one core of this Mac while playing. One run.`);
  }
  line(labErrors.length === 0, 'the lab page logged no errors', labErrors.slice(0, 3).join(' | '));
  writeFileSync(resolve(out, 'numbers.json'), JSON.stringify(numbers, null, 2));
} catch (error) {
  await fail(error);
}

await browser.close();
stopServer();
const failed = results.filter((r) => !r.pass);
console.log(`\n${failed.length === 0 ? 'ALL PASS' : `${failed.length} FAILED: ${failed.map((r) => r.name).join('; ')}`}  (${results.length} lines; renders and spectrograms in .artifacts/audio)`);
process.exit(failed.length ? 1 : 0);
