// Auditions: each candidate voice in tools/voice/auditions.ts says two of the person's own lines, made exactly as
// tools/voice.ts would make them (the cast's model, format and DIRECTION, the person's settings), so the takes of
// the voice picked are the game's clips and are not bought twice.
//   bun --env-file=<.env.local with ELEVENLABS_API_KEY> tools/voice/audition.ts            make what is missing
//   bun --env-file=<…> tools/voice/audition.ts --dry                                     price it, make nothing
//   bun --env-file=<…> tools/voice/audition.ts --only stag,holt                          only these people
//
// Nobody here can listen, so each take is measured (length, median pitch, words a second of sound) and
// transcribed back with ElevenLabs Scribe. The takes go to assets-src/voice/auditions/<speaker>/<candidate>/,
// named by the hash tools/voice.ts gives the clip, beside their character timings; the measures go to
// assets-src/voice/auditions/auditions.json. A library voice not on the account yet is added to it first.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DIRECTION, VOICE_FORMAT, VOICE_MODEL } from '../../src/game/content/cast.ts';
import { CONVERSATIONS } from '../../src/game/content/dialogue.ts';
import { analyse, decode } from './analyse.ts';
import { AUDITIONS } from './auditions.ts';
import { apiKey, speakWithTimestamps, transcribe, usage } from './eleven.ts';
import { clipHash, heardShare, spokenLines, tagsReadOut, voiceText, withoutCues } from './lines.ts';

const LIMIT = 2500;
const CREDITS_PER_CHARACTER = 0.5;
const API = 'https://api.elevenlabs.io';

const root = resolve(import.meta.dirname, '../..');
export const AUDITION_DIR = resolve(root, 'assets-src/voice/auditions');
export const AUDITION_INDEX = resolve(AUDITION_DIR, 'auditions.json');

export interface Take {
  text: string; say: string; hash: string; file: string; seconds: number; pitchHz: number; wordsPerSecond: number;
  transcript: string; heard: number; tagsReadOut: string[];
}
export interface Tried { voiceId: string; name: string; why: string; takes: Take[] }
/** By speaker, then candidate key. */
export type AuditionIndex = Record<string, Record<string, Tried>>;

const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const headers = () => ({ 'xi-api-key': apiKey(), 'content-type': 'application/json' });
const words = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean).length;

async function addToAccount(speaker: string, voiceId: string, name: string): Promise<void> {
  if ((await fetch(`${API}/v1/voices/${voiceId}`, { headers: headers() })).ok) return;
  const q = new URLSearchParams({ search: name.split(/ [-–] /)[0].trim(), page_size: '100' });
  const j = (await (await fetch(`${API}/v1/shared-voices?${q}`, { headers: headers() })).json()) as { voices: { voice_id: string; public_owner_id: string }[] };
  const found = j.voices.find((v) => v.voice_id === voiceId);
  if (!found) throw new Error(`${name} is not in the shared library`);
  const res = await fetch(`${API}/v1/voices/add/${found.public_owner_id}/${voiceId}`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ new_name: `Greenhollow ${speaker} (${name.split(/ [-–] /)[0].trim()})` }),
  });
  if (!res.ok) throw new Error(`adding ${name}: ${res.status} ${(await res.text()).slice(0, 300)}`);
}

