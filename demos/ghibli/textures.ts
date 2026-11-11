// The scene's painted textures. `tools/ghibli-assets.mjs` makes them from the generated images in
// assets-src/ghibli/raw. A texture that has not been made yet falls back to a stand-in drawn here, so the
// scene always runs.
import * as THREE from 'three';

const files = import.meta.glob('./assets/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface Textures {
  brush: THREE.Texture;
  ground: THREE.Texture;
  /** The ground texture's average colour, so it can vary a colour without tinting it. */
  groundMean: THREE.Color;
  bark: THREE.Texture;
  rock: THREE.Texture;
  paper: THREE.Texture;
  /** The paper texture's average brightness, from 0 to 1. */
  paperMean: number;
  leaves: THREE.Texture[];
  tufts: THREE.Texture[];
  clouds: THREE.Texture[];
  /** Paintings of one bough of leaves each: three broadleaf, one conifer. */
  foliage: THREE.Texture[];
  flower: THREE.Texture;
  /** Names of the textures that are stand-ins. */
  standIns: string[];
}

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function canvas(size: number, height = size): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size; c.height = height;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

function finish(source: HTMLCanvasElement | HTMLImageElement, repeat: boolean, color: boolean): THREE.Texture {
  const t = new THREE.Texture(source);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  // Mirrored, so a painting whose edges do not match still repeats without a seam.
  t.wrapS = t.wrapT = repeat ? THREE.MirroredRepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Draws something at a spot and at its wrapped copies, so the canvas tiles. */
function tiled(size: number, x: number, y: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(x + dx, y + dy);
}

function strokes(seed: number, base: string, tones: string[], count: number, length: number, width: number): HTMLCanvasElement {
  const [c, g] = canvas(256);
  const r = random(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < count; i++) {
    const angle = (r() - 0.5) * 1.2, len = length * (0.5 + r()), w = width * (0.5 + r());
    g.fillStyle = tones[Math.floor(r() * tones.length)] as string;
    g.globalAlpha = 0.25 + r() * 0.3;
    tiled(256, r() * 256, r() * 256, (x, y) => {
      g.save(); g.translate(x, y); g.rotate(angle);
      g.beginPath(); g.ellipse(0, 0, len, w, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    });
  }
  return c;
}

function leafClump(seed: number): HTMLCanvasElement {
  const [c, g] = canvas(256);
  const r = random(seed);
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 96;
    const shade = 200 + Math.floor(r() * 55);
    g.fillStyle = `rgb(${shade},${shade},${shade})`;
    g.save(); g.translate(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); g.rotate(r() * Math.PI);
    g.beginPath(); g.ellipse(0, 0, 20 + r() * 12, 9 + r() * 5, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  return c;
}

function bough(seed: number): HTMLCanvasElement {
  const [c, g] = canvas(256);
  const r = random(seed);
  for (let i = 0; i < 150; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 100, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
    // Lighter toward the upper left, as the paintings are.
    const light = Math.min(1, Math.max(0, 0.5 - (x - 128) / 260 - (y - 128) / 220 + (r() - 0.5) * 0.3));
    g.fillStyle = `rgb(${Math.round(40 + 140 * light)},${Math.round(92 + 118 * light)},${Math.round(62 + 20 * light)})`;
    g.save(); g.translate(x, y); g.rotate(r() * Math.PI);
    g.beginPath(); g.ellipse(0, 0, 17 + r() * 10, 8 + r() * 4, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  return c;
}

function tuft(seed: number): HTMLCanvasElement {
  const [c, g] = canvas(256);
  const r = random(seed);
  for (let i = 0; i < 14; i++) {
    const lean = (r() - 0.5) * 150, top = 20 + r() * 90, w = 7 + r() * 6;
    const shade = 205 + Math.floor(r() * 50);
    g.fillStyle = `rgb(${shade},${shade},${shade})`;
    g.beginPath(); g.moveTo(128 - w, 256); g.quadraticCurveTo(128 + lean * 0.3, 140, 128 + lean, top);
    g.quadraticCurveTo(128 + lean * 0.4, 150, 128 + w, 256); g.fill();
  }
  return c;
}

function cloud(seed: number): HTMLCanvasElement {
  const [c, g] = canvas(512, 320);
  const r = random(seed);
  const puffs: Array<[number, number, number]> = [];
  for (let i = 0; i < 26; i++) {
    const x = 70 + r() * 372, spread = 1 - Math.abs(x - 256) / 230;
    puffs.push([x, 235 - r() * 150 * spread, 34 + r() * 46 * (0.4 + spread)]);
  }
  for (const [x, y, rad] of puffs) { g.fillStyle = '#aab8d6'; g.beginPath(); g.arc(x, y + rad * 0.3, rad, 0, Math.PI * 2); g.fill(); }
  for (const [x, y, rad] of puffs) { g.fillStyle = '#dfe6f2'; g.beginPath(); g.arc(x - rad * 0.08, y, rad * 0.94, 0, Math.PI * 2); g.fill(); }
  for (const [x, y, rad] of puffs) { g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(x - rad * 0.2, y - rad * 0.2, rad * 0.74, 0, Math.PI * 2); g.fill(); }
  g.globalCompositeOperation = 'destination-out';
  g.fillRect(0, 262, 512, 60);
  return c;
}

function flower(): HTMLCanvasElement {
  const [c, g] = canvas(64);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.beginPath(); g.ellipse(32 + Math.cos(a) * 13, 32 + Math.sin(a) * 13, 13, 9, a, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#d8d0c0';
  g.beginPath(); g.arc(32, 32, 7, 0, Math.PI * 2); g.fill();
  return c;
}

function meanPixel(image: CanvasImageSource): [number, number, number] {
  const [, g] = canvas(1);
  g.drawImage(image, 0, 0, 1, 1);
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
  return [(r ?? 128) / 255, (gr ?? 128) / 255, (b ?? 128) / 255];
}

async function image(name: string): Promise<HTMLImageElement | null> {
  const url = files[`./assets/${name}.webp`];
  if (!url) return null;
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

export async function loadTextures(): Promise<Textures> {
  const standIns: string[] = [];
  async function one(name: string, repeat: boolean, color: boolean, standIn: () => HTMLCanvasElement): Promise<[THREE.Texture, CanvasImageSource]> {
    const img = await image(name);
    if (!img) standIns.push(name);
    const source = img ?? standIn();
    return [finish(source, repeat, color), source];
  }
  const many = async (prefix: string, count: number, repeat: boolean, color: boolean, standIn: (i: number) => HTMLCanvasElement): Promise<THREE.Texture[]> =>
    Promise.all(Array.from({ length: count }, async (_, i) => (await one(`${prefix}-${i + 1}`, repeat, color, () => standIn(i)))[0]));

  const greens = ['#9ccb52', '#7fb648', '#b6d660', '#5f9f4a'];
  const [brush] = await one('brush', true, false, () => strokes(1, '#808080', ['#6e6e6e', '#939393', '#787878', '#8a8a8a'], 260, 34, 7));
  const [ground, groundSource] = await one('meadow', true, true, () => strokes(2, '#8cc04e', greens, 420, 12, 5));
  const [bark] = await one('bark', true, true, () => strokes(3, '#7d5f44', ['#5c4336', '#96744f', '#6a4e3c'], 200, 40, 4));
  const [rock] = await one('rock', true, true, () => strokes(4, '#a7a297', ['#8f8d92', '#bcb6a8', '#9a97a2'], 160, 40, 14));
  const [paper, paperSource] = await one('paper', true, false, () => strokes(5, '#f0f0f0', ['#e4e4e4', '#fafafa'], 900, 3, 2));
  const [flowerTexture] = await one('flower', false, false, flower);
  return {
    brush, ground, groundMean: new THREE.Color().setRGB(...meanPixel(groundSource), THREE.SRGBColorSpace), bark, rock, paper, paperMean: meanPixel(paperSource)[0], flower: flowerTexture,
    leaves: await many('leaves', 3, false, false, (i) => leafClump(11 + i)),
    tufts: await many('tuft', 2, false, false, (i) => tuft(21 + i)),
    clouds: await many('cloud', 6, false, true, (i) => cloud(31 + i)),
    foliage: await many('foliage', 4, false, true, (i) => bough(41 + i)),
    standIns: standIns.filter((n) => n !== 'flower'),
  };
}
