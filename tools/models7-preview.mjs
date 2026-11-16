// Local review fixture. Rebuild with: bun tools/models7-preview.mjs [port]
import { createServer } from 'vite';
import * as THREE from 'three';
import { BUILDERS } from '../src/features/props/builders/index.ts';
import { PROPS } from '../src/content/props.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { launchChrome } from './lib/chrome.mjs';
const out = '.artifacts/world/models-7';
mkdirSync(out, { recursive: true });
const geometryChecks = [];
for (const kind of ['galleryMouth', 'caveMouth', 'vaultRoots', 'crystals']) {
  for (let variant = 0; variant < PROPS[kind].variants.length; variant++) {
    const geometry = BUILDERS[kind](variant, PROPS[kind]);
    const triangles = geometry.index.count / 3;
    if (triangles > PROPS[kind].triangles) throw new Error(`${kind} exceeds its budget`);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const ray = new THREE.Raycaster();
    let blocked = 0;
    if (kind !== 'crystals') for (let x = -1.5; x <= 1.5; x += 0.15) for (let y = 0.65; y <= 2.65; y += 0.15) {
      ray.set(new THREE.Vector3(x, y, 15), new THREE.Vector3(0, 0, -1));
      if (ray.intersectObject(mesh).length) blocked++;
    }
    if (kind !== 'crystals' && !(kind === 'vaultRoots' && variant === 0) && blocked) throw new Error(`${kind} passage obstructed`);
    if (kind === 'vaultRoots' && variant === 0 && !blocked) throw new Error('The sealed vault must be closed');
    geometryChecks.push({kind, variant, triangles, sizeXYZ: geometry.boundingBox.getSize(new THREE.Vector3()).toArray(), blocked});
    geometry.dispose(); mesh.material.dispose();
  }
}
writeFileSync(`${out}/geometry.json`, JSON.stringify(geometryChecks, null, 2));

const hero = await sharp('public/assets/sprites/hero.png').extract({left:0,top:0,width:128,height:128}).trim().png().toBuffer();
writeFileSync(`${out}/hero.png`, hero);
writeFileSync(`${out}/index.html`, `<!doctype html><link rel="icon" href="data:,"/><style>body{margin:0;background:#e9dec8}canvas{display:block}#label{position:absolute;top:20px;left:24px;font:18px sans-serif;color:#493335}</style><div id="label"></div><script type="module" src="./fixture.js"></script>`);
writeFileSync(`${out}/fixture.js`, `
import * as T from 'three';
import {createProps} from '/src/features/props/index.ts';
import {createSky} from '/src/features/sky/index.ts';
import {calmNoon} from '/src/engine/types.ts';
import {flatWorld} from '/src/engine/world-query.ts';
const scene=new T.Scene();scene.background=new T.Color('#e9dec8');
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,700);renderer.toneMapping=T.NeutralToneMapping;document.body.append(renderer.domElement);
const camera=new T.PerspectiveCamera(30,900/700,.1,300);
const ambient=calmNoon();ambient.cloud=0;
const ctx={scene,camera,renderer,ambient,world:flatWorld,quality:'high',time:0};
const sky=createSky(ctx,{clouds:false,shadowRange:24});
const props=createProps(ctx,{vary:false});
const ground=new T.Mesh(new T.PlaneGeometry(180,180),new T.MeshLambertMaterial({color:0x8b936d}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;scene.add(ground);
const tex=await new T.TextureLoader().loadAsync('./hero.png');tex.colorSpace=T.SRGBColorSpace;tex.magFilter=T.NearestFilter;
const hero=new T.Sprite(new T.SpriteMaterial({map:tex}));hero.scale.set(1.8*tex.image.width/tex.image.height,1.8,1);scene.add(hero);
window.show=(kind,variant=0,quality='high',night=false,group=false)=>{
 props.clear();ctx.quality=quality;props.setQuality?.(quality);sky.setQuality?.(quality);ambient.timeOfDay=night?.92:.42;
 let h=kind==='crystals'?4:10,w=kind==='vaultRoots'?14:kind==='crystals'?4:10,d=kind==='vaultRoots'?12:kind==='crystals'?1.5:6;
 if(group){[['galleryMouth',0],['caveMouth',0],['vaultRoots',0],['vaultRoots',1],['crystals',0],['crystals',1]].forEach(([k,v],i)=>props.place(k,v,{x:(i%3-1)*18,y:0,z:Math.floor(i/3)*19-9}));w=54;h=10;d=34;}else props.place(kind,variant,{x:0,y:0,z:0});
 hero.position.set(-w*.48,.9,d*.3+0.6);
 const distance=group?105:Math.max(w*2.9,h*3.15);const target=new T.Vector3(0,h*.4,0);
 camera.position.set(-distance*.34,target.y+distance*.37,distance*.86);camera.lookAt(target);camera.updateMatrixWorld();
 sky.setShadowTarget({x:0,y:0,z:0});sky.update(0,ctx);props.update(0,ctx);renderer.render(scene,camera);
 document.querySelector('#label').textContent=group?'Ways down • common scale':kind+' / '+variant+' • '+quality+' • '+(night?'night':'day')+' • hero 1.8 m';
 return {renderer:renderer.info.render,props:props.stats(),lights:props.lights().length};
};window.ready=true;`);
const server=await createServer({configFile:false,root:process.cwd(),server:{port:Number(process.argv[2]||5793),strictPort:true,host:'127.0.0.1'}});
await server.listen();console.log(`preview pid ${process.pid}`);
let browser;
try {
 browser=await launchChrome();const page=await browser.newPage({viewport:{width:900,height:700}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${process.argv[2]||5793}/${out}/index.html`);await page.waitForFunction(()=>window.ready);
 const stats=[];
 for(const kind of ['galleryMouth','caveMouth','vaultRoots','crystals']){
  for(const variant of (['vaultRoots','crystals'].includes(kind)?[0,1]:[0])){
   for(const quality of ['low','medium','high'])for(const night of [false,true]){
    stats.push({kind,variant,quality,night,...await page.evaluate(a=>window.show(...a),[kind,variant,quality,night])});
    await page.screenshot({path:`${out}/${kind}-${variant}-${quality}-${night?'night':'day'}.png`});
   }
   const model=await sharp(`${out}/${kind}-${variant}-high-day.png`).resize(800,622).toBuffer();
   const concept=await sharp(`assets-src/concept/7-ways-down/${kind}.webp`).resize(800,622,{fit:'contain',background:'#fff0d9'}).toBuffer();
   await sharp({create:{width:1600,height:622,channels:3,background:'#fff0d9'}}).composite([{input:model,left:0,top:0},{input:concept,left:800,top:0}]).png().toFile(`${out}/${kind}-${variant}-comparison.png`);
  }
 }
 await page.evaluate(()=>window.show('galleryMouth',0,'high',false,true));await page.screenshot({path:`${out}/group.png`});
 writeFileSync(`${out}/render-counts.json`,JSON.stringify({renderer:browser.gameRenderer,stats,errors},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser?.close();await server.close();}
