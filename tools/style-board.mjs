// The style lab's board: one page to play every style and compare them side by side. It gathers each style's
// shots, motion GIFs and STYLE.md from the comparison folder or the style's worktree, makes small JPEGs of the
// places, and writes index.html. Run it again as styles finish.
//   bun tools/style-board.mjs [--out ~/dev/sandbox/game-look-test/design/img/style-lab]
// The playable builds live in <out>/play/<slug>, each served on its own port (5441 to 5446), because the game loads
// some assets from the site root.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const out = resolve(opt('out', join(homedir(), 'dev/sandbox/game-look-test/design/img/style-lab')));

// What each style is, and the numbers its agent measured. `port` is the local port of its playable build.
const STYLES = [
  { slug: 'base', name: "Today's game", like: 'The game on style/lab, for before and after', port: 5441 },
  { slug: 'hd2d', name: 'HD-2D', like: 'Octopath Traveler II, Dragon Quest III HD-2D', port: 5442,
    chars: 'Pixel sprites in a lit 3D diorama', motion: 'Image gen draws every frame',
    cost: ['Fishing for the hero: 9 image tries, none passed the strict check, about 35 minutes', 'Fishing for all 14 characters: about 125 tries and 8 hours', 'Villager and prop costs are estimates, not measured'] },
  { slug: 'puppet', name: 'Paper puppet', like: 'Paper Mario, Cult of the Lamb, Don\'t Starve', port: 5443,
    chars: 'Painted cut-out parts on 2D bones', motion: 'Code moves the parts',
    cost: ['A new action (chop): 7 minutes of code, no images, every character at once', 'A new villager: 2 parts sheets, 3 tries each, two lines, a rebuild under a minute', '96 image tries made 32 sheets; 86 of 91 returned images cut cleanly'] },
  { slug: 'chibi', name: 'Chibi toon 3D', like: 'Dragon Quest Builders 2, A Short Hike, Animal Crossing', port: 5444,
    chars: 'Short round 3D models on one shared rig, swappable faces', motion: 'One clip library plus code' },
  { slug: 'anime', name: 'Anime toon 3D', like: 'Genshin Impact, Honkai Star Rail', port: 5445,
    chars: 'Taller cel-shaded 3D models with face textures', motion: 'Keyframed clips by Blender script',
    cost: ['Fishing for everyone: about 40 lines in the Blender build, 12 for the rod, 15 shared with every cast-and-hold clip'] },
  { slug: 'voxel', name: 'Voxel', like: 'Cube World, Hytale, Trove', port: 5446,
    chars: 'Voxel figures carved from AI pixel drawings', motion: 'Code swings the blocky parts',
    cost: ['A new villager: about 15 minutes and 2 tries, drawn in flat colour', 'Fishing for all 12 people: about 60 lines of code, no images (time not measured)', 'Shaded drawings carve as camouflage; flat-colour drawings carve cleanly'] },
];
const PLACES = ['spawn', 'garden', 'town', 'meadow'];
const VIEWS = [['tilt', '2.5D camera'], ['low', 'Low camera']];
const CLIPS = ['walk', 'run', 'tool', 'turn', 'talk', 'creature', 'fish'];

// Where each style's work is: its worktree, by branch.
const worktrees = {};
for (const block of execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' }).split('\n\n')) {
  const path = /^worktree (.+)$/m.exec(block)?.[1], branch = /^branch refs\/heads\/style\/(.+)$/m.exec(block)?.[1];
  if (path && branch) worktrees[branch] = path;
}

