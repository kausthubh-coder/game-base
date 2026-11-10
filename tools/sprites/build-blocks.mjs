import sharp from 'sharp';
import fs from 'node:fs/promises';
import {root,readJSON,writeJSON,pixels,cell,png,snap} from './lib.mjs';
import {tiles,extraTiles as extras} from './config.mjs';
import {banding,bandThreshold} from './banding.mjs';
const names=[...tiles,...extras], baseline=await readJSON('assets-src/block-baseline-2.json');
const ramps={sand:[218,194,145],stone:[137,135,128],plaster:[238,228,205],grass_side:[109,123,69],oak_leaves:[96,121,58],mossy_stone:[132,136,116],cobble:[137,135,128],stone_brick:[137,135,128],shingle:[65,128,126],glass:[185,210,213],tilled_top:[102,73,48],path_top:[179,151,108],path_side:[165,136,96],birch_log_top:[211,190,146],pine_log_top:[167,123,74],lume_crystal:[73,211,187],lamp_top:[244,213,148],lamp_side:[238,202,131]};
for(const [name]of Object.entries(ramps)){for(let v=1;v<=(['sand','stone','oak_leaves'].includes(name)?3:1);v++){const key=['sand','stone','oak_leaves'].includes(name)?name+'-'+v:name;await fs.access(root+'assets-src/raw/'+key+'-2.png');}}
const pal=await readJSON('assets-src/palette.json');pal.materialRamps??={};
for(const [name,base]of Object.entries(ramps)){
 const ramp=[-8,0,8].map(v=>'#'+base.map(c=>Math.max(0,Math.min(255,c+v)).toString(16).padStart(2,'0')).join(''));
 pal.materialRamps[name]=ramp; for(const c of ramp)if(!pal.colors.includes(c))pal.colors.push(c);
}
pal.method='Original reference palette retained; explicit low-contrast material ramps added for block repair. Roof teal is muted; bright lume teal stays reserved for magic.';
await writeJSON('assets-src/palette.json',pal);
const swatches=Buffer.alloc(16*Math.ceil(pal.colors.length/16)*16*16*4);
const pw=256,ph=Math.ceil(pal.colors.length/16)*16;
for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){const color=pal.colors[Math.floor(y/16)*16+Math.floor(x/16)];if(color){swatches.set([1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),(y*pw+x)*4);swatches[(y*pw+x)*4+3]=255;}}
await sharp(await png(swatches,pw,ph)).toFile(root+'assets-src/palette.png');
const old=await pixels('assets-src/raw/atlas-before-2.png'),layers=[],mapping={},report=[]; const counts={};
function periodic(p){for(const axis of [0,1])for(let j=0;j<32;j++)for(let c=0;c<3;c++){const a=axis===0?j*128:j*4,b=axis===0?j*128+124:31*128+j*4;const v=Math.round((p.data[a+c]+p.data[b+c])/2);p.data[a+c]=p.data[b+c]=v;}return p;}
// Remove global illumination and line biases, retaining local generated texture detail.
function quiet(p){for(let pass=0;pass<3;pass++)for(const axis of [0,1]){const means=[0,0,0];for(let i=0;i<1024;i++)for(let c=0;c<3;c++)means[c]+=p.data[i*4+c]/1024;for(let j=0;j<32;j++)for(let c=0;c<3;c++){let sum=0;for(let k=0;k<32;k++)sum+=p.data[(axis===0?j*32+k:k*32+j)*4+c]/32;const d=sum-means[c];for(let k=0;k<32;k++){const i=(axis===0?j*32+k:k*32+j)*4+c;p.data[i]=Math.max(0,Math.min(255,Math.round(p.data[i]-d)));}}}return p;}
for(let i=0;i<names.length;i++){
 const name=names[i],v=(counts[name]=(counts[name]??0)+1),key=['sand','stone','oak_leaves'].includes(name)?name+'-'+v:name;
 let source='assets-src/raw/'+key+'-2.png',generated=true;
 try{if(!ramps[name])throw Error('keep original');await fs.access(root+source);}catch{generated=false;}
 const structured=['glass','lamp_top','lamp_side','shingle','stone_brick','cobble','birch_log_top','pine_log_top'].includes(name);
 let p=generated?await pixels(source):await cell(old,i%8,Math.floor(i/8),8,4);
 p={data:await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).resize(32,32,{kernel:generated&&structured?'lanczos3':'nearest'}).raw().toBuffer(),w:32,h:32};
 const changed=generated||baseline.scores[name+' '+v]>bandThreshold;
 if(generated){if(!structured)quiet(p);const limit=8;const base=ramps[name];const luminances=[];for(let a=0;a<p.data.length;a+=4)luminances.push((p.data[a]+p.data[a+1]+p.data[a+2])/3);const avg=luminances.reduce((a,b)=>a+b)/1024;for(let a=0;a<p.data.length;a+=4){const d=Math.max(-limit,Math.min(limit,(luminances[a/4]-avg)*(structured?2:0.7)));for(let c=0;c<3;c++)p.data[a+c]=Math.round(base[c]+d);p.data[a+3]=255;}snap(periodic(p),pal.materialRamps[name]);}
 else if(changed){quiet(p);periodic(p);snap(p,pal.colors);}
 const xy=[i%8,Math.floor(i/8)];(mapping[name]??=[]).push(xy);layers.push({input:await png(p.data,32,32),left:xy[0]*32,top:xy[1]*32});report.push({name,variant:v,changed,generated,source:generated?source:'assets-src/raw/atlas-before-2.png',banding:banding(p)});
}
const height=Math.ceil(names.length/8)*32;
await sharp({create:{width:256,height,channels:4,background:'#00000000'}}).composite(layers).png().toFile(root+'public/assets/blocks/atlas.png');
// Read latest manifest at write time so concurrent work outside blocks is preserved.
const manifest=await readJSON('public/assets/manifest.json');manifest.blocks={tile:32,atlas:'blocks/atlas.png',tiles:mapping};await writeJSON('public/assets/manifest.json',manifest);
await writeJSON('.artifacts/sprites/block-build-2.json',report);console.log('Built blocks only; '+report.filter(r=>r.changed).length+' changed/new cells.');console.log(report.filter(r=>r.banding>bandThreshold));
// Put the drawn structure back into the tiles this file flattened. See compose-blocks.mjs.
await import('./compose-blocks.mjs');
