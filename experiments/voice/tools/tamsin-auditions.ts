// Six new voices for Tamsin, after the designed one (tamsin-2, `30hqoTJF3dS5trqljOct`) was turned down by ear.
//   bun --env-file=.env.local experiments/voice/tools/tamsin-auditions.ts
// Four come from the shared voice library (professional voices, added to the account), two from Voice Design
// with descriptions unlike the first three. Each one reads the same four of her real lines in eleven_v4_turbo,
// the model the game uses, into audio/auditions/tamsin-<n>.mp3. Every take is measured and transcribed back,
// since nobody here can listen. A voice already on the account, or a take already made, is not made again.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { analyse, decode, describe } from '../../../tools/voice/analyse.ts';
import { designVoice, saveDesignedVoice, speakWithTimestamps, transcribe, usage } from '../../../tools/voice/eleven.ts';

const API = 'https://api.elevenlabs.io';
const DIR = new URL('../audio/auditions/', import.meta.url).pathname;
const INDEX = DIR + 'auditions.json';
const PREVIEWS = new URL('../../../.artifacts/voice/design/', import.meta.url).pathname;
mkdirSync(PREVIEWS, { recursive: true });
const MODEL = 'eleven_v4_turbo';
const SETTINGS = { stability: 0.5, similarity_boost: 0.8 };

/** Four of her lines from src/game/content/dialogue.ts, one take. */
export const AUDITION =
  'Twelve people have asked me for this plot. You are the first who looked at the ground before the view. ' +
  'Festival tonight. I am told to wear the good coat. I own one coat. ' +
  'You fed it first. I would have set a snare and priced the tail. ' +
  'Good harvest. Small, and good.';

type Candidate =
  | { n: number; source: 'library'; name: string; voiceId: string; owner: string; why: string }
  | { n: number; source: 'design'; name: string; description: string; why: string };

export const CANDIDATES: Candidate[] = [
  {
    n: 4, source: 'library', name: 'Beatrice - Mature, Gentle and Engaging', voiceId: 'kkPJzQOWz2Oz9cUaEaQd',
    owner: 'e21da557bd3d3d214ca0cd46cb06720331c223a478ee711c3b62b8965330ec9d',
    why: 'British, listed as old. "Warm, rich tone and a calm, steady pace." Made for stories, 38 million characters a year.',
  },
  {
    n: 5, source: 'library', name: 'Jane - Professional Audiobook Reader', voiceId: 'RILOU7YmBhvwJGDGjNmP',
    owner: '0c43a48b8798abacee29a02415d3170e32814497fc3cf96297cbe407a5194638',
    why: 'British, listed as old ("in her 50s"). The most used older British voice in the library (1.5 billion characters a year), so likely the most natural.',
  },
  {
    n: 6, source: 'library', name: 'Evelyn - Resourceful and Ironic', voiceId: 'XEoBW4iDmiawQP72xnAF',
    owner: '5214e3d3123945dcad0881d8743a206c4dbc617f34e858e8878c4fd90deb4892',
    why: 'British, middle aged, a game character voice: "a dry sense of humour", "a touch of London irony and grit". The dry wit, a little younger.',
  },
  {
    n: 7, source: 'library', name: 'Charmion - Soft and husky', voiceId: 'lUCNYQh2kqW2wiie85Qk',
    owner: '6f846ef5fbdcc1482e1b7213fbc58156aa89a6d8b02b904f8055d329de9ac650',
    why: 'British, middle aged, husky, made for characters. The rasp.',
  },
  {
    n: 8, source: 'design', name: 'Greenhollow Tamsin (Yorkshire)',
    description:
      'An old woman of about seventy from Yorkshire, a retired treasure appraiser who spent forty years underground in mines and vaults. ' +
      'A weathered, gravelly, smoky voice with real age in it and a slight crackle, low in pitch. Deadpan and dry, she says short plain sentences ' +
      'with comfortable pauses and a smile hidden behind them. Broad Northern English accent. A natural, conversational performance, like a beloved ' +
      'grandmother in a cozy animated film, never a narrator.',
    why: 'Voice Design, unlike the first three: older (seventy), gravelly and smoky rather than husky alto, a broad Northern accent rather than soft rural.',
  },
  {
    n: 9, source: 'design', name: 'Greenhollow Tamsin (Highland)',
    description:
      'A sturdy Scottish woman in her late sixties, a retired adventurer who now keeps a lodge. A warm, slightly raspy mezzo voice with a twinkle of ' +
      'mischief, worn by weather. Unhurried and plain spoken, wry and fond at once, the voice of a storyteller grandmother by the fire. ' +
      'Soft Highland Scottish accent. Relaxed, natural and close, as in a cozy anime, not a narration.',
    why: 'Voice Design, unlike the first three: a soft Highland Scottish accent, a mezzo with a twinkle rather than a low husky alto.',
  },
];

