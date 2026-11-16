// Makes the opening film's recorded sound ahead of time: Hobb's eleven lines in each take, and the effects.
//   bun --env-file=<the .env.local with ELEVENLABS_API_KEY> demos/opening/sound/make.ts            make what is missing
//   … make.ts --dry          say what would be made and what it costs, make nothing
//   … make.ts --voice        only the voice (add --take a for one take)      … make.ts --fx   only the effects
//   … make.ts --process      cut, level and encode again from the kept takes, call nothing
//   … make.ts --recheck      transcribe every clip again
//
// A line is made with the take's voice in the game's model, with the lines before and after it given as context
// so the eleven are said as one story. What ElevenLabs returns is kept in .artifacts/opening/sound/raw (named
// by a hash of what made it), then cut to where the voice is, brought to one loudness and written as
// sound/voice/<take>/<shot>.mp3, a small mono mp3. voice/voice.json lists each clip's seconds, which time the
// film; voice/report.json keeps the transcripts. Nobody here can listen, so every clip is transcribed back with
// Scribe and scored by the words heard.
//
// An effect is made from its prompt in recorded.ts the way tools/sound.ts makes the game's: a bed is folded into
// a seamless loop and brought to its loudness, a one-shot is trimmed and brought to its peak, and the moment it
// is loudest is kept as its `hit`. fx/fx.json lists them. It stops before calling anything when a run would cost
// more than LIMIT credits.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { speakWithTimestamps, transcribe, usage } from '../../../tools/voice/eleven.ts';
import { heardShare, tagsReadOut } from '../../../tools/voice/lines.ts';
import { makeFilm } from '../film.ts';
import type { ShotId } from '../types.ts';
import { RECORDED, type RecordedSpec } from './recorded.ts';
import { DIRECTION, MODEL, TAKES, settingsOf } from './takes.ts';

/** The most credits one run may spend (the brief's stop line). */
const LIMIT = 6000;
/** v4 Turbo bills half a credit a character; sound effects 40 credits a second. */
const VOICE_CREDITS = 0.5;
const FX_CREDITS = 40;
const RATE = 44100;
/** Bumped when the cutting or leveling changes, so every clip is cut again. */
const PROCESS = 3;
/** Each clip's loudness, LUFS. The mix sets the final level. */
const VOICE_LUFS = -17;
const FX_MODEL = 'eleven_text_to_sound_v3';
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

const here = import.meta.dirname;
const root = resolve(here, '../../..');
const RAW = resolve(root, '.artifacts/opening/sound/raw');
const VOICE_LIST = resolve(here, 'voice/voice.json');
const VOICE_REPORT = resolve(here, 'voice/report.json');
const FX_LIST = resolve(here, 'fx/fx.json');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const processOnly = args.includes('--process');
const recheck = args.includes('--recheck');
const onlyTake = args.includes('--take') ? args[args.indexOf('--take') + 1] : undefined;
const doVoice = !args.includes('--fx') || args.includes('--voice');
const doFx = !args.includes('--voice') || args.includes('--fx');

/** What the page reads: each take's clips by shot. */
export interface VoiceList {
  version: 1;
  model: string;
    /** `seconds` is when the voice stops; `fileSeconds` the clip's length. */
  takes: Record<string, Partial<Record<ShotId, { file: string; seconds: number; fileSeconds: number }>>>;
}
interface VoiceReport {
  [key: string]: { hash: string; voiceId: string; say: string; chars: number; seconds: number; speech: [start: number, end: number]; transcript?: string; heard?: number; tagsReadOut?: string[] };
}
/** What the page reads: each effect's file and timing. */
export interface FxList {
  version: 1;
  model: string;
  sounds: Record<string, { file: string; kind: RecordedSpec['kind']; seconds: number; hit: number; lufs: number; peak: number; hash: string }>;
}

const readJson = <T>(file: string, fallback: T): T => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback);
const sha = (x: unknown) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 10);

