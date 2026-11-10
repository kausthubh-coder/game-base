// Experiment B: talk to Tamsin by voice or by text, through one of two pipelines.
//   B1: ChatGPT's realtime voice over WebRTC, started through codex app-server (/ws/b1).
//   B2: speech to text, a fast Codex text model, then ElevenLabs speaking each sentence (/ws/b2).
// Every turn is timed from the end of the player's words (the last loud moment of their voice, or the
// moment they pressed Enter) to the first sound of her reply in the page. window.__talk exposes the
// turns for tools/bench.ts.
import { CAST } from '../cast.ts';
import { createBox, useBook } from '../ui/book.ts';
import { DEFAULT_VOICE, GREETING, REALTIME_VOICES } from './options.ts';
import { MOMENTS } from './tamsin.ts';

type Pipe = 'b1' | 'b2';

export interface Turn {
  id: number;
  pipe: Pipe;
  input: 'voice' | 'text' | 'greeting';
  words: string;
  /** performance.now() of the end of the player's words. */
  mark: number;
  /** Speech to text, in ms, for B2 voice turns. */
  sttMs?: number;
  /** When the words left the page for the server. */
  sentAt?: number;
  /** When her first sound plays (B2) or is heard in the call (B1). */
  firstSound?: number;
  /** B2: the server's split of its own time, ms from receiving the words. */
  server?: { firstToken?: number; firstSentence?: number; firstAudioByte?: number; textDone?: number };
  reply: string;
  /** B2: seconds of audio received. */
  audioSeconds?: number;
  done: boolean;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage');
useBook(stage);
const box = createBox(stage);
box.speaker(CAST.tamsin.name, CAST.tamsin.portrait);
box.show('', '', 0);

const params = new URLSearchParams(location.search);
let pipe: Pipe = params.get('pipe') === 'b1' ? 'b1' : 'b2';
const momentSel = $<HTMLSelectElement>('moment');
for (const [id, m] of Object.entries(MOMENTS)) momentSel.add(new Option(m.label, id));
momentSel.value = params.get('moment') ?? 'stone';
const voiceSel = $<HTMLSelectElement>('voice');
for (const v of REALTIME_VOICES) voiceSel.add(new Option(v, v));
voiceSel.value = params.get('voice') ?? DEFAULT_VOICE;
if (params.get('model')) $<HTMLSelectElement>('model').value = params.get('model')!;
if (params.get('tts')) $<HTMLSelectElement>('tts').value = params.get('tts')!;
const BACKDROP: Record<string, string> = { stone: 'stone', rain: 'square', festival: 'bank' };

const status = (s: string) => ($('status').textContent = s);
const turns: Turn[] = [];
let connected = false;

function showPipe(): void {
  document.querySelectorAll<HTMLElement>('[data-pipe]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pipe === pipe)));
  document.querySelectorAll<HTMLElement>('[data-for]').forEach((el) => (el.hidden = el.dataset.for !== pipe));
  $('subtitle').textContent = pipe === 'b1' ? 'B1: ChatGPT realtime voice through Codex' : 'B2: Codex text model, then ElevenLabs';
  $('backdrop').style.backgroundImage = `url(/backdrops/${BACKDROP[momentSel.value] ?? 'stone'}.jpg)`;
}
showPipe();

// --- the log ------------------------------------------------------------------------------
const ms = (n?: number) => (n === undefined ? '…' : `${Math.round(n)} ms`);
function render(t: Turn): void {
  let li = document.getElementById(`turn-${t.id}`);
  if (!li) {
    li = document.createElement('li');
    li.id = `turn-${t.id}`;
    $('turns').append(li);
  }
  const you = t.input === 'greeting' ? '<p class="you"><em>You walk up to her.</em></p>' : `<p class="you"><span class="who">You:</span> ${escape(t.words)}</p>`;
  const chips: string[] = [];
  if (t.firstSound !== undefined) chips.push(`<span class="chip total">${ms(t.firstSound - t.mark)} to her voice</span>`);
  if (t.sttMs !== undefined) chips.push(`<span class="chip">hearing ${ms(t.sttMs)}</span>`);
  if (t.server?.firstToken !== undefined) chips.push(`<span class="chip">model ${ms(t.server.firstToken)}</span>`);
  if (t.server?.firstSentence !== undefined) chips.push(`<span class="chip">1st sentence ${ms(t.server.firstSentence)}</span>`);
  if (t.server?.firstAudioByte !== undefined) chips.push(`<span class="chip">voice ${ms(t.server.firstAudioByte - (t.server.firstSentence ?? 0))}</span>`);
  li.innerHTML = `${you}<p><span class="who">Tamsin:</span> ${escape(t.reply) || '…'}</p>${chips.length ? `<div class="times">${chips.join('')}</div>` : ''}`;
  li.scrollIntoView({ block: 'end' });
}
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Shows her reply in the box: the words so far. */
function showReply(text: string): void {
  box.show('', text, text.length);
  measure();
}
function measure(): void {
  stage.style.setProperty('--bar-h', `${document.querySelector('.bar')!.getBoundingClientRect().bottom}px`);
  stage.style.setProperty('--box-h', `${Math.max(0, innerHeight - box.pane.getBoundingClientRect().top)}px`);
}
addEventListener('resize', measure);
measure();

// --- hearing the player: a level detector on the mic ------------------------------------------------
/** dBFS above which a 20 ms frame counts as voice. */
const VOICE_DB = -45;
/** Silence that ends an utterance. */
const HANGOVER_MS = 600;

let audioCtx: AudioContext | null = null;
const context = () => (audioCtx ??= new AudioContext());

/** Calls back when speech starts and ends on a stream. `end` gets the time of the last loud frame. */
function listenFor(stream: MediaStream, on: { start(t: number): void; end(lastLoud: number): void; ignore?: () => boolean }): () => void {
  const ctx = context();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  let speaking = false, loudFrames = 0, lastLoud = 0;
  const timer = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const x of buf) sum += x * x;
    const db = 10 * Math.log10(sum / buf.length + 1e-12);
    const now = performance.now();
    if (on.ignore?.()) return void ((speaking = false), (loudFrames = 0));
    if (db > VOICE_DB) {
      lastLoud = now;
      if (!speaking && ++loudFrames >= 4) (speaking = true), on.start(now);
    } else {
      loudFrames = 0;
      if (speaking && now - lastLoud > HANGOVER_MS) (speaking = false), on.end(lastLoud);
    }
  }, 20);
  return () => (clearInterval(timer), src.disconnect());
}

