// Close shots of the animations, in one sheet: the hero walking (Shift held), running, working with the hoe, and
// Tamsin talking in a conversation, plus the hero hidden as the first-person camera will hide him.
//   bun tools/chars-anims.mjs --url http://127.0.0.1:5384/ --out .artifacts/chars/anims [--chars models|sprites] [--cam shoulder]
// It writes <name>.png for each shot and sheet.png, and fails on a console error.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const url = opt('url', 'http://127.0.0.1:5384/');
const out = resolve(opt('out', '.artifacts/chars/anims'));
const chars = opt('chars', 'models');
const cam = opt('cam', '');
mkdirSync(out, { recursive: true });

const browser = await launchChrome({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const game = (js, arg) => page.evaluate(js, arg);
await page.goto(`${url}?hold=1&quality=high&chars=${chars}${cam ? '&cam=' + cam : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game !== undefined);
await game(async () => {
  const g = window.__game;
  g.newGame();
  g.view.game.systems.time?.setWeather('clear');
  g.setTime(0.45);
  g.advance(0.2);
  g.view.camera.zoomBy?.(-2);
  await g.settle();
});

/** A crop around where the hero is drawn, or around an actor. */
async function shoot(name, id = 'player', lift = 0) {
  const at = await game((id) => {
    const g = window.__game;
    const a = g.view.game.actors.get(id);
    const p = id === 'player' ? g.view.playerPosition : a.pos;
    return g.view.project(p.x, p.y + 1, p.z);
  }, id);
  const w = 380, h = 380;
  const x = Math.max(0, Math.min(1200 - w, Math.round(at.x - w / 2))), y = Math.max(0, Math.min(800 - h, Math.round(at.y - h / 2 - lift)));
  await page.screenshot({ path: resolve(out, name + '.png'), clip: { x, y, width: w, height: h } });
  console.log(`${name}.png`);
}

const shots = [];
// Walking and running across the open grass by the stone. The keys move the hero relative to the camera.
await game(async () => {
  const g = window.__game;
  g.teleport('grant.stone');
  const p = g.view.game.player.pos;
  g.teleport(p.x + 6, p.z + 3);
  g.key('shift', true);
  g.key('d', true);
  await g.frames(24);
});
await shoot('walk'); shots.push('walk');
await game(async () => {
  const g = window.__game;
  g.key('shift', false);
  await g.frames(24);
});
await shoot('run'); shots.push('run');
await game(async () => {
  const g = window.__game;
  g.key('d', false);
  await g.frames(10);
  // Working: the rules are stopped and the hero's actor is set as the body sets it while breaking.
  g.manual(true);
  const hero = g.view.game.actors.get('player');
  hero.sprite = 'hero-swing';
  hero.anim = 'tool';
  await g.frames(10);
});
await shoot('tool'); shots.push('tool');
// Talking: open the conversation with Tamsin and hold on her first line.
await game(async () => {
  const g = window.__game;
  g.manual(false);
  const hero = g.view.game.actors.get('player');
  hero.sprite = 'hero'; hero.anim = 'idle';
  const tamsin = g.view.game.actors.get('npc:tamsin');
  g.teleport(tamsin.pos.x + 1.6, tamsin.pos.z + 0.6);
  g.advance(0.3);
  g.interact();
  await g.frames(30);
});
const talking = await game(() => window.__game.view.game.systems.talk?.current()?.npc ?? null);
console.log(`talking to: ${talking}`);
// Above the dialogue box.
await shoot('talk', 'npc:tamsin', 140); shots.push('talk');
// Hidden, as the first-person camera will hide the hero: nothing of him is drawn, in either look.
const hidden = await game(async () => {
  const g = window.__game;
  g.talkThrough();
  g.manual(true);
  g.view.game.actors.get('player').visible = false;
  await g.frames(4);
  const drawn = [];
  g.view.scene.traverse((o) => { if (o.isInstancedMesh && o.name.startsWith('toon-') && o.visible) drawn.push(`${o.name} ${o.count}`); });
  return { toon: drawn, sprites: g.counters().sprites };
});
console.log(`hero hidden: ${JSON.stringify(hidden)}`);
await shoot('hidden'); shots.push('hidden');

const W = 380, GAP = 6;
const label = (text) => Buffer.from(`<svg width="${W}" height="30"><rect width="100%" height="100%" fill="#000" fill-opacity="0.55"/>`
  + `<text x="10" y="21" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#fff">${text}</text></svg>`);
const parts = [];
for (const [i, name] of shots.entries()) {
  parts.push({ input: resolve(out, name + '.png'), left: i * (W + GAP), top: 0 });
  parts.push({ input: label(`${chars}: ${name}`), left: i * (W + GAP), top: 0 });
}
await sharp({ create: { width: shots.length * (W + GAP) - GAP, height: 380, channels: 3, background: '#111' } }).composite(parts).png().toFile(resolve(out, 'sheet.png'));
console.log(`wrote ${resolve(out, 'sheet.png')}`);
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);
