import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {root,pixels,cell,readJSON,writeJSON} from './lib.mjs';
import {banding,bandThreshold} from './banding.mjs';
try { await fs.access(root+'assets-src/block-baseline-2.json'); throw Error('Baseline already recorded; refusing to replace it'); } catch(e) { if(e.code!=='ENOENT') throw e; }
const m=await readJSON('public/assets/manifest.json'), p=await pixels('public/assets/'+m.blocks.atlas), scores={};
for(const [name,cells]of Object.entries(m.blocks.tiles))for(const [v,xy]of cells.entries()) scores[name+' '+(v+1)]=banding(await cell(p,...xy,8,4));
const hashes={};for(const path of [...Object.values(m.sprites).map(s=>s.sheet),m.icons.sheet])hashes[path]=createHash('sha256').update(await fs.readFile(root+'public/assets/'+path)).digest('hex');
await fs.copyFile(root+'public/assets/blocks/atlas.png',root+'assets-src/raw/atlas-before-2.png');
await writeJSON('assets-src/block-baseline-2.json',{manifest:m,hashes,scores,bandThreshold});
console.log(Object.entries(scores).map(([n,v])=>`${n}: ${v.toFixed(2)}${v>bandThreshold?' FAIL':''}`).join('\n'));
