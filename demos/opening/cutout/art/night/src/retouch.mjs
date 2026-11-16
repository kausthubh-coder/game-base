import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {svgMask,restore,edgePaint,getAlpha,putAlpha,removeSpecks,fillHoles} from '../../sickness/src/matte.mjs';
const king=`<ellipse cx="957" cy="367" rx="49" ry="46"/>
<path d="M949 393 L974 393 L976 402 Q986 402 1000 411 L1028 418 L1062 409 L1073 404 L1078 395 Q1081 393 1082 397 L1080 405 L1091 402 Q1097 403 1090 408 L1098 405 Q1101 407 1090 413 L1096 410 Q1098 413 1088 417 L1080 421 L1040 433 L1009 435 L1000 461 L990 462 L994 490 L1000 518 L986 523 L986 574 L982 584 L983 618 Q991 619 1003 627 L1006 635 L970 635 L964 631 L958 629 L952 635 L921 635 L923 627 L938 617 L939 584 L930 584 L931 544 L932 524 L924 520 L931 461 L914 457 L913 443 L901 449 L880 448 L866 439 L855 436 Q845 442 845 431 L841 427 L840 418 L846 414 L853 417 L857 423 L869 426 L898 425 L900 416 L919 410 L938 402 L946 402 Z"/>
<path d="M800 383 L812 372 L839 363 L849 362 L855 366 L850 369 L838 372 L901 525 Q901 531 895 529 L831 374 L815 381 Z"/>`;
let cache;
export async function retouch(id,b,buf,plate){
 if(id==='king'){
 const cut=await sharp('demos/opening/cutout/art/night/src/king-raw.png').trim({background:'#00000000',threshold:20}).resize(298,316,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 buf.fill(0);for(let y=0;y<316;y++)for(let x=0;x<298;x++){const to=((y+321-b.y)*b.w+x+800-b.x)*4;cut.copy(buf,to,(y*298+x)*4,(y*298+x+1)*4);}
 const a=getAlpha(buf);removeSpecks(a,b.w,b.h,5);fillHoles(a,b.w,b.h,15);putAlpha(buf,a);edgePaint(buf,b.w,b.h);return;
 }
 if(id!=='dome'&&id!=='stars')return;
 if(!cache){
 const clean=await sharp(plate,{raw:{width:1920,height:1080,channels:4}}).median(9).raw().toBuffer();
 const fullMask=await svgMask({x:0,y:0,w:1920,h:1080},king);
 const manifest=JSON.parse(await readFile('demos/opening/cutout/art/night/layers.json'));const l=manifest.layers.find(l=>l.id==='city');const city=await sharp('demos/opening/cutout/art/night/city.webp').ensureAlpha().raw().toBuffer();const cm=new Uint8Array(1920*1080);for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++)cm[(y+l.y)*1920+x+l.x]=city[(y*l.w+x)*4+3];const empty=await sharp('demos/opening/cutout/art/night/src/dome-raw.png').resize(1920,1080).ensureAlpha().raw().toBuffer();cache={clean,fullMask,cm,empty};
 }
 const {clean,fullMask,cm,empty}=cache;
 for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){
 const i=(y*b.w+x)*4,gx=x+b.x,gy=y+b.y,p=(gy*1920+gx)*4,radius=Math.hypot((gx-944)/638,(gy-876)/592);
 const blue=[13,44,129];
 if(radius>1.015||gy>850){buf[i+3]=0;continue;}
 const star=!cm[gy*1920+gx]&&radius<.97&&plate[p]>180&&plate[p+1]>148&&plate[p]-clean[p]>12;
 const alpha=Math.max(0,Math.min(1,(plate[p]-blue[0])/(255-blue[0])));
 if(id==='stars'){
 // Transfer bright points with their painted colour; their diffuse rays remain in the canopy.
 const a=star&&!fullMask[gy*1920+gx]?Math.min(1,(plate[p]-clean[p])/90):0;
 for(let c=0;c<3;c++)buf[i+c]=Math.max(0,Math.min(255,(plate[p+c]-(1-alpha)*blue[c])/Math.max(alpha,.01)));buf[i+3]=Math.round(a*255);
 }else{
 // Use original canopy colour and geometry. Only star cores are replaced by the local median.
 const covered=fullMask[gy*1920+gx]>0||cm[gy*1920+gx]>0;const src=star?clean:plate;let rgb=[src[p],src[p+1],src[p+2]];
 const ramp=(v)=>Math.max(0,Math.min(1,v));
 const kingWeight=ramp(Math.min(gx-775,1120-gx,gy-290,660-gy)/20);
 const cityWeight=ramp((gy-610)/15);
 let weight=Math.max(kingWeight,cityWeight);
 if(radius>.98&&!cm[gy*1920+gx])weight=0;
 for(let c=0;c<3;c++)rgb[c]=rgb[c]*(1-weight)+empty[p+c]*weight;
 let a=Math.max(0,Math.min(1,(rgb[0]-blue[0])/(255-blue[0])));
 
 for(let c=0;c<3;c++)buf[i+c]=Math.max(0,Math.min(255,(rgb[c]-(1-a)*blue[c])/Math.max(a,.01)));buf[i+3]=Math.round(a*255);
 }
 }
}
