// Run after building and serving the game. No game writes beyond the documented debug door.
import { cameraStill } from './wait.mjs';
import { launchChrome } from '../lib/chrome.mjs';
const browser = await launchChrome();
let failures = 0;
const fixed = process.argv.includes('--fixed');
const farm = process.argv.includes('--farm');
try {
 for (let run = 1; run <= 5; run++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://127.0.0.1:${process.env.PLAY_PORT || 5995}/?hold=1${farm ? "#farm" : ""}`);
  await page.waitForFunction(() => window.__game);
  await page.evaluate(async () => { const g=window.__game; g.newGame(); g.manual(true); if (location.hash === '#farm') g.teleport(-17.6, 22, -231.6); await g.settle(); g.turn(1); await g.frames(12); g.turn(-1); await g.settle(); await g.frames(3); });
  if (fixed) await cameraStill(page);
  const target = await page.evaluate(() => { const g=window.__game,p=g.state().player; const farm=location.hash === "#farm"; const x=farm ? -20 : Math.floor(p.x)+2,z=farm ? -236 : Math.floor(p.z)+1,y=g.view.world.sim.heightAt(x,z)-1; return {x,y,z,at:g.view.project(x+.5,y+1,z+.5)}; });
  await page.mouse.move(target.at.x,target.at.y);
  await page.evaluate(() => window.__game.frames(2));
  const aim = await page.evaluate(t=>({aim:window.__game.state().aim,projectedNow:window.__game.view.project(t.x+.5,t.y+1,t.z+.5)}),target);
  await page.evaluate(()=>window.__game.manual(false));
  const before=await page.evaluate(()=>window.__game.state().player);
  await page.keyboard.down('KeyW'); if (fixed) await page.waitForFunction(p => { const q=window.__game.state().player; return Math.hypot(q.x-p.x,q.z-p.z) > .5; },before); else await page.evaluate(()=>window.__game.frames(4)); await page.keyboard.up('KeyW');
  const after=await page.evaluate(()=>window.__game.state().player);
  const walked = Math.hypot(after.x-before.x,after.z-before.z);
  const aimed = aim.aim && ['x','y','z'].every(k => aim.aim[k] === target[k]);
  if (!aimed || walked <= .5) failures++;
  console.log(JSON.stringify({run,target,...aim,walked,aimed}));
  await page.close();
 }
} finally { await browser.close(); }

console.log(`${failures ? "FAIL" : "PASS"}: ${failures}/5 trials failed`);
process.exitCode = failures ? 1 : 0;
