// Checks the opening's soundtrack without ears: `bun demos/opening/sound/check.ts [--port n] [--take a]`.
// It serves the lab page, renders each take whole and in parts in headless Chrome (render.ts), and measures:
//   - the clips: when the voice ends in each, against the voiceSeconds that time the film
//   - the film timed from them: no line runs past its shot
//   - the whole mix: no clipping, its loudness
//   - each line: the voice's loudness over everything playing under it (EBU R128 by ffmpeg)
//   - the beats: the six Mark notes, the thunder and the title, found in their own renders by where they start
//   - play(film, 40), stop(), play(film, 12) on a live context: no console error, nothing left sounding
// The renders go to .artifacts/opening/sound/ as hobb-<take>.wav and .mp3. The exit code is 1 if a line fails.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeFilm } from '../film.ts';
import type { ShotId } from '../types.ts';
import { planOf } from './cues.ts';
import type { FxList, VoiceList } from './make.ts';
import { SEVEN } from './score.ts';
import { TAKES } from './takes.ts';

/** The repo's Chrome, with the graphics policy every browser tool shares (tools/lib/chrome.mjs, untyped). */
const { launchChrome } = (await import('../../../tools/lib/chrome.mjs' as string)) as { launchChrome: (o: { args: string[] }) => Promise<import('playwright-core').Browser> };

const here = import.meta.dirname;
const root = resolve(here, '../../..');
const OUT = resolve(root, '.artifacts/opening/sound');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const args = process.argv.slice(2);
const PORT = Number(args.includes('--port') ? args[args.indexOf('--port') + 1] : (process.env.PORT ?? 5575));
const takes = args.includes('--take') ? TAKES.filter((t) => t.id === args[args.indexOf('--take') + 1]) : TAKES;
mkdirSync(OUT, { recursive: true });

const voiceList = (await Bun.file(resolve(here, 'voice/voice.json')).json()) as VoiceList;
const fxList = (await Bun.file(resolve(here, 'fx/fx.json')).json()) as FxList;
const failures: string[] = [];
const verdict = (ok: boolean, line: string) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); if (!ok) failures.push(line); };

