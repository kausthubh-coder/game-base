// Measuring tools for the sound checks: WAV decoding, loudness, spectra and spectrogram pictures.
// Used by tools/audio-check.mjs and tools/audio-stems.mjs. Nothing here plays or makes sound.
import sharp from 'sharp';

/** Decodes the 16-bit WAV the lab page returns. Returns one Float32Array per channel. */
export function decodeWav(base64) {
  const bytes = Buffer.from(base64, 'base64');
  const channels = bytes.readUInt16LE(22);
  const rate = bytes.readUInt32LE(24);
  const frames = (bytes.length - 44) / (channels * 2);
  const out = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < channels; ch++) out[ch][i] = bytes.readInt16LE(44 + (i * channels + ch) * 2) / 32768;
  }
  return { rate, channels: out, bytes };
}

export function mono(channels) {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (let i = 0; i < out.length; i++) out[i] = (channels[0][i] + channels[1][i]) / 2;
  return out;
}

export const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);

export function peakOf(channels) {
  let peak = 0;
  for (const data of channels) for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  return peak;
}

/** Root mean square of a stretch of samples, across every channel, in dBFS. */
export function rmsDb(channels, from = 0, to = channels[0].length) {
  let sum = 0;
  let n = 0;
  for (const data of channels) {
    for (let i = Math.max(0, from); i < Math.min(to, data.length); i++) {
      sum += data[i] * data[i];
      n++;
    }
  }
  return db(Math.sqrt(sum / Math.max(1, n)));
}

/** The loudness of each window of `seconds`, in dBFS, from `skip` seconds in. */
export function windowsDb(channels, rate, seconds, skip = 0) {
  const size = Math.floor(seconds * rate);
  const out = [];
  for (let at = Math.floor(skip * rate); at + size <= channels[0].length; at += size) out.push({ t: at / rate, db: rmsDb(channels, at, at + size) });
  return out;
}

/** An in-place radix-2 FFT. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** The power in each frequency bin of a stretch of signal, through a Hann window. */
export function powerSpectrum(data, from, length, size) {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const n = Math.min(length, size, data.length - from);
  for (let i = 0; i < n; i++) re[i] = data[from + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  const out = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) out[i] = re[i] * re[i] + im[i] * im[i];
  return out;
}

/** The balance point of a sound's spectrum, in Hz: low for a thud, high for a hiss. */
export function centroid(data, rate, fromSeconds, seconds) {
  const size = 16384;
  const power = powerSpectrum(data, Math.floor(fromSeconds * rate), Math.floor(seconds * rate), size);
  let sum = 0;
  let weighted = 0;
  for (let i = 1; i < power.length; i++) {
    sum += power[i];
    weighted += power[i] * ((i * rate) / size);
  }
  return sum > 0 ? weighted / sum : 0;
}

/** The loudest frequency in a stretch, in Hz, between two limits. */
export function loudestHz(data, rate, fromSeconds, seconds, low = 150, high = 6000) {
  const size = 16384;
  const power = powerSpectrum(data, Math.floor(fromSeconds * rate), Math.floor(seconds * rate), size);
  let best = 0;
  let bestAt = 0;
  for (let i = Math.ceil((low * size) / rate); i < Math.min(power.length, (high * size) / rate); i++) {
    if (power[i] > best) {
      best = power[i];
      bestAt = i;
    }
  }
  return (bestAt * rate) / size;
}

/** How alike two stretches are, 0 to 1, at the best alignment within `slack` samples. 1 means the same sound. */
export function likeness(data, rate, aSeconds, bSeconds, seconds, slack = 300) {
  const a = Math.floor(aSeconds * rate);
  const b = Math.floor(bSeconds * rate);
  const n = Math.floor(seconds * rate);
  let best = 0;
  for (let lag = -slack; lag <= slack; lag++) {
    let ab = 0;
    let aa = 0;
    let bb = 0;
    for (let i = 0; i < n; i++) {
      const x = data[a + i] ?? 0;
      const y = data[b + lag + i] ?? 0;
      ab += x * y;
      aa += x * x;
      bb += y * y;
    }
    if (aa > 0 && bb > 0) best = Math.max(best, ab / Math.sqrt(aa * bb));
  }
  return best;
}

