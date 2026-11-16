// Preview published pixels only. Does not draw or change any sprite.
import sharp from 'sharp';
import fs from 'node:fs/promises';
const out='.artifacts/fight-sprites';
await fs.mkdir(out,{recursive:true});
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
const names=['stag','stag-fight','stag-free'];
for(const name of names)await sharp(`public/assets/sprites/${name}.png`).flatten({background:'#657f43'}).png().toFile(`${out}/${name}-native.png`);
for(let row=0;row<3;row++){
 const layers=[];
 for(let sheet=0;sheet<3;sheet++)for(let col=0;col<4;col++)layers.push({input:await sharp(`public/assets/sprites/${names[sheet]}.png`).extract({left:col*384,top:row*384,width:384,height:384}).png().toBuffer(),left:col*384,top:sheet*384});
 await sharp({create:{width:1536,height:1152,channels:4,background:'#657f43'}}).composite(layers).png().toFile(`${out}/comparison-${['front','back','side'][row]}.png`);
}
// Uniform 32 pixels per block, manifest worldHeight is the entire frame.
const layers=[];let x=20;const baseline=440;
for(const name of ['stag','boar','hero']){
 const s=manifest.sprites[name],size=s.frame[0],height=Math.round(s.worldHeight*32),anchor=Math.round(s.anchor[1]*height/size);
 layers.push({input:await sharp('public/assets/'+s.sheet).extract({left:0,top:size*2,width:size,height:size}).resize(height,height,{kernel:'nearest'}).png().toBuffer(),left:x,top:baseline-anchor});x+=height+20;
}
await sharp({create:{width:x,height:480,channels:4,background:'#657f43'}}).composite(layers).png().toFile(`${out}/world-scale.png`);
const directionLayers=[];
for(let row=0;row<3;row++){
 let left=0;
 for(const name of ['stag','boar','hero']){const size=manifest.sprites[name].frame[0];directionLayers.push({input:await sharp('public/assets/'+manifest.sprites[name].sheet).extract({left:0,top:row*size,width:size,height:size}).png().toBuffer(),left,top:row*384+364-manifest.sprites[name].anchor[1]});left+=size;}
}
await sharp({create:{width:704,height:1152,channels:4,background:'#657f43'}}).composite(directionLayers).png().toFile(`${out}/directions-native.png`);
