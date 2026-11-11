// Rebuild with one changed pixel while the same browser retains the previous deployment's cache.
// The approved source sprite is restored even on failure; dist is rebuilt to match it afterward.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
const port=Number(process.env.LOAD_PORT || 5554), root=resolve('.artifacts/load/proof-dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg'};
let hits=[];
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://x').pathname; hits.push(path);
 try { const file=resolve(root,'.'+(path==='/'?'/index.html':path)); if(!file.startsWith(root+'/')) throw Error();
 res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':path.includes('/fingerprinted/')?'public, max-age=31536000, immutable':'no-cache'}).end(await readFile(file));
 } catch {res.writeHead(404).end();}
});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
const source=resolve('public/assets/sprites/hero.png'), original=await readFile(source);
const build=()=>{const p=spawnSync('bun',['run','build','--outDir',root],{stdio:'pipe'});if(p.status!==0)throw Error(p.stderr.toString());};
build();
const report={};
try {
 const context=await browser.newContext({viewport:{width:800,height:600}}), page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const load=async()=>{await page.goto(`http://127.0.0.1:${port}/?hold=1&sw=1`,{waitUntil:'load',timeout:180000});await page.waitForFunction(()=>window.__game&&!document.querySelector('#loading'),null,{timeout:180000});await page.evaluate(()=>window.__game.newGame());await page.evaluate(()=>window.__game.settle());await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);};
 await load();
 const oldManifest=JSON.parse(await readFile(resolve(root,'assets/manifest.json'),'utf8')); report.old=oldManifest.sprites.hero.sheet;
 await page.waitForFunction(async path => !!await (await caches.open('game-assets-v1')).match(new URL('assets/'+path,location.href)),report.old,{timeout:60000});
 report.oldCached=true;
 const {data,info}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // Change one visible pixel, leaving dimensions and every other pixel intact.
 const pixel=data.findIndex((v,i)=>i%4===3&&v===255)-3; data[pixel]^=1;
 await writeFile(source,await sharp(data,{raw:info}).png().toBuffer()); build();
 const next=JSON.parse(await readFile(resolve(root,'assets/manifest.json'),'utf8'));report.new=next.sprites.hero.sheet;
 // Add a page marker to prove this navigation fetched the new HTML despite the old controller.
 const html=await readFile(resolve(root,'index.html'),'utf8');await writeFile(resolve(root,'index.html'),html.replace('</head>','<meta name="cache-proof" content="new-deploy"></head>'));
 hits=[];await load();report.network=[...hits];report.pageMarker=await page.locator('meta[name=cache-proof]').getAttribute('content');
 report.newFetched=hits.includes('/assets/'+report.new);
 report.cachedOldStatus=await page.evaluate(async path => (await fetch('assets/'+path)).status,report.old);
 report.oldRequestedFromNetwork=hits.includes('/assets/'+report.old);report.pageFetched=hits.some(p=>p==='/');
 await page.keyboard.press('Shift');
 await page.evaluate(()=>{ window.__game.teleport('tamsin'); window.__game.advance(0.1); window.__game.interact(); });
 await page.waitForFunction(()=>window.__voice?.log.some(r=>r.http===200&&r.decoded>0&&['playing','ended'].includes(r.status)),null,{timeout:60000});
 report.voice=await page.evaluate(()=>window.__voice.log);report.errors=errors;
 report.pass=report.cachedOldStatus===200&&!report.oldRequestedFromNetwork&&report.old!==report.new&&report.newFetched&&report.pageFetched&&report.pageMarker==='new-deploy'&&errors.length===0;
 await page.goto(`http://127.0.0.1:${port}/?nosw`,{waitUntil:'load',timeout:180000});
 await page.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()));report.noswUnregistered=true;
 console.log(JSON.stringify(report,null,2));
 if(!report.pass)process.exitCode=1;
} finally {
 await writeFile(source,original);build();await browser.close();await new Promise(r=>server.close(r));
 await mkdir('.artifacts/load',{recursive:true});await writeFile('.artifacts/load/cache-proof.json',JSON.stringify(report,null,2));
}
