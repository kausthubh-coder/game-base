// The voice tool: makes the clip for every line a voiced person says, ahead of time, so the game never calls
// ElevenLabs.
//   bun --env-file=.env.local tools/voice.ts             make the clips that are missing, and check each new one
//   bun --env-file=.env.local tools/voice.ts --dry       say what would be made and what it would cost, make nothing
//   bun --env-file=.env.local tools/voice.ts --recheck   transcribe every clip again
//
// It reads every conversation in src/game/content/dialogue.ts. A line said by someone in src/game/content/cast.ts
// becomes public/assets/voice/<speaker>/<hash>.mp3, made with the cast's model and that person's voice. The hash
// is of the words given to the voice, the voice, the model, the settings and the format, so a clip is made again
// only when one of those changes, and a line that is gone loses its clip. public/assets/voice/voice.json lists
// every clip by `<speaker>|<text>` with its length and the moment each letter of the box's text appears.
// public/assets/manifest.json points at it (see the voice section of docs/assets.md).
//
// Nobody here can listen, so every new clip is transcribed back with ElevenLabs Scribe and scored by the words
// heard. The scores and transcripts go to assets-src/voice/report.json, not to the game. It stops before making
// anything when the run would cost more than LIMIT credits.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAST, DIRECTION, VOICE_FORMAT, VOICE_MODEL, type VoicedId } from '../src/game/content/cast.ts';
import { CONVERSATIONS } from '../src/game/content/dialogue.ts';
import { analyse, decode } from './voice/analyse.ts';
import { speakWithTimestamps, transcribe, usage } from './voice/eleven.ts';
import { clipHash, heardShare, revealTimes, spokenLines, tagsReadOut, voiceText, withoutCues } from './voice/lines.ts';

/** The most credits one run may spend. */
const LIMIT = 40000;
/** eleven_v4_turbo bills half a credit a character (GET /v1/models, model_rates). */
const CREDITS_PER_CHARACTER = 0.5;
/** Requests at once. The plan allows a few. */
const AT_ONCE = 4;

const root = resolve(import.meta.dirname, '..');
const ASSETS = resolve(root, 'public/assets');
const OUT = resolve(ASSETS, 'voice');
const MANIFEST = resolve(OUT, 'voice.json');
const REPORT = resolve(root, 'assets-src/voice/report.json');
/** ElevenLabs' character timings of each clip, kept so the letter times can be worked out again without new audio. */
const ALIGN = resolve(root, 'assets-src/voice/align');
const alignFileOf = (file: string) => resolve(ALIGN, file.replace(/^voice\//, '').replace(/\.mp3$/, '.json'));
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const recheck = args.includes('--recheck');

/** What the game reads. Kept small: the box needs the file, the length and the letter times. */
interface VoiceManifest {
  version: 1;
  model: string;
  format: string;
  /** By `<speaker>|<text>`. */
  lines: Record<string, { file: string; seconds: number; reveal: number[] }>;
  /** The clips each conversation may play, so the game can load them when the talk starts. */
  conversations: Record<string, string[]>;
}

/** What the tool keeps for people: how each clip was made and what was heard in it. */
interface Report {
  [key: string]: {
    ids: string[]; file: string; hash: string; voiceId: string; model: string; say: string; chars: number;
    seconds: number; pitchHz: number; aligned: boolean; transcript?: string; heard?: number; tagsReadOut?: string[];
  };
}

const readJson = <T>(file: string, fallback: T): T => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback);
const oldReport = readJson<Report>(REPORT, {});

const voiced = spokenLines(CONVERSATIONS).filter((line) => line.speaker in CAST);
const plan = voiced.map((line) => {
  const voice = CAST[line.speaker as VoicedId];
  const say = voiceText(line.text, DIRECTION);
  const hash = clipHash(say, voice, VOICE_MODEL, VOICE_FORMAT);
  const file = `voice/${line.speaker}/${hash}.mp3`;
  const old = oldReport[line.key];
  const made = old?.hash === hash && existsSync(resolve(ASSETS, file));
  return { line, voice, say, hash, file, made };
});
// A direction must name a line that exists, or it is a typo that would leave the line undirected.
for (const text of Object.keys(DIRECTION)) {
  if (!voiced.some((line) => line.text === text)) throw new Error(`DIRECTION names a line no voiced person says: "${text}"`);
  if (withoutCues(text) !== withoutCues(DIRECTION[text].replace(/\[[^\]]*\]\s*/g, ''))) throw new Error(`DIRECTION changes the words of "${text}"`);
}

const todo = plan.filter((p) => !p.made);
const chars = todo.reduce((sum, p) => sum + p.say.length, 0);
const cost = Math.ceil(chars * CREDITS_PER_CHARACTER);
console.log(`${plan.length} voiced lines, ${plan.length - todo.length} made already, ${todo.length} to make: ${chars} characters, about ${cost} credits`);
if (cost > LIMIT) {
  console.error(`STOP: this run would use about ${cost} credits, over the limit of ${LIMIT}. Nothing was made.`);
  process.exit(1);
}
if (dry) {
  for (const p of todo) console.log(`  ${p.line.ids[0]}: ${p.say}`);
  process.exit(0);
}

const before = await usage();
console.log(`account before: ${before.used} of ${before.limit} credits used`);
const report: Report = {};

