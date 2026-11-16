// The score's instruments: each plays one note on an audio context from its start or from part-way through it,
// so the film can be joined anywhere. A note's shape is a list of points in seconds from its start; joining at
// `from` seconds sets the value it would have there and ramps through the points still ahead.
//
// The plucked harp and the drum are worked out sample by sample once per context (a plucked string by
// Karplus-Strong, a skin by a falling sine) and played as buffers. The voices, the low strings, the flute, the
// glass and the bell are oscillators. Nothing calls Math.random(): every noise comes from a seeded generator, so
// a render is the same every time.

export type Instrument = 'choir' | 'strings' | 'harp' | 'flute' | 'glass' | 'bell' | 'drum' | 'swell';

export interface Note {
  inst: Instrument;
  /** Film seconds. */
  at: number;
  /** Seconds held, before the release. A plucked or struck note ignores it and rings out. */
  len: number;
  midi: number;
  /** 0 to 1. */
  vel: number;
  /** -1 left to 1 right. */
  pan?: number;
  /** Share of the note sent to the hall, 0 to 1. Each instrument has its own default. */
  wet?: number;
  /** What a check can solo: `mark` for the six glass notes, `title` for the chord on the title. */
  name?: string;
}

/** What playNote needs from the context: where a note goes, and the buffers made once per context. */
export interface Rack {
  ctx: BaseAudioContext;
  dry: AudioNode;
  hall: AudioNode;
  noise: AudioBuffer;
  harp: (midi: number) => AudioBuffer;
  drum: AudioBuffer;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Mulberry32: the same numbers from the same seed. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Points = readonly (readonly [t: number, v: number])[];

/** The value a list of points has at t, by straight lines between them. */
function valueAt(points: Points, t: number): number {
  if (t <= (points[0] as readonly [number, number])[0]) return (points[0] as readonly [number, number])[1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i] as readonly [number, number];
    const [t0, v0] = points[i - 1] as readonly [number, number];
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / Math.max(1e-6, t1 - t0);
  }
  return (points[points.length - 1] as readonly [number, number])[1];
}

/** Moves a param through the points, as if the note had started `from` seconds before `when`. */
function shape(param: AudioParam, points: Points, when: number, from: number): void {
  param.setValueAtTime(valueAt(points, from), when);
  for (const [t, v] of points) if (t > from) param.linearRampToValueAtTime(v, when + t - from);
}

/** A swell and a fall: up in `attack`, held, then down over `release`. The fall is bent like a real decay. */
function swell(level: number, attack: number, hold: number, release: number): Points {
  const pts: [number, number][] = [[0, 0], [attack, level], [attack + hold, level]];
  for (let k = 1; k <= 6; k++) pts.push([attack + hold + (release * k) / 6, level * (1 - k / 6) ** 2]);
  return pts;
}

/** A strike: up in `attack`, then an exponential-looking fall to nothing over `ring`. */
function strike(level: number, attack: number, ring: number): Points {
  const pts: [number, number][] = [[0, 0], [attack, level]];
  for (let k = 1; k <= 8; k++) pts.push([attack + (ring * k) / 8, level * 0.001 ** (k / 8)]);
  pts.push([attack + ring + 0.01, 0]);
  return pts;
}

/** How long a note sounds in all, from its start. */
export function noteSeconds(n: Note): number {
  switch (n.inst) {
    case 'choir': return n.len + 2.2;
    case 'strings': return n.len + 2.4;
    case 'flute': return n.len + 0.35;
    case 'harp': return 4;
    case 'glass': return 3.6;
    case 'bell': return 6.5;
    case 'drum': return 1.6;
    case 'swell': return n.len + 0.15;
  }
}

const WET: Record<Instrument, number> = { choir: 0.55, strings: 0.35, harp: 0.35, flute: 0.3, glass: 0.5, bell: 0.7, drum: 0.6, swell: 0.6 };

