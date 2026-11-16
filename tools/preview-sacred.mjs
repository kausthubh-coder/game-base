// bun tools/preview-sacred.mjs http://127.0.0.1:5439
// The caller starts/stops its own Vite. Writes only the assigned artifact directory.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { launchChrome } from './lib/chrome.mjs';
const out='.artifacts/world/models-3';
mkdirSync(out,{recursive:true});
await sharp('public/assets/sprites/hero.png').extract({left:0,top:0,width:128,height:128}).trim().png().toFile(`${out}/hero.png`);
writeFileSync(`${out}/preview.html`, `<!doctype html><link rel="icon" href="data:,"><style>body{margin:0;background:#d9dfce}canvas{display:block}#label{position:absolute;top:16px;left:20px;font:18px Georgia;color:#453c36}</style><div id="label"></div><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import {createProps} from '/src/features/props/props.view.ts';
import {createSky} from '/src/features/sky/index.ts';
import {calmNoon} from '/src/engine/types.ts';
import {flatWorld} from '/src/engine/world-query.ts';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(800,700);renderer.toneMapping=THREE.NeutralToneMapping;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#d9dfce');
const camera=new THREE.OrthographicCamera(-8,8,7,-7,.1,150);
const ambient=calmNoon();ambient.timeOfDay=.42;
const ctx={scene,camera,renderer,ambient,world:flatWorld,quality:'high',time:0};
const sky=createSky(ctx,{shadowRange:30,clouds:false});
const props=createProps(ctx,{vary:false});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x89936b,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.065;ground.receiveShadow=true;scene.add(ground);
const texture=await new THREE.TextureLoader().loadAsync('./hero.png');texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;
const hero=new THREE.Sprite(new THREE.SpriteMaterial({map:texture}));hero.scale.set(1.8*texture.image.width/texture.image.height,1.8,1);scene.add(hero);
let id;
window.fixture=(kind,variant=0,quality='high',time=.42)=>{
 if(id!==undefined)props.remove(id);id=props.place(kind,variant,{x:0,y:0,z:0});ctx.quality=quality;ambient.timeOfDay=time;
 const ring=kind==='standingStones',hall=kind==='hallDoor',span=ring?19:hall?12:9, cy=hall?3.7:ring?1.7:2.3;
 camera.left=-span/2;camera.right=span/2;camera.top=span*700/1600;camera.bottom=-camera.top;camera.updateProjectionMatrix();camera.position.set(11,cy+10,24);camera.lookAt(0,cy,0);
 hero.position.set(hall?-2.6:ring?0:2.6,.9,ring?6:hall?1.5:1);
 sky.setQuality?.(quality);sky.setShadowTarget({x:0,y:2,z:0});sky.update(0,ctx);props.update(0,ctx);renderer.render(scene,camera);
 document.querySelector('#label').textContent=kind+' · '+(variant?'awake':'rest')+' · '+quality+' · hero 1.8 m';
 return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,props:props.stats()};
};window.ready=true;
</script>`);
const browser=await launchChrome({headless:true});
try {
 const page=await(await browser.newContext({viewport:{width:800,height:700}})).newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${process.argv[2]}/${out}/preview.html`);await page.waitForFunction(()=>window.ready);
 const stats=[];
 for(const kind of ['hallDoor','shrine','waystone','standingStones']) {
  for(const variant of (kind==='shrine'||kind==='waystone'?[0,1]:[0])) {
   for(const quality of ['low','medium','high']) for(const night of [false,true]) {
    const result=await page.evaluate(({kind,variant,quality,night})=>window.fixture(kind,variant,quality,night?.92:.42),{kind,variant,quality,night});
    const name=kind+'-'+variant+'-'+quality+(night?'-night':'');
    await page.screenshot({path:out+'/'+name+'.png'});stats.push({name,...result});
   }
  }
  const model=await sharp(out+'/'+kind+'-0-high.png').resize(800,700).toBuffer();
  const concept=await sharp('assets-src/concept/3-sacred/'+kind+'.webp').resize(800,700,{fit:'contain',background:'#f5e8cc'}).toBuffer();
  await sharp({create:{width:1600,height:700,channels:3,background:'#f5e8cc'}}).composite([{input:model,left:0,top:0},{input:concept,left:800,top:0}]).png().toFile(out+'/'+kind+'-comparison.png');
 }
 writeFileSync(out+'/render-counts.json',JSON.stringify({stats,errors},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Sacred previews complete; no browser errors.');
} finally {await browser.close();}