/** Moments her voice starts after a gap, on the page clock. B1 times its turns from these. */
const onsets: number[] = [];
/** When her voice was last loud in the call (B1). */
let heardHer = 0;
function watchVoice(stream: MediaStream): void {
  const ctx = context();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  let quietSince = performance.now(), loud = false;
  setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const x of buf) sum += x * x;
    const db = 10 * Math.log10(sum / buf.length + 1e-12);
    const now = performance.now();
    if (db > -50) {
      heardHer = now;
      if (!loud && now - quietSince > 250) {
        onsets.push(now);
        settleOnsets();
      }
      loud = true;
    } else {
      if (loud) quietSince = now;
      loud = false;
    }
  }, 10);
}
/** Gives each B1 turn the first onset after its mark. */
function settleOnsets(): void {
  for (const t of turns) {
    if (t.pipe !== 'b1' || t.firstSound !== undefined || Number.isNaN(t.mark)) continue;
    const at = onsets.find((o) => o > t.mark);
    if (at !== undefined) (t.firstSound = at), render(t);
  }
}

let mic: MediaStream | null = null;
async function getMic(): Promise<MediaStream> {
  return (mic ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }));
}

// --- B2: text model + ElevenLabs ------------------------------------------------------------
let ws: WebSocket | null = null;
let current = 0;
/** Where the next chunk of her voice starts, on the AudioContext clock. */
let playHead = 0;
const sources: AudioBufferSourceNode[] = [];
/** True while her voice is playing (B2), so the mic ignores her through the speakers. */
const speaking = () => context().currentTime < playHead + 0.3;

function playPcm(turn: Turn, bytes: Uint8Array): void {
  const ctx = context();
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
  if (!samples.length) return;
  const buffer = ctx.createBuffer(1, samples.length, 24000);
  const ch = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  const at = Math.max(ctx.currentTime + 0.01, playHead);
  src.start(at);
  sources.push(src);
  src.onended = () => sources.splice(sources.indexOf(src), 1);
  playHead = at + buffer.duration;
  turn.audioSeconds = (turn.audioSeconds ?? 0) + buffer.duration;
  if (turn.firstSound === undefined) {
    turn.firstSound = performance.now() + (at - ctx.currentTime) * 1000;
    render(turn);
  }
}

function hush(): void {
  for (const s of sources.splice(0)) s.stop();
  playHead = 0;
}

