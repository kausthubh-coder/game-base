import sharp from 'sharp';
import {getAlpha,putAlpha,components,fillHoles,close,svgMask,restore,edgePaint} from '../../sickness/src/matte.mjs';
const hand=`<path d="M854 834 L854 702 Q852 672 825 643 Q773 593 753 524 Q738 472 715 417 Q702 389 687 371 C674 355 685 345 698 347 Q726 350 748 379 Q772 410 794 447 L815 461 Q833 412 827 373 L811 278 L807 200 Q798 155 814 140 C829 128 848 136 857 150 Q865 168 868 195 L889 306 Q894 334 902 349 Q914 355 916 329 L924 141 Q924 105 937 95 C954 80 973 89 977 105 Q982 119 978 154 L975 325 Q974 347 983 353 Q991 357 997 327 L1032 167 Q1037 140 1053 135 C1069 128 1080 141 1080 154 Q1083 168 1075 204 L1047 342 Q1040 375 1045 390 Q1050 400 1058 380 L1116 264 Q1127 241 1138 237 C1152 231 1159 241 1156 254 Q1155 265 1148 286 L1100 421 Q1091 445 1089 485 Q1086 544 1061 591 Q1051 617 1038 642 Q1027 660 1030 685 L1038 834 Z"/>`;
export async function retouch(id,b,buf,plate){
 if(id==='hand'){
 let a=await svgMask(b,hand);for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){const i=y*b.w+x;if(y+b.y>773)a[i]=Math.round(a[i]*Math.max(0,(834-y-b.y)/61));}
 for(let y=0;y<b.h;y++){let x=0;while(x<b.w){while(x<b.w&&!a[y*b.w+x])x++;const start=x;while(x<b.w&&a[y*b.w+x])x++;const end=x-1;const bg=k=>{const p=((y+b.y)*1920+k+b.x)*4;return plate[p]>210&&plate[p+1]>160&&plate[p+2]>100&&(plate[p]-plate[p+1]<48||plate[p+1]-plate[p+2]<65);};for(let k=start;k<=end&&bg(k);k++)a[y*b.w+k]=0;for(let k=end;k>=start&&bg(k);k--)a[y*b.w+k]=0;}}a=await sharp(a,{raw:{width:b.w,height:b.h,channels:1}}).median(5).blur(.55).toColourspace('b-w').raw().toBuffer();restore(buf,plate,b,a);edgePaint(buf,b.w,b.h);return;
 }
 if(!['elephant','tortoise','stag'].includes(id))return;
 let a=getAlpha(buf);a=await close(a,b.w,b.h,1);
 for(const {q,edge}of components(a,b.w,b.h,false))if(!edge){const y=Math.min(...q.map(i=>Math.floor(i/b.w)+b.y));if((id==='elephant'&&y>885)||(id==='tortoise'&&y<865)||q.length<60)for(const i of q)a[i]=255;}
 putAlpha(buf,a);edgePaint(buf,b.w,b.h);
}
