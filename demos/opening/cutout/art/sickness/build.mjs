// Rebuild the four cutout shots from their approved plates. No external packages beyond sharp.
import sharp from 'sharp';
import {retouch as retouchSickness} from './src/retouch.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';
const root=path.resolve('demos/opening/cutout/art');
const out=path.resolve('.artifacts/opening/art-b');
const W=1920,H=1080;
const sources={sickness:'m5-sickness',night:'m6-ascent',gods:'m7-gods',mark:'m8-hand'};
const raw=async p=>sharp(p).resize(W,H).ensureAlpha().raw().toBuffer();
const plates={};for(const [s,p] of Object.entries(sources))plates[s]=await raw(`demos/opening/art/plates/${p}.jpg`);
const generated=await raw(`${root}/gods/src/unbanded-raw.png`);
const emptyDome=await raw(`${root}/night/src/dome-raw.png`);
let shot,layers,original;
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function inside(x,y,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>y)!==(poly[j][1]>y)&&x<(poly[j][0]-poly[i][0])*(y-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])c=!c;return c;}
function near(x,y,poly,d=18){if(inside(x,y,poly))return true;for(let i=0;i<poly.length;i++){const [a,b]=poly[i],[c,e]=poly[(i+1)%poly.length],t=Math.max(0,Math.min(1,((x-a)*(c-a)+(y-b)*(e-b))/((c-a)**2+(e-b)**2)));if(Math.hypot(x-a-t*(c-a),y-b-t*(e-b))<d)return true;}return false;}
function bounds(poly){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);const x=Math.max(0,Math.floor(Math.min(...xs))-2),y=Math.max(0,Math.floor(Math.min(...ys))-2);return {x,y,w:Math.min(W-x,Math.ceil(Math.max(...xs))-x+3),h:Math.min(H-y,Math.ceil(Math.max(...ys))-y+3)};}
function mask(poly,source=original,mode='plaster'){
 const b=bounds(poly),a=new Uint8Array(b.w*b.h),bg=new Uint8Array(a.length),seen=new Uint8Array(a.length),queue=[];
 for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){let i=y*b.w+x,p=((y+b.y)*W+x+b.x)*4;const [r,g,bl]=source.subarray(p,p+3);a[i]=inside(x+b.x,y+b.y,poly)?255:0;bg[i]=mode==='blue'?(bl>r*.85&&bl>g*.85?1:0):(mode==='none'?0:(r>208&&g>166&&bl>112&&r-g>22&&r-g<71&&g-bl>18?1:0));if(!a[i]||x===0||y===0||x===b.w-1||y===b.h-1){queue.push(i);seen[i]=1;}}
 for(let q=0;q<queue.length;q++){const i=queue[q];if(!a[i]||bg[i]){a[i]=0;for(const j of [i-1,i+1,i-b.w,i+b.w])if(j>=0&&j<a.length&&!seen[j]&&(bg[j]||!a[j])){seen[j]=1;queue.push(j);}}}

 if(mode==='plaster'){for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){const gx=x+b.x,gy=y+b.y,i=y*b.w+x,p=(gy*W+gx)*4;
 const clouds=shot==='gods'?[[1015,719,38,23],[994,749,32,22],[1005,771,32,24],[1115,840,42,22],[1180,836,38,25],[1245,830,50,27],[1304,815,45,30],[1375,800,44,25],[1400,780,30,19]]:shot==='mark'?[[996,918,25,14],[1030,929,30,16],[1080,933,34,15],[1125,926,25,16],[1160,915,18,15]]:[];
 if(clouds.some(([cx,cy,rx,ry])=>((gx-cx)/rx)**2+((gy-cy)/ry)**2<1)&&inside(gx,gy,poly)&&source[p]>225&&source[p+1]>181&&source[p+2]>122)a[i]=255;
 if((shot==='gods'&&gy<264||shot==='mark'&&gy<795&&gx<480)&&bg[i])a[i]=0;
 }}
 return {b,a};
}
function pixels(source,b,a){const buf=Buffer.alloc(b.w*b.h*4);for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){const p=((y+b.y)*W+x+b.x)*4,i=y*b.w+x;source.copy(buf,i*4,p,p+3);buf[i*4+3]=a[i];}return buf;}
async function save(id,b,buf,z,note='',extra={}){
 const file=`${id}.webp`;
 if(shot!=='sickness'&&existsSync(`${root}/${shot}/src/retouch.mjs`)){const {retouch}=await import(`../${shot}/src/retouch.mjs`);await retouch(id,b,buf,original);}
 if(shot==='sickness')await retouchSickness(id,b,buf,original);
 // Soften the one-pixel extraction boundary without blurring the paint.
 if(id!=='ground'){const alpha=await sharp(buf,{raw:{width:b.w,height:b.h,channels:4}}).extractChannel(3).blur(.4).raw().toBuffer();for(let i=0;i<alpha.length;i++)buf[i*4+3]=Math.min(buf[i*4+3],alpha[i]);}
 await sharp(buf,{raw:{width:b.w,height:b.h,channels:4}}).webp({quality:88,alphaQuality:100}).toFile(`${root}/${shot}/${file}`);
 layers.push({id,file,...b,z,pivot:[.5,.9],...(note?{note}:{}),...extra});return layers.at(-1);
}
async function piece(id,poly,z,note='',source=original,mode=shot==='night'?'blue':'plaster',extra={}){const {b,a}=mask(poly,source,mode);return save(id,b,pixels(source,b,a),z,note,extra);}
async function ground(){const tile=await sharp(original,{raw:{width:W,height:H,channels:4}}).extract({left:40,top:290,width:200,height:200}).toBuffer();const comps=[];for(let y=0;y<H;y+=200)for(let x=0;x<W;x+=200){let im=sharp(tile,{raw:{width:200,height:200,channels:4}});if((x/200)%2)im=im.flop();if((y/200)%2)im=im.flip();comps.push({input:await im.extract({left:0,top:0,width:Math.min(200,W-x),height:Math.min(200,H-y)}).png().toBuffer(),left:x,top:y});}
 for(const [y,h]of[[0,32],[1048,32]])comps.push({input:await sharp(original,{raw:{width:W,height:H,channels:4}}).extract({left:0,top:y,width:W,height:h}).png().toBuffer(),left:0,top:y});
 const buf=await sharp({create:{width:W,height:H,channels:4,background:'#000'}}).composite(comps).raw().toBuffer();await save('ground',{x:0,y:0,w:W,h:H},buf,0,'Mirrored empty plaster patch from the approved plate; original gold edge bands.');}
