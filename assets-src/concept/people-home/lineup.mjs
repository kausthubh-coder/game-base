// Rebuild the comparison from the saved paintings. No character pixels are drawn here.
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const home=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(home);
// Crops use the encoded sheets' 1600px-wide coordinates; heights are art defaults in meters.
const cast=[
 ['Hero A','people-home/hero.webp',[210,75,175,625],1.54],
 ['Hobb','people-home/hobb.webp',[200,80,235,640],1.48],
 ['Dax','people-home/dax.webp',[190,60,245,660],1.80],
 ['Mina','people-home/mina.webp',[185,70,215,640],1.50],
 ['Gus','people-home/gus.webp',[190,65,245,640],1.70],
 ['Wren','people-home/wren.webp',[205,65,195,640],1.75],
 ['Tansy','people-home/tansy.webp',[175,65,240,645],1.52],
 ['Holt','people-home/holt.webp',[200,90,225,620],1.72],
 ['Maren','people-world/maren.webp',[525,5,165,455],1.60],
 ['Tamsin','people-world/tamsin.webp',[360,15,200,465],1.68],
 ['Elowen','people-world/elowen.webp',[535,5,170,450],1.42],
 ['Calla','people-world/calla.webp',[525,4,165,445],1.78],
 ['Aldric','people-world/aldric.webp',[490,65,220,365],1.50],
 ['Ren','people-world/ren.webp',[515,10,170,430],1.60],
 ['Ilara','people-old/ilara.webp',[545,5,145,420],1.64],
 ['Auren','people-old/auren.webp',[515,5,180,435],1.82],
 ['Custodian','people-old/custodian.webp',[490,150,160,230],0.70],
 ['Cernwyn','people-old/stag.webp',[365,40,245,290],6.40],
];
// Flood only edge-connected parchment. Dark tinted contours preserve clothing and skin.
async function crop(file,box){
 const {data,info}=await sharp(path.join(root,file)).extract({left:box[0],top:box[1],width:box[2],height:box[3]}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info;const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let end=0;
 const add=(i)=>{if(seen[i])return;seen[i]=1;const j=i*4;const [r,g,b]=data.subarray(j,j+3);if(r>230&&g>200&&b>155&&r-g<45&&g-b<65)queue[end++]=i;};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
 for(let k=0;k<end;k++){const i=queue[k],x=i%w,y=Math.floor(i/w);data[i*4+3]=0;if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w);}
 // Keep the largest connected silhouette; discard detached sheet lettering and paper scraps.
 const components=new Int32Array(w*h);let component=0,largest=0,largestSize=0;
 for(let start=0;start<w*h;start++){
  if(components[start]||!data[start*4+3])continue;
  component++;let count=1;queue[0]=start;components[start]=component;
  for(let k=0;k<count;k++){
   const i=queue[k],x=i%w,y=Math.floor(i/w);
   for(const next of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])
    if(next>=0&&!components[next]&&data[next*4+3]){components[next]=component;queue[count++]=next;}
  }
  if(count>largestSize){largest=component;largestSize=count;}
 }
 for(let i=0;i<w*h;i++)if(components[i]!==largest)data[i*4+3]=0;
 return sharp(data,{raw:{width:w,height:h,channels:4}}).trim({background:'#00000000',threshold:8}).png().toBuffer();
}
const width=5100,height=1390,baseline=1190,ppm=160;const items=[];
let svg=`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>text{fill:#493335;font-family:Georgia,serif}</style><text x="80" y="78" font-size="48">GREENHOLLOW / EIGHTEEN NAMED CAST</text><text x="80" y="126" font-size="27">Identity repaint proposals · 12 November 2026 · Painted bodies from the concept sheets</text><text x="80" y="174" font-size="25">One physical scale: 160 pixels per metre. Heights are art defaults, not canon. Hero A stands for the player’s four mirror looks.</text><line x1="60" y1="${baseline}" x2="5040" y2="${baseline}" stroke="#b78b5a" stroke-width="2"/>`;
for(let i=0;i<cast.length;i++){
 const [name,file,box,metres]=cast[i]; const buf=await crop(file,box);const h=Math.round(metres*ppm);const out=await sharp(buf).resize({height:h}).png().toBuffer();const m=await sharp(out).metadata();const center=i<17?135+i*235:4500;
 items.push({input:out,left:Math.round(center-m.width/2),top:baseline-h});
 svg+=`<text x="${center}" y="1240" text-anchor="middle" font-size="32">${name}</text>`;
}
svg+='<text x="80" y="1320" font-size="26">The Custodian stays badger-sized. Cernwyn stays oak-tall; the chained painting retains its collar and four pins. Unnamed townsfolk remain on their own approved sheet.</text></svg>';
items.push({input:Buffer.from(svg),left:0,top:0});
await sharp({create:{width,height,channels:3,background:'#f6ead5'}}).composite(items).webp({quality:86}).toFile(path.join(home,'lineup.webp'));
await writeFile(path.join(home,'lineup.json'),JSON.stringify({pixelsPerMetre:ppm,baseline,cast:cast.map(([name,file,crop,heightMetres])=>({name,file,crop,heightMetres}))},null,2)+'\n');
