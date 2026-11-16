import sharp from 'sharp';
const b={left:798,top:311,width:303,height:329};
const original=await sharp('demos/opening/art/plates/m6-ascent.jpg').extract(b).resize(606,658).png().toBuffer();
const cut=await sharp('demos/opening/cutout/art/night/king.webp').flatten({background:'#303030'}).resize(606,658).png().toBuffer();
await sharp({create:{width:1212,height:658,channels:3,background:'#303030'}}).composite([{input:original,left:0,top:0},{input:cut,left:606,top:0}]).png().toFile('.artifacts/opening/art-b/night-king-comparison.png');
