// Auditions for Hobb: one take of the same two lines in each candidate voice, so three can be kept that differ.
//   bun --env-file=<the .env.local with ELEVENLABS_API_KEY> demos/opening/sound/audition.ts          make what is missing
//   bun --env-file=<…> demos/opening/sound/audition.ts --dry                                           price it, make nothing
//
// Every candidate is a professional voice from ElevenLabs' shared library (the designed voice Kausthubh turned
// down for Tamsin was a Voice Design one, so none here is). A library voice not on the account yet is added to
// it under a "Greenhollow Hobb" name. Each take is made in eleven_v4_turbo, the game's model, measured (length,
// pitch, words a second) and transcribed back, since nobody here can listen. The takes go to
// .artifacts/opening/sound/auditions/, the measures to sound/voice/auditions.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyse, decode } from '../../../tools/voice/analyse.ts';
import { apiKey, speakWithTimestamps, transcribe, usage } from '../../../tools/voice/eleven.ts';
import { heardShare } from '../../../tools/voice/lines.ts';

const API = 'https://api.elevenlabs.io';
const MODEL = 'eleven_v4_turbo';
const SETTINGS = { stability: 0.5, similarity_boost: 0.8 };
const CREDITS_PER_CHARACTER = 0.5;
const LIMIT = 6000;

const root = resolve(import.meta.dirname, '../../..');
const OUT = resolve(root, '.artifacts/opening/sound/auditions');
const INDEX = resolve(import.meta.dirname, 'voice/auditions.json');

/** The first line of the legend, then the line in the dark room: the story voice and the close one. */
export const AUDITION = 'A thousand years back, six peoples fought a war nobody could end. ... That one? Damp got at it, I expect. Bed, Button.';

interface Candidate { key: string; voiceId: string; name: string; why: string }

/** Read from each voice's library description (GET /v1/shared-voices), 2026-11-11. Charmion is Tamsin's voice, so she is not here. */
export const CANDIDATES: readonly Candidate[] = [
  { key: 'jane', voiceId: 'RILOU7YmBhvwJGDGjNmP', name: 'Jane - Professional Audiobook Reader', why: 'British, "in her 50s", the most used older British storyteller in the library. The safe narrator.' },
  { key: 'beatrice', voiceId: 'kkPJzQOWz2Oz9cUaEaQd', name: 'Beatrice - Mature, Gentle and Engaging', why: 'British, listed as old. "Warm, rich tone and a calm, steady pace."' },
  { key: 'evelyn', voiceId: 'XEoBW4iDmiawQP72xnAF', name: 'Evelyn - Resourceful and Ironic', why: 'British, a game character voice with "a dry sense of humour" and London grit. The dry one.' },
  { key: 'annemay', voiceId: '95Q3b27r6SAdcKudDL9t', name: 'Anne May - Cozy Tales', why: 'Already on the account as a narrator test. Made for cozy stories.' },
  { key: 'millie', voiceId: 'Nk0iUG137ZABNEQYgAMl', name: 'Millie - Warm, Clear and British', why: 'Middle aged, North-Eastern, a soft Geordie. "Natural, warm and characterful." A cook from the north.' },
  { key: 'miri', voiceId: 'ZR8ruiC9tbg7bV9RmBmC', name: 'Miri - Clear, Warm and Expressive', why: 'Yorkshire, "medium-low", warm and expressive storyteller.' },
  { key: 'jo', voiceId: 'L4so9SudEsIYzE9j4qlR', name: 'Jo', why: 'Middle aged British, "slightly hoarse", casual. A kitchen voice rather than a reader.' },
  { key: 'frances', voiceId: 'mFgXOmlOfXfr6suoQkRH', name: 'Frances - Soft, Warm and Calm', why: 'Irish, middle aged, "soft, warm, calm with husky tones".' },
  { key: 'beth', voiceId: '8N2ng9i2uiUWqstgmWlH', name: 'Beth - Calm, Gentle and Nurturing', why: 'British, "warm, comforting, motherly", made for children\'s stories. The bedtime voice.' },
  { key: 'wilshi', voiceId: 'LOE6OtKY65AfLLoge1Eb', name: 'Wilshi Eckerslyke - Quirky and Engaging', why: 'Leeds Yorkshire, "down-to-earth, working-class warmth".' },
  { key: 'maria', voiceId: 'MDvK7PyhP5PPTV22yvup', name: 'Maria - HQ', why: 'British, middle aged, a soft West Midlands accent.' },
];

