// Pixel oracle against the immutable preview. No source build and no saves are written.
import { launchChrome } from './lib/chrome.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const url=option('--url','http://127.0.0.1:5797/');
const out = option('--out','.artifacts/hero-frame-repair'); mkdirSync(out,{recursive:true});
const browser=await launchChrome();
try {
 const page=await browser.newPage();await page.goto(url+'?quality=low');await page.waitForFunction(()=>!!window.__game);
 const result=await page.evaluate(()=>{
  const v=window.__game.view,renderer=v.renderer,scene=v.ctx.scene,sprites=v.sprites,mesh=scene.getObjectByName('sprites');
  v.setPaused(true);sprites.clear();for(const child of scene.children)child.visible=child===mesh;
  scene.background=null;scene.fog=null;renderer.toneMapping=0;renderer.setPixelRatio(1);renderer.setSize(128,128,false);renderer.setClearColor(0,1);
  const lens=v.ctx.camera.clone();lens.isPerspectiveCamera=false;lens.isOrthographicCamera=true;lens.position.set(0,0,10);lens.lookAt(0,0,0);lens.updateMatrixWorld();v.ctx.camera=lens;
  const light=mesh.material.uniforms.uSky.value.clone().setRGB(1,1,1);sprites.setSky({light});
  const gl=renderer.getContext(),drawn=new Uint8Array(128*128*4),failures=[];let cases=0;
  let creature=sprites.add('frog',{visible:false});
  for(const name of ['hero','hero-swing']){
   const asset=v.assets.sprite(name),h=sprites.add(name,{shadow:0,tint:[1/1.06,1/1.06,1/1.06]});
   const [fw,fh]=asset.frame,[ax,ay]=asset.anchor,scale=asset.worldHeight/fh;
   lens.projectionMatrix.makeOrthographic(-ax*scale,(fw-ax)*scale,ay*scale,-(fh-ay)*scale,.1,50);lens.projectionMatrixInverse.copy(lens.projectionMatrix).invert();
   for(let direction=0;direction<8;direction++)for(const [animation,anim]of Object.entries(asset.animations))for(let frame=0;frame<anim.frames;frame++){
    creature.remove();creature=sprites.add(frame%2?'frog':'mossling',{visible:false});
    h.setFacing(direction*Math.PI/4);h.play(animation,{restart:true,phase:(frame+.25)/anim.frames});sprites.update(0,v.ctx);
    renderer.clear();renderer.render(scene,lens);gl.readPixels(0,0,fw,fh,gl.RGBA,gl.UNSIGNED_BYTE,drawn);
    const index=h.index,o=index*24,d=mesh.geometry.attributes.aPlace.data.array,place=v.assets.spriteAtlas().place(name);
    const row=(d[o+5]-place.y)/fh,mirrored=d[o+11]<0;let wrong=0,worst=0,solid=0;
    for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){
     const from=mirrored?2*ax-1-x:x,s=((row*fh+y)*asset.pixels.width+frame*fw+from)*4,dest=((fh-1-y)*fw+x)*4;
     if(from<0||from>=fw||asset.pixels.data[s+3]!==255)continue;solid++;
     let delta=0;for(let c=0;c<3;c++)delta=Math.max(delta,Math.abs(drawn[dest+c]-asset.pixels.data[s+c]));worst=Math.max(worst,delta);if(delta>3)wrong++;
    }
    cases++;if(wrong)failures.push({name,animation,direction,frame,row,mirrored,wrong,solid,worst,slot:Array.from(d.subarray(o,o+24))});
   }
   h.remove();
  }
  return{cases,failures,glError:gl.getError()};
 });
 writeFileSync(out+'/preview-rendered-frames.json',JSON.stringify({renderer:browser.gameRenderer,...result},null,2));console.log(JSON.stringify({...result,failures:result.failures.slice(0,6)}));
 if(result.failures.length||result.glError)process.exitCode=1;
}finally{await browser.close()}
