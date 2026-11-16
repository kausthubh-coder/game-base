import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { calmNoon } from '../../engine/types.ts';
import { flatWorld } from '../../engine/world-query.ts';
import type { ViewContext } from '../../engine/system.ts';
import { loadAssets } from '../assets/index.ts';
import { ASSETS_FOLDER, diskIO } from '../assets/test-io.ts';
import { createSprites, STRIDE } from './sprites.view.ts';

// Use the shipped cast, not firstSpritesIO: the frog and the hero must coexist in the atlas.
test('every hero walking/tool frame belongs to its sheet while unrelated creatures change', async () => {
  const assets = await loadAssets({ baseUrl: ASSETS_FOLDER, io: { json: async url => {
    const manifest = await diskIO.json(url) as { version: number; sprites: Record<string, unknown> };
    return { version: manifest.version, sprites: manifest.sprites };
  }, image: diskIO.image } });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  camera.position.set(10, 10, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const ctx: ViewContext = { scene, camera, renderer: {} as THREE.WebGLRenderer, ambient: calmNoon(), world: flatWorld, quality: 'high', time: 0 };
  const sprites = createSprites(ctx, { assets, capacity: 2 });
  const frog = sprites.add('frog');
  const hero = sprites.add('hero');
  let creature = sprites.add('mossling');
  const mesh = scene.getObjectByName('sprites') as THREE.Mesh;
  const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms;
  for (const name of ['hero', 'hero-swing']) {
    const h = name === 'hero' ? hero : sprites.add(name);
    const asset = assets.sprite(name), place = assets.spriteAtlas().place(name);
    for (let direction = 0; direction < 8; direction++) for (const animation of Object.keys(asset.animations)) {
      h.setFacing(direction * Math.PI / 4);
      const anim = asset.animations[animation];
      for (let frame = 0; frame < anim.frames; frame++) {
        h.play(animation, { restart: true, phase: (frame + 0.25) / anim.frames });
        frog.setFacing(direction); frog.play(frame % 2 ? 'walk' : 'idle');
        creature.remove(); creature = sprites.add(frame % 2 ? 'mossling' : 'frog');
        sprites.update(0, ctx);
        const index = (h as unknown as { index: number }).index;
        const data = (mesh.geometry.attributes.aPlace as THREE.InterleavedBufferAttribute).data.array;
        const o = index * STRIDE;
        const count = Math.abs(data[o + 6]);
        const tick = Math.floor(Math.max(Math.fround(uniforms.uTime.value) - data[o + 19], 0) * data[o + 7]);
        const shown = data[o + 6] < 0 ? Math.min(tick, count - 1) : tick % count;
        const x = data[o + 4] + shown * data[o + 8], y = data[o + 5];
        expect({ name, animation, direction, frame, shown }).toEqual({ name, animation, direction, frame, shown: frame });
        expect(data[o + 10]).toBe(place.page);
        expect(x).toBeGreaterThanOrEqual(place.x); expect(x + data[o + 8]).toBeLessThanOrEqual(place.x + place.width);
        expect(y).toBeGreaterThanOrEqual(place.y); expect(y + data[o + 9]).toBeLessThanOrEqual(place.y + place.height);
        // The actual atlas bytes at every frame must be this character's source bytes.
        const atlas = assets.spriteAtlas(), packed = atlas.texture.image.data;
        if (!packed) throw new Error("Sprite atlas has no pixel data");
        for (let py = 0; py < asset.frame[1]; py++) {
          const start = ((place.page * atlas.height + y + py) * atlas.width + x) * 4;
          const source = ((y - place.y + py) * asset.pixels.width + x - place.x) * 4;
          expect(Array.from(packed.subarray(start, start + asset.frame[0] * 4))).toEqual(Array.from(asset.pixels.data.subarray(source, source + asset.frame[0] * 4), (v, i) => i % 4 !== 3 && asset.pixels.data[source + i - i % 4 + 3] === 0 ? 0 : v));
        }
      }
    }
    if (h !== hero) h.remove();
  }
  sprites.dispose(); assets.dispose();
});
