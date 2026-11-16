import sharp from 'sharp';
import {getAlpha,putAlpha,components,fillHoles,close,edgePaint} from '../../sickness/src/matte.mjs';
let unbanded;const foliage=[];
const beasts=new Set(['stag','lion','tortoise','serpent','bird','elephant']);
export async function retouch(id,b,buf){
 if(id==='wreath'){for(const f of foliage){const x=f.x-b.x,y=f.y-b.y;if(x>=0&&y>=0&&x<b.w&&y<b.h){const i=(y*b.w+x)*4;buf[i]=f.r;buf[i+1]=f.g;buf[i+2]=f.bl;buf[i+3]=255;}}return;}
 if(!beasts.has(id)&&!id.endsWith('-bands'))return;
 let a=getAlpha(buf);if(id.endsWith('-bands')){
 unbanded??=await sharp('demos/opening/cutout/art/gods/src/unbanded-raw.png').resize(1920,1080).ensureAlpha().raw().toBuffer();
 for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){const i=y*b.w+x,p=((y+b.y)*1920+x+b.x)*4;if(!(buf[i*4+1]-unbanded[p+1]>12||unbanded[p+2]-buf[i*4+2]>20))a[i]=0;}
 a=await sharp(a,{raw:{width:b.w,height:b.h,channels:1}}).median(3).toColourspace('b-w').raw().toBuffer();
 }
 const groups=components(a,b.w,b.h).sort((a,b)=>b.q.length-a.q.length);
 const minimum=id.endsWith('-bands')?Math.max(100,groups[0].q.length*(id==='lion-bands'?.12:.06)):groups[0].q.length*.03;
 for(const {q} of groups)if(q.length<minimum){if(beasts.has(id)&&q.length>20&&q.filter(i=>buf[i*4+1]>buf[i*4]*.8&&buf[i*4+1]>buf[i*4+2]*1.4).length>q.length*.12)for(const i of q)foliage.push({x:i%b.w+b.x,y:Math.floor(i/b.w)+b.y,r:buf[i*4],g:buf[i*4+1],bl:buf[i*4+2]});for(const i of q)a[i]=0;}
 a=await close(a,b.w,b.h,1);
 // Cloud swirls, eyelids and feather shading are paint, never transparent cuts.
 for(const {q,edge}of components(a,b.w,b.h,false))if(!edge){
 const ys=q.map(i=>Math.floor(i/b.w)+b.y);const cloud=(id==='elephant'&&Math.min(...ys)>690)||(id==='serpent'&&Math.min(...ys)>520)||(id==='tortoise'&&Math.min(...ys)<480);
 if(cloud||q.length<180)for(const i of q)a[i]=255;
 }
 putAlpha(buf,a);edgePaint(buf,b.w,b.h);
}
