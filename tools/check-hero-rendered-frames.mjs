// Pixel oracle against the immutable preview. No source build and no saves are written.
import { launchChrome } from './lib/chrome.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const url=option('--url','http://127.0.0.1:5797/');
const out = option('--out','.artifacts/hero-frame-repair'); mkdirSync(out,{recursive:true});
const browser=await launchChrome();
try {
 const stacked = args.includes('--sprite-stack');
 const target = new URL(url);
 target.searchParams.set('quality', 'low');
 if (stacked) target.searchParams.set('look', 'sprite-stack');
 const page=await browser.newPage();await page.goto(target.href);await page.waitForFunction(()=>!!window.__game);
 const result=await page.evaluate(stacked=>{
  const v=window.__game.view,renderer=v.renderer,scene=v.ctx.scene,sprites=v.sprites,mesh=scene.getObjectByName('sprites');
  v.setPaused(true);sprites.clear();for(const child of scene.children)child.visible=child===mesh;
  scene.background=null;scene.fog=null;renderer.toneMapping=0;renderer.setPixelRatio(1);renderer.setClearColor(0,1);
  const lens=v.ctx.camera.clone();lens.isPerspectiveCamera=false;lens.isOrthographicCamera=true;lens.position.set(0,0,10);lens.lookAt(0,0,0);lens.updateMatrixWorld();v.ctx.camera=lens;
  const light=mesh.material.uniforms.uSky.value.clone().setRGB(1,1,1);sprites.setSky({light});
  const gl=renderer.getContext(),failures=[];let cases=0;
  let creature=sprites.add('frog',{visible:false});
  const names = stacked ? ['tamsin','leaftail','mossling','critter','lanternfly','hero','hero-swing'] : ['hero','hero-swing'];
  const headings = ['back','backRight','side','frontRight','front','frontLeft','left','backLeft'];
  for(const name of names){
   const asset=v.assets.sprite(name),h=sprites.add(name,{shadow:0,tint:[1/1.06,1/1.06,1/1.06]});
   const [fw,fh]=asset.frame,[ax,ay]=asset.anchor,scale=asset.worldHeight/fh;
   renderer.setSize(fw, fh, false);
   const drawn = new Uint8Array(fw * fh * 4);
   lens.projectionMatrix.makeOrthographic(-ax*scale,(fw-ax)*scale,ay*scale,-(fh-ay)*scale,.1,50);lens.projectionMatrixInverse.copy(lens.projectionMatrix).invert();
   for (let direction = 0; direction < 8; direction++) {
    h.setFacing(direction * Math.PI / 4);
    for (const [animation, anim] of Object.entries(asset.animations)) {
     h.play(animation, { restart: true });
     const start = v.ctx.time;
     // Hold the action through two wraps. Restarting at each frame never tests the loop seam.
     for (let tick = 0; tick < anim.frames * 3; tick++) {
      const frame = tick % anim.frames;
      creature.remove(); creature = sprites.add(frame % 2 ? 'frog' : 'mossling', { visible: false });
      v.ctx.time = start + (tick + .25) / anim.fps;
      sprites.update(0, v.ctx);
      renderer.clear(); renderer.render(scene, lens);
      gl.readPixels(0, 0, fw, fh, gl.RGBA, gl.UNSIGNED_BYTE, drawn);
      const slot = h.index * 24;
      const data = mesh.geometry.attributes.aPlace.data.array;
      const row = (data[slot + 5] - v.assets.spriteAtlas().place(name).y) / fh;
      const mirrored = data[slot + 11] < 0;
      if (stacked && (row !== anim.rows[headings[direction]] || mirrored)) {
       throw Error(`${name} ${animation} expected ${headings[direction]}, got row ${row}, mirrored ${mirrored}`);
      }
      let wrong = 0, worst = 0, solid = 0;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
       const sourceX = mirrored ? 2 * ax - 1 - x : x;
       if (sourceX < 0 || sourceX >= fw) continue;
       const source = ((row * fh + y) * asset.pixels.width + frame * fw + sourceX) * 4;
       if (asset.pixels.data[source + 3] !== 255) continue;
       solid++;
       const dest = ((fh - 1 - y) * fw + x) * 4;
       let delta = 0;
       for (let c = 0; c < 3; c++) delta = Math.max(delta, Math.abs(drawn[dest + c] - asset.pixels.data[source + c]));
       worst = Math.max(worst, delta);
       if (delta > 3) wrong++;
      }
      cases++;
      if (wrong || !solid) failures.push({name, animation, direction, tick, frame, row, mirrored, wrong, solid, worst});
     }
    }
   }
   h.remove();
  }
  return{cases,failures,glError:gl.getError()};
 }, stacked);
 writeFileSync(out+'/preview-rendered-frames.json',JSON.stringify({renderer:browser.gameRenderer,...result},null,2));console.log(JSON.stringify({...result,failures:result.failures.slice(0,6)}));
 if(result.failures.length||result.glError)process.exitCode=1;
}finally{await browser.close()}
