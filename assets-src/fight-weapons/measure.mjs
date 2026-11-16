// Read-only measurements. Regions exclude weapons. Widths use explicit
// scanlines so a reviewer can audit every span on the measurement overlays.
import sharp from 'sharp';import fs from 'node:fs/promises';
const spec={
hero:{tops:[11,11,15],heads:[[40,88],[40,89],[37,88]],cols:1},
'hero-bow':{tops:[13,14,13],heads:[[29,77],[27,75],[34,82],[34,82],[32,77],[30,75],[38,83],[37,83],[30,74],[29,74],[34,78],[37,82]]},
'hero-staff':{tops:[13,14,15],heads:[[44,93],[28,77],[35,84],[40,88],[37,83],[30,76],[35,82],[40,87],[31,82],[23,73],[30,80],[36,89]]},
'hero-cut':{tops:[16,16,14],heads:[[33,80],[27,75],[31,76],[33,81],[39,91],[30,76],[33,78],[37,83],[32,80],[24,73],[31,80],[33,78]]},
'hero-cut-back':{tops:[13,12,12],heads:[[41,89],[39,87],[32,81],[39,87],[33,81],[38,85],[33,81],[39,86],[40,87],[37,84],[34,81],[41,87]]},
};
const out=[];for(const [name,s]of Object.entries(spec)){const {data,info}=await sharp(`public/assets/sprites/${name}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});const cols=s.cols??4;for(let row=0;row<3;row++)for(let col=0;col<cols;col++){const i=row*cols+col;let [hl,hr]=s.heads[i];if(name==='hero-cut-back'&&col===3)[hl,hr]=spec['hero-cut'].heads[row*4+3];const at=(x,y)=>((row*128+y)*info.width+col*128+x)*4;let crown=128;for(let y=0;y<55;y++)for(let x=25;x<100;x++){const k=at(x,y);if(data[k+3]&&data[k]>data[k+1]*1.15&&data[k+1]>data[k+2]*.9&&data[k]>65)crown=Math.min(crown,y);}const hy=crown+24; // Head span is manually isolated at the widest central hair band.
// Shoulder cross-section: cloak-colored pixels 20px below head scanline.
const sy=hy+30;let xs=[];for(let x=0;x<128;x++){const k=at(x,sy),r=data[k],g=data[k+1],b=data[k+2];if(data[k+3]&&r>120&&r>g*1.12&&g>b*1.12&&g<180)xs.push(x);}const sl=Math.min(...xs),sr=Math.max(...xs);const height=121-crown;out.push({name,row,col,headY:hy,headSpan:[hl,hr],headWidth:hr-hl+1,shoulderY:sy,shoulderSpan:[sl,sr],shoulderWidth:sr-sl+1,standingHeight:height});}}
await fs.writeFile('assets-src/fight-weapons/measurements.json',JSON.stringify({method:'Head: manually selected horizontal hair span near crown+24, not a full head bounding box. Shoulder: warm-colored cross-section 30 pixels below head scanline; includes arms/weapons where they occlude the cloak. Height: first warm hair-colored pixel to foot anchor inclusive; dark crown outline may add 1-2px. These are partial inspection measurements. They DO NOT establish the requested anatomical head/shoulder dimensions within two pixels. Requirement 4 fails.',frames:out},null,2)+'\n');console.log(out.map(x=>`${x.name} ${x.row}/${x.col}: ${x.headWidth}/${x.shoulderWidth}/${x.standingHeight}`).join('\n'));
