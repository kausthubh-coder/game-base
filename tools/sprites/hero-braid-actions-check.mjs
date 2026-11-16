import assert from 'node:assert/strict';
import {pixels,cell} from './lib.mjs';
export async function checkCampEndpoints(camp,base){
 assert.deepEqual([camp.w,camp.h],[512,1152]);
 for(let row=0;row<6;row++)for(let col=2;col<4;col++){const f=await cell(camp,col,row,4,9);assert(f.data.every((v,i)=>i%4!==3||v===0),`unused camp cell ${row}:${col}`);}
 for(let row=0;row<3;row++)assert.deepEqual((await cell(camp,3,row+6,4,9)).data,(await cell(base,0,row,6,6)).data,`rise endpoint ${row}`);
 for(let row=0;row<9;row++)for(let col=0;col<(row<6?2:4);col++)assert((await cell(camp,col,row,4,9)).data.some((v,i)=>i%4===3&&v===255),`missing pose ${row}:${col}`);
}
if(import.meta.main){const attempt=process.argv[2]??'2';await checkCampEndpoints(await pixels(`.artifacts/hero-braid-actions/camp-attempt-${attempt}/hero-braid-camp.png`),await pixels('public/assets/sprites/hero-braid.png'));console.log('PASS candidate camp: exact three idle endpoints, twelve unused cells transparent, all24 poses occupied. This is not visual acceptance.');}
