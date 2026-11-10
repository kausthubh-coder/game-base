// The sound tool: makes every recorded sound the game ships from its prompt in src/content/sound-samples.ts.
//   bun --env-file=.env.local tools/sound.ts              make what is missing, then cut, level and encode everything
//   bun --env-file=.env.local tools/sound.ts --dry        say what would be made and what it would cost, make nothing
//   bun tools/sound.ts --process                          cut, level and encode again from the kept takes, call nothing
//   bun --env-file=.env.local tools/sound.ts --only id    make one sound again (its takes are asked for anew)
//   bun --env-file=.env.local tools/sound.ts --ids a,b    ask only for these sounds' missing takes
//
// Each take ElevenLabs returns is kept in assets-src/raw/sound/, which git ignores, named by a hash of the
// prompt, the length, the kind and the model, so a sound is asked for again only when one of those changes.
// What the game reads is public/assets/sound/<id>.mp3 and public/assets/sound/sound.json, which lists each
// file with its slices.
// public/assets/manifest.json points at the list. ffmpeg does the decoding, the loudness measure and the
// encoding. It stops before asking for anything when the run would cost more than LIMIT credits.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SAMPLES, type SampleSpec } from '../src/content/sound-samples.ts';

const MODEL = 'eleven_text_to_sound_v3';
/** The format asked of ElevenLabs. The best mp3 the plan gives. */
const FORMAT = 'mp3_44100_128';
/** Sound effects cost 40 credits a second when the length is set. */
const CREDITS_PER_SECOND = 40;
const LIMIT = 30000;
const AT_ONCE = 3;
const RATE = 44100;
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

const root = resolve(import.meta.dirname, '..');
const RAW = resolve(root, 'assets-src/raw/sound');
const REPORT = resolve(root, 'assets-src/sound/report.json');
const OUT = resolve(root, 'public/assets/sound');
const LIST = resolve(OUT, 'sound.json');
const MANIFEST = resolve(root, 'public/assets/manifest.json');
const TMP = resolve(root, '.artifacts/sound-tool');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const processOnly = args.includes('--process');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
/** `--ids a,b` asks only for these sounds' missing takes. */
const ids = args.includes('--ids') ? new Set((args[args.indexOf('--ids') + 1] ?? '').split(',')) : undefined;

/** One file the game reads. Slices are [start, length] in seconds. */
export interface SoundEntry {
  file: string;
  kind: SampleSpec['kind'];
  seconds: number;
  channels: 1 | 2;
  slices?: [number, number][];
  /** Integrated loudness after leveling, LUFS. */
  lufs: number;
  /** The highest sample, dBFS. */
  peak: number;
}
export interface SoundList {
  version: 1;
  model: string;
  sounds: Record<string, SoundEntry>;
}

const hashOf = (s: SampleSpec): string =>
  createHash('sha1').update(JSON.stringify([s.prompt, s.seconds, s.kind, s.takes ?? 1, s.influence ?? 0.3, s.stereo ?? false, MODEL])).digest('hex').slice(0, 10);
const takesOf = (s: SampleSpec): number => (s.kind === 'bed' || s.kind === 'grain' ? 1 : (s.takes ?? 1));
const rawFile = (s: SampleSpec, take: number): string => resolve(RAW, `${s.id}.${take}.${hashOf(s)}.mp3`);