/** The times, in seconds, at which short loud sounds start. `floorDb` is how loud counts. */
export function onsets(data, rate, fromSeconds, toSeconds, floorDb = -50, gap = 0.12) {
  const hop = Math.floor(rate * 0.002);
  const out = [];
  let last = -1;
  let before = 0;
  for (let at = Math.floor(fromSeconds * rate); at + hop < Math.min(data.length, toSeconds * rate); at += hop) {
    let sum = 0;
    for (let i = 0; i < hop; i++) sum += data[at + i] * data[at + i];
    const level = Math.sqrt(sum / hop);
    if (db(level) > floorDb && level > before * 3 && at / rate - last > gap) {
      out.push(at / rate);
      last = at / rate;
    }
    before = before * 0.6 + level * 0.4;
  }
  return out;
}

const STOPS = [
  [0, [6, 6, 16]], [0.2, [44, 18, 92]], [0.4, [128, 36, 120]], [0.6, [206, 70, 84]], [0.8, [248, 148, 40]], [1, [252, 250, 190]],
];
function color(v) {
  const x = Math.max(0, Math.min(1, v));
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [x0, a] = STOPS[i - 1];
      const [x1, b] = STOPS[i];
      const t = (x - x0) / (x1 - x0);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Draws a spectrogram: time left to right, pitch bottom to top on a log scale, brightness for loudness.
 * `marks` are drawn as labelled vertical lines, so the picture can be checked against what the test did.
 */
export async function spectrogram(data, rate, file, { title = '', marks = [] } = {}) {
  const width = 1500;
  const height = 520;
  const left = 54;
  const top = 46;
  const bottom = 26;
  const plotW = width - left - 10;
  const plotH = height - top - bottom;
  const size = rate >= 32000 ? 4096 : 1024;
  const seconds = data.length / rate;
  const low = 40;
  const high = Math.min(16000, rate / 2);
  const pixels = Buffer.alloc(width * height * 3, 16);
  const hop = data.length / plotW;
  for (let x = 0; x < plotW; x++) {
    const from = Math.max(0, Math.floor(x * hop - size / 2));
    const power = powerSpectrum(data, from, size, size);
    for (let y = 0; y < plotH; y++) {
      const hz = low * (high / low) ** (1 - y / plotH);
      const hzNext = low * (high / low) ** (1 - (y - 1) / plotH);
      const a = Math.max(1, Math.floor((hz * size) / rate));
      const b = Math.max(a + 1, Math.ceil((hzNext * size) / rate));
      let best = 0;
      for (let i = a; i < b && i < power.length; i++) best = Math.max(best, power[i]);
      // Scale so a full-scale sine is 0 dB, then show the 80 dB below that.
      const level = 10 * Math.log10(best / (size * size / 16) + 1e-14);
      const [r, g, bl] = color((level + 84) / 78);
      const at = ((top + y) * width + left + x) * 3;
      pixels[at] = r;
      pixels[at + 1] = g;
      pixels[at + 2] = bl;
    }
  }
  const yOf = (hz) => top + plotH * (1 - Math.log(hz / low) / Math.log(high / low));
  const xOf = (t) => left + (t / seconds) * plotW;
  const every = seconds > 200 ? 30 : seconds > 60 ? 10 : seconds > 20 ? 5 : 1;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Helvetica, Arial, sans-serif" font-size="11">`;
  svg += `<text x="${left}" y="13" fill="#fff" font-size="13" font-weight="bold">${escapeXml(title)}</text>`;
  for (const hz of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
    if (hz > high) continue;
    svg += `<line x1="${left - 4}" x2="${left + plotW}" y1="${yOf(hz)}" y2="${yOf(hz)}" stroke="#fff" stroke-opacity="0.12"/>`;
    svg += `<text x="${left - 7}" y="${yOf(hz) + 4}" fill="#bbb" text-anchor="end">${hz >= 1000 ? hz / 1000 + 'k' : hz}</text>`;
  }
  for (let t = 0; t <= seconds; t += every) {
    svg += `<line x1="${xOf(t)}" x2="${xOf(t)}" y1="${top + plotH}" y2="${top + plotH + 4}" stroke="#bbb"/>`;
    svg += `<text x="${xOf(t)}" y="${height - 8}" fill="#bbb" text-anchor="middle">${t}s</text>`;
  }
  marks.forEach((m, i) => {
    const x = xOf(m.t);
    svg += `<line x1="${x}" x2="${x}" y1="${top - 4}" y2="${top + plotH}" stroke="#7fffd4" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    // Labels alternate between two rows so neighbors do not overlap.
    const flip = x > width - 110;
    svg += `<text x="${flip ? x - 3 : x + 3}" y="${i % 2 === 0 ? 28 : 40}" fill="#7fffd4"${flip ? ' text-anchor="end"' : ''}>${escapeXml(m.label)}</text>`;
  });
  svg += '</svg>';
  await sharp(pixels, { raw: { width, height, channels: 3 } }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(file);
}