// ---- audio in and out, by ffmpeg --------------------------------------------------------------------------

function run(cmd: string[], input?: Uint8Array): { out: Uint8Array; err: string } {
  const p = Bun.spawnSync(cmd, { stdin: input ?? 'ignore', stdout: 'pipe', stderr: 'pipe' });
  if (p.exitCode !== 0) throw new Error(`${cmd.slice(0, 3).join(' ')} failed: ${p.stderr.toString().slice(-600)}`);
  return { out: p.stdout, err: p.stderr.toString() };
}
function decode(file: string, highpass = 0): Float32Array {
  const filter = highpass ? ['-af', `highpass=f=${highpass}:poles=2`] : [];
  const { out } = run([FFMPEG, '-v', 'error', '-i', file, ...filter, '-f', 'f32le', '-ac', '1', '-ar', String(RATE), '-']);
  return new Float32Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));
}
function encode(samples: Float32Array, file: string, kbps = 64): void {
  mkdirSync(resolve(file, '..'), { recursive: true });
  run([FFMPEG, '-v', 'error', '-y', '-f', 'f32le', '-ac', '1', '-ar', String(RATE), '-i', '-', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, file], new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
}
/** Integrated loudness (EBU R128), by ffmpeg. */
function loudness(samples: Float32Array): number {
  const { err } = run([FFMPEG, '-hide_banner', '-nostats', '-f', 'f32le', '-ac', '1', '-ar', String(RATE), '-i', '-', '-af', 'ebur128', '-f', 'null', '-'], new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
  const m = /Integrated loudness:\s*I:\s*(-?[\d.]+|-inf)/.exec(err);
  return m && m[1] !== '-inf' ? Number(m[1]) : -70;
}
const peakOf = (s: Float32Array) => s.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));
const scale = (s: Float32Array, g: number) => { for (let i = 0; i < s.length; i++) s[i] = (s[i] as number) * g; };
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

/** RMS of 10 ms frames, in dB. */
function frames(s: Float32Array): number[] {
  const hop = RATE / 100;
  const out: number[] = [];
  for (let at = 0; at + hop <= s.length; at += hop) {
    let e = 0;
    for (let i = at; i < at + hop; i++) e += (s[i] as number) ** 2;
    out.push(10 * Math.log10(e / hop + 1e-14));
  }
  return out;
}

function fade(s: Float32Array, inSeconds: number, outSeconds: number): void {
  const fi = Math.round(inSeconds * RATE), fo = Math.round(outSeconds * RATE);
  for (let i = 0; i < Math.min(fi, s.length); i++) s[i] = (s[i] as number) * (i / fi);
  for (let i = 0; i < Math.min(fo, s.length); i++) s[s.length - 1 - i] = (s[s.length - 1 - i] as number) * (i / fo);
}

/** Cuts to where the sound is: from `before` seconds ahead of the first frame within `floor` dB of the loudest, to `after` past the last. */
function trim(s: Float32Array, floor: number, before: number, after: number): Float32Array {
  const f = frames(s);
  const top = Math.max(...f);
  const first = f.findIndex((v) => v > top - floor);
  const last = f.length - 1 - [...f].reverse().findIndex((v) => v > top - floor);
  const from = Math.max(0, Math.round((first / 100 - before) * RATE)), to = Math.min(s.length, Math.round(((last + 1) / 100 + after) * RATE));
  return s.slice(from, to);
}

/** Folds the last `seconds` over the first with an equal-power fade, so the file loops with no seam (as tools/sound.ts). */
function seamless(s: Float32Array, seconds: number): Float32Array {
  const x = Math.round(seconds * RATE), n = s.length - x;
  const out = s.slice(0, n);
  for (let i = 0; i < x; i++) {
    const t = i / x;
    out[i] = (s[i] as number) * Math.sin((t * Math.PI) / 2) + (s[n + i] as number) * Math.cos((t * Math.PI) / 2);
  }
  return out;
}

