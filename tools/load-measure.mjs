// Production load audit. Run after bun run build. A fresh context per pair, reused for visit two.
// bun tools/load-measure.mjs [--folder dist] [--out .artifacts/load/after.json] [--runs 5]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright-core';
const args = process.argv.slice(2);
const opt = (k, d) => args.includes('--'+k) ? args[args.indexOf('--'+k)+1] : d;
const folder = resolve(opt('folder', 'dist')), output = opt('out', '.artifacts/load/after.json');
const port = Number(opt('port', '5550'));
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png','.webp':'image/webp','.woff2':'font/woff2', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
const headers = await readFile(resolve(folder, '_headers'), 'utf8').catch(() => '');
const immutable = new Set([...headers.matchAll(/^([^\n *]+)\n  Cache-Control: public, max-age=31536000, immutable/gm)].map(m => m[1]));
let hits = [], timeline = [], visitStart = Date.now();
const server = createServer(async (req,res) => {
  const path = new URL(req.url, 'http://local').pathname;
  hits.push(path); const transfer={url:path,startMs:Date.now()-visitStart,startEpochMs:Date.now(),bytes:0,status:0}; timeline.push(transfer);
  try {
    const file = resolve(folder, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(folder+'/')) throw Error('outside');
    let body = await readFile(file);
    const type = types[extname(file)] || 'application/octet-stream';
    const h = { 'content-type':type, 'cache-control':(immutable.has(path) || (headers.includes('/assets/fingerprinted/*') && path.startsWith('/assets/fingerprinted/'))) ? 'public, max-age=31536000, immutable' : 'no-cache' };
    if (/javascript|json|text\/|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) { body = gzipSync(body); h['content-encoding']='gzip'; }
    transfer.bytes=body.length; transfer.status=200; res.writeHead(200,h).end(body);
  } catch { transfer.bytes=7; transfer.status=404; res.writeHead(404).end('missing'); }
});
await new Promise(r => server.listen(port,'127.0.0.1',r));
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required'] });
const runs = [];
try {
  for (let run=0; run<Number(opt('runs','5')); run++) {
    const context = await browser.newContext({viewport:{width:1280,height:800}});
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__loadFrame = null;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = fn => raf(t => {
        fn(t);
        if (window.__loadFrame === null && window.__game?.started && window.__loadOrigin && Math.hypot(window.__game.state().player.x-window.__loadOrigin.x,window.__game.state().player.z-window.__loadOrigin.z)>0.01 && !document.querySelector('#loading')) window.__loadFrame=performance.now();
      });
    });
    for (let visit=1;visit<=2;visit++) {
      hits=[]; timeline=[]; visitStart=Date.now();
      const errors=[];
      const onError = e => errors.push(String(e));
      page.on('pageerror',onError);
      const badResponse = r => { if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`); };
      page.on('response',badResponse);
      await page.goto(`http://127.0.0.1:${port}/?hold=1&sw=1`,{waitUntil:'load',timeout:180000});
      await page.waitForFunction(() => window.__game && !document.querySelector('#loading'),null,{timeout:180000});
      await page.evaluate(() => { window.__game.newGame(); window.__loadOrigin=window.__game.state().player; window.__game.key('w',true); });
      await page.waitForFunction(() => window.__loadFrame !== null,null,{timeout:180000});
      const first = await page.evaluate(() => { window.__game.key('w',false); return window.__loadFrame; });
      await page.evaluate(() => window.__game.settle());
      await page.waitForLoadState('networkidle', {timeout:60000});
      await page.waitForTimeout(1500);
      const resources=await page.evaluate(() => [...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')].map(r => ({url:r.name,start:r.startTime,end:r.responseEnd,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize})).sort((a,b)=>a.start-b.start));
      const before=resources.filter(r=>r.start<=first);
      const firstEpoch=await page.evaluate(t=>performance.timeOrigin+t,first);
      const networkBefore=timeline.filter(r=>r.startEpochMs<=firstEpoch);
      // Count actual server response bodies, including worker fetches and the favicon. ResourceTiming hides network bytes forwarded by a worker.
      const row={run:run+1,visit,firstFrameMs:first,bytes:networkBefore.reduce((s,r)=>s+r.bytes,0),requests:networkBefore.length,resourceBytes:before.reduce((s,r)=>s+r.transfer,0),resourceRequests:before.length,network:[...hits],networkTimeline:[...timeline],errors,resources};
      runs.push(row);
      console.log(JSON.stringify({run:row.run,visit,bytes:row.bytes,requests:row.requests,network:row.network.length,errors}));
      page.off('pageerror',onError); page.off('response',badResponse);
      if (await page.evaluate(() => 'serviceWorker' in navigator)) {
        await page.evaluate(async () => { const r=await navigator.serviceWorker.getRegistration(); if(r) await navigator.serviceWorker.ready; });
      }
    }
    await context.close();
  }
  await mkdir(resolve(output,'..'),{recursive:true});
  await writeFile(output,JSON.stringify({method:'Chrome 1280x800, local gzip server, no throttling; first drawn RAF after horizontal player movement from held W proves input and near-terrain simulation work; collect later requests through terrain settle, network idle and 1.5 seconds before revisiting; server gzip response-body bytes and network requests begun by that callback, excluding HTTP headers; resource timings also included; fresh context per pair',runs},null,2));
  if(runs.some(r=>r.errors.length || r.resources.some(x=>x.encoded===0 && x.transfer>300))) process.exitCode=1;
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