const files = (dir) => (existsSync(dir) ? readdirSync(dir) : []);
const status = {};
for (const style of STYLES) {
  const dest = join(out, style.slug);
  const tree = style.slug === 'base' ? root : worktrees[style.slug];
  // The agent's own copy in the comparison folder wins; otherwise the latest shots in its worktree.
  const sources = [dest, tree && join(tree, '.artifacts/style-lab', style.slug)].filter((d) => d && existsSync(d));
  mkdirSync(join(dest, 'thumbs'), { recursive: true });
  mkdirSync(join(dest, 'motion'), { recursive: true });
  const found = { places: [], clips: [], extras: [] };
  for (const [view] of VIEWS) for (const place of PLACES) {
    const name = `${view}-${place}`;
    const src = sources.map((s) => join(s, 'places', name + '.png')).find(existsSync);
    if (!src) continue;
    await sharp(src).resize(960).jpeg({ quality: 82 }).toFile(join(dest, 'thumbs', name + '.jpg'));
    if (src !== join(dest, 'places', name + '.png')) { mkdirSync(join(dest, 'places'), { recursive: true }); copyFileSync(src, join(dest, 'places', name + '.png')); }
    found.places.push(name);
  }
  for (const clip of CLIPS) {
    const src = sources.map((s) => join(s, 'motion', clip + '.gif')).find(existsSync);
    if (!src) continue;
    if (src !== join(dest, 'motion', clip + '.gif')) copyFileSync(src, join(dest, 'motion', clip + '.gif'));
    found.clips.push(clip);
  }
  for (const extra of ['chop-strip.png', 'pell-shaded-vs-flat.png']) {
    const src = sources.flatMap((s) => [join(s, extra), join(s, 'motion', extra)]).find(existsSync);
    if (src && src !== join(dest, extra)) copyFileSync(src, join(dest, extra));
    if (src) found.extras.push(extra);
  }
  const bible = tree && join(tree, 'docs/style-lab', style.slug, 'STYLE.md');
  if (bible && existsSync(bible)) { copyFileSync(bible, join(dest, 'STYLE.md')); found.bible = true; }
  found.done = existsSync(join(dest, 'card.png')) || style.slug === 'base';
  status[style.slug] = found;
  console.log(`${style.slug}: ${found.places.length} places, ${found.clips.length} clips${found.bible ? ', STYLE.md' : ''}${found.done ? '' : ', still working'}`);
}
copyFileSync(join(root, 'docs/style-lab/reference/genshin-fields.png'), join(out, 'reference.png'));

