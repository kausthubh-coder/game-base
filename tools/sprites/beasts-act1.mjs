// Rebuild the six explicitly replaceable act-1 beasts from generated sheets.
// No drawing: equal-cell slicing, alpha cleanup, one scale per source, palette snap.
import sharp from 'sharp';
import {pixels,cell,clean,bounds,snap,fitted,readJSON,writeJSON} from './lib.mjs';
const palette=(await readJSON('assets-src/palette.json')).colors;
const manifest=await readJSON('public/assets/manifest.json');
const specs=[['fox',96,.85,68],['thistlehog',96,1.0,68],['boar',192,3.45,150],['lynx',96,1.65,68],['gearling',96,1.3,68],['rootsnare',96,1.6,68]];
// Flood only the smooth, opaque generator backdrop from each cell's border.
// Pixel outlines stop the flood at a colour step; no replacement pixels are drawn.
function clearBackdrop(p){
 if(p.data[3]<210)return;
 const seen=new Uint8Array(p.w*p.h),queue=[];
 const add=k=>{if(!seen[k]){seen[k]=1;queue.push(k);}};
 for(let x=0;x<p.w;x++){add(x);add((p.h-1)*p.w+x);}
 for(let y=0;y<p.h;y++){add(y*p.w);add(y*p.w+p.w-1);}
 for(let at=0;at<queue.length;at++){
  const k=queue[at],x=k%p.w,y=Math.floor(k/p.w);
  for(const n of [x?k-1:-1,x<p.w-1?k+1:-1,y?k-p.w:-1,y<p.h-1?k+p.w:-1]){
   if(n<0||seen[n])continue;
   let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(p.data[k*4+c]-p.data[n*4+c]));
   if(d<=12)add(n);
  }
 }
 for(const k of queue)p.data[k*4+3]=0;
}
async function source(name,rows,size,height){
 const p=await pixels(`assets-src/raw/${name}-${['boar-act1','lynx-act1'].includes(name)?4:3}.png`),cells=[];
 const bands=[];let start=-1;
 if(!name.includes('-well-'))for(let y=0;y<=p.h;y++){
  let count=0;for(let x=0;x<p.w;x++)if(p.data[(y*p.w+x)*4+3]>=210)count++;
  if(count>5&&start<0)start=y;
  if(count<=5&&start>=0){if(y-start>10)bands.push([start,y]);start=-1;}
 }
 if(bands.length&&bands.length!==rows)throw Error(name+' source rows '+bands.length);
 const edges=bands.length?[0,...bands.slice(1).map((b,i)=>Math.floor((bands[i][1]+b[0])/2)),p.h]:null;
 for(let row=0;row<rows;row++)for(let col=0;col<4;col++){
  let sc=col,sr=row;
  if(name==='rootsnare-well-act1'){sc=row%3;sr=row<3?col%2:col+2;}
  let strip=p;
  if(edges){const top=edges[sr],h=edges[sr+1]-top;strip={data:await sharp(p.data,{raw:{width:p.w,height:p.h,channels:4}}).extract({left:0,top,width:p.w,height:h}).raw().toBuffer(),w:p.w,h};}
  const cut=await cell(strip,sc,edges?0:sr,4,edges?1:rows);
  if(name.includes('-well-'))clearBackdrop(cut);
  const q=clean(cut);cells.push({q,b:bounds(q),row,col});
 }
 const hs=cells.slice(0,12).map(c=>c.b.height).sort((a,b)=>a-b);
 const scale=Math.min(height/hs[6],(size-12)/Math.max(...cells.map(c=>c.b.width)),(size-14)/Math.max(...cells.map(c=>c.b.height)));
 for(const c of cells)snap(c.q,palette);
 // Fight poses use the creature's own snapped world colours, not unrelated cast shades.
 const own=new Set();for(const c of cells.filter(c=>c.row<6))for(let i=0;i<c.q.data.length;i+=4)if(c.q.data[i+3])own.add('#'+c.q.data.subarray(i,i+3).toString('hex'));
 for(const c of cells){if(c.row>=6&&c.col<3)snap(c.q,[...own]);c.fit=await fitted(c.q,c.b,scale);}
 return cells;
}
async function publish(name,cells,size,worldHeight,rows,animations){
 const anchor=[size/2,size===192?176:88],layers=[];
 for(const c of cells){const q=c.fit;layers.push({input:q.input,left:c.col*size+anchor[0]-Math.floor(q.w/2),top:c.row*size+anchor[1]-q.h+1});}
 const sheet=`sprites/${name}.png`;
 await sharp({create:{width:4*size,height:rows*size,channels:4,background:'#00000000'}}).composite(layers).png().toFile('public/assets/'+sheet);
 const entry={sheet,frame:[size,size],anchor,worldHeight,animations};
 // These named act-1 sheets are explicitly rebuilt here; original baselines stay frozen.
 manifest.sprites[name]=entry;console.log('Built '+name);
}
const world={idle:{frames:2,fps:4,rows:{front:0,back:1,side:2}},walk:{frames:4,fps:10,rows:{front:3,back:4,side:5}}};
const fight={poses:{frames:4,fps:1,rows:{front:0,back:1,side:2}}};
for(const [kind,size,worldHeight,height]of specs.filter(s=>!process.argv.includes('--only')||s[0]===process.argv[process.argv.indexOf('--only')+1])){
 const greyName=kind==='fox'?'fox-blighted':kind==='thistlehog'||kind==='boar'?kind+'-blighted':kind;
 const generated=await source(kind+'-act1',9,size,height);
 if(kind==='boar')for(let row=0;row<6;row++){const target=generated.find(c=>c.row===row&&c.col===3),other=generated.find(c=>c.row===row&&c.col===1);target.fit=other.fit;}
 const worldCells=generated.filter(c=>c.row<6&&(c.row>=3||c.col<2));
 await publish(greyName,worldCells,size,worldHeight,6,world);
 let well;
 if(!['gearling','lynx'].includes(kind)){
  well=await source(kind+'-well-act1',6,size,height);
  const wellName=kind==='fox'?'fox':kind==='rootsnare'?'rootsnare-calmed':kind;
  await publish(wellName,well.filter(c=>c.row>=3||c.col<2),size,worldHeight,6,world);
 }
 // The fox source's combat columns were idle,tell,attack,hurt; the others tell,attack,hurt,calmed.
 const poses=[];
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){
  let c=generated.find(c=>c.row===row+6&&c.col===(kind==='fox'?Math.min(col+1,3):col));
  if(col===3&&kind==='fox')c=well.find(c=>c.row===row&&c.col===0);
  poses.push({...c,row,col});
 }
 await publish((kind==='fox'?'fox-blighted':kind)+'-fight',poses,size,worldHeight,3,fight);
 // Explicit world aliases let content choose a recovered form.
 if(well){
  const wellName=kind==='fox'?'fox':kind==='rootsnare'?'rootsnare-calmed':kind+'-calmed';
  if(['thistlehog','boar'].includes(kind))await publish(wellName,well.filter(c=>c.row>=3||c.col<2),size,worldHeight,6,world);
 }
}
await writeJSON('public/assets/manifest.json',manifest);
