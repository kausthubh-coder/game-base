import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { PROPS, PROP_KINDS } from '../../content/props.ts';
import { QUALITY } from '../../content/quality.ts';
import type { ViewContext } from '../../engine/system.ts';
import { calmNoon } from '../../engine/types.ts';
import { flatWorld } from '../../engine/world-query.ts';
import { buildProp, propExtras } from './build.ts';
import { createProps } from './props.view.ts';
import { Shape } from './shape.ts';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SKIN_NAMES, SKIN_UV, SKINS } from './skins.ts';

const each = PROP_KINDS.flatMap((kind) => PROPS[kind].variants.map((name, variant) => ({ kind, variant, label: `${kind} ${name}` })));

/** The share of a geometry's triangles whose winding faces away from this point, and agrees with the normals stored on their corners. */
function outward(geometry: THREE.BufferGeometry, cx: number, cy: number, cz: number): number {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), index = geometry.index as THREE.BufferAttribute;
  let good = 0;
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
    const ux = p.getX(b) - p.getX(a), uy = p.getY(b) - p.getY(a), uz = p.getZ(b) - p.getZ(a);
    const vx = p.getX(c) - p.getX(a), vy = p.getY(c) - p.getY(a), vz = p.getZ(c) - p.getZ(a);
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    const mx = (p.getX(a) + p.getX(b) + p.getX(c)) / 3 - cx, my = (p.getY(a) + p.getY(b) + p.getY(c)) / 3 - cy, mz = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3 - cz;
    if (gx * mx + gy * my + gz * mz > 0 && n.getX(a) * gx + n.getY(a) * gy + n.getZ(a) * gz > 0) good++;
  }
  return good / (index.count / 3);
}

describe('the soft forms', () => {
  test('a rock, a lathe and a rounded box face outward and shade by their stored normals', () => {
    const forms: [string, (s: Shape) => void, [number, number, number]][] = [
      ['rock', (s) => s.rock(0, 0, 0, 3, 2, 2.5, [0x918996, 0xd3c8c6], { level: 3 }), [0, 0.9, 0]],
      ['lathe', (s) => s.lathe(0, 0, 0, [[0.5, 0], [0.7, 1], [0.2, 2]], 0x815940), [0, 1, 0]],
      ['roundBox', (s) => s.roundBox(0, 0, 0, 2, 1, 1, 0x815940, { segments: 2 }), [0, 0.5, 0]],
    ];
    for (const [name, draw, middle] of forms) {
      const s = new Shape(3);
      draw(s);
      expect(outward(s.done(), ...middle), name).toBeGreaterThan(0.97);
    }
  });

  test('a rock fills the box it is given and sits flat on the ground', () => {
    const s = new Shape(5);
    s.rock(1, 0, -2, 5, 4, 3, 0x918996, { planes: 8, reach: 0.6 });
    const box = s.done().boundingBox as THREE.Box3;
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(4, 1);
    expect(box.max.x - box.min.x).toBeCloseTo(5, 1);
    expect(box.max.z - box.min.z).toBeCloseTo(3, 1);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(1, 1);
  });

  test('no face of a soft form is one flat color: its corners differ', () => {
    const s = new Shape(9);
    s.rock(0, 0, 0, 3, 2, 3, [0x918996, 0xb2a8b0, 0xd3c8c6], { moss: 0.5 });
    const color = s.done().getAttribute('color');
    const seen = new Set<string>();
    for (let i = 0; i < color.count; i++) seen.add(`${color.getX(i).toFixed(3)},${color.getY(i).toFixed(3)},${color.getZ(i).toFixed(3)}`);
    expect(seen.size).toBeGreaterThan(color.count * 0.5);
  });

  test('a skin is written into every corner of its part, with moss only where it was asked for', () => {
    const s = new Shape(1);
    s.box(0, 0, 0, 1, 1, 1, 0x815940);
    s.box(3, 0, 0, 3, 0.2, 0.3, 0x815940, { skin: 'grain' });
    s.rock(8, 0, 0, 2, 2, 2, 0x918996, { skin: 'rock', moss: 0.6 });
    const g = s.done(), skin = g.getAttribute('aSkin'), position = g.getAttribute('position');
    let plain = 0, grain = 0, rock = 0, mossy = 0;
    for (let i = 0; i < skin.count; i++) {
      const x = position.getX(i), code = skin.getX(i);
      if (x < 1) { plain++; expect(code).toBe(0); }
      else if (x < 5) { grain++; expect(code).toBe(SKIN_NAMES.indexOf('grain') + 1 + SKIN_UV); }
      else { rock++; expect(code).toBe(SKIN_NAMES.indexOf('rock') + 1); if (skin.getY(i) > 0.5) mossy++; }
    }
    expect(plain && grain && rock && mossy).toBeGreaterThan(0);
  });
});

