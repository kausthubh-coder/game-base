// Checks audio without listening: decodes it with ffmpeg and measures length, loudness, how much of
// it is sound, the median pitch of the voiced parts and the first moment of sound.
import { spawnSync } from 'node:child_process';

const RATE = 16000;

export interface AudioFacts {
  seconds: number;
  /** Root mean square level of the whole clip, in dBFS. */
  rmsDb: number;
  /** Share of 20 ms frames louder than -40 dBFS. */
  voiced: number;
  /** Median fundamental of the voiced frames, in Hz. 0 when none were found. */
  pitchHz: number;
  /** Seconds before the first frame louder than -40 dBFS. */
  leadSilence: number;
}

/** Decodes any file ffmpeg reads (or raw bytes of one) to 16 kHz mono float samples. */
export function decode(input: string | Uint8Array): Float32Array {
  const fromFile = typeof input === 'string';
  const run = spawnSync('ffmpeg', ['-v', 'error', '-i', fromFile ? input : 'pipe:0', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', 'pipe:1'], {
    input: fromFile ? undefined : input,
    maxBuffer: 1 << 28,
  });
  if (run.status !== 0) throw new Error(`ffmpeg could not decode: ${run.stderr.toString().slice(0, 300)}`);
  const buf = run.stdout;
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120);

/**
 * Pitch of one frame by the YIN difference function, between 70 and 500 Hz. 0 when the frame is not
 * clearly periodic. (Plain autocorrelation jumped an octave up on low, gravelly voices.)
 */
function framePitch(s: Float32Array, start: number, size: number): number {
  const minLag = Math.floor(RATE / 500), maxLag = Math.floor(RATE / 70);
  const d = new Float64Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < size; i++) {
      const x = s[start + i] - s[start + i + lag];
      sum += x * x;
    }
    d[lag] = sum;
  }
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    running += d[lag];
    const normal = (d[lag] * lag) / (running || 1);
    if (lag >= minLag && normal < 0.15) {
      let best = lag, bestValue = normal, sum = running;
      for (let next = lag + 1; next <= maxLag; next++) {
        sum += d[next];
        const value = (d[next] * next) / (sum || 1);
        if (value >= bestValue) break;
        (best = next), (bestValue = value);
      }
      return RATE / best;
    }
  }
  return 0;
}

export function analyse(samples: Float32Array): AudioFacts {
  const frame = RATE / 50; // 20 ms
  let total = 0, loud = 0, frames = 0, lead = -1;
  const pitches: number[] = [];
  for (let at = 0; at + frame <= samples.length; at += frame, frames++) {
    let sum = 0;
    for (let i = 0; i < frame; i++) sum += samples[at + i] ** 2;
    total += sum;
    if (db(Math.sqrt(sum / frame)) > -40) {
      loud++;
      if (lead < 0) lead = at / RATE;
      if (at + 2 * frame <= samples.length) {
        const p = framePitch(samples, at, 2 * frame);
        if (p) pitches.push(p);
      }
    }
  }
  pitches.sort((a, b) => a - b);
  return {
    seconds: samples.length / RATE,
    rmsDb: db(Math.sqrt(total / Math.max(1, samples.length))),
    voiced: frames ? loud / frames : 0,
    pitchHz: pitches.length ? pitches[Math.floor(pitches.length / 2)] : 0,
    leadSilence: Math.max(0, lead),
  };
}

export const describe = (f: AudioFacts) =>
  `${f.seconds.toFixed(2)} s, ${f.rmsDb.toFixed(1)} dBFS, ${(f.voiced * 100).toFixed(0)}% sound, pitch ${f.pitchHz.toFixed(0)} Hz, lead ${(f.leadSilence * 1000).toFixed(0)} ms`;
