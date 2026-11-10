// The budget of the world's props: what the game needs seen is always drawn, and the scattered kinds make
// room for it, so the kinds and variants standing near the player never pass what 40 draw calls allow.
import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import type { ViewContext } from '../../engine/system.ts';
import { calmNoon } from '../../engine/types.ts';
import { flatWorld } from '../../engine/world-query.ts';
import type { GameView } from '../shell/view.ts';
import { PROP_DRAW_CALLS, worldProps, type Scattered } from './props.ts';

/** As much of a `GameView` as the props read: a scene with no renderer, and flat grass for a world. */
function headless(): GameView {
  const ctx = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(20, 1.6, 1, 400),
    renderer: null,
    ambient: calmNoon(),
    world: flatWorld,
    quality: 'high',
    time: 0,
  } as unknown as ViewContext;
  const frames: ((dt: number) => void)[] = [];
  const sim = { seed: 1, ...flatWorld, getBlock: () => 0 };
  return { ctx, world: { sim, query: flatWorld }, onFrame: (fn: (dt: number) => void) => { frames.push(fn); return () => {}; } } as unknown as GameView;
}

/** Every kind and variant the scatter rules can ask for, one prop each. */
function meadow(props: ReturnType<typeof worldProps>): { key: string; handle: number }[] {
  const found: Scattered[] = [];
  const placed = new Map<string, number>();
  for (let cx = 0; cx < 12; cx++) {
    props.scatter(cx * 16, 0, cx * 16 + 16, 16, { density: 3 }, found);
    for (const p of found) {
      const key = `${p.kind}:${p.variant}`;
      if (!placed.has(key)) placed.set(key, props.place(p.kind, p.variant, p.x, p.y, p.z, p.rotation, p.scale));
    }
  }
  return [...placed].map(([key, handle]) => ({ key, handle }));
}

/** The kinds and variants of the town's own props, as the region lists them. */
const TOWN = [
  'door:0', 'door:1', 'door:2', 'window:0', 'window:1', 'window:2', 'bed:0', 'chest:0', 'chest:1', 'stove:0', 'chimney:0',
  'barrel:0', 'barrel:1', 'sack:0', 'sack:1', 'crate:0', 'crate:1', 'cart:1', 'bench:0', 'awning:0', 'sign:0', 'sign:1',
  'sign:2', 'workbench:0', 'forge:0', 'signpost:0', 'gate:1', 'stall:0', 'stall:1',
];

describe('the props of the world', () => {
  test('one view gets one set of props', () => {
    const view = headless();
    expect(worldProps(view)).toBe(worldProps(view));
    expect(worldProps(headless())).not.toBe(worldProps(view));
  });

  test('the scatter rules alone stay well inside the budget, and scatter no trees', () => {
    const props = worldProps(headless());
    const wild = meadow(props);
    expect(wild.length).toBeGreaterThan(10);
    expect(wild.length).toBeLessThanOrEqual(26);
    expect(props.stats().models).toBe(wild.length);
    expect(wild.some((w) => w.key.startsWith('berryBush'))).toBe(false);

    const found: Scattered[] = [];
    props.scatter(0, 0, 64, 64, { density: 3 }, found);
    // Every tree is a block tree of the terrain. The props add what grows under them.
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((p) => ['oak', 'birch', 'pine'].includes(p.kind))).toEqual([]);
    expect(found.every((p) => p.reach === 0 && Number.isNaN(p.top))).toBe(true);
  });

  test('nothing is scattered where the settings say not to', () => {
    const props = worldProps(headless());
    const found: Scattered[] = [];
    props.scatter(0, 0, 32, 32, { density: 3, blocked: (x) => x < 16 }, found);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((p) => p.x >= 16)).toBe(true);
  });

  test('the town on top of a full meadow stays inside 40 draw calls, and every town prop is drawn', () => {
    const props = worldProps(headless());
    const wild = meadow(props);
    const town = TOWN.map((key, i) => {
      const [kind, variant] = key.split(':');
      return props.place(kind, Number(variant), 200 + i * 2, 0, 0, 0, 1, true);
    });
    expect(town.every((handle) => handle !== 0 && props.alive(handle))).toBe(true);
    expect(props.stats().models).toBeLessThanOrEqual(PROP_DRAW_CALLS - 2);
    // The scattered kinds that gave way are the least important ones. The grass and the reeds stay.
    const gone = wild.filter((w) => !props.alive(w.handle)).map((w) => w.key);
    expect(gone.length).toBe(wild.length + TOWN.length - (PROP_DRAW_CALLS - 2));
    expect(gone).not.toContain('reeds:0');
    expect(gone).not.toContain('grassTuft:0');
    expect(gone).toContain('mushroom:1');
  });

  test('with the budget full, a scattered prop is drawn as a standing variant of its kind or left out', () => {
    const props = worldProps(headless());
    meadow(props);
    for (const [i, key] of TOWN.entries()) props.place(key.split(':')[0], Number(key.split(':')[1]), 200 + i * 2, 0, 0, 0, 1, true);
    const before = props.stats().models;
    // Another rock variant becomes the rock that stands. A mushroom, with none standing, is not drawn.
    expect(props.place('rock', 0, 5, 0, 5)).not.toBe(0);
    expect(props.place('mushroom', 1, 6, 0, 6)).toBe(0);
    expect(props.stats().models).toBe(before);
  });

  test('a kind that leaves frees its place', () => {
    const props = worldProps(headless());
    const a = props.place('rock', 1, 0, 0, 0), b = props.place('rock', 1, 1, 0, 1);
    expect(props.stats().models).toBe(1);
    props.remove(a);
    expect(props.alive(a)).toBe(false);
    expect(props.stats().models).toBe(1);
    props.remove(b);
    expect(props.stats().models).toBe(0);
    expect(props.place('no such prop', 0, 0, 0, 0)).toBe(0);
  });

  test('a station is drawn to fit its block', () => {
    const props = worldProps(headless());
    expect(props.span('bed', 0)).toBeGreaterThan(1.9);
    expect(props.span('chest', 0)).toBeLessThan(1);
  });
});