/** Plays one note. `when` is the context time of film time max(at, the join); `from` is how far into the note that is. Returns what to stop. */
export function playNote(rack: Rack, n: Note, when: number, from: number, seed: number): AudioScheduledSourceNode[] {
  const { ctx } = rack;
  const end = when + noteSeconds(n) - from;
  const sources: AudioScheduledSourceNode[] = [];
  const out = ctx.createGain();
  const pan = ctx.createStereoPanner();
  pan.pan.value = n.pan ?? 0;
  out.connect(pan);
  const wet = ctx.createGain();
  wet.gain.value = n.wet ?? WET[n.inst];
  pan.connect(rack.dry);
  pan.connect(wet).connect(rack.hall);
  const osc = (type: OscillatorType, f: number, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    sources.push(o);
    return o;
  };
  const f = hz(n.midi);
  const rng = seeded(seed);

  switch (n.inst) {
    case 'choir': {
      // Held voices: three detuned saws shaped by two vowel bands ("aah" leaning to "ooh"), a slow vibrato that
      // comes in after the note settles, and a long swell.
      const mix = ctx.createGain();
      mix.gain.value = 0.32;
      for (const d of [-9, 0, 8]) osc('sawtooth', f, d + (rng() - 0.5) * 4).connect(mix);
      const lfo = osc('sine', 4.6 + rng() * 0.8);
      const depth = ctx.createGain();
      shape(depth.gain, [[0, 0], [0.6, 0], [1.6, 7]], when, from);
      lfo.connect(depth);
      for (const s of sources) if (s !== lfo) depth.connect((s as OscillatorNode).detune);
      const body = ctx.createBiquadFilter();
      body.type = 'lowpass';
      body.frequency.value = Math.min(1600, f * 5);
      body.Q.value = 0.4;
      const formant = (fc: number, q: number, g: number) => {
        const b = ctx.createBiquadFilter();
        b.type = 'bandpass';
        b.frequency.value = fc;
        b.Q.value = q;
        const t = ctx.createGain();
        t.gain.value = g;
        mix.connect(b).connect(t).connect(out);
      };
      formant(f < 300 ? 520 : 650, 2.5, 1.8);
      formant(1050, 3.5, 0.9);
      mix.connect(body).connect(out);
      shape(out.gain, swell(n.vel * 0.5, Math.min(1.4, n.len * 0.5 + 0.2), Math.max(0, n.len - 0.7), 2.1), when, from);
      break;
    }
    case 'strings': {
      // Low bowed strings: two saws a few cents apart and a triangle for body, dark, slow to speak.
      const mix = ctx.createGain();
      mix.gain.value = 0.4;
      osc('sawtooth', f, -5).connect(mix);
      osc('sawtooth', f, 6).connect(mix);
      osc('triangle', f).connect(mix);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.6;
      shape(lp.frequency, [[0, 180], [1.5, Math.min(900, f * 5)], [n.len + 2.4, 200]], when, from);
      mix.connect(lp).connect(out);
      shape(out.gain, swell(n.vel * 0.55, Math.min(1.8, n.len * 0.5 + 0.3), Math.max(0, n.len - 0.9), 2.3), when, from);
      break;
    }
    case 'flute': {
      // A wooden flute: a sine with a little of its octave, a puff of breath at the start, vibrato after.
      const tone = osc('sine', f);
      const over = osc('sine', f * 2);
      const overGain = ctx.createGain();
      overGain.gain.value = 0.12;
      over.connect(overGain).connect(out);
      tone.connect(out);
      const lfo = osc('sine', 5.1);
      const depth = ctx.createGain();
      shape(depth.gain, [[0, 0], [0.25, 0], [0.6, 9]], when, from);
      lfo.connect(depth);
      depth.connect(tone.detune);
      depth.connect(over.detune);
      const air = ctx.createBufferSource();
      air.buffer = rack.noise;
      air.loop = true;
      sources.push(air);
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = f * 2;
      band.Q.value = 1.5;
      const breath = ctx.createGain();
      shape(breath.gain, [[0, 0], [0.03, n.vel * 0.18], [0.12, n.vel * 0.03], [n.len + 0.3, 0]], when, from);
      air.connect(band).connect(breath).connect(out);
      shape(out.gain, [[0, 0], [0.07, n.vel * 0.3], [Math.max(0.08, n.len), n.vel * 0.24], [n.len + 0.3, 0]], when, from);
      break;
    }
    case 'glass': {
      // Struck glass: a clear fundamental with a few bright, quickly gone partials over it. The 2 ms attack is
      // the beat a check times.
      for (const [ratio, level, ring] of [[1, 1, 3.4], [2.0, 0.12, 1.6], [2.76, 0.2, 1.1], [5.4, 0.07, 0.45]] as const) {
        const g = ctx.createGain();
        shape(g.gain, strike(n.vel * 0.32 * level, 0.002, ring), when, from);
        osc('sine', f * ratio, (rng() - 0.5) * 3).connect(g).connect(out);
      }
      out.gain.value = 1;
      break;
    }
    case 'bell': {
      // A far bell: one sine bent by another at a ratio that does not divide, so it rings metal, not glass.
      const carrier = osc('sine', f);
      const mod = osc('sine', f * 1.41);
      const index = ctx.createGain();
      shape(index.gain, [[0, f * 2.2], [3, f * 0.1]], when, from);
      mod.connect(index).connect(carrier.frequency);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      carrier.connect(lp).connect(out);
      shape(out.gain, strike(n.vel * 0.3, 0.004, 6.2), when, from);
      break;
    }
    case 'harp':
    case 'drum': {
      const src = ctx.createBufferSource();
      src.buffer = n.inst === 'harp' ? rack.harp(n.midi) : rack.drum;
      if (n.inst === 'drum') src.playbackRate.value = hz(n.midi) / hz(38);
      sources.push(src);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = n.inst === 'harp' ? 1200 + 4500 * n.vel : 900;
      src.connect(lp).connect(out);
      out.gain.value = n.vel * (n.inst === 'harp' ? 0.42 : 0.8);
      // A buffer joins part-way by its offset.
      src.start(when, Math.min(from * src.playbackRate.value, (src.buffer as AudioBuffer).duration - 0.01));
      src.stop(end);
      return sources;
    }
    case 'swell': {
      // Air rising into a hit: noise through a band that climbs, louder all the way, cut at the end.
      const src = ctx.createBufferSource();
      src.buffer = rack.noise;
      src.loop = true;
      sources.push(src);
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 0.9;
      shape(band.frequency, [[0, 300], [n.len, 5000]], when, from);
      src.connect(band).connect(out);
      shape(out.gain, [[0, 0], [n.len * 0.7, n.vel * 0.08], [n.len, n.vel * 0.3], [n.len + 0.12, 0]], when, from);
      break;
    }
  }
  for (const s of sources) {
    s.start(when);
    s.stop(end);
  }
  return sources;
}

