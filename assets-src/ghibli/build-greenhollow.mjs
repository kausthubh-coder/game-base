// Publish the generated Greenhollow paintings without rebuilding the approved set.
// bun assets-src/ghibli/build-greenhollow.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const raw = resolve(import.meta.dirname, 'raw/greenhollow');
const out = resolve(root, 'public/assets/painted');
const proof = resolve(root, '.artifacts/world/paintings');
mkdirSync(proof, { recursive: true });
const specs = [
  ['bark-grey','bark',false], ['bark-old','bark',false],
  ['leaves-grey','tuft-1',true], ['leaves-old','tuft-2',true],
  ['leaves-willow','tuft-2',true], ['reeds','tuft-2',true], ['fern','tuft-2',true],
  ['moss','meadow',false], ['mud','rock',false], ['scree','rock',false], ['terrace-stone','rock',false],
];
// Blend only the outer band with its opposite edge. Interior generated brushwork stays intact.
function joinEdges(data, channels) {
  const n=512, band=32;
  for (const axis of [0,1]) {
    const source=Buffer.from(data);
    for(let t=0;t<n;t++) for(let d=0;d<band;d++) {
      const weight=0.5*(1-d/(band-1))**2;
      const a=axis===0 ? (t*n+d)*channels : (d*n+t)*channels;
      const b=axis===0 ? (t*n+n-1-d)*channels : ((n-1-d)*n+t)*channels;
      for(let c=0;c<channels;c++) {
        data[a+c]=Math.round(source[a+c]*(1-weight)+source[b+c]*weight);
        data[b+c]=Math.round(source[b+c]*(1-weight)+source[a+c]*weight);
      }
    }
  }
}
const size=[];const pairs=[];
for(let i=0;i<specs.length;i++) {
  const [name,kin,card]=specs[i];
  let image=sharp(resolve(raw,name+'.png')).resize(512,512);
  if(!card) image=image.removeAlpha();
  else if(!(await image.metadata()).hasAlpha) throw Error(name+' lacks alpha');
  const {data,info}=await image.raw().toBuffer({resolveWithObject:true});
  if(!card) joinEdges(data,info.channels);
  else for(let p=3;p<data.length;p+=4) {
    // Match the card material alphaTest of 0.5 and the sprite binary-alpha contract.
    data[p]=data[p]>=128?255:0;
  }
  const budget=Math.round(statSync(resolve(out,kin+'.webp')).size*1.2);
  let bytes,quality=card?86:84;
  bytes=await sharp(data,{raw:info}).webp({quality,alphaQuality:92}).toBuffer();
  while(bytes.length>budget&&quality>50){quality-=4;bytes=await sharp(data,{raw:info}).webp({quality,alphaQuality:92}).toBuffer();}
  if(bytes.length>budget) throw Error(name+' exceeds kin budget at quality '+quality);
  writeFileSync(resolve(out,name+'.webp'),bytes);
  size.push({file:name+'.webp',bytes:bytes.length,kin:kin+'.webp',kinBytes:statSync(resolve(out,kin+'.webp')).size,quality,width:512,height:512,alpha:card});
  const label=Buffer.from(`<svg width="540" height="32"><rect width="540" height="32" fill="#eee7d8"/><text x="8" y="22" font-family="sans-serif" font-size="17">${name} / ${kin}</text></svg>`);
  const row=await sharp({create:{width:540,height:302,channels:3,background:'#596754'}}).composite([
    {input:label,left:0,top:0},
    {input:await sharp(bytes).resize(256,256).png().toBuffer(),left:4,top:38},
    {input:await sharp(resolve(out,kin+'.webp')).resize(256,256).png().toBuffer(),left:278,top:38},
  ]).png().toBuffer();
  pairs.push({input:row,left:i%2*540,top:Math.floor(i/2)*302});
  if(!card) {
    const comp=[];for(let y=0;y<3;y++)for(let x=0;x<3;x++)comp.push({input:bytes,left:x*512,top:y*512});
    await sharp({create:{width:1536,height:1536,channels:3,background:'#666666'}}).composite(comp).png().toFile(resolve(proof,name+'-3x3.png'));
  }
}
await sharp({create:{width:1080,height:1812,channels:3,background:'#eee7d8'}}).composite(pairs).png().toFile(resolve(proof,'comparisons.png'));
const manifestPath=resolve(root,'public/assets/manifest.json');
const manifest=JSON.parse(readFileSync(manifestPath));
for(const [name]of specs)manifest.painted.textures[name]='painted/'+name+'.webp';
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
writeFileSync(resolve(proof,'sizes.json'),JSON.stringify(size,null,2)+'\n');
console.table(size);
