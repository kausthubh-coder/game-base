import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const wall=await sharp(`${dir}src/plaster-raw.png`).resize(1920,1080).webp({quality:85}).toBuffer();
await sharp(wall).toFile(`${dir}plaster.webp`);
// A reflected continuation keeps the two gold bands and joins without a texture seam.
await sharp({create:{width:3840,height:1080,channels:3,background:'#ffdb9c'}}).composite([{input:wall,left:0,top:0},{input:await sharp(wall).flop().toBuffer(),left:1920,top:0}]).webp({quality:85}).toFile(`${dir}plaster-wide.webp`);