/** Brings the few samples over `ceiling` down with a short look-ahead and a 120 ms return (as tools/sound.ts). */
function limit(s: Float32Array, ceiling: number): void {
  const ahead = Math.round(RATE * 0.005), back = Math.exp(-1 / (RATE * 0.12));
  let g = 1, hold = 0, want = 1;
  for (let i = s.length - 1; i >= 0; i--) {
    const p = Math.abs(s[i] as number);
    const need = p > ceiling ? ceiling / p : 1;
    if (need <= want) (want = need), (hold = ahead);
    else if (--hold < 0) want = need;
    g = want < g ? want : 1 - (1 - g) * back;
    s[i] = (s[i] as number) * g;
  }
}

// ---- the voice ------------------------------------------------------------------------------------------------

const film = makeFilm();
const voiceList = readJson<VoiceList>(VOICE_LIST, { version: 1, model: MODEL, takes: {} });
const voiceReport = readJson<VoiceReport>(VOICE_REPORT, {});

const voicePlan = TAKES.filter((t) => !onlyTake || t.id === onlyTake).flatMap((take) =>
  film.shots.map((shot) => {
    const say = DIRECTION[shot.id] ?? shot.say;
    const settings = settingsOf(shot.part);
    const previousText = film.shots[shot.n - 1]?.say;
    const nextText = film.shots[shot.n + 1]?.say;
    const hash = sha([say, take.voiceId, MODEL, settings, previousText, nextText]);
    const key = `${take.id}/${shot.id}`;
    const raw = resolve(RAW, `voice/${take.id}-${shot.id}-${hash}.mp3`);
    const file = `voice/${take.id}/${shot.id}.mp3`;
    const made = voiceReport[key]?.hash === `${hash}.${PROCESS}` && existsSync(resolve(here, file));
    return { take, shot, say, settings, previousText, nextText, hash, key, raw, file, made };
  }),
);

/**
 * Where the voice is in a clip: the first and last 10 ms within 50 dB of its loudest. ElevenLabs' character
 * timings are no help here: the last letter's end is always the end of the file.
 */
function speechSpan(s: Float32Array): [number, number] {
  const f = frames(s);
  const top = Math.max(...f);
  return [f.findIndex((v) => v > top - 50) / 100, (f.length - [...f].reverse().findIndex((v) => v > top - 50)) / 100];
}

async function makeLine(p: (typeof voicePlan)[number]): Promise<void> {
  const alignFile = p.raw.replace(/\.mp3$/, '.json');
  if (!existsSync(p.raw)) {
    if (processOnly) throw new Error(`${p.key}: no kept take to process; run without --process`);
    mkdirSync(resolve(p.raw, '..'), { recursive: true });
    const made = await speakWithTimestamps({ voiceId: p.take.voiceId, text: p.say, modelId: MODEL, settings: p.settings, format: 'mp3_44100_128', previousText: p.previousText, nextText: p.nextText });
    writeFileSync(p.raw, made.audio);
    writeFileSync(alignFile, JSON.stringify(made.alignment));
  }
  // Cut to the voice (50 dB under its loudest, so a soft last word keeps its tail), a breath of room either
  // side, then one loudness for every clip.
  let s = trim(decode(p.raw, 60), 50, 0.03, 0.12);
  fade(s, 0.005, 0.05);
  scale(s, 10 ** ((VOICE_LUFS - loudness(s)) / 20));
  if (peakOf(s) > 10 ** (-1.5 / 20)) limit(s, 10 ** (-1.5 / 20));
  const target = resolve(here, p.file);
  encode(s, target);
  s = decode(target);
  const old = voiceReport[p.key];
  const entry: VoiceReport[string] = {
    hash: `${p.hash}.${PROCESS}`, voiceId: p.take.voiceId, say: p.say, chars: p.say.length,
    seconds: round(s.length / RATE), speech: speechSpan(s).map((x) => round(x, 2)) as [number, number],
    transcript: old?.hash === `${p.hash}.${PROCESS}` ? old.transcript : undefined,
  };
  voiceReport[p.key] = entry;
}

