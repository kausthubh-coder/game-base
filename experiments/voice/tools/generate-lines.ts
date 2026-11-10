// Makes the voiced scene's audio, ahead of time.
//   bun --env-file=.env.local experiments/voice/tools/generate-lines.ts [--check]
// For every voiced line in scene/lines.ts: eleven_v3 audio with the time of each character, saved as
// audio/scene/<scene>-<n>.mp3, and listed in audio/lines.json with the second each letter of the box's
// text should appear. COMPARE lines are made again with the other models into audio/compare/.
// A line already made with the same words, voice and model is not made again.
// --check also transcribes every clip with ElevenLabs speech to text and scores it against the words,
// since nobody here can listen: a tag read out loud or a dropped word shows up as a low score.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { analyse, decode } from '../lib/analyse.ts';
import { speakWithTimestamps, transcribe, usage, type Alignment } from '../lib/eleven.ts';
import { CAST, MODELS, type CastId } from '../cast.ts';
import { COMPARE, SCENES } from '../scene/lines.ts';
import { CONVERSATIONS, type Line } from '../../../src/game/content/dialogue.ts';

const ROOT = new URL('../audio/', import.meta.url).pathname;
const MANIFEST = ROOT + 'lines.json';
const check = process.argv.includes('--check');

export interface MadeLine {
  file: string;
  speaker: CastId;
  model: string;
  voiceId: string;
  say: string;
  hash: string;
  seconds: number;
  pitchHz: number;
  /** For each character of the box's text, the second it appears. */
  reveal: number[];
  /** True when the timing came from ElevenLabs' character alignment, false when it was spread evenly. */
  aligned: boolean;
  /** Characters billed. */
  chars: number;
  transcript?: string;
  /** Share of the line's words heard in the transcript, in order. */
  heard?: number;
}

const manifest: { lines: Record<string, MadeLine>; compare: Record<string, MadeLine> } = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : { lines: {}, compare: {} };

// Every line must be the game's own.
const gameLines = new Set<string>();
const collect = (list: readonly (string | Line)[]) => {
  for (const l of list) {
    if (typeof l === 'string') gameLines.add(l);
    else {
      gameLines.add(l.text);
      for (const c of l.choices ?? []) (gameLines.add(c.text), collect(c.then ?? []));
    }
  }
};
for (const c of CONVERSATIONS) collect(c.lines);
for (const scene of SCENES) for (const line of scene.lines) if (!gameLines.has(line.text)) throw new Error(`not a line of the game: "${line.text}"`);

const words = (s: string) => s.toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);
/** Longest common run of words, as a share of the expected words. */
function heardShare(expected: string, transcript: string): number {
  const a = words(expected), b = words(transcript);
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return a.length ? dp[a.length][b.length] / a.length : 1;
}

/**
 * When each character of the box's text appears. A leading stage cue such as "(waking) " shows at once.
 * The rest follows the voice: the alignment's characters, with the [tags] taken out, are matched to the
 * text one by one. If they do not line up, the letters are spread evenly over the clip.
 */
function revealTimes(text: string, alignment: Alignment | null, seconds: number): { reveal: number[]; aligned: boolean } {
  const cue = text.match(/^\([^)]*\)\s*/)?.[0] ?? '';
  const body = text.slice(cue.length);
  const reveal = new Array<number>(text.length).fill(0);
  const even = () => {
    for (let i = 0; i < body.length; i++) reveal[cue.length + i] = (i / body.length) * seconds * 0.95;
    return { reveal, aligned: false };
  };
  if (!alignment) return even();
  const chars: { c: string; t: number }[] = [];
  let depth = 0;
  for (let i = 0; i < alignment.characters.length; i++) {
    const c = alignment.characters[i];
    if (c === '[') depth++;
    else if (c === ']') depth = Math.max(0, depth - 1);
    else if (!depth) chars.push({ c, t: alignment.character_start_times_seconds[i] });
  }
  let j = 0;
  for (let i = 0; i < body.length; i++) {
    const want = body[i];
    if (/\s/.test(want)) {
      reveal[cue.length + i] = j < chars.length ? chars[j].t : seconds;
      while (j < chars.length && /\s/.test(chars[j].c)) j++;
      continue;
    }
    while (j < chars.length && /\s/.test(chars[j].c)) j++;
    if (j >= chars.length || chars[j].c.toLowerCase() !== want.toLowerCase()) return even();
    reveal[cue.length + i] = chars[j++].t;
  }
  return { reveal, aligned: true };
}

