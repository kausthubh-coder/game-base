import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.dirname(new URL(import.meta.url).pathname);
const W=1920,H=1080;
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function inside(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[1]>y)!==(b[1]>y))&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
const plaster=(r,g,b)=>r>205&&g>145&&b>85&&r>=g&&g>=b&&r-g<80&&g-b<105&&b>r*.40;
async function shot(name,plate){const dir=path.join(root,'..',name);await mkdir(dir,{recursive:true});const raw=await sharp(path.join(root,'../../../art/plates',plate+'.jpg')).ensureAlpha().raw().toBuffer();const layers=[{id:'plaster',file:'../shared/plaster.webp',x:0,y:0,w:W,h:H,z:0}];return {name,dir,raw,layers,used:new Uint8Array(W*H)};}
async function piece(s,id,poly,z,{key=true,pivot=[.5,.95],note='',exclude=[],select=null,fill=null,preserve=[]}={}){
 let x=Math.max(0,Math.floor(Math.min(...poly.map(p=>p[0])))-2),y=Math.max(0,Math.floor(Math.min(...poly.map(p=>p[1])))-2);
 let w=Math.min(W-x,Math.ceil(Math.max(...poly.map(p=>p[0])))-x+3),h=Math.min(H-y,Math.ceil(Math.max(...poly.map(p=>p[1])))-y+3);
 const valid=new Uint8Array(w*h),bg=new Uint8Array(w*h),q=new Int32Array(w*h);let head=0,tail=0;
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const n=j*w+i,k=(y+j)*W+x+i,o=k*4;valid[n]=inside(x+i+.5,y+j+.5,poly)&&!exclude.some(p=>inside(x+i+.5,y+j+.5,p))&&(!select||select(s.raw[o],s.raw[o+1],s.raw[o+2],x+i,y+j))?1:0;if(!valid[n]){bg[n]=1;q[tail++]=n;}}
 if(key){while(head<tail){const n=q[head++];for(const a of [n%w?n-1:-1,n%w<w-1?n+1:-1,n-w,n+w])if(a>=0&&a<w*h&&!bg[a]){const o=((y+Math.floor(a/w))*W+x+a%w)*4;if(plaster(s.raw[o],s.raw[o+1],s.raw[o+2])){bg[a]=1;q[tail++]=a;}}}}
 const out=Buffer.alloc(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const n=j*w+i,k=(y+j)*W+x+i,o=k*4,t=n*4;if(valid[n]&&(!bg[n]||preserve.some(p=>inside(x+i+.5,y+j+.5,p)))){out[t]=s.raw[o];out[t+1]=s.raw[o+1];out[t+2]=s.raw[o+2];out[t+3]=255;s.used[k]=1;}}
 // A subpixel alpha edge softens the cut without carrying adjacent plaster RGB.
 const alpha=await sharp(out,{raw:{width:w,height:h,channels:4}}).extractChannel(3).blur(.35).raw().toBuffer();
 for(let n=0;n<w*h;n++)if(out[n*4+3])out[n*4+3]=alpha[n];
 await sharp(out,{raw:{width:w,height:h,channels:4}}).webp({quality:88,alphaQuality:100}).toFile(path.join(s.dir,id+'.webp'));
 const l={id,file:id+'.webp',x,y,w,h,z,pivot,note};s.layers.push(l);return l;
}
async function save(s){await writeFile(path.join(s.dir,'layers.json'),JSON.stringify({shot:s.name,frame:[W,H],approved:`../../../art/plates/${{war:'m1-war',king:'m2-king',friends:'m3-friends',roads:'m4-roads'}[s.name]}.jpg`,layers:s.layers},null,2)+'\n');}
// War. Cloth ends just short of each upright pole; the pole stays with its army.
const war=await shot('war','m1-war');
const flagBoxes=[[242,272,197,132],[451,283,184,123],[648,288,181,120],[1079,282,188,125],[1278,271,176,131],[1462,270,208,131]];
const colors=['green','red','blue','violet','white','grey'];
for(let i=0;i<6;i++)await piece(war,`banner-${colors[i]}`,i===4?[[1279,298],[1310,282],[1340,286],[1368,310],[1394,330],[1415,327],[1449,351],[1420,351],[1443,385],[1403,379],[1372,391],[1345,390],[1312,370],[1279,356]]:rect(...flagBoxes[i]),40,{key:i!==4,pivot:i<3?[1,.4]:[0,.4],note:'Cloth only. Pole remains with group. Alternate frames are painted-pixel cloth deformations.'});
const groups=[[[203,395],[343,394],[343,260],[451,238],[469,872],[203,872]],rect(469,247,185,625),rect(655,248,203,624),rect(1052,249,215,623),rect(1267,243,188,629),rect(1450,238,266,634)];
for(let i=0;i<6;i++)await piece(war,`group-${colors[i]}`,groups[i],20,{exclude:flagBoxes.map(b=>rect(...b)),note:'Approved painting, with upright spears, banner pole and meadow under feet.'});
await piece(war,'spring',[[859,510],[904,493],[940,474],[987,474],[1029,500],[1054,560],[1063,872],[850,872]],30,{key:false,note:'White-gold fountain; light is separated by luminance from plaster.',select:(r,g,b)=>r>245&&g>222&&b>150});
await piece(war,'rays',[[593,64],[1322,64],[1061,520],[859,520]],5,{select:(r,g,b,x,y)=>!war.used[y*W+x]&&r>225&&g>175&&b<155});
await piece(war,'spring-ground',rect(840,765,220,107),25,{select:(r,g,b,x,y)=>!war.used[y*W+x]&&!plaster(r,g,b)});
await save(war);
// Coronation: masks follow the six cuffs and hands, keeping rays on a separate plane.
const king=await shot('king','m2-king');