async function checkLine(p: (typeof voicePlan)[number]): Promise<void> {
  const entry = voiceReport[p.key];
  if (!entry) return;
  if (!entry.transcript || recheck) entry.transcript = (await transcribe(new Blob([readFileSync(resolve(here, p.file))]), 'scribe_v2')).text;
  // Scribe writes "'round" for "round": a leading apostrophe is not a different word.
  entry.heard = round(heardShare(p.say.replace(/\[[^\]]*\]/g, ' '), entry.transcript.replace(/(^|\s)'(?=\w)/g, '$1')));
  entry.tagsReadOut = tagsReadOut(p.say, entry.transcript);
  // The film is timed by when the voice stops, not by the file, which keeps a breath of room after it.
  (voiceList.takes[p.take.id] ??= {})[p.shot.id] = { file: p.file, seconds: entry.speech[1], fileSeconds: entry.seconds };
}

// ---- the effects ----------------------------------------------------------------------------------------------

const fxList = readJson<FxList>(FX_LIST, { version: 1, model: FX_MODEL, sounds: {} });
const fxPlan = RECORDED.map((spec) => {
  const hash = sha([spec.prompt, spec.seconds, spec.kind, spec.influence ?? 0.3, FX_MODEL]);
  const raw = resolve(RAW, `fx/${spec.id}.${hash}.mp3`);
  const made = fxList.sounds[spec.id]?.hash === `${hash}.${PROCESS}.${spec.level}` && existsSync(resolve(here, `fx/${spec.id}.mp3`));
  return { spec, hash, raw, made };
});

async function makeFx(p: (typeof fxPlan)[number]): Promise<void> {
  const { spec } = p;
  if (!existsSync(p.raw)) {
    if (processOnly) throw new Error(`${spec.id}: no kept take to process; run without --process`);
    const res = await fetch(`https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({ text: spec.prompt, loop: spec.kind === 'bed', duration_seconds: spec.seconds, prompt_influence: spec.influence ?? 0.3, model_id: FX_MODEL }),
    });
    if (!res.ok) throw new Error(`ElevenLabs sound-generation ${res.status} for ${spec.id}: ${(await res.text()).slice(0, 300)}`);
    mkdirSync(resolve(p.raw, '..'), { recursive: true });
    writeFileSync(p.raw, new Uint8Array(await res.arrayBuffer()));
    console.log(`  made ${spec.id}`);
  }
  let s = decode(p.raw, spec.highpass ?? (spec.kind === 'bed' ? 70 : 50));
  if (spec.kind === 'bed') {
    s = seamless(s, 1.5);
    scale(s, 10 ** ((spec.level - loudness(s)) / 20));
    limit(s, 10 ** (-3 / 20));
  } else {
    s = trim(s, 50, 0.01, 0.05);
    fade(s, 0.004, 0.08);
    scale(s, 10 ** (spec.level / 20) / Math.max(1e-6, peakOf(s)));
  }
  const file = `fx/${spec.id}.mp3`;
  encode(s, resolve(here, file));
  s = decode(resolve(here, file));
  // A one-shot's hit: the first 10 ms within 6 dB of its loudest. A bed has none.
  const f = frames(s);
  const top = Math.max(...f);
  const hit = spec.kind === 'shot' ? f.findIndex((v) => v > top - 6) / 100 : 0;
  fxList.sounds[spec.id] = { file, kind: spec.kind, seconds: round(s.length / RATE), hit: round(hit), lufs: round(loudness(s), 1), peak: round(db(peakOf(s)), 1), hash: `${p.hash}.${PROCESS}.${spec.level}` };
}

// ---- the run --------------------------------------------------------------------------------------------------

const voiceTodo = doVoice ? voicePlan.filter((p) => !p.made && !existsSync(p.raw)) : [];
const fxTodo = doFx ? fxPlan.filter((p) => !p.made && !existsSync(p.raw)) : [];
const voiceCost = Math.ceil(voiceTodo.reduce((sum, p) => sum + p.say.length, 0) * VOICE_CREDITS);
const fxCost = fxTodo.reduce((sum, p) => sum + p.spec.seconds * FX_CREDITS, 0);
console.log(`voice: ${voiceTodo.length} of ${doVoice ? voicePlan.length : 0} lines to ask for, about ${voiceCost} credits`);
console.log(`effects: ${fxTodo.length} of ${doFx ? fxPlan.length : 0} to ask for, about ${fxCost} credits`);
if (voiceCost + fxCost > LIMIT) {
  console.error(`STOP: this run would use about ${voiceCost + fxCost} credits, over the limit of ${LIMIT}. Nothing was made.`);
  process.exit(1);
}
if (dry) {
  for (const p of voiceTodo) console.log(`  ${p.key}: ${p.say}`);
  for (const p of fxTodo) console.log(`  ${p.spec.id} (${p.spec.seconds} s)`);
  process.exit(0);
}
const before = processOnly ? null : await usage();

/** A few at a time. */
async function pool<T>(items: T[], n: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = items.slice();
  await Promise.all(Array.from({ length: n }, async () => { for (let x = queue.shift(); x; x = queue.shift()) await work(x); }));
}

if (doVoice) {
  await pool(voicePlan.filter((p) => !p.made || processOnly), 3, makeLine);
  await pool(voicePlan, 3, checkLine);
  writeFileSync(VOICE_LIST, `${JSON.stringify(voiceList, null, 1)}\n`);
  writeFileSync(VOICE_REPORT, `${JSON.stringify(voiceReport, null, 1)}\n`);
  console.log('\ntake shot       seconds  voice from-to  heard  transcript');
  for (const p of voicePlan) {
    const e = voiceReport[p.key];
    if (!e) continue;
    const flag = (e.heard ?? 0) < 1 || e.tagsReadOut?.length ? '  <<' : '';
    console.log(`${p.take.id}    ${p.shot.id.padEnd(9)} ${e.seconds.toFixed(2).padStart(7)}  ${e.speech[0].toFixed(2)}-${e.speech[1].toFixed(2).padEnd(5)}  ${((e.heard ?? 0) * 100).toFixed(0).padStart(4)}%  "${e.transcript}"${e.tagsReadOut?.length ? ` TAG READ OUT: ${e.tagsReadOut.join(' ')}` : ''}${flag}`);
  }
}
if (doFx) {
  await pool(fxPlan.filter((p) => !p.made || processOnly), 3, makeFx);
  writeFileSync(FX_LIST, `${JSON.stringify(fxList, null, 1)}\n`);
  console.log('\neffect        seconds  hit    LUFS   peak');
  for (const [id, e] of Object.entries(fxList.sounds)) console.log(`${id.padEnd(13)} ${e.seconds.toFixed(2).padStart(7)} ${e.hit.toFixed(2).padStart(5)} ${String(e.lufs).padStart(6)} ${String(e.peak).padStart(6)}`);
}
// Bytes a take loads: its eleven clips and every effect.
const bytesOf = (file: string) => (existsSync(resolve(here, file)) ? Bun.file(resolve(here, file)).size : 0);
const fxBytes = Object.values(fxList.sounds).reduce((sum, e) => sum + bytesOf(e.file), 0);
for (const take of TAKES) {
  const voiceBytes = Object.values(voiceList.takes[take.id] ?? {}).reduce((sum, e) => sum + bytesOf(e.file), 0);
  console.log(`take ${take.id}: ${(voiceBytes / 1e3).toFixed(0)} KB of voice + ${(fxBytes / 1e3).toFixed(0)} KB of effects = ${((voiceBytes + fxBytes) / 1e6).toFixed(2)} MB`);
}
if (before) {
  const after = await usage();
  console.log(`credits this run: ${after.used - before.used} (account: ${after.used} of ${after.limit})`);
}