async function begin(s){shot=s;layers=[];original=plates[s];await mkdir(`${root}/${s}`,{recursive:true});await ground();layers[0].id='plaster-ground';}
async function end(meta={}){await writeFile(`${root}/${shot}/layers.json`,JSON.stringify({shot,frame:[W,H],approved:`../../../art/plates/${sources[shot]}.jpg`,layers,...meta},null,2)+'\n');}
if(!process.argv[2]||process.argv[2]==='sickness'){
await begin('sickness');
const beds=[rect(295,221,265,305),rect(560,221,216,305),rect(776,221,222,305),rect(998,221,225,305),rect(280,545,265,313),rect(545,545,220,313),rect(765,545,216,313),rect(981,545,226,313)];
const stones=[[446,318],[665,318],[874,317],[1090,318],[425,643],[648,643],[859,644],[1074,643]];
for(let n=0;n<8;n++){
 const {b,a}=mask(beds[n]),src=Buffer.from(original),[cx,cy]=stones[n];
 // Remove the painted stone from the bed; the two separate drawings cover this small repair.
 for(let y=cy-7;y<=cy+7;y++)for(let x=cx-7;x<=cx+7;x++)if(((x-cx)/7)**2+((y-cy)/7)**2<1){let p=(y*W+x)*4,k=(y*W+cx+10)*4;src[p]=original[k];src[p+1]=original[k+1];src[p+2]=original[k+2];}
 await save(`bed-${n+1}`,b,pixels(src,b,a),10,'Sleeper, bed and adjacent flowers; throat stone is separate.');
 const sb={x:cx-8,y:cy-8,w:17,h:17},sa=new Uint8Array(289);for(let y=0;y<17;y++)for(let x=0;x<17;x++)sa[y*17+x]=Math.max(0,Math.min(255,(1-Math.hypot((x-8)/7,(y-8)/7))*1500));
 const dim=pixels(original,sb,sa),bright=Buffer.from(dim);for(let i=0;i<dim.length;i+=4){const shade=100+Math.round((dim[i]+dim[i+1]+dim[i+2])/15);dim[i]=shade;dim[i+1]=shade;dim[i+2]=shade+3;}for(let i=0;i<bright.length;i+=4){bright[i]=255;bright[i+1]=212+Math.floor(dim[i+1]*.12);bright[i+2]=90;}
 await save(`stone-${n+1}`,sb,bright,20,'Bright throat stone; frames[0] is dim.',{frames:[`stone-${n+1}-dim.webp`]});await sharp(dim,{raw:{width:17,height:17,channels:4}}).webp({lossless:true}).toFile(`${root}/${shot}/stone-${n+1}-dim.webp`);
}
await piece('king',[[1206,744],[1210,666],[1248,635],[1271,533],[1278,468],[1324,416],[1336,328],[1371,296],[1439,293],[1487,328],[1501,353],[1495,405],[1480,444],[1489,444],[1498,374],[1502,337],[1532,335],[1572,367],[1568,380],[1531,370],[1476,744]],15);
const graves=[[[1208,857],[1241,823],[1261,804],[1260,775],[1248,763],[1264,750],[1272,723],[1304,720],[1321,743],[1345,746],[1358,777],[1341,804],[1373,831],[1379,857]],[[1360,857],[1375,827],[1390,807],[1381,788],[1373,774],[1391,750],[1406,733],[1430,732],[1446,753],[1462,775],[1457,801],[1480,827],[1485,857]],[[1472,857],[1486,821],[1503,803],[1493,782],[1482,768],[1494,749],[1505,722],[1531,719],[1549,743],[1561,758],[1579,783],[1561,807],[1590,835],[1626,857]]];for(let n=0;n<3;n++)await piece(`grave-${n+1}`,graves[n],25);
await end();
}
if(!process.argv[2]||process.argv[2]==='mark'){
await begin('mark');
const hand=[[853,834],[845,697],[812,648],[779,600],[755,554],[742,503],[716,430],[681,372],[680,350],[700,342],[729,354],[756,384],[785,436],[817,462],[826,421],[829,385],[815,305],[805,212],[803,165],[815,137],[838,132],[855,146],[866,181],[881,275],[895,338],[906,349],[914,329],[919,204],[924,122],[937,91],[961,88],[979,99],[981,138],[976,245],[977,338],[985,353],[996,320],[1020,210],[1037,145],[1055,130],[1074,136],[1084,154],[1076,207],[1059,303],[1045,366],[1045,391],[1053,393],[1080,333],[1119,253],[1138,231],[1154,237],[1160,253],[1151,287],[1125,360],[1098,437],[1092,492],[1078,555],[1058,606],[1030,656],[1036,834]];
const hm=mask(hand,original,'none');const handAlpha=hm.a.slice();for(let y=1;y<hm.b.h-1;y++)for(let x=1;x<hm.b.w-1;x++){const i=y*hm.b.w+x;if(!handAlpha[i-1]||!handAlpha[i+1]||!handAlpha[i-hm.b.w]||!handAlpha[i+hm.b.w])hm.a[i]=0;}hm.a.forEach((v,i)=>{if(v){const yy=Math.floor(i/hm.b.w)+hm.b.y;if(yy>773)hm.a[i]=Math.round(255*Math.max(0,(834-yy)/61));}});
await save('hand',hm.b,pixels(original,hm.b,hm.a),20,'Wrist fades at the original ground line.',{pivot:[.5,1]});
const rayPoly=rect(280,35,1320,775),rm=mask(rayPoly);for(let y=0;y<rm.b.h;y++)for(let x=0;x<rm.b.w;x++){const i=y*rm.b.w+x,gx=x+rm.b.x,gy=y+rm.b.y,p=(gy*W+gx)*4;rm.a[i]=(gy<750&&!inside(gx,gy,hand)&&original[p]>192&&original[p+1]>133&&original[p+2]<132)?255:0;}
await save('rays',rm.b,pixels(original,rm.b,rm.a),10,'Extracted gold rays, no hand or palm points.',{pivot:[.5,.65]});
for(const [n,p]of [['stag',rect(224,750,264,202)],['lion',rect(488,791,221,161)],['serpent',rect(709,797,245,155)],['elephant',rect(954,802,241,150)],['bird',rect(1195,800,232,152)],['tortoise',rect(1427,795,273,157)]])await piece(n,p,30);
await end({mark:{center:[950,520],radius:100,points:7,darkPoint:6},palmCenter:[950,520],markRadius:100});
}
if(!process.argv[2]||process.argv[2]==='gods'){
await begin('gods');
const beasts={stag:[[517,413],[518,300],[572,260],[577,164],[953,164],[954,262],[908,299],[908,387],[858,416]],lion:[[974,187],[1367,175],[1382,306],[1375,431],[1262,439],[1112,413],[974,405]],tortoise:[[351,404],[637,402],[658,472],[746,505],[753,635],[388,641],[350,594]],serpent:[[1154,418],[1281,400],[1493,395],[1534,493],[1556,608],[1516,650],[1214,651],[1151,592]],bird:[[482,638],[647,625],[814,623],[888,690],[899,836],[833,864],[511,858],[477,802]],elephant:[[971,638],[1080,618],[1216,617],[1396,655],[1440,794],[1424,852],[1076,866],[970,806]]};
const bandPolys={stag:[[[534,320],[556,322],[566,359],[590,365],[620,327],[654,316],[675,297],[692,276],[742,276],[722,311],[699,335],[658,353],[639,385],[615,409],[593,402],[589,382],[555,385],[537,370]]],lion:[[[1090,350],[1140,362],[1171,358],[1191,325],[1213,287],[1262,267],[1316,275],[1344,298],[1364,345],[1354,375],[1329,394],[1275,400],[1253,384],[1299,381],[1323,368],[1331,346],[1326,312],[1306,296],[1271,291],[1244,304],[1224,341],[1202,368],[1170,380],[1122,374]]],tortoise:[[[379,503],[401,497],[400,532],[440,547],[478,544],[508,516],[538,486],[576,469],[618,470],[647,487],[648,506],[616,489],[581,494],[557,522],[536,557],[516,600],[490,618],[468,616],[484,591],[491,569],[453,568],[421,566],[390,555],[378,536]]],serpent:[[[1200,555],[1213,555],[1217,583],[1241,599],[1275,589],[1303,562],[1339,544],[1367,517],[1387,491],[1424,479],[1466,479],[1499,489],[1523,508],[1532,532],[1514,521],[1488,507],[1462,503],[1433,507],[1417,528],[1396,555],[1359,573],[1333,585],[1297,614],[1261,625],[1226,620],[1206,600]],[[1281,528],[1317,529],[1357,547],[1380,575],[1418,600],[1460,618],[1511,610],[1498,625],[1462,632],[1412,625],[1374,606],[1347,585],[1328,559],[1302,547]]],bird:[[[508,710],[536,676],[570,664],[604,671],[639,697],[676,725],[654,744],[621,718],[589,695],[559,692],[535,703]],[[872,712],[884,739],[875,777],[847,807],[806,835],[763,851],[714,855],[740,833],[779,817],[815,795],[842,770],[854,746],[850,733]],[[619,749],[642,762],[599,780],[562,799],[550,819],[561,832],[539,828],[525,808],[531,785],[561,768]]],elephant:[[[1131,625],[1166,626],[1201,648],[1226,685],[1235,727],[1261,732],[1291,702],[1296,665],[1316,675],[1328,705],[1318,731],[1288,752],[1243,761],[1195,747],[1153,755],[1134,748],[1178,727],[1206,726],[1198,688],[1175,651]],[[1379,697],[1399,730],[1386,756],[1351,773],[1323,779],[1326,761],[1357,743],[1374,722]],[[1226,764],[1248,767],[1255,805],[1229,815]] ]};
const beastMasks={};for(const[n,p]of Object.entries(beasts)){
 const m=mask(p,generated),om=mask(p,original),base=pixels(generated,m.b,m.a),ba=new Uint8Array(m.a.length);
 for(let y=0;y<m.b.h;y++)for(let x=0;x<m.b.w;x++){const i=y*m.b.w+x,gx=x+m.b.x,gy=y+m.b.y,pix=(gy*W+gx)*4;if(om.a[i]&&original[pix]>188&&original[pix+1]>115&&original[pix+1]-original[pix+2]>70&&bandPolys[n].some(poly=>near(gx,gy,poly,22))){ba[i]=255;generated.copy(base,i*4,pix,pix+3);}}
 await save(n,m.b,base,20,'Unbanded drawing from src/unbanded-raw.png, registered to the approved plate.');await save(`${n}-bands`,m.b,pixels(original,m.b,ba),30,`Move with ${n}; same box and pivot.`);beastMasks[n]=m;
}
// Leaves and flowers outside the beast silhouettes form their own moving wreath.
const wm=mask(rect(350,165,1208,718));for(let y=0;y<wm.b.h;y++)for(let x=0;x<wm.b.w;x++){const gx=x+wm.b.x,gy=y+wm.b.y,i=y*wm.b.w+x;if(Object.values(beasts).some(p=>inside(gx,gy,p))||Math.hypot((gx-951)/235,(gy-553)/192)<1)wm.a[i]=0;}
await save('wreath',wm.b,pixels(original,wm.b,wm.a),10,'Leaves and flowers outside beast pieces; their foreground foliage travels with each beast.');const sm=mask(rect(740,379,440,351));for(let y=0;y<sm.b.h;y++)for(let x=0;x<sm.b.w;x++){const gx=x+sm.b.x,gy=y+sm.b.y,p=(gy*W+gx)*4;if(gy<=576&&((gx-951)/129)**2+((gy-576)/109)**2<1){sm.a[y*sm.b.w+x]=255;continue;}if(Object.values(beasts).some(poly=>inside(gx,gy,poly))||!(original[p]>190&&original[p+1]>125&&original[p+2]<150))sm.a[y*sm.b.w+x]=0;}await save('sun',sm.b,pixels(original,sm.b,sm.a),15);
await end();
}
if(!process.argv[2]||process.argv[2]==='night'){
await begin('night');
// The canopy is a blue/gold translucent film. Original blue is removed algebraically.
const db={x:302,y:276,w:1280,h:599},da=new Uint8Array(db.w*db.h),dome=pixels(original,db,da),stars=Buffer.from(dome);
for(let y=0;y<db.h;y++)for(let x=0;x<db.w;x++){const gx=x+db.x,gy=y+db.y,i=(y*db.w+x)*4,p=(gy*W+gx)*4,r=emptyDome[p],g=emptyDome[p+1],b=emptyDome[p+2];const radius=Math.hypot((gx-944)/638,(gy-876)/592);if(radius<1.015&&gy<850){const a=Math.max(0,Math.min(1,(r-12)/220));dome[i]=255;dome[i+1]=205;dome[i+2]=115;dome[i+3]=Math.round(a*255);if(original[p]>220&&original[p+1]>190&&original[p+2]>100&&radius<.97){stars[i]=original[p];stars[i+1]=original[p+1];stars[i+2]=original[p+2];stars[i+3]=255;}}}
await save('dome',db,dome,10,'Regenerated canopy without city or king. Reveal with two angular wedges from bottom edges to apex [944,284].',{pivot:[.5,1]});
const cityPoly=[[292,879],[301,817],[318,784],[364,752],[381,703],[447,706],[477,647],[523,621],[562,655],[595,639],[609,689],[647,688],[658,654],[704,633],[747,658],[771,636],[787,686],[825,680],[824,635],[1096,635],[1097,680],[1122,647],[1145,680],[1160,677],[1178,655],[1213,679],[1233,706],[1268,696],[1289,641],[1309,620],[1334,649],[1337,710],[1376,723],[1394,757],[1404,711],[1437,680],[1457,687],[1474,709],[1497,759],[1527,740],[1575,782],[1584,815],[1604,879]];
await piece('city',cityPoly,30,'All open doors are preserved. Light origins are in lightPaths.');
const kp=[[800,376],[824,364],[849,361],[861,369],[841,375],[867,413],[902,405],[905,348],[928,321],[957,313],[987,329],[1009,367],[1000,396],[1018,410],[1067,397],[1072,389],[1083,395],[1098,404],[1089,420],[1043,440],[1006,442],[992,469],[1001,514],[990,528],[989,608],[1008,623],[1009,637],[967,637],[959,625],[950,636],[918,637],[919,622],[932,614],[930,533],[921,524],[923,470],[905,444],[873,439],[886,487],[903,525],[895,535],[883,525],[846,444],[840,433],[833,419],[836,413],[823,377]];
await piece('king',kp,40,'King, halo and hoe, isolated from the canopy.',original,'blue',{pivot:[.5,1]});
// Exclude king and city from the star layer.
for(let y=0;y<db.h;y++)for(let x=0;x<db.w;x++)if(inside(x+db.x,y+db.y,kp)||inside(x+db.x,y+db.y,cityPoly))stars[(y*db.w+x)*4+3]=0;
await save('stars',db,stars,20,'Painted points from the approved streams. Code may fade these out while emitting travelling lights.');
await end({dome:{apex:[944,284],center:[944,876],radius:[638,592],reveal:'two wedges from left and right spring points toward apex'},lightPaths:[[365,847],[460,846],[590,842],[731,847],[817,842],[953,838],[1090,844],[1215,845],[1360,842],[1519,846]].map((from,i)=>({id:`house-${i+1}`,from,to:[957,391]}))});
}
await mkdir(out,{recursive:true});
console.log('Built four cutout shots. Run check.mjs for geometry and proof sheets.');