const persons=[[[273,505],[480,505],[480,871],[270,871]],rect(459,505,194,366),rect(626,505,197,366),rect(1092,505,206,366),rect(1270,499,197,372),rect(1430,501,210,370)];
for(let i=0;i<6;i++)await piece(king,`person-${colors[i]}`,persons[i],20,{note:'One kneeling representative with lowered banner.'});
const cuffs=[[[529,337],[609,326],[666,344],[730,318],[779,317],[785,341],[740,363],[671,391],[609,421],[529,415]],[[622,286],[685,266],[739,284],[800,275],[840,284],[850,307],[802,324],[748,328],[697,345],[620,336]],[[715,222],[762,211],[813,233],[872,242],[901,268],[901,282],[871,283],[845,263],[796,260],[755,283],[712,275]],[[1006,266],[1030,244],[1090,233],[1129,211],[1192,224],[1198,274],[1164,284],[1119,262],[1067,262],[1032,285],[1007,284]],[[1067,287],[1112,276],[1170,288],[1220,277],[1272,302],[1277,343],[1226,342],[1172,325],[1120,318],[1070,305]],[[1139,324],[1171,317],[1219,337],[1283,342],[1310,327],[1361,353],[1379,405],[1360,420],[1291,414],[1253,392],[1196,373],[1148,350]]];
for(let i=0;i<6;i++)await piece(king,`hand-${colors[i]}`,cuffs[i],40,{pivot:i<3?[0,.5]:[1,.5],key:false,note:'Hand and colored cuff, polygon follows painted contour.'});
await piece(king,'crown',[[774,314],[808,294],[850,277],[902,270],[1007,270],[1060,281],[1100,300],[1148,326],[1145,334],[1097,308],[1057,289],[1006,281],[901,281],[852,286],[812,302],[777,322]],35,{key:false,pivot:[.5,.5]});
await piece(king,'boy',[[866,319],[1019,311],[1025,381],[1059,385],[1063,430],[1041,429],[1040,488],[1053,523],[1047,570],[1027,579],[1024,645],[1015,795],[1038,853],[1023,864],[975,858],[953,861],[891,860],[895,834],[902,798],[894,651],[878,604],[864,539],[868,479],[885,424],[868,393]],30,{note:'Boy, halo and hoe. No crown attached.'});
await piece(king,'spring',[[813,390],[873,370],[905,403],[1010,395],[1080,384],[1102,485],[1070,862],[810,862]],10,{key:false,select:(r,g,b)=>r>247&&g>227&&b>155});
await piece(king,'flowers',rect(246,749,1432,120),15,{select:(r,g,b,x,y)=>!king.used[y*W+x]&&(y>850||g>r*.72&&g<155||r>180&&g<160||r>230&&g>215&&b>150)});
await piece(king,'rays',[[400,80],[1510,80],[1470,670],[1080,850],[840,850],[415,650]],5,{select:(r,g,b,x,y)=>!king.used[y*W+x]&&r>230&&g>178&&b<150});
await save(king);
// Friends. Preserve original spacing; extend only the wall for the travelling camera.
const friends=await shot('friends','m3-friends');
const boxes=[[215,215,202,635],[416,217,176,633],[589,218,179,632],[766,218,192,632],[951,220,177,630],[1124,223,180,627],[1305,220,174,630]];
for(let i=0;i<7;i++)await piece(friends,i===0?'boy':`friend-${colors[i-1]}`,rect(...boxes[i]),20,{preserve:i===5?[[[1150,372],[1191,390],[1269,370],[1281,522],[1269,680],[1222,780],[1166,804],[1154,664],[1148,540]]]:[],note:'Approved figure with its original halo and carried object.'});
await piece(friends,'scraped-place',[[1549,226],[1592,232],[1619,262],[1616,296],[1592,321],[1593,341],[1625,358],[1650,384],[1660,447],[1669,510],[1676,582],[1658,606],[1643,592],[1632,504],[1634,624],[1618,724],[1620,805],[1634,840],[1580,848],[1572,816],[1558,762],[1547,805],[1544,843],[1508,847],[1494,837],[1516,795],[1513,723],[1505,637],[1513,539],[1507,491],[1499,586],[1484,588],[1479,551],[1488,455],[1485,402],[1503,371],[1536,350],[1541,325],[1519,298],[1507,269],[1521,240]],15,{key:false,note:'Opaque scraped plaster silhouette and chisel marks; deliberately plaster colored.'});
await piece(friends,'fox',[[1603,714],[1621,712],[1635,723],[1654,721],[1663,732],[1655,749],[1663,768],[1680,791],[1685,831],[1675,849],[1602,852],[1599,838],[1608,819],[1607,786],[1604,757]],30,{preserve:[[[1616,736],[1626,754],[1620,781],[1623,818],[1614,828],[1609,790],[1608,752]]],note:'Fox alone. Tail animation frame preserves head and torso.'});
await piece(friends,'meadow',rect(205,743,1516,110),10,{select:(r,g,b,x,y)=>!friends.used[y*W+x]&&(y>837||g>r*.72&&g<155||r>180&&g<160||r>230&&g>215&&b>150)});
await piece(friends,'rays',[[424,84],[1348,84],[1263,237],[575,237]],5,{select:(r,g,b,x,y)=>!friends.used[y*W+x]&&r>230&&g>178&&b<155});
// Camera gets 960px additional wall on each side, preserving all figure-to-figure distances.
for(const l of friends.layers){l.x+=960;if(l.id==='plaster'){l.x=0;l.w=3840;l.file='../shared/plaster-wide.webp';}}
await save(friends);
const fs=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(friends.dir,'layers.json'),'utf8'));fs.frame=[3840,1080];fs.note='Approved 1920px composition centered in a 3840px wall; subtract 960 from x to recover plate positions.';await writeFile(path.join(friends.dir,'layers.json'),JSON.stringify(fs,null,2)+'\n');
// Roads. Exact original paint is used in all visible layers. The regenerated clean
// map supplies only paint previously hidden under a city, ship or road.
const roads=await shot('roads','m4-roads');
const clean=await sharp(path.join(roads.dir,'src/clean-map-raw.png')).resize(W,H).ensureAlpha().raw().toBuffer();
const cityPolys=[[[775,548],[778,491],[798,469],[807,437],[829,446],[836,411],[856,398],[866,370],[881,357],[891,388],[909,407],[911,383],[937,354],[958,327],[977,351],[1006,371],[1013,406],[1035,381],[1053,407],[1058,433],[1084,417],[1102,447],[1105,476],[1128,487],[1136,550],[1121,586],[1092,606],[1017,622],[926,630],[843,611],[794,586]],[[623,235],[623,195],[645,187],[650,165],[681,163],[688,128],[712,118],[725,103],[739,123],[755,143],[767,132],[771,107],[782,97],[790,131],[802,151],[805,183],[826,181],[828,203],[842,203],[842,242],[821,261],[774,273],[701,273],[652,262]],[[1069,236],[1072,194],[1093,181],[1104,167],[1108,140],[1119,130],[1126,111],[1138,138],[1155,141],[1158,121],[1176,111],[1182,102],[1190,123],[1212,135],[1220,160],[1246,169],[1246,187],[1269,185],[1275,207],[1287,211],[1287,247],[1252,266],[1163,277],[1101,259]],[[428,530],[429,485],[450,475],[462,454],[486,449],[490,424],[515,419],[521,391],[540,381],[545,365],[555,386],[571,393],[578,429],[602,424],[611,443],[622,447],[622,468],[642,482],[641,539],[618,558],[566,576],[494,570],[449,552]],[[1236,538],[1235,489],[1263,474],[1277,454],[1294,450],[1309,429],[1316,411],[1332,395],[1344,365],[1352,385],[1368,396],[1381,426],[1406,429],[1424,443],[1425,466],[1445,476],[1463,492],[1465,542],[1434,562],[1371,578],[1290,569]],[[637,837],[637,795],[655,779],[668,775],[680,753],[707,748],[713,719],[737,707],[754,689],[765,677],[776,706],[795,717],[801,743],[827,748],[837,774],[855,780],[859,811],[850,850],[828,872],[760,885],[687,876],[650,859]],[[1047,843],[1047,798],[1067,781],[1076,754],[1097,751],[1107,725],[1125,709],[1137,683],[1145,704],[1164,714],[1177,735],[1195,742],[1203,762],[1225,772],[1241,789],[1259,792],[1263,841],[1244,866],[1185,885],[1121,882],[1070,864]]];
const cityNames=['center','northwest','northeast','west','east','southwest','southeast'];
for(let i=0;i<7;i++)await piece(roads,`city-${cityNames[i]}`,cityPolys[i],40,{key:false,note:'Original city icon with people and luminous throat stones.'});
const ships=[[[385,281],[414,277],[420,244],[436,246],[438,214],[447,216],[450,244],[466,246],[479,270],[474,284],[489,282],[485,304],[468,316],[418,315],[398,300]],[[1417,285],[1446,282],[1448,250],[1460,246],[1465,213],[1474,216],[1476,246],[1491,248],[1506,274],[1500,287],[1519,282],[1510,307],[1482,319],[1440,312]],[[296,505],[322,507],[330,476],[344,471],[346,442],[353,441],[357,473],[377,478],[384,501],[374,516],[395,513],[384,538],[358,551],[326,546],[309,530]],[[1504,534],[1526,534],[1536,508],[1548,503],[1549,476],[1558,474],[1562,505],[1580,511],[1588,534],[1577,544],[1598,542],[1585,563],[1549,576],[1519,563]]];
// The approved map contains SIX ships, so preserve the two lower ones too.
ships.push([[354,769],[381,769],[386,735],[401,732],[404,702],[411,703],[413,733],[433,738],[447,766],[435,783],[457,779],[443,804],[412,819],[377,809],[360,790]],[[1438,774],[1461,775],[1464,740],[1480,740],[1483,713],[1491,715],[1494,742],[1518,752],[1528,777],[1517,793],[1539,789],[1525,812],[1495,821],[1462,809]]);
for(let i=0;i<ships.length;i++)await piece(roads,`ship-${i+1}`,ships[i],30,{key:false,note:'Approved ship. Six are visible in the reference, all retained.'});
// Road masks follow the six spokes and the continuous ring. Reveal each branch
// from the center anchor (960,520); reveal ring by arc length after the spokes.
const roadPaths=['M960 520 L730 235','M960 520 L1180 235','M960 520 L540 520','M960 520 L1350 520','M960 520 L750 824','M960 520 L1150 824','M730 235 C830 163 1060 163 1180 235 C1350 330 1428 671 1150 824 C1020 872 860 872 750 824 C520 742 467 440 730 235'];
const roadMask=await sharp(Buffer.from(`<svg width="1920" height="1080"><g fill="none" stroke="white" stroke-width="39">${roadPaths.map(d=>`<path d="${d}"/>`).join('')}</g></svg>`)).ensureAlpha().raw().toBuffer();
await piece(roads,'roads',rect(500,165,873,709),25,{key:false,select:(r,g,b,x,y)=>!roads.used[y*W+x]&&roadMask[(y*W+x)*4+3]>0&&r>195&&g>140&&r>g*1.09,note:'Roads reveal outward from center [960,520]. Six spokes followed by ring. See road-paths.json.'});
await writeFile(path.join(roads.dir,'road-paths.json'),JSON.stringify({center:[960,520],strokeWidth:39,paths:roadPaths},null,2)+'\n');
// Find the painted coastline in each scanline using its green interior.
const bounds=[];for(let y=0;y<H;y++){let left=W,right=-1;for(let x=300;x<1600;x++){const o=(y*W+x)*4,r=roads.raw[o],g=roads.raw[o+1],b=roads.raw[o+2];if(g>r*1.02&&g>b*1.15&&g>70){left=Math.min(left,x);right=Math.max(right,x);}}bounds[y]=[left-9,right+9];}
for(let y=48;y<1013;y++){const near=bounds.slice(Math.max(0,y-8),Math.min(H,y+9)).filter(v=>v[0]<v[1]);if(near.length){bounds[y]=[near.map(v=>v[0]).sort((a,b)=>a-b)[Math.floor(near.length/2)],near.map(v=>v[1]).sort((a,b)=>a-b)[Math.floor(near.length/2)]];}}
const coast=[];for(let y=48;y<=1012;y+=4){const [l,r]=bounds[y];if(l<r)coast.push([l,y]);}for(let y=1012;y>=48;y-=4){const [l,r]=bounds[y];if(l<r)coast.push([r,y]);}
const original=roads.raw;
// Restore underlying paint only where another layer removed it.
roads.raw=Buffer.from(original);for(let n=0;n<W*H;n++){const x=n%W,y=Math.floor(n/W),[left,right]=bounds[y];if(roads.used[n]||(x>left+8&&x<right-8))clean.copy(roads.raw,n*4,n*4,n*4+4);}
await piece(roads,'island',coast,20,{key:false,note:'Regenerated clean island vegetation inside the approved coastline. No roads or cities baked in. Raw and prompt in src/.'});
// Sea is a complete wave disk behind the island; ship removal masks use clean sea.
// Continue the approved sea texture behind the whole island, with no land painted into this layer.
for(let y=40;y<1040;y++)for(let x=200;x<1690;x++)if(inside(x+.5,y+.5,coast)){const source=((560+y%64)*W+280+x%64)*4;original.copy(roads.raw,(y*W+x)*4,source,source+4);}
await piece(roads,'sea',rect(200,40,1490,1000),10,{note:'Original wave edge; repeated original sea paint continues under island. No land, city, ship or road remains in this layer.'});
await save(roads);
