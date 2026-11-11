// The whole cast lined up in front of the camera, for a close look at the 3D models or the sprites: every person,
// the leaftail, a mossling and a lanternfly, one row, at noon, with the rules stopped.
//   bun tools/chars-lineup.mjs --url http://127.0.0.1:5384/ --out .artifacts/chars/lineup.png
//     [--chars models|sprites] [--anim idle|walk|tool|talk] [--cam shoulder|horizon] [--turn 0..3] [--quality high]
//     [--clip x,y,w,h]   crops the shot to that part of the page
// It fails on a console error. It prints the cast's draw calls and triangles.
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const url = opt('url', 'http://127.0.0.1:5384/');
const out = opt('out', '.artifacts/chars/lineup.png');
const chars = opt('chars', 'models');
const anim = opt('anim', 'idle');
const cam = opt('cam', '');
const turn = Number(opt('turn', 0));
const quality = opt('quality', 'high');

const browser = await launchChrome({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: Number(opt('w', 1440)), height: Number(opt('h', 900)) } })).newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${url}?hold=1&quality=${quality}&chars=${chars}${cam ? '&cam=' + cam : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game !== undefined);
const counts = await page.evaluate(async ({ anim, turn }) => {
  const g = window.__game;
  g.newGame();
  g.manual(true);
  g.view.game.systems.time?.setWeather('clear');
  g.setTime(0.5);
  g.advance(0.2);
  const at = g.teleport('grant.stone');
  for (let i = 0; i < turn; i++) g.turn(1);
  await g.settle();
  // Everyone in a row across the view, facing the camera, a step in front of the hero.
  const actors = [...g.view.game.actors.values()];
  const pick = (prefix) => actors.filter((a) => a.id.startsWith(prefix));
  const row = [...pick('npc:'), ...pick('pet:'), ...pick('creature:')];
  const yaw = g.view.camera.yaw ?? 0;
  const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw), backX = Math.sin(yaw), backZ = Math.cos(yaw);
  const ground = (x, z) => { for (let y = 120; y > 0; y--) if (g.block(x, y, z).key && g.block(x, y, z).key !== 'air') return y + 1; return at.y; };
  row.forEach((a, i) => {
    const across = (i - (row.length - 1) / 2) * 1.15;
    const x = at.x + rightX * across + backX * 2.5, z = at.z + rightZ * across + backZ * 2.5;
    a.pos.x = x; a.pos.z = z; a.pos.y = ground(Math.floor(x), Math.floor(z));
    a.facing = Math.PI - yaw;
    a.anim = a.id.startsWith('creature:lanternfly') ? 'flutter' : anim;
    a.visible = true;
  });
  const player = g.view.game.actors.get('player');
  g.view.camera.zoomBy?.(-2);
  await g.frames(30);
  return { row: row.map((a) => a.id), counters: g.counters(), state: g.state().characters, player: player?.anim };
}, { anim, turn });
const clip = opt('clip', '');
const [cx, cy, cw, ch] = clip ? clip.split(',').map(Number) : [];
await page.screenshot({ path: out, ...(clip ? { clip: { x: cx, y: cy, width: cw, height: ch } } : {}) });
console.log(JSON.stringify(counts));
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);
