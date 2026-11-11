// Films the frames Chrome draws while an input plays, finds the frames that jump, and lays them out on one sheet.
// `jumps` and `sheetLayout` are pure; `capture`, `difference` and `sheet` use Chrome and sharp.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

/** The size each frame is shrunk to before two frames are compared, and the grid of cells it is cut into. */
const SMALL = { w: 192, h: 108, cols: 16, rows: 9 };

const median = (values) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Frames that differ from the frame before by far more than the film's median difference.
 * `diffs[i]` is frame i against frame i - 1 (diffs[0] is ignored). A jump is over `factor` times the median
 * and over `floor` as well, so the grain of a still screen is not one. `back` says the next frame jumps too,
 * which is how a one-frame flicker looks.
 */
export function jumps(diffs, { factor = 5, floor = 6 } = {}) {
  const rest = diffs.slice(1);
  const middle = median(rest);
  const limit = Math.max(floor, factor * middle);
  const found = [];
  for (let i = 1; i < diffs.length; i++) if (diffs[i] > limit) found.push({ frame: i, diff: Math.round(diffs[i] * 10) / 10 });
  for (const jump of found) jump.back = found.some((other) => other.frame === jump.frame + 1);
  return { median: Math.round(middle * 10) / 10, limit: Math.round(limit * 10) / 10, jumps: found };
}

/** Where each of `count` frames goes on a sheet at most `maxWidth` wide, with a strip under each for its time. */
export function sheetLayout({ count, frameW, frameH, maxWidth = 1600, labelH = 18, maxCols = 5 }) {
  const cols = Math.max(1, Math.min(count, maxCols));
  const cellW = Math.max(1, Math.floor(Math.min(frameW, maxWidth / cols)));
  const imageH = Math.max(1, Math.round((cellW * frameH) / frameW));
  const cellH = imageH + labelH;
  const rows = Math.ceil(count / cols);
  const cells = Array.from({ length: count }, (_, i) => ({ x: (i % cols) * cellW, y: Math.floor(i / cols) * cellH, w: cellW, h: imageH }));
  return { cols, rows, cellW, cellH, imageH, labelH, width: cols * cellW, height: rows * cellH, cells };
}

/** Picks at most `max` frames spread evenly through the film, always with the first, the last and every jump. */
export function pick(count, { max = 40, every = 1, keep = [] } = {}) {
  const chosen = new Set(keep.filter((i) => i >= 0 && i < count));
  if (count > 0) { chosen.add(0); chosen.add(count - 1); }
  for (let i = 0; i < count; i += Math.max(1, every)) chosen.add(i);
  let list = [...chosen].sort((a, b) => a - b);
  if (list.length > max) {
    const must = new Set([0, count - 1, ...keep]);
    const others = list.filter((i) => !must.has(i));
    const room = Math.max(0, max - must.size);
    const spread = Array.from({ length: room }, (_, k) => others[Math.floor((k * others.length) / room)]);
    list = [...new Set([...must, ...spread])].filter((i) => i >= 0 && i < count).sort((a, b) => a - b);
  }
  return list;
}

