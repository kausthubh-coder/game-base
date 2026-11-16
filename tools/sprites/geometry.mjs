import assert from 'node:assert/strict';
import {bounds,cell} from './lib.mjs';

// Offline only. Regions describe a reviewed support band, never an asserted origin.
// Inclusive rectangles have a transparent column at each side so they cannot slice
// a sole. The top may cross the lower leg; the bottom must be the actual baseline.
export function frameGeometry(p,anchor,region,label='sprite'){
 const b=bounds(p);
 assert.equal(b.top+b.height-1,anchor[1],label+' baseline');
 let origin=b.left+(b.width-1)/2;
 if(region!==undefined){
  assert(Array.isArray(region)&&region.length===4&&region.every(Number.isInteger),label+' support rectangle');
  const [l,t,r,d]=region;
  assert(l>0&&t>0&&r<p.w-1&&d<p.h-1&&l<r&&t<=d-4&&d===anchor[1],label+' support bounds/depth');
  let left=p.w,right=-1,baseline=false;
  for(let y=t;y<=d;y++){
   assert(!p.data[(y*p.w+l)*4+3]&&!p.data[(y*p.w+r)*4+3],label+' truncated support');
   for(let x=l+1;x<r;x++)if(p.data[(y*p.w+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);if(y===d)baseline=true;}
  }
  assert(right>=left&&baseline,label+' empty support or missing baseline');
  origin=(left+right)/2;
 }
 assert(Math.abs(origin-anchor[0])<=6,label+' horizontal anchor');
 assert(b.left>0&&b.top>0&&b.left+b.width<p.w&&b.top+b.height<p.h,label+' padding');
 return origin;
}

// This is the complete geometry walk used by both complete sprite commands.
export async function validateSpriteGeometry(p,c,anims,label='sprite'){
 const used=new Set(),measured=[];
 for(const a of Object.values(anims))for(const row of Object.values(a.rows))for(let col=0;col<c.cols;col++){
  const q=await cell(p,col,row,c.cols,c.rows),key=`${row}:${col}`;
  if(col>=a.frames){assert(q.data.every((v,i)=>i%4!==3||!v),label+' unused frame');continue;}
  used.add(key);
  if(Object.hasOwn(c,'groundContact'))assert(c.groundContact&&Object.hasOwn(c.groundContact,key)&&Array.isArray(c.groundContact[key]),label+' missing support '+key);
  measured.push({row,col,origin:frameGeometry(q,c.anchor,c.groundContact?.[key],label+' '+key)});
 }
 if(Object.hasOwn(c,'groundContact'))assert.deepEqual(Object.keys(c.groundContact).sort(),[...used].sort(),label+' complete support metadata');
 return measured;
}