async function generate(s: SampleSpec): Promise<Uint8Array> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set. Run with bun --env-file=<the .env.local that holds it>.');
  const res = await fetch(`https://api.elevenlabs.io/v1/sound-generation?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text: s.prompt, loop: s.kind === 'bed', duration_seconds: s.seconds, prompt_influence: s.influence ?? 0.3, model_id: MODEL }),
  });
  if (!res.ok) throw new Error(`ElevenLabs sound-generation ${res.status} for ${s.id}: ${(await res.text()).slice(0, 300)}`);
  return new Uint8Array(await res.arrayBuffer());
}

function run(cmd: string[], input?: Uint8Array): { out: Uint8Array; err: string } {
  const p = Bun.spawnSync(cmd, { stdin: input ?? 'ignore', stdout: 'pipe', stderr: 'pipe' });
  if (p.exitCode !== 0) throw new Error(`${cmd.slice(0, 3).join(' ')} failed: ${p.stderr.toString().slice(-600)}`);
  return { out: p.stdout, err: p.stderr.toString() };
}

/** Decodes any file to channels of float samples at RATE, with the rumble under `highpass` Hz taken out. */
function decode(file: string, channels: 1 | 2, highpass: number): Float32Array[] {
  const { out } = run([FFMPEG, '-v', 'error', '-i', file, '-af', `highpass=f=${highpass}:poles=2`, '-f', 'f32le', '-ac', String(channels), '-ar', String(RATE), '-']);
  const all = new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4);
  const n = all.length / channels;
  const chans = Array.from({ length: channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) (chans[c] as Float32Array)[i] = all[i * channels + c] as number;
  return chans;
}

function interleave(chans: Float32Array[]): Uint8Array {
  const n = (chans[0] as Float32Array).length, c = chans.length;
  const all = new Float32Array(n * c);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) all[i * c + k] = (chans[k] as Float32Array)[i] as number;
  return new Uint8Array(all.buffer);
}

/** Integrated loudness (EBU R128) of float samples, by ffmpeg. */
function loudness(chans: Float32Array[]): number {
  const { err } = run([FFMPEG, '-hide_banner', '-nostats', '-f', 'f32le', '-ac', String(chans.length), '-ar', String(RATE), '-i', '-', '-af', 'ebur128', '-f', 'null', '-'], interleave(chans));
  const m = /Integrated loudness:\s*I:\s*(-?[\d.]+|-inf)/.exec(err);
  return m && m[1] !== '-inf' ? Number(m[1]) : -70;
}

const peakOf = (chans: Float32Array[], from = 0, to = Infinity): number => {
  let p = 0;
  for (const ch of chans) for (let i = from; i < Math.min(to, ch.length); i++) p = Math.max(p, Math.abs(ch[i] as number));
  return p;
};
const db = (x: number): number => 20 * Math.log10(Math.max(x, 1e-9));
const scale = (chans: Float32Array[], g: number): void => { for (const ch of chans) for (let i = 0; i < ch.length; i++) ch[i] = (ch[i] as number) * g; };

/** A 5 ms RMS envelope of the mix of the channels. */
function envelope(chans: Float32Array[], hop: number): Float32Array {
  const n = (chans[0] as Float32Array).length;
  const env = new Float32Array(Math.ceil(n / hop));
  for (let f = 0; f < env.length; f++) {
    let sum = 0, count = 0;
    for (let i = f * hop; i < Math.min(n, (f + 1) * hop); i++) {
      let v = 0;
      for (const ch of chans) v += ch[i] as number;
      sum += v * v; count++;
    }
    env[f] = Math.sqrt(sum / Math.max(1, count));
  }
  return env;
}

/** Finds each hit in a take of footfalls or strikes. Returns [start, end] in samples. */
function findHits(chans: Float32Array[], maxSeconds: number): [number, number][] {
  const hop = Math.round(RATE * 0.005);
  const env = envelope(chans, hop);
  let top = 0;
  for (const v of env) top = Math.max(top, v);
  const on = top * 10 ** (-22 / 20), off = top * 10 ** (-34 / 20);
  const maxFrames = Math.round(maxSeconds / 0.005);
  const hits: [number, number][] = [];
  let f = 0;
  while (f < env.length) {
    if ((env[f] as number) < on) { f++; continue; }
    // Back up to where it rose out of the quiet, at most 25 ms.
    let start = f;
    while (start > 0 && f - start < 5 && (env[start - 1] as number) > off * 0.5) start--;
    // The hit's own peak, then on until it falls under its own floor or the next hit starts.
    let peak = 0, end = f;
    while (end < env.length && end - start < maxFrames) {
      const v = env[end] as number;
      peak = Math.max(peak, v);
      if (end > f + 8 && v < Math.max(off, peak * 10 ** (-30 / 20))) break;
      // A new rise well after this hit's peak is the next hit.
      if (end > f + 16 && v > peak * 0.7 && v > 2.2 * (env[end - 4] as number)) break;
      end++;
    }
    if ((end - start) * 0.005 >= 0.06) hits.push([start * hop, Math.min(end * hop, (chans[0] as Float32Array).length)]);
    f = end + 6;
  }
  return hits;
}

/** Cuts a take down to where it sounds: from the first sample over -50 dB of its peak to the last. */
function trim(chans: Float32Array[]): Float32Array[] {
  const hop = Math.round(RATE * 0.005);
  const env = envelope(chans, hop);
  let top = 0;
  for (const v of env) top = Math.max(top, v);
  const floor = top * 10 ** (-50 / 20);
  let a = 0, b = env.length - 1;
  while (a < b && (env[a] as number) < floor) a++;
  while (b > a && (env[b] as number) < floor) b--;
  const from = Math.max(0, (a - 2) * hop), to = Math.min((chans[0] as Float32Array).length, (b + 4) * hop);
  return chans.map((ch) => ch.slice(from, to));
}

function fade(chans: Float32Array[], inSeconds: number, outSeconds: number): void {
  for (const ch of chans) {
    const fi = Math.round(inSeconds * RATE), fo = Math.round(outSeconds * RATE);
    for (let i = 0; i < Math.min(fi, ch.length); i++) ch[i] = (ch[i] as number) * (i / fi);
    for (let i = 0; i < Math.min(fo, ch.length); i++) ch[ch.length - 1 - i] = (ch[ch.length - 1 - i] as number) * (i / fo);
  }
}

/** Folds the last `seconds` over the first with an equal-power fade, so the file loops with no seam. */
function seamless(chans: Float32Array[], seconds: number): Float32Array[] {
  const x = Math.round(seconds * RATE);
  return chans.map((ch) => {
    const n = ch.length - x;
    const out = ch.slice(0, n);
    for (let i = 0; i < x; i++) {
      const t = i / x;
      out[i] = (ch[i] as number) * Math.sin(t * Math.PI / 2) + (ch[n + i] as number) * Math.cos(t * Math.PI / 2);
    }
    return out;
  });
}

/**
 * A look-ahead limiter: the gain falls 5 ms before a peak that would pass `ceiling`, and comes back over 120 ms.
 * Only a bed's few loud moments are touched; the rest passes as it is.
 */
function limit(chans: Float32Array[], ceiling: number): void {
  const n = (chans[0] as Float32Array).length;
  const ahead = Math.round(RATE * 0.005), back = Math.exp(-1 / (RATE * 0.12));
  // The gain each sample needs on its own, then the lowest of the next `ahead` samples, then a smooth return.
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (const ch of chans) p = Math.max(p, Math.abs(ch[i] as number));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  let g = 1;
  const window: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    // Walking backward, so the gain is already down when the peak arrives.
    window.push(need[i] as number);
    if (window.length > ahead) window.shift();
    const want = Math.min(...window);
    g = want < g ? want : 1 - (1 - g) * back;
    for (const ch of chans) ch[i] = (ch[i] as number) * g;
  }
}

/** Lays slices end to end with a gap of silence around each, so a decoder's few samples of delay never cut one. */
function sprite(parts: Float32Array[][], gap: number): { chans: Float32Array[]; slices: [number, number][] } {
  const g = Math.round(gap * RATE);
  const c = (parts[0] as Float32Array[]).length;
  let n = g;
  for (const p of parts) n += (p[0] as Float32Array).length + g;
  const chans = Array.from({ length: c }, () => new Float32Array(n));
  const slices: [number, number][] = [];
  let at = g;
  for (const p of parts) {
    const len = (p[0] as Float32Array).length;
    for (let k = 0; k < c; k++) (chans[k] as Float32Array).set(p[k] as Float32Array, at);
    slices.push([round(at / RATE), round(len / RATE)]);
    at += len + g;
  }
  return { chans, slices };
}

/** The rumble each kind loses. Generated takes carry a lot under 80 Hz that small speakers only muddy. */
const HIGHPASS: Record<SampleSpec['kind'], number> = { bed: 70, steps: 80, hits: 55, shot: 60, grain: 120 };

const round = (x: number): number => Math.round(x * 10000) / 10000;

function encode(chans: Float32Array[], file: string, kbps: number): void {
  run([FFMPEG, '-v', 'error', '-y', '-f', 'f32le', '-ac', String(chans.length), '-ar', String(RATE), '-i', '-', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, file], interleave(chans));
}

/** Cuts, levels and encodes one sound from its kept takes. */
function processOne(s: SampleSpec): SoundEntry {
  const channels: 1 | 2 = s.stereo ? 2 : 1;
  const takes = Array.from({ length: takesOf(s) }, (_, t) => decode(rawFile(s, t), channels, s.highpass ?? HIGHPASS[s.kind]));
  let chans: Float32Array[];
  let slices: [number, number][] | undefined;
  if (s.kind === 'bed') {
    chans = seamless(takes[0] as Float32Array[], 1.5);
    // Brought to its loudness, then the odd loud moment (a crate set down, a splash) is turned down to the ceiling.
    scale(chans, 10 ** ((s.level - loudness(chans)) / 20));
    limit(chans, 10 ** (-1.5 / 20));
  } else if (s.kind === 'steps' || s.kind === 'hits') {
    // Every hit of every take is brought to the same peak, then the quiet strays are dropped.
    let parts = takes.flatMap((take) => findHits(take, s.sliceMax ?? 0.4).map(([a, b]) => {
      const part = take.map((ch) => ch.slice(a, b));
      fade(part, 0.002, Math.min(0.04, (b - a) / RATE / 3));
      return part;
    }));
    const peaks = parts.map((p) => peakOf(p));
    const loudest = Math.max(...peaks);
    parts = parts.filter((_, i) => (peaks[i] as number) > loudest * 10 ** (-14 / 20));
    for (const p of parts) scale(p, 10 ** (s.level / 20) / Math.max(1e-6, peakOf(p)));
    if (parts.length === 0) throw new Error(`${s.id}: no hits found in the take`);
    ({ chans, slices } = sprite(parts, 0.08));
  } else if (s.kind === 'shot') {
    const parts = takes.map((t) => {
      const part = trim(t);
      fade(part, 0.004, 0.08);
      scale(part, 10 ** (s.level / 20) / Math.max(1e-6, peakOf(part)));
      return part;
    });
    ({ chans, slices } = sprite(parts, 0.08));
  } else {
    chans = trim(takes[0] as Float32Array[]);
    fade(chans, 0.05, 0.05);
    scale(chans, 10 ** (s.level / 20) / Math.max(1e-6, peakOf(chans)));
  }
  const file = `sound/${s.id}.mp3`;
  encode(chans, resolve(root, 'public/assets', file), s.kind === 'bed' ? (channels === 2 ? 96 : 64) : 64);
  const n = (chans[0] as Float32Array).length;
  return { file, kind: s.kind, seconds: round(n / RATE), channels, ...(slices && { slices }), lufs: Math.round(loudness(chans) * 10) / 10, peak: Math.round(db(peakOf(chans)) * 10) / 10 };
}

async function main(): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  if (only && !SAMPLES.some((s) => s.id === only)) throw new Error(`no sound is named ${only}`);
  if (only) for (let t = 0; t < 8; t++) { const f = rawFile(SAMPLES.find((s) => s.id === only) as SampleSpec, t); if (existsSync(f)) rmSync(f); }

  const missing: { s: SampleSpec; take: number }[] = [];
  for (const s of SAMPLES) {
    if (ids && !ids.has(s.id)) continue;
    for (let t = 0; t < takesOf(s); t++) if (!existsSync(rawFile(s, t))) missing.push({ s, take: t });
  }
  const cost = missing.reduce((sum, m) => sum + m.s.seconds * CREDITS_PER_SECOND, 0);
  console.log(`[sound] ${SAMPLES.length} sounds, ${missing.length} takes to ask for, about ${Math.round(cost)} credits`);
  for (const m of missing) console.log(`  ${m.s.id} take ${m.take} (${m.s.seconds} s)`);
  if (dry) return;
  if (!processOnly && missing.length) {
    if (cost > LIMIT) throw new Error(`the run would cost ${cost} credits, over the limit of ${LIMIT}`);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < missing.length) {
        const m = missing[next++] as { s: SampleSpec; take: number };
        const audio = await generate(m.s);
        writeFileSync(rawFile(m.s, m.take), audio);
        console.log(`[sound] made ${m.s.id} take ${m.take}, ${audio.byteLength} bytes`);
      }
    };
    await Promise.all(Array.from({ length: AT_ONCE }, worker));
  }

  // Takes of prompts that changed are kept out of the game and removed.
  const wanted = new Set(SAMPLES.flatMap((s) => Array.from({ length: takesOf(s) }, (_, t) => rawFile(s, t))));
  for (const f of readdirSync(RAW)) if (!wanted.has(resolve(RAW, f))) rmSync(resolve(RAW, f));
  const files = new Set(SAMPLES.map((s) => `${s.id}.mp3`));
  for (const f of readdirSync(OUT)) if (f.endsWith('.mp3') && !files.has(f)) rmSync(resolve(OUT, f));

  const list: SoundList = { version: 1, model: MODEL, sounds: {} };
  const report: Record<string, unknown> = {};
  for (const s of SAMPLES) {
    if (Array.from({ length: takesOf(s) }, (_, t) => rawFile(s, t)).some((f) => !existsSync(f))) {
      console.log(`[sound] skipped ${s.id}: a take is missing`);
      continue;
    }
    const entry = processOne(s);
    list.sounds[s.id] = entry;
    report[s.id] = { prompt: s.prompt, hash: hashOf(s), model: MODEL, takes: takesOf(s), ...entry };
    console.log(`[sound] ${s.id}: ${entry.seconds} s, ${entry.slices ? `${entry.slices.length} slices, ` : ''}${entry.lufs} LUFS, peak ${entry.peak} dBFS`);
  }
  writeFileSync(LIST, `${JSON.stringify(list, null, 2)}\n`);
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, unknown>;
  manifest.sound = { list: 'sound/sound.json', model: MODEL };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  let bytes = 0;
  for (const f of readdirSync(OUT)) bytes += Bun.file(resolve(OUT, f)).size;
  console.log(`[sound] wrote ${Object.keys(list.sounds).length} sounds, ${(bytes / 1e6).toFixed(2)} MB in public/assets/sound`);
}

await main();
