// Rebuild the river landmark evidence, without touching game placements.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import sharp from 'sharp';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { launchChrome } from './lib/chrome.mjs';
const out = '.artifacts/world/models-4';
mkdirSync(out, { recursive: true });
await sharp('public/assets/sprites/hero.png').extract({ left: 0, top: 0, width: 128, height: 128 }).trim().toFile(`${out}/hero.png`);
writeFileSync(`${out}/preview.html`, `<!doctype html><style>body{margin:0;background:#d9dfd6}canvas{display:block}#label{position:absolute;top:18px;left:22px;font:18px Georgia;color:#3d382e}</style><div id="label"></div><script type="module">
import * as T from 'three';
import { createProps } from '/src/features/props/index.ts';
import { createSky } from '/src/features/sky/index.ts';
import { calmNoon } from '/src/engine/types.ts';
import { flatWorld } from '/src/engine/world-query.ts';
import { pumpHouseParts, weirWater } from '/src/features/props/builders/group-4.ts';
import { paint } from '/src/features/painted/paint.ts';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(960,640);document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#d9dfd6');const camera=new T.PerspectiveCamera(32,1.5,.1,500);
const ambient=calmNoon();const ctx={scene,camera,renderer,ambient,world:flatWorld,quality:'high',time:0};
const sky=createSky(ctx,{shadowRange:60});const props=createProps(ctx,{vary:false});
let objects=[], rotor=null;
const texture=await new T.TextureLoader().loadAsync('/.artifacts/world/models-4/hero.png');texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.NearestFilter;
window.show=(kind,quality='high',night=false,angle=null)=>{
props.clear();for(const o of objects){scene.remove(o);o.geometry?.dispose();}objects=[];rotor=null;
ctx.quality=quality;ambient.timeOfDay=night?.92:.42;sky.update(0,ctx);props.setQuality?.(quality);
const h={pumpHouse:16,weir:4,oldMill:9,jetty:5}[kind],span={pumpHouse:26,weir:27,oldMill:14,jetty:16}[kind];
if(kind==='pumpHouse'&&angle!==null){const parts=pumpHouseParts();for(const g of [parts.stationary,parts.wheel]){const m=new T.Mesh(g,paint({vertexColors:true}));scene.add(m);objects.push(m);if(g===parts.wheel){m.position.fromArray(parts.pivot);m.rotation.z=angle;rotor=m;}}}else props.place(kind,0,{x:0,y:0,z:0});
const ground=new T.Mesh(new T.PlaneGeometry(90,90),new T.MeshLambertMaterial({color:0xc1bc9d}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;scene.add(ground);objects.push(ground);
if(kind==='weir'){const m=new T.Mesh(weirWater(),new T.MeshLambertMaterial({color:0x8fcbd3,transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false,vertexColors:true}));scene.add(m);objects.push(m);}
const hero=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true}));hero.scale.set(1.8,1.8,1);hero.position.set(kind==='pumpHouse'?6:kind==='weir'?-12.5:-2,kind==='jetty'?2.9:.9,kind==='pumpHouse'?7.8:kind==='jetty'?4.5:5);scene.add(hero);objects.push(hero);
const target=new T.Vector3(0,h*.4,0);const dir=kind==='oldMill'?new T.Vector3(.8,.55,1):new T.Vector3(-.7,.55,1);camera.position.copy(target).addScaledVector(dir.normalize(),span*2.1);camera.lookAt(target);props.update(0,ctx);renderer.render(scene,camera);
document.querySelector('#label').textContent=kind+' · '+quality+' · '+(night?'night':'day')+' · hero 1.8 m'+(angle===null?'':' · rotor '+Math.round(angle*180/Math.PI)+'°');
return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};window.ready=true;
</script>`);
const server=await createServer({configFile:false,root:process.cwd(),publicDir:'public',server:{host:'127.0.0.1',port:5749,strictPort:true}});
await server.listen();console.log(`preview pid ${process.pid}, port 5749`);
let browser;
try {
 browser=await launchChrome();const page=await browser.newPage({viewport:{width:960,height:640}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5749/'+out+'/preview.html');await page.waitForFunction(()=>window.ready);
 for(const kind of ['pumpHouse','weir','oldMill','jetty']){
  for(const quality of ['low','medium','high'])for(const night of quality==='high'?[false,true]:[false]){
   console.log(kind,quality,night,await page.evaluate(([k,q,n])=>window.show(k,q,n),[kind,quality,night]));
   await page.screenshot({path:out+'/'+kind+'-'+quality+(night?'-night':'')+'.png'});
  }
  const model=await sharp(out+'/'+kind+'-high.png').resize(800,533).toBuffer();const concept=await sharp('assets-src/concept/4-water/'+kind+'.webp').resize(800,533,{fit:'contain',background:'#f4efdf'}).toBuffer();
  await sharp({create:{width:1600,height:533,channels:3,background:'#f4efdf'}}).composite([{input:concept,left:0,top:0},{input:model,left:800,top:0}]).png().toFile(out+'/'+kind+'-comparison.png');
 }
 for(const deg of [0,37,83,141]){await page.evaluate(a=>window.show('pumpHouse','high',false,a),deg*Math.PI/180);await page.screenshot({path:out+'/wheel-'+deg+'.png'});}
 const tiles=await Promise.all(['pumpHouse','weir','oldMill','jetty'].map(async(k,i)=>({input:await sharp(out+'/'+k+'-high.png').resize(480,320).toBuffer(),left:(i%2)*480,top:Math.floor(i/2)*320})));
 await sharp({create:{width:960,height:640,channels:3,background:'#eee'}}).composite(tiles).png().toFile(out+'/group.png');
 for (const kind of ['pumpHouse','weir','oldMill','jetty']) {
  const r=await promisify(execFile)('bun',['tools/props-shots.mjs','--only',kind,'--url','http://127.0.0.1:5749/demos/props/','--w','960','--h','640']);
  console.log(r.stdout);
  for(const suffix of ['', '-night'])copyFileSync('.artifacts/props/only-'+kind+suffix+'.png',out+'/turntable-'+kind+suffix+'.png');
 }
 copyFileSync('.artifacts/props/sheet-landmark.png',out+'/sheet-landmark.png');
 if(errors.length)throw new Error(errors.join('\n'));console.log('PASS: no browser errors');
}finally{await browser?.close();await server.close();}
