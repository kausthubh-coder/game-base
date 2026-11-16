import sharp from 'sharp';
import path from 'node:path';
import {dirFor,specFor,saveSpec,pixels,writePixels,restoreMask,inset} from '../shared/repair.mjs';
const name='king',dir=dirFor(name),spec=await specFor(name);
// Paths traced against four-times enlarged crops of the approved painting.
const paths={
'green':'M70 835 C112 550 225 205 362 202 C436 203 468 250 502 246 L633 218 L750 71 C780 42 800 35 824 45 L916 89 C958 111 988 168 997 204 L988 238 L968 255 L953 232 C976 277 943 294 924 269 L890 217 C865 186 846 204 834 225 L779 355 C744 400 706 416 673 420 L463 605 C437 733 408 867 337 894 C245 919 122 901 70 835 Z',
'red':'M70 840 C120 420 240 100 330 120 C390 145 460 210 510 250 L630 270 C690 250 754 130 794 175 L858 200 C900 230 945 300 949 380 L937 410 L908 395 C930 450 914 490 885 470 L854 425 C899 500 876 560 841 530 L800 440 L773 435 C740 465 725 500 677 565 C646 610 615 660 576 645 L478 635 C427 700 398 820 350 885 C273 950 164 920 70 840 Z',
'blue':'M64 760 C110 487 204 210 284 157 C375 34 430 146 541 303 L646 356 L825 386 C876 500 949 554 964 720 L991 900 L965 929 C945 885 934 700 911 678 L879 635 L900 747 C929 833 913 916 890 929 L840 829 C800 850 760 780 721 757 C675 731 636 703 610 667 L566 584 L438 578 C414 677 376 823 350 925 C260 960 146 900 64 760 Z',
'violet':'M42 833 L56 636 C81 544 116 531 151 455 L277 448 L421 385 C438 315 504 317 560 250 C663 100 766 286 822 462 L909 804 C819 944 731 949 620 970 L570 887 L533 810 L480 714 L395 709 C364 779 319 842 252 839 L207 874 L168 921 L138 955 L115 918 L134 837 L158 776 C134 782 119 810 108 849 L82 924 L55 911 L69 787 L91 712 L75 715 L61 819 Z',
'white':'M25 253 C70 160 127 119 165 96 L297 190 L398 262 L505 230 C576 74 663 73 730 124 C850 229 927 478 950 870 L865 920 C786 949 724 954 661 930 L611 847 L563 773 L524 695 L378 633 C315 671 278 583 235 557 L179 513 L139 548 L108 585 L86 546 L111 434 L146 407 C113 408 96 453 72 484 L49 483 L39 446 L64 372 L102 322 C80 322 57 374 43 399 L20 371 L31 308 L68 254 Z',
'grey':'M28 180 C67 99 126 55 185 67 L300 226 L423 268 L514 249 C583 163 690 203 757 332 C831 464 889 663 919 859 C829 940 732 957 632 939 L600 854 L550 630 L430 560 L320 480 C270 510 220 470 180 430 L154 370 L125 330 L102 360 L78 330 L87 300 L109 270 C77 310 64 355 47 370 L30 346 L40 292 L75 236 C51 242 38 276 23 275 L13 245 L28 196 Z'
};
for(const l of spec.layers.filter(l=>l.id.startsWith('hand-'))){const color=l.id.slice(5),plate=path.resolve(dir,spec.approved);const {data}=await pixels(await sharp(plate).extract({left:l.x,top:l.y,width:l.w,height:l.h}).png().toBuffer());const mask=await sharp(Buffer.from(`<svg width="${l.w}" height="${l.h}" viewBox="0 0 1000 1000" preserveAspectRatio="none"><path d="${paths[color]}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();for(let n=0;n<l.w*l.h;n++)data[n*4+3]=mask[n*4+3];
// Remove boundary-connected plaster highlights within six source pixels of the
// traced contour. The white fabric remains protected as a separate material.
let alpha=Uint8Array.from({length:l.w*l.h},(_,n)=>data[n*4+3]);
for(let pass=0;pass<6;pass++){const next=alpha.slice();for(let y=1;y<l.h-1;y++)for(let x=1;x<l.w-1;x++){const n=y*l.w+x,r=data[n*4],g=data[n*4+1],b=data[n*4+2];const edgeRegion=color==='green'?x>l.w*.9:color==='grey'?y>l.h*.45&&x<l.w*.6:color==='white'?y>l.h*.55&&x<l.w*.55:y>l.h*.6; if(alpha[n]&&edgeRegion&&r>225&&g>200&&b>85&&r-g<42&&[n-1,n+1,n-l.w,n+l.w].some(k=>alpha[k]<80))next[n]=0;}alpha=next;}
// Resolve subpixel loops in the traced finger curves as solid paint.
{const seen=new Uint8Array(alpha.length),q=new Int32Array(alpha.length);let head=0,tail=0;for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++){const n=y*l.w+x;if((x===0||y===0||x===l.w-1||y===l.h-1)&&alpha[n]<100){seen[n]=1;q[tail++]=n;}}while(head<tail){const n=q[head++];for(const a of [n%l.w?n-1:-1,n%l.w<l.w-1?n+1:-1,n-l.w,n+l.w])if(a>=0&&a<alpha.length&&!seen[a]&&alpha[a]<100){seen[a]=1;q[tail++]=a;}}for(let n=0;n<alpha.length;n++)if(!seen[n]&&alpha[n]<100)alpha[n]=255;}
for(let n=0;n<alpha.length;n++)data[n*4+3]=alpha[n];await writePixels(path.join(dir,l.file),data,l.w,l.h);l.note='Cuff and hand retraced on the approved plate. Continuous alpha preserves the pale skin and white sleeve.';}
for(const l of spec.layers.filter(l=>/^(person-|boy$)/.test(l.id))){await restoreMask(name,l);await inset(path.join(dir,l.file));}
// Continuous, evenly spaced ray masks. Color varies with actual gold paint sampled
// from the unoccluded upper rays, so gaps left by the old color key cannot recur.
const l=spec.layers.find(l=>l.id==='rays'),strokes=[];for(let i=0;i<100;i++){const a=i*Math.PI*2/100,dx=Math.cos(a),dy=Math.sin(a),length=1/Math.sqrt(dx*dx/(540*540)+dy*dy/((dy<0?200:550)**2));const endX=960+dx*length,endY=282+dy*length;strokes.push(`<path d="M${960+dx*25} ${282+dy*25} L${endX} ${endY}" stroke="white" stroke-width="${i%3===0?2:1.3}"/>`);}
const mask=await sharp(Buffer.from(`<svg width="${l.w}" height="${l.h}"><g transform="translate(${-l.x},${-l.y})">${strokes.join('')}</g></svg>`)).ensureAlpha().raw().toBuffer();const {data:plate}=await pixels(path.resolve(dir,spec.approved)),out=Buffer.alloc(l.w*l.h*4);
for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++){const n=y*l.w+x,alpha=mask[n*4+3],sample=((105+y%55)*1920+620+x%640)*4,v=(plate[sample]+plate[sample+1]+plate[sample+2])/765;out[n*4]=238+Math.round(v*15);out[n*4+1]=174+Math.round(v*32);out[n*4+2]=37+Math.round(v*30);out[n*4+3]=Math.round(alpha*.78);}
await writePixels(path.join(dir,l.file),out,l.w,l.h);l.note='Even continuous radial masks with texture color sampled from the approved upper gold rays.';
await saveSpec(name,spec);
