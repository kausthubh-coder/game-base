// One sprite sheet beside what it must match, in one picture, and the questions its artist must answer.
//   bun tools/art/review.mjs <sheet> --quick              the look after every change: this sheet's card alone.
//                                                         No browser, no rubric, a few seconds. Needs no slot.
//   bun tools/art/review.mjs <sheet> [--before <git ref>] the review: the sheet before, its reference, the sheet
//                                                         now, the animation playing, and the rubric. No browser.
//   bun tools/slot.mjs --look -- bun tools/art/review.mjs <sheet> --world --url http://localhost:<port>
//                                                         the same with the figure standing in the game at noon
//                                                         beside the hero (`--night` adds the night). One page
//                                                         load and one or two shots, so it fits the look lane.
// A card is: the figure to scale beside the hero on day and night ground, its concept sheet, every frame of every
// animation, and each animation's frames laid over each other. A sprite sheet is judged from the cards; the world
// rows show what the cards cannot, the game's light and camera on it.
// Writes
//   .artifacts/art/review/<sheet>.png    the picture (<sheet>-quick.png with --quick)
//   .artifacts/art/review/<sheet>.webp   its animations playing
//   assets-src/art-reviews/<sheet>.md    the rules it breaks, the measured heads, and the rubric. `bun tools/art/check.mjs`
//                                        fails a new or changed sheet until every question is answered for this file.
// `--picture` draws the picture and writes no rubric: for a tool's repair, which the lead looks at.
// A portrait or an icon has no rubric file: `bun tools/art/see.mjs --only portraits --names <who>` and
// `--only icons` draw them, with no browser.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import sharp from 'sharp';
import { card } from './card.mjs';
import { at, block, characterOf, contract, forget, frames, label, manifest, scaled, style } from './lib.mjs';
import { shaOf, sheetFaults } from './rules.mjs';

const args = process.argv.slice(2), name = args[0];
const opt = (k, fallback) => { const i = args.indexOf('--' + k); return i < 0 ? fallback : args[i + 1]; };
const m = manifest(), s = style(), c = contract();
if (!name || !m.sprites[name]) { console.error(`usage: bun tools/art/review.mjs <sheet> [--quick] [--before <git ref>] [--world --url <game>] [--night] [--picture]\n${name ? `FAIL: no sprite "${name}" in the manifest` : ''}`); process.exit(2); }
const entry = m.sprites[name], who = characterOf(name, c), out = '.artifacts/art/review';
fs.mkdirSync(at(out), { recursive: true });
fs.mkdirSync(at('assets-src/art-reviews'), { recursive: true });

const parts = [];
const title = async (text) => parts.push({ input: await sharp(block(1400, 24, '#15131a')).composite([label(text, 4, 3, '#eeca76', 15)]).png().toBuffer(), h: 24 });
if (args.includes('--quick')) {
  const c1 = await card(name, { m, s, c });
  await sharp(c1.input).toFile(at(`${out}/${name}-quick.png`));
  console.log(`${out}/${name}-quick.png`);
  process.exit(0);
}
const before = opt('before', '');
if (before) {
  // The sheet and its manifest entry as they were, drawn by the same card.
  const old = JSON.parse(execFileSync('git', ['show', `${before}:public/assets/manifest.json`], { cwd: at('.'), maxBuffer: 1 << 26 }).toString()).sprites[name];
  if (old) {
    const tmp = `.artifacts/art/review/.before-${name}.png`;
    fs.writeFileSync(at(tmp), execFileSync('git', ['show', `${before}:public/assets/${old.sheet}`], { cwd: at('.'), maxBuffer: 1 << 26 }));
    await title(`BEFORE  ${name} at ${before}`);
    parts.push(await card(name, { m, s, c, entryOverride: { ...old, sheet: '../../' + tmp } }));
    forget('../../' + tmp);
  } else await title(`BEFORE  ${name} did not exist at ${before}`);
}
if (who.id !== name && m.sprites[who.id]) { await title(`REFERENCE  ${who.id}: every frame below must be this ${who.kind}`); parts.push(await card(who.id, { m, s, c })); }
await title(`${before ? 'AFTER' : 'REVIEW'}  ${name}`);
parts.push(await card(name, { m, s, c }));

const url = opt('url', process.env.PLAY_PORT ? `http://localhost:${process.env.PLAY_PORT}` : '');
let world = 'not asked for: the cards are the review. `--world --url <game>` in the look lane adds the game\'s own light and camera';
if (args.includes('--world') && !url) { console.error('FAIL: --world needs a running game: start `bun run dev` outside the queue, then pass --url http://localhost:<port>'); process.exit(2); }
if (args.includes('--world')) {
  const { launchChrome } = await import('../lib/chrome.mjs'), { lineUp } = await import('./stage.mjs');
  const browser = await launchChrome({});
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    page.setDefaultTimeout(180000);
    await page.goto(`${url}/?hold=1&seed=7`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__game);
    await page.evaluate(async () => { const g = window.__game; g.newGame(); g.manual(true);  await g.settle(); });
    const row = [...new Set([who.id, name])].filter((n) => m.sprites[n] && n !== 'hero'), giant = entry.worldHeight > 2.6;
    for (const [time, text] of args.includes('--night') ? [[0.5, 'noon'], [0.92, 'night']] : [[0.5, 'noon']]) {
      const shot = await lineUp(page, row, { space: giant ? Math.max(4.5, entry.worldHeight * 0.6) : 2.1, time });
      await title(`IN THE WORLD at ${text}, the game's camera. Left to right: ${[...row.slice(0, Math.ceil(row.length / 2)), 'HERO', ...row.slice(Math.ceil(row.length / 2))].join('  ')}`);
      const cut = giant ? { left: 20, top: 0, width: 1400, height: 900 } : { left: 370, top: 300, width: 700, height: 300 };
      parts.push({ input: await sharp(shot).extract(cut).resize({ width: giant ? 1400 : 1400 }).png().toBuffer(), h: giant ? 900 : 600 });
    }
    world = 'drawn';
  } finally { await browser.close(); }
}
let top = 0; const layers = parts.map((p) => { const l = { input: p.input, left: 0, top }; top += p.h + 4; return l; });
await sharp(block(1400, top, '#15131a')).composite(layers).png().toFile(at(`${out}/${name}.png`));

