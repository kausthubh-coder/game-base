// Fails a 2D asset before a person looks at it: every sprite sheet, portrait and icon against the style sheet
// (assets-src/art-style.json) and the contract (assets-src/art-contract.json).
//   bun tools/art/check.mjs [names...]      exit 1 when a new or changed asset breaks a rule
//   bun tools/art/check.mjs --all           also print the faults the ledger already knows
//   bun tools/art/check.mjs --list          the redraw list: what the ledger knows, worst and most seen first
//   bun tools/art/check.mjs --poses          the poses the contract's `wanted` list asks for, and which exist
//   bun tools/art/check.mjs --settle <key>  drop a ledger entry once it passes every rule: a sheet's name,
//                                           portrait:<who> or icon:<set>/<name>, as the check prints it
//   bun tools/art/check.mjs --ledger        rewrite every entry's faults from today's (an audit, on purpose)
//
// The ledger (assets-src/art-ledger.json) is why this can be strict today. It lists, for each sheet as it was
// audited, the rules it breaks. A sheet whose file and manifest entry still match its ledger entry may break those
// rules and no others. A sheet that is new, or was changed since, has no such allowance: it passes every rule,
// and it has an answered review (assets-src/art-reviews/<name>.md, written by `bun tools/art/review.mjs <name>`).
// So old faults are a list to work down, and nothing new joins it.
import fs from 'node:fs';
import { at, contract, manifest, readJSON, style } from './lib.mjs';
import { iconFaults, portraitFaults, shaOf, sheetFaults } from './rules.mjs';

const LEDGER = 'assets-src/art-ledger.json';

/** Whether `name` has a review answered for this exact sheet. Returns '' or what is wrong with it. */
export function reviewProblem(name, sha) {
  const path = `assets-src/art-reviews/${name}.md`;
  if (!fs.existsSync(at(path))) return `no review: run \`bun tools/art/review.mjs ${name}\`, open the picture, answer ${path}`;
  const text = fs.readFileSync(at(path), 'utf8');
  if (!text.includes(`sheet: ${sha}`)) return `${path} answers an older version of the sheet: run \`bun tools/art/review.mjs ${name}\` again and answer it`;
  const open = text.split('\n').filter((l) => /^Answer:\s*$/.test(l)).length;
  if (open) return `${path} has ${open} questions without an answer`;
  if (!/^Verdict: PASS\b/m.test(text)) return `${path} does not end in "Verdict: PASS"`;
  return '';
}

/** Runs every rule. Returns `{ results, fresh, known, stale }`; `fresh` is what fails the run. */
export async function run({ names = [], m = manifest(), s = style(), c = contract(), ledger = fs.existsSync(at(LEDGER)) ? readJSON(LEDGER) : { sheets: {}, portraits: {}, icons: {} } } = {}) {
  const cache = new Map(), results = {}, fresh = [], known = [], stale = [];
  const sort = (key, faults, entry, sha) => {
    const same = entry && (sha === undefined || entry.sha === sha);
    for (const f of faults) (same && entry.known.includes(f.rule) ? known : fresh).push({ key, ...f });
    if (same) for (const rule of entry.known) if (!faults.some((f) => f.rule === rule)) stale.push({ key, rule });
  };
  for (const name of Object.keys(m.sprites)) {
    if (names.length && !names.includes(name)) continue;
    const sha = shaOf(m.sprites[name]), faults = await sheetFaults(name, { m, s, c, cache }), entry = ledger.sheets[name];
    if (!entry || entry.sha !== sha) { const problem = reviewProblem(name, sha); if (problem) faults.push({ rule: 'review', detail: problem }); }
    results[name] = { sha, faults };
    sort(name, faults, entry, sha);
  }
  if (!names.length) {
    for (const [who, faults] of Object.entries(await portraitFaults({ m, s, c }))) { results['portrait:' + who] = { faults }; sort('portrait:' + who, faults, ledger.portraits[who]); }
    for (const [icon, faults] of Object.entries(await iconFaults({ m, s }))) { results['icon:' + icon] = { faults }; sort('icon:' + icon, faults, ledger.icons[icon]); }
    for (const who of Object.keys(ledger.portraits)) if (!results['portrait:' + who]) for (const rule of ledger.portraits[who].known) stale.push({ key: 'portrait:' + who, rule });
    for (const icon of Object.keys(ledger.icons)) if (!results['icon:' + icon]) for (const rule of ledger.icons[icon].known) stale.push({ key: 'icon:' + icon, rule });
  }
  return { results, fresh, known, stale, ledger };
}

