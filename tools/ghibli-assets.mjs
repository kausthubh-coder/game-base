// Turns the generated paintings in assets-src/ghibli/raw into the textures the Ghibli test scene loads.
//   bun tools/ghibli-assets.mjs
// Clouds and boughs of leaves keep their own alpha. Leaf and grass masks are white paint on black: their
// brightness becomes the alpha and what is left of it becomes a light grey that keeps the brush marks.
// Surfaces are scaled down. The scene repeats surfaces mirrored, so an edge that does not tile leaves no seam.
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const raw = resolve(root, 'assets-src/ghibli/raw');
const out = resolve(root, 'demos/ghibli/assets');
mkdirSync(out, { recursive: true });
if (!existsSync(raw)) { console.error(`no generated images in ${raw}`); process.exit(1); }

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

async function mask(file, name, size) {
  const { data, info } = await sharp(file).resize(size, size).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const v = data[i * info.channels];
    const grey = Math.round(255 * (0.7 + 0.3 * smooth(90, 255, v)));
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = grey;
    rgba[i * 4 + 3] = Math.round(255 * smooth(24, 120, v));
  }
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 88, alphaQuality: 92 }).toFile(resolve(out, name + '.webp'));
}

/** A painting on a transparent background: a cloud or a bough of leaves. */
async function cutout(file, name, width) {
  const image = sharp(file);
  const { hasAlpha } = await image.metadata();
  if (!hasAlpha) throw new Error(`${name} has no transparent background: generate it again`);
  await image.trim({ threshold: 2 }).resize({ width, withoutEnlargement: true }).webp({ quality: 86, alphaQuality: 92 }).toFile(resolve(out, name + '.webp'));
}

const surface = (file, name, grey) => {
  const image = sharp(file).resize(512, 512);
  return (grey ? image.greyscale() : image).webp({ quality: 84 }).toFile(resolve(out, name + '.webp'));
};

let made = 0;
for (const file of readdirSync(raw).filter((f) => f.endsWith('.png')).sort()) {
  const name = file.replace('.png', ''), path = resolve(raw, file);
  if (name.startsWith('cloud-')) await cutout(path, name, 1024);
  else if (name.startsWith('foliage-')) await cutout(path, name, 512);
  else if (/^(bush|tree)-/.test(name)) continue; // whole bushes and trees: painted, not used by the scene
  else if (name.startsWith('leaves-') || name.startsWith('tuft-')) await mask(path, name, 512);
  else await surface(path, name, name === 'brush' || name === 'paper');
  made++;
}
const bytes = readdirSync(out).filter((f) => f.endsWith('.webp')).reduce((sum, f) => sum + statSync(resolve(out, f)).size, 0);
console.log(`${made} textures in demos/ghibli/assets, ${(bytes / 1024).toFixed(0)} KB`);
