// Measures a sound walk (tools/sound-walk.mjs): loudness per section, the level on each side of every
// transition, gaps of silence, and clicks. Writes measures.json and measures.md beside the walk.
//   bun tools/sound-measure.mjs <walk folder>
//
// Loudness is EBU R128 by ffmpeg (integrated per section, and short-term over 3 s windows). A gap is any
// 250 ms with no sample above -60 dBFS. A click is a burst of top end under 2 ms long that stands 24 dB over
// the 50 ms around it and over the 3 ms on each side: a seam or a gain step does that; a footstep's attack
// lasts longer and does not.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const dir = resolve(process.argv[2] ?? '.artifacts/sound/walk');
const { timeline, walkEnd, pieces } = JSON.parse(readFileSync(resolve(dir, 'timeline.json'), 'utf8'));

function readWav(file) {
  const b = readFileSync(file);
  const rate = b.readUInt32LE(24), channels = b.readUInt16LE(22);
  const n = (b.length - 44) / 2 / channels;
  const mono = new Float32Array(n), left = new Float32Array(n), right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = b.readInt16LE(44 + i * 2 * channels) / 32768, r = channels > 1 ? b.readInt16LE(46 + i * 2 * channels) / 32768 : l;
    left[i] = l; right[i] = r; mono[i] = (l + r) / 2;
  }
  return { rate, mono, left, right, n };
}

function ebur128(file, from, to) {
  const args = [FFMPEG, '-hide_banner', '-nostats', '-ss', String(from), '-t', String(Math.max(0.5, to - from)), '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'];
  const p = Bun.spawnSync(args, { stdout: 'pipe', stderr: 'pipe' });
  const err = p.stderr.toString();
  const summary = err.slice(err.lastIndexOf('Summary:'));
  const num = (re) => { const m = re.exec(summary); return m ? Number(m[1]) : null; };
  // Short-term loudness every 100 ms, from the per-frame lines.
  const short = [...err.matchAll(/t:\s*([\d.]+)\s+TARGET.*?S:\s*(-?[\d.]+|-inf)/g)].map((m) => [Number(m[1]) + from, m[2] === '-inf' ? -70 : Number(m[2])]);
  return { lufs: num(/I:\s*(-?[\d.]+) LUFS/), range: num(/LRA:\s*([\d.]+) LU/), truePeak: num(/Peak:\s*(-?[\d.]+) dBFS/), short };
}

function gaps(mono, rate, from, to) {
  const out = [];
  const w = Math.round(rate * 0.25), floor = 10 ** (-60 / 20);
  for (let s = Math.floor(from * rate); s + w < Math.min(mono.length, to * rate); s += Math.round(w / 2)) {
    let peak = 0;
    for (let i = s; i < s + w; i++) peak = Math.max(peak, Math.abs(mono[i]));
    if (peak < floor) out.push(+(s / rate).toFixed(2));
  }
  return out;
}

function clicks(mono, rate, from, to) {
  // Top end by a second difference, energy per 0.5 ms frame.
  const hop = Math.round(rate * 0.0005);
  const a = Math.floor(from * rate), b = Math.min(mono.length - 2, Math.floor(to * rate));
  const frames = [];
  for (let s = a; s + hop < b; s += hop) {
    let e = 0;
    for (let i = s; i < s + hop; i++) { const d = mono[i + 2] - 2 * mono[i + 1] + mono[i]; e += d * d; }
    frames.push(e / hop);
  }
  const db = (x) => 10 * Math.log10(x + 1e-14);
  const out = [];
  for (let f = 100; f < frames.length - 100; f++) {
    const here = db(frames[f]);
    if (here < -70) continue;
    const around = frames.slice(f - 100, f + 100).sort((x, y) => x - y)[100];
    const near = Math.max(frames[f - 6], frames[f - 7], frames[f + 6], frames[f + 7]);
    if (here > db(around) + 24 && here > db(near) + 24) {
      out.push(+((a + f * hop) / rate).toFixed(3));
      f += 40;
    }
  }
  return out;
}

