import sharp from 'sharp';
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';

const args=process.argv.slice(2);
if(!args[0]) throw new Error('Usage: bun shared/check.mjs <shot folder or layers.json> [output folder]');
const manifest=path.resolve(args[0].endsWith('.json')?args[0]:path.join(args[0],'layers.json'));
const dir=path.dirname(manifest);
const spec=JSON.parse(await readFile(manifest,'utf8'));
const out=path.resolve(args[1]??`.artifacts/opening/art-a`);
await mkdir(out,{recursive:true});
const [width,height]=spec.frame;
if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1) throw new Error('Invalid frame');
const ids=new Set(),files=new Set(),stack=[],pieces=[];
for(const l of [...spec.layers].sort((a,b)=>a.z-b.z)) {
 if(ids.has(l.id)) throw new Error(`Duplicate id ${l.id}`);
 ids.add(l.id);
 for(const k of ['x','y','w','h','z']) if(!Number.isFinite(l[k])) throw new Error(`${l.id}: invalid ${k}`);
 if(l.x<0||l.y<0||l.x+l.w>width||l.y+l.h>height) throw new Error(`${l.id}: outside frame`);
 if(l.pivot&&(!Array.isArray(l.pivot)||l.pivot.length!==2||l.pivot.some(v=>v<0||v>1))) throw new Error(`${l.id}: invalid pivot`);
 for(const file of [l.file,...(l.frames??[])]) {
  const full=path.resolve(dir,file),meta=await sharp(full).metadata();
  if(meta.width!==l.w||meta.height!==l.h) throw new Error(`${file}: ${meta.width}x${meta.height}, expected ${l.w}x${l.h}`);
  if(!meta.hasAlpha&&!l.id.startsWith('plaster')) throw new Error(`${file}: no alpha channel`);
  files.add(full); pieces.push({id:file,full});
 }
 stack.push({input:path.resolve(dir,l.file),left:l.x,top:l.y});
}
let bytes=0;for(const file of files) bytes+=(await stat(file)).size;
if(bytes>1500000) throw new Error(`${spec.shot}: ${bytes} bytes exceeds 1500000`);
const rest=await sharp({create:{width,height,channels:4,background:'#ffdb9c'}}).composite(stack).png().toBuffer();
await sharp(rest).png({palette:true,colors:128}).toFile(`${out}/${spec.shot}-stack.png`);
const plate=spec.approved?path.resolve(dir,spec.approved):null;
if(plate) {
 const reference=await sharp(plate).resize(width,height,{fit:'contain',background:'#ffdb9c'}).png().toBuffer();
 await sharp({create:{width:width*2,height,channels:3,background:'#ffffff'}}).composite([{input:reference,left:0,top:0},{input:rest,left:width,top:0}]).png({palette:true,colors:256}).toFile(`${out}/${spec.shot}-rest.png`);
} else await sharp(rest).png({palette:true,colors:128}).toFile(`${out}/${spec.shot}-rest.png`);
// Every animation drawing is included. Thumbnails retain aspect ratio.
const cellW=320,cellH=270,cols=4,rows=Math.ceil(pieces.length/cols),composite=[];
for(let i=0;i<pieces.length;i++) {
 const p=pieces[i],x=(i%cols)*cellW*2,y=Math.floor(i/cols)*cellH;
 const thumb=await sharp(p.full).resize(300,228,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
 const m=await sharp(thumb).metadata();
 for(let bg=0;bg<2;bg++) {
  const tile=await sharp({create:{width:cellW,height:cellH,channels:3,background:bg?'#ff0000':'#303030'}}).composite([{input:thumb,left:Math.floor((cellW-m.width)/2),top:26},{input:Buffer.from(`<svg width="320" height="24"><text x="8" y="17" fill="white" font-size="13">${p.id.replaceAll('&','&amp;')}</text></svg>`),left:0,top:0}]).png().toBuffer();
  composite.push({input:tile,left:x+bg*cellW,top:y});
 }
}
await sharp({create:{width:cols*cellW*2,height:rows*cellH,channels:3,background:'#303030'}}).composite(composite).png({palette:true,colors:256}).toFile(`${out}/${spec.shot}-pieces.png`);
console.log(`PASS ${spec.shot}: ${spec.layers.length} layers, ${files.size} files, ${bytes} bytes; ${out}/${spec.shot}-rest.png; ${out}/${spec.shot}-pieces.png`);
