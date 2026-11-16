import {getAlpha,putAlpha,fillHoles,close,svgMask,restore,edgePaint} from './matte.mjs';
export async function retouch(id,b,buf,plate){
 if(id==='ground'||id.startsWith('stone'))return;
 let a=getAlpha(buf);a=await close(a,b.w,b.h,1);fillHoles(a,b.w,b.h,70);
 if(id==='grave-1'){
  // The upper lily is in front of the king's knee. Its own outline is the matte.
  const lilies=await svgMask(b,`<path d="M1307 742 C1290 741 1284 734 1288 732 Q1297 731 1303 736 Q1293 718 1299 721 Q1305 721 1308 733 Q1311 715 1317 721 Q1319 727 1314 737 Q1334 728 1333 735 Q1330 742 1316 744 Q1328 751 1323 756 Q1318 758 1311 748 Q1309 762 1304 760 Q1299 755 1307 742 Z"/>`);
  for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){const i=y*b.w+x,gy=y+b.y,gx=x+b.x;if(gy<746)a[i]=lilies[i];if(((gx-1333)/9)**2+((gy-766)/11)**2<1||((gx-1282)/8)**2+((gy-768)/9)**2<1)a[i]=255;}
 }
 putAlpha(buf,a);edgePaint(buf,b.w,b.h);putAlpha(buf,a);
}
