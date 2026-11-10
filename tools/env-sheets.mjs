import fs from 'node:fs';import sharp from 'sharp';
for(const phase of ['before','after','variants']){
 const dir=`.artifacts/env/audit-${phase}`;if(!fs.existsSync(dir))continue;const files=fs.readdirSync(dir).filter(f=>f.endsWith('-low.png')).sort();
 for(let start=0;start<files.length;start+=12){const batch=files.slice(start,start+12),layers=[];for(const [i,file]of batch.entries()){const x=i%3*320,y=Math.floor(i/3)*252;layers.push({input:await sharp(dir+'/'+file).resize(320,230).toBuffer(),left:x,top:y});layers.push({input:Buffer.from(`<svg width="320" height="22"><rect width="320" height="22" fill="#eee9dc"/><text x="8" y="16" font-family="sans-serif" font-size="13">${file}</text></svg>`),left:x,top:y+230});}await sharp({create:{width:960,height:Math.ceil(batch.length/3)*252,channels:3,background:'#eee9dc'}}).composite(layers).png().toFile(`.artifacts/env/audit-${phase}-${start/12+1}.png`);}
}
