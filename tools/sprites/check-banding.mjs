import assert from 'node:assert/strict';
import {pixels,cell,readJSON} from './lib.mjs';
import {banding,bandThreshold} from './banding.mjs';
const old=await pixels('assets-src/raw/atlas-before-2.png');
const baseline=await readJSON('assets-src/block-baseline-2.json');
const failures=[];
for(const [name,cells]of Object.entries(baseline.manifest.blocks.tiles))for(const [v,xy]of cells.entries()){
 const score=banding(await cell(old,...xy,8,4));
 if(score>bandThreshold)failures.push(name+' '+(v+1));
}
for(const n of ['sand 1','sand 2','sand 3','stone 1','stone 3','plaster 1','glass 1','grass_side 1','oak_leaves 1'])assert(failures.includes(n),'rule must catch old '+n);
console.log('PASS regression: old banded tiles exceed '+bandThreshold+' RGB units');
console.log('Caught: '+failures.join(', '));
