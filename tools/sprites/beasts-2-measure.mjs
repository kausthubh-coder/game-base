import {readJSON,pixels,cell,bounds} from './lib.mjs';
const m=await readJSON('public/assets/manifest.json');
for(const name of ['hero','boar-blighted','boar-calmed','lynx','custodian-wake','fox-blighted','fox','thistlehog-blighted','gearling','rootsnare','mossling','burrower','frog','bee','lanternfly-world','stag']){
 const s=m.sprites[name],p=await pixels('public/assets/'+s.sheet),a=s.animations.idle??s.animations.awake??Object.values(s.animations)[0],r=a.rows.side??a.rows.front,q=await cell(p,0,r,p.w/s.frame[0],p.h/s.frame[1]),b=bounds(q);
 console.log(JSON.stringify({name,worldHeight:s.worldHeight,sidePixels:[b.width,b.height],drawnBlocks:[+(b.width/s.frame[0]*s.worldHeight).toFixed(2),+(b.height/s.frame[1]*s.worldHeight).toFixed(2)]}));
}
