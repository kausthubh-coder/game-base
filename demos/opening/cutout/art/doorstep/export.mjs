import sharp from 'sharp';
import { resolve } from 'node:path';
import { art, framedPoints, frames, glow, layer, masked, proofs, reframePieces, saveJson, sourceCanvas } from '../wall/export.mjs';

export async function street(shot) {
  // The shared mask is in the 2304 x 1296 overscan coordinate system.
  // Near architecture stays on one plane to keep the door, trunk and step registered.
  const near = framedPoints('1240,-200 1170,235 1130,470 1048,715 992,940 875,1105 855,1500 2600,1500 2600,-200');
  const mid = framedPoints('-240,-200 460,-200 460,660 810,680 1135,1000 1280,1500 -240,1500');
  const whole = [-192, -108, 2304, 1296];
  // Mid plane includes the left house/market and road. A concealed margin continues behind near architecture.
  await masked(shot, 'clean.png', 'street.webp', mid, whole);
  await masked(shot, 'clean.png', 'door-step-wisteria.webp', near, whole);
  // Visible far pixels match the clean edit exactly. The generated far repaint continues
  // underneath the two occluding planes, so moving a plane never reveals its duplicate.
  const clean = await sourceCanvas(shot, 'clean.png');
  const visible = Buffer.from(`<svg width="2304" height="1296"><rect width="2304" height="1296" fill="white"/><polygon points="${near}" fill="black"/><polygon points="${mid}" fill="black"/></svg>`);
  const mask = await sharp(visible).removeAlpha().toColourspace('b-w').raw().toBuffer();
  const patch = await sharp(clean).removeAlpha().joinChannel(mask, { raw: { width: 2304, height: 1296, channels: 1 } }).png().toBuffer();
  const far = await sourceCanvas(shot, 'far.png');
  await sharp(far).composite([{ input: patch }]).webp({ quality: 83 }).toFile(resolve(art, shot, 'harbour.webp'));
  const layers = [
    layer('harbour', 'harbour.webp', whole, 0, 1, 'Opaque painted harbour/sky continuation behind foreground architecture. 10 percent overscan.'),
    layer('street', 'street.webp', whole, 10, 0.65, 'Empty left house fronts and road. No baked rain or people. Concealed margin under near plane.'),
    layer('door-step-wisteria', 'door-step-wisteria.webp', whole, 30, 0.25, 'Shared night/day mask. Keep door frame, step and trunk on this plane.'),
  ];
  return layers;
}

if (process.argv[1] === import.meta.filename) {
  const shot = 'doorstep';
  const layers = await street(shot);
  const walker = await frames(shot, 'walker-v2.png', 6, 'walker', 120, 260);
  await frames(shot, 'basket.png', 1, 'basket', 345, 222, false, true);
  await glow(shot, 'lamp-glow.webp', 350, 430, '#ffd075');
  layers.push(
    layer('walker', walker[0], [416, 440, 120, 260], 20, 0.62, 'Rear-view six-drawing walk. Fixed box and bottom baseline, 1-6 then repeat; animate position toward harbour.', walker.slice(1)),
    layer('lamp-glow', 'lamp-glow.webp', [1125, 30, 350, 430], 40, 0.25, 'Light-only mask for screen blending or opacity modulation. Code draws rain and ripples.'),
    layer('basket', 'basket-1.webp', [1290, 662, 345, 222], 50, 0.23, 'Sleeping baby. Small brass key and visible dark cord; key is smaller than face.'),
  );
  await reframePieces(shot, layers.slice(3));
  await saveJson(shot, layers);
  await proofs(shot, 'p2-doorstep.jpg');
  console.log('doorstep: exported layers and comparison');
}
