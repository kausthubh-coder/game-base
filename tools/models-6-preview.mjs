// Reproducible ruin fixture: real prop instancing, game sky, 1.8 m hero, and concept comparisons.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import sharp from 'sharp';
import { launchChrome } from './lib/chrome.mjs';
const out = resolve('.artifacts/world/models-6');
mkdirSync(out, { recursive: true });
await sharp('public/assets/sprites/hero.png')
  .extract({ left: 0, top: 0, width: 128, height: 128 })
  .trim()
  .png()
  .toFile(`${out}/hero.png`);
writeFileSync(
  `${out}/index.html`,
  '<html><style>body{margin:0;background:#e8dfc9}canvas{display:block}#caption{position:absolute;top:16px;left:24px;font:18px Georgia;color:#433b36}</style><div id="caption"></div><script type="module" src="./preview.ts"></script></html>',
);
writeFileSync(
  `${out}/preview.ts`,
  `
import * as THREE from 'three';
import {createProps} from '/src/features/props/index.ts';
import {createSky} from '/src/features/sky/index.ts';
import {calmNoon} from '/src/engine/types.ts';
import {flatWorld} from '/src/engine/world-query.ts';
const scene=new THREE.Scene();scene.background=new THREE.Color(0xe8dfc9);
const camera=new THREE.OrthographicCamera(-12,12,8,-8,.1,300);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);renderer.setPixelRatio(1);renderer.toneMapping=THREE.NeutralToneMapping;document.body.append(renderer.domElement);
const ambient=calmNoon();ambient.timeOfDay=.42;ambient.cloud=0;
const ctx={scene,camera,renderer,ambient,world:flatWorld,quality:'high',time:0};
const sky=createSky(ctx,{shadowRange:60});const props=createProps(ctx,{vary:false});
const texture=await new THREE.TextureLoader().loadAsync('./hero.png');texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;
const hero=new THREE.Sprite(new THREE.SpriteMaterial({map:texture}));hero.scale.set(1.8*texture.image.width/texture.image.height,1.8,1);hero.center.set(.5,0);scene.add(hero);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshLambertMaterial({color:0x9ca582}));ground.rotation.x=-Math.PI/2;ground.position.y=-.04;ground.receiveShadow=true;scene.add(ground);
const kinds=['sunkTower','forestStair','muralWall','deadCottage','colonnade'];
window.renderRuin=(kind,quality='high',night=false)=>{
 props.clear();ctx.quality=quality;props.setQuality?.(quality);sky.setQuality?.(quality);ambient.timeOfDay=night?.92:.42;
 const group=kind==='all';
 if(group){const places=[[-14,-8],[10,10],[8,-10],[-13,8],[8,0]];kinds.forEach((k,i)=>props.place(k,0,{x:places[i][0],y:0,z:places[i][1]}));}
 else props.place(kind,0,{x:0,y:0,z:0});
 const target=new THREE.Vector3(0,group?3:kind==='forestStair'?1.5:kind==='sunkTower'?5.4:3,0),span=group?29:kind==='muralWall'||kind==='colonnade'?12:kind==='sunkTower'?11:9;
 camera.left=-span;camera.right=span;camera.top=span*.7;camera.bottom=-span*.7;camera.updateProjectionMatrix();
 camera.position.copy(target).add(new THREE.Vector3(-18,19,35));camera.lookAt(target);
 hero.position.set(group?-5:kind==='muralWall'||kind==='colonnade'?-9:-5,0,group?8:3);
 sky.setShadowTarget(target);sky.update(0,ctx);props.update(0,ctx);renderer.render(scene,camera);
 document.querySelector('#caption').textContent=kind+' / '+quality+' / '+(night?'night':'day')+' / hero 1.8 m';
 return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,props:props.stats?.()};
};window.ready=true;
`,
);
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { port: Number(process.env.PORT || 5726), strictPort: true },
});
let browser;
try {
  await server.listen();
  console.log('preview server PID', process.pid);
  browser = await launchChrome({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(
    `http://localhost:${process.env.PORT || 5726}/.artifacts/world/models-6/index.html`,
  );
  await page.waitForFunction(() => window.ready);
  const counts = {};
  for (const kind of ['sunkTower', 'forestStair', 'muralWall', 'deadCottage', 'colonnade', 'all'])
    for (const [quality, night] of kind === 'all'
      ? [['high', false]]
      : [
          ['high', false],
          ['high', true],
          ['low', false],
          ['medium', false],
        ]) {
      const name = kind + '-' + quality + (night ? '-night' : '');
      counts[name] = await page.evaluate(
        ([k, q, n]) => window.renderRuin(k, q, n),
        [kind, quality, night],
      );
      await page.screenshot({ path: out + '/' + name + '.png' });
      if (quality === 'high' && !night && kind !== 'all') {
        const concept = await sharp('assets-src/concept/6-ruins/' + kind + '.webp')
          .resize(1000, 700, { fit: 'contain', background: '#eee4d1' })
          .toBuffer();
        await sharp({ create: { width: 2000, height: 700, channels: 3, background: '#eee4d1' } })
          .composite([
            { input: readFileSync(out + '/' + name + '.png'), left: 0, top: 0 },
            { input: concept, left: 1000, top: 0 },
          ])
          .png()
          .toFile(out + '/' + kind + '-comparison.png');
      }
    }
  writeFileSync(
    out + '/render-counts.json',
    JSON.stringify({ renderer: browser.gameRenderer, counts, errors }, null, 2),
  );
  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS: all five ruins, three qualities, night, comparisons, ensemble');
} finally {
  await browser?.close();
  await server.close();
}