const data = JSON.stringify({ styles: STYLES, status, places: PLACES, views: VIEWS, clips: CLIPS, built: new Date().toISOString() });
writeFileSync(join(out, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Style lab</title><link rel="icon" href="data:,">
<style>
:root { --bg:#14120f; --panel:#1d1a16; --line:#332d26; --ink:#f1e9dc; --mute:#a99d8c; --accent:#e7b75f; --good:#8cc47a; --warn:#e69a5b; --radius:10px; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; }
main { max-width:1500px; margin:0 auto; padding:24px 16px 80px; }
h1 { font-size:28px; margin:0 0 4px; } h2 { font-size:20px; margin:40px 0 12px; } h3 { margin:0; font-size:17px; }
p.lead { color:var(--mute); margin:0 0 20px; max-width:820px; }
.keys { color:var(--mute); font-size:13px; } kbd { background:var(--panel); border:1px solid var(--line); border-radius:4px; padding:0 5px; font:12px ui-monospace, monospace; color:var(--ink); }
.cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:var(--radius); padding:14px; display:flex; flex-direction:column; gap:6px; }
.card .like, .card .meta { color:var(--mute); font-size:13px; }
.chip { align-self:flex-start; font-size:12px; border-radius:99px; padding:1px 8px; border:1px solid currentColor; }
.chip.done { color:var(--good); } .chip.wip { color:var(--warn); }
a.play { margin-top:auto; display:block; text-align:center; background:var(--accent); color:#241a08; font-weight:600; text-decoration:none; border-radius:8px; padding:8px; }
a.play:hover { filter:brightness(1.08); }
.bar { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 12px; }
.bar button { background:var(--panel); color:var(--ink); border:1px solid var(--line); border-radius:99px; padding:5px 12px; font:inherit; font-size:14px; cursor:pointer; }
.bar button[aria-pressed=true] { background:var(--accent); color:#241a08; border-color:var(--accent); }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(440px, 1fr)); gap:12px; }
.grid.motion { grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); }
figure { margin:0; background:var(--panel); border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; }
figure img { display:block; width:100%; height:auto; background:#0b0a09; }
figure.motion img { image-rendering:pixelated; }
figcaption { padding:6px 10px; font-size:13px; color:var(--mute); } figcaption b { color:var(--ink); font-weight:600; }
.missing { aspect-ratio:16/10; display:grid; place-items:center; color:var(--mute); font-size:13px; }
.motion .missing { aspect-ratio:1; }
.ref { display:grid; grid-template-columns:minmax(0, 420px) 1fr; gap:16px; align-items:start; }
.detail { background:var(--panel); border:1px solid var(--line); border-radius:var(--radius); padding:16px; margin-bottom:12px; }
.detail ul { margin:8px 0; padding-left:20px; } .detail a { color:var(--accent); }
details summary { cursor:pointer; color:var(--accent); margin-top:8px; }
pre.bible { white-space:pre-wrap; font:13px/1.5 ui-monospace, monospace; color:var(--ink); background:#100e0c; padding:12px; border-radius:8px; max-height:520px; overflow:auto; }
.extras { display:flex; flex-wrap:wrap; gap:12px; margin-top:10px; } .extras img { max-width:100%; max-height:260px; border-radius:8px; }
@media (max-width:640px) { .grid { grid-template-columns:1fr; } .ref { grid-template-columns:1fr; } }
</style></head><body><main>
<h1>Style lab</h1>
<p class="lead">Five art styles built into the same game, the same four places and the same motions. Play each one, compare one place across every style, and watch the motion side by side. You judge; nothing here is ranked.</p>
<div class="ref"><figure><img src="reference.png" alt="Genshin reference"><figcaption><b>The target:</b> your Genshin fields screenshot</figcaption></figure>
<div class="keys"><p><b>In the game:</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move, hold <kbd>Shift</kbd> to walk, <kbd>E</kbd> talk, <kbd>Q</kbd> <kbd>R</kbd> turn the camera, <kbd>V</kbd> change camera mode, scroll to zoom, <kbd>1</kbd>–<kbd>9</kbd> pick a tool.</p>
<p>Each style opens with <code>?style=</code> already set. Styles marked still working are playable as they stand now.</p></div></div>
<h2>Play</h2><div class="cards" id="play"></div>
<h2>Same place, every style</h2><div class="bar" id="place-bar"></div><div class="bar" id="view-bar"></div><div class="grid" id="places"></div>
<h2>Same motion, every style</h2><div class="bar" id="clip-bar"></div><div class="grid motion" id="clips"></div>
<h2>Each style</h2><div id="details"></div>
<p class="keys">Built ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}. Rebuild with <code>bun tools/style-board.mjs</code> in game-base.</p>
</main>
<script>
const D = ${data};
const local = location.port === '5447' || location.hostname === '127.0.0.1';
const playUrl = (s) => (local ? 'http://127.0.0.1:' + s.port : 'https://' + location.hostname + ':1' + s.port) + '/' + (s.slug === 'base' ? '' : '?style=' + s.slug);
const el = (tag, attrs = {}, html = '') => Object.assign(document.createElement(tag), attrs, html ? { innerHTML: html } : {});
const play = document.getElementById('play');
for (const s of D.styles) {
  const st = D.status[s.slug];
  const c = el('div', { className: 'card' });
  c.append(el('h3', {}, s.name), el('div', { className: 'like' }, s.like));
  if (s.chars) c.append(el('div', { className: 'meta' }, s.chars + '. ' + s.motion + '.'));
  if (s.slug !== 'base') c.append(el('span', { className: 'chip ' + (st.done ? 'done' : 'wip') }, st.done ? 'Finished' : 'Still working'));
  c.append(el('a', { className: 'play', href: playUrl(s), target: '_blank', rel: 'noopener' }, 'Play'));
  play.append(c);
}
function bar(id, items, pick) {
  const b = document.getElementById(id);
  items.forEach(([key, label], i) => {
    const btn = el('button', { type: 'button' }, label);
    btn.setAttribute('aria-pressed', i === 0);
    btn.onclick = () => { b.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === btn)); pick(key); };
    b.append(btn);
  });
}
let place = D.places[0], view = D.views[0][0];
function drawPlaces() {
  const g = document.getElementById('places'); g.replaceChildren();
  for (const s of D.styles) {
    const name = view + '-' + place, has = D.status[s.slug].places.includes(name);
    const f = el('figure');
    f.append(has ? Object.assign(el('a', { href: s.slug + '/places/' + name + '.png', target: '_blank' }), { innerHTML: '<img loading="lazy" src="' + s.slug + '/thumbs/' + name + '.jpg" alt="">' }) : el('div', { className: 'missing' }, 'Not shot yet'));
    f.append(el('figcaption', {}, '<b>' + s.name + '</b>'));
    g.append(f);
  }
}
bar('place-bar', D.places.map((p) => [p, p[0].toUpperCase() + p.slice(1)]), (p) => { place = p; drawPlaces(); });
bar('view-bar', D.views, (v) => { view = v; drawPlaces(); });
drawPlaces();
let clip = D.clips[0];
function drawClips() {
  const g = document.getElementById('clips'); g.replaceChildren();
  for (const s of D.styles) {
    const has = D.status[s.slug].clips.includes(clip);
    const f = el('figure', { className: 'motion' });
    f.append(has ? el('img', { loading: 'lazy', src: s.slug + '/motion/' + clip + '.gif', alt: '' }) : el('div', { className: 'missing' }, clip === 'fish' ? 'No fishing clip in this shoot' : 'Not shot yet'));
    f.append(el('figcaption', {}, '<b>' + s.name + '</b>'));
    g.append(f);
  }
}
bar('clip-bar', D.clips.map((c) => [c, c === 'tool' ? 'Tool swing' : c === 'fish' ? 'Fishing' : c[0].toUpperCase() + c.slice(1)]), (c) => { clip = c; drawClips(); });
drawClips();
const details = document.getElementById('details');
for (const s of D.styles.filter((s) => s.slug !== 'base')) {
  const st = D.status[s.slug];
  const d = el('div', { className: 'detail' });
  d.append(el('h3', {}, s.name + ' <span class="chip ' + (st.done ? 'done' : 'wip') + '">' + (st.done ? 'Finished' : 'Still working') + '</span>'));
  if (s.cost) d.append(el('ul', {}, s.cost.map((c) => '<li>' + c + '</li>').join('')));
  const links = [];
  if (st.done) links.push('<a href="' + s.slug + '/card.png" target="_blank">Full card</a>');
  links.push('<a href="' + playUrl(s) + '" target="_blank">Play</a>');
  d.append(el('div', {}, links.join(' · ')));
  if (st.extras.length) { const x = el('div', { className: 'extras' }); st.extras.forEach((e) => x.append(el('img', { src: s.slug + '/' + e, alt: e, loading: 'lazy' }))); d.append(x); }
  if (st.bible) {
    const det = el('details'); det.append(el('summary', {}, 'How it was made, what it costs, what still looks wrong (STYLE.md)'));
    const pre = el('pre', { className: 'bible' }, 'Loading…'); det.append(pre);
    det.addEventListener('toggle', async () => { if (det.open && pre.dataset.done !== '1') { pre.textContent = await (await fetch(s.slug + '/STYLE.md')).text(); pre.dataset.done = '1'; } });
    d.append(det);
  }
  details.append(d);
}
</script></body></html>
`);
console.log(`wrote ${join(out, 'index.html')}`);
