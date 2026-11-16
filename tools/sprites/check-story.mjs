import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readJSON,pixels,cell,bounds,root} from './lib.mjs';
import {validateSpriteGeometry} from './geometry.mjs';
import {storySprites} from './story-config.mjs';
import {act1Icons,act1Aliases} from './act1-icons.mjs';
import {animations} from './config.mjs';
import {fringe} from '../sprite-fringe.mjs';
const m=await readJSON('public/assets/manifest.json'),pal=new Set((await readJSON('assets-src/palette.json')).colors.map(h=>h.slice(1)));
export async function readStory(path,w,h){const p=await pixels('public/assets/'+path);assert.equal(p.w,w,path+' width');assert.equal(p.h,h,path+' height');for(let i=0;i<p.data.length;i+=4){assert(p.data[i+3]===0||p.data[i+3]===255,path+' binary alpha');if(p.data[i+3])assert(pal.has(p.data.subarray(i,i+3).toString('hex')),path+' palette');}return p;}
let count=0;
for(const [n,c]of Object.entries(storySprites)){
 const s=m.sprites[n];if(!s)continue;
 assert.deepEqual(s.frame,[c.size,c.size]);assert.deepEqual(s.anchor,c.anchor);
 assert.deepEqual(s.animations,c.animations??animations(c));
 const p=await readStory(s.sheet,c.cols*c.size,c.rows*c.size);
 count+=(await validateSpriteGeometry(p,c,s.animations,n)).length;
 console.log('OK story '+n+': sizes, anchors, transparency, palette');
}
// No sheet carries the pale rim a white background leaves: at most one outline pixel in twenty is near white.
for(const [n,s]of Object.entries(m.sprites)){const f=await fringe(root+'public/assets/'+s.sheet);assert(f.share<=0.05,`${n} pale fringe: ${(f.share*100).toFixed(1)}% of its outline is near white`);}
const baseline=await readJSON('assets-src/story-baseline-3.json');
function preserved(old,now){for(const [k,v]of Object.entries(old)){assert(k in now,'missing old '+k);if(v&&typeof v==='object'&&!Array.isArray(v))preserved(v,now[k]);else assert.deepEqual(now[k],v,'changed old '+k);}}
preserved(baseline.manifest,m);for(const [p,h]of Object.entries(baseline.hashes))assert.equal(createHash('sha256').update(await fs.readFile(root+'public/assets/'+p)).digest('hex'),h,'old file changed '+p);
console.log('PASS story: '+count+' frames; original entries and files unchanged');
if(m.portraits){for(const n of ['tamsin','maren','odo','gus','mira','wren','juniper','brack','hero'])assert(m.portraits.names[n],'missing original portrait '+n);assert.equal(m.portraits.tile,128);const meta=await (await import("sharp")).default(root+"public/assets/"+m.portraits.sheet).metadata();assert.equal(meta.width,384);assert.equal(meta.height%128,0);const p=await readStory(m.portraits.sheet,384,meta.height);for(const xy of Object.values(m.portraits.names)){const b=bounds(await cell(p,...xy,3,p.h/128));assert(b.left>0&&b.top>0&&b.left+b.width<128&&b.top+b.height<128,'portrait padding');}console.log('OK portraits: registered tiles, transparency, palette and padding');}
if(m.crops){assert.equal(m.crops.tile,32);const p=await readStory(m.crops.sheet,128,128);for(const cs of Object.values(m.crops.names))for(const xy of cs){const b=bounds(await cell(p,...xy,4,4));assert.equal(b.top+b.height-1,31,'crop baseline');assert(b.left>0&&b.top>0&&b.left+b.width<32,'crop padding');}console.log('OK crops: 14 tiles, anchors, transparency, palette');}
if(m.icons.sheets?.story){const s=m.icons.sheets.story;assert.equal(s.tile,32);const p=await readStory(s.sheet,128,128);for(const xy of Object.values(s.names)){const b=bounds(await cell(p,...xy,4,4));assert(b.left>0&&b.top>0&&b.left+b.width<32&&b.top+b.height<32,'new icon padding');}console.log('OK icons story: 16 tiles, transparency, palette and padding');}
for(const name of ['heartstone','mark']){const s=m.icons.sheets?.[name];if(!s)continue;assert.equal(s.tile,32);assert.deepEqual(s.names,{[name]:[0,0]});const p=await readStory(s.sheet,32,32),b=bounds(p);assert(b.width<=24&&b.height<=24,name+' icon size');assert(b.left>=4&&b.top>=4&&b.left+b.width<=28&&b.top+b.height<=28,name+' icon margins');console.log('OK icon '+name+': size, transparency, palette and padding');}
if(m.ui){for(const [n,w,h]of [['panel',96,96],['button',96,32],['title',480,270]]){const p=await readStory(m.ui[n],w,h);if(n==='title')for(let i=3;i<p.data.length;i+=4)assert.equal(p.data[i],255,'opaque title');}console.log('OK UI: panel 96x96, button 96x32, title 480x270, palette and alpha');}
if(process.argv.includes('--complete')){for(const n of Object.keys(storySprites))assert(m.sprites[n],'missing '+n);for(const n of ['portraits','crops','ui'])assert(m[n],'missing '+n);for(const name of ['tamsin','maren','odo','gus','mira','wren','juniper','brack','hero'])assert(m.portraits.names[name],'missing portrait '+name);for(const name of ['hero','hobb','dax','mina','gus','wren','tansy','holt','maren','tamsin','elowen','calla','aldric','ren','ilara','auren','custodian','stag'])for(const expression of ['calm','glad','troubled'])assert(m.portraits.names[name+'-'+expression],'missing portrait '+name+'-'+expression);assert.equal(Object.values(m.crops.names).flat().length,14);assert.equal(Object.keys(m.icons.sheets.story.names).length,16);console.log('PASS all six story sets complete');}

for(const [name,{cols,rows,names}]of Object.entries(act1Icons)) {
 const s=m.icons.sheets?.[name];assert(s,'missing '+name);assert.equal(s.tile,32);
 const p=await readStory(s.sheet,cols*32,rows*32);
 for(const [i,n]of names.entries()){
  assert.deepEqual(s.names[n],[i%cols,Math.floor(i/cols)],name+' '+n);
  assert.deepEqual(s.names['act1-'+n],s.names[n]);
  const b=bounds(await cell(p,...s.names[n],cols,rows));
  assert(b.width<=24&&b.height<=24&&b.left>=4&&b.top>=4&&b.left+b.width<=28&&b.top+b.height<=28,n+' icon bounds');
 }
 for(const [alias,target]of Object.entries(act1Aliases))if(s.names[target])assert.deepEqual(s.names[alias],s.names[target]);
 console.log('OK '+name+': '+names.length+' icons, palette, binary alpha, margins, names');
}

// Scene 9 preserves the hero identity palette and exact idle endpoints.
await import('./check-camp.mjs');
