// Check the new prop library in the built demo at the task's assigned address.
import { launchChrome } from '../lib/chrome.mjs';
import fs from 'node:fs/promises';
const browser=await launchChrome({headless:true,args:[]});
const page=await browser.newPage({viewport:{width:1100,height:750}}),errors=[],rows=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try {
 for(const kind of ['pastureFence','footbridge','mossStump','wildflowers','hayBale','harvestStall']) {
  await page.goto('http://127.0.0.1:5352/?only='+kind+'&shots=1&panel=0');
  await page.waitForFunction(()=>window.__props);
  for(const quality of ['low','medium','high']) {
   const counters=await page.evaluate(quality=>{const d=window.__props;d.apply({quality,paused:true,time:.42,angle:.5});d.advance(1);return d.render()},quality);
   rows.push({kind,quality,counters});
   await page.screenshot({path:`.artifacts/assets/props/${kind}-${quality}.png`});
  }
 }
 if(errors.length)throw Error(errors.join('\n'));
 await fs.writeFile('.artifacts/assets/props/quality.json',JSON.stringify(rows,null,2)+'\n');
 console.log('PASS six new prop turntables at low, medium, high; no console errors');
} finally {await browser.close()}
