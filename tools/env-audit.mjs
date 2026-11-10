import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {PROP_KINDS,PROPS} from '../src/content/props.ts';
const out=process.argv[2]||'.artifacts/env/audit'; mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:720}});
await page.goto((process.env.ENV_URL||'http://127.0.0.1:5388/')+'?hold=1&quality=high'); await page.waitForFunction(()=>window.__game);await page.evaluate(()=>{let g=window.__game;g.newGame();g.manual(true);g.teleport(46,-219);});
const kinds=PROP_KINDS.filter(k=>PROPS[k].group!=='tree'&&(!process.env.ENV_ONLY||k===process.env.ENV_ONLY));
if(process.env.ENV_VARIANTS){kinds.length=0;for(const kind of PROP_KINDS)if(PROPS[kind].group!=='tree')for(let i=1;i<PROPS[kind].variants.length;i++)if(existsSync(`public/assets/models/env-${kind.toLowerCase()}-${i}.glb`))kinds.push(kind+'-'+i);}
if(process.env.ENV_MODE==='after'&&!process.env.ENV_ONLY&&!process.env.ENV_VARIANTS)for(const crop of ['wheat','turnip','carrot'])for(let stage=0;stage<4;stage++)kinds.push('crop'+crop+'-'+stage);
await page.evaluate(async()=>{window.__game.advance(.2);await window.__game.settle();await window.__game.frames(4);});
const {buildProp}=await import('../src/features/props/build.ts');
const inventory=[];
for(const label of kinds){
 const [kind,v]=label.split('-');const variant=Number(v||0);
 let geo=buildProp(kind.startsWith('crop')?'grassTuft':kind,0);
 if(process.env.ENV_MODE==='after') { const fs=await import('node:fs');const file=`public/assets/models/env-${kind.toLowerCase()}-${variant}.glb`;if(fs.existsSync(file)){const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const b=fs.readFileSync(file);const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isMesh)geo=o.geometry.clone().applyMatrix4(o.matrixWorld);});const T=await import('three');geo.setAttribute('aFx',new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));geo.computeBoundingBox();}}
 const attrs={};for(const [name,a] of Object.entries(geo.attributes))attrs[name]={array:Array.from(a.array),itemSize:a.itemSize};
 await page.evaluate(({attrs,index})=>{const g=window.__game,v=g.view;v.root.style.display="none";let source;v.scene.traverse(o=>{if(o.isInstancedMesh&&o.name.startsWith('props:')&&!o.name.includes('shadow')&&!source)source=o;});
 if(window.auditMesh){v.scene.remove(window.auditMesh);window.auditMesh.geometry.dispose();}
 v.scene.children.forEach(c=>{if(!c.isLight)c.visible=false;});
 const geometry=new source.geometry.constructor();for(const [name,a] of Object.entries(attrs))geometry.setAttribute(name,new source.geometry.attributes.position.constructor(new Float32Array(a.array),a.itemSize));geometry.setIndex(index);geometry.computeBoundingSphere();
 const mesh=new source.constructor(geometry,source.material,1);mesh.instanceMatrix.array.set([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;v.scene.add(mesh);window.auditMesh=mesh;
 },{attrs,index:Array.from(geo.index.array)});
 const box=geo.boundingBox;const height=box.max.y;const size=Math.max(height,box.max.x-box.min.x,box.max.z-box.min.z,0.6);
 for(const angle of ['tilt','low']){
 await page.evaluate(async({angle,size,height})=>{const v=window.__game.view;const off=v.onFrame(()=>{v.camera.object?.position;const c=v.ctx.camera;c.position.set(size*1.7,height*.45+size*(angle==='low'?.25:1.5),size*2.8);c.lookAt(0,height*.45,0);c.updateMatrixWorld();});await window.__game.frames(3);window.auditOff=off;},{angle,size,height});
 await page.screenshot({path:`${out}/${label}-${angle}.png`});await page.evaluate(()=>{if(typeof window.auditOff==='function')window.auditOff();});
 }
 inventory.push({kind:label,triangles:geo.index.count/3});geo.dispose();
}
writeFileSync(out+'/inventory'+(process.env.ENV_ONLY?'-'+process.env.ENV_ONLY:'')+'.json',JSON.stringify(inventory,null,2));await browser.close();
