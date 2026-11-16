// Local, reproducible terrace fixture. Uses the game's prop renderer and sky lighting.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import sharp from 'sharp';
const out = resolve('.artifacts/world/models-2');
mkdirSync(out, { recursive: true });
// Assembly checks run against the actual mesh, independently of its declared budget.
const { BUILDERS } = await import('../src/features/props/builders/index.ts');
const { PROPS } = await import('../src/content/props.ts');
const THREE = await import('three');
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
const geometryCounts = {};
for (const kind of ['terraceWall', 'terraceStair', 'oldGate', 'colossus', 'giantRoot']) {
  geometryCounts[kind] = PROPS[kind].variants.map((variant, i) => {
    const g = BUILDERS[kind](i, PROPS[kind]),
      b = g.boundingBox;
    const triangles = g.index.count / 3;
    assert(triangles <= PROPS[kind].triangles, kind + ' exceeds budget');
    return {
      variant,
      triangles,
      min: b.min.toArray(),
      max: b.max.toArray(),
      size: b.getSize(new THREE.Vector3()).toArray(),
    };
  });
}
const wall = geometryCounts.terraceWall[0];
assert(
  wall.min[0] === -6 && wall.max[0] === 6 && wall.min[1] === 0 && wall.max[1] === 6,
  'wall module must tile every twelve metres',
);
const stair = new THREE.Mesh(
  BUILDERS.terraceStair(0, PROPS.terraceStair),
  new THREE.MeshBasicMaterial(),
);
const ray = new THREE.Raycaster();
for (let i = 0; i < 20; i++) {
  ray.set(new THREE.Vector3(0, 20, 5.7 - i * 0.6), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(stair)[0];
  assert(
    hit && Math.abs(hit.point.y - (i + 1) * 0.3) < 0.00001,
    'stair tread ' + i + ' is not at its required height',
  );
}
writeFileSync(resolve(out, 'geometry.json'), JSON.stringify(geometryCounts, null, 2));
console.log('Geometry budgets, twelve-metre wall joints and twenty stair tread heights pass');
if (process.argv.includes('--geometry-only')) process.exit(0);
writeFileSync(
  resolve(out, 'index.html'),
  '<html><body style="margin:0"><script type="module" src="./scene.js"></script></body></html>',
);
writeFileSync(
  resolve(out, 'scene.js'),
  `
import * as T from '/node_modules/three/build/three.module.js';
import {createProps,buildProp} from '/src/features/props/index.ts';
import {createSky} from '/src/features/sky/index.ts';
import {calmNoon} from '/src/engine/types.ts';
import {flatWorld} from '/src/engine/world-query.ts';
const q=new URLSearchParams(location.search),kind=q.get('kind')||'terraceWall',variant=Number(q.get('variant')||0);
const scene=new T.Scene(), camera=new T.PerspectiveCamera(32,960/700,.1,600);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(960,700);renderer.toneMapping=T.NeutralToneMapping;document.body.append(renderer.domElement);
const ambient=calmNoon();ambient.timeOfDay=q.has('night')?.92:.42;ambient.cloud=0;
const quality=q.get('quality')||'high';const ctx={scene,camera,renderer,ambient,quality,time:0,world:flatWorld};
const sky=createSky(ctx,{shadowRange:80}),props=createProps(ctx,{vary:false});
const add=(k,v,x,y,z)=>props.place(k,v,{x,y,z});
let width=16,height=7,depth=5,hx=-6,hz=6,hy=0;
const floor=(w,h,d,x,y,z)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:0x8d927b,roughness:1}));m.position.set(x,y-h/2,z);m.receiveShadow=true;scene.add(m);};
if(kind==='vista'){
 width=78;height=22;depth=40;hx=-15;hz=17;
 floor(72,6,18,0,6,-7);floor(72,12,18,0,12,-25);
 for(let x=-30;x<=30;x+=12){add('terraceWall',0,x,0,0);add('terraceWall',0,x,6,-18);}
 add('terraceStair',0,18,6,-9);add('oldGate',0,-18,0,5);add('colossus',0,-5,6,-7);add('giantRoot',0,-22,12,-16);
}else if(kind==='group'){
 width=100;height=14;depth=14;hx=0;hz=12;
 for(const [k,x] of [['terraceWall',-38],['terraceStair',-23],['oldGate',-7],['colossus',18],['giantRoot',42]])add(k,0,x,0,0);
}else{const g=buildProp(kind,variant);const b=g.boundingBox; width=b.max.x-b.min.x;height=b.max.y;depth=b.max.z-b.min.z;add(kind,variant,0,0,0);hx=-width*.4;hz=depth*.5+2;}
floor(260,.2,240,0,-.03,0);
const target=new T.Vector3(0,height*.38,kind==='vista'?-7:0);const distance=Math.max(width*.9,height*1.6,depth*1.8)*2.1;
camera.position.copy(target).add(new T.Vector3(kind==='colossus'?.35:-.45,.48,1).normalize().multiplyScalar(distance));camera.lookAt(target);
const tex=await new T.TextureLoader().loadAsync('/assets/sprites/hero.png');tex.colorSpace=T.SRGBColorSpace;tex.magFilter=T.NearestFilter;tex.repeat.set(1/6,1/7);tex.offset.set(0,6/7);
const hero=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,alphaTest:.15}));hero.scale.set(1.8,1.8,1);hero.position.set(hx,hy+.9,hz);scene.add(hero);
for(let i=0;i<3;i++){sky.update(.016,ctx);props.update(.016,ctx);renderer.render(scene,camera);}
window.result={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,props:props.stats()};window.ready=true;
`,
);
const browser = await launchChrome();
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const results = {};
  for (const kind of [
    'terraceWall',
    'terraceStair',
    'oldGate',
    'colossus',
    'giantRoot',
    'vista',
    'group',
  ]) {
    for (const quality of ['high', 'medium', 'low'])
      for (const night of [false, true]) {
        if (quality !== 'high' && night) continue;
        const variants = kind === 'giantRoot' ? [0, 1, 2] : [0];
        for (const variant of variants) {
          const name =
            kind + (variant ? '-' + variant : '') + '-' + quality + (night ? '-night' : '');
          await page.goto(
            'http://localhost:5722/.artifacts/world/models-2/index.html?kind=' +
              kind +
              '&variant=' +
              variant +
              '&quality=' +
              quality +
              (night ? '&night=1' : ''),
          );
          await page.waitForFunction(() => window.ready, { timeout: 20000 });
          results[name] = await page.evaluate(() => window.result);
          await page.screenshot({ path: resolve(out, name + '.png') });
          if (quality === 'high' && !night && kind !== 'group') {
            const sheet = await sharp(
              'assets-src/concept/2-terraces/' + (kind === 'vista' ? 'vista' : kind) + '.webp',
            )
              .resize(960, 700, { fit: 'contain', background: '#f7eddb' })
              .toBuffer();
            await sharp({
              create: { width: 1920, height: 700, channels: 3, background: '#f7eddb' },
            })
              .composite([
                { input: resolve(out, name + '.png'), left: 0, top: 0 },
                { input: sheet, left: 960, top: 0 },
              ])
              .png()
              .toFile(resolve(out, kind + (variant ? '-' + variant : '') + '-comparison.png'));
          }
        }
      }
  }
  writeFileSync(
    resolve(out, 'measurements.json'),
    JSON.stringify({ renderer: browser.gameRenderer, results, errors }, null, 2),
  );
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Terrace previews passed');
} finally {
  await browser.close();
}