if (import.meta.main) {
  const voiced = spokenLines(CONVERSATIONS);
  const index: AuditionIndex = existsSync(AUDITION_INDEX) ? JSON.parse(readFileSync(AUDITION_INDEX, 'utf8')) : {};
  const todo: { speaker: string; key: string; voiceId: string; name: string; why: string; text: string; say: string; hash: string; file: string; settings: object }[] = [];
  for (const [speaker, a] of Object.entries(AUDITIONS)) {
    if (only && !only.has(speaker)) continue;
    for (const text of a.lines) {
      if (!voiced.some((l) => l.speaker === speaker && l.text === text)) throw new Error(`${speaker} never says "${text}" in dialogue.ts`);
    }
    for (const c of a.candidates) {
      for (const text of a.lines) {
        const say = voiceText(text, DIRECTION);
        const hash = clipHash(say, { voiceId: c.voiceId, why: '', settings: a.settings }, VOICE_MODEL, VOICE_FORMAT);
        const file = `${speaker}/${c.key}/${hash}.mp3`;
        if (index[speaker]?.[c.key]?.takes.some((t) => t.hash === hash) && existsSync(resolve(AUDITION_DIR, file))) continue;
        todo.push({ speaker, key: c.key, voiceId: c.voiceId, name: c.name, why: c.why, text, say, hash, file, settings: a.settings });
      }
    }
  }
  const chars = todo.reduce((n, t) => n + t.say.length, 0);
  const cost = Math.ceil(chars * CREDITS_PER_CHARACTER);
  console.log(`${todo.length} takes to make: ${chars} characters, about ${cost} credits`);
  if (cost > LIMIT) {
    console.error(`STOP: about ${cost} credits, over the limit of ${LIMIT}. Nothing was made.`);
    process.exit(1);
  }
  if (args.includes('--dry')) process.exit(0);

  const before = await usage();
  const added = new Set<string>();
  for (const t of todo) {
    if (!added.has(t.voiceId)) (await addToAccount(t.speaker, t.voiceId, t.name), added.add(t.voiceId));
    const target = resolve(AUDITION_DIR, t.file);
    mkdirSync(resolve(target, '..'), { recursive: true });
    const made = await speakWithTimestamps({ voiceId: t.voiceId, text: t.say, modelId: VOICE_MODEL, settings: t.settings, format: VOICE_FORMAT });
    writeFileSync(target, made.audio);
    writeFileSync(target.replace(/\.mp3$/, '.json'), JSON.stringify(made.alignment));
    const facts = analyse(decode(target));
    const { text: transcript } = await transcribe(new Blob([readFileSync(target)]), 'scribe_v2');
    const spoken = withoutCues(t.say.replace(/\[[^\]]*\]/g, ' '));
    const take: Take = {
      text: t.text, say: t.say, hash: t.hash, file: t.file, seconds: +facts.seconds.toFixed(3), pitchHz: Math.round(facts.pitchHz),
      wordsPerSecond: +(words(spoken) / (facts.seconds * facts.voiced || 1)).toFixed(2),
      transcript, heard: +heardShare(spoken, transcript).toFixed(3), tagsReadOut: tagsReadOut(t.say, transcript),
    };
    const tried = ((index[t.speaker] ??= {})[t.key] ??= { voiceId: t.voiceId, name: t.name, why: t.why, takes: [] });
    Object.assign(tried, { voiceId: t.voiceId, name: t.name, why: t.why });
    tried.takes = [...tried.takes.filter((x) => x.text !== t.text), take];
    writeFileSync(AUDITION_INDEX, `${JSON.stringify(index, null, 1)}\n`);
    console.log(`${t.speaker.padEnd(12)} ${t.key.padEnd(12)} ${take.seconds.toFixed(2)} s, ${take.pitchHz} Hz, ${take.wordsPerSecond} w/s, heard ${(take.heard * 100).toFixed(0)}%${take.tagsReadOut.length ? ', TAG READ OUT' : ''}: "${transcript}"`);
  }

  // One row a candidate: what the pick is made from.
  console.log('\nspeaker      candidate     pitch  words/s  heard');
  for (const [speaker, tried] of Object.entries(index)) {
    if (only && !only.has(speaker)) continue;
    for (const [key, c] of Object.entries(tried)) {
      const mean = (f: (t: Take) => number) => c.takes.reduce((n, t) => n + f(t), 0) / c.takes.length;
      console.log(`${speaker.padEnd(12)} ${key.padEnd(12)} ${String(Math.round(mean((t) => t.pitchHz))).padStart(5)}  ${mean((t) => t.wordsPerSecond).toFixed(2).padStart(7)}  ${(mean((t) => t.heard) * 100).toFixed(0).padStart(4)}%`);
    }
  }
  const after = await usage();
  console.log(`credits this run: ${after.used - before.used} (account: ${after.used} of ${after.limit})`);
}