function connectB2(): Promise<void> {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/b2`);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws!.send(JSON.stringify({ type: 'start', moment: momentSel.value, model: $<HTMLSelectElement>('model').value, tts: $<HTMLSelectElement>('tts').value }));
    ws.onerror = () => reject(new Error('could not reach the server'));
    ws.onclose = () => ((connected = false), status('Closed'));
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(e.data);
        const t = turns.find((x) => x.id === bytes[0] && x.pipe === 'b2');
        if (t && t.id === current) playPcm(t, bytes.subarray(2));
        return;
      }
      const m = JSON.parse(e.data);
      if (m.type === 'ready') return status(`Ready (${m.model})`), resolve();
      const t = turns.find((x) => x.id === m.turn && x.pipe === 'b2');
      if (m.type === 'error') return status(`Error: ${m.message}`);
      if (!t) return;
      if (m.type === 'text') {
        t.reply += m.delta;
        if (t.id === current) showReply(t.reply.trim());
        render(t);
      } else if (m.type === 'done') {
        t.done = true;
        t.reply = m.text;
        t.server = m.times;
        render(t);
        status('Listening');
      }
    };
  });
}

function sendB2(t: Turn): void {
  hush();
  current = t.id;
  t.sentAt = performance.now();
  ws?.send(JSON.stringify({ type: 'say', text: t.input === 'greeting' ? GREETING : t.words, turn: t.id }));
  status('Thinking');
}

// B2 hearing: record each utterance and send it to ElevenLabs Scribe, or use the browser's own recogniser.
let stopListening: (() => void) | null = null;
async function startHearingB2(): Promise<void> {
  const stream = await getMic();
  if ($<HTMLSelectElement>('stt').value === 'browser' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const R = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new R();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-GB';
    let lastSpeech = 0;
    const stopLevel = listenFor(stream, { start() {}, end: (t) => (lastSpeech = t), ignore: speaking });
    rec.onresult = (e: any) => {
      const words = e.results[e.results.length - 1][0].transcript.trim();
      if (words) say(words, 'voice', lastSpeech || performance.now());
    };
    rec.onend = () => stopListening && rec.start();
    rec.start();
    stopListening = () => ((stopListening = null), rec.stop(), stopLevel());
    return;
  }
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  const begin = () => {
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.start();
  };
  begin();
  const stopLevel = listenFor(stream, {
    start: () => $('mic').classList.add('is-hearing'),
    end: (lastLoud) => {
      $('mic').classList.remove('is-hearing');
      const r = recorder!;
      r.onstop = async () => {
        const blob = new Blob(chunks, { type: r.mimeType });
        begin();
        status('Hearing');
        const t0 = performance.now();
        const res = await fetch('/api/stt', { method: 'POST', body: blob });
        const j = await res.json();
        if (!j.text?.trim()) return status('Heard nothing');
        say(j.text.trim(), 'voice', lastLoud, performance.now() - t0);
      };
      r.stop();
    },
    ignore: speaking,
  });
  stopListening = () => ((stopListening = null), stopLevel(), recorder?.state === 'recording' && recorder.stop());
}

// --- B1: realtime voice over WebRTC ------------------------------------------------------------
let b1: { pc: RTCPeerConnection; dc: RTCDataChannel; ws: WebSocket; track: MediaStreamTrack } | null = null;
let b1Turn: Turn | null = null;

async function connectB1(): Promise<void> {
  const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/b1`);
  let answer: (sdp: string) => void = () => {};
  const answered = new Promise<string>((r) => (answer = r));
  const ready = new Promise<void>((resolve, reject) => {
    sock.onerror = () => reject(new Error('could not reach the server'));
    sock.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'ready') resolve();
      else if (m.type === 'answer') answer(m.sdp);
      else if (m.type === 'status') status(m.message ? `${m.status}: ${m.message}` : m.status);
    };
  });
  const stream = await getMic();
  await ready;
  const pc = new RTCPeerConnection();
  const speaker = new Audio();
  speaker.autoplay = true;
  pc.ontrack = (e) => {
    speaker.srcObject = e.streams[0];
    watchVoice(e.streams[0]);
  };
  const track = stream.getAudioTracks()[0];
  pc.addTrack(track, stream);
  const dc = pc.createDataChannel('oai-events');
  let started: () => void = () => {};
  const sessionStarted = new Promise<void>((r) => (started = r));
  dc.onmessage = (e) => {
    const ev = JSON.parse(e.data);
    if (ev.type === 'session.started') started();
    else if (ev.type === 'input_transcript.added' && b1Turn?.input === 'voice') (b1Turn.words += ev.item?.text ?? ''), render(b1Turn);
    else if (ev.type === 'output_transcript.added' && b1Turn) {
      b1Turn.reply += ev.item?.text ?? '';
      showReply(b1Turn.reply.trim());
      render(b1Turn);
    } else if (ev.type === 'turn.done' && ev.turn?.role === 'assistant' && b1Turn) {
      b1Turn.done = true;
      if (ev.turn.transcript) b1Turn.reply = ev.turn.transcript;
      render(b1Turn);
      status('Listening');
    } else if (ev.type === 'error') status(`Error: ${ev.error?.message ?? 'realtime error'}`);
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sock.send(JSON.stringify({ type: 'offer', sdp: offer.sdp, moment: momentSel.value, voice: voiceSel.value }));
  const sdp = await Promise.race([answered, new Promise<string>((_, rej) => setTimeout(() => rej(new Error('the voice did not answer in 30 s')), 30000))]);
  await pc.setRemoteDescription({ type: 'answer', sdp });
  await new Promise<void>((r, rej) => {
    if (dc.readyState === 'open') return r();
    dc.onopen = () => r();
    setTimeout(() => rej(new Error('the voice channel did not open')), 15000);
  });
  await Promise.race([sessionStarted, new Promise((r) => setTimeout(r, 5000))]);
  b1 = { pc, dc, ws: sock, track };
  // The call hears the mic from now on; the level detector only marks where the player's words end.
  // A voice turn opens when the player starts speaking, so her reply's words land in it even when she
  // answers before the detector has decided they stopped; its mark is set when they stop.
  let open: Turn | null = null;
  listenFor(stream, {
    start: () => {
      $('mic').classList.add('is-hearing');
      if (track.enabled) open = newTurn('voice', '', NaN);
    },
    end: (lastLoud) => {
      $('mic').classList.remove('is-hearing');
      if (!open) return;
      open.mark = lastLoud;
      open = null;
      settleOnsets();
    },
  });
  status('In the call');
}

