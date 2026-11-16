// Run with the worktree Vite server on PORT. Outputs compact comparison sheets and quality fixtures.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { launchChrome } from './lib/chrome.mjs';
import * as THREE from 'three';
import { buildProp, propExtras } from '../src/features/props/index.ts';
import assert from 'node:assert/strict';
const measurements=[];
for(const kind of ['rockArch','boulders','fallenGiant','stiltHut','boardwalk']) {
 for(let v=0;v<(kind==='boulders'?3:kind==='boardwalk'?2:1);v++) {
  const g=buildProp(kind,v);const size=g.boundingBox.getSize(new THREE.Vector3());
  measurements.push({kind,variant:v,triangles:propExtras(g).triangles,size:size.toArray()});g.dispose();
 }
}
const mesh=(k,v=0)=>new THREE.Mesh(buildProp(k,v),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
const ray=new THREE.Raycaster();
const oak=mesh('fallenGiant');oak.updateMatrixWorld();
for(let i=0;i<64;i++) {
 const a=i*Math.PI/32;ray.set(new THREE.Vector3(-13,1.95+1.5*Math.sin(a),1.5*Math.cos(a)),new THREE.Vector3(1,0,0));
 assert.equal(ray.intersectObject(oak).length,0,'3m oak bore');
}
const arch=mesh('rockArch');arch.updateMatrixWorld();
for(let x=-3.5;x<=3.5;x+=.25)for(let y=.1;y<=4;y+=.25) {
 ray.set(new THREE.Vector3(x,y,4),new THREE.Vector3(0,0,-1));assert.equal(ray.intersectObject(arch).length,0,'7m x 4m arch passage');
}
const walks=[mesh('boardwalk'),mesh('boardwalk'),mesh('boardwalk',1)];
const feet=new Set();
walks.forEach((m,i)=>{m.position.z=(i-1)*8;m.updateMatrixWorld();const p=m.geometry.getAttribute('position'),local=new Set();
 for(let j=0;j<p.count;j++)if(p.getY(j)===0)local.add(p.getX(j).toFixed(3)+','+(p.getZ(j)+m.position.z).toFixed(3));
 for(const key of local){assert(!feet.has(key),'no duplicated post feet');feet.add(key);}
});
for(let z=-11.99;z<=11.99;z+=.1){ray.set(new THREE.Vector3(0,2,z),new THREE.Vector3(0,-1,0));const hits=ray.intersectObjects(walks);assert(hits.length>0,'continuous boardwalk');assert(hits[0].point.y>=.959,'level deck');}
console.log('PASS: 3m bore, 7m x 4m arch passage, continuous 24m deck, no duplicate posts');
const out='.artifacts/world/models-8';
mkdirSync(out,{recursive:true});
writeFileSync(`${out}/geometry-checks.json`,JSON.stringify({measurements,openings:"PASS",boardwalk:"PASS"},null,2));
await sharp('public/assets/sprites/hero.png').extract({left:0,top:0,width:128,height:128}).trim().png().toFile(`${out}/hero.png`);
writeFileSync(`${out}/preview.html`, `<!doctype html><html><body style="margin:0"><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import { createProps, buildProp } from '/src/features/props/index.ts';
import { createSky } from '/src/features/sky/index.ts';
import { calmNoon } from '/src/engine/types.ts';
import { flatWorld } from '/src/engine/world-query.ts';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(800,620);renderer.toneMapping=THREE.NeutralToneMapping;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#ded6bc');
const camera=new THREE.PerspectiveCamera(32,800/620,.1,500);
const ctx={scene,camera,renderer,ambient:calmNoon(),world:flatWorld,quality:'high',time:0};
const sky=createSky(ctx,{shadowRange:50});const props=createProps(ctx,{vary:false});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshLambertMaterial({color:0x89946d}));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;ground.receiveShadow=true;scene.add(ground);
const tex=await new THREE.TextureLoader().loadAsync('./hero.png');tex.colorSpace=THREE.SRGBColorSpace;tex.magFilter=THREE.NearestFilter;
const hero=new THREE.Sprite(new THREE.SpriteMaterial({map:tex}));hero.scale.set(1.8*tex.image.width/tex.image.height,1.8,1);scene.add(hero);
window.show=(kind,quality='high',night=false)=>{
 props.clear();ctx.quality=quality;ctx.ambient.timeOfDay=night?.92:.42;
 const keys=kind==='group'?['rockArch','boulders','fallenGiant','stiltHut','boardwalk']:[kind];
 let bounds=new THREE.Box3();
 for(let k=0;k<keys.length;k++) {const key=keys[k];const copies=key==='boardwalk'?3:key==='boulders'?3:1;
 for(let i=0;i<copies;i++){const v=key==='boulders'?i:key==='boardwalk'&&i===2?1:0;const x=kind==='group'?k*30:key==='boulders'?(i-1)*8:0;const z=key==='boardwalk'?(i-1)*8:0;props.place(key,v,{x,y:0,z});const g=buildProp(key,v);bounds.union(g.boundingBox.clone().translate(new THREE.Vector3(x,0,z)));g.dispose();}}
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 hero.position.set(kind==='fallenGiant'?-12.6:bounds.min.x-1.6,.9,kind==='fallenGiant'?0:bounds.max.z*.7);
 if(kind==='boardwalk')hero.position.set(0,1.9,7);
 const distance=Math.max(size.x,size.z,size.y*1.6)*1.55+4;const yaw=kind==='fallenGiant'?-1.02:.48;
 camera.position.copy(center).add(new THREE.Vector3(Math.sin(yaw)*distance,.38*distance,Math.cos(yaw)*distance));camera.lookAt(center);camera.updateMatrixWorld();
 sky.setShadowTarget(center);sky.setQuality?.(quality);sky.update(1/30,ctx);props.update(1/30,ctx);renderer.render(scene,camera);
 return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,props:props.stats()};};
window.ready=true;
</script></body></html>`);
const browser=await launchChrome();
try {
 const page=await browser.newPage({viewport:{width:800,height:620}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://localhost:${process.env.PORT??5721}/${out}/preview.html`);await page.waitForFunction(()=>window.ready);
 const stats={};
 for(const kind of ['rockArch','boulders','fallenGiant','stiltHut','boardwalk','group']) {
  for(const [quality,night] of [['high',false],['high',true],['medium',false],['low',false]]) {
   const tag=night?'night':quality;stats[kind+'-'+tag]=await page.evaluate(([k,q,n])=>window.show(k,q,n),[kind,quality,night]);
   await page.screenshot({path:`${out}/${kind}-${tag}.png`});
  }
  if(kind!=='group') {
   const concept=await sharp(`assets-src/concept/8-set-pieces/${kind}.webp`).resize(969,620,{fit:'contain',background:'#f5e4c7'}).toBuffer();
   await sharp({create:{width:1769,height:620,channels:3,background:'#f5e4c7'}}).composite([{input:`${out}/${kind}-high.png`,left:0,top:0},{input:concept,left:800,top:0}]).png().toFile(`${out}/${kind}-compare.png`);
  }
 }
 writeFileSync(`${out}/render-counts.json`,JSON.stringify({renderer:browser.gameRenderer,stats,errors},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
