// The opening's soundtrack: Hobb's voice in the take `?voice=` names, the score made by code (score.ts), and
// the recorded effects (recorded.ts), all scheduled from film time so the film can start anywhere.
//
// Loading decodes the take's eleven clips and the effects; it makes no AudioContext, since a browser holds one
// back until a press. play(film, t) makes the context the first time, then a session: its own buses, its own
// hall, and the film's events from t on. A long sound already playing at t joins part-way, a line rejoins
// mid-line, a short one-shot already past is skipped. Events are made a second and a half ahead on a timer, or
// all at once on an OfflineAudioContext, which is how the checks render it. stop() fades the session out in
// 80 ms and stops every source it started by 100 ms.
import type { Film, LoadSoundtrack, ShotId, Soundtrack, VoiceTake } from '../types.ts';
import { planOf, type Cue, type Curve, type Group } from './cues.ts';
import type { FxList, VoiceList } from './make.ts';
import { scoreOf } from './score.ts';
import { drumBuffer, hallBuffer, harpBuffer, noiseBuffer, noteSeconds, playNote, type Note, type Rack } from './synth.ts';
import { TAKES } from './takes.ts';

export const VOICES: readonly VoiceTake[] = TAKES.map((t) => ({ id: t.id, name: t.name }));

const voiceList = Object.values(import.meta.glob('./voice/voice.json', { eager: true, import: 'default' }))[0] as VoiceList;
const fxList = Object.values(import.meta.glob('./fx/fx.json', { eager: true, import: 'default' }))[0] as FxList;
const urls = import.meta.glob(['./voice/*/*.mp3', './fx/*.mp3'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** The levels of the mix, set by measuring the renders (sound/check.ts). */
const LEVEL = { voice: 1, score: 0.55, fx: 0.7, master: 0.78 } as const;
/** Seconds ahead the timer makes events, and how often it runs. */
const AHEAD = 1.5;
const EVERY = 200;
/** Seconds between play() and the first sound on a live context, so the first events are never late. */
const LEAD = 0.06;

export interface SoundtrackOptions {
  voice: string;
  /** Render on this context instead of a live one: everything is scheduled at once. */
  context?: BaseAudioContext;
  /** Keeps only what passes, for a check that renders one part alone. Ducking stays as in the full mix. */
  only?: (group: Group, name?: string) => boolean;
  /** Scales the whole mix: the game's own volume, when the film plays in the game. 1 when left out. */
  volume?: number;
}

export interface SoundtrackDebug {
  /** Sources started and not yet ended, in every session. */
  live(): number;
  /** The level going out now, RMS in dBFS (a live context only). */
  level(): number;
  context(): BaseAudioContext | null;
}

interface Event {
  at: number;
  end: number;
  rejoin: boolean;
  group: Group;
  name?: string;
  start(when: number, from: number): AudioScheduledSourceNode[];
}

interface Session {
  out: GainNode;
  sources: Set<AudioScheduledSourceNode>;
  timer: ReturnType<typeof setInterval> | null;
}

export async function createSoundtrack(options: SoundtrackOptions): Promise<Soundtrack & { debug: SoundtrackDebug }> {
  const take = voiceList.takes[options.voice] ? options.voice : (TAKES[0] as { id: string }).id;
  const clips = voiceList.takes[take] ?? {};
  const decoder = options.context ?? new OfflineAudioContext(1, 1, 44100);
  const decode = async (file: string): Promise<AudioBuffer | null> => {
    const url = urls[`./${file}`];
    if (!url) return null;
    return decoder.decodeAudioData(await (await fetch(url)).arrayBuffer());
  };
  const buffers = new Map<string, AudioBuffer>();
  await Promise.all([
    ...Object.entries(clips).map(async ([shot, clip]) => { const b = await decode(clip.file); if (b) buffers.set(`voice/${shot}`, b); }),
    ...Object.entries(fxList.sounds).map(async ([id, e]) => { const b = await decode(e.file); if (b) buffers.set(id, b); }),
  ]);
  const voiceSeconds: Partial<Record<ShotId, number>> = {};
  const fileSeconds: Partial<Record<ShotId, number>> = {};
  for (const [shot, clip] of Object.entries(clips) as [ShotId, { seconds: number; fileSeconds: number }][]) {
    if (!buffers.has(`voice/${shot}`)) continue;
    voiceSeconds[shot] = clip.seconds;
    fileSeconds[shot] = clip.fileSeconds;
  }
  const hits = Object.fromEntries(Object.entries(fxList.sounds).map(([id, e]) => [id, e.hit]));

  let ctx: BaseAudioContext | null = options.context ?? null;
  let meter: AnalyserNode | null = null;
  let rack: Omit<Rack, 'dry' | 'hall'> & { hallBuffer: AudioBuffer } | null = null;
  const sessions = new Set<Session>();
  /** Every source started and not yet ended, stopped sessions' too, so a check can see that stop() leaves nothing. */
  const alive = new Set<AudioScheduledSourceNode>();
  const meterData = new Float32Array(2048);
  let disposed = false;

  function ready(): BaseAudioContext {
    if (!ctx) ctx = new AudioContext({ latencyHint: 'playback' });
    if (ctx instanceof AudioContext && ctx.state !== 'running') void ctx.resume();
    if (!rack) {
      const c = ctx;
      const harps = new Map<number, AudioBuffer>();
      rack = {
        ctx: c, noise: noiseBuffer(c), drum: drumBuffer(c), hallBuffer: hallBuffer(c),
        harp: (midi) => { let b = harps.get(midi); if (!b) harps.set(midi, (b = harpBuffer(c, midi))); return b; },
      };
      meter = c.createAnalyser();
      meter.fftSize = 2048;
      meter.connect(c.destination);
    }
    return ctx;
  }

  /** Moves a gain through a curve given in film time, from film time t0 at context time c0. */
  function follow(param: AudioParam, curve: Curve, base: number, t0: number, c0: number): void {
    let v = curve[0]?.[1] ?? 1;
    for (let i = 1; i < curve.length; i++) {
      const [ta, va] = curve[i - 1] as readonly [number, number];
      const [tb, vb] = curve[i] as readonly [number, number];
      if (t0 >= tb) v = vb;
      else if (t0 > ta) v = va + ((vb - va) * (t0 - ta)) / (tb - ta);
    }
    param.setValueAtTime(v * base, c0);
    for (const [t, value] of curve) if (t > t0) param.linearRampToValueAtTime(value * base, c0 + t - t0);
  }

  function play(film: Film, t: number): void {
    if (disposed) return;
    for (const s of sessions) end(s);
    const c = ready();
    const r = rack as NonNullable<typeof rack>;
    // A live context starts the session LEAD seconds from now, at the film time the picture will have reached by
    // then, so sound and picture stay together. An offline render starts at once.
    const lead = options.context ? 0 : LEAD;
    const t0 = Math.max(0, Math.min(t + lead, film.length));
    const c0 = c.currentTime + lead;
    const session: Session = { out: c.createGain(), sources: new Set(), timer: null };
    sessions.add(session);
    // In over 30 ms, so joining part-way through a sound never clicks.
    session.out.gain.setValueAtTime(0, c0);
    session.out.gain.linearRampToValueAtTime(LEVEL.master * (options.volume ?? 1), c0 + 0.03);
    session.out.connect(meter ?? c.destination);

    const bus = (level: number) => { const g = c.createGain(); g.gain.value = level; g.connect(session.out); return g; };
    // The score loses what is under 40 Hz: small speakers only muddy it, and it eats the headroom.
    const lowCut = (into: AudioNode) => { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 40; f.connect(into); return f; };
    const hall = (into: AudioNode, level: number) => { const v = c.createConvolver(); v.buffer = r.hallBuffer; const g = c.createGain(); g.gain.value = level; v.connect(g).connect(into); return v; };
    // The six notes of the Mark go round the ducking: they are the moment, under the line or not.
    const voice = bus(LEVEL.voice), score = bus(LEVEL.score), fx = bus(LEVEL.fx), bright = bus(LEVEL.score);
    const scoreIn = lowCut(score);
    const voiceHall = hall(voice, 1), scoreHall = hall(scoreIn, 0.9), fxHall = hall(fx, 0.7);
    const plan = planOf(film, voiceSeconds, fileSeconds, hits);
    follow(score.gain, plan.duck.score, LEVEL.score, t0, c0);
    follow(fx.gain, plan.duck.fx, LEVEL.fx, t0, c0);

    const events: Event[] = [];
    const notes: Note[] = scoreOf(film, voiceSeconds);
    notes.forEach((n, i) => events.push({
      at: n.at, end: n.at + noteSeconds(n), rejoin: true, group: 'score', name: n.name,
      start: (when, from) => playNote({ ...r, dry: n.name === 'mark' ? bright : scoreIn, hall: scoreHall }, n, when, from, i * 7919 + 1),
    }));
    for (const cue of plan.cues) {
      const buffer = buffers.get(cue.sound);
      if (!buffer) continue;
      const until = cue.loop ? cue.end : Math.min(cue.end, cue.at + buffer.duration);
      events.push({ at: cue.at, end: until, rejoin: cue.rejoin, group: cue.group, name: cue.name, start: (when, from) => playCue(c, cue, buffer, until, cue.group === 'voice' ? voice : fx, cue.group === 'voice' ? voiceHall : fxHall, when, from) });
    }
    const kept = events.filter((e) => e.end > t0 && (e.at >= t0 - lead - 0.02 || e.rejoin) && (!options.only || options.only(e.group, e.name))).sort((a, b) => a.at - b.at);

    let next = 0;
    const pump = (horizon: number) => {
      for (; next < kept.length && (kept[next] as Event).at < horizon; next++) {
        const e = kept[next] as Event;
        const from = Math.max(0, t0 - e.at);
        for (const src of e.start(c0 + Math.max(0, e.at - t0), from)) {
          session.sources.add(src);
          alive.add(src);
          src.addEventListener('ended', () => (session.sources.delete(src), alive.delete(src)));
        }
      }
      if (next >= kept.length && session.timer) (clearInterval(session.timer), (session.timer = null));
    };
    if (options.context) pump(Infinity);
    else {
      pump(t0 + AHEAD);
      session.timer = setInterval(() => pump(t0 + (c.currentTime - c0) + AHEAD), EVERY);
    }
  }

  function end(s: Session): void {
    const c = ctx as BaseAudioContext;
    if (s.timer) clearInterval(s.timer);
    s.timer = null;
    const now = c.currentTime;
    s.out.gain.cancelScheduledValues(now);
    s.out.gain.setValueAtTime(s.out.gain.value, now);
    s.out.gain.linearRampToValueAtTime(0, now + 0.08);
    for (const src of s.sources) {
      try { src.stop(now + 0.1); } catch { /* it had ended */ }
    }
    sessions.delete(s);
    setTimeout(() => s.out.disconnect(), 200);
  }

  return {
    voiceSeconds,
    play,
    stop: () => { for (const s of sessions) end(s); },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const s of sessions) end(s);
      for (const source of alive) {
        try { source.stop(); } catch { /* already ended */ }
        source.disconnect();
      }
      alive.clear();
      meter?.disconnect();
      meter = null;
      rack = null;
      buffers.clear();
      // The offline renderer owns the context it supplies. Only close the film's live context.
      if (!options.context && ctx instanceof AudioContext) void ctx.close().catch(() => undefined);
    },
    debug: {
      live: () => alive.size,
      level: () => {
        if (!meter) return -Infinity;
        meter.getFloatTimeDomainData(meterData);
        let e = 0;
        for (const v of meterData) e += v * v;
        return 10 * Math.log10(e / meterData.length + 1e-20);
      },
      context: () => ctx,
    },
  };
}