/** Shrinks a frame for comparing: SMALL.w x SMALL.h, red, green and blue. Colour stays, since a wrong sprite can be as bright as the right one. */
async function small(buffer) {
  return sharp(buffer).resize(SMALL.w, SMALL.h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
}

/**
 * How much frame b differs from frame a: the mean difference (0 to 255) of the cell that changed most, a pixel's
 * difference being its largest in red, green or blue. A cell is a sixteenth of the width, so a small sprite that
 * turns into another one shows over a still meadow.
 */
export function cellDifference(a, b, { w = SMALL.w, h = SMALL.h, cols = SMALL.cols, rows = SMALL.rows, channels = 3 } = {}) {
  const cw = w / cols, ch = h / rows;
  const sums = new Float64Array(cols * rows);
  for (let y = 0; y < h; y++) {
    const row = Math.min(rows - 1, Math.floor(y / ch)) * cols;
    for (let x = 0; x < w; x++) {
      const at = (y * w + x) * channels;
      let most = 0;
      for (let k = 0; k < channels; k++) most = Math.max(most, Math.abs(a[at + k] - b[at + k]));
      sums[row + Math.min(cols - 1, Math.floor(x / cw))] += most;
    }
  }
  let most = 0;
  for (const sum of sums) most = Math.max(most, sum);
  return most / (cw * ch);
}

/** The mean red, green and blue of each cell of a shrunk frame, on a `cols` x `rows` grid. */
export function cellMeans(frame, { w = SMALL.w, h = SMALL.h, cols = 32, rows = 18, channels = 3 } = {}) {
  const means = new Float64Array(cols * rows * 3);
  const cw = w / cols, ch = h / rows;
  for (let y = 0; y < h; y++) {
    const row = Math.min(rows - 1, Math.floor(y / ch)) * cols;
    for (let x = 0; x < w; x++) {
      const cell = (row + Math.min(cols - 1, Math.floor(x / cw))) * 3, at = (y * w + x) * channels;
      for (let k = 0; k < 3; k++) means[cell + k] += frame[at + k] / (cw * ch);
    }
  }
  return means;
}

/**
 * How much a short run of frames looks like neither the frame before it nor the frame after it, while those two
 * look like each other. Frames are given as cell means (`cellMeans`), so a sprite that only changes its pose
 * scores little and one drawn in the wrong colour or shape scores high. For each cell: the smallest difference of
 * any frame of the run to either side, less the difference between the two sides; the largest cell is the score.
 * Steady motion and a change that stays score near 0, even while the camera scrolls.
 */
export function flickerScore(before, run, after) {
  const diff = (a, b, at) => Math.max(Math.abs(a[at] - b[at]), Math.abs(a[at + 1] - b[at + 1]), Math.abs(a[at + 2] - b[at + 2]));
  let most = 0;
  for (let at = 0; at < before.length; at += 3) {
    let least = Infinity;
    for (const frame of run) least = Math.min(least, diff(before, frame, at), diff(frame, after, at));
    most = Math.max(most, least - diff(before, after, at));
  }
  return most;
}

/**
 * Runs of 1 to `longest` frames drawn unlike the frames on either side: { from, to, score }. Where runs overlap,
 * the one that scores highest is kept. `score(from, to)` gives a run's flicker score.
 */
export function flickers(count, score, { longest = 4, floor = 15 } = {}) {
  const runs = [];
  for (let from = 1; from < count - 1; from++) {
    for (let to = from; to < Math.min(count - 1, from + longest); to++) {
      const value = score(from, to);
      if (value > floor) runs.push({ from, to, score: Math.round(value * 10) / 10 });
    }
  }
  runs.sort((a, b) => b.score - a.score || (a.to - a.from) - (b.to - b.from));
  const kept = [];
  for (const run of runs) if (!kept.some((k) => run.from <= k.to + 1 && k.from <= run.to + 1)) kept.push(run);
  return kept.sort((a, b) => a.from - b.from);
}

/** Each frame against the one before (`diffs`), and the short runs drawn unlike their neighbours (`flickers`). */
export async function differences(frames, options) {
  const smalls = [];
  for (const frame of frames) smalls.push(await small(frame.data));
  const means = smalls.map((s) => cellMeans(s));
  return {
    diffs: smalls.map((s, i) => (i === 0 ? 0 : cellDifference(smalls[i - 1], s))),
    flickers: flickers(means.length, (from, to) => flickerScore(means[from - 1], means.slice(from, to + 1), means[to + 1]), options),
  };
}

/**
 * Records the frames drawn while `play()` runs and for `tail` ms after. Chrome's screencast first, so no drawn
 * frame is missed; repeated screenshots when the screencast sends nothing. Each frame is { data: jpeg, t: s }.
 */
export async function capture(page, play, { tail = 500, fps = 10 } = {}) {
  const frames = [];
  let how = 'screencast', failed = null;
  const cdp = await page.context().newCDPSession(page);
  let start = null;
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const t = metadata.timestamp ?? Date.now() / 1000;
    if (start === null) start = t;
    frames.push({ data: Buffer.from(data, 'base64'), t: t - start });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  const { width, height } = page.viewportSize();
  try {
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  } catch (error) { how = 'screenshots'; failed = String(error); }
  // A still page sends one frame or none; a first frame shows where the film begins.
  const began = Date.now();
  let shooting = how === 'screenshots';
  const shots = (async () => {
    while (shooting) {
      const data = await page.screenshot({ type: 'jpeg', quality: 85 });
      frames.push({ data, t: (Date.now() - began) / 1000 });
      await new Promise((r) => setTimeout(r, Math.max(0, 1000 / fps - 30)));
    }
  })();
  let error = null;
  try { await play(); } catch (e) { error = e; }
  await new Promise((r) => setTimeout(r, tail));
  if (how === 'screencast') {
    await cdp.send('Page.stopScreencast').catch(() => {});
    if (frames.length === 0) {
      // Nothing was drawn, or the screencast does not run here: one picture so the film is not empty.
      how = 'screenshots'; failed = 'the screencast sent no frames';
      frames.push({ data: await page.screenshot({ type: 'jpeg', quality: 85 }), t: 0 });
    }
  }
  shooting = false; await shots;
  await cdp.detach().catch(() => {});
  return { frames, how, failed, error, size: { width, height } };
}

/** Writes the full-size frames into `folder` and the sheet at `sheetPath`. Returns the frames shown on the sheet. */
export async function sheet(frames, { folder, sheetPath, fps = 10, found = [], runs = [], size }) {
  mkdirSync(folder, { recursive: true });
  frames.forEach((frame, i) => writeFileSync(resolve(folder, `${String(i).padStart(3, '0')}-${frame.t.toFixed(3)}s.jpg`), frame.data));
  // At most `fps` frames a second of the film on the sheet, plus every jump and every frame of a flicker.
  const span = frames.length > 1 ? frames.at(-1).t - frames[0].t : 0;
  const every = span > 0 ? Math.max(1, Math.round(frames.length / Math.max(1, span * fps))) : 1;
  const mark = new Map(found.map((j) => [j.frame, 'JUMP']));
  for (const run of runs) for (let i = run.from; i <= run.to; i++) mark.set(i, 'FLICKER');
  const shown = pick(frames.length, { every, keep: [...mark.keys()] });
  const layout = sheetLayout({ count: shown.length, frameW: size.width, frameH: size.height });
  const parts = [];
  for (let k = 0; k < shown.length; k++) {
    const i = shown[k], cell = layout.cells[k], tag = mark.get(i);
    const image = await sharp(frames[i].data).resize(cell.w, cell.h, { fit: 'fill' }).png().toBuffer();
    parts.push({ input: image, left: cell.x, top: cell.y });
    const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell.w}" height="${layout.labelH}"><rect width="100%" height="100%" fill="${tag ? '#b00020' : '#202020'}"/><text x="4" y="${layout.labelH - 5}" font-family="Menlo, monospace" font-size="12" fill="#fff">#${i}  ${frames[i].t.toFixed(2)} s${tag ? `  ${tag}` : ''}</text></svg>`;
    parts.push({ input: Buffer.from(label), left: cell.x, top: cell.y + cell.h });
    if (tag) {
      const ring = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell.w}" height="${cell.h}"><rect x="1.5" y="1.5" width="${cell.w - 3}" height="${cell.h - 3}" fill="none" stroke="#ff1744" stroke-width="3"/></svg>`;
      parts.push({ input: Buffer.from(ring), left: cell.x, top: cell.y });
    }
  }
  await sharp({ create: { width: layout.width, height: layout.height, channels: 3, background: '#101010' } }).composite(parts).png().toFile(sheetPath);
  return { shown, layout };
}
