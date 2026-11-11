import { launchChrome } from '../lib/chrome.mjs';
const browser = await launchChrome({ args: ['--autoplay-policy=no-user-gesture-required'] });
let missed = 0;
const fixed = process.argv.includes('--fixed');
try {
 for (let run=1;run<=5;run++) {
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${process.env.PLAY_PORT || 5995}/?hold=1&quality=low`);
  await page.waitForFunction(()=>window.__game);
  await page.evaluate(()=>window.__game.newGame());
  await page.keyboard.press('KeyQ');
  await page.evaluate(()=>window.__game.settle());
  await page.route('**/*.mp3', async route => { await new Promise(resolve=>setTimeout(resolve,300)); await route.continue(); });
  await page.evaluate(()=>{
   window.__sample={partial:false,full:false,frames:0};
   const tick=()=>{const s=window.__sample,t=document.querySelector('.gb-dialogue-typed')?.textContent??'',r=document.querySelector('.gb-dialogue-untyped')?.textContent??'';
    if(t.length+r.length){s.frames++;s.partial ||= t.length>0&&r.length>0;s.full ||= r.length===0;}
    if(!s.full)requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
   window.__game.view.game.systems.talk.start('tamsin.meet','tamsin');
  });
  const early=await page.evaluate(async ()=>{await window.__game.frames(3); return {...window.__sample};});

  await page.waitForFunction(()=>window.__sample.partial||window.__sample.full,null,{timeout:15000});
  const eventual = await page.evaluate(()=>({...window.__sample,voice:window.__voice?.log.at(-1)}));
  if (!(fixed ? eventual : early).partial) missed++;
  console.log(JSON.stringify({run,early,eventual}));
  await page.close();
 }
} finally {await browser.close();}
console.log(`${missed ? "FAIL" : "PASS"}: ${missed}/5 typing samples missed partial text`);
process.exitCode = missed ? 1 : 0;