async function make(p: (typeof plan)[number]): Promise<void> {
  const target = resolve(ASSETS, p.file);
  const old = oldReport[p.line.key];
  let entry = p.made && old ? { ...old, ids: p.line.ids } : null;
  if (!entry) {
    mkdirSync(resolve(OUT, p.line.speaker), { recursive: true });
    const made = await speakWithTimestamps({ voiceId: p.voice.voiceId, text: p.say, modelId: VOICE_MODEL, settings: p.voice.settings, format: VOICE_FORMAT });
    writeFileSync(target, made.audio);
    const alignment = made.alignment;
    const facts = analyse(decode(target));
    entry = {
      ids: p.line.ids, file: p.file, hash: p.hash, voiceId: p.voice.voiceId, model: VOICE_MODEL, say: p.say, chars: p.say.length,
      seconds: +facts.seconds.toFixed(3), pitchHz: Math.round(facts.pitchHz), aligned: false,
    };
    mkdirSync(resolve(alignFileOf(p.file), '..'), { recursive: true });
    writeFileSync(alignFileOf(p.file), JSON.stringify(alignment));
  }
  if (!entry.transcript || recheck || !p.made) entry.transcript = (await transcribe(new Blob([readFileSync(target)]), 'scribe_v2')).text;
  // Scored again every run from the kept transcript, so a change to the scoring costs nothing.
  entry.heard = +heardShare(withoutCues(p.say.replace(/\[[^\]]*\]/g, ' ')), entry.transcript).toFixed(3);
  entry.tagsReadOut = tagsReadOut(p.say, entry.transcript);
  report[p.line.key] = entry;
  if (!p.made) console.log(`  ${p.line.ids[0]}: ${entry.seconds.toFixed(2)} s, heard ${((entry.heard ?? 0) * 100).toFixed(0)}%${entry.tagsReadOut?.length ? `, TAG READ OUT: ${entry.tagsReadOut.join(' ')}` : ''}`);
}

// A few at a time, in order.
const queue = plan.slice();
await Promise.all(Array.from({ length: AT_ONCE }, async () => {
  for (let p = queue.shift(); p; p = queue.shift()) await make(p);
}));

// The letter times come from the alignment kept in assets-src/voice/align, so the box's timing can be made again
// without new audio when the rule in lines.ts changes.
const manifest: VoiceManifest = { version: 1, model: VOICE_MODEL, format: VOICE_FORMAT, lines: {}, conversations: {} };
for (const p of plan) {
  const entry = report[p.line.key];
  const alignFile = alignFileOf(p.file);
  const alignment = existsSync(alignFile) ? JSON.parse(readFileSync(alignFile, 'utf8')) : null;
  const { reveal, aligned } = revealTimes(p.line.text, alignment, entry.seconds);
  entry.aligned = aligned;
  manifest.lines[p.line.key] = { file: p.file, seconds: entry.seconds, reveal };
  for (const id of p.line.conversations) (manifest.conversations[id] ??= []).push(p.line.key);
}

// Clips and alignments of lines that are gone.
const keep = new Set(plan.flatMap((p) => [resolve(ASSETS, p.file), alignFileOf(p.file)]));
let removed = 0;
for (const dir of [OUT, ALIGN]) {
  for (const speaker of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []) {
    for (const name of readdirSync(resolve(dir, speaker))) {
      if (!keep.has(resolve(dir, speaker, name))) (rmSync(resolve(dir, speaker, name)), removed++);
    }
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest) + '\n');
mkdirSync(resolve(REPORT, '..'), { recursive: true });
writeFileSync(REPORT, JSON.stringify(report, null, 1) + '\n');

// The asset manifest points at the voice lines. Written only when the pointer is missing, so nothing else moves.
const assets = JSON.parse(readFileSync(resolve(ASSETS, 'manifest.json'), 'utf8'));
if (assets.voice?.lines !== 'voice/voice.json') {
  assets.voice = { lines: 'voice/voice.json', model: VOICE_MODEL };
  writeFileSync(resolve(ASSETS, 'manifest.json'), JSON.stringify(assets, null, 2) + '\n');
}

const after = await usage();
const by = new Map<string, { lines: number; seconds: number; chars: number }>();
for (const p of plan) {
  const s = by.get(p.line.speaker) ?? { lines: 0, seconds: 0, chars: 0 };
  s.lines++, (s.seconds += report[p.line.key].seconds), (s.chars += p.say.length);
  by.set(p.line.speaker, s);
}
console.log('\nspeaker   lines  seconds  characters');
for (const [speaker, s] of by) console.log(`${speaker.padEnd(9)} ${String(s.lines).padStart(5)}  ${s.seconds.toFixed(1).padStart(7)}  ${String(s.chars).padStart(10)}`);
const all = Object.values(report);
console.log(`total     ${String(all.length).padStart(5)}  ${all.reduce((t, e) => t + e.seconds, 0).toFixed(1).padStart(7)}  ${String(all.reduce((t, e) => t + e.chars, 0)).padStart(10)}`);
const low = Object.entries(report).filter(([, e]) => (e.heard ?? 1) < 0.9 || e.tagsReadOut?.length);
console.log(low.length ? `\nheard below 90%, or a tag read out:\n${low.map(([k, e]) => `  ${e.ids[0]} ${((e.heard ?? 0) * 100).toFixed(0)}%: "${e.transcript}"  (line: ${k.split('|')[1]})`).join('\n')}` : '\nevery clip heard at 90% or more, and no tag read out');
const unaligned = all.filter((e) => !e.aligned);
if (unaligned.length) console.log(`letter times spread evenly (the alignment did not match the text): ${unaligned.map((e) => e.ids[0]).join(', ')}`);
console.log(`removed ${removed} files of lines that are gone`);
console.log(`credits this run: ${after.used - before.used} (account: ${after.used} of ${after.limit})`);