/** The ledger's entries that still need an artist, worst and most seen first. */
export function redrawList(ledger) {
  const rows = [];
  for (const [group, prefix] of [['sheets', ''], ['portraits', 'portrait:'], ['icons', 'icon:']]) for (const [name, e] of Object.entries(ledger[group] ?? {})) {
    if (!e.known.length && !(e.grade < 4)) continue;
    rows.push({ name: prefix + name, grade: e.grade ?? 3, seen: e.seen ?? 2, known: e.known, eyes: e.eyes ?? '', owner: e.owner ?? '' });
  }
  return rows.sort((a, b) => (5 - b.grade) * b.seen - (5 - a.grade) * a.seen || a.name.localeCompare(b.name));
}

if (import.meta.main) {
  const args = process.argv.slice(2), flag = (f) => args.includes('--' + f);
  const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--settle');
  if (flag('list')) {
    for (const r of redrawList(readJSON(LEDGER))) console.log(`${String(r.grade).padEnd(4)}seen ${r.seen}  ${r.name.padEnd(26)} ${r.known.join(', ').padEnd(34)} ${r.eyes}${r.owner ? `  [${r.owner}]` : ''}`);
    process.exit(0);
  }
  if (flag('poses')) {
    // The poses the act asks for and no sheet has yet.
    const m = manifest();
    for (const w of contract().wanted) for (const anim of w.anims) console.log(`${m.sprites[w.sheet]?.animations[anim] ? 'have   ' : 'MISSING'} ${w.sheet.padEnd(16)} ${anim.padEnd(7)} ${w.why}${w.owner ? `  [${w.owner}]` : ''}`);
    process.exit(0);
  }
  const { results, fresh, known, stale, ledger } = await run({ names });
  if (flag('ledger') || flag('settle')) {
    const only = flag('settle') ? args[args.indexOf('--settle') + 1] : null;
    // A portrait or an icon with no fault is not in the results at all: its entry goes the same way.
    if (only && !results[only]) {
      const [group, name] = only.startsWith('portrait:') ? ['portraits', only.slice(9)] : only.startsWith('icon:') ? ['icons', only.slice(5)] : ['sheets', only];
      if (!ledger[group][name]) { console.error(`FAIL: the ledger has no entry ${only}`); process.exit(1); }
      delete ledger[group][name];
      console.log(`settled ${only}: its ledger entry is gone, and it is held to every rule from now on`);
    }
    for (const [key, r] of Object.entries(results)) {
      const [group, name] = key.startsWith('portrait:') ? ['portraits', key.slice(9)] : key.startsWith('icon:') ? ['icons', key.slice(5)] : ['sheets', key];
      if (only && key !== only) continue;
      const rules = [...new Set(r.faults.map((f) => f.rule))].filter((rule) => rule !== 'review');
      if (only) {
        if (rules.length) { console.error(`FAIL: ${only} still breaks ${rules.join(', ')}; a sheet is settled only when it passes`); process.exit(1); }
        delete ledger[group][name];
        console.log(`settled ${only}: its ledger entry is gone, and it is held to every rule from now on`);
        continue;
      }
      const old = ledger[group][name] ?? {};
      if (!rules.length && old.grade === undefined) { delete ledger[group][name]; continue; }
      ledger[group][name] = { ...(r.sha ? { sha: r.sha } : {}), ...old, ...(r.sha ? { sha: r.sha } : {}), known: rules };
    }
    fs.writeFileSync(at(LEDGER), JSON.stringify(ledger, null, 1).replace(/\[\n\s+/g, '[').replace(/",\n\s+"/g, '", "').replace(/"\n\s+\]/g, '"]') + '\n');
    if (!only) console.log(`ledger rewritten: ${Object.keys(ledger.sheets).length} sheets, ${Object.keys(ledger.portraits).length} portraits, ${Object.keys(ledger.icons).length} icons with a known fault or a grade`);
    process.exit(0);
  }
  fs.mkdirSync(at('.artifacts/art'), { recursive: true });
  fs.writeFileSync(at('.artifacts/art/check.json'), JSON.stringify({ fresh, known, stale }, null, 1));
  if (flag('all')) for (const f of known) console.log(`known  ${f.key.padEnd(24)} ${f.rule.padEnd(10)} ${f.detail}`);
  for (const f of stale) console.log(`fixed  ${f.key.padEnd(24)} ${f.rule.padEnd(10)} no longer broken: \`bun tools/art/check.mjs --settle ${f.key}\` when the sheet passes every rule`);
  for (const f of fresh) console.log(`FAIL   ${f.key.padEnd(24)} ${f.rule.padEnd(10)} ${f.detail}`);
  const checked = Object.keys(results).length;
  console.log(fresh.length
    ? `FAIL art: ${fresh.length} new faults in ${new Set(fresh.map((f) => f.key)).size} assets (${known.length} known faults are on the redraw list). Each rule's fix is in .agents/skills/make-sprite/check-failures.md`
    : `PASS art: ${checked} sheets, portraits and icons with faults or checks, no new fault; ${known.length} known faults on the redraw list (\`--list\`)`);
  process.exit(fresh.length ? 1 : 0);
}