export interface Audition {
  key: string; voiceId: string; name: string; why: string; file: string; model: string;
  seconds: number; pitchHz: number; wordsPerSecond: number; transcript: string; heard: number;
}

const headers = () => ({ 'xi-api-key': apiKey(), 'content-type': 'application/json' });
const words = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean).length;

async function onAccount(voiceId: string): Promise<boolean> {
  return (await fetch(`${API}/v1/voices/${voiceId}`, { headers: headers() })).ok;
}

/** The library voice's owner, found by searching the shared library for its name. */
async function ownerOf(c: Candidate): Promise<string> {
  const q = new URLSearchParams({ search: c.name.split(' - ')[0] as string, page_size: '100', gender: 'female' });
  const j = (await (await fetch(`${API}/v1/shared-voices?${q}`, { headers: headers() })).json()) as { voices: { voice_id: string; public_owner_id: string }[] };
  const found = j.voices.find((v) => v.voice_id === c.voiceId);
  if (!found) throw new Error(`${c.name} is not in the shared library`);
  return found.public_owner_id;
}

async function addToAccount(c: Candidate): Promise<void> {
  if (await onAccount(c.voiceId)) return;
  const res = await fetch(`${API}/v1/voices/add/${await ownerOf(c)}/${c.voiceId}`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ new_name: `Greenhollow Hobb (${c.name.split(' - ')[0]})` }),
  });
  if (!res.ok) throw new Error(`adding ${c.name}: ${res.status} ${(await res.text()).slice(0, 300)}`);
}

const index: Audition[] = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : [];
const todo = CANDIDATES.filter((c) => !index.some((a) => a.key === c.key && a.voiceId === c.voiceId && existsSync(resolve(OUT, a.file))));
const cost = Math.ceil(todo.length * AUDITION.length * CREDITS_PER_CHARACTER);
console.log(`${CANDIDATES.length} candidates, ${todo.length} to make, about ${cost} credits`);
if (cost > LIMIT) throw new Error(`STOP: about ${cost} credits, over ${LIMIT}`);
if (process.argv.includes('--dry')) process.exit(0);

mkdirSync(OUT, { recursive: true });
const before = await usage();
for (const c of todo) {
  await addToAccount(c);
  const file = `hobb-${c.key}.mp3`;
  const { audio } = await speakWithTimestamps({ voiceId: c.voiceId, text: AUDITION, modelId: MODEL, settings: SETTINGS, format: 'mp3_44100_64' });
  writeFileSync(resolve(OUT, file), audio);
  const facts = analyse(decode(resolve(OUT, file)));
  const { text: transcript } = await transcribe(new Blob([readFileSync(resolve(OUT, file))]), 'scribe_v2');
  const entry: Audition = {
    key: c.key, voiceId: c.voiceId, name: c.name, why: c.why, file, model: MODEL,
    seconds: +facts.seconds.toFixed(2), pitchHz: Math.round(facts.pitchHz),
    wordsPerSecond: +(words(AUDITION) / (facts.seconds * facts.voiced || 1)).toFixed(2),
    transcript, heard: +heardShare(AUDITION, transcript).toFixed(3),
  };
  console.log(`${c.key.padEnd(9)} ${entry.seconds.toFixed(2)} s, ${entry.pitchHz} Hz, ${entry.wordsPerSecond} words a second of sound, heard ${(entry.heard * 100).toFixed(0)}%: "${transcript}"`);
  const at = index.findIndex((a) => a.key === c.key);
  if (at >= 0) index[at] = entry;
  else index.push(entry);
  mkdirSync(resolve(INDEX, '..'), { recursive: true });
  writeFileSync(INDEX, `${JSON.stringify(index, null, 1)}\n`);
}
const after = await usage();
console.log(`credits this run: ${after.used - before.used} (account: ${after.used} of ${after.limit})`);
