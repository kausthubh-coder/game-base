// Bake animated cast geometry into horizontal pixel slices, then flatten each pose at eight headings.
// Run from the repo root with bun tools/sprites/bake-stack.mjs. Only the experimental pack is written.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAST, CAST_MODELS } from '../../src/game/content/cast-models.ts';

import { loadHeroPaint } from './painted-hero.mjs';

const root = 'public/experiments/sprite-stack';
const manifest = JSON.parse(await readFile('public/assets/manifest.json', 'utf8'));
const sprites = {};
const headings = [
  'front',
  'frontRight',
  'side',
  'backRight',
  'back',
  'backLeft',
  'left',
  'frontLeft',
];
const npcNames = [
  'tamsin',
  'maren',
  'odo',
  'gus',
  'mira',
  'wren',
  'juniper',
  'brack',
  'villager-a',
  'villager-b',
];
const cast = [
  ...npcNames,
  'leaftail',
  'pet',
  'mossling',
  'critter',
  'lanternfly',
  'hero',
  'hero-swing',
];
const light = new THREE.Vector3(-0.45, 0.8, 0.6).normalize();

function addSpade(scene) {
  const socket = scene.getObjectByName('handRtool');
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.023, 0.54, 8),
    new THREE.MeshBasicMaterial({ color: CAST.hero.colours.leather }),
  );
  const blade = new THREE.Mesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshBasicMaterial({ color: CAST.hero.colours.metal }),
  );
  shaft.position.y = 0.17;
  blade.scale.set(0.095, 0.13, 0.026);
  blade.position.y = 0.5;
  socket.add(shaft, blade);
}

// Sample the posed surface into pixel grids parallel to the ground. The grids share one
// origin at the rig's feet. All headings of a pose read these exact same slices.
function slicePose(scene, scale) {
  const layers = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.visible) return;
    const geometry = mesh.geometry,
      colors = geometry.getAttribute('color');
    const points = Array.from({ length: geometry.getAttribute('position').count }, (_, i) =>
      mesh
        .getVertexPosition(i, new THREE.Vector3())
        .applyMatrix4(mesh.matrixWorld)
        .multiplyScalar(scale),
    );
    const ids = geometry.index?.array ?? points.map((_, i) => i);
    const edge = new THREE.Vector3(),
      cross = new THREE.Vector3(),
      color = new THREE.Color();
    for (let i = 0; i < ids.length; i += 3) {
      const a = points[ids[i]],
        b = points[ids[i + 1]],
        c = points[ids[i + 2]];
      const normal = cross.subVectors(b, a).cross(edge.subVectors(c, a)).normalize();
      if (colors) color.fromBufferAttribute(colors, ids[i]);
      else color.copy(mesh.material.color);
      const paint = {
        r: color.r,
        g: color.g,
        b: color.b,
        nx: normal.x,
        ny: normal.y,
        nz: normal.z,
      };
      const steps = Math.max(
        1,
        Math.ceil(2 * Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a))),
      );
      for (let j = 0; j <= steps; j++)
        for (let k = 0; k <= steps - j; k++) {
          const t = j / steps,
            u = k / steps;
          const x = a.x + (b.x - a.x) * t + (c.x - a.x) * u;
          const y = a.y + (b.y - a.y) * t + (c.y - a.y) * u;
          const z = a.z + (b.z - a.z) * t + (c.z - a.z) * u;
          const ix = Math.round(x),
            iy = Math.round(y),
            iz = Math.round(z);
          let layer = layers.get(iy);
          if (!layer) layers.set(iy, (layer = new Map()));
          const key = ix * 65536 + iz;
          const error = (x - ix) ** 2 + (y - iy) ** 2 + (z - iz) ** 2;
          if (error < (layer.get(key)?.error ?? Infinity))
            layer.set(key, { x: ix, z: iz, paint, error });
        }
    }
  });
  return layers;
}

