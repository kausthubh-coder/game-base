// The painted world's textures. `tools/ghibli-assets.mjs` makes them from the generated images in
// assets-src/ghibli/raw, and they are served from `public/assets/painted/`. A texture that does not load
// falls back to a stand-in drawn here, so the world is always drawn.
import * as THREE from 'three';


export interface Textures {
  brush: THREE.Texture;
  ground: THREE.Texture;
  /** The ground texture's average colour, so it can vary a colour without tinting it. */
  groundMean: THREE.Color;
  bark: THREE.Texture;
  rock: THREE.Texture;
  tufts: THREE.Texture[];
  clouds: THREE.Texture[];
  /** Masks of one spray of leaves each: leaflets that fan out from a stem, as on a chestnut. Drawn by code. */
  rosettes: THREE.Texture[];
  flower: THREE.Texture;
  /** Paving stones, drawn by code. Red is how light a stone is (dark between stones), green is a number of the stone's own. It repeats. */
  cobble: THREE.Texture;
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

function rosette(seed: number, leaflets: number): HTMLCanvasElement {
  const [c, g] = canvas(256);
  const r = random(seed), start = r() * Math.PI * 2;
  g.translate(128, 128);
  for (let i = 0; i < leaflets; i++) {
    const length = 92 + r() * 28, width = 36 + r() * 10;
    // A leaflet is darker at the stem and pale at its tip, so every leaf catches a little light.
    const shade = g.createLinearGradient(0, 0, 0, length);
    shade.addColorStop(0, 'rgb(168,168,168)'); shade.addColorStop(1, 'rgb(255,255,255)');
    g.fillStyle = shade;
    g.save(); g.rotate(start + (i / leaflets) * Math.PI * 2 + (r() - 0.5) * 0.25);
    // Widest past the middle and blunt at the tip, like a chestnut leaflet.
    g.beginPath(); g.moveTo(0, 6); g.bezierCurveTo(width * 0.5, length * 0.3, width, length * 0.75, 0, length); g.bezierCurveTo(-width, length * 0.75, -width * 0.5, length * 0.3, 0, 6); g.fill();
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

async function image(base: string, name: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = `${base}${name}.webp`;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/** Rounded stones of many sizes set close together, with dark earth between them. */
function cobbles(): THREE.DataTexture {
  const size = 256, cells = 9, r = random(77), data = new Uint8Array(size * size * 4);
  // One stone in each square of a grid, pushed off its middle. The grid wraps, so the texture repeats.
  const px = new Float32Array(cells * cells), py = new Float32Array(cells * cells), tone = new Float32Array(cells * cells), own = new Float32Array(cells * cells);
  for (let i = 0; i < cells * cells; i++) { px[i] = 0.18 + r() * 0.64; py[i] = 0.18 + r() * 0.64; tone[i] = 0.82 + r() * 0.3; own[i] = r(); }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * cells, v = (y / size) * cells, cu = Math.floor(u), cv = Math.floor(v);
      let near = 9, next = 9, which = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const c = ((cv + dy + cells) % cells) * cells + ((cu + dx + cells) % cells), d = Math.hypot(cu + dx + (px[c] as number) - u, cv + dy + (py[c] as number) - v);
          if (d < near) { next = near; near = d; which = c; } else if (d < next) next = d;
        }
      }
      // Near the line between two stones lies the gap. A stone is a little darker toward its rim.
      const rim = next - near, gap = Math.min(1, Math.max(0, (rim - 0.05) / 0.09)), at = (y * size + x) * 4;
      data[at] = Math.round(255 * Math.min(1, (0.42 + (0.4 * (tone[which] as number) + 0.1 * Math.min(1, rim * 3)) * gap) ));
      data[at + 1] = Math.round(255 * (own[which] as number));
      data[at + 2] = Math.round(255 * gap);
      data[at + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** `base` is the folder the paintings are served from, with its last slash. */
export async function loadTextures(base: string): Promise<Textures> {
  const standIns: string[] = [];
  async function one(name: string, repeat: boolean, color: boolean, standIn: () => HTMLCanvasElement, painted = true): Promise<[THREE.Texture, CanvasImageSource]> {
    // A texture that is always drawn by code asks for no file, so nothing fails to load.
    const img = painted ? await image(base, name) : null;
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
  const [flowerTexture] = await one('flower', false, false, flower, false);
  return {
    brush, ground, groundMean: new THREE.Color().setRGB(...meanPixel(groundSource), THREE.SRGBColorSpace), bark, rock, flower: flowerTexture, cobble: cobbles(),
    tufts: await many('tuft', 2, false, false, (i) => tuft(21 + i)),
    clouds: await many('cloud', 6, false, true, (i) => cloud(31 + i)),
    rosettes: [[51, 6], [52, 7], [53, 5]].map(([seed, leaflets]) => finish(rosette(seed as number, leaflets as number), false, false)),
    standIns: standIns.filter((n) => n !== 'flower'),
  };
}
