import fs from 'node:fs/promises';
import sharp from 'sharp';
const folder = new URL('../', import.meta.url).pathname;
const root = new URL('../../../../../', import.meta.url).pathname;
const out = `${root}.artifacts/opening/sprites/`;
await fs.mkdir(out, { recursive: true });
const m = JSON.parse(await fs.readFile(`${folder}sprites.json`));
const hero = await sharp(`${root}public/assets/sprites/hero.png`).extract({ left: 0, top: 0, width: 128, height: 128 }).png().toBuffer();
const entries = [];
for (const [name, s] of Object.entries(m.sprites)) for (const [action, a] of Object.entries(s.actions)) {
  const frames = [];
  for (const [x, y] of a.frames) frames.push(await sharp(`${folder}${s.sheet}`).extract({ left: x * 128, top: y * 128, width: 128, height: 128 }).png().toBuffer());
  entries.push({ name, action, frames, fps: a.fps, height: s.worldHeight });
}
for (const [label, bg, fg] of [['dark', '#28232c', '#fff0cf'], ['light', '#eee4cd', '#493335'], ['green', '#637b42', '#fff0cf']]) {
  const layers = [];
  const labels = [];
  for (let row = 0; row < entries.length; row++) {
    const e = entries[row];
    labels.push(`<text x="12" y="${row * 168 + 20}">${e.name} / ${e.action}</text>`);
    layers.push({ input: hero, left: 12, top: row * 168 + 28 });
    for (let i = 0; i < e.frames.length; i++) layers.push({ input: e.frames[i], left: 156 + i * 140, top: row * 168 + 28 });
  }
  const svg = `<svg width="1024" height="${entries.length * 168}"><style>text{font:14px monospace;fill:${fg}}</style>${labels.join('')}</svg>`;
  await sharp({ create: { width: 1024, height: entries.length * 168, channels: 4, background: bg } }).composite([...layers, { input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(`${out}all-frames-${label}.png`);
  // One metre occupies the same number of pixels in this second comparison.
  const worldLayers = [{ input: hero, left: 0, top: 32 }];
  for (const [i, s] of Object.values(m.sprites).entries()) {
    const side = Math.round(128 * s.worldHeight / 2);
    const frame = await sharp(`${folder}${s.sheet}`).extract({ left: 0, top: 0, width: 128, height: 128 }).resize(side, side, { kernel: 'nearest' }).png().toBuffer();
    worldLayers.push({ input: frame, left: 144 * (i + 1), top: 152 - Math.round(120 * side / 128) });
  }
  await sharp({ create: { width: 720, height: 168, channels: 4, background: bg } }).composite(worldLayers).png().toFile(`${out}world-scale-${label}.png`);
}
const grey = entries.find(e => e.name === 'grey-coat' && e.action === 'walk');
for (let i = 0; i < grey.frames.length; i++) await fs.writeFile(`${out}walk-${i}.png`, grey.frames[i]);
const cards = entries.map(e => {
  const s = m.sprites[e.name];
  return `<figure><figcaption>${e.name} / ${e.action}, ${e.fps} fps</figcaption><canvas width="128" height="128" data-name="${e.name}" data-action="${e.action}"></canvas></figure>`;
});
const images = {};
for (const [name, s] of Object.entries(m.sprites)) images[name] = `data:image/png;base64,${(await fs.readFile(`${folder}${s.sheet}`)).toString('base64')}`;
const html = `<!doctype html><meta charset="utf-8"><title>Opening sprite review</title><style>body{background:#28232c;color:#fff0cf;font:16px monospace}main{display:flex;flex-wrap:wrap}canvas{width:256px;height:256px;image-rendering:pixelated;background:#eee4cd}figure{margin:12px}button{padding:12px}</style><h1>Opening sprite actions</h1><button onclick="paused=!paused">Pause / play</button><main>${cards.join('')}</main><script>const sheets=${JSON.stringify(images)},manifest=${JSON.stringify(m)},loaded={};let paused=false,time=0,last=0;for(const [n,src]of Object.entries(sheets)){loaded[n]=new Image();loaded[n].src=src}function draw(now){if(!paused)time+=(now-last)/1000;last=now;for(const c of document.querySelectorAll('canvas')){const s=manifest.sprites[c.dataset.name],a=s.actions[c.dataset.action],n=Math.floor(time*a.fps)%a.frames.length,[x,y]=a.frames[n],ctx=c.getContext('2d');ctx.clearRect(0,0,128,128);if(loaded[c.dataset.name].complete)ctx.drawImage(loaded[c.dataset.name],x*128,y*128,128,128,0,0,128,128)}requestAnimationFrame(draw)}requestAnimationFrame(draw)</script>`;
await fs.writeFile(`${out}review.html`, html);
console.log('Wrote all-frames-{dark,light,green}.png, world-scale comparisons, walk frames, review.html');
