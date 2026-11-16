// A built sheet beside what it must match, for the make-sprite skill's side-by-side check.
//   bun tools/sprites/beside.mjs <sprite> [--ref hero] [--sheet assets-src/concept/<set>/<key>.webp] [--crop x,y,w,h]
//   bun tools/sprites/beside.mjs icons:<set>  [--sheet ...] [--crop ...]     (icons:main is icons.sheet; others are icons.sheets.<set>)
// A sprite: one row a direction (front, back, side). Each row starts with the reference's first idle frame for that
// direction, then every frame of every animation of the sheet in that direction. Drawn three times over: at 3x to
// inspect, at 1x (about what the game draws at its default zoom) and at half (the farthest zoom, a small screen).
// `--ref` defaults to `hero` for a `hero-*` sheet, else the sheet's own first frame, so drift inside one sheet shows.
// Icons: every icon at 64 and 32 pixels, on the interface's dark well and on parchment.
// With `--sheet` the concept painting (or the `--crop` of it) stands to the right at the same height.
// Writes .artifacts/sprites/beside-<name>.png and prints its path. Exits 1 for a name the manifest does not have.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {root,readJSON} from './lib.mjs';

const args=process.argv.slice(2),name=args[0];
const opt=(k,f)=>{const i=args.indexOf('--'+k);return i<0?f:args[i+1];};
if(!name||name.startsWith('--')){console.error('usage: bun tools/sprites/beside.mjs <sprite>|icons:<set> [--ref <sprite>] [--sheet <path>] [--crop x,y,w,h]');process.exit(2);}
const m=await readJSON('public/assets/manifest.json');
const GREEN='#667f46',WELL='#1f2638',PARCHMENT='#efe2c4',DIRS=['front','back','side'];
const cell=(sheet,size,col,row)=>sharp(root+'public/assets/'+sheet).extract({left:col*size,top:row*size,width:size,height:size}).png().toBuffer();
const scaled=(input,size,k)=>sharp(input).resize(Math.max(1,Math.round(size*k)),Math.max(1,Math.round(size*k)),{kernel:k<1?'lanczos3':'nearest'}).png().toBuffer();
const label=(text,x,y,fill='#fff1ce')=>({input:Buffer.from(`<svg width="${text.length*8+8}" height="18"><text x="2" y="13" font-family="monospace" font-size="13" fill="${fill}">${text}</text></svg>`),left:x,top:y});

let layers=[],width=0,height=0,background=GREEN;
if(name.startsWith('icons:')){
  const set=name.slice(6),s=set==='main'?{tile:m.icons.tile,sheet:m.icons.sheet,names:m.icons.names}:m.icons.sheets?.[set];
  if(!s){console.error(`FAIL: no icon set ${set} in the manifest (${['main',...Object.keys(m.icons.sheets??{})].join(', ')})`);process.exit(1);}
  const names=Object.keys(s.names),per=4,w=96+40+64;background=PARCHMENT;
  for(const [i,n] of names.entries()){
    const [c,r]=s.names[n],x=(i%per)*w*2,y=Math.floor(i/per)*96+8,tile=await cell(s.sheet,s.tile,c,r);
    for(const [j,bg] of [WELL,PARCHMENT].entries()){
      const left=x+j*w;
      layers.push({input:{create:{width:w-8,height:72,channels:4,background:bg}},left,top:y});
      layers.push({input:await scaled(tile,s.tile,64/s.tile),left:left+4,top:y+4},{input:await scaled(tile,s.tile,32/s.tile),left:left+76,top:y+20});
    }
    layers.push(label(n,x,y+74,'#493335'));
  }
  width=Math.min(names.length,per)*w*2;height=Math.ceil(names.length/per)*96+16;
}else{
  const s=m.sprites[name];
  if(!s){console.error(`FAIL: no sprite ${name} in the manifest`);process.exit(1);}
  const refName=opt('ref',name.startsWith('hero-')?'hero':name),ref=m.sprites[refName];
  if(!ref){console.error(`FAIL: no reference sprite ${refName} in the manifest`);process.exit(1);}
  const size=s.frame[0],refSize=ref.frame[0],refAnim=ref.animations.idle??Object.values(ref.animations)[0];
  const rows=[];
  for(const dir of DIRS){
    const cells=[];
    for(const anim of Object.values(s.animations)){const row=anim.rows?.[dir];if(row===undefined)continue;for(let col=0;col<anim.frames;col++)cells.push(await cell(s.sheet,size,col,row));}
    if(!cells.length)continue;
    const refRow=refAnim.rows?.[dir]??refAnim.rows?.front??0;
    rows.push({dir,ref:await cell(ref.sheet,refSize,0,refRow),cells});
  }
  let y=0;
  for(const k of [3,1,0.5]){
    layers.push(label(`${k}x  first: ${refName}, then ${name}`,4,y+2));y+=20;
    for(const r of rows){
      layers.push({input:await scaled(r.ref,refSize,k),left:4,top:y});
      let x=4+Math.round(refSize*k)+Math.round(12*k)+4;
      for(const c of r.cells){layers.push({input:await scaled(c,size,k),left:x,top:y});x+=Math.round(size*k);}
      width=Math.max(width,x+4);y+=Math.round(Math.max(size,refSize)*k)+4;
    }
    y+=8;
  }
  height=y;
}

const sheet=opt('sheet','');
if(sheet){
  let concept=sharp(root+sheet);
  const crop=opt('crop','');
  if(crop){const [left,top,w,h]=crop.split(',').map(Number);concept=concept.extract({left,top,width:w,height:h});}
  const right=await concept.resize({height:Math.max(height,600)}).png().toBuffer({resolveWithObject:true});
  layers.push({input:right.data,left:width+8,top:0});
  width+=8+right.info.width;height=Math.max(height,right.info.height);
}
await fs.mkdir(root+'.artifacts/sprites',{recursive:true});
const out=`.artifacts/sprites/beside-${name.replace(':','-')}.png`;
await sharp({create:{width,height,channels:4,background}}).composite(layers).png().toFile(root+out);
console.log(out);
