// Candidate-only processing of genuinely generated figures. Never paints body pixels.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {pixels,cell,clean,bounds,snap,fittedMode,readJSON} from './lib.mjs';
const actions=['cut','cut-back','moves','call','bow','staff','camp'];
const name=process.argv[2]??'cut',attempt=process.env.ATTEMPT??'1';
if(!actions.includes(name)||!['1','2','3'].includes(attempt))throw Error('Unknown action or attempt');
const source=await pixels(`assets-src/hero-braid/actions/${name}-attempt-${attempt}.png`);
const reference=await pixels('public/assets/sprites/hero-braid.png');
const colors=new Set();for(let i=0;i<reference.data.length;i+=4)if(reference.data[i+3])colors.add('#'+reference.data.subarray(i,i+3).toString('hex'));
for(const h of (await readJSON('assets-src/palette.json')).colors){const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));if(Math.max(r,g,b)-Math.min(r,g,b)<30||(['moves','call','staff'].includes(name)&&g>r*1.2&&b>r*1.2))colors.add(h);}
const rows=name==='camp'?9:3,cells=[];
let layout;try{layout=await readJSON(`assets-src/hero-braid/actions/${name}-attempt-${attempt}-layout.json`);}catch{}
async function sourceCell(col,row){if(!layout)return cell(source,col,row,4,rows);const top=layout.rowEdges[row],h=layout.rowEdges[row+1]-top;const data=await sharp(source.data,{raw:{width:source.w,height:source.h,channels:4}}).extract({left:0,top,width:source.w,height:h}).raw().toBuffer();return cell({data,w:source.w,h},col,0,4,1);}

for(let row=0;row<rows;row++)for(let col=0;col<(name==='camp'&&row<6?2:4);col++){if(name==='camp'&&row>=6&&col===3)continue;const p=clean(await sourceCell(col,row));snap(p,[...colors]);cells.push({p,b:bounds(p),row,col});}
// Whole-sheet scale from standing figures. Weapons never reduce the body to fit.
const recovery=[];for(let row=0;row<3;row++){const p=clean(await sourceCell(3,name==='camp'?row+6:row));recovery.push(bounds(p).height);}
recovery.sort((a,b)=>a-b);const scale=110/recovery[1],layers=[],measurements=[];
for(const {p,b,row,col}of cells){const q=await fittedMode(p,b,scale);if(q.w>124||q.h>119)throw Error(`Figure cannot fit without shrinking: ${row}:${col} ${q.w}x${q.h}`);
 const raw={data:await sharp(q.input).raw().toBuffer(),w:q.w,h:q.h};let l=q.w,r=-1;for(let y=q.h-5;y<q.h;y++)for(let x=0;x<q.w;x++)if(raw.data[(y*q.w+x)*4+3]){l=Math.min(l,x);r=Math.max(r,x);}
 const left=Math.round(64-(l+r)/2),top=121-q.h;if(left<1||left+q.w>=128)throw Error(`Horizontal clipping: ${row}:${col}`);
 measurements.push({row,col,width:q.w,height:q.h,left,top,support:[left+l,left+r]});layers.push({input:q.input,left:col*128+left,top:row*128+top});}
if(name==='camp')for(let row=0;row<3;row++){const p=await cell(reference,0,row,6,6);layers.push({input:await sharp(p.data,{raw:{width:128,height:128,channels:4}}).png().toBuffer(),left:384,top:(row+6)*128});}
const out=process.env.BRAID_OUT??`.artifacts/hero-braid-actions/${name}-attempt-${attempt}`;await fs.mkdir(out,{recursive:true});
await sharp({create:{width:512,height:rows*128,channels:4,background:'#00000000'}}).composite(layers).png().toFile(`${out}/hero-braid-${name}.png`);
await fs.writeFile(`${out}/processing.json`,JSON.stringify({action:name,attempt,scale,measurements},null,2)+'\n');console.log(`${name}: ${cells.length} generated figures, scale ${scale}; ${out}`);
