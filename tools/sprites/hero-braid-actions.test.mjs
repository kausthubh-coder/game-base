import {test,expect} from 'bun:test';
import fs from 'node:fs/promises';
import {pixels,cell} from './lib.mjs';
const out='.artifacts/hero-braid-actions/test-rebuild';
const build=(action,attempt)=>Bun.spawnSync(['bun','tools/sprites/hero-braid-actions.mjs',action],{env:{...process.env,ATTEMPT:String(attempt),BRAID_OUT:out}});
test('rebuilding a retained generated cut is byte-identical and leaves core and manifest intact',async()=>{
 const paths=['public/assets/manifest.json','public/assets/sprites/hero-braid.png','public/assets/sprites/hero-braid-swing.png'];
 const before=await Promise.all(paths.map(p=>fs.readFile(p)));
 expect(build('cut',3).exitCode).toBe(0);const first=await fs.readFile(`${out}/hero-braid-cut.png`);expect(build('cut',3).exitCode).toBe(0);expect(await fs.readFile(`${out}/hero-braid-cut.png`)).toEqual(first);
 for(const [i,p]of paths.entries())expect(await fs.readFile(p)).toEqual(before[i]);
 const sheet=await pixels(`${out}/hero-braid-cut.png`);expect([sheet.w,sheet.h]).toEqual([512,384]);for(let row=0;row<3;row++)for(let col=0;col<4;col++){const f=await cell(sheet,col,row,4,3);expect(f.data.some((v,i)=>i%4===3&&v===255)).toBe(true);expect(f.data.every((v,i)=>i%4!==3||v===0||v===255)).toBe(true);}
});
test('a source that cannot fit at standing scale is refused instead of shrinking the body',async()=>{const r=build('camp',1);expect(r.exitCode).not.toBe(0);expect(r.stderr.toString()).toContain('cannot fit without shrinking');await expect(fs.access(`${out}/hero-braid-camp.png`)).rejects.toThrow();});
test('unknown action and attempts beyond the allowed three are refused',()=>{expect(build('made-up',1).exitCode).not.toBe(0);expect(build('cut',4).exitCode).not.toBe(0);});

test('camp endpoints reuse exact accepted directional idle and unused cells stay transparent',async()=>{
 const {checkCampEndpoints}=await import('./hero-braid-actions-check.mjs');
 const r=build('camp',2);expect(r.exitCode).toBe(0);const camp=await pixels(`${out}/hero-braid-camp.png`),base=await pixels('public/assets/sprites/hero-braid.png');
 await checkCampEndpoints(camp,base);
 const changed={...camp,data:Buffer.from(camp.data)};changed.data[((6*128)*512+3*128)*4+3]=255;
 await expect(checkCampEndpoints(changed,base)).rejects.toThrow('rise endpoint');
 const filled={...camp,data:Buffer.from(camp.data)};filled.data[(2*128)*4+3]=255;
 await expect(checkCampEndpoints(filled,base)).rejects.toThrow('unused camp cell');
 await fs.unlink(`${out}/hero-braid-camp.png`);
});
