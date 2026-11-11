// The playtest journal: one line of journal.jsonl a step, then a page and the notes alone made from it.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import sharp from 'sharp';

export const NOTE_KINDS = ['bug', 'polish', 'question'];

export function append(folder, entry) {
  appendFileSync(resolve(folder, 'journal.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}

export function read(folder) {
  const file = resolve(folder, 'journal.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

/** The newest session folder under `journalRoot`. Folder names start with the time, so the last by name is the newest. */
export function latest(journalRoot) {
  if (!existsSync(journalRoot)) return null;
  const names = readdirSync(journalRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  return names.length ? resolve(journalRoot, names.at(-1)) : null;
}

const escape = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** The picture as a data URL, shrunk, so the page needs nothing beside it. */
async function inline(path, width) {
  if (!path || !existsSync(path)) return null;
  const data = await sharp(path).resize({ width, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
  return `data:image/jpeg;base64,${data.toString('base64')}`;
}

const list = (title, lines, cls = '') => (lines?.length ? `<h4>${title}</h4><ul class="${cls}">${lines.map((l) => `<li>${escape(l)}</li>`).join('')}</ul>` : '');
const wrongLine = (w) => `${w.kind}: ${w.what} at ${w.box.x},${w.box.y} ${w.box.w}x${w.box.h} (${w.why})`;

/** Writes journal.html and notes.md into the session folder and returns their paths. */
export async function render(folder) {
  const entries = read(folder);
  const notes = entries.filter((e) => e.kind === 'note');
  const steps = entries.filter((e) => e.kind !== 'note');
  const notesFor = new Map();
  for (const note of notes) {
    const key = note.step ?? -1;
    if (!notesFor.has(key)) notesFor.set(key, []);
    notesFor.get(key).push(note);
  }
  const blocks = [];
  for (const step of steps) {
    const src = await inline(step.picture, step.kind === 'film' ? 1400 : 960);
    const pinned = notesFor.get(step.step) ?? [];
    const input = step.input === undefined ? '' : `<pre class="input">${escape(JSON.stringify(step.input))}</pre>`;
    const failed = step.failed ? `<p class="failed">Input failed: ${escape(step.failed)}</p>` : '';
    const film = step.kind === 'film'
      ? `<p>${step.frames} frames by ${escape(step.how)}. Flickers: ${step.flickers?.length ? step.flickers.map((r) => `#${r.from}${r.to > r.from ? `-#${r.to}` : ''} at ${r.t} s (${r.score})`).join(', ') : 'none'}. Jumps over ${step.limit} (median ${step.median}): ${step.jumps?.length ? step.jumps.map((j) => `#${j.frame} (${j.diff}${j.back ? ', and back' : ''})`).join(', ') : 'none'}.</p>`
      : '';
    blocks.push(`<section id="step-${step.step}">
  <h3>${escape(String(step.step).padStart(3, '0'))} · ${escape(step.kind)} · ${escape(step.name ?? '')}</h3>
  ${input}${failed}
  <div class="row">
    <a class="pic" href="${escape(relative(folder, step.picture ?? ''))}">${src ? `<img src="${src}" alt="${escape(basename(step.picture ?? ''))}">` : '<span>no picture</span>'}</a>
    <div class="facts">
      ${pinned.map((n) => `<div class="note ${escape(n.note)}"><b>${escape(n.note)}</b> ${escape(n.words)}</div>`).join('')}
      ${film}
      ${list('Changed', step.changed)}
      ${list('Now', step.now)}
      ${list('Wrong', (step.wrong ?? []).map(wrongLine), 'warn')}
      ${list('Problems', step.problems, 'warn')}
    </div>
  </div>
</section>`);
  }
  const loose = notesFor.get(-1) ?? [];
  const title = `Playtest ${basename(folder)}`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
  body { margin: 0; padding: 16px 24px 48px; background: #f6f3ec; color: #222; font: 15px/1.45 -apple-system, system-ui, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 4px; } .sub { color: #666; margin: 0 0 20px; }
  section { background: #fff; border: 1px solid #e2ddd2; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; }
  h3 { margin: 0 0 8px; font-size: 15px; } h4 { margin: 8px 0 2px; font-size: 13px; color: #555; }
  .row { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
  .pic { flex: 0 1 640px; } .pic img { width: 100%; border-radius: 4px; display: block; }
  .facts { flex: 1 1 280px; min-width: 240px; } ul { margin: 0; padding-left: 18px; } li { margin: 1px 0; }
  .warn li { color: #8a3b00; } pre.input { background: #f1efe9; padding: 4px 8px; border-radius: 4px; white-space: pre-wrap; margin: 0 0 8px; font-size: 12px; }
  .failed { color: #b00020; font-weight: 600; }
  .note { padding: 6px 10px; border-radius: 6px; margin: 0 0 6px; background: #fff7d6; border-left: 4px solid #d4a000; }
  .note.bug { background: #ffe9e9; border-color: #c62828; } .note.question { background: #e8f1ff; border-color: #1e63c4; }
  .summary li { margin: 3px 0; }
</style></head><body>
<h1>${escape(title)}</h1>
<p class="sub">${steps.length} steps, ${notes.length} notes. Click a picture for the full size.</p>
${notes.length ? `<section><h3>Notes</h3><ul class="summary">${notes.map((n) => `<li><b>${escape(n.note)}</b> ${escape(n.words)} ${n.step !== undefined && n.step !== null ? `<a href="#step-${n.step}">step ${n.step}</a>` : ''}</li>`).join('')}</ul></section>` : ''}
${loose.map((n) => `<div class="note ${escape(n.note)}"><b>${escape(n.note)}</b> ${escape(n.words)}</div>`).join('')}
${blocks.join('\n')}
</body></html>`;
  const htmlPath = resolve(folder, 'journal.html');
  writeFileSync(htmlPath, html);
  const md = [`# Notes from ${basename(folder)}`, ''];
  if (notes.length === 0) md.push('No notes.');
  for (const note of notes) md.push(`- **${note.note}** ${note.words}${note.picture ? `  \n  ${note.picture}` : ''}`);
  const notesPath = resolve(folder, 'notes.md');
  writeFileSync(notesPath, md.join('\n') + '\n');
  return { html: htmlPath, notes: notesPath };
}

/**
 * Copies each noted picture into `to` as a small JPEG, with a notes.md that links them, so a report in the repo
 * can show its findings. A picture is a 960 px wide JPEG of about 100 KB, where the journal's PNG is about 700 KB.
 */
export async function exportNotes(folder, to) {
  const notes = read(folder).filter((e) => e.kind === 'note');
  mkdirSync(to, { recursive: true });
  const md = [`# Notes from ${basename(folder)}`, ''];
  if (notes.length === 0) md.push('No notes.');
  const written = new Map();
  for (const note of notes) {
    let name = null;
    if (note.picture && existsSync(note.picture)) {
      name = written.get(note.picture) ?? basename(note.picture).replace(/\.png$/, '.jpg');
      if (!written.has(note.picture)) {
        await sharp(note.picture).resize({ width: 960, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(resolve(to, name));
        written.set(note.picture, name);
      }
    }
    md.push(`- **${note.note}** ${note.words}${name ? `  \n  ![${name}](${name})` : ''}`);
  }
  const notesPath = resolve(to, 'notes.md');
  writeFileSync(notesPath, md.join('\n') + '\n');
  return { notes: notesPath, pictures: [...written.values()].map((name) => resolve(to, name)) };
}
