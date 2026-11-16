// Authorized replacement only: reuse the standard builder with the existing
// cut entry temporarily omitted, then verify its manifest value is unchanged.
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const path='public/assets/manifest.json';const text=await fs.readFile(path,'utf8'),m=JSON.parse(text);const original=await fs.readFile('public/assets/sprites/hero-cut.png');const old=m.sprites['hero-cut'];delete m.sprites['hero-cut'];
await fs.copyFile('assets-src/fight-weapons/hero-cut-attempt-1.png','assets-src/raw/hero-cut-3.png');
try{await fs.writeFile(path,JSON.stringify(m,null,2)+'\n');const p=spawnSync('bun',['tools/sprites/build-story.mjs'],{stdio:'inherit'});if(p.status)throw Error('build failed');const built=JSON.parse(await fs.readFile(path,'utf8')).sprites['hero-cut'];if(JSON.stringify(old)!==JSON.stringify(built))throw Error('cut manifest changed');await fs.copyFile('public/assets/sprites/hero-cut.png','.artifacts/fight-sprites/hero-cut-candidate.png');}finally{await fs.writeFile(path,text);await fs.writeFile('public/assets/sprites/hero-cut.png',original);}