// The animations playing, side row first when there is one.
const list = await frames(entry), shown = [], delays = [];
for (const anim of Object.keys(entry.animations)) for (const dir of ['side', 'front', 'back']) for (const f of list.filter((x) => x.anim === anim && x.dir === dir)) {
  shown.push(await sharp(block(f.w * 2, f.h * 2, s.grounds.day)).composite([{ input: await scaled(f, 2) }]).png().toBuffer());
  delays.push(Math.round(1000 / f.fps));
}
await sharp(shown, { join: { animated: true } }).webp({ loop: 0, delay: delays, lossless: true }).toFile(at(`${out}/${name}.webp`));

// The rubric. Answers already given for this exact sheet are kept.
const sha = shaOf(entry), path = `assets-src/art-reviews/${name}.md`;
const faults = (await sheetFaults(name, { m, s, c })).map((f) => `- ${f.rule}: ${f.detail}`);
// The head's width in the first front and back frame, measured: the widest row of the figure's top 30 rows. A raised
// tool beside the head widens it, so the picture decides, and the number says where to look.
const headOf = (frameList, dir) => {
  const f = frameList.find((x) => x.dir === dir); if (!f) return null;
  let top = -1, widest = 0;
  for (let y = 0; y < f.h; y++) { let l = -1, r = -1; for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3] > 127) { if (l < 0) l = x; r = x; } if (l < 0) continue; if (top < 0) top = y; if (y < top + 30) widest = Math.max(widest, r - l + 1); }
  return widest;
};
const heads = [];
if (who.kind === 'person' && who.id !== name && m.sprites[who.id]) {
  const base = await frames(m.sprites[who.id]);
  for (const dir of ['front', 'back']) { const a = headOf(base, dir), b = headOf(list, dir); if (a && b) heads.push(`- head, first ${dir} frame: ${who.id} ${a} pixels wide, ${name} ${b}${Math.abs(a - b) > 2 ? ' (over 2 apart: look at the hair and at anything held beside the head)' : ''}`); }
}
const ref = who.id === name ? 'its own first frame' : `\`${who.id}\`, the reference card`;
const questions = [
  `Who is it? Name the reference's hair shape and colour, how many eyes show from the front, the top, the bottom, the footwear and the carried thing. Then name the frame of this sheet that differs most from ${ref} in any of them, and how.`,
  `Size. The measured head widths are above. Where they are over 2 pixels apart, say what makes the difference (fuller hair, a bigger skull, a tool beside the head). Fuller hair or a bigger skull is another head.`,
  `The concept sheet. Name its five or six big coloured shapes and say which this sheet changed or lost${who.concept ? '' : ' (no concept sheet: say so, and what the approved reference is)'}.`,
  `Height in the world. The facts line gives its height in heroes and what its sheet says. Is it right beside the hero on the green strip${world === 'drawn' ? ' and in the world shots' : ''}?`,
  `Outline and light. Is every edge closed by a dark tinted line, one or two pixels, with no black and no pale rim on the night strip? Is the light from the upper left in all three directions?`,
  `Motion. Open ${out}/${name}.webp and the laid-over frames at the right of each row. Name any frame that slides sideways, changes size, pops, or leaves a ghost. A loop: does the last frame lead back to the first?`,
  `Game size. On the night strip (half size) is it told apart from the hero and from the nearest character like it by its big shapes alone? Which character is nearest?`,
  `The view of each row. Does the front face the camera, the back show no face, and the side face right, in every frame?`,
];
const header = `# Review of ${name}\n\nsheet: ${sha}\npicture: ${out}/${name}.png\nworld: ${world}\n`;
const old = fs.existsSync(at(path)) ? fs.readFileSync(at(path), 'utf8') : '';
if (args.includes('--picture')) console.log('picture only: no rubric written');
else if (old.includes(`sheet: ${sha}`)) console.log(`${path} already answers this sheet; left as it is`);
else {
  fs.writeFileSync(at(path), `${header}\n## What the check found\n\n${faults.length ? faults.join('\n') : 'Nothing: every rule passes.'}${heads.length ? '\n\nMeasured, for question 2:\n' + heads.join('\n') : ''}\n\n## The rubric\n\nAnswer each from the picture, in a sentence or two, naming frames as "walk side frame 3". An answer that says\nonly "yes" or "fine" is not an answer. When unsure, it fails.\n\n${questions.map((q, i) => `### ${i + 1}. ${q}\n\nAnswer:\n`).join('\n')}\n## Defects left\n\nAnswer:\n\nVerdict:\n`);
  console.log(`${path}  answer every "Answer:" and end with "Verdict: PASS" or "Verdict: FAIL <why>"`);
}
console.log(`${out}/${name}.png\n${out}/${name}.webp`);
console.log(faults.length ? `the check finds ${faults.length} faults:\n${faults.join('\n')}` : 'the check finds no fault');