/** One recorded sound: a buffer joined at its offset (wrapped for a loop), faded in and out, into its bus and hall. */
function playCue(c: BaseAudioContext, cue: Cue, buffer: AudioBuffer, until: number, dry: AudioNode, hall: AudioNode, when: number, from: number): AudioScheduledSourceNode[] {
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = !!cue.loop;
  const g = c.createGain();
  const left = until - cue.at - from;
  const fadeIn = cue.fadeIn ?? 0.005, fadeOut = cue.fadeOut ?? 0.02;
  // The gain this far into the sound, then the rest of its shape.
  const shapeAt = (x: number) => cue.gain * Math.min(1, x / fadeIn, Math.max(0, (until - cue.at - x) / fadeOut));
  g.gain.setValueAtTime(shapeAt(from), when);
  if (from < fadeIn) g.gain.linearRampToValueAtTime(cue.gain, when + fadeIn - from);
  const fall = Math.max(from, until - cue.at - fadeOut);
  g.gain.setValueAtTime(shapeAt(fall), when + fall - from);
  g.gain.linearRampToValueAtTime(0, when + left);
  src.connect(g).connect(dry);
  if (cue.wet) {
    const w = c.createGain();
    w.gain.value = cue.wet;
    g.connect(w).connect(hall);
  }
  src.start(when, cue.loop ? from % buffer.duration : Math.min(from, buffer.duration - 0.005));
  src.stop(when + left + 0.01);
  return [src];
}

export const loadSoundtrack: LoadSoundtrack = (options) => createSoundtrack({ voice: options.voice });
