// Times the live pipelines end to end in headless Chrome, on the real talk page.
//   bun experiments/voice/tools/bench.ts <b1|b2> <text|voice> [--model sol-fast] [--tts eleven_flash_v2_5] [--voice sol] [--url http://localhost:5381]
// The player is a fake mic: macOS `say` reading the questions below over a little room noise (pure
// digital silence can stall a voice call). Each turn is timed by the page from the end of the player's
// words (the last loud 20 ms frame of the fake mic, or the moment the text is sent) to the first sound
// of her reply: the moment B2 schedules its first audio, or the moment B1's call carries sound.
// The greeting turn is not counted: a new Codex thread's first reply is slow.
// Results go to .artifacts/voice/bench/<pipe>-<mode>-<model>-<time>.json, with a summary on stdout.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const [pipe, mode] = args as ['b1' | 'b2', 'text' | 'voice'];
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
if (!['b1', 'b2'].includes(pipe) || !['text', 'voice'].includes(mode)) {
  console.error('usage: bench.ts <b1|b2> <text|voice> [--model m] [--tts t] [--voice v] [--url u]');
  process.exit(2);
}
const BASE = opt('url', 'http://localhost:5381');
const model = opt('model', 'sol-fast'), tts = opt('tts', 'eleven_flash_v2_5'), voice = opt('voice', 'sol');

export const QUESTIONS = [
  'Hello Tamsin. What should I do first?',
  'Why was the book blank for so long?',
  'What do mosslings need?',
  'Who is the queen?',
  'Do you think it will rain today?',
  'What is under your lodge floor?',
  'Can you tell me what a smartphone is?',
];

// The player's voice, made once with macOS `say` (the Daniel voice, British English).
const FIX = new URL('../../../.artifacts/voice/fixtures/', import.meta.url).pathname;
mkdirSync(FIX, { recursive: true });
QUESTIONS.forEach((q, i) => {
  const wav = `${FIX}q${i}.wav`;
  if (existsSync(wav)) return;
  execFileSync('say', ['-v', 'Daniel', '-o', `${FIX}q${i}.aiff`, q]);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', `${FIX}q${i}.aiff`, wav]);
});

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.route('**/__fixture/*', (r) => r.fulfill({ contentType: 'audio/wav', body: readFileSync(FIX + r.request().url().split('/').pop()) }));
// The fake mic: an AudioContext stream with room noise, into which __speak(n) plays question n.
await page.addInitScript(() => {
  let ctx: AudioContext, dest: MediaStreamAudioDestinationNode;
  navigator.mediaDevices.getUserMedia = async () => {
    if (dest) return dest.stream;
    ctx = new AudioContext({ sampleRate: 24000 });
    dest = ctx.createMediaStreamDestination();
    const noise = ctx.createBuffer(1, 48000, 24000);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.002;
    const src = ctx.createBufferSource();
    Object.assign(src, { buffer: noise, loop: true });
    src.connect(dest);
    src.start();
    return dest.stream;
  };
  (window as any).__speak = async (n: number) => {
    const buf = await ctx.decodeAudioData(await (await fetch(`/__fixture/q${n}.wav`)).arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(dest);
    await new Promise((r) => ((src.onended = r), src.start()));
    return performance.now();
  };
});

const t0 = Date.now();
const log = (m: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}  ${m}`);
await page.goto(`${BASE}/talk?pipe=${pipe}&moment=stone&model=${model}&tts=${tts}&voice=${voice}`);
await page.evaluate('window.__talk.begin()');
log('connected');

const turnsNow = () => page.evaluate('window.__talk.turns.map(t => ({ ...t }))') as Promise<any[]>;
/** Waits for turn `index` to have its first sound and to be done, then for her to stop. */
async function settle(index: number, timeout = 30_000): Promise<boolean> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const t = (await turnsNow())[index];
    if (t?.done && t.firstSound !== undefined) {
      // Her reply plays out before the next question.
      while (Date.now() < end && ((await page.evaluate('window.__talk.quiet()')) as number) < 1000) await page.waitForTimeout(100);
      return true;
    }
    await page.waitForTimeout(100);
  }
  return false;
}

if (!(await settle(0, 60_000))) log('the greeting did not finish');
else log(`greeting: ${(await turnsNow())[0].reply}`);
if (pipe === 'b2' && mode === 'voice') await page.evaluate('window.__talk.hear()');

const failures: string[] = [];
for (const [i, q] of QUESTIONS.entries()) {
  const before = (await turnsNow()).length;
  let spokeEnd = 0;
  if (mode === 'text') await page.evaluate((w) => (window as any).__talk.say(w), q);
  else spokeEnd = (await page.evaluate((n) => (window as any).__speak(n), i)) as number;
  // Wait for the turn this question opened.
  const deadline = Date.now() + 20_000;
  while ((await turnsNow()).length <= before && Date.now() < deadline) await page.waitForTimeout(100);
  const index = (await turnsNow()).length - 1;
  if (index < before) {
    failures.push(`q${i}: no turn opened`);
    log(`q${i}: no turn opened`);
    continue;
  }
  const ok = await settle(index);
  const t = (await turnsNow())[index];
  if (!ok) failures.push(`q${i}: no reply in 30 s`);
  const total = t.firstSound !== undefined && !Number.isNaN(t.mark) ? Math.round(t.firstSound - t.mark) : null;
  log(`q${i} ${total ?? '-'} ms | heard "${t.words || q}" | ${t.reply}`);
  if (mode === 'voice' && spokeEnd) t.wavEnd = spokeEnd;
  t.question = q;
  t.total = total;
  // Let the room go quiet before the next question, so B1's voice detection starts fresh.
  await page.waitForTimeout(800);
}

const turns = (await turnsNow()).slice(1);
await page.screenshot({ path: `.artifacts/voice/talk-${pipe}-${mode}.png` });
await browser.close();

const totals = turns.map((t) => (t.firstSound !== undefined && !Number.isNaN(t.mark) ? t.firstSound - t.mark : NaN)).filter((x) => Number.isFinite(x));
const sorted = [...totals].sort((a, b) => a - b);
const med = (xs: number[]) => {
  const s = [...xs].filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? Math.round(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
const summary = {
  pipe,
  mode,
  model: pipe === 'b2' ? model : `realtime v3, voice ${voice}`,
  tts: pipe === 'b2' ? tts : null,
  when: new Date().toISOString(),
  load: execFileSync('uptime').toString().trim(),
  turns: turns.length,
  timed: totals.length,
  median: med(totals),
  best: sorted[0] !== undefined ? Math.round(sorted[0]) : null,
  worst: sorted.length ? Math.round(sorted.at(-1)!) : null,
  parts:
    pipe === 'b2'
      ? {
          stt: med(turns.map((t) => t.sttMs ?? NaN)),
          detectorHangover: mode === 'voice' ? 600 : 0,
          modelFirstToken: med(turns.map((t) => t.server?.firstToken ?? NaN)),
          firstSentence: med(turns.map((t) => t.server?.firstSentence ?? NaN)),
          ttsFirstByteAfterSentence: med(turns.map((t) => (t.server?.firstAudioByte ?? NaN) - (t.server?.firstSentence ?? NaN))),
        }
      : null,
  failures: [...failures, ...errors],
  raw: turns,
};
const out = new URL(`../../../.artifacts/voice/bench/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const file = `${out}${pipe}-${mode}-${pipe === 'b2' ? model + '-' + tts : voice}-${Date.now()}.json`;
writeFileSync(file, JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, raw: undefined }, null, 1));
console.log(`saved ${file}`);
process.exit(failures.length || errors.length ? 1 : 0);
