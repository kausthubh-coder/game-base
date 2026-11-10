import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { PROPS, PROP_KINDS, TRIANGLE_CAP, propDef, type PropKind } from '../../content/props.ts';
import type { ViewContext } from '../../engine/system.ts';
import { calmNoon, type Surface } from '../../engine/types.ts';
import { flatWorld, type WorldQuery } from '../../engine/world-query.ts';
import { buildProp, propExtras } from './build.ts';
import { BUILDERS } from './builders/index.ts';
import { jitterAt } from './jitter.sim.ts';
import { darkness } from './light.sim.ts';
import { paletteColors } from './palette.ts';
import { createProps } from './props.view.ts';
import { scatter, type ScatteredProp } from './scatter.sim.ts';

const each = PROP_KINDS.flatMap((kind) => PROPS[kind].variants.map((name, variant) => ({ kind, variant, label: `${kind} ${name}` })));
const TREES: PropKind[] = ['oak', 'birch', 'pine'];

// ---------------------------------------------------------------- the library

describe('the prop library', () => {
  test('every color a prop may use is in the locked palette', () => {
    const palette = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../assets-src/palette.json'), 'utf8')) as { colors: string[] };
    const locked = new Set(palette.colors.map((c) => parseInt(c.slice(1), 16)));
    const strays = paletteColors().filter((c) => !locked.has(c)).map((c) => '#' + c.toString(16).padStart(6, '0'));
    expect(strays).toEqual([]);
  });

  test('every entry names a builder that exists, and every builder has an entry', () => {
    const named = new Set<string>(PROP_KINDS.map((kind) => PROPS[kind].builder));
    for (const name of named) expect(BUILDERS[name], `builder ${name}`).toBeFunction();
    expect(Object.keys(BUILDERS).filter((name) => !named.has(name))).toEqual([]);
  });

  test('every prop and variant is inside its triangle budget, and no budget is above the style sheet', () => {
    const over: string[] = [];
    for (const { kind, variant, label } of each) {
      const def = PROPS[kind];
      const { triangles } = propExtras(buildProp(kind, variant));
      if (triangles > def.triangles) over.push(`${label}: ${triangles} triangles, budget ${def.triangles}`);
      if (triangles < 4) over.push(`${label}: only ${triangles} triangles`);
      if (def.triangles > TRIANGLE_CAP[def.group]) over.push(`${label}: budget ${def.triangles} is above the cap of ${TRIANGLE_CAP[def.group]} for a ${def.group}`);
    }
    expect(over).toEqual([]);
  });

  test('every prop stands on the ground at its own middle and carries the attributes the material reads', () => {
    for (const { kind, variant, label } of each) {
      const geometry = buildProp(kind, variant);
      const box = geometry.boundingBox as THREE.Box3;
      expect(box.min.y, `${label} bottom`).toBeGreaterThan(-0.15);
      // A shop sign hangs from its wall. Everything else reaches the ground.
      if (kind !== 'sign') expect(box.min.y, `${label} bottom`).toBeLessThan(0.15);
      expect(Math.abs(box.min.x + box.max.x) / 2, `${label} middle`).toBeLessThan(1);
      for (const name of ['position', 'normal', 'color', 'aFx']) expect(geometry.getAttribute(name), `${label} ${name}`).toBeDefined();
      const normal = geometry.getAttribute('normal');
      for (let i = 0; i < normal.count; i++) expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 3);
    }
  });

  test('a prop sways exactly when its entry says wind moves it, and never at its foot', () => {
    for (const { kind, variant, label } of each) {
      const geometry = buildProp(kind, variant);
      const fx = geometry.getAttribute('aFx'), position = geometry.getAttribute('position');
      let most = 0, atFoot = 0;
      for (let i = 0; i < fx.count; i++) {
        most = Math.max(most, fx.getX(i));
        if (position.getY(i) < 0.02) atFoot = Math.max(atFoot, fx.getX(i));
      }
      expect(most > 0, `${label} sways`).toBe(PROPS[kind].wind);
      // A lily pad lies on the water and a bush's lowest leaves touch the ground: everything else is rooted.
      if (kind !== 'bush' && kind !== 'berryBush') expect(atFoot, `${label} sway at the ground`).toBe(0);
    }
  });

  test('a prop glows and lists where its light sits exactly when its entry gives light', () => {
    for (const { kind, variant, label } of each) {
      const def = propDef(kind);
      const geometry = buildProp(kind, variant);
      const fx = geometry.getAttribute('aFx');
      let glow = 0;
      for (let i = 0; i < fx.count; i++) glow = Math.max(glow, fx.getY(i));
      expect(glow > 0, `${label} glows`).toBe(def.light > 0);
      expect(propExtras(geometry).lights.length > 0, `${label} lists a light`).toBe(def.light > 0);
      // 2 marks a light that never goes out.
      if (def.light > 0) expect(glow === 2, `${label} always lit`).toBe(def.alwaysLit === true);
    }
  });

  test('a tree is as tall and as wide as its entry says, so tree tops can be listed without building it', () => {
    for (const kind of TREES) {
      const crown = propDef(kind).crown as readonly { top: number; reach: number }[];
      expect(crown.length).toBe(PROPS[kind].variants.length);
      crown.forEach(({ top, reach }, variant) => {
        const box = buildProp(kind, variant).boundingBox as THREE.Box3;
        expect(Math.abs(box.max.y - top) / top, `${kind} ${variant} top`).toBeLessThan(0.08);
        const widest = Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z);
        expect(widest / reach, `${kind} ${variant} reach`).toBeGreaterThan(0.75);
        expect(widest / reach, `${kind} ${variant} reach`).toBeLessThan(1.35);
      });
    }
  });

  test('a builder gives the same shape every time', () => {
    for (const kind of ['oak', 'rock', 'flower'] as const) {
      const a = buildProp(kind, 1).getAttribute('position').array, b = buildProp(kind, 1).getAttribute('position').array;
      expect(Array.from(a)).toEqual(Array.from(b));
    }
  });

  test('a name that is not in the table fails at once', () => {
    expect(() => buildProp('oka', 0)).toThrow('no prop called oka');
    expect(() => buildProp('oak', 3)).toThrow('no variant 3');
  });
});

