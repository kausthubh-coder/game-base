// Reproducible Order model review: game materials/sky, hero, concepts, quality levels.
// bun tools/models-5-preview.mjs [port]
import { createServer } from 'vite';
import { launchChrome } from './lib/chrome.mjs';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/world/models-5');
mkdirSync(out, { recursive: true });
const port = Number(process.argv[2] || 5593);
const html = `<!doctype html><html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block}#label{position:absolute;top:18px;left:22px;color:#fff;font:16px sans-serif;text-shadow:0 1px 4px #222}</style><canvas></canvas><div id="label"></div><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import { createProps } from '/src/features/props/index.ts';
import { createSky } from '/src/features/sky/index.ts';
import { calmNoon } from '/src/engine/types.ts';
import { flatWorld } from '/src/engine/world-query.ts';
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});
renderer.setSize(900,760);renderer.toneMapping=THREE.NeutralToneMapping;
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(35,900/760,.1,2000);
const ambient=calmNoon();ambient.cloud=0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const ctx={scene,camera,renderer,ambient,world:flatWorld,quality:'high',time:0};
const sky=createSky(ctx,{shadowRange:100}),props=createProps(ctx,{vary:false});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshLambertMaterial({color:0x75834d}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;scene.add(ground);
const tex=await new THREE.TextureLoader().loadAsync('/assets/sprites/hero.png');tex.colorSpace=THREE.SRGBColorSpace;tex.magFilter=THREE.NearestFilter;tex.repeat.set(128/tex.image.width,128/tex.image.height);tex.offset.set(0,1-128/tex.image.height);
const hero=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));hero.scale.set(2,2,1);hero.center.set(.5,.0625);scene.add(hero);
window.review=(kind,time,quality='high',far=false)=>{
 props.clear();props.place(kind,0,{x:0,y:0,z:0});ctx.quality=quality;props.setQuality(quality);sky.setQuality(quality);ambient.timeOfDay=time;
 const dims={chapel:[10,14,13],orderPump:[3,3,4],orderEngine:[12,8,10],watchPost:[6,6,10],dawnDome:[120,120,60]}[kind];
 const size=Math.max(...dims),target=new THREE.Vector3(0,dims[2]*.44,0);
 if(far){camera.position.set(30,30,440);target.set(0,28,0);hero.position.set(24,28,410);}
 else{camera.position.set(size*1.5,size*1.22,size*2.2);hero.position.set(-dims[0]/2-1.2,0,dims[1]/2);}
 camera.lookAt(target);camera.updateMatrixWorld();
 for(let i=0;i<60;i++){sky.update(1/30,ctx);props.update(1/30,ctx);}renderer.render(scene,camera);
 document.querySelector('#label').textContent=kind+' · '+quality+' · '+(far?'440m · ':'')+(time>.8?'night':time>.7?'dusk':'day')+' · hero 1.8m';
 return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,props:props.stats()};
};
</script></html>`;
const server = await createServer({root,configFile:false,publicDir:resolve(root,'public'),server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'order-review',configureServer(s){s.middlewares.use('/models-5',(_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});}}]});
await server.listen();console.log(`Order review pid ${process.pid}, port ${port}`);
const browser=await launchChrome({headless:true});
try {
 const page=await (await browser.newContext({viewport:{width:900,height:760}})).newPage();const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${port}/models-5`);await page.waitForFunction(()=>window.review);
 const stats=[];
 for(const kind of ['chapel','orderPump','orderEngine','watchPost','dawnDome']){
  for(const [name,time,quality,far] of [['day',.42,'high',false],['night',.92,'high',false],['low',.42,'low',false],['medium',.42,'medium',false],...(kind==='dawnDome'?[['far-noon',.5,'high',true],['far-dusk',.76,'high',true]]:[])]){
   const counts=await page.evaluate(([k,t,q,f])=>window.review(k,t,q,f),[kind,time,quality,far]);stats.push({kind,name,...counts});
   await page.screenshot({path:resolve(out,kind+'-'+name+'.png')});
  }
  const concept=await sharp(resolve(root,'assets-src/concept/5-order',kind+'.webp')).resize(900,760,{fit:'contain',background:'#f7efdf'}).png().toBuffer();
  await sharp({create:{width:1800,height:760,channels:3,background:'#f7efdf'}}).composite([{input:resolve(out,kind+'-day.png'),left:0,top:0},{input:concept,left:900,top:0}]).png().toFile(resolve(out,kind+'-comparison.png'));
 }
 writeFileSync(resolve(out,'render-counts.json'),JSON.stringify({stats,errors},null,2));
 if(errors.length)throw Error(errors.join('\n'));console.log('Order comparisons, day/night and quality fixtures passed; no console errors.');
} finally {await browser.close();await server.close();}
