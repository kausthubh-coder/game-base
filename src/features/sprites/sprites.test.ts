// The sprite system without a GPU: real assets from disk, a real scene and camera, and the numbers
// the system would hand to the vertex shader. What the shader draws from them is checked in the
// browser by tools/sprites-runtime-check.mjs.
import { expect, test } from 'bun:test';
import * as THREE from 'three';
import type { ViewContext } from '../../engine/system.ts';
import { calmNoon } from '../../engine/types.ts';
import { flatWorld, type WorldQuery } from '../../engine/world-query.ts';
import { loadAssets, type Assets } from '../assets/index.ts';
import { ASSETS_FOLDER, firstSpritesIO } from '../assets/test-io.ts';
import { frameAt } from './animation.ts';
import { STRIDE, createSprites, type Sprites } from './sprites.view.ts';

const EIGHTH = Math.PI / 4;
const PITCH = (35 * Math.PI) / 180;
const FACINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

interface Rig {
  ctx: ViewContext;
  assets: Assets;
  sprites: Sprites;
  /** Places the camera where the game's rig puts it after this many quarter turns. */
  turn(quarter: number): void;
  /** One frame: moves the clock and updates. */
  step(seconds?: number): void;
  /** The 24 numbers of the character in this slot. */
  slot(index: number): Slot;
  uniform(name: string): any;
  geometries(): THREE.BufferGeometry[];
}

interface Slot {
  x: number; y: number; z: number; shadowY: number;
  rowX: number; rowY: number; frames: number; fps: number;
  frameW: number; frameH: number; page: number; flip: number;
  anchorX: number; anchorY: number; scale: number; shadowRadius: number;
  tint: number[]; start: number;
  sky: number; lamp: number; shadowStrength: number;
}

async function rig(world: WorldQuery = flatWorld, options: { capacity?: number; seed?: number } = {}): Promise<Rig> {
  const assets = await loadAssets({ baseUrl: ASSETS_FOLDER, io: firstSpritesIO });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 16 / 9, 1, 400);
  const ctx: ViewContext = { scene, camera, renderer: {} as THREE.WebGLRenderer, ambient: calmNoon(), world, quality: 'high', time: 0 };
  const turn = (quarter: number): void => {
    const yaw = EIGHTH + quarter * 2 * EIGHTH;
    camera.position.set(Math.sin(yaw) * Math.cos(PITCH) * 66, Math.sin(PITCH) * 66, Math.cos(yaw) * Math.cos(PITCH) * 66);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  };
  turn(0);
  const sprites = createSprites(ctx, { assets, ...options });
  const mesh = (name: string): THREE.Mesh => scene.getObjectByName(name) as THREE.Mesh;
  const data = (): Float32Array => (mesh('sprites').geometry.attributes.aPlace as THREE.InterleavedBufferAttribute).data.array as Float32Array;
  return {
    ctx, assets, sprites, turn,
    step(seconds = 1 / 60) {
      ctx.time += seconds;
      sprites.update(seconds, ctx);
    },
    slot(index) {
      const d = data().subarray(index * STRIDE, (index + 1) * STRIDE);
      return {
        x: d[0], y: d[1], z: d[2], shadowY: d[3],
        rowX: d[4], rowY: d[5], frames: d[6], fps: d[7],
        frameW: d[8], frameH: d[9], page: d[10], flip: d[11],
        anchorX: d[12], anchorY: d[13], scale: d[14], shadowRadius: d[15],
        tint: [d[16], d[17], d[18]], start: d[19],
        sky: d[20], lamp: d[21], shadowStrength: d[22],
      };
    },
    uniform: (name) => (mesh('sprites').material as THREE.ShaderMaterial).uniforms[name].value,
    geometries: () => [mesh('sprites').geometry, mesh('sprite-shadows').geometry],
  };
}

/** The frame the vertex shader would show for a slot: its rule, with the 32 bit numbers it gets. */
function shaderFrame(r: Rig, index: number): number {
  const s = r.slot(index);
  const frames = Math.abs(s.frames);
  const frame = Math.floor(Math.max(Math.fround(r.uniform('uTime')) - s.start, 0) * s.fps);
  return s.frames < 0 ? Math.min(frame, frames - 1) : frame % frames;
}

