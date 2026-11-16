// Presentation-only replay of unedited earned checkpoints. No rewards are supplied.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { createKeyboardSteering } from './lib/keyboard-steering.mjs';
const root = resolve(import.meta.dirname, '..');
const input = resolve(process.argv[2]);
const out = resolve(process.argv[3]);
mkdirSync(out, { recursive: false });
const port = Number(process.env.PLAY_PORT || 5559);
const dist = process.env.ECHO_DIST || 'dist-bench-copper';
let browser, server;
const errors = [], results = [];
async function walkToBees(page) {
 const route = await page.evaluate(() => { const g=window.__game.view.game; const to={x:17.5,y:22,z:-229.5}; return g.systems.nav.path(g.player.pos,to,20000); });
 if (!route?.length) throw Error('No walkable route to earned bee field');
 const steer = createKeyboardSteering();
 for (const goal of route) {
  let arrived=false;
  for(let i=0;i<80;i++) {
   const {p,yaw}=await page.evaluate(()=>({p:window.__game.state().player,yaw:window.__game.view.camera.yaw}));
   const dx=goal.x-p.x,dz=goal.z-p.z;
   if(Math.hypot(dx,dz)<.22){arrived=true;break;}
   const d=steer(dx,dz,yaw);
   const keys=[...(d.forward>0?['KeyW']:d.forward<0?['KeyS']:[]),...(d.right>0?['KeyD']:d.right<0?['KeyA']:[])];
   try {for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(50);}
   finally {for(const key of keys)await page.keyboard.up(key);}
  }
  if(!arrived)throw Error('Walk to bees stalled at '+JSON.stringify(goal));
 }
 return route;
}
try {
 server = spawn('bun', ['tools/serve.mjs', dist, String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
 await new Promise((done, fail) => { server.stdout.on('data', b => { if (/pid \d+/.test(String(b))) done(); }); server.on('exit', c => fail(Error('server exited ' + c))); });
 browser = await launchChrome();
 for (const quality of ['high', 'low']) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  for (const name of ['middle-memory', 'pre-dinner', 'earned-echo']) {
   await page.goto(`http://127.0.0.1:${port}/?quality=${quality}`);
   await page.evaluate(raw => localStorage.setItem('greenhollow.save', raw), readFileSync(resolve(input, name + '.save.json'), 'utf8'));
   await page.reload(); await page.waitForFunction(() => !!window.__game);
   await page.getByRole('button', { name: 'Begin', exact: true }).click();
   await page.waitForFunction(() => window.__game.state().started && !window.__game.state().player.busy);
   await page.waitForTimeout(2000);
   if (name === 'middle-memory') {
    await page.keyboard.press('KeyM');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await page.waitForTimeout(500);
   }
   if (name === 'pre-dinner') {
    await page.waitForFunction(() => window.__game.state().prompt === 'Sit down to dinner');
    await page.keyboard.press('KeyE');
    await page.getByRole('button', { name: "Grant Gus's wish", exact: true }).waitFor();
   }
   await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('.hp-portrait *')].map(async element => {
     const match = /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(element).backgroundImage);
     if (!match) return;
     const image = new Image(); image.src = match[1]; await image.decode();
    }));
   });
   const shot = `${quality}-${name}.png`;
   await page.screenshot({ path: resolve(out, shot) });
   results.push({ quality, name, shot, state: await page.evaluate(() => window.__game.state()) });
   console.log('ok', shot);
   if(name==='earned-echo') {
    const route=await walkToBees(page);
    await page.waitForTimeout(500);
    const shot=quality+'-bees.png';
    await page.screenshot({path:resolve(out,shot)});
    results.push({quality,name:'bees',shot,route,state:await page.evaluate(()=>window.__game.state())});
    console.log('ok',shot);
   }
  }
  await context.close();
 }
 if (errors.length) throw Error(errors.join('\n'));
} finally {
 await browser?.close();
 if (server && server.exitCode === null) { server.kill(); await new Promise(r => server.once('exit', r)); }
 writeFileSync(resolve(out, 'presentation.json'), JSON.stringify({ errors, results }, null, 2));
}
