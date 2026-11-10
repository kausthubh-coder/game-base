// Makes the cast's voices with ElevenLabs Voice Design.
//   bun experiments/voice/tools/design-voices.ts design [tamsin maren ...]   three previews each, into audio/auditions/
//   bun experiments/voice/tools/design-voices.ts save <id> <preview 1-3>      saves that preview as a voice and prints its id
// Every preview is measured (length, pitch, words a second), since nobody here can listen to it.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { analyse, decode, describe } from '../../../tools/voice/analyse.ts';
import { designVoice, saveDesignedVoice, usage } from '../../../tools/voice/eleven.ts';
import { CAST, type CastId } from '../cast.ts';

const DIR = new URL('../audio/auditions/', import.meta.url).pathname;
const INDEX = DIR + 'auditions.json';
mkdirSync(DIR, { recursive: true });

interface Audition { id: CastId; n: number; generatedVoiceId: string; file: string; seconds: number; pitchHz: number; wordsPerSecond: number }
const index: Audition[] = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : [];

const [command, ...rest] = process.argv.slice(2);
if (command === 'design') {
  const before = await usage();
  for (const id of (rest.length ? rest : Object.keys(CAST)) as CastId[]) {
    const who = CAST[id];
    const { previews } = await designVoice(who.description, who.sample);
    const words = who.sample.split(/\s+/).length;
    for (const [k, p] of previews.entries()) {
      const file = `${id}-${k + 1}.mp3`;
      const bytes = Buffer.from(p.audio_base_64, 'base64');
      writeFileSync(DIR + file, bytes);
      const facts = analyse(decode(DIR + file));
      const wps = words / facts.seconds;
      console.log(`${id} ${k + 1}: ${describe(facts)}, ${wps.toFixed(2)} words/s`);
      const entry = { id, n: k + 1, generatedVoiceId: p.generated_voice_id, file, seconds: +facts.seconds.toFixed(2), pitchHz: Math.round(facts.pitchHz), wordsPerSecond: +wps.toFixed(2) };
      const at = index.findIndex((a) => a.id === id && a.n === k + 1);
      if (at >= 0) index[at] = entry;
      else index.push(entry);
    }
    writeFileSync(INDEX, JSON.stringify(index, null, 1));
  }
  const after = await usage();
  console.log(`characters used: ${after.used - before.used}`);
} else if (command === 'save') {
  const [id, n] = rest as [CastId, string];
  const a = index.find((x) => x.id === id && x.n === Number(n));
  if (!a) throw new Error(`no audition ${id} ${n}`);
  const voiceId = await saveDesignedVoice(`Greenhollow ${CAST[id].name}`, CAST[id].description.slice(0, 1000), a.generatedVoiceId);
  console.log(`${id}: ${voiceId}`);
} else {
  console.error('usage: design-voices.ts design [ids...] | save <id> <n>');
  process.exit(2);
}