/** Which sheet row a slot shows, and whether it is mirrored, read back from its numbers. */
function shown(r: Rig, index: number, spriteName: string): string {
  const s = r.slot(index);
  const place = r.assets.spriteAtlas().place(spriteName);
  expect(s.rowX).toBe(place.x);
  const row = (s.rowY - place.y) / s.frameH;
  return `row ${row}${s.flip < 0 ? ' mirrored' : ''}`;
}

test('a hero walking each of 8 ways shows the right sheet row at each of the 4 camera turns', async () => {
  const r = await rig();
  const heroes = FACINGS.map((_, i) => r.sprites.add('hero', { facing: i * EIGHTH, animation: 'walk', x: i * 2 }));
  // The walk rows of the hero sheet: front 3, back 4, side 5. Worked out by hand, as in facing.test.ts.
  const F = 'row 3', B = 'row 4', R = 'row 5', L = 'row 5 mirrored';
  const want: Record<number, string[]> = {
    //   N  NE  E  SE  S  SW  W  NW
    0: [R, R, R, F, L, L, L, B],
    1: [R, F, L, L, L, B, R, R],
    2: [L, L, L, B, R, R, R, F],
    3: [L, B, R, R, R, F, L, L],
  };
  for (const quarter of [0, 1, 2, 3, 0]) {
    r.turn(quarter);
    r.step();
    expect({ quarter, rows: heroes.map((_, i) => shown(r, i, 'hero')) }).toEqual({ quarter, rows: want[quarter] });
  }
  // Turning the character, not the camera: the hero that faced north now faces south-east, toward the camera.
  heroes[0].setFacing(3 * EIGHTH);
  expect(shown(r, 0, 'hero')).toBe(F);
  // Standing still uses the idle rows: front 0, back 1, side 2.
  heroes[0].play('idle');
  expect(shown(r, 0, 'hero')).toBe('row 0');
  heroes[7].play('idle');
  expect(shown(r, 7, 'hero')).toBe('row 1');
  heroes[1].play('idle');
  expect(shown(r, 1, 'hero')).toBe('row 2');
});

test('an animation drawn from the front only shows its front row from every side, never mirrored', async () => {
  const r = await rig();
  FACINGS.forEach((_, i) => r.sprites.add('hero', { facing: i * EIGHTH, animation: 'tool' }));
  expect(FACINGS.map((_, i) => shown(r, i, 'hero'))).toEqual(Array(8).fill('row 6'));
});

test('a sprite stands on its anchor, as tall as its world height', async () => {
  const r = await rig();
  r.sprites.add('hero', { x: 3, y: 5, z: -2 });
  r.sprites.add('pet', { x: 1, y: 0, z: 1 });
  const hero = r.slot(0), pet = r.slot(1);
  expect([hero.x, hero.y, hero.z]).toEqual([3, 5, -2]);
  expect([hero.frameW, hero.frameH, hero.anchorX, hero.anchorY]).toEqual([128, 128, 64, 120]);
  // 128 pixels are 2 blocks.
  expect(hero.frameH * hero.scale).toBeCloseTo(2, 6);
  expect([pet.frameW, pet.frameH, pet.anchorX, pet.anchorY]).toEqual([96, 96, 48, 88]);
  expect(pet.frameH * pet.scale).toBeCloseTo(0.85, 6);
  // The shadow is narrower than the frame and wider than nothing: about the body's half width.
  expect(hero.shadowRadius).toBeGreaterThan(0.25);
  expect(hero.shadowRadius).toBeLessThan(0.5);
  expect(pet.shadowRadius).toBeGreaterThan(0.12);
  expect(pet.shadowRadius).toBeLessThan(0.35);
});