describe('the skins', () => {
  test('every painting a skin wears is listed in the manifest, and its file is there', () => {
    const assets = resolve(import.meta.dirname, '../../../public/assets');
    const listed = (JSON.parse(readFileSync(resolve(assets, 'manifest.json'), 'utf8')) as { painted: { textures: Record<string, string> } }).painted.textures;
    for (const name of SKIN_NAMES) {
      const source = SKINS[name].source as { painting?: string } | null;
      if (!source?.painting) continue;
      expect(listed[source.painting], name).toBeString();
      expect(existsSync(resolve(assets, listed[source.painting])), name).toBe(true);
    }
  });
});

describe('every prop with the new toolkit', () => {
  test('every corner carries a skin number the material knows', () => {
    for (const { kind, variant, label } of each) {
      const skin = buildProp(kind, variant).getAttribute('aSkin');
      expect(skin, label).toBeDefined();
      for (let i = 0; i < skin.count; i++) {
        const code = skin.getX(i), id = code >= SKIN_UV ? code - SKIN_UV : code;
        expect(Number.isInteger(id) && id >= 0 && id <= SKIN_NAMES.length, `${label} skin ${code}`).toBe(true);
      }
    }
  });

  test('a lower detail level never costs more triangles, and a prop with soft forms costs fewer', () => {
    for (const { kind, variant, label } of each) {
      const full = buildProp(kind, variant, 1), low = buildProp(kind, variant, QUALITY.low.propDetail);
      expect(propExtras(low).triangles, label).toBeLessThanOrEqual(propExtras(full).triangles);
      if (propExtras(full).detailed && kind !== 'stiltHut') expect(propExtras(low).triangles, label).toBeLessThan(propExtras(full).triangles * 0.8);
    }
  });

  test('the rock arch leaves a passage 7 m wide and 4 m high, and the fallen oak a bore 3 m across', () => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const ray = new THREE.Raycaster();
    for (const detail of [1, QUALITY.low.propDetail]) {
      const arch = new THREE.Mesh(buildProp('rockArch', 0, detail), material);
      for (let x = -3.5; x <= 3.5; x += 0.25) for (let y = 0.1; y <= 4; y += 0.25) {
        ray.set(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
        expect(ray.intersectObject(arch).length, `arch at x ${x}, y ${y}, detail ${detail}`).toBe(0);
      }
      const oak = new THREE.Mesh(buildProp('fallenGiant', 0, detail), material);
      for (let i = 0; i < 64; i++) {
        const a = (i * Math.PI) / 32;
        ray.set(new THREE.Vector3(-13, 1.95 + 1.5 * Math.sin(a), 1.5 * Math.cos(a)), new THREE.Vector3(1, 0, 0));
        expect(ray.intersectObject(oak).length, `oak bore at ${a.toFixed(2)}, detail ${detail}`).toBe(0);
      }
    }
  });

  test('the props system builds soft forms again, more coarsely, when the level drops, and back when it rises', () => {
    const ctx: ViewContext = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(40, 1.6, 0.5, 500), renderer: undefined as unknown as THREE.WebGLRenderer, ambient: calmNoon(), world: flatWorld, quality: 'high', time: 0 };
    ctx.camera.position.set(0, 20, 40);
    ctx.camera.lookAt(0, 0, 0);
    const props = createProps(ctx, { thin: false, skins: null });
    props.place('rockArch', 0, { x: 0, y: 0, z: 0 });
    props.place('crate', 0, { x: 4, y: 0, z: 8 });
    props.update(1 / 60, ctx);
    const high = { ...props.stats() };
    ctx.quality = 'low';
    props.update(1 / 60, ctx);
    const low = { ...props.stats() };
    expect(low.drawCalls).toBe(high.drawCalls);
    expect(low.triangles).toBeLessThan(high.triangles * 0.6);
    ctx.quality = 'high';
    props.update(1 / 60, ctx);
    expect(props.stats().triangles).toBe(high.triangles);
    props.dispose();
  });
});
