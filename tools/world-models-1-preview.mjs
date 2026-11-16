// Run against this worktree's Vite: bun tools/world-models-1-preview.mjs http://localhost:5424
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { launchChrome } from './lib/chrome.mjs';
import assert from 'node:assert/strict';
import { buildProp, propExtras } from '../src/features/props/build.ts';
const measures = {};
for (const [kind, variants, bounds] of [['highRoadArch',3,[12,7.1,14]],['roadStair',1,[8,8.1,15]],['roadPylon',2,[6,6,30]],['fallenSpan',1,[14,8,5]]]) {
 for (let v=0;v<variants;v++) {
  const g=buildProp(kind,v), b=g.boundingBox, e=propExtras(g);
  assert(b.min.y>=-0.001 && b.max.y<=bounds[2]+0.001);
  assert(b.max.x-b.min.x<=bounds[0]+0.001 && b.max.z-b.min.z<=bounds[1]+0.001);
  assert(e.triangles<=6000);
  measures[kind+'-'+v]={triangles:e.triangles,min:b.min.toArray(),max:b.max.toArray(),lights:e.lights.length/3};
 }
}
assert.deepEqual(buildProp('highRoadArch',0).getAttribute('position').array,buildProp('highRoadArch',1).getAttribute('position').array);
const out = '.artifacts/world/models-1';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/geometry.json`,JSON.stringify(measures,null,2));
const source = `
import * as T from '/node_modules/three/build/three.module.js';
import {createProps} from '/src/features/props/index.ts';
import {createSky} from '/src/features/sky/index.ts';
import {calmNoon} from '/src/engine/types.ts';
import {flatWorld} from '/src/engine/world-query.ts';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(960,720); renderer.toneMapping=T.NeutralToneMapping;
document.body.append(renderer.domElement);
const scene=new T.Scene(); scene.background=new T.Color(0xcbd9e1);
const camera=new T.PerspectiveCamera(30,960/720,.1,1000);
const ctx={scene,camera,renderer,ambient:calmNoon(),world:flatWorld,quality:'high',time:0};
const sky=createSky(ctx,{shadowRange:70}); const props=createProps(ctx,{vary:false});
const ground=new T.Mesh(new T.PlaneGeometry(220,220),new T.MeshStandardMaterial({color:0x89936b,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.05;ground.receiveShadow=true;scene.add(ground);
const tex=await new T.TextureLoader().loadAsync('/assets/sprites/hero.png');
tex.colorSpace=T.SRGBColorSpace; tex.magFilter=T.NearestFilter;tex.repeat.set(128/tex.image.width,128/tex.image.height);tex.offset.set(0,1-128/tex.image.height);
const hero=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,alphaTest:.1}));hero.scale.set(2.2,2.2,1);scene.add(hero);
window.show=(kind,variant=0,night=false,quality='high')=>{
props.clear();ctx.quality=quality;props.setQuality?.(quality);sky.setQuality?.(quality);ctx.ambient.timeOfDay=night?.92:.42;
let target=new T.Vector3(0,6,0), distance=44;
if(kind==='vista'){
 for(let i=0;i<5;i++)props.place('highRoadArch',i===4?2:i===2?1:0,{x:(i-2)*12,y:0,z:0});
 props.place('roadStair',0,{x:-17,y:0,z:7.5},-Math.PI/2);
 props.place('roadPylon',0,{x:18,y:0,z:-8});props.place('fallenSpan',0,{x:16,y:0,z:12});
 target.set(0,8,0);distance=100;hero.position.set(-19,1.05,12);
}else{
 props.place(kind,variant,{x:0,y:0,z:0});
 if(kind==='roadPylon'){target.y=14;distance=64;hero.position.set(-4,1.05,4);}
 else if(kind==='fallenSpan'){target.y=2;distance=30;hero.position.set(-7,1.05,4);}
 else{hero.position.set(kind==='roadStair'?-4:-6,1.05,6);}
}
camera.position.copy(target).add(new T.Vector3(.48,.48,.83).normalize().multiplyScalar(distance));camera.lookAt(target);camera.updateMatrixWorld();
sky.setShadowTarget(target);sky.update(.016,ctx);props.update(.016,ctx);renderer.render(scene,camera);
return {render:renderer.info.render,props:props.stats(),lights:props.lights().length};
};window.ready=true;
`;
writeFileSync(`${out}/preview.html`, `<link rel="icon" href="data:,"><body style="margin:0"><script type="module">${source}</script>`);
const browser = await launchChrome();
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const errors=[];page.on('pageerror', e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
 await page.goto(`${process.argv[2] || 'http://localhost:5424'}/${out}/preview.html`);
 await page.waitForFunction(()=>window.ready,{},{timeout:30000});
 const counts={};
 for(const [kind,n] of [['highRoadArch',3],['roadStair',1],['roadPylon',2],['fallenSpan',1],['vista',1]]){
  for(let v=0;v<n;v++)for(const night of [false,true]){
   counts[`${kind}-${v}-${night?'night':'day'}`]=await page.evaluate(([k,v,n])=>window.show(k,v,n),[kind,v,night]);
   await page.screenshot({path:`${out}/${kind}-${v}-${night?'night':'day'}.png`});
  }
  if(kind!=='vista'){
   const sheet=await sharp(`assets-src/concept/1-high-road/${kind}.webp`).resize(1125,720,{fit:'contain',background:'#f4ead8'}).toBuffer();
   const model=await sharp(`${out}/${kind}-0-day.png`).toBuffer();
   await sharp({create:{width:2085,height:720,channels:3,background:'#f4ead8'}}).composite([{input:sheet,left:0,top:0},{input:model,left:1125,top:0}]).png().toFile(`${out}/${kind}-comparison.png`);
  }
 }
 for(const quality of ['low','medium','high','ultra']){
  counts[quality]=await page.evaluate(q=>window.show('vista',0,false,q),quality);
  await page.screenshot({path:`${out}/vista-${quality}.png`});
 }
 writeFileSync(`${out}/render-counts.json`,JSON.stringify({renderer:browser.gameRenderer,counts,errors},null,2));
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Saved day/night variants, concept comparisons and four quality vistas; no browser errors.');
} finally {await browser.close();}