const walk = readWav(resolve(dir, 'walk.wav'));
const file = resolve(dir, 'walk.wav');
// Sections are runs of one label.
const sections = [];
for (const s of timeline) {
  const last = sections[sections.length - 1];
  if (last && last.label === s.label) last.end = s.t;
  else sections.push({ label: s.label, start: last ? last.end : 0, end: s.t, lead: s.lead });
}
const whole = ebur128(file, 0, walkEnd);
const result = { walk: { seconds: +walkEnd.toFixed(1), lufs: whole.lufs, range: whole.range, truePeak: whole.truePeak }, sections: [], transitions: [], gaps: gaps(walk.mono, walk.rate, 0, walkEnd), clicks: [], pieces: [] };
for (const s of sections) {
  const m = ebur128(file, s.start, s.end);
  result.sections.push({ label: s.label, start: +s.start.toFixed(1), end: +s.end.toFixed(1), lufs: m.lufs, range: m.range, truePeak: m.truePeak });
}
// Each transition: short-term loudness over the 3 s before and after, and the biggest step between two
// readings 100 ms apart within 4 s of it.
const short = whole.short;
for (let i = 1; i < sections.length; i++) {
  const t = sections[i].start;
  const avg = (a, b) => { const v = short.filter(([x]) => x >= a && x < b).map(([, y]) => y); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
  let step = 0;
  for (let k = 1; k < short.length; k++) if (Math.abs(short[k][0] - t) < 4) step = Math.max(step, Math.abs(short[k][1] - short[k - 1][1]));
  const before = avg(t - 3, t), after = avg(t, t + 3);
  result.transitions.push({ at: +t.toFixed(1), from: sections[i - 1].label, to: sections[i].label, before: before && +before.toFixed(1), after: after && +after.toFixed(1), jump: before !== null && after !== null ? +(after - before).toFixed(1) : null, biggestStep: +step.toFixed(1) });
}
result.clicks = clicks(walk.mono, walk.rate, 0, walkEnd).map((t) => ({ t, label: (timeline.find((s) => s.t >= t) ?? {}).label }));
for (const p of pieces) {
  const f = resolve(dir, `${p.name}.wav`);
  const w = readWav(f);
  const m = ebur128(f, 0, w.n / w.rate);
  result.pieces.push({ name: p.name, seconds: +(w.n / w.rate).toFixed(1), lufs: m.lufs, truePeak: m.truePeak, clicks: clicks(w.mono, w.rate, 0, w.n / w.rate).length, gaps: p.name.startsWith('bed') ? gaps(w.mono, w.rate, 0, w.n / w.rate).length : null });
}
writeFileSync(resolve(dir, 'measures.json'), JSON.stringify(result, null, 1));

const rows = (head, list) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...list.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const md = [
  `Walk: ${result.walk.seconds} s, ${result.walk.lufs} LUFS integrated, loudness range ${result.walk.range} LU, true peak ${result.walk.truePeak} dBFS.`,
  `Gaps (250 ms under -60 dBFS): ${result.gaps.length}. Clicks: ${result.clicks.length}${result.clicks.length ? ` (${result.clicks.slice(0, 12).map((c) => `${c.t} s ${c.label}`).join(', ')})` : ''}.`,
  '', '### Sections', rows(['section', 'from s', 'to s', 'LUFS', 'range LU', 'true peak dBFS'], result.sections.map((s) => [s.label, s.start, s.end, s.lufs, s.range, s.truePeak])),
  '', '### Transitions', rows(['at s', 'from', 'to', 'LUFS 3 s before', 'LUFS 3 s after', 'jump LU', 'biggest 100 ms step LU'], result.transitions.map((t) => [t.at, t.from, t.to, t.before, t.after, t.jump, t.biggestStep])),
  '', '### Pieces alone', rows(['piece', 's', 'LUFS', 'true peak dBFS', 'clicks', 'gaps'], result.pieces.map((p) => [p.name, p.seconds, p.lufs, p.truePeak, p.clicks, p.gaps ?? '-'])),
].join('\n');
writeFileSync(resolve(dir, 'measures.md'), md + '\n');
console.log(md);