// ---------------------------------------------------------------- scatter

/** Grass at y = 5 with a path across it, a shallow pond with its bed at y = 4, and a strip of sand along one side. */
function land(): { world: WorldQuery; waterLevel: () => number } {
  const surfaceAt = (x: number, z: number): Surface => {
    if (Math.hypot(Math.floor(x) + 0.5 - 44, Math.floor(z) + 0.5 - 44) < 8) return 'water';
    if (Math.floor(z) >= 20 && Math.floor(z) < 23) return 'dirt';
    if (Math.floor(x) >= 60) return 'sand';
    return 'grass';
  };
  return {
    world: { surfaceAt, heightAt: (x, z) => (surfaceAt(x, z) === 'water' ? 4 : 5), openSky: () => true, lightAt: () => 15 },
    waterLevel: () => 4.88,
  };
}

const AREA = { x0: 0, z0: 0, x1: 64, z1: 64 };
const everywhereForest = () => 0.8;
const isTree = (p: ScatteredProp) => TREES.includes(p.kind);
const byPlace = (a: ScatteredProp, b: ScatteredProp) => a.x - b.x || a.z - b.z || a.kind.localeCompare(b.kind);

describe('scatter', () => {
  test('the same seed scatters the same way, and another seed does not', () => {
    const { world, waterLevel } = land();
    const first = scatter(7, world, { area: AREA, waterLevel });
    const again = scatter(7, world, { area: AREA, waterLevel });
    expect(first.props.length).toBeGreaterThan(300);
    expect(again).toEqual(first);
    const other = scatter(8, world, { area: AREA, waterLevel });
    expect(other.props).not.toEqual(first.props);
  });

  test('two halves of an area scatter the same as the whole', () => {
    const { world, waterLevel } = land();
    const whole = scatter(7, world, { area: AREA, waterLevel });
    const west = scatter(7, world, { area: { ...AREA, x1: 31 }, waterLevel });
    const east = scatter(7, world, { area: { ...AREA, x0: 31 }, waterLevel });
    expect([...west.props, ...east.props].sort(byPlace)).toEqual([...whole.props].sort(byPlace));
    expect(west.treeTops.length + east.treeTops.length).toBe(whole.treeTops.length);
  });

  test('no tree stands on a path or in water: every tree is on grass', () => {
    const { world, waterLevel } = land();
    const { props } = scatter(3, world, { area: AREA, waterLevel, forest: everywhereForest });
    const trees = props.filter(isTree);
    expect(trees.length).toBeGreaterThan(100);
    for (const tree of trees) expect(world.surfaceAt(tree.x, tree.z)).toBe('grass');
  });

  test('nothing at all is on the path, and only reeds and lily pads are in the water', () => {
    const { world, waterLevel } = land();
    const { props } = scatter(3, world, { area: AREA, waterLevel, forest: everywhereForest, density: 2 });
    expect(props.filter((p) => world.surfaceAt(p.x, p.z) === 'dirt')).toEqual([]);
    const wet = props.filter((p) => world.surfaceAt(p.x, p.z) === 'water');
    expect(new Set(wet.map((p) => p.kind))).toEqual(new Set<PropKind>(['reeds', 'lilyPad']));
  });

  test('reeds stand beside water, lily pads float on its surface', () => {
    const { world, waterLevel } = land();
    const { props } = scatter(3, world, { area: AREA, waterLevel });
    const reeds = props.filter((p) => p.kind === 'reeds'), pads = props.filter((p) => p.kind === 'lilyPad');
    expect(reeds.length).toBeGreaterThan(10);
    expect(pads.length).toBeGreaterThan(3);
    for (const reed of reeds) {
      // The pond's edge is 8 blocks from its middle: a reed is within a block and a half of it, on the bank or in the shallows.
      expect(Math.abs(Math.hypot(reed.x - 44, reed.z - 44) - 8)).toBeLessThan(1.6);
      expect(reed.y).toBe(world.heightAt(reed.x, reed.z));
    }
    for (const pad of pads) {
      expect(world.surfaceAt(pad.x, pad.z)).toBe('water');
      expect(pad.y).toBe(4.88);
    }
    // Without the water's level there is nowhere to float a pad.
    expect(scatter(3, world, { area: AREA }).props.filter((p) => p.kind === 'lilyPad')).toEqual([]);
  });

  test('nothing grows where the caller says it may not', () => {
    const { props } = scatter(5, flatWorld, { area: AREA, blocked: (x, z) => x > 20 && x < 40 && z > 20 && z < 40 });
    expect(props.length).toBeGreaterThan(300);
    expect(props.filter((p) => p.x > 20 && p.x < 40 && p.z > 20 && p.z < 40)).toEqual([]);
  });

  test('density scales the amount, and 0 leaves the land bare', () => {
    const count = (density: number) => scatter(5, flatWorld, { area: AREA, density }).props.length;
    expect(count(0)).toBe(0);
    expect(count(0.5)).toBeLessThan(count(1) * 0.7);
    expect(count(2)).toBeGreaterThan(count(1) * 1.4);
  });

  test('a forest is mostly trees apart from each other, a meadow has almost none', () => {
    const forest = scatter(9, flatWorld, { area: AREA, forest: () => 1 }).props.filter(isTree);
    const meadow = scatter(9, flatWorld, { area: AREA, forest: () => 0 }).props.filter(isTree);
    expect(forest.length).toBeGreaterThan(150);
    expect(meadow.length).toBeLessThan(forest.length / 10);
    for (const a of forest) for (const b of forest) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(1);
  });

  test('it lists the top of every tree, at the height the tree is drawn', () => {
    const { props, treeTops } = scatter(9, flatWorld, { area: AREA, forest: () => 1 });
    const trees = props.filter(isTree);
    expect(treeTops.length).toBe(trees.length);
    trees.forEach((tree, i) => {
      const top = treeTops[i];
      const def = propDef(tree.kind);
      const crown = (def.crown as readonly { top: number; reach: number }[])[tree.variant];
      const size = tree.scale * jitterAt(def.vary, tree.x, tree.y, tree.z, { turn: 0, size: 1, r: 1, g: 1, b: 1 }).size;
      expect(top).toEqual({ kind: tree.kind, x: tree.x, y: tree.y + crown.top * size, z: tree.z, reach: crown.reach * size });
    });
  });
});