// ---- serve the lab page -----------------------------------------------------------------------------------
const server = spawn('bun', ['tools/demo.mjs', 'dev', 'opening', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise<void>((ok, fail) => {
  const timer = setTimeout(() => fail(new Error('the demo server did not start in 30 s')), 30000);
  server.stdout.on('data', (d: Buffer) => { if (d.toString().includes('pid')) (clearTimeout(timer), ok()); });
  server.on('exit', (code) => fail(new Error(`the demo server exited with ${code}`)));
});
console.log(`demo server pid ${server.pid} on ${PORT}`);
const browser = await launchChrome({ args: ['--autoplay-policy=no-user-gesture-required'] });

try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/sound/render.html`);
  await page.waitForFunction(() => (window as unknown as { __sound?: { ready: boolean } }).__sound?.ready, null, { timeout: 30000 });

  for (const take of takes) {
    console.log(`\n==== take ${take.id}: ${take.name} (${take.voiceId})`);
    const clips = voiceList.takes[take.id] ?? {};

    // -- the clips and the film timed from them
    const ends = (await page.evaluate((v) => (window as any).__sound.clipEnds(v), take.id)) as Record<ShotId, { voiceSeconds: number; decoded: number; voiceEnds: number }>;
    const voiceSeconds = Object.fromEntries(Object.entries(ends).map(([k, e]) => [k, e.voiceSeconds])) as Partial<Record<ShotId, number>>;
    const film = makeFilm(voiceSeconds);
    console.log('shot       line s  voice ends (decoded)  clip s  shot s  line ends at  shot ends at');
    let worstEnd = 0, overrun = 0;
    for (const shot of film.shots) {
      const e = ends[shot.id];
      if (!e) { verdict(false, `${take.id}/${shot.id}: no clip`); continue; }
      worstEnd = Math.max(worstEnd, Math.abs(e.voiceEnds - e.voiceSeconds));
      const lineEnd = shot.at + film.lead + e.voiceSeconds;
      overrun = Math.max(overrun, lineEnd - (shot.at + shot.len), shot.at + film.lead + e.decoded - (shot.at + shot.len));
      console.log(`${shot.id.padEnd(10)} ${e.voiceSeconds.toFixed(2).padStart(6)}  ${e.voiceEnds.toFixed(2).padStart(10)}            ${e.decoded.toFixed(2).padStart(6)}  ${shot.len.toFixed(2).padStart(6)}  ${lineEnd.toFixed(2).padStart(12)}  ${(shot.at + shot.len).toFixed(2).padStart(12)}`);
    }
    console.log(`film: ${film.length.toFixed(2)} s`);
    verdict(worstEnd <= 0.1, `${take.id}: voiceSeconds within 0.1 s of where the voice ends in each decoded clip (worst ${worstEnd.toFixed(3)} s)`);
    verdict(overrun <= 0, `${take.id}: no line or clip runs past the end of its shot (closest ${(-overrun).toFixed(2)} s to the end)`);

    // -- renders
    const stems: Record<string, string> = {};
    for (const part of ['all', 'voice', 'under', 'mark', 'title', 'thunder']) {
      const r = (await page.evaluate(([v, p]) => (window as any).__sound.render(v, p), [take.id, part])) as { wav: string; length: number; ms: number };
      const file = resolve(OUT, part === 'all' ? `hobb-${take.id}.wav` : `parts/${take.id}-${part}.wav`);
      mkdirSync(resolve(file, '..'), { recursive: true });
      writeFileSync(file, Buffer.from(r.wav, 'base64'));
      stems[part] = file;
      if (part === 'all') console.log(`rendered ${r.length.toFixed(1)} s in ${r.ms} ms`);
    }
    Bun.spawnSync([FFMPEG, '-v', 'error', '-y', '-i', stems.all as string, '-c:a', 'libmp3lame', '-b:a', '160k', resolve(OUT, `hobb-${take.id}.mp3`)]);

    // -- clipping and loudness
    const whole = ebur128(stems.all as string);
    const samplePeak = peakDb(readWav(stems.all as string));
    console.log(`whole mix: ${whole.lufs} LUFS, true peak ${whole.truePeak} dBFS, sample peak ${samplePeak.toFixed(2)} dBFS`);
    verdict(samplePeak < -0.5 && (whole.truePeak ?? 0) < 0, `${take.id}: no clipping (sample peak ${samplePeak.toFixed(2)} dBFS, true peak ${whole.truePeak} dBFS)`);

    // -- the voice over what plays under it, line by line
    const plan = planOf(film, voiceSeconds, Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, c.fileSeconds])), Object.fromEntries(Object.entries(fxList.sounds).map(([k, e]) => [k, e.hit])));
    let worstMargin = Infinity;
    console.log('line       voice LUFS  under LUFS  margin dB');
    for (const [shot, [from, to]] of Object.entries(plan.lines) as [ShotId, [number, number]][]) {
      const v = ebur128(stems.voice as string, from, to).lufs ?? -70;
      const u = ebur128(stems.under as string, from, to).lufs ?? -70;
      worstMargin = Math.min(worstMargin, v - u);
      console.log(`${shot.padEnd(10)} ${v.toFixed(1).padStart(10)}  ${u.toFixed(1).padStart(10)}  ${(v - u).toFixed(1).padStart(9)}`);
    }
    verdict(worstMargin >= 6, `${take.id}: the voice at least 6 dB over what plays under it, in every line (least ${worstMargin.toFixed(1)} dB)`);

    // -- the shape: the loudest 3 s of everything under the voice, shot by shot
    const shape = Object.fromEntries(film.shots.map((shot) => [shot.id, ebur128(stems.under as string, shot.at, shot.at + shot.len).loudest3s])) as Record<ShotId, number>;
    console.log(`under the voice, loudest 3 s (LUFS): ${film.shots.map((shot) => `${shot.id} ${shape[shot.id].toFixed(1)}`).join(', ')}`);
    const loudest = film.shots.reduce((a, b) => (shape[b.id] > shape[a.id] ? b : a));
    verdict(loudest.id === 'night' || loudest.id === 'gods', `${take.id}: the night (with the dome ringing into the gods) is the biggest moment (loudest: ${loudest.id})`);
    verdict(shape.mark <= Math.max(shape.night, shape.gods) - 6, `${take.id}: the Mark thins out, 6 dB or more under the night (${(Math.max(shape.night, shape.gods) - shape.mark).toFixed(1)} dB)`);

    // -- the beats
    const mark = film.shot('mark');
    const expected = [1, 2, 3, 4, 5, 6].map((k) => mark.at + (mark.beats[`light${k}`] as number));
    // Each of the six is its own pitch, and a later one starts while the earlier ones still ring, so each is
    // found by its own pitch: where that pitch first rises out of the quiet, searched over the whole shot.
    const markWav = readWav(stems.mark as string);
    const found = SEVEN.map((midi) => pitchOnset(markWav, 440 * 2 ** ((midi - 69) / 12), mark.at, mark.at + mark.len));
    const offsets = expected.map((b, i) => (found[i] as number) - b);
    const seventh = (expected[5] as number) * 2 - (expected[4] as number);
    console.log(`Mark notes found at ${found.map((t) => t.toFixed(3)).join(', ')}; beats ${expected.map((t) => t.toFixed(3)).join(', ')}`);
    verdict(offsets.every((o) => Math.abs(o) <= 0.03), `${take.id}: six Mark notes, each within 30 ms of its beat (${offsets.map((o) => `${(o * 1000).toFixed(0)} ms`).join(', ')})`);
    // The seventh place: no new note in the music, only the tails of the six (Hobb may still be speaking).
    const restOnsets = onsets(readWav(stems.under as string)).filter((t) => t > seventh - 0.1 && t < seventh + 0.6);
    console.log(`the seventh place, ${seventh.toFixed(2)} s: everything under the voice ${windowDb(readWav(stems.under as string), seventh - 0.05, seventh + 0.4).toFixed(1)} dBFS RMS`);
    verdict(restOnsets.length === 0, `${take.id}: nothing new sounds on the seventh place${restOnsets.length ? ` (onsets at ${restOnsets.map((t) => t.toFixed(3)).join(', ')})` : ''}`);
    const door = film.shot('doorstep'), morning = film.shot('morning');
    const thunderBeat = door.at + (door.beats.thunder as number), titleBeat = morning.at + (morning.beats.title as number);
    const thunderHit = hitOf(readWav(stems.thunder as string));
    verdict(Math.abs(thunderHit - thunderBeat) <= 0.05, `${take.id}: the thunder's loudest moment on its beat (${((thunderHit - thunderBeat) * 1000).toFixed(0)} ms off; beat ${thunderBeat.toFixed(2)} s)`);
    const titleOn = onsets(readWav(stems.title as string))[0] ?? Infinity;
    verdict(Math.abs(titleOn - titleBeat) <= 0.03, `${take.id}: the title chord starts on its beat (${((titleOn - titleBeat) * 1000).toFixed(0)} ms off; beat ${titleBeat.toFixed(2)} s)`);
  }

  // -- the live context: play, stop, play
  const seek = (await page.evaluate((v) => (window as any).__sound.seekTest(v), takes[0]?.id ?? 'a')) as { log: { step: string; live: number; levelDb: number }[]; state: string };
  console.log(`\nlive context (${seek.state}):`);
  for (const s of seek.log) console.log(`  ${s.step.padEnd(32)} ${String(s.live).padStart(4)} sources, ${s.levelDb} dBFS`);
  const after = seek.log.filter((s) => s.step.startsWith('420'));
  verdict(seek.log[0]!.levelDb > -60 && seek.log[3]!.levelDb > -60, 'play(film, 40) and play(film, 12) both sound');
  verdict(after.every((s) => s.live === 0 && s.levelDb < -90), 'nothing left sounding 420 ms after each stop()');
  verdict(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
} finally {
  await browser.close();
  server.kill();
  console.log(`stopped the demo server, pid ${server.pid}`);
}
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
process.exit(failures.length ? 1 : 0);

// ---- measuring ------------------------------------------------------------------------------------------------

function readWav(file: string): { rate: number; mono: Float32Array } {
  const b = readFileSync(file);
  const rate = b.readUInt32LE(24), channels = b.readUInt16LE(22);
  const n = (b.length - 44) / 2 / channels;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) s += b.readInt16LE(44 + (i * channels + c) * 2) / 32768;
    mono[i] = s / channels;
  }
  return { rate, mono };
}

