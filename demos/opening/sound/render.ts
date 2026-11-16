// What sound/check.ts drives in headless Chrome: the whole soundtrack, or one part of it, rendered faster than
// real time on an OfflineAudioContext and handed back as a 16-bit WAV; how long each clip's voice really is;
// and the soundtrack played, stopped and played again on a live context.
import { makeFilm } from '../film.ts';
import type { ShotId } from '../types.ts';
import type { Group } from './cues.ts';
import { createSoundtrack } from './index.ts';

const RATE = 44100;

/** Which part a render keeps. */
const PARTS: Record<string, (group: Group, name?: string) => boolean> = {
  all: () => true,
  voice: (g) => g === 'voice',
  under: (g) => g !== 'voice',
  mark: (g, n) => g === 'score' && n === 'mark',
  title: (g, n) => g === 'score' && n === 'title',
  thunder: (g, n) => g === 'fx' && n === 'thunder',
};

function wav(buffer: AudioBuffer, channels: 1 | 2): string {
  const n = buffer.length;
  const bytes = new Uint8Array(44 + n * channels * 2);
  const v = new DataView(bytes.buffer);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };
  text(0, 'RIFF'); v.setUint32(4, 36 + n * channels * 2, true); text(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, channels, true); v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * channels * 2, true); v.setUint16(32, channels * 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, n * channels * 2, true);
  const l = buffer.getChannelData(0), r = buffer.getChannelData(1);
  for (let i = 0; i < n; i++) {
    const s = channels === 1 ? ((l[i] as number) + (r[i] as number)) / 2 : null;
    for (let c = 0; c < channels; c++) {
      const x = Math.max(-1, Math.min(1, s ?? ((c ? r : l)[i] as number)));
      v.setInt16(44 + (i * channels + c) * 2, Math.round(x * 32767), true);
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

async function render(voice: string, part: string): Promise<{ wav: string; length: number; ms: number }> {
  const probe = await createSoundtrack({ voice, context: new OfflineAudioContext(2, 1, RATE) });
  const film = makeFilm(probe.voiceSeconds);
  const ctx = new OfflineAudioContext(2, Math.ceil(film.length * RATE), RATE);
  const sound = await createSoundtrack({ voice, context: ctx, only: PARTS[part] });
  const t = performance.now();
  sound.play(film, 0);
  const buffer = await ctx.startRendering();
  return { wav: wav(buffer, part === 'all' ? 2 : 1), length: film.length, ms: Math.round(performance.now() - t) };
}

/** Where the voice ends in each decoded clip: the last 10 ms within 50 dB of its loudest, as make.ts measures it. */
async function clipEnds(voice: string): Promise<Record<string, { voiceSeconds: number; decoded: number; voiceEnds: number }>> {
  const sound = await createSoundtrack({ voice, context: new OfflineAudioContext(2, 1, RATE) });
  const out: Record<string, { voiceSeconds: number; decoded: number; voiceEnds: number }> = {};
  for (const [shot, seconds] of Object.entries(sound.voiceSeconds) as [ShotId, number][]) {
    const url = new URL(`./voice/${voice}/${shot}.mp3`, import.meta.url).href;
    const buffer = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(await (await fetch(url)).arrayBuffer());
    const d = buffer.getChannelData(0), hop = Math.round(buffer.sampleRate / 100);
    const frames: number[] = [];
    for (let at = 0; at + hop <= d.length; at += hop) {
      let e = 0;
      for (let i = at; i < at + hop; i++) e += (d[i] as number) ** 2;
      frames.push(10 * Math.log10(e / hop + 1e-14));
    }
    const top = Math.max(...frames);
    const last = frames.length - [...frames].reverse().findIndex((v) => v > top - 50);
    out[shot] = { voiceSeconds: seconds, decoded: +buffer.duration.toFixed(3), voiceEnds: last / 100 };
  }
  return out;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** play(film, 40), stop(), play(film, 12), stop() on a live context, with what is sounding after each. */
async function seekTest(voice: string) {
  const sound = await createSoundtrack({ voice });
  const film = makeFilm(sound.voiceSeconds);
  const log: { step: string; live: number; levelDb: number }[] = [];
  const note = (step: string) => log.push({ step, live: sound.debug.live(), levelDb: +sound.debug.level().toFixed(1) });
  sound.play(film, 40);
  await wait(1500);
  note('playing from 40 s, 1.5 s in');
  sound.stop();
  await wait(120);
  note('120 ms after stop()');
  await wait(300);
  note('420 ms after stop()');
  sound.play(film, 12);
  await wait(1500);
  note('playing from 12 s, 1.5 s in');
  sound.stop();
  await wait(420);
  note('420 ms after the second stop()');
  return { log, state: (sound.debug.context() as AudioContext | null)?.state ?? 'none' };
}

declare global { interface Window { __sound?: unknown } }
window.__sound = { render, clipEnds, seekTest, ready: true };