/** White noise, two seconds, from a seed. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  const rng = seeded(7);
  for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
  return b;
}

/**
 * A plucked string by Karplus-Strong: a burst of noise in a delay line that averages itself away. The buffer is
 * made at a sample rate of an exact whole number of samples a cycle, so the pitch is exact; the context resamples.
 */
export function harpBuffer(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const f = hz(midi);
  const period = Math.max(4, Math.round(44100 / f));
  const rate = f * period;
  const n = Math.ceil(rate * 3.9);
  const b = ctx.createBuffer(1, n, rate);
  const d = b.getChannelData(0);
  const rng = seeded(midi * 31 + 3);
  // The burst, softened so the string starts round, not with a click of hiss.
  let last = 0;
  for (let i = 0; i < period; i++) {
    last = last * 0.5 + (rng() * 2 - 1) * 0.5;
    d[i] = last;
  }
  // Higher strings lose their energy sooner.
  const keep = 0.9965 - Math.max(0, midi - 60) * 0.00012;
  for (let i = period; i < n; i++) d[i] = keep * 0.5 * ((d[i - period] as number) + (d[i - period - 1] ?? 0));
  let top = 0;
  for (let i = 0; i < n; i++) top = Math.max(top, Math.abs(d[i] as number));
  for (let i = 0; i < n; i++) d[i] = (d[i] as number) / (top || 1);
  return b;
}

/** A soft frame drum heard far off: a falling sine and a breath of low noise, tuned to D2. */
export function drumBuffer(ctx: BaseAudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const n = Math.ceil(rate * 1.5);
  const b = ctx.createBuffer(1, n, rate);
  const d = b.getChannelData(0);
  const rng = seeded(11);
  let phase = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const f = hz(38) * (1 + 0.6 * Math.exp(-t / 0.05));
    phase += (2 * Math.PI * f) / rate;
    lp += 0.04 * (rng() * 2 - 1 - lp);
    d[i] = (Math.sin(phase) * Math.exp(-t / 0.42) + lp * 2.5 * Math.exp(-t / 0.06)) * Math.min(1, t / 0.003);
  }
  return b;
}

/** The hall: a stereo tail of seeded noise that dies away over about three seconds and darkens as it goes. */
export function hallBuffer(ctx: BaseAudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const n = Math.ceil(rate * 3.4);
  const b = ctx.createBuffer(2, n, rate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    const rng = seeded(101 + c);
    let lp = 0;
    const pre = Math.round(rate * 0.022);
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / rate;
      // The filter closes over the tail, as air takes the top end first.
      const k = 0.55 * Math.exp(-t / 1.1) + 0.05;
      lp += k * (rng() * 2 - 1 - lp);
      d[i] = lp * Math.exp((-6.9 * t) / 2.9) * Math.min(1, t / 0.01);
    }
  }
  return b;
}