function peakDb(w: { mono: Float32Array }): number {
  let p = 0;
  for (const v of w.mono) p = Math.max(p, Math.abs(v));
  return 20 * Math.log10(p + 1e-12);
}

function windowDb(w: { rate: number; mono: Float32Array }, from: number, to: number): number {
  let e = 0, n = 0;
  for (let i = Math.max(0, Math.round(from * w.rate)); i < Math.min(w.mono.length, Math.round(to * w.rate)); i++) (e += (w.mono[i] as number) ** 2), n++;
  return 10 * Math.log10(e / Math.max(1, n) + 1e-14);
}

/** Integrated loudness and true peak by ffmpeg, of the whole file or a stretch of it. */
function ebur128(file: string, from?: number, to?: number): { lufs: number | null; truePeak: number | null; loudest3s: number } {
  const range = from === undefined ? [] : ['-ss', String(from), '-t', String(Math.max(0.4, (to as number) - from))];
  const p = Bun.spawnSync([FFMPEG, '-hide_banner', '-nostats', ...range, '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stdout: 'pipe', stderr: 'pipe' });
  const err = p.stderr.toString();
  const summary = err.slice(err.lastIndexOf('Summary:'));
  const num = (re: RegExp) => { const m = re.exec(summary); return m ? Number(m[1]) : null; };
  const short = [...err.matchAll(/S:\s*(-?[\d.]+)/g)].map((m) => Number(m[1])).filter((x) => x > -100);
  return { lufs: num(/I:\s*(-?[\d.]+) LUFS/), truePeak: num(/Peak:\s*(-?[\d.]+) dBFS/), loudest3s: short.length ? Math.max(...short) : -70 };
}

/**
 * Where new sounds start, found blind: a 2 ms frame over -60 dBFS that stands 9 dB over the 30 ms before it.
 * One onset per 150 ms. The time is the first sample of that frame over -60 dBFS.
 */
function onsets(w: { rate: number; mono: Float32Array }): number[] {
  const hop = Math.round(w.rate * 0.002);
  const f: number[] = [];
  for (let at = 0; at + hop <= w.mono.length; at += hop) {
    let e = 0;
    for (let i = at; i < at + hop; i++) e += (w.mono[i] as number) ** 2;
    f.push(e / hop + 1e-14);
  }
  const floor = 10 ** (-60 / 10);
  const out: number[] = [];
  for (let i = 15; i < f.length; i++) {
    let before = 0;
    for (let k = i - 15; k < i; k++) before += f[k] as number;
    before /= 15;
    if ((f[i] as number) > floor && (f[i] as number) > before * 8 && (out.length === 0 || i * 0.002 - (out[out.length - 1] as number) > 0.15)) {
      let first = i * hop;
      while (first < (i + 1) * hop && Math.abs(w.mono[first] as number) < 1e-3) first++;
      out.push(first / w.rate);
    }
  }
  return out;
}

/**
 * When one pitch starts: its energy in 2 ms steps by the Goertzel filter over a 30 ms window (narrow enough,
 * about 33 Hz, to tell a note from the one a semitone under it), and the first step that reaches a tenth of that
 * pitch's loudest, between `from` and `to` seconds. A tenth of the energy is a third of the amplitude, so that
 * step's window holds about the note's first third of a window: the start is that far back from its end.
 */
function pitchOnset(w: { rate: number; mono: Float32Array }, hz: number, from: number, to: number): number {
  const size = Math.round(w.rate * 0.03), hop = Math.round(w.rate * 0.002);
  const k = 2 * Math.cos((2 * Math.PI * hz) / w.rate);
  const steps: [number, number][] = [];
  for (let at = Math.round(from * w.rate); at + size < Math.min(w.mono.length, to * w.rate); at += hop) {
    let a = 0, b = 0;
    for (let i = at; i < at + size; i++) { const c = (w.mono[i] as number) + k * a - b; b = a; a = c; }
    steps.push([(at + size * (1 - Math.sqrt(0.1))) / w.rate, a * a + b * b - k * a * b]);
  }
  const top = Math.max(...steps.map(([, e]) => e));
  return (steps.find(([, e]) => e > top * 0.1) ?? [Infinity])[0];
}

/** A one-shot's hit as make.ts measures it: the first 10 ms within 6 dB of its loudest 10 ms. */
function hitOf(w: { rate: number; mono: Float32Array }): number {
  const hop = Math.round(w.rate * 0.01);
  const f: number[] = [];
  for (let at = 0; at + hop <= w.mono.length; at += hop) {
    let e = 0;
    for (let i = at; i < at + hop; i++) e += (w.mono[i] as number) ** 2;
    f.push(10 * Math.log10(e / hop + 1e-14));
  }
  const top = Math.max(...f);
  return f.findIndex((v) => v > top - 6) / 100;
}
