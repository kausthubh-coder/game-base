// Remove the generator's pale background; leave all drawn fox pixels intact.
import sharp from 'sharp';
import {pixels,cell,clean,root} from './lib.mjs';
const p=await pixels('assets-src/raw/fox-blighted-generated.png');
const layers=[];
for(let row=0;row<6;row++)for(let col=0;col<(row<3?2:4);col++){
 const q=await cell(p,col,row,4,6),seen=new Uint8Array(q.w*q.h),queue=[];
 for(let i=0;i<seen.length;i++)q.data[i*4+3]=255;
 function add(i){if(seen[i])return;const rgb=q.data.subarray(i*4,i*4+3);if(Math.min(...rgb)<195||Math.max(...rgb)-Math.min(...rgb)>35)return;seen[i]=1;queue.push(i);}
 for(let x=0;x<q.w;x++){add(x);add((q.h-1)*q.w+x);}
 for(let y=0;y<q.h;y++){add(y*q.w);add(y*q.w+q.w-1);}
 for(let j=0;j<queue.length;j++){const i=queue[j],x=i%q.w,y=Math.floor(i/q.w);if(x)add(i-1);if(x<q.w-1)add(i+1);if(y)add(i-q.w);if(y<q.h-1)add(i+q.w);}
 for(const i of queue)q.data.fill(0,i*4,i*4+4);
 clean(q);
 layers.push({input:await sharp(q.data,{raw:{width:q.w,height:q.h,channels:4}}).png().toBuffer(),left:Math.round(col*p.w/4),top:Math.round(row*p.h/6)});
}
await sharp({create:{width:p.w,height:p.h,channels:4,background:'#00000000'}}).composite(layers).png().toFile(root+'assets-src/raw/fox-blighted-3.png');