test('play switches the animation and its speed, from the first frame', async () => {
  const r = await rig();
  const hero = r.sprites.add('hero', { facing: 3 * EIGHTH });
  r.step(2);
  expect(hero.animation).toBe('idle');
  expect([r.slot(0).frames, r.slot(0).fps]).toEqual([4, 4]);

  hero.play('walk');
  expect(hero.animation).toBe('walk');
  expect([r.slot(0).frames, r.slot(0).fps]).toEqual([6, 10]);
  expect(shown(r, 0, 'hero')).toBe('row 3');
  const frames: number[] = [];
  for (let i = 0; i < 8; i++) {
    expect(shaderFrame(r, 0)).toBe(hero.frame);
    frames.push(hero.frame);
    r.step(0.1001);
  }
  expect(frames).toEqual([0, 1, 2, 3, 4, 5, 0, 1]);

  // Playing the animation that is already playing does not start it again, so a game can call it every frame.
  const before = r.slot(0).start;
  hero.play('walk');
  expect(r.slot(0).start).toBe(before);
  hero.play('walk', { restart: true });
  expect(hero.frame).toBe(0);
  expect(r.slot(0).start).toBeGreaterThan(before);
});

test('an animation played once holds its last frame and says it has finished', async () => {
  const r = await rig();
  const hero = r.sprites.add('hero');
  hero.play('tool', { loop: false });
  const frames: number[] = [];
  for (let i = 0; i < 6; i++) {
    expect(shaderFrame(r, 0)).toBe(hero.frame);
    frames.push(hero.frame);
    expect(hero.finished).toBe(i >= 3);
    r.step(0.126);
  }
  expect(frames).toEqual([0, 1, 2, 2, 2, 2]);
});

/** Runs `body` with console.warn caught, and returns what was warned. */
async function warnings(body: () => Promise<void>): Promise<string[]> {
  const warn = console.warn;
  const warned: string[] = [];
  console.warn = (message: string) => { warned.push(message); };
  try {
    await body();
  } finally {
    console.warn = warn;
  }
  return warned;
}

test('an animation the sprite does not have is named once, and the character keeps doing what it was doing', async () => {
  const warned = await warnings(async () => {
    const r = await rig();
    const pet = r.sprites.add('pet', { facing: 3 * EIGHTH });
    pet.play('walk');
    expect(pet.has('walk')).toBe(true);
    expect(pet.has('tool')).toBe(false);
    // A game loop asks every frame. It must not stop the game, and it must not fill the console.
    for (let i = 0; i < 100; i++) expect(pet.play('tool')).toBe(false);
    expect(pet.animation).toBe('walk');
    expect(shown(r, 0, 'pet')).toBe('row 3');
    // Asked for at the start: the sprite stands in its usual animation.
    const swimmer = r.sprites.add('pet', { animation: 'swim' });
    expect(swimmer.animation).toBe('idle');
    expect(r.sprites.count).toBe(2);
    expect(r.sprites.missingAnimations).toEqual(['pet: tool', 'pet: swim']);
    expect(pet.play('idle')).toBe(true);
  });
  expect(warned).toEqual([
    'sprites: "pet" has no animation named "tool". It has: idle, walk.',
    'sprites: "pet" has no animation named "swim". It has: idle, walk.',
  ]);
});

test('a crowd added in one frame does not idle in step', async () => {
  const r = await rig();
  for (let i = 0; i < 200; i++) r.sprites.add('hero');
  r.step();
  const perFrame = [0, 0, 0, 0];
  for (let i = 0; i < 200; i++) perFrame[shaderFrame(r, i)]++;
  // 200 heroes over the 4 idle frames: each frame has its share.
  for (const n of perFrame) expect(n).toBeGreaterThan(25);
  // The same seed gives the same crowd, and another seed another.
  const again = await rig(flatWorld, { seed: 1 }), other = await rig(flatWorld, { seed: 2 });
  for (let i = 0; i < 20; i++) { again.sprites.add('hero'); other.sprites.add('hero'); }
  const starts = (x: Rig): number[] => Array.from({ length: 20 }, (_, i) => x.slot(i).start);
  expect(starts(again)).toEqual(Array.from({ length: 20 }, (_, i) => r.slot(i).start));
  expect(starts(other)).not.toEqual(starts(again));
});

