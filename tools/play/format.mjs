// The look block: what an agent reads in one glance after `look`, `act` and `film`. Pure.

const MAX_SCREEN = 24;
const cut = (s, n = 72) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const boxText = (b) => `${b.x},${b.y} ${b.w}x${b.h}`;

/** One line a piece: [pressable], "text". A row of same-sized buttons (the quick slots) is one line. */
export function screenLines(items) {
  const lines = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.press) {
      let j = i;
      while (j + 1 < items.length && items[j + 1].press && Math.abs(items[j + 1].box.y - item.box.y) <= 8
        && items[j + 1].box.w === item.box.w && items[j + 1].box.h === item.box.h && !items[j + 1].disabled === !item.disabled
        && items[j + 1].blockedBy === item.blockedBy) j++;
      if (j - i >= 3) {
        const row = items.slice(i, j + 1);
        // The words every name in the row starts with are said once: "Quick slot [1: Axe, 1] [2: empty]".
        let prefix = row.reduce((p, r) => { while (!r.text.startsWith(p)) p = p.slice(0, -1); return p; }, row[0].text);
        prefix = prefix.slice(0, prefix.lastIndexOf(' ') + 1);
        lines.push(`${prefix}${row.map((r) => `[${cut(r.text.slice(prefix.length) || '?', 18)}]`).join(' ')}${item.blockedBy ? ` blocked by ${cut(item.blockedBy, 40)}` : ''}  ${row.length}x ${item.box.w}x${item.box.h} from ${item.box.x},${item.box.y} to ${items[j].box.x},${items[j].box.y}`);
        i = j; continue;
      }
      lines.push(`[${cut(item.text || `(${item.kind}, no text)`, 60)}]${item.disabled ? ' disabled' : ''}${item.blockedBy ? ` blocked by ${cut(item.blockedBy, 40)}` : ''}  ${boxText(item.box)}`);
    } else lines.push(`${JSON.stringify(cut(item.text))}  ${boxText(item.box)}`);
  }
  return lines;
}

/** The look as plain text. Blind looks have no `changed` or `now`. */
export function formatLook(look) {
  const out = [];
  out.push(`${look.title}  ${look.picture}`);
  if (look.failed) out.push(`FAILED input ${look.failed}`);
  if (look.film) {
    const f = look.film;
    out.push(`film: ${f.frames} frames in ${f.seconds} s by ${f.how}${f.failed ? ` (${f.failed})` : ''}; frames in ${f.folder}`);
    out.push(`flickers: ${f.flickers.length ? f.flickers.map((r) => `#${r.from}${r.to > r.from ? `-#${r.to}` : ''} at ${r.t} s, ${r.frames} frame${r.frames > 1 ? 's' : ''} (${r.score})`).join(', ') : 'none'}`);
    out.push(`jumps: ${f.jumps.length ? f.jumps.map((j) => `#${j.frame} at ${j.t} s (${j.diff}${j.back ? ', and back' : ''})`).join(', ') : 'none'}  (median ${f.median}, limit ${f.limit})`);
    const marked = [...f.flickers, ...f.jumps].map((m) => m.file).filter(Boolean);
    for (const path of [...new Set(marked)].slice(0, 6)) out.push(`  open ${path}`);
    if (f.last) out.push(`last frame: ${f.last}`);
  }
  const lines = screenLines(look.screen);
  out.push(`screen (${look.screen.length}):`);
  for (const line of lines.slice(0, MAX_SCREEN)) out.push(`  ${line}`);
  if (lines.length > MAX_SCREEN) out.push(`  … ${lines.length - MAX_SCREEN} more lines (look --json)`);
  for (const more of look.outOfSight ?? []) out.push(`  out of sight: ${more.count} more piece${more.count > 1 ? 's' : ''} in ${cut(more.in, 50)}; scroll to read ${more.count > 1 ? 'them' : 'it'}`);
  out.push(look.wrong.length ? `wrong (${look.wrong.length}):` : 'wrong: none');
  for (const w of look.wrong.slice(0, 8)) out.push(`  ${w.kind} ${JSON.stringify(cut(w.what, 40))} ${boxText(w.box)}: ${w.why}`);
  if (look.wrong.length > 8) out.push(`  … ${look.wrong.length - 8} more (look --json)`);
  if (look.changed) {
    out.push(look.changed.length ? 'changed:' : 'changed: nothing');
    for (const line of look.changed) out.push(`  ${line}`);
  }
  if (look.now) out.push(`now: ${look.now.join('; ')}`);
  out.push(look.problems.length ? `problems (${look.problems.length}):` : 'problems: none');
  for (const p of look.problems.slice(0, 6)) out.push(`  ${cut(p, 200)}`);
  if (look.problems.length > 6) out.push(`  … ${look.problems.length - 6} more (look --json)`);
  return out.join('\n');
}