// --- turns ----------------------------------------------------------------------------------
let nextId = 1;
function newTurn(input: Turn['input'], words: string, mark: number, sttMs?: number): Turn {
  const t: Turn = { id: nextId++ % 256, pipe, input, words, mark, sttMs, reply: '', done: false };
  turns.push(t);
  if (pipe === 'b1') {
    b1Turn = t;
    settleOnsets();
  }
  render(t);
  return t;
}

function say(words: string, input: Turn['input'], mark = performance.now(), sttMs?: number): Turn {
  const t = newTurn(input, words, mark, sttMs);
  if (pipe === 'b2') sendB2(t);
  else {
    t.sentAt = performance.now();
    b1?.ws.send(JSON.stringify({ type: 'say', text: input === 'greeting' ? GREETING : words }));
  }
  return t;
}

async function begin(): Promise<void> {
  $('start').hidden = true;
  status('Connecting');
  await context().resume();
  try {
    if (pipe === 'b2') await connectB2();
    else await connectB1();
  } catch (e) {
    status(`Error: ${(e as Error).message}`);
    throw e;
  }
  connected = true;
  for (const id of ['mic', 'text', 'send']) $<HTMLButtonElement>(id).disabled = false;
  say('', 'greeting');
}

$('go').onclick = () => void begin();
document.querySelectorAll<HTMLElement>('[data-pipe]').forEach((b) =>
  b.addEventListener('click', () => {
    if (connected) return void (location.search = `?pipe=${b.dataset.pipe}&moment=${momentSel.value}`);
    pipe = b.dataset.pipe as Pipe;
    showPipe();
  }),
);
momentSel.onchange = () => (connected ? (location.search = `?pipe=${pipe}&moment=${momentSel.value}`) : showPipe());
$('say').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('text');
  const words = input.value.trim();
  if (!words || !connected) return;
  input.value = '';
  say(words, 'text');
});
$('mic').onclick = async () => {
  const on = $('mic').getAttribute('aria-pressed') !== 'true';
  $('mic').setAttribute('aria-pressed', String(on));
  $('mic-label').textContent = on ? 'Listening' : 'Talk';
  if (pipe === 'b1') {
    if (b1) b1.track.enabled = on;
  } else if (on) await startHearingB2();
  else stopListening?.();
};
// In the call (B1) the mic is open from the start, so the button starts pressed.
if (pipe === 'b1') ($('mic').setAttribute('aria-pressed', 'true'), ($('mic-label').textContent = 'Listening'));

/** For tools/bench.ts. */
(window as any).__talk = {
  turns,
  begin,
  say: (words: string) => say(words, 'text').id,
  hear: () => (pipe === 'b2' && !stopListening ? startHearingB2() : undefined),
  /** Milliseconds since her voice last sounded. */
  quiet: () => (pipe === 'b1' ? performance.now() - heardHer : Math.max(0, (context().currentTime - playHead) * 1000)),
  get connected() {
    return connected;
  },
};