function draw(layers, heading, width, height, anchor) {
  const frame = Buffer.alloc(width * height * 4);
  const depth = new Float32Array(width * height).fill(-Infinity);
  const angle = (heading * Math.PI) / 4,
    co = Math.cos(angle),
    si = Math.sin(angle);
  const pitch = (12 * Math.PI) / 180,
    up = Math.cos(pitch),
    down = Math.sin(pitch);
  const color = new THREE.Color();
  for (const [y, layer] of layers)
    for (const { x, z, paint } of layer.values()) {
      const sx = x * co + z * si,
        towards = z * co - x * si;
      const px = anchor[0] + sx,
        py = anchor[1] - y * up + towards * down;
      const d = towards * up + y * down;
      const lit =
        (paint.nx * co + paint.nz * si) * light.x +
        paint.ny * light.y +
        (paint.nz * co - paint.nx * si) * light.z;
      const shade = 0.65 + (0.35 * Math.round(4 * Math.max(0, lit))) / 4;
      color.setRGB(paint.r * shade, paint.g * shade, paint.b * shade).convertLinearToSRGB();
      // Footprint of a rotated unit texel plus the slice's thickness. Close subpixel cracks.
      const half = (Math.abs(co) + Math.abs(si)) / 2;
      const halfY = up / 2 + half * down;
      for (let v = Math.ceil(py - halfY); v <= py + halfY; v++)
        for (let u = Math.ceil(px - half); u <= px + half; u++) {
          if (u < 1 || u >= width - 1 || v < 1 || v >= height - 1) continue;
          const p = v * width + u;
          if (depth[p] >= d) continue;
          depth[p] = d;
          frame[p * 4] = Math.round(color.r * 255);
          frame[p * 4 + 1] = Math.round(color.g * 255);
          frame[p * 4 + 2] = Math.round(color.b * 255);
          frame[p * 4 + 3] = 255;
        }
    }
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (Number.isFinite(depth[p])) continue;
      if ([p - 1, p + 1, p - width, p + width].some((n) => Number.isFinite(depth[n])))
        frame.writeUInt32BE(0x45343bff, p * 4);
    }
  return frame;
}

await mkdir(root + '/stacked', { recursive: true });
for (const name of cast) {
  const model = CAST[name]?.model ?? (name === 'hero-swing' ? 'hero' : name);
  const definition = CAST_MODELS[model];
  const bytes = await readFile('public/' + definition.file);
  const { scene, animations: clips } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const source = manifest.sprites[name],
    mixer = new THREE.AnimationMixer(scene);
  const box = new THREE.Box3().setFromObject(scene, true),
    size = box.getSize(new THREE.Vector3());
  const hero = model === 'hero',
    divisor = hero ? 1 : 2;
  const [w, h] = source.frame.map((n) => n / divisor),
    anchor = source.anchor.map((n) => n / divisor);
  const scale = Math.min((h * 0.8) / size.y, (w * 0.84) / Math.hypot(size.x, size.z));
  if (hero) addSpade(scene);
  const paint = hero ? await loadHeroPaint(source) : null;
  const toolPaint = name === 'hero' ? await loadHeroPaint(manifest.sprites['hero-swing']) : paint;
  const animations = {},
    frames = [];
  let rows = 0,
    columns = 0;
  for (const [action, original] of Object.entries(source.animations)) {
    const paintPose = action === 'tool' ? toolPaint : paint;
    const clipName = definition.clips[action === 'settle' ? 'special' : action];
    const clip = THREE.AnimationClip.findByName(clips, clipName);
    if (!clip) throw Error(model + ' has no ' + clipName + ' clip for ' + action);
    if (model === 'hero') {
      for (const part of scene.getObjectByName('handRtool').children)
        part.visible = action === 'tool';
    }
    const count = hero ? original.frames : Math.max(original.frames, action === 'idle' ? 4 : 8);
    const fps = (count * original.fps) / original.frames;
    animations[action] = {
      frames: count,
      fps,
      rows: Object.fromEntries(headings.map((key, i) => [key, rows + i])),
    };
    columns = Math.max(columns, count);
    mixer.stopAllAction();
    mixer.clipAction(clip).reset().play();
    for (let i = 0; i < count; i++) {
      // Start on a contact pose, then pass, lift and contact with the other boot.
      const phase = hero && action === 'walk' ? (i / count + 0.25) % 1 : i / count;
      mixer.setTime(phase * clip.duration);
      const layers = slicePose(scene, scale);
      for (let dir = 0; dir < headings.length; dir++)
        frames.push({
          input: paintPose
            ? paintPose(action, i, dir, layers, size.y * scale, anchor)
            : draw(layers, dir, w, h, anchor),
          raw: { width: w, height: h, channels: 4 },
          left: i * w,
          top: (rows + dir) * h,
        });
    }
    rows += headings.length;
  }
  const sheet = 'stacked/' + name + '.png';
  await sharp({
    create: { width: w * columns, height: h * rows, channels: 4, background: '#00000000' },
  })
    .composite(frames)
    .png(hero ? {} : { palette: true, colors: 128, dither: 0 })
    .toFile(root + '/' + sheet);
  sprites[name] = { sheet, frame: [w, h], anchor, worldHeight: source.worldHeight, animations };
  console.log(name, Object.keys(animations).join(', '));
}
await writeFile(root + '/manifest.json', JSON.stringify({ version: 1, sprites }, null, 2) + '\n');