interface Audition {
  id: 'tamsin'; n: number; generatedVoiceId?: string; file: string; seconds: number; pitchHz: number; wordsPerSecond: number;
  voiceId: string; source: 'library' | 'design'; name: string; model: string; transcript: string; heard: number; why: string;
}
const index: Record<string, unknown>[] = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : [];
const headers = { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '', 'content-type': 'application/json' };

const words = (s: string) => s.toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);
function heardShare(expected: string, transcript: string): number {
  const a = words(expected), b = words(transcript);
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return a.length ? dp[a.length][b.length] / a.length : 1;
}

async function onAccount(voiceId: string): Promise<boolean> {
  return (await fetch(`${API}/v1/voices/${voiceId}`, { headers })).ok;
}

/** A library voice is added to the account under a Greenhollow name. Returns the id to speak with. */
async function addLibraryVoice(c: Extract<Candidate, { source: 'library' }>): Promise<string> {
  if (await onAccount(c.voiceId)) return c.voiceId;
  const res = await fetch(`${API}/v1/voices/add/${c.owner}/${c.voiceId}`, {
    method: 'POST', headers, body: JSON.stringify({ new_name: `Greenhollow Tamsin (${c.name.split(' - ')[0]})` }),
  });
  if (!res.ok) throw new Error(`adding ${c.name}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { voice_id: string }).voice_id;
}

/** Three Voice Design previews. The one in her range is saved: low-mid pitch, nearest 2.3 words a second. */
async function designAndSave(c: Extract<Candidate, { source: 'design' }>): Promise<{ voiceId: string; generatedVoiceId: string }> {
  const prior = index.find((a) => a.id === 'tamsin' && a.n === c.n) as Audition | undefined;
  if (prior?.voiceId && (await onAccount(prior.voiceId))) return { voiceId: prior.voiceId, generatedVoiceId: prior.generatedVoiceId ?? prior.voiceId };
  const { previews } = await designVoice(c.description, AUDITION);
  const count = words(AUDITION).length;
  const scored = previews.map((p, k) => {
    const file = `${PREVIEWS}tamsin-${c.n}-preview-${k + 1}.mp3`;
    writeFileSync(file, Buffer.from(p.audio_base_64, 'base64'));
    const facts = analyse(decode(file));
    const wps = count / facts.seconds;
    console.log(`  preview ${k + 1}: ${describe(facts)}, ${wps.toFixed(2)} words/s`);
    // Distance from the brief: 2.3 words a second, a pitch near 165 Hz (an older woman's speaking range).
    return { p, score: Math.abs(wps - 2.3) / 0.3 + Math.abs(facts.pitchHz - 165) / 25 };
  });
  scored.sort((a, b) => a.score - b.score);
  const chosen = scored[0].p;
  const voiceId = await saveDesignedVoice(c.name, c.description.slice(0, 1000), chosen.generated_voice_id);
  console.log(`  saved preview ${previews.indexOf(chosen) + 1} as ${voiceId}`);
  return { voiceId, generatedVoiceId: chosen.generated_voice_id };
}

const before = await usage();
for (const c of CANDIDATES) {
  console.log(`tamsin-${c.n}: ${c.name}`);
  const file = `tamsin-${c.n}.mp3`;
  let voiceId: string, generatedVoiceId: string | undefined;
  if (c.source === 'library') voiceId = await addLibraryVoice(c);
  else ({ voiceId, generatedVoiceId } = await designAndSave(c));
  const prior = index.find((a) => a.id === 'tamsin' && a.n === c.n) as Audition | undefined;
  if (prior?.voiceId === voiceId && prior.model === MODEL && existsSync(DIR + file)) {
    console.log('  made already');
    continue;
  }
  const { audio } = await speakWithTimestamps({ voiceId, text: AUDITION, modelId: MODEL, settings: SETTINGS });
  writeFileSync(DIR + file, audio);
  const facts = analyse(decode(DIR + file));
  const { text: transcript } = await transcribe(new Blob([readFileSync(DIR + file)]), 'scribe_v2');
  const entry: Audition = {
    id: 'tamsin', n: c.n, ...(generatedVoiceId && { generatedVoiceId }), file, seconds: +facts.seconds.toFixed(2), pitchHz: Math.round(facts.pitchHz),
    wordsPerSecond: +(words(AUDITION).length / facts.seconds).toFixed(2), voiceId, source: c.source, name: c.name, model: MODEL,
    transcript, heard: +heardShare(AUDITION, transcript).toFixed(3), why: c.why,
  };
  console.log(`  ${describe(facts)}, ${entry.wordsPerSecond} words/s, heard ${(entry.heard * 100).toFixed(0)}%: "${transcript}"`);
  const at = index.findIndex((a) => a.id === 'tamsin' && a.n === c.n);
  if (at >= 0) index[at] = entry as unknown as Record<string, unknown>;
  else index.push(entry as unknown as Record<string, unknown>);
  writeFileSync(INDEX, JSON.stringify(index, null, 1));
}
const after = await usage();
console.log(`credits used: ${after.used - before.used} (account: ${after.used} of ${after.limit})`);