const plain = (say: string) => say.replace(/\[[^\]]*\]\s*/g, '').trim();

async function make(key: string, into: 'lines' | 'compare', dir: string, speaker: CastId, text: string, say: string, model: string): Promise<void> {
  const who = CAST[speaker];
  const hash = createHash('sha1').update(JSON.stringify([say, who.voiceId, model, who.settings])).digest('hex').slice(0, 12);
  const file = `${dir}/${key}.mp3`;
  const old = manifest[into][key];
  if (old?.hash === hash && existsSync(ROOT + file)) {
    // Measured again, so a change to lib/analyse.ts reaches every clip without new audio.
    const facts = analyse(decode(ROOT + file));
    (old.seconds = +facts.seconds.toFixed(3)), (old.pitchHz = Math.round(facts.pitchHz));
    if (check && old.heard === undefined) await listen(old);
    return;
  }
  mkdirSync(ROOT + dir, { recursive: true });
  const { audio, alignment } = await speakWithTimestamps({ voiceId: who.voiceId, text: say, modelId: model, settings: who.settings });
  writeFileSync(ROOT + file, audio);
  const facts = analyse(decode(ROOT + file));
  const { reveal, aligned } = revealTimes(text, alignment, facts.seconds);
  const made: MadeLine = { file, speaker, model, voiceId: who.voiceId, say, hash, seconds: +facts.seconds.toFixed(3), pitchHz: Math.round(facts.pitchHz), reveal: reveal.map((t) => +t.toFixed(3)), aligned, chars: say.length };
  manifest[into][key] = made;
  if (check) await listen(made);
  console.log(`${key} ${model}: ${facts.seconds.toFixed(2)} s, ${aligned ? 'aligned' : 'EVEN'}${made.heard !== undefined ? `, heard ${(made.heard * 100).toFixed(0)}%` : ''}`);
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
}

async function listen(made: MadeLine): Promise<void> {
  const { text } = await transcribe(new Blob([readFileSync(ROOT + made.file)]), 'scribe_v2');
  made.transcript = text;
  made.heard = +heardShare(plain(made.say), text).toFixed(3);
}

const before = await usage();
for (const scene of SCENES) {
  for (const [n, line] of scene.lines.entries()) {
    if (line.by === 'narrator' || line.by === 'player') continue;
    await make(`${scene.id}-${n}`, 'lines', 'scene', line.by, line.text, line.say, MODELS.v3);
  }
}
for (const { scene: id, index } of COMPARE) {
  const line = SCENES.find((s) => s.id === id)!.lines[index];
  if (line.by === 'narrator' || line.by === 'player') throw new Error(`compare line ${id}-${index} is not voiced`);
  // Flash and turbo do not read tags: they get the plain words. v4 gets the tags, to see what it does with them.
  for (const [name, model] of [['flash', MODELS.flash], ['v4', MODELS.v4], ['v4turbo', MODELS.v4turbo]] as const) {
    await make(`${id}-${index}-${name}`, 'compare', 'compare', line.by, line.text, name === 'v4' ? line.say : plain(line.say), model);
  }
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
const after = await usage();
const all = [...Object.values(manifest.lines), ...Object.values(manifest.compare)];
console.log(`\n${Object.keys(manifest.lines).length} scene lines, ${Object.keys(manifest.compare).length} comparison clips, ${all.reduce((s, m) => s + m.seconds, 0).toFixed(1)} s of audio`);
console.log(`characters billed this run: ${after.used - before.used} (account: ${after.used} of ${after.limit})`);
if (check) {
  const low = all.filter((m) => (m.heard ?? 1) < 0.9);
  console.log(low.length ? `heard below 90%:\n${low.map((m) => `  ${m.file} ${(m.heard! * 100).toFixed(0)}%: "${m.transcript}"`).join('\n')}` : 'every clip heard at 90% or more');
}