test('after hours of play the frames are still exact', async () => {
  const r = await rig();
  const walker = r.sprites.add('hero', { animation: 'walk' });
  const idler = r.sprites.add('villager-a');
  const once = r.sprites.add('hero');
  once.play('tool', { loop: false });
  let checked = 0;
  // Six hours in steps of 7.3 seconds, with a new walker now and then.
  for (let i = 0; i < 3000; i++) {
    r.step(7.3);
    if (i % 500 === 250) r.sprites.add('pet', { animation: 'walk' });
    // The GPU's clock and every start time stay small, so 32 bit numbers hold them exactly enough.
    expect(r.uniform('uTime')).toBeLessThan(530);
    for (let s = 0; s < r.sprites.count; s++) expect(Math.abs(r.slot(s).start)).toBeLessThan(530);
    for (const [index, h] of [[0, walker], [1, idler], [2, once]] as const) {
      const elapsed = (r.ctx.time - (h as unknown as { start: number }).start) * (index === 0 ? 10 : index === 1 ? 4 : 8);
      // Skip instants within a hair of a frame change, where 32 and 64 bit numbers may round apart.
      if (Math.abs(elapsed - Math.round(elapsed)) < 1e-3) continue;
      expect(shaderFrame(r, index)).toBe(h.frame);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(8000);
  expect(r.ctx.time).toBeGreaterThan(6 * 3600);
  expect(once.frame).toBe(2);
  // The walker never lost its place: its frame is what a 64 bit clock says, counted from when it started.
  expect(walker.frame).toBe(frameAt(r.ctx.time - (walker as unknown as { start: number }).start, 6, 10));
});

test('tint and visibility are per character', async () => {
  const r = await rig();
  const a = r.sprites.add('hero', { tint: [1, 0.5, 0.25] }), b = r.sprites.add('hero', { facing: 5 * EIGHTH });
  expect(r.slot(0).tint).toEqual([1, 0.5, 0.25]);
  expect(r.slot(1).tint).toEqual([1, 1, 1]);
  b.setTint(2, 2, 2);
  expect(r.slot(1).tint).toEqual([2, 2, 2]);
  expect(r.slot(0).tint).toEqual([1, 0.5, 0.25]);

  // A hidden character has flip 0, which the shaders collapse to nothing. Showing it again brings the mirror back.
  expect(r.slot(1).flip).toBe(-1);
  b.setVisible(false);
  expect(r.slot(1).flip).toBe(0);
  b.setFacing(EIGHTH);
  expect(r.slot(1).flip).toBe(0);
  b.setVisible(true);
  expect(r.slot(1).flip).toBe(1);
  a.setVisible(false);
  expect([r.slot(0).flip, r.slot(1).flip]).toEqual([0, 1]);
  expect(r.sprites.add('pet', { visible: false }) && r.slot(2).flip).toBe(0);
});

test('removing a character keeps every other handle on its own character', async () => {
  const r = await rig();
  const names = ['hero', 'villager-a', 'villager-b', 'pet', 'critter'];
  const handles = names.map((name, i) => r.sprites.add(name, { x: i * 10 }));
  handles[1].remove();
  expect(handles[1].alive).toBe(false);
  expect(r.sprites.count).toBe(4);
  // The last one moved into the freed slot. Its handle still moves it, and nothing else.
  handles[4].setPosition(77, 0, 0);
  handles[2].setPosition(55, 0, 0);
  r.step();
  const xs = Array.from({ length: 4 }, (_, i) => r.slot(i).x);
  expect(xs).toEqual([0, 77, 55, 30]);
  expect(r.slot(1).frameW).toBe(96);
  expect(r.geometries().map((g) => (g as THREE.InstancedBufferGeometry).instanceCount)).toEqual([4, 4]);

  // A removed handle does nothing, however it is called.
  handles[1].setPosition(999, 999, 999);
  handles[1].setFacing(1);
  handles[1].play('walk');
  handles[1].setTint(9, 9, 9);
  handles[1].setVisible(false);
  handles[1].remove();
  r.step();
  expect(Array.from({ length: 4 }, (_, i) => r.slot(i).x)).toEqual([0, 77, 55, 30]);
  expect(r.sprites.count).toBe(4);
});

test('adding and removing 1,000 characters ten times leaves the same buffers and no characters', async () => {
  const r = await rig(flatWorld, { capacity: 64 });
  const names = ['hero', 'villager-a', 'villager-b', 'pet', 'critter'];
  let geometries: THREE.BufferGeometry[] = [];
  let capacity = 0;
  for (let round = 0; round < 10; round++) {
    const handles = Array.from({ length: 1000 }, (_, i) => r.sprites.add(names[i % names.length], { x: i % 40, z: Math.floor(i / 40) }));
    r.step();
    expect(r.sprites.count).toBe(1000);
    expect(r.geometries().map((g) => (g as THREE.InstancedBufferGeometry).instanceCount)).toEqual([1000, 1000]);
    if (round === 0) {
      // 64 doubled until it holds 1,000.
      capacity = r.sprites.capacity;
      expect(capacity).toBe(1024);
      geometries = r.geometries();
    }
    // Remove in a scrambled order, to exercise the slot swaps.
    for (let i = 0; i < 1000; i++) handles[(i * 387) % 1000].remove();
    r.step();
    expect(r.sprites.count).toBe(0);
    expect(handles.every((h) => !h.alive)).toBe(true);
    // No growth and no new geometry after the first round.
    expect(r.sprites.capacity).toBe(capacity);
    expect(r.geometries()[0]).toBe(geometries[0]);
    expect(r.geometries()[1]).toBe(geometries[1]);
    expect(r.geometries().map((g) => (g as THREE.InstancedBufferGeometry).instanceCount)).toEqual([0, 0]);
  }
  // Only two meshes ever: the characters and their shadows.
  expect(r.ctx.scene.children.length).toBe(2);
});

test('a frame with nothing changed uploads nothing, and one moved character uploads only itself', async () => {
  const r = await rig();
  const handles = Array.from({ length: 100 }, (_, i) => r.sprites.add('hero', { x: i }));
  const buffer = (r.geometries()[0].attributes.aPlace as THREE.InterleavedBufferAttribute).data;
  r.step();
  // Pretend the GPU took the upload, as Three.js does when it draws.
  buffer.clearUpdateRanges();
  const version = buffer.version;
  const array = buffer.array;
  for (let i = 0; i < 50; i++) r.step();
  expect(buffer.version).toBe(version);
  expect(buffer.updateRanges.length).toBe(0);

  handles[40].setPosition(1, 2, 3);
  r.step();
  expect(buffer.version).toBe(version + 1);
  expect(buffer.updateRanges).toEqual([{ start: 40 * STRIDE, count: STRIDE }]);
  // Two frames of changes before the GPU takes them are one range that covers both.
  handles[42].setPosition(4, 5, 6);
  r.step();
  expect(buffer.updateRanges).toEqual([{ start: 40 * STRIDE, count: 3 * STRIDE }]);
  // The array is the one it started with: nothing was made anew.
  expect(buffer.array).toBe(array);
});

/** Flat ground with a dark cave to the west, a lamp at the origin and a roof to the east. */
function litWorld(split: boolean): WorldQuery & { lampOn: boolean } {
  const world = {
    lampOn: true,
    heightAt: (x: number, _z: number): number => (x >= 20 ? 6 : 0),
    surfaceAt: (): 'grass' => 'grass',
    openSky: (x: number): boolean => x > -20 && x < 20,
    skyLightAt: (x: number): number => (x <= -20 ? 2 : 15),
    blockLightAt: (x: number, _y: number, z: number): number => (world.lampOn ? Math.max(0, 14 - Math.round(Math.abs(x) + Math.abs(z))) : 0),
    lightAt: (x: number, y: number, z: number): number => Math.max(world.skyLightAt(x), world.blockLightAt(x, y, z)),
  };
  if (!split) {
    const { skyLightAt: _s, blockLightAt: _b, ...plain } = world;
    return plain as unknown as WorldQuery & { lampOn: boolean };
  }
  return world;
}

test('a character takes the sky light and the lamp light of the block it stands in', async () => {
  const r = await rig(litWorld(true));
  const open = r.sprites.add('hero', { x: 10.5, z: 9.5 });
  const cave = r.sprites.add('hero', { x: -30.5, z: 0.5 });
  r.sprites.add('hero', { x: 2.5, z: 0.5 });
  expect([r.slot(0).sky, r.slot(0).lamp]).toEqual([1, 0]);
  // Dark cave: sky light 2 of 15, no lamp in reach.
  expect(r.slot(1).sky).toBeCloseTo(2 / 15, 6);
  expect(r.slot(1).lamp).toBe(0);
  // Three blocks from the lamp: lamp light 11.
  expect([r.slot(2).sky, r.slot(2).lamp.toFixed(4)]).toEqual([1, (11 / 15).toFixed(4)]);

  // Walking changes the light when the block changes.
  cave.setPosition(-5.5, 0, 0.5);
  expect(r.slot(1).sky).toBe(1);
  expect(r.slot(1).lamp).toBeCloseTo(8 / 15, 6);
  open.setPosition(-25.5, 0, 0.5);
  expect(r.slot(0).sky).toBeCloseTo(2 / 15, 6);
});

test('a lamp that goes out darkens the characters near it within a few frames, without them moving', async () => {
  const world = litWorld(true);
  const r = await rig(world);
  for (let i = 0; i < 100; i++) r.sprites.add('hero', { x: (i % 10) + 0.5, z: Math.floor(i / 10) + 0.5 });
  r.step();
  expect(r.slot(0).lamp).toBeGreaterThan(0.8);
  world.lampOn = false;
  // 32 characters a frame at high quality: all 100 within four frames.
  for (let i = 0; i < 4; i++) r.step();
  for (let i = 0; i < 100; i++) expect(r.slot(i).lamp).toBe(0);
});

test('a world that cannot tell sky light from lamp light still darkens a cave', async () => {
  const r = await rig(litWorld(false));
  r.sprites.add('hero', { x: 10.5, z: 9.5 });
  r.sprites.add('hero', { x: -30.5, z: 0.5 });
  expect([r.slot(0).sky, r.slot(0).lamp]).toEqual([1, 0]);
  expect(r.slot(1).sky).toBeCloseTo(2 / 15, 6);
});

test('the shadow lies on the ground under a jump, and at the feet under a roof', async () => {
  const r = await rig(litWorld(true));
  const hero = r.sprites.add('hero', { x: 5.5, y: 0, z: 5.5 });
  expect(r.slot(0).shadowY).toBe(0);
  // A jump within the same block: the shadow stays on the ground.
  hero.setPosition(5.5, 1.4, 5.5);
  expect([r.slot(0).y.toFixed(2), r.slot(0).shadowY]).toEqual(['1.40', 0]);
  // East of x = 20 the column's top is a roof at 6. Indoors at floor level 1 the shadow is at the feet.
  hero.setPosition(25.5, 1, 5.5);
  expect(r.slot(0).shadowY).toBe(1);
  // No shadow at all when asked.
  r.sprites.add('pet', { shadow: 0 });
  expect(r.slot(1).shadowRadius).toBe(0);
});

test('the daylight follows the time of day, or the sky feature when it is handed in', async () => {
  const r = await rig();
  r.sprites.add('hero');
  r.ctx.ambient.cloud = 0;
  r.ctx.ambient.timeOfDay = 0.5;
  r.step();
  const noon = (r.uniform('uSky') as THREE.Color).clone();
  expect([noon.r, noon.g, noon.b]).toEqual([1, 1, 0.96]);
  r.ctx.ambient.timeOfDay = 0;
  r.step();
  const night = r.uniform('uSky') as THREE.Color;
  expect(night.r).toBeLessThan(0.3);
  expect(night.b).toBeGreaterThan(night.r * 1.5);

  const look = { light: new THREE.Color(0.3, 0.6, 0.9) };
  r.sprites.setSky(look);
  r.step();
  expect((r.uniform('uSky') as THREE.Color).equals(look.light)).toBe(true);
  // The sky updates its color in place.
  look.light.setRGB(1.4, 1.3, 1.2);
  r.step();
  expect((r.uniform('uSky') as THREE.Color).r).toBeCloseTo(1.4, 6);
  r.sprites.setSky(null);
  r.step();
  expect((r.uniform('uSky') as THREE.Color).r).toBeLessThan(0.3);
});

test('a sprite the manifest does not have is drawn as the placeholder and listed', async () => {
  const warned = await warnings(async () => {
    const r = await rig();
    const ghost = r.sprites.add('ghost', { animation: 'float' });
    r.sprites.add('ghost');
    r.sprites.add('hero');
    expect(r.sprites.missing).toEqual(['ghost']);
    const place = r.assets.spriteAtlas().place('(placeholder)');
    expect([r.slot(0).rowX, r.slot(0).rowY, r.slot(0).frameW, r.slot(0).frameH]).toEqual([place.x, place.y, 32, 64]);
    expect(r.slot(0).frameH * r.slot(0).scale).toBeCloseTo(2, 6);
    // It stands in for any animation, and that is not a second thing to report.
    expect(ghost.play('walk')).toBe(true);
    expect(ghost.animation).toBe('idle');
    expect(r.sprites.missingAnimations).toEqual([]);
  });
  expect(warned).toEqual(['sprites: the manifest has no sprite named "ghost". A placeholder is drawn in its place.']);
});

test('a sprite with one animation, drawn from one side, plays it from every side', async () => {
  // The lanternfly of the story art: a four frame flutter, front only, and no idle or walk.
  const assets = await loadAssets({
    baseUrl: ASSETS_FOLDER,
    io: {
      json: async (url) => {
        const manifest = (await firstSpritesIO.json(url)) as { sprites: Record<string, any> };
        manifest.sprites.bug = { ...manifest.sprites.critter, animations: { flutter: { frames: 4, fps: 10, rows: { front: 3 } } } };
        return manifest;
      },
      image: firstSpritesIO.image,
    },
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 16 / 9, 1, 400);
  camera.position.set(30, 30, 30);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const ctx: ViewContext = { scene, camera, renderer: {} as THREE.WebGLRenderer, ambient: calmNoon(), world: flatWorld, quality: 'high', time: 0 };
  const sprites = createSprites(ctx, { assets });
  const data = (): Float32Array => ((scene.getObjectByName('sprites') as THREE.Mesh).geometry.attributes.aPlace as THREE.InterleavedBufferAttribute).data.array as Float32Array;
  const place = assets.spriteAtlas().place('bug');
  FACINGS.forEach((_, i) => {
    const bug = sprites.add('bug', { facing: i * EIGHTH });
    expect(bug.animation).toBe('flutter');
    expect([bug.has('walk'), bug.has('flutter')]).toEqual([false, true]);
    const o = i * STRIDE;
    // Row 3 of its sheet, 4 frames at 10 a second, never mirrored.
    expect([data()[o + 4], data()[o + 5], data()[o + 6], data()[o + 7], data()[o + 11]]).toEqual([place.x, place.y + 3 * 96, 4, 10, 1]);
  });
});

test('a color variant made after the system started is found, and every sheet keeps its pixels', async () => {
  const r = await rig();
  r.sprites.add('hero', { facing: 3 * EIGHTH, animation: 'walk' });
  r.sprites.add('pet', { facing: 3 * EIGHTH });
  const before = r.assets.spriteAtlas();
  const grey = r.assets.variant('pet', { '#d67c59': '#918996' });
  r.sprites.add(grey.name, { facing: 7 * EIGHTH });
  const after = r.assets.spriteAtlas();
  expect(after).not.toBe(before);
  expect(r.uniform('uAtlas')).toBe(after.texture);
  expect([(r.uniform('uAtlasSize') as THREE.Vector2).x, (r.uniform('uAtlasSize') as THREE.Vector2).y]).toEqual([after.width, after.height]);
  // Every character points at its sheet's new place.
  expect(shown(r, 0, 'hero')).toBe('row 3');
  expect(shown(r, 1, 'pet')).toBe('row 0');
  expect(shown(r, 2, 'pet~1')).toBe('row 1');
  expect(r.slot(2).page).toBe(after.place('pet~1').page);
});

test('clear and dispose leave nothing in the scene', async () => {
  const r = await rig();
  const handles = Array.from({ length: 10 }, () => r.sprites.add('critter'));
  r.sprites.clear();
  expect(r.sprites.count).toBe(0);
  expect(handles.every((h) => !h.alive)).toBe(true);
  r.step();
  expect(r.geometries().map((g) => (g as THREE.InstancedBufferGeometry).instanceCount)).toEqual([0, 0]);
  r.sprites.add('critter');
  r.sprites.dispose();
  expect(r.ctx.scene.children.length).toBe(0);
});