// ---------------------------------------------------------------- the system that draws them

/** A view context with no renderer: the system only fills meshes, so it runs without a page. */
function headless(): ViewContext {
  const camera = new THREE.PerspectiveCamera(20, 16 / 9, 0.5, 1200);
  return { scene: new THREE.Scene(), camera, renderer: undefined as unknown as THREE.WebGLRenderer, ambient: calmNoon(), world: flatWorld, quality: 'high', time: 0 };
}

/** The game's camera: a long lens looking down at 35 degrees on this point from `distance` meters. */
function lookDownAt(ctx: ViewContext, x: number, z: number, distance: number): void {
  const pitch = (35 * Math.PI) / 180;
  ctx.camera.position.set(x, Math.sin(pitch) * distance, z + Math.cos(pitch) * distance);
  ctx.camera.lookAt(x, 0, z);
}

describe('the props system', () => {
  test('a forest of 2,000 props costs 40 draw calls or fewer, shadows included', () => {
    const ctx = headless();
    const props = createProps(ctx);
    const forest = scatter(11, flatWorld, { area: { x0: 0, z0: 0, x1: 80, z1: 80 }, forest: () => 0.8 }).props;
    expect(forest.length).toBeGreaterThanOrEqual(2000);
    for (const p of forest.slice(0, 2000)) props.place(p.kind, p.variant, p, p.rotation, p.scale);
    lookDownAt(ctx, 40, 40, 400);
    props.update(1 / 60, ctx);
    const stats = props.stats();
    expect(stats.placed).toBe(2000);
    expect(stats.drawn).toBe(2000);
    expect(stats.cells).toBeGreaterThan(4);
    expect(stats.shadowCalls).toBe(2);
    expect(stats.drawCalls + stats.shadowCalls).toBeLessThanOrEqual(40);
    // One mesh for each kind and variant, however many cells its copies stand in.
    const kinds = new Set(forest.slice(0, 2000).map((p) => `${p.kind}:${p.variant}`));
    expect(stats.drawCalls).toBe(kinds.size);
    props.dispose();
  });

  test('cells outside the view are not drawn', () => {
    const ctx = headless();
    const props = createProps(ctx);
    for (let i = 0; i < 10; i++) {
      props.place('rock', 1, { x: 1 + i * 0.5, y: 0, z: 5 });
      props.place('rock', 1, { x: 1001 + i * 0.5, y: 0, z: 1000 });
    }
    lookDownAt(ctx, 10, 5, 60);
    props.update(1 / 60, ctx);
    expect(props.stats()).toMatchObject({ placed: 20, drawn: 10, drawCalls: 1, cells: 2, cellsInView: 1 });
    lookDownAt(ctx, 1005, 1000, 60);
    props.update(1 / 60, ctx);
    expect(props.stats()).toMatchObject({ drawn: 10, cellsInView: 1 });
    // Looking away from both.
    lookDownAt(ctx, -5000, -5000, 60);
    props.update(1 / 60, ctx);
    expect(props.stats()).toMatchObject({ drawn: 0, drawCalls: 0, shadowCalls: 0, cellsInView: 0 });
    props.dispose();
  });

  test('a removed prop is gone on the next frame, and its handle is spent', () => {
    const ctx = headless();
    const props = createProps(ctx);
    lookDownAt(ctx, 0, 0, 60);
    const a = props.place('barrel', 0, { x: 1, y: 0, z: 1 });
    const b = props.place('barrel', 0, { x: 3, y: 0, z: 1 });
    expect(b).not.toBe(a);
    props.update(1 / 60, ctx);
    expect(props.stats().drawn).toBe(2);
    props.remove(a);
    props.remove(a);
    props.update(1 / 60, ctx);
    expect(props.stats()).toMatchObject({ placed: 1, drawn: 1 });
    props.clear();
    props.update(1 / 60, ctx);
    expect(props.stats()).toMatchObject({ placed: 0, drawn: 0, drawCalls: 0 });
    props.dispose();
  });

  test('each copy gets its own small turn, size and tint, and the same place gives the same copy', () => {
    const ctx = headless();
    const props = createProps(ctx);
    lookDownAt(ctx, 0, 0, 60);
    for (let i = 0; i < 6; i++) props.place('oak', 0, { x: i * 4 - 10, y: 0, z: 0 });
    props.update(1 / 60, ctx);
    const mesh = props.group.children.find((c) => c.name === 'props:oak:0') as THREE.InstancedMesh;
    const read = () => {
      const rows: string[] = [];
      const matrix = new THREE.Matrix4(), color = new THREE.Color();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        mesh.getColorAt(i, color);
        rows.push([...matrix.elements, color.r, color.g, color.b].map((v) => v.toFixed(4)).join(','));
      }
      return rows;
    };
    const first = read();
    expect(new Set(first).size).toBe(6);
    const sizes = first.map((row) => Math.hypot(...row.split(',').slice(0, 3).map(Number)));
    for (const size of sizes) expect(Math.abs(size - 1)).toBeLessThanOrEqual(PROPS.oak.vary.size + 1e-4);
    expect(new Set(sizes.map((s) => s.toFixed(3))).size).toBeGreaterThan(3);
    // A door must line up with its wall: it is never turned or resized.
    props.place('door', 0, { x: 0.5, y: 0, z: 4 }, Math.PI / 2);
    props.update(1 / 60, ctx);
    const door = props.group.children.find((c) => c.name === 'props:door:0') as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    door.getMatrixAt(0, matrix);
    const expected = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(0.5, 0, 4);
    matrix.elements.forEach((v, i) => expect(v).toBeCloseTo(expected.elements[i], 5));
    props.dispose();
  });

  test('it lists where the light of each lit prop sits, turned with the prop', () => {
    const ctx = headless();
    const props = createProps(ctx);
    expect(props.lights()).toEqual([]);
    props.place('oak', 0, { x: 0, y: 0, z: 0 });
    const lamp = props.place('lampPost', 0, { x: 10, y: 4, z: 20 }, Math.PI / 2);
    const glass = props.place('window', 0, { x: 30, y: 5, z: 40 });
    const lights = props.lights();
    expect(lights.map((l) => [l.handle, l.kind, l.level, l.always])).toEqual([[lamp, 'lampPost', 14, false], [glass, 'window', 9, false]]);
    // The lantern hangs 0.52 out along the post's +x, which a quarter turn swings to -z.
    expect(lights[0].x).toBeCloseTo(10, 5);
    expect(lights[0].y).toBeCloseTo(6.2, 5);
    expect(lights[0].z).toBeCloseTo(19.48, 5);
    // A window's light sits a little in front of the glass.
    expect(lights[1]).toMatchObject({ x: 30, y: 5.5 });
    expect(lights[1].z).toBeCloseTo(40.35, 5);
    expect(props.lights()).toBe(lights);
    props.place('forge', 0, { x: 0, y: 0, z: 5 });
    expect(props.lights().at(-1)).toMatchObject({ kind: 'forge', level: 12, always: true });
    props.remove(lamp);
    expect(props.lights().map((l) => l.kind)).toEqual(['window', 'forge']);
    props.dispose();
  });

  test('windows and lamps are lit when the clock says it is dark', () => {
    expect(darkness(0.5)).toBe(0);
    expect(darkness(0.3)).toBe(0);
    expect(darkness(0.7)).toBe(0);
    expect(darkness(0)).toBe(1);
    expect(darkness(0.9)).toBe(1);
    expect(darkness(0.1)).toBe(1);
    expect(darkness(0.76)).toBeGreaterThan(0);
    expect(darkness(0.76)).toBeLessThan(1);
    const ctx = headless();
    const props = createProps(ctx);
    ctx.ambient.timeOfDay = 0.95;
    props.update(1 / 60, ctx);
    expect(props.glow).toBe(1);
    ctx.ambient.timeOfDay = 0.5;
    props.update(1 / 60, ctx);
    expect(props.glow).toBe(0);
    props.dispose();
  });

  test('low quality thins the small plants and drops the shadows, and trees stay', () => {
    const ctx = headless();
    const props = createProps(ctx);
    lookDownAt(ctx, 16, 16, 200);
    for (let i = 0; i < 200; i++) props.place('grassTuft', i % 3, { x: (i % 20) + 0.5, y: 0, z: Math.floor(i / 20) + 0.5 });
    for (let i = 0; i < 10; i++) props.place('pine', 0, { x: i * 3, y: 0, z: 20 });
    props.update(1 / 60, ctx);
    expect(props.stats()).toMatchObject({ drawn: 210, shadowCalls: 2 });
    ctx.quality = 'low';
    props.update(1 / 60, ctx);
    const low = props.stats();
    expect(low.shadowCalls).toBe(0);
    expect(low.drawn).toBeGreaterThan(10 + 200 * 0.3);
    expect(low.drawn).toBeLessThan(10 + 200 * 0.6);
    ctx.quality = 'high';
    props.update(1 / 60, ctx);
    expect(props.stats().drawn).toBe(210);
    props.dispose();
  });
});
